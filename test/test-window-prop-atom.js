#!/usr/bin/env node
'use strict';

// USER keys a window property by ATOM. SetPropA with a string adds it as a
// global atom, and GetPropA / RemovePropA with either that string or the atom
// find the same entry. Visual Basic stores its drag subclass with
// SetPropA(hwnd, "<name>") and reads it back with GetPropA(hwnd, 0xC000); when
// string keys were only hashed the lookup missed and Tetravex's dragged tile
// stopped following the mouse after one step.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $t_call (param $which i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.eq (local.get $which) (i32.const 0))
      (then (call $handle_SetPropA (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $which) (i32.const 1))
      (then (call $handle_GetPropA (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $which) (i32.const 2))
      (then (call $handle_RemovePropA (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $which) (i32.const 3))
      (then (call $handle_GlobalFindAtomA (local.get $a) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_set") (param $h i32) (param $k i32) (param $v i32) (result i32)
    (call $t_call (i32.const 0) (local.get $h) (local.get $k) (local.get $v)))
  (func (export "t_get") (param $h i32) (param $k i32) (result i32)
    (call $t_call (i32.const 1) (local.get $h) (local.get $k) (i32.const 0)))
  (func (export "t_remove") (param $h i32) (param $k i32) (result i32)
    (call $t_call (i32.const 2) (local.get $h) (local.get $k) (i32.const 0)))
  (func (export "t_find_atom") (param $s i32) (result i32)
    (call $t_call (i32.const 3) (local.get $s) (i32.const 0) (i32.const 0)))
  (func (export "t_put") (param $ga i32) (param $v i32) (i32.store8 (call $g2w (local.get $ga)) (local.get $v)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const str = s => {
    const ga = e.guest_alloc(s.length + 1) >>> 0;
    [...s].forEach((c, i) => e.t_put(ga + i, c.charCodeAt(0)));
    e.t_put(ga + s.length, 0);
    return ga;
  };
  const H = 0x10001, H2 = 0x10002;
  const name = str('Tetravex.DragSubclass'), sameName = str('Tetravex.DragSubclass'), other = str('SomethingElse');

  assert.strictEqual(e.t_find_atom(name), 0, 'no atom before the first SetProp');
  assert.strictEqual(e.t_set(H, name, 0x1234), 1);
  const atom = e.t_find_atom(name) >>> 0;
  assert(atom >= 0xC000 && atom <= 0xFFFF, `SetPropA with a string adds a global atom (got 0x${atom.toString(16)})`);
  assert.strictEqual(e.t_get(H, atom) >>> 0, 0x1234, 'set by string, read by its atom');
  assert.strictEqual(e.t_get(H, sameName) >>> 0, 0x1234, 'read by an equal string at another address');
  assert.strictEqual(e.t_get(H2, atom) >>> 0, 0, 'properties stay per window');
  assert.strictEqual(e.t_get(H, other) >>> 0, 0, 'an unrelated name misses');

  assert.strictEqual(e.t_set(H, atom, 0x5555), 1);
  assert.strictEqual(e.t_get(H, name) >>> 0, 0x5555, 'set by atom replaces the same entry, read by string');

  assert.strictEqual(e.t_remove(H, name) >>> 0, 0x5555, 'RemovePropA by string returns the data');
  assert.strictEqual(e.t_get(H, atom) >>> 0, 0, 'and the atom key is gone too');

  // An integer atom that was never a string still works on its own.
  assert.strictEqual(e.t_set(H, 0xC123, 7), 1);
  assert.strictEqual(e.t_get(H, 0xC123), 7);
  console.log('PASS  window properties are keyed by atom: string and ATOM forms find the same entry');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
