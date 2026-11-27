#!/usr/bin/env node
'use strict';

// Ordinary renderer-owned windows only. Native-only child geometry needs real
// USER exports and is deliberately left to the existing native routing tests.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { createWindowHost } = require('../lib/host-window');
const { readStrA } = require('../lib/mem-utils');
const canvas = createCanvas(160, 100);
const r = new Win98Renderer(canvas);
const memory = new ArrayBuffer(256);
const host = createWindowHost({ renderer: r }, {
  readStr: ptr => readStrA(memory, ptr),
}).imports;

// A small DOM adapter around the real raster canvas. No renderer method,
// geometry export, clock or input queue is replaced. Use a scaled/offset CSS
// rectangle so the production browser bridge must do the coordinate mapping.
function events(target) {
  const listeners = new Map();
  target.addEventListener = (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
  };
  target.removeEventListener = (name, fn) => listeners.get(name)?.delete(fn);
  return (name, e) => {
    for (const fn of [...(listeners.get(name) || [])]) fn(e);
  };
}
const saved = Object.fromEntries(['window', 'document', 'Node', 'setInterval', 'clearInterval']
  .map(key => [key, global[key]]));
const win = {}, doc = {}, emit = events(win);
events(doc); events(canvas);
canvas.style = {};
canvas.classList = { toggle() {} };
const attributes = new Map();
canvas.setAttribute = (name, value) => attributes.set(name, String(value));
canvas.focus = () => { doc.activeElement = canvas; };
canvas.getBoundingClientRect = () => ({ left: 7, top: 11, width: 320, height: 200 });
Object.assign(doc, { body: {}, documentElement: {}, activeElement: canvas,
  visibilityState: 'visible', getElementById: () => null,
  querySelectorAll: () => [], elementFromPoint: () => null });
Object.assign(global, { window: win, document: doc, Node: class Node {},
  setInterval: () => 1, clearInterval() {} });
const event = (x, y, extra = {}) => ({ clientX: 7 + x * 2, clientY: 11 + y * 2,
  target: canvas, preventDefault() {}, stopPropagation() {}, ...extra });
const down = (button = 0) => canvas.onmousedown(event(30, 30, { button }));
const move = (x, y, buttons) => emit('mousemove', event(x, y, { buttons }));
const up = (x, y, button = 0) => emit('mouseup', event(x, y, { button }));
const key = (pressed, vk) => emit(pressed ? 'keydown' : 'keyup', event(0, 0,
  { keyCode: vk, code: vk === 16 ? 'ShiftLeft' : 'ControlLeft', location: 1 }));
const bytes = value => JSON.stringify(value);
const tuple = e => [e.hwnd, e.msg, e.wParam, e.lParam << 16 >> 16, e.lParam >> 16];
const failures = [], rows = [];
let checks = 0;
function equal(actual, expected, label) {
  checks++;
  try { assert.deepEqual(actual, expected, label); }
  catch (error) { failures.push({ label, actual, expected, error: error.message }); }
}
function setup() {
  // DestroyWindow compacts the queue itself. Never clear/drain it in this test.
  for (const hwnd of Object.keys(r.windows)) host.destroy_window(+hwnd);
  r.createWindow(100, 0x10000000, 10, 10, 50, 40, 'parent', 0);
  r.createWindow(101, 0x50000000, 2, 2, 5, 5, 'child record', 0);
  r.createWindow(200, 0x10000000, 100, 10, 40, 40, 'neighbor', 0);
  host.move_window(100, 20, 20, 50, 40, 0x15);
  canvas.onmousemove(event(110, 20));
  key(true, 16);
  const prefix = bytes(r.inputQueue), count = r.inputQueue.length;
  assert(r.inputQueue.some(e => e.hwnd === 200 && e.msg === 0x200));
  assert(r.inputQueue.some(e => e.type === 'key'));
  return { prefix, count, neighbor: bytes(r.windows[200]), child: bytes(r.windows[101]) };
}
function preserved(before, label) {
  equal(bytes(r.inputQueue.slice(0, before.count)), before.prefix, label + ' complete prefix');
  equal(bytes(r.windows[200]), before.neighbor, label + ' neighbor record');
  equal(bytes(r.windows[101]), before.child, label + ' child record');
}
try {
  require('../lib/browser-input').wireCanvasInput(canvas, r, { runningApps: [] });
  for (const moved of [false, true]) for (const button of [0, 2]) {
    const name = `${moved ? 'moving' : 'fixed'}/${button === 0 ? 'left' : 'right'}`;
    const before = setup();
    // A second physical input producer holds the opposite button outside all
    // windows. The DOM bridge owns the tested press, drag and release.
    const other = button === 0 ? 2 : 0;
    r.handleMouseDown(155, 95, other);
    down(button);
    key(true, 17); // current release modifiers must include a post-DOWN Ctrl
    if (moved) host.move_window(100, 25, 23, 50, 40, 0x15);
    const [x, y] = moved ? [35, 33] : [30, 30];
    move(x, y, 3);
    up(x, y, button);
    const produced = r.inputQueue.slice(before.count);
    const mouse = produced.filter(e => e.type === 'mouse');
    const held = button === 0 ? 2 : 1;
    equal(mouse.map(tuple), [[100, 0x84, 0, 30, 30],
      [100, button === 0 ? 0x201 : 0x204, 7, 10, 10],
      [100, 0x200, 15, 10, 10],
      [100, button === 0 ? 0x202 : 0x205, 12 | held, 10, 10]], name + ' full mouse sequence');
    equal(mouse.filter(e => [0x201, 0x204, 0x202, 0x205].includes(e.msg))
      .map(e => e.mouseButtons), [3, held], name + ' button snapshots');
    equal(host.get_mouse_buttons_live(), held, name + ' live remaining button');
    equal([r.peekKeyDownState(16), r.peekKeyDownState(17)], [0x8000, 0x8000], name + ' modifiers');
    equal(r._directMouseDown, null, name + ' owed press retired');
    preserved(before, name);
    rows.push({ name, events: produced });
    const queued = bytes(r.inputQueue);
    canvas.onmouseup(event(155, 95, { button: other }));
    equal(bytes(r.inputQueue), queued, name + ' outside remaining release preserves full queue');
    equal(host.get_mouse_buttons_live(), 0, name + ' buttons balanced');
    key(false, 17); key(false, 16);
  }
  for (const mode of ['destroy-reuse', 'replace-record']) {
    const before = setup(), queue = r.inputQueue, old = r.windows[100];
    down();
    assert.equal(r._directMouseDown?.win, old, 'real DOWN owns original record');
    if (mode === 'destroy-reuse') host.destroy_window(100);
    // Public createWindow can publish a replacement at the same numeric HWND.
    r.createWindow(100, 0x10000000, 60, 50, 30, 30, 'replacement', 0);
    const replacement = bytes(r.windows[100]);
    const queued = bytes(r.inputQueue);
    up(35, 33);
    equal(r.inputQueue === queue, true, mode + ' queue array identity');
    equal(bytes(r.inputQueue), queued, mode + ' late UP queues nothing');
    if (mode === 'destroy-reuse') equal(queued, before.prefix, mode + ' purges old target only');
    equal(bytes(r.windows[100]), replacement, mode + ' replacement unchanged');
    equal(host.get_mouse_buttons_live(), 0, mode + ' physical release balanced');
    equal(r._directMouseDown, null, mode + ' owed press retired');
    preserved(mode === 'destroy-reuse' ? { ...before, child: undefined } : before, mode);
    rows.push({ name: mode, events: r.inputQueue.slice(before.count) });
    key(false, 16);
  }
  // Retire a real WineAssembly lifetime through Stop. Load the unchanged host
  // script in its normal classic-script environment; no WASM/native geometry
  // is supplied or claimed by this ordinary renderer-window regression.
  const vm = require('node:vm'), fs = require('node:fs');
  const context = vm.createContext({ console, performance, WebAssembly, document: doc,
    require: require('node:module').createRequire(require.resolve('../host.js')),
    createHostImports: require('../lib/host-imports').createHostImports,
    inputEventHwnd: require('../lib/host-window').inputEventHwnd,
    setTimeout, clearTimeout, setInterval: saved.setInterval, clearInterval: saved.clearInterval });
  vm.runInContext(fs.readFileSync(require.resolve('../host.js'), 'utf8'), context);
  const WineAssembly = vm.runInContext('WineAssembly', context);
  const before = setup(), owner = new WineAssembly();
  owner.renderer = r;
  owner._multiApp = true;
  owner._hwndBase = 0x30000;
  owner.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = owner.getImports().host;
  imports.create_window(0x30001, 0x10000000, 20, 20, 50, 40, 0, 0);
  down();
  const retired = r.windows[0x30001];
  assert.equal(r._directMouseDown?.win, retired);
  assert.equal(retired._lookupProcess, owner._processObject);
  owner.stop({ repaint: false });
  equal(retired._lookupProcess.exited, true, 'Stop retires real process lifetime');
  equal(r.windows[0x30001], undefined, 'Stop removes owner window');
  equal(bytes(r.inputQueue), before.prefix, 'Stop purges owner queue only');
  r.createWindow(0x30001, 0x10000000, 60, 50, 30, 30, 'new incarnation', 0);
  const replacement = bytes(r.windows[0x30001]);
  up(35, 33);
  equal(bytes(r.inputQueue), before.prefix, 'retired held UP cannot reach new incarnation');
  equal(bytes(r.windows[0x30001]), replacement, 'Stop/reuse replacement unchanged');
  equal(host.get_mouse_buttons_live(), 0, 'Stop/reuse physical release');
  equal(r._directMouseDown, null, 'Stop/reuse owed press retired');
  preserved(before, 'Stop/reuse');
  key(false, 16);
  console.log(JSON.stringify({ checks, rows, failures }, null, 2));
  assert.equal(failures.length, 0, 'public browser input coordinate/lifetime regressions');
} finally {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete global[name]; else global[name] = value;
  }
}
