'use strict';
// Independent acceptance oracles. DOM helper derived from the unchanged pinned
// reproducer; production bridge runs in a fresh VM for every challenge.
// No browser/runtime claim. Renderer callback case runs actual pinned methods.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(process.env.BROWSER_INPUT_SOURCE ||
  path.join(__dirname, '../lib/browser-input.js'), 'utf8');
function fixture(appOptions = {}) {
  const calls = [], held = new Map();
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
      if (old) { document.activeElement = document.body; dispatch(old, 'blur', {}, false); }
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
  const identity = (vk, info) => info.code || `${vk}:${info.location}`;
  const renderer = {
    windows: { 1: { visible: true, x: 0, y: 0, w: 640, h: 480 } },
    handleKeyDown(vk, info) { calls.push(['down', vk, { ...info }]); held.set(identity(vk, info), vk); },
    handleKeyUp(vk, info) { calls.push(['up', vk, { ...info }]); held.delete(identity(vk, info)); },
    handleKeyPress(c) { calls.push(['char', c]); },
    handleCompositionStart() { calls.push(['compositionstart']); },
    handleCompositionUpdate(s) { calls.push(['compositionupdate', s]); },
    handleCompositionEnd(s) { calls.push(['compositionend', s]); },
    handleMouseDown(x, y, b) { calls.push(['mouseDown', x, y, b]); },
    handleMouseUp(x, y, b) { calls.push(['mouseUp', x, y, b]); },
    _unmapExclusiveInputPoint() { return { x: 12, y: 13 }; },
    handleMouseMove() {}, handleMenuHover() {},
  };
  const timers = new Map(); let timer = 0;
  const context = { window, document, Node: Target, module: { exports: {} },
    setInterval(fn) { timers.set(++timer, fn); return timer; }, clearInterval(id) { timers.delete(id); },
    setTimeout() { return ++timer; }, clearTimeout() {}, performance: { now: () => 1 } };
  vm.runInNewContext(source, context, { filename: 'browser-input.js' });
  context.module.exports.wireCanvasInput(canvas, renderer, { runningApps: [{ wine: { running: true }, ...appOptions }] });
  const key = (type, vk = 65, code = 'KeyA', extra = {}) => dispatch(extra.target || canvas, type,
    { keyCode: vk, code, key: 'Unidentified', location: 0, repeat: false, ...extra });
  const blur = () => dispatch(window, 'blur', {}, false);
  const hidden = (value = true) => {
    document.hidden = value; document.visibilityState = value ? 'hidden' : 'visible';
    dispatch(document, 'visibilitychange');
  };
  return { key, blur, hidden, calls, held, document, window, canvas, proxy, toolbar, Target, dispatch, renderer };
}

const crypto = require('node:crypto');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const rendererSource = fs.readFileSync(path.join(__dirname, '../lib/renderer-input.js'), 'utf8');
function actualRenderer(f) {
  const scope = { module: { exports: {} }, RegionMap: { BASE: { DI_MOUSE_INPUT_STATE: 0 } }, memUtils: {} };
  vm.runInNewContext(rendererSource, scope, { filename: 'renderer-input.js' });
  function R() {}
  scope.module.exports.installInputHandlers(R);
  const r = f.renderer;
  Object.setPrototypeOf(r, R.prototype);
  const wasm = { exports: {} };
  r.wasm = wasm; r._guestWorkerWasms = new Set([wasm]); r.inputQueue = [];
  // No guest execution. Real production worker-owned queue route, with no memory.
  for (const method of ['handleKeyDown', 'handleKeyUp']) {
    delete r[method];
    const original = r[method];
    r[method] = function(vk, info) {
      f.calls.push([method === 'handleKeyDown' ? 'down' : 'up', vk, { ...info }]);
      return original.call(this, vk, info);
    };
  }
  return r;
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const ups = f => f.calls.filter(c => c[0] === 'up');
test('capture routing, repeated downs and cancellation are balanced exactly once', () => {
  const f = fixture(); const order = [];
  f.canvas.addEventListener('keydown', () => { order.push(f.calls.length); });
  f.key('keydown', 65, 'KeyA'); f.key('keydown', 65, 'KeyA', { repeat: true });
  assert.deepEqual(order, [1, 2]); f.hidden(); f.blur(); f.hidden();
  f.key('keyup', 65, 'KeyA'); f.key('keyup', 66, 'KeyB');
  assert.deepEqual(ups(f), [['up', 65, { code: 'KeyA', location: 0, repeat: false }]]);
  assert.equal(f.held.size, 0);
});
test('both modifier sides preserve first metadata across shifted layout keyup', () => {
  const f = fixture();
  f.key('keydown', 16, 'ShiftLeft', { location: 1 });
  f.key('keydown', 16, 'ShiftRight', { location: 2 });
  f.key('keydown', 50, 'Digit2', { key: '@', shiftKey: true });
  f.key('keyup', 222, 'Digit2', { key: '"', location: 3 });
  f.key('keyup', 161, 'ShiftRight', { location: 0 }); f.blur();
  assert.deepEqual(ups(f).map(c => [c[1], c[2].code, c[2].location]),
    [[50, 'Digit2', 0], [16, 'ShiftRight', 2], [16, 'ShiftLeft', 1]]);
  assert.equal(f.held.size, 0);
});
test('real focus transition to page input preserves ownership until captured up', () => {
  const f = fixture(); const input = new f.Target('INPUT');
  f.key('keydown'); input.focus(); assert.equal(f.document.activeElement, input);
  assert.equal(ups(f).length, 0);
  input.addEventListener('keyup', e => e.stopPropagation());
  f.key('keyup', 65, 'KeyA', { target: input });
  f.key('keydown', 66, 'KeyB', { target: input }); f.blur();
  assert.equal(ups(f).length, 1); assert.equal(f.held.size, 0);
});
test('proxy focus and composition retain independent physical ownership', () => {
  const f = fixture(); f.key('keydown', 17, 'ControlLeft', { location: 1 });
  f.proxy.focus(); f.dispatch(f.proxy, 'compositionstart');
  f.dispatch(f.proxy, 'compositionupdate', { data: '文' });
  assert.equal(ups(f).length, 0); f.hidden();
  assert.deepEqual(ups(f), [['up', 17, { code: 'ControlLeft', location: 1, repeat: false }]]);
  assert.equal(f.calls.filter(c => c[0] === 'compositionend').length, 0);
  f.dispatch(f.proxy, 'compositionend', { data: '文' });
  f.proxy.value = '文'; f.dispatch(f.proxy, 'input');
  assert.equal(f.calls.filter(c => c[0] === 'compositionend').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'char').length, 0);
});
test('swallowed Alt Enter stays unowned across cancellation and next plain Enter', () => {
  const f = fixture({ altEnterFullscreen: true }); let toggle = 0;
  f.window.approveBrowserFullscreen = () => toggle++;
  f.key('keydown', 18, 'AltRight', { location: 2 });
  f.key('keydown', 13, 'Enter', { altKey: true });
  f.key('keydown', 13, 'Enter', { altKey: true, repeat: true });
  f.hidden(); f.key('keyup', 13, 'Enter'); f.key('keyup', 18, 'AltRight');
  assert.equal(toggle, 1); assert.deepEqual(ups(f).map(x => x[1]), [18]);
  f.hidden(false); f.key('keydown', 13, 'Enter'); f.key('keyup', 13, 'Enter');
  assert.deepEqual(ups(f).map(x => x[1]), [18, 13]); assert.equal(f.held.size, 0);
});
test('actual production renderer queue receives ordinary cancellation release', () => {
  const f = fixture(); const r = actualRenderer(f);
  f.key('keydown'); assert.equal(r.peekKeyDownState(65), 0x8000);
  f.blur(); assert.equal(r.peekKeyDownState(65), 0);
  assert.deepEqual(Array.from(r.inputQueue, e => e.msg), [0x100, 0x101]);
  f.hidden(); f.key('keyup'); assert.equal(r.inputQueue.length, 2);
});
test('actual renderer wake callback hiding document during down cannot leak ownership', () => {
  const f = fixture(); const r = actualRenderer(f); let calls = 0;
  const wake = () => { calls++; r._stepWakeHooks.delete(wake); f.hidden(); };
  r._stepWakeHooks = new Set([wake]);
  f.key('keydown', 65, 'KeyA');
  assert.equal(calls, 1); assert.equal(f.document.hidden, true);
  // The hook runs after the actual renderer recorded and queued the down.
  console.log('OBSERVED callback-hidden=' + f.document.hidden +
    ' physical=' + r.peekKeyDownState(65) + ' queue=' + JSON.stringify(r.inputQueue));
  assert.equal(r.peekKeyDownState(65), 0, 'hidden cancellation must release down already delivered by production renderer');
  assert.deepEqual(Array.from(r.inputQueue, e => e.msg), [0x100, 0x101]);
});
const selected = process.env.ONLY_GROUP ? tests.filter(x => x[0].includes(process.env.ONLY_GROUP)) : tests;
assert.ok(selected.length);
let failed = 0; const results = [];
for (const [name, fn] of selected) {
  try { fn(); results.push({ name, pass: true }); console.log('PASS ' + name); }
  catch (error) { failed++; results.push({ name, pass: false, error: error.message, stack: error.stack }); console.log('FAIL ' + name + ': ' + error.message); }
  if (process.env.ACCEPTANCE_CHECKPOINT) {
    const dest = process.env.ACCEPTANCE_CHECKPOINT;
    fs.writeFileSync(dest + '.tmp', JSON.stringify({ candidate: process.env.CANDIDATE,
      sourceSHA256: hash(source), rendererSHA256: hash(rendererSource), fixtureSHA256: hash(fs.readFileSync(__filename)),
      results, remaining: selected.slice(results.length).map(x => x[0]),
      gates: ['publication', 'current-main integration/regressions', 'real browser/runtime qualification'],
      evidence: process.env.ACCEPTANCE_LOG, at: new Date().toISOString() }, null, 2) + '\n');
    fs.renameSync(dest + '.tmp', dest);
  }
  if (failed) break; // Preserve first failure, no expanded audit after defect.
}
console.log(results.filter(x => x.pass).length + ' passed; ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
