#!/usr/bin/env node
'use strict';

// tools/vb-pcode.js against real VB1 p-code. The expected stream is what
// VBRUN100 itself executed: a dump-mem of TicTacDrop's live p-code segment
// (ES:SI at a --break on handler 2:0x2824) holds these same words, and the
// file copy sits at TICTACDP.EXE offset 0xf8bf. Each opcode word is a handler
// offset in VBRUN100 segment 2; the operand counts come from walking each
// handler to its `es: lodsw; jmp ax` dispatch.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadInterpreter, analyzeHandler, decode, describe } = require('../tools/vb-pcode');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'test', 'binaries', 'wep16', 'WEP4');
const VBRUN = path.join(DIR, 'VBRUN100.DLL');
const EXE = path.join(DIR, 'TICTACDP.EXE');
if (!fs.existsSync(VBRUN) || !fs.existsSync(EXE)) {
  console.log('SKIP  VBRUN100.DLL / TICTACDP.EXE not present');
  process.exit(0);
}

const interp = loadInterpreter(VBRUN);
const kind = (op) => describe(analyzeHandler(interp, op));

// Straight-line handlers: operand bytes before the dispatch.
assert.deepStrictEqual(kind(0x2824).ops, [2], '2824 takes one word');
assert.deepStrictEqual(kind(0x2bfb).ops, [0], '2bfb takes none');
assert.deepStrictEqual(kind(0x23ab).ops, [2], '23ab takes one word');
// 16c9 reads a word, then loads SI from [si]: a p-code jump over two words.
assert.deepStrictEqual(kind(0x16c9).ops, [4], '16c9 consumes its word and the target word');
assert(kind(0x16c9).flags.includes('jump'), '16c9 moves the p-code pointer');
// 3935 calls a helper that skips one word and reads one (inc si; inc si; lodsw).
assert.strictEqual(Math.max(...kind(0x3935).ops), 4, '3935 takes two words');
// 4938 leaves the procedure (far return) without a dispatch.
assert(kind(0x4938).flags.includes('exit'), '4938 exits');

const buf = fs.readFileSync(EXE);
const rows = decode(interp, buf, 0xf8bf, 16);
const got = rows.map(r => [r.op, ...(r.operands || [])]);
const want = [
  [0x2824, 0x023a], [0x2bfb], [0x2c03], [0x16c9, 0xffdc, 0x09d2], [0x363b],
  [0x23ab, 0x00d2], [0x142b], [0x2498, 0x023a], [0x37dd, 0x00b2],
  [0x3935, 0x0001, 0x0734], [0x38de, 0x0749], [0x364b], [0x2824, 0x023a],
  [0x179d, 0xffdc, 0x09ae], [0x364b], [0x23ab, 0x00f4],
];
assert.deepStrictEqual(got, want, 'decoded stream matches what VBRUN100 executed');

// TicTacDrop's Demo menu handler, captured live (--trace-at-mem=es:esi-0x62:256
// at handler 2:0x2c92; p-code segment 0x4ef at linear 0xac0000, bytes from
// 0x102). Its recorded dispatch addresses are the ground truth below; 2c92
// carries the status-bar string inline and the decoder must step over it.
const DEMO = Buffer.from(
  'b200d237f2058d39f8ff7d2b023801002600832b3b363b363b36ab23d20002259a013b362c239201fe13dd37b200d237' +
  '07095f38fc081b15902e6c294601793d0000020651363b363b36822c0000ff008514dd37b200d2374e05de38ab0a3b36' +
  '922c2600ce012200546f2073746f70207468652044656d6f2c2068697420746865205350414345424152cc15dd37b200' +
  'd2374e05de38f8023b36', 'hex');
const demo = decode(interp, DEMO, 0x104 - 0x102, 40);
const at = (off) => demo.find(r => r.off + 0x102 === off);
const dispatched = [0x104, 0x108, 0x10c, 0x10e, 0x114, 0x116, 0x118, 0x11a, 0x11c, 0x120, 0x124, 0x126,
  0x12a, 0x12c, 0x130, 0x134, 0x138, 0x13a, 0x13c, 0x146, 0x148, 0x14a, 0x14c, 0x152, 0x154, 0x158,
  0x15c, 0x160, 0x162, 0x18c, 0x18e, 0x192, 0x196];
for (const off of dispatched) assert(at(off), `an instruction starts at 0x${off.toString(16)}, as VBRUN dispatched it`);
assert.strictEqual(at(0x162).op, 0x2c92);
assert.strictEqual(at(0x162).text, 'To stop the Demo, hit the SPACEBAR', 'inline string literal');
assert.deepStrictEqual(at(0x13c).operands, [0x0146, 0x3d79, 0x0000, 0x0602], '296c takes 8 operand bytes');
console.log('PASS  vb-pcode: handler operand lengths and a TicTacDrop p-code stream decode as VBRUN100 runs them');
