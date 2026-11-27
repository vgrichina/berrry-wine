'use strict';

// Real USER/GDI exports and x86 stdcall; literal expected exposure bands.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrollwindow
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLLWINDOW_EXACT_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLLWINDOW_EXACT_TEST_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({ moduleSha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v);
  const r = p => e.guest_read32(p) | 0;
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
      const dll = /^(CreateRectRgn|PtInRegion|PtVisible|SetPixel|GetPixel|DeleteObject)$/.test(name)
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
      failures.push({ label, actual, expected });
      const kind = label.includes('copied pixel') ? 'pixels' : label.includes('query') ? 'query'
        : label.includes('paint') ? 'paint' : 'other';
      failureKinds[kind] = (failureKinds[kind] || 0) + 1;
    }
  }
  const ps = alloc(72), rect = alloc(16), clip = alloc(16), box = alloc(16), prior = alloc(16);
  const quiet = alloc(8);
  [0xb8, 1, 0, 0, 0, 0xc2, 16, 0].forEach((v, i) => e.guest_write8(quiet + i, v));
  function window(parent = 0, width = 16, height = 14) {
    const h = api('CreateWindowExA', 0, str('STATIC'), str('ScrollWindow'),
      parent ? 0x50000000 : 0x90000000, 0, 0, width, height, parent, 0, 0x400000, 0);
    assert(h); assert(api('SetWindowLongA', h, -4, quiet));
    assert(api('BeginPaint', h, ps + 4)); assert(api('EndPaint', h, ps + 4));
    assert(api('ValidateRect', h, 0)); return h;
  }
  const root = window(), child = window(root);
  const update = api('CreateRectRgn', 0, 0, 0, 0); assert(update);
  const shapes = [
    { name: 'right', d: [2, 0], bands: [[2, 2, 4, 10]] },
    { name: 'left', d: [-2, 0], bands: [[10, 2, 12, 10]] },
    { name: 'down', d: [0, 2], bands: [[2, 2, 12, 4]] },
    { name: 'up', d: [0, -2], bands: [[2, 8, 12, 10]] },
    { name: 'down-right', d: [2, 2], bands: [[2, 2, 12, 4], [2, 4, 4, 10]] },
    { name: 'up-left', d: [-2, -2], bands: [[10, 2, 12, 8], [2, 8, 12, 10]] },
    { name: 'up-right', d: [2, -2], bands: [[2, 2, 4, 8], [2, 8, 12, 10]] },
    { name: 'down-left', d: [-2, 2], bands: [[2, 2, 12, 4], [10, 4, 12, 10]] },
    { name: 'zero', d: [0, 0], bands: [] },
    { name: 'empty-scroll', d: [2, 0], scroll: [8, 2, 8, 10], bands: [] },
    { name: 'empty-clip', d: [2, 0], clip: [5, 5, 5, 8], bands: [] },
    { name: 'outside-client', d: [2, 0], scroll: [18, 2, 20, 10], bands: [] },
    { name: 'client-clip', d: [2, 2], scroll: [-3, -2, 12, 10],
      clip: [-2, -1, 10, 8], bands: [[0, 0, 10, 2], [0, 2, 2, 8]] },
    { name: 'client-bottom-right', d: [-2, -2], scroll: [8, 8, 20, 18],
      clip: [10, 9, 18, 16], bands: [[14, 9, 16, 12], [10, 12, 16, 14]] },
    { name: 'disjoint-clip', d: [2, 0], scroll: [0, 0, 1, 1], clip: [4, 4, 5, 5], bands: [] },
    { name: 'source-enters-clip', d: [2, 0], clip: [4, 3, 10, 9], bands: [] },
    { name: 'partial-clip', d: [2, 2], clip: [3, 3, 10, 9], bands: [[3, 3, 10, 4], [3, 4, 4, 9]] },
    { name: 'full-exposure', d: [20, 0], bands: [[2, 2, 12, 10]] },
    { name: 'null-scroll', d: [2, 0], scroll: null, clip: null, bands: [[0, 0, 2, 14]] },
  ];
  const contains = (bands, x, y) => bands.some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b);
  function summary(bands, width = 16) {
    const points = [];
    for (let y = 0; y < 14; y++) for (let x = 0; x < width; x++)
      if (contains(bands, x, y)) points.push([x, y]);
    if (!points.length) return { type: 1, box: [0, 0, 0, 0] };
    const box = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
      Math.max(...points.map(p => p[0])) + 1, Math.max(...points.map(p => p[1])) + 1];
    return { type: points.length === (box[2] - box[0]) * (box[3] - box[1]) ? 2 : 3, box };
  }
  const pattern = (x, y) => (x + 1) | ((y + 1) << 8) | 0x400000;
  for (const hwnd of [root, child]) for (const shape of shapes) for (const existing of [false, true]) {
    // NULL scrolling's existing-damage translation is a separate contract;
    // this regression tests disjoint retention with an explicit scroll RECT.
    if (existing && shape.scroll === null) continue;
    cases++;
    const label = `${hwnd}/${shape.name}/prior${existing}`;
    // NULL parent scrolling moves the full-size child; restore its origin
    // before each independent child case (NOSIZE | NOZORDER | NOREDRAW | NOACTIVATE).
    if (hwnd === child) assert(api('SetWindowPos', child, 0, 0, 0, 0, 0, 0x1D));
    assert(api('ValidateRect', hwnd, 0));
    const previous = existing ? [[0, 12, 2, 14], [14, 0, 16, 2]] : [];
    for (const band of previous) { put(prior, band); assert(api('InvalidateRect', hwnd, prior, 0)); }
    const sr = shape.scroll === null ? [0, 0, 16, 14] : shape.scroll || [2, 2, 12, 10];
    const cr = shape.clip || [0, 0, 16, 14];
    put(rect, sr); put(clip, cr);
    assert(api('GetWindowRect', child, box)); const childBefore = read(box);
    const dc = api('GetDC', hwnd); assert(dc);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) api('SetPixel', dc, x, y, pattern(x, y));
    check(label + ' BOOL', api('ScrollWindow', hwnd, ...shape.d,
      shape.scroll === null ? 0 : rect, shape.clip === null ? 0 : clip), 1);
    if (shape.scroll !== null) {
      assert(api('GetWindowRect', child, box));
      check(label + ' explicit scroll preserves child geometry', read(box), childBefore);
    }
    // The existing native raster path clips the copy before translation.
    // Preserve its copied and exposed pixels while repairing update geometry.
    const [dx, dy] = shape.d;
    const l = Math.max(0, sr[0], cr[0]), t = Math.max(0, sr[1], cr[1]);
    const rr = Math.min(16, sr[2], cr[2]), bb = Math.min(14, sr[3], cr[3]);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
      let expected = pattern(x, y);
      if (x >= l && x < rr && y >= t && y < bb)
        expected = x - dx >= l && x - dx < rr && y - dy >= t && y - dy < bb
          ? pattern(x - dx, y - dy) : 0xffffff;
      check(label + ` copied pixel ${x},${y}`, api('GetPixel', dc, x, y), expected);
    }
    assert(api('ReleaseDC', hwnd, dc));
    const bands = previous.concat(shape.bands), damage = summary(bands);
    check(label + ' query type', api('GetUpdateRgn', hwnd, update, 0), damage.type);
    check(label + ' query BOOL', api('GetUpdateRect', hwnd, box, 0), damage.type > 1 ? 1 : 0);
    check(label + ' query box', read(box), damage.box);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++)
      check(label + ` query ${x},${y}`, !!api('PtInRegion', update, x, y), contains(bands, x, y));
    w(ps, 0x12345678); w(ps + 68, 0x76543210);
    const paint = api('BeginPaint', hwnd, ps + 4); assert(paint);
    if (damage.type > 1) check(label + ' paint box', read(ps + 12), damage.box);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++)
      check(label + ` paint ${x},${y}`, !!api('PtVisible', paint, x, y), damage.type > 1 ? contains(bands, x, y) : true);
    check(label + ' consumed', api('GetUpdateRgn', hwnd, update, 0), 1);
    check(label + ' guards', [r(ps), r(ps + 68)], [0x12345678, 0x76543210]);
    assert(api('EndPaint', hwnd, ps + 4));
  }
  console.log(JSON.stringify({ phase: 'matrix', cases, calls, checks, failures: failures.length, failureKinds, samples: failures.slice(0, 20) }));
  assert.strictEqual(failures.length, 0, 'exact ScrollWindow exposure and preserved pixels');
  const wide = window(root, 512);
  for (let i = 0; i < 208; i++) {
    put(prior, [2 * i, 0, 2 * i + 1, 14]); assert(api('InvalidateRect', wide, prior, 0));
  }
  put(rect, [420, 2, 430, 10]);
  check('capacity BOOL failure', api('ScrollWindow', wide, 2, 2, rect, 0), 0);
  check('capacity type', api('GetUpdateRgn', wide, update, 0), 3);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 512; x++)
    check(`capacity atomic ${x},${y}`, !!api('PtInRegion', update, x, y), x < 416 && x % 2 === 0);
  for (let i = 0; i < 157; i++) {
    put(prior, [2 * i, 0, 2 * i + 1, 14]); assert(api('ValidateRect', wide, prior));
  }
  check('capacity recovery BOOL', api('ScrollWindow', wide, 2, 2, rect, 0), 1);
  check('capacity recovery type', api('GetUpdateRgn', wide, update, 0), 3);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 512; x++)
    check(`capacity recovery ${x},${y}`, !!api('PtInRegion', update, x, y),
      (x >= 314 && x < 416 && x % 2 === 0) || contains([[420, 2, 430, 4], [420, 4, 422, 10]], x, y));
  assert(api('DestroyWindow', wide)); assert(api('DeleteObject', update)); assert(api('DestroyWindow', root));
  console.log(JSON.stringify({ cases, calls, checks, failures: failures.length, samples: failures.slice(0, 20) }));
  assert.strictEqual(failures.length, 0, 'atomic exact ScrollWindow damage');
  console.log('PASS public ScrollWindow exact exposed damage');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
