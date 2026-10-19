#!/usr/bin/env node
'use strict';
// Production PE loader/IAT/EAT and guest export JMPs; no handler substitution.
const assert = require('node:assert/strict');
const {bootRenderHarness} = require('./render-helper');
const {ThreadManager} = require('../lib/thread-manager');
const {makeFixture, BASE, API, iat} = require('../tools/kernel32-native-fixture');
const tailCalls = !process.argv.includes('--no-tail-calls');
// Independent contract ranges, including every boundary and every non-lead byte.
const ranges = new Map([
  [932, [[0x81, 0x9f], [0xe0, 0xfc]]],
  [936, [[0x81, 0xfe]]], [949, [[0x81, 0xfe]]], [950, [[0x81, 0xfe]]],
  [1361, [[0x84, 0xd3], [0xd8, 0xde], [0xe0, 0xf9]]],
  [437, []], [1252, []], [10000, []], [65000, []], [65001, []],
]);
(async () => {
  let manager;
  const h = await bootRenderHarness({fonts: 'none', tailCalls, extraHostOverrides: {
    get_thread_locale: tid => manager.getThreadLocale(tid),
    set_thread_locale: (locale, tid) => manager.setThreadLocale(locale, tid),
  }}), e = h.exports;
  // Use the production retained locale records; no classifier/handler override.
  manager = new ThreadManager({}, h.memory, h.instance, () => ({}), {});
  const pe = makeFixture(), raw = rva => rva - 0x1000 + 0x200;
  const importedSlot = BASE + 0x1900 + API.length * 4;
  assert.equal(pe.readUInt32LE(raw(importedSlot - BASE)), 0);
  pe.writeUInt32LE(0x1c00, raw(importedSlot - BASE));
  pe.writeUInt16LE(0, raw(0x1c00)); pe.write('IsDBCSLeadByteEx\0', raw(0x1c02));
  new Uint8Array(h.memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const stack = e.get_esp(), read = p => e.guest_read32(p) >>> 0;
  const call = (pointer, args = []) => {
    e.set_esp(stack); e.clear_yield();
    e.call_func(pointer, ...Array.from({length: 4}, (_, i) => args[i] || 0));
    const before = e.get_esp(); e.run(1000);
    assert.equal(e.get_eip(), 0, 'guest returned');
    assert.equal(e.get_esp(), before + 4 * (args.length + 1), 'stdcall cleanup');
    return e.get_eax() >>> 0;
  };
  const api = (name, args = []) => call(read(iat(name)), args);
  const string = text => {
    const p = e.guest_alloc(text.length + 1);
    Buffer.from(text + '\0').forEach((b, i) => e.guest_write8(p + i, b)); return p;
  };
  const module = api('LoadLibraryA', [string('KERNEL32.DLL')]);
  assert(module && module !== BASE);
  const dynamic = api('GetProcAddress', [module, string('IsDBCSLeadByteEx')]); assert(dynamic);
  const entry = require('../src/kernel32-exports.json').exports.find(x => x.name === 'IsDBCSLeadByteEx');
  assert.equal(entry.ordinal, 587);
  const exp = module + read(module + read(module + 0x3c) + 120);
  const eat = module + read(module + read(exp + 28) + (entry.ordinal - 1) * 4);
  assert.equal(dynamic, eat, 'dynamic resolution uses actual KERNEL32 EAT');
  assert.equal(e.guest_read8(dynamic), 0xe9, 'export executes guest JMP');
  assert.equal(api('GetProcAddress', [module, entry.ordinal]), dynamic, 'ordinal identity');
  const imported = read(importedSlot); assert(imported && imported !== 0x1c00);
  const setOem = api('GetProcAddress', [module, string('SetConsoleOutputCP')]); assert(setOem);
  const getOem = api('GetProcAddress', [module, string('GetOEMCP')]); assert(getOem);
  const setLocale = api('GetProcAddress', [module, string('SetThreadLocale')]); assert(setLocale);
  const getLocale = api('GetProcAddress', [module, string('GetThreadLocale')]); assert(getLocale);
  for (const pointer of [imported, dynamic]) {
    const check = (cp, ch, expected, error = 1234) => {
      api('SetLastError', [1234]);
      assert.equal(call(pointer, [cp, ch]), expected, `cp=${cp} byte=${ch}`);
      assert.equal(api('GetLastError'), error, 'valid false/true preserve LastError');
    };
    for (const [cp, spans] of ranges) {
      for (let ch = 0; ch < 256; ch++) {
        check(cp, ch, Number(spans.some(([lo, hi]) => ch >= lo && ch <= hi)));
      }
    }
    e.set_ansi_code_page(1252); check(0, 0x81, 0);
    e.set_ansi_code_page(932); check(0, 0x81, 1); check(0, 0xa0, 0);
    assert.equal(call(setLocale, [0x0409]), 1); check(3, 0x81, 0);
    e.set_ansi_code_page(1252);
    for (const [locale, cp] of [[0x0411, 932], [0x0412, 949], [0x0804, 936],
      [0x1004, 936], [0x0404, 950], [0x0c04, 950], [0x1404, 950], [0x10411, 932]]) {
      assert.equal(call(setLocale, [locale]), 1); assert.equal(call(getLocale), locale);
      check(0, 0x81, 0); check(3, 0x81, 1);
      check(3, 0xa0, cp === 932 ? 0 : 1);
    }
    assert.equal(call(setLocale, [0x7777]), 1); check(3, 0x81, 0, 87);
    assert.equal(call(setLocale, [0x0409]), 1); check(3, 0x81, 0);
    e.set_ansi_code_page(1252);
    assert.equal(call(getOem), 437); check(1, 0x81, 0);
    assert.equal(call(setOem, [932]), 1);
    assert.equal(call(getOem), 437); check(1, 0x81, 0); check(932, 0x81, 1);
    assert.equal(call(setOem, [437]), 1); check(1, 0x81, 0);
    check(2, 0x81, 0); // default Macintosh 10000
    check(932, 0x181, 1); check(932, 0x100, 0); check(932, -1, 0); // BYTE ABI
    for (const cp of [4, 42, 1200, 1201, 65535, 0xffffffff]) check(cp, 0x81, 0, 87);
    check(932, 0x81, 1); // recovery after invalid page
  }
  h.hostCtx.stopAudio();
  console.log('IsDBCSLeadByteEx production PE static/dynamic routes, all bytes, aliases, errors and ESP PASS; tailCalls=' + tailCalls);
})().catch(error => { console.error(error); process.exitCode = 1; });
