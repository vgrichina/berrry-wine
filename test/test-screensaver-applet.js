#!/usr/bin/env node
'use strict';
// Small compiled fixture: real applet WAT, observable host/control doubles.
// This does not qualify the real renderer, native controls or saver gameplay.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('../tools/watx');
const { APPS, DESKTOP_APPS } = require('../lib/apps');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/09ca-screensavers.wat'), 'utf8');
const signatures = {
  host_check_input: [0, 1], host_check_input_hwnd: [1, 1],
  host_check_input_wparam: [0, 1], host_check_input_lparam: [0, 1],
  gs32: [2, 0], msg_store_input_tail: [4, 0], message_mouse_activate32: [1, 1],
  strlen: [1, 1], wat_str_to_heap: [2, 1], wnd_send_message: [4, 1],
  heap_free: [1, 0], heap_alloc: [1, 1], wnd_table_set: [2, 0],
  wnd_set_style: [2, 1], ctrl_table_set: [3, 0], wnd_table_find: [1, 1],
  host_create_window: [8, 1], title_table_set: [3, 0], nc_flags_set: [2, 0],
  defwndproc_do_nccalcsize: [1, 0], dlg_fill_bkgnd: [1, 0],
  defwndproc_do_ncpaint: [1, 0], gdi_dc_set_field: [4, 1],
  ctrl_create_child: [9, 1], set_focus: [1, 0], host_shell_execute: [6, 1],
  host_erase_background: [2, 1], wnd_destroy_tree: [1, 0],
  host_destroy_window: [1, 0], g2w: [1, 1], post_queue_base: [0, 1],
  shared_post_queue_read: [2, 1], gl32: [1, 1],
  paint_drain_native_control_paints: [0, 1], paint_select_next_dirty: [0, 1],
  paint_flag_clear_hwnd: [1, 0], paint_seed_child_paints: [1, 1],
  update_validate_rect: [5, 1],
};
async function fixture(text = source, options = {}) {
  const imports = Object.entries(signatures).map(([name, [n, r]]) =>
    `(import "fixture" "${name}" (func $${name} ${n ? `(param ${'i32 '.repeat(n)})` : ''} ${r ? '(result i32)' : ''}))`).join('\n');
  const result = compile(`
    ${imports}
    (memory 4)
    (export "memory" (memory 0))
    (region.declare-fixed $SCRSAVE_TEXT (base 0x1000) (size 4096) (align 16))
    (global $next_hwnd (mut i32) (i32.const 100))
    (global $WNDPROC_CTRL_NATIVE i32 (i32.const -65535))
    (global $quit_flag (mut i32) (i32.const 0))
    (global $focus_hwnd (mut i32) (i32.const 0))
    (global $post_queue_count (mut i32) (i32.const 0))
    ${text}
    (func (export "field") (param i32 i32) (result i32)
      (call $scrsave_field (local.get 0) (local.get 1)))
    (func (export "message") (param i32 i32 i32 i32) (result i32)
      (call $scrsave_wndproc (local.get 0) (local.get 1) (local.get 2) (local.get 3)))
    (func (export "posts") (param i32) (global.set $post_queue_count (local.get 0)))
  `, new Map(), { standardWat: true, runtimeBuiltins: false, tailCalls: true });
  assert.ok(result.success, result.error);
  let e, heap = 0x10000, child = 200, selected = -1, reads = 0;
  const controls = new Map(), launches = [], freed = [], destroyed = [], list = [];
  const str = p => { const b = new Uint8Array(e.memory.buffer); let end = p; while (b[end]) end++; return Buffer.from(b.slice(p, end)).toString('latin1'); };
  const mem = () => new DataView(e.memory.buffer);
  const host = {
    host_check_input: () => 0,
    host_check_input_hwnd() { throw Error('no input'); },
    host_check_input_wparam() { throw Error('no input'); },
    host_check_input_lparam() { throw Error('no input'); },
    gs32() { throw Error('no input'); }, msg_store_input_tail() { throw Error('no input'); },
    message_mouse_activate32() { throw Error('no input'); },
    strlen: p => str(p).length, wat_str_to_heap: p => p,
    heap_alloc: n => { if (options.oom) return 0; const p = heap; heap += n; return p; },
    heap_free: p => freed.push(p), wnd_table_set() {}, wnd_set_style: () => 1,
    ctrl_table_set: (h, c) => assert.equal(c, 35), wnd_table_find: h => h,
    host_create_window: (hwnd, style, x, y, w, h, title) => {
      assert.deepEqual([x, y, w, h, str(title)], [64, 48, 468, 322, 'Screen Savers']);
      return options.createFailure ? 0 : 1;
    }, title_table_set() {}, nc_flags_set() {},
    defwndproc_do_nccalcsize() {}, dlg_fill_bkgnd() {}, defwndproc_do_ncpaint() {},
    gdi_dc_set_field: () => 1,
    ctrl_create_child: (parent, cls, id, x, y, w, h, style, text) => {
      const hwnd = child++; controls.set(hwnd, { parent, cls, id, text: text ? str(text) : '', x, y, w, h, style }); return hwnd;
    },
    set_focus() {}, host_shell_execute: (h, op, file) => { launches.push(str(file)); return options.shellFailure ? 2 : 33; },
    host_erase_background: () => 1, wnd_destroy_tree: h => destroyed.push(h),
    host_destroy_window() {}, g2w: p => p, post_queue_base: () => 0x8000,
    shared_post_queue_read: () => { reads++; return 0; }, gl32: p => mem().getUint32(p, true),
    paint_drain_native_control_paints: () => 0, paint_select_next_dirty: () => 0,
    paint_flag_clear_hwnd() {}, paint_seed_child_paints: () => 0, update_validate_rect: () => 1,
    wnd_send_message: (h, msg, wp, lp) => {
      if (h === e.scrsave_window()) return e.message(h, msg, wp, lp);
      if (msg === 0x180) { list.push(str(lp)); return list.length - 1; }
      if (msg === 0x186) { selected = wp; return wp; }
      if (msg === 0x188) return selected;
      if (msg === 0xc) { controls.get(h).text = str(lp); return 1; }
      throw Error(`Unexpected fixture message ${msg}`);
    },
  };
  ({ exports: e } = await WebAssembly.instantiate(new WebAssembly.Module(result.wasmBinary), { fixture: host }));
  return { e, str, controls, launches, freed, destroyed, list, select: n => { selected = n; },
    reads: () => reads,
    post: (msg, wp, count = 1) => {
      for (let i = 0; i < count; i++) [e.scrsave_window(), msg, wp, 0].forEach((v, j) => mem().setUint32(0x8000 + i * 16 + j * 4, v, true));
      e.posts(count);
    } };
}
async function exercise(text) {
  const f = await fixture(text), { e } = f;
  assert.equal(e.scrsave_count(), 19);
  const files = [];
  for (let i = 0; i < 19; i++) {
    for (let j = 0; j < 4; j++) {
      const p = e.field(i, j); assert.ok(p >= 0x1000 && p < 0x1c00); assert.ok(f.str(p));
    }
    files.push(f.str(e.field(i, 1)));
  }
  assert.equal(new Set(files).size, 19);
  for (const file of files) assert.equal(Object.values(APPS).filter(a => a.exe && a.exe.split('/').pop().toUpperCase() === file).length, 1);
  for (const [i, j] of [[19, 0], [-1, 0], [0, 4], [0, -1]]) assert.equal(e.field(i, j), 0);
  assert.equal(e.wat_app_pump(), 0);
  const hwnd = e.scrsave_open(); assert.ok(hwnd);
  assert.equal(e.scrsave_open(), hwnd);
  assert.equal(f.list.length, 19);
  assert.ok([...f.controls.values()].some(c => c.id === 0x500 && c.cls === 4));
  assert.ok([...f.controls.values()].some(c => c.id === 1 && c.text === 'Preview'));
  assert.ok([...f.controls.values()].some(c => c.id === 2 && c.text === 'Close'));
  assert.deepEqual(f.list, Array.from({ length: 19 }, (_, i) => f.str(e.field(i, 0))));
  f.select(18); f.post(0x111, 0x10500); assert.equal(e.wat_app_pump(), 1);
  assert.ok([...f.controls.values()].some(c => c.text === files[18]));
  f.post(0x111, 1); assert.equal(e.wat_app_pump(), 1);
  assert.deepEqual(f.launches, [files[18]]);
  f.select(-1); f.post(0x111, 1); e.wat_app_pump(); assert.equal(f.launches.length, 1);
  f.select(0); f.post(0x111, 0x20500); e.wat_app_pump(); assert.equal(f.launches[1], files[0]);
  f.post(0x111, 1, 64); e.wat_app_pump(); assert.equal(f.launches.length, 66);
  const reads = f.reads();
  f.post(0x111, 2); assert.equal(e.wat_app_pump(), 0);
  assert.equal(f.reads(), reads, 'Close stops before reusing freed MSG');
  assert.equal(e.scrsave_window(), 0); assert.equal(e.wat_app_pump(), 0);
  assert.deepEqual(f.destroyed, [hwnd]); assert.ok(f.freed.includes(0x10000));
  return files;
}
async function main() {
  assert.equal(APPS.screensavers.watApp, 'scrsave'); assert.ok(!APPS.screensavers.exe);
  assert.ok(DESKTOP_APPS.some(a => a[0] === 'screensavers'));
  await exercise(source);
  for (const options of [{ oom: true }, { createFailure: true }]) {
    const f = await fixture(source, options);
    assert.equal(f.e.scrsave_open(), 0); assert.equal(f.e.wat_app_pump(), 0);
  }
  const failure = await fixture(source, { shellFailure: true });
  failure.e.scrsave_open(); failure.post(0x111, 1); failure.e.wat_app_pump();
  assert.equal(failure.e.scrsave_last_launched(), 0, 'failed launch is not reported as started');
  failure.e.message(failure.e.scrsave_window(), 0xa1, 20, 0);
  assert.equal(failure.e.wat_app_pump(), 0, 'titlebar Close follows SC_CLOSE and WM_CLOSE');
  for (const [label, before, after] of [
    ['wrong Preview selection', '(call $scrsave_preview (local.get $sel))', '(call $scrsave_preview (i32.const 0))'],
    ['lost local queue', '(if (global.get $post_queue_count)', '(if (i32.const 0)'],
    ['dead Close', '(then (call $scrsave_close) (return (i32.const 0)))', '(then (return (i32.const 0)))'],
  ]) {
    assert.ok(source.includes(before));
    await assert.rejects(() => exercise(source.replaceAll(before, after)), undefined, label);
  }
  console.log('PASS compiled applet: catalog/registry bounds, selection, queued Preview, double-click, 64-post bound, Close; 3 mutation controls rejected');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { signatures };
