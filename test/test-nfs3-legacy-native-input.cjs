'use strict';
const assert=require('node:assert/strict');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
function fixture(){
 let wall=1000,mono=0;const instance={},memory={buffer:new ArrayBuffer(4096)},module={};
 const win={visible:true,wasm:instance,processId:7};
 const manager={options:{memory,module},worker:{},ports:new Map()};
 const endpoint={id:1,manager,options:{api:'d3dim-gps'},closed:false};manager.ports.set(1,endpoint);
 const bridge={api:'d3dim-gps',endpoint,device:{worker:true},workerEpoch:1,presenter:{win,layer:{canvas:{}}}};
 const renderer={canvas:{},inputQueue:[],windows:{10:win},handleKeyDown(code){this.inputQueue.push({hwnd:10,msg:0x100,wParam:code,lParam:1});}};
 const wine={instance,memory,_wasmModule:module,_processObject:{},running:true,guestWorker:{link:{}},renderer,processId:7,_renderWorkerManager:manager,hostCtx:{d3dimBridge:bridge,getD3dimBridge:()=>bridge}};
 const guard=createBrowserNativeInput(wine,{now:()=>wall,monotonic:()=>mono,trusted:()=>true});
 const scene=[1,7,10,10,0,0,1,0,1,0],call=(name,fn)=>guard.withActor(0,name,fn);
 call('check_input',()=>guard.observe(scene));
 const prepare=()=>{const binding=guard.bind();return guard.prepare({owner:binding.owner,nonce:'legacy',code:38,reviewed:true,reviewedAt:1000,imageSHA256:'a'.repeat(64),mode:'game'});};
 const down=()=>{renderer.handleKeyDown(38);const event=renderer.inputQueue.shift(),token=call('check_input',()=>guard.dequeued(event));const d=new DataView(wine.memory.buffer);[10,0x100,38,1].forEach((n,i)=>d.setUint32(32+i*4,n,true));return token;};
 return {wine,guard,bridge,manager,endpoint,win,prepare,down,scene,call,clock:(w,m)=>{wall=w;mono=m;}};
}
{
 const f=fixture();assert.equal(f.guard.snapshot().ready,true);f.prepare();const token=f.down();
 assert(token>0);assert.equal(f.guard.status('legacy').consumed,false);
 assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),1);
 assert.equal(f.guard.status('legacy').consumed,true);
}
const faults={bridge:f=>f.wine.hostCtx.d3dimBridge={},api:f=>f.bridge.api='gl-gps',
 endpoint:f=>f.bridge.endpoint={...f.endpoint},endpointApi:f=>f.endpoint.options.api='gl-gps',
 manager:f=>f.wine._renderWorkerManager={},worker:f=>f.manager.worker={},
 module:f=>f.manager.options.module={},memory:f=>f.manager.options.memory={},
 port:f=>f.manager.ports.delete(1),retired:f=>f.manager._retired=true,
 device:f=>f.bridge.device={worker:true},window:f=>f.bridge.presenter.win={},
 epoch:f=>f.bridge.workerEpoch++,closed:f=>f.endpoint.closed=true,
 error:f=>f.bridge.workerAsyncError=Error('authored'),closing:f=>f.bridge.workerClosing={},
 ambiguous:f=>f.wine.hostCtx.getGlGpsBridge=()=>({endpoint:{}})};
for(const [name,mutate]of Object.entries(faults)){
 const f=fixture();f.prepare();const token=f.down();mutate(f);
 assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),0,name);
 assert.equal(f.guard.status('legacy').consumed,false,name);
}
for(const [name,mutate]of Object.entries(faults)){
 if(['worker','device','epoch','endpoint'].includes(name))continue; // replacement before binding can be a valid new owner
 const f=fixture();mutate(f);assert.throws(()=>f.guard.bind(),/unavailable/,name);
}
for(const [wall,mono]of [[1500,500],[1000,500]]){
 const f=fixture();f.prepare();const token=f.down();f.clock(wall,mono);
 assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),0);
}
{
 const f=fixture();f.clock(16001,0);f.call('check_input',()=>f.guard.observe(f.scene));
 assert.throws(()=>f.prepare(),/refused/,'15 second reviewed game freshness unchanged');
}
console.log('PASS legacy native USER return; actual manager/port/module/memory/window identity; ambiguity/replacement/fault and unchanged500ms/15s guards');

// A D3DIM consumer can be open while DirectDraw presents its primary from
// CPU memory (loading screens and software games). Exercise the real host
// copy, rather than authoring presenter.win as the graphics-only fixture does.
function cpuFixture(){
 const f=fixture(),{wine,win}=f;
 const {createCanvas}=require('../lib/canvas-compat');
 const {createHostImports}=require('../lib/host-imports');
 const {Bridge}=require('../lib/d3dim-host');
 const regions=require('../lib/region-map.generated');
 const memory=wine.memory={buffer:new ArrayBuffer(128*1024*1024)};
 f.manager.options.memory=memory;
 const e=wine.instance.exports={get_main_hwnd:()=>10,get_dx_present_hwnd:()=>10,
  get_dx_exclusive_hwnd:()=>10,get_dx_primary_pal_wa:()=>0};
 Object.assign(win,{hwnd:10,x:0,y:0,w:4,h:3,wasmMemory:memory});
 Object.assign(wine.renderer,{getWindowCanvas:()=>({ctx:createCanvas(4,3).getContext('2d')}),
  nextSurfaceWriteSeq:()=>1,scheduleRepaint(){}});
 const bridge=new Bridge({getMemory:()=>memory,renderer:wine.renderer});
 Object.assign(bridge,{endpoint:f.endpoint,device:{worker:true},workerEpoch:1});
 wine.hostCtx={d3dimBridge:bridge,renderer:wine.renderer,exports:e,processId:7,
  getMemory:()=>memory.buffer,createCanvas};
 const imports=createHostImports(wine.hostCtx);
 const dv=new DataView(memory.buffer),entry=regions.BASE.DX_OBJECTS+3*32;
 dv.setUint32(entry,2,true);dv.setUint16(entry+12,4,true);dv.setUint16(entry+14,3,true);
 dv.setUint16(entry+16,32,true);dv.setUint16(entry+18,16,true);
 dv.setUint32(entry+20,0x20000,true);dv.setUint32(entry+28,1,true);
 new Uint32Array(memory.buffer,0x20000,12).fill(0x00aa3322);
 return {...f,bridge,imports,copy:()=>imports.gdi.presentBestDxOffscreen(true)};
}
{
 const f=cpuFixture();assert.equal(f.guard.snapshot().ready,false,'open endpoint alone has no presented owner');
 assert.equal(f.copy(),1,'ordinary CPU primary really copied');
 assert.deepEqual([...f.win._dxFrameLayer.canvas.getContext('2d').getImageData(0,0,1,1).data],
  [170,51,34,255],'actual presented pixels');
 assert.equal(f.bridge.presenter.win,null,'CPU copy never went through GPU presenter');
 assert.equal(f.guard.snapshot().ready,true,'CPU presentation publishes the same exact window owner');
 f.prepare();assert.equal(f.copy(),1,'another frame in the same owner lifetime');
 const token=f.down();assert(token>0,'ordinary CPU repaints preserve the bound identities');
 assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),1);
}
const cpuFaults={
 layer:f=>f.win._dxFrameLayer={},canvas:f=>f.win._dxFrameLayer.canvas={},
 windowMemory:f=>f.win.wasmMemory={},window:f=>f.wine.renderer.windows[10]={...f.win},
 memory:f=>f.wine.memory={buffer:f.wine.memory.buffer},module:f=>f.manager.options.module={},
 endpoint:f=>f.bridge.endpoint={...f.endpoint},epoch:f=>f.bridge.workerEpoch++,
 port:f=>f.manager.ports.clear(),retired:f=>f.manager._retired=true,
 closed:f=>f.endpoint.closed=true,error:f=>f.bridge.workerAsyncError=Error('fault'),
 closing:f=>f.bridge.workerClosing={},ambiguous:f=>f.wine.hostCtx.getGlGpsBridge=()=>({endpoint:{}}),
};
for(const [name,mutate]of Object.entries(cpuFaults)){
 const f=cpuFixture();assert.equal(f.copy(),1);f.prepare();const token=f.down();mutate(f);
 assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),0,name);
 assert.equal(f.guard.status('legacy').consumed,false,name);
}
for(const [name,mutate]of Object.entries(cpuFaults)){
 const f=cpuFixture();assert.equal(f.copy(),1);mutate(f);
 assert.throws(()=>f.guard.bind(),/unavailable/,name+' before binding');
}
for(const [wall,mono]of [[1500,500],[1000,500]]){
 const f=cpuFixture();f.copy();f.prepare();const token=f.down();f.clock(wall,mono);
 assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),0,
  'CPU presentation does not renew either deadline');
}
{
 const f=cpuFixture();f.win.processId=8;assert.equal(f.copy(),1);
 assert.equal(f.wine.hostCtx.getD3dimInputPresentation(),null,'foreign process copy publishes no owner');
 f.win.processId=7;assert.equal(f.guard.snapshot().ready,false);
}
console.log('PASS real D3DIM CPU primary presentation, native USER receipt and exact owner/layer/lifetime rejection');
