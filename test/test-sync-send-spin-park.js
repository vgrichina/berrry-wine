#!/usr/bin/env node
'use strict';
// A spin park inside a synchronous send would abandon the send.
//
// The clock/queue spin detectors park a busy-waiting guest by yielding to the
// host from inside the API call. Inside $wnd_send_message (UpdateWindow's
// WM_PAINT, SendMessage) there is no host to take that yield: the nested $run
// returns with EIP on the thunk, every round parks again, and the 64-round
// cap abandons the procedure half-run while its caller carries on. Age of
// Empires II paints its game frame from UpdateWindow at game start; in the
// page a once-a-second wait inside that frame parked, the paint was dropped
// before it resumed the draw system, and the game then centred the cursor
// through a NULL surface pointer to (0,0) -- the edge-scroll corner, so the
// first click sent the camera into the fog. The detectors now leave a nested
// send alone: the call is answered, the clock moves, and the wait ends.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const extraWat = `
  (func (export "test_window") (param $proc i32) (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $host_register_dialog_frame (local.get $h) (i32.const 0)
      (i32.const 0) (i32.const 32) (i32.const 24) (i32.const 0))
    (call $wnd_table_set (local.get $h) (local.get $proc))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x90000000)))
    (local.get $h))
  (func (export "test_send_completed") (result i32) (global.get $wnd_send_completed))
  (func (export "test_clock_parks") (result i32) (global.get $clock_spin_parks))
  (func (export "test_thunk") (param $id i32) (result i32)
    (local $p i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0))
    (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $p)))
`;

const u32 = v => [v, v >>> 8, v >>> 16, v >>> 24].map(b => b & 255);

(async () => {
  // The guest clock advances one millisecond every 32 reads, so a tight
  // timeGetTime loop sees each value 32 times -- well past the detector's K --
  // and a 200 ms wait would take about 200 parks: three times the round cap.
  let reads = 0;
  const { exports: e } = await bootRenderHarness({
    extraWat, fonts: 'none',
    extraHostOverrides: { get_ticks: () => (1000 + (reads++ >> 5)) & 0x7FFFFFFF },
  });
  assert(e.get_spin_park_k() > 0, 'the spin detectors are on');
  const tgtId = apiTable.findIndex(a => a.name === 'timeGetTime');
  assert(tgtId >= 0, 'timeGetTime is in the API table');
  const tgt = e.test_thunk(tgtId);

  const proc = bytes => {
    const at = e.guest_alloc(bytes.length);
    bytes.forEach((b, i) => e.guest_write8(at + i, b));
    return at;
  };
  // push ebx / mov eax,timeGetTime; call eax / mov ebx,eax; add ebx,200
  // loop: mov eax,timeGetTime; call eax; cmp eax,ebx; jb loop
  // pop ebx / mov eax,0x5678 / ret 16
  const waiter = proc([
    0x53,
    0xb8, ...u32(tgt), 0xff, 0xd0,
    0x89, 0xc3, 0x81, 0xc3, ...u32(200),
    0xb8, ...u32(tgt), 0xff, 0xd0, 0x39, 0xd8, 0x72, 0xf5,
    0x5b,
    0xb8, ...u32(0x5678), 0xc2, 0x10, 0x00,
  ]);

  const parksBefore = e.test_clock_parks();
  const h = e.test_window(waiter);
  const result = e.send_message(h, 0x000f, 0, 0);
  assert.strictEqual(e.test_send_completed(), 1,
    'the send completed: a wait inside it is not abandoned at the round cap');
  assert.strictEqual(result >>> 0, 0x5678, 'the send returns the procedure\'s own result');
  assert.strictEqual(e.test_clock_parks() - parksBefore, 0,
    'no clock park was taken inside the nested send');
  assert.strictEqual(e.get_sync_msg_depth(), 0, 'send depth is restored');
  assert.strictEqual(e.get_yield_reason(), 0, 'no park leaks out to the caller');
  console.log('ok: a 200 ms timeGetTime wait inside a synchronous WM_PAINT completes');
  console.log('PASS test-sync-send-spin-park');
})().catch(err => { console.error(err); process.exit(1); });
