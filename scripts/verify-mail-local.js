// Exercises the real subscription -> queue -> Resend -> confirmation path.
// Only Resend's simulated-delivery recipient and the local database are allowed.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55432' || url.pathname !== '/chile2') throw Error('Local chile2 database required.');
const base = 'http://localhost:3000';
const email = `delivered+chile2-confirm-${Date.now()}@resend.dev`;
async function request(path, body, expected = 200) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, expected, path);
  return response.json();
}
async function main() {
  assert.ok(process.env.RESEND_API_KEY && process.env.MAIL_FROM, 'Configure Resend first.');
  await request('/api/v1/newsletter', { email, consent: false }, 400);
  await request('/api/v1/newsletter', { email, consent: true });
  const job = await db.mailJob.findFirstOrThrow({ where: { recipient: email } });
  const confirmation = job.body.match(/confirm\?token=([a-f0-9]{64})/)[1];
  const unsubscribe = job.body.match(/unsubscribe\?token=([a-f0-9]{64})/)[1];
  assert.ok(job.body.includes(base + '/newsletter/confirm?token='));
  // The running API worker owns delivery; do not create a second consumer.
  let delivered;
  for (let i = 0; i < 40; i++) {
    delivered = await db.mailJob.findUniqueOrThrow({ where: { id: job.id } });
    if (['sent', 'failed'].includes(delivered.status)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(delivered.status, 'sent', 'Resend API acceptance');
  await request('/api/v1/newsletter', { email, consent: true });
  assert.equal(await db.mailJob.count({ where: { recipient: email } }), 1, 'No duplicate confirmation');
  await request('/api/v1/newsletter/confirm', { token: '0'.repeat(64) }, 404);
  await request('/api/v1/newsletter/confirm', { token: confirmation });
  assert.equal((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).confirmed, true);
  // Existing confirmation is idempotent until unsubscribe rotates the token.
  await request('/api/v1/newsletter/confirm', { token: confirmation });
  await request('/api/v1/newsletter/unsubscribe', { token: unsubscribe });
  assert.equal((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).active, false);
  await request('/api/v1/newsletter/confirm', { token: confirmation }, 404);
  console.log('PASS: consent, real Resend queue delivery, public confirmation URL, duplicate prevention, idempotent confirmation and unsubscribe token invalidation.');
  console.log('Resend simulated-delivery test; no message sent to a real person.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await db.mailJob.deleteMany({ where: { recipient: email } });
  await db.newsletterSubscriber.deleteMany({ where: { email } });
  await db.$disconnect();
});
