'use strict';
// Page-side shared-memory reads only: no Worker RPC, CPU export or guest write.
const fs=require('node:fs'),assert=require('node:assert/strict');
const core=require('../lib/quake2-owning-load-core');
const WINDOWS=[[0x407650,0x83],[0x4076e0,0xa6],[0x407930,0x1e],
  [0x407de0,0x32],[0x41911a,7],[0x42fe10,0x2d],[0x44d398,0x80],
  // Canonical native evidence, not offsets borrowed from a different Q2 build:
  // ParsePlayerstate: frame+0x30; signed shorts +4/+10, flags byte +16.
  [0x402eb0,0x138],
  // ParseFrame: clear/read header, playerinfo call, publish 16 * 240 ring.
  [0x403330,0x4d],[0x4034a5,0x91],
  // PredictMovement: active state=4; copy seven dwords from 0xa9cec8.
  [0x40ba40,0x18],[0x40baec,0x28],
  // Pmove: signed origin/velocity * 1/8, command msec * .001;
  // integration uses origin + velocity * that time. Raw flags have no names.
  [0x4229b0,0xe9],[0x420da0,0x55],[0x4427c0,8],[0x4427e8,8],
  // FinishMove converts client frame seconds to the command's msec byte.
  [0x407e3c,0x1f],[0x442438,4],
  // Remaining ParsePlayerstate: kick, blend and 32 signed-short stats.
  // HUD hnum consumes stats[1] at 0xa9cf42 in this shipped executable.
  [0x40308c,0x22f],[0x40d4a5,7]];
function signatures(){
 const b=fs.readFileSync(require('node:path').resolve(__dirname,'..',core.EXE));
 assert.equal(core.hash(b),core.EXE_SHA,'canonical Q2 attack executable');
 const pe=b.readUInt32LE(0x3c),table=pe+24+b.readUInt16LE(pe+20),out=[];
 for(const [va,size] of WINDOWS){
  let bytes;
  for(let i=0;i<b.readUInt16LE(pe+6);i++){
   const s=table+40*i,start=0x400000+b.readUInt32LE(s+12),length=b.readUInt32LE(s+16);
   if(va>=start&&va+size<=start+length)bytes=b.subarray(b.readUInt32LE(s+20)+va-start,b.readUInt32LE(s+20)+va-start+size);
  }
  assert.equal(bytes?.length,size,'raw executable attack window');out.push({va,bytes:[...bytes]});
 }
 return out;
}
// Serialized into the actual page. Identity tokens originate in the retained
// admission chain; this reader neither creates nor repairs those tokens.
function readPage(identity,windows,expectedMemory){
 const fail=reason=>({status:'UNKNOWN',reason,playerMotion:{status:'UNKNOWN',reason},damageFeedback:{status:'UNKNOWN',reason,cause:'UNKNOWN'},consumption:'UNKNOWN',weaponEffect:'UNKNOWN'});
 const all=typeof runningApps==='undefined'?[]:runningApps;
 const a=all[0],w=a?.wine,g=w?.guestWorker,l=g?.link,s=globalThis.__mcmPassiveIdentityV1;
 if(all.length!==1||a.name!=='quake2_demo'||!w?.running||w._stopped||!s)return fail('owner unavailable');
 const objects={processObject:w,endpointObject:l,workerObject:l?.worker,moduleObject:l?.module,pageRendererObject:w.renderer,canvasObject:document.getElementById('screen')};
 if(w.processId!==identity.processId||l?.endpointIdentity!==identity.endpoint||s.epoch!==identity.epoch||
   Object.entries(objects).some(([key,value])=>!value||s.ids.get(value)!==identity[key]))return fail('owner identity changed');
 const memory=w.memory,buffer=memory?.buffer;
 if(!memory||l.memory!==memory||!(buffer instanceof SharedArrayBuffer))return fail('owning shared memory unavailable');
 if(!s.ids.has(memory))s.ids.set(memory,s.epoch+':'+(++s.next));
 if(!s.ids.has(buffer))s.ids.set(buffer,s.epoch+':'+(++s.next));
 const memoryIdentity=s.ids.get(memory)+'/'+s.ids.get(buffer);
 if(expectedMemory&&expectedMemory!==memoryIdentity)return fail('owning memory changed');
 // The pinned CPUa320 ABI: direct EXE data stays conservative. Sparse
 // bindings follow $g2w_slow / $guest_page_translate (src/03-registers.wat),
 // never VA-as-offset, an RPC/export, or the allocation-record fallback.
 const view=new DataView(buffer),offset=va=>va-0x400000+0x12000;
 const direct=(va,n)=>Number.isInteger(va)&&va>=0x400000&&va+n<=0x4000000&&offset(va)+n<=view.byteLength;
 const canonical=()=>windows.every(p=>direct(p.va,p.bytes.length)&&p.bytes.every((b,i)=>view.getUint8(offset(p.va)+i)===b));
 if(!canonical())return fail('attack executable window mismatch');
 if(!direct(0xac13a0,20)||!direct(0x4d6c60,808))return fail('attack data outside owning direct memory');
 const u32=va=>view.getUint32(offset(va),true);
 // The table is a view of this exact owner's buffer, not a page global or a
 // cached table from a prior process. Publication/clear/protect use atomic i32.
 const pages=buffer.byteLength>=0x1c000000?new Uint32Array(buffer,0x1bc00000,0x100000):null;
 const observed=new Map();let translationChanged=false;
 function pteAt(index){
  const pte=Atomics.load(pages,index)>>>0;
  if(observed.has(index)&&observed.get(index)!==pte)translationChanged=true;
  else observed.set(index,pte);
  return pte;
 }
 function bindingOffsets(pointer){
  if(direct(pointer,128))return Array.from({length:128},(_,i)=>offset(pointer)+i);
  // Do not misinterpret the runtime's larger direct window, or its DIB
  // special case, as sparse. Do not extend the observer's direct ceiling.
  if(pointer+128>0x100000000||offset(pointer)<0x8000000||
    (pointer<0x53f00000&&pointer+128>0x50000000)||!pages)return null;
  const offsets=[];
  for(let n=0;n<128;){
   const va=pointer+n,pte=pteAt(va>>>12),back=(pte&0xfffff000)>>>0;
   const protect=pte&0x7ff,base=protect&0xff;
   // Valid readable private PAGE_* values; guard, noaccess, execute-only,
   // malformed modifiers and private/cache/RPC/DIB backing are not readable.
   if(!(pte&0x800)||![2,4,0x20,0x40].includes(base)||
     ((protect&0x700)!==0&&(protect&0x700)!==0x200)||
     back<0x8000000||back+0x1000>0x1a000000||back+0x1000>buffer.byteLength)return null;
   const count=Math.min(128-n,0x1000-(va&0xfff));
   for(let i=0;i<count;i++)offsets.push(back+(va&0xfff)+i);
   n+=count;
  }
  return offsets;
 }
 function binding(key){
  const pointer=u32(0x4d6c60+key*4);
  if(!pointer)return {key,pointer,text:''};
  const offsets=bindingOffsets(pointer);
  if(!offsets)return {key,pointer,text:null,status:'UNKNOWN binding translation/bounds/permissions'};
  let text='';for(let n=0;n<128;n++){
   const ch=view.getUint8(offsets[n]);if(!ch)return {key,pointer,text};
   if(ch<32||ch>126)return {key,pointer,text:null,status:'UNKNOWN non-ASCII binding'};text+=String.fromCharCode(ch);
  }
  return {key,pointer,text:null,status:'UNKNOWN unterminated binding'};
 }
 // Fixed executable-owned received frame, never pm's transient global pointer
 // (which can point into a stack or a game DLL). All ranges use the same
 // conservative direct policy as attack data. No new pointer/PTE fallback.
 // ParseFrame marks valid BEFORE parsing; compare the entire 240-byte frame
 // with its published ring slot, then repeat both. This rejects an unfinished
 // publication but is still point sampling, not an atomic/lifetime witness.
 function motionSample(){
  const frame=0xa9ce98,size=240;
  if(!direct(0xa86a60,4)||!direct(frame,size))return null;
  const state=u32(0xa86a60),number=u32(frame+4);
  const slot=0xa9cf8c+(number&15)*size;
  if(!direct(slot,size))return null;
  return {state,slot,current:Array.from(new Uint8Array(buffer,offset(frame),size)),
   published:Array.from(new Uint8Array(buffer,offset(slot),size))};
 }
 const motionFirst=motionSample();
 // Fixed executable-owned ring only: 16 * 240 bytes, read twice. No game
 // DLL/edict pointer traversal, RPC, export, hook or guest writes. Older slots
 // are evidence of received states, never a server-side damage event log.
 function damageRing(){
  return direct(0xa9cf8c,16*240)?Array.from(new Uint8Array(buffer,offset(0xa9cf8c),16*240)):null;
 }
 const damageFirst=damageRing();
 const first=Array.from({length:5},(_,i)=>u32(0xac13a0+i*4));
 // Preserve attack rows/order. These are Q2 keycodes, not Win32 VKs:
 // Space, Mouse2, a/d, comma/period, left/right arrows and strafe modifier.
 // MapKey's pinned scan table supplies keyboard codes; the canonical EXE
 // keynames table at 0x448ec8 identifies Mouse2 as 201. Never infer an action
 // from a physical key name: saved live bindings can differ from defaults.
 const keys=[13,133,200,32,201,97,100,44,46,130,131,132];
 const bindings=keys.map(binding);
 const physical=[13,17,37,38,39,40,32,65,68,188,190,18].map(key=>({key,state:w.renderer.peekKeyDownState?.(key)??null}));
 const again=keys.map(binding);
 const second=Array.from({length:5},(_,i)=>u32(0xac13a0+i*4));
 const motionSecond=motionSample();
 const damageSecond=damageRing();
 for(const [index,pte] of observed)if((Atomics.load(pages,index)>>>0)!==pte)translationChanged=true;
 if(runningApps!==all||all.length!==1||all[0]!==a||a.wine!==w||a.name!=='quake2_demo'||
   !w.running||w._stopped||w.processId!==identity.processId||w.guestWorker!==g||g.link!==l||
   l.endpointIdentity!==identity.endpoint||l.worker!==objects.workerObject||l.module!==objects.moduleObject||
   w.renderer!==objects.pageRendererObject||document.getElementById('screen')!==objects.canvasObject||
   globalThis.__mcmPassiveIdentityV1!==s||s.epoch!==identity.epoch||
   Object.entries(objects).some(([key,value])=>s.ids.get(value)!==identity[key])||
   w.memory!==memory||l.memory!==memory||memory.buffer!==buffer)return fail('owner/memory changed during read');
 if(!canonical())return fail('attack executable window changed during read');
 const motionEqual=motionFirst&&motionSecond&&JSON.stringify(motionFirst)===JSON.stringify(motionSecond);
 let playerMotion={status:'UNKNOWN',reason:'received frame unavailable, inactive, unpublished, malformed or changed during read'};
 if(motionEqual){
  const bytes=Uint8Array.from(motionSecond.current),v=new DataView(bytes.buffer);
  const frameNumber=v.getInt32(4,true),pmType=v.getInt32(0x30,true);
  if(motionSecond.state===4&&v.getUint32(0,true)===1&&frameNumber>0&&
    v.getUint32(8,true)===(frameNumber*100>>>0)&&pmType>=0&&pmType<=255&&
    motionSecond.current.every((b,i)=>b===motionSecond.published[i])){
   const rawOrigin=[0,1,2].map(i=>v.getInt16(0x34+i*2,true));
   const rawVelocity=[0,1,2].map(i=>v.getInt16(0x3a+i*2,true));
   playerMotion={status:'SNAPSHOT',source:'received client frame pmove (prediction input)',
    address:0xa9cec8,frameAddress:0xa9ce98,publishedFrameAddress:motionSecond.slot,
    frameNumber,serverTimeMs:v.getUint32(8,true),pmType,pmFlags:v.getUint8(0x40),
    rawOrigin,rawVelocity,origin:rawOrigin.map(n=>n/8),velocity:rawVelocity.map(n=>n/8),
    originUnits:'world units',velocityUnits:'world units/second',
    limits:'repeated point samples only; freshness between samples, consumption, contact, damage cause, all-writers and lifetime UNKNOWN'};
  }
 }
 const stable=first.every((v,i)=>v===second[i])&&!translationChanged&&
   JSON.stringify(bindings)===JSON.stringify(again)&&bindings.every(v=>v.text!==null);
 let damageFeedback={status:'UNKNOWN',cause:'UNKNOWN',reason:'owning published frame/history unavailable, malformed or changed during read'};
 if(stable&&playerMotion.status==='SNAPSHOT'&&damageFirst&&damageSecond&&
    damageFirst.every((b,i)=>b===damageSecond[i])){
  const ring=new DataView(Uint8Array.from(damageSecond).buffer),history=[];
  function decode(v,at){
   const blend=Array.from({length:4},(_,i)=>v.getFloat32(at+0x90+i*4,true));
   const kickAngles=Array.from({length:3},(_,i)=>v.getFloat32(at+0x64+i*4,true));
   if(!blend.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!kickAngles.every(Number.isFinite))return null;
   return {frameNumber:v.getInt32(at+4,true),serverTimeMs:v.getUint32(at+8,true),
    health:v.getInt16(at+0xaa,true),blend,kickAngles,pmFlags:v.getUint8(at+0x40)};
  }
  const current=decode(new DataView(Uint8Array.from(motionSecond.current).buffer),0);
  for(let number=Math.max(1,playerMotion.frameNumber-15);number<=playerMotion.frameNumber;number++){
   const at=(number&15)*240;
   if(ring.getUint32(at,true)!==1||ring.getInt32(at+4,true)!==number||
      ring.getUint32(at+8,true)!==(number*100>>>0))continue;
   const row=decode(ring,at);if(row)history.push(row);
  }
  if(current&&JSON.stringify(history.at(-1))===JSON.stringify(current)){
   const observedHealthDecreases=[];
   for(let i=1;i<history.length;i++){
    const a=history[i-1],b=history[i];
    if(b.frameNumber===a.frameNumber+1&&b.health<a.health)
     observedHealthDecreases.push({fromFrame:a.frameNumber,toFrame:b.frameNumber,fromHealth:a.health,toHealth:b.health});
   }
   damageFeedback={status:'SNAPSHOT',source:'received client playerstate; fixed published ring',
    current,history,historyLimit:16,observedHealthDecreases,cause:'UNKNOWN',
    limits:'repeated point samples, not atomic history; missing frames and older damage may be lost; health/blend/kick do not identify attacker, environment or contact; freshness, server damage events, all-writers and lifetime UNKNOWN'};
  }
 }
 // A rejected owner/binding sample must not carry apparently usable motion.
 if(!stable)playerMotion={status:'UNKNOWN',reason:'owning attack/binding/translation sample rejected'};
 return {status:stable?'SNAPSHOT':'UNKNOWN',reason:stable?null:'attack/binding/translation invalid or changed during read',
  at:new Date().toISOString(),identity,memoryIdentity,bindings,
  physical,playerMotion,damageFeedback,
  attack:{address:0xac13a0,first,second,down:second.slice(0,2),state:second[4],held:!!(second[4]&1),impulseDown:!!(second[4]&2)},
  consumption:'UNKNOWN; latch snapshot only, no event history or usercmd execution witness',weaponEffect:'UNKNOWN'};
}
function createChain(bound,options){
 const chain=bound.createChain(options),windows=signatures();
 let memoryIdentity;
 const observe=async identity=>{
  const row=await options.evaluate('('+readPage.toString()+')('+JSON.stringify(identity)+','+JSON.stringify(windows)+','+JSON.stringify(memoryIdentity??null)+')');
  // An identified owner stays pinned even if its binding is unreadable.
  // A later memory replacement cannot repair an UNKNOWN sample's custody.
  if(row?.memoryIdentity)memoryIdentity??=row.memoryIdentity;
  return row;
 };
 return {...chain,get closed(){return chain.closed;},
  capture:async label=>{const shot=await chain.capture(label);shot.after.attackInput=await observe(shot.capture.identity);return shot;},
  progress:async identity=>({...await chain.progress(identity),attackInput:await observe(identity)})};
}
// Opt-in command policy. Attack/binding status is a separate observation;
// ordinary captures may legitimately carry unavailable motion.
function requireMotion(sample){
 if(sample?.attackInput?.playerMotion?.status!=='SNAPSHOT')
  throw Error('required playerMotion UNKNOWN; no replay');
}
module.exports={createChain,readPage,signatures,WINDOWS,requireMotion};
