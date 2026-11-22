// Read-only checks; never registers agents or publishes content in production.
const assert = require('node:assert/strict');
const base = process.env.VERIFY_BASE_URL || 'https://chile2.cl';
const { COMMUNITY_ALIASES, WELCOME_COMMUNITY } = require('../src/lib/community-slugs');
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
    const feed = await (await get(`/api/${version}/posts`)).json();
    if (process.env.VERIFY_EMPTY_FEED === '1') assert.equal(feed.data.length, 0);
    const communities = await (await get(`/api/${version}/communities?limit=100`)).json();
    assert.equal(communities.data.find(community => community.name === WELCOME_COMMUNITY)?.display_name, 'CHILE2');
    assert(!communities.data.some(community => Object.hasOwn(COMMUNITY_ALIASES, community.name)));
    for (const [alias, canonical] of Object.entries(COMMUNITY_ALIASES)) {
      const { community } = await (await get(`/api/v1/communities/${alias}`)).json();
      assert.equal(community.name, canonical);
      assert(!Object.hasOwn(community, 'agent_guidance'));
      await get(`/api/v1/communities/${alias}/feed`);
    }
    await get('/api/v1/communities/contract_check_missing/feed', 404);
    await get('/api/v1/admin/communities/cl2', 401);
    await get(`/api/${version}/posts/00000000-0000-0000-0000-000000000000/comments`, 404);
    await get(`/api/${version}/agents/me`, 401);
    await get(`/api/${version}/posts`, 200, { headers: { Cookie: 'session=invalid' } });
    await get(`/api/${version}/posts`, 401, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=invalid', Origin: base }, body: '{}' });
  }
  const home = await get('/', 307);
  assert.equal(new URL(home.headers.get('location'), base).pathname, '/welcome');
  for (const path of ['/welcome', '/2/cl2', '/agentes', '/conectar/contract-check']) {
    assert((await (await get(path)).text()).includes('aria-label="Menú de la cuenta"'));
  }
  await get('/api/v2/health', 404);
  const manifest = await (await get('/skill.json')).json();
  assert.equal(manifest.cl2.api_base, '/api/v1');
  const skill = await (await get('/skill.md')).text();
  assert(skill.includes('version: ' + manifest.version));
  assert(skill.includes('/agents/me/introduction'));
  for (const path of Object.values(manifest.cl2.files)) await get(path);
  assert.equal(new URL((await get('/2/plaza', 308)).headers.get('location'), base).pathname, '/2/cl2');
  for (const prefix of ['cl2', 'm', 'r']) {
    const response = await get(`/${prefix}/plaza?sort=new&compose=true`, 308);
    const target = new URL(response.headers.get('location'), base);
    assert.equal(target.pathname, '/2/cl2');
    assert.equal(target.searchParams.get('sort'), 'new');
    assert.equal(target.searchParams.get('compose'), 'true');
  }
  const oauth = await get('/api/auth/google', 307);
  const google = new URL(oauth.headers.get('location'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('redirect_uri'), `${base}/api/auth/callback/google`);
  assert(oauth.headers.get('set-cookie').includes('oauth_callback=%2F;'));
  if (base.startsWith('https:')) assert(oauth.headers.get('set-cookie').includes('Secure'));
  const connect = await get('/api/auth/google?callbackUrl=%2Fconectar%2Fcontract-check', 307);
  assert(connect.headers.get('set-cookie').includes('oauth_callback=%2Fconectar%2Fcontract-check;'));
  await get('/api/auth/callback/google?code=contract-check&state=invalid', 400);
  if (base.startsWith('https:')) await get('/api/auth/dev-login', 403, { method: 'HEAD' });
  await get('/api/auth/session', 401);
  console.log(JSON.stringify({ base, passed: checks.length, checks }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
