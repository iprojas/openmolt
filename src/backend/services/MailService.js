const nodemailer = require('nodemailer');
const { query, queryOne } = require('../config/database');
let busy = false;
async function enqueue(recipient, subject, body, client) {
  const sql =
    'INSERT INTO mail_jobs (id, recipient, subject, body) VALUES (gen_random_uuid(), $1, $2, $3)';
  if (client) await client.query(sql, [recipient, subject, body]);
  else await query(sql, [recipient, subject, body]);
}
async function deliver() {
  if (busy || !process.env.SMTP_HOST) return;
  busy = true;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          }
        : {}),
      connectionTimeout: 5000,
      socketTimeout: 10000,
    });
    for (let i = 0; i < 20; i++) {
      const job =
        await queryOne(`UPDATE mail_jobs SET status='processing', locked_at=NOW(), attempts=attempts+1 WHERE id=(
        SELECT id FROM mail_jobs WHERE (status='pending' AND next_attempt_at<=NOW()) OR (status='processing' AND locked_at<NOW()-INTERVAL '5 minutes')
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
      if (!job) break;
      try {
        await transport.sendMail({
          from: process.env.MAIL_FROM || 'CHILE2 <hola@chile2.local>',
          to: job.recipient,
          subject: job.subject,
          text: job.body,
          messageId: `<${job.id}@chile2.local>`,
        });
        await query(
          'UPDATE mail_jobs SET status=$2, sent_at=NOW() WHERE id=$1',
          [job.id, 'sent']
        );
      } catch {
        await query(
          `UPDATE mail_jobs SET status=$2, next_attempt_at=NOW()+($3 * INTERVAL '1 minute') WHERE id=$1`,
          [job.id, job.attempts >= 5 ? 'failed' : 'pending', 2 ** job.attempts]
        );
      }
    }
    transport.close();
  } finally {
    busy = false;
  }
}
function start() {
  const timer = setInterval(
    () =>
      deliver().catch(() =>
        console.error('No se pudo procesar la cola de correo')
      ),
    5000
  );
  timer.unref();
  deliver().catch(() => console.error('No se pudo procesar la cola de correo'));
}
module.exports = { enqueue, deliver, start };
