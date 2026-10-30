// On-screen buttons and a dpad for guests that are driven by the keyboard.
//
// A phone can generate a click and nothing else. Every keyboard game in the
// registry is therefore unplayable there -- Pinball's flippers are Z and '/',
// SkiFree steers with the arrows, and no amount of tapping the canvas produces
// a WM_KEYDOWN. The on-screen keyboard (lib/mobile-keyboard.js) is the wrong
// instrument for this: it is a text-entry proxy that repeats, autocorrects and
// cannot hold two keys at once, and holding two keys at once IS the flipper.
//
// So: a DOM overlay of real buttons over the canvas, each wired straight to
// renderer.handleKeyDown/handleKeyUp -- the same two calls lib/browser-input.js
// makes for a physical key, so nothing downstream can tell the difference.
//
// Three constraints the code cannot show on its own:
//
//   * The overlay covers the canvas, so the container is pointer-events:none
//     and only the buttons themselves take input. Anything else eats the taps
//     meant for the game underneath.
//   * A touch is tracked by its `identifier`, not by "the finger is down".
//     Two flippers pressed together are two live touches, and releasing one
//     must not release the other's key.
//   * Keys are released on touchcancel as well as touchend. iOS cancels
//     touches for its own reasons (a system gesture, a call arriving); a
//     missed release leaves the guest with a key stuck down forever.
//
// Three widget kinds:
//
//   buttons — a labelled pill in one of the four corners. The label names the
//     ACTION ("Flip", "Nudge", "New game"); the vk is wiring, not UI. A button
//     may instead carry `command:` and post a WM_COMMAND, for a game whose
//     new-game action is a menu item rather than a key.
//   dpad — a floating joystick.
//   mouseJoystick — analog mouse velocity, with a radial dead zone and a
//     curved speed response. It never emits keyboard direction events.
//   zones — transparent regions laid over the game itself, positioned in
//     FRACTIONS of the presented app rectangle. Pinball's flippers are at the
//     bottom of the table, so pressing the table there is the control; a
//     labelled button in the corner is a worse version of the same thing. A
//     zone swallows the touches in its area (a stray WM_LBUTTONDOWN mid-ball
//     is exactly what you do not want); a tap outside every zone still reaches
//     the game. Zones follow renderer.getPresentedRectClient(), so the crop,
//     the zoom and the bottom inset below all move them together.
//
// The bottom band the corner widgets occupy is published as
// getOccupiedHeight()/getOccupiedFraction(); lib/renderer.js reserves it in
// single-app Fit so a small game is pushed UP above the controls rather than
// drawn underneath them. Fill is literal and lets this translucent layer
// overlay the full-screen crop.

(function () {
  'use strict';

  const VK = { LEFT: 0x25, UP: 0x26, RIGHT: 0x27, DOWN: 0x28 };

  const CORNERS = ['bl', 'br', 'tl', 'tr'];

  const STYLE_ID = 'touch-controls-style';

  // A physical keyboard's own repeat, near enough: long enough that a
  // deliberate single step is not doubled, fast enough to cross a board.
  const REPEAT_DELAY_MS = 300;
  const REPEAT_INTERVAL_MS = 150;
  // The shortest key press the overlay sends (see _key). Under the repeat
  // interval, so auto-repeat still shows the guest a release between pulses.
  const MIN_KEY_HOLD_MS = 100;
  // Space left between a top-corner button and the scroll-collapse gutter.
  const TOP_RESERVE_GAP_PX = 4;
  const keyClock = () => (typeof performance !== 'undefined' && performance.now
    ? performance.now() : Date.now());

  // Dominant-axis travel that separates a swipe from a tap, in CSS pixels.
  const SWIPE_PX = 30;

  // Kept in the module rather than index.html so wiring the overlay into a
  // page costs one script tag.
  const CSS = `
#touch-controls {
  position: absolute; inset: 0; pointer-events: none;
  --tc-safe-top: env(safe-area-inset-top, 0px);
  --tc-safe-left: env(safe-area-inset-left, 0px);
  --tc-safe-right: env(safe-area-inset-right, 0px);
  /* Above the canvas (2) and below the page-fullscreen chrome (40): the exit
     button and the "Add to Home Screen" hint are the two things a visitor
     must always be able to reach. */
  z-index: 30; overflow: hidden;
  touch-action: none; -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
}
#touch-controls .tc-corner {
  position: absolute; display: flex; gap: 12px; pointer-events: none;
  z-index: 2;
}
#touch-controls .tc-bl {
  left: 0; bottom: 0; flex-direction: column-reverse; align-items: flex-start;
  padding: 16px calc(18px + env(safe-area-inset-right, 0px))
           calc(18px + env(safe-area-inset-bottom, 0px))
           calc(18px + env(safe-area-inset-left, 0px));
}
#touch-controls .tc-br {
  right: 0; bottom: 0; flex-direction: column-reverse; align-items: flex-end;
  padding: 16px calc(18px + env(safe-area-inset-right, 0px))
           calc(18px + env(safe-area-inset-bottom, 0px))
           calc(18px + env(safe-area-inset-left, 0px));
}
#touch-controls .tc-tl {
  left: 0; top: 0; flex-direction: column; align-items: flex-start;
  padding: calc(16px + env(safe-area-inset-top, 0px))
           calc(18px + env(safe-area-inset-right, 0px)) 16px
           calc(18px + env(safe-area-inset-left, 0px));
}
#touch-controls .tc-tr {
  right: 0; top: 0; flex-direction: column; align-items: flex-end;
  padding: calc(16px + env(safe-area-inset-top, 0px))
           calc(18px + env(safe-area-inset-right, 0px)) 16px
           calc(18px + env(safe-area-inset-left, 0px));
}
/* Bare chrome has only the keyboard chip, so it can hug the usable screen
   edge without dragging a game-control cluster with it. Keep the notch/home
   safe-area inset authoritative; landscape gets the tighter thumb reach. */
#touch-controls.tc-chrome .tc-br {
  padding-right: calc(10px + env(safe-area-inset-right, 0px));
}
@media (orientation: landscape) {
  #touch-controls.tc-chrome .tc-br {
    padding-right: 4px;
  }
  /* This page does not use viewport-fit=cover. Safari has already excluded
     the notch from its landscape viewport, so env(safe-area-inset-*) here
     double-counts it and pushes phone-corner controls into the game. */
  #touch-controls .tc-bl, #touch-controls .tc-br {
    padding-left: 8px;
    padding-right: 8px;
  }
  #touch-controls .tc-tl { padding-top: 8px; padding-left: 8px; }
  #touch-controls .tc-tr { padding-top: 8px; padding-right: 8px; }
}
#touch-controls .tc-row { display: flex; gap: 12px; align-items: flex-end; }
#touch-controls .tc-br .tc-row, #touch-controls .tc-tr .tc-row {
  flex-direction: row-reverse;
}
/* A game control layer, not a Win98 dialog: translucent dark pills that read
   over both a bright board and a black playfield, and stay quiet enough that
   the game is still the thing on screen. */
#touch-controls .tc-btn {
  pointer-events: auto;
  min-width: 58px; min-height: 58px;
  padding: 0 18px;
  display: flex; align-items: center; justify-content: center;
  font: 600 15px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.2px; white-space: nowrap;
  color: rgba(220,220,215,0.72);
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  background: rgba(18,20,26,0.30);
  border: 1px solid rgba(220,220,215,0.16);
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.20);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  transition: transform 90ms ease-out, background-color 90ms ease-out,
              opacity 90ms ease-out;
}
#touch-controls .tc-btn.tc-down {
  background: rgba(255,255,255,0.30);
  border-color: rgba(255,255,255,0.55);
  transform: scale(0.94);
}
/* The discrete pad. A tile game (Rodent's Revenge, Rattler, Funtris) does not
   poll a held direction -- it moves one square per keystroke -- so its control
   is four buttons that PULSE, not an analogue stick that holds. */
#touch-controls .tc-cross {
  pointer-events: none;
  position: relative; width: 168px; height: 168px;
}
#touch-controls .tc-cross .tc-arrow {
  pointer-events: auto; position: absolute;
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  font: 600 20px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: rgba(220,220,215,0.72);
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  background: rgba(18,20,26,0.30);
  border: 1px solid rgba(220,220,215,0.16);
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.20);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  transition: transform 90ms ease-out, background-color 90ms ease-out;
}
#touch-controls .tc-cross .tc-arrow.tc-down {
  background: rgba(255,255,255,0.30);
  border-color: rgba(255,255,255,0.55);
  transform: scale(0.92);
}
#touch-controls .tc-cross .tc-up    { left: 56px; top: 0; }
#touch-controls .tc-cross .tc-left  { left: 0; top: 56px; }
#touch-controls .tc-cross .tc-right { left: 112px; top: 56px; }
#touch-controls .tc-cross .tc-down-btn { left: 56px; top: 112px; }
#touch-controls.tc-screen-anchored .tc-br { align-items: center; }
#touch-controls.tc-screen-anchored .tc-tl { flex-direction: row; align-items: center; }
#touch-controls.tc-screen-anchored .tc-row { gap: 8px; }
#touch-controls.tc-screen-anchored .tc-btn {
  min-width: 64px; min-height: 56px; padding: 0 12px;
}
#touch-controls.tc-screen-anchored :is(.tc-btn, .tc-arrow, .tc-key, .tc-mode) {
  color: rgba(190, 190, 185, 0.48);
  border-color: rgba(210, 210, 205, 0.16);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}
@media (orientation: portrait) {
  #touch-controls.tc-screen-anchored .tc-cross { width: 144px; height: 144px; }
  #touch-controls.tc-screen-anchored .tc-arrow { width: 48px; height: 48px; }
  #touch-controls.tc-screen-anchored .tc-up { left: 48px; top: 0; }
  #touch-controls.tc-screen-anchored .tc-left { left: 0; top: 48px; }
  #touch-controls.tc-screen-anchored .tc-right { left: 96px; top: 48px; }
  #touch-controls.tc-screen-anchored .tc-down-btn { left: 48px; top: 96px; }
}
#touch-controls .tc-dpad {
  pointer-events: auto;
  position: relative; width: 140px; height: 140px; border-radius: 50%;
  background: rgba(18,20,26,0.26);
  border: 1px solid rgba(220,220,215,0.14);
  box-shadow: 0 2px 12px rgba(0,0,0,0.20);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
#touch-controls .tc-dpad .tc-nub {
  position: absolute; left: 50%; top: 50%; width: 54px; height: 54px;
  margin: -27px 0 0 -27px; border-radius: 50%;
  background: rgba(220,220,215,0.28);
  border: 1px solid rgba(220,220,215,0.28);
  box-shadow: 0 1px 6px rgba(0,0,0,0.25);
  transition: background-color 90ms ease-out;
}
#touch-controls .tc-dpad.tc-down .tc-nub { background: rgba(255,255,255,0.52); }
#touch-controls .tc-mouse-joystick { width: 112px; height: 112px; }
/* In-place zones: the control IS the thing on screen (pinball's flippers are
   at the bottom of the table, so that is where you press). Invisible at rest
   apart from a hairline, and a brief wash while held so the region can be
   learned. They sit UNDER the corner widgets (z-index 1 vs 2). */
/* Utility pills belong to the phone corner, not a game surface or a corner
   cluster that moves into a letterbox gutter. The empty chip row in that
   cluster still reserves their space beneath game buttons. */
#touch-controls .tc-utility-row {
  position: absolute; right: calc(18px + env(safe-area-inset-right, 0px));
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  z-index: 3; display: flex; gap: 10px; pointer-events: none;
}
@media (orientation: landscape) {
  #touch-controls .tc-utility-row {
    right: 8px;
    bottom: 8px;
  }
}
#touch-controls .tc-utility-row[hidden] { display: none; }
#touch-controls .tc-utility-row :is(.tc-mode, .tc-key) {
  width: 40px; min-width: 40px; padding: 0;
}
#touch-controls .tc-mode,
#touch-controls .tc-key {
  pointer-events: auto; position: relative; z-index: 3;
  min-width: 40px; height: 40px; padding: 0 10px;
  display: flex; align-items: center; justify-content: center;
  font: 600 12px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: rgba(220,220,215,0.72); text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  background: rgba(18,20,26,0.28);
  border: 1px solid rgba(220,220,215,0.16);
  border-radius: 999px;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
#touch-controls .tc-mode.tc-down,
#touch-controls .tc-key.tc-down,
#touch-controls .tc-btn.tc-chip.tc-down { background: rgba(255,255,255,0.28); }
/* The visible circle is 40px, which is UNDER Apple's 44px minimum target.
   Growing the circle would make three quiet chips loud, so the target grows
   instead: a transparent 2px skirt takes the touch area to 44x44 and changes
   no layout, since the pseudo-element is out of flow. The row's 12px gap
   still leaves 8px of dead space between two of them. */
#touch-controls .tc-mode::before,
#touch-controls .tc-key::before,
#touch-controls .tc-btn.tc-chip::before {
  content: ""; position: absolute; inset: -2px; border-radius: inherit;
}
/* An app button that wants to READ as one of those chips rather than as a
   58px lozenge with a word in it. Same size, same colour, same row rhythm --
   the difference is only that it is the app's key, not the overlay's own. */
#touch-controls .tc-btn.tc-chip {
  position: relative;
  min-width: 40px; width: 40px; height: 40px; min-height: 40px; padding: 0;
  background: rgba(18,20,26,0.28);
  border: 1px solid rgba(220,220,215,0.16);
  box-shadow: none;
  color: rgba(220,220,215,0.72);
}
/* The display:flex rule above beats the browser's own [hidden] default on
   specificity, so setting el.hidden alone leaves the chip on screen. Say it
   here. (syncViewMode hides the fit/fill chip for an app with no mobileCrop.) */
#touch-controls .tc-mode[hidden],
#touch-controls .tc-key[hidden] { display: none; }
/* The keyboard pill reads as a latch, not a button: while the keyboard is up
   it stays lit, because that is the only on-screen evidence of which state
   the toggle is in. */
#touch-controls .tc-key { font-size: 16px; }
#touch-controls .tc-key.tc-on {
  background: rgba(120,190,255,0.42);
  border-color: rgba(255,255,255,0.55);
  color: #fff;
}
/* A control that belongs to the PICTURE, not to a screen corner. A tilted
   table leaves black triangles inside its own bounding box, and those are the
   only places on a phone where a button covers nothing at all -- so these are
   placed by layoutZones against the presented rect, not by a flex stack.
   Round, because the empty space is a triangle and a circle keeps its bulk
   away from the diagonal. */
#touch-controls .tc-board-btn {
  position: absolute;
  min-width: 0; min-height: 0; padding: 0;
  border-radius: 50%;
  font-size: 0;
}
#touch-controls .tc-board-btn::before {
  content: ''; position: absolute; inset: -2px;
}
/* Names for the invisible zones. They go in the letterbox UNDER the picture
   (or, in landscape, in the side gutter beside it) and never on the artwork,
   and they take no touches: the zone they name is the control. */
#touch-controls .tc-caption {
  position: absolute; pointer-events: none; z-index: 2;
  font: 600 11px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.4px; white-space: nowrap;
  color: rgba(255,255,255,0.62);
  text-shadow: 0 1px 2px rgba(0,0,0,0.85);
}
#touch-controls .tc-caption[hidden] { display: none; }
/* The swipe field is the whole picture and must not look like anything. */
#touch-controls .tc-swipe {
  position: absolute; pointer-events: auto; z-index: 0;
  background: transparent; border: 0;
}
#touch-controls .tc-zone {
  position: absolute; pointer-events: auto; z-index: 1;
  background: rgba(255,255,255,0);
  border: 1px solid transparent;
  border-radius: 10px;
  transition: background-color 140ms ease-out, border-color 140ms ease-out;
}
#touch-controls .tc-zone.tc-down {
  background: rgba(255,255,255,0.025);
  border-color: rgba(255,255,255,0.04);
  transition-duration: 40ms;
}
#touch-controls .tc-zone.tc-zone-labelled {
  display: flex; align-items: flex-start; justify-content: center;
  font: 600 11px/1 system-ui, sans-serif; letter-spacing: 0.08em;
  text-transform: uppercase; color: rgba(255,255,255,0.55);
  text-shadow: 0 1px 2px rgba(0,0,0,0.8); padding-top: 3px;
  border-color: rgba(255,255,255,0.18);
  user-select: none; -webkit-user-select: none;
}
#touch-controls .tc-zone.tc-zone-labelled.tc-down {
  background: rgba(255,255,255,0.12);
}
`;

  function ensureStyle(doc) {
    if (!doc || typeof doc.createElement !== 'function') return;
    if (doc.getElementById && doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    const head = doc.head || doc.body;
    if (head && head.appendChild) head.appendChild(style);
  }

  // A TouchList is array-like but not iterable in every WebKit build we run on.
  function changedTouches(e) {
    const list = e && e.changedTouches;
    if (!list) return [];
    const out = [];
    for (let i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }

  function normalizeCorner(pos) {
    const p = String(pos || 'bl').toLowerCase();
    return CORNERS.indexOf(p) >= 0 ? p : 'bl';
  }

  // `pos: 'board-tl'` and friends: a corner of the PICTURE rather than a
  // corner of the screen. Returns null for every ordinary pos.
  function boardCorner(pos) {
    const m = /^board-(tl|tr|bl|br)$/.exec(String(pos || '').toLowerCase());
    return m ? m[1] : null;
  }

  // Glyphs for controls whose action has a direction. Drawn rather than typed:
  // the Unicode arrows render at wildly different weights across iOS versions
  // and one of them (U+2B05) is an emoji on this phone, which comes out in
  // colour and the wrong size beside a monochrome control layer.
  const ICONS = {
    // A nudge is a shove: the shaft says how far, the head says which way the
    // table goes. Pointing the way the TABLE moves, not the way the hand
    // pushes, because the table is the thing on screen.
    'arrow-left': 'M15 10H5M9 5l-4 5 4 5',
    'arrow-right': 'M5 10h10M11 5l4 5-4 5',
    'arrow-up': 'M10 15V5M5 9l5-4 5 4',
    // Restart: the universal "go round again" loop, drawn as an arc that
    // stops short of closing with an arrowhead on the moving end, so it reads
    // as a direction rather than as a circle. Deliberately NOT a power symbol
    // or an X -- this starts a fresh game, it does not leave one.
    'restart': 'M15.5 7.5A6 6 0 1 0 16 10M15.5 4v4h-4',
  };

  function iconSvg(name, size) {
    const d = ICONS[name];
    if (!d) return null;
    const px = size || 22;
    return '<svg viewBox="0 0 20 20" width="' + px + '" height="' + px + '" ' +
      'aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  // Eight sectors around the pad, each naming the arrow keys held there. The
  // diagonals hold two, which is what a guest polling GetAsyncKeyState for two
  // directions expects; a 4-way pad simply rounds each diagonal to one axis.
  const SECTORS = [
    [VK.RIGHT], [VK.RIGHT, VK.UP], [VK.UP], [VK.LEFT, VK.UP],
    [VK.LEFT], [VK.LEFT, VK.DOWN], [VK.DOWN], [VK.RIGHT, VK.DOWN],
  ];

  // dx/dy are in screen coordinates, so dy grows downward and "up" is negative.
  function dpadKeys(dx, dy, ways) {
    const eightWay = ways !== 4;
    const angle = Math.atan2(-dy, dx);
    const step = eightWay ? Math.PI / 4 : Math.PI / 2;
    let index = Math.round(angle / step);
    const count = eightWay ? 8 : 4;
    index = ((index % count) + count) % count;
    return eightWay ? SECTORS[index] : SECTORS[index * 2];
  }

  const TouchControls = {
    installed: false,
    el: null,
    layout: null,
    _renderer: null,
    _doc: null,
    _listeners: [],
    _touches: null,          // touch identifier -> { kind, vk, el, keys }
    _held: null,             // vk -> number of touches holding it
    _widgets: [],
    _zones: [],              // the tc-zone elements, re-laid-out on a poll
    _zoneTimer: null,

    // `?touch-controls=1` forces the overlay on a desktop for development, and
    // `=0` takes it off a phone. Otherwise: only where there is no mouse.
    shouldInstall() {
      try {
        if (typeof location !== 'undefined' && location.search) {
          const params = new URLSearchParams(location.search);
          if (params.has('touch-controls')) {
            return params.get('touch-controls') !== '0';
          }
        }
      } catch (_) {}
      if (typeof window !== 'undefined' && 'ontouchstart' in window) return true;
      if (typeof matchMedia !== 'function') return false;
      return matchMedia('(pointer: coarse)').matches;
    },

    install(options) {
      if (this.installed) return this;
      const opts = options || {};
      this._doc = opts.document || (typeof document !== 'undefined' ? document : null);
      if (!this._doc) return this;
      this._renderer = opts.renderer || null;
      this._touches = new Map();
      this._held = new Map();
      this._widgets = [];
      this._zones = [];

      ensureStyle(this._doc);
      const container = opts.container ||
        (this._doc.getElementById && this._doc.getElementById('screen-wrap')) ||
        this._doc.body;
      const el = this._doc.createElement('div');
      el.id = 'touch-controls';
      el.setAttribute('aria-hidden', 'true');
      el.style.display = 'none';
      if (container && container.appendChild) container.appendChild(el);
      this.el = el;
      this.container = container;
      this.installed = true;
      return this;
    },

    // The renderer is shared and created after the overlay, so it is resolved
    // per key rather than captured at install.
    setRenderer(renderer) { this._renderer = renderer; return this; },

    _renderer_() {
      if (typeof this._renderer === 'function') return this._renderer();
      return this._renderer;
    },

    // Every key this overlay sends stays down for at least MIN_KEY_HOLD_MS. A
    // tap-mode button (and Playwright's tap, and a quick thumb) produces its
    // keydown and keyup in one JS turn, and a game that polls instead of
    // reading messages never sees a key that was down between two of its
    // reads: Dethkarz reads Enter through IDirectInputDevice::GetDeviceState
    // (the published key bitmap under Threads) and sat on PRESS ENTER through
    // six overlay taps, then advanced on 300 ms holds. A real keyboard
    // cannot press that fast, so the release is deferred here rather than in
    // the renderer, which test/run.js drives with batch-clocked key pairs.
    // A new press of the same key, and releaseAll, deliver the pending
    // release at once, so the order stays down/up/down and nothing is left
    // held. window.__waMinKeyHoldMs overrides it; 0 turns it off.
    _minKeyHoldMs() {
      const w = typeof window !== 'undefined' ? window : null;
      return w && Number.isFinite(w.__waMinKeyHoldMs) ? w.__waMinKeyHoldMs : MIN_KEY_HOLD_MS;
    },

    _key(vk, down) {
      const renderer = this._renderer_();
      if (!renderer) return;
      const info = { code: '', location: 0, repeat: false };
      if (!this._keyDownAt) this._keyDownAt = new Map();
      if (!this._keyUpTimers) this._keyUpTimers = new Map();
      if (down) {
        this._flushKeyUp(vk);
        this._keyDownAt.set(vk, keyClock());
        renderer.handleKeyDown(vk, info);
        return;
      }
      if (this._keyUpTimers.has(vk)) return;
      const downAt = this._keyDownAt.get(vk);
      const left = downAt === undefined ? 0 : this._minKeyHoldMs() - (keyClock() - downAt);
      if (left > 0 && typeof setTimeout === 'function') {
        this._keyUpTimers.set(vk, setTimeout(() => this._flushKeyUp(vk), left));
        return;
      }
      this._keyDownAt.delete(vk);
      renderer.handleKeyUp(vk, info);
    },

    // Delivers a deferred release now, if one is waiting.
    _flushKeyUp(vk) {
      if (!this._keyUpTimers || !this._keyUpTimers.has(vk)) return;
      clearTimeout(this._keyUpTimers.get(vk));
      this._keyUpTimers.delete(vk);
      this._keyDownAt.delete(vk);
      const renderer = this._renderer_();
      if (renderer) renderer.handleKeyUp(vk, { code: '', location: 0, repeat: false });
    },

    // The WM_CHAR half of a keystroke. `_key` only ever produces
    // WM_KEYDOWN/WM_KEYUP, and a real keyboard's character message comes from
    // the browser's own keypress event, which a synthetic touch press never
    // raises -- so an app that reads characters instead of virtual keys sees
    // nothing at all from a pill. SkiFree is the measured case: its wndproc
    // honours exactly four virtual keys (RETURN, ESCAPE, F2, F3) and routes
    // every other control through WM_CHAR, where lowercase 'f' (0x66) toggles
    // the speed flag at 0x40c670. Uppercase 'F' is outside its 0x58..0x79
    // character table, so the character value matters as much as the key.
    _char(code) {
      const renderer = this._renderer_();
      if (!renderer || typeof renderer.handleKeyPress !== 'function') return;
      renderer.handleKeyPress(code | 0);
    },

    // A menu command as a button. Funtris starts a game from its "Start!" menu
    // and no key does it, so the only honest control is the WM_COMMAND the
    // menu would have posted -- the same one test/run.js sends as `post-cmd`.
    // Posted, not sent: a synchronous send would reenter the guest from a DOM
    // event handler.
    _command(id) {
      const renderer = this._renderer_();
      if (!renderer || !renderer.windows) return false;
      const top = Object.values(renderer.windows)
        .filter(w => w && w.visible && !w.isChild)
        .reduce((best, w) => ((w.zOrder || 0) > (best ? best.zOrder || 0 : -1) ? w : best), null);
      const we = top && top.wasm && top.wasm.exports;
      if (!we || !we.post_message_q) return false;
      we.post_message_q(top.hwnd | 0, 0x0111 /* WM_COMMAND */, id | 0, 0);
      if (renderer.scheduleRepaint) renderer.scheduleRepaint();
      return true;
    },

    // A few games expose their complete phone-friendly scheme through a
    // software mouse rather than keys. Blobby Volley is the canonical case:
    // pointer X moves the player and holding button 0 jumps. Overlay buttons
    // act at the guest's current cursor, not at the HTML pill itself.
    _mouseButton(button, down, clientX, clientY) {
      const renderer = this._renderer_();
      if (!renderer) return false;
      let point = null;
      if (Number.isFinite(renderer._mouseX) && Number.isFinite(renderer._mouseY)) {
        point = { x: renderer._mouseX, y: renderer._mouseY };
        if (typeof renderer._unmapExclusiveInputPoint === 'function') {
          const unmapped = renderer._unmapExclusiveInputPoint(point.x, point.y);
          if (unmapped && Number.isFinite(unmapped.x) && Number.isFinite(unmapped.y)) {
            point = unmapped;
          }
        }
      }
      if (!point) point = this._canvasPoint(clientX, clientY);
      if (!point) return false;
      const fn = down ? renderer.handleMouseDown : renderer.handleMouseUp;
      if (typeof fn !== 'function') return false;
      fn.call(renderer, point.x, point.y, button | 0);
      return true;
    },

    // Reference-counted, because two widgets can legitimately hold one vk (a
    // dpad diagonal and a spare arrow button). Releasing one must not tell the
    // guest the key came up while the other is still pressed.
    _press(vk) {
      const n = this._held.get(vk) || 0;
      this._held.set(vk, n + 1);
      if (n === 0) this._key(vk, true);
    },

    _release(vk) {
      const n = this._held.get(vk) || 0;
      if (n <= 1) {
        this._held.delete(vk);
        if (n === 1) this._key(vk, false);
        return;
      }
      this._held.set(vk, n - 1);
    },

    // Lets go of whatever one tracked touch was holding, whatever widget
    // started it. The widgets' own end handlers stay the normal path; this is
    // for a touch whose end they never saw.
    _releaseEntry(entry) {
      if (!entry) return;
      if (entry.el && entry.el.classList) entry.el.classList.remove('tc-down');
      this._stopRepeat(entry);
      if (entry.kind === 'mouseButton') {
        this._mouseButton(entry.mouseButton, false, 0, 0);
      } else if (entry.kind === 'mouseJoystick') {
        if (this._stopMouseJoystick) this._stopMouseJoystick();
      } else if (entry.kind === 'dpad') {
        for (const vk of entry.keys || []) this._release(vk);
        entry.keys = [];
      } else if (entry.kind === 'zone') {
        this._release(entry.vk);
      } else if (entry.hold) {
        const vks = entry.vks && entry.vks.length ? entry.vks : [entry.vk];
        for (const vk of vks) this._release(vk);
      }
    },

    // A touch the browser no longer lists is over, whether or not its end
    // reached the widget that owns it. Two ways that end goes missing: a
    // window-level capture handler (the canvas's own finger) stopping
    // propagation of an event that also carried this touch, and iOS simply
    // not sending one. Either leaves a key held with no finger on the glass,
    // so every touch event checks the tracked set against e.touches and
    // releases the strays. A touch in changedTouches is left to its widget,
    // whose handler runs after this one and may do more than release (a
    // swipe field turns an unmoved touch into a click).
    _reconcileTouches(e) {
      if (!this._touches || !this._touches.size || !e || !e.touches) return;
      const live = new Set();
      for (let i = 0; i < e.touches.length; i++) live.add(e.touches[i].identifier);
      for (const t of changedTouches(e)) live.add(t.identifier);
      for (const [id, entry] of Array.from(this._touches)) {
        if (live.has(id)) continue;
        this._touches.delete(id);
        this._releaseEntry(entry);
      }
    },

    _on(target, type, fn, capture = false) {
      target.addEventListener(type, fn, { passive: false, capture });
      this._listeners.push([target, type, fn, capture]);
    },

    _cornerNode(corner) {
      if (!this._corners) this._corners = {};
      if (this._corners[corner]) return this._corners[corner];
      const node = this._doc.createElement('div');
      node.className = 'tc-corner tc-' + corner;
      this.el.appendChild(node);
      this._corners[corner] = node;
      return node;
    },

    _rowNode(corner, row) {
      const key = corner + ':' + row;
      if (!this._rows) this._rows = {};
      if (this._rows[key]) return this._rows[key];
      const node = this._doc.createElement('div');
      node.className = 'tc-row';
      this._cornerNode(corner).appendChild(node);
      this._rows[key] = node;
      return node;
    },

    // Replaces whatever is on screen. Passing null/undefined hides the overlay
    // and releases anything still held.
    setLayout(config) {
      if (!this.installed) return this;
      this._clearWidgets();
      this._fracAt = 0;
      // A new app arrives at its landscape default even if the phone was
      // already sideways: forget which orientation the last one was in.
      this._wasLandscape = null;
      this.layout = config || null;
      this.el.classList.remove('tc-screen-anchored');
      this.el.classList.remove('tc-chrome');
      if (this._doc.body && this._doc.body.classList) {
        if (config && config.screenAnchored) this._doc.body.classList.add('touch-screen-anchored');
        else this._doc.body.classList.remove('touch-screen-anchored');
      }
      if (config && config.screenAnchored) this.el.classList.add('tc-screen-anchored');
      if (config && config.chrome) this.el.classList.add('tc-chrome');
      if (!config) {
        this.el.style.display = 'none';
        return this;
      }
      this._on(window, 'blur', () => this.releaseAll());
      this._on(window, 'pagehide', () => this.releaseAll());
      this._on(this._doc, 'visibilitychange', () => { if (this._doc.hidden) this.releaseAll(); });
      // Window capture: stopPropagation elsewhere cannot hide an event from
      // another listener on the same node, so this sees every touch event.
      const reconcile = (e) => this._reconcileTouches(e);
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        this._on(window, type, reconcile, true);
      }
      if (config.viewToggle !== false) this._addModeToggle();
      if (config.keyboard !== false) this._addKeyboardToggle();
      if (config.swipes) this._addSwipeField(config.swipes);
      const zones = Array.isArray(config.zones) ? config.zones : [];
      for (const spec of zones) this._addZone(spec);
      const buttons = Array.isArray(config.buttons) ? config.buttons : [];
      for (const spec of buttons) this._addButton(spec);
      const dpads = config.dpad ? [config.dpad] : (config.dpads || []);
      for (const spec of dpads) {
        if (spec && spec.style === 'cross') this._addCross(spec);
        else this._addDpad(spec);
      }
      if (config.mouseJoystick) this._addMouseJoystick(config.mouseJoystick);
      this._hasGameControls =
        !!(buttons.length || dpads.length || zones.length || config.swipes || config.mouseJoystick);
      this.el.style.display =
        (this._hasGameControls || this._modeEl || this._keyEl) ? 'block' : 'none';
      if (this._zones.length || this._modeEl || this._keyEl) this._startZoneTracking();
      return this;
    },

    _addButton(spec) {
      // `vk` may be a LIST, for the same reason a dpad direction may be: one
      // button standing in for the same action in two different key sets,
      // where only the local player's set is acted on.
      const vkList = spec && Array.isArray(spec.vk)
        ? spec.vk.filter(Number.isFinite).map(v => v | 0)
        : (spec && Number.isFinite(spec.vk) ? [spec.vk | 0] : []);
      if (!spec || (!vkList.length && !Number.isFinite(spec.char) &&
          !Number.isFinite(spec.command) && !Number.isFinite(spec.mouseButton))) return;
      const el = this._doc.createElement('button');
      el.type = 'button';
      el.className = 'tc-btn';
      const glyph = spec.icon ? iconSvg(spec.icon, spec.iconSize) : null;
      if (glyph) el.innerHTML = glyph;
      else el.textContent = spec.label === undefined ? String(vkList[0]) : String(spec.label);
      el.setAttribute('aria-label', spec.title || spec.label || ('key ' + vkList[0]));
      if (spec.width) el.style.minWidth = spec.width + 'px';
      // A picture-anchored button is placed by layoutZones, so it takes no
      // corner and no row -- and must not: the bottom band the renderer keeps
      // clear is measured from the bl/br stacks, and a button floating over
      // the artwork has no business enlarging it.
      const board = boardCorner(spec.pos);
      const corner = board ? null : normalizeCorner(spec.pos);
      el._tcCorner = corner;
      el._tcLandscapeCorner = !board && spec.landscapePos
        ? normalizeCorner(spec.landscapePos) : null;
      el._tcRow = spec.row | 0;
      el._tcHeight = 58;
      if (Number.isFinite(spec.height) && spec.height > 0) {
        el._tcHeight = Math.max(44, spec.height);
        el.style.minHeight = el._tcHeight + 'px';
      }
      // A `chip` button keeps its corner and its key and gives up the word.
      // Pinball's "New game" was a 115px pill in a 105px landscape gutter: it
      // could not fit, so it hung off the bezel 8px from the left flipper
      // zone. At 40px it is a chip like the other two, in the same idiom, and
      // the gutter has room for it. `icon` already beats `label` above, so no
      // other app's labelled pill is touched by this.
      if (spec.chip && glyph) {
        el.classList.add('tc-chip');
        el._tcHeight = 40;
      }
      if (board) {
        el.classList.add('tc-board-btn');
        el._tcBoardCorner = board;
        const size = Math.max(40, spec.size | 0 || 52);
        el._tcBoardSize = size;
        // The measured circle this button has to stay inside, if the app
        // measured one. See _layoutBoardButtons.
        const fit = spec.fit;
        el._tcBoardFit = fit && fit.r > 0
          ? { cx: +fit.cx || 0, cy: +fit.cy || 0, r: +fit.r } : null;
        el.style.width = el.style.height = size + 'px';
      }
      // A command button is a one-shot by construction: there is no "held"
      // WM_COMMAND.
      const command = Number.isFinite(spec.command) ? spec.command | 0 : null;
      const mouseButton = Number.isFinite(spec.mouseButton) ? spec.mouseButton | 0 : null;
      // A character button is a one-shot too: WM_CHAR has no "up", so there is
      // nothing for a hold to hold. Declaring `char` therefore cancels the
      // default hold even when a `vk` is present -- the pair is one tap of one
      // key, exactly what the browser would deliver for a physical press.
      const charCode = Number.isFinite(spec.char) ? spec.char | 0 : null;
      const hold = command === null && mouseButton === null && charCode === null &&
        spec.hold !== false;
      const vk = vkList.length ? vkList[0] : 0;

      const begin = (e) => {
        e.preventDefault();
        for (const t of changedTouches(e)) {
          if (this._touches.has(t.identifier)) continue;
          this._touches.set(t.identifier,
            { kind: mouseButton === null ? 'button' : 'mouseButton',
              vk, vks: vkList, mouseButton, el, hold });
          el.classList.add('tc-down');
          if (command !== null) this._command(command);
          else if (mouseButton !== null) {
            this._mouseButton(mouseButton, true, t.clientX, t.clientY);
          }
          else if (hold) for (const k of vkList) this._press(k);
          else if (charCode !== null) {
            // Order matters and mirrors USER: WM_KEYDOWN, then the character
            // TranslateMessage would have synthesized, then WM_KEYUP.
            if (vk) this._key(vk, true);
            this._char(charCode);
            if (vk) this._key(vk, false);
          } else {
            for (const k of vkList) this._key(k, true);
            for (const k of vkList) this._key(k, false);
          }
        }
      };
      const end = (e) => {
        for (const t of changedTouches(e)) {
          const entry = this._touches.get(t.identifier);
          if (!entry || entry.el !== el) continue;
          e.preventDefault();
          this._touches.delete(t.identifier);
          el.classList.remove('tc-down');
          if (entry.mouseButton !== null) {
            this._mouseButton(entry.mouseButton, false, t.clientX, t.clientY);
          } else if (entry.hold) {
            for (const k of (entry.vks && entry.vks.length ? entry.vks : [entry.vk])) {
              this._release(k);
            }
          }
        }
      };
      this._on(el, 'touchstart', begin);
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      // The canvas may stop propagation while another finger is aiming.
      // Observe releases at window capture so held action keys cannot stick.
      this._on(window, 'touchend', end, true);
      this._on(window, 'touchcancel', end, true);
      // A button under a real pointer is a development convenience, not a
      // second input path: it is the same press/release the touch takes.
      this._on(el, 'contextmenu', (e) => e.preventDefault());

      if (board) {
        this.el.appendChild(el);
        (this._boardButtons || (this._boardButtons = [])).push(el);
      } else {
        this._rowNode(corner, spec.row | 0).appendChild(el);
      }
      this._widgets.push(el);
    },

    _addMouseJoystick(spec) {
      const el = this._doc.createElement('div');
      el.className = 'tc-dpad tc-mouse-joystick';
      el.setAttribute('aria-label', 'variable-speed mouse joystick');
      el._tcCorner = normalizeCorner(spec.pos);
      el._tcRow = 0;
      el._tcHeight = 112;
      const nub = this._doc.createElement('div');
      nub.className = 'tc-nub';
      el.appendChild(nub);
      const state = { id: null, vx: 0, vy: 0, rx: 0, ry: 0, time: null, frame: null };
      const maxSpeed = Number.isFinite(spec.maxSpeed) ? Math.max(1, spec.maxSpeed) : 900;
      // A soft center leaves room for precise paddle/cursor placement. Keep
      // maximum travel speed independent so crossing the field stays fast.
      const responseExponent = Number.isFinite(spec.responseExponent)
        ? Math.max(1, spec.responseExponent) : 3;
      const dead = 0.15;
      const park = () => {
        if (state.frame !== null) window.cancelAnimationFrame(state.frame);
        state.frame = null; state.time = null;
      };
      const stop = () => {
        park(); state.id = null; state.vx = state.vy = state.rx = state.ry = 0;
        nub.style.transform = 'translate(0px, 0px)';
        el.classList.remove('tc-down');
      };
      this._stopMouseJoystick = stop;
      const frame = time => {
        state.frame = null;
        if (state.id === null || (!state.vx && !state.vy)) return;
        const dt = state.time === null ? 0 : Math.min(32, Math.max(0, time - state.time)) / 1000;
        state.time = time;
        const r = this._renderer_();
        if (r && r.canvas && typeof r.handleMouseMove === 'function') {
          const t = r._exclusiveTransform;
          const x0 = t ? t.srcX : 0, y0 = t ? t.srcY : 0;
          const w = t ? t.srcW : r.canvas.width, h = t ? t.srcH : r.canvas.height;
          state.rx += state.vx * maxSpeed * dt;
          state.ry += state.vy * maxSpeed * dt;
          const dx = Math.trunc(state.rx), dy = Math.trunc(state.ry);
          state.rx -= dx; state.ry -= dy;
          if (dx || dy) {
            // The renderer stores guest coordinates, but its input entry
            // point accepts logical-canvas coordinates. Invert presentation
            // once so Fit/Fill, Retina and side rails do not change speed.
            const oldX = Number.isFinite(r._mouseX) ? r._mouseX : x0 + w / 2;
            const oldY = Number.isFinite(r._mouseY) ? r._mouseY : y0 + h / 2;
            const x = Math.max(x0, Math.min(x0 + w - 1, oldX + dx));
            const y = Math.max(y0, Math.min(y0 + h - 1, oldY + dy));
            const p = r._unmapExclusiveInputPoint ? r._unmapExclusiveInputPoint(x, y) : { x, y };
            r.handleMouseMove(p.x, p.y, { relative: true, directDx: x - oldX, directDy: y - oldY });
          }
        }
        state.frame = window.requestAnimationFrame(frame);
      };
      const track = touch => {
        const box = el.getBoundingClientRect();
        const dx = touch.clientX - (box.left + box.width / 2);
        const dy = touch.clientY - (box.top + box.height / 2);
        const radius = Math.max(1, Math.min(box.width, box.height) / 2 - 20);
        const distance = Math.hypot(dx, dy);
        const tilt = Math.min(1, distance / radius);
        const speed = tilt <= dead ? 0 : Math.pow((tilt - dead) / (1 - dead), responseExponent);
        state.vx = distance ? dx / distance * speed : 0;
        state.vy = distance ? dy / distance * speed : 0;
        const travel = Math.min(distance, radius);
        nub.style.transform = `translate(${distance ? dx / distance * travel : 0}px, ${distance ? dy / distance * travel : 0}px)`;
        el.classList.add('tc-down');
        if (!speed) { park(); state.rx = state.ry = 0; }
        else if (state.frame === null) state.frame = window.requestAnimationFrame(frame);
      };
      this._on(el, 'touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        if (state.id !== null) return;
        const t = changedTouches(e).find(t => !this._touches.has(t.identifier));
        if (!t) return;
        state.id = t.identifier;
        this._touches.set(t.identifier, { kind: 'mouseJoystick', el });
        track(t);
      });
      this._on(el, 'touchmove', e => {
        e.preventDefault(); e.stopPropagation();
        for (const t of changedTouches(e)) if (t.identifier === state.id) track(t);
      });
      const end = e => {
        e.preventDefault(); e.stopPropagation();
        for (const t of changedTouches(e)) if (t.identifier === state.id) {
          this._touches.delete(t.identifier); stop();
        }
      };
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      this._on(window, 'blur', () => this.releaseAll());
      this._on(window, 'resize', () => this.releaseAll());
      this._on(this._doc, 'visibilitychange', () => { if (this._doc.hidden) this.releaseAll(); });
      this._on(el, 'contextmenu', e => e.preventDefault());
      this._rowNode(el._tcCorner, 0).appendChild(el);
      this._widgets.push(el);
    },

    _addDpad(spec) {
      const opts = spec || {};
      const el = this._doc.createElement('div');
      el.className = 'tc-dpad';
      el.setAttribute('aria-label', 'direction pad');
      el._tcCorner = normalizeCorner(opts.pos);
      el._tcRow = opts.row | 0;
      el._tcHeight = 140;
      const nub = this._doc.createElement('div');
      nub.className = 'tc-nub';
      el.appendChild(nub);
      const ways = opts.ways === 4 ? 4 : 8;
      const dead = Number.isFinite(opts.deadZone) ? opts.deadZone : 14;
      const map = opts.vks || {};
      // A layout may rename the directions (numpad steering, WASD); the arrow
      // keys are only the default. A direction may also name SEVERAL keys,
      // which are then all held together -- that is for a game whose two
      // players have different key sets and where only one of them is local,
      // so the machine applies the set it owns and ignores the rest (Blobby
      // Volley over the virtual LAN; see docs/re-notes/blobby-volley.md).
      const asKeys = (v) => (Array.isArray(v)
        ? v.filter(Number.isFinite).map(k => k | 0)
        : (Number.isFinite(v) ? [v | 0] : null));
      const remap = (vk) => {
        if (vk === VK.UP) return asKeys(map.up) || [vk];
        if (vk === VK.DOWN) return asKeys(map.down) || [vk];
        if (vk === VK.LEFT) return asKeys(map.left) || [vk];
        if (vk === VK.RIGHT) return asKeys(map.right) || [vk];
        return [vk];
      };

      const centerOf = () => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const applyKeys = (entry, keys) => {
        const next = [];
        for (const vk of keys) for (const k of remap(vk)) {
          if (next.indexOf(k) < 0) next.push(k);
        }
        for (const vk of entry.keys) if (next.indexOf(vk) < 0) this._release(vk);
        for (const vk of next) if (entry.keys.indexOf(vk) < 0) this._press(vk);
        entry.keys = next;
        if (next.length) el.classList.add('tc-down');
        else el.classList.remove('tc-down');
        const dx = entry.lastDx || 0;
        const dy = entry.lastDy || 0;
        const len = Math.hypot(dx, dy) || 1;
        const cap = Math.min(len, 40);
        nub.style.transform = next.length
          ? `translate(${(dx / len) * cap}px, ${(dy / len) * cap}px)`
          : 'translate(0px, 0px)';
      };
      const track = (entry, t) => {
        const c = centerOf();
        const dx = t.clientX - c.x;
        const dy = t.clientY - c.y;
        entry.lastDx = dx;
        entry.lastDy = dy;
        applyKeys(entry, Math.hypot(dx, dy) < dead ? [] : dpadKeys(dx, dy, ways));
      };

      const begin = (e) => {
        e.preventDefault();
        for (const t of changedTouches(e)) {
          if (this._touches.has(t.identifier)) continue;
          const entry = { kind: 'dpad', el, keys: [] };
          this._touches.set(t.identifier, entry);
          track(entry, t);
        }
      };
      const move = (e) => {
        e.preventDefault();
        for (const t of changedTouches(e)) {
          const entry = this._touches.get(t.identifier);
          if (!entry || entry.el !== el) continue;
          track(entry, t);
        }
      };
      const end = (e) => {
        e.preventDefault();
        for (const t of changedTouches(e)) {
          const entry = this._touches.get(t.identifier);
          if (!entry || entry.el !== el) continue;
          this._touches.delete(t.identifier);
          entry.lastDx = 0;
          entry.lastDy = 0;
          applyKeys(entry, []);
        }
      };
      this._on(el, 'touchstart', begin);
      this._on(el, 'touchmove', move);
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      this._on(el, 'contextmenu', (e) => e.preventDefault());

      this._rowNode(normalizeCorner(opts.pos), opts.row | 0).appendChild(el);
      this._widgets.push(el);
    },

    // Fit <-> zoom. The affordance exists because the gesture is invisible:
    // nobody discovers a pinch on a page that has never had one.
    _addModeToggle() {
      const el = this._doc.createElement('button');
      el.type = 'button';
      el.className = 'tc-mode';
      el.setAttribute('aria-label', 'switch between fitting and filling the screen');
      this._modeEl = el;
      el._tcCorner = 'br';
      el._tcRow = -1;
      el._tcHeight = 40;
      const press = (e) => {
        e.preventDefault();
        el.classList.add('tc-down');
        this.toggleViewMode();
      };
      const end = (e) => { e.preventDefault(); el.classList.remove('tc-down'); };
      this._on(el, 'touchstart', press);
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      this._on(el, 'contextmenu', (e) => e.preventDefault());
      this._chipRow().appendChild(el);
      this._widgets.push(el);
      this.syncViewMode();
    },

    // By default both chips share one row, created before any app button so the flex
    // column-reverse puts it at the BOTTOM of the bottom-right stack -- under
    // "New game" rather than over the board. Row -1 is a key no layout can
    // ask for, so an app button can never land in here beside them.
    _chipRow() {
      const corner = this.layout && this.layout.screenAnchored ? 'tl' : 'br';
      const row = this._rowNode(corner, -1);
      if (this.layout && this.layout.screenAnchored) row.style.order = '1';
      row._tcChips = true;
      return row;
    },

    // The manual keyboard. This exists for EVERY app on a touch device, with
    // or without a control layout, because the apps that need it most are the
    // ones with no layout at all: a fullscreen DirectDraw game draws its own
    // text field, never calls CreateCaret, and so is invisible to the
    // caret-driven keyboard in lib/browser-input.js. Diablo II's character
    // name is unreachable on a phone without it.
    _addKeyboardToggle() {
      const el = this._doc.createElement('button');
      el.type = 'button';
      el.className = 'tc-key';
      el.textContent = '⌨';        // KEYBOARD
      el.setAttribute('aria-label', 'show or hide the keyboard');
      this._keyEl = el;
      const corner = this.layout && this.layout.keyboardCorner
        ? normalizeCorner(this.layout.keyboardCorner) : 'br';
      const row = this.layout && Number.isInteger(this.layout.keyboardRow)
        ? this.layout.keyboardRow : -1;
      el._tcCorner = corner;
      el._tcRow = row;
      el._tcHeight = 40;
      const press = (e) => {
        // preventDefault, but NOT stopPropagation: the focus() below has to
        // run inside this very gesture or iOS will not open the keyboard.
        if (e && e.preventDefault) e.preventDefault();
        el.classList.add('tc-down');
        this.toggleKeyboard();
      };
      const end = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        el.classList.remove('tc-down');
      };
      this._on(el, 'touchstart', press);
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      // Desktop development (`?touch-controls=1`) has no touch events.
      this._on(el, 'mousedown', (e) => {
        if (e && e.__tcFromTouch) return;
        press(e);
        end(e);
      });
      this._on(el, 'contextmenu', (e) => e.preventDefault());
      this._rowNode(corner, row).appendChild(el);
      this._widgets.push(el);
      this.syncKeyboardToggle();
    },

    toggleKeyboard() {
      const fn = typeof window !== 'undefined' ? window.__wineToggleKeyboard : null;
      let open = false;
      if (typeof fn === 'function') {
        try { open = !!fn(); } catch (_) { open = false; }
      }
      this.syncKeyboardToggle(open);
      return open;
    },

    // `state` is what the toggle just returned; without one, ask the page.
    syncKeyboardToggle(state) {
      if (!this._keyEl) return this;
      let open = state;
      if (open === undefined) {
        const probe = typeof window !== 'undefined' ? window.__wineKeyboardOpen : null;
        try { open = typeof probe === 'function' ? !!probe() : false; } catch (_) { open = false; }
      }
      if (open) this._keyEl.classList.add('tc-on');
      else this._keyEl.classList.remove('tc-on');
      return this;
    },

    // The label names what a press will DO, which is the opposite of the mode
    // you are in.
    // "Fit" and "Fill" are the two states of a control every media player
    // already draws, and it draws them as corner brackets: pointing OUT means
    // "make it bigger than the frame", pointing IN means "bring it back
    // inside". Read at a glance and in any language, where a 12px word on a
    // 40px pill is neither. Unicode has no clean pair for it (⛶ and ⤢ are the
    // nearest and read as one idea, not two), so the brackets are drawn.
    //
    // A crop that names its states keeps its words: Pinball's "Normal" and
    // "Table" are not geometry, they are which half of the table you get, and
    // no arrow says that.
    _viewIcon(out) {
      // Four L brackets. Out: the corner of each L sits AT the outer corner,
      // arms reaching in -- the picture is about to grow past the frame. In:
      // the corner of each L sits toward the middle, arms reaching out to the
      // edges -- the picture is about to come back inside it.
      const d = out
        ? 'M8 3H3v5M12 3h5v5M12 17h5v-5M8 17H3v-5'
        : 'M3 8h5V3M17 8h-5V3M17 12h-5v5M3 12h5v5';
      return '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" ' +
        'fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
    },

    syncViewMode() {
      if (!this._modeEl) return this;
      const renderer = this._renderer_();
      const zoom = !!(renderer && renderer.viewMode === 'zoom');
      const crop = renderer && renderer.mobileCrop;
      // Fill is only ever worth offering where somebody has said WHAT to fill
      // with. Without a mobileCrop it is a centre-crop through whatever the
      // window happens to contain, and the measurements are not close:
      // StarCraft loses 56% of its width in portrait, Minesweeper 63% of the
      // minefield in landscape, the calculator 42% of its keypad. Fit already
      // shows those whole, so the button's only function is to break them.
      // The same reasoning already keeps it off an app with no touchControls
      // entry at all (see _chromeLayout); this extends it to the apps that
      // declare controls but no crop. Pinch still reaches zoom for anyone who
      // wants it -- this is about not advertising it.
      // A crop earns the chip in BOTH orientations. It was hidden in landscape
      // for one round, on the reading that a declared landscape framing left
      // nothing to toggle; the phone's answer was "pinball landscape is
      // missing fit/fill button". `landscapeView` is a DEFAULT now, not a
      // lock -- see _enforceLandscapeView -- so there are two states there as
      // much as in portrait.
      this._modeEl.hidden = !crop;
      // The icon is the face, always. The app's own words for the two states
      // stay on as the ACCESSIBLE name -- "Normal"/"Table" say which half of
      // Pinball's scene you get, which no arrow can, and that is worth keeping
      // for a screen reader even though it is the wrong thing to print on a
      // 40px chip in 12px type next to a keyboard glyph.
      const named = zoom ? (crop && crop.fitLabel) : (crop && crop.zoomLabel);
      // Memoized: layoutZones calls this on its 250ms poll so a rotation is
      // picked up without an event, and rewriting the same SVG four times a
      // second is churn nobody asked for.
      const face = zoom ? 'fit' : 'fill';
      if (this._modeFace !== face) {
        this._modeFace = face;
        this._modeEl.innerHTML = this._viewIcon(!zoom);
      }
      this._modeEl.setAttribute('aria-label',
        'switch to ' + (named || (zoom ? 'Fit' : 'Fill')) + ' view');
      return this;
    },

    // Which view this layout wants to ARRIVE in when the phone is turned
    // sideways, or null when it has nothing to say. Pinball is the case:
    // 'window' means the whole 641x481 scene, score panel included, fitted to
    // the short edge -- which in landscape is the HEIGHT, so it runs screen top
    // to bottom with no black bars and the gutters land left and right, where
    // there is nothing to lose. 'crop' is the other value the mechanism takes,
    // for a layout that would rather land on its mobileCrop there.
    _landscapeSingleView() {
      const want = this.layout && this.layout.landscapeView;
      if (want !== 'crop' && want !== 'window') return null;
      const host = this.el && this.el.getBoundingClientRect
        ? this.el.getBoundingClientRect() : null;
      if (!host || !(host.width > 0) || !(host.height > 0)) return null;
      if (!(host.width > host.height)) return null;
      return want === 'crop' ? 'zoom' : 'fit';
    },

    // A DEFAULT, applied once per arrival in landscape -- not a lock held every
    // frame. Held every frame it fought the chip: a tap switched the mode and
    // the next 250ms poll switched it straight back, which is worse than
    // offering no chip at all. So it fires on the EDGE (portrait -> landscape,
    // or the first layout in landscape) and then leaves the choice alone.
    //
    // A pinch in progress is left alone too: snapping mid-gesture fights the
    // finger. The edge is consumed either way, so the default does not lie in
    // wait and pounce when the gesture ends.
    _enforceLandscapeView() {
      const renderer = this._renderer_();
      const host = this.el && this.el.getBoundingClientRect
        ? this.el.getBoundingClientRect() : null;
      const landscape = !!(host && host.width > 0 && host.height > 0 &&
        host.width > host.height);
      const was = this._wasLandscape;
      this._wasLandscape = landscape;
      if (!renderer || !landscape || was === true) return;
      const want = this._landscapeSingleView();
      if (!want) return;
      if (Number.isFinite(renderer._pinchProgress)) return;
      if (renderer.viewMode === want) return;
      if (this._enforcingView) return;
      this._enforcingView = true;
      try { this.setViewMode(want); } finally { this._enforcingView = false; }
    },

    setViewMode(mode) {
      const renderer = this._renderer_();
      if (!renderer || !renderer.setViewMode) return false;
      const changed = renderer.setViewMode(mode);
      this.syncViewMode();
      if (changed) {
        this.layoutZones();
        // ...and again once the new viewport EXISTS. setViewMode only marks a
        // repaint; _exclusivePresentationViewport (and with it the presented
        // rect every corner and pill is placed against) is not recomputed
        // until that repaint runs. Laying out only here places the controls
        // against the OLD mode's picture -- which is how a Fill press in
        // Rodent's Revenge threw its buttons to a position that belongs to a
        // rectangle no longer on screen. The 250ms tracker would correct it
        // eventually; a mode switch is not a gesture and should not need a
        // quarter second to settle.
        this._relayoutSoon();
      }
      return changed;
    },

    // Re-run layoutZones after the renderer's next repaint, without assuming
    // the order two rAF callbacks were queued in. Two frames plus a timer
    // fallback for a page whose rAF is throttled (a backgrounded tab).
    _relayoutSoon() {
      const w = typeof window !== 'undefined' ? window : null;
      const again = () => { if (this.installed) this.layoutZones(); };
      if (w && typeof w.requestAnimationFrame === 'function') {
        w.requestAnimationFrame(() => { again(); w.requestAnimationFrame(again); });
      }
      if (typeof setTimeout === 'function') setTimeout(again, 120);
      return this;
    },

    toggleViewMode() {
      const renderer = this._renderer_();
      const zoom = !!(renderer && renderer.viewMode === 'zoom');
      return this.setViewMode(zoom ? 'fit' : 'zoom');
    },

    // One complete keystroke. A tile game moves a square per keystroke, so a
    // finger held on a direction has to keep producing them -- a real keyboard
    // repeats, and holding our continuous pad sent exactly one keydown and
    // then nothing, which is a control that feels dead after the first step.
    _pulse(vk) {
      this._key(vk, true);
      this._key(vk, false);
    },

    _startRepeat(entry, vk) {
      this._pulse(vk);
      if (typeof setTimeout !== 'function') return;
      entry.repeatTimer = setTimeout(() => {
        entry.repeatTimer = null;
        entry.repeatInterval = setInterval(() => this._pulse(vk), REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },

    _stopRepeat(entry) {
      if (!entry) return;
      if (entry.repeatTimer) { clearTimeout(entry.repeatTimer); entry.repeatTimer = null; }
      if (entry.repeatInterval) { clearInterval(entry.repeatInterval); entry.repeatInterval = null; }
    },

    // The discrete pad: four arrows in a cross, each a pulse with keyboard
    // auto-repeat under a hold. Action games opt into continuous held keys.
    _addCross(spec) {
      const opts = spec || {};
      const map = opts.vks || {};
      const pad = this._doc.createElement('div');
      pad.className = 'tc-cross';
      pad.setAttribute('aria-label', 'direction pad');
      pad._tcCorner = normalizeCorner(opts.pos);
      pad._tcRow = opts.row | 0;
      pad._tcHeight = 168;

      const dirs = [
        ['up', 'tc-arrow tc-up', '▲', Number.isFinite(map.up) ? map.up | 0 : VK.UP],
        ['left', 'tc-arrow tc-left', '◀', Number.isFinite(map.left) ? map.left | 0 : VK.LEFT],
        ['right', 'tc-arrow tc-right', '▶', Number.isFinite(map.right) ? map.right | 0 : VK.RIGHT],
        ['down', 'tc-arrow tc-down-btn', '▼', Number.isFinite(map.down) ? map.down | 0 : VK.DOWN],
      ];
      for (const [name, cls, glyph, vk] of dirs) {
        const el = this._doc.createElement('button');
        el.type = 'button';
        el.className = cls;
        el.textContent = glyph;
        el.setAttribute('aria-label', name);
        el._tcDir = name;
        el._tcVk = vk;
        const begin = (e) => {
          e.preventDefault();
          for (const t of changedTouches(e)) {
            if (this._touches.has(t.identifier)) continue;
            const entry = { kind: 'cross', vk, el, hold: opts.hold === true };
            this._touches.set(t.identifier, entry);
            el.classList.add('tc-down');
            if (entry.hold) this._press(vk);
            else this._startRepeat(entry, vk);
          }
        };
        const end = (e) => {
          e.preventDefault();
          for (const t of changedTouches(e)) {
            const entry = this._touches.get(t.identifier);
            if (!entry || entry.el !== el) continue;
            this._touches.delete(t.identifier);
            el.classList.remove('tc-down');
            this._stopRepeat(entry);
            if (entry.hold) this._release(entry.vk);
          }
        };
        this._on(el, 'touchstart', begin);
        this._on(el, 'touchend', end);
        this._on(el, 'touchcancel', end);
        this._on(el, 'contextmenu', (e) => e.preventDefault());
        pad.appendChild(el);
      }
      this._rowNode(pad._tcCorner, pad._tcRow).appendChild(pad);
      this._widgets.push(pad);
    },

    // Client coordinates to the logical canvas coordinates the renderer's
    // input entry points take -- the same conversion lib/browser-input.js's
    // eventPointFromClient makes. Needed because a swipe field covers the
    // canvas, so a tap it decides NOT to consume has to be handed on.
    _canvasPoint(clientX, clientY) {
      const renderer = this._renderer_();
      const canvas = renderer && renderer.canvas;
      if (!canvas || !canvas.getBoundingClientRect) return null;
      const r = canvas.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0)) return null;
      return {
        x: (clientX - r.left) * (canvas.width || r.width) / r.width,
        y: (clientY - r.top) * (canvas.height || r.height) / r.height,
      };
    },

    // Swipe the playing field. A tile game reads far better with a flick in
    // the direction you want to go than with any pad, and the field is already
    // the biggest target on the screen.
    //
    // The threshold is the whole design: under it the gesture is a tap and is
    // handed to the guest as a click, so menus and buttons keep working; over
    // it the gesture is a direction and the guest sees no mouse event at all
    // (a swipe that also clicked would drag a selection across the board).
    _addSwipeField(spec) {
      const opts = spec === true ? {} : (spec || {});
      const el = this._doc.createElement('div');
      el.className = 'tc-swipe';
      el.setAttribute('aria-label', 'swipe field');
      el._tcRect = opts.rect
        ? { x: +opts.rect.x || 0, y: +opts.rect.y || 0,
            w: +opts.rect.w || 0, h: +opts.rect.h || 0 }
        : { x: 0, y: 0, w: 1, h: 1 };
      const map = opts.vks || {};
      const vks = {
        up: Number.isFinite(map.up) ? map.up | 0 : VK.UP,
        down: Number.isFinite(map.down) ? map.down | 0 : VK.DOWN,
        left: Number.isFinite(map.left) ? map.left | 0 : VK.LEFT,
        right: Number.isFinite(map.right) ? map.right | 0 : VK.RIGHT,
      };
      const threshold = Number.isFinite(opts.threshold) ? opts.threshold : SWIPE_PX;
      const touchById = (list, id) => {
        if (!list) return null;
        for (let i = 0; i < list.length; i++) {
          if (list[i].identifier === id) return list[i];
        }
        return null;
      };
      const distance = (list, ids) => {
        const a = touchById(list, ids[0]);
        const b = touchById(list, ids[1]);
        return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
      };
      const centre = (list, ids) => {
        const a = touchById(list, ids[0]);
        const b = touchById(list, ids[1]);
        return a && b ? { x: (a.clientX + b.clientX) / 2,
          y: (a.clientY + b.clientY) / 2 } : null;
      };
      let twoFinger = null;

      // This field sits above the canvas, so the canvas's own pinch/wheel
      // recognizer cannot see Rodent's touches. Give the field the same
      // classification: separation changes Fit/Fill, parallel travel is a
      // wheel, and neither gesture leaks a click or arrow pulse to the guest.
      const beginTwoFinger = (e) => {
        if (twoFinger || !e.touches) return !!twoFinger;
        const ids = [];
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          const entry = this._touches.get(t.identifier);
          if (entry && entry.el === el) ids.push(t.identifier);
          if (ids.length === 2) break;
        }
        const dist = ids.length === 2 ? distance(e.touches, ids) : 0;
        if (!(dist > 0)) return false;
        for (const id of ids) this._touches.delete(id);
        const startCentre = centre(e.touches, ids);
        twoFinger = {
          ids, startDist: dist, startCentre,
          lastCentre: startCentre, mode: null, wheelRemainder: 0,
        };
        const renderer = this._renderer_();
        if (renderer && renderer.beginViewPinch) renderer.beginViewPinch();
        return true;
      };
      const moveTwoFinger = (e) => {
        if (!twoFinger) return false;
        const dist = distance(e.touches, twoFinger.ids);
        const at = centre(e.touches, twoFinger.ids);
        if (!(dist > 0) || !at) return true;
        const scale = dist / twoFinger.startDist;
        if (!twoFinger.mode) {
          const travel = twoFinger.startCentre
            ? Math.hypot(at.x - twoFinger.startCentre.x,
              at.y - twoFinger.startCentre.y) : 0;
          const spanChange = Math.abs(dist - twoFinger.startDist);
          if (spanChange >= 8 && spanChange >= travel * 0.75) {
            twoFinger.mode = 'zoom';
            if (!this._renderer_().updateViewPinch) this.setViewMode(scale > 1 ? 'zoom' : 'fit');
          } else if (travel >= 10) {
            twoFinger.mode = 'wheel';
          }
        }
        if (twoFinger.mode === 'zoom') {
          const renderer = this._renderer_();
          if (renderer && renderer.updateViewPinch) renderer.updateViewPinch(scale);
        }
        if (twoFinger.mode === 'wheel' && twoFinger.lastCentre) {
          twoFinger.wheelRemainder += at.y - twoFinger.lastCentre.y;
          const renderer = this._renderer_();
          const p = this._canvasPoint(at.x, at.y);
          while (renderer && p && typeof renderer.handleWheel === 'function' &&
                 Math.abs(twoFinger.wheelRemainder) >= 24) {
            renderer.handleWheel(p.x, p.y,
              twoFinger.wheelRemainder > 0 ? 1 : -1);
            twoFinger.wheelRemainder += twoFinger.wheelRemainder > 0 ? -24 : 24;
          }
        }
        twoFinger.lastCentre = at;
        return true;
      };
      const endTwoFinger = (e) => {
        if (!twoFinger) return false;
        for (const id of twoFinger.ids) {
          if (touchById(e.touches, id)) return true;
        }
        const renderer = this._renderer_();
        if (twoFinger.mode === 'zoom' && renderer && renderer.endViewPinch) {
          renderer.endViewPinch(e.type === 'touchcancel');
          this.syncViewMode();
        }
        twoFinger = null;
        return true;
      };

      const begin = (e) => {
        e.preventDefault();
        for (const t of changedTouches(e)) {
          if (this._touches.has(t.identifier)) continue;
          this._touches.set(t.identifier, {
            kind: 'swipe', el, x0: t.clientX, y0: t.clientY, fired: false,
          });
        }
        beginTwoFinger(e);
      };
      const move = (e) => {
        e.preventDefault();
        if (moveTwoFinger(e)) return;
        for (const t of changedTouches(e)) {
          const entry = this._touches.get(t.identifier);
          if (!entry || entry.el !== el || entry.fired) continue;
          const dx = t.clientX - entry.x0;
          const dy = t.clientY - entry.y0;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) continue;
          entry.fired = true;
          const dir = Math.abs(dx) >= Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          this._pulse(vks[dir]);
        }
      };
      const end = (e) => {
        e.preventDefault();
        if (endTwoFinger(e)) return;
        for (const t of changedTouches(e)) {
          const entry = this._touches.get(t.identifier);
          if (!entry || entry.el !== el) continue;
          this._touches.delete(t.identifier);
          if (entry.fired) continue;
          // Under the threshold this was never a swipe: give the guest the
          // click the canvas would have seen if the field were not here.
          const renderer = this._renderer_();
          const p = this._canvasPoint(t.clientX, t.clientY);
          if (!renderer || !p || !renderer.handleMouseDown) continue;
          renderer.handleMouseDown(p.x, p.y, 0);
          if (renderer.handleMouseUp) renderer.handleMouseUp(p.x, p.y, 0);
          // Still inside the touch event, which is the only moment iOS will
          // open its keyboard: if that tap put a caret in a guest edit box,
          // this is what raises the keyboard for it.
          if (typeof window !== 'undefined' &&
              typeof window.__wineFocusKeyboardProxy === 'function') {
            window.__wineFocusKeyboardProxy();
          }
        }
      };
      this._on(el, 'touchstart', begin);
      this._on(el, 'touchmove', move);
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      this._on(el, 'contextmenu', (e) => e.preventDefault());

      this.el.appendChild(el);
      this._widgets.push(el);
      this._zones.push(el);
    },

    // A transparent region over the game. `rect` is in fractions of the
    // PRESENTED app rectangle, so the same numbers hold at any window size,
    // any zoom and with or without the bottom inset.
    //
    // A zone may press a guest mouse button instead of a key. Moorhuhn's
    // reload is the right button, and its magazine is drawn in the bottom
    // corner of the picture: laying the zone over the shells makes the
    // ammunition itself the reload control. `label` then puts a faint word
    // inside the zone, since a mouse zone has no key name to discover.
    _addZone(spec) {
      const mouseButton = spec && Number.isFinite(spec.mouseButton) ? spec.mouseButton | 0 : null;
      if (!spec || (!Number.isFinite(spec.vk) && mouseButton === null) || !spec.rect) return;
      const el = this._doc.createElement('div');
      el.className = 'tc-zone';
      el.setAttribute('aria-label', spec.title || spec.label ||
        (mouseButton !== null ? 'mouse button ' + mouseButton : 'key ' + spec.vk));
      el._tcRect = {
        x: +spec.rect.x || 0,
        y: +spec.rect.y || 0,
        w: +spec.rect.w || 0,
        h: +spec.rect.h || 0,
      };
      const vk = mouseButton === null ? spec.vk | 0 : null;
      if (mouseButton !== null && spec.label) {
        el.classList.add('tc-zone-labelled');
        el.textContent = String(spec.label);
      }

      // An in-place zone is invisible by design -- pressing the table IS the
      // control -- but "invisible" and "undiscoverable" are not the same
      // thing. A caption in the letterbox under the picture names the zone
      // without putting a single pixel on the playfield.
      if (spec.caption) {
        const cap = this._doc.createElement('div');
        cap.className = 'tc-caption';
        cap.textContent = String(spec.caption);
        cap._tcAt = Number.isFinite(spec.captionX)
          ? spec.captionX : (el._tcRect.x + el._tcRect.w / 2);
        this.el.appendChild(cap);
        (this._captions || (this._captions = [])).push(cap);
        this._widgets.push(cap);
      }

      const begin = (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (const t of changedTouches(e)) {
          if (this._touches.has(t.identifier)) continue;
          el.classList.add('tc-down');
          if (mouseButton !== null) {
            this._touches.set(t.identifier, { kind: 'mouseButton', mouseButton, el });
            this._mouseButton(mouseButton, true, t.clientX, t.clientY);
          } else {
            this._touches.set(t.identifier, { kind: 'zone', vk, el });
            this._press(vk);
          }
        }
      };
      const end = (e) => {
        e.preventDefault();
        for (const t of changedTouches(e)) {
          const entry = this._touches.get(t.identifier);
          if (!entry || entry.el !== el) continue;
          this._touches.delete(t.identifier);
          el.classList.remove('tc-down');
          if (entry.kind === 'mouseButton') {
            this._mouseButton(entry.mouseButton, false, t.clientX, t.clientY);
          } else {
            this._release(entry.vk);
          }
        }
      };
      this._on(el, 'touchstart', begin);
      this._on(el, 'touchend', end);
      this._on(el, 'touchcancel', end);
      this._on(el, 'contextmenu', (e) => e.preventDefault());

      this.el.appendChild(el);
      this._widgets.push(el);
      this._zones.push(el);
    },

    // Where the guest's picture actually is on the page. Nothing fires when
    // the guest resizes its own window or switches display mode, so this is a
    // poll rather than an event -- two getBoundingClientRect calls every
    // 250ms, and only while a layout has zones.
    _startZoneTracking() {
      this.layoutZones();
      if (this._zoneTimer || typeof setInterval !== 'function') return;
      this._zoneTimer = setInterval(() => this.layoutZones(), 250);
      if (typeof window !== 'undefined' && window.addEventListener) {
        this._zoneResize = () => this.layoutZones();
        window.addEventListener('resize', this._zoneResize);
        window.addEventListener('orientationchange', this._zoneResize);
        const viewport = window.visualViewport;
        if (viewport && viewport.addEventListener) {
          this._zoneViewport = viewport;
          viewport.addEventListener('resize', this._zoneResize);
          viewport.addEventListener('scroll', this._zoneResize);
        }
      }
    },

    _stopZoneTracking() {
      if (this._zoneTimer) { clearInterval(this._zoneTimer); this._zoneTimer = null; }
      if (this._zoneResize && typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('resize', this._zoneResize);
        window.removeEventListener('orientationchange', this._zoneResize);
      }
      if (this._zoneResize && this._zoneViewport && this._zoneViewport.removeEventListener) {
        this._zoneViewport.removeEventListener('resize', this._zoneResize);
        this._zoneViewport.removeEventListener('scroll', this._zoneResize);
      }
      this._zoneResize = null;
      this._zoneViewport = null;
    },

    // Public so a test (and the shell, after a mode switch) can force it.
    // index.html's "swipe up here for more screen" gutter is a fixed strip
    // across the top of the screen, above this overlay (z-index 39 vs 30), so
    // a real tap on a top-corner button landed on the gutter: Esc/Enter on the
    // driving layouts and Opts/Esc on FreeSpace were dead until Safari's bars
    // collapsed (elementFromPoint, WebKit 844x390). The gutter already stops
    // short of the exit chip; this tells it where the overlay's own top
    // corners end, as --tc-top-left-reserve / --tc-top-right-reserve on the
    // root element, so it starts and ends clear of them. Hidden controls (a
    // modal dialog is up) and a torn-down overlay reserve nothing.
    _publishTopReserve(hidden) {
      const root = this._doc && this._doc.documentElement;
      if (!root || !root.style || typeof root.style.setProperty !== 'function') return;
      const width = typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
        ? window.innerWidth : 0;
      let left = 0, right = 0;
      if (!hidden && this.installed && this._corners) {
        for (const widget of this._widgets) {
          const corner = ['tl', 'tr'].find(c => this._corners[c] && this._corners[c].contains &&
            this._corners[c].contains(widget));
          if (!corner || !widget.getBoundingClientRect) continue;
          const r = widget.getBoundingClientRect();
          if (!(r.width > 0 && r.height > 0)) continue;
          if (corner === 'tl') left = Math.max(left, Math.ceil(r.right) + TOP_RESERVE_GAP_PX);
          else if (width) right = Math.max(right, Math.ceil(width - r.left) + TOP_RESERVE_GAP_PX);
        }
      }
      if (left === this._topReserveLeft && right === this._topReserveRight) return;
      this._topReserveLeft = left;
      this._topReserveRight = right;
      root.style.setProperty('--tc-top-left-reserve', left + 'px');
      root.style.setProperty('--tc-top-right-reserve', right + 'px');
    },

    layoutZones() {
      if (!this.el) return this;
      const renderer = this._renderer_();
      const modal = renderer && renderer.getActiveModalWindow && renderer.getActiveModalWindow();
      if (modal && !this._modalControlsHidden) this.releaseAll();
      this._modalControlsHidden = !!modal;
      for (const widget of this._widgets) {
        if (widget !== this._keyEl) widget.style.visibility = modal ? 'hidden' : '';
      }
      this._publishTopReserve(!!modal);
      // The keyboard may cover the controls. Preserve their pre-keyboard
      // anchors rather than following the shrunken visual viewport upward.
      if (this._doc.body.classList.contains('keyboard-open')) return this;
      this._enforceLandscapeView();
      // A rotation fires no event this layer subscribes to that also knows the
      // chip's answer has changed, so re-ask on the poll that is already here.
      if (this._modeEl) this.syncViewMode();
      const app = renderer && typeof renderer.getPresentedRectClient === 'function'
        ? renderer.getPresentedRectClient() : null;
      const host = this.el.getBoundingClientRect ? this.el.getBoundingClientRect() : null;
      if (!host) return this;
      // Move orientation-specific action buttons between phone corners when
      // rotating, while keeping the same button and its touch listeners.
      for (const widget of this._widgets) {
        if (!widget._tcLandscapeCorner) continue;
        const corner = host.width > host.height
          ? widget._tcLandscapeCorner : widget._tcCorner;
        const row = this._rowNode(corner, widget._tcRow | 0);
        if (widget.parentNode !== row) row.appendChild(widget);
      }
      // A running guest deliberately keeps its 100vh layout size while
      // Safari's retractable toolbar changes the *visual* viewport. Anchor
      // controls to the visible bottom without resizing the guest itself.
      let usableHost = host;
      const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
      if (viewport && Number.isFinite(viewport.height)) {
        const visualBottom = Math.min(host.bottom,
          (Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0) + viewport.height);
        if (visualBottom > host.top && visualBottom < host.bottom) {
          usableHost = {
            left: host.left, right: host.right, top: host.top,
            bottom: visualBottom, width: host.width,
            height: visualBottom - host.top,
          };
        }
      }
      const bottomInset = Math.max(0, host.bottom - usableHost.bottom);
      this._utilityBottomInset = bottomInset;
      const mouseLandscape = this.layout && this.layout.mouseJoystick && usableHost.width > usableHost.height;
      const landscapeLeftInset = this.layout && Number.isFinite(this.layout.landscapeLeftInset) &&
        usableHost.width > usableHost.height ? Math.max(0, this.layout.landscapeLeftInset) : null;
      const meta = this._doc.querySelector && this._doc.querySelector('meta[name="viewport"]');
      const coversNotch = meta && /viewport-fit\s*=\s*cover/.test(meta.content || '');
      for (const corner of ['bl', 'br']) {
        if (this._corners && this._corners[corner]) {
          // Without viewport-fit=cover, Safari already insets the landscape
          // viewport. Adding env(safe-area-inset-*) again put the stick 68px
          // from that inset edge and over the game. Use the outer rail edge;
          // a cover viewport still needs its explicit notch protection.
          const leftInset = corner === 'bl' && landscapeLeftInset !== null
            ? landscapeLeftInset : mouseLandscape ? 8 : null;
          this._corners[corner].style.paddingLeft = leftInset !== null
            ? (coversNotch ? `calc(${leftInset}px + env(safe-area-inset-left, 0px))` : leftInset + 'px') : '';
          this._corners[corner].style.paddingRight = mouseLandscape
            ? (coversNotch ? 'calc(8px + env(safe-area-inset-right, 0px))' : '8px') : '';
          this._corners[corner].style.paddingBottom = this.layout && this.layout.mouseJoystick
            ? 'calc(36px + env(safe-area-inset-bottom, 0px))' : '';
          this._corners[corner].style.bottom = bottomInset + 'px';
          const landscape = this.layout &&
            (this.layout.boardLayout || this.layout.landscapeCenterControls) &&
            usableHost.width > usableHost.height;
          this._corners[corner].style.bottom = landscape
            ? (bottomInset + Math.max(0, (usableHost.height - 204) / 2)) + 'px'
            : bottomInset + 'px';
          if (this.layout && this.layout.mouseJoystick) {
            // Primary action above the rarely-used pills. Keep the whole
            // group inside the safe bottom, including when Fill has no gap.
            if (corner === 'br') this._corners[corner].style.bottom =
              (parseFloat(this._corners[corner].style.bottom) + 58) + 'px';
            if (!mouseLandscape && app && app.w > 0 && app.h > 0) {
              const style = typeof window !== 'undefined' && window.getComputedStyle
                ? window.getComputedStyle(this._corners[corner]) : null;
              const padding = style ? parseFloat(style.getPropertyValue('padding-bottom')) || 36 : 36;
              const groupTop = Math.max(usableHost.top,
                Math.min(app.y + app.h + 24, usableHost.bottom - padding - 116));
              const height = corner === 'bl' ? 112 : 58;
              this._corners[corner].style.bottom =
                Math.max(bottomInset, host.bottom - groupTop - height - padding) + 'px';
            }
          }
        }
      }
      this._centerCornersInGutters(app, host, usableHost);
      if (!app || !(app.w > 0) || !(app.h > 0)) {
        // No presented rect to hang zones off, but the pills still have to go
        // somewhere -- a full-bleed host means no letterbox, which is exactly
        // the edge-pill case.
        this._placeModeToggle(
          { x: usableHost.left, y: usableHost.top,
            w: usableHost.width, h: usableHost.height }, usableHost);
        return this;
      }
      const crop = renderer && renderer.mobileCrop;
      const onCrop = !!(this.layout && this.layout.zonesOnCrop && crop);
      // Where the CROP is on screen, which is not the presented rect and not a
      // fixed fraction of it either. Fit presents the whole window; Fill
      // presents the crop -- but only after the renderer has grown it back out
      // to the shape of the hole it goes in, and how far it grows depends on
      // the phone's aspect and on what the controls reserved. Measured on a
      // 667x375 landscape viewport the grown source is the ENTIRE 641x481
      // scene, score panel included, so "fractions of the presented rect" puts
      // the flipper split down the middle of the scene and a corner button on
      // the score readout. Map through the viewport's own source rect instead:
      // it is exact in every mode, and there is no aspect it can drift on.
      const zoneApp = (onCrop && this._cropRectClient(app)) ||
        (onCrop && renderer.viewMode !== 'zoom'
          ? { x: app.x + crop.x * app.w, y: app.y + crop.y * app.h,
              w: crop.w * app.w, h: crop.h * app.h } : app);
      const ox = zoneApp.x - host.left;
      const oy = zoneApp.y - host.top;
      for (const el of this._zones) {
        const r = el._tcRect;
        el.style.left = (ox + r.x * zoneApp.w) + 'px';
        el.style.top = (oy + r.y * zoneApp.h) + 'px';
        el.style.width = (r.w * zoneApp.w) + 'px';
        el.style.height = (r.h * zoneApp.h) + 'px';
      }
      // A guest text field beats every gesture on this layer. The high-score
      // dialog Rodent's Revenge puts up wants a name typed into it, and a
      // swipe field over the picture would eat the tap that focuses the edit
      // control -- and with it the gesture iOS requires to open its keyboard.
      const caret = renderer && typeof renderer.caretRect === 'function'
        ? renderer.caretRect() : null;
      for (const el of this._zones) el.style.pointerEvents = caret ? 'none' : 'auto';
      this._layoutBoardButtons(zoneApp, host);
      this._layoutCaptions(zoneApp, host, usableHost, app);
      this._placeModeToggle(app, usableHost);
      return this;
    },

    // The mobileCrop rectangle in client coordinates, mapped through the
    // presentation viewport the renderer last produced.
    //
    // The crop's fractions are of the WINDOW rect, and the viewport's cropX/
    // cropY are in whatever frame that window lives in (canvas coordinates for
    // a single-app zoom, window-local for an exclusive presentation). So the
    // renderer hands over the rectangle the fractions are of, in that same
    // frame, as `viewport.cropBase` -- this layer must not guess it.
    //
    // It used to guess it as the CANVAS, which is only right when the window
    // fills the canvas. Measured on the phone: a 641x757 canvas carrying a
    // 641x481 Pinball window made the width right by coincidence (641 == 641)
    // and stretched the height by 757/481, putting the table's bottom 129px
    // below the screen -- which hid every zone caption (no band left under the
    // picture, so the landscape gutter branch took over and found no gutters)
    // and dropped both nudge chips 19px onto the artwork.
    //
    // Returns null when there is no viewport to map through; every caller
    // falls back to the old fractions-of-the-presented-rect placement.
    _cropRectClient(app) {
      const r = this._renderer_();
      const crop = r && r.mobileCrop;
      const v = r && r._exclusivePresentationViewport;
      if (!crop || !v || !r._exclusiveFullscreen) return null;
      if (!(v.cropW > 0) || !(v.cropH > 0) || !(v.dstW > 0) || !(v.dstH > 0)) return null;
      // Older viewports (and any path that has not declared a base) keep the
      // canvas reading rather than losing the mapping altogether.
      const base = v.cropBase && v.cropBase.w > 0 && v.cropBase.h > 0
        ? v.cropBase
        : { x: 0, y: 0, w: r.canvas && r.canvas.width, h: r.canvas && r.canvas.height };
      if (!(base.w > 0) || !(base.h > 0)) return null;
      const bx = (base.x || 0) + crop.x * base.w;
      const by = (base.y || 0) + crop.y * base.h;
      const kx = app.w / v.cropW, ky = app.h / v.cropH;
      return {
        x: app.x + (bx - v.cropX) * kx,
        y: app.y + (by - v.cropY) * ky,
        w: crop.w * base.w * kx,
        h: crop.h * base.h * ky,
      };
    },

    // Buttons pinned to a corner of the PICTURE. Pinball's table is drawn in
    // perspective, so its own bounding box has a black triangle at each top
    // corner -- the only real estate on the phone that is inside the picture
    // and yet carries nothing. The nudges live there: a nudge is aimed at a
    // side of the table, so a control ON that side of the table needs no
    // label to be read, and putting them here empties the bottom rails.
    //
    // They are round and they hug the outer corner, because the space they
    // occupy is a triangle: the diagonal runs away from the corner, so the
    // further a control's bulk is from it the sooner it meets the artwork.
    // A `fit` on the spec replaces the corner hug with a MEASURED circle: the
    // largest one that lies inside the black, as fractions of the board rect
    // ({cx, cy} its centre, {r} its radius as a fraction of the WIDTH, since
    // the scale is uniform). The corner hug is a guess that only holds while
    // the picture is big; the same 52px circle that sits comfortably in
    // Pinball's triangle in portrait (table 375 wide) overruns it in landscape
    // (table 280 wide), which is what "tilt arrows can be a bit adjusted so
    // that they don't intersect table (in landscape)" reported.
    //
    // The 44px floor wins over the measurement: a control too small to hit is
    // worse than one that touches the artwork. Below about a 250px-wide table
    // the fitted circle IS under 44px, and the button then hugs the corner as
    // tightly as the rect allows and overruns the diagonal by (44 - fitted)/2.
    _layoutBoardButtons(app, host) {
      const list = this._boardButtons || [];
      if (!list.length || !app || !(app.w > 0) || !(app.h > 0)) return;
      const INSET = 6;
      for (const el of list) {
        const corner = el._tcBoardCorner || 'tl';
        const left = corner === 'tl' || corner === 'bl';
        const top = corner === 'tl' || corner === 'tr';
        const fit = el._tcBoardFit;
        let size = el._tcBoardSize || 52;
        let x, y;
        if (fit && fit.r > 0) {
          const fitted = 2 * fit.r * app.w;
          size = Math.max(40, Math.min(fitted, el._tcBoardSize || 52));
          const cx = app.x + (left ? fit.cx : 1 - fit.cx) * app.w;
          const cy = app.y + (top ? fit.cy : 1 - fit.cy) * app.h;
          x = cx - size / 2;
          y = cy - size / 2;
          // Under the floor the circle no longer fits where it was measured to
          // fit; keep it inside the rect so the overrun is only the diagonal.
          x = left ? Math.max(app.x, x) : Math.min(app.x + app.w - size, x);
          y = top ? Math.max(app.y, y) : Math.min(app.y + app.h - size, y);
        } else {
          x = left ? app.x + INSET : app.x + app.w - INSET - size;
          y = top ? app.y + INSET : app.y + app.h - INSET - size;
        }
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        // Clamp into the overlay: a picture that runs off the screen (Fill on
        // a tall crop) must not take its buttons with it.
        el.style.left = Math.max(0, Math.min(x - host.left, host.width - size)) + 'px';
        el.style.top = Math.max(0, Math.min(y - host.top, host.height - size)) + 'px';
      }
    },

    // Captions go in the letterbox directly under the picture, never on the
    // artwork and never anywhere else. "Just have it right under the table" is
    // what was asked for, and it is also the only placement that works: a
    // caption names an INVISIBLE zone, so it has to be adjacent to the thing
    // it names or it names nothing.
    //
    // A side gutter is not adjacent. This used to fall back to one in
    // landscape -- the flipper captions to the far left and right edges of the
    // screen, "Launch" stacked above one of them -- and the report from the
    // phone was "the captions for flippers and Launch are all wrong in
    // landscape". The flippers are at the BOTTOM CENTRE of the table; a label
    // pinned to the screen's edge, level with nothing, does not read as
    // naming them. So landscape shows no captions at all: the zones are where
    // a thumb already rests, and nothing beats a misleading label like the
    // absence of one.
    //
    // `app` is the TABLE (the crop); `picture` (the whole presented rect) is
    // no longer consulted here and is kept only so callers read the same.
    _layoutCaptions(app, host, usableHost) {
      const list = this._captions || [];
      if (!list.length) return;
      const GAP = 8, LINE = 16;
      // Clear the placement along with the caption. `hidden` alone leaves the
      // inline left/top from the last run that did place it, which reads, in
      // any later inspection, as a caption that IS placed and merely invisible.
      const hideAll = () => {
        for (const cap of list) {
          cap.hidden = true;
          cap.style.left = '';
          cap.style.top = '';
        }
      };
      if (!app || !(app.w > 0) || !(app.h > 0)) return hideAll();
      if (host.width > host.height) return hideAll();
      if (usableHost.bottom - (app.y + app.h) < GAP + LINE) return hideAll();
      for (const cap of list) {
        cap.hidden = false;
        cap.style.transform = 'translateX(-50%)';
        cap.style.left = (app.x - host.left + cap._tcAt * app.w) + 'px';
        cap.style.top = (app.y + app.h + GAP - host.top) + 'px';
      }
    },

    // Centre each landscape cluster in the letterbox gutter beside the
    // picture, instead of leaving it jammed against the phone's own edge.
    //
    // THE CIRCULARITY, and why this is not it: getBoardArea() reserves a side
    // rail as a fixed fraction of the SCREEN, presentation fits the picture
    // inside what is left, and the gutter is only known afterwards. Feeding
    // the measured gutter back into getBoardArea() would make the reservation
    // depend on the fit that depends on the reservation, and the two would
    // chase each other every frame. So the reservation is left exactly as it
    // was -- it is an input, it stays constant, the viewport it produces is
    // therefore stable -- and only the WIDGETS follow the last presented rect.
    // That is a one-way read of a fixed point, so it converges in one pass:
    // moving a button changes nothing presentation measures.
    //
    // Horizontal only. Vertically a board cluster is already centred in the
    // full height (which is the whole gutter), and a mouse-joystick one is
    // deliberately thumb-low.
    //
    // The shift never moves a cluster OUTWARD, so the no-gutter case (a wide
    // game filling the screen, or a picture wider than the rail column) keeps
    // today's edge-anchored floating layout with no reserved strip, and a
    // gutter narrower than the buttons cannot push them off the bezel.
    _centerCornersInGutters(app, host, usableHost) {
      const shift = this._gutterShift || (this._gutterShift = { bl: 0, br: 0 });
      const landscape = usableHost.width > usableHost.height;
      const active = landscape && this.isVisible() && app && app.w > 0 && app.h > 0;
      for (const corner of ['bl', 'br']) {
        const el = this._corners && this._corners[corner];
        if (!el) continue;
        let dx = 0;
        // An explicitly corner-paired keyboard (SkiFree's New game + keyboard)
        // stays with its button at the phone edge, not the game's gutter.
        const pairedKeyboard = this.layout && this.layout.keyboardCorner &&
          normalizeCorner(this.layout.keyboardCorner) === corner;
        const phoneLeftInset = corner === 'bl' && this.layout &&
          Number.isFinite(this.layout.landscapeLeftInset);
        if (active && !pairedKeyboard && !phoneLeftInset &&
            !(this.layout && this.layout.screenAnchored) && el.getBoundingClientRect) {
          // Measure UNSHIFTED. getBoundingClientRect reports the transformed
          // box, so measuring on top of the previous shift compounds it every
          // 250ms and walks the cluster off the screen. Clearing the transform
          // first costs one synchronous reflow and keeps no state that can go
          // stale; nothing paints between the two writes.
          if (shift[corner]) el.style.transform = '';
          const r = el.getBoundingClientRect();
          if (r && r.width > 0) {
            const style = typeof window !== 'undefined' && window.getComputedStyle
              ? window.getComputedStyle(el) : null;
            const pad = side => {
              const raw = style ? style.getPropertyValue('padding-' + side)
                : (el.style && el.style['padding' + side[0].toUpperCase() + side.slice(1)]);
              const n = parseFloat(raw);
              return Number.isFinite(n) ? n : 18;
            };
            const padL = pad('left');
            const padR = pad('right');
            const contentW = Math.max(0, r.width - padL - padR);
            const left = r.left - host.left;
            const right = left + r.width;
            // A cluster WIDER than its gutter cannot be centred in it, and
            // leaving it at its inset pushes it onto the picture -- which in
            // Pinball's landscape put the 115px "New game" pill 10px inside
            // the left flipper zone, the one control whose accidental press
            // destroys a game in progress. There is nothing to centre, so hug
            // the bezel instead: it is the furthest point from the play area
            // that exists, and "buttons like new game and keyboard should be
            // close to the edges, out of the reach of fingers when touching
            // flippers" is exactly that.
            // ...but only where a gutter EXISTS. A picture that fills the
            // screen edge to edge has none, every placement is over the game,
            // and the old edge-anchored float is as good as anything; moving
            // it there would be motion for its own sake.
            if (corner === 'bl') {
              const gutter = Math.max(0, app.x - host.left);
              dx = gutter > 0 && contentW > gutter
                ? -(left + padL)
                : Math.max(0, (gutter - contentW) / 2 - (left + padL));
            } else {
              const gutter = Math.max(0, host.left + host.width - (app.x + app.w));
              const want = host.width - (gutter - contentW) / 2;
              dx = gutter > 0 && contentW > gutter
                ? host.width - (right - padR)
                : Math.min(0, want - (right - padR));
            }
            if (!Number.isFinite(dx)) dx = 0;
          }
        }
        shift[corner] = dx;
        el.style.transform = dx ? 'translateX(' + dx + 'px)' : '';
      }
    },

    // Keep the quiet keyboard and Fit/Fill controls at the PHONE's lower-right
    // edge. Game-control clusters can move into a letterbox gutter or follow a
    // changing board crop; utility controls must not ride with them. Leave an
    // empty chip row behind so a New game/Launch button stays above the pills.
    // SkiFree explicitly pairs its keyboard with New game at lower-left; that
    // pair remains in its row, but the corner itself never follows a gutter.
    _placeModeToggle() {
      const pairedKey = !!(this._keyEl && this.layout && this.layout.keyboardCorner);
      const pills = [this._modeEl, pairedKey ? null : this._keyEl].filter(Boolean);
      if (!pills.length) return;
      if (!this._utilityRow) {
        this._utilityRow = this._doc.createElement('div');
        this._utilityRow.className = 'tc-utility-row';
        this.el.appendChild(this._utilityRow);
      }
      const landscape = this.el && this.el.getBoundingClientRect &&
        (() => { const r = this.el.getBoundingClientRect(); return r.width > r.height; })();
      this._utilityRow.style.bottom = landscape
        ? (8 + (this._utilityBottomInset || 0)) + 'px'
        : 'calc(18px + env(safe-area-inset-bottom, 0px) + ' +
          (this._utilityBottomInset || 0) + 'px)';
      for (const p of pills) {
        if (p.parentNode !== this._utilityRow) this._utilityRow.appendChild(p);
        p.style.position = '';
        p.style.left = '';
        p.style.top = '';
        p.style.transform = '';
        p.style.width = '';
        p.style.opacity = '';
      }
      if (this._modeEl) this._modeEl.style.display = this._modalControlsHidden ? 'none' : '';
      const shown = pills.filter(p => !p.hidden &&
        !(p === this._modeEl && this._modalControlsHidden));
      this._utilityRow.hidden = shown.length === 0;
      const spacer = this._rows && this._rows['br:-1'];
      if (spacer) {
        spacer.style.height = shown.length ? '40px' : '';
        spacer.style.width = shown.length ? (shown.length * 40 + (shown.length - 1) * 10) + 'px' : '';
      }
    },

    // "Are the app's own game controls up?" -- NOT "is any part of the overlay
    // on screen". The keyboard pill is now put up for every app on a touch
    // device, and the two callers of this (the renderer's bottom inset and the
    // touch-cursor suppression policy) both mean the game controls: a pill in
    // the letterbox reserves no space and is no reason to take a cursor away
    // from Solitaire.
    isVisible() {
      return !!(this.installed && this.layout && this._hasGameControls && this.el &&
        this.el.style.display !== 'none');
    },

    // "Is anything of ours on screen?" -- the pills included.
    isMounted() {
      return !!(this.installed && this.layout && this.el &&
        this.el.style.display !== 'none');
    },

    // Does this layout take a BAND (portrait) or a RAIL (landscape) out of the
    // screen, or does it only sit in a corner of the picture?
    //
    // A dpad, an analogue stick, an in-place zone and a swipe strip are all
    // things a thumb rests in or drags across, and they are wide: the picture
    // has to move out of their way or the hand covers the game. A couple of
    // chips in one bottom corner do not. They are small and translucent, the
    // app chose them precisely so nothing would need reserving, and giving
    // them the full 204px band costs a third of a phone screen.
    //
    // SkiFree is the whole of that case in the registry -- its skier follows
    // the pointer, so it has no pad on purpose and its layout is two corner
    // buttons. It was being handed a 400x494 desktop on a 375x667 phone, with
    // the bottom third of the screen bare teal, which is the "does not expand
    // to full screen" report. Every other app with game controls has a dpad, a
    // mouse joystick or zones, so none of them changes here.
    //
    // isVisible() alone is still the gate: chrome-only pills never reserve.
    reservesBand() {
      if (!this.isVisible()) return false;
      const layout = this.layout || {};
      return !!(layout.dpad || (layout.dpads && layout.dpads.length) ||
        layout.mouseJoystick || (layout.zones && layout.zones.length) ||
        layout.swipes);
    },

    // The height of the bottom band the CORNER widgets occupy, in CSS pixels.
    // Zones are excluded on purpose: they lie over the picture and reserving
    // space for them would push the game away from its own controls.
    //
    // Measured off layout when there is layout to measure, and estimated from
    // the widget stack when there is not (a hidden page, a fake DOM).
    getBoardArea() {
      if (this._doc.body.classList.contains('keyboard-open') && this._boardArea) return this._boardArea;
      const host = this.el && this.el.getBoundingClientRect();
      if (!host || !host.width || !host.height) return { x: 0, y: 0, w: 1, h: 1 };
      const vv = typeof window !== 'undefined' && window.visualViewport;
      const style = typeof window !== 'undefined' && window.getComputedStyle
        ? window.getComputedStyle(this.el) : null;
      const safe = edge => style ? Math.max(0, parseFloat(style.getPropertyValue('--tc-safe-' + edge)) || 0) : 0;
      // CSS safe-area values are viewport-relative; do not add them again
      // when the host already starts below the status bar/notch.
      const top = Math.max(0, (vv ? vv.offsetTop || 0 : 0) - host.top, safe('top') - host.top);
      const left = Math.max(0, safe('left') - (host.left || 0));
      const right = Math.max(0, safe('right') - Math.max(0,
        ((typeof window !== 'undefined' && window.innerWidth) || host.width) - ((host.left || 0) + host.width)));
      const height = Math.max(1, Math.min(host.height,
        vv ? vv.height + (vv.offsetTop || 0) - host.top : host.height));
      // Only an app with GAME controls gives up screen for them. The two
      // utility pills float over the picture, and the keyboard one of them
      // opens is a temporary overlay with its own button to dismiss it --
      // reserving a permanent band for that is how Notepad ended up using
      // three quarters of the phone with two small chips in the gap.
      const reserve = this.reservesBand();
      if (host.width > height) {
        const side = reserve
          ? Math.min(this.layout && this.layout.mouseJoystick ? 148 : 204, host.width * 0.30) : 0;
        return this._boardArea = { x: Math.max(side, left) / host.width, y: top / host.height,
          w: Math.max(1, host.width - Math.max(side, left) - Math.max(side, right)) / host.width,
          h: Math.max(1, height - top) / host.height };
      }
      // 204px holds a pad beside two button rows (quake2_demo). A taller
      // corner stack -- the shooters' third row of Use/Weapon -- reserves what
      // it actually covers, or its top row lands on the bottom of the picture
      // (Daikatana's and Kingpin's HUD at 390x844). Capped at half the screen
      // so a broken measurement cannot squeeze the game away.
      const minBand = this.layout && this.layout.mouseJoystick ? 200 : 204;
      const band = reserve
        ? Math.max(minBand, Math.min(this.getOccupiedHeight(), height / 2)) : 0;
      return this._boardArea = { x: left / host.width, y: top / host.height,
        w: Math.max(1, host.width - left - right) / host.width,
        h: Math.max(1, height - band - top) / host.height };
    },

    getOccupiedHeight() {
      if (!this.isVisible()) return 0;
      const host = this.el.getBoundingClientRect ? this.el.getBoundingClientRect() : null;
      if ((this.layout.boardLayout || this.layout.screenAnchored) && host) {
        const vv = typeof window !== 'undefined' && window.visualViewport;
        const visibleHeight = vv ? Math.min(host.height, vv.height) : host.height;
        if (host.width > visibleHeight) return 0; // controls occupy side rails
      }
      let band = 0;
      if (host && host.height > 0) {
        for (const el of (this._widgets || [])) {
          if (this.layout.screenAnchored && (el === this._modeEl || el === this._keyEl)) continue;
          if (el._tcCorner !== 'bl' && el._tcCorner !== 'br') continue;
          const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
          if (!r || !(r.height > 0)) continue;
          band = Math.max(band, host.bottom - r.top);
        }
        if (band > 0) return Math.min(band, host.height);
      }
      return this._estimateOccupiedHeight();
    },

    // Same number as a fraction of the overlay's own height, which is the form
    // the renderer wants: it works in presentation-canvas pixels and has no
    // business knowing the page's CSS scale.
    // Cached for a quarter second: the renderer asks once per repaint and the
    // answer is two getBoundingClientRect calls, which force layout. Nothing
    // that changes it (a layout swap, a rotation, a resize) is faster than
    // that anyway.
    getOccupiedFraction() {
      const now = typeof Date !== 'undefined' ? Date.now() : 0;
      if (this._fracAt && now - this._fracAt < 250) return this._frac;
      const value = this._occupiedFraction();
      this._fracAt = now;
      this._frac = value;
      return value;
    },

    _occupiedFraction() {
      const band = this.getOccupiedHeight();
      if (!(band > 0)) return 0;
      const host = this.el && this.el.getBoundingClientRect
        ? this.el.getBoundingClientRect() : null;
      const h = host && host.height > 0 ? host.height :
        (typeof window !== 'undefined' && window.innerHeight) || 0;
      if (!(h > 0)) return 0;
      return Math.min(1, band / h);
    },

    // Rows stack bottom-up with a 12px gap inside 18px of padding.
    _estimateOccupiedHeight() {
      const GAP = 12;
      const PAD_BOTTOM = 18;
      let best = 0;
      for (const corner of ['bl', 'br']) {
        const rows = new Map();
        for (const el of (this._widgets || [])) {
          if (el._tcCorner !== corner) continue;
          const row = el._tcRow | 0;
          rows.set(row, Math.max(rows.get(row) || 0, el._tcHeight || 58));
        }
        if (!rows.size) continue;
        let total = PAD_BOTTOM + (rows.size - 1) * GAP;
        for (const h of rows.values()) total += h;
        best = Math.max(best, total);
      }
      return best;
    },

    _clearWidgets() {
      this.releaseAll();
      this._stopMouseJoystick = null;
      for (const [target, type, fn, capture] of this._listeners) {
        if (target.removeEventListener) target.removeEventListener(type, fn, capture);
      }
      this._listeners = [];
      this._widgets = [];
      this._zones = [];
      this._boardButtons = [];
      this._captions = [];
      this._modeFace = null;
      this._modeEl = null;
      this._keyEl = null;
      this._utilityRow = null;
      this._utilityBottomInset = 0;
      this._hasGameControls = false;
      this._stopZoneTracking();
      this._corners = {};
      this._rows = {};
      if (this.el) {
        while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
      }
      this._publishTopReserve(true);
    },

    // Every key this overlay is holding goes up. Called on teardown and on any
    // layout change: an app that closed mid-flipper must not leave the next one
    // with Z down.
    releaseAll() {
      if (this._stopMouseJoystick) this._stopMouseJoystick();
      if (this._touches) {
        for (const entry of this._touches.values()) {
          if (entry.el) entry.el.classList.remove('tc-down');
          this._stopRepeat(entry);
          if (entry.kind === 'mouseButton') {
            this._mouseButton(entry.mouseButton, false, 0, 0);
          }
        }
      }
      if (this._keyUpTimers) for (const vk of Array.from(this._keyUpTimers.keys())) this._flushKeyUp(vk);
      if (!this._held) return;
      for (const vk of Array.from(this._held.keys())) this._key(vk, false);
      if (this._keyUpTimers) for (const vk of Array.from(this._keyUpTimers.keys())) this._flushKeyUp(vk);
      this._held.clear();
      if (this._touches) this._touches.clear();
    },

    destroy() {
      if (!this.installed) return;
      this._clearWidgets();
      if (this._doc && this._doc.body && this._doc.body.classList)
        this._doc.body.classList.remove('touch-screen-anchored');
      if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
      this.el = null;
      this.layout = null;
      this.installed = false;
      this._publishTopReserve(true);
    },

    // The layout an app with no touchControls entry of its own gets: the
    // keyboard pill and nothing else. Deliberately NOT the fit/fill toggle --
    // that one drives a per-app mobileCrop nobody has authored for these apps,
    // and an affordance that does nothing visible is worse than no affordance.
    // Frozen and shared so `sync` can compare it by identity and not rebuild
    // the overlay on every call.
    _chromeLayout() {
      if (!this._chromeLayoutObj) {
        this._chromeLayoutObj = { viewToggle: false, keyboard: true, chrome: true };
      }
      return this._chromeLayoutObj;
    },

    // The shell's one entry point: hand it the running-app records and it puts
    // up the layout of the most recently launched app that declares one.
    sync(runningApps, renderer) {
      if (renderer) this.setRenderer(renderer);
      const list = Array.isArray(runningApps) ? runningApps : [];
      let layout = null;
      for (let i = list.length - 1; i >= 0; i--) {
        const app = list[i];
        if (app && app.touchControls) { layout = app.touchControls; break; }
      }
      // Every running app gets the bare chrome, whether or not it declares
      // controls. The keyboard pill is the reason: Diablo II has no
      // touchControls entry and should not need one to be typed into, and no
      // registry edit can cover the apps we have not met yet.
      if (!layout && list.length) layout = this._chromeLayout();
      if (!layout) {
        if (this.installed && this.layout) this.setLayout(null);
        return this;
      }
      if (!this.installed) {
        if (!this.shouldInstall()) return this;
        this.install({ renderer });
        if (!this.installed) return this;
      }
      if (this.layout !== layout) this.setLayout(layout);
      return this;
    },
  };

  TouchControls.VK = VK;
  TouchControls._dpadKeys = dpadKeys;   // exported for the unit test

  if (typeof window !== 'undefined') window.TouchControls = TouchControls;
  if (typeof module !== 'undefined' && module.exports) module.exports = TouchControls;
})();
