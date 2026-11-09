'use strict';
// Offline reader/driver controls with authored shared-memory data. No guest
// execution or action observation is manufactured as original-game evidence.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const passive=require('./quake2-passive-attack.cjs'),input=require('./quake2-native-input.cjs');
const composition=require('./quake2-native-driver-composition.cjs');
const bound=require('../scratch/runs/20261109-quake2-observed-guard-route-0105/bound-input.cjs');
const {keyboardMessageLParam,installInputHandlers}=require('../lib/renderer-input');
const windows=passive.signatures(),offset=va=>va-0x400000+0x12000;
function fixture(sparse=false){
 const memory=new WebAssembly.Memory({initial:sparse?8192:128,maximum:sparse?8192:128,shared:true}),view=new DataView(memory.buffer);
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
 return {read,put,view,context,wine,link,identity,memory,renderer,s};
}
async function sparseControls(){
 const f=fixture(true),pages=new Uint32Array(f.memory.buffer,0x1bc00000,0x100000);
 // Retained actual0450 topology: all three pointers share guest page 0x8ff1.
 // Bytes/backings are authored controls, not recovered live binding contents.
 const pointers=[0x08ff1a10,0x08ff1f30,0x08ff1630];
 const texts=['+attack','+movedown','+attack'],keys=[13,133,200],page=pointers[0]>>>12,back=0x08100000;
 const setPage=(index,backing,protect=4)=>Atomics.store(pages,index,(backing|0x800|protect)>>>0);
 setPage(page,back);
 pointers.forEach((pointer,i)=>{
  f.put(0x4d6c60+keys[i]*4,pointer);
  new Uint8Array(f.memory.buffer,back+(pointer&0xfff),texts[i].length+1).set(Buffer.from(texts[i]+'\0'));
  assert.equal(require('../lib/mem-utils').g2w(pointer,0x400000,f.memory),back+(pointer&0xfff),'matches runtime JS translator');
 });
 const digest=()=>require('node:crypto').createHash('sha256').update(new Uint8Array(f.memory.buffer)).digest('hex');
 const before=digest(),row=f.read();
 assert.equal(row.status,'SNAPSHOT');assert.deepEqual(Array.from(row.bindings,v=>v.text),texts,'actual0450 pointers decode via owning PTE');
 assert.equal(digest(),before,'sparse reader has zero shared-memory writes');
 assert.equal(row.weaponEffect,'UNKNOWN');assert.match(row.consumption,/latch snapshot only/);
 const memoryIdentity=row.memoryIdentity;
 const unknown=label=>assert.equal(f.read(memoryIdentity).status,'UNKNOWN',label);
 // Full 128-byte policy is checked across pages even if NUL occurs early.
 const cross=0x08ff1ffc,nextBack=0x08300000;
 f.put(0x4d6c60+13*4,cross);setPage(page+1,nextBack);
 new Uint8Array(f.memory.buffer,back+0xffc,4).set(Buffer.from('+att'));
 new Uint8Array(f.memory.buffer,nextBack,4).set(Buffer.from('ack\0'));
 assert.equal(f.read(memoryIdentity).bindings[0].text,'+attack','noncontiguous page-cross translation');
 Atomics.store(pages,page+1,0);unknown('unmapped second page');
 f.view.setUint8(back+0xffc,0);unknown('early NUL cannot conceal unmapped remainder');
 setPage(page+1,nextBack);f.view.setUint8(back+0xffc,43);
 f.context.GuestWorkerMemUtils={guestToWasm:()=>{throw Error('must not call translator/export');}};
 f.context.guestPageTable=new Uint32Array(new SharedArrayBuffer(0x400000));
 for(const protect of [0,1,0x10,0x104,0x304,0x404,3]){
  setPage(page+1,nextBack,protect);unknown('invalid/unreadable permission '+protect);
 }
 for(const protect of [2,4,0x20,0x40,0x204]){
  setPage(page+1,nextBack,protect);assert.equal(f.read(memoryIdentity).status,'SNAPSHOT');
 }
 for(const backing of [0,0x1000,0x1a000000,0x1bc00000,0x1c000000,0x20000000,0xfffff000]){
  setPage(page+1,backing);unknown('invalid/private/out-of-buffer backing '+backing);
 }
 Atomics.store(pages,page,0);unknown('an unrelated page table cannot supply the missing owning PTE');setPage(page,back);
 setPage(page+1,nextBack);
 const savedPeek=f.renderer.peekKeyDownState;
 function race(mutate,label){
  let done=false;f.renderer.peekKeyDownState=key=>{if(!done){done=true;mutate();}return 0;};
  unknown(label);f.renderer.peekKeyDownState=savedPeek;
 }
 race(()=>setPage(page+1,0x08400000),'translation changes between samples');setPage(page+1,nextBack);
 race(()=>setPage(page+1,nextBack,2),'permission changes between samples');setPage(page+1,nextBack);
 let loads=0;
 f.context.Atomics={load:(array,index)=>{
  if(++loads===9)setPage(page+1,0x08400000);
  return Atomics.load(array,index);
 }};
 unknown('translation changes after both byte samples, at final PTE validation');
 delete f.context.Atomics;setPage(page+1,nextBack);
 race(()=>f.put(0x4d6c60+13*4,pointers[0]),'binding pointer changes');f.put(0x4d6c60+13*4,cross);
 race(()=>f.view.setUint8(nextBack,88),'binding bytes change');f.view.setUint8(nextBack,97);
 const savedWorker=f.link.worker;
 race(()=>{f.link.worker={};},'stale Worker during read');f.link.worker=savedWorker;
 assert.equal(f.read(memoryIdentity).status,'SNAPSHOT');
 const savedMemory=f.link.memory;
 race(()=>{f.link.memory={buffer:f.memory.buffer};},'stale memory owner during read');f.link.memory=savedMemory;
 race(()=>{f.wine.memory={buffer:f.memory.buffer};},'memory wrapper replaced during read');f.wine.memory=f.memory;
 race(()=>f.view.setUint8(offset(windows[0].va),0),'canonical window changes during read');
 new Uint8Array(f.memory.buffer,offset(windows[0].va),windows[0].bytes.length).set(windows[0].bytes);
 for(const pointer of [0x04000000,0x083edff0,0x4ffffff0,0x50000000,0xffffffc0]){
  f.put(0x4d6c60+13*4,pointer);unknown('no enlarged direct window, DIB or wrapped range');
 }
 f.put(0x4d6c60+13*4,pointers[0]);
 const start=back+(pointers[0]&0xfff);
 new Uint8Array(f.memory.buffer,start,128).fill(65);unknown('unterminated 128 bytes');
 f.view.setUint8(start+127,0);assert.equal(f.read(memoryIdentity).bindings[0].text.length,127);
 f.view.setUint8(start,31);unknown('non-ASCII binding');
 f.view.setUint8(start,65);
 const chain=passive.createChain({createChain:()=>({progress:async()=>({})})},{evaluate:async expression=>vm.runInContext(expression,f.context)});
 Atomics.store(pages,page,0);
 assert.equal((await chain.progress(f.identity)).attackInput.status,'UNKNOWN');
 setPage(page,back);
 const replacement=new WebAssembly.Memory({initial:128,maximum:128,shared:true});
 f.wine.memory=replacement;f.link.memory=replacement;unknown('actual owning memory/buffer replaced after accepted snapshot');
 assert.equal((await chain.progress(f.identity)).attackInput.reason,'owning memory changed','UNKNOWN first binding still pins owning memory in production wrapper');
 console.log('PASS sparse actual0450 pointer topology; noncontiguous page-cross, full128 unmapped, permissions, private/bounds, translation/pointer/bytes/owner races, ASCII/NUL, zero writes. Authored backing bytes only.');
}
async function main(){
 await sparseControls();
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
 f.put(0x4d6c60+13*4,0x500000+13*128);
 for(const p of windows){
  f.view.setUint8(offset(p.va),p.bytes[0]^1);assert.equal(f.read().status,'UNKNOWN','each canonical executable window required');
  new Uint8Array(f.memory.buffer,offset(p.va),p.bytes.length).set(p.bytes);
 }
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
