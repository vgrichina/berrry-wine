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
 const down=()=>{renderer.handleKeyDown(38);const event=renderer.inputQueue.shift(),token=call('check_input',()=>guard.dequeued(event));const d=new DataView(memory.buffer);[10,0x100,38,1].forEach((n,i)=>d.setUint32(32+i*4,n,true));return token;};
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
