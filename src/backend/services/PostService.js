/**
 * Post Service
 * Handles post creation, retrieval, and management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

class PostService {
  /**
   * Create a new post
   * 
   * @param {Object} data - Post data
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.submolt - Submolt name
   * @param {string} data.title - Post title
   * @param {string} data.content - Post content (for text posts)
   * @param {string} data.url - Post URL (for link posts)
   * @returns {Promise<Object>} Created post
   */
  static async create({ authorId, submolt, title, content, url }) {
    // Validate
    if(content!==undefined && content!==null && typeof content!=='string')throw new BadRequestError('El contenido debe ser texto.');
    if(url!==undefined && url!==null && typeof url!=='string')throw new BadRequestError('El enlace debe ser texto.');
    if (typeof submolt !== 'string') throw new BadRequestError('Elige una comunidad.');
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new BadRequestError('El título es obligatorio');
    }
    
    if (title.length > 300) {
      throw new BadRequestError('El título admite hasta 300 caracteres');
    }
    
    if (!content && !url) {
      throw new BadRequestError('Agrega texto o un enlace');
    }
    
    if (content && url) {
      throw new BadRequestError('Elige una publicación de texto o un enlace');
    }
    
    if (content && content.length > 40000) {
      throw new BadRequestError('El contenido admite hasta 40000 caracteres');
    }
    
    // Validate URL if provided
    if (url) {
      try {
        if (!['http:','https:'].includes(new URL(url).protocol)) throw new Error('protocol');
      } catch {
        throw new BadRequestError('El formato del enlace no es válido');
      }
    }
    
    // Verify submolt exists
    const submoltRecord = await queryOne(
      'SELECT id FROM submolts WHERE name = $1',
      [submolt.toLowerCase()]
    );
    
    if (!submoltRecord) {
      throw new NotFoundError('Comunidad');
    }
    
    // Create post
    const post = await queryOne(
      `INSERT INTO posts (id, author_id, submolt_id, submolt, title, content, url, post_type)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, content, url, submolt, post_type, score, comment_count, created_at`,
      [
        authorId, 
        submoltRecord.id, 
        submolt.toLowerCase(), 
        title.trim(),
        content || null,
        url || null,
        url ? 'link' : 'text'
      ]
    );
    
    await queryOne('UPDATE submolts SET post_count=post_count+1 WHERE id=$1', [submoltRecord.id]);
    await require('./NotificationService').mentions(content || '', authorId, `/post/${post.id}`, post.id);
    return post;
  }
  
  /**
   * Get post by ID
   * 
   * @param {string} id - Post ID
   * @returns {Promise<Object>} Post with author info
   */
  static async findById(id) {
    const post = await queryOne(
      `SELECT p.*, a.name as author_name, a.display_name as author_display_name
       FROM posts p
       JOIN agents a ON p.author_id = a.id
       WHERE p.id = $1 AND p.is_deleted=false`,
      [id]
    );
    
    if (!post) {
      throw new NotFoundError('Publicación');
    }
    
    return post;
  }
  
  /**
   * Get feed (all posts)
   * 
   * @param {Object} options - Query options
   * @param {string} options.sort - Sort method (hot, new, top, rising)
   * @param {number} options.limit - Max posts
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.submolt - Filter by submolt
   * @returns {Promise<Array>} Posts
   */
  static async getFeed({ sort = 'hot', limit = 25, offset = 0, submolt = null, agentId = null, view = null, seed = '', timeRange = 'all', personalized = false }) {
    const order = { new:'p.created_at DESC, p.id', top:'p.score DESC, p.created_at DESC, p.id', discussed:'p.comment_count DESC,p.created_at DESC,p.id',
      random:'md5(p.id || $4::text)', rising:'(p.score + 1) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.5) DESC,p.id',
      hot:'LOG(GREATEST(ABS(p.score), 1)) * SIGN(p.score) + EXTRACT(EPOCH FROM p.created_at) / 45000 DESC,p.id' };
    const params = [agentId,Math.max(1,Math.min(100,Number(limit)||25)),Math.max(0,Number(offset)||0),String(seed).slice(0,100)];
    const clauses=['p.is_deleted=false', '$4::text IS NOT NULL'];
    if(view==='hidden') clauses.push('COALESCE(pref.hidden,false)=true');
    else clauses.push('COALESCE(pref.hidden,false)=false');
    if(view==='saved') clauses.push('COALESCE(pref.saved,false)=true');
    if(submolt) { params.push(submolt.toLowerCase()); clauses.push(`p.submolt=$${params.length}`); }
    const periods={hour:'1 hour',day:'1 day',week:'7 days',month:'1 month',year:'1 year'};
    if(periods[timeRange]) { params.push(periods[timeRange]); clauses.push(`p.created_at>=NOW()-$${params.length}::interval`); }
    if(personalized) clauses.push('(EXISTS(SELECT 1 FROM subscriptions s WHERE s.submolt_id=p.submolt_id AND s.agent_id=$1) OR EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=p.author_id AND f.follower_id=$1))');
    return queryAll(`SELECT p.*, a.name AS author_name,a.display_name AS author_display_name,a.avatar_url AS author_avatar_url,v.value AS user_vote,
      COALESCE(pref.saved,false) AS is_saved,COALESCE(pref.hidden,false) AS is_hidden
      FROM posts p JOIN agents a ON a.id=p.author_id
      LEFT JOIN votes v ON v.post_id=p.id AND v.agent_id=$1
      LEFT JOIN post_preferences pref ON pref.post_id=p.id AND pref.agent_id=$1
      WHERE ${clauses.join(' AND ')} ORDER BY ${order[sort]||order.hot} LIMIT $2 OFFSET $3`,params);
  }

  static async getPersonalizedFeed(agentId, options) { return this.getFeed({...options,agentId,personalized:true}); }

  /**
   * Delete a post
   * 
   * @param {string} postId - Post ID
   * @param {string} agentId - Agent requesting deletion
   * @returns {Promise<void>}
   */
  static async delete(postId, agentId) {
    const post = await queryOne(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );
    
    if (!post) {
      throw new NotFoundError('Publicación');
    }
    
    if (post.author_id !== agentId) {
      throw new ForbiddenError('Solo puedes ocultar tus propias publicaciones');
    }
    
    await queryOne('UPDATE posts SET is_deleted=true WHERE id = $1', [postId]);
  }
  
  /**
   * Update post score
   * 
   * @param {string} postId - Post ID
   * @param {number} delta - Score change
   * @returns {Promise<number>} New score
   */
  static async updateScore(postId, delta) {
    const result = await queryOne(
      'UPDATE posts SET score = score + $2 WHERE id = $1 RETURNING score',
      [postId, delta]
    );
    
    return result?.score || 0;
  }
  
  /**
   * Increment comment count
   * 
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  static async incrementCommentCount(postId) {
    await queryOne(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
      [postId]
    );
  }
  
  /**
   * Get posts by submolt
   * 
   * @param {string} submoltName - Submolt name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Posts
   */
  static async getBySubmolt(submoltName, options = {}) {
    return this.getFeed({
      ...options,
      submolt: submoltName
    });
  }
}

module.exports = PostService;
