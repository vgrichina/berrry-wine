#!/usr/bin/env node
// The guest's desktop is sized to the STAGE, not to the whole viewport.
//
// Presentation reserves the touch controls' band out of the physical output
// (_singleAppBottomInset). That happens AFTER the desktop has been sized, so a
// desktop sized to the whole viewport is handed to a fit that may only use the
// part above the band -- and an aspect-preserving fit spends that mismatch
// SIDEWAYS. The result is teal gutters down both edges of a window that was
// perfectly willing to be the shape of the screen. Measured on Funtris on a
// 390x740 phone: 54px of dead teal per side.
//
// singleAppStageShare() closes the loop by deriving the desktop's height from
// the same fraction the inset will reserve. Letterboxing then stays what it
// should be: the fallback for a window that cannot take the stage's shape.
//
//   viewport 390x740, controls band 204px
//
//   desktop = viewport (before)        desktop = stage (after)
//   ┌───┬───────────┬───┐              ┌───────────────────┐
//   │▒▒▒│  picture  │▒▒▒│              │      picture      │
//   │▒▒▒│           │▒▒▒│              │                   │
//   │▒▒▒└───────────┘▒▒▒│              └───────────────────┘
//   │     controls      │              │     controls      │
//   └───────────────────┘              └───────────────────┘
//     54px teal   54px teal              dstX = 0, dstW = 390

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { Win98Renderer } = require('../lib/renderer');

const VIEWPORT_W = 390;
const VIEWPORT_H = 740;
const BAND_PX = 204;
const BAND_FRACTION = BAND_PX / VIEWPORT_H;
const MIN_BACKING_WIDTH = 400;
const MIN_BACKING_HEIGHT = 300;

function makeRenderer(fraction) {
  const renderer = new Win98Renderer({
    width: MIN_BACKING_WIDTH,
    height: MIN_BACKING_HEIGHT,
    getContext() { return {}; },
  });
  renderer.singleAppMode = true;
  renderer.presentationCanvas = { width: VIEWPORT_W, height: VIEWPORT_H };
  renderer.touchOverlay = {
    isVisible: () => true,
    getOccupiedFraction: () => fraction,
  };
  return renderer;
}

// index.html's own backing-size arithmetic, so the numbers below are the ones
// the page computes rather than a parallel guess at them.
function backingSize(displayW, displayH, share) {
  const stageH = Math.max(1, displayH * share);
  const scale = Math.max(Math.max(1, MIN_BACKING_WIDTH / displayW),
    MIN_BACKING_HEIGHT / stageH);
  return {
    w: Math.max(MIN_BACKING_WIDTH, Math.round(displayW * scale)),
    h: Math.max(MIN_BACKING_HEIGHT, Math.round(stageH * scale)),
  };
}

// --- The share itself -------------------------------------------------------

{
  const renderer = makeRenderer(BAND_FRACTION);
  assert.ok(Math.abs(renderer.singleAppStageShare() - (1 - BAND_FRACTION)) < 1e-9,
    'Fit reserves exactly the band the inset will take');

  // The clamp is shared with _singleAppBottomInset: a layout claiming most of
  // the phone must not shrink the desktop past what presentation will honour.
  const greedy = makeRenderer(0.9);
  assert.strictEqual(greedy.singleAppStageShare(), 1 - 0.35,
    'the share is clamped at the same 0.35 the inset is');
  assert.strictEqual(greedy._singleAppBottomInset(),
    Math.floor(0.35 * VIEWPORT_H), 'and the two agree at the clamp');

  // Fill deliberately covers the controls, so there is no band to size around.
  const zoom = makeRenderer(BAND_FRACTION);
  zoom.setViewMode('zoom');
  assert.strictEqual(zoom.singleAppStageShare(), 1, 'Fill claims the whole viewport');
  assert.strictEqual(zoom._singleAppBottomInset(), 0, 'and reserves nothing');

  // A contain-crop board is no exception. It places itself through
  // getBoardArea(), which reserves the same band out of the same output, so a
  // viewport-sized desktop is letterboxed into it exactly as any other window
  // would be -- Funtris needs the crop AND the stage.
  const board = makeRenderer(BAND_FRACTION);
  board.mobileCrop = { x: 0, y: 0, w: 1, h: 1, contain: true };
  assert.ok(Math.abs(board.singleAppStageShare() - (1 - BAND_FRACTION)) < 1e-9,
    'a contain crop still gets a stage-sized desktop');

  const exclusive = makeRenderer(BAND_FRACTION);
  exclusive._exclusiveFullscreen = true;
  assert.strictEqual(exclusive.singleAppStageShare(), 1,
    'an exclusive-fullscreen game owns the display');

  const desktop = makeRenderer(BAND_FRACTION);
  desktop.singleAppMode = false;
  assert.strictEqual(desktop.singleAppStageShare(), 1);

  for (const bad of [0, -1, NaN, undefined]) {
    const r = makeRenderer(bad);
    assert.strictEqual(r.singleAppStageShare(), 1,
      `no measurable band (${bad}) means no reduction`);
  }

  // Landscape puts the controls on side RAILS. getOccupiedFraction() then
  // reports their WIDTH, and reserving that as a bottom band squashes the
  // desktop to a shape nothing on it can be -- so the board area's height,
  // which is the only figure that is about the height, wins when it is there.
  const rails = makeRenderer(0.48);
  rails.touchOverlay.getBoardArea = () => ({ x: 0.28, y: 0, w: 0.45, h: 1 });
  assert.strictEqual(rails.singleAppStageShare(), 1,
    'side rails take nothing out of the height');

  const band = makeRenderer(0.48);
  band.touchOverlay.getBoardArea = () => ({ x: 0, y: 0, w: 1, h: 0.7 });
  assert.ok(Math.abs(band.singleAppStageShare() - 0.7) < 1e-9,
    'a bottom band takes exactly what it covers');

  const greedyArea = makeRenderer(0.9);
  greedyArea.touchOverlay.getBoardArea = () => ({ x: 0, y: 0, w: 1, h: 0.2 });
  assert.strictEqual(greedyArea.singleAppStageShare(), 1 - 0.35,
    'and is still clamped at the share the inset will honour');

  const throwing = makeRenderer(0);
  throwing.touchOverlay = { getOccupiedFraction() { throw new Error('detached'); } };
  assert.strictEqual(throwing.singleAppStageShare(), 1,
    'a mid-layout overlay must not resize the desktop to nothing');
}

// --- What it buys: no side gutters ------------------------------------------

// Funtris: WS_THICKFRAME, so the shell auto-maximizes it to the whole desktop.
// Whether the presented picture has teal beside it is then decided entirely by
// whether that desktop is the shape of the box presentation may draw into.
function presentMaximized(share) {
  const renderer = makeRenderer(BAND_FRACTION);
  const backing = backingSize(VIEWPORT_W, VIEWPORT_H, share);
  Object.assign(renderer.canvas, { width: backing.w, height: backing.h });
  const viewport = renderer._computeExclusivePresentationViewport(
    { srcX: 0, srcY: 0, srcW: backing.w, srcH: backing.h },
    true, renderer._singleAppBottomInset(), false);
  return { backing, viewport };
}

{
  const before = presentMaximized(1);
  assert.ok(before.viewport.dstX > 40,
    'the bug being fixed: a viewport-sized desktop letterboxes sideways ' +
    `(dstX=${before.viewport.dstX})`);

  const renderer = makeRenderer(BAND_FRACTION);
  const after = presentMaximized(renderer.singleAppStageShare());
  assert.strictEqual(after.viewport.dstX, 0, 'a stage-sized desktop has no left gutter');
  assert.strictEqual(after.viewport.dstW, VIEWPORT_W,
    'and spans the full width of the phone');
  assert.ok(after.viewport.dstY + after.viewport.dstH <= VIEWPORT_H - BAND_PX + 1,
    'while still clearing the controls band');
  assert.ok(after.backing.h < before.backing.h,
    'the desktop the guest lays out for is the stage, not the viewport');
}

// The stage is still a real desktop: the minimum backing floor applies to it,
// so a layout claiming its maximum share cannot hand an app a 100px screen.
{
  const greedy = makeRenderer(0.9);
  const backing = backingSize(VIEWPORT_W, VIEWPORT_H, greedy.singleAppStageShare());
  assert.ok(backing.w >= MIN_BACKING_WIDTH && backing.h >= MIN_BACKING_HEIGHT,
    `a clamped stage still clears the backing floor (${backing.w}x${backing.h})`);
}

// --- Wiring -----------------------------------------------------------------

{
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(page.includes('singleAppStageShare()'),
    'index.html must size the desktop through the renderer, not its own copy');
  assert.ok(/lastStageShare/.test(page) && page.includes('frozenH <= 0'),
    'the share is frozen with the height while the keyboard is up');
  assert.ok(page.includes('Math.round(stageH * scale)'),
    'the backing height comes from the stage, not the viewport');

  const shell = fs.readFileSync(path.join(root, 'lib/browser-shell.js'), 'utf8');
  const sync = shell.slice(shell.indexOf('function syncTouchControls'));
  assert.ok(sync.slice(0, sync.indexOf('function snapshotVfs'))
    .includes('window.resizeCanvas()'),
    'a layout swap must re-measure the stage, or the first app keeps the ' +
    'desktop the empty screen was sized for');
}

console.log('PASS single-app desktop is sized to the stage, not the viewport');
