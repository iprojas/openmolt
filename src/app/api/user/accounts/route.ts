import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session';
import { randomBytes, createHash } from 'crypto';
const { encryptKey, decryptKey } = require('@/backend/utils/credentials');
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const summary = (a: any) => ({ id: a.id, agentName: a.name, displayName: a.displayName, isClaimed: a.isClaimed, isActive: a.isActive, hasCredentials: !!a.apiKeyHash });

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return json({ error: 'Inicia sesión con Google.' }, 401);
  if (request.nextUrl.searchParams.has('reveal')) {
    const agent = await prisma.agent.findFirst({ where: { id: request.nextUrl.searchParams.get('id') || '', ownerUserId: user.id, kind: 'agent' } });
    if (!agent) return json({ error: 'Agente no encontrado.' }, 404);
    return json({ apiKey: agent.apiKeyEncrypted ? decryptKey(agent.apiKeyEncrypted) : null });
  }
  const agents = await prisma.agent.findMany({ where: { ownerUserId: user.id, kind: 'agent' }, orderBy: { createdAt: 'desc' } });
  return json({ accounts: agents.map(summary) });
}

export async function POST(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return json({ error: 'Inicia sesión con Google.' }, 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Datos no válidos.' }, 400);
  if (typeof body.claimToken !== 'string' || !/^cl2_claim_[a-f0-9]{64}$/.test(body.claimToken)) return json({ error: 'Enlace de vinculación no válido.' }, 400);
  // Atomic compare-and-set consumes the token. A second browser cannot take ownership.
  const result = await prisma.$transaction(async db => {
    const agent = await db.agent.findFirst({ where: { claimToken: body.claimToken, kind: 'agent', ownerUserId: null } });
    if (!agent) return null;
    const claimed = await db.agent.updateMany({
      where: { id: agent.id, claimToken: body.claimToken, ownerUserId: null },
      data: { ownerUserId: user.id, claimToken: null, isClaimed: true, claimedAt: new Date(), status: agent.isActive ? 'active' : 'suspended' },
    });
    return claimed.count ? { ...agent, isClaimed: true } : null;
  });
  return result ? json({ account: summary(result) }, 201) : json({ error: 'El enlace ya fue utilizado o no es válido. Revisa Mis agentes.' }, 409);
}

export async function PATCH(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return json({ error: 'Inicia sesión con Google.' }, 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Datos no válidos.' }, 400);
  if (typeof body.id !== 'string') return json({ error: 'Agente no válido.' }, 400);
  let data;
  if (typeof body.isActive === 'boolean') data = { isActive: body.isActive, status: body.isActive ? 'active' : 'suspended' };
  else if (body.action === 'revoke') data = { apiKeyHash: null, apiKeyEncrypted: null };
  else if (body.action === 'rotate') {
    const key = `cl2_${randomBytes(32).toString('hex')}`;
    data = { apiKeyHash: createHash('sha256').update(key).digest('hex'), apiKeyEncrypted: encryptKey(key) };
  } else return json({ error: 'Acción no válida.' }, 400);
  const result = await prisma.agent.updateMany({ where: { id: body.id, ownerUserId: user.id, kind: 'agent' }, data });
  return result.count ? json({ success: true }) : json({ error: 'Agente no encontrado.' }, 404);
}
