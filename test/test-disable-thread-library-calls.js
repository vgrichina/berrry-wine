#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const { ThreadManager } = require('../lib/thread-manager');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func (export "test_seed_dll_thread_flags")
    ;; Registry length is process-shared, as read by get_dll_count.
    (i32.atomic.store (global.get $DLL_SHARED) (i32.const 2))
    (memory.fill (global.get $DLL_TABLE) (i32.const 0) (global.get $DLL_TABLE_SIZE))
    (memory.fill (global.get $DLL_FLAGS_TABLE) (i32.const 0) (global.get $DLL_FLAGS_TABLE_SIZE))
    (i32.store (global.get $DLL_TABLE) (i32.const 0x00600000))
    (i32.store offset=32 (global.get $DLL_TABLE) (i32.const 0x00700000))
    ;; Slot 1 advertises IMAGE_DIRECTORY_ENTRY_TLS and must keep notifications.
    (i32.store offset=4 (global.get $DLL_FLAGS_TABLE) (i32.const 1)))

  (func (export "test_call_DisableThreadLibraryCalls") (param $module i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0))
    (call $handle_DisableThreadLibraryCalls
      (local.get $module) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

async function main() {
  const { exports: e, memory, instance } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.test_seed_dll_thread_flags();
  assert.equal(e.get_dll_count(), 2, 'fixture publishes two real shared registry rows');

  assert.strictEqual(e.dll_thread_notifications_enabled(0x00600000), 1,
    'an ordinary loaded DLL initially receives thread notifications');
  e.test_call_SetLastError(0x1234);
  assert.strictEqual(e.test_call_DisableThreadLibraryCalls(0x00600000), 1,
    'a loaded DLL without static TLS can disable notifications');
  assert.strictEqual(e.test_call_GetLastError(), 0x1234,
    'successful DisableThreadLibraryCalls preserves LastError');
  assert.strictEqual(e.dll_thread_notifications_enabled(0x00600000), 0,
    'the disabled state is visible to thread creation');
  assert.strictEqual(e.test_call_DisableThreadLibraryCalls(0x00600000), 1,
    'disabling an already-disabled DLL remains successful');

  e.test_call_SetLastError(0x1234);
  assert.strictEqual(e.test_call_DisableThreadLibraryCalls(0x00700000), 0,
    'a DLL with active static TLS cannot disable notifications');
  assert.strictEqual(e.test_call_GetLastError(), 87,
    'static TLS failure reports ERROR_INVALID_PARAMETER');
  assert.strictEqual(e.dll_thread_notifications_enabled(0x00700000), 1,
    'the static-TLS DLL remains on the notification list');

  for (const module of [0, 0x00400000, 0x00dead00]) {
    e.test_call_SetLastError(0x1234);
    assert.strictEqual(e.test_call_DisableThreadLibraryCalls(module), 0,
      `invalid/non-DLL module 0x${module.toString(16)} is rejected`);
    assert.strictEqual(e.test_call_GetLastError(), 87,
      'invalid module failure reports ERROR_INVALID_PARAMETER');
  }

  const manager = new ThreadManager(null, memory, instance, null);
  const dll = { loadAddr: 0x00600000 };
  assert.strictEqual(manager._dllWantsThreadNotifications({}, dll), true,
    'an older external WASM module retains notify-all compatibility');
  assert.strictEqual(manager._dllWantsThreadNotifications({
    dll_thread_notifications_enabled: module => module === 0x00700000,
  }, dll), false, 'cooperative thread creation consults live WAT loader state');

  const detachCalls = [];
  manager.setLoadedDlls([
    { loadAddr: 0x00600000, dllMain: 0x00601000 },
    { loadAddr: 0x00700000, dllMain: 0x00701000 },
  ], (_exports, loadAddr, dllMain, _log, options) => {
    detachCalls.push({ loadAddr, dllMain, reason: options.reason });
  });
  // Notification snapshots now read live generation/attachment metadata,
  // rather than the legacy entry-point fallback. Seed that actual ABI through
  // its exported base/stride; keep an ordinary mapping reference on each row.
  const view = new DataView(memory.buffer);
  const life = e.get_dll_lifecycle_table(), stride = e.get_dll_lifecycle_stride();
  for (let i = 0; i < e.get_dll_count(); i++) {
    const row = life + i * stride;
    for (const [field, value] of [[0, 2], [4, i + 1], [8, 1],
      [24, 0x00601000 + i * 0x100000], [28, i + 1], [48, 1]])
      view.setUint32(row + field, value, true);
  }
  const thread = { instance };
  assert.equal(manager._dllWantsThreadNotifications(e, dll), false,
    'manager queries the actual disabled WAT row');
  manager._notifyThreadDetach(thread);
  manager._notifyThreadDetach(thread);
  assert.deepStrictEqual(detachCalls, [
    { loadAddr: 0x00700000, dllMain: 0x00701000, reason: 3 },
  ], 'detach runs once, in reverse load order, and skips disabled DLLs');

  assert.equal(view.getUint32(life + 12, true), 0);
  assert.equal(view.getUint32(life + stride + 12, true), 0,
    'completed notification releases its actual generation pin');
  // Reseeding changes shared flags, so the same manager must see both rows
  // again, in reverse order, rather than caching the earlier disabled state.
  e.test_seed_dll_thread_flags();
  manager._notifyThreadDetach({ instance });
  assert.deepEqual(detachCalls.slice(1), [
    { loadAddr: 0x00700000, dllMain: 0x00701000, reason: 3 },
    { loadAddr: 0x00600000, dllMain: 0x00601000, reason: 3 },
  ], 'live shared flags and reverse notification ordering are observed');

  const threadManagerSource = fs.readFileSync(
    path.join(ROOT, 'lib', 'thread-manager.js'), 'utf8');
  const guestWorkerSource = fs.readFileSync(
    path.join(ROOT, 'lib', 'guest-worker.js'), 'utf8');
  assert(threadManagerSource.includes('loadedDlls: this._loadedDlls.map'),
    'real Worker creation receives the loaded DLL entry-point list');
  assert(guestWorkerSource.includes('}, 2, guestThreadDlls)'),
    'real Workers deliver DLL_THREAD_ATTACH with dynamic-load context');
  assert(guestWorkerSource.includes('await L.notifyDllThreadAsync('),
    'real Workers use the shared loader notification driver (runtime skip coverage in test-worker-bootstrap-retirement)');
  assert(guestWorkerSource.includes('notifyGuestThreadDetach(ex)'),
    'real Workers deliver DLL_THREAD_DETACH before natural teardown');

  console.log('PASS  DisableThreadLibraryCalls controls cooperative and browser Worker notifications');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
