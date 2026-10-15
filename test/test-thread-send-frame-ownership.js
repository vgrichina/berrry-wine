#!/usr/bin/env node
'use strict';
// Real guest-worker.js + WorkerLink, with a small stateful Wasm callback fixture.
// This tests JS frame ownership, not x86/WAT SendMessage correctness.
const assert = require('assert');
const path = require('path');
const { compileWat } = require('../lib/compile-wat');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');

async function fixture() {
  const fields = ['eip', 'esp', 'ebp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi',
    'handler_set_eip', 'steps', 'yield_reason', 'yield_flag', 'd3d_render_token', 'depth'];
  const source = fields.map((n, i) => `
    (global $${n} (mut i32) (i32.const ${n === 'depth' ? 0 : i + 100}))
    (func (export "get_${n}") (result i32) (global.get $${n}))
    (func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))`).join('\n') + `
    (memory 1)
    (global $next_wait (mut i32) (i32.const 0))
    (global $sleep_yielded (mut i32) (i32.const 1))
    ;; Same destructive getter body as src/13-exports.wat.
    (func (export "get_sleep_yielded") (result i32)
      (local $v i32)
      (local.set $v (global.get $sleep_yielded))
      (global.set $sleep_yielded (i32.const 0))
      (local.get $v))
    (func (export "set_next_wait") (param $y i32) (global.set $next_wait (local.get $y)))
    (func (export "get_sync_table") (result i32)
      (i32.const ${require('../lib/region-map.generated').BASE.SYNC_TABLE}))
    (func (export "guest_read32") (param $p i32) (result i32) (i32.load (local.get $p)))
    (func (export "has_pending_message") (result i32) (i32.const 1))
    (func (export "resume_message_wait") (result i32)
      (global.set $yield_reason (i32.const 0))
      (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (i32.const 1))
    (func (export "set_yield_state") (param $y i32) (param $f i32)
      (global.set $yield_reason (local.get $y)) (global.set $yield_flag (local.get $f)))
    (global $pump_fault (mut i32) (i32.const 0))
    (func (export "set_pump_fault") (param $v i32) (global.set $pump_fault (local.get $v)))
    (func (export "vlan_pump")
      (global.set $eax (i32.add (global.get $eax) (i32.const 1)))
      (if (global.get $pump_fault) (then unreachable)))
    (func (export "clear_yield") (global.set $yield_reason (i32.const 0)))
    (func (export "thread_send_begin") (param $h i32) (param $m i32) (param $w i32) (param $l i32) (result i32)
      (global.set $depth (i32.add (global.get $depth) (i32.const 1)))
      (global.set $esp (i32.sub (global.get $esp) (i32.const 20)))
      (i32.store (global.get $esp) (i32.const 4096))
      (global.set $yield_reason (local.get $m))
      (global.set $eip (local.get $h)) (i32.const 1))
    (func (export "thread_send_end") (result i32)
      (global.set $depth (i32.sub (global.get $depth) (i32.const 1))) (global.get $eax))
    (func (export "complete_thread_send") (param $r i32)
      (global.set $eax (local.get $r)) (global.set $yield_reason (i32.const 0)))
    (func (export "run") (param $steps i32)
      (if (i32.eq (global.get $yield_reason) (i32.const 99)) (then unreachable))
      (if (i32.eqz (global.get $yield_reason)) (then
        (if (global.get $next_wait)
          (then (global.set $yield_reason (global.get $next_wait)) (global.set $next_wait (i32.const 0)))
          (else (global.set $eip (i32.const 0)))))))
    (func (export "get_send_target_tid") (result i32) (i32.const -2))
    (func (export "get_send_hwnd") (result i32) (i32.const 7))
    (func (export "get_send_msg") (result i32) (i32.const 10))
    (func (export "get_send_wparam") (result i32) (i32.const 0))
    (func (export "get_send_lparam") (result i32) (i32.const 0))`;
  return WebAssembly.compile(await compileWat(async () => source,
    { files: ['frame-fixture.wat'], cacheKey: 'thread-send-frame-fixture' }));
}
const args = (frameToken, msg = 10) => ({ frameToken, hwnd: 42, msg, wparam: 0, lparam: 0 });
async function controls(link) {
  const state = async () => Promise.all(['esp', 'eax', 'eip', 'yield_reason', 'depth']
    .map(n => link.callExport('get_' + n)));
  const before = await state();
  assert((await link.dispatchThreadSend(args(undefined))).ownershipMismatch);
  assert.deepStrictEqual(await state(), before);
  const first = await link.dispatchThreadSend(args(1));
  assert(first.nested);
  const outer = await state();
  const second = await link.dispatchThreadSend(args(2));
  assert(second.nested);
  const inner = await state();
  assert((await link.dispatchThreadSend({ ...args(3), requireMessagePoint: true,
    admission: { frameToken: 1, waitEpoch: first.waitEpoch, yield: 10 } })).deferred);
  assert.deepStrictEqual(await state(), inner, 'stale admission cannot snapshot a different frame');
  assert((await link.resumeThreadSendDispatch(0, 2, second.waitEpoch + 1)).waitPending);
  assert((await link.resumeThreadSendDispatch(0, 2)).waitPending);
  assert.deepStrictEqual(await state(), inner, 'send wait requires the exact epoch');
  for (const token of [undefined, 0, 1, 33]) {
    assert((await link.resumeThreadSendDispatch(88, token)).ownershipMismatch);
    assert((await link.abortThreadSendDispatch(false, token)).ownershipMismatch);
    assert.deepStrictEqual(await state(), inner, 'stale command mutated current frame');
  }
  assert((await link.dispatchThreadSend(args(2))).ownershipMismatch);
  assert.deepStrictEqual(await state(), inner);
  assert.strictEqual((await link.resumeThreadSendDispatch(0, 2, second.waitEpoch)).result, 0);
  await link.acknowledgeThreadSendResume(2, second.waitEpoch);
  assert.deepStrictEqual(await state(), outer, 'nested completion must restore outer');
  assert((await link.abortThreadSendDispatch(true, 2)).ownershipMismatch);
  assert.strictEqual((await link.resumeThreadSendDispatch(71, 1, first.waitEpoch)).result, 71);
  await link.acknowledgeThreadSendResume(1, first.waitEpoch);
  assert.deepStrictEqual(await state(), before);
  assert((await link.resumeThreadSendDispatch(88, 1)).ownershipMismatch);
  assert((await link.abortThreadSendDispatch(true, 1)).ownershipMismatch);
  assert((await link.dispatchThreadSend(args(3, 99))).trapped);
  assert((await link.abortThreadSendDispatch(true, 3)).aborted);
  assert.deepStrictEqual(await state(), before, 'failure cleanup must restore owned frame');
  assert((await link.dispatchThreadSend(args(4, 99))).trapped);
  assert((await link.abortThreadSendDispatch(false, 4)).aborted);
  assert.strictEqual(await link.callExport('get_yield_reason'), 99,
    'failurefix must preserve failed receiver state when restore=false');
  assert.strictEqual(await link.callExport('get_depth'), before[4]);
}
async function driverControls(host, link) {
  // A nested foreign failure arrives while a newer receiver frame is on top.
  // The outer catch must reject without stealing that frame or restoring main.
  let innerToken;
  host.processSendResolver = async () => {
    innerToken = ++link.nextThreadSendFrameToken;
    assert((await link.dispatchThreadSend(args(innerToken))).nested);
    throw new Error('foreign callback failed');
  };
  await assert.rejects(host._dispatchThreadSendToLink(link, args(0), 0, null, {}),
    /foreign callback failed/);
  assert.strictEqual(await link.callExport('get_depth'), 2);
  assert((await link.abortThreadSendDispatch(true, innerToken)).aborted);
  assert((await link.abortThreadSendDispatch(true, innerToken - 1)).aborted);
  assert.strictEqual(link.threadSendDepth, 0);
  const dispatch = link.dispatchThreadSend.bind(link);
  link.dispatchThreadSend = async message => {
    await dispatch(message);
    throw new Error('lost dispatch reply');
  };
  await assert.rejects(host._dispatchThreadSendToLink(link, args(0), 0, null, {}), /lost dispatch reply/);
  assert.strictEqual(await link.callExport('get_depth'), 0, 'lost reply cleanup owns its token');
  link.dispatchThreadSend = dispatch;
  host.processSendResolver = async () => 0;
  assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0), 0, null, {}), 0);
  host.processSendResolver = async () => { throw new Error('ordinary foreign failure'); };
  await assert.rejects(host._dispatchThreadSendToLink(link, args(0), 0, null, {}), /ordinary foreign failure/);
  assert.strictEqual(await link.callExport('get_depth'), 0);
}
async function main() {
  const module = await fixture();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const link = new WorkerLink({ slot: 0, memory, module, sigs: {},
    workerUrl: path.resolve(__dirname, '../lib/guest-worker.js') });
  try {
    await link.start();
    await controls(link);
    link.nextThreadSendFrameToken = 4;
    await driverControls(new GuestThreadHost({}), link);
  } finally { await link.stop(); }
  const local = await WebAssembly.instantiate(module);
  const host = new GuestThreadHost({ localMainExports: () => local.exports });
  await controls(host._localLink);
  host._localLink.nextThreadSendFrameToken = 4;
  await driverControls(host, host._localLink);
  console.log('PASS actual Worker/local frame ownership: stale resume/abort, nesting, zero, trap, foreign failure');
}
module.exports = { fixture, args };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
