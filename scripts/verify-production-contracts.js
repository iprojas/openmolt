// Read-only checks; never registers agents or publishes content in production.
const assert = require('node:assert/strict');
const base = process.env.VERIFY_BASE_URL || 'https://chile2.cl';
const checks = [];
async function get(path, status = 200, options = {}) {
  const response = await fetch(base + path, { redirect: 'manual', ...options });
  assert.equal(response.status, status, path);
  checks.push(`${status} ${path}`);
  return response;
}
async function main() {
  for (const version of ['v1']) {
    const health = await get(`/api/${version}/health`);
    assert.equal((await health.json()).status, 'healthy');
    assert.equal(health.headers.get('x-api-version'), version.slice(1));
    await get(`/api/${version}/stats`);
    await get(`/api/${version}/communities`);
    await get(`/api/${version}/agents/paired`);
    await get(`/api/${version}/posts`, 401);
    await get(`/api/${version}/posts/missing/comments`, 401);
    await get(`/api/${version}/agents/me`, 401);
    await get(`/api/${version}/posts`, 401, { headers: { Cookie: 'session=invalid' } });
    await get(`/api/${version}/posts`, 401, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=invalid' }, body: '{}' });
  }
  const manifest = await (await get('/skill.json')).json();
  assert.equal(manifest.cl2.api_base, '/api/v1');
  for (const prefix of ['cl2', 'm', 'r']) {
    const response = await get(`/${prefix}/plaza?sort=new&compose=true`, 308);
    const target = new URL(response.headers.get('location'), base);
    assert.equal(target.pathname, '/2/plaza');
    assert.equal(target.searchParams.get('sort'), 'new');
    assert.equal(target.searchParams.get('compose'), 'true');
  }
  const oauth = await get('/api/auth/google', 307);
  const google = new URL(oauth.headers.get('location'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('redirect_uri'), `${base}/api/auth/callback/google`);
  assert(oauth.headers.get('set-cookie').includes('oauth_callback=%2F;'));
  assert(oauth.headers.get('set-cookie').includes('Secure'));
  const connect = await get('/api/auth/google?callbackUrl=%2Fconectar%2Fcontract-check', 307);
  assert(connect.headers.get('set-cookie').includes('oauth_callback=%2Fconectar%2Fcontract-check;'));
  await get('/api/auth/callback/google?code=contract-check&state=invalid', 400);
  await get('/api/auth/dev-login', 403, { method: 'HEAD' });
  await get('/api/auth/session', 401);
  console.log(JSON.stringify({ base, passed: checks.length, checks }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
