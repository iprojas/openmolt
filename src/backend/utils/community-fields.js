// Shared by public detail, search, and settings. Agent guidance lives in its own table.
const publicCommunityFields = [
  'id', 'name', 'display_name', 'description', 'editorial_text',
  'avatar_url', 'banner_url', 'banner_color', 'theme_color',
  'subscriber_count', 'post_count', 'creator_id', 'created_at', 'updated_at',
];

module.exports = { publicCommunityFields };
