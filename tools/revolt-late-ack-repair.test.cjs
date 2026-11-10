'use strict';
// Small local protocol fixture: exact retained execute/capture/state, pulse,
// numbered consume and separate request process. Only CDP observations and
// their authored latency are substituted; no browser, game media, or box.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),cp=require('node:child_process');
const repair=require('./revolt-late-ack-repair.cjs');
const root=path.resolve(__dirname,'..'),history=path.join(root,repair.selected);
const evidence=path.resolve(process.env.REVOLT_ACK_EVIDENCE||path.join(root,'scratch/runs/20261110-revolt-late-ack-causal-repair-0100/fixture-'+Date.now()));
fs.mkdirSync(evidence,{recursive:true});
// Observe atomic publication in both actual processes without changing the
// selected caller or ACK client's code or timeout. Retain tiny run inputs.
const observer=path.join(evidence,'rename-observer.cjs');
fs.writeFileSync(observer,`const fs=require('node:fs');const rename=fs.renameSync;
fs.renameSync=function(a,b){const start=Date.now();const result=rename.apply(this,arguments);
if(/(?:commands\\/0|reply-0)\\.json$/.test(b))fs.appendFileSync(process.env.REVOLT_ACK_RENAMES,JSON.stringify({path:b,start,completed:Date.now(),pid:process.pid})+'\\n');return result;};\n`);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),sha=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
const base=require('./gltron-logical-fps-local.cjs'),transport=require(history+'/transport.cjs');
const browser=fs.readFileSync(history+'/browser.cjs','utf8');
repair.browserSource(browser); // Verify the runnable entry uses this adapter.
const bytes=Buffer.from('small authored immutable wasm proof'),digest=sha(bytes);
const old=require(history+'/bound-input.cjs'),fixed=repair.loadBound(history+'/bound-input.cjs');
function environment(bound) {
  let slow=false,sourceReads=0,shotReads=0,instance='instance',renderer='render-epoch';
  let hook=async()=>{};
  const events=[],trace=[];
  const worker={sessionId:'guest',targetId:'guest-target',url:'guest-worker',scripts:[{scriptId:'guest-script',bytecodeAvailable:true,sha256:digest}],closed:false};
  const render={sessionId:'render',targetId:'render-target',url:'d3d-render-worker',scripts:[{scriptId:'render-script',bytecodeAvailable:true,sha256:digest}],closed:false};
  const workers=new Map([['guest',worker],['render',render]]);
  const app={name:'re_volt_demo',running:true,stopped:false,guestWorker:true,guestEndpoint:1,slot:0};
  for(const f of bound.FIELDS)app[f]=f;
  app.renderEndpoint=2;
  const evaluate=async expression=>{
    await hook({expression});
    if(expression===bound.PAGE_READ)return {isolated:true,apps:[structuredClone(app)]};
    if(expression===bound.WORKER_READ)return {endpointIdentity:1,slot:0,instance};
    if(expression===bound.RENDER_READ)return [{id:2,epoch:renderer,failed:false,control:{error:0}}];
    return {at:new Date().toISOString(),apps:[]}; // passive controller state
  };
  const send=async(method,params,session)=>{
    await hook({method,session});
    const row={method,session,at:Date.now()};trace.push(row);
    if(method==='Debugger.getScriptSource') {sourceReads++;if(slow)await wait(3000);row.done=Date.now();return {bytecode:bytes.toString('base64')};}
    if(method==='Page.captureScreenshot') {shotReads++;if(slow)await wait(11000);row.done=Date.now();return {data:Buffer.from('authored pixels').toString('base64')};}
    assert.equal(method,'Input.dispatchKeyEvent');events.push({type:params.type,at:Date.now()});
    return {};
  };
  const chain=bound.createChain({evaluate,send,workers,pageSession:'page',app:'re_volt_demo',expectedModules:[digest]});
  return {chain,evaluate,send,workers,events,trace,worker,render,app,
    slow(){slow=true;sourceReads=shotReads=0;},counts:()=>({sourceReads,shotReads}),
    hook(fn){hook=fn;},
    instance(v){instance=v;},renderer(v){renderer=v;}};
}
function controller(out,f,deadline) {
  const save=(n,v)=>base.writeJson(path.join(out,n),v);
  const ctx=vm.createContext({fs,path,assert,sha,save,wait,console,Date,Promise,Buffer,
    out,deadline,terminal:false,latest:null,chain:f.chain,evaluate:f.evaluate,send:f.send,
    workers:f.workers,workerPromises:[],pageSession:'page',log(){},
    fail(e){throw e;},pulse:require(history+'/input.cjs').pulse,
    require:id=>require(path.resolve(history,id))});
  // Exact function bodies; no rewritten ACK, capture or input ordering.
  vm.runInContext(browser.slice(browser.indexOf('async function state()'),browser.indexOf('async function close(')),ctx);
  vm.runInContext(browser.slice(browser.indexOf('async function execute('),browser.indexOf('\n(async()=>{')),ctx);
  return ctx;
}
async function boundary(name,bound) {
  const out=path.join(evidence,name);fs.mkdirSync(out);fs.mkdirSync(out+'/commands');
  const f=environment(bound),deadline=Date.now()+100000;
  const ctx=controller(out,f,deadline);
  await f.chain.establishReady({stableMs:0,wait:async()=>{}});
  await ctx.capture('startup');f.slow();
  const command={...JSON.parse(fs.readFileSync(history+'/recovered/original/commands/29.json')),reviewRef:'startup',review:'authored fixture pixels only'};
  const started=Date.now();
  const renames=out+'/atomic-renames.jsonl';
  const child=cp.spawn(process.execPath,['--require',observer,history+'/request.cjs',out,JSON.stringify(command)],
    {stdio:['ignore','pipe','pipe'],env:{...process.env,REVOLT_ACK_RENAMES:renames}});
  let stdout='',stderr='',exit,stdoutEOF=false,stderrEOF=false;
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  child.stdout.on('end',()=>{stdoutEOF=true;});child.stderr.on('end',()=>{stderrEOF=true;});
  child.on('exit',(code,signal)=>{exit={code,signal,at:Date.now(),actualWait:true};});
  const closed=new Promise(resolve=>child.once('close',()=>resolve()));
  while(!fs.existsSync(out+'/commands/0.json')) {assert(Date.now()-started<3000);await wait(5);}
  const published=Date.now();
  const rename=fs.renameSync;
  fs.renameSync=function(a,b) {
    const start=Date.now(),result=rename.apply(this,arguments);
    if(b===out+'/reply-0.json')fs.appendFileSync(renames,JSON.stringify({path:b,start,completed:Date.now(),pid:process.pid})+'\n');
    return result;
  };
  try {await transport.consume(out,0,ctx.execute);} finally {fs.renameSync=rename;}
  const replyWritten=Date.now();await closed;
  assert(stdoutEOF&&stderrEOF);assert.equal(f.events.length,2);
  assert.deepEqual(f.events.map(e=>e.type),['keyDown','keyUp']);
  assert(f.events[1].at-f.events[0].at>=14900,'original independent 15 second release');
  assert.equal(ctx.deadline,deadline,'immutable runtime deadline unchanged');
  assert.equal(JSON.parse(fs.readFileSync(out+'/reply-0.json')).id,'onward-corner');
  if(name==='baseline') {
    assert.equal(exit.code,1);assert.match(stderr,/ACK deadline/);
    assert(fs.existsSync(out+'/transport-closed.json'));
    assert(replyWritten>exit.at,'actual successful reply is late');
    for(const id of ['onward-corner','new-command'])await assert.rejects(transport.request(out,id,{action:'capture',id},100),/sticky|EEXIST/);
    let replay=0;await assert.rejects(transport.consume(out,0,async()=>replay++),/sticky|duplicate/);assert.equal(replay,0);
    assert.equal(f.counts().sourceReads,6);
  } else {
    assert.equal(exit.code,0,stderr);assert.equal(JSON.parse(stdout).id,'onward-corner');
    assert(!fs.existsSync(out+'/transport-closed.json'));assert.equal(f.counts().sourceReads,0);
    let replay=0;await assert.rejects(transport.consume(out,0,async()=>replay++),/duplicate/);assert.equal(replay,0);
  }
  const atomicRenames=fs.readFileSync(renames,'utf8').trim().split('\n').map(s=>JSON.parse(s));
  assert.equal(atomicRenames.length,2);assert(atomicRenames[1].completed-atomicRenames[0].completed>26000);
  const record={name,started,publicationObservedAt:published,replyWriteObservedAt:replyWritten,atomicRenames,exit,stdoutEOF,stderrEOF,stdout,stderr,
    elapsedMs:replyWritten-published,deadline,counts:f.counts(),events:f.events,trace:f.trace,
    authoredLatency:{moduleReadMs:3000,screenshotMs:11000},ackLimitMs:40000,holdMs:15000};
  base.writeJson(out+'/fixture-result.json',record);console.log(JSON.stringify({name,elapsedMs:record.elapsedMs,counts:record.counts,exit}));
}
async function negatives() {
  for(const mutate of [
    f=>{f.worker.closed=true;},f=>{f.render.closed=true;},
    f=>{f.workers.set('guest',{...f.worker});},f=>{f.workers.set('render',{...f.render});},
    f=>{f.worker.scripts[0].sha256='0'.repeat(64);},
    f=>{f.render.scripts.push({scriptId:'foreign',sha256:digest,bytecodeAvailable:true});},
    f=>{f.worker.scripts.push({scriptId:'pending'});},
    f=>{f.render.scripts[0].error='read failed';},
    f=>{f.instance('replacement');},f=>{f.renderer('replacement');},
    f=>{f.app.pageRendererObject='replacement';},
  ]) {
    const f=environment(fixed);await f.chain.establishReady({stableMs:0,wait:async()=>{}});
    await f.chain.capture('before');mutate(f);
    const before=await f.chain.readLive().then(x=>x,()=>null);
    assert.equal(before,null,'changed ownership must fail cached proof');
  }
  for(const phase of ['retrieval','cached-read']) {
    const f=environment(fixed);
    if(phase==='cached-read')await f.chain.establishReady({stableMs:0,wait:async()=>{}});
    let mutated=false;
    f.hook(async({method,expression})=>{
      if(!mutated&&(phase==='retrieval'?method==='Debugger.getScriptSource':expression===fixed.RENDER_READ)) {
        mutated=true;f.worker.scripts.push({scriptId:'new',sha256:digest,bytecodeAvailable:true});
      }
    });
    await assert.rejects(f.chain.readLive(),/inventory|module/);assert(mutated);
  }
  const f=environment(fixed);
  f.render.scripts[0].bytecodeAvailable=false;
  await assert.rejects(f.chain.establishReady({stableMs:0,wait:async()=>{}}),/module/);
  const changed=environment(fixed);changed.worker.scripts[0].sha256='0'.repeat(64);
  await assert.rejects(changed.chain.readLive(),/live module bytes changed/);
  assert.throws(()=>repair.boundSource('changed'),/unrecognized/);
  console.log('PASS cached proof retirement, inventory, instance and source-pin negatives');
}
async function safety() {
  const f=environment(fixed),out=path.join(evidence,'expired');fs.mkdirSync(out);fs.mkdirSync(out+'/commands');
  const deadline=Date.now()-1,ctx=controller(out,f,deadline);
  await assert.rejects(ctx.execute({action:'key',id:'expired'},()=>{}),/immutable deadline/);
  assert.equal(f.events.length,0);assert.equal(ctx.deadline,deadline);
  const pulse=require(history+'/input.cjs').pulse;
  const edges=[];let receipt;
  await assert.rejects(pulse({deadline:Date.now()+2000,holdMs:100,ackMs:150,
    down:()=>{edges.push('down');return new Promise(()=>{});},up:async()=>{edges.push('up');},
    save:r=>{receipt=structuredClone(r);}}),/UNKNOWN/);
  assert.deepEqual(edges,['down','up']);assert(receipt.down.unknown&&receipt.up.ack);
  assert(receipt.upAttemptedAt<receipt.start+150,'UP independent of missing DOWN ACK');
  base.writeJson(evidence+'/independent-release.json',receipt);
  console.log('PASS immutable expiry and independent UP after UNKNOWN DOWN');
}
(async()=>{await negatives();await safety();if(!process.argv.includes('--quick')) {await boundary('baseline',old);await boundary('repaired',fixed);}})().catch(e=>{console.error(e);process.exitCode=1;});
