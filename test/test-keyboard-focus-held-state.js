#!/usr/bin/env node
'use strict';

// Production DOM bridge -> renderer -> host -> native USER PeekMessage.
// No browser/game launch: the DOM fixture models capture and non-bubbling
// element focus, while real WASM instances own native focus and MSG delivery.
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
  (func (export "held_peek") (result i32)
    (local $sp i32) (local $ip i32) (local $result i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (call $handle_PeekMessageA_fetch (i32.const 0x403000) (i32.const 0)
      (i32.const 0x100) (i32.const 0x105) (i32.const 1) (i32.const 0))
    (local.set $result (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip))
    (local.get $result))
  (func (export "held_capture") (param $hwnd i32)
    (call $handle_SetCapture (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
`;
const bytes = process.env.INPUT_FOCUS_MODULE
  ? fs.readFileSync(process.env.INPUT_FOCUS_MODULE)
  : require('./compile-src').compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + extraWat : source);
if (process.env.INPUT_FOCUS_SAVE_MODULE) fs.writeFileSync(process.env.INPUT_FOCUS_SAVE_MODULE, bytes);
console.log('native module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
const wasm = new WebAssembly.Module(bytes);
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const runs = name => !selected || selected === name;

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
    return renderer.windows[hwnd];
  }
  function drain(p) {
    const rows = [], e = p.instance.exports;
    const view = new DataView(p.host.memory.buffer, e.get_guest_base() + 0x3000, 28);
    for (let i = 0; e.held_peek(); i++) {
      assert(i < 30, 'bounded native pump');
      rows.push([view.getUint32(0, true), view.getUint32(4, true),
        view.getUint32(8, true), view.getUint32(12, true)]);
    }
    return rows;
  }
  return { renderer, bridge, processHost, windowFor, drain,
    close() { for (const host of hosts) if (!host._processObject.exited) host.stop({ repaint: false }); } };
}

for (const cancellation of ['blur', 'hidden', 'keyup']) {
  if (!runs(cancellation)) continue;
  const f = fixture();
  try {
    const p = f.processHost(0x10000);
    const win = f.windowFor(p, 0x10001);
    // Capture is legitimate and must survive an unrelated key/focus sequence.
    p.instance.exports.held_capture(win.hwnd);
    for (const [vk, code, scan] of [[38, 'ArrowUp', 0x01480001], [87, 'KeyW', 0x00110001], [19, 'Pause', 0x00450001]]) {
      f.bridge.key('keydown', vk, code);
      if (cancellation === 'blur') f.bridge.blur();
      else if (cancellation === 'hidden') { f.bridge.hidden(true); f.bridge.hidden(false); }
      else f.bridge.key('keyup', vk, code);
      assert.equal(f.renderer.peekKeyDownState(vk), 0, 'physical release precedes queued delivery');
      assert.equal(f.renderer.peekAsyncKeyState(vk), 0x8000, 'earlier queued snapshot stays down');
      // Guest focus can move while the old pair is waiting. HWND zero must
      // continue to follow the native caller's current focus at dequeue.
      const nextHwnd = win.hwnd + 1;
      p.instance.exports.wnd_table_set(nextHwnd, 0xffff0001);
      p.instance.exports.set_focus(nextHwnd);
      f.bridge.key('keydown', vk, code);
      f.bridge.key('keyup', vk, code);
      const rows = f.drain(p);
      console.log(cancellation, code, JSON.stringify(rows));
      assert.deepEqual(rows.map(row => row[1]), [0x100, 0x101, 0x100, 0x101]);
      assert.deepEqual(rows.map(row => row[3]), [scan, (scan | 0xc0000000) >>> 0,
        scan, (scan | 0xc0000000) >>> 0], 'a released key must not remain held in the next native keydown');
      assert(rows.every(row => row[0] === nextHwnd), 'live native focus owns all queued messages');
      assert.equal(rows.filter(row => row[1] === 0x100 && !(row[3] & 0x40000000)).length, 2,
        'a game rejecting repeats must receive both legitimate presses');
      assert.equal(f.renderer.getAsyncKeyState(vk) & 0x8000, 0);
      assert.equal(p.instance.exports.get_capture_hwnd(), win.hwnd, 'valid capture survives');
    }
  } finally { f.close(); }
}

// Element blur is not window blur: holding through canvas -> proxy focus
// must retain genuine repeat flags, and the delivered up still reaches USER.
if (runs('element')) {
  const f = fixture();
  try {
    const p = f.processHost(0x20000); f.windowFor(p, 0x20001);
    f.bridge.key('keydown'); f.bridge.proxy.focus();
    assert.equal(f.renderer.peekKeyDownState(38), 0x8000);
    f.bridge.key('keydown', 38, 'ArrowUp', true, f.bridge.proxy);
    f.bridge.key('keyup', 38, 'ArrowUp', false, f.bridge.proxy);
    assert.deepEqual(f.drain(p).map(row => row[3]), [0x01480001, 0x41480001, 0xc1480001]);
  } finally { f.close(); }
}

// A real cooperative auxiliary changes focus and pumps the same process's
// pending pair, without letting an unrelated process steal the release.
if (runs('auxiliary')) {
  const f = fixture();
  try {
    const p = f.processHost(0x30000); f.windowFor(p, 0x30001);
    const other = f.processHost(0x40000); f.windowFor(other, 0x40001);
    p.h.activate_window(0x30001);
    f.bridge.key('keydown'); f.bridge.blur();
    const handle = p.host.threadManager.createThread(0x401000, 0, 0x10000, 4, 0, 1);
    p.host.threadManager.spawnPending();
    const thread = p.host.threadManager.threads.get(handle);
    assert.equal(thread.state, 'active');
    const h = p.host.getImports({ detached: true, threadId: thread.tid,
      instance: () => thread.instance, exports: () => thread.instance.exports }).host;
    const aux = { host: p.host, h, instance: thread.instance };
    f.windowFor(aux, 0x38001);
    f.bridge.key('keydown'); f.bridge.key('keyup');
    assert.deepEqual(f.drain(other), [], 'foreign native pump leaves owned keys intact');
    const rows = f.drain(aux);
    assert.deepEqual(rows.map(row => row[3]), [0x01480001, 0xc1480001, 0x01480001, 0xc1480001]);
    assert(rows.every(row => row[0] === 0x38001));
    console.log('same-process auxiliary', JSON.stringify(rows));
  } finally { f.close(); }
}

// Stop drops a retired queued pair; its old async snapshot cannot turn the
// first fresh press after relaunch (same HWND) into a held-key repeat.
if (runs('relaunch')) {
  const f = fixture();
  try {
    const old = f.processHost(0x50000); f.windowFor(old, 0x50001);
    f.bridge.key('keydown'); f.bridge.blur();
    old.host.stop({ repaint: false });
    assert.equal(f.renderer.inputQueue.length, 0);
    const live = f.processHost(0x50000); f.windowFor(live, 0x50001);
    f.bridge.key('keydown'); f.bridge.key('keyup');
    assert.equal(old.h.check_input(), 0);
    const rows = f.drain(live);
    assert.deepEqual(rows.map(row => row[3]), [0x01480001, 0xc1480001]);
    console.log('Stop/relaunch', JSON.stringify(rows));
  } finally { f.close(); }
}
console.log('PASS native keyboard focus/physical release/repress, DOM cancellation, real auxiliary, ownership, valid capture, Stop/relaunch');
