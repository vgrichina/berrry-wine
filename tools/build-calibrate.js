#!/usr/bin/env node
'use strict';

// A fixed CPU workload, run once per build alongside the compile, so the
// compile's CPU can be judged in CALIBRATION UNITS instead of seconds.
//
//   node tools/build-calibrate.js [--out=build/build-calibration.json]
//
// The build box is shared and loaded, and the same compile costs 25 s of CPU
// on a quiet minute and 40 s on a busy one (frequency, SMT siblings, cache).
// A ratio against a workload of the same shape, measured in the same minute,
// cancels most of that. The shape is the compiler's front end: tokenize WAT
// text into atoms and parens and intern the identifiers.
//
// The input is NOT a slice of src/: src/ changes every commit, and a moving
// yardstick would turn a source edit into a fake compile regression. It is
// 1 MiB of WAT-shaped text generated from a fixed seed, so it is byte-identical
// on every run and every machine. User+sys CPU of this process per sample.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = path.resolve(ROOT, outArg ? outArg.slice(6) : path.join('build', 'build-calibration.json'));
const SIZE = 1 << 20;
// One unit = PASSES parses (~0.1 s on an idle M1). REPS samples GAP_MS apart
// spread the measurement over the compile's tail (~3 s, build.sh runs this
// once the gates are done), at ~1 s of CPU in total.
const PASSES = 3;
const REPS = 11;
const GAP_MS = 200;

function makeText() {
  let seed = 0x5eed1234;
  const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  const ops = ['i32.add', 'i32.load', 'i32.store', 'local.get', 'local.set', 'call', 'br_if',
    'i32.const', 'global.get', 'if', 'then', 'else', 'block', 'loop', 'i32.and', 'i32.shl'];
  const parts = [];
  let len = 0;
  while (len < SIZE) {
    const depth = 1 + rnd(4);
    let s = '';
    for (let d = 0; d < depth; d++) s += `(${ops[rnd(ops.length)]} `;
    s += rnd(3) === 0 ? `(i32.const ${rnd(1 << 20)})` : `(local.get $v${rnd(400)})`;
    s += ')'.repeat(depth);
    if (rnd(5) === 0) s += ` ;; note ${rnd(1000)}`;
    s += '\n';
    parts.push(s);
    len += s.length;
  }
  return parts.join('');
}

// Tokenize AND build the tree, retaining it: the compiler's front end is
// allocation- and GC-bound as much as it is branch-bound, so a yardstick that
// only scanned would not slow down when the box is short of memory bandwidth
// and the compile does.
function tokenize(text) {
  const atoms = new Map();
  let depth = 0;
  let maxDepth = 0;
  let tokens = 0;
  const root = [];
  const stack = [root];
  for (let i = 0; i < text.length;) {
    const c = text.charCodeAt(i);
    if (c === 40) {
      const node = { kind: 'list', items: [], at: i };
      stack[stack.length - 1].push(node);
      stack.push(node.items);
      depth++; if (depth > maxDepth) maxDepth = depth; tokens++; i++; continue;
    }
    if (c === 41) { stack.pop(); depth--; tokens++; i++; continue; }
    if (c === 32 || c === 10 || c === 9) { i++; continue; }
    if (c === 59 && text.charCodeAt(i + 1) === 59) { while (i < text.length && text.charCodeAt(i) !== 10) i++; continue; }
    let j = i;
    while (j < text.length) {
      const d = text.charCodeAt(j);
      if (d === 40 || d === 41 || d === 32 || d === 10 || d === 9) break;
      j++;
    }
    const atom = text.slice(i, j);
    atoms.set(atom, (atoms.get(atom) || 0) + 1);
    stack[stack.length - 1].push({ kind: 'atom', text: atom, at: i });
    tokens++;
    i = j;
  }
  let nodes = 0;
  const walk = (items) => { for (const n of items) { nodes++; if (n.kind === 'list') walk(n.items); } };
  walk(root);
  return { tokens, nodes, distinct: atoms.size, depth, maxDepth };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const text = makeText();
  const samples = [];
  // Untimed warm-up: the first parses run in V8's baseline tiers and grow the
  // heap, and cost 2-3x a warm one, which is a JIT fact, not a box fact.
  let summary = null;
  for (let p = 0; p < 2 * PASSES; p++) summary = tokenize(text);
  for (let r = 0; r < REPS; r++) {
    if (r) await sleep(GAP_MS);
    const before = process.cpuUsage();
    for (let p = 0; p < PASSES; p++) summary = tokenize(text);
    const used = process.cpuUsage(before);
    samples.push((used.user + used.system) / 1000);
  }
  if (summary.depth !== 0) throw new Error('build-calibrate: generated text does not balance');
  // Median: one preempted or still-warming sample must not move it.
  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const unit = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const out = { format: 2, cpuMs: +unit.toFixed(2), bytes: text.length, passes: PASSES, reps: REPS, gapMs: GAP_MS,
    samplesMs: samples.map((x) => +x.toFixed(1)), tokens: summary.tokens, distinct: summary.distinct };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
  console.log(`build-calibrate: ${out.cpuMs} ms per unit (${PASSES} parses of ${out.bytes} bytes; ` +
    `median of ${REPS} samples ${GAP_MS} ms apart)`);
}

main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
