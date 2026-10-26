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
assert.equal(hash(source), '5b2c47fa0b901f0323bc04df34ff27d8c50e47a001d77e9dcae3f2986a3477f0');
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

// Independent reentrancy cases; all key methods are actual installed methods.
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const queue = r => Array.from(r.inputQueue, e => [e.msg, e.wParam]);
function clean(f, expected) {
  const r = f.renderer;
  assert.deepEqual(queue(r), expected);
  for (const vk of [65,66,16,160,161]) assert.equal(r.peekKeyDownState(vk), 0, 'physical key '+vk);
  for (let i=0;i<expected.length;i++) assert.ok(r.takeInput());
  assert.equal(r.takeInput(), null);
  for (const vk of [65,66,16,160,161]) assert.equal(r.peekAsyncKeyState(vk), 0, 'delivered key '+vk);
}
test('wake hides twice and nested blur during DOWN owns exactly one release', () => {
  const f=fixture(),r=f.renderer; let n=0;
  r._stepWakeHooks=new Set([()=>{ if (++n===1) {f.hidden();f.hidden();f.blur();} }]);
  f.key('keydown');f.key('keyup');f.blur();
  clean(f,[[256,65],[257,65]]);
});
test('wake detaches focused canvas then body-target keyup preserves captured ownership', () => {
  const f=fixture(),r=f.renderer;
  r._stepWakeHooks=new Set([()=>{ f.canvas.isConnected=false;f.document.activeElement=f.document.body; }]);
  f.key('keydown');assert.equal(r.peekKeyDownState(65),32768);
  f.key('keyup',65,'KeyA',{target:f.document.body});f.blur();f.hidden();
  clean(f,[[256,65],[257,65]]);
});
test('wake detachment plus visibility loss releases both simultaneous physical modifier sides', () => {
  const f=fixture(),r=f.renderer;f.key('keydown',16,'ShiftLeft',{location:1});let once=true;
  r._stepWakeHooks=new Set([()=>{if(once){once=false;f.canvas.isConnected=false;f.document.activeElement=f.document.body;f.hidden();f.blur();}}]);
  f.key('keydown',16,'ShiftRight',{location:2});
  f.key('keyup',16,'ShiftLeft',{location:1,target:f.document.body});
  f.key('keyup',16,'ShiftRight',{location:2,target:f.document.body});
  clean(f,[[256,16],[256,16],[257,16],[257,16]]);
});
test('throwing actual wake hook is swallowed by renderer and later cancellation remains owned', () => {
  const f=fixture(),r=f.renderer;let n=0;
  r._stepWakeHooks=new Set([()=>{n++;throw Error('independent wake throw');}]);
  f.key('keydown');f.key('keydown',66,'KeyB');f.hidden();f.blur();
  assert.equal(n,4);clean(f,[[256,65],[256,66],[257,65],[257,66]]);
});
test('wake on first UP reenters duplicate cancellation while another key is held', () => {
  const f=fixture(),r=f.renderer;f.key('keydown');f.key('keydown',66,'KeyB');let once=true;
  r._stepWakeHooks=new Set([()=>{if(once){once=false;f.hidden();f.blur();f.hidden();}}]);
  f.key('keyup');f.key('keyup',66,'KeyB');f.hidden();
  clean(f,[[256,65],[256,66],[257,65],[257,66]]);
});
test('throwing queue publisher after DOWN preserves ownership for physical keyup', () => {
  const f=fixture(),r=f.renderer,error=Error('independent publish down');
  r._inputPendingPublishers=new Set([()=>{throw error;}]);
  assert.throws(()=>f.key('keydown'),e=>e===error);assert.equal(r.peekKeyDownState(65),32768);
  r._inputPendingPublishers.clear();f.key('keyup');f.blur();
  clean(f,[[256,65],[257,65]]);
});
test('throwing queue publisher on cancellation drains two keys and propagates first error', () => {
  const f=fixture(),r=f.renderer;f.key('keydown');f.key('keydown',66,'KeyB');let n=0;const first=Error('first'),second=Error('second');
  r._inputPendingPublishers=new Set([()=>{throw ++n===1?first:second;}]);
  assert.throws(()=>f.hidden(),e=>e===first);assert.equal(n,2);
  r._inputPendingPublishers.clear();f.hidden();f.blur();f.key('keyup');f.key('keyup',66,'KeyB');
  clean(f,[[256,65],[256,66],[257,65],[257,66]]);
});
let failed=0;const results=[];
for(const [name,fn] of tests){try{fn();results.push({name,pass:true});console.log('PASS '+name);}catch(e){failed++;results.push({name,pass:false,error:e.stack});console.log('FAIL '+name+'\n'+e.stack);}
 if(process.env.ACCEPTANCE_CHECKPOINT){const p=process.env.ACCEPTANCE_CHECKPOINT;fs.writeFileSync(p+'.tmp',JSON.stringify({candidate:process.env.CANDIDATE,sourceSHA256:hash(source),rendererSHA256:hash(rendererSource),fixtureSHA256:hash(fs.readFileSync(__filename)),results,remaining:tests.slice(results.length).map(t=>t[0])},null,2));fs.renameSync(p+'.tmp',p);}}
console.log(JSON.stringify({pass:tests.length-failed,fail:failed}));process.exitCode=failed?1:0;
