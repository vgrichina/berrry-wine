#!/usr/bin/env node
'use strict';

// MFC property sheets built on the builtin COMCTL32 depend on three things
// the real DLL provides and the WAT sheet used to lack (GTA2 Demo Manager
// showed only Back/Next/Cancel over an empty page):
//   1. AfxGetPropSheetFont reads the sheet font from COMCTL32's own
//      RT_DIALOG 1006 (IDD_PROPSHEET) / 1020 (IDD_WIZARD) through the module
//      handle; a miss leaves an uninitialized point size on every page.
//   2. AfxHookWindowCreate attaches each CWnd from WH_CBT HCBT_CREATEWND;
//      without it the page's OnInitDialog never runs.
//   3. Win98 sizes the page area to the largest page template.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const IMAGE_BASE = 0x400000;
const RSRC_RVA = 0x16000;
const DATA_RVA = 0x17000;

const extraWat = String.raw`
  (func (export "test_comctl32_module") (result i32)
    (local $i i32)
    (loop $scan
      (if (call $str_eq (call $static_sys_dll_name_at (local.get $i)) "comctl32")
        (then (return (call $static_sys_dll_ensure_locked (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 64))))
    (i32.const 0))

  (func (export "test_FindResourceA") (param $mod i32) (param $name i32) (param $type i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (call $w2g (region.addr $GUEST_STACK 524288)))
    (call $handle_FindResourceA (local.get $mod) (local.get $name) (local.get $type)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_LoadResource") (param $mod i32) (param $res i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (call $w2g (region.addr $GUEST_STACK 524288)))
    (call $handle_LoadResource (local.get $mod) (local.get $res)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_install_cbt") (param $proc i32) (result i32)
    (call $install_supported_hook (i32.const 5) (local.get $proc)))

  (func (export "test_PropertySheetA") (param $header i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (call $w2g (region.addr $GUEST_STACK 524288)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00401000))
    (call $handle_PropertySheetA
      (local.get $header) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $modal_dlg_hwnd))
  (func (export "test_PropertySheet_done")
    (call $modal_done (i32.const 0)))
  (func (export "test_propsheet_page_hwnd") (result i32)
    (global.get $propsheet_page_hwnd))
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: e, memory, renderer } = harness;
  const bytes = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const wasm = guest => e.guest_to_wasm(guest) >>> 0;
  e.init_thread(1, IMAGE_BASE, 0, 0, 0, 0, 0, RSRC_RVA);
  const le32 = value => [value, value >>> 8, value >>> 16, value >>> 24].map(b => b & 0xFF);

  // 1. COMCTL32's stock sheet templates are reachable through its handle.
  const comctl = e.test_comctl32_module() >>> 0;
  assert(comctl, 'the builtin COMCTL32 module has an image');
  for (const [id, cx, cy] of [[1006, 220, 140], [1020, 290, 46]]) {
    const hrsrc = e.test_FindResourceA(comctl, id, 5) >>> 0;
    assert(hrsrc, `FindResourceA(COMCTL32, ${id}, RT_DIALOG) finds the stock template`);
    const tmpl = e.test_LoadResource(comctl, hrsrc) >>> 0;
    assert(tmpl, `LoadResource yields template ${id}`);
    const wa = wasm(tmpl);
    const style = dv.getUint32(wa, true);
    assert(style & 0x40, `template ${id} carries DS_SETFONT`);
    assert.deepStrictEqual([dv.getInt16(wa + 14, true), dv.getInt16(wa + 16, true)], [cx, cy]);
    // menu, class, empty title, then point size and face.
    let p = wa + 18;
    for (let i = 0; i < 3; i++) {
      if (dv.getUint16(p, true) === 0xFFFF) p += 4;
      else { while (dv.getUint16(p, true)) p += 2; p += 2; }
    }
    assert.strictEqual(dv.getUint16(p, true), 8, `template ${id} is 8 point`);
    let face = '';
    for (p += 2; dv.getUint16(p, true); p += 2) face += String.fromCharCode(dv.getUint16(p, true));
    assert.strictEqual(face, 'MS Sans Serif');
  }

  // A tall page template (100x300 DLU) in the app's own resources.
  const root = wasm(IMAGE_BASE + RSRC_RVA);
  dv.setUint16(root + 14, 1, true);
  dv.setUint32(root + 16, 5, true);
  dv.setUint32(root + 20, 0x80000020, true);
  dv.setUint16(root + 0x20 + 14, 1, true);
  dv.setUint32(root + 0x30, 101, true);
  dv.setUint32(root + 0x34, 0x80000040, true);
  dv.setUint16(root + 0x40 + 14, 1, true);
  dv.setUint32(root + 0x50, 0x0409, true);
  dv.setUint32(root + 0x54, 0x60, true);
  dv.setUint32(root + 0x60, DATA_RVA, true);
  dv.setUint32(root + 0x64, 64, true);
  const tmpl = wasm(IMAGE_BASE + DATA_RVA);
  dv.setUint32(tmpl, 0x50000000, true);
  dv.setUint16(tmpl + 8, 0, true);
  [0, 0, 100, 300].forEach((v, i) => dv.setInt16(tmpl + 10 + i * 2, v, true));

  const dlgProc = e.guest_alloc(16) >>> 0;
  bytes.set([0xB8, 0x01, 0, 0, 0, 0xC2, 0x10, 0x00], wasm(dlgProc));

  // 2. A WH_CBT proc that logs (nCode, wParam) pairs and returns 0.
  const log = e.guest_alloc(4 + 16 * 8) >>> 0;
  e.guest_write32(log, 0);
  const cbt = e.guest_alloc(64) >>> 0;
  bytes.set([
    0x8B, 0x0D, ...le32(log),               // mov ecx,[count]
    0x8B, 0x44, 0x24, 0x04,                 // mov eax,[esp+4]  nCode
    0x89, 0x04, 0xCD, ...le32(log + 4),     // mov [log+4+ecx*8],eax
    0x8B, 0x44, 0x24, 0x08,                 // mov eax,[esp+8]  wParam
    0x89, 0x04, 0xCD, ...le32(log + 8),     // mov [log+8+ecx*8],eax
    0x41,                                   // inc ecx
    0x89, 0x0D, ...le32(log),               // mov [count],ecx
    0x31, 0xC0,                             // xor eax,eax
    0xC2, 0x0C, 0x00,                       // ret 12
  ], wasm(cbt));
  assert(e.test_install_cbt(cbt), 'WH_CBT installs');

  const page = e.guest_alloc(40) >>> 0;
  for (let o = 0; o < 40; o += 4) e.guest_write32(page + o, 0);
  e.guest_write32(page, 40);
  e.guest_write32(page + 8, IMAGE_BASE);
  e.guest_write32(page + 12, 101);
  e.guest_write32(page + 24, dlgProc);
  const header = e.guest_alloc(36) >>> 0;
  for (let o = 0; o < 36; o += 4) e.guest_write32(header + o, 0);
  e.guest_write32(header, 36);
  e.guest_write32(header + 4, 0x08); // PSH_PROPSHEETPAGE
  e.guest_write32(header + 24, 1);
  e.guest_write32(header + 32, page);

  const frame = e.test_PropertySheetA(header) >>> 0;
  assert(frame, 'PropertySheetA creates the sheet');
  const pageHwnd = e.test_propsheet_page_hwnd() >>> 0;
  assert(pageHwnd, 'the first page is created');
  const entries = [];
  for (let i = 0; i < e.guest_read32(log); i++) {
    entries.push([e.guest_read32(log + 4 + i * 8), e.guest_read32(log + 8 + i * 8) >>> 0]);
  }
  assert.deepStrictEqual(entries.filter(([code]) => code === 3).map(([, hwnd]) => hwnd),
    [frame, pageHwnd],
    'HCBT_CREATEWND reaches the WH_CBT chain for the sheet frame, then the page');

  // 3. The page area grows to the 300 DLU page, (300*13+4)/8 = 488 px, and
  // the frame adds the 10 px margins plus the 72 px button band.
  const win = renderer.windows[frame];
  assert.deepStrictEqual([win.w, win.h], [440, 488 + 82],
    'the sheet frame fits its tallest page template');
  e.test_PropertySheet_done();

  console.log('PASS  builtin property sheet serves MFC: COMCTL32 templates, CBT create, page sizing');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
