'use strict';

// Generated plane bytes test scanout addressing; they are not native gameplay.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Machine, vgaGeometry } = require('../tools/toyvm/dos');
const { readFrame } = require('../tools/toyvm/framebuffer');
const isa = require('../tools/toyvm/isa');
function video(compare, repeat = 1, bpp = 4) {
  const crtc = new Uint8Array(32), attr = Uint8Array.from({ length: 32 }, (_, n) => n < 16 ? n : 0);
  crtc[1] = 1; crtc[0x12] = 11; crtc[0x13] = 2;
  crtc[0x0c] = 0x10; crtc[0x0d] = 0x20;
  crtc[0x18] = compare & 255;
  crtc[7] = (compare & 256) >> 4;
  crtc[9] = repeat - 1 | ((compare & 512) >> 3);
  return vgaGeometry({ crtc, attr, bpp, planar: true });
}
function memory() { return new Uint8Array(isa.VGA_PLANES + 4 * 65536); }
function solid(mem, address, bytes, color) {
  for (let p = 0; p < 4; p++) mem.fill(color & (1 << p) ? 255 : 0,
    isa.VGA_PLANES + p * 65536 + address, isa.VGA_PLANES + p * 65536 + address + bytes);
}

test('line compare uses all ten bits independently of VDE overflow', () => {
  for (const [compare, split] of [[0, 1], [255, 256], [256, 257], [367, 368], [512, 513], [1023, 1024]]) {
    assert.equal(video(compare).splitRow, split);
  }
  assert.equal(video(3, 2).splitRow, 2);
});

test('4-bit scanout preserves start/stride above split, resets address to zero below it', () => {
  const g = video(2), mem = memory(), bytes = g.stride / 8;
  for (let y = 0; y < g.height; y++) {
    solid(mem, g.start + y * bytes, bytes, y + 1);
    solid(mem, y * bytes, bytes, y + 8);
  }
  const f = readFrame(mem, g);
  for (let y = 0; y < g.height; y++) {
    const expected = y < 3 ? y + 1 : y - 3 + 8;
    assert.deepEqual([...f.pixels.subarray(y * g.width, (y + 1) * g.width)], Array(g.width).fill(expected & 15));
  }
});

test('compare zero repeats address zero on the second row, disabled compare keeps scrolling', () => {
  for (const compare of [0, 1023]) {
    const g = { ...video(compare), start: 0 }, mem = memory(), bytes = g.stride / 8;
    for (let y = 0; y < g.height; y++) solid(mem, y * bytes, bytes, y + 1);
    const f = readFrame(mem, g);
    assert.equal(f.pixels[g.width], compare === 0 ? 1 : 2);
  }
});

test('mode-X planar scanout also resets each plane address at an aligned doubled scan line', () => {
  const g = video(3, 2, 8), mem = memory(), bytes = g.stride / 4;
  for (let p = 0; p < 4; p++) for (let y = 0; y < g.height; y++) {
    mem.fill(y + 1, isa.VGA_PLANES + p * 65536 + g.start + y * bytes,
      isa.VGA_PLANES + p * 65536 + g.start + (y + 1) * bytes);
    mem.fill(y + 40, isa.VGA_PLANES + p * 65536 + y * bytes,
      isa.VGA_PLANES + p * 65536 + (y + 1) * bytes);
  }
  const f = readFrame(mem, g);
  assert.equal(f.pixels[g.width], 2);
  assert.equal(f.pixels[g.width * 2], 40);
  assert.equal(f.pixels[g.width * 3], 41);
});

test('BIOS graphics mode defaults keep line compare beyond every visible row', () => {
  const m = new Machine(new Uint8Array(1 << 20));
  const r = { get: () => 0, set: () => {} };
  for (const mode of [0x0d, 0x0e, 0x10, 0x12, 0x13]) {
    m.int10(0, mode, r);
    const g = vgaGeometry(m.vga);
    assert(g.splitRow >= g.height, `mode ${mode.toString(16)} accidentally enables split`);
  }
});
