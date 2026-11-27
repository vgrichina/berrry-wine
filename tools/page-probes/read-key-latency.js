// Read back the timeline armed by arm-key-latency.js, plus the WinePerf
// snapshot for the same moment. Thumbnails are kept only for frames from
// 400 ms before to 1.2 s after a key event, which is what the report reads; the
// rest of the frames keep their timestamps. Analyse with
// tools/key-latency-report.js.
(function () {
  const log = window.__keyLatency;
  if (!log) return { error: 'not armed' };
  const near = t => log.keys.some(k => t >= k.t - 400 && t <= k.t + 1200);
  let snapshot = null;
  try { snapshot = window.WinePerf && window.WinePerf.snapshot ? window.WinePerf.snapshot() : null; } catch (_) {}
  return {
    startedAt: log.startedAt, now: performance.now(), threads: !!(window.wine && window.wine.guestWorker),
    keys: log.keys, enq: log.enq || [], deq: log.deq, paints: log.paints, polls: log.polls || [], dropped: log.dropped, thumbError: log.thumbError || null,
    frames: log.frames.map(f => ({ t: f.t, cost: f.cost, luma: near(f.t) ? f.luma : null })),
    snapshot,
  };
})()
