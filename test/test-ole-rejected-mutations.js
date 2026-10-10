'use strict';
const assert = require('assert');
// Generated funcs embed the table id: a WAT string literal per name is interned
// into the shared, fixed-size WATX string pool, and these names overflowed it.
const apiId = name => require('../src/api_table.json').find(entry => entry.name === name).id;
const { bootRenderHarness } = require('./render-helper');
const names = ['ILockBytes_SetSize', 'IStream_SetSize', 'IStream_LockRegion', 'IStream_UnlockRegion'];

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "new_object") (param $kind i32) (result i32)
      (if (i32.eqz (local.get $kind)) (then
        (return (call $ole_create_lockbytes (i32.const 0) (i32.const 1)))))
      (if (i32.eq (local.get $kind) (i32.const 2)) (then
        (return (call $ole_create_hglobal_stream (i32.const 0) (i32.const 1)))))
      (call $ole_create_stream (i32.const 0) (i32.const 0)))
    (func (export "clone") (param $obj i32) (result i32)
      (call $ole_clone_stream (local.get $obj)))
    ${names.map(name => `
    (func (export "${name}") (param $stack i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (local.get $stack))
      (call $dispatch_api_table (i32.const ${apiId(name)})
        (call $gl32 (i32.add (local.get $stack) (i32.const 4)))
        (call $gl32 (i32.add (local.get $stack) (i32.const 8)))
        (call $gl32 (i32.add (local.get $stack) (i32.const 12)))
        (call $gl32 (i32.add (local.get $stack) (i32.const 16)))
        (call $gl32 (i32.add (local.get $stack) (i32.const 20))) (i32.const 0))
      (i32.load (global.get $reg_base)))`).join('\n')}
  ` });
  e.init_dx_com_thunks();
  const stack = e.guest_alloc(40) >>> 0;
  const read = p => e.guest_read32(p) >>> 0;
  const bytes = (p, n) => Array.from({ length: n }, (_, i) => e.guest_read8(p + i));
  const call = (name, args) => {
    for (let i = 0; i < 40; i += 4) e.guest_write32(stack + i, 0x1234abcd);
    args.forEach((arg, i) => e.guest_write32(stack + 4 + i * 4, arg));
    const result = e[name](stack) >>> 0;
    const pop = (args.length + 1) * 4;
    assert.strictEqual(e.get_esp() >>> 0, stack + pop, `${name}: ESP`);
    assert.strictEqual(read(stack + pop), 0x1234abcd, `${name}: caller word`);
    return result;
  };
  const failures = [];
  let cases = 0;
  const check = (label, fn) => {
    try { fn(); cases++; } catch (error) { failures.push(`${label}: ${error.message}`); }
  };
  // Keep the existing high-word error code; this test is about rejected calls
  // not performing the low-32-bit operation, not a native HRESULT oracle.
  const rejected = 0x80030019;
  for (const kind of [0, 1, 2]) for (const high of [1, 2, 0x80000000, 0xffffffff]) {
    for (const low of [0, 4, 128]) check(`SetSize kind=${kind} high=${high} low=${low}`, () => {
      const obj = e.new_object(kind) >>> 0;
      const name = kind ? 'IStream_SetSize' : 'ILockBytes_SetSize';
      assert(obj);
      assert.strictEqual(call(name, [obj, 16, 0]), 0);
      const data = read(obj + 12), capacity = read(obj + 20);
      for (let i = 0; i < 16; i++) e.guest_write8(data + i, 0x40 + i);
      if (kind) e.guest_write32(obj + 24, 7);
      // Exercise shared backing through a clone as well as direct objects.
      const target = kind === 1 ? e.clone(obj) >>> 0 : obj;
      const header = bytes(obj, kind ? 64 : 44), before = bytes(data, capacity);
      const targetHeader = kind === 1 ? bytes(target, 64) : null;
      assert.strictEqual(call(name, [target, low, high]), rejected);
      assert.deepStrictEqual(bytes(obj, header.length), header, 'object metadata changed on failure');
      assert.deepStrictEqual(bytes(data, capacity), before, 'backing bytes changed on failure');
      if (targetHeader) assert.deepStrictEqual(bytes(target, 64), targetHeader, 'clone changed on failure');
      assert.strictEqual(call(name, [target, 4, 0]), 0, 'valid truncate still works');
      assert.strictEqual(read(obj + 16), 4);
      assert.deepStrictEqual(bytes(read(obj + 12), 4), [0x40, 0x41, 0x42, 0x43]);
      if (kind) assert.strictEqual(read(obj + 24), 7, 'SetSize does not move seek pointer');
    });
  }
  for (const [offsetHigh, lengthHigh] of [[1, 0], [0, 1], [2, 2], [0x80000000, 0xffffffff]]) {
    for (const unlock of [false, true]) check(`${unlock ? 'Unlock' : 'Lock'} high=${offsetHigh}/${lengthHigh}`, () => {
      const obj = e.new_object(1) >>> 0, clone = e.clone(obj) >>> 0;
      const valid = [obj, 4, 0, 8, 0, 2]; // LOCK_EXCLUSIVE
      if (unlock) assert.strictEqual(call('IStream_LockRegion', valid), 0);
      const head = read(obj + 56), before = head ? bytes(head, 20) : [];
      const method = unlock ? 'IStream_UnlockRegion' : 'IStream_LockRegion';
      assert.strictEqual(call(method, [obj, 4, offsetHigh, 8, lengthHigh, 2]), rejected);
      assert.strictEqual(read(obj + 56), head, 'lock list changed on failure');
      if (head) assert.deepStrictEqual(bytes(head, 20), before, 'lock entry changed on failure');
      const peer = [clone, 4, 0, 8, 0, 2];
      if (unlock) {
        assert.strictEqual(call('IStream_LockRegion', peer), 0x80030021, 'rejected unlock preserves exclusion');
        assert.strictEqual(call('IStream_UnlockRegion', valid), 0);
      }
      assert.strictEqual(call('IStream_LockRegion', peer), 0, 'no spurious lock remains');
      assert.strictEqual(call('IStream_UnlockRegion', peer), 0);
      assert.strictEqual(read(obj + 56), 0);
    });
  }
  assert.deepStrictEqual(failures, [], 'rejected OLE calls must not mutate state');
  console.log(`PASS ${cases} rejected OLE mutation cases: data, backing, clones, locks, valid paths and ESP`);
})().catch(error => { console.error(error); process.exitCode = 1; });
