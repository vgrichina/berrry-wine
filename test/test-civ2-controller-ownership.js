'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),Module=require('module');
const root=path.resolve(__dirname,'..'),source=path.join(root,'tools/civ2-serial-controller.js');
// Rejecting mutation changes only the production exclusive-create flag.
if(process.argv.includes('--omit-exclusive')||process.argv.includes('--omit-lifetime')){
 const original=fs.readFileSync(source,'utf8');let changed,control;
 if(process.argv.includes('--omit-exclusive')){
  const needle="fs.openSync(ownerPath, 'wx', 0o600)";assert.equal(original.split(needle).length,2);
  changed=original.replace(needle,"fs.openSync(ownerPath, 'w', 0o600)");control='exclusive-create';
 }else{
  const begin=original.indexOf('  function assertOwnership() {'),end=original.indexOf('  const checks = [];',begin);
  assert(begin>=0&&end>begin);changed=original.slice(0,begin)+'  function assertOwnership() {} // deliberately omitted lifetime check\n'+original.slice(end);control='lifetime-identity';
 }
 fs.writeFileSync(path.join(root,'docs/reviews/civ2-atomic-controller-ownership-repair-oct26/mutation-'+control+'.json'),JSON.stringify({control,originalSHA256:crypto.createHash('sha256').update(original).digest('hex'),mutantSHA256:crypto.createHash('sha256').update(changed).digest('hex'),inMemoryOnly:true},null,2));
 const mutant=new Module(source,module);mutant.filename=source;mutant.paths=module.paths;
 mutant._compile(changed,source);require.cache[source]=mutant;
}
const {createController,launchController}=require(source);
const outputs=path.join(root,'test-output');fs.mkdirSync(outputs,{recursive:true});
function config(){const dir=fs.mkdtempSync(path.join(outputs,'ownership-'));return {outputDir:dir,referenceDir:dir,sessionId:'first',plan:{allocationId:'offline-no-restart',totalCaptures:22,perImageBytes:128,retainedBytes:2816,totalCaptureBytes:2816,width:2,height:2,setupMs:2000,acceptanceMs:2000,cleanupMs:2000,totalMs:6000,cutoff:Date.now()+7000,ackTimeoutMs:100}};}
const bytes=(cfg,name)=>fs.readFileSync(path.join(cfg.outputDir,name));
const marker=cfg=>bytes(cfg,'controller-owner.json');
const ledger=cfg=>bytes(cfg,'capture-plan.json');
const results=[];
async function group(name,fn){await fn();results.push(name);const suffix=process.argv.includes('--omit-lifetime')?'-omit-lifetime':process.argv.includes('--omit-exclusive')?'-omit-exclusive':'';const out=path.join(root,'docs/reviews/civ2-atomic-controller-ownership-repair-oct26/ownership-checkpoint'+suffix+'.json');fs.writeFileSync(out+'.tmp',JSON.stringify({parent:'a3fa32333bbcdc2c8717811432ef5cf6938be776',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),testSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),completed:results,remaining:'later groups, affected regressions, independent acceptance; gameplay UI/quit pending'},null,2));fs.renameSync(out+'.tmp',out);console.log('PASS '+name);}
(async()=>{
 await group('launcher-owner blocks standalone without modifying any owner or ledger',async()=>{
  const cfg=config();let launches=0;const one=await launchController(cfg,{launch:async()=>launches++});const before=marker(cfg),plan=ledger(cfg);
  assert.throws(()=>createController({...cfg,sessionId:'second'}).start(),/no allowance reset/);
  assert(marker(cfg).equals(before));assert(ledger(cfg).equals(plan));assert.equal(launches,1);
  await assert.rejects(one.launch(),/already attempted/);assert(marker(cfg).equals(before));
 });
 await group('standalone-owner blocks launcher including aliased output directory',async()=>{
  const cfg=config(),one=createController(cfg);one.start();const before=marker(cfg),plan=ledger(cfg);let launches=0;
  const alias=cfg.outputDir+'-alias';fs.symlinkSync(cfg.outputDir,alias,'dir');
  await assert.rejects(launchController({...cfg,outputDir:alias,sessionId:'second'},{launch:async()=>launches++}),/no allowance reset/);
  assert.equal(launches,0);assert(marker(cfg).equals(before));assert(ledger(cfg).equals(plan));
 });
 await group('real-FS paused first ledger blocks all four launcher/standalone owner pairs',async()=>{
  for(const a of ['launcher','standalone'])for(const b of ['launcher','standalone']){
   const cfg=config();let first=true,loser,other,launches=0;const original=fs.writeFileSync;
   const begin=(type,sessionId)=>type==='launcher'?launchController({...cfg,sessionId},{launch:async()=>launches++}):Promise.resolve().then(()=>{const c=createController({...cfg,sessionId});c.start();return c;});
   fs.writeFileSync=function(file,...args){if(first&&file===path.join(cfg.outputDir,'capture-plan.json.tmp')){first=false;
     // Start synchronously at the same production boundary (launchController's
     // pre-await portion and standalone.start both execute synchronously).
     if(b==='launcher')other=launchController({...cfg,sessionId:'second'},{launch:async()=>launches++}).catch(e=>{loser=e;});
     else {try{createController({...cfg,sessionId:'second'}).start();}catch(e){loser=e;}}
    }return original.call(this,file,...args);};
   let one;try{one=await begin(a,'first');}finally{fs.writeFileSync=original;}await other;
   assert(loser);assert.equal(launches,a==='launcher'?1:0);assert.equal(JSON.parse(marker(cfg)).sessionId,'first');assert.equal(one.plan.started,true);assert.equal(JSON.parse(ledger(cfg)).attempts,0);
  }
 });
 await group('claim write and initial ledger failures retain tombstones and prohibit same/new reentry',async()=>{
  for(const where of ['claim','ledger-write','ledger-rename']){
   const cfg=config(),one=createController(cfg);const write=fs.writeFileSync,rename=fs.renameSync;
   fs.writeFileSync=function(file,...args){if((where==='claim'&&typeof file==='number')||(where==='ledger-write'&&file===path.join(cfg.outputDir,'capture-plan.json.tmp')))throw Error('injected '+where);return write.call(this,file,...args);};
   fs.renameSync=function(a,b){if(where==='ledger-rename'&&b===path.join(cfg.outputDir,'capture-plan.json'))throw Error('injected '+where);return rename.call(this,a,b);};
   try{assert.throws(()=>one.start(),/injected/);}finally{fs.writeFileSync=write;fs.renameSync=rename;}
   const retained=marker(cfg);assert.throws(()=>one.start(),/already started\/attempted/);
   let launches=0;await assert.rejects(launchController({...cfg,sessionId:'second'},{launch:async()=>launches++}),/no allowance reset/);
   await assert.rejects(one.step(1));assert.equal(launches,0);assert(marker(cfg).equals(retained));
  }
 });
 await group('launcher failure and pending launcher reentry never credit a restart',async()=>{
  const cfg=config();let calls=0,second,release;const pending=new Promise(resolve=>release=resolve);
  const launch=launchController(cfg,{launch:async()=>{calls++;second=launchController({...cfg,sessionId:'second'},{launch:async()=>calls++});await pending;throw Error('uncertain launcher failure');}});
  await assert.rejects(second,/no allowance reset/);release();await assert.rejects(launch,/uncertain launcher failure/);
  const retained=marker(cfg),before=ledger(cfg);assert.equal(JSON.parse(before).stopped,true);
  await assert.rejects(launchController({...cfg,sessionId:'third'},{launch:async()=>calls++}),/no allowance reset/);assert.equal(calls,1);assert(marker(cfg).equals(retained));assert(ledger(cfg).equals(before));
 });
 await group('pre-existing ledger/control/empty-or-foreign-owner are retained without any launcher',async()=>{
  for(const name of ['capture-plan.json','control-in.jsonl','controller-owner.json']){
   const cfg=config(),file=path.join(cfg.outputDir,name),prior=Buffer.from(name==='controller-owner.json'?'':'uncertain prior bytes\n');fs.writeFileSync(file,prior);
   let calls=0;await assert.rejects(launchController(cfg,{launch:async()=>calls++}),/no allowance reset/);assert.equal(calls,0);assert(bytes(cfg,name).equals(prior));
  }
 });
 await group('standalone run failure and concurrent/same-object reentry cannot dispatch again',async()=>{
  for(const reenter of [false,true]){
   const cfg=config();let requests=0;const c=createController(cfg,{request:async()=>{requests++;if(reenter)return new Promise(()=>{});throw Error('uncertain offline peer');}});
   const pending=c.run();
   if(reenter)await assert.rejects(c.run(),/run already attempted/);
   await assert.rejects(pending,/uncertain offline peer|unacknowledged/);
   const before=ledger(cfg),claim=marker(cfg);assert.equal(JSON.parse(before).stopped,true);assert.equal(requests,1);
   await assert.rejects(c.run(),/run already attempted/);await assert.rejects(c.step(1));
   assert.equal(requests,1);assert(ledger(cfg).equals(before));assert(marker(cfg).equals(claim));
  }
 });
 await group('lost or replaced owner blocks control and persistence; no unrelated cleanup',async()=>{
  for(const how of ['replace','edit','remove','directory']){
   const cfg=config();let requests=0;const c=createController(cfg,{request:async r=>{requests++;return {id:r.id,ok:true,value:{ran:r.n,frozen:true}};}});c.start();const old=ledger(cfg);const op=path.join(cfg.outputDir,'controller-owner.json');
   if(how==='replace'){fs.renameSync(op,op+'.original');fs.writeFileSync(op,'foreign');}
   if(how==='edit')fs.writeFileSync(op,'edited');if(how==='remove')fs.unlinkSync(op);
   if(how==='directory'){fs.renameSync(cfg.outputDir,cfg.outputDir+'-original');fs.mkdirSync(cfg.outputDir);fs.copyFileSync(path.join(cfg.outputDir+'-original','controller-owner.json'),op);}
   const foreign=fs.existsSync(op)?fs.readFileSync(op):null;
   await assert.rejects(c.step(1),/ownership/);await assert.rejects(c.capture('language'),/ownership/);assert.equal(requests,0);
   if(foreign)assert(fs.readFileSync(op).equals(foreign));else assert(!fs.existsSync(op));
   const at=how==='directory'?cfg.outputDir+'-original':cfg.outputDir;assert(fs.readFileSync(path.join(at,'capture-plan.json')).equals(old));
  }
 });
 await group('unrelated directories stay independent and no completion releases lifetime marker',async()=>{
  const cfg=config(),other=config();let n=0;const a=await launchController(cfg,{launch:async()=>n++});await launchController(other,{launch:async()=>n++});assert.equal(n,2);
  const before=marker(cfg);assert.throws(()=>a.start(),/already started/);await assert.rejects(a.step(1));
  await assert.rejects(launchController({...cfg,sessionId:'after-completion'},{launch:async()=>n++}),/no allowance reset/);assert(marker(cfg).equals(before));assert.equal(n,2);
 });
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
