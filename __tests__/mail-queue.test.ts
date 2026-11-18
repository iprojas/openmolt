/** @jest-environment node */
const { deliver } = require('../src/backend/services/MailService');
const { query, queryOne } = require('../src/backend/config/database');
jest.mock('../src/backend/config/database', () => ({ query: jest.fn(), queryOne: jest.fn() }));

describe('Resend durable queue', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.MAIL_FROM;
  const job = { id: 'job-test', recipient: 'delivered@resend.dev', subject: 'Confirmación', body: 'https://chile2.cl/newsletter/confirm?token=private-token', attempts: 1 };
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.RESEND_API_KEY = 'test-private-key';
    process.env.MAIL_FROM = 'CHILE2 <hola@chile2.cl>';
    queryOne.mockResolvedValueOnce(job).mockResolvedValue(null);
    query.mockResolvedValue({ rowCount: 1 });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalFrom === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = originalFrom;
  });

  it('sends the queued confirmation through HTTPS with a stable idempotency key', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'resend-test' }) });
    await deliver();
    const [url, options] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((options!.headers as Record<string, string>)['Idempotency-Key']).toBe('chile2-mail/job-test');
    expect(JSON.parse(options!.body as string)).toEqual({ from: process.env.MAIL_FROM, to: [job.recipient], subject: job.subject, text: job.body });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('sent_at=NOW()'), ['job-test', 'sent']);
  });

  it('retains jobs when mail is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    await deliver();
    expect(queryOne).not.toHaveBeenCalled();
  });

  it('retries network failures without logging addresses, tokens or keys', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('private-token test-private-key delivered@resend.dev'));
    await deliver();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('next_attempt_at'), ['job-test', 'pending', 2]);
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toMatch(/private-token|test-private-key|delivered@resend.dev/);
  });

  it('does not claim more jobs when Resend rate limits delivery', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ name: 'rate_limit_exceeded' }) });
    await deliver();
    expect(queryOne).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['job-test', 'pending', 2]);
  });

  it('marks permanent sender/configuration failures as failed instead of sent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ name: 'validation_error', message: 'private message' }) });
    await deliver();
    expect(query).toHaveBeenCalledWith(expect.any(String), ['job-test', 'failed', 2]);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: 'validation_error', status: 403 }));
  });

  it('stops retrying after the fifth transient failure', async () => {
    queryOne.mockReset().mockResolvedValueOnce({ ...job, attempts: 5 }).mockResolvedValue(null);
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    await deliver();
    expect(query).toHaveBeenCalledWith(expect.any(String), ['job-test', 'failed', 32]);
  });

  it('releases the local worker guard when claiming a job fails', async () => {
    queryOne.mockReset().mockRejectedValueOnce(Object.assign(new Error('db unavailable'), { code: 'ECONNREFUSED' }));
    await expect(deliver()).rejects.toThrow('db unavailable');
    queryOne.mockResolvedValue(null);
    await deliver();
    expect(queryOne).toHaveBeenCalledTimes(2);
  });
});
