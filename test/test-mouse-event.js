#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { BASE } = require('../lib/region-map.generated');
const extraWat = `
  (func (export "test_mouse_event") (param $f i32) (param $x i32) (param $y i32)
      (param $data i32) (param $extra i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $handle_mouse_event (local.get $f) (local.get $x) (local.get $y)
      (local.get $data) (local.get $extra) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))`;
(async () => {
  const { exports: e, renderer: r } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const win = { hwnd: 0x10002, visible: true, wasmMemory: r.wasmMemory, wasm: r.wasm };
  r._inputWindowAtPoint = () => win;
  r._hitTestDeepChild = () => null;
  r._mouseMsgOriginScreen = () => ({ x: 10, y: 20 });
  r._applyCursorClip = (x, y) => ({ x, y });
  r.setMousePosition(100, 100);
  r.inputQueue.length = 0;
  assert.strictEqual(e.test_mouse_event(1, 1, -2, 0, 0x1234), 0x300018,
    'five-argument stdcall, the original Dungeon Lords operation');
  assert.strictEqual(r._mouseX, 101);
  assert.strictEqual(r._mouseY, 98);
  const move = r.inputQueue.shift();
  assert.strictEqual(move.msg, 0x200);
  assert.strictEqual(move.lParam, (78 << 16) | 91);
  assert.strictEqual(move.extraInfo, 0x1234);
  const words = new Int32Array(r.wasmMemory.buffer || r.wasmMemory);
  assert.strictEqual(words[BASE.DI_MOUSE_INPUT_STATE >>> 2], 1);
  assert.strictEqual(words[(BASE.DI_MOUSE_INPUT_STATE >>> 2) + 1], -2);
  e.test_mouse_event(2 | 4, 999, 999, 0, 0);
  assert.deepStrictEqual(r.inputQueue.splice(0).map(v => [v.msg, v.mouseButtons]), [[0x201, 1], [0x202, 0]],
    'button transitions preserve event-time state; coordinates ignored without MOVE');
  assert.strictEqual(r._mouseX, 101);
  e.test_mouse_event(0x800, 0, 0, -240, 7);
  const wheel = r.inputQueue.shift();
  assert.strictEqual(wheel.msg, 0x20a);
  assert.strictEqual(wheel.wParam >> 16, -240);
  assert.strictEqual(wheel.lParam, (98 << 16) | 101, 'wheel lParam is screen coordinates');
  e.test_mouse_event(0x8001, 65535, 65535, 0, 0);
  assert.strictEqual(r._mouseX, r.canvas.width - 1);
  assert.strictEqual(r._mouseY, r.canvas.height - 1);
  r.inputQueue.length = 0;
  e.test_mouse_event(0x80, 0, 0, 2, 0);
  const xbutton = r.inputQueue.shift();
  assert.strictEqual(xbutton.msg, 0x20b);
  assert.strictEqual(xbutton.wParam >>> 16, 2);
  assert.strictEqual(xbutton.mouseButtons, 64);
  e.test_mouse_event(0x100, 0, 0, 2, 0);
  r._activeInputEvent = xbutton;
  assert.strictEqual(r.peekAsyncKeyState(6), 0x8000, 'dequeued X-button state precedes later release');
  assert.strictEqual(r.peekKeyDownState(6), 0, 'physical X-button state includes release');
  r.inputQueue.length = 0;
  assert.strictEqual(r.queueMouseInput(0x880, 0, 0, 1, 0), 0);
  assert.strictEqual(r.inputQueue.length, 0, 'shared wheel/X-button data cannot mean both');
  r._applyCursorClip = () => ({ x: 42, y: 43 });
  e.test_mouse_event(1, 1000, 1000, 0, 0);
  assert.deepStrictEqual([r._mouseX, r._mouseY], [42, 43]);
  e.test_mouse_event(1, 1, 1, 0, 0);
  assert.strictEqual(r.inputQueue.length, 1, 'adjacent mouse moves coalesce');
  e.test_mouse_event(0x2001, 1, 1, 0, 0);
  assert.strictEqual(r.inputQueue.length, 2, 'MOVE_NOCOALESCE retains each message');
  console.log('mouse_event: WAT/host queue, deltas, clipping, buttons, wheel and absolute coordinates PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
