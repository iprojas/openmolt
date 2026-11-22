const { readFileSync, writeFileSync } = require('node:fs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { editorialSchema } = require('../src/lib/community-editorial-schema');
const draft = require('./fixtures/community-editorial-v2.json');

const slugs = [
  'chile', 'tecnologias', 'filosofia', 'estudios_humanos', 'politica',
  'investigacion', 'cultura', 'memes', 'vida_agentica', 'praxis', 'cl2',
];

const snapshotSchema = z.object({
  description: z.string().nullable(),
  editorial_text: z.string().nullable(),
  agent_guidance: z.string().nullable(),
}).strict();

function validateCatalog(catalog, fieldsSchema) {
  return z.object(Object.fromEntries(slugs.map(slug => [slug, fieldsSchema]))).strict().parse(catalog);
}

function validateDraft() {
  const catalog = validateCatalog(draft, editorialSchema);
  for (const [slug, fields] of Object.entries(catalog)) {
    for (const [field, value] of Object.entries(fields)) {
      if (!value || value !== draft[slug][field]) {
        throw new Error(`${slug}/${field} must contain text without surrounding whitespace.`);
      }
      if (field !== 'description' && !value.includes('\n\n')) {
        throw new Error(`${slug}/${field} must contain a paragraph break.`);
      }
    }
  }
  return catalog;
}

async function main() {
  const [mode, backup, ...extra] = process.argv.slice(2);
  if (!mode) {
    validateDraft();
    console.log('Validated 11 communities and 33 editorial texts.');
    return;
  }
  if (!['--apply', '--restore'].includes(mode) || !backup || extra.length) {
    throw new Error('Usage: node scripts/load-community-editorial-local.js [--apply or --restore <backup.json>]');
  }

  const database = new URL(process.env.DATABASE_URL);
  if (database.protocol !== 'postgresql:' || !['localhost', '127.0.0.1'].includes(database.hostname) ||
      database.port !== '55432' || !['/chile2_editorial_review', '/chile2_editorial_test'].includes(database.pathname) ||
      database.search) {
    throw new Error('Set DATABASE_URL explicitly to the dedicated local editorial review or test database.');
  }
  const values = mode === '--restore'
    ? validateCatalog(JSON.parse(readFileSync(backup, 'utf8')), snapshotSchema)
    : validateDraft();
  const prisma = new PrismaClient({ datasourceUrl: database.toString() });
  try {
    await prisma.$transaction(async db => {
      const communities = await db.community.findMany({
        where: { name: { in: slugs } },
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, description: true, editorialText: true,
          agentGuidance: { select: { content: true } },
        },
      });
      const missing = slugs.filter(slug => !communities.some(community => community.name === slug));
      if (missing.length) throw new Error(`Missing canonical communities: ${missing.join(', ')}`);

      if (mode === '--apply') {
        const snapshot = Object.fromEntries(communities.map(community => [community.name, {
          description: community.description,
          editorial_text: community.editorialText,
          agent_guidance: community.agentGuidance?.content ?? null,
        }]));
        writeFileSync(backup, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      }

      for (const community of communities) {
        const { description, editorial_text, agent_guidance } = values[community.name];
        if (community.description === description && community.editorialText === editorial_text &&
            (community.agentGuidance?.content ?? null) === agent_guidance) continue;
        await db.community.update({
          where: { id: community.id },
          data: {
            description,
            editorialText: editorial_text,
            agentGuidance: agent_guidance !== null ? {
              upsert: { create: { content: agent_guidance }, update: { content: agent_guidance } },
            } : community.agentGuidance ? { delete: true } : undefined,
          },
        });
      }
    }, { isolationLevel: 'Serializable' });
    console.log(mode === '--apply' ? 'Loaded 33 editorial texts.' : 'Restored the 11 community editorial records.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
