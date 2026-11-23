#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');

const extraWat = `
  (func (export "test_cursor") (param $out i32) (result i32)
    (call $handle_GetCursorPos (local.get $out) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_last_x") (result i32) (global.get $last_msg_pos_x))
  (func (export "test_last_y") (result i32) (global.get $last_msg_pos_y))
`;
const bytes = compileSrcWasm((name, source) =>
  name === '13-exports.wat' ? source + extraWat : source);
if (process.env.GETCURSORPOS_SAVE_MODULE) {
  const fd = fs.openSync(process.env.GETCURSORPOS_SAVE_MODULE, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
console.log('module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
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

// Literal host words and expected POINT LONGs: neither oracle derives the
// signed answer by decoding the word or by mirroring the handler operations.
const cases = [
  [0x00000000, 0, 0], [0x00010001, 1, 1],
  [0x01e00280, 640, 480], [0x7fff7fff, 32767, 32767],
  [0x0000ffff, -1, 0], [0xffff0000, 0, -1],
  [0xffffffff, -1, -1], [0x002affef, -17, 42],
  [0xffd60011, 17, -42], [0x80008000, -32768, -32768],
  [0x7fff8000, -32768, 32767], [0x80007fff, 32767, -32768],
  [0x00008000, -32768, 0], [0x80000000, 0, -32768],
  [0xfffefffd, -3, -2], [0x80017ffe, 32766, -32767],
];
const out = 0x405000, failures = [];
for (const [packed, x, y] of cases) {
  renderer._setMousePoint(x, y);
  assert.equal(renderer.getMousePosition() >>> 0, packed, 'renderer signed host contract');
  assert.equal(imports.host.get_mouse_position() >>> 0, packed, 'production host preserves word');
  e.guest_write32(out - 4, 0x12345678);
  e.guest_write32(out, 0x55555555);
  e.guest_write32(out + 4, 0x55555555);
  e.guest_write32(out + 8, 0x76543210);
  const lastBefore = [e.test_last_x(), e.test_last_y()];
  e.set_esp(0x7401000);
  assert.equal(e.test_cursor(out), 1, 'BOOL success');
  assert.equal(e.get_esp(), 0x7401008, 'stdcall pops return address and pointer');
  assert.equal(e.guest_read32(out - 4), 0x12345678, 'leading guard');
  assert.equal(e.guest_read32(out + 8), 0x76543210, 'trailing guard');
  const actual = [e.guest_read32(out) | 0, e.guest_read32(out + 4) | 0];
  const last = [e.test_last_x(), e.test_last_y()];
  console.log(JSON.stringify({ packed: packed.toString(16), expected: [x, y], actual, last }));
  try {
    assert.deepEqual(actual, [x, y], 'POINT stores signed screen coordinates');
    assert.deepEqual(last, lastBefore, 'cursor query preserves last dequeued message position');
  } catch (error) { failures.push(error.message); }
}
assert.equal(failures.length, 0, failures.join('\n'));
console.log('PASS GetCursorPos signed coordinates: ' + cases.length + ' literal cases');
