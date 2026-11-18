# Subscription confirmations and Resend

The existing PostgreSQL `mail_jobs` queue now delivers through `POST https://api.resend.com/emails`. Mailpit, Nodemailer and SMTP configuration are no longer used. The queue remains part of the Express process; no additional worker service or database migration is needed.

## Configuration

| Variable | Value / purpose |
| --- | --- |
| `RESEND_API_KEY` | Private Resend sending key. Never expose it with `NEXT_PUBLIC_`. |
| `MAIL_FROM` | `CHILE2 <hola@chile2.cl>`; domain must be verified in Resend. |
| `CL2_BASE_URL` | `http://localhost:3000` locally; `https://chile2.cl` on Railway. Used in confirmation, unsubscribe and notification links. |

The supplied key is stored in the ignored `.env` and `.env.local`, with permissions 600. Express loads `.env.local`; Next.js also loads `.env`. Hosting variables override these files. Restart the Express dev process after editing its environment. Railway uses service variables; local files are excluded from deployment.

Cloudflare sender records supplied by Resend:

| Type | Name | Content |
| --- | --- | --- |
| TXT | `resend._domainkey` | DKIM public key returned by Resend; configured in Cloudflare. |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com`, priority 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| CNAME | `rsend` | `send.forge.rmta.net`, DNS only |

These sending/bounce records do not replace the website's CNAMEs or configure an inbox at `hola@chile2.cl`. Confirm sender-domain verification in Resend before sending to real subscribers.

## Flow and queue behavior

`POST /api/v1/newsletter` requires consent, hashes the confirmation/unsubscribe tokens, and enqueues the existing plain-text confirmation inside the same transaction. The worker checks every five seconds. Confirmation tokens expire after seven days. Confirmation is idempotent; unsubscribe invalidates the previous confirmation token. Repeating a recent or active subscription does not enqueue another message. Google OAuth remains the sign-in mechanism; no email login was added.

Each delivery uses `Idempotency-Key: chile2-mail/<job-id>`. Transient failures retain exponential retries; HTTP 429 stops the current batch; permanent configuration/validation failures and exhausted attempts become `failed`. `sent` means the Resend API accepted the request. Inbox delivery and bounces are separate provider events. Worker logs include only bounded error code/status, job ID, attempt, and provider message ID; they omit addresses, message bodies, tokens and credentials.

If variables are absent, jobs remain queued and startup states which configuration is missing. If claiming/updating a job fails, logs now expose the database error code rather than hiding it behind the generic queue message. Inspect aggregate state without exposing recipients:

```sql
SELECT status, count(*), max(attempts) FROM mail_jobs GROUP BY status;
```

After correcting a configuration problem, retry only reviewed failed jobs by their IDs. Do not blindly replay old subscriber confirmations or reset `sent` jobs.

## Checks

```bash
npm test -- --runInBand
# With npm run dev and PostgreSQL running:
npm run test:mail:local
```

The focused integration check uses Resend's `delivered+label@resend.dev` simulation address, tests real queue/API acceptance, idempotent confirmation, invalid-token rejection, and unsubscribe invalidation. It removes only its own local mail/subscription fixtures. The existing features suite uses these simulated recipients too. Development otherwise sends real email, so do not use invented recipient domains for delivery tests.

## Verified on 2026-11-13

The existing production service had no email-provider variables configured. The previous worker silently skipped delivery without `SMTP_HOST`, and its queue-level error handler discarded the underlying error code. The replacement has explicit configuration diagnostics and bounded provider/database error codes. Local review found 41 previously sent jobs and no pending/failed jobs; no old mail was replayed.

`chile2.cl` is verified in Resend with all four sender records verified. The key and sender were configured locally and on Railway and checked by redacted read-back. Mailpit was stopped and removed from Compose; the Nodemailer dependency was removed.

All 53 tests, TypeScript and ESLint passed. The focused local test passed through the actual worker and Resend. Railway deployment `fc717dcd-cfbd-434e-9cbc-7d02e0f74c02` reached `SUCCESS`, including the authorized UI updates. A production subscription to a Resend simulation address produced message `01a1d386-e2e4-705d-a0b2-3ddc740bae08`; Resend reported `delivered`. Its confirmation and unsubscribe links used `https://chile2.cl`, both actions returned 200, and the old confirmation token returned 404 after unsubscribe. That test subscription is inactive. No real recipient was used for this test. Health returned 200 and no queue errors appeared in the current deployment logs.
