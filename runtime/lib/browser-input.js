// The DOM -> renderer input bridge: everything that turns a browser mouse,
// touch, or key event into a call on the Win98 renderer, plus the pieces that
// only exist because a browser is not a PC — pointer capture outside the
// canvas, the hidden textarea iOS needs before it will open a keyboard, the
// audio unlock that has to ride on a real user gesture, and the clicks that
// belong to the HTML desktop behind the canvas rather than to the guest.
//
// This was 380 lines inside index.html, which made it markup-adjacent by
// accident: the one place where guest input semantics are decided could not be
// read, diffed, or reasoned about without scrolling through a page template.
// It is still browser-only code — the CLI feeds the renderer through its own
// input queue — but it is now a file with a name.
//
// Wiring is once-per-page (a second call is a no-op); `browserInput.isWired()`
// answers the question the desktop icons ask before a guest exists, when their
// own click handlers are still the ones on the canvas.

(function () {
  let inputWired = false;

  // deps.runningApps — the live array of launched guests (audio unlock, and
  //   whether a keypress has anywhere to go at all).
  // deps.debugMode — the ?debug page keeps its HTML desktop clickable through
  //   the canvas; a normal page gives empty-desktop clicks to the guest.
  function wireCanvasInput(canvas, renderer, deps) {
    const runningApps = (deps && deps.runningApps) || [];
    const DEBUG_MODE = !!(deps && deps.debugMode);
    if (inputWired) return;
    inputWired = true;
    canvas.oncontextmenu = e => e.preventDefault();
    function eventPointFromClient(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const sx = canvas.width / r.width, sy = canvas.height / r.height;
      const x = Math.floor((clientX - r.left) * sx);
      const y = Math.floor((clientY - r.top) * sy);
      return { x, y };
    }
    function eventPoint(e) {
      return eventPointFromClient(e.clientX, e.clientY);
    }
    function pointerLocked() {
      return (document.pointerLockElement || document.webkitPointerLockElement) === canvas;
    }
    // Cursor visibility/clipping do not identify the input protocol. Diablo
    // hides its system cursor but still consumes absolute positions.
    function exclusivePresentationActive() {
      return !!(renderer._exclusiveTransform || renderer._exclusivePresentationViewport);
    }
    function activeMouseApp() {
      for (let i = runningApps.length - 1; i >= 0; i--) {
        const app = runningApps[i];
        if (!app || app.wine?.running === false) continue;
        return app;
      }
      return null;
    }
    function wantsRelativeMouse(canvasX, canvasY) {
      if (!exclusivePresentationActive()) return false;
      const app = activeMouseApp();
      if (app) {
        // true: the registry opted in. false: it opted out. Absent: follow
        // the guest's runtime signals (renderer._autoRelativeMouse).
        if (app.relativeMouse === false) return false;
        if (app.relativeMouse === true) {
          return !renderer.wantsRelativeMouse ||
            renderer.wantsRelativeMouse(canvasX, canvasY, true);
        }
        return !!(renderer.wantsRelativeMouse &&
          renderer.wantsRelativeMouse(canvasX, canvasY, 'auto'));
      }
      return false;
    }
    function activeMobileTouchMode() {
      for (let i = runningApps.length - 1; i >= 0; i--) {
        const app = runningApps[i];
        if (!app || (app.wine && app.wine.running === false)) continue;
        if (app.mobileTouch === 'direct' || app.mobileTouch === 'trackpad') {
          return app.mobileTouch;
        }
        break;
      }
      return 'auto';
    }
    function activeHideHostCursor() {
      for (let i = runningApps.length - 1; i >= 0; i--) {
        const app = runningApps[i];
        if (!app || app.wine?.running === false) continue;
        return app.hideHostCursor === true;
      }
      return false;
    }
    // A native modal dialog (MessageBox, a common dialog) is answered by
    // tapping its buttons, whatever the game's touch mode. The overlay already
    // hides its game controls while one is up; an aim-only trackpad would
    // still turn the tap into look motion with no click, and Drakan's "Beta
    // Demo Warning" OK could never be pressed on a phone.
    function nativeModalOpen() {
      try {
        return !!(renderer.getActiveModalWindow && renderer.getActiveModalWindow());
      } catch (_) { return false; }
    }
    function activeAimOnly() {
      if (nativeModalOpen()) return false;
      const app = runningApps.slice().reverse().find(app => app && app.wine?.running !== false);
      return !!app?.touchControls?.aimOnly;
    }
    function suppressAimMouseButton(e) {
      return activeAimOnly() && (e.sourceCapabilities?.firesTouchEvents === true ||
        (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
    }
    function wantsTouchTrackpad(canvasX, canvasY) {
      if (nativeModalOpen()) return false;
      const mode = activeMobileTouchMode();
      if (mode === 'direct') return false;
      if (mode === 'trackpad') return true;
      return wantsRelativeMouse(canvasX, canvasY);
    }
    let lastCanvasPointer = null;
    // Only locks requested by automatic guest detection have an expiry.
    // Explicit profiles and locks acquired elsewhere remain caller-owned.
    let automaticLockRequest = null;
    let automaticLockExiting = false;
    function releaseExpiredAutomaticLock() {
      if (!automaticLockRequest || !pointerLocked()) return false;
      if (automaticLockExiting) return true;
      const point = renderer._unmapExclusiveInputPoint
        ? renderer._unmapExclusiveInputPoint(renderer._mouseX || 0, renderer._mouseY || 0)
        : lastCanvasPointer;
      if (point && wantsRelativeMouse(point.x, point.y)) return false;
      const exit = document.exitPointerLock || document.webkitExitPointerLock;
      if (exit) {
        automaticLockExiting = true;
        try { exit.call(document); } catch (_) { automaticLockExiting = false; }
      }
      // Exit is asynchronous. Neither frozen client coordinates nor relative
      // deltas from this obsolete lock belong in the absolute guest menu.
      return true;
    }
    function syncGuestCursorVisibility(canvasX, canvasY) {
      if (Number.isFinite(canvasX) && Number.isFinite(canvasY)) {
        lastCanvasPointer = { x: canvasX, y: canvasY };
      }
      const profileHidden = exclusivePresentationActive() && activeHideHostCursor();
      const guestHidden = lastCanvasPointer && renderer.wantsHiddenMouse &&
        renderer.wantsHiddenMouse(lastCanvasPointer?.x, lastCanvasPointer?.y);
      const hidden = !!(runningApps.length && lastCanvasPointer &&
        (profileHidden || guestHidden));
      if (canvas.classList) canvas.classList.toggle('guest-cursor-hidden', hidden);
      return hidden;
    }
    // ShowCursor can change while the pointer is stationary (during scene
    // setup, or when a modal closes), so input events alone are insufficient.
    // The class is CSS !important and therefore cannot be undone by a later
    // guest SetCursor writing an inline cursor while the display count is low.
    setInterval(() => {
      syncGuestCursorVisibility();
      releaseExpiredAutomaticLock();
    }, 100);
    let mouseDownUsesRelative = false;
    // Some browsers report one synthetic movementX/Y jump while pointer lock
    // is being acquired from a mousedown. That delta describes the browser's
    // capture transition, not physical motion; feeding it to a software-cursor
    // guest moves the hotspot between DOWN and UP and turns a click into a
    // miss. Suppress only that acquisition click's locked movement. Once the
    // button is released, ordinary relative motion resumes immediately.
    let suppressRelativeUntilRelease = false;
    function mouseButtonPoint(e, forceVirtual) {
      // Pointer-lock events carry useful movementX/Y but their clientX/Y may
      // be zero or otherwise outside a letterboxed exclusive viewport. Route
      // button-up through the guest's current virtual cursor instead, or the
      // renderer drops WM_LBUTTONUP while clearing only its host-side mask.
      if ((forceVirtual || pointerLocked() || mouseDownUsesRelative) &&
          renderer._unmapExclusiveInputPoint) {
        const point = renderer._unmapExclusiveInputPoint(
          renderer._mouseX || 0, renderer._mouseY || 0);
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
      }
      return eventPoint(e);
    }
    function forwardMouseMove(e) {
      if (releaseExpiredAutomaticLock()) return true;
      if (pointerLocked() && renderer.handleRelativeMouseMove) {
        if (suppressRelativeUntilRelease) {
          syncGuestCursorVisibility();
          return true;
        }
        // Mouse counts, not canvas pixels: see handleRelativeMouseMove.
        renderer.handleRelativeMouseMove(Number(e.movementX) || 0,
          Number(e.movementY) || 0, { guestCounts: true });
        syncGuestCursorVisibility();
        return true;
      }
      // requestPointerLock() is asynchronous. A drag can arrive after the
      // trusted down asked for capture but before pointerlockchange confirms
      // it; treating that brief sample as absolute recreates the same
      // off-centre jump the capture gate below prevents.
      if (mouseDownUsesRelative) {
        syncGuestCursorVisibility();
        return true;
      }
      const { x, y } = eventPoint(e);
      renderer.handleMouseMove(x, y);
      syncGuestCursorVisibility(x, y);
      return false;
    }
    function requestGuestPointerLock(canvasX, canvasY) {
      if (pointerLocked()) return true;
      const request = canvas.requestPointerLock || canvas.webkitRequestPointerLock;
      if (!request || !wantsRelativeMouse(canvasX, canvasY)) return false;
      // Pointer lock itself hides the host cursor and provides unbounded
      // movementX/Y. The guest remains authoritative for the virtual cursor
      // through GetCursorPos/SetCursorPos. Keep this one synchronous,
      // optionless request inside the trusted click. Some engines reject the
      // raw-movement option asynchronously; a retry from that rejection no
      // longer owns the click's transient user activation and cannot capture.
      try {
        const automatic = activeMouseApp()?.relativeMouse !== true ? {} : null;
        automaticLockRequest = automatic;
        // Keep the explicit standard call for modern engines; older Safari
        // shipped the same API under the WebKit name and requires its method
        // to be called with the canvas as `this`.
        const result = canvas.requestPointerLock
          ? canvas.requestPointerLock()
          : canvas.webkitRequestPointerLock.call(canvas);
        if (result && result.catch) result.catch(() => {
          if (automaticLockRequest === automatic) automaticLockRequest = null;
        });
      } catch (_) { automaticLockRequest = null; }
      return true;
    }
    const keyboardProxy = document.getElementById('mobile-keyboard-proxy');
    const isKeyboardProxy = el => keyboardProxy && el === keyboardProxy;
    function clearKeyboardProxy() {
      if (keyboardProxy && keyboardProxy.value) keyboardProxy.value = '';
    }
    // Does the guest have somewhere to put text? A Win32 caret exists exactly
    // when something is taking keystrokes, so it is the gate that keeps
    // Minesweeper from opening a keyboard over half its own board.
    let hadCaret = false;
    let focusNeedsGesture = false;
    let caretWatchTimer = null;
    // ...unless the user asked for one by hand. Every fullscreen DirectDraw
    // game that takes text -- Diablo II's character name, StarCraft chat, a
    // Half-Life console -- paints its own field and never creates a Win32
    // caret, so the automatic path above can never fire for them and a phone
    // has no other way in.
    let manualKeyboard = false;
    function guestHasCaret() {
      try {
        return !!(renderer && renderer.caretRect && renderer.caretRect());
      } catch (_) {
        return false;
      }
    }
    function syncKeyboardProxy(gesture) {
      if (!keyboardProxy) return;
      // No app running is not a reason to skip this -- it is the single most
      // important time to run it. The keyboard comes down when the guest drops
      // its caret, and an app that exits drops its caret and empties
      // runningApps in the same instant. Returning early here meant the proxy
      // stayed focused with nothing behind it, iOS kept the keyboard up, and
      // the keyboard controller kept #screen-wrap translated upward -- which
      // takes the desktop icon grid, a child of that same element, off the top
      // of the screen. The result is a bare teal page with no launcher on it,
      // and it looks exactly like an app that refused to close.
      const noApps = !runningApps || !runningApps.length;
      if (noApps) manualKeyboard = false;
      const decide = (window.MobileKeyboard && window.MobileKeyboard.keyboardProxyAction) || null;
      const hasCaret = noApps ? false : guestHasCaret();
      const caretIsNew = hasCaret && !hadCaret;
      hadCaret = hasCaret;
      const action = decide
        ? decide({
            hasCaret,
            proxyFocused: document.activeElement === keyboardProxy,
            gesture,
            caretIsNew,
            manual: manualKeyboard,
            focusNeedsGesture,
            keyboardVisible: !!document.body?.classList.contains('keyboard-open'),
          })
        : (gesture || manualKeyboard ? 'focus' : 'none');
      if (action === 'focus' || action === 'refocus') {
        // iOS only opens the software keyboard from a real editable DOM
        // element, and only during a user gesture. The canvas remains the
        // visual surface; this hidden textarea is just the keyboard device.
        try {
          clearKeyboardProxy();
          if (action === 'refocus') keyboardProxy.blur();
          keyboardProxy.focus({ preventScroll: true });
        } catch (_) {
          try { keyboardProxy.focus(); } catch (_) {}
        }
        focusNeedsGesture = !gesture;
      } else if (action === 'blur') {
        focusNeedsGesture = false;
        clearKeyboardProxy();
        try { keyboardProxy.blur(); } catch (_) {}
        try { canvas.focus({ preventScroll: true }); } catch (_) {}
      }
    }
    // The touch-control overlay covers the canvas, so a tap it decides to hand
    // on to the guest never reaches the handler below -- and iOS only opens
    // its keyboard from inside a real user gesture, which is the DOM event the
    // overlay is holding. Publishing this lets the overlay make the same call
    // this file makes, from inside that same gesture.
    if (typeof window !== 'undefined') {
      window.__wineFocusKeyboardProxy = () => focusGuestKeyboardProxy();
      // The manual keyboard, driven by the on-screen pill. Called from inside
      // the overlay's touchstart, which is the only moment iOS will open a
      // keyboard. Returns the state it left the keyboard in so the pill can
      // paint itself.
      window.__wineToggleKeyboard = () => setManualKeyboard(!manualKeyboard);
      window.__wineSetKeyboard = (on) => setManualKeyboard(!!on);
      window.__wineKeyboardOpen = () =>
        manualKeyboard || document.activeElement === keyboardProxy;
    }
    function setManualKeyboard(on) {
      manualKeyboard = !!on;
      // syncKeyboardProxy does both halves: with `manual` set it focuses, and
      // with it cleared the ordinary no-caret rule blurs. A guest that DOES
      // have a caret keeps its keyboard either way, which is right -- turning
      // the manual toggle off should not close a text field's own keyboard.
      syncKeyboardProxy(true);
      return manualKeyboard;
    }
    function focusGuestKeyboardProxy() {
      syncKeyboardProxy(true);
      // The click has only been queued; the guest creates its caret a few
      // frames later, and on Android that late focus still raises the
      // keyboard. Watch briefly rather than guessing from the hit rect.
      if (caretWatchTimer) clearInterval(caretWatchTimer);
      let ticks = 0;
      caretWatchTimer = setInterval(() => {
        syncKeyboardProxy(false);
        if (++ticks >= 8) {
          clearInterval(caretWatchTimer);
          caretWatchTimer = null;
        }
      }, 100);
    }
    // The guest can drop its caret without any input from us -- a dialog
    // closes, the app moves focus to a button -- and the keyboard has to go
    // away with it.
    setInterval(() => syncKeyboardProxy(false), 500);
    function unlockRunningAudio() {
      if (!runningApps || !runningApps.length) return;
      for (const app of runningApps) {
        const wineHost = app && app.wine;
        if (!wineHost) continue;
        try {
          // Unlock/create playback first. Capture then switches Safari to the
          // play-and-record session required to keep its microphone track
          // alive; doing these in the opposite order changes it straight back
          // to playback before getUserMedia has settled.
          if (wineHost.primeAudio) wineHost.primeAudio();
          // Safari requires microphone acquisition to begin while transient
          // user activation is still live. The guest does not call
          // waveInStart until after this DOM event has been queued and run,
          // so declared capture apps prime a stream here and waveInStart
          // consumes it later. Other apps must never receive a microphone
          // prompt merely because their canvas was clicked.
          const waveIn = wineHost._sharedAudio && wineHost._sharedAudio.waveIn;
          const manifest = window.wineApps && window.wineApps.APPS &&
            window.wineApps.APPS[app.name];
          if (manifest && manifest.audioCapture && waveIn && waveIn.primeCapture) {
            waveIn.primeCapture();
          }
        } catch (_) {}
        const contexts = [];
        if (wineHost._audioCtx) contexts.push(wineHost._audioCtx);
        const voices = wineHost._sharedAudio && wineHost._sharedAudio.voices;
        if (voices && voices._ac && voices._ac !== wineHost._audioCtx) contexts.push(voices._ac);
        for (const ac of contexts) {
          if (ac && ac.state === 'suspended') {
            try { ac.resume(); } catch (_) {}
          }
        }
      }
    }
    function windowAtCanvas(cx, cy) {
      for (const w of Object.values(renderer.windows)) {
        if (!w.visible || w.isChild) continue;
        if (cx >= w.x && cx < w.x + w.w && cy >= w.y && cy < w.y + w.h) return w;
      }
      return null;
    }
    function forwardEmptyDesktopClick(clientX, clientY, cx, cy) {
      // A popup can extend beyond every app window. Its selection/outside
      // click belongs to menu tracking, never to an HTML icon underneath.
      // Consult all menu owners, including secondary guest-thread instances.
      if (renderer._openMenuContext && renderer._openMenuContext()) return false;
      if (DEBUG_MODE || windowAtCanvas(cx, cy)) return false;
      canvas.style.pointerEvents = 'none';
      const under = document.elementFromPoint(clientX, clientY);
      canvas.style.pointerEvents = '';
      const iconEl = under && under.closest && under.closest('.desktop-icon');
      if (iconEl) {
        iconEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }));
        return true;
      }
      for (const sel of document.querySelectorAll('.desktop-icon.selected')) sel.classList.remove('selected');
      return false;
    }
    let mouseDragActive = false;
    let mouseDownActive = false;
    let mouseDownButton = 0;
    let activeTouchId = null;
    let lastTouchPoint = null;
    let lastTouchClientPoint = null;
    let touchTrackpadActive = false;
    let touchAimOnly = false;
    let touchAimSensitivity = 1;
    let touchSentMouseDown = false;
    let touchTravelCss = 0;
    let touchStartPoint = null;
    let touchLongPressTimer = null;
    let touchLongPressFired = false;
    let lastTrackpadTapAt = 0;
    let pendingTrackpadTap = null;
    const TRACKPAD_TAP_SLOP_CSS = 10;
    const TRACKPAD_DRAG_TAP_MS = 400;
    const LONG_PRESS_MS = 550;
    const LONG_PRESS_SLOP_CSS = 10;
    const inputSetTimeout = deps && deps.setTimeout || setTimeout;
    const inputClearTimeout = deps && deps.clearTimeout || clearTimeout;
    function releaseTrackpadTap() {
      if (!pendingTrackpadTap) return;
      const tap = pendingTrackpadTap;
      pendingTrackpadTap = null;
      inputClearTimeout(tap.timer);
      renderer.handleMouseUp(tap.x, tap.y, 0);
    }
    window.addEventListener('blur', releaseTrackpadTap);
    window.addEventListener('touchstart', releaseTrackpadTap, true);
    window.addEventListener('mousedown', releaseTrackpadTap, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseTrackpadTap();
    });
    function inputNow() {
      return typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    }
    function virtualCursorCanvasPoint(fallback) {
      if (renderer._unmapExclusiveInputPoint &&
          Number.isFinite(renderer._mouseX) && Number.isFinite(renderer._mouseY)) {
        const point = renderer._unmapExclusiveInputPoint(renderer._mouseX, renderer._mouseY);
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
      }
      return fallback;
    }
    function syncTouchCursorToGuest(fallback) {
      const tc = typeof window !== 'undefined' ? window.TouchCursor : null;
      if (!tc || typeof tc.move !== 'function') return;
      const point = virtualCursorCanvasPoint(fallback);
      if (!point) return;
      const r = canvas.getBoundingClientRect();
      tc.move(
        r.left + point.x * r.width / Math.max(1, canvas.width),
        r.top + point.y * r.height / Math.max(1, canvas.height));
    }
    // Edge scrolling (StarCraft, Age of Empires, Pharaoh...) follows the
    // cursor, and on a touchscreen the cursor stays wherever the finger left
    // it. A drag-select that ends at the screen edge, or a tap on a unit near
    // it, therefore left the map scrolling until the next touch elsewhere.
    // With `touchControls.edgeInset: N` (guest pixels), a direct-mode touch
    // that ends within N of the game screen's edge moves the cursor N pixels
    // inside it. Holding the finger at the edge still scrolls; lifting stops.
    function activeEdgeInset() {
      const app = runningApps.slice().reverse().find(app => app && app.wine?.running !== false);
      const n = Number(app?.touchControls?.edgeInset);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    function releaseTouchFromEdge(canvasPoint) {
      const inset = activeEdgeInset();
      if (!inset || !canvasPoint) return;
      const mx = renderer._mouseX, my = renderer._mouseY;
      if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
      // The game screen in guest pixels: the exclusive (DirectDraw) viewport
      // when one is presented, else the top-level window under the finger.
      const v = renderer._exclusivePresentationViewport;
      let b = v && v.nativeW > 0 && v.nativeH > 0
        ? { x: v.nativeX | 0, y: v.nativeY | 0, w: v.nativeW, h: v.nativeH } : null;
      if (!b && renderer._inputWindowAtPoint) {
        const win = renderer._inputWindowAtPoint(mx, my);
        if (win && win.w > 0 && win.h > 0) b = { x: win.x | 0, y: win.y | 0, w: win.w, h: win.h };
      }
      if (!b || b.w <= 2 * inset || b.h <= 2 * inset) return;
      const nx = Math.min(Math.max(mx, b.x + inset), b.x + b.w - 1 - inset);
      const ny = Math.min(Math.max(my, b.y + inset), b.y + b.h - 1 - inset);
      if (nx === mx && ny === my) return;
      // Aim at the pixel's centre: mapping a scaled canvas point back floors,
      // and the pixel's corner landed one short (StarCraft got x=7 for 8).
      const p = renderer._unmapExclusiveInputPoint
        ? renderer._unmapExclusiveInputPoint(nx + 0.5, ny + 0.5) : { x: nx, y: ny };
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      // An appearance, not travel: DirectInput must not see the jump.
      renderer.handleMouseMove(p.x, p.y, { teleport: true });
      syncTouchCursorToGuest(p);
    }
    function stopMouseDragCapture() {
      mouseDragActive = false;
      mouseDownActive = false;
      mouseDownUsesRelative = false;
      suppressRelativeUntilRelease = false;
      window.removeEventListener('mousemove', windowMouseMove, true);
      window.removeEventListener('mouseup', windowMouseUp, true);
      window.removeEventListener('blur', windowMouseCancel, true);
    }
    function touchById(list, id) {
      if (!list) return null;
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === id) return list[i];
      }
      return null;
    }
    function stopTouchCapture() {
      if (touchLongPressTimer !== null) {
        inputClearTimeout(touchLongPressTimer);
        touchLongPressTimer = null;
      }
      activeTouchId = null;
      lastTouchPoint = null;
      lastTouchClientPoint = null;
      touchTrackpadActive = false;
      touchAimOnly = false;
      touchSentMouseDown = false;
      touchTravelCss = 0;
      touchStartPoint = null;
      touchLongPressFired = false;
      window.removeEventListener('touchmove', windowTouchMove, true);
      window.removeEventListener('touchend', windowTouchEnd, true);
      window.removeEventListener('touchcancel', windowTouchCancel, true);
    }

    // Two fingers own page-level navigation: changing their separation
    // switches Fit/Fill, while moving them together sends mouse-wheel input.
    // The canvas otherwise routes every touch to the guest as a mouse, and a
    // Win98 app has no use for a second concurrent touch.
    //
    // The gesture takes the first finger's press with it. In direct mode that
    // press already reached the guest as WM_LBUTTONDOWN; a tap-hold trackpad
    // drag also owns a held button. Entering pinch retires either one rather
    // than leaving a button stuck down for the rest of the gesture.
    let pinchStartDist = 0;
    let pinchTouchIds = null;
    let pinchStartCentre = null;
    let pinchLastCentre = null;
    let pinchMode = null;
    let pinchWheelRemainder = 0;
    function pinchDistance(list, ids) {
      const a = touchById(list, ids[0]);
      const b = touchById(list, ids[1]);
      if (!a || !b) return 0;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    function pinchCentre(list, ids) {
      const a = touchById(list, ids[0]);
      const b = touchById(list, ids[1]);
      if (!a || !b) return null;
      return { x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2 };
    }
    function pinchActive() { return !!pinchTouchIds; }
    function beginPinch(e, second) {
      const ids = [activeTouchId, second.identifier];
      const dist = pinchDistance(e.touches, ids);
      if (!(dist > 0)) return false;
      // Retire the guest's button before the gesture owns the screen.
      const p = lastTouchPoint;
      if (p && touchSentMouseDown) {
        const release = touchTrackpadActive ? virtualCursorCanvasPoint(p) : p;
        renderer.handleMouseUp(release.x, release.y, 0);
      }
      stopTouchCapture();
      pinchTouchIds = ids;
      pinchStartDist = dist;
      pinchStartCentre = pinchCentre(e.touches, ids);
      pinchLastCentre = pinchStartCentre;
      pinchMode = null;
      pinchWheelRemainder = 0;
      if (renderer.beginViewPinch) renderer.beginViewPinch();
      window.addEventListener('touchmove', windowPinchMove, { capture: true, passive: false });
      window.addEventListener('touchend', windowPinchEnd, { capture: true, passive: false });
      window.addEventListener('touchcancel', windowPinchEnd, { capture: true, passive: false });
      return true;
    }
    function endPinch() {
      pinchTouchIds = null;
      pinchStartDist = 0;
      pinchStartCentre = null;
      pinchLastCentre = null;
      pinchMode = null;
      pinchWheelRemainder = 0;
      window.removeEventListener('touchmove', windowPinchMove, true);
      window.removeEventListener('touchend', windowPinchEnd, true);
      window.removeEventListener('touchcancel', windowPinchEnd, true);
    }
    function windowPinchMove(e) {
      if (!pinchTouchIds) return;
      e.preventDefault();
      e.stopPropagation();
      const dist = pinchDistance(e.touches, pinchTouchIds);
      const centre = pinchCentre(e.touches, pinchTouchIds);
      if (!(dist > 0) || !(pinchStartDist > 0) || !centre) return;
      const scale = dist / pinchStartDist;
      if (!pinchMode) {
        // Distance change wins over translation. Once classified, a gesture
        // cannot wobble between presentation zoom and wheel scrolling.
        const centreTravel = pinchStartCentre
          ? Math.hypot(centre.x - pinchStartCentre.x,
            centre.y - pinchStartCentre.y) : 0;
        const spanChange = Math.abs(dist - pinchStartDist);
        // Touch hardware may report the two fingers in separate events. In
        // that intermediate sample a parallel scroll briefly changes the
        // span too, so require span change to dominate centroid travel before
        // committing to a pinch.
        if (spanChange >= 8 &&
            spanChange >= centreTravel * 0.75) {
          pinchMode = 'zoom';
          if (!renderer.updateViewPinch) setPresentationViewMode(scale > 1 ? 'zoom' : 'fit');
        } else if (centreTravel >= 10) {
          pinchMode = 'wheel';
        }
      }
      if (pinchMode === 'zoom' && renderer.updateViewPinch) renderer.updateViewPinch(scale);
      if (pinchMode === 'wheel' && pinchLastCentre) {
        pinchWheelRemainder += centre.y - pinchLastCentre.y;
        const p = eventPointFromClient(centre.x, centre.y);
        while (Math.abs(pinchWheelRemainder) >= 24) {
          renderer.handleWheel(p.x, p.y, pinchWheelRemainder > 0 ? 1 : -1);
          pinchWheelRemainder += pinchWheelRemainder > 0 ? -24 : 24;
        }
      }
      pinchLastCentre = centre;
    }
    function windowPinchEnd(e) {
      if (!pinchTouchIds) return;
      e.preventDefault();
      e.stopPropagation();
      // Hold the gesture until every finger of it is off the glass, so the
      // last one lifting does not start a fresh press on the guest.
      for (const id of pinchTouchIds) {
        if (touchById(e.touches, id)) return;
      }
      if (pinchMode === 'zoom' && renderer.endViewPinch) {
        renderer.endViewPinch(e.type === 'touchcancel');
        const tc = window.TouchControls;
        if (tc && tc.syncViewMode) tc.syncViewMode();
      }
      endPinch();
    }
    function setPresentationViewMode(mode) {
      const tc = typeof window !== 'undefined' ? window.TouchControls : null;
      // Through the overlay when there is one, so its label follows; straight
      // to the renderer otherwise.
      if (tc && tc.installed && typeof tc.setViewMode === 'function') {
        tc.setViewMode(mode);
        return;
      }
      if (renderer.setViewMode) renderer.setViewMode(mode);
    }
    function windowMouseMove(e) {
      if (!mouseDownActive) return;
      const buttonBit = mouseDownButton === 2 ? 2 : mouseDownButton === 1 ? 4 : 1;
      if (typeof e.buttons === 'number' && !(e.buttons & buttonBit)) {
        // Some browsers omit mouseup while acquiring pointer lock or moving
        // focus. A later move with the physical button clear is authoritative.
        const point = mouseButtonPoint(e, true);
        renderer.handleMouseUp(point.x, point.y, mouseDownButton);
        stopMouseDragCapture();
        return;
      }
      mouseDragActive = true;
      e.preventDefault();
      e.stopPropagation();
      forwardMouseMove(e);
    }
    function windowMouseUp(e) {
      if (!mouseDownActive) return;
      e.preventDefault();
      e.stopPropagation();
      const { x, y } = mouseButtonPoint(e);
      renderer.handleMouseUp(x, y, e.button);
      stopMouseDragCapture();
    }
    function windowMouseCancel() {
      if (!mouseDownActive) return;
      const point = mouseButtonPoint(null, true);
      renderer.handleMouseUp(point.x, point.y, mouseDownButton);
      stopMouseDragCapture();
    }
    // These capture handlers run at the window, ahead of every on-screen
    // control. An event carrying another finger's change as well -- the pad
    // thumb sliding, both thumbs lifting in one touchend -- must still reach
    // that control, or its key stays held with nobody touching it. Only an
    // event that is about the canvas finger alone is kept to ourselves.
    function stopIfOnlyOurs(e) {
      const list = e.changedTouches;
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier !== activeTouchId) return;
      }
      e.stopPropagation();
    }
    function windowTouchMove(e) {
      if (activeTouchId === null) return;
      const t = touchById(e.changedTouches, activeTouchId);
      if (!t) return;
      e.preventDefault();
      stopIfOnlyOurs(e);
      const previousClient = lastTouchClientPoint || { x: t.clientX, y: t.clientY };
      const stepDxCss = t.clientX - previousClient.x;
      const stepDyCss = t.clientY - previousClient.y;
      touchTravelCss += Math.hypot(stepDxCss, stepDyCss);
      if (touchTravelCss > LONG_PRESS_SLOP_CSS && touchLongPressTimer !== null) {
        inputClearTimeout(touchLongPressTimer);
        touchLongPressTimer = null;
      }
      if (touchTrackpadActive) {
        const dxCss = stepDxCss;
        const dyCss = stepDyCss;
        lastTouchClientPoint = { x: t.clientX, y: t.clientY };
        const r = canvas.getBoundingClientRect();
        const dx = dxCss * canvas.width / Math.max(1, r.width) * touchAimSensitivity;
        const dy = dyCss * canvas.height / Math.max(1, r.height) * touchAimSensitivity;
        if ((dx || dy) && renderer.handleRelativeMouseMove) {
          renderer.handleRelativeMouseMove(dx, dy);
          syncTouchCursorToGuest(lastTouchPoint);
        }
        return;
      }
      const { x, y } = eventPointFromClient(t.clientX, t.clientY);
      if (!touchSentMouseDown && !touchLongPressFired &&
          touchTravelCss > TRACKPAD_TAP_SLOP_CSS) {
        const start = touchStartPoint || lastTouchPoint || { x, y };
        renderer.handleMouseMove(start.x, start.y);
        renderer.handleMouseDown(start.x, start.y, 0);
        touchSentMouseDown = true;
        focusGuestKeyboardProxy();
      }
      lastTouchPoint = { x, y };
      lastTouchClientPoint = { x: t.clientX, y: t.clientY };
      if (touchSentMouseDown) renderer.handleMouseMove(x, y);
    }
    function windowTouchEnd(e) {
      if (activeTouchId === null) return;
      const t = touchById(e.changedTouches, activeTouchId);
      if (!t) return;
      e.preventDefault();
      stopIfOnlyOurs(e);
      if (touchTrackpadActive) {
        const fallback = lastTouchPoint || eventPointFromClient(t.clientX, t.clientY);
        const p = virtualCursorCanvasPoint(fallback);
        if (touchSentMouseDown) {
          renderer.handleMouseUp(p.x, p.y, 0);
          lastTrackpadTapAt = 0;
        } else if (!touchAimOnly && !touchLongPressFired && touchTravelCss <= TRACKPAD_TAP_SLOP_CSS) {
          // A trackpad click belongs to the cursor, not to the finger. Send
          // the pair together on release so looking around never holds Fire.
          releaseTrackpadTap();
          renderer.handleMouseDown(p.x, p.y, 0);
          const profile = runningApps.slice().reverse()
            .find(app => app && app.wine?.running !== false)?.touchControls;
          const hold = profile?.trackpadTapHoldMs;
          if (Number.isFinite(hold) && hold > 0) {
            const pending = { x: p.x, y: p.y, timer: null };
            pendingTrackpadTap = pending;
            pending.timer = inputSetTimeout(releaseTrackpadTap, Math.min(hold, 500));
          } else renderer.handleMouseUp(p.x, p.y, 0);
          lastTrackpadTapAt = inputNow();
          focusGuestKeyboardProxy();
        } else {
          lastTrackpadTapAt = 0;
        }
        syncTouchCursorToGuest(p);
      } else {
        const p = eventPointFromClient(t.clientX, t.clientY);
        if (touchSentMouseDown) renderer.handleMouseUp(p.x, p.y, 0);
        else if (!touchLongPressFired) {
          // Software-cursor games (Blobby's menus) hit-test their last
          // WM_MOUSEMOVE, not the button message's lParam. A touchscreen tap
          // has no preceding hover: publish its position before the click.
          // Teleport for the same reason as the touchstart publish: a tap is
          // an appearance, not travel, and DirectInput must not see it.
          renderer.handleMouseMove(p.x, p.y, { teleport: true });
          renderer.handleMouseDown(p.x, p.y, 0);
          renderer.handleMouseUp(p.x, p.y, 0);
          focusGuestKeyboardProxy();
        }
        releaseTouchFromEdge(p);
      }
      stopTouchCapture();
    }
    function windowTouchCancel(e) {
      if (activeTouchId === null) return;
      // A cancel that does not name the canvas finger leaves it alive.
      if (!touchById(e.changedTouches, activeTouchId)) return;
      e.preventDefault();
      stopIfOnlyOurs(e);
      const p = lastTouchPoint;
      if (p && touchSentMouseDown) {
        const release = touchTrackpadActive ? virtualCursorCanvasPoint(p) : p;
        renderer.handleMouseUp(release.x, release.y, 0);
      }
      stopTouchCapture();
    }
    canvas.onmousedown = e => {
      e.preventDefault();
      if (releaseExpiredAutomaticLock()) return;
      // Safari's compatibility mouse events must not bypass movement-only
      // touch handling. The on-screen Fire key owns firing on this profile.
      if (suppressAimMouseButton(e)) {
        if (mouseDownActive) windowMouseCancel();
        return;
      }
      canvas.focus();
      unlockRunningAudio();
      // Pointer Lock freezes clientX/Y at the capture anchor. Once locked,
      // button messages must use the guest's virtual cursor, which has kept
      // moving through movementX/Y; otherwise the click lands where capture
      // began instead of where the game's software cursor is drawn.
      const { x: cx, y: cy } = mouseButtonPoint(e, pointerLocked());
      syncGuestCursorVisibility(cx, cy);
      if (forwardEmptyDesktopClick(e.clientX, e.clientY, cx, cy)) return;
      // A second press without an observed release must first retire the old
      // guest down state. This is a final guard for browser/OS event loss.
      if (mouseDownActive) windowMouseCancel();
      mouseDownUsesRelative = requestGuestPointerLock(cx, cy);
      renderer.handleMouseDown(cx, cy, e.button, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
      focusGuestKeyboardProxy();
      mouseDownActive = true;
      mouseDownButton = e.button;
      mouseDragActive = false;
      window.addEventListener('mousemove', windowMouseMove, true);
      window.addEventListener('mouseup', windowMouseUp, true);
      window.addEventListener('blur', windowMouseCancel, true);
    };
    canvas.onmouseup = e => {
      if (suppressAimMouseButton(e)) {
        if (mouseDownActive) windowMouseCancel();
        return;
      }
      if (mouseDownActive) return;
      if (releaseExpiredAutomaticLock()) return;
      const { x, y } = eventPoint(e);
      renderer.handleMouseUp(x, y, e.button);
    };
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const { x, y } = eventPoint(e);
      renderer.handleWheel(x, y, e.deltaY);
    }, { passive: false });
    const handlePointerLockChange = () => {
      if (!pointerLocked()) {
        automaticLockRequest = null;
        automaticLockExiting = false;
      } else {
        releaseExpiredAutomaticLock();
      }
      if (pointerLocked() && mouseDownActive && mouseDownUsesRelative) {
        suppressRelativeUntilRelease = true;
      }
      if (mouseDownActive && mouseDownUsesRelative && !pointerLocked()) windowMouseCancel();
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
    const handlePointerLockError = () => {
      if (!pointerLocked()) automaticLockRequest = null;
    };
    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('webkitpointerlockerror', handlePointerLockError);
    document.addEventListener('visibilitychange', () => {
      if (mouseDownActive && document.visibilityState === 'hidden') windowMouseCancel();
    });
    canvas.addEventListener('touchstart', e => {
      releaseTrackpadTap();
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      // A second finger starts a page gesture (pinch or wheel), never a second
      // mouse: it takes the gesture and the guest sees neither touch.
      if (activeTouchId !== null) {
        if (beginPinch(e, t)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (pinchActive()) { e.preventDefault(); return; }
      e.preventDefault();
      canvas.focus();
      unlockRunningAudio();
      const { x: cx, y: cy } = eventPointFromClient(t.clientX, t.clientY);
      if (forwardEmptyDesktopClick(t.clientX, t.clientY, cx, cy)) return;
      activeTouchId = t.identifier;
      lastTouchPoint = { x: cx, y: cy };
      touchStartPoint = { x: cx, y: cy };
      lastTouchClientPoint = { x: t.clientX, y: t.clientY };
      touchTravelCss = 0;
      touchLongPressFired = false;
      // Native controls are absolute targets even when the game uses a trackpad.
      const nativeControl = !!(renderer.touchWantsImmediatePress &&
        renderer.touchWantsImmediatePress(cx, cy));
      touchTrackpadActive = !nativeControl && wantsTouchTrackpad(cx, cy);
      touchAimOnly = !nativeControl && activeAimOnly();
      const touchProfile = runningApps.slice().reverse()
        .find(app => app && app.wine?.running !== false)?.touchControls;
      const aimSensitivity = touchProfile?.aimSensitivity;
      touchAimSensitivity = touchAimOnly && Number.isFinite(aimSensitivity) && aimSensitivity > 0
        ? aimSensitivity : 1;
      if (touchAimOnly) {
        touchTrackpadActive = true;
        lastTrackpadTapAt = 0;
      }
      if (!touchTrackpadActive) {
        lastTrackpadTapAt = 0;
        // The finger appeared here; nothing moved across the gap from the
        // last tap. Publish the position for Win32 hit-testing but keep the
        // jump out of DirectInput, which only ever describes physical motion.
        renderer.handleMouseMove(cx, cy, { teleport: true });
      }
      const now = inputNow();
      const beginTrackpadDrag = touchTrackpadActive && !touchAimOnly && lastTrackpadTapAt > 0 &&
        now - lastTrackpadTapAt <= TRACKPAD_DRAG_TAP_MS;
      // Mouse-joystick profiles keep the rest of the canvas a physical
      // mouse surface. These games poll held buttons between frames: an
      // instantaneous down/up at touchend is invisible to Blobby. Reserve
      // delayed tap/long-press disambiguation for ordinary desktop profiles.
      const touchApp = runningApps.length ? runningApps[runningApps.length - 1] : null;
      // ...and so is a push button: it has no right click to disambiguate
      // from, and it must look pressed while the finger is on it.
      const beginDirectMouse = !touchTrackpadActive && (!!(touchApp &&
        touchApp.touchControls && touchApp.touchControls.mouseJoystick) ||
        !!(renderer.touchWantsImmediatePress &&
           renderer.touchWantsImmediatePress(cx, cy)));
      touchSentMouseDown = beginTrackpadDrag || beginDirectMouse;
      if (beginDirectMouse) renderer.handleMouseDown(cx, cy, 0);
      if (touchTrackpadActive) {
        if (beginTrackpadDrag) {
          const p = virtualCursorCanvasPoint(lastTouchPoint);
          renderer.handleMouseDown(p.x, p.y, 0);
          lastTrackpadTapAt = 0;
        }
        syncTouchCursorToGuest(lastTouchPoint);
      }
      if (!touchAimOnly && !beginTrackpadDrag && !beginDirectMouse) {
        touchLongPressTimer = inputSetTimeout(() => {
          touchLongPressTimer = null;
          if (activeTouchId !== t.identifier ||
              touchTravelCss > LONG_PRESS_SLOP_CSS) return;
          const p = touchTrackpadActive
            ? virtualCursorCanvasPoint(lastTouchPoint) : lastTouchPoint;
          if (!p) return;
          if (!touchTrackpadActive) renderer.handleMouseMove(p.x, p.y);
          renderer.handleMouseDown(p.x, p.y, 2);
          renderer.handleMouseUp(p.x, p.y, 2);
          touchLongPressFired = true;
          lastTrackpadTapAt = 0;
          syncTouchCursorToGuest(p);
        }, LONG_PRESS_MS);
      }
      window.addEventListener('touchmove', windowTouchMove, { capture: true, passive: false });
      window.addEventListener('touchend', windowTouchEnd, { capture: true, passive: false });
      window.addEventListener('touchcancel', windowTouchCancel, { capture: true, passive: false });
    }, { passive: false });
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    // Default-claim keys when canvas is focused: the guest gets every
    // keystroke except those reserved for the browser/OS (close tab,
    // reload, devtools, fullscreen, OS keys). This matches Win98 feel
    // — Ctrl+S/F/P etc. land in the app instead of the browser.
    const keepForBrowser = (e) => {
      const vk = e.keyCode;
      if (e.metaKey) return true;                          // Cmd/Win
      if (vk === 44) return true;                          // PrintScreen
      if (vk === 122 || vk === 123) return true;           // F11, F12
      if (vk === 116) return true;                         // F5 (reload)
      if (e.ctrlKey && vk === 82) return true;             // Ctrl+R
      if (e.ctrlKey && vk === 87) return true;             // Ctrl+W
      if (e.ctrlKey && vk === 84) return true;             // Ctrl+T
      if (e.ctrlKey && vk === 9)  return true;             // Ctrl+Tab
      if (e.ctrlKey && vk === 33) return true;             // Ctrl+PgUp
      if (e.ctrlKey && vk === 34) return true;             // Ctrl+PgDn
      if (e.ctrlKey && vk === 27) return true;             // Ctrl+Esc
      if (e.ctrlKey && e.shiftKey && (vk === 73 || vk === 74 || vk === 67)) return true; // devtools
      if (e.ctrlKey && (vk === 187 || vk === 189 || vk === 48)) return true; // zoom
      if (e.altKey && vk === 115) return true;             // Alt+F4
      return false;
    };
    // Keys that would generate a printable character via the keypress
    // event (no Ctrl/Alt modifiers, VK in the typing range). Calling
    // preventDefault() on keydown suppresses the subsequent keypress in
    // browsers, which would break WM_CHAR delivery — so leave those
    // alone and let keypress fire naturally.
    const isPrintableKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return false;
      const vk = e.keyCode;
      if (vk >= 0x30 && vk <= 0x5A) return true;           // 0-9, A-Z
      if (vk >= 0x60 && vk <= 0x6F) return true;           // numpad
      if (vk >= 0xBA && vk <= 0xC0) return true;           // ;=,-./` etc.
      if (vk >= 0xDB && vk <= 0xDE) return true;           // [\]'
      if (vk === 32) return true;                          // space
      return false;
    };
    let suppressTextInputEvents = 0;
    const charCodeFromKeyEvent = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return 0;
      if (typeof e.key === 'string' && e.key.length === 1) return e.key.charCodeAt(0);
      if (e.key === 'Enter') return 13;
      // TranslateMessage turns VK_ESCAPE into WM_CHAR 0x1B too; StarCraft's
      // menus close on the character, not the key. Backspace stays out:
      // native EDIT deletes on KEYDOWN; TranslateMessage supplies WM_CHAR 8
      // only for other targets, including game-drawn text fields.
      if (e.key === 'Escape') return 27;
      return 0;
    };
    const focusGuestCanvas = () => {
      try {
        const active = document.activeElement;
        if (active && active !== canvas && !isKeyboardProxy(active) && active.blur) active.blur();
        canvas.focus({ preventScroll: true });
      } catch (_) {
        try { canvas.focus(); } catch (_) {}
      }
    };
    const shouldIgnorePageKey = (e) => {
      // While an agent session holds input exclusively (lib/agent-remote.js),
      // the human at the keyboard must not also type into the guest. The key
      // listeners below are window-capture and registered at page load, so no
      // later-installed guard can get in front of them — this cooperative
      // check is the seam. Synthetic agent keys have isTrusted=false and pass.
      if (e && e.isTrusted && window.__agentInputExclusive) return true;
      const el = e.target;
      if (isKeyboardProxy(el)) return false;
      // A synthesized event can target `window` (not a Node); treat any
      // non-Node target like the canvas — guest-bound — rather than feeding
      // it to toolbar.contains(), which throws on a non-Node argument.
      if (!el || !(el instanceof Node)) return false;
      if (el === canvas || el === document.body || el === document.documentElement) return false;
      // Keys typed into a page dialog (the launch window's buttons, Esc to
      // cancel it) are the dialog's, not the running guest's.
      if (el.closest && el.closest('[data-wine-page-dialog]')) return true;
      if (runningApps && runningApps.length) {
        const toolbar = document.getElementById('toolbar');
        if (toolbar && toolbar.contains(el) && !keepForBrowser(e)) {
          // After a program is running, the Win98 guest owns normal
          // keystrokes. Browser toolbar controls can retain DOM focus after
          // Launch/program selection; refocus the canvas so Notepad-style
          // text input is delivered to the guest, not swallowed by <select>.
          focusGuestCanvas();
          return false;
        }
      }
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const startInputProfile = (label, e, data) => {
      if (!renderer._profileInput || !window.DEBUG_INPUT_PROFILE) return;
      const now = renderer._profileNow ? renderer._profileNow() : performance.now();
      let eventTime = (e && typeof e.timeStamp === 'number') ? e.timeStamp : now;
      if (eventTime > now + 100000 && performance.timeOrigin) eventTime -= performance.timeOrigin;
      if (!Number.isFinite(eventTime) || eventTime < 0 || eventTime > now + 1000) eventTime = now;
      renderer._profileInput(label, {
        ...(data || {}),
        domType: e.type,
        key: e.key,
        code: e.code,
        eventTime: Number(eventTime.toFixed(3)),
      }, eventTime);
      renderer._profileMark('browser-handler-start', {
        delayMs: Number((now - eventTime).toFixed(3)),
      });
    };
    // `altEnterFullscreen` apps: Alt+Enter is the browser's fullscreen toggle,
    // and neither half of it reaches the guest. Little Fighter 2's own
    // Alt+Enter (on WM_SYSKEYUP of Enter) asks DirectDraw for an exclusive
    // 794x550 8-bit mode, which no real display offers and which leaves the
    // game drawing 16-bit art into an 8-bit screen; the windowed game scaled
    // to the whole screen is what a player pressing Alt+Enter wants.
    let altEnterSwallowed = false;
    const activeAltEnterFullscreen = () => {
      const app = runningApps && runningApps.slice().reverse()
        .find(app => app && app.wine?.running !== false);
      return !!(app && app.altEnterFullscreen);
    };
    const toggleBrowserFullscreen = (e) => {
      const current = document.fullscreenElement || document.webkitFullscreenElement;
      if (current) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) { try { const r = exit.call(document); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
      } else if (typeof window.approveBrowserFullscreen === 'function') {
        window.approveBrowserFullscreen(e);
      }
    };
    const handleKeyDown = (e) => {
      if (shouldIgnorePageKey(e)) return;
      if (e.keyCode === 13 && e.altKey && activeAltEnterFullscreen()) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) toggleBrowserFullscreen(e);
        altEnterSwallowed = true;
        return;
      }
      const vk = e.keyCode;
      unlockRunningAudio();
      renderer.handleKeyDown(vk, {
        code: e.code || '', location: e.location | 0, repeat: !!e.repeat,
      });
      suppressTextInputEvents = 0;
      if (!keepForBrowser(e)) {
        const charCode = charCodeFromKeyEvent(e);
        if (charCode) {
          startInputProfile('keydown-char', e, { vk, charCode });
          renderer.handleKeyPress(charCode);
          renderer._profileMark && renderer._profileMark('browser-handler-end');
          suppressTextInputEvents = 2;
          e.preventDefault();
        } else if (!isPrintableKey(e)) {
          e.preventDefault();
        }
      }
    };
    const handleKeyUp = (e) => {
      if (shouldIgnorePageKey(e)) return;
      if (e.keyCode === 13 && altEnterSwallowed) {
        altEnterSwallowed = false;
        e.preventDefault();
        return;
      }
      renderer.handleKeyUp(e.keyCode, {
        code: e.code || '', location: e.location | 0, repeat: !!e.repeat,
      });
    };
    const handleKeyPress = (e) => {
      if (shouldIgnorePageKey(e)) return;
      if (suppressTextInputEvents > 0) {
        suppressTextInputEvents--;
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const charCode = e.charCode || e.keyCode;
      startInputProfile('keypress', e, { charCode });
      renderer.handleKeyPress(charCode);
      renderer._profileMark && renderer._profileMark('browser-handler-end');
    };
    const handleBeforeInput = (e) => {
      if (shouldIgnorePageKey(e)) return;
      if (suppressTextInputEvents > 0) {
        suppressTextInputEvents--;
        e.preventDefault();
        clearKeyboardProxy();
        return;
      }
      if (e.data) {
        e.preventDefault();
        for (const ch of e.data) {
          const charCode = ch.charCodeAt(0);
          startInputProfile('beforeinput', e, { charCode });
          renderer.handleKeyPress(charCode);
          renderer._profileMark && renderer._profileMark('browser-handler-end');
        }
        clearKeyboardProxy();
      }
    };
    // The VK a physical keyboard would have reported for this character. Only
    // the unambiguous ones: letters and digits map to their uppercase code
    // point by definition of the Win32 VK space, space is 0x20, and everything
    // else (punctuation, which is OEM-scancode territory and layout dependent)
    // returns 0 and travels as WM_CHAR only.
    function vkForChar(ch) {
      if (!ch) return 0;
      const c = ch.charCodeAt(0);
      if (c >= 0x30 && c <= 0x39) return c;             // 0-9
      if (c >= 0x41 && c <= 0x5a) return c;             // A-Z
      if (c >= 0x61 && c <= 0x7a) return c - 32;        // a-z -> A-Z
      if (c === 0x20) return 0x20;                      // VK_SPACE
      if (c === 0x0a || c === 0x0d) return 0x0d;        // VK_RETURN
      if (c === 0x09) return 0x09;                      // VK_TAB
      return 0;
    }
    const handleProxyInput = (e) => {
      if (!isKeyboardProxy(e.target)) return;
      if (suppressTextInputEvents > 0) {
        suppressTextInputEvents--;
        clearKeyboardProxy();
        return;
      }
      const text = keyboardProxy.value || '';
      if (text) {
        for (const ch of text) {
          const charCode = ch.charCodeAt(0);
          startInputProfile('proxy-input', e, { charCode });
          // WM_CHAR alone is not the whole keystroke. A soft keyboard reports
          // keyCode 229 (or 0) on iOS, so the window keydown above carries no
          // usable virtual key and a guest that reads WM_KEYDOWN -- which is
          // most games drawing their own text field -- sees nothing at all.
          // Synthesize the pair around the character.
          const vk = vkForChar(ch);
          if (vk) renderer.handleKeyDown(vk, { code: '', location: 0, repeat: false });
          renderer.handleKeyPress(charCode);
          if (vk) renderer.handleKeyUp(vk, { code: '', location: 0, repeat: false });
          renderer._profileMark && renderer._profileMark('browser-handler-end');
        }
      }
      clearKeyboardProxy();
    };
    let imeComposing = false;
    const handleCompositionStart = (e) => {
      if (shouldIgnorePageKey(e)) return;
      imeComposing = true;
      suppressTextInputEvents = 0;
      renderer.handleCompositionStart && renderer.handleCompositionStart();
    };
    const handleCompositionUpdate = (e) => {
      if (!imeComposing || shouldIgnorePageKey(e)) return;
      renderer.handleCompositionUpdate && renderer.handleCompositionUpdate(e.data || '');
    };
    const handleCompositionEnd = (e) => {
      if (!imeComposing || shouldIgnorePageKey(e)) return;
      imeComposing = false;
      renderer.handleCompositionEnd && renderer.handleCompositionEnd(e.data || '');
      // Browsers commonly follow compositionend with beforeinput/input for
      // the same committed text. The guest commit above is authoritative.
      suppressTextInputEvents = 2;
      clearKeyboardProxy();
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('keypress', handleKeyPress, { capture: true });
    window.addEventListener('beforeinput', handleBeforeInput, { capture: true });
    window.addEventListener('compositionstart', handleCompositionStart, { capture: true });
    window.addEventListener('compositionupdate', handleCompositionUpdate, { capture: true });
    window.addEventListener('compositionend', handleCompositionEnd, { capture: true });
    if (keyboardProxy) keyboardProxy.addEventListener('input', handleProxyInput);
    // iOS closes its keyboard from its own affordances (the Done key, a
    // downward swipe), and all we ever see of that is the proxy losing focus.
    // Without this the manual flag survives the dismissal and the 500ms
    // resync puts the keyboard straight back up, which reads as a keyboard
    // that cannot be closed.
    if (keyboardProxy) {
      keyboardProxy.addEventListener('blur', () => {
        manualKeyboard = false;
        if (typeof window !== 'undefined' && window.TouchControls &&
            window.TouchControls.syncKeyboardToggle) {
          try { window.TouchControls.syncKeyboardToggle(); } catch (_) {}
        }
      });
    }
    canvas.onmousemove = e => {
      if (mouseDragActive) return;
      if (pointerLocked()) {
        forwardMouseMove(e);
        return;
      }
      const { x: mx, y: my } = eventPoint(e);
      // An explicitly relative-input game is asking for relative motion, but a
      // browser cannot grant Pointer Lock until the player clicks. Do not feed
      // the absolute DOM position into that game's virtual Win32 cursor while
      // capture is pending. Quake-style input polls displacement from the
      // screen centre and calls SetCursorPos back to the centre every frame;
      // repeating an off-centre DOM position on each mousemove therefore
      // turns distance from the centre into runaway rotation. The trusted
      // mousedown below requests Pointer Lock, after which movementX/Y takes
      // the normal relative path. forwardMouseMove applies the same hold to
      // the short asynchronous acquisition window during a drag.
      if (wantsRelativeMouse(mx, my)) {
        syncGuestCursorVisibility(mx, my);
        return;
      }
      renderer.handleMenuHover(mx, my);
      // Always deliver mouse moves — WM_SETCURSOR depends on it, and games
      // like Reversi key their "valid move" cross cursor on WM_MOUSEMOVE.
      renderer.handleMouseMove(mx, my);
      syncGuestCursorVisibility(mx, my);
    };
  }

  const browserInput = {
    wireCanvasInput,
    isWired: () => inputWired,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = browserInput;
  if (typeof window !== 'undefined') window.browserInput = browserInput;
})();
