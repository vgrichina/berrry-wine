#!/usr/bin/env node
'use strict';
// D3D9 depth / back-buffer Release and Reset from a real x86 caller. D3D9
// runs only on the GPU stream ring (d3d9-retire S4), where dropping a
// surface's executor target is a ring RELEASE that needs no host answer, so
// every one of these calls completes in the caller's own run: no parked
// render token, no yield, the RET balanced at once. Ownership is what is
// left to check: a bound depth surface outlives its last external Release,
// the last child Release frees the device it kept alive, Reset resizes the
// target in place, and depth identities are shared across instances and
// never wrap.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {bootRenderHarness}=require('./render-helper');
const {createCanvas}=require('../lib/canvas-compat');
const id=require('../src/api_table.json').find(a=>a.name==='IDirect3DSurface9_Release').id;
const resetId=require('../src/api_table.json').find(a=>a.name==='IDirect3DDevice9_Reset').id;
const bytes=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
(async()=>{
  const{exports:e,memory,module,host}=await bootRenderHarness({fonts:'none',
    // The software executor, with a canvas to present into: the ring opens.
    beforeInstantiate:ctx=>{ctx.d3d9GpsBackend='software';ctx.createCanvas=(w,h)=>createCanvas(w,h);},
    extraWat:`
    (func (export "depth_serial") (result i32) (call $d3d9_depth_next_serial))
    (func (export "depth_exhaust") (i32.atomic.store (global.get $D3D9_DEPTH_SERIAL) (i32.const -2)))
    (func (export "temporary_depth") (result i32)
      (local $p i32) (local $serial i32)
      (local.set $p (call $d3d9_depth_new (i32.const 0) (i32.const 8) (i32.const 8) (i32.const 80) (i32.const 0) (i32.const 0)))
      (if (i32.eqz (local.get $p)) (then (return (i32.const 0))))
      (local.set $serial (i32.load offset=36 (call $g2w (local.get $p))))
      (call $heap_free (local.get $p)) (local.get $serial))
    (func (export "make_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "make_depth") (param $d i32) (result i32)
      (call $d3d9_depth_new (local.get $d) (i32.const 8) (i32.const 8) (i32.const 80) (i32.const 0) (i32.const 1)))
    (func (export "get_backbuffer") (param $d i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
      (call $handle_IDirect3DDevice9_GetBackBuffer (local.get $d) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $out) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "bind_depth") (param $d i32) (param $s i32)
      (call $d3d9_depth_binding (local.get $d) (local.get $s) (i32.const 0)))
    (func (export "release_surface") (param $s i32) (result i32) (call $d3d9_depth_release (local.get $s)))
    (func (export "release_device") (param $d i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
      (call $handle_IDirect3DDevice9_Release (local.get $d) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "refs") (param $d i32) (result i32)
      (load.field DxObject refcount (call $dx_from_this (local.get $d))))
    (func (export "thunk") (result i32)
      (call $gl32 (call $init_com_vtable (i32.const ${id}) (i32.const 1))))
    (func (export "reset_thunk") (result i32)
      (call $gl32 (call $init_com_vtable (i32.const ${resetId}) (i32.const 1))))
    (func (export "target_width") (param $d i32) (result i32)
      (load.field DxObject width (call $d3ddev_rt_entry (local.get $d))))
    (func (export "target_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (func (export "start") (param $code i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000)) (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0)) (global.set $eip (local.get $code)))
  `});
  const pe=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.init_dx_com_thunks();
  const alloc=n=>e.guest_alloc(n)>>>0,read=p=>e.guest_read32(p)>>>0;
  const pp=alloc(64),out=alloc(4),marker=alloc(4);
  // One x86 call through a COM thunk, run to its RET: it must finish in the
  // same run, with no yield and ESP back where it started.
  const x86=(thunk,args)=>{
    const code=alloc(64);
    new Uint8Array(memory.buffer).set([...args.slice().reverse().flatMap(a=>[0x68,...bytes(a)]),
      0xb8,...bytes(thunk),0xff,0xd0,0xa3,...bytes(marker),0xc3],e.guest_to_wasm(code));
    e.guest_write32(marker,0xdeadbeef);e.clear_yield();e.start(code);e.run(1000);
    assert.strictEqual(e.get_yield_reason(),0,'no yield');
    assert.strictEqual(e.get_eip(),0,'returned in one run');
    assert.strictEqual(e.get_esp()>>>0,0x07000004,'RET balanced');
    return read(marker);
  };
  new Uint8Array(memory.buffer,e.guest_to_wasm(pp),64).fill(0);
  [8,8,21,1,0,0,1,1,1].forEach((v,i)=>e.guest_write32(pp+i*4,v));
  // A bound depth surface keeps its device alive; its Release frees both.
  assert.strictEqual(e.make_device(pp,out),0,'CreateDevice on the software executor');
  const device=read(out),surface=e.make_depth(device)>>>0;assert(surface);
  e.bind_depth(device,surface);assert.strictEqual(e.refs(device),2);
  assert.strictEqual(e.release_device(device),1,'the depth child holds the device');
  assert.strictEqual(x86(e.thunk(),[surface]),0,'last child Release');
  // Reset resizes the target synchronously, from the caller's parameters.
  assert.strictEqual(e.make_device(pp,out),0);const resetDevice=read(out),oldTarget=e.target_bits(resetDevice);
  [16,10,21,1,0,0,1,1,1,1,80].forEach((v,i)=>e.guest_write32(pp+i*4,v));
  assert.strictEqual(x86(e.reset_thunk(),[resetDevice,pp]),0,'Reset');
  assert.strictEqual(e.target_width(resetDevice),16,'Reset resized the target');
  assert.notStrictEqual(e.target_bits(resetDevice),oldTarget);
  assert.strictEqual(e.release_device(resetDevice),0);
  // A bound surface's last Release leaves it to the binding; unbinding it
  // (twice, and then releasing the device) is harmless.
  new Uint8Array(memory.buffer,e.guest_to_wasm(pp),64).fill(0);
  [8,8,21,1,0,0,1,1].forEach((v,i)=>e.guest_write32(pp+i*4,v));
  assert.strictEqual(e.make_device(pp,out),0);const unbindDevice=read(out),unbindSurface=e.make_depth(unbindDevice)>>>0;
  e.bind_depth(unbindDevice,unbindSurface);
  assert.strictEqual(e.release_surface(unbindSurface),0);
  e.bind_depth(unbindDevice,0);e.bind_depth(unbindDevice,0);
  assert.strictEqual(e.release_device(unbindDevice),0);
  // The back buffer: the device's last reference is its back-buffer child.
  assert.strictEqual(e.make_device(pp,out),0);const backDevice=read(out);
  assert.strictEqual(e.get_backbuffer(backDevice,out),0);const backSurface=read(out);
  assert.strictEqual(e.refs(backDevice),2);assert.strictEqual(e.refs(backSurface),2);
  assert.strictEqual(e.release_device(backDevice),1);
  // Its other reference is the device's own: one external Release is the last.
  assert.strictEqual(x86(e.thunk(),[backSurface]),0,'final back-buffer Release frees the device');
  const sibling=(await WebAssembly.instantiate(module,{host})).exports;
  sibling.d3dim_worker_init(0x400000);
  const allocated1=e.temporary_depth()>>>0,allocated2=sibling.temporary_depth()>>>0;
  assert(allocated1);assert.strictEqual(allocated2,allocated1+1,'two instances allocate distinct depth identities after Reset');
  const serial1=e.depth_serial()>>>0,serial2=sibling.depth_serial()>>>0,serial3=e.depth_serial()>>>0;
  assert.strictEqual(serial2,serial1+1,'second WASM instance observes the shared identity sequence');
  assert.strictEqual(serial3,serial2+1,'instance creation cannot reset existing depth identities');
  e.depth_exhaust();assert.strictEqual(sibling.depth_serial()>>>0,0xffffffff);
  assert.strictEqual(e.depth_serial(),0);assert.strictEqual(sibling.depth_serial(),0,'exhaustion never wraps or reuses identities');
  console.log('PASS actual x86 depth/backbuffer Release and Reset complete synchronously on the ring; ownership and shared depth identities hold');
})().catch(error=>{console.error(error);process.exitCode=1;});
