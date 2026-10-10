'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { guestToWasm } = require('../lib/mem-utils');

const extraWat = `
  (func (export "test_shell_ex") (param $stack i32) (param $info i32) (param $wide i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (if (local.get $wide)
      (then (call $handle_ShellExecuteExW (local.get $info) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_ShellExecuteExA (local.get $info) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_shell_error") (result i32) (global.get $last_error))
`;

(async () => {
  const calls = [], spawns = [];
  let memory, status = 33, processId = 0x1234;
  const read = p => {
    if (!p) return null;
    const bytes = new Uint8Array(memory.buffer);
    let value = '';
    for (let i = p; bytes[i]; ++i) value += String.fromCharCode(bytes[i]);
    return value;
  };
  const h = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    shell_execute: (hwnd, verb, file, parameters, directory, show) => {
      calls.push({ hwnd, verb: read(verb), file: read(file), parameters: read(parameters),
        directory: read(directory), show });
      return status;
    },
    process_spawn: (command, directory, childIp, spec, count, forceSpawn, showCmd) => {
      spawns.push({ command: read(command), directory: read(directory), childIp, spec,
        count, forceSpawn, showCmd });
      return processId;
    },
  } });
  memory = h.memory;
  const e = h.exports, dv = new DataView(memory.buffer), stack = 0x074ff000;
  const wa = p => guestToWasm(p, e, memory.buffer, e.get_image_base());
  const string = (text, wide) => {
    const bytes = Buffer.from(text + '\0', wide ? 'utf16le' : 'latin1');
    const p = e.guest_alloc(bytes.length) >>> 0;
    new Uint8Array(memory.buffer, wa(p), bytes.length).set(bytes);
    return p;
  };
  for (const wide of [0, 1]) {
    const info = e.guest_alloc(64) >>> 0, p = wa(info);
    const words = [60, 0, 123, string('open', wide), string('C:\\Games\\Ion Launcher.exe', wide),
      string('DX2.exe window "save game"', wide), string('C:\\Games', wide), 5,
      0xdeadbeef, 0, 0, 0, 0, 0, 0, 0x12345678];
    const reset = () => words.forEach((v, i) => dv.setUint32(p + i * 4, v, true));
    reset(); status = 33;
    const before = calls.length;
    assert.equal(e.test_shell_ex(stack, info, wide), 1);
    assert.equal(calls.length, before + 1, 'Ex must attempt the launch');
    assert.deepEqual(calls.at(-1), { hwnd: 123, verb: 'open', file: 'C:\\Games\\Ion Launcher.exe',
      parameters: 'DX2.exe window "save game"', directory: 'C:\\Games', show: 5 });
    assert.equal(dv.getUint32(p + 28, true), 5, 'nShow is an input, not hInstApp');
    assert.equal(dv.getUint32(p + 32, true), 33, 'hInstApp has the correct Win32 offset');
    assert.equal(dv.getUint32(p + 60, true), 0x12345678, 'no struct overrun');
    assert.equal(e.get_esp() >>> 0, stack + 8);
    reset(); status = 2;
    assert.equal(e.test_shell_ex(stack, info, wide), 0, 'missing executable fails');
    assert.equal(e.test_shell_error(), 2);
    assert.equal(dv.getUint32(p + 32, true), 2);
    assert.equal(dv.getUint32(p + 28, true), 5);
    reset(); dv.setUint32(p, 4, true);
    const unchanged = calls.length;
    assert.equal(e.test_shell_ex(stack, info, wide), 0, 'short struct fails before launch');
    assert.equal(e.test_shell_error(), 87);
    assert.equal(calls.length, unchanged);
    reset(); dv.setUint32(p + 4, 0x440, true); // NOCLOSEPROCESS | NO_UI, as IW requests
    dv.setUint32(p + 56, 0xabcdef12, true);
    processId = 0x1234;
    assert.equal(e.test_shell_ex(stack, info, wide), 1, 'tracked process starts');
    assert.equal(e.test_shell_error(), 0);
    assert.equal(dv.getUint32(p + 56, true), 0x00e41234, 'handle names the actual host child');
    assert.deepEqual(spawns.at(-1), {
      command: '"C:\\Games\\Ion Launcher.exe" DX2.exe window "save game"',
      directory: 'C:\\Games', childIp: 0, spec: 0, count: 0, forceSpawn: 1, showCmd: 5,
    });
    assert.equal(calls.length, unchanged, 'retained process requests bypass fire-and-forget shell');
    for (const verb of [null, 'OPEN']) {
      dv.setUint32(p + 12, verb === null ? 0 : string(verb, wide), true);
      assert.equal(e.test_shell_ex(stack, info, wide), 1, 'default and case-insensitive open spawn');
      assert.equal(dv.getUint32(p + 56, true), 0x00e41234);
    }
    for (const verb of ['x', 'print']) {
      const spawnCount = spawns.length;
      dv.setUint32(p + 12, string(verb, wide), true);
      assert.equal(e.test_shell_ex(stack, info, wide), 0, 'unsupported verbs must not launch an EXE');
      assert.equal(e.test_shell_error(), 120);
      assert.equal(dv.getUint32(p + 56, true), 0);
      assert.equal(spawns.length, spawnCount);
    }
    dv.setUint32(p + 12, words[3], true);
    processId = 0;
    assert.equal(e.test_shell_ex(stack, info, wide), 0, 'failed tracked launch fails the API');
    assert.equal(e.test_shell_error(), 2);
    assert.equal(dv.getUint32(p + 56, true), 0);
    assert.equal(calls.length, unchanged, 'must not fire-and-forget a retained-handle request');
    assert.equal(e.test_shell_ex(stack, 0, wide), 0, 'null structure fails safely');
    assert.equal(e.test_shell_error(), 87);
    assert.equal(calls.length, unchanged);
  }
  console.log('PASS ShellExecuteEx A/W dispatch, parameters, layout, failure and stdcall');
})().catch(error => { console.error(error); process.exitCode = 1; });
