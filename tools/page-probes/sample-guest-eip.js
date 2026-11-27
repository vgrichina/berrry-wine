// Where is the cooperative guest's main thread spending its blocks? Samples
// EIP between page tasks for window.__eipSample.ms (default 8000) and returns
// a histogram. In cooperative mode a guest slice ends when its block budget
// runs out, so a sample taken between slices is block-weighted -- the same
// kind of sample as the CLI's per-batch EIP lines (--trace-from/--trace-to),
// which is what it is meant to be compared with. Cooperative only: a Worker
// guest's EIP is not readable synchronously from the page.
(async function () {
  const want = window.__eipSample || {};
  const ms = want.ms || 8000;
  const ex = window.wine && window.wine.instance && window.wine.instance.exports;
  if (!ex || !ex.get_eip) return { error: 'no cooperative instance' };
  const hits = new Map();
  let n = 0, last = -1;
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    await new Promise(r => setTimeout(r, 0));
    const eip = ex.get_eip() >>> 0;
    const blocks = ex.get_blocks_now ? ex.get_blocks_now() >>> 0 : 0;
    if (blocks === last) continue; // no slice ran since the last sample
    last = blocks;
    n++;
    hits.set(eip, (hits.get(eip) || 0) + 1);
  }
  const top = [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, want.top || 60)
    .map(([eip, c]) => '0x' + eip.toString(16).padStart(8, '0') + ':' + c);
  return { samples: n, distinct: hits.size, top };
})()
