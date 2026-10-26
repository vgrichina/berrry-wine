'use strict';
// Run in one bounded Node process; each fixture executes the actual bridge in
// a fresh VM. DOM capture/bubble order matters, especially for element blur.
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
  return { key, blur, hidden, calls, held, document, window, canvas, proxy, toolbar, Target, dispatch };
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const ups = f => f.calls.filter(c => c[0] === 'up');
test('delivered down followed by window blur releases guest once', () => {
  const f = fixture(); f.key('keydown'); assert.equal(f.held.size, 1);
  f.blur(); assert.equal(f.held.size, 0); assert.equal(ups(f).length, 1);
});
test('hidden cancellation releases without a blur', () => {
  const f = fixture(); f.key('keydown'); f.hidden();
  assert.equal(f.held.size, 0); assert.equal(ups(f).length, 1);
});
test('repeated blur/hidden, stale keyup, and focus recovery do not duplicate release', () => {
  const f = fixture(); f.key('keydown'); f.blur(); f.hidden(); f.blur(); f.hidden();
  assert.equal(f.held.size, 0); assert.equal(ups(f).length, 1);
  f.key('keyup'); assert.equal(ups(f).length, 1);
  f.hidden(false); f.key('keydown'); f.key('keyup'); f.blur();
  assert.equal(ups(f).length, 2); assert.equal(f.held.size, 0);
});
test('repeat and duplicate downs retain delivery but own one release', () => {
  const f = fixture(); f.key('keydown'); f.key('keydown'); f.key('keydown', 65, 'KeyA', { repeat: true });
  assert.equal(f.calls.filter(c => c[0] === 'down').length, 3);
  assert.equal(f.calls[2][2].repeat, true); f.blur();
  assert.deepEqual(ups(f), [['up', 65, { code: 'KeyA', location: 0, repeat: false }]]);
});
test('two modifier sides and chord retain original down metadata', () => {
  const f = fixture();
  f.key('keydown', 17, 'ControlLeft', { location: 1 });
  f.key('keydown', 17, 'ControlRight', { location: 2 });
  f.key('keydown', 16, 'ShiftRight', { location: 2 });
  f.key('keydown', 90, 'KeyZ', { ctrlKey: true, shiftKey: true });
  f.key('keyup', 17, 'ControlLeft', { location: 1 }); f.blur();
  assert.equal(f.held.size, 0);
  assert.deepEqual(ups(f).map(c => [c[1], c[2].code, c[2].location, c[2].repeat]),
    [[17, 'ControlLeft', 1, false], [17, 'ControlRight', 2, false], [16, 'ShiftRight', 2, false], [90, 'KeyZ', 0, false]]);
});
test('fallback code-less ownership distinguishes side/location and VK', () => {
  const f = fixture(); f.key('keydown', 16, '', { location: 1 });
  f.key('keydown', 16, '', { location: 2 }); f.key('keydown', 66, '');
  f.hidden(); assert.equal(f.held.size, 0); assert.equal(ups(f).length, 3);
});
test('normal keyup retires ownership before cancellation', () => {
  const f = fixture(); f.key('keydown'); f.key('keyup'); f.hidden(); f.blur();
  assert.equal(ups(f).length, 1); assert.equal(f.held.size, 0);
});
test('page input/select/editable/dialog and exclusive agent keys acquire no ownership', () => {
  const f = fixture();
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'DIV', 'BUTTON']) {
    const el = new f.Target(tag); el.isContentEditable = tag === 'DIV'; el.pageDialog = tag === 'BUTTON';
    f.key('keydown', 65, 'KeyA', { target: el }); f.key('keyup', 65, 'KeyA', { target: el });
  }
  f.window.__agentInputExclusive = true;
  f.key('keydown', 66, 'KeyB', { isTrusted: true });
  f.hidden(); f.blur(); assert.deepEqual(f.calls, []);
});
test('owned keyup on a newly focused page control releases its original down', () => {
  const f = fixture(); f.key('keydown');
  f.key('keyup', 65, 'KeyA', { target: new f.Target('INPUT') });
  assert.equal(f.held.size, 0); f.blur(); assert.equal(ups(f).length, 1);
});
test('unowned and stale keyups cannot release another input producer', () => {
  const f = fixture(); f.key('keyup'); f.blur(); assert.deepEqual(f.calls, []);
});
test('ordinary proxy/canvas focus movement and visible events do not cancel keys', () => {
  const f = fixture(); f.key('keydown'); f.proxy.focus(); f.canvas.focus(); f.hidden(false);
  assert.equal(f.held.size, 1); assert.equal(ups(f).length, 0);
  f.key('keyup'); assert.equal(f.held.size, 0);
});
test('toolbar refocus keeps the guest key owned', () => {
  const f = fixture(); const select = new f.Target('SELECT'); select.parent = f.toolbar;
  select.focus(); f.key('keydown', 65, 'KeyA', { target: select });
  assert.equal(f.document.activeElement, f.canvas); assert.equal(f.held.size, 1);
  f.hidden(); assert.equal(f.held.size, 0);
});
test('swallowed Alt+Enter releases only the Alt actually delivered', () => {
  const f = fixture({ altEnterFullscreen: true }); let toggles = 0;
  f.window.approveBrowserFullscreen = () => toggles++;
  f.key('keydown', 18, 'AltLeft', { location: 1 });
  f.key('keydown', 13, 'Enter', { altKey: true });
  f.key('keydown', 13, 'Enter', { altKey: true, repeat: true });
  f.blur(); assert.equal(f.held.size, 0); f.key('keyup', 13, 'Enter'); f.key('keyup', 18, 'AltLeft', { location: 1 });
  assert.equal(toggles, 1); assert.deepEqual(ups(f).map(c => c[1]), [18]);
});
test('composition lifecycle and text commit survive key cancellation without invented commit', () => {
  const f = fixture(); f.dispatch(f.proxy, 'compositionstart');
  f.key('keydown', 229, '', { target: f.proxy, isComposing: true });
  f.dispatch(f.proxy, 'compositionupdate', { data: 'あ' }); f.blur();
  assert.equal(f.held.size, 0);
  assert.equal(f.calls.filter(c => c[0] === 'compositionend').length, 0);
  f.dispatch(f.proxy, 'compositionend', { data: 'あ' });
  assert.deepEqual(f.calls.filter(c => c[0].startsWith('composition')),
    [['compositionstart'], ['compositionupdate', 'あ'], ['compositionend', 'あ']]);
  assert.equal(f.calls.filter(c => c[0] === 'char').length, 0);
});
test('soft keyboard balanced pairs never acquire lasting physical ownership', () => {
  const f = fixture(); f.proxy.value = 'ab'; f.dispatch(f.proxy, 'input');
  assert.deepEqual(f.calls.map(c => c[0]), ['down', 'char', 'up', 'down', 'char', 'up']);
  f.blur(); f.hidden(); assert.equal(ups(f).length, 2); assert.equal(f.held.size, 0);
});
test('release retains delivered VK and side when keyup metadata changes', () => {
  const f = fixture(); f.key('keydown', 17, 'ControlRight', { location: 2 });
  f.key('keyup', 163, 'ControlRight', { location: 0 }); f.blur();
  assert.deepEqual(ups(f), [['up', 17, { code: 'ControlRight', location: 2, repeat: false }]]);
});
test('browser-reserved keys still forwarded by the bridge get balanced on blur', () => {
  const f = fixture(); const e = f.key('keydown', 116, 'F5');
  assert.equal(e.defaultPrevented, undefined); assert.equal(f.held.size, 1);
  f.blur(); assert.equal(f.held.size, 0); assert.equal(ups(f).length, 1);
});
test('composition commit suppresses trailing duplicate text events as before', () => {
  const f = fixture(); f.dispatch(f.proxy, 'compositionstart');
  f.dispatch(f.proxy, 'compositionend', { data: 'あ' });
  f.dispatch(f.proxy, 'beforeinput', { data: 'あ' });
  f.proxy.value = 'あ'; f.dispatch(f.proxy, 'input'); f.blur();
  assert.deepEqual(f.calls, [['compositionstart'], ['compositionend', 'あ']]);
});
test('mouse capture cancellation remains independently owned', () => {
  const f = fixture(); f.canvas.onmousedown({ clientX: 10, clientY: 10, button: 0,
    preventDefault() {} });
  f.key('keydown'); f.blur(); f.blur(); f.hidden();
  assert.equal(f.held.size, 0); assert.equal(ups(f).length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'mouseDown').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'mouseUp').length, 1);
});
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
}
console.log(`${tests.length - failed} passed; ${failed} failed`);
process.exitCode = failed ? 1 : 0;
