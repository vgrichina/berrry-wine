#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (func (export "dt_hold") (param i32 i32) (result i32)
    (call $guest_span_in (local.get 0) (local.get 1)))
  (func (export "dt_drop") (param i32 i32)
    (call $guest_span_release (local.get 0) (local.get 1)))
  (func (export "dt_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "dt_regs") (result i32) (global.get $reg_base))
  (func (export "dt_resolve") (param i32) (result i32)
    (call $handle_GetProcAddress (i32.const 0) (local.get 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "dt_call") (param i32)
    (global.set $eip (i32.const 0x456789ab))
    (call $win32_dispatch (i32.shr_u
      (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
  (func (export "test_call_DrawTextExA")
        (param i32 i32 i32 i32 i32 i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $saved_esp) (i32.const 24)) (local.get 5))
    (call $handle_DrawTextExA
      (local.get 0) (local.get 1) (local.get 2) (local.get 3)
      (local.get 4) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_call_DrawTextExW")
        (param i32 i32 i32 i32 i32 i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $saved_esp) (i32.const 24)) (local.get 5))
    (call $handle_DrawTextExW
      (local.get 0) (local.get 1) (local.get 2) (local.get 3)
      (local.get 4) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))`;

(async () => {
  const { exports: wat, memory, hostCtx } = await bootRenderHarness({ extraWat });
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = wat.get_image_base() >>> 0;
  const wa = guest => RegionMap.g2w(guest, imageBase);
  const allocZero = size => {
    const pointer = wat.guest_alloc(size) >>> 0;
    bytes.fill(0, wa(pointer), wa(pointer) + size);
    return pointer;
  };
  const writeAnsi = value => {
    const pointer = allocZero(value.length + 1);
    bytes.set(Buffer.from(value, 'latin1'), wa(pointer));
    return pointer;
  };
  const writeWide = value => {
    const pointer = allocZero((value.length + 1) * 2);
    [...value].forEach((character, index) =>
      wat.guest_write16(pointer + index * 2, character.charCodeAt(0)));
    return pointer;
  };
  const writeRect = (pointer, left, top, right, bottom) => {
    wat.guest_write32(pointer, left);
    wat.guest_write32(pointer + 4, top);
    wat.guest_write32(pointer + 8, right);
    wat.guest_write32(pointer + 12, bottom);
  };
  const writeParams = (pointer, size, tabs, left, right, drawn = 0xdeadbeef) => {
    wat.guest_write32(pointer, size);
    wat.guest_write32(pointer + 4, tabs);
    wat.guest_write32(pointer + 8, left);
    wat.guest_write32(pointer + 12, right);
    wat.guest_write32(pointer + 16, drawn);
  };

  const fnt = Buffer.alloc(143);
  fnt.writeUInt16LE(0x0200, 0);
  fnt.writeUInt32LE(fnt.length, 2);
  fnt.writeUInt16LE(8, 74);
  fnt.writeUInt16LE(400, 83);
  fnt.writeUInt16LE(8, 88);
  fnt.writeUInt16LE(8, 91);
  fnt.writeUInt16LE(8, 93);
  fnt[95] = 65;
  fnt[96] = 65;
  fnt.writeUInt32LE(134, 105);
  fnt.writeUInt16LE(8, 118);
  fnt.writeUInt16LE(126, 120);
  fnt.writeUInt16LE(134, 124);
  fnt.fill(0xff, 126, 134);
  fnt.write('ExParams\0', 134, 'latin1');
  hostCtx.vfs.files.set('c:\\exparams.fon', { data: new Uint8Array(fnt), attrs: 0x20 });
  const fontPath = writeAnsi('EXPARAMS.FON');
  assert.strictEqual(wat.test_call_AddFontResourceA(fontPath), 1);

  const width = 128;
  const height = 32;
  const bmi = allocZero(40);
  wat.guest_write32(bmi, 40);
  wat.guest_write32(bmi + 4, width);
  wat.guest_write32(bmi + 8, -height);
  wat.guest_write16(bmi + 12, 1);
  wat.guest_write16(bmi + 14, 32);
  const bitsOut = allocZero(4);
  const bitmap = wat.test_call_CreateDIBSection(0, bmi, 0, bitsOut, 0, 0) >>> 0;
  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  wat.test_call_SelectObject(hdc, bitmap);
  const face = writeWide('ExParams');
  const font = wat.test_call_CreateFontW(-8, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, face) >>> 0;
  wat.test_call_SelectObject(hdc, font);
  wat.test_gdi_dc_set_field(hdc, 28, 1, 2); // TRANSPARENT
  wat.test_gdi_dc_set_field(hdc, 20, 0x000000, 0); // black
  assert.strictEqual(wat.test_call_PatBlt(hdc, 0, 0, width, height, 0x00F00021), 1);

  const rect = allocZero(16);
  const params = allocZero(20);
  const ansi = writeAnsi('AA');
  writeRect(rect, 0, 0, 80, 16);
  writeParams(params, 20, 0, 8, 16);
  assert.strictEqual(wat.test_call_DrawTextExA(hdc, ansi, 2, rect, 0, params), 8);
  assert.deepStrictEqual([0, 4, 8, 12].map(offset => wat.guest_read32(rect + offset)),
    [0, 0, 80, 16], 'non-CALCRECT calls must restore the caller rectangle');
  assert.strictEqual(wat.guest_read32(params + 16), 2, 'uiLengthDrawn for explicit ANSI count');
  const dibBits = wat.guest_read32(bitsOut) >>> 0;
  const pixel = (x, y) => wat.guest_read32(dibBits + (y * width + x) * 4) & 0xffffff;
  assert.strictEqual(pixel(3, 3), 0xffffff, 'left margin must remain blank');
  assert.strictEqual(pixel(11, 3), 0, 'text must begin inside the left margin');

  writeRect(rect, 0, 0, 100, 20);
  writeParams(params, 20, 0, 8, 16);
  assert.strictEqual(wat.test_call_DrawTextExA(hdc, ansi, 2, rect, 0x400, params), 8);
  assert.deepStrictEqual([0, 4, 8, 12].map(offset => wat.guest_read32(rect + offset)),
    [0, 0, 40, 8], 'CALCRECT width must include both DrawTextEx margins');

  const tabbed = writeAnsi('A\tA');
  writeRect(rect, 0, 0, 100, 20);
  writeParams(params, 20, 2, 0, 0);
  assert.strictEqual(wat.test_call_DrawTextExA(hdc, tabbed, -1, rect, 0x40 | 0x400, params), 8);
  assert.strictEqual(wat.guest_read32(rect + 8), 24,
    'iTabLength=2 must override the default eight-cell interval without losing CALCRECT');
  assert.strictEqual(wat.guest_read32(params + 16), 3,
    'uiLengthDrawn must resolve a null-terminated ANSI count');

  const wide = writeWide('AA');
  writeRect(rect, 0, 0, 100, 20);
  writeParams(params, 20, 0, 4, 4);
  assert.strictEqual(wat.test_call_DrawTextExW(hdc, wide, -1, rect, 0x400, params), 8);
  assert.strictEqual(wat.guest_read32(rect + 8), 24, 'wide CALCRECT must include margins');
  assert.strictEqual(wat.guest_read32(params + 16), 2,
    'uiLengthDrawn must resolve a null-terminated UTF-16 count');

  writeRect(rect, 0, 0, 100, 20);
  writeParams(params, 16, 0, 20, 20);
  assert.strictEqual(wat.test_call_DrawTextExA(hdc, ansi, 2, rect, 0x400, params), 8);
  assert.strictEqual(wat.guest_read32(rect + 8), 16, 'undersized params must be ignored');
  assert.strictEqual(wat.guest_read32(params + 16) >>> 0, 0xdeadbeef,
    'undersized params must not receive uiLengthDrawn');

  // Public resolved thunks, real stdcall frames, and deliberately interleaved
  // sparse allocations: a raw g2w followed by a physical read hits the decoy.
  wat.dt_init();
  const view = new DataView(memory.buffer);
  const regs = wat.dt_regs() >>> 0;
  const frame = allocZero(256), stack = frame + 64;
  const apis = new Map();
  const apiTable = require('../src/api_table.json');
  for (const name of ['DrawTextA', 'DrawTextW', 'DrawTextExA', 'DrawTextExW']) {
    view.setUint32(regs + 16, stack, true);
    const thunk = wat.dt_resolve(writeAnsi(name)) >>> 0;
    assert.ok(thunk, name);
    const entry = apiTable.find(row => row.name === name);
    assert.strictEqual(wat.guest_read32(thunk + 4), entry.id);
    apis.set(name, { thunk, nargs: entry.nargs });
  }
  const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => wat.guest_read8(p + i)));
  const put = (p, data) => data.forEach((v, i) => wat.guest_write8(p + i, v));
  const physical = p => wat.guest_to_wasm(p) >>> 0;
  function invoke(name, args, occupied = 0) {
    const entry = apis.get(name);
    assert.strictEqual(args.length, entry.nargs);
    bytes.fill(0x5a, wa(frame), wa(frame) + 256);
    wat.guest_write32(stack, 0x12345678);
    args.forEach((v, i) => wat.guest_write32(stack + 4 + i * 4, v));
    const before = read(frame, 256);
    const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566,
      stack, 0x44556677, 0x55667788, 0x66778899];
    seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true));
    wat.dt_call(entry.thunk);
    assert.strictEqual(wat.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
    assert.strictEqual(wat.get_eip() >>> 0, 0x456789ab, name + ' EIP');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.strictEqual(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
    assert.deepStrictEqual(read(frame, 256), before, name + ' stack');
    assert.strictEqual(wat.guest_span_cursor_bytes(), occupied, name + ' released spans');
    assert.strictEqual(wat.guest_span_overflow_count(), 0, name + ' no span overflow');
    return wat.get_eax() >>> 0;
  }
  const backing = [];
  const split = [0x30000000, 0x31000000, 0x32000000];
  split.forEach((base, i) => {
    const decoy = 0x28000000 + i * 0x10000;
    for (const p of [base, decoy, base + 4096, decoy + 4096]) {
      assert.strictEqual(wat.test_virtual_map_commit(p, 4096) >>> 0, p);
      backing.push(Buffer.from(memory.buffer, physical(p), 4096));
    }
    assert.notStrictEqual(physical(base + 4096), physical(base) + 4096);
    assert.strictEqual(physical(decoy), physical(base) + 4096);
  });
  const adjacent = 0x33000000;
  assert.strictEqual(wat.test_virtual_map_commit(adjacent, 24576) >>> 0, adjacent);
  assert.strictEqual(physical(adjacent + 4096), physical(adjacent) + 4096);
  backing.push(Buffer.from(memory.buffer, physical(adjacent), 24576));
  const direct = allocZero(24576);
  backing.push(Buffer.from(memory.buffer, physical(direct), 24576));
  const rectData = values => {
    const data = Buffer.alloc(16);
    values.forEach((v, i) => data.writeInt32LE(v, i * 4));
    return data;
  };
  let publicCalls = 0;
  for (const name of apis.keys()) {
    const wideApi = name.endsWith('W'), extended = name.includes('Ex');
    for (const count of [-1, 1, 2, 0]) {
      for (const calculate of [false, true]) {
        for (let cut = 0; cut <= 20; cut++) {
          const locations = cut === 0 ? [direct + 4095, direct + 12285, direct + 20477]
            : cut === 20 ? [adjacent + 4095, adjacent + 12285, adjacent + 20477]
              : [split[0] + 4096 - (1 + cut % 5),
                split[1] + 4096 - (1 + cut % 15), split[2] + 4096 - cut];
          const [textPtr, rectPtr, paramsPtr] = locations;
          backing.forEach(b => b.fill(0xa5));
          put(textPtr, Buffer.from('AA\0', wideApi ? 'utf16le' : 'latin1'));
          writeRect(rectPtr, 0, 0, 100, 20);
          writeParams(paramsPtr, 20, 0, 8, 16);
          const expected = backing.map(b => Buffer.from(b));
          const expectWrite = (p, data) => data.forEach((v, i) => {
            const address = physical(p + i);
            const index = backing.findIndex(b => address >= b.byteOffset && address < b.byteOffset + b.length);
            assert.ok(index >= 0);
            expected[index][address - backing[index].byteOffset] = v;
          });
          const drawn = count === -1 ? 2 : count;
          if (calculate) expectWrite(rectPtr, rectData([0, 0, drawn * 8 + (extended ? 24 : 0), drawn ? 8 : 0]));
          if (extended) {
            const data = Buffer.alloc(4); data.writeUInt32LE(drawn);
            expectWrite(paramsPtr + 16, data);
          }
          assert.strictEqual(wat.test_call_PatBlt(hdc, 0, 0, width, height, 0x00F00021), 1);
          const args = [hdc, textPtr, count, rectPtr, calculate ? 0x400 : 0];
          if (extended) args.push(paramsPtr);
          assert.strictEqual(invoke(name, args), drawn ? 8 : 0, `${name}/${count}/${calculate}/${cut}`);
          publicCalls++;
          backing.forEach((b, i) => assert.deepStrictEqual(b, expected[i], `${name} exact backing/decoy ${cut}/${i}`));
          // Literal pixels from the solid 8x8 A strike, including the second
          // glyph and the entire blank area. CALCRECT must paint nothing.
          const origin = extended ? 8 : 0;
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const ink = !calculate && y < 8 && x >= origin && x < origin + drawn * 8;
            assert.strictEqual(pixel(x, y), ink ? 0 : 0xffffff,
              `${name} literal pixel ${cut}/${count}/${calculate}/${x}/${y}`);
          }
        }
      }
    }
  }
  console.log(`PASS  ${publicCalls} public DrawText A/W/Ex direct, adjacent and split text/RECT/params calls; literal pixels, exact writeback and ABI`);

  for (const name of apis.keys()) {
    const wideApi = name.endsWith('W'), extended = name.includes('Ex');
    const textPtr = split[0] + 4093, rectPtr = split[1] + 4093, paramsPtr = split[2] + 4093;
    const args = (text, rect, count, format) => {
      const values = [hdc, text, count, rect, format];
      if (extended) values.push(paramsPtr);
      return values;
    };
    const sentinel = Buffer.from(bytes.subarray(physical(0), physical(0) + 128));
    writeRect(rectPtr, 0, 0, 100, 20);
    writeParams(paramsPtr, 20, 0, 0, 0);
    put(textPtr, Buffer.from('AA\0', wideApi ? 'utf16le' : 'latin1'));
    assert.strictEqual(invoke(name, args(0, rectPtr, 2, 0)), 0, name + ' NULL text');
    assert.strictEqual(invoke(name, args(textPtr, 0, 2, 0)), 0, name + ' NULL RECT');
    assert.deepStrictEqual(Buffer.from(bytes.subarray(physical(0), physical(0) + 128)), sentinel,
      name + ' NULL sentinel untouched');
    assert.deepStrictEqual(read(rectPtr, 16), rectData([0, 0, 100, 20]));
    if (extended) {
      writeParams(paramsPtr, 16, 0, 30, 30);
      const before = read(paramsPtr, 20);
      assert.strictEqual(invoke(name, args(textPtr, rectPtr, 2, 0x400)), 8);
      assert.deepStrictEqual(read(paramsPtr, 20), before, name + ' split undersized params untouched');
      assert.deepStrictEqual(read(rectPtr, 16), rectData([0, 0, 16, 8]));
    }
    for (const count of [-1, 10]) {
      writeParams(paramsPtr, 20, 0, 0, 0);
      writeRect(rectPtr, 0, 0, 40, 16);
      const input = Buffer.from('AAAAAAAAAA\0XYZ', wideApi ? 'utf16le' : 'latin1');
      put(textPtr, input);
      assert.strictEqual(invoke(name, args(textPtr, rectPtr, count, 0x18020)), 8);
      const modified = Buffer.from(input);
      Buffer.from('AA...\0', wideApi ? 'utf16le' : 'latin1').copy(modified);
      assert.deepStrictEqual(read(textPtr, input.length), modified, name + ' modified string and tail');
      assert.deepStrictEqual(read(rectPtr, 16), rectData([0, 0, 40, 16]));
      if (extended) assert.strictEqual(wat.guest_read32(paramsPtr + 16), 10);
    }
  }

  // Five guest pages with unrelated physical successors force a >arena input
  // onto the private heap path. A held lease also forces that path for short
  // inputs; both paths must balance allocations and preserve the outer lease.
  const longBase = 0x34000000;
  for (let i = 0; i < 5; i++) {
    for (const p of [longBase + i * 4096, 0x2a000000 + i * 4096])
      assert.strictEqual(wat.test_virtual_map_commit(p, 4096) >>> 0, p);
  }
  const longInput = Buffer.alloc(20000, 65);
  put(longBase, longInput);
  for (const name of apis.keys()) {
    const wideApi = name.endsWith('W'), extended = name.includes('Ex');
    if (wideApi) for (let i = 1; i < longInput.length; i += 2) longInput[i] = 0;
    else longInput.fill(65);
    put(longBase, longInput);
    const before = wat.heap_stat(0) - wat.heap_stat(1);
    for (let repeat = 0; repeat < 3; repeat++) {
      const count = wideApi ? 10000 : 20000;
      writeRect(rect, 0, 0, 100, 20); writeParams(params, 20, 0, 0, 0);
      const args = [hdc, longBase, count, rect, 0x420];
      if (extended) args.push(params);
      assert.strictEqual(invoke(name, args), 8, name + ' long heap fallback');
      assert.deepStrictEqual(read(rect, 16), rectData([0, 0, count * 8, 8]));
      assert.deepStrictEqual(read(longBase, longInput.length), longInput);
    }
    assert.strictEqual(wat.heap_stat(0) - wat.heap_stat(1), before, name + ' balanced heap fallback');
  }
  const held = wat.dt_hold(longBase, 16300) >>> 0;
  assert.strictEqual(wat.guest_span_cursor_bytes(), 16300);
  const heldBytes = Buffer.from(bytes.subarray(held, held + 16300));
  try {
    for (const name of apis.keys()) {
      const wideApi = name.endsWith('W'), extended = name.includes('Ex');
      const textPtr = split[0] + 4093, rectPtr = split[1] + 4093, paramsPtr = split[2] + 4093;
      put(textPtr, Buffer.from('AAAAAAAAAA\0XYZ', wideApi ? 'utf16le' : 'latin1'));
      writeRect(rectPtr, 0, 0, 40, 16); writeParams(paramsPtr, 20, 0, 0, 0);
      // Consume all but 40 bytes: short text goes to heap, RECT + params fit.
      const nested = wat.dt_hold(longBase + 4093, 44) >>> 0;
      try {
        const before = wat.heap_stat(0) - wat.heap_stat(1);
        const args = [hdc, textPtr, 10, rectPtr, 0x18020];
        if (extended) args.push(paramsPtr);
        assert.strictEqual(invoke(name, args, 16344), 8);
        assert.deepStrictEqual(read(textPtr, wideApi ? 12 : 6),
          Buffer.from('AA...\0', wideApi ? 'utf16le' : 'latin1'));
        assert.strictEqual(wat.heap_stat(0) - wat.heap_stat(1), before, name + ' nested heap cleanup');
        assert.deepStrictEqual(Buffer.from(bytes.subarray(held, held + 16300)), heldBytes);
      } finally { wat.dt_drop(nested, 44); }
    }
  } finally { wat.dt_drop(held, 16300); }
  assert.strictEqual(wat.guest_span_cursor_bytes(), 0);
  console.log('PASS  NULL/zero/undersized params, DT_MODIFYSTRING, long heap fallback and occupied-arena LIFO cleanup');

  assert.strictEqual(wat.test_call_RemoveFontResourceA(fontPath), 1);
  console.log('PASS  DrawTextEx A/W honors margins, tab length, and length output');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
