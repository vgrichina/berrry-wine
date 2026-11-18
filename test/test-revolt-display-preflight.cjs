'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {Win98Renderer}=require('../lib/renderer');
const {createCanvas}=require('../lib/raster-canvas');
const {PAGE_READ,createGate}=require('../tools/revolt-display-admission.cjs');
const {displayPreflightExpression,awaitDisplayPreflight}=require('../tools/revolt-capture-integration.cjs');
function fixture(){
  const r=new Win98Renderer(createCanvas(8,8)),instance={};
  const win=r.windows[123]={hwnd:123,x:0,y:0,w:8,h:8,z:1,visible:true,isChild:false,
    style:0x80000000,processId:1000,wasm:instance,_backCanvas:createCanvas(8,8)};
  r.repaint();const wine={renderer:r,instance,processId:1000};
  const owner={running:true,stopped:false,outputVisible:true,windowHwnd:123,processId:1000,
    renderApi:'d3dim-gps',renderEndpoint:1,renderEndpointObject:'d3dim-endpoint'};
  const page={isolated:true,apps:[owner]};
  const evaluate=async expression=>vm.runInNewContext(expression.replace(PAGE_READ,JSON.stringify(page)),{runningApps:[{wine}],Date});
  return {r,win,page,owner,evaluate,observe:()=>evaluate(displayPreflightExpression(owner))};
}
test('real renderer queued resize waits without ticket; matching publication admits',async()=>{
  const f=fixture(),record=f.r._currentDisplayRecord;f.r.canvas.width=10;f.r._repaintScheduled=true;
  const waiting=await f.observe();assert.equal(waiting.ready,false);assert(waiting.pending.includes('ordinary damage'));
  assert.equal(f.r._currentDisplayRecord,record);assert.equal(f.r._immutableCaptureRequest,null);
  const states=[];let t=0;
  const ready=await awaitDisplayPreflight({evaluate:f.evaluate,identity:f.owner,deadline:10,now:()=>t,
    check:()=>{},onObservation:s=>states.push(s),sleep:async()=>{t++;f.r._repaintScheduled=false;f.r.repaint();}});
  assert(ready.ready);assert.equal(states.length,2);assert.equal(f.r._immutableCaptureRequest,null);
});
test('unexplained crop retains exact operands and fails without ticket',async()=>{
  const f=fixture();f.r.canvas.width=10;const v=await f.observe();assert(v.failed);assert.match(v.error,/cropped/);
  assert.equal(v.diagnostic.windows[0].live.w,8);assert.equal(f.r._immutableCaptureRequest,null);
  await assert.rejects(awaitDisplayPreflight({evaluate:f.evaluate,identity:f.owner,deadline:Date.now()+1000,check:()=>{}}),/cropped/);
});
test('ReVolt d3dim endpoint pin, hidden owner and pixel errors are never waiting',async()=>{
  for(const alter of [f=>f.page.apps=[{...f.owner,renderEndpointObject:'replacement'}],
    f=>f.page.apps=[{...f.owner,outputVisible:false}],f=>{f.r._currentDisplayRecord.pixelError=Error('pixel lost');}]){
    const f=fixture();alter(f);f.r._repaintScheduled=true;assert((await f.observe()).failed);
  }
});
test('finite queued-work deadline, transport UNKNOWN and permanent closure',async()=>{
  const f=fixture();f.r._repaintScheduled=true;let t=0,reads=0;const gate=createGate();
  const options={evaluate:async e=>{reads++;return f.evaluate(e);},identity:f.owner,deadline:3,now:()=>t,
    check:()=>gate.check(),sleep:async()=>{t++;}};
  await assert.rejects(awaitDisplayPreflight(options),/deadline/);assert.equal(reads,3);
  await assert.rejects(awaitDisplayPreflight({...options,now:()=>0,evaluate:async()=>{throw Error('transport UNKNOWN');}}),/transport UNKNOWN/);
  gate.seal('actual UNKNOWN');const before=reads;
  await assert.rejects(awaitDisplayPreflight({...options,now:()=>0}),/UNKNOWN/);assert.equal(reads,before);
});
test('release imports prepare before config, without arm or body entry; original body runs only after config',async()=>{
  const {adaptRelease}=require('../tools/revolt-capture-integration.cjs');
  const files=new Map(),events=[],config={keys:['ArrowUp']};let time=0;
  const fs={readFileSync:p=>{events.push('read '+p);return files.get(p);},existsSync:p=>files.has(p),
    writeFileSync:(p,v)=>{files.set(p,v);events.push('marker');}};
  const source="const [out,file]=process.argv.slice(2),cfg=JSON.parse(fs.readFileSync(file));\n(async()=>{events.push('original arm');events.push(cfg.keys[0]);})()";
  await vm.runInNewContext(adaptRelease(source),{fs,assert,process:{argv:['node','release','out','config'],pid:12},
    Date:{now:()=>time},events,sleep:async()=>{assert.deepEqual(events,['marker']);assert.equal(JSON.parse(files.get('config.prepared')).armed,false);time++;files.set('config',JSON.stringify(config));}});
  assert.deepEqual(events,['marker','read config','original arm','ArrowUp']);
});
test('unused prepared release expires finitely without body/arm or config read',async()=>{
  const {adaptRelease}=require('../tools/revolt-capture-integration.cjs');let time=0,body=false,reads=0;
  const source="const [out,file]=process.argv.slice(2),cfg=JSON.parse(fs.readFileSync(file));\n(async()=>{body=true;})()";
  await assert.rejects(vm.runInNewContext(adaptRelease(source),{fs:{readFileSync(){reads++;},existsSync:()=>false,writeFileSync(){}},
    assert,process:{argv:['node','release','out','config'],pid:12},Date:{now:()=>time},sleep:async()=>{time=120001;},body}),/finite release preparation/);
  assert.equal(body,false);assert.equal(reads,0);
});
