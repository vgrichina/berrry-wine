#!/usr/bin/env node

'use strict';

// Production WAT instances and GPU command owner, with a deterministic device
// test double. This tests routing/order/readback, not WebGL raster accuracy.
const assert = require('assert');
const { D3DIMGpu } = require('../lib/d3dim-gpu');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_worker_seed")
      (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $device_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_D3DDEV3 (local.get $device_vtbl)))

  (func (export "test_worker_create_surface")
      (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw
      (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_worker_create_device")
      (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device
      (i32.const 0) (local.get $surface) (local.get $out)
      (global.get $DX_VTBL_D3DDEV3))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_worker_surface_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))

  (func (export "test_worker_surface_pitch") (param $surface i32) (result i32)
    (i32.load16_u offset=18 (call $dx_from_this (local.get $surface))))

  (func (export "test_worker_device_state") (param $device i32) (result i32)
    (call $d3ddev_state (local.get $device)))

  (func (export "test_worker_draw_normal")
      (param $device i32) (param $vertices i32) (param $count i32)
    (call $d3dim_draw_primitive
      (local.get $device) (i32.const 4) (i32.const 3)
      (local.get $vertices) (local.get $count)))

  (func (export "test_worker_draw_indexed")
      (param $device i32) (param $vertices i32) (param $count i32)
      (param $indices i32) (param $index_count i32)
    (call $d3dim_draw_indexed_primitive
      (local.get $device) (i32.const 4) (i32.const 3)
      (local.get $vertices) (local.get $count)
      (local.get $indices) (local.get $index_count)))

  (func (export "test_clear") (param $device i32) (param $color i32)
    (call $d3dim_device7_clear (local.get $device) (i32.const 1)
      (local.get $color) (f32.const 1)))
  (func (export "test_lock") (param $surface i32) (param $desc i32)
    (call $handle_IDirectDrawSurface_Lock (local.get $surface) (i32.const 0)
      (local.get $desc) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_unlock") (param $surface i32)
    (call $handle_IDirectDrawSurface_Unlock (local.get $surface) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_break_barrier")
    (global.set $d3dim_gpu_cooperative (i32.const 0)))
  (func (export "test_worker_fence") (call $d3dim_worker_fence))
`;

function writeFloat(wat, address, value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, value, true);
  wat.guest_write32(address, view.getUint32(0, true));
}

function createSurface(wat, desc, out, width, height) {
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007); // CAPS|HEIGHT|WIDTH|PIXELFORMAT
  wat.guest_write32(desc + 8, height);
  wat.guest_write32(desc + 12, width);
  wat.guest_write32(desc + 72, 32);
  wat.guest_write32(desc + 76, 0x40); // DDPF_RGB
  wat.guest_write32(desc + 84, 32);
  wat.guest_write32(desc + 88, 0x00ff0000);
  wat.guest_write32(desc + 92, 0x0000ff00);
  wat.guest_write32(desc + 96, 0x000000ff);
  wat.guest_write32(desc + 104, 0x40);
  assert.strictEqual(wat.test_worker_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

function writeVertex(wat, address, x, y, color) {
  writeFloat(wat, address, x);
  writeFloat(wat, address + 4, y);
  writeFloat(wat, address + 8, 0.5);
  writeFloat(wat, address + 12, 1.0);
  wat.guest_write32(address + 16, color >>> 0);
  wat.guest_write32(address + 20, 0);
  writeFloat(wat, address + 24, 0);
  writeFloat(wat, address + 28, 0);
}


(async () => {
  const a = await bootRenderHarness({extraWat, fonts: 'none'});
  const b = await bootRenderHarness({extraWat, fonts: 'none', memory: a.memory});
  const main = a.exports, secondary = b.exports;
  secondary.init_thread(1, main.get_image_base(), main.get_code_start(), main.get_code_end(),
    main.get_thunk_base(), main.get_thunk_end(), main.get_num_thunks(), main.get_rsrc_rva());
  main.test_worker_seed(0x51000000, 0x52000000, 0x53000000);
  const desc = 0x410000, out = 0x410100, vertices = 0x411000;
  const surface = createSurface(main, desc, out, 16, 16);
  assert.equal(main.test_worker_create_device(surface, out + 4), 0);
  const device = main.guest_read32(out + 4) >>> 0;
  const dib = main.test_worker_surface_dib(surface) >>> 0;
  const pitch = main.test_worker_surface_pitch(surface) >>> 0;
  const bytes = new Uint8Array(a.memory.buffer, dib, pitch * 16);
  const calls = [], events = [], descriptions = [];
  const exportsFor = (ex, id) => ({...ex, d3dim_gpu_describe(self) {
    const address = ex.d3dim_gpu_describe(self);
    descriptions.push([id, address]);
    return address;
  }});
  const mainExports = exportsFor(main, 0), secondaryExports = exportsFor(secondary, 1);
  const gpu = new D3DIMGpu({getMemory: () => a.memory.buffer,
    getExports: () => mainExports, createCanvas: () => { throw Error('unexpected device creation'); },
    asyncFlip: true, boundedReadback: false});
  a.hostCtx.d3dCommands = {call: (...args) => gpu.callForExports(mainExports, ...args)};
  b.hostCtx.d3dCommands = {call: (...args) => {
    calls.push(args[0]);
    return gpu.callForExports(process.argv.includes('--negative-caller') ? mainExports : secondaryExports, ...args);
  }};
  main.d3dim_gpu_enable(1);
  gpu.attachCooperative(secondaryExports);
  assert.equal(gpu.asyncFlip, false, 'second instance retires async Flip ownership');
  // Seed a device test double at the real production descriptor's target key.
  // The executor still lowers/copies draws, performs clear and fence logic,
  // converts pixels, and invokes the calling WASM instance's exports.
  gpu._view();
  const description = gpu._describe(device);
  let rgba = [0, 0, 0, 255];
  const paint = color => { rgba = [(color >>> 16) & 255, (color >>> 8) & 255, color & 255, 255]; };
  const target = {rt: description.rt, dib, width: 16, height: 16, pitch, bpp: 32,
    format: description.format, check: false, textureKeys: new Set(), device: {
      draw(draw) {
        const data = new DataView(draw.vertices.buffer, draw.vertices.byteOffset);
        const color = data.getUint32(16, true);
        events.push(['draw', color]); paint(color);
      },
      clear(color) { events.push(['clear']); rgba = color.map(v => Math.round(v * 255)); },
      releaseTextures() {},
      gpu: {
        updateColorResource(_resource, pixels) { events.push(['upload']); rgba = Array.from(pixels.slice(0, 4)); },
        bindImplicitTarget() {}, gl: {RGBA: 1, UNSIGNED_BYTE: 2,
          readPixels(x, y, w, h, format, type, pixels) {
            events.push(['read']);
            for (let i = 0; i < pixels.length; i += 4) pixels.set(rgba, i);
          },
        },
      },
    }};
  gpu.targets.set(description.rt, target);
  const draw = (ex, color) => {
    writeVertex(ex, vertices, 2, 2, color);
    writeVertex(ex, vertices + 32, 13, 2, color);
    writeVertex(ex, vertices + 64, 2, 13, color);
    ex.test_worker_draw_normal(device, vertices, 3);
  };
  const pixel = () => Array.from(bytes.slice(0, 3));
  bytes.fill(0);
  descriptions.length = 0;
  draw(secondary, 0xffff0000);
  assert(calls.includes(0x20000), 'secondary draw must reach GPU import');
  assert(descriptions.some(([id]) => id === 1), 'secondary draw must describe with caller exports');
  assert.deepEqual(pixel(), [0, 0, 0], 'accepted GPU draw remains deferred in guest DIB');
  if (process.argv.includes('--negative-barrier')) main.test_break_barrier();
  main.test_lock(surface, desc);
  assert.deepEqual(pixel(), [0, 0, 255], 'main Lock must read secondary GPU pixels despite no local pending draw');
  main.test_unlock(surface);

  draw(main, 0xff00ff00);
  draw(secondary, 0xff0000ff); // deferred and shares one target
  writeVertex(secondary, vertices, 2, 2, 0xffabcdef); // reuse guest scratch
  secondary.test_lock(surface, desc);
  assert.deepEqual(pixel(), [255, 0, 0], 'cross-instance draw order and copied vertices survive scratch reuse');
  secondary.test_unlock(surface);
  assert.equal(gpu.targets.size, 1, 'threads share target ownership');
  const byThread = [0, 1].map(id => descriptions.find(item => item[0] === id)?.[1]);
  assert(byThread.every(Boolean) && byThread[0] !== byThread[1], 'descriptor scratch belongs to each caller');

  secondary.test_clear(device, 0xff123456);
  main.test_lock(surface, desc);
  assert.deepEqual(pixel(), [0x56, 0x34, 0x12], 'main Lock observes secondary clear');
  // CPU writes after readback must upload before another thread draws.
  bytes[0] = 0x77;
  main.test_unlock(surface);
  draw(secondary, 0xff998877);
  assert(events.some(([type]) => type === 'upload'), 'CPU ownership transition triggers upload');
  main.test_worker_fence();
  assert.deepEqual(pixel(), [0x77, 0x88, 0x99], 'global barrier sees foreign draw');

  const savedDraw = gpu._draw;
  gpu._draw = () => { throw Error('injected caller failure'); };
  assert.throws(() => gpu.callForExports(secondaryExports, 0x20000, 0), /injected caller failure/);
  assert.equal(gpu.getExports(), mainExports, 'exception restores default caller');
  gpu._draw = savedDraw;

  // Context creation unavailable: actual production WAT software rasterizer
  // must still execute, with no accepted GPU draw or invented success.
  const fallback = new D3DIMGpu({getMemory: () => a.memory.buffer,
    getExports: () => mainExports, createCanvas: () => { throw Error('no WebGL'); },
    onError: () => {}});
  b.hostCtx.d3dCommands = {call: (...args) => fallback.callForExports(secondaryExports, ...args)};
  bytes.fill(0);
  draw(secondary, 0xffabcdef);
  assert(fallback.unavailable && fallback.stats.draws === 0);
  assert(bytes.some(byte => byte !== 0), 'declined GPU draw really rasterizes in WAT');
  console.log('PASS cooperative D3DIM caller routing, shared draw/clear/Lock, scratch lifetime and fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });

