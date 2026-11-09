'use strict';
// Offline reader/driver controls with authored shared-memory data. No guest
// execution or action observation is manufactured as original-game evidence.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const passive=require('./quake2-passive-attack.cjs'),input=require('./quake2-native-input.cjs');
const composition=require('./quake2-native-driver-composition.cjs');
const bound=require('../scratch/runs/20261109-quake2-observed-guard-route-0105/bound-input.cjs');
const {keyboardMessageLParam,installInputHandlers}=require('../lib/renderer-input');
const windows=passive.signatures(),offset=va=>va-0x400000+0x12000;
function setMotion(f,{frameNumber=17,rawOrigin=[-32768,-9,32767],rawVelocity=[-801,1600,7],pmType=0,pmFlags=0x45}={}){
 // Authored received frame + publication, not evidence of original movement.
 const frame=offset(0xa9ce98),v=f.view;
 new Uint8Array(f.memory.buffer,frame,240).fill(0);
 f.put(0xa86a60,4);v.setUint32(frame,1,true);
 v.setInt32(frame+4,frameNumber,true);v.setUint32(frame+8,frameNumber*100>>>0,true);
 v.setInt32(frame+0x30,pmType,true);v.setUint8(frame+0x40,pmFlags);
 rawOrigin.forEach((n,i)=>v.setInt16(frame+0x34+i*2,n,true));
 rawVelocity.forEach((n,i)=>v.setInt16(frame+0x3a+i*2,n,true));
 new Uint8Array(f.memory.buffer,offset(0xa9cf8c+(frameNumber&15)*240),240)
  .set(new Uint8Array(f.memory.buffer,frame,240));
}
function canonicalKeynames(){
 const core=require('../lib/quake2-owning-load-core'),b=fs.readFileSync(core.EXE);
 assert.equal(core.hash(b),core.EXE_SHA);
 const pe=b.readUInt32LE(60),table=pe+24+b.readUInt16LE(pe+20);
 function raw(va){
  for(let i=0;i<b.readUInt16LE(pe+6);i++){
   const s=table+40*i,start=0x400000+b.readUInt32LE(s+12),size=b.readUInt32LE(s+16);
   if(va>=start&&va<start+size)return b.readUInt32LE(s+20)+va-start;
  }
  throw Error('canonical keyname outside raw PE');
 }
 for(const [va,name,key] of [[0x448de8,'SPACE',32],[0x448e08,'LEFTARROW',130],[0x448e10,'RIGHTARROW',131],[0x448e18,'ALT',132],[0x448ec8,'MOUSE2',201]]){
  const at=raw(va),string=raw(b.readUInt32LE(at));
  assert.equal(b.subarray(string,b.indexOf(0,string)).toString('ascii'),name);
  assert.equal(b.readUInt32LE(at+4),key);
 }
}
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
 setMotion({view,put,memory});
 for(const [key,text] of [[13,'+attack'],[133,'+movedown'],[200,'+attack'],[32,'+moveup'],[201,'+moveup'],[97,'+moveleft'],[100,'+moveright'],[44,'+moveleft'],[46,'+moveright'],[130,'+left'],[131,'+right'],[132,'+strafe']]){
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
 assert.equal(row.status,'SNAPSHOT');assert.deepEqual(Array.from(row.bindings.slice(0,3),v=>v.text),texts,'actual0450 pointers decode via owning PTE');
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
 canonicalKeynames();
 await motionControls();
 await movementControls();
 await sparseControls();
 const f=fixture(),bytes=Buffer.from(f.memory.buffer).toString('hex');
 const old=await vm.runInContext(bound.PAGE_READ,f.context);
 assert(!old.apps[0].physical.some(v=>v.key===17),'oldFAIL: Control is omitted');
 assert(!old.apps[0].attackInput,'oldFAIL: no attack latch or bindings');
 const fresh=f.read();assert.equal(fresh.status,'SNAPSHOT');
 assert.equal(f.view.getUint8(offset(0x44d398)+0x1c),13);assert.equal(f.view.getUint8(offset(0x44d398)+0x1d),133,'original MapKey CTRL index');
 assert.equal(fresh.physical.find(v=>v.key===17).state,0x8000);
 assert.deepEqual(Array.from(fresh.bindings.slice(0,3),v=>v.text),['+attack','+movedown','+attack']);
 assert.deepEqual(Array.from(fresh.bindings.slice(3),v=>[v.key,v.text]),[[32,'+moveup'],[201,'+moveup'],[97,'+moveleft'],[100,'+moveright'],[44,'+moveleft'],[46,'+moveright'],[130,'+left'],[131,'+right'],[132,'+strafe']]);
 for(const [scan,key] of [[0x39,32],[0x1e,97],[0x20,100],[0x33,44],[0x34,46],[0x4b,130],[0x4d,131],[0x38,132]])assert.equal(f.view.getUint8(offset(0x44d398)+scan),key,'canonical MapKey scan '+scan);
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
 for(const key of ['Control','Enter','Space','a',',','.'])for(const mode of ['normal','down-fail','sample-fail','up-fail']){
  class Probe{constructor(){this.inputQueue=[];this.windows={};this.wasm=null;this.mainWasm=null;this._exited=false;}}
  installInputHandlers(Probe);const renderer=new Probe();
  const events=[],delivered=[];let receipt;
  try{receipt=await input.hold({session:'fixture',keys:[key],holdMs:50,send:async(method,p)=>{
   events.push(p);renderer[p.type==='keyDown'?'handleKeyDown':'handleKeyUp'](p.windowsVirtualKeyCode,{code:p.code});delivered.push(renderer.takeInput());
   if(mode==='down-fail'&&p.type==='keyDown'||mode==='up-fail'&&p.type==='keyUp')throw Error(mode);
  },sample:async()=>{if(mode==='sample-fail')throw Error(mode);return {};}});}
  catch(e){assert.notEqual(mode,'normal');receipt=e.holdReceipt;}
  assert.deepEqual(events.map(v=>v.type),['keyDown','keyUp']);
  const [code,vk,scan]=({Control:['ControlLeft',17,0x1d],Enter:['Enter',13,0x1c],Space:['Space',32,0x39],a:['KeyA',65,0x1e],',':['Comma',188,0x33],'.':['Period',190,0x34]})[key];
  assert.equal(events[0].code,code);assert.equal(events[0].windowsVirtualKeyCode,vk);
  assert.equal(events[0].key,key==='Space'?' ':key);
  assert.equal(keyboardMessageLParam(vk,{code},false,false),1|(scan<<16));
  assert.deepEqual(delivered.map(v=>[v.msg,v.wParam]),[[0x100,vk],[0x101,vk]],'actual host renderer queue and consumption');
  assert.equal(delivered[0].lParam>>>0,1|(scan<<16));
  assert.equal(renderer.peekKeyDownState(vk),0);
  assert.equal(receipt.physicalRelease,mode==='up-fail'?'UNKNOWN':'ACK');
 }
 console.log('PASS oldFAIL arrow-only observer / newPASS Control, Enter, live bindings and raw latch; canonical windows, owner/memory negatives, no memory writes, composed capture/progress, startup gate unchanged, physical UP on failures. Authored offline data only; actual attack consumption UNKNOWN.');
}
async function movementControls(){
 const f=fixture(true),pages=new Uint32Array(f.memory.buffer,0x1bc00000,0x100000);
 const keys=[32,201,97,100,44,46,130,131,132],back=0x08500000,page=0x9000;
 const pte=(back|0x804)>>>0;
 Atomics.store(pages,page,pte);Atomics.store(pages,page+1,(back+0x1000)|0x804);
 const expected=['+moveup','+moveup','+moveleft','+moveright','+moveleft','+moveright','+left','+right','+strafe'];
 keys.forEach((key,i)=>{
  const pointer=page*4096+i*256;f.put(0x4d6c60+key*4,pointer);
  new Uint8Array(f.memory.buffer,back+i*256,128).fill(0);
  new Uint8Array(f.memory.buffer,back+i*256,expected[i].length).set(Buffer.from(expected[i]));
 });
 const digest=()=>require('node:crypto').createHash('sha256').update(new Uint8Array(f.memory.buffer)).digest('hex');
 const before=digest(),row=f.read();assert.equal(row.status,'SNAPSHOT');assert.equal(digest(),before,'movement sparse reader has zero writes');
 const binding=(row,key)=>row.bindings.find(v=>v.key===key);
 for(let i=0;i<keys.length;i++)assert.equal(binding(row,keys[i])?.text,expected[i],'move-up/lateral key must be observed '+keys[i]);
 assert(row.physical.some(v=>v.key===32)&&row.physical.some(v=>v.key===65));
 const memoryIdentity=row.memoryIdentity,savedPeek=f.renderer.peekKeyDownState;
 for(const [i,key] of keys.entries()){
  const address=0x4d6c60+key*4,pointer=page*4096+i*256,start=back+i*256;
  const unknown=label=>assert.equal(f.read(memoryIdentity).status,'UNKNOWN',label+' key '+key);
  function race(mutate,label){let done=false;f.renderer.peekKeyDownState=()=>{if(!done){done=true;mutate();}return 0;};unknown(label);f.renderer.peekKeyDownState=savedPeek;}
  // Stable custom bindings are evidence, not a policy violation or an action
  // inferred from Space/a. A change inside the double read must fail closed.
  new Uint8Array(f.memory.buffer,start,128).fill(0);new Uint8Array(f.memory.buffer,start,9).set(Buffer.from('+movedown'));
  assert.equal(binding(f.read(memoryIdentity),key).text,'+movedown');
  race(()=>f.view.setUint8(start+5,88),'changed binding bytes');f.view.setUint8(start+5,100);
  race(()=>f.put(address,pointer+128),'changed binding pointer');f.put(address,pointer);
  race(()=>Atomics.store(pages,page,pte^2),'changed permission');Atomics.store(pages,page,pte);
  race(()=>Atomics.store(pages,page,(back+0x2000)|0x804),'changed backing');Atomics.store(pages,page,pte);
  f.put(address,0x04000000);unknown('direct ceiling unchanged');f.put(address,pointer);
  Atomics.store(pages,page,0);unknown('unmapped');
  for(const bad of [(back|0x801),(0x1bc00000|0x804),(0xfffff000|0x804)]){Atomics.store(pages,page,bad);unknown('permission/backing bounds');}
  Atomics.store(pages,page,pte);
  const worker=f.link.worker;race(()=>{f.link.worker={};},'wrong owner');f.link.worker=worker;
 }
 assert.equal(f.read(memoryIdentity).status,'SNAPSHOT');
 console.log('PASS owning sparse Space32 Mouse2=201 a97 d100 comma44 period46 arrows130/131 Alt132; actual custom binding retained; each added key byte/pointer/PTE/owner race, missing mapping, permission/private/bounds/direct-ceiling negatives fail closed; consumption UNKNOWN.');
}
async function motionControls(){
 const f=fixture(),snapshot=f.read(),m=snapshot.playerMotion;
 assert.equal(m?.status,'SNAPSHOT','regression: real serialized reader previously omitted native motion');
 assert.equal(m.address,0xa9cec8);assert.equal(m.frameNumber,17);assert.equal(m.serverTimeMs,1700);
 assert.deepEqual(Array.from(m.origin),[-4096,-1.125,4095.875]);
 assert.deepEqual(Array.from(m.velocity),[-100.125,200,0.875]);assert.equal(m.pmFlags,0x45);
 assert.match(m.source,/received client frame/);assert.match(m.limits,/contact.*damage cause.*lifetime UNKNOWN/);
 // Constants and instruction operands are checked in the hash-authenticated
 // PE, separately from the authored field values used by the reader tests.
 const core=require('../lib/quake2-owning-load-core'),b=fs.readFileSync(core.EXE);
 const pe=require('../lib/pe').readPE(b);
 const original=(va,n)=>b.subarray(pe.va2off(va),pe.va2off(va)+n);
 assert.equal(original(0x4427c0,8).readDoubleLE(),0.125);
 assert.equal(original(0x4427e8,8).readDoubleLE(),0.001);
 assert.equal(original(0x442438,4).readFloatLE(),1000);
 assert.equal(original(0x4034b8,11).toString('hex'),'6898cea90056e8edf9ffff','actual frame argument to native playerinfo parser');
 assert.equal(original(0x402eb7,3).toString('hex'),'8d6830','playerstate at frame+48');
 assert.equal(original(0x40baf1,5).toString('hex'),'bec8cea900','prediction copies this exact pmove');
 const digest=()=>require('node:crypto').createHash('sha256').update(new Uint8Array(f.memory.buffer)).digest('hex');
 const before=digest();f.read();assert.equal(digest(),before,'motion reads perform no shared-memory writes');
 const unknown=label=>{const row=f.read();assert.equal(row.playerMotion.status,'UNKNOWN',label);assert.equal(row.playerMotion.origin,undefined,label+' cannot expose accepted coordinates');};
 // All ring indices, including a slot spanning a direct page boundary, use
 // the fixed, bounded executable data range. No frame pointer is followed.
 for(let i=0;i<16;i++){setMotion(f,{frameNumber:32+i});assert.equal(f.read().playerMotion.frameNumber,32+i);}
 for(const [address,value] of [[0xa86a60,0],[0xa86a60,3],[0xa9ce98,0],[0xa9ce98,2],
   [0xa9ce9c,0],[0xa9ce9c,0xffffffff],[0xa9cea0,0],[0xa9cec8,256],[0xa9cec8,0xffffffff]]){
  setMotion(f);f.put(address,value);
  // Match invalid data in the ring too: validation cannot rely on mismatch.
  new Uint8Array(f.memory.buffer,offset(0xa9cf8c+240),240).set(new Uint8Array(f.memory.buffer,offset(0xa9ce98),240));
  unknown('malformed/inactive native state '+address.toString(16));
 }
 setMotion(f);f.put(0xa9cf8c+240+4,1);unknown('retired ring slot');
 setMotion(f);f.view.setInt16(offset(0xa9cecc),100,true);unknown('current parse not published');
 const saved=f.renderer.peekKeyDownState;
 for(const address of [0xa86a60,0xa9ce98,0xa9ce9c,0xa9cea0,0xa9cec8,0xa9cecc,0xa9cece,0xa9ced0,0xa9ced2,0xa9ced4,0xa9ced6,0xa9ced8,0xa9cf8c+240+0x40]){
  setMotion(f);let changed=false;
  f.renderer.peekKeyDownState=()=>{if(!changed){changed=true;const at=offset(address);f.view.setUint8(at,f.view.getUint8(at)^1);}return 0;};
  unknown('torn native motion '+address.toString(16));f.renderer.peekKeyDownState=saved;
 }
 setMotion(f);
 for(const field of ['running','_stopped']){
  f.wine[field]=field==='_stopped';unknown('retired owner '+field);f.wine[field]=field==='running';
 }
 const module=f.link.module;f.link.module={};unknown('wrong native module object');f.link.module=module;
 const worker=f.link.worker;f.link.worker={};unknown('wrong native worker object');f.link.worker=worker;
 for(const [object,key,value] of [[f.wine,'processId',1001],[f.link,'endpointIdentity',2],[f.s,'epoch','retired'],[f.context.runningApps[0],'name','other']]){
  const savedValue=object[key];object[key]=value;unknown('wrong identity '+key);object[key]=savedValue;
  let changed=false;f.renderer.peekKeyDownState=()=>{if(!changed){changed=true;object[key]=value;}return 0;};
  unknown('identity changed during motion read '+key);object[key]=savedValue;f.renderer.peekKeyDownState=saved;
 }
 assert.equal(f.read().playerMotion.status,'SNAPSHOT');
 // Bounds fail closed before any motion decode even with valid identity and
 // canonical code. Retain just enough direct storage for the code windows.
 const small=new WebAssembly.Memory({initial:32,maximum:32,shared:true});
 for(const p of windows)new Uint8Array(small.buffer,offset(p.va),p.bytes.length).set(p.bytes);
 f.wine.memory=small;f.link.memory=small;unknown('unreadable owning data');
 // Both production output paths retain the same memory identity and decode
 // fresh values on each call; there is no cached motion result.
 const g=fixture(),chain=passive.createChain({createChain:()=>({capture:async()=>({capture:{identity:g.identity},after:{}}),progress:async()=>({})})},{evaluate:async e=>vm.runInContext(e,g.context)});
 const capture=(await chain.capture('motion')).after.attackInput;
 setMotion(g,{frameNumber:18,rawOrigin:[8,16,-24],rawVelocity:[0,0,0],pmFlags:0});
 const progress=(await chain.progress(g.identity)).attackInput;
 assert.equal(progress.memoryIdentity,capture.memoryIdentity);assert.equal(progress.playerMotion.frameNumber,18);
 assert.deepEqual(Array.from(progress.playerMotion.origin),[1,2,-3]);assert.equal(progress.playerMotion.pmFlags,0);
 console.log('PASS native received pmove layout/scales, signed origin/velocity/raw flags, all16 published slots, malformed/inactive/retired/unpublished/torn/wrong owner/module/unreadable controls, zero writes and fresh composed capture/progress. Point snapshots only.');
}
module.exports={fixture,setMotion};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
