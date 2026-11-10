#!/usr/bin/env node
'use strict';

// Native CRT overrides (09a6-handlers-crt.wat, docs/crt-native-overrides.md)
// against the authentic export they replace.
//
// For each real MSVCRT build we have (VC6 msvcrt.dll, VC7 msvcr70.dll, VC7.1
// msvcr71.dll) this loads the DLL for real (DllMain included), binds a
// synthetic caller's imports through the production $patch_caller_iat -- so
// the override names land on API thunks exactly as an app's would -- and then
// runs every case twice through the interpreter: once into the authentic
// export, once into the thunk. EAX, the caller's ESP after return (cdecl: only
// the return address is popped), every byte of the buffers involved and, for
// floor, the x87 result, status word, TOP and control word must match.
//
// The fallback path is exercised too: floor of a NaN/infinity and floor under
// an unmasked precision exception, and every locale-sensitive handler after a
// setlocale away from "C" (_wcsicmp, _wcsnicmp and the older _stricmp),
// must hand the call to the authentic export
// (counted by get_crt_fallback_count) instead of answering natively.
//
// The DLLs are corpus binaries (gitignored). CRT_BINARIES=<dir> points at a
// test/binaries tree when running from a checkout that has none; a build with
// none of them prints SKIP.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const { loadDlls, _test: { findDllExport } } = require('../lib/dll-loader');

const ROOT = process.env.CRT_BINARIES || path.join(__dirname, 'binaries');
const CRTS = [
  { name: 'msvcrt.dll', file: 'dlls/msvcrt.dll' },
  { name: 'msvcr70.dll', file: 'candidates/unreal-tournament-2003-demo/installed/system/msvcr70.dll' },
  { name: 'msvcr71.dll', file: 'candidates/unreal-tournament-2004-demo/installed/system/msvcr71.dll' },
];
const EXE = 'calc.exe';

const OVERRIDES = ['wcslen', 'wcscpy', 'wcscat', 'wcsstr', '_wcsicmp', '_wcsnicmp',
  'floor', 'setlocale', '_wsetlocale', '_stricmp', 'memcpy'];

const EXTRA_WAT = `
  (func (export "t_fpu_pop") (result f64) (call $fpu_pop))
  (func (export "t_fpu_push") (param $v f64) (call $fpu_push (local.get $v)))
  (func (export "t_fpu_top") (result i32) (global.get $fpu_top))
  (func (export "t_fpu_sw") (result i32) (global.get $fpu_sw))
  (func (export "t_set_fpu_sw") (param $v i32) (global.set $fpu_sw (local.get $v)))
  (func (export "t_fpu_cw") (result i32) (global.get $fpu_cw))
  (func (export "t_set_fpu_cw") (param $v i32) (global.set $fpu_cw (local.get $v)))
`;

const hex = v => '0x' + (v >>> 0).toString(16);

async function checkCrt(crt, exeBytes) {
  const dllBytes = fs.readFileSync(path.join(ROOT, crt.file));
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const u8 = () => new Uint8Array(memory.buffer);
  const dv = () => new DataView(memory.buffer);

  u8().set(exeBytes, e.get_staging());
  e.load_pe(exeBytes.length);
  const [loaded] = loadDlls(e, memory.buffer, exeBytes, [{ name: crt.name, bytes: dllBytes }], null);
  const dllBase = loaded.loadAddr >>> 0;

  let dllIdx = -1;
  for (let i = 0; i < e.get_dll_count(); i++) {
    if ((dv().getUint32(e.get_dll_table() + i * 32, true) >>> 0) === dllBase) dllIdx = i;
  }
  assert.ok(dllIdx >= 0, `${crt.name} is in the DLL table`);

  const w = g => e.guest_to_wasm(g) >>> 0;
  const put8 = (g, bytes) => u8().set(bytes, w(g));
  const putAscii = (g, s) => put8(g, Buffer.from(s + '\0', 'latin1'));
  const r32 = g => dv().getUint32(w(g), true);
  const w32 = (g, v) => dv().setUint32(w(g), v >>> 0, true);

  // A synthetic caller: one import descriptor naming this CRT, importing
  // every override by name. RVAs are relative to the block itself.
  const blk = e.guest_alloc(0x1000) >>> 0;
  u8().fill(0, w(blk), w(blk) + 0x1000);
  w32(blk + 0, 0x40);        // OriginalFirstThunk (ILT)
  w32(blk + 12, 0x20);       // Name
  w32(blk + 16, 0x80);       // FirstThunk (IAT)
  putAscii(blk + 0x20, crt.name);
  OVERRIDES.forEach((name, i) => {
    const hn = 0x100 + i * 0x20;
    putAscii(blk + hn + 2, name);
    w32(blk + 0x40 + i * 4, hn);
    w32(blk + 0x80 + i * 4, hn);
  });
  e.patch_caller_iat(blk, 0, blk + 0x20, dllIdx);
  e.seal_thunks();

  const real = {}, thunk = {};
  OVERRIDES.forEach((name, i) => {
    real[name] = findDllExport(e, memory.buffer, dllBase, name) >>> 0;
    thunk[name] = r32(blk + 0x80 + i * 4);
    assert.ok(real[name], `${crt.name} exports ${name}`);
    assert.notStrictEqual(thunk[name], real[name], `${crt.name}!${name} import is bound to a native thunk`);
  });

  // cdecl call through the interpreter; returns EAX and checks the callee
  // popped exactly its return address.
  const stackTop = e.get_esp() >>> 0;
  let lastCallStopped = false;
  function call(addr, args) {
    let esp = (stackTop - 0x400) >>> 0;
    for (let i = args.length - 1; i >= 0; i--) { esp -= 4; w32(esp, args[i]); }
    const argsBase = esp;
    esp -= 4; w32(esp, 0);
    e.set_esp(esp);
    e.set_eip(addr);
    // An unhandled exception (the PE-unmasked floor case below) stops the guest
    // where it raised since e09a1c2d: EIP 0 and $yield_flag set, with the stack
    // wherever the raise left it. A left-over flag would halt the next run
    // before its first block, so drain it (run halts and clears it at once).
    if (e.get_yield_flag()) e.run(1);
    e.run(2000000);
    assert.strictEqual(e.get_eip() >>> 0, 0, `call ${hex(addr)} returned or stopped`);
    lastCallStopped = !!e.get_yield_flag();
    // Only a call that returned is held to the cdecl contract.
    if (!lastCallStopped)
      assert.strictEqual(e.get_esp() >>> 0, argsBase, `call ${hex(addr)} pops only its return address`);
    const eax = e.get_eax() >>> 0;
    e.set_esp(stackTop);
    return eax;
  }

  // Scratch arena: case inputs are rewritten before each arm from the same
  // bytes, and the whole arena is compared afterwards.
  const ARENA = 0x3000;
  const arena = e.guest_alloc(ARENA) >>> 0;
  const snapshot = () => Buffer.from(u8().slice(w(arena), w(arena) + ARENA));
  const putW = (g, s) => {
    const b = Buffer.alloc(s.length * 2 + 2);
    for (let i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), i * 2);
    put8(g, b);
  };

  let cases = 0;
  function compare(label, name, setup, args) {
    const arms = [real[name], thunk[name]].map(addr => {
      u8().fill(0xCD, w(arena), w(arena) + ARENA);
      setup();
      const eax = call(addr, args());
      return { eax, mem: snapshot() };
    });
    assert.strictEqual(hex(arms[1].eax), hex(arms[0].eax), `${crt.name} ${label}: EAX`);
    assert.ok(arms[0].mem.equals(arms[1].mem), `${crt.name} ${label}: memory`);
    cases++;
    return arms[0].eax;
  }

  const A = arena, B = arena + 0x800, C = arena + 0x1000;

  // Original SDL drawing copies 1..4 bytes per pixel. Exercise those sizes,
  // alignment/tails and a page crossing through the production import binding
  // on each real CRT. Include the untouched canaries in the comparison.
  for (const size of [0, 1, 2, 3, 4, 7, 16, 31, 255, 1024]) {
    for (const offset of [0, 1, 3, 4094]) {
      compare(`memcpy ${size}/${offset}`, 'memcpy', () => {
        const bytes = Buffer.alloc(1024);
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 73 + (i >>> 4)) & 255;
        put8(arena + 0x1800, bytes);
      }, () => [arena + offset, arena + 0x1800, size]);
    }
  }

  // wcslen: empty, short, and one longer than the 32768 cap the old handler had.
  for (const s of ['', 'a', 'Hello, world', 'y'.repeat(700)]) {
    compare(`wcslen("${s.slice(0, 12)}"x${s.length})`, 'wcslen', () => putW(A, s), () => [A]);
  }
  {
    const big = e.guest_alloc(40002 * 2) >>> 0;
    const b = Buffer.alloc(40000 * 2 + 2, 0);
    for (let i = 0; i < 40000; i++) b.writeUInt16LE(0x41 + (i % 26), i * 2);
    put8(big, b);
    const n1 = call(real.wcslen, [big]), n2 = call(thunk.wcslen, [big]);
    assert.strictEqual(n2, n1, `${crt.name} wcslen(40000 units)`);
    assert.strictEqual(n1, 40000);
    cases++;
  }

  // wcscpy / wcscat, including overlaps whose result a forward unit copy defines.
  compare('wcscpy', 'wcscpy', () => putW(B, 'source text'), () => [A, B]);
  compare('wcscpy empty', 'wcscpy', () => { putW(A, 'old'); putW(B, ''); }, () => [A, B]);
  compare('wcscpy overlap dst<src', 'wcscpy', () => putW(A, 'abcdefghij'), () => [A, A + 4]);
  compare('wcscat', 'wcscat', () => { putW(A, 'head '); putW(B, 'tail'); }, () => [A, B]);
  compare('wcscat empty dst', 'wcscat', () => { putW(A, ''); putW(B, 'tail'); }, () => [A, B]);
  compare('wcscat empty src', 'wcscat', () => { putW(A, 'head'); putW(B, ''); }, () => [A, B]);
  compare('wcscat overlap src after dst', 'wcscat',
    () => { putW(A, 'head'); putW(A + 10, 'tail'); }, () => [A, A + 10]);
  compare('wcscat non-ASCII', 'wcscat',
    () => { putW(A, 'é中'); putW(B, '￿Ā'); }, () => [A, B]);

  // wcsstr: every return shape.
  for (const [h, n] of [['hello world', 'world'], ['abc', ''], ['', ''], ['', 'a'],
                        ['aaab', 'aab'], ['abc', 'abcd'], ['abcabc', 'cab'], ['abc', 'x'],
                        ['xxéyy', 'éy']]) {
    compare(`wcsstr("${h}","${n}")`, 'wcsstr', () => { putW(A, h); putW(B, n); }, () => [A, B]);
  }

  // _wcsicmp / _wcsnicmp in the C locale.
  const pairs = [['', ''], ['abc', 'ABC'], ['abc', 'abd'], ['ab', 'a'], ['a', 'ab'],
                 ['[', 'a'], ['_', 'A'], ['Z', 'z'], ['é', 'É'], ['￿', 'a'],
                 ['@', '`'], ['Unreal', 'UNREAL tournament']];
  for (const [x, y] of pairs) {
    compare(`_wcsicmp("${x}","${y}")`, '_wcsicmp', () => { putW(A, x); putW(B, y); }, () => [A, B]);
    for (const n of [0, 1, 2, 5, 0xFFFFFFFF]) {
      compare(`_wcsnicmp("${x}","${y}",${n})`, '_wcsnicmp', () => { putW(A, x); putW(B, y); }, () => [A, B, n]);
    }
  }
  // _stricmp (the older Morrowind override) in the C locale.
  const putA = (g, s) => put8(g, Buffer.from(s + '\0', 'latin1'));
  for (const [x, y] of [...pairs, ['\xe9', '\xc9'], ['\xff', 'a'], ['a\x80', 'A\x7f']]) {
    compare(`_stricmp("${x}","${y}")`, '_stricmp', () => { putA(A, x); putA(B, y); }, () => [A, B]);
  }

  // Straddling a 4KB guest page boundary: the handlers read unit by unit
  // through $gl16, so a string crossing pages reads the same as one that
  // does not.
  {
    const pageEdge = ((arena + 0x1000) & ~0xFFF) >>> 0;
    const s = pageEdge - 6;
    if (s >= arena && s + 64 < arena + ARENA) {
      compare('_wcsicmp across a page', '_wcsicmp',
        () => { putW(s, 'CrossPageString'); putW(C + 0x800, 'crosspagestrinG'); }, () => [s, C + 0x800]);
      compare('wcslen across a page', 'wcslen', () => putW(s, 'CrossPageString'), () => [s]);
    }
  }

  // floor: x87 result, condition codes, TOP and control word.
  const f64words = x => { const b = Buffer.alloc(8); b.writeDoubleLE(x); return [b.readUInt32LE(0), b.readUInt32LE(4)]; };
  const bits = x => { const b = Buffer.alloc(8); b.writeDoubleLE(x); return b.readBigUInt64LE(0); };
  function floorArm(addr, x, cw) {
    e.t_set_fpu_cw(cw);
    e.t_set_fpu_sw(0);
    const top0 = e.t_fpu_top();
    call(addr, f64words(x));
    const out = { top: e.t_fpu_top(), sw: e.t_fpu_sw(), cw: e.t_fpu_cw(), exited: lastCallStopped };
    if (out.exited) return out;  // raised and stopped: no result was stored
    assert.strictEqual(out.top, (top0 + 7) & 7, 'floor leaves one value on the x87 stack');
    out.r = bits(e.t_fpu_pop());
    return out;
  }
  const fb0 = e.get_crt_fallback_count();
  const floorCase = (x, cw, label) => {
    const a = floorArm(real.floor, x, cw), n = floorArm(thunk.floor, x, cw);
    assert.strictEqual(n.exited, a.exited, `${crt.name} floor(${label}) both arms take the same road`);
    assert.strictEqual(n.r, a.r, `${crt.name} floor(${label}) result bits`);
    assert.strictEqual(hex(n.sw), hex(a.sw), `${crt.name} floor(${label}) status word`);
    assert.strictEqual(n.top, a.top, `${crt.name} floor(${label}) TOP`);
    assert.strictEqual(hex(n.cw), hex(a.cw), `${crt.name} floor(${label}) control word`);
    cases++;
  };
  for (const x of [0, -0, 1, -1, 1.5, -1.5, 2.5, -2.5, 0.25, -0.25, 1e300, -1e300,
                   4503599627370495.5, -4503599627370495.5, 2 ** 52, 5e-324, -5e-324, 123456.789]) {
    floorCase(x, 0x027F, String(Object.is(x, -0) ? '-0' : x));
  }
  assert.strictEqual(e.get_crt_fallback_count(), fb0, 'finite floor under masked PE is answered natively');
  for (const x of [NaN, Infinity, -Infinity]) floorCase(x, 0x027F, String(x));
  assert.strictEqual(e.get_crt_fallback_count(), fb0 + 3, 'non-finite floor defers to the authentic export');
  floorCase(4, 0x025F, '4, PE unmasked');
  assert.strictEqual(e.get_crt_fallback_count(), fb0 + 3, 'an exact floor needs no precision report');
  // The authentic code reports this through _except1, which raises
  // STATUS_FLOAT_INEXACT_RESULT (the "[Exit] code=-1073684849" lines): both
  // arms must take that same road.
  floorCase(-1.5, 0x025F, '-1.5, PE unmasked');
  assert.strictEqual(e.get_crt_fallback_count(), fb0 + 4, 'an inexact floor under unmasked PE defers');

  // setlocale: "C" keeps the native path; anything else makes every
  // locale-sensitive handler defer from then on.
  const loc = e.guest_alloc(64) >>> 0;
  putAscii(loc, 'C');
  compare('setlocale(LC_ALL,"C")', 'setlocale', () => {}, () => [0, loc]);
  let fb = e.get_crt_fallback_count();
  compare('_wcsicmp after setlocale C', '_wcsicmp', () => { putW(A, 'abc'); putW(B, 'ABD'); }, () => [A, B]);
  compare('_stricmp after setlocale C', '_stricmp', () => { putA(A, 'abc'); putA(B, 'ABD'); }, () => [A, B]);
  assert.strictEqual(e.get_crt_fallback_count(), fb, '"C" locale keeps _wcsicmp and _stricmp native');
  putAscii(loc, 'English');
  call(thunk.setlocale, [0, loc]);
  fb = e.get_crt_fallback_count();
  compare('_wcsicmp after setlocale English', '_wcsicmp', () => { putW(A, 'abc'); putW(B, 'ABD'); }, () => [A, B]);
  compare('_wcsnicmp after setlocale English', '_wcsnicmp', () => { putW(A, 'abc'); putW(B, 'ABD'); }, () => [A, B, 3]);
  // Whatever the authentic locale-aware path makes of a high byte, the thunk
  // must hand it the call (the fallback count below), not answer natively.
  compare('_stricmp after setlocale English', '_stricmp', () => { putA(A, 'caf\xe9'); putA(B, 'CAF\xc9'); }, () => [A, B]);
  assert.strictEqual(e.get_crt_fallback_count(), fb + 3, 'a non-C locale sends case-folding to the authentic export');
  compare('wcslen after setlocale English', 'wcslen', () => putW(A, 'still native'), () => [A]);
  assert.strictEqual(e.get_crt_fallback_count(), fb + 3, 'locale-free handlers stay native');

  console.log(`PASS  ${crt.name}: ${cases} cases identical to the authentic export, fallbacks exact`);
}

(async () => {
  const exePath = path.join(ROOT, EXE);
  const present = CRTS.filter(c => fs.existsSync(path.join(ROOT, c.file)));
  if (!fs.existsSync(exePath) || !present.length) {
    console.log(`SKIP  no ${EXE} / CRT DLLs under ${ROOT} (set CRT_BINARIES)`);
    return;
  }
  const exeBytes = fs.readFileSync(exePath);
  for (const crt of present) await checkCrt(crt, exeBytes);
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
