#!/usr/bin/env node
'use strict';

// What did the micro-op tier decide about each hot head, and was it right?
//
// `run.js --uop --uop-census` logs one record per verdict through log_i32
// (07d $uop_census_ev): every compile attempt (installed, or declined and
// why), every program retired as poor (with its enters, blocks and the EIP
// it left by), every code-write kill, every flush, and at exit the live
// programs and the declined/poor markers still in the map. This folds them
// into per-head rows so three questions have answers:
//
//   - churn:    how many compiles were the SAME head again (a flush or a map
//               collision forgot the verdict), and how much of the compile
//               count is that;
//   - poor:     how short the retired programs' trips really were, and which
//               exit they left by (head+N) -- a side exit on every trip reads
//               very differently from a loop that runs once;
//   - coverage: with --hist (a --hist-json window from the SAME run), how many
//               of the block entries the tier did NOT take are at heads it
//               declined, retired, or never saw hot, and for what reason.
//
// usage:
//   node tools/uop-census.js <run.log> [--hist=window.json] [--exe-base=0x400000]
//     [--exe=PATH] [--pe-dir=DIR] [--thread=N] [--top=N] [--json]
//
// --pe-dir names a directory holding the exe and DLLs; each head is then
// disassembled (first instruction) from the module file its address maps to.

const fs = require('fs');
const path = require('path');
const { readHist, makeAttributor } = require('./hist-blocks');

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const files = argv.filter(a => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: uop-census.js <run.log> [--hist=F] [--exe-base=0x400000] [--pe-dir=DIR] [--top=N] [--json]');
  process.exit(2);
}
const TOP = parseInt(flag('top', '25'), 10);
const EXE_BASE = parseInt(flag('exe-base', '0x400000'), 16) >>> 0;
const PE_DIR = flag('pe-dir', null);
// The exe's file, when --pe-dir holds several: the histogram names it `exe`.
const EXE = flag('exe', null);

// Must match test/runner-experiments.js UOP_REASONS and the 07e header.
const REASONS = [null, 'scan-limit', 'overlap', 'head-unsupported', 'no-backedge', 'loop-too-big',
  'seam-ambiguous', 'long-block', 'unreached-block', 'demand-no-fixpoint', 'branch-mid-block',
  'dead-flags-consumed', 'dead-cf', 'cf-no-recipe', 'cf-kind', 'dead-flags-rec', 'rec-no-recipe', 'rec-kind',
  'dead-flags-jcc', 'kind', 'too-many-windows', 'label', 'arg', 'too-many-temps', 'program-too-big',
  'ranges-full', 'scratch-overflow', 'call-indirect'];
const why = r => r === 0 ? 'installed' : r === 0xFFFF ? 'busy' : (REASONS[r] || `reason${r}`);
const hex = v => '0x' + (v >>> 0).toString(16);

// 07e $uc_sig: op | 0F-byte<<8 | ModRM.reg<<16 | prefix<<20 | o16<<28.
const GRP = {
  0x80: ['add', 'or', 'adc', 'sbb', 'and', 'sub', 'xor', 'cmp'], 0xC0: ['rol', 'ror', 'rcl', 'rcr', 'shl', 'shr', 'sal', 'sar'],
  0xF6: ['test', 'test', 'not', 'neg', 'mul', 'imul', 'div', 'idiv'], 0xFE: ['inc', 'dec', 'call', 'callf', 'jmp', 'jmpf', 'push', '?'],
};
const GRPOF = { 0x80: 0x80, 0x81: 0x80, 0x83: 0x80, 0xC0: 0xC0, 0xC1: 0xC0, 0xD0: 0xC0, 0xD1: 0xC0, 0xD2: 0xC0, 0xD3: 0xC0,
  0xF6: 0xF6, 0xF7: 0xF6, 0xFE: 0xFE, 0xFF: 0xFE };
const ONE = {
  0x10: 'adc', 0x11: 'adc', 0x12: 'adc', 0x13: 'adc', 0x14: 'adc', 0x15: 'adc', 0x18: 'sbb', 0x19: 'sbb', 0x1A: 'sbb',
  0x1B: 'sbb', 0x1C: 'sbb', 0x1D: 'sbb', 0x68: 'push imm', 0x6A: 'push imm8', 0x8F: 'pop r/m', 0xA4: 'movsb', 0xA5: 'movsd',
  0xA6: 'cmpsb', 0xA7: 'cmpsd', 0xAA: 'stosb', 0xAB: 'stosd', 0xAC: 'lodsb', 0xAD: 'lodsd', 0xAE: 'scasb', 0xAF: 'scasd',
  0xC2: 'ret imm', 0xC3: 'ret', 0xE8: 'call', 0xC9: 'leave', 0xCC: 'int3', 0x9C: 'pushf', 0x9D: 'popf', 0xA0: 'mov al,moffs',
  0xA1: 'mov eax,moffs', 0xA2: 'mov moffs,al', 0xA3: 'mov moffs,eax', 0xE3: 'jecxz', 0xE2: 'loop', 0xE0: 'loopne', 0xE1: 'loope',
  0x86: 'xchg r/m8', 0x87: 'xchg r/m', 0x6B: 'imul r,imm8', 0x69: 'imul r,imm', 0xC6: 'mov r/m8,imm', 0xC7: 'mov r/m,imm',
  0x8A: 'mov r8,r/m8', 0x8B: 'mov r,r/m', 0x88: 'mov r/m8,r8', 0x89: 'mov r/m,r', 0x8D: 'lea', 0xE9: 'jmp rel32', 0xEB: 'jmp rel8',
  0x98: 'cwde', 0x99: 'cdq', 0xF5: 'cmc', 0xF8: 'clc', 0xF9: 'stc', 0xFC: 'cld', 0xFD: 'std', 0xD7: 'xlat', 0x9E: 'sahf', 0x9F: 'lahf',
  0x0F: '0f', 0x27: 'daa', 0x2F: 'das', 0x37: 'aaa', 0x3F: 'aas',
};
function sigName(sig) {
  const op = sig & 0xFF, b2 = (sig >>> 8) & 0xFF, reg = (sig >>> 16) & 7, pfx = (sig >>> 20) & 0xFF, o16 = (sig >>> 28) & 1;
  let n;
  if (op === 0x0F) {
    if (b2 >= 0x90 && b2 <= 0x9F) n = 'setcc';
    else if (b2 >= 0x40 && b2 <= 0x4F) n = 'cmovcc';
    else if (b2 >= 0x80 && b2 <= 0x8F) n = 'jcc rel32';
    else n = ({ 0xA3: 'bt', 0xAB: 'bts', 0xB3: 'btr', 0xBB: 'btc', 0xBA: `bt* imm /${reg}`, 0xA4: 'shld imm', 0xA5: 'shld cl',
      0xAC: 'shrd imm', 0xAD: 'shrd cl', 0xAF: 'imul r,r/m', 0xB6: 'movzx8', 0xB7: 'movzx16', 0xBE: 'movsx8', 0xBF: 'movsx16',
      0xC8: 'bswap', 0xC9: 'bswap', 0xCA: 'bswap', 0xCB: 'bswap', 0xCC: 'bswap', 0xCD: 'bswap', 0xCE: 'bswap', 0xCF: 'bswap',
      0xBC: 'bsf', 0xBD: 'bsr', 0xB1: 'cmpxchg', 0xC1: 'xadd', 0x31: 'rdtsc', 0xA2: 'cpuid' })[b2] || `0f ${b2.toString(16)}`;
    if (b2 >= 0x60 && b2 <= 0x7F || b2 >= 0xD0) n = `mmx/sse 0f ${b2.toString(16)}`;
  } else if (GRPOF[op] !== undefined) {
    const g = GRPOF[op];
    n = GRP[g][reg] + (op === 0xD2 || op === 0xD3 ? ' cl' : op === 0xD0 || op === 0xD1 ? ' 1' : '');
    n += (op & 1) || op === 0x83 ? '' : '8';
  } else if (op >= 0xD8 && op <= 0xDF) n = `x87 ${op.toString(16)}/${reg}`;
  else if (op >= 0x50 && op <= 0x57) n = 'push r';
  else if (op >= 0x58 && op <= 0x5F) n = 'pop r';
  else if (op >= 0x70 && op <= 0x7F) n = 'jcc rel8';
  else n = ONE[op] || `op ${op.toString(16)}`;
  const p = pfx === 0xF3 ? 'rep ' : pfx === 0xF2 ? 'repne ' : pfx === 0xF0 ? 'lock ' : pfx ? `pfx${pfx.toString(16)} ` : '';
  return p + n + (o16 ? ' (o16)' : '');
}

// ---- read the records ------------------------------------------------------
// Other LOG_I32 users share the channel, so a record is a marker followed by
// exactly four more values; anything else is skipped.
// --thread=N reads cooperative guest thread N's records instead of the main
// thread's (run.js tags those `[i32 TN]`); each thread has its own arena and map.
// It also takes the thread HANDLE run.js's `uop[thread 0x…]: tid=N` summary
// names (0xe1006), which is not the tid; that summary maps one to the other.
const LOG_TEXT = fs.readFileSync(files[0], 'utf8');
const THREAD = (() => {
  const t = flag('thread', null);
  if (t === null || !/^0x/i.test(t)) return t;
  const handle = parseInt(t, 16) >>> 0;
  for (const m of LOG_TEXT.matchAll(/^uop\[thread 0x([0-9a-f]+)\]: tid=(\d+)/mg)) {
    if ((parseInt(m[1], 16) >>> 0) === handle) return m[2];
  }
  console.error(`--thread=${t}: no \`uop[thread ${t}]: tid=N\` summary line in the log; pass the tid`);
  process.exit(1);
})();
const vals = [];
for (const line of LOG_TEXT.split('\n')) {
  // run.js prints them as `[i32] 0x…`; the shared host import as `[LOG_I32]`.
  const m = line.match(/^\[(?:i32|LOG_I32)(?: T(\d+))?\] 0x([0-9a-f]+)/);
  if (!m || (m[1] || null) !== THREAD) continue;
  vals.push(parseInt(m[2], 16) >>> 0);
}
const recs = [];
for (let i = 0; i + 4 < vals.length; i++) {
  if ((vals[i] & 0xFFFF0000) >>> 0 !== 0xC5E50000) continue;
  const k = vals[i] & 0xFFFF;
  // 10-18 (program lifetimes, exits, shape, retries) are read by tools/uop-census-diff.js
  if (k < 1 || k > 18) continue;
  recs.push({ k, a: vals[i + 1], b: vals[i + 2], c: vals[i + 3], d: vals[i + 4] });
  i += 4;
}
if (!recs.length) {
  console.error('no --uop-census records in the log (was the run started with --uop --uop-census?)');
  process.exit(1);
}

// ---- fold per head ---------------------------------------------------------
const heads = new Map();
const head = eip => {
  let h = heads.get(eip);
  if (!h) heads.set(eip, h = { eip, compiles: 0, installs: 0, declines: {}, busy: 0,
    poor: [], writes: 0, live: null, marker: false, last: null, insns: 0, unsup: new Map() });
  return h;
};
let flushes = 0, flushAll = 0;
let hotTable = null;
for (const r of recs) {
  if (r.k === 1) {
    const h = head(r.a);
    if (r.b === 0xFFFF) { h.busy++; continue; }
    h.compiles++;
    // d = 1: the install is a --uop-trace-heads region, not a loop
    if (r.b === 0) { h.installs++; h.insns = r.c; if (r.d === 1) h.traces = (h.traces || 0) + 1; } else h.declines[why(r.b)] = (h.declines[why(r.b)] || 0) + 1;
    h.last = why(r.b);
  } else if (r.k === 2) {
    head(r.a).poor.push({ enters: r.b, blocks: r.c, exit: r.d });
    head(r.a).last = 'poor';
  } else if (r.k === 3) {
    head(r.a).writes++;
  } else if (r.k === 4) {
    flushes++;
  } else if (r.k === 5) {
    flushAll++;
  } else if (r.k === 6) {
    head(r.a).live = { enters: r.b, blocks: r.c };
  } else if (r.k === 7) {
    head(r.a).marker = true;
  } else if (r.k === 8) {
    hotTable = { takeovers: r.a, warm: r.b, probes: r.c };
  } else if (r.k === 9) {
    // an unsupported instruction the scan hit before declining (07e $uc_census_unsup)
    head(r.a).unsup.set(r.c, { sig: r.b, why: r.d });
  }
}
const all = [...heads.values()];

// ---- attribution and disassembly --------------------------------------------
let hist = null, attribute = a => ({ name: '?', va: a });
if (flag('hist', null)) {
  hist = readHist(flag('hist', null));
  attribute = makeAttributor(hist, EXE_BASE);
}
const peCache = new Map();
function peFor(name) {
  if (name === '?') return null;
  if (peCache.has(name)) return peCache.get(name);
  if (name === 'exe' && EXE) {
    const pe = require('../lib/pe').readPE(EXE);
    peCache.set(name, pe);
    return pe;
  }
  if (!PE_DIR) return null;
  let file = null;
  const want = name.toLowerCase();
  for (const f of fs.readdirSync(PE_DIR)) {
    const l = f.toLowerCase();
    if (l === want || l === want.replace(/\.dll$/, '.exe')) file = f;
  }
  let pe = null;
  if (file) { try { pe = require('../lib/pe').readPE(path.join(PE_DIR, file)); } catch (_) { pe = null; } }
  peCache.set(name, pe);
  return pe;
}
let disasmAt = null;
try { ({ disasmAt } = require('./disasm')); } catch (_) { /* optional */ }
function firstInsn(eip) {
  const a = attribute(eip);
  const pe = peFor(a.name);
  if (!pe || !disasmAt) return '';
  const off = pe.va2off(a.va);
  if (off < 0) return '';
  // "0040e20f  3c 5a                        cmp al, 0x5a" -> the mnemonic part
  try { return String(disasmAt(pe.buf, off, a.va, 1)[0] || '').replace(/^\s*[0-9a-f]+\s+(?:[0-9a-f]{2}\s)+\s*/i, '').trim(); }
  catch (_) { return ''; }
}
const where = eip => {
  const a = attribute(eip);
  return a.name === '?' ? hex(eip) : `${a.name}+${hex(a.va)}`;
};

// ---- summary ----------------------------------------------------------------
const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
const compiles = sum(all, h => h.compiles);
const distinct = all.filter(h => h.compiles).length;
const installed = all.filter(h => h.installs);
const poorHeads = all.filter(h => h.poor.length);
const out = [];
const say = s => out.push(s);
say(`records: ${recs.length}   heads seen: ${all.length}`);
say(`compiles: ${compiles} over ${distinct} distinct heads  (repeat compiles: ${compiles - distinct}, ` +
  `${compiles ? (100 * (compiles - distinct) / compiles).toFixed(1) : 0}%)`);
say(`flushes: ${flushes} (of them flush-all, verdicts forgotten: ${flushAll})   busy (lock held): ${sum(all, h => h.busy)}`);
say(`installs: ${sum(all, h => h.installs)} over ${installed.length} heads ` +
  `(traces: ${sum(all, h => h.traces || 0)})   ` +
  `retired poor: ${sum(all, h => h.poor.length)} over ${poorHeads.length} heads   ` +
  `code-write kills: ${sum(all, h => h.writes)}`);
if (hotTable) {
  say(`hot table (512 slots, threshold 256 taken-branch entries): ${hotTable.probes} threshold hits, ` +
    `${hotTable.takeovers} slot takeovers, ${hotTable.warm} of them discarding a count >= 16`);
}
const byWhy = {};
for (const h of all) for (const [w, n] of Object.entries(h.declines)) {
  byWhy[w] = byWhy[w] || { heads: 0, events: 0 };
  byWhy[w].heads++; byWhy[w].events += n;
}
say('declines (distinct heads / events):');
for (const [w, v] of Object.entries(byWhy).sort((a, b) => b[1].heads - a[1].heads)) {
  say(`  ${w.padEnd(20)} ${String(v.heads).padStart(7)} / ${v.events}`);
}
// What cut the scan: each unsupported instruction a declined head's scan hit,
// by opcode form. With --hist a head weighs its threaded block entries in the
// window (hotness), else 1. Head-unsupported names the head's own instruction.
{
  const byForm = new Map();
  const add = (form, why, w, h, a) => {
    let e = byForm.get(form);
    if (!e) byForm.set(form, e = { heads: 0, w3: 0, w4: 0, w1: 0, hw: 0, ex: [] });
    e.heads++; e.hw += w;
    if (why === 3) e.w3 += w; else if (why === 4) e.w4 += w; else e.w1 += w;
    if (e.ex.length < 3) e.ex.push(a);
  };
  let hitsOf = () => 1;
  if (flag('hist', null)) {
    const hm = new Map(readHist(flag('hist', null)).blocks.map(([hx, n]) => [parseInt(hx, 16) >>> 0, n]));
    hitsOf = e => hm.get(e) || 0;
  }
  let any = false;
  for (const h of all) {
    if (!h.unsup.size) continue;
    any = true;
    // a head counts once per form, however many instances its scan hit
    const seen = new Set();
    for (const [a, u] of h.unsup) {
      const f = sigName(u.sig);
      if (seen.has(f)) continue;
      seen.add(f);
      add(f, u.why, hitsOf(h.eip), h, a);
    }
  }
  if (any) {
    const W = flag('hist', null) ? 'block entries at the head' : 'heads';
    say(`unsupported instructions in declined scans, by form (weight = ${W}; hu = head-unsupported, nb = no-backedge):`);
    const rowsU = [...byForm.entries()].sort((a, b) => b[1].hw - a[1].hw || b[1].heads - a[1].heads);
    for (const [f, e] of rowsU.slice(0, TOP)) {
      say(`  ${f.padEnd(24)} heads=${String(e.heads).padStart(5)}  w=${String(e.hw).padStart(10)}  ` +
        `hu=${e.w3} nb=${e.w4} scan=${e.w1}  e.g. ${e.ex.map(where).join(' ')}`);
    }
  }
}
const recompile = {};
for (const h of all) if (h.compiles) recompile[Math.min(h.compiles, 10)] = (recompile[Math.min(h.compiles, 10)] || 0) + 1;
say('compiles per head: ' + Object.entries(recompile).map(([n, c]) => `${n === '10' ? '10+' : n}x=${c}`).join('  '));
// The verdict map is 2048 two-way sets, and a head only recompiles once its
// set stopped naming it: other heads installed or were marked there. So a
// repeat compile on a head that shares its set with another compiled head is
// map aliasing, not a verdict that changed. `$uop_map_set` is the index.
const vslot = e => ((e ^ (e >>> 12)) & 2047) >>> 0;
const bySlot = new Map();
for (const h of all) if (h.compiles) bySlot.set(vslot(h.eip), (bySlot.get(vslot(h.eip)) || []).concat([h]));
let aliasRepeats = 0, aliasSlots = 0;
for (const hs of bySlot.values()) {
  if (hs.length < 2) continue;
  aliasSlots++;
  aliasRepeats += sum(hs, h => h.compiles - 1);
}
say(`verdict-map aliasing: ${aliasSlots} slots hold 2+ compiled heads; ` +
  `${aliasRepeats} of ${compiles - distinct} repeat compiles are on those heads`);
for (const h of all) h.slotMates = (bySlot.get(vslot(h.eip)) || []).filter(o => o !== h);

// Poor programs: trips per entry, and where they left.
if (poorHeads.length) {
  const bpe = poorHeads.map(h => { const p = h.poor[h.poor.length - 1]; return p.blocks / Math.max(1, p.enters); });
  bpe.sort((a, b) => a - b);
  const q = f => bpe[Math.min(bpe.length - 1, Math.floor(f * bpe.length))].toFixed(2);
  say(`poor programs, blocks per entry: p10 ${q(0.1)}  p50 ${q(0.5)}  p90 ${q(0.9)}`);
  const exits = {};
  for (const h of poorHeads) {
    const d = (h.poor[h.poor.length - 1].exit - h.eip) | 0;
    const b = d <= 0 ? 'before head' : d < 16 ? '+1..15' : d < 64 ? '+16..63' : d < 256 ? '+64..255' : '+256..';
    exits[b] = (exits[b] || 0) + 1;
  }
  say('poor programs, exit EIP relative to head: ' + Object.entries(exits).map(([k, v]) => `${k}=${v}`).join('  '));
}

// ---- coverage against a histogram window ----------------------------------
const verdict = h => !h ? 'no-verdict' : h.live ? 'live' : h.poor.length ? 'poor'
  : Object.keys(h.declines).length ? `declined:${h.last}` : h.last || 'seen';
const rows = [];
if (hist) {
  const total = hist.blockHits || sum(hist.blocks, b => b[1]);
  const byVerdict = {};
  for (const [hx, hits] of hist.blocks) {
    const eip = parseInt(hx, 16) >>> 0;
    const v = verdict(heads.get(eip));
    byVerdict[v] = (byVerdict[v] || 0) + hits;
    rows.push({ eip, hits, v });
  }
  say(`\nhistogram window ${hist.window ? `${hist.window.start}..${hist.window.stop}` : ''}: ` +
    `${total} threaded block entries (top ${hist.blocks.length} blocks listed = ` +
    `${(100 * sum(hist.blocks, b => b[1]) / total).toFixed(1)}%)`);
  // A block with no verdict either never ended a taken branch (a fallthrough
  // or a call-return landing: never counted at all), or it shares one of the
  // 512 hot slots with another hot target and keeps losing its count. The
  // histogram cannot tell which; it can say how many share a slot.
  const slot = e => (e >>> 2) & 511;
  const slotHits = new Map();
  for (const [hx, hits] of hist.blocks) {
    const e = parseInt(hx, 16) >>> 0;
    slotHits.set(slot(e), (slotHits.get(slot(e)) || []).concat([[e, hits]]));
  }
  let noVerdict = 0, contested = 0;
  for (const [hx, hits] of hist.blocks) {
    const e = parseInt(hx, 16) >>> 0;
    if (heads.get(e)) continue;
    noVerdict += hits;
    if (slotHits.get(slot(e)).length > 1) contested += hits;
  }
  say(`no-verdict entries in a hot slot shared with another listed block: ` +
    `${(100 * contested / total).toFixed(1)}% of the window (of ${(100 * noVerdict / total).toFixed(1)}% no-verdict)`);
  say('entries NOT taken by the tier, by the verdict on that block as a head:');
  for (const [v, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
    say(`  ${v.padEnd(28)} ${(100 * n / total).toFixed(1).padStart(5)}%`);
  }
  say(`\ntop ${TOP} threaded blocks:`);
  for (const r of rows.slice(0, TOP)) {
    const h = heads.get(r.eip);
    const extra = h && h.poor.length
      ? ` (${h.poor.length}x poor, last ${h.poor[h.poor.length - 1].blocks}/${h.poor[h.poor.length - 1].enters} ` +
        `blk/entry, exit ${where(h.poor[h.poor.length - 1].exit)})` : '';
    say(`  ${(100 * r.hits / total).toFixed(2).padStart(6)}%  ${where(r.eip).padEnd(26)} ${r.v.padEnd(28)} ` +
      `${h ? `c=${h.compiles}` : ''}${extra}  ${firstInsn(r.eip)}`);
  }
}

// Heads that were compiled the most: the churn, by name.
say(`\nmost-recompiled heads:`);
for (const h of all.filter(x => x.compiles > 1).sort((a, b) => b.compiles - a.compiles).slice(0, TOP)) {
  say(`  ${String(h.compiles).padStart(4)}x  ${where(h.eip).padEnd(26)} ${verdict(h).padEnd(24)} ` +
    `poor=${h.poor.length} installs=${h.installs}  ${firstInsn(h.eip)}` +
    (h.slotMates.length ? `  [slot shared with ${h.slotMates.slice(0, 3).map(o => `${where(o.eip)} ${o.compiles}x`).join(', ')}]` : ''));
}
// The live programs that did the work.
const live = all.filter(h => h.live).sort((a, b) => b.live.blocks - a.live.blocks);
say(`\nlive programs at exit: ${live.length}, blocks run in them (since their last install): ` +
  `${sum(live, h => h.live.blocks)}`);
for (const h of live.slice(0, TOP)) {
  say(`  ${String(h.live.blocks).padStart(11)} blk  ${String(h.live.enters).padStart(9)} ent  ` +
    `${(h.live.blocks / Math.max(1, h.live.enters)).toFixed(1).padStart(7)} blk/ent  ${where(h.eip).padEnd(26)} ` +
    `insns=${h.insns}  ${firstInsn(h.eip)}`);
}

if (argv.includes('--json')) {
  // slotMates points heads at each other (a cycle) and unsup is a Map: flatten both.
  console.log(JSON.stringify({ heads: all, flushes, flushAll, rows }, (k, v) =>
    k === 'slotMates' ? v.map(o => o.eip) : v instanceof Map ? [...v] : v));
} else {
  console.log(out.join('\n'));
}
