#!/usr/bin/env node
// Rank functions by self time in a V8 .cpuprofile (node --cpu-prof output).
// Usage: node tools/cpuprof-top.js <file.cpuprofile> [top=30] [--callers=NAME]
//        [--names] [--wasm-only] [--incl=NAME[,NAME...]] [--lines=NAME] [--window=START:END]
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/cpuprof-top.js <file.cpuprofile> [top] [--callers=NAME]');
  process.exit(1);
}
const top = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '30', 10);
const callersOf = (process.argv.find(a => a.startsWith('--callers=')) || '').split('=')[1];

const prof = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map();
for (const n of prof.nodes) byId.set(n.id, n);
const parent = new Map();
for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);

// --window=START:END (ms from the first sample; END may be empty) keeps one
// phase of a profile that spans boot, loading and gameplay, as
// tools/wasm-phase-profile.js does for subsystems.
const windowArg = (process.argv.find(a => a.startsWith('--window=')) || '').slice(9);
const [winLo, winHi] = windowArg
  ? windowArg.split(':').map((v, i) => (v === '' || v === undefined ? (i ? Infinity : 0) : Number(v)))
  : [-Infinity, Infinity];

// timeDeltas[i] is the time spent before samples[i] was taken.
const self = new Map();
let total = 0;
let clock = 0;
for (let i = 0; i < prof.samples.length; i++) {
  const dt = (prof.timeDeltas[i] || 0) / 1000; // ms
  clock += dt > 0 ? dt : 0;
  if (clock < winLo || clock > (winHi === undefined ? Infinity : winHi)) continue;
  total += dt;
  const id = prof.samples[i];
  self.set(id, (self.get(id) || 0) + dt);
}

// wasm frames come out as wasm-function[N]; resolve N to its $name the same
// way tools/wasm-func-name.js does, so a profile reads as source rather than
// as indices. Off by default: it parses every src/*.wat.
const withNames = process.argv.includes('--names');
const wasmNames = (() => {
  if (!withNames) return null;
  const { execFileSync } = require('child_process');
  const path = require('path');
  const out = execFileSync('node',
    [path.join(__dirname, 'wasm-func-name.js'), '--dump'], { encoding: 'utf8' });
  const map = new Map();
  for (const line of out.split('\n')) {
    const m = line.match(/^\[(\d+)\] (.+?) \(/);
    if (m) map.set(Number(m[1]), m[2]);
  }
  return map;
})();

const wasmLabels = new Set();
const label = n => {
  const f = n.callFrame;
  let name = f.functionName || '(anonymous)';
  const wasmIdx = name.match(/^wasm-function\[(\d+)\]$/);
  if (wasmIdx) {
    const resolved = (wasmNames && wasmNames.get(Number(wasmIdx[1]))) || name;
    wasmLabels.add(resolved);   // resolved names no longer look like wasm frames
    return resolved;
  }
  const url = (f.url || '').replace(/^file:\/\//, '').split('/').slice(-1)[0];
  const labelled = url ? `${name} @ ${url}:${f.lineNumber + 1}` : name;
  // A module with a name section (build/wine-assembly.named.wasm) reports its
  // frames by $name under a script url such as `wine-assembly-00b0df8a` or
  // `wasm://wasm/...`, not as wasm-function[N]; without this the split below
  // calls every one of them JS and prints "wasm: 0.0%".
  if (/^wasm:\/\//.test(f.url || '') || /^wine-assembly-[0-9a-f]+$/.test(url)) wasmLabels.add(labelled);
  return labelled;
};

const agg = new Map();
for (const [id, ms] of self) {
  const n = byId.get(id);
  if (!n) continue;
  const k = label(n);
  agg.set(k, (agg.get(k) || 0) + ms);
}

// Wasm vs JS split: in this project the wasm half is the emulator itself and
// the JS half is host/harness work, so the ratio says which one to profile next.
let wasmMs = 0;
for (const [k, ms] of agg) if (wasmLabels.has(k) || k.startsWith('wasm-function[')) wasmMs += ms;
console.log(`total sampled: ${total.toFixed(1)} ms, ${prof.samples.length} samples`);
console.log(`wasm: ${wasmMs.toFixed(1)} ms (${(100 * wasmMs / total).toFixed(1)}%), other: ${(total - wasmMs).toFixed(1)} ms`);
console.log('--- self time ---');
for (const [k, ms] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, top)) {
  console.log(`${ms.toFixed(1).padStart(9)} ms  ${(100 * ms / total).toFixed(1).padStart(5)}%  ${k}`);
}

// The emulator is usually a minority of a headless run -- the harness reads the
// VFS off disk and rasterizes into a software canvas, neither of which exists
// in the browser. Show the guest's own cost on its own terms.
if (process.argv.includes('--wasm-only')) {
  console.log('--- self time, wasm only ---');
  const wasmAgg = [...agg].filter(([k]) => wasmLabels.has(k) || k.startsWith('wasm-function['));
  for (const [k, ms] of wasmAgg.sort((a, b) => b[1] - a[1]).slice(0, top)) {
    console.log(`${ms.toFixed(1).padStart(9)} ms  ${(100 * ms / wasmMs).toFixed(1).padStart(5)}% of wasm  ${k}`);
  }
}

// --incl=NAME[,NAME...]: inclusive time -- every sample with a frame whose
// label contains NAME anywhere on its stack, each sample counted once. This
// is the "x% incl" figure: a handler plus every helper it calls (an
// x87 island body and its $g2w/$fpu_set_exc calls, say), which self time
// scatters across the callees.
const inclNames = (process.argv.find(a => a.startsWith('--incl=')) || '').slice(7).split(',').filter(Boolean);
if (inclNames.length) {
  console.log('--- inclusive time ---');
  for (const name of inclNames) {
    let ms = 0;
    for (const [id, t] of self) {
      for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
        const n = byId.get(cur);
        if (n && label(n).includes(name)) { ms += t; break; }
      }
    }
    console.log(`${ms.toFixed(1).padStart(9)} ms  ${(100 * ms / total).toFixed(1).padStart(5)}%` +
      `  ${(100 * ms / (wasmMs || 1)).toFixed(1).padStart(5)}% of wasm  ${name}`);
  }
}

if (callersOf) {
  const chains = new Map();
  for (const [id, ms] of self) {
    const n = byId.get(id);
    if (!n || !label(n).includes(callersOf)) continue;
    const stack = [];
    let cur = parent.get(id);
    while (cur !== undefined && stack.length < 8) {
      stack.push(label(byId.get(cur)));
      cur = parent.get(cur);
    }
    const k = stack.join(' <- ');
    chains.set(k, (chains.get(k) || 0) + ms);
  }
  console.log(`--- callers of ${callersOf} ---`);
  for (const [k, ms] of [...chains].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`${ms.toFixed(1).padStart(9)} ms  ${k}`);
  }
}

// --lines=NAME: where inside one function its self time goes. V8 records
// per-line tick counts (positionTicks) on each profile node; this sums them
// over every node whose label contains NAME -- one function reached along many
// call paths is many nodes -- and prints the hottest source lines with their
// text. Reach for it when a single large JS function (a command decoder, a
// draw-record parser) tops the self-time list and its name says nothing about
// which part is slow. Ticks are samples, converted with the run's mean sample
// interval; a node with no positionTicks contributes nothing, so the header
// says how much of the function's self time the line table covers.
const linesOf = (process.argv.find(a => a.startsWith('--lines=')) || '').slice(8);
if (linesOf) {
  const path = require('path');
  const msPerTick = total / (prof.samples.length || 1);
  const lines = new Map();   // "file:line" -> ticks
  let covered = 0, selfMs = 0;
  const files = new Map();
  for (const n of prof.nodes) {
    if (!label(n).includes(linesOf)) continue;
    selfMs += self.get(n.id) || 0;
    const url = (n.callFrame.url || '').replace(/^file:\/\//, '');
    for (const { line, ticks } of n.positionTicks || []) {
      const k = `${url}:${line}`;
      lines.set(k, (lines.get(k) || 0) + ticks);
      covered += ticks;
    }
  }
  const source = (url, line) => {
    if (!files.has(url)) {
      // A profile taken in a since-deleted worktree names files that are
      // gone; fall back to the same repo-relative path in this checkout by
      // dropping leading directories until one exists.
      let text = null;
      const parts = url.split('/');
      for (let i = 0; i < parts.length && text === null; i++) {
        const candidate = i ? parts.slice(i).join('/') : url;
        try { text = fs.readFileSync(candidate, 'utf8').split('\n'); } catch (_) {}
      }
      files.set(url, text);
    }
    const t = files.get(url);
    return t && t[line - 1] !== undefined ? t[line - 1].trim().slice(0, 110) : '';
  };
  console.log(`--- lines of ${linesOf}: ${(covered * msPerTick).toFixed(1)} of ${selfMs.toFixed(1)} ms self has line ticks ---`);
  for (const [k, ticks] of [...lines].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    const at = k.lastIndexOf(':'), url = k.slice(0, at), line = Number(k.slice(at + 1));
    console.log(`${(ticks * msPerTick).toFixed(1).padStart(9)} ms  ${path.basename(url)}:${line}  ${source(url, line)}`);
  }
}
