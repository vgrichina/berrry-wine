#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enablemenuitem
// Public resource setup and x86 stdcall dispatch on the canonical module.
// No private menu writes, extra exports or source transformations.
function fixture() {
  const b = makeFixture(), raw = rva => rva - 0x1000 + 0x200;
  const w = (rva, n) => b.writeUInt32LE(n >>> 0, raw(rva));
  // RT_MENU -> two resource IDs -> language -> data entries.
  b.writeUInt32LE(0x2200, 0x80 + 24 + 112);
  b.writeUInt32LE(0x400, 0x80 + 24 + 116);
  b.writeUInt16LE(1, raw(0x220e)); w(0x2210, 4); w(0x2214, 0x80000020);
  b.writeUInt16LE(2, raw(0x222e));
  for (let i = 0; i < 2; i++) {
    w(0x2230 + i * 8, 301 + i); w(0x2234 + i * 8, 0x80000040 + i * 24);
    const lang = 0x2240 + i * 24;
    b.writeUInt16LE(1, raw(lang + 14)); w(lang + 16, 1033); w(lang + 20, 0x80 + i * 16);
    let p = 0x2400 + i * 0x100;
    const start = p;
    const u16 = n => { b.writeUInt16LE(n, raw(p)); p += 2; };
    const str = s => { for (const c of s) u16(c.charCodeAt(0)); u16(0); };
    u16(0); u16(0); u16(0x90); str('File');
    for (const [j, id] of [1, 600, 601].entries()) {
      u16((j === 2 ? 0x80 : 0) | (j === 1 ? (i ? 9 : 8) : 0));
      u16(id); str(['First', 'Target', 'Last'][j]);
    }
    w(0x2280 + i * 16, start); w(0x2284 + i * 16, p - start);
  }
  return b;
}

async function run(byPosition) {
  const moduleBytes = fs.readFileSync(process.env.MENU_TEST_MODULE || 'build/wine-assembly.wasm');
  console.log('module sha256', crypto.createHash('sha256').update(moduleBytes).digest('hex'));
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', width: 64, height: 64,
    prebuiltModule: new WebAssembly.Module(moduleBytes) });
  const pe = fixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const w = (p, n) => e.guest_write32(p, n), r = p => e.guest_read32(p) >>> 0;
  const read = (p, n) => Buffer.from(new Uint8Array(memory.buffer, e.guest_to_wasm(p) >>> 0, n));
  const str = s => { const p = alloc(s.length + 1); Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const frame = alloc(512), stack = frame + 128;
  let calls = 0;
  function call(entry, args) {
    const regs = ['ebx', 'ebp', 'esi', 'edi'], values = [0x13579bdf, 0x2468ace0, 0x3579bdf1, 0x468ace02];
    regs.forEach((k, i) => e['set_' + k](values[i]));
    for (let i = 0; i < 512; i += 4) w(frame + i, 0x5ac1d00d);
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    const before = read(frame, 512);
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 32 && e.get_eip(); i++) e.run(32);
    assert.equal(e.get_eip(), 0, 'guest return');
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    assert.deepEqual(regs.map(k => e['get_' + k]() >>> 0), values, 'nonzero preserved registers');
    assert.deepEqual(read(frame, 512), before, 'stack and neighboring guards');
    calls++; return e.get_eax() >>> 0;
  }
  const dll = call(r(iat('LoadLibraryA')), [str('user32.dll')]); assert(dll);
  const entries = {};
  function api(name, ...args) {
    if (!entries[name]) { entries[name] = call(r(iat('GetProcAddress')), [dll, str(name)]); assert(entries[name], name); }
    return call(entries[name], args);
  }
  const failures = [];
  function equal(actual, expected, label) {
    console.log(JSON.stringify({ label, actual, expected }));
    if (actual !== expected) failures.push({ label, actual, expected });
  }
  const cls = str('STATIC');
  const windows = [], bars = [], popups = [], blobs = [];
  for (let i = 0; i < 2; i++) {
    const hwnd = api('CreateWindowExA', 0, cls, 0, 0x00cf0000, 0, 0, 64, 64, 0, 0, 0x400000, 0); assert(hwnd);
    const loaded = api('LoadMenuA', 0x400000, 301 + i); assert(loaded);
    assert.equal(api('SetMenu', hwnd, loaded), 1);
    windows.push(hwnd); bars.push(api('GetMenu', hwnd));
    popups.push(api('GetSubMenu', bars[i], 0));
    const p = e.get_menu_bar_blob_guest(hwnd) >>> 0; assert(p); blobs.push(p);
  }
  assert.notEqual(bars[0], bars[1]); assert.notEqual(popups[0], popups[1]); assert.notEqual(blobs[0], blobs[1]);
  console.log(JSON.stringify({ windows, bars, popups, blobs }));
  // One bar record, child header and three 28-byte records, followed by
  // File/First/Target/Last text: all bytes are observed, including neighbors.
  const literal = '010000006c0000000400000014000000000000000300000070000000050000000000000000000000000000000100000000000000750000000600000000000000000000000400000058020000000000007b00000004000000000000000000000000000000590200000000000046696c6546697273745461726765744c617374';
  const expected = [Buffer.from(literal, 'hex'), Buffer.from(literal, 'hex')];
  expected[1].writeUInt32LE(6, 68);
  assert.equal(r(blobs[0]), 1); assert.equal(r(blobs[0] + 20), 3);
  assert.equal(r(blobs[0] + 68), 4); assert.equal(r(blobs[1] + 68), 6);
  function observe(states, label) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        equal(api('GetMenuState', popups[i], j, 0x400), states[i][j], label + ' menu' + i + ' pos' + j);
        equal(r(blobs[i] + 24 + j * 28 + 20), [1, 600, 601][j], 'literal IDs');
      }
      const actual = read(blobs[i], 127);
      console.log(JSON.stringify({ label, menu: i, bytes: actual.toString('hex'), expected: expected[i].toString('hex') }));
      if (!actual.equals(expected[i])) failures.push({ label, menu: i, bytes: 'differ' });
    }
  }
  observe([[0, 8, 0], [0, 11, 0]], 'initial');
  {
    const item = byPosition ? 1 : 600, flags = byPosition ? 0x400 : 0;
    equal(api('EnableMenuItem', popups[1], item, flags), 1, (byPosition ? 'position' : 'command') + ' enable second previous gray');
    expected[1].writeUInt32LE(4, 68);
    observe([[0, 8, 0], [0, 8, 0]], 'second enabled');
    equal(api('EnableMenuItem', popups[1], item, flags | 1), 0, 'gray second previous enabled');
    expected[1].writeUInt32LE(6, 68);
    observe([[0, 8, 0], [0, 11, 0]], 'second gray peer untouched');
  }
  // Dynamic controls share the command ID, but have independent state.
  const dynamic = [api('CreatePopupMenu'), api('CreatePopupMenu')];
  for (let i = 0; i < 2; i++) assert.equal(api('AppendMenuA', dynamic[i], i ? 9 : 8, 600, str('Dynamic')), 1);
  equal(api('EnableMenuItem', dynamic[1], 0, 0x400), 1, 'dynamic previous gray');
  equal(api('GetMenuState', dynamic[0], 600, 0), 8, 'dynamic peer checked');
  equal(api('GetMenuState', dynamic[1], 600, 0), 8, 'dynamic target checked');
  equal(api('EnableMenuItem', dynamic[1], 600, 2), 0, 'dynamic disable previous enabled');
  equal(api('GetMenuState', dynamic[1], 600, 0), 10, 'dynamic disabled checked');
  observe([[0, 8, 0], [0, 11, 0]], 'dynamic leaves resources untouched');
  // Missing identity/position must not mutate either resource tree.
  for (const [h, id, f] of [[0, 600, 1], [popups[1], 99, 0x401], [bars[1], 999, 1]])
    equal(api('EnableMenuItem', h, id, f), 0xffffffff, 'missing item');
  observe([[0, 8, 0], [0, 11, 0]], 'missing leaves peers untouched');
  for (const h of dynamic) assert.equal(api('DestroyMenu', h), 1);
  equal(api('EnableMenuItem', dynamic[1], 600, 1), 0xffffffff, 'destroyed dynamic handle');
  // Destroy the first owner, then mutate the surviving resource menu.
  assert.equal(api('DestroyWindow', windows[0]), 1);
  equal(api('EnableMenuItem', popups[1], 600, 0), 1, 'surviving owner previous gray');
  equal(api('GetMenuState', popups[1], 600, 0), 8, 'surviving owner checked enabled');
  assert.equal(api('DestroyWindow', windows[1]), 1);
  console.log(JSON.stringify({ calls, failures }));
  return failures;
}
(async () => {
  // Fresh public setup for each mode keeps the initial gray states distinct,
  // even when the baseline EnableMenuItem corrupts both menus.
  const failures = [...await run(true), ...await run(false)];
  assert.deepEqual(failures, [], 'literal public resource peer regression');
  console.log('PASS resource EnableMenuItem peer isolation, previous state, dynamic and lifetime controls');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
