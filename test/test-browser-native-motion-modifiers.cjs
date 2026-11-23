#!/usr/bin/env node
'use strict';
// Independent WM_MOUSEMOVE contract: MK_SHIFT=4, MK_CONTROL=8 for keys
// currently down, combined with held mouse buttons; released keys add no bit.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove
// Real renderer/public physical handlers and receipt bridge. Native return
// memory/actor calls are driven here; this is not a trusted browser/guest run.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const { createBrowserNativeInput } = require('../lib/browser-native-input');
const sl = [16, { code: 'ShiftLeft', location: 1 }];
const sr = [16, { code: 'ShiftRight', location: 2 }];
const cl = [17, { code: 'ControlLeft', location: 1 }];
const cr = [17, { code: 'ControlRight', location: 2 }];
const up = ([vk, info]) => [-vk, info];
const states = [
  ['bare', [], 0], ['Shift', [[16]], 4], ['Ctrl', [[17]], 8],
  ['both', [[16], [17]], 12], ['released', [[16], [17], [-16], [-17]], 0],
  ['left Shift', [sl], 4], ['right Shift', [sr], 4],
  ['left Ctrl', [cl], 8], ['right Ctrl', [cr], 8],
  ['Shift overlap', [sl, sr, up(sl)], 4],
  ['Ctrl overlap', [cl, cr, up(cr)], 8],
  ['all sides released', [sl, sr, cl, cr, up(sr), up(sl), up(cl), up(cr)], 0],
  ['repress', [sl, up(sl), sr, cr], 12],
  ['released stale true', [sl, cr, up(sl), up(cr)], 0, true],
];
function fixture(route, held, state) {
  let wall = Date.now(), mono = performance.now(), trusted = true;
  const rect = { left: 0, top: 0, right: 640, bottom: 480, width: 640, height: 480 };
  const canvas = { width: 640, height: 480, getBoundingClientRect: () => rect,
    getContext() { return new Proxy({}, { get: (_, k) => k === 'measureText'
      ? () => ({ width: 0 }) : () => {} }); } };
  const r = new Win98Renderer(canvas);
  const instance = { exports: {
    send_message() {},
    get_focus_hwnd: () => route === 'EDIT' ? 101 : 10,
    ctrl_get_class: h => route === 'EDIT' && h === 101 ? 2 : 0,
    wnd_mouse_msg_origin_x: () => 10, wnd_mouse_msg_origin_y: () => 20,
    wnd_window_screen_x: () => 10, wnd_window_screen_y: () => 20,
  } };
  r.wasm = instance;
  r.windows[10] = { hwnd: 10, visible: true, isChild: false, x: 10, y: 20,
    w: 200, h: 160, style: 0, zOrder: 1, wasm: instance, processId: 7 };
  // Physical buttons are pressed outside the window, avoiding drag/menu state.
  if (held & 1) r.handleMouseDown(500, 400, 0);
  if (held & 2) r.handleMouseDown(500, 400, 2);
  for (const [vk, info] of state[1]) {
    if (vk > 0) r.handleKeyDown(vk, info); else r.handleKeyUp(-vk, info);
  }
  if (route === 'EDIT' && state[2] && state[1].every(([vk]) => vk > 0))
    assert(!r._shiftDown && !r._ctrlDown, 'actual EDIT consumed before legacy assignment');
  if (state[3]) { r._shiftDown = true; r._ctrlDown = true; }
  assert.equal(!!r.peekKeyDownState(16), !!(state[2] & 4));
  assert.equal(!!r.peekKeyDownState(17), !!(state[2] & 8));
  r.inputQueue.length = 0;
  const produced = [], push = r.inputQueue.push;
  r.inputQueue.push = function(...events) {
    produced.push(...events.filter(e => e.msg === 0x200));
    return push.apply(this, events);
  };
  const scene = [1, 7, 10, 10, 0, 0, 1, 0, 1, 0];
  const wine = { renderer: r, instance, memory: { buffer: new ArrayBuffer(128) },
    _wasmModule: {}, _processObject: {}, running: true, processId: 7,
    guestWorker: { link: { slot: 0, worker: {}, endpointIdentity: 17 } },
    hostCtx: { getGlGpsBridge: () => gps } };
  const gps = { endpoint: {}, presenter: { layer: { canvas: {} } } };
  const g = createBrowserNativeInput(wine, { now: () => wall, monotonic: () => mono,
    trusted: () => trusted });
  g.withActor(0, 'check_input', () => g.observe(scene));
  const b = g.bind();
  const intent = { owner: b.owner, nonce: 'motion', kind: 'motion', code: 1,
    x: 80, y: 90, reviewed: true, reviewedAt: wall, imageSHA256: 'a'.repeat(64) };
  function consume(token, event, remove = 1) {
    const view = new DataView(wine.memory.buffer);
    ['hwnd', 'msg', 'wParam', 'lParam'].forEach((k, i) => view.setUint32(32 + i * 4, event[k] >>> 0, true));
    return g.withActor(0, 'input_consumed', () => g.consumed(token, 1, 32, 2, remove, [...scene, 32]));
  }
  return { r, g, wine, rect, intent, produced, consume, untrust() { trusted = false; },
    expire() { wall += 501; mono += 501; } };
}
const failures = [];
let count = 0;
const controls = ['none', 'wrongmask', 'point', 'untrusted', 'geometry', 'token', 'expired', 'crossprocess', 'actor'];
for (const route of ['ordinary', 'EDIT']) for (const held of [0, 1, 2, 3])
  for (const state of states) for (const fault of controls) {
    const label = `${route}/${held}/${state[0]}/${fault}`; count++;
    try {
      const f = fixture(route, held, state), { r, g } = f;
      assert.equal(g.prepare(f.intent).state, 'PREPARED');
      if (fault === 'untrusted') f.untrust();
      r.handleMouseMove(80, 90);
      assert.equal(g.status('motion').consumed, false, 'enqueue is not consumption');
      if (fault === 'untrusted') {
        assert.equal(r.inputQueue.filter(e => e.msg === 0x200).length, 0);
        assert.equal(f.produced.length, 0);
        continue;
      }
      assert.equal(f.produced.length, 1, 'real renderer produced one move');
      assert.equal(f.produced[0].wParam, held | state[2], 'independent Win32 producer mask');
      assert.equal(g.status('motion').state, 'DELIVERY_PENDING', JSON.stringify(g.status('motion')));
      // Dequeue the actual renderer edge, retaining object identity for tokens.
      const event = r.inputQueue.shift();
      assert(event); assert.equal(event.msg, 0x200);
      assert.equal(event.hwnd, 10);
      assert.equal(event.lParam >>> 0, (70 << 16) | 70);
      assert.equal(event.wParam, held | state[2], 'independent Win32 mask');
      assert.equal(r._mouseButtonsMask || 0, held);
      const token = g.withActor(0, 'check_input', () => g.dequeued(event));
      // Every negative control first establishes a genuine admissible edge.
      assert(token > 0, JSON.stringify(g.status('motion')));
      const returned = { ...event };
      if (fault === 'wrongmask') returned.wParam ^= 4;
      if (fault === 'point') returned.lParam ^= 1;
      if (fault === 'geometry') f.rect.width++;
      if (fault === 'expired') f.expire();
      if (fault === 'crossprocess') f.wine._processObject = {};
      if (fault === 'actor') f.wine.guestWorker.link = { slot: 0, worker: {}, endpointIdentity: 18 };
      const result = f.consume(fault === 'token' ? token + 999 : token, returned, fault === 'none' ? 0 : 1);
      assert.equal(result, fault === 'none' ? 1 : 0, 'native return acceptance');
      assert.equal(g.status('motion').consumed, fault === 'none');
      if (fault === 'none') {
        assert.equal(g.status('motion').receiptBoundary, 'owner-worker-native-user-return');
        assert.equal(g.status('motion').nativeMessage.wParam, held | state[2]);
        assert.equal(g.status('motion').nativeRemoval, null, 'peek does not remove');
        assert.equal(f.consume(token, returned), 1, 'removing return');
        assert(g.status('motion').nativeRemoval.remove);
        assert.equal(f.consume(token, returned), 0, 'replay rejected');
        assert.throws(() => g.prepare(f.intent), /refused/, 'nonce replay rejected');
      }
    } catch (e) { failures.push({ label, error: e.message }); }
  }
console.log(JSON.stringify({ count, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
