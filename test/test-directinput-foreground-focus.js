#!/usr/bin/env node
'use strict';

// Production DOM bridge -> renderer -> host -> native USER PeekMessage.
// No browser/game launch: the DOM fixture models capture and non-bubbling
// element focus, while real WASM instances own native focus and MSG delivery.
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const { inputEventHwnd } = require('../lib/host-window');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { ThreadManager } = require('../lib/thread-manager');
const context = { console, createHostImports, inputEventHwnd, performance,
  setTimeout, clearTimeout, setInterval, clearInterval, WebAssembly };
vm.runInNewContext(fs.readFileSync(require.resolve('../host.js'), 'utf8') +
  '\n;globalThis.WineAssembly = WineAssembly;', context);
const extraWat = `
  (func (export "api") (param $id i32) (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "method") (param $obj i32) (param $slot i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
    (local $thunk i32) (local $sp i32)
    (local.set $thunk (call $gl32 (i32.add (call $gl32 (local.get $obj)) (i32.shl (local.get $slot) (i32.const 2)))))
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $dispatch_api_table (call $gl32 (i32.add (local.get $thunk) (i32.const 4))) (local.get $obj) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))

  (func (export "held_peek") (result i32)
    (local $sp i32) (local $ip i32) (local $result i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (call $handle_PeekMessageA_fetch (i32.const 0x403000) (i32.const 0)
      (i32.const 0x100) (i32.const 0x105) (i32.const 1) (i32.const 0))
    (local.set $result (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip))
    (local.get $result))
  (func (export "held_capture") (param $hwnd i32)
    (call $handle_SetCapture (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
`;
const bytes = process.env.INPUT_FOCUS_MODULE
  ? fs.readFileSync(process.env.INPUT_FOCUS_MODULE)
  : require('./compile-src').compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + extraWat : source);
if (process.env.INPUT_FOCUS_SAVE_MODULE) fs.writeFileSync(process.env.INPUT_FOCUS_SAVE_MODULE, bytes);
console.log('native module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
const wasm = new WebAssembly.Module(bytes);

function dom(renderer) {
  let document;
  class Target {
    constructor(tagName) {
      this.tagName = tagName; this.listeners = new Map(); this.style = {};
      this.classList = { toggle() {}, contains() { return false; } };
      this.width = 320; this.height = 200; this.value = '';
    }
    addEventListener(type, fn, options) {
      const rows = this.listeners.get(type) || [];
      rows.push({ fn, capture: options === true || !!options?.capture });
      this.listeners.set(type, rows);
    }
    removeEventListener() {}
    setAttribute() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 200 }; }
    focus() {
      const old = document.activeElement;
      if (old === this) return;
      if (old) dispatch(old, 'blur', {}, false);
      document.activeElement = this;
      dispatch(this, 'focus', {}, false);
    }
    closest() { return null; }
    contains(el) { return this === el; }
  }
  const window = new Target(), canvas = new Target('CANVAS'), proxy = new Target('TEXTAREA');
  document = new Target(); document.body = new Target('BODY');
  document.documentElement = new Target('HTML'); document.activeElement = canvas;
  document.getElementById = id => id === 'mobile-keyboard-proxy' ? proxy : null;
  document.querySelectorAll = () => [];
  function dispatch(target, type, props = {}, bubbles = true) {
    const event = { type, target, preventDefault() {}, stopPropagation() {}, ...props };
    const chain = target === window ? [window] : target === document
      ? [window, document] : [window, document, target];
    for (const node of chain)
      for (const row of node.listeners.get(type) || []) if (row.capture) row.fn(event);
    for (const node of bubbles ? [...chain].reverse() : [target])
      for (const row of node.listeners.get(type) || []) if (!row.capture) row.fn(event);
  }
  const ctx = { window, document, Node: Target, module: { exports: {} },
    setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; },
    clearTimeout() {}, performance };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/browser-input.js'), 'utf8'), ctx);
  ctx.module.exports.wireCanvasInput(canvas, renderer, { runningApps: [{ wine: { running: true } }] });
  return {
    key(type, vk = 38, code = 'ArrowUp', repeat = false, target = canvas) {
      dispatch(target, type, { keyCode: vk, code, key: 'Unidentified', location: 0, repeat });
    },
    blur() { dispatch(window, 'blur', {}, false); },
    hidden(value) { document.hidden = value; dispatch(document, 'visibilitychange'); },
    proxy,
  };
}
function fixture() {
  const renderer = new Win98Renderer(createCanvas(320, 200));
  const bridge = dom(renderer);
  const hosts = [];
  function processHost(base) {
    const host = new context.WineAssembly();
    hosts.push(host);
    host.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    host.renderer = renderer; host._multiApp = true; host._hwndBase = base;
    host.logToUI = () => {};
    const imports = host.getImports();
    const h = imports.host; h.memory = host.memory;
    host.instance = new WebAssembly.Instance(wasm, imports);
    host.instance.exports.init_thread(0, 0x400000, 0x401000, 0x402000, 0x7500000, 0x7510000, 0, 0);
    host.instance.exports.init_dx_com_thunks();
    host.threadManager = new ThreadManager(wasm, host.memory, host.instance, tid => {
      let instance;
      const imports = host.getImports({ detached: true, threadId: tid,
        instance: () => instance, exports: () => instance?.exports });
      imports.host.memory = host.memory;
      imports.__setInstance = value => { instance = value; };
      return imports;
    }, { hwndBase: () => base });
    return { host, h, instance: host.instance };
  }
  function windowFor(p, hwnd) {
    p.instance.exports.wnd_table_set(hwnd, 0xffff0001);
    p.h.create_window(hwnd, 0x90000000, 0, 0, 320, 200, 0, 0);
    renderer.showWindow(hwnd, 5);
    p.instance.exports.set_focus(hwnd);
    assert.equal(p.instance.exports.get_focus_hwnd(), hwnd, 'native focus transition completed');
    p.h.activate_window(hwnd);
    return renderer.windows[hwnd];
  }
  function drain(p) {
    const rows = [], e = p.instance.exports;
    const view = new DataView(p.host.memory.buffer, e.get_guest_base() + 0x3000, 28);
    for (let i = 0; e.held_peek(); i++) {
      assert(i < 30, 'bounded native pump');
      rows.push([view.getUint32(0, true), view.getUint32(4, true),
        view.getUint32(8, true), view.getUint32(12, true)]);
    }
    return rows;
  }
  return { renderer, bridge, processHost, windowFor, drain,
    close() { for (const host of hosts) if (!host._processObject.exited) host.stop({ repaint: false }); } };
}


const apiTable = require('../src/api_table.json');
const id = name => apiTable.find(x=>x.name===name).id;
const f=fixture();
function dev(proc, hwnd, coop, bufferSize = 17) {
 const e=proc.instance.exports, wr=e.guest_write32, out=0x404000, guid=0x404100, fmt=0x404200, objects=0x404300, prop=0x404400;
 assert.equal(e.api(id('DirectInputCreateA'),0x400000,0x700,out,0,0)>>>0,0);
 const root=e.guest_read32(out)>>>0;
 [0x6f1d2b61,0x11cfd5a0,0x4544c7bf,0x00005453].forEach((v,i)=>wr(guid+4*i,v));
 assert.equal(e.method(root,3,guid,out,0,0)>>>0,0);
 const obj=e.guest_read32(out)>>>0;
 assert(e.guest_read32(obj),'native allocated public device vtable');
 [24,16,2,256,1,objects].forEach((v,i)=>wr(fmt+4*i,v));
 [0,0x11,0x8000110c,0].forEach((v,i)=>wr(objects+4*i,v));
 assert.equal(e.method(obj,11,fmt,0,0,0)>>>0,0,'valid W format');
 [20,16,0,0,bufferSize].forEach((v,i)=>wr(prop+4*i,v));
 assert.equal(e.method(obj,6,1,prop,0,0)>>>0,0,'buffered input configured');
 if (coop !== undefined) assert.equal(e.method(obj,13,hwnd,coop,0,0)>>>0,0,'valid cooperative level');
 return {obj,e,acquire:()=>e.method(obj,7,0,0,0,0)>>>0,
 unacquire:()=>e.method(obj,8,0,0,0,0)>>>0,
 state:()=>{const hr=e.method(obj,9,256,0x405000,0,0)>>>0;return {hr,w:new Uint8Array(proc.host.memory.buffer,e.get_guest_base()+0x5000,256)[0x11]};},
 data:()=>{wr(0x406000,16);const hr=e.method(obj,10,16,0x407000,0x406000,0)>>>0,n=e.guest_read32(0x406000)>>>0;assert(n<=16);return {hr,records:Array.from({length:hr === 0 ? n : 0},(_,i)=>[e.guest_read32(0x407000+16*i)>>>0,e.guest_read32(0x407004+16*i)>>>0])};}};
}
const observations=[];
const faults=[];
function log(name,value) {
 observations.push({name,...value}); console.log(name,JSON.stringify(value));
 const positive = {
   'A focused W down foreground state': {hr:0,w:128},
   'A focused W down foreground buffered': {hr:0,records:[[17,128]]},
   'A background legitimate W release pair': {hr:0,records:[[17,128],[17,0]]},
   'B foreground real W state': {hr:0,w:128},
   'A background real W state': {hr:0,w:128},
   'B foreground W down buffered': {hr:0,records:[[17,128]]},
   'A background W down buffered': {hr:0,records:[[17,128]]},
   'B foreground W release buffered': {hr:0,records:[[17,0]]},
   'A background W release buffered': {hr:0,records:[[17,0]]},
 };
 if (positive[name]) assert.deepEqual(value,positive[name],name);
 if ('expected' in value && value.actual !== value.expected) faults.push(name);
 if (name.includes('foreground') && (name.includes('after B activation') || name.includes('foreign B')) &&
     'hr' in value && value.hr !== 0x8007000c) faults.push(name);
}
try {
 const a=f.processHost(0x10000), b=f.processHost(0x20000);
 f.windowFor(a,0x10001); f.windowFor(b,0x20001);
 if (process.argv.includes('--unpolled-only')) {
   a.h.activate_window(0x10001);
   const isolated=dev(a,0x10001,6);assert.equal(isolated.acquire(),0);
   b.h.activate_window(0x20001);
   f.bridge.key('keydown',87,'KeyW');f.bridge.key('keyup',87,'KeyW');
   a.h.activate_window(0x10001);
   assert.equal(isolated.data().hr,0x8007000c,'unpolled away/back must lose acquisition');
   assert.equal(isolated.acquire(),0);
   assert.deepEqual(isolated.data(),{hr:0,records:[]});
 } else {
 const fg=dev(a,0x10001,6), bg=dev(a,0x10001,10), other=dev(b,0x20001,6);
 log('A foreground Acquire while B active',{actual:fg.acquire(),expected:0x80070005});
 fg.unacquire();
 log('A background Acquire while B active',{actual:bg.acquire(),expected:0});
 a.h.activate_window(0x10001);assert.equal(f.renderer._foregroundWindow.hwnd,0x10001);
 assert.equal(fg.acquire(),0);
 f.bridge.key('keydown',87,'KeyW');
 log('A focused W down foreground state',fg.state());
 log('A focused W down foreground buffered',fg.data());
 // Keep a real W press held while actual host activation switches process.
 b.h.activate_window(0x20001);assert.equal(f.renderer._foregroundWindow.hwnd,0x20001);
 log('A foreground state after B activation',fg.state());
 log('A foreground Acquire after B activation',{actual:fg.acquire(),expected:0x80070005});
 f.bridge.key('keyup',87,'KeyW');
 log('A background legitimate W release pair',bg.data());
 log('A foreground buffered after B activation',fg.data());
 // B physically presses W while foreground-only A still claims acquisition.
 assert.equal(other.acquire(),0);
 f.bridge.key('keydown',87,'KeyW');
 log('B foreground real W state',other.state());
 log('A foreground foreign B W state',fg.state());
 log('A background real W state',bg.state());
 log('B foreground W down buffered',other.data());
 log('A foreground foreign B W down buffered',fg.data());
 log('A background W down buffered',bg.data());
 f.bridge.key('keyup',87,'KeyW');
 log('B foreground W release buffered',other.data());
 log('A background W release buffered',bg.data());
 log('A foreground foreign B W release buffered',fg.data());
 // USER queue delivery remains enqueue-time process-owned; foreign poll must not steal A release.
 log('A USER legitimate down/up queued across focus',{rows:f.drain(a)});
 log('B USER own down/up',{rows:f.drain(b)});
 // A complete, legitimate pair queued before activation must stay in A's
 // USER queue, even if B pumps first. DirectInput background input stays global.
 a.h.activate_window(0x10001);
 f.bridge.key('keydown',87,'KeyW');f.bridge.key('keyup',87,'KeyW');
 b.h.activate_window(0x20001);
 assert.deepEqual(f.drain(b),[],'foreign pump cannot steal queued A pair');
 const queued=f.drain(a);
 assert.deepEqual(queued.map(x=>x[1]),[0x100,0x101]);
 assert(queued.every(x=>x[0]===0x10001));
 log('A legitimate queued releases preserved after B first pump',{rows:queued});
 const pair=bg.data();assert.deepEqual(pair.records,[[17,128],[17,0]]);
 log('A background preserves complete pretransition W pair',pair);
 // A polling-only foreground check cannot repair an unobserved away/back
 // interval: neither device API is called until A becomes foreground again.
 fg.unacquire();a.h.activate_window(0x10001);assert.equal(fg.acquire(),0);
 b.h.activate_window(0x20001);
 f.bridge.key('keydown',87,'KeyW');f.bridge.key('keyup',87,'KeyW');
 a.h.activate_window(0x10001);
 log('A foreground foreign B pair retained across unpolled away/back',fg.data());
 assert([0,1].includes(fg.unacquire()));
 assert.equal(fg.state().hr,0x8007000c,'Unacquire actually disables native reads');
 assert.equal(fg.acquire(),0);
 assert.deepEqual(fg.data(),{hr:0,records:[]},'normal reacquire starts a fresh FIFO');
 assert.equal(fg.acquire(),1,'repeated acquired foreground Acquire returns S_FALSE');
 log('normal Unacquire/reacquire lifecycle controls',{pass:true});
 fg.unacquire();bg.unacquire();other.unacquire();
 // Both exclusive and nonexclusive foreground immediate devices must remember
 // loss without needing a FIFO or an intervening device call.
 for (const coop of [5,6]) {
   const immediate = dev(a,0x10001,coop,0);
   assert.equal(immediate.acquire(),0);
   a.h.activate_window(0x10001);
   assert.equal(immediate.acquire(),1,'same-window activation keeps acquisition');
   b.h.activate_window(0x20001);
   f.bridge.key('keydown',87,'KeyW');
   a.h.activate_window(0x10001);
   assert.equal(immediate.state().hr,0x8007000c,'immediate unpolled focus loss');
   assert.equal(immediate.acquire(),0,'implicit reacquire after focus loss is fresh');
   assert.deepEqual(immediate.state(),{hr:0,w:128},'new acquisition sees currently held key');
   f.bridge.key('keyup',87,'KeyW');
   assert.deepEqual(immediate.state(),{hr:0,w:0});
   assert.equal(immediate.unacquire(),0);
   assert.equal(immediate.unacquire(),1);
 }
 // A return to the associated window permits a fresh Acquire directly, even
 // when no GetDeviceState/GetDeviceData or Unacquire synchronized the loss.
 assert.equal(fg.acquire(),0);
 b.h.activate_window(0x20001);a.h.activate_window(0x10001);
 assert.equal(fg.acquire(),0,'Acquire detects sticky loss before S_FALSE');
 assert.deepEqual(fg.data(),{hr:0,records:[]});
 fg.unacquire();
 for (const side of ['before','after']) {
   let hit=false;
   const original=f.renderer.directInputKeyboardBuffer;
   f.renderer.directInputKeyboardBuffer=function(devices,device,op,value) {
     const transition=() => { hit=true;b.h.activate_window(0x20001); };
     if (op===10 && value===0x10001 && side==='before') transition();
     const result=original.call(this,devices,device,op,value);
     if (op===10 && value===0x10001 && side==='after') transition();
     return result;
   };
   try { assert.equal(fg.acquire(),side==='before'?0x80070005:0);assert(hit); }
   finally { f.renderer.directInputKeyboardBuffer=original; }
   a.h.activate_window(0x10001);
   assert.equal(fg.state().hr,0x8007000c,'activation boundary never leaves stale acquisition');
   assert.equal(fg.acquire(),0);fg.unacquire();
 }
 const implicit = dev(a,0x10001,undefined);
 b.h.activate_window(0x20001);
 assert.equal(implicit.acquire(),0,'unset cooperative level defaults to background');
 f.bridge.key('keydown',87,'KeyW');f.bridge.key('keyup',87,'KeyW');
 a.h.activate_window(0x10001);
 assert.deepEqual(implicit.data(),{hr:0,records:[[17,128],[17,0]]});
 assert.equal(implicit.acquire(),1);
 implicit.unacquire();
 // Visibility loss and process retirement use the same event-time invalidation
 // path. Reusing an HWND in a new process cannot revive an old device.
 assert.equal(fg.acquire(),0);
 a.h.show_window(0x10001,0);
 a.h.show_window(0x10001,5);a.h.activate_window(0x10001);
 assert.equal(fg.state().hr,0x8007000c,'hide/show cannot revive acquisition');
 assert.equal(fg.acquire(),0);
 a.host.stop({repaint:false});
 const replacement=f.processHost(0x10000);
 f.windowFor(replacement,0x10001);
 assert.equal(fg.state().hr,0x8007000c,'retired process acquisition stays lost');
 assert.equal(fg.acquire(),0x80070005,'old context cannot acquire replacement HWND');
 const fresh=dev(replacement,0x10001,6);
 assert.equal(fresh.acquire(),0);
 f.bridge.key('keydown',87,'KeyW');f.bridge.key('keyup',87,'KeyW');
 assert.deepEqual(fresh.data(),{hr:0,records:[[17,128],[17,0]]});
 fresh.unacquire();
 log('immediate/default/hide/retirement controls',{pass:true});
 }
} finally {f.close();}
if (process.env.DI_FOCUS_OBSERVATIONS) fs.writeFileSync(process.env.DI_FOCUS_OBSERVATIONS,JSON.stringify(observations,null,2)+'\n');
assert.deepEqual(faults,[], 'foreground acquisition faults');
console.log('PASS native foreground keyboard acquisition and unpolled focus interval');
