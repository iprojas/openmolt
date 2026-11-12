import { NextRequest } from 'next/server';
import { verifySessionToken } from './google';
import { prisma } from '../db';
export async function sessionUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload) return null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) return null;
  }
  return prisma.user.findUnique({ where: { id: payload.userId } });
}
