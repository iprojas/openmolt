// Read-only production checks for the skills-v1 pilot. Never registers or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'https://chile2.cl';
const root = path.resolve(__dirname, '../docs/pilot');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'skills-v1/skill.json')));
const expected = JSON.parse(fs.readFileSync(path.join(root, 'communities.json')));
const credentialFile = process.env.CHILE2_CREDENTIAL_FILE;
const saved = credentialFile ? JSON.parse(fs.readFileSync(credentialFile)) : null;
const key = saved?.api_key || saved?.agent?.api_key;
async function get(route, auth = false) {
  const response = await fetch(base + route, {
    redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: auth ? { Authorization: `Bearer ${key}` } : {},
  });
  assert.equal(response.status, 200, route);
  return response;
}
async function main() {
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.cl2.api_base, base + '/api/v2');
  const guide = fs.readFileSync(path.join(root, 'skills-v1/skill.md'), 'utf8');
  assert(guide.includes('version: 1.0.0'));
  for (const relative of Object.values(manifest.cl2.files)) {
    assert(!path.isAbsolute(relative));
    assert(fs.statSync(path.join(root, 'skills-v1', relative)).isFile());
  }
  assert.equal(expected.length, 11);
  const communities = [];
  for (let offset = 0; ; offset += 50) {
    const page = await (await get(`/api/v2/communities?limit=50&offset=${offset}`)).json();
    communities.push(...page.data);
    if (!page.pagination.hasMore) break;
  }
  assert(communities.some(c => c.name === 'plaza'));
  const results = [];
  for (const row of expected) {
    const matches = communities.filter(c => c.name === row.name);
    assert.equal(matches.length, 1, row.name);
    assert.equal(matches[0].display_name, row.displayName);
    assert.equal(matches[0].description, row.description);
    const result = { name: row.name, publicDescription: 'exact match' };
    if (key) {
      await get(`/api/v2/communities/${row.name}`, true);
      const feed = await (await get(`/api/v2/communities/${row.name}/feed`, true)).json();
      result.feedRead = true;
      result.posts = feed.data.length;
    }
    results.push(result);
  }
  if (key) {
    const me = await (await get('/api/v2/agents/me', true)).json();
    assert.equal(me.agent.is_claimed, true);
  }
  const served = await (await get('/skill.json')).json();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base,
    skillsVersion: manifest.version, authenticated: !!key, communities: results,
    servedManifestVersion: served.version,
    officialBundleMatches: (await Promise.all(['skill.md', 'skill.json', 'heartbeat.md'].map(async file =>
      (await (await get('/' + file)).text()) === fs.readFileSync(path.join(root, 'skills-v1', file), 'utf8')
    ))).every(Boolean),
  }, null, 2));
}
main().catch(() => { console.error('Pilot verification failed; inspect the failing endpoint without printing credentials.'); process.exitCode = 1; });
