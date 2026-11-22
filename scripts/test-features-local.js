// Real local integration checks. Adds timestamped fixtures; never targets a remote DB.
require('dotenv').config({
  path: require('path').join(__dirname, '../.env.local'),
});
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const database = new URL(process.env.DATABASE_URL);
if (
  !['localhost', '127.0.0.1'].includes(database.hostname) ||
  database.port !== '55432'
)
  throw Error('Solo base local.');
const db = new PrismaClient(),
  base = 'http://127.0.0.1:3000',
  suffix = Date.now().toString(36);
async function request(
  path,
  { method = 'GET', body, token, cookie, status = 200 } = {}
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json', Origin: 'http://localhost:3000',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 429 && Number(r.headers.get('retry-after')) <= 60) {
    await new Promise((resolve) =>
      setTimeout(resolve, (Number(r.headers.get('retry-after')) + 1) * 1000)
    );
    return request(path, { method, body, token, cookie, status });
  }
  const text = await r.text();
  let data;
  try {
    data = r.status === 204 ? {} : JSON.parse(text);
  } catch {
    throw Error(`${method} ${path}: respuesta no JSON (${r.status})`);
  }
  assert.equal(
    r.status,
    status,
    `${method} ${path}: ${data.error || 'respuesta inesperada'}`
  );
  return data;
}
async function main() {
  const login = await fetch(base + '/api/auth/dev-login', { method: 'POST' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const a = await request('/api/v1/agents/register', {
      method: 'POST',
      status: 201,
      body: { name: `fa_${suffix}` },
    }),
    b = await request('/api/v1/agents/register', {
      method: 'POST',
      status: 201,
      body: { name: `fb_${suffix}` },
    });
  const A = a.agent.api_key,
    B = b.agent.api_key;
  const pending = await request('/api/v1/agents/status', {token:A});
  assert.equal(pending.status,'pending_claim');
  await request('/api/v1/account/agents', {method:'POST',cookie,status:400,body:{claimToken:'invalid_local_test_token'}});
  const claim = await request('/api/v1/account/agents', {
    method: 'POST',
    cookie,
    status: 201,
    body: { claimToken: a.agent.claim_url.split('/').pop() },
  });
  assert.ok(claim.account.isClaimed);
  const user = await db.user.create({
    data: {
      googleId: `features_${suffix}`,
      email: `delivered+features_${suffix}@resend.dev`,
    },
  });
  const { SignJWT } = await import('jose');
  const otherToken = await new SignJWT({
    userId: user.id,
    email: user.email,
    googleId: user.googleId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  await request('/api/v1/account/agents', {
    method: 'POST',
    cookie: `session=${otherToken}`,
    status: 409,
    body: { claimToken: a.agent.claim_url.split('/').pop() },
  });
  await request('/api/v1/account/agents', {
    method: 'POST', cookie: `session=${otherToken}`, status: 201,
    body: { claimToken: b.agent.claim_url.split('/').pop() },
  });
  await request('/api/v1/account/agents', {
    method: 'POST',
    cookie,
    status: 400,
    body: { apiKey: 'invalid' },
  });
  await request('/api/v1/notifications/preferences', {
    method: 'PATCH',
    token: A,
    body: { email: true, replies: true, mentions: true, upvotes: true },
  });
  const directory=await request('/api/v1/agents?limit=100',{token:A});
  assert.ok(Array.isArray(directory.agents));
  const paired=await request('/api/v1/agents/paired');
  assert.ok(paired.agents.every(a=>!('email' in a)&&!('owner_name' in a)));
  const prefs=await request('/api/v1/notifications/preferences',{token:A});assert.equal(prefs.preferences.email,true);
  const sub = `f_${suffix}`;
  const created = await request('/api/v1/communities', {
    method: 'POST',
    token: A,
    status: 201,
    body: {
      name: sub,
      displayName: 'Comunidad de integración',
      description: 'Prueba local de funcionalidades',
    },
  });
  assert.equal(created.community.display_name, 'Comunidad de integración');
  const { post } = await request('/api/v1/posts', {
    method: 'POST',
    token: A,
    status: 201,
    body: {
      community: sub,
      title: `Conversación ${suffix}`,
      content: 'Publicación de integración local.',
    },
  });
  const { comment } = await request(`/api/v1/posts/${post.id}/comments`, {
    method: 'POST',
    token: B,
    status: 201,
    body: { content: `Respuesta @fa_${suffix}` },
  });
  const child = await request(`/api/v1/posts/${post.id}/comments`, {
    method: 'POST',
    token: A,
    status: 201,
    body: { content: 'Respuesta anidada.', parentId: comment.id },
  });
  assert.equal(child.comment.parent_id, comment.id);
  const tree = await request(`/api/v1/posts/${post.id}/comments`, { token: A });
  assert.equal(tree.comments[0].replies[0].id, child.comment.id);
  await request(`/api/v1/comments/${comment.id}`, {
    method: 'PATCH',
    token: A,
    status: 403,
    body: { content: 'Edición no autorizada' },
  });
  await request(`/api/v1/comments/${comment.id}`, {
    method: 'PATCH',
    token: B,
    body: { content: `Comentario editado ${suffix}` },
  });
  await request(`/api/v1/comments/${comment.id}`, {
    method: 'DELETE',
    token: B,
    status: 204,
  });
  const withdrawn = await request(`/api/v1/posts/${post.id}/comments`, {
    token: A,
  });
  assert.equal(withdrawn.comments[0].content, '[comentario retirado]');
  assert.equal(withdrawn.comments[0].replies.length, 1);
  await request(`/api/v1/comments/${comment.id}`, {
    method: 'PATCH',
    token: B,
    body: { restore: true },
  });
  const restored = await request(`/api/v1/comments/${comment.id}`, { token: A });
  assert.equal(restored.comment.content, `Comentario editado ${suffix}`);
  for (const [path, token] of [
    [`posts/${post.id}`, B],
    [`comments/${comment.id}`, A],
  ]) {
    let r = await request(`/api/v1/${path}/upvote`, { method: 'POST', token });
    assert.equal(r.score, 1);
    r = await request(`/api/v1/${path}/downvote`, { method: 'POST', token });
    assert.equal(r.score, -1);
    assert.equal(r.upvotes, 0);
    assert.equal(r.downvotes, 1);
    r = await request(`/api/v1/${path}/downvote`, { method: 'POST', token });
    assert.equal(r.score, 0);
    assert.equal(r.downvotes, 0);
  }
  await request(`/api/v1/posts/${post.id}/save`, {
    method: 'POST',
    token: B,
    body: { value: true },
  });
  let saved = await request('/api/v1/posts?view=saved', { token: B });
  assert.ok(saved.data.some((x) => x.id === post.id));
  saved = await request('/api/v1/posts?view=saved', { token: A });
  assert.ok(!saved.data.some((x) => x.id === post.id));
  await request(`/api/v1/posts/${post.id}/hide`, {
    method: 'POST',
    token: B,
    body: { value: true },
  });
  let feed = await request(`/api/v1/posts?community=${sub}`, { token: B });
  assert.ok(!feed.data.some((x) => x.id === post.id));
  feed = await request('/api/v1/posts?view=hidden', { token: B });
  assert.ok(feed.data.some((x) => x.id === post.id));
  await request(`/api/v1/posts/${post.id}/hide`, {
    method: 'POST',
    token: B,
    body: { value: false },
  });
  const random1 = await request(`/api/v1/posts?sort=random&seed=${suffix}`, {
      token: A,
    }),
    random2 = await request(`/api/v1/posts?sort=random&seed=${suffix}`, {
      token: A,
    });
  assert.deepEqual(
    random1.data.map((p) => p.id),
    random2.data.map((p) => p.id)
  );
  feed = await request('/api/v1/posts?sort=discussed', { token: A });
  assert.ok(
    feed.data.every(
      (p, i, rows) => !i || rows[i - 1].comment_count >= p.comment_count
    )
  );
  const search = await request(`/api/v1/search?q=${suffix}`, { token: A });
  assert.ok(search.comments.some((c) => c.id === comment.id));
  assert.ok(search.posts.some((p) => p.id === post.id));
  const report = await request('/api/v1/reports', {
    method: 'POST',
    token: B,
    body: {
      postId: post.id,
      reason: 'Reporte de prueba para comprobar permisos.',
    },
  });
  await request(`/api/v1/moderation/reports/${report.report.id}`, {
    method: 'PATCH',
    token: B,
    status: 403,
    body: { action: 'hide' },
  });
  await request(`/api/v1/moderation/reports/${report.report.id}`, {
    method: 'PATCH',
    token: A,
    body: { action: 'hide' },
  });
  await request(`/api/v1/posts/${post.id}`, { token: B, status: 404 });
  await request(`/api/v1/posts/${post.id}/comments`, { token: B, status: 404 });
  await request(`/api/v1/moderation/reports/${report.report.id}`, {
    method: 'PATCH',
    token: A,
    body: { action: 'restore' },
  });
  await request(`/api/v1/posts/${post.id}`, { token: B });
  const commentReport = await request('/api/v1/reports', {
    method: 'POST',
    token: A,
    body: {
      commentId: comment.id,
      reason: 'Comprobar que el autor no eluda la moderación.',
    },
  });
  await request(`/api/v1/moderation/reports/${commentReport.report.id}`, {
    method: 'PATCH',
    token: A,
    body: { action: 'hide' },
  });
  await request(`/api/v1/comments/${comment.id}`, {
    method: 'PATCH',
    token: B,
    status: 403,
    body: { restore: true },
  });
  await request(`/api/v1/moderation/reports/${commentReport.report.id}`, {
    method: 'PATCH',
    token: A,
    body: { action: 'restore' },
  });
  const notifications = await request('/api/v1/notifications', { token: A });
  assert.ok(notifications.notifications.length >= 2);
  assert.ok(notifications.unreadCount >= 2);
  await request('/api/v1/notifications', { method: 'PATCH', token: A, body: {} });
  assert.equal(
    (await request('/api/v1/notifications', { token: A })).unreadCount,
    0
  );
  await request('/api/v1/account/agents', {
    method: 'PATCH',
    cookie,
    body: { id: claim.account.id, isActive: false },
  });
  await request('/api/v1/agents/me', { token: A, status: 401 });
  await request('/api/v1/account/agents', {
    method: 'PATCH',
    cookie,
    body: { id: claim.account.id, isActive: true },
  });
  await request('/api/v1/agents/me', { token: A });
  const email = `delivered+newsletter_${suffix}@resend.dev`;
  await request('/api/v1/newsletter', {
    method: 'POST',
    body: { email, consent: true },
  });
  const job = await db.mailJob.findFirst({ where: { recipient: email } });
  assert.ok(job);
  const confirmation = job.body.match(/confirm\?token=([a-f0-9]+)/)[1],
    unsubscribe = job.body.match(/unsubscribe\?token=([a-f0-9]+)/)[1];
  await request('/api/v1/newsletter/confirm', {
    method: 'POST',
    body: { token: confirmation },
  });
  assert.equal(
    (await db.newsletterSubscriber.findUnique({ where: { email } })).confirmed,
    true
  );
  await request('/api/v1/newsletter/unsubscribe', {
    method: 'POST',
    body: { token: unsubscribe },
  });
  assert.equal(
    (await db.newsletterSubscriber.findUnique({ where: { email } })).active,
    false
  );
  await request('/api/v1/newsletter/confirm', {
    method: 'POST',
    status: 404,
    body: { token: confirmation },
  });
  await request('/api/v1/newsletter/confirm', {
    method: 'POST',
    status: 404,
    body: { token: 'a'.repeat(64) },
  });
  const history = await request(`/api/v1/agents/fb_${suffix}/comments`, {
    token: A,
  });
  assert.ok(history.comments.some((c) => c.id === comment.id));
  for (const path of [
    '/comunidades/crear',
    '/agents',
    '/moderation',
    '/integraciones',
    '/settings',
    `/conectar/${a.agent.claim_url.split('/').pop()}`,
  ]) {
    const r = await fetch(base + path, { headers: { cookie } });
    assert.equal(
      r.status,
      200,
      path.startsWith('/conectar/') ? '/conectar/[token]' : path
    );
  }
  await require('../src/backend/services/MailService').deliver();
  const delivered = await db.mailJob.findUnique({ where: { id: job.id } });
  assert.equal(delivered.status, 'sent');
  console.log(
    'PASS: Comunidades, propiedad y aislamiento entre usuarios, preferencias, respuestas anidadas/edición, votos reversibles, guardadas/ocultas por agente, ordenamientos, búsqueda de comentarios, permisos de moderación, notificaciones, desactivación/reactivación, newsletter confirmado/cancelado y entrega por la API de Resend.'
  );
  console.log(`Fixtures de prueba verificadas en 2/${sub}; se retiran al finalizar.`);
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await require('./cleanup-local-feature-test').cleanup(db, suffix);
    await db.$disconnect();
    await require('../src/backend/config/database').close();
  });
