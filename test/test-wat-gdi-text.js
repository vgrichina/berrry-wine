#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
// $GDI_LINE_DESC, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (func (export "tt_hold") (param i32 i32) (result i32)
    (call $guest_span_in (local.get 0) (local.get 1)))
  (func (export "tt_drop") (param i32 i32)
    (call $guest_span_release (local.get 0) (local.get 1)))
  (func (export "tt_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "tt_regs") (result i32) (global.get $reg_base))
  (func (export "tt_resolve") (param i32) (result i32)
    (call $handle_GetProcAddress (i32.const 0) (local.get 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "tt_call") (param i32)
    (global.set $eip (i32.const 0x456789ab))
    (call $win32_dispatch (i32.shr_u
      (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function main() {
  const { exports: wat, memory, hostCtx: ctx } = await bootRenderHarness({ extraWat });

  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  const bitmap = wat.test_call_CreateCompatibleBitmap(hdc, 160, 32) >>> 0;
  assert(hdc && bitmap);
  assert.strictEqual(wat.test_call_SelectObject(hdc, bitmap), 0x30007);

  const ansi = wat.guest_alloc(4) >>> 0;
  wat.guest_write32(ansi, 0x00420941); // "A\tB\0"
  const stops = wat.guest_alloc(8) >>> 0;
  wat.guest_write32(stops, 20);
  wat.guest_write32(stops + 4, 40);

  // These widths come from the bundled Wine System strike (SYSTEM_FONT, a 16px
  // cell with A=8 and B=10), which is what the DC selects by default. They used
  // to be Canvas's approximation of a 12px cell, measured from whatever font
  // the host machine resolved.
  const explicit = wat.test_call_GetTabbedTextExtentA(hdc, ansi, 3, 2, stops) >>> 0;
  assert.strictEqual(explicit & 0xffff, 30,
    'A, tab to explicit x=20, then B (10px) in the stock System strike');
  assert.strictEqual(explicit >>> 16, 16, 'native Win98 SYSTEM_FONT cell height');
  const defaultTabs = wat.test_call_GetTabbedTextExtentA(hdc, ansi, 3, 0, 0) >>> 0;
  assert.strictEqual(defaultTabs & 0xffff, 66,
    'default tabs repeat every eight average character cells');
  wat.guest_write32(stops, 16);
  const repeating = wat.test_call_GetTabbedTextExtentA(hdc, ansi, 3, 1, stops) >>> 0;
  assert.strictEqual(repeating & 0xffff, 26,
    'one explicit tab value is a repeating interval, not a one-shot stop');
  wat.guest_write32(stops, 20);

  const wide = wat.guest_alloc(8) >>> 0;
  wat.guest_write16(wide, 65);
  wat.guest_write16(wide + 2, 9);
  wat.guest_write16(wide + 4, 66);
  wat.guest_write16(wide + 6, 0);
  assert.strictEqual(wat.test_call_GetTabbedTextExtentW(hdc, wide, 3, 2, stops), explicit,
    'ANSI and UTF-16 tab layout must share the same canonical algorithm');

  const before = new Uint8Array(memory.buffer).slice();
  const drawn = wat.test_call_TabbedTextOutA(hdc, 5, 4, ansi, 3, 2, stops, 5) >>> 0;
  assert.strictEqual(drawn & 0xffff, 30);
  const descriptor = RegionMap.BASE.GDI_LINE_DESC;
  assert.strictEqual(wat.test_gdi_surface_descriptor(hdc, descriptor), 1);
  const dv = new DataView(memory.buffer);
  const bits = dv.getUint32(descriptor, true);
  const stride = dv.getUint32(descriptor + 12, true);
  const after = new Uint8Array(memory.buffer);
  assert(after.subarray(bits, bits + stride * 32).some((value, index) => value !== before[bits + index]),
    'tabbed output must rasterize each run back into canonical WAT pixels');

  assert.strictEqual(wat.test_call_TabbedTextOutW(hdc, 5, 4, wide, 3, 2, stops, 5), drawn);
  assert.strictEqual(wat.test_call_GetTabbedTextExtentA(hdc, ansi, -1, 0, 0), 0,
    'negative explicit counts are rejected');
  assert.strictEqual(wat.test_call_GetTabbedTextExtentA(hdc, ansi, 3, 1, 0), 0,
    'a nonzero tab count requires a tab-stop array');

  assert.strictEqual(wat.test_call_DeleteObject(bitmap), 1);
  assert.strictEqual(wat.test_call_DeleteDC(hdc), 1);
  await publicMapping(wat, memory, ctx);
  console.log('PASS  WAT owns ANSI/Wide tab layout and canonical text measurement binding');
}

async function publicMapping(wat, memory, ctx) {
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const physical = p => wat.guest_to_wasm(p) >>> 0;
  const alloc = n => wat.guest_alloc(n) >>> 0;
  const put = (p, data) => data.forEach((v, i) => wat.guest_write8(p + i, v));
  const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => wat.guest_read8(p + i)));
  const string = (s, wide = false) => {
    const data = Buffer.from(s + '\0', wide ? 'utf16le' : 'latin1'), p = alloc(data.length);
    put(p, data); return p;
  };
  // A single solid glyph makes every painted and untouched pixel predictable.
  const fnt = Buffer.alloc(143);
  fnt.writeUInt16LE(0x200, 0); fnt.writeUInt32LE(fnt.length, 2);
  fnt.writeUInt16LE(8, 74); fnt.writeUInt16LE(400, 83);
  for (const p of [88, 91, 93]) fnt.writeUInt16LE(8, p);
  fnt[95] = fnt[96] = 65;
  fnt.writeUInt32LE(134, 105); fnt.writeUInt16LE(8, 118);
  fnt.writeUInt16LE(126, 120); fnt.writeUInt16LE(134, 124);
  fnt.fill(255, 126, 134); fnt.write('TabSpan\0', 134, 'latin1');
  ctx.vfs.files.set('c:\\tabspan.fon', { data: new Uint8Array(fnt), attrs: 0x20 });
  assert.strictEqual(wat.test_call_AddFontResourceA(string('TABSPAN.FON')), 1);
  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  const width = 192, height = 16, bmi = alloc(40), out = alloc(4);
  put(bmi, Buffer.alloc(40));
  wat.guest_write32(bmi, 40); wat.guest_write32(bmi + 4, width);
  wat.guest_write32(bmi + 8, -height); wat.guest_write16(bmi + 12, 1);
  wat.guest_write16(bmi + 14, 32);
  const bitmap = wat.test_call_CreateDIBSection(0, bmi, 0, out, 0, 0) >>> 0;
  wat.test_call_SelectObject(hdc, bitmap);
  const font = wat.test_call_CreateFontW(-8, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, string('TabSpan', true));
  wat.test_call_SelectObject(hdc, font);
  wat.test_gdi_dc_set_field(hdc, 28, 1, 2);
  wat.test_gdi_dc_set_field(hdc, 20, 0, 0);
  const bits = physical(wat.guest_read32(out) >>> 0);
  wat.tt_init();
  const regs = wat.tt_regs() >>> 0, frame = alloc(256), stack = frame + 64;
  const apis = new Map(), table = require('../src/api_table.json');
  for (const name of ['TabbedTextOutA', 'TabbedTextOutW', 'GetTabbedTextExtentA', 'GetTabbedTextExtentW']) {
    view.setUint32(regs + 16, stack, true);
    const thunk = wat.tt_resolve(string(name)) >>> 0, entry = table.find(e => e.name === name);
    assert.ok(thunk); assert.strictEqual(wat.guest_read32(thunk + 4), entry.id);
    apis.set(name, { thunk, nargs: entry.nargs });
  }
  const backing = [];
  for (const [i, base] of [0x30000000, 0x31000000].entries()) {
    const decoy = 0x28000000 + i * 0x10000;
    for (const p of [base, decoy, base + 4096, decoy + 4096]) {
      assert.strictEqual(wat.test_virtual_map_commit(p, 4096) >>> 0, p);
      backing.push(Buffer.from(memory.buffer, physical(p), 4096));
    }
    assert.strictEqual(physical(decoy), physical(base) + 4096);
    assert.notStrictEqual(physical(base + 4096), physical(base) + 4096);
  }
  const adjacent = 0x33000000;
  assert.strictEqual(wat.test_virtual_map_commit(adjacent, 16384) >>> 0, adjacent);
  assert.strictEqual(physical(adjacent + 4096), physical(adjacent) + 4096);
  backing.push(Buffer.from(memory.buffer, physical(adjacent), 16384));
  const direct = alloc(16384);
  backing.push(Buffer.from(memory.buffer, physical(direct), 16384));
  function invoke(name, args, occupied = 0) {
    const entry = apis.get(name);
    assert.strictEqual(args.length, entry.nargs);
    put(frame, Buffer.alloc(256, 0x5a));
    wat.guest_write32(stack, 0x12345678);
    args.forEach((v, i) => wat.guest_write32(stack + 4 + i * 4, v));
    const saved = read(frame, 256);
    const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
    seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true));
    wat.tt_call(entry.thunk);
    assert.strictEqual(wat.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
    assert.strictEqual(wat.get_eip() >>> 0, 0x456789ab, name + ' EIP');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.strictEqual(view.getUint32(regs + i * 4, true), seed[i], name + ' register');
    assert.deepStrictEqual(read(frame, 256), saved, name + ' stack bounds');
    assert.strictEqual(wat.guest_span_cursor_bytes(), occupied);
    assert.strictEqual(wat.guest_span_overflow_count(), 0);
    return wat.get_eax() >>> 0;
  }
  const cases = [
    { stops: [], positions: [0, 64, 128] },
    { stops: [16], positions: [0, 16, 32] },
    { stops: [20, 40], positions: [0, 20, 40] },
    { stops: [0], positions: [0, 64, 128] },
    { stops: [-16], positions: [0, 64, 128] },
    { stops: [20, 40], count: 0, positions: [] },
    { stops: [20, 40], count: -1, positions: [], invalid: true },
    { stops: [20, 40], tabCount: -1, positions: [], invalid: true },
    { stops: [20], nullStops: true, positions: [], invalid: true },
    { stops: [], nullText: true, positions: [], invalid: true },
    { stops: [], nullText: true, count: 0, positions: [] },
  ];
  let calls = 0;
  for (const name of apis.keys()) for (const c of cases) {
    const draw = name.startsWith('Tabbed'), wide = name.endsWith('W');
    for (const mode of ['direct', 'adjacent', 'text', 'stops', 'both']) for (let cut = 1; cut <= 7; cut++) {
      const p = mode === 'direct' ? direct : adjacent;
      const text = ['text', 'both'].includes(mode) ? 0x30001000 - cut : p + 4096 - cut;
      const stops = ['stops', 'both'].includes(mode) ? 0x31001000 - cut : p + 12288 - cut;
      backing.forEach(b => b.fill(0xa5));
      put(text, Buffer.from('A\tA\tA', wide ? 'utf16le' : 'latin1'));
      const data = Buffer.alloc(c.stops.length * 4);
      c.stops.forEach((v, i) => data.writeInt32LE(v, i * 4)); put(stops, data);
      const before = backing.map(b => Buffer.from(b));
      assert.strictEqual(wat.test_call_PatBlt(hdc, 0, 0, width, height, 0x00f00021), 1);
      const count = c.count ?? 5, n = c.tabCount ?? c.stops.length;
      const textPtr = c.nullText ? 0 : text, stopsPtr = c.nullStops || !n ? 0 : stops;
      const args = draw ? [hdc, 3, 2, textPtr, count, n, stopsPtr, 3] : [hdc, textPtr, count, n, stopsPtr];
      const label = `${name}/${mode}/${cut}/${JSON.stringify(c)}`;
      const extent = c.positions.length ? c.positions.at(-1) + 8 : 0;
      assert.strictEqual(invoke(name, args), c.invalid ? 0 : (8 << 16) | extent, label + ' packed extent');
      backing.forEach((b, i) => assert.deepStrictEqual(b, before[i], label + ' read-only backing/decoy ' + i));
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const ink = draw && y >= 2 && y < 10 && c.positions.some(p => x >= 3 + p && x < 11 + p);
        assert.strictEqual(view.getUint32(bits + (y * width + x) * 4, true) & 0xffffff, ink ? 0 : 0xffffff, label + ` pixel ${x}/${y}`);
      }
      calls++;
    }
  }
  console.log(`PASS ${calls} public tabbed text mapping, literal pixels/extents, write bounds and stdcall calls`);
  // A large fragmented input and an occupied arena must use a private copy
  // without leaking heap blocks or consuming an outer caller's span lease.
  const longBase = 0x34000000;
  for (let i = 0; i < 5; i++) for (const p of [longBase + i * 4096, 0x2a000000 + i * 4096])
    assert.strictEqual(wat.test_virtual_map_commit(p, 4096) >>> 0, p);
  for (const name of apis.keys()) {
    const draw = name.startsWith('Tabbed'), wide = name.endsWith('W');
    const data = Buffer.from('A'.repeat(wide ? 10000 : 20000), wide ? 'utf16le' : 'latin1');
    put(longBase, data);
    const before = wat.heap_stat(0) - wat.heap_stat(1);
    const count = wide ? 10000 : 20000;
    const args = draw ? [hdc, 0, 0, longBase, count, 0, 0, 0] : [hdc, longBase, count, 0, 0];
    for (let i = 0; i < 3; i++) assert.strictEqual(invoke(name, args), (8 << 16) | ((count * 8) & 0xffff));
    assert.deepStrictEqual(read(longBase, data.length), data);
    assert.strictEqual(wat.heap_stat(0) - wat.heap_stat(1), before, name + ' long heap balanced');
  }
  const held = wat.tt_hold(longBase, 16380) >>> 0;
  const heldBytes = Buffer.from(bytes.subarray(held, held + 16380));
  try {
    for (const name of apis.keys()) {
      const draw = name.startsWith('Tabbed'), wide = name.endsWith('W'), text = 0x30000fff;
      put(text, Buffer.from('A\tA\tA', wide ? 'utf16le' : 'latin1'));
      const before = wat.heap_stat(0) - wat.heap_stat(1);
      const args = draw ? [hdc, 0, 0, text, 5, 0, 0, 0] : [hdc, text, 5, 0, 0];
      assert.strictEqual(invoke(name, args, 16380), (8 << 16) | 136);
      assert.strictEqual(wat.heap_stat(0) - wat.heap_stat(1), before, name + ' nested heap balanced');
      assert.deepStrictEqual(Buffer.from(bytes.subarray(held, held + 16380)), heldBytes);
    }
  } finally { wat.tt_drop(held, 16380); }
  assert.strictEqual(wat.guest_span_cursor_bytes(), 0);
  console.log('PASS long and occupied-arena copies balance heap and preserve outer span');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
