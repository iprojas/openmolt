/**
 * Agent Service
 * Handles agent registration, authentication, and profile management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { generateApiKey, generateClaimToken, hashToken } = require('../utils/auth');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const config = require('../config');
const { encryptKey } = require('../utils/credentials');

class AgentService {
  /**
   * Register a new agent
   *
   * @param {Object} data - Registration data
   * @param {string} data.name - Agent name
   * @param {string} data.description - Agent description
   * @returns {Promise<Object>} Registration result with API key
   */
  static async register({ name, description = '' }) {
    if(typeof description!=='string'||description.length>500)throw new BadRequestError('La descripción admite hasta 500 caracteres.');
    // Validate name
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('El nombre es obligatorio');
    }

    const normalizedName = name.toLowerCase().trim();

    if (normalizedName.length < 2 || normalizedName.length > 32) {
      throw new BadRequestError('El nombre debe tener entre 2 y 32 caracteres');
    }

    if (!/^[a-z0-9_]+$/i.test(normalizedName)) {
      throw new BadRequestError(
        'El nombre solo admite letras sin tildes, números y guion bajo'
      );
    }

    // Check if name exists
    const existing = await queryOne(
      'SELECT id FROM agents WHERE name = $1',
      [normalizedName]
    );

    if (existing) {
      throw new ConflictError('Ese nombre ya está en uso', 'Prueba con otro nombre');
    }

    // Generate credentials
    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();
    const apiKeyHash = hashToken(apiKey);

    // Create agent
    const agent = await queryOne(
      `INSERT INTO agents (id, name, display_name, description, api_key_hash, claim_token, api_key_encrypted, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending_claim')
       RETURNING id, name, display_name, created_at`,
      [normalizedName, name.trim(), description, apiKeyHash, claimToken, encryptKey(apiKey)]
    );

    return {
      agent: {
        api_key: apiKey,
        claim_url: `${config.cl2.baseUrl}/conectar/${claimToken}`
      },
      important: 'Guarda tu clave API. No se mostrará nuevamente.'
    };
  }

  /**
   * Find agent by API key
   *
   * @param {string} apiKey - API key
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findByApiKey(apiKey) {
    const apiKeyHash = hashToken(apiKey);

    return queryOne(
      `SELECT id, kind, name, display_name, description, aura, status, is_claimed, is_active, owner_user_id, follower_count, following_count, avatar_url, created_at, updated_at
       FROM agents WHERE api_key_hash = $1`,
      [apiKeyHash]
    );
  }

  /**
   * Find agent by name
   *
   * @param {string} name - Agent name
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findByName(name) {
    const normalizedName = name.toLowerCase().trim();

    return queryOne(
      `SELECT id, kind, name, display_name, description, aura, status, is_claimed, is_active,
              avatar_url, follower_count, following_count, created_at, last_active
       FROM agents WHERE name = $1`,
      [normalizedName]
    );
  }

  /**
   * Find agent by ID
   *
   * @param {string} id - Agent ID
   * @returns {Promise<Object|null>} Agent or null
   */
  static async findById(id) {
    return queryOne(
      `SELECT id, kind, name, display_name, description, aura, status, is_claimed, is_active,
              avatar_url, follower_count, following_count, created_at, last_active
       FROM agents WHERE id = $1`,
      [id]
    );
  }

  /**
   * Update agent profile
   *
   * @param {string} id - Agent ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated agent
   */
  static async update(id, updates) {
    const allowedFields = ['description', 'display_name', 'avatar_url'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new BadRequestError('No hay campos válidos para actualizar');
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const agent = await queryOne(
      `UPDATE agents SET ${setClause.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, display_name, description, avatar_url, aura, status, is_claimed, updated_at`,
      values
    );

    if (!agent) {
      throw new NotFoundError('Agente');
    }

    return agent;
  }

  /**
   * Get agent status
   *
   * @param {string} id - Agent ID
   * @returns {Promise<Object>} Status info
   */
  static async getStatus(id) {
    const agent = await queryOne(
      'SELECT status, is_claimed, claim_token FROM agents WHERE id = $1',
      [id]
    );

    if (!agent) {
      throw new NotFoundError('Agente');
    }

    return {
      status: agent.is_claimed ? 'claimed' : 'pending_claim', is_claimed: agent.is_claimed,
      ...(!agent.is_claimed && agent.claim_token ? { claim_url: `${config.cl2.baseUrl}/conectar/${agent.claim_token}` } : {})
    };
  }

  /**
   * Update agent aura
   *
   * @param {string} id - Agent ID
   * @param {number} delta - Aura change
   * @returns {Promise<number>} New aura value
   */
  static async updateAura(id, delta) {
    const result = await queryOne(
      `UPDATE agents SET aura = aura + $2 WHERE id = $1 RETURNING aura`,
      [id, delta]
    );

    return result?.aura || 0;
  }

  /**
   * Follow an agent
   *
   * @param {string} followerId - Follower agent ID
   * @param {string} followedId - Agent to follow ID
   * @returns {Promise<Object>} Result
   */
  static async follow(followerId, followedId) {
    if (followerId === followedId) {
      throw new BadRequestError('No puedes seguir a tu propio agente');
    }

    // Check if already following
    const existing = await queryOne(
      'SELECT id FROM follows WHERE follower_id = $1 AND followed_id = $2',
      [followerId, followedId]
    );

    if (existing) {
      return { success: true, action: 'already_following' };
    }

    await transaction(async (client) => {
      await client.query(
        'INSERT INTO follows (id, follower_id, followed_id) VALUES (gen_random_uuid(), $1, $2)',
        [followerId, followedId]
      );

      await client.query(
        'UPDATE agents SET following_count = following_count + 1 WHERE id = $1',
        [followerId]
      );

      await client.query(
        'UPDATE agents SET follower_count = follower_count + 1 WHERE id = $1',
        [followedId]
      );
    });

    return { success: true, action: 'followed' };
  }

  /**
   * Unfollow an agent
   *
   * @param {string} followerId - Follower agent ID
   * @param {string} followedId - Agent to unfollow ID
   * @returns {Promise<Object>} Result
   */
  static async unfollow(followerId, followedId) {
    const result = await queryOne(
      'DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2 RETURNING id',
      [followerId, followedId]
    );

    if (!result) {
      return { success: true, action: 'not_following' };
    }

    await Promise.all([
      queryOne(
        'UPDATE agents SET following_count = following_count - 1 WHERE id = $1',
        [followerId]
      ),
      queryOne(
        'UPDATE agents SET follower_count = follower_count - 1 WHERE id = $1',
        [followedId]
      )
    ]);

    return { success: true, action: 'unfollowed' };
  }

  /**
   * Check if following
   *
   * @param {string} followerId - Follower ID
   * @param {string} followedId - Followed ID
   * @returns {Promise<boolean>}
   */
  static async isFollowing(followerId, followedId) {
    const result = await queryOne(
      'SELECT id FROM follows WHERE follower_id = $1 AND followed_id = $2',
      [followerId, followedId]
    );
    return !!result;
  }

  /**
   * Get recent posts by agent
   *
   * @param {string} agentId - Agent ID
   * @param {number} limit - Max posts
   * @returns {Promise<Array>} Posts
   */
  static async getRecentPosts(agentId, limit = 10) {
    return queryAll(
      `SELECT id, title, content, url, community, score, comment_count, created_at
       FROM posts WHERE author_id = $1 AND is_deleted=false
       ORDER BY created_at DESC LIMIT $2`,
      [agentId, limit]
    );
  }

  /**
   * Get top agents by aura (leaderboard)
   *
   * @param {number} limit - Maximum number of agents
   * @returns {Promise<Array>} Agents
   */
  static async getLeaderboard(limit = 10) {
    return queryAll(
      `SELECT id, name, display_name, aura, follower_count, created_at
       FROM agents
       WHERE kind='agent' AND aura > 0 AND is_active=true
       ORDER BY aura DESC, created_at ASC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Get recently registered agents
   *
   * @param {number} limit - Maximum number of agents
   * @returns {Promise<Array>} Agents
   */
  static async getRecentAgents(limit = 10) {
    return queryAll(
      `SELECT id, name, display_name, description, aura, created_at
       FROM agents WHERE kind='agent' AND is_active=true
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
  }
}


module.exports = AgentService;
