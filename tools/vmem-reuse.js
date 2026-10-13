#!/usr/bin/env node
// ASCII tl;dr
//
//   a log with [API] VirtualAlloc(...) / VirtualFree(...) lines
//        |
//        +--> replay them in order against a model of the address space
//                 |
//                 +--> RE-COMMIT   : a commit whose base is inside a range the
//                 |                  guest already MEM_RELEASEd  (Windows would
//                 |                  hand back ZERO-FILLED pages here, and our
//                 |                  $virtual_map_commit_locked returns an
//                 |                  existing record untouched -- dirty bytes)
//                 +--> RE-RESERVE  : a reserve at an explicit released base
//                 +--> UNSEEN-FREE : MEM_RELEASE of a base this log never saw
//                                    allocated. Usually NOT a double free: an
//                                    `VirtualAlloc(NULL, .., MEM_RESERVE)`
//                                    reports its address in eax, which the
//                                    [API] line does not print, so every
//                                    anonymous reservation is invisible here.
//
// Why a tool and not a grep: the question is about ORDER (was this base freed
// BEFORE this alloc), and a grep over 38k interleaved lines cannot answer it.
//
// Usage: node tools/vmem-reuse.js <log> [--top=N] [--all]
const fs = require('fs');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const top = Number((args.find(a => a.startsWith('--top=')) || '--top=20').slice(6));
const all = args.includes('--all');
if (!file) { console.error('usage: node tools/vmem-reuse.js <log> [--top=N] [--all]'); process.exit(2); }

const ALLOC = /VirtualAlloc\(0x([0-9a-f]{8}), 0x([0-9a-f]{8}), 0x([0-9a-f]{8}), 0x([0-9a-f]{8})\)(?: ret=0x([0-9a-f]{8}))?/;
const FREE = /VirtualFree\(0x([0-9a-f]{8}), 0x([0-9a-f]{8}), 0x([0-9a-f]{8})\)(?: ret=0x([0-9a-f]{8}))?/;
const MEM_COMMIT = 0x1000, MEM_RELEASE = 0x8000;

// The relay prints every page line twice; a replayed duplicate would read as a
// double free. Collapse only IMMEDIATE repeats, which is what duplication is.
const lines = fs.readFileSync(file, 'utf8').split('\n');
const seq = [];
for (const line of lines) {
  const m = ALLOC.exec(line) || FREE.exec(line);
  if (!m) continue;
  if (seq.length && seq[seq.length - 1].raw === m[0]) { seq.pop(); seq.push({ raw: m[0], m, alloc: !!ALLOC.exec(line) }); continue; }
  seq.push({ raw: m[0], m, alloc: !!ALLOC.exec(line) });
}

const live = new Map();     // base -> {size}
const freed = new Map();    // base -> {size, atIndex, byRet}
const findings = { recommit: [], rereserve: [], unseenFree: [] };
let commits = 0, reserves = 0, releases = 0;

const coveringFreed = (addr) => {
  for (const [base, e] of freed) if (addr >= base && addr < base + e.size) return { base, e };
  return null;
};

seq.forEach((s, i) => {
  const [, a0, a1, a2, a3, ret] = s.m;
  const base = parseInt(a0, 16);
  if (s.alloc) {
    const size = parseInt(a1, 16), type = parseInt(a2, 16);
    if (type & MEM_COMMIT) commits++; else reserves++;
    if (!base) { return; }
    const f = coveringFreed(base);
    if (f) {
      const rec = { at: i, base, size, ret: ret ? '0x' + ret : '?', freedBase: f.base, freedAt: f.e.atIndex, freedBy: f.e.byRet };
      (type & MEM_COMMIT ? findings.recommit : findings.rereserve).push(rec);
      freed.delete(f.base);
    }
    live.set(base, { size });
  } else {
    const type = parseInt(a2, 16);
    if (!(type & MEM_RELEASE)) return;
    releases++;
    const l = live.get(base);
    if (!l) findings.unseenFree.push({ at: i, base, ret: ret ? '0x' + ret : '?' });
    else { live.delete(base); freed.set(base, { size: l.size, atIndex: i, byRet: ret ? '0x' + ret : '?' }); }
  }
});

const hex = v => '0x' + (v >>> 0).toString(16).padStart(8, '0');
console.log(`${seq.length} ops: ${reserves} reserve, ${commits} commit, ${releases} release`);
console.log(`live at end ${live.size}, released and never reused ${freed.size}`);
for (const [name, list] of Object.entries(findings)) {
  console.log(`\n${name}: ${list.length}`);
  for (const r of (all ? list : list.slice(0, top))) {
    console.log(`  op#${r.at} ${hex(r.base)}` + (r.size !== undefined ? `+${hex(r.size)}` : '')
      + ` from=${r.ret}` + (r.freedBase !== undefined ? `  (freed at op#${r.freedAt} as ${hex(r.freedBase)} by ${r.freedBy})` : ''));
  }
}
