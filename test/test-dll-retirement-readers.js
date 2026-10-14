'use strict';

// The PTE case uses the canonical artifact unchanged. Reader cases add only a
// host pause at an existing function entry, so a second real instance can run
// FreeLibrary at that precise interleaving. No lifecycle result is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const loader = require('../lib/dll-loader');
const boot = require('../lib/process-boot');
const { compileSrcWasm } = require('./compile-src');
const { X86, pe, u32, API, BASE, DATA } = require('./test-dll-lifecycle-real-pe');
for (const name of ['VirtualProtect', 'LoadAcceleratorsA', 'LoadAcceleratorsW', 'LoadStringA', 'CopyAcceleratorTableA', 'DestroyAcceleratorTable']) if (!API.includes(name)) API.push(name);
const scenario = process.env.WA_DLL_READER_CASE || 'pte';
const PAUSE = 0x44524c50;
const aviExports = `
  (func (export "reader_avi_open") (param i32 i32) (result i32) (call $avi_open_memory (local.get 0) (local.get 1)))
  (func (export "reader_avi_read") (param i32 i32 i32) (result i32)
    (call $avi_read (i32.load offset=4 (local.get 0)) (i32.const 0) (local.get 1) (local.get 2)))
  (func (export "reader_avi_close") (param i32) (result i32) (call $avi_file_release (local.get 0)))
  (func (export "reader_frees") (result i32) (global.get $heap_stat_frees))
`;
const ret = [0xb8, 1, 0, 0, 0, 0xc2, 12, 0];
const routines = [
  [0x2000, new X86().push(BASE + 0x1500).api('LoadLibraryA').emit(0xc3).finish()],
  [0x2100, new X86().emit(0x50).api('FreeLibrary').emit(0xc3).finish()],
  [0x2200, new X86().push(28).push(DATA + 0x200).emit(0x50).api('VirtualQuery').emit(0xc3).finish()],
  [0x2300, new X86().push(DATA + 0x240).push(2).push(4096).emit(0x50).api('VirtualProtect').emit(0xc3).finish()],
  [0x2400, new X86().push(BASE + 0x1520).emit(0x50).api('GetProcAddress').emit(0xc3).finish()],
  [0x2500, new X86().push(1).emit(0x50).api('LoadAcceleratorsA').emit(0xc3).finish()],
  [0x2600, new X86().push(1).push(DATA + 0x260).emit(0x50).api('CopyAcceleratorTableA').emit(0xc3).finish()],
  [0x2700, new X86().emit(0x50).api('DestroyAcceleratorTable').emit(0xc3).finish()],
  [0x2800, new X86().push(32).push(DATA + 0x280).push(1).emit(0x50).api('LoadStringA').emit(0xc3).finish()],
  [0x2900, new X86().push(1).emit(0x50).api('LoadAcceleratorsW').emit(0xc3).finish()],
];
const exe = pe([...routines, [0x1500, 'reader.dll\0'], [0x1520, 'Sleep\0']]);
function image(command = 0x1234) {
  const dll = pe([[0x1000, new X86().emit(0x8b, 0x44, 0x24, 8, 0xff, 0x04, 0x85, u32(DATA), ...ret).finish()]], true);
  const o = 0x98, raw = r => r - 0x1000 + 0x200;
  dll.writeUInt32LE(0x1d00, o + 112); dll.writeUInt32LE(0x100, o + 116);
  for (const [r, id, target] of [[0x1d00, 9, 0x80000020], [0x1d20, 1, 0x80000040], [0x1d40, 1033, 0x60]]) {
    dll.writeUInt16LE(1, raw(r + 14)); dll.writeUInt32LE(id, raw(r + 16)); dll.writeUInt32LE(target, raw(r + 20));
  }
  dll.writeUInt32LE(0x1d80, raw(0x1d60)); dll.writeUInt32LE(8, raw(0x1d64));
  dll.writeUInt16LE(0x81, raw(0x1d80)); dll.writeUInt16LE(0x41, raw(0x1d82)); dll.writeUInt16LE(command, raw(0x1d84));
  return dll;
}
function pauseAtFunction(source, name) {
  const at = source.indexOf('(func $' + name + ' '); assert(at >= 0, name);
  const body = source.indexOf('\n    (if ', at); assert(body > at, name + ' body');
  return source.slice(0, body) + '\n    (call $host_log_i32 (i32.const ' + PAUSE + '))' + source.slice(body);
}
async function main() {
  let wasm;
  if (scenario === 'pte') wasm = fs.readFileSync(process.env.WA_TEST_WASM || 'build/wine-assembly.wasm');
  else wasm = compileSrcWasm((name, source) => {
    if (scenario === 'avi' && name === '13-exports.wat') return source + aviExports;
    if (scenario === 'pin' && name === '09a0-handlers-base.wat') return pauseAtFunction(source, 'handle_GetProcAddress_pinned');
    if (scenario.startsWith('resource') && name === '09a5-handlers-window.wat') return pauseAtFunction(source,
      source.includes('(func $accel_table_load_owned ') ? 'accel_table_load_owned' : 'accel_table_load');
    return source;
  });
  const module = await WebAssembly.compile(wasm), memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  let pause = null;
  const make = async () => {
    const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
    const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.has_dll_file = () => 1;
    imports.host.log_i32 = value => { if (value === PAUSE && pause) { const fn = pause; pause = null; fn(); } };
    const instance = await WebAssembly.instantiate(module, imports); ctx.exports = instance.exports; return instance.exports;
  };
  const a = await make(); new Uint8Array(memory.buffer, a.get_staging(), exe.length).set(exe); a.load_pe(exe.length);
  const b = await make(); b.init_thread(1, a.get_image_base(), a.get_code_start(), a.get_code_end(), a.get_thunk_base(), a.get_thunk_end(), a.get_num_thunks(), 0);
  const stacks = new Map([a, b].map(e => [e, e.guest_alloc(0x10000) + 0xfff0]));
  let bytes = image();
  const avi = scenario === 'avi' ? require('./dll-reader-avi-fixture').buildAvi() : null;
  if (avi) { assert(avi.length < 0x1000); avi.copy(bytes, 0x1200); }
  const options = e => ({ exports: e, memoryBuffer: memory.buffer, findDllSync: () => bytes });
  function invoke(e, rva, arg = 0, nested = false) {
    const saved = ['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'esp', 'eip',
      'handler_set_eip', 'steps'].map(n => [n, e['get_' + n]()]);
    const yieldState = [e.get_yield_reason(), e.get_yield_flag()];
    const sp = stacks.get(e) - (nested ? 0x1000 : 0);
    e.guest_write32(sp, 0); e.set_esp(sp); e.set_eip(BASE + rva); e.set_eax(arg); e.clear_yield();
    if (rva === 0x2a00) {
      // Exercise run's thunk-zone path as well as decoded CALL [IAT].
      e.guest_write32(sp - 8, 0); e.guest_write32(sp - 4, arg); e.guest_write32(sp, 1);
      e.set_esp(sp - 8);
      e.set_eip(e.guest_read32(BASE + 0x1900 + API.indexOf('LoadAcceleratorsA') * 4));
    }
    try {
      for (let i = 0; i < 100; i++) {
        e.run(10000);
        if ([3, 5].includes(e.get_yield_reason())) { assert(boot.serviceLoadLibraryYieldSync(options(e))); continue; }
        if (!e.get_eip()) { assert.equal(e.get_esp(), sp + 4); return e.get_eax() >>> 0; }
      }
      assert.fail('API did not return');
    } finally { if (nested) { for (const [n, value] of saved) e['set_' + n](value); e.set_yield_state(...yieldState); } }
  }
  const read = offset => a.guest_read32(DATA + offset) >>> 0;
  const h = invoke(a, 0x2000); assert(h);
  const index = a.get_dll_index(h), life = a.get_dll_lifecycle_table() + index * a.get_dll_lifecycle_stride();
  const field = offset => new DataView(memory.buffer).getUint32(life + offset, true);
  const observations = { scenario, module: crypto.createHash('sha256').update(wasm).digest('hex'), handle: h };
  if (scenario === 'pte') {
    assert.equal(invoke(a, 0x2200, h + 0x1000), 28); const freshProtection = read(0x214); assert.equal(freshProtection, 0x40);
    assert.equal(invoke(a, 0x2300, h + 0x1000), 1); assert.equal(read(0x240), freshProtection);
    assert.equal(invoke(a, 0x2200, h + 0x1000), 28); assert.equal(read(0x214), 2);
    assert.equal(invoke(a, 0x2100, h), 1); invoke(a, 0x2200, h); assert.equal(read(0x210), 0x10000);
    const next = invoke(a, 0x2000); assert.equal(next, h, 'requires actual reservation reuse');
    invoke(a, 0x2200, next + 0x1000); observations.reloadedProtection = read(0x214);
    assert.equal(read(0x214), freshProtection, 'new DLL generation inherited retired VirtualProtect override');
    assert.equal(invoke(a, 0x2300, next + 0x1000), 1); assert.equal(read(0x240), freshProtection);
    assert.equal(invoke(a, 0x2100, next), 1);
  } else if (scenario === 'avi') {
    const record = a.reader_avi_open(h + 0x2000, avi.length); assert(record, 'actual resource AVI must parse');
    const data = new DataView(memory.buffer).getUint32(record + 20, true);
    assert.equal(invoke(a, 0x2100, h), 1); assert.equal(a.get_dll_index(h), -1);
    const dest = a.guest_alloc(avi.length);
    assert.equal(a.reader_avi_read(record, dest, avi.length), avi.length);
    assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer, a.guest_to_wasm(dest), avi.length)), avi,
      'frame source must survive real DLL unmapping');
    assert.notEqual(data, h + 0x2000, 'AVI must not retain module-owned resource pointer');
    const before = a.reader_frees(); assert.equal(a.reader_avi_close(record), 0);
    assert.equal(a.reader_frees() - before, 2, 'close releases guest object and owned AVI bytes exactly once');
    assert.equal(new DataView(memory.buffer).getUint32(record + 20, true), 0);
    assert.equal(a.reader_avi_open(dest, 0), 0, 'empty AVI still fails');
    a.guest_write32(dest, 0); const malformedBefore = a.reader_frees();
    assert.equal(a.reader_avi_open(dest, avi.length), 0, 'malformed AVI still fails');
    assert.equal(a.reader_frees() - malformedBefore, 1, 'failed parser releases byte copy');
    a.guest_free(dest);
  } else {
    pause = () => {
      if (scenario.startsWith('resource')) {
        invoke(a, 0x2800, h, true);
        observations.outerPinsAfterNested = field(12);
      }
      assert.equal(invoke(b, 0x2100, h), 1); assert.equal(field(8), 0);
      observations.pinsDuringRelease = field(12);
      console.log(JSON.stringify(observations));
      if (scenario.startsWith('resource')) assert(observations.outerPinsAfterNested > 0, 'nested resource pop released outer consumer image');
      assert.equal(a.get_dll_index(h), index, 'image retired before bounded reader finished');
      assert.equal(read(0), 0, 'process detach ran inside resource reader');
    };
    const value = invoke(a, scenario === 'pin' ? 0x2400 : scenario === 'resource-wide' ? 0x2900 :
      scenario === 'resource-thunk' ? 0x2a00 : 0x2500, h);
    assert.equal(pause, null, 'real reader entry was not reached');
    if (scenario === 'pin') assert.equal(value, 0, 'fixture DLL has no Sleep export');
    else assert(value);
    assert.equal(a.get_dll_index(h), -1, 'last reader pin disappeared without scheduling retirement');
    assert.equal(read(0), 1, 'final unpin must detach exactly once');
    if (scenario.startsWith('resource')) {
      assert.equal(invoke(a, 0x2600, value), 1); assert.equal(read(0x264) & 0xffff, 0x1234, 'HACCEL must own bytes after DLL retirement');
      bytes = image(0x5678); assert.equal(invoke(a, 0x2000), h);
      const replacement = invoke(a, 0x2500, h); assert.notEqual(replacement, value, 'new generation must not reuse old HACCEL');
      assert.equal(invoke(a, 0x2600, replacement), 1); assert.equal(read(0x264) & 0xffff, 0x5678);
      assert.equal(invoke(a, 0x2600, value), 1); assert.equal(read(0x264) & 0xffff, 0x1234);
      assert.equal(invoke(a, 0x2700, replacement), 1); assert.equal(invoke(a, 0x2700, value), 1);
      assert.equal(invoke(a, 0x2100, h), 1);
    }
  }
  console.log(JSON.stringify(observations)); console.log('PASS DLL retirement reader ' + scenario);
}
if (!process.env.WA_DLL_READER_CASE) {
  const { spawnSync } = require('node:child_process');
  for (const name of ['pte', 'pin', 'resource', 'resource-wide', 'resource-thunk', 'avi']) {
    const result = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, WA_DLL_READER_CASE: name }, stdio: 'inherit', timeout: 60000,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'DLL retirement reader ' + name);
  }
} else main().catch(error => { console.error(error); process.exitCode = 1; });
