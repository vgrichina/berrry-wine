#!/usr/bin/env node
'use strict';
// Actual PE imports, synthetic KERNEL32 EAT and x86 stdcall frames. Run both
// dispatch modes; this compiles and therefore needs the native validation lane.
const assert = require('node:assert/strict');
const {bootRenderHarness} = require('./render-helper');
const {ThreadManager} = require('../lib/thread-manager');
const {makeFixture, BASE, API, iat} = require('../tools/kernel32-native-fixture');
const tailCalls = !process.argv.includes('--no-tail-calls');
(async () => {
  let manager, unavailable = false, snapshotStorage;
  const h = await bootRenderHarness({fonts: 'none', tailCalls, extraWat: `
    (func (export "test_snapshot_serial") (param $serial i32)
      (i32.atomic.store (region.addr $TOOLHELP_HEAPS 16) (local.get $serial)))
    (func (export "test_snapshot_node") (param $handle i32) (result i32)
      (local $link i32) (local $node i32)
      (call $toolhelp_lock)
      (local.set $link (call $toolhelp_snapshot_link (local.get $handle)))
      (if (local.get $link) (then (local.set $node (i32.load (local.get $link)))))
      (call $toolhelp_unlock) (local.get $node))`, extraHostOverrides: {
    snapshot_threads: (...args) => {
      snapshotStorage = args[0];
      return unavailable ? -120 : manager.snapshotThreads(...args);
    },
    create_thread: (...args) => manager.createThread(...args),
    get_thread_priority: (...args) => manager.getThreadPriority(...args),
    set_thread_priority: (...args) => manager.setThreadPriority(...args),
    resume_thread: handle => manager.resumeThread(handle),
    exit_thread: code => manager.exitThread(code),
    terminate_thread: (...args) => manager.terminateThread(...args),
  }}), e = h.exports;
  manager = new ThreadManager(h.module, h.memory, h.instance,
    () => ({host: h.host, gdi: h.gdi}));
  manager._log = () => {};
  const pe = makeFixture(), raw = rva => rva - 0x1000 + 0x200;
  const importedSlot = BASE + 0x1900 + API.length * 4;
  pe.writeUInt32LE(0x1c00, raw(importedSlot - BASE));
  pe.write('CreateToolhelp32Snapshot\0', raw(0x1c02));
  new Uint8Array(h.memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const stack = e.get_esp(), read = p => e.guest_read32(p) >>> 0;
  const code = bytes => {
    const p = e.guest_alloc(bytes.length); bytes.forEach((b, i) => e.guest_write8(p + i, b)); return p;
  };
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return [...b]; };
  const invocation = (pointer, args, suffix = [0xc3]) => code([
    ...args.slice().reverse().flatMap(n => [0x68, ...u32(n)]),
    0xb8, ...u32(pointer), 0xff, 0xd0, ...suffix,
  ]);
  const run = pointer => {
    e.set_esp(stack); e.clear_yield(); e.call_func(pointer, 0, 0, 0, 0);
    const before = e.get_esp(); e.run(10000);
    assert.equal(e.get_eip(), 0, 'guest returned');
    assert.equal(e.get_esp(), before + 4, 'actual x86 API stdcall balanced the guest stack');
    return e.get_eax() >>> 0;
  };
  const call = (pointer, args = []) => run(invocation(pointer, args));
  const api = (name, args = []) => call(read(iat(name)), args);
  const string = text => code([...Buffer.from(text + '\0')]);
  const module = api('LoadLibraryA', [string('KERNEL32.DLL')]); assert(module);
  const resolve = name => { const p = api('GetProcAddress', [module, string(name)]); assert(p, name); return p; };
  const funcs = Object.fromEntries(['CreateToolhelp32Snapshot', 'Thread32First', 'Thread32Next',
    'CloseHandle', 'CreateThread', 'SetThreadPriority', 'ResumeThread', 'TerminateThread', 'GetCurrentProcessId',
    'CreateFileA', 'WriteFile']
    .map(name => [name, resolve(name)]));
  for (const name of ['CreateToolhelp32Snapshot', 'Thread32First', 'Thread32Next']) {
    const entry = require('../src/kernel32-exports.json').exports.find(x => x.name === name);
    assert.equal(api('GetProcAddress', [module, entry.ordinal]), funcs[name]);
    assert.equal(e.guest_read8(funcs[name]), 0xe9, 'real EAT JMP');
  }
  const f = (name, args) => call(funcs[name], args);
  const pid = f('GetCurrentProcessId', []), entry = e.guest_alloc(36), other = e.guest_alloc(36);
  const init = p => { for (let i = 0; i < 36; i += 4) e.guest_write32(p + i, 0xa5a5a5a5); e.guest_write32(p, 36); };
  const fields = p => Array.from({length: 7}, (_, i) => read(p + 4 * i));
  const check = (name, args, result, error) => {
    api('SetLastError', [1234]); assert.equal(f(name, args), result);
    assert.equal(api('GetLastError'), error); assert.equal(read(entry + 28), 0xa5a5a5a5);
  };
  init(entry); init(other);
  const first = call(read(importedSlot), [4, 0xdeadbeef]); assert(first && first !== 0xffffffff);
  check('Thread32First', [first, entry], 1, 1234);
  assert.deepEqual(fields(entry), [28, 0, 1, pid, 8, 0, 0]);
  check('Thread32Next', [first, other], 0, 18);
  const tidOut = e.guest_alloc(4);
  // The spawned guest consumes this snapshot's shared cursor, then exits by
  // returning through the production thread-return sentinel.
  const childEntry = e.guest_alloc(36); init(childEntry);
  const snapshotSlot = e.guest_alloc(4);
  const child = code([0x68, ...u32(childEntry), 0xff, 0x35, ...u32(snapshotSlot),
    0xb8, ...u32(funcs.Thread32Next), 0xff, 0xd0, 0xc2, 4, 0]);
  const thread = f('CreateThread', [0, 65536, child, 0, 4, tidOut]); assert(thread);
  const tid = read(tidOut); assert.notEqual(tid, 1);
  assert.equal(f('SetThreadPriority', [thread, 2]), 1);
  const snap = f('CreateToolhelp32Snapshot', [5, 0]); assert(snap && snap !== 0xffffffff);
  e.guest_write32(snapshotSlot, snap);
  check('Thread32First', [snap, entry], 1, 1234);
  // Old immutable snapshot does not acquire newly-created threads.
  check('Thread32Next', [first, entry], 0, 18);
  manager.spawnPending();
  assert.equal(f('ResumeThread', [thread]), 1);
  for (let i = 0; i < 10 && manager.threads.get(thread).state !== 'exited'; i++) manager.runSlice(10000);
  assert.equal(manager.threads.get(thread).state, 'exited', 'real spawned guest returned');
  assert.deepEqual(fields(childEntry), [28, 0, tid, pid, 10, 0, 0]);
  check('Thread32Next', [snap, entry], 0, 18);
  check('Thread32First', [snap, entry], 1, 1234);
  // Caller buffer contents cannot retarget a handle's cursor.
  e.guest_write32(other + 8, 0xffffffff);
  check('Thread32Next', [snap, other], 1, 1234);
  assert.equal(read(other + 8), tid, 'exited thread remains in prior snapshot');
  const fresh = f('CreateToolhelp32Snapshot', [4, 0]);
  check('Thread32First', [fresh, entry], 1, 1234);
  check('Thread32Next', [fresh, entry], 0, 18);
  const reused = f('CreateThread', [0, 65536, child, 0, 4, tidOut]); assert(reused);
  assert.equal(read(tidOut), tid, 'production allocator reuses exited cache slot');
  assert.equal(f('SetThreadPriority', [reused, -2]), 1);
  const reusedSnap = f('CreateToolhelp32Snapshot', [4, 0]);
  check('Thread32First', [reusedSnap, entry], 1, 1234);
  check('Thread32Next', [reusedSnap, entry], 1, 1234);
  assert.equal(read(entry + 16), 6);
  check('Thread32First', [snap, entry], 1, 1234);
  check('Thread32Next', [snap, entry], 1, 1234);
  assert.equal(read(entry + 16), 10, 'old immutable record survives slot reuse');
  assert.equal(f('TerminateThread', [reused, 42]), 1);
  const heaps = f('CreateToolhelp32Snapshot', [1, 0]);
  check('Thread32First', [heaps, entry], 0, 18);
  e.guest_write32(entry, 27); check('Thread32First', [snap, entry], 0, 24);
  e.guest_write32(entry, 28); check('Thread32First', [snap, 0], 0, 87);
  check('Thread32First', [0xdeadbeef, entry], 0, 6);
  unavailable = true;
  check('CreateToolhelp32Snapshot', [4, 0], 0xffffffff, 120);
  unavailable = false;
  check('CreateToolhelp32Snapshot', [5, 0xdeadbeef], 0xffffffff, 87);
  check('CreateToolhelp32Snapshot', [0x40, 0], 0xffffffff, 87);
  const fixedCapture = invocation(funcs.CreateToolhelp32Snapshot, [4, 0]);
  const recycledA = run(fixedCapture), storageA = snapshotStorage;
  const rawNode = e.test_snapshot_node(recycledA) >>> 0; assert(rawNode);
  assert.equal(recycledA >>> 24, 0xf8, 'dedicated snapshot handle family');
  assert.equal(f('CloseHandle', [recycledA]), 1);
  const recycledB = run(fixedCapture);
  assert.equal(snapshotStorage, storageA, 'private heap node actually reused');
  assert.notEqual(recycledB, recycledA, 'reused storage receives a new identity');
  assert.equal(e.test_snapshot_node(recycledB) >>> 0, rawNode);
  check('Thread32First', [rawNode, entry], 0, 6, 'private allocation is not a handle');
  check('CloseHandle', [recycledA], 0, 6);
  check('CloseHandle', [0xf8000000], 0, 6);
  check('CloseHandle', [0xf8ffffff], 0, 6);
  check('Thread32First', [recycledB, entry], 1, 1234);
  assert.equal(f('CloseHandle', [recycledB]), 1);
  // A real neighboring file handle remains usable after forged/stale closes.
  const file = f('CreateFileA', [string('C:\\toolhelp-neighbor.tmp'), 0x40000000, 0, 0, 2, 0x80, 0]);
  assert(file && file !== 0xffffffff); assert.notEqual(file >>> 24, 0xf8);
  const payload = string('snapshot neighbor'), written = e.guest_alloc(4);
  check('CloseHandle', [recycledA], 0, 6);
  assert.equal(f('WriteFile', [file, payload, 17, written, 0]), 1);
  assert.equal(read(written), 17); assert.equal(f('CloseHandle', [file]), 1);
  // Exhaustion never wraps into an old issued handle or leaks an allocation.
  e.test_snapshot_serial(0xfffffe);
  const last = f('CreateToolhelp32Snapshot', [4, 0]); assert.equal(last, 0xf8ffffff);
  check('CreateToolhelp32Snapshot', [4, 0], 0xffffffff, 4);
  check('Thread32First', [last, entry], 1, 1234);
  assert.equal(f('CloseHandle', [last]), 1);
  check('CloseHandle', [last], 0, 6);
  for (const handle of [first, snap, fresh, heaps, reusedSnap]) {
    assert.equal(f('CloseHandle', [handle]), 1);
    check('Thread32First', [handle, entry], 0, 6);
    check('CloseHandle', [handle], 0, 6);
  }
  h.hostCtx.stopAudio();
  console.log('Toolhelp real PE snapshot/guest spawned thread/shared cursor/lifetime/errors PASS; tailCalls=' + tailCalls);
})().catch(error => { console.error(error); process.exitCode = 1; });
