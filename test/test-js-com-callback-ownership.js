#!/usr/bin/env node
'use strict';
// Source-only: execute production JS and the actual WAT wrapper/accessor ASTs.
// CPU run, allocator and existing sync/token primitives are modeled boundaries.
// This is NOT full-VM/native x86, allocator-concurrency or spill qualification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseSource } = require('../tools/watx');
const root = path.resolve(__dirname, '..');
const original = fs.readFileSync(process.argv[2] || path.join(root, 'lib/storage.js'), 'utf8');
const wat = fs.readFileSync(path.join(root, 'src/13-exports.wat'), 'utf8');
const names = ['$com_callback_enter', '$com_callback_check', '$com_callback_leave',
  '$com_callback_get_ip', '$com_callback_set_ip', '$com_callback_get_thunk', '$com_callback_set_thunk'];

function fixture(source = original, wrapperSource = wat) {
  const forms = new Map(parseSource(wrapperSource, 'exports.wat')
    .filter(n => names.includes(n[2])).map(n => [n[2], n]));
  assert.equal(forms.size, 7);
  const module = { exports: {} };
  // Identity guest mapping and small symbolic DLL table keep this source fixture
  // independent of a VM's allocated 512MB region map.
  vm.runInNewContext(source, { module, require: name => {
    if (name === './region-map.generated') return { GUEST_BASE: 0, BASE: { DLL_PATH_TABLE: 0x500 } };
    if (name === './mem-utils') return { g2w: n => n, readStrA: (mem, at) => {
      const b = new Uint8Array(mem); let s = '';
      while (b[at]) s += String.fromCharCode(b[at++]);
      return s;
    }};
    throw new Error('unexpected import ' + name);
  }}, { filename: 'storage.js' });
  const memory = new ArrayBuffer(0x10000), dv = new DataView(memory);
  const regs = Object.fromEntries(['eax','ecx','edx','ebx','esp','ebp','esi','edi']
    .map((r, i) => [r, r === 'esp' ? 0xf000 : 100 + i]));
  let eip = 0x777, epoch = 1, slot = 1, tid = 1, next = 0x200000001n;
  const owner = { epoch, slot, tid }, stack = [0x100000001n], seen = [];
  let syncDepth = 0, runs = 0, enters = 0, leaves = 0, enterFailure = false;
  const control = { $ip: 0xa000, $current_thunk_eip: 0x777 };
  const enteredIps = [];
  let hook = () => complete();
  const checkOwner = () => {
    if (epoch !== owner.epoch || slot !== owner.slot || tid !== owner.tid)
      throw new Error('stale owner');
  };
  // Interpret the actual new wrappers; no replacement JS implementation of
  // their expected-token comparison/order is used.
  function call(name, args = []) {
    if (name === '$sync_depth_enter') {
      checkOwner();
      if (enterFailure || stack.length >= 64) throw new Error('capacity');
      enteredIps.push(control.$ip);
      stack.push(next++); syncDepth++; enters++; return;
    }
    if (name === '$invocation_current') { checkOwner(); return stack.at(-1); }
    if (name === '$sync_depth_leave') {
      checkOwner(); assert(stack.length > 1); stack.pop(); syncDepth--; leaves++; return;
    }
    const f = forms.get(name); assert(f, name);
    const locals = {};
    f.filter(n => Array.isArray(n) && n[1] === 'param')
      .forEach((n, i) => { locals[n[2]] = args[i]; });
    const seq = nodes => { let result; for (const n of nodes) result = ev(n); return result; };
    const ev = n => {
      switch (n[1]) {
        case 'export': case 'result': case 'param': return;
        case 'local.get': return locals[n[2]];
        case 'global.get': return control[n[2]];
        case 'global.set': control[n[2]] = ev(n[3]); return;
        case 'call': return call(n[2], n.slice(3).map(ev));
        case 'i64.ne': return ev(n[2]) !== ev(n[3]);
        case 'if': if (ev(n[2])) return seq(n[3].slice(2)); return;
        case 'unreachable': throw new Error('token mismatch');
        default: throw new Error('unmodeled wrapper AST ' + n[1]);
      }
    };
    return seq(f.slice(3));
  }
  const exports = {
    get_image_base: () => 0, get_fs_base: () => 0x600,
    get_eip: () => eip, set_eip: v => { eip = v; },
    get_yield_reason: () => exports.yieldReason || 0,
    yieldReason: 7, yieldFlag: 1, handler: 1, steps: 17,
    get_yield_flag: () => exports.yieldFlag,
    set_yield_state: (reason, flag) => { exports.yieldReason = reason; exports.yieldFlag = flag; },
    get_handler_set_eip: () => exports.handler,
    set_handler_set_eip: n => { exports.handler = n; },
    get_steps: () => exports.steps,
    set_steps: n => { exports.steps = n; },
    com_callback_enter: () => call('$com_callback_enter'),
    com_callback_check: t => call('$com_callback_check', [t]),
    com_callback_leave: t => call('$com_callback_leave', [t]),
    com_callback_get_ip: () => call('$com_callback_get_ip'),
    com_callback_set_ip: v => call('$com_callback_set_ip', [v]),
    com_callback_get_thunk: () => call('$com_callback_get_thunk'),
    com_callback_set_thunk: v => call('$com_callback_set_thunk', [v]),
    run: blocks => {
      assert.equal(blocks, 500000);
      assert.equal(exports.yieldReason, 0, 'outer blocking state not inherited');
      runs++; seen.push(stack.at(-1)); hook();
    },
    get_dll_count: () => 1, get_dll_table: () => 0x400,
    guest_alloc: () => { assert.equal(syncDepth, 1); return 0x800; },
  };
  for (const r of Object.keys(regs)) {
    exports['get_' + r] = () => regs[r];
    exports['set_' + r] = v => { regs[r] = v; };
  }
  const ctx = { exports, getMemory: () => memory };
  const storage = module.exports.createStorageImports(ctx);
  const put = (at, v) => dv.setUint32(at, v, true);
  const get = at => dv.getUint32(at, true);
  const str = (at, s) => new Uint8Array(memory).set(Buffer.from(s + '\0'), at);
  put(0x600, 0xabcdef);
  put(0x200, 0x220); put(0x224, 0x1000); put(0x228, 0x1100); put(0x22c, 0x1200);
  // Zero GUID at 0x100 (class) and 0x120 (interface).
  const register = () => storage.com_register_class_object(0x100, 0x200, 1, 0);
  const create = (outer = 0) => storage.com_create_instance(0x100, outer, 1, 0x120, 0x300);
  const dll = (classOnly = true) => {
    module.exports.setRegValue('HKCR\\CLSID\\{00000000-0000-0000-0000-000000000000}\\InprocServer32',
      '', 1, 'owner.dll');
    put(0x400, 0x2000); put(0x408, 0x100); // load base/export RVA
    put(0x210c, 0x200); str(0x2200, 'owner.dll');
    put(0x2118, 1); put(0x2120, 0x300); put(0x2124, 0x320); put(0x211c, 0x340);
    put(0x2300, 0x360); dv.setUint16(0x2320, 0, true); put(0x2340, 0x400);
    str(0x2360, 'DllGetClassObject');
    return storage.com_create_instance(0x100, 0, classOnly ? 0x80000001 : 1, 0x120, 0x300);
  };
  const complete = (hr = 0) => {
    for (const r of Object.keys(regs)) regs[r] = 900;
    regs.eax = hr; eip = 0; put(0x600, 0xdead);
    exports.handler = 8; exports.steps = 9; exports.yieldFlag = 0;
    control.$ip = 0xb000; control.$current_thunk_eip = 0x888;
  };
  const snap = () => ({ regs: { ...regs }, eip, seh: get(0x600), stack: [...stack], syncDepth,
    control: { ...control },
    handler: exports.handler, steps: exports.steps,
    yieldReason: exports.yieldReason, yieldFlag: exports.yieldFlag });
  return { exports, ctx, storage, memory, regs, stack, seen, enteredIps, put, get, register, create, dll,
    complete, snap, hook: f => { hook = f; }, runs: () => runs, leaves: () => leaves,
    enters: () => enters, failEnter: () => { enterFailure = true; },
    stale: kind => { if (kind === 'epoch') epoch++; else if (kind === 'slot') slot++; else tid++; },
    sibling: () => { stack.pop(); stack.push(next++); },
  };
}

function suite(source = original, wrapperSource = wat) {
  let cases = 0;
  const make = () => fixture(source, wrapperSource);
  {
    const f = make(), before = f.snap();
    const cookie = f.register();
    assert.deepEqual(f.snap(), before); // AddRef
    f.hook(() => {
      assert.equal(f.get(f.regs.esp), 0);
      assert.equal(f.get(f.regs.esp + 4), 0x200);
      if (f.exports.get_eip() === 0x1200) {
        assert.equal(f.get(f.regs.esp + 16), 0x300);
        f.put(0x300, 0x999);
      }
      f.complete();
    });
    assert.equal(f.create(), 0);
    assert.deepEqual(f.snap(), before);
    assert.equal(f.storage.com_revoke_class_object(cookie), 0);
    assert.deepEqual(f.snap(), before);
    assert.equal(new Set(f.seen).size, 3, 'equal-depth siblings are distinct');
    cases++;
  }
  {
    const f = make(); f.register(); const before = f.snap();
    let nested = false;
    f.hook(() => {
      if (!nested) {
        nested = true;
        const parent = f.snap();
        assert.equal(f.create(), 0);
        assert.deepEqual(f.snap(), parent, 'nested return restores outer callback');
      }
      f.complete();
    });
    assert.equal(f.create(), 0); assert.deepEqual(f.snap(), before);
    assert.equal(new Set(f.seen).size, 3); cases++;
  }
  {
    const f = make(); f.register(); const before = f.snap(); let count = 0;
    f.hook(() => {
      if (++count === 3) { f.put(0x300, 0x999); f.complete(0x80004005); }
    });
    assert.equal(f.create(), 0x80004005, 'completed HRESULT preserved');
    assert.deepEqual(f.snap(), before);
    assert.equal(new Set(f.seen.slice(1)).size, 1, 'run slices preserve identity'); cases++;
  }
  for (const mode of ['throw', 'throw-at-zero', 'yield', 'exit-at-zero', 'budget', 'sibling', 'child',
    'epoch', 'slot', 'tid', 'stale-between-slices', 'instance', 'memory']) {
    const f = make(); f.register();
    let stopped;
    f.hook(() => {
      f.regs.ebx = 765; f.put(0x300, 0x999); // must not turn abort into success
      if (mode === 'sibling') f.sibling();
      if (mode === 'child') f.exports.com_callback_enter();
      if (['epoch', 'slot', 'tid'].includes(mode)) f.stale(mode);
      if (mode === 'stale-between-slices') f.stale('epoch');
      if (mode === 'instance') f.ctx.exports = { ...f.exports };
      if (mode === 'memory') f.ctx.getMemory = () => new ArrayBuffer(0x10000);
      if (mode === 'yield') f.exports.yieldReason = 1;
      if (mode === 'exit-at-zero') f.exports.yieldReason = 2;
      if (mode === 'throw-at-zero') f.complete();
      if (!['throw', 'throw-at-zero', 'yield', 'budget', 'stale-between-slices'].includes(mode))
        f.exports.set_eip(0);
      stopped = f.snap();
      if (mode.startsWith('throw')) throw new Error('guest trap');
    });
    assert.throws(() => f.create(), /trap|complete|mismatch|stale|replaced/, mode);
    assert.deepEqual(f.snap(), stopped, mode + ': no parent restoration/pop');
    assert.equal(f.leaves(), 1);
    assert.equal(f.runs(), mode === 'budget' ? 9 : 2, 'no resume after rejection');
    cases++;
  }
  for (const mode of ['capacity', 'epoch']) {
    const f = make(); f.register();
    if (mode === 'capacity') f.failEnter(); else f.stale('epoch');
    const before = f.snap(), memory = Buffer.from(f.memory);
    assert.throws(() => f.create(), /capacity|stale/);
    assert.deepEqual(f.snap(), before);
    assert.deepEqual(Buffer.from(f.memory), memory, 'acquisition failure before guest writes');
    cases++;
  }
  for (const lifetime of ['addref', 'release']) {
    const f = make();
    const cookie = lifetime === 'release' ? f.register() : 0;
    f.hook(() => { throw new Error('guest trap'); });
    assert.throws(() => lifetime === 'release'
      ? f.storage.com_revoke_class_object(cookie) : f.register(), /guest trap/);
    assert.equal(f.stack.length, 2, 'lifetime method abort retains child'); cases++;
  }
  for (const classOnly of [true, false]) {
    const f = make(), before = f.snap();
    f.hook(() => {
      if (f.exports.get_eip() === 0x2400) {
        assert.equal(f.get(f.regs.esp + 4), 0x100);
        f.put(f.get(f.regs.esp + 12), 0x200);
      }
      f.complete();
    });
    assert.equal(f.dll(classOnly), 0); assert.deepEqual(f.snap(), before);
    assert.equal(f.enters(), classOnly ? 1 : 2); cases++;
    assert.deepEqual(f.enteredIps, classOnly ? [0xa000] : [0xa000, 0xa000],
      'sequential DllGetClassObject/CreateInstance enter against the suspended stream');
  }
  {
    const f = make(); f.register();
    f.hook(() => {
      assert.deepEqual([0, 4, 8, 12, 16].map(n => f.get(f.regs.esp + n)),
        [0, 0x200, 0x456, 0x120, 0x300], 'CreateInstance stdcall frame');
      f.complete();
    });
    assert.equal(f.create(0x456), 0); cases++;
  }
  for (const eip of [1, 2]) {
    const f = make(); f.register();
    f.hook(() => { f.exports.set_eip(eip); });
    assert.throws(() => f.create(), /did not complete/);
    assert.equal(f.runs(), 9); assert.equal(f.leaves(), 1);
    assert.equal(f.stack.length, 2); cases++;
  }
  {
    const f = make();
    f.exports.guest_alloc = () => 0;
    assert.throws(() => f.dll(), /allocation failed/);
    assert.equal(f.runs(), 0); assert.equal(f.leaves(), 0);
    assert.equal(f.stack.length, 2); cases++;
  }
  {
    const f = make(); f.hook(() => { f.put(0x810, 0x200); throw new Error('guest trap'); });
    assert.throws(() => f.dll(), /guest trap/);
    assert.equal(f.leaves(), 0); assert.equal(f.stack.length, 2); cases++;
  }
  {
    const f = make(); f.failEnter();
    // DLL lookup sets up read-only fixture tables; allocation must not occur.
    f.exports.guest_alloc = () => { throw new Error('allocation before ownership'); };
    assert.throws(() => f.dll(), /capacity/);
    assert.equal(f.get(0x800), 0); assert.equal(f.leaves(), 0); cases++;
  }
  {
    const f = make(); f.register(); let nested = false, stopped;
    f.hook(() => {
      if (!nested) { nested = true; f.create(); }
      stopped = f.snap(); throw new Error('nested guest trap');
    });
    assert.throws(() => f.create(), /nested guest trap/);
    assert.deepEqual(f.snap(), stopped, 'neither abandoned JS frame restores');
    assert.equal(f.stack.length, 3); assert.equal(f.leaves(), 1); cases++;
  }
  // Late mismatch at leave itself must reject before depth/pin mutation.
  {
    const f = make(), token = f.exports.com_callback_enter();
    f.sibling(); const before = f.snap();
    assert.throws(() => f.exports.com_callback_leave(token), /mismatch/);
    assert.deepEqual(f.snap(), before); cases++;
  }
  return cases;
}
console.log(`JS COM ownership: ${suite()} source cases PASS`);
const mutations = [
  ['skip per-slice checks', original.replace(/      check\(\);/g, '')],
  ['skip acquisition', original.replace('const token = exports.com_callback_enter();', 'const token = 0n;')],
  ['accept incomplete', original.replace('throw new Error(\'JS COM callback did not complete\');', '/* incorrect success */')],
  ['omit register restore', original.replace("regs.forEach((reg, i) => exports['set_' + reg](saved[i]));", '')],
  ['omit SEH restore', original.replace('if (fsBase) view.setUint32(sehAddress, savedSeh, true);', '')],
  ['omit yield restore', original.replace('exports.set_yield_state(savedYieldReason, savedYieldFlag);', '')],
  ['omit handler restore', original.replace('exports.set_handler_set_eip(savedHandler);', '')],
  ['omit stream IP restore', original.replace('exports.com_callback_set_ip(savedIp);', '')],
  ['omit thunk restore', original.replace('exports.com_callback_set_thunk(savedThunk);', '')],
  ['truncate token', original.replace('exports.com_callback_check(token);', 'exports.com_callback_check(Number(token) >>> 0);')],
  ['omit instance check', original.replace('ctx.exports !== exports || ctx.getMemory() !== memory', 'false')],
];
for (const [name, source] of mutations) {
  assert.notEqual(source, original, name);
  assert.throws(() => suite(source), undefined, 'negative control survived: ' + name);
}
const unsafeLeave = wat.replace(
  '(call $com_callback_check (local.get $expected))\n    (call $sync_depth_leave)',
  '(call $sync_depth_leave)');
assert.notEqual(unsafeLeave, wat);
assert.throws(() => suite(original, unsafeLeave), undefined, 'unchecked WAT leave survived');
console.log('JS COM ownership: 12 mutation negative controls rejected');
