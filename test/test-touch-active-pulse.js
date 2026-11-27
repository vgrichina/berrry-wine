'use strict';
// Public overlay events, real renderer handlers, deterministic scheduler.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { Win98Renderer } = require(root + '/lib/renderer');
const { createCanvas } = require(root + '/lib/raster-canvas');
let now = 0, serial = 0;
const timers = new Map();
global.performance = { now: () => now };
global.setTimeout = (fn, delay) => { const id = ++serial; timers.set(id, {fn, at: now + delay}); return id; };
global.clearTimeout = id => timers.delete(id);
global.setInterval = (fn, delay) => { const id = ++serial; timers.set(id, {fn, at: now + delay, interval: delay}); return id; };
global.clearInterval = id => timers.delete(id);
function advance(ms) {
  const end = now + ms;
  for (;;) {
    const next = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at || a[0] - b[0])[0];
    if (!next) break;
    now = next[1].at; timers.delete(next[0]); if (next[1].interval) timers.set(next[0], {...next[1], at: now + next[1].interval}); next[1].fn();
  }
  now = end;
}
function element(tag) {
  const listeners = new Map(), classes = new Set();
  return {
    tagName: tag.toUpperCase(), children: [], style: {}, attributes: {}, className: '',
    classList: { add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v) },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; },
    get firstChild() { return this.children[0]; },
    setAttribute(k,v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] ?? null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 140, height: 140 }; },
    contains(c) { for (; c; c = c.parentNode) if (c === this) return true; return false; },
    addEventListener(type, fn, opts) { const rows = listeners.get(type) || []; rows.push({fn, capture: !!opts?.capture}); listeners.set(type, rows); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter(row => row.fn !== fn)); },
    dispatch(type, event, capture) { for (const row of [...(listeners.get(type) || [])]) if (capture === undefined || row.capture === capture) row.fn(event); },
  };
}
const wrap = element('div');
global.window = Object.assign(element('window'), { innerHeight: 844, __waMinKeyHoldMs: 100 });
global.document = Object.assign(element('document'), {
  head: element('head'), body: element('body'), hidden: false,
  createElement: element, getElementById: id => id === 'screen-wrap' ? wrap : null,
});
global.location = { search: '' };
const tc = require(root + '/lib/touch-controls');
const renderer = new Win98Renderer(createCanvas(320, 200));
const seen = [];
for (const [method, name] of [['handleKeyDown','down'], ['handleKeyUp','up'], ['handleKeyPress','char']]) {
  const original = renderer[method];
  renderer[method] = function(vk, info) { seen.push([name, vk]); return original.call(this, vk, info); };
}
tc.install({ document, renderer });

const { APPS } = require(root + '/lib/apps');

// The shipped Nocturne layout exposes both controls at once. Continue is a
// Space + WM_CHAR pulse; Fire / use owns Space for the finger's lifetime.
function find(label) {
  function walk(el) { return [el, ...el.children.flatMap(walk)]; }
  const el = walk(tc.el).find(el => el.textContent === label);
  assert.ok(el, label + ' is publicly rendered');
  return el;
}
const active = new Map();
function send(label, type, id) {
  const el = find(label);
  const finger = { identifier: id, clientX: 30, clientY: 30 };
  if (type === 'touchend' || type === 'touchcancel') active.delete(id); else active.set(id, finger);
  const ev = { target: el, changedTouches: [finger], touches: [...active.values()], preventDefault() {}, stopPropagation() {} };
  window.dispatch(type, ev, true); el.dispatch(type, ev, false); window.dispatch(type, ev, false);
}
let checks = 0;
function check(label, events, held) {
  assert.deepEqual(seen, events, label + ': literal handler events');
  assert.equal(!!(renderer.peekKeyDownState(32) & 0x8000), held, label + ': real renderer held state');
  checks++;
}
try {
  for (const age of [0, 110]) for (const first of ['Continue', 'Fire / use']) {
    tc.setLayout(APPS.nocturne_demo.touchControls); active.clear(); seen.length = 0;
    send('Fire / use', 'touchstart', 1); advance(age);
    send('Continue', 'touchstart', 2);
    check('overlap begins', [['down',32],['down',32],['char',32]], true);
    advance(25); send(first, 'touchend', first === 'Continue' ? 2 : 1);
    check('first finger ends inside pulse minimum', [['down',32],['down',32],['char',32]], true);
    advance(1000);
    if (first === 'Continue') {
      check('pulse expired with Fire still down', [['down',32],['down',32],['char',32]], true);
      send('Fire / use', 'touchend', 1);
    } else {
      check('Fire ended; pulse expires despite Continue finger', [['down',32],['down',32],['char',32],['up',32]], false);
      send('Continue', 'touchend', 2);
    }
    check('both fingers ended', [['down',32],['down',32],['char',32],['up',32]], false);
    advance(1000);
    check('no late release', [['down',32],['down',32],['char',32],['up',32]], false);
  }
  // Repeated user presses while the original hold remains active.
  for (const [cleanup, delay] of [['finger',100], ['releaseAll',25], ['releaseAll',100], ['blur',25], ['blur',100], ['layout',25], ['layout',100]]) {
    tc.setLayout(APPS.nocturne_demo.touchControls); active.clear(); seen.length = 0;
    send('Fire / use', 'touchstart', 1); advance(110);
    send('Continue', 'touchstart', 2); send('Continue', 'touchend', 2); advance(450);
    send('Continue', 'touchstart', 3); send('Continue', 'touchend', 3); advance(delay);
    check('two pulses preserve hold', [['down',32],['down',32],['char',32],['down',32],['char',32]], true);
    if (cleanup === 'finger') send('Fire / use', 'touchend', 1);
    else if (cleanup === 'releaseAll') tc.releaseAll();
    else if (cleanup === 'blur') window.dispatch('blur', {});
    else tc.setLayout(null);
    check(cleanup + ' releases overlapping hold', [['down',32],['down',32],['char',32],['down',32],['char',32],['up',32]], false);
    advance(1000);
    check(cleanup + ' has no stale pulse release', [['down',32],['down',32],['char',32],['down',32],['char',32],['up',32]], false);
  }
} finally {
  tc.destroy();
}
assert.equal(timers.size, 0, 'teardown cancels all fake timers');
console.log('PASS ' + checks + ' public DOM active-hold/pulse checkpoints; real Win98Renderer held state');
