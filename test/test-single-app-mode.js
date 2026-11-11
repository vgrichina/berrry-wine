#!/usr/bin/env node
// Single-app mode: on a phone-sized screen the page runs exactly one guest,
// shows no taskbar while it runs (the desktop keeps a floating Start menu),
// hides the desktop icons while it runs, and presents the
// app scaled to fill the screen.
//
// The zoom is a presentation crop, not a second drawing path: the desktop
// canvas is composited exactly as always and only the rectangle the app
// occupies is scaled out to the display, so a dialog that overhangs its owner
// widens the crop instead of replacing the window underneath it.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shellSource = fs.readFileSync(path.join(root, 'lib', 'browser-shell.js'), 'utf8');

// --- The page: detection, chrome, and the reported screen size ---
assert(html.includes('function detectSingleAppMode()'), 'page should decide single-app mode explicitly');
// Size is necessary but not sufficient. visualViewport is CSS pixels, so a
// desktop browser at 175% zoom reports a phone-sized page; handing that the
// phone layout takes away the taskbar and the icons on a machine with a mouse.
assert(html.includes("matchMedia('(pointer: coarse)')"),
  'a zoomed or narrowed desktop window is still a desktop: it has a fine pointer');
assert(html.includes('const phoneScreen ='),
  'a phone-sized physical screen also qualifies, for a browser that reports no pointer type');
assert(html.includes('const vv = window.visualViewport'),
  'the page, not window.screen, is what a device simulator scales down');
assert(html.includes('const phoneSized = sw < 640 || sh < 520'),
  'the threshold is whether a 640x480 guest screen and its taskbar fit at 1:1 — '
  + '800x600 was a comfortable desktop in 1998 and is still a desktop here');
assert(html.includes('function applySingleAppMode()') &&
  /function resizeCanvas\(\)\s*\{\s*applySingleAppMode\(\);/.test(html),
  'resizing across the threshold should switch the mode, not require a reload');
assert(html.includes("params.has('single-app')"), 'single-app mode should be forceable for testing');
assert(!/function detectSingleAppMode\(\)[\s\S]{0,400}if \(DEBUG_MODE\) return false;/.test(html),
  '?debug is when you most need the phone layout: it must not turn the zoom off');
assert(html.includes('body.single-app #taskbar { display: none; }'),
  'single-app mode should not show the taskbar while an app runs');
// The desktop view keeps the Start menu (Add a Game..., Log In...), floating
// so it takes no layout height and the guest screen is not resized at launch.
assert(/body\.single-app:not\(\.app-running\) #taskbar \{[^}]*display: flex;[^}]*position: fixed;/.test(html),
  'the phone desktop shows a floating taskbar with the Start menu');
assert(html.includes('body.single-app.app-running #start-menu { display: none; }'),
  'the Start menu never shows over a running single-app guest');
assert(html.includes('body.single-app.app-running #desktop-icons { display: none; }'),
  'desktop icons should hide only while an app is running, so they come back on exit');
assert(html.includes('const MIN_BACKING_WIDTH = SINGLE_APP_MODE ? 400 : 640'),
  'a phone should report a phone-sized screen to the guest');
assert(html.includes('singleApp: () => SINGLE_APP_MODE'),
  'the shell should read the mode live, since a resize can change it');
// ?debug keeps the zoom, so the debug panels have to get out of the way once
// an app runs — but only then: the toolbar is the only launcher in debug mode.
assert(html.includes('body.single-app.app-running:not(.no-debug):not(.debug-open) #toolbar'),
  'a running app in debug mode should get the screen back from the toolbar');
assert(html.includes('body.single-app.app-running:not(.no-debug) #debug-peek'),
  'the collapsed debug panels need a way back');
assert(html.includes('function toggleDebugPanels()') && html.includes("classList.toggle('debug-open')"),
  'the peek button should toggle the panels');
assert(/function toggleDebugPanels\(\)[\s\S]{0,400}resizeCanvas\(\);/.test(html),
  'showing or hiding the panels changes how much screen is left: resize the canvas');
assert(html.includes("document.body.classList.toggle('app-running', !!running)"),
  'the page should track whether a guest is running');
assert(shellSource.includes('function clearUnownedDisplayMode()'),
  'a fresh launch should clear stale fullscreen/page state that no live app owns');
assert(shellSource.includes("document.body.classList.remove('exclusive-fullscreen', 'page-fullscreen')"),
  'stale display ownership must not make ordinary apps inherit a black fullscreen shell');

// --- The shell: one app, maximized when it can be ---
// 83f0a302 lets an in-page child process (process_spawn) through with
// launchOpts.bypassSingleApp; any other second launch is still refused.
assert(shellSource.includes('if (SINGLE_APP() && runningApps.length && !(launchOpts && launchOpts.bypassSingleApp))'),
  'single-app mode should refuse a second launch');
assert(shellSource.includes('sharedRenderer.singleAppMode = SINGLE_APP()'),
  'the renderer needs to know to zoom');
// Registry `singleAppMaximize: false` can only take maximize away (Snood).
assert(shellSource.includes('const resizable = mayMaximize && !!(style & (WS_MAXIMIZEBOX | WS_THICKFRAME))'),
  'only a window Windows would let you maximize should be maximized');
assert(shellSource.includes('e.send_message(win.hwnd | 0, 0x0112, 0xF030, 0)'),
  'maximizing should go through WM_SYSCOMMAND/SC_MAXIMIZE, not a renderer-side resize');

// --- The zoom itself ---
const { Win98Renderer } = require('../lib/renderer');

function makeRenderer(canvasW, canvasH, outputW, outputH) {
  const renderer = new Win98Renderer({
    width: canvasW,
    height: canvasH,
    getContext() { return {}; },
  });
  renderer.singleAppMode = true;
  renderer.presentationCanvas = { width: outputW, height: outputH };
  return renderer;
}

function win(x, y, w, h, extra) {
  return Object.assign({ hwnd: 0x10001, x, y, w, h, visible: true, className: 'app' }, extra);
}

// A fixed-size app (Minesweeper's board) on a 390x844 phone: cropped to the
// window and scaled to the full width, letterboxed top and bottom.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  const zoom = renderer._computeSingleAppZoom([win(0, 0, 320, 400)]);
  assert(zoom && zoom.viewport, 'a window smaller than the screen should be zoomed');
  const v = zoom.viewport;
  assert.deepStrictEqual(
    { cropX: v.cropX, cropY: v.cropY, cropW: v.cropW, cropH: v.cropH },
    { cropX: 0, cropY: 0, cropW: 320, cropH: 400 },
    'the crop should be the window rectangle on the desktop canvas');
  assert.strictEqual(v.dstW, 390, 'the zoom should fill the screen width');
  assert.strictEqual(v.dstH, 488, 'the zoom should keep the window aspect ratio');
  assert.strictEqual(v.dstX, 0, 'no horizontal letterbox when the width is filled');
  assert.strictEqual(v.dstY, 178, 'the window should be centred vertically');
  assert.strictEqual(v.background, '#008080',
    'a zoomed *windowed* app is still on the desktop: letterbox in desktop colour');

  // Input has to come back the same way it went out.
  renderer._exclusiveTransform = zoom.transform;
  renderer._exclusivePresentationViewport = v;
  assert.deepStrictEqual(renderer._mapExclusiveInputPoint(195, 422), { x: 160, y: 200 },
    'a tap in the middle of the screen should land in the middle of the window');
  assert.deepStrictEqual(renderer._mapExclusiveInputPoint(195, 10), { x: 160, y: 0 },
    'a tap in the letterbox should clamp to the nearest guest edge');
}

// A window the guest placed away from the origin keeps its position in the
// crop, so the zoom shows the window and not the desktop beside it.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  const v = renderer._computeSingleAppZoom([win(30, 50, 320, 400)]).viewport;
  assert.strictEqual(v.cropX, 30, 'crop should start at the window position');
  assert.strictEqual(v.cropY, 50, 'crop should start at the window position');
  assert.strictEqual(v.nativeX, 30, 'guest coordinates should be recovered from the crop origin');
}

// A maximized app already owns the screen: presenting it must stay a plain
// 1:1 blit, with no crop and no scaling stage at all.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  assert.strictEqual(renderer._computeSingleAppZoom([win(0, 0, 390, 844)]), null,
    'a full-screen window should not be zoomed');
}

// Funtris keeps the full window width in landscape. Fit drops only the menu;
// Fill removes more vertical furniture without clipping either side.
{
  const crop = require('../lib/apps').APPS.funtris.mobileCrop;
  const landscape = makeRenderer(667, 375, 667, 375);
  landscape.mobileCrop = crop;
  const focused = landscape._computeSingleAppZoom([win(0, 0, 667, 375)]).viewport;
  assert.deepStrictEqual(
    [focused.cropX, focused.cropY, focused.cropW, focused.cropH],
    [0, 40, 667, 335], 'landscape Fit keeps the full window width');
  landscape.viewMode = 'zoom';
  const filled = landscape._computeSingleAppZoom([win(0, 0, 667, 375)]).viewport;
  assert.deepStrictEqual(
    [filled.cropX, filled.cropY, filled.cropW, filled.cropH],
    [0, 45, 667, 324], 'landscape Fill crops vertically, not horizontally');
  landscape.viewMode = 'fit';
  const portrait = makeRenderer(420, 494, 375, 667);
  portrait.mobileCrop = crop;
  assert.strictEqual(portrait._computeSingleAppZoom([win(0, 0, 420, 494)]), null,
    'portrait Fit retains the whole guest window without a crop');
  assert.strictEqual(landscape._computeSingleAppZoom([
    win(0, 0, 667, 375), win(120, 70, 240, 180, { hwnd: 0x10002, isDialog: true }),
  ]), null, 'a modal returns the full landscape window and its titlebar');
}

// A dialog hanging off the side of its owner widens the crop instead of
// taking the screen for itself.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  const v = renderer._computeSingleAppZoom([
    win(0, 0, 320, 400),
    win(300, 380, 200, 150, { hwnd: 0x10002, isDialog: true }),
  ]).viewport;
  assert.strictEqual(v.cropW, 390, 'the crop should span both windows, clamped to the desktop');
  assert.strictEqual(v.cropH, 530, 'the crop should span both windows');
}

// A dropdown is painted onto the desktop canvas, not into the window's back
// canvas, so it has to widen the crop too — otherwise the menu is cut off at
// the window edge (Minesweeper's Game menu is wider than its board).
{
  const renderer = makeRenderer(390, 844, 390, 844);
  const exports = {
    menu_open_top: () => 0,
    menu_open_hover: () => -1,
    menu_open_x: () => -1,
    menu_open_y: () => -1,
    menu_bar_item_x: () => 0,
    menu_bar_screen_x: () => 81,
    menu_bar_screen_y: () => 58,
    menu_bar_screen_h: () => 18,
    menu_dropdown_height: () => 120,
  };
  const board = win(78, 40, 154, 235, { wasm: { exports } });
  renderer.windows[board.hwnd] = board;
  renderer._openMenuContext = () => ({ wasm: board.wasm, exports, hwnd: board.hwnd });
  const v = renderer._computeSingleAppZoom([board]).viewport;
  assert.strictEqual(v.cropX, 78, 'the crop should still start at the window');
  assert.strictEqual(v.cropW, 183, 'the crop should reach the right edge of the open dropdown');
  assert.strictEqual(v.cropH, 235, 'a dropdown inside the window height should not grow the crop');
}

// The desktop shell window is the background, not content: it must not pin the
// crop to the whole screen and cancel the zoom.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  const zoom = renderer._computeSingleAppZoom([
    win(0, 0, 390, 844, { hwnd: 0x10003, className: 'Progman' }),
    win(0, 0, 320, 400),
  ]);
  assert(zoom && zoom.viewport.cropW === 320, 'Progman should be excluded from the zoom rectangle');
}

// --- The touch-control bottom inset ---
//
// A square game on a tall phone was getting the dpad drawn on top of it while
// a third of the screen sat empty underneath. The inset reserves the band the
// overlay occupies; the picture moves up into the space instead.

// Enough letterbox to absorb the band: the picture keeps every pixel of its
// scale and is simply re-centred higher.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.touchOverlay = { getOccupiedFraction: () => 200 / 844 };
  const v = renderer._computeSingleAppZoom([win(0, 0, 320, 400)]).viewport;
  assert.strictEqual(v.dstW, 390, 'a game that fits above the band keeps its width');
  assert.strictEqual(v.dstH, 488, 'and every pixel of its scale');
  assert.strictEqual(v.bottomInset, 200, 'the band is reserved');
  assert.strictEqual(v.dstY, 78, 'the picture is centred in what is left, not on the screen');
  assert.ok(v.dstY + v.dstH <= 844 - 200,
    'and clears the band entirely — nothing to draw the dpad over');

  // Input still round-trips: the mapping reads the same viewport.
  renderer._exclusiveTransform = renderer._computeExclusiveTransform(
    { hwnd: 0, x: 0, y: 0, w: 320, h: 400 });
  renderer._exclusivePresentationViewport = v;
  assert.deepStrictEqual(renderer._mapExclusiveInputPoint(195, 78 + 244), { x: 160, y: 200 },
    'a tap in the middle of the moved picture still lands in the middle of the window');
}

// Not enough room to absorb it: the picture shrinks to fit above the band.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.touchOverlay = { getOccupiedFraction: () => 200 / 844 };
  const v = renderer._computeSingleAppZoom([win(0, 0, 320, 700)]).viewport;
  assert.strictEqual(v.dstH, 644, 'the picture is fitted into the height that is left');
  assert.strictEqual(v.dstW, 294, 'keeping its aspect ratio');
  assert.strictEqual(v.dstY, 0, 'and sits at the top of the remaining space');
}

// The floor: past 35% of the height, giving the game away costs more than the
// overlap does, so the reservation is capped and the overlay goes back over
// the picture. 0.35 * 844 = 295.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.touchOverlay = { getOccupiedFraction: () => 0.6 };
  const v = renderer._computeSingleAppZoom([win(0, 0, 320, 700)]).viewport;
  assert.strictEqual(v.bottomInset, 295, 'the inset is capped at 35% of the output height');
}

// An overlay that is down reserves nothing, and neither does an app that never
// declared one: every app on a phone would otherwise shrink for no reason.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.touchOverlay = { getOccupiedFraction: () => 0 };
  const v = renderer._computeSingleAppZoom([win(0, 0, 320, 400)]).viewport;
  assert.strictEqual(v.bottomInset, 0, 'a hidden overlay reserves nothing');
  assert.strictEqual(v.dstY, 178, 'and the picture stays centred on the screen');
}

// The exclusive-fullscreen path must not inherit any of this: a game that owns
// the display owns all of it.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.touchOverlay = { getOccupiedFraction: () => 0.3 };
  const v = renderer._computeExclusivePresentationViewport(
    renderer._computeExclusiveTransform({ hwnd: 1, x: 0, y: 0, w: 320, h: 400 }));
  assert.strictEqual(v.bottomInset, 0, 'fullscreen presentation reserves no band');
  assert.strictEqual(v.dstY, 178, 'and stays centred on the whole display');
}

// Fit/Fill is a presentation choice even for an exclusive DirectDraw game.
// Broken Sword owns a 640x480 display, so Fit keeps all of it; Fill on a
// portrait phone keeps the centre strip and maps taps through that crop.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  const game = win(10, 20, 640, 480);
  const fit = renderer._computeExclusiveView(game);
  assert.deepStrictEqual(
    { cropX: fit.viewport.cropX, cropY: fit.viewport.cropY,
      cropW: fit.viewport.cropW, cropH: fit.viewport.cropH },
    { cropX: 0, cropY: 0, cropW: 640, cropH: 480 },
    'Fit should present the complete exclusive display from its local origin');
  assert.strictEqual(fit.viewport.dstH, 293,
    'Fit should preserve 4:3 and letterbox it on a portrait phone');

  renderer.setViewMode('zoom');
  const fill = renderer._computeExclusiveView(game);
  assert.strictEqual(fill.viewport.dstW, 390, 'Fill should cover the output width');
  assert.strictEqual(fill.viewport.dstH, 844, 'Fill should cover the output height');
  assert.strictEqual(fill.viewport.cropW, 222,
    'Fill should retain only the source width matching the phone aspect');
  assert.strictEqual(fill.viewport.cropH, 480, 'the full source height should survive');
  assert.strictEqual(fill.viewport.cropX, 209,
    'the presentation crop is local to the exclusive window');
  assert.strictEqual(fill.transform.srcX, 219,
    'input coordinates retain the exclusive window screen origin');

  renderer._exclusiveTransform = fill.transform;
  renderer._exclusivePresentationViewport = fill.viewport;
  assert.deepStrictEqual(renderer._mapExclusiveInputPoint(195, 422), { x: 330, y: 260 },
    'the output centre should map to the centre of the cropped guest display');
}

// Pinball's Table view contains the whole table, not an aspect-fill slice.
{
  const app = require('../lib/apps').APPS.pinball;
  assert.strictEqual(app.singleAppArgs, '-fullscreen');
  assert.strictEqual(app.args, undefined, 'ordinary desktop launch stays windowed');
  assert(shellSource.includes('SINGLE_APP() && app.singleAppArgs !== undefined'));
  for (const [w,h] of [[375,628],[844,390]]) {
    const renderer = makeRenderer(400,670,w,h);
    renderer.mobileCrop = app.mobileCrop;
    const game = win(0,0,641,481);
    renderer.windows={1:game};renderer._exclusiveFullscreen=true;
    renderer.handleScreenResize(641,481,844,481);
    assert.deepStrictEqual([game.w,game.h],[641,481],
      'phone rotation does not resize a native exclusive game');
    const normal = renderer._computeExclusiveView(game).viewport;
    // Normal shows the whole SCENE, which is not the whole window: the app
    // paints a black margin around it, and mobileCrop.fitTrim names it (23
    // dead columns left, 32 right, 32 dead rows top, 33 bottom -- every
    // column of them black, scanned off the presented canvas). Fit is sized
    // against what is left, so in landscape, where the height is the scarce
    // axis, the table comes out 481/416 = 15.6% bigger for free. The offset
    // is reported too, or every crop fraction would be read against the
    // wrong origin.
    assert.deepStrictEqual([normal.cropX,normal.cropY,normal.cropW,normal.cropH],
      [23,32,586,416]);
    assert.deepStrictEqual([normal.cropBase.w,normal.cropBase.h],[641,481],
      'the fractions still count from the untrimmed window');
    renderer.setViewMode('zoom');
    const table = renderer._computeExclusiveView(game).viewport;
    // The table's own bounding box in the 641x481 scene, measured off a
    // rendered frame: x 23..382, y 32..447, axis of symmetry x=203. The crop
    // pinned here before (32,32 352x449) started 9px inside that left edge and
    // carried 33 dead rows past its bottom, which is the reported "table is a
    // lil bit off center" -- it put the axis 5px right of the picture centre.
    assert.deepStrictEqual([table.cropX,table.cropY,table.cropW,table.cropH],[23,32,360,416]);
    assert.strictEqual(table.cropX + table.cropW / 2, 203, 'centred on the table axis');
    assert(Math.abs(table.dstW / table.dstH - 360/416) < 0.005,
      'Table preserves aspect without cropping either end');
    assert(table.dstW <= w && table.dstH <= h);
  }
}

// A genuine modal gets its own uncropped phone view and does not change the
// game's selected Table/Fill mode. A modeless dialog must not steal the view.
for (const modalExport of ['modal_dialog_hwnd', 'dialogbox_hwnd']) {
  const renderer=makeRenderer(641,670,375,628);
  let active=2;
  const wasm={exports:{[modalExport]:()=>active}};
  const game={...win(0,0,641,481),hwnd:1,visible:true,wasm};
  const modal={...win(110,110,419,259),hwnd:2,visible:true,isDialog:true,wasm};
  renderer.windows={1:game,2:modal};renderer.setViewMode('zoom');
  renderer.mobileCrop=require('../lib/apps').APPS.pinball.mobileCrop;
  const result=renderer._computeSingleAppZoom([game,modal]);
  assert.deepStrictEqual([result.viewport.cropX,result.viewport.cropY,result.viewport.cropW,result.viewport.cropH],
    [110,110,419,259]);
  assert.strictEqual(renderer.viewMode,'zoom','modal does not overwrite the game view choice');
  active=0;assert.strictEqual(renderer.getActiveModalWindow(),null,'modeless is not modal');
}

// The presented rectangle the touch zones are laid out against follows the
// viewport, inset and all.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844,
  });
  renderer.presentationCanvas.getBoundingClientRect = () => ({
    left: 0, top: 20, right: 390, bottom: 864, width: 390, height: 844,
  });
  renderer.touchOverlay = { getOccupiedFraction: () => 200 / 844 };
  renderer._exclusivePresentationViewport =
    renderer._computeSingleAppZoom([win(0, 0, 320, 400)]).viewport;
  const r = renderer.getPresentedRectClient();
  assert.deepStrictEqual({ x: r.x, y: r.y, w: r.w, h: r.h },
    { x: 0, y: 98, w: 390, h: 488 },
    'the presented rect is the viewport in page coordinates');
}

// --- Fit vs zoom ---
//
// 'fit' shows the whole window letterboxed; 'zoom' fills the screen and crops.
// Both go through ONE presentation path -- zoom only chooses a different
// source rectangle -- so input mapping and the touch zones need to know
// nothing about modes.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  assert.strictEqual(renderer.viewMode, 'fit', 'apps start fitted: nothing is hidden');
  assert.strictEqual(renderer.setViewMode('zoom'), true, 'switching modes reports the change');
  assert.strictEqual(renderer.setViewMode('zoom'), false, 'and a no-op reports none');

  const v = renderer._computeSingleAppZoom([win(0, 0, 320, 400)]).viewport;
  assert.strictEqual(v.dstW, 390, 'zoom fills the width');
  assert.strictEqual(v.dstH, 844, 'and the height: nothing is letterboxed');
  // A 320x400 window on a 390x844 screen is far too wide to fill it, so what
  // gets cropped is the sides, not the top and bottom.
  assert.strictEqual(v.cropH, 400, 'the crop keeps the full height of the window');
  assert.strictEqual(v.cropW, 185, 'and only as much width as the screen aspect allows');
  assert.strictEqual(v.cropX, 68, 'taken from the middle of the window');
}

// A registry `mobileCrop` names the part of the window worth filling with --
// Space Cadet's table, not the score panel beside it.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.setViewMode('zoom');
  renderer.mobileCrop = { x: 0.2, y: 0.0, w: 0.5, h: 1.0 };
  // The window is wider than the desktop canvas, so the union rect is clamped
  // to 390 first and the crop fractions are taken of THAT.
  const v = renderer._computeSingleAppZoom([win(0, 0, 400, 400)]).viewport;
  assert.strictEqual(v.cropH, 400, 'the named crop is full height, so it stays full height');
  assert.strictEqual(v.cropW, 185, 'and is trimmed from half the width to the screen aspect');
  assert.strictEqual(v.cropX, 83,
    'starting inside the named crop (0.2 of 390 = 78) plus half the trim');

  // Input still round-trips through the same viewport in zoom mode.
  renderer._exclusiveTransform = renderer._computeExclusiveTransform(
    { hwnd: 0, x: v.cropX, y: v.cropY, w: v.cropW, h: v.cropH });
  renderer._exclusivePresentationViewport = v;
  const mid = renderer._mapExclusiveInputPoint(195, 422);
  assert.ok(Math.abs(mid.x - (v.cropX + v.cropW / 2)) <= 1 &&
            Math.abs(mid.y - (v.cropY + v.cropH / 2)) <= 1,
    'the middle of the screen is the middle of the crop');
}

// Fill is literal even with controls: it covers the whole output and lets the
// translucent overlay sit above the crop. Only Fit reserves clear space.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.setViewMode('zoom');
  renderer.touchOverlay = { getOccupiedFraction: () => 200 / 844 };
  const v = renderer._computeSingleAppZoom([win(0, 0, 320, 400)]).viewport;
  assert.strictEqual(v.bottomInset, 0, 'Fill does not shorten the output for controls');
  assert.strictEqual(v.dstW, 390, 'Fill covers the full output width');
  assert.strictEqual(v.dstH, 844, 'Fill covers the full output height');
  assert.strictEqual(v.dstY, 0, 'starting at the top');
}

// Without a presentation canvas (the CLI harness) there is nothing to crop
// against, so single-app mode must leave presentation alone.
{
  const renderer = makeRenderer(390, 844, 390, 844);
  renderer.presentationCanvas = null;
  assert.strictEqual(renderer._computeSingleAppZoom([win(0, 0, 320, 400)]), null,
    'headless rendering should not enter the zoom path');
}

// A square board keeps its complete one-tile perimeter in either orientation,
// and the slack a square picture leaves in a non-square hole is filled with
// the WINDOW's own pixels rather than with desktop teal: a contain crop grows
// out to the board area's shape before it is placed. Cropping the chrome away
// and then drawing the backdrop where it used to be is the worst of both.
for (const [width, height, area] of [
  [390, 664, { x: 0, y: 0, w: 1, h: 460 / 664 }],
  [844, 390, { x: 204 / 844, y: 0, w: 436 / 844, h: 1 }],
]) {
  const renderer = makeRenderer(844, 664, width, height);
  renderer.mobileCrop = { x: 3 / 282, y: 78 / 357, w: 276 / 282, h: 276 / 357, contain: true };
  renderer.touchOverlay = { getBoardArea: () => area };
  renderer.setViewMode('zoom');
  const v = renderer._computeSingleAppZoom([win(56, 108, 282, 357)]).viewport;
  // The board itself -- x 59..335, y 186..462 of the window -- is never cut.
  assert(v.cropX <= 59 && v.cropX + v.cropW >= 335, 'the whole board is on screen');
  assert(v.cropY <= 186 && v.cropY + v.cropH >= 462, 'including every wall row');
  // Grown, never stretched: the picture keeps the crop's aspect ratio.
  assert(Math.abs(v.dstW / v.dstH - v.cropW / v.cropH) < 0.01, 'no distortion');
  // And it covers the hole, up to the point where the window itself runs out
  // (landscape: a 282px-wide window cannot fill a 436px-wide area).
  const areaW = Math.round(area.w * width), areaH = Math.round(area.h * height);
  const grown = width > height ? v.dstH >= areaH - 1 : v.dstW >= areaW - 1;
  assert(grown, `the picture fills the board area (${v.dstW}x${v.dstH} in ${areaW}x${areaH})`);
  assert(v.dstX >= Math.round(area.x * width) - 1);
  assert(v.dstY + v.dstH <= areaH + 1);
  // Growth takes its pixels from the window, never from the desktop behind it.
  assert(v.cropX >= 56 && v.cropX + v.cropW <= 56 + 282, 'no desktop to the sides');
  assert(v.cropY >= 108 && v.cropY + v.cropH <= 108 + 357, 'none above or below');
}

// Landscape rails leave a COLUMN clear, not a band. A window that cannot be
// grown to a column's shape used to be shrunk into it -- Funtris came out a
// 332x175 stamp in the middle of a 740x390 screen, teal all around it. The
// rails are floating buttons over the window's own margins, so the picture
// takes the screen and they sit on it.
{
  const rails = {
    getOccupiedFraction: () => 0.48,
    getBoardArea: () => ({ x: 0.28, y: 0, w: 0.45, h: 1 }),
  };
  // Side rails are not a bottom band: nothing is reserved at the foot of the
  // screen for them, so the desktop keeps its full height.
  const inset = makeRenderer(800, 420, 740, 390);
  inset.touchOverlay = rails;
  assert.strictEqual(inset._singleAppBottomInset(), 0,
    'rails reserve no band, however wide they are');

  const renderer = makeRenderer(800, 420, 740, 390);
  renderer.mobileCrop = { x: 0.03, y: 0.18, w: 0.49, h: 0.71, contain: true };
  renderer.touchOverlay = rails;
  renderer.setViewMode('fit');
  const v = renderer._computeSingleAppZoom([win(0, 0, 740, 390)]).viewport;
  assert.strictEqual(v.dstX, 0, 'the picture is not squeezed between the rails');
  assert.strictEqual(v.dstW, 740, 'it spans the screen');
  assert.strictEqual(v.dstH, 390, 'and its full height');

  // A window that already HAS the column's shape still gets the column: the
  // rails are only abandoned when keeping them would shrink the picture.
  const tall = makeRenderer(800, 420, 740, 390);
  tall.mobileCrop = { contain: true };
  tall.touchOverlay = rails;
  tall.setViewMode('fit');
  const col = tall._computeSingleAppZoom([win(0, 0, 333, 390)]).viewport;
  assert.ok(col.dstW < 740, `a fillable column is kept (dstW=${col.dstW})`);
  assert.ok(col.dstX >= Math.round(0.28 * 740) - 1, 'and the picture sits in it');
}

console.log('PASS  single-app mode: phone detection, chrome, and window zoom');

// Both modes must contain the complete modal dialog within the phone's safe
// visible area, not only the board-only Fill path.
for (const mode of ['fit', 'zoom']) {
  const renderer = makeRenderer(844, 844, 390, 844);
  renderer.mobileCrop = { contain: true };
  renderer.touchOverlay = { getBoardArea: () => ({ x: 0, y: 47 / 844, w: 1, h: 593 / 844 }) };
  renderer.setViewMode(mode);
  const v = renderer._computeSingleAppZoom([win(56, 108, 282, 357), win(20, 80, 345, 364)]).viewport;
  assert(v.dstY >= 47, `${mode}: title bar clears the status area`);
  assert(v.dstY + v.dstH <= 640, `${mode}: buttons clear the control band`);
  assert.strictEqual(v.cropY, 80, `${mode}: retain the full dialog caption`);
}

// A native modal is presented on its own, and what surrounds it is the Win98
// desktop it is sitting on -- teal, like every other windowed presentation
// here. Black belongs to a game that owns the display, standing in for a
// monitor's own bars, and a full-screen dialog framed in it looks like a
// different program.
{
  const renderer = makeRenderer(844, 844, 390, 844);
  const dialog = win(20, 80, 345, 364);
  renderer.getActiveModalWindow = () => dialog;
  assert.strictEqual(renderer._computeSingleAppZoom([dialog]).viewport.background,
    '#008080', 'a modal on the desktop letterboxes in desktop colour');

  renderer._exclusiveFullscreen = true;
  assert.strictEqual(renderer._computeSingleAppZoom([dialog]).viewport.background,
    '#000000', 'but a dialog over a game that owns the display keeps its black');
}

{
  const renderer = makeRenderer(844, 664, 390, 664);
  renderer.mobileCrop = { x: 3 / 282, y: 78 / 357, w: 276 / 282, h: 276 / 357, contain: true, portraitTrimX: 12 };
  renderer.touchOverlay = { getBoardArea: () => ({ x: 0, y: 0, w: 1, h: 460 / 664 }) };
  const windows = [win(56, 108, 282, 357)];
  renderer.setViewMode('zoom');
  const board = renderer._computeSingleAppZoom(windows).viewport;
  // portraitTrimX narrows the crop by 12 guest px per side; the height is
  // whatever growing out to the board area's shape asks for.
  assert.deepStrictEqual([board.cropX, board.cropW], [71, 252]);
  assert(board.cropY <= 186 && board.cropY + board.cropH >= 462, 'still uncut');
  renderer.setViewMode('fit');
  renderer.beginViewPinch();
  renderer.updateViewPinch(Math.sqrt(1.5));
  const middle = renderer._computeSingleAppZoom(windows).viewport;
  assert(middle.cropW > board.cropW && middle.cropW < 282, 'pinch produces an intermediate crop');
  renderer.updateViewPinch(1.4);
  renderer.endViewPinch();
  assert.strictEqual(renderer.viewMode, 'zoom', 'release snaps to the nearer board view');
  renderer.beginViewPinch();
  renderer.updateViewPinch(0.7);
  renderer.endViewPinch(true);
  assert.strictEqual(renderer.viewMode, 'zoom', 'cancel restores the starting view');
}

// Calculator's View > Scientific resizes its own window from 262 to 482 wide
// on a 400-wide phone desktop. The single-app crop is the union of the window
// rects CLAMPED TO THE CANVAS, so without a bigger desktop the right third is
// not merely unzoomed -- it is not drawn anywhere and cannot be reached. The
// growth has to be reversible too: back in Standard view the guest would
// otherwise keep reporting a screen the phone does not have.
{
  const renderer = makeRenderer(400, 759, 390, 740);
  const calls = [];
  global.window = { resizeCanvas: () => calls.push(1) };
  const calc = win(40, 0, 262, 253);
  renderer.windows[calc.hwnd] = calc;

  // move_window fires on every drag frame and every z-order shuffle; only a
  // size can change how much desktop is wanted.
  renderer.requestSingleAppBackingGrowth(calc);
  renderer.requestSingleAppBackingGrowth(calc);
  assert.strictEqual(renderer._pendingBackingGrowth, true,
    'the first sighting of a window schedules one re-measure');
  const firstPending = renderer._pendingBackingGrowth;
  calc.x = 60;
  renderer.requestSingleAppBackingGrowth(calc);
  assert.strictEqual(renderer._pendingBackingGrowth, firstPending,
    'a move at the same size is not a resize');

  // A maximized window was GIVEN the desktop rather than asking for it, and
  // matching it would ratchet the desktop to the largest orientation the
  // session had ever been in and never hand the pixels back.
  const maxed = makeRenderer(400, 759, 390, 740);
  maxed.requestSingleAppBackingGrowth(win(0, 0, 800, 900, { _maximized: true }));
  assert.strictEqual(maxed._pendingBackingGrowth, undefined,
    'a maximized window never grows the desktop');

  (async () => {
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    await tick();
    assert.strictEqual(calls.length, 1,
      'the re-measure is deferred and coalesced, not skipped');
    assert.strictEqual(renderer._pendingBackingGrowth, false);

    // View > Scientific: 262 -> 482 wide, past the 400-wide desktop.
    calc.w = 482;
    calc.h = 310;
    renderer.requestSingleAppBackingGrowth(calc);
    await tick();
    assert.strictEqual(calls.length, 2,
      'a window that outgrew the desktop asks the page to re-measure');

    // And the way back. It must not be conditional on the window still
    // looking too big -- by now the desktop has been grown to fit it.
    calc.w = 262;
    calc.h = 253;
    renderer.requestSingleAppBackingGrowth(calc);
    await tick();
    assert.strictEqual(calls.length, 3,
      'View > Standard re-measures too, so the room goes back');

    // Rattler fits a 400px phone desktop by size, but opens at x=158 and
    // extends to x=424. No maximize poll visits this fixed-size window, so
    // creation itself must schedule the re-measure that preserves its score.
    const rattler = makeRenderer(400, 494, 375, 667);
    rattler.createWindow(0x10002, 0x10c00000, 158, 71, 266, 352,
      'Snake', 0, null, null);
    assert.strictEqual(rattler._pendingBackingGrowth, true,
      'a visible fixed window overhanging the backing requests growth');
    await tick();
    assert.strictEqual(calls.length, 4,
      'the backing is re-measured after the fixed window appears');

    const fitting = makeRenderer(400, 494, 375, 667);
    fitting.createWindow(0x10003, 0x10c00000, 40, 40, 266, 352,
      'Snake', 0, null, null);
    assert.strictEqual(fitting._pendingBackingGrowth, undefined,
      'a fixed window already inside the backing causes no resize');

    delete global.window;
  })();
}

// MINIMUM DESKTOP: `singleAppMinDesktop` is the smallest screen an app may
// start on, met by scaling BOTH axes together. Snood builds its back buffer
// from the screen size it starts on; the phone desktop began at 400x711, so
// everything past x=400 -- danger meter, score, a third of the board -- stayed
// black for the whole run ("Snood wasn't fully rendering game board").
{
  const desktop = makeRenderer(684, 570, 684, 570);
  desktop.singleAppMode = false;
  assert.deepStrictEqual(desktop.desktopBackingSize(684, 570), { w: 684, h: 570 });
  desktop.minDesktop = require('../lib/apps').APPS.collapse_crunch.minDesktop;
  const ordinary = desktop.desktopBackingSize(684, 570);
  assert.ok(ordinary.w >= 800 && ordinary.h - 28 >= 600,
    'ordinary Collapse startup has an 800x600 work area before window creation');
  assert.ok(Math.abs(ordinary.w / ordinary.h - 684 / 570) < 0.01);
  desktop._exclusiveFullscreen = true;
  assert.deepStrictEqual(desktop.desktopBackingSize(640, 480), { w: 640, h: 480 },
    'exclusive guest display remains authoritative');
  desktop._exclusiveFullscreen = false;
  desktop.minDesktop = null;
  assert.deepStrictEqual(desktop.desktopBackingSize(684, 570), { w: 684, h: 570 },
    'releasing the app restores the ordinary desktop size');
  assert.ok(shellSource.includes('sharedRenderer.minDesktop = runningApps.reduce'),
    'all running app minima reach the renderer before resize');
  assert.ok(fs.readFileSync(require.resolve('../index.html'), 'utf8')
    .includes('boardRenderer.desktopBackingSize(w, h)'), 'normal page applies desktop sizing');
  const r = makeRenderer(400, 711, 375, 667);
  r.singleAppMinDesktop = { w: 1024, h: 768 };
  const portrait = r.singleAppBackingSize(400, 711);
  assert.ok(portrait.w >= 1024 && portrait.h >= 768, 'portrait meets the minimum on both axes');
  assert.ok(Math.abs(portrait.w / portrait.h - 400 / 711) < 0.01,
    'portrait is scaled uniformly, so guest pixels stay square');
  const landscape = r.singleAppBackingSize(667, 375);
  assert.ok(landscape.w >= 1024 && landscape.h >= 768, 'landscape meets the minimum on both axes');
  assert.ok(Math.abs(landscape.w / landscape.h - 667 / 375) < 0.01, 'landscape keeps its aspect too');

  const plain = makeRenderer(400, 711, 375, 667);
  assert.deepStrictEqual(plain.singleAppBackingSize(400, 711), { w: 400, h: 711 },
    'an app without the option keeps the phone-sized desktop byte for byte');

  const snood = require('../lib/apps').APPS.snood;
  assert.deepStrictEqual(snood.singleAppMinDesktop, { w: 1024, h: 768 },
    'Snood starts on a desktop its Medium/Big layouts and back buffer fit');
  assert.strictEqual(snood.singleAppMaximize, false,
    'Snood is not auto-maximized: its maximize picks a fixed layout');

  // The 2026-10-06 phone sweep over DESKTOP_APPS found the same class in
  // three more: fixed layouts that a phone maximize squeezed or left mostly
  // empty (Bricks, CWordZap), and a window sized from the 400-wide screen
  // that clipped its own status bar (EmPipe).
  const apps = require('../lib/apps').APPS;
  for (const id of ['bricks', 'cwordzap', 'empipe']) {
    assert.deepStrictEqual(apps[id].singleAppMinDesktop, { w: 1024, h: 768 },
      `${id} starts on a desktop its fixed window fits`);
  }
  for (const id of ['bricks', 'cwordzap']) {
    assert.strictEqual(apps[id].singleAppMaximize, false, `${id} is not auto-maximized`);
  }
  // Little Fighter 2 has no maximize box, so its window never grew the desktop
  // before it made its windowed DirectDraw primary: on an 844x390 landscape
  // phone everything below y~370 of its 800x575 window stayed grey
  // (LF2-PHONE-LANDSCAPE-CUTOFF-20261011).
  assert.deepStrictEqual(apps.little_fighter_2.singleAppMinDesktop, { w: 1024, h: 768 },
    'Little Fighter 2 starts on a desktop its window and primary fit');
  {
    const phone = makeRenderer(844, 390, 844, 390);
    phone.singleAppMinDesktop = apps.little_fighter_2.singleAppMinDesktop;
    const size = phone.singleAppBackingSize(844, 390);
    assert.ok(size.w >= 820 && size.h >= 595,
      `the landscape desktop holds LF2's window rect (20,20)-(820,595): got ${size.w}x${size.h}`);
  }
  // Taipei draws its title splash with a DC outside WM_PAINT; the phone
  // maximize repainted over it and phones showed an empty green window until
  // the first tap (TAIPEI-PHONE-EMPTY, runs/20261011T1600Z-taipei-phone-w6).
  assert.strictEqual(apps.taipei.singleAppMaximize, false,
    'taipei is not auto-maximized: the maximize repaint erased its splash');
}

// MAGNIFICATION: `mobileZoom` shrinks the guest's desktop so the single-app
// fit scales the picture back out. SkiFree is the case it exists for -- it
// draws a 31x23 guest-pixel skier on any desktop, so a phone-sized desktop at
// 1:1 renders a 31 CSS px skier and "more screen" only ever means more snow.
//
// It is PER ORIENTATION, and that is the whole shape of the field rather than
// a rule hidden in it: the same 31 CSS px skier is 8.3% of a landscape phone's
// height and 4.3% of a portrait one's, so sideways it reads tiny while upright
// it reads fine. A build that magnified both was reported as too big in
// portrait, so portrait must come out byte-identical to having no field at all.
{
  const ski = require('../lib/apps').APPS.ski32;
  assert.deepStrictEqual(ski.mobileZoom, { landscape: 1.25 },
    'SkiFree asks for 1.25x in landscape and nothing in portrait');
  assert.strictEqual(ski.mobileCrop, undefined,
    'a crop would be Fill-only, and the complaint is about the view the player lands on');

  // LANDSCAPE: both axes by the same factor. `w/zoom` and `h/zoom` keep the
  // viewport's aspect, which is what stops this producing the teal gutters a
  // letterbox would: body.single-app canvas is object-fit:contain, so an
  // aspect that matches is a picture that reaches every edge.
  const land = makeRenderer(667, 375, 667, 375);
  land.singleAppZoom = ski.mobileZoom;
  assert.deepStrictEqual(land.singleAppBackingSize(667, 375), { w: 534, h: 300 },
    'the landscape stage is divided by the zoom');
  assert(Math.abs((534 / 300) / (667 / 375) - 1) < 0.005,
    'the zoomed desktop keeps the viewport aspect, so nothing letterboxes');
  assert.strictEqual(Math.round(31 * 667 / 534), 39,
    'a 31 guest-px skier presents at 39 CSS px in landscape, not 31');

  // PORTRAIT: identical to the same renderer with no `mobileZoom` at all --
  // asserted against the unzoomed result rather than against a number typed
  // here, so it cannot drift away from the plain path it is supposed to be.
  for (const windows of [
    {},                                                                  // fresh launch
    { 1: win(0, 0, 400, 711, { _singleAppNaturalSize: { w: 400, h: 711 } }) },
    // ...and after a rotation OUT of landscape, where the window the guest
    // made on the 534x300 zoomed desktop is the natural size on record.
    { 1: win(0, 0, 400, 711, { _singleAppNaturalSize: { w: 300, h: 300 } }) },
  ]) {
    const zoomed = makeRenderer(400, 711, 375, 667);
    const none = makeRenderer(400, 711, 375, 667);
    zoomed.windows = windows; none.windows = windows;
    zoomed.singleAppZoom = ski.mobileZoom;
    assert.deepStrictEqual(zoomed.singleAppBackingSize(400, 711),
      none.singleAppBackingSize(400, 711),
      'portrait is exactly the no-zoom path');
    assert.deepStrictEqual(zoomed.singleAppBackingSize(400, 711), { w: 400, h: 711 },
      'and that path is the 400x711 desktop portrait already had');
  }
  assert.strictEqual(Math.round(31 * 375 / 400), 29,
    'so the portrait skier stays 29 CSS px');

  // BOTH ROTATION ROUND TRIPS, each leg fed the stage that orientation
  // derives, with the natural size the previous leg left on the window.
  // Portrait and landscape now produce DIFFERENT desktops, so the risk is a
  // leg landing on the other one's or ratcheting; neither may happen.
  const trip = (legs, natural) => {
    const r = makeRenderer(400, 711, 375, 667);
    r.singleAppZoom = ski.mobileZoom;
    r.windows = { 1: win(0, 0, natural.w, natural.h, { _singleAppNaturalSize: natural }) };
    return legs.map(([w, h]) => {
      const size = r.singleAppBackingSize(w, h);
      return `${size.w}x${size.h}`;
    });
  };
  assert.deepStrictEqual(
    trip([[400, 711], [667, 375], [400, 711]], { w: 400, h: 711 }),
    ['400x711', '534x300', '400x711'],
    'portrait -> landscape -> portrait comes back to the portrait desktop');
  assert.deepStrictEqual(
    trip([[667, 375], [400, 711], [667, 375]], { w: 300, h: 300 }),
    ['534x300', '400x711', '534x300'],
    'landscape -> portrait -> landscape comes back to the landscape desktop');

  // Untouched without the field, and never applied to a native fullscreen
  // surface, whose size is the guest's own statement about its display.
  const plain = makeRenderer(667, 375, 667, 375);
  assert.deepStrictEqual(plain.singleAppBackingSize(667, 375), { w: 667, h: 375 });
  plain.singleAppZoom = { landscape: 1.5 };
  plain._exclusiveFullscreen = true;
  assert.deepStrictEqual(plain.singleAppBackingSize(667, 375), { w: 667, h: 375 },
    'an exclusive-fullscreen guest owns its own display size');
  // A bare number is not the field's shape and must not be guessed at.
  const bare = makeRenderer(667, 375, 667, 375);
  bare.singleAppZoom = 1.5;
  assert.deepStrictEqual(bare.singleAppBackingSize(667, 375), { w: 667, h: 375 },
    'a flat number names no orientation, so it magnifies neither');

  // And the shell has to hand the factor to the renderer before the desktop is
  // measured -- syncTouchControls() ends by calling resizeCanvas().
  assert(/sharedRenderer\.singleAppZoom\s*=/.test(shellSource),
    'the shell should publish the running app\'s mobileZoom to the renderer');
  assert(shellSource.includes('mobileZoom: (app.mobileZoom &&'),
    'and carry it on the running-app record the sync reads');
}

// The page half: screenCanvasSize() is what actually grows, and it measures
// against the size it just derived from the viewport -- not against the canvas
// as it stands, which would already have been grown and cancel the rule out.
assert(/if \(\(win\.w \| 0\) > w\) w = Math\.max\(w, \(win\.x \| 0\) \+ \(win\.w \| 0\)\);/.test(html),
  'the desktop must grow to cover a window too wide to fit it, offset and all');
assert(/for \(const win of Object\.values\(boardRenderer\.windows \|\| \{\}\)\) \{\s*\n\s*if \(!win \|\| win\.isChild \|\| !win\.visible \|\| win\._maximized\) continue;/.test(html),
  'and must skip the maximized window, whose size is the desktop it was given');

// A hidden Fill chip must not leave pinch or a keyboard shortcut able to crop
// an app that is meant to stay in Fit. Pinball retains the default zoom path.
{
  const fitted = makeRenderer(400, 711, 375, 667);
  fitted.scheduleRepaint = () => {};
  fitted.allowViewZoom = false;
  assert.strictEqual(fitted.setViewMode('zoom'), false);
  assert.strictEqual(fitted.viewMode, 'fit');
  fitted.beginViewPinch();
  fitted.updateViewPinch(2);
  fitted.endViewPinch();
  assert.strictEqual(fitted.viewMode, 'fit',
    'pinch must not enter Fill for a Fit-only app');

  const pinball = makeRenderer(641, 481, 375, 667);
  pinball.scheduleRepaint = () => {};
  assert.strictEqual(pinball.setViewMode('zoom'), true);
  assert.strictEqual(pinball.viewMode, 'zoom');
}
