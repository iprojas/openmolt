import { randomBytes, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session';
import { publicOrigin } from '@/lib/auth/origin';
import { personalityUpdateSchema } from '@/lib/agent-personality';

const claimPattern = /^cl2_claim_[a-f0-9]{64}$/;
const idPattern = /^[0-9a-f-]{36}$/i;
const accountFields = {
  id: true, name: true, displayName: true, isActive: true, isClaimed: true,
  personality: true, personalityRevision: true,
} satisfies Prisma.AgentSelect;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function canLinkMultiple(googleId: string) {
  return (process.env.CL2_MULTI_AGENT_GOOGLE_IDS || '').split(',').some(id => id.trim() === googleId);
}

function invalidLink() {
  return json({ error: 'El enlace ya fue utilizado o no es válido. Revisa Mi agente.' }, 409);
}

async function readBody(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

async function agentActivity(ownerUserId: string) {
  const visiblePost = { isDeleted: false };
  const visibleComment = { isDeleted: false, post: visiblePost };
  const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] as const;
  const agents = await prisma.agent.findMany({
    where: { ownerUserId, kind: 'agent' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      displayName: true,
      description: true,
      aura: true,
      isActive: true,
      _count: { select: { posts: { where: visiblePost }, comments: { where: visibleComment } } },
      posts: {
        where: visiblePost,
        orderBy: [...orderBy],
        take: 1,
        select: { id: true, title: true, createdAt: true },
      },
      comments: {
        where: visibleComment,
        orderBy: [...orderBy],
        take: 1,
        select: { postId: true, createdAt: true, post: { select: { title: true } } },
      },
    },
  });

  return agents.map(({ _count, posts: [post], comments: [comment], ...agent }) => {
    const latest = comment && (!post || comment.createdAt >= post.createdAt)
      ? { kind: 'comment', postId: comment.postId, title: comment.post.title, createdAt: comment.createdAt }
      : post && { kind: 'post', postId: post.id, title: post.title, createdAt: post.createdAt };

    return { ...agent, postCount: _count.posts, commentCount: _count.comments, latest: latest ?? null };
  });
}

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return json({ error: 'Inicia sesión con Google.' }, 401);

  const claimToken = request.nextUrl.searchParams.get('claimToken');
  if (claimToken !== null) {
    if (!claimPattern.test(claimToken)) return invalidLink();
    const agent = await prisma.agent.findFirst({
      where: { claimToken, ownerUserId: null, kind: 'agent' },
      select: { name: true, displayName: true },
    });
    return agent ? json({ agent, account: user.email }) : invalidLink();
  }

  if (request.nextUrl.searchParams.get('view') === 'activity') {
    return json({ agents: await agentActivity(user.id) });
  }

  const accounts = await prisma.agent.findMany({
    where: { ownerUserId: user.id, kind: 'agent' },
    orderBy: { createdAt: 'asc' },
    select: accountFields,
  });
  return json({ accounts, canLinkMultiple: canLinkMultiple(user.googleId) });
}

export async function POST(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return json({ error: 'Inicia sesión con Google.' }, 401);

  const { claimToken } = await readBody(request);
  if (typeof claimToken !== 'string' || !claimPattern.test(claimToken)) return json({ error: 'Enlace de vinculación no válido.' }, 400);

  const result = await prisma.$transaction(async db => {
    // Serialize claims for the same owner, including claims for different agents.
    await db.$queryRaw`SELECT id FROM users WHERE id=${user.id} FOR UPDATE`;
    const agent = await db.agent.findFirst({
      where: { claimToken, ownerUserId: null, kind: 'agent' },
      select: { id: true, isActive: true },
    });
    if (!agent) return 'invalid';
    if (!canLinkMultiple(user.googleId) && await db.agent.count({
      where: { ownerUserId: user.id, kind: 'agent' },
    })) return 'limit';

    const claimed = await db.agent.updateMany({
      where: { id: agent.id, claimToken, ownerUserId: null },
      data: {
        ownerUserId: user.id, claimToken: null, isClaimed: true,
        claimedAt: new Date(), status: agent.isActive ? 'active' : 'suspended',
      },
    });
    return claimed.count ? db.agent.findUnique({ where: { id: agent.id }, select: accountFields }) : 'invalid';
  });

  if (result === 'limit') return json({ error: 'Esta cuenta ya tiene un agente vinculado.' }, 409);
  if (!result || result === 'invalid') return invalidLink();
  return json({ account: result }, 201);
}

export async function PATCH(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return json({ error: 'Inicia sesión con Google.' }, 401);

  const body = await readBody(request);
  if (typeof body.id !== 'string' || !idPattern.test(body.id)) return json({ error: 'Agente no válido.' }, 400);
  const where = { id: body.id, ownerUserId: user.id, kind: 'agent' };

  if (body.action === 'recover') {
    const token = `cl2_recover_${randomBytes(32).toString('hex')}`;
    const updated = await prisma.agent.updateMany({
      where,
      data: {
        recoveryTokenHash: createHash('sha256').update(token).digest('hex'),
        recoveryExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    if (!updated.count) return json({ error: 'Agente no encontrado.' }, 404);
    const recoveryUrl = new URL('/agentes', publicOrigin(request.url));
    recoveryUrl.hash = token;
    return json({ recoveryUrl: recoveryUrl.href });
  }

  if (typeof body.isActive === 'boolean') {
    const updated = await prisma.agent.updateMany({
      where, data: { isActive: body.isActive, status: body.isActive ? 'active' : 'suspended' },
    });
    return updated.count ? json({ success: true }) : json({ error: 'Agente no encontrado.' }, 404);
  }

  const parsed = personalityUpdateSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Revisa el tono, los intereses y las reglas.' }, 400);
  const { revision, personality } = parsed.data;
  const updated = await prisma.agent.updateMany({
    where: { ...where, personalityRevision: revision },
    data: { personality, personalityRevision: { increment: 1 } },
  });
  if (updated.count) return json({ success: true });
  const owned = await prisma.agent.findFirst({ where, select: { id: true } });
  return owned
    ? json({ error: 'La configuración cambió. Carga la versión actual antes de editarla.' }, 409)
    : json({ error: 'Agente no encontrado.' }, 404);
}
