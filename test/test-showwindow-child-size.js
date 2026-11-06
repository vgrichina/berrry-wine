#!/usr/bin/env node
'use strict';

// First showing a hidden child delivers its current client size. Frameworks
// use that notification to lay out controls created after the container.
// Only the first show: USER clears its need-size flag once the message is
// sent. Paint's text box hides and re-shows itself from its own WM_SIZE
// handler, so a WM_SIZE on every show looped for as long as it existed.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const packedSize = (283 | (102 << 16)) >>> 0;
const extraWat = String.raw`
  (func (export "test_create_hidden_child") (result i32)
    (local $parent i32) (local $child i32)
    (local.set $parent (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $parent) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $parent) (i32.const 0x10000000)))
    (global.set $main_hwnd (local.get $parent))

    (local.set $child (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $child) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $child) (i32.const 0x40000000)))
    (call $wnd_set_parent (local.get $child) (local.get $parent))
    (local.get $child))

  (func (export "test_call_show_window") (param $hwnd i32) (param $cmd i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_ShowWindow
      (local.get $hwnd) (local.get $cmd)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: { show_window: () => packedSize },
  });

  const child = e.test_create_hidden_child() >>> 0;
  e.set_post_queue_count(0);
  e.test_call_show_window(child, 5);

  assert.strictEqual(e.post_queue_depth(), 1,
    'first show sends WM_SHOWWINDOW synchronously and queues only WM_SIZE');
  assert.deepStrictEqual([0, 1, 2, 3].map(field => e.post_queue_peek(0, field) >>> 0),
    [child, 0x0005, 0, packedSize], 'WM_SIZE carries the current child client size');

  e.set_post_queue_count(0);
  e.test_call_show_window(child, 5);
  // Windows sends WM_SHOWWINDOW only on a visibility change; Dethkarz calls
  // ShowWindow from its WM_SHOWWINDOW arm and looped on the resend.
  assert.strictEqual(e.post_queue_depth(), 0,
    'showing an already-visible child sends neither WM_SIZE nor WM_SHOWWINDOW');

  e.test_call_show_window(child, 0);
  e.set_post_queue_count(0);
  e.test_call_show_window(child, 5);
  const resent = [];
  for (let i = 0; i < e.post_queue_depth(); i++) resent.push(e.post_queue_peek(i, 1) >>> 0);
  assert(!resent.includes(0x0005),
    `showing the child again after SW_HIDE must not synthesize another WM_SIZE (queued ${resent.map(m => '0x' + m.toString(16))})`);

  console.log('PASS ShowWindow sizes a hidden child once, when it first becomes visible');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
