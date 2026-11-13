#!/usr/bin/env node
'use strict';

// NFS creates its UI on a cooperative guest thread: the shared window exists,
// but slot 0's thread-local main_hwnd stays zero throughout its lifetime.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { createCliInputSnapshot } = require('../lib/cli-input-owner');
const { createGuardedInput } = require('../lib/cli-guarded-input');
const extraWat = `
  (func (export "owner_quit") (param $q i32) (global.set $quit_flag (local.get $q)))
  (func (export "owner_create") (param $h i32)
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x90000000)))
    (call $main_hwnd_adopt (local.get $h)))
  (func (export "owner_destroy") (param $h i32)
    (call $destroy_main_window_lifecycle (local.get $h))
    (call $wnd_table_remove (local.get $h)))
`;
(async () => {
  const main = await bootRenderHarness({ extraWat, fonts: 'none' });
  const ui = await bootRenderHarness({ prebuiltModule: main.module, memory: main.memory, fonts: 'none' });
  main.exports.set_current_thread_id(1); main.exports.set_eip(0x402000);
  ui.exports.set_current_thread_id(2); ui.exports.set_eip(0x403000);
  const hwnd = 0x18001;
  ui.exports.owner_create(hwnd);
  main.renderer.createWindow(hwnd, 0x90000000, 0, 0, 640, 480, 'Guest UI', 0);
  main.renderer.showWindow(hwnd, 5);
  const thread = { instance: ui.instance, tid: 1, state: 'active' };
  const manager = { threads: new Map([[0xe1001, thread]]) };
  const snapshot = createCliInputSnapshot({ instance: main.instance, memory: main.memory,
    renderer: main.renderer, getDevice: () => null, getThreadManager: () => manager });
  const guard = createGuardedInput({ snapshot, cleanup: () => {} });
  assert.strictEqual(main.exports.get_main_hwnd(), 0);
  assert.strictEqual(ui.exports.get_main_hwnd(), hwnd);
  assert.strictEqual(main.exports.get_window_thread(hwnd), 2);
  assert.strictEqual(main.exports.get_dx_present_hwnd(), hwnd);
  const owner = guard.bind(); // Regression: old snapshot refuses here.
  const ticket = n => guard.prepare({ ...owner, nonce: n, reviewed: true, deadline: Date.now()+1000 }, { action: 'keydown', code: 38 });
  let effects = 0;
  const first = ticket('live-owner');
  guard.consume(first, () => effects++);
  assert.strictEqual(effects, 1);
  const dying = ticket('destroyed-owner');
  ui.exports.owner_destroy(hwnd);
  guard.consume(dying, () => effects++);
  assert.strictEqual(effects, 1, 'shared record removal refuses queued delivery even if renderer is stale');
  assert.strictEqual(guard.status('destroyed-owner').state, 'CANCELLED');
  assert.throws(() => guard.bind(), /unavailable/);
  ui.exports.owner_create(hwnd);
  const rebound = guard.bind();
  const replaced = guard.prepare({ ...rebound, nonce: 'replaced-actor', reviewed: true,
    deadline: Date.now()+1000 }, { action: 'keydown', code: 38 });
  manager.threads.set(0xe1001, { ...thread });
  guard.consume(replaced, () => effects++);
  assert.strictEqual(effects, 1, 'replacing the registered actor invalidates binding');
  manager.threads.get(0xe1001).state = 'exited';
  assert.throws(() => guard.bind(), /unavailable/);
  manager.threads.get(0xe1001).state = 'active';
  manager.threads.set(0xe1002, { ...thread });
  assert.throws(() => guard.bind(), /unavailable/, 'ambiguous registered actor refuses binding');
  manager.threads.delete(0xe1002);
  ui.exports.owner_quit(2);
  assert.throws(() => guard.bind(), /unavailable/, 'owner quit refuses binding');
  ui.exports.owner_quit(0);
  ui.exports.set_eip(0);
  assert.throws(() => guard.bind(), /unavailable/, 'owner with no live EIP refuses binding');
  ui.exports.set_eip(0x403000);
  // Replacing the renderer window remains an independent guard failure.
  const final = guard.bind();
  const stale = guard.prepare({ ...final, nonce: 'replaced-window', reviewed: true,
    deadline: Date.now()+1000 }, { action: 'keydown', code: 38 });
  main.renderer.windows[hwnd] = { ...main.renderer.windows[hwnd] };
  guard.consume(stale, () => effects++);
  assert.strictEqual(effects, 1);
  guard.close();
  assert.strictEqual(main.exports.get_main_hwnd(), 0, 'host binding never adopts a foreign main HWND');
  main.exports.owner_create(0x10001);
  main.renderer.createWindow(0x10001, 0x90000000, 0, 0, 640, 480, 'Main UI', 0);
  main.renderer.showWindow(0x10001, 5);
  const mainBinding = guard.bind();
  assert.strictEqual(snapshot().refs.actorInstance, main.instance, 'ordinary slot 0 owner stays exact');
  assert(mainBinding.owner);
  guard.close();
  console.log('PASS real shared-WASM UI owner, destroy/recreate, actor and window replacement refusal');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
