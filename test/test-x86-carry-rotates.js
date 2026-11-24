#!/usr/bin/env node
// Complete production module and x86 decoder regression. Run after tools/build.sh.
// Checks result, defined flags, all GPRs and neighboring memory, including cached CL.
// AF is seeded clear: the existing POPFD implementation does not install AF=1.
'use strict';
// Independent bit-ring oracle: carry is bit W in a W+1-bit integer.
const fs = require('fs');
const crypto = require('crypto');
const root = require('path').resolve(__dirname, '..');
function expected(bits, right, value, count, flags) {
  const n = BigInt(bits + 1), mask = (1n << n) - 1n;
  const operandMask = (1n << BigInt(bits)) - 1n;
  const masked = count & 31;
  const c = BigInt(masked % (bits + 1));
  let ring = (BigInt(flags & 1) << BigInt(bits)) | (BigInt(value >>> 0) & operandMask);
  if (c) ring = right ? ((ring >> c) | (ring << (n - c))) & mask
    : ((ring << c) | (ring >> (n - c))) & mask;
  const result = Number(ring & operandMask);
  const cf = Number(ring >> BigInt(bits));
  const of = right ? Number(((ring >> BigInt(bits - 1)) ^ (ring >> BigInt(bits - 2))) & 1n)
    : Number((ring >> BigInt(bits - 1)) & 1n) ^ cf;
  // OF is defined only when the masked count is one. Zero effective count
  // preserves the entire flags word; SZAP and all other bits are unaffected.
  const flagMask = c === 0n ? 0xffffffff : masked === 1 ? 0xffffffff : 0xfffff7ff;
  const resultFlags = c === 0n ? flags : (flags & ~0x801) | cf | (of << 11);
  return { result, expectedFlags: resultFlags >>> 0, flagMask: flagMask >>> 0 };
}
const cases = [];
for (const bits of [8, 16, 32]) for (const right of [false, true])
for (const form of (bits === 8 ? ['reg', 'high', 'abs', 'base', 'sib'] : ['reg', 'abs', 'base', 'sib']))
for (const mode of ['imm', 'cl', 'one'])
for (const count of (mode === 'one' ? [1] : [...new Set([0, 1, bits, bits + 1, 31, 32, 33, 255])]))
for (const value of [0, 1, 0x80000081, 0xffffffff, 0x87654321])
for (const flagBase of [0x202, 0xa86, 0x246]) for (const cf of [0, 1]) {
  const flags = flagBase | cf;
  cases.push({ bits, right, form, mode, count, value, flags, ...expected(bits, right, value, count, flags) });
}
async function main() {
  const wasmPath = process.env.WINE_ASSEMBLY_WASM || `${root}/build/wine-assembly.wasm`;
  const bytes = fs.readFileSync(wasmPath);
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    const ns = imports[imp.module] ||= {};
    if (imp.kind === 'memory') ns[imp.name] = memory;
    else if (imp.kind === 'function') ns[imp.name] = () => 0;
    else throw new Error(`Unexpected import ${imp.kind}`);
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const pe = fs.readFileSync(`${root}/test/binaries/notepad.exe`);
  mem.set(pe, e.get_staging()); e.load_pe(pe.length);
  const image = e.get_image_base();
  const g2w = a => require(`${root}/lib/region-map.generated.js`).g2w(a, image);
  const data = image + 0x800000, before = data + 0x100, after = before + 4;
  const stack = image + 0xd00000;
  const le32 = x => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255, x >>> 24];
  const names = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
  const frozen = cases;
  const codeCache = new Map(), failures = [], categories = {};
  let checked = 0;
  for (const t of frozen) {
    const { bits, right, form, mode, count, value, flags } = t;
    const group = right ? 3 : 2;
    let operand = form === 'reg' ? [0xc0 | (group << 3)]
      : form === 'high' ? [0xc4 | (group << 3)]
      : form === 'abs' ? [0x05 | (group << 3), ...le32(data)]
      : form === 'base' ? [0x43 | (group << 3), 0x10]
      : [0x44 | (group << 3), 0xb3, 0x10]; // [ebx+esi*4+16]
    const opcode = mode === 'imm' ? (bits === 8 ? 0xc0 : 0xc1)
      : mode === 'cl' ? (bits === 8 ? 0xd2 : 0xd3) : (bits === 8 ? 0xd0 : 0xd1);
    const instruction = [...(bits === 16 ? [0x66] : []), opcode, ...operand, ...(mode === 'imm' ? [count] : [])];
    // Seed flags, capture what POPFD actually installed, rotate, capture flags.
    const code = [0x68, ...le32(flags), 0x9d, 0x9c, 0x8f, 0x05, ...le32(before),
      ...instruction, 0x9c, 0x8f, 0x05, ...le32(after), 0xc3];
    const key = code.join(',');
    let address = codeCache.get(key);
    if (!address) {
      address = image + 0x100000 + codeCache.size * 128;
      mem.set(code, g2w(address)); codeCache.set(key, address);
    }
    const regs = [0xa55ac33c, 0x12340000 | (mode === 'cl' ? count : 4), 0xaced1122,
      data - 0x10 - (form === 'sib' ? 12 : 0), stack, 0xbadf00d, 3, 0x12345678];
    if (form === 'reg' || form === 'high') {
      const mask = bits === 32 ? 0xffffffff : (1 << bits) - 1;
      const shift = form === 'high' ? 8 : 0;
      regs[0] = ((regs[0] & ~(mask << shift)) | ((value & mask) << shift)) >>> 0;
    }
    for (let i = 0; i < 8; i++) e[`set_${names[i]}`](regs[i]);
    mem.fill(0x5a, g2w(data - 8), g2w(data + 12));
    for (let i = 0; i < bits / 8; i++) mem[g2w(data + i)] = (value >>> (8 * i)) & 255;
    const memoryBefore = mem.slice(g2w(data - 8), g2w(data + 12));
    dv.setUint32(g2w(stack), 0, true);
    e.set_eip(address); e.run(10000);
    const issues = [];
    const observedBefore = dv.getUint32(g2w(before), true), observedAfter = dv.getUint32(g2w(after), true);
    if (observedBefore !== flags) issues.push('fixture-flags');
    if (((observedAfter ^ t.expectedFlags) & t.flagMask) !== 0) issues.push('flags');
    const register = form === 'reg' || form === 'high';
    const expectRegs = regs.slice(); expectRegs[4] = stack + 4;
    if (register) {
      const shift = form === 'high' ? 8 : 0, mask = bits === 32 ? 0xffffffff : (1 << bits) - 1;
      expectRegs[0] = ((regs[0] & ~(mask << shift)) | (t.result << shift)) >>> 0;
    } else for (let i = 0; i < bits / 8; i++) memoryBefore[8 + i] = (t.result >>> (8 * i)) & 255;
    for (let i = 0; i < 8; i++) if ((e[`get_${names[i]}`]() >>> 0) !== (expectRegs[i] >>> 0)) issues.push(`register-${names[i]}`);
    if (!Buffer.from(mem.slice(g2w(data - 8), g2w(data + 12))).equals(Buffer.from(memoryBefore))) issues.push('memory');
    if (e.get_eip() !== 0) issues.push('return');
    checked++;
    if (issues.length) {
      for (const issue of issues) categories[issue] = (categories[issue] || 0) + 1;
      failures.push({ ...t, observedBefore, observedAfter, issues, eax: e.get_eax() >>> 0 });
    }
  }
  const result = { checked, passed: checked - failures.length, failed: failures.length, categories,
    moduleSha256: crypto.createHash('sha256').update(bytes).digest('hex'), failures };
  const out = process.env.PROBE_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, failures: failures.slice(0, 6) }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}
main().catch(err => { console.error(err); process.exitCode = 1; });

