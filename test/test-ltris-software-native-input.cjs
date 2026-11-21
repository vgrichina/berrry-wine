'use strict';
const assert=require('node:assert/strict');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
function fixture(options={trusted:()=>true}){
  let wall=1000,mono=0;
  const memory={buffer:new ArrayBuffer(4096)},module={},scene=[1,7,10,10,0,0,1,0,1,0];
  const exports={wnd_lookup_live:h=>h===10,wnd_lookup_generation:()=>1n,get_window_thread:()=>1};
  const instance={exports},win={visible:true,wasm:instance,wasmMemory:memory,processId:7};
  const renderer={wasm:instance,wasmMemory:memory,canvas:{},windows:{10:win},inputQueue:[],
    handleKeyDown(code){this.inputQueue.push({hwnd:10,msg:0x100,wParam:code,lParam:1});this.downHook?.();},
    handleKeyUp(){this.upHook?.();},peekKeyDownState:()=>0};
  const hostImports={check_input(){},input_validate(){},input_consumed(){}},
    actor={slot:0,worker:{},endpointIdentity:1,module,memory},
    wine={renderer,instance,memory,_wasmModule:module,_processObject:{},processId:7,running:true,
      hostCtx:{instance},guestWorker:{link:actor,module,memory,hostImports}};
  const guard=createBrowserNativeInput(wine,{now:()=>wall,monotonic:()=>mono,...options});
  wine.hostCtx.guardedInput=hostImports.browserInputScope=guard;
  const call=(name,fn)=>guard.withActor(0,name,fn),observe=()=>call('check_input',()=>guard.observe(scene));
  observe();
  const prepare=()=>{const b=guard.bind();guard.prepare({owner:b.owner,nonce:'sdl',reviewed:true,
    reviewedAt:wall,imageSHA256:'a'.repeat(64),code:13,mode:'game'});};
  const down=()=>{renderer.handleKeyDown(13);return call('check_input',()=>guard.dequeued(renderer.inputQueue.shift()));};
  const consume=token=>{const v=new DataView(memory.buffer);[10,0x100,13,1].forEach((n,i)=>v.setUint32(32+4*i,n,true));
    return call('input_consumed',()=>guard.consumed(token,1,32,1,1,[...scene,32]));};
  return {wine,guard,actor,renderer,instance,hostImports,scene,prepare,down,consume,observe,
    clock:(w,m)=>{wall=w;mono=m;}};
}
// Default production provenance, without injecting a permissive trusted hook.
// These are unit event objects, not browser/native physical-input evidence.
{
  const f=fixture();f.prepare();
  f.renderer.downHook=()=>f.renderer.handleKeyUp(13,{browserInputCancellation:'blur'});
  assert.equal(f.down(),0);
  assert.equal(f.renderer.inputQueue.length,0);
  const receipt=f.guard.status('sdl');assert.equal(receipt.state,'UNKNOWN');
  assert.equal(receipt.ownershipCancellation.reason,'blur');assert.equal(receipt.physicalUp,null);
}
global.window={event:{type:'keydown',keyCode:13,isTrusted:true}};
for(const event of [
  {type:'blur',isTrusted:true}, {type:'fullscreenchange',isTrusted:true},
  {type:'visibilitychange',isTrusted:true}, {type:'keyup',keyCode:27,isTrusted:true},
  {type:'keyup',keyCode:13,isTrusted:false},
]){
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  window.event=event;f.renderer.handleKeyUp(13);
  assert.equal(f.guard.status('sdl').physicalUp,null,JSON.stringify(event));
}
for(const reason of ['blur','hidden','fullscreen-exit']){
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  // Even cancellation nested in a trusted keyup cannot certify physical UP.
  window.event={type:'keyup',keyCode:13,isTrusted:true};
  f.renderer.handleKeyUp(13,{browserInputCancellation:reason});
  let receipt=f.guard.status('sdl');assert.equal(receipt.state,'CONSUMED');
  assert.equal(receipt.physicalUp,null);assert.equal(receipt.ownershipCancellation.reason,reason);
  f.renderer.handleKeyUp(13);receipt=f.guard.status('sdl');
  assert.equal(receipt.physicalUp,null,'late UP cannot recertify cancelled ownership');
}
{
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  window.event={type:'keyup',keyCode:13,isTrusted:true};
  let entered=false;
  f.renderer.upHook=()=>{
    if(entered)return;entered=true;
    f.renderer.handleKeyUp(13);
    throw Error('wake hook');
  };
  assert.throws(()=>f.renderer.handleKeyUp(13,{browserInputCancellation:'fullscreen-exit'}),/wake hook/);
  assert.equal(f.guard.status('sdl').physicalUp,null);
  assert.equal(f.guard.status('sdl').ownershipCancellation.reason,'fullscreen-exit');
}
{
  const f=fixture({trusted:undefined});window.event={type:'blur',isTrusted:true};
  f.prepare();assert.equal(f.down(),0,'trusted blur cannot stand in for DOM keydown');
  assert.equal(f.guard.status('sdl').appliedAt,null);
}
{
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  window.event={type:'keyup',keyCode:13,isTrusted:true};f.renderer.handleKeyUp(13);
  assert.equal(f.guard.status('sdl').physicalUp.trusted,true);
}
delete global.window;
{
  const f=fixture();assert.equal(f.guard.snapshot().ready,true);f.prepare();const token=f.down();
  assert(token>0);assert.equal(f.guard.status('sdl').consumed,false);
  assert.equal(f.consume(token),1);f.renderer.handleKeyUp(13);
  assert.equal(f.renderer.peekKeyDownState(13),0);
  assert.throws(()=>f.guard.prepare({nonce:'sdl'}));
}
const faults={
  actor:f=>f.wine.guestWorker.link={...f.actor},worker:f=>f.actor.worker={},
  endpoint:f=>f.actor.endpointIdentity++,module:f=>f.actor.module={},memory:f=>f.actor.memory={},
  hostModule:f=>f.wine.guestWorker.module={},hostMemory:f=>f.wine.guestWorker.memory={},
  renderer:f=>f.wine.renderer={...f.renderer},rendererMemory:f=>f.renderer.wasmMemory={},
  context:f=>f.wine.hostCtx={...f.wine.hostCtx},contextInstance:f=>f.wine.hostCtx.instance={},
  inputSite:f=>f.hostImports.check_input=()=>0,validateSite:f=>f.hostImports.input_validate=()=>0,
  consumedSite:f=>f.hostImports.input_consumed=()=>0,exports:f=>f.instance.exports={...f.instance.exports},
  dead:f=>f.actor._stopped=true,retiring:f=>f.actor._stopping=true,
  retired:f=>f.actor._retirementComplete=true,transport:f=>f.actor._transportFailure=Error('fault'),
  ambiguous:f=>f.actor._writerAmbiguous=true,focus:f=>{f.scene[3]=11;f.observe();},
  generation:f=>f.instance.exports.wnd_lookup_generation=()=>2n,
  stale:f=>f.clock(1251,251),deadline:f=>{f.clock(1500,500);f.observe();},
  graphics:f=>f.wine.hostCtx.getGlGpsBridge=()=>({endpoint:{closed:true}}),
};
for(const [name,mutate]of Object.entries(faults)){
  const f=fixture();f.prepare();const token=f.down();mutate(f);
  assert.equal(f.consume(token),0,name);assert.equal(f.guard.status('sdl').consumed,false,name);
}
for(const mutate of [f=>f.actor.worker=null,f=>f.actor.endpointIdentity=null,f=>f.wine.hostCtx.guardedInput=null,
  f=>f.hostImports.browserInputScope=null,f=>f.instance.exports.wnd_lookup_live=undefined]){
  const f=fixture();mutate(f);assert.equal(f.guard.snapshot().ready,false);assert.throws(()=>f.guard.bind());
}
{
  const f=fixture();let bridge={endpoint:{closed:false}};
  f.wine.hostCtx.getGlGpsBridge=()=>bridge;f.observe();bridge=null;
  assert.equal(f.guard.snapshot().ready,false,'retiring graphics cannot reuse its scene as a software observation');
}
console.log('PASS software CPU ownership, USER receipt, replacement/focus/stale/dead-owner/deadline/one-use faults');
