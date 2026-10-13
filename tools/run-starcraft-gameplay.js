#!/usr/bin/env node
//
// Drive StarCraft shareware into a real mission and profile the match as it
// GROWS -- deterministically, headless, in frozen mode.
//
//   node tools/run-starcraft-gameplay.js [--samples=N] [--window=N] [--gap=N]
//                                        [--out=FILE.ndjson] [--shots=DIR]
//                                        [--max-seconds=N] [--no-play]
//   node tools/run-starcraft-gameplay.js --report=FILE.ndjson
//
// WHY THIS EXISTS
//   Measured on a real iPhone 2026-09-15, StarCraft's GAME fps fell 18 -> 4.7
//   over twenty minutes while the emulator's throughput held at ~2-3M blocks/s.
//   The work per game frame had grown ~3.6x (137k -> 493k block entries). That
//   reading has two confounds a phone cannot remove: thermal throttling, and
//   not knowing what was on screen in any given window.
//
//   A frozen CLI session removes both. Nothing advances between commands, so
//   think-time is not charged to the guest, the input schedule is a fixture,
//   and every window is taken at a known batch with a known screen. If cost per
//   game frame climbs here too, it is the guest's own workload growing and not
//   the device -- which decides whether interpreter folds can reach a playable
//   frame rate late in a match, or only early in one.
//
// WHAT IT MEASURES, PER WINDOW
//   simFrames   the guest's OWN simulation counter at 0x004b2ed0 (see
//               docs/re-notes/starcraft-shareware.md) -- not presents, not
//               flushes. Frame cost means nothing against the wrong counter.
//   blockHits   block entries retired inside the window, from the hot-block
//               histogram. Arming resets it, so windows never overlap.
//   blocksPerFrame  the answer: blockHits / simFrames advanced.
//
//   Shares and counts are load-immune, so this is safe on a busy box. No
//   wall-clock rate is printed, deliberately -- see tools/ctl-hist-series.js.
//
// THE BOOT ROUTE IS NOT OPTIONAL
//   StarCraft waits for input it never receives; raising --batch-size does not
//   substitute for it (ruled out 2026-09-15, both arms reached 0 game frames).
//   The escape/enter/click schedule below is the documented one from the
//   re-notes, replayed as frozen steps instead of a --input schedule.
//
// GATE
//   Reaching gameplay is VERIFIED, not assumed: the run refuses to profile
//   unless the simulation counter is actually advancing. A profile of the
//   intro movie looks superficially fine and is 100% smackw32.

'use strict';

const fs = require('fs');
const path = require('path');
const { startControlSession } = require('../test/control-session');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const has = name => argv.includes(`--${name}`);

const SAMPLES = parseInt(opt('samples', '12'), 10);
const WINDOW = parseInt(opt('window', '120'), 10);   // batches counted per sample
const GAP = parseInt(opt('gap', '80'), 10);          // batches left unsampled
const OUT = opt('out', '/tmp/starcraft-gameplay.ndjson');
const SHOTS = opt('shots', '');
const MAX_SECONDS = opt('max-seconds', '3600');
const NO_PLAY = has('no-play');
const REPORT = opt('report', '');
const CTL_PORT = opt('ctl-port', '8124');

// The guest's own simulation frame counter. Verifier boundary 0x004411e7 is
// the headless game-frame gate; this dword is the counter it guards.
const SIM_FRAME_VA = 0x004b2ed0;

// ---- report mode ----------------------------------------------------------
if (REPORT) {
  const rows = fs.readFileSync(REPORT, 'utf8').split('\n')
    .filter(Boolean).map(l => JSON.parse(l)).filter(r => r.kind === 'sample');
  if (!rows.length) { console.error('no sample rows in ' + REPORT); process.exit(2); }
  console.log('batch    simFrames  dFrames  blockHits     blocks/frame  distinct');
  for (const r of rows) {
    console.log(
      String(r.batch).padStart(6) +
      String(r.simFrames).padStart(11) +
      String(r.dFrames).padStart(9) +
      String(r.blockHits).padStart(12) +
      String(r.blocksPerFrame === null ? '-' : r.blocksPerFrame).padStart(14) +
      String(r.distinct).padStart(10));
  }
  const withCost = rows.filter(r => r.blocksPerFrame !== null);
  if (withCost.length >= 2) {
    const first = withCost[0], last = withCost[withCost.length - 1];
    const ratio = last.blocksPerFrame / first.blocksPerFrame;
    console.log('');
    console.log(`cost per game frame: ${first.blocksPerFrame} -> ${last.blocksPerFrame}` +
      `  (${ratio.toFixed(2)}x across ${last.batch - first.batch} batches)`);
    console.log(ratio > 1.25
      ? 'GROWS -- late-match cost is real, folds alone will not reach a target fps late'
      : ratio < 0.8 ? 'FALLS -- the early window was the expensive one'
      : 'FLAT -- per-frame cost is stable; the phone decay was not workload growth');
  }
  process.exit(0);
}

// ---- the documented boot route --------------------------------------------
// [batchesToStepFirst, entry]; replayed in order from batch 0.
const BOOT = [
  [100, 'focus-main-window'],
  [20, 'keydown:27'], [5, 'keyup:27'],
  [175, 'keydown:27'], [5, 'keyup:27'],
  [295, 'keydown:27'], [5, 'keyup:27'],
  [295, 'keydown:13'], [5, 'keyup:13'],
  [295, 'keydown:27'], [5, 'keyup:27'],
  [2395, 'mousemove:545:393'], [10, 'mousedown:545:393'], [10, 'mouseup:545:393'],
  [630, 'mousemove:200:263'], [10, 'mousedown:200:263'], [10, 'mouseup:200:263'],
];

// ---- a few in-mission orders ----------------------------------------------
// Terran mission 1. Select with a click, order with a right click; the point
// is to make the guest simulate MORE, not to play well.
// `rclick` is one action (run.js:1878); there is no rmousedown/rmouseup pair.
const PLAY = [
  'mousemove:320:300', 'mousedown:320:300', 'mouseup:320:300',
  'rclick:420:260',
  'mousemove:260:330', 'mousedown:260:330', 'mouseup:260:330',
  'rclick:500:340',
];

const PROBE = fs.readFileSync(
  path.join(__dirname, 'ctl-probes', 'read-handler-hist.js'), 'utf8');

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const out = fs.createWriteStream(OUT);
  const emit = row => out.write(JSON.stringify(row) + '\n');

  // --control BESIDE --control-stdin (run.js:54): stdin is this driver's, the
  // HTTP port is for looking at the screen mid-run without disturbing it.
  //   node tools/ctl.js -s :8124 png /tmp/now.png
  //   node tools/ctl.js -s :8124 snapshot
  // Without it a long boot is a black box and "still booting" is
  // indistinguishable from "wedged", which is exactly how the first attempt
  // burned nineteen minutes.
  //
  // --no-threads is NOT a style choice: with real threads the guest runs in a
  // worker with its own wasm instance, and the eval probe below reads the MAIN
  // instance's counters, which then sit at zero. That is the same trap that
  // made the phone report cache_stores:0 with a frozen thread_alloc.
  const session = startControlSession([
    path.join(ROOT, 'test/run.js'), '--app=starcraft_shareware', '--no-build',
    '--no-threads', '--quiet-api', '--no-close', '--repaint-every=50',
    `--max-seconds=${MAX_SECONDS}`, '--batch-size=100000',
    '--stuck-after=100000000', '--control-stdin', `--control=${CTL_PORT}`, '--frozen',
  ], { cwd: ROOT, idPrefix: 'sc-' });

  let batch = 0;
  const step = async (n) => {
    if (n <= 0) return;
    const reply = await session.step(n);
    if (reply.ran !== n) {
      throw new Error(`guest stopped early: asked ${n}, ran ${reply.ran} at batch ${batch}`);
    }
    batch += n;
  };
  const simFrames = async () => {
    const v = await session.send({
      action: 'eval',
      code: `new Uint32Array(memory.buffer)[g2w(${SIM_FRAME_VA}) >>> 2] >>> 0`,
    });
    return Number(v) >>> 0;
  };
  const shot = async (name) => {
    if (!SHOTS) return;
    await session.send({ action: 'png', path: path.join(SHOTS, `${name}.png`) });
  };

  try {
    console.log(`booting (ctl on :${CTL_PORT} -- \`node tools/ctl.js -s :${CTL_PORT} png /tmp/now.png\`)`);
    const t0 = Date.now();
    for (const [n, entry] of BOOT) {
      await step(n);
      await session.send(entry);
      // One line per landmark, with a shot: the 1205->3500 stretch is
      // undocumented in the re-notes and is where the time goes. Screens, not
      // inference, decide whether more escapes belong in that gap.
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  boot batch ${String(batch).padStart(5)}  +${String(secs).padStart(4)}s  ${entry}`);
      await shot(`boot-${String(batch).padStart(5, '0')}`);
    }
    await step(300);
    await shot('gameplay-entry');

    // ---- the gate: is the simulation actually running? --------------------
    const gateA = await simFrames();
    await step(150);
    const gateB = await simFrames();
    console.log(`batch ${batch}: sim counter ${gateA} -> ${gateB} (+${gateB - gateA})`);
    emit({ kind: 'gate', batch, gateA, gateB, advanced: gateB - gateA });
    if (gateB <= gateA) {
      throw new Error(
        `simulation counter did not advance (${gateA} -> ${gateB}). Not in gameplay -- ` +
        'a profile from here would be the intro movie, which is 100% smackw32. ' +
        'The boot route needs re-timing against docs/re-notes/starcraft-shareware.md.');
    }
    console.log('gameplay CONFIRMED -- profiling as the match grows');

    // ---- sample loop ------------------------------------------------------
    let prevFrames = gateB;
    for (let i = 0; i < SAMPLES; i++) {
      if (!NO_PLAY && i > 0) {
        // Issue orders between windows so the match actually develops.
        for (const entry of PLAY) {
          await session.send(entry);
          await step(4);
        }
      }
      await step(GAP);

      await session.send({
        action: 'eval',
        code: 'exports.reset_handler_hist(); exports.set_handler_hist_enabled(1); 1',
      });
      const framesBefore = await simFrames();
      await step(WINDOW);
      const framesAfter = await simFrames();
      const raw = await session.send({ action: 'eval', code: PROBE });
      const hist = JSON.parse(raw);

      const dFrames = framesAfter - framesBefore;
      const row = {
        kind: 'sample', i, batch,
        simFrames: framesAfter,
        dFrames,
        blockHits: hist.blockHits,
        ops: hist.ops,
        distinct: hist.distinct,
        blocksPerFrame: dFrames > 0 ? Math.round(hist.blockHits / dFrames) : null,
        topBlocks: hist.blocks.slice(0, 12),
        topHandlers: hist.handlers.slice(0, 12),
      };
      emit(row);
      console.log(
        `  [${String(i).padStart(2)}] batch ${String(batch).padStart(5)}  ` +
        `frames +${String(dFrames).padStart(4)}  blocks ${String(hist.blockHits).padStart(11)}  ` +
        `per-frame ${row.blocksPerFrame === null ? '-' : row.blocksPerFrame}`);
      await shot(`w${String(i).padStart(2, '0')}`);
      prevFrames = framesAfter;
    }
    console.log(`\nseries written to ${OUT}`);
    console.log(`report: node tools/run-starcraft-gameplay.js --report=${OUT}`);
  } catch (err) {
    console.error('FAILED: ' + err.message);
    emit({ kind: 'error', batch, message: err.message });
    process.exitCode = 1;
  } finally {
    out.end();
    try { await session.quit({ ignoreReplyError: true }); } catch (_) {}
  }
})();
