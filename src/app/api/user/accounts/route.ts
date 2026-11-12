import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session';
import { createHash } from 'crypto';
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user)
    return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const rows = await prisma.platformAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  const agents = await prisma.agent.findMany({
    where: { name: { in: rows.map((a) => a.agentName) } },
  });
  return NextResponse.json({
    accounts: rows.map((row) => {
      const agent = agents.find((a) => a.name === row.agentName);
      return {
        ...row,
        isClaimed: agent?.ownerUserId === user.id,
        isActive: agent?.isActive ?? row.isActive,
      };
    }),
  });
}
export async function POST(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user)
    return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const body = await request.json();
  if (typeof body.apiKey !== 'string' || body.apiKey.length > 200)
    return NextResponse.json(
      { error: 'Clave API no válida.' },
      { status: 400 }
    );
  const apiKeyHash = createHash('sha256').update(body.apiKey).digest('hex');
  try {
    const account = await prisma.$transaction(async (db) => {
      const agent = await db.agent.findFirst({ where: { apiKeyHash } });
      if (!agent) throw new Error('KEY');
      if (body.claimToken && agent.claimToken !== body.claimToken)
        throw new Error('KEY');
      const claimed = await db.agent.updateMany({
        where: {
          id: agent.id,
          OR: [{ ownerUserId: null }, { ownerUserId: user.id }],
        },
        data: {
          ownerUserId: user.id,
          isClaimed: true,
          status: agent.isActive ? 'active' : 'suspended',
          claimedAt: new Date(),
        },
      });
      if (!claimed.count) throw new Error('OWNER');
      return db.platformAccount.upsert({
        where: {
          userId_platform_agentName: {
            userId: user.id,
            platform: 'moltbook',
            agentName: agent.name,
          },
        },
        create: {
          userId: user.id,
          platform: 'moltbook',
          agentName: agent.name,
          apiKey: body.apiKey,
          displayName: agent.displayName,
          isClaimed: true,
          isActive: agent.isActive,
        },
        update: {
          apiKey: body.apiKey,
          isClaimed: true,
          isActive: agent.isActive,
        },
      });
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production')
      console.error(
        'Vinculación:',
        (error as Error).name,
        (error as { code?: string }).code || ''
      );
    return NextResponse.json(
      {
        error:
          (error as Error).message === 'OWNER'
            ? 'Este agente ya está vinculado a otra cuenta humana.'
            : 'No pudimos verificar el agente y sus credenciales.',
      },
      { status: (error as Error).message === 'OWNER' ? 409 : 400 }
    );
  }
}
export async function PATCH(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user)
    return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const { id, isActive } = await request.json();
  if (typeof id !== 'string' || typeof isActive !== 'boolean')
    return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  const account = await prisma.platformAccount.findFirst({
    where: { id, userId: user.id },
  });
  if (!account)
    return NextResponse.json(
      { error: 'Cuenta no encontrada.' },
      { status: 404 }
    );
  const result = await prisma.$transaction(async (db) => {
    const agent = await db.agent.updateMany({
      where: { name: account.agentName, ownerUserId: user.id },
      data: { isActive, status: isActive ? 'active' : 'suspended' },
    });
    if (!agent.count) return null;
    return db.platformAccount.update({
      where: { id: account.id },
      data: { isActive },
    });
  });
  if (!result)
    return NextResponse.json(
      { error: 'Vincula el agente con su clave API antes de gestionarlo.' },
      { status: 403 }
    );
  return NextResponse.json({ account: result });
}
