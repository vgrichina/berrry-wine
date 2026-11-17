'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {neLifecycleImage} = require('./helpers/ne-lifecycle-image');
const {neGuestCaller} = require('./helpers/ne-guest-caller');

// Real NE import relocations and x86 assertions. All APIs below are called
// FAR PASCAL, including the original unsupported USER ordinal 281.
function brushImage() {
  const b = Buffer.alloc(0x3400), n = 0x80;
  neLifecycleImage().copy(b);
  const word = v => [v & 255, v >>> 8 & 255];
  const w = (at, value) => b.writeUInt16LE(value, at);
  w(n + 0x1e, 2); w(n + 0x40, 0x20); w(n + 0x42, 0x2000);
  w(n + 0x44, 0x100); w(n + 0x46, 0x2000);
  w(n + 0x48, 0x300); w(n + 0x4a, 0x400); w(n + 0x4e, 0x400);
  w(n + 0x90, 0); w(n + 0x92, 5);
  b.set([4, ...Buffer.from('USER'), 3, ...Buffer.from('GDI')], n + 0xb0);
  const c = [], relocations = [];
  const emit = (...bytes) => c.push(...bytes);
  const push = v => emit(0x68, ...word(v));
  const pushMem = at => emit(0xff, 0x36, ...word(at));
  const store = at => emit(0xa3, ...word(at));
  const mark = stage => emit(0xc7, 6, 0x80, 0, ...word(stage));
  const check = condition => emit(condition, 2, 0x0f, 0x0b);
  const nonzero = () => {emit(0x85, 0xc0); check(0x75);};
  const equal = v => {emit(0x3d, ...word(v)); check(0x74);};
  const same = at => {emit(0x3b, 6, ...word(at)); check(0x74);};
  const call = (module, ordinal) => {
    emit(0x9a); relocations.push([c.length, module, ordinal]);
    emit(0xff, 0xff, 0, 0);
    emit(0x3b, 0x26, 0x90, 0); check(0x74); // SP == entry SP, after every API
  };
  // LibMain jumps over the VALUE and WEP entries to this body.
  b.set([0xe9, 0x3d, 0], 0x200);
  b.set([0xa1, 0x82, 0, 0xcb], 0x210);
  b.set([0xb8, 1, 0, 0xca, 2, 0], 0x220);
  emit(0x89, 0x26, 0x90, 0);
  for (let i = 0; i <= 30; i++) {
    mark(100 + i); push(i); call(1, 281); nonzero(); store(0x100 + 2 * i);
    push(i); call(1,180); store(0x94); emit(0x89,0x16,0x96,0);
    pushMem(0x100 + 2 * i); push(8); emit(0x1e); push(0x200); call(2,82); equal(8);
    emit(0xa1,2,2); same(0x94); emit(0xa1,4,2); same(0x96);
  }
  for (const i of [31, 32, 0x7fff, 0x8000, 0xffff]) {
    mark(200 + (i & 31)); push(i); call(1, 281); equal(0);
  }
  mark(300);
  emit(0xc7, 6, 0x92, 0, 0, 8); // 2048 iterations, no per-call allocations
  const loop = c.length;
  push(15); call(1, 281); same(0x11e);
  emit(0xff, 0x0e, 0x92, 0, 0x0f, 0x85, ...word(loop - (c.length + 8)));
  mark(301); pushMem(0x11e); call(2, 69); nonzero();
  push(15); call(1, 281); same(0x11e);
  // Independent logical brush inspection: LOGBRUSH16 is style WORD,
  // COLORREF DWORD, hatch WORD. Its color must track the system override.
  const object = expected => {
    pushMem(0x11e); push(8); emit(0x1e); push(0x200); call(2, 82); equal(8);
    emit(0xa1, 0x202 & 255, 2); equal(expected & 65535);
    emit(0xa1, 4, 2); equal(expected >>> 16);
  };
  const setColor = color => {
    emit(0xc7, 6, 0x40, 2, 15, 0, 0xc7, 6, 0x44, 2, ...word(color),
      0xc7, 6, 0x46, 2, ...word(color >>> 16));
    push(1); emit(0x1e); push(0x240); emit(0x1e); push(0x244); call(1, 181); nonzero();
  };
  mark(310); setColor(0xc0c0c0); object(0xc0c0c0);
  // A screen-compatible bitmap is true color; a memory DC alone would
  // create a monochrome DDB and make this color oracle meaningless.
  push(0); call(1, 66); nonzero(); store(0xa0);
  pushMem(0xa0); push(4); push(4); call(2, 51); nonzero(); store(0xa2);
  push(0); call(2, 52); nonzero(); store(0xa4);
  pushMem(0xa4); pushMem(0xa2); call(2, 45); nonzero(); store(0xa6);
  pushMem(0xa4); pushMem(0x11e); call(2, 45); nonzero(); store(0xa8);
  for (let i = 0; i < 4; i++) emit(0xc7, 6, ...word(0x250 + i * 2), ...word(i < 2 ? 0 : 4));
  const pixel = expected => {
    pushMem(0xa4); push(2); push(2); call(2, 83); equal(expected & 65535);
    emit(0x81, 0xfa, ...word(expected >>> 16)); check(0x74);
  };
  const fill = () => {pushMem(0xa4); emit(0x1e); push(0x250); pushMem(0x11e); call(1, 81); nonzero();};
  const pat = () => {
    pushMem(0xa4); push(0); push(0); push(4); push(4); push(0x00f0); push(0x0021); call(2, 29); nonzero();
  };
  mark(320); fill(); pixel(0xc0c0c0);
  mark(321); setColor(0x123456); object(0x123456);
  push(15); call(1, 281); same(0x11e); fill(); pixel(0x123456);
  mark(322); setColor(0xa1b2c3); pat(); pixel(0xa1b2c3);
  mark(323); pushMem(0x11e); call(2, 69); nonzero(); pat(); pixel(0xa1b2c3);
  // Restore the ordinary color through the same public API and release only
  // fixture-owned DC/bitmap objects, after restoring their original selections.
  setColor(0xc0c0c0);
  pushMem(0xa4); pushMem(0xa8); call(2, 45); nonzero();
  pushMem(0xa4); pushMem(0xa6); call(2, 45); nonzero();
  pushMem(0xa2); call(2, 69); nonzero();
  pushMem(0xa4); call(2, 68); nonzero();
  push(0); pushMem(0xa0); call(1, 68); nonzero();
  mark(999); emit(0xc7, 6, 0x82, 0, 0x28, 1, 0xb8, 1, 0, 0xcb);
  assert(c.length < 0x1fc0);
  b.set(c, 0x240); w(0x2200, relocations.length);
  relocations.forEach(([at, module, ordinal], i) => {
    const p = 0x2202 + i * 8;
    b.set([3, 1, ...word(at + 0x40), ...word(module), ...word(ordinal)], p);
  });
  assert(0x2202 + relocations.length * 8 < 0x3000);
  return b;
}

const extraWat = String.raw`
  (func (export "brush_test_win32") (param $idx i32) (result i32)
    (local $sp i32) (local $h i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetSysColorBrush (local.get $idx) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $h (i32.load (global.get $reg_base)))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base))
          (i32.add (local.get $sp) (i32.const 8))) (then (unreachable)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (local.get $h))
  (func (export "brush_test_set32") (param $indices i32) (param $values i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SetSysColors (i32.const 1) (local.get $indices) (local.get $values)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp)))
`;

async function main() {
  const {createHostImports} = require('../lib/host-imports');
  const {createNeLifecycle} = require('../lib/ne-lifecycle');
  const {serviceLoadLibraryYieldSync} = require('../lib/process-boot');
  const {ThreadManager} = require('../lib/thread-manager');
  const {GuestThreadHost} = require('../lib/guest-thread-host');
  const bytes = process.env.WA_TEST_WASM ? fs.readFileSync(process.env.WA_TEST_WASM)
    : require('./compile-src').compileSrcWasm((file,source)=>file==='13-exports.wat'?source+extraWat:source);
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
  const imports = createHostImports({getMemory:()=>memory.buffer, renderer:null, resourceJson:{}});
  imports.host.memory = memory;
  const trace = [];
  imports.host.log_i32 = n => trace.push(n >>> 0);
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  const pe = neGuestCaller();
  new Uint8Array(memory.buffer).set(pe.bytes, e.get_staging()); e.load_pe(pe.bytes.length);
  e.set_eip(pe.entry); e.set_esp(0x7408000);
  const state = owner => ['get_eip','get_esp','get_sreg_cs','get_sreg_ds','get_sreg_ss','get_sync_msg_depth'].map(k=>owner[k]());
  const image = brushImage();
  if (process.env.BRUSH_EXPECT_BEFORE) {
    const before = state(e);
    assert.throws(()=>createNeLifecycle(e, memory, [['BRUSH',image]]).load('BRUSH'), WebAssembly.RuntimeError);
    const at = trace.lastIndexOf(0xca16a9f1);
    assert(at >= 0); assert.equal(trace[at + 1], 0x20119);
    assert.deepEqual(state(e), before);
    console.log('EXPECTED actual imported USER.281 trap', JSON.stringify({key:trace[at+1],returnLinear:trace[at+2],callerRestored:true}));
    return;
  }
  const local = owner => {
    const before = state(owner);
    let ds, dataWasm;
    const facade = new Proxy({}, {get(_target,name) {
      if(name==='win16_bridge_invoke_begin')return (...args)=>{ds=args[2];dataWasm=e.guest_to_wasm(e.win16_seg_base(ds>>>3))>>>0;return owner.win16_bridge_invoke_begin(...args);};
      return owner[name];
    }});
    const life = createNeLifecycle(facade, memory, [['BRUSH',image]]);
    let id;
    try {id=life.load('BRUSH');} catch (error) {
      console.error('guest assertion stage',new DataView(memory.buffer).getUint16(dataWasm+0x80,true),'tail trace',trace.slice(-12)); throw error;
    }
    assert.equal(life.call(id, 'VALUE'), 0x128);
    life.release(id); assert.deepEqual(state(owner), before);
  };
  local(e);
  const usedAfterFirst=e.gdi_object_used();
  const h32 = e.brush_test_win32(15) >>> 0;
  for(let i=0;i<2048;i++)assert.equal(e.brush_test_win32(15)>>>0,h32);
  for(const idx of [-1,31,32,0x7fffffff])assert.equal(e.brush_test_win32(idx),0);
  const indices=e.guest_alloc(4), values=e.guest_alloc(4);
  e.guest_write32(indices,15);e.guest_write32(values,0x654321);
  e.brush_test_set32(indices,values);
  const dc=e.test_call_CreateCompatibleDC(0), bitmap=e.test_call_CreateCompatibleBitmap(0,2,2);
  const oldBitmap=e.test_call_SelectObject(dc,bitmap), oldBrush=e.test_call_SelectObject(dc,h32);
  assert(e.test_call_DeleteObject(h32));
  assert.equal(e.brush_test_win32(15)>>>0,h32);
  assert.equal(e.test_call_PatBlt(dc,0,0,2,2,0xf00021),1);
  assert.equal(e.test_call_GetPixel(dc,0,0)>>>0,0x654321);
  e.test_call_SelectObject(dc,oldBrush);e.test_call_SelectObject(dc,oldBitmap);
  assert(e.test_call_DeleteObject(bitmap));assert(e.test_call_DeleteDC(dc));
  e.guest_write32(values,0xc0c0c0);e.brush_test_set32(indices,values);
  assert.equal(e.gdi_object_used(),usedAfterFirst,'repeated Win32 calls and deletion do not allocate or destroy cached objects');

  const other = (await WebAssembly.instantiate(module, imports)).exports;
  other.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
  const manager = new ThreadManager(module,memory,{exports:e},()=>imports,{});
  const thread = {instance:{exports:other},state:'active',tid:1};
  manager.threads = new Map([[123,thread]]); manager._runningThreadHandle=0;
  local(manager.cooperativeCallbackExports(thread));
  // A newly initialized WASM owner retains its own screen bitmap. The
  // independent record census below counts brushes, excluding that bitmap.
  thread.state='exited';
  assert.throws(()=>createNeLifecycle(manager.cooperativeCallbackExports(thread),memory,[['BRUSH',image]]).load('BRUSH'),/retired/);
  const caller = neGuestCaller(0x400000,{path:'BRUSH.DLL',calls:[[35,[0x402840]],[36,[{result:0}]]]});
  const host = new GuestThreadHost({memory,module,hostImports:imports.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
    workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,findDll:async()=>image,log:()=>{}});
  try {
    await host.start(); await host.loadPe(caller.bytes,'brush-caller.exe');
    await host.callExport('set_esp',0x7408000); await host.callExport('guest_write32',0x7408000,0); await host.callExport('set_eip',caller.entry);
    for(let i=0;i<50;i++) {const r=await host.link.slice(10000); assert(!r.trapped); if(!await host.callExport('get_eip'))break; assert(i<49);}
    assert.equal(await host.callExport('get_esp'),0x7408004);
    const loaded=await host.callExport('guest_read32',caller.result);assert(loaded>=32);
    assert.equal(await host.callExport('guest_read32',caller.result+4),loaded,'FreeLibrary16 is void and preserves EAX');
  } finally {await host.stop();}
  // Same shared cache across all three instances, independently count live
  // records rather than relying on equal handles alone to detect a leak.
  const R = require('../lib/region-map.generated');
  const view = new DataView(memory.buffer), handles=[];
  for(let at=R.BASE.GDI_OBJECT_TABLE;at<R.BASE.GDI_OBJECT_TABLE+R.SIZE.GDI_OBJECT_TABLE;at+=48) {
    if(view.getUint32(at,true) && view.getUint32(at+4,true)===2 && (view.getUint32(at+20,true)&0x80000000))handles.push(view.getUint32(at,true));
  }
  assert.equal(handles.length,31); assert.equal(new Set(handles).size,31);
  console.log('PASS actual USER.281 FAR calls: all indices, NULL unsupported, 2048 repeated calls per owner, system DeleteObject, GetObject, FillRect/PatBlt/GetPixel, SetSysColors, local/cooperative/Worker restoration; shared cached brushes:',handles.length);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={brushImage,extraWat};
