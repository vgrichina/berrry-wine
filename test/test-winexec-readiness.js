'use strict';
const assert = require('assert/strict');
const path = require('path');
const root = process.env.WINE_REPO || path.resolve(__dirname, '..');
const { bootRenderHarness } = require(path.join(root, 'test/render-helper'));
const { createWinExecReadiness } = require(process.env.WINEXEC_READINESS_HELPER || path.join(root, 'host'));
const extraWat = `
  (func (export "readiness_call") (param $sp i32) (param $cmd i32) (param $show i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $current_thunk_eip (i32.const 0x7501000))
    (global.set $handler_set_eip (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (call $handle_WinExec (local.get $cmd) (local.get $show)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "readiness_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
  (func (export "readiness_notify")
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x7401000))
    (call $handle_GetMessageA (i32.const 0x401000) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
`;
(async () => {
  let now = 0, accepted = [], failure = null, notified = 0, legacyHost = false;
  const readiness = createWinExecReadiness({ now: () => now, timeoutMs: 10000 });
  const h = await bootRenderHarness({ fonts: 'none', extraWat,
    extraHostOverrides: {
      shell_execute(hwnd, op, command, params, dir, show) {
        if (failure !== null) return failure;
        const process = { ready: false, exited: false };
        accepted.push({ process, command, show });
        return readiness.issue(process);
      },
      process_ctl(op, frame, ticket) {
        if (legacyHost) return -1;
        if (op === 11) { notified++; return 1; }
        return readiness.control(op, frame, ticket);
      },
    },
  });
  const e = h.exports, sp = 0x7404000, command = 0x402000;
  e.set_current_thread_id(1);
  const call = (frame = sp) => e.readiness_call(frame, command, 5);
  call();
  assert.equal(e.readiness_esp(), sp, 'old-fail: WinExec must retain its stdcall frame before GetMessage');
  assert.equal(e.get_yield_reason(), 9);
  assert.equal(e.get_eip(), 0x7501000);
  for (let i = 0; i < 5; i++) call();
  assert.equal(accepted.length, 1, 'retry a pending frame never forks again');
  assert.equal(accepted[0].show, 5);
  call(sp + 64);
  assert.equal(accepted.length, 2, 'same command from another invocation is a legitimate second launch');
  accepted[1].process.ready = true;
  call();
  assert.equal(e.readiness_esp(), sp, 'another child readiness cannot release this frame');
  call(sp + 64);
  assert.equal(e.readiness_esp(), sp + 64 + 12);
  assert.equal(e.get_eax(), 33);
  accepted[0].process.ready = true;
  call();
  assert.equal(e.readiness_esp(), sp + 12);
  assert.equal(e.get_eax(), 33);
  call();
  assert.equal(accepted.length, 3, 'same stack and command after return starts a new invocation');
  now = 9999; call(); assert.equal(e.readiness_esp(), sp);
  now = 10000; call(); assert.equal(e.readiness_esp(), sp + 12);
  assert.equal(e.get_eax(), 33, 'timeout is still successful launch');
  call(); accepted.at(-1).process.exited = true; call();
  assert.equal(e.readiness_esp(), sp + 12, 'child exit does not hang startup');
  for (const code of [0, 2, 3, 11, 31]) {
    failure = code; call();
    assert.equal(e.get_eax(), code); assert.equal(e.readiness_esp(), sp + 12);
  }
  failure = null; call();
  const beforeRetire = accepted.length;
  readiness.retire(2); call();
  assert.equal(accepted.length, beforeRetire, 'retiring another thread preserves this invocation');
  readiness.retire(1); call();
  assert.equal(accepted.length, beforeRetire + 1, 'retired stack reuse starts a fresh invocation');
  accepted.at(-1).process.ready = true; call();
  legacyHost = true; failure = 45; call();
  assert.equal(e.get_eax(), 45); assert.equal(e.readiness_esp(), sp + 12, 'unsupported readiness host preserves direct return');
  legacyHost = false;
  e.readiness_notify();
  assert(notified > 0, 'GetMessage signals process startup independently of API logging');
  const early = { ready: true, exited: false };
  assert.equal(readiness.control(10, 123, readiness.issue(early)), 33);
  assert.equal(readiness.control(9, 123, 0), -1, 'completion consumes its frame exactly once');
  assert.equal(readiness.control(10, 123, 45), 45, 'legacy/custom host codes are preserved');
  console.log('PASS actual WinExec handler: delayed/early GetMessage, timeout, exit, unrelated child, repeat legitimate calls, one launch per frame, errors/show/ESP and GetMessage notification');
})().catch(error => { console.error(error); process.exitCode = 1; });
