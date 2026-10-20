#!/usr/bin/env node
'use strict';
// Compiled production COM wrappers + invocation and sync helpers, not a VM.
// Host audio notifications and debug recomputation are inert fixture imports.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSource } = require('../tools/watx');
const { compileClosure } = require('../tools/watx-closure');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const cache = read('src/04-cache.wat'), wrappers = read('src/13-exports.wat');
const render = n => Array.isArray(n) ? `(${n.slice(1).map(render).join(' ')})` : n;
function functions(source, names) {
  const forms = parseSource(source, 'production.wat')
    .filter(n => n[1] === 'func' && names.includes(n[2]));
  assert.equal(forms.length, names.length);
  return forms.map(render).join('\n');
}
const globals = ['current_thread_id', 'ip', 'current_thunk_eip', 'spill_active',
  'spill_base', 'spill_end', 'spill_pins', 'spill_desk_forced', 'sync_msg_depth'];
const observed = [...globals, 'invocation_epoch', 'invocation_root', 'invocation_slot',
  'invocation_tid', 'invocation_depth'];
const ownership = cache.slice(cache.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP'),
  cache.indexOf(';; END CALLBACK INVOCATION OWNERSHIP'));
assert(ownership.includes('(func $invocation_validate'));
const original = `
  (import "host" "memory" (memory 1 1 shared))
  (import "host" "process" (func $host_beep_process_begin (param i32 i32) (result i32)))
  (import "host" "thread" (func $host_beep_thread_begin (param i32 i32 i32 i32 i32) (result i32)))
  (region.declare-fixed $CALLBACK_OWNERSHIP (base 0) (size 0x2110) (align 16))
  ${globals.map(g => `(global $${g} (mut i32) (i32.const 0))`).join('\n')}
  (func $dbg_recompute)
  ${ownership}
  ${functions(cache, ['$sync_depth_enter', '$sync_depth_leave'])}
  ${functions(wrappers, ['$com_callback_enter', '$com_callback_check', '$com_callback_leave'])}
  (export "process" (func $invocation_process_begin))
  (export "thread" (func $invocation_thread_begin))
  (export "current" (func $invocation_current))
  ${observed.map(g => `(export "${g}" (global $${g}))`).join('\n')}
`;
function compile(source) {
  const c = compileClosure({ source, vfs: new Map() }, { tailCalls: true });
  assert(c.success, c.error);
  return new WebAssembly.Module(c.wasmBinary);
}
function fixture(mod) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const instances = [];
  function instance(tid) {
    const x = new WebAssembly.Instance(mod, { host: { memory,
      process: () => 0, thread: () => 0 } }).exports;
    x.current_thread_id.value = tid;
    // Exercise actual pin bookkeeping, without claiming spill reclamation.
    x.spill_active.value = 1; x.spill_base.value = 4096;
    x.spill_end.value = 8192; x.ip.value = 4100; x.current_thunk_eip.value = 123;
    instances.push(x);
    return x;
  }
  const x = instance(1); x.process();
  const snap = () => ({
    memory: Buffer.from(new Uint8Array(memory.buffer)),
    globals: instances.map(w => Object.fromEntries(observed.map(g => [g, w[g].value]))),
  });
  const reject = (fn, label) => {
    const before = snap();
    assert.throws(fn, WebAssembly.RuntimeError, `${label}: must trap`);
    assert.deepEqual(snap(), before, `${label}: state changed before rejection`);
  };
  return { x, instance, reject };
}
const cases = {
  capacity(mod) {
    const { x, reject } = fixture(mod), root = x.current(), children = [];
    for (let i = 0; i < 63; i++) {
      const token = x.com_callback_enter();
      assert.equal(typeof token, 'bigint');
      assert.equal(x.invocation_depth.value, i + 1);
      assert.equal(x.sync_msg_depth.value, i + 1);
      x.com_callback_check(token);
      children.push(token);
    }
    assert.equal(new Set([root, ...children]).size, 64);
    reject(() => x.com_callback_enter(), '64th child');
    x.com_callback_check(children.at(-1));
    for (const token of children.reverse()) x.com_callback_leave(token);
    assert.equal(x.current(), root);
    assert.equal(x.sync_msg_depth.value, 0);
    assert.equal(x.spill_desk_forced.value, 1);
    // A rejected acquisition must not prevent subsequent valid acquisition.
    const next = x.com_callback_enter(); x.com_callback_leave(next);
    assert.equal(x.current(), root);
  },
  retained(mod) {
    const { x, reject } = fixture(mod);
    const parent = x.com_callback_enter();
    const child = x.com_callback_enter();
    for (const method of ['com_callback_check', 'com_callback_leave'])
      reject(() => x[method](parent), `parent token at child/${method}`);
    x.com_callback_leave(child);
    x.com_callback_check(parent);
    x.com_callback_leave(parent);
    const sibling = x.com_callback_enter();
    assert.notEqual(sibling, parent);
    for (const token of [parent, child, sibling + (1n << 32n)]) {
      for (const method of ['com_callback_check', 'com_callback_leave'])
        reject(() => x[method](token), `retained or high-word token/${method}`);
    }
    x.com_callback_check(sibling); x.com_callback_leave(sibling);
    assert.equal(x.invocation_depth.value, 0);
    assert.equal(x.sync_msg_depth.value, 0);
    assert.equal(x.spill_pins.value, 0);
  },
};
for (const kind of ['epoch', 'slot', 'tid', 'uninitialized']) {
  cases[kind] = mod => {
    const { x, instance, reject } = fixture(mod);
    const stale = kind === 'uninitialized' ? instance(1) : instance(2);
    let expected = 0n;
    if (kind !== 'uninitialized') { stale.thread(1); expected = stale.com_callback_enter(); }
    if (kind === 'epoch') x.process(); // Real shared epoch retirement.
    if (kind === 'slot') {
      const replacement = instance(2); replacement.thread(1); // Real root publication.
      const token = replacement.com_callback_enter();
      replacement.com_callback_check(token); replacement.com_callback_leave(token);
      assert.notEqual(replacement.invocation_root.value, stale.invocation_root.value);
    }
    if (kind === 'tid') stale.current_thread_id.value = 3;
    reject(() => stale.com_callback_enter(), `${kind}/enter`);
    reject(() => stale.com_callback_check(expected), `${kind}/check`);
    reject(() => stale.com_callback_leave(expected), `${kind}/leave`);
    const valid = x.com_callback_enter();
    x.com_callback_check(valid); x.com_callback_leave(valid);
    if (kind === 'tid') {
      stale.current_thread_id.value = 2;
      stale.com_callback_check(expected); stale.com_callback_leave(expected);
    }
  };
}
const mod = compile(original);
for (const [name, run] of Object.entries(cases)) {
  run(mod);
  console.log(`PASS real COM boundary: ${name}`);
}
// Each mutant must compile and instantiate before the specific behavioral
// oracle rejects it. Compile failures do not count as mutation detections.
const mutations = [
  ['capacity off by one', 'capacity',
    '(i32.ge_u (global.get $invocation_depth) (i32.const 63))',
    '(i32.ge_u (global.get $invocation_depth) (i32.const 64))'],
  ['capacity pre-trap pin corruption', 'capacity',
    '(i32.ge_u (global.get $invocation_depth) (i32.const 63)) (then (unreachable))',
    '(i32.ge_u (global.get $invocation_depth) (i32.const 63)) (then (global.set $spill_pins (i32.const 0)) (unreachable))'],
  ['skip epoch validation', 'epoch',
    '(i64.ne (global.get $invocation_epoch)\n          (i64.atomic.load (region.addr $CALLBACK_OWNERSHIP 8)))',
    '(i32.const 0)'],
  ['skip root validation', 'slot',
    '(i64.ne (global.get $invocation_root)\n          (i64.atomic.load (global.get $invocation_slot)))',
    '(i32.const 0)'],
  ['skip tid validation', 'tid',
    '(i32.ne (global.get $current_thread_id) (global.get $invocation_tid))',
    '(i32.const 0)'],
  ['unchecked COM leave', 'retained',
    '(call $com_callback_check (local.get $expected))', ''],
  ['truncate COM comparison', 'retained',
    '(i64.ne (local.get $expected) (call $invocation_current))',
    '(i32.ne (i32.wrap_i64 (local.get $expected)) (i32.wrap_i64 (call $invocation_current)))'],
  ['mutate depth before COM check', 'retained',
    '(call $com_callback_check (local.get $expected))',
    '(global.set $sync_msg_depth (i32.const 0)) (call $com_callback_check (local.get $expected))'],
];
for (const [name, scenario, from, to] of mutations) {
  assert(original.includes(from), `mutation anchor absent: ${name}`);
  // Comparison occurs in both primitive leave and COM check; mutate both to
  // ensure the 64-bit retained-token oracle, not a second guard, catches it.
  const source = original.split(from).join(to), mutant = compile(source);
  fixture(mutant);
  assert.throws(() => cases[scenario](mutant), assert.AssertionError, name);
  console.log(`PASS mutation rejected: ${name}`);
}
console.log(`Real compiled COM boundaries: ${Object.keys(cases).length} groups, ${mutations.length} mutations PASS`);
