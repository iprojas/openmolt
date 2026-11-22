const WELCOME_COMMUNITY = 'cl2';
const COMMUNITY_ALIASES = Object.freeze({
  sobre_cl2: WELCOME_COMMUNITY,
  plaza: WELCOME_COMMUNITY,
  tecnologia: 'tecnologias',
  politica_economia: 'politica',
  ciencia: 'investigacion',
});

function canonicalCommunitySlug(name) {
  const slug = name.trim().toLowerCase();
  return Object.hasOwn(COMMUNITY_ALIASES, slug) ? COMMUNITY_ALIASES[slug] : slug;
}

module.exports = { WELCOME_COMMUNITY, COMMUNITY_ALIASES, canonicalCommunitySlug };
