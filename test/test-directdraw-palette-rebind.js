#!/usr/bin/env node
'use strict';

// Real COM handlers, canonical compiled module, host imports and deferred
// canvas presentation. Palette changes must repaint an already visible DIB.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const calls = {
  create: ['IDirectDraw_CreateSurface', 4],
  palette: ['IDirectDraw_CreatePalette', 5],
  attach: ['IDirectDrawSurface_SetPalette', 2],
  entries: ['IDirectDrawPalette_SetEntries', 5],
};
const extraWat = Object.entries(calls).map(([name, [handler, argc]]) => `
  (func (export "pr_${name}") ${Array.from({ length: argc }, (_, i) => `(param $a${i} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_${handler} ${Array.from({ length: 6 }, (_, i) => i < argc ? `(local.get $a${i})` : '(i32.const 0)').join(' ')})
    (i32.load (global.get $reg_base)))`).join('\n') + String.raw`
  (func (export "pr_seed") (result i32)
    (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
    (global.set $DX_VTBL_DDSURF2 (i32.const 0x52000000))
    (global.set $DX_VTBL_DDPAL (i32.const 0x53000000))
    (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
  (func (export "pr_bits") (param $s i32) (result i32)
    (load.field DxObject misc1 (call $dx_from_this (local.get $s))))
  (func (export "pr_refs") (param $p i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $p))))
  (func (export "pr_present") (param $s i32)
    (call $dx_present (call $dx_from_this (local.get $s))))
`;

(async () => {
  let presents = 0;
  const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 32, height: 32, beforeInstantiate(ctx, host) {
    const trace = host.dx_trace;
    host.dx_trace = (...args) => { if (args[0] === 5) presents++; return trace(...args); };
  } });
  const e = h.exports, bytes = new Uint8Array(h.memory.buffer);
  const checks = [];
  const check = (name, actual, expected) => {
    try { assert.deepStrictEqual(actual, expected); checks.push({ name, pass: true }); }
    catch { checks.push({ name, pass: false, actual, expected }); }
  };
  const ok = value => assert.strictEqual(value >>> 0, 0, 'COM call succeeds');
  const dd = e.pr_seed();
  const desc = 0x410000, out = 0x410200, input = 0x411000;
  const hwnd = 0x10001;
  h.renderer.createWindow(hwnd, 0x10000000, 0, 0, 32, 32, 'Palette rebind', 0);
  e.wnd_table_set(hwnd, 0);
  e.ctrl_set_geom(hwnd, 0, 0, 32, 32);
  e.wnd_set_style_export(hwnd, 0x10000000);
  e.test_gdi_client_rect_set(hwnd, 0, 0, 32, 32);
  e.test_dx_set_process_state(32, 32, 8, 1, hwnd, 1, 0);
  const surface = caps => {
    for (let i = 0; i < 128; i += 4) e.guest_write32(desc + i, 0);
    for (const [offset, value] of [[0, 108], [4, 0x1007], [8, 32], [12, 32],
      [72, 32], [76, 0x60], [84, 8], [104, caps]]) e.guest_write32(desc + offset, value);
    ok(e.pr_create(dd, desc, out, 0));
    return e.guest_read32(out) >>> 0;
  };
  const primary = surface(0x200), offscreen = surface(0x40);
  const palette = words => {
    for (let i = 0; i < 256; i++) e.guest_write32(input + i * 4, 0);
    words.forEach((v, i) => e.guest_write32(input + (17 + i) * 4, v));
    ok(e.pr_palette(dd, 4, input, out, 0));
    return e.guest_read32(out) >>> 0;
  };
  const a = palette([0x00332211, 0x00665544, 0x00998877]);
  const b = palette([0x001ec80a, 0x0028b414, 0x0032a01e]);
  const bits = e.pr_bits(primary) >>> 0;
  // Frozen literal indices and expected RGBA, including an untouched entry.
  bytes.set([17, 18, 19, 17], bits);
  const originalBits = Array.from(bytes.slice(bits, bits + 1024));
  const aColors = [17, 34, 51, 255, 68, 85, 102, 255, 119, 136, 153, 255, 17, 34, 51, 255];
  const bColors = [10, 200, 30, 255, 20, 180, 40, 255, 30, 160, 50, 255, 10, 200, 30, 255];
  const updatedColors = [201, 31, 41, 255, 51, 61, 211, 255, 30, 160, 50, 255, 201, 31, 41, 255];
  const pixels = () => {
    h.renderer.repaint();
    return Array.from(h.canvas.getContext('2d').getImageData(0, 0, 4, 1).data);
  };
  ok(e.pr_attach(primary, a));
  e.pr_present(primary);
  check('initial primary colors', pixels(), aColors);
  const before = presents;
  ok(e.pr_attach(offscreen, b));
  check('offscreen attachment does not present', presents - before, 0);
  check('offscreen attachment preserves display', pixels(), aColors);
  ok(e.pr_attach(primary, b));
  check('replacement palette recolors retained canvas', pixels(), bColors);
  check('replacement palette presents once', presents - before, 1);
  check('replacement owns references on both surfaces', [e.pr_refs(a), e.pr_refs(b)], [1, 3]);
  const afterBind = presents;
  ok(e.pr_attach(primary, b));
  check('same-object attach does not present', presents - afterBind, 0);
  e.guest_write32(input, 0x00291fc9);
  e.guest_write32(input + 4, 0x00d33d33);
  const bBefore = Array.from(bytes.slice(e.pr_bits(b), e.pr_bits(b) + 1024));
  ok(e.pr_entries(b, 0, 17, 2, input));
  check('nonzero partial span recolors retained canvas', pixels(), updatedColors);
  check('partial span presents once', presents - afterBind, 1);
  const expectedPalette = bBefore.slice();
  expectedPalette.splice(68, 8, 201, 31, 41, 0, 51, 61, 211, 0);
  check('partial span leaves every other palette byte untouched', Array.from(bytes.slice(e.pr_bits(b), e.pr_bits(b) + 1024)), expectedPalette);
  const afterUpdate = presents;
  ok(e.pr_attach(offscreen, 0));
  ok(e.pr_attach(offscreen, a));
  check('offscreen detach/rebind does not present', presents - afterUpdate, 0);
  check('offscreen detach/rebind preserves displayed colors', pixels(), updatedColors);
  ok(e.pr_attach(primary, a));
  check('rebind original palette restores its colors', pixels(), aColors);
  check('rebind restores reference ownership', [e.pr_refs(a), e.pr_refs(b)], [3, 1]);
  check('all indexed pixels remain untouched', Array.from(bytes.slice(bits, bits + 1024)), originalBits);
  console.log(JSON.stringify({ checks, passed: checks.filter(c => c.pass).length, total: checks.length }, null, 2));
  assert(checks.every(c => c.pass), 'DirectDraw palette rebind checks');
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
