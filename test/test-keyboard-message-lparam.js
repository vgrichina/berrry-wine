#!/usr/bin/env node
'use strict';

// Win32 games frequently translate WM_KEYDOWN/UP from the Set-1 scan code in
// lParam instead of using wParam.  Quake II's MapKey path is one example.

const assert = require('assert');
const {
  installInputHandlers,
  keyboardMessageLParam,
} = require('../lib/renderer-input');

assert.strictEqual(keyboardMessageLParam(0x57, { code: 'KeyW' }, false, false),
  0x00110001, 'W carries Set-1 scan code 0x11 and repeat count 1');
assert.strictEqual(keyboardMessageLParam(0x26, { code: 'ArrowUp' }, false, false),
  0x01480001, 'Up carries scan code 0x48 plus the extended-key bit');
assert.strictEqual(keyboardMessageLParam(0x57, { code: 'KeyW', repeat: true }, false, true),
  0x40110001, 'repeated keydown sets the previous-state bit');
assert.strictEqual(keyboardMessageLParam(0x26, { code: 'ArrowUp' }, true, true),
  0xC1480001, 'keyup sets previous-state, transition, scan, and extended bits');
assert.strictEqual(keyboardMessageLParam(0x0D, null, false, false),
  0x001C0001, 'numeric-only CLI callers retain an Enter scan-code fallback');
// A touch-overlay button sends a bare VK. Kingpin/SiN/Hexen II strafe on , and
// . and Quake II-engine MapKey drops a scan code of 0, so every VK a layout
// can name must carry the scan code its DOM key would.
for (const [vk, code] of [
  [0xBC, 'Comma'], [0xBE, 'Period'], [0xBF, 'Slash'], [0xBA, 'Semicolon'],
  [0xDE, 'Quote'], [0xDB, 'BracketLeft'], [0xDD, 'BracketRight'], [0xDC, 'Backslash'],
  [0xC0, 'Backquote'], [0xBD, 'Minus'], [0xBB, 'Equal'],
  [0x60, 'Numpad0'], [0x62, 'Numpad2'], [0x64, 'Numpad4'], [0x65, 'Numpad5'],
  [0x66, 'Numpad6'], [0x68, 'Numpad8'], [0x69, 'Numpad9'],
]) {
  assert.strictEqual(keyboardMessageLParam(vk, null, false, false),
    keyboardMessageLParam(vk, { code }, false, false),
    `bare VK 0x${vk.toString(16)} carries ${code}'s scan code`);
}

class RendererProbe {
  constructor() {
    this.inputQueue = [];
    this.windows = {};
    this.wasm = null;
    this.mainWasm = null;
    this._exited = false;
  }
}
installInputHandlers(RendererProbe);

const renderer = new RendererProbe();
renderer.handleKeyDown(0x26, { code: 'ArrowUp' });
assert.strictEqual(renderer.peekKeyDownState(0x26), 0x8000,
  'DirectInput physical state sees a browser key press immediately');
let event = renderer.takeInput();
assert(event, 'keydown enters the normal renderer input queue');
assert.strictEqual(event.msg, 0x0100);
assert.strictEqual(event.wParam, 0x26);
assert.strictEqual(event.lParam >>> 0, 0x01480001,
  'queued WM_KEYDOWN preserves the scan-code lParam');

renderer.handleKeyUp(0x26, { code: 'ArrowUp' });
event = renderer.takeInput();
assert(event, 'keyup enters the normal renderer input queue');
assert.strictEqual(event.msg, 0x0101);
assert.strictEqual(event.lParam >>> 0, 0xC1480001,
  'queued WM_KEYUP preserves scan, extended, previous, and transition bits');

// Pause's E1 hardware sequence is represented as scan 0x45, without
// KF_EXTENDED, in legacy WM_KEY* messages (Microsoft Keyboard Input Overview).
// Exercise the real renderer queue before the pure bitfield checks: this is
// the payload consumed by the host/Worker, not a DOM delivery acknowledgement.
for (const info of [{ code: 'Pause' }, undefined]) {
  const pause = new RendererProbe();
  pause.handleKeyDown(0x13, info);
  pause.handleKeyDown(0x13, info);
  pause.handleKeyUp(0x13, info);
  assert.deepStrictEqual(pause.inputQueue.map(e =>
    [e.msg, e.wParam, e.lParam >>> 0]), [
    [0x100, 0x13, 0x00450001],
    [0x100, 0x13, 0x40450001],
    [0x101, 0x13, 0xC0450001],
  ], 'DOM Pause and numeric VK_PAUSE retain distinct native key identity');
}
for (const [vk, code, expected] of [
  [0x13, 'Pause', 0x00450001],
  [0x90, 'NumLock', 0x01450001],
  [0x91, 'ScrollLock', 0x00460001],
  [0x11, 'ControlRight', 0x011D0001],
  [0x0D, 'NumpadEnter', 0x011C0001],
  [0x26, 'ArrowUp', 0x01480001],
]) {
  assert.strictEqual(keyboardMessageLParam(vk, { code }, false, false), expected);
  assert.strictEqual(keyboardMessageLParam(vk, { code, repeat: true }, false, false),
    (expected | 0x40000000) >>> 0);
  assert.strictEqual(keyboardMessageLParam(vk, { code }, true, false),
    (expected | 0xC0000000) >>> 0);
  if (code !== 'ControlRight' && code !== 'NumpadEnter')
    assert.strictEqual(keyboardMessageLParam(vk, null, false, false), expected);
}

const directInputOnly = new RendererProbe();
directInputOnly.handleKeyDown(0x28, { code: 'ArrowDown' });
directInputOnly.handleKeyUp(0x28, { code: 'ArrowDown' });
assert.strictEqual(directInputOnly.inputQueue.length, 2,
  'the Win32 key messages remain queued for an app that does not drain them');
assert.strictEqual(directInputOnly.peekAsyncKeyState(0x28), 0x8000,
  'Win32 async state remains ordered behind the queued key-up');
assert.strictEqual(directInputOnly.peekKeyDownState(0x28), 0,
  'DirectInput physical state observes key-up without waiting for GetMessage');

// TranslateMessage copies the keystroke's lParam into the WM_CHAR. NFS II's
// lib_char loops over its repeat count, so a WM_CHAR 0x1B with lParam 0 was
// zero characters and Escape never skipped the intro movie.
const chars = new RendererProbe();
chars.handleKeyDown(0x1B, { code: 'Escape' });
chars.handleKeyPress(0x1B);
chars.handleKeyUp(0x1B, { code: 'Escape' });
assert.deepStrictEqual(chars.inputQueue.map(e => e.msg), [0x0100, 0x0102, 0x0101]);
assert.strictEqual(chars.inputQueue[1].lParam >>> 0, 0x00010001,
  'WM_CHAR carries the keydown lParam: repeat count 1, Escape scan code 0x01');
chars.handleKeyPress(0x41);
assert.strictEqual(chars.inputQueue[3].lParam >>> 0, 1,
  'a character with no keystroke behind it still has a repeat count of 1');

console.log('PASS Win32 keyboard messages preserve ordering while DirectInput tracks physical key release');

// Exercise the owning OS Worker's actual Win32 PeekMessage path. Its guest
// MSG structure must contain the independently specified lParam, after the
// unchanged renderer -> host -> shared-memory RPC transport.
async function workerGuestMessages() {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const { Worker } = require('worker_threads');
  const RPC = require('../lib/guest-rpc');
  const { createHostImports } = require('../lib/host-imports');
  const { inputEventHwnd } = require('../lib/host-window');
  const root = path.resolve(__dirname, '..');
  const context = { console, createHostImports, inputEventHwnd };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'host.js'), 'utf8') +
    '\n;globalThis.WineAssembly=WineAssembly;', context);
  const wine = new context.WineAssembly();
  wine.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  wine.instance = { exports: { get_focus_hwnd: () => 0 } };
  wine.guestWorker = {};
  wine.logToUI = () => {};
  const r = new RendererProbe();
  wine.renderer = r;
  r.wasm = r.mainWasm = wine.instance;
  r._guestWorkerWasms = new WeakSet([wine.instance]);
  const signatures = require('../lib/host-import-sigs.generated.json').sigs;
  const names = ['check_input', 'check_input_wparam', 'check_input_lparam', 'check_input_hwnd'];
  const sigs = Object.fromEntries(names.map(n => [n, signatures[n]]));
  const broker = RPC.createMainBroker(wine.memory, wine.getImports().host, sigs, {});
  const extraWat = `
    (func (export "test_keyboard_peek") (result i32)
      (local $sp i32) (local $ip i32) (local $result i32)
      (local.set $sp (i32.load offset=16 (global.get $reg_base)))
      (local.set $ip (global.get $eip))
      (call $handle_PeekMessageA_fetch (i32.const 0x3000) (i32.const 0)
        (i32.const 0x100) (i32.const 0x101) (i32.const 1) (i32.const 0))
      (local.set $result (i32.load (global.get $reg_base)))
      (i32.store offset=16 (global.get $reg_base) (local.get $sp))
      (global.set $eip (local.get $ip))
      (local.get $result))`;
  const worker = new Worker(`
    const { parentPort, workerData } = require('worker_threads');
    (async () => {
      const RPC = require(workerData.root + '/lib/guest-rpc');
      const { imports } = RPC.createWorkerImports(workerData.memory, workerData.sigs,
        m => parentPort.postMessage(m), { slot: 0 });
      const h = await require(workerData.root + '/test/render-helper').bootRenderHarness({
        memory: workerData.memory, extraWat: workerData.extraWat, fonts: 'none',
        extraHostOverrides: imports.host,
      });
      parentPort.on('message', () => {
        const rows = [];
        const msg = new DataView(workerData.memory.buffer, h.exports.get_guest_base() + 0x3000, 28);
        while (h.exports.test_keyboard_peek())
          rows.push([msg.getUint32(4, true), msg.getUint32(8, true), msg.getUint32(12, true)]);
        parentPort.postMessage({ rows });
      });
      parentPort.postMessage({ ready: true });
    })().catch(e => { throw e; });
  `, { eval: true, workerData: { root, memory: wine.memory, sigs, extraWat } });
  let resolveResult, rejectResult;
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  worker.on('message', m => {
    if (m.t === 'rpc') broker.serveRpc(m.slot);
    else if (m.ready) readyResolve();
    else resolveResult(m.rows);
  });
  worker.on('error', e => { readyReject(e); if (rejectResult) rejectResult(e); });
  const timer = setTimeout(() => { readyReject(Error('Worker deadline')); if (rejectResult) rejectResult(Error('Worker deadline')); }, 120000);
  try {
    await ready;
    for (const info of [{ code: 'Pause' }, undefined]) {
      r.handleKeyDown(19, info); r.handleKeyDown(19, info); r.handleKeyUp(19, info);
      broker.publish({ inputPending: r.inputQueue.length });
      const result = new Promise((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
      worker.postMessage({ drain: true });
      assert.deepStrictEqual(await result, [
        [0x100, 19, 0x00450001], [0x100, 19, 0x40450001], [0x101, 19, 0xC0450001],
      ], 'owning Worker Win32 MSG carries Pause scan on DOM-code and bare-VK paths');
    }
    console.log('PASS actual owning OS Worker PeekMessage guest MSG Pause down/repeat/up through production RPC');
  } finally { clearTimeout(timer); await worker.terminate(); }
}
workerGuestMessages().catch(e => { console.error(e); process.exitCode = 1; });
