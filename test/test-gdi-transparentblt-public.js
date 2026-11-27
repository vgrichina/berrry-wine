#!/usr/bin/env node
'use strict';

// Contract: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-transparentblt
// Literal grids, not an implementation-derived scaling oracle. All setup,
// transfers and readbacks use GetProcAddress thunks and production dispatch.
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated');
const apiTable = require('../src/api_table.json');

(async () => {
  const prebuiltModule = process.env.TRANSPARENTBLT_TEST_MODULE
    ? new WebAssembly.Module(require('node:fs').readFileSync(process.env.TRANSPARENTBLT_TEST_MODULE)) : null;
  const { exports: e, memory } = await bootRenderHarness({
    prebuiltModule, fonts: 'none', width: 8, height: 8
  });
  const thunkBase = (0x400000 + RegionMap.BASE.THUNK_BASE - RegionMap.GUEST_BASE) >>> 0;
  e.init_thread(1, 0x400000, 0, 0, thunkBase, thunkBase, 0, 0); e.heap_init(0x800000); e.set_api_log(0);
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const str = s => { const p = alloc(s.length + 1); Buffer.from(s + '\0').forEach((b, i) => e.guest_write8(p + i, b)); return p; };
  const frame = alloc(256), stack = frame + 64, regs = e.uop_reg_base() >>> 0;
  const entries = new Map();
  let calls = 0, cases = 0;
  const observations = [];
  // Seed the loader's normal two-DWORD import descriptor for GetProcAddress
  // only. Every tested GDI entry is then discovered by that public API,
  // including TransparentBlt; no synthetic TransparentBlt entry is installed.
  const lookup = apiTable.find(r => r.name === 'GetProcAddress');
  e.guest_write32(thunkBase, str('GetProcAddress') - 0x400000);
  e.guest_write32(thunkBase + 4, lookup.id);
  e.sync_thunk_state(thunkBase + 8, 1); e.seal_thunks();
  entries.set('GetProcAddress', { thunk: thunkBase, nargs: 2 });
  e.set_esp(stack); const gdi = e.test_call_GetModuleHandleA(str('GDI32.DLL')) >>> 0; assert(gdi);
  e.set_esp(stack); const msimg = e.test_call_GetModuleHandleA(str('MSIMG32.DLL')) >>> 0; assert(msimg);
  for (const name of ['TransparentBlt', 'CreateDIBSection', 'CreateCompatibleDC', 'SelectObject',
    'GetDIBits', 'DeleteDC', 'DeleteObject', 'CreateRectRgn', 'SelectClipRgn', 'SetStretchBltMode',
    'SetViewportOrgEx', 'SetWindowOrgEx', 'SetMapMode', 'SetWindowExtEx', 'SetViewportExtEx']) {
    e.set_esp(stack);
    const thunk = call('GetProcAddress', [name === 'TransparentBlt' ? msimg : gdi, str(name)]) >>> 0;
    assert(thunk, name + ' public lookup');
    const row = apiTable.find(r => r.name === name);
    assert.equal(e.guest_read32(thunk + 4), row.id, name + ' thunk identity');
    assert.equal(row.convention, 'stdcall');
    entries.set(name, { thunk, nargs: row.nargs });
  }
  assert.equal(entries.get('TransparentBlt').nargs, 11);
  function call(name, args) {
    const { thunk, nargs } = entries.get(name); assert.equal(args.length, nargs);
    mem.fill(0x6d, wa(frame), wa(frame) + 256);
    e.guest_write32(stack, 0x12345678);
    args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
    const before = mem.slice(wa(frame), wa(frame) + 256);
    const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abc];
    seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
    // Enter the real guest thunk through the interpreter, including its
    // normal return-address restoration. One block services exactly one API.
    e.set_eip(thunk); e.run(1); calls++;
    assert.equal(e.get_esp() >>> 0, stack + 4 + nargs * 4, name + ' stdcall ESP');
    assert.equal(e.get_eip() >>> 0, 0x12345678, name + ' thunk return EIP');
    assert.equal(e.get_last_run_halt(), 1, name + ' finite block budget');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], name + ' register');
    assert.deepEqual(mem.slice(wa(frame), wa(frame) + 256), before, name + ' guarded stack');
    return e.get_eax() >>> 0;
  }
  const info = alloc(40), pp = alloc(4), output = alloc(6 * 6 * 4 + 32);
  function header(bpp = 32) {
    mem.fill(0, wa(info), wa(info) + 40);
    for (const [off, value] of [[0, 40], [4, 6], [8, -6], [12, (bpp << 16) | 1]]) e.guest_write32(info + off, value);
  }
  function surface(bpp = 32) {
    header(bpp);
    const bmp = call('CreateDIBSection', [0, info, 0, pp, 0, 0]); assert(bmp);
    const bits = e.guest_read32(pp) >>> 0; assert(bits);
    const dc = call('CreateCompatibleDC', [0]); assert(dc);
    const old = call('SelectObject', [dc, bmp]); assert(old);
    return { bmp, bits, dc, old, bpp, stride: bpp === 32 ? 24 : 20 };
  }
  // DIB DWORDs are AARRGGBB; unequal R/B and nontrivial alpha catch swapped
  // COLORREF keys, alpha-as-transparency and alpha destruction.
  const colors = { Q: 0x7f18395a, A: 0x11375b9d, K: 0xa1c527e3,
    B: 0x52e39147, C: 0xf125a76b, '.': 0x6a284e72 };
  const key = 0xe327c5; // COLORREF for K, independent of its alpha.
  const blank = ['......', '......', '......', '......', '......', '......'];
  const small = ['QQQQQQ', 'QAKQQQ', 'QBCQQQ', 'QQQQQQ', 'QQQQQQ', 'QQQQQQ'];
  const large = ['QQQQQQ', 'QAAKKQ', 'QAAKKQ', 'QBBCCQ', 'QBBCCQ', 'QQQQQQ'];
  function put(s, rows) {
    mem.fill(0x9b, wa(s.bits), wa(s.bits) + s.stride * 6);
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const p = s.bits + y * s.stride + x * (s.bpp / 8), color = colors[c];
      for (let i = 0; i < s.bpp / 8; i++) e.guest_write8(p + i, color >>> (8 * i));
    }));
  }
  function read(s) {
    header(); mem.fill(0xd7, wa(output), wa(output) + 176);
    // GetDIBits requires the bitmap to be deselected.
    assert(call('SelectObject', [s.dc, s.old]));
    assert.equal(call('GetDIBits', [s.dc, s.bmp, 0, 6, output + 16, info, 0]), 6);
    assert(call('SelectObject', [s.dc, s.bmp]));
    assert(mem.slice(wa(output), wa(output) + 16).every(b => b === 0xd7));
    assert(mem.slice(wa(output) + 160, wa(output) + 176).every(b => b === 0xd7));
    return Array.from({ length: 36 }, (_, i) => e.guest_read32(output + 16 + i * 4) >>> 0);
  }
  const src = surface(), dst = surface();
  function grid(label, rows, expectedColors = colors) {
    const expected = rows.flatMap(row => [...row].map(c => expectedColors[c] >>> 0));
    // GetDIBits' BI_RGB conversion normalizes its reserved high byte. Check
    // its literal RGB grid and independently check the caller-visible DIB
    // storage, including copied alpha and untouched destination alpha.
    const dibits = read(dst).map(c => c & 0xffffff);
    const raw = Array.from({ length: 36 }, (_, i) => e.guest_read32(dst.bits + i * 4) >>> 0);
    assert.deepEqual(dibits, expected.map(c => c & 0xffffff), label);
    assert.deepEqual(raw, expected, label + ' raw alpha');
    observations.push({ label, literal: rows, expected, dibits, raw });
  }
  function check(label, dims, expected, { input = small, transparent = key, clip = null, mode = 3, result = 1,
    source = src, expectedColors = colors, setup = () => {}, teardown = () => {} } = {}) {
    put(source, input); put(dst, blank);
    const guarded = mem.slice(wa(source.bits), wa(source.bits) + source.stride * 6);
    call('SetStretchBltMode', [dst.dc, mode]);
    let region = 0;
    if (clip) { region = call('CreateRectRgn', clip); assert(region); assert(call('SelectClipRgn', [dst.dc, region])); }
    setup();
    const [dx, dy, dw, dh, sx, sy, sw, sh] = dims;
    assert.equal(call('TransparentBlt', [dst.dc, dx, dy, dw, dh, source.dc, sx, sy, sw, sh, transparent]), result, label);
    teardown();
    assert.deepEqual(mem.slice(wa(source.bits), wa(source.bits) + source.stride * 6), guarded, label + ' complete guarded source');
    grid(label, expected, expectedColors);
    if (region) { call('SelectClipRgn', [dst.dc, 0]); assert(call('DeleteObject', [region])); }
    cases++; console.log('PASS ' + label);
  }
  check('equal size', [2, 2, 2, 2, 1, 1, 2, 2], ['......', '......', '..A...', '..BC..', '......', '......']);
  const up = ['......', '.AA...', '.AA...', '.BBCC.', '.BBCC.', '......'];
  check('integer upscale', [1, 1, 4, 4, 1, 1, 2, 2], up);
  check('integer downscale constant source blocks', [2, 2, 2, 2, 1, 1, 4, 4], ['......', '......', '..A...', '..BC..', '......', '......'], { input: large });
  check('left top surface clip retains phase', [-1, -1, 4, 4, 1, 1, 2, 2], ['A.....', 'BCC...', 'BCC...', '......', '......', '......']);
  check('right bottom surface clip', [4, 4, 4, 4, 1, 1, 2, 2], ['......', '......', '......', '......', '....AA', '....AA']);
  check('region clip retains phase', [1, 1, 4, 4, 1, 1, 2, 2], ['......', '......', '..A...', '..BC..', '......', '......'], { clip: [2, 2, 4, 4] });
  check('empty destination clip', [1, 1, 4, 4, 1, 1, 2, 2], blank, { clip: [0, 0, 0, 0] });
  check('fully offscreen destination', [20, 20, 4, 4, 1, 1, 2, 2], blank);
  check('opaque key control', [1, 1, 4, 4, 1, 1, 2, 2], ['......', '.AAKK.', '.AAKK.', '.BBCC.', '.BBCC.', '......'], { transparent: 0x102030 });
  check('all transparent control', [1, 1, 4, 4, 1, 1, 2, 2], blank, { input: ['QQQQQQ', 'QKKQQQ', 'QKKQQQ', 'QQQQQQ', 'QQQQQQ', 'QQQQQQ'] });
  for (const mode of [1, 2]) check('stretch mode ' + mode + ' converts to COLORONCOLOR', [1, 1, 4, 4, 1, 1, 2, 2], up, { mode });
  check('DC origin transforms', [0, 0, 4, 4, 0, 0, 2, 2], up, {
    setup: () => { call('SetViewportOrgEx', [src.dc, 1, 1, 0]); call('SetViewportOrgEx', [dst.dc, 1, 1, 0]); },
    teardown: () => { call('SetViewportOrgEx', [src.dc, 0, 0, 0]); call('SetViewportOrgEx', [dst.dc, 0, 0, 0]); }
  });
  check('both DC extents transform endpoints', [0, 0, 2, 2, 0, 0, 2, 2], up, {
    input: large,
    setup: () => {
      for (const s of [src, dst]) {
        assert(call('SetMapMode', [s.dc, 8]));
        assert(call('SetWindowExtEx', [s.dc, 1, 1, 0]));
        assert(call('SetViewportExtEx', [s.dc, 2, 2, 0]));
        assert(call('SetViewportOrgEx', [s.dc, 1, 1, 0]));
      }
    },
    teardown: () => {
      for (const s of [src, dst]) { call('SetMapMode', [s.dc, 1]); call('SetViewportOrgEx', [s.dc, 0, 0, 0]); }
    }
  });
  const src24 = surface(24);
  check('24-bit padded guarded source converts to 32-bit', [1, 1, 4, 4, 1, 1, 2, 2], up, {
    source: src24, expectedColors: { ...colors, A: colors.A & 0xffffff, B: colors.B & 0xffffff, C: colors.C & 0xffffff }
  });
  for (const [label, dims, options] of [
    ['noninteger ratio unsupported', [1, 1, 3, 4, 1, 1, 2, 2], {}],
    ['HALFTONE unsupported', [1, 1, 4, 4, 1, 1, 2, 2], { mode: 4 }],
    ['negative extent unsupported', [1, 1, -4, 4, 1, 1, 2, 2], {}],
    ['zero extent rejected', [1, 1, 0, 4, 1, 1, 2, 2], {}],
    ['source outside surface rejected', [1, 1, 4, 4, 5, 1, 2, 2], {}],
    ['overflow extent rejected', [1, 1, 0x7fffffff, 4, 1, 1, 2, 2], {}]
  ]) check(label, dims, blank, { ...options, result: 0 });
  put(dst, blank); const beforeAlias = read(dst);
  assert.equal(call('TransparentBlt', [dst.dc, 1, 1, 2, 2, dst.dc, 2, 2, 2, 2, key]), 0);
  assert.deepEqual(read(dst), beforeAlias); cases++;
  assert.equal(call('TransparentBlt', [0xdeadbeef, 1, 1, 2, 2, src.dc, 1, 1, 2, 2, key]), 0); cases++;
  assert.equal(call('TransparentBlt', [dst.dc, 1, 1, 2, 2, 0xdeadbeef, 1, 1, 2, 2, key]), 0); cases++;
  for (const s of [src, dst, src24]) { call('SelectObject', [s.dc, s.old]); assert(call('DeleteDC', [s.dc])); assert(call('DeleteObject', [s.bmp])); }
  if (process.env.TRANSPARENTBLT_TEST_EVIDENCE)
    require('node:fs').writeFileSync(process.env.TRANSPARENTBLT_TEST_EVIDENCE, JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify({ cases, publicCalls: calls, result: 'PASS', oracle: 'literal GetDIBits grids and complete source/stack guards' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
