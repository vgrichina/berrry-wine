#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const bitmapSpanWat = `
  (func (export "bits_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "bits_regs") (result i32) (global.get $reg_base))
  (func (export "bits_module") (param i32) (result i32)
    (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
  (func (export "bits_resolve") (param i32 i32) (result i32)
    (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
  (func (export "bits_dispatch") (param i32)
    (global.set $eip (i32.const 0x456789ab))
    (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0)
      (global.get $thunk_guest_base)) (i32.const 3))))
  (func (export "bits_lease") (param i32) (result i32)
    (call $guest_span_in (local.get 0) (i32.const 16380)))
  (func (export "bits_release") (param i32)
    (call $guest_span_release (local.get 0) (i32.const 16380)))
`;

async function bitmapSpanMapping() {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: bitmapSpanWat, fonts: 'none' });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.bits_init(); e.set_api_log(0);
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
  const str = s => { const b = Buffer.from(s + '\0'), p = alloc(b.length); put(p, b); return p; };
  const frame = alloc(256), stack = frame + 64, regs = e.bits_regs() >>> 0;
  dv.setUint32(regs + 16, stack, true);
  const module = e.bits_module(str('GDI32.DLL')) >>> 0; assert(module);
  const entries = new Map(), apiTable = require('../src/api_table.json');
  for (const name of ['CreateBitmap', 'CreateCompatibleDC', 'SelectObject', 'GetPixel',
    'GetBitmapBits', 'SetBitmapBits', 'DeleteObject', 'DeleteDC']) {
    dv.setUint32(regs + 16, stack, true);
    const thunk = e.bits_resolve(module, str(name)) >>> 0;
    const row = apiTable.find(r => r.name === name);
    assert(thunk && row, name); assert.strictEqual(row.convention, 'stdcall');
    assert.strictEqual(e.guest_read32(thunk + 4), row.id);
    entries.set(name, { thunk, nargs: row.nargs });
  }
  let calls = 0, rows = 0;
  const failures = [];
  function call(name, args) {
    const { thunk, nargs } = entries.get(name); assert.strictEqual(args.length, nargs);
    mem.fill(0x6d, wa(frame), wa(frame) + 256);
    e.guest_write32(stack, 0x12345678);
    args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
    const before = mem.slice(wa(frame), wa(frame) + 256);
    const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
    seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
    calls++; e.bits_dispatch(thunk);
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + nargs * 4, name + ' ESP');
    assert.strictEqual(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.strictEqual(dv.getUint32(regs + i * 4, true), seed[i], name + ' register');
    assert.deepStrictEqual(mem.slice(wa(frame), wa(frame) + 256), before, name + ' whole stack');
    return e.get_eax() >>> 0;
  }
  const size = 20480, capacity = 32768, direct = alloc(capacity), adjacent = 0x35000000;
  const split = 0x36000000, decoy = 0x37000000;
  assert.strictEqual(e.test_virtual_map_commit(adjacent, capacity) >>> 0, adjacent);
  for (let i = 0; i < 8; i++) {
    for (const p of [split + i * 4096, decoy + i * 4096])
      assert.strictEqual(e.test_virtual_map_commit(p, 4096) >>> 0, p);
    assert.strictEqual(wa(decoy + i * 4096), wa(split + i * 4096) + 4096);
    if (i) assert.notStrictEqual(wa(split + i * 4096), wa(split) + i * 4096);
  }
  assert.strictEqual(wa(adjacent + 28672), wa(adjacent) + 28672);
  const ranges = [[wa(direct), capacity], [wa(adjacent), capacity], [wa(0), 128]];
  for (let i = 0; i < 8; i++) for (const p of [split, decoy]) ranges.push([wa(p + i * 4096), 4096]);
  const backing = ranges.map(([p, n]) => Buffer.from(memory.buffer, p, n));
  const initialPtr = alloc(size), replacementPtr = alloc(size), verify = alloc(size);
  for (const bpp of [32, 1]) {
    const width = bpp === 32 ? 64 : 31, height = bpp === 32 ? 80 : 5120, stride = bpp === 32 ? 256 : 4;
    const initial = Buffer.alloc(size), replacement = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      initial[i] = bpp === 32 && i % 4 === 3 ? 0 : (i * 13 + (i >>> 8) + 19) & 255;
      replacement[i] = bpp === 32 && i % 4 === 3 ? 0 : (i * 7 + (i >>> 7) + 101) & 255;
    }
    put(initialPtr, initial); put(replacementPtr, replacement);
    const bitmap = call('CreateBitmap', [width, height, 1, bpp, initialPtr]); assert(bitmap);
    const dc = call('CreateCompatibleDC', [0]); assert(dc); assert(call('SelectObject', [dc, bitmap]));
    function query(method, base, count, occupied, label) {
      rows++;
      assert.strictEqual(call('SetBitmapBits', [bitmap, size, initialPtr]), size);
      backing.forEach((b, i) => b.fill(0x91 + i));
      const p = base + 4093, n = Math.min(size, Math.max(0, count));
      if (method === 'SetBitmapBits') put(p, replacement);
      const before = backing.map(b => Buffer.from(b)), expected = before.map(b => Buffer.from(b));
      if (method === 'GetBitmapBits') for (let i = 0; i < n; i++) {
        const address = wa(p + i), range = ranges.findIndex(([a, len]) => address >= a && address < a + len);
        assert(range >= 0); expected[range][address - ranges[range][0]] = initial[i];
      }
      const pixels = Buffer.from(initial);
      if (method === 'SetBitmapBits') replacement.copy(pixels, 0, 0, n);
      const lease = occupied ? e.bits_lease(split + 4093) >>> 0 : 0;
      const leased = lease ? mem.slice(lease, lease + 16380) : null;
      assert.strictEqual(e.guest_span_cursor_bytes(), occupied ? 16380 : 0);
      const net = e.heap_stat(0) - e.heap_stat(1), overflow = e.guest_span_overflow_count();
      let trapped = false;
      try { assert.strictEqual(call(method, [bitmap, count, p]), n); }
      catch (error) {
        if (!(error instanceof WebAssembly.RuntimeError)) throw error;
        trapped = true; failures.push({ bpp, method, label, count, occupied, trap: error.message });
      }
      assert.strictEqual(e.guest_span_cursor_bytes(), occupied ? 16380 : 0);
      if (lease) {
        assert.deepStrictEqual(mem.slice(lease, lease + 16380), leased, 'outer lease bytes');
        e.bits_release(lease);
      }
      assert.strictEqual(e.heap_stat(0) - e.heap_stat(1), net, 'temporary heap balanced');
      if (trapped) {
        assert.strictEqual(e.guest_span_overflow_count(), overflow + 1);
        backing.forEach((b, i) => assert.deepStrictEqual(b, before[i], 'trap before buffer writes'));
        return;
      }
      assert.strictEqual(e.guest_span_overflow_count(), overflow);
      backing.forEach((b, i) => assert.deepStrictEqual(b, expected[i], label + ' full backing/decoys/guards ' + i));
      assert.strictEqual(call('GetBitmapBits', [bitmap, size, verify]), size);
      assert.deepStrictEqual(Buffer.from(mem.slice(wa(verify), wa(verify) + size)), pixels, 'literal full bitmap');
      for (const y of [0, 1, Math.floor(height / 2), height - 1]) for (const x of [0, 1, width - 1]) {
        const offset = y * stride + (bpp === 32 ? x * 4 : x >>> 3);
        const color = bpp === 32 ? (pixels[offset] << 16) | (pixels[offset + 1] << 8) | pixels[offset + 2]
          : pixels[offset] & (128 >>> (x & 7)) ? 0xffffff : 0;
        assert.strictEqual(call('GetPixel', [dc, x, y]), color, label + ' pixel ' + x + ',' + y);
      }
    }
    for (const method of ['GetBitmapBits', 'SetBitmapBits']) {
      for (const count of [0, 1, 3, 4097, 16384, size - 1, size, size + 33])
        for (const [label, base] of [['direct', direct], ['adjacent', adjacent], ['split', split]])
          query(method, base, count, false, label);
      for (let repeat = 0; repeat < 3; repeat++) for (const count of [7, size])
        query(method, split, count, true, 'occupied/repeat' + repeat);
    }
    assert.strictEqual(call('DeleteDC', [dc]), 1); assert.strictEqual(call('DeleteObject', [bitmap]), 1);
  }
  console.log('Bitmap public span ' + JSON.stringify({ rows, calls, failures }));
  assert.deepStrictEqual(failures, [], 'valid public bitmap buffers must not trap');
}

(async () => {
  if (process.argv.includes('--bitmap-mapping-only')) return bitmapSpanMapping();
  const { exports: wat, memory } = await bootRenderHarness();
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = wat.get_image_base() >>> 0;
  const wa = guest => RegionMap.g2w(guest, imageBase);
  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  };
  const allocZero = size => {
    const pointer = wat.guest_alloc(size) >>> 0;
    for (let offset = 0; offset < size; offset += 4) wat.guest_write32(pointer + offset, 0);
    return pointer;
  };
  const readBytes = (pointer, size) => Array.from(bytes.subarray(wa(pointer), wa(pointer) + size));
  const writeByte = (pointer, value) => { bytes[wa(pointer)] = value; };

  // A DDB's bits are top row first, both as CreateBitmap takes them and as
  // Get/SetBitmapBits exchange them. ClockWerx draws each line of its level
  // text into a 1-bpp CreateBitmap with TextOut and reads it back with
  // GetBitmapBits as a mask; stored bottom-up, every line came out flipped.
  check('DDB bits are exchanged top row first', () => {
    const pixels = allocZero(4);
    writeByte(pixels + 0, 0xff); writeByte(pixels + 1, 0xff); // row 0 set
    const bitmap = wat.test_call_CreateBitmap(16, 2, 1, 1, pixels) >>> 0;
    const dc = wat.test_call_CreateCompatibleDC(0) >>> 0;
    assert(bitmap && dc);
    wat.test_call_SelectObject(dc, bitmap);
    assert.strictEqual(wat.test_call_GetPixel(dc, 0, 0) >>> 0, 0xffffff,
      'CreateBitmap lpBits row 0 is y=0');
    assert.strictEqual(wat.test_call_GetPixel(dc, 0, 1) >>> 0, 0,
      'CreateBitmap lpBits row 1 is y=1');
    wat.test_call_SetPixel(dc, 3, 1, 0xffffff);
    const output = allocZero(4);
    assert.strictEqual(wat.test_call_GetBitmapBits(bitmap, 4, output), 4);
    assert.deepStrictEqual(readBytes(output, 4), [0xff, 0xff, 0x10, 0x00],
      'a pixel drawn at y=1 comes back in the second scanline');
    assert.strictEqual(wat.test_call_DeleteDC(dc), 1);
    assert.strictEqual(wat.test_call_DeleteObject(bitmap), 1);
  });

  check('CreateBitmapIndirect and bitmap bit access use canonical storage', () => {
    const pixels = allocZero(16);
    const initial = [
      0x11, 0x22, 0x33, 0, 0x44, 0x55, 0x66, 0,
      0x77, 0x88, 0x99, 0, 0xaa, 0xbb, 0xcc, 0,
    ];
    initial.forEach((value, index) => writeByte(pixels + index, value));
    const object = allocZero(24);
    wat.guest_write32(object + 4, 2);
    wat.guest_write32(object + 8, 2);
    wat.guest_write32(object + 12, 8);
    wat.guest_write16(object + 16, 1);
    wat.guest_write16(object + 18, 32);
    wat.guest_write32(object + 20, pixels);
    const bitmap = wat.test_call_CreateBitmapIndirect(object) >>> 0;
    assert(bitmap);
    const output = allocZero(16);
    assert.strictEqual(wat.test_call_GetBitmapBits(bitmap, 16, output), 16);
    assert.deepStrictEqual(readBytes(output, 16), initial);

    const replacement = initial.map((value, index) => index % 4 === 3 ? 0 : value ^ 0xff);
    replacement.forEach((value, index) => writeByte(output + index, value));
    assert.strictEqual(wat.test_call_SetBitmapBits(bitmap, 16, output), 16);
    const verify = allocZero(16);
    assert.strictEqual(wat.test_call_GetBitmapBits(bitmap, 64, verify), 16,
      'bitmap access must clamp to the canonical allocation');
    assert.deepStrictEqual(readBytes(verify, 16), replacement);

    const dimension = allocZero(8);
    assert.strictEqual(wat.test_call_GetBitmapDimensionEx(bitmap, dimension), 1);
    assert.deepStrictEqual([wat.guest_read32(dimension), wat.guest_read32(dimension + 4)], [0, 0]);
    assert.strictEqual(wat.test_call_DeleteObject(bitmap), 1);
  });

  check('GetBrushOrgEx reports independent per-DC brush origin', () => {
    const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
    const previous = allocZero(8);
    assert.strictEqual(wat.test_call_SetBrushOrgEx(hdc, -7, 13, previous), 1);
    const origin = allocZero(8);
    assert.strictEqual(wat.test_call_GetBrushOrgEx(hdc, origin), 1);
    assert.deepStrictEqual([wat.guest_read32(origin), wat.guest_read32(origin + 4)], [-7, 13]);
    assert.strictEqual(wat.test_call_DeleteDC(hdc), 1);
  });

  check('rounded rectangle regions expose exact point and RGNDATA semantics', () => {
    const region = wat.test_call_CreateRoundRectRgn(0, 0, 10, 10, 6, 6) >>> 0;
    assert(region);
    assert.strictEqual(wat.test_call_PtInRegion(region, 5, 5), 1);
    assert.strictEqual(wat.test_call_PtInRegion(region, 0, 0), 0);
    const required = wat.test_call_GetRegionData(region, 0, 0) >>> 0;
    assert(required >= 48 && required % 16 === 0);
    const data = allocZero(required);
    assert.strictEqual(wat.test_call_GetRegionData(region, required - 1, data), 0);
    assert.strictEqual(wat.test_call_GetRegionData(region, required, data), required);
    assert.strictEqual(wat.guest_read32(data), 32);
    assert.strictEqual(wat.guest_read32(data + 4), 1);
    assert.strictEqual(wat.guest_read32(data + 8) * 16 + 32, required);
    assert.deepStrictEqual([
      wat.guest_read32(data + 16), wat.guest_read32(data + 20),
      wat.guest_read32(data + 24), wat.guest_read32(data + 28),
    ], [0, 0, 10, 10]);
    assert.strictEqual(wat.test_call_DeleteObject(region), 1);
  });

  check('poly-polygon regions union each closed polygon', () => {
    const points = allocZero(6 * 8);
    [[0, 0], [4, 0], [0, 4], [10, 10], [14, 10], [10, 14]].forEach(([x, y], index) => {
      wat.guest_write32(points + index * 8, x);
      wat.guest_write32(points + index * 8 + 4, y);
    });
    const counts = allocZero(8);
    wat.guest_write32(counts, 3);
    wat.guest_write32(counts + 4, 3);
    const region = wat.test_call_CreatePolyPolygonRgn(points, counts, 2, 1) >>> 0;
    assert(region);
    assert.strictEqual(wat.test_call_PtInRegion(region, 1, 1), 1);
    assert.strictEqual(wat.test_call_PtInRegion(region, 11, 11), 1);
    assert.strictEqual(wat.test_call_PtInRegion(region, 7, 7), 0);
    assert.strictEqual(wat.test_call_DeleteObject(region), 1);
  });

  check('MaskBlt routes the public ROP4 API through the WAT mask kernel', () => {
    const srcBits = allocZero(8);
    wat.guest_write32(srcBits, 0x00112233);
    wat.guest_write32(srcBits + 4, 0x00445566);
    const dstBits = allocZero(8);
    wat.guest_write32(dstBits, 0x00aabbcc);
    wat.guest_write32(dstBits + 4, 0x00ddeeff);
    const maskBits = allocZero(2);
    writeByte(maskBits, 0x80);
    const srcBitmap = wat.test_call_CreateBitmap(2, 1, 1, 32, srcBits) >>> 0;
    const dstBitmap = wat.test_call_CreateBitmap(2, 1, 1, 32, dstBits) >>> 0;
    const maskBitmap = wat.test_call_CreateBitmap(2, 1, 1, 1, maskBits) >>> 0;
    const srcDc = wat.test_call_CreateCompatibleDC(0) >>> 0;
    const dstDc = wat.test_call_CreateCompatibleDC(0) >>> 0;
    assert(srcBitmap && dstBitmap && maskBitmap && srcDc && dstDc);
    wat.test_call_SelectObject(srcDc, srcBitmap);
    wat.test_call_SelectObject(dstDc, dstBitmap);
    assert.strictEqual(wat.test_call_MaskBlt(
      dstDc, 0, 0, 2, 1, srcDc, 0, 0, maskBitmap, 0, 0, 0xaacc0020), 1);
    const output = allocZero(8);
    assert.strictEqual(wat.test_call_GetBitmapBits(dstBitmap, 8, output), 8);
    assert.strictEqual(wat.guest_read32(output) >>> 0, 0x00112233);
    assert.strictEqual(wat.guest_read32(output + 4) >>> 0, 0x00ddeeff);
    [srcBitmap, dstBitmap, maskBitmap].forEach(bitmap => wat.test_call_DeleteObject(bitmap));
    [srcDc, dstDc].forEach(dc => wat.test_call_DeleteDC(dc));
  });

  console.log(`\n${passed}/${passed} checks passed`);
  await bitmapSpanMapping();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
