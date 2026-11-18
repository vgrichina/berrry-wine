'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const h=require('../tools/nfs3-scene-latency.cjs');
// Diagnostic wrappers must preserve the actual message payload and transfer
// arguments. Synthetic clocks here test arithmetic, never native freshness.
let wall=1000,mono=1000,posted;
const context={Date:{now:()=>wall},performance:{timeOrigin:0,now:()=>mono},Reflect,
  postMessage:(...args)=>{posted=args;return 17;}};
vm.runInNewContext(h.workerBootstrap(),context);
const sample=[-1,2,1000,10,10,0,0,1,0,1,0,900,900,7];
const message={t:'calls',slot:1,list:[42,sample]},transfer=[];
assert.equal(context.postMessage(message,transfer),17);
assert.equal(posted[0].list,message.list);assert.equal(posted[1],transfer);
assert.equal(message.__nfsLatencySend,undefined,'original payload untouched');
assert.equal(posted[0].__nfsLatencySend.wall,1000);
for(const m of [{t:'rpc',slot:1},{t:'calls',list:[42,[0]]}]){
 context.postMessage(m);assert.equal(posted[0],m,'unrelated messages unchanged');
}
let listener,observer;
class Worker {addEventListener(name,fn){assert.equal(name,'message');listener=fn;}}
const page={Worker,Date:{now:()=>wall},performance:{timeOrigin:0,now:()=>mono},
  PerformanceObserver:class {constructor(fn){observer=fn;}observe(o){assert.equal(o.type,'longtask');}}};
vm.runInNewContext(`(${h.installPage.toString()})();`,page);new page.Worker();
wall=1300;mono=1300;
listener({data:{...message,__nfsLatencySend:{wall:1000,mono:1000}}});
observer({getEntries:()=>[{startTime:990,duration:310}]});
const report=JSON.parse(JSON.stringify(page.nfs3LatencyReport()));
assert.equal(report.rows[0].producerWall,900,'receipt never renews producer');
assert.equal(report.rows[0].endpoint,7);assert.equal(report.rows[0].slot,1);
const a=h.analyze(report);assert.equal(a.maxQueueMs,100);assert.equal(a.maxTransportMs,300);
assert.equal(a.lateReceipts,1);assert.equal(a.values[0].overlappingLongTasks.length,1);
assert.equal(a.values[0].producerAgeMs,400);
report.rows[0].sent.mono=1290;
assert.equal(h.analyze(report).maxQueueMs,390,'worker queue distinct from transport');
for(let n=0;n<600;n++)listener({data:{...message,__nfsLatencySend:{wall:1000,mono:1000}}});
assert.equal(page.nfs3LatencyReport().rows.length,512,'bounded retention');
assert.equal(report.extraGuestPolls,0);assert.equal(report.guestWrites,0);
async function preparationChecks(){
 function fixture(){
  const scene=[2,1000,10,10,0,0,1,0,1,0],actor={worker:{},endpointIdentity:17};
  const backend={link:{slot:0},threadLinks:new Map([[1,actor]])};
  let ready=false;
  const wine={renderer:{windows:{10:{}}},memory:{buffer:{}},instance:{},_wasmModule:{},
   _processObject:{},guestWorker:backend,hostCtx:{d3dimBridge:{endpoint:{},presenter:{layer:{}}}},
   _renderWorkerManager:{worker:{}},_browserNativeInput:{snapshot:()=>({
    scene:scene.slice(),slot:1,healthy:true,terminal:false,ready,observedAt:ready?2000:1000})}};
  return {wine,actor,scene,ready:()=>{ready=true;}};
 }
 const f=fixture();setTimeout(f.ready,30);const r=await h.prepareCapture(f.wine,{budgetMs:200});
 assert(r.samples>1);assert.equal(r.first.ready,false);assert.equal(r.last.ready,true);
 assert.equal(r.first.observedAt,1000,'never renew previous native observation');
 for(const [name,mutate]of Object.entries({
  worker:f=>f.actor.worker={},endpoint:f=>f.actor.endpointIdentity++,
  window:f=>f.wine.renderer.windows[10]={},generation:f=>f.scene[6]++,
  process:f=>f.wine._processObject={},backend:f=>f.wine.guestWorker={...f.wine.guestWorker},
  render:f=>f.wine._renderWorkerManager.worker={},
  retired:f=>f.actor._retirementComplete=true,stopping:f=>f.actor._stopping=true,
  closed:f=>f.wine.hostCtx.d3dimBridge.endpoint.closed=true,
  incomplete:f=>f.scene.pop(),
 })){const f=fixture();setTimeout(()=>{mutate(f);f.ready();},10);
  await assert.rejects(h.prepareCapture(f.wine,{budgetMs:200}),/owner\/generation changed/,name);}
 await assert.rejects(h.prepareCapture(fixture().wine,{budgetMs:40}),/expired/);
 await assert.rejects(h.prepareCapture(fixture().wine,{budgetMs:3001}),/budget/);
}
preparationChecks().then(()=>console.log('PASS transport diagnostics preserve producer clocks; bounded passive capture preparation and owner/generation/timeout negatives'))
 .catch(e=>{console.error(e);process.exitCode=1;});
