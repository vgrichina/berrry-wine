#!/usr/bin/env node
'use strict';

// Real import loading and dispatch, using authored PE images only. No fixture
// entry point runs. Load several imports before invoking them so a shared
// "last DLL" buffer cannot accidentally pass the diagnostic assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHostImports } = require('../lib/host-imports');
const { makeFixture } = require('../tools/kernel32-native-fixture');

const moduleObject = new WebAssembly.Module(fs.readFileSync(
  process.env.ORDINAL_TEST_WASM || path.join(__dirname, '../build/wine-assembly.wasm')));
const cases = [
  ['SHLWAPI.dll', 83], ['OLEAUT32.dll', 83],
  ['another-long-module.dll', 65535], ['KERNEL32.dll', 98],
  ['KERNEL32.dll', 99], ['KERNEL32.dll', 'GetCurrentProcess'],
  ['KERNEL32.dll', 'UnsupportedSyntheticName'],
];
const raw = r => r - 0x1000 + 0x200;
function image(dll, imports) {
  const b = makeFixture(), optional = 0x80 + 24;
  b.writeUInt32LE(0, optional + 16); // no fixture entry point
  b.writeUInt32LE(0, optional + 96); // no exports
  b.writeUInt32LE(0, optional + 100);
  if (dll) {
    b.writeUInt16LE(0x210e, 0x80 + 22);
    b.writeUInt32LE(0x600000, optional + 28);
  }
  b.fill(0, raw(0x1800), raw(0x2000));
  imports.forEach(([name, entry], i) => {
    const desc = raw(0x1800 + i * 20), names = 0x1a00 + i * 96;
    b.writeUInt32LE(0x1900 + i * 8, desc);
    b.writeUInt32LE(names, desc + 12);
    b.writeUInt32LE(0x1900 + i * 8, desc + 16);
    b.write(name + '\0', raw(names));
    if (typeof entry === 'number') {
      b.writeUInt32LE((0x80000000 | entry) >>> 0, raw(0x1900 + i * 8));
    } else {
      b.writeUInt32LE(names + 40, raw(0x1900 + i * 8));
      b.write(entry + '\0', raw(names + 42));
    }
  });
  b.writeUInt32LE((imports.length + 1) * 20, optional + 108);
  return b;
}

for (const dll of [false, true]) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {},
    apiTable: require('../src/api_table.json') };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  // These thread/RPC facilities are unused by the synthetic single-thread calls.
  for (const name of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event',
    'set_event', 'reset_event', 'wait_single', 'wait_multiple', 'com_create_instance'])
    imports.host[name] = () => 0;
  const read = p => {
    const bytes = new Uint8Array(memory.buffer); let end = p;
    while (bytes[end]) end++;
    return Buffer.from(bytes.subarray(p, end)).toString('ascii');
  };
  let crash = null;
  const logs = [];
  imports.host.crash_unimplemented = p => { crash = read(p); };
  imports.host.log = (p, n) => { logs.push(Buffer.from(new Uint8Array(memory.buffer, p, n)).toString('ascii')); };
  const e = new WebAssembly.Instance(moduleObject, imports).exports;
  ctx.exports = e;
  const stage = b => new Uint8Array(memory.buffer).set(b, e.get_staging());
  const exe = image(false, dll ? [] : cases);
  stage(exe); assert(e.load_pe(exe.length));
  if (dll) { const b = image(true, cases); stage(b); e.load_dll(b.length, 0x600000); }
  const base = dll ? 0x600000 : 0x400000;
  const thunks = cases.map((_, i) => e.guest_read32(base + 0x1900 + i * 8) >>> 0);
  // A diagnostic must own its name rather than depend on the image's string.
  cases.forEach((_, i) => e.guest_write8(base + 0x1a00 + i * 96, 88));
  for (let i = 0; i < 4; i++) {
    const [name, ordinal] = cases[i], thunk = thunks[i];
    assert.equal(e.guest_read32(thunk) >>> 0, 0x4f524400);
    const record = e.guest_read32(thunk + 4) >>> 0;
    assert.equal(e.guest_read32(record), ordinal, 'record retains numeric ordinal');
    const expected = `${name}.#${String(ordinal).padStart(5, '0')}`;
    assert.equal(read(e.guest_to_wasm(record + 4) >>> 0), expected);
    const sp = 0x074ff000;
    e.set_esp(sp); e.guest_write32(sp, 0); e.set_eip(thunk); crash = null;
    assert.throws(() => e.run(1), WebAssembly.RuntimeError, 'real fail-fast trap');
    assert.equal(crash, expected, 'host receives originating DLL and actual ordinal');
    assert(logs.includes(expected), 'normal diagnostic log receives the same name');
  }
  assert.equal(e.guest_read32(thunks[4]) >>> 0, 0x80000063);
  assert.equal(e.guest_read32(thunks[4] + 4), 2600, 'resolved KERNEL32 ordinal binding unchanged');
  const sp = 0x074ff000, output = e.guest_alloc(16) >>> 0;
  e.set_esp(sp); e.guest_write32(sp, 0); e.guest_write32(sp + 4, output); e.set_eip(thunks[4]);
  crash = null; e.run(1); assert.equal(crash, null);
  assert.equal(e.get_eax(), 1, 'resolved ordinal99 handler executes');
  assert.equal(e.get_esp() >>> 0, sp + 8, 'resolved ordinal stdcall cleanup');
  e.set_esp(sp); e.guest_write32(sp, 0); e.set_eip(thunks[5]); e.run(1);
  assert.equal(e.get_eax() >>> 0, 0xffffffff, 'named GetCurrentProcess result unchanged');
  assert.equal(e.get_esp() >>> 0, sp + 4, 'existing named handler executes');
  assert.equal(crash, null);
  e.set_esp(sp); e.guest_write32(sp, 0); e.set_eip(thunks[6]);
  assert.throws(() => e.run(1), WebAssembly.RuntimeError);
  assert.equal(crash, 'UnsupportedSyntheticName', 'named fail-fast diagnostic unchanged');
  console.log(`PASS ${dll ? 'DLL' : 'EXE'}: distinct unresolved DLLs/ordinals, copied names, traps, resolved ordinal and named dispatch`);
}
