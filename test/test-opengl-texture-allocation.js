'use strict';

// Exercise the shipped guest GL handler, CPU storage, stream and frontend.
// No game media or frontend-only image injection is involved.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { OpenGLHostBridge } = require('../lib/gl-compat');
const Stream = require('../lib/gl-command-stream');
const api = require('../src/api_table.json');
const fs = require('fs');

const extraWat = `
 (func (export "allocation_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base)
     (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "allocation_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "allocation_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "allocation_call") (param $id i32) (param $stack i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $stack))
   (call $win32_dispatch (i32.div_u (i32.sub (local.get $id) (global.get $thunk_guest_base)) (i32.const 8)))
   (i32.load (global.get $reg_base)))
 (func (export "allocation_dc") (result i32)
   (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (i32.const 42) (i32.const 0)))
   (i32.load (global.get $reg_base)))
 (func (export "allocation_pages") (result i32)
   (local $i i32) (local $n i32)
   (loop $scan
     (local.set $n (i32.add (local.get $n)
       (i32.load8_u (i32.add (global.get $DIB_PAGE_USED) (local.get $i)))))
     (local.set $i (i32.add (local.get $i) (i32.const 1)))
     (br_if $scan (i32.lt_u (local.get $i) (global.get $DIB_PAGE_COUNT))))
   (local.get $n))
 (func (export "allocation_records") (result i32)
   (local $i i32) (local $n i32)
   (loop $scan
     (local.set $n (i32.add (local.get $n) (i32.ne (i32.load
       (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $i) (i32.const 5)))) (i32.const 0))))
     (local.set $i (i32.add (local.get $i) (i32.const 1)))
     (br_if $scan (i32.lt_u (local.get $i) (global.get $DX_MAX))))
   (local.get $n))
 (func (export "allocation_billed") (result i32) (global.get $dx_vidmem_used))
 ;; Controlled record pressure: occupy only free records, then restore only
 ;; our sentinels. Image allocation and rollback still run production code.
 (func (export "allocation_record_pressure") (param $hold i32)
   (local $i i32) (local $p i32)
   (loop $scan
     (local.set $p (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $i) (i32.const 5))))
     (if (i32.eq (i32.load (local.get $p)) (select (i32.const 0) (i32.const -1) (local.get $hold)))
       (then (i32.store (local.get $p) (select (i32.const -1) (i32.const 0) (local.get $hold)))))
     (local.set $i (i32.add (local.get $i) (i32.const 1)))
     (br_if $scan (i32.lt_u (local.get $i) (global.get $DX_MAX)))))
`;

(async () => {
  let memory, bridge, uploads = 0;
  let moduleOptions = { extraWat };
  if (process.env.GL_ALLOCATION_BASELINE_SHA) {
    const { execFileSync } = require('child_process');
    const changed = new Set(['09a8b-handlers-opengl.wat', '09a8g-gl-raster.wat', '09ad-handlers-d3d9.wat']);
    const bytes = require('./compile-src').compileSrcWasm((file, source) => {
      if (file === '13-exports.wat') return source + extraWat;
      return changed.has(file) ? execFileSync('git', ['show', process.env.GL_ALLOCATION_BASELINE_SHA + ':src/' + file], { encoding: 'utf8' }) : source;
    });
    moduleOptions = { prebuiltModule: new WebAssembly.Module(bytes) };
  }
  const h = await bootRenderHarness({ ...moduleOptions, fonts: 'none', width: 8, height: 8,
    extraHostOverrides: { gpu_gl_call(op, at, bytes) {
      assert.strictEqual(op, Stream.WAT_STREAM_FLUSH_OPCODE);
      return bridge.replay(Stream.memoryBatch(memory, at, bytes));
    } } });
  memory = h.memory;
  const e = h.exports, dv = new DataView(memory.buffer);
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000);
  const renderer = { windows: { 42: { hwnd: 42, w: 8, h: 8, clientRect: { w: 8, h: 8 } } }, repaint() {} };
  bridge = new OpenGLHostBridge({ backend: 'software', getMemory: () => memory.buffer, exports: e, renderer });
  const stack = e.guest_alloc(256), wa = p => e.guest_to_wasm(p) >>> 0;
  e.allocation_init();
  function str(s) { const p = e.guest_alloc(s.length + 1); new Uint8Array(memory.buffer, wa(p), s.length + 1).set(Buffer.from(s + '\0')); return p; }
  const module = e.allocation_module(str('opengl32.dll')), thunks = new Map();
  const history = process.env.GL_ALLOCATION_HISTORY ? JSON.parse(fs.readFileSync(process.env.GL_ALLOCATION_HISTORY, 'utf8')) : [];
  const inputBytes = Math.max(256 * 256 * 4, ...history.map(x => x.width * x.height * 4));
  const input = e.guest_alloc(inputBytes), output = e.guest_alloc(256 * 256 * 4);
  new Uint8Array(memory.buffer, wa(input), inputBytes).fill(173);
  const call = (name, args = []) => {
    if (!thunks.has(name)) thunks.set(name, e.allocation_lookup(module, str(name)));
    assert(thunks.get(name), name + ' resolves');
    assert.strictEqual(dv.getUint32(wa(thunks.get(name)) + 4, true), api.find(x => x.name === name).id);
    dv.setUint32(wa(stack), 0x12345678, true);
    args.forEach((x, i) => dv.setUint32(wa(stack) + 4 + i * 4, x >>> 0, true));
    return e.allocation_call(thunks.get(name), stack) >>> 0;
  };
  const dc = e.allocation_dc(), context = call('wglCreateContext', [dc]);
  assert(context); assert.strictEqual(call('wglMakeCurrent', [dc, context]), 1);
  const frontend = bridge.contexts.get(bridge.current).frontend, texImage = frontend.texImage;
  frontend.texImage = function (...args) { uploads++; return texImage.apply(this, args); };
  const T = 0xde1, RGBA = 0x1908, U8 = 0x1401;
  const image = (w = 256, h = 256, level = 0) => call('glTexImage2D', [T, level, 4, w, h, 0, RGBA, U8, input]);
  const baseline = { pages: e.allocation_pages(), records: e.allocation_records(), billed: e.allocation_billed() };
  // 72 MiB of live images exceed the fixed 63 MiB DIB arena. All remain
  // simultaneously defined: eviction or skipped uploads cannot pass this test.
  const count = 288;
  try {
    if (history.length) {
      for (const x of history) {
        call('glBindTexture', [T, x.name]);
        call('glTexImage2D', [T, x.level, x.internal, x.width, x.height, x.border, RGBA, U8, input]);
        assert.strictEqual(call('glGetError'), 0, 'retained upload metadata ' + x.name + '/' + x.level);
      }
      call('glFinish'); assert.strictEqual(uploads, history.length);
      const names = [...new Set(history.map(x => x.name))], at = e.guest_alloc(names.length * 4);
      names.forEach((n, i) => dv.setUint32(wa(at) + i * 4, n, true));
      console.log(JSON.stringify({ retainedUploads: uploads, pages: e.allocation_pages(), records: e.allocation_records(), billed: e.allocation_billed() }));
      call('glDeleteTextures', [names.length, at]);
      assert.strictEqual(e.allocation_records(), baseline.records);
      assert.strictEqual(e.allocation_pages(), baseline.pages);
      uploads = 0;
    }
    for (let n = 1; n <= count; n++) {
      call('glBindTexture', [T, n]); image();
      const error = call('glGetError');
      if (error) console.error(JSON.stringify({ failedImage: n, error, uploads,
        pages: e.allocation_pages(), records: e.allocation_records(), baseline }));
      assert.strictEqual(error, 0, `live image ${n} must allocate and upload`);
    }
    call('glFinish'); assert.strictEqual(uploads, count);
    assert.strictEqual(e.allocation_pages(), baseline.pages, 'GL images leave DIB capacity for display bitmaps');
    assert.strictEqual(e.allocation_records(), baseline.records + count);
    for (let n = 1; n <= count; n++) {
      call('glBindTexture', [T, n]);
      call('glGetTexImage', [T, 0, RGBA, U8, output]);
      assert.strictEqual(call('glGetError'), 0);
      assert(new Uint8Array(memory.buffer, wa(output), 256 * 256 * 4).every(x => x === 173), `retained pixels ${n}`);
    }
    // Redefinition replaces storage; subimage retains storage and changes data.
    const records = e.allocation_records();
    for (let i = 0; i < 20; i++) image(i % 2 ? 128 : 256, 128);
    assert.strictEqual(e.allocation_records(), records);
    // A real COM record limit must still fail, report OOM and roll back the
    // unpublished heap image. Repeated failures must reuse its freed storage.
    call('glFinish'); const uploaded = uploads;
    e.allocation_record_pressure(1);
    image(); assert.strictEqual(call('glGetError'), 0x505);
    const heapTop = e.get_heap_ptr(), sparseTop = e.get_heap_sparse_ptr();
    for (let i = 0; i < 4; i++) { image(); assert.strictEqual(call('glGetError'), 0x505); }
    assert.strictEqual(e.get_heap_ptr(), heapTop, 'failed allocation frees direct backing');
    assert.strictEqual(e.get_heap_sparse_ptr(), sparseTop, 'failed allocation frees sparse backing');
    call('glFinish'); assert.strictEqual(uploads, uploaded, 'failed image never reaches frontend');
    e.allocation_record_pressure(0);
    assert.strictEqual(e.allocation_records(), records);
    new Uint8Array(memory.buffer, wa(input), 16).fill(91);
    call('glTexSubImage2D', [T, 0, 0, 0, 2, 2, RGBA, U8, input]);
    call('glGetTexImage', [T, 0, RGBA, U8, output]);
    assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer, wa(output), 8)), Array(8).fill(91));
    // Invalid requests still report their error and retain the existing image.
    image(257, 128); assert.strictEqual(call('glGetError'), 0x501);
    assert.strictEqual(e.allocation_records(), records);
    // A zero-sized definition releases the previous image without a new surface.
    image(0, 0); assert.strictEqual(call('glGetError'), 0);
    assert.strictEqual(e.allocation_records(), records - 1);
    const names = e.guest_alloc(count * 4);
    for (let n = 1; n <= count; n++) dv.setUint32(wa(names) + (n - 1) * 4, n, true);
    call('glDeleteTextures', [count, names]);
    assert.strictEqual(e.allocation_records(), baseline.records);
    assert.strictEqual(e.allocation_billed(), baseline.billed);
    assert.strictEqual(e.allocation_pages(), baseline.pages);
    call('glBindTexture', [T, 725]); image(); image(128, 128, 1);
    assert.strictEqual(call('glGetError'), 0);
    assert.strictEqual(call('wglMakeCurrent', [0, 0]), 1);
    assert.strictEqual(call('wglDeleteContext', [context]), 1);
    assert.strictEqual(e.allocation_records(), baseline.records, 'context teardown releases remaining levels');
    assert.strictEqual(e.allocation_billed(), baseline.billed);
    console.log(JSON.stringify({ result: 'PASS', count, liveBytes: count * 256 * 256 * 4, uploads, baseline }));
  } finally { e.allocation_record_pressure(0); bridge.destroy(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
