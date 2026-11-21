#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_map") (param i32) (result i32)
    (call $virtual_map_commit (local.get 0) (i32.const 4096)))
  (func (export "test_scroll")
        (param $handle i32) (param $scroll i32) (param $clip i32)
        (param $destination i32) (param $fill i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ScrollConsoleScreenBufferW
      (local.get $handle) (local.get $scroll) (local.get $clip)
      (local.get $destination) (local.get $fill) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_cell")
        (param $handle i32) (param $x i32) (param $y i32)
        (param $character i32) (param $attribute i32) (result i32)
    (local $offset i32)
    (if (i32.eqz (call $console_buffer_enter (local.get $handle)))
      (then (return (i32.const 0))))
    (call $console_cells_ensure)
    (local.set $offset
      (i32.shl
        (i32.add (i32.mul (local.get $y) (global.get $console_width)) (local.get $x))
        (i32.const 1)))
    (i32.store16 (i32.add (global.get $console_text_base) (local.get $offset))
      (local.get $character))
    (i32.store16 (i32.add (global.get $console_attr_base) (local.get $offset))
      (local.get $attribute))
    (call $console_buffer_finish (i32.const 0))
    (i32.const 1))

  (func (export "test_get_cell")
        (param $handle i32) (param $x i32) (param $y i32) (result i32)
    (local $offset i32) (local $value i32)
    (if (i32.eqz (call $console_buffer_enter (local.get $handle)))
      (then (return (i32.const -1))))
    (call $console_cells_ensure)
    (local.set $offset
      (i32.shl
        (i32.add (i32.mul (local.get $y) (global.get $console_width)) (local.get $x))
        (i32.const 1)))
    (local.set $value
      (i32.or
        (i32.load16_u (i32.add (global.get $console_text_base) (local.get $offset)))
        (i32.shl
          (i32.load16_u (i32.add (global.get $console_attr_base) (local.get $offset)))
          (i32.const 16))))
    (call $console_buffer_finish (i32.const 0))
    (local.get $value))

  (func (export "test_create_buffer") (result i32)
    (call $console_buffer_create))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  const api = apiTable.find(entry => entry.name === 'ScrollConsoleScreenBufferW');
  assert(api, 'ScrollConsoleScreenBufferW is exported');
  assert.strictEqual(api.nargs, 5, 'ScrollConsoleScreenBufferW has five arguments');
  assert.strictEqual(api.convention, 'stdcall', 'ScrollConsoleScreenBufferW uses stdcall');

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const active = 0x00030001;
  const stack = 0x074ff000;
  const scrollRect = wat.guest_alloc(8) >>> 0;
  const clipRect = wat.guest_alloc(8) >>> 0;
  const fill = wat.guest_alloc(4) >>> 0;
  const coord = (x, y) => (x & 0xffff) | ((y & 0xffff) << 16);
  const writeRect = (pointer, left, top, right, bottom) => {
    [left, top, right, bottom].forEach((value, index) =>
      wat.guest_write16(pointer + index * 2, value));
  };
  const writeFill = (character, attribute) => {
    wat.guest_write16(fill, character);
    wat.guest_write16(fill + 2, attribute);
  };
  const setCell = (handle, x, y, character, attribute) =>
    assert.strictEqual(wat.test_set_cell(handle, x, y, character, attribute), 1);
  const getCell = (handle, x, y) => {
    const packed = wat.test_get_cell(handle, x, y) >>> 0;
    return { character: packed & 0xffff, attribute: packed >>> 16 };
  };
  const seedGrid = handle => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 5; x++) {
        setCell(handle, x, y, 0x41 + y * 5 + x, 0x10 + y);
      }
    }
  };
  const scroll = (handle, destination, clip = 0, scroll = scrollRect, fillInfo = fill) =>
    resultOf(wat.test_scroll(handle, scroll, clip, destination, fillInfo, stack));

  seedGrid(active);
  writeFill(0x23, 0x4f); // '#'
  writeRect(scrollRect, 0, 1, 3, 3);
  assert.deepStrictEqual(scroll(active, coord(0, 0)), { eax: 1, esp: stack + 24 });
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 4; x++) {
      assert.deepStrictEqual(getCell(active, x, y),
        { character: 0x41 + (y + 1) * 5 + x, attribute: 0x11 + y },
        `upward overlap lost source cell ${x},${y + 1}`);
    }
  }
  for (let x = 0; x < 4; x++) {
    assert.deepStrictEqual(getCell(active, x, 3), { character: 0x23, attribute: 0x4f },
      `upward scroll did not fill exposed cell ${x},3`);
  }
  assert.deepStrictEqual(getCell(active, 4, 0), { character: 0x45, attribute: 0x10 },
    'scroll changed a cell outside the source and target rectangles');

  seedGrid(active);
  writeRect(scrollRect, 0, 0, 3, 2);
  assert.deepStrictEqual(scroll(active, coord(0, 1)), { eax: 1, esp: stack + 24 });
  for (let y = 1; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      assert.deepStrictEqual(getCell(active, x, y),
        { character: 0x41 + (y - 1) * 5 + x, attribute: 0x0f + y },
        `downward overlap overwrote source cell ${x},${y - 1}`);
    }
  }
  for (let x = 0; x < 4; x++) {
    assert.deepStrictEqual(getCell(active, x, 0), { character: 0x23, attribute: 0x4f });
  }

  seedGrid(active);
  writeRect(scrollRect, 0, 0, 2, 0);
  assert.deepStrictEqual(scroll(active, coord(1, 0)), { eax: 1, esp: stack + 24 });
  assert.deepStrictEqual([0, 1, 2, 3].map(x => getCell(active, x, 0).character),
    [0x23, 0x41, 0x42, 0x43], 'rightward overlap was not copied like memmove');

  seedGrid(active);
  writeRect(scrollRect, 0, 1, 3, 3);
  writeRect(clipRect, 1, 0, 2, 3);
  assert.deepStrictEqual(scroll(active, coord(0, 0), clipRect), { eax: 1, esp: stack + 24 });
  for (let y = 0; y < 4; y++) {
    assert.deepStrictEqual(getCell(active, 0, y),
      { character: 0x41 + y * 5, attribute: 0x10 + y }, `clip changed left cell at row ${y}`);
    assert.deepStrictEqual(getCell(active, 3, y),
      { character: 0x44 + y * 5, attribute: 0x10 + y }, `clip changed right cell at row ${y}`);
  }
  for (let y = 0; y < 3; y++) {
    for (let x = 1; x <= 2; x++) {
      assert.deepStrictEqual(getCell(active, x, y),
        { character: 0x41 + (y + 1) * 5 + x, attribute: 0x11 + y });
    }
  }
  assert.deepStrictEqual(getCell(active, 1, 3), { character: 0x23, attribute: 0x4f });
  assert.deepStrictEqual(getCell(active, 2, 3), { character: 0x23, attribute: 0x4f });

  seedGrid(active);
  writeRect(scrollRect, 0, 0, 2, 0);
  assert.deepStrictEqual(scroll(active, coord(-1, 0)), { eax: 1, esp: stack + 24 });
  assert.deepStrictEqual([0, 1, 2].map(x => getCell(active, x, 0)), [
    { character: 0x42, attribute: 0x10 },
    { character: 0x43, attribute: 0x10 },
    { character: 0x23, attribute: 0x4f },
  ], 'off-screen target was not clipped while the exposed source cell was filled');

  const activeBeforeInactiveScroll = getCell(active, 0, 0);
  const inactive = wat.test_create_buffer() >>> 0;
  assert.notStrictEqual(inactive, 0xffffffff, 'could not create inactive screen buffer');
  setCell(inactive, 0, 0, 0x58, 0x2e);
  setCell(inactive, 0, 1, 0x59, 0x3f);
  writeRect(scrollRect, 0, 1, 0, 1);
  assert.deepStrictEqual(scroll(inactive, coord(0, 0)), { eax: 1, esp: stack + 24 });
  assert.deepStrictEqual(getCell(inactive, 0, 0), { character: 0x59, attribute: 0x3f });
  assert.deepStrictEqual(getCell(inactive, 0, 1), { character: 0x23, attribute: 0x4f });
  assert.deepStrictEqual(getCell(active, 0, 0), activeBeforeInactiveScroll,
    'scrolling an inactive buffer changed the active buffer');

  for (const [label, handle, rect, clip, fillInfo, expectedError] of [
    ['invalid handle', 0x1234, scrollRect, 0, fill, 6],
    ['NULL scroll rectangle', active, 0, 0, fill, 87],
    ['NULL fill', active, scrollRect, 0, 0, 87],
  ]) {
    wat.test_set_last_error(0x1234);
    assert.deepStrictEqual(scroll(handle, coord(0, 0), clip, rect, fillInfo),
      { eax: 0, esp: stack + 24 }, `${label} did not fail`);
    assert.strictEqual(wat.test_get_last_error(), expectedError, `${label} set the wrong error`);
  }
  writeRect(scrollRect, 3, 0, 2, 0);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(scroll(active, coord(0, 0)), { eax: 0, esp: stack + 24 },
    'inverted scroll rectangle did not fail');
  assert.strictEqual(wat.test_get_last_error(), 87);
  writeRect(scrollRect, 0, 0, 1, 1);
  writeRect(clipRect, 2, 0, 1, 1);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(scroll(active, coord(0, 0), clipRect), { eax: 0, esp: stack + 24 },
    'inverted clip rectangle did not fail');
  assert.strictEqual(wat.test_get_last_error(), 87);

  const page = 0x30000000;
  for (const ga of [page, 0x28000000, page + 4096]) assert.strictEqual(wat.test_map(ga) >>> 0, ga);
  assert.notStrictEqual(wat.guest_to_wasm(page + 4096), wat.guest_to_wasm(page) + 4096);
  for (let i = 0; i < 4096; i++) wat.guest_write8(0x28000000 + i, 0xa5);
  const bytes = (p, n) => Array.from({ length: n }, (_, i) => wat.guest_read8(p + i));
  for (const [kind, length] of [['scroll', 8], ['clip', 8], ['fill', 4]]) {
    for (let split = 1; split < length; split++) {
      for (const clipLeft of [1, -2]) {
        seedGrid(active);
        const edge = page + 4096 - split;
        const source = kind === 'scroll' ? edge : scrollRect;
        const clipping = kind === 'clip' ? edge : clipRect;
        const fillInfo = kind === 'fill' ? edge : fill;
        wat.guest_write8(edge - 1, 0xcc);
        wat.guest_write8(edge + length, 0xcc);
        writeRect(source, -1, 1, 3, 3);
        writeRect(clipping, clipLeft, 0, 2, 3);
        wat.guest_write16(fillInfo, 0x03a9);
        wat.guest_write16(fillInfo + 2, 0xbeef);
        const before = bytes(edge - 1, length + 2);
        assert.deepStrictEqual(scroll(active, coord(-1, 0), clipping, source, fillInfo),
          { eax: 1, esp: stack + 24 }, `${kind} split ${split}`);
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 5; x++) {
            const changed = x >= Math.max(0, clipLeft) && x <= 2;
            const expected = changed && y === 3
              ? { character: 0x03a9, attribute: 0xbeef }
              : { character: 0x41 + (y + (changed ? 1 : 0)) * 5 + x,
                  attribute: 0x10 + y + (changed ? 1 : 0) };
            assert.deepStrictEqual(getCell(active, x, y), expected,
              `${kind} split ${split} clip ${clipLeft} cell ${x},${y}`);
          }
        }
        assert.deepStrictEqual(bytes(edge - 1, length + 2), before,
          'scroll inputs and guards are read-only');
      }
    }
  }
  assert.deepStrictEqual(bytes(0x28000000, 4096), Array(4096).fill(0xa5));

  console.log('PASS console screen-buffer scrolling copies, fills, clips, and preserves state');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
