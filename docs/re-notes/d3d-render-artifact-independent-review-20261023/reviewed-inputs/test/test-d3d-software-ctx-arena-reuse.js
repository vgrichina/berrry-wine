#!/usr/bin/env node
'use strict';
// A draw context big enough for its own large arena (>= 508 KB) must come back
// to the next draw instead of costing a fresh address-space reservation.
//
// $d3d_software_compact shrinks every context with $heap_shrink once setup is
// done. On a block that was its whole $heap_large_alloc arena that split the
// arena, so the freed context went to the small free list rather than the
// large one, and every ~852 KB context in Black & White 2's render worker
// reserved a new range: ~30% of the worker's CPU in $virtual_range_edge_locked
// and the release scan $heap_arena_register runs once the table is full
// (docs/re-notes/black-white-2.md, 2026-10-23).
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
const HEAP_LARGE=0x7F000;
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat:`
    (func (export "test_heap_shrink") (param i32) (param i32) (result i32)
      (call $heap_shrink (local.get 0) (local.get 1)))
    (func (export "reverse_pointer") (param i32) (result i32) (call $w2g (local.get 0)))`});
  const word=p=>new DataView(memory.buffer).getUint32(p,true);
  const header=guest=>word(e.guest_to_wasm(guest-4));
  let cases=0;

  // The allocator alone: a whole-arena block survives a shrink and is reused.
  {
    const BYTES=871200,p=e.guest_alloc(BYTES)>>>0;assert(p);
    const size=header(p);assert(size>=HEAP_LARGE,'request is large-arena sized');
    assert.strictEqual(e.test_heap_shrink(p,120000)>>>0,p,'shrink of a large block succeeds');
    assert.strictEqual(header(p),size,'large block is left whole');
    e.guest_free(p);
    const q=e.guest_alloc(BYTES)>>>0;
    assert.strictEqual(q,p,'freed large block serves the next same-size request');
    e.guest_free(q);cases++;
  }

  // Through the backend: 256 indexed triangles over three vertices give one
  // 768-index context, 288 + 768 * 1134 bytes -- the size B&W2 draws with.
  const live=new Map();
  const track=name=>(desc,...rest)=>{const p=e[name](desc,...rest)>>>0;if(p)live.set(p,e.reverse_pointer(p)>>>0);return p;};
  const ex={...e};
  for(const name of ['d3d_software_create','d3d_software_create_typed',
    'd3d_software_create_deferred','d3d_software_create_deferred_clipped'])
    if(typeof e[name]==='function')ex[name]=track(name);
  const sizes=[];
  ex.d3d_software_free=p=>{sizes.push(header(live.get(p>>>0)));e.d3d_software_free(p);};
  function source(green){
    const vertices=new Uint8Array(3*24),v=new DataView(vertices.buffer);
    for(let j=0;j<3;j++){
      const at=j*24;
      [-1+(j===1?2:0),1-(j===2?2:0),.5].forEach((x,k)=>v.setFloat32(at+k*4,x,true));
      vertices.set(green?[0,255,0,255]:[255,0,0,255],at+12);
      v.setFloat32(at+16,.5,true);v.setFloat32(at+20,.5,true);
    }
    const indices=new Uint16Array(768);for(let i=0;i<768;i++)indices[i]=i%3;
    return {primitive:4,primitiveCount:256,stride:24,vertices,indices,
      attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},
        {register:1,usage:10,usageIndex:0,type:4,offset:12},{register:2,usage:5,usageIndex:0,type:1,offset:16}],
      vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,0xffff]),
      pixelShader:new Uint32Array([0xffff0101,66,0xb00f0000,5,0x800f0000,0xb0e40000,0x90e40000,0xffff]),
      state:{cull:1},textures:[{width:4,height:4,pixels:new Uint8Array(4*4*4).fill(255),sampler:{min:1,mag:1,mip:0}}]};
  }
  const d=new Device({width:8,height:8,getExports:()=>ex,getMemory:()=>memory.buffer}),base=d.bytes;
  const contexts=[],pixels=[];
  for(const green of [false,true,false]){
    live.clear();d.clear([0,0,0,1],1,1,null,null);
    assert.strictEqual(d.draw(source(green)),1);
    assert.strictEqual(live.size,1,'one context per draw');contexts.push(...live.values());
    pixels.push(Array.from(new Uint32Array(d.readPixels().buffer)));
  }
  assert(sizes.every(size=>size>=HEAP_LARGE),`every context had a whole large arena at free (${sizes})`);
  assert.strictEqual(contexts[1],contexts[0],'second draw reuses the first context block');
  assert.strictEqual(contexts[2],contexts[0],'third draw reuses it too');
  assert.notDeepStrictEqual(pixels[1],pixels[0],'draws rendered their own colours');
  assert.deepStrictEqual(pixels[2],pixels[0],'a reused context renders the same frame');
  assert.strictEqual(d.bytes,base);cases++;
  d.destroy();
  console.log(`PASS ${cases} cases: a large draw context keeps its arena across draws`);
})().catch(error=>{console.error(error);process.exitCode=1;});
