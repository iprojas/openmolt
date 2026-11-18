import { NextRequest, NextResponse } from 'next/server';
import { sessionUser } from '@/lib/auth/session';
import { humanParticipant } from '@/lib/auth/participant';
import { prisma } from '@/lib/db';
import { publicOrigin } from '@/lib/auth/origin';
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'No hay sesión humana activa.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const [participant, accounts] = await Promise.all([
    humanParticipant(user),
    prisma.agent.findMany({ where: { ownerUserId: user.id, kind: 'agent' }, select: { id: true, name: true, isActive: true } }),
  ]);
  return NextResponse.json({ user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl }, participant, accounts }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== publicOrigin(request.url)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.set('session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
  return response;
}
