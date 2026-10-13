#!/usr/bin/env node
// What the touch overlay is allowed to take out of the screen, and what it is
// not.
//
// lib/touch-controls.js getBoardArea() used to reserve a flat 204px band
// across the bottom (a 204px rail down each side in landscape) for ANY app
// whose registry entry declares game controls. lib/renderer.js sizes the guest
// DESKTOP to what is left (singleAppStageShare), so that reservation is not a
// cosmetic margin: it decides how big a window the app is ever offered.
//
// That is right for a dpad, an analogue stick, an in-place zone or a swipe
// strip -- all things a thumb rests in or drags across, all of them wide, all
// of them sitting where the game is. It is wrong for a couple of translucent
// chips in one bottom corner: SkiFree declares exactly two (Fast, New game)
// and no pad at all, on purpose, because its skier follows the pointer. It was
// being handed a 400x494 desktop on a 375x667 phone and the bottom third of
// the screen was bare teal -- "SkiFree doesn't expand to full screen".
//
// What this pins down:
//   * the predicate is about the WIDGETS, not about "has an entry": a
//     corner-buttons layout reserves nothing, everything with a thumb widget
//     still reserves,
//   * it is measured against the REAL registry, so a future entry that drops
//     its dpad cannot silently start or stop giving up a third of the phone,
//   * chrome-only pills still reserve nothing (they always did),
//   * and the end of the chain still holds: no reservation means the guest
//     desktop is the whole viewport, so a window that sizes itself to the
//     screen fills it.

'use strict';

const assert = require('assert');
const path = require('path');

const TouchControls = require(path.join(__dirname, '..', 'lib', 'touch-controls.js'));
const { APPS } = require(path.join(__dirname, '..', 'lib', 'apps.js'));
const { Win98Renderer } = require(path.join(__dirname, '..', 'lib', 'renderer.js'));

// --- the predicate ----------------------------------------------------------

// A receiver with just the state reservesBand()/isVisible() read. The point of
// the test is the rule, not the DOM: a real overlay is exercised by
// test-touch-controls.js.
function overlayWith(layout) {
  return {
    installed: true,
    layout,
    _hasGameControls: !!(layout && (
      (layout.buttons && layout.buttons.length) || layout.dpad ||
      (layout.dpads && layout.dpads.length) || layout.mouseJoystick ||
      (layout.zones && layout.zones.length) || layout.swipes)),
    el: { style: { display: 'block' } },
    isVisible: TouchControls.isVisible,
    reservesBand: TouchControls.reservesBand,
  };
}

const reserves = layout => overlayWith(layout).reservesBand();

assert.strictEqual(reserves(APPS.ski32.touchControls), false,
  'two corner buttons and no pad: SkiFree gives up no screen');
assert.strictEqual(reserves(APPS.snake.touchControls), true,
  'a dpad is a thumb rest and still takes its band');
assert.strictEqual(reserves(APPS.pinball.touchControls), true,
  'in-place zones are the bottom of the table and still take theirs');
assert.strictEqual(reserves(APPS.dxball.touchControls), true,
  'an analogue mouse joystick still takes its band');
assert.strictEqual(reserves({ chrome: true }), false,
  'the bare chrome pills are not game controls and never reserved');
assert.strictEqual(reserves(null), false, 'no layout, no reservation');

// A hidden overlay reserves nothing whatever its layout says, or a closed app
// would keep shrinking the next one.
const hidden = overlayWith(APPS.snake.touchControls);
hidden.el.style.display = 'none';
assert.strictEqual(hidden.reservesBand(), false, 'a hidden overlay reserves nothing');

console.log('PASS reservesBand: corner buttons float, thumb widgets reserve');

// --- measured against the whole registry ------------------------------------

const THUMB = ['dpad', 'dpads', 'mouseJoystick', 'zones', 'swipes'];
const floating = [];
for (const [id, cfg] of Object.entries(APPS)) {
  const layout = cfg && cfg.touchControls;
  if (!layout) continue;
  const hasThumb = THUMB.some(key => {
    const v = layout[key];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
  const hasButtons = !!(layout.buttons && layout.buttons.length);
  assert.strictEqual(reserves(layout), hasThumb,
    `${id}: a band is reserved exactly when the layout has a thumb widget`);
  if (hasButtons && !hasThumb) floating.push(id);
}
// Not a lock on the registry -- adding another corner-buttons app is fine and
// this list is allowed to grow. It is here so that a change which makes a
// PADDED app stop reserving (or this whole rule stop firing) is visible in the
// diff rather than in a screenshot three weeks later.
assert.deepStrictEqual(floating, ['ski32'],
  'SkiFree is the corner-buttons case this rule was measured on');

console.log(`PASS registry: ${floating.length} corner-buttons app(s), the rest reserve`);

// --- and what that buys the guest -------------------------------------------

// The stage share is the desktop's height as a fraction of the viewport, and
// the renderer takes it straight off getBoardArea(). With nothing reserved the
// whole viewport is the stage; with a dpad's band it is not.
function shareFor(boardArea) {
  const renderer = new Win98Renderer({
    width: 400, height: 711,
    getContext() { return {}; },
    style: {},
  });
  renderer.singleAppMode = true;
  renderer.touchOverlay = { getBoardArea: () => boardArea };
  return renderer.singleAppStageShare();
}

assert.strictEqual(shareFor({ x: 0, y: 0, w: 1, h: 1 }), 1,
  'nothing reserved: the guest desktop is the whole viewport');
const banded = shareFor({ x: 0, y: 0, w: 1, h: (667 - 204) / 667 });
assert.ok(banded > 0.69 && banded < 0.70,
  `a dpad band still shortens the desktop (got ${banded})`);

// The numbers the browser actually produced on a 375x667 phone, before and
// after: 400x494 desktop with SkiFree's window 400x494 inside it (the bottom
// third of the screen teal), against a 400x711 desktop with the window
// 400x711. The app sizes itself to the screen it is given at CreateWindow and
// never asks again, so the desktop it is handed IS the window it ends up with.
const viewportH = 667;
const scale = 400 / 375;                       // MIN_BACKING_WIDTH / display width
assert.strictEqual(Math.round(viewportH * 1 * scale), 711,
  'an unreserved 375x667 phone gives a 400x711 desktop');
assert.strictEqual(Math.round(viewportH * ((667 - 204) / 667) * scale), 494,
  'and the 204px band gave the 400x494 one that was reported as not full screen');

// 400x711 is the number the STAGE arithmetic produces, and it is still the
// desktop this app is handed in PORTRAIT: ski32 carries a `mobileZoom`, but
// only for landscape, where filling the phone with desktop bought it more snow
// rather than a bigger skier. The band question and the magnification question
// are independent -- a reserved band would shorten the stage BEFORE the zoom
// divided it -- so this stays the stage's own test, and the line below is here
// to catch a magnification that leaks into the orientation this file measures.
const zoomed = Object.assign(Object.create(Win98Renderer.prototype), {
  singleAppMode: true, singleAppZoom: APPS.ski32.mobileZoom, windows: {},
});
assert.deepStrictEqual(zoomed.singleAppBackingSize(400, 711), { w: 400, h: 711 },
  'portrait keeps the whole stage: the magnification is landscape-only');
assert.deepStrictEqual(zoomed.singleAppBackingSize(667, 375), { w: 534, h: 300 },
  'and landscape is the orientation that divides it');

console.log('PASS stage: 375x667 phone -> 400x711 desktop for a corner-buttons app');
