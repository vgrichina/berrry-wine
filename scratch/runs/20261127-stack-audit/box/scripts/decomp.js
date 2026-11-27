#!/usr/bin/env node
'use strict';
// tl;dr: decomposition table for the compiled-tier x fold lanes.
//   node decomp.js results.jsonl... [--md]
// Per app: each arm's median instructions:u, cycles:u, user CPU and per-window
// user+sys CPU, as a delta vs dA (all off), with the null band |dA2 - dA| and
// the dA spread; then the marginal gain of each layer on top of the others
// (pairs below); then the ledger counts that explain overlap (uop compiled,
// enters, blocks; GM fold varscan/inst hits; Delphi native/fallback).
const fs = require('fs');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const rows = files.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)))
  .filter(r => /^d/.test(r.arm));
const med = v => { const s = v.filter(x => x != null).sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const spread = v => { const s = v.filter(x => x != null); const m = med(s); return s.length > 1 && m ? (Math.max(...s) - Math.min(...s)) / m * 100 : null; };
const pct = (a, b) => (a == null || b == null || !b) ? null : (a - b) / b * 100;
const f = x => x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(1) + '%';
const NAMES = { dA: 'A all off', dA2: 'A null', dB: 'B Delphi', dC: 'C GM', dD: 'D uop', dE: 'E Delphi+GM', dF: 'F uop+Delphi',
  dG: 'G uop+Delphi+GM', dDs: 'D uop +SSE', dGs: 'G full +SSE', dZ: 'Z no uop tier, no folds', dZE: 'ZE no uop tier, folds' };
const PAIRS = [['dD', 'dA', 'uop alone'], ['dG', 'dE', 'uop on top of both folds'], ['dF', 'dB', 'uop on top of Delphi'],
  ['dB', 'dA', 'Delphi alone'], ['dF', 'dD', 'Delphi on top of uop'], ['dC', 'dA', 'GM alone'], ['dG', 'dF', 'GM on top of uop+Delphi'],
  ['dE', 'dA', 'both folds, no uop opts'], ['dG', 'dD', 'both folds on top of uop'], ['dA', 'dZ', 'compiled tier (mask 0) vs no tier'],
  ['dE', 'dZE', 'compiled tier (mask 0) on top of folds'], ['dZE', 'dZ', 'folds without the tier'], ['dDs', 'dD', 'SSE on uop'], ['dGs', 'dG', 'SSE on full stack']];
const num = (s, re) => { const m = (s || '').match(re); return m ? +m[1] : null; };
const byApp = new Map();
for (const r of rows) { if (!byApp.has(r.app)) byApp.set(r.app, new Map()); const m = byApp.get(r.app); if (!m.has(r.arm)) m.set(r.arm, []); m.get(r.arm).push(r); }
for (const [app, arms] of byApp) {
  const S = {};
  for (const [arm, rs] of arms) {
    const ok = rs.filter(r => r.code === 0 && r.api != null);
    const nw = Math.max(0, ...ok.map(r => (r.wins || []).length));
    S[arm] = { n: ok.length, failed: rs.length - ok.length, keys: [...new Set(ok.map(r => `${r.api}/${r.batches}/${r.sha}`))],
      ins: med(ok.map(r => r.ins)), cyc: med(ok.map(r => r.cyc)), user: med(ok.map(r => r.user)), userSp: spread(ok.map(r => r.user)), insSp: spread(ok.map(r => r.ins)),
      wins: [...Array(nw).keys()].map(i => med(ok.map(r => r.wins && r.wins[i] ? r.wins[i].user + r.wins[i].sys : null))),
      winSp: [...Array(nw).keys()].map(i => spread(ok.map(r => r.wins && r.wins[i] ? r.wins[i].user + r.wins[i].sys : null))),
      winNames: ok[0] ? (ok[0].wins || []).map(w => `${w.start}..${w.end}`) : [],
      led: ok[0] ? { compiled: num(ok[0].uop, /compiled=(\d+)/), enters: num(ok[0].uop, /enters=(\d+)/), blocks: num(ok[0].uop, /blocks=(\d+)/),
        varscan: num(ok[0].gm, /varscan (\d+)/), inst2b: num(ok[0].gm, /inst2b (\d+)/), inst1: num(ok[0].gm, /inst1 (\d+)/), recarr: num(ok[0].gm, /native=(\d+)/),
        dnative: num(ok[0].delphi, /native=(\d+)/), dfall: num(ok[0].delphi, /fallback=(\d+)/) } : {} };
  }
  const A = S.dA; if (!A) continue;
  const wn = A.winNames;
  console.log(`\n## ${app}  (metric deltas vs A; negative = less work/time)`);
  console.log(`null band |A2-A|: ins ${f(S.dA2 && Math.abs(pct(S.dA2.ins, A.ins)))} cyc ${f(S.dA2 && Math.abs(pct(S.dA2.cyc, A.cyc)))} user ${f(S.dA2 && Math.abs(pct(S.dA2.user, A.user)))} ` +
    wn.map((w, i) => `win[${w}] ${f(S.dA2 && Math.abs(pct(S.dA2.wins[i], A.wins[i])))}`).join(' ') + `; A spread user ${f(A.userSp)} ins ${f(A.insSp)} ` + wn.map((w, i) => `win ${f(A.winSp[i])}`).join(' '));
  console.log(`| arm | n | ins G | Δins | Δcyc | user s | Δuser | ${wn.map(w => `win ${w} s | Δwin`).join(' | ')} | uop compiled/enters | GM varscan/inst2b/inst1 | Delphi native/fallback | key |`);
  console.log(`|---|---|---|---|---|---|---|${wn.map(() => '---|---').join('|')}|---|---|---|---|`);
  for (const arm of Object.keys(NAMES)) {
    const a = S[arm]; if (!a) continue; const L = a.led;
    console.log(`| ${NAMES[arm]} | ${a.n}${a.failed ? ` (+${a.failed} failed)` : ''} | ${(a.ins / 1e9).toFixed(1)} | ${f(pct(a.ins, A.ins))} | ${f(pct(a.cyc, A.cyc))} | ${a.user.toFixed(1)} | ${f(pct(a.user, A.user))} | ` +
      a.wins.map((w, i) => `${w == null ? '-' : w.toFixed(2)} | ${f(pct(w, A.wins[i]))}`).join(' | ') +
      ` | ${L.compiled}/${L.enters} | ${L.varscan ?? '-'}/${L.inst2b ?? '-'}/${L.inst1 ?? '-'} | ${L.dnative ?? '-'}/${L.dfall ?? '-'} | ${a.keys.join(' ')} |`);
  }
  console.log(`\nmarginal (X vs Y):`);
  for (const [x, y, what] of PAIRS) {
    if (!S[x] || !S[y]) continue;
    console.log(`  ${what.padEnd(40)} ${x} vs ${y}: ins ${f(pct(S[x].ins, S[y].ins))} cyc ${f(pct(S[x].cyc, S[y].cyc))} user ${f(pct(S[x].user, S[y].user))} ` +
      wn.map((w, i) => `win[${w}] ${f(pct(S[x].wins[i], S[y].wins[i]))}`).join(' '));
  }
}
