#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { createHostImports } = require('../lib/host-imports');
const { Canvas } = require('../lib/canvas-compat');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
(async () => {
  const { exports: guest, memory, module } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "origin_create") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $pp))
      (call $gs32 (i32.const 0x074ff01c) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 65541) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "origin_target") (param $device i32) (result i32)
      (call $d3ddev_rt_entry (local.get $device)))
  ` });
  guest.d3dim_worker_init(0x400000); guest.init_dx_com_thunks();
  guest.test_wnd_table_set(65541, 0);
  const imports = { memory };
  for (const name of Object.keys(sigs)) if (name !== 'memory') imports[name] = () => 0;
  const page = new WebAssembly.Instance(module, { host: imports }).exports;
  const render = new WebAssembly.Instance(module, { host: imports }).exports;
  assert.strictEqual(page.get_main_hwnd(), 0, 'page instance has no guest-local window');
  const pp = guest.guest_alloc(64), out = guest.guest_alloc(4);
  function create(windowed) {
    const words = [64, 60, 22, 1, 0, 0, 1, 65541, windowed];
    new Uint8Array(memory.buffer, guest.guest_to_wasm(pp), 64).fill(0);
    words.forEach((v, i) => guest.guest_write32(pp + 4 * i, v));
    assert.strictEqual(guest.origin_create(pp, out), 0, 'real CreateDevice succeeds');
  }
  create(1);
  assert.strictEqual(guest.get_d3d9_windowed_hwnd(), 65541);
  assert.strictEqual(page.get_dx_present_hwnd(), 65541, 'shared cooperative window reaches page');
  assert.strictEqual(page.get_d3d9_windowed_hwnd(), 65541,
    'page must read guest-owned windowed state across instances despite local main HWND 0');
  assert.strictEqual(render.get_d3d9_windowed_hwnd(), 65541, 'render worker shares authoritative state');
  const win = { x: 20, y: 20, w: 72, h: 88 };
  const canvas = new Canvas(100, 110);
  const renderer = { windows: { 65541: win }, getWindowCanvas: () => ({ ctx: canvas.getContext('2d') }),
    _computeClientRect: w => { w.clientRect = { x: 24, y: 44, w: 64, h: 60 }; }, scheduleRepaint() {} };
  // The page getter is the actual separate WASM instance. Only geometry is
  // supplied here, since this unit harness has no guest-created WND_RECORDS.
  const ctx = { getMemory: () => memory.buffer, renderer, exports: {
    ...page, wnd_client_screen_x: () => 24, wnd_client_screen_y: () => 44,
  } };
  const { gdi } = createHostImports(ctx);
  const target = guest.origin_target(guest.guest_read32(out));
  const bits = new DataView(memory.buffer).getUint32(target + 20, true);
  const pixels = new Uint32Array(memory.buffer, bits, 64 * 60);
  pixels.fill(0xff123456);
  pixels[0] = 0xffabcdef;
  pixels[pixels.length - 1] = 0xff987654;
  assert.strictEqual(gdi.presentBestDxOffscreen(true), 1);
  const pixel = (x,y) => Array.from(win._dxFrameLayer.canvas.getContext('2d').getImageData(x,y,1,1).data);
  assert.deepStrictEqual(pixel(4,24), [0xab,0xcd,0xef,255], 'surface (0,0) survives at client top left');
  assert.deepStrictEqual(pixel(67,83), [0x98,0x76,0x54,255], 'last row and column survive');
  assert.strictEqual(pixel(0,0)[3], 0, 'chrome stays transparent');
  create(0);
  assert.strictEqual(page.get_d3d9_windowed_hwnd(), 0, 'fullscreen clears shared client-relative state');
  assert.strictEqual(render.get_d3d9_windowed_hwnd(), 0, 'fullscreen reaches existing render instance');
  console.log('PASS real CreateDevice shared windowed origin across guest/page/render instances; fullscreen clears it');
})().catch(e => { console.error(e); process.exitCode = 1; });
