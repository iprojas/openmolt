/** @jest-environment node */
const { createECDH } = require('node:crypto');
const database = require('../src/backend/config/database');
const webPush = require('web-push');
const Push = require('../src/backend/services/PushService');
const { notify } = require('../src/backend/services/NotificationService');

jest.mock('../src/backend/config/database', () => ({ queryAll: jest.fn(), query: jest.fn(), transaction: jest.fn() }));
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
  keys: { p256dh: `B${'a'.repeat(86)}`, auth: 'a'.repeat(22) },
};
const vapidKeys = createECDH('prime256v1');
vapidKeys.setPrivateKey(Buffer.alloc(32, 1));

describe('human Web Push', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      VAPID_PUBLIC_KEY: vapidKeys.getPublicKey().toString('base64url'),
      VAPID_PRIVATE_KEY: vapidKeys.getPrivateKey().toString('base64url'),
      VAPID_SUBJECT: 'mailto:operator@example.com',
    };
  });

  afterEach(() => { process.env = originalEnv; });

  it('keeps delivery disabled without matching VAPID keys', async () => {
    process.env.VAPID_PUBLIC_KEY = `B${'a'.repeat(86)}`;
    await Push.deliver('human', '/post/example', 'event');
    expect(database.queryAll).not.toHaveBeenCalled();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('accepts browser push endpoints and rejects untrusted destinations and invalid keys', () => {
    expect(Push.validSubscription(subscription)).toBe(true);
    expect(Push.validSubscription(null)).toBe(false);
    expect(Push.validSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'bad' } })).toBe(false);
    expect(Push.validEndpoint('https://web.push.apple.com/device')).toBe(true);
    expect(Push.validEndpoint('https://updates.push.services.mozilla.com/device')).toBe(true);
    expect(Push.validEndpoint('https://fcm.googleapis.com.example.org/device')).toBe(false);
    expect(Push.validEndpoint('https://127.0.0.1/device')).toBe(false);
  });

  it('accepts Chromium FCM staging subscriptions only on the Google push route', () => {
    expect(Push.validSubscription({
      ...subscription,
      endpoint: 'https://jmt17.google.com/fcm/send/test-device',
    })).toBe(true);
    expect(Push.validEndpoint('https://jmt17.google.com/fcm/send/')).toBe(false);
    expect(Push.validEndpoint('https://jmt17.google.com/other/test-device')).toBe(false);
    expect(Push.validEndpoint('https://other.jmt17.google.com/fcm/send/test-device')).toBe(false);
  });

  it('commits the inbox event before dispatching push and tolerates a delivery failure', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ replies: true }] })
      .mockResolvedValueOnce({ rowCount: 1 }) };
    let committed = false;
    database.transaction.mockImplementation(async callback => {
      const result = await callback(client);
      committed = true;
      return result;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const deliver = jest.spyOn(Push, 'deliver').mockImplementation(async () => {
      expect(committed).toBe(true);
      throw new Error('Push provider unavailable');
    });
    try {
      await expect(notify({
        agentId: 'human', actorId: 'author', type: 'reply',
        title: 'Respuesta', body: 'Un aviso', link: '/post/example', eventKey: 'event',
      })).resolves.toBeUndefined();
      expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO agent_notifications'),
        ['human', 'event', 'reply', 'Respuesta', 'Un aviso', '/post/example']);
      expect(deliver).toHaveBeenCalledWith('human', '/post/example', 'event');
    } finally {
      deliver.mockRestore();
      warn.mockRestore();
    }
  });

  it('sends a generic notification and removes an expired device for its owner', async () => {
    database.queryAll.mockResolvedValue([{ endpoint: subscription.endpoint, ...subscription.keys, user_id: 'owner' }]);
    webPush.sendNotification.mockRejectedValue({ statusCode: 410 });
    await Push.deliver('human', '/post/example', 'event');
    expect(database.queryAll).toHaveBeenCalledWith(expect.stringContaining("a.kind='human'"), ['human']);
    expect(webPush.sendNotification).toHaveBeenCalledWith(subscription,
      JSON.stringify({ url: '/post/example', tag: 'event' }), expect.objectContaining({ TTL: 300 }));
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id=$1 AND endpoint=$2'),
      ['owner', subscription.endpoint]);
  });
});
