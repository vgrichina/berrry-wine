#!/usr/bin/env node
'use strict';

// Calls the real production run(), never a replacement entry or guest handler.
// QueueUserAPC and ReadFileEx supply the two production APC node classes. The
// callback address is the loaded PE's existing entry; a zero-block grant means
// no callback body runs. Additional exports only arrange/observe fixture state.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const { WAT_FILES } = require('../lib/wat-manifest');
const { parse } = require('../tools/protected-writer-entries');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const globals = [];
for (const file of WAT_FILES) for (const form of parse(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'))) {
  if (form.items?.[0].atom === 'global' && form.items[2]?.items?.[0].atom === 'mut') {
    globals.push({ name: form.items[1].atom, type: form.items[2].items[1].atom });
  }
}
const fixture = `
(func (export "fixture_sleep") (param $esp i32) (param $pc i32)
 (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $esp) (i32.const 12)))
 (call $gs32 (i32.sub (local.get $esp) (i32.const 12)) (local.get $pc))
 (call $handle_SleepEx (i32.const 100) (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (global.set $eip (local.get $pc)))
(func (export "fixture_queue") (param $pc i32) (param $data i32)
 (call $handle_QueueUserAPC (local.get $pc) (i32.const -2) (local.get $data) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "fixture_readfile") (param $pc i32) (param $overlapped i32)
 (call $handle_ReadFileEx (i32.const 1) (i32.const 0) (i32.const 0) (local.get $overlapped) (local.get $pc) (i32.const 0)))
(func (export "fixture_animation") (param $hwnd i32) (result i32)
 (call $anim_live_add (local.get $hwnd)))
(func (export "fixture_boot_pc") (result i32) (global.get $WIN16_TASK_ENTRY))
(func (export "fixture_reset")
 (call $apc_drop_shared_current)
 (global.set $io_apc_head (i32.const 0))
 (global.set $io_apc_tail (i32.const 0))
 (global.set $apc_alert_sleep (i32.const 0))
 (global.set $anim_live_count (i32.const 0))
 (global.set $anim_in_service (i32.const 0))
 (global.set $yield_reason (i32.const 0))
 (global.set $yield_flag (i32.const 0)))
(func (export "fixture_seed")
 (global.set $null_transfer_kind (i32.const 19))
 (global.set $null_transfer_thunk_entry (i32.const 23))
 (global.set $block_budget (i32.const 29))
 (global.set $run_budget_start (i32.const 31))
 (global.set $api_handler_depth (i32.const 37))
 (global.set $flag_op (i32.const 0))
 (global.set $flag_a (i32.const 43))
 (global.set $flag_b (i32.const 47))
 (global.set $flag_res (i32.const 53)))
${globals.map((g, i) => `(func (export "fixture_global_${i}") (result ${g.type}) (global.get ${g.name}))`).join('\n')}
`;

async function main() {
  const output = process.env.JEDI_EVIDENCE;
  const wasm = compileSrcWasm((file, text) => file === '13-exports.wat' ? text + fixture : text);
  if (output) {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'run-entry-regression.wasm'), wasm);
  }
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  imports.host.log = () => {};
  imports.host.log_i32 = () => {};
  // EOF is a completed asynchronous read, queued by the real ReadFileEx
  // handler. It needs no filesystem or manufactured guest callback body.
  imports.host.fs_read_file_at = () => 38;
  const e = (await WebAssembly.instantiate(wasm, { host: imports.host })).instance.exports;
  ctx.exports = e;
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  const pc = e.get_eip() >>> 0;
  const area = e.guest_alloc(4096) >>> 0, esp = area + 2048;
  const shield = esp - 8, health = esp - 4, overlapped = area + 3000;
  e.set_current_thread_id(1);
  const globalValue = name => e['fixture_global_' + globals.findIndex(g => g.name === name)]();
  const snap = () => ({
    globals: globals.map((g, i) => [g.name, e['fixture_global_' + i]()]),
    regs: Object.fromEntries(['eax', 'ebx', 'ecx', 'edx', 'ebp', 'esi', 'edi', 'esp', 'eip'].map(n => [n, e['get_' + n]() >>> 0])),
    stack: Array.from({ length: 128 }, (_, i) => e.guest_read8(esp - 64 + i)),
    shield: e.guest_read32(shield) >>> 0, health: e.guest_read32(health) >>> 0,
    memorySHA256: sha(Buffer.from(memory.buffer)),
  });
  const results = [];
  function check(name, arrange, ordinary) {
    e.set_rep_store_step(0);
    e.fixture_reset();
    e.set_esp(esp); e.set_eip(pc);
    arrange();
    // API setup may adjust ESP; the actual pending SleepEx mark owns esp.
    e.set_esp(esp);
    e.guest_write32(shield, 0x42c80000); e.guest_write32(health, 0x42c80000);
    e.fixture_seed();
    e.set_rep_store_step(shield);
    const before = snap();
    assert.throws(() => e.run(0), WebAssembly.RuntimeError, name);
    const after = snap();
    assert.deepEqual(after, before, name + ': reject before all globals, CPU, flags, queue, stack or vital effects');
    assert.throws(() => e.run(100), WebAssembly.RuntimeError, name + ' retry');
    assert.deepEqual(snap(), before, name + ': retry preserves all globals and full memory');
    // The same queued production service is still available after disarming.
    e.set_rep_store_step(0);
    if (ordinary) ordinary();
    results.push({ name, passed: true, memorySHA256: before.memorySHA256 });
    console.log('PASS production run(0) ' + name + ': full pre-effect rejection');
  }
  const sleep = () => e.fixture_sleep(esp, pc);
  const delivered = () => {
    e.run(0);
    assert.equal(e.get_eip() >>> 0, pc);
    assert.equal(globalValue('$apc_alert_sleep'), 0);
    assert.equal(e.guest_read32(health) >>> 0, pc, 'unarmed service pushes real interrupted return PC');
    assert.notEqual(e.get_esp() >>> 0, esp, 'unarmed service retains its ordinary callback frame');
  };
  check('QueueUserAPC shared inbox', () => { sleep(); e.fixture_queue(pc, 0x42a00000); }, () => {
    delivered(); assert.equal(e.get_esp() >>> 0, esp - 12); assert.equal(e.guest_read32(shield) >>> 0, 0x42a00000);
  });
  check('two queued user APCs preserve FIFO links', () => { sleep(); e.fixture_queue(pc, 0x42a00000); e.fixture_queue(pc, 0x42b40000); }, delivered);
  check('ReadFileEx private completion queue', () => { sleep(); e.fixture_readfile(pc, overlapped); }, () => {
    delivered(); assert.equal(e.get_esp() >>> 0, esp - 20);
  });
  check('mixed private IO and shared user APC queues', () => { sleep(); e.fixture_readfile(pc, overlapped); e.fixture_queue(pc, 0x42a00000); }, delivered);
  check('empty alertable sleep (conservative concurrent-producer boundary)', sleep, () => {
    e.run(0); assert.equal(globalValue('$apc_alert_sleep'), 0); assert.equal(e.get_esp() >>> 0, esp);
  });
  check('alertable mark with a different resume PC', () => { sleep(); e.fixture_queue(pc, 0x42a00000); e.set_eip(pc + 1); }, () => {
    e.run(0); assert.equal(globalValue('$apc_alert_sleep'), 1); assert.equal(e.get_esp() >>> 0, esp);
  });
  check('animation service live-list entry', () => {
    assert.equal(e.fixture_animation(0x7ffffffe), 1);
  }, () => {
    // A stale live HWND is a real service class: unarmed anim_service removes
    // it. No fabricated animation decoder or guest handler is involved.
    e.run(0); assert.equal(globalValue('$anim_live_count'), 0);
  });
  check('Win16 task bootstrap service', () => e.set_eip(e.fixture_boot_pc()));
  check('actual original PE import thunk service', () => e.set_eip(e.guest_read32(0x4063e0) >>> 0));
  check('aborted active audio callback cleanup', () => {
    assert.equal(e.fire_wave_out_callback_bound(1, overlapped, pc, 0), 1);
    // An aborted callback is another real run service path: run's halt tail
    // clears the active flags. Refuse before even that cleanup when armed.
    e.set_eip(0);
  }, () => {
    e.run(0);
    assert.equal(globalValue('$wave_callback_saved'), 0);
    assert.equal(globalValue('$mm_timer_in_cb'), 0);
  });
  e.set_rep_store_step(0); e.fixture_reset(); e.set_eip(pc); e.set_esp(esp);
  e.set_rep_store_step(shield);
  const beforeSafe = { esp: e.get_esp(), shield: e.guest_read32(shield), health: e.guest_read32(health) };
  e.run(0);
  assert.deepEqual({ esp: e.get_esp(), shield: e.guest_read32(shield), health: e.guest_read32(health) }, beforeSafe);
  const report = { passed: true, results, mutableGlobals: globals.length, moduleSHA256: sha(wasm), blocksGranted: 0,
    callbackBodyCreated: false, callbackBodyExecuted: false, controllerQualified: false, allWritersQualified: false };
  if (output) fs.writeFileSync(path.join(output, 'run-entry-regression.json'), JSON.stringify(report, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  console.log('PASS safe armed run(0), ordinary unarmed service behavior, ' + globals.length + ' mutable globals and full 512 MiB preserved on rejection');
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
