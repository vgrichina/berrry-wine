#!/usr/bin/env node
'use strict';

// A cooperative cross-thread SendMessage whose receiving WndProc parks on a
// vertical blank (yield 13: WaitForVerticalBlank, or a vsync'd Flip) must be
// continued once the vblank is due -- not abandoned. _dispatchCooperativeSend
// used to `break` on any yield it did not know, restore the receiver's
// interrupted context and drop the rest of the dispatched code. Age of
// Wonders II switches to 1024x768 inside TThread.Synchronize (CM_EXECPROC to
// the main thread); that method waits for a vblank after building the new
// surfaces and only then re-creates its Direct3D device, so the device stayed
// released and the next screen called through NULL (AOW2-CLI-COOP-START).

const assert = require('assert');
const { ThreadManager } = require('../lib/thread-manager');

function machine(yieldReason = 0) {
  const state = { yieldReason, eip: 0x401000, esp: 0x1000, runs: 0, clears: 0 };
  const ex = {
    get_sync_table: () => 0, get_yield_reason: () => state.yieldReason,
    get_d3d_render_token: () => 0, set_d3d_render_token: () => {},
    get_eip: () => state.eip, set_eip: n => { state.eip = n; }, get_esp: () => state.esp,
    set_esp: n => { state.esp = n; }, run: () => { state.runs++; }, get_bp_addr: () => 0,
    get_sleep_yielded: () => 0,
    clear_yield: () => { state.yieldReason = 0; state.clears++; },
    set_yield_state: y => { state.yieldReason = y; }, get_yield_flag: () => !!state.yieldReason,
  };
  for (const name of ['ebp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'handler_set_eip', 'steps']) {
    ex['get_' + name] = () => state[name] || 0; ex['set_' + name] = v => { state[name] = v; };
  }
  return { state, ex };
}

const tm = new ThreadManager({}, new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }),
  { exports: machine().ex }, () => ({ host: {} }), {});
tm._log = () => {};

// The sender (T3) is parked in its SendMessage; the receiver (main) sits in
// WaitMessage (yield 7), a legal delivery point, with its own frame.
const sender = machine(10), target = machine(7);
let begins = 0, ends = 0, returned = null, tail = 0;
sender.ex.get_send_target_tid = () => 1;
for (const n of ['hwnd', 'msg', 'wparam', 'lparam']) sender.ex['get_send_' + n] = () => 1;
sender.ex.complete_thread_send = value => { returned = value; sender.state.yieldReason = 0; };
target.ex.thread_send_begin = () => { begins++; target.state.yieldReason = 0; target.state.eip = 0x500000; return 1; };
// Run 1 and 2: the WndProc parks in WaitForVerticalBlank (vblank not yet due).
// Run 3: the call returns and the rest of the method runs to the end.
target.ex.run = () => {
  target.state.runs++;
  if (target.state.runs <= 2) target.state.yieldReason = 13;
  else { tail++; target.state.yieldReason = 0; target.state.eip = 0; }
};
target.ex.thread_send_end = () => { ends++; return 0x55; };
tm._cooperativeTargetExports = () => target.ex;
tm._sendTargetAtMessagePoint = () => true;

// First round: the dispatch parks on the vblank instead of being abandoned.
assert.strictEqual(tm.resolveCooperativeThreadSend(sender.ex), false, 'send still pending');
assert.strictEqual(begins, 1);
assert.strictEqual(ends, 0, 'the dispatch was not ended (abandoned) at the vblank park');
assert(tm._renderSendTargets.has(target.ex), 'the receiver is held for the parked dispatch');
assert.strictEqual(tail, 0);

// Second round: the vblank is still not due -- the call parks again.
assert.strictEqual(tm.resolveCooperativeThreadSend(sender.ex), false);
assert.strictEqual(target.state.runs, 2);
assert.strictEqual(ends, 0);

// Third round: the parked call is re-entered, returns, and the method finishes.
assert.strictEqual(tm.resolveCooperativeThreadSend(sender.ex), true, 'send completed');
assert.strictEqual(tail, 1, 'the code after the vblank wait ran');
assert.strictEqual(begins, 1, 'thread_send_begin was not replayed');
assert.strictEqual(ends, 1);
assert.strictEqual(returned, 0x55, 'the sender got the WndProc result');
assert.strictEqual(target.state.clears >= 2, true, 'each resume cleared the vblank yield');
assert(!tm._renderSendTargets.has(target.ex));
// The receiver's interrupted frame (WaitMessage, yield 7) is restored.
assert.strictEqual(target.state.yieldReason, 7);
assert.strictEqual(target.state.eip, 0x401000);

console.log('PASS cross-thread SendMessage: a vblank park inside the receiving WndProc is continued, not abandoned');
