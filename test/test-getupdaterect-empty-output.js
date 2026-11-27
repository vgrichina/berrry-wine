'use strict';

// Public USER thunks only; every paint query/invalidation uses bErase=FALSE.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getupdaterect
// A clean window returns FALSE and writes an empty RECT, including after validation.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.GETUPDATERECT_TEST_MODULE
    ? fs.readFileSync(process.env.GETUPDATERECT_TEST_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({ moduleSha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
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
  let thunkCalls = 0;
  function call(entry, args) {
    w(stack - 4096, 0x12345678); w(stack + 4 + args.length * 4, 0x76543210);
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 128 && e.get_eip(); i++) e.run(128);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    assert.strictEqual(r(stack - 4096), 0x12345678, 'stack allocation lower guard');
    assert.strictEqual(r(stack + 4 + args.length * 4), 0x76543210, 'stack upper guard');
    thunkCalls++;
    return e.get_eax() >>> 0;
  }
  const libs = {}, entries = {}, calls = {};
  for (const dll of ['user32.dll', 'gdi32.dll']) {
    libs[dll] = call(r(iat('LoadLibraryA')), [str(dll)]); assert(libs[dll]);
  }
  function api(dll, name, ...args) {
    const key = dll + ':' + name;
    entries[key] ||= call(r(iat('GetProcAddress')), [libs[dll], str(name)]);
    assert(entries[key], key); calls[key] = (calls[key] || 0) + 1;
    return call(entries[key], args);
  }
  const user = (name, ...args) => api('user32.dll', name, ...args);
  const gdi = (name, ...args) => api('gdi32.dll', name, ...args);
  const failures = []; let checks = 0;
  function equal(label, actual, expected) {
    checks++;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
  }
  const storage = alloc(24), box = storage + 4, damage = alloc(16), regionBox = alloc(16);
  const put = (p, values) => values.forEach((v, i) => w(p + i * 4, v));
  const read = p => [0, 4, 8, 12].map(o => r(p + o));
  const region = gdi('CreateRectRgn', 31, 33, 47, 52); assert(region);
  function query(label, hwnd, expected, rect) {
    put(storage, [0x13572468, 91, 92, 93, 94, 0x24681357]);
    equal(label + ' return', user('GetUpdateRect', hwnd, box, 0), expected);
    equal(label + ' literal RECT', read(box), rect);
    equal(label + ' lower RECT guard', r(storage), 0x13572468);
    equal(label + ' upper RECT guard', r(box + 16), 0x24681357);
    equal(label + ' NULL output return', user('GetUpdateRect', hwnd, 0, 0), expected);
    equal(label + ' NULL output leaves buffer', read(box), rect);
    equal(label + ' GetUpdateRgn type', user('GetUpdateRgn', hwnd, region, 0), expected ? 2 : 1);
    equal(label + ' GetRgnBox type', gdi('GetRgnBox', region, regionBox), expected ? 2 : 1);
    equal(label + ' independent region bounds', read(regionBox), rect);
  }
  const root = user('CreateWindowExA', 0, str('STATIC'), str('Update rectangle'),
    0x90000000, 10, 10, 120, 100, 0, 0, 0x400000, 0); assert(root);
  const child = user('CreateWindowExA', 0, str('STATIC'), str('Child'),
    0x50000000, 5, 6, 80, 70, root, 0, 0x400000, 0); assert(child);
  for (const [name, hwnd, other, full] of [
    ['main', root, child, [0, 0, 120, 100]], ['child', child, root, [0, 0, 80, 70]]]) {
    assert(user('ValidateRect', root, 0)); assert(user('ValidateRect', child, 0));
    query(name + ' created and validated', hwnd, 0, [0, 0, 0, 0]);
    for (const rect of [[3, 4, 17, 21], [7, 9, 25, 29], [1, 2, 11, 13]]) {
      put(damage, rect); assert(user('InvalidateRect', hwnd, damage, 0));
      query(name + ' dirty pending', hwnd, 1, rect);
      query(name + ' repeated preserves pending', hwnd, 1, rect);
      query(name + ' other window stays clean', other, 0, [0, 0, 0, 0]);
      assert(user('ValidateRect', hwnd, damage));
      query(name + ' explicit validation', hwnd, 0, [0, 0, 0, 0]);
      put(damage, rect); assert(user('InvalidateRect', hwnd, damage, 0));
      assert(user('ValidateRect', hwnd, 0));
      query(name + ' full validation', hwnd, 0, [0, 0, 0, 0]);
    }
    // Public RDW_INTERNALPAINT requests WM_PAINT without an update region.
    // It must not manufacture a nonempty GetUpdateRect result.
    assert(user('RedrawWindow', hwnd, 0, 0, 2));
    query(name + ' internal paint only', hwnd, 0, [0, 0, 0, 0]);
    put(damage, [6, 7, 20, 24]); assert(user('InvalidateRect', hwnd, damage, 0));
    assert(user('RedrawWindow', hwnd, 0, 0, 2));
    query(name + ' internal paint plus damage', hwnd, 1, [6, 7, 20, 24]);
    assert(user('ValidateRect', hwnd, 0));
    assert(user('InvalidateRect', hwnd, 0, 0));
    query(name + ' full client pending', hwnd, 1, full);
    assert(user('ValidateRect', hwnd, 0));
    query(name + ' full client validated', hwnd, 0, [0, 0, 0, 0]);
  }
  // Invalid HWND output is unspecified. Observe its historical contents;
  // require only FALSE and the memory guards, with/without an output pointer.
  for (const hwnd of [0, 0x7ffffffe]) {
    put(storage, [0x13572468, 91, 92, 93, 94, 0x24681357]);
    equal('invalid HWND return', user('GetUpdateRect', hwnd, box, 0), 0);
    console.log(JSON.stringify({ control: 'invalid HWND output unqualified', hwnd, rect: read(box) }));
    equal('invalid HWND lower guard', r(storage), 0x13572468);
    equal('invalid HWND upper guard', r(box + 16), 0x24681357);
    equal('invalid HWND NULL output', user('GetUpdateRect', hwnd, 0, 0), 0);
  }
  assert(user('DestroyWindow', root)); assert(gdi('DeleteObject', region));
  console.log(JSON.stringify({ checks, thunkCalls, calls, entries, failures }));
  assert.deepStrictEqual(failures, [], 'public GetUpdateRect clean output and pending damage');
  console.log(`PASS public GetUpdateRect empty output (${checks} checks)`);
}
main().catch(error => { console.error(error); process.exit(1); });
