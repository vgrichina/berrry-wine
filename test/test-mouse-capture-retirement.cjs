'use strict';

// Public USER thunks and the production renderer/host queue. The fixture PE is
// loaded only to initialize continuations; its original entry point never runs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { createHostImports } = require('../lib/host-imports');
const { inputEventHwnd } = require('../lib/host-window');
const { BASE } = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');
const context = vm.createContext({ console, performance, WebAssembly,
  require: require('node:module').createRequire(require.resolve('../host.js')),
  createHostImports, inputEventHwnd, setTimeout, clearTimeout, setInterval, clearInterval });
vm.runInContext(fs.readFileSync(require.resolve('../host.js'), 'utf8'), context);
const WineAssembly = vm.runInContext('WineAssembly', context);
const bytes = require('./compile-src').compileSrcWasm();
console.log('module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
const moduleObject = new WebAssembly.Module(bytes);
const fixture = fs.readFileSync(require.resolve('./binaries/calc.exe'));
const tuple = ev => [ev.hwnd, ev.msg, ev.wParam, ev.lParam << 16 >> 16, ev.lParam >> 16];
const failures = [], rows = [];

for (const mode of ['held', 'reparent', 'reparent-destroy-old', 'transfer', 'destroy-child', 'destroy-tree'])
for (const button of [0, 2]) {
  const r = new Win98Renderer(createCanvas(640, 480));
  const host = new WineAssembly();
  host.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  host.renderer = r;
  host._multiApp = true;
  host._hwndBase = 0x10000;
  host.logToUI = () => {};
  const imports = host.getImports();
  imports.host.memory = host.memory;
  host.instance = new WebAssembly.Instance(moduleObject, imports);
  const e = host.instance.exports, memory = host.memory;
  r.wasm = host.instance; r.wasmMemory = memory;
  r._buttonHoldFloorMs = -1;
  try {
    new Uint8Array(memory.buffer).set(fixture, e.get_staging());
    assert(e.load_pe(fixture.length));
    e.init_dx_com_thunks();
    const image = e.get_image_base(), stack = image + 0x110000;
    const cls = image + 0x120000, wc = cls + 0x100, msg = cls + 0x200;
    const observed = cls + 0x300, proc = image + 0x1000;
    const v = new DataView(memory.buffer), wa = g => g - image + e.get_guest_base();
    const names = ['RegisterClassA', 'CreateWindowExA', 'SetCapture', 'SetParent',
      'DestroyWindow', 'ReleaseCapture', 'PeekMessageA', 'DispatchMessageA', 'GetCapture'];
    const first = e.get_num_thunks(), thunk = e.get_thunk_base() + first * 8;
    names.forEach((n, i) => v.setUint32(BASE.THUNK_BASE + (first + i) * 8 + 4,
      apis.find(a => a.name === n).id, true));
    e.sync_thunk_state(thunk + names.length * 8, first + names.length);
    const invoke = (name, args = []) => {
      [0, ...args].forEach((n, i) => v.setUint32(wa(stack) + i * 4, n, true));
      e.clear_yield(); e.set_esp(stack); e.set_eip(thunk + names.indexOf(name) * 8); e.run(10000);
      assert.equal(e.get_eip(), 0, name + ' returns');
      return e.get_eax() >>> 0;
    };
    // Real x86 wndproc records only delivered button-UPs, independently of the
    // renderer queue. All other messages return 1 (including WM_NCCREATE).
    const code = [], put = (...b) => code.push(...b);
    const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
    put(0x81, 0x7c, 0x24, 8, ...u32(0x202)); // cmp [esp+8],WM_LBUTTONUP
    put(0x74, 10); // je record
    put(0x81, 0x7c, 0x24, 8, ...u32(0x205));
    put(0x75, 42); // jne return (6 + 4*9 bytes of record code)
    put(0xff, 0x05, ...u32(observed)); // inc [count]
    for (const [off, dst] of [[4, 4], [8, 8], [12, 12], [16, 16]]) {
      put(0x8b, 0x44, 0x24, off, 0xa3, ...u32(observed + dst));
    }
    put(0xb8, 1, 0, 0, 0, 0xc2, 0x10, 0);
    new Uint8Array(memory.buffer).set(code, wa(proc));
    new Uint8Array(memory.buffer).set(Buffer.from('CaptureRetirement\0'), wa(cls));
    v.setUint32(wa(wc) + 4, proc, true); v.setUint32(wa(wc) + 36, cls, true);
    assert(invoke('RegisterClassA', [wc]));
    const create = (style, x, y, parent = 0) => {
      const hwnd = invoke('CreateWindowExA', [0, cls, cls, style, x, y,
        parent ? 40 : 120, parent ? 30 : 100, parent, 0, 0, 0]);
      assert(hwnd > 0x10000); return hwnd;
    };
    const a = create(0x90000000, 20, 20), b = create(0x90000000, 200, 100);
    const child = create(0x50000000, 5, 7, a);
    const drain = () => {
      const mouse = [];
      for (let n = 0; n < 128; n++) {
        if (!invoke('PeekMessageA', [msg, 0, 0, 0, 1])) return mouse;
        const [hwnd, message, wParam, lParam] = [0, 4, 8, 12].map(o => v.getUint32(wa(msg) + o, true));
        if (message >= 0x200 && message <= 0x209) mouse.push(tuple({ hwnd, msg: message, wParam, lParam }));
        invoke('DispatchMessageA', [msg]);
      }
      throw Error('message drain did not finish');
    };
    drain();
    const mask = button === 0 ? 1 : 2, down = button === 0 ? 0x201 : 0x204;
    const up = button === 0 ? 0x202 : 0x205;
    r.handleMouseDown(30, 32, button);
    assert.deepEqual(drain(), [[child, down, mask, 5, 5]], 'actual child receives physical DOWN');
    invoke('SetCapture', [child]);
    assert.equal(invoke('GetCapture'), child);
    if (mode.startsWith('reparent')) {
      assert.equal(invoke('SetParent', [child, b]), a);
      if (mode === 'reparent-destroy-old') invoke('DestroyWindow', [a]);
      assert.equal(invoke('GetCapture'), child, 'surviving child retains capture');
    } else if (mode === 'transfer') {
      assert.equal(invoke('SetCapture', [b]), child);
    } else if (mode.startsWith('destroy')) {
      invoke('DestroyWindow', [mode === 'destroy-child' ? child : a]);
      assert.equal(invoke('GetCapture'), 0, 'destruction releases capture');
    }
    const destroyed = mode.startsWith('destroy');
    const [x, y] = destroyed ? [400, 250] : mode === 'transfer' ? [30, 32] : [215, 117];
    const target = mode === 'transfer' ? b : child;
    const point = mode === 'transfer' ? [-170, -68] : mode === 'held' ? [190, 90] : [10, 10];
    const expected = destroyed ? [] : [[target, 0x200, mask, ...point], [target, up, 0, ...point]];
    const before = r.inputQueue.length;
    r.handleMouseMove(x, y); r.handleMouseUp(x, y, button);
    const queued = r.inputQueue.slice(before).filter(ev => ev.type === 'mouse' && ev.msg >= 0x200).map(tuple);
    const delivered = drain();
    const record = [0, 4, 8, 12, 16].map(o => v.getUint32(wa(observed) + o, true));
    const state = new Int32Array(memory.buffer), di = BASE.DI_MOUSE_INPUT_STATE >>> 2;
    const edges = Array.from({ length: Atomics.load(state, di + 3) }, (_, i) => Atomics.load(state, di + 4 + i) >>> 28)
      .filter(type => type >= 1 && type <= 4);
    rows.push({ mode, button, expected, queued, delivered, record, edges });
    assert.deepEqual(queued, expected, mode + ' renderer events');
    assert.deepEqual(delivered, expected, mode + ' public message retrieval');
    assert.equal(record[0], destroyed ? 0 : 1, mode + ' guest receives UP exactly once');
    if (!destroyed) assert.deepEqual(record.slice(1), [target, up, 0,
      (((point[1] & 0xffff) << 16) | (point[0] & 0xffff)) >>> 0]);
    assert.deepEqual(edges, button === 0 ? [1, 2] : [3, 4], 'one physical DOWN and one physical UP');
    assert.equal(r.peekKeyDownState(button === 0 ? 1 : 2), 0); assert.equal(r._mouseButtonsMask, 0);
    assert.equal(r._directMouseDown, null);
    if (!destroyed) { assert.equal(invoke('ReleaseCapture'), 1); assert.equal(invoke('ReleaseCapture'), 0); }
  } catch (error) { failures.push({ mode, button, error: error.stack }); }
  finally { host.stop({ repaint: false }); }
}
console.log(JSON.stringify({ rows, failures }, null, 2));
assert.equal(failures.length, 0, 'capture/reparent/destruction regressions');
