'use strict';
// Public observer hooks only: synthetic registers/memory, never guest execution.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'lib/morrowind-name-observer.js');
const source = fs.readFileSync(filename, 'utf8');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(source), 'a2bbe6d15de3fc46d65f6e72e365e82cd223b5db5486dc3cdbc585aad9d75799');
const exe = fs.readFileSync(process.argv[2]);
assert.equal(exe.length, 3907584);
assert.equal(hash(exe), 'f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676');
// Independent minimal PE section mapping; anchors come from the real pinned EXE.
const pe = exe.readUInt32LE(0x3c), sectionCount = exe.readUInt16LE(pe + 6);
const sectionStart = pe + 24 + exe.readUInt16LE(pe + 20);
function imageRead(va, n) {
  const rva = va - 0x400000;
  for (let i = 0; i < sectionCount; i++) {
    const s = sectionStart + i * 40, start = exe.readUInt32LE(s + 12);
    const rawSize = exe.readUInt32LE(s + 16), raw = exe.readUInt32LE(s + 20);
    if (rva >= start && rva + n <= start + rawSize) return exe.subarray(raw + rva - start, raw + rva - start + n);
  }
  throw Error('unmapped image read');
}
const production = require(filename).install;
function fixture(install = production, options = {}) {
  const records = [], reads = [];
  const regions = [0x7400000, 0x4100000, 0x4200000, 0x5000000]
    .map(base => ({ base, bytes: Buffer.alloc(0x10000) }));
  const r = { thread: 1, esp: 0x7401000, eax: 0, ecx: 0, esi: 0x5000000 };
  let fault = false, sinkThrows = false;
  function area(p, n) {
    const a = regions.find(x => p >= x.base && p + n <= x.base + x.bytes.length);
    assert(a, 'bounded synthetic memory access'); return a;
  }
  function put(p, b) { const a = area(p, b.length); b.copy(a.bytes, p - a.base); }
  function u32(p, x) { const b = Buffer.alloc(4); b.writeUInt32LE(x >>> 0); put(p, b); }
  function read(p, n) {
    assert(n <= 31, 'bounded observer read'); reads.push([p, n]);
    if (fault) throw Error('injected read failure');
    if (p >= 0x400000 && p < 0x800000) return imageRead(p, n);
    const a = area(p, n); return a.bytes.subarray(p - a.base, p - a.base + n);
  }
  const e = { get_image_base: () => 0x400000, get_current_thread_id: () => r.thread,
    set_api_log: x => { e.apiLog = x; }, set_trace_eip_range: (...x) => { e.range = x; } };
  for (const k of ['eax', 'esp', 'ecx', 'esi']) e['get_' + k] = () => r[k];
  const observer = install({ enabled: true, exeBytes: exe, exports: e, read,
    emit: x => { if (sinkThrows) throw Error('injected sink failure'); records.push(x); } });
  const stack = 0x7401000, target = 0x4101000;
  function text(value, pointer = target) { const b = Buffer.from(value); put(0x4200000, b);
    u32(pointer + 0x168, 0x4200000); u32(pointer + 0x16c, b.length); }
  const hit = pc => observer.onEip(pc);
  function builder(pointer = target) { r.eax = pointer; hit(0x5e672d); text('|', pointer); }
  function enter(o = {}) {
    r.esp = o.stack || stack;
    const values = [o.ret === undefined ? 0x406926 : o.ret, o.device === undefined ? 0x4300000 : o.device,
      o.stride || 20, r.esp + 28, r.esp + 24, o.flags || 0, 1, 0x20, 0x80, 100, 42, 0];
    values.forEach((v, i) => u32(r.esp + i * 4, v)); u32(r.esp + 48, o.caller || 0x58072b);
    if (o.countPointer) u32(r.esp + 16, o.countPointer);
    if (o.data) u32(r.esp + 12, o.data);
    observer.apiEnter(o.name || 'IDirectInputDevice_GetDeviceData');
  }
  function complete(o = {}) { r.esp = (o.stack || stack) + 24 + (o.espDelta || 0);
    r.eax = o.hr || 0; u32((o.stack || stack) + 24, o.count === undefined ? 1 : o.count);
    observer.apiExit(); if (o.boundary !== false) hit(0x406926); }
  function poll(o = {}) { enter(o); complete(o); }
  function translate(c = 65) { r.eax = c; u32(r.esi + 0x84, 0); u32(r.esi + 0x9c, 0);
    u32(r.esi + 0x70, target); hit(0x5807c2); }
  function callback(o = {}) { r.esp = stack + 0x100;
    [0x581100, 0x4400000, o.message || 0xffff803e, o.character === undefined ? 65 : o.character,
      0, o.target || target].forEach((x, i) => u32(r.esp + i * 4, x)); hit(0x638050); }
  function setterBefore(o = {}) { r.esp = stack + 0x200; u32(r.esp, o.ret || 0x6385eb);
    r.ecx = o.target || target; hit(0x5726c0); }
  function setterAfter(delta = 20) { r.esp = stack + 0x200 + delta; hit(0x6385eb); }
  const kinds = kind => records.filter(x => x.kind === kind);
  return { r, e, observer, records, reads, stack, target, hit, u32, text, builder, enter,
    complete, poll, translate, callback, setterBefore, setterAfter, kinds,
    fault: () => { fault = true; }, sinkFault: () => { sinkThrows = true; } };
}
const results = [];
function test(name, fn) { fn(); results.push(name); }
function delivered(f) { f.builder(); f.poll(); f.translate(); f.callback(); }
function noCallback(f) { f.translate(); f.callback(); assert.equal(f.kinds('name-callback').length, 0); }

// Earliest in-scope production boundary: unchanged exported install, real identities.
test('exact-install-positive-setter-ret0x10', () => {
  const f = fixture(); assert.equal(f.e.apiLog, 1); assert.equal(f.kinds('installed').length, 1);
  delivered(f); f.setterBefore(); f.text('A|'); f.setterAfter();
  const c = f.kinds('poll-completion')[0], cb = f.kinds('name-callback')[0];
  assert(c.validEvent && c.beforeNextGuestInstruction); assert.equal(c.invocation, cb.invocation);
  assert.equal(f.kinds('setter-before')[0].pc, 0x5726c0);
  assert.equal(f.kinds('setter-after')[0].text.hex, '417c');
});
for (const [hr, count] of [[0x8007001e, 1], [1, 1], [0, 0], [0, 2], [0, 0xffffffff]]) {
  test(`invalid-event-${hr}-${count}`, () => {
    const f = fixture(); f.builder(); f.poll({ hr, count });
    const c = f.kinds('poll-completion')[0]; assert.equal(c.event, null); assert.equal(c.validEvent, false);
    assert(!f.reads.some(([p]) => p >= f.stack + 28 && p < f.stack + 48)); noCallback(f);
  });
}
test('nested-unrelated-api-does-not-steal-outer-completion', () => {
  const f = fixture(); f.builder(); f.enter(); f.enter({ stack: f.stack - 64, ret: 0x401000, name: 'GetTickCount' });
  f.complete({ stack: f.stack - 64, boundary: false }); assert.equal(f.kinds('poll-completion').length, 0);
  f.complete(); f.translate(); f.callback(); assert.equal(f.kinds('name-callback').length, 1);
});
for (const options of [{ name: 'UnrelatedAPI' }, { device: 0 }, { stride: 16 }, { flags: 1 },
  { countPointer: 0x7401800 }, { data: 0x7401900 }, { ret: 0x401000 }, { caller: 0x401000 }]) {
  test('reject-call-form-' + JSON.stringify(options), () => { const f = fixture(); f.builder(); f.poll(options); noCallback(f); });
}
function wrongThread(install) {
  const f = fixture(install); f.builder(); f.enter(); f.r.thread = 2; f.complete(); noCallback(f);
  f.r.thread = 1; f.complete(); f.translate(); f.callback();
  assert.equal(f.kinds('name-callback').length, 1, 'owner thread can still complete its frame');
}
test('distinct-thread-cannot-complete-owner-frame', () => wrongThread(production));
test('nonowner-translation-and-callback-blocked', () => {
  const f = fixture(); f.builder(); f.poll(); f.r.thread = 2; noCallback(f);
});
test('owner-thread-two-positive', () => {
  const f = fixture(); f.r.thread = 2; delivered(f); f.setterBefore(); f.setterAfter();
  assert.equal(f.kinds('setter-after').length, 1);
  assert.equal(f.kinds('name-callback')[0].thread, 2);
});
test('nonowner-setter-blocked-after-valid-callback', () => {
  const f = fixture(); delivered(f); f.r.thread = 2; f.setterBefore(); f.setterAfter();
  assert.equal(f.kinds('setter-before').length, 0);
});
test('completion-without-return-boundary-cannot-authorize-callback', () => {
  const f = fixture(); f.builder(); f.poll({ boundary: false }); noCallback(f);
});
test('new-builder-during-outstanding-api-invalidates-completion', () => {
  const f = fixture(); f.builder(); f.enter(); f.builder(); f.complete();
  assert.equal(f.kinds('unmatched-completion').length, 1); noCallback(f);
});
test('two-devices-nested-invocations-retain-identity', () => {
  const f = fixture(); f.builder(); f.enter({ device: 0x4300100 });
  f.enter({ stack: f.stack - 64, device: 0x4300200 }); f.complete({ stack: f.stack - 64 });
  f.complete(); f.translate(); f.callback();
  const cs = f.kinds('poll-completion'); assert.equal(cs.length, 2);
  assert.notEqual(cs[0].invocation, cs[1].invocation); assert.equal(cs[0].device, 0x4300200);
  assert.equal(cs[1].device, 0x4300100); assert.equal(f.kinds('name-callback')[0].invocation, cs[1].invocation);
});
for (const delta of [-4, 4, 20]) test('stale-completion-esp-' + delta, () => {
  const f = fixture(); f.builder(); f.poll({ espDelta: delta }); assert.equal(f.kinds('unmatched-completion').length, 1); noCallback(f);
});
for (const change of ['esp', 'eax', 'repeat', 'new-poll', 'new-invalid-invocation']) test('stale-return-token-' + change, () => {
  const f = fixture(); f.builder(); f.poll({ boundary: false });
  if (change === 'esp') f.r.esp += 4;
  if (change === 'eax') f.r.eax = 1;
  f.hit(0x406926);
  if (change === 'repeat') f.hit(0x406926);
  if (change === 'new-poll') f.hit(0x406900);
  if (change === 'new-invalid-invocation') { f.enter({ stride: 16 }); f.complete(); }
  noCallback(f);
});
for (const mode of ['same-pointer-builder', 'other-pointer-builder', 'other-thread-builder', 'submission', 'alternate-submission']) {
  test('target-generation-' + mode, () => {
    const f = fixture(); delivered(f);
    if (mode.includes('builder')) { if (mode === 'other-thread-builder') f.r.thread = 2;
      f.builder(mode === 'other-pointer-builder' ? f.target + 0x1000 : f.target); }
    else f.hit(mode === 'submission' ? 0x637d30 : 0x5e6895);
    f.setterBefore(); f.setterAfter(); assert.equal(f.kinds('setter-before').length, 0);
  });
}
for (const options of [{ target: 0x4101004 }, { character: 66 }, { message: 0xffff803f }]) {
  test('callback-argument-' + JSON.stringify(options), () => { const f = fixture(); f.builder(); f.poll(); f.translate();
    f.callback(options); assert.equal(f.kinds('name-callback').length, 0); });
}
function singleUse(install) { const f = fixture(install); delivered(f); f.callback();
  assert.equal(f.kinds('name-callback').length, 1, 'one invocation authorizes one callback'); }
test('callback-token-consumed-once', () => singleUse(production));
for (const delta of [4, 16, 24]) test('setter-return-wrong-esp-' + delta, () => {
  const f = fixture(); delivered(f); f.setterBefore(); f.setterAfter(delta); assert.equal(f.kinds('setter-after').length, 0);
});
for (const options of [{ target: 0x4101004 }, { ret: 0x6385ec }]) test('setter-entry-mismatch-' + JSON.stringify(options), () => {
  const f = fixture(); delivered(f); f.setterBefore(options); f.setterAfter(); assert.equal(f.kinds('setter-before').length, 0);
});
test('callback-real-return-expires-setter-authority', () => {
  const f = fixture(); delivered(f); f.r.esp = f.stack + 0x104; f.hit(0x581100);
  f.setterBefore(); assert.equal(f.kinds('setter-before').length, 0);
});
test('later-sample-explicitly-no-arbitrary-writer', () => {
  const f = fixture(); delivered(f); f.setterBefore(); f.text('A|'); f.setterAfter();
  f.text('B|'); f.poll(); const s = f.kinds('later-text-sample')[0];
  assert(s.changed); assert.equal(s.firstWriter, null); assert.match(s.limitation, /unobserved/);
  assert.match(f.kinds('installed')[0].laterWriter, /unobserved/);
});
test('overflow-stops-at128', () => {
  const f = fixture(); for (let i = 0; i < 140; i++) f.builder();
  assert.equal(f.records.length, 128); assert.equal(f.records.at(-1).kind, 'overflow');
  const n = f.reads.length; f.poll(); assert.equal(f.reads.length, n);
});
test('throwing-read-emits-unavailable-and-stops', () => {
  const f = fixture(); f.builder(); f.fault(); f.enter(); assert.equal(f.kinds('unavailable').length, 1);
  const n = f.reads.length; f.enter(); f.hit(0x5e672d); assert.equal(f.reads.length, n);
});
test('throwing-sink-stops-without-escaping', () => {
  const f = fixture(); f.sinkFault(); f.builder(); const n = f.reads.length; f.enter();
  assert.equal(f.reads.length, n); assert.equal(f.records.length, 1);
});
function mutant(from, to) { assert.equal(source.split(from).length, 2, 'unique mutation site');
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m._compile(source.replace(from, to), filename); return m.exports.install; }
const mutations = [];
for (const [name, from, to, challenge] of [
  ['thread-identity-collapsed', 'const tid = () => e.get_current_thread_id() >>> 0;', 'const tid = () => 1;', wrongThread],
  ['delivered-token-reusable', 'polls.delete(thread); // A delivered record cannot authorize another callback.', '// MUTATION: leave delivered token reusable.', singleUse],
]) {
  let rejected = false; try { challenge(mutant(from, to)); } catch (e) {
    assert(e instanceof assert.AssertionError); rejected = true; mutations.push({ name, rejected: true, message: e.message }); }
  assert(rejected, 'challenge must reject ' + name);
}
console.log(JSON.stringify({ status: 'PASS_UNIT_SOURCE_BOUNDARY', candidate: 'efa0f32e9dbe7fac2c863737810755473cb458c6',
  observerSHA256: hash(source), exeSHA256: hash(exe), tests: results.length, cases: results, mutations,
  syntheticMemoryBytesPerFixture: 4 * 65536, wholeRunner: false, wasm: false, guest: false,
  quietArming: 'Known candidate defect remains REJECTED; direct hooks bypass runner dispatch for this separately scoped unit test only.' }, null, 2));
