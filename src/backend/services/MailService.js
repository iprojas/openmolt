const { query, queryOne } = require('../config/database');
let busy = false;
function logError(error, job) {
  // Provider messages can contain addresses or secrets; log bounded codes only.
  const code = String(error.code || error.name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 64);
  console.error('No se pudo procesar la cola de correo', {
    code, status: error.status || undefined,
    jobId: job?.id, attempt: job?.attempts,
  });
}

async function send(job) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `chile2-mail/${job.id}`,
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [job.recipient], subject: job.subject, text: job.body,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    const error = new Error('Resend delivery failed');
    error.code = data.name || 'invalid_resend_response';
    error.status = response.status;
    throw error;
  }
  return data.id;
}
async function enqueue(recipient, subject, body, client) {
  const sql =
    'INSERT INTO mail_jobs (id, recipient, subject, body) VALUES (gen_random_uuid(), $1, $2, $3)';
  if (client) await client.query(sql, [recipient, subject, body]);
  else await query(sql, [recipient, subject, body]);
}
async function deliver() {
  if (busy || !process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return;
  busy = true;
  try {
    for (let i = 0; i < 20; i++) {
      const job =
        await queryOne(`UPDATE mail_jobs SET status='processing', locked_at=NOW(), attempts=attempts+1 WHERE id=(
        SELECT id FROM mail_jobs WHERE (status='pending' AND next_attempt_at<=NOW()) OR (status='processing' AND locked_at<NOW()-INTERVAL '5 minutes')
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
      if (!job) break;
      try {
        const emailId = await send(job);
        await query(
          'UPDATE mail_jobs SET status=$2, sent_at=NOW() WHERE id=$1',
          [job.id, 'sent']
        );
        console.log('Correo aceptado por Resend', { jobId: job.id, emailId });
      } catch (error) {
        logError(error, job);
        const permanent = [400, 401, 403, 404, 422].includes(error.status);
        await query(
          `UPDATE mail_jobs SET status=$2, next_attempt_at=NOW()+($3 * INTERVAL '1 minute') WHERE id=$1`,
          [job.id, permanent || job.attempts >= 5 ? 'failed' : 'pending', 2 ** job.attempts]
        );
        // Let other workers and requests recover when the provider throttles us.
        if (error.status === 429) break;
      }
    }
  } finally {
    busy = false;
  }
}
function start() {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    console.warn('Correo deshabilitado: configura RESEND_API_KEY y MAIL_FROM. Los trabajos permanecen en cola.');
  }
  const timer = setInterval(
    () =>
      deliver().catch(logError),
    5000
  );
  timer.unref();
  deliver().catch(logError);
}
module.exports = { enqueue, deliver, start };
