#!/usr/bin/env node
// tl;dr: split an existing gameplay hist.json (threaded block entries) by the
// GML interpreter's own functions, as named in this run's RE.
//   hist.json blocks [eip, entries] -> insns to first control transfer
//   -> weight = entries x insns -> table by GML function, plus top blocks.
// Same weighting as the 20261126 delphi-fold-init-move attribute.js.
//   node blocks.js HIST.json EXE [--top=N] [--hle=VA,...]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const { disasmAt } = require(path.join(ROOT, 'tools', 'disasm'));
const { readPE } = require(path.join(ROOT, 'lib', 'pe.js'));
const [histFile, exe] = process.argv.slice(2);
const TOP = parseInt((process.argv.find(a => a.startsWith('--top=')) || '--top=40').slice(6), 10);
// --hle=VA,...: Delphi-fold HLE block entries, weighed as one instruction (as attribute.js)
const HLE = new Set((process.argv.find(a => a.startsWith("--hle=")) || "--hle=").slice(6).split(",").filter(Boolean).map(s => parseInt(s, 16)));
const FN = [
  [0x4a8800, 0x4a8a30, 'var list: other (set 0x4a88d4 ...)'],
  [0x4a8a4c, 0x4a8a61, 'var list lookup: backward scan loop 0x4a8a4c..0x4a8a5f'],
  [0x4a8a30, 0x4a8b10, 'var list lookup 0x4a8a30: entry + copy-out'],
  [0x4a8b10, 0x4a8e00, 'var list: add/set/remove'],
  [0x525a70, 0x525af8, 'var decl 0x525a70'],
  [0x525af8, 0x525b44, 'global get/set wrappers 0x525b24/0x525b34'],
  [0x525b44, 0x525de8, 'builtin-var registry'],
  [0x525de8, 0x525e20, 'instance var get 0x525de8'],
  [0x525e20, 0x525e74, 'instance var set 0x525e20'],
  [0x525e74, 0x526384, 'owner var get/set (all / object / id)'],
  [0x526384, 0x52649c, 'var name'],
  [0x52649c, 0x5265a4, 'unary op 0x52649c'],
  [0x5265a4, 0x526fc0, 'binary op 0x5265a4'],
  [0x526fc0, 0x527280, 'call node 0x526fc0'],
  [0x527280, 0x527530, 'var owner/index eval 0x527280'],
  [0x527530, 0x52777c, 'var read node 0x527530'],
  [0x52777c, 0x5277c0, 'unary node 0x52777c'],
  [0x5277c0, 0x52786c, 'binary node 0x5277c0'],
  [0x52786c, 0x527920, 'eval dispatch 0x52786c'],
  [0x527920, 0x527e24, 'assignment 0x527920'],
  [0x527e24, 0x528358, 'repeat/if/while/do/for'],
  [0x528358, 0x5286b4, 'with 0x528358'],
  [0x5286b4, 0x5288ac, 'switch/block/var'],
  [0x5288ac, 0x528ae8, 'statement dispatch 0x5288ac'],
  [0x528ae8, 0x5290fc, 'code exec 0x528b3c'],
  [0x5290fc, 0x529400, 'extension call 0x5290fc'],
  [0x529400, 0x52a000, 'interp other'],
  [0x51d000, 0x51e000, 'script call 0x51da48 page'],
  [0x406400, 0x406900, 'RTL: record init/finalize/copy (0x4064xx-0x4068xx)'],
  [0x405900, 0x405a00, 'RTL: LStr clr/asg'],
  [0x4aceec, 0x4ad1a0, 'GM: bbox-vs-rect test 0x4aceec'],
  [0x4e3ed0, 0x4e4200, 'GM: collision scan 0x4e3ed0'],
  [0x4ad5e8, 0x4ad5fc, 'GM: nth instance 0x4ad5e8'],
  [0x4aee7c, 0x4aef40, 'GM: object instance table 0x4aee7c..'],
];
const name = eip => (FN.find(([a, b]) => eip >= a && eip < b) || [0, 0, eip < 0x590000 ? `exe other page 0x${(eip >>> 12).toString(16)}000` : "DLLs"])[2];
const hist = JSON.parse(fs.readFileSync(histFile, 'utf8'));
const pe = readPE(exe);
const END = /^(j[a-z]+|call|ret|retn|jmp|loop[a-z]*|int3?|iret[a-z]*)\b/;
let total = 0, inGml = 0;
const byFn = new Map(), blocks = [];
for (const [eipHex, n] of hist.blocks) {
  const eip = parseInt(eipHex, 16);
  const off = pe.va2off(eip);
  let len = 1;
  if (off >= 0 && !HLE.has(eip)) {
    len = 0;
    for (const line of disasmAt(pe.buf, off, eip, 64)) {
      const m = /^[0-9a-f]{8}\s+((?:[0-9a-f]{2} )+)\s*(.*)$/.exec(line.trim());
      if (!m) break;
      len++;
      if (END.test(m[2].trim())) break;
    }
    len = Math.max(1, len);
  }
  const w = n * len;
  total += w;
  const k = name(eip);
  if (!k) continue;
  inGml += w;
  byFn.set(k, (byFn.get(k) || 0) + w);
  blocks.push([eip, n, len, w, k]);
}
const pct = (a, b) => (100 * a / b).toFixed(2).padStart(6);
console.log(`threaded weighted insns ${total}; (handler ops ${hist.handlerOps || "?"}); listed ${pct(inGml, total)}%`);
for (const [k, w] of [...byFn].sort((a, b) => b[1] - a[1])) console.log(`  ${pct(w, total)}%  ${k}`);
console.log(`\ntop blocks`);
for (const [eip, n, len, w, k] of blocks.sort((a, b) => b[3] - a[3]).slice(0, TOP)) {
  console.log(`  ${pct(w, total)}%  0x${eip.toString(16)}  entries ${n} x ${len}  ${k}`);
}
