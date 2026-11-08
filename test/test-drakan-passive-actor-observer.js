'use strict';
// Synthetic x86 programs in the complete shipped module, with its real
// GetDeviceData handler. No browser, game/media load, or original input.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const regions = require('../lib/region-map.generated');
const { createDrakanActorObserver, REQUIRED_PINS } = require('../lib/drakan-passive-actor-observer');
const ROOT = path.resolve(__dirname, '..');
const bytes = fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build/wine-assembly.wasm'));
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
const B = 0x713000, OBJ = 0x1800000, ACTOR = 0x1810000;
const STACK = 0x74ff000, END = 0x401900, DEVICE = 0x1820000, BUF = 0x1830000, COUNT = BUF + 128;
const MARK = BUF + 160, STAMP = 288978;
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
const call = (from, to) => [0xe8, ...d32(to - from - 5)];
const jmp = (from, to) => [0xe9, ...d32(to - from - 5)];
const mov = (a, v) => [0xc7, 0x05, ...d32(a), ...d32(v)];
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }

async function fixture(mode = '', fileBytes = bytes) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const h = createHostImports(ctx).host;
  const diagnostics = [];
  h.memory = memory; h.log = () => {}; h.log_i32 = v => diagnostics.push(v >>> 0); h.exit = () => {};
  let wrappedBuffer, originalCalls = 0;
  const calls = [], fifo = [{ event: 0x154, timestamp: STAMP, sequence: 9 }];
  if (mode === 'same-drain') fifo.push({ event: 0x54, timestamp: STAMP + 2000, sequence: 10 });
  const original = function (...args) {
    originalCalls++; calls.push({ receiver: this, args });
    const [, op, n] = args;
    if (mode === 'buffer-throw') throw sentinel;
    if (op === 2) return fifo.length;
    if (op === 3) return fifo[n].event;
    if (op === 4) return fifo[n].timestamp;
    if (op === 5) return fifo[n].sequence;
    if (op === 6) { fifo.splice(0, n); return 0; }
    if (op === 7) return mode === 'overflow' ? 1 : 0;
    return 0;
  };
  const sentinel = { exception: 'original buffer' };
  h.di_keyboard_buffer = function (...args) { return Reflect.apply(wrappedBuffer || original, this, args); };
  const { instance } = await WebAssembly.instantiate(fileBytes, { host: h });
  const e = ctx.exports = instance.exports, mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const exe = fs.readFileSync(path.join(ROOT, 'test/binaries/notepad.exe'));
  mem.set(exe, e.get_staging()); e.load_pe(exe.length); e.set_api_log(0);
  assert.equal(e.get_image_base(), 0x400000);
  const wa = a => regions.g2w(a, e.get_image_base());
  const put = (a, b) => { mem.set(b, wa(a)); e.invalidate_code_range(a, b.length); };
  const u = (a, v) => dv.setUint32(wa(a), v >>> 0, true);
  const rd = a => dv.getUint32(wa(a), true);
  const entry = regions.BASE.DX_OBJECTS;
  // Fixture-only construction of an acquired standard keyboard device.
  // The complete production GetDeviceData path and host import ABI are used.
  u(DEVICE + 4, 0);
  [7, 1, 1, 64, 0x700, 256, 0, 0x500].forEach((v, i) => dv.setUint32(entry + i * 4, v, true));
  u(COUNT, mode === 'same-drain' ? 2 : 1);
  u(0x47b700, OBJ); u(OBJ + 0xa0, ACTOR); u(OBJ + 0xa8, B + 0x4b320);
  u(ACTOR, B + 0x150b20); u(ACTOR + 0x58, OBJ); u(ACTOR + 0x70, 1); u(ACTOR + 0x78, 0);
  u(B + 0x15e584, 0); u(MARK, 0);
  put(END, [0xeb, 0xfe]);
  put(0x407a95, call(0x407a95, 0x405770));
  put(0x407a9a, [0xb9, ...d32(0x47b490), ...jmp(0x407a9f, 0x407aba)]);
  put(0x407aba, call(0x407aba, 0x40a090)); put(0x407abf, [0xc3]);
  const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/api_table.json'))).find(x => x.name === 'IDirectInputDevice_GetDeviceData');
  e.init_dx_com_thunks(); e.seal_thunks();
  let thunk = 0;
  for (let p = e.get_thunk_base(); p < e.get_thunk_end(); p += 8)
    if ((e.thunk_word(p, 0) >>> 0) === 0xcaca0010 && e.thunk_word(p, 1) === api.id) { thunk = p; break; }
  assert(thunk, 'real production GetDeviceData COM thunk');
  let drain = [0x6a, 0, 0x68, ...d32(COUNT), 0x68, ...d32(BUF), 0x6a, 16, 0x68, ...d32(DEVICE),
    0xb8, ...d32(thunk), 0xff, 0xd0,
    // Model the original record callback: retain the down timestamp and apply
    // each returned control edge before returning to the simulation.
    0xa1, ...d32(BUF + 8), 0xa3, ...d32(B + 0x15e584),
    ...mov(ACTOR + 0x78, mode === 'same-drain' ? 0 : 1), 0xc3];
  if (mode === 'no-consume') drain = [...mov(B + 0x15e584, STAMP), ...mov(ACTOR + 0x78, 1), 0xc3];
  put(0x405770, drain);
  put(0x40a090, [0x6a, mode === 'wrong-event' ? 3 : 4, 0x68, ...d32(OBJ), ...jmp(0x40a097, 0x40a127)]);
  put(0x40a127, [0xff, 0x15, ...d32(OBJ + 0xa8)]);
  put(0x40a12d, [0x83, 0xc4, 8, 0xc3]);
  put(B + 0x4b320, [0xb9, ...d32(mode === 'wrong-actor' ? ACTOR + 16 : ACTOR), ...jmp(B + 0x4b325, B + 0x4b36b)]);
  put(B + 0x4b36b, call(B + 0x4b36b, B + 0x4c310)); put(B + 0x4b370, [0xc3]);
  put(B + 0x4c310, mode === 'early-actor' ? [0xc3] :
    [0xb9, ...d32(ACTOR), ...jmp(B + 0x4c315, B + 0x4c4a9)]);
  put(B + 0x4c4a9, call(B + 0x4c4a9, B + 0x4da10)); put(B + 0x4c4ae, [0xc3]);
  const stateBody = [...mov(MARK, 1), 0xb8, ...d32(0x12345678)];
  if (mode === 'release-in-state') stateBody.push(...mov(ACTOR + 0x78, 0));
  if (mode === 'wrong-timestamp') stateBody.push(...mov(B + 0x15e584, STAMP + 1));
  if (mode === 'forged-return') stateBody.push(0x83, 0xec, 4, ...mov(STACK - 28, B + 0x4c4ae));
  if (mode === 'trap') stateBody.push(0x0f, 0x0b);
  stateBody.push(0xc3); put(B + 0x4da10, stateBody);
  if (mode === 'uop') {
    put(B + 0x4c310, [0xba, ...d32(9), ...jmp(B + 0x4c315, B + 0x4c4a9)]);
    // Nine natural state1 invocations inside one outer fixture actor call.
    // This loop challenges native CALL/RET coverage; it is not Drakan code.
    put(B + 0x4c4ae, [0x4a, 0x75, 0xf8, 0xc3]);
    e.set_uop(1);
    const pc = e.uop_compile(B + 0x4c4a9);
    assert(pc, 'compile real call/ret loop before observer arm');
    e.uop_install(B + 0x4c4a9, pc);
    e.set_handler_hist_enabled(1); e.reset_handler_hist();
  }
  if (mode === 'skip-drain') put(0x407a95, jmp(0x407a95, 0x407a9a));
  if (mode === 'skip-sim') put(0x407aba, [0x90, 0x90, 0x90, 0x90, 0x90]);
  if (mode === 'second-list') {
    put(0x40a090, [0x6a, 4, 0x68, ...d32(OBJ), ...jmp(0x40a097, 0x40a172)]);
    put(0x40a172, [0xff, 0x15, ...d32(OBJ + 0xa8)]);
    put(0x40a178, [0x83, 0xc4, 8, 0xc3]);
  }
  if (mode === 'other-actor-first') {
    put(0x40a090, [0x6a, 4, 0x68, ...d32(OBJ + 32), ...jmp(0x40a097, 0x40a127)]);
    put(0x40a12d, [0x83, 0xc4, 8, 0x6a, 4, 0x68, ...d32(OBJ), ...jmp(0x40a137, 0x40a172)]);
    put(0x40a172, [0xff, 0x15, ...d32(OBJ + 0xa8)]);
    put(0x40a178, [0x83, 0xc4, 8, 0xc3]);
  }
  const pins = Object.fromEntries(Object.entries(REQUIRED_PINS).map(([name, [start, end]]) => {
    const address = ['event4', 'actor', 'state1'].includes(name) ? B + start : start;
    return [name, { address, bytes: Buffer.from(mem.slice(wa(address), wa(address) + end - start)) }];
  }));
  const owner = { worker: 'offline-worker', process: 1000, endpoint: 1, slot: 0, epoch: 2041, moduleSha256: sha };
  const sample = { owner: { ...owner }, now: 100, observedAt: 100, downActive: true, timestamp: STAMP };
  e.set_eip(0x407a95); e.set_esp(STACK); u(STACK, END);
  const create = (extra = {}) => {
    const o = createDrakanActorObserver({ exports: e, moduleBytes: fileBytes, expectedSha256: sha, owner,
      readCode: (a, n) => mem.slice(wa(a), wa(a) + n), sample: () => sample,
      pins, base: B, object: OBJ, actor: ACTOR, timestamp: STAMP,
      keyboardDevice: entry, deadline: 2100, ...extra });
    wrappedBuffer = o.wrapKeyboardBuffer(original);
    return o;
  };
  return { e, mem, dv, wa, put, u, rd, create, sample, owner, pins, entry, calls, original,
    diagnostics, sentinel, get originalCalls() { return originalCalls; } };
}

async function execute(mode = '', options = {}) {
  const f = await fixture(mode, options.moduleBytes || bytes), { e } = f;
  e.set_block_chain(options.chain ? 1 : 0); e.set_stack_fusion(options.fusion ? 1 : 0);
  const o = options.unarmed ? null : f.create(options.adapter || {}), reports = [], schedule = [];
  const invoke = o ? o.wrap(e.run, s => reports.push(s)) : e.run;
  const state = ['eip', 'esp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp',
    'flag_op', 'flag_a', 'flag_b', 'flag_res', 'last_run_blocks', 'last_run_halt', 'dbg_tier_guard'];
  const run = n => { const r = invoke(n); schedule.push(state.map(name => e['get_' + name]())); return r; };
  let error;
  try { for (let i = 0; i < 80 && (e.get_eip() >>> 0) !== END; i++) run(mode === 'uop' && e.get_eip() === B + 0x4c310 ? 100 : 1); }
  catch (ex) { error = ex; console.log(JSON.stringify({ mode, eip: e.get_eip() >>> 0,
    stage: e.drakan_actor_observer_get(0), reason: e.drakan_actor_observer_get(1), diagnostics: f.diagnostics, calls: f.calls.map(x => x.args) })); }
  return { ...f, o, reports, error, schedule, status: o && o.snapshot() };
}

(async () => {
  console.log(JSON.stringify({ moduleSha256: sha, bytes: bytes.length, fixture: 'complete production module; synthetic guest; no original/gameplay' }));
  for (const options of [{}, { chain: true }, { fusion: true }, { chain: true, fusion: true }]) {
    const f = await execute('', options);
    const off = await execute('', { ...options, unarmed: true });
    check('causal drain/event4/state1 returns ' + JSON.stringify(options), () => {
      assert.equal(f.error, undefined); assert.equal(f.status.status, 'COMPLETE', JSON.stringify(f.status));
      assert.equal(f.reports.length, 1); assert.equal(f.e.get_eax() >>> 0, 0x12345678);
      assert.equal(f.e.get_esp() >>> 0, STACK + 4); assert.equal(f.rd(MARK), 1);
      assert.equal(f.status.consume.timestamp, STAMP); assert.equal(f.status.consume.sequence, 9);
      assert.equal(f.e.get_dbg_tier_guard(), 0);
      assert.deepEqual(f.calls.map(x => x.args[1]), [7, 2, 3, 4, 5, 6]);
      assert.equal(f.calls.length, f.originalCalls);
      assert.deepEqual(f.schedule, off.schedule, 'same budget, PC, ESP and EAX at every ordinary run boundary');
      assert.deepEqual(f.calls.map(x => x.args), off.calls.map(x => x.args), 'no extra input polls');
      assert(f.calls.every(x => x.receiver === undefined), 'actual Wasm import receiver');
    });
    let forwards = 0, notifications = 0;
    const receiver = {}, ret = {};
    const wrapped = f.o.wrap(function (...args) {
      forwards++; assert.equal(this, receiver); assert.deepEqual(args, [ret, 7]); return ret;
    }, () => notifications++);
    check('native wrapper receiver/args/return exact once', () => {
      assert.equal(wrapped.call(receiver, ret, 7), ret);
      assert.equal(wrapped.call(receiver, ret, 7), ret);
      assert.equal(forwards, 2); assert.equal(notifications, 0); assert.equal(f.reports.length, 1);
    });
    const sentinel = {};
    check('native wrapper exception identity exact once + sticky UNKNOWN', () => {
      assert.throws(() => f.o.wrap(function () { forwards++; throw sentinel; })(), err => err === sentinel);
      assert.equal(forwards, 3); assert.equal(f.o.snapshot().status, 'UNKNOWN');
      assert.equal(wrapped.call(receiver, ret, 7), ret); assert.equal(notifications, 0);
    });
  }
  const second = await execute('second-list');
  check('natural second object-list dispatch', () => assert.equal(second.status.status, 'COMPLETE'));
  const otherFirst = await execute('other-actor-first');
  check('shared handler for another actor cannot replace the selected owner', () => assert.equal(otherFirst.status.status, 'COMPLETE'));
  const compiled = await execute('uop');
  const compiledOff = await execute('uop', { unarmed: true });
  check('precompiled CALL/RET observes completion without cache flush/tier change', () => {
    assert.equal(compiled.error, undefined); assert.equal(compiled.status.status, 'COMPLETE', JSON.stringify(compiled.status));
    assert(compiled.e.uop_stats(4) > 0, 'real native tier entry');
    assert.equal(compiled.e.get_dbg_tier_guard(), 0);
    const counts = new Uint32Array(compiled.e.memory.buffer, compiled.e.get_handler_hist_base(), compiled.e.get_handler_hist_slots());
    const table = fs.readFileSync(path.join(ROOT, 'src/02-thread-table.wat'), 'utf8');
    const funcs = [...table.matchAll(/(\$th_[A-Za-z0-9_]+)\s*;;\s*(\d+)\b/g)];
    const ordinary = name => counts[Number(funcs.find(m => m[1] === name)[2])];
    assert(ordinary('$th_call_rel') < 12, 'state1 CALLs ran as uops');
    assert(ordinary('$th_ret') < 14, 'state1 RETs ran as uops');
    assert.deepEqual(compiled.schedule, compiledOff.schedule);
    assert.equal(compiled.e.uop_gen(), compiledOff.e.uop_gen(), 'no observer cache flush');
    assert.equal(compiled.e.uop_stats(4), compiledOff.e.uop_stats(4), 'same native tier entries');
  });
  if (process.env.DRAKAN_RETAINED_WASM) {
    const retained = fs.readFileSync(process.env.DRAKAN_RETAINED_WASM);
    assert.equal(crypto.createHash('sha256').update(retained).digest('hex'),
      '6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0');
    for (const mode of ['', 'uop']) {
      const current = await execute(mode, { unarmed: true });
      const old = await execute(mode, { unarmed: true, moduleBytes: retained });
      check('disabled architectural and policy parity against retained 6cf ' + (mode || 'ordinary'), () => {
        assert.equal(old.error, undefined); assert.deepEqual(current.schedule, old.schedule);
        assert.deepEqual(current.calls.map(x => x.args), old.calls.map(x => x.args));
        assert.equal(current.e.uop_stats(4), old.e.uop_stats(4));
        assert.equal(old.e.drakan_actor_observer_version, undefined, 'old bytes are not repaired');
      });
    }
  }
  for (const mode of ['same-drain', 'skip-drain', 'skip-sim', 'early-actor', 'wrong-event', 'wrong-actor',
    'release-in-state', 'wrong-timestamp', 'forged-return', 'no-consume', 'overflow', 'buffer-throw']) {
    const f = await execute(mode);
    check('rejects ' + mode, () => {
      assert.notEqual(f.status.status, 'COMPLETE'); assert.equal(f.reports.length, 0);
      if (mode === 'buffer-throw') assert.equal(f.error, f.sentinel);
      if (['same-drain', 'early-actor', 'wrong-event', 'wrong-actor', 'release-in-state', 'wrong-timestamp',
        'forged-return', 'no-consume', 'overflow', 'buffer-throw'].includes(mode))
        assert.equal(f.status.status, 'UNKNOWN', JSON.stringify(f.status));
    });
  }
  for (const mode of ['owner', 'owner-process', 'owner-endpoint', 'owner-slot', 'owner-epoch', 'owner-moduleSha256',
    'module', 'stale', 'future', 'deadline', 'upstream', 'released', 'pin', 'changed-code',
    'budget', 'thread', 'link', 'rearm', 'raw-uop', 'reload']) {
    const f = await fixture(); let opts = {};
    if (mode === 'owner') f.sample.owner.worker = 'foreign';
    if (mode.startsWith('owner-')) f.sample.owner[mode.slice(6)] = 'foreign';
    if (mode === 'module') opts.expectedSha256 = '0'.repeat(64);
    if (mode === 'stale') f.sample.now = 1101;
    if (mode === 'future') f.sample.observedAt = 101;
    if (mode === 'deadline') f.sample.now = 2100;
    if (mode === 'upstream') f.sample.unknown = true;
    if (mode === 'released') f.sample.downActive = false;
    if (mode === 'pin') f.pins.actor.bytes[0] ^= 1;
    if (mode === 'budget') opts.budget = 1;
    const o = f.create(opts);
    if (mode === 'changed-code') f.u(B + 0x4c310, 0);
    if (mode === 'thread') f.e.set_current_thread_id(2);
    if (mode === 'link') f.u(ACTOR + 0x58, OBJ + 16);
    if (mode === 'rearm') assert.equal(f.e.drakan_actor_observer_arm(B, OBJ, ACTOR, STAMP, 100), 0);
    if (mode === 'raw-uop') {
      // The diagnostic export is a coverage gap even with a real compiled PC.
      f.e.set_uop(1); f.put(0x403000, [0x40, 0x49, 0x75, 0xfc, 0xc3]);
      const pc = f.e.uop_compile(0x403000); assert(pc);
      f.e.uop_run(pc + 48, 0);
    }
    if (mode === 'reload') {
      const pe = fs.readFileSync(path.join(ROOT, 'test/binaries/notepad.exe'));
      f.mem.set(pe, f.e.get_staging()); f.e.load_pe(pe.length);
    }
    let forwarded = 0;
    const wrapped = o.wrap(function (v) { forwarded++; return v; });
    if (['budget', 'thread', 'link'].includes(mode)) f.e.run(3);
    check('sticky UNKNOWN ' + mode, () => {
      assert.equal(wrapped(42), 42); assert.equal(forwarded, 1); assert.equal(o.snapshot().status, 'UNKNOWN');
      f.sample.owner = { ...f.owner }; f.sample.now = 100; f.sample.observedAt = 100;
      f.sample.downActive = true; f.sample.unknown = false;
      assert.equal(o.snapshot().status, 'UNKNOWN');
    });
  }
  for (const mode of ['process', 'root']) {
    const f = await fixture(), o = f.create();
    const ctx = { exports: null, getMemory: () => f.e.memory.buffer }, host = createHostImports(ctx).host;
    Object.assign(host, { memory: f.e.memory, log() {}, log_i32() {}, exit() {} });
    const { instance } = await WebAssembly.instantiate(bytes, { host });
    const other = ctx.exports = instance.exports;
    if (mode === 'root') other.init_thread(0, f.e.get_image_base(), 0, 0, 0, 0, 0, 0);
    else {
      const pe = fs.readFileSync(path.join(ROOT, 'test/binaries/notepad.exe'));
      f.mem.set(pe, other.get_staging()); other.load_pe(pe.length);
    }
    check('native shared ' + mode + ' invalidates unchanged owner globals', () => {
      assert.equal(f.e.get_current_thread_id(), 1);
      assert.equal(f.e.drakan_actor_observer_get(0), -1);
      assert.equal(f.e.drakan_actor_observer_get(1), 2);
      assert.equal(o.snapshot().status, 'UNKNOWN');
    });
  }
  // Freeze before the state1 RET: the side effect is not a completed return.
  const f = await fixture(), o = f.create();
  const run = o.wrap(f.e.run);
  for (let i = 0; i < 30 && f.e.drakan_actor_observer_get(0) !== 7; i++) run(1);
  check('state1 entry alone remains pending', () => {
    assert.equal(f.e.drakan_actor_observer_get(0), 7); assert.equal(o.snapshot().status, 'PENDING');
  });
  const forwarding = await fixture(), forwardObserver = forwarding.create();
  const receiver = {}, returned = {}, sentinel = {};
  let calls = 0;
  const importWrapper = forwardObserver.wrapKeyboardBuffer(function (...args) {
    calls++; assert.equal(this, receiver); assert.deepEqual(args, [forwarding.entry, 99, 4, 'extra']); return returned;
  });
  check('buffer import preserves receiver/all args/return and single forwarding', () => {
    assert.equal(importWrapper.call(receiver, forwarding.entry, 99, 4, 'extra'), returned); assert.equal(calls, 1);
  });
  check('buffer import preserves exception identity and forwards after UNKNOWN', () => {
    assert.throws(() => forwardObserver.wrapKeyboardBuffer(function () { calls++; throw sentinel; })(), ex => ex === sentinel);
    assert.equal(forwardObserver.snapshot().status, 'UNKNOWN');
    assert.equal(importWrapper.call(receiver, forwarding.entry, 99, 4, 'extra'), returned);
    assert.equal(calls, 3);
  });
  const callbackFailure = await execute('');
  // A completed observer has already delivered once; observer callbacks cannot
  // be used to replay that notification through another wrapper.
  let completedAgain = 0, forwardedAgain = 0;
  const again = callbackFailure.o.wrap(() => { forwardedAgain++; return 71; }, () => { completedAgain++; throw {}; });
  check('completion deduplication spans wrappers', () => {
    assert.equal(again(), 71); assert.equal(forwardedAgain, 1); assert.equal(completedAgain, 0);
  });
  run(1);
  check('state1 return alone still needs owner actor/event/simulation returns', () => {
    assert.equal(f.e.drakan_actor_observer_get(0), 8); assert.equal(o.snapshot().status, 'PENDING');
  });
  console.log(JSON.stringify({ passed: checks, failed: 0, noBrowser: true, noOriginal: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
