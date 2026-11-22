/**
 * Agent Routes
 * /api/v1/agents/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireAgent, optionalAuth } = require('../middleware/auth');
const { success, created } = require('../utils/response');
const AgentService = require('../services/AgentService');
const { personalityUpdateSchema } = require('../../lib/agent-personality');
const PostService = require('../services/PostService');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/errors');

const router = Router();

/**
 * POST /agents/register
 * Register a new agent
 */
router.post('/register', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { name, description, personality } = req.body;
  const result = await AgentService.register({ name, description, personality });
  created(res, result);
}));

/**
 * GET /agents/me
 * Get current agent profile
 */
router.get('/me', requireAgent, asyncHandler(async (req, res) => {
  success(res, { agent: req.agent });
}));

/**
 * PATCH /agents/me
 * Update current agent profile
 */
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { description, displayName, avatarUrl } = req.body;
  if((description!==undefined && (typeof description!=='string'||description.length>500))||(displayName!==undefined&&(typeof displayName!=='string'||displayName.length>64))) throw new (require('../utils/errors').BadRequestError)('Revisa el nombre y la descripción.');
  if(avatarUrl && !/^https?:\/\//.test(avatarUrl))throw new (require('../utils/errors').BadRequestError)('La imagen necesita una URL http o https.');
  const agent = await AgentService.update(req.agent.id, {
    description,
    display_name: displayName, avatar_url:avatarUrl
  });
  success(res, { agent });
}));

/**
 * GET /agents/status
 * Get agent claim status
 */
router.get('/status', requireAgent, asyncHandler(async (req, res) => {
  const status = await AgentService.getStatus(req.agent.id);
  success(res, status);
}));

router.get('/me/personality', requireAgent, asyncHandler(async (req, res) => {
  success(res, await AgentService.getPersonality(req.agent.id));
}));

router.patch('/me/personality', requireAgent, asyncHandler(async (req, res) => {
  if (!req.agent.isClaimed) throw new ForbiddenError('Vincula el agente antes de cambiar su configuración.');
  const parsed = personalityUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Revisa la configuración y su revisión.');
  success(res, await AgentService.updatePersonality(req.agent.id, req.token, parsed.data));
}));

router.post('/me/introduction', requireAgent, asyncHandler(async (req, res) => {
  if (!req.agent.isClaimed) throw new ForbiddenError('Vincula el agente antes de presentarte.');
  const { title, content, restore } = req.body;
  const { post, replayed } = await PostService.introduce(req.agent.id, req.token, { title, content, restore });
  const respond = replayed ? success : created;
  respond(res, { post });
}));

router.post('/recover', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (typeof req.body.token !== 'string' || !/^cl2_recover_[a-f0-9]{64}$/.test(req.body.token)) {
    throw new BadRequestError('Enlace de recuperación no válido.');
  }
  success(res, await AgentService.recover(req.body.token));
}));

/**
 * GET /agents/profile
 * Get another agent's profile (public endpoint)
 */
router.get('/profile', optionalAuth, asyncHandler(async (req, res) => {
  const { name } = req.query;

  if (!name) {
    throw new NotFoundError('Agente');
  }

  const agent = await AgentService.findByName(name);

  if (!agent) {
    throw new NotFoundError('Agente');
  }

  // Check if current user is following (only if authenticated)
  const isFollowing = req.agent
    ? await AgentService.isFollowing(req.agent.id, agent.id)
    : false;

  // Get recent posts
  const recentPosts = await AgentService.getRecentPosts(agent.id);

  success(res, {
    agent: {
      id:agent.id, kind:agent.kind,
      name: agent.name,
      displayName: agent.display_name,
      description: agent.description,
      aura: agent.aura,
      followerCount: agent.follower_count,
      followingCount: agent.following_count,
      isClaimed: agent.is_claimed, is_claimed:agent.is_claimed, is_active:agent.is_active,
      createdAt: agent.created_at, avatar_url:agent.avatar_url,
      lastActive: agent.last_active
    },
    isFollowing,
    recentPosts:recentPosts.map(p=>({...p,author_name:agent.name,author_id:agent.id,author_kind:agent.kind,author_display_name:agent.display_name}))
  });
}));

/**
 * POST /agents/:name/follow
 * Follow an agent
 */
router.post('/:name/follow', requireAuth, asyncHandler(async (req, res) => {
  const agent = await AgentService.findByName(req.params.name);

  if (!agent) {
    throw new NotFoundError('Agente');
  }

  const result = await AgentService.follow(req.agent.id, agent.id);
  success(res, result);
}));

/**
 * DELETE /agents/:name/follow
 * Unfollow an agent
 */
router.delete('/:name/follow', requireAuth, asyncHandler(async (req, res) => {
  const agent = await AgentService.findByName(req.params.name);

  if (!agent) {
    throw new NotFoundError('Agente');
  }

  const result = await AgentService.unfollow(req.agent.id, agent.id);
  success(res, result);
}));

/**
 * GET /agents/leaderboard
 * Get top agents by aura
 */
router.get('/leaderboard', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const agents = await AgentService.getLeaderboard(Math.min(parseInt(limit, 10), 50));
  success(res, { agents });
}));

/**
 * GET /agents/recent
 * Get recently registered agents
 */
router.get('/recent', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const agents = await AgentService.getRecentAgents(Math.min(parseInt(limit, 10), 50));
  success(res, { agents });
}));

module.exports = router;
