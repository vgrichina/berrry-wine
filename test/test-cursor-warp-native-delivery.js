#!/usr/bin/env node
'use strict';

// Production renderer/host with native USER APIs and DirectInput delivery.
// Small CPU fixture only: no browser, real game, or fabricated device deltas.
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
  (func (export "warp") (param $a0 i32) (param $a1 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SetCursorPos (local.get $a0) (local.get $a1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "cursor") (param $a0 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetCursorPos (local.get $a0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "clip") (param $a0 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_ClipCursor (local.get $a0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "capture") (param $a0 i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SetCapture (local.get $a0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
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
const bytes = process.env.WARP_MODULE ? fs.readFileSync(process.env.WARP_MODULE)
  : require('./compile-src').compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + extraWat : source);
if (process.env.WARP_SAVE_MODULE) fs.writeFileSync(process.env.WARP_SAVE_MODULE, bytes);
console.log('native module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
const wasm = new WebAssembly.Module(bytes);
function fixture() {
  const renderer = new Win98Renderer(createCanvas(320, 200));
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
      e.getmsg();
      rows.push(Array.from({ length: 7 }, (_, j) => view.getUint32(j * 4, true)));
    }
    return rows;
  }
  return { renderer, processHost, windowFor, drain,
    close() { for (const host of hosts) if (!host._processObject.exited) host.stop({ repaint: false }); } };
}

// A captured game can be covered by a no-activate sibling window. Physical
// aiming belongs to the capture process even where the virtual point overlaps
// that sibling. Native USER and DirectInput must agree on that owner.
const f = fixture();
try {
  const p = f.processHost(0x10000), other = f.processHost(0x20000);
  const win = f.windowFor(p, 0x10001);
  f.windowFor(other, 0x20001);
  p.h.activate_window(win.hwnd);
  other.h.set_window_zorder(0x20001,0);
  f.renderer.refreshInputPresentation = () => {};
  f.renderer._exclusiveTransform = { hwnd: win.hwnd, srcX: 0, srcY: 0,
    srcW: 320, srcH: 200, dstX: 0, dstY: 0, dstW: 640, dstH: 400 };
  f.renderer._exclusivePresentationViewport = { nativeX: 0, nativeY: 0,
    nativeW: 320, nativeH: 200, dstX: 17, dstY: 31, dstW: 611, dstH: 382,
    outputW: 645, outputH: 444 };
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
      return [view.getInt32(0,true),view.getInt32(4,true),view.getUint8(12)];
    };
  }
  const read = device(p), readOther = device(other);
  p.instance.exports.capture(win.hwnd);
  assert.equal(p.instance.exports.get_focus_hwnd(),win.hwnd,'game retains native focus');
  assert.equal(f.renderer._inputWindowAtPoint(160,100).hwnd,0x20001,
    'no-activate sibling covers the virtual cursor without acquiring focus');
  f.drain(p); f.drain(other);
  const failures=[];
  function check(actual,expected,label) {
    console.log(label,JSON.stringify(actual));
    try { assert.deepEqual(actual,expected,label); } catch(e) { failures.push(e.message); }
  }
  function point(proc) {
    assert.equal(proc.instance.exports.cursor(0x405100),1);
    return [proc.instance.exports.guest_read32(0x405100)|0,
      proc.instance.exports.guest_read32(0x405104)|0];
  }
  // Warp itself contributes no physical motion. Two ordinary deltas, with a
  // native recenter between them, must survive without duplication or theft.
  assert.equal(p.instance.exports.warp(160,100),1);
  check(read(),[0,0,0],'warp has no physical delta');
  for (const [dx,dy] of [[7,-3],[-2,4]]) {
    p.instance.exports.warp(160,100);
    f.renderer.handleRelativeMouseMove(dx,dy,{guestCounts:true});
    check(point(p),[160+dx,100+dy],'native cursor follows physical counts');
    check(read(),[dx,dy,0],'capture process receives complete delta');
    check(readOther(),[0,0,0],'covered sibling receives no physical delta');
    check(read(),[0,0,0],'immediate delta consumed exactly once');
    // A valid native warp supersedes GetCursorPos, but the queued message
    // must retain its original client lParam and MSG.pt screen coordinates.
    p.instance.exports.warp(160,100);
    const row = f.drain(p).find(row => row[1] === 0x200);
    assert(row, 'native GetMessage receives captured move');
    check(row[0],win.hwnd,'capture owns native MSG');
    check([row[3]&0xffff,row[3]>>>16],[160+dx,100+dy],'direct client MSG point');
    check([row[5]|0,row[6]|0],[160+dx,100+dy],'direct absolute MSG.pt');
    check(point(p),[160,100],'queued pre-warp move cannot undo recenter');
    f.drain(other);
  }
  assert.equal(p.instance.exports.get_capture_hwnd(),win.hwnd);
  // The next scheduler slice may leave a different process selected. Focus
  // and capture still own the following physical relative sample.
  f.renderer.wasm=other.instance; f.renderer.wasmMemory=other.host.memory;
  p.instance.exports.warp(160,100);
  f.renderer.handleRelativeMouseMove(3,1,{guestCounts:true});
  check(read(),[3,1,0],'foreground restored after sibling slice');
  check(readOther(),[0,0,0],'sibling slice does not own aiming');
  f.drain(p); f.drain(other);

  // A real cooperative auxiliary creates and captures its own top-level.
  // Native SetCursorPos runs on that caller; the process-shared DI device
  // consumes exactly its subsequent physical counts.
  p.instance.exports.wnd_table_set(win.hwnd,0xffff0001);
  p.instance.exports.release_capture();
  p.instance.exports.wnd_table_set(win.hwnd,0x401000);
  const handle=p.host.threadManager.createThread(0x401000,0,0x10000,4,0,1);
  p.host.threadManager.spawnPending();
  const thread=p.host.threadManager.threads.get(handle);
  assert.equal(thread.state,'active');
  const h=p.host.getImports({detached:true,threadId:thread.tid,
    instance:()=>thread.instance,exports:()=>thread.instance.exports}).host;
  const aux={host:p.host,h,instance:thread.instance};
  const auxWin=f.windowFor(aux,0x18001);
  thread.instance.exports.capture(auxWin.hwnd);
  // A valid ClipCursor rectangle on the active caller, including an edge.
  for(const [i,v] of [120,80,200,140].entries()) thread.instance.exports.guest_write32(0x405200+i*4,v);
  assert.equal(thread.instance.exports.clip(0x405200),1);
  assert.equal(thread.instance.exports.warp(199,100),1);
  check(read(),[0,0,0],'auxiliary warp contributes no delta');
  other.h.set_window_zorder(0x20001,0);
  f.renderer.wasm=other.instance; f.renderer.wasmMemory=other.host.memory;
  f.renderer.handleRelativeMouseMove(4,-2,{guestCounts:true});
  check(point(aux),[199,98],'foreground auxiliary clip applies at edge');
  check(read(),[4,-2,0],'auxiliary physical counts survive clipping');
  check(readOther(),[0,0,0],'auxiliary aiming does not reach sibling');
  assert.equal(thread.instance.exports.get_focus_hwnd(),auxWin.hwnd);
  assert.equal(thread.instance.exports.get_capture_hwnd(),auxWin.hwnd);
  f.drain(aux); f.drain(other);
  thread.instance.exports.clip(0);
  thread.instance.exports.wnd_table_set(auxWin.hwnd,0xffff0001);
  thread.instance.exports.release_capture();
  thread.instance.exports.wnd_table_set(auxWin.hwnd,0x401000);
  // Absolute input still hit-tests its physical point, independent of focus.
  const at=f.renderer._unmapExclusiveInputPoint(180.5,110.5);
  f.renderer.handleMouseMove(at.x,at.y);
  const at2=f.renderer._unmapExclusiveInputPoint(185.5,112.5);
  f.renderer.handleMouseMove(at2.x,at2.y);
  check(readOther(),[5,2,0],'absolute physical motion retains hit-tested owner');
  check(read(),[0,0,0],'absolute motion does not enter foreground DI');
  f.drain(aux); f.drain(other);
  // Ordinary physical button edges stay balanced through relative motion.
  aux.h.activate_window(auxWin.hwnd);
  f.renderer._buttonHoldFloorMs=-1;
  f.renderer.handleMouseDown(at.x,at.y,0);
  check(read(),[0,0,128],'physical left press');
  thread.instance.exports.warp(160,100);
  f.renderer.handleRelativeMouseMove(1,0,{guestCounts:true});
  check(read(),[1,0,128],'relative aiming preserves held button');
  f.renderer.handleMouseUp(at.x,at.y,0);
  check(read(),[0,0,0],'physical left release');
  check(f.renderer._mouseButtonsMask,0,'physical mask balanced');
  if(failures.length) throw new Error(failures.join('\n'));
  console.log('PASS native cursor warp and physical aiming retain captured process ownership');
} finally { f.close(); }
