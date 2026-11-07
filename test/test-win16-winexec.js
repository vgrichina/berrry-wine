#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createWinExecReadiness } = require('../host');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_win16_winexec") (result i32)
    (call $win16_seg_set (i32.const 1) (i32.const 0x00100000)
      (i32.const 0x10000) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x00110000)
      (i32.const 0x10000) (i32.const 1) (i32.const 2))
    (call $win16_seg_set (i32.const 3) (i32.const 0x00120000)
      (i32.const 0x10000) (i32.const 2) (i32.const 3))
    (call $win16_seg_set (i32.const 4) (i32.const 0x00130000)
      (i32.const 0x10000) (i32.const 0) (i32.const 4))
    (global.set $WIN16_THUNK_SEL (call $win16_index_to_sel (i32.const 4)))
    (global.set $code16 (i32.const 1))
    (global.set $sreg_cs (call $win16_index_to_sel (i32.const 1)))
    (global.set $seg_base_cs (i32.const 0x00100000))
    (global.set $sreg_ss (call $win16_index_to_sel (i32.const 2)))
    (global.set $seg_base_ss (i32.const 0x00110000))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00110100))
    ;; Far return, then Pascal's rightmost argument first: show, command.
    (call $gs16 (i32.const 0x00110100) (i32.const 0x0020))
    (call $gs16 (i32.const 0x00110102) (call $win16_index_to_sel (i32.const 1)))
    (call $gs16 (i32.const 0x00110104) (i32.const 5))
    (call $gs16 (i32.const 0x00110106) (i32.const 0x0040))
    (call $gs16 (i32.const 0x00110108) (call $win16_index_to_sel (i32.const 3)))
    (call $win16_WinExec)
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_task_path") (param $p i32) (param $n i32)
    (global.set $win16_task_module (i32.const 13))
    (global.set $win16_task_slot (i32.const 1))
    (memory.copy (i32.add (call $win16_task_start_slot (i32.const 1)) (i32.const 0x98))
      (local.get $p) (local.get $n)))
  (func (export "test_win16_winexec_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_win16_winexec_eip") (result i32) (global.get $eip))
`;

(async () => {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const launches = [];
  let ticketMode = false, returnCode = 33;
  const startup = { ready: false, exited: false };
  const readiness = createWinExecReadiness();
  const readString = pointer => {
    const bytes = new Uint8Array(memory.buffer);
    let value = '';
    for (let p = pointer; bytes[p]; p++) value += String.fromCharCode(bytes[p]);
    return value;
  };
  const { exports: e } = await bootRenderHarness({
    extraWat,
    memory,
    extraHostOverrides: {
      process_ctl: (op, frame, arg) => ticketMode ? readiness.control(op, frame, arg) : -1,
      shell_execute(hwnd, operation, file, params, directory, show) {
        launches.push({
          hwnd, operation: readString(operation), file: readString(file),
          params: readString(params), directory: readString(directory), show,
        });
        return ticketMode ? readiness.issue(startup) : returnCode;
      },
    },
  });

  const command = 'C:\\WINDOWS\\TEMP\\_INS0432._MP -fD:\\SETUP.INS';
  for (const [i, byte] of Buffer.from(command + '\0', 'ascii').entries()) {
    e.guest_write8(0x00120040 + i, byte);
  }
  assert.strictEqual(e.test_win16_winexec(), 33,
    'Win16 WinExec returns the browser child-launch result');
  assert.deepStrictEqual(launches, [{
    hwnd: 0, operation: 'WinExec', file: command,
    params: 'C:\\WINDOWS;C:\\WINDOWS\\COMMAND', directory: 'C:\\app.exe', show: 5,
  }], 'Win16 WinExec forwards the command and parsing marker');
  assert.strictEqual(e.test_win16_winexec_esp(), 0x0011010a,
    'WinExec removes its far return and six-byte Pascal argument list');
  assert.strictEqual(e.test_win16_winexec_eip(), 0x00100020,
    'WinExec returns to its Win16 caller');

  const appPath = 'D:\\Ordinary App\\Parent.exe';
  const ptr = e.get_staging();
  // Include the terminator in the retained task start record.
  new Uint8Array(memory.buffer).set(Buffer.from(appPath + String.fromCharCode(0)), ptr);
  e.test_task_path(ptr, appPath.length + 1);
  e.test_win16_winexec();
  assert.strictEqual(launches.at(-1).directory, appPath, 'calling task path beats root process identity');
  assert.strictEqual(launches.at(-1).file, command, 'guest command is unchanged');
  ticketMode = true;
  const count = launches.length;
  e.test_win16_winexec();
  assert.strictEqual(e.test_win16_winexec_esp(), 0x00110100, 'startup wait preserves far Pascal frame');
  for (let i = 0; i < 3; i++) e.test_win16_winexec();
  assert.strictEqual(launches.length, count + 1, 'pending startup never launches twice');
  startup.ready = true;
  assert.strictEqual(e.test_win16_winexec(), 33, 'startup ticket becomes a successful 16-bit result');
  assert.strictEqual(e.test_win16_winexec_esp(), 0x0011010a);
  assert.strictEqual(launches.length, count + 1);
  ticketMode = false;
  for (const code of [0, 2, 3, 11]) {
    returnCode = code;
    assert.strictEqual(e.test_win16_winexec(), code, 'direct host errors survive the Win16 adapter');
    assert.strictEqual(e.test_win16_winexec_esp(), 0x0011010a);
  }
  console.log('PASS  Win16 WinExec launches decompressed VFS child executables');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
