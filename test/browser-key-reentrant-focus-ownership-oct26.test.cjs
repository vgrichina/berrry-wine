'use strict';
// Scoped repair regression. DOM/actual-renderer helper derived byte-for-byte
// from the pinned independent fixture; its oracle remains unchanged separately.
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
test('nested actual renderer down, repeat and hide release both keys once', () => {
  const f = fixture(); const r = actualRenderer(f); let step = 0;
  r._stepWakeHooks = new Set([() => {
    if (step++ === 0) f.key('keydown', 66, 'KeyB');
    else if (step === 2) f.key('keydown', 65, 'KeyA', { repeat: true });
    else if (step === 3) f.hidden();
  }]);
  f.key('keydown'); f.blur(); f.key('keyup'); f.key('keyup', 66, 'KeyB');
  assert.equal(r.peekKeyDownState(65), 0); assert.equal(r.peekKeyDownState(66), 0);
  assert.deepEqual(Array.from(r.inputQueue, e => [e.msg, e.wParam]),
    [[256,65],[256,66],[256,65],[257,65],[257,66]]);
  assert.equal(ups(f).length, 2);
});
test('nested cancellation during release drains remaining ownership exactly once', () => {
  const f = fixture(); const r = actualRenderer(f);
  f.key('keydown'); f.key('keydown', 66, 'KeyB');
  r._stepWakeHooks = new Set([() => f.hidden()]);
  f.blur(); f.blur();
  assert.deepEqual(Array.from(r.inputQueue, e => [e.msg,e.wParam]),
    [[256,65],[256,66],[257,65],[257,66]]);
  assert.equal(r.peekKeyDownState(65),0); assert.equal(r.peekKeyDownState(66),0);
});
test('release callback replaces pending ownership without stale snapshot release', () => {
  const f = fixture(); f.key('keydown'); f.key('keydown',66,'KeyB');
  const up = f.renderer.handleKeyUp; let once = true;
  f.renderer.handleKeyUp = function(vk, info) {
    up.call(this,vk,info);
    if (once) { once = false; f.hidden(); f.key('keydown',66,'KeyB'); }
  };
  f.blur();
  assert.equal(f.held.size,1); assert.equal(ups(f).length,2);
  f.key('keyup',66,'KeyB'); assert.equal(f.held.size,0); assert.equal(ups(f).length,3);
});
test('throw after actual down delivery retains original ownership for later cancellation', () => {
  const f = fixture(); const r = actualRenderer(f); const error = new Error('publisher down');
  r._inputPendingPublishers = new Set([() => { throw error; }]);
  assert.throws(() => f.key('keydown',16,'ShiftRight',{location:2}), e => e === error);
  assert.equal(r.peekKeyDownState(16),32768);
  r._inputPendingPublishers.clear(); f.blur(); f.key('keyup',16,'ShiftRight');
  assert.equal(r.peekKeyDownState(16),0); assert.equal(ups(f).length,1);
  assert.deepEqual(ups(f)[0].slice(1),[16,{code:'ShiftRight',location:2,repeat:false}]);
});
test('throw during actual release still releases other held keys and propagates first error', () => {
  const f = fixture(); const r = actualRenderer(f);
  f.key('keydown'); f.key('keydown',66,'KeyB');
  const error = new Error('publisher up');
  r._inputPendingPublishers = new Set([() => { throw error; }]);
  assert.throws(() => f.blur(), e => e === error);
  assert.equal(r.peekKeyDownState(65),0); assert.equal(r.peekKeyDownState(66),0);
  r._inputPendingPublishers.clear(); f.blur(); f.key('keyup'); f.key('keyup',66,'KeyB');
  assert.equal(ups(f).length,2);
});
test('canceled printable down cannot resume stale char delivery or swallow later input', () => {
  const f = fixture(); const down = f.renderer.handleKeyDown;
  f.renderer.handleKeyDown = function(vk,info) { down.call(this,vk,info); f.hidden(); };
  f.key('keydown',65,'KeyA',{key:'a'});
  assert.equal(f.calls.filter(c => c[0] === 'char').length,0);
  f.renderer.handleKeyDown = down; f.hidden(false);
  f.key('keydown',66,'KeyB',{key:'b'}); f.key('keyup',66,'KeyB');
  assert.deepEqual(f.calls.filter(c => c[0] === 'char'),[['char',98]]);
});
let failed = 0;
for (const [name,fn] of tests) {
  try { fn(); console.log('PASS '+name); }
  catch(error) { failed++; console.log('FAIL '+name+': '+error.stack); }
}
console.log((tests.length-failed)+' passed; '+failed+' failed');
process.exitCode = failed ? 1 : 0;
