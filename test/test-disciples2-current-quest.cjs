'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),http=require('node:http'),net=require('node:net');
const root=process.cwd();
const s=require('../tools/disciples2-current-supervisor.cjs');
const common=require('../tools/native-supervisor-common.cjs');
const TOOL=path.join(root,'tools/disciples2-current-supervisor.cjs'),CONTROLLER=path.join(root,'tools/disciples2-current-controller.cjs');
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));

async function provenance(){
 const [pool,index,rows]=s.indexedSources({'test.js':Buffer.from('one'),'nested/helper.js':Buffer.from('two')});
 let manifest={sourceIndexSHA256:s.digest(index),sources:rows};
 s.validateSources(pool,manifest);
 for(const bad of [pool.subarray(0,-1),Buffer.concat([pool,Buffer.from('junk')]),Buffer.concat([pool.subarray(0,-1),Buffer.from('x')])])
  assert.throws(()=>s.validateSources(bad,manifest),undefined,'incomplete/corrupt indexed inventory accepted');
 const evidence=process.env.DISCIPLES2_LAUNCH_TEST_OUT;
 const temporary=evidence?null:fs.mkdtempSync(path.join(os.tmpdir(),'disciples2-launch-'));
 try{
  const out=path.resolve(evidence||temporary);fs.mkdirSync(out,{recursive:true});
  const base={cwd:root,args:['node','-e',"require('fs').writeFileSync(process.env.DISCIPLES2_TEST_MARKER,'executed')"],seconds:220,watchdogGrace:20};
  const holderpath=process.env.DISCIPLES2_LAUNCH_HOLDER;let h;
  if(holderpath){
   h=JSON.parse(fs.readFileSync(holderpath));manifest=JSON.parse(s.holderBytes(h,'manifestPath'));
   Object.assign(base,{moduleHolder:holderpath,childInheritance:'sealed-node-v1',immutableManifest:{manifestSHA256:h.manifestSHA256,...pick(manifest,['gitSHA','sourceSHA256','moduleSHA256','preloadSHA256'])}});
  }
  const run=(name,recipe,valid=false)=>{
   const d=path.join(out,name);fs.mkdirSync(d);const marker=path.join(d,'executed');
   fs.writeFileSync(path.join(d,'recipe.json'),JSON.stringify(recipe));
   const p=cp.spawnSync(process.execPath,[TOOL,'run',d],{env:{...process.env,DISCIPLES2_TEST_MARKER:marker},timeout:45000,maxBuffer:1<<30});
   const exit=common.returncode(p.status,p.signal);
   fs.writeFileSync(path.join(d,'tool-wait.json'),JSON.stringify({exit,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:String(p.stdout),stderr:String(p.stderr)}));
   assert.equal(fs.existsSync(marker),valid,name+': '+p.stderr);
   if(valid){
    for(const f of ['native-wait.json','watchdog-wait.json']){
     const w=JSON.parse(fs.readFileSync(path.join(d,f)));assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF,JSON.stringify(w));
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(d,'runtime-inputs.json'))).sourceSHA256,manifest.sourceSHA256);
    assert.equal(JSON.parse(fs.readFileSync(path.join(d,'inheritance-wait.json'))).exit,0);
   }else{
    assert(exit!==0&&fs.existsSync(path.join(d,'prelaunch-refusal.json')),name);
    assert(!['native-pid.json','watchdog-armed.json','launch.json'].some(f=>fs.existsSync(path.join(d,f))),name);
   }
  };
  for(const field of ['moduleHolder','immutableManifest','childInheritance']){const recipe={...base};delete recipe[field];run('omitted-'+field,recipe);}
  if(holderpath){
   for(const [name,change] of [['missing-holder',{moduleHolder:path.join(out,'absent')}],['manifest-mismatch',{immutableManifest:{...base.immutableManifest,moduleSHA256:'0'.repeat(64)}}]])run(name,{...base,...change});
   for(const [name,change] of [['stale-holder',{startToken:'0'}],['unsealed-holder',{sealed:0}],['descriptor-mismatch',{fdPath:h.sourcePath}]]){
    const hp=path.join(out,name+'.json');fs.writeFileSync(hp,JSON.stringify({...h,...change}));run(name,{...base,moduleHolder:hp});
   }
   // Actual production preload rejects omission in both supported child routes.
   for(const [name,code] of [['worker-omitted-env',"new (require('worker_threads').Worker)('0',{eval:true,env:{}})"],['worker-omitted-preload',"new (require('worker_threads').Worker)('0',{eval:true,execArgv:[]})"],['process-omitted-env',"require('child_process').spawnSync(process.execPath,['-e','0'],{env:{}})"]]){
    const d=path.join(out,name);fs.mkdirSync(d);const [env,fds]=s.frozenInputs(d,base);
    try{
     const p=cp.spawnSync(process.execPath,['--require',env.DISCIPLES2_PRELOAD,'-'],{cwd:root,env,input:code,timeout:20000});
     assert(p.status!==0&&String(p.stderr).includes('sealed child'),name+': '+p.stderr);
     fs.writeFileSync(path.join(d,'wait.json'),JSON.stringify({exit:common.returncode(p.status,p.signal),actualWait:true,stdoutEOF:true,stderrEOF:true,stderr:String(p.stderr)}));
    }finally{for(const fd of fds)fs.closeSync(fd);}
   }
   run('valid-production-supervisor',base,true);
  }
  console.log('PASS mandatory sealed admission before native/watchdog spawn'+(holderpath?'; exact live Git holder, manifest and actual Worker/process inheritance':' (holder-positive not requested)'));
 }finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
}

// The historical (pre-repair, 68543c27) Python controller cannot be executed
// any more; only the repaired behaviour is checked: a refused bind latches
// closure and no later capture/bind request reaches the endpoint.
async function closure(){
 const m=require(CONTROLLER);
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'disciples2-closure-'));
 const requests=[];
 const server=http.createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{requests.push(JSON.parse(body));res.end(JSON.stringify({ok:false,error:'reviewed native paint changed'}));});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  m.R=d;m.URL='http://127.0.0.1:'+server.address().port+'/ctl';
  const now=Date.now()/1000;m.save('launch.json',{at:now,deadline:now+240,gameplayCutoff:now+60,nativeScene:false});
  m.save('native-pid.json',{pid:process.pid,startToken:common.token(process.pid)});
  await m.bind().catch(()=>{});
  assert.equal(fs.existsSync(path.join(d,'terminal-input-failure.json')),true,'repaired bind failure latches closure');
  for(const operation of [()=>m.capture('later'),()=>m.bind()])await operation().catch(()=>{});
  assert.equal(requests.length,1,JSON.stringify(requests));
 }finally{server.close();fs.rmSync(d,{recursive:true,force:true});}
 const g={owner:'one',epoch:1,nonce:'finite',deadline:5000},r={...g,state:'CONSUMED',consumed:true,consumedAt:4999,receiptBoundary:'native-input-return',nativeMessage:{msg:513}};
 m.confirmReceipt(r,g,5);
 for(const patch of [{receiptBoundary:'host-handler'},{nativeMessage:null},{consumedAt:5000},{consumedAt:5001},{owner:'replacement'},{nonce:'replayed'},{deadline:6000}])
  assert.throws(()=>m.confirmReceipt({...r,...patch},g,5),{name:'AssertionError'},JSON.stringify(patch));
 assert.throws(()=>m.confirmReceipt({...r,consumedAt:4500},g,4.5),{name:'AssertionError'},'capture expiry before operation deadline accepted');
 console.log('PASS repaired bind failure latches closure, zero later requests; native receipt identity/boundary/freshness refusals');
}

async function fixture(){
 const c=require(CONTROLLER);
 const out=path.resolve(process.env.DISCIPLES2_FIXTURE_OUT);fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);c.R=out;
 const port=await new Promise((resolve,reject)=>{const sv=net.createServer();sv.once('error',reject);sv.listen(0,'127.0.0.1',()=>{const p=sv.address().port;sv.close(()=>resolve(p));});});
 c.URL='http://127.0.0.1:'+port+'/ctl';
 Object.assign(process.env,{DISCIPLES2_CONTROL_URL:c.URL,DISCIPLES2_CONTROL_OUT:out});
 const args=['node','test/run.js','--app=sol','--no-build','--no-threads','--real-ticks','--screen=1024x712','--max-seconds=35','--max-batches=10000000','--control='+port,'--quiet-api','--quiet-blocks','--no-close'];
 const h=JSON.parse(fs.readFileSync(process.env.DISCIPLES2_MODULE_HOLDER)),manifest=JSON.parse(s.holderBytes(h,'manifestPath'));
 c.save('recipe.json',{cwd:root,args,seconds:220,watchdogGrace:20,nativeScene:true,moduleHolder:process.env.DISCIPLES2_MODULE_HOLDER,childInheritance:'sealed-node-v1',
  immutableManifest:{manifestSHA256:h.manifestSHA256,...pick(manifest,['gitSHA','sourceSHA256','moduleSHA256','preloadSHA256'])}});
 const p=cp.spawn(process.execPath,[TOOL,'durablewait',out],{stdio:['ignore','pipe','pipe']});
 const waited=common.communicate(p);
 try{
  const end=Date.now()/1000+25;
  while(true){
   try{const snap=await c.call({action:'snapshot'},1);if(snap.mainHwnd!=='0x0'&&snap.focusWindow.live&&snap.physicalUp)break;}catch{}
   assert(Date.now()/1000<end,'synthetic fixture startup');await common.sleep(50);
  }
  await common.sleep(300);await c.capture('synthetic');const rr=c.read('synthetic.json');
  c.save('synthetic-review.json',{at:Date.now()/1000,pngSHA256:rr.pngSHA256,observation:'Automated public Solitaire fixture; no personal original-game review claim'});
  await c.bind('synthetic');await c.pulse('finite',['keydown:40'],100,'synthetic','Synthetic current native tuple and tight timing qualification');
  const done=c.read('finite-complete.json');assert(done.confirmationMs<=500&&done.physicalUpMs<=1750);
  assert.equal(c.read('finite-up.json').state,'ACK');
  c.save('assertions.json',{currentNativeTuple:true,independentRelease:true,confirmationMs:done.confirmationMs,physicalUpMs:done.physicalUpMs});
 }finally{
  try{await c.call({action:'quit'},2);}catch{}
  const w=await Promise.race([waited,common.sleep(15000).then(()=>{throw Error('TimeoutExpired: supervisor');})]);
  c.save('fixture-tool-wait.json',{pid:p.pid,exit:w.returncode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:w.stdout.toString(),stderr:w.stderr.toString()});
 }
 for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json']){
  const w=c.read(name);assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF,JSON.stringify(w));
 }
 console.log('PASS actual current native scene binding, 500ms confirm /1750ms independent UP, all actual child waits and EOF');
}

async function main(){
 await provenance();
 await closure();
 const v=await require('../tools/disciples2-current-preflight.cjs').verify();
 assert.equal(v.media.length,128);assert.equal(v.manifestRows,127);assert.equal(v.missing.length,0);
 const {matches}=require('../lib/cli-native-scene');assert(!matches({},{}));
 console.log('PASS 128 original media hashes, 127 manifest sizes/mappings, complete real-DLL graph');
 if(process.env.DISCIPLES2_FIXTURE_OUT)await fixture();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
