// Load the same local environment as Express and Next.js without overriding host variables.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { spawnSync } = require('child_process');
const result = spawnSync(process.execPath, [require.resolve('prisma'), ...process.argv.slice(2)], {
  stdio: 'inherit', env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
