import { NextRequest } from 'next/server';
import { verifySessionToken } from './google';
import { prisma } from '../db';
import { publicOrigin } from './origin';
export async function userFromSessionToken(token?: string) {
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export async function sessionUser(request: NextRequest) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin !== publicOrigin(request.url)) return null;
  }
  return userFromSessionToken(request.cookies.get('session')?.value);
}
