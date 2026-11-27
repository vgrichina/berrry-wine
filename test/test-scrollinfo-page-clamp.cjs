#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
const { createHostImports } = require('../lib/host-imports');
const apiTable = require('../src/api_table.json');

// Microsoft SetScrollInfo: unsigned nPage is in [0, nMax-nMin+1];
// signed nPos is in [nMin, nMax-max(nPage-1,0)]. Literal oracles below.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setscrollinfo
// Execute the shipped module unchanged: no extra exports/source rewriting.
function run(modulePath = 'build/wine-assembly.wasm') {
  const bytes = fs.readFileSync(modulePath), module = new WebAssembly.Module(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const actual = createHostImports(ctx), imports = {}, setupImports = [];
  let setup = true;
  for (const item of WebAssembly.Module.imports(module)) {
    const fn = actual[item.module]?.[item.name];
    (imports[item.module] ||= {})[item.name] = item.kind === 'memory' ? memory : (...args) => {
      if (fn) return fn(...args);
      // Headless host has no Beep process/thread owner. Only PE initialization
      // may use these two notifications; a missing import during API work fails.
      if (setup && ['beep_process_begin', 'beep_thread_begin'].includes(item.name)) {
        setupImports.push({ name: item.name, args }); return 0;
      }
      throw new Error('Missing actual host import: ' + item.module + '.' + item.name);
    };
  }
  const e = new WebAssembly.Instance(module, imports).exports; ctx.exports = e;
  const mem = new Uint8Array(memory.buffer), wa = p => e.guest_to_wasm(p) >>> 0;
  const pe = makeFixture(); mem.set(pe, e.get_staging());
  assert.equal(e.load_pe(pe.length) >>> 0, 0x402000); setup = false;
  e.set_api_log(0); e.set_uop(0); e.set_block_exec(0);
  const read = (p, n) => Buffer.from(mem.subarray(wa(p), wa(p) + n));
  let cursor = 0x900000;
  const str = s => { const p = cursor; const b = Buffer.from(s + '\0'); cursor += b.length;
    b.forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const frame = 0x1108000, stack = frame + 64, area = 0x910000, si = area + 32;
  const registers = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
  const failures = [], rows = []; let calls = 0;
  function call(entry, args, label, expected) {
    mem.fill(0x5a, wa(frame), wa(frame) + 192);
    const returnPC = 0x401000;
    e.guest_write32(stack, returnPC);
    args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
    const before = read(frame, 192);
    const seed = [0x12345678, 0x21345678, 0x31345678, 0x41345678,
      stack, 0x51345678, 0x61345678, 0x71345678];
    registers.forEach((r, i) => e['set_' + r](seed[i]));
    e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 256 && (e.get_eip() >>> 0) !== returnPC; i++) e.run(1);
    assert.equal(e.get_eip() >>> 0, returnPC, label + ' continuation');
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, label + ' ESP');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.equal(e['get_' + registers[i]]() >>> 0, seed[i], label + ' ' + registers[i]);
    assert.deepEqual(read(frame, 192), before, label + ' stack/guards');
    const ret = e.get_eax() | 0; calls++;
    rows.push({ label, ret, expected });
    if (expected !== undefined && ret !== expected) failures.push({ label, ret, expected });
    return ret;
  }
  const load = e.guest_read32(iat('LoadLibraryA')) >>> 0;
  const resolve = e.guest_read32(iat('GetProcAddress')) >>> 0;
  const user = call(load, [str('USER32.DLL')], 'LoadLibraryA'); assert.ok(user);
  const entries = {};
  for (const name of ['CreateWindowExA', 'DestroyWindow', 'SetScrollInfo', 'GetScrollInfo']) {
    entries[name] = call(resolve, [user, str(name)], 'GetProcAddress ' + name) >>> 0;
    assert.ok(entries[name]);
    assert.equal(e.thunk_word(entries[name], 1), apiTable.find(v => v.name === name).id);
  }
  const api = (name, args, label, expected) => call(entries[name], args, label, expected);
  function create(cls, style) {
    const hwnd = api('CreateWindowExA', [0, str(cls), str('scroll page regression'), style,
      0, 0, 160, 100, 0, 0, 0, 0], 'create ' + cls);
    assert.ok(hwnd); return hwnd;
  }
  function info(hwnd, bar, mask, values, expected, label, get = false) {
    mem.fill(0xa6, wa(area), wa(area) + 128);
    [28, mask, ...values, 0x13572468].forEach((v, i) => e.guest_write32(si + i * 4, v));
    const before = read(area, 128), wanted = Buffer.from(before);
    if (get) expected.forEach((v, i) => wanted.writeUInt32LE(v >>> 0, 40 + i * 4));
    api(get ? 'GetScrollInfo' : 'SetScrollInfo', get ? [hwnd, bar, si] : [hwnd, bar, si, 0],
      label, get ? 1 : expected[3]);
    const after = read(area, 128);
    if (!after.equals(wanted)) failures.push({ label, actual: after.toString('hex'), expected: wanted.toString('hex') });
    rows[rows.length - 1].info = Array.from({ length: 4 }, (_, i) => e.guest_read32(si + 8 + i * 4) | 0);
  }
  const set = (h, b, mask, v, want, label) => info(h, b, mask, v, want, label);
  const get = (h, b, want, label) => info(h, b, 7, [777, 888, 999, 666], want, label, true);
  const peer = create('STATIC', 0x80300000);
  const peerValues = [[100, 200, 5, 125], [-50, 50, 6, -10]];
  peerValues.forEach((v, b) => set(peer, b, 7, v, v, 'peer seed ' + b));
  const cases = [
    { name: 'positive oversized', v: [10, 19, 11, 30], want: [10, 19, 10, 10] },
    { name: 'negative oversized', v: [-7, 2, 11, 30], want: [-7, 2, 10, -7] },
    { name: 'singleton', v: [5, 5, 2, 30], want: [5, 5, 1, 5] },
    { name: 'unsigned maximum', v: [-7, 2, 0xffffffff, 30], want: [-7, 2, 10, -7] },
    { name: 'page zero', v: [10, 19, 0, 18], want: [10, 19, 0, 18] },
    { name: 'page one', v: [-7, 2, 1, 2], want: [-7, 2, 1, 2] },
    { name: 'exact page', v: [-7, 2, 10, 0], want: [-7, 2, 10, -7] },
    { name: 'ordinary position', v: [10, 19, 3, 16], want: [10, 19, 3, 16] },
    { name: 'low signed endpoint', v: [-2147483648, -2147483640, 99, -2147483641], want: [-2147483648, -2147483640, 9, -2147483648] },
    { name: 'high signed endpoint', v: [2147483640, 2147483647, 99, 2147483646], want: [2147483640, 2147483647, 8, 2147483640] },
    { name: 'wide inclusive range', v: [-2147483648, 0, 0xffffffff, 0], want: [-2147483648, 0, 0x80000001, -2147483648] },
    { name: 'full signed range', v: [-2147483648, 2147483647, 0xffffffff, 0], want: [-2147483648, 2147483647, 0xffffffff, -2147483647] },
  ];
  for (const kind of [{ cls: 'STATIC', style: 0x80300000, bar: 0 },
    { cls: 'STATIC', style: 0x80300000, bar: 1 },
    { cls: 'SCROLLBAR', style: 0x80000000, bar: 2 },
    { cls: 'SCROLLBAR', style: 0x80000001, bar: 2 }]) {
    const h = create(kind.cls, kind.style), b = kind.bar;
    const opposite = b === 0 ? 1 : 0, sentinel = [-30, 90, 3, 12];
    if (b !== 2) set(h, opposite, 7, sentinel, sentinel, 'opposite seed');
    for (const c of cases) {
      const label = kind.cls + ':' + kind.style + ':' + b + ' ' + c.name;
      set(h, b, 7, c.v, c.want, label);
      get(h, b, c.want, label + ' get'); get(h, b, c.want, label + ' repeat');
      if (b !== 2) get(h, opposite, sentinel, label + ' opposite');
      peerValues.forEach((v, axis) => get(peer, axis, v, label + ' peer ' + axis));
    }
    set(h, b, 7, [10, 19, 1, 15], [10, 19, 1, 15], 'page-only seed');
    set(h, b, 2, [-99, 999, 11, -77], [10, 19, 10, 10], 'page-only');
    get(h, b, [10, 19, 10, 10], 'page-only get');
    set(h, b, 7, [-30, 90, 80, 0], [-30, 90, 80, 0], 'range-only seed');
    set(h, b, 1, [-7, 2, 0, 999], [-7, 2, 10, -7], 'range-only');
    get(h, b, [-7, 2, 10, -7], 'range-only get');
    api('DestroyWindow', [h], 'destroy target', 1);
    peerValues.forEach((v, axis) => get(peer, axis, v, 'peer after target destruction'));
    // Fresh lifetime after a destroyed target: oversized page must not leak.
    const fresh = create(kind.cls, kind.style);
    set(fresh, b, 7, [20, 40, 2, 24], [20, 40, 2, 24], 'replacement seed');
    get(fresh, b, [20, 40, 2, 24], 'replacement get');
    api('DestroyWindow', [fresh], 'destroy replacement', 1);
  }
  api('DestroyWindow', [peer], 'destroy peer', 1);
  console.log(JSON.stringify({ moduleSHA256: crypto.createHash('sha256').update(bytes).digest('hex'),
    calls, setupImports, rows, failures }));
  assert.deepEqual(failures, [], 'inclusive page clamp, literal public state and peer isolation');
  console.log('PASS public SetScrollInfo page clamp, signed/unsigned endpoints, masks, peers, lifetimes, ABI/guards');
}
if (require.main === module) { try { run(process.argv[2]); } catch (e) { console.error(e); process.exitCode = 1; } }
module.exports = { run };
