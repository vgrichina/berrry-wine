#!/usr/bin/env node
'use strict';

// Full-module integration, intentionally separate from the tiny unit fixture.
// Requires an explicitly selected prebuilt wasm and a PE fixture. Never builds
// or runs the fixture's application entry point.
// node test/test-oem-key-scan-candidate.js --wasm=... --fixture=... [--expect-missing]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const apiTable = require('../src/api_table.json');
const option = name => process.argv.find(arg => arg.startsWith('--' + name + '='))?.split('=').slice(1).join('=');

async function main() {
  const wasmPath = option('wasm'), fixturePath = option('fixture');
  assert.ok(wasmPath && fixturePath, '--wasm and --fixture are required');
  const bytes = fs.readFileSync(wasmPath);
  console.log('wasm SHA256 ' + crypto.createHash('sha256').update(bytes).digest('hex'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(imports.host, {
    memory, create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0, com_create_instance: () => 0x80004002,
  });
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  const e = instance.exports;
  const fixture = fs.readFileSync(fixturePath);
  const fixtureSha = crypto.createHash('sha256').update(fixture).digest('hex');
  assert.equal(fixtureSha, option('fixture-sha256'), 'sealed PE fixture hash');
  console.log('fixture SHA256 ' + fixtureSha);
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert.ok(e.load_pe(fixture.length), 'PE initializes guest stack and thunks');
  const wa = guest => e.guest_to_wasm(guest) >>> 0;
  const data = new DataView(memory.buffer);
  const string = text => {
    const raw = Buffer.from(text + '\0', 'ascii'), ptr = e.guest_alloc(raw.length) >>> 0;
    new Uint8Array(memory.buffer).set(raw, wa(ptr));
    return ptr;
  };
  const name = string('OemKeyScan');
  const missing = string('OemKeyScan_deliberately_missing');
  assert.equal(e.api_name_known(missing), 0, 'unknown API negative control');
  if (process.argv.includes('--expect-missing')) {
    assert.equal(e.api_name_known(name), 0, 'baseline has no OemKeyScan mapping');
    console.log('PASS baseline missing OemKeyScan negative control');
    return;
  }
  assert.equal(e.api_name_known(name), 1, 'actual runtime name hash lookup');
  const stack = e.get_esp() >>> 0;
  const thunkGuest = e.get_thunk_base() >>> 0;
  const thunkWa = wa(thunkGuest);
  const savedName = data.getUint32(thunkWa, true), savedId = data.getUint32(thunkWa + 4, true);
  function call(addr, args, nargs) {
    e.set_esp(stack);
    e.call_func(addr, args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0);
    const before = e.get_esp() >>> 0; // call_func pushes ret + four arguments.
    for (let i = 0; i < 20 && e.get_eip(); i++) e.run(100);
    assert.equal(e.get_eip(), 0, 'API thunk returns to halt sentinel');
    assert.equal(e.get_esp() >>> 0, before + 4 * (nargs + 1), 'stdcall stack cleanup');
    return e.get_eax() >>> 0;
  }
  function bootstrap(name, args) {
    const entry = apiTable.find(api => api.name === name);
    assert.ok(entry, name + ' registered');
    data.setUint32(thunkWa + 4, entry.id, true);
    return call(thunkGuest, args, entry.nargs);
  }
  try {
    const user32 = bootstrap('GetModuleHandleA', [string('USER32.DLL')]);
    assert.notEqual(user32, 0, 'USER32 static module handle');
    const oem = bootstrap('GetProcAddress', [user32, name]);
    assert.notEqual(oem, 0, 'GetProcAddress resolves OemKeyScan through name lookup');
    assert.equal(e.thunk_word(oem, 1), apiTable.find(api => api.name === 'OemKeyScan').id);
    for (const [ch, expected] of [[0, 0x30003], [0x61, 0x1e], [0x41, 0x1001e],
      [0x31, 2], [0x21, 0x10002], [0x3f, 0x10035], [8, 0xe],
      [10, 0x2001c], [0x82, 0xffffffff], [0xb3, 0xffffffff],
      [0xff, 0xffffffff], [0x141, 0x1001e], [0xffff, 0xffffffff]]) {
      assert.equal(call(oem, [ch], 1), expected, 'OemKeyScan(' + ch + ')');
    }
    console.log('PASS full module OemKeyScan: name hash, GetProcAddress thunk, dispatch, control/ASCII/OEM/WORD output, ESP+8');
  } finally {
    data.setUint32(thunkWa, savedName, true);
    data.setUint32(thunkWa + 4, savedId, true);
  }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
