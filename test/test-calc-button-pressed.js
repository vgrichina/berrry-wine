#!/usr/bin/env node
// Calculator button pressed-state regression. Drives a mousedown on the '1'
// button, snapshots while held, then mouseups and snapshots again. The button
// region pixels must differ between the held snapshot and a baseline (raised
// → sunken edges + 1px label shift), and must return close to baseline after
// release.
//
// Standard view button '1' is centered at (115, 204) in canvas coords.
// A standard Win98 button is ~35x27, so a tight bbox around the face is
// (98..133, 191..218).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { diffPng, readPng } = require('../tools/png-diff');

const ROOT = path.join(__dirname, '..');
const RUN  = path.join(__dirname, 'run.js');
const EXE  = path.join(__dirname, 'binaries', 'calc.exe');

if (!fs.existsSync(EXE)) { console.log('SKIP  calc.exe missing'); process.exit(0); }

const OUT = path.join(ROOT, 'scratch');
fs.mkdirSync(OUT, { recursive: true });
const pngBaseline = path.join(OUT, 'calc_btn_baseline.png');
const pngHeld     = path.join(OUT, 'calc_btn_held.png');
const pngReleased = path.join(OUT, 'calc_btn_released.png');

// Snapshot a baseline first, then mousedown WITHOUT a paired mouseup so the
// pressed flag stays set while we snapshot. Finally mouseup and snapshot
// again to verify the visual returns to raised.
const inputSpec = [
  `100:png:${pngBaseline}`,
  `200:mousedown:115:204`,
  `260:png:${pngHeld}`,
  `300:mouseup:115:204`,
  `400:png:${pngReleased}`,
].join(',');

const cmd = `node "${RUN}" --exe="${EXE}" --input=${inputSpec} --max-batches=420 --batch-size=50000 --no-close`;
console.log('$', cmd);

let out = '';
try {
  out = execSync(cmd, { encoding: 'utf-8', timeout: 120000, cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  out = (e.stdout || '').toString() + (e.stderr || '').toString();
  console.log('(run.js exited non-zero — output captured)');
}

const BTN_REGION = { x: 98, y: 191, w: 35, h: 27 };

(async () => {
  const checks = [];
  const exists = (p) => fs.existsSync(p) && fs.statSync(p).size > 0;
  const haveBase = exists(pngBaseline), haveHeld = exists(pngHeld), haveRel = exists(pngReleased);
  checks.push({ name: 'baseline PNG written', pass: haveBase });
  checks.push({ name: 'held PNG written',     pass: haveHeld });
  checks.push({ name: 'released PNG written', pass: haveRel });
  checks.push({ name: 'no UNIMPLEMENTED API crash', pass: !/UNIMPLEMENTED API:/.test(out) });

  let nHeldVsBase = -1, nHeldVsRel = -1, nBaseVsRel = -1;
  if (haveBase && haveHeld && haveRel) {
    const Base = readPng(pngBaseline), Held = readPng(pngHeld), Rel = readPng(pngReleased);
    const options = { region: BTN_REGION, includeAlpha: false };
    const diffs = [diffPng(Base, Held, options), diffPng(Held, Rel, options),
      diffPng(Base, Rel, options)];
    checks.push({ name: 'snapshot dimensions match', pass: diffs.every(d => !d.sizeMismatch) });
    [nHeldVsBase, nHeldVsRel, nBaseVsRel] = diffs.map(d => d.changed);
  }
  // Held must differ from baseline — calc paints the button via WM_DRAWITEM
  // when we set the pressed flag (initial paint of the unclicked button is
  // a separate problem; we just need *some* painted pressed face here).
  checks.push({ name: `button visible while held (>=30 px vs baseline, got ${nHeldVsBase})`, pass: nHeldVsBase >= 30 });
  // Pressed → unpressed must visibly change the bevel direction. The same
  // bbox must differ between held and released frames (sunken vs raised
  // edges, ≥10 changed pixels along the border).
  checks.push({ name: `pressed→released changes bevel (>=10 px held vs released, got ${nHeldVsRel})`, pass: nHeldVsRel >= 10 });
  // Release must repaint over the 1px-shifted pressed label. A stale glyph
  // leaves many extra pixels in this tight bbox even if the bevel returns.
  checks.push({ name: `released button returns close to baseline (<=12 px diff, got ${nBaseVsRel})`, pass: nBaseVsRel <= 12 });

  console.log('');
  let failed = 0;
  for (const c of checks) {
    console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.name);
    if (!c.pass) failed++;
  }
  console.log('');
  console.log(`${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
})();
