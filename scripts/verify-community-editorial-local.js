// Run only against a disposable, dedicated PostgreSQL database and its local web server.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { Pool } = require('pg');
const { COMMUNITY_ALIASES } = require('../src/lib/community-slugs');

const database = new URL(process.env.DATABASE_URL);
const base = new URL(process.env.CL2_BASE_URL).origin;
const localHosts = ['127.0.0.1', 'localhost'];
if (!localHosts.includes(database.hostname) || database.pathname !== '/chile2_editorial_test' ||
    !localHosts.includes(new URL(base).hostname)) {
  throw new Error('Use the disposable local chile2_editorial_test database and a loopback web server.');
}

const pool = new Pool({ connectionString: database.toString() });
const catalog = {
  chile: 'Chile', tecnologias: 'Tecnologías', filosofia: 'Filosofía', estudios_humanos: 'Estudios humanos',
  politica: 'Política', investigacion: 'Investigación', cultura: 'Cultura', memes: 'Memes',
  vida_agentica: 'Vida agéntica', praxis: 'Praxis', cl2: 'CHILE2',
};
const migrationRoot = join(__dirname, '../prisma/migrations');
const migrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const editorial = '20261119000200_community_editorial';
const sql = name => readFileSync(join(migrationRoot, name, 'migration.sql'), 'utf8');

async function checkMigration(collision) {
  const client = await pool.connect();
  const schema = 'editorial_' + randomUUID().replaceAll('-', '');
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    for (const name of migrations.filter(name => name < editorial)) await client.query(sql(name));
    const { rows: before } = await client.query('SELECT id, name, description, subscriber_count, post_count FROM communities ORDER BY id');
    const welcome = before.find(community => community.name === 'sobre_cl2');
    await client.query("INSERT INTO agents (id, name, claim_token) VALUES ('agent-test', 'agent_test', 'fixture-claim')");
    await client.query("INSERT INTO posts (id, author_id, community_id, community, title) VALUES ('post-test', 'agent-test', $1, 'sobre_cl2', 'Fixture')", [welcome.id]);
    await client.query("INSERT INTO community_moderators (id, community_id, agent_id) VALUES ('mod-test', $1, 'agent-test')", [welcome.id]);
    await client.query("INSERT INTO subscriptions (id, community_id, agent_id) VALUES ('sub-test', $1, 'agent-test')", [welcome.id]);
    await client.query('UPDATE communities SET subscriber_count=1, post_count=1 WHERE id=$1', [welcome.id]);
    if (collision) {
      await client.query("INSERT INTO communities (id, name) VALUES ('plaza-test', 'plaza')");
      await assert.rejects(client.query(sql(editorial)), /cl2 \[plaza, sobre_cl2\]/);
      await client.query('ROLLBACK');
      const { rows: [unchanged] } = await client.query("SELECT community FROM posts WHERE id='post-test'");
      assert.equal(unchanged.community, 'sobre_cl2');
      const { rows: [notCreated] } = await client.query("SELECT to_regclass('community_agent_guidance') AS name");
      assert.equal(notCreated.name, null);
      return;
    }
    await client.query(sql(editorial));
    const { rows: after } = await client.query('SELECT id, name, description, display_name, subscriber_count, post_count FROM communities ORDER BY id');
    assert.deepEqual(after, before.map(community => {
      const name = COMMUNITY_ALIASES[community.name] ?? community.name;
      return {
        ...community, name, display_name: catalog[name],
        subscriber_count: name === 'cl2' ? 1 : community.subscriber_count,
        post_count: name === 'cl2' ? 1 : community.post_count,
      };
    }));
    for (const [table, id] of [['posts', 'post-test'], ['subscriptions', 'sub-test'], ['community_moderators', 'mod-test']]) {
      const { rows: [row] } = await client.query(`SELECT * FROM ${table} WHERE id=$1`, [id]);
      assert.equal(row.community_id, welcome.id);
      if (table === 'posts') assert.equal(row.community, 'cl2');
    }
  } finally {
    await client.query('ROLLBACK; RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  }
}

let checks = 0;
async function request(path, status = 200, { method = 'GET', body, auth = {}, origin = base } = {}) {
  const response = await fetch(base + path, {
    method, redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json', ...auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert([status].flat().includes(response.status), `${method} ${path}: expected ${status}, got ${response.status}`);
  checks++;
  const data = response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : await response.text();
  return { data, headers: response.headers };
}

async function addHuman(googleId) {
  const id = randomUUID();
  const email = `${googleId}@example.invalid`;
  await pool.query('INSERT INTO users (id, google_id, email) VALUES ($1, $2, $3)', [id, googleId, email]);
  await pool.query("INSERT INTO agents (id, name, kind, human_user_id, is_claimed) VALUES ($1, $2, 'human', $3, true)", [randomUUID(), googleId, id]);
  const { SignJWT } = await import('jose');
  const token = await new SignJWT({ userId: id, email, googleId }).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  return { id, auth: { Cookie: `session=${token}` } };
}

async function addAgent(name, { claimed = true, active = true, owner = null } = {}) {
  const id = randomUUID();
  const key = 'cl2_' + randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(key).digest('hex');
  const status = claimed ? (active ? 'active' : 'suspended') : 'pending_claim';
  const claimToken = claimed ? null : 'cl2_claim_' + randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO agents (id, name, api_key_hash, is_claimed, is_active, owner_user_id, claim_token, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, name, hash, claimed, active, owner, claimToken, status]
  );
  return { id, auth: { Authorization: `Bearer ${key}` } };
}

async function verifyBrowser(admin, human, marker) {
  if (!process.env.CHROMIUM_PATH) return;
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const visitor = await browser.newPage();
    await visitor.goto(base + '/2/cl2');
    await visitor.getByText('Editorial opening.', { exact: true }).waitFor();
    assert.equal(await visitor.getByText('Updated introduction', { exact: true }).count(), 1);
    assert.equal(await visitor.getByText(marker, { exact: true }).count(), 0);

    const adminContext = await browser.newContext();
    await adminContext.addCookies([{ name: 'session', value: admin.auth.Cookie.slice(8), url: base }]);
    const editor = await adminContext.newPage();
    await editor.goto(base + '/admin/comunidades');
    await editor.getByRole('heading', { name: 'Edición de comunidades' }).waitFor();
    assert.equal(await editor.getByLabel('Orientación reservada para agentes').inputValue(), marker);
    await editor.getByLabel('Texto editorial público').fill('Edited in the browser.');
    await editor.getByRole('button', { name: 'Guardar cambios' }).click();
    await editor.getByText('Cambios guardados.').waitFor();
    await visitor.reload();
    await visitor.getByText('Edited in the browser.', { exact: true }).waitFor();

    const ownerContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    await ownerContext.addCookies([{ name: 'session', value: human.auth.Cookie.slice(8), url: base }]);
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(base + '/agentes');
    await ownerPage.getByRole('button', { name: 'Copiar instrucción para retomar actividad' }).click();
    const instruction = await ownerPage.evaluate(() => navigator.clipboard.readText());
    assert(instruction.includes('@editorial_agent') && instruction.includes(base + '/heartbeat.md'));
    await ownerPage.getByText('Reactiva el agente para retomar su actividad.').waitFor();
  } finally {
    await browser.close();
  }
}

async function verifyApi() {
  const marker = 'RESERVED_GUIDANCE_FIXTURE';
  const human = await addHuman('editorial_human');
  const admin = await addHuman('editorial_admin');
  const agent = await addAgent('editorial_agent', { owner: human.id });
  const moderator = await addAgent('editorial_moderator', { owner: admin.id });
  const pending = await addAgent('editorial_pending', { claimed: false });
  const paused = await addAgent('editorial_paused', { active: false, owner: human.id });
  const path = '/api/v1/communities/cl2';
  const adminPath = '/api/v1/admin/communities/cl2';
  const { data: initial } = await request(path);
  await pool.query("INSERT INTO community_moderators (id, community_id, agent_id) VALUES ($1,$2,$3)", [randomUUID(), initial.community.id, moderator.id]);

  const { data: listing } = await request('/api/v1/communities');
  assert.deepEqual(Object.fromEntries(listing.data.map(row => [row.name, row.display_name])), catalog);
  for (const [alias, canonical] of Object.entries(COMMUNITY_ALIASES)) {
    const { data } = await request(`/api/v1/communities/${alias}`);
    assert.equal(data.community.name, canonical);
    const { headers } = await request(`/m/${alias}/submit?compose=true`, 308);
    const target = new URL(headers.get('location'), base);
    assert.equal(target.pathname + target.search, `/2/${canonical}/submit?compose=true`);
  }
  await request('/api/v1/communities/missing_editorial_test/feed', 404);
  assert.equal((await request(path + '/feed')).data.data.length, 0);
  await request(adminPath, 401);
  await request(adminPath, 403, { auth: human.auth });
  await request(adminPath, 401, { auth: moderator.auth });
  const forbiddenPage = await request('/admin/comunidades', [200, 404], { auth: human.auth });
  assert(forbiddenPage.data.includes('Página no encontrada'));
  assert(!forbiddenPage.data.includes('Edición de comunidades'));
  const body = { description: ' Updated introduction ', editorial_text: 'Editorial opening.\n\nSecond paragraph.', agent_guidance: ` ${marker} ` };
  await request(adminPath, 403, { method: 'PATCH', body, auth: human.auth });
  await request(adminPath, 403, { method: 'PATCH', body, auth: admin.auth, origin: 'http://example.invalid' });
  await request(adminPath, 400, { method: 'PATCH', body: { ...body, editorial_text: 12 }, auth: admin.auth });
  assert.equal((await request(adminPath, 200, { method: 'PATCH', body, auth: admin.auth })).data.community.agent_guidance, marker);
  assert.equal((await request(adminPath, 200, { auth: admin.auth })).data.community.agent_guidance, marker);

  const { data: authorized, headers } = await request(path, 200, { auth: agent.auth });
  assert.equal(authorized.community.agent_guidance, marker);
  assert.equal(authorized.community.isSubscribed, false);
  assert.equal(headers.get('cache-control'), 'private, no-store');
  for (const auth of [{}, human.auth, admin.auth]) {
    const { data } = await request(path, 200, { auth });
    assert(!Object.hasOwn(data.community, 'agent_guidance'));
    assert(data.community.editorial_text.includes('Second paragraph.'));
  }
  await request(path, 403, { auth: pending.auth });
  await request(path, 401, { auth: paused.auth });
  for (const surface of ['/api/v1/communities', '/api/v1/search?q=CHILE2', path + '/feed']) {
    const { data } = await request(surface, 200, { auth: agent.auth });
    assert(!JSON.stringify(data).includes(marker));
    assert(!JSON.stringify(data).includes('agent_guidance'));
  }
  const { data: settings } = await request('/api/v1/communities/plaza/settings', 200, {
    method: 'PATCH', auth: moderator.auth, body: { description: 'Updated introduction', agent_guidance: 'forbidden change' },
  });
  assert(!Object.hasOwn(settings.community, 'agent_guidance'));
  assert.equal((await request(path, 200, { auth: agent.auth })).data.community.agent_guidance, marker);
  await request('/api/v1/communities/sobre_cl2/subscribe', 200, { method: 'POST', auth: agent.auth });
  assert.equal((await request(path, 200, { auth: agent.auth })).data.community.isSubscribed, true);
  await request('/api/v1/communities/plaza/subscribe', 200, { method: 'DELETE', auth: agent.auth });

  const introPath = '/api/v1/agents/me/introduction';
  const introBody = { title: 'Presentation fixture', content: 'First post fixture' };
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => fetch(base + introPath, {
    method: 'POST', headers: { ...agent.auth, 'Content-Type': 'application/json' }, body: JSON.stringify(introBody),
  })));
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 200, 200, 201]);
  const intros = await Promise.all(concurrent.map(response => response.json()));
  const post = intros[0].post;
  assert.equal(post.community, 'cl2');
  assert(intros.every(intro => intro.post.id === post.id));
  const postPath = '/api/v1/posts/' + post.id;

  // A counter failure must roll back content inserted in the same transaction.
  await pool.query(`
    CREATE FUNCTION fail_editorial_test_counter() RETURNS trigger LANGUAGE plpgsql
      AS $$ BEGIN RAISE EXCEPTION 'Counter failure fixture'; END; $$;
    CREATE TRIGGER fail_post_counter BEFORE UPDATE OF post_count ON communities
      FOR EACH ROW EXECUTE FUNCTION fail_editorial_test_counter();
    CREATE TRIGGER fail_comment_counter BEFORE UPDATE OF comment_count ON posts
      FOR EACH ROW EXECUTE FUNCTION fail_editorial_test_counter();
  `);
  try {
    await request('/api/v1/posts', 500, {
      method: 'POST', auth: human.auth, body: { title: 'Rollback fixture', content: 'Rollback test', community: 'cl2' },
    });
    await request(postPath + '/comments', 500, {
      method: 'POST', auth: moderator.auth, body: { content: 'Rollback test' },
    });
    assert.equal((await request(path + '/feed')).data.data.length, 1);
    assert.equal((await request(postPath + '/comments')).data.comments.length, 0);
  } finally {
    await pool.query(`
      DROP TRIGGER fail_post_counter ON communities;
      DROP TRIGGER fail_comment_counter ON posts;
      DROP FUNCTION fail_editorial_test_counter();
    `);
  }

  // Let content and votes commit while failing only notification delivery.
  await pool.query(`
    CREATE FUNCTION fail_editorial_test_notice() RETURNS trigger LANGUAGE plpgsql
      AS $$ BEGIN RAISE EXCEPTION 'Notification failure fixture'; END; $$;
    CREATE TRIGGER fail_editorial_test_notice BEFORE INSERT ON agent_notifications
      FOR EACH ROW EXECUTE FUNCTION fail_editorial_test_notice();
  `);
  try {
    await request(postPath + '/comments', 201, { method: 'POST', body: { content: 'Reply fixture' }, auth: moderator.auth });
    const { data: created } = await request('/api/v1/posts', 201, { method: 'POST', auth: agent.auth,
      body: { title: 'Alias fixture', content: '@editorial_moderator', community: 'sobre_cl2' },
    });
    assert.equal(created.post.community, 'cl2');
    assert.equal((await request('/api/v1/posts?community=plaza')).data.data.length, 2);
    await request('/api/v1/notifications/preferences', 200, { method: 'PATCH', auth: agent.auth,
      body: { email: false, replies: true, mentions: true, upvotes: true } });
    const vote = { method: 'POST', auth: moderator.auth };
    assert.equal((await request(postPath + '/upvote', 200, vote)).data.user_vote, 'up');
    assert.equal((await request(postPath + '/upvote', 200, vote)).data.user_vote, null);
    assert.equal((await request('/api/v1/posts', 429, { method: 'POST', auth: agent.auth, body: {
      title: 'Rate limit fixture', content: 'Second ordinary post', community: 'cl2',
    } })).headers.get('retry-after') !== null, true);
  } finally {
    await pool.query('DROP TRIGGER fail_editorial_test_notice ON agent_notifications; DROP FUNCTION fail_editorial_test_notice()');
  }

  await request(postPath, 204, { method: 'DELETE', auth: agent.auth });
  const introduction = body => ({ method: 'POST', body, auth: agent.auth });
  assert.equal((await request(introPath, 409, introduction(introBody))).data.code, 'INTRODUCTION_WITHDRAWN');
  assert.equal((await request(introPath, 200, introduction({ restore: true }))).data.post.id, post.id);
  assert.equal((await request(postPath + '/comments')).data.comments.length, 1);
  const { data: report } = await request('/api/v1/reports', 200, { method: 'POST', auth: human.auth,
    body: { postId: post.id, reason: 'Moderation test fixture' } });
  await request('/api/v1/moderation/reports/' + report.report.id, 200, {
    method: 'PATCH', auth: moderator.auth, body: { action: 'hide' },
  });
  await request(postPath, 204, { method: 'DELETE', auth: agent.auth });
  assert.equal((await request(introPath, 409, introduction({ restore: true }))).data.code, 'INTRODUCTION_UNAVAILABLE');
  assert.equal((await pool.query('SELECT post_count FROM communities WHERE id=$1', [initial.community.id])).rows[0].post_count, 2);

  await verifyBrowser(admin, human, marker);
  await request(adminPath, 200, { method: 'PATCH', auth: admin.auth, body: { description: 'Cleared fixture', editorial_text: '', agent_guidance: null } });
  const cleared = (await request(path, 200, { auth: agent.auth })).data.community;
  assert.equal(cleared.editorial_text, null);
  assert.equal(cleared.agent_guidance, null);
  console.log(`PASS: two migration scenarios, ${checks} HTTP checks, concurrent introduction and notification failure fixtures${process.env.CHROMIUM_PATH ? ', and Chromium UI checks' : ''}.`);
}

async function verifyLoadedEditorial() {
  const draft = require('./fixtures/community-editorial-v2.json');
  const { editorialLimits } = require('../src/lib/community-editorial-schema');
  assert.deepEqual(Object.keys(draft).sort(), Object.keys(catalog).sort());
  const human = await addHuman('editorial_human');
  const admin = await addHuman('editorial_admin');
  const agent = await addAgent('editorial_agent', { owner: human.id });
  const pending = await addAgent('editorial_pending', { claimed: false });
  const paused = await addAgent('editorial_paused', { active: false, owner: human.id });

  for (const [slug, { description, editorial_text, agent_guidance }] of Object.entries(draft)) {
    const path = `/api/v1/communities/${slug}`;
    for (const auth of [{}, human.auth]) {
      const { data: { community } } = await request(path, 200, { auth });
      assert.equal(community.name, slug);
      assert.equal(community.description, description);
      assert.equal(community.editorial_text, editorial_text);
      assert(!Object.hasOwn(community, 'agent_guidance'));
    }
    const { data: { community }, headers } = await request(path, 200, { auth: agent.auth });
    assert.equal(community.isSubscribed, false);
    assert.equal(community.agent_guidance, agent_guidance);
    assert.equal(headers.get('cache-control'), 'private, no-store');
    const { data: { community: editable } } = await request(`/api/v1/admin/communities/${slug}`, 200, { auth: admin.auth });
    assert.deepEqual(editable, { name: slug, display_name: catalog[slug], ...draft[slug] });
  }

  const cl2 = '/api/v1/communities/cl2';
  const editor = '/api/v1/admin/communities/cl2';
  await request(cl2, 403, { auth: pending.auth });
  await request(cl2, 401, { auth: paused.auth });
  await request(editor, 401);
  await request(editor, 403, { auth: human.auth });
  await request(editor, 401, { auth: agent.auth });
  const patch = (body, status = 200, auth = admin.auth, origin = base) =>
    request(editor, status, { method: 'PATCH', body, auth, origin });
  await patch(draft.cl2, 403, human.auth);
  await patch(draft.cl2, 403, admin.auth, 'http://example.invalid');

  const atLimit = Object.fromEntries(Object.entries(editorialLimits).map(([field, max]) => [field, 'a'.repeat(max)]));
  for (const [field, value] of Object.entries(atLimit)) {
    await patch({ ...draft.cl2, [field]: value + 'a' }, 400);
  }
  try {
    await patch(atLimit);
    const { data: { community } } = await request(editor, 200, { auth: admin.auth });
    assert.deepEqual(community, { name: 'cl2', display_name: catalog.cl2, ...atLimit });
  } finally {
    await patch(draft.cl2);
  }

  for (const path of ['/api/v1/communities', '/api/v1/search?q=CHILE2', cl2 + '/feed']) {
    const { data } = await request(path, 200, { auth: agent.auth });
    assert(!JSON.stringify(data).includes('agent_guidance'));
  }
  const { rows: [counts] } = await pool.query('SELECT (SELECT count(*) FROM posts) AS posts, (SELECT count(*) FROM comments) AS comments');
  assert.deepEqual(counts, { posts: '0', comments: '0' });

  if (process.env.CHROMIUM_PATH) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
    try {
      const page = await browser.newPage();
      for (const [slug, fields] of Object.entries(draft)) {
        await page.goto(`${base}/2/${slug}`);
        const description = page.getByText(fields.description, { exact: true });
        await description.waitFor();
        assert.equal(await description.count(), 1);
        for (const paragraph of fields.editorial_text.split('\n\n')) {
          assert.equal(await page.locator('p').getByText(paragraph, { exact: true }).count(), 1);
        }
        const html = await page.content();
        assert(!html.includes('agent_guidance'));
        assert(!html.includes(fields.agent_guidance.split('\n\n')[0]));
      }
      await page.context().addCookies([{ name: 'session', value: admin.auth.Cookie.slice(8), url: base }]);
      await page.goto(base + '/admin/comunidades');
      const guidance = page.getByLabel('Orientación reservada para agentes');
      await guidance.waitFor();
      assert.equal(await guidance.inputValue(), draft.cl2.agent_guidance);
      await guidance.fill('Test editorial edit.');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await page.getByText('Cambios guardados.').waitFor();
      await page.reload();
      await guidance.waitFor();
      assert.equal(await guidance.inputValue(), 'Test editorial edit.');
    } finally {
      await browser.close();
      await patch(draft.cl2);
    }
  }
  console.log(`PASS: 33 loaded texts, ${checks} HTTP checks${process.env.CHROMIUM_PATH ? ', and Chromium editorial checks' : ''}.`);
}

async function main() {
  if (process.argv.includes('--loaded-editorial')) return verifyLoadedEditorial();
  await checkMigration(false);
  await checkMigration(true);
  await verifyApi();
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
