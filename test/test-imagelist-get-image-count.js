#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat: `
    (func (export "test_set_last_error") (param $value i32)
      (global.set $last_error (local.get $value)))
    (func (export "test_imagelist_create") (result i32)
      (call $handle_ImageList_Create
        (i32.const 16) (i32.const 16) (i32.const 0x21)
        (i32.const 0) (i32.const 4) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_imagelist_count") (param $himl i32) (result i32)
      (call $handle_ImageList_GetImageCount
        (local.get $himl) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_imagelist_seed_count")
        (param $himl i32) (param $count i32)
      (call $gs32 (i32.add (local.get $himl) (i32.const 12)) (local.get $count)))
    (func (export "test_imagelist_destroy") (param $himl i32) (result i32)
      (call $handle_ImageList_Destroy
        (local.get $himl) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  ` });

  e.set_esp(0x700100);
  e.test_set_last_error(0x2345);
  assert.strictEqual(e.test_imagelist_count(0), 0, 'NULL has zero images');
  assert.strictEqual(e.get_esp(), 0x700108, 'one-argument stdcall cleanup');
  assert.strictEqual(e.test_get_last_error(), 0x2345, 'query preserves last error');

  const list = e.test_imagelist_create() >>> 0;
  assert(list, 'ImageList_Create returns a tagged HIMAGELIST');
  assert.strictEqual(e.test_imagelist_count(list), 0, 'new list starts empty');
  e.test_imagelist_seed_count(list, 7);
  assert.strictEqual(e.test_imagelist_count(list), 7,
    'count comes from the canonical HIML logical-count field');

  assert.strictEqual(e.test_imagelist_count(0x1234), 0,
    'an untagged handle does not expose sentinel memory as a list');
  assert.strictEqual(e.test_imagelist_count(0xfffffff0), 0,
    'an unmapped wrapping handle returns zero without trapping');
  assert.strictEqual(e.test_imagelist_destroy(list), 1, 'list is destroyed');
  assert.strictEqual(e.test_imagelist_count(list), 0,
    'a destroyed HIMAGELIST no longer reports its stale count');

  console.log('ImageList_GetImageCount tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
