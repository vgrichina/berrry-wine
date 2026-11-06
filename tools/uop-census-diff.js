#!/usr/bin/env node
'use strict';

// Two --uop-census runs of the same fixed work, joined by head EIP: which
// heads lost (or gained) program entries between arm A and arm B, and why.
//
// Built for docs/uop-tier-design.md §23.7 (does --uop-icall swallow callee
// heads into its callers' traces?), but it only reads census records, so any
// two arms that differ in what the tier compiles can be compared with it.
//
//   node tools/uop-census-diff.js <A.log> <B.log> [--thread=N] [--top=20]
//     [--exe-base=0x400000] [--json=FILE]
//
// Per head, over the whole run (every program the head ever had, not just the
// one live at exit -- 07d kinds 2/3/10/11/12 carry each program's final
// counts): installs, loop or trace, instruction count, enters, blocks, poor
// retirements, code-write and megamorphic kills, cut exits, the dominant exit.
// From 07e kinds 14/15: the calls each program kept (E8 / icall / IAT, with
// target) and the instruction ranges it covers. From 07e kind 17: a compile
// whose calls-followed attempt failed and was retried with calls as the edge,
// with the first attempt's reason -- the verdict a head ends with is the
// retry's (before the section-24 ladder, for a head that is itself a call that
// was always 3). From kind 18: which rung of the ladder ended it.
//
// "Swallowed" means: the head's EIP is an instruction inside some OTHER
// head's program in arm B, that program keeps an icall/IAT site, and the same
// other head's arm-A program(s) did not cover that EIP. That is the §23.6
// hypothesis stated as a test: code that used to be entered as its own
// program now runs inside a caller's program that grew through an icall.

const fs = require('fs');

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const files = argv.filter(a => !a.startsWith('--'));
if (files.length !== 2) {
  console.error('usage: uop-census-diff.js <A.log> <B.log> [--thread=N] [--top=20] [--json=FILE]');
  process.exit(2);
}
const TOP = parseInt(flag('top', '20'), 10);
const THREAD = flag('thread', null);
const RUNG = ['halved', 'icut', 'nocall-head', 'nocall'];
const hex = v => '0x' + (v >>> 0).toString(16);
const M = n => (n / 1e6).toFixed(2) + 'M';

function load(file) {
  const vals = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\[(?:i32|LOG_I32)(?: T(\d+))?\] 0x([0-9a-f]+)/);
    if (!m || (m[1] || null) !== THREAD) continue;
    vals.push(parseInt(m[2], 16) >>> 0);
  }
  const heads = new Map();
  const H = eip => {
    let h = heads.get(eip);
    if (!h) heads.set(eip, h = { eip, compiles: 0, installs: 0, traces: 0, insns: 0, declines: {}, retry: {}, rung: {},
      enters: 0, blocks: 0, work: 0, poor: 0, cw: 0, mega: 0, flushed: 0, liveEnd: 0,
      cuts: 0, exits: new Map(), sites: [], ranges: [], allRanges: [], pendSites: [], pendRanges: [],
      progs: [] });
    return h;
  };
  let lastProg = null;
  const prog = (k, a, b, c, d) => {
    const h = H(a);
    h.enters += b; h.blocks += c;
    if (k !== 2 && k !== 3) h.work += d;
    if (k === 2) h.poor++;
    else if (k === 3) h.cw++;
    else if (k === 10) h.flushed++;
    else if (k === 11) h.liveEnd++;
    else if (k === 12) h.mega++;
    lastProg = { h, enters: b, blocks: c, k, sites: h.sites, insns: h.insns, trace: h.lastTrace };
    h.progs.push(lastProg);
  };
  let n = 0;
  for (let i = 0; i + 4 < vals.length; i++) {
    if ((vals[i] & 0xFFFF0000) >>> 0 !== 0xC5E50000) continue;
    const k = vals[i] & 0xFFFF;
    if (k < 1 || k > 18) continue;
    const [a, b, c, d] = [vals[i + 1], vals[i + 2], vals[i + 3], vals[i + 4]];
    i += 4; n++;
    if (k === 1) {
      const h = H(a);
      if (b === 0xFFFF) continue;
      h.compiles++;
      if (b === 0) {
        h.installs++; h.insns = c; h.lastTrace = d === 1;
        if (d === 1) h.traces++;
        h.sites = h.pendSites; h.ranges = h.pendRanges;
        h.allRanges.push(...h.pendRanges);
      } else h.declines[b] = (h.declines[b] || 0) + 1;
      h.pendSites = []; h.pendRanges = [];
    } else if (k === 2 || k === 3 || k === 10 || k === 11 || k === 12) {
      prog(k, a, b, c, d);
    } else if (k === 13) {
      if (lastProg && lastProg.h.eip === a) {
        lastProg.h.cuts += d;
        lastProg.cuts = d;
        if (c > 0) {
          const e = lastProg.h.exits;
          e.set(b, (e.get(b) || 0) + c);
          lastProg.domExit = b; lastProg.domN = c;
        }
      }
    } else if (k === 14) {
      H(a).pendSites.push({ site: b, target: c, cls: d });
    } else if (k === 15) {
      H(a).pendRanges.push([b, c]);
    } else if (k === 17) {
      // the calls-followed attempt failed with reason b and was retried with
      // calls as the region's edge; the kind-1 verdict that follows is the
      // retry's, so a call-headed head reads head-unsupported there
      const h = H(a);
      h.retry[b] = (h.retry[b] || 0) + 1;
    } else if (k === 18) {
      // the attempt that ended the retry ladder: mode b (0 calls followed at
      // a halved span, 1 icall sites cut, 2 nocall keeping the head's call,
      // 3 nocall), final reason c (0 = compiled), span d
      const h = H(a);
      const key = `${RUNG[b] || b}${c ? ':fail' + c : ''}`;
      h.rung[key] = (h.rung[key] || 0) + 1;
    }
  }
  if (!n) { console.error(`${file}: no census records (thread ${THREAD || 'main'})`); process.exit(1); }
  // Programs' shape as of their last install (sites/ranges) -- a program's
  // record carries the sites of the install it came from.
  // Coverage index: sorted ranges -> owning heads, per arm.
  const cover = [];
  for (const h of heads.values()) {
    const seen = new Set();
    for (const [lo, hi] of h.allRanges) {
      const key = lo + ':' + hi;
      if (seen.has(key)) continue;
      seen.add(key);
      cover.push({ lo, hi, h });
    }
  }
  cover.sort((x, y) => x.lo - y.lo);
  return { heads, cover, records: n };
}

function coveredBy(arm, eip) {
  const out = [];
  for (const r of arm.cover) {
    if (r.lo > eip) break;
    if (eip < r.hi && r.h.eip !== eip) out.push(r.h);
  }
  return [...new Set(out)];
}
const inRanges = (h, eip) => !!h && h.allRanges.some(([lo, hi]) => eip >= lo && eip < hi);
const icallSites = h => {
  const s = new Map();
  for (const p of [h.sites, ...h.progs.map(p => p.sites)]) for (const x of p || []) if (x.cls) s.set(x.site, x);
  return [...s.values()];
};

const A = load(files[0]);
const B = load(files[1]);
const keys = new Set([...A.heads.keys(), ...B.heads.keys()]);
const Z = { enters: 0, blocks: 0, installs: 0, poor: 0, mega: 0, cw: 0, insns: 0, traces: 0, cuts: 0, progs: [], allRanges: [], compiles: 0, declines: {} };
const rows = [];
for (const eip of keys) {
  const a = A.heads.get(eip) || Z, b = B.heads.get(eip) || Z;
  const row = { eip, a, b, dEnt: b.enters - a.enters, dBlk: b.blocks - a.blocks };
  // who in B runs this head's instruction inside their own program
  const cov = coveredBy(B, eip);
  row.coveredB = cov;
  row.swallowers = cov.filter(p => icallSites(p).length && !inRanges(A.heads.get(p.eip), eip));
  row.newCoverB = cov.filter(p => !inRanges(A.heads.get(p.eip), eip));
  rows.push(row);
}
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const tot = arm => ({
  enters: sum([...arm.heads.values()], h => h.enters), blocks: sum([...arm.heads.values()], h => h.blocks),
  installs: sum([...arm.heads.values()], h => h.installs), poor: sum([...arm.heads.values()], h => h.poor),
  mega: sum([...arm.heads.values()], h => h.mega), cw: sum([...arm.heads.values()], h => h.cw),
  traces: sum([...arm.heads.values()], h => h.traces), cuts: sum([...arm.heads.values()], h => h.cuts),
  heads: [...arm.heads.values()].filter(h => h.installs).length,
  icallProgs: [...arm.heads.values()].filter(h => icallSites(h).length).length,
});
const ta = tot(A), tb = tot(B);
const out = [];
const say = s => out.push(s);
say(`arm A ${files[0]}  (${A.records} records)\narm B ${files[1]}  (${B.records} records)   thread ${THREAD || 'main'}`);
for (const k of Object.keys(ta)) say(`  ${k.padEnd(10)} A ${String(ta[k]).padStart(12)}   B ${String(tb[k]).padStart(12)}   ` +
  `delta ${String(tb[k] - ta[k]).padStart(12)}`);

// decl:F<-R = declined with F after the calls-followed attempt failed with R
const retried = h => Object.keys(h.retry || {}).length ? '<-' + Object.keys(h.retry).join('/') : '';
const kind = h => !h.installs ? (Object.keys(h.declines).length ? `decl:${Object.keys(h.declines).join('/')}${retried(h)}` : '-')
  : `${h.traces === h.installs ? 'trace' : h.traces ? 'mixed' : 'loop'}/${h.insns}`;
// A call-headed head whose calls-followed compile failed: the retry makes its
// own E8 unsupported, so it can only come back head-unsupported (3).
const callHeadRetry = r => r.a.installs && !r.b.installs && r.b.declines[3] && Object.keys(r.b.retry || {}).length;
const who = r => r.swallowers.length ? r.swallowers.map(p => hex(p.eip)).slice(0, 2).join(',')
  : r.newCoverB.length ? '(' + r.newCoverB.map(p => hex(p.eip)).slice(0, 2).join(',') + ')' : '';
const line = r => `  ${hex(r.eip).padEnd(11)} ${M(r.a.enters).padStart(8)} -> ${M(r.b.enters).padStart(8)}  ` +
  `blk ${M(r.a.blocks).padStart(8)} -> ${M(r.b.blocks).padStart(8)}  inst ${r.a.installs}/${r.b.installs}  ` +
  `${kind(r.a).padEnd(14)} ${kind(r.b).padEnd(14)} poor ${r.a.poor}/${r.b.poor} mega ${r.a.mega}/${r.b.mega} ` +
  `ic ${icallSites(r.b).length}  ${who(r)}`;
say(`\ntop ${TOP} heads by LOST enters (A -> B; kind = loop|trace/insns; last column = arm-B program(s) newly covering this EIP, ` +
  `bare = it keeps an icall site, (..) = no icall site):`);
const losers = rows.filter(r => r.dEnt < 0).sort((x, y) => x.dEnt - y.dEnt);
for (const r of losers.slice(0, TOP)) say(line(r));
say(`\ntop ${TOP} heads by GAINED enters:`);
const gainers = rows.filter(r => r.dEnt > 0).sort((x, y) => y.dEnt - x.dEnt);
for (const r of gainers.slice(0, TOP)) say(line(r));
say(`\ntop ${TOP} heads by LOST blocks (work run inside programs):`);
for (const r of rows.filter(r => r.dBlk < 0).sort((x, y) => x.dBlk - y.dBlk).slice(0, TOP)) say(line(r));
say(`\ntop ${TOP} heads by GAINED blocks:`);
for (const r of rows.filter(r => r.dBlk > 0).sort((x, y) => y.dBlk - x.dBlk).slice(0, TOP)) say(line(r));

// ---- attribution of the enter and block change ------------------------------
const cls = r => {
  if (callHeadRetry(r)) return '0 call head: calls-followed failed, retry declines';
  if (r.swallowers.length) return 'a swallowed (inside an icall caller in B)';
  if (r.b.poor > r.a.poor) return 'b killed poor in B';
  if (r.b.mega > 0) return 'c mega-killed in B';
  if (r.a.installs && !r.b.installs) return 'd lost install (other)';
  if (r.newCoverB.length) return 'e inside another B program (no icall site)';
  if (!r.a.installs && r.b.installs) return 'f new in B';
  return 'g same program set, fewer/more entries';
};
for (const [what, key] of [['enters', 'dEnt'], ['blocks', 'dBlk']]) {
  const by = {};
  for (const r of rows) {
    const c = cls(r);
    by[c] = by[c] || { lost: 0, gained: 0, nl: 0, ng: 0 };
    if (r[key] < 0) { by[c].lost += r[key]; by[c].nl++; } else if (r[key] > 0) { by[c].gained += r[key]; by[c].ng++; }
  }
  say(`\n${what} change by class (lost over N heads / gained over N heads / net):`);
  for (const [c, v] of Object.entries(by).sort()) {
    say(`  ${c.padEnd(46)} ${M(v.lost).padStart(9)} /${String(v.nl).padStart(5)}   +${M(v.gained).padStart(8)} /${String(v.ng).padStart(5)}   net ${M(v.lost + v.gained)}`);
  }
}

// ---- calls-followed failures (07e kind 17), by the first attempt's reason ----
for (const [name, arm] of [['A', A], ['B', B]]) {
  const by = {};
  for (const h of arm.heads.values()) for (const [why, n] of Object.entries(h.retry)) by[why] = (by[why] || 0) + n;
  say(`${name === 'A' ? '\n' : ''}calls-followed failures retried with calls as the edge, arm ${name} (reason: count): ` +
    (Object.entries(by).map(([w, n]) => `${w}:${n}`).join(' ') || 'none'));
}
// ---- which rung ended each ladder (07e kind 18) -------------------------------
for (const [name, arm] of [['A', A], ['B', B]]) {
  const by = {};
  for (const h of arm.heads.values()) for (const [r, n] of Object.entries(h.rung)) by[r] = (by[r] || 0) + n;
  say(`ladder endings, arm ${name} (mode[:failREASON]: count): ` +
    (Object.entries(by).sort().map(([w, n]) => `${w}:${n}`).join(' ') || 'none'));
}

// ---- icall-bearing programs in B: what they became ---------------------------
const ic = [...B.heads.values()].filter(h => icallSites(h).length).sort((x, y) => y.enters - x.enters);
say(`\narm-B programs keeping an icall/IAT site: ${ic.length}; top ${TOP} by enters ` +
  `(A enters/blocks of the same head, B enters/blocks, B cut exits, dominant exit):`);
for (const h of ic.slice(0, TOP)) {
  const a = A.heads.get(h.eip) || Z;
  const dom = [...h.exits.entries()].sort((x, y) => y[1] - x[1])[0];
  const swal = rows.filter(r => r.swallowers.includes(h));
  say(`  ${hex(h.eip).padEnd(11)} A ${M(a.enters)}/${M(a.blocks)} ${kind(a).padEnd(12)} B ${M(h.enters)}/${M(h.blocks)} ${kind(h).padEnd(12)} ` +
    `poor ${h.poor} cuts ${h.cuts} dom ${dom ? `${hex(dom[0])}x${dom[1]}` : '-'}  sites ${icallSites(h).slice(0, 3).map(s => `${hex(s.site)}->${hex(s.target)}`).join(' ')}` +
    (swal.length ? `  swallows ${swal.length} heads (A enters ${M(sum(swal, r => r.a.enters))} -> B ${M(sum(swal, r => r.b.enters))})` : ''));
}

// ---- option A: stop a trace at a guarded call whose target is a hot head ----
// Estimated by: for each swallowed head (class a), assume its own program would
// keep its A-arm entries and blocks, and the caller would keep its A-arm ones.
{
  const sw = rows.filter(r => r.swallowers.length);
  say(`\noption A estimate: ${sw.length} swallowed heads; their enters A ${M(sum(sw, r => r.a.enters))} -> B ${M(sum(sw, r => r.b.enters))}, ` +
    `blocks A ${M(sum(sw, r => r.a.blocks))} -> B ${M(sum(sw, r => r.b.blocks))}`);
  const callers = new Set(sw.flatMap(r => r.swallowers));
  const ca = sum([...callers], h => (A.heads.get(h.eip) || Z).enters), cb = sum([...callers], h => h.enters);
  const ba = sum([...callers], h => (A.heads.get(h.eip) || Z).blocks), bb = sum([...callers], h => h.blocks);
  say(`  their ${callers.size} swallowing callers: enters A ${M(ca)} -> B ${M(cb)}, blocks A ${M(ba)} -> B ${M(bb)}`);
}

console.log(out.join('\n'));
if (flag('json', null)) {
  fs.writeFileSync(flag('json', null), JSON.stringify(rows.map(r => ({
    eip: hex(r.eip), aEnters: r.a.enters, bEnters: r.b.enters, aBlocks: r.a.blocks, bBlocks: r.b.blocks,
    aInstalls: r.a.installs, bInstalls: r.b.installs, aKind: kind(r.a), bKind: kind(r.b), cls: cls(r),
    aPoor: r.a.poor, bPoor: r.b.poor, bRetry: r.b.retry || {}, aRung: r.a.rung || {}, bRung: r.b.rung || {},
    swallowers: r.swallowers.map(p => hex(p.eip)), newCoverB: r.newCoverB.map(p => hex(p.eip)),
  })), null, 1));
}
