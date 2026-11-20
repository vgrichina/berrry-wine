'use strict';
const assert=require('node:assert/strict');
const binding=require(process.env.GLTRON_BINDING_UNDER_TEST||'../tools/gltron-browser-binding.cjs');
function harness(renderer=false){
  let clock=0,reads=0,bytes=0,arms=0;
  const module=Buffer.from('actual-test-module'),hash=binding.sha(module);
  const a=Object.fromEntries(binding.FIELDS.map(k=>[k,k]));
  Object.assign(a,{name:'gltron',running:true,stopped:false,guestWorker:true,outputVisible:true,guestEndpoint:'guest',slot:0,renderEndpoint:'none',renderEndpointObject:'none',renderWorkerObject:'none',renderApi:'none',renderBridgeObject:'none',renderGeneration:'none',publication:12});
  const live={endpointIdentity:'guest',slot:0,instance:'actual-instance'};
  const w={targetId:'target',sessionId:'session',url:'guest-worker.js',closed:false,scripts:[{scriptId:'wasm',sha256:hash,bytecodeAvailable:true}]};
  const workers=new Map([['session',w]]);
  const r={targetId:'render-target',sessionId:'render-session',url:'d3d-render-worker.js',closed:false,scripts:[{scriptId:'render-wasm',sha256:hash,bytecodeAvailable:true}]};
  const endpoint={id:'render-endpoint',api:'gl-gps',epoch:'actual-render-instance',failed:false};
  const hooks={afterArm:()=>{}};
  if(renderer){workers.set('render-session',r);Object.assign(a,{renderEndpoint:endpoint.id,renderApi:endpoint.api});}
  const evaluate=async expression=>{
    if(expression===binding.PAGE_READ)return {isolated:true,apps:[{...a}]};
    if(expression===binding.WORKER_READ){reads++;clock+=594;return {...live};}
    if(expression===binding.RENDER_READ){reads++;clock+=594;return [{...endpoint}];}
    if(expression.includes("capture already armed")){
      const deadline=expression.match(/if\((\d+)!==null&&Date.now\(\)>=/);
      if(deadline&&clock>=Number(deadline[1]))throw Error('bounded PREBIND startup readiness expired before ticket');
      arms++;if(arms===3)throw Error('THIRD_ARM_REACHED');
      hooks.afterArm();
      const nonce=expression.match(/nonce:("[^"]+")/)[1];
      return {state:'NOT_READY',nonce:JSON.parse(nonce),ready:false,pending:['held/in-flight paint'],requestCalled:false,ticketCreated:false,inputDispatched:false};
    }
    return {ready:true};
  };
  const send=async()=>{bytes++;clock+=158;return {bytecode:module.toString('base64')};};
  const chain=binding.createChain({evaluate,send,workers,app:'gltron',expectedModules:[hash],now:()=>clock});
  return {chain,a,live,w,r,endpoint,hooks,workers,cost:()=>({clock,reads,bytes,arms})};
}
(async()=>{
  const h=harness();
  // The old binding lacks this API; exercising its readLive reproduces the
  // repeated cost without modifying the fixed deadline or the predicate.
  if(h.chain.prepareAttestation)await h.chain.prepareAttestation();else await h.chain.readLive();
  const prepared=h.cost();
  await h.chain.prepareStartup(prepared.clock+5000);
  await assert.rejects(h.chain.capture('cost'),/THIRD_ARM_REACHED/);
  assert.equal(h.cost().arms,3);
  assert.equal(h.cost().bytes,1,'unchanged attested bytecode retrieved once');
  assert.equal(h.cost().reads,prepared.reads,'no queued Worker identity reads inside PREBIND');
  assert(h.cost().clock-prepared.clock<5000,'original five second window');
  for(const change of ['instance','worker','module','context','workerContext','script','detach','hidden']){
    const f=harness();await f.chain.readLive();
    if(change==='instance')f.live.instance='replacement';
    if(change==='worker')f.a.workerObject='replacement';
    if(change==='module')f.a.moduleObject='replacement';
    if(change==='context')f.a.epoch='replacement';
    if(change==='workerContext')binding.trackWorkerContext(f.workers,{sessionId:'session',method:'Runtime.executionContextsCleared'});
    if(change==='script')f.w.scripts.push({scriptId:'new-module',bytecodeAvailable:true,sha256:f.w.scripts[0].sha256});
    if(change==='detach')f.w.closed=true;
    if(change==='hidden')f.a.outputVisible=false;
    await assert.rejects(f.chain.readLive(),undefined,change+' invalidates proof');
  }
  const f=harness();await f.chain.readLive();f.a.publication=45;
  f.w.scripts.push({scriptId:'passive-evaluation',url:'',bytecodeAvailable:false,sha256:'javascript-source-hash'});
  assert.equal((await f.chain.readLive()).identity.publication,45,'publication is always live');
  assert.equal(f.cost().bytes,1);
  // Replacing a context after preparation must fail before even the first
  // pre-ticket arm, with no Worker query, capture request or guest input.
  for(const method of ['Runtime.executionContextCreated','Runtime.executionContextDestroyed','Runtime.executionContextsCleared']){
    const f=harness();await f.chain.prepareAttestation();const before=f.cost();
    binding.trackWorkerContext(f.workers,{sessionId:'session',method});
    await assert.rejects(f.chain.prepareStartup(before.clock+5000),/changed/);
    assert.deepEqual(f.cost(),before);assert(f.chain.closed);
  }
  for(const change of ['epoch','failed','module','context']){
    const f=harness(true);await f.chain.readLive();const count=f.cost();
    await f.chain.readLive();assert.equal(f.cost().bytes,count.bytes,'both actual modules reused');
    if(change==='epoch')f.endpoint.epoch='new-instance';
    if(change==='failed')f.endpoint.failed=true;
    if(change==='module')f.r.scripts.push({scriptId:'pending',url:'wasm://new-module'});
    if(change==='context')binding.trackWorkerContext(f.workers,{sessionId:'render-session',method:'Runtime.executionContextDestroyed'});
    await assert.rejects(f.chain.readLive(),undefined,'renderer '+change);
  }
  for(const change of ['module','context','detach']){
    const f=harness();await f.chain.prepareAttestation();await f.chain.prepareStartup(f.cost().clock+5000);
    f.hooks.afterArm=()=>{
      if(change==='module')f.w.scripts.push({scriptId:'pending',url:'wasm://new-module'});
      if(change==='context')binding.trackWorkerContext(f.workers,{sessionId:'session',method:'Runtime.executionContextsCleared'});
      if(change==='detach')f.w.closed=true;
    };
    await assert.rejects(f.chain.capture('invalidate'),/changed/);
    assert.equal(f.cost().arms,1,'no next arm after incarnation change');assert(f.chain.closed);
  }
  console.log(JSON.stringify({status:'PASS',cost:h.cost(),prepared,invalidations:18,livePublication:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
