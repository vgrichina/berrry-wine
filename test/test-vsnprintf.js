#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const apiTable = require('../src/api_table.json');

const ROOT = path.join(__dirname, '..');
const extraWat = String.raw`
  (func (export "test_make_api_thunk") (param $api_id i32) (result i32)
    (local $addr i32)
    (local.set $addr (i32.add (global.get $THUNK_BASE)
      (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $addr) (i32.const 0))
    (i32.store offset=4 (local.get $addr) (local.get $api_id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (i32.add (i32.sub (local.get $addr) (global.get $GUEST_BASE))
             (global.get $image_base)))
`;

const u32 = value => [value, value >>> 8, value >>> 16, value >>> 24].map(v => v & 0xff);

async function main() {
  // Plain append: src fragments are self-balanced now, so there is no trailing
  // `)` to splice before — the old regex matched nothing and dropped extraWat.
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  Object.assign(imports.host, {
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002,
  });

  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE initializes API dispatch');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = guest => (guest - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const alloc = size => e.guest_alloc(size) >>> 0;
  const writeAscii = value => {
    const guest = alloc(value.length + 1);
    bytes.set(Buffer.from(value + '\0', 'latin1'), wa(guest));
    return guest;
  };

  const api = apiTable.find(entry => entry.name === '_vsnprintf');
  assert(api, '_vsnprintf is registered');
  assert.strictEqual(api.convention, 'cdecl');
  const thunk = e.test_make_api_thunk(api.id) >>> 0;
  const format = writeAscii('value=%d');
  const argptr = alloc(4);
  dv.setUint32(wa(argptr), 42, true);

  const call = (buffer, count) => {
    const args = [buffer, count, format, argptr];
    const code = [];
    for (const arg of [...args].reverse()) code.push(0x68, ...u32(arg));
    code.push(0xb8, ...u32(thunk), 0xff, 0xd0, 0x83, 0xc4, 0x10, 0xc2, 0x10, 0x00);
    const wrapper = alloc(code.length);
    bytes.set(code, wa(wrapper));
    e.call_func(wrapper, 0, 0, 0, 0);
    for (let i = 0; i < 1000 && e.get_eip(); i++) e.run(5000);
    assert.strictEqual(e.get_eip(), 0, '_vsnprintf wrapper terminates');
    return e.get_eax() | 0;
  };

  const full = alloc(16);
  bytes.fill(0xcc, wa(full), wa(full) + 16);
  assert.strictEqual(call(full, 16), 8, 'complete output returns its character count');
  assert.strictEqual(Buffer.from(bytes.slice(wa(full), wa(full) + 9)).toString('latin1'), 'value=42\0');

  const short = alloc(8);
  bytes.fill(0xcc, wa(short), wa(short) + 8);
  assert.strictEqual(call(short, 5), -1, 'truncated Win9x CRT output returns -1');
  assert.strictEqual(Buffer.from(bytes.slice(wa(short), wa(short) + 5)).toString('latin1'), 'value');
  assert.strictEqual(bytes[wa(short) + 5], 0xcc, 'truncation does not append a NUL beyond count');

  // Real x86 CALLs through API thunks: stars consume separate ints before
  // the conversion value, and the caller still owns every argument slot.
  const thunks = Object.fromEntries(['sprintf', 'vsprintf', '_vsnprintf'].map(name =>
    [name, e.test_make_api_thunk(apiTable.find(entry => entry.name === name).id) >>> 0]));
  const invoke = (name, args) => {
    const record = alloc(24), code = [];
    for (const [opcode, value] of [[0xbb, 0x12345678], [0xbe, 0x23456789], [0xbf, 0x3456789a], [0xbd, 0x456789ab]])
      code.push(opcode, ...u32(value));
    for (const arg of [...args].reverse()) code.push(0x68, ...u32(arg));
    code.push(0x89, 0x25, ...u32(record)); // mov [record],esp, before CALL
    code.push(0xb8, ...u32(thunks[name]), 0xff, 0xd0);
    code.push(0x89, 0x25, ...u32(record + 4));
    for (const [modrm, offset] of [[0x1d, 8], [0x35, 12], [0x3d, 16], [0x2d, 20]])
      code.push(0x89, modrm, ...u32(record + offset));
    code.push(0x81, 0xc4, ...u32(args.length * 4), 0xc2, 0x10, 0x00);
    const wrapper = alloc(code.length);
    bytes.set(code, wa(wrapper));
    e.call_func(wrapper, 0, 0, 0, 0);
    for (let i = 0; i < 1000 && e.get_eip(); i++) e.run(5000);
    assert.strictEqual(e.get_eip(), 0, name + ' native return');
    assert.strictEqual(dv.getUint32(wa(record), true), dv.getUint32(wa(record + 4), true), name + ' cdecl argument ownership');
    assert.deepStrictEqual([8, 12, 16, 20].map(n => dv.getUint32(wa(record + n), true)),
      [0x12345678, 0x23456789, 0x3456789a, 0x456789ab], name + ' nonvolatile registers');
    return e.get_eax() | 0;
  };
  const filename = writeAscii('cc-ms.dac'); // actual Tile World first filename
  const cases = [
    ['%.*s', [255, filename], 'cc-ms.dac'],
    ['%.*s:%d', [0, filename, 73], ':73'],
    ['%.*s:%d', [4, filename, 73], 'cc-m:73'],
    ['%.*s:%d', [-3, filename, 73], 'cc-ms.dac:73'],
    ['%*s:%d', [12, filename, 73], '   cc-ms.dac:73'],
    ['%*.*s:%d', [8, 4, filename, 73], '    cc-m:73'],
    ['%*.*s:%d', [-8, 4, filename, 73], 'cc-m    :73'],
    ['%-*.*s:%d', [8, 4, filename, 73], 'cc-m    :73'],
    ['%*.*d:%x', [7, 3, 42, 0xab], '    042:ab'],
    ['%0*.*d:%d', [-7, 3, -42, 19], '-042   :19'],
    ['%.*d:%d', [0, 0, 19], ':19'],
    ['%*c:%d', [-3, 65, 19], 'A  :19'],
    ['%.*s:%d', [6, 0, 19], '(null):19'],
    ['%.*s:%d', [-1, writeAscii(''), 19], ':19'],
  ];
  for (const [fmt, values, expected] of cases) {
    const fmtPtr = writeAscii(fmt), va = alloc(values.length * 4);
    values.forEach((v, i) => dv.setUint32(wa(va + i * 4), v >>> 0, true));
    for (const name of ['sprintf', 'vsprintf', '_vsnprintf']) {
      const output = alloc(132); bytes.fill(0xcc, wa(output), wa(output) + 132);
      const dst = output + 2;
      const args = name === 'sprintf' ? [dst, fmtPtr, ...values] :
        name === 'vsprintf' ? [dst, fmtPtr, va] : [dst, 128, fmtPtr, va];
      assert.strictEqual(invoke(name, args), expected.length, name + ' ' + fmt);
      assert.deepStrictEqual(Buffer.from(bytes.slice(wa(dst), wa(dst) + expected.length + 1)), Buffer.from(expected + '\0'));
      assert(bytes.slice(wa(output), wa(dst)).every(b => b === 0xcc), 'prefix guard');
      assert(bytes.slice(wa(dst) + expected.length + 1, wa(output) + 132).every(b => b === 0xcc), 'suffix guard');
    }
  }
  const starFmt = writeAscii('%.*s:%d'), va = alloc(12);
  [255, filename, 73].forEach((v, i) => dv.setUint32(wa(va + i * 4), v, true));
  for (const count of [0, 4, 12, 13]) {
    const output = alloc(20); bytes.fill(0xcc, wa(output), wa(output) + 20);
    const expected = 'cc-ms.dac:73';
    assert.strictEqual(invoke('_vsnprintf', [output, count, starFmt, va]), count > expected.length ? expected.length : -1);
    assert.strictEqual(Buffer.from(bytes.slice(wa(output), wa(output) + Math.min(count, expected.length))).toString(), expected.slice(0, count));
    assert.strictEqual(bytes[wa(output) + Math.min(count, expected.length)], count > expected.length ? 0 : 0xcc);
  }
  assert.strictEqual(invoke('_vsnprintf', [0, 20, starFmt, va]), -1, 'NULL buffer rejected');
  assert.strictEqual(invoke('_vsnprintf', [full, 16, 0, va]), -1, 'NULL format rejected');

  console.log('PASS CRT star precision/width, following arguments, output length, truncation, NULL and native cdecl/nonvolatile ABI');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
