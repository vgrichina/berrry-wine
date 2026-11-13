#!/usr/bin/env node
'use strict';

// Pointer lifecycle regression using production host imports and renderer.
// Native USER tables and real cooperative thread instances retain their lifetimes.
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
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
  (func (export "pointer_geometry") (param $hwnd i32) (param $parent i32)
    (drop (call $wnd_set_style (local.get $hwnd) (select (i32.const 0x50000000) (i32.const 0x90000000) (local.get $parent))))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (call $client_rect_set (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 320) (i32.const 200)))
  (func (export "pointer_destroy") (param $hwnd i32)
    (call $wnd_destroy_recursive (local.get $hwnd)))
  (func (export "pointer_capture") (param $hwnd i32)
    (call $handle_SetCapture (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
`;
const bytes = process.argv.includes('--queued-only')
  ? fs.readFileSync(require.resolve('../build/wine-assembly.wasm'))
  : require('./compile-src').compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + extraWat : source);
console.log('pointer module SHA256=' + require('crypto').createHash('sha256').update(bytes).digest('hex'));
const wasm = new WebAssembly.Module(bytes);
const renderer = new Win98Renderer(createCanvas(320, 200));
function processHost(base) {
  const host = new context.WineAssembly();
  host.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  host.renderer = renderer;
  host._multiApp = true;
  host._hwndBase = base;
  host.logToUI = () => {};
  const imports = host.getImports();
  imports.host.memory = host.memory;
  host.instance = new WebAssembly.Instance(wasm, imports);
  host.instance.exports.init_thread(0, 0x400000, 0x401000, 0x402000, 0x7500000, 0x7510000, 0, 0);
  host.threadManager = new ThreadManager(wasm, host.memory, host.instance, tid => {
    let instance;
    const detached = host.getImports({ detached: true, threadId: tid,
      instance: () => instance, exports: () => instance?.exports });
    detached.host.memory = host.memory;
    detached.__setInstance = value => { instance = value; };
    return detached;
  }, { hwndBase: () => base });
  return { host, h: imports.host };
}
function windowFor(p, hwnd, imports = p.h, instance = p.host.instance) {
  instance.exports.wnd_table_set(hwnd, 0xffff0001);
  instance.exports.pointer_geometry?.(hwnd, 0);
  imports.create_window(hwnd, 0x90000000, 0, 0, 320, 200, 0, 0);
  renderer.showWindow(hwnd, 5);
  return renderer.windows[hwnd];
}
renderer._buttonHoldFloorMs = -1; // scripted edges supply their own ordering
function select(p, win) {
  renderer.wasm = p.host.instance;
  renderer.wasmMemory = p.host.memory;
  p.h.activate_window(win.hwnd);
}
function queuedRetirement(injected = false) {
  const old = processHost(0x30000);
  const win = windowFor(old, 0x30001);
  select(old, win);
  if (injected) {
    renderer.queueMouseInput(1 | 2 | 4, 40, 50, 0, 0);
  } else {
    renderer.handleMouseMove(40, 50);
    renderer.handleMouseDown(40, 50, 0);
    renderer.handleMouseUp(40, 50, 0);
  }
  assert.deepEqual(renderer.inputQueue.filter(e => e.msg >= 0x200).map(e => e.msg), [0x200, 0x201, 0x202]);
  const queue = renderer.inputQueue;
  old.host.stop({ repaint: false });
  assert.equal(renderer.inputQueue, queue);
  const live = processHost(0x30000);
  select(live, windowFor(live, win.hwnd));
  assert.equal(live.h.check_input(), 0, 'replacement HWND must not receive retired process pointer input');
  live.host.stop({ repaint: false });
}
function physicalButtonEdges(p) {
  const state = new Int32Array(p.host.memory.buffer);
  const base = require('../lib/region-map.generated').BASE.DI_MOUSE_INPUT_STATE >>> 2;
  const count = Atomics.load(state, base + 3);
  return Array.from({ length: count }, (_, index) => Atomics.load(state, base + 4 + index) >>> 28)
    .filter(type => type === 1 || type === 2);
}
function staleHeldRelease() {
  const old = processHost(0x40000);
  const win = windowFor(old, 0x40001);

  select(old, win);
  renderer.handleMouseDown(40, 50, 0);
  assert.equal(renderer._directMouseDown?.targetHwnd, win.hwnd);
  old.host.instance.exports.pointer_capture(win.hwnd);
  assert.equal(old.host.instance.exports.get_capture_hwnd(), win.hwnd);
  // Consume the original down before retirement, leaving only browser drag state.
  while (old.h.check_input()) {}
  old.host.stop({ repaint: false });
  const live = processHost(0x40000);
  const replacement = windowFor(live, win.hwnd);
  
  renderer.handleMouseMove(400, 250);
  renderer.handleMouseUp(400, 250, 0);
  assert.equal(renderer._mouseButtonsMask, 0, 'physical release remains balanced');
  assert.deepEqual(physicalButtonEdges(old), [1, 2], 'Stop preserves the owning physical down/up edges');
  assert.equal(live.h.check_input(), 0, 'retired held target must not route release to replacement HWND');
  select(live, replacement);
  live.host.stop({ repaint: false });
}
function retiredCapture() {
  const old = processHost(0x60000), win = windowFor(old, 0x60001);
  select(old, win);
  old.host.instance.exports.pointer_capture(win.hwnd);
  old.host.stop({ repaint: false });
  const live = processHost(0x60000);
  // Real CreateWindow creates the next process's HWND before ShowWindow
  // activates it; renderer.wasm still names the stopped process at this edge.
  live.host.instance.exports.wnd_table_set(win.hwnd, 0xffff0001);
  live.host.instance.exports.pointer_geometry(win.hwnd, 0);
  live.h.create_window(win.hwnd, 0x80000000, 0, 0, 320, 200, 0, 0);
  assert.equal(renderer.wasm, old.host.instance);
  renderer.handleMouseMove(310, 190);
  renderer.handleMouseUp(310, 190, 0);
  assert.equal(live.h.check_input(), 0, 'retired capture source must not resolve hidden replacement HWND');
  live.host.stop({ repaint: false });
}
function auxiliaryFor(p) {
  const tm = p.host.threadManager;
  const handle = tm.createThread(0x401000, 0, 0x10000, 4, 0, 1);
  tm.spawnPending();
  const thread = tm.threads.get(handle);
  assert.equal(thread.state, 'active');
  return p.host.getImports({ detached: true, threadId: thread.tid,
    instance: () => thread.instance, exports: () => thread.instance.exports }).host;
}
function legitimateCaptureAndSibling() {
  const a = processHost(0x10000), b = processHost(0x20000);
  const aw = windowFor(a, 0x10001), bw = windowFor(b, 0x20001);
  const auxiliary = auxiliaryFor(a);
  select(a, aw);
  renderer.handleMouseDown(40, 50, 0);
  a.host.instance.exports.pointer_capture(aw.hwnd);
  assert.equal(a.host.instance.exports.get_capture_hwnd(), aw.hwnd);
  assert.equal(b.h.check_input(), 0, 'foreign process cannot consume held press');
  const drain = h => {
    const messages = [];
    let packed;
    while ((packed = h.check_input())) messages.push(packed & 0xffff);
    return messages;
  };
  assert(drain(auxiliary).includes(0x201), 'actual auxiliary receives main-window press');
  renderer.handleMouseMove(310, 190);
  renderer.handleMouseUp(310, 190, 0);
  const released = drain(auxiliary);
  assert(released.includes(0x200) && released.includes(0x202), 'same-process capture move/release survive');
  assert.equal(renderer.getMouseButtons(), 0);
  assert.deepEqual(physicalButtonEdges(a), [1, 2], 'same-process release preserves DirectInput down/up edges');
  assert.equal(renderer.peekKeyDownState(1), 0, 'physical key state reflects release');
  a.host.instance.exports.release_capture();
  select(a, aw); renderer.handleMouseMove(20, 30);
  select(b, bw); renderer.handleMouseMove(60, 70);
  a.host.stop({ repaint: false });
  assert(renderer.inputQueue.some(e => e.hwnd === bw.hwnd), 'retirement preserves sibling pointer input');
  const c = processHost(0x10000);
  c.host.processId = a.host.processId; // explicitly recycle the numeric process identity
  const cw = windowFor(c, aw.hwnd);
  select(c, cw); renderer.handleMouseMove(80, 90);
  assert.equal(a.h.check_input(), 0);
  assert.equal(auxiliary.check_input(), 0, 'retired auxiliary cannot drain reused PID/HWND');
  assert(drain(c.h).includes(0x200));
  assert(drain(b.h).includes(0x200));
  b.host.stop({ repaint: false }); c.host.stop({ repaint: false });
}
function nativeDestroy() {
  const p = processHost(0x50000), win = windowFor(p, 0x50001);
  select(p, win);
  renderer.handleMouseMove(40, 50);
  renderer.handleMouseDown(40, 50, 0);
  p.host.instance.exports.pointer_capture(win.hwnd);
  const queue = renderer.inputQueue;
  p.host.instance.exports.pointer_destroy(win.hwnd);
  assert.equal(p.host.instance.exports.get_capture_hwnd(), 0, 'native destruction releases capture');
  assert.equal(renderer.windows[win.hwnd], undefined);
  assert.equal(renderer.inputQueue, queue);
  assert.equal(queue.length, 0, 'native destruction already purges pending pointer input');
  const replacement = windowFor(p, win.hwnd);
  assert.notEqual(replacement, win);
  renderer.handleMouseUp(400, 250, 0);
  assert.equal(renderer.getMouseButtons(), 0, 'destroy does not prevent physical release');
  assert.equal(p.h.check_input(), 0, 'native destroy purges input before same-process HWND reuse');
  p.host.stop({ repaint: false });
}
if (process.argv.includes('--retired-capture-only')) retiredCapture();
else if (process.argv.includes('--capture-only')) staleHeldRelease();
else if (process.argv.includes('--queued-only')) queuedRetirement();
else if (process.argv.includes('--injected-only')) queuedRetirement(true);
else {
  queuedRetirement();
  queuedRetirement(true);
  staleHeldRelease();
  retiredCapture();
  legitimateCaptureAndSibling();
  nativeDestroy();
}
console.log('PASS production pointer lifecycle: DOM/injected queue, delayed held release, native capture/destruction, same-process auxiliary, retired main/auxiliary, reused PID/HWND, sibling preservation, physical button balance');
