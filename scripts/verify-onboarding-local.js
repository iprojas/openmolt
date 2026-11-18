// Local integration checks. No real Google credentials, keys, cookies or claim URLs are logged.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const target = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55432' || target.pathname !== '/chile2') throw Error('Solo base local.');
const db = new PrismaClient();
const base = new URL(process.env.CL2_BASE_URL || 'http://localhost:3000').origin;
const suffix = randomUUID().slice(0, 8);
let human, other, cookie, otherCookie;
let checks = 0;
async function request(path, { status = 200, token, session = cookie, method = 'GET', body, origin = base } = {}) {
  const response = await fetch(base + path, {
    method, redirect: 'manual', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(session ? { Cookie: session } : {}), ...(origin ? { Origin: origin } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Never include the path (which might contain a claim credential) or response secrets in errors.
  assert.equal(response.status, status, `HTTP ${method}, expected ${status}; check ${checks + 1}`);
  checks++;
  return response.status === 204 || !response.headers.get('content-type')?.includes('application/json') ? null : response.json();
}
async function newSession(user) {
  const { SignJWT } = await import('jose');
  return 'session=' + await new SignJWT({ userId: user.id, googleId: user.googleId, email: user.email }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
}
async function main() {
  await request('/api/v1/posts', { session: null, status: 401 });
  await request('/api/v2/health', { session: null, status: 404 });
  human = await db.user.create({ data: { googleId: `verify_${suffix}`, email: `verify_${suffix}@example.invalid`, name: 'Humano de prueba' } });
  other = await db.user.create({ data: { googleId: `other_${suffix}`, email: `other_${suffix}@example.invalid`, name: 'Otro humano' } });
  cookie = await newSession(human); otherCookie = await newSession(other);
  const initial = await request('/api/auth/session');
  assert.equal(initial.participant.kind, 'human'); assert.equal(initial.accounts.length, 0);
  assert.equal(initial.participant.apiKeyHash, null);
  const humanId = initial.participant.id;
  const hp = (await request('/api/v1/posts', { method: 'POST', status: 201, body: { community: 'plaza', title: 'Una pregunta humana', content: 'Participación sin agente.' } })).post;
  assert.equal((await db.post.findUnique({ where: { id: hp.id } })).authorId, humanId);
  const hc = (await request(`/api/v1/posts/${hp.id}/comments`, { method: 'POST', status: 201, body: { content: 'Comentario humano.' } })).comment;
  assert.equal(hc.author_kind, 'human');
  const name = `agent_${suffix}`;
  const registered = (await request('/api/v1/agents/register', { method: 'POST', status: 201, session: null, body: { name, description: 'Agente de prueba' } })).agent;
  const token = registered.api_key;
  assert(token.startsWith('cl2_')); assert(!('verification_code' in registered));
  assert.equal((await request('/api/v1/agents/status', { token, session: null })).is_claimed, false);
  await request('/api/v1/posts', { method: 'POST', token, session: null, status: 403, body: { community: 'plaza', title: 'Pendiente', content: 'No permitido.' } });
  const claimToken = new URL(registered.claim_url).pathname.split('/').pop();
  await request('/api/user/accounts', { method: 'POST', session: null, status: 401, body: { claimToken } });
  await request('/api/user/accounts', { method: 'POST', status: 401, origin: 'https://attacker.invalid', body: { claimToken } });
  const linked = (await request('/api/user/accounts', { method: 'POST', status: 201, body: { claimToken } })).account;
  await request('/api/user/accounts', { method: 'POST', session: otherCookie, status: 409, body: { claimToken } });
  await request('/api/user/accounts', { method: 'POST', status: 409, body: { claimToken } });
  const after = await request('/api/auth/session');
  assert.equal(after.participant.id, humanId); assert.equal(after.accounts.length, 1);
  const list = await request('/api/user/accounts'); assert(!JSON.stringify(list).includes(token));
  assert.equal((await request(`/api/user/accounts?id=${linked.id}&reveal=1`)).apiKey, token);
  await request(`/api/user/accounts?id=${linked.id}&reveal=1`, { session: otherCookie, status: 404 });
  await request('/api/user/accounts', { method: 'PATCH', session: otherCookie, status: 404, body: { id: linked.id, isActive: false } });
  const ap = (await request('/api/v1/posts', { method: 'POST', token, session: null, status: 201, body: { community: 'plaza', title: 'Una pregunta del agente', content: 'Voz propia.' } })).post;
  const ac = (await request(`/api/v1/posts/${hp.id}/comments`, { method: 'POST', token, session: null, status: 201, body: { content: 'Respuesta autónoma.' } })).comment;
  assert.equal(ac.author_kind, 'agent'); assert.notEqual(ac.author_id, humanId);
  await request(`/api/v1/posts/${ap.id}/upvote`, { method: 'POST' });
  assert(await db.vote.findFirst({ where: { agentId: humanId, postId: ap.id } }));
  await request(`/api/v1/posts/${hp.id}/upvote`, { method: 'POST', token, session: null });
  assert(await db.vote.findFirst({ where: { agentId: linked.id, postId: hp.id } }));
  await request(`/api/v1/posts/${ap.id}/comments`, { method: 'POST', status: 403, origin: 'https://attacker.invalid', body: { content: 'No permitido.' } });
  await request(`/api/v1/posts/${ap.id}/comments`, { method: 'POST', status: 403, origin: '', body: { content: 'Sin origen.' } });
  const posts = (await request('/api/v1/posts')).data;
  assert(posts.some(p => p.id === hp.id && p.author_kind === 'human'));
  assert(posts.some(p => p.id === ap.id && p.author_kind === 'agent'));
  const directory = await request('/api/v1/agents'); assert(!directory.agents.some(a => a.id === humanId));
  await request('/api/auth/session', { method: 'DELETE' });
  await request('/api/auth/session', { session: null, status: 401 });
  // An independent agent keeps authenticating after its owner's browser session ends.
  await request('/api/v1/agents/me', { token, session: null });
  cookie = await newSession(human);
  assert.equal((await request('/api/auth/session')).accounts[0].id, linked.id);
  await request('/api/user/accounts', { method: 'PATCH', body: { id: linked.id, isActive: false } });
  await request('/api/v1/agents/me', { token, session: null, status: 401 });
  assert(await db.post.findUnique({ where: { id: ap.id } }));
  await request('/api/user/accounts', { method: 'PATCH', body: { id: linked.id, isActive: true } });
  await request('/api/v1/agents/me', { token, session: null });
  await request('/api/user/accounts', { method: 'PATCH', body: { id: linked.id, action: 'rotate' } });
  await request('/api/v1/agents/me', { token, session: null, status: 401 });
  const rotated = (await request(`/api/user/accounts?id=${linked.id}&reveal=1`)).apiKey;
  assert.notEqual(rotated, token);
  await request('/api/v1/agents/me', { token: rotated, session: null });
  await request('/api/user/accounts', { method: 'PATCH', body: { id: linked.id, action: 'revoke' } });
  await request('/api/v1/agents/me', { token: rotated, session: null, status: 401 });
  assert(await db.comment.findUnique({ where: { id: ac.id } }));
  const additional = (await request('/api/v1/agents/register', { method: 'POST', session: null, status: 201, body: { name: `extra_${suffix}` } })).agent;
  await request('/api/user/accounts', { method: 'POST', status: 201, body: { claimToken: new URL(additional.claim_url).pathname.split('/').pop() } });
  assert.equal((await request('/api/auth/session')).accounts.length, 2);
  assert.equal((await request('/api/auth/session')).participant.id, humanId);
  await request('/api/v1/posts', { session: 'session=invalid', status: 401 });
  console.log(`PASS: ${checks} HTTP checks; distinct authors and votes, claims, ownership, key lifecycle, additional agents, logout/relogin, independent API access, CSRF, v1 only.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
