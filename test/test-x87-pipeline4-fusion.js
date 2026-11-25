#!/usr/bin/env node
'use strict';

// Differential oracle for the opt-in semantic x87 pipeline. Every case runs
// once through the ordinary H188/H190/H189 handlers and once through H449,
// then
// compares the stored result, the complete FNSAVE image, GPRs and lazy flags.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');
const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + `
  (func (export "test_sparse_map") (param $guest i32) (result i32)
    (call $virtual_map_commit (local.get $guest) (i32.const 4096)))
  (func (export "test_g2w") (param $guest i32) (result i32)
    (call $g2w (local.get $guest)))
` : source);
const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'notepad.exe'));

function le32(v) {
  return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
}

async function runArm(testCase, mode) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const host = createHostImports(ctx).host;
  Object.assign(host, { memory, exit() {}, log() {}, log_i32() {},
    crash_unimplemented() {}, wait_multiple: () => 0, shell_execute: () => 33 });
  const { instance } = await WebAssembly.instantiate(wasm, { host });
  ctx.exports = instance.exports;
  const e = instance.exports;
  const mem = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  mem.set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE must load');

  const imageBase = e.get_image_base() >>> 0;
  const g2w = ga => e.test_g2w(ga) >>> 0;
  const code = (imageBase + 0x30000) >>> 0;
  const data = (imageBase + 0x50000) >>> 0;
  const alignedOutput = (data + 0x100) >>> 0;
  const output = testCase.split ? 0x30001000 - testCase.split : alignedOutput;
  const state = (data + 0x200) >>> 0;
  const stack = (imageBase + 0xD00000) >>> 0;

  testCase.initialize(dv, g2w, data, alignedOutput);
  if (testCase.split) {
    for (const page of [0x30000000, 0x28000000, 0x30001000]) {
      assert.strictEqual(e.test_sparse_map(page) >>> 0, page);
    }
    assert.notStrictEqual(g2w(0x30000fff) + 1, g2w(0x30001000),
      'fixture must have noncontiguous backing');
    mem.fill(0xCC, g2w(0x28000000), g2w(0x28000000) + 4096);
    for (let i = -1; i <= testCase.outputBytes; i++) mem[g2w(output + i)] = 0xCC;
    for (let i = 0; i < testCase.outputBytes; i++) {
      mem[g2w(output + i)] = mem[g2w(alignedOutput + i)];
    }
  }
  mem.fill(0xA5, g2w(state), g2w(state) + 108);
  const body = testCase.code({ data, output });
  // FNSAVE [absolute state] makes even the payloads of now-empty physical x87
  // slots observable, then RETs through a zero sentinel.
  mem.set([...body, 0xDD, 0x35, ...le32(state), 0xC3], g2w(code));
  dv.setUint32(g2w(stack), 0, true);

  e.set_x87_pipeline4_fusion(mode >= 1 ? 1 : 0);
  e.set_x87_affine_fusion(mode >= 2 ? 1 : 0);
  e.reset_handler_hist();
  e.set_handler_hist_enabled(1);
  e.set_eax(0x12345678); e.set_ecx(0x24681357); e.set_edx(0x10203040);
  e.set_ebx(0x55667788); e.set_ebp(0x66778899);
  e.set_esi(data); e.set_edi(output); e.set_esp(stack); e.set_eip(code);
  e.run(100000);
  assert.strictEqual(e.get_eip() >>> 0, 0, `${testCase.name}: code must return`);
  if (testCase.split) {
    assert.strictEqual(mem[g2w(output - 1)], 0xCC, 'leading canary');
    assert.strictEqual(mem[g2w(output + testCase.outputBytes)], 0xCC, 'trailing canary');
    assert(mem.subarray(g2w(0x28000000), g2w(0x28000000) + 4096)
      .every(byte => byte === 0xCC), 'unrelated backing page must remain untouched');
  }

  const hist = new Uint32Array(memory.buffer, e.get_handler_hist_base(),
    e.get_handler_hist_slots());
  return {
    output: Array.from({ length: testCase.outputBytes }, (_, i) => mem[g2w(output + i)]),
    fsave: [...mem.slice(g2w(state), g2w(state) + 108)],
    registers: [e.get_eax(), e.get_ecx(), e.get_edx(), e.get_ebx(), e.get_esp(),
      e.get_ebp(), e.get_esi(), e.get_edi(), e.get_eip()],
    flags: [e.get_flag_res(), e.get_flag_op(), e.get_flag_a(), e.get_flag_b(),
      e.get_flag_sign_shift()],
    fusedRuns: hist[449] >>> 0,
    treeRuns: hist[450] >>> 0,
    islandRuns: hist[451] >>> 0,
    affinePrepareRuns: hist[452] >>> 0,
    affineFinishRuns: hist[453] >>> 0,
    matches: e.get_x87_pipeline4_matches() >>> 0,
    treeMatches: e.get_x87_tree4_matches() >>> 0,
  };
}

const cases = [
  {
    name: 'typed f32-to-f64 copy', outputBytes: 8, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat32(g2w(data), -13.625, true);
      dv.setBigUint64(g2w(output), 0xDEADBEEFCAFEBABEn, true);
    },
    code: () => [
      0xD9, 0x46, 0x00, // fld  dword [esi]
      0xDD, 0x5F, 0x00, // fstp qword [edi]
      0x40,             // prove the fused record resumes at the next op
    ],
  },
  {
    name: 'single mixed-width reverse divide', outputBytes: 4, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat64(g2w(data), 4.0, true);
      dv.setFloat32(g2w(data + 8), 18.0, true);
      dv.setUint32(g2w(output), 0xDEADBEEF, true);
    },
    code: () => [
      0xDD, 0x46, 0x00, // fld   qword [esi]
      0xD8, 0x7E, 0x08, // fdivr dword [esi+8]: 18 / 4
      0xD9, 0x5F, 0x00, // fstp  dword [edi]
      0x40,
    ],
  },
  {
    name: 'absolute-address unary negate', outputBytes: 8, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat32(g2w(data), 6.75, true);
      dv.setBigUint64(g2w(output), 0xDEADBEEFCAFEBABEn, true);
    },
    code: ({ data, output }) => [
      0xD9, 0x05, ...le32(data), // fld dword [absolute]
      0xD9, 0xE0,               // fchs
      0xDD, 0x1D, ...le32(output), // fstp qword [absolute]
      0x40,
    ],
  },
  {
    name: 'base-address unary absolute', outputBytes: 4, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat64(g2w(data), -22.125, true);
      dv.setUint32(g2w(output), 0xDEADBEEF, true);
    },
    code: () => [
      0xDD, 0x46, 0x00, // fld qword [esi]
      0xD9, 0xE1,       // fabs
      0xD9, 0x5F, 0x00, // fstp dword [edi]
      0x40,
    ],
  },
  {
    name: 'base f32 multiply-add', outputBytes: 4, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat32(g2w(data), 1.25, true);
      dv.setFloat32(g2w(data + 4), -3.5, true);
      dv.setFloat32(g2w(data + 8), 7.75, true);
      dv.setUint32(g2w(output), 0xDEADBEEF, true);
    },
    code: () => [
      0xD9, 0x46, 0x00, // fld  dword [esi]
      0xD8, 0x4E, 0x04, // fmul dword [esi+4]
      0xD8, 0x46, 0x08, // fadd dword [esi+8]
      0xD9, 0x5F, 0x00, // fstp dword [edi]
    ],
  },
  {
    name: 'mixed f64/f32 divide-subtract', outputBytes: 8, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat64(g2w(data), 91.0, true);
      dv.setFloat64(g2w(data + 8), 7.0, true);
      dv.setFloat32(g2w(data + 16), 2.5, true);
      dv.setBigUint64(g2w(output), 0xDEADBEEFCAFEBABEn, true);
    },
    code: () => [
      0xDD, 0x46, 0x00, // fld  qword [esi]
      0xDC, 0x76, 0x08, // fdiv qword [esi+8]
      0xD8, 0x66, 0x10, // fsub dword [esi+16]
      0xDD, 0x5F, 0x00, // fstp qword [edi]
    ],
  },
  {
    name: 'absolute-address reverse-divide-add', outputBytes: 4, handler: 449,
    initialize(dv, g2w, data, output) {
      dv.setFloat32(g2w(data), 4.0, true);
      dv.setFloat32(g2w(data + 4), 20.0, true);
      dv.setFloat32(g2w(data + 8), 1.5, true);
      dv.setUint32(g2w(output), 0xDEADBEEF, true);
    },
    code: ({ data, output }) => [
      0xD9, 0x05, ...le32(data),
      0xD8, 0x3D, ...le32(data + 4), // fdivr: rhs / ST0
      0xD8, 0x05, ...le32(data + 8),
      0xD9, 0x1D, ...le32(output),
    ],
  },
  {
    name: 'Alpha-shaped mixed-address add tree', outputBytes: 4, handler: 450,
    initialize(dv, g2w, data, output) {
      dv.setFloat32(g2w(data), 1.125, true);
      dv.setFloat32(g2w(data + 4), -9.5, true);
      dv.setUint32(g2w(output), 0xDEADBEEF, true);
    },
    code: ({ data, output }) => [
      0xD9, 0x46, 0x00,       // H190 fld dword [esi]
      0xD9, 0x05, ...le32(data + 4), // H188 fld dword [absolute]
      0xDE, 0xC1,             // H189 faddp st(1),st(0)
      0xD9, 0x1D, ...le32(output),   // H188 fstp dword [absolute]
    ],
  },
  {
    name: 'base f64 divide tree', outputBytes: 8, handler: 450,
    initialize(dv, g2w, data, output) {
      dv.setFloat64(g2w(data), 84.0, true);
      dv.setFloat64(g2w(data + 8), 7.0, true);
      dv.setBigUint64(g2w(output), 0xDEADBEEFCAFEBABEn, true);
    },
    code: () => [
      0xDD, 0x46, 0x00,
      0xDD, 0x46, 0x08,
      0xDE, 0xF9,             // fdivp st(1),st(0): 84 / 7
      0xDD, 0x5F, 0x00,
    ],
  },
  {
    name: 'Alpha affine x87 islands', outputBytes: 16, handler: 451,
    expectedRuns: 3, semantic: true,
    initialize(dv, g2w, data, output) {
      dv.setInt32(g2w(data), 13, true);
      dv.setInt32(g2w(data + 4), -5, true);
      dv.setFloat32(g2w(data + 8), 0.625, true);
      dv.setFloat32(g2w(data + 12), -1.75, true);
      dv.setFloat32(g2w(data + 16), 2.25, true);
      dv.setFloat32(g2w(data + 20), 17.5, true);
      dv.setBigUint64(g2w(output), 0xDEADBEEFCAFEBABEn, true);
      dv.setBigUint64(g2w(output + 8), 0x0123456789ABCDEFn, true);
    },
    code: ({ data, output }) => [
      0xDB, 0x46, 0x00,             // fild dword [esi]
      0xDB, 0x46, 0x04,             // fild dword [esi+4]
      0xD9, 0xC0,                   // fld st(0)
      0xD8, 0x0D, ...le32(data + 8),
      0xD9, 0xCA,                   // fxch st(2)
      0xDC, 0xC1,                   // fadd st(1),st(0)
      0xD8, 0x0D, ...le32(data + 12),
      0xD9, 0xC9,                   // fxch st(1)
      0xD8, 0x0D, ...le32(data + 16),
      0x40,                         // inc eax: observable integer island boundary
      0xDC, 0xC1,
      0xDE, 0xEA,                   // fsubp st(2),st(0)
      0xD8, 0x05, ...le32(data + 20),
      0xD9, 0xC9,
      0xD8, 0x05, ...le32(data + 20),
      0x40,                         // prove H452 resumes at the following op
      0xDD, 0x1D, ...le32(output),
      0xDD, 0x1D, ...le32(output + 8),
    ],
  },
  {
    name: 'intervening integer op declines', outputBytes: 4, decline: true,
    expectedIslandRuns: 1,
    initialize(dv, g2w, data, output) {
      dv.setFloat32(g2w(data), 2.0, true);
      dv.setFloat32(g2w(data + 4), 3.0, true);
      dv.setFloat32(g2w(data + 8), 4.0, true);
      dv.setUint32(g2w(output), 0, true);
    },
    code: () => [
      0xD9, 0x46, 0x00,
      0xD8, 0x4E, 0x04,
      0x90,             // no semantic region may cross this op yet
      0xD8, 0x46, 0x08,
      0xD9, 0x5F, 0x00,
    ],
  },
];

(async () => {
  // Both fused store handlers, both output widths, every crossing position.
  for (const original of [cases[0], cases[1], cases[7], cases[8]]) {
    for (let split = 1; split < original.outputBytes; split++) {
      cases.push({ ...original, split, name: `${original.name}, sparse split ${split}` });
    }
  }
  for (const testCase of cases) {
    const scalar = await runArm(testCase, false);
    const fused = await runArm(testCase, true);
    const semantic = testCase.semantic ? await runArm(testCase, 2) : null;
    assert.deepStrictEqual(fused.output, scalar.output, `${testCase.name}: result differs`);
    assert.deepStrictEqual(fused.fsave, scalar.fsave, `${testCase.name}: FNSAVE state differs`);
    assert.deepStrictEqual(fused.registers, scalar.registers, `${testCase.name}: GPRs differ`);
    assert.deepStrictEqual(fused.flags, scalar.flags, `${testCase.name}: lazy flags differ`);
    assert.strictEqual(scalar.fusedRuns, 0, `${testCase.name}: disabled arm fused`);
    assert.strictEqual(scalar.treeRuns, 0, `${testCase.name}: disabled arm tree-fused`);
    assert.strictEqual(scalar.islandRuns, 0, `${testCase.name}: disabled arm island-fused`);
    assert.strictEqual(scalar.affinePrepareRuns, 0, `${testCase.name}: disabled arm compiled prefix`);
    assert.strictEqual(scalar.affineFinishRuns, 0, `${testCase.name}: disabled arm compiled suffix`);
    // Folding is deliberately declined until intermediate physical images are coherent.
    for (const key of ['fusedRuns','treeRuns','islandRuns','matches','treeMatches']) {
      assert.strictEqual(fused[key], 0, testCase.name+': fallback must decline '+key);
    }
    if (semantic) {
      assert.deepStrictEqual(semantic.output, scalar.output,
        `${testCase.name}: semantic result differs`);
      assert.deepStrictEqual(semantic.fsave, scalar.fsave,
        `${testCase.name}: semantic FNSAVE state differs`);
      assert.deepStrictEqual(semantic.registers, scalar.registers,
        `${testCase.name}: semantic GPRs differ`);
      assert.deepStrictEqual(semantic.flags, scalar.flags,
        `${testCase.name}: semantic lazy flags differ`);
      assert.strictEqual(semantic.affinePrepareRuns, 0,
        `${testCase.name}: semantic prefix did not execute once`);
      assert.strictEqual(semantic.affineFinishRuns, 0,
        `${testCase.name}: semantic suffix did not execute once`);
      assert.strictEqual(semantic.islandRuns, 0,
        `${testCase.name}: only the final store/save island should remain`);
    }
  }
  console.log(`x87 pipeline4 fusion: PASS (${cases.length} differential cases)`);
})().catch(error => { console.error(error); process.exit(1); });
