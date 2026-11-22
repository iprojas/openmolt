// Local integration checks. No real Google credentials, keys, cookies or claim URLs are logged.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const target = new URL(process.env.DATABASE_URL);
const developmentDatabase = target.port === '55432' && ['/chile2', '/chile2_harness_v1'].includes(target.pathname);
const disposableEditorialDatabase = target.pathname === '/chile2_editorial_test';
if (!['localhost', '127.0.0.1'].includes(target.hostname) || (!developmentDatabase && !disposableEditorialDatabase)) {
  throw Error('Solo base local.');
}
const db = new PrismaClient();
const base = new URL(process.env.CL2_BASE_URL || 'http://localhost:3000').origin;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Solo servidor local.');
const suffix = randomUUID().slice(0, 8);
let human, other, admin, cookie, otherCookie, adminCookie;
const accounts = '/api/v1/account/agents';
const activity = accounts + '?view=activity';
const community = 'cl2';
const agentNames = [];
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
async function register(prefix, personality) {
  const name = `${prefix}_${suffix}`;
  agentNames.push(name);
  const { agent } = await request('/api/v1/agents/register', {
    method: 'POST', status: 201, session: null,
    body: { name, description: 'Agente de prueba', personality },
  });
  return { token: agent.api_key, claimPath: new URL(agent.claim_url).pathname, name };
}

const claimToken = agent => agent.claimPath.split('/').pop();

async function main() {
  await request('/', { session: null, status: 307 });
  const guest = await fetch(base + '/?sort=new', { redirect: 'manual' });
  assert.equal(guest.status, 307);
  const welcome = new URL(guest.headers.get('location'), base);
  assert.equal(welcome.pathname, '/welcome');
  assert.equal(welcome.searchParams.get('callbackUrl'), '/?sort=new');
  await request('/2/cl2', { session: null });
  await request(activity, { session: null, status: 401 });
  await request('/api/v1/posts', { session: null });
  await request('/api/v2/health', { session: null, status: 404 });
  assert.equal((await request('/api/v1/communities/plaza', { session: null })).community.name, community);
  human = await db.user.create({ data: { googleId: `verify_${suffix}`, email: `verify_${suffix}@example.invalid`, name: 'Humano de prueba' } });
  other = await db.user.create({ data: { googleId: `other_${suffix}`, email: `other_${suffix}@example.invalid`, name: 'Otro humano' } });
  const configuredAdmin = process.env.CL2_TEST_ADMIN_GOOGLE_ID;
  if (!configuredAdmin?.startsWith('test_admin_')) throw Error('Configura CL2_TEST_ADMIN_GOOGLE_ID y habilita ese sujeto de prueba en CL2_MULTI_AGENT_GOOGLE_IDS.');
  admin = await db.user.create({ data: { googleId: configuredAdmin, email: `admin_${suffix}@example.invalid`, name: 'Admin de prueba' } });
  cookie = await newSession(human); otherCookie = await newSession(other); adminCookie = await newSession(admin);
  const initial = await request('/api/auth/session');
  assert.equal(initial.participant.kind, 'human');
  assert.equal(initial.accounts.length, 0);
  const humanId = initial.participant.id;
  const signedInHome = await fetch(base, { headers: { Cookie: cookie } });
  assert.equal(signedInHome.status, 200);
  const homeMarkup = await signedInHome.text();
  assert(homeMarkup.includes('id="agent-connection-title"'));
  assert(!homeMarkup.includes('id="agent-activity-title"'));
  assert.deepEqual((await request(activity)).agents, []);

  const hp = (await request('/api/v1/posts', { method: 'POST', status: 201, body: { community, title: 'Una pregunta humana', content: 'Participación sin agente.' } })).post;
  assert.equal(hp.author_kind, 'human');
  await request(`/post/${hp.id}`, { session: null });
  const hc = (await request(`/api/v1/posts/${hp.id}/comments`, { method: 'POST', status: 201, body: { content: 'Comentario humano.' } })).comment;
  assert.equal(hc.author_kind, 'human');

  const personality = { tone: 'PRIVADO curioso y directo', interests: 'Cultura', rules: 'Lee el contexto' };
  const primary = await register('agent', personality);
  const { token, claimPath, name } = primary;
  assert(token.startsWith('cl2_'));
  await request(claimPath, { session: null });
  const startOAuth = await fetch(base + '/api/auth/google?' + new URLSearchParams({ callbackUrl: claimPath }), { redirect: 'manual' });
  assert.equal(startOAuth.status, 307);
  assert.equal(new URL(startOAuth.headers.get('location')).hostname, 'accounts.google.com');
  assert(startOAuth.headers.getSetCookie().some(value => value.startsWith('oauth_callback=') && decodeURIComponent(value).includes(claimPath)));
  const ask = async (path, options = {}) => request(path, { token, session: null, ...options });
  assert.equal((await ask('/api/v1/agents/status')).is_claimed, false);
  assert.deepEqual((await ask('/api/v1/agents/me/personality')).personality, personality);
  await ask('/api/v1/agents/me/introduction', { method: 'POST', status: 403, body: { title: 'Pendiente', content: 'No permitido.' } });
  const claim = { claimToken: claimToken(primary) };
  await request(accounts, { method: 'POST', session: null, status: 401, body: claim });
  await request(accounts, { method: 'POST', status: 401, origin: 'https://otra-instancia.invalid', body: claim });
  const preview = await request(accounts + '?' + new URLSearchParams(claim));
  assert.equal(preview.agent.name, name);
  assert.equal(preview.account, human.email);
  assert.equal((await ask('/api/v1/agents/status')).is_claimed, false);

  const competing = await register('competitor');
  const candidates = [primary, competing];
  const attempts = await Promise.all(candidates.map(agent => fetch(base + accounts, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: otherCookie, Origin: base },
    body: JSON.stringify({ claimToken: claimToken(agent) }),
  })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  const winnerIndex = attempts.findIndex(result => result.status === 201);
  const claimedByOther = candidates[winnerIndex];
  const chosen = winnerIndex === 0 ? await register('owner', personality) : primary;
  const linked = (await request(accounts, { method: 'POST', status: 201, body: { claimToken: claimToken(chosen) } })).account;
  const own = async (path, options = {}) => request(path, { token: chosen.token, session: null, ...options });
  await request(accounts, { method: 'POST', status: 409, body: { claimToken: claimToken(claimedByOther) } });
  await request(accounts, { method: 'PATCH', session: otherCookie, status: 404, body: { id: linked.id, action: 'recover' } });
  assert.equal((await request('/api/auth/session')).participant.id, humanId);
  const linkedHome = await fetch(base, { headers: { Cookie: cookie } });
  assert.equal(linkedHome.status, 200);
  const linkedMarkup = await linkedHome.text();
  assert(!linkedMarkup.includes('id="agent-connection-title"'));
  assert(linkedMarkup.includes('id="agent-activity-title"'));
  const { agents: linkedActivity } = await request(activity);
  assert.equal(linkedActivity.length, 1);
  assert.equal(linkedActivity[0].id, linked.id);
  assert.deepEqual([linkedActivity[0].postCount, linkedActivity[0].commentCount, linkedActivity[0].latest], [0, 0, null]);

  const updated = { ...personality, tone: 'PRIVADO tono actualizado por el humano' };
  await request(accounts, { method: 'PATCH', body: { id: linked.id, personality: updated, revision: 0 } });
  assert.equal((await own('/api/v1/agents/me/personality')).revision, 1);
  await own('/api/v1/agents/me/personality', { method: 'PATCH', status: 409, body: { personality, revision: 0 } });
  await own('/api/v1/agents/me/personality', { method: 'PATCH', body: { personality, revision: 1 } });
  const list = await request(accounts);
  assert.equal(list.accounts[0].personalityRevision, 2);
  assert.deepEqual(list.accounts[0].personality, personality);
  const profile = await request('/api/v1/agents/profile?name=' + chosen.name, { session: null });
  const publicPayloads = [profile, await request('/api/v1/agents', { session: null }), await request('/api/v1/search?q=' + chosen.name, { session: null })];
  for (const response of [...publicPayloads, list]) assert(!JSON.stringify(response).includes(chosen.token));
  for (const response of publicPayloads) assert(!JSON.stringify(response).includes('PRIVADO'));

  const intro = '/api/v1/agents/me/introduction';
  const introBody = { title: 'Una presentación del agente', content: 'Voz propia.' };
  const ap = (await own(intro, { method: 'POST', status: 201, body: introBody })).post;
  assert.equal(ap.community, community);
  assert.deepEqual((await own(intro, { method: 'POST', body: introBody })).post, ap);
  assert.equal(await db.post.count({ where: { authorId: linked.id, title: introBody.title } }), 1);
  const ac = (await own(`/api/v1/posts/${hp.id}/comments`, { method: 'POST', status: 201, body: { content: 'Respuesta del agente.' } })).comment;
  assert.equal(ac.author_kind, 'agent');
  assert.notEqual(ac.author_id, humanId);
  const { agents: activeAgents } = await request(activity);
  assert.equal(activeAgents.length, 1);
  const summary = activeAgents[0];
  assert.deepEqual([summary.postCount, summary.commentCount], [1, 1]);
  assert.equal(summary.latest.kind, 'comment');
  assert.equal(summary.latest.postId, hp.id);
  assert.equal(summary.latest.title, hp.title);
  assert(Number.isFinite(Date.parse(summary.latest.createdAt)));
  assert(!('personality' in summary));
  assert(!('apiKey' in summary));
  const otherActivity = await request(activity, { session: otherCookie });
  assert(otherActivity.agents.every(agent => agent.id !== linked.id));

  await db.post.update({ where: { id: hp.id }, data: { isDeleted: true } });
  const afterRemoval = (await request(activity)).agents[0];
  assert.deepEqual([afterRemoval.postCount, afterRemoval.commentCount, afterRemoval.latest.postId], [1, 0, ap.id]);
  await db.post.update({ where: { id: hp.id }, data: { isDeleted: false } });
  await request(`/api/v1/posts/${ap.id}/upvote`, { method: 'POST' });
  await own(`/api/v1/posts/${hp.id}/upvote`, { method: 'POST' });
  assert(await db.vote.findFirst({ where: { agentId: humanId, postId: ap.id } }));
  assert(await db.vote.findFirst({ where: { agentId: linked.id, postId: hp.id } }));
  assert((await request(`/api/v1/posts/${hp.id}/comments`, { session: null })).comments.length > 0);
  await request(`/api/v1/posts/${ap.id}/comments`, { method: 'POST', status: 403, origin: 'https://otra-instancia.invalid', body: { content: 'No permitido.' } });
  await request('/api/auth/session', { method: 'DELETE' });
  await request('/api/auth/session', { session: null, status: 401 });
  await own('/api/v1/agents/me');

  await request(accounts, { method: 'PATCH', body: { id: linked.id, isActive: false } });
  const extra = await register('extra');
  await request(accounts, { method: 'POST', status: 409, body: { claimToken: claimToken(extra) } });
  await own('/api/v1/agents/me', { status: 401 });
  await request(accounts, { method: 'PATCH', body: { id: linked.id, isActive: true } });
  const makeRecovery = async () => {
    const { recoveryUrl } = await request(accounts, { method: 'PATCH', body: { id: linked.id, action: 'recover' } });
    return new URL(recoveryUrl).hash.slice(1);
  };
  const redeem = (token, status) => request('/api/v1/agents/recover', { method: 'POST', session: null, status, body: { token } });
  const expired = await makeRecovery();
  await db.agent.update({ where: { id: linked.id }, data: { recoveryExpiresAt: new Date(0) } });
  await redeem(expired, 404);
  const superseded = await makeRecovery();
  const current = await makeRecovery();
  await redeem(superseded, 404);
  await own('/api/v1/agents/me');
  const recovered = (await redeem(current, 200)).agent;
  await redeem(current, 404);
  assert.equal(recovered.id, linked.id);
  assert.notEqual(recovered.api_key, chosen.token);
  await own('/api/v1/agents/me', { status: 401 });
  assert.equal((await request('/api/v1/agents/me', { token: recovered.api_key, session: null })).agent.id, linked.id);

  assert.equal((await request(accounts, { session: adminCookie })).canLinkMultiple, true);
  const extraAdmin = await register('multi');
  for (const agent of [extra, extraAdmin]) {
    await request(accounts, { method: 'POST', session: adminCookie, status: 201, body: { claimToken: claimToken(agent) } });
  }
  assert.equal((await request(accounts, { session: adminCookie })).accounts.length, 2);
  await request('/api/v1/posts', { session: 'session=invalid' });
  console.log(`PASS: ${checks} HTTP checks covering public reading, identities, OAuth initiation, concurrent claims, profiles, introduction, recovery and agent activity.`);
}

async function cleanup() {
  const users = [human, other, admin].filter(Boolean).map(user => user.id);
  const actors = { OR: [{ name: { in: agentNames } }, { humanUserId: { in: users } }] };
  if (!users.length && !agentNames.length) return;
  const ids = (await db.agent.findMany({ where: actors, select: { id: true } })).map(agent => agent.id);
  const posts = await db.post.count({ where: { community, authorId: { in: ids } } });
  await db.$transaction([
    db.agentNotification.deleteMany({ where: { agentId: { in: ids } } }),
    db.notificationPreference.deleteMany({ where: { agentId: { in: ids } } }),
    db.agent.deleteMany({ where: actors }),
    db.user.deleteMany({ where: { id: { in: users } } }),
    db.community.update({ where: { name: community }, data: { postCount: { decrement: posts } } }),
  ]);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  try { await cleanup(); }
  catch { console.error('No se pudieron retirar los datos de esta prueba.'); process.exitCode = 1; }
  finally { await db.$disconnect(); }
});
