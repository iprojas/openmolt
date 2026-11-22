const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: sleep } = require('node:timers/promises');
const { Client } = require('pg');

const origin = 'http://127.0.0.1:3014';
const state = path.join(os.homedir(), '.local/state/chile2-lab/l3-local');
const registry = require('../../chile2-lab/agents/registry.json').profiles;
const profileByName = new Map(registry.map(profile => [profile.name, profile]));
const label = 'Identidad experimental administrada · Piloto local CHILE2.';
const footer = '\n\nApertura editorial del piloto.';
const authRoot = '/account/agents';
const keys = new Map();
// Pace reads and writes together below the API's 100 requests per minute.
let waitUntil = 0;

async function api(route, { method = 'GET', body, agent, admin, allowed = [] } = {}) {
  for (;;) {
    await sleep(Math.max(0, waitUntil - Date.now()));
    waitUntil = Date.now() + 675;
    const headers = { Origin: origin };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (agent) headers.Authorization = 'Bearer ' + agent.key;
    if (admin) headers.Cookie = 'session=' + admin;
    const response = await fetch(origin + '/api/v1' + route, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429 && allowed.includes(429) === false) {
      const seconds = Number(response.headers.get('retry-after'));
      if (seconds > 0 && seconds <= 70) {
        await response.body.cancel();
        waitUntil = Date.now() + (seconds + 1) * 1000;
        continue;
      }
    }
    if (!response.ok && !allowed.includes(response.status)) {
      await response.body.cancel();
      throw Error(method + ' ' + route.split('?')[0] + ' HTTP ' + response.status);
    }
    return { status: response.status, data: await response.json() };
  }
}

function credentialPath(name) {
  assert(profileByName.has(name));
  return path.join(state, name + '.credential.json');
}

function credential(name) {
  if (keys.has(name)) return keys.get(name);
  const file = credentialPath(name);
  const meta = fs.lstatSync(file);
  assert(meta.isFile() && (meta.mode & 0o077) === 0);
  const saved = JSON.parse(fs.readFileSync(file));
  assert(saved.name === name && saved.origin === origin && /^cl2_[a-f0-9]{64}$/.test(saved.key));
  keys.set(name, saved);
  return saved;
}

function verifyParticipant(agent, name, active) {
  const key = credential(name);
  assert(agent.id === key.id && agent.name === name && agent.kind === 'agent' && agent.is_active);
  if (active) assert(agent.is_claimed && agent.description.startsWith(label));
}

async function pilotAdmin() {
  const preview = fs.realpathSync(path.join(state, 'preview'));
  assert.equal(preview, path.join(state, 'preview'));
  const values = Object.fromEntries(fs.readFileSync(path.join(preview, '.preview.env'), 'utf8').trim().split('\n')
    .map(line => line.split(/=(.*)/s).slice(0, 2)));
  const db = new URL(values.DATABASE_URL);
  assert(db.host === '127.0.0.1:55432' && db.pathname === '/chile2_pilot_local' && !db.search);
  const existing = credential('aureliano');
  verifyParticipant((await api('/agents/me', { agent: existing })).data.agent, 'aureliano', true);
  const client = new Client({ connectionString: db.href });
  await client.connect();
  let user;
  try {
    const result = await client.query(
      "SELECT u.id, u.email, u.google_id FROM users u JOIN agents a ON a.owner_user_id=u.id WHERE a.id=$1 AND u.google_id='local_l3_pilot_admin'",
      [existing.id]
    );
    assert.equal(result.rowCount, 1);
    user = result.rows[0];
  } finally { await client.end(); }
  const { SignJWT } = await import('jose');
  const session = await new SignJWT({ userId: user.id, email: user.email, googleId: user.google_id })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('45m')
    .sign(new TextEncoder().encode(values.SESSION_SECRET));
  const { data } = await api(authRoot, { admin: session });
  assert(data.canLinkMultiple && data.accounts.some(account => account.id === existing.id));
  return { session, owned: new Set(data.accounts.map(account => account.id)) };
}

async function provision() {
  const admin = await pilotAdmin();
  for (const profile of registry) {
    const name = profile.name;
    const file = credentialPath(name);
    if (!fs.existsSync(file)) {
      const lookup = await api('/agents/profile?name=' + name, { allowed: [404] });
      assert(lookup.status === 404, 'Existing account without a managed credential: ' + name);
      const { data } = await api('/agents/register', { method: 'POST', body: {
        name, description: label + ' ' + profile.description, personality: profile.personality,
      } });
      const pending = new URL(data.agent.claim_url);
      assert.equal(pending.origin, origin);
      const claim = pending.pathname.split('/').at(-1);
      assert.match(claim, /^cl2_claim_[a-f0-9]{64}$/);
      const key = { key: data.agent.api_key, name, origin };
      const { agent } = (await api('/agents/me', { agent: key })).data;
      key.id = agent.id;
      fs.writeFileSync(file, JSON.stringify(key), { mode: 0o600, flag: 'wx' });
    }
    const key = credential(name);
    const { agent } = (await api('/agents/me', { agent: key })).data;
    verifyParticipant(agent, name, false);
    if (!agent.is_claimed) {
      const { claim_url: claimUrl } = (await api('/agents/status', { agent: key })).data;
      const url = new URL(claimUrl);
      assert.equal(url.origin, origin);
      await api(authRoot, { method: 'POST', admin: admin.session, body: { claimToken: url.pathname.split('/').at(-1) } });
      admin.owned.add(key.id);
    }
    assert(admin.owned.has(key.id), 'Linked to a different account: ' + name);
    if (agent.displayName !== profile.display_name) {
      await api('/agents/me', { method: 'PATCH', agent: key, body: { displayName: profile.display_name } });
    }
    console.log('Managed and linked ' + name);
  }
  const { data } = await api(authRoot, { admin: admin.session });
  assert.equal(registry.filter(profile => data.accounts.some(agent => agent.name === profile.name && agent.isActive && agent.isClaimed)).length, 30);
}

function loadConversations() {
  // Each section is keyed by its community slug. Entries start with the annex
  // topic number and author, followed by a title and body or a reply body.
  // A reply can include the topic number of an earlier reply as its parent.
  const source = fs.readFileSync(path.join(__dirname, 'fixtures/editorial-annex-conversations.txt'), 'utf8');
  const catalog = require('./fixtures/community-editorial-v4.json');
  const coverage = new Map();
  const threads = [];
  let community;
  let thread;
  for (const line of source.trim().split('\n').filter(Boolean)) {
    if (line.startsWith('[')) {
      community = line.slice(1, -1);
      assert(Object.hasOwn(catalog, community) && !coverage.has(community));
      coverage.set(community, new Set());
      thread = null;
      continue;
    }
    const [number, author, ...fields] = line.split('|');
    const topic = Number(number);
    assert(topic >= 1 && topic <= 10 && Number.isInteger(topic) && profileByName.has(author));
    assert(!coverage.get(community).has(topic), community + ' duplicate topic ' + topic);
    coverage.get(community).add(topic);
    if (fields.length === 2 && !/^\d+$/.test(fields[0])) {
      const [title, content] = fields;
      assert(title && title.split(/\s+/).length <= 6 && content.length >= 20);
      thread = { community, topic, author, title, content, replies: [] };
      threads.push(thread);
    } else {
      assert(thread && fields.length <= 2);
      const parent = fields.length === 2 ? Number(fields[0]) : null;
      assert(parent === null || thread.replies.some(row => row.topic === parent));
      const content = fields.at(-1);
      assert(content.length >= 12);
      thread.replies.push({ topic, author, parent, content });
    }
  }
  assert.equal(coverage.size, 11);
  assert([...coverage.values()].every(topics => topics.size === 10));
  assert.equal(new Set(threads.map(row => row.author)).size, threads.length);
  assert.equal(new Set(threads.map(row => row.title)).size, threads.length);
  return threads;
}

function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.replies ?? [])]);
}

async function publish(threads) {
  const admin = await pilotAdmin();
  for (const profile of registry) {
    const account = credential(profile.name);
    assert(admin.owned.has(account.id));
  }
  const receipts = [];
  const receiptPath = path.join(state, 'annex-editorial-receipts.json');
  for (const thread of threads) {
    const content = thread.content + footer;
    const key = credential(thread.author);
    const { recentPosts } = (await api('/agents/profile?name=' + thread.author)).data;
    const same = recentPosts.filter(post => post.title === thread.title && post.community === thread.community);
    assert(same.length <= 1 && same.every(post => post.content === content), 'Title collision: ' + thread.title);
    const post = same[0] ?? (await api('/posts', {
      method: 'POST', agent: key, body: { community: thread.community, title: thread.title, content },
    })).data.post;
    const route = '/posts/' + post.id;
    const { post: stored } = (await api(route)).data;
    assert(stored.author_id === key.id && stored.title === thread.title && stored.content === content);
    const before = flatten((await api(route + '/comments')).data.comments);
    const replies = [];
    const byTopic = new Map();
    for (const reply of thread.replies) {
      const parentId = reply.parent === null ? null : byTopic.get(reply.parent);
      const writer = credential(reply.author);
      const matches = before.filter(row => row.author_id === writer.id &&
        row.content === reply.content && (row.parent_id ?? null) === parentId);
      assert(matches.length <= 1);
      const current = matches[0] ?? (await api(route + '/comments', {
        method: 'POST', agent: writer, body: { content: reply.content, parentId },
      })).data.comment;
      byTopic.set(reply.topic, current.id);
      replies.push({ topic: reply.topic, id: current.id, author: reply.author, parentId, content: reply.content });
    }
    const after = flatten((await api(route + '/comments')).data.comments);
    for (const reply of replies) {
      const row = after.find(item => item.id === reply.id);
      assert(row && row.author_id === credential(reply.author).id && row.content === reply.content &&
        (row.parent_id ?? null) === reply.parentId);
    }
    receipts.push({
      community: thread.community, topic: thread.topic, title: thread.title, author: thread.author,
      url: origin + '/post/' + post.id, replies: replies.map(({ content: _, ...reply }) => reply),
    });
    const temporary = receiptPath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(receipts, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, receiptPath);
    console.log(thread.community + ' · ' + thread.title + ' · ' + replies.length + ' replies · ' + origin + '/post/' + post.id);
  }
}
async function main() {
  assert.equal(registry.length, 30);
  const mode = process.argv[2];
  if (mode === '--provision' || mode === '--publish') {
    const lock = path.join(state, 'annex-editorial.lock');
    const timeout = 'An editorial load already holds the pilot lock.';
    let fd;
    try {
      fd = fs.openSync(lock, 'wx', 0o600);
    } catch (error) {
      if (error.code === 'EEXIST') throw Error(timeout);
      throw error;
    }
    try {
      fs.writeFileSync(fd, String(process.pid) + '\n');
      if (mode === '--provision') await provision();
      else await publish(loadConversations());
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
    return;
  }
  const threads = loadConversations();
  assert.equal(mode, undefined, 'Use --provision, --publish or run without flags to validate.');
  console.log(threads.length + ' threads and ' + threads.reduce((sum, item) => sum + item.replies.length, 0) + ' replies, covering 110 topics.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
