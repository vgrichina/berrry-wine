#!/usr/bin/env node
'use strict';

// Keys for an EDIT the application subclassed go through the message queue.
//
// WHY: handleKeyDown/handleKeyPress hand WM_KEYDOWN/WM_CHAR for a WAT EDIT
// straight to send_message, which runs an installed x86 subclass inside a
// bounded nested run. Age of Empires' New Name dialog subclasses its EDIT and
// handles Enter there: it builds the Select Player screen and fades the
// palette in a timeGetTime loop. The nested run gave up after 64 rounds
// ("[sync] ABANDONED wndproc hwnd=0x10003 msg=0x100 wParam=0xd"), the rest of
// the handler never ran, the dialog object was never deleted, and Quit Game ->
// Close -> Cancel -> Cancel later called through its freed parent at
// 0x004571f6 (scratch/runs/20261116-aoe-fixes). Real USER posts keys; the app
// receives them from its own GetMessage/DispatchMessage. A native,
// unsubclassed EDIT keeps the direct path the renderer relies on.

const assert = require('assert');
const { installInputHandlers } = require('../lib/renderer-input');

const MAIN = 0x10001;
const EDIT = 0x10003;
const NATIVE_EDIT_PROC = 0xFFFF0102;
const GUEST_SUBCLASS = 0x00465a00;

function makeExports(proc) {
  const sends = [];
  return {
    _sends: sends,
    get_focus_hwnd: () => EDIT,
    ctrl_get_class: (h) => ((h | 0) === EDIT ? 2 : 0),
    wnd_get_parent: (h) => ((h | 0) === EDIT ? MAIN : 0),
    wnd_get_proc_export: (h) => ((h | 0) === EDIT ? proc : 0),
    send_message: (h, msg, wp, lp) => { sends.push([h, msg, wp, lp]); return 0; },
  };
}

class RendererProbe {
  constructor(exports) {
    this.inputQueue = [];
    this.wasm = { exports };
    this.windows = {
      [MAIN]: { hwnd: MAIN, visible: true, isChild: false, wasm: this.wasm, zOrder: 1 },
      [EDIT]: { hwnd: EDIT, visible: true, isChild: true, parentHwnd: MAIN, wasm: this.wasm },
    };
  }
  _inputWasmRunsInGuestWorker() { return false; }
  invalidate() {}
  scheduleRepaint() {}
  repaint() {}
}
installInputHandlers(RendererProbe);

function keys(r) {
  return r.inputQueue.filter(e => e && e.type === 'key').map(e => [e.msg, e.wParam]);
}

// 1. AoE: a subclassed EDIT gets Enter and typed characters from the queue.
{
  const e = makeExports(GUEST_SUBCLASS);
  const r = new RendererProbe(e);
  r.handleKeyDown(65);
  r.handleKeyPress(65);
  r.handleKeyDown(13);
  assert.deepStrictEqual(e._sends, [], 'no synchronous send into the guest subclass');
  assert.deepStrictEqual(keys(r), [[0x0100, 65], [0x0102, 65], [0x0100, 13]],
    'WM_KEYDOWN, WM_CHAR, WM_KEYDOWN queued in order');
  assert.strictEqual(r._editHasGuestSubclass(EDIT), true);
  console.log('ok 1 subclassed EDIT: keys queued, none sent');
}

// 2. A native EDIT keeps the direct WAT path.
{
  const e = makeExports(NATIVE_EDIT_PROC);
  const r = new RendererProbe(e);
  assert.strictEqual(r._editHasGuestSubclass(EDIT), false);
  r.handleKeyDown(65);
  r.handleKeyPress(65);
  assert.deepStrictEqual(e._sends.map(s => [s[0], s[1], s[2]]),
    [[EDIT, 0x0100, 65], [EDIT, 0x0102, 65]], 'native EDIT typed directly');
  assert.deepStrictEqual(keys(r), [], 'nothing queued for the native EDIT');
  console.log('ok 2 native EDIT: direct send_message');
}

// 3. No wndproc record (0) is not a subclass.
{
  const r = new RendererProbe(makeExports(0));
  assert.strictEqual(r._editHasGuestSubclass(EDIT), false);
  console.log('ok 3 empty wndproc slot is not a subclass');
}

console.log('PASS test-edit-subclass-key-queue');
