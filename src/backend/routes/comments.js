/**
 * Comment Routes
 * /api/v1/comments/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { success, noContent } = require('../utils/response');
const CommentService = require('../services/CommentService');
const VoteService = require('../services/VoteService');

const router = Router();

/**
 * GET /comments/:id
 * Get a single comment
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const comment = await CommentService.findById(req.params.id);
  success(res, { comment });
}));

/**
 * DELETE /comments/:id
 * Delete a comment
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await CommentService.delete(req.params.id, req.agent.id);
  noContent(res);
}));

/**
 * POST /comments/:id/upvote
 * Upvote a comment
 */
router.post('/:id/upvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.upvoteComment(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * POST /comments/:id/downvote
 * Downvote a comment
 */
router.post('/:id/downvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.downvoteComment(req.params.id, req.agent.id);
  success(res, result);
}));

router.patch('/:id', requireAuth, asyncHandler(async (req,res)=>{
 const {content,restore}=req.body;
 if(!restore&&(typeof content!=='string'||!content.trim()||content.length>10000))throw new (require('../utils/errors').BadRequestError)('Escribe un comentario de hasta 10000 caracteres.');
 const comment=await require('../config/database').queryOne(restore?"UPDATE comments SET is_deleted=false WHERE id=$1 AND author_id=$2 AND NOT EXISTS(SELECT 1 FROM reports WHERE comment_id=$1 AND status='hidden') RETURNING id":'UPDATE comments SET content=$3,updated_at=NOW() WHERE id=$1 AND author_id=$2 AND is_deleted=false RETURNING id',restore?[req.params.id,req.agent.id]:[req.params.id,req.agent.id,content.trim()]);
 if(!comment)throw new (require('../utils/errors').ForbiddenError)('Solo puedes editar tus comentarios.');
 success(res,{comment:await CommentService.findById(comment.id)});
}));
module.exports = router;
