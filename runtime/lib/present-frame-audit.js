'use strict';
// Is a present cap safe for this app? The limiter ($present_pace, src/09a8)
// sleeps once per event it treats as a frame end: a Flip, a D3D Present,
// SwapBuffers, a blit covering most of the primary, or the Unlock of a
// NULL-rect Lock of the primary. If the app issues several of those per game
// frame, a cap of 60 sleeps several periods per game frame and slows the game
// itself. Fallout does this: five dirty-rect Lock/Unlock copies per main-loop
// turn, and the walk took 1.6x longer at cap 60.
//
// This compares detected frame ends against a logical-frame signal:
//   - the app's own game-step counter (`perf.logicalFrame` in lib/apps.js),
//     when RE has found one;
//   - otherwise pump-bounded frames: message pumps (PeekMessage/GetMessage)
//     that closed one or more frame ends. A Win32 game loop pumps once per
//     turn, so this is the loop's own frame count.
// A ratio above 1 means a cap that paces every frame end would sleep more than
// once per game frame. Since the limiter paces once per pump-bounded frame
// ($present_pump), the report also says whether this thread was switched to
// that mode.
//
// When the app names its game step and the host hands it to WAT
// (set_logical_frame), the decoder's marker counts steps per thread and, with
// the cap in `logical` mode, paces once per step instead of at frame ends or
// pumps. `mode` says which rule was in force, and each row shows the steps
// that thread ran and how many of them slept.
//
// The WAT counters are per instance (per guest thread), so each thread gets
// its own row.

const RATIO_WARN = 1.2;

function readInstance(ex) {
  if (!ex || typeof ex.get_present_frame_ends !== 'function') return null;
  return {
    frameEnds: ex.get_present_frame_ends() >>> 0,
    pumpFrames: ex.get_present_pump_frames() >>> 0,
    pumpBounded: ex.get_present_pump_bounded() >>> 0,
    paced: ex.get_present_paced_count ? ex.get_present_paced_count() >>> 0 : 0,
    pacedMs: ex.get_present_paced_ms ? ex.get_present_paced_ms() >>> 0 : 0,
    steps: ex.get_logical_frame_count ? ex.get_logical_frame_count() >>> 0 : 0,
    stepsPaced: ex.get_logical_frame_paced ? ex.get_logical_frame_paced() >>> 0 : 0,
  };
}

// instances: [{ name, exports }]; logical: count from the app's counter or null.
function snapshot(instances, guestMs, logical) {
  const rows = {};
  for (const { name, exports } of instances) {
    const r = readInstance(exports);
    if (r) rows[name] = r;
  }
  return { guestMs, logical: logical == null ? null : logical >>> 0, rows };
}

function diffRow(a, b) {
  const z = { frameEnds: 0, pumpFrames: 0, paced: 0, pacedMs: 0, steps: 0, stepsPaced: 0 };
  const base = a || z;
  return {
    steps: (b.steps || 0) - (base.steps || 0),
    stepsPaced: (b.stepsPaced || 0) - (base.stepsPaced || 0),
    frameEnds: b.frameEnds - base.frameEnds,
    pumpFrames: b.pumpFrames - base.pumpFrames,
    paced: b.paced - base.paced,
    pacedMs: b.pacedMs - base.pacedMs,
    pumpBounded: b.pumpBounded,
  };
}

// Pure: turn two snapshots into report lines and a verdict. `from` may be
// null (count from the start of the run).
// mode: what the cap paces -- 'logical' (the game step), 'pump' (pump-bounded
// frame ends), or null when the run has no game step to choose between.
function audit(from, to, { cap = 0, logicalLabel = null, mode = null } = {}) {
  const lines = [];
  const stepLabel = logicalLabel || 'logical';
  if (mode) {
    lines.push(`[present-frames] mode: ${mode === 'logical'
      ? `cap paces once per ${stepLabel} step (--present-at=logical)`
      : `cap paces pump-bounded frame ends, ${stepLabel} steps only counted (--present-at=pump)`}`);
  }
  const guestMs = Math.max(1, to.guestMs - (from ? from.guestMs : 0));
  const sec = guestMs / 1000;
  const per = n => (n / sec).toFixed(1);
  const logical = to.logical == null ? null
    : to.logical - (from && from.logical != null ? from.logical : 0);
  let worst = null;
  for (const [name, row] of Object.entries(to.rows)) {
    const d = diffRow(from && from.rows[name], row);
    if (!d.frameEnds && !d.pumpFrames && !d.steps) continue;
    const pumpRatio = d.pumpFrames ? d.frameEnds / d.pumpFrames : null;
    let line = `[present-frames] ${name}: ${d.frameEnds} frame ends (${per(d.frameEnds)}/guest-s), `
      + `${d.pumpFrames} pump-bounded frames (${per(d.pumpFrames)}/guest-s)`;
    line += pumpRatio == null ? ', ratio n/a (no pump between frame ends)'
      : `, ${pumpRatio.toFixed(2)} frame ends per pumped frame`;
    const atStep = mode === 'logical' && d.steps > 0;
    line += atStep ? `, limiter paces at the ${stepLabel} step`
      : d.pumpBounded ? ', limiter paces at the pump' : ', limiter paces every frame end';
    if (d.steps) line += `; ${d.steps} ${stepLabel} steps (${per(d.steps)}/guest-s)`;
    if (cap) {
      line += `; paced ${d.paced} (${d.pacedMs} guest ms slept)`;
      if (d.steps) line += `, ${d.stepsPaced} of them at the step`;
    }
    lines.push(line);
    const ratio = pumpRatio;
    if (ratio != null && (!worst || ratio > worst.ratio)) worst = { name, ratio, source: 'pump', d };
  }
  if (logical != null) {
    const main = to.rows.main ? diffRow(from && from.rows.main, to.rows.main) : null;
    const ends = main ? main.frameEnds : 0;
    const ratio = logical ? ends / logical : null;
    lines.push(`[present-frames] ${logicalLabel || 'logical'} counter: ${logical} frames `
      + `(${per(logical)}/guest-s)` + (ratio == null ? '' : `, ${ratio.toFixed(2)} main-thread frame ends per game frame`));
    if (ratio != null) worst = { name: 'main', ratio, source: 'logical', d: main };
  }
  let verdict;
  if (!worst) verdict = 'NO-SIGNAL';
  else if (worst.ratio > RATIO_WARN) {
    // Over 1 is only a slowdown if the limiter still paces each frame end.
    const pumped = worst.d && worst.d.pumpBounded;
    if (mode === 'logical' && logical) verdict = 'MULTI-PRESENT (paced per game step)';
    else verdict = pumped && worst.source === 'pump' ? 'MULTI-PRESENT (paced per pump)' : 'UNSAFE';
  } else verdict = 'OK';
  lines.push(`[present-frames] verdict: ${verdict}`
    + (worst ? ` (${worst.ratio.toFixed(2)} frame ends per ${worst.source === 'logical' ? 'game' : 'pumped'} frame on ${worst.name})` : '')
    + (verdict === 'UNSAFE' ? ' -- a per-frame-end cap sleeps more than once per game frame' : ''));
  return { verdict, ratio: worst ? worst.ratio : null, lines };
}

module.exports = { snapshot, audit, readInstance, RATIO_WARN };
