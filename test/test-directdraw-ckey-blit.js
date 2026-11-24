#!/usr/bin/env node
'use strict';

// IDirectDrawSurface::BltFast and Blt(DDBLT_KEYSRC) copy colour-keyed sprites
// through $dx_ckey_copy_rect, a width-dispatched, 16-bytes-at-a-time SIMD copy
// that replaced a per-pixel loop re-testing bytes-per-pixel on every pixel
// (60% of Moorhuhn 3's gameplay CPU). Run randomized surfaces through the real
// handlers and compare every destination byte with an immutable-source model:
//
//   * per-pixel selection: `if (src_px != key) dst_px = src_px`
//     where src_px is the zero-extended 8/16/32-bit pixel, so an 8/16-bit key
//     that does not fit the pixel keys nothing;
//   * a surface blitting onto itself reads pixels from before the copy;
//   * BltFast clamps the source rect to both surfaces and ignores
//     DDBLTFAST_DESTCOLORKEY (the old code did too);
//   * 24bpp steps 3 bytes and compares the low 24 bits of the key (the old loop
//     read 32-bit pixels at a 4-byte stride here, which was simply wrong).
//
// Widths cover every SIMD tail length for every pixel size, and pixel values are
// drawn so that single bytes / halves of the key occur often: a lane-width bug
// (comparing 8-bit lanes on a 16-bit surface) cannot pass.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const ESP = 0x30000;
const RECT = 0x410000;

const extraWat = String.raw`
  (func (export "test_ck_surface_new") (param $w i32) (param $h i32) (param $bpp i32)
      (param $pitch i32) (param $key i32) (result i32)
    (local $surface i32) (local $entry i32)
    (local.set $surface (call $dx_create_com_obj (i32.const 2) (i32.const 0x52000000)))
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (i32.store16 offset=12 (local.get $entry) (local.get $w))
    (i32.store16 offset=14 (local.get $entry) (local.get $h))
    (i32.store16 offset=16 (local.get $entry) (local.get $bpp))
    (i32.store16 offset=18 (local.get $entry) (local.get $pitch))
    (i32.store offset=20 (local.get $entry)
      (call $g2w (call $dib_alloc (i32.mul (local.get $pitch) (local.get $h)))))
    (i32.store offset=24 (local.get $entry) (local.get $key))
    (i32.store offset=28 (local.get $entry) (i32.const 0x104))
    (local.get $surface))

  (func (export "test_ck_surface_bits") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))

  (func (export "test_ck_bltfast")
    (param $dst i32) (param $x i32) (param $y i32) (param $src i32) (param $rect i32)
    (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${ESP}))
    (call $handle_IDirectDrawSurface_BltFast
      (local.get $dst) (local.get $x) (local.get $y) (local.get $src) (local.get $rect)
      (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_ck_blt")
    (param $dst i32) (param $dst_rect i32) (param $src i32) (param $src_rect i32)
    (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${ESP}))
    (call $handle_IDirectDrawSurface_Blt
      (local.get $dst) (local.get $dst_rect) (local.get $src) (local.get $src_rect)
      (local.get $flags) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

// Deterministic PRNG so a failure is reproducible.
let seed = 0x1234567;
const rnd = n => {
  seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
  return (seed >>> 8) % n;
};

function readPx(mem, off, bps) {
  if (bps === 1) return mem[off];
  if (bps === 2) return mem[off] | (mem[off + 1] << 8);
  if (bps === 3) return mem[off] | (mem[off + 1] << 8) | (mem[off + 2] << 16);
  return (mem[off] | (mem[off + 1] << 8) | (mem[off + 2] << 16) | (mem[off + 3] << 24)) >>> 0;
}
function writePx(mem, off, bps, v) {
  for (let i = 0; i < bps; i++) mem[off + i] = (v >>> (8 * i)) & 0xff;
}

// Immutable-source copy, modeled over a JS copy of a span of WASM memory
// (mem.base is the WASM address of mem[0]).
function refCopy(mem, d, s, w, h, bps, key, keyed) {
  const cmpKey = bps === 3 ? (key & 0xffffff) : (key >>> 0);
  const source = mem.slice();
  for (let row = 0; row < h; row++) {
    for (let x = 0; x < w; x++) {
      const so = s.bits - mem.base + (s.y + row) * s.pitch + (s.x + x) * bps;
      const dof = d.bits - mem.base + (d.y + row) * d.pitch + (d.x + x) * bps;
      const v = readPx(source, so, bps);
      if (!keyed || v !== cmpKey) writePx(mem, dof, bps, v);
    }
  }
}

function pixelValue(bps, key) {
  const full = bps === 4 ? 0xffffffff : (1 << (8 * bps)) - 1;
  switch (rnd(6)) {
    case 0: case 1: return key & full;                     // the key itself
    case 2: return (key & 0xff) >>> 0;                      // key's low byte only
    case 3: return ((key & 0xff) * 0x01010101) & full;      // key byte in every byte
    case 4: return (key ^ (1 << (8 * rnd(bps)))) & full;    // key with one byte perturbed
    default: return (rnd(0x10000) | (rnd(0x10000) << 16)) & full;
  }
}

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const writeRect = (l, t, r, b, at = RECT) => {
    wat.guest_write32(at, l); wat.guest_write32(at + 4, t);
    wat.guest_write32(at + 8, r); wat.guest_write32(at + 12, b);
  };

  const KEYS = {
    8: [0x00, 0xfe, 0x1fe],                // 0x1fe does not fit: keys nothing
    16: [0xf81f, 0x0000, 0x1f00, 0x1f81f], // 0x1f81f does not fit
    24: [0xff00ff, 0x000000, 0x5a00ff5a],  // high byte ignored
    32: [0x00ff00ff, 0xff00ff00, 0x00000000],
  };

  function makeSurface(w, h, bpp, key) {
    const bps = bpp >> 3;
    const pitch = w * bps + rnd(3) * (bps === 1 || bps === 3 ? 1 : bps); // odd pitch where legal
    const surf = wat.test_ck_surface_new(w, h, bpp, pitch, key) >>> 0;
    assert(surf, 'surface fixture should allocate');
    const bits = wat.test_ck_surface_bits(surf) >>> 0;
    return { surf, bits, pitch, w, h, bps, key };
  }
  function fill(sf) {
    const mem = new Uint8Array(memory.buffer);
    for (let y = 0; y < sf.h; y++) {
      for (let x = 0; x < sf.w; x++) writePx(mem, sf.bits + y * sf.pitch + x * sf.bps, sf.bps, pixelValue(sf.bps, sf.key));
      for (let p = sf.w * sf.bps; p < sf.pitch; p++) mem[sf.bits + y * sf.pitch + p] = 0xa5;
    }
    return sf;
  }

  function check(label, run, model, regions) {
    // Model on a copy of just the span holding the surfaces' bits.
    const base = Math.min(...regions.map(r => r[0]));
    const top = Math.max(...regions.map(r => r[0] + r[1]));
    const expect = new Uint8Array(memory.buffer).slice(base, top);
    expect.base = base;
    model(expect);
    assert.strictEqual(run() >>> 0, 0, `${label}: DD_OK`);
    const got = new Uint8Array(memory.buffer);
    for (const [lo, len] of regions) {
      for (let i = lo; i < lo + len; i++) {
        if (got[i] !== expect[i - base]) {
          assert.fail(`${label}: byte +0x${(i - lo).toString(16)} got 0x${got[i].toString(16)} expected 0x${expect[i - base].toString(16)}`);
        }
      }
    }
  }

  let cases = 0;
  for (const bpp of [8, 16, 24, 32]) {
    const bps = bpp >> 3;
    for (const key of KEYS[bpp]) {
      const srcS = makeSurface(48, 5, bpp, key);
      const dstS = makeSurface(52, 7, bpp, key);
      const selfS = makeSurface(64, 6, bpp, key);
      // Widths 1..40 cover every tail length after the 16-byte vectors.
      for (let w = 1; w <= 40; w++) {
        const src = fill(srcS);
        const dst = fill(dstS);
        const sx = rnd(8), sy = rnd(2), h = 1 + rnd(3);
        const x = rnd(52), y = rnd(7);          // may clamp at the right/bottom edge
        for (const trans of [0, 1, 2, 3]) {
          wat.guest_write32(ESP + 24, trans);
          writeRect(sx, sy, sx + w, sy + h);
          const cw = Math.min(w, src.w - sx, dst.w - x), ch = Math.min(h, src.h - sy, dst.h - y);
          check(`BltFast ${bpp}bpp key=0x${key.toString(16)} w=${w} trans=${trans}`,
            () => wat.test_ck_bltfast(dst.surf, x, y, src.surf, RECT),
            m => {
              if (trans & 1) refCopy(m, { ...dst, x, y }, { ...src, x: sx, y: sy }, cw, ch, bps, key, true);
              else refCopy(m, { ...dst, x, y }, { ...src, x: sx, y: sy }, cw, ch, bps, key, false);
            },
            [[dst.bits, dst.pitch * dst.h], [src.bits, src.pitch * src.h]]);
          cases++;
        }
        // Blt with DDBLT_KEYSRC | DDBLT_WAIT, equal-size, in bounds.
        const bx = rnd(52 - w + 1), by = rnd(4);
        writeRect(bx, by, bx + w, by + h, RECT + 0x20);
        writeRect(sx, sy, sx + w, sy + h);
        check(`Blt KEYSRC ${bpp}bpp key=0x${key.toString(16)} w=${w}`,
          () => wat.test_ck_blt(dst.surf, RECT + 0x20, src.surf, RECT, 0x01008000),
          m => refCopy(m, { ...dst, x: bx, y: by }, { ...src, x: sx, y: sy }, w, h, bps, key, true),
          [[dst.bits, dst.pitch * dst.h], [src.bits, src.pitch * src.h]]);
        cases++;
      }
      // A surface blitting onto itself: every small offset, both directions,
      // same row and adjacent rows, preserving all pre-copy source pixels.
      for (let w = 1; w <= 36; w += 5) {
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [3, 0], [-5, 0], [0, 1], [2, 1], [-2, -1], [17, 0], [-16, 0], [0, 0]]) {
          const s = fill(selfS);
          const sx = 20, sy = 2, h = 2;
          const x = sx + ddx, y = sy + ddy;
          wat.guest_write32(ESP + 24, 1);
          writeRect(sx, sy, sx + w, sy + h);
          const cw = Math.min(w, s.w - sx, s.w - x), ch = Math.min(h, s.h - sy, s.h - y);
          check(`BltFast self-overlap ${bpp}bpp key=0x${key.toString(16)} w=${w} d=(${ddx},${ddy})`,
            () => wat.test_ck_bltfast(s.surf, x, y, s.surf, RECT),
            m => refCopy(m, { ...s, x, y }, { ...s, x: sx, y: sy }, cw, ch, bps, key, true),
            [[s.bits, s.pitch * s.h]]);
          cases++;
        }
      }
    }
  }
  console.log(`PASS  colour-keyed BltFast/Blt match the scalar model over ${cases} cases (8/16/24/32bpp, odd widths, clamping, self-overlap)`);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
