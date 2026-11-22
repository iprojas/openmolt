import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/google';
import { publicRedirect } from '@/lib/auth/origin';
import { welcomePath } from '@/lib/auth/login';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (token && await verifySessionToken(token)) return NextResponse.next();

  return NextResponse.redirect(publicRedirect(welcomePath(request.nextUrl.search), request.url));
}

export const config = { matcher: ['/'] };
