'use strict';
const assert=require('node:assert/strict');
const {createObserver}=require('../tools/blood2-object-lifetime-observer.cjs');
assert.throws(()=>createObserver({}),/bounds/);
const memory=new WebAssembly.Memory({initial:32});
const d=new DataView(memory.buffer),b=new Uint8Array(memory.buffer),rows=[];
let pc=0,clock=1,arms=[],calls=0;
const regs={eax:0,ebx:0,ecx:0x180000,edx:0,esi:0,edi:0,esp:0x190000,ebp:0};
const e={guest_to_wasm:p=>p,get_dll_count:()=>2,get_dll_capacity:()=>16,get_dll_table:()=>0x100,
  set_trace_eip_range:(...a)=>arms.push(a),get_current_thread_id:()=>3,get_eip:()=>pc};
for(const r in regs)e['get_'+r]=()=>regs[r];
for(const [i,base,name] of [[0,0x10000,'IMRT25.DLL'],[1,0x20000,'IMUSIC25.DLL']]){
  d.setUint32(0x100+i*32,base,true);d.setUint32(0x108+i*32,0x500,true);
  d.setUint32(base+0x50c,0x600,true);b.set(Buffer.from(name+'\0'),base+0x600);
}
const o=createObserver({emit:r=>rows.push(r),now:()=>clock,deadline:100,maxRows:20});
const h={memory,log_eip:()=>{calls++;return 17;}};o.wrapImports({host:h})({exports:e});
const before=Buffer.from(b);
pc=0x11792;assert.equal(h.log_eip(pc),17);
assert(rows.some(r=>r.kind==='constructor-pointer'&&r.object.pointer===regs.ecx));
assert.deepEqual(Buffer.from(b),before);
d.setUint32(regs.ecx,0x130f8,true);d.setUint32(regs.ecx+12,1,true);
pc=0x11768;h.log_eip(pc);
d.setUint32(regs.ecx+12,0,true);pc=0x11777;h.log_eip(pc);
const change=rows.filter(r=>r.kind==='object-change').at(-1);
assert.equal(change.before.words[3],1);assert.equal(change.after.words[3],0);
assert.equal(change.thread,3);assert.equal(change.lastObservedPC,0x11768);
assert.match(change.attribution,/interval only/);assert.equal(calls,3);
assert.deepEqual(arms[0],[1,1,0xffffffff]);assert.deepEqual(arms[1],[1,0x10000,0x3d000]);
clock=101;h.log_eip(pc);assert.equal(rows.at(-1).reason,'deadline');
assert.deepEqual(arms.at(-1),[0,0,0]);
const bound=[];const small=createObserver({emit:r=>bound.push(r),now:()=>1,deadline:100,maxRows:1});
const sh={memory,log_eip(){}};small.wrapImports({host:sh})({exports:e});sh.log_eip(pc);
assert.equal(bound.at(-1).reason,'UNKNOWN:row-bound');
assert.throws(()=>createObserver({emit(){},now:()=>1,deadline:100,maxBoundaries:0}),/bounds/);
console.log('PASS native reader: constructor provenance, Release interval, caller/thread/module rows, no writes, unchanged imports, deadline/row bounds');
