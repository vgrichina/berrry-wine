#!/usr/bin/env node
'use strict';

// Two real hosts share the page renderer, but not guest memory. A cooperative
// auxiliary belongs to its creating host even though it has separate globals.
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
const wasm = new WebAssembly.Module(fs.readFileSync(require.resolve('../build/wine-assembly.wasm')));
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
  imports.create_window(hwnd, 0x90000000, 0, 0, 320, 200, 0, 0);
  renderer.showWindow(hwnd, 5);
  return renderer.windows[hwnd];
}
function activate(win) {
  renderer._foregroundWindow = win;
  renderer._setKeyboardInputOwner(win);
}

// A delayed poll through a retired host's imports must leave the next process's
// character untouched, even when the shell has reused the same HWND range.
function retiredPoll() {
  const old = processHost(0x30000);
  const win = windowFor(old, 0x30001);
  activate(win);
  old.host.stop({ repaint: false });
  const live = processHost(0x30000);
  activate(windowFor(live, win.hwnd));
  renderer.handleKeyPress(82);
  assert.equal(old.h.check_input(), 0, 'retired process must not steal replacement process character');
  assert.notEqual(live.h.check_input(), 0);
  assert.equal(live.h.check_input_wparam(), 82);
  live.host.stop({ repaint: false });
}
retiredPoll();
if (process.argv.includes('--retirement-only')) {
  console.log('PASS retired production host cannot steal replacement process input');
  process.exit(0);
}
const a = processHost(0x10000), b = processHost(0x20000);
const aw = windowFor(a, 0x10001), bw = windowFor(b, 0x20001);
activate(bw);
renderer.handleKeyPress(66);
assert.equal(a.h.check_input(), 0, 'foreign process polling first must not steal B character');
assert.equal(renderer.inputQueue.length, 1);
assert.notEqual(b.h.check_input(), 0);
assert.equal(b.h.check_input_wparam(), 66);
assert.equal(b.h.check_input_hwnd(0x20005), 0x20005, 'live guest focus is authoritative');

// Exercise actual queued down/up/system/character producers. This also covers
// the ordinary instance-ownership route without changing teardown semantics.
for (const multi of [true, false]) {
  a.host._multiApp = b.host._multiApp = multi;
  for (const produce of [
    () => renderer.handleKeyDown(38, { code: 'ArrowUp' }),
    () => renderer.handleKeyUp(38, { code: 'ArrowUp' }),
    () => renderer.handleKeyDown(18, { code: 'AltLeft' }),
    () => renderer.handleKeyUp(18, { code: 'AltLeft' }),
    () => renderer.handleKeyPress(0x00e9),
  ]) {
    produce();
    assert.equal(renderer.inputQueue.length, 1);
    assert.equal(renderer.inputQueue[0].hwnd, 0);
    assert.equal(a.h.check_input(), 0);
    assert.notEqual(b.h.check_input(), 0);
    assert.equal(b.h.check_input_hwnd(0x20009), 0x20009);
  }
}
a.host._multiApp = b.host._multiApp = true;

// Enqueue-time process ownership survives a later activation change.
activate(aw); renderer.handleKeyPress(65);
activate(bw); renderer.handleKeyPress(67);
assert.notEqual(b.h.check_input(), 0);
assert.equal(b.h.check_input_wparam(), 67);
assert.notEqual(a.h.check_input(), 0);
assert.equal(a.h.check_input_wparam(), 65);

// Use the production CreateThread/spawn path, not a fabricated owner token.
const handle = b.host.threadManager.createThread(0x401000, 0, 0x10000, 4, 0, 1);
b.host.threadManager.spawnPending();
const thread = b.host.threadManager.threads.get(handle);
assert.equal(thread.state, 'active');
assert.notEqual(thread.instance, b.host.instance);
const auxiliary = b.host.getImports({ detached: true, threadId: thread.tid,
  instance: () => thread.instance, exports: () => thread.instance.exports }).host;
activate(bw); renderer.handleKeyPress(68);
assert.notEqual(auxiliary.check_input(), 0, 'same-process auxiliary may pump main-window key');
assert.equal(auxiliary.check_input_hwnd(0x20006), 0x20006);
const auxWindow = windowFor(b, 0x28001, auxiliary, thread.instance);
activate(auxWindow); renderer.handleKeyPress(69);
assert.equal(a.h.check_input(), 0);
assert.notEqual(b.h.check_input(), 0, 'main may pump auxiliary-window key');
assert.equal(b.h.check_input_wparam(), 69);

// Retire B with a queued character, reuse its HWND in a new process, and
// retain B's old main and detached import closures as a delayed RPC could.
activate(aw); renderer.handleKeyPress(80);
activate(bw); renderer.handleKeyPress(70);
const queue = renderer.inputQueue;
const oldLifetime = b.host._processObject;
b.host.stop({ repaint: false });
assert.equal(oldLifetime.exited, true);
assert.equal(renderer.inputQueue, queue, 'retirement preserves queue array identity');
assert.deepEqual(queue.map(e => e.wParam), [80], 'retirement drops only its own pending keys');
const c = processHost(0x20000), cw = windowFor(c, 0x20001);
activate(cw); renderer.handleKeyPress(71);
assert.equal(b.h.check_input(), 0, 'retired main cannot drain replacement-process input');
assert.equal(auxiliary.check_input(), 0, 'retired auxiliary cannot drain replacement input');
assert.notEqual(c.h.check_input(), 0);
assert.equal(c.h.check_input_wparam(), 71, 'retired queued character cannot replay after HWND reuse');
assert.equal(c.h.check_input(), 0);
assert.notEqual(a.h.check_input(), 0);
assert.equal(a.h.check_input_wparam(), 80, 'sibling pending key survives retirement');

// Destroy/recreate within a live process still routes to its current focus.
activate(cw); renderer.handleKeyPress(72);
c.h.destroy_window(cw.hwnd);
const replacement = windowFor(c, cw.hwnd);
assert.notEqual(replacement, cw);
activate(replacement);
assert.notEqual(c.h.check_input(), 0);
assert.equal(c.h.check_input_hwnd(0x20007), 0x20007);
// Legacy CLI entries lack browser ownership metadata and retain FIFO routing.
renderer.inputQueue.push({ type: 'key', hwnd: 0, msg: 258, wParam: 90 });
assert.notEqual(a.h.check_input(), 0);
assert.equal(a.h.check_input_wparam(), 90);
a.host.stop({ repaint: false }); c.host.stop({ repaint: false });
console.log('PASS production hosts/renderer: foreign-first poll, focus changes, real auxiliary spawn, retirement, HWND reuse, live guest focus, legacy CLI');
