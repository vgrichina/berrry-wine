#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const {Bridge}=require('../lib/d3d9-host');
  const native={d3d_software_create(){},d3d_shader_vm_compile(){}};
  for(const [backend,enabled,exports,expected] of [
    ['software',true,native,0x800],['software',false,native,0],
    ['software',true,{},0],['webgl',true,native,0]]) {
    const bridge=new Bridge({backend,enableProgrammable:enabled,getExports:()=>exports});
    assert.strictEqual(bridge.call(0x30017,0,0),expected,'backend-specific primitive caps');
    const {host}=require('../lib/host-imports').createHostImports({getMemory:()=>new ArrayBuffer(65536),d3d9Bridge:bridge});
    assert.strictEqual(host.gpu_gl_call(0x30017,0,0),expected,'production import routes primitive caps to D3D bridge');
    bridge.maxRequests=0;
    assert.strictEqual(bridge.call(0x30017,0,0),expected,'caps do not allocate render requests');
    await bridge.close();
    assert.strictEqual(bridge.call(0x30017,0,0),-1,'closed bridge refuses queries');
  }
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "test_adapter") (param $adapter i32) (param $flags i32) (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3D9_GetAdapterIdentifier (i32.const 0) (local.get $adapter)
        (local.get $flags) (local.get $p) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_caps") (param $adapter i32) (param $type i32) (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3D9_GetDeviceCaps (i32.const 0) (local.get $adapter)
        (local.get $type) (local.get $p) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_device_caps") (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DDevice9_GetDeviceCaps (i32.const 0) (local.get $p)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "new_parent") (result i32)
      (call $dx_create_com_obj (i32.const 19) (global.get $DX_VTBL_D3D9)))
    (func (export "new_device") (param $parent i32) (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $pp))
      (call $gs32 (i32.const 0x074ff01c) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (local.get $parent) (i32.const 0)
        (i32.const 1) (i32.const 0x10001) (i32.const 0x20) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "refcount") (param $p i32) (result i32)
      (load.field DxObject refcount (call $dx_from_this (local.get $p))))
    (func (export "kind") (param $p i32) (result i32)
      (load.field DxObject type (call $dx_from_this (local.get $p))))
    ${[['IDirect3D9','Release'],['IDirect3DDevice9','Release'],['IDirect3DSurface9','GetDesc'],['IDirect3DSurface9','Release'],
      ['IDirect3DStateBlock9','Apply'],['IDirect3DStateBlock9','Release'],
      ...['GetDirect3D','GetDisplayMode','GetCreationParameters','GetRenderTarget','GetRenderState','SetRenderState','BeginStateBlock','EndStateBlock'].map(n=>['IDirect3DDevice9',n])].map(([type,name])=>`
    (func (export "${type}_${name}") (param $a i32) (param $b i32) (param $c i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_${require('../src/api_table.json').find(a=>a.name===`${type}_${name}`).handler||`${type}_${name}`} (local.get $a) (local.get $b) (local.get $c)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
  ` });
  const ptr = 0x00403004;
  const str = offset => {
    let result = '';
    for (let i = 0; i < 512; ++i) {
      const c = e.guest_read8(ptr + offset + i); if (!c) break;
      result += String.fromCharCode(c);
    }
    return result;
  };
  for (const flags of [0, 2]) {
    e.guest_write32(ptr - 4, 0xdeadbeef); e.guest_write32(ptr + 1100, 0xdeadbeef);
    assert.strictEqual(e.test_adapter(0, flags, ptr), 0);
    assert.strictEqual(e.get_esp(), 0x00300014);
    assert.strictEqual(str(0), 'wine-assembly');
    assert.strictEqual(str(512), 'Wine Assembly D3D9');
    assert.strictEqual(str(1024), String.raw`\\.\DISPLAY1`);
    assert.strictEqual(e.guest_read32(ptr + 1096), 0, 'no WHQL certification claimed');
    assert.strictEqual(e.guest_read32(ptr - 4) >>> 0, 0xdeadbeef);
    assert.strictEqual(e.guest_read32(ptr + 1100) >>> 0, 0xdeadbeef);
  }
  assert.strictEqual(e.test_adapter(1, 0, ptr) >>> 0, 0x8876086c);
  assert.ok(Array.from({ length: 1100 }, (_, i) => e.guest_read8(ptr + i)).every(v => v === 0));
  assert.strictEqual(e.test_adapter(0, 1, ptr) >>> 0, 0x8876086c);
  assert.strictEqual(e.test_adapter(0, 0, 0) >>> 0, 0x8876086c);
  e.guest_write32(ptr + 304, 0xdeadbeef);
  assert.strictEqual(e.test_caps(0, 1, ptr), 0);
  assert.strictEqual(e.get_esp(), 0x00300014);
  assert.strictEqual(e.guest_read32(ptr), 1);
  assert.strictEqual(e.guest_read32(ptr + 88), 2048);
  assert.strictEqual(e.guest_read32(ptr + 92), 2048);
  assert.strictEqual(e.guest_read32(ptr + 196), 0, 'no vertex shader version advertised');
  assert.strictEqual(e.guest_read32(ptr + 204), 0, 'no pixel shader version advertised');
  assert.strictEqual(e.guest_read32(ptr + 152), 0, 'no texture sampling advertised');
  assert.strictEqual(e.guest_read32(ptr + 232), 1, 'one adapter in group');
  assert.strictEqual(e.guest_read32(ptr + 236), 0, 'DeclTypes is not adapter count');
  assert.strictEqual(e.guest_read32(ptr + 240), 1, 'one simultaneous render target');
  assert.strictEqual(e.guest_read32(ptr + 244), 0, 'no StretchRect filtering advertised');
  assert.strictEqual(e.guest_read32(ptr + 304) >>> 0, 0xdeadbeef);
  const caps = Array.from({ length: 304 }, (_, i) => e.guest_read8(ptr + i));
  assert.strictEqual(e.test_device_caps(ptr + 1200), 0);
  assert.strictEqual(e.get_esp(), 0x0030000c);
  assert.deepStrictEqual(Array.from({ length: 304 }, (_, i) => e.guest_read8(ptr + 1200 + i)), caps);
  assert.strictEqual(e.test_caps(1, 1, ptr) >>> 0, 0x8876086c);
  assert.strictEqual(e.test_caps(0, 1, 0) >>> 0, 0x8876086c);
  {
    // With a programmable renderer present (host query 0x30005 answers 1) the
    // caps advertise what it implements, including the six fixed-function
    // blend stages ValidateDevice accepts. MaxTextureBlendStages was 0, and
    // Pirates! (2004) requires >= 2 stages and >= 2 simultaneous textures.
    let primitiveCaps=0;
    const { exports: p } = await bootRenderHarness({ fonts: 'none',
      extraHostOverrides: { gpu_gl_call: opcode => (opcode === 0x30005 ? 1 : opcode === 0x30017 ? primitiveCaps : 0) },
      extraWat: `
    (func (export "test_caps") (param $adapter i32) (param $type i32) (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3D9_GetDeviceCaps (i32.const 0) (local.get $adapter)
        (local.get $type) (local.get $p) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))` });
    assert.strictEqual(p.test_caps(0, 1, ptr), 0);
    assert.strictEqual(p.guest_read32(ptr+32),0,'WebGL ADD-only must not advertise BLENDOP');
    primitiveCaps=0x800;assert.strictEqual(p.test_caps(0,1,ptr),0);
    assert.strictEqual(p.guest_read32(ptr+32),0x800,'software executor reports implemented BLENDOP');
    primitiveCaps=0xffffffff;assert.strictEqual(p.test_caps(0,1,ptr),0);
    assert.strictEqual(p.guest_read32(ptr+32),0x800,'unreviewed miscellaneous bits stay clear');
    assert.strictEqual(p.guest_read32(ptr + 148), 6, 'MaxTextureBlendStages: six fixed-function stages');
    assert.strictEqual(p.guest_read32(ptr + 152), 4, 'MaxSimultaneousTextures');
    assert.strictEqual(p.guest_read32(ptr + 196) >>> 0, 0xfffe0101, 'vs_1_1');
    assert.strictEqual(p.guest_read32(ptr + 204) >>> 0, 0xffff0101, 'ps_1_1');
  }
  e.init_dx_com_thunks();
  const pp=ptr+2048,out=pp+128,parent=e.new_parent();
  for(let i=0;i<56;i+=4)e.guest_write32(pp+i,0);
  e.guest_write32(pp,800);e.guest_write32(pp+4,600);e.guest_write32(pp+8,22);
  e.guest_write32(pp+48,75);
  assert.strictEqual(e.new_device(parent,pp,out),0);
  const d=e.guest_read32(out)>>>0;
  for(const [state,value] of [[15,0],[19,2],[20,1],[24,0],[25,8],[27,0],[168,15],[171,1],[193,0xffffffff],
    [206,0],[207,2],[208,1],[209,1]]){
    e.guest_write32(out,0xdeadbeef);e.guest_write32(out+4,0xcafebabe);
    assert.strictEqual(e.IDirect3DDevice9_GetRenderState(d,state,out),0);
    assert.strictEqual(e.guest_read32(out)>>>0,value,`native default render state ${state}`);
    assert.strictEqual(e.guest_read32(out+4)>>>0,0xcafebabe,'getter output bounds');
    assert.strictEqual(e.get_esp()>>>0,0x074ff010,'render-state getter ABI');
  }
  assert.strictEqual(e.IDirect3DDevice9_SetRenderState(d,168,0),0);
  assert.strictEqual(e.IDirect3DDevice9_GetRenderState(d,168,out),0);
  assert.strictEqual(e.guest_read32(out),0,'explicit zero mask is not replaced by its default');
  // Full CreateStateBlock remains unsupported. Exercise the implemented
  // selective record/apply path, recording values read from native defaults.
  const outputStates=[168,171,193,206,207,208,209];
  const defaults=outputStates.map(state=>{
    assert.strictEqual(e.IDirect3DDevice9_GetRenderState(d,state,out),0);
    return e.guest_read32(out)>>>0;
  });
  assert.strictEqual(e.IDirect3DDevice9_BeginStateBlock(d),0);
  outputStates.forEach((state,i)=>assert.strictEqual(e.IDirect3DDevice9_SetRenderState(d,state,defaults[i]),0));
  assert.strictEqual(e.IDirect3DDevice9_EndStateBlock(d,out),0);
  const saved=e.guest_read32(out)>>>0;
  for(const [state,value] of [[168,15],[171,5],[193,0],[206,1],[207,5],[208,6],[209,3]])
    assert.strictEqual(e.IDirect3DDevice9_SetRenderState(d,state,value),0);
  assert.strictEqual(e.IDirect3DStateBlock9_Apply(saved),0);
  for(const [state,value] of [[168,0],[171,1],[193,0xffffffff],[206,0],[207,2],[208,1],[209,1]]){
    assert.strictEqual(e.IDirect3DDevice9_GetRenderState(d,state,out),0);
    assert.strictEqual(e.guest_read32(out)>>>0,value,'state block restores native output defaults');
  }
  assert.strictEqual(e.IDirect3DStateBlock9_Release(saved),0);
  assert.strictEqual(e.refcount(parent),2,'device retains parent');
  assert.strictEqual(e.IDirect3D9_Release(parent),1);
  assert.strictEqual(e.IDirect3DDevice9_GetDirect3D(d,out),0);
  assert.strictEqual(e.guest_read32(out)>>>0,parent>>>0,'original parent identity');
  assert.strictEqual(e.refcount(parent),2,'GetDirect3D AddRef');
  assert.strictEqual(e.get_esp(),0x074ff00c);
  assert.strictEqual(e.IDirect3D9_Release(parent),1);
  e.guest_write32(out+16,0xdeadbeef);
  assert.strictEqual(e.IDirect3DDevice9_GetCreationParameters(d,out),0);
  assert.deepStrictEqual([0,4,8,12].map(i=>e.guest_read32(out+i)>>>0),[0,1,0x10001,0x20]);
  assert.strictEqual(e.IDirect3DDevice9_GetDisplayMode(d,0,out),0);
  assert.strictEqual(e.get_esp(),0x074ff010);
  assert.deepStrictEqual([0,4,8,12].map(i=>e.guest_read32(out+i)>>>0),[800,600,75,22]);
  assert.strictEqual(e.guest_read32(out+16)>>>0,0xdeadbeef);
  assert.strictEqual(e.IDirect3DDevice9_GetDisplayMode(d,1,out)>>>0,0x8876086c);
  assert.strictEqual(e.IDirect3DDevice9_GetDirect3D(d,0)>>>0,0x8876086c);
  assert.strictEqual(e.IDirect3DDevice9_GetCreationParameters(d,0)>>>0,0x8876086c);
  assert.strictEqual(e.IDirect3DDevice9_GetRenderTarget(d,0,out),0);
  const rt=e.guest_read32(out)>>>0;
  assert.strictEqual(e.refcount(rt),2,'caller surface reference');
  assert.strictEqual(e.IDirect3DDevice9_GetRenderTarget(d,0,out),0);
  assert.strictEqual(e.guest_read32(out)>>>0,rt,'stable Surface9 wrapper identity');
  assert.strictEqual(e.IDirect3DSurface9_Release(rt),2);
  e.guest_write32(out+32,0xdeadbeef);
  assert.strictEqual(e.IDirect3DSurface9_GetDesc(rt,out),0);
  assert.deepStrictEqual(Array.from({length:8},(_,i)=>e.guest_read32(out+i*4)>>>0),[22,1,1,0,0,0,800,600]);
  assert.strictEqual(e.guest_read32(out+32)>>>0,0xdeadbeef);
  assert.strictEqual(e.IDirect3DSurface9_GetDesc(rt,0)>>>0,0x8876086c);
  assert.strictEqual(e.IDirect3DDevice9_GetRenderTarget(d,1,out)>>>0,0x8876086c);
  assert.strictEqual(e.IDirect3DDevice9_GetRenderTarget(d,0,0)>>>0,0x8876086c);
  assert.strictEqual(e.IDirect3DSurface9_Release(rt),1,'implicit render target survives caller release');
  assert.strictEqual(e.IDirect3DDevice9_Release(d),0);
  assert.strictEqual(e.kind(parent),0,'last device release retires retained parent');
  console.log('PASS D3D9 adapter/device queries, identity, parent lifetime, output bounds and ABI');
})().catch(error => { console.error(error); process.exitCode = 1; });
