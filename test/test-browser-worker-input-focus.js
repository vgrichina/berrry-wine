#!/usr/bin/env node
'use strict';

// Browser Worker mode keeps the live guest main thread in slot 0. Its focus
// global is not shared with the idle local WASM instance. Keyboard routing
// must use the calling guest's live focus, not a previous slice snapshot.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createHostImports } = require('../lib/host-imports');
const { installInputHandlers } = require('../lib/renderer-input');
const { Win98Renderer } = require('../lib/renderer');
const { inputEventHwnd } = require('../lib/host-window');

const root = path.join(__dirname, '..');
const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'lib', 'guest-worker.js'), 'utf8');
const input = fs.readFileSync(path.join(root, 'lib', 'renderer-input.js'), 'utf8');
const menus = fs.readFileSync(path.join(root, 'src', '09c5-menu.wat'), 'utf8');

assert(worker.includes('focusHwnd: ex.get_focus_hwnd ? ex.get_focus_hwnd() >>> 0 : 0'),
  'guest Worker slice result should publish its live focus hwnd');
assert(/msg\.sync\.focusHwnd !== undefined[\s\S]*?ex\.set_focus\(focus\)[\s\S]*?ex\.set_focus_hwnd\(focus\)/.test(worker),
  'guest Worker should apply renderer focus with real messages before running the next slice');
assert(host.includes('self._workerFocusHwnd = r.focusHwnd | 0;'),
  'browser Worker loop should cache the focus returned by slot 0');
assert(/const ownsWindow = \(self\._hwndBase && self\._multiApp\)[\s\S]*?if \(win && win\.processId\) return win\.processId === self\.processId;[\s\S]*?return e\.hwnd >= self\._hwndBase/.test(host),
  'multi-app input should prefer recorded process ownership over a stale HWND range');
assert(/if \(win && win\.processId\) return win\.processId === self\.processId;/.test(host),
  'guest threads in one Win32 process should share ownership of queued window input');
assert(/win\.processId\s*\? win\.processId === self\.processId\s*:\s*\(!win\.wasm \|\| win\.wasm === ownerInstance\)/.test(host),
  'Worker keyboard fallback should use process ownership before legacy WASM identity');
assert(host.includes('this.renderer._guestWorkerWasms.add(this.instance);'),
  'Worker-backed renderer ownership token should be marked');
assert(input.includes('if (this._keyboardOwnerRunsInGuestWorker())'),
  'Worker-backed keyboard events should bypass direct calls into the idle instance');
assert(host.includes("workerUrl: WineAssembly.versionedUrl('lib/guest-worker.js')"),
  'guest Worker script should inherit the page source-version key');
assert(/\(func \$menu_post[\s\S]*?\$shared_post_queue_enqueue[\s\S]*?\n\s*\)/.test(menus),
  'browser-side menu commands must enter the shared owning-thread queue');

class RendererProbe {
  constructor(wasm) {
    this.inputQueue = [];
    this.windows = {};
    this.wasm = wasm;
    this.mainWasm = wasm;
    this._exited = false;
    this._guestWorkerWasms = new WeakSet([wasm]);
  }
}
installInputHandlers(RendererProbe);

let directMessages = 0;
const idleWasm = {
  exports: {
    get_focus_hwnd: () => 0x10013,
    ctrl_get_class: () => 2,
    send_message: () => { directMessages++; },
  },
};
const renderer = new RendererProbe(idleWasm);
renderer.handleKeyDown(0x43, { code: 'KeyC' });
renderer.handleKeyPress(0x43);

assert.strictEqual(directMessages, 0,
  'Worker-backed keyboard handling must not execute the idle instance');
assert.deepStrictEqual(renderer.inputQueue.map(event => [event.msg, event.wParam]), [
  [0x0100, 0x43],
  [0x0102, 0x43],
], 'Worker-backed keydown and character messages should stay ordered in the guest queue');

// An open combo's internal list can dominate the idle instance's geometry
// while live USER still focuses the combo. A zero shadow is not proof that
// the Worker needs a focus transition before its next key.
let focusSeeds = 0;
let shadowReads = 0;
const popupWasm = { exports: {
  get_focus_hwnd() { shadowReads++; return 0; },
  wnd_child_from_point_deep() { throw Error('Worker popup must not be a focus seed'); },
  wnd_client_screen_x: () => 0,
  wnd_screen_w: () => 180,
  set_focus_hwnd() { focusSeeds++; },
} };
const popupRenderer = new RendererProbe(popupWasm);
popupRenderer._guestWorkerFocusPublishers = new Set([() => { focusSeeds++; }]);
popupRenderer.handleKeyDown(0x28, { code: 'ArrowDown' });
assert.strictEqual(shadowReads, 0, 'Worker focus seeding must not consult the idle shadow');
assert.strictEqual(focusSeeds, 0, 'opening a popup must not publish a speculative focus change');
assert.strictEqual(popupRenderer.inputQueue[0].hwnd || 0, 0,
  'popup arrow stays untargeted so live USER focus selects its receiver');

let fallbackCalls = 0;
const fallbackHwnd = () => { fallbackCalls++; return 0x10002; };
assert.strictEqual(inputEventHwnd(
  { type: 'key', hwnd: 0, msg: 0x0100, wParam: 0x27 },
  { get_focus_hwnd: () => 0 }, null, fallbackHwnd), 0x10002,
'zero-focus Worker keyboard input should target its active visible form');
assert.strictEqual(inputEventHwnd(
  { type: 'key', hwnd: 0, msg: 0x0100, wParam: 0x27 },
  { get_focus_hwnd: () => 0x10013 }, null, fallbackHwnd), 0x10013,
'a focused child must win over the active-window fallback');
assert.strictEqual(fallbackCalls, 1,
  'active-window fallback should only run when the Worker publishes no focus');

// Mouse focus used to have only the keyboard half of the Worker guard. A
// Win16 menu click first called set_focus on the idle browser instance, which
// entered an x86 wndproc with slot 0's EIP/selectors absent and trapped before
// menu_handle_bar_click could run.
const canvas = {
  getContext() {
    return {
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
      clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {},
      measureText() { return { width: 0 }; },
      drawImage() {}, putImageData() {},
      getImageData() { return { data: new Uint8ClampedArray(4) }; },
    };
  },
};
const menuRenderer = new Win98Renderer(canvas);
let shadowFocus = 0;
let liveFocusCalls = 0;
let menuClicks = 0;
const focusRequests = [];
let menuOpenHwnd = 0;
let menuActivations = 0;
const workerOwnedWasm = {
  exports: {
    get_focus_hwnd: () => shadowFocus,
    set_focus() {
      liveFocusCalls++;
      throw new WebAssembly.RuntimeError('idle Worker ownership token executed');
    },
    set_focus_hwnd(hwnd) { shadowFocus = hwnd | 0; },
    menu_bar_count(hwnd) { return hwnd === 0x10002 ? 1 : 0; },
    menu_handle_bar_click() { menuClicks++; return 1; },
    menu_open_hwnd() { return menuOpenHwnd; },
    menu_handle_mouse_open() {
      menuActivations++;
      menuOpenHwnd = 0;
      return 1;
    },
  },
};
menuRenderer.wasm = workerOwnedWasm;
menuRenderer.mainWasm = workerOwnedWasm;
menuRenderer._guestWorkerWasms = new WeakSet([workerOwnedWasm]);
menuRenderer._guestWorkerFocusPublishers = new Set([
  (wasm, hwnd) => focusRequests.push({ wasm, hwnd }),
]);
menuRenderer._ensureWatMenu = () => {};
menuRenderer.windows[0x10002] = {
  hwnd: 0x10002, visible: true, isChild: false,
  x: 10, y: 10, w: 300, h: 220, style: 0, zOrder: 1,
  hasCaption: false, _menuId: 1, wasm: workerOwnedWasm,
};
menuRenderer.handleMouseDown(40, 30, 0);
assert.strictEqual(liveFocusCalls, 0,
  'Worker-backed mouse focus must not execute the idle browser WASM instance');
assert.strictEqual(shadowFocus, 0x10002,
  'renderer shadow focus should still follow the clicked Worker-owned window');
assert.deepStrictEqual(focusRequests, [{ wasm: workerOwnedWasm, hwnd: 0x10002 }],
  'Worker-backed mouse focus should request the same transition in live slot 0');
assert.strictEqual(menuClicks, 1,
  'Worker-backed Win16 menu click should reach the menu tracker after focus routing');

// A guest can install its menu before the renderer gets the window record.
// The canonical WAT menu still exists when the optional host mirror is absent.
menuRenderer.handleMouseUp(40, 30, 0);
delete menuRenderer.windows[0x10002]._menuId;
menuRenderer.handleMouseDown(40, 30, 0);
assert.strictEqual(menuClicks, 2,
  'Worker menu installed before its renderer record still reaches the tracker');
assert.strictEqual(liveFocusCalls, 0,
  'canonical menu discovery must not enter the idle guest focus callback');

// Menu activation runs synchronously in the renderer's idle ownership token.
// The WAT helper puts WM_COMMAND into shared memory, but a Worker parked in
// GetMessage still needs an explicit slice wake because no JS input was queued.
menuRenderer.handleMouseUp(40, 30, 0);
menuOpenHwnd = 0x10002;
const wakes = [];
menuRenderer._inputPendingPublishers = new Set([
  (depth, wake) => wakes.push({ depth, wake }),
]);
menuRenderer.handleMouseDown(40, 60, 0);
assert.strictEqual(menuActivations, 1,
  'open Worker-owned menu should route selection through the menu tracker');
assert(wakes.some(item => item.depth === 0 && item.wake === true),
  'menu WM_COMMAND should force a Worker slice even with no browser input queued');

console.log('PASS browser Worker keyboard and menu input avoid the idle WASM instance');

// Exercise the actual browser host closures, not a regex describing a focus
// guess. Within one Worker slice the guest may reject mouse activation, or
// redirect focus in a callback; neither waits for the next slice snapshot.
const context = { console, createHostImports, inputEventHwnd,
  require: require('module').createRequire(path.join(root, 'host.js')) };
vm.runInNewContext(host + '\n;globalThis.WineAssembly = WineAssembly;', context);
for (const threaded of [false, true]) {
  const wine = new context.WineAssembly();
  wine.memory = { buffer: new ArrayBuffer(65536) };
  wine.instance = { exports: { get_focus_hwnd() {
    throw new Error('input router consulted idle/stale browser focus');
  } } };
  wine.guestWorker = threaded ? {} : null;
  wine._workerFocusHwnd = 0x1111; // Deliberately stale throughout this slice.
  wine.logToUI = () => {};
  const r = new Win98Renderer(canvas);
  r.wasm = wine.instance;
  r.windows[0x2222] = { hwnd: 0x2222, visible: true, isChild: false,
    zOrder: 1, wasm: wine.instance };
  wine.renderer = r;
  const h = wine.getImports().host;
  r.inputQueue.push({ type: 'mouse', hwnd: 0x2222, msg: 0x201, wParam: 1 });
  assert.strictEqual(h.check_input(), 0x10201);
  assert.strictEqual(wine._workerFocusHwnd, 0x1111,
    'dequeue is not a focus decision, even for an activation-bearing down');
  assert.strictEqual(h.check_input_hwnd(0x3333), 0x2222, 'explicit pointer target wins');
  for (const focus of [0x3333, 0x4444]) {
    r.inputQueue.push({ type: 'key', hwnd: 0, msg: 0x100, wParam: 65 });
    assert.strictEqual(h.check_input(), (65 << 16) | 0x100);
    assert.strictEqual(h.check_input_hwnd(focus), focus,
      'rapid following key uses guest focus after veto or callback redirection');
    assert.strictEqual(wine._workerFocusHwnd, 0x1111, 'no snapshot update is needed');
  }
  r.inputQueue.push({ type: 'key', hwnd: 0x5555, msg: 0x100, wParam: 65 });
  h.check_input();
  assert.strictEqual(h.check_input_hwnd(0x3333), 0x5555, 'explicit injected key target remains explicit');
}
console.log('PASS browser input uses calling guest focus without speculative dequeue updates');
