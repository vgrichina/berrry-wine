'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {Win98Renderer}=require('../lib/renderer'),{createCanvas}=require('../lib/raster-canvas');
const binding=require(process.env.GLTRON_BINDING_UNDER_TEST||'../tools/gltron-browser-binding.cjs');
function fixture(){
 const r=new Win98Renderer(createCanvas(8,8)),instance={};
 const win=r.windows[123]={hwnd:123,x:0,y:0,w:8,h:8,z:1,visible:true,isChild:false,style:0x80000000,processId:1000,wasm:instance,_backCanvas:createCanvas(8,8)};
 r.repaint();r.requestCurrentDisplayCapture({hwnd:123,processId:1000,instance});r.repaint();
 const identity=Object.fromEntries(binding.FIELDS.map(k=>[k,k]));
 Object.assign(identity,{windowHwnd:123,processId:1000,running:true,stopped:false,outputVisible:true,publication:r._immutablePublicationSequence});
 const page={isolated:true,apps:[{...identity}]},wine={renderer:r,instance,processId:1000,requestCurrentDisplayCapture:o=>r.requestCurrentDisplayCapture({...o,processId:1000,instance})};
 let calls=0;const context=vm.createContext({runningApps:[{wine}],Date,performance,globalThis:{},
  document:{createElement:()=>createCanvas(1,1)},ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}}});
 const evaluate=async expression=>{calls++;return vm.runInContext(expression.replaceAll(binding.PAGE_READ,JSON.stringify(page)),context);};
 return {r,win,wine,identity,page,evaluate,calls:()=>calls};
}
test('readiness and synchronous arm accept the validated retained publication during a later writer',async()=>{
 const f=fixture(),record=f.r._currentDisplayRecord,at=record.displayedAt;
 f.r.beginWorkerGuestSlice();f.r._workerGdiPaintDepth=1;
 f.wine._dxDirty=true;f.r._repaintScheduled=true;
 const ready=await f.evaluate(binding.readinessExpression(f.identity));
 assert.equal(ready.ready,true,'retained completed publication remains current during later work');
 assert.equal(ready.displayedAt,at);assert.equal(f.r._currentDisplayRecord,record);
 const shot=await binding.captureScene({evaluate:f.evaluate,identity:f.identity});
 assert(shot.png.length);assert.equal(shot.metadata.retainedPublicationPixels,true);
 assert.equal(shot.metadata.publication,f.identity.publication);assert.equal(shot.metadata.displayedAt,at);
 assert.equal(shot.metadata.rendererWorkAtRequest.writerHeld,true);
 assert.equal(f.r._workerPublicationHeld(),true);assert.equal(f.r._immutablePublicationSequence,f.identity.publication);
});
test('without retained pixels a held writer remains a passive NOT_READY with no ticket',async()=>{
 const f=fixture();delete f.r._currentDisplayRecord.pixels;f.r.beginWorkerGuestSlice();
 const v=await binding.captureScene({evaluate:f.evaluate,identity:f.identity});
 assert.equal(v.state,'NOT_READY');assert.equal(v.ticketCreated,false);assert.equal(f.r._immutableCaptureRequest,null);
});
for(const kind of ['window','instance','output','identity','pixel-error'])test('retained held publication refuses replaced '+kind,async()=>{
 const f=fixture();f.r.beginWorkerGuestSlice();
 if(kind==='window')f.r.windows[123]={...f.win};
 if(kind==='instance')f.win.wasm={};
 if(kind==='output')f.r.canvas.width=9;
 if(kind==='identity')f.page.apps[0].renderEndpointObject='replacement';
 if(kind==='pixel-error')f.r._currentDisplayRecord.pixelError=Error('lost context');
 await assert.rejects(binding.captureScene({evaluate:f.evaluate,identity:f.identity}),/changed|lost context/);
 assert.equal(f.r._immutableCaptureRequest,null);
});
test('lost retained canvas context fails the ticket on the changed arm path',async()=>{
 const f=fixture();f.r.beginWorkerGuestSlice();
 f.r._currentDisplayRecord.pixels.source.getContext=()=>{throw Error('lost retained context');};
 await assert.rejects(binding.captureScene({evaluate:f.evaluate,identity:f.identity}),/lost retained context/);
 assert.equal(f.r._immutableCaptureRequest,null);
});
test('expired intent refuses retained held pixels before creating a ticket',async()=>{
 const f=fixture();f.r.beginWorkerGuestSlice();
 await assert.rejects(binding.captureScene({evaluate:f.evaluate,identity:f.identity,precheckDeadline:Date.now()-1}),/expired before ticket/);
 assert.equal(f.r._immutableCaptureRequest,null);assert.equal(f.calls(),1);
});
test('whole operator shares immutable module recovery and invalidates each incarnation',async()=>{
 const workers=new Map(),worker={targetId:'target',sessionId:'session',contextEpoch:1,scripts:[{scriptId:'wasm1',url:'wasm://one'}]};
 workers.set('session',worker);let fetches=0,pin={moduleObject:1,instanceObject:2,role:'guest'};
 const send=async(method)=>method==='Runtime.evaluate'?{result:{value:{...pin}}}:(fetches++,{bytecode:Buffer.from('actual module').toString('base64')});
 const cached=binding.createAttestedModuleSource({send,workers}),read=()=>cached('Debugger.getScriptSource',{scriptId:'wasm1'},'session');
 const first=await read();assert(Object.isFrozen(first));
 for(let i=0;i<7;i++)assert.equal(await read(),first);
 assert.equal(fetches,1);
 for(const mutate of [()=>pin.moduleObject++,()=>pin.instanceObject++,()=>worker.contextEpoch++,()=>worker.scripts.push({scriptId:'wasm2',url:'wasm://two'}),()=>workers.set('session',{...worker})]){
   mutate();const before=fetches;await read();await read();assert.equal(fetches,before+1);
 }
 workers.get('session').closed=true;await assert.rejects(read(),/live module Worker/);
});
test('module recovery refuses a context change across bytecode transport',async()=>{
 const worker={targetId:'target',sessionId:'session',contextEpoch:1,scripts:[]},workers=new Map([['session',worker]]);
 const send=async(method)=>{if(method==='Runtime.evaluate')return {result:{value:{moduleObject:1}}};worker.contextEpoch++;return {bytecode:'YWJj'};};
 await assert.rejects(binding.createAttestedModuleSource({send,workers})('Debugger.getScriptSource',{scriptId:'1'},'session'),/changed during recovery/);
});
