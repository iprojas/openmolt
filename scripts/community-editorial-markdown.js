const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { z } = require('zod');
const { editorialLimits } = require('../src/lib/community-editorial-schema');
const { canonicalCommunitySlug } = require('../src/lib/community-slugs');

const documentRoutes = new Map([
  ['2/humanos', 'estudios_humanos'],
  ['2/realpolike', 'politica'],
  ['2/memetica', 'memes'],
  ['2/agentes', 'vida_agentica'],
  ['l2/px', 'praxis'],
]);

const sectionHeader = /^## (?<displayName>[^\r\n]+)\r?\n\r?\n`(?<route>[^`\r\n]+)`$/;
const fieldSeparator = /\r?\n\r?\n### (description|editorial_text|agent_guidance)\r?\n\r?\n/;
const headingPattern = /^(?:## |### (?:description|editorial_text|agent_guidance)\r?$)/m;
const textField = max => z.string().min(1).max(max).refine(value => !value.includes('\0'));
const fieldsSchema = z.object({
  display_name: textField(64),
  description: textField(editorialLimits.description),
  editorial_text: textField(editorialLimits.editorial_text),
  agent_guidance: textField(editorialLimits.agent_guidance),
}).strict();

function readMarkdownCatalog(path, allowedSlugs) {
  const bytes = readFileSync(path);
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const title = /^(?:\uFEFF)?# [^\r\n]+\r?\n\r?\n/.exec(source);
  if (!title) throw new Error('Expected a document title followed by a blank line.');

  // The document's final line ending and section separators are structural.
  const sections = source.slice(title[0].length).replace(/\r?\n$/, '').split(/\r?\n\r?\n---\r?\n\r?\n/);
  const values = Object.create(null);
  const mappings = [];
  for (const [index, section] of sections.entries()) {
    const parts = section.split(fieldSeparator);
    const [header, first, description, second, editorial_text, third, agent_guidance] = parts;
    const match = sectionHeader.exec(header);
    if (!match || parts.length !== 7 || first !== 'description' || second !== 'editorial_text' || third !== 'agent_guidance') {
      throw new Error(`Invalid Markdown structure in section ${index + 1}.`);
    }
    const { route, displayName } = match.groups;
    const routeSlug = /^2\/([a-z0-9_]+)$/.exec(route)?.[1];
    const slug = documentRoutes.get(route) ?? (routeSlug && canonicalCommunitySlug(routeSlug));
    if (!allowedSlugs.includes(slug)) throw new Error(`Unknown community route: ${route}`);
    if (Object.hasOwn(values, slug)) throw new Error(`Duplicate community target: ${slug}`);
    if ([description, editorial_text, agent_guidance].some(value => headingPattern.test(value))) {
      throw new Error(`Unexpected community or field heading in ${route}.`);
    }
    values[slug] = fieldsSchema.parse({ display_name: displayName, description, editorial_text, agent_guidance });
    mappings.push({ route, slug, displayName });
  }

  return { values, mappings, sha256: createHash('sha256').update(bytes).digest('hex') };
}

module.exports = { readMarkdownCatalog };
