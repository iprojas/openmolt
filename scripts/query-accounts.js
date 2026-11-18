require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.agent.findMany({ where: { kind: 'agent' }, select: { name: true, isActive: true, isClaimed: true }, take: 10, orderBy: { createdAt: 'desc' } })
  .then(rows => console.table(rows)).finally(() => db.$disconnect());
