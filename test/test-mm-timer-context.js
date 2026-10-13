#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { readPE } = require('../lib/pe');

// Observe the real entry/return paths. Only heap failure injection and small
// setup/readback exports are added to the test module; no timer logic is patched.
const extraWat = String.raw`
  (global $test_heap_fail (mut i32) (i32.const 0))
  (func (export "test_fail_alloc") (param $n i32)
    (global.set $test_heap_fail (local.get $n)))
  (func (export "test_node") (result i32) (global.get $tls_registry_node))
  (func (export "test_timer_vector") (result i32) (global.get $mm_context_slots))
  (func (export "test_timer_node") (result i32) (global.get $mm_context_node))
  (func (export "test_context_active") (result i32) (global.get $mm_context_active))
  (func (export "test_timer_id") (result i32) (i32.load (call $mm_timer_slot (i32.const 0))))
  (func (export "test_timer") (param $cb i32) (param $once i32)
    (local $p i32)
    (local.set $p (call $mm_timer_slot (i32.const 0)))
    (i32.store (local.get $p) (i32.const 7))
    (i32.store offset=4 (local.get $p) (i32.const 0))
    (i32.store offset=8 (local.get $p) (local.get $cb))
    (i32.store offset=12 (local.get $p) (i32.const 123))
    (i32.store offset=16 (local.get $p) (i32.const 0))
    (i32.store offset=20 (local.get $p) (local.get $once)))
  (func (export "test_dispatch") (param $msg i32)
    (call $handle_DispatchMessageA (local.get $msg)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_wave") (param $cb i32)
    (i32.store (region.addr $WAVE_OUT_SHARED 4) (local.get $cb))
    (i32.store (region.addr $WAVE_OUT_SHARED 8) (i32.const 123))
    (i32.store (region.addr $WAVE_OUT_SHARED 12) (i32.const 3)))
  (func (export "test_seed_seh_scratch")
    (global.set $delphi_seh_rec (i32.const 101))
    (global.set $delphi_exception_record (i32.const 102))
    (global.set $delphi_resume_eip (i32.const 103))
    (global.set $delphi_resume_esp (i32.const 104))
    (global.set $delphi_seh_head_before (i32.const 105)))
  (func (export "test_seh_scratch") (param $field i32) (result i32)
    (if (i32.eqz (local.get $field)) (then (return (global.get $delphi_seh_rec))))
    (if (i32.eq (local.get $field) (i32.const 1)) (then (return (global.get $delphi_exception_record))))
    (if (i32.eq (local.get $field) (i32.const 2)) (then (return (global.get $delphi_resume_eip))))
    (if (i32.eq (local.get $field) (i32.const 3)) (then (return (global.get $delphi_resume_esp))))
    (global.get $delphi_seh_head_before))
  (func (export "test_raise_handled") (param $frame i32) (param $handler i32)
    (call $gs32 (local.get $frame) (i32.const -1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $handler))
    (call $gs32 (global.get $fs_base) (local.get $frame))
    (global.set $delphi_resume_eip (global.get $eip))
    (global.set $delphi_resume_esp (i32.load offset=16 (global.get $reg_base)))
    (call $raise_delphi_exception (i32.const 0x12345678)
      (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_terminate_callback")
    (call $seh_terminate_unhandled (i32.const 99)))
`;

(async () => {
  const bytes = compileSrcWasm((file, source) => {
    if (file === '13-exports.wat') return source + '\n' + extraWat;
    if (file === '10-helpers.wat') {
      const marker = '    ;; Refuse huge/overflowing allocations before adding the block header.';
      assert.strictEqual(source.split(marker).length, 2, 'unique heap failure seam');
      return source.replace(marker, `
    (if (global.get $test_heap_fail) (then
      (global.set $test_heap_fail (i32.sub (global.get $test_heap_fail) (i32.const 1)))
      (if (i32.eqz (global.get $test_heap_fail)) (then (return (i32.const 0))))))
${marker}`);
    }
    return source;
  });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const exits = [];
  const ctx = { getMemory: () => memory.buffer };
  const imports = createHostImports(ctx);
  Object.assign(imports.host, { memory, log: () => {}, log_i32: () => {},
    exit: code => exits.push(code >>> 0), get_ticks: () => 1000 });
  const e = (await WebAssembly.instantiate(bytes, imports)).instance.exports;
  ctx.exports = e;

  // Real EXE static TLS template followed later by a relocated DLL template.
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  const pe = readPE(image);
  const section = pe.sections.find(s => s.name === '.rsrc' && s.rawSize >= 128);
  assert(section);
  const rva = section.rva + section.rawSize - 128;
  const offset = pe.va2off(pe.imageBase + rva);
  image.fill(0, offset, offset + 128);
  image.writeUInt32LE(rva, pe.peOff + 24 + 96 + 9 * 8);
  image.writeUInt32LE(24, pe.peOff + 24 + 96 + 9 * 8 + 4);
  image.writeUInt32LE(pe.imageBase + rva + 32, offset);
  image.writeUInt32LE(pe.imageBase + rva + 36, offset + 4);
  image.writeUInt32LE(pe.imageBase + rva + 48, offset + 8);
  image.writeUInt32LE(8, offset + 16);
  image.writeUInt32LE(0x12345678, offset + 32);
  new Uint8Array(memory.buffer).set(image, e.get_staging());
  assert(e.load_pe(image.length));
  const read = a => e.guest_read32(a) >>> 0;
  const write = (a, v) => e.guest_write32(a, v);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const tib = e.get_fs_base() >>> 0;
  const mainVector = e.get_tls_slots() >>> 0;
  const mainNode = e.test_node() >>> 0;
  const staticIndex = read(pe.imageBase + rva + 48);
  const staticData = read(mainVector + staticIndex * 4);
  const api = (name, ...args) => {
    const esp = e.get_esp();
    const value = e[`test_call_${name}`](...args) >>> 0;
    assert.strictEqual(e.get_esp(), esp, name + ' wrapper stack');
    return value;
  };
  const dynamic = api('TlsAlloc');
  assert.notStrictEqual(dynamic, 0xffffffff);
  api('TlsSetValue', dynamic, 0xabc);
  write(staticData, 0xfeed);
  const stack = alloc(8192) + 4096;
  const out = alloc(16), mainSeh = alloc(16), msg = alloc(32);
  write(mainSeh, 0xffffffff); write(mainSeh + 4, 0);
  write(tib, mainSeh);
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24];
  const put = code => {
    const p = alloc(code.length + 16);
    new Uint8Array(memory.buffer).set(code, e.guest_to_wasm(p));
    return p;
  };
  // This exact FS-relative block is decoded first on main, then reused by
  // callbacks, then main again without flushing the block cache.
  const probe = put([0x64, 0xa1, 0x2c, 0, 0, 0, 0xa3, ...u32(out),
    0x64, 0x8b, 0x0d, 0, 0, 0, 0, 0x89, 0x0d, ...u32(out + 4), 0xc3]);
  const callback = alloc(64);
  const callbackBytes = [0xe8, ...u32(probe - (callback + 5)),
    0xff, 0x80, ...u32(dynamic * 4), // inc [eax+dynamic*4]
    0x8b, 0x90, ...u32(staticIndex * 4), 0xff, 0x02, // mov edx,[eax+index*4]; inc [edx]
    0xc2, 20, 0];
  new Uint8Array(memory.buffer).set(callbackBytes, e.guest_to_wasm(callback));
  const resume = put([0xc3]);
  const prepare = () => {
    e.clear_yield(); e.set_esp(stack); write(stack, 0); e.set_eip(resume);
    api('SetLastError', 0x7654); e.test_seed_seh_scratch();
  };
  const scratch = () => Array.from({ length: 5 }, (_, i) => e.test_seh_scratch(i));
  const identity = () => ({ fs: e.get_fs_base() >>> 0, vector: e.get_tls_slots() >>> 0,
    node: e.test_node() >>> 0, tibVector: read(tib + 44), seh: read(tib),
    error: api('GetLastError'), scratch: scratch() });
  const run = () => { e.run(10000); assert.strictEqual(e.get_eip(), 0, 'bounded fixture returned'); };
  prepare(); e.set_eip(probe); run();
  assert.strictEqual(read(out), mainVector);
  assert.strictEqual(read(out + 4), mainSeh);

  // Fail the vector allocation, then registry allocation, then static data
  // initialization. Each failure must leave the due one-shot and caller intact.
  for (const failure of [1, 2, 3]) {
    prepare(); e.test_timer(callback, 1);
    const before = identity(), esp = e.get_esp(), pc = e.get_eip();
    e.test_fail_alloc(failure);
    assert.strictEqual(e.fire_mm_timer(), 0, 'failed callback initialization');
    assert.deepStrictEqual(identity(), before, 'allocation failure preserves main context');
    assert.strictEqual(e.get_esp(), esp); assert.strictEqual(e.get_eip(), pc);
    assert.strictEqual(e.test_timer_id(), 7, 'one-shot is still due');
    assert.strictEqual(e.is_mm_timer_callback_active(), 0);
    assert.strictEqual(e.test_context_active(), 0);
  }
  prepare(); const expectedMain = identity();
  assert.strictEqual(e.fire_mm_timer(), 1, 'retry completes retained vector');
  assert.strictEqual(e.test_timer_id(), 0, 'successful one-shot retired');
  const timerVector = e.get_tls_slots() >>> 0, timerNode = e.test_node() >>> 0;
  assert.notStrictEqual(timerVector, mainVector); assert.notStrictEqual(timerNode, mainNode);
  assert.strictEqual(read(mainNode + 4), mainVector, 'main registry row never replaced');
  assert.strictEqual(read(timerNode + 4), timerVector);
  assert.strictEqual(read(timerVector + dynamic * 4), 0);
  const timerStatic = read(timerVector + staticIndex * 4);
  assert.notStrictEqual(timerStatic, staticData);
  assert.strictEqual(read(timerStatic), 0x12345678);
  assert.strictEqual(read(timerStatic + 4), 0); assert.strictEqual(read(timerStatic + 8), 0);
  assert.deepStrictEqual(scratch(), [0, 0, 0, 0, 0]);
  assert.strictEqual(e.get_fs_base() >>> 0, tib);
  assert.strictEqual(read(tib), 0xffffffff);
  assert.strictEqual(e.fire_mm_timer(), 0, 'nested asynchronous delivery refused');
  // Nested DispatchMessage must not overwrite the outstanding saved context.
  const callbackEsp = e.get_esp(), callbackPc = e.get_eip();
  write(msg, 123); write(msg + 4, 0x7ff0); write(msg + 8, 7); write(msg + 12, callback);
  e.set_esp(stack - 2048); write(stack - 2048, resume);
  e.test_dispatch(msg);
  assert.strictEqual(e.get_eip(), callbackPc);
  assert.strictEqual(e.get_esp(), stack - 2040);
  assert.strictEqual(e.get_tls_slots() >>> 0, timerVector);
  assert.strictEqual(e.is_mm_timer_callback_active(), 1);
  e.set_esp(callbackEsp);
  api('SetLastError', 0x9999);
  run();
  assert.deepStrictEqual(identity(), expectedMain, 'completion restores TLS/SEH/error/scratch');
  assert.strictEqual(read(out), timerVector, 'cached FS block sees callback vector');
  assert.strictEqual(read(out + 4), 0xffffffff);
  assert.strictEqual(read(timerVector + dynamic * 4), 1);
  assert.strictEqual(read(timerStatic), 0x12345679);
  assert.strictEqual(read(staticData), 0xfeed);
  assert.strictEqual(read(mainVector + dynamic * 4), 0xabc);

  // A DLL loaded after callback creation initializes both registered vectors.
  const dll = Buffer.from(image);
  dll.writeUInt16LE(dll.readUInt16LE(pe.peOff + 22) | 0x2000, pe.peOff + 22);
  dll.writeUInt32LE(0xabcdef01, offset + 32);
  dll.writeUInt32LE(rva + 64, pe.peOff + 24 + 96 + 5 * 8);
  dll.writeUInt32LE(16, pe.peOff + 24 + 96 + 5 * 8 + 4);
  dll.writeUInt32LE(rva & ~0xfff, offset + 64); dll.writeUInt32LE(16, offset + 68);
  for (let i = 0; i < 3; i++) dll.writeUInt16LE(0x3000 | ((rva + i * 4) & 0xfff), offset + 72 + i * 2);
  const dllBase = e.get_next_dll_addr() >>> 0;
  new Uint8Array(memory.buffer).set(dll, e.get_staging());
  assert(e.load_dll(dll.length, dllBase));
  const dllIndex = read(dllBase + rva + 48);
  const dllMain = read(mainVector + dllIndex * 4), dllTimer = read(timerVector + dllIndex * 4);
  assert(dllMain && dllTimer && dllMain !== dllTimer);
  for (const p of [dllMain, dllTimer]) {
    assert.strictEqual(read(p), 0xabcdef01); assert.strictEqual(read(p + 8), 0);
  }
  // DispatchMessage entry shares the persistent callback data, without an
  // async fire; CACA000A returns through the completed stdcall API frame.
  prepare(); write(stack, resume); write(stack + 8, 0);
  e.test_dispatch(msg);
  assert.strictEqual(api('GetLastError'), 0x9999, 'callback last error persists');
  assert.strictEqual(e.get_tls_slots() >>> 0, timerVector);
  run();
  assert.strictEqual(e.get_esp(), stack + 12);
  assert.deepStrictEqual(identity(), expectedMain);
  assert.strictEqual(read(timerVector + dynamic * 4), 2);
  assert.strictEqual(read(timerStatic), 0x1234567a);
  assert.strictEqual(api('TlsFree', dynamic), 1);
  assert.strictEqual(read(timerVector + dynamic * 4), 0, 'TlsFree clears inactive callback vector');
  assert.strictEqual(read(mainVector + dynamic * 4), 0);
  assert.strictEqual(api('TlsAlloc'), dynamic);

  // Reuse the same decoded FS reader on main after both callback paths.
  prepare(); e.set_eip(probe); run();
  assert.strictEqual(read(out), mainVector); assert.strictEqual(read(out + 4), mainSeh);

  // A handled software exception inside a TimeProc resumes that callback,
  // then its completion restores the interrupted caller's exception scratch.
  const frame = alloc(16), handler = put([0x31, 0xc0, 0xc3]);
  prepare(); e.test_timer(callback, 1); assert.strictEqual(e.fire_mm_timer(), 1);
  e.test_raise_handled(frame, handler); run();
  assert.deepStrictEqual(exits, []);
  assert.deepStrictEqual(identity(), expectedMain);
  assert.strictEqual(read(out), timerVector);
  assert.strictEqual(read(out + 4), frame, 'handled callback retains its own chain');
  assert.strictEqual(read(timerVector + dynamic * 4), 1);

  // The shared return thunk must not install the last timer vector for waveOut.
  prepare(); const waveMain = identity();
  e.test_wave(callback);
  assert.strictEqual(e.fire_wave_out_callback(17, 19), 1);
  assert.strictEqual(e.test_context_active(), 0);
  assert.strictEqual(e.get_tls_slots() >>> 0, mainVector);
  run();
  assert.deepStrictEqual(identity(), waveMain);
  assert.strictEqual(read(out), mainVector);
  assert.strictEqual(read(mainVector + dynamic * 4), 1);
  assert.strictEqual(e.is_mm_timer_callback_active(), 0);

  // Terminal callbacks bypass CACA000A: clean identity without reviving main.
  prepare(); e.test_timer(callback, 1); assert.strictEqual(e.fire_mm_timer(), 1);
  e.test_terminate_callback(); e.run(1);
  assert.deepStrictEqual(exits, [99]);
  assert.strictEqual(e.get_eip(), 0); assert.strictEqual(e.get_yield_reason(), 2);
  assert.strictEqual(e.test_context_active(), 0);
  assert.strictEqual(e.is_mm_timer_callback_active(), 0);
  assert.deepStrictEqual(identity(), expectedMain);
  console.log('PASS multimedia callback context: cached FS, static/dynamic TLS, registry lifetime, failures, both entries, SEH and waveOut');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
