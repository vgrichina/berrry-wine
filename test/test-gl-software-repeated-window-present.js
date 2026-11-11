#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-compat');

(async () => {
  // Exercise the shipped rasterizer, canonical GDI upload and real compositor.
  const module = new WebAssembly.Module(fs.readFileSync(process.env.WINE_TEST_WASM || 'build/wine-assembly.wasm'));
  const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none', width: 8, height: 8 });
  const { exports: e, memory, renderer, gdi } = h;
  const hwnd = 0x10001;
  e.wnd_table_set(hwnd, 0);
  e.ctrl_set_geom(hwnd, 0, 0, 8, 8);
  e.wnd_set_style_export(hwnd, 0x90000000);
  const win = renderer.windows[hwnd] = { hwnd, x: 0, y: 0, w: 8, h: 8,
    visible: true, style: 0x90000000, isChild: false, wasm: h.instance,
    clientRect: { x: 0, y: 0, w: 8, h: 8 } };
  renderer.zOrder = [hwnd];
  const stack = e.guest_to_wasm(e.guest_alloc(64));
  function call(name, values, floats = false) {
    new Uint32Array(memory.buffer, stack, 16).fill(0);
    const words = floats ? new Float32Array(memory.buffer, stack, 16) : new Uint32Array(memory.buffer, stack, 16);
    words.set(values, 1);
    e.gl_sw_observe(CALL_INDEX[name], stack);
  }
  e.gl_sw_set_enabled(1);
  e.gl_sw_set_default_size(8, 8);
  function frame(color) {
    call('glClearColor', color, true);
    call('glClear', [0x4000]);
    call('gpuPresent', []);
    assert.equal(e.gl_sw_present_window(hwnd), 1);
  }
  frame([1, 0, 0, 1]);
  const canonical = win._backCanvas;
  // A DirectDraw upload can occur between canonical uploads (the CLI's
  // present hook also uses this normal host path for the GL primary).
  assert(gdi.presentBestDxOffscreen(true));
  assert(win._dxFrameLayer, 'interleaved DirectDraw frame is attached');
  frame([0, 1, 0, 1]);
  assert.equal(win._backCanvas, canonical, 'window reuses its canonical canvas');
  renderer.repaint();
  const pixel = [...renderer.canvas.getContext('2d').getImageData(4, 4, 1, 1).data];
  assert.deepEqual(pixel, [0, 255, 0, 255], 'latest GL present must cover the older DirectDraw layer');
  console.log('PASS compiled repeated software GL window presentation', { pixel, presents: e.gl_sw_presents() });
})().catch(e => { console.error(e); process.exitCode = 1; });
