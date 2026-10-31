#!/usr/bin/env node
'use strict';
// A normal profile read from an async-only provider must park before publishing
// output, materialize the selected file, and retry with ordinary INI semantics.
const assert = require('assert');
const { VirtualFS } = require('../lib/filesystem');
const { createStorageImports, setIniValue, exportStore } = require('../lib/storage');
const { g2w } = require('../lib/mem-utils');
const IMAGE = 0x400000;
async function scenario(wide) {
  const memory = new ArrayBuffer(0x20000), mem = new Uint8Array(memory);
  const vfs = new VirtualFS();
  const ctx = { vfs, getMemory: () => memory, exports: { get_image_base: () => IMAGE } };
  const host = createStorageImports(ctx);
  const wa = n => g2w(IMAGE + n, IMAGE);
  const put = (n, text) => { mem.set(Buffer.from(text + '\0', wide ? 'utf16le' : 'latin1'), wa(n)); return wa(n); };
  const app = put(0x100, 'mAiN'), key = put(0x200, 'nAmE'), def = put(0x300, 'missing');
  const target = `c:\\profiles\\async-${wide}.lvl`, file = put(0x400, target);
  const source = Buffer.from((wide ? '\ufeff' : '') + '[Main]\r\nName="caf\xe9"\r\nCount="42"\r\n', wide ? 'utf16le' : 'latin1');
  const storedBefore = exportStore();
  let reads = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  vfs.setProviderFile(target, { provider: { size: source.length, tryRead: () => null, fill: () => { throw Error('materialization uses readRange'); }, readRange: async (offset, length) => {
    reads++; await gate; return source.subarray(offset, offset + length);
  } }, length: source.length });
  mem.fill(0xa5, wa(0x1000), wa(0x1100));
  const before = mem.slice(wa(0x1000), wa(0x1100));
  // Baseline deliberately reaches the real old failing consumer, not a missing
  // new function assertion. After repair the same WAT front door prepares it.
  if (!host.ini_prepare_read) host.ini_get_string(app, key, def, IMAGE + 0x1000, 64, file, wide);
  assert.strictEqual(host.ini_prepare_read(file, wide, 1), 1);
  assert.deepStrictEqual(mem.slice(wa(0x1000), wa(0x1100)), before, 'park publishes no output');
  const pending = vfs.getPendingRead(1);
  assert(pending && pending.path === target);
  assert.strictEqual(host.ini_prepare_read(file, wide, 1), 1, 'repeat preflight remains parked');
  assert.strictEqual(vfs.getPendingRead(1), pending);
  const fill = vfs.fillPendingRead(pending);
  await Promise.resolve();
  assert.strictEqual(reads, 1);
  assert.deepStrictEqual(mem.slice(wa(0x1000), wa(0x1100)), before);
  release(); await fill;
  await pending.provider.fill(); // The loading UI and retirement may both fill the same request.
  assert.strictEqual(host.ini_prepare_read(file, wide, 1), 0);
  assert.strictEqual(host.ini_get_string(app, key, def, IMAGE + 0x1000, 64, file, wide), 4);
  assert.strictEqual(Buffer.from(mem.slice(wa(0x1000), wa(0x1000) + 4 * (wide ? 2 : 1))).toString(wide ? 'utf16le' : 'latin1'), 'caf\xe9');
  put(0x200, 'count');
  assert.strictEqual(host.ini_get_int(app, key, -7, file, wide), 42);
  assert.deepStrictEqual(Buffer.from(vfs.files.get(target).data), source, 'original bytes unchanged');
  assert.strictEqual(host.ini_prepare_read(file, wide, 1), 0);
  assert.strictEqual(reads, 1, 'resident retries do not refetch');
  assert.deepStrictEqual(exportStore(), storedBefore, 'reads never cache VFS profiles into localStorage');
}

async function lifecycle() {
  const memory = new ArrayBuffer(0x20000), mem = new Uint8Array(memory), vfs = new VirtualFS();
  const host = createStorageImports({ vfs, getMemory: () => memory, exports: { get_image_base: () => IMAGE } });
  const put = (wa, text) => { mem.set(Buffer.from(text + '\0', 'latin1'), wa); return wa; };
  const file = put(0x100, 'c:\\profiles\\lifetime.ini');
  const bytes = Buffer.from('[Main]\r\nName=real\r\n', 'latin1');
  let reads = 0, rejectRead, resolveRead;
  const provider = { size: bytes.length, tryRead: () => null, fill: () => {}, readRange: () => {
    reads++; return new Promise((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
  } };
  const mount = () => vfs.setProviderFile('c:\\profiles\\lifetime.ini', { provider });
  mount();
  assert.strictEqual(host.ini_prepare_read(file, 0, 2), 1);
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 1);
  const two = vfs.getPendingRead(2), three = vfs.getPendingRead(3);
  assert.notStrictEqual(two, three, 'wait slots belong to their guest threads');
  const fills = [vfs.fillPendingRead(two), vfs.fillPendingRead(three)];
  assert.strictEqual(reads, 1, 'two threads share one materialization');
  vfs.releaseIoState(2);
  resolveRead(bytes); await Promise.all(fills);
  assert.strictEqual(vfs._threadIo.has(2), false, 'completion does not resurrect a retired thread');
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 0);
  mount();
  mem.fill(0xa5, 0x1000, 0x1100);
  const before = mem.slice(0x1000, 0x1100);
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 1);
  const failedFill = vfs.fillPendingRead(vfs.getPendingRead(3));
  const failure = new Error('range fetch refused');
  rejectRead(failure); await failedFill;
  assert.throws(() => host.ini_prepare_read(file, 0, 3), error => error === failure,
    'provider error propagates, never default/empty profile');
  assert.deepStrictEqual(mem.slice(0x1000, 0x1100), before);
  // A fresh valid operation can retry after the failure, without stale faults.
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 1);
  const retry = vfs.fillPendingRead(vfs.getPendingRead(3));
  resolveRead(bytes); await retry;
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 0);
  mount();
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 1);
  const replaced = vfs.fillPendingRead(vfs.getPendingRead(3));
  const replacement = Buffer.from('[Main]\r\nName=newer\r\n');
  const entry = vfs.files.get('c:\\profiles\\lifetime.ini');
  entry.data = replacement;
  resolveRead(bytes); await replaced;
  assert.deepStrictEqual(Buffer.from(entry.data), replacement, 'in-flight materialization preserves newer writes');
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 0);
  mount();
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 1);
  const renamed = vfs.fillPendingRead(vfs.getPendingRead(3));
  vfs.files.set('c:\\profiles\\lifetime.ini', { data: replacement, attrs: 0x20 });
  rejectRead(failure); await renamed;
  assert.strictEqual(host.ini_prepare_read(file, 0, 3), 0, 'replacement retires stale entry failure');
  const missing = put(0x100, 'c:\\profiles\\absent.ini');
  assert.strictEqual(host.ini_prepare_read(missing, 0, 3), 0, 'missing files retain normal default semantics');
  // The operation status is distinct from all valid i32 profile values.
  const actualFile = put(0x100, 'c:\\profiles\\atomic.ini');
  const app = put(0x200, 'Main'), key = put(0x300, 'Number');
  const numberBytes = Buffer.from('[Main]\r\nNumber=-2147483648\r\nName=real\r\n');
  let finishAtomic;
  vfs.setProviderFile('c:\\profiles\\atomic.ini', { provider: { size: numberBytes.length,
    tryRead: () => null, fill: () => {}, readRange: () => new Promise(resolve => { finishAtomic = resolve; }) } });
  new DataView(memory).setInt32(0x800, 0x12345678, true);
  assert.strictEqual(host.ini_read_result(1, app, key, 997, 0, 0, actualFile, 0, 0x800, 4), 997);
  assert.strictEqual(new DataView(memory).getInt32(0x800, true), 0x12345678, 'pending preserves result cell');
  const atomicFill = vfs.fillPendingRead(vfs.getPendingRead(4));
  finishAtomic(numberBytes); await atomicFill;
  assert.strictEqual(host.ini_read_result(1, app, key, 997, 0, 0, actualFile, 0, 0x800, 4), 0);
  assert.strictEqual(new DataView(memory).getInt32(0x800, true), -2147483648);
  put(0x300, 'missing');
  for (const defaultValue of [-1, 997, -2147483648, 2147483647]) {
    assert.strictEqual(host.ini_read_result(1, app, key, defaultValue, 0, 0, actualFile, 0, 0x800, 4), 0);
    assert.strictEqual(new DataView(memory).getInt32(0x800, true), defaultValue);
  }
  put(0x300, 'name');
  assert.strictEqual(host.ini_read_result(0, app, key, 0, IMAGE + 0x1000, 3, actualFile, 0, 0x800, 4), 0);
  assert.strictEqual(new DataView(memory).getInt32(0x800, true), 2, 'existing string truncation');
  assert.deepStrictEqual([...mem.slice(0x13000, 0x13003)], [114, 101, 0]);
  assert.strictEqual(host.ini_read_result(2, app, 0, 0, IMAGE + 0x1000, 128, actualFile, 0, 0x800, 4), 0);
  assert(Buffer.from(mem.slice(0x13000, 0x13060)).includes(Buffer.from('Number=-2147483648\0Name=real\0\0')));
  // Existing persisted overrides keep precedence and need no provider fetch.
  const overrideFile = put(0x100, 'c:\\profiles\\override.ini');
  let overrideReads = 0;
  vfs.setProviderFile('c:\\profiles\\override.ini', { provider: { size: bytes.length,
    tryRead: () => null, fill: () => {}, readRange: async () => { overrideReads++; return bytes; } } });
  setIniValue('override.ini', 'Main', 'Name', 'persisted');
  assert.strictEqual(host.ini_read_result(0, app, key, 0, IMAGE + 0x1000, 128, overrideFile, 0, 0x800, 5), 0);
  assert.strictEqual(new DataView(memory).getInt32(0x800, true), 9);
  assert.strictEqual(overrideReads, 0, 'persisted override never forces unrelated VFS bytes resident');
  const fallbackFile = put(0x100, 'fallback-profile.ini');
  vfs.setProviderFile('c:\\elsewhere\\fallback-profile.ini', { provider: { size: bytes.length,
    tryRead: () => null, fill: () => {}, readRange: async () => bytes } });
  assert.strictEqual(host.ini_read_result(0, app, key, 0, IMAGE + 0x1000, 128, fallbackFile, 0, 0x800, 5), 997);
  assert.strictEqual(vfs.getPendingRead(5).path, 'c:\\elsewhere\\fallback-profile.ini');
  await vfs.fillPendingRead(vfs.getPendingRead(5));
  assert.strictEqual(host.ini_read_result(0, app, key, 0, IMAGE + 0x1000, 128, fallbackFile, 0, 0x800, 5), 0);
  assert.strictEqual(new DataView(memory).getInt32(0x800, true), 4, 'basename fallback retains existing lookup order');
  console.log('PASS per-thread waits, shared fill, retirement, fetch failure, retry, write/namespace replacement');
}

async function compiled() {
  const fs = require('fs'), path = require('path');
  const { compileSrcWasm } = require('./compile-src');
  const { createHostImports } = require('../lib/host-imports');
  const extra = String.raw`
  (func (export "test_async_profile") (param $wide i32) (param $esp i32)
      (param $app i32) (param $key i32) (param $def i32) (param $buf i32) (param $size i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.store (global.get $reg_base) (i32.const 0x12345678))
    (global.set $current_thunk_eip (i32.add (global.get $thunk_guest_base) (i32.const 8)))
    (global.set $handler_set_eip (i32.const 0))
    (if (local.get $wide)
      (then (call $handle_GetPrivateProfileStringW (local.get $app) (local.get $key)
        (local.get $def) (local.get $buf) (local.get $size) (i32.const 0)))
      (else (call $handle_GetPrivateProfileStringA (local.get $app) (local.get $key)
        (local.get $def) (local.get $buf) (local.get $size) (i32.const 0)))))
  (func (export "test_async_struct") (param $esp i32) (param $app i32)
      (param $key i32) (param $buf i32) (param $size i32) (param $file i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.store (global.get $reg_base) (i32.const 0x12345678))
    (global.set $current_thunk_eip (i32.add (global.get $thunk_guest_base) (i32.const 8)))
    (global.set $handler_set_eip (i32.const 0))
    (call $handle_GetPrivateProfileStructA (local.get $app) (local.get $key)
      (local.get $buf) (local.get $size) (local.get $file) (i32.const 0)))
  (func (export "test_async_thunk") (result i32)
    (i32.add (global.get $thunk_guest_base) (i32.const 8)))
  `;
  const wasm = compileSrcWasm((name, src) => name === '13-exports.wat' ? src + extra : src);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, exports: null };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = ctx.exports = instance.exports;
  const exe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging()); e.load_pe(exe.length);
  const base = e.get_image_base() + 0x100000;
  const app = base, key = base + 0x100, def = base + 0x200, file = base + 0x300;
  const buf = base + 0x1000, esp = base + 0x3000;
  const put = (address, text, wide) => Buffer.from(text + '\0', wide ? 'utf16le' : 'latin1').forEach((b, i) => e.guest_write8(address + i, b));
  for (const wide of [0, 1]) {
    const target = `c:\\profiles\\compiled-${wide}.lvl`;
    const source = Buffer.from((wide ? '\ufeff' : '') + '[Main]\r\nName="original"\r\n', wide ? 'utf16le' : 'latin1');
    let count = 0;
    ctx.vfs.setProviderFile(target, { provider: { size: source.length,
      tryRead: () => null, fill: () => {}, readRange: async (off, len) => { count++; return source.subarray(off, off + len); } } });
    put(app, 'MAIN', wide); put(key, 'name', wide); put(def, 'wrong-default', wide); put(file, target, wide);
    e.guest_write32(esp + 24, file); e.guest_write32(esp + 28, 0xbadf00d);
    for (let i = 0; i < 128; i++) e.guest_write8(buf + i, 0xa5);
    e.test_async_profile(wide, esp, app, key, def, buf, 64);
    assert.strictEqual(e.get_yield_reason(), 12, 'async profile read parks through IO_WAIT');
    assert.strictEqual(e.get_eip(), e.test_async_thunk(), 'retry targets the original import thunk');
    assert.strictEqual(e.get_esp(), esp, 'pending leaves the complete stdcall frame');
    assert.strictEqual(e.get_eax(), 0x12345678, 'pending publishes no result');
    for (let i = 0; i < 128; i++) assert.strictEqual(e.guest_read8(buf + i), 0xa5, 'pending output atomicity');
    await ctx.vfs.fillPendingRead(ctx.vfs.getPendingRead(1)); e.clear_yield();
    e.test_async_profile(wide, esp, app, key, def, buf, 64);
    assert.strictEqual(e.get_yield_reason(), 0);
    assert.strictEqual(e.get_eax(), 8);
    assert.strictEqual(e.get_esp(), esp + 28, 'completed call pops exactly once');
    assert.strictEqual(e.guest_read32(esp + 28), 0xbadf00d, 'caller stack guard');
    const actual = Buffer.from(Array.from({length: 8 * (wide ? 2 : 1)}, (_, i) => e.guest_read8(buf + i))).toString(wide ? 'utf16le' : 'latin1');
    assert.strictEqual(actual, 'original');
    assert.strictEqual(e.guest_read8(buf + 8 * (wide ? 2 : 1)), 0);
    assert.strictEqual(count, 1);
    assert.deepStrictEqual(Buffer.from(ctx.vfs.files.get(target).data), source);
  }
  // A formerly resident namespace may be replaced before the struct RPC.
  // The same public handler must park without leaking an allocation or writing
  // decoded bytes, then retain the native checksum behavior on completion.
  for (const checksum of ['06', '00']) {
    const target = 'c:\\profiles\\compiled-struct.ini';
    ctx.vfs.files.set(target, { data: Buffer.from('[Main]\r\nName=01020306\r\n'), attrs: 0x20 });
    put(app, 'Main', 0); put(key, 'Name', 0); put(file, target, 0);
    assert.strictEqual(imports.host.ini_prepare_read(g2w(file, e.get_image_base()), 0, 1), 0);
    const source = Buffer.from('[Main]\r\nName=010203' + checksum + '\r\n');
    let count = 0;
    ctx.vfs.setProviderFile(target, { provider: { size: source.length,
      tryRead: () => null, fill: () => {}, readRange: async (off, len) => { count++; return source.subarray(off, off + len); } } });
    e.guest_write32(esp + 24, 0xbadf00d);
    for (let i = 0; i < 16; i++) e.guest_write8(buf + i, 0xa5);
    e.test_async_struct(esp, app, key, buf, 3, file);
    assert.strictEqual(e.get_yield_reason(), 12);
    assert.strictEqual(e.get_eip(), e.test_async_thunk());
    assert.strictEqual(e.get_esp(), esp);
    assert.strictEqual(e.get_eax(), 0x12345678);
    for (let i = 0; i < 16; i++) assert.strictEqual(e.guest_read8(buf + i), 0xa5);
    await ctx.vfs.fillPendingRead(ctx.vfs.getPendingRead(1)); e.clear_yield();
    e.test_async_struct(esp, app, key, buf, 3, file);
    assert.strictEqual(e.get_yield_reason(), 0);
    assert.strictEqual(e.get_eax(), checksum === '06' ? 1 : 0);
    assert.strictEqual(e.get_esp(), esp + 24);
    assert.strictEqual(e.guest_read32(esp + 24), 0xbadf00d);
    assert.deepStrictEqual([0,1,2,3].map(i => e.guest_read8(buf + i)), [1,2,3,0xa5]);
    assert.strictEqual(count, 1);
    assert.deepStrictEqual(Buffer.from(ctx.vfs.files.get(target).data), source);
  }
  console.log('PASS compiled StructA namespace replacement: thunk retry, EAX/ESP/output atomicity, checksum failure publishes decoded bytes');
  console.log('PASS compiled GetPrivateProfileString A/W: real async VFS, thunk retry, EAX/ESP/output atomicity, one completion, source bytes');
}

(async () => { await scenario(0); await scenario(1); await lifecycle(); if (!process.argv.includes('--unit-only')) await compiled(); console.log('PASS async-backed profile reads A/W: park, atomic output, original bytes, case/quote/int semantics, one fill'); })().catch(e => { console.error(e.stack); process.exitCode = 1; });
