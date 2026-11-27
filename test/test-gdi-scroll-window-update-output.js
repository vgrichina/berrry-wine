'use strict';

// Contract: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrollwindowex
// Returned client-coordinate exposure is independent of SW_INVALIDATE. RECT
// is its bounding box; HRGN must retain the actual shape, including an L.
// Expected rectangles below are literals. Enumerating their unit pixels gives
// an independent oracle for GetRegionData and PtInRegion, not a bbox oracle.
const assert = require('assert');
const fs = require('fs');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLL_OUTPUT_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLL_OUTPUT_TEST_MODULE) : compileSrcWasm();
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v);
  const r = p => e.guest_read32(p) | 0;
  const rect = (p, values) => values.forEach((v, i) => w(p + 4 * i, v));
  const readRect = p => [0, 4, 8, 12].map(o => r(p + o));
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stack = alloc(4096) + 2048;
  let calls = 0, checks = 0;
  function call(entry, args) {
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 64 && e.get_eip(); i++) e.run(64);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    calls++; return e.get_eax() >>> 0;
  }
  const entries = {}, dlls = {};
  function api(name, ...args) {
    if (!entries[name]) {
      const dll = /^(CreateRectRgn|SetRectRgn|GetRgnBox|EqualRgn|GetRegionData|ExtCreateRegion|PtInRegion|DeleteObject|SetPixel|GetPixel)$/.test(name)
        ? 'gdi32.dll' : 'user32.dll';
      dlls[dll] ||= call(e.guest_read32(iat('LoadLibraryA')), [str(dll)]);
      entries[name] = call(e.guest_read32(iat('GetProcAddress')), [dlls[dll], str(name)]);
      assert(entries[name], name);
    }
    return call(entries[name], args);
  }
  const hwnd = api('CreateWindowExA', 0, str('STATIC'), str('Scroll output'),
    0x90000000, 20, 30, 16, 14, 0, 0, 0x400000, 0);
  assert(hwnd);
  const input = alloc(16), clip = alloc(16), out = alloc(24), box = alloc(16);
  const data = alloc(4096), expectedData = alloc(4096), damage = alloc(16);
  api('GetClientRect', hwnd, box);
  assert.deepStrictEqual(readRect(box), [0, 0, 16, 14], 'client setup');
  const hrgn = api('CreateRectRgn', 91, 92, 97, 99);
  const update = api('CreateRectRgn', 0, 0, 0, 0);
  assert(hrgn && update);
  const cases = [
    { name: 'horizontal positive', dx: 2, dy: 0, exposed: [[2, 2, 4, 10]] },
    { name: 'horizontal negative', dx: -2, dy: 0, exposed: [[10, 2, 12, 10]] },
    { name: 'vertical positive', dx: 0, dy: 3, exposed: [[2, 2, 12, 5]] },
    { name: 'vertical negative', dx: 0, dy: -3, exposed: [[2, 7, 12, 10]] },
    { name: 'diagonal positive L', dx: 2, dy: 3, exposed: [[2, 2, 12, 5], [2, 5, 4, 10]] },
    { name: 'diagonal negative L', dx: -2, dy: -3, exposed: [[10, 2, 12, 7], [2, 7, 12, 10]] },
    { name: 'diagonal mixed signs', dx: 2, dy: -3, exposed: [[2, 2, 4, 7], [2, 7, 12, 10]] },
    { name: 'horizontal clipped', dx: 2, dy: 0, clip: [3, 3, 11, 9], exposed: [[3, 3, 4, 9]] },
    { name: 'vertical clipped', dx: 0, dy: 3, clip: [3, 3, 11, 9], exposed: [[3, 3, 11, 5]] },
    { name: 'diagonal clipped L', dx: 2, dy: 3, clip: [3, 3, 11, 9],
      exposed: [[3, 3, 11, 5], [3, 5, 4, 9]] },
    { name: 'source outside clip enters clip', dx: 2, dy: 0, clip: [4, 3, 10, 9], exposed: [] },
    { name: 'disjoint clip', dx: 2, dy: 3, clip: [13, 11, 15, 13], exposed: [] },
    { name: 'zero delta', dx: 0, dy: 0, exposed: [] },
    { name: 'full exposure', dx: 20, dy: 0, exposed: [[2, 2, 12, 10]] },
    { name: 'client bounded', dx: 2, dy: 3, scroll: [-2, -2, 18, 16],
      exposed: [[0, 0, 16, 3], [0, 3, 2, 14]] },
    { name: 'NULL scroll', dx: 2, dy: 3, scroll: null,
      exposed: [[0, 0, 16, 3], [0, 3, 2, 14]] },
    { name: 'empty scroll', dx: 2, dy: 3, scroll: [2, 2, 2, 10], exposed: [] },
  ];
  const failures = [];
  const check = (label, actual, expected) => {
    checks++;
    try { assert.deepStrictEqual(actual, expected, label); }
    catch (error) { failures.push({ label, actual, expected }); }
  };
  for (const c of cases) for (const outputs of ['both', 'region', 'rect', 'neither']) for (const flags of [0, 2]) {
    api('ValidateRect', hwnd, 0);
    // Accepted unrelated damage must survive flags=0, with the same region.
    rect(damage, [0, 12, 1, 13]); api('InvalidateRect', hwnd, damage, 0);
    api('SetRectRgn', hrgn, 91, 92, 97, 99);
    rect(input, c.scroll || [2, 2, 12, 10]);
    if (c.clip) rect(clip, c.clip);
    w(out, 0x12345678); rect(out + 4, [81, 82, 87, 89]); w(out + 20, 0x76543210);
    const wantRegion = outputs === 'both' || outputs === 'region';
    const wantRect = outputs === 'both' || outputs === 'rect';
    const complexity = c.exposed.length === 0 ? 1 : c.exposed.length === 1 ? 2 : 3;
    const bbox = c.exposed.length ? [Math.min(...c.exposed.map(a => a[0])),
      Math.min(...c.exposed.map(a => a[1])), Math.max(...c.exposed.map(a => a[2])),
      Math.max(...c.exposed.map(a => a[3]))] : [0, 0, 0, 0];
    const label = c.name + '/' + outputs + '/flags' + flags;
    check(label + ' return', api('ScrollWindowEx', hwnd, c.dx, c.dy,
      c.scroll === null ? 0 : input, c.clip ? clip : 0, wantRegion ? hrgn : 0,
      wantRect ? out + 4 : 0, flags), complexity);
    check(label + ' RECT', readRect(out + 4), wantRect ? bbox : [81, 82, 87, 89]);
    check(label + ' guards', [r(out), r(out + 20)], [0x12345678, 0x76543210]);
    if (wantRegion) {
      check(label + ' GetRgnBox', api('GetRgnBox', hrgn, box), complexity);
      check(label + ' bbox', readRect(box), bbox);
      const size = api('GetRegionData', hrgn, 0, 0);
      check(label + ' size', size, 32 + 16 * c.exposed.length);
      check(label + ' data result', api('GetRegionData', hrgn, 4096, data), size);
      check(label + ' header', [r(data), r(data + 4), r(data + 8), r(data + 12)],
        [32, 1, c.exposed.length, 16 * c.exposed.length]);
      check(label + ' data bbox', readRect(data + 16), bbox);
      const actual = [];
      for (let i = 0; i < r(data + 8); i++) actual.push(readRect(data + 32 + i * 16));
      const inside = (rs, x, y) => rs.some(a => x >= a[0] && x < a[2] && y >= a[1] && y < a[3]);
      for (let y = -1; y <= 14; y++) for (let x = -1; x <= 16; x++) {
        const expected = inside(c.exposed, x, y);
        check(label + ' data pixel ' + x + ',' + y, inside(actual, x, y), expected);
        check(label + ' public pixel ' + x + ',' + y, !!api('PtInRegion', hrgn, x, y), expected);
      }
      [32, 1, c.exposed.length, 16 * c.exposed.length, ...bbox].forEach((v, i) => w(expectedData + i * 4, v));
      c.exposed.forEach((a, i) => rect(expectedData + 32 + i * 16, a));
      const expectedRgn = api('ExtCreateRegion', 0, 32 + 16 * c.exposed.length, expectedData);
      assert(expectedRgn, 'literal expected region');
      check(label + ' EqualRgn literal', api('EqualRgn', hrgn, expectedRgn), 1);
      api('DeleteObject', expectedRgn);
      const bounding = api('CreateRectRgn', ...bbox);
      check(label + ' equals bbox only if simple', api('EqualRgn', hrgn, bounding), complexity === 3 ? 0 : 1);
      api('DeleteObject', bounding);
    } else {
      check(label + ' omitted HRGN sentinel', api('GetRgnBox', hrgn, box), 2);
      check(label + ' omitted HRGN bounds', readRect(box), [91, 92, 97, 99]);
    }
    check(label + ' accepted damage RECT', api('GetUpdateRect', hwnd, damage, 0), 1);
    const damageType = api('GetUpdateRgn', hwnd, update, 0);
    if (!flags) {
      check(label + ' preserved damage bounds', readRect(damage), [0, 12, 1, 13]);
      check(label + ' accepted damage region', damageType, 2);
      const expectedDamage = api('CreateRectRgn', 0, 12, 1, 13);
      check(label + ' preserved damage shape', api('EqualRgn', update, expectedDamage), 1);
      api('DeleteObject', expectedDamage);
    } else {
      // Accepted invalidation coverage is tested by the original scroll test;
      // here flags must not change the separately returned exposed shape.
      check(label + ' flagged damage exists', damageType > 1, true);
    }
    console.log(JSON.stringify({ case: label, expectedComplexity: complexity, bbox,
      failures: failures.filter(f => f.label.startsWith(label)).length }));
  }
  // Output may reuse an input RECT. The copy must consume the original input
  // before publishing its smaller exposed box. Literal pixels catch a copy
  // accidentally restricted by its own output, independently of region math.
  const dc = api('GetDC', hwnd); assert(dc);
  for (const alias of [input, clip]) {
    api('ValidateRect', hwnd, 0);
    rect(input, [2, 2, 12, 10]); rect(clip, [2, 2, 12, 10]);
    api('SetRectRgn', hrgn, 91, 92, 97, 99);
    api('SetPixel', dc, 2, 2, 0x112233); api('SetPixel', dc, 4, 2, 0x445566);
    check('aliased output return', api('ScrollWindowEx', hwnd, 2, 0, input, clip, hrgn, alias, 0), 2);
    check('aliased output bounds', readRect(alias), [2, 2, 4, 10]);
    check('aliased output copy pixel', api('GetPixel', dc, 4, 2), 0x112233);
    check('aliased output clean window', api('GetUpdateRect', hwnd, damage, 0), 0);
  }
  api('ReleaseDC', hwnd, dc);
  api('DeleteObject', hrgn); api('DeleteObject', update); api('DestroyWindow', hwnd);
  console.log(JSON.stringify({ cases: cases.length * 8 + 2, calls, checks, failureCount: failures.length,
    failures: failures.filter(f => !f.label.includes(' pixel ')).slice(0, 150) }, null, 2));
  assert.strictEqual(failures.length, 0, 'public ScrollWindowEx output contract');
  console.log('PASS public ScrollWindowEx output regions, literal pixels and preserved noflag damage');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
