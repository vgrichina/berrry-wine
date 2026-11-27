#!/usr/bin/env node
'use strict';

// Microsoft ScrollWindowEx / SW_SCROLLCHILDREN: intersect prcScroll, move by
// dx/dy and send WM_MOVE even for zero deltas. prcClip restricts device bits.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrollwindowex
// Partially intersecting children have documented redraw limitations: this
// test asserts their geometry/messages, deliberately no partial-child pixels.
const assert = require('assert');
const fs = require('fs');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLL_WINDOW_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLL_WINDOW_TEST_MODULE) : compileSrcWasm();
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v);
  const r = p => e.guest_read32(p) | 0;
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stack = alloc(8192) + 4096;
  function call(entry, args) {
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 128 && e.get_eip(); i++) e.run(128);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    return e.get_eax() >>> 0;
  }
  const user = call(r(iat('LoadLibraryA')), [str('user32.dll')]);
  const entries = {};
  function api(name, ...args) {
    entries[name] ||= call(r(iat('GetProcAddress')), [user, str(name)]);
    assert(entries[name], name);
    return call(entries[name], args);
  }
  const rect = alloc(16), scroll = alloc(16), clip = alloc(16);
  const put = (p, values) => values.forEach((v, i) => w(p + i * 4, v));
  const read = p => [0, 4, 8, 12].map(o => r(p + o));
  function geometry(hwnd, relativeTo) {
    assert(api('GetWindowRect', hwnd, rect));
    // HWND_DESKTOP (NULL) -> caller's parent client coordinates.
    api('MapWindowPoints', 0, relativeTo, rect, 2);
    return read(rect);
  }
  function create(parent, x, y, width, height) {
    const hwnd = api('CreateWindowExA', 0, str('STATIC'), str('Scroll child'),
      parent ? 0x50000000 : 0x90000000, x, y, width, height, parent, 0, 0x400000, 0);
    assert(hwnd); return hwnd;
  }
  function observer(hwnd) {
    const log = alloc(16), proc = alloc(64), code = [];
    const dword = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
    // cmp [esp+8],WM_MOVE; jne done; inc [count]; copy HWND/wParam/lParam.
    code.push(0x83, 0x7c, 0x24, 8, 3, 0x75, 0);
    const start = code.length;
    code.push(0xff, 5, ...dword(log));
    for (const [offset, field] of [[4, 4], [12, 8], [16, 12]])
      code.push(0x8b, 0x44, 0x24, offset, 0xa3, ...dword(log + field));
    code[6] = code.length - start;
    code.push(0x31, 0xc0, 0xc2, 16, 0);
    code.forEach((v, i) => e.guest_write8(proc + i, v));
    assert(api('SetWindowLongA', hwnd, -4, proc));
    return log;
  }
  const failures = [];
  let checks = 0;
  function equal(label, actual, expected) {
    checks++;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
  }
  const cases = [
    { name: 'noflag', dx: 7, dy: 9, flags: 0,
      inside: [20,24,50,44], partial: [75,35,95,55], moves: 0 },
    { name: 'positive-clip-excludes-child', dx: 7, dy: 9, flags: 1,
      inside: [27,33,57,53], partial: [82,44,102,64], moves: 1 },
    { name: 'negative-signed-position', dx: -25, dy: -30, flags: 1,
      inside: [-5,-6,25,14], partial: [50,5,70,25], moves: 1 },
    { name: 'zero-still-notifies', dx: 0, dy: 0, flags: 1,
      inside: [20,24,50,44], partial: [75,35,95,55], moves: 1 },
    { name: 'nested-parent', nested: true, dx: 7, dy: 9, flags: 1,
      inside: [27,33,57,53], partial: [82,44,102,64], moves: 1 },
    { name: 'null-scroll-whole-client', whole: true, dx: 7, dy: 9, flags: 1,
      inside: [27,33,57,53], partial: [82,44,102,64], moves: 1 },
    { name: 'disjoint-bit-clip', disjoint: true, dx: 7, dy: 9, flags: 1,
      inside: [27,33,57,53], partial: [82,44,102,64], moves: 1 },
    { name: 'null-bit-clip', noClip: true, dx: 7, dy: 9, flags: 1,
      inside: [27,33,57,53], partial: [82,44,102,64], moves: 1 },
  ];
  for (const c of cases) {
    const root = create(0, 100, 80, 240, 180);
    const parent = c.nested ? create(root, 10, 12, 220, 150) : root;
    const inside = create(parent, 20, 24, 30, 20);
    const partial = create(parent, 75, 35, 20, 20);
    const outside = create(parent, 150, 90, 20, 20);
    const edge = create(parent, 90, 65, 10, 10);
    const grandchild = create(inside, 3, 4, 6, 7);
    const windows = [inside, partial, outside, edge, grandchild];
    const logs = windows.map(observer);
    const initial = [[20,24,50,44], [75,35,95,55], [150,90,170,110], [90,65,100,75], [3,4,9,11]];
    windows.forEach((hwnd, i) => {
      equal(c.name + ' setup ' + i, geometry(hwnd, i === 4 ? inside : parent), initial[i]);
      api('ValidateRect', hwnd, 0);
    });
    api('ValidateRect', parent, 0);
    put(scroll, [10,10,90,80]); put(clip, c.disjoint ? [200,120,210,130] : [55,50,65,60]);
    const result = api('ScrollWindowEx', parent, c.dx, c.dy, c.whole ? 0 : scroll,
      c.noClip ? 0 : clip, 0, 0, c.flags);
    assert(result >= 1 && result <= 3, 'ScrollWindowEx succeeds');
    const expected = [c.inside, c.partial,
      c.whole ? [157,99,177,119] : [150,90,170,110],
      c.whole ? [97,74,107,84] : [90,65,100,75], [3,4,9,11]];
    const observations = windows.map((hwnd, i) => {
      const position = geometry(hwnd, i === 4 ? inside : parent);
      const count = r(logs[i]);
      const moves = i === 4 ? 0 : i < 2 || c.whole ? c.moves : 0;
      equal(c.name + ' geometry ' + i, position, expected[i]);
      equal(c.name + ' WM_MOVE count ' + i, count, moves);
      if (moves) {
        equal(c.name + ' WM_MOVE HWND ' + i, r(logs[i] + 4) >>> 0, hwnd);
        equal(c.name + ' WM_MOVE wParam ' + i, r(logs[i] + 8), 0);
        const packed = r(logs[i] + 12);
        equal(c.name + ' WM_MOVE coordinates ' + i,
          [packed << 16 >> 16, packed >> 16], expected[i].slice(0, 2));
      }
      return { position, count };
    });
    // Moving a direct child carries its descendants in screen space once;
    // their own parent-relative geometry stays fixed.
    equal(c.name + ' grandchild in scrolled client', geometry(grandchild, parent),
      c.moves ? c.dx === -25 ? [-2,-2,4,5] : c.dx === 0 ? [23,28,29,35] : [30,37,36,44]
        : [23,28,29,35]);
    equal(c.name + ' parent stationary', geometry(parent, c.nested ? root : 0),
      c.nested ? [10,12,230,162] : [100,80,340,260]);
    equal(c.name + ' no new parent damage', api('GetUpdateRect', parent, rect, 0), 0);
    console.log(JSON.stringify({ case: c.name, result, observations }));
    assert(api('DestroyWindow', root));
  }
  for (const failure of failures) console.error(JSON.stringify(failure));
  assert.deepStrictEqual(failures, [], 'public child geometry and guest WM_MOVE contract');
  console.log(`PASS public ScrollWindowEx children (${cases.length} cases, ${checks} checks)`);
}
main().catch(error => { console.error(error); process.exit(1); });
