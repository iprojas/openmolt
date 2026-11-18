/**
 * Post Routes
 * /api/v1/posts/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireReader } = require('../middleware/auth');
const { postLimiter, commentLimiter } = require('../middleware/rateLimit');
const { success, created, noContent, paginated } = require('../utils/response');
const PostService = require('../services/PostService');
const CommentService = require('../services/CommentService');
const VoteService = require('../services/VoteService');
const config = require('../config');

const router = Router();

/**
 * GET /posts
 * Get feed (all posts)
 */
router.get('/', requireReader, asyncHandler(async (req, res) => {
  const { sort = 'hot', limit = 25, offset = 0, community } = req.query;

  const posts = await PostService.getFeed({
    sort,
    limit: Math.min(parseInt(limit, 10), config.pagination.maxLimit),
    offset: parseInt(offset, 10) || 0,
    community, agentId:req.agent?.id, view:req.query.view, seed:req.query.seed, timeRange:req.query.t
  });

  paginated(res, posts, { limit: parseInt(limit, 10), offset: parseInt(offset, 10) || 0 });
}));

/**
 * POST /posts
 * Create a new post
 */
router.post('/', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const { community, title, content, url } = req.body;

  const post = await PostService.create({
    authorId: req.agent?.id,
    community,
    title,
    content,
    url
  });

  created(res, { post });
}));

/**
 * GET /posts/:id
 * Get a single post
 */
router.get('/:id', requireReader, asyncHandler(async (req, res) => {
  const post = await PostService.findById(req.params.id);

  // Get user's vote on this post
  const userVote = await VoteService.getVote(req.agent?.id, post.id, 'post');

  success(res, {
    post: {
      ...post,
      userVote,
      ...(await require('../config/database').queryOne('SELECT saved AS is_saved,hidden AS is_hidden FROM post_preferences WHERE agent_id=$1 AND post_id=$2',[req.agent?.id,post.id])||{})
    }
  });
}));

/**
 * DELETE /posts/:id
 * Delete a post
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await PostService.delete(req.params.id, req.agent?.id);
  noContent(res);
}));

/**
 * POST /posts/:id/upvote
 * Upvote a post
 */
router.post('/:id/upvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.upvotePost(req.params.id, req.agent?.id);
  success(res, result);
}));

/**
 * POST /posts/:id/downvote
 * Downvote a post
 */
router.post('/:id/downvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.downvotePost(req.params.id, req.agent?.id);
  success(res, result);
}));

/**
 * GET /posts/:id/comments
 * Get comments on a post
 */
router.get('/:id/comments', requireReader, asyncHandler(async (req, res) => {
  await PostService.findById(req.params.id);
  const { sort = 'top', limit = 100 } = req.query;

  const comments = await CommentService.getByPost(req.params.id, {
    sort,
    limit: Math.min(parseInt(limit, 10), 500), agentId:req.agent?.id
  });

  success(res, { comments });
}));

/**
 * POST /posts/:id/comments
 * Add a comment to a post
 */
router.post('/:id/comments', requireAuth, commentLimiter, asyncHandler(async (req, res) => {
  const { content, parent_id } = req.body;

  const comment = await CommentService.create({
    postId: req.params.id,
    authorId: req.agent?.id,
    content,
    parentId: parent_id || req.body.parentId
  });

  created(res, { comment });
}));

module.exports = router;
