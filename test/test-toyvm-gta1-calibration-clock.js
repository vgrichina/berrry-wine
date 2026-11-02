'use strict';

// Fixture, not a GTA launch. Original DEMO24.EXE SHA256:
// 2f1cedfb95254b2f1a8913f1aeac7a915966cb42c70c9c96b14b8861fbf78c9f
// Embedded LE page275/file1830849, 1019665D..1019668E. The one internal
// fixup (object2+2CD6B8) gives 104786B8. No game files are needed at test time.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const isa = require('../tools/toyvm/isa');
const { makeVm } = require('../tools/toyvm/vm');
const { Machine } = require('../tools/toyvm/dos');
const { DosSession } = require('../tools/toyvm/dos-loop');
const paging = require('../tools/toyvm/paging-exec');
const tasks = require('../tools/toyvm/task-switch');
const { setCpuLevel } = require('../tools/toyvm/decode');
const evidence = process.env.TOYVM_CALIBRATION_EVIDENCE;
const code = Buffer.from('53515256b42ccd2131c088f089c3b42ccd2131c088f039c374f431f688c3b42ccd214638f374f78935b88647105e5a595bc3', 'hex');
// Original 0088:06FD..070A: segment pops, POPAD, ADD ESP,6, IRETD.
const tail = Buffer.from('1f070fa10fa966616683c40666cf', 'hex');
const ENTRY = 0x1019665d, RESULT = 0x104786b8, STACK = 0x10470000;
const STOP = 0x10196700;
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const state = vm => ({ memory: hash(vm.mem), globals: Object.fromEntries(
  Object.entries(vm.exports).filter(([k]) => k.startsWith('mget_')).map(([k, f]) => [k, f()])) });

// Host-only inspection. No pg_read/probe, device access, setters, or A/D writes.
function inspect(vm, linear, count) {
  const e = vm.exports, get = n => e['mget_' + n]() >>> 0;
  const mask = get('linmask'), bus = p => mask === 0xfffff ? (p & 0xffefffff) >>> 0 : p >>> 0;
  const byte = p => {
    p = bus(p);
    if (p >= isa.GUEST_RAM_SIZE || (p >= 0xa0000 && p < 0xc0000)) throw Error('not ordinary RAM');
    return vm.mem[p];
  };
  const word = p => (byte(p) | byte(p + 1) << 8 | byte(p + 2) << 16 | byte(p + 3) << 24) >>> 0;
  const bytes = [], walks = [];
  try {
    for (let i = 0; i < count; i++) {
      const l = (linear + i) >>> 0; let p = l & mask;
      if (get('cr0') & 0x80000000) {
        const pdeAddress = (get('cr3') & 0xfffff000) + (l >>> 22) * 4;
        const pde = word(pdeAddress), w = { page: l >>> 12, pdeAddress, pde };
        if (!walks.some(x => x.page === w.page)) walks.push(w);
        if (!(pde & 1)) throw Error('PDE not present');
        const pteAddress = (pde & 0xfffff000) + ((l >>> 10) & 0xffc), pte = word(pteAddress);
        Object.assign(w, { pteAddress, pte });
        if (!(pte & 1)) throw Error('PTE not present');
        p = ((pte & 0xfffff000) | (l & 4095)) >>> 0;
      }
      bytes.push(byte(p));
    }
    return { linear, bytes, walks };
  } catch (error) { return { linear, bytes, walks, unavailable: error.message }; }
}
function bytes(vm, linear, count) {
  const result = inspect(vm, linear, count);
  assert.equal(result.unavailable, undefined);
  return Buffer.from(result.bytes);
}
function snap(vm) {
  const e = vm.exports;
  return { cs: vm.get('cs'), ip: vm.get('gip'), ss: vm.get('ss'), sp: vm.raw('sp') >>> 0,
    flags: e.pg_flags() >>> 0, cr2: e.mget_cr2() >>> 0, tr: e.mget_tr() >>> 0,
    registers: Object.fromEntries(isa.REG16.map(n => [n, vm.raw(n) >>> 0])),
    fault: inspect(vm, e.mget_cr2() >>> 0, 1) };
}
async function setup() {
  global.gc?.(); setCpuLevel(386);
  const vm = await makeVm('tailcall'), e = vm.exports, v = new DataView(vm.mem.buffer);
  e.set_cpu(386);
  const machine = new Machine(new Uint8Array(0), { autoKey: false, sound: 'none' });
  machine.setMemory(vm.mem, e);
  const put = (p, n) => v.setUint32(p, n >>> 0, true);
  const descriptor = (selector, base, limit, access, wide, gran = false) => {
    const p = 0x20000 + selector;
    put(p, (limit & 0xffff) | (base & 0xffff) << 16);
    put(p + 4, (base & 0xff000000) | (base >>> 16 & 255) | access << 8 |
      (limit & 0xf0000) | (wide ? 0x400000 : 0) | (gran ? 0x800000 : 0));
  };
  descriptor(8, 0, 0xfffff, 0x9a, true, true);
  descriptor(16, 0, 0xfffff, 0x92, true, true);
  descriptor(0x2e0, 0, 0xfffff, 0x9a, true, true);
  descriptor(0x2e8, STACK, 0xffff, 0x92, true);
  descriptor(0x88, 0x110000, 0xffff, 0x9a, false);
  descriptor(0xf000, 0xf0000, 0xffff, 0x9a, false);
  const gate = (vec, sel, ip, access = 0x8e) => {
    put(0x18000 + vec * 8, sel << 16 | (ip & 0xffff));
    put(0x18004 + vec * 8, (ip & 0xffff0000) | access << 8);
  };
  e.mset_gdtb(0x20000); e.mset_gdtl(0xf007); e.mset_idtb(0x18000); e.mset_idtl(0x7ff);
  e.mset_cr0(1); e.mset_linmask(isa.LIN_MASK_FLAT);
  vm.setAll({ cs: 8, ds: 16, es: 16, fs: 16, gs: 16, ss: 0x2e8, sp: 0x8000, ip: 0x10000, flags: 2 });
  put(0x30000, 0x31007);
  for (let i = 0; i < 1024; i++) put(0x31000 + i * 4, i * 4096 | 7);
  const map = (linear, physical, table) => {
    put(0x30000 + (linear >>> 22) * 4, table | 7);
    put(table + ((linear >>> 10) & 0xffc), physical | 7);
  };
  map(0x10196000, 0x40000, 0x32000);
  for (let i = 0; i < 16; i++) map(STACK + i * 4096, 0x50000 + i * 4096, 0x33000);
  vm.mem.set([0xb8, ...u32(0x30000), 0x0f, 0x22, 0xd8,
    0xb8, ...u32(0x80000011), 0x0f, 0x22, 0xc0, 0xea, ...u32(ENTRY), 0xe0, 2], 0x10000);
  for (let i = 0; i < 5; i++) assert(vm.stepOne());
  assert.equal(vm.get('gip'), ENTRY); assert.equal(e.get_d32(), 1);
  gate(0x21, 0x88, 0x600);
  // Representative protected DOS bridge: 32-bit gate -> 16-bit handler ->
  // PUSHF/far CALL to existing DOS host stub -> original restore tail/IRETD.
  // Six bookkeeping bytes reproduce the original 58-byte restore layout.
  const bridge = [0x66, 0x83, 0xec, 6, 0x66, 0x60, 0x0f, 0xa8, 0x0f, 0xa0, 6, 0x1e,
    0x9c, 0x9a, 0x21, 1, 0, 0xf0,
    0x36, 0x67, 0x66, 0x89, 0x4c, 0x24, 0x20,
    0x36, 0x67, 0x66, 0x89, 0x54, 0x24, 0x1c];
  const jump = 0x6fd - (0x600 + bridge.length + 3);
  bridge.push(0xe9, jump & 255, jump >>> 8 & 255);
  vm.mem.set(bridge, 0x110600); vm.mem.set(tail, 0x1106fd);
  vm.mem.set(code, 0x4065d); put(0x58000, STOP); put(0x586b8, 0xdeadbeef);
  const saved = { bx: 0x12345678, cx: 0x23456789, dx: 0x3456789a, si: 0x456789ab };
  for (const [name, value] of Object.entries({ ax: 0x55667788, ...saved, bp: 0x6789abcd, di: 0x789abcde })) e['set_' + name](value);
  const session = new DosSession(vm, machine, { stuckLimit: 0 });
  assert.equal(session.dispatchesPerTick, 550000); assert.equal(session.tickScale, 1);
  assert.equal(session.irqSchedule, true);
  return { vm, e, v, put, descriptor, gate, machine, session, saved };
}

// Every observed call records its complete restore58 + host6 + IRETD12 bytes.
// Concatenated gzip members keep evidence small without omitting calls.
function observe(f, label) {
  const { vm, e, session, machine } = f, oldStep = paging.step, oldService = session.serviceInterrupt;
  let pending, calls = 0, returns = 0, chunks = [], size = 0, lastTick = -1;
  const digest = crypto.createHash('sha256'), first = [], last = [], transitions = [];
  const fd = evidence ? fs.openSync(path.join(evidence, label + '-frames.bin.gz'), 'w') : null;
  function flush() {
    if (!size) return;
    const b = Buffer.concat(chunks, size); if (fd !== null) fs.writeSync(fd, zlib.gzipSync(b));
    chunks = []; size = 0;
  }
  session.serviceInterrupt = function() {
    assert(pending); assert.equal(vm.get('cs'), 0xf000);
    pending.host = bytes(vm, (e.get_ssb() >>> 0) + vm.get('sp'), 6);
    assert.equal(pending.host.readUInt16LE(0), 0x612); assert.equal(pending.host.readUInt16LE(2), 0x88);
    const result = oldService.apply(this, arguments);
    const ms = machine.ticks * 55;
    assert.equal(vm.get('cx'), (Math.floor(ms / 3600000) << 8) | Math.floor(ms / 60000) % 60);
    assert.equal(vm.get('dx'), (Math.floor(ms / 1000) % 60 << 8) | Math.floor(ms / 10) % 100);
    pending.queryTick = machine.ticks; return result;
  };
  paging.step = function(target) {
    if (target !== vm) return oldStep.apply(this, arguments);
    const cs = vm.get('cs'), ip = vm.get('gip');
    if (cs === 0x2e0 && [0x10196663, 0x1019666d, 0x1019667d].includes(ip)) {
      assert.equal(pending, undefined);
      pending = { before: snap(vm), returnIP: ip + 2, call: ++calls };
      const result = oldStep.apply(this, arguments);
      assert.equal(vm.get('cs'), 0x88); assert.equal(vm.get('gip'), 0x600);
      const frame = bytes(vm, STACK + (vm.raw('sp') >>> 0), 12);
      assert.equal(frame.readUInt32LE(0), pending.returnIP);
      assert.equal(frame.readUInt32LE(4), pending.before.cs);
      assert.equal(frame.readUInt32LE(8), pending.before.flags);
      assert.equal(vm.raw('sp') >>> 0, pending.before.sp - 12);
      return result;
    }
    if (cs === 0x88 && ip === 0x6fd) {
      assert(pending?.host); pending.restore = bytes(vm, STACK + (vm.raw('sp') >>> 0), 58);
      assert.equal(pending.restore.readUInt32LE(46), pending.returnIP);
      assert.equal(pending.restore.readUInt32LE(50), 0x2e0);
      assert.equal(pending.restore.readUInt32LE(54), pending.before.flags);
    }
    if (cs === 0x88 && ip === 0x709) {
      assert(pending?.restore);
      const frame = bytes(vm, STACK + (vm.raw('sp') >>> 0), 12);
      assert.deepEqual(frame, pending.restore.subarray(46));
      const result = oldStep.apply(this, arguments), after = snap(vm);
      assert.equal(after.ip, pending.returnIP); assert.equal(after.cs, 0x2e0);
      assert.equal(after.sp, pending.before.sp); assert.equal(after.ss, pending.before.ss);
      assert.equal(after.flags, pending.before.flags);
      const header = Buffer.alloc(16);
      header.writeDoubleLE(session.dispatched, 0); header.writeUInt32LE(pending.queryTick, 8); header.writeUInt32LE(pending.returnIP, 12);
      const record = Buffer.concat([header, pending.restore, pending.host, frame]);
      assert.equal(record.length, 92); digest.update(record);
      if (fd !== null) { chunks.push(record); size += record.length; if (size >= 92 * 1024) flush(); }
      const item = { call: pending.call, dispatched: session.dispatched, queryTick: pending.queryTick,
        returnIP: pending.returnIP, restoreHex: pending.restore.toString('hex'), hostHex: pending.host.toString('hex'),
        iretHex: frame.toString('hex'), before: pending.before, after };
      if (first.length < 3) first.push(item); last.push(item); if (last.length > 3) last.shift();
      if (lastTick !== pending.queryTick) { transitions.push(item); lastTick = pending.queryTick; }
      returns++; pending = undefined; return result;
    }
    return oldStep.apply(this, arguments);
  };
  return { finish() {
    paging.step = oldStep; session.serviceInterrupt = oldService;
    flush(); if (fd !== null) fs.closeSync(fd);
    return { calls, returns, inFlight: pending ? { ...pending, state: snap(vm) } : null,
      frameRecordBytes: 92, framesSha256: digest.digest('hex'), first, last, transitions };
  } };
}
async function calibration(label, observed) {
  const f = await setup(), { vm, e, v, put, session, machine, saved } = f;
  if (label !== 'whole') {
    // Explicit boundary state at the original second-phase MOV BL,AL. This
    // seeds a checkpoint; elapsed work still uses unchanged clock defaults.
    const initial = label === 'rollover' ? 1091 * 550000 - 256 : 0;
    session.dispatched = initial; session.reachedAt = initial - 1;
    machine.setClock(initial / 550000);
    vm.set('gip', 0x10196679); vm.set('sp', 0x7ff0);
    [saved.si, saved.dx, saved.cx, saved.bx].forEach((n, i) => put(0x57ff0 + i * 4, n));
    e.set_si(0); e.set_ax(label === 'rollover' ? 59 : 0);
  }
  const initialDispatched = session.dispatched;
  const initialState = state(vm), missing = inspect(vm, 0x10800000, 1), device = inspect(vm, 0xa0000, 1);
  assert(missing.unavailable); assert(device.unavailable); snap(vm);
  assert.deepEqual(state(vm), initialState, 'negative and ordinary snapshots are read-only');
  const observer = observed ? observe(f, label) : null;
  const bound = label === 'whole' ? 21e6 : label === 'rollover' ? 100000 : 10000;
  const start = Date.now(); let steps = 0, data;
  try {
    while (vm.get('gip') !== STOP && session.dispatched - initialDispatched < bound) {
      const why = session.step(); assert.notEqual(why, 'unimplemented'); assert.notEqual(why, 'done');
      assert.equal(session.protectedTransferStop, undefined);
      if (++steps % 65536 === 0) await new Promise(resolve => setImmediate(resolve));
    }
  } finally { data = observer?.finish(); }
  const finished = vm.get('gip') === STOP, count = v.getUint32(0x586b8, true);
  if (label === 'same-second') {
    assert.equal(finished, false); assert.equal(count, 0xdeadbeef); assert.equal(machine.ticks, 0);
    assert(vm.raw('si') > 0);
  } else {
    assert.equal(finished, true); assert(count > 0 && count !== 0xdeadbeef);
    assert.equal(vm.raw('sp') >>> 0, 0x8004);
    for (const [n, value] of Object.entries(saved)) assert.equal(vm.raw(n) >>> 0, value, n + ' restored');
    assert.equal(machine.ticks, label === 'whole' ? 37 : 1091);
    if (label === 'whole') assert(session.dispatched >= 20350000);
  }
  if (observed && finished) {
    assert.equal(data.calls, data.returns); assert.equal(data.inFlight, null);
    assert.equal(data.last.at(-1).returnIP, 0x1019667f);
    if (label === 'whole') {
      assert.equal(data.first[0].queryTick, 0);
      assert(data.transitions.some(x => x.queryTick === 19 && x.before.registers.bx === 0));
      assert.equal(data.last.at(-1).queryTick, 37);
      assert.equal(count, Buffer.from(data.last.at(-1).restoreHex, 'hex').readUInt32LE(12) + 1);
    } else assert.equal(data.last.at(-1).after.registers.dx >>> 8 & 255, 0, '59 -> 0 rollover');
  }
  const result = { label, observed, finished, count, dispatched: session.dispatched, initialDispatched,
    elapsedDispatches: session.dispatched - initialDispatched, ticks: machine.ticks,
    guestSeconds: session.guestSeconds(session.dispatched), wallSeconds: (Date.now() - start) / 1000, steps,
    moduleSha256: hash(vm.bytes), watSha256: hash(vm.wat), memoryBytesCompared: vm.mem.length,
    clock: { dispatchesPerTick: session.dispatchesPerTick, tickScale: session.tickScale,
      irqSchedule: session.irqSchedule, pitClock: session.pitClock },
    exportedGlobalsCompared: Object.keys(state(vm).globals).length, data };
  console.log(JSON.stringify({ ...result, data: data ? { calls: data.calls, returns: data.returns } : undefined }));
  return { state: state(vm), result };
}

async function faultFixture() {
  const f = await setup(), { vm, e, put, descriptor, gate } = f;
  descriptor(0x28, 0x70000, 103, 0x89, false);
  descriptor(0x30, 0x71000, 103, 0x89, false);
  // Use an actual LTR, followed by an IRETD whose stack read page-faults.
  vm.setAll({ cs: 8, ss: 16, ds: 16, es: 16, fs: 16, gs: 16, sp: 0x80000, ip: 0x12100, flags: 2 });
  vm.mem.set([0x66, 0xb8, 0x28, 0, 0x0f, 0, 0xd8, 0xcf], 0x12100);
  assert(vm.stepOne()); assert(vm.stepOne()); assert.equal(e.mget_tr(), 0x28);
  put(0x7001c, 0x30000);
  put(0x7101c, 0x30000); put(0x71020, 0x13000); put(0x71024, 2); put(0x71038, 0x90000);
  [16, 8, 16, 16, 16, 16].forEach((n, i) => put(0x71048 + i * 4, n));
  gate(14, 0x30, 0, 0x85);
  put(0x80000, 0x14000); put(0x80004, 8); put(0x80008, 2);
  const pte = 0x31000 + (0x80000 >>> 12) * 4;
  vm.mem.set([0xc7, 5, ...u32(pte), ...u32(0x80007), 0x83, 0xc4, 4, 0xcf], 0x13000);
  put(pte, 0);
  return f;
}
async function composition(mode) {
  const { vm, e } = await faultFixture();
  const original = tasks.switchTask, oldStep = paging.step, faults = [], legacy = [], iretds = [];
  // Exact previous installation order: save legacy target BEFORE ring, then
  // install ring, then assign legacy wrapper. Capturing original reproduces
  // the lost observer; capturing current composes it.
  if (mode !== 'unobserved') {
    tasks.switchTask = function(target, selector, ip, returning) {
      const item = { returning, before: snap(target) }; faults.push(item);
      const result = original.apply(this, arguments); item.after = snap(target); return result;
    };
    const downstream = mode === 'replaced' ? original : tasks.switchTask;
    tasks.switchTask = function(target, selector, ip, returning) {
      const item = { returning, before: paging.exceptionState(target, 14, 0, ip, false, false, selector) };
      legacy.push(item); const result = downstream.apply(this, arguments);
      item.after = paging.exceptionState(target, 14, 0, ip, false, false, selector); return result;
    };
    paging.step = function(target) {
      const item = { before: snap(target) }, result = oldStep.apply(this, arguments);
      item.after = snap(target); iretds.push(item); return result;
    };
  }
  try {
    for (let i = 0; vm.get('gip') !== 0x14000 && i < 8; i++) assert(vm.stepOne());
    assert.equal(vm.get('gip'), 0x14000); assert.equal(vm.raw('sp') >>> 0, 0x8000c);
    assert.equal(e.mget_tr(), 0x28); assert.equal(e.mget_cr2(), 0x80000);
    if (mode !== 'unobserved') {
      assert.equal(legacy.length, 2); assert.deepEqual(legacy.map(x => x.returning), [false, true]);
      assert.equal(faults.length, mode === 'replaced' ? 0 : 2);
      if (mode === 'composed') {
        assert.equal(faults[0].before.fault.unavailable, 'PTE not present');
        assert.equal(faults[1].before.fault.unavailable, undefined);
      }
    }
  } finally { tasks.switchTask = original; paging.step = oldStep; }
  return { state: state(vm), result: { mode, faults, legacy, iretds } };
}

(async () => {
  if (evidence) fs.mkdirSync(evidence, { recursive: true });
  const results = [];
  for (const label of ['whole', 'rollover', 'same-second']) {
    const base = await calibration(label, false), observed = await calibration(label, true);
    assert.deepEqual(observed.state, base.state, label + ': observer changes RAM/exported globals');
    results.push({ ...observed.result, parityAllRamAndMgetGlobals: true, baseline: base.result });
  }
  const base = await composition('unobserved'), replaced = await composition('replaced'), composed = await composition('composed');
  assert.deepEqual(replaced.state, base.state); assert.deepEqual(composed.state, base.state);
  if (evidence) fs.writeFileSync(path.join(evidence, 'fixture-results.json'), JSON.stringify({
    results, composition: [replaced.result, composed.result], compositionParityAllRamAndMgetGlobals: true,
    originalGameExecuted: false, node: process.version, execArgv: process.execArgv,
    sourceSha256: hash(fs.readFileSync(__filename)),
  }, null, 2) + '\n');
  console.log('PASS original calibration bytes through DOS seconds change at default clock; rollover/same-second negatives; all RAM/mget parity; actual task-wrapper replacement and composition. Fixture only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
