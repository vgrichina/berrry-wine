#!/usr/bin/env node
'use strict';
// Internal allocator pressure and private-list ownership. Public API behavior
// is covered separately by test-heap-pressure-recovery-web.js.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const ROOT=process.cwd();
const baseline=process.env.WA_PRESSURE_EXPECT_BASELINE==='1';
const {watxSourceClosure,compileClosure}=require(ROOT+'/tools/watx-closure');
const {applyToVfs}=require(ROOT+'/lib/dispatch-trampoline');
const sigs=require(ROOT+'/lib/host-import-sigs.generated.json').sigs;
const regions=require(ROOT+'/lib/region-map.generated');
const extra=`
 (func (export "pressure_compact") (param $budget i32) (result i32)
  (call $heap_compact_free_list_bounded (local.get $budget)))
 (func (export "pressure_work") (result i32) (global.get $heap_compact_work))
 (func (export "pressure_set_list") (param $p i32) (global.set $free_list (local.get $p)))
 (func (export "pressure_arena") (param $p i32) (result i32)
  (call $heap_arena_find (i32.sub (local.get $p) (i32.const 4))))
 (func (export "pressure_release") (result i32) (call $heap_arena_release_free))
 (func (export "pressure_pack") (param $src i32) (result i32)
  (call $d3dim_pack_fvf_vertices (i32.const 2) (local.get $src)
   (i32.const 1408) (i32.const 0)))
 (func (export "pressure_bin") (param $i i32) (param $head i32) (param $tail i32)
  (call $heap_bin_set (local.get $i)
   (i64.or (i64.extend_i32_u (local.get $head))
    (i64.shl (i64.extend_i32_u (local.get $tail)) (i64.const 32)))))
 (func (export "pressure_page") (param $p i32) (param $value i32) (result i32)
  (i32.atomic.rmw.xchg
   (i32.add (global.get $GUEST_PAGE_TABLE)
    (i32.shl (i32.shr_u (local.get $p) (i32.const 12)) (i32.const 2)))
   (local.get $value)))
`;
function compile(mode){
 let testExports=extra;
 if(baseline)testExports=testExports.replace('(call $heap_compact_free_list_bounded (local.get $budget))','(call $heap_compact_free_list)').replace('(global.get $heap_compact_work)','(i32.const 0)');
 const c=watxSourceClosure();for(const k of ['13-exports.wat','src/13-exports.wat','./13-exports.wat'])c.vfs.set(k,c.vfs.get(k)+'\n'+testExports);
 const r=compileClosure({...c,vfs:mode==='compat'?applyToVfs(new Map(c.vfs)):c.vfs},{tailCalls:mode!=='compat'});
 assert(r.success,r.error||r.message);return Buffer.from(r.wasmBinary);
}
(async()=>{
 for(const mode of ['standard','compat']){
  const binary=compile(mode),module=await WebAssembly.compile(binary);
  if(process.env.WA_PRESSURE_ARTIFACTS){fs.mkdirSync(process.env.WA_PRESSURE_ARTIFACTS,{recursive:true});fs.writeFileSync(path.join(process.env.WA_PRESSURE_ARTIFACTS,mode+'.wasm'),binary);}
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),oom=[];
  const make=async thread=>{
   const host={memory};for(const [n,s]of Object.entries(sigs))host[n]=s.results?.length?()=>0:()=>{};
   host.heap_oom_trace=(size,reason)=>oom.push({thread,size:size>>>0,reason});
   const e=(await WebAssembly.instantiate(module,{host})).exports;
   e.init_thread(thread,0x400000,0,0,0,0,0);return e;
  };
  const a=await make(0);a.heap_init(regions.BASE.GUEST_HEAP_BASE-regions.GUEST_BASE+0x400000);
  const p=await make(1),read=q=>a.guest_read32(q)>>>0;
  const arena=q=>a.pressure_arena(q)>>>0;
  const record=q=>{const r=arena(q);assert(r);return{r,base:new DataView(memory.buffer).getUint32(r,true),end:new DataView(memory.buffer).getUint32(r+4,true),top:new DataView(memory.buffer).getUint32(r+8,true)};};
  const guards=new Map(),mark=(e,q,n=16384)=>{
   for(const off of [0,4,n-4])e.guest_write32(q+off,(0x5a1234a5^q^off)>>>0);
   guards.set(q,n);
  };
  const check=()=>{for(const[q,n]of guards)for(const off of [0,4,n-4])assert.equal(read(q+off),(0x5a1234a5^q^off)>>>0,mode+' live guard '+q+'+'+off);};
  const first=Array.from({length:4},()=>a.guest_alloc(16384)>>>0);
  const peer=Array.from({length:4},()=>p.guest_alloc(16384)>>>0);
  assert(first.every(Boolean)&&peer.every(Boolean));for(const q of first)mark(a,q);for(const q of peer)mark(p,q);
  const fast=a.guest_alloc(45056)>>>0;assert(fast);assert(fast>=first[3]+16384,'no pressure means bump, no full scan');
  assert.equal(a.pressure_work(),0,'fast allocation never invokes compaction');mark(a,fast,45056);
  // Exhaust fixed sparse backing while keeping the original spans live.
  const fills=[];let refused=0;
  for(let i=0;i<40000;i++){
   const q=a.guest_alloc(16384)>>>0;if(!q){refused=1;break;}fills.push(q);mark(a,q);
  }
  assert(refused);assert(fills.length>10000);assert.equal(memory.buffer.byteLength,512*1024*1024);
  for(let i=0;i<3;i++){p.guest_free(peer[i]);guards.delete(peer[i]);}
  const peerHead=p.get_free_list()>>>0,peerSnapshot=[];
  for(let q=peerHead;q;){peerSnapshot.push([q,read(q),read(q+4)]);q=read(q+4);assert(peerSnapshot.length<1000);}
  assert.equal(a.guest_alloc(45056),0,'peer free spans cannot be borrowed');
  assert.deepEqual(peerSnapshot.map(([q])=>[q,read(q),read(q+4)]),peerSnapshot,'peer list links unchanged');check();
  for(let i=0;i<3;i++){a.guest_free(first[i]);guards.delete(first[i]);}
  if(baseline){
   const refusedPack=a.pressure_pack(fast)>>>0;
   assert.equal(refusedPack,0,'baseline actual vertex pack refuses recoverable fragmentation');
   const largest=a.pressure_compact(262144)>>>0;assert(largest>=45056);
   const compacted=a.pressure_pack(fast)>>>0;assert(compacted>=first[0]&&compacted<first[3]);
   assert.equal(read(compacted),read(fast));check();
   console.log(JSON.stringify({outcome:'PASS',baseline:true,mode,moduleSha256:crypto.createHash('sha256').update(binary).digest('hex'),fills:fills.length,liveGuards:guards.size,refused:refusedPack,largest,compacted,blockBytes:read(compacted-4),memoryBytes:memory.buffer.byteLength}));
   continue;
  }
  const own=a.pressure_pack(fast)>>>0;
  assert(own>=first[0]&&own<first[3],'actual 1408x32 temporary vertex pack recovers own free span');
  assert.equal(read(own),read(fast),'vertex pack copied the live source');mark(a,own,45056);check();
  // Locate three adjacent real allocations in one sparse arena, with a fourth
  // live guard. No heap cursor or memory/backing setter is used.
  let sparse;
  for(let i=fills.length-4;i>=0;i--){
   const run=fills.slice(i,i+4),r=record(run[0]);
   if(run[0]>=0x10000000&&run.every(q=>arena(q)===r.r)&&run.slice(1).every((q,j)=>q-run[j]===16392)){sparse=run;break;}
  }
  assert(sparse,'ordinary allocations include sparse adjacent extents');mark(a,sparse[3]);
  for(const q of sparse.slice(0,3)){a.guest_free(q);guards.delete(q);}
  const recovered=a.pressure_pack(fast)>>>0;
  assert(recovered>=sparse[0]&&recovered<sparse[3],'actual temporary vertex pack recovers under sparse/backing pressure');
  assert.equal(read(recovered),read(fast));mark(a,recovered,45056);check();
  // Complete validation must succeed before sorting or merging. Deliberately
  // insufficient work cannot mutate the already-flushed list.
  const snapshot=()=>{
   const rows=[];let q=a.get_free_list()>>>0;
   for(;q;){rows.push([q,read(q),read(q+4)]);q=read(q+4);assert(rows.length<=65536);}return rows;
  };
  const before=snapshot();assert(before.length>2);
  assert.equal(a.pressure_compact(1),-1,'bounded work exhaustion refuses compaction');assert.equal(a.pressure_work(),0);assert.deepEqual(snapshot(),before);check();
  const [badHeader,originalSize]=before[0];
  for(const bad of [8,originalSize|1,0x7ffffff8]){
   a.guest_write32(badHeader,bad);
   try{assert.equal(a.pressure_compact(262144),-1,'malformed/tagged/escaping free extent refused');}
   finally{a.guest_write32(badHeader,originalSize);}
   assert.deepEqual(snapshot(),before);check();
  }
  // A missing live header before a free boundary must refuse metadata
  // validation without invoking g2w's pager/fault callbacks. Trap mode makes
  // any accidental faulting translation fail this test immediately.
  const earlier=fills.find(q=>arena(q)===arena(sparse[0])&&q<sparse[0]);assert(earlier);
  const pte=a.pressure_page(earlier-4,0)>>>0;assert(pte);
  try{a.set_fault_unmapped(2);assert.equal(a.pressure_compact(262144),-1,'unmapped metadata never enters the guest pager');}
  finally{a.pressure_page(earlier-4,pte);a.set_fault_unmapped(0);}
  assert.deepEqual(snapshot(),before);check();
  // Unmapped and interior links must be rejected before compaction mutates
  // headers. An interior fake extent sits inside a still-live payload.
  const saved=a.get_free_list()>>>0,interior=first[3]+128-4;
  a.guest_write32(interior,16384-128);a.guest_write32(interior+4,0);
  for(const head of [0xfffffff8,interior]){
   a.pressure_set_list(head);assert.equal(a.pressure_compact(262144),-1);
   assert.equal(a.get_free_list()>>>0,head);assert.equal(a.guest_alloc(45056),0,'malformed list cannot manufacture recovery');check();
  }
  a.pressure_set_list(saved);
  // Corrupt bin tails/chains are refused before the flush can write through
  // them. A forged interior tail points into the adjacent live guard.
  const tiny=a.guest_alloc(16)>>>0;assert(tiny);a.guest_free(tiny);
  const tinyHeader=tiny-4,tailWord=read(interior+4);
  a.pressure_bin(1,tinyHeader,interior);
  assert.equal(a.pressure_compact(262144),-1);assert.equal(read(interior+4),tailWord);check();
  a.pressure_bin(1,tinyHeader,tinyHeader);a.guest_write32(tinyHeader+4,tinyHeader);
  assert.equal(a.pressure_compact(262144),-1);assert.equal(read(tinyHeader+4),tinyHeader);check();
  a.guest_write32(tinyHeader+4,0);a.get_free_list();
  // A cycle among real free boundaries is bounded and unmodified on compact
  // validation failure; normal allocation retains its existing cycle cut.
  const cycle=fills.slice(0,2);for(const q of cycle){a.guest_free(q);guards.delete(q);}
  const h0=cycle[0]-4,h1=cycle[1]-4;
  a.guest_write32(h0+4,h1);a.guest_write32(h1+4,h0);a.pressure_set_list(h0);
  assert.equal(a.pressure_compact(262144),-1);assert.equal(read(h0+4),h1);assert.equal(read(h1+4),h0);
  assert.equal(a.guest_alloc(45056),0);check();
  a.pressure_set_list(saved);
  // Retired sparse carved arena: freeing all its payloads must NOT let
  // compaction create the whole-header shape a peer can release/reuse.
  const groups=new Map();
  for(const q of fills){if(cycle.includes(q)||sparse.includes(q))continue;const r=record(q);if(r.base<0x10000000)continue;if(!groups.has(r.r))groups.set(r.r,{...r,ptrs:[]});groups.get(r.r).ptrs.push(q);}
  const full=[...groups.values()].find(r=>r.ptrs.length>=60&&r.ptrs[0]-4===r.base&&r.end-r.base===1024*1024&&r.top===r.end);
  assert(full,'fully tracked retired carved sparse arena exists');
  for(const q of full.ptrs){a.guest_free(q);guards.delete(q);}
  assert(a.pressure_compact(262144)>=45056,'partial sparse spans still recover');
  let boundaryNodes=0,crossArenaNeighbors=0,previous;
  for(const[q,size]of snapshot()){
   const r=record(q+4);assert(q+size<=r.end,'coalescence never crosses arena boundary');
   if(previous&&previous.q+previous.size===q&&previous.r!==r.r)crossArenaNeighbors++;
   previous={q,size,r:r.r};
   if(r.r===full.r){boundaryNodes++;assert(size<r.end-r.base,'carved sparse arena never becomes a dedicated-large shape');}
  }
  assert(boundaryNodes>=2);assert(crossArenaNeighbors>0,'real adjacent free extents across arena boundaries stay separate');
  assert.equal(p.pressure_release(),0,'peer cannot release our coalesced carved arena');
  assert.equal(arena(full.base+4),full.r,'private-list arena remains resident');check();
  assert.equal(a.guest_alloc(0xfffffff0),0,'oversized error remains visible');
  assert(oom.some(r=>r.thread===0&&r.reason===1),'real backing-pressure failures remain traced');
  console.log(JSON.stringify({outcome:'PASS',mode,moduleSha256:crypto.createHash('sha256').update(binary).digest('hex'),fills:fills.length,liveGuards:guards.size,own,recovered,blockBytes:[read(own-4),read(recovered-4)],fullCarvedArena:full.base,boundaryNodes,crossArenaNeighbors,memoryBytes:memory.buffer.byteLength,oom:oom.slice(-8)}));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
