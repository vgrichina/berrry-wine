#!/usr/bin/env node
'use strict';

// Public x86 stdcall thunks in the shipped module; no transformed WAT,
// synthetic descriptors, helper blits, browser or Canvas oracle.
// Extents are logical units, including under MM_ANISOTROPIC:
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-stretchblt
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

(async () => {
  const wasm = fs.readFileSync(process.argv[2] || path.join(__dirname, '../build/wine-assembly.wasm'));
  console.log('module sha256', crypto.createHash('sha256').update(wasm).digest('hex'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
    terminate_thread: () => 0, create_event: () => 0, set_event: () => 0,
    reset_event: () => 0, wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002 });
  const { instance: { exports: e } } = await WebAssembly.instantiate(wasm, imports);
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const stack = alloc(8192) + 4096, code = alloc(256), result = alloc(8);
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  let calls = 0, cases = 0, predecessorCases = 0;
  const failures = [];
  function api(name, ...args) {
    const saved = dv.getUint32(thunkWa + 4, true), ops = [];
    const word = n => ops.push(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { ops.push(0x68); word(arg); }
    ops.push(0xb8); word(thunk); ops.push(0xff, 0xd0, 0xa3); word(result);
    ops.push(0x89, 0x25); word(result + 4); ops.push(0xc3);
    ops.forEach((v, i) => e.guest_write8(code + i, v));
    try {
      dv.setUint32(thunkWa + 4, apis.find(a => a.name === name).id, true);
      e.set_esp(stack); e.call_func(code, 0, 0, 0, 0);
      for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
      assert.equal(e.get_eip(), 0, `${name}: bounded guest return`);
      assert.equal(read(result + 4), stack - 20, `${name}: stdcall cleanup`);
      assert.equal(e.get_esp() >>> 0, stack - 16, `${name}: caller RET`);
      calls++;
      return read(result);
    } finally { dv.setUint32(thunkWa + 4, saved, true); }
  }
  const W = 9, H = 7, SRCCOPY = 0xcc0020, POISON = 0xa5;
  function surface(bpp, topDown) {
    const bmi = alloc(40), out = alloc(4);
    for (let i = 0; i < 40; i++) e.guest_write8(bmi + i, 0);
    write(bmi, 40); write(bmi + 4, W); write(bmi + 8, topDown ? -H : H);
    e.guest_write16(bmi + 12, 1); e.guest_write16(bmi + 14, bpp);
    const bitmap = api('CreateDIBSection', 0, bmi, 0, out, 0, 0);
    const hdc = api('CreateCompatibleDC', 0); assert(bitmap && hdc);
    const old = api('SelectObject', hdc, bitmap); assert(old);
    const bits = read(out), wa = e.guest_to_wasm(bits) >>> 0;
    const pitch = (W * (bpp / 8) + 3) & ~3, size = pitch * H;
    // Guard only the unused tail of this DIB's allocated page, never a
    // neighbouring allocation or the allocator's metadata.
    const guard = Math.min(16, 4096 - (wa & 4095) - size); assert(guard >= 8);
    const offset = (x, y) => (topDown ? y : H - 1 - y) * pitch + x * bpp / 8;
    return { hdc, bitmap, old, wa, pitch, size, guard, offset, bpp };
  }
  function paint(s, seed) {
    bytes.fill(POISON, s.wa, s.wa + s.size + s.guard);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = s.wa + s.offset(x, y);
      bytes[p] = seed + x; bytes[p + 1] = seed + y * 3; bytes[p + 2] = 0x60 + x + y;
      if (s.bpp === 32) bytes[p + 3] = 0;
    }
  }
  function verify(label, dst, src, args, clip, stretch, scale = [1, 1, 1, 1], origin = [0, 0]) {
    const before = bytes.slice(dst.wa, dst.wa + dst.size + dst.guard);
    const source = bytes.slice(src.wa, src.wa + src.size + src.guard);
    const expected = before.slice();
    const [dx, dy, dw, dh, sx, sy, sw = dw, sh = dh] = args;
    const [vx, vy, ux, uy] = scale;
    const tx = dx * vx + origin[0], ty = dy * vy + origin[1];
    const width = dw * vx, height = dh * vy;
    for (let y = 0; y < Math.abs(height); y++) for (let x = 0; x < Math.abs(width); x++) {
      const px = tx + Math.sign(width) * x, py = ty + Math.sign(height) * y;
      if (px < 0 || py < 0 || px >= W || py >= H ||
          px < clip[0] || py < clip[1] || px >= clip[2] || py >= clip[3]) continue;
      const ax = sx * ux + (origin[2] || 0) +
        Math.sign(sw * ux) * Math.floor(x * Math.abs(sw * ux) / Math.abs(width));
      const ay = sy * uy + (origin[3] || 0) +
        Math.sign(sh * uy) * Math.floor(y * Math.abs(sh * uy) / Math.abs(height));
      assert(ax >= 0 && ax < W && ay >= 0 && ay < H, 'fixture source in bounds');
      const dp = dst.offset(px, py), sp = src.offset(ax, ay);
      for (let b = 0; b < dst.bpp / 8; b++) expected[dp + b] = source[sp + b];
    }
    const region = api('CreateRectRgn', ...clip); assert(region);
    assert(api('SelectClipRgn', dst.hdc, region));
    // Source clipping must not affect a blit (BitBlt destination-only clip).
    const empty = api('CreateRectRgn', 0, 0, 0, 0); assert(empty);
    if (src !== dst) assert(api('SelectClipRgn', src.hdc, empty));
    assert(api(stretch ? 'StretchBlt' : 'BitBlt', dst.hdc, dx, dy, dw, dh,
      src.hdc, sx, sy, ...(stretch ? [sw, sh] : []), SRCCOPY), label);
    const got = bytes.slice(dst.wa, dst.wa + dst.size + dst.guard);
    const mismatch = got.findIndex((v, i) => v !== expected[i]);
    if (mismatch >= 0) {
      const message = `${label}: byte ${mismatch}, expected ${expected[mismatch]}, got ${got[mismatch]}`;
      failures.push(message); console.log('FAIL', message);
    }
    if (src !== dst) assert.deepEqual(bytes.slice(src.wa, src.wa + src.size + src.guard), source,
      'source pixels/padding/tail canaries unchanged');
    api('SelectClipRgn', dst.hdc, 0); api('SelectClipRgn', src.hdc, 0);
    assert(api('DeleteObject', region)); assert(api('DeleteObject', empty));
    cases++; if (mismatch < 0) console.log('PASS', label);
  }
  for (const bpp of [24, 32]) for (const topDown of [true, false]) {
    const startCases = cases;
    const a = surface(bpp, topDown), b = surface(bpp, !topDown);
    const label = `${bpp}bpp ${topDown ? 'top' : 'bottom'}-down`;
    for (const [name, args, clip, stretch] of [
      ['left/top partial', [-2, -1, 7, 5, 0, 0], [0, 0, 9, 7], false],
      ['right/bottom partial', [6, 5, 3, 2, 1, 1], [0, 0, 8, 6], false],
      ['stretch partial', [-2, -1, 8, 6, 1, 1, 4, 3], [1, 1, 7, 6], true],
    ]) { paint(a, 1); paint(b, 25); verify(`${label} ${name}`, a, b, args, clip, stretch); }
    for (const [dx, dy, sx, sy] of [[1, 1, 0, 0], [0, 0, 1, 1], [1, 0, 0, 0], [0, 1, 0, 0]]) {
      paint(a, 1); verify(`${label} overlap ${dx},${dy}<-${sx},${sy}`, a, a,
        [dx, dy, 7, 5, sx, sy], [1, 1, 8, 6], false);
    }
    paint(a, 1); verify(`${label} scaled overlap`, a, a,
      [1, 1, 7, 5, 0, 0, 4, 3], [0, 0, 9, 7], true);
    // Negative logical origin plus a real mapping and destination clip.
    // A four-unit width becomes eight device pixels before clipping.
    paint(a, 1); paint(b, 25);
    assert(api('SetMapMode', a.hdc, 8));
    assert(api('SetWindowExtEx', a.hdc, 1, 1, 0));
    assert(api('SetViewportExtEx', a.hdc, 2, 2, 0));
    assert(api('SetViewportOrgEx', a.hdc, 2, 2, 0));
    verify(`${label} mapped negative origin clipped`, a, b,
      [-1, -1, 4, 3, 0, 0, 4, 3], [1, 1, 7, 6], true, [2, 2, 1, 1], [2, 2]);
    assert(api('SetMapMode', a.hdc, 1));
    api('SetViewportOrgEx', a.hdc, 0, 0, 0);
    paint(a, 1); paint(b, 25);
    assert(api('SetMapMode', b.hdc, 8));
    assert(api('SetWindowExtEx', b.hdc, 1, 1, 0));
    assert(api('SetViewportExtEx', b.hdc, 2, 2, 0));
    assert(api('SetViewportOrgEx', b.hdc, 2, 2, 0));
    verify(`${label} mapped source negative origin`, a, b,
      [0, 0, 8, 6, -1, -1, 4, 3], [1, 1, 8, 6], true, [1, 1, 2, 2], [0, 0, 2, 2]);
    predecessorCases += cases - startCases;
    assert(api('SetMapMode', b.hdc, 1));
    api('SetViewportOrgEx', b.hdc, 0, 0, 0);
    // New public-API frontier beyond the original 40 positive-extent cases.
    // Raster origins are inclusive (as used by Paint's width-1 mirror).
    // Different source/destination signs mirror an axis; equal negative
    // signs cancel. Use coordinate-coloured pixels and a snapshot oracle,
    // checking the entire native allocation rather than only the clip box.
    for (let signs = 1; signs < 16; signs++) {
      const [xd, yd, xs, ys] = [0, 1, 2, 3].map(bit => signs & (1 << bit) ? -1 : 1);
      for (const [dw, dh, sw, sh] of [[7, 5, 5, 3], [5, 3, 7, 5], [5, 3, 5, 3]]) {
        const args = [xd < 0 ? 7 : 1, yd < 0 ? 5 : 1, xd * dw, yd * dh,
          xs < 0 ? 7 : 1, ys < 0 ? 5 : 1, xs * sw, ys * sh];
        for (const clip of [[0, 0, W, H], [2, 2, 6, 5], [0, 0, 0, 0]]) {
          paint(a, 1); paint(b, 25);
          verify(`${label} signed ${signs} ${sw}x${sh}->${dw}x${dh} clip=${clip}`, a, b,
            args, clip, true);
        }
      }
      // Same-bitmap mirrors must read the original pixels even when writes
      // overlap later reads; both physical DIB orientations are exercised.
      paint(a, 1);
      verify(`${label} signed ${signs} overlap`, a, a,
        [xd < 0 ? 7 : 1, yd < 0 ? 5 : 1, xd * 7, yd * 5,
          xs < 0 ? 7 : 1, ys < 0 ? 5 : 1, xs * 5, ys * 3], [2, 2, 6, 5], true);
      paint(a, 1); paint(b, 25);
      verify(`${label} signed ${signs} off-surface destination`, a, b,
        [xd < 0 ? 3 : 6, yd < 0 ? 2 : 5, xd * 7, yd * 5,
          xs < 0 ? 7 : 1, ys < 0 ? 5 : 1, xs * 5, ys * 3], [1, 1, 8, 6], true);
      // The predecessor's endpoint fix must preserve signed logical extents
      // when both DCs scale, before clipping in device coordinates.
      for (const s of [a, b]) {
        assert(api('SetMapMode', s.hdc, 8));
        assert(api('SetWindowExtEx', s.hdc, 1, 1, 0));
        assert(api('SetViewportExtEx', s.hdc, 2, 2, 0));
      }
      paint(a, 1); paint(b, 25);
      verify(`${label} signed ${signs} mapped 2x`, a, b,
        [xd < 0 ? 3 : 1, yd < 0 ? 2 : 1, xd * 3, yd * 2,
          xs < 0 ? 2 : 1, ys < 0 ? 3 : 0, xs * 2, ys * 3],
        [1, 1, 7, 6], true, [2, 2, 2, 2]);
      for (const s of [a, b]) assert(api('SetMapMode', s.hdc, 1));
    }
    // Negative viewport scales exercise independently transformed DC axes,
    // with positive API extents and known in-bounds device-space origins.
    for (let signs = 0; signs < 16; signs++) {
      const [xd, yd, xs, ys] = [0, 1, 2, 3].map(bit => signs & (1 << bit) ? -1 : 1);
      const origin = [xd < 0 ? 6 : 1, yd < 0 ? 5 : 1, xs < 0 ? 6 : 1, ys < 0 ? 5 : 0];
      for (const [s, vx, vy, ox, oy] of [[a, xd, yd, ...origin.slice(0, 2)],
        [b, xs, ys, ...origin.slice(2)]]) {
        assert(api('SetMapMode', s.hdc, 8));
        assert(api('SetWindowExtEx', s.hdc, 1, 1, 0));
        assert(api('SetViewportExtEx', s.hdc, vx * 2, vy * 2, 0));
        assert(api('SetViewportOrgEx', s.hdc, ox, oy, 0));
      }
      paint(a, 1); paint(b, 25);
      verify(`${label} viewport signs ${signs}`, a, b, [0, 0, 3, 2, 0, 0, 2, 3],
        [1, 1, 7, 6], true, [xd * 2, yd * 2, xs * 2, ys * 2], origin);
      for (const s of [a, b]) {
        assert(api('SetMapMode', s.hdc, 1)); api('SetViewportOrgEx', s.hdc, 0, 0, 0);
      }
    }
    for (const s of [a, b]) {
      api('SelectObject', s.hdc, s.old); assert(api('DeleteObject', s.bitmap)); assert(api('DeleteDC', s.hdc));
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`PASS ${cases} public DIB blits, ${calls} stdcall API calls; pixels/padding/tail canaries`);
  console.log(`Coverage: ${predecessorCases} predecessor controls; ${cases - predecessorCases} new signed/viewport cases`);
})().catch(err => { console.error(err); process.exit(1); });
