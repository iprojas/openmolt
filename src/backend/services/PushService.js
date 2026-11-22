const { createECDH, createHash } = require('node:crypto');
const webPush = require('web-push');
const { query, queryAll } = require('../config/database');

const providers = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

function vapidDetails() {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
  if (!/^[\w-]{87}$/.test(publicKey || '') || !/^[\w-]{43}$/.test(privateKey || '')) return null;
  try {
    const contact = new URL(subject);
    if (!['mailto:', 'https:'].includes(contact.protocol)) return null;
    const keys = createECDH('prime256v1');
    keys.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    if (keys.getPublicKey().toString('base64url') !== publicKey) return null;
    return { publicKey, privateKey, subject };
  } catch {
    return null;
  }
}

function validEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    // Chromium can issue subscriptions through Google's FCM staging endpoint.
    if (url.hostname === 'jmt17.google.com') return /^\/fcm\/send\/[^/]+$/.test(url.pathname);
    return providers.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function validSubscription(subscription) {
  const { endpoint, keys } = subscription || {};
  return validEndpoint(endpoint) && typeof keys?.p256dh === 'string' &&
    typeof keys.auth === 'string' && /^B[\w-]{86}$/.test(keys.p256dh) &&
    /^[\w-]{22}$/.test(keys.auth);
}

async function deviceIds(userId) {
  const rows = await queryAll('SELECT endpoint FROM push_subscriptions WHERE user_id=$1', [userId]);
  return rows.map(({ endpoint }) => createHash('sha256').update(endpoint).digest('hex'));
}

async function subscribe(userId, { endpoint, keys }) {
  const result = await query(
    `INSERT INTO push_subscriptions (endpoint,user_id,p256dh,auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth
     WHERE push_subscriptions.user_id=EXCLUDED.user_id`,
    [endpoint, userId, keys.p256dh, keys.auth]
  );
  return result.rowCount > 0;
}

async function unsubscribe(userId, endpoint) {
  await query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2', [userId, endpoint]);
}

async function deliver(agentId, link, eventKey) {
  const vapid = vapidDetails();
  if (!vapid) return;
  const subscriptions = await queryAll(
    `SELECT s.* FROM push_subscriptions s JOIN agents a ON a.human_user_id=s.user_id
     WHERE a.id=$1 AND a.kind='human' AND a.is_active=true`, [agentId]);
  const payload = JSON.stringify({ url: link, tag: eventKey });
  for (const { endpoint, p256dh, auth, user_id } of subscriptions) {
    if (!validEndpoint(endpoint)) continue;
    try {
      await webPush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, {
        vapidDetails: vapid, TTL: 300, timeout: 5000,
      });
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) await unsubscribe(user_id, endpoint);
      else console.warn('Web Push delivery failed.', { status: error.statusCode });
    }
  }
}

module.exports = { vapidDetails, validEndpoint, validSubscription, deviceIds, subscribe, unsubscribe, deliver };
