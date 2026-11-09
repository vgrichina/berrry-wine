'use strict';
// Page-side shared-memory reads only: no Worker RPC, CPU export or guest write.
const fs=require('node:fs'),assert=require('node:assert/strict');
const core=require('../lib/quake2-owning-load-core');
const WINDOWS=[[0x407650,0x83],[0x4076e0,0xa6],[0x407930,0x1e],
  [0x407de0,0x32],[0x41911a,7],[0x42fe10,0x2d],[0x44d398,0x80]];
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
 const fail=reason=>({status:'UNKNOWN',reason,consumption:'UNKNOWN',weaponEffect:'UNKNOWN'});
 const all=typeof runningApps==='undefined'?[]:runningApps;
 const a=all[0],w=a?.wine,g=w?.guestWorker,l=g?.link,s=globalThis.__mcmPassiveIdentityV1;
 if(all.length!==1||a.name!=='quake2_demo'||!w?.running||w._stopped||!s)return fail('owner unavailable');
 const objects={processObject:w,endpointObject:l,workerObject:l?.worker,moduleObject:l?.module,pageRendererObject:w.renderer,canvasObject:document.getElementById('screen')};
 if(w.processId!==identity.processId||l?.endpointIdentity!==identity.endpoint||s.epoch!==identity.epoch||
   Object.entries(objects).some(([key,value])=>!value||s.ids.get(value)!==identity[key]))return fail('owner identity changed');
 const memory=w.memory;
 if(!memory||l.memory!==memory||!(memory.buffer instanceof SharedArrayBuffer))return fail('owning shared memory unavailable');
 if(!s.ids.has(memory))s.ids.set(memory,s.epoch+':'+(++s.next));
 if(!s.ids.has(memory.buffer))s.ids.set(memory.buffer,s.epoch+':'+(++s.next));
 const memoryIdentity=s.ids.get(memory)+'/'+s.ids.get(memory.buffer);
 if(expectedMemory&&expectedMemory!==memoryIdentity)return fail('owning memory changed');
 // Pinned direct GUEST_BASE mapping, only for the installed nonrelocated EXE
 // and conservative direct guest addresses. Sparse pointers stay UNKNOWN.
 const view=new DataView(memory.buffer),offset=va=>va-0x400000+0x12000;
 const direct=(va,n)=>Number.isInteger(va)&&va>=0x400000&&va+n<=0x4000000&&offset(va)+n<=view.byteLength;
 for(const p of windows)if(!direct(p.va,p.bytes.length)||p.bytes.some((b,i)=>view.getUint8(offset(p.va)+i)!==b))return fail('attack executable window mismatch');
 if(!direct(0xac13a0,20)||!direct(0x4d6c60,804))return fail('attack data outside owning direct memory');
 const u32=va=>view.getUint32(offset(va),true);
 function binding(key){
  const pointer=u32(0x4d6c60+key*4);
  if(!pointer)return {key,pointer,text:''};
  if(!direct(pointer,128))return {key,pointer,text:null,status:'UNKNOWN sparse/outside direct window'};
  let text='';for(let n=0;n<128;n++){
   const ch=view.getUint8(offset(pointer)+n);if(!ch)return {key,pointer,text};
   if(ch<32||ch>126)return {key,pointer,text:null,status:'UNKNOWN non-ASCII binding'};text+=String.fromCharCode(ch);
  }
  return {key,pointer,text:null,status:'UNKNOWN unterminated binding'};
 }
 const first=Array.from({length:5},(_,i)=>u32(0xac13a0+i*4));
 const bindings=[13,133,200].map(binding); // Q2 Enter, K_CTRL, K_MOUSE1, not Win32 VKs.
 const second=Array.from({length:5},(_,i)=>u32(0xac13a0+i*4));
 const stable=first.every((v,i)=>v===second[i]);
 return {status:stable?'SNAPSHOT':'UNKNOWN',reason:stable?null:'attack changed during read',
  at:new Date().toISOString(),identity,memoryIdentity,bindings,
  physical:[13,17,37,38,39,40].map(key=>({key,state:w.renderer.peekKeyDownState?.(key)??null})),
  attack:{address:0xac13a0,first,second,down:second.slice(0,2),state:second[4],held:!!(second[4]&1),impulseDown:!!(second[4]&2)},
  consumption:'UNKNOWN; latch snapshot only, no event history or usercmd execution witness',weaponEffect:'UNKNOWN'};
}
function createChain(bound,options){
 const chain=bound.createChain(options),windows=signatures();
 let memoryIdentity;
 const observe=async identity=>{
  const row=await options.evaluate('('+readPage.toString()+')('+JSON.stringify(identity)+','+JSON.stringify(windows)+','+JSON.stringify(memoryIdentity??null)+')');
  if(row?.status==='SNAPSHOT')memoryIdentity??=row.memoryIdentity;
  return row;
 };
 return {...chain,get closed(){return chain.closed;},
  capture:async label=>{const shot=await chain.capture(label);shot.after.attackInput=await observe(shot.capture.identity);return shot;},
  progress:async identity=>({...await chain.progress(identity),attackInput:await observe(identity)})};
}
module.exports={createChain,readPage,signatures,WINDOWS};
