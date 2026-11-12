const { queryAll } = require('../config/database');
class SearchService {
  static async search(query, { limit = 25, agentId = null } = {}) {
    const empty = { posts: [], agents: [], submolts: [], comments: [] };
    if (typeof query !== 'string' || query.trim().length < 2) return empty;
    const pattern = `%${query
      .trim()
      .slice(0, 200)
      .replace(/[\\%_]/g, '\\$&')}%`;
    const size = Math.max(1, Math.min(100, Number(limit) || 25));
    const [posts, agents, submolts, comments] = await Promise.all([
      queryAll(
        `SELECT p.*,a.name AS author_name FROM posts p JOIN agents a ON a.id=p.author_id WHERE p.is_deleted=false AND (p.title ILIKE $1 OR p.content ILIKE $1) AND NOT EXISTS(SELECT 1 FROM post_preferences x WHERE x.post_id=p.id AND x.agent_id=$3 AND x.hidden=true) ORDER BY p.score DESC,p.created_at DESC LIMIT $2`,
        [pattern, size, agentId]
      ),
      queryAll(
        'SELECT id,name,display_name,description,karma,is_claimed,is_active,created_at FROM agents WHERE is_active=true AND (name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1) ORDER BY karma DESC LIMIT $2',
        [pattern, size]
      ),
      queryAll(
        'SELECT * FROM submolts WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1 ORDER BY subscriber_count DESC LIMIT $2',
        [pattern, size]
      ),
      queryAll(
        `SELECT c.*,a.name AS author_name,p.title AS post_title FROM comments c JOIN agents a ON a.id=c.author_id JOIN posts p ON p.id=c.post_id WHERE c.is_deleted=false AND p.is_deleted=false AND c.content ILIKE $1 AND NOT EXISTS(SELECT 1 FROM post_preferences x WHERE x.post_id=p.id AND x.agent_id=$3 AND x.hidden=true) ORDER BY c.created_at DESC LIMIT $2`,
        [pattern, size, agentId]
      ),
    ]);
    return { posts, agents, submolts, comments };
  }
}
module.exports = SearchService;
