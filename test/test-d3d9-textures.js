#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
// The JS DXT decoder (lib/d3d9-texture.js) is gone: these unit asserts now run
// the WAT decoder itself (GPU stream v2 slice 9.1). Length and dimension
// validation moved to the upload path (lib/d3d9-host.js captureDraw).
const {decode:watDecode}=require('./helpers/wat-texture-decoder');
const Texture={DXT1:0x31545844,DXT3:0x33545844,DXT5:0x35545844,decode:(bytes,w,h,format)=>watDecode(bytes,w,h,format)};
const {REGIONS}=require('../lib/region-map.generated.js');
(async () => {
  const dxt1=new Uint8Array([0,248,224,7,0xe4,0xe4,0xe4,0xe4]);
  const decoded=Texture.decode(dxt1,4,4,Texture.DXT1);
  assert.deepStrictEqual(Array.from(decoded.slice(0,16)),[255,0,0,255,0,255,0,255,170,85,0,255,85,170,0,255]);
  const transparent=new Uint8Array([0,0,255,255,255,255,255,255]);
  assert.ok(Texture.decode(transparent,1,1,Texture.DXT1).every(v=>v===0));
  assert.deepStrictEqual(Array.from(dxt1),[0,248,224,7,0xe4,0xe4,0xe4,0xe4],'decode preserves compressed storage');
  for(const [a,b,expected] of [[255,0,[255,0,219,182,146,109,73,36]],
    [0,255,[0,255,51,102,153,204,0,255]]]){
    const bytes=new Uint8Array(16);bytes[0]=a;bytes[1]=b;bytes.set(dxt1,8);
    let selectors=0n;for(let i=0;i<16;i++)selectors|=BigInt(i%8)<<BigInt(i*3);
    for(let i=0;i<6;i++)bytes[2+i]=Number(selectors>>BigInt(i*8)&255n);
    const rgba=Texture.decode(bytes,4,4,Texture.DXT5);
    assert.deepStrictEqual(Array.from({length:16},(_,i)=>rgba[i*4+3]),[...expected,...expected]);
  }
  // DXT3 keeps DXT1's colour half at byte 8 and spends bytes 0..7 on sixteen
  // explicit 4-bit alphas, low nibble first, replicated so 0xf reads as opaque.
  const dxt3=new Uint8Array(16);
  for(let j=0;j<8;j++)dxt3[j]=(2*j)|((2*j+1)<<4);
  dxt3.set(dxt1,8);
  const dxt3rgba=Texture.decode(dxt3,4,4,Texture.DXT3);
  assert.deepStrictEqual(Array.from(dxt3rgba.slice(0,12)),[255,0,0,0, 0,255,0,17, 170,85,0,34]);
  assert.deepStrictEqual(Array.from({length:16},(_,i)=>dxt3rgba[i*4+3]),
    Array.from({length:16},(_,i)=>(i<<4)|i));
  const reversedDxt3=new Uint8Array(16);reversedDxt3.fill(255,0,8);
  reversedDxt3.set([0,0,255,255,255,255,255,255],8);
  assert.deepStrictEqual(Array.from(Texture.decode(reversedDxt3,1,1,Texture.DXT3)),[170,170,170,255],
    'DXT3 uses four-color interpolation even when endpoint0 <= endpoint1');
  const reversedDxt5=new Uint8Array([255,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255]);
  assert.deepStrictEqual(Array.from(Texture.decode(reversedDxt5,1,1,Texture.DXT5)),[170,170,170,255],
    'DXT5 uses four-color interpolation even when endpoint0 <= endpoint1');
  const twoBlocks=new Uint8Array(16);twoBlocks.set(dxt1);twoBlocks.set(transparent,8);
  const edge=Texture.decode(twoBlocks,5,3,Texture.DXT1);
  assert.strictEqual(edge.length,60);
  for(let y=0;y<3;y++)assert.deepStrictEqual(Array.from(edge.slice((y*5+4)*4,(y*5+5)*4)),[0,0,0,0]);
  const {exports:e}=await bootRenderHarness({fonts:'none',extraWat:`
    (func (export "new_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "texture") (param $d i32) (param $w i32) (param $h i32) (param $levels i32) (param $out i32) (param $format i32) (result i32)
      (call $d3d9_texture_create (local.get $d) (local.get $w) (local.get $h) (local.get $levels)
        (i32.const 0) (select (local.get $format) (i32.const 21) (local.get $format))
        (i32.const 1) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "lock") (param $t i32) (param $level i32) (param $out i32) (param $rect i32) (result i32)
      (call $d3d9_texture_lock (local.get $t) (local.get $level) (local.get $out) (local.get $rect) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "unlock") (param $t i32) (param $level i32) (result i32)
      (call $handle_IDirect3DTexture9_UnlockRect (local.get $t) (local.get $level) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "desc") (param $t i32) (param $level i32) (param $out i32) (result i32)
      (call $d3d9_texture_desc (local.get $t) (local.get $level) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "release_texture") (param $t i32) (result i32)
      (call $handle_IDirect3DTexture9_Release (local.get $t) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "surface") (param $t i32) (param $level i32) (param $out i32) (result i32)
      (call $d3d9_texture_surface (local.get $t) (local.get $level) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "release_surface") (param $s i32) (result i32)
      (call $d3d9_texture_surface_release (local.get $s)))
    (func (export "surface_lock") (param $s i32) (param $out i32) (result i32)
      (call $handle_IDirect3DSurface9_LockRect (local.get $s) (local.get $out) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "surface_unlock") (param $s i32) (result i32)
      (call $d3d9_texture_surface_unlock (local.get $s)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "volume_create") (param $d i32) (param $w i32) (param $h i32) (param $depth i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 21))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (i32.const 1))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateVolumeTexture (local.get $d) (local.get $w)
        (local.get $h) (local.get $depth) (i32.const 1) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "check_format") (param $usage i32) (param $rtype i32) (param $format i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $rtype))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $format))
      (call $handle_IDirect3D9_CheckDeviceFormat (i32.const 0) (i32.const 0)
        (i32.const 1) (i32.const 22) (local.get $usage) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "avail_texture_mem") (param $d i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DDevice9_GetAvailableTextureMem (local.get $d) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  `});
  e.init_dx_com_thunks();
  const d=e.new_device(),out=0x00409000,locked=out+128,desc=out+256,rect=out+512;
  assert.strictEqual(e.texture(d,8,4,0,out),0);
  const t=e.guest_read32(out)>>>0;
  assert.ok(e.guest_read32(t)); assert.strictEqual(e.guest_read32(t+32),4);
  let original;
  for(const [level,[w,h]] of [[8,4],[4,2],[2,1],[1,1]].entries()) {
    e.guest_write32(desc-4,0xdeadbeef);e.guest_write32(desc+32,0xdeadbeef);
    assert.strictEqual(e.desc(t,level,desc),0);
    assert.strictEqual(e.guest_read32(desc),21);assert.strictEqual(e.guest_read32(desc+4),1);
    assert.strictEqual(e.guest_read32(desc+24),w);assert.strictEqual(e.guest_read32(desc+28),h);
    assert.strictEqual(e.guest_read32(desc-4)>>>0,0xdeadbeef);assert.strictEqual(e.guest_read32(desc+32)>>>0,0xdeadbeef);
    assert.strictEqual(e.lock(t,level,locked,0),0);assert.strictEqual(e.guest_read32(locked),w*4);
    const bits=e.guest_read32(locked+4)>>>0;if(!level)original=bits;
    e.guest_write32(bits,0xff123456+level);
    assert.strictEqual(e.lock(t,level,locked,0)>>>0,0x8876086c,'nested lock fails');
    assert.strictEqual(e.unlock(t,level),0);assert.strictEqual(e.unlock(t,level)>>>0,0x8876086c);
  }
  [2,1,5,3].forEach((v,i)=>e.guest_write32(rect+i*4,v));
  assert.strictEqual(e.lock(t,0,locked,rect),0);
  assert.strictEqual(e.guest_read32(locked),32);
  assert.strictEqual(e.guest_read32(locked+4)>>>0,original+40);
  assert.strictEqual(e.unlock(t,0),0);
  e.guest_write32(rect,0xffffffff);assert.strictEqual(e.lock(t,0,locked,rect)>>>0,0x8876086c);
  assert.strictEqual(e.lock(t,4,locked,0)>>>0,0x8876086c);
  assert.strictEqual(e.texture(d,0,4,0,out)>>>0,0x8876086c);
  assert.strictEqual(e.texture(d,2049,4,0,out)>>>0,0x8876086c);
  assert.strictEqual(e.texture(d,8,4,5,out)>>>0,0x8876086c);
  assert.strictEqual(e.surface(t,0,out),0);const surface=e.guest_read32(out)>>>0;
  assert.strictEqual(e.surface(t,0,out),0);assert.strictEqual(e.guest_read32(out)>>>0,surface);
  assert.strictEqual(e.release_surface(surface),1);
  assert.strictEqual(e.surface_lock(surface,locked),0);
  assert.strictEqual(e.guest_read32(locked+4)>>>0,original,'surface aliases texture pixels');
  assert.strictEqual(e.lock(t,0,locked,0)>>>0,0x8876086c,'surface shares parent lock state');
  assert.strictEqual(e.surface_unlock(surface),0);
  assert.strictEqual(e.release_texture(t),1,'surface retains parent texture');
  assert.strictEqual(e.surface_lock(surface,locked),0,'parent survives original texture release');
  assert.strictEqual(e.surface_unlock(surface),0);
  assert.strictEqual(e.release_surface(surface),0);
  // A8L8 is two bytes per texel, so its pitch and lock offsets are half the
  // four-byte default every other uncompressed format uses.
  assert.strictEqual(e.texture(d,8,4,1,out,51),0);
  const a8l8=e.guest_read32(out)>>>0;
  assert.strictEqual(e.desc(a8l8,0,desc),0);assert.strictEqual(e.guest_read32(desc),51);
  assert.strictEqual(e.lock(a8l8,0,locked,0),0);assert.strictEqual(e.guest_read32(locked),16);
  const a8l8base=e.guest_read32(locked+4)>>>0;
  assert.strictEqual(e.guest_read32(a8l8+64+12),16*4);
  assert.strictEqual(e.unlock(a8l8,0),0);
  [3,1,8,4].forEach((v,i)=>e.guest_write32(rect+i*4,v));
  assert.strictEqual(e.lock(a8l8,0,locked,rect),0);
  assert.strictEqual(e.guest_read32(locked+4)>>>0,a8l8base+16+6);
  assert.strictEqual(e.unlock(a8l8,0),0);
  assert.strictEqual(e.release_texture(a8l8),0);
  // L8 (one byte) and L16 (two) are the rest of the luminance family. B&W2's
  // land asks for L16 first and L8 next, and a texture it cannot create is a
  // slot it leaves NULL and then calls through.
  for(const [format,texel] of [[50,1],[81,2],[23,2],[20,3],[63,4]]) {
    assert.strictEqual(e.texture(d,8,4,1,out,format),0);
    const lum=e.guest_read32(out)>>>0;
    assert.strictEqual(e.desc(lum,0,desc),0);assert.strictEqual(e.guest_read32(desc),format);
    assert.strictEqual(e.lock(lum,0,locked,0),0);
    assert.strictEqual(e.guest_read32(locked),8*texel,'pitch is width times the texel width');
    const base=e.guest_read32(locked+4)>>>0;
    assert.strictEqual(e.guest_read32(lum+64+12),8*texel*4,'level 0 is pitch times height');
    assert.strictEqual(e.unlock(lum,0),0);
    [3,1,8,4].forEach((v,i)=>e.guest_write32(rect+i*4,v));
    assert.strictEqual(e.lock(lum,0,locked,rect),0);
    assert.strictEqual(e.guest_read32(locked+4)>>>0,base+8*texel+3*texel,'subrect offset scales with the texel');
    assert.strictEqual(e.unlock(lum,0),0);
    assert.strictEqual(e.release_texture(lum),0);
  }
  // A format we cannot store must be refused, and CheckDeviceFormat has to say
  // so first: a yes there followed by a refusal here is what left the slot NULL.
  assert.strictEqual(e.texture(d,512,512,0,out,63),0,'.kkrieger full signed mip chain');
  const signedTexture=e.guest_read32(out)>>>0;
  for(let level=0;level<10;level++) {
    const width=512>>level;
    assert.strictEqual(e.desc(signedTexture,level,desc),0);
    assert.strictEqual(e.guest_read32(desc),63);
    assert.strictEqual(e.lock(signedTexture,level,locked,0),0);
    assert.strictEqual(e.guest_read32(locked),width*4);
    const bits=e.guest_read32(locked+4)>>>0;
    e.guest_write32(bits,0x807f0081);assert.strictEqual(e.guest_read32(bits)>>>0,0x807f0081);
    assert.strictEqual(e.unlock(signedTexture,level),0);
  }
  assert.strictEqual(e.release_texture(signedTexture),0);
  assert.strictEqual(e.texture(d,8,4,1,out,41)>>>0,0x8876086c,'P8 is not stored');
  for(const format of [20,21,22,23,50,51,62,63,81,Texture.DXT1,Texture.DXT3,Texture.DXT5])
    assert.strictEqual(e.check_format(0,3,format),0,`CheckDeviceFormat accepts ${format}`);
  for(const format of [41,52,77]) // P8, A4L4, D3DFMT_D24X8
    assert.strictEqual(e.check_format(0,3,format)>>>0,0x8876086a,`CheckDeviceFormat refuses ${format}`);
  assert.strictEqual(e.get_esp(),0x00300020,'CheckDeviceFormat pops seven args');
  // A volume texture with a zero extent is refused the way real D3D9 refuses
  // it, not trapped: B&W2's land loader asks d3dx9 for a 0x0x0 one and reads
  // the HRESULT. Anything we could actually honour still crashes loudly.
  for(const [w,h,depth] of [[0,4,4],[4,0,4],[4,4,0]]) {
    e.guest_write32(out,0xdeadbeef);
    assert.strictEqual(e.volume_create(d,w,h,depth,out)>>>0,0x8876086c);
    assert.strictEqual(e.guest_read32(out)>>>0,0,'a refused create clears the out pointer');
    assert.strictEqual(e.get_esp(),0x0030002c,'CreateVolumeTexture pops ten args');
  }
  assert.strictEqual(e.volume_create(d,4,4,4,0)>>>0,0x8876086c,'no out pointer is refused too');
  assert.strictEqual(e.check_format(0,1,77),0,'other resource types keep the permissive answer');
  assert.strictEqual(e.check_format(1,3,77),0,'a usage query is not a plain texture query');
  for(const [format,blockBytes] of [[Texture.DXT1,8],[Texture.DXT3,16],[Texture.DXT5,16]]){
    assert.strictEqual(e.texture(d,8,8,0,out,format),0);const compressed=e.guest_read32(out)>>>0;
    let base;
    for(let level=0;level<4;level++){
      const size=8>>>level,pitch=Math.ceil(size/4)*blockBytes;
      assert.strictEqual(e.desc(compressed,level,desc),0);assert.strictEqual(e.guest_read32(desc),format);
      assert.strictEqual(e.lock(compressed,level,locked,0),0);assert.strictEqual(e.guest_read32(locked),pitch);
      const bits=e.guest_read32(locked+4)>>>0;if(level===0)base=bits;
      const mip=compressed+64+level*32;
      assert.strictEqual(e.guest_read32(mip+12),pitch*Math.ceil(size/4));
      e.guest_write32(bits,0x12345678+level);
      assert.strictEqual(e.unlock(compressed,level),0);
    }
    [4,4,8,8].forEach((v,i)=>e.guest_write32(rect+i*4,v));
    assert.strictEqual(e.lock(compressed,0,locked,rect),0);
    assert.strictEqual(e.guest_read32(locked+4)>>>0,base+3*blockBytes);
    assert.strictEqual(e.unlock(compressed,0),0);
    e.guest_write32(rect,1);assert.strictEqual(e.lock(compressed,0,locked,rect)>>>0,0x8876086c);
    assert.strictEqual(e.texture(d,6,8,1,out,format)>>>0,0x8876086c);
    assert.strictEqual(e.release_texture(compressed),0);
  }
  // Textures live in guest memory, so the honest answer is what the sparse
  // backing pool can still commit, at the megabyte granularity a real driver
  // reports. Returning 0 tells an engine that budgets its streaming from this
  // call that there is no texture memory at all.
  const availMem=e.avail_texture_mem(d)>>>0;
  assert.strictEqual(e.get_esp(),0x00300008);
  assert.strictEqual(availMem&0xfffff,0,'reported in whole megabytes');
  assert.ok(availMem>0&&availMem<=REGIONS.VIRTUAL_BACKING_BASE.size,`implausible texture memory ${availMem}`);
  console.log('PASS D3D9 mip allocation, lock bounds, surface identity/aliasing and parent lifetime');
})().catch(error=>{console.error(error);process.exitCode=1;});
