/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/google/route';
import { exchangeCodeForToken, verifySessionToken } from '@/lib/auth/google';
import { prisma } from '@/lib/db';
import { sessionUser } from '@/lib/auth/session';

jest.mock('@/lib/db', () => ({ prisma: { agent: { upsert: jest.fn().mockResolvedValue({ id: 'human-participant', kind: 'human' }) }, user: { upsert: jest.fn(), findUnique: jest.fn() } } }));
jest.mock('@/lib/auth/google', () => ({
  getGoogleAuthUrl: jest.fn(),
  exchangeCodeForToken: jest.fn(),
  getGoogleUserInfo: jest.fn().mockResolvedValue({ googleId: 'google-test', email: 'test@example.com' }),
  createSessionToken: jest.fn().mockResolvedValue('test-session'),
  verifySessionToken: jest.fn(),
}));

describe('OAuth behind Railway reverse proxy', () => {
  const originalOrigin = process.env.CL2_BASE_URL;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CL2_BASE_URL = 'https://chile2.cl';
    jest.mocked(exchangeCodeForToken).mockResolvedValue('test-token');
    jest.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user-test', googleId: 'google-test', email: 'test@example.com' } as never);
  });
  afterAll(() => {
    if (originalOrigin === undefined) delete process.env.CL2_BASE_URL;
    else process.env.CL2_BASE_URL = originalOrigin;
  });
  const callback = (path = '/agentes') => new NextRequest(
    'http://0.0.0.0:3000/api/auth/callback/google?code=test-code&state=test-state',
    { headers: { cookie: `oauth_state=test-state; oauth_callback=${encodeURIComponent(path)}`, 'x-forwarded-host': 'attacker.example' } }
  );

  it('saves the user, sets the session and returns to the public site after Google sign-in', async () => {
    const response = await GET(callback('/conectar/example?from=oauth'));
    expect(prisma.user.upsert).toHaveBeenCalled();
    expect(prisma.agent.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { humanUserId: 'user-test' }, create: expect.objectContaining({ kind: 'human', humanUserId: 'user-test' }) }));
    expect(response.headers.get('location')).toBe('https://chile2.cl/conectar/example?from=oauth');
    expect(response.cookies.get('session')?.value).toBe('test-session');
    expect(response.cookies.get('oauth_state')?.value).toBe('');
  });

  it('returns to the public welcome page when Google rejects the code', async () => {
    jest.mocked(exchangeCodeForToken).mockRejectedValueOnce(new Error('invalid code'));
    const response = await GET(callback());
    expect(response.headers.get('location')).toBe('https://chile2.cl/welcome?error=auth_failed');
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('does not allow a callback path to escape the public origin after URL normalization', async () => {
    const response = await GET(callback('/\n/attacker.example'));
    expect(response.headers.get('location')).toBe('https://chile2.cl/');
  });

  it('still rejects a callback with no matching state cookie', async () => {
    const response = await GET(new NextRequest('http://0.0.0.0:3000/api/auth/callback/google?code=test&state=wrong'));
    expect(response.status).toBe(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('accepts account writes from the public origin and rejects cross-origin writes', async () => {
    jest.mocked(verifySessionToken).mockResolvedValue({ userId: 'user-test', googleId: 'google-test', email: 'test@example.com' });
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-test' } as never);
    const accountRequest = (origin: string) => new NextRequest('http://0.0.0.0:3000/api/user/accounts', {
      method: 'POST', headers: { origin, cookie: 'session=test-session' },
    });
    expect(await sessionUser(accountRequest('https://chile2.cl'))).toEqual({ id: 'user-test' });
    expect(await sessionUser(accountRequest('https://attacker.example'))).toBeNull();
  });
});

describe('Google sign-in destination', () => {
  it('returns to home when no callback cookie is present', async () => {
    process.env.CL2_BASE_URL = 'https://chile2.cl';
    jest.mocked(exchangeCodeForToken).mockResolvedValue('test-token');
    jest.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user-test' } as never);
    const response = await GET(new NextRequest('http://0.0.0.0:3000/api/auth/callback/google?code=test&state=valid', {
      headers: { cookie: 'oauth_state=valid' },
    }));
    expect(response.headers.get('location')).toBe('https://chile2.cl/');
    delete process.env.CL2_BASE_URL;
  });
});
