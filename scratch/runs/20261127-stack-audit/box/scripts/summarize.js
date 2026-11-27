#!/usr/bin/env node
'use strict';
// tl;dr: summarize stack-audit sweep results.jsonl files.
//   node summarize.js [--ref=off] [--null=off2] [--json=OUT] results.jsonl...
// Per app, per arm: n, medians of user CPU, instructions:u, cycles:u,
// branch-misses:u, startup-window user, max RSS; spread (max-min)/median.
// Null band per metric = |median(null) - median(ref)| / median(ref), and the
// ref's own spread. Every arm's delta vs ref (and m vs all when both exist).
// Exactness: the set of (API calls, batches, PNG sha) per arm; any app whose
// arms disagree, any failed run (rc != 0 or no Stats line) is listed.
const fs = require('fs');
const arg = (n, d) => { const h = process.argv.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const ref = arg('ref', 'off'), nul = arg('null', 'off2');
const rows = files.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
const med = v => { const s = v.filter(x => x != null).sort((a, b) => a - b); const n = s.length; if (!n) return null; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const spread = v => { const s = v.filter(x => x != null); const m = med(s); return s.length > 1 && m ? (Math.max(...s) - Math.min(...s)) / m : null; };
const pct = (a, b) => (a == null || b == null || !b) ? null : (a - b) / b * 100;
const f1 = x => x == null ? '   -  ' : (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
const METRICS = ['user', 'ins', 'cyc', 'bmiss', 'startUser', 'rssKB'];
const byApp = new Map();
for (const r of rows) { if (!byApp.has(r.app)) byApp.set(r.app, new Map()); const m = byApp.get(r.app); if (!m.has(r.arm)) m.set(r.arm, []); m.get(r.arm).push(r); }
const out = { apps: {} };
for (const [app, arms] of byApp) {
  const o = out.apps[app] = { arms: {}, exact: null, failed: [] };
  const lines = [`== ${app}`];
  for (const [arm, rs] of arms) {
    const ok = rs.filter(r => r.code === 0 && r.api != null);
    for (const r of rs) if (!(r.code === 0 && r.api != null)) o.failed.push(`${r.tag} rc=${r.code} ${r.signal || ''} ${r.crash || ''}`.trim());
    const a = o.arms[arm] = { n: ok.length, keys: [...new Set(ok.map(r => `${r.api}/${r.batches}/${r.sha}`))] };
    for (const k of METRICS) { a[k] = med(ok.map(r => r[k])); a[k + 'Spread'] = spread(ok.map(r => r[k])); }
    a.uop = (ok[0] || {}).uop || ''; a.opt = (ok[0] || {}).opt || ''; a.ladder = (ok[0] || {}).ladder || ''; a.declines = (ok[0] || {}).declines || '';
  }
  const R = o.arms[ref], N = o.arms[nul];
  o.band = {}; for (const k of METRICS) o.band[k] = R && N ? Math.abs(pct(N[k], R[k])) : null;
  const keysets = new Set(Object.values(o.arms).flatMap(a => a.keys));
  o.exact = Object.fromEntries(Object.entries(o.arms).map(([k, a]) => [k, a.keys.join(' | ')]));
  o.divergent = new Set(Object.entries(o.arms).filter(([k]) => k !== 'm').flatMap(([, a]) => a.keys)).size > 1;
  o.mDiffers = o.arms.m && R ? o.arms.m.keys.join() !== R.keys.join() : null;
  lines.push(`   band(|${nul}-${ref}|): user ${f1(o.band.user)} ins ${f1(o.band.ins)} cyc ${f1(o.band.cyc)} bmiss ${f1(o.band.bmiss)} start ${f1(o.band.startUser)}   ${ref} spread user ${f1(R && R.userSpread * 100)} ins ${f1(R && R.insSpread * 100)}`);
  for (const [arm, a] of Object.entries(o.arms)) {
    lines.push(`   ${arm.padEnd(6)} n=${a.n} user ${a.user == null ? '-' : a.user.toFixed(2)}s (${f1(pct(a.user, R && R.user))}) ins ${a.ins == null ? '-' : (a.ins / 1e9).toFixed(3)}G (${f1(pct(a.ins, R && R.ins))}) cyc ${f1(pct(a.cyc, R && R.cyc))} bmiss ${f1(pct(a.bmiss, R && R.bmiss))} start ${f1(pct(a.startUser, R && R.startUser))} rss ${a.rssKB == null ? '-' : (a.rssKB / 1024).toFixed(0)}MB (${f1(pct(a.rssKB, R && R.rssKB))}) spread ${f1(a.userSpread * 100)}/${f1(a.insSpread * 100)}  ${a.keys.join(' | ')}`);
  }
  if (o.arms.all && o.arms.m) lines.push(`   all vs m: user ${f1(pct(o.arms.all.user, o.arms.m.user))} ins ${f1(pct(o.arms.all.ins, o.arms.m.ins))} cyc ${f1(pct(o.arms.all.cyc, o.arms.m.cyc))}`);
  if (o.divergent) lines.push('   !! DIVERGENT across branch arms');
  if (o.mDiffers) lines.push(`   (main module key differs from ${ref})`);
  for (const f of o.failed) lines.push(`   FAILED ${f}`);
  console.log(lines.join('\n'));
}
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
