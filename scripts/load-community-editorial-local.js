const { readFileSync, writeFileSync } = require('node:fs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { editorialSchema } = require('../src/lib/community-editorial-schema');
const { readMarkdownCatalog } = require('./community-editorial-markdown');
const draft = require('./fixtures/community-editorial-v2.json');

const slugs = [
  'chile', 'tecnologias', 'filosofia', 'estudios_humanos', 'politica',
  'investigacion', 'cultura', 'memes', 'vida_agentica', 'praxis', 'cl2',
];

const snapshotSchema = z.object({
  display_name: z.string().nullable().optional(),
  description: z.string().nullable(),
  editorial_text: z.string().nullable(),
  agent_guidance: z.string().nullable(),
}).strict();

function validateDraft() {
  const catalog = z.object(Object.fromEntries(slugs.map(slug => [slug, editorialSchema]))).strict().parse(draft);
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

function readSnapshot(path) {
  const catalog = z.record(snapshotSchema).parse(JSON.parse(readFileSync(path, 'utf8')));
  const targets = Object.keys(catalog);
  if (!targets.length || targets.some(slug => !slugs.includes(slug))) {
    throw new Error('The backup must contain known community targets.');
  }
  return catalog;
}

async function readCommunities(db, targets) {
  const communities = await db.community.findMany({
    where: { name: { in: targets } },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, displayName: true, description: true, editorialText: true,
      agentGuidance: { select: { content: true } },
    },
  });
  const missing = targets.filter(slug => !communities.some(community => community.name === slug));
  if (missing.length) throw new Error(`Missing canonical communities: ${missing.join(', ')}`);
  return communities;
}

function storedFields(community) {
  return {
    display_name: community.displayName,
    description: community.description,
    editorial_text: community.editorialText,
    agent_guidance: community.agentGuidance?.content ?? null,
  };
}

function differentFields(community, expected) {
  const actual = storedFields(community);
  // For valid UTF-8 text, exact string equality also guarantees byte equality.
  return Object.keys(expected).filter(field => actual[field] !== expected[field]);
}

async function main() {
  const args = process.argv.slice(2);
  let markdown;
  if (args[0] === '--source' && args[1] && !args[1].startsWith('--')) {
    markdown = readMarkdownCatalog(args[1], slugs);
    args.splice(0, 2);
  }
  const [mode, backup] = args;
  const usage = 'Usage: node scripts/load-community-editorial-local.js [--source <file.md>] [--apply <backup.json> | --verify | --restore <backup.json>]';
  if (args.length === 0) {
    if (markdown) {
      for (const { route, slug, displayName } of markdown.mappings) {
        console.log(`${route} -> /2/${slug} (${displayName})`);
      }
      const omitted = slugs.filter(slug => !Object.hasOwn(markdown.values, slug));
      console.log(`Validated ${markdown.mappings.length} names and ${markdown.mappings.length * 3} editorial texts.`);
      if (omitted.length) console.log(`Communities omitted from source: ${omitted.join(', ')}`);
      console.log(`Source SHA-256: ${markdown.sha256}`);
    } else {
      validateDraft();
      console.log('Validated 11 communities and 33 editorial texts.');
    }
    return;
  }
  const isVerify = mode === '--verify' && args.length === 1;
  const isApply = mode === '--apply' && args.length === 2 && backup && !backup.startsWith('--');
  const isRestore = mode === '--restore' && args.length === 2 && backup && !backup.startsWith('--') && !markdown;
  if (!(isVerify || isApply || isRestore)) throw new Error(usage);

  const database = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
  if (!database || database.protocol !== 'postgresql:' || !['localhost', '127.0.0.1'].includes(database.hostname) ||
      database.port !== '55432' || !['/chile2_editorial_review', '/chile2_editorial_test'].includes(database.pathname) ||
      database.search) {
    throw new Error('Set DATABASE_URL explicitly to the dedicated local editorial review or test database.');
  }
  const values = isRestore ? readSnapshot(backup) : markdown?.values ?? validateDraft();
  const targets = Object.keys(values);
  const prisma = new PrismaClient({ datasourceUrl: database.toString() });
  try {
    if (isVerify) {
      const communities = await readCommunities(prisma, targets);
      verifyFields(communities, values);
      console.log(`Verified exact stored values for ${targets.length} communities.`);
      return;
    }

    await prisma.$transaction(async db => {
      const communities = await readCommunities(db, targets);
      if (isApply) {
        const snapshot = Object.fromEntries(communities.map(community => {
          const current = storedFields(community);
          const previous = Object.fromEntries(Object.keys(values[community.name]).map(field => [field, current[field]]));
          return [community.name, previous];
        }));
        writeFileSync(backup, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      }

      for (const community of communities) {
        const expected = values[community.name];
        if (!differentFields(community, expected).length) continue;
        const { display_name, description, editorial_text, agent_guidance } = expected;
        await db.community.update({
          where: { id: community.id },
          data: {
            displayName: display_name,
            description,
            editorialText: editorial_text,
            agentGuidance: agent_guidance !== null ? {
              upsert: { create: { content: agent_guidance }, update: { content: agent_guidance } },
            } : community.agentGuidance ? { delete: true } : undefined,
          },
        });
      }
      verifyFields(await readCommunities(db, targets), values);
    }, { isolationLevel: 'Serializable' });
    console.log(`${isApply ? 'Loaded' : 'Restored'} and verified ${targets.length} community editorial records.`);
  } finally {
    await prisma.$disconnect();
  }
}

function verifyFields(communities, values) {
  for (const community of communities) {
    const differences = differentFields(community, values[community.name]);
    if (differences.length) throw new Error(`Stored values differ for ${community.name}: ${differences.join(', ')}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
