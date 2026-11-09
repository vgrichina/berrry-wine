'use strict';
// Execute the shipped module, with real x86 stores and direct SAB inspection.
// No extra WAT, test exports, game startup, browser, or host-store simulation.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {hash}=require('./quake2-owning-load-witness.cjs');
const bytes=fs.readFileSync('build/wine-assembly.wasm');
const mod=new WebAssembly.Module(bytes);
const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
const pc=0x401000,stop=0x402000,data=0x500000,src=0x510000;
const fields=['on','pc','generation','invalid','limit',
  ...['a','b'].flatMap(r=>['lo','hi','epoch','overflow','pc','address','width','host'].map(k=>r+'_'+k))];
function boot(memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true})) {
  const host=new Proxy({memory},{get:(o,k)=>k in o?o[k]:String(k).startsWith('beep_')?()=>0:(...args)=>{throw Error('unexpected core import '+String(k)+' '+args);}});
  const e=new WebAssembly.Instance(mod,{host}).exports;
  e.init_thread(0,0x400000,pc,stop+0x100,0,0,0,0);
  e.set_esp(0x7408000);
  const mem=new Uint8Array(memory.buffer),wa=a=>e.guest_to_wasm(a)>>>0;
  const copy=(a,v)=>mem.set(v,wa(a));
  const receipt=()=>Object.fromEntries(fields.map((k,i)=>[k,e.native_store_get(i)>>>0]));
  return {e,memory,mem,wa,copy,receipt};
}
const s8=(a,n)=>[0xc6,0x05,...u32(a),n];
const s16=(a,n)=>[0x66,0xc7,0x05,...u32(a),n&255,n>>>8&255];
const s32=(a,n)=>[0xc7,0x05,...u32(a),...u32(n)];
const state=e=>Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res','yield_reason'].map(k=>[k,e['get_'+k]()>>>0]));
function execute(enabled,{code,lo=data,hi=data+4,blo=0,bhi=0,limit=0}) {
  const h=boot(),{e,mem,copy,wa}=h;
  copy(pc,[...code,0xe9,...u32(stop-(pc+code.length+5))]);copy(stop,[0xeb,0xfe]);
  e.set_eip(pc);
  if(enabled)e.native_store_arm(lo,hi,blo,bhi,limit);
  for(let n=0;e.get_eip()!==stop;n++){assert(n<100);e.run(10000);}
  assert(mem.subarray(wa(data),wa(src)+32).every(v=>v===0),'same-byte/restore controls leave original zero bytes');
  return {...h,state:state(e),guestHash:hash(mem.subarray(wa(data),wa(src)+32))};
}
const cases=[
  {name:'same-byte',code:s32(data,0),epoch:1,width:4},
  {name:'write-restore',code:[...s32(data,123),...s32(data,0)],epoch:2,width:4,lastPC:pc+10},
  {name:'byte',code:s8(data,0),epoch:1,width:1},
  {name:'word',code:s16(data,0),epoch:1,width:2},
  {name:'interior-range-cross',code:s32(data,0),lo:data+2,hi:data+3,epoch:1,width:4},
  {name:'page-cross-word',code:s16(data+4095,0),lo:data+4096,hi:data+4097,epoch:1,width:2},
  {name:'page-cross-dword',code:s32(data+4094,0),lo:data+4096,hi:data+4097,epoch:1,width:4},
  {name:'mmx-qword',code:[0x0f,0x6f,0x05,...u32(src),0x0f,0x7f,0x05,...u32(data)],epoch:1,width:8,lastPC:pc+7},
  {name:'sse-128',code:[0x0f,0x10,0x05,...u32(src),0x0f,0x11,0x05,...u32(data)],epoch:1,width:16,lastPC:pc+7},
  {name:'sse-page-cross-fragments',code:[0x0f,0x10,0x05,...u32(src),0x0f,0x11,0x05,...u32(data+4090)],lo:data+4096,hi:data+4097,epoch:1,width:4,lastPC:pc+7},
  {name:'left-exclusive-bound',code:s32(data-4,0),epoch:0},
  {name:'right-exclusive-bound',code:s32(data+4,0),epoch:0},
  {name:'two-ranges',code:s32(data,0),blo:data+2,bhi:data+4,epoch:1,width:4,bEpoch:1},
  {name:'overflow',code:[...s32(data,1),...s32(data,2),...s32(data,0)],limit:2,epoch:2,width:4,lastPC:pc+20,overflow:1},
];
const results=[];
for(const c of cases) {
  const off=execute(false,c),on=execute(true,c),r=on.receipt();
  assert.deepEqual(on.state,off.state,c.name+' architecture/lazy flags');
  assert.equal(on.guestHash,off.guestHash,c.name+' direct memory parity');
  assert.equal(off.receipt().a_epoch,0);assert.equal(off.receipt().on,0);
  assert.equal(r.a_epoch,c.epoch,c.name);assert.equal(r.a_overflow,c.overflow||0,c.name);
  assert.equal(r.b_epoch,c.bEpoch||0,c.name);
  if(c.epoch){assert.equal(r.a_pc,c.lastPC||pc,c.name+' actual instruction PC');assert.equal(r.a_width,c.width,c.name);assert.equal(r.a_host,0);}
  results.push({name:c.name,state:on.state,guestHash:on.guestHash,receipt:r});
}
{
  const h=boot(),{e,copy,receipt,memory}=h;
  e.native_store_arm(data,data+4,0,0,0);
  copy(data,[1,2,3,4]);copy(data,[0,0,0,0]);assert.equal(receipt().a_epoch,0,'raw shared writer remains uncovered');
  const peer=boot(memory);peer.copy(pc,[...s32(data,5),0xe9,...u32(stop-pc-15)]);peer.copy(stop,[0xeb,0xfe]);peer.e.set_eip(pc);peer.e.run(1000);
  assert.equal(receipt().a_epoch,0,'another actual CPU instance is uncovered');
  e.guest_write32(data,5);assert.equal(receipt().a_epoch,1);assert.equal(receipt().a_pc,0);assert.equal(receipt().a_host,1,'standalone export has no native PC');
  const generation=receipt().generation;e.init_thread(0,0x400000,pc,stop+0x100,0,0,0,0);
  assert.equal(receipt().invalid,1,'native reset invalidates');e.native_store_arm(data,data+4,0,0,0);
  assert(receipt().generation>generation);assert.equal(receipt().invalid,1,'rearm cannot repair reset');
  e.native_store_arm(0,0,0,0,0);assert.equal(receipt().on,0);assert.equal(e.get_dbg_tier_guard(),0);
  results.push({name:'uncovered-writers-reset-rearm-disable',receipt:receipt()});
}
{
  const {e,receipt}=boot();e.native_store_arm(data,data+4,0,0,0);
  assert.equal(receipt().invalid,0);assert.equal(e.load_pe(0),-1);
  assert.equal(receipt().invalid,1,'raw native load_pe invalidates even when header is rejected');
  results.push({name:'reload-invalidates',receipt:receipt()});
}
{
  const {e,receipt}=boot();e.set_instruction_watchpoint(data);
  e.native_store_arm(data,data+4,0,0,0);e.native_store_arm(0,0,0,0,0);
  assert.equal(e.get_watch_addr(),data,'disarm preserves existing debugger watch');
  e.set_instruction_watchpoint(0);assert.equal(e.get_dbg_tier_guard(),0);
  results.push({name:'existing-instruction-debugger-preserved',receipt:receipt()});
}
console.log(JSON.stringify({pass:true,cpuSHA:hash(bytes),testSHA:hash(fs.readFileSync(__filename)),results}));
