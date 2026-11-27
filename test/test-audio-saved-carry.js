#!/usr/bin/env node
'use strict';
// Compile actual save/restore, lazy flag helpers, bound audio producers and
// CACA000A arm. Identity guest translation and modeled RET 20 only; no x86 VM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {compileClosure} = require('../tools/watx-closure');
const root = path.resolve(__dirname, '..');
function read(file) {
  if (fs.existsSync(path.join(root, file))) return fs.readFileSync(path.join(root, file), 'utf8');
  assert(process.env.AUDIO_SAVED_CARRY_SOURCE_REF, `missing source ${file}`);
  return cp.execFileSync('git', ['show', `${process.env.AUDIO_SAVED_CARRY_SOURCE_REF}:${file}`],
    {cwd: root, encoding: 'utf8'});
}
function form(text, marker) {
  text = text.replace(/;;[^\n]*/g, '');
  let start = text.indexOf(marker);
  // A helper such as pending_gap must not select pending_gap_at instead.
  while (start >= 0 && marker.startsWith('(func $') &&
      !/[\s)]/.test(text[start + marker.length])) start = text.indexOf(marker, start + 1);
  assert(start >= 0, marker);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return text.slice(start, i + 1);
  }
  throw Error(`unbalanced ${marker}`);
}
let registers = read('src/03-registers.wat');
if (process.env.AUDIO_SAVED_CARRY_BASELINE) registers = cp.execFileSync('git',
  ['show', `${process.env.AUDIO_SAVED_CARRY_BASELINE}:src/03-registers.wat`],
  {cwd: root, encoding: 'utf8'});
const exportsSource = read('src/13-exports.wat');
const dispatch = read('src/09b-dispatch.wat');
const names = ['save_caller_regs', 'restore_caller_regs', 'set_flags_inc',
  'set_flags_dec', 'get_cf', 'get_zf', 'get_sf', 'get_of', 'get_pf'];
const functions = Object.fromEntries(names.map(n => [n, form(registers, `(func $${n}`)]));
const mutations = {
  'drop-save': ['save_caller_regs', '(global.get $saved_cf)', '(i32.const 0)'],
  'drop-restore': ['restore_caller_regs',
    '(global.set $saved_cf        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))', ''],
  'save-size': ['save_caller_regs', '(i32.const 40)', '(i32.const 36)'],
  'restore-size': ['restore_caller_regs', '(i32.const 40)', '(i32.const 36)'],
  'wrong-slot': ['restore_caller_regs', '(i32.const 36)', '(i32.const 32)'],
  'overwrite-shift': ['save_caller_regs', '(i32.const 36)', '(i32.const 32)'],
};
if (process.env.AUDIO_SAVED_CARRY_MUTATION) {
  const [name, from, to] = mutations[process.env.AUDIO_SAVED_CARRY_MUTATION];
  assert.equal(functions[name].split(from).length, 2, 'unique mutation');
  functions[name] = functions[name].replace(from, to);
}
const bodies = Object.values(functions);
const cache = read('src/04-cache.wat'), handlers = read('src/09a-handlers.wat');
const ownership = cache.slice(cache.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP'),
  cache.indexOf(';; END CALLBACK INVOCATION OWNERSHIP'));
bodies.push(handlers.slice(handlers.indexOf(';; BEGIN MM CALLBACK OWNERSHIP'),
  handlers.indexOf(';; END MM CALLBACK OWNERSHIP')));
for (const name of ['fire_audio_callback_bound', 'fire_wave_out_callback_bound',
  'fire_midi_out_callback_bound', 'wave_callback_restore_wait', 'callback_feed_emit']) {
  bodies.push(form(exportsSource, `(func $${name}`));
}
// Invocation/audio admission calls the real gap recorder even when unarmed.
const alu = read('src/05-alu.wat');
for (const name of ['pending_gap', 'pending_gap_at', 'pending_failure', 'dao_fail']) {
  bodies.push(form(alu, `(func $${name}`));
}
// Use the unchanged production arm, including active/wait/yield bookkeeping.
bodies.push(`(func $finish (export "finish") (param $name_rva i32)
  ${form(dispatch, '(if (i32.eq (local.get $name_rva) (i32.const 0xCACA000A))')})`);
const globals = [...new Set([...(`${ownership}\n${bodies.join('\n')}`).matchAll(/\(global\.(?:get|set) \$(\w+)/g)].map(m => m[1]))];
const declared = new Set([...(`${ownership}\n${bodies.join('\n')}`).matchAll(/\(global \$(\w+)/g)].map(m => m[1]));
declared.add('current_thread_id'); // Explicit fixture thread binding below.
const source = `
 (memory 2 2 shared) (export "memory" (memory 0))
 (region.declare-fixed $CALLBACK_OWNERSHIP (base 0x9000) (size 0x2110) (align 16))
 (region.declare-fixed $MM_CALLBACK_CONTEXTS (base 0x10000) (size 0x8000) (align 16))
 (global $current_thread_id (mut i32) (i32.const 1))
 (func $host_beep_process_begin (param i32 i32) (result i32) (i32.const 1))
 (func $host_beep_thread_begin (param i32 i32 i32 i32 i32) (result i32) (i32.const 1))
 (func $host_log_i32 (param i32) (unreachable)) ;; Unarmed diagnostics must not log.
 ${ownership}
 ${globals.filter(g => !declared.has(g)).map(g => `(global $${g} (mut i32) (i32.const ${g === 'reg_base' ? 64 : 0}))`).join('\n')}
 ${globals.map(g => `(export "${g}" (global $${g}))`).join('\n')}
 (export "beginProcess" (func $invocation_process_begin))
 (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
 (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
 ${bodies.join('\n')}
 ${names.map(n => `(export "${n}" (func $${n}))`).join('\n')}`;
const compiled = compileClosure({source, vfs: new Map()}, {tailCalls: false});
assert(compiled.success, compiled.error);
const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const memory = new Uint8Array(e.memory.buffer), dv = new DataView(e.memory.buffer);
const put = (p, v) => dv.setUint32(p, v >>> 0, true), get = p => dv.getUint32(p, true);
const sp = () => get(80);
const initialSP = 32768, guard = 0xa5a5a5a5;
const stateNames = ['eip', 'flag_op', 'flag_a', 'flag_b', 'flag_res', 'flag_sign_shift', 'saved_cf'];
const flags = () => ['get_cf', 'get_zf', 'get_sf', 'get_of', 'get_pf'].map(n => e[n]());
const snapshot = () => ({esp: sp(), regs: [64, 68, 72].map(get),
  state: stateNames.map(n => e[n].value), flags: flags()});
function setup(kind, carry, shift) {
  memory.fill(0xa5);
  for (const g of globals) if (!declared.has(g)) e[g].value = g === 'reg_base' ? 64 : 0;
  memory.fill(0, 0x9000, 0xb110);
  e.beginProcess();
  put(80, initialSP);
  [64, 68, 72, 76, 84, 88, 92].forEach((p, i) => put(p, 0x11223300 + i));
  e.eip.value = 0x401234;
  e.mm_timer_ret_thunk.value = 0x500000;
  e.flag_op.value = 9; e.flag_a.value = carry;
  e[kind](0x7fffffff, 0x80000000);
  e.flag_sign_shift.value = shift;
}
function clobber(carry) {
  e.flag_op.value = 9; e.flag_a.value = carry;
  e.set_flags_inc(5, 6);
  e.flag_sign_shift.value = 7;
  e.eip.value = 0x402345;
  [64, 68, 72].forEach(p => put(p, 0xdeadbeef));
}
let cases = 0;
// Observe the original carry failure before assertions about the new ABI size.
setup('set_flags_inc', 1, 31);
e.save_caller_regs(); clobber(0); e.restore_caller_regs();
assert.equal(e.get_cf(), 1, 'interrupted INC must retain carry after callback');
cases++;
for (const kind of ['set_flags_inc', 'set_flags_dec']) {
  for (const carry of [0, 1]) for (const shift of [7, 15, 31]) {
    setup(kind, carry, shift);
    const before = snapshot(), preserved = [76, 84, 88, 92].map(get);
    e.save_caller_regs();
    assert.equal(sp(), initialSP - 40);
    assert.equal(get(sp() + 36), carry);
    assert.equal(get(sp() - 4), guard, 'lower stack guard');
    assert.equal(get(initialSP), guard, 'upper stack guard');
    // Three nested frames must restore independently, including opposite CF.
    const frames = [];
    for (let depth = 0; depth < 3; depth++) {
      clobber((depth + carry) & 1); e.eip.value += depth;
      frames.push(snapshot()); e.save_caller_regs();
    }
    clobber(1 - carry);
    assert.equal(get(sp() - 4), guard, 'nested lower guard');
    for (const expected of frames.reverse()) {
      e.restore_caller_regs(); assert.deepEqual(snapshot(), expected, 'nested frame');
    }
    e.restore_caller_regs();
    assert.deepEqual(snapshot(), before, 'outer flags/registers/ESP/EIP');
    assert.deepEqual([76, 84, 88, 92].map(get), preserved, 'callee-saved registers untouched');
    assert.equal(get(initialSP), guard);
    cases++;
  }
}
for (const kind of ['set_flags_inc', 'set_flags_dec']) for (const carry of [0, 1]) {
  for (const route of ['midi', 'wave']) for (const yielded of [0, 1]) {
    setup(kind, carry, 31);
    const before = snapshot();
    const waits = ['wait_handle', 'wait_handles_ptr', 'wait_all', 'wait_timeout', 'wait_stack_bytes'];
    waits.forEach((n, i) => { e[n].value = 100 + i; });
    e.yield_reason.value = yielded; e.yield_flag.value = yielded;
    const enter = () => route === 'midi'
      ? e.fire_midi_out_callback_bound(11, 22, 0x403456, 33, 0x3c9)
      : e.fire_wave_out_callback_bound(11, 22, 0x403456, 33);
    assert.equal(enter(), 1);
    assert.equal(sp(), initialSP - 64, '40-byte frame plus six callback words');
    assert.deepEqual(Array.from({length: 6}, (_, i) => get(sp() + i * 4)),
      [0x500000, 11, route === 'midi' ? 0x3c9 : 0x3bd, 33, 22, 0]);
    assert.equal(e.eip.value, 0x403456);
    assert.equal(get(sp() - 4), guard);
    const activeMemory = memory.slice(), activeGlobals = globals.map(g => e[g].value);
    assert.equal(enter(), 0, 'nested async admission remains rejected');
    assert.deepEqual(memory, activeMemory);
    assert.deepEqual(globals.map(g => e[g].value), activeGlobals);
    clobber(1 - carry);
    // Nested synchronous frame inside the async callback.
    const nested = snapshot();
    e.save_caller_regs(); clobber(carry); e.restore_caller_regs();
    assert.deepEqual(snapshot(), nested);
    waits.forEach(n => { e[n].value = 999; });
    put(80, sp() + 24); // model x86 RET 20
    e.finish(0xcaca000a);
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(waits.map(n => e[n].value), [100, 101, 102, 103, 104]);
    assert.equal(e.yield_reason.value, yielded); assert.equal(e.yield_flag.value, yielded);
    assert.equal(e.wave_callback_saved.value, 0); assert.equal(e.mm_timer_in_cb.value, 0);
    assert.equal(get(initialSP), guard);
    cases++;
  }
}
console.log(`PASS audio saved carry: ${cases} compiled cases; nested frames, INC/DEC, MIDI/wave, wait restore, stack guards`);
if (process.argv.includes('--mutations')) {
  for (const mutation of Object.keys(mutations)) {
    const r = cp.spawnSync(process.execPath, [__filename], {
      env: {...process.env, AUDIO_SAVED_CARRY_MUTATION: mutation}, encoding: 'utf8'});
    assert.notEqual(r.status, 0, mutation);
    assert.match(r.stderr, /AssertionError/, `${mutation} must fail an assertion`);
    assert(!r.stderr.includes('Compilation failed'), 'mutation must compile');
    assert(!r.stderr.includes('unique mutation'), 'mutation must reach behavioral checks');
    console.log(`DETECTED ${mutation}`);
  }
}
