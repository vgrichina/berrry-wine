#!/usr/bin/env node
'use strict';

// Production DOM bridge -> renderer -> native USER post queue -> GetMessage.
// No browser/game launch. Real WASM owns focus, capture, queue and MSG output;
// set_host_shadow exercises the production Worker-shadow posting path.
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
  (func (export "wheel_get")
    (local $sp i32) (local $ip i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (call $handle_GetMessageA_fetch (i32.const 0x403000) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip)))
  (func (export "wheel_parent") (param $child i32) (param $parent i32)
    (call $wnd_set_parent (local.get $child) (local.get $parent)))
  (func (export "wheel_capture") (param $hwnd i32)
    (call $handle_SetCapture (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "state") (param $a0 i32) (param $a1 i32) (param $a2 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectInputDevice_GetDeviceState (local.get $a0) (local.get $a1) (local.get $a2) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "format") (param $a0 i32) (param $a1 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectInputDevice_SetDataFormat (local.get $a0) (local.get $a1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "acquire") (param $a0 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectInputDevice_Acquire (local.get $a0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "mouse") (result i32)
    (local $obj i32)
    (global.set $DX_VTBL_DIDEV2 (i32.const 0x52000000))
    (local.set $obj (call $dx_create_com_obj (i32.const 7) (global.get $DX_VTBL_DIDEV2)))
    (i32.store offset=8 (call $dx_from_this (local.get $obj)) (i32.const 2))
    (i32.store offset=16 (call $dx_from_this (local.get $obj)) (i32.const 0x0700))
    (local.get $obj))
  (func (export "getmsg")
    (local $sp i32) (local $ip i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (call $handle_GetMessageA_fetch (i32.const 0x403000) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip)))
`;
const bytes = process.env.DEVICE_OWNER_MODULE ? fs.readFileSync(process.env.DEVICE_OWNER_MODULE)
  : require('./compile-src').compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + extraWat : source);
if (process.env.DEVICE_OWNER_SAVE_MODULE) fs.writeFileSync(process.env.DEVICE_OWNER_SAVE_MODULE, bytes);
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
    removeEventListener(type, fn) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter(row => row.fn !== fn));
    }
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
    const event = { type, target, preventDefault() {}, stopPropagation() { this.cancelBubble = true; }, ...props };
    const chain = target === window ? [window] : target === document
      ? [window, document] : [window, document, target];
    for (const node of chain)
      for (const row of node.listeners.get(type) || []) if (row.capture) row.fn(event);
    if (event.cancelBubble) return;
    if (typeof target['on' + type] === 'function') target['on' + type](event);
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
    wheel(x, y, deltaY) {
      dispatch(canvas, 'wheel', { clientX: x, clientY: y, deltaY });
    },
    mouse(type, x, y, button = 0) {
      dispatch(canvas, type, { clientX: x, clientY: y, button });
    },
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
    p.instance.exports.wnd_table_set(hwnd, 0x401000);
    return renderer.windows[hwnd];
  }
  function drain(p) {
    const rows = [], e = p.instance.exports;
    const view = new DataView(p.host.memory.buffer, e.get_guest_base() + 0x3000, 28);
    // A nonempty real native post queue guarantees GetMessage does not wait.
    for (let i = 0; e.get_post_queue_count(); i++) {
      assert(i < 30, 'bounded native pump');
      e.wheel_get();
      rows.push(Array.from({ length: 7 }, (_, j) => view.getUint32(j * 4, true)));
    }
    return rows;
  }
  return { renderer, bridge, processHost, windowFor, drain,
    close() { for (const host of hosts) if (!host._processObject.exited) host.stop({ repaint: false }); } };
}

// A real click leaves a press/release owner. Native activation can change the
// foreground while that press is held; wheel belongs to the new foreground,
// whereas the eventual release still balances the original device's press.
const f = fixture();
const failures = [];
function check(actual, expected, label) {
  console.log(label, JSON.stringify(actual));
  try { assert.deepEqual(actual, expected, label); } catch (e) { failures.push(e.message); }
}
try {
  const p = f.processHost(0x10000), other = f.processHost(0x20000);
  const win = f.windowFor(p, 0x10001), cover = f.windowFor(other, 0x20001);
  const base = require('../lib/region-map.generated').BASE.DI_MOUSE_INPUT_STATE >>> 2;
  function ring(proc) {
    const words = new Int32Array(proc.host.memory.buffer);
    const head = Atomics.load(words, base + 2) >>> 0, tail = Atomics.load(words, base + 3) >>> 0;
    assert(tail - head <= 64);
    return Array.from({ length: tail - head }, (_, i) => {
      const word = Atomics.load(words, base + 4 + ((head + i) & 63));
      return [word >>> 28, word >>> 28 === 9 ? word << 4 >> 4 : null];
    });
  }
  function device(proc) {
    const e = proc.instance.exports, format = 0x404000, objects = 0x404100;
    for (const [i,v] of [24,16,2,16,7,objects].entries()) e.guest_write32(format+i*4,v);
    for (let i=0;i<7;i++) {
      e.guest_write32(objects+i*16,0);
      e.guest_write32(objects+i*16+4,i<3?i*4:i+9);
      e.guest_write32(objects+i*16+8,i<3?0x00ffff03:0x00ffff0c);
      e.guest_write32(objects+i*16+12,0);
    }
    const obj=e.mouse();
    assert.equal(e.format(obj,format),0); assert.equal(e.acquire(obj),0);
    return () => {
      assert.equal(e.state(obj,16,0x405000),0);
      const view=new DataView(proc.host.memory.buffer,e.get_guest_base()+0x5000,16);
      return [view.getInt32(0,true),view.getInt32(4,true),view.getInt32(8,true)];
    };
  }
  const read = device(p), readOther = device(other);
  function wheel(name, deltaY) {
    const before = ring(p), otherBefore = ring(other);
    // The actual host shadow posts into the native queue; GetMessage consumes
    // those records after shadow mode is left, just as in production.
    for (const proc of [p, other]) proc.instance.exports.set_host_shadow(1);
    try { f.bridge.wheel(80, 70, deltaY); }
    finally { for (const proc of [p, other]) proc.instance.exports.set_host_shadow(0); }
    const rows = f.drain(p).filter(row => row[1] === 0x20a);
    check(rows.map(row => [row[0],row[2] >> 16,row[2]&0xffff,row[3]]),
      [[win.hwnd,deltaY > 0 ? -120 : 120,f.renderer.getMouseButtons(),(70<<16)|80]], name+' native foreground WM_MOUSEWHEEL');
    check(f.drain(other).filter(row => row[1] === 0x20a), [], name+' no sibling Win32 wheel');
    check(ring(p), [...before,[9,deltaY > 0 ? -120 : 120]],name+' one signed native device ring record');
    check(ring(other),otherBefore,name+' no sibling device ring record');
    check(read(), [0,0,deltaY > 0 ? -120 : 120], name+' foreground native DirectInput lZ');
    check(readOther(), [0,0,0], name+' sibling native DirectInput unchanged');
    check(read(), [0,0,0], name+' accumulator consumed once');
  }
  p.h.activate_window(win.hwnd);
  other.h.set_window_zorder(cover.hwnd,0);
  f.drain(p); f.drain(other);
  assert.equal(f.renderer._inputWindowAtPoint(80,70),cover);
  wheel('no held press',1);
  // Normal DOM down/up on the sibling establishes its device owner without
  // assigning any internal pointer-memory field in this regression.
  other.h.activate_window(cover.hwnd);
  f.bridge.mouse('mousemove',80,70);
  f.bridge.mouse('mousedown',80,70);
  check(ring(other).filter(row=>row[0]===1),[[1,null]],'one physical sibling press');
  p.h.activate_window(win.hwnd);
  other.h.set_window_zorder(cover.hwnd,0);
  p.instance.exports.wheel_capture(win.hwnd);
  assert.equal(p.instance.exports.get_capture_hwnd(),win.hwnd);
  f.drain(p); f.drain(other);
  wheel('held sibling press plus foreground capture',-1);
  check(p.instance.exports.get_capture_hwnd(),win.hwnd,'wheel preserves legitimate native capture');
  f.bridge.mouse('mouseup',80,70);
  check(ring(other).filter(row=>row[0]===1||row[0]===2),[[1,null],[2,null]],'original device retains exactly one down/up pair');
  check(ring(p).filter(row=>row[0]===1||row[0]===2),[],'foreground cannot inherit sibling button edges');
  check(f.renderer.getMouseButtons(),0,'DOM release clears physical button');
  p.instance.exports.set_host_shadow(1);
  try { p.instance.exports.release_capture(); }
  finally { p.instance.exports.set_host_shadow(0); }
  check(p.instance.exports.get_capture_hwnd(),0,'explicit native ReleaseCapture remains effective');
  // An owning process may retire before its DOM release. Only its balancing
  // edge may reach the old memory; a new wheel must still reach the live app.
  other.h.activate_window(cover.hwnd);
  f.bridge.mouse('mousedown',80,70);
  other.host.stop({repaint:false});
  p.h.activate_window(win.hwnd);
  f.drain(p);
  const retiredBefore = ring(other);
  wheel('retired held sibling',1);
  check(ring(other),retiredBefore,'wheel never appends to retired device ring');
  f.bridge.mouse('mouseup',80,70);
  check(ring(other).filter(row=>row[0]===1||row[0]===2),
    [[1,null],[2,null],[1,null],[2,null]],'retirement retains legitimate balancing release');
  check(ring(p).filter(row=>row[0]===1||row[0]===2),[],'retired release cannot become live device edge');
  check(f.renderer.getMouseButtons(),0,'retired release clears physical button');
  p.host.stop({repaint:false});
  const stoppedRings = [ring(p),ring(other)];
  const stoppedQueues = [p,other].map(proc=>proc.instance.exports.get_post_queue_count());
  p.instance.exports.set_host_shadow(1);
  try { f.bridge.wheel(80,70,-1); }
  finally { p.instance.exports.set_host_shadow(0); }
  check([ring(p),ring(other)],stoppedRings,'no physical wheel after every owner retires');
  check([p,other].map(proc=>proc.instance.exports.get_post_queue_count()),stoppedQueues,
    'no Win32 wheel after every owner retires');
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('PASS ordinary DOM wheel/device ownership across activation, capture, covering sibling and retirement; signed consume-once accumulators and balanced button rings');
} finally { f.close(); }
