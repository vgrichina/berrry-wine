'use strict';
// Offline sequencing regression against the actual production Device methods.
// These explicit export doubles DO NOT compile/instantiate WAT, validate real
// shaders, rasterize triangles or qualify native allocator/rendering behavior.
const assert=require('assert');
const {Device}=require('../../../lib/d3d9-software-backend');
const {CommandQueue,OPCODES}=require('../../../lib/d3d-command-stream');
function shader(stage){
  const words=new Uint32Array([0x44534952,1,stage,stage?0xffff0101:0xfffe0101,0,2,32,0]);
  return {irVersion:1,nativeBytes:new Uint8Array(words.buffer)};
}
function snapshot(){return {primitive:4,primitiveCount:800,stride:16,
  vertices:new Uint8Array(800*48),attributes:[],vertexShader:shader(0),pixelShader:shader(1),
  depthAttachment:null,state:{zenable:false,cull:1},textures:[]};}
function harness(streaming){
  const memory=new ArrayBuffer(4*1024*1024),blocks=new Map(),programs=new Set(),contexts=new Map(),events=[];
  let cursor=1024,identifier=1,creates=0,failAt=0,maxLive=0;
  const allocate=n=>{const p=cursor;cursor+=(n+7)&~7;assert(cursor<memory.byteLength);blocks.set(p,n);return p;};
  const free=p=>assert(blocks.delete(p),'allocation freed exactly once');
  const e={guest_alloc:allocate,guest_map_alloc:allocate,guest_free:free,
    guest_map_free(p){free(p);return 1;},guest_to_wasm:p=>p,
    d3d_shader_ir_compile(){throw Error('unexpected guest token compiler');},d3d_shader_ir_free(){throw Error('unexpected IR free');},
    d3d_shader_vm_compile(){const p=identifier++;programs.add(p);return p;},
    d3d_shader_vm_free(p){assert(programs.delete(p));},
    d3d_render_coalesce_heap(){},
    // Deliberately synthetic bounds. They exercise Device admission without
    // claiming that a JS copy measures the WAT VM/context allocation bound.
    d3d_software_allocation_bound:(n,count)=>4096+count*1200+n*200,
    d3d_software_deferred_allocation_bound:(n,count)=>4096+count*1200+n*376,
    d3d_software_retained_bound:p=>1024+contexts.get(p).count*400,
    d3d_software_create(){throw Error('unexpected immediate constructor');},
    d3d_software_create_deferred(desc){
      const w=new Uint32Array(memory,desc,32),sequence=++creates;
      events.push(['create',sequence]);if(sequence===failAt)return 0;
      const p=identifier++;contexts.set(p,{sequence,count:w[12],target:w[4],samples:0n});
      maxLive=Math.max(maxLive,contexts.size);return p;
    },
    d3d_software_prepare_step(p){assert(contexts.has(p));events.push(['prepare',contexts.get(p).sequence]);return 0;},
    d3d_software_step(p){const c=contexts.get(p);assert(c);events.push(['raster',c.sequence]);
      // One visible marker per batch; only the export double writes pixels.
      new Uint32Array(memory,c.target,64)[c.sequence-1]=0xff000000|c.sequence;
      c.samples=BigInt(c.count/3);return 0;
    },
    d3d_software_samples:p=>contexts.get(p).samples,
    d3d_software_free(p){assert(contexts.delete(p),'context freed exactly once');},
    d3d_software_cancel(p){assert(contexts.has(p));events.push(['cancel']);},
    d3d_software_clear(p,w,h,pitch,color){if(p)new Uint32Array(memory,p,w*h).fill(color);return 0;},
    d3d_software_quantize_depth:(format,z)=>z,
  };
  for(const name of ['d3d_fixed_compile','d3d_fixed_compile_vertex','d3d_fixed_compile_pixel','d3d_fixed_free',
    'd3d_fixed_cache_create','d3d_fixed_cache_free','d3d_fixed_compile_cached','d3d_fixed_light_cached'])
    e[name]=()=>{throw Error('unexpected fixed-function export '+name);};
  for(const name of ['scissor','texture_mips','depth_format','stencil','fill','points','texture','projection','bump','blend','alpha'])
    e['d3d_software_bind_'+name]=p=>{assert(contexts.has(p));return 1;};
  e.d3d_software_clear_stencil=()=>{throw Error('unexpected stencil clear');};
  const scheduled=[],d=new Device({width:8,height:8,fixedCacheBytes:0,maxBytes:streaming?850000:16*1024*1024,
    getMemory:()=>memory,getExports:()=>e,schedule:cb=>scheduled.push(cb)});
  const base=d.bytes,baseBlocks=blocks.size;
  const probe=d.prepare(snapshot(),true);assert.strictEqual(probe.streaming,streaming);d.release(probe);
  function clean(){assert.strictEqual(d.bytes,base);assert.strictEqual(d.active,null);
    assert.strictEqual(contexts.size,0);assert.strictEqual(programs.size,0);assert.strictEqual(blocks.size,baseBlocks);}
  function finish(){clean();d.destroy();assert.strictEqual(d.bytes,0);assert.strictEqual(blocks.size,0);}
  function drain(){let steps=0;while(scheduled.length){assert(++steps<200);scheduled.shift()();}}
  return {d,events,scheduled,drain,clean,finish,contexts,fail:()=>{failAt=creates+3;},maxLive:()=>maxLive};
}
function markers(d){return [...new Uint32Array(d.readPixels().buffer)].map((v,i)=>v!==0xff000000?i:-1).filter(i=>i>=0);}
(async()=>{
  const results=[];
  for(const streaming of [false,true]){
    for(const async of [false,true]){
      const h=harness(streaming),{d}=h;h.fail();
      const before=d.readPixels(),samples=d.sampleCount(),last=d.lastDrawSamples;
      if(async){const task=d.drawAsync(snapshot());h.drain();await assert.rejects(task,/native raster validation rejected/);}
      else assert.throws(()=>d.draw(snapshot()),/native raster validation rejected/);
      if(streaming)assert.deepStrictEqual(markers(d),[0,1]);else assert.deepStrictEqual(d.readPixels(),before);
      assert.strictEqual(d.sampleCount(),samples);assert.strictEqual(d.lastDrawSamples,last);h.clean();
      assert.deepStrictEqual(h.events.filter(e=>e[0]==='raster').map(e=>e[1]),streaming?[1,2]:[]);
      assert.strictEqual(h.maxLive(),streaming?1:2);results.push({streaming,async,events:h.events});h.finish();
    }
    const h=harness(streaming),{d}=h,task=d.drawAsync(snapshot());
    // Cancel after the first raster in either mode, with work still pending.
    let steps=0;while(!h.events.some(e=>e[0]==='raster')){assert(++steps<100);h.scheduled.shift()();}
    assert(d.active);d.cancel();await assert.rejects(task,/cancelled/);h.drain();
    assert.deepStrictEqual(markers(d),[0]);assert.strictEqual(d.sampleCount(),0n);h.finish();
  }
  const success=[];
  for(const streaming of [false,true]){
    const h=harness(streaming);const task=h.d.drawAsync(snapshot());h.drain();assert.strictEqual(await task,1);
    h.clean();assert.strictEqual(h.d.lastDrawSamples,800n);assert.strictEqual(h.d.sampleCount(),800n);
    success.push(h.d.readPixels());if(streaming)assert.strictEqual(h.maxLive(),1);h.finish();
  }
  assert.deepStrictEqual(success[0],success[1]);
  // The production command consumer faults the ordered queue on async failure.
  const h=harness(true),queue=new CommandQueue({deviceId:1,consumer:h.d});h.fail();
  queue.submit(OPCODES.DRAW,snapshot());const fence=queue.fence();h.drain();
  await assert.rejects(fence,/native raster validation rejected/);assert(queue.error);
  assert.strictEqual(queue.bytes,0);assert.strictEqual(queue.inflight,0);h.finish();
  console.log(JSON.stringify({scope:'production JS with explicit export doubles; NOT native qualification',
    cases:9,results,successSamples:'800',streamingMaxLiveContexts:1}));
})().catch(error=>{console.error(error);process.exitCode=1;});
