'use strict';

// Microsoft ScrollWindow remarks: NULL lpRect offsets child positions and
// invalid areas; an explicit RECT offsets neither. lpClipRect limits bits.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrollwindow
// 208-band failure is our bounded store's policy, not a Windows capacity claim.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLLWINDOW_NULL_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLLWINDOW_NULL_TEST_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({ moduleSha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture(); new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v), r = p => e.guest_read32(p) | 0;
  const put = (p, a) => a.forEach((v, i) => w(p + 4 * i, v));
  const read = p => [0, 4, 8, 12].map(o => r(p + o));
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stack = alloc(8192) + 4096;
  let calls = 0, checks = 0, cases = 0;
  function call(entry, args) {
    w(stack - 3072, 0x12345678); w(stack, 0);
    args.forEach((v, i) => w(stack + 4 + i * 4, v));
    const guard = stack + 4 + args.length * 4; w(guard, 0x76543210);
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 256 && e.get_eip(); i++) e.run(256);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, guard, 'stdcall ESP');
    assert.strictEqual(r(stack - 3072), 0x12345678, 'low stack guard');
    assert.strictEqual(r(guard), 0x76543210, 'high stack guard');
    calls++; return e.get_eax() >>> 0;
  }
  const entries = {}, dlls = {};
  function api(name, ...args) {
    if (!entries[name]) {
      const dll = /^(CreateRectRgn|CombineRgn|PtInRegion|PtVisible|SetPixel|GetPixel|DeleteObject)$/.test(name)
        ? 'gdi32.dll' : 'user32.dll';
      dlls[dll] ||= call(e.guest_read32(iat('LoadLibraryA')), [str(dll)]);
      entries[name] = call(e.guest_read32(iat('GetProcAddress')), [dlls[dll], str(name)]);
      assert(entries[name], name);
    }
    return call(entries[name], args);
  }
  const failures = [], failureKinds = {};
  function check(label, actual, expected) {
    checks++;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      const kind = label.includes('pixel') ? 'pixels' : label.includes('position') ? 'children'
        : label.includes('paint') ? 'paint' : 'query';
      if ((failureKinds[kind] || 0) < 8) failures.push({ label, actual, expected });
      failureKinds[kind] = (failureKinds[kind] || 0) + 1;
    }
  }
  const ps = alloc(72), rect = alloc(16), clip = alloc(16), box = alloc(16);
  const quiet = alloc(8);
  [0xb8, 1, 0, 0, 0, 0xc2, 16, 0].forEach((v, i) => e.guest_write8(quiet + i, v));
  function window(parent, x, y, width = 16, height = 14, popup = false) {
    const h = api('CreateWindowExA', 0, str('STATIC'), str('NULL scroll'),
      parent && !popup ? 0x50000000 : 0x90000000, x, y, width, height, parent, 0, 0x400000, 0);
    assert(h); assert(api('SetWindowLongA', h, -4, quiet));
    assert(api('BeginPaint', h, ps + 4)); assert(api('EndPaint', h, ps + 4));
    assert(api('ValidateRect', h, 0)); return h;
  }
  const root = window(0, 31, 27, 96, 80), child = window(root, 5, 6, 48, 40);
  const nested = window(child, 7, 9), leaf = window(nested, 3, 4, 2, 2);
  const outside = window(nested, 22, 18, 2, 2), hidden = window(nested, -4, -3, 2, 2);
  api('ShowWindow', hidden, 0);
  const popup = window(nested, 70, 65, 2, 2, true);
  const nodes = [root, child, nested, leaf, outside, hidden, popup];
  const update = api('CreateRectRgn', 0, 0, 0, 0); assert(update);
  const inside = (bands, x, y) => bands.some(([l, t, rr, b]) => x >= l && x < rr && y >= t && y < b);
  const translate = (bands, dx, dy) => bands.map(a => [a[0] + dx, a[1] + dy, a[2] + dx, a[3] + dy]);
  function geometry(h) { assert(api('GetWindowRect', h, box)); return read(box); }
  function mask(label, hwnd, bands, width, height, paint = true) {
    const points = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (inside(bands, x, y)) points.push([x, y]);
    const bounds = points.length ? [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
      Math.max(...points.map(p => p[0])) + 1, Math.max(...points.map(p => p[1])) + 1] : [0, 0, 0, 0];
    const type = points.length ? points.length === (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) ? 2 : 3 : 1;
    check(label + ' query type', api('GetUpdateRgn', hwnd, update, 0), type);
    check(label + ' query BOOL', api('GetUpdateRect', hwnd, box, 0), type > 1 ? 1 : 0);
    check(label + ' query bounds', read(box), bounds);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
      check(label + ` query ${x},${y}`, !!api('PtInRegion', update, x, y), inside(bands, x, y));
    if (!paint) return;
    w(ps, 0x12345678); w(ps + 68, 0x76543210);
    const dc = api('BeginPaint', hwnd, ps + 4); assert(dc);
    if (type > 1) check(label + ' paint bounds', read(ps + 12), bounds);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
      check(label + ` paint ${x},${y}`, !!api('PtVisible', dc, x, y), type > 1 ? inside(bands, x, y) : true);
    check(label + ' consumed', api('GetUpdateRgn', hwnd, update, 0), 1);
    check(label + ' guards', [r(ps), r(ps + 68)], [0x12345678, 0x76543210]);
    assert(api('EndPaint', hwnd, ps + 4));
  }
  const shapes = (width, height) => [
    { name: 'right', d: [2, 0], bands: [[0, 0, 2, height]] },
    { name: 'left', d: [-2, 0], bands: [[width - 2, 0, width, height]] },
    { name: 'down', d: [0, 2], bands: [[0, 0, width, 2]] },
    { name: 'up', d: [0, -2], bands: [[0, height - 2, width, height]] },
    { name: 'diagonal', d: [2, 2], bands: [[0, 0, width, 2], [0, 2, 2, height]] },
    { name: 'negative-diagonal', d: [-2, -2], bands: [[width - 2, 0, width, height - 2], [0, height - 2, width, height]] },
    { name: 'zero', d: [0, 0], bands: [] },
    { name: 'partial-clip', d: [2, 2], clip: [0, 1, 10, 9], bands: [[0, 1, 10, 2], [0, 2, 2, 9]] },
    { name: 'interior-clip', d: [-2, 2], clip: [4, 4, 12, 10], bands: [] },
    { name: 'empty-clip', d: [2, 0], clip: [4, 4, 4, 10], bands: [] },
    { name: 'outside-clip', d: [2, 0], clip: [width + 2, height + 2, width + 4, height + 4], bands: [] },
  ];
  // Disjoint islands and a ring with a hole, all literal client coordinates.
  const previous = [[4, 4, 8, 5], [4, 5, 5, 8], [7, 5, 8, 8], [4, 8, 8, 9],
    [11, 3, 13, 5], [0, 10, 2, 12], [14, 11, 16, 14]];
  const pattern = (x, y) => (x + 1) | ((y + 1) << 8) | 0x400000;
  for (const [hwnd, width, height] of [[root, 96, 80], [child, 48, 40], [nested, 16, 14]])
    for (const shape of shapes(width, height)) for (const explicit of [false, true]) {
    cases++;
    assert(api('ValidateRect', hwnd, 0));
    for (const band of previous) { put(rect, band); assert(api('InvalidateRect', hwnd, rect, 0)); }
    const before = nodes.map(geometry);
    const dc = api('GetDC', hwnd); assert(dc);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) api('SetPixel', dc, x, y, pattern(x, y));
    put(rect, [0, 0, width, height]); if (shape.clip) put(clip, shape.clip);
    const label = `${hwnd}/${shape.name}/explicit${explicit}`, [dx, dy] = shape.d;
    check(label + ' BOOL', api('ScrollWindow', hwnd, dx, dy, explicit ? rect : 0, shape.clip ? clip : 0), 1);
    const moved = hwnd === root ? [child, nested, leaf, outside, hidden]
      : hwnd === child ? [nested, leaf, outside, hidden] : [leaf, outside, hidden];
    nodes.forEach((h, i) => check(label + ` position ${h}`, geometry(h),
      !explicit && moved.includes(h) ? translate([before[i]], dx, dy)[0] : before[i]));
    const cr = shape.clip || [0, 0, width, height];
    const l = Math.max(0, cr[0]), t = Math.max(0, cr[1]), rr = Math.min(width, cr[2]), b = Math.min(height, cr[3]);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let expected = pattern(x, y);
      if (x >= l && x < rr && y >= t && y < b)
        expected = x - dx >= l && x - dx < rr && y - dy >= t && y - dy < b ? pattern(x - dx, y - dy) : 0xffffff;
      check(label + ` copied pixel ${x},${y}`, api('GetPixel', dc, x, y), expected);
    }
    assert(api('ReleaseDC', hwnd, dc));
    mask(label, hwnd, (explicit ? previous : translate(previous, dx, dy)).concat(shape.bands), width, height);
  }
  console.log(JSON.stringify({ phase: 'matrix', cases, calls, checks, failureKinds, samples: failures }));
  assert.deepStrictEqual(failureKinds, {}, 'NULL child and invalid-area translation');
  const wide = window(0, 1, 2, 512), wideChild = window(wide, 9, 6, 2, 2);
  const stripes = Array.from({ length: 208 }, (_, i) => [2 * i + 2, 0, 2 * i + 3, 14]);
  for (const band of stripes) { put(rect, band); assert(api('InvalidateRect', wide, rect, 0)); }
  const before = geometry(wideChild);
  const wideDC = api('GetDC', wide); assert(wideDC);
  for (let x = 0; x < 512; x++) api('SetPixel', wideDC, x, 6, pattern(x, 6));
  // Moving left retains all 208 stripes and adds a separate right exposure.
  check('capacity BOOL failure', api('ScrollWindow', wide, -1, 0, 0, 0), 0);
  check('capacity position atomic', geometry(wideChild), before);
  for (let x = 0; x < 512; x++)
    check(`capacity atomic pixel ${x}`, api('GetPixel', wideDC, x, 6), pattern(x, 6));
  mask('capacity atomic', wide, stripes, 512, 14, false);
  put(rect, stripes[0]); assert(api('ValidateRect', wide, rect));
  check('capacity recovery BOOL', api('ScrollWindow', wide, -1, 0, 0, 0), 1);
  check('capacity recovery position', geometry(wideChild), translate([before], -1, 0)[0]);
  for (let x = 0; x < 512; x++)
    check(`capacity recovery pixel ${x}`, api('GetPixel', wideDC, x, 6), x < 511 ? pattern(x + 1, 6) : 0xffffff);
  assert(api('ReleaseDC', wide, wideDC));
  mask('capacity recovery', wide, translate(stripes.slice(1), -1, 0).concat([[511, 0, 512, 14]]), 512, 14);
  // Exhaust public region handles to exercise every temporary-allocation
  // failure without guessing a Windows last-error number. Releasing handles
  // restores success; repeated zero scrolling must not leak temporary HRGNs.
  function exhaust() {
    const handles = [];
    for (let i = 0; i < 256; i++) {
      const h = api('CreateRectRgn', 0, 0, 0, 0); if (!h) return handles;
      handles.push(h);
    }
    throw Error('region exhaustion bound');
  }
  for (const free of [0, 1, 2, 3, 4]) {
    assert(api('ValidateRect', wide, 0)); put(rect, [8, 4, 10, 6]);
    assert(api('InvalidateRect', wide, rect, 0));
    const childBefore = geometry(wideChild), handles = exhaust();
    assert(handles.length > free);
    for (let i = 0; i < free; i++) assert(api('DeleteObject', handles.pop()));
    check(`allocation ${free} failure BOOL`, api('ScrollWindow', wide, 1, 0, 0, 0), 0);
    check(`allocation ${free} position atomic`, geometry(wideChild), childBefore);
    mask(`allocation ${free} damage atomic`, wide, [[8, 4, 10, 6]], 512, 14, false);
    for (const h of handles) assert(api('DeleteObject', h));
    check(`allocation ${free} recovery BOOL`, api('ScrollWindow', wide, 1, 0, 0, 0), 1);
    mask(`allocation ${free} recovery`, wide, [[9, 4, 11, 6], [0, 0, 1, 14]], 512, 14);
  }
  const available = exhaust(); const countBefore = available.length;
  for (const h of available) assert(api('DeleteObject', h));
  for (let i = 0; i < 300; i++) check('zero-scroll allocation cycle', api('ScrollWindow', wide, 0, 0, 0, 0), 1);
  const afterCycles = exhaust(); check('temporary HRGN recovery', afterCycles.length, countBefore);
  for (const h of afterCycles) assert(api('DeleteObject', h));
  // Preserve the published explicit-RECT diagonal capacity transaction too.
  assert(api('ValidateRect', wide, 0));
  const explicitStripes = Array.from({ length: 208 }, (_, i) => [2 * i, 0, 2 * i + 1, 14]);
  for (const band of explicitStripes) { put(rect, band); assert(api('InvalidateRect', wide, rect, 0)); }
  const explicitBefore = geometry(wideChild); put(rect, [420, 2, 430, 10]);
  check('explicit capacity failure BOOL', api('ScrollWindow', wide, 2, 2, rect, 0), 0);
  check('explicit capacity position', geometry(wideChild), explicitBefore);
  mask('explicit capacity atomic', wide, explicitStripes, 512, 14, false);
  for (let i = 0; i < 157; i++) { put(rect, explicitStripes[i]); assert(api('ValidateRect', wide, rect)); }
  put(rect, [420, 2, 430, 10]);
  check('explicit capacity recovery BOOL', api('ScrollWindow', wide, 2, 2, rect, 0), 1);
  check('explicit recovery position', geometry(wideChild), explicitBefore);
  mask('explicit capacity recovery', wide, explicitStripes.slice(157).concat([[420, 2, 430, 4], [420, 4, 422, 10]]), 512, 14);
  assert(api('DestroyWindow', wide)); assert(api('DeleteObject', update)); assert(api('DestroyWindow', popup));
  assert(api('DestroyWindow', root));
  console.log(JSON.stringify({ cases, calls, checks, failureKinds, samples: failures }));
  assert.deepStrictEqual(failureKinds, {}, 'atomic translation and recovery');
  console.log('PASS public ScrollWindow NULL child and prior-damage translation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
