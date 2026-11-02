'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const v8 = require('node:v8');
const root = process.env.TOYVM_ROOT || path.join(__dirname, '..');
const { makeVm } = require(path.join(root, 'tools/toyvm/vm'));
const { snapshot, restore } = require(process.env.CHECKPOINT_MODULE || path.join(root, 'tools/toyvm/checkpoint'));
const { setCpuLevel } = require(path.join(root, 'tools/toyvm/decode'));
setCpuLevel(386);

function sameMemory(actual, expected, label) {
  assert.equal(actual.length, expected.length, label + ' length');
  const a = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
  const b = Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength);
  if (!a.equals(b)) {
    const i = actual.findIndex((value, at) => value !== expected[at]);
    assert.fail(`${label}: byte 0x${i.toString(16)}: ${actual[i]} != ${expected[i]}`);
  }
}
function sameState(actual, expected, label) {
  sameMemory(actual.memory, expected.memory, label + ' RAM');
  const { memory: am, ...a } = actual, { memory: bm, ...b } = expected;
  assert.deepStrictEqual(a, b, label + ' native globals/table/identity');
}
function same(vm, state) {
  sameState(snapshot(vm), state, 'all native state');
}
async function fixture() {
  const vm = await makeVm('tailcall', { exportAll: true });
  vm.exports.set_cpu(386);
  vm.setAll({ cs: 0x1000, ds: 0x1000, ss: 0x1000, ip: 0x100, sp: 0xfffe, flags: 0x202 });
  const d = new DataView(vm.mem.buffer);
  d.setUint16(0x101e0, 0x17, true); d.setUint32(0x101e2, 0x18000, true);
  d.setUint32(0x18008, 0x0000ffff, true); d.setUint32(0x1800c, 0x00cf9a01, true);
  d.setUint32(0x18010, 0x0000ffff, true); d.setUint32(0x18014, 0x00cf9204, true);
  d.setFloat64(0x42000, 1.25, true);
  // Real LGDT, MOV CR0 and far transfer; then real segment loads and lazy OF.
  vm.mem.set([0xfa, 0x0f,0x01,0x16,0xe0,1,
    0x66,0xb8,1,0,0,0, 0x0f,0x22,0xc0, 0xea,0,2,8,0], 0x10100);
  vm.mem.set([0x66,0xb8,0x10,0, 0x8e,0xd8, 0x8e,0xd0,
    0xbc,0,0x80,0,0,
    0xdd,0x05,0,0x20,0,0, 0xd9,0xee, 0xd9,0xe0, 0xb8,0xff,0xff,0xff,0x7f, 0x83,0xc0,1, 0xfb,
    0x70,7, 0xb8,0xef,0xbe,0xad,0xde, 0xeb,5,
    0xb8,0x78,0x56,0x34,0x12, 0xa3,0x34,0x12,0,0, 0xf4], 0x10200);
  for (let i = 0; i < 14; i++) assert(vm.stepOne());
  assert.equal(vm.get('cs'), 8); assert.equal(vm.get('gip'), 0x21f);
  assert.equal(vm.exports.mget_dsb(), 0x40000);
  assert.notEqual(vm.exports['g$fop'].value, 0, 'overflow remains in lazy state');
  // A changed GDT must not reload the already loaded hidden DS cache.
  vm.mem[0x18014] = 5;
  assert(Object.is(vm.exports.fget_st(6), -0), 'real FLDZ/FCHS negative zero');
  assert.equal(vm.exports.fget_st(7), 1.25, 'real FLD m64');
  assert.equal(vm.exports.fget_ftop(), 6, 'two real pushes rotate native x87 TOP');
  assert.equal(vm.exports['g$fa'].value, 0x7fffffff);
  assert.equal(vm.exports['g$fb'].value, 1);
  assert.equal(vm.exports['g$fr'].value, -0x80000000);
  assert.equal(vm.exports['g$fw'].value, 32);
  vm.exports.set_irqpend(1); // The host holds an IRQ while IF is clear.
  assert(vm.stepOne()); // Real STI arms the IF-enable boundary.
  assert.equal(vm.exports.get_ifarm(), 1);
  assert.equal(vm.get('gip'), 0x220);
  assert.notEqual(vm.exports['g$fop'].value, 0, 'STI leaves arithmetic lazy');
  return vm;
}
function finish(vm) {
  for (let i = 0; i < 3; i++) assert(vm.stepOne());
  assert.equal(new DataView(vm.mem.buffer).getUint32(0x41234, true), 0x12345678,
    'restored lazy OF takes JO and cached DS uses its old base');
  assert.equal(new DataView(vm.mem.buffer).getUint32(0x51234, true), 0,
    'restoration must not reload DS from the changed GDT');
  return snapshot(vm);
}
async function main() {
  if (process.argv.some(a => a.startsWith('--old-snapshot'))) {
    const vm = await fixture(), old = require(path.join(root, 'tools/toyvm/uop-harness'));
    const saved = old.snapshot(vm);
    const mode = process.argv.find(a => a.startsWith('--old-snapshot')).split('=')[1];
    if (mode === 'x87') {
      const fresh = await makeVm('tailcall', { bytes: vm.bytes, wat: vm.wat });
      old.seed(fresh, saved);
      assert(Object.is(fresh.exports.fget_st(6), -0), 'old snapshot loses x87 negative zero');
      return;
    }
    old.seed(vm, saved);
    if (mode === 'cache') assert.equal(vm.exports.mget_dsb(), 0x40000, 'old snapshot loses hidden cache');
    if (mode === 'program') { finish(vm); return; }
    assert.equal(vm.exports.get_irqpend(), 1, 'old snapshot must preserve the pending IRQ boundary');
    assert.equal(vm.exports.mget_dsb(), 0x40000, 'old snapshot must preserve stale hidden DS cache');
    finish(vm);
    return;
  }
  const plain = await makeVm('tailcall');
  assert.throws(() => snapshot(plain), /exportAll/);
  const vm = await fixture();
  const beforeMemory = vm.mem.slice();
  const beforeGlobals = Object.fromEntries(Object.entries(vm.exports)
    .filter(([, g]) => g instanceof WebAssembly.Global).map(([k, g]) => [k, g.value]));
  const beforeTable = Array.from({ length: vm.exports.h.length }, (_, i) => vm.exports.h.get(i));
  const state = snapshot(vm);
  assert.deepStrictEqual(Array.from({ length: vm.exports.h.length }, (_, i) => vm.exports.h.get(i)), beforeTable,
    'snapshot leaves every table slot untouched');
  sameMemory(state.memory, beforeMemory, 'independent RAM observation');
  for (const g of state.globals) assert(Object.is(g.value, beforeGlobals[g.name]));
  assert.equal(state.globals.length, Object.keys(beforeGlobals).length);
  for (const name of ['g$rep_d1', 'g$rep_d3', 'g$rep_d5']) {
    assert(name in beforeGlobals, 'exportAll includes same-line native globals: ' + name);
  }
  assert.equal(vm.get('ss'), 0x10);
  assert.equal(vm.exports.mget_ssb(), 0x40000);
  assert.equal(vm.exports.mget_csb(), 0x10000);
  assert.equal(vm.exports.mget_gdtb(), 0x18000);
  assert.equal(vm.exports.mget_gdtl(), 0x17);
  assert.equal(vm.exports.mget_pm_ds_valid(), 1);
  assert.equal(vm.exports.mget_pm_ds_limit(), -1);
  assert.equal(vm.exports.mget_pm_ss_limit(), -1);
  assert.equal(vm.exports.mget_d32(), 1);
  assert.equal(vm.exports.mget_spm(), -1);
  assert.equal(vm.exports['g$flags'].value & 0x200, 0x200, 'STI enables IF without materializing OF');
  assert.equal(vm.exports.mget_dsb(), 0x40000);
  assert.equal(vm.mem[0x18014], 5);
  assert.equal(state.memory.length, vm.memory.buffer.byteLength);
  assert.equal(state.handlers.length, vm.exports.h.length);
  state.handlers.forEach((name, i) => assert.strictEqual(
    name === null ? null : vm.exports[name], beforeTable[i], 'independent handler slot ' + i));
  sameMemory(vm.mem, beforeMemory, 'snapshot is read only');
  assert.deepStrictEqual(Object.fromEntries(Object.entries(vm.exports)
    .filter(([, g]) => g instanceof WebAssembly.Global).map(([k, g]) => [k, g.value])), beforeGlobals);
  assert.throws(() => restore(plain, state), /exportAll/);
  const encoded = v8.serialize(state), saved = v8.deserialize(encoded);
  sameState(saved, state, 'binary archive preserves negative zero and every native field');
  const baseline = finish(vm);
  restore(vm, saved); same(vm, saved);
  assert.equal(vm.exports.get_irqpend(), 1); assert.equal(vm.exports.get_ifarm(), 1);
  assert(Object.is(vm.exports.fget_st(6), -0));
  sameState(finish(vm), baseline, 'replay parity includes every native byte/global/slot');
  const fresh = await makeVm('tailcall', { bytes: vm.bytes, wat: vm.wat });
  restore(fresh, saved); same(fresh, saved);
  sameState(finish(fresh), baseline, 'fresh-instance native replay');
  // Corrupt the complete native state, including cached segment attributes,
  // pending IRQ boundaries, FPU and handler table; restoration repairs it.
  for (let i = 0; i < vm.mem.length; i++) vm.mem[i] ^= 0xff;
  for (const g of state.globals) if (g.mutable) {
    vm.exports[g.name].value = g.type === 'i64'
      ? (g.value === 0n ? 1n : 0n) : (Object.is(g.value, 0) ? 1 : 0);
  }
  for (let i = 0; i < vm.exports.h.length; i++) {
    vm.exports.h.set(i, vm.exports.h.get(i) === null ? vm.exports.run : null);
  }
  sameMemory(state.memory, beforeMemory, 'snapshot owns its RAM copy');
  restore(vm, saved); same(vm, saved);
  // Rejection must be atomic even when the invalid field is at the end.
  for (const mutate of [
    s => { s.schema = 'bad'; },
    s => { s.moduleSha256 = 'bad'; },
    s => { s.watSha256 = 'bad'; },
    s => { s.memory = s.memory.subarray(1); },
    s => { s.globals.pop(); },
    s => { delete s.globals[s.globals.length - 1]; },
    s => { s.globals.at(-1).type = s.globals.at(-1).type === 'f64' ? 'i32' : 'f64'; },
    s => { s.globals.at(-1).mutable = !s.globals.at(-1).mutable; },
    s => { s.globals.at(-1).name = 'g$wrong'; },
    s => { s.globals.find(g => g.type === 'i32').value = 1.5; },
    s => { s.globals.find(g => g.type === 'i32').value = -0; },
    s => { s.globals.find(g => g.type === 'f64').value = 1n; },
    s => { s.handlers.pop(); },
    s => { delete s.handlers[s.handlers.length - 1]; },
    s => { s.handlers[s.handlers.length - 1] = 'f$missing'; },
    s => { s.handlers[s.handlers.length - 1] = 'run'; },
  ]) {
    // V8 can alias typed-array bytes into the serialized Buffer. Copy the
    // archive so a negative fixture cannot mutate the saved-state oracle.
    const invalid = v8.deserialize(Buffer.from(encoded));
    invalid.memory.fill(0x33); // An early write must be visible to the oracle.
    mutate(invalid);
    assert.throws(() => restore(vm, invalid), /checkpoint/); same(vm, saved);
    sameState(saved, state, 'negative fixture leaves saved oracle untouched');
  }
  // A lost lazy flag/cache is causally detected by the program, separately
  // from the full-state equality oracle.
  assert(state.globals.some(g => g.name === 'g$fop'));
  for (const mutate of [() => { vm.exports['g$fop'].value = 0; },
    () => vm.exports.mset_dsb(0x50000)]) {
    restore(vm, saved); mutate();
    assert.throws(() => finish(vm));
  }
  // Non-default table slots, including null, must map to destination functions.
  restore(vm, saved);
  vm.exports.h.set(0, vm.exports.h.get(vm.exports.h.length - 1));
  vm.exports.h.set(vm.exports.h.length - 1, null);
  const changedTable = snapshot(vm);
  restore(fresh, changedTable); same(fresh, changedTable);
  restore(vm, saved);
  if (process.env.CHECKPOINT_EVIDENCE) {
    const fs = require('node:fs'), zlib = require('node:zlib');
    const out = process.env.CHECKPOINT_EVIDENCE;
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'native-checkpoint.bin.gz'), zlib.gzipSync(encoded));
    fs.writeFileSync(path.join(out, 'native-module.wasm.gz'), zlib.gzipSync(vm.bytes));
    fs.writeFileSync(path.join(out, 'native-checkpoint.json'), JSON.stringify({
      moduleSha256: state.moduleSha256, watSha256: state.watSha256,
      memoryBytes: state.memory.length, nativeGlobals: state.globals.length,
      handlerSlots: state.handlers.length, restoredEntry: '0008:00000220',
      checks: ['read-only', 'binary-roundtrip', 'same-instance', 'fresh-instance',
        'destructive-restore', 'atomic-rejections', 'lazy-OF-negative', 'hidden-DS-negative'],
      originalLaunches: 0, fullDosSessionCheckpoint: false,
    }, null, 2));
  }
  console.log('PASS native checkpoint: all globals/RAM/table, lazy OF, stale descriptor cache, x87, IRQ boundaries, binary roundtrip, same/fresh-instance replay, destructive restore and atomic negatives');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { fixture, finish };
