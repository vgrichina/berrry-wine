#!/usr/bin/env node
'use strict';
// Full COM/native lifetime qualification. Never compiles, including on failure.
const assert=require('assert');
const ModuleInput=require('./support/positiont-com-module');
const CONTROLS=['disable-shared-route','alias-queued-bytes','corrupt-queued-ir'];
function options(argv) {
  const result={};
  for(const arg of argv) {
    if(arg==='--qualify'||arg==='--allow-512m') {result[arg.slice(2)]=true;continue;}
    const m=/^--(module|provenance|negative-control)=(.+)$/.exec(arg);
    assert(m,`unknown argument ${arg}`);assert(!result[m[1]],`duplicate ${m[1]}`);result[m[1]]=m[2];
  }
  assert(result.qualify&&result.module&&result.provenance&&result['allow-512m'],
    'NO COMPILE: require --qualify --module=FILE --provenance=FILE --allow-512m; full execution needs separate resource admission');
  assert(!result['negative-control']||CONTROLS.includes(result['negative-control']),'unknown negative control');
  return result;
}
function expectedFrame(red=true) {
  const bytes=new Uint8Array(8*8*4);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
    const p=(y*8+x)*4;bytes[p+3]=255;
    if(red&&x+y<4)bytes[p+2]=255;
  }
  return bytes;
}
function frameOracle(bytes,red,label) {
  assert.deepStrictEqual(bytes,expectedFrame(red),`${label}: complete BGRA/depth oracle`);
}
function routeOracle(packet,admitted,label) {
  assert.strictEqual(!!packet.nativeFixed,admitted,`${label}: actual shared native IR selection`);
  if(admitted) {
    assert.strictEqual(packet.nativeFixed.profile,'positiont-modulate');
    for(const stage of ['vertex','pixel']) {
      const bytes=packet.nativeFixed[stage].nativeBytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      assert.strictEqual(view.getUint32(28,true),4,`${label}: fixed native origin`);
    }
  }
}
async function qualify(input,control) {
  // Both require() calls are below the mandatory provenance/export/source gate.
  const {bootRenderHarness}=require('./render-helper');
  const {Bridge}=require('../lib/d3d9-host');
  const {CommandQueue,OPCODES,copyPayload}=require('../lib/d3d-command-stream');
  let bridge;
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',width:8,height:8,
    prebuiltModule:input.module,
    extraHostOverrides:{gpu_gl_call:(op,p,a)=>bridge.call(op,p,a)}});
  assert.strictEqual(memory.buffer.byteLength,512*1024*1024,'canonical arena size');
  const view=new DataView(memory.buffer), wa=p=>e.guest_to_wasm(p)>>>0;
  const owned=[],resources=[],traces=[],packets=[];
  let requestFailure=false,compiles=0,fallbacks=0;
  // Wrappers observe and delegate actual production calls. The failure control
  // routes ONE descriptor request to the real allocator's oversized-request
  // rejection; it is not heap exhaustion and never fakes allocator success.
  const exportsForBridge={...e,
    guest_alloc(n) {
      const p=e.guest_alloc(requestFailure&&n===288?0xfffffff1:n)>>>0;
      if(n===288)traces.push({kind:'descriptor',guest:p,requested:n,failure:requestFailure});
      return p;
    },
    d3d_fixed_compile_positiont(p) {compiles++;return e.d3d_fixed_compile_positiont(p);},
    d3d_fixed_free(p) {
      const rows=[p,...[4,8,12,16].map(offset=>view.getUint32(p+offset,true))].filter(Boolean);
      for(const at of rows) {
        const guest=e.q_w2g(at)>>>0,size=e.q_heap_payload(guest)>>>0;
        assert(size>0&&size<=128*1024,'native allocation extent bound');
        traces.push({kind:'bundle-storage',guest,size});
      }
      e.d3d_fixed_free(p);
    },
  };
  if(control==='disable-shared-route')exportsForBridge.d3d_fixed_compile_positiont=undefined;
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>exportsForBridge,
    getMemory:()=>memory.buffer,guestToWasm:wa,commandCapacityBytes:1024*1024,
    maxTextureSnapshotBytes:1024*1024,maxResidentTextureBytes:1024*1024});
  const issue=bridge._issue.bind(bridge);
  bridge._issue=(entry,opcode,payload)=>{
    if(opcode===OPCODES.DRAW)packets.push(copyPayload(payload,1024*1024).value);
    return issue(entry,opcode,payload);
  };
  e.heap_init(0x01000000); // Deliberate guest heap base in this image-free fixture.
  e.init_dx_com_thunks();
  const alloc=n=>{const p=e.guest_alloc(n)>>>0;assert(p,`real allocation ${n}`);owned.push(p);return p;};
  const put=(p,bytes)=>new Uint8Array(memory.buffer,wa(p),bytes.length).set(bytes);
  const read=p=>e.guest_read32(p)>>>0;
  const call=(name,...args)=>e[`q_${name}`](...Array.from({length:9},(_,i)=>args[i]||0))>>>0;
  const ok=(name,...args)=>assert.strictEqual(call(name,...args),0,`${name}: ${bridge.lastError||''}`);
  const out=alloc(16),pp=alloc(64);
  new Uint8Array(memory.buffer,wa(pp),64).fill(0);
  [8,8,21,1,0,0,1,1,1,1,77,0,0,0x80000000].forEach((v,i)=>e.guest_write32(pp+i*4,v));
  ok('CreateDevice',0,0,1,1,0,pp,out);const device=read(out);assert(device);
  for(const [state,value] of [[22,1],[8,3],[7,1],[14,1],[23,2],[137,0],[28,0],[29,0],[15,0],[27,0],[168,15]])
    ok('SetRenderState',device,state,value);
  ok('CreateTexture',device,1,1,1,0,21,1,out,0);const texture=read(out);
  resources.push(['Texture_Release',texture]);
  ok('Texture_LockRect',texture,0,out,0,0);e.guest_write32(read(out+4),0xffffffff);
  ok('Texture_UnlockRect',texture,0);ok('SetTexture',device,0,texture);
  for(const [state,value] of [[1,4],[2,2],[3,0],[4,4],[5,2],[6,0],[11,0],[24,0],[28,1]])
    ok('SetTextureStageState',device,0,state,value);
  ok('SetTextureStageState',device,1,1,1);
  for(const state of [1,2])ok('SetSamplerState',device,0,state,3);
  for(const state of [5,6])ok('SetSamplerState',device,0,state,1);
  const declare=split=>{
    const bytes=new Uint8Array(32),v=new DataView(bytes.buffer);
    [[split?2:0,4,3,9],[split?5:0,split?4:20,3,10],[split?5:0,split?20:36,1,5],[255,0,17,0]]
      .forEach(([s,o,t,u],i)=>{v.setUint16(i*8,s,true);v.setUint16(i*8+2,o,true);bytes.set([t,0,u,0],i*8+4);});
    const p=alloc(bytes.length);put(p,bytes);ok('CreateVertexDeclaration',device,p,out);
    const d=read(out);assert(d);resources.push(['Declaration_Release',d]);return d;
  };
  const single=declare(false),split=declare(true);
  const buffer=(bytes,indexFormat)=>{
    ok(indexFormat?'CreateIndexBuffer':'CreateVertexBuffer',device,bytes.length,0,indexFormat||0,1,out,0);
    const b=read(out);assert(b);resources.push(['Buffer_Release',b]);
    ok('Buffer_Lock',b,0,0,out,0);put(read(out),bytes);ok('Buffer_Unlock',b);return b;
  };
  // Poisoned prefix/suffix records expose offset/range mistakes. Valid vertices
  // always describe the same red 4x4 right triangle inside an 8x8 target.
  const vertexData=(stride,offset,first,count=3,z=.5,rhw=1,color=[1,0,0,1])=>{
    const bytes=new Uint8Array(16+(first+count+2)*stride),v=new DataView(bytes.buffer);
    for(let i=0;i<first+count+2;i++)for(let j=0;j<stride;j+=4)v.setFloat32(16+i*stride+j,9999,true);
    [[0,0],[4,0],[0,4]].forEach(([x,y],i)=>{
      const at=16+(first+i)*stride+offset;
      [x,y,z,rhw].forEach((n,j)=>v.setFloat32(at+j*4,n,true));
      if(stride===48){color.forEach((n,j)=>v.setFloat32(at+16+j*4,n,true));v.setFloat32(at+32,.25,true);v.setFloat32(at+36,.25,true);}
    });return bytes;
  };
  let entry,backend,originalFallback;
  const attach=()=>{
    entry=[...bridge.devices.values()][0];assert(entry&&entry.device,'real Bridge software device');backend=entry.device;
    if(!originalFallback){originalFallback=backend.fixedPrograms;backend.fixedPrograms=function(...args){fallbacks++;return originalFallback.apply(this,args);};}
  };
  const clear=(depth=1)=>{ok('Clear',device,0,0,3,0xff000000,new Uint32Array(new Float32Array([depth]).buffer)[0],0);attach();};
  const frame=p=>backend.readColor(p.colorAttachment).pixels;
  const check=(label,admitted=true,red=true)=>{
    const p=packets.at(-1);assert(p,`${label}: draw packet`);routeOracle(p,admitted,label);
    frameOracle(frame(p),red,label);assert(!bridge.lastError,`${label}: ${bridge.lastError}`);
    console.log(JSON.stringify({input:label,shared:admitted,frameSha256:ModuleInput.sha256(frame(p)),compiles,fallbacks}));return p;
  };
  clear();
  // Each API's byte range is checked via its packed bytes and analytic pixels.
  const first=2,vb=buffer(vertexData(48,4,first));
  ok('SetVertexDeclaration',device,single);ok('SetStreamSource',device,0,vb,16,48);
  let before=compiles,oldFallbacks=fallbacks;
  if(control==='disable-shared-route')console.log('ARMED negative control disable-shared-route: first COM draw must fail native descriptor oracle');
  ok('DrawPrimitive',device,4,first,1);const copied=check('DP-start2-offset16-stride48');
  assert.strictEqual(compiles,before+1);assert.strictEqual(fallbacks,oldFallbacks,'admitted draw must bypass fallback');
  assert.strictEqual(copied.vertices.length,3*48,'declared DP vertex count');
  assert.deepStrictEqual(Array.from(new Float32Array(copied.vertices.buffer,4,4)),[0,0,.5,1]);
  for(const [format,base,min,start] of [[101,1,2,2],[102,1,2,2],[101,-1,3,1]]) {
    const vertices=buffer(vertexData(48,4,base+min));
    const indexBytes=new Uint8Array((start+3+1)*(format===101?2:4)),v=new DataView(indexBytes.buffer);
    indexBytes.fill(0xff);
    [min,min+1,min+2].forEach((n,i)=>format===101?v.setUint16((start+i)*2,n,true):v.setUint32((start+i)*4,n,true));
    const ib=buffer(indexBytes,format);ok('SetIndices',device,ib);ok('SetStreamSource',device,0,vertices,16,48);
    clear();ok('DrawIndexedPrimitive',device,4,base,min,3,start,1);
    const p=check(`DIP-${format}-base${base}-min${min}-start${start}`);
    assert.deepStrictEqual(p.vertices,copied.vertices,'declared base+min selects exact same vertex bytes');
    if(format===101)assert.deepStrictEqual(Array.from(p.indices),[0,1,2],'INDEX16 normalized min');
    else assert.strictEqual(p.indices,undefined,'INDEX32 gathered into copied vertices');
  }
  const pos=buffer(vertexData(24,4,2)),colors=new Uint8Array(16+7*32),cv=new DataView(colors.buffer);
  for(let i=2;i<5;i++)[1,0,0,1,.25,.25].forEach((n,j)=>cv.setFloat32(16+i*32+4+j*4,n,true));
  const col=buffer(colors);ok('SetVertexDeclaration',device,split);ok('SetStreamSource',device,0,0,0,0);
  ok('SetStreamSource',device,2,pos,16,24);ok('SetStreamSource',device,5,col,16,32);
  clear();ok('DrawPrimitive',device,4,2,1);const multi=check('DP-multistream2and5-start2-distinct-strides');
  assert.strictEqual(multi.stride,56);assert.deepStrictEqual(multi.attributes.map(a=>a.offset),[4,28,44]);
  // User-pointer copy path has no buffer binding table.
  ok('SetVertexDeclaration',device,single);
  const upData=vertexData(48,4,0).slice(16,16+144),up=alloc(upData.length);put(up,upData);
  clear();ok('DrawPrimitiveUP',device,4,1,up,48);check('DPUP-copied-POSITIONT');
  // Depth rejection is a black negative oracle, coupled to an admitted draw.
  clear(.4);ok('DrawPrimitiveUP',device,4,1,up,48);check('depth-z.5-clear.4-reject',true,false);
  clear();ok('DrawPrimitiveUP',device,4,1,up,48);check('depth-z.5-clear1-pass');
  const far=vertexData(48,4,0,3,.75,1,[0,1,0,1]).slice(16,160);put(up,far);
  ok('DrawPrimitiveUP',device,4,1,up,48);check('depth-far-green-preserves-red');
  // Finite unsafe reciprocal must render via the preserved fallback, without
  // descriptor allocation or shared compilation.
  put(up,vertexData(48,4,0,3,.5,1e-39).slice(16,160));clear();before=compiles;oldFallbacks=fallbacks;
  ok('DrawPrimitiveUP',device,4,1,up,48);check('finite-RHW1e-39-honest-fallback',false);
  assert.strictEqual(compiles,before);assert.strictEqual(fallbacks,oldFallbacks+1);
  // Actual production allocator rejection, cleanup and subsequent recovery.
  put(up,upData);clear();before=compiles;const packetCount=packets.length;
  requestFailure=true;assert.notStrictEqual(call('DrawPrimitiveUP',device,4,1,up,48),0,'real descriptor allocator failure rejects draw');requestFailure=false;
  assert.strictEqual(compiles,before);assert.strictEqual(packets.length,packetCount,'no failed-allocation packet published');
  assert.match(String(bridge.lastError),/descriptor allocation failed/);bridge.lastError=null;
  frameOracle(frame(packets.at(-1)),false,'allocation failure preserves cleared framebuffer');
  ok('DrawPrimitiveUP',device,4,1,up,48);const recovered=check('real-allocator-failure-recovery');
  // Reuse freed production IR/descriptor storage while its JS packet is alive.
  // Require the same addresses to be handed out again; a no-op free cannot pass.
  const live=[],latest=traces.filter(t=>t.kind==='bundle-storage').slice(-5);
  const descriptor=traces.filter(t=>t.kind==='descriptor'&&t.guest).at(-1);
  const targets=[...latest,{guest:descriptor.guest,size:288}];
  const reused=new Set(),maxReuseBytes=1024*1024;let reuseBytes=0;
  const saved=ModuleInput.sha256(recovered.nativeFixed.vertex.nativeBytes)+ModuleInput.sha256(recovered.nativeFixed.pixel.nativeBytes);
  for(const target of targets) {
    for(let i=0;i<64&&!reused.has(target.guest);i++) {
      assert(reuseBytes+target.size<=maxReuseBytes,'real reuse search exceeded 1 MiB; stop for diagnosis');
      const p=e.guest_alloc(target.size)>>>0;assert(p,'real reuse allocation');live.push(p);reuseBytes+=target.size;
      new Uint8Array(memory.buffer,wa(p),target.size).fill(0xa5);
      if(targets.some(t=>t.guest===p))reused.add(p);
    }
    assert(reused.has(target.guest),`production allocator must actually reuse freed address ${target.guest.toString(16)}`);
  }
  assert.strictEqual(ModuleInput.sha256(recovered.nativeFixed.vertex.nativeBytes)+ModuleInput.sha256(recovered.nativeFixed.pixel.nativeBytes),saved,'copied native IR survives actual heap reuse/poison');
  // Queue an authentic COM-produced snapshot behind a completion gate. The
  // real queue copies vertices, indices and IR; the real native backend draws.
  let release;const gate=new Promise(resolve=>release=resolve);
  const q=new CommandQueue({deviceId:99,capacityBytes:1024*1024,consumer:{execute(c){
    if(c.payload.gate)return {value:1,completion:gate};
    return backend.execute(c);
  }}});
  q.submit(OPCODES.FENCE,{gate:true});
  clear();const queued=copyPayload(recovered,1024*1024).value;
  if(control==='corrupt-queued-ir')queued.nativeFixed.pixel.nativeBytes.fill(0);
  const ticket=q.submit(OPCODES.DRAW,queued,control==='alias-queued-bytes'?{owned:true}:undefined);
  queued.vertices.fill(0);queued.nativeFixed.vertex.nativeBytes.fill(0);
  if(control==='alias-queued-bytes'||control==='corrupt-queued-ir')console.log(`ARMED negative control ${control}: queued native draw must fail byte/pixel execution`);
  release();await q.fence(ticket.sequence);
  frameOracle(frame(recovered),true,'queue bytes survive caller mutation and real heap reuse');
  assert.strictEqual(ticket.status,'completed');
  for(const p of live)e.guest_free(p);
  // A declared draw outside its actual buffer extent must never paint/copy.
  ok('SetStreamSource',device,0,vb,16,48);clear();
  const count=packets.length;assert.notStrictEqual(call('DrawPrimitive',device,4,100,1),0,'out-of-range StartVertex rejects');
  assert.strictEqual(packets.length,count);frameOracle(frame(recovered),false,'invalid stream range preserves frame');
  assert.notStrictEqual(call('DrawIndexedPrimitive',device,4,0,0,3,1,1),0,'index outside declared min/num rejects');
  assert.strictEqual(packets.length,count);frameOracle(frame(recovered),false,'invalid declared index range preserves frame');
  assert.match(String(bridge.lastError),/index outside declared vertex range/);bridge.lastError=null;
  // Unbind then use authentic resource/device Release handlers. The backend
  // owns real mapped allocations and must report them retired, not merely close.
  for(const stream of [0,2,5])ok('SetStreamSource',device,stream,0,0,0);
  ok('SetIndices',device,0);ok('SetTexture',device,0,0);ok('SetVertexDeclaration',device,0);
  for(const [name,p] of resources.reverse())assert.strictEqual(call(name,p),0,`${name} final reference`);
  const frees=e.q_heap_frees()>>>0;
  assert.strictEqual(call('Release',device),0,'final device Release');
  assert(backend.destroyed);assert.strictEqual(backend.bytes,0,'all real backend allocations retired');
  assert(e.q_heap_frees()>>>0>frees,'production frees advance on disposal');
  assert.strictEqual(bridge.devices.size,0);await bridge.close();
  for(const p of owned)e.guest_free(p);
  console.log(JSON.stringify({result:'PASS full COM/native allocator fixture',candidate:ModuleInput.CANDIDATE,
    acceptance:ModuleInput.ACCEPTANCE,module:input.provenance.moduleSha256,reused:[...reused],reuseBytes,
    heapAllocs:e.q_heap_allocs()>>>0,heapFrees:e.q_heap_frees()>>>0,control:control||null}));
}
async function main(argv=process.argv.slice(2)) {
  const o=options(argv);const input=ModuleInput.loadPrebuilt(o.module,o.provenance);
  await qualify(input,o['negative-control']);
}
module.exports={options,expectedFrame,frameOracle,routeOracle,CONTROLS,main};
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
