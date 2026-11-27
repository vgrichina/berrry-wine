#!/usr/bin/env node
'use strict';

// GetUpdateRgn copies even an empty update region into the caller's HRGN.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getupdatergn
// All GetUpdateRgn / InvalidateRect calls here use bErase=FALSE.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.GETUPDATERGN_TEST_MODULE
    ? fs.readFileSync(process.env.GETUPDATERGN_TEST_MODULE) : compileSrcWasm();
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
  function call(entry, args) {
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 128 && e.get_eip(); i++) e.run(128);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    return e.get_eax() >>> 0;
  }
  const libs = {};
  for (const name of ['user32.dll', 'gdi32.dll']) {
    libs[name] = call(r(iat('LoadLibraryA')), [str(name)]); assert(libs[name]);
  }
  const entries = {}, calls = {};
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
  const box = alloc(16), damage = alloc(16), ps = alloc(64);
  const put = (p, values) => values.forEach((v, i) => w(p + i * 4, v));
  const read = p => [0, 4, 8, 12].map(o => r(p + o));
  const region = values => { const h = gdi('CreateRectRgn', ...values); assert(h); return h; };
  const empty = region([0, 0, 0, 0]);
  const sentinelRect = [31, 33, 47, 52], sentinel = region(sentinelRect);
  function inspect(label, output, type, rect, oracle) {
    put(box, [91, 92, 93, 94]);
    equal(label + ' GetRgnBox type', gdi('GetRgnBox', output, box), type);
    equal(label + ' literal box', read(box), rect);
    equal(label + ' EqualRgn literal oracle', gdi('EqualRgn', output, oracle), 1);
  }
  inspect('empty oracle', empty, 1, [0, 0, 0, 0], empty);
  inspect('sentinel oracle', sentinel, 2, sentinelRect, sentinel);
  const root = user('CreateWindowExA', 0, str('STATIC'), str('Update region'),
    0x90000000, 10, 10, 120, 100, 0, 0, 0x400000, 0);
  assert(root);
  const child = user('CreateWindowExA', 0, str('STATIC'), str('Child'),
    0x50000000, 5, 6, 80, 70, root, 0, 0x400000, 0);
  assert(child);
  for (const hwnd of [root, child]) {
    assert(user('ValidateRect', hwnd, 0));
    const output = region(sentinelRect);
    equal('clean initial return', user('GetUpdateRgn', hwnd, output, 0), 1);
    inspect('clean initial', output, 1, [0, 0, 0, 0], empty);
    for (const rect of [[3, 4, 17, 21], [7, 9, 25, 29], [1, 2, 11, 13]]) {
      const oracle = region(rect); put(damage, rect);
      assert(user('InvalidateRect', hwnd, damage, 0));
      for (let repeat = 0; repeat < 2; repeat++) {
        equal('dirty return', user('GetUpdateRgn', hwnd, output, 0), 2);
        inspect('dirty repeated query preserves damage', output, 2, rect, oracle);
        equal('GetUpdateRect still dirty', user('GetUpdateRect', hwnd, box, 0), 1);
        equal('pending damage literal', read(box), rect);
      }
      assert(user('ValidateRect', hwnd, 0));
      for (let repeat = 0; repeat < 2; repeat++) {
        equal('reused clean return', user('GetUpdateRgn', hwnd, output, 0), 1);
        inspect('dirty to clean reuse', output, 1, [0, 0, 0, 0], empty);
        equal('GetUpdateRect stays clean', user('GetUpdateRect', hwnd, box, 0), 0);
      }
      assert(gdi('DeleteObject', oracle));
    }
    // BeginPaint must still consume damage; GetUpdateRgn must not consume it.
    put(damage, [4, 5, 19, 23]); assert(user('InvalidateRect', hwnd, damage, 0));
    equal('before BeginPaint dirty', user('GetUpdateRgn', hwnd, output, 0), 2);
    assert(user('BeginPaint', hwnd, ps));
    equal('BeginPaint damage', read(ps + 8), [4, 5, 19, 23]);
    equal('after BeginPaint return', user('GetUpdateRgn', hwnd, output, 0), 1);
    inspect('after BeginPaint', output, 1, [0, 0, 0, 0], empty);
    assert(user('EndPaint', hwnd, ps));
    equal('after EndPaint remains clean', user('GetUpdateRect', hwnd, box, 0), 0);

    // Invalid output behavior is observed only: Microsoft does not specify
    // an output value on failure. Do not bless an existing success return.
    for (const bad of [0, 0x7ffffffe]) {
      equal('invalid HRGN GetRgnBox control', gdi('GetRgnBox', bad, box), 0);
      const clean = user('GetUpdateRgn', hwnd, bad, 0);
      put(damage, [6, 7, 20, 24]); assert(user('InvalidateRect', hwnd, damage, 0));
      const dirty = user('GetUpdateRgn', hwnd, bad, 0);
      equal('invalid output preserves pending damage', user('GetUpdateRect', hwnd, box, 0), 1);
      equal('invalid output damage box', read(box), [6, 7, 20, 24]);
      console.log(JSON.stringify({ control: 'invalid output, return unqualified', hwnd, bad, clean, dirty }));
      assert(user('ValidateRect', hwnd, 0));
    }
    assert(gdi('DeleteObject', output));
  }
  for (const hwnd of [0, 0x7ffffffe]) {
    const output = region(sentinelRect);
    equal('invalid window ERROR', user('GetUpdateRgn', hwnd, output, 0), 0);
    // Region contents following ERROR are intentionally not a contract oracle.
    console.log(JSON.stringify({ control: 'invalid window', hwnd,
      boxType: gdi('GetRgnBox', output, box), box: read(box) }));
    assert(gdi('DeleteObject', output));
  }
  assert(user('DestroyWindow', root));
  for (const h of [empty, sentinel]) assert(gdi('DeleteObject', h));
  console.log(JSON.stringify({ checks, calls, entries, failures }));
  assert.deepStrictEqual(failures, [], 'public GetUpdateRgn empty output and damage contract');
  console.log(`PASS public GetUpdateRgn empty output (${checks} checks)`);
}
main().catch(error => { console.error(error); process.exit(1); });
