#!/usr/bin/env node

'use strict';

// A menu LoadMenu() returned but nobody attached to a window is still a real
// HMENU on Win32. Ours used to answer -1 / 0 / -1 to GetMenuItemCount,
// GetSubMenu and GetMenuItemID for one, because every menu query resolved the
// handle by finding the window that owns it.
//
// That is not a cosmetic gap. MFC keeps CMultiDocTemplate::m_hMenuShared
// unattached and scans it for the MRU id block with
//
//     for (i = GetMenuItemCount(hMenu) - 1; i != 0; i--)
//
// so a -1 count starts the loop at -2 and counts down through four billion
// iterations. Measured on SimCity 2000's "Load Demo City": 21.3M block
// entries in the three blocks at simdemo+0x4a4993, 93% of all work in the
// run, 23M Win32 calls -- an app that looks hung rather than slow.
//
// The fix materializes such a handle as an ordinary dynamic (MNUD) menu built
// from its RT_MENU template. This test drives that builder over a template it
// writes itself, then asks the same public queries the guest asks.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_cache_menu") (param $id i32) (param $root i32)
    (local $node i32) (local $w i32)
    (local.set $node (call $heap_alloc (i32.const 12)))
    (local.set $w (call $g2w (local.get $node)))
    (i32.store (local.get $w) (global.get $detached_menus))
    (i32.store offset=4 (local.get $w) (local.get $id))
    (i32.store offset=8 (local.get $w) (local.get $root))
    (global.set $detached_menus (local.get $node)))
  (func (export "test_dynamic_alive") (param $h i32) (result i32)
    (i32.ne (call $dynamic_menu_state_w (local.get $h)) (i32.const 0)))
  (func (export "test_menu_alloc") (param $len i32) (result i32)
    (call $heap_alloc (local.get $len)))

  (func (export "test_menu_g2w") (param $guest i32) (result i32)
    (call $g2w (local.get $guest)))

  ;; Build a dynamic menu from a UTF-16 MENUITEMTEMPLATE body the caller has
  ;; written into guest memory -- the same walk $menu_detached_build runs once
  ;; it has resolved the RT_MENU bytes.
  (func (export "test_menu_detached_level")
      (param $items_g i32) (param $len i32) (result i32)
    (local $h i32)
    (global.set $ml_char_stride (i32.const 2))
    (global.set $ml_pos (call $g2w (local.get $items_g)))
    (global.set $ml_end (i32.add (call $g2w (local.get $items_g)) (local.get $len)))
    (local.set $h (call $dynamic_menu_create))
    (if (i32.eqz (local.get $h)) (then (return (i32.const 0))))
    (call $menu_detached_level (local.get $h))
    (local.get $h))

  ;; $menu_handle_submenu is internal (GetSubMenu's handler calls it).
  (func (export "test_menu_submenu") (param $hmenu i32) (param $pos i32) (result i32)
    (call $menu_handle_submenu (local.get $hmenu) (local.get $pos)))

  ;; The tagged-handle route, unresolvable here because no PE is loaded.
  (func (export "test_menu_detached_handle") (param $hmenu i32) (result i32)
    (call $menu_detached_handle (local.get $hmenu)))
  ;; SetMenu's lookup: an alias that already exists, never a new build.
  (func (export "test_menu_detached_existing") (param $hmenu i32) (result i32)
    (call $menu_detached_existing (local.get $hmenu)))

  (func (export "test_menu_get_info_a")
      (param $hmenu i32) (param $item i32) (param $bypos i32) (param $mii i32)
      (result i32)
    (call $handle_GetMenuItemInfoA
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
`;

// --- MENUITEMTEMPLATE body (no MENUHEADER; the harness entry starts at the
// first item). Labels are UTF-16, as a PE resource stores them.
const MF_GRAYED = 0x0001;
const MF_POPUP = 0x0010;
const MF_END = 0x0080;
const MF_SEPARATOR = 0x0800;

function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xffff, 0); return b; }
function wstr(s) {
  const b = Buffer.alloc((s.length + 1) * 2);
  for (let i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), i * 2);
  return b;
}
function popup(label, ...children) {
  return Buffer.concat([u16(MF_POPUP), wstr(label), ...children]);
}
function popupEnd(label, ...children) {
  return Buffer.concat([u16(MF_POPUP | MF_END), wstr(label), ...children]);
}
function item(flags, id, label) {
  return Buffer.concat([u16(flags), u16(id), wstr(label)]);
}

const template = Buffer.concat([
  popup('File',
    item(0, 100, 'New'),
    item(MF_SEPARATOR, 0, ''),
    popup('Recent',
      item(MF_END, 0xe130, 'democity.sc2')),
    item(MF_END | MF_GRAYED, 101, 'Exit')),
  popupEnd('Help',
    item(MF_END, 200, 'About')),
]);

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });

  const guest = e.test_menu_alloc(template.length);
  assert.ok(guest, 'heap_alloc for the template failed');
  // Place the bytes through the instance's own translation rather than
  // assuming where GUEST_BASE landed -- the region map is allocated.
  new Uint8Array(memory.buffer).set(template, e.test_menu_g2w(guest));

  const hmenu = e.test_menu_detached_level(guest, template.length);
  check('built a dynamic menu from the template', hmenu !== 0, `hmenu=0x${(hmenu >>> 0).toString(16)}`);

  const barCount = e.menu_handle_item_count(hmenu);
  check('bar count is the two top-level popups, never negative',
    barCount === 2, `got ${barCount}`);

  const file = e.test_menu_submenu(hmenu, 0);
  check('GetSubMenu(0) hands back a real child HMENU', file !== 0,
    `got 0x${(file >>> 0).toString(16)}`);
  check('the File popup has its four items',
    e.menu_handle_item_count(file) === 4, `got ${e.menu_handle_item_count(file)}`);

  check('command item keeps its id', e.menu_handle_item_id(file, 0) === 100,
    `got ${e.menu_handle_item_id(file, 0)}`);
  check('separator reports no command id', e.menu_handle_item_id(file, 1) === -1,
    `got ${e.menu_handle_item_id(file, 1)}`);
  check('a popup position reports no command id', e.menu_handle_item_id(file, 2) === -1,
    `got ${e.menu_handle_item_id(file, 2)}`);
  check('MF_END is a template terminator, not a reported item',
    e.menu_handle_item_id(file, 3) === 101, `got ${e.menu_handle_item_id(file, 3)}`);
  check('past the end is still -1', e.menu_handle_item_id(file, 4) === -1,
    `got ${e.menu_handle_item_id(file, 4)}`);

  // This is the id block MFC scans for; nesting must survive the walk.
  const recent = e.test_menu_submenu(file, 2);
  check('the nested cascade is reachable', recent !== 0,
    `got 0x${(recent >>> 0).toString(16)}`);
  check('the cascade holds its one MRU entry',
    e.menu_handle_item_count(recent) === 1, `got ${e.menu_handle_item_count(recent)}`);
  check('the MRU id survives the rebuild', e.menu_handle_item_id(recent, 0) === 0xe130,
    `got 0x${(e.menu_handle_item_id(recent, 0) >>> 0).toString(16)}`);

  const help = e.test_menu_submenu(hmenu, 1);
  check('the MF_END popup is built too', help !== 0 &&
    e.menu_handle_item_count(help) === 1 && e.menu_handle_item_id(help, 0) === 200,
    `help=0x${(help >>> 0).toString(16)}`);

  // A handle whose template cannot be read stays invalid: no PE is loaded in
  // this harness, so nothing resolves, and the old answers must come back
  // rather than a fabricated empty menu.
  check('an unresolvable tagged handle stays invalid',
    e.test_menu_detached_handle(0x00be0003) === 0 &&
    e.menu_handle_item_count(0x00be0003) === -1,
    `count=${e.menu_handle_item_count(0x00be0003)}`);
  check('a handle with no resource tag is not claimed',
    e.test_menu_detached_handle(0x00040003) === 0);

  // Seed the same alias record installed after lazy resource resolution.
  // The tree itself came from the real MENUITEMTEMPLATE parser above.
  e.test_cache_menu(101, hmenu);
  check('detached alias resolves to the existing canonical tree',
    e.test_menu_detached_handle(0xbe0065) === hmenu);
  check('SetMenu finds the existing alias without building one',
    e.test_menu_detached_existing(0xbe0065) === hmenu &&
    e.test_menu_detached_existing(0xbe0003) === 0 &&
    e.test_menu_detached_existing(0x00040065) === 0);

  // Unreal's Window.dll localizes a LoadMenu handle before SetMenu: it reads
  // each item with GetMenuItemInfoA(MIIM_SUBMENU|MIIM_TYPE) and writes back
  // labels that start with "ID_". Both calls must reach the alias's tree.
  const mem = () => new Uint8Array(memory.buffer);
  const miiG = e.test_menu_alloc(44);
  const bufG = e.test_menu_alloc(64);
  const writeMii = (mask, typeData, cch) => {
    const view = new DataView(memory.buffer, e.test_menu_g2w(miiG), 44);
    for (let i = 0; i < 44; i += 4) view.setUint32(i, 0, true);
    view.setUint32(0, 44, true);          // cbSize
    view.setUint32(4, mask, true);        // fMask
    view.setUint32(36, typeData, true);   // dwTypeData
    view.setUint32(40, cch, true);        // cch
  };
  const readMii = off => new DataView(memory.buffer, e.test_menu_g2w(miiG), 44).getUint32(off, true);
  const readStr = g => {
    const w = e.test_menu_g2w(g); let s = '';
    for (let i = 0; mem()[w + i]; i++) s += String.fromCharCode(mem()[w + i]);
    return s;
  };
  writeMii(0x14, bufG, 64);
  check('GetMenuItemInfoA reads an unattached LoadMenu handle',
    e.test_menu_get_info_a(0xbe0065, 0, 1, miiG) === 1 &&
    readStr(bufG) === 'File' && readMii(20) === file,
    `text="${readStr(bufG)}" hSubMenu=0x${(readMii(20) >>> 0).toString(16)}`);
  const labelG = e.test_menu_alloc(8);
  mem().set(Buffer.from('&Datei\0', 'latin1'), e.test_menu_g2w(labelG));
  writeMii(0x10, labelG, 0);
  check('SetMenuItemInfoA renames an item through the alias',
    e.test_menu_set_info_a(0xbe0065, 0, 1, miiG) === 1);
  writeMii(0x10, bufG, 64);
  check('the renamed label is what the canonical tree now holds',
    e.test_menu_get_info_a(hmenu, 0, 1, miiG) === 1 && readStr(bufG) === '&Datei',
    `text="${readStr(bufG)}"`);
  check('DestroyMenu accepts the detached alias', e.test_call_DestroyMenu(0xbe0065) === 1);
  for (const [name, handle] of [['root', hmenu], ['File', file], ['Recent', recent], ['Help', help]]) {
    check(`DestroyMenu retires ${name}`, e.test_dynamic_alive(handle) === 0);
  }
  check('destroyed alias cannot retrieve stale cached state',
    e.test_menu_detached_handle(0xbe0065) === 0);

  const fresh = e.test_menu_detached_level(guest, template.length);
  e.test_cache_menu(102, fresh);
  check('destroying the canonical root also retires its alias',
    e.test_call_DestroyMenu(fresh) === 1 && e.test_menu_detached_handle(0xbe0066) === 0);

  const cycle = e.test_call_CreatePopupMenu();
  e.test_call_AppendMenuA(cycle, 0x10, cycle, 0);
  check('recursive destruction safely retires a malformed self-link',
    e.test_call_DestroyMenu(cycle) === 1 && e.test_dynamic_alive(cycle) === 0);

  const failed = checks.filter(c => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
