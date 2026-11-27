// Wait, inside one evalfile: step, until the guest has made a given amount of
// progress -- for a route whose first input only lands after a long load.
//
// Set the target first with an eval: step (no semicolons needed):
//   eval:window.__waitProgress={blocks:2.12e9,timeoutMs:110000}
//   eval:window.__waitProgress={presentsPerSec:20,timeoutMs:30000}
//   eval:window.__waitProgress={frames:400,timeoutMs:60000}
//
// `blocks` compares get_blocks_now (retired guest blocks: the main instance in
// cooperative mode, the guest Worker's through callExport in Threads mode)
// against the target; it is the right clock for a load measured in the CLI's
// batches. `presentsPerSec` waits for the guest present rate over the last
// second (WinePerf, ?debug&perf). `frames` waits for that many guest presents
// after this step starts: a GameMaker room moves its player per step, not per
// millisecond, so holding a key for N presents walks the same distance at any
// emulation speed. Resolves with what it saw, never throws, so a route that
// times out still reports where it stopped.
(async function () {
  const want = window.__waitProgress || {};
  const t0 = performance.now(), timeout = want.timeoutMs || 60000;
  const wine = window.wine, perf = window.WinePerf;
  // WinePerf.guestFrames is a sliding window; count presents ourselves.
  let seen = 0;
  const orig = perf && perf.guestFrame;
  const mine = function (...a) { seen++; return orig.apply(this, a); };
  if (want.frames && orig) perf.guestFrame = mine;
  const blocks = async () => {
    try {
      // An i32 export: unsigned, since a long load passes 2^31 blocks.
      if (wine.guestWorker && wine.guestWorker.callExport) return Number(await wine.guestWorker.callExport('get_blocks_now')) >>> 0;
      return Number(wine.instance.exports.get_blocks_now()) >>> 0;
    } catch (e) { return NaN; }
  };
  const rate = () => {
    const f = perf && perf.guestFrames, now = performance.now();
    if (!f) return NaN;
    let n = 0;
    for (let i = f.length - 1; i >= 0 && now - f[i] <= 1000; i--) n++;
    return n;
  };
  try {
    for (;;) {
      const b = want.blocks ? await blocks() : NaN, p = rate();
      const done = (want.blocks ? b >= want.blocks : true) && (want.presentsPerSec ? p >= want.presentsPerSec : true)
        && (want.frames ? seen >= want.frames : true);
      const elapsed = performance.now() - t0;
      if (done || elapsed > timeout) {
        return { reached: done, elapsedMs: Math.round(elapsed), blocks: b, presentsPerSec: p, frames: seen };
      }
      await new Promise(r => setTimeout(r, want.frames ? 4 : 250));
    }
  } finally {
    if (want.frames && orig && perf.guestFrame === mine) perf.guestFrame = orig;
  }
})()
