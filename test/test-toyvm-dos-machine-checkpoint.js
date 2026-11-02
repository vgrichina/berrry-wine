'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const crypto = require('node:crypto');
const root = process.env.TOYVM_ROOT || path.join(__dirname, '..');
const { createMachineRunner, resumeMachineRunner } = require(path.join(root, 'tools/toyvm/run-dos'));
const native = require(path.join(root, 'tools/toyvm/checkpoint'));
const { STUB_SEG, STUB_OFF } = require(path.join(root, 'tools/toyvm/dos'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function compactArchive(bytes) {
  const record = v8.deserialize(v8.deserialize(bytes).body);
  record.native.memory = hash(record.native.memory);
  record.recipe.image = hash(record.recipe.image);
  record.recipe.files = record.recipe.files.map(([name, data]) => [name, hash(data)]);
  for (const node of record.host.nodes) if (node.type === 'buffer') node.bytes = hash(node.bytes);
  return record;
}
const canonical = value => JSON.stringify(value, (_, x) => typeof x === 'bigint'
  ? { bigint: x.toString() } : typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0))
    ? { number: Object.is(x, -0) ? '-0' : String(x) } : x instanceof Uint8Array || x instanceof Int32Array
      ? { view: x.constructor.name, bytes: hash(Buffer.from(x.buffer, x.byteOffset, x.byteLength)) } : x);
function sameArchive(a, b, label) { assert.deepEqual(compactArchive(a), compactArchive(b), label); }

// Independent instruction fixture. Fixups encode COM offsets, not runtime
// emulator results. All expected service values below are literal oracles.
function program() {
  const code = [], labels = {}, fixups = [];
  const emit = (...bytes) => code.push(...bytes);
  const word = x => emit(x & 255, x >>> 8 & 255);
  const mark = name => { labels[name] = 0x100 + code.length; };
  const addr = name => { fixups.push([code.length, name, false]); word(0); };
  const mov = (opcode, n) => { emit(opcode); word(n); };
  const movAddr = (opcode, name) => { emit(opcode); addr(name); };
  const call = name => { emit(0xe8); fixups.push([code.length, name, true]); word(0); };
  const store = name => movAddr(0xa3, name);
  emit(0xfa); // CLI: hold a genuine timer pending until after capture.
  emit(0x31, 0xc0, 0x8e, 0xc0, 0x26, 0xc7, 0x06, 0x20, 0); addr('irq');
  emit(0x8c, 0xc8, 0x26, 0xa3, 0x22, 0); // IVT[8] = real guest ISR
  mov(0xb8, 0x13); emit(0xcd, 0x10);
  mov(0xba, 0x3c8); emit(0xb0, 7, 0xee, 0x42, 0xb0, 11, 0xee); // one DAC component
  mov(0xba, 0x43); emit(0xb0, 0x36, 0xee); mov(0xba, 0x40); emit(0xb0, 0x34, 0xee); // partial PIT reload
  mov(0xb9, 0); movAddr(0xba, 'name'); mov(0xb8, 0x3c00); emit(0xcd, 0x21, 0x89, 0xc3);
  movAddr(0xba, 'data'); mov(0xb9, 5); mov(0xb8, 0x4000); emit(0xcd, 0x21);
  mov(0xb8, 0x4200); mov(0xb9, 0); mov(0xba, 1); emit(0xcd, 0x21);
  call('sub'); store('first');
  movAddr(0xba, 'read'); mov(0xb9, 2); mov(0xb8, 0x3f00);
  mark('readInt'); emit(0xcd, 0x21); // Capture at the REAL stub with an IRET frame.
  mark('afterRead'); store('readCount');
  emit(0x2e, 0xc7, 0x06); addr('immediate'); word(0x2222); // patch previously compiled code
  call('sub'); store('second');
  mov(0xba, 0x3c9); emit(0xb0, 22, 0xee, 0xb0, 33, 0xee);
  mov(0xba, 0x40); emit(0xb0, 0x12, 0xee); // finish saved low/high PIT state
  mov(0xba, 0x3c7); emit(0xb0, 7, 0xee); mov(0xba, 0x3c9);
  emit(0xec); movAddr(0xa2, 'rgb'); emit(0xec); movAddr(0xa2, 'green'); emit(0xec); movAddr(0xa2, 'blue');
  mov(0xb8, 0); emit(0xcd, 0x16); store('key');
  mov(0xb8, 0); emit(0xcd, 0x1a); emit(0x89, 0xd0); store('time');
  mov(0xb9, 64); emit(0x49, 0x75, 0xfd); // deterministic guest work crosses later input
  mov(0xb8, 0xa000); emit(0x8e, 0xc0, 0x26, 0xc6, 0x06, 0, 0, 7);
  movAddr(0xba, 'text'); mov(0xb8, 0x0900); emit(0xcd, 0x21);
  emit(0xfb, 0x90, 0x90); // pending timer may now cross the real STI shadow
  mov(0xb8, 0x4c2a); emit(0xcd, 0x21);
  mark('irq'); emit(0x2e, 0xff, 0x06); addr('timerCount'); emit(0xcf);
  mark('sub'); emit(0xb8); mark('immediate'); word(0x1111); emit(0xc3);
  mark('name'); emit(...Buffer.from('CHECK.DAT\0'));
  mark('data'); emit(...Buffer.from('ABCDE'));
  mark('text'); emit(...Buffer.from('CHECKPOINT OK$'));
  for (const name of ['first', 'second', 'readCount', 'read', 'key', 'time', 'timerCount']) { mark(name); word(0); }
  mark('rgb'); emit(0); mark('green'); emit(0); mark('blue'); emit(0);
  for (const [p, name, relative] of fixups) {
    const n = labels[name] - (relative ? 0x100 + p + 2 : 0);
    code[p] = n & 255; code[p + 1] = n >>> 8 & 255;
  }
  return { image: Uint8Array.from(code), labels };
}
const fixture = program();
const options = { image: fixture.image, name: 'CHECK.COM', budget: 3000,
  files: [['SEED.BIN', Uint8Array.from([9, 8, 7])]],
  machineOptions: { keys: [{ ah: 0x1e, al: 0x61 }] },
  // Timers cross while IF=0; the pending bit and partial hardware latches must
  // survive. Later inputs prove the runner's delivery cursor is restored too.
  sessionOptions: { slice: 7, intFast: false, pitClock: false, dispatchesPerTick: 1000000000,
    irqEvery: 10, stuckLimit: 0, smcCensus: true },
  inputs: [{ at: 0, ah: 0x30, al: 0x62 }, { at: 100, ah: 0x2e, al: 0x63 }] };
const lin = (r, label) => (r.machine.pspSeg << 4) + fixture.labels[label];
const u16 = (r, label) => new DataView(r.vm.mem.buffer).getUint16(lin(r, label), true);
function atRead(r) {
  return r.vm.get('cs') === STUB_SEG && r.vm.get('gip') === STUB_OFF + 0x21 && r.vm.get('ax') === 0x3f00;
}
function advanceToRead(r) {
  for (let i = 0; i < 1000 && !atRead(r); i++) {
    assert(!r.session.done); r.step();
  }
  assert(atRead(r), 'fixture must reach genuine DOS read handback');
  assert.equal(r.machine.files.get(5).pos, 1);
  assert.equal(r.machine.files.get(5).rec, r.machine.tempFiles.get('check.dat'));
  assert.equal(u16(r, 'first'), 0x1111);
  assert.equal(r.machine.dacSubIndex, 1);
  assert.equal(r.machine.pit.pending[0], 1);
  assert.equal(r.machine.pit.latch[0], 0x34);
  assert(r.session.timerPending, 'real dispatch schedule owes a timer while IF=0');
  assert(r.session.cache.regions.size > 0, 'compiled code is live');
  assert(r.session.dispatched > 0 && r.session.handbacks > 0);
  const at = (r.vm.get('ss') << 4) + r.vm.get('sp');
  assert.equal(new DataView(r.vm.mem.buffer).getUint16(at, true), fixture.labels.afterRead, 'live IRET continuation');
}
function finish(r) {
  for (let i = 0; i < 2000 && !r.session.done; i++) r.step();
  assert(r.machine.exited, 'fixture must exit through DOS');
  assert.equal(r.machine.exitCode, 42, 'independent DOS exit oracle');
  assert.equal(u16(r, 'readCount'), 2, 'DOS file service count');
  assert.equal(Buffer.from(r.vm.mem.subarray(lin(r, 'read'), lin(r, 'read') + 2)).toString(), 'BC', 'independent read oracle');
  assert.equal(r.machine.files.get(5).pos, 3);
  assert.equal(Buffer.from(r.machine.tempFiles.get('check.dat').data.subarray(0, 5)).toString(), 'ABCDE');
  assert.equal(u16(r, 'first'), 0x1111);
  assert.equal(u16(r, 'second'), 0x2222, 'compiled self-modifying continuation');
  assert(r.session.smcBreaks > 0, 'patch must cross the compiled-code invalidation path');
  assert.deepEqual(Array.from(r.vm.mem.subarray(lin(r, 'rgb'), lin(r, 'blue') + 1)), [11, 22, 33]);
  assert.equal(r.machine.pit.latch[0], 0x1234);
  assert.equal(r.machine.videoMode, 0x13); assert.equal(r.vm.mem[0xa0000], 7);
  assert.equal(u16(r, 'key'), 0x1e61);
  assert.deepEqual(r.machine.keys.map(k => k.al), [0x62, 0x63], 'runner input cursor and later delivery');
  assert.equal(u16(r, 'time'), 0, 'under 3000 dispatches cannot reach the billion-dispatch BIOS tick');
  assert(u16(r, 'timerCount') > 0, 'real guest timer ISR ran');
  assert.equal(r.machine.con.raw.map(x => String.fromCharCode(x)).join(''), 'CHECKPOINT OK');
  assert(r.session.irqs > 0, 'held hardware timer delivered after STI');
  return { time: u16(r, 'time'), dispatched: r.session.dispatched, handbacks: r.session.handbacks,
    stats: hash(canonical(r.session.stats())), checkpoint: hash(canonical(compactArchive(r.capture()))) };
}
function rewrite(bytes, change) {
  // V8 can expose views into its input buffer. Mutate a detached copy so the
  // negative case cannot silently corrupt the saved oracle used afterwards.
  const envelope = v8.deserialize(Buffer.from(bytes)), record = v8.deserialize(envelope.body);
  change(record); envelope.body = v8.serialize(record); envelope.sha256 = hash(envelope.body);
  return v8.serialize(envelope);
}
async function main() {
  const r = await createMachineRunner(options);
  assert.equal(Buffer.from(r.machine.readWholeFile('SEED.BIN')).toString('hex'), '090807');
  assert.throws(() => r.capture(), /handback/);
  advanceToRead(r);
  const saved = r.capture(), nativeOnly = native.snapshot(r.vm);
  const refs = { machine: r.machine, session: r.session, cache: r.session.cache,
    exports: r.vm.exports, mem: r.vm.mem, buffer: r.vm.mem.buffer, log: r.machine.log };
  const baseline = finish(r);
  if (process.argv.includes('--old-snapshot')) {
    native.restore(r.vm, nativeOnly);
    // Even allowing the incomplete approach to clear the terminal flags does
    // not rewind files, the DAC partial latch, queues or the host scheduler.
    r.machine.exited = false; r.machine.blockedOnKey = false;
    finish(r); assert.fail('native-only checkpoint unexpectedly passed');
  }
  // Destructive host rollback, beyond simply executing the continuation.
  r.machine.files.clear(); r.machine.tempFiles.clear(); r.machine.keys.length = 0;
  r.machine.kbQueue.length = 0; r.machine.palette.fill(0);
  r.machine.audio.dma.addr.fill(0xffff); r.machine.audio.opl.ops[0].phase = 0.75;
  r.machine.gus.dram.fill(0x5a); r.machine.pit.phase = 0.875;
  r.session.cache.flush(); r.session.dispatched = 900000;
  r.session.lastIrq = 888888; r.session.timerPending = false;
  r.restore(saved);
  assert.equal(r.machine, refs.machine); assert.equal(r.session, refs.session);
  assert.equal(r.session.cache, refs.cache); assert.equal(r.vm.exports, refs.exports);
  assert.equal(r.vm.mem, refs.mem); assert.equal(r.vm.mem.buffer, refs.buffer);
  assert.equal(r.machine.log, refs.log);
  assert.equal(r.machine.audio.m, r.machine); assert.equal(r.machine.gus.machine, r.machine);
  assert.equal(r.machine.con.mem, r.vm.mem);
  assert.equal(r.session.cache.jtab.buffer, r.vm.mem.buffer);
  assert.equal(r.session.cache.codeBits.buffer, r.vm.mem.buffer);
  assert.equal(r.machine.audio.opl.ch[0].op1, r.machine.audio.opl.ops[0]);
  assert.equal(r.machine.files.get(5).buf.buffer, r.machine.files.get(5).rec.data.buffer);
  sameArchive(r.capture(), saved, 'exact graph/native rollback');
  assert.deepEqual(finish(r), baseline);
  const fresh = await resumeMachineRunner(saved);
  assert.notEqual(fresh.machine, r.machine); assert.notEqual(fresh.vm.exports, r.vm.exports);
  sameArchive(fresh.capture(), saved, 'fresh exact identity round trip');
  assert.deepEqual(finish(fresh), baseline);
  {
    const before = native.snapshot(fresh.vm), dispatched = fresh.session.dispatched;
    Object.freeze(fresh.machine);
    assert.throws(() => fresh.restore(saved), /unsupported destination root/);
    assert.throws(() => fresh.capture(), /unsupported destination root/);
    const after = native.snapshot(fresh.vm);
    assert(Buffer.from(after.memory).equals(Buffer.from(before.memory)), 'frozen destination native RAM is atomic');
    before.memory = null; after.memory = null;
    assert.deepEqual(after, before, 'frozen destination globals/table are atomic');
    assert.equal(fresh.session.dispatched, dispatched);
    assert.equal(fresh.machine.exited, true);
  }
  r.restore(saved);
  assert.equal(r.step(), 'int', 'real DOS service handback');
  assert.equal(r.vm.get('cs'), r.machine.pspSeg);
  assert.equal(r.vm.get('gip'), fixture.labels.afterRead);
  assert.equal(r.vm.get('ax'), 2);
  assert.equal(r.machine.files.get(5).pos, 3);
  const afterService = r.capture();
  assert.deepEqual(finish(r), baseline);
  r.restore(afterService);
  assert.deepEqual(finish(r), baseline);
  r.restore(saved);
  let negatives = 0;
  const savedHash = hash(saved);
  const reject = bytes => {
    const before = r.capture(); assert.throws(() => r.restore(bytes));
    sameArchive(r.capture(), before, 'rejection must be atomic'); negatives++;
    assert.equal(hash(saved), savedHash, 'invalid fixture must not corrupt the saved oracle');
  };
  const broken = Buffer.from(saved); broken[broken.length - 20] ^= 1; reject(broken);
  reject(saved.subarray(0, saved.length - 1));
  for (const mutate of [
    x => { x.identity.sources[0][1] = 'bad'; },
    x => { x.identity.module = 'bad'; },
    x => { x.recipe.image[0] ^= 1; },
    x => { x.recipe.sessionOptions.slice++; },
    x => { x.native.moduleSha256 = 'bad'; },
    x => { x.native.memory = new Uint8Array(1); },
    x => { x.native.handlers[x.native.handlers.length - 1] = 'f$missing'; },
    x => { x.native.globals[x.native.globals.length - 1].value = 'bad'; },
    x => { x.host.nodes.push({ type: 'unknown' }); },
    x => { x.host.roots[3] = { node: 9999999 }; },
    x => { x.host.nodes.find(n => n.type === 'view').offset = -1; },
    x => {
      const cache = x.host.nodes.find(n => n.entries?.some(([k]) => k === 'jtab'));
      const view = cache.entries.find(([k]) => k === 'jtab')[1];
      x.host.nodes[view.node].offset += 4; // Valid view, incompatible native arena ABI.
    },
  ]) reject(rewrite(saved, mutate));
  const original = r.machine.audio.sink; r.machine.audio.sink = () => {};
  assert.throws(() => r.capture(), /unsupported/);
  assert.throws(() => r.restore(saved), /unsupported/); r.machine.audio.sink = original;
  const log = r.machine.log; r.machine.log = () => {};
  assert.throws(() => r.restore(saved), /unsupported/); r.machine.log = log;
  r.session.hooks.onInt = () => {};
  assert.throws(() => r.restore(saved), /unsupported/); delete r.session.hooks.onInt;
  r.session.cache.treeFold = {};
  assert.throws(() => r.restore(saved), /unsupported/); r.session.cache.treeFold = null;
  r.machine.fileRoot = '/tmp';
  assert.throws(() => r.restore(saved), /unsupported/); r.machine.fileRoot = null;
  sameArchive(r.capture(), saved, 'unsupported live-state rejection');
  await assert.rejects(createMachineRunner({ ...options, image: Uint8Array.from([0x90, 0xcd, 0x20]),
    machineOptions: { fileRoot: '/tmp' } }), /unsupported/);
  if (process.env.CHECKPOINT_ARTIFACT) fs.writeFileSync(process.env.CHECKPOINT_ARTIFACT, saved);
  console.log(JSON.stringify({ passed: true, negatives, checkpointBytes: saved.length,
    originalAndFresh: true, realDosReadBoundary: true, literalServiceOracles: true,
    baseline, source: v8.deserialize(v8.deserialize(saved).body).identity }));
}
const task = process.env.CHECKPOINT_RESTORE
  ? resumeMachineRunner(fs.readFileSync(process.env.CHECKPOINT_RESTORE)).then(r => {
    assert(atRead(r));
    console.log(JSON.stringify({ recoveredInFreshProcess: true, baseline: finish(r) }));
  })
  : main();
task.catch(e => { console.error(e.stack || String(e)); process.exitCode = 1; });
