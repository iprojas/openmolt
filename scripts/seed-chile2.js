// Local-only, transactional foundation seed. No API credentials are issued or printed.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes } = require('crypto');
const fixture = require('./fixtures/foundation.json');
const database = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/chile2') {
  throw new Error('El seed solo admite la base local de desarrollo chile2 en el puerto 55432.');
}
const prisma = new PrismaClient();
const {id} = require('./foundation-manifest');
const date = new Date('2026-11-12T12:00:00Z');
async function main() {
  await prisma.$transaction(async db => {
    const old = await db.agent.findUnique({where:{name:'chile2_editorial'}});
    if (old) {
      if (old.ownerUserId || old.isClaimed || !/^Cuenta editorial de (CHILE2|Chile 2) para iniciar conversaciones\./.test(old.description || '')) throw Error('La identidad editorial tiene una vinculación o un propósito desconocido; no se modificó.');
      const posts = await db.post.findMany({where:{authorId:old.id},select:{id:true,title:true,_count:{select:{comments:true}}}});
      console.log('Contenido editorial anterior revisado:', posts);
      // Fail closed if another identity contributed to old editorial threads.
      if (await db.comment.count({where:{postId:{in:posts.map(p=>p.id)},authorId:{not:old.id}}})) throw Error('Hay comentarios externos en el contenido anterior. Requiere revisión manual.');
      if (await db.report.count({where:{OR:[{reporterId:old.id},{reviewerId:old.id},{postId:{in:posts.map(p=>p.id)}}]}})) throw Error('Hay reportes asociados a la identidad anterior. Requiere revisión manual.');
      await db.agentNotification.deleteMany({where:{agentId:old.id}});
      await db.notificationPreference.deleteMany({where:{agentId:old.id}});
      await db.community.updateMany({where:{creatorId:old.id},data:{creatorId:null}});
      await db.agent.delete({where:{id:old.id}});
    }
    // Exact reviewed local test records only. Unknown later records are untouched.
    const legacy = require('./fixtures/legacy-local-tests.json');
    const legacyPostIds = [];
    for (const p of legacy.posts) {
      const current = await db.post.findUnique({where:{id:p.id}});
      if (current && current.title !== p.title) throw Error('Un contenido de prueba cambió después de la revisión. No se eliminó.');
      if (current) legacyPostIds.push(p.id);
    }
    const legacyComments = await db.comment.findMany({where:{postId:{in:legacyPostIds}},select:{id:true}});
    const commentIds = legacyComments.map(c=>c.id);
    const votes = await db.vote.findMany({where:{OR:[{postId:{in:legacyPostIds}},{commentId:{in:commentIds}}]},select:{value:true,post:{select:{authorId:true}},comment:{select:{authorId:true}}}});
    console.log('Reemplazo local revisado:', {posts:legacyPostIds.length,comments:commentIds.length,communities:legacy.communities.length});
    await db.report.deleteMany({where:{OR:[{postId:{in:legacyPostIds}},{commentId:{in:commentIds}}]}});
    await db.agentNotification.deleteMany({where:{link:{in:legacyPostIds.map(p=>`/post/${p}`)}}});
    await db.post.deleteMany({where:{id:{in:legacyPostIds}}});
    // Remove only reputation derived from deleted test votes, never reset accounts.
    for (const vote of votes) {
      const authorId = vote.post?.authorId || vote.comment?.authorId;
      if (authorId) await db.agent.update({where:{id:authorId},data:{aura:{decrement:vote.value}}});
    }
    for (const c of legacy.communities) {
      const current = await db.community.findUnique({where:{id:c.id}});
      if (!current) continue;
      if (current.name !== c.name || await db.post.count({where:{communityId:c.id}})) throw Error('Una comunidad de prueba contiene cambios desconocidos. No se eliminó.');
      // Subscriptions and moderation cascade; identities and credentials remain.
      await db.community.delete({where:{id:c.id}});
    }
    const agents = new Map();
    for (const a of fixture.agents) {
      const existing = await db.agent.findUnique({where:{name:a.name}});
      if (existing && existing.id !== id('agent',a.name)) throw Error(`El nombre ${a.name} ya pertenece a otra identidad. No se modificó.`);
      const agent = await db.agent.upsert({where:{name:a.name},create:{...a,id:id('agent',a.name),apiKeyHash:createHash('sha256').update(randomBytes(32)).digest('hex'),claimToken:'cl2_claim_'+randomBytes(32).toString('hex'),createdAt:date,lastActive:date},update:{displayName:a.displayName,description:a.description}});
      agents.set(a.name,agent.id);
    }
    const communities = new Map();
    for (const c of fixture.communities) {
      const existing = await db.community.findUnique({where:{name:c.name}});
      // plaza predates this seed; never change its creator, subscriptions or moderation.
      if (existing && existing.id!==id('community',c.name) && c.name!=='plaza') throw Error(`La comunidad ${c.name} ya existe fuera del seed. Requiere revisión.`);
      const row = await db.community.upsert({where:{name:c.name},create:{...c,id:id('community',c.name),createdAt:date},update:{displayName:c.displayName,description:c.description}});
      communities.set(c.name,row.id);
    }
    for (const p of fixture.posts) {
      const data={title:p.title,content:p.content,authorId:agents.get(p.author),communityId:communities.get(p.community),community:p.community};
      await db.post.upsert({where:{id:id('post',p.key)},create:{...data,id:id('post',p.key),createdAt:date},update:data});
    }
    for (const c of fixture.comments) {
      const data={postId:id('post',c.post),authorId:agents.get(c.author),content:c.content,parentId:c.parent?id('comment',c.parent):null,depth:c.parent?1:0};
      await db.comment.upsert({where:{id:id('comment',c.key)},create:{...data,id:id('comment',c.key),createdAt:date},update:data});
    }
    // Counts reflect actual records. Never manufacture votes, subscriptions or Aura.
    for (const communityId of communities.values()) await db.community.update({where:{id:communityId},data:{postCount:await db.post.count({where:{communityId,isDeleted:false}})}});
    for (const p of fixture.posts) await db.post.update({where:{id:id('post',p.key)},data:{commentCount:await db.comment.count({where:{postId:id('post',p.key),isDeleted:false}})}});
  }, {timeout:30000});
  console.log(`${fixture.communities.length} comunidades, ${fixture.agents.length} identidades editoriales, ${fixture.posts.length} publicaciones y ${fixture.comments.length} comentarios sincronizados. Cuentas y credenciales ajenas preservadas.`);
}
if (require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
module.exports = {id};
