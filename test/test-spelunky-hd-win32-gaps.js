#!/usr/bin/env node
'use strict';

// Win32 entry points the GameMaker:Studio 1.4 runner (Spelunky Classic HD)
// needed before it reached its first frame: ExpandEnvironmentStringsW,
// GetConsoleWindow, GetMonitorInfoW (MONITORINFOEXW), ChangeDisplaySettingsW /
// EnumDisplaySettingsExW (DEVMODEW offsets), the waitable timer trio, and the
// IDirect3D9 / IDirect3DDevice9 QueryInterface D3DX9_43 issues.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

// One export per handler: set ESP, call it, return EAX | ESP << 32.
const call = (name, n) => {
  const params = Array.from({ length: n }, (_, i) => `(param $a${i} i32)`).join(' ');
  const args = Array.from({ length: 5 }, (_, i) => (i < n ? `(local.get $a${i})` : '(i32.const 0)')).join(' ');
  return `
  (func (export "t_${name}") ${params} (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_${name} ${args} (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))`;
};

const extraWat = [
  call('ExpandEnvironmentStringsW', 3),
  call('SetEnvironmentVariableW', 2),
  call('GetConsoleWindow', 0),
  call('GetMonitorInfoW', 2),
  call('GetMonitorInfoA', 2),
  call('EnumDisplaySettingsExW', 4),
  call('ChangeDisplaySettingsW', 2),
  call('CreateWaitableTimerW', 3),
  call('SetWaitableTimer', 6),
  call('CancelWaitableTimer', 1),
  call('CloseHandle', 1),
  call('Direct3DCreate9', 1),
  call('IDirect3D9_QueryInterface', 3),
  call('IDirect3DDevice9_QueryInterface', 3),
].join('\n') + String.raw`
  (func (export "t_timer_slot") (param $h i32) (result i32)
    (local $s i32)
    (local.set $s (call $waitable_timer_slot (local.get $h)))
    (if (result i32) (local.get $s)
      (then (i32.sub (local.get $s) (global.get $GUEST_BASE)))
      (else (i32.const -1))))
  (func (export "t_timer_field") (param $h i32) (param $off i32) (result i32)
    (i32.load (i32.add (call $waitable_timer_slot (local.get $h)) (local.get $off))))
  (func (export "t_timer_consume") (param $h i32)
    (call $mm_timer_consume_slot (call $waitable_timer_slot (local.get $h))))
  (func (export "t_last_error") (result i32) (global.get $last_error))
`;

const lo = r => Number(r & 0xffffffffn) >>> 0;
const popped = r => Number(r >> 32n) - 0x00300000;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({
    extraWat, fonts: 'none',
    // The harness has no ThreadManager; one live event handle is enough.
    extraHostOverrides: {
      create_event: () => 0x000e0000,
      reset_event: h => (h === 0x000e0000 ? 1 : 0),
    },
  });
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const w = g => (g - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  const alloc = n => e.guest_alloc(n) >>> 0;
  const putW = (g, s) => { for (let i = 0; i <= s.length; i++) view.setUint16(w(g) + i * 2, i < s.length ? s.charCodeAt(i) : 0, true); };
  const getW = (g, max = 256) => { let s = ''; for (let i = 0; i < max; i++) { const c = view.getUint16(w(g) + i * 2, true); if (!c) break; s += String.fromCharCode(c); } return s; };

  // ExpandEnvironmentStringsW: WCHAR counts including the NUL; unknown names stay verbatim.
  const name = alloc(64), value = alloc(64), src = alloc(256), dst = alloc(256);
  putW(name, 'GMSAVE'); putW(value, 'C:\\Saves');
  assert.strictEqual(lo(e.t_SetEnvironmentVariableW(name, value)), 1);
  putW(src, '%GMSAVE%\\spelunky %NOPE%');
  let r = e.t_ExpandEnvironmentStringsW(src, dst, 128);
  assert.strictEqual(getW(dst), 'C:\\Saves\\spelunky %NOPE%');
  assert.strictEqual(lo(r), 'C:\\Saves\\spelunky %NOPE%'.length + 1, 'returns WCHARs including the NUL');
  assert.strictEqual(popped(r), 16, 'three-argument stdcall');
  bytes.fill(0xa5, w(dst), w(dst) + 64);
  r = e.t_ExpandEnvironmentStringsW(src, dst, 4);
  assert.strictEqual(lo(r), 'C:\\Saves\\spelunky %NOPE%'.length + 1, 'a short buffer still reports the required size');
  assert.strictEqual(bytes[w(dst) + 8], 0xa5, 'and writes nothing past nSize WCHARs');

  // GetConsoleWindow: the bare harness has no PE, so it runs as an attached
  // console process; its console always has a window, created on first ask
  // and the same one afterwards. (A GUI process -- Spelunky -- gets NULL.)
  r = e.t_GetConsoleWindow();
  assert.notStrictEqual(lo(r), 0, 'an attached console has a window');
  assert.strictEqual(popped(r), 4);
  assert.strictEqual(lo(e.t_GetConsoleWindow()), lo(r), 'and it is the same window every time');

  // GetMonitorInfoW with MONITORINFOEXW (104 bytes) carries a WCHAR szDevice.
  const mi = alloc(128);
  bytes.fill(0xa5, w(mi), w(mi) + 128);
  view.setUint32(w(mi), 104, true);
  r = e.t_GetMonitorInfoW(0x00010000, mi);
  assert.strictEqual(lo(r), 1); assert.strictEqual(popped(r), 12);
  assert.strictEqual(view.getUint32(w(mi) + 12, true), 640, 'rcMonitor.right');
  assert.strictEqual(view.getUint32(w(mi) + 16, true), 480, 'rcMonitor.bottom');
  assert.strictEqual(view.getUint32(w(mi) + 36, true), 1, 'MONITORINFOF_PRIMARY');
  assert.strictEqual(getW(mi + 40, 32), '\\\\.\\DISPLAY1', 'szDevice is UTF-16');
  assert.strictEqual(view.getUint16(w(mi) + 40 + 62, true), 0, 'szDevice tail cleared');
  assert.strictEqual(bytes[w(mi) + 104], 0xa5, 'stops at cbSize');
  view.setUint32(w(mi), 72, true);
  assert.strictEqual(lo(e.t_GetMonitorInfoW(0x00010000, mi)), 0, 'the ANSI EX size is not a W size');
  assert.strictEqual(e.t_last_error(), 87);
  assert.strictEqual(lo(e.t_GetMonitorInfoA(0x00010000, mi)), 1, 'but it is an A size');
  assert.strictEqual(String.fromCharCode(...bytes.subarray(w(mi) + 40, w(mi) + 52)), '\\\\.\\DISPLAY1');
  view.setUint32(w(mi), 40, true);
  assert.strictEqual(lo(e.t_GetMonitorInfoW(0x00010000, mi)), 1, 'plain MONITORINFO is accepted by W');

  // EnumDisplaySettingsExW: DEVMODEW fields (dmBitsPerPel at 168), 5-dword pop.
  const dm = alloc(0x200);
  bytes.fill(0, w(dm), w(dm) + 0x200);
  view.setUint16(w(dm) + 68, 220, true);
  r = e.t_EnumDisplaySettingsExW(0, -1, dm, 0);
  assert.strictEqual(lo(r), 1); assert.strictEqual(popped(r), 20, 'four-argument stdcall');
  assert.strictEqual(view.getUint32(w(dm) + 168, true), 32, 'dmBitsPerPel');
  assert.strictEqual(view.getUint32(w(dm) + 172, true), 640, 'dmPelsWidth');
  assert.strictEqual(view.getUint32(w(dm) + 176, true), 480, 'dmPelsHeight');

  // ChangeDisplaySettingsW reads the W offsets: a 32-bpp request at the
  // current size is a no-op success, and a NULL DEVMODE restores the registry mode.
  r = e.t_ChangeDisplaySettingsW(dm, 0);
  assert.strictEqual(lo(r), 0, 'DISP_CHANGE_SUCCESSFUL'); assert.strictEqual(popped(r), 12);
  assert.strictEqual(lo(e.t_ChangeDisplaySettingsW(0, 0)), 0);

  // Waitable timers.
  r = e.t_CreateWaitableTimerW(0, 1, 0);
  const h = lo(r);
  assert.notStrictEqual(h, 0); assert.strictEqual(popped(r), 16);
  const due = alloc(8);
  view.setBigInt64(w(due), -165000n, true); // 16.5 ms relative
  r = e.t_SetWaitableTimer(h, due, 0, 0, 0, 0);
  assert.strictEqual(lo(r), 1); assert.strictEqual(popped(r), 28, 'six-argument stdcall');
  assert.notStrictEqual(e.t_timer_slot(h), -1, 'armed');
  assert.strictEqual(e.t_timer_field(h, 4), 17, 'relative due rounds up to whole ms');
  assert.strictEqual(e.t_timer_field(h, 20), 0x51, 'one-shot EVENT_SET waitable slot');
  e.t_timer_consume(h);
  assert.strictEqual(e.t_timer_slot(h), -1, 'one-shot retires when it fires');

  r = e.t_SetWaitableTimer(h, due, 10, 0, 0, 0);
  assert.strictEqual(e.t_timer_field(h, 20), 0x50, 'periodic');
  assert.strictEqual(e.t_timer_field(h, 4), 17, 'first interval is the due time');
  e.t_timer_consume(h);
  assert.strictEqual(e.t_timer_field(h, 4), 10, 'later intervals are lPeriod');
  const first = e.t_timer_slot(h);
  e.t_SetWaitableTimer(h, due, 10, 0, 0, 0);
  assert.strictEqual(e.t_timer_slot(h), first, 're-setting replaces the deadline instead of adding a slot');
  r = e.t_CancelWaitableTimer(h);
  assert.strictEqual(lo(r), 1); assert.strictEqual(popped(r), 8);
  assert.strictEqual(e.t_timer_slot(h), -1, 'cancelled');

  assert.strictEqual(lo(e.t_SetWaitableTimer(h, 0, 0, 0, 0, 0)), 0, 'NULL pDueTime');
  assert.strictEqual(e.t_last_error(), 87);
  assert.strictEqual(lo(e.t_SetWaitableTimer(h, due, -1, 0, 0, 0)), 0, 'negative period');
  assert.strictEqual(lo(e.t_SetWaitableTimer(0x0bad0bad, due, 0, 0, 0, 0)), 0, 'not a timer handle');
  assert.strictEqual(e.t_last_error(), 6);

  e.t_SetWaitableTimer(h, due, 10, 0, 0, 0);
  assert.notStrictEqual(e.t_timer_slot(h), -1);
  e.t_CloseHandle(h);
  assert.strictEqual(e.t_timer_slot(h), -1, 'closing the handle disarms its timer');

  // QueryInterface: IUnknown and the object's own IID, never the Ex IIDs.
  const iid = alloc(16), out = alloc(4);
  const putIid = words => words.forEach((v, i) => view.setUint32(w(iid) + i * 4, v >>> 0, true));
  const d3d = lo(e.t_Direct3DCreate9(32));
  assert.notStrictEqual(d3d, 0, 'Direct3DCreate9');
  putIid([0x81BDCBCA, 0x426D64D4, 0x01AD8DAE, 0x5C27F447]);
  view.setUint32(w(out), 0xdeadbeef, true);
  r = e.t_IDirect3D9_QueryInterface(d3d, iid, out);
  assert.strictEqual(lo(r), 0, 'IID_IDirect3D9 is S_OK'); assert.strictEqual(popped(r), 16);
  assert.strictEqual(view.getUint32(w(out), true), d3d);
  putIid([0, 0, 0xC0, 0x46000000]);
  assert.strictEqual(lo(e.t_IDirect3D9_QueryInterface(d3d, iid, out)), 0, 'IUnknown');
  putIid([0x02177241, 0x4FA769FA, 0x2CB09C89, 0x7C2B1B6C]); // IID_IDirect3D9Ex
  assert.strictEqual(lo(e.t_IDirect3D9_QueryInterface(d3d, iid, out)), 0x80004002, 'Direct3D9Ex is E_NOINTERFACE');
  assert.strictEqual(view.getUint32(w(out), true), 0, '*ppv cleared on failure');
  putIid([0xB18B10CE, 0x405A2649, 0xF7950F87, 0x3A31D477]); // IID_IDirect3DDevice9Ex, what D3DX asks
  view.setUint32(w(out), 0xdeadbeef, true);
  r = e.t_IDirect3DDevice9_QueryInterface(d3d, iid, out);
  assert.strictEqual(lo(r), 0x80004002, 'Device9Ex is E_NOINTERFACE'); assert.strictEqual(popped(r), 16);
  assert.strictEqual(view.getUint32(w(out), true), 0);

  console.log('test-spelunky-hd-win32-gaps: ok');
})().catch(err => { console.error(err); process.exit(1); });
