#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $test_token_esp_delta (mut i32) (i32.const 0))

  (func (export "test_call_LookupPrivilegeValueA")
    (param $system i32) (param $name i32) (param $luid i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LookupPrivilegeValueA
      (local.get $system) (local.get $name) (local.get $luid)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $test_token_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $saved)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_OpenProcessToken")
    (param $process i32) (param $access i32) (param $out i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_OpenProcessToken
      (local.get $process) (local.get $access) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $test_token_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $saved)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_GetTokenInformation")
    (param $token i32) (param $class i32) (param $info i32)
    (param $length i32) (param $return_length i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetTokenInformation
      (local.get $token) (local.get $class) (local.get $info)
      (local.get $length) (local.get $return_length) (i32.const 0))
    (global.set $test_token_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $saved)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_AdjustTokenPrivileges")
    (param $token i32) (param $disable_all i32) (param $new_state i32)
    (param $length i32) (param $previous i32) (param $return_length i32)
    (result i32)
    (local $saved i32) (local $frame i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $frame (call $heap_alloc (i32.const 32)))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24))
      (local.get $return_length))
    (call $handle_AdjustTokenPrivileges
      (local.get $token) (local.get $disable_all) (local.get $new_state)
      (local.get $length) (local.get $previous) (i32.const 0))
    (global.set $test_token_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  ;; Not test_call_CloseHandle: the generated dispatch table exports that one
  ;; (09b2), without the ESP-delta capture this test asserts on.
  (func (export "test_token_close_handle") (param $handle i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_CloseHandle
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $test_token_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $saved)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_get_token_esp_delta") (result i32)
    (global.get $test_token_esp_delta))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_token_handle_value")
    (param $slot i32) (param $generation i32) (result i32)
    (call $token_handle_value (local.get $slot) (local.get $generation)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const view = new DataView(memory.buffer);
  const alloc = size => e.guest_alloc(size) >>> 0;
  const writeA = (guest, value) => {
    const wa = toWasm(guest);
    for (let i = 0; i < value.length; i++) view.setUint8(wa + i, value.charCodeAt(i));
    view.setUint8(wa + value.length, 0);
  };
  const u32 = guest => view.getUint32(toWasm(guest), true);
  const set32 = (guest, value) => view.setUint32(toWasm(guest), value >>> 0, true);
  const privilegeAttr = (buffer, low) => {
    const count = u32(buffer);
    for (let i = 0; i < count; i++) {
      const entry = buffer + 4 + i * 12;
      if (u32(entry) === low && u32(entry + 4) === 0) return u32(entry + 8);
    }
    return undefined;
  };
  const setPrivilege = (buffer, index, low, high, attrs) => {
    const entry = buffer + 4 + index * 12;
    set32(entry, low);
    set32(entry + 4, high);
    set32(entry + 8, attrs);
  };

  assert.strictEqual(e.test_token_handle_value(31, 0x7ffff) >>> 24, 0xfa,
    'the maximum generation cannot overlap the fixed token namespace byte');
  assert.strictEqual(e.test_token_handle_value(31, 0x80000) >>> 0, 0xfa00001f,
    'generation overflow is masked before handle encoding');

  const scratch = alloc(1024);
  const name = scratch;
  const luid = scratch + 96;
  writeA(name, 'SeBackupPrivilege');
  set32(luid, 0xdeadbeef);
  set32(luid + 4, 0xdeadbeef);
  e.test_set_last_error(0x1111);
  assert.strictEqual(e.test_call_LookupPrivilegeValueA(0, name, luid), 1);
  assert.deepStrictEqual([u32(luid), u32(luid + 4)], [17, 0],
    'SeBackupPrivilege has its stable classic LUID');
  assert.strictEqual(e.test_get_token_esp_delta(), 16,
    'LookupPrivilegeValueA pops three stdcall arguments');
  assert.strictEqual(e.test_get_last_error(), 0x1111,
    'successful LookupPrivilegeValueA preserves last error');

  const classicPrivileges = [
    'SeCreateTokenPrivilege', 'SeAssignPrimaryTokenPrivilege',
    'SeLockMemoryPrivilege', 'SeIncreaseQuotaPrivilege',
    'SeMachineAccountPrivilege', 'SeTcbPrivilege', 'SeSecurityPrivilege',
    'SeTakeOwnershipPrivilege', 'SeLoadDriverPrivilege',
    'SeSystemProfilePrivilege', 'SeSystemtimePrivilege',
    'SeProfileSingleProcessPrivilege', 'SeIncreaseBasePriorityPrivilege',
    'SeCreatePagefilePrivilege', 'SeCreatePermanentPrivilege',
    'SeBackupPrivilege', 'SeRestorePrivilege', 'SeShutdownPrivilege',
    'SeDebugPrivilege', 'SeAuditPrivilege', 'SeSystemEnvironmentPrivilege',
    'SeChangeNotifyPrivilege', 'SeRemoteShutdownPrivilege',
    'SeUndockPrivilege', 'SeSyncAgentPrivilege',
    'SeEnableDelegationPrivilege', 'SeManageVolumePrivilege',
  ];
  for (let i = 0; i < classicPrivileges.length; i++) {
    writeA(name, classicPrivileges[i]);
    assert.strictEqual(e.test_call_LookupPrivilegeValueA(0, name, luid), 1,
      `${classicPrivileges[i]} is a known privilege`);
    assert.deepStrictEqual([u32(luid), u32(luid + 4)], [i + 2, 0],
      `${classicPrivileges[i]} maps to stable LUID ${i + 2}`);
  }

  writeA(name, 'serestoreprivilege');
  assert.strictEqual(e.test_call_LookupPrivilegeValueA(0, name, luid), 1,
    'privilege-name lookup is case-insensitive');
  assert.strictEqual(u32(luid), 18, 'SeRestorePrivilege has LUID 18');
  writeA(name, 'SeDefinitelyNotAPrivilege');
  set32(luid, 0xaaaaaaaa);
  assert.strictEqual(e.test_call_LookupPrivilegeValueA(0, name, luid), 0);
  assert.strictEqual(e.test_get_last_error(), 1313, 'unknown names report ERROR_NO_SUCH_PRIVILEGE');
  assert.strictEqual(u32(luid), 0xaaaaaaaa, 'failed lookup leaves the output untouched');
  const remote = scratch + 160;
  writeA(remote, '\\\\remote');
  writeA(name, 'SeBackupPrivilege');
  assert.strictEqual(e.test_call_LookupPrivilegeValueA(remote, name, luid), 0,
    'the browser model has no remote security authority');
  assert.strictEqual(e.test_get_last_error(), 53, 'remote lookup reports ERROR_BAD_NETPATH');
  assert.strictEqual(e.test_call_LookupPrivilegeValueA(0, 1, luid), 0);
  assert.strictEqual(e.test_get_last_error(), 87, 'an unmapped name is invalid input');

  const handleOut = scratch + 192;
  set32(handleOut, 0xcccccccc);
  assert.strictEqual(e.test_call_OpenProcessToken(0x12345678, 0x28, handleOut), 0,
    'OpenProcessToken rejects a foreign process handle');
  assert.strictEqual(e.test_get_last_error(), 6, 'foreign process reports ERROR_INVALID_HANDLE');
  assert.strictEqual(u32(handleOut), 0xcccccccc, 'failed open is output-atomic');
  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x28, 1), 0,
    'OpenProcessToken rejects an unmapped output');
  assert.strictEqual(e.test_get_last_error(), 87);

  e.test_set_last_error(0x2222);
  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x08, handleOut), 1);
  const queryOnly = u32(handleOut);
  assert.strictEqual(e.test_get_token_esp_delta(), 16,
    'OpenProcessToken pops three stdcall arguments');
  assert.strictEqual(e.test_get_last_error(), 0x2222,
    'successful OpenProcessToken preserves last error');
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(queryOnly, 1, 0, 0, 0, 0), 0,
    'TOKEN_QUERY alone cannot adjust privileges');
  assert.strictEqual(e.test_get_last_error(), 5, 'missing TOKEN_ADJUST_PRIVILEGES is denied');

  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x20, handleOut), 1);
  const adjustOnly = u32(handleOut);
  const previous = scratch + 256;
  const returnLength = scratch + 384;
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(adjustOnly, 1, 0, 64, previous, returnLength), 0,
    'PreviousState additionally requires TOKEN_QUERY');
  assert.strictEqual(e.test_get_last_error(), 5);

  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x28, handleOut), 1);
  const token = u32(handleOut);
  assert.notStrictEqual(token, queryOnly, 'each open has an independent handle identity');
  assert.notStrictEqual(token, adjustOnly);

  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 0, 1, 0, 0, 0), 0,
    'a variable TOKEN_PRIVILEGES array must begin in mapped memory');
  assert.strictEqual(e.test_get_last_error(), 87);
  const malformedState = scratch + 392;
  set32(malformedState, 357913941);
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 0, malformedState, 0, 0, 0), 0,
    'an overflowing PrivilegeCount is rejected before array traversal');
  assert.strictEqual(e.test_get_last_error(), 87);

  const state = scratch + 400;
  set32(state, 3);
  setPrivilege(state, 0, 17, 0, 2);
  setPrivilege(state, 1, 18, 0, 2);
  setPrivilege(state, 2, 99, 0, 2);
  set32(returnLength, 0);
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 0, state, 16, previous, returnLength), 0,
    'a short PreviousState buffer fails before changing any privilege');
  assert.strictEqual(e.test_get_last_error(), 122);
  assert.strictEqual(u32(returnLength), 28, 'ReturnLength reports both changed privilege records');

  const tokenInfo = scratch + 480;
  set32(returnLength, 0);
  e.test_set_last_error(0x3333);
  assert.strictEqual(e.test_call_GetTokenInformation(token, 3, tokenInfo, 328, returnLength), 1,
    'TokenPrivileges is queryable through the retained token record');
  assert.strictEqual(u32(returnLength), 328);
  assert.strictEqual(e.test_get_last_error(), 0x3333,
    'successful GetTokenInformation preserves last error');
  assert.strictEqual(privilegeAttr(tokenInfo, 17), 0,
    'failed adjustment did not enable backup privilege');
  assert.strictEqual(privilegeAttr(tokenInfo, 18), 0,
    'failed adjustment did not enable restore privilege');
  assert.strictEqual(privilegeAttr(tokenInfo, 23), 2,
    'SeChangeNotifyPrivilege begins enabled by default');

  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 0, state, 28, previous, returnLength), 1,
    'known privileges are adjusted even when the request also contains an unknown LUID');
  assert.strictEqual(e.test_get_last_error(), 1300,
    'partial assignment succeeds with ERROR_NOT_ALL_ASSIGNED');
  assert.strictEqual(u32(previous), 2);
  assert.strictEqual(privilegeAttr(previous, 17), 0);
  assert.strictEqual(privilegeAttr(previous, 18), 0);
  assert.strictEqual(e.test_get_token_esp_delta(), 28,
    'AdjustTokenPrivileges pops six stdcall arguments');

  set32(state, 1);
  setPrivilege(state, 0, 17, 0, 0);
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 0, state, 16, previous, returnLength), 1);
  assert.strictEqual(e.test_get_last_error(), 0);
  assert.strictEqual(u32(previous), 1);
  assert.strictEqual(privilegeAttr(previous, 17), 2,
    'PreviousState reports the enabled state that was replaced');

  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 1, 1, 28, previous, returnLength), 1,
    'DisableAllPrivileges ignores NewState, even when it is not mapped');
  assert.strictEqual(u32(previous), 2,
    'DisableAllPrivileges reports restore and change-notify as changed');
  assert.strictEqual(privilegeAttr(previous, 18), 2);
  assert.strictEqual(privilegeAttr(previous, 23), 2);

  set32(state, 1);
  setPrivilege(state, 0, 17, 0, 2);
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 0, state, 0, 0, 0), 1,
    'BufferLength is ignored when PreviousState is NULL');
  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x08, handleOut), 1);
  const secondQuery = u32(handleOut);
  assert.strictEqual(e.test_call_GetTokenInformation(secondQuery, 3, tokenInfo, 328, returnLength), 1);
  assert.strictEqual(privilegeAttr(tokenInfo, 17), 2,
    'separately opened handles observe the same process token state');

  assert.strictEqual(e.test_token_close_handle(token), 1, 'CloseHandle releases a live token handle');
  assert.strictEqual(e.test_get_token_esp_delta(), 8, 'CloseHandle pops one stdcall argument');
  assert.strictEqual(e.test_call_AdjustTokenPrivileges(token, 1, 0, 0, 0, 0), 0,
    'closed generations are invalid immediately');
  assert.strictEqual(e.test_get_last_error(), 6);
  assert.strictEqual(e.test_token_close_handle(token), 0, 'closing a stale generation fails');
  assert.strictEqual(e.test_get_last_error(), 6);

  assert.strictEqual(e.test_token_close_handle(queryOnly), 1);
  assert.strictEqual(e.test_token_close_handle(adjustOnly), 1);
  assert.strictEqual(e.test_token_close_handle(secondQuery), 1);
  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x28, handleOut), 1);
  const replacement = u32(handleOut);
  assert.notStrictEqual(replacement, token,
    'a reused slot advances its generation and rejects stale aliases');
  assert.strictEqual(e.test_token_close_handle(replacement), 1);

  const live = [];
  for (let i = 0; i < 32; i++) {
    assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x08, handleOut), 1,
      `bounded token slot ${i} opens`);
    live.push(u32(handleOut));
  }
  assert.strictEqual(new Set(live).size, 32, 'all live token handles are distinct');
  set32(handleOut, 0xdddddddd);
  assert.strictEqual(e.test_call_OpenProcessToken(-1, 0x08, handleOut), 0,
    'the 33rd simultaneous token handle fails cleanly');
  assert.strictEqual(e.test_get_last_error(), 8, 'a full token table reports ERROR_NOT_ENOUGH_MEMORY');
  assert.strictEqual(u32(handleOut), 0xdddddddd, 'table exhaustion leaves the output untouched');
  for (const handle of live) assert.strictEqual(e.test_token_close_handle(handle), 1);

  e.test_set_last_error(0x4444);
  assert.strictEqual(e.test_token_close_handle(0x7a000001), 1,
    'a VFS-range handle is not stolen by the token CloseHandle namespace');
  assert.strictEqual(e.test_get_last_error(), 0x4444,
    'the ordinary non-token CloseHandle fallback remains unchanged');

  console.log('PASS token privileges retain state, access and generation-tagged lifetime');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
