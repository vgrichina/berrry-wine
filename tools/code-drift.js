#!/usr/bin/env node
// code-drift.js — which instructions has the guest rewritten in memory?
//
//   node tools/code-drift.js <run.js log> --pe=PATH [--addr=0xVA] [--base=0xVA]
//                            [--max=N] [--json]
//
// Take a run.js log carrying one or more `--input=B:dump-mem:0xVA:LEN` dumps of
// a code range, compare each against the same VAs in the PE on disk, and print
// every changed byte run as the instruction it lands in: the original and the
// in-memory form, disassembled side by side.
//
// Why this exists: `cache: page invalidations N that dropped a block M` in a
// run.js exit summary says a game is writing into pages it executes, and every
// such write retires decoded blocks that the next entry must decode again. The
// counter cannot say *what* is being written. That decides the fix: a game that
// rewrites only an instruction's immediate or displacement (the classic span
// renderer that patches its row width into a `cmp`) is served by patching the
// decoded operand in place, while one that rewrites opcodes needs a re-decode.
// Each run is classified accordingly:
//
//   operand  same opcode, same length, only trailing operand bytes differ
//   opcode   the instruction itself became a different instruction
//
// With several dumps of one address (dump the same range at two batches), each
// run also says whether it changed BETWEEN dumps ("live") or only once, before
// the first dump ("once" — an unpacker, a one-time fixup, a relocation).
//
// --base: the module's runtime load base, when it is not the PE's preferred
// base. Relocated absolute addresses then show up as operand runs; read those
// with that in mind (this tool does not apply the relocation table).
'use strict';
const fs = require('fs');
const path = require('path');
const { readPE } = require(path.join(__dirname, '..', 'lib', 'pe.js'));
const { disasmAt } = require('./disasm');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const logFile = args.find(a => !a.startsWith('--'));
const peFile = flag('pe', null);
if (!logFile || !peFile) {
  console.error('usage: node tools/code-drift.js <run.js log> --pe=PATH [--addr=0xVA] [--base=0xVA] [--max=N] [--json]');
  process.exit(2);
}
const MAX = parseInt(flag('max', '60'), 10);
const JSON_OUT = args.includes('--json');
const wantAddr = flag('addr', null) === null ? null : parseInt(flag('addr'), 16) >>> 0;

// Same banner-anchored parse as tools/dump2png.js: a log carries several dumps,
// and an unrelated trace line can look a lot like a dump row.
function parseRegions(text) {
  const regions = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const banner = /^Hexdump (0x[0-9a-fA-F]+) \((\d+) bytes\):/.exec(line);
    if (banner) {
      cur = { addr: parseInt(banner[1], 16) >>> 0, declared: +banner[2], bytes: [] };
      regions.push(cur);
      continue;
    }
    if (!cur) continue;
    const row = /^\s{2}0x[0-9a-fA-F]+\s{2}((?:[0-9a-fA-F]{2} )+)/.exec(line);
    if (!row) { cur = null; continue; }
    for (const b of row[1].trim().split(/\s+/)) cur.bytes.push(parseInt(b, 16));
  }
  return regions;
}

const pe = readPE(peFile);
const base = flag('base', null) === null ? pe.imageBase : parseInt(flag('base'), 16) >>> 0;
const toPeVa = va => va - base + pe.imageBase;

// The disk bytes for [va, va+len) in runtime VAs; -1 where the PE has no raw data.
function diskBytes(va, len) {
  const out = new Int16Array(len).fill(-1);
  for (let i = 0; i < len; i++) {
    const off = pe.va2off(toPeVa(va + i));
    if (off >= 0 && off < pe.buf.length) out[i] = pe.buf[off];
  }
  return out;
}

// Instruction boundaries over a byte image: linear-sweep from `from`. A sweep
// started a few dozen bytes early resynchronizes on real code long before the
// run it is asked about; the caller picks the lines that overlap the run.
function decodeLines(bytes, startVa, from, to) {
  const buf = Buffer.from(bytes.slice(from, to).map(b => b & 0xff));
  const lines = disasmAt(buf, 0, startVa + from, 400);
  const out = [];
  for (const l of lines) {
    const m = /^([0-9a-fA-F]{8})\s+((?:[0-9a-fA-F]{2} )+)\s*(.*)$/.exec(l);
    if (!m) continue;
    const va = parseInt(m[1], 16) >>> 0;
    const len = m[2].trim().split(/\s+/).length;
    if (va + len > startVa + to) break;
    out.push({ va, len, bytes: m[2].trim(), text: m[3].trim() });
  }
  return out;
}

// [start, end) runs of set bits in `mask`, merging runs separated by fewer than
// 4 clear bytes: one instruction's immediate often differs in two
// non-adjacent bytes.
function maskRuns(mask) {
  const runs = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const prev = runs[runs.length - 1];
    if (prev && i - prev[1] < 4) prev[1] = i + 1;
    else runs.push([i, i + 1]);
  }
  return runs;
}

const regions = parseRegions(fs.readFileSync(logFile, 'utf8'))
  .filter(r => wantAddr === null || r.addr === wantAddr);
if (!regions.length) {
  console.error(`no matching "Hexdump 0x… (N bytes):" region in ${logFile}`);
  process.exit(2);
}

// Group dumps of the same address so a site can be called live or once.
const byAddr = new Map();
for (const r of regions) {
  if (!byAddr.has(r.addr)) byAddr.set(r.addr, []);
  byAddr.get(r.addr).push(r);
}

const report = [];
for (const [addr, dumps] of byAddr) {
  const len = Math.min(...dumps.map(d => d.bytes.length));
  const disk = Array.from(diskBytes(addr, len));
  const first = dumps[0].bytes.slice(0, len);
  // A site is live when any later dump disagrees with an earlier one there.
  const live = new Uint8Array(len);
  for (let k = 1; k < dumps.length; k++) {
    for (let i = 0; i < len; i++) if (dumps[k].bytes[i] !== dumps[k - 1].bytes[i]) live[i] = 1;
  }
  // Differs from disk in ANY dump, so a site patched only after the first
  // dump is not missed.
  const drift = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    if (disk[i] >= 0 && dumps.some(d => d.bytes[i] !== disk[i])) drift[i] = 1;
  }
  const runs = maskRuns(drift);
  const sites = [];
  for (const [s, e] of runs) {
    const from = Math.max(0, s - 48), to = Math.min(len, e + 16);
    const orig = decodeLines(disk, addr, from, to);
    const hits = orig.filter(l => l.va + l.len > addr + s && l.va < addr + e);
    const last = dumps[dumps.length - 1].bytes;
    for (const ins of hits.length ? hits : [{ va: addr + s, len: e - s, bytes: '', text: '(no decode)' }]) {
      const o = ins.va - addr;
      const nowLines = decodeLines(last, addr, o, Math.min(len, o + 16));
      const now = nowLines[0] || { len: 0, bytes: '', text: '(no decode)' };
      const firstDiff = (() => {
        for (let i = o; i < o + ins.len; i++) if (drift[i]) return i - o;
        return -1;
      })();
      const cls = (now.len === ins.len && firstDiff > 0 &&
        now.text.split(/\s+/)[0] === ins.text.split(/\s+/)[0]) ? 'operand' : 'opcode';
      let isLive = false;
      for (let i = o; i < o + ins.len; i++) if (live[i]) isLive = true;
      sites.push({ va: ins.va, cls, live: dumps.length > 1 ? isLive : null,
        orig: `${ins.bytes}  ${ins.text}`, now: `${now.bytes}  ${now.text}` });
    }
  }
  // One instruction can be named by two adjacent runs; keep it once.
  const seen = new Set();
  const uniq = sites.filter(x => !seen.has(x.va) && seen.add(x.va));
  report.push({ addr, len, dumps: dumps.length, sites: uniq });
}

if (JSON_OUT) { console.log(JSON.stringify(report, null, 1)); process.exit(0); }
const hx = v => '0x' + (v >>> 0).toString(16).padStart(8, '0');
for (const r of report) {
  const n = r.sites.length;
  const op = r.sites.filter(s => s.cls === 'operand').length;
  const lv = r.sites.filter(s => s.live).length;
  console.log(`${hx(r.addr)} +0x${r.len.toString(16)}  ${r.dumps} dump(s)  ` +
    `${n} rewritten instruction(s): ${op} operand-only, ${n - op} opcode` +
    (r.dumps > 1 ? `  | ${lv} changed between dumps (live)` : ''));
  for (const s of r.sites.slice(0, MAX)) {
    const tag = s.cls + (s.live === null ? '' : s.live ? ' live' : ' once');
    console.log(`  ${hx(s.va)}  [${tag}]`);
    console.log(`      disk: ${s.orig}`);
    console.log(`      mem:  ${s.now}`);
  }
  if (n > MAX) console.log(`  ... ${n - MAX} more (--max=N)`);
}
