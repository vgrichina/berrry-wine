#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
// $DIB_BACKING_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

// Resolve GDI32 entrypoints and enter the public stdcall dispatcher. The only
// pixel oracle below is a solid, null-pen axis-aligned rectangle, COPY mode.
const polygonMappingWat = `
  (func (export "polygon_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "polygon_regs") (result i32) (global.get $reg_base))
  (func (export "polygon_module") (param i32) (result i32)
    (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
  (func (export "polygon_resolve") (param i32 i32) (result i32)
    (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
  (func (export "polygon_dispatch") (param i32)
    (global.set $eip (i32.const 0x456789ab))
    (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0)
      (global.get $thunk_guest_base)) (i32.const 3))))
  (func (export "polygon_lease") (param i32) (result i32)
    (call $guest_span_in (local.get 0) (i32.const 16380)))
  (func (export "polygon_release") (param i32)
    (call $guest_span_release (local.get 0) (i32.const 16380)))
  (func (export "polygon_protect") (param i32 i32 i32 i32) (result i32)
    (call $handle_VirtualProtect (local.get 0) (local.get 1) (local.get 2)
      (local.get 3) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
`;

async function polygonGuestMapping(options = {}) {
  const { bootRenderHarness } = require('./render-helper');
  const apiTable = require('../src/api_table.json');
  const h = await bootRenderHarness({ extraWat: polygonMappingWat, fonts: 'none', width: 16, height: 12 });
  const { exports: e, memory } = h;
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.polygon_init();
  e.set_api_log(0);
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const put = (p, b) => b.forEach((v, i) => e.guest_write8((p + i) >>> 0, v));
  const string = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); put(p, b); return p; };
  const frame = alloc(256), stack = frame + 64, regs = e.polygon_regs() >>> 0;
  const entries = new Map();
  for (const [dll, names] of [
    ['GDI32.DLL', ['Polygon', 'BeginPath', 'EndPath', 'FillPath', 'GetPath', 'AbortPath', 'SelectObject', 'CreateSolidBrush', 'DeleteObject']],
    ['USER32.DLL', ['GetDC', 'ReleaseDC']],
  ]) {
    dv.setUint32(regs + 16, stack, true);
    const module = e.polygon_module(string(dll)) >>> 0;
    assert(module);
    for (const name of names) {
      dv.setUint32(regs + 16, stack, true);
      const thunk = e.polygon_resolve(module, string(name)) >>> 0;
      const row = apiTable.find(r => r.name === name);
      assert(thunk && row, name);
      assert.strictEqual(row.convention, 'stdcall');
      assert.strictEqual(e.guest_read32(thunk + 4), row.id);
      entries.set(name, { thunk, nargs: row.nargs });
    }
  }
  let calls = 0, rows = 0;
  const failures = [];
  function call(name, args) {
    const { thunk, nargs } = entries.get(name);
    assert.strictEqual(args.length, nargs);
    mem.fill(0x6d, wa(frame), wa(frame) + 256);
    e.guest_write32(stack, 0x12345678);
    args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
    const before = mem.slice(wa(frame), wa(frame) + 256);
    const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
    seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
    e.polygon_dispatch(thunk);
    calls++;
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + nargs * 4, name + ' ESP');
    assert.strictEqual(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.strictEqual(dv.getUint32(regs + i * 4, true), seed[i], name + ' preserved register');
    assert.deepStrictEqual(mem.slice(wa(frame), wa(frame) + 256), before, name + ' entire stack');
    return e.get_eax() >>> 0;
  }
  const hwnd = 0x10001;
  h.renderer.createWindow(hwnd, 0x10000000, 0, 0, 16, 12, 'Polygon guest mapping', 0);
  e.wnd_table_set(hwnd, 0); e.ctrl_set_geom(hwnd, 0, 0, 16, 12);
  e.wnd_set_style_export(hwnd, 0x10000000); e.test_gdi_client_rect_set(hwnd, 0, 0, 16, 12);
  const dc = call('GetDC', [hwnd]); assert(dc);
  const brush = call('CreateSolidBrush', [0x0000ff00]); assert(brush);
  call('SelectObject', [dc, 0x30018]); // NULL_PEN
  call('SelectObject', [dc, brush]);
  const record = e.test_gdi_window_surface_record(hwnd) >>> 0;
  const bits = dv.getUint32(record + 16, true), stride = dv.getUint32(record + 20, true);
  assert(bits && stride); assert.strictEqual(dv.getUint32(record + 24, true), 32);
  const surface = Buffer.from(memory.buffer, bits, stride * 12);
  const direct = alloc(8192), adjacent = 0x31000000, split = 0x30000000;
  const decoys = [0x28000000, 0x29000000];
  for (const p of [split, ...decoys, split + 4096]) assert.strictEqual(e.test_virtual_map_commit(p, 4096) >>> 0, p);
  assert.strictEqual(e.test_virtual_map_commit(adjacent, 8192) >>> 0, adjacent);
  assert.strictEqual(wa(decoys[0]), wa(split) + 4096);
  assert.notStrictEqual(wa(split + 4096), wa(split) + 4096);
  assert.strictEqual(wa(adjacent + 4096), wa(adjacent) + 4096);
  const backing = [[wa(direct), 8192], [wa(adjacent), 8192], [wa(split), 4096],
    [wa(split + 4096), 4096], ...decoys.map(p => [wa(p), 4096]), [wa(0), 128]]
    .map(([p, n]) => Buffer.from(memory.buffer, p, n));
  const rectangle = Buffer.alloc(32);
  [2, 2, 10, 2, 10, 8, 2, 8].forEach((v, i) => rectangle.writeInt32LE(v, i * 4));
  const expected = Buffer.alloc(surface.length, 0x33);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 10; x++) {
    const p = y * stride + x * 4;
    expected[p] = 0; expected[p + 1] = 255; expected[p + 2] = 0; expected[p + 3] = 0;
  }
  const oldProtection = alloc(4);
  const pathPoints = alloc(32768), pathTypes = alloc(4096);
  function protect(p, n, mode) {
    // Fragmented pages are separate reservations; protect each reservation.
    for (let page = p & ~4095; page < p + n; page += 4096)
      assert.strictEqual(e.polygon_protect(page, 4096, mode, oldProtection), 1);
  }
  function query(p, pathMode, label, count = 4, wanted = 1, pixels = expected,
    input = count === 4 ? rectangle : null, readOnly = false, pathOnly = false) {
    rows++;
    backing.forEach((b, i) => b.fill(i === 6 ? 0 : 0x91 + i));
    if (p && input) put(p, input);
    if (readOnly) protect(p, input.length, 2); // PAGE_READONLY
    const before = backing.map(b => Buffer.from(b));
    surface.fill(0x33);
    if (pathMode) assert.strictEqual(call('BeginPath', [dc]), 1);
    const result = call('Polygon', [dc, p, count]);
    if (result !== wanted) failures.push({ label, kind: 'BOOL', result, wanted });
    if (pathMode) {
      assert(surface.every(v => v === 0x33), 'path recording must defer drawing');
      assert.strictEqual(call('EndPath', [dc]), 1);
      if (wanted && pathOnly) {
        assert.strictEqual(call('GetPath', [dc, pathPoints, pathTypes, count]), count);
        assert.deepStrictEqual(Buffer.from(mem.slice(wa(pathPoints), wa(pathPoints) + input.length)), input);
        const types = Buffer.alloc(count, 2); types[0] = 6; types[count - 1] |= 1;
        assert.deepStrictEqual(Buffer.from(mem.slice(wa(pathTypes), wa(pathTypes) + count)), types);
        assert.strictEqual(call('AbortPath', [dc]), 1);
      } else if (wanted) {
        const filled = call('FillPath', [dc]);
        if (filled !== 1) failures.push({ label, kind: 'FillPath BOOL', result: filled, wanted: 1 });
      }
      else assert.strictEqual(call('AbortPath', [dc]), 1);
    }
    if (!surface.equals(pixels)) failures.push({ label, kind: 'pixels', actual: surface.toString('hex') });
    backing.forEach((b, i) => assert.deepStrictEqual(b, before[i], label + ' entire input/decoy backing ' + i));
    if (readOnly) protect(p, input.length, 4);
    assert.strictEqual(e.guest_span_cursor_bytes(), 0);
    assert.strictEqual(e.guest_span_overflow_count(), 0);
  }
  // Every byte cut includes LONG fields split after bytes 1, 2 and 3;
  // direct and adjacent sparse pages are independent affine controls.
  for (const pathMode of [false, true]) for (const cut of [32, ...Array.from({ length: 31 }, (_, i) => i + 1)]) {
    for (const [label, p] of [['direct', direct], ['adjacent', adjacent], ['split', split]])
      query(p + 4096 - cut, pathMode, `${label}/cut${cut}/path${pathMode}`);
  }
  for (const pathMode of [false, true]) for (const p of [adjacent, split])
    query(p + 4093, pathMode, `read-only/${p}/path${pathMode}`, 4, 1, expected, rectangle, true);
  if (options.capture) options.capture(h.renderer.getWindowCanvas(hwnd).canvas.toBuffer('image/png'));
  const unchanged = Buffer.alloc(surface.length, 0x33);
  for (const pathMode of [false, true]) for (const count of [0, 1, -1, 2 ** 29, 0x40000000])
    query(split + 4093, pathMode, `invalid count ${count}/path${pathMode}`, count, 0, unchanged);
  // Null and wrapping arrays must not be turned into backing-store pointers.
  for (const pathMode of [false, true]) {
    query(0, pathMode, 'null empty', 0, 0, unchanged);
    query(0, pathMode, 'null points', 4, 0, unchanged);
    query(0xfffffff0, pathMode, 'address wrap', 4, 0, unchanged, null);
    query(split + 4093, pathMode, 'consumer count bound', pathMode ? 4097 : 209, 0, unchanged);
  }
  // A valid path may exceed the 16KB arena. Observe its complete POINT/type
  // output through GetPath, independently of the fill engine's count limit.
  const large = 0x33000000, largeDecoy = 0x34000000;
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(e.test_virtual_map_commit(large + i * 4096, 4096) >>> 0, large + i * 4096);
    assert.strictEqual(e.test_virtual_map_commit(largeDecoy + i * 4096, 4096) >>> 0, largeDecoy + i * 4096);
    backing.push(Buffer.from(memory.buffer, wa(large + i * 4096), 4096));
    backing.push(Buffer.from(memory.buffer, wa(largeDecoy + i * 4096), 4096));
  }
  const many = Buffer.concat(Array.from({ length: 513 }, () => rectangle));
  for (let i = 0; i < 3; i++) {
    const net = e.heap_stat(0) - e.heap_stat(1);
    query(large + 4093, true, 'large path ' + i, 2052, 1, unchanged, many, true, true);
    // Path storage persists after consumption; after the first call its
    // capacity is stable, so subsequent calls must balance their temporary.
    if (i) assert.strictEqual(e.heap_stat(0) - e.heap_stat(1), net);
  }
  query(split + 4093, true, 'two-point path consumer control', 2, 1, unchanged, rectangle.subarray(0, 16), true, true);
  // Leave four arena bytes free: a nested caller's live lease cannot be
  // overwritten, released or mistaken for Polygon's temporary storage.
  const lease = e.polygon_lease(large + 4093) >>> 0;
  assert.strictEqual(e.guest_span_cursor_bytes(), 16380);
  const leasedBytes = mem.slice(lease, lease + 16380);
  surface.fill(0x33);
  put(split + 4093, rectangle);
  const inputBefore = backing.map(b => Buffer.from(b));
  assert.strictEqual(call('Polygon', [dc, split + 4093, 4]), 1);
  assert.deepStrictEqual(surface, expected);
  assert.strictEqual(e.guest_span_cursor_bytes(), 16380);
  assert.deepStrictEqual(mem.slice(lease, lease + 16380), leasedBytes);
  backing.forEach((b, i) => assert.deepStrictEqual(b, inputBefore[i]));
  e.polygon_release(lease);
  assert.strictEqual(e.guest_span_cursor_bytes(), 0);
  call('ReleaseDC', [hwnd, dc]);
  call('DeleteObject', [brush]);
  const summary = { rows, calls, failures };
  console.log('Polygon guest mapping ' + JSON.stringify(summary));
  return summary;
}

async function main() {
  const root = path.join(__dirname, '..');
  const wasm = compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const base = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(base.host, {
    memory,
    create_thread: () => 0,
    exit_thread: () => 0,
    terminate_thread: () => 0,
    create_event: () => 0,
    set_event: () => 0,
    reset_event: () => 0,
    wait_single: () => 0,
    wait_multiple: () => 0,
    com_create_instance: () => 0x80004002,
  });
  const { instance } = await WebAssembly.instantiate(wasm, base);
  const wat = instance.exports;
  const bytes = new Uint8Array(memory.buffer);
  let passed = 0;

  function check(name, fn) {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  }

  function makeDib(width, height, bpp = 32, topDown = true) {
    const bmi = wat.guest_alloc(0x100) >>> 0;
    const out = wat.guest_alloc(4) >>> 0;
    wat.guest_write32(bmi, 40);
    wat.guest_write32(bmi + 4, width);
    wat.guest_write32(bmi + 8, topDown ? -height : height);
    wat.guest_write16(bmi + 12, 1);
    wat.guest_write16(bmi + 14, bpp);
    const bitmap = wat.test_call_CreateDIBSection(0, bmi, 0, out, 0, 0) >>> 0;
    const bitsGa = wat.guest_read32(out) >>> 0;
    const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
    assert(bitmap && hdc);
    assert.strictEqual(wat.test_call_SelectObject(hdc, bitmap) >>> 0, 0x30007);
    return {
      bitmap, hdc, width, height, bpp, topDown,
      stride: ((width * bpp + 31) >> 5) << 2,
      bits: RegionMap.BASE.DIB_BACKING_BASE + (bitsGa - 0x50000000),
    };
  }

  function clear(dib, value = 0) {
    bytes.fill(value, dib.bits, dib.bits + dib.stride * dib.height);
  }

  function pixel(dib, x, y) {
    const row = dib.topDown ? y : dib.height - 1 - y;
    const p = dib.bits + row * dib.stride + x * (dib.bpp >> 3);
    return bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
  }

  function rect(left, top, right, bottom) {
    const p = wat.guest_alloc(16) >>> 0;
    [left, top, right, bottom].forEach((value, i) => wat.guest_write32(p + i * 4, value));
    return p;
  }

  function points(values) {
    const p = wat.guest_alloc(values.length * 8) >>> 0;
    values.forEach(([x, y], i) => {
      wat.guest_write32(p + i * 8, x);
      wat.guest_write32(p + i * 8 + 4, y);
    });
    return p;
  }

  const dib = makeDib(12, 10);
  const redPen = wat.test_call_CreatePen(0, 1, 0x000000FF) >>> 0;
  const greenBrush = wat.test_call_CreateSolidBrush(0x0000FF00) >>> 0;

  check('Rectangle and Ellipse handlers consume selected WAT objects', () => {
    wat.test_call_SelectObject(dib.hdc, redPen);
    wat.test_call_SelectObject(dib.hdc, greenBrush);
    assert.strictEqual(wat.test_call_Rectangle(dib.hdc, 1, 1, 8, 6), 1);
    assert.strictEqual(pixel(dib, 1, 1), 0xFF0000);
    assert.strictEqual(pixel(dib, 3, 3), 0x00FF00);
    clear(dib);
    assert.strictEqual(wat.test_call_Ellipse(dib.hdc, 1, 1, 9, 7), 1);
    assert.strictEqual(pixel(dib, 1, 4), 0xFF0000);
    assert.strictEqual(pixel(dib, 4, 4), 0x00FF00);
  });

  check('FillRect, FrameRect, DrawEdge, and DrawFocusRect route through WAT', () => {
    clear(dib);
    assert.strictEqual(wat.test_call_FillRect(dib.hdc, rect(1, 1, 10, 8), 16), 1);
    assert.strictEqual(pixel(dib, 4, 4), 0xC0C0C0);
    assert.strictEqual(wat.test_call_FrameRect(dib.hdc, rect(2, 2, 9, 7), 0x30014), 1);
    assert.strictEqual(pixel(dib, 2, 4), 0);
    assert.strictEqual(pixel(dib, 4, 4), 0xC0C0C0);
    const adjusted = rect(1, 1, 10, 8);
    assert.strictEqual(wat.test_call_DrawEdge(dib.hdc, adjusted, 5, 0x200F), 1);
    assert.deepStrictEqual([0, 4, 8, 12].map(o => wat.guest_read32(adjusted + o)), [3, 3, 8, 6]);
    assert.strictEqual(pixel(dib, 1, 1), 0xFFFFFF);
    const focus = rect(3, 3, 8, 6);
    const before = bytes.slice(dib.bits, dib.bits + dib.stride * dib.height);
    assert.strictEqual(wat.test_call_DrawFocusRect(dib.hdc, focus), 1);
    assert.strictEqual(wat.test_call_DrawFocusRect(dib.hdc, focus), 1);
    assert.deepStrictEqual(bytes.slice(dib.bits, dib.bits + dib.stride * dib.height), before);
  });

  check('hatched brushes honor origin, background mode, and shape coverage', () => {
    const hatch = wat.test_call_CreateHatchBrush(4, 0x000000FF) >>> 0; // HS_CROSS red
    assert(hatch);
    wat.test_call_SelectObject(dib.hdc, 0x30018); // NULL_PEN
    wat.test_call_SelectObject(dib.hdc, hatch);
    wat.test_gdi_dc_set_field(dib.hdc, 24, 0x0000FF00, 0xFFFFFF); // green background
    wat.test_gdi_dc_set_field(dib.hdc, 28, 2, 2); // OPAQUE
    assert.strictEqual(wat.test_call_SetBrushOrgEx(dib.hdc, 2, 3, 0), 1);
    clear(dib);
    assert.strictEqual(wat.test_call_Rectangle(dib.hdc, 0, 0, 12, 10), 1);
    assert.strictEqual(pixel(dib, 2, 3), 0xFF0000, 'hatch crossing uses foreground');
    assert.strictEqual(pixel(dib, 3, 4), 0x00FF00, 'opaque gap uses DC background');
    wat.test_gdi_dc_set_field(dib.hdc, 28, 1, 2); // TRANSPARENT
    clear(dib, 0x33);
    assert.strictEqual(wat.test_call_Ellipse(dib.hdc, 0, 0, 12, 10), 1);
    assert.strictEqual(pixel(dib, 6, 3), 0xFF0000, 'hatch origin applies to ellipse fill');
    assert.strictEqual(pixel(dib, 6, 4), 0x333333, 'transparent gap preserves destination');
    wat.test_call_SelectObject(dib.hdc, greenBrush);
    wat.test_call_SelectObject(dib.hdc, redPen);
    wat.test_call_SetBrushOrgEx(dib.hdc, 0, 0, 0);
    assert.strictEqual(wat.test_call_DeleteObject(hatch), 1);
  });

  check('Polygon and Polyline handlers rasterize guest POINT arrays', () => {
    clear(dib);
    assert.strictEqual(wat.test_call_Polygon(
      dib.hdc, points([[1, 1], [9, 1], [5, 7]]), 3), 1);
    assert.strictEqual(pixel(dib, 5, 3), 0x00FF00);
    clear(dib);
    assert.strictEqual(wat.test_call_Polyline(
      dib.hdc, points([[1, 1], [7, 1], [7, 6]]), 3), 1);
    assert.strictEqual(pixel(dib, 4, 1), 0xFF0000);
    assert.strictEqual(pixel(dib, 7, 4), 0xFF0000);
  });

  check('MoveToEx, LineTo, and PolylineTo own current position', () => {
    clear(dib);
    assert.strictEqual(wat.test_call_MoveToEx(dib.hdc, 2, 2, 0), 1);
    assert.strictEqual(wat.test_call_LineTo(dib.hdc, 8, 2), 1);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 12, 0), 8);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 16, 0), 2);
    assert.strictEqual(wat.test_call_PolylineTo(
      dib.hdc, points([[8, 6], [3, 6]]), 2), 1);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 12, 0), 3);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 16, 0), 6);
    assert.strictEqual(pixel(dib, 8, 4), 0xFF0000);
  });

  check('LineTo handler matches captured native axis-aligned wide-pen coverage', () => {
    clear(dib);
    const widePen = wat.test_call_CreatePen(0, 3, 0x000000FF) >>> 0;
    assert(widePen);
    wat.test_call_SelectObject(dib.hdc, widePen);
    assert.strictEqual(wat.test_call_MoveToEx(dib.hdc, 2, 3, 0), 1);
    assert.strictEqual(wat.test_call_LineTo(dib.hdc, 7, 3), 1);
    for (let y = 0; y < dib.height; y++) {
      for (let x = 0; x < dib.width; x++) {
        const expected = x >= 1 && x <= 8 && y >= 2 && y <= 4;
        assert.strictEqual(pixel(dib, x, y), expected ? 0xFF0000 : 0,
          `unexpected real-handler wide-stroke pixel at ${x},${y}`);
      }
    }
    wat.test_call_SelectObject(dib.hdc, redPen);
    assert.strictEqual(wat.test_call_DeleteObject(widePen), 1);
  });

  check('RoundRect, PolyBezier, and Arc use canonical integer pixels', () => {
    clear(dib);
    assert.strictEqual(wat.test_call_RoundRect(dib.hdc, 1, 1, 11, 9, 6, 6), 1);
    assert.strictEqual(pixel(dib, 1, 1), 0, 'rounded corner remains outside');
    assert.strictEqual(pixel(dib, 6, 1), 0xFF0000, 'rounded top edge uses selected pen');
    assert.strictEqual(pixel(dib, 6, 4), 0x00FF00, 'rounded interior uses selected brush');

    clear(dib);
    assert.strictEqual(wat.test_call_PolyBezier(
      dib.hdc, points([[1, 8], [3, 1], [8, 1], [10, 8]]), 4), 1);
    const curvePixels = Array.from({ length: dib.height }, (_, y) =>
      Array.from({ length: dib.width }, (_, x) => pixel(dib, x, y)))
      .flat().filter(Boolean);
    assert(curvePixels.length >= 8, 'Bezier should rasterize a visible curve');
    assert(curvePixels.every(color => color === 0xFF0000), 'Bezier must not produce antialias colors');

    assert.strictEqual(wat.test_call_MoveToEx(dib.hdc, 1, 8, 0), 1);
    assert.strictEqual(wat.test_call_PolyBezierTo(
      dib.hdc, points([[3, 7], [8, 7], [10, 2]]), 3), 1);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 12, 0), 10);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 16, 0), 2);

    clear(dib);
    assert.strictEqual(wat.test_call_Arc(dib.hdc, 1, 1, 11, 9, 11, 5, 6, 1), 1);
    const arcPixels = Array.from({ length: dib.height }, (_, y) =>
      Array.from({ length: dib.width }, (_, x) => pixel(dib, x, y)))
      .flat().filter(Boolean);
    assert(arcPixels.length >= 6, 'Arc should rasterize a visible segment');
    assert(arcPixels.every(color => color === 0xFF0000), 'Arc must not produce antialias colors');
  });

  check('extended DC state and mixed PolyDraw commands round-trip in WAT', () => {
    assert.strictEqual(wat.test_call_SetArcDirection(dib.hdc, 2), 1);
    assert.strictEqual(wat.test_call_SetArcDirection(dib.hdc, 1), 2);
    assert.strictEqual(wat.test_call_SetArcDirection(dib.hdc, 9), 0);
    assert.strictEqual(wat.test_call_SetTextCharacterExtra(dib.hdc, 3), 0);
    assert.strictEqual(wat.test_call_GetTextCharacterExtra(dib.hdc), 3);
    assert.strictEqual(wat.test_call_SetTextCharacterExtra(dib.hdc, -2), 3);
    assert.strictEqual(wat.test_call_SetTextJustification(dib.hdc, 7, 2), 1);
    assert.strictEqual(wat.test_gdi_dc_aux_get(dib.hdc, 24, 0), 7);
    assert.strictEqual(wat.test_gdi_dc_aux_get(dib.hdc, 28, 0), 2);
    assert.strictEqual(wat.test_call_SetMapperFlags(dib.hdc, 0x40), 0);
    assert.strictEqual(wat.test_call_SetMapperFlags(dib.hdc, 0x20), 0x40);
    const oldOrigin = rect(0, 0, 0, 0);
    assert.strictEqual(wat.test_call_SetBrushOrgEx(dib.hdc, 4, -3, oldOrigin), 1);
    assert.deepStrictEqual([wat.guest_read32(oldOrigin), wat.guest_read32(oldOrigin + 4)], [0, 0]);
    assert.strictEqual(wat.test_call_SetBrushOrgEx(dib.hdc, 7, 8, oldOrigin), 1);
    assert.deepStrictEqual([wat.guest_read32(oldOrigin), wat.guest_read32(oldOrigin + 4)], [4, -3]);

    clear(dib);
    const path = points([[1, 7], [1, 2], [5, 2], [8, 2], [10, 7]]);
    const types = wat.guest_alloc(8) >>> 0;
    wat.guest_write32(types, 0x04040206);
    wat.guest_write32(types + 4, 5);
    assert.strictEqual(wat.test_call_PolyDraw(dib.hdc, path, types, 5), 1);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 12, 0), 1,
      'PT_CLOSEFIGURE returns current position to the figure start');
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 16, 0), 7);
    const pathPixels = Array.from({ length: dib.height }, (_, y) =>
      Array.from({ length: dib.width }, (_, x) => pixel(dib, x, y)))
      .flat().filter(Boolean);
    assert(pathPixels.length >= 10);
    assert(pathPixels.every(color => color === 0xFF0000));
  });

  check('clockwise ArcTo connects and updates the current position', () => {
    clear(dib);
    assert.strictEqual(wat.test_call_SetArcDirection(dib.hdc, 2), 1);
    assert.strictEqual(wat.test_call_MoveToEx(dib.hdc, 0, 5, 0), 1);
    assert.strictEqual(wat.test_call_ArcTo(dib.hdc, 1, 1, 11, 9, 11, 5, 6, 1), 1);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 12, 0), 6);
    assert.strictEqual(wat.test_gdi_dc_get_field(dib.hdc, 16, 0), 1);
    assert.strictEqual(pixel(dib, 0, 5), 0xFF0000,
      'ArcTo draws the connector from current position');
  });

  console.log(`\n${passed}/${passed} checks passed`);
}

module.exports = { polygonGuestMapping, polygonMappingWat };
if (require.main === module) polygonGuestMapping().then(summary => {
  assert.strictEqual(summary.failures.length, 0, 'public Polygon guest mapping');
  return main();
}).catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
