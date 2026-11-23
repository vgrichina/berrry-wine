#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');

// Microsoft: GetMessagePos returns the position of the last retrieved message;
// GetCursorPos returns the current screen position. These are distinct states.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmessagepos
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorpos
// Resolve USER32 exports and use the production thunk dispatcher, including its
// argument reads and stdcall cleanup. No test export writes message-position state.
const extraWat = `
  (func (export "public_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "public_module") (param $p i32) (result i32)
    (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "public_resolve") (param $m i32) (param $p i32) (result i32)
    (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "public_call") (param $p i32)
    (call $win32_dispatch (i32.shr_u
      (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
`;
const bytes = compileSrcWasm((name, source) =>
  name === '13-exports.wat' ? source + extraWat : source);
const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
const renderer = new Win98Renderer(createCanvas(64, 64));
const ctx = { getMemory: () => memory.buffer, renderer, onExit: () => {} };
const imports = createHostImports(ctx);
Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
  terminate_thread: () => 0, create_event: () => 0, set_event: () => 0,
  reset_event: () => 0, wait_single: () => 0, wait_multiple: () => 0 });
const e = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports).exports;
ctx.exports = e;
e.init_thread(0, 0x400000, 0x401000, 0x402000, 0x7500000, 0x7510000, 0, 0);
e.heap_init(0x800000);
e.public_init();
e.set_api_log(0);
const stack = 0x7401000, out = 0x405000, msg = 0x406000;
function string(value) {
  const p = e.guest_alloc(value.length + 1);
  for (let i = 0; i <= value.length; i++)
    e.guest_write8(p + i, i < value.length ? value.charCodeAt(i) : 0);
  return p;
}
e.set_esp(stack);
const user32 = e.public_module(string('USER32.DLL'));
assert.ok(user32, 'resolve USER32');
const apis = {};
for (const name of ['PostMessageA', 'GetMessageA', 'GetMessagePos', 'GetCursorPos']) {
  e.set_esp(stack);
  apis[name] = e.public_resolve(user32, string(name));
  assert.ok(apis[name], 'resolve ' + name);
}
function call(name, args = []) {
  e.set_esp(stack);
  e.guest_write32(stack, 0x401000);
  args.forEach((arg, i) => e.guest_write32(stack + 4 + i * 4, arg));
  e.public_call(apis[name]);
  assert.equal(e.get_esp(), stack + 4 + 4 * args.length, name + ' stdcall ESP');
  return e.get_eax() >>> 0;
}

// Literal signed message points and packed DWORDs: the oracle does not decode
// its expected coordinates using the handler's operations.
for (const [packed, x, y] of [[0x002affef, -17, 42], [0x80007fff, 32767, -32768]]) {
  renderer._setMousePoint(123, -456);
  const previous = call('GetMessagePos');
  assert.notEqual(previous, packed, 'next message must change the retained position');
  assert.equal(call('PostMessageA', [0, 0x020a, 0, packed]), 1, 'post WM_MOUSEWHEEL');
  assert.equal(call('GetMessageA', [msg, 0, 0, 0]), 1, 'dequeue message');
  assert.equal(e.guest_read32(msg + 4), 0x020a, 'retrieved WM_MOUSEWHEEL');
  assert.equal(e.guest_read32(msg + 12) >>> 0, packed, 'retrieved lParam');
  assert.deepEqual([e.guest_read32(msg + 20) | 0, e.guest_read32(msg + 24) | 0],
    [x, y], 'MSG.pt retains signed message screen coordinates');
  assert.equal(call('GetMessagePos'), packed, 'dequeue updates message position');

  for (const current of [[123, -456], [-32768, 32767], [0, 0]]) {
    renderer._setMousePoint(...current);
    e.guest_write32(out - 4, 0x12345678);
    e.guest_write32(out, 0x55555555);
    e.guest_write32(out + 4, 0x55555555);
    e.guest_write32(out + 8, 0x76543210);
    assert.equal(call('GetCursorPos', [out]), 1, 'cursor BOOL success');
    assert.deepEqual([e.guest_read32(out) | 0, e.guest_read32(out + 4) | 0],
      current, 'POINT returns signed current screen coordinates');
    assert.equal(e.guest_read32(out - 4), 0x12345678, 'leading POINT guard');
    assert.equal(e.guest_read32(out + 8), 0x76543210, 'trailing POINT guard');
    assert.equal(call('GetMessagePos'), packed, 'cursor query preserves last dequeued position');
  }
}
console.log('PASS cursor/message position: two dequeues update, six cursor queries preserve; signed POINT/MSG.pt, BOOL, guards and stdcall pass');
