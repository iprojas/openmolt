const { extractToken } = require('../utils/auth');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const AgentService = require('../services/AgentService');
const { queryOne } = require('../config/database');
const config = require('../config');

function publicParticipant(row) {
  return {
    id: row.id, name: row.name, kind: row.kind, displayName: row.display_name,
    description: row.description, aura: row.aura, status: row.status,
    isClaimed: row.is_claimed, createdAt: row.created_at, avatarUrl: row.avatar_url,
    is_active: row.is_active, is_claimed: row.is_claimed, display_name: row.display_name,
    created_at: row.created_at, follower_count: row.follower_count,
    following_count: row.following_count, avatar_url: row.avatar_url,
  };
}
async function authenticate(req, allowPending = false) {
  let row;
  if (req.headers.authorization) {
    const token = extractToken(req.headers.authorization);
    if (!token) throw new UnauthorizedError('Clave API no válida.');
    row = await AgentService.findByApiKey(token);
    if (!row || row.kind !== 'agent' || !row.is_active) throw new UnauthorizedError('Clave API no válida o agente desactivado.');
    if (!allowPending && !row.is_claimed) throw new ForbiddenError('Tu humano debe abrir el enlace de vinculación antes de participar.');
    req.token = token;
  } else {
    const cookie = (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith('session='));
    if (!cookie) throw new UnauthorizedError('Inicia sesión con Google.');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin !== new URL(config.cl2.baseUrl).origin) throw new ForbiddenError('Origen no permitido.');
    }
    try {
      const { jwtVerify } = await import('jose');
      const secret = process.env.SESSION_SECRET || (config.isProduction ? null : 'default-secret-change-this-in-production');
      if (!secret) throw new Error('SESSION_SECRET required');
      const { payload } = await jwtVerify(decodeURIComponent(cookie.slice(8)), new TextEncoder().encode(secret), { algorithms: ['HS256'] });
      row = await queryOne(`SELECT a.* FROM agents a JOIN users u ON u.id=a.human_user_id WHERE u.id=$1 AND a.kind='human' AND a.is_active=true`, [payload.userId]);
    } catch { throw new UnauthorizedError('La sesión humana ya no es válida.'); }
    if (!row) throw new UnauthorizedError('La sesión humana ya no es válida.');
  }
  req.agent = publicParticipant(row); // Existing services share the participant record.
}
async function requireAuth(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  try { await authenticate(req); next(); } catch (error) { next(error); }
}
async function requireAgent(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  try {
    if (!req.headers.authorization) throw new UnauthorizedError('Usa la clave API del agente.');
    await authenticate(req, true); next();
  } catch (error) { next(error); }
}
async function optionalAuth(req, res, next) {
  if (req.headers.cookie || req.headers.authorization) res.set('Cache-Control', 'private, no-store');
  try { await authenticate(req, true); } catch { req.agent = null; }
  next();
}
module.exports = { requireAuth, requireReader: requireAuth, requireAgent, optionalAuth };
