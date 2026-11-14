'use strict';

// Pure registers and generated plane/DAC bytes: no Machine or guest execution.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectPalettePage, paletteDacIndex } = require('../tools/toyvm/vga-palette-page');
const { vgaGeometry } = require('../tools/toyvm/dos');
const { readFrame, rgbaFrame } = require('../tools/toyvm/framebuffer');
const isa = require('../tools/toyvm/isa');

const ega = [0, 1, 2, 3, 4, 5, 0x14, 7, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F];
function attributes() {
  const attr = new Uint8Array(32);
  attr.set(ega);
  return attr;
}
function indices(attr) {
  return Array.from(attr.subarray(0, 16), c => paletteDacIndex(c, attr[0x10], attr[0x14]));
}
function geometry(attr) {
  // An eight-pixel row derived from real CRTC fields, with one byte per plane.
  const v = { attr, bpp: 4, planar: true, crtc: new Uint8Array(32) };
  v.crtc[0x13] = 1;
  return { ...vgaGeometry(v), width: 8, height: 1, stride: 8 };
}
function planes() {
  const mem = new Uint8Array(isa.VGA_PLANES + 4 * 0x10000);
  // Pixels 0,1,2,3,4,5,6,15, with MSB-first bits and independent planes.
  const pixels = [0, 1, 2, 3, 4, 5, 6, 15];
  for (let p = 0; p < 4; p++) {
    mem[isa.VGA_PLANES + p * 0x10000] = pixels.reduce((b, c, x) => b | (((c >>> p) & 1) << (7 - x)), 0);
  }
  return mem;
}

test('1013/0100 changes only mode bit7, preserving page, palette and unrelated bits', () => {
  for (let mode = 0; mode < 256; mode++) {
    const attr = Uint8Array.from({ length: 32 }, (_, i) => i * 7);
    attr[0x10] = mode;
    const want = attr.slice(); want[0x10] = mode | 0x80;
    assert.equal(selectPalettePage(attr, 0x0100), true);
    assert.deepEqual(attr, want);
    assert.equal(selectPalettePage(attr, 0), true);
    want[0x10] = mode & 0x7F;
    assert.deepEqual(attr, want);
  }
});

test('all documented pages select the appropriate Color Select bits without touching DAC/palette', () => {
  for (const mode of [0, 1]) {
    const attr = attributes();
    selectPalettePage(attr, mode << 8);
    for (let page = 0; page < (mode ? 16 : 4); page++) {
      const want = attr.slice(); want[0x14] = mode ? page : page * 4;
      assert.equal(selectPalettePage(attr, (page << 8) | 1), true);
      assert.deepEqual(attr, want);
    }
  }
});

test('undefined selectors and out-of-domain pages decline atomically', () => {
  for (const mode of [0, 1]) {
    const attr = attributes(); selectPalettePage(attr, mode << 8);
    const before = attr.slice();
    for (const bx of [0x0200, 0xFF00, 2, 0xFF02, mode ? 0x1001 : 0x0401, 0xFF01]) {
      assert.equal(selectPalettePage(attr, bx), false);
      assert.deepEqual(attr, before);
    }
  }
});

test('DAC addresses exhaustively match independent per-wire oracle', () => {
  for (let value = 0; value < 256; value++) {
    for (let select = 0; select < 16; select++) {
      for (const mode of [0, 0x7F, 0x80, 0xFF]) {
        let expected = 0;
        for (let bit = 0; bit < 8; bit++) {
          const fromSelect = bit >= 6 || (bit >= 4 && (mode & 128));
          const source = fromSelect ? select : value;
          expected += ((source >>> (fromSelect ? bit - 4 : bit)) & 1) * (2 ** bit);
        }
        assert.equal(paletteDacIndex(value, mode, select), expected);
      }
    }
  }
});

test('original HEG mode12 -> 1013/0100 -> identity1..15 is output-equivalent to old mapping', () => {
  const attr = attributes();
  assert.equal(attr[0x10], 0); assert.equal(attr[0x14], 0);
  selectPalettePage(attr, 0x0100);
  // Before HEG writes identity, default EGA slots really DO differ.
  assert.equal(indices(attr)[6], 4);
  assert.equal(indices(attr)[8], 8);
  for (let c = 15; c >= 1; c--) attr[c] = c;
  assert.equal(attr[0], 0);
  assert.deepEqual(indices(attr), Array.from({ length: 16 }, (_, c) => c));
  const mem = planes();
  const g = geometry(attr);
  assert.deepEqual(readFrame(mem, g).pixels,
    readFrame(mem, { ...g, attrMode: 0, colorSelect: 0 }).pixels);
});

test('mode switching preserves raw page register and exposes real non-equivalence boundary', () => {
  const attr = attributes();
  selectPalettePage(attr, 0x0100); selectPalettePage(attr, 0x0901);
  assert.equal(indices(attr)[6], 0x94);
  selectPalettePage(attr, 0);
  assert.equal(attr[0x14], 9);
  assert.equal(indices(attr)[6], 0x94); // palette 14h + page bits 80h
  assert.equal(indices(attr)[8], 0xB8);
  selectPalettePage(attr, 0x0201);
  assert.equal(attr[0x14], 8); // BIOS page write clears unused low bits
  selectPalettePage(attr, 0x0100);
  assert.equal(indices(attr)[8], 0x88);
});

test('four-plane byte renderer and RGBA use all256 DAC entries through every page', () => {
  const attr = attributes(), mem = planes(), palette = new Uint8Array(768);
  // Generated DAC triples distinguish pages; they are not guessed TIM colours.
  for (let i = 0; i < 256; i++) palette.set([i & 63, (i >>> 2) & 63, (i >>> 4) & 63], i * 3);
  const pixels = [0, 1, 2, 3, 4, 5, 6, 15];
  const beforeMem = mem.slice(), beforeDac = palette.slice();
  for (const mode of [0, 1]) {
    selectPalettePage(attr, mode << 8);
    for (let page = 0; page < (mode ? 16 : 4); page++) {
      selectPalettePage(attr, (page << 8) | 1);
      const g = geometry(attr);
      const expected = pixels.map(c => (mode ? ega[c] % 16 : ega[c]) + page * (mode ? 16 : 64));
      assert.deepEqual([...readFrame(mem, g).pixels], expected);
      const rgb = expected.flatMap(c => [...palette.subarray(3 * c, 3 * c + 3)].map(v => Math.round(v * 255 / 63)).concat(255));
      assert.deepEqual([...rgbaFrame(mem, palette, g).rgba], rgb);
    }
  }
  assert.deepEqual(mem, beforeMem); assert.deepEqual(palette, beforeDac);
});

test('geometry snapshots page state; legacy four-bit geometry still masks to six bits', () => {
  const attr = attributes(), mem = planes();
  const g = geometry(attr);
  selectPalettePage(attr, 0x0100); selectPalettePage(attr, 0x0F01);
  assert.equal(g.attrMode, 0); assert.equal(g.colorSelect, 0);
  assert.deepEqual([...readFrame(mem, g).pixels], [0, 1, 2, 3, 4, 5, 0x14, 0x3F]);
  assert.deepEqual([...readFrame(mem, { ...g, attr: ega.map(c => c | 0xC0), attrMode: undefined, colorSelect: undefined }).pixels],
    [0, 1, 2, 3, 4, 5, 0x14, 0x3F]);
});

test('eight-bit chained and unchained bytes bypass attribute paging', () => {
  const mem = planes(), attr = new Array(16).fill(0), common = { attr, attrMode: 0x80, colorSelect: 15 };
  const source = [0, 15, 16, 63, 64, 127, 128, 255];
  mem.set(source, 0);
  assert.deepEqual([...readFrame(mem, { ...common, base: 0, width: 8, height: 1, stride: 8, start: 0, planar: false, bpp: 8 }).pixels], source);
  for (let x = 0; x < 8; x++) mem[isa.VGA_PLANES + (x % 4) * 0x10000 + (x >>> 2)] = source[x];
  assert.deepEqual([...readFrame(mem, { ...common, width: 8, height: 1, stride: 8, start: 0, planar: true, bpp: 8 }).pixels], source);
});
