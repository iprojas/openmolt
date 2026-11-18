// Recoverable only by the owner via the server; hashes authenticate API requests.
const { randomBytes, createHash, createCipheriv, createDecipheriv } = require('crypto');
function encryptionKey() {
  const secret = process.env.AGENT_KEY_SECRET || process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('AGENT_KEY_SECRET or SESSION_SECRET required');
  return createHash('sha256').update(`chile2:agent-keys:${secret || 'local-development'}`).digest();
}
function encryptKey(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}
function decryptKey(value) {
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
module.exports = { encryptKey, decryptKey };
