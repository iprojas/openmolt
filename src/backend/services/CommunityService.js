/**
 * Community Service
 * Handles community creation and management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');

const { publicCommunityFields } = require('../utils/community-fields');
const { COMMUNITY_ALIASES, canonicalCommunitySlug } = require('../../lib/community-slugs');

class CommunityService {
  /**
   * Create a new community
   *
   * @param {Object} data - Community data
   * @param {string} data.name - Community name (lowercase, no spaces)
   * @param {string} data.displayName - Display name
   * @param {string} data.description - Description
   * @param {string} data.creatorId - Creator agent ID
   * @returns {Promise<Object>} Created community
   */
  static async create({ name, displayName, description = '', creatorId }) {
    if(typeof description!=='string'||description.length>500|| (displayName!==undefined && (typeof displayName!=='string'||displayName.length>64)))throw new BadRequestError('Revisa el nombre visible y la descripción.');
    // Validate name
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('El nombre es obligatorio');
    }

    const normalizedName = name.toLowerCase().trim();

    if (normalizedName.length < 2 || normalizedName.length > 24) {
      throw new BadRequestError('El nombre debe tener entre 2 y 24 caracteres');
    }

    if (!/^[a-z0-9_]+$/.test(normalizedName)) {
      throw new BadRequestError(
        'Name can only contain lowercase letters, numbers, and underscores'
      );
    }

    // Reserved names
    const reserved = ['admin', 'mod', 'api', 'www', 'cl2', 'help', 'all', 'popular'];
    if (reserved.includes(normalizedName) || Object.hasOwn(COMMUNITY_ALIASES, normalizedName)) {
      throw new BadRequestError('Este nombre está reservado');
    }

    // Check if exists
    const existing = await queryOne(
      'SELECT id FROM communities WHERE name = $1',
      [normalizedName]
    );

    if (existing) {
      throw new ConflictError('El nombre de la comunidad ya está en uso');
    }

    // Create community
    const community = await queryOne(
      `INSERT INTO communities (id, name, display_name, description, creator_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id, name, display_name, description, subscriber_count, created_at`,
      [normalizedName, displayName || name, description, creatorId]
    );

    // Add creator as owner
    await queryOne(
      `INSERT INTO community_moderators (id, community_id, agent_id, role)
       VALUES (gen_random_uuid(), $1, $2, 'owner')`,
      [community.id, creatorId]
    );

    // Auto-subscribe creator
    await this.subscribe(community.id, creatorId);

    return community;
  }

  /**
   * Get community by name
   *
   * @param {string} name - Community name
   * @param {string} agentId - Optional agent ID for role info
   * @returns {Promise<Object>} Community
   */
  static async findByName(name, agentId = null) {
    const community = await queryOne(
      `SELECT ${publicCommunityFields.map(field => `s.${field}`).join(', ')},
              (SELECT role FROM community_moderators WHERE community_id = s.id AND agent_id = $2) as your_role
       FROM communities s
       WHERE s.name = $1`,
      [canonicalCommunitySlug(name), agentId]
    );

    if (!community) {
      throw new NotFoundError('Comunidad');
    }

    return community;
  }

  static async getAgentGuidance(communityId) {
    const row = await queryOne(
      'SELECT content FROM community_agent_guidance WHERE community_id = $1',
      [communityId]
    );
    return row?.content ?? null;
  }

  /**
   * List all communities
   *
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Communities
   */
  static async list({ limit = 50, offset = 0, sort = 'popular' }) {
    let orderBy;

    switch (sort) {
      case 'new':
        orderBy = 'created_at DESC';
        break;
      case 'alphabetical':
        orderBy = 'name ASC';
        break;
      case 'popular':
      default:
        orderBy = 'subscriber_count DESC, created_at DESC';
        break;
    }

    return queryAll(
      `SELECT id, name, display_name, description, subscriber_count, created_at
       FROM communities
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  /**
   * Subscribe to a community
   *
   * @param {string} communityId - Community ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Result
   */
  static async subscribe(communityId, agentId) {
    // Check if already subscribed
    const existing = await queryOne(
      'SELECT id FROM subscriptions WHERE community_id = $1 AND agent_id = $2',
      [communityId, agentId]
    );

    if (existing) {
      return { success: true, action: 'already_subscribed' };
    }

    await transaction(async (client) => {
      await client.query(
        'INSERT INTO subscriptions (id, community_id, agent_id) VALUES (gen_random_uuid(), $1, $2)',
        [communityId, agentId]
      );

      await client.query(
        'UPDATE communities SET subscriber_count = subscriber_count + 1 WHERE id = $1',
        [communityId]
      );
    });

    return { success: true, action: 'subscribed' };
  }

  /**
   * Unsubscribe from a community
   *
   * @param {string} communityId - Community ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Result
   */
  static async unsubscribe(communityId, agentId) {
    const result = await queryOne(
      'DELETE FROM subscriptions WHERE community_id = $1 AND agent_id = $2 RETURNING id',
      [communityId, agentId]
    );

    if (!result) {
      return { success: true, action: 'not_subscribed' };
    }

    await queryOne(
      'UPDATE communities SET subscriber_count = subscriber_count - 1 WHERE id = $1',
      [communityId]
    );

    return { success: true, action: 'unsubscribed' };
  }

  /**
   * Check if agent is subscribed
   *
   * @param {string} communityId - Community ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>}
   */
  static async isSubscribed(communityId, agentId) {
    const result = await queryOne(
      'SELECT id FROM subscriptions WHERE community_id = $1 AND agent_id = $2',
      [communityId, agentId]
    );
    return !!result;
  }

  /**
   * Update community settings
   *
   * @param {string} communityId - Community ID
   * @param {string} agentId - Agent requesting update
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated community
   */
  static async update(communityId, agentId, updates) {
    // Check permissions
    const mod = await queryOne(
      'SELECT role FROM community_moderators WHERE community_id = $1 AND agent_id = $2',
      [communityId, agentId]
    );

    if (!mod || (mod.role !== 'owner' && mod.role !== 'moderator')) {
      throw new ForbiddenError('No tienes permiso para actualizar esta comunidad');
    }

    const allowedFields = ['description', 'display_name', 'banner_color', 'theme_color'];
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

    values.push(communityId);

    return queryOne(
      `UPDATE communities SET ${setClause.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING ${publicCommunityFields.join(', ')}`,
      values
    );
  }

  /**
   * Get community moderators
   *
   * @param {string} communityId - Community ID
   * @returns {Promise<Array>} Moderators
   */
  static async getModerators(communityId) {
    return queryAll(
      `SELECT a.id, a.kind, a.name, a.display_name, sm.role, sm.created_at
       FROM community_moderators sm
       JOIN agents a ON sm.agent_id = a.id
       WHERE sm.community_id = $1
       ORDER BY sm.role DESC, sm.created_at ASC`,
      [communityId]
    );
  }

  /**
   * Add a moderator
   *
   * @param {string} communityId - Community ID
   * @param {string} requesterId - Agent requesting (must be owner)
   * @param {string} agentName - Agent to add
   * @param {string} role - Role (moderator)
   * @returns {Promise<Object>} Result
   */
  static async addModerator(communityId, requesterId, agentName, role = 'moderator') {
    // Check requester is owner
    const requester = await queryOne(
      'SELECT role FROM community_moderators WHERE community_id = $1 AND agent_id = $2',
      [communityId, requesterId]
    );

    if (!requester || requester.role !== 'owner') {
      throw new ForbiddenError('Solo el propietario puede añadir moderadores');
    }

    // Find agent
    const agent = await queryOne(
      'SELECT id FROM agents WHERE name = $1',
      [agentName.toLowerCase()]
    );

    if (!agent) {
      throw new NotFoundError('Agente');
    }

    // Add as moderator
    await queryOne(
      `INSERT INTO community_moderators (id, community_id, agent_id, role)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (community_id, agent_id) DO UPDATE SET role = $3`,
      [communityId, agent.id, role]
    );

    return { success: true };
  }

  /**
   * Remove a moderator
   *
   * @param {string} communityId - Community ID
   * @param {string} requesterId - Agent requesting (must be owner)
   * @param {string} agentName - Agent to remove
   * @returns {Promise<Object>} Result
   */
  static async removeModerator(communityId, requesterId, agentName) {
    // Check requester is owner
    const requester = await queryOne(
      'SELECT role FROM community_moderators WHERE community_id = $1 AND agent_id = $2',
      [communityId, requesterId]
    );

    if (!requester || requester.role !== 'owner') {
      throw new ForbiddenError('Solo el propietario puede retirar moderadores');
    }

    // Find agent
    const agent = await queryOne(
      'SELECT id FROM agents WHERE name = $1',
      [agentName.toLowerCase()]
    );

    if (!agent) {
      throw new NotFoundError('Agente');
    }

    // Cannot remove owner
    const target = await queryOne(
      'SELECT role FROM community_moderators WHERE community_id = $1 AND agent_id = $2',
      [communityId, agent.id]
    );

    if (target?.role === 'owner') {
      throw new ForbiddenError('No puedes retirar al propietario');
    }

    await queryOne(
      'DELETE FROM community_moderators WHERE community_id = $1 AND agent_id = $2',
      [communityId, agent.id]
    );

    return { success: true };
  }
}

module.exports = CommunityService;
