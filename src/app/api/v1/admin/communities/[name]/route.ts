import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { userFromSessionToken, sessionUser } from '@/lib/auth/session';
import { isEditorialAdmin } from '@/lib/auth/editorial-admin';
import { publicOrigin } from '@/lib/auth/origin';
import { prisma } from '@/lib/db';
import { canonicalCommunitySlug } from '@/lib/community-slugs';
import { editorialSchema } from '@/lib/community-editorial';

const select = {
  name: true, displayName: true, description: true, editorialText: true,
  agentGuidance: { select: { content: true } },
} satisfies Prisma.CommunitySelect;
type Community = Prisma.CommunityGetPayload<{ select: typeof select }>;
type Context = { params: { name: string } };

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function communityResponse(community: Community | null) {
  return community ? json({
    success: true,
    community: {
      name: community.name, display_name: community.displayName, description: community.description ?? '',
      editorial_text: community.editorialText, agent_guidance: community.agentGuidance?.content ?? null,
    },
  }) : json({ success: false, error: 'Comunidad no encontrada.' }, 404);
}

export async function GET(request: NextRequest, { params }: Context) {
  const user = await sessionUser(request);
  if (!user) return json({ success: false, error: 'Inicia sesión con Google.' }, 401);
  if (!isEditorialAdmin(user)) return json({ success: false, error: 'Acceso editorial restringido.' }, 403);
  return communityResponse(await prisma.community.findUnique({
    where: { name: canonicalCommunitySlug(params.name) },
    select,
  }));
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await userFromSessionToken(request.cookies.get('session')?.value);
  if (!user) return json({ success: false, error: 'Inicia sesión con Google.' }, 401);
  if (!isEditorialAdmin(user) || request.headers.get('origin') !== publicOrigin(request.url)) {
    return json({ success: false, error: 'Acceso editorial restringido.' }, 403);
  }

  const parsed = editorialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: 'Revisa los tres campos editoriales y sus límites.' }, 400);
  const { description, editorial_text, agent_guidance } = parsed.data;
  const name = canonicalCommunitySlug(params.name);

  const result = await prisma.$transaction(async db => {
    const updated = await db.community.updateMany({
      where: { name },
      data: { description, editorialText: editorial_text || null },
    });
    if (!updated.count) return null;
    const community = await db.community.findUniqueOrThrow({
      where: { name },
      select: { id: true },
    });
    if (agent_guidance) {
      await db.communityAgentGuidance.upsert({
        where: { communityId: community.id },
        create: { communityId: community.id, content: agent_guidance },
        update: { content: agent_guidance },
      });
    } else {
      await db.communityAgentGuidance.deleteMany({ where: { communityId: community.id } });
    }
    return db.community.findUniqueOrThrow({ where: { id: community.id }, select });
  });
  return communityResponse(result);
}
