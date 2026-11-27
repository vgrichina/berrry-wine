#!/usr/bin/env node
// Which SSE instructions does the THREADED interpreter still run, and how much
// threaded work sits in blocks that hold one?
//
//   node tools/sse-census.js <hist.json> --pe-dir=DIR[,DIR...] [--exe-base=0x400000]
//        [--top=40] [--funcs=12] [--json=FILE]
//
// Input is a --hist-json window from test/run.js with --hist-json-blocks=0
// (every threaded block entry in the window). Each listed block is
// disassembled from its PE file (tools/disasm.js) up to the instruction that
// ends it -- a jump, call or ret, which is where the threaded decoder ends a
// block too -- and every instruction is weighted by the block's entry count.
//
// What it prints:
//   - threaded x86 instructions in the window, the SSE share of them, and the
//     share of threaded instructions in blocks holding at least one SSE op
//     (the coverage the micro-op tier gives up while it stops at SSE);
//   - SSE instructions by mnemonic and form (rr = both registers, rm = memory
//     source, mr = memory destination), weighted;
//   - the hottest SSE-holding functions, grouped by the nearest preceding
//     block address that a call reaches (--funcs), so a micro-benchmark can
//     start from real code.
//
// Block lengths are a static reading: a block that the threaded decoder ended
// early (a page edge, a self-modifying write) is counted to its branch. The
// instruction counts are therefore an upper bound per entry; the SSE mix is
// not affected.
'use strict';
const fs = require('fs');
const path = require('path');
const { readHist, makeAttributor } = require('./hist-blocks');
const { disasmAt } = require('./disasm');
const { readPE } = require('../lib/pe');

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('usage: sse-census.js <hist.json> --pe-dir=DIR[,DIR] [--exe-base=0x400000] [--top=40] [--json=FILE]');
  process.exit(2);
}
const PE_DIRS = String(flag('pe-dir', '')).split(',').filter(Boolean);
const EXE_BASE = parseInt(flag('exe-base', '0x400000'), 16) >>> 0;
const TOP = parseInt(flag('top', '40'), 10);
const FUNCS = parseInt(flag('funcs', '12'), 10);
const JSON_OUT = flag('json', null);

const hist = readHist(file);
const attribute = makeAttributor(hist, EXE_BASE);
// The exe: the only module whose name is not in hist.mods under its own base.
const exeName = Object.entries(hist.mods || {}).find(([, p]) => p[0] === EXE_BASE);

const peCache = new Map();
function peFor(name) {
  if (peCache.has(name)) return peCache.get(name);
  const want = (name === 'exe' && exeName ? exeName[0] : name).toLowerCase();
  let pe = null;
  for (const d of PE_DIRS) {
    let hit = null;
    try { hit = fs.readdirSync(d).find(f => f.toLowerCase() === want); } catch (_) { hit = null; }
    if (hit) { try { pe = readPE(path.join(d, hit)); } catch (_) { pe = null; } }
    if (pe) break;
  }
  peCache.set(name, pe);
  return pe;
}

const ENDS = /^(j[a-z]+|call|ret|retn|retf|loop[a-z]*|jmp|int3|hlt|iret[d]?)\b/;
// "004a64f0  f3 0f 10 05 50 89 6f 00      movss xmm0, [0x6f8950]" -> "movss xmm0, [0x6f8950]"
const strip = s => String(s || '').replace(/^\s*[0-9a-f]+\s+(?:[0-9a-f]{2}\s)+\s*/i, '').trim();

function blockInsns(pe, va) {
  const off = pe.va2off(va);
  if (off < 0) return null;
  let lines;
  try { lines = disasmAt(pe.buf, off, va, 200); } catch (_) { return null; }
  const out = [];
  for (const l of lines) {
    const t = strip(l);
    if (!t) break;
    out.push(t);
    const mn = t.replace(/^(rep[a-z]*|lock|[cdefgs]s:)\s+/, '').split(/\s+/)[0];
    if (ENDS.test(mn)) break;
  }
  return out;
}

function classify(t) {
  // "movss xmm0, [0x6f8950]" -> { mn: 'movss', form: 'rm' }
  const body = t.replace(/^[cdefgs]s:\s+/, '');
  const sp = body.indexOf(' ');
  const mn = sp < 0 ? body : body.slice(0, sp);
  const ops = sp < 0 ? [] : body.slice(sp + 1).split(/,\s*/);
  if (!ops.some(o => /\bxmm\d\b/.test(o))) return null;
  const mem = i => ops[i] && ops[i].includes('[');
  const form = mem(0) ? 'mr' : mem(1) ? 'rm' : 'rr';
  return { mn, form };
}

let totalInsns = 0, sseInsns = 0, sseBlockInsns = 0, totalEntries = 0, sseBlockEntries = 0, unmapped = 0;
const byForm = new Map();
const byBlock = [];
for (const [hex, hits] of hist.blocks || []) {
  const addr = parseInt(hex, 16) >>> 0;
  totalEntries += hits;
  const a = attribute(addr);
  const pe = peFor(a.name);
  const insns = pe ? blockInsns(pe, a.va) : null;
  if (!insns || !insns.length) { unmapped += hits; continue; }
  let nsse = 0;
  for (const t of insns) {
    const c = classify(t);
    if (!c) continue;
    nsse++;
    const k = `${c.mn} ${c.form}`;
    const e = byForm.get(k) || { mn: c.mn, form: c.form, w: 0, sites: new Set() };
    e.w += hits;
    e.sites.add(`${a.name}+0x${a.va.toString(16)}`);
    byForm.set(k, e);
  }
  totalInsns += hits * insns.length;
  sseInsns += hits * nsse;
  if (nsse) {
    sseBlockInsns += hits * insns.length;
    sseBlockEntries += hits;
    byBlock.push({ addr, name: a.name, va: a.va, hits, n: insns.length, nsse });
  }
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
const M = v => (v / 1e6).toFixed(2) + 'M';
const say = s => process.stdout.write(s + '\n');
say(`window ${hist.window ? `${hist.window.start}..${hist.window.stop}` : '?'}  thread ${hist.thread}`);
say(`threaded block entries ${M(totalEntries)} (unmapped ${pct(unmapped, totalEntries)}); uop: ` +
  `${hist.uop ? `${M(hist.uop.blocks)} blocks in ${M(hist.uop.enters)} enters` : 'n/a'}`);
say(`threaded x86 insns (static block length x entries) ${M(totalInsns)}`);
say(`  SSE insns                              ${M(sseInsns)}  ${pct(sseInsns, totalInsns)}`);
say(`  insns in blocks holding an SSE op      ${M(sseBlockInsns)}  ${pct(sseBlockInsns, totalInsns)}`);
say(`  block entries of SSE-holding blocks    ${M(sseBlockEntries)}  ${pct(sseBlockEntries, totalEntries)}`);
say('');
say('SSE by mnemonic and form (weighted by block entries):');
const rows = [...byForm.values()].sort((x, y) => y.w - x.w);
const precision = mn => /ss$/.test(mn) || /2ss$/.test(mn) ? 'ss' : /sd$/.test(mn) ? 'sd'
  : /ps$/.test(mn) ? 'ps' : /pd$/.test(mn) ? 'pd' : /^(p|movd|movq)/.test(mn) ? 'int' : 'other';
const byPrec = new Map();
for (const r of rows) byPrec.set(precision(r.mn) + ' ' + r.form, (byPrec.get(precision(r.mn) + ' ' + r.form) || 0) + r.w);
for (const r of rows.slice(0, TOP)) {
  say(`  ${(r.mn + ' ' + r.form).padEnd(18)} ${M(r.w).padStart(9)}  ${pct(r.w, sseInsns).padStart(6)}  sites=${r.sites.size}`);
}
say('');
say('by precision and form:');
for (const [k, w] of [...byPrec.entries()].sort((x, y) => y[1] - x[1])) say(`  ${k.padEnd(10)} ${M(w).padStart(9)}  ${pct(w, sseInsns).padStart(6)}`);
say('');
say(`top SSE-holding blocks (entries, insns/SSE per entry):`);
byBlock.sort((x, y) => y.hits * y.nsse - x.hits * x.nsse);
for (const b of byBlock.slice(0, FUNCS * 2)) {
  say(`  ${(b.name + '+0x' + b.va.toString(16)).padEnd(24)} ${M(b.hits).padStart(8)} ent  ${b.n} insns / ${b.nsse} sse  sse-w ${M(b.hits * b.nsse)}`);
}
if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({
    source: file, window: hist.window, thread: hist.thread, uop: hist.uop,
    totalEntries, unmapped, totalInsns, sseInsns, sseBlockInsns, sseBlockEntries,
    forms: rows.map(r => ({ mn: r.mn, form: r.form, w: r.w, sites: r.sites.size })),
    precision: Object.fromEntries(byPrec),
    blocks: byBlock.slice(0, 200).map(b => ({ at: `${b.name}+0x${b.va.toString(16)}`, hits: b.hits, n: b.n, nsse: b.nsse })),
  }, null, 1));
}
