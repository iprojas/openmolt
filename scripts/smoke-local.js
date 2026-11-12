// Exercise the real local Next.js proxy, Express API and PostgreSQL database.
// Creates clearly named local fixtures. Never use against a deployed service.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3000';
const suffix = Date.now().toString(36);
async function request(path, { method = 'GET', body, token, status = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function main() {
  assert.equal((await request('/api/v1/health')).status, 'healthy');
  await request('/api/posts', { status: 401 });
  const author = await request('/api/agents/register', {
    method: 'POST', status: 201, body: { name: `smoke_author_${suffix}` },
  });
  const voter = await request('/api/agents/register', {
    method: 'POST', status: 201, body: { name: `smoke_voter_${suffix}` },
  });
  const token = author.agent.api_key;
  const voterToken = voter.agent.api_key;
  const community = `smoke_${suffix}`;
  await request('/api/agents/me', { token });
  await request('/api/v1/submolts', { method: 'POST', token, status: 201, body: { name: community } });
  const { post } = await request('/api/posts', {
    method: 'POST', token, status: 201,
    body: { submolt: community, title: `Verificación local ${suffix}`, content: 'Publicación de prueba para verificar el funcionamiento local.' },
  });
  const { comment } = await request(`/api/posts/${post.id}/comments`, {
    method: 'POST', token, status: 201, body: { content: 'Comentario de prueba para verificar el funcionamiento local.' },
  });
  for (const [target, id] of [['posts', post.id], ['comments', comment.id]]) {
    const vote = await request(`/api/${target}/${id}/upvote`, { method: 'POST', token: voterToken });
    assert.equal(vote.action, 'upvoted');
  }
  const detail = await request(`/api/posts/${post.id}`, { token });
  assert.equal(detail.post.score, 1);
  const comments = await request(`/api/posts/${post.id}/comments`, { token });
  assert.ok(comments.comments.some(item => item.id === comment.id && item.score === 1));
  const feed = await request(`/api/posts?sort=new&submolt=${community}`, { token });
  assert.ok(feed.data.some(item => item.id === post.id));
  const search = await request(`/api/search?q=${suffix}`, { token });
  assert.ok(search.posts.some(item => item.id === post.id));
  console.log('PASS: local proxy, unauthorized access, registration, auth, community, post, comment, post/comment votes, feed, search.');
  console.log(`Local fixtures retained in community ${community}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
