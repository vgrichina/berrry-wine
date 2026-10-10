'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Bridge}=require('../lib/d3d9-host');
const {createHostImports}=require('../lib/host-imports');
const {Worker}=require('worker_threads');
const path=require('path');
const {WorkerConsumer}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
(async()=>{
  let bridge,productionImport,failRetire=false,delayedRetire=null,failTransfer=0;
  const api={Device9:['SetRenderTarget','GetRenderTarget','GetBackBuffer','GetSwapChain','SetViewport','GetViewport',
    'SetScissorRect','GetScissorRect','GetRenderTargetData','ColorFill','UpdateSurface','UpdateTexture','SetFVF','SetRenderState','SetTexture','DrawPrimitiveUP','Present','Reset','Release'],
    Texture9:['GetSurfaceLevel','LockRect','UnlockRect','Release'],
    CubeTexture9:['GetCubeMapSurface','Release'],
    SwapChain9:['GetBackBuffer','Present','Release'],
    Surface9:['QueryInterface','GetDesc','AddRef','Release','GetDevice','LockRect','UnlockRect','GetDC','ReleaseDC']};
  const {exports:e,memory,module}=await bootRenderHarness({fonts:'none',
    extraHostOverrides:{gpu_gl_call:(op,p,a)=>{
      if(op===failTransfer)return 0;
      if(op===0x30004&&delayedRetire)return bridge._result(bridge.devices.get(a>>>0),delayedRetire.promise,()=>1,true);
      return failRetire&&op===0x30004?0:productionImport(op,p,a);
    }},extraWat:`
    (func (export "dx_refs") (param $object i32) (result i32)
      (load.field DxObject refcount (call $dx_from_this (local.get $object))))
    (func (export "device8_identity") (param $device i32) (param $enabled i32)
      (call $gs32 (local.get $device)
        (select (global.get $DX_VTBL_D3DDEV8) (global.get $DX_VTBL_D3DDEV9) (local.get $enabled))))
    ${Object.entries(api).flatMap(([type,names])=>names.map(name=>`
      (func (export "${type}_${name}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
        (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
        (call $handle_IDirect3D${type==='SwapChain9'&&name==='Release'?'Device9':type}_${name} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
        (i32.load offset=0 (global.get $reg_base)))`)).join('\n')}
    (func (export "create_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "raw_texture") (param $d i32) (param $pool i32) (param $fmt i32) (param $out i32) (result i32)
      (call $d3d9_texture_create (local.get $d) (i32.const 8) (i32.const 8) (i32.const 4)
        (i32.const 0) (local.get $fmt) (local.get $pool) (local.get $out))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "cpu_texture") (param $d i32) (param $pool i32) (param $out i32) (result i32)
      (call $d3d9_texture_create (local.get $d) (i32.const 4) (i32.const 4) (i32.const 3)
        (i32.const 0) (i32.const 21) (local.get $pool) (local.get $out))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "update_texture_create") (param $d i32) (param $w i32) (param $h i32)
      (param $levels i32) (param $fmt i32) (param $pool i32) (param $kind i32) (param $out i32) (result i32)
      (call $d3d9_texture_create_kind (local.get $d) (local.get $w) (local.get $h) (local.get $levels)
        (i32.const 0) (local.get $fmt) (local.get $pool) (local.get $out) (local.get $kind))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "rt_texture") (param $d i32) (param $cube i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (if (local.get $cube) (then
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (i32.const 0))
        (call $handle_IDirect3DDevice9_CreateCubeTexture (local.get $d) (i32.const 4) (i32.const 3)
          (i32.const 1) (i32.const 21) (i32.const 0)))
      (else
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 21))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
        (call $handle_IDirect3DDevice9_CreateTexture (local.get $d) (i32.const 4) (i32.const 4)
          (i32.const 3) (i32.const 1) (i32.const 0))))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "color") (param $d i32) (param $w i32) (param $h i32) (param $fmt i32) (param $lock i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $lock))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateRenderTarget (local.get $d) (local.get $w) (local.get $h) (local.get $fmt) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "offscreen") (param $d i32) (param $w i32) (param $h i32) (param $pool i32) (param $out i32) (param $fmt i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateOffscreenPlainSurface (local.get $d) (local.get $w) (local.get $h) (local.get $fmt) (local.get $pool) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "clear") (param $d i32) (param $color i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0x3f800000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0) (i32.const 1) (local.get $color) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "update_view") (param $s i32) (param $d i32) (param $pool i32) (param $out i32) (result i32)
      (call $d3d9_update_view (local.get $s) (local.get $d) (local.get $pool) (call $g2w (local.get $out))))
    ${['GetPixel','SetPixel'].map(name=>`(func (export "${name}") (param $dc i32) (param $x i32) (param $y i32) (param $color i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_${name} (local.get $dc) (local.get $x) (local.get $y) (local.get $color) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
    (func (export "back_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (global $test_stretch_stack (mut i32) (i32.const 0x074ff000))
    (func (export "stretch_stack") (param $s i32) (global.set $test_stretch_stack (local.get $s)))
    (func (export "stretch_packet") (result i32) (global.get $d3d9_stretch_packet))
    (func (export "stretch_stage") (result i32) (global.get $d3d9_stretch_stage))
    (func (export "stretch") (param $d i32) (param $s i32) (param $sr i32) (param $t i32) (param $tr i32) (param $filter i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $test_stretch_stack))
      (call $gs32 (i32.add (global.get $test_stretch_stack) (i32.const 24)) (local.get $filter))
      (call $handle_IDirect3DDevice9_StretchRect (local.get $d) (local.get $s) (local.get $sr) (local.get $t) (local.get $tr) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "blockers") (param $d i32) (result i32)
      (call $gl32 (i32.add (call $d3d9_program_state (local.get $d)) (i32.const 21772))))
    (func (export "stretch_back") (param $d i32) (param $s i32) (param $t i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (i32.const 0))
      (call $handle_IDirect3DDevice9_StretchRect (local.get $d) (local.get $s) (i32.const 0)
        (local.get $t) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  `});
  productionImport=createHostImports({getMemory:()=>memory.buffer,exports:e,
    d3d9Bridge:{call:(...args)=>bridge.call(...args)}}).host.gpu_gl_call;
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,
    getMemory:()=>memory.buffer,guestToWasm:p=>e.guest_to_wasm(p)>>>0});
  e.d3dim_worker_init(0x400000);e.init_dx_com_thunks();
  const alloc=n=>e.guest_alloc(n)>>>0,read=p=>e.guest_read32(p)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
  const write=(p,a)=>a.forEach((v,i)=>e.guest_write32(p+i*4,v));
  const out=alloc(64),pp=alloc(64),rect=alloc(32),lock=alloc(8);
  write(pp,[8,8,21,1,0,0,1,1,1]);e.guest_write32(pp+52,0x80000000);
  const ok=(v,label)=>assert.strictEqual(v>>>0,0,`${label}: ${bridge.lastError||''}`),bad=v=>assert.strictEqual(v>>>0,0x8876086c);
  ok(e.create_device(pp,out),'create device');const d=read(out);
  ok(e.Device9_GetRenderTarget(d,0,out),'implicit target');const back=read(out);
  ok(e.clear(d,0xff112233),'back clear');
  const create=(w,h,fmt=21,lockable=1)=>{ok(e.color(d,w,h,fmt,lockable,out),'create color');return read(out);};
  const a=create(4,3),b=create(2,5,22),unlocked=create(2,2,21,0);
  assert.strictEqual(e.blockers(d),3);
  bad(e.color(d,0,3,21,0,out));bad(e.color(d,4,3,80,0,out));bad(e.color(d,4,3,21,0,0));
  ok(e.Surface9_GetDesc(a,out),'desc');assert.deepStrictEqual(Array.from({length:8},(_,i)=>read(out+i*4)),[21,1,1,0,0,0,4,3]);
  ok(e.offscreen(d,4,3,2,out,21),'system surface');const system=read(out);assert.strictEqual(e.blockers(d),3);
  bad(e.Device9_SetRenderTarget(d,0,system));bad(e.Device9_SetRenderTarget(d,1,a));bad(e.Device9_SetRenderTarget(d,0,0));
  ok(e.Device9_SetRenderTarget(d,0,a),'bind A');
  ok(e.Device9_GetViewport(d,out),'viewport');assert.deepStrictEqual(Array.from({length:6},(_,i)=>read(out+i*4)),[0,0,4,3,0,0x3f800000]);
  ok(e.Device9_GetScissorRect(d,out),'scissor');assert.deepStrictEqual(Array.from({length:4},(_,i)=>read(out+i*4)),[0,0,4,3]);
  ok(e.clear(d,0x80335577),'A clear');
  ok(e.Device9_SetRenderTarget(d,0,b),'bind B');ok(e.clear(d,0x40556677),'B clear');
  const pixels=s=>{ok(e.Surface9_LockRect(s,lock,0,16),'read lock');const p=read(lock+4),pitch=read(lock);
    const value=read(p);ok(e.Surface9_UnlockRect(s),'read unlock');return {p,pitch,value};};
  assert.strictEqual(pixels(a).value,0x80335577);assert.strictEqual(pixels(b).value,0xff556677);
  ok(e.Device9_SetRenderTarget(d,0,a),'A draw binding');
  ok(e.Device9_SetFVF(d,0x44),'POSITIONT diffuse');ok(e.Device9_SetRenderState(d,137,0),'unlit');
  ok(e.Device9_SetRenderState(d,22,1),'no culling');
  const vertices=alloc(60),vv=new DataView(memory.buffer,wa(vertices),60);
  [[0,0],[4,0],[0,3]].forEach(([x,y],i)=>{const p=i*20;vv.setFloat32(p,x,true);vv.setFloat32(p+4,y,true);
    vv.setFloat32(p+8,.5,true);vv.setFloat32(p+12,1,true);vv.setUint32(p+16,0xffff0000,true);});
  ok(e.Device9_DrawPrimitiveUP(d,4,1,vertices,20),'real Draw to independent target');
  assert.strictEqual(pixels(a).value,0xffff0000,'raster output uses bound storage');
  assert.strictEqual(pixels(b).value,0xff556677,'drawing A preserves B');
  ok(e.clear(d,0x80335577),'restore A fixture color');ok(e.Device9_SetRenderTarget(d,0,b),'B before Present');
  ok(e.Device9_Present(d),'present while B bound');
  assert.strictEqual(new Uint32Array(memory.buffer,e.back_bits(d),64)[0],0xff112233,'Present names implicit storage');
  ok(e.Device9_GetBackBuffer(d,0,0,0,out),'GetBackBuffer independent of binding');assert.strictEqual(read(out),back);e.Surface9_Release(back);
  ok(e.offscreen(d,8,8,2,out,22),'backbuffer readback destination');const backCopy=read(out);
  ok(e.Device9_GetRenderTargetData(d,back,backCopy),'backbuffer readback while B bound');
  assert.strictEqual(pixels(backCopy).value,0xff112233);assert.strictEqual(e.Surface9_Release(backCopy),0);
  ok(e.Device9_GetRenderTargetData(d,a,system),'readback to system surface');assert.strictEqual(pixels(system).value,0x80335577);
  write(rect,[1,1,3,3]);ok(e.Surface9_LockRect(a,lock,rect,0),'subrect lock');
  assert.strictEqual(read(lock),16);const p=read(lock+4);e.guest_write32(p,0xffabcdef);
  bad(e.Surface9_LockRect(a,lock,0,0));bad(e.Device9_SetRenderTarget(d,0,a));
  ok(e.Surface9_UnlockRect(a),'upload subrect');
  assert.strictEqual(pixels(a).value,0x80335577);assert.strictEqual(read(p),0xffabcdef);
  bad(e.Surface9_LockRect(unlocked,lock,0,0));bad(e.Surface9_LockRect(a,0,0,0));bad(e.Surface9_LockRect(a,lock,0,0x4000));
  ok(e.Device9_SetRenderTarget(d,0,a),'restore A');
  assert.strictEqual(e.Surface9_Release(a),0,'internal binding retains externally released surface');
  assert.strictEqual(e.blockers(d),2);
  ok(e.Device9_GetRenderTarget(d,0,out),'recover bound surface');assert.strictEqual(read(out),a);
  assert.strictEqual(e.blockers(d),3);assert.strictEqual(e.Surface9_Release(a),0);
  ok(e.Device9_SetRenderTarget(d,0,back),'restore implicit');
  for(const s of[b,unlocked,system])assert.strictEqual(e.Surface9_Release(s),0);
  assert.strictEqual(e.blockers(d),0);e.Surface9_Release(back);
  assert.strictEqual(e.Device9_Release(d),0);assert.strictEqual(bridge.devices.size,0);
  await bridge.close();
  const makeWorker=()=>new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:wa,
    createSoftwareWorker:()=>new WorkerConsumer(new Worker(path.join(__dirname,'../lib/d3d-render-worker.js')),
      {module,memory,sigs,imageBase:e.get_image_base()>>>0,reclaimHeap:h=>e.d3d_render_adopt_free_list(h)})});
  const invoke=async(fn,...args)=>{let value=fn(...args);while(e.get_d3d_render_token()){
    if(fn===e.stretch_back)assert.strictEqual(e.get_esp()>>>0,0x074ff000,'pending StretchRect preserves arguments');
    if([e.Device9_ColorFill,e.Device9_UpdateSurface,e.Surface9_GetDC,e.Surface9_ReleaseDC,e.Surface9_Release,e.Surface9_LockRect,e.Surface9_UnlockRect].includes(fn))
      assert.strictEqual(e.get_esp()>>>0,0x074ff000,'pending copy/fill/DC preserves stdcall stack');
    await bridge.wait(e.get_d3d_render_token());value=fn(...args);}
    if(fn===e.Device9_ColorFill)assert.strictEqual(e.get_esp()>>>0,0x074ff014,'completed ColorFill pops arguments once');
    if(fn===e.Surface9_GetDC||fn===e.Surface9_ReleaseDC)assert.strictEqual(e.get_esp()>>>0,0x074ff00c,'completed DC call pops once');
    if(fn===e.Surface9_LockRect)assert.strictEqual(e.get_esp()>>>0,0x074ff014,'completed LockRect pops once');
    if(fn===e.Surface9_UnlockRect)assert.strictEqual(e.get_esp()>>>0,0x074ff008,'completed UnlockRect pops once');
    if(fn===e.stretch_back)assert.strictEqual(e.get_esp()>>>0,0x074ff01c,'completed StretchRect pops once');
    return value>>>0;};
  let nestedChecks=0;
  const aliases=async()=>{
    write(pp,[8,8,21,1,0,0,1,1,1]); // Reset rewrites presentation parameters; each backend starts identically.
    e.guest_write32(pp+44,0);
    ok(e.create_device(pp,out),'alias device');const ad=read(out);
    ok(e.Device9_GetRenderTarget(ad,0,out),'alias backbuffer');let ab=read(out);
    {
    // Real executor readback -> native resampling -> executor upload, on both
    // synchronous and asynchronous backends. Four corners form a linear ramp.
    ok(e.color(ad,2,2,21,1,out));const stretchSource=read(out);
    ok(e.color(ad,6,6,21,1,out));const stretchDest=read(out);
    const sr=alloc(16),dr=alloc(16);
    ok(await invoke(e.Surface9_LockRect,stretchSource,lock,0,0));
    const sb=read(lock+4),sp=read(lock);
    for(let y=0;y<2;y++)for(let x=0;x<2;x++)e.guest_write32(sb+y*sp+x*4,(0xff000000+(y*160+x*80)*0x010101)>>>0);
    ok(await invoke(e.Surface9_UnlockRect,stretchSource));
    for(const filter of[0,1,2]){
      ok(await invoke(e.Device9_ColorFill,ad,stretchDest,0,0xff112233));
      write(sr,[0,0,2,2]);write(dr,[1,1,5,5]);
      let result=e.stretch(ad,stretchSource,sr,stretchDest,dr,filter);
      if(e.get_d3d_render_token()){
        assert.strictEqual(e.get_esp()>>>0,0x074ff000);
        // Neither rectangle nor the filter is reread after either park.
        write(sr,[-1,0,999,999]);write(dr,[0,0,1,1]);
        result=await invoke(e.stretch,ad,stretchSource,sr,stretchDest,dr,99);
      }
      ok(result,'filtered subrectangle StretchRect');
      ok(await invoke(e.Surface9_LockRect,stretchDest,lock,0,16));
      const db=read(lock+4),dp=read(lock),linear=[0,20,60,80];
      for(let y=0;y<6;y++)for(let x=0;x<6;x++){
        const inside=x>=1&&x<5&&y>=1&&y<5;
        const v=inside?(filter===2?linear[x-1]+2*linear[y-1]:((x-1)>>1)*80+((y-1)>>1)*160):0;
        assert.strictEqual(read(db+y*dp+x*4),inside?(0xff000000+v*0x010101)>>>0:0xff112233,
          'StretchRect preserves exterior and samples at pixel centers');
      }
      ok(await invoke(e.Surface9_UnlockRect,stretchDest));
    }
    // Nested guest frames use different stacks. The host snapshots the render
    // token but does not know implementation-private copy packets.
    ok(e.color(ad,2,2,21,1,out));const innerSource=read(out);
    ok(e.color(ad,2,2,21,1,out));const innerDest=read(out);
    ok(await invoke(e.Device9_ColorFill,ad,innerSource,0,0xffaabbcc));
    ok(e.color(ad,2,2,21,1,out));const outerSource=read(out);
    for(const parkedStage of [0,1]) {
      ok(await invoke(e.Device9_ColorFill,ad,outerSource,0,0xff334455));
      write(sr,[0,0,2,2]);write(dr,[0,0,2,2]);
      e.stretch_stack(0x074ff000);
      e.stretch(ad,outerSource,sr,stretchDest,dr,0);
      if(!e.get_d3d_render_token()) continue; // synchronous executor has no park
      if(parkedStage===1){await bridge.wait(e.get_d3d_render_token());e.stretch(ad,outerSource,sr,stretchDest,dr,0);}
      const outerToken=e.get_d3d_render_token(),outerPacket=e.stretch_packet();
      assert(outerToken);assert.strictEqual(e.stretch_stage(),parkedStage);
      e.set_d3d_render_token(0);e.stretch_stack(0x074fe000);
      bad(await invoke(e.stretch,ad,innerSource,0,innerDest,0,99));
      assert.strictEqual(e.stretch_packet(),outerPacket,'invalid inner call preserves outer packet');
      write(sr,[-1,0,2,2]);
      bad(await invoke(e.stretch,ad,innerSource,sr,innerDest,0,0));
      assert.strictEqual(e.stretch_packet(),outerPacket,'invalid rectangle frees child and restores parent');
      write(sr,[0,0,2,2]);
      ok(await invoke(e.stretch,ad,innerSource,0,innerDest,0,0));
      assert.strictEqual(e.stretch_packet(),outerPacket,'completed inner call restores outer packet');
      assert.strictEqual(e.stretch_stage(),parkedStage,'completed inner restores outer phase');
      e.stretch_stack(0x074ff000);e.set_d3d_render_token(outerToken);
      ok(await invoke(e.stretch,ad,outerSource,sr,stretchDest,dr,0));
      assert.strictEqual(e.stretch_packet(),0,'outer completion frees packet stack');
      assert.strictEqual(e.stretch_stage(),0);nestedChecks++;
      ok(await invoke(e.Surface9_LockRect,innerDest,lock,0,16));
      assert.strictEqual(read(read(lock+4)),0xffaabbcc,'inner copied its own source');
      ok(await invoke(e.Surface9_UnlockRect,innerDest));
      ok(await invoke(e.Surface9_LockRect,stretchDest,lock,0,16));
      assert.strictEqual(read(read(lock+4)),0xff334455,'outer copied its own source');
      ok(await invoke(e.Surface9_UnlockRect,stretchDest));
    }
    await invoke(e.Surface9_Release,innerSource);await invoke(e.Surface9_Release,innerDest);
    await invoke(e.Surface9_Release,outerSource);
    write(sr,[0,0,2,2]);write(dr,[0,0,1,1]);
    ok(await invoke(e.stretch,ad,stretchSource,sr,stretchDest,dr,2),'bilinear downsample');
    ok(await invoke(e.Surface9_LockRect,stretchDest,lock,0,16));
    assert.strictEqual(read(read(lock+4)),0xff787878,'four corners average at destination center');
    ok(await invoke(e.Surface9_UnlockRect,stretchDest));
    write(sr,[1,0,2,2]);write(dr,[0,0,6,6]);
    ok(await invoke(e.stretch,ad,stretchSource,sr,stretchDest,dr,2),'source subrectangle edge clamps');
    ok(await invoke(e.Surface9_LockRect,stretchDest,lock,0,16));
    assert.strictEqual(read(read(lock+4)),0xff505050);assert.strictEqual(read(read(lock+4)+5*read(lock)+20),0xfff0f0f0);
    ok(await invoke(e.Surface9_UnlockRect,stretchDest));
    write(sr,[-1,0,2,2]);bad(await invoke(e.stretch,ad,stretchSource,sr,stretchDest,0,2));
    bad(await invoke(e.stretch,ad,stretchSource,0,stretchSource,0,0));
    bad(await invoke(e.stretch,ad,stretchSource,0,stretchDest,0,3));
    ok(await invoke(e.Surface9_LockRect,stretchSource,lock,0,16));
    bad(await invoke(e.stretch,ad,stretchSource,0,stretchDest,0,1));
    ok(await invoke(e.Surface9_UnlockRect,stretchSource));
    ok(await invoke(e.clear,ad,0xff123456));
    ok(await invoke(e.stretch,ad,ab,0,stretchDest,0,2),'implicit backbuffer source');
    ok(await invoke(e.Surface9_LockRect,stretchDest,lock,0,16));assert.strictEqual(read(read(lock+4)),0xff123456);
    ok(await invoke(e.Surface9_UnlockRect,stretchDest));
    ok(await invoke(e.stretch,ad,stretchSource,0,ab,0,1),'implicit backbuffer destination');
    assert.strictEqual(e.update_view(ab,ad,0,out),1);
    const stretchBackWidth=read(out),stretchBackHeight=read(out+4);
    ok(e.offscreen(ad,stretchBackWidth,stretchBackHeight,2,out,22));const stretchBackCopy=read(out);
    ok(await invoke(e.Device9_GetRenderTargetData,ad,ab,stretchBackCopy));
    ok(await invoke(e.Surface9_LockRect,stretchBackCopy,lock,0,16));
    const backPixels=read(lock+4),backPitch=read(lock);
    for(let y=0;y<stretchBackHeight;y++)for(let x=0;x<stretchBackWidth;x++){
      const v=Math.floor((x+.5)*2/stretchBackWidth)*80+Math.floor((y+.5)*2/stretchBackHeight)*160;
      assert.strictEqual(read(backPixels+y*backPitch+x*4),(0xff000000+v*0x010101)>>>0);
    }
    ok(await invoke(e.Surface9_UnlockRect,stretchBackCopy));
    await invoke(e.Surface9_Release,stretchBackCopy);
    await invoke(e.Surface9_Release,stretchSource);await invoke(e.Surface9_Release,stretchDest);e.guest_free(sr);e.guest_free(dr);
    console.log('PASS StretchRect pixel centers, rectangle preservation, downsampling, backbuffers and suspend/resume');
    }
    bad(e.Surface9_GetDevice(ab,0));
    ok(e.Surface9_GetDevice(ab,out),'implicit surface GetDevice');
    assert.strictEqual(read(out),ad,'implicit surface returns canonical device');
    assert.strictEqual(e.get_esp()>>>0,0x074ff00c,'GetDevice stdcall');
    assert.strictEqual(await invoke(e.Device9_Release,read(out)),2,'device caller and external backbuffer retain owner');
    bad(await invoke(e.Surface9_GetDC,ab,out));assert.strictEqual(read(out),0,'nonlockable backbuffer exposes no DC');
    bad(await invoke(e.Surface9_LockRect,ab,lock,0,0));
    e.guest_write32(pp+44,1);
    bad(await invoke(e.Device9_Reset,ad,pp)); // external reference prevents transition
    bad(await invoke(e.Surface9_GetDC,ab,out));
    e.Surface9_Release(ab);e.guest_write32(pp+44,1);
    ok(await invoke(e.Device9_Reset,ad,pp),'Reset enables lockable backbuffer');
    ok(e.Device9_GetRenderTarget(ad,0,out));ab=read(out);
    ok(e.Surface9_GetDevice(ab,out),'replacement backbuffer GetDevice');
    assert.strictEqual(read(out),ad);assert.strictEqual(await invoke(e.Device9_Release,read(out)),2);
    const makeUpdateTexture=(w,h,levels,fmt,pool,kind=3)=>{
      ok(e.update_texture_create(ad,w,h,levels,fmt,pool,kind,out));return read(out);
    };
    for(const kind of[3,5])for(const fmt of[21,22,50,51,62,0x31545844,0x33545844,0x35545844]){
      const source=makeUpdateTexture(8,8,4,fmt,2,kind),destination=makeUpdateTexture(4,4,3,fmt,0,kind);
      const count=kind===5?6:1,record=(t,i)=>t+64+i*32;
      for(let i=0;i<count*4;i++){
        const r=record(source,i),b=new Uint8Array(memory.buffer,wa(read(r+16)),read(r+12));
        b.forEach((_,j)=>b[j]=(i*31+j*7+19)&255);
      }
      const destBytes=()=>Array.from({length:count*3},(_,i)=>{const r=record(destination,i);return new Uint8Array(memory.buffer,wa(read(r+16)),read(r+12)).slice();});
      const before=destBytes();
      ok(e.Texture9_LockRect(destination,count*3-1,lock,0,0));
      bad(e.Device9_UpdateTexture(ad,source,destination));
      assert.deepStrictEqual(destBytes(),before,'late locked mip rejects without changing earlier mips');
      ok(e.Texture9_UnlockRect(destination,count*3-1));
      ok(e.Texture9_LockRect(source,0,lock,0,16));
      bad(e.Device9_UpdateTexture(ad,source,destination));
      ok(e.Texture9_UnlockRect(source,0));
      ok(e.Device9_UpdateTexture(ad,source,destination),'UpdateTexture bottom-aligned mip chain');
      assert.strictEqual(e.get_esp()>>>0,0x074ff010,'UpdateTexture stdcall');
      for(let face=0;face<count;face++)for(let level=0;level<3;level++){
        const sr=record(source,face*4+level+1),dr=record(destination,face*3+level);
        assert.deepStrictEqual(new Uint8Array(memory.buffer,wa(read(dr+16)),read(dr+12)),
          new Uint8Array(memory.buffer,wa(read(sr+16)),read(sr+12)),'face/mip bytes including compressed padding');
        assert.strictEqual(read(dr+28),face*3+level===count*3-1?2:1,'destination sampler snapshot invalidated');
      }
      const copied=destBytes();
      bad(e.Device9_UpdateTexture(ad,destination,source));
      bad(e.Device9_UpdateTexture(ad,source,source));
      assert.deepStrictEqual(destBytes(),copied);
      e.Texture9_Release(source);e.Texture9_Release(destination);
    }
    for(const [a,b] of [
      [[8,8,3,21,2],[4,4,3,21,0]], // unmatched bottom dimensions
      [[8,8,1,21,2],[8,8,4,21,0]], // source has too few levels
      [[8,8,4,21,2],[8,8,4,22,0]], // format mismatch
      [[8,8,4,21,2,5],[8,8,4,21,0,3]], // cube vs 2D
      [[8,8,4,21,1],[8,8,4,21,0]], // source must be SYSTEMMEM
      [[8,8,4,21,2],[8,8,4,21,1]], // destination must be DEFAULT
    ]){
      const source=makeUpdateTexture(...a),destination=makeUpdateTexture(...b);
      const r=destination+64,bits=read(r+16),bytes=read(r+12);
      new Uint8Array(memory.buffer,wa(bits),bytes).fill(0xad);
      bad(e.Device9_UpdateTexture(ad,source,destination));
      assert(new Uint8Array(memory.buffer,wa(bits),bytes).every(x=>x===0xad),'invalid update preserves destination');
      assert.strictEqual(read(r+28),0,'invalid update preserves cache generation');
      e.Texture9_Release(source);e.Texture9_Release(destination);
    }
    {
      const source=makeUpdateTexture(4,4,1,21,2),destination=makeUpdateTexture(4,4,1,21,0);
      ok(e.create_device(pp,out));const other=read(out);
      bad(e.Device9_UpdateTexture(other,source,destination));
      assert.strictEqual(read(destination+64+28),0,'foreign-device update preserves destination generation');
      await invoke(e.Device9_Release,other);e.Texture9_Release(source);e.Texture9_Release(destination);
    }
    for(const format of[62,0x31545844,0x35545844]){
      ok(e.raw_texture(ad,2,format,out),'raw system texture');const st=read(out);
      ok(e.raw_texture(ad,0,format,out),'raw default texture');const dt=read(out);
      const point=alloc(8);
      for(const level of[0,2,3]){
        ok(e.Texture9_GetSurfaceLevel(st,level,out),'raw source level');const ss=read(out);
        ok(e.Texture9_GetSurfaceLevel(dt,level,out),'raw dest level');const ds=read(out);
        const sr=st+64+level*32,dr=dt+64+level*32,bytes=read(sr+12),sp=read(sr+16),dp=read(dr+16);
        ok(await invoke(e.Surface9_LockRect,ss,lock,0,0),'raw lock');
        const source=new Uint8Array(memory.buffer,wa(sp),bytes);source.forEach((_,i)=>source[i]=(i*13+7)&255);
        const want=source.slice();ok(await invoke(e.Surface9_UnlockRect,ss),'raw unlock');
        ok(await invoke(e.Device9_UpdateSurface,ad,ss,0,ds,0),'raw whole level upload');
        assert.deepStrictEqual(new Uint8Array(memory.buffer,wa(dp),bytes),want,'raw bytes and small mip padding preserved');
        if(level===0){
          // Upper-right source block/region -> lower-left destination.
          write(rect,[4,0,8,4]);write(point,[0,4]);
          ok(await invoke(e.Device9_UpdateSurface,ad,ss,rect,ds,point),'raw subrectangle');
          const expected=want.slice(),pitch=read(sr+8),unit=format===62?4:format===0x31545844?8:16;
          const rows=format===62?4:1,rowBytes=format===62?16:unit;
          for(let y=0;y<rows;y++)expected.set(want.subarray(y*pitch+(format===62?16:unit),y*pitch+(format===62?16:unit)+rowBytes),
            (y+(format===62?4:1))*pitch);
          assert.deepStrictEqual(new Uint8Array(memory.buffer,wa(dp),bytes),expected,'raw pitched subrectangle preserves other blocks');
          if(format!==62){
            for(const invalidRect of[[1,0,5,4],[0,1,4,5],[0,0,3,4],[0,0,4,3]]){
              write(rect,invalidRect);bad(await invoke(e.Device9_UpdateSurface,ad,ss,rect,ds,0));
            }
            write(rect,[0,0,4,4]);write(point,[1,0]);bad(await invoke(e.Device9_UpdateSurface,ad,ss,rect,ds,point));
            assert.deepStrictEqual(new Uint8Array(memory.buffer,wa(dp),bytes),expected,'rejected misaligned copy is atomic');
          }
        }
        e.Surface9_Release(ss);e.Surface9_Release(ds);
      }
      e.guest_free(point);e.Texture9_Release(st);e.Texture9_Release(dt);
    }
    ok(await invoke(e.Device9_ColorFill,ad,ab,0,0xff102030),'ColorFill bootstraps backend and fills implicit target');
    ok(await invoke(e.Device9_Present,ad),'filled backbuffer Present');
    assert.strictEqual(new Uint32Array(memory.buffer,e.back_bits(ad),64)[0],0xff102030);
    ok(e.offscreen(ad,8,8,0,out,22),'StretchRect DEFAULT source');const stretchSource=read(out);
    ok(await invoke(e.Device9_ColorFill,ad,stretchSource,0,0xff123456),'GPU-owned stretch source');
    for(const flags of[0x8000,0x8800,0x2000,0xa800]){
      ok(await invoke(e.Surface9_LockRect,stretchSource,lock,0,flags),'standalone surface lock flags');
      if(!(flags&0x2000))assert.strictEqual(read(read(lock+4)),0xff123456,'flag still synchronizes GPU-owned bytes');
      e.guest_write32(read(lock+4),0xff654321);
      bad(await invoke(e.Surface9_LockRect,stretchSource,lock,0,flags));
      ok(await invoke(e.Surface9_UnlockRect,stretchSource),'flag still publishes writes');
      ok(await invoke(e.Surface9_LockRect,stretchSource,lock,0,0x8010),'readonly combined flag');
      assert.strictEqual(read(read(lock+4)),0xff654321,'writes survive unlock and readback');
      ok(await invoke(e.Surface9_UnlockRect,stretchSource));
      ok(await invoke(e.Device9_ColorFill,ad,stretchSource,0,0xff123456),'restore GPU-owned source');
    }
    ok(e.offscreen(ad,8,8,2,out,22),'SYSTEMMEM canvas like Dungeon Lords');const discardCanvas=read(out);
    ok(await invoke(e.Surface9_LockRect,discardCanvas,lock,0,0x2000),'non-dynamic SYSTEMMEM DISCARD');
    e.guest_write32(read(lock+4),0xff102938);
    ok(await invoke(e.Surface9_UnlockRect,discardCanvas));
    ok(await invoke(e.Surface9_LockRect,discardCanvas,lock,0,16));
    assert.strictEqual(read(read(lock+4)),0xff102938,'discard lock exposes writable storage');
    ok(await invoke(e.Surface9_UnlockRect,discardCanvas));
    write(rect,[0,0,1,1]);bad(await invoke(e.Surface9_LockRect,discardCanvas,lock,rect,0x2000));
    bad(await invoke(e.Surface9_LockRect,discardCanvas,lock,0,0x2010));
    e.Surface9_Release(discardCanvas);
    ok(await invoke(e.Surface9_LockRect,stretchSource,lock,0,16));
    assert.strictEqual(read(read(lock+4)),0xff123456,'GPU stretch source readback');
    bad(await invoke(e.stretch_back,ad,stretchSource,ab));
    ok(await invoke(e.Surface9_UnlockRect,stretchSource));
    ok(await invoke(e.Surface9_LockRect,ab,lock,0,16));
    bad(await invoke(e.stretch_back,ad,stretchSource,ab));
    ok(await invoke(e.Surface9_UnlockRect,ab));
    failTransfer=0x30015;
    bad(await invoke(e.stretch_back,ad,stretchSource,ab));
    failTransfer=0;
    ok(e.color(ad,2,2,22,1,out));const unrelatedTarget=read(out);
    ok(await invoke(e.Device9_ColorFill,ad,unrelatedTarget,0,0xffabcdef));
    ok(e.Device9_SetRenderTarget(ad,0,unrelatedTarget));
    ok(await invoke(e.stretch_back,ad,stretchSource,ab),'stretch into implicit backbuffer after failed upload');
    // Present is pipelined on the worker. LockRect fences the actual destination.
    ok(await invoke(e.Surface9_LockRect,ab,lock,0,16));
    assert.deepStrictEqual(Array.from({length:64},(_,i)=>read(read(lock+4)+i*4)),Array(64).fill(0xff123456));
    ok(await invoke(e.Surface9_UnlockRect,ab));
    ok(await invoke(e.Surface9_LockRect,unrelatedTarget,lock,0,16));
    assert.strictEqual(read(read(lock+4)),0xffabcdef,'StretchRect targets its destination, not the bound render target');
    ok(await invoke(e.Surface9_UnlockRect,unrelatedTarget));
    ok(e.Device9_SetRenderTarget(ad,0,ab));
    await invoke(e.Surface9_Release,unrelatedTarget);
    ok(e.create_device(pp,out));const foreignDevice=read(out);
    bad(await invoke(e.stretch_back,foreignDevice,stretchSource,ab));
    await invoke(e.Device9_Release,foreignDevice);
    ok(e.offscreen(ad,8,8,2,out,22));const systemStretch=read(out);
    bad(await invoke(e.stretch_back,ad,systemStretch,ab));
    await invoke(e.Surface9_Release,systemStretch);
    await invoke(e.Surface9_Release,stretchSource);
    ok(await invoke(e.Device9_ColorFill,ad,ab,0,0xff102030),'restore alias test background');
    ok(e.offscreen(ad,3,2,0,out,22),'default offscreen fill');const fillSurface=read(out);
    ok(e.offscreen(ad,4,3,2,out,22),'UpdateSurface system source');const uploadSource=read(out);
    ok(await invoke(e.Surface9_LockRect,uploadSource,lock,0,0),'source write');
    const uploadBits=read(lock+4);for(let i=0;i<12;i++)e.guest_write32(uploadBits+i*4,0xff203040+i);
    bad(await invoke(e.Device9_UpdateSurface,ad,uploadSource,0,fillSurface,0));
    ok(await invoke(e.Surface9_UnlockRect,uploadSource),'source unlock');
    write(rect,[1,1,3,3]);const destPoint=alloc(8);write(destPoint,[1,0]);
    ok(await invoke(e.Device9_ColorFill,ad,fillSurface,0,0xff010203),'GPU-owned destination before upload');
    ok(await invoke(e.Device9_UpdateSurface,ad,uploadSource,rect,fillSurface,destPoint),'rect UpdateSurface');
    assert.strictEqual(e.get_esp()>>>0,0x074ff018,'UpdateSurface stdcall');
    ok(await invoke(e.Surface9_LockRect,fillSurface,lock,0,16),'updated destination readback');
    const uploaded=read(lock+4);assert.deepStrictEqual(Array.from({length:6},(_,i)=>read(uploaded+i*4)),
      [0xff010203,0xff203045,0xff203046,0xff010203,0xff203049,0xff20304a]);
    bad(await invoke(e.Device9_UpdateSurface,ad,uploadSource,rect,fillSurface,destPoint));
    ok(await invoke(e.Surface9_UnlockRect,fillSurface),'destination unlock');
    write(rect,[1,1,3,3]);write(destPoint,[6,0]);
    assert.strictEqual(e.update_view(ab,ad,0,out),1,'implicit view resolves after compositor DC binding');
    const backWidth=read(out),backHeight=read(out+4);assert(backWidth>=8&&backHeight>=2);assert.strictEqual(read(out+8),22);
    ok(await invoke(e.Device9_UpdateSurface,ad,uploadSource,rect,ab,destPoint),'implicit backbuffer UpdateSurface');
    ok(await invoke(e.Device9_Present,ad),'updated implicit Present');
    // Present is pipelined one frame deep (52c37e18), so the raw back-buffer
    // bits are not synchronized yet; read through GetDC, which fences.
    ok(await invoke(e.Surface9_GetDC,ab,out),'presented backbuffer DC');const presentedDC=read(out);
    assert.deepStrictEqual([[0,0],[6,0],[7,0],[6,1],[7,1]].map(([x,y])=>e.GetPixel(presentedDC,x,y,0)>>>0),
      [0x302010,0x453020,0x463020,0x493020,0x4a3020]);
    ok(await invoke(e.Surface9_ReleaseDC,ab,presentedDC),'release presented backbuffer DC');
    ok(await invoke(e.Device9_ColorFill,ad,ab,0,0xff123456),'new rendering without Present before DC');
    ok(await invoke(e.Surface9_GetDC,ab,out),'backbuffer DC');const backDC=read(out);
    assert.strictEqual(e.GetPixel(backDC,0,0,0)>>>0,0x563412,'GetDC sees completed rendering without Present');
    assert.strictEqual(e.SetPixel(backDC,0,0,0xabcdef)>>>0,0xabcdef);
    bad(await invoke(e.Surface9_GetDC,ab,out));bad(await invoke(e.Surface9_ReleaseDC,ab,backDC+1));
    bad(await invoke(e.Device9_UpdateSurface,ad,uploadSource,rect,ab,destPoint));
    bad(await invoke(e.Device9_ColorFill,ad,ab,0,0));bad(await invoke(e.Device9_Present,ad));
    bad(await invoke(e.clear,ad,0xff010203));
    ok(await invoke(e.Surface9_ReleaseDC,ab,backDC),'release backbuffer DC');
    bad(await invoke(e.Surface9_ReleaseDC,ab,backDC));
    ok(await invoke(e.Device9_Present,ad),'GDI upload survives Present');
    ok(await invoke(e.Surface9_GetDC,ab,out),'GDI-uploaded backbuffer DC');const gdiDC=read(out);
    assert.strictEqual(e.GetPixel(gdiDC,0,0,0)>>>0,0xabcdef);
    ok(await invoke(e.Surface9_ReleaseDC,ab,gdiDC),'release GDI-uploaded backbuffer DC');
    write(rect,[1,1,3,2]);
    failTransfer=0x30016;bad(await invoke(e.Surface9_LockRect,ab,lock,rect,0));failTransfer=0;
    for(const invalid of[0x2000,0x1000,0x4000])bad(await invoke(e.Surface9_LockRect,ab,lock,rect,invalid));
    ok(await invoke(e.Surface9_LockRect,ab,lock,rect,0),'implicit writable subrect lock');
    assert.strictEqual(read(lock),backWidth*4,'subrect returns full surface pitch');
    const lockedBack=read(lock+4);
    assert.strictEqual(wa(lockedBack),e.back_bits(ad)+backWidth*4+4,'subrect points into canonical DIB');
    assert.strictEqual(read(lockedBack),0xff123456,'lock reads completed GPU color');
    e.guest_write32(lockedBack,0xffa1b2c3);
    bad(await invoke(e.Surface9_LockRect,ab,lock,0,0));bad(await invoke(e.Surface9_GetDC,ab,out));
    bad(await invoke(e.Surface9_ReleaseDC,ab,backDC));bad(await invoke(e.Device9_Present,ad));
    bad(await invoke(e.Device9_ColorFill,ad,ab,0,0));bad(await invoke(e.clear,ad,0));
    failTransfer=0x30015;bad(await invoke(e.Surface9_UnlockRect,ab));failTransfer=0;
    bad(await invoke(e.Surface9_GetDC,ab,out));bad(await invoke(e.Surface9_LockRect,ab,lock,0,0));
    ok(await invoke(e.Surface9_UnlockRect,ab),'implicit unlock retries upload');bad(await invoke(e.Surface9_UnlockRect,ab));
    ok(await invoke(e.Device9_Present,ad));
    ok(await invoke(e.Surface9_GetDC,ab,out),'re-presented backbuffer DC');const finalDC=read(out);
    assert.strictEqual(e.GetPixel(finalDC,1,1,0)>>>0,0xc3b2a1);assert.strictEqual(e.GetPixel(finalDC,0,0,0)>>>0,0xabcdef,'surrounding pixels preserved');
    ok(await invoke(e.Surface9_ReleaseDC,ab,finalDC),'release re-presented backbuffer DC');
    // CreateDevice8 keeps the primary device identity and replaces its vtable.
    // Backbuffer operations must still address that SAME host renderer; asking
    // for a fresh Device9 interface here used to create a second blank target.
    const devicesBefore8=bridge.devices.size;
    e.device8_identity(ad,1);
    ok(await invoke(e.Surface9_LockRect,ab,lock,0,0),'D3D8 owner lock');
    assert.strictEqual(read(read(lock+4)),0xffefcdab,'D3D8 lock reads existing primary renderer');
    e.guest_write32(read(lock+4),0xff345678);
    ok(await invoke(e.Surface9_UnlockRect,ab),'D3D8 owner unlock');
    ok(await invoke(e.Device9_Present,ad),'D3D8 primary present');
    ok(await invoke(e.Surface9_GetDC,ab,out),'D3D8 presented DC');const d3d8DC=read(out);
    assert.strictEqual(e.GetPixel(d3d8DC,0,0,0)>>>0,0x785634,'D3D8 CPU write reaches primary renderer');
    ok(await invoke(e.Surface9_ReleaseDC,ab,d3d8DC),'release D3D8 presented DC');
    assert.strictEqual(bridge.devices.size,devicesBefore8,'backbuffer access never creates an alias renderer');
    e.device8_identity(ad,0);
    ok(await invoke(e.Surface9_LockRect,ab,lock,0,16),'implicit readonly lock');
    const readonlySubmitted=bridge.devices.get(ad).queue.submitted;
    ok(await invoke(e.Surface9_UnlockRect,ab));assert.strictEqual(bridge.devices.get(ad).queue.submitted,readonlySubmitted,'readonly unlock submits no upload');
    ok(await invoke(e.Surface9_GetDC,ab,out));const dcAfterLock=read(out);
    bad(await invoke(e.Surface9_LockRect,ab,lock,0,0));bad(await invoke(e.Surface9_UnlockRect,ab));
    ok(await invoke(e.Surface9_ReleaseDC,ab,dcAfterLock));
    ok(await invoke(e.clear,ad,0x40123456),'nonopaque executor contents before partial lock');
    write(rect,[1,1,2,2]);write(lock,[0xdeadbeef,0xdeadbeef]);
    let snapshotLock=e.Surface9_LockRect(ab,lock,rect,0);
    if(e.get_d3d_render_token()){
      assert.strictEqual(read(lock+4),0xdeadbeef,'parked lock publishes no pointer');
      write(rect,[-1,-1,999999,999999]);
      snapshotLock=await invoke(e.Surface9_LockRect,ab,lock,rect,0);
    }
    ok(snapshotLock,'lock resumes with captured rectangle');
    assert.strictEqual(wa(read(lock+4)),e.back_bits(ad)+backWidth*4+4);
    e.guest_write32(read(lock+4),0x11223344);
    write(rect,[0,0,backWidth,backHeight]); // guest RECT no longer authoritative
    bad(await invoke(e.Surface9_LockRect,ab,lock,rect,0));
    ok(await invoke(e.Surface9_UnlockRect,ab),'unlock uses immutable original subrect');
    ok(await invoke(e.Surface9_LockRect,ab,lock,0,16));
    assert.strictEqual(read(read(lock+4)),0x40123456,'outside alpha survives rectangular upload');
    assert.strictEqual(read(read(lock+4)+backWidth*4+4),0xff223344,'only locked pixel normalizes X8 alpha');
    ok(await invoke(e.Surface9_UnlockRect,ab));
    bad(await invoke(e.Device9_UpdateSurface,ad,fillSurface,0,uploadSource,0));
    bad(await invoke(e.Device9_UpdateSurface,ad,uploadSource,0,fillSurface,0));
    write(destPoint,[-1,0]);bad(await invoke(e.Device9_UpdateSurface,ad,uploadSource,rect,fillSurface,destPoint));
    assert.strictEqual(e.Surface9_Release(uploadSource),0);e.guest_free(destPoint);
    ok(await invoke(e.Device9_ColorFill,ad,fillSurface,0,0x12345678),'ColorFill unbound default offscreen');
    ok(await invoke(e.Surface9_LockRect,fillSurface,lock,0,16),'filled offscreen readback');
    assert.strictEqual(read(read(lock+4)),0xff345678,'X8 fill forces opaque alpha');
    bad(await invoke(e.Device9_ColorFill,ad,fillSurface,0,0));
    ok(await invoke(e.Surface9_UnlockRect,fillSurface),'unlock filled surface');
    e.Surface9_Release(fillSurface);
    for(const cube of[0,1]){
      ok(e.rt_texture(ad,cube,out),'create render texture');const texture=read(out),base=read(texture+56);
      const count=cube?18:3,ids=new Set();
      for(let i=0;i<count;i++){
        const mip=texture+64+i*32,storage=base+i*80;
        assert.strictEqual(read(storage+40),read(mip+16),'shared native pixels');
        assert.strictEqual(read(storage+72),texture);assert.strictEqual(read(storage+76),i);
        ids.add(read(storage+36));
      }
      assert.strictEqual(ids.size,count,'distinct subresource identities');
      const surface=level=>{
        ok(cube?e.CubeTexture9_GetCubeMapSurface(texture,4,level,out):e.Texture9_GetSurfaceLevel(texture,level,out),'surface view');
        return read(out);
      };
      const s=surface(1),other=surface(2);
      ok(e.Device9_SetRenderTarget(ad,0,s),'bind texture surface');
      ok(e.Device9_GetRenderTarget(ad,0,out),'get same COM surface');assert.strictEqual(read(out),s);
      e.Surface9_Release(s);
      bad(e.Surface9_LockRect(s,lock,0,0));
      if(!cube)bad(e.Texture9_LockRect(texture,1,lock,0,0));
      ok(await invoke(e.clear,ad,0xff123456),'render texture mip');
      ok(e.Device9_SetRenderTarget(ad,0,other),'bind other mip');
      ok(await invoke(e.clear,ad,0xffabcdef),'render other mip');
      write(rect,[0,0,1,1]);ok(e.Device9_SetScissorRect(ad,rect),'small scissor');
      ok(e.Device9_SetRenderState(ad,174,1),'enable scissor');
      ok(await invoke(e.Device9_ColorFill,ad,s,0,0xff123456),'ColorFill ignores bound target and scissor');
      write(rect,[1,1,2,2]);
      ok(await invoke(e.Device9_ColorFill,ad,s,rect,0xff987654),'ColorFill subrect outside current scissor');
      ok(e.Device9_GetRenderTarget(ad,0,out),'ColorFill preserves target binding');assert.strictEqual(read(out),other);e.Surface9_Release(other);
      ok(e.Device9_GetScissorRect(ad,out),'ColorFill preserves scissor');assert.deepStrictEqual([0,1,2,3].map(i=>read(out+i*4)),[0,0,1,1]);
      ok(e.Device9_SetRenderState(ad,174,0),'disable test scissor');
      write(rect,[0,0,3,2]);bad(await invoke(e.Device9_ColorFill,ad,s,rect,0));
      bad(await invoke(e.Device9_ColorFill,ad,s,0xffffffff,0));
      ok(e.offscreen(ad,2,2,2,out,21),'alias readback destination');const copy=read(out);
      bad(await invoke(e.Device9_ColorFill,ad,copy,0,0));
      ok(await invoke(e.Device9_GetRenderTargetData,ad,s,copy),'read rendered texture surface');
      const copied=pixels(copy);assert.strictEqual(copied.value,0xff123456,'mip contents independent');
      assert.strictEqual(read(copied.p+12),0xff987654,'filled subrect writes exact destination');
      ok(e.cpu_texture(ad,2,out),'system memory texture source');const sourceTexture=read(out);
      ok(e.Texture9_GetSurfaceLevel(sourceTexture,1,out),'system source mip');const sourceMip=read(out);
      ok(await invoke(e.Surface9_LockRect,sourceMip,lock,0,0),'lock source mip');
      const sourceBits=read(lock+4);[0x12345678,0xabcdef01,0x23456789,0x3456789a].forEach((v,i)=>e.guest_write32(sourceBits+i*4,v));
      ok(await invoke(e.Surface9_UnlockRect,sourceMip),'unlock source mip');
      ok(await invoke(e.Device9_UpdateSurface,ad,sourceMip,0,s,0),'system texture to RT mip/cube');
      ok(await invoke(e.Device9_GetRenderTargetData,ad,s,copy),'read uploaded RT mip/cube');
      const updated=pixels(copy);assert.deepStrictEqual(Array.from({length:4},(_,i)=>read(updated.p+i*4)),
        [0x12345678,0xabcdef01,0x23456789,0x3456789a]);
      ok(e.cpu_texture(ad,0,out),'default normal texture destination');const destTexture=read(out);
      ok(e.Texture9_GetSurfaceLevel(destTexture,1,out),'default destination mip');const destMip=read(out);
      ok(await invoke(e.Device9_UpdateSurface,ad,sourceMip,0,destMip,0),'system to ordinary texture');
      const destRecord=destTexture+64+32;assert.strictEqual(read(destRecord+28),1,'destination dirty sequence');
      assert.strictEqual(read(read(destRecord+16)+12),0x3456789a,'ordinary texture CPU data updated');
      e.Surface9_Release(destMip);e.Texture9_Release(destTexture);e.Surface9_Release(sourceMip);e.Texture9_Release(sourceTexture);
      if(!cube){
        const top=surface(0);
        ok(e.Device9_SetRenderTarget(ad,0,top),'bind sampled mip');
        ok(await invoke(e.clear,ad,0xff2468ac),'produce sampled pixels');
        ok(e.Device9_SetFVF(ad,0x144),'textured POSITIONT diffuse');
        ok(e.Device9_SetRenderState(ad,137,0),'alias unlit');
        ok(e.Device9_SetRenderState(ad,22,1),'alias no culling');
        ok(e.Device9_SetTexture(ad,0,texture),'bind rendered texture');
        const tri=alloc(96),data=new DataView(memory.buffer,wa(tri),96);
        [[0,0],[8,0],[0,8]].forEach(([x,y],i)=>{
          const p=i*32;data.setFloat32(p,x,true);data.setFloat32(p+4,y,true);
          data.setFloat32(p+8,.5,true);data.setFloat32(p+12,1,true);data.setUint32(p+16,0xffffffff,true);
          data.setFloat32(p+20,.25,true);data.setFloat32(p+24,.25,true);
        });
        bad(await invoke(e.Device9_DrawPrimitiveUP,ad,4,1,tri,32));
        ok(e.Device9_SetRenderTarget(ad,0,ab),'sample into backbuffer');
        ok(await invoke(e.Device9_DrawPrimitiveUP,ad,4,1,tri,32),'sample rendered texture through native draw');
        ok(await invoke(e.Device9_Present,ad),'present sampled result');
        ok(await invoke(e.Surface9_GetDC,ab,out),'sampled backbuffer DC');const sampledDC=read(out);
        assert.strictEqual(e.GetPixel(sampledDC,0,0,0)>>>0,0xac6824,'sample backend pixels, not stale native zero bytes');
        ok(await invoke(e.Surface9_ReleaseDC,ab,sampledDC),'release sampled backbuffer DC');
        ok(e.Device9_SetTexture(ad,0,0),'unbind sampled texture');
        e.Surface9_Release(top);
        ok(e.Device9_SetRenderTarget(ad,0,other),'restore lifetime fixture binding');
      }
      e.Surface9_Release(copy);e.Surface9_Release(s);e.Surface9_Release(other);
      assert.strictEqual((cube?e.CubeTexture9_Release:e.Texture9_Release)(texture),0,'only binding retains parent');
      ok(e.Device9_GetRenderTarget(ad,0,out),'recreate externally released view');const recovered=read(out);
      assert.strictEqual(read(recovered+8),texture,'view retains original parent');e.Surface9_Release(recovered);
      if(cube){
        bad(await invoke(e.Device9_Reset,ad,pp)); // external backbuffer must be released first
        e.Surface9_Release(ab);
        ok(await invoke(e.Device9_Reset,ad,pp),'Reset releases internally retained cube parent');
        ok(e.Device9_GetRenderTarget(ad,0,out),'new implicit target after Reset');ab=read(out);
      }
      else ok(e.Device9_SetRenderTarget(ad,0,ab),'unbind releases parent');
      for(const id of ids)assert(!bridge.devices.get(ad).colors.has(id),'all instantiated mip IDs retired');
    }
    e.guest_write32(pp+44,0);
    bad(await invoke(e.Device9_Reset,ad,pp));
    ok(await invoke(e.Surface9_GetDC,ab,out),'failed Reset preserves old lockability');
    ok(await invoke(e.Surface9_ReleaseDC,ab,read(out)));
    e.Surface9_Release(ab);e.guest_write32(pp+44,0);
    ok(await invoke(e.Device9_Reset,ad,pp),'Reset removes lockability');
    ok(e.Device9_GetRenderTarget(ad,0,out));ab=read(out);
    bad(await invoke(e.Surface9_GetDC,ab,out));
    e.Surface9_Release(ab);assert.strictEqual(await invoke(e.Device9_Release,ad),0);
    // The last surface, not the original device pointer, now owns retirement.
    ok(e.create_device(pp,out));const retained=read(out);
    ok(e.Device9_GetBackBuffer(retained,0,0,0,out));const retainedBack=read(out);
    const iidUnknown=alloc(16);write(iidUnknown,[0,0,0xc0,0x46000000]);
    ok(e.Surface9_QueryInterface(retainedBack,iidUnknown,out));assert.strictEqual(read(out),retainedBack);
    assert.strictEqual(e.Surface9_Release(retainedBack),2);e.guest_free(iidUnknown);
    ok(e.Device9_GetSwapChain(retained,0,out));const swap=read(out);
    ok(e.SwapChain9_GetBackBuffer(swap,0,0,out));assert.strictEqual(read(out),retainedBack);
    assert.strictEqual(e.Surface9_Release(retainedBack),2);
    assert.strictEqual(await invoke(e.Device9_Release,swap),2);
    assert.strictEqual(e.Surface9_AddRef(retainedBack),3);
    ok(e.Device9_GetRenderTarget(retained,0,out));assert.strictEqual(read(out),retainedBack);
    assert.strictEqual(e.Surface9_Release(retainedBack),3);
    assert.strictEqual(await invoke(e.Device9_Release,retained),1,'surface keeps device alive');
    ok(e.Surface9_GetDevice(retainedBack,out));assert.strictEqual(read(out),retained);
    ok(await invoke(e.clear,retained,0xff13579b),'retained device still renders');
    assert.strictEqual(await invoke(e.Device9_Release,retained),1);
    assert.strictEqual(e.Surface9_Release(retainedBack),2,'nonfinal surface release keeps parent hold');
    failRetire=true;
    assert.strictEqual(await invoke(e.Surface9_Release,retainedBack),2,'failed retirement preserves surface');
    assert.strictEqual(e.get_esp()>>>0,0x074ff008,'failed retirement pops once');
    failRetire=false;
    ok(e.Surface9_GetDevice(retainedBack,out),'failed retirement preserves owner');
    assert.strictEqual(await invoke(e.Device9_Release,read(out)),1);
    let rejectRetirement;
    delayedRetire={promise:new Promise((resolve,reject)=>{rejectRetirement=reject;})};
    e.Surface9_Release(retainedBack);const failureToken=e.get_d3d_render_token();
    assert(failureToken<=-2);assert.strictEqual(e.get_esp()>>>0,0x074ff000);
    assert.strictEqual(e.dx_refs(retained),1);assert.strictEqual(e.dx_refs(retainedBack),2);
    e.Surface9_Release(retainedBack);assert.strictEqual(e.get_d3d_render_token(),failureToken);
    assert.strictEqual(e.get_esp()>>>0,0x074ff000,'repeated pending retirement does not pop');
    delayedRetire=null;rejectRetirement(new Error('injected pre-admission retirement failure'));
    await bridge.wait(failureToken);
    assert.strictEqual(await invoke(e.Surface9_Release,retainedBack),2);
    assert.strictEqual(e.dx_refs(retained),1);assert.strictEqual(e.dx_refs(retainedBack),2);
    assert(bridge.devices.has(retained),'completion-boundary fault does not destroy backend');
    assert.strictEqual(await invoke(e.Surface9_Release,retainedBack),0,'last surface retires device');
    assert.strictEqual(e.get_esp()>>>0,0x074ff008,'final surface release pops once');
    assert(!bridge.devices.has(retained),'backend retired with final surface');
  };
  const packed565=async()=>{
    write(pp,[3,2,23,1,0,0,1,1,1,0,0,1,0,0x80000000]);
    ok(e.create_device(pp,out),'create packed565 device');const dev=read(out);
    ok(e.Device9_GetBackBuffer(dev,0,0,0,out));const back565=read(out);
    ok(e.Surface9_GetDesc(back565,out));assert.strictEqual(read(out),23);
    const bits=e.back_bits(dev),bytes=new Uint8Array(memory.buffer,bits,16),view=new DataView(memory.buffer);
    bytes[6]=0xa5;bytes[7]=0x5a;bytes[14]=0xa5;bytes[15]=0x5a;
    ok(await invoke(e.clear,dev,0xff0000ff));
    ok(await invoke(e.Surface9_LockRect,back565,lock,0,16));
    assert.strictEqual(read(lock),8,'odd width has aligned 565 pitch');
    assert.strictEqual(view.getUint16(bits,true),0x001f);
    bad(await invoke(e.Surface9_GetDC,back565,out));
    ok(await invoke(e.Surface9_UnlockRect,back565));
    write(rect,[1,1,2,2]);
    ok(await invoke(e.Surface9_LockRect,back565,lock,rect,0));
    assert.strictEqual(wa(read(lock+4)),bits+10,'subrectangle left uses two bytes per pixel');
    view.setUint16(bits+10,0xf800,true);ok(await invoke(e.Surface9_UnlockRect,back565));
    ok(e.Device9_SetFVF(dev,0x44));ok(e.Device9_SetRenderState(dev,137,0));ok(e.Device9_SetRenderState(dev,22,1));
    const vertex=alloc(60),v=new DataView(memory.buffer,wa(vertex),60);
    [[0,0],[3,0],[0,2]].forEach(([x,y],i)=>{[x,y,.5,1].forEach((n,j)=>v.setFloat32(i*20+j*4,n,true));v.setUint32(i*20+16,0xff00ff00,true);});
    ok(await invoke(e.Device9_DrawPrimitiveUP,dev,4,1,vertex,20));
    ok(e.offscreen(dev,3,2,2,out,23));const copy565=read(out);
    ok(await invoke(e.Device9_GetRenderTargetData,dev,back565,copy565));
    ok(await invoke(e.Surface9_LockRect,copy565,lock,0,16));
    assert.strictEqual(view.getUint16(wa(read(lock+4)),true),0x07e0,'draw readback is a real green word');
    ok(await invoke(e.Surface9_UnlockRect,copy565));
    ok(await invoke(e.Device9_Present,dev));assert.strictEqual(view.getUint16(bits,true),0x07e0);
    ok(e.Device9_GetSwapChain(dev,0,out));const swap565=read(out);
    ok(await invoke(e.SwapChain9_Present,swap565));
    assert.deepStrictEqual([bytes[6],bytes[7],bytes[14],bytes[15]],[0xa5,0x5a,0xa5,0x5a],'readback and both Present routes preserve padding');
    await invoke(e.SwapChain9_Release,swap565);
    ok(await invoke(e.Surface9_GetDC,back565,out));const dc=read(out);
    bad(await invoke(e.Surface9_LockRect,back565,lock,0,0));
    e.SetPixel(dc,2,1,0x000000ff);
    ok(await invoke(e.Surface9_ReleaseDC,back565,dc));
    ok(await invoke(e.Surface9_LockRect,back565,lock,0,16));
    assert.strictEqual(view.getUint16(bits+12,true),0xf800,'DC write uploads a packed red word');
    ok(await invoke(e.Surface9_UnlockRect,back565));
    ok(await invoke(e.Surface9_LockRect,copy565,lock,0,0));
    const upload565=wa(read(lock+4)),uploadPitch=read(lock);
    for(let y=0;y<2;y++)for(let x=0;x<3;x++)view.setUint16(upload565+y*uploadPitch+x*2,0x001f,true);
    ok(await invoke(e.Surface9_UnlockRect,copy565));
    ok(await invoke(e.Device9_UpdateSurface,dev,copy565,0,back565,0));
    ok(await invoke(e.Surface9_LockRect,back565,lock,0,16));
    assert.strictEqual(view.getUint16(bits,true),0x001f,'packed system-memory UpdateSurface');
    view.setUint16(bits,0xf800,true);ok(await invoke(e.Surface9_UnlockRect,back565));
    ok(await invoke(e.Surface9_LockRect,back565,lock,0,16));
    assert.strictEqual(view.getUint16(bits,true),0x001f,'READONLY unlock does not upload guest writes');
    ok(await invoke(e.Surface9_UnlockRect,back565));
    ok(e.color(dev,3,2,23,1,out));const target565=read(out);
    ok(await invoke(e.Device9_ColorFill,dev,target565,0,0xff123456));
    ok(await invoke(e.Surface9_LockRect,target565,lock,0,16));
    assert.strictEqual(view.getUint16(wa(read(lock+4)),true),0x11aa,'nonrepresentable fill quantizes to565');
    ok(await invoke(e.Surface9_UnlockRect,target565));
    bad(await invoke(e.stretch,dev,target565,0,back565,0,0));
    await invoke(e.Surface9_Release,target565);await invoke(e.Surface9_Release,copy565);
    bad(await invoke(e.Device9_Reset,dev,pp)); // held backbuffer reference
    await invoke(e.Surface9_Release,back565);
    for(const format of [22,23,22]){
      write(pp,[3,2,format,1,0,0,1,1,1,0,0,1,0,0x80000000]);
      ok(await invoke(e.Device9_Reset,dev,pp),'22/23 Reset transitions');
      ok(e.Device9_GetBackBuffer(dev,0,0,0,out));const b=read(out);
      ok(e.Surface9_GetDesc(b,out));assert.strictEqual(read(out),format);
      ok(await invoke(e.clear,dev,0xffff0000));ok(await invoke(e.Device9_Present,dev));
      assert.strictEqual(new DataView(memory.buffer).getUint16(e.back_bits(dev),true),format===23?0xf800:0);
      await invoke(e.Surface9_Release,b);
    }
    e.guest_free(vertex);await invoke(e.Device9_Release,dev);
  };
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:wa});
  try{await aliases();await packed565();}finally{await bridge.close();}
  bridge=makeWorker();
  try{
    await aliases();await packed565();
    ok(e.create_device(pp,out),'worker device');const wd=read(out);
    ok(e.color(wd,3,2,21,1,out),'worker target');const target=read(out);
    ok(e.Device9_SetRenderTarget(wd,0,target),'worker bind');
    ok(await invoke(e.clear,wd,0xff918273),'worker clear');
    ok(await invoke(e.Surface9_LockRect,target,lock,0,0),'worker lock fences rendering');
    const bits=read(lock+4);assert.strictEqual(read(bits),0xff918273);
    e.guest_write32(bits,0xff13579b);
    ok(await invoke(e.Surface9_UnlockRect,target),'worker upload');
    ok(await invoke(e.Surface9_LockRect,target,lock,0,16),'worker read uploaded bytes');
    assert.strictEqual(read(read(lock+4)),0xff13579b);
    ok(await invoke(e.Surface9_UnlockRect,target),'worker readonly unlock');
    bad(await invoke(e.Device9_Reset,wd,pp));
    ok(e.offscreen(wd,3,2,2,out,21),'worker system surface');const sys=read(out);
    ok(await invoke(e.Device9_GetRenderTargetData,wd,target,sys),'worker readback');
    assert.strictEqual(pixels(sys).value,0xff13579b);
    assert.strictEqual(await invoke(e.Surface9_Release,target),0);
    ok(await invoke(e.Device9_Reset,wd,pp),'reset retires only internal target');
    assert.strictEqual(e.blockers(wd),0);assert.strictEqual(pixels(sys).value,0xff13579b,'system pool survives Reset');
    assert.strictEqual(await invoke(e.Device9_Release,wd),1,'system surface keeps device alive');
    assert.strictEqual(await invoke(e.Surface9_Release,sys),0,'last child drives ordered final device release');
    assert.strictEqual(bridge.devices.size,0);
  }finally{await bridge.close();}
  assert.strictEqual(nestedChecks,2,'nested copies exercised both readback and upload parks');
  console.log('PASS nested StretchRect: both parks, invalid child cleanup, distinct source pixels and parent restoration');
  console.log('PASS native D3D9 color surfaces: direct/worker UpdateTexture mip/cube/format/pool/lock/owner validation, StretchRect backbuffer uploads, ColorFill targets/subrects, texture aliases and sampling, Clear/Lock/upload/readback, implicit Present, Reset and lifetime');
})().catch(error=>{console.error(error);process.exitCode=1;});
