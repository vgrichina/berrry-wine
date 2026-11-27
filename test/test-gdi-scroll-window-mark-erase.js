'use strict';

// Public API thunks and actual x86 WM_ERASEBKGND callbacks. Full exposure
// isolates erase marking from ScrollWindowEx's separately known overbroad
// exposed-damage geometry. All expected pixels below are independent literals.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrollwindowex
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-beginpaint
const assert = require('assert');
const fs = require('fs');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLL_MARK_ERASE_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLL_MARK_ERASE_TEST_MODULE) : compileSrcWasm();
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
  rect(scroll, [2, 2, 12, 10]); rect(prior, [3, 3, 5, 5]);
  let cases = 0;
  for (const hwnd of [root, child]) for (const flags of [6, 2, 4, 0])
    for (const damage of [0, 1, 2]) for (const repeat of [0, 1]) for (const handled of [0, 7]) {
      cases++;
      const label = `${hwnd}/flags${flags}/prior${damage}/repeat${repeat}/handled${handled}`;
      // Parent TRUE invalidation may have marked this child in an earlier
      // case. Consume that setup state through the public paint contract.
      w(record + 20, 7);
      assert(api('InvalidateRect', hwnd, prior, 0));
      assert(api('BeginPaint', hwnd, ps + 4)); assert(api('EndPaint', hwnd, ps + 4));
      api('ValidateRect', hwnd, 0); w(record, 0); w(record + 20, handled);
      if (damage) assert(api('InvalidateRect', hwnd, prior, damage === 2 ? 1 : 0));
      const dirty = !!(flags & 2) || !!damage;
      const marked = flags === 6 || damage === 2;
      const expected = flags & 2 ? [2, 2, 12, 10] : damage ? [3, 3, 5, 5] : null;
      const inside = (x, y) => !!expected && x >= expected[0] && x < expected[2] && y >= expected[1] && y < expected[3];
      for (let n = 0; n <= repeat; n++) {
        w(out, 0x12345678); w(out + 20, 0x76543210);
        // dx exceeds the source width: literal full exposure for every flag.
        check(label + ' scroll return', api('ScrollWindowEx', hwnd, 20, 0,
          scroll, 0, exposed, out + 4, flags), 2);
        check(label + ' output RECT', read(out + 4), [2, 2, 12, 10]);
        check(label + ' output guards', [r(out), r(out + 20)], [0x12345678, 0x76543210]);
        for (let query = 0; query < 2; query++) {
          check(label + ' query type', api('GetUpdateRgn', hwnd, update, 0), dirty ? 2 : 1);
          check(label + ' query BOOL', api('GetUpdateRect', hwnd, box, 0), dirty ? 1 : 0);
          if (dirty) check(label + ' query RECT', read(box), expected);
          check(label + ' deferred erase', r(record), 0);
        }
        if (repeat && dirty) assert(api('InvalidateRect', hwnd, prior, 0));
      }
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
        check(label + ` exposure ${x},${y}`, !!api('PtInRegion', exposed, x, y), x >= 2 && x < 12 && y >= 2 && y < 10);
        check(label + ` damage ${x},${y}`, !!api('PtInRegion', update, x, y), inside(x, y));
      }
      check(label + ' erase before paint', r(record), 0);
      w(ps, 0x12345678); w(ps + 68, 0x76543210);
      const dc = api('BeginPaint', hwnd, ps + 4); assert(dc);
      check(label + ' erase count', r(record), marked ? 1 : 0);
      check(label + ' fErase', r(ps + 8), marked && !handled ? 1 : 0);
      if (dirty) check(label + ' rcPaint', read(ps + 12), expected);
      if (marked && r(record)) {
        check(label + ' callback args', [r(record + 4), r(record + 8), r(record + 12), r(record + 16)], [hwnd, 20, dc, 0]);
        for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++)
          check(label + ` callback clip ${x},${y}`, !!r(pixels + (y * 16 + x) * 4), inside(x, y));
      }
      // Clean BeginPaint historically returns a full-client DC; preserve it.
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++)
        check(label + ` paint clip ${x},${y}`, !!api('PtVisible', dc, x, y), dirty ? inside(x, y) : true);
      check(label + ' consumed', api('GetUpdateRgn', hwnd, update, 0), 1);
      check(label + ' PAINTSTRUCT guards', [r(ps), r(ps + 68)], [0x12345678, 0x76543210]);
      assert(api('EndPaint', hwnd, ps + 4));
      check(label + ' EndPaint clean', api('GetUpdateRect', hwnd, box, 0), 0);
      // An unhandled erase retains the established request; a handled erase
      // consumes it. FALSE reinvalidation must preserve that existing policy.
      assert(api('InvalidateRect', hwnd, prior, 0)); w(record, 0); w(record + 20, 7);
      assert(api('BeginPaint', hwnd, ps + 4));
      check(label + ' later retained erase', r(record), marked && !handled ? 1 : 0);
      check(label + ' later unmarked fErase', r(ps + 8), 0);
      assert(api('EndPaint', hwnd, ps + 4));
      assert(api('InvalidateRect', hwnd, prior, 0)); w(record, 0);
      assert(api('BeginPaint', hwnd, ps + 4));
      check(label + ' handled request consumed', r(record), 0);
      assert(api('EndPaint', hwnd, ps + 4));
      console.log(JSON.stringify({ case: label, failures: failures.filter(f => f.label.startsWith(label + ' ')).length }));
    }
  api('DeleteObject', exposed); api('DeleteObject', update); api('DestroyWindow', root);
  console.log(JSON.stringify({ cases, calls, checks, failures: failures.length, samples: failures.slice(0, 16) }));
  assert.strictEqual(failures.length, 0, 'ScrollWindowEx marks deferred erasure only with both flags');
  console.log('PASS public ScrollWindowEx deferred erase marking');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
