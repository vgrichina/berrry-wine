#!/usr/bin/env node
// A statically linked MSVC _ftol runs natively and returns what the
// interpreted body returns.
//
// MSVC links _ftol into every exe or DLL built against the static CRT, and
// calls it at every float-to-int conversion. The imported copy has long been
// native ($native_override_export_api_id); a linked-in copy ran as an
// interpreted block per call -- 14% of Croc 2's block entries in its software
// renderer. The decoder now recognises the exact 39-byte body
// ($ftol_body_at) and emits $th_ftol_native + RET.
//
// This places the body twice: once inside a page (native path) and once
// straddling a page boundary (deliberately not matched, so interpreted), calls
// each from a small stub, and requires identical EDX:EAX, EBP, ESP, x87 stack
// depth and control word for every value. The native path is identified by
// the one thing it does not do: the authentic body stores scratch below ESP.
//
// Run: node test/test-ftol-static-body.js

const fs = require('fs');
const path = require('path');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const WASM_PATH = process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');

const FTOL = [
  0x55, 0x8b, 0xec, 0x83, 0xc4, 0xf4, 0x9b, 0xd9, 0x7d, 0xfe, 0x9b, 0x66, 0x8b, 0x45, 0xfe,
  0x80, 0xcc, 0x0c, 0x66, 0x89, 0x45, 0xfc, 0xd9, 0x6d, 0xfc, 0xdf, 0x7d, 0xf4, 0xd9, 0x6d,
  0xfe, 0x8b, 0x45, 0xf4, 0x8b, 0x55, 0xf8, 0xc9, 0xc3,
];

let failures = 0;
function check(name, got, want) {
  if (got === want) return;
  console.log(`  FAIL ${name}: got ${got}, want ${want}`);
  failures++;
}

async function main() {
  const wasmBytes = fs.readFileSync(WASM_PATH);
  const exeBytes = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const h = createHostImports(ctx).host;
  h.memory = memory;
  h.exit = () => {};
  h.log = () => {};
  h.log_i32 = () => {};
  h.crash_unimplemented = () => {};
  h.wait_multiple = () => 0;
  h.shell_execute = () => 33;
  const { instance } = await WebAssembly.instantiate(wasmBytes, { host: h });
  ctx.exports = instance.exports;
  const e = instance.exports;
  const dv = new DataView(e.memory.buffer);
  const mem = new Uint8Array(e.memory.buffer);
  mem.set(exeBytes, e.get_staging());
  e.load_pe(exeBytes.length);

  const imageBase = e.get_image_base();
  const g2w = addr => RegionMap.g2w(addr, imageBase);
  const le32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  const put = (addr, bytes) => { const wa = g2w(addr); bytes.forEach((b, i) => { mem[wa + i] = b; }); };

  const NATIVE_FTOL = imageBase + 0x2100;      // wholly inside one page
  const SPLIT_FTOL = imageBase + 0x2FF0;       // crosses into the next page
  put(NATIVE_FTOL, FTOL);
  put(SPLIT_FTOL, FTOL);
  const X = imageBase + 0x8000, OUT = imageBase + 0x8010;
  const STACK = imageBase + 0xD00000;

  let codeOffset = 0;
  function convert(value, target) {
    // Each path starts with clean exception flags; compare PE/IE/C1 explicitly.
    e.set_uop(0);
    put(imageBase + 0x2000, [0xdb, 0xe3, 0xeb, 0]);
    e.set_eip(imageBase + 0x2000); e.run(1);
    if (typeof value === 'object' && value) {
      dv.setBigUint64(g2w(X), value.mant, true);
      dv.setUint16(g2w(X) + 8, value.se, true);
    } else dv.setFloat64(g2w(X), value, true);
    for (let i = 0; i < 24; i += 4) dv.setUint32(g2w(OUT + i), 0xdeadbeef, true);
    // Scratch below the callee's frame: the authentic body writes here.
    for (let a = STACK - 0x40; a < STACK; a += 4) dv.setUint32(g2w(a), 0x5a5a5a5a, true);
    const stub = imageBase + 0x4000 + codeOffset;   // fresh code per call
    codeOffset += 64;
    const call = target - (stub + 16);   // rel32 from the next instruction
    const bytes = [
      0xBD, ...le32(0x12345678),        // mov ebp, 0x12345678
      ...(typeof value === 'object' && value ? [0xDB, 0x2D] : [0xDD, 0x05]), ...le32(X), // fld m80 or m64
      0xE8, ...le32(call),              // call _ftol
      0xA3, ...le32(OUT),               // mov [out], eax
      0x89, 0x15, ...le32(OUT + 4),     // mov [out+4], edx
      0x89, 0x2D, ...le32(OUT + 8),     // mov [out+8], ebp
      0x89, 0x25, ...le32(OUT + 12),    // mov [out+12], esp
      0xD9, 0x3D, ...le32(OUT + 16),    // fnstcw [out+16]
      0xDF, 0xE0,                       // fnstsw ax
      0xA3, ...le32(OUT + 20),          // mov [out+20], eax
      0xC3,
    ];
    put(stub, bytes);
    e.set_esp(STACK - 0x10);
    dv.setUint32(g2w(STACK - 0x10), 0, true);
    e.set_eip(stub);
    e.run(100000);
    let scratchTouched = 0;
    for (let a = STACK - 0x40; a < STACK - 0x14; a += 4) {  // below the return address
      if (dv.getUint32(g2w(a), true) !== 0x5a5a5a5a) scratchTouched = 1;
    }
    return {
      lo: dv.getUint32(g2w(OUT), true), hi: dv.getUint32(g2w(OUT + 4), true),
      ebp: dv.getUint32(g2w(OUT + 8), true), esp: dv.getUint32(g2w(OUT + 12), true),
      cw: dv.getUint16(g2w(OUT + 16), true), top: (dv.getUint32(g2w(OUT + 20), true) >>> 11) & 7,
      status: dv.getUint32(g2w(OUT + 20), true) & 0x23f,
      scratchTouched,
    };
  }

  const values = [0, -0, 0.5, -0.5, 1.5, -1.5, 2.5, 255.99, -255.99, 1e9 + 0.75, -1e9 - 0.75,
    2147483647.9, 2147483648.5, -2147483649.5, 0x100000002, -0x100000002, 1e300, -1e300,
    NaN, Infinity, -Infinity, 1e-300, 123456.789, -98765.4321];
  for (const v of values) {
    const n = convert(v, NATIVE_FTOL), s = convert(v, SPLIT_FTOL);
    for (const k of ['lo', 'hi', 'ebp', 'esp', 'cw', 'top', 'status']) check(`${v} ${k}`, n[k], s[k]);
    const invalid = !Number.isFinite(v) || v >= 2 ** 63 || v < -(2 ** 63);
    check(`${v} literal IE/PE/C1`, n.status, invalid ? 1 : v === Math.trunc(v) ? 0 : 0x20);
    check(`${v} native path ran (no scratch below ESP)`, n.scratchTouched, 0);
    check(`${v} split copy interpreted (scratch written)`, s.scratchTouched, 1);
  }
  const t = convert(-2.5, NATIVE_FTOL);
  check('-2.5 truncates toward zero', t.lo, (-2 >>> 0));
  check('-2.5 high half', t.hi, 0xffffffff);
  check('ebp restored', t.ebp, 0x12345678);
  check('esp balanced', t.esp, STACK - 0x10);

  for (const v of [
    {mant:0x8000000000000400n,se:0x4034,want:9007199254740993n,status:0},
    {mant:0xa000000000000001n,se:0x4000,want:2n,status:0x20},
    {mant:0xa000000000000001n,se:0xc000,want:-2n,status:0x20},
  ]) {
    const n=convert(v,NATIVE_FTOL),s=convert(v,SPLIT_FTOL);
    for (const k of ['lo','hi','ebp','esp','cw','top','status']) check(`m80 ${v.se} ${k}`,n[k],s[k]);
    check('m80 literal integer',BigInt.asIntN(64,BigInt(n.lo)|(BigInt(n.hi)<<32n)),v.want);
    check('m80 literal status',n.status,v.status);
  }

  if (failures) { console.log(`FAIL ${failures} checks`); process.exit(1); }
  console.log(`PASS  static MSVC _ftol native path matches the interpreted body (${values.length} values)`);
}

main().catch(error => { console.error(error.stack || error); process.exit(1); });
