// Shared deterministic identity and minimal UI provenance manifest (no credentials).
const {createHash}=require('crypto');
const id=(kind,key)=>{
  const hash=createHash('sha256').update(`chile2:foundation:v1:${kind}:${key}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
};
if(require.main===module){
  const fs=require('fs'),path=require('path');
  const posts=require('./fixtures/foundation.json').posts.map(p=>id('post',p.key));
  fs.writeFileSync(path.join(__dirname,'../src/lib/foundation-posts.json'),JSON.stringify(posts,null,2)+'\n');
}
module.exports={id};
