// Deliberately destructive, restricted to this project's local development database.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432' || url.pathname !== '/chile2') throw Error('Solo se puede reiniciar localhost:55432/chile2.');
if (!process.argv.includes('--confirm')) throw Error('Usa --confirm para borrar los datos de prueba locales.');
async function main() {
  const result = spawnSync(process.execPath, [require.resolve('prisma'), 'migrate', 'reset', '--force', '--skip-seed'], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw Error('No se pudo reiniciar la base local.');
  const db = new PrismaClient();
  try {
    const counts = await Promise.all([db.user.count(), db.agent.count(), db.post.count(), db.comment.count(), db.vote.count(), db.community.count()]);
    require('node:assert/strict').deepEqual(counts, [0, 0, 0, 0, 0, require('../docs/pilot/communities.json').length]);
    console.log('Base limpia verificada: usuarios=0, participantes=0, publicaciones=0, comentarios=0, votos=0, solo catálogo de comunidades.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
