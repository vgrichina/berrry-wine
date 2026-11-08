'use strict';
// Exercise the exact original host's public retirement path against the gate.
// CDP and pixel inputs are controlled; no browser or original game is launched.
const assert=require('node:assert/strict'),vm=require('node:vm'),cp=require('node:child_process');
const {createHash}=require('node:crypto');
const {fixture}=require('./strict-software-gate.test.cjs');
const provider='49874a81c5ae180c20a15c6bb169d9041f028cae';
const source=cp.execFileSync('git',['show',provider+':lib/guest-thread-host.js'],{cwd:__dirname});
const sourceSha256=createHash('sha256').update(source).digest('hex');
assert.equal(sourceSha256,'e0e08fe53622ba43463ed8ef5ce492c1188ddf3376523bc9f74727649a34892e');
const host=vm.createContext({GuestRpc:{},processBoot:{},ThreadSendWaits:{},setTimeout,clearTimeout});
vm.runInContext(source.toString('utf8'),host,{filename:'49874a81:lib/guest-thread-host.js'});
const {GuestWorkerLink:WorkerLink}=host;
function actualLink(f,{loader=false}={}){
 const link=new WorkerLink({slot:0,module:{},memory:f.w.memory});
 let finish,request;
 const drained=new Promise(resolve=>{finish=resolve;});
 link.worker={terminate:()=>drained,postMessage:message=>{request=message;}};
 link._scopedLoaderUsed=loader;
 f.w.guestWorker.link=link;
 vm.runInContext('endpointIdentity='+link.endpointIdentity,f.guestRealm);
 return {link,finish(){
  if(loader){
   assert.equal(request?.t,'retireScopedLoaders');
   // Deliver the controlled Worker reply through the original host dispatcher.
   link._onMessage({t:'scopedLoadersRetired',seq:request.seq,retired:true,endpointIdentity:link.endpointIdentity});
  }
  finish();
 }};
}
(async()=>{
 const f=fixture(),{link,finish}=actualLink(f),g=await f.start();
 await g.probe({phase:'beforeResume'});
 f.setPixel([255,1,0,255]);f.copy();assert(!(await g.probe()).qualified);
 const originalWorker=link.worker,retirement=link.stop();
 assert(link._stopping&&link._stopped&&!link._retirementComplete);
 assert.equal(link.worker,originalWorker,'retiring worker reference remains until actual drain');
 assert(!f.worker.closed,'CDP detach has not arrived');
 f.setPixel([255,2,0,255]);f.copy();
 try{
  await assert.rejects(async()=>{
   const result=await g.probe();
   console.log(JSON.stringify({unexpectedAdmission:true,qualified:result.qualified,
    linkStopping:link._stopping,linkStopped:link._stopped,cdpDetached:f.worker.closed}));
   return result;
  },/retir|stopp|live/i,
   'retiring original WorkerLink must never produce a qualified Software certificate');
  assert(g.closed);
  const calls=f.calls.length;await assert.rejects(()=>g.probe(),/no replay/);assert.equal(f.calls.length,calls);
 }finally{finish();await retirement;}
 assert(link._retirementComplete&&link.worker===null);
 let phaseRejections=0;
 for(const phase of ['entry','source','owner1','owner2','pixels','return']) {
  for(const loader of [false,true]) {
   let enabled=false,retirement,life;
   const stop=()=>{
    if(!retirement){
     retirement=life.link.stop();
     assert(life.link._stopping);
     assert.equal(life.link._stopped,!loader,'loader drain must also fence before termination starts');
    }
   };
   const n=fixture({
    source(){if(enabled&&phase==='source')stop();},
    save(f,row){if(enabled&&(row.phase===phase||row.phase==='owner'&&phase==='owner'+row.read))stop();},
   });
   life=actualLink(n,{loader});const guard=await n.start();
   await guard.probe({phase:'beforeResume'});
   n.setPixel([255,1,0,255]);n.copy();assert(!(await guard.probe()).qualified);
   n.setPixel([255,2,0,255]);n.copy();enabled=true;
   try{
    await assert.rejects(()=>guard.probe(),/retir|stopp|live/i,phase+' loader='+loader);
    assert(guard.closed);assert.equal(n.pending,0,'source lanes drain after retirement');
    const calls=n.calls.length;await assert.rejects(()=>guard.probe(),/no replay/);assert.equal(n.calls.length,calls);
   }finally{life.finish();await retirement;}
   assert(life.link._retirementComplete&&life.link.worker===null);phaseRejections++;
  }
 }
 let flagRejections=0;
 for(const flag of ['hostStopped','linkStopped','transportFailure','loaderRetirementFault','retirementComplete','workerScopedRetiring']) {
  const n=fixture(),guard=await n.start();await guard.probe({phase:'beforeResume'});
  n.setPixel([255,1,0,255]);n.copy();assert(!(await guard.probe()).qualified);
  if(flag==='hostStopped')n.w.guestWorker._stopped=true;
  if(flag==='linkStopped')n.w.guestWorker.link._stopped=true;
  if(flag==='transportFailure')n.w.guestWorker.link._transportFailure=Error('actual transport failed');
  if(flag==='loaderRetirementFault')n.w.guestWorker.link._loaderRetirementFault=Error('actual loader retirement failed');
  if(flag==='retirementComplete')n.w.guestWorker.link._retirementComplete=true;
  if(flag==='workerScopedRetiring')vm.runInContext('var scopedRetiring=true',n.guestRealm);
  n.setPixel([255,2,0,255]);n.copy();
  await assert.rejects(()=>guard.probe(),/retir|stopp|live/i,flag);assert(guard.closed);assert.equal(n.pending,0);
  const count=n.calls.length;await assert.rejects(()=>guard.probe(),/no replay/);assert.equal(n.calls.length,count);flagRejections++;
 }
 console.log(JSON.stringify({passed:true,provider,sourceSha256,publicStop:true,
  retirementBeforeCDPDetachRefused:true,phaseRejections,flagRejections,allLanesDrained:true,
  stickyUnknown:true,noReplay:true,mockCDP:true,originalGame:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
