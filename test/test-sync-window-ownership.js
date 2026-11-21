#!/usr/bin/env node
'use strict';
// Real x86 wndprocs call imported GetTickCount and RET 16. Host hooks below
// observe nesting and inject separately labeled ownership faults.
const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { pe, BASE } = require('./test-dll-lifecycle-real-pe');
const { BASE: REGION, SIZE } = require('../lib/region-map.generated');
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
async function main() {
  // Reduce only this family's run-slice budget to exercise real multi-slice and
  // timeout paths cheaply; production caps and branch logic remain unchanged.
  const wasm = compileSrcWasm((file, text) => file === '09c3a-dialog-runtime.wat'
    ? text.replace('(call $run (i32.const 1000000))', '(call $run (i32.const 10))')
    : file !== '13-exports.wat' ? text : text + `
    (export "t_token" (func $invocation_current))
    (export "t_enter" (func $invocation_enter))
    (export "t_leave" (func $invocation_leave))
    (export "t_reset" (func $invocation_process_begin))
    (export "t_clear" (func $clear_cache))
    (func (export "t_depth") (result i32) (global.get $invocation_depth))
    (func (export "t_sync") (result i32) (global.get $sync_msg_depth))
    (func (export "t_completed") (result i32) (global.get $wnd_send_completed))
    (func (export "t_bad_depth")
      (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1))))`,
    { tailCalls: !process.argv.includes('--no-tail-calls') });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} } };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  imports.host.log_i32 = () => {};
  let hook = () => {}; imports.host.get_ticks = () => { hook(); return 17; };
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const x = ctx.exports = instance.exports, dv = new DataView(memory.buffer);
  const callback = ret => [0xb9, ...u32(30), 0x49, 0x75, 0xfd, 0xff, 0x15, ...u32(BASE + 0x1900), 0xb8, ...u32(73),
    ...(ret === 0 ? [0xc3] : [0xc2, ret, 0])];
  let sp, root;
  function begin(ret = 16) {
    hook = () => {};
    const b = pe([[0x2000, [0xc3]], [0x2100, callback(ret)], [0x2200, callback(16)]]);
    const raw = r => r - 0x1000 + 0x200;
    b.writeUInt32LE(0x1a00, raw(0x1900)); b.writeUInt32LE(0, raw(0x1904));
    b.write('GetTickCount\0', raw(0x1a02));
    new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b);
    assert.equal(x.load_pe(b.length), BASE + 0x2000);
    // Production thread reset retires abandoned sync depth/spill pins too.
    x.init_thread(0, x.get_image_base(), x.get_code_start(), x.get_code_end(),
      x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
    x.t_clear();
    sp = x.guest_alloc(0x10000) + 0xfff0; x.set_esp(sp); x.set_eip(BASE + 0x2000); x.clear_yield();
    x.wnd_table_set(0x701, BASE + 0x2100); x.wnd_table_set(0x702, BASE + 0x2200);
    root = x.t_token(); return root;
  }
  const send = () => x.send_message(0x701, 0x401, 3, 4);
  begin(); const children = []; let nesting = false;
  hook = () => {
    children.push(x.t_token()); assert.notEqual(x.t_token(), root);
    if (nesting) { assert.equal(x.t_depth(), 2); return; }
    const outer = x.t_token(); nesting = true;
    assert.equal(x.send_message(0x702, 0x402, 5, 6), 73);
    assert.equal(x.t_token(), outer); assert.equal(x.t_depth(), 1); nesting = false;
  };
  for (let i = 0; i < 2; i++) {
    assert.equal(send(), 73); assert.equal(x.t_token(), root);
    assert.equal(x.get_esp() >>> 0, sp); assert.equal(x.get_eip(), BASE + 0x2000);
    assert.equal(x.t_completed(), 1); assert.equal(x.t_sync(), 0);
  }
  assert.equal(new Set(children).size, 4, 'sibling and nested callbacks have distinct identities');
  hook = () => { throw new Error('must not enter missing window'); };
  assert.equal(x.send_message(0x777, 0, 0, 0), 0); assert.equal(x.t_token(), root);
  // USER's legacy cdecl compatibility consumes exactly four unpopped args.
  // Nested sends still get a separate invocation and restore the outer frame.
  begin(0); let cdeclNested = false;
  hook = () => {
    if (cdeclNested) return;
    cdeclNested = true;
    const outer = x.t_token();
    assert.equal(x.send_message(0x702, 0x402, 5, 6), 73);
    assert.equal(x.t_token(), outer);
  };
  assert.equal(send(), 73); assert(cdeclNested);
  assert.equal(x.t_token(), root); assert.equal(x.t_depth(), 0);
  assert.equal(x.t_sync(), 0); assert.equal(x.t_completed(), 1);
  assert.equal(x.get_esp() >>> 0, sp); assert.equal(x.get_eip(), BASE + 0x2000);
  // Partial or excess stdcall cleanup is not cdecl and must still trap,
  // preserving the faulting invocation and its actual ESP for recovery.
  for (const ret of [4, 8, 12, 20]) {
    begin(ret); assert.throws(send, WebAssembly.RuntimeError);
    assert.equal(x.t_depth(), 1); assert.equal(x.t_sync(), 1);
    assert.equal(x.get_esp() >>> 0, sp + ret - 16);
  }
  // Ordinary bounded timeout still reports incomplete and restores its parent.
  begin(); x.guest_write32(BASE + 0x2100, 0xfeeb); x.t_clear();
  send(); assert.equal(x.t_completed(), 0); assert.equal(x.t_token(), root);
  assert.equal(x.t_sync(), 0); assert.equal(x.get_esp() >>> 0, sp);
  // Actual guest trap preserves the abandoned child until explicit reset.
  begin(); x.guest_write32(BASE + 0x2100, 0x0b0f); x.t_clear();
  assert.throws(send, WebAssembly.RuntimeError); assert.equal(x.t_depth(), 1);
  // Controlled host faults during a real guest API: leaked child, same-depth
  // sibling replacement, changed sync depth, retired root, and thrown import.
  for (const fault of ['child', 'sibling', 'depth', 'root', 'throw']) {
    begin(); let faultToken;
    hook = () => {
      if (fault === 'child') faultToken = x.t_enter();
      if (fault === 'sibling') { x.t_leave(x.t_token()); faultToken = x.t_enter(); }
      if (fault === 'depth') x.t_bad_depth();
      if (fault === 'root') x.t_reset();
      if (fault === 'throw') throw new Error('host fault');
    };
    assert.throws(send, fault === 'throw' ? /host fault/ : WebAssembly.RuntimeError);
    if (faultToken !== undefined) assert.equal(x.t_token(), faultToken, 'wrong child is not popped');
    if (fault !== 'root') assert(x.t_sync() > 0, 'no caller-depth restoration on rejection');
  }
  // Allocation failures precede guest frame writes and execution redirection.
  const snapshot = () => ({ esp: x.get_esp(), eip: x.get_eip(), sync: x.t_sync(),
    stack: Buffer.from(new Uint8Array(memory.buffer, x.guest_to_wasm(sp - 32), 32)),
    owners: Buffer.from(new Uint8Array(memory.buffer, REGION.CALLBACK_OWNERSHIP, SIZE.CALLBACK_OWNERSHIP)) });
  begin(); for (let i = 0; i < 63; i++) x.t_enter();
  let before = snapshot(); assert.throws(send, WebAssembly.RuntimeError); assert.deepEqual(snapshot(), before);
  begin(); const seq = dv.getBigUint64(REGION.CALLBACK_OWNERSHIP, true);
  dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, 0xffffffffffffffffn, true);
  before = snapshot(); assert.throws(send, WebAssembly.RuntimeError); assert.deepEqual(snapshot(), before);
  dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, seq, true);
  console.log('synchronous window ownership: real x86 nesting/RET, faults and allocation atomicity PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
