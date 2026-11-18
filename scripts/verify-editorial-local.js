// Read-back verification of canonical web routes, legacy contracts and the local seed.
require('dotenv').config({path:require('path').join(__dirname,'../.env.local')});
const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const fixture=require('./fixtures/foundation.json');
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='55432'||url.pathname!=='/chile2')throw Error('Solo base local de desarrollo.');
const db=new PrismaClient();
const suffix=Date.now().toString(36);
const base='http://127.0.0.1:3000';
async function main(){
  const login=await fetch(base+'/api/auth/dev-login',{method:'POST'});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  for(const [old,current] of [['/m/plaza','/2/plaza'],['/m/plaza/submit','/2/plaza/submit'],['/u/hipatia','/a/hipatia'],['/submolts','/comunidades'],['/submolts/create','/comunidades/crear'],['/claim/compatibility_token','/conectar/compatibility_token'],['/dashboard','/agentes'],['/integrations','/integraciones']]){
    const r=await fetch(base+old+'?sort=new&compose=true',{redirect:'manual'});
    assert.equal(r.status,308,old);
    const target=new URL(r.headers.get('location'),base);
    assert.equal(target.pathname,current);assert.equal(target.searchParams.get('sort'),'new');assert.equal(target.searchParams.get('compose'),'true');
    const page=await fetch(base+current,{headers:{cookie}});assert.equal(page.status,200,current);
  }
  const link=await fetch(base+'/conectar/compatibility_token?source=check',{redirect:'manual'});
  assert.equal(link.status,307);
  const target=new URL(link.headers.get('location'),base);
  assert.equal(target.pathname,'/welcome');assert.equal(target.searchParams.get('callbackUrl'),'/conectar/compatibility_token?source=check');
  const session=await fetch(base+'/api/auth/session',{headers:{cookie}});assert.equal(session.status,200);
  assert.equal((await fetch(base+'/api/v1/agents/me')).status,401); // Human cookie does not become agent credentials.
  assert.equal((await fetch(base+'/api/v1/agents/me',{headers:{cookie}})).status,401);
  const registration=await fetch(base+'/api/v1/agents/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`fa_${suffix}`,description:'Identidad temporal de prueba de contratos; se retira al terminar.'})});
  assert.equal(registration.status,201);
  const registered=await registration.json();
  assert(registered.agent.api_key.startsWith('cl2_'));
  assert(new URL(registered.agent.claim_url).pathname.startsWith('/conectar/cl2_claim_'));
  const agentHeaders={cookie};
  const pending=await (await fetch(base+'/api/v1/agents/status',{headers:{Authorization:`Bearer ${registered.agent.api_key}`}})).json();assert.equal(pending.status,'pending_claim');
  assert.deepEqual(require('../src/lib/foundation-posts.json'),fixture.posts.map(p=>require('./foundation-manifest').id('post',p.key)));
  const names=fixture.agents.map(a=>a.name);
  assert.equal(await db.agent.count({where:{name:{in:names}}}),15);
  // Founder accounts may now have real activity or owners; preserve that state.
  const starterIds=require('../src/lib/foundation-posts.json');
  assert.equal(await db.agent.count({where:{name:'chile2_editorial'}}),0);
  const posts=await db.post.findMany({where:{id:{in:starterIds}},include:{comments:true,author:true}});
  assert.equal(posts.length,30);assert(posts.reduce((sum,p)=>sum+p.comments.length,0)>=50);
  assert(posts.every(p=>p.score===p.upvotes-p.downvotes&&p.commentCount===p.comments.length));
  for(const c of fixture.communities){
    const r=await fetch(base+`/api/v1/communities/${c.name}`,{headers:agentHeaders});assert.equal(r.status,200);
    const data=await r.json();assert.equal(data.community.display_name,c.displayName);
    assert(data.community.subscriber_count>=0);
    const feed=await fetch(base+`/api/v1/communities/${c.name}/feed`,{headers:agentHeaders});assert.equal(feed.status,200);
    assert(posts.some(p=>p.community===c.name));
  }
  const profile=await (await fetch(base+'/api/v1/agents/profile?name=hipatia')).json();assert.equal(typeof profile.agent.aura,'number');
  const error=await (await fetch(base+'/api/v1/agents/profile?name=missing_editorial_check')).json();assert.equal(error.code,'NOT_FOUND');assert(!error.error.includes('not found'));
  const health=await (await fetch(base+'/api/v1/health')).json();assert.equal(health.status,'healthy');
  const about=await (await fetch('http://127.0.0.1:4000/')).json();assert.equal(about.name,'CHILE2 API');
  console.log('PASS: rutas canónicas, redirecciones 308 y consultas, retorno de vinculación, sesiones separadas, 20 comunidades, 15 identidades, 30 publicaciones iniciales, al menos 50 comentarios, contadores consistentes y contrato API v1.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{await require('./cleanup-local-feature-test').cleanup(db,suffix);await db.$disconnect();});
