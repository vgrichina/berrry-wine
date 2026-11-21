#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const MIIM_STATE = 0x01;
const MIIM_ID = 0x02;
const MIIM_DATA = 0x20;
const MIIM_STRING = 0x40;
const MFS_CHECKED = 0x08;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat: `
    (func (export "test_set_last_error") (param $value i32)
      (global.set $last_error (local.get $value)))
    (func (export "test_menu_create") (result i32)
      (call $handle_CreatePopupMenu
        (i32.const 0) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_menu_append_a")
        (param $hmenu i32) (param $id i32) (param $text i32) (result i32)
      (call $handle_AppendMenuA
        (local.get $hmenu) (i32.const 0) (local.get $id) (local.get $text)
        (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_menu_set_info_w")
        (param $hmenu i32) (param $item i32) (param $bypos i32) (param $mii i32)
        (result i32)
      (call $handle_SetMenuItemInfoW
        (local.get $hmenu) (local.get $item) (local.get $bypos) (local.get $mii)
        (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_menu_set_info_a")
        (param $hmenu i32) (param $item i32) (param $bypos i32) (param $mii i32)
        (result i32)
      (call $handle_SetMenuItemInfoA
        (local.get $hmenu) (local.get $item) (local.get $bypos) (local.get $mii)
        (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_menu_get_info_w")
        (param $hmenu i32) (param $item i32) (param $bypos i32) (param $mii i32)
        (result i32)
      (call $handle_GetMenuItemInfoW
        (local.get $hmenu) (local.get $item) (local.get $bypos) (local.get $mii)
        (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_menu_get_info_a")
        (param $hmenu i32) (param $item i32) (param $bypos i32) (param $mii i32)
        (result i32)
      (call $handle_GetMenuItemInfoA
        (local.get $hmenu) (local.get $item) (local.get $bypos) (local.get $mii)
        (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_menu_remove") (param $hmenu i32) (param $pos i32) (result i32)
      (call $dynamic_menu_remove
        (local.get $hmenu) (local.get $pos) (i32.const 1) (i32.const 0)))
    (func (export "test_menu_destroy") (param $hmenu i32) (result i32)
      (call $dynamic_menu_destroy (local.get $hmenu)))
    (func (export "test_heap_free_contains") (param $ptr i32) (result i32)
      (local $cur i32) (local $steps i32) (local $size i32)
      (local.set $size (call $gl32 (i32.sub (local.get $ptr) (i32.const 4))))
      (local.set $cur
        (if (result i32) (i32.le_u (local.get $size) (global.get $HEAP_BIN_MAX))
          (then (i32.wrap_i64 (call $heap_bin_get (call $heap_bin_index (local.get $size)))))
          (else (global.get $free_list))))
      (block $done (loop $scan
        (br_if $done (i32.eqz (local.get $cur)))
        (if (i32.eq (local.get $cur) (i32.sub (local.get $ptr) (i32.const 4)))
          (then (return (i32.const 1))))
        (br_if $done (i32.ge_u (local.get $steps) (i32.const 64)))
        (local.set $cur (i32.load offset=4 (call $g2w (local.get $cur))))
        (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
        (br $scan)))
      (i32.const 0))
  ` });

  const allocated = [];
  const alloc = size => {
    const p = e.guest_alloc(size) >>> 0;
    allocated.push(p);
    return p;
  };
  const strA = text => {
    const p = alloc(text.length + 1);
    for (let i = 0; i < text.length; i++) e.guest_write8(p + i, text.charCodeAt(i));
    e.guest_write8(p + text.length, 0);
    return p;
  };
  const strW = text => {
    const p = alloc((text.length + 1) * 2);
    for (let i = 0; i < text.length; i++) e.guest_write16(p + i * 2, text.charCodeAt(i));
    e.guest_write16(p + text.length * 2, 0);
    return p;
  };
  const readA = (p, max) => {
    let text = '';
    for (let i = 0; i < max; i++) {
      const ch = e.guest_read8(p + i);
      if (!ch) break;
      text += String.fromCharCode(ch);
    }
    return text;
  };
  const read16 = p => e.guest_read8(p) | (e.guest_read8(p + 1) << 8);
  const menuItemInfo = ({
    mask, type = 0, state = 0, id = 0, data = 0, text = 0, cch = 0,
  }) => {
    const p = alloc(44);
    for (let i = 0; i < 44; i += 4) e.guest_write32(p + i, 0);
    e.guest_write32(p + 0, 44);
    e.guest_write32(p + 4, mask);
    e.guest_write32(p + 8, type);
    e.guest_write32(p + 12, state);
    e.guest_write32(p + 16, id);
    e.guest_write32(p + 32, data);
    e.guest_write32(p + 36, text);
    e.guest_write32(p + 40, cch);
    return p;
  };

  const menu = e.test_menu_create() >>> 0;
  assert(menu, 'CreatePopupMenu returns canonical MNUD state');
  assert.strictEqual(e.test_menu_append_a(menu, 7, strA('Old')), 1);

  e.set_esp(0x700200);
  e.test_set_last_error(0x3456);
  const replacement = strW('R\u00e9sum\u00e9');
  const setInfo = menuItemInfo({
    mask: MIIM_STATE | MIIM_ID | MIIM_STRING,
    state: MFS_CHECKED,
    id: 9,
    text: replacement,
  });
  assert.strictEqual(e.test_menu_set_info_w(menu, 7, 0, setInfo), 1,
    'SetMenuItemInfoW updates an item selected by command');
  assert.strictEqual(e.get_esp(), 0x700214, 'SetMenuItemInfoW pops four arguments');
  assert.strictEqual(e.test_get_last_error(), 0x3456, 'successful set preserves last error');
  const firstOwned = e.test_menu_item_field(menu, 0, 2) >>> 0;
  assert.notStrictEqual(firstOwned, replacement,
    'SetMenuItemInfoW copies UTF-16 input into canonical owned ANSI storage');

  const secondReplacement = strW('Cr\u00e8me!');
  const secondSetInfo = menuItemInfo({ mask: MIIM_STRING, text: secondReplacement });
  assert.strictEqual(e.test_menu_set_info_w(menu, 0, 1, secondSetInfo), 1,
    'a later wide string replaces the first owned copy');
  const secondOwned = e.test_menu_item_field(menu, 0, 2) >>> 0;
  assert.notStrictEqual(secondOwned, secondReplacement);
  assert.notStrictEqual(secondOwned, firstOwned);
  assert.strictEqual(e.test_heap_free_contains(firstOwned), 1,
    'wide string replacement releases the previous canonical copy');

  const outText = alloc(5 * 2);
  const getInfo = menuItemInfo({
    mask: MIIM_STATE | MIIM_ID | MIIM_STRING,
    text: outText,
    cch: 5,
  });
  assert.strictEqual(e.test_menu_get_info_w(menu, 0, 1, getInfo), 1,
    'GetMenuItemInfoW updates an item selected by position');
  assert.strictEqual(e.get_esp(), 0x70023c, 'GetMenuItemInfoW pops four arguments');
  assert.strictEqual(e.guest_read32(getInfo + 16), 9, 'wide get returns the new id');
  assert.strictEqual(e.guest_read32(getInfo + 12) & MFS_CHECKED, MFS_CHECKED,
    'wide get returns shared item state');
  assert.strictEqual(e.guest_read32(getInfo + 40), 6,
    'cch reports the full label length in characters');
  assert.deepStrictEqual(
    Array.from({ length: 5 }, (_, i) => read16(outText + i * 2)),
    [0x43, 0x72, 0xe8, 0x6d, 0],
    'UTF-16 output is bounded by cch and terminated');
  assert.strictEqual(e.test_get_last_error(), 0x3456, 'successful get preserves last error');

  const measure = menuItemInfo({ mask: MIIM_STRING, text: 0, cch: 0 });
  assert.strictEqual(e.test_menu_get_info_w(menu, 0, 1, measure), 1);
  assert.strictEqual(e.guest_read32(measure + 40), 6,
    'NULL text buffer still measures the full wide-character count');

  const dataOnly = menuItemInfo({ mask: MIIM_DATA, data: 0xdeadbeef });
  assert.strictEqual(e.test_menu_set_info_w(menu, 0, 1, dataOnly), 1);
  assert.strictEqual(e.test_menu_item_field(menu, 0, 4) >>> 0, secondOwned,
    'MIIM_DATA alone does not replace or free the menu text');
  assert.strictEqual(e.test_heap_free_contains(secondOwned), 0,
    'the live text allocation is not on the free list');
  const dataTextOut = alloc(8 * 2);
  const dataTextGet = menuItemInfo({
    mask: MIIM_DATA | MIIM_STRING,
    text: dataTextOut,
    cch: 8,
  });
  assert.strictEqual(e.test_menu_get_info_w(menu, 0, 1, dataTextGet), 1);
  assert.strictEqual(e.guest_read32(dataTextGet + 32) >>> 0, 0xdeadbeef,
    'dwItemData round-trips independently from text');
  assert.deepStrictEqual(
    Array.from({ length: 7 }, (_, i) => read16(dataTextOut + i * 2)),
    [0x43, 0x72, 0xe8, 0x6d, 0x65, 0x21, 0],
    'MIIM_DATA did not alter the existing text');

  const combinedText = strW('Joint');
  const combinedSet = menuItemInfo({
    mask: MIIM_DATA | MIIM_STRING,
    data: 0xcafebabe,
    text: combinedText,
  });
  assert.strictEqual(e.test_menu_set_info_w(menu, 0, 1, combinedSet), 1,
    'MIIM_DATA and MIIM_STRING can be updated together');
  const combinedOwned = e.test_menu_item_field(menu, 0, 4) >>> 0;
  assert.notStrictEqual(combinedOwned, combinedText);
  assert.strictEqual(e.test_heap_free_contains(secondOwned), 1,
    'combined replacement releases the previous text without losing item data');
  const combinedOut = alloc(8 * 2);
  const combinedGet = menuItemInfo({
    mask: MIIM_DATA | MIIM_STRING,
    text: combinedOut,
    cch: 8,
  });
  assert.strictEqual(e.test_menu_get_info_w(menu, 0, 1, combinedGet), 1);
  assert.strictEqual(e.guest_read32(combinedGet + 32) >>> 0, 0xcafebabe);
  assert.strictEqual(
    String.fromCharCode(...Array.from({ length: 5 }, (_, i) => read16(combinedOut + i * 2))),
    'Joint',
    'combined masks preserve distinct text and dwItemData fields');

  const unsupported = menuItemInfo({ mask: 0x80 });
  assert.strictEqual(e.test_menu_get_info_w(menu, 0, 1, unsupported), 0,
    'unsupported bitmap output fails instead of claiming success');
  assert.strictEqual(e.test_menu_set_info_w(0x30065, 0, 1, setInfo), 0,
    'unmodelled menu handles fail instead of accepting a dropped mutation');

  assert.strictEqual(e.test_menu_remove(menu, 0), 1);
  assert.strictEqual(e.test_heap_free_contains(combinedOwned), 1,
    'removing an item releases its current owned string');

  const seedA = strA('Seed');
  assert.strictEqual(e.test_menu_append_a(menu, 11, seedA), 1);
  const seedOwned = e.test_menu_item_field(menu, 0, 4) >>> 0;
  assert(seedOwned && seedOwned !== seedA, 'AppendMenuA owns its label');
  e.guest_write8(seedA, 0x58);
  assert.strictEqual(readA(seedOwned, 8), 'Seed', 'append does not retain caller storage');
  const emptyA = strA('');
  assert.strictEqual(e.test_menu_set_info_a(menu, 0, 1,
    menuItemInfo({ mask: MIIM_STRING, text: emptyA })), 1);
  const emptyOwned = e.test_menu_item_field(menu, 0, 4) >>> 0;
  assert(emptyOwned && emptyOwned !== emptyA, 'empty ANSI label is independently owned');
  assert.strictEqual(e.guest_read8(emptyOwned), 0, 'empty label is terminated');
  assert.strictEqual(e.test_heap_free_contains(seedOwned), 1, 'empty replacement retires old label');
  const inputA = strA('Owned');
  const setInfoA = menuItemInfo({ mask: MIIM_STRING, text: inputA });
  assert.strictEqual(e.test_menu_set_info_a(menu, 0, 1, setInfoA), 1);
  const ownedA = e.test_menu_item_field(menu, 0, 2) >>> 0;
  assert.notStrictEqual(ownedA, inputA,
    'SetMenuItemInfoA follows the same owned-copy model as W');
  e.guest_write8(inputA, 'X'.charCodeAt(0));
  const outA = alloc(8);
  const getInfoA = menuItemInfo({ mask: MIIM_STRING, text: outA, cch: 8 });
  assert.strictEqual(e.test_menu_get_info_a(menu, 0, 1, getInfoA), 1);
  assert.strictEqual(readA(outA, 8), 'Owned',
    'the stored ANSI label does not alias the caller buffer');
  assert.strictEqual(e.test_menu_destroy(menu), 1);
  assert.strictEqual(e.test_heap_free_contains(ownedA), 1,
    'DestroyMenu releases every owned item string before the MNUD record');

  console.log('A/W MENUITEMINFO ownership tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
