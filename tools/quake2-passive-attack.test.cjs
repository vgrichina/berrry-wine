'use strict';
// Offline reader/driver controls with authored shared-memory data. No guest
// execution or action observation is manufactured as original-game evidence.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const passive=require('./quake2-passive-attack.cjs'),input=require('./quake2-native-input.cjs');
const composition=require('./quake2-native-driver-composition.cjs');
const bound=require('../scratch/runs/20261109-quake2-observed-guard-route-0105/bound-input.cjs');
const {keyboardMessageLParam,installInputHandlers}=require('../lib/renderer-input');
const windows=passive.signatures(),offset=va=>va-0x400000+0x12000;
function fixture(){
 const memory=new WebAssembly.Memory({initial:128,maximum:128,shared:true}),view=new DataView(memory.buffer);
 for(const p of windows)new Uint8Array(memory.buffer,offset(p.va),p.bytes.length).set(p.bytes);
 const renderer={peekKeyDownState:key=>key===17?0x8000:0};
 const link={memory,endpointIdentity:1,worker:{},module:{}},canvas={};
 const wine={memory,processId:1000,running:true,guestWorker:{link},renderer};
 const s={epoch:'authored',ids:new WeakMap(),next:0},identity={processId:1000,endpoint:1,epoch:s.epoch};
 for(const [key,obj] of Object.entries({processObject:wine,endpointObject:link,workerObject:link.worker,moduleObject:link.module,pageRendererObject:renderer,canvasObject:canvas})){
  const id='authored:'+ ++s.next;s.ids.set(obj,id);identity[key]=id;
 }
 const context=vm.createContext({crossOriginIsolated:true,runningApps:[{name:'quake2_demo',wine}],document:{getElementById:()=>canvas},__mcmPassiveIdentityV1:s,SharedArrayBuffer});
 const put=(va,value)=>view.setUint32(offset(va),value,true);
 for(const [key,text] of [[13,'+attack'],[133,'+movedown'],[200,'+attack']]){
  const pointer=0x500000+key*128;put(0x4d6c60+key*4,pointer);
  new Uint8Array(memory.buffer,offset(pointer),text.length+1).set(Buffer.from(text+'\0'));
 }
 const read=expected=>vm.runInContext('('+passive.readPage.toString()+')('+JSON.stringify(identity)+','+JSON.stringify(windows)+','+JSON.stringify(expected??null)+')',context);
 return {read,put,view,context,wine,link,identity,memory};
}
async function main(){
 const f=fixture(),bytes=Buffer.from(f.memory.buffer).toString('hex');
 const old=await vm.runInContext(bound.PAGE_READ,f.context);
 assert(!old.apps[0].physical.some(v=>v.key===17),'oldFAIL: Control is omitted');
 assert(!old.apps[0].attackInput,'oldFAIL: no attack latch or bindings');
 const fresh=f.read();assert.equal(fresh.status,'SNAPSHOT');
 assert.equal(f.view.getUint8(offset(0x44d398)+0x1c),13);assert.equal(f.view.getUint8(offset(0x44d398)+0x1d),133,'original MapKey CTRL index');
 assert.equal(fresh.physical.find(v=>v.key===17).state,0x8000);
 assert.deepEqual(Array.from(fresh.bindings,v=>v.text),['+attack','+movedown','+attack']);
 assert.equal(fresh.attack.held,false);assert.match(fresh.consumption,/UNKNOWN/);
 assert.equal(Buffer.from(f.memory.buffer).toString('hex'),bytes,'reader makes no shared-memory writes');
 f.put(0xac13a0,13);f.put(0xac13b0,3);
 const latched=f.read(fresh.memoryIdentity);assert.equal(latched.attack.down[0],13);assert.equal(latched.attack.held,true);assert.equal(latched.attack.impulseDown,true);
 assert.equal(latched.weaponEffect,'UNKNOWN','authored latch must not imply firing');
 f.put(0x4d6c60+13*4,0x10000000);assert.equal(f.read().bindings[0].text,null,'sparse binding is UNKNOWN, not guessed');
 f.view.setUint8(offset(windows[0].va),0);assert.equal(f.read().status,'UNKNOWN','changed executable rejected');
 new Uint8Array(f.memory.buffer,offset(windows[0].va),windows[0].bytes.length).set(windows[0].bytes);
 const saved=f.link.worker;f.link.worker={};assert.equal(f.read().status,'UNKNOWN','equal-looking Worker rejected');f.link.worker=saved;
 f.link.memory={};assert.equal(f.read().status,'UNKNOWN','wrong shared-memory owner rejected');f.link.memory=f.memory;
 assert.equal(f.read('retired-memory').status,'UNKNOWN');
 const comp=composition.compose();assert(comp.source.includes("quake2-passive-attack.cjs').createChain(bound"));
 const start=' // The ordinary DLL-loader call is parked',end=" save('launch.json'";
 assert.equal(comp.source.slice(comp.source.indexOf(start),comp.source.indexOf(end)),comp.retainedSource.slice(comp.retainedSource.indexOf(start),comp.retainedSource.indexOf(end)));
 assert(comp.source.includes('WINE_QUAKE2_LOAD_OBSERVATION=true;window.WINE_QUAKE2_NATIVE_WRITE_OBSERVATION=true;'));
 // Actual production createChain wrapper decorates capture and held progress;
 // old chain still owns identity/freshness/admission and all command caps.
 const rows=[],chain=passive.createChain({createChain:()=>({closed:false,capture:async()=>({capture:{identity:f.identity},after:{}}),progress:async()=>({slice:'existing'})})},{evaluate:async expression=>{rows.push(expression);return vm.runInContext(expression,f.context);}});
 assert.equal((await chain.capture('authored')).after.attackInput.status,'SNAPSHOT');assert.equal((await chain.progress(f.identity)).attackInput.status,'SNAPSHOT');assert.equal(rows.length,2);
 for(const key of ['Control','Enter'])for(const mode of ['normal','down-fail','sample-fail','up-fail']){
  class Probe{constructor(){this.inputQueue=[];this.windows={};this.wasm=null;this.mainWasm=null;this._exited=false;}}
  installInputHandlers(Probe);const renderer=new Probe();
  const events=[],delivered=[];let receipt;
  try{receipt=await input.hold({session:'fixture',keys:[key],holdMs:50,send:async(method,p)=>{
   events.push(p);renderer[p.type==='keyDown'?'handleKeyDown':'handleKeyUp'](p.windowsVirtualKeyCode,{code:p.code});delivered.push(renderer.takeInput());
   if(mode==='down-fail'&&p.type==='keyDown'||mode==='up-fail'&&p.type==='keyUp')throw Error(mode);
  },sample:async()=>{if(mode==='sample-fail')throw Error(mode);return {};}});}
  catch(e){assert.notEqual(mode,'normal');receipt=e.holdReceipt;}
  assert.deepEqual(events.map(v=>v.type),['keyDown','keyUp']);
  const code=key==='Control'?'ControlLeft':'Enter',vk=key==='Control'?17:13,scan=key==='Control'?0x1d:0x1c;
  assert.equal(events[0].code,code);assert.equal(events[0].windowsVirtualKeyCode,vk);
  assert.equal(keyboardMessageLParam(vk,{code},false,false),1|(scan<<16));
  assert.deepEqual(delivered.map(v=>[v.msg,v.wParam]),[[0x100,vk],[0x101,vk]],'actual host renderer queue and consumption');
  assert.equal(delivered[0].lParam>>>0,1|(scan<<16));
  assert.equal(renderer.peekKeyDownState(vk),0);
  assert.equal(receipt.physicalRelease,mode==='up-fail'?'UNKNOWN':'ACK');
 }
 console.log('PASS oldFAIL arrow-only observer / newPASS Control, Enter, live bindings and raw latch; canonical windows, owner/memory negatives, no memory writes, composed capture/progress, startup gate unchanged, physical UP on failures. Authored offline data only; actual attack consumption UNKNOWN.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
