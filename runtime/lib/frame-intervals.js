'use strict';

// Present-to-present interval statistics: how EVENLY frames arrive, and how
// that cadence lands on a display that refreshes at its own fixed rate.
//
// Average fps hides judder. 60 presents/s of even 16.7ms intervals and 60/s
// alternating 5/28ms both report "60", and against a 60 Hz display the second
// one shows some refreshes twice and skips frames at others. The two numbers
// here that answer "does it look smooth" are the spread of the intervals
// (p90/p99, share over 1.5x the median) and the refresh census: of the
// display refreshes the run spans, how many had no new frame (a repeat, the
// eye sees a hitch) and how many had two or more (a frame nobody saw).
//
// The display phase is unknown to a headless run, so `refreshCensus` averages
// the census over several phases of the refresh grid; a browser run that has
// real rAF timestamps should use `rafCensus` instead, which is the census
// against the refreshes that actually happened.
//
// Used by test/run.js --frame-stats, tools/pace-intervals.js (browser probe
// output) and test/test-present-pace-modes.js.

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function intervalsOf(times) {
  const iv = [];
  for (let i = 1; i < times.length; i++) iv.push(times[i] - times[i - 1]);
  return iv;
}

// Census of `times` against a refresh grid of `hz`, averaged over `phases`
// evenly spaced grid offsets. Returns shares of refresh slots with 0, 1 and
// 2+ new frames, over the slots between the first and last frame.
function refreshCensus(times, hz = 60, phases = 8) {
  if (times.length < 2) return null;
  const period = 1000 / hz;
  let zero = 0, one = 0, multi = 0, slots = 0;
  for (let k = 0; k < phases; k++) {
    const off = (k / phases) * period;
    const first = Math.floor((times[0] - off) / period);
    const last = Math.floor((times[times.length - 1] - off) / period);
    const counts = new Map();
    for (const t of times) {
      const s = Math.floor((t - off) / period);
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    for (let s = first + 1; s < last; s++) {
      const c = counts.get(s) || 0;
      if (c === 0) zero++; else if (c === 1) one++; else multi++;
      slots++;
    }
  }
  if (!slots) return null;
  return { hz, slots: slots / phases, zero: zero / slots, one: one / slots, multi: multi / slots };
}

// Census against real refresh timestamps: for each rAF interval, how many
// guest frames completed inside it. `exclude` is a list of [from, to] ms
// ranges whose refreshes are left out (e.g. the frames around an overrun, to
// see what the cadence does between them).
function rafCensus(frameTimes, rafTimes, exclude = null) {
  if (frameTimes.length < 2 || rafTimes.length < 3) return null;
  let zero = 0, one = 0, multi = 0, slots = 0, j = 0;
  const lo = frameTimes[0], hi = frameTimes[frameTimes.length - 1];
  for (let i = 1; i < rafTimes.length; i++) {
    const a = rafTimes[i - 1], b = rafTimes[i];
    if (a < lo || b > hi) continue;
    if (exclude && exclude.some(([x, y]) => b > x && a < y)) continue;
    while (j < frameTimes.length && frameTimes[j] < a) j++;
    let c = 0, k = j;
    while (k < frameTimes.length && frameTimes[k] < b) { c++; k++; }
    if (c === 0) zero++; else if (c === 1) one++; else multi++;
    slots++;
  }
  if (!slots) return null;
  return { slots, zero: zero / slots, one: one / slots, multi: multi / slots };
}

function summarize(times, opts = {}) {
  const iv = intervalsOf(times);
  if (iv.length < 2) return { frames: times.length, intervals: iv.length };
  const s = iv.slice().sort((a, b) => a - b);
  const med = percentile(s, 0.5);
  const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
  const sd = Math.sqrt(iv.reduce((a, b) => a + (b - mean) * (b - mean), 0) / iv.length);
  // Frame-to-frame change: a cadence that swings 10ms->24ms->10ms is what the
  // eye reads as stutter even when the spread of the whole run looks modest.
  let dsum = 0;
  for (let i = 1; i < iv.length; i++) dsum += Math.abs(iv[i] - iv[i - 1]);
  return {
    frames: times.length,
    intervals: iv.length,
    fps: 1000 / mean,
    mean, sd,
    p10: percentile(s, 0.1), p50: med, p90: percentile(s, 0.9), p99: percentile(s, 0.99), max: s[s.length - 1],
    over15: iv.filter(x => x > 1.5 * med).length / iv.length,
    meanAbsDelta: dsum / (iv.length - 1),
    census: refreshCensus(times, opts.hz || 60),
    raf: opts.raf ? rafCensus(times, opts.raf) : null,
  };
}

function format(r, label = '') {
  if (!r || r.intervals < 2) return `${label}too few frames (${r ? r.frames : 0})`;
  const f = x => x.toFixed(1);
  const pc = x => (100 * x).toFixed(1) + '%';
  let out = `${label}${r.frames} frames ${f(r.fps)}/s  interval ms p10 ${f(r.p10)} p50 ${f(r.p50)} p90 ${f(r.p90)} p99 ${f(r.p99)} max ${f(r.max)}`
    + `  sd ${f(r.sd)}  |d| ${f(r.meanAbsDelta)}  >1.5x median ${pc(r.over15)}`;
  if (r.census) {
    out += `\n${' '.repeat(label.length)}vs ${r.census.hz} Hz grid: refreshes with 0 new frames ${pc(r.census.zero)},`
      + ` 1 ${pc(r.census.one)}, 2+ ${pc(r.census.multi)}`;
  }
  if (r.raf) {
    out += `\n${' '.repeat(label.length)}vs real rAF (${r.raf.slots} refreshes): 0 new ${pc(r.raf.zero)},`
      + ` 1 ${pc(r.raf.one)}, 2+ ${pc(r.raf.multi)}`;
  }
  return out;
}

module.exports = { summarize, format, refreshCensus, rafCensus, intervalsOf, percentile };
