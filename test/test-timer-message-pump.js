#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_get_message") (param $msg i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (global.set $yield_flag (i32.const 0))
    (call $handle_GetMessageA
      (local.get $msg) (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  let now = 0;
  const { exports: e, memory, module } = await bootRenderHarness({
    extraWat,
    extraHostOverrides: { get_ticks: () => now },
  });
  const msg = 0x3000;

  e.test_timer_set(0, 2, 100, 0x402000);
  now = 100;
  assert.strictEqual(e.test_get_message(msg), 1,
    'GetMessage returns one due window timer');
  assert.strictEqual(e.get_yield_flag(), 0,
    'timer delivery stays in the current guest slice so the pump can become empty');

  const bytes = new DataView(memory.buffer);
  const wa = e.get_guest_base() + msg;
  assert.strictEqual(bytes.getUint32(wa + 4, true), 0x0113,
    'the delivered message is WM_TIMER');
  assert.strictEqual(bytes.getUint32(wa + 8, true), 2,
    'WM_TIMER carries the registered timer id');

  await checkPublicThreadTimers(module);
  console.log('PASS  GetMessage timer delivery does not strand a draining pump');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

async function checkPublicThreadTimers(module) {
  const { createHostImports } = require('../lib/host-imports');
  const { BASE } = require('../lib/region-map.generated');
  const apis = require('../src/api_table.json');
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const view = new DataView(memory.buffer);
  const names = ['SetTimer', 'KillTimer', 'PeekMessageA', 'GetMessageA', 'DispatchMessageA'];
  const image = 0x400000, thunk = 0x7500000;
  let now = 0;
  function thread(slot) {
    const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} } };
    const imports = createHostImports(ctx);
    Object.assign(imports.host, { memory, log() {}, log_i32() {}, get_ticks: () => now, check_input: () => 0 });
    const e = ctx.exports = new WebAssembly.Instance(module, imports).exports;
    e.init_thread(slot, image, image, 0x600000, thunk, thunk + names.length * 8, names.length, 0);
    names.forEach((name, i) => view.setUint32(BASE.THUNK_BASE + i * 8 + 4, apis.find(a => a.name === name).id, true));
    const wa = g => e.guest_to_wasm(g), stack = 0x510000 + slot * 0x1000, msg = 0x520000 + slot * 0x1000;
    function call(name, args) {
      [0, ...args].forEach((v, i) => view.setUint32(wa(stack) + i * 4, v, true));
      e.clear_yield(); e.set_esp(stack); e.set_eip(thunk + names.indexOf(name) * 8); e.run(200);
      assert.equal(e.get_eip(), 0, name + ' returned through guest sentinel');
      assert.equal(e.get_esp(), stack + (args.length + 1) * 4, name + ' stdcall stack');
      return e.get_eax() >>> 0;
    }
    return { e, call, msg, wa, set: (id, interval = 100, cb = 0, hwnd = 0) => call('SetTimer', [hwnd, id, interval, cb]),
      kill: (id, hwnd = 0) => call('KillTimer', [hwnd, id]),
      pump(remove = 1, get = false) {
        const ok = call(get ? 'GetMessageA' : 'PeekMessageA', get ? [msg, 0, 0, 0] : [msg, 0, 0x113, 0x113, remove]);
        return ok ? Array.from({ length: 4 }, (_, i) => view.getUint32(wa(msg) + i * 4, true)) : null;
      } };
  }
  const a = thread(0), b = thread(1);
  a.e.heap_init(0x800000);
  function check(label, actual, expected) {
    console.log(JSON.stringify({ label, actual, expected }));
    assert.deepEqual(actual, expected, label);
  }
  // Distinct actual guest instances have separate registers, caches and tids,
  // but share the timer table. All calls enter the public stdcall thunk path.
  const id = 42;
  check('A explicit ID', a.set(id), id);
  check('B same explicit ID', b.set(id, 200), id);
  now = 100;
  check('A retains first timer after B SetTimer', a.pump(), [0, 0x113, id, 0]);
  check('B is not yet due', b.pump(), null);
  now = 200;
  check('B receives its independent timer', b.pump(1, true), [0, 0x113, id, 0]);
  check('B kills own timer', b.kill(id), 1);
  now = 200;
  check('A survives B KillTimer', a.pump(), [0, 0x113, id, 0]);
  a.kill(id);
  now = 300;
  a.set(id);
  check('foreign KillTimer cannot delete A', b.kill(id), 0);
  now = 400;
  check('A timer still pumps after foreign kill', a.pump(), [0, 0x113, id, 0]);
  a.kill(id);
  // Public automatic-ID allocation must not silently replace an explicit ID.
  const initial = a.set(0); a.kill(initial);
  a.set(initial + 1, 70);
  const automatic = a.set(0, 90);
  check('auto ID avoids same-owner explicit collision', automatic === initial + 1, false);
  now += 70;
  check('explicit timer survives auto allocation', a.pump(), [0, 0x113, initial + 1, 0]);
  a.kill(initial + 1); a.kill(automatic);
  // Same-owner replacement restarts the deadline; late notices retain phase.
  now = 1000; a.set(id, 100); now = 1050; a.set(id, 200);
  now = 1249; check('replacement resets deadline', a.pump(), null);
  now = 1300; check('NOREMOVE sees timer', a.pump(0), [0, 0x113, id, 0]);
  check('NOREMOVE does not consume', a.pump(0), [0, 0x113, id, 0]);
  check('GetMessage removes timer', a.pump(1, true), [0, 0x113, id, 0]);
  check('late deadline phase', a.e.next_timer_due_ms(), 150);
  a.kill(id);
  const autoA = a.set(0), autoB = b.set(0);
  assert.ok(autoA); assert.ok(autoB); assert.notEqual(autoA, autoB);
  a.kill(autoA); b.kill(autoB);
  // Window timer identity stays hwnd+id across callers, including ID zero.
  const hwnd = 0x10001;
  a.e.set_hwnd_base(hwnd + 1); a.e.wnd_table_set(hwnd, 0x401000);
  now = 2000; check('window ID zero succeeds', a.set(0, 100, 0, hwnd), 1);
  b.set(0, 200, 0, hwnd);
  now = 2100; check('foreign window update retains one identity', a.pump(), null);
  now = 2200; check('window timer owner receives zero ID', a.pump(), [hwnd, 0x113, 0, 0]);
  check('foreign window KillTimer retains hwnd identity', b.kill(0, hwnd), 1);
  // TIMERPROC is real guest code, dispatched by the public DispatchMessage.
  const cb = 0x402000, out = 0x540000;
  const code = [0xff, 0x05, ...u32(out)];
  for (let i = 0; i < 4; i++) code.push(0x8b, 0x44, 0x24, 4 + i * 4, 0xa3, ...u32(out + 4 + i * 4));
  code.push(0xc2, 0x10, 0);
  new Uint8Array(memory.buffer, a.wa(cb), code.length).set(code);
  now = 3000; a.set(id, 100, cb, hwnd); now = 3100;
  check('callback timer message', a.pump(1, true), [hwnd, 0x113, id, cb]);
  a.call('DispatchMessageA', [a.msg]);
  check('TIMERPROC ran with correct args', Array.from({ length: 5 }, (_, i) => view.getUint32(a.wa(out) + i * 4, true)), [1, hwnd, 0x113, id, 3100]);
  a.kill(id, hwnd);
  // Public NULL-window timers also dispatch TIMERPROC, before the ordinary
  // thread-message no-op. Cover both retrieval APIs and an allocated timer ID.
  let callbacks = 1;
  for (const get of [false, true]) {
    now += 1000;
    const timer = a.set(0, 100, cb);
    assert.ok(timer);
    now += 100;
    if (!get) {
      check('NULL callback PM_NOREMOVE', a.pump(0), [0, 0x113, timer, cb]);
      check('retrieval does not invoke TIMERPROC', view.getUint32(a.wa(out), true), callbacks);
    }
    check('NULL callback timer message', a.pump(1, get), [0, 0x113, timer, cb]);
    a.call('DispatchMessageA', [a.msg]);
    check('NULL TIMERPROC ran with correct args',
      Array.from({ length: 5 }, (_, i) => view.getUint32(a.wa(out) + i * 4, true)),
      [++callbacks, 0, 0x113, timer, now]);
    a.kill(timer);
  }
  // A callback-shaped lParam on an ordinary NULL message is still a no-op,
  // as is WM_TIMER without TIMERPROC. Never route either into a WndProc.
  for (const message of [0, 0x401, 0x113]) {
    [0, message, id, message === 0x113 ? 0 : cb].forEach((v, i) =>
      view.setUint32(a.wa(a.msg) + i * 4, v, true));
    check('ordinary NULL dispatch returns zero', a.call('DispatchMessageA', [a.msg]), 0);
    check('ordinary NULL dispatch does not invoke callback', view.getUint32(a.wa(out), true), callbacks);
  }
  console.log('PASS public USER timers: thread isolation, allocation, windows, callback, phase, message pumping');
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24]; }

}
