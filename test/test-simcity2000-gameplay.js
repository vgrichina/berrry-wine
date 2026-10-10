#!/usr/bin/env node
// SimCity 2000 Win95 Demo: load the demo city, prove an ordinary control
// changes the live map, and count the game's animation ticks.
//
// Settings: 20000-block batches at 16 ms of guest time each. At run.js's
// default 200 ms per batch the game is starved (about 0.1 palette ticks per
// guest-second) and its demo notices interrupt before anything can be done.
//
// The map animates by palette cycling, so an RGB diff cannot tell input from
// animation: captures 3 batches apart differ by ~13%, captures 90 batches
// apart can be identical (same phase of the cycle). The checks therefore read
// the main window's 8-bit surface: palette animation changes RGB with no
// index changed; the toolbar's rotate-left button (110,262) changes indices.
//
// Animation counter: SC2K has no frame loop (a full-map BitBlt is ~4 per 16
// guest-seconds). Its animation clock is AnimatePalette from one site (return
// 0x4489ac), the 0xab range every tick and the 0xe0 range on a slower cadence,
// counted over a fixed window: deterministic, reported per guest-second.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { diffPng } = require('../tools/png-diff');
const { startControlSession } = require('./control-session');

const ROOT = path.resolve(__dirname, '..');
const EXE_DIR = path.join(ROOT, 'test/binaries/candidates/simcity-2000-demo/installed');
if (!fs.existsSync(EXE_DIR)) {
  console.log('SKIP  SimCity 2000 demo install is not present');
  process.exit(0);
}

const OUT = process.env.SIMCITY2000_CAPTURE_DIR || path.join(ROOT, 'build', 'simcity2000-gameplay');
fs.mkdirSync(OUT, { recursive: true });
const shot = name => path.join(OUT, `${name}.png`);
const MS_PER_BATCH = 16;
const TICK_FROM = 2100, TICK_TO = 3100;   // 1000 batches = 16 guest-seconds
const TICK_SITE = '0x4489ac';             // AnimatePalette's return in the animation tick
const MAP = { x: 180, y: 70, w: 440, h: 360 };   // right of the floating toolbar
const ROUTE = '25:dlg-cmd:1,700:mousedown:315:148,720:mouseup:315:148';  // Video Warning; Load Demo City
const COMMON = [
  '--no-build', '--app=simcity2000_demo', '--batch-size=20000', `--tick-ms-per-batch=${MS_PER_BATCH}`,
  '--max-seconds=240', '--stuck-after=0', '--no-close', '--quiet-api', '--quiet-blocks',
];

// Snapshot (first call) or compare against the snapshot: the share of the map
// region's palette indices that changed, in the city's main window surface.
const indexProbe = save => `(() => {
  const w = Object.values(renderer.windows || {}).find(v => /<DEMOCITY>/.test(v.title || ''));
  if (!w) return { error: 'no DEMOCITY window' };
  const rec = exports.test_gdi_window_surface_record(w.hwnd) >>> 0;
  const dv = new DataView(memory.buffer), u8 = new Uint8Array(memory.buffer);
  const bits = dv.getUint32(rec + 16, true), stride = dv.getUint32(rec + 20, true), bpp = dv.getUint32(rec + 24, true);
  if (bpp !== 8) return { error: 'surface is ' + bpp + ' bpp' };
  const cur = new Uint8Array(${MAP.w * MAP.h});
  for (let y = 0; y < ${MAP.h}; y++) cur.set(u8.subarray(bits + (y + ${MAP.y}) * stride + ${MAP.x}, bits + (y + ${MAP.y}) * stride + ${MAP.x + MAP.w}), y * ${MAP.w});
  const prev = globalThis.__sc2kIndices;
  if (${save ? 'true' : 'false'}) globalThis.__sc2kIndices = cur;
  if (!prev) return { saved: true };
  let changed = 0; for (let i = 0; i < cur.length; i++) if (cur[i] !== prev[i]) changed++;
  return { changedShare: changed / cur.length };
})()`;

(async () => {
  // --- 1. Live city, palette animation visible, rotate response ----------
  const s = startControlSession(['test/run.js', ...COMMON, '--control-stdin', '--frozen',
    '--max-batches=100000', '--repaint-every=1', `--count=${TICK_SITE}`, `--input=${ROUTE}`],
  { cwd: ROOT, idPrefix: 'sc2k-' });
  let anim, rotate, ticksAtFrom, ticksAtTo;
  try {
    await s.step(1900);
    const first = await s.send({ action: 'eval', code: indexProbe(true) });
    assert(first && first.saved, `the demo city never loaded: ${JSON.stringify(first)}`);
    await s.send({ action: 'png', path: shot('city-a') });
    await s.step(3);
    await s.send({ action: 'png', path: shot('city-b') });
    anim = await s.send({ action: 'eval', code: indexProbe(true) });
    await s.send('mousedown:110:262');
    await s.step(3);
    await s.send('mouseup:110:262');
    await s.step(100);
    await s.send({ action: 'png', path: shot('rotated') });
    rotate = await s.send({ action: 'eval', code: indexProbe(false) });
    // The animation clock: AnimatePalette returns to TICK_SITE once per call.
    // A hit counter read at both ends of the window, not a trace -- tracing
    // re-enables the per-call API log and writes ~130 MB per run.
    await s.step(TICK_FROM - 2006);
    ticksAtFrom = await s.send({ action: 'eval', code: 'exports.get_count(0) >>> 0' });
    await s.step(TICK_TO - TICK_FROM);
    ticksAtTo = await s.send({ action: 'eval', code: 'exports.get_count(0) >>> 0' });
  } finally {
    await s.quit({ ignoreReplyError: true }).catch(() => {});
  }
  console.log('PASS  Load Demo City reaches the live city');

  const rgb = diffPng(shot('city-a'), shot('city-b'), { region: MAP });
  assert(rgb.share > 0.02, `no palette animation on screen: ${(rgb.share * 100).toFixed(2)}% RGB change`);
  assert.strictEqual(anim.changedShare, 0, 'pixels changed index between the two animation frames');
  console.log(`PASS  palette animation reaches the screen: ${(rgb.share * 100).toFixed(1)}% of the map ` +
    'changes colour in 3 batches with no palette index changed');
  assert(rotate.changedShare > 0.2, `rotate-left barely changed the map: ${(rotate.changedShare * 100).toFixed(2)}%`);
  console.log(`PASS  rotate-left turns the view: ${(rotate.changedShare * 100).toFixed(1)}% of the map's ` +
    'palette indices changed (0% between animation frames)');

  // --- 2. Animation clock --------------------------------------------------
  const calls = (ticksAtTo >>> 0) - (ticksAtFrom >>> 0);
  const guestSeconds = (TICK_TO - TICK_FROM) * MS_PER_BATCH / 1000;
  assert(calls > 0, `no palette animation in the window (${ticksAtFrom} -> ${ticksAtTo})`);
  console.log(`PASS  animation clock: ${calls} AnimatePalette calls at ${TICK_SITE} in ${guestSeconds} ` +
    `guest-s = ${(calls / guestSeconds).toFixed(2)}/guest-s (every tick cycles 0xab+49; some also 0xe0+16)`);
  console.log(`PASS  SimCity 2000 screenshots: ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
