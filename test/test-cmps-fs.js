#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { REGIONS } = require('../lib/region-map.generated');

// Authored PE32 header: no installed application or external fixture needed.
function pe() {
  const b = Buffer.alloc(1024), p = 128, o = p + 24, s = o + 224;
  b.writeUInt16LE(0x5a4d); b.writeUInt32LE(p, 60); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6);
  b.writeUInt16LE(224, p + 20); b.writeUInt16LE(0x102, p + 22);
  b.writeUInt16LE(0x10b, o);
  for (const [k, v] of [[16, 4096], [28, 0x400000], [32, 4096], [36, 512],
    [56, 8192], [60, 512], [72, 0x100000], [76, 4096], [92, 16]]) b.writeUInt32LE(v, o + k);
  b.write('.text', s);
  for (const [k, v] of [[8, 4096], [12, 4096], [16, 512], [20, 512], [36, 0xe0000020]]) b.writeUInt32LE(v, s + k);
  b[512] = 0xc3;
  return b;
}

// Intel CMPS: source minus ES destination; REP tests the new comparison ZF.
// Compute flags separately from the interpreter's lazy flag representation.
function subFlags(width, x, y) {
  const modulus = 1n << BigInt(width), sign = modulus / 2n;
  const a = BigInt(x), b = BigInt(y), r = (a - b + modulus) % modulus;
  const signed = n => n >= sign ? n - modulus : n;
  const difference = signed(a) - signed(b);
  let parity = 0;
  for (let bit = 0n; bit < 8n; bit++) parity ^= Number(r >> bit & 1n);
  return Number(a < b) | (parity ? 0 : 4) | (a % 16n < b % 16n ? 16 : 0) |
    (r === 0n ? 64 : 0) | (r >= sign ? 128 : 0) |
    (difference < -sign || difference >= sign ? 2048 : 0);
}

async function main() {
  const bytes = fs.readFileSync(process.argv[2] || path.join(__dirname, '../build/wine-assembly.wasm'));
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {}, events = [];
  for (const i of WebAssembly.Module.imports(module)) {
    (imports[i.module] ||= {})[i.name] = i.kind === 'memory' ? memory : (...args) => {
      events.push([i.module, i.name, args]); return 0;
    };
  }
  const e = new WebAssembly.Instance(module, imports).exports;
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const g = address => e.guest_to_wasm(address >>> 0) >>> 0;
  const header = pe(); mem.set(header, e.get_staging()); assert(e.load_pe(header.length) >= 0);
  e.set_uop(0); e.set_block_exec(0); e.set_fault_unmapped(2);
  const le = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
  const gp = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
  const stack = 0x1108000, flagOut = 0xc07000, fsBase = 0x100000;
  const source = 0xd01020, destination = 0xe01020;
  const hex = (p, n) => Buffer.from(mem.subarray(p, p + n)).toString('hex');
  const lazy = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift()];
  let setupPC = 0x1800000;
  const setups = new Map();
  function setup(code) {
    const key = code.join(',');
    if (!setups.has(key)) { setups.set(key, setupPC); mem.set([...code, 235, 0], g(setupPC)); setupPC += 64; }
    e.clear_yield(); e.set_eip(setups.get(key)); e.run(1);
  }
  const flags = () => { setup([0x9c, 0x8f, 5, ...le(flagOut)]); return dv.getUint32(g(flagOut), true); };
  e.set_esp(stack);
  setup([0xdb, 0xe3, 0xd9, 0xe8, 0xd9, 0xeb, 0xd9, 0xc9, 0xd8, 0xd1]);
  const state = () => ({
    gp: gp.map(r => e['get_' + r]() >>> 0), lazy: lazy(), fs: e.get_fs_base(),
    segments: Array.from({ length: 6 }, (_, i) => [e.win16_sreg(i), e.win16_seg_base_of(i)]),
    fpu: [e.get_fpu_top(), e.get_fpu_tags(), e.get_fpu_sw(),
      hex(REGIONS.FPU_FILE.base, 128), hex(REGIONS.FPU_IMAGE_META.base, 32)],
    stack: hex(g(stack - 64), 128),
    data: [source - fsBase, source, source + fsBase, destination, destination + fsBase]
      .map(p => hex(g(p - 32), 96)),
  });
  let cases = 0, pc = 0x2000000;
  for (const width of [8, 16, 32]) for (const fs of [false, true]) for (const rep of [0, 1, 2]) {
    for (const stop of rep ? [0, 1, 3, 4, 6] : [1]) {
      const at = pc; pc += 32;
      const code = [...(fs ? [0x64] : []), ...(rep ? [rep === 1 ? 0xf3 : 0xf2] : []),
        ...(width === 16 ? [0x66] : []), width === 8 ? 0xa6 : 0xa7, 235, 0];
      mem.set(code, g(at));
      // Decode once, then change data/count/DF and execute at the same address.
      // The hot last-element case is disjoint, DF minus, count=4, stop=4.
      for (const hot of [0, 1]) {
        const count = rep ? stop === 0 ? 0 : 5 - hot : hot ? 0 : 0xface0005;
        const step = (hot ? -1 : 1) * width / 8, esi = source - (fs ? fsBase : 0);
        for (const p of [source - fsBase, source, source + fsBase, destination, destination + fsBase]) mem.fill(0x6c, g(p - 32), g(p + 64));
        const put = (p, n) => { for (let j = 0; j < width / 8; j++) mem[g(p + j)] = Math.floor(n / 2 ** (8 * j)) & 255; };
        const pairs = [];
        for (let i = 0; i < 5; i++) {
          const x = ([0, 2 ** (width - 1), 15, 2 ** width - 1, 85][i] + hot * 7) % 2 ** width;
          const equal = rep === 1 ? i !== stop - 1 : rep === 2 ? i === stop - 1 : false;
          const y = equal ? x : (x + 1) % 2 ** width;
          pairs.push([x, y]);
          // Both unused source addresses and FS:EDI contain contrary decoys.
          put(source - fsBase + i * step, (x + 37) % 2 ** width);
          put(source + fsBase + i * step, (x + 53) % 2 ** width);
          put(source + i * step, x);
          put(destination + i * step, y);
          put(destination + fsBase + i * step, (y + 71) % 2 ** width);
        }
        // Incoming ZF opposes repeat mode; it must not suppress comparison 1.
        const seed = 0x202 | 0x895 | (rep === 2 ? 64 : 0);
        e.set_esp(stack); setup([0x68, ...le(seed), 0x9d, hot ? 0xfd : 0xfc]);
        const regs = [0xa55ac355, count, 0xc33c4433, 0xd11d6655, stack, 0xe22e8877, esi, destination];
        gp.forEach((r, i) => e['set_' + r](regs[i])); e.set_fs_base(fsBase);
        mem.fill(0xa5, g(stack - 64), g(stack + 64));
        const beforeFlags = flags(); e.clear_yield(); e.set_eip(at);
        const before = state(), hits = e.get_page_hits(), stores = e.get_cache_stores(), eventCount = events.length;
        let used = 0, wantFlags = beforeFlags;
        for (let i = 0; i < (rep ? count : 1); i++) {
          const [x, y] = pairs[i]; used++;
          wantFlags = ((beforeFlags & ~0x8d5) | subFlags(width, x, y)) >>> 0;
          if (rep && ((rep === 1) !== (x === y))) break;
        }
        e.run(1);
        const after = state(), eip = e.get_eip() >>> 0, want = [...before.gp];
        if (rep) want[1] -= used;
        want[6] = (want[6] + step * used) >>> 0; want[7] = (want[7] + step * used) >>> 0;
        const label = JSON.stringify({ width, fs, rep, stop, hot });
        assert.deepEqual(after.gp, want, label);
        for (const key of ['fs', 'segments', 'fpu', 'stack', 'data']) assert.deepEqual(after[key], before[key], key + label);
        if (!used) assert.deepEqual(after.lazy, before.lazy, 'zero count preserves lazy flags' + label);
        assert.equal(eip, at + code.length, label);
        assert.equal(e.get_yield_reason(), 0, label); assert.equal(e.get_yield_flag(), 0, label);
        assert.equal(events.length, eventCount, label);
        assert.equal(e.get_page_hits() - hits, hot, label);
        assert.equal(e.get_cache_stores() - stores, 1 - hot, label);
        assert.equal(flags(), wantFlags, label);
        cases++;
      }
    }
  }
  assert.equal(cases, 132);
  console.log(`PASS CMPS FS source/standard decoys, ES destination, all widths and repeat modes: ${cases} cold/cached rows`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
