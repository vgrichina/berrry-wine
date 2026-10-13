#!/usr/bin/env node
'use strict';

// On Windows the GL drawable IS the window's client area. Resize the window and
// the next frame comes out at the new size, with no API call in between saying
// so -- the app just calls glViewport with its new client rect and draws.
//
// Our canvas was sized once, in createContext, and never again. Warcraft III is
// where that showed: its startup runs the whole GL setup twice, and between the
// two it does SW_MINIMIZE then SW_MAXIMIZE, so the client area it finally lays
// its menu out in is the desktop. Measured in the browser, the guest was calling
// glViewport(0, 0, 940, 734) into an 800x600 canvas. A viewport bigger than the
// drawable is CLIPPED, not scaled, so what reached the screen was the corner of
// the menu the old surface happened to cover -- and worse, every coordinate read
// off that picture was in the wrong space, so a click at the pixel where a
// button appeared went somewhere else entirely in the game's own layout.
//
// Both halves are checked here: the drawable follows the window, and it does so
// AFTER the frame is published, because resetRenderTargets reallocates the
// colour and depth attachments and doing that mid-frame throws away whatever the
// guest had already drawn.
const assert = require('assert');
const { OpenGLHostBridge, CALL_INDEX } = require('../lib/gl-compat');

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS  ${name}`); };

class Backend {
  constructor(width, height) {
    this.canvas = { width, height };
    this.presentation = { id: 'surface-0', width, height };
    this.resets = [];
    this.presents = 0;
    this.failNextReset = false;
  }
  getPresentationSurface() { return this.presentation; }
  present() { this.presents++; return this.presentation; }
  setCapability(cap, enabled) { this.stencilEnabled = [cap, enabled]; }
  resetRenderTargets(width, height, depth) {
    assert.deepStrictEqual(depth, {width,height,bits:24}, 'resized GL drawable retains depth/stencil storage');
    if (this.failNextReset) {
      this.failNextReset = false;
      // The real backend stages the new allocation and restores the old one on
      // failure, so the pixels survive. Model that: nothing changes.
      throw new Error('out of target memory');
    }
    this.resets.push([width, height]);
    this.canvas = { width, height };
    this.presentation = { id: `surface-${this.resets.length}`, width, height };
  }
}

function makeBridge(backend, win) {
  const bridge = new OpenGLHostBridge({
    getMemory: () => new ArrayBuffer(0x100),
    exports: { guest_to_wasm: pointer => pointer },
    renderer: { needsRepaint: false, repaint() {} },
  });
  const context = {
    handle: 1, hwnd: 0x10001, win, backend,
    frontend: { flushPendingDraw() {}, applyStencil() {}, enabled: new Set() },
    layer: { canvas: backend.getPresentationSurface(), backend, writeSeq: 0 },
  };
  bridge.contexts.set(1, context);
  bridge.current = 1;
  return { bridge, context };
}

check('a window that grew after createContext gets a drawable that grew with it', () => {
  const backend = new Backend(800, 600);
  // Exactly Warcraft III's shape: the context was made while the window was
  // 800x600 and the game then maximized itself to the desktop.
  const win = { w: 940, h: 734, clientRect: { x: 0, y: 0, w: 940, h: 734 } };
  const { bridge, context } = makeBridge(backend, win);

  assert.strictEqual(bridge.present(), 1);
  assert.strictEqual(backend.presents, 1,
    'the frame is published before anything is reallocated');
  assert.deepStrictEqual(backend.resets, [[940, 734]],
    'the drawable is resized to the window client area');
  assert.deepStrictEqual([backend.canvas.width, backend.canvas.height], [940, 734]);
  assert.strictEqual(context.layer.canvas, backend.getPresentationSurface(),
    'the composited layer points at the new presentation surface, not the freed one');

  // A steady window must not churn the attachments every frame.
  bridge.present();
  bridge.present();
  assert.deepStrictEqual(backend.resets, [[940, 734]],
    'no further reallocation while the window size is unchanged');
});

check('the resize follows the present, so the published frame is never discarded', () => {
  const backend = new Backend(800, 600);
  const win = { w: 1280, h: 872, clientRect: { x: 0, y: 0, w: 1280, h: 872 } };
  const order = [];
  const { bridge } = makeBridge(backend, win);
  backend.present = function () { order.push('present'); this.presents++; return this.presentation; };
  const reset = backend.resetRenderTargets.bind(backend);
  backend.resetRenderTargets = (w, h, depth) => { order.push('reset'); reset(w, h, depth); };

  bridge.present();
  assert.deepStrictEqual(order, ['present', 'reset'],
    'reallocating before the present would throw away the frame the guest drew');
});

check('a reallocation that fails keeps the old surface and retries next frame', () => {
  const backend = new Backend(800, 600);
  const win = { w: 940, h: 734, clientRect: { x: 0, y: 0, w: 940, h: 734 } };
  const { bridge, context } = makeBridge(backend, win);
  const before = context.layer.canvas;

  backend.failNextReset = true;
  assert.strictEqual(bridge.present(), 1, 'the frame is still published');
  assert.deepStrictEqual(backend.resets, [], 'nothing was reallocated');
  assert.deepStrictEqual([backend.canvas.width, backend.canvas.height], [800, 600],
    'the old drawable is still there');
  assert.strictEqual(context.layer.canvas, before,
    'the layer is not pointed at a surface that was never created');

  assert.strictEqual(bridge.present(), 1);
  assert.deepStrictEqual(backend.resets, [[940, 734]], 'the next frame tries again');
});

check('a window with no client rect falls back to the window size', () => {
  const backend = new Backend(320, 240);
  const { bridge } = makeBridge(backend, { w: 640, h: 480 });
  bridge.present();
  assert.deepStrictEqual(backend.resets, [[640, 480]]);
});

check('a backend without resetRenderTargets still presents', () => {
  const backend = new Backend(800, 600);
  delete backend.resetRenderTargets;
  const { bridge } = makeBridge(backend, { w: 940, h: 734, clientRect: { w: 940, h: 734 } });
  assert.strictEqual(bridge.present(), 1);
  assert.strictEqual(backend.presents, 1);
});

check('software viewport queries fill all four words and retain per-context state', () => {
  const memory = new ArrayBuffer(4096), view = new DataView(memory);
  const bridge = new OpenGLHostBridge({
    backend: 'software', getMemory: () => memory,
    exports: { guest_to_wasm: p => p, gl_sw_set_enabled() {}, gl_sw_set_default_size() {} },
    renderer: { windows: { 1: { w: 800, h: 600 }, 2: { w: 320, h: 240 } } },
  });
  const a = bridge.createContext(1), b = bridge.createContext(2);
  const stack = 64, output = 256, sentinel = 0x5a5a5a5a;
  function call(name, args) {
    args.forEach((value, i) => view.setInt32(stack + 4 + i * 4, value, true));
    return bridge.call(CALL_INDEX[name], stack, 0);
  }
  function query(expected) {
    for (let i = -1; i < 5; i++) view.setInt32(output + i * 4, sentinel, true);
    call('glGetIntegerv', [0x0BA2, output]);
    assert.deepStrictEqual(Array.from(new Int32Array(memory, output, 4)), expected);
    assert.strictEqual(view.getInt32(output - 4, true), sentinel);
    assert.strictEqual(view.getInt32(output + 16, true), sentinel);
  }
  bridge.current = a;
  query([0, 0, 800, 600]);
  call('glViewport', [-12, 7, 640, 480]);
  query([-12, 7, 640, 480]);
  call('glViewport', [0, 0, -1, 400]);
  query([-12, 7, 640, 480]);
  assert.strictEqual(call('glGetError', []), 0x0501);
  assert.strictEqual(call('glGetError', []), 0);
  bridge.current = b;
  query([0, 0, 320, 240]);
  bridge.current = a;
  query([-12, 7, 640, 480]);
  call('glViewport', [3, 4, 0, 0]);
  query([3, 4, 0, 0]);
});

console.log(`\n${passed}/${passed} checks passed`);
