'use strict';
// Authored CPU scheduling, OFFLINE. Not the historical1265 native cause.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const w=require('./quake2-frame-writer-witness.cjs'),{hash}=require('./quake2-owning-load-witness.cjs');
const {fixture}=require('./quake2-passive-attack.test.cjs');
const cpu=fs.readFileSync('build/wine-assembly.wasm'),mod=new WebAssembly.Module(cpu),exe=w.binary();
const off=a=>a-0x400000+0x12000,stop=0x440000;
function boot(memory){
 const host=new Proxy({memory,log_i32:()=>{},log:()=>{}},{get:(o,k)=>k in o?o[k]:String(k).startsWith('beep_')?()=>0:()=>{throw Error('unexpected host import '+String(k));}});
 const e=new WebAssembly.Instance(mod,{host}).exports;e.init_thread(0,0x400000,0x402a9e,0x7409000,0,0,0,0);e.set_esp(0x7408000);
 const copy=(a,b)=>new Uint8Array(memory.buffer,off(a),b.length).set(b);
 copy(stop,[0xeb,0xfe]);e.set_instruction_watchpoint(stop);
 function execute(pc,bytes,registers){
  copy(pc,exe.instruction(pc,32));e.invalidate_code_range(pc,32);
  assert.deepEqual(Buffer.from(bytes),exe.instruction(pc,bytes.length));
  for(const [k,v] of Object.entries(registers))e['set_'+k](v);
  e.clear_bp();e.set_eip(pc);
  for(let i=0;e.get_eip()!==pc+bytes.length;i++){assert(i<20);e.run(1);}
  assert.equal(e.get_eip(),pc+bytes.length);
 }
 return {e,execute};
}
function run(name,enabled){
 const f=fixture(true),{e,execute}=boot(f.memory);
 // Authored stable published HP100 frame; same exact production reader.
 f.view.setInt16(off(w.FRAME)+0xaa,100,true);f.put(w.FRAME+0xe8,5);
 const slot=w.RING+(17&15)*240;
 new Uint8Array(f.memory.buffer,off(slot),240).set(new Uint8Array(f.memory.buffer,off(w.FRAME),240));
 let owner=e,buffer=f.memory.buffer;
 const witness=w.attach({enabled,getExports:()=>owner,getMemory:()=>buffer,limit:name==='overflow'?1:0});
 const increment=()=>execute(0x402a9e,exe.instruction(0x402a9e,7),{eax:w.FRAME,esi:5});
 const publication=()=>execute(0x403527,exe.instruction(0x403527,2),{esi:w.FRAME,edi:slot,ecx:60});
 if(name==='publication')f.put(slot+0xe8,4);
 let scheduled=false;
 f.renderer.peekKeyDownState=()=>{
  if(scheduled)return 0;scheduled=true;
  if(['increment','multi','overflow'].includes(name)){increment();if(['multi','overflow'].includes(name))execute(0x402bed,exe.instruction(0x402bed,6),{eax:w.FRAME,ebx:6});}
  if(name==='publication')publication();
  if(name==='frameClear')execute(0x403342,exe.instruction(0x403342,2),{eax:0,edi:w.FRAME,ecx:60});
  if(name==='clientClear')execute(0x409221,exe.instruction(0x409221,2),{eax:0,edi:0xa9c7c0,ecx:0x92d6});
  if(name==='sameByte')execute(0x402a9f,exe.instruction(0x402a9f,6),{eax:w.FRAME,esi:5});
  if(name==='rawHost'){f.put(w.FRAME+0xe8,6);f.put(w.FRAME+0xe8,5);}
  if(name==='hostExport'){e.guest_write32(w.FRAME+0xe8,5);}
  if(name==='peer'){const peer=boot(f.memory);peer.execute(0x402a9f,exe.instruction(0x402a9f,6),{eax:w.FRAME,esi:5});}
  if(name==='resetRearm'){e.init_thread(0,0x400000,stop,0x7409000,0,0,0,0);e.native_store_arm(w.FRAME,w.FRAME+240,w.RING,w.RING+3840,0);}
  if(name==='rearm')e.native_store_arm(w.FRAME,w.FRAME+240,w.RING,w.RING+3840,0);
  if(name==='owner')owner={};
  if(name==='memory')buffer=new SharedArrayBuffer(8);
  return 0;
 };
 // Test-only observation of the EXISTING six Array.from iterations. No
 // production source rewriting, extra guest byte read, or copy retry.
 f.context.__boundary=(copy,edge)=>witness.boundary(copy,edge);f.context.__copies=w.COPIES;
 vm.runInContext(`globalThis.__trace=[];globalThis.__copy=0;
 globalThis.DataView=class extends DataView {
  getUint8(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u8',...a]);return super.getUint8(...a);}
  getUint32(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u32',...a]);return super.getUint32(...a);}
 };
 globalThis.Uint8Array=class extends Uint8Array {
  *[Symbol.iterator](){
   const shared=this.buffer instanceof SharedArrayBuffer;
   const label=shared&&(this.length===240||this.length===3840)?__copies[__copy++]:null;
   if(label)__boundary(label,'before');
   for(let i=0;i<this.length;i++){if(shared)__trace.push(['byte',this.byteOffset+i]);yield this[i];}
   if(label)__boundary(label,'after');
  }
 };`,f.context);
 const row=JSON.parse(JSON.stringify(f.read())),trace=JSON.parse(JSON.stringify(f.context.__trace)),evidence=witness.snapshot();
 const state=Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res','yield_reason'].map(k=>[k,e['get_'+k]()>>>0]));
 return {row,trace,evidence,state,guestSHA:hash(new Uint8Array(f.memory.buffer,off(w.FRAME),240+3840))};
}
const results=[];
for(const name of ['stable','increment','multi','sameByte','publication','rawHost','hostExport','peer','frameClear','clientClear','resetRearm','rearm','owner','memory','overflow']){
 const offRun=run(name,false),onRun=run(name,true);
 assert.deepEqual(onRun.state,offRun.state,name+' architecture/lazy flags parity');assert.equal(onRun.guestSHA,offRun.guestSHA,name+' frame/ring memory parity');
 assert.deepEqual(onRun.trace,offRun.trace,name+' exact guest read count/order');
 const strip=r=>{r=structuredClone(r);delete r.at;return r;};
 assert.deepEqual(strip(onRun.row),strip(offRun.row),name+' unchanged acceptance and predicates');
 assert.equal(offRun.evidence.status,'OFF');
 const s=onRun.evidence,interval=s.intervals.find(i=>i.from===5&&i.to===6);
 assert.equal(s.points.length,12);assert.equal(s.limits.nativeQualification,false);assert.equal(s.limits.frameABA,'UNKNOWN');
 if(['resetRearm','rearm','owner','memory','overflow'].includes(name))assert.equal(s.status,'INVALID');else assert.equal(s.status,'BOUNDED');
 if(name==='increment'){
  assert.equal(onRun.row.rejectedFrame.predicates.motionEqual,false);
  assert.equal(onRun.row.rejectedFrame.predicates.motionPublishedMatches,undefined);
  const a=interval.ranges.current;assert.equal(a.delta,1);assert.equal(a.last.pc,0x402a9f);assert.equal(a.last.address,w.FRAME+0xe8);assert.equal(a.last.width,4);assert(a.nativePC);
 }
 if(name==='publication'){
  assert.equal(onRun.row.rejectedFrame.predicates.motionEqual,false);
  const b=interval.ranges.publishedRing;assert.equal(b.delta,0);assert.equal(b.last,null);
  assert.equal(s.limits.bulkAndLockedStores,'UNKNOWN','real REP publication bypasses the gs witness');
 }
 if(['stable','peer','rawHost'].includes(name)){
  assert.equal(interval.ranges.current.delta,0);assert.equal(interval.ranges.current.last,null);
  assert.equal(onRun.row.playerMotion.status,'SNAPSHOT');
 }
 if(['frameClear','clientClear'].includes(name)){assert.equal(interval.ranges.current.delta,0);assert.equal(onRun.row.rejectedFrame.predicates.motionEqual,false);}
 if(name==='sameByte'){assert.equal(interval.ranges.current.delta,1);assert.equal(onRun.row.playerMotion.status,'SNAPSHOT');}
 if(name==='hostExport'){assert.equal(interval.ranges.current.last.host,1);assert.equal(interval.ranges.current.nativePC,false);}
 if(name==='multi'){const a=interval.ranges.current;assert.equal(a.delta,2);assert.equal(a.last.pc,0x402bed);assert.match(a.history,/last completion only/);}
 if(name==='overflow')assert.equal(interval.ranges.current.status,'INVALID');
 assert.equal(offRun.evidence.points,undefined,'old/off missing witness');
 assert(s.points[6].raw,'new evidence retained independently of acceptance');
 results.push({name,readCount:onRun.trace.length,readSHA:hash(JSON.stringify(onRun.trace)),row:onRun.row,evidence:s});
}
// Sticky reset retains earlier evidence, snapshots are detached, missing
// boundaries cannot imply ordering, and disabled mode touches no APIs.
{
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{e}=boot(memory);
 const s=w.attach({enabled:true,getExports:()=>e,getMemory:()=>memory.buffer,maxBoundaries:12});
 s.boundary(w.COPIES[0],'before');s.boundary(w.COPIES[1],'after');assert.equal(s.snapshot().status,'INVALID');
 const old=s.snapshot();old.points.length=0;assert.equal(s.snapshot().points.length,2);
 for(let i=0;i<20;i++)s.boundary('bad','before');assert.equal(s.snapshot().points.length,12);
 assert.equal(w.attach().snapshot().status,'OFF');
 assert.throws(()=>w.attach({enabled:true,getExports:()=>e,getMemory:()=>memory.buffer}),/already owned/);
 s.close();assert.equal(s.snapshot().status,'INVALID');assert.equal(e.native_store_get(0),0);assert.equal(e.get_watch_addr(),stop);
 const later=w.attach({enabled:true,getExports:()=>e,getMemory:()=>memory.buffer});
 e.native_store_arm(w.FRAME,w.FRAME+240,w.RING,w.RING+3840,0);
 later.close();assert.equal(e.native_store_get(0),1,'close preserves replacement observer');
 e.native_store_arm(0,0,0,0,0);
}
console.log(JSON.stringify({pass:true,authoredScheduling:true,historicalNativeCause:'UNKNOWN',cpuSHA:hash(cpu),exe:exe.receipt,
 readerSHA:hash(fs.readFileSync('tools/quake2-passive-attack.cjs')),testSHA:hash(fs.readFileSync(__filename)),results}));
