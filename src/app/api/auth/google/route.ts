import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getGoogleAuthUrl,
  exchangeCodeForToken,
  getGoogleUserInfo,
  createSessionToken,
} from '@/lib/auth/google';
function localPath(value: string | null | undefined) {
  return value?.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : '/agentes';
}
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    const nonce = crypto.randomUUID();
    const response = NextResponse.redirect(getGoogleAuthUrl(nonce));
    response.cookies.set('oauth_state', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/api/auth',
    });
    response.cookies.set(
      'oauth_callback',
      localPath(request.nextUrl.searchParams.get('callbackUrl')),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/api/auth',
      }
    );
    return response;
  }
  const state = request.nextUrl.searchParams.get('state');
  if (!state || state !== request.cookies.get('oauth_state')?.value)
    return NextResponse.json(
      { error: 'La verificación de acceso venció. Inicia sesión nuevamente.' },
      { status: 400 }
    );
  try {
    const googleUser = await getGoogleUserInfo(
      await exchangeCodeForToken(code)
    );
    const user = await prisma.user.upsert({
      where: { googleId: googleUser.googleId },
      update: googleUser,
      create: googleUser,
    });
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      googleId: user.googleId,
    });
    const response = NextResponse.redirect(
      new URL(
        localPath(request.cookies.get('oauth_callback')?.value),
        request.url
      )
    );
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    response.cookies.set('oauth_state', '', {
      maxAge: 0,
      path: '/api/auth',
    });
    response.cookies.set('oauth_callback', '', {
      maxAge: 0,
      path: '/api/auth',
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL('/welcome?error=auth_failed', request.url)
    );
  }
}
