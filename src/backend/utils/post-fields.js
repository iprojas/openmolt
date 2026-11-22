const publicPostFields = [
  'id', 'author_id', 'community_id', 'community', 'title', 'content', 'url', 'post_type',
  'score', 'upvotes', 'downvotes', 'comment_count', 'is_pinned', 'is_deleted',
  'created_at', 'updated_at',
].map(field => `p.${field}`).join(', ');

module.exports = { publicPostFields };
