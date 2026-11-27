// Guest rates over one window, in the units the CLI uses, so a browser run
// can be compared with a headless --cpu-window line: retired blocks per
// guest present (gps_stat_frames: PRESENT records the GPU stream executed,
// which the page's own frame hook can undercount when it coalesces), plus the clock-spin / peek-spin / paced-present counters.
//   eval:window.__measureRate={ms:8000}
//   evalfile:tools/page-probes/measure-guest-rate.js
// Cooperative: the page's main instance. Threads: the guest Worker, through
// callExport. Counters are i32 exports; read unsigned.
(async function () {
  const want = window.__measureRate || {};
  const ms = want.ms || 8000;
  const wine = window.wine, perf = window.WinePerf;
  const names = ['get_blocks_now', 'get_clock_spin_count', 'get_peek_spin_count', 'get_present_paced_count', 'get_logical_frame_count', 'gps_stat_frames'];
  const read = async () => {
    const out = {};
    for (const n of names) {
      try {
        out[n] = (wine.guestWorker && wine.guestWorker.callExport)
          ? Number(await wine.guestWorker.callExport(n)) >>> 0
          : Number(wine.instance.exports[n]()) >>> 0;
      } catch (e) { out[n] = null; }
    }
    // D3D9/D3D8 GPU-stream stats: 0 draws, 3 presents (test/run.js names).
    for (const [k, i] of [['d3d9_draws', 0], ['d3d9_presents', 3]]) {
      try {
        out[k] = (wine.guestWorker && wine.guestWorker.callExport)
          ? Number(await wine.guestWorker.callExport('d3d9_gps_stat', i)) >>> 0
          : Number(wine.instance.exports.d3d9_gps_stat(i)) >>> 0;
      } catch (e) { out[k] = null; }
    }
    return out;
  };
  let presents = 0;
  const orig = perf && perf.guestFrame;
  const mine = function (...a) { presents++; return orig.apply(this, a); };
  if (orig) perf.guestFrame = mine;
  const a = await read(), t0 = performance.now();
  await new Promise(r => setTimeout(r, ms));
  const b = await read(), t1 = performance.now();
  if (orig && perf.guestFrame === mine) perf.guestFrame = orig;
  const d = {};
  for (const n of [...names, 'd3d9_draws', 'd3d9_presents']) d[n] = (a[n] == null || b[n] == null) ? null : ((b[n] - a[n]) >>> 0);
  const sec = (t1 - t0) / 1000;
  return {
    threads: !!wine.guestWorker, seconds: Math.round(sec * 100) / 100, presents,
    presentsPerSec: Math.round(presents / sec * 10) / 10,
    blocksPerSec: d.get_blocks_now == null ? null : Math.round(d.get_blocks_now / sec),
    guestPresentsPerSec: d.gps_stat_frames == null ? null : Math.round(d.gps_stat_frames / sec * 10) / 10,
    blocksPerGuestPresent: !d.gps_stat_frames ? null : Math.round(d.get_blocks_now / d.gps_stat_frames),
    drawsPerPresent: !d.d3d9_presents ? null : Math.round(d.d3d9_draws / d.d3d9_presents),
    blocksPerPresent: d.get_blocks_now == null || !presents ? null : Math.round(d.get_blocks_now / presents),
    deltas: d,
  };
})()
