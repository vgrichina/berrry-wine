#!/usr/bin/env node

'use strict';

// Production WAT instances on one shared memory, both driving the one shared
// WAT GPU stream producer (src/09abg-d3dim-gps.wat, its state under
// $D3DIM_GPS), drained into the real software executor
// (lib/gpu-stream-software.js). Tests routing, cross-instance order and
// readback through real D3DIM draw/clear/Lock handlers.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
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

  (func (export "test_worker_draw_normal")
      (param $device i32) (param $vertices i32) (param $count i32)
    (call $d3dim_draw_primitive
      (local.get $device) (i32.const 4) (i32.const 3)
      (local.get $vertices) (local.get $count)))

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

// Two instances on one memory. `consumer` false = no GPU stream consumer:
// the ring's open handshake fails and the producer stays in software.
async function pair(consumer) {
  const state = { gps: null, ring: null, ringAddr: 0, kicks: 0, hostCalls: [] };
  let memory = null, exports = null;
  const overrides = {
    gpu_gl_call: (...args) => { state.hostCalls.push(args[0]); return 0; },
    gpu_stream_kick: (r, mode) => {
      r >>>= 0; state.kicks++;
      if (!consumer) return 0;
      if (!state.gps) state.gps = new SoftwareExecutor({ getExports: () => exports, getMemory: () => memory.buffer });
      if (!state.ring || state.ringAddr !== r) { state.ring = new GS.Ring(() => memory.buffer, r); state.ringAddr = r; }
      GS.drain([state.ring], state.gps);
      if ((mode | 0) === GS.CONST.KICK_CLOSE) { state.gps.close(); state.gps = null; state.ring = null; state.ringAddr = 0; }
      return 1;
    },
  };
  const a = await bootRenderHarness({extraWat, fonts: 'none', extraHostOverrides: overrides});
  memory = a.memory; exports = a.exports;
  const b = await bootRenderHarness({extraWat, fonts: 'none', memory: a.memory, extraHostOverrides: overrides});
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
  const draw = (ex, color) => {
    writeVertex(ex, vertices, 2, 2, color);
    writeVertex(ex, vertices + 32, 13, 2, color);
    writeVertex(ex, vertices + 64, 2, 13, color);
    ex.test_worker_draw_normal(device, vertices, 3);
  };
  // (4,4) is inside every triangle drawn here; (0,0) is outside them all.
  const pixel = (x = 4, y = 4) => Array.from(bytes.slice(y * pitch + x * 4, y * pitch + x * 4 + 3));
  return {a, b, main, secondary, state, surface, device, dib, pitch, bytes, desc, vertices, draw, pixel};
}

(async () => {
  const p = await pair(true);
  const {main, secondary, state, surface, device, dib, bytes, desc, vertices, draw, pixel} = p;
  const stat = i => main.d3dim_gps_stat(i);

  // An instance drawing alone, then joining a cooperative owner: attaching
  // fences what it still owes, so its frame lands before a sibling shares
  // the chain.
  draw(main, 0xff112233);
  assert.equal(stat(0), 1, 'the producer took the draw');
  assert.deepEqual(pixel(), [0, 0, 0], 'accepted GPU draw remains deferred in guest DIB');
  let r = stat(2);
  main.d3dim_gpu_cooperative_enable();
  assert.equal(stat(2), r + 1, 'attachment reads the owed frame back');
  assert.deepEqual(pixel(), [0x33, 0x22, 0x11], 'old frame lands in its DIB before attachment returns');
  secondary.d3dim_gpu_cooperative_enable();

  bytes.fill(0);
  const draws = stat(0);
  draw(secondary, 0xffff0000);
  assert.equal(stat(0), draws + 1, 'secondary draw reaches the shared producer');
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
  const rts = [...state.gps.res.values()].filter(x => x.kind === GS.KIND.RT && x.width === 16);
  assert.equal(rts.length, 1, 'threads share one GPU colour target');

  secondary.test_clear(device, 0xff123456);
  main.test_lock(surface, desc);
  assert.deepEqual(pixel(), [0x56, 0x34, 0x12], 'main Lock observes secondary clear');
  assert.deepEqual(pixel(0, 0), [0x56, 0x34, 0x12]);
  // CPU writes after readback must upload before another thread draws.
  bytes[0] = 0x77;
  main.page_watch_write(dib, 1);
  const uploadsBefore = stat(4);
  main.test_unlock(surface);
  draw(secondary, 0xff998877);
  assert(stat(4) > uploadsBefore, 'CPU ownership transition triggers a new upload');
  main.test_worker_fence();
  assert.deepEqual(pixel(), [0x77, 0x88, 0x99], 'global barrier sees foreign draw');
  assert.deepEqual(pixel(0, 0), [0x77, 0x34, 0x12], 'the CPU write went up before the foreign draw');
  assert.deepEqual(state.hostCalls, [], 'no instance calls the host gpu_gl_call');
  assert(state.kicks > 0);

  // No GPU stream consumer: the WAT software rasterizer is retired, so the
  // draw fails fast (traps) rather than inventing success or drawing.
  const f = await pair(false);
  f.main.d3dim_gpu_cooperative_enable();
  f.secondary.d3dim_gpu_cooperative_enable();
  f.bytes.fill(0);
  assert.throws(() => f.draw(f.secondary, 0xffabcdef), WebAssembly.RuntimeError, 'a draw with no consumer traps');
  assert(f.state.kicks > 0, 'the producer tried to open its ring');
  assert.equal(f.main.d3dim_gps_stat(0), 0, 'no producer block, no GPU draw');
  assert.deepEqual(f.pixel(), [0, 0, 0], 'nothing is drawn');
  assert.deepEqual(f.state.hostCalls, [], 'and does not fall through to the host');
  console.log('PASS cooperative D3DIM: shared WAT producer, cross-instance draw/clear/Lock, scratch lifetime and no-consumer trap');
})().catch(error => { console.error(error); process.exitCode = 1; });
