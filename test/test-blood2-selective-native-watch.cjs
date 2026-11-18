'use strict';
// Native instructions, transient stores, shared CPU instances, and lifecycle
// loss. No retained-run dependency; optionally consumes an explicitly supplied
// exact module. The authentic DLL and real Worker/render controls are separate.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {create}=require('../tools/blood2-selective-native-watch.cjs');
const moduleBytes=fs.readFileSync(process.env.BLOOD2_SELECTIVE_TEST_MODULE||'build/wine-assembly.wasm');
const mod=new WebAssembly.Module(moduleBytes),u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
const pc=0x401000,stop=0x402000,obj=0x500000,vt=0x600000;
const s32=(p,v)=>[0xc7,0x05,...u32(p),...u32(v)];
function boot(memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true})) {
  const events=[];let e;
  const host=new Proxy({memory,log_eip:tag=>events.push({tag,pc:e.get_eip()>>>0,
    thread:e.get_current_thread_id()>>>0,fields:Array.from({length:6},(_,i)=>e.selective_watch_field(i)>>>0)})},
    {get:(o,k)=>k in o?o[k]:String(k).startsWith('beep_')?()=>0:(...a)=>{throw Error('unexpected import '+String(k)+' '+a);}});
  e=new WebAssembly.Instance(mod,{host}).exports;
  e.init_thread(0,0x400000,pc,stop+0x100,0,0,0,0);e.set_esp(0x7408000);
  const mem=new Uint8Array(memory.buffer),put=(p,b)=>mem.set(b,e.guest_to_wasm(p)>>>0);
  const arm=()=>e.set_selective_watch(pc,pc+0x400,pc+0x500,pc+0x600,vt);
  const run=code=>{put(pc,code);put(stop,[0xeb,0xfe]);e.set_eip(pc);e.set_bp(stop);
    for(let n=0;e.get_eip()!==stop;n++){assert(n<50);e.run(10000);}};
  return {e,memory,events,put,arm,run};
}
const state=e=>Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp',
  'flag_op','flag_a','flag_b','flag_res','yield_reason'].map(k=>[k,e['get_'+k]()>>>0]));
const start=[0xb9,...u32(obj)],init=[...s32(obj,vt),...s32(obj+12,1)];
const cases=[
  {name:'unrelated including same page',code:[...s32(obj+64,7),...s32(obj+4096,8)],tags:[]},
  {name:'nonzero reference changes suppressed',code:[...s32(obj+12,2),...s32(obj+12,1)],tags:[]},
  {name:'primary transient zero/restore in same block',code:[...s32(obj,0),...s32(obj,vt)],tags:[-17]},
  {name:'reference transient zero/restore in same block',code:[...s32(obj+12,0),...s32(obj+12,1)],tags:[-18]},
  {name:'both first invalidations retained once',code:[...s32(obj,0),...s32(obj+12,0),...s32(obj,3),...s32(obj+12,0)],tags:[-17,-18]},
  {name:'same word negative',code:[0x66,0xc7,0x05,...u32(obj),0,0],tags:[]},
  {name:'word invalidation',code:[0x66,0xc7,0x05,...u32(obj+2),0,0],tags:[-17]},
  {name:'byte invalidation',code:[0xc6,0x05,...u32(obj+2),0],tags:[-17]},
  {name:'REP STOS invalidation',code:[0xbf,...u32(obj),0x31,0xc0,0xb9,...u32(4),0xf3,0xab],tags:[-17,-18]},
  {name:'REP MOVS invalidation',code:[0xbf,...u32(obj),0xbe,...u32(obj+4096),0xb9,...u32(4),0xf3,0xa5],tags:[-17,-18]},
  {name:'MMX qword invalidation',code:[0x0f,0x6f,0x05,...u32(obj+4096),0x0f,0x7f,0x05,...u32(obj)],tags:[-17]},
  {name:'SSE 128 invalidation',code:[0x0f,0x10,0x05,...u32(obj+4096),0x0f,0x11,0x05,...u32(obj)],tags:[-17,-18]},
];
const results=[];
for(const c of cases){const arms=[];
  for(const on of [false,true]){
    const h=boot();h.e.set_ecx(obj);if(on)h.arm();
    const code=[...init,...c.code];code.push(0xe9,...u32(stop-(pc+code.length+5)));h.run(code);
    if(on){assert.deepEqual(h.events.map(r=>r.tag),[-16,-23,...c.tags],c.name);assert(h.events.every(r=>r.thread===1));}
    else assert.equal(h.events.length,0);
    arms.push({state:state(h.e),bytes:Array.from({length:20},(_,i)=>h.e.guest_read8(obj+i))});
    if(on){h.e.set_selective_watch(0,0,0,0,0);assert.equal(h.e.selective_watch_field(0),0);
      const count=h.events.length;h.e.guest_write32(obj,0);assert.equal(h.events.length,count);
      assert.throws(h.arm,WebAssembly.RuntimeError,'disposed scope cannot rearm');}
  }
  assert.deepEqual(arms[0],arms[1],c.name+' registers, flags and guest memory');results.push(c.name);
}
{
  const h=boot();h.e.set_ecx(obj);h.arm();const code=[...init];code.push(0xe9,...u32(stop-(pc+code.length+5)));h.run(code);
  const peer=boot(h.memory);peer.arm();peer.e.guest_write32(obj+64,10);assert.equal(peer.events.length,0);
  peer.e.guest_write32(obj,0);assert.deepEqual(peer.events.map(r=>r.tag),[-17]);
  h.e.guest_write32(obj,2);assert.equal(h.events.filter(r=>r.tag===-17).length,0,'process-wide first claim');
  results.push('shared actual CPU instances and negative peer store');
}
{
  const h=boot();h.e.set_ecx(obj);h.arm();
  h.e.load_pe(0);assert.equal(new DataView(h.memory.buffer).getUint32(h.e.selective_watch_base()+20,true),0,'first load before execution is not reset loss');
  h.put(pc,[0xeb,0xfe]);h.e.set_eip(pc);h.e.run(1);
  h.e.load_pe(0);assert.equal(new DataView(h.memory.buffer).getUint32(h.e.selective_watch_base()+20,true),4);
  h.put(pc,[0xeb,0xfe]);h.e.set_eip(pc);h.e.run(1);assert(h.events.some(r=>r.tag===-22));
  results.push('native reload permanently records loss');
}
{
  const h=boot();h.e.set_ecx(obj);h.arm();const code=[...init];code.push(0xe9,...u32(stop-(pc+code.length+5)));h.run(code);
  const v=new DataView(h.memory.buffer);v.setUint32(h.e.selective_watch_base()+24,64,true);
  h.e.guest_write32(obj,0);assert(h.events.some(r=>r.tag===-22));assert.equal(v.getUint32(h.e.selective_watch_base()+20,true),1);
  results.push('native event bound is terminal loss');
}
assert.throws(()=>create({}),/bounds/);
const reader=create({emit(){},now:()=>1,deadline:100});assert.equal(reader.summary().callbacks,0);reader.stop('exit');assert.equal(reader.summary().active,false);
// Caller-supplied imports retain their real errors; observation never catches
// an error from the original function and turns it into a successful call.
{
  const memory=new WebAssembly.Memory({initial:1}),sentinel=Error('original import error');
  const reader=create({emit(){},now:()=>1,deadline:100}),h={memory,log(){throw sentinel;}};
  reader.wrapImports({host:h});assert.throws(()=>h.log(),e=>e===sentinel);
}
// A late CPU has no initialized guest mapping yet. Shared module-derived
// configuration must arm it immediately, before init_thread or a host import.
{
  const memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true}),events=[],calls=[];
  const words=new Int32Array(memory.buffer);words[33]=0x5060f8;
  const e={selective_watch_base:()=>128,get_current_thread_id:()=>1,set_selective_watch:(...args)=>calls.push(args)};
  const reader=create({emit:r=>events.push(r),now:()=>1,deadline:100});
  reader.wrapImports({host:{memory}})({exports:e});
  assert.deepEqual(calls[0],[0x504792,0x504777,0x5047f9,0x505d2c,0x5060f8]);
  assert.equal(reader.summary().moduleBoundaries,0);reader.stop('disposed');
  assert.deepEqual(calls[1],[0,0,0,0,0]);assert.equal(events.at(-1).kind,'stop');
}
{
  const events=[],reader=create({emit:r=>events.push(r),now:()=>1,deadline:100});
  const bind=reader.wrapImports({host:{memory:new WebAssembly.Memory({initial:1})}});
  assert.throws(()=>bind({exports:{}}),/native module required/);
  assert.equal(reader.summary().active,false);assert.equal(events.at(-1).reason,'UNKNOWN:observation-error');
}
{
  const reader=create({emit(){},now:()=>1,deadline:100});
  for(let i=0;i<32;i++)reader.wrapImports({host:{memory:new WebAssembly.Memory({initial:1})}});
  assert.throws(()=>reader.wrapImports({host:{memory:new WebAssembly.Memory({initial:1})}}),/instance bound/);
}
{
  const events=[],reader=create({emit:r=>events.push(r),now:()=>1,deadline:100,maxRows:2,control:true});
  const e={set_selective_watch(){},get_current_thread_id:()=>1};
  const host=()=>({host:{memory:new WebAssembly.Memory({initial:1,maximum:1,shared:true})}});
  reader.wrapImports(host())({exports:e});
  assert.throws(()=>reader.wrapImports(host())({exports:e}),/row bound/);
  assert.equal(events.at(-1).reason,'UNKNOWN:observation-error');assert.equal(reader.summary().active,false);
}
{
  const events=[],memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true}),h={memory};
  const reader=create({emit:r=>events.push(r),now:()=>1,deadline:100,control:true});
  const e={set_selective_watch(){},selective_watch_base:()=>128,selective_watch_field:()=>0,
    get_current_thread_id:()=>7,get_eip:()=>99,get_dbg_prev2_eip:()=>88,get_dbg_prev_eip:()=>90,
    guest_to_wasm:()=>0xf0};
  for(const r of ['eax','ebx','ecx','edx','esi','edi','esp','ebp'])e['get_'+r]=()=>0;
  reader.wrapImports({host:h})({exports:e});new Int32Array(memory.buffer)[128/4+5]=2;
  assert.throws(()=>h.log_eip(-22),/native observation loss/);
  const loss=events.find(r=>r.kind==='UNKNOWN:native-watch');assert.equal(loss.shared[5],2);
  assert.equal(loss.thread,7);assert.equal(loss.object,null);assert.equal(events.at(-1).reason,'UNKNOWN:observation-error');
}
// No host.log call: constructor readiness comes from the actual load_dll
// publication boundary. This models the missing boundary found in the single
// original; the authentic controls below the CLI exercise the real export.
{
  const events=[],memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true}),v=new DataView(memory.buffer),calls=[];
  const sentinel=Error('native load failure');
  const e={get_dll_count:()=>0,get_dll_capacity:()=>1,get_dll_table:()=>512,
    guest_to_wasm:n=>n,get_current_thread_id:()=>1,selective_watch_base:()=>128,
    set_selective_watch:(...args)=>calls.push(args),
    load_dll(n){assert.equal(this,e);if(!n)throw sentinel;
      v.setUint32(512,0x1000,true);v.setUint32(520,0x100,true);v.setUint32(0x110c,0x200,true);
      new Uint8Array(memory.buffer,0x1200,11).set(Buffer.from('IMRT25.DLL\0'));return 41;},
    init_thread(){return 42;}};
  const reader=create({emit:r=>events.push(r),now:()=>1,deadline:100});
  const instance=reader.wrapImports({host:{memory}})({exports:e});assert.equal(calls.length,0);
  assert.equal(instance.exports.load_dll(1),41);assert.equal(calls.length,1);
  assert.equal(instance.exports.init_thread(),42);assert.equal(reader.summary().moduleBoundaries,2);
  assert.throws(()=>instance.exports.load_dll(0),error=>error===sentinel);
  assert.equal(reader.summary().moduleBoundaries,2);assert.equal(reader.summary().active,true);
  assert.notEqual(instance.exports,e);assert.equal(events.find(r=>r.kind==='armed').modules[0].base,0x1000);
  reader.stop('disposed');
}
console.log(JSON.stringify({pass:true,moduleSHA256:require('node:crypto').createHash('sha256').update(moduleBytes).digest('hex'),results}));
