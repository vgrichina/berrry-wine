'use strict';
// Compiled handler/ABI fixture. Requires the normal render harness; this is
// deliberately separate from the allocation-light JavaScript VFS regression.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const extraWat = `
  (func (export "test_lock_error") (result i32) (global.get $last_error))
  (func (export "test_lock") (param $h i32) (param $lo i32) (param $hi i32)
    (param $nlo i32) (param $nhi i32) (param $unlock i32) (result i32)
    (global.set $last_error (i32.const 0x1234))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (if (local.get $unlock)
      (then (call $handle_UnlockFile (local.get $h) (local.get $lo) (local.get $hi)
        (local.get $nlo) (local.get $nhi) (i32.const 0)))
      (else (call $handle_LockFile (local.get $h) (local.get $lo) (local.get $hi)
        (local.get $nlo) (local.get $nhi) (i32.const 0))))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const 0x074ff018))
      (then (unreachable)))
    (i32.load (global.get $reg_base)))
  (func (export "test_lock_dup") (param $h i32) (param $process i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $gs32 (i32.const 0x074ff018) (i32.const 0))
    (call $gs32 (i32.const 0x074ff01c) (i32.const 2))
    (call $handle_DuplicateHandle (i32.const -1) (local.get $h) (local.get $process)
      (i32.const 0x00490000) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const 0x074ff020))
      (then (unreachable)))
    (if (i32.eqz (i32.load (global.get $reg_base))) (then (return (i32.const 0))))
    (call $gl32 (i32.const 0x00490000)))
  (func (export "test_lock_crt_dup") (param $h i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle__dup (local.get $h) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const 0x074ff004))
      (then (unreachable)))
    (i32.load (global.get $reg_base)))
`;
(async () => {
  const { exports: wat, hostCtx } = await bootRenderHarness({ extraWat });
  const vfs = hostCtx.vfs;
  const a = vfs.createFile('c:\\lock-abi.bin', 0xc0000000, 2);
  const b = vfs.createFile('c:\\lock-abi.bin', 0xc0000000, 3);
  assert.equal(wat.test_lock(a, 3, 0x200000, 4, 0, 0), 1);
  assert.equal(wat.test_lock_error(), 0x1234, 'success preserves last error');
  assert.equal(wat.test_lock(b, 4, 0x200000, 1, 0, 0), 0);
  assert.equal(wat.test_lock_error(), 33);
  const duplicate = wat.test_lock_dup(a, -1);
  assert(duplicate > 0);
  assert.equal(wat.test_lock(duplicate, 3, 0x200000, 4, 0, 1), 1);
  assert.equal(wat.test_lock_dup(a, 0x12345678), 0);
  assert.equal(wat.test_lock_error(), 6);
  const crt = wat.test_lock_crt_dup(a);
  assert(crt > 0);
  assert.equal(wat.test_lock(crt, 7, 0, 1, 0, 0), 1);
  assert.equal(wat.test_lock(a, 7, 0, 1, 0, 1), 1);
  assert.equal(wat.test_lock(a, -1, -1, 2, 0, 0), 0);
  assert.equal(wat.test_lock_error(), 87);
  assert.equal(wat.test_lock(a, 7, 0, 1, 0, 1), 0);
  assert.equal(wat.test_lock_error(), 158);
  vfs.closeAllDiskHandles();
  console.log('LockFile handlers: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
