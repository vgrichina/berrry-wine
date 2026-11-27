'use strict';

// Public USER/GDI thunk coverage of exact exposed damage and deferred erasure.
// Expected shapes are literal bands, independent of the implementation.
const assert = require('assert');
const fs = require('fs');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLL_EXACT_DAMAGE_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLL_EXACT_DAMAGE_TEST_MODULE) : compileSrcWasm();
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v);
  const r = p => e.guest_read32(p) | 0;
  const rect = (p, a) => a.forEach((v, i) => w(p + 4 * i, v));
  const read = p => [0, 4, 8, 12].map(o => r(p + o));
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stack = alloc(8192) + 4096;
  let calls = 0, checks = 0;
  function call(entry, args) {
    w(stack - 3072, 0x12345678); w(stack, 0);
    args.forEach((v, i) => w(stack + 4 + i * 4, v));
    const guard = stack + 4 + args.length * 4;
    w(guard, 0x76543210);
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 256 && e.get_eip(); i++) e.run(256);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, guard, 'stdcall ESP');
    assert.strictEqual(r(stack - 3072), 0x12345678, 'stack low guard');
    assert.strictEqual(r(guard), 0x76543210, 'stack high guard');
    calls++; return e.get_eax() >>> 0;
  }
  const entries = {}, dlls = {};
  function api(name, ...args) {
    if (!entries[name]) {
      const dll = /^(CreateRectRgn|SetRectRgn|PtInRegion|PtVisible|DeleteObject)$/.test(name)
        ? 'gdi32.dll' : 'user32.dll';
      dlls[dll] ||= call(e.guest_read32(iat('LoadLibraryA')), [str(dll)]);
      entries[name] = call(e.guest_read32(iat('GetProcAddress')), [dlls[dll], str(name)]);
      assert(entries[name], name);
    }
    return call(entries[name], args);
  }
  const failures = [];
  function check(label, actual, expected) {
    checks++;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
  }
  const root = api('CreateWindowExA', 0, str('STATIC'), str('Scroll erase'),
    0x90000000, 20, 30, 16, 14, 0, 0, 0x400000, 0);
  const child = api('CreateWindowExA', 0, str('STATIC'), str('Child'),
    0x50000000, 0, 0, 16, 14, root, 101, 0x400000, 0);
  assert(root && child);
  const clip = alloc(16);
  const scroll = alloc(16), prior = alloc(16), box = alloc(16), out = alloc(24), ps = alloc(72);
  const record = alloc(32), pixels = alloc(16 * 14 * 4), proc = alloc(8192);
  const dword = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
  api('PtVisible', 0, 0, 0); // Resolve the real GDI thunk for the callback.
  const body = [0xff, 5, ...dword(record)]; // inc erase count
  for (const [arg, dest] of [[4, 4], [8, 8], [12, 12], [16, 16]])
    body.push(0x8b, 0x44, 0x24, arg, 0xa3, ...dword(record + dest));
  // The callback itself enumerates the borrowed HDC's clip through PtVisible.
  for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++)
    body.push(0x68, ...dword(y), 0x68, ...dword(x),
      0xff, 0x35, ...dword(record + 12), 0xb8, ...dword(entries.PtVisible), 0xff, 0xd0,
      0xa3, ...dword(pixels + (y * 16 + x) * 4));
  // Ignore other messages; return the configured full WM_ERASEBKGND result.
  const code = [0x83, 0x7c, 0x24, 8, 20, 0x0f, 0x85, ...dword(body.length), ...body,
    0xa1, ...dword(record + 20), 0xc2, 16, 0];
  assert(code.length <= 8192);
  code.forEach((v, i) => e.guest_write8(proc + i, v));
  for (const hwnd of [root, child]) assert(api('SetWindowLongA', hwnd, -4, proc));
  w(record + 20, 7);
  for (const hwnd of [root, child]) {
    assert(api('BeginPaint', hwnd, ps + 4)); assert(api('EndPaint', hwnd, ps + 4));
    api('ValidateRect', hwnd, 0);
  }
  const exposed = api('CreateRectRgn', 0, 0, 0, 0);
  const update = api('CreateRectRgn', 0, 0, 0, 0);
  assert(exposed && update);
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
    { name: 'empty', d: [2, 0], scroll: [8, 2, 8, 10], bands: [] },
    { name: 'client-clip', d: [2, 2], scroll: [-3, -2, 12, 10],
      clip: [-2, -1, 10, 8], bands: [[0, 0, 10, 2], [0, 2, 2, 8]] },
    { name: 'source-enters-clip', d: [2, 0], clip: [4, 3, 10, 9], bands: [] },
    { name: 'full', d: [20, 0], bands: [[2, 2, 12, 10]] },
    { name: 'null-inputs', d: [2, 0], scroll: null, clip: null, bands: [[0, 0, 2, 14]] },
  ];
  const contains = (bands, x, y) => bands.some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b);
  function summary(bands) {
    const points = [];
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++)
      if (contains(bands, x, y)) points.push([x, y]);
    if (!points.length) return { type: 1, box: [0, 0, 0, 0] };
    const box = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
      Math.max(...points.map(p => p[0])) + 1, Math.max(...points.map(p => p[1])) + 1];
    return { type: points.length === (box[2] - box[0]) * (box[3] - box[1]) ? 2 : 3, box };
  }
  let cases = 0;
  for (const hwnd of [root, child]) for (const shape of shapes)
    for (const pointers of ['none', 'rgn', 'rect', 'both', 'alias-scroll', 'alias-clip'])
      for (const flags of [0, 2, 4, 6]) for (const existing of [false, true]) {
        cases++;
        const label = `${hwnd}/${shape.name}/${pointers}/flags${flags}/prior${existing}`;
        // Consume setup and any erase propagated from parent cases.
        rect(prior, [3, 3, 5, 5]); w(record + 20, 7);
        assert(api('InvalidateRect', hwnd, prior, 0));
        assert(api('BeginPaint', hwnd, ps + 4)); assert(api('EndPaint', hwnd, ps + 4));
        assert(api('ValidateRect', hwnd, 0)); w(record, 0);
        const previous = existing ? [[0, 12, 2, 14], [14, 0, 16, 2]] : [];
        for (const band of previous) { rect(prior, band); assert(api('InvalidateRect', hwnd, prior, 0)); }
        rect(scroll, shape.scroll || [2, 2, 12, 10]);
        rect(clip, shape.clip || [0, 0, 16, 14]);
        const hasRegion = ['rgn', 'both', 'alias-scroll', 'alias-clip'].includes(pointers);
        const outRect = pointers === 'alias-scroll' ? scroll : pointers === 'alias-clip' ? clip
          : ['rect', 'both'].includes(pointers) ? out + 4 : 0;
        const exposedSummary = summary(shape.bands);
        const bands = previous.concat(flags & 2 ? shape.bands : []);
        const damage = summary(bands), marked = flags === 6 && shape.bands.length > 0;
        w(out, 0x12345678); w(out + 20, 0x76543210);
        check(label + ' return', api('ScrollWindowEx', hwnd, ...shape.d,
          shape.scroll === null ? 0 : scroll, shape.clip === null ? 0 : clip,
          hasRegion ? exposed : 0, outRect, flags), exposedSummary.type);
        if (outRect) check(label + ' output box', read(outRect), exposedSummary.box);
        check(label + ' guards', [r(out), r(out + 20)], [0x12345678, 0x76543210]);
        check(label + ' query type', api('GetUpdateRgn', hwnd, update, 0), damage.type);
        check(label + ' query BOOL', api('GetUpdateRect', hwnd, box, 0), damage.type > 1 ? 1 : 0);
        check(label + ' query box', read(box), damage.box);
        check(label + ' deferred callback', r(record), 0);
        for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
          if (hasRegion) check(label + ` output ${x},${y}`, !!api('PtInRegion', exposed, x, y), contains(shape.bands, x, y));
          check(label + ` query ${x},${y}`, !!api('PtInRegion', update, x, y), contains(bands, x, y));
        }
        w(ps, 0x12345678); w(ps + 68, 0x76543210);
        const dc = api('BeginPaint', hwnd, ps + 4); assert(dc);
        check(label + ' erase count', r(record), marked ? 1 : 0);
        check(label + ' fErase', r(ps + 8), 0);
        if (damage.type > 1) check(label + ' paint box', read(ps + 12), damage.box);
        for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
          check(label + ` paint ${x},${y}`, !!api('PtVisible', dc, x, y), damage.type > 1 ? contains(bands, x, y) : true);
          if (marked && r(record)) check(label + ` erase clip ${x},${y}`, !!r(pixels + (y * 16 + x) * 4), contains(bands, x, y));
        }
        check(label + ' consumed', api('GetUpdateRgn', hwnd, update, 0), 1);
        check(label + ' paint guards', [r(ps), r(ps + 68)], [0x12345678, 0x76543210]);
        assert(api('EndPaint', hwnd, ps + 4));
      }
  console.log(JSON.stringify({ phase: 'shape-matrix', cases, calls, checks,
    failures: failures.length, samples: failures.slice(0, 20) }));
  assert.strictEqual(failures.length, 0, 'ScrollWindowEx exact exposure, update query and paint clip');
  // Fill the exact store to its published 208-band bound through public APIs.
  // The two-band diagonal exposure must fail as one union, leaving every old
  // stripe and gap unchanged. Freeing space makes the same operation succeed.
  const wide = api('CreateWindowExA', 0, str('STATIC'), str('Bounded union'),
    0x50000000, 0, 0, 512, 14, root, 102, 0x400000, 0);
  assert(wide); assert(api('BeginPaint', wide, ps + 4)); assert(api('EndPaint', wide, ps + 4));
  assert(api('ValidateRect', wide, 0));
  for (let i = 0; i < 208; i++) {
    rect(prior, [2 * i, 0, 2 * i + 1, 14]); assert(api('InvalidateRect', wide, prior, 0));
  }
  rect(scroll, [420, 2, 430, 10]);
  check('capacity atomic return', api('ScrollWindowEx', wide, 2, 2, scroll, 0, exposed, box, 6), 0);
  check('capacity retained type', api('GetUpdateRgn', wide, update, 0), 3);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 512; x++)
    check(`capacity retained ${x},${y}`, !!api('PtInRegion', update, x, y), x < 416 && x % 2 === 0);
  // The new y boundaries split each retained stripe into four canonical
  // bands: retain 51 stripes, leaving room for the two exposed rectangles.
  for (let i = 0; i < 157; i++) {
    rect(prior, [2 * i, 0, 2 * i + 1, 14]); assert(api('ValidateRect', wide, prior));
  }
  check('capacity recovery return', api('ScrollWindowEx', wide, 2, 2, scroll, 0, exposed, box, 2), 3);
  check('capacity recovery type', api('GetUpdateRgn', wide, update, 0), 3);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 512; x++)
    check(`capacity recovery ${x},${y}`, !!api('PtInRegion', update, x, y),
      (x >= 314 && x < 416 && x % 2 === 0) || contains([[420, 2, 430, 4], [420, 4, 422, 10]], x, y));
  api('DestroyWindow', wide);
  api('DeleteObject', exposed); api('DeleteObject', update); api('DestroyWindow', root);
  console.log(JSON.stringify({ cases, calls, checks, failures: failures.length, samples: failures.slice(0, 20) }));
  assert.strictEqual(failures.length, 0, 'ScrollWindowEx exact exposure, update query and paint clip');
  console.log('PASS public ScrollWindowEx exact exposed damage');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
