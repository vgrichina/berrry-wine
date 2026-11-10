#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Compile the complete current production CPU. Add only fixture setup and
// readback exports: admission, x86 decoding/RET and CACA000A are unmodified.
// Cooperative callbacks borrow the caller's TLS/SEH context; their contract is
// an invocation-owned register/flags frame, not a separate timer TLS vector.
const fields = ['saved_cf', 'mm_callback_depth', 'mm_timer_resume_yield',
  'wave_callback_saved', 'wait_handle', 'wait_handles_ptr', 'wait_all',
  'wait_timeout', 'wait_stack_bytes'];
const extraWat = `
  ${fields.map(n => `(func (export "test_${n}") (result i32) (global.get $${n}))`).join('\n')}
  (func (export "test_context") (result i64) (call $invocation_current))
  (func (export "test_audio_yield_flag") (result i32)
    (global.get $wave_callback_saved_yield_flag))
  (func (export "test_bp_reset") (global.set $bp_skip_once (i32.const 0)))
  (func (export "test_wait")
    (global.set $wait_handle (i32.const 42))
    (global.set $wait_handles_ptr (i32.const 0))
    (global.set $wait_all (i32.const 1))
    (global.set $wait_timeout (i32.const -1))
    (global.set $wait_stack_bytes (i32.const 12)))
  (func (export "test_timer") (param $cb i32) (param $flags i32)
    (local $p i32)
    (local.set $p (call $mm_timer_slot (i32.const 0)))
    (i32.store (local.get $p) (i32.const 7))
    (i32.store offset=4 (local.get $p) (i32.const 10))
    (i32.store offset=8 (local.get $p) (local.get $cb))
    (i32.store offset=12 (local.get $p) (i32.const 123))
    (i32.store offset=16 (local.get $p) (i32.const 0))
    (i32.store offset=20 (local.get $p) (local.get $flags)))
  (func (export "test_timer_id") (result i32)
    (i32.load (call $mm_timer_slot (i32.const 0))))
  (func (export "test_dispatch") (param $msg i32)
    (call $handle_DispatchMessageA (local.get $msg)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
`;

(async () => {
  const bytes = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + '\n' + extraWat : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const exits = [], ctx = { getMemory: () => memory.buffer };
  const imports = createHostImports(ctx);
  Object.assign(imports.host, { memory, log: () => {}, log_i32: () => {},
    exit: code => exits.push(code >>> 0), get_ticks: () => 1000 });
  const e = (await WebAssembly.instantiate(bytes, imports)).instance.exports;
  ctx.exports = e;
  // Load only to establish the real process invocation, thunk and TLS state.
  // No EXE entry point or startup code runs.
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(image, e.get_staging());
  assert(e.load_pe(image.length));
  e.set_api_log(0);
  const read = a => e.guest_read32(a) >>> 0;
  const write = (a, v) => e.guest_write32(a, v);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24];
  const put = code => {
    const p = alloc(code.length + 16);
    new Uint8Array(memory.buffer).set(code, e.guest_to_wasm(p));
    return p;
  };
  const stack = alloc(8192) + 4096, msg = alloc(32), count = alloc(4);
  // A real interrupted callee frame: PUSH EBP; MOV EBP,ESP; STC; MOV EAX,-1;
  // INC EAX; JMP body. INC keeps carry lazily in saved_cf. Its epilogue will
  // still have to find the original saved EBP and return address after delivery.
  const interrupted = alloc(64), body = interrupted + 12;
  new Uint8Array(memory.buffer).set([
    0x55, 0x89, 0xe5, 0xf9, 0xb8, 0xff, 0xff, 0xff, 0xff, 0x40, 0xeb, 0,
    0x5d, 0xc3
  ], e.guest_to_wasm(interrupted));
  // ABI-correct callback with a local stack frame, preserved nonvolatile
  // registers, observable store and deliberately different volatile/lazy flags.
  const callback = put([
    0x55, 0x89, 0xe5, 0x53, 0x56, 0x57, 0x83, 0xec, 0x10,
    0xbb, ...u32(0xbbbbbbbb), 0xbe, ...u32(0xeeeeeeee), 0xbf, ...u32(0xdddddddd),
    0xff, 0x05, ...u32(count),
    0xb8, ...u32(0x11111111), 0xb9, ...u32(0x22222222), 0xba, ...u32(0x33333333),
    0x31, 0xc0, 0x40, // XOR EAX,EAX; INC EAX (carry now zero)
    0x83, 0xc4, 0x10, 0x5f, 0x5e, 0x5b, 0x5d, 0xc2, 20, 0
  ]);
  const names = ['eip', 'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi',
    'flag_op', 'flag_a', 'flag_b', 'flag_res', 'flag_sign_shift'];
  const cpu = () => Object.fromEntries(names.map(n => [n, e['get_' + n]() >>> 0])
    .concat([['saved_cf', e.test_saved_cf() >>> 0]]));
  const words = (p, n) => Array.from({ length: n }, (_, i) => read(p + i * 4));
  const stopAt = (pc, halt = 5) => {
    e.set_bp(pc); e.test_bp_reset(); e.run(1000);
    assert.equal(e.get_eip() >>> 0, pc, 'bounded CPU breakpoint');
    assert.equal(e.get_last_run_halt(), halt, 'bounded breakpoint or restored wait');
    e.set_bp(0);
  };
  let serial = 0;
  const drain = kinds => {
    assert.equal(e.callback_feed_invalid(), 0, 'no lost observations');
    const records = Array.from({ length: e.callback_feed_count() }, (_, i) =>
      Array.from({ length: 15 }, (_, j) => e.callback_feed_get(i, j) >>> 0));
    assert.deepEqual(records.map(v => v[0]), kinds);
    for (const v of records) assert.equal(v[1], ++serial, 'CPU-issued sequence');
    e.callback_feed_drain();
    return records;
  };
  const prepare = () => {
    e.clear_yield(); e.set_esp(stack); write(stack, 0); e.set_eip(interrupted);
    for (const [i, n] of ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'].entries())
      e['set_' + n](0x44440000 + i);
    stopAt(body);
    assert.equal(e.test_saved_cf(), 1, 'interrupted INC retains carry');
    assert.equal(e.get_esp(), stack - 4);
    assert.deepEqual(words(stack - 4, 2), [0x44440003, 0]);
    serial = 0; assert.equal(e.callback_feed_arm(1), 1);
  };
  const assertEntry = (before, args, dispatch = false) => {
    const sp = e.get_esp() >>> 0;
    assert.equal(e.get_eip() >>> 0, callback);
    assert.equal(sp, before.esp - 64);
    const thunk = read(sp);
    assert.deepEqual(words(sp + 4, 5), args, 'real stdcall argument order');
    assert.deepEqual(words(sp + 24, 10), [before.eip, before.eax, before.ecx,
      before.edx, before.flag_op, before.flag_res, before.flag_a, before.flag_b,
      before.flag_sign_shift, before.saved_cf], 'complete production save frame');
    assert.equal(e.is_mm_timer_callback_active(), 1);
    const records = drain([dispatch ? 6 : 1, 2]);
    assert.equal(records[1][11], e.test_mm_callback_depth());
    assert.equal(records[1][4], callback);
    assert.equal(records[1][5], sp);
    assert.notDeepEqual(records[0].slice(2, 4), records[1].slice(2, 4), 'new invocation token');
    assert.deepEqual(records[0].slice(12, 14), records[1].slice(12, 14), 'same invocation root');
    return thunk;
  };
  const returnTo = (thunk, before, parent, audioWaiting = false) => {
    const oldCount = read(count);
    stopAt(thunk); // Executes the actual decoded x86 RET 20, not modeled ESP.
    assert.equal(read(count), oldCount + 1, 'callback body executed');
    assert.equal(e.get_esp() >>> 0, before.esp - 40, 'native RET consumed all five arguments');
    assert.equal(e.get_eax(), 1); assert.equal(e.get_ecx() >>> 0, 0x22222222);
    assert.equal(e.get_edx() >>> 0, 0x33333333);
    assert.notEqual(e.test_saved_cf(), before.saved_cf, 'callback actually clobbered carry');
    const [ret] = drain([3]);
    assert.equal(ret[4], thunk); assert.equal(ret[5], before.esp - 40);
    assert.equal(ret[10], before.eip, 'RET lands on invocation save frame');
    // Audio restores yield_flag too, ending the slice before the breakpoint.
    stopAt(before.eip, audioWaiting ? 3 : 5); // Real CACA000A continuation.
    const [restored] = drain([4]);
    assert.equal(restored[4], before.eip); assert.equal(restored[5], before.esp);
    assert.deepEqual(cpu(), before, 'all registers and lazy flags restored');
    assert.equal(e.test_context(), parent, 'parent invocation restored');
  };

  for (const route of ['timer', 'timer-wait', 'dispatch', 'nested-timer', 'nested-wave']) {
    prepare();
    const original = cpu(), root = e.test_context(), liveStack = words(original.esp, 2);
    e.test_timer(callback, 1); // Internal slot flags: bit 0 retires a one-shot.
    if (route === 'dispatch') {
      write(msg, 123); write(msg + 4, 0x7ff0); write(msg + 8, 7); write(msg + 12, callback);
      e.set_esp(original.esp - 8); write(original.esp - 8, body); write(original.esp - 4, msg);
      e.test_dispatch(msg);
    } else if (route === 'nested-wave') {
      e.test_wait(); e.set_yield_state(1, 1);
      assert.equal(e.fire_wave_out_callback_bound(17, 19, callback, 123), 1);
      assert.equal(e.test_audio_yield_flag(), 1, 'audio retained the original yield flag');
    } else {
      if (route === 'timer-wait') e.set_yield_state(1, 1);
      assert.equal(e.fire_mm_timer(), 1);
    }
    const thunk = assertEntry(original, route === 'nested-wave' ? [17, 0x3bd, 123, 19, 0]
      : [7, 0, 123, 0, 0], route === 'dispatch');
    if (route !== 'dispatch' && route !== 'nested-wave') assert.equal(e.test_timer_id(), 0);
    const active = cpu(), owner = e.test_context();
    const frame = words(active.esp, 16);
    assert.equal(e.fire_mm_timer(), 0, 'nested asynchronous timer refused');
    assert.deepEqual(cpu(), active); assert.deepEqual(words(active.esp, 16), frame);
    assert.equal(e.test_context(), owner); drain([]);
    if (route.startsWith('nested-')) {
      // An actual API frame below the outer callback stack; completion must
      // resume that outer callback, preserving its guard and private save frame.
      write(msg, 123); write(msg + 4, 0x7ff0); write(msg + 8, 7); write(msg + 12, callback);
      e.set_esp(active.esp - 8); write(active.esp - 8, callback); write(active.esp - 4, msg);
      e.test_dispatch(msg);
      const innerThunk = assertEntry(active, [7, 0, 123, 0, 0], true);
      assert.equal(e.test_mm_callback_depth(), 2);
      returnTo(innerThunk, active, owner);
      assert.equal(e.test_mm_callback_depth(), 1);
      assert.equal(e.is_mm_timer_callback_active(), 1);
      assert.equal(e.get_yield_reason(), 0, 'inner completion does not restore outer wait');
      assert.equal(e.test_wave_callback_saved(), route === 'nested-wave' ? 1 : 0);
      if (route === 'nested-wave') assert.equal(e.test_audio_yield_flag(), 1);
      assert.deepEqual(words(active.esp, 16), frame, 'outer save frame survives nested callback');
    }
    returnTo(thunk, original, root, route === 'nested-wave');
    assert.equal(e.test_mm_callback_depth(), 0);
    assert.equal(e.is_mm_timer_callback_active(), 0);
    assert.deepEqual(words(original.esp, 2), liveStack, 'interrupted call frame intact');
    if (route === 'nested-wave') {
      assert.equal(e.get_yield_reason(), 1);
      assert.equal(e.get_yield_flag(), 0, 'run consumed the restored flag (yield halt 3)');
      assert.deepEqual(fields.slice(4).map(n => e['test_' + n]()), [42, 0, 1, -1, 12]);
      assert.equal(e.test_wave_callback_saved(), 0);
      e.clear_yield();
    }
    if (route === 'timer-wait') {
      assert.equal(e.get_yield_reason(), 1, 'timer resumes interrupted object wait');
      assert.equal(e.get_yield_flag(), 0, 'timer admission cleared the transient yield flag');
      e.clear_yield();
    }
    e.callback_feed_close(); e.run(1000);
    assert.equal(e.get_eip(), 0, 'interrupted callee completes its real POP/RET');
    assert.equal(e.get_esp(), stack + 4);
    assert.equal(e.get_ebp() >>> 0, 0x44440003);
    console.log('PASS real CPU callback context:', route);
  }
  // No due timer cancels the provisional invocation without touching CPU/stack.
  prepare(); e.test_timer(callback, 1); assert.equal(e.fire_mm_timer(), 1);
  const before = cpu(); // Finish the due one-shot first.
  const thunk = read(before.esp); drain([1, 2]);
  stopAt(thunk); drain([3]); stopAt(body); drain([4]);
  const idle = cpu(), parent = e.test_context(), frame = words(idle.esp, 2);
  assert.equal(e.fire_mm_timer(), 0); drain([1, 5]);
  assert.deepEqual(cpu(), idle); assert.equal(e.test_context(), parent);
  assert.deepEqual(words(idle.esp, 2), frame); assert.equal(e.test_mm_callback_depth(), 0);
  assert.deepEqual(exits, []);
  console.log('PASS multimedia context: native entry/RET/restoration, lazy carry, nested DispatchMessage, interrupted stack, audio wait and no-due cancellation');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
