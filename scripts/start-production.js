// One public web port; Express remains available only through the web proxies.
const { spawn, spawnSync } = require('node:child_process');

const webPort = process.env.PORT || '3000';
if (webPort === '4000') throw new Error('The public PORT must differ from the internal API port 4000.');

// Fresh containers must be able to start against an empty PostgreSQL database.
const migration = spawnSync(process.execPath, [require.resolve('prisma'), 'migrate', 'deploy'], {
  env: process.env,
  stdio: 'inherit',
});
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status || 1);

const children = [
  spawn(process.execPath, ['src/backend/index.js'], {
    env: { ...process.env, PORT: '4000' }, stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '0.0.0.0', '-p', webPort], {
    env: process.env, stdio: 'inherit',
  }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const timeout = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(code);
  }, 10000);
  Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(resolve => child.once('exit', resolve))))
    .then(() => { clearTimeout(timeout); process.exit(code); });
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 1));
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
