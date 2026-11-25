#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { REGIONS } = require('../lib/region-map.generated');
const le = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const gp = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];

// Small authored PE32; no application binary or retained run is required.
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

function cases() {
  const rows = [];
  const add = (w, pop, code, extra) => rows.push({ w, pop, code: [...(w === 16 ? [0x66] : []), ...code], ...extra });
  for (const w of [16, 32]) for (const pop of [false, true]) {
    for (const group of [false, true]) for (let reg = 0; reg < 8; reg++) {
      add(w, pop, group ? [pop ? 0x8f : 0xff, (pop ? 0xc0 : 0xf0) + reg] : [(pop ? 0x58 : 0x50) + reg], { reg });
    }
    const opcode = pop ? 0x8f : 0xff, group = pop ? 0 : 0x30;
    for (const fs of [false, true]) {
      add(w, pop, [...(fs ? [0x64] : []), opcode, group + 4, 0x24], { base: 4, disp: 0, fs });
      for (const disp of [-128, -4, -2, -1, 0, 1, 8, 127]) {
        add(w, pop, [...(fs ? [0x64] : []), opcode, group + 0x44, 0x24, disp & 255], { base: 4, disp, fs });
      }
      for (const disp of [-256, -1, 0, 128, 256]) {
        add(w, pop, [...(fs ? [0x64] : []), opcode, group + 0x84, 0x24, ...le(disp)], { base: 4, disp, fs });
      }
    }
    for (const index of [0, 1, 2, 3, 5, 6, 7]) for (let scale = 0; scale < 4; scale++) for (const disp of [-4, 8]) {
      add(w, pop, [opcode, group + 0x44, scale << 6 | index << 3 | 4, disp & 255], { base: 4, index, scale, disp });
    }
    for (const base of [0, 1, 2, 3, 5, 6, 7]) {
      add(w, pop, [opcode, group + 0x40 + base, 0xfc], { base, disp: -4 });
    }
    add(w, pop, [opcode, group + 5, ...le(0xd01000)], { absolute: 0xd01000 });
  }
  return rows;
}

async function main() {
  const module = await WebAssembly.compile(fs.readFileSync(process.argv[2] || path.join(__dirname, '../build/wine-assembly.wasm')));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true }), imports = {}, events = [];
  for (const i of WebAssembly.Module.imports(module)) {
    (imports[i.module] ||= {})[i.name] = i.kind === 'memory' ? memory : (...args) => { events.push([i.name, args]); return 0; };
  }
  const e = new WebAssembly.Instance(module, imports).exports, mem = new Uint8Array(memory.buffer);
  const g = address => e.guest_to_wasm(address >>> 0) >>> 0;
  const header = pe(); mem.set(header, e.get_staging()); assert(e.load_pe(header.length) >= 0);
  assert.equal(e.is_code16(), 0); e.set_uop(0); e.set_block_exec(0); e.set_fault_unmapped(2);
  assert(e.test_virtual_map_commit(0x30000000, 0x40000));
  const helperStack = 0x1308000, flagOut = 0xc07000;
  let setupPC = 0x1800000;
  const setups = new Map();
  function setup(code) {
    const key = code.join(',');
    if (!setups.has(key)) { setups.set(key, setupPC); mem.set([...code, 235, 0], g(setupPC)); setupPC += 64; }
    e.clear_yield(); e.set_eip(setups.get(key)); e.run(1);
  }
  function flags() {
    const saved = e.get_esp(); e.set_esp(helperStack); setup([0x9c, 0x8f, 5, ...le(flagOut)]); e.set_esp(saved);
    return new DataView(memory.buffer).getUint32(g(flagOut), true);
  }
  const hex = (p, n) => Buffer.from(mem.subarray(p, p + n)).toString('hex');
  const state = () => ({
    gp: gp.map(r => e['get_' + r]() >>> 0),
    lazy: [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift()],
    segments: Array.from({ length: 6 }, (_, i) => [e.win16_sreg(i), e.win16_seg_base_of(i)]), fs: e.get_fs_base(),
    fpu: [e.get_fpu_top(), e.get_fpu_tags(), e.get_fpu_sw(), hex(REGIONS.FPU_FILE.base, 128), hex(REGIONS.FPU_IMAGE_META.base, 32)],
  });
  e.set_esp(helperStack); setup([0xdb, 0xe3, 0xd9, 0xe8, 0xd9, 0xeb, 0xd9, 0xc9, 0xd8, 0xd1]);
  let count = 0;
  for (const [id, v] of cases().entries()) {
    const at = 0x2000000 + id * 32, code = [...v.code, 235, 0]; mem.set(code, g(at));
    for (const hot of [0, 1]) {
      // Direct low-word carry and sparse page crossing, with changed cached inputs.
      const stack = (id % 2 ? 0x30000ffe : 0x110fffe) + hot * 16, n = v.w / 8, fsBase = 0x10000;
      const regs = [0xa55ac33c, 0xb77b2211, 0xc33c4433, 0xd11d6655, stack, 0xe22e8877, 0xf44faa99, 0x9669ccbb]
        .map((x, i) => (x + (i === 4 ? 0 : hot * 0x01010101)) >>> 0);
      if (v.base !== undefined && v.base !== 4) regs[v.base] = 0xd01004 + hot * 16;
      if (v.index !== undefined) regs[v.index] = hot ? 5 : 3;
      const address = esp => ((v.absolute ?? ((v.base === 4 ? esp : regs[v.base]) +
        (v.index === undefined ? 0 : regs[v.index] * 2 ** v.scale) + v.disp)) + (v.fs ? fsBase : 0)) >>> 0;
      const oldEA = v.reg === undefined ? address(stack) : stack;
      const destination = v.reg === undefined ? address(stack + (v.pop ? n : 0)) : stack;
      const expected = new Map();
      // Guard stack, actual EA and old-EA decoy, plus contrary FS/SS locations.
      for (const p of [stack, oldEA, destination, stack + fsBase, 0xd01000]) {
        for (let j = -32; j < 40; j++) expected.set(p + j, (p + j * 37 + id * 3 + hot * 71) & 255);
      }
      const put = (p, value) => { for (let j = 0; j < n; j++) expected.set(p + j, Number(BigInt(value) >> BigInt(8 * j) & 255n)); };
      // A mapped loaded ESP also makes register controls safe to observe.
      put(stack, stack + 96);
      for (const [p, value] of expected) { assert(g(p) > 255); mem[g(p)] = value; }
      e.set_esp(helperStack);
      // Raw flags plus real ADD/SUB lazy producers, all three operand widths.
      const pw = [0, 8, 16, 32][id % 4], sub = id % 2;
      setup([0x68, ...le(0x202 | (hot ? 0x895 : 0x44)), 0x9d, ...(pw ? [0xb8, ...le(sub ? 0 : 2 ** pw - 1),
        ...(pw === 16 ? [0x66] : []), pw === 8 ? 0x80 : 0x81, sub ? 0xe8 : 0xc0,
        ...(pw === 8 ? [1] : pw === 16 ? [1, 0] : le(1))] : [])]);
      gp.forEach((r, i) => e['set_' + r](regs[i])); e.set_fs_base(fsBase);
      const beforeFlags = flags(); e.clear_yield(); e.set_eip(at);
      const before = state(), want = [...regs];
      const read = p => { let value = 0; for (let j = n - 1; j >= 0; j--) value = value * 256 + expected.get(p + j); return value; };
      if (v.pop) {
        const value = read(stack); want[4] = (stack + n) >>> 0;
        if (v.reg === undefined) put(destination, value);
        else want[v.reg] = n === 4 ? value : ((want[v.reg] & 0xffff0000) | value) >>> 0;
      } else {
        const value = v.reg === undefined ? read(oldEA) : regs[v.reg];
        want[4] = (stack - n) >>> 0; put(want[4], value);
      }
      const hits = e.get_page_hits(), stores = e.get_cache_stores(), eventCount = events.length;
      e.run(1);
      const after = state(), label = JSON.stringify({ id, hot, ...v });
      assert.deepEqual(after.gp, want, label);
      for (const key of ['lazy', 'segments', 'fs', 'fpu']) assert.deepEqual(after[key], before[key], key + label);
      for (const [p, value] of expected) assert.equal(mem[g(p)], value, 'memory ' + p.toString(16) + label);
      assert.equal(hex(g(at), code.length), Buffer.from(code).toString('hex'), label);
      assert.equal(e.get_eip() >>> 0, at + code.length, label);
      assert.equal(e.get_yield_reason(), 0, label); assert.equal(e.get_yield_flag(), 0, label);
      assert.equal(events.length, eventCount, label);
      assert.equal(e.get_page_hits() - hits, hot, label); assert.equal(e.get_cache_stores() - stores, 1 - hot, label);
      assert.equal(flags(), beforeFlags, label); count++;
    }
  }
  assert.equal(count, 864);
  console.log(`PASS POP post-increment destination/old stack source, PUSH/POP ESP controls: ${count} cold/cached rows`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
