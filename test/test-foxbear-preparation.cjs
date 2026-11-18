'use strict';
// Authored media at the registry's real binaries/ spelling. No game execution,
// media copies, or retained-run dependencies. Real main + Worker FS readers.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const prep=require('../tools/blood2-immutable-preparation.cjs'),c=require('../tools/native-supervisor-common.cjs');
const root=path.resolve(__dirname,'..');
function body(out){
 fs.mkdirSync(out,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'test/binaries/.foxbear-preparation-'));
 try{
  const rel=path.relative(root,dir),data=rel+'/data.art',alias=rel+'/alias.art',other=rel+'/other.art';
  const bytes=Buffer.from('authored sealed animation media'),changed=Buffer.from('mutable live bytes must never be used');
  fs.writeFileSync(path.join(root,data),bytes);fs.writeFileSync(path.join(root,other),'unlisted media');fs.symlinkSync('data.art',path.join(root,alias));
  const registryAlias=alias.replace(/^test\//,''),pin={path:data,size:bytes.length,sha256:c.sha256(bytes),aliases:[registryAlias]};
  const rows=prep.collect([],{media:[pin]});
  const registry=Buffer.from('module.exports={APPS:{fixture:{exe:'+JSON.stringify(registryAlias)+',files:[]}}}');
  const selected=rows.map(r=>r.path==='lib/apps.js'?{path:r.path,sha256:c.sha256(registry),body:registry.toString('base64')}:r);
  const module=fs.readFileSync(path.join(root,'build/wine-assembly.wasm'));
  const code=`const fs=require('node:fs'),a=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
   const file=require('./lib/apps').APPS.fixture.exe,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
   const check=b=>a.equal(hash(b),${JSON.stringify(pin.sha256)});
   (async()=>{check(fs.readFileSync(path.resolve(file)));check(fs.readFileSync(Buffer.from(path.resolve(file))));
    check(await fs.promises.readFile(new URL('file://'+path.resolve(file))));
    check(await new Promise((resolve,reject)=>fs.readFile(file,(e,b)=>e?reject(e):resolve(b))));
    const chunks=[];for await(const b of fs.createReadStream(file))chunks.push(b);check(Buffer.concat(chunks));
    console.log(JSON.stringify({pass:true,threadId:require('node:worker_threads').threadId,file}));
   })().catch(e=>{console.error(e);process.exitCode=1;});`;
  const both=code+`const {Worker}=require('node:worker_threads');const w=new Worker(${JSON.stringify(code)},{eval:true});w.on('error',e=>{console.error(e);process.exitCode=1});w.on('exit',n=>{if(n)process.exitCode=1});`;
  function run(frozen,code){return cp.spawnSync(process.execPath,['-e',code],{cwd:root,env:{...frozen.env,LMARBLES_SOURCE_OBSERVE:out},stdio:c.stdioWithFds(frozen.fds),timeout:15000,maxBuffer:4e6});}
  const frozen=prep.freeze(selected,module);
  try{
   const incomplete=prep.freeze(selected.filter(r=>r.path!=='test/binaries/tlbs/stdole2.tlb'),module);
   try{assert.throws(()=>prep.renderingPreflight(incomplete),/unsealed media input.*stdole2/);
    c.save(out,'missing-boot-data-refused.json',{pass:true,originalsStarted:0,guestInstructionsExecuted:0,missing:'stdole2.tlb'});
   }finally{incomplete.close();}
   c.save(out,'complete-boot-preflight.json',prep.renderingPreflight(frozen));
   fs.writeFileSync(path.join(root,data),changed);
   const r=run(frozen,both);assert.equal(r.status,0,r.stderr.toString());
   const reports=r.stdout.toString().trim().split('\n').map(JSON.parse);assert.equal(reports.length,2);assert.deepEqual(reports.map(r=>r.threadId).sort(),[0,1]);
   assert.throws(()=>prep.collect([],{media:[pin]}),/AssertionError/,'mutation must reject fresh preparation');
   const legacy=prep.freeze(selected.map(({canonicalPath,...r})=>r),module);
   try{const old=run(legacy,both);assert.notEqual(old.status,0);c.save(out,'old-alias-failure.json',{exit:old.status,stderr:old.stderr.toString()});}finally{legacy.close();}
   fs.unlinkSync(path.join(root,alias));fs.symlinkSync('other.art',path.join(root,alias));
   const refused=run(frozen,both);assert.notEqual(refused.status,0);assert.match(refused.stderr.toString(),/sealed media alias identity changed/);
   c.save(out,'media-assertions.json',{pass:true,registryAlias,canonicalPath:data,mainAndWorker:reports,liveMutationIgnored:true,
    newPreparationMutationRejected:true,retargetedAliasRejected:true,oldAliasFailure:true,actualReadAPIs:['sync','Buffer','promise URL','callback','stream'],originalsStarted:0});
  }finally{frozen.close();}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
async function main(){const out=path.resolve(process.argv[3]);if(process.argv[2]==='--body')return body(out);
 fs.mkdirSync(out,{recursive:true});const r=await require('../tools/native-supervise.cjs').supervise(path.join(out,'containment'),[process.execPath,__filename,'--body',path.join(out,'native')],{deadline:c.now()+40,cleanup_deadline:c.now()+50,grace:1});
 assert.equal(r.exit,0);assert.equal(r.leaked,false);console.log(JSON.stringify({pass:true,out}));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
