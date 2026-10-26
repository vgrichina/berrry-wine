#!/usr/bin/env node
'use strict';

// Win32 games frequently translate WM_KEYDOWN/UP from the Set-1 scan code in
// lParam instead of using wParam.  Quake II's MapKey path is one example.

const assert = require('assert');
const {
  installInputHandlers,
  keyboardMessageLParam,
} = require('../lib/renderer-input');

assert.strictEqual(keyboardMessageLParam(0x57, { code: 'KeyW' }, false, false),
  0x00110001, 'W carries Set-1 scan code 0x11 and repeat count 1');
assert.strictEqual(keyboardMessageLParam(0x26, { code: 'ArrowUp' }, false, false),
  0x01480001, 'Up carries scan code 0x48 plus the extended-key bit');
assert.strictEqual(keyboardMessageLParam(0x57, { code: 'KeyW', repeat: true }, false, true),
  0x40110001, 'repeated keydown sets the previous-state bit');
assert.strictEqual(keyboardMessageLParam(0x26, { code: 'ArrowUp' }, true, true),
  0xC1480001, 'keyup sets previous-state, transition, scan, and extended bits');
assert.strictEqual(keyboardMessageLParam(0x0D, null, false, false),
  0x001C0001, 'numeric-only CLI callers retain an Enter scan-code fallback');
// A touch-overlay button sends a bare VK. Kingpin/SiN/Hexen II strafe on , and
// . and Quake II-engine MapKey drops a scan code of 0, so every VK a layout
// can name must carry the scan code its DOM key would.
for (const [vk, code] of [
  [0xBC, 'Comma'], [0xBE, 'Period'], [0xBF, 'Slash'], [0xBA, 'Semicolon'],
  [0xDE, 'Quote'], [0xDB, 'BracketLeft'], [0xDD, 'BracketRight'], [0xDC, 'Backslash'],
  [0xC0, 'Backquote'], [0xBD, 'Minus'], [0xBB, 'Equal'],
  [0x60, 'Numpad0'], [0x62, 'Numpad2'], [0x64, 'Numpad4'], [0x65, 'Numpad5'],
  [0x66, 'Numpad6'], [0x68, 'Numpad8'], [0x69, 'Numpad9'],
]) {
  assert.strictEqual(keyboardMessageLParam(vk, null, false, false),
    keyboardMessageLParam(vk, { code }, false, false),
    `bare VK 0x${vk.toString(16)} carries ${code}'s scan code`);
}

class RendererProbe {
  constructor() {
    this.inputQueue = [];
    this.windows = {};
    this.wasm = null;
    this.mainWasm = null;
    this._exited = false;
  }
}
installInputHandlers(RendererProbe);

const renderer = new RendererProbe();
renderer.handleKeyDown(0x26, { code: 'ArrowUp' });
assert.strictEqual(renderer.peekKeyDownState(0x26), 0x8000,
  'DirectInput physical state sees a browser key press immediately');
let event = renderer.takeInput();
assert(event, 'keydown enters the normal renderer input queue');
assert.strictEqual(event.msg, 0x0100);
assert.strictEqual(event.wParam, 0x26);
assert.strictEqual(event.lParam >>> 0, 0x01480001,
  'queued WM_KEYDOWN preserves the scan-code lParam');

renderer.handleKeyUp(0x26, { code: 'ArrowUp' });
event = renderer.takeInput();
assert(event, 'keyup enters the normal renderer input queue');
assert.strictEqual(event.msg, 0x0101);
assert.strictEqual(event.lParam >>> 0, 0xC1480001,
  'queued WM_KEYUP preserves scan, extended, previous, and transition bits');

const directInputOnly = new RendererProbe();
directInputOnly.handleKeyDown(0x28, { code: 'ArrowDown' });
directInputOnly.handleKeyUp(0x28, { code: 'ArrowDown' });
assert.strictEqual(directInputOnly.inputQueue.length, 2,
  'the Win32 key messages remain queued for an app that does not drain them');
assert.strictEqual(directInputOnly.peekAsyncKeyState(0x28), 0x8000,
  'Win32 async state remains ordered behind the queued key-up');
assert.strictEqual(directInputOnly.peekKeyDownState(0x28), 0,
  'DirectInput physical state observes key-up without waiting for GetMessage');

// TranslateMessage copies the keystroke's lParam into the WM_CHAR. NFS II's
// lib_char loops over its repeat count, so a WM_CHAR 0x1B with lParam 0 was
// zero characters and Escape never skipped the intro movie.
const chars = new RendererProbe();
chars.handleKeyDown(0x1B, { code: 'Escape' });
chars.handleKeyPress(0x1B);
chars.handleKeyUp(0x1B, { code: 'Escape' });
assert.deepStrictEqual(chars.inputQueue.map(e => e.msg), [0x0100, 0x0102, 0x0101]);
assert.strictEqual(chars.inputQueue[1].lParam >>> 0, 0x00010001,
  'WM_CHAR carries the keydown lParam: repeat count 1, Escape scan code 0x01');
chars.handleKeyPress(0x41);
assert.strictEqual(chars.inputQueue[3].lParam >>> 0, 1,
  'a character with no keystroke behind it still has a repeat count of 1');

console.log('PASS Win32 keyboard messages preserve ordering while DirectInput tracks physical key release');
