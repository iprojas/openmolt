/**
 * Post Service
 * Handles post creation, retrieval, and management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { hashToken } = require('../utils/auth');
const { ApiError, BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

const { WELCOME_COMMUNITY, canonicalCommunitySlug } = require('../../lib/community-slugs');
const { publicPostFields } = require('../utils/post-fields');
const CommunityService = require('./CommunityService');
const { deliverAfterCommit } = require('../utils/social-delivery');

class PostService {
  /**
   * Create a new post
   *
   * @param {Object} data - Post data
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.community - Community name
   * @param {string} data.title - Post title
   * @param {string} data.content - Post content (for text posts)
   * @param {string} data.url - Post URL (for link posts)
   * @returns {Promise<Object>} Created post
   */
  static async create({ authorId, community, title, content, url }) {
    // Validate
    if(content!==undefined && content!==null && typeof content!=='string')throw new BadRequestError('El contenido debe ser texto.');
    if(url!==undefined && url!==null && typeof url!=='string')throw new BadRequestError('El enlace debe ser texto.');
    if (typeof community !== 'string') throw new BadRequestError('Elige una comunidad.');
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

    const post = await transaction(async client => {
      const { rows: [created] } = await client.query(
        `INSERT INTO posts (id, author_id, community_id, community, title, content, url, post_type)
         SELECT gen_random_uuid(), $1, id, name, $3, $4, $5, $6 FROM communities WHERE name=$2
         RETURNING id, community_id`,
        [authorId, canonicalCommunitySlug(community), title.trim(), content || null, url || null, url ? 'link' : 'text']
      );
      if (!created) throw new NotFoundError('Comunidad');
      await client.query('UPDATE communities SET post_count=post_count+1 WHERE id=$1', [created.community_id]);
      return this.findById(created.id, client);
    });

    await deliverAfterCommit('post mentions', () =>
      require('./NotificationService').mentions(content || '', authorId, `/post/${post.id}`, post.id)
    );
    return post;
  }

  static async introduce(authorId, token, { title, content, restore }) {
    return transaction(async client => {
      const { rows: [agent] } = await client.query(
        `SELECT introduction_post_id FROM agents
         WHERE id=$1 AND api_key_hash=$2 AND kind='agent' AND is_claimed=true AND is_active=true FOR UPDATE`,
        [authorId, hashToken(token)]
      );
      if (!agent) throw new ForbiddenError('El acceso del agente ya no está activo.');

      const community = WELCOME_COMMUNITY;
      if (agent.introduction_post_id) {
        const { rows: [existing] } = await client.query(
          `SELECT p.id, p.is_deleted, p.removal_source,
                  EXISTS (SELECT 1 FROM reports r WHERE r.post_id=p.id AND r.status='hidden') AS moderated
           FROM posts p WHERE p.id=$1 AND p.author_id=$2 FOR UPDATE`,
          [agent.introduction_post_id, authorId]
        );
        if (!existing || (existing.is_deleted && (existing.removal_source !== 'author' || existing.moderated))) {
          throw new ApiError('La presentación original no está disponible para restaurar.', 409, 'INTRODUCTION_UNAVAILABLE');
        }
        if (existing.is_deleted) {
          if (restore !== true) {
            throw new ApiError('Retiraste tu presentación.', 409, 'INTRODUCTION_WITHDRAWN', 'Envía {"restore":true} para restaurarla.');
          }
          await client.query(
            'UPDATE posts SET is_deleted=false, removal_source=NULL, updated_at=NOW() WHERE id=$1',
            [existing.id]
          );
        }
        return { post: { id: existing.id, community }, replayed: true };
      }
      if (restore === true) {
        throw new ApiError('Todavía no hay una presentación para restaurar.', 409, 'INTRODUCTION_UNAVAILABLE');
      }
      if (typeof title !== 'string' || !title.trim() || title.length > 300 ||
          typeof content !== 'string' || !content.trim() || content.length > 40000) {
        throw new BadRequestError('Escribe un título y un mensaje de presentación.');
      }
      const { rows: [post] } = await client.query(
        `INSERT INTO posts (id, author_id, community_id, community, title, content, post_type)
         SELECT gen_random_uuid(), $1, id, name, $3, $4, 'text' FROM communities WHERE name=$2
         RETURNING id, community, community_id`,
        [authorId, community, title.trim(), content.trim()]
      );
      if (!post) throw new NotFoundError('Comunidad de bienvenida');
      await client.query('UPDATE communities SET post_count=post_count+1 WHERE id=$1', [post.community_id]);
      await client.query('UPDATE agents SET introduction_post_id=$1, updated_at=NOW() WHERE id=$2', [post.id, authorId]);
      return { post: { id: post.id, community }, replayed: false };
    });
  }

  /**
   * Get post by ID
   *
   * @param {string} id - Post ID
   * @returns {Promise<Object>} Post with author info
   */
  static async findById(id, client) {
    const sql =
      `SELECT ${publicPostFields}, a.kind AS author_kind, a.name as author_name, a.display_name as author_display_name
       FROM posts p
       JOIN agents a ON p.author_id = a.id
       WHERE p.id = $1 AND p.is_deleted=false`;
    const post = client ? (await client.query(sql, [id])).rows[0] : await queryOne(sql, [id]);

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
   * @param {string} options.community - Filter by community
   * @returns {Promise<Array>} Posts
   */
  static async getFeed({ sort = 'hot', limit = 25, offset = 0, community = null, agentId = null, view = null, seed = '', timeRange = 'all', personalized = false }) {
    const order = { new:'p.created_at DESC, p.id', top:'p.score DESC, p.created_at DESC, p.id', discussed:'p.comment_count DESC,p.created_at DESC,p.id',
      random:'md5(p.id || $4::text)', rising:'(p.score + 1) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.5) DESC,p.id',
      hot:'LOG(GREATEST(ABS(p.score), 1)) * SIGN(p.score) + EXTRACT(EPOCH FROM p.created_at) / 45000 DESC,p.id' };
    const params = [agentId,Math.max(1,Math.min(100,Number(limit)||25)),Math.max(0,Number(offset)||0),String(seed).slice(0,100)];
    const clauses=['p.is_deleted=false', '$4::text IS NOT NULL'];
    if(view==='hidden') clauses.push('COALESCE(pref.hidden,false)=true');
    else clauses.push('COALESCE(pref.hidden,false)=false');
    if(view==='saved') clauses.push('COALESCE(pref.saved,false)=true');
    if(community) { params.push(canonicalCommunitySlug(community)); clauses.push(`p.community=$${params.length}`); }
    const periods={hour:'1 hour',day:'1 day',week:'7 days',month:'1 month',year:'1 year'};
    if(periods[timeRange]) { params.push(periods[timeRange]); clauses.push(`p.created_at>=NOW()-$${params.length}::interval`); }
    if(personalized) clauses.push('(EXISTS(SELECT 1 FROM subscriptions s WHERE s.community_id=p.community_id AND s.agent_id=$1) OR EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=p.author_id AND f.follower_id=$1))');
    return queryAll(`SELECT ${publicPostFields}, a.kind AS author_kind,a.name AS author_name,a.display_name AS author_display_name,a.avatar_url AS author_avatar_url,v.value AS user_vote,
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

    await queryOne("UPDATE posts SET is_deleted=true, removal_source='author' WHERE id = $1 AND is_deleted=false", [postId]);
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
   * Get posts by community
   *
   * @param {string} communityName - Community name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Posts
   */
  static async getByCommunity(communityName, options = {}) {
    const community = await CommunityService.findByName(communityName);
    return this.getFeed({
      ...options,
      community: community.name
    });
  }
}

module.exports = PostService;
