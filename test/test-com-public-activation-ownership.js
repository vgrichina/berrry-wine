#!/usr/bin/env node
'use strict';
// Public storage activation + compiled production COM/ownership/sync bodies.
// CPU execution, allocation and address translation are explicit fixture
// boundaries. No native x86, full VM, browser or spill reclamation claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseSource } = require('../tools/watx');
const { compileClosure } = require('../tools/watx-closure');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const storageSource = read('lib/storage.js');
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
const observed = [...globals, 'invocation_epoch', 'invocation_root',
  'invocation_slot', 'invocation_tid', 'invocation_depth'];
const ownership = cache.slice(cache.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP'),
  cache.indexOf(';; END CALLBACK INVOCATION OWNERSHIP'));
assert(ownership.includes('(func $invocation_validate'));
// Same small compiled closure convention as test-com-token-real-boundaries.
// The entire ownership block and selected production bodies are unmodified.
const compiled = compileClosure({ source: `
  (import "host" "memory" (memory 1 1 shared))
  (import "host" "process" (func $host_beep_process_begin (param i32 i32) (result i32)))
  (import "host" "thread" (func $host_beep_thread_begin (param i32 i32 i32 i32 i32) (result i32)))
  (region.declare-fixed $CALLBACK_OWNERSHIP (base 0) (size 0x2110) (align 16))
  ${globals.map(g => `(global $${g} (mut i32) (i32.const 0))`).join('\n')}
  (func $dbg_recompute)
  ${ownership}
  ${functions(cache, ['$sync_depth_enter', '$sync_depth_leave'])}
  ${functions(wrappers, ['$com_callback_enter', '$com_callback_check', '$com_callback_leave',
    '$com_callback_get_ip', '$com_callback_set_ip', '$com_callback_get_thunk', '$com_callback_set_thunk'])}
  (export "process" (func $invocation_process_begin))
  (export "current" (func $invocation_current))
  ${observed.map(g => `(export "${g}" (global $${g}))`).join('\n')}
`, vfs: new Map() }, { tailCalls: true });
assert(compiled.success, compiled.error);
const mod = new WebAssembly.Module(compiled.wasmBinary);
const A = { clsid: 0x4000, iid: 0x4020, factory: 0x4100, vtable: 0x4120,
  out: 0x4200, seh: 0x4300, dllTable: 0x4400, paths: 0x4500,
  temp: 0x4600, dll: 0x5000, getClass: 0x5400, create: 0x6000 };

function fixture(route, source = storageSource) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const view = new DataView(memory.buffer);
  // Seed only the private fixture serial before real process initialization:
  // all subsequently issued identities must retain their upper 32 bits.
  view.setBigUint64(0, 0x200000000n, true);
  const x = new WebAssembly.Instance(mod, { host: { memory,
    process: () => 0, thread: () => 0 } }).exports;
  x.current_thread_id.value = 1; x.process();
  x.ip.value = 0x7004; x.current_thunk_eip.value = 0x777;
  x.spill_active.value = 1; x.spill_base.value = 0x7000; x.spill_end.value = 0x8000;
  const regs = Object.fromEntries(['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
    .map((r, i) => [r, r === 'esp' ? 0xf000 : 100 + i]));
  const cpu = { eip: 0x777, handler: 1, steps: 17, reason: 7, flag: 1 };
  const put = (p, v) => view.setUint32(p, v, true);
  const get = p => view.getUint32(p, true);
  const str = (p, s) => new Uint8Array(memory.buffer).set(Buffer.from(s + '\0'), p);
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: name => {
    if (name === './region-map.generated') return { GUEST_BASE: 0, BASE: { DLL_PATH_TABLE: A.paths } };
    if (name === './mem-utils') return { g2w: n => n, readStrA: (mem, p) => {
      const b = new Uint8Array(mem); let s = '';
      while (b[p]) s += String.fromCharCode(b[p++]);
      return s;
    }};
    throw Error('unexpected import ' + name);
  } }, { filename: 'lib/storage.js' });
  let hook, allocations = 0;
  const rows = [], acquired = [], left = [];
  const exports = {
    get_image_base: () => 0, get_fs_base: () => A.seh,
    get_eip: () => cpu.eip, set_eip: v => { cpu.eip = v; },
    get_handler_set_eip: () => cpu.handler, set_handler_set_eip: v => { cpu.handler = v; },
    get_steps: () => cpu.steps, set_steps: v => { cpu.steps = v; },
    get_yield_reason: () => cpu.reason, get_yield_flag: () => cpu.flag,
    set_yield_state: (reason, flag) => { cpu.reason = reason; cpu.flag = flag; },
    // Observers forward unchanged arguments to real compiled exports.
    com_callback_enter: () => { const t = x.com_callback_enter(); acquired.push(t); return t; },
    com_callback_check: t => x.com_callback_check(t),
    com_callback_leave: t => { x.com_callback_leave(t); left.push(t); },
    com_callback_get_ip: x.com_callback_get_ip, com_callback_set_ip: x.com_callback_set_ip,
    com_callback_get_thunk: x.com_callback_get_thunk, com_callback_set_thunk: x.com_callback_set_thunk,
    get_dll_count: () => 1, get_dll_table: () => A.dllTable,
    guest_alloc: size => {
      assert.equal(size, 32);
      assert.equal(x.invocation_depth.value, 1, 'allocation inside acquired activation');
      assert.equal(x.current(), acquired.at(-1));
      allocations++;
      return A.temp;
    },
    run: blocks => {
      assert.equal(blocks, 500000);
      const token = x.current(), depth = x.invocation_depth.value;
      assert.equal(token, acquired.at(-1), 'runner receives acquired child');
      assert(token > 0xffffffffn);
      assert.equal(x.sync_msg_depth.value, depth);
      assert.equal(x.spill_pins.value, (1 << depth) - 1, 'suspended stream pinned');
      const method = cpu.eip;
      const argc = method === A.getClass ? 3 : 4;
      rows.push({ token, depth, method, args: Array.from({ length: argc + 1 },
        (_, i) => get(regs.esp + 4 * i)) });
      hook(rows.at(-1));
    },
  };
  for (const r of Object.keys(regs)) {
    exports['get_' + r] = () => regs[r];
    exports['set_' + r] = v => { regs[r] = v; };
  }
  const ctx = { exports, getMemory: () => memory.buffer };
  const storage = module.exports.createStorageImports(ctx);
  put(A.seh, 0xabcdef); put(A.factory, A.vtable); put(A.vtable + 12, A.create);
  if (route === 'registered') {
    // No lifetime callback in this activation-only fixture: its vtable slot is
    // absent. Registration still uses the real public registration entry.
    storage.com_register_class_object(A.clsid, A.factory, 1, 0);
    assert.equal(acquired.length, 0);
  } else {
    module.exports.setRegValue('HKCR\\CLSID\\{00000000-0000-0000-0000-000000000000}\\InprocServer32',
      '', 1, 'activation.dll');
    put(A.dllTable, A.dll); put(A.dllTable + 8, 0x100);
    put(A.dll + 0x10c, 0x200); str(A.dll + 0x200, 'activation.dll');
    put(A.dll + 0x118, 1); put(A.dll + 0x120, 0x300);
    put(A.dll + 0x124, 0x320); put(A.dll + 0x11c, 0x340);
    put(A.dll + 0x300, 0x360); view.setUint16(A.dll + 0x320, 0, true);
    put(A.dll + 0x340, 0x400); str(A.dll + 0x360, 'DllGetClassObject');
  }
  const activate = () => storage.com_create_instance(A.clsid, 0x456,
    route === 'class-only' ? 0x80000001 : 1, A.iid, A.out);
  const state = () => ({ regs: { ...regs }, cpu: { ...cpu }, seh: get(A.seh),
    globals: Object.fromEntries(observed.map(g => [g, x[g].value])) });
  const snapshot = () => ({ state: state(), memory: Buffer.from(new Uint8Array(memory.buffer)) });
  const complete = (row, hr = 0) => {
    assert.equal(row.args[0], 0, 'return sentinel');
    if (row.method === A.getClass) {
      assert.deepEqual(row.args, [0, A.clsid, route === 'class-only' ? A.iid : A.temp, A.temp + 16]);
      if (route !== 'class-only') assert.deepEqual(
        [...new Uint8Array(memory.buffer, A.temp, 16)],
        [1, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46]);
      put(A.temp + 16, A.factory);
    } else {
      assert.equal(row.method, A.create);
      assert.deepEqual(row.args, [0, A.factory, 0x456, A.iid, A.out]);
      put(A.out, 0x123456);
    }
    // Scripted CPU return only; ownership is never simulated here.
    for (const r of Object.keys(regs)) regs[r] = 900;
    regs.eax = hr; cpu.eip = 0; cpu.handler = 8; cpu.steps = 9;
    cpu.reason = 0; cpu.flag = 0; put(A.seh, 0xdead);
    x.ip.value = 0x7100; x.current_thunk_eip.value = 0x888;
  };
  return { x, regs, cpu, exports, ctx, put, get, activate, state, snapshot,
    complete, rows, acquired, left, allocations: () => allocations, hook: f => { hook = f; } };
}

function restored(f, before) {
  // Real leave deliberately marks spill_desk_forced; serial/retired stack
  // entries also remain in memory. Do not mistake those for cleanup failures.
  before.globals.spill_desk_forced = 1;
  assert.deepEqual(f.state(), before, 'completed activation restores parent state');
  assert.equal(f.x.current(), before.globals.invocation_root, 'root is current after completion');
  assert.deepEqual(f.left, f.acquired, 'every completed child left exactly once');
}
function success(source, route = 'dll', hr = 0) {
  const f = fixture(route, source), before = f.state();
  f.hook(row => f.complete(row, row.method === A.create ? hr : 0));
  let result;
  assert.doesNotThrow(() => { result = f.activate(); }, 'public activation must complete');
  assert.equal(result, hr);
  assert.equal(f.get(A.out), route === 'class-only' ? A.factory : 0x123456);
  assert.deepEqual(f.rows.map(r => r.method), route === 'registered' ? [A.create]
    : route === 'class-only' ? [A.getClass] : [A.getClass, A.create]);
  assert.equal(new Set(f.acquired).size, f.acquired.length, 'sequential activation children distinct');
  assert.equal(f.allocations(), route === 'registered' ? 0 : 1);
  restored(f, before);
}
function abort(source, route, stage, mode) {
  const f = fixture(route, source);
  const error = new Error('scripted guest trap');
  let stopped, targetToken, slices = 0;
  f.hook(row => {
    if (row.method !== stage) return f.complete(row);
    slices++;
    targetToken ??= row.token;
    assert.equal(row.token, targetToken, 'bounded slices retain one child');
    f.regs.ebx = 765; f.put(A.out, 0x999); // publication is not completion
    if (mode === 'throw-zero') f.cpu.eip = 0;
    if (mode === 'yield') f.cpu.reason = 1;
    if (mode === 'exit-zero') { f.cpu.eip = 0; f.cpu.reason = 2; }
    if (mode === 'sibling') {
      f.x.com_callback_leave(row.token);
      const sibling = f.x.com_callback_enter();
      assert.notEqual(sibling, row.token);
      f.cpu.eip = 0;
    }
    stopped = f.snapshot();
    if (mode.startsWith('throw')) throw error;
  });
  let caught;
  try { f.activate(); } catch (e) { caught = e; }
  assert(caught, 'aborted public activation must throw');
  if (mode.startsWith('throw')) assert.equal(caught, error, 'original exception propagates');
  else if (mode === 'sibling') assert(caught instanceof WebAssembly.RuntimeError);
  else assert.match(caught.message, /did not complete/);
  assert.deepEqual(f.snapshot(), stopped, 'abort must not pop, restore or mutate abandoned frame');
  assert.equal(f.x.invocation_depth.value, 1);
  assert.equal(f.x.sync_msg_depth.value, 1);
  assert.equal(f.x.spill_pins.value, 1);
  assert.equal(f.left.length, stage === A.create && route === 'dll' ? 1 : 0);
  assert.equal(slices, mode === 'budget' ? 8 : 1, 'abort cannot resume runner');
  assert.equal(f.rows.at(-1).method, stage, 'failed factory never proceeds to CreateInstance');
}
function nested(source) {
  const f = fixture('registered', source), before = f.state();
  let inner = false;
  f.hook(row => {
    if (!inner) {
      inner = true;
      const parent = f.state();
      assert.equal(f.activate(), 0);
      assert.deepEqual(f.state(), parent, 'nested public activation restores live outer child');
      assert.equal(f.x.current(), row.token);
    }
    f.complete(row);
  });
  assert.equal(f.activate(), 0);
  assert.deepEqual(f.rows.map(r => r.depth), [1, 2]);
  assert.notEqual(f.acquired[0], f.acquired[1]);
  assert.deepEqual(f.left, [...f.acquired].reverse());
  before.globals.spill_desk_forced = 1;
  assert.deepEqual(f.state(), before);
}
let cases = 0;
for (const route of ['registered', 'dll', 'class-only']) {
  success(storageSource, route); cases++;
}
success(storageSource, 'dll', 0x80004005); cases++;
nested(storageSource); cases++;
{
  const f = fixture('dll'), before = f.state();
  const perMethod = new Map();
  f.hook(row => {
    const prior = perMethod.get(row.method) || [];
    prior.push(row.token); perMethod.set(row.method, prior);
    if (prior.length === 3) f.complete(row);
  });
  assert.equal(f.activate(), 0);
  assert.equal(f.rows.length, 6);
  assert.equal(perMethod.size, 2);
  for (const tokens of perMethod.values()) assert.equal(new Set(tokens).size, 1);
  restored(f, before); cases++;
}
{
  const f = fixture('dll'), before = f.state();
  f.put(A.out, 0x999);
  f.hook(row => f.complete(row, 0x80004005));
  assert.equal(f.activate(), 0x80004005, 'factory HRESULT preserved despite published factory');
  assert.equal(f.get(A.out), 0, 'failed factory clears output');
  assert.deepEqual(f.rows.map(r => r.method), [A.getClass], 'failed factory cannot create instance');
  restored(f, before); cases++;
}
{
  const f = fixture('registered'), error = new Error('nested activation trap');
  let stopped;
  f.hook(row => {
    if (row.depth === 1) f.activate();
    else {
      f.regs.ebx = 765; f.put(A.out, 0x999);
      stopped = f.snapshot();
      throw error;
    }
  });
  assert.throws(f.activate, e => e === error);
  assert.deepEqual(f.snapshot(), stopped, 'neither abandoned activation may restore/pop');
  assert.deepEqual(f.rows.map(r => r.depth), [1, 2]);
  assert.equal(f.x.invocation_depth.value, 2);
  assert.equal(f.x.sync_msg_depth.value, 2);
  assert.equal(f.x.spill_pins.value, 3);
  assert.equal(f.left.length, 0); cases++;
}
for (const [route, stage] of [['registered', A.create], ['dll', A.getClass],
  ['dll', A.create], ['class-only', A.getClass]]) {
  for (const mode of ['throw', 'throw-zero', 'yield', 'exit-zero', 'budget', 'sibling']) {
    abort(storageSource, route, stage, mode); cases++;
  }
}
console.log(`PASS public activation: ${cases} cases, real compiled ownership and wrappers`);

// Mutate loaded JS text only. Each control is syntactically valid and must fail
// its targeted behavioral assertion, not compilation or fixture initialization.
const mutations = [
  ['skip acquisition', 'const token = exports.com_callback_enter();',
    'const token = 0n;', s => success(s)],
  ['truncate retained token', 'exports.com_callback_check(token);',
    'exports.com_callback_check(BigInt.asUintN(32, token));', s => success(s)],
  ['skip checked leave', 'exports.com_callback_leave(token);', '', s => success(s)],
  ['omit register restore', "regs.forEach((reg, i) => exports['set_' + reg](saved[i]));",
    '', s => success(s)],
  ['omit SEH restore', 'if (fsBase) view.setUint32(sehAddress, savedSeh, true);',
    '', s => success(s)],
  ['omit stream restore', 'exports.com_callback_set_ip(savedIp);', '', s => success(s)],
  ['accept abort as completion', "throw new Error('JS COM callback did not complete');",
    '', s => abort(s, 'dll', A.getClass, 'yield')],
  ['pop on exception', 'if (!_runComCallback(exports, check)) {',
    'if (!(() => { try { return _runComCallback(exports, check); } catch (e) { exports.com_callback_leave(token); throw e; } })()) {',
    s => abort(s, 'registered', A.create, 'throw')],
];
for (const [name, from, to, run] of mutations) {
  assert.equal(storageSource.split(from).length, 2, 'unique mutation anchor: ' + name);
  const source = storageSource.replace(from, to);
  new vm.Script(source, { filename: 'mutant-storage.js' });
  assert.throws(() => run(source), assert.AssertionError, 'mutation survived: ' + name);
  console.log('PASS mutation rejected: ' + name);
}
