#!/usr/bin/env node
'use strict';
// Name the GL bridge opcodes in a census.
//
//   node tools/gl-opcode-names.js 55 12 0
//   echo '{"55":3,"12":900}' | node tools/gl-opcode-names.js --json
//
// The guest's OpenGL calls arrive at lib/gl-compat.js as integer opcodes, and
// a census taken in the page (or in a worker's RPC log) is a bag of numbers.
// This is the one place that turns them back into call names, reading the same
// CALLS table the bridge dispatches on so it cannot drift from it.

const { CALLS } = require('../lib/gl-compat');

const name = op => CALLS[op | 0] || `<unknown ${op}>`;
const args = process.argv.slice(2);

if (args.includes('--list')) {
  CALLS.forEach((n, i) => console.log(`${String(i).padStart(4)}  ${n}`));
} else if (args.includes('--json')) {
  const text = require('fs').readFileSync(0, 'utf8');
  const counts = JSON.parse(text);
  const rows = Object.entries(counts.byOp || counts)
    .map(([op, n]) => [name(op), Number(n)])
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, r) => s + r[1], 0);
  for (const [n, c] of rows) console.log(`${String(c).padStart(9)}  ${n}`);
  console.log(`${String(total).padStart(9)}  TOTAL`);
} else if (args.length) {
  for (const a of args) console.log(`${a}  ${name(a)}`);
} else {
  console.log('usage: gl-opcode-names.js <op>... | --json | --list');
}
