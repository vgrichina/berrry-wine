#!/usr/bin/env node
// Partial-register writes (AL..BH, AX..DI) against a JS model, every register.
//
// The threaded handlers write a byte or word register as a 32-bit
// load-merge-store (set-reg8 / set-reg16 / set-al|ah|ax|cx|dx in
// src/03-registers.wat) instead of store8/store16. This pins that each form
// changes exactly the bits it names and nothing else: all eight GPRs are
// seeded with distinct patterns before every snippet, and every one of them
// is compared afterwards (ESP only where the form does not use the stack).
// Each snippet runs once from its own address, so it is the threaded tier.
//
// Run: node test/test-narrow-reg-writes.js

'use strict';
const fs = require('fs');
const path = require('path');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

const NAMES = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const SEED = [0xA1B2C3D4, 0x11223344, 0x55667788, 0x99AABBCC, 0, 0xDDEEFF01, 0x12345678, 0x9ABCDEF0];

async function main() {
  const ROOT = path.join(__dirname, '..');
  const WASM_PATH = process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');
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
  const g2w = a => RegionMap.g2w(a, imageBase);
  const le32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  const data = imageBase + 0x8000;   // operand bytes; code starts at +0xA000
  const stackTop = imageBase + 0xD00000;
  // Operand bytes the forms read: [data] = E7 C3 11 (xlat index 2 -> 0x11).
  mem.set([0xE7, 0xC3, 0x11, 0x00], g2w(data));

  let codeOffset = 0;
  function run(bytes) {
    const codeAddr = imageBase + 0xA000 + codeOffset;
    codeOffset += 64;
    const wa = g2w(codeAddr);
    mem.set(bytes, wa);
    mem[wa + bytes.length] = 0xC3;
    for (let r = 0; r < 8; r++) if (r !== 4) e[`set_${NAMES[r]}`](SEED[r]);
    e.set_esp(stackTop);
    dv.setUint32(g2w(stackTop), 0, true);
    e.set_eip(codeAddr);
    e.run(100000);
    if (e.get_eip() !== 0) throw new Error(`snippet at +0x${(codeOffset - 64).toString(16)} did not return`);
    return NAMES.map(n => e[`get_${n}`]() >>> 0);
  }

  // Model helpers over a seeded register file.
  const regs = () => SEED.map((v, i) => (i === 4 ? stackTop : v) >>> 0);
  const get8 = (R, r) => (R[r & 3] >>> ((r >> 2) * 8)) & 0xFF;
  const set8 = (R, r, v) => {
    const sh = (r >> 2) * 8;
    R[r & 3] = ((R[r & 3] & ~(0xFF << sh)) | ((v & 0xFF) << sh)) >>> 0;
  };
  const get16 = (R, r) => R[r] & 0xFFFF;
  const set16 = (R, r, v) => { R[r] = ((R[r] & 0xFFFF0000) | (v & 0xFFFF)) >>> 0; };

  let pass = 0, fail = 0;
  function check(name, bytes, model, { ignoreEsp = false } = {}) {
    const got = run(bytes);
    const want = regs();
    model(want);
    want[4] = (stackTop + 4) >>> 0;   // the closing RET pops the sentinel
    for (let r = 0; r < 8; r++) {
      if (r === 4 && ignoreEsp) continue;
      if (got[r] !== want[r]) {
        fail++;
        console.log(`  FAIL ${name}: ${NAMES[r]} got 0x${got[r].toString(16)} want 0x${want[r].toString(16)}`);
        return;
      }
    }
    pass++;
  }
  const B8 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
  const W16 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

  for (let r = 0; r < 8; r++) {
    check(`mov ${B8[r]},0x5a`, [0xB0 + r, 0x5A], R => set8(R, r, 0x5A));
    check(`add ${B8[r]},0x81`, [0x80, 0xC0 + r, 0x81], R => set8(R, r, get8(R, r) + 0x81));
    check(`inc ${B8[r]}`, [0xFE, 0xC0 + r], R => set8(R, r, get8(R, r) + 1));
    check(`dec ${B8[r]}`, [0xFE, 0xC8 + r], R => set8(R, r, get8(R, r) - 1));
    check(`not ${B8[r]}`, [0xF6, 0xD0 + r], R => set8(R, r, ~get8(R, r)));
    check(`neg ${B8[r]}`, [0xF6, 0xD8 + r], R => set8(R, r, -get8(R, r)));
    check(`shl ${B8[r]},1`, [0xD0, 0xE0 + r], R => set8(R, r, get8(R, r) << 1));
    // cmp eax,eax sets ZF; sete r8 writes 1
    check(`sete ${B8[r]}`, [0x39, 0xC0, 0x0F, 0x94, 0xC0 + r], R => set8(R, r, 1));
    check(`mov ${B8[r]},[mem]`, [0x8A, 0x05 | (r << 3), ...le32(data)], R => set8(R, r, 0xE7));
    check(`mul ${B8[r]}`, [0xF6, 0xE0 + r], R => set16(R, 0, get8(R, 0) * get8(R, r)));
    for (let s = 0; s < 8; s++) {
      check(`mov ${B8[r]},${B8[s]}`, [0x88, 0xC0 | (s << 3) | r], R => set8(R, r, get8(R, s)));
      check(`add ${B8[r]},${B8[s]}`, [0x00, 0xC0 | (s << 3) | r], R => set8(R, r, get8(R, r) + get8(R, s)));
      check(`xchg ${B8[r]},${B8[s]}`, [0x86, 0xC0 | (s << 3) | r], R => {
        const a = get8(R, r), b = get8(R, s); set8(R, r, b); set8(R, s, a);
      });
    }
  }
  for (let r = 0; r < 8; r++) {
    if (r === 4) continue;
    check(`mov ${W16[r]},0xbeef`, [0x66, 0xB8 + r, 0xEF, 0xBE], R => set16(R, r, 0xBEEF));
    check(`inc ${W16[r]}`, [0x66, 0x40 + r], R => set16(R, r, get16(R, r) + 1));
    check(`dec ${W16[r]}`, [0x66, 0x48 + r], R => set16(R, r, get16(R, r) - 1));
    check(`not ${W16[r]}`, [0x66, 0xF7, 0xD0 + r], R => set16(R, r, ~get16(R, r)));
    check(`shl ${W16[r]},1`, [0x66, 0xD1, 0xE0 + r], R => set16(R, r, get16(R, r) << 1));
    check(`mov ${W16[r]},[mem]`, [0x66, 0x8B, 0x05 | (r << 3), ...le32(data)], R => set16(R, r, 0xC3E7));
    check(`add ${W16[r]},[mem]`, [0x66, 0x03, 0x05 | (r << 3), ...le32(data)], R => set16(R, r, get16(R, r) + 0xC3E7));
    check(`xchg ax,${W16[r]}`, [0x66, 0x90 + r], R => { const a = get16(R, 0), b = get16(R, r); set16(R, 0, b); set16(R, r, a); });
    check(`pop ${W16[r]}`, [0x68, ...le32(0x7777CAFE), 0x66, 0x58 + r, 0x83, 0xC4, 0x02], R => set16(R, r, 0xCAFE));
    for (let s = 0; s < 8; s++) {
      check(`mov ${W16[r]},${W16[s]}`, [0x66, 0x89, 0xC0 | (s << 3) | r], R => set16(R, r, get16(R, s)));
      check(`sub ${W16[r]},${W16[s]}`, [0x66, 0x29, 0xC0 | (s << 3) | r], R => set16(R, r, get16(R, r) - get16(R, s)));
      check(`movzx ${W16[r]},${B8[s]}`, [0x66, 0x0F, 0xB6, 0xC0 | (r << 3) | s], R => set16(R, r, get8(R, s)));
      check(`movsx ${W16[r]},${B8[s]}`, [0x66, 0x0F, 0xBE, 0xC0 | (r << 3) | s], R => set16(R, r, (get8(R, s) << 24) >> 24));
    }
  }
  // Fixed-register forms.
  check('cbw', [0x66, 0x98], R => set16(R, 0, (get8(R, 0) << 24) >> 24));
  check('cwd', [0x66, 0x99], R => set16(R, 2, (get16(R, 0) & 0x8000) ? 0xFFFF : 0));
  // xor eax,eax leaves ZF=1 PF=1 CF=0 SF=0: AH = 0x46
  check('lahf', [0x31, 0xC0, 0x9F], R => { R[0] = 0; set8(R, 4, 0x46); });
  check('xlat', [0xBB, ...le32(data), 0xB0, 0x02, 0xD7], R => { R[3] = data >>> 0; set8(R, 0, 0x11); });
  check('div bl', [0xB8, ...le32(0xFFFF0107), 0xB3, 0x10, 0xF6, 0xF3],
    R => { R[0] = 0xFFFF0107; set8(R, 3, 0x10); set16(R, 0, ((0x107 % 0x10) << 8) | Math.floor(0x107 / 0x10)); });
  check('mul cx', [0xB8, ...le32(0x5555ABCD), 0xB9, ...le32(0x66660003), 0x66, 0xF7, 0xE1],
    R => { R[0] = 0x5555ABCD; R[1] = 0x66660003; const p = 0xABCD * 3; set16(R, 0, p); set16(R, 2, p >>> 16); });
  check('lodsb', [0xBE, ...le32(data), 0xFC, 0xAC], R => { R[6] = (data + 1) >>> 0; set8(R, 0, 0xE7); });
  check('fnstsw ax', [0xDB, 0xE3, 0xDF, 0xE0], R => set16(R, 0, 0));

  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main().catch(err => { console.error(err); process.exitCode = 1; });
