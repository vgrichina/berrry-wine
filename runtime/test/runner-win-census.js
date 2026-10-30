'use strict';
// --uop-win-census report (src/07d-uop-engine.wat $uwc_*, docs/uop-tier-design.md
// "Contiguity census"). Two halves:
//
//   1. the counters the WAT kept: every uop window proof by the memory it
//      landed on and why failures failed, each re-guard classified against its
//      slot's previous window (would a wider window -- with the backing as it
//      is, or with the reservation's backing made contiguous -- have covered
//      it?), and the sparse $g2w_affine_span fallbacks bulk paths asked for;
//   2. the allocator's state at exit, read straight out of VIRTUAL_MAP_TABLE /
//      VIRTUAL_RESERVE_TABLE: is each live reservation's committed backing one
//      affine run, and how fragmented is the 316MB primary pool.
//
// Counters are load-immune, so one run per app is the census.

const { REGIONS } = require('../lib/region-map.generated');

const CLASS = ['calls', 'direct', 'DIB', 'sparse1', 'sparseN', 'unmapped0', 'wrap',
  'unmappedN', 'NONADJ', 'rw-code', 'straddle', 'len0', 'off-window'];

function pct(n, d) { return d ? `${(100 * n / d).toFixed(2)}%` : '-'; }

function reportCounters(x, log) {
  const c = (k) => x.uop_win_census(k);
  for (const [ctx, name] of [[0, 'guard'], [1, 'reguard']]) {
    const base = ctx * 16;
    const calls = c(base);
    const parts = CLASS.slice(1).map((n, i) => [n, c(base + 1 + i)]).filter(([, v]) => v)
      .map(([n, v]) => `${n}=${v} (${pct(v, calls)})`);
    log(`uop-win ${name}: calls=${calls} ${parts.join(' ')}`);
  }
  for (const [k, name] of [[1, 'direct'], [2, 'DIB'], [3, 'sparse']]) {
    const b = 32 + (k - 1) * 8;
    const n = c(b);
    if (!n) continue;
    log(`uop-win reguard after a ${name} window: n=${n} next-page=${c(b + 1)} (${pct(c(b + 1), n)}) ` +
      `in-affine-run=${c(b + 2)} (${pct(c(b + 2), n)}) ` +
      `needs-contiguous-backing=${c(b + 3)} (${pct(c(b + 3), n)}) ` +
      `other-alloc=${c(b + 4)} (${pct(c(b + 4), n)}) elsewhere=${c(b + 5)} (${pct(c(b + 5), n)})`);
  }
  const sp = c(60);
  log(`uop-win reguard with no previous window: ${c(56)}  shadow evictions: ${c(57)}  ` +
    `sparse proofs=${sp} mean affine run=${sp ? (c(58) / sp).toFixed(1) : '-'} pages ` +
    `mean committed run=${sp ? (c(59) / sp).toFixed(1) : '-'} pages (each side capped at 256)`);
  const bc = c(64);
  log(`bulk g2w_affine_span sparse: calls=${bc} ok=${c(65)} (${pct(c(65), bc)}, ${c(71)} bytes) ` +
    `unmapped0=${c(66)} wrap=${c(67)} unmappedN=${c(68)} NONADJ=${c(69)} (${pct(c(69), bc)}, ${c(70)} bytes)`);
  const rc = c(76);
  if (rc) {
    const ring = [];
    for (let i = 0; i < Math.min(16, rc); i++) ring.push('0x' + (c(80 + ((rc - 1 - i) & 15)) >>> 0).toString(16));
    log(`uop-win code-page refusals: ${rc} direct=${c(73)} DIB=${c(74)} sparse=${c(75)}  last pages: ${ring.join(' ')}`);
  }
}

function reportAllocator(x, log) {
  const mem = x.memory && x.memory.buffer;
  if (!mem) return;
  const dv = new DataView(mem);
  const u32 = (a) => dv.getUint32(a, true);
  const st = REGIONS.VIRTUAL_MAP_STATE.base;
  const mapT = REGIONS.VIRTUAL_MAP_TABLE.base;
  const resT = REGIONS.VIRTUAL_RESERVE_TABLE.base;
  const pool = REGIONS.VIRTUAL_BACKING_BASE;
  const nMap = u32(st), nRes = u32(st + 16), bump = u32(st + 4) || pool.base, nHoles = u32(st + 12);
  const recs = [];
  for (let i = 0; i < nMap; i++) {
    const a = mapT + i * 16;
    const flags = u32(a + 12);
    if (flags & 0x40000000) continue; // leak-diagnostic marker: not live
    recs.push({ guest: u32(a), size: u32(a + 4), backing: u32(a + 8), flags });
  }
  const res = [];
  for (let i = 0; i < nRes; i++) {
    const a = resT + i * 8;
    res.push({ base: (u32(a) & 0xFFFFF000) >>> 0, size: u32(a + 4) });
  }
  res.sort((p, q) => p.base - q.base);
  // Assign each committed record to its reservation.
  const owned = new Map();
  let orphanRecs = 0, orphanBytes = 0;
  for (const r of recs) {
    let lo = 0, hi = res.length - 1, hit = null;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (res[m].base <= r.guest) { hit = res[m]; lo = m + 1; } else hi = m - 1;
    }
    if (hit && r.guest - hit.base < hit.size) {
      if (!owned.has(hit)) owned.set(hit, []);
      owned.get(hit).push(r);
    } else { orphanRecs++; orphanBytes += r.size; }
  }
  let withCommit = 0, affine = 0, affineBytes = 0, commitBytes = 0, runsTotal = 0, multiBytes = 0;
  const worst = [];
  for (const [rv, rs] of owned) {
    rs.sort((p, q) => p.guest - q.guest);
    withCommit++;
    let bytes = 0, runs = 0, prev = null;
    const delta0 = rs[0].backing - rs[0].guest;
    let isAffine = true;
    for (const r of rs) {
      bytes += r.size;
      if (r.backing - r.guest !== delta0) isAffine = false;
      if (!prev || prev.guest + prev.size !== r.guest || prev.backing + prev.size !== r.backing) runs++;
      prev = r;
    }
    commitBytes += bytes; runsTotal += runs;
    if (isAffine) { affine++; affineBytes += bytes; } else multiBytes += bytes;
    worst.push({ base: rv.base, size: rv.size, bytes, runs, recs: rs.length });
  }
  worst.sort((p, q) => q.runs - p.runs);
  log(`alloc: map records live=${recs.length} reservations=${nRes} with-commit=${withCommit} ` +
    `committed=${(commitBytes / 1048576).toFixed(1)}MB  one-affine-run=${affine} (${pct(affine, withCommit)} of ` +
    `reservations, ${pct(affineBytes, commitBytes)} of bytes)  runs total=${runsTotal} ` +
    `(mean ${(runsTotal / Math.max(1, withCommit)).toFixed(2)}/reservation)  ` +
    `records outside any reservation=${orphanRecs} (${(orphanBytes / 1048576).toFixed(1)}MB)`);
  for (const w of worst.slice(0, 6)) {
    if (w.runs < 2) break;
    log(`alloc:   0x${w.base.toString(16)} reserve=${(w.size / 1024) | 0}K committed=${(w.bytes / 1024) | 0}K ` +
      `records=${w.recs} backing runs=${w.runs}`);
  }
  // Primary pool fragmentation: live extents below the bump, gaps between them.
  const ext = recs.filter(r => r.backing >= pool.base && r.backing < pool.end)
    .map(r => [r.backing, r.backing + r.size]).sort((p, q) => p[0] - q[0]);
  let cur = pool.base, freeBelow = 0, largest = 0, gaps = 0;
  for (const [b, e] of ext) {
    if (b > cur) { freeBelow += b - cur; largest = Math.max(largest, b - cur); gaps++; }
    cur = Math.max(cur, e);
  }
  const top = Math.max(cur, bump);
  const wild = pool.end - top;
  const used = ext.reduce((s, [b, e]) => s + (e - b), 0);
  log(`alloc: primary pool used=${(used / 1048576).toFixed(1)}MB high-water=+${((top - pool.base) / 1048576).toFixed(1)}MB ` +
    `holes below=${gaps} (${(freeBelow / 1048576).toFixed(2)}MB, largest ${(largest / 1024) | 0}K, hole table ${nHoles}) ` +
    `wilderness=${(wild / 1048576).toFixed(1)}MB  largest free run=${(Math.max(largest, wild) / 1048576).toFixed(1)}MB ` +
    `of ${((freeBelow + wild) / 1048576).toFixed(1)}MB free`);
}

function reportWinCensus(instance, log = console.log) {
  const x = instance.exports;
  if (!x.uop_win_census) { log('uop-win: this build has no census'); return; }
  reportCounters(x, log);
  reportAllocator(x, log);
}

module.exports = { reportWinCensus };
