'use strict';
// Cross-layer Node regression; no browser, guest or runtime qualification.
// DOM scaffolding adapted from browser-key-focus-release-oct26.test.cjs at
// 2b5eaa0b0db6ef12882a38b6cd143291144d4150. No key callback mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const bridgePath = process.env.BROWSER_INPUT_SOURCE || path.join(__dirname, '../lib/browser-input.js');
const rendererPath = process.env.RENDERER_INPUT_SOURCE || path.join(__dirname, '../lib/renderer-input.js');
const source = fs.readFileSync(bridgePath, 'utf8');
const rendererSource = fs.readFileSync(rendererPath);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
// Immutable production inputs and actual require closure, checked before cases.
assert.equal(hash(source), '9732e516772572e3a8e7ce972cdb73477efa6e965ba299654a632c9979b42b05');
assert.equal(hash(rendererSource), '209e06f67ec38940ecab071890a296e665500e43a52b9bd96abd4ec90fccf304');
const { installInputHandlers } = require(rendererPath);
class Input {
  constructor() {
    this.inputQueue = [];
    // One real fixed 64KiB linear memory; no guest module, compile or exports.
    this.wasmMemory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    this.wasm = { exports: { memory: this.wasmMemory } };
    this.windows = { 1: { hwnd: 1, visible: true, x: 0, y: 0, w: 640, h: 480,
      wasm: this.wasm, wasmMemory: this.wasmMemory } };
    // Select the real renderer's queued guest-worker delivery route. This is
    // an ownership token, not a running worker or a simulated guest handler.
    this._guestWorkerWasms = new Set([this.wasm]);
  }
}
installInputHandlers(Input);
function fixture() {
  let document, window;
  class Target {
    constructor(tagName) {
      this.tagName = tagName; this.listeners = new Map(); this.style = {};
      this.classList = { toggle() {}, contains() { return false; }, remove() {} };
      this.value = ''; this.width = 640; this.height = 480;
    }
    addEventListener(type, fn, options) {
      const capture = options === true || !!(options && options.capture);
      const entries = this.listeners.get(type) || [];
      if (!entries.some(x => x.fn === fn && x.capture === capture)) entries.push({ fn, capture });
      this.listeners.set(type, entries);
    }
    removeEventListener(type, fn, options) {
      const capture = options === true || !!(options && options.capture);
      this.listeners.set(type, (this.listeners.get(type) || []).filter(x => x.fn !== fn || x.capture !== capture));
    }
    setAttribute(name, value) { this[name] = value; }
    contains(el) { return el === this || el.parent === this; }
    closest(selector) {
      if (selector === '[data-wine-page-dialog]' && this.pageDialog) return this;
      return null;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 480 }; }
    focus() {
      if (document.activeElement === this) return;
      const old = document.activeElement;
      if (old) dispatch(old, 'blur', {}, false);
      document.activeElement = this;
      dispatch(this, 'focus', {}, false);
    }
    blur() {
      if (document.activeElement === this) {
        document.activeElement = document.body;
        dispatch(this, 'blur', {}, false);
      }
    }
  }
  window = new Target(); document = new Target();
  const canvas = new Target('CANVAS'), proxy = new Target('TEXTAREA');
  const toolbar = new Target('DIV');
  document.body = new Target('BODY'); document.documentElement = new Target('HTML');
  document.activeElement = canvas; document.hidden = false; document.visibilityState = 'visible';
  document.getElementById = id => ({ 'mobile-keyboard-proxy': proxy, toolbar })[id] || null;
  document.querySelectorAll = () => []; document.elementFromPoint = () => null;
  function dispatch(target, type, props = {}, bubbles = true) {
    const e = { type, target, preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; }, ...props };
    const chain = target === window ? [window] : target === document ? [window, document] : [window, document, target];
    for (const node of chain) {
      for (const x of [...(node.listeners.get(type) || [])]) if (x.capture) x.fn(e);
      if (e.stopped) return e;
    }
    const bubbleChain = bubbles ? [...chain].reverse() : [target];
    for (const node of bubbleChain) {
      for (const x of [...(node.listeners.get(type) || [])]) if (!x.capture) x.fn(e);
      if (e.stopped) break;
    }
    return e;
  }
  const renderer = new Input();
  const timers = new Map(); let timer = 0;
  const context = { window, document, Node: Target, module: { exports: {} },
    setInterval(fn) { timers.set(++timer, fn); return timer; }, clearInterval(id) { timers.delete(id); },
    setTimeout() { return ++timer; }, clearTimeout() {}, performance: { now: () => 1 } };
  vm.runInNewContext(source, context, { filename: bridgePath, timeout: 1000 });
  context.module.exports.wireCanvasInput(canvas, renderer, { runningApps: [{ wine: { running: true } }] });
  const key = (type, vk = 65, code = 'KeyA', extra = {}) => dispatch(extra.target || canvas, type,
    { keyCode: vk, code, key: 'Unidentified', location: 0, repeat: false, ...extra });
  const blur = () => dispatch(window, 'blur', {}, false);
  const hidden = (value = true) => {
    document.hidden = value; document.visibilityState = value ? 'hidden' : 'visible';
    dispatch(document, 'visibilitychange');
  };
  return { key, blur, hidden, document, window, canvas, proxy, toolbar, Target, dispatch, renderer };
}

// Expectations come from keyboardMessageLParam and the accepted physical /
// side-polling contracts: physical state changes immediately; takeInput applies
// queued side snapshots. Aggregate low-bit rearming remains legacy behavior.
const families = [
  { vk: 16, name: 'Shift', left: 160, right: 161, scans: [0x2a, 0x36] },
  { vk: 17, name: 'Control', left: 162, right: 163, scans: [0x1d, 0x1d] },
  { vk: 18, name: 'Alt', left: 164, right: 165, scans: [0x38, 0x38] },
];
const tests = [];
const test = (group, name, fn) => tests.push({ group, name, fn });
const keys = g => [g.vk, g.left, g.right];
const state = (r, g, method) => keys(g).map(k => r[method](k));
const physical = (r, g, expected) => assert.deepEqual(state(r, g, 'peekKeyDownState'), expected, 'physical aggregate/left/right');
const polling = (r, g, expected) => {
  assert.deepEqual(state(r, g, 'peekAsyncKeyState'), expected, 'delivered aggregate/left/right');
  assert.deepEqual(keys(g).map(k => r.getAsyncKeyState(k) & 0x8000), expected, 'public polling held bits');
};
const send = (f, g, side, type, extra = {}) => f.key(type, g.vk, g.name + side,
  { location: side === 'Left' ? 1 : 2, ...extra });
function message(e, g, side, up, previous = up) {
  assert.ok(e, 'real renderer must deliver an event');
  assert.equal(e.type, 'key'); assert.equal(e.wParam, g.vk);
  const system = g.name === 'Alt';
  assert.equal(e.msg, system ? (up ? 0x105 : 0x104) : (up ? 0x101 : 0x100));
  assert.equal(e.lParam & 0xffff, 1, 'repeat count');
  assert.equal((e.lParam >>> 16) & 0xff, g.scans[side === 'Left' ? 0 : 1], 'original physical scan preserved');
  assert.equal((e.lParam >>> 24) & 1, side === 'Right' && g.name !== 'Shift' ? 1 : 0, 'extended scan preserved');
  assert.equal((e.lParam >>> 30) & 1, previous ? 1 : 0, 'previous state');
  assert.equal(e.lParam >>> 31, up ? 1 : 0, 'transition state');
}
function drain(r) {
  const out = [];
  for (let i = 0; i < 32; i++) {
    const e = r.takeInput();
    if (!e) { assert.equal(r.inputQueue.length, 0); return out; }
    out.push(e);
  }
  throw Error('bounded keyboard queue did not drain');
}
const released = r => drain(r).filter(e => e.msg === 0x101 || e.msg === 0x105);
function exactlyOneRelease(r, g, side) {
  const ups = released(r);
  assert.equal(ups.length, 1, 'release must reach renderer delivery exactly once');
  message(ups[0], g, side, true);
}

for (const g of families) {
  for (const side of ['Left', 'Right']) for (const cancel of ['blur', 'hidden']) {
    test('cancellation', `${g.name}${side} ${cancel} releases actual delivery once`, () => {
      const f = fixture(), r = f.renderer;
      assert.equal(r.handleKeyDown, Input.prototype.handleKeyDown, 'unwrapped real down');
      assert.equal(r.handleKeyUp, Input.prototype.handleKeyUp, 'unwrapped real up');
      assert.equal(r.wasmMemory.buffer.byteLength, 65536, 'bounded real memory');
      send(f, g, side, 'keydown');
      const held = [32768, side === 'Left' ? 32768 : 0, side === 'Right' ? 32768 : 0];
      physical(r, g, held);
      assert.equal(r.getAsyncKeyState(side === 'Left' ? g.left : g.right), 0x8001);
      message(r.takeInput(), g, side, false, false);
      polling(r, g, held);
      f[cancel]();
      physical(r, g, [0, 0, 0]);
      exactlyOneRelease(r, g, side);
      polling(r, g, [0, 0, 0]);
      f.blur(); f.hidden(); f.blur();
      send(f, g, side, 'keyup'); send(f, g, side, 'keyup');
      assert.deepEqual(drain(r), [], 'stale ups and repeated cancellation deliver nothing');
      physical(r, g, [0, 0, 0]); polling(r, g, [0, 0, 0]);
    });
  }
  for (const firstRelease of ['Left', 'Right']) {
    test('ownership', `${g.name} both held, ${firstRelease} up then final blur`, () => {
      const f = fixture(), r = f.renderer;
      const remaining = firstRelease === 'Left' ? 'Right' : 'Left';
      send(f, g, 'Left', 'keydown'); send(f, g, 'Right', 'keydown');
      physical(r, g, [32768, 32768, 32768]);
      message(r.takeInput(), g, 'Left', false, false);
      polling(r, g, [32768, 32768, 0]);
      message(r.takeInput(), g, 'Right', false, false);
      polling(r, g, [32768, 32768, 32768]);
      send(f, g, firstRelease, 'keyup');
      const held = [32768, remaining === 'Left' ? 32768 : 0, remaining === 'Right' ? 32768 : 0];
      physical(r, g, held);
      exactlyOneRelease(r, g, firstRelease); polling(r, g, held);
      send(f, g, firstRelease, 'keyup');
      assert.deepEqual(drain(r), [], 'stale side up cannot release remaining side');
      physical(r, g, held); polling(r, g, held);
      f.blur(); exactlyOneRelease(r, g, remaining);
      physical(r, g, [0, 0, 0]); polling(r, g, [0, 0, 0]);
      f.hidden(); assert.deepEqual(drain(r), []);
    });
  }
  test('timeline', `${g.name} hidden while both downs queued preserves delivery snapshots`, () => {
    const f = fixture(), r = f.renderer;
    send(f, g, 'Left', 'keydown'); send(f, g, 'Right', 'keydown'); f.hidden();
    physical(r, g, [0, 0, 0]);
    // Upfront polling may still reflect in-flight downs; never demand it
    // clear before their ordered releases have actually been delivered.
    const expected = [[32768,32768,0], [32768,32768,32768], [32768,0,32768], [0,0,0]];
    for (let i = 0; i < 4; i++) {
      message(r.takeInput(), g, i % 2 ? 'Right' : 'Left', i >= 2, i >= 2);
      physical(r, g, [0, 0, 0]); polling(r, g, expected[i]);
    }
    assert.deepEqual(drain(r), []);
    f.blur(); send(f, g, 'Left', 'keyup'); send(f, g, 'Right', 'keyup');
    assert.deepEqual(drain(r), []);
  });
  test('focus-transfer', `${g.name} repeats, input focus, metadata-changing up and fresh press`, () => {
    const f = fixture(), r = f.renderer;
    send(f, g, 'Right', 'keydown');
    send(f, g, 'Right', 'keydown');
    send(f, g, 'Right', 'keydown', { repeat: true });
    message(r.takeInput(), g, 'Right', false, false);
    message(r.takeInput(), g, 'Right', false, true);
    message(r.takeInput(), g, 'Right', false, true);
    assert.deepEqual(drain(r), []);
    const input = new f.Target('INPUT'); input.focus();
    assert.equal(f.document.activeElement, input);
    physical(r, g, [32768, 0, 32768]);
    assert.deepEqual(drain(r), [], 'element focus transfer is not global cancellation');
    // Page controls do not acquire new bridge ownership. Existing ownership
    // still releases through window capture despite a control stopping bubble.
    send(f, g, 'Left', 'keydown', { target: input });
    input.addEventListener('keyup', e => e.stopPropagation());
    f.key('keyup', 222, g.name + 'Right', { location: 0, target: input });
    exactlyOneRelease(r, g, 'Right');
    physical(r, g, [0, 0, 0]); polling(r, g, [0, 0, 0]);
    send(f, g, 'Right', 'keyup', { target: input }); f.blur();
    assert.deepEqual(drain(r), []);
    f.canvas.focus(); send(f, g, 'Right', 'keydown');
    message(r.takeInput(), g, 'Right', false, false);
    f.hidden(); exactlyOneRelease(r, g, 'Right');
    physical(r, g, [0, 0, 0]); polling(r, g, [0, 0, 0]);
  });
}

test('legacy-contract', 'aggregate low-bit rearming on delivery is preserved', () => {
  const f = fixture(), r = f.renderer, g = families[0];
  send(f, g, 'Left', 'keydown');
  assert.equal(r.getAsyncKeyState(g.vk), 0x8001);
  assert.equal(r.getAsyncKeyState(g.left), 0x8001);
  message(r.takeInput(), g, 'Left', false, false);
  assert.equal(r.getAsyncKeyState(g.vk), 0x8001, 'legacy aggregate rearmed by queued down');
  assert.equal(r.getAsyncKeyState(g.left), 0x8000, 'side bit does not rearm');
  f.blur(); exactlyOneRelease(r, g, 'Left'); polling(r, g, [0, 0, 0]);
});

// Deliberately sever one seam in separate executions of this same file. The
// runner requires exit 1 and the exact downstream assertion, not any failure.
test('negative-control', 'broken release is caught downstream of the bridge', () => {
  const mode = process.env.FOCUS_INTEROP_NEGATIVE;
  assert.ok(mode === 'bridge-release' || mode === 'renderer-keyup');
  const f = fixture(), r = f.renderer, g = families[0];
  send(f, g, 'Right', 'keydown'); message(r.takeInput(), g, 'Right', false, false);
  if (mode === 'bridge-release') {
    // Remove the real bridge blur listener, without changing production bytes.
    f.window.listeners.set('blur', []);
  } else {
    // Negative control alone replaces keyup; positive cases never wrap it.
    r.handleKeyUp = () => {};
  }
  f.blur(); exactlyOneRelease(r, g, 'Right');
});

const selected = process.env.FOCUS_INTEROP_GROUP;
assert.ok(selected, 'select one finite group via FOCUS_INTEROP_GROUP');
const cases = tests.filter(t => t.group === selected);
assert.ok(cases.length, 'known group required');
let failed = 0;
for (const t of cases) {
  try { t.fn(); console.log('PASS ' + t.name); }
  catch (e) { failed++; console.log('FAIL ' + t.name + '\n' + e.stack); }
}
console.log(JSON.stringify({ group: selected, pass: cases.length - failed, fail: failed,
  bridgeSha256: hash(source), rendererSha256: hash(rendererSource) }));
process.exitCode = failed ? 1 : 0;
