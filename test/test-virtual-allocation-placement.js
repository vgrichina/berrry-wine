#!/usr/bin/env node
'use strict';

// Exercise the actual shared-memory allocator, including pending reservations
// across concurrent WASM instances. No JS model substitutes for its decisions.
const assert = require('assert');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { compileSrcWasm } = require('./compile-src');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const R = require('../lib/region-map.generated');
const MB = 1024 * 1024;
const extra = `
  (func (export "placement_reset")
    (call $zero_memory (global.get $VIRTUAL_MAP_STATE) (global.get $VIRTUAL_MAP_STATE_SIZE))
    (call $zero_memory (global.get $VIRTUAL_MAP_TABLE) (global.get $VIRTUAL_MAP_TABLE_SIZE))
    (call $zero_memory (global.get $VIRTUAL_RESERVE_TABLE) (global.get $VIRTUAL_RESERVE_TABLE_SIZE))
    (call $zero_memory (global.get $VIRTUAL_HOLE_TABLE) (global.get $VIRTUAL_HOLE_TABLE_SIZE))
    (call $zero_memory (global.get $GUEST_PAGE_TABLE) (global.get $GUEST_PAGE_TABLE_SIZE))
    (global.set $virtual_alloc_top (global.get $VIRTUAL_ALLOC_TOP_INIT)))
  (func (export "placement_min") (result i32) (call $virtual_alloc_min))
  (func (export "placement_top") (result i32) (global.get $VIRTUAL_ALLOC_TOP_INIT))
  (func (export "placement_window_end") (result i32) (region.end $DIRECT_WINDOW))
  (func (export "placement_alloc") (param $size i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00500000))
    (call $handle_VirtualAlloc (i32.const 0) (local.get $size) (local.get $flags)
      (i32.const 4) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "placement_commit") (param $base i32) (param $size i32) (result i32)
    (call $virtual_map_commit_protect (local.get $base) (local.get $size) (i32.const 4)))
  (func (export "placement_release") (param $base i32) (result i32)
    (call $virtual_map_release (local.get $base)))
  (func (export "placement_internal") (param $size i32) (result i32)
    (call $virtual_reserve_down (local.get $size)))
  (func (export "placement_write") (param $base i32) (param $value i32)
    (call $gs32 (local.get $base) (local.get $value)))
  (func (export "placement_read") (param $base i32) (result i32)
    (call $gl32 (local.get $base)))
`;

async function boot(module, memory, slot, imageBase = 0x400000) {
  const host = { memory };
  for (const [name, sig] of Object.entries(sigs)) host[name] = sig.results?.length ? () => 0 : () => {};
  const e = (await WebAssembly.instantiate(module, { host })).exports;
  e.init_thread(slot, imageBase, 0, 0, 0, 0, 0, 0);
  return e;
}
function nonoverlap(rows) {
  rows.sort((a,b) => a.base-b.base);
  for (let i=0;i<rows.length;i++) {
    const r=rows[i];
    assert(r.base && r.base % 65536 === 0, 'successful aligned reservation');
    assert(r.base+r.size<=0x7f000000, 'unchanged ceiling');
    assert(r.base>=0x60000000 || r.base+r.size<=0x50000000, 'excluded band');
    if(i) assert(rows[i-1].base+rows[i-1].size<=r.base, 'live allocations never overlap');
  }
}

async function main() {
  const baseline = process.argv.includes('--baseline');
  const bytes=compileSrcWasm((name,source) => {
    if(baseline) source=require('child_process').execFileSync('git',['show','HEAD:src/'+name],{encoding:'utf8',maxBuffer:5e6});
    return name==='13-exports.wat' ? source+'\n'+extra : source;
  });
  const module=await WebAssembly.compile(bytes);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const e=await boot(module,memory,0),v=new DataView(memory.buffer);
  const count=()=>v.getUint32(R.BASE.VIRTUAL_MAP_STATE+16,true);
  const maps=()=>v.getUint32(R.BASE.VIRTUAL_MAP_STATE,true);
  const min=e.placement_min()>>>0,top=e.placement_top()>>>0;
  e.placement_reset();
  const low=e.placement_alloc(MB,0x2000)>>>0;
  assert.equal(low,min,'default NULL reserve must use lowest available address');
  const high=e.placement_alloc(MB,0x102000)>>>0;
  assert.equal(high,top-MB,'MEM_TOP_DOWN retains high placement');
  assert.equal(count(),2,'both pending owners are published');
  assert.equal(e.placement_commit(low+65536,4096)>>>0,low+65536);
  assert.equal(e.placement_commit(low+4*65536,4096)>>>0,low+4*65536);
  e.placement_write(low+65536,0x12345678);
  assert.equal(e.placement_release(low),1,'release disjoint committed islands by reservation base');
  assert.equal(maps(),0,'all interior maps retired');
  assert.equal(e.placement_alloc(MB,0x2000)>>>0,low,'released default address reusable');
  assert.equal(e.placement_commit(low+65536,4096)>>>0,low+65536);
  assert.equal(e.placement_read(low+65536),0,'reused backing is zeroed');
  e.placement_release(low);e.placement_release(high);
  assert.equal(count(),0);

  // MEM_TOP_DOWN must find the highest free address even when a lower live
  // tenant pins the internal downward cursor beneath a released top block.
  e.placement_reset();
  const topA=e.placement_alloc(65536,0x102000)>>>0;
  const topB=e.placement_alloc(65536,0x102000)>>>0;
  assert.equal(topA,top-65536);assert.equal(topB,top-2*65536);
  assert.equal(e.placement_release(topA),1);
  const topC=e.placement_alloc(65536,0x102000)>>>0;
  assert.equal(topC,topA,'MEM_TOP_DOWN reuses the highest gap above a live tenant');
  e.placement_release(topB);e.placement_release(topC);

  // Adjacent independent allocations may have adjacent backing but distinct
  // lifetime. Freeing one cannot clear its neighbour.
  e.placement_reset();
  const a=e.placement_alloc(65536,0x3000)>>>0,b=e.placement_alloc(65536,0x3000)>>>0;
  assert.equal(b,a+65536);
  e.placement_write(b,0x5a5a1234);e.placement_release(a);
  assert.equal(e.placement_read(b)>>>0,0x5a5a1234);
  assert.equal(count(),1);e.placement_release(b);assert.equal(maps(),0);

  // Fill all guest address capacity without consuming backing, alternating
  // directions. Release a fragmented 192MiB extent and reuse the whole gap.
  e.placement_reset();
  const lower=e.placement_alloc(0x50000000-min,0x2000)>>>0;
  const upper=e.placement_alloc(top-0x60000000,0x102000)>>>0;
  assert.equal(lower,min);assert.equal(upper,0x60000000);
  assert.equal(e.placement_alloc(65536,0x2000),0,'full address space exhausted');
  assert.equal(e.placement_alloc(65536,0x102000),0);
  e.placement_release(lower);e.placement_release(upper);
  const live=[];for(let i=0;i<16;i++)live.push(e.placement_alloc(32*MB,0x2000)>>>0);
  const keepHigh=e.placement_alloc(32*MB,0x102000)>>>0;
  for(let i=3;i<9;i++)e.placement_release(live[i]);
  const large=e.placement_alloc(192*MB,0x2000)>>>0;
  assert.equal(large,live[3],'fragmented large contiguous capacity is retained');
  nonoverlap([...live.filter((_,i)=>i<3||i>=9).map(base=>({base,size:32*MB})),
    {base:large,size:192*MB},{base:keepHigh,size:32*MB}]);
  for(const size of [0,0xffffffff,0x80000000])assert.equal(e.placement_alloc(size,0x2000),0,'overflow/oversize');

  // A failed commit must relinquish its pending reservation. Capacity refers
  // to address space above, independently of this bounded physical pool.
  e.placement_reset();
  assert.equal(e.placement_alloc(400*MB,0x3000),0,'insufficient backing fails');
  assert.equal(count(),0,'failed commit has no orphan reservation');
  assert.equal(maps(),0,'failed split has no orphan maps');
  assert.equal(e.placement_alloc(MB,0x3000)>>>0,min);

  // Three actual worker_threads race mixed API/internal/view reservations.
  // Keep all addresses owned while commits deliberately happen later.
  e.placement_reset();
  const barrier=new SharedArrayBuffer(4),workers=[];
  try {
    const jobs=[1,2,3].map(slot=>new Promise((resolve,reject)=>{
      const w=new Worker(__filename,{workerData:{module,memory,slot,barrier}});workers.push(w);
      w.once('error',reject);w.on('message',m=>m.ready?ready():resolve(m));
      w.once('exit',code=>{if(code)reject(Error('worker exit '+code));});
    }));
    let readyCount=0;function ready(){if(++readyCount===3){Atomics.store(new Int32Array(barrier),0,1);Atomics.notify(new Int32Array(barrier),0);}}
    let timer;const result=await Promise.race([Promise.all(jobs),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('30s worker guard')),30000))]).finally(()=>clearTimeout(timer));
    const rows=result.flat();nonoverlap(rows);assert.equal(rows.length,180);assert.equal(count(),rows.length);
    for(const r of rows){if(r.committed)assert.equal(e.placement_read(r.base)>>>0,r.value);assert.equal(e.placement_release(r.base),1);}
    assert.equal(count(),0);assert.equal(maps(),0);
  } finally {await Promise.all(workers.map(w=>w.terminate()));}
  // An image based at 0x10000000 (Jardinains) puts the direct window over
  // guest 0x0FFEE000-0x17FEE000 while the floor stays capped at 0x10000000.
  // $g2w answers that window from the image delta, so a reservation placed
  // there aliases the image: the default search must step over it.
  {
    const hiMem=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
    const h=await boot(module,hiMem,0,0x10000000);
    h.placement_reset();
    const winLo=0x10000000-R.BASE.GUEST_BASE, winHi=winLo+(h.placement_window_end()>>>0);
    const d=h.placement_alloc(MB,0x2000)>>>0, t=h.placement_alloc(MB,0x102000)>>>0;
    for(const [what,base] of [['default',d],['MEM_TOP_DOWN',t]]) {
      assert(base, what+' reservation succeeds for a high image');
      assert(base>=winHi || base+MB<=winLo,
        `${what} reservation 0x${base.toString(16)} overlaps the image's direct window`);
    }
    assert.equal(d,Math.ceil(winHi/65536)*65536,'default search resumes just above the window');
  }
  console.log('PASS default/top-down placement, pending ownership, islands, adjacent lifetime, full/fragmented capacity, rollback, 3 concurrent instances, high-image direct window');
}

async function worker() {
  const {module,memory,slot,barrier}=workerData,e=await boot(module,memory,slot);
  parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(barrier),0,0,30000);
  const rows=[];
  for(let i=0;i<60;i++){
    const size=65536,kind=i%4;
    const base=(kind===0?e.placement_internal(size):kind===1?e.guest_section_reserve(size):
      e.placement_alloc(size,kind===2?0x2000:0x102000))>>>0;
    assert(base);rows.push({base,size,kind,value:slot*1000+i,committed:false});
  }
  for(const r of rows)if(r.kind!==1){assert.equal(e.placement_commit(r.base,4096)>>>0,r.base);e.placement_write(r.base,r.value);r.committed=true;}
  parentPort.postMessage(rows);
}
(isMainThread?main():worker()).catch(error=>{console.error(error);process.exitCode=1;});
