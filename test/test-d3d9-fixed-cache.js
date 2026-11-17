'use strict';
const assert=require('assert'),{compileSrcWasm}=require('./compile-src'),{createHostImports}=require('../lib/host-imports'),{Device}=require('../lib/d3d9-software-backend');
const fixtures=require('./fixtures/d3d9-lighting-cases');
(async()=>{
 // Target only cache hit-clone and cache-admission allocations. No runtime
 // fault hook is shipped, and all normal paths run the production allocator.
 const wasm=compileSrcWasm((file,source)=>{
  if(file==='09aj-d3d-fixed.wat'){
   for(const [kind,site]of[[1,'(local.set $out (call $heap_alloc (local.get $packetbytes)))'],[2,'(local.set $p (call $heap_alloc (local.get $nodebytes)))']]){
    assert.strictEqual(source.split(site).length,2,'one precise cache allocation site');
    source=source.replace(site,site.replace('$heap_alloc','$cache_test_alloc').replace(')))',`) (i32.const ${kind})))`));
   }return source;
  }
  if(file==='13-exports.wat')return source+`
   (global $cache_test_failure (mut i32) (i32.const 0))
   (func (export "cache_failure") (param i32) (global.set $cache_test_failure (local.get 0)))
   (func $cache_test_alloc (param $bytes i32) (param $kind i32) (result i32)
     (if (i32.eq (global.get $cache_test_failure) (local.get $kind)) (then (return (i32.const 0))))
     (call $heap_alloc (local.get $bytes)))`;
  return source;
 });
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={getMemory:()=>memory.buffer};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 const {instance}=await WebAssembly.instantiate(wasm,imports),e=instance.exports;ctx.exports=e;
 const create=bytes=>new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:bytes});
 const d=create(65536),stats=d=>Array.from(new Uint32Array(memory.buffer,d.fixedCache,8));
 function pixel(d,draw){d.clear([0,0,0,1],1);assert.strictEqual(d.draw(draw),1);const b=d.present().pixels;return[b[2],b[1],b[0],b[3]];}
 const close=(a,b)=>a.forEach((v,i)=>assert(Math.abs(v-b[i])<=1,`${a} != ${b}`));
 try{
  const draw=fixtures.draw(),base=d.bytes;
  close(pixel(d,draw),[128,64,32,191]);const first=stats(d);assert(first[5]>0,'initial native compilation');
  for(let i=1;i<=8;i++){
   draw.fixedFunction.material.diffuse.set([i/16,.25,.125,.5]);
   draw.fixedFunction.world[10]=i/8;draw.fixedFunction.projection[10]=8/i;
   draw.fixedFunction.lights[0].direction[2]=-i;
   close(pixel(d,draw),[128,Math.min(255,Math.round(510/i)),Math.round(255/i),128]);
   assert.strictEqual(stats(d)[5],first[5],'changed matrix/material/direction constants do not compile');
   assert.strictEqual(d.bytes,base,'draw clones retire within reserved budget');
  }
  assert(stats(d)[4]>first[4],'native hit counter advances');
  draw.fixedFunction.normalizeNormals=true;pixel(d,draw);assert(stats(d)[5]>first[5],'semantic normalization change compiles a distinct variant');
  const warm=stats(d);draw.fixedFunction.normalizeNormals=false;pixel(d,draw);assert.strictEqual(stats(d)[5],warm[5],'prior semantic variant reused');
  const before=pixel(d,draw);draw.fixedFunction.material.diffuse[0]=NaN;assert.throws(()=>d.draw(draw));
  close([d.present().pixels[2],d.present().pixels[1],d.present().pixels[0],d.present().pixels[3]],before);
  draw.fixedFunction.material.diffuse[0]=.5;close(pixel(d,draw),[128,64,32,128]);
  const beforeOOM=stats(d);e.cache_failure(1);assert.throws(()=>d.draw(draw));e.cache_failure(0);
  assert.deepStrictEqual(stats(d),beforeOOM,'failed clone leaves template/LRU/counters unchanged');
  assert.strictEqual(d.bytes,base);close(pixel(d,draw),[128,64,32,128]);
  draw.fixedFunction.diffuseMaterialSource=2;e.cache_failure(2);
  close(pixel(d,draw),[64,128,191,64]);e.cache_failure(0);
  close(pixel(d,draw),[64,128,191,64]);
  for(const argument of[3,6]){
   const unlit=fixtures.draw(),f=unlit.fixedFunction;f.lighting=false;
   f.stages[0].colorArg1=f.stages[0].alphaArg1=argument;
   pixel(d,unlit);const compiled=stats(d)[5];
   for(const color of[0x80402010,0xff123456,0x4080a0c0]){
    if(argument===3)f.textureFactor=color;else f.stages[0].constant=color;
    close(pixel(d,unlit),[color>>>16&255,color>>>8&255,color&255,color>>>24]);
    assert.strictEqual(stats(d)[5],compiled,'pixel DEF values rebind without compilation');
   }
  }
  const small=create(4000);
  try{for(const c of fixtures.cases().slice(0,8))pixel(small,c.draw);
   const s=stats(small);assert(s[2]<=4000&&s[7]<=64,'byte/count bounds');assert(s[6]>0,'small cache evicts');
  }finally{small.destroy();assert.strictEqual(small.bytes,0);}
  const second=create(65536);try{pixel(second,fixtures.draw());assert(stats(second)[5]>0,'separate device owns its cache');assert.notStrictEqual(second.fixedCache,d.fixedCache);}finally{second.destroy();}
  close(pixel(d,fixtures.draw()),[128,64,32,191]);
 }finally{d.destroy();assert.strictEqual(d.bytes,0);}
 console.log('PASS native semantic fixed packet cache: constant rebind pixels, compile counts, variants, eviction, OOM, invalid-state safety and device lifetime (async leases and Reset went with the old JS D3D9 host, d3d9-retire S4)');
})().catch(e=>{console.error(e);process.exitCode=1;});
