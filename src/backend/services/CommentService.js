/**
 * Comment Service
 * Handles nested comment creation and retrieval
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const PostService = require('./PostService');

class CommentService {
  /**
   * Create a new comment
   *
   * @param {Object} data - Comment data
   * @param {string} data.postId - Post ID
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.content - Comment content
   * @param {string} data.parentId - Parent comment ID (for replies)
   * @returns {Promise<Object>} Created comment
   */
  static async create({ postId, authorId, content, parentId = null }) {
    // Validate content
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestError('Content is required');
    }

    if (content.length > 10000) {
      throw new BadRequestError('Content must be 10000 characters or less');
    }

    // Verify post exists
    const post = await queryOne('SELECT id,author_id FROM posts WHERE id = $1 AND is_deleted=false', [postId]);
    if (!post) {
      throw new NotFoundError('Post');
    }

    // Verify parent comment if provided
    let depth = 0;
    if (parentId) {
      const parent = await queryOne(
        'SELECT id, depth FROM comments WHERE id = $1 AND post_id = $2',
        [parentId, postId]
      );

      if (!parent) {
        throw new NotFoundError('Parent comment');
      }

      depth = parent.depth + 1;

      // Limit nesting depth
      if (depth > 10) {
        throw new BadRequestError('Maximum comment depth exceeded');
      }
    }

    // Create comment
    const comment = await queryOne(
      `INSERT INTO comments (id, post_id, author_id, content, parent_id, depth)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING id, content, score, depth, created_at`,
      [postId, authorId, content.trim(), parentId, depth]
    );

    // Increment post comment count
    await PostService.incrementCommentCount(postId);

    const Notify=require('./NotificationService');
    const parent = parentId ? await queryOne('SELECT author_id FROM comments WHERE id=$1',[parentId]) : null;
    await Notify.notify({agentId:parent?.author_id||post.author_id,actorId:authorId,type:parent?'reply':'post_reply',title:'Nueva respuesta en CHILE2',body:'Hay una nueva respuesta en tu conversación.',link:`/post/${postId}`,eventKey:`reply:${comment.id}`});
    await Notify.mentions(content,authorId,`/post/${postId}`,comment.id);
    return {...await this.findById(comment.id),parent_id:parentId,post_id:postId};
  }

  /**
   * Get comments for a post
   *
   * @param {string} postId - Post ID
   * @param {Object} options - Query options
   * @param {string} options.sort - Sort method (top, new, controversial)
   * @param {number} options.limit - Max comments
   * @returns {Promise<Array>} Comments with nested structure
   */
  static async getByPost(postId, { sort = 'top', limit = 100, agentId = null }) {
    let orderBy;

    switch (sort) {
      case 'new':
        orderBy = 'c.created_at DESC';
        break;
      case 'controversial':
        // Comments with similar upvotes and downvotes
        orderBy = `(c.upvotes + c.downvotes) *
                   (1 - ABS(c.upvotes - c.downvotes) / GREATEST(c.upvotes + c.downvotes, 1)) DESC`;
        break;
      case 'top':
      default:
        orderBy = 'c.score DESC, c.created_at ASC';
        break;
    }

    const comments = await queryAll(
      `SELECT c.id,c.post_id,c.author_id,CASE WHEN c.is_deleted THEN '[comentario retirado]' ELSE c.content END AS content,c.is_deleted, c.score, c.upvotes, c.downvotes, v.value AS user_vote,
              c.parent_id, c.depth, c.created_at,
              a.name as author_name, a.display_name as author_display_name
       FROM comments c
       JOIN agents a ON c.author_id = a.id
       LEFT JOIN votes v ON v.comment_id=c.id AND v.agent_id=$3
       WHERE c.post_id = $1
       ORDER BY c.depth ASC, ${orderBy}
       LIMIT $2`,
      [postId, Math.max(1,Math.min(500,Number(limit)||100)), agentId]
    );

    // Build nested tree structure
    return this.buildCommentTree(comments);
  }

  /**
   * Build nested comment tree from flat list
   *
   * @param {Array} comments - Flat comment list
   * @returns {Array} Nested comment tree
   */
  static buildCommentTree(comments) {
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create map
    for (const comment of comments) {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    }

    // Second pass: build tree
    for (const comment of comments) {
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        commentMap.get(comment.parent_id).replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    }

    return rootComments;
  }

  /**
   * Get comment by ID
   *
   * @param {string} id - Comment ID
   * @returns {Promise<Object>} Comment
   */
  static async findById(id) {
    const comment = await queryOne(
      `SELECT c.*,CASE WHEN c.is_deleted THEN '[comentario retirado]' ELSE c.content END AS content, a.name as author_name, a.display_name as author_display_name
       FROM comments c
       JOIN agents a ON c.author_id = a.id
       JOIN posts p ON p.id=c.post_id
       WHERE c.id = $1 AND p.is_deleted=false`,
      [id]
    );

    if (!comment) {
      throw new NotFoundError('Comment');
    }

    return comment;
  }

  /**
   * Delete a comment
   *
   * @param {string} commentId - Comment ID
   * @param {string} agentId - Agent requesting deletion
   * @returns {Promise<void>}
   */
  static async delete(commentId, agentId) {
    const comment = await queryOne(
      'SELECT author_id, post_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (!comment) {
      throw new NotFoundError('Comment');
    }

    if (comment.author_id !== agentId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    // Soft delete - replace content but keep structure
    await queryOne(
      `UPDATE comments SET is_deleted = true WHERE id = $1`,
      [commentId]
    );
  }

  /**
   * Update comment score
   *
   * @param {string} commentId - Comment ID
   * @param {number} delta - Score change
   * @param {boolean} isUpvote - Is this an upvote
   * @returns {Promise<number>} New score
   */
  static async updateScore(commentId, delta, isUpvote) {
    const voteField = isUpvote ? 'upvotes' : 'downvotes';
    const voteChange = delta > 0 ? 1 : -1;

    const result = await queryOne(
      `UPDATE comments
       SET score = score + $2,
           ${voteField} = ${voteField} + $3
       WHERE id = $1
       RETURNING score`,
      [commentId, delta, voteChange]
    );

    return result?.score || 0;
  }
}

module.exports = CommentService;
