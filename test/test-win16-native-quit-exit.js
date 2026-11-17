'use strict';

// Actual x86 far callbacks through USER.SendMessage and KERNEL.DOS3Call.
// The instruction after DOS3Call must remain unexecuted after AH=4Ch.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { createGuestMainOwner } = require('../lib/guest-main-owner');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;

const extraWat = `
  (func (export "quit_fixture_init")
    (global.set $is_win16 (i32.const 1))
    (global.set $WIN16_THUNK_SEL (call $win16_index_to_sel (i32.const 3)))
    (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x110000) (i32.const 65536) (i32.const 1) (i32.const 2))
    (call $win16_seg_set (i32.const 3) (i32.const 0x120000) (i32.const 65536) (i32.const 0) (i32.const 3))
    (global.set $code16 (i32.const 1))
    (call $win16_set_sreg (i32.const 1) (i32.const 15))
    (call $win16_set_sreg (i32.const 2) (i32.const 23))
    (call $win16_set_sreg (i32.const 3) (i32.const 23))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $wnd_table_set (i32.const 0x10001) (i32.const 0x000f0200)))
  (func (export "quit_fixture_thunk") (param $module i32) (param $ordinal i32) (result i32)
    (call $win16_thunk_for (local.get $module) (local.get $ordinal) (i32.const 0)))
  (func (export "quit_fixture_handle") (result i32)
    (call $win16_h16 (i32.const 0x10001)))
  (func (export "quit_fixture_named_module") (param $guest i32) (result i32)
    (call $win16_dynamic_module_id (call $g2w (local.get $guest))))
  (func (export "quit_fixture_child") (param $id i32)
    (global.set $win16_task_module (local.get $id))
    (global.set $win16_task_slot (i32.const 0))
    (i32.store (call $win16_task_start_slot (i32.const 0)) (i32.const 1))
    (i32.store (call $win16_dll_refs_ptr (local.get $id)) (i32.const 1))
    (i32.store (call $win16_dll_image_size_ptr (local.get $id)) (i32.const 123)))
  (func (export "quit_fixture_child_state") (param $id i32) (result i32)
    (i32.or (global.get $win16_task_module)
      (i32.or (i32.load (call $win16_task_start_slot (i32.const 0)))
        (i32.or (i32.load (call $win16_dll_refs_ptr (local.get $id)))
          (i32.or (i32.load (call $win16_dll_image_size_ptr (local.get $id)))
            (i32.load8_u (call $win16_dynamic_module_slot
              (i32.sub (local.get $id) (global.get $WIN16_DYNAMIC_BASE)))))))))
  (func (export "quit_fixture_start")
    (call $win16_enter_wndproc (i32.const 0x000f0100) (i32.const 1)
      (i32.const 273) (i32.const 7) (i32.const 0) (i32.const 15) (i32.const 0x90)))
`;

const word = n => [n & 255, n >>> 8 & 255];
const push = n => [0x68, ...word(n)];
const farCall = thunk => [0x9a, ...word(thunk), 0x1f, 0];
// MOV word ptr SS:[offset],value: observable continuation, independent of AX.
const mark = (offset, value) => [0x36, 0xc7, 0x06, ...word(offset), ...word(value)];
const ret = [0x31, 0xc0, 0x31, 0xd2, 0xca, 10, 0];

async function runCase(module, remote, kind) {
  const exits = [], threadExits = [], markers = [];
  const h = await bootRenderHarness({ fonts: 'none', prebuiltModule: module,
    extraHostOverrides: {
      exit: code => { exits.push(code); },
      exit_thread: code => { threadExits.push(code); },
      log_i32: value => { markers.push(value >>> 0); },
    } });
  let worker;
  try {
    if (remote) {
      h.exports.set_host_shadow(1);
      worker = new GuestThreadHost({ module, memory: h.memory, hostImports: h.host, sigs,
        workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'), clockIntervalMs: 0 });
      await worker.start();
    }
    const owner = createGuestMainOwner(remote ? { worker } : { localExports: h.exports });
    await owner.call('quit_fixture_init');
    const send = await owner.call('quit_fixture_thunk', 2, 111);
    const dos = await owner.call('quit_fixture_thunk', 1, 102);
    const h16 = await owner.call('quit_fixture_handle');
    const write = async (address, bytes) => {
      const offset = await owner.call('guest_to_wasm', address);
      new Uint8Array(h.memory.buffer).set(bytes, offset);
    };
    await write(0x100090, [0xeb, 0xfe]);
    await write(0x100100, [
      ...mark(0x900, 1), ...push(h16), ...push(273), ...push(7), ...push(0), ...push(0),
      ...farCall(send), ...mark(0x904, 1), ...ret,
    ]);
    let child, terminate;
    if (kind === 'child37' || kind === 'terminate') {
      const name = kind === 'child37' ? 'CHILD' : 'TOOLHELP';
      await write(0x110a00, [name.length, ...Buffer.from(name)]);
      const id = await owner.call('quit_fixture_named_module', 0x110a00);
      assert(id > 0);
      if (kind === 'child37') { child = id; await owner.call('quit_fixture_child', id); }
      else terminate = await owner.call('quit_fixture_thunk', id, 77);
    }
    const service = kind === 'continue' ? 0x1900 : (kind === 'exit37' || kind === 'child37') ? 0x4c25 : 0x4c00;
    const action = kind === 'trap'
      ? farCall(await owner.call('quit_fixture_thunk', 1, 0x7fff))
      : kind === 'terminate' ? [...push(0), ...push(0), ...farCall(terminate)]
      : [0xb8, ...word(service), ...farCall(dos)];
    // Termination has no return contract. A resumed exit path reaches zero
    // bytes just like the demonstrated shutdown fault; do not catch it as an
    // exit. The marker also detects a premature yield before the zero block.
    await write(0x100200, [...mark(0x902, 1), ...action, ...mark(0x906, 1),
      ...(kind === 'continue' ? ret : Array(16).fill(0))]);
    await owner.call('quit_fixture_start');
    let error, slice;
    try {
      slice = await owner.run(100);
      if (slice?.trapped) error = new Error(slice.trapped);
    } catch (caught) { error = caught; }
    const state = await owner.read(['get_eip', 'get_esp', 'get_yield_reason']);
    const raw = await owner.call('guest_to_wasm', 0x110900);
    const view = new DataView(h.memory.buffer);
    const continuation = Array.from({ length: 4 }, (_, i) => view.getUint16(raw + i * 2, true));
    const childState = child ? await owner.call('quit_fixture_child_state', child) : null;
    const row = { childState, owner: owner.kind, kind, exits, threadExits, continuation, state,
      error: error ? String(error) : null, markers };
    console.log(JSON.stringify(row));
    assert.deepEqual(continuation.slice(0, 2), [1, 1], 'both real far callbacks entered');
    assert.deepEqual(threadExits, kind === 'child37' ? [37] : [], 'child thread status stays separate from process status');
    if (kind === 'trap') {
      assert(error, 'genuine unsupported API must trap');
      assert.deepEqual(exits, [], 'trap is never a successful process exit');
      assert.deepEqual(continuation.slice(2), [0, 0]);
    } else if (kind === 'continue') {
      assert.ifError(error);
      assert.deepEqual(exits, []);
      assert.deepEqual(continuation, [1, 1, 1, 1], 'ordinary inner/outer returns preserved');
      assert.equal(state.get_eip, 0x100090);
      assert.equal(state.get_esp, 0x110800);
    } else {
      assert.ifError(error);
      assert.deepEqual(exits, kind === 'child37' ? [] : [kind === 'exit37' ? 37 : kind === 'terminate' ? 1 : 0], 'guest process status preserved once');
      if (child) assert.equal(childState, 0, 'child name/module/start slot/refs/image size retired');
      assert.deepEqual(continuation.slice(2), [0, 0], 'terminated callback and sender never resume');
      assert.equal(state.get_eip, 0, 'termination owns final EIP');
      assert.equal(state.get_yield_reason, 2, 'existing terminal lifecycle reason');
    }
    return row;
  } finally {
    await worker?.stop();
  }
}

async function main() {
  const wasmPath = process.env.WIN16_QUIT_FIXTURE_WASM;
  const bytes = wasmPath ? fs.readFileSync(wasmPath)
    : compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extraWat : source);
  if (process.env.WIN16_QUIT_PREPARE) {
    fs.writeFileSync(process.env.WIN16_QUIT_PREPARE, bytes);
    return;
  }
  console.log(JSON.stringify({ moduleSHA256: crypto.createHash('sha256').update(bytes).digest('hex'),
    moduleBytes: bytes.length }));
  const module = await WebAssembly.compile(bytes);
  const kinds = process.env.WIN16_QUIT_CASE ? [process.env.WIN16_QUIT_CASE]
    : ['continue', 'trap', 'exit0', 'exit37', 'child37', 'terminate'];
  const owners = process.env.WIN16_QUIT_OWNER === 'worker' ? [true]
    : process.env.WIN16_QUIT_OWNER === 'local' ? [false] : [false, true];
  for (const remote of owners)
    for (const kind of kinds) await runCase(module, remote, kind);
  console.log('PASS compiled Win16 nested SendMessage DOS3Call lifecycle through local and Worker main owners');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { extraWat };
