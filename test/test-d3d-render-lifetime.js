#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {bootRenderHarness}=require('./render-helper');
(async()=>{
  // Expose every scalar mutable global read-only in this test module. This
  // catches allocator bins/hints as well as translation/guest state changes.
  const globals=require('../lib/wat-manifest').WAT_FILES.flatMap(file=>
    [...fs.readFileSync(path.join(__dirname,'../src',file),'utf8')
      .replace(/;;[^\n]*/g,'').matchAll(/\(global\s+(\$[\w.-]+)\s+\(mut\s+(i32|i64|f32|f64)\)/g)]
      .map(m=>({name:m[1],type:m[2]})));
  const globalExports=globals.map((g,i)=>`(func (export "diag_global_${i}") (result ${g.type}) (global.get ${g.name}))`).join('\n');
  const extraWat=globalExports+`(func (export "diag_set_head") (param i32) (global.set $free_list (local.get 0)))
    (func (export "diag_arenas") (result i32) (global.get $HEAP_ARENAS))
    (func (export "diag_pte") (param i32) (result i32)
      (i32.add (global.get $GUEST_PAGE_TABLE)
        (i32.and (i32.shr_u (local.get 0) (i32.const 10)) (i32.const 0x003ffffc))))
    (func (export "force_sparse_block") (result i32)
    (i32.add (call $heap_sparse_alloc (i32.const 32)) (i32.const 4)))
    (func (export "reverse_pointer") (param i32) (result i32)
      (call $w2g (local.get 0)))
    (func (export "new_map") (result i32)
      (call $virtual_map_commit (call $virtual_reserve_down (i32.const 65536)) (i32.const 4096)))
    (func (export "release_map") (param i32) (result i32)
      (call $virtual_map_release (local.get 0)))
    (func (export "dib_roundtrip") (result i32)
      (i32.eq (call $w2g (i32.add (global.get $DIB_BACKING_BASE) (i32.const 17)))
        (i32.add (global.get $DIB_GUEST_BASE) (i32.const 17))))`;
  const parent=await bootRenderHarness({fonts:'none',extraWat});
  const e=parent.exports,memory=parent.memory;
  // Large requests now use dedicated arenas before consulting the free list.
  // Consume retired capacity in ordinary-sized chunks to exercise adoption,
  // including the final header, without testing the obsolete large policy.
  const consumeTail=(start,bytes)=>{
    let remaining=bytes;
    while(remaining){
      const need=remaining>4112?4096:remaining;
      assert.strictEqual(e.guest_alloc(need-4)>>>0,start+remaining-need+4,'parent reuses retired capacity');
      remaining-=need;
    }
  };
  const guard=e.guest_alloc(64)>>>0;
  assert.strictEqual(e.reverse_pointer(e.guest_to_wasm(guard))>>>0,guard,'direct allocation round trip');
  new Uint8Array(memory.buffer,e.guest_to_wasm(guard),64).fill(0xa7);
  const spare=e.guest_alloc(32);e.guest_free(spare);
  const originalHead=e.get_free_list()>>>0;
  const child=await bootRenderHarness({fonts:'none',extraWat,memory});
  const w=child.exports;w.d3dim_worker_init(e.get_image_base());
  const a=w.guest_alloc(56)>>>0,b=w.guest_alloc(128)>>>0;
  w.guest_free(a);w.guest_free(b);
  const tail=w.get_heap_ptr()>>>0,tailBytes=(w.get_heap_end()>>>0)-tail;
  const head=w.d3d_render_retire_heap()>>>0;
  assert.strictEqual(head,tail,'remaining current arena becomes a free block');
  assert.strictEqual(w.get_free_list(),0,'producer detaches ownership');
  assert.strictEqual(w.get_heap_ptr(),0);
  assert.strictEqual(w.d3d_render_retire_heap(),0,'repeat retirement cannot republish nodes');
  const view=new DataView(memory.buffer),at=e.guest_to_wasm(head)>>>0;
  const next=view.getUint32(at+4,true),size=view.getUint32(at,true);
  view.setUint32(at+4,head,true);
  assert.strictEqual(e.d3d_render_adopt_free_list(head),-1,'cycle rejected');
  assert.strictEqual(e.get_free_list()>>>0,originalHead,'cycle rejection is atomic');
  view.setUint32(at+4,next,true);view.setUint32(at,8,true);
  assert.strictEqual(e.d3d_render_adopt_free_list(head),-1,'malformed block rejected');
  assert.strictEqual(e.get_free_list()>>>0,originalHead);
  view.setUint32(at,size,true);
  for(const invalid of [head+1,0xfffffff8])assert.strictEqual(e.d3d_render_adopt_free_list(invalid),-1);
  assert.strictEqual(e.d3d_render_adopt_free_list(head),3,'tail and two freed allocations transferred');
  assert.strictEqual(e.d3d_render_adopt_free_list(head),-1,'double adoption rejected before mutation');
  consumeTail(tail,tailBytes);
  assert.strictEqual(e.guest_alloc(128)>>>0,b,'parent actually reuses worker freed allocation');
  assert.strictEqual(e.guest_alloc(56)>>>0,a);
  assert(new Uint8Array(memory.buffer,e.guest_to_wasm(guard),64).every(v=>v===0xa7),'live parent bytes preserved');

  // Exercise the other allocator arena without needing to exhaust the entire
  // low window. This calls the production sparse allocator, not a fake mapping.
  const sparse=await bootRenderHarness({fonts:'none',extraWat,memory});
  const s=sparse.exports;s.d3dim_worker_init(e.get_image_base());
  const p=s.force_sparse_block()>>>0,wasm=s.guest_to_wasm(p)>>>0;
  for(const offset of [0,1,27])assert.strictEqual(s.reverse_pointer(wasm+offset)>>>0,p+offset,
    'sparse allocation and interior pointers round trip');
  s.d3d_shader_vm_free(wasm);
  assert.strictEqual(s.guest_alloc(28)>>>0,p,'native WASM-pointer release actually reuses sparse allocation');
  s.d3d_shader_vm_free(wasm);
  const sparseTail=s.get_heap_sparse_ptr()>>>0;
  const sparseBytes=(s.get_heap_sparse_end()>>>0)-sparseTail;
  const sparseHead=s.d3d_render_retire_heap()>>>0;
  assert.strictEqual(sparseHead,sparseTail);
  assert.strictEqual(e.d3d_render_adopt_free_list(sparseHead),2,'sparse block and tail transferred');
  consumeTail(sparseTail,sparseBytes);
  assert.strictEqual(e.guest_alloc(28)>>>0,p,'sparse allocation reusable');
  const isolated=await bootRenderHarness({fonts:'none',extraWat,memory});
  const c=isolated.exports;c.d3dim_worker_init(e.get_image_base());
  assert.strictEqual(c.d3d_render_coalesce_heap(),0,'empty list');
  const group=Array.from({length:3},()=>c.guest_alloc(60)>>>0);
  const live=c.guest_alloc(60)>>>0,small=c.guest_alloc(28)>>>0;
  new Uint8Array(memory.buffer,c.guest_to_wasm(live),60).fill(0x6d);
  for(const index of [1,0,2])c.guest_free(group[index]);
  c.guest_free(small);
  assert.strictEqual(c.d3d_render_coalesce_heap(),2,'unsorted adjacent blocks merge');
  assert.strictEqual(c.d3d_render_coalesce_heap(),0,'coalescing is idempotent');
  assert.strictEqual(c.guest_alloc(28)>>>0,small,'small fit preserves larger merged extent');
  assert.strictEqual(c.guest_alloc(188)>>>0,group[0],'merged extent is actually reusable');
  assert(new Uint8Array(memory.buffer,c.guest_to_wasm(live),60).every(v=>v===0x6d),'live block remains untouched');
  c.guest_free(small);
  // A small free goes to its size bin; get_free_list splices the bins onto the
  // list, so the cycle below is planted in the list coalesce actually walks.
  assert.strictEqual(c.get_free_list()>>>0,small-4,'binned block rejoins the list head');
  const header=c.guest_to_wasm(small-4)>>>0;
  view.setUint32(header+4,small-4,true);
  assert.strictEqual(c.d3d_render_coalesce_heap(),-1,'cycle rejected before sorting');
  assert.strictEqual(view.getUint32(header+4,true),small-4,'rejected chain remains untouched');
  view.setUint32(header+4,0,true);
  const overlapA=c.guest_alloc(60)>>>0,overlapB=c.guest_alloc(60)>>>0;
  assert.strictEqual(overlapA,small+32);
  assert.strictEqual(overlapB,overlapA+64);
  c.guest_free(overlapA);c.guest_free(overlapB);
  const overlapHeader=c.guest_to_wasm(overlapA-4)>>>0;
  view.setUint32(overlapHeader,128,true);
  assert.strictEqual(c.d3d_render_coalesce_heap(),-1,'overlapping free extents rejected');
  assert.strictEqual(view.getUint32(overlapHeader,true),128,'overlap rejection does not resize blocks');
  view.setUint32(overlapHeader,64,true);
  assert.strictEqual(c.d3d_render_coalesce_heap(),2,'repaired chain merges both blocks and adjacent small extent');
  assert.strictEqual(c.dib_roundtrip(),1,'DIB inverse remains independent of sparse maps');
  const maps=[c.new_map()>>>0,c.new_map()>>>0];
  assert(maps.every(Boolean));
  const backings=maps.map(g=>c.guest_to_wasm(g)>>>0);
  for(let i=0;i<2;i++)for(const offset of [0,4095])
    assert.strictEqual(c.reverse_pointer(backings[i]+offset)>>>0,maps[i]+offset);
  assert.strictEqual(c.release_map(maps[0]),1);
  assert.strictEqual(c.reverse_pointer(backings[0]),0,'released backing has no fabricated guest alias');
  assert.strictEqual(c.reverse_pointer(backings[1])>>>0,maps[1],'map-table compaction preserves live inverse');
  assert.strictEqual(c.release_map(maps[1]),1);
  assert.strictEqual(c.reverse_pointer(backings[1]),0);

  const diagnostic=await bootRenderHarness({fonts:'none',extraWat,memory});
  const d=diagnostic.exports;d.d3dim_worker_init(e.get_image_base());
  const digest=()=>crypto.createHash('sha256').update(new Uint8Array(memory.buffer)).digest('hex');
  const state=()=>globals.map((_,i)=>d[`diag_global_${i}`]());
  const check=(label,expected)=>{
    const before=digest(),beforeGlobals=state();
    const fields=Array.from({length:12},(_,i)=>d.d3d_render_free_list_diagnostic(i)>>>0);
    assert.strictEqual(d.d3d_render_free_list_diagnostic(99),-1);
    assert.deepStrictEqual(state(),beforeGlobals,`${label}: every mutable scalar global unchanged (including bins/hint)`);
    assert.strictEqual(digest(),before,`${label}: complete shared memory unchanged`);
    for(const [field,value] of Object.entries(expected))assert.strictEqual(fields[field],value>>>0,`${label}: field ${field}`);
    return fields;
  };
  check('empty',{0:0,1:0,2:0,10:0});
  const low=d.guest_alloc(60)>>>0,bin=d.guest_alloc(28)>>>0;
  const sparseBlock=d.force_sparse_block()>>>0;
  d.guest_free(bin); // Stay binned throughout ALL queries; never get_free_list.
  const binState=state();
  assert(globals.some((g,i)=>/^\$heap_bin\d+$/.test(g.name)&&
    binState[i]!== (g.type==='i64'?0n:0)),'nonempty bins exercise no-flush contract');
  check('binned-only list remains empty',{0:0,1:0,10:0});
  const block=low-4,wa=d.guest_to_wasm(block)>>>0;
  const savedHeader=Buffer.from(new Uint8Array(memory.buffer,wa,8));
  const arenas=d.diag_arenas()>>>0,arenaCount=view.getUint32(arenas,true);
  let rec=0;
  for(let i=0;i<arenaCount;i++){
    const r=arenas+16+i*16;
    if(block>=view.getUint32(r,true)&&block<view.getUint32(r+8,true))rec=r;
  }
  assert(rec,'real direct allocation has authoritative arena');
  const base=view.getUint32(rec,true),end=view.getUint32(rec+4,true),high=view.getUint32(rec+8,true);
  const plant=(size=64,next=0)=>{view.setUint32(wa,size,true);view.setUint32(wa+4,next,true);d.diag_set_head(block);};
  plant();check('valid direct',{0:0,1:block,2:0,10:1});
  const sparseHeader=sparseBlock-4,sparseWa=d.guest_to_wasm(sparseHeader)>>>0;
  const savedSparse=Buffer.from(new Uint8Array(memory.buffer,sparseWa,8));
  view.setUint32(sparseWa+4,0,true);d.diag_set_head(sparseHeader);
  check('valid production sparse allocation',{0:0,1:sparseHeader,10:1});
  const pte=d.diag_pte(sparseHeader)>>>0,savedPte=view.getUint32(pte,true);
  view.setUint32(pte,(memory.buffer.byteLength|(savedPte&4095))>>>0,true);
  check('mapped header outside linear memory',{0:4,2:sparseHeader,4:0,5:0});
  view.setUint32(pte,savedPte,true);
  plant(64,sparseHeader);check('valid direct-to-sparse chain',{0:0,1:block,2:0,10:2});
  d.diag_set_head(block+1);check('unaligned',{0:2,2:block+1,3:0,4:0,6:0,10:0});
  d.diag_set_head(0xfffffff8);check('missing arena',{0:3,2:0xfffffff8,3:0,4:0,6:0});
  plant(8,block);check('small size',{0:5,2:block,3:wa,4:8,5:block,6:rec,7:base,8:end,9:high,10:0});
  plant(18);check('unaligned size',{0:5,4:18});
  plant(0xfffffff8);check('extent overflow',{0:6,4:0xfffffff8});
  plant(end-block+8);check('extent outside arena',{0:7});
  plant();view.setUint32(rec+8,block+8,true);check('extent outside high-water',{0:7,9:block+8});
  view.setUint32(rec+8,block+4,true);check('header outside high-water',{0:9,3:0,4:0});
  view.setUint32(rec+8,high,true);
  view.setUint32(rec+4,block+4,true);check('header outside arena',{0:9,3:0,4:0});
  view.setUint32(rec+4,end,true);
  view.setUint32(arenas,0xffffffff,true);check('corrupt arena count',{0:8,3:0,11:0xffffffff});
  view.setUint32(arenas,arenaCount,true);
  // Point the real record at a definitely unmapped high guest page; the
  // diagnostic must reject it without invoking g2w_miss or reading a header.
  // Avoid the wrapping direct-window alias near UINT32_MAX when image_base=0.
  const absent=0x65432000,absentPte=d.diag_pte(absent)>>>0;
  const savedAbsentPte=view.getUint32(absentPte,true);view.setUint32(absentPte,0,true);
  view.setUint32(rec,absent,true);view.setUint32(rec+4,absent+4096,true);view.setUint32(rec+8,absent+4096,true);
  d.diag_set_head(absent);check('unmapped header',{0:4,2:absent,4:0,5:0,6:rec});
  view.setUint32(absentPte,savedAbsentPte,true);
  view.setUint32(rec,base,true);view.setUint32(rec+4,end,true);view.setUint32(rec+8,high,true);
  plant(64,block);check('cycle bounded',{0:1,2:block,3:0,10:65536});
  plant(64,block+32);check('ascending adjacent overlap',{0:10,1:block,2:block,3:wa,4:64,5:block+32,10:0});
  plant(64,block+1);check('overlap has per-node priority before next alignment',{0:10,2:block,5:block+1,10:0});
  plant(64,block+65);check('failure after valid node',{0:2,1:block,2:block+65,3:0,4:0,10:1});
  // Exercise the production JS failure path against this actual WAT reader,
  // not only a host-side field fixture. Coalesce flushes bins first; capture
  // must still identify the malformed original node behind that valid prefix.
  plant(8);
  const {Device}=require('../lib/d3d9-software-backend');
  const failedDevice=Object.create(Device.prototype);
  failedDevice.options={getExports:()=>d};
  assert.throws(()=>failedDevice.prepare({}),/invalid native free list/);
  const recorded=JSON.parse(failedDevice.nativeFreeListFailure);
  assert.strictEqual(recorded.atomic,false);
  assert.strictEqual(recorded.reason,5);
  assert.strictEqual(recorded.current,block);
  assert.strictEqual(recorded.wasmHeader,wa);
  assert.strictEqual(recorded.rawSize,8);
  assert.strictEqual(recorded.arenaRecord,rec);
  assert.strictEqual(recorded.arenaBase,base);
  assert.strictEqual(recorded.arenaEnd,end);
  assert.strictEqual(recorded.allocatedHighWater,high);
  assert.strictEqual(view.getUint32(wa,true),8,'capture preserves malformed header');
  d.diag_set_head(0);
  new Uint8Array(memory.buffer,wa,8).set(savedHeader);
  new Uint8Array(memory.buffer,sparseWa,8).set(savedSparse);
  console.log('PASS native renderer heap lifetime and passive diagnostic: direct+sparse, bounds, cycles, bins and complete memory/global preservation');
})().catch(error=>{console.error(error);process.exitCode=1;});
