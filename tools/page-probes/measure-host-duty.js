// Where the page's wall clock goes in a cooperative run: guest slice
// (wasm), the rest of the host step, and the gap between steps where the
// page is not running the guest at all (event loop: rAF, compositing, input,
// timers, GC). Answers "is the guest slower, or is it simply not running?".
//   eval:window.__hostDuty={ms:8000}
//   evalfile:tools/page-probes/measure-host-duty.js
// Wraps three WineAssembly methods on the live instance for the window and
// restores them afterwards: _beginGuestTickBatch (first call of every step),
// _runCooperativeSlice (the guest's main-thread run), _presentAtBoundary,
// and _scheduleStep (the last call of every step, with its sleep request).
// Cooperative mode only; with Threads the guest runs in a Worker.
(async function () {
  const want = window.__hostDuty || {};
  const ms = want.ms || 8000;
  const wine = window.wine;
  if (!wine) return 'no wine';
  if (wine.guestWorker) return 'threads: guest runs in a Worker, not measured here';
  const now = () => performance.now();
  const st = {
    steps: 0, stepMs: 0, sliceMs: 0, slices: 0, sliceBlocks: 0, deadlineHits: 0,
    presentMs: 0, gapMs: 0, gaps: [], sleeps: 0, sleepReqMs: 0, stepMsList: [],
  };
  let stepStart = 0, lastEnd = 0;
  const orig = {};
  const wrap = (name, fn) => { orig[name] = wine[name]; wine[name] = fn(orig[name]); };
  wrap('_beginGuestTickBatch', o => function (...a) {
    const t = now();
    if (lastEnd) { const g = t - lastEnd; st.gapMs += g; st.gaps.push(g); }
    stepStart = t;
    return o.apply(this, a);
  });
  wrap('_runCooperativeSlice', o => function (...a) {
    const t = now();
    const r = o.apply(this, a);
    st.sliceMs += now() - t; st.slices++;
    if (r) { st.sliceBlocks += r.blocks || 0; if (r.hitDeadline) st.deadlineHits++; }
    return r;
  });
  wrap('_presentAtBoundary', o => function (...a) {
    const t = now();
    const r = o.apply(this, a);
    st.presentMs += now() - t;
    return r;
  });
  wrap('_scheduleStep', o => function (step, delayMs) {
    const t = now();
    if (stepStart) { const d = t - stepStart; st.steps++; st.stepMs += d; st.stepMsList.push(d); stepStart = 0; }
    if (delayMs > 0) { st.sleeps++; st.sleepReqMs += delayMs; }
    lastEnd = t;
    return o.apply(this, arguments);
  });
  const ex = wine.instance.exports;
  const frames0 = ex.gps_stat_frames ? ex.gps_stat_frames() >>> 0 : 0;
  // Page frames (rAF) during the window, for the compositor's own cadence.
  let rafs = 0, rafOn = true;
  const raf = () => { rafs++; if (rafOn) requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  const t0 = now();
  await new Promise(r => setTimeout(r, ms));
  const t1 = now();
  rafOn = false;
  for (const k of Object.keys(orig)) wine[k] = orig[k];
  const frames = ex.gps_stat_frames ? ((ex.gps_stat_frames() >>> 0) - frames0) >>> 0 : null;
  const wall = t1 - t0;
  const pct = v => Math.round(v / wall * 1000) / 10;
  const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 100) / 100; };
  return {
    wallMs: Math.round(wall), guestPresents: frames,
    guestPresentsPerSec: frames == null ? null : Math.round(frames / wall * 10000) / 10,
    rafPerSec: Math.round(rafs / wall * 10000) / 10,
    steps: st.steps, slices: st.slices, sliceBlocks: st.sliceBlocks, deadlineHits: st.deadlineHits,
    pctSlice: pct(st.sliceMs), pctPresent: pct(st.presentMs),
    pctStepOther: pct(st.stepMs - st.sliceMs - st.presentMs), pctGap: pct(st.gapMs),
    sleeps: st.sleeps, sleepReqMs: st.sleepReqMs,
    stepMs: { p50: q(st.stepMsList, 0.5), p95: q(st.stepMsList, 0.95), max: q(st.stepMsList, 1) },
    gapMs: { p50: q(st.gaps, 0.5), p95: q(st.gaps, 0.95), max: q(st.gaps, 1) },
    sliceMsPerPresent: frames ? Math.round(st.sliceMs / frames * 100) / 100 : null,
    blocksPerPresent: frames ? Math.round(st.sliceBlocks / frames) : null,
  };
})()
