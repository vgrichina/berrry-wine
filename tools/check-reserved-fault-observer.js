'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const { snapshotReservedFault, createReservedFaultObserver } = require('./reserved-fault-observer');
const event = (id, phase, extra = {}) => ({ id, phase, address: 0x9000000, eip: 0x401234, ...extra });
let saved, checkpoints = [], value = 1;
const observer = createReservedFaultObserver({ snapshot: () => ({ value }), save: r => { saved = r; }, checkpoint: r => checkpoints.push(JSON.parse(JSON.stringify(r))) });
observer(event(1, 1)); value = 2; observer(event(1, 2)); assert.equal(saved, undefined);
observer(event(2, 1)); value = 3; observer(event(3, 1)); value = 4;
assert.throws(() => observer(event(3, 5, { apiDepth: 1 })), e => e.code === 'RESERVED_FAULT_CAPTURED');
assert.equal(saved.pre.state.value, 3); assert.equal(saved.post.state.value, 4);
assert.equal(saved.pendingAncestors[0].event.id, 2); assert.equal(saved.recentSuccessful[0].id, 1);
assert.equal(checkpoints[0].pending[0].state.value, 1); assert.equal(checkpoints.at(-1).pending.length, 2);
assert.throws(() => observer(event(2, 3)), /already stopped/);
for (const phase of [3, 4, 5, 6]) {
  const o = createReservedFaultObserver({ snapshot: () => ({}), save: r => { assert.equal(r.post.event.phase, phase); } });
  o(event(1, 1)); assert.throws(() => o(event(1, phase)), e => e.code === 'RESERVED_FAULT_CAPTURED');
}
const bounded = createReservedFaultObserver({ snapshot: () => ({}), save: r => { assert.equal(r.status, 'event-budget-exhausted'); assert.equal(r.recentSuccessful.length, 16); } });
for (let i = 1; i < 256; i++) { bounded(event(i, 1)); bounded(event(i, 2)); }
bounded(event(256, 1)); assert.throws(() => bounded(event(256, 2)), e => e.code === 'RESERVED_FAULT_CAPTURED');
const fresh = overrides => createReservedFaultObserver({ snapshot: () => ({}), save: () => assert.fail(), ...overrides });
for (const [setup, bad, pattern] of [
  [[], event(1, 3), /Unpaired/], [[], event(257, 1), /Invalid/],
  [[event(1, 1)], event(1, 1), /pairing/],
  [[event(1, 1)], event(1, 3, { address: 0 }), /Unpaired/],
  [[event(1, 1), event(2, 1)], event(1, 2), /non-LIFO/],
  [[event(1, 1), event(1, 2)], event(1, 1), /reused ID/],
]) {
  const o = fresh(); setup.forEach(o); assert.throws(() => o(bad), pattern);
  assert.throws(() => o(event(3, 1)), /already stopped/);
}
for (const stage of ['snapshot', 'checkpoint', 'save']) {
  const error = Error(stage + ' failed');
  const o = fresh({ [stage]: () => { throw error; } });
  if (stage === 'save') o(event(1, 1));
  assert.throws(() => o(event(1, stage === 'save' ? 3 : 1)), e => e === error);
  assert.throws(() => o(event(2, 1)), /already stopped/);
}

const memory = { buffer: new ArrayBuffer(8 * 1024 ** 2) }, dv = new DataView(memory.buffer), bytes = new Uint8Array(memory.buffer);
const layout = { GUEST_BASE: 0x12000, BASE: { GUEST_PAGE_TABLE: 0x400000, DIB_BACKING_BASE: 0, VIRTUAL_MAP_STATE: 0x300000, VIRTUAL_RESERVE_TABLE: 0x301000 }, SIZE: { GUEST_PAGE_TABLE: 0x400000, VIRTUAL_RESERVE_TABLE: 0x10000 } };
const regs = { eip: 0x401234, image_base: 0x400000, esi: 0x410000, edi: 0x411000, ebx: 0, fs_base: 0x412000, esp: 0x413000, ebp: 0, eax: 7, ecx: 8, edx: 9 };
const guestExports = Object.fromEntries(Object.entries(regs).map(([n, v]) => ['get_' + n, () => v]));
guestExports.g2w = guestExports.guest_to_wasm = () => { throw Error('Guest translation forbidden'); };
const put = (a, v) => dv.setUint32(a - regs.image_base + layout.GUEST_BASE, v, true);
put(regs.fs_base, 0x414000); put(0x414000, 0x414000); put(0x414004, 0x401000); put(0x414008, 0x415000); put(0x41400c, 0); put(0x415000, 0);
dv.setUint32(layout.BASE.VIRTUAL_MAP_STATE + 16, 1, true); dv.setUint32(layout.BASE.VIRTUAL_RESERVE_TABLE, 0x9000001, true); dv.setUint32(layout.BASE.VIRTUAL_RESERVE_TABLE + 4, 4096, true);
const hash = () => crypto.createHash('sha256').update(bytes).digest('hex'); let before = hash();
const missing = snapshotReservedFault(guestExports, memory, layout, event(1, 1));
assert.equal(hash(), before); assert.equal(missing.contexts.fault.data.complete, false); assert.equal(missing.contexts.fault.data.bytes, null);
assert.equal(missing.reservations[0].base, 0x9000000); assert(missing.issues.some(i => i.fsCycle));
assert(missing.issues.some(i => Object.hasOwn(i, 'invalidScope')));
dv.setUint32(layout.BASE.GUEST_PAGE_TABLE + (0x9000000 >>> 12) * 4, 0x200800, true); bytes.fill(0xab, 0x200000, 0x200040); before = hash();
const mapped = snapshotReservedFault(guestExports, memory, layout, event(1, 1));
assert.equal(mapped.contexts.fault.data.bytes.length, 64); assert(mapped.contexts.fault.data.bytes.every(v => v === 0xab)); assert.equal(hash(), before);
// A hole must not hide mapped bytes on the following page, or vice versa.
const pteAt = ga => layout.BASE.GUEST_PAGE_TABLE + (ga >>> 12) * 4;
for (const firstMapped of [false, true]) {
  dv.setUint32(pteAt(0x9000000), firstMapped ? 0x200800 : 0, true);
  dv.setUint32(pteAt(0x9001000), firstMapped ? 0 : 0x201800, true);
  bytes.fill(0xab, 0x200ff0, 0x201030); before = hash();
  const crossing = snapshotReservedFault(guestExports, memory, layout, event(1, 1, { address: 0x9000ff0 }));
  const data = crossing.contexts.fault.data;
  assert.equal(data.bytes, null); assert.equal(data.complete, false);
  assert.deepEqual(data.missing, [{ address: firstMapped ? 0x9001000 : 0x9000ff0, offset: firstMapped ? 16 : 0, missingBytes: firstMapped ? 48 : 16 }]);
  assert.deepEqual(data.fragments, [{ address: firstMapped ? 0x9000ff0 : 0x9001000, offset: firstMapped ? 0 : 16, bytes: Array(firstMapped ? 16 : 48).fill(0xab) }]);
  assert.equal(crossing.atomic, false); assert.equal(hash(), before);
}
// Production direct translation accepts offsets below GUEST_BASE and zero.
for (const [ga, wa] of [[0x3ff000, 0x11000], [0x3ee000, 0]]) {
  bytes.fill(0xcd, wa, wa + 64); before = hash();
  const low = snapshotReservedFault(guestExports, memory, layout, event(1, 1, { address: ga }));
  assert.equal(low.contexts.fault.data.complete, true);
  assert.deepEqual(low.contexts.fault.data.bytes, Array(64).fill(0xcd)); assert.equal(hash(), before);
}
dv.setUint32(layout.BASE.VIRTUAL_MAP_STATE + 16, 0xffffffff, true);
assert(snapshotReservedFault(guestExports, memory, layout, event(1, 1)).issues.some(i => i.invalidReservationCount));

// Execute the production import body, preserving the ordinary census branch.
const source = fs.readFileSync(require.resolve('../lib/host-imports'), 'utf8');
const body = source.slice(source.indexOf('unmapped_trace: (ga, eip) => {') + 'unmapped_trace: '.length, source.indexOf('\n    },', source.indexOf('unmapped_trace: (ga, eip) => {')) + 6);
let phase = 0, seenEvent; const census = new Map();
const ctx = { exports: { get_reserved_fault_observer: field => field === 0 ? phase : field === 1 ? 7 : 0 }, reservedFaultObserver: e => { seenEvent = e; } };
const host = vm.runInNewContext('(' + body + ')', { ctx, unmappedFaults: census, hookUnmappedFaultReport() {}, UNMAPPED_FAULTS_PER_EIP: 64, console: { log() {} } });
host(123, 456); assert.equal(census.get(456).count, 1);
phase = 1; host(123, 456); assert.equal(seenEvent.id, 7); assert.equal(census.get(456).count, 1);
delete ctx.reservedFaultObserver; assert.throws(() => host(123, 456), /without callback/);
phase = 0; delete ctx.exports.get_reserved_fault_observer; host(123, 456); assert.equal(census.get(456).count, 2);
// Execute the actual CLI adapter. Terminate throws only in this test double;
// the production callback calls process.exit before any guest-aware catch.
const { installReservedFaultCli } = require('./reserved-fault-cli');
for (const mode of ['capture', 'snapshot', 'checkpoint', 'save', 'terminal', 'protocol']) {
  const files = new Map(), codes = [], terminalStop = Error('process terminated'); let fail = false;
  const io = {
    statSync: () => ({ isDirectory: () => true }), existsSync: p => files.has(p),
    writeFileSync: (p, text, options) => {
      if (fail && ((mode === 'checkpoint' && p.endsWith('.tmp')) || (mode === 'save' && p.endsWith('capture.json')) || (mode === 'terminal' && p.endsWith('terminal.json')))) throw Error('disk failure');
      if (options.flag === 'wx' && files.has(p)) throw Error('exists'); files.set(p, text);
    },
    renameSync: (from, to) => { files.set(to, files.get(from)); files.delete(from); },
  };
  const cliCtx = {}, cliExports = { ...guestExports, get_reserved_fault_observer() {}, set_reserved_fault_observer: n => assert.equal(n, 1) };
  installReservedFaultCli({ exports: cliExports, memory, layout, ctx: cliCtx, directory: '/evidence', io,
    terminate: code => { codes.push(code); throw terminalStop; } });
  cliCtx.reservedFaultObserver(event(1, 1)); const previous = files.get('/evidence/observer-pending.json');
  fail = true;
  if (mode === 'snapshot') cliExports.get_eax = () => { throw Error('snapshot failed'); };
  const next = mode === 'checkpoint' || mode === 'snapshot' ? event(2, 1) : mode === 'protocol' ? event(2, 3) : event(1, 3);
  assert.throws(() => cliCtx.reservedFaultObserver(next), e => e === terminalStop);
  assert.deepEqual(codes, [mode === 'capture' ? 0 : 1]);
  assert.equal(files.get('/evidence/observer-pending.json'), previous, 'Last complete pre-checkpoint survives every failure');
  if (mode === 'capture') assert(files.has('/evidence/observer-capture.json'));
}
const runner = fs.readFileSync(require.resolve('../test/run'), 'utf8');
const start = runner.indexOf('  if (RESERVED_FAULT_OBSERVER) {');
const wiring = runner.slice(start, runner.indexOf('  if (GUEST_PAGE_STATS)', start));
for (const mode of ['disabled', 'valid', 'workers', 'mode0', 'spawn']) {
  let installed = 0;
  const context = { RESERVED_FAULT_OBSERVER: mode === 'disabled' ? null : '/evidence', FORCE_COOPERATIVE_THREADS: true,
    WORKER_THREADS: mode === 'workers', FAULT_NULL_MODE: mode === 'mode0' ? 0 : 5, SPAWN_PROCESSES_FLAG: mode === 'spawn', APP_ENTRY: {},
    instance: { exports: guestExports }, memory, RegionMap: layout, ctx: {}, require: () => ({ installReservedFaultCli: () => { installed++; } }) };
  if (['workers', 'mode0', 'spawn'].includes(mode)) assert.throws(() => vm.runInNewContext(wiring, context), /requires/);
  else vm.runInNewContext(wiring, context);
  assert.equal(installed, mode === 'valid' ? 1 : 0);
}
console.log('PASS: paired success/failure/nesting/budget/checkpoints, pure PTE holes/bytes/SEH bounds, production host routing and disabled census. Native hook validation remains required.');
