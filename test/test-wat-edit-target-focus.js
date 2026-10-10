#!/usr/bin/env node
'use strict';

// A keystroke must not pull the focus into an EDIT in another window.
//
// WHY: handleKeyDown asks _findWatEditTarget whether the key belongs to a
// WAT EDIT. One of its sources is WAT's edit_command_target(), which, when the
// focus is not an EDIT, picks the first visible EDIT in ANY window and calls
// set_focus on it before returning it. TetriNET's Playing Fields form
// (0x10011, a top-level TForm with no EDIT child) holds the focus during a
// game; the first visible EDIT is a connection-settings box on the main form.
// Each arrow key therefore moved the focus there, the guest's own focus
// handling then cleared it, and the key was routed to the main form.
// Measured headless: focus 0x10011 before Left, 0x10020 at the poll,
// "[check_input_hwnd] keyboard -> focus 0x10020", and on a two-seat game
// Left and Space moved the falling piece 0 columns against no key at all.
//
// The cases: a focused top-level never has its focus taken by a key; it may
// still redirect typing into its OWN child EDIT (the frame-has-focus case);
// with no focus, edit_command_target keeps its old role; a focused EDIT is
// returned as is.

const assert = require('assert');
const { installInputHandlers } = require('../lib/renderer-input');

const FIELDS = 0x10011;   // Playing Fields form, top-level, no EDIT child
const MAIN = 0x10002;     // main form
const MAIN_EDIT = 0x10020; // EDIT inside the main form (via a panel)
const PANEL = 0x1001e;
const FIELDS_EDIT = 0x10030;

function makeExports(opts) {
  const state = { focus: opts.focus | 0 };
  const calls = [];
  const classes = Object.assign({ [MAIN_EDIT]: 2, [FIELDS_EDIT]: 2 }, opts.classes || {});
  const parents = { [MAIN_EDIT]: PANEL, [PANEL]: MAIN, [FIELDS_EDIT]: FIELDS };
  return {
    _state: state,
    _calls: calls,
    get_focus_hwnd: () => state.focus,
    set_focus: (h) => { calls.push(['set_focus', h]); state.focus = h | 0; },
    ctrl_get_class: (h) => classes[h | 0] || 0,
    wnd_get_parent: (h) => parents[h | 0] || 0,
    send_message: () => 0,
    // WAT's real behaviour: steal the focus for the first visible EDIT.
    edit_command_target: () => {
      calls.push(['edit_command_target']);
      if (classes[state.focus] === 2) return state.focus;
      state.focus = MAIN_EDIT;
      return MAIN_EDIT;
    },
  };
}

class RendererProbe {
  constructor(exports, withFieldsEdit) {
    this.inputQueue = [];
    this.wasm = { exports };
    this.windows = {
      [MAIN]: { hwnd: MAIN, visible: true, isChild: false, wasm: this.wasm, zOrder: 1 },
      [FIELDS]: { hwnd: FIELDS, visible: true, isChild: false, wasm: this.wasm, zOrder: 2 },
      [MAIN_EDIT]: { hwnd: MAIN_EDIT, visible: true, isChild: true, parentHwnd: PANEL, wasm: this.wasm },
    };
    if (withFieldsEdit) {
      this.windows[FIELDS_EDIT] = { hwnd: FIELDS_EDIT, visible: true, isChild: true, parentHwnd: FIELDS, wasm: this.wasm };
    }
  }
  _inputWasmRunsInGuestWorker() { return false; }
}
installInputHandlers(RendererProbe);

// 1. TetriNET: the focused top-level has no EDIT; another window has one.
{
  const e = makeExports({ focus: FIELDS });
  const r = new RendererProbe(e, false);
  assert.strictEqual(r._findWatEditTarget(), 0, 'no EDIT target for the fields form');
  assert.strictEqual(e._state.focus, FIELDS, 'focus stays on the fields form');
  assert.ok(!e._calls.some(c => c[0] === 'edit_command_target'),
    'edit_command_target (which moves focus) is not consulted');
  console.log('ok 1 focused top-level keeps the focus');
}

// 2. A focused top-level frame still types into its own child EDIT.
{
  const e = makeExports({ focus: FIELDS });
  const r = new RendererProbe(e, true);
  assert.strictEqual(r._findWatEditTarget(), FIELDS_EDIT);
  assert.strictEqual(e._state.focus, FIELDS_EDIT);
  console.log('ok 2 frame focus redirects into its own EDIT');
}

// 2b. ...including an EDIT nested under a panel (a view's EDIT): the main
//     form focused, its EDIT is a grandchild.
{
  const e = makeExports({ focus: MAIN });
  const r = new RendererProbe(e, false);
  assert.strictEqual(r._findWatEditTarget(), MAIN_EDIT);
  assert.strictEqual(e._state.focus, MAIN_EDIT);
  assert.ok(!e._calls.some(c => c[0] === 'edit_command_target'));
  console.log('ok 2b frame focus redirects into a nested EDIT');
}

// 3. No focus: edit_command_target keeps its role.
{
  const e = makeExports({ focus: 0 });
  const r = new RendererProbe(e, false);
  assert.strictEqual(r._findWatEditTarget(), MAIN_EDIT);
  assert.ok(e._calls.some(c => c[0] === 'edit_command_target'));
  console.log('ok 3 no focus uses edit_command_target');
}

// 4. A focused EDIT is the target, untouched.
{
  const e = makeExports({ focus: MAIN_EDIT });
  const r = new RendererProbe(e, false);
  assert.strictEqual(r._findWatEditTarget(), MAIN_EDIT);
  assert.deepStrictEqual(e._calls, []);
  console.log('ok 4 focused EDIT returned as is');
}

console.log('PASS test-wat-edit-target-focus');
