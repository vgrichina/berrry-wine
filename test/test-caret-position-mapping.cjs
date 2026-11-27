#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const table = require('../src/api_table.json');

// POINT is two signed LONGs, x then y. These independent literal bytes are
// deliberately not derived from guest output, g2w, or the implementation.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcaretpos
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-point
const points = [
  [0, 0, '0000000000000000'], [1, -1, '01000000ffffffff'],
  [-2147483648, 2147483647, '00000080ffffff7f'],
  [2147483647, -2147483648, 'ffffff7f00000080'],
  [-305419896, 16909060, '88a9cbed04030201'],
  [19088743, -16909060, '67452301fcfcfdfe'],
];
const extraWat = String.raw`
  (func (export "caret_mapping_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "caret_mapping_module") (param $p i32) (result i32)
    (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "caret_mapping_resolve") (param $m i32) (param $p i32) (result i32)
    (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "caret_mapping_id") (param $p i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $p))))
  (func (export "caret_mapping_regs") (result i32) (global.get $reg_base))
  (func (export "caret_mapping_state") (param $p i32)
    (i32.store (local.get $p) (global.get $caret_x))
    (i32.store offset=4 (local.get $p) (global.get $caret_y))
    (i32.store offset=8 (local.get $p) (global.get $caret_visible)))
  (func (export "caret_mapping_call") (param $p i32)
    (call $win32_dispatch
      (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
`;

// Show/Hide nesting and owner semantics:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-hidecaret
async function visibilityExercise(module) {
  const failures = [];
  let checks = 0;
  const equal = (actual, expected, label) => {
    checks++;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
  };
  const names = ['CreateCaret', 'DestroyCaret', 'ShowCaret', 'HideCaret', 'SetCaretPos'];
  async function setup() {
    const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none', width: 80, height: 60 });
    const e = h.exports, view = new DataView(h.memory.buffer);
    const image = 0x400000, thunk = 0x7500000, stack = 0x510000;
    e.init_thread(0, image, image, 0x600000, thunk, thunk + names.length * 8, names.length, 0);
    e.set_api_log(0);
    const wa = p => e.guest_to_wasm(p) >>> 0;
    names.forEach((name, i) => view.setUint32(wa(thunk) + i * 8 + 4, table.find(a => a.name === name).id, true));
    for (const hwnd of [0x10001, 0x10002]) {
      e.wnd_table_set(hwnd, 0x401000);
      h.renderer.windows[hwnd] = { hwnd, visible: true, wasm: h.instance,
        x: 0, y: 0, w: 80, h: 60, clientRect: { x: 0, y: 0 } };
    }
    h.renderer._computeClientRect = () => {};
    // Pin the on phase so visibility assertions never depend on wall time.
    h.renderer._scheduleCaretBlink = () => {};
    h.call = (name, args = []) => {
      [0, ...args].forEach((n, i) => view.setUint32(wa(stack) + i * 4, n >>> 0, true));
      e.clear_yield(); e.set_esp(stack); e.set_eip(thunk + names.indexOf(name) * 8); e.run(100);
      assert.equal(e.get_eip(), 0, name + ' public thunk returned');
      assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall');
      return e.get_eax() >>> 0;
    };
    h.check = (visible, owner, label) => {
      const r = h.renderer, ctx = h.canvas.getContext('2d');
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 80, 60);
      const state = r._caretBlinkState.get(h.instance);
      if (state) state.phase = true;
      r._paintCaretOverlay();
      equal(e.get_caret_visible(), visible ? 1 : 0, label + ' renderer export');
      equal(e.get_caret_hwnd() >>> 0, owner, label + ' owner');
      equal(!!r.caretRect(), visible, label + ' renderer anchor');
      const pixel = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      equal(pixel, visible ? [0, 0, 0] : [255, 255, 255], label + ' actual inverted canvas pixel');
    };
    return h;
  }
  const a = await setup(), b = await setup();
  const owner = 0x10001, other = 0x10002;
  a.check(false, 0, 'fresh');
  equal(a.call('ShowCaret', [0]), 0, 'no caret NULL Show fails');
  equal(a.call('HideCaret', [0]), 0, 'no caret NULL Hide fails');
  a.check(false, 0, 'no caret calls');
  a.call('CreateCaret', [owner, 0, 2, 13]); a.check(false, owner, 'created hidden');
  a.call('ShowCaret', [owner]); a.check(true, owner, 'shown once');
  a.call('HideCaret', [owner]); a.call('HideCaret', [owner]);
  a.call('ShowCaret', [owner]); a.check(false, owner, 'two hides one show');
  a.call('ShowCaret', [0]); a.check(true, owner, 'NULL balances second hide');
  equal(a.call('ShowCaret', [other]), 0, 'foreign Show fails');
  equal(a.call('HideCaret', [other]), 0, 'foreign Hide fails');
  a.check(true, owner, 'foreign calls preserve owner and visibility');
  a.call('HideCaret', [0]); a.check(false, owner, 'NULL hides current owner');
  a.call('ShowCaret', [other]); a.check(false, owner, 'foreign Show cannot repay hide');
  a.call('ShowCaret', [0]); a.check(true, owner, 'NULL restores current owner');
  // Shows while already visible do not prepay future hides.
  a.call('ShowCaret', [owner]); a.call('ShowCaret', [0]);
  a.call('HideCaret', [owner]); a.check(false, owner, 'extra shows no credit');
  a.call('ShowCaret', [owner]); a.check(true, owner, 'one hide balanced');
  for (let i = 0; i < 5; i++) a.call('HideCaret', [i & 1 ? 0 : owner]);
  for (let i = 0; i < 4; i++) { a.call('ShowCaret', [0]); a.check(false, owner, 'depth five repayment ' + i); }
  a.call('CreateCaret', [other, 0, 2, 13]); a.check(false, other, 'replacement resets debt');
  a.call('ShowCaret', [0]); a.check(true, other, 'replacement first show');
  b.check(false, 0, 'independent instance starts hidden');
  b.call('CreateCaret', [owner, 0, 2, 13]); b.call('ShowCaret', [0]);
  b.call('HideCaret', [0]); b.call('HideCaret', [0]);
  a.check(true, other, 'other instance hide leaves first visible');
  a.call('HideCaret', [0]); a.call('HideCaret', [0]);
  a.check(false, other, 'hide debt before destruction');
  a.call('DestroyCaret'); a.check(false, 0, 'destroy clears renderer');
  b.call('ShowCaret', [0]); b.check(false, owner, 'other instance retains hide debt');
  a.call('CreateCaret', [owner, 0, 2, 13]); a.call('ShowCaret', [0]);
  a.check(true, owner, 'destroy create resets debt');
  b.call('ShowCaret', [0]); b.check(true, owner, 'other instance balances independently');
  a.call('DestroyCaret'); b.call('DestroyCaret');
  a.check(false, 0, 'final destroy a'); b.check(false, 0, 'final destroy b');
  console.log(JSON.stringify({ visibilityChecks: checks, failures }));
  assert.equal(failures.length, 0, 'public caret nesting/owner and renderer pixels');
  return checks;
}

async function exercise() {
  const { exports: e, memory, module } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.caret_mapping_init();
  e.set_api_log(0);
  const view = new DataView(memory.buffer), mem = new Uint8Array(memory.buffer);
  const wa = p => e.guest_to_wasm(p) >>> 0, regs = e.caret_mapping_regs() >>> 0;
  const stackArea = e.guest_alloc(256) >>> 0, stack = stackArea + 64;
  const direct = e.guest_alloc(128) >>> 0, state = e.guest_alloc(256) >>> 0;
  const caretState = e.guest_alloc(16) >>> 0;
  const bytes = (p, n) => mem.subarray(wa(p), wa(p) + n);
  const text = s => {
    const p = e.guest_alloc(s.length + 1) >>> 0;
    bytes(p, s.length + 1).set(Buffer.from(s + '\0'));
    return p;
  };
  view.setUint32(regs + 16, stack, true);
  const user32 = e.caret_mapping_module(text('USER32.DLL')) >>> 0;
  assert.ok(user32, 'public USER32 module');
  const entries = new Map();
  for (const [name, nargs] of [['SetCaretPos', 2], ['GetCaretPos', 1]]) {
    const p = text(name), row = table.find(r => r.name === name);
    assert.ok(row, name + ' API registration');
    assert.equal(e.caret_mapping_id(p), row.id, name + ' public hash lookup');
    assert.equal(row.nargs, nargs, name + ' stdcall ABI');
    view.setUint32(regs + 16, stack, true);
    const thunk = e.caret_mapping_resolve(user32, p) >>> 0;
    assert.ok(thunk, name + ' public resolver');
    assert.equal(view.getUint32(wa(thunk) + 4, true), row.id, name + ' thunk ID');
    entries.set(name, thunk);
  }
  // Valid adjacent guest pages, separated by a decoy in physical backing.
  const base = 0x30000000, decoy = 0x28000000, contiguous = 0x31000000;
  for (const p of [base, decoy, base + 4096])
    assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
  assert.equal(e.test_virtual_map_commit(contiguous, 8192) >>> 0, contiguous);
  const backing = [wa(base), wa(decoy), wa(base + 4096)];
  assert.notEqual(backing[2], backing[0] + 4096, 'split pages have separate backing');
  assert.equal(backing[1], backing[0] + 4096, 'decoy catches affine continuation');
  assert.equal(wa(contiguous + 4096), wa(contiguous) + 4096, 'contiguous cross-page control');
  const spans = [[wa(direct), 128], ...backing.map(p => [p, 4096]), [wa(contiguous), 8192]];
  const seed = () => {
    for (const [p, n] of spans) mem.fill(0xA5, p, p + n);
    bytes(state, 256).fill(0x6B);
  };
  const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
  const read = p => Buffer.from(Array.from({ length: 8 }, (_, i) => mem[wa(p + i)]));
  const currentCaret = () => {
    e.caret_mapping_state(wa(caretState));
    return Array.from({ length: 3 }, (_, i) => view.getInt32(wa(caretState) + i * 4, true));
  };
  const otherState = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(),
    e.get_flag_res(), e.get_flag_sign_shift(), e.get_capture_hwnd(),
    e.get_cursor(), e.get_cursor_display_count(), e.get_current_thread_id(),
    e.get_yield_reason(), e.get_yield_flag(), e.get_quit_flag()];
  const failures = [];
  let calls = 0, controlChecks = 0, splitChecks = 0;
  function equal(actual, expected, label, mapping) {
    const describe = b => b.length > 8
      ? { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }
      : b.toString('hex');
    if (Buffer.isBuffer(actual)) actual = describe(actual);
    if (Buffer.isBuffer(expected)) expected = describe(expected);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, mapping, actual, expected });
    if (mapping === 'split') splitChecks++; else controlChecks++;
  }
  function invoke(name, args, label) {
    bytes(stackArea, 256).fill(0xCC);
    for (let i = 0; i < 8; i++) view.setUint32(regs + i * 4, 0x41320000 + i, true);
    view.setUint32(regs + 16, stack, true);
    view.setUint32(wa(stack), 0x12345678, true);
    args.forEach((v, i) => view.setUint32(wa(stack) + 4 + i * 4, v >>> 0, true));
    const savedStack = Buffer.from(bytes(stackArea, 256));
    const savedState = Buffer.from(bytes(state, 256));
    const savedEip = e.get_eip(), savedLastError = e.test_get_last_error();
    const savedHandlerEip = e.get_handler_set_eip(), savedOtherState = otherState();
    e.caret_mapping_call(entries.get(name));
    assert.equal(view.getUint32(regs, true), 1, label + ' BOOL (including existing null compatibility)');
    assert.equal(view.getUint32(regs + 16, true), stack + 4 + 4 * args.length, label + ' stdcall ESP');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, label + ' register ' + i);
    assert.equal(e.get_eip(), savedEip, label + ' EIP');
    assert.equal(e.get_handler_set_eip(), savedHandlerEip, label + ' handler EIP');
    assert.equal(e.test_get_last_error(), savedLastError, label + ' last error');
    assert.deepEqual(otherState(), savedOtherState, label + ' flags/capture/cursor/thread/yield');
    assert.deepEqual(Buffer.from(bytes(stackArea, 256)), savedStack, label + ' stack');
    assert.deepEqual(Buffer.from(bytes(state, 256)), savedState, label + ' unrelated state');
    calls++;
  }
  function query(pointer, want, label, mapping) {
    const before = snapshot(), expected = before.map(b => Buffer.from(b));
    if (pointer) for (let i = 0; i < 8; i++) {
      const p = wa(pointer + i), index = spans.findIndex(([start, n]) => p >= start && p < start + n);
      assert.ok(index >= 0, 'output belongs to guarded span');
      expected[index][p - spans[index][0]] = want[i];
    }
    const caret = currentCaret();
    invoke('GetCaretPos', [pointer], label);
    if (pointer) equal(read(pointer), want, label + ' literal eight bytes', mapping);
    snapshot().forEach((b, i) => equal(b, expected[i], label + ' complete backing/canary ' + i, mapping));
    assert.deepEqual(currentCaret(), caret, label + ' query preserves caret state');
  }
  seed();
  query(direct + 16, Buffer.from(points[0][2], 'hex'), 'initial caret', 'contiguous');
  query(0, null, 'initial null compatibility', 'contiguous');
  for (const [x, y, hex] of points) {
    seed();
    const before = snapshot();
    invoke('SetCaretPos', [x, y], 'set ' + x + ',' + y);
    assert.deepEqual(currentCaret().slice(0, 2), [x, y], 'public setter stores exact signed coordinates');
    snapshot().forEach((b, i) => assert.deepEqual(b, before[i], 'setter preserves all output/backing/decoy canaries'));
    const want = Buffer.from(hex, 'hex');
    for (let repeat = 0; repeat < 2; repeat++) {
      seed();
      query(direct + 32, want, 'direct repeat=' + repeat, 'contiguous');
      for (let split = 1; split <= 7; split++) {
        seed();
        query(contiguous + 4096 - split, want, hex + ' contiguous split=' + split + ' repeat=' + repeat, 'contiguous');
        seed();
        query(base + 4096 - split, want, hex + ' separately backed split=' + split + ' repeat=' + repeat, 'split');
      }
      seed(); query(0, null, hex + ' null compatibility repeat=' + repeat, 'contiguous');
    }
  }
  const visibilityChecks = await visibilityExercise(module);
  const result = { calls, controlChecks, splitChecks, backing, failures, visibilityChecks };
  console.log(JSON.stringify(result));
  return result;
}
if (require.main === module) exercise().then(result => {
  assert.equal(result.failures.length, 0, 'public GetCaretPos literal POINT mapping and canaries');
  console.log('PASS ' + result.calls + ' public caret calls; all seven splits, signed extremes, repeated calls and ABI');
}).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { exercise, points, extraWat };
