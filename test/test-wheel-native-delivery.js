#!/usr/bin/env node
'use strict';

// Production DOM bridge -> renderer -> native USER post queue -> GetMessage.
// No browser/game launch. Real WASM owns focus, capture, queue and MSG output;
// set_host_shadow exercises the production Worker-shadow posting path.
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const { inputEventHwnd } = require('../lib/host-window');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { ThreadManager } = require('../lib/thread-manager');
const context = { console, createHostImports, inputEventHwnd, performance,
  setTimeout, clearTimeout, setInterval, clearInterval, WebAssembly };
vm.runInNewContext(fs.readFileSync(require.resolve('../host.js'), 'utf8') +
  '\n;globalThis.WineAssembly = WineAssembly;', context);
const extraWat = `
  (func (export "wheel_get")
    (local $sp i32) (local $ip i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (call $handle_GetMessageA_fetch (i32.const 0x403000) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip)))
  (func (export "wheel_parent") (param $child i32) (param $parent i32)
    (call $wnd_set_parent (local.get $child) (local.get $parent)))
  (func (export "wheel_capture") (param $hwnd i32)
    (call $handle_SetCapture (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
`;
const bytes = process.env.WHEEL_MODULE ? fs.readFileSync(process.env.WHEEL_MODULE)
  : require('./compile-src').compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + extraWat : source);
if (process.env.WHEEL_SAVE_MODULE) fs.writeFileSync(process.env.WHEEL_SAVE_MODULE, bytes);
console.log('native module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
const wasm = new WebAssembly.Module(bytes);
function dom(renderer) {
  let document;
  class Target {
    constructor(tagName) {
      this.tagName = tagName; this.listeners = new Map(); this.style = {};
      this.classList = { toggle() {}, contains() { return false; } };
      this.width = 320; this.height = 200; this.value = '';
    }
    addEventListener(type, fn, options) {
      const rows = this.listeners.get(type) || [];
      rows.push({ fn, capture: options === true || !!options?.capture });
      this.listeners.set(type, rows);
    }
    removeEventListener() {}
    setAttribute() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 200 }; }
    focus() {
      const old = document.activeElement;
      if (old === this) return;
      if (old) dispatch(old, 'blur', {}, false);
      document.activeElement = this;
      dispatch(this, 'focus', {}, false);
    }
    closest() { return null; }
    contains(el) { return this === el; }
  }
  const window = new Target(), canvas = new Target('CANVAS'), proxy = new Target('TEXTAREA');
  document = new Target(); document.body = new Target('BODY');
  document.documentElement = new Target('HTML'); document.activeElement = canvas;
  document.getElementById = id => id === 'mobile-keyboard-proxy' ? proxy : null;
  document.querySelectorAll = () => [];
  function dispatch(target, type, props = {}, bubbles = true) {
    const event = { type, target, preventDefault() {}, stopPropagation() {}, ...props };
    const chain = target === window ? [window] : target === document
      ? [window, document] : [window, document, target];
    for (const node of chain)
      for (const row of node.listeners.get(type) || []) if (row.capture) row.fn(event);
    for (const node of bubbles ? [...chain].reverse() : [target])
      for (const row of node.listeners.get(type) || []) if (!row.capture) row.fn(event);
  }
  const ctx = { window, document, Node: Target, module: { exports: {} },
    setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; },
    clearTimeout() {}, performance };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/browser-input.js'), 'utf8'), ctx);
  ctx.module.exports.wireCanvasInput(canvas, renderer, { runningApps: [{ wine: { running: true } }] });
  return {
    key(type, vk = 38, code = 'ArrowUp', repeat = false, target = canvas) {
      dispatch(target, type, { keyCode: vk, code, key: 'Unidentified', location: 0, repeat });
    },
    blur() { dispatch(window, 'blur', {}, false); },
    hidden(value) { document.hidden = value; dispatch(document, 'visibilitychange'); },
    wheel(x, y, deltaY) {
      dispatch(canvas, 'wheel', { clientX: x, clientY: y, deltaY });
    },
    proxy,
  };
}
function fixture() {
  const renderer = new Win98Renderer(createCanvas(320, 200));
  const bridge = dom(renderer);
  const hosts = [];
  function processHost(base) {
    const host = new context.WineAssembly();
    hosts.push(host);
    host.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    host.renderer = renderer; host._multiApp = true; host._hwndBase = base;
    host.logToUI = () => {};
    const imports = host.getImports();
    const h = imports.host; h.memory = host.memory;
    host.instance = new WebAssembly.Instance(wasm, imports);
    host.instance.exports.init_thread(0, 0x400000, 0x401000, 0x402000, 0x7500000, 0x7510000, 0, 0);
    host.threadManager = new ThreadManager(wasm, host.memory, host.instance, tid => {
      let instance;
      const imports = host.getImports({ detached: true, threadId: tid,
        instance: () => instance, exports: () => instance?.exports });
      imports.host.memory = host.memory;
      imports.__setInstance = value => { instance = value; };
      return imports;
    }, { hwndBase: () => base });
    return { host, h, instance: host.instance };
  }
  function windowFor(p, hwnd) {
    p.instance.exports.wnd_table_set(hwnd, 0xffff0001);
    p.h.create_window(hwnd, 0x90000000, 0, 0, 320, 200, 0, 0);
    renderer.showWindow(hwnd, 5);
    p.instance.exports.set_focus(hwnd);
    assert.equal(p.instance.exports.get_focus_hwnd(), hwnd, 'native focus transition completed');
    p.h.activate_window(hwnd);
    p.instance.exports.wnd_table_set(hwnd, 0x401000);
    return renderer.windows[hwnd];
  }
  function drain(p) {
    const rows = [], e = p.instance.exports;
    const view = new DataView(p.host.memory.buffer, e.get_guest_base() + 0x3000, 28);
    // A nonempty real native post queue guarantees GetMessage does not wait.
    for (let i = 0; e.get_post_queue_count(); i++) {
      assert(i < 30, 'bounded native pump');
      e.wheel_get();
      rows.push(Array.from({ length: 7 }, (_, j) => view.getUint32(j * 4, true)));
    }
    return rows.filter(row => row[1] === 0x20a);
  }
  return { renderer, bridge, processHost, windowFor, drain,
    close() { for (const host of hosts) if (!host._processObject.exited) host.stop({ repaint: false }); } };
}

// Contract: https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousewheel
// Focus owns WM_MOUSEWHEEL; lParam is signed SCREEN coordinates; low wParam
// contains MK flags. No hit-test/edit fallback may redirect it to another app.
const f = fixture();
try {
  const p = f.processHost(0x10000), other = f.processHost(0x20000);
  const win = f.windowFor(p, 0x10001);
  f.windowFor(other, 0x20001);
  p.h.activate_window(win.hwnd);
  f.drain(p); f.drain(other);
  f.renderer._pointerInputMemory = p.host.memory;
  const physical = new Int32Array(p.host.memory.buffer);
  const wheelIndex = (require('../lib/region-map.generated').BASE.DI_MOUSE_INPUT_STATE >>> 2) + 71;
  const selected = process.argv.find(a => a.startsWith('--case='))?.slice(7);
  function check(name, x, y, deltaY, expectedX, expectedY, flags = 0, target = win.hwnd, poller = p) {
    if (selected && selected !== name) return;
    const capture = p.instance.exports.get_capture_hwnd();
    const wheelBefore = Atomics.load(physical, wheelIndex);
    // Production Worker host shadow posts; the owning native instance pumps.
    for (const proc of new Set([p, other, poller])) proc.instance.exports.set_host_shadow(1);
    try { f.bridge.wheel(x, y, deltaY); }
    finally { p.instance.exports.set_host_shadow(0); other.instance.exports.set_host_shadow(0); poller.instance.exports.set_host_shadow(0); }
    assert.equal(Atomics.load(physical, wheelIndex) - wheelBefore, deltaY > 0 ? -120 : 120,
      'physical DirectInput wheel retains exactly one signed notch');
    assert.deepEqual(f.drain(other), [], 'sibling native queue cannot receive foreground wheel');
    assert.equal(poller.instance.exports.get_post_queue_count(), 1, name + ': native queue owns one wheel');
    assert.equal(poller.instance.exports.post_queue_peek(0, 1), 0x20a, 'full native wheel message');
    const rows = f.drain(poller);
    console.log(name, JSON.stringify(rows));
    assert.equal(rows.length, 1, name + ': exactly one native wheel');
    const row = rows[0];
    assert.equal(row[0], target, name + ': focus target');
    assert.equal(row[2] >>> 16 << 16 >> 16, deltaY > 0 ? -120 : 120, 'signed wheel delta survives queue');
    assert.equal(row[2] & 0xffff, flags, name + ': key/button flags');
    assert.equal(row[3] << 16 >> 16, expectedX, name + ': signed screen X');
    assert.equal(row[3] >> 16, expectedY, name + ': signed screen Y');
    assert.equal(row[5] | 0, expectedX, 'MSG.pt screen X');
    assert.equal(row[6] | 0, expectedY, 'MSG.pt screen Y');
    assert.equal(p.instance.exports.get_capture_hwnd(), capture, 'wheel preserves capture lifetime');
  }
  check('negative', -71, -29, 1, -71, -29);
  f.renderer._shiftDown = true; f.renderer._ctrlDown = true;
  f.renderer._mouseButtonsMask = 3;
  check('flags', -71, -29, -1, -71, -29, 15);
  assert.equal(f.renderer._mouseButtonsMask, 3, 'physical buttons preserved');
  f.renderer._shiftDown = false; f.renderer._ctrlDown = false; f.renderer._mouseButtonsMask = 0;
  // Same crop used by production exclusive presentation, with negative
  // native screen origin and a 2x destination. No guest/client offset applies.
  f.renderer.refreshInputPresentation = () => {};
  f.renderer._exclusiveTransform = { hwnd: win.hwnd, srcX: -160, srcY: -100,
    srcW: 320, srcH: 200, dstX: 0, dstY: 0, dstW: 640, dstH: 400 };
  check('scaled', 100, 80, 1, -110, -60);
  f.renderer._exclusiveTransform = null;
  // Native child focus wins over a distinct captured HWND and pointer point.
  p.instance.exports.wnd_table_set(win.hwnd, 0xffff0001);
  p.instance.exports.wnd_table_set(0x10002, 0xffff0001);
  p.instance.exports.wheel_parent(0x10002, win.hwnd);
  p.instance.exports.set_focus(0x10002);
  p.instance.exports.wheel_capture(win.hwnd);
  p.instance.exports.wnd_table_set(0x10002, 0x401000);
  check('child-capture', -71, -29, -1, -71, -29, 0, 0x10002);
  p.instance.exports.release_capture();
  // A scheduler slice can leave renderer.wasm on a sibling. Activation,
  // rather than the last instance to execute, must still own the wheel.
  f.renderer.wasm = other.instance; f.renderer.wasmMemory = other.host.memory;
  check('sibling-slice', -71, -29, 1, -71, -29, 0, 0x10002);
  // Real cooperative auxiliary owns its own focused top-level and queue.
  const handle = p.host.threadManager.createThread(0x401000, 0, 0x10000, 4, 0, 1);
  p.host.threadManager.spawnPending();
  const thread = p.host.threadManager.threads.get(handle);
  assert.equal(thread.state, 'active');
  const h = p.host.getImports({ detached: true, threadId: thread.tid,
    instance: () => thread.instance, exports: () => thread.instance.exports }).host;
  const aux = { host: p.host, h, instance: thread.instance };
  f.windowFor(aux, 0x18001); f.drain(aux);
  check('auxiliary', -71, -29, -1, -71, -29, 0, 0x18001, aux);
  console.log('PASS DOM wheel -> native post queue -> GetMessage: signed deltas/screen points, flags, crop, child focus, capture, sibling slice, auxiliary');
} finally { f.close(); }
