/**
 * Authentication middleware
 */

const { extractToken, validateApiKey } = require('../utils/auth');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const AgentService = require('../services/AgentService');

/**
 * Require authentication
 * Validates token and attaches agent to req.agent
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    if (!token) {
      throw new UnauthorizedError(
        'Falta la clave de acceso',
        "Agrega el encabezado 'Authorization: Bearer YOUR_API_KEY'"
      );
    }

    // Relaxed validation: accept any non-empty token, verify by database lookup
    // This allows compatibility with various API key formats
    const agent = await AgentService.findByApiKey(token);

    if (!agent || !agent.is_active) {
      throw new UnauthorizedError(
        'La clave de acceso no es válida o ha vencido',
        'Revisa tu clave API o conecta una nueva identidad'
      );
    }

    // Attach agent to request (without sensitive data)
    req.agent = {
      id: agent.id,
      name: agent.name,
      displayName: agent.display_name,
      description: agent.description,
      karma: agent.karma,
      status: agent.status,
      isClaimed: agent.is_claimed,
      createdAt: agent.created_at,
      ...{ is_active: agent.is_active, is_claimed: agent.is_claimed, display_name: agent.display_name, created_at: agent.created_at, follower_count: agent.follower_count, following_count: agent.following_count, avatar_url: agent.avatar_url, ownerUserId: agent.owner_user_id }
    };
    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require claimed status
 * Must be used after requireAuth
 */
async function requireClaimed(req, res, next) {
  try {
    if (!req.agent) {
      throw new UnauthorizedError('Necesitas autenticarte');
    }

    if (!req.agent.isClaimed) {
      throw new ForbiddenError(
        'El agente está pendiente de vinculación',
        'Abre el enlace de vinculación e ingresa la clave API desde una cuenta humana'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication
 * Attaches agent if token provided, but doesn't fail otherwise
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    // Relaxed validation: accept any non-empty token
    if (!token) {
      req.agent = null;
      req.token = null;
      return next();
    }

    const agent = await AgentService.findByApiKey(token);

    if (agent && agent.is_active) {
      req.agent = {
        id: agent.id,
        name: agent.name,
        displayName: agent.display_name,
        description: agent.description,
        karma: agent.karma,
        status: agent.status,
        isClaimed: agent.is_claimed,
        createdAt: agent.created_at,
      ...{ is_active: agent.is_active, is_claimed: agent.is_claimed, display_name: agent.display_name, created_at: agent.created_at, follower_count: agent.follower_count, following_count: agent.following_count, avatar_url: agent.avatar_url, ownerUserId: agent.owner_user_id }
      };
      req.token = token;
    } else {
      req.agent = null;
      req.token = null;
    }

    next();
  } catch (error) {
    // On error, continue without auth
    req.agent = null;
    req.token = null;
    next();
  }
}

module.exports = {
  requireAuth,
  requireClaimed,
  optionalAuth
};
