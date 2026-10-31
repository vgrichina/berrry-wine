#!/usr/bin/env node
'use strict';

// IDirect3DVertexBuffer::ProcessVertices transforms and lights vertices out of
// a source buffer INTO this one, and the caller then draws from this buffer
// with the transform already applied. Half-Life's Direct3D renderer batches
// every frame that way, so a stub that returns S_OK without doing the work
// leaves the destination as the zeros CreateVertexBuffer wrote and collapses
// the frame to a single point.
//
// This pins the arithmetic against the viewport the device state actually
// holds -- with an identity composite the projected position is exactly
// origin +/- position * scale -- plus the two properties a batch renderer
// depends on: colour and texture coordinates ride through untouched, and a
// count past the end of either buffer is clamped rather than walked off.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
// Resolve test dispatch IDs without adding long test-only names to the
// production WAT string pool; the production dispatch itself stays exercised.
const processId = version => apis.find(a => a.name ===
  `IDirect3DVertexBuffer${version}_ProcessVertices`).id;

const FVF_XYZ = 0x002;
const FVF_XYZRHW = 0x004;
const FVF_DIFFUSE = 0x040;
const FVF_SPECULAR = 0x080;
const FVF_TEX1 = 0x100;
const SRC_FVF = FVF_XYZ | FVF_DIFFUSE | FVF_TEX1;          // 24-byte source
const DST_FVF = FVF_XYZRHW | FVF_DIFFUSE | FVF_SPECULAR | FVF_TEX1; // 32-byte

const extraWat = String.raw`
  (func (export "pv_create_device") (result i32)
    (local $obj i32) (local $entry i32) (local $state i32)
    (local.set $obj
      (call $dx_create_com_obj (i32.const 20) (i32.const 0x53000000)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $state (call $heap_alloc (i32.const 4096)))
    (call $d3ddev_init_state (local.get $state))
    (i32.store offset=16 (local.get $entry) (local.get $state))
    (local.get $obj))

  (func (export "pv_create_vb") (param $desc i32) (param $ppvb i32) (result i32)
    (call $d3dim_create_vb (local.get $desc) (local.get $ppvb) (i32.const 0x53000100))
    (i32.load offset=0 (global.get $reg_base)))

  ;; The backing store $d3dim_create_vb allocated, so the test can seed the
  ;; source and read the destination the way a Lock caller would.
  (func (export "pv_vb_data") (param $vb i32) (result i32)
    (load.field DxObject misc0 (call $dx_from_this (local.get $vb))))

  (func (export "pv_vb_size") (param $vb i32) (result i32)
    (i32.load offset=12 (call $dx_from_this (local.get $vb))))

  ;; The viewport the projection lands in, read out of the device state rather
  ;; than assumed, so the expected screen position is computed from what the
  ;; device holds.
  (func (export "pv_set_viewport") (param $device i32) (param $vp i32)
    (call $d3dim_device7_set_viewport (local.get $device) (local.get $vp)))

  (func (export "pv_viewport") (param $device i32) (param $out i32)
    (local $sw i32)
    (local.set $sw (call $g2w (call $d3ddev_state (local.get $device))))
    (call $memcpy (call $g2w (local.get $out))
      (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN)) (i32.const 8))
    (call $memcpy (i32.add (call $g2w (local.get $out)) (i32.const 8))
      (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE)) (i32.const 8)))

  (func (export "pv_process")
      (param $dst i32) (param $op i32) (param $destIndex i32) (param $count i32)
      (param $src i32) (param $srcIndex i32) (param $device i32) (param $flags i32)
      (result i32)
    (call $d3dim_vb_process_vertices
      (local.get $dst) (local.get $op) (local.get $destIndex) (local.get $count)
      (local.get $src) (local.get $srcIndex) (local.get $device) (local.get $flags)))

  ;; The stdcall route: three of the eight arguments only exist on the guest
  ;; stack, and the handler owns the pop.
  (func (export "pv_process_stdcall")
      (param $version i32)
      (param $dst i32) (param $op i32) (param $destIndex i32) (param $count i32)
      (param $src i32) (param $srcIndex i32) (param $device i32) (param $flags i32)
      (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $gs32 (i32.const 0x00300018) (local.get $srcIndex))
    (call $gs32 (i32.const 0x0030001C) (local.get $device))
    (call $gs32 (i32.const 0x00300020) (local.get $flags))
    (call $dispatch_api_table
      (select (i32.const ${processId('7')})
              (i32.const ${processId('')}) (local.get $version))
      (local.get $dst) (local.get $op) (local.get $destIndex)
      (local.get $count) (local.get $src) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "pv_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });

  const writeF32 = (addr, value) => {
    const bits = new DataView(new ArrayBuffer(4));
    bits.setFloat32(0, value, true);
    wat.guest_write32(addr, bits.getUint32(0, true));
  };
  const readF32 = (addr) => {
    const bits = new DataView(new ArrayBuffer(4));
    bits.setUint32(0, wat.guest_read32(addr) >>> 0, true);
    return bits.getFloat32(0, true);
  };

  const device = wat.pv_create_device() >>> 0;
  assert(device, 'created a state-backed legacy Direct3D device');

  // Two D3DVERTEXBUFFERDESCs: {dwSize, dwCaps, dwFVF, dwNumVertices}.
  const srcDesc = 0x00320000;
  const dstDesc = 0x00320020;
  const ppvb = 0x00320040;
  const VERTS = 4;
  for (const [desc, fvf] of [[srcDesc, SRC_FVF], [dstDesc, DST_FVF]]) {
    wat.guest_write32(desc, 16);
    wat.guest_write32(desc + 4, 0);
    wat.guest_write32(desc + 8, fvf);
    wat.guest_write32(desc + 12, VERTS);
  }

  assert.strictEqual(wat.pv_create_vb(srcDesc, ppvb) >>> 0, 0, 'source buffer created');
  const srcVb = wat.guest_read32(ppvb) >>> 0;
  assert.strictEqual(wat.pv_create_vb(dstDesc, ppvb) >>> 0, 0, 'destination buffer created');
  const dstVb = wat.guest_read32(ppvb) >>> 0;
  assert(srcVb && dstVb, 'both vertex buffers published pointers');

  const srcData = wat.pv_vb_data(srcVb) >>> 0;
  const dstData = wat.pv_vb_data(dstVb) >>> 0;
  assert.strictEqual(wat.pv_vb_size(srcVb) >>> 0, 24 * VERTS, 'source sized from its FVF');
  assert.strictEqual(wat.pv_vb_size(dstVb) >>> 0, 32 * VERTS, 'destination sized from its FVF');

  // Seed the source the way a Lock caller would: XYZ, diffuse, one UV pair.
  const source = [
    { x: 1, y: 2, z: 3, color: 0x11223344, u: 0.25, v: 0.75 },
    { x: -1, y: 0.5, z: 2, color: 0x55667788, u: 0.5, v: 0.125 },
    { x: 4, y: -3, z: 1, color: 0x99aabbcc, u: 0, v: 1 },
    { x: 0, y: 0, z: 5, color: 0xddeeff00, u: 1, v: 0 },
  ];
  source.forEach((vertex, i) => {
    const at = srcData + i * 24;
    writeF32(at, vertex.x);
    writeF32(at + 4, vertex.y);
    writeF32(at + 8, vertex.z);
    wat.guest_write32(at + 12, vertex.color);
    writeF32(at + 16, vertex.u);
    writeF32(at + 20, vertex.v);
  });

  // The destination starts as the zeros CreateVertexBuffer wrote -- the state
  // the stub used to leave behind.
  for (let i = 0; i < 32 * VERTS; i += 4) {
    assert.strictEqual(wat.guest_read32(dstData + i) >>> 0, 0,
      'a fresh vertex buffer is zeroed');
  }

  // A real viewport, because the default one is all zeros -- every projected
  // position would then be (0,0) and an expectation computed the same way
  // would agree with it while proving nothing.
  const vp7 = 0x003200a0;
  wat.guest_write32(vp7, 0);
  wat.guest_write32(vp7 + 4, 0);
  wat.guest_write32(vp7 + 8, 640);
  wat.guest_write32(vp7 + 12, 480);
  writeF32(vp7 + 16, 0);
  writeF32(vp7 + 20, 1);
  wat.pv_set_viewport(device, vp7);

  const vp = 0x00320080;
  wat.pv_viewport(device, vp);
  const originX = readF32(vp);
  const originY = readF32(vp + 4);
  const scaleX = readF32(vp + 8);
  const scaleY = readF32(vp + 12);
  assert.strictEqual(originX, 320, 'the viewport we set is the one in force');
  assert.strictEqual(scaleX, 320, 'a zero scale would make every expectation vacuous');
  assert.strictEqual(originY, 240, 'viewport origin y');
  assert.strictEqual(scaleY, 240, 'viewport scale y');

  // D3DVOP_TRANSFORM|D3DVOP_LIGHT
  assert.strictEqual(wat.pv_process(dstVb, 0x401, 0, VERTS, srcVb, 0, device, 0) >>> 0, 0,
    'ProcessVertices reports success');

  const near = (actual, expected, what) => assert(
    Math.abs(actual - expected) < 1e-3,
    `${what}: expected ${expected}, got ${actual}`);

  source.forEach((vertex, i) => {
    const at = dstData + i * 32;
    // Identity composite: clip == position, w == 1, so the projection is
    // exactly the viewport mapping.
    near(readF32(at), originX + vertex.x * scaleX, `vertex ${i} screen x`);
    near(readF32(at + 4), originY - vertex.y * scaleY, `vertex ${i} screen y`);
    near(readF32(at + 8), vertex.z, `vertex ${i} depth`);
    near(readF32(at + 12), 1, `vertex ${i} rhw`);
    assert.strictEqual(wat.guest_read32(at + 16) >>> 0, vertex.color,
      `vertex ${i} carries its diffuse colour through`);
    near(readF32(at + 24), vertex.u, `vertex ${i} u`);
    near(readF32(at + 28), vertex.v, `vertex ${i} v`);
  });

  // Distinct source positions must stay distinct: a constant fill would pass
  // every check above that does not look at more than one vertex.
  assert.notStrictEqual(wat.guest_read32(dstData) >>> 0,
    wat.guest_read32(dstData + 32) >>> 0,
    'two different source positions project to two different screen positions');

  // A count past the end of the destination is clamped, not walked off. Ask
  // for all four vertices starting at index 3 and only that one may be written.
  for (let i = 0; i < 32 * VERTS; i += 4) wat.guest_write32(dstData + i, 0xcdcdcdcd);
  assert.strictEqual(wat.pv_process(dstVb, 0x401, 3, VERTS, srcVb, 0, device, 0) >>> 0, 0,
    'an over-long batch still succeeds');
  assert.notStrictEqual(wat.guest_read32(dstData + 96) >>> 0, 0xcdcdcdcd,
    'the one in-range vertex was written');
  for (let i = 0; i < 96; i += 4) {
    assert.strictEqual(wat.guest_read32(dstData + i) >>> 0, 0xcdcdcdcd,
      'vertices before the destination index are left alone');
  }

  // A source index past the end has nothing to read.
  assert.strictEqual(wat.pv_process(dstVb, 0x401, 0, 1, srcVb, VERTS, device, 0) >>> 0,
    0x80070057, 'a source index past the end is E_INVALIDARG');
  assert.strictEqual(wat.pv_process(dstVb, 0x401, 0, 1, 0, 0, device, 0) >>> 0,
    0x80004003, 'a NULL source buffer is E_POINTER');

  // The stdcall route reads dwSrcIndex/lpD3DDevice/dwFlags off the guest stack
  // and pops all eight arguments plus the return address.
  for (const version of [0, 1]) {
    for (let i = 0; i < 32 * VERTS; i += 4) wat.guest_write32(dstData + i, 0);
    assert.strictEqual(
      wat.pv_process_stdcall(version, dstVb, 0x401, 0, VERTS, srcVb, 0, device, 0) >>> 0, 0,
      'the COM entry point succeeds');
    assert.strictEqual(wat.pv_esp() >>> 0, 0x00300024,
      'ProcessVertices pops its return address and eight stdcall arguments');
    near(readF32(dstData), originX + source[0].x * scaleX,
      'the COM entry point transformed through the same path');
    assert.strictEqual(wat.guest_read32(dstData + 16 + 32) >>> 0, source[1].color,
      'the stack-resident device argument reached the transform');
  }

  // A larger call grows temporary storage; a later smaller call must consume
  // fresh source bytes rather than stale packed vertices from that call.
  for (const desc of [srcDesc, dstDesc]) wat.guest_write32(desc + 12, 80);
  assert.strictEqual(wat.pv_create_vb(srcDesc, ppvb) >>> 0, 0);
  const bigSrc = wat.guest_read32(ppvb) >>> 0;
  assert.strictEqual(wat.pv_create_vb(dstDesc, ppvb) >>> 0, 0);
  const bigDst = wat.guest_read32(ppvb) >>> 0;
  const bigData = wat.pv_vb_data(bigSrc) >>> 0;
  for (let i = 0; i < 80; i++) {
    writeF32(bigData + i * 24, 0.5);
    writeF32(bigData + i * 24 + 4, 0.25);
    writeF32(bigData + i * 24 + 8, 1);
    wat.guest_write32(bigData + i * 24 + 12, 0xff334455);
    writeF32(bigData + i * 24 + 16, i / 80);
  }
  assert.strictEqual(wat.pv_process(bigDst, 0x401, 0, 80, bigSrc, 0, device, 0), 0);
  const last = (wat.pv_vb_data(bigDst) >>> 0) + 79 * 32;
  near(readF32(last), originX + 0.5 * scaleX, 'grown batch last x');
  near(readF32(last + 24), 79 / 80, 'grown batch last u');
  for (let i = 0; i < 20; i++) {
    writeF32(srcData, i / 20);
    assert.strictEqual(wat.pv_process(dstVb, 0x401, 0, 1, srcVb, 0, device, 0), 0);
    near(readF32(dstData), originX + i / 20 * scaleX, 'reused storage reads fresh input');
  }

  // Overlapping source/destination ranges must snapshot all source vertices
  // before writing output, even when temporary storage is reused.
  writeF32(srcData, source[0].x);
  assert.strictEqual(wat.pv_process(srcVb, 0x401, 1, 3, srcVb, 0, device, 0), 0);
  for (let i = 0; i < 3; i++) {
    near(readF32(srcData + (i + 1) * 24), originX + source[i].x * scaleX,
      `overlapping transform vertex ${i}`);
  }

  console.log('test-d3dim-process-vertices: PASS');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
