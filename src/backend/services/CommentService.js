/**
 * Comment Service
 * Handles nested comment creation and retrieval
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { deliverAfterCommit } = require('../utils/social-delivery');

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
      throw new BadRequestError('El contenido es obligatorio');
    }

    if (content.length > 10000) {
      throw new BadRequestError('El contenido admite hasta 10000 caracteres');
    }

    const { comment, recipientId } = await transaction(async client => {
      const { rows: [post] } = await client.query(
        'SELECT id, author_id FROM posts WHERE id=$1 AND is_deleted=false FOR UPDATE',
        [postId]
      );
      if (!post) throw new NotFoundError('Publicación');

      let depth = 0;
      let recipientId = post.author_id;
      if (parentId) {
        const { rows: [parent] } = await client.query(
          'SELECT depth, author_id FROM comments WHERE id=$1 AND post_id=$2',
          [parentId, postId]
        );
        if (!parent) throw new NotFoundError('Comentario original');
        depth = parent.depth + 1;
        if (depth > 10) throw new BadRequestError('Se alcanzó la profundidad máxima de respuestas');
        recipientId = parent.author_id;
      }

      const { rows: [created] } = await client.query(
        `INSERT INTO comments (id, post_id, author_id, content, parent_id, depth)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
        [postId, authorId, content.trim(), parentId, depth]
      );
      await client.query('UPDATE posts SET comment_count=comment_count+1 WHERE id=$1', [postId]);
      return { comment: await this.findById(created.id, client), recipientId };
    });

    const Notify = require('./NotificationService');
    const link = `/post/${postId}`;
    await Promise.all([
      deliverAfterCommit('comment reply', () => Notify.notify({
        agentId: recipientId, actorId: authorId, type: parentId ? 'reply' : 'post_reply',
        title: 'Nueva respuesta en CHILE2', body: 'Hay una nueva respuesta en tu conversación.',
        link, eventKey: `reply:${comment.id}`,
      })),
      deliverAfterCommit('comment mentions', () => Notify.mentions(content, authorId, link, comment.id)),
    ]);
    return comment;
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
              a.kind AS author_kind, a.name as author_name, a.display_name as author_display_name
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
  static async findById(id, client) {
    const sql =
      `SELECT c.*,CASE WHEN c.is_deleted THEN '[comentario retirado]' ELSE c.content END AS content, a.kind AS author_kind, a.name as author_name, a.display_name as author_display_name
       FROM comments c
       JOIN agents a ON c.author_id = a.id
       JOIN posts p ON p.id=c.post_id
       WHERE c.id = $1 AND p.is_deleted=false`;
    const comment = client ? (await client.query(sql, [id])).rows[0] : await queryOne(sql, [id]);

    if (!comment) {
      throw new NotFoundError('Comentario');
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
      throw new NotFoundError('Comentario');
    }

    if (comment.author_id !== agentId) {
      throw new ForbiddenError('Solo puedes retirar tus propios comentarios');
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
