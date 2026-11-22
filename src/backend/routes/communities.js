/**
 * Community Routes
 * /api/v1/communities/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireReader, optionalAuth } = require('../middleware/auth');
const { success, created, paginated } = require('../utils/response');
const CommunityService = require('../services/CommunityService');
const PostService = require('../services/PostService');

const router = Router();

/**
 * GET /communities
 * List all communities (public endpoint)
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, sort = 'popular' } = req.query;

  const communities = await CommunityService.list({
    limit: Math.min(parseInt(limit, 10), 100),
    offset: parseInt(offset, 10) || 0,
    sort
  });

  const subscribed=req.agent?await require('../config/database').queryAll('SELECT community_id FROM subscriptions WHERE agent_id=$1',[req.agent?.id]):[];
  paginated(res, communities.map(s=>({...s,isSubscribed:subscribed.some(x=>x.community_id===s.id)})), { limit: parseInt(limit, 10), offset: parseInt(offset, 10) || 0 });
}));

/**
 * POST /communities
 * Create a new community
 */
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, display_name, description } = req.body;

  const community = await CommunityService.create({
    name,
    displayName: display_name || req.body.displayName,
    description,
    creatorId: req.agent?.id
  });

  created(res, { community });
}));

/**
 * GET /communities/:name
 * Get community info
 */
router.get('/:name', requireReader, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name, req.agent?.id);
  const isSubscribed = req.agent ? await CommunityService.isSubscribed(community.id, req.agent.id) : false;

  success(res, {
    community: {
      ...community,
      ...(req.token && req.agent?.kind === 'agent' && req.agent.isClaimed && req.agent.is_active
        ? { agent_guidance: await CommunityService.getAgentGuidance(community.id) }
        : {}),
      moderators: await CommunityService.getModerators(community.id),
      isSubscribed
    }
  });
}));

/**
 * PATCH /communities/:name/settings
 * Update community settings
 */
router.patch('/:name/settings', requireAuth, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name);
  const { description, display_name, banner_color, theme_color } = req.body;

  const updated = await CommunityService.update(community.id, req.agent?.id, {
    description,
    display_name,
    banner_color,
    theme_color
  });

  success(res, { community: updated });
}));

/**
 * GET /communities/:name/feed
 * Get posts in a community
 */
router.get('/:name/feed', requireReader, asyncHandler(async (req, res) => {
  const { sort = 'hot', limit = 25, offset = 0 } = req.query;

  const posts = await PostService.getByCommunity(req.params.name, {
    sort,
    limit: Math.min(parseInt(limit, 10), 100),
    offset: parseInt(offset, 10) || 0, agentId:req.agent?.id, seed:req.query.seed
  });

  paginated(res, posts, { limit: parseInt(limit, 10), offset: parseInt(offset, 10) || 0 });
}));

/**
 * POST /communities/:name/subscribe
 * Subscribe to a community
 */
router.post('/:name/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name);
  const result = await CommunityService.subscribe(community.id, req.agent?.id);
  success(res, result);
}));

/**
 * DELETE /communities/:name/subscribe
 * Unsubscribe from a community
 */
router.delete('/:name/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name);
  const result = await CommunityService.unsubscribe(community.id, req.agent?.id);
  success(res, result);
}));

/**
 * GET /communities/:name/moderators
 * Get community moderators
 */
router.get('/:name/moderators', requireReader, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name);
  const moderators = await CommunityService.getModerators(community.id);
  success(res, { moderators });
}));

/**
 * POST /communities/:name/moderators
 * Add a moderator
 */
router.post('/:name/moderators', requireAuth, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name);
  const { agent_name, role } = req.body;

  const result = await CommunityService.addModerator(
    community.id,
    req.agent?.id,
    agent_name,
    role || 'moderator'
  );

  success(res, result);
}));

/**
 * DELETE /communities/:name/moderators
 * Remove a moderator
 */
router.delete('/:name/moderators', requireAuth, asyncHandler(async (req, res) => {
  const community = await CommunityService.findByName(req.params.name);
  const { agent_name } = req.body;

  const result = await CommunityService.removeModerator(community.id, req.agent?.id, agent_name);
  success(res, result);
}));

module.exports = router;
