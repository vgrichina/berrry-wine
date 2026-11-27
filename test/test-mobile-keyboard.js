#!/usr/bin/env node

'use strict';

// On-screen keyboard geometry.
//
// The failure this prevents: a phone keyboard opens, the guest screen follows
// the shrinking viewport, and every dialog the app centred is re-centred into
// the strip above the keyboard -- permanently, because the app has been told
// its display got shorter. The rule is that the guest screen never changes
// size for a keyboard; it is translated instead, by the least amount that
// brings the caret into view.

const assert = require('assert');
const { keyboardInset, canvasShift, keyboardProxyAction, createKeyboardController } =
  require('../lib/mobile-keyboard');

// --- when the keyboard is allowed to open at all ---
//
// Every tap used to focus the hidden textarea, so Minesweeper opened a
// keyboard over its own board. A Win32 caret exists exactly when the guest is
// taking text, so it is the gate.

assert.strictEqual(
  keyboardProxyAction({ hasCaret: false, proxyFocused: false, gesture: true }), 'none',
  'tapping an app with nowhere to type must not open a keyboard');

assert.strictEqual(
  keyboardProxyAction({ hasCaret: false, proxyFocused: true, gesture: false }), 'blur',
  'losing the caret closes the keyboard, with or without a gesture');

assert.strictEqual(
  keyboardProxyAction({ hasCaret: true, proxyFocused: false, gesture: true }), 'focus',
  'tapping into a text field opens the keyboard');

assert.strictEqual(
  keyboardProxyAction({ hasCaret: true, proxyFocused: true, gesture: true }), 'none',
  'an already-open keyboard is left alone; refocusing would dismiss it');

// The click reaches the guest asynchronously, so the caret it creates shows up
// after the gesture has ended. Focusing then still raises the keyboard on
// Android, and on iOS at least parks focus where the next keystroke belongs.
assert.strictEqual(
  keyboardProxyAction({ hasCaret: true, proxyFocused: false, gesture: false, caretIsNew: true }),
  'focus', 'a caret that appears just after the tap still counts');

assert.strictEqual(
  keyboardProxyAction({ hasCaret: true, proxyFocused: false, gesture: false, caretIsNew: false }),
  'none', 'a caret the user already dismissed the keyboard on stays dismissed');

assert.strictEqual(keyboardProxyAction({ hasCaret: true, proxyFocused: true,
  gesture: true, focusNeedsGesture: true, keyboardVisible: false }), 'refocus',
  'late dialog focus without an iOS keyboard can be retried by tapping');
assert.strictEqual(keyboardProxyAction({ hasCaret: true, proxyFocused: true,
  gesture: true, focusNeedsGesture: true, keyboardVisible: true }), 'none',
  'late focus that already opened a keyboard must not restart it');
assert.strictEqual(keyboardProxyAction({ hasCaret: true, proxyFocused: true,
  gesture: false, focusNeedsGesture: true }), 'none',
  'the caret polling timer must not keep refocusing');

// The manual keyboard. A fullscreen DirectDraw game -- Diablo II asking for a
// character name, StarCraft's chat line, a Half-Life console -- draws its own
// text field and never calls CreateCaret, so hasCaret is false for the entire
// time the user is trying to type. The on-screen pill says so directly, and it
// has to beat the caret rule in BOTH directions: without the override the
// 500ms resync blurs the proxy immediately after the pill focused it, and the
// keyboard drops back down on its own a moment after it appears.
assert.strictEqual(
  keyboardProxyAction({ hasCaret: false, proxyFocused: false, manual: true }), 'focus',
  'the manual toggle opens the keyboard with no caret anywhere');
assert.strictEqual(
  keyboardProxyAction({ hasCaret: false, proxyFocused: true, manual: true }), 'none',
  'and the resync leaves it alone instead of blurring it a moment later');
assert.strictEqual(
  keyboardProxyAction({ hasCaret: false, proxyFocused: true, manual: false }), 'blur',
  'turning the toggle back off lets the ordinary no-caret rule close it');
assert.strictEqual(
  keyboardProxyAction({ hasCaret: true, proxyFocused: true, manual: false }), 'none',
  'but a guest text field keeps its own keyboard when the toggle goes off');

// --- telling a keyboard from everything else that shrinks the viewport ---

assert.strictEqual(
  keyboardInset({ layoutHeight: 844, viewportHeight: 844, viewportOffsetTop: 0 }), 0,
  'nothing covering the page is no inset');

assert.strictEqual(
  keyboardInset({ layoutHeight: 844, viewportHeight: 508, viewportOffsetTop: 0 }), 336,
  'a keyboard-sized band is measured in full');

// A collapsing address bar is tens of pixels, not hundreds. Treating it as a
// keyboard would lift the screen every time the user scrolled.
assert.strictEqual(
  keyboardInset({ layoutHeight: 844, viewportHeight: 790, viewportOffsetTop: 0 }), 0,
  'browser chrome is below the threshold and ignored');

// Pinch-zoom shrinks visualViewport too, but the page is being magnified, not
// covered; moving the guest under the user's fingers would fight the gesture.
assert.strictEqual(
  keyboardInset({ layoutHeight: 844, viewportHeight: 400, viewportOffsetTop: 0, scale: 2 }), 0,
  'a pinch-zoom is not a keyboard');

// A desktop browser reports the two heights equal, forever.
assert.strictEqual(keyboardInset({ layoutHeight: 0, viewportHeight: 0 }), 0,
  'missing metrics are not a keyboard');

// --- how far to lift the screen ---

// A 402x844 phone, keyboard 336 tall, so 508px of the screen is visible.
const PHONE = { inset: 336, visibleHeight: 508, canvasTop: 0, canvasBottom: 844 };

assert.strictEqual(canvasShift({ ...PHONE, focus: null }), 0,
  'no caret means no shift: the top of the app beats an arbitrary scroll');

assert.strictEqual(canvasShift({ ...PHONE, inset: 0, focus: { top: 700, bottom: 713 } }), 0,
  'no keyboard means no shift, wherever the caret is');

assert.strictEqual(canvasShift({ ...PHONE, focus: { top: 100, bottom: 113 } }), 0,
  'a caret already clear of the keyboard does not move the screen');

// Caret at y=700 is 192px behind the keyboard; it has to come up to 508 minus
// the 8px margin, so the screen lifts by 700 + 13 + 8 - 508.
assert.strictEqual(canvasShift({ ...PHONE, focus: { top: 700, bottom: 713 } }), 213,
  'a buried caret lifts the screen just far enough to clear the keyboard');

// Never further than the canvas's own bottom edge: lifting past it would open
// a band of page background between the guest and the keyboard.
assert.strictEqual(canvasShift({ ...PHONE, focus: { top: 840, bottom: 844 } }), 336,
  'the lift stops when the canvas bottom reaches the top of the keyboard');
assert.strictEqual(canvasShift({ ...PHONE, canvasBottom: 508, focus: { top: 500, bottom: 508 } }), 0,
  'a canvas no taller than the visible band has nowhere to go');

// Revealing the bottom of a caret must not push its top off the top edge.
// A 600px-tall focus rect cannot fit in a 508px band, so the top wins.
assert.strictEqual(canvasShift({ ...PHONE, focus: { top: 100, bottom: 700 } }), 92,
  'when the focus is taller than the visible band, its top stays on screen');

// --- the controller, driven with plain objects ---


{
  // Full open/close cycle: the pre-keyboard height is captured while the
  // keyboard is down, held while it is up, and released when it closes.
  const style = {};
  const classes = new Set();
  const vp = { height: 844, offsetTop: 0, scale: 1, addEventListener() {} };
  let rect = { top: 0, bottom: 844, height: 844 };
  let focus = null;
  const changes = [];
  const controller = createKeyboardController({
    viewport: vp,
    document: {
      documentElement: { clientHeight: 844 },
      body: { classList: { toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)) } },
    },
    element: () => ({ style, getBoundingClientRect: () => rect }),
    focusRect: () => focus,
    onChange: (info) => changes.push(info),
  });

  controller.update();
  assert.strictEqual(controller.inset(), 0, 'closed keyboard reports no inset');
  assert.strictEqual(controller.frozenHeight(), 0,
    'with no keyboard there is nothing to freeze and the normal path applies');

  // Keyboard opens; the caret is in the buried half of the screen.
  vp.height = 508;
  focus = { top: 700, bottom: 713 };
  controller.update();
  assert.strictEqual(controller.inset(), 336);
  assert.strictEqual(controller.frozenHeight(), 844,
    'the size the guest keeps is the one it had before the keyboard opened');
  assert.strictEqual(style.transform, 'translateY(-213px)');
  assert.ok(classes.has('keyboard-open'), 'the page is told a keyboard is up');

  // A second update with the shift already applied must not compound it: the
  // element now reports a rect 213px higher, and the answer has to be the same.
  rect = { top: -213, bottom: 631, height: 844 };
  focus = { top: 487, bottom: 500 };
  controller.update();
  assert.strictEqual(style.transform, 'translateY(-213px)',
    're-measuring a shifted element must not stack another shift on top');

  // Keyboard closes.
  vp.height = 844;
  rect = { top: 0, bottom: 844, height: 844 };
  focus = null;
  controller.update();
  assert.strictEqual(controller.inset(), 0);
  assert.strictEqual(style.transform, '', 'the screen goes back where it was');
  assert.ok(!classes.has('keyboard-open'));
  assert.strictEqual(controller.frozenHeight(), 0,
    'the freeze is released so the guest can follow a real resize again');
  // Two transitions happened -- open and close. The redundant middle update,
  // which recomputed the same shift, must not have reported anything: a change
  // callback that fires on every poll would re-run the whole resize path four
  // times a second for as long as the keyboard is up.
  assert.strictEqual(changes.length, 2, 'only real transitions are reported');
}

{
  // reset(): the shift has to be droppable without waiting for a viewport
  // event. The element being translated is #screen-wrap, and the desktop icon
  // grid lives inside it -- so a shift that outlives the app it was computed
  // for carries the only launcher a phone has off the top of the screen, and
  // the page reads as a bare teal dead end. update() cannot undo it at that
  // moment: the keyboard is still on its way down and the viewport still
  // reports it as up.
  const style = {};
  const classes = new Set();
  const vp = { height: 508, offsetTop: 0, scale: 1, addEventListener() {} };
  const rect = { top: 0, bottom: 844, height: 844 };
  const changes = [];
  const controller = createKeyboardController({
    viewport: vp,
    document: {
      documentElement: { clientHeight: 844 },
      body: { classList: { toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)),
                           remove: (n) => classes.delete(n) } },
    },
    element: () => ({ style, getBoundingClientRect: () => rect }),
    focusRect: () => ({ top: 700, bottom: 713 }),
    onChange: (info) => changes.push(info),
  });

  controller.update();
  assert.strictEqual(controller.inset(), 336, 'keyboard is up');
  assert.strictEqual(style.transform, 'translateY(-213px)', 'and the wrap is shifted');

  // The viewport is left saying the keyboard is still up -- that is the whole
  // point: reset() must not consult it.
  controller.reset();
  assert.strictEqual(controller.inset(), 0, 'reset drops the inset');
  assert.strictEqual(controller.shift(), 0, 'reset drops the shift');
  assert.strictEqual(controller.frozenHeight(), 0, 'reset releases the frozen size');
  assert.strictEqual(style.transform, '', 'and the icon grid comes back on screen');
  assert.ok(!classes.has('keyboard-open'), 'the page is told the keyboard is down');
  assert.strictEqual(changes.length, 2, 'reset reports the transition it made');
}

// Exercise the full browser bridge through registered public event routes.
// The DOM and renderer sink are test doubles; this does not assert which
// event ordering a real phone emits. Literal unit/keystroke arrays are the
// oracle, so a lost low surrogate cannot hide behind a rendered glyph.
function textInputFixture() {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  let document;
  class Target {
    constructor(tagName) {
      this.tagName = tagName;
      this.listeners = new Map();
      this.value = '';
    }
    addEventListener(type, fn, options) {
      const entries = this.listeners.get(type) || [];
      entries.push({ fn, capture: options === true || !!options?.capture });
      this.listeners.set(type, entries);
    }
    setAttribute() {}
    focus() { document.activeElement = this; }
    closest() { return null; }
  }
  const window = new Target();
  document = new Target();
  const canvas = new Target('CANVAS'), proxy = new Target('TEXTAREA');
  document.body = new Target('BODY');
  document.documentElement = new Target('HTML');
  document.getElementById = id => id === 'mobile-keyboard-proxy' ? proxy : null;
  const calls = [];
  const renderer = {
    handleKeyDown: vk => calls.push(['down', vk]),
    handleKeyPress: unit => calls.push(['char', unit]),
    handleKeyUp: vk => calls.push(['up', vk]),
    handleCompositionStart: () => calls.push(['compositionstart']),
    handleCompositionEnd: text => calls.push(['compositionend', text]),
  };
  const context = { window, document, Node: Target,
    setInterval() {}, clearInterval() {}, setTimeout() {}, clearTimeout() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/browser-input.js'), 'utf8'),
    context, { filename: 'browser-input.js' });
  window.browserInput.wireCanvasInput(canvas, renderer, { runningApps: [] });
  function dispatch(target, type, props = {}) {
    const event = { type, target, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...props };
    const route = [window, document, target];
    for (const node of route) {
      for (const entry of node.listeners.get(type) || []) if (entry.capture) entry.fn(event);
    }
    for (const node of route.reverse()) {
      for (const entry of node.listeners.get(type) || []) if (!entry.capture) entry.fn(event);
    }
    return event;
  }
  return { calls, canvas, proxy, dispatch, Target };
}

for (const route of ['beforeinput', 'input']) {
  for (const [text, units, proxyCalls] of [
    ['\u{1f600}', [0xd83d, 0xde00], [['char', 0xd83d], ['char', 0xde00]]],
    ['A\u{1f600}\u{1f642}é', [0x41, 0xd83d, 0xde00, 0xd83d, 0xde42, 0xe9],
      [['down', 0x41], ['char', 0x41], ['up', 0x41], ['char', 0xd83d],
        ['char', 0xde00], ['char', 0xd83d], ['char', 0xde42], ['char', 0xe9]]],
    ['Ab7,é', [0x41, 0x62, 0x37, 0x2c, 0xe9],
      [['down', 0x41], ['char', 0x41], ['up', 0x41],
        ['down', 0x42], ['char', 0x62], ['up', 0x42],
        ['down', 0x37], ['char', 0x37], ['up', 0x37], ['char', 0x2c], ['char', 0xe9]]],
    ['', [], []],
    ['\ud800x\udc00', [0xd800, 0x78, 0xdc00],
      [['char', 0xd800], ['down', 0x58], ['char', 0x78], ['up', 0x58], ['char', 0xdc00]]],
  ]) {
    const f = textInputFixture();
    f.proxy.focus();
    f.proxy.value = text;
    const e = f.dispatch(route === 'input' ? f.proxy : f.canvas, route, { data: text });
    assert.deepStrictEqual(f.calls, route === 'input' ? proxyCalls : units.map(c => ['char', c]),
      `${route} preserves exact UTF-16 units and existing BMP key pairs`);
    assert.strictEqual(f.proxy.value, '', `${route} clears the proxy`);
    assert.strictEqual(e.defaultPrevented, route === 'beforeinput' && !!text);
  }
}

for (const trigger of ['keydown', 'composition']) {
  const f = textInputFixture();
  f.proxy.focus();
  if (trigger === 'keydown') {
    assert.strictEqual(f.dispatch(f.proxy, 'keydown',
      { key: 'a', code: 'KeyA', keyCode: 65 }).defaultPrevented, true);
  } else {
    f.dispatch(f.proxy, 'compositionstart');
    f.dispatch(f.proxy, 'compositionend', { data: '\u{1f600}' });
  }
  const expected = trigger === 'keydown'
    ? [['down', 65], ['char', 97]]
    : [['compositionstart'], ['compositionend', '\u{1f600}']];
  f.proxy.value = '\u{1f600}';
  assert.strictEqual(f.dispatch(f.proxy, 'beforeinput', { data: '\u{1f600}' }).defaultPrevented, true);
  assert.strictEqual(f.proxy.value, '');
  f.proxy.value = '\u{1f600}';
  f.dispatch(f.proxy, 'input');
  assert.strictEqual(f.proxy.value, '');
  assert.deepStrictEqual(f.calls, expected, `${trigger} suppresses both duplicate text events`);
  // The counter must expire: a subsequent admitted event still sends both units.
  f.dispatch(f.canvas, 'beforeinput', { data: '\u{1f600}' });
  assert.deepStrictEqual(f.calls, [...expected, ['char', 0xd83d], ['char', 0xde00]]);
}

{
  const f = textInputFixture();
  const pageInput = new f.Target('INPUT');
  const e = f.dispatch(pageInput, 'beforeinput', { data: '\u{1f600}' });
  assert.deepStrictEqual(f.calls, [], 'ordinary page inputs retain their text');
  assert.strictEqual(e.defaultPrevented, false);
}

console.log('PASS  on-screen keyboard geometry and browser UTF-16 text event routes');
