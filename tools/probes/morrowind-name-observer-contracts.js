'use strict';
// Source-only contracts. No wasm module or original guest is executed.
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const { readPE } = require('../../lib/pe');
const filename = require.resolve('../../lib/morrowind-name-observer');
const { install } = require(filename);
const exeBytes = fs.readFileSync(process.argv[2]);
const pe = readPE(exeBytes);
const runner = fs.readFileSync(path.join(__dirname, '../../test/run.js'), 'utf8');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const hookSources = {
  api: runner.slice(runner.indexOf('  h.log = (ptr, len) => {'), runner.indexOf('  let prevBlockEsp')),
  exit: runner.slice(runner.indexOf("  if (ESP_DELTA || TRACE_API || TRACE_CRITICAL || hasFlag('observe-morrowind-name'))"),
    runner.indexOf('  // --- Override exit to also log ---')),
};
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }
function fixture(installer = install, options = {}) {
  const memory = new Map(), records = [], reads = [];
  const backing = new ArrayBuffer(1024 * 1024), offsets = new Map();
  let nextOffset = 256;
  const r = { eax: 0, esp: 0x7401000, ecx: 0, esi: 0x5000000, thread: 1 };
  const e = { get_image_base: () => options.base || 0x400000,
    set_trace_eip_range: (...a) => { e.range = a; }, set_api_log: x => { e.apiLog = x; },
    get_current_thread_id: () => r.thread };
  for (const name of ['eax', 'esp', 'ecx', 'esi']) e['get_' + name] = () => r[name];
  function put(p, bytes) { for (let i = 0; i < bytes.length; i++) {
    memory.set(p + i, bytes[i]);
    if (offsets.has(p + i)) new Uint8Array(backing)[offsets.get(p + i)] = bytes[i];
  } }
  function u32(p, value) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); put(p, b); }
  function mapAddress(p) {
    reads.push([p, 1]);
    if (!offsets.has(p)) {
      const off = pe.va2off(p);
      if (!memory.has(p) && off < 0) return 0xf0;
      const offset = nextOffset++;
      assert(offset < backing.byteLength);
      offsets.set(p, offset);
      new Uint8Array(backing)[offset] = memory.has(p) ? memory.get(p) : exeBytes[off];
      if (options.corruptLoaded && p === 0x406923) new Uint8Array(backing)[offset] ^= 1;
    }
    return offsets.get(p);
  }
  const host = {}, logs = [];
  const context = { hasFlag: name => name === 'observe-morrowind-name' && options.enabled !== false,
    h: host, morrowindNameObserver: null, TRACE_EIP_RANGE: options.trace || null,
    instance: { exports: e }, memory: { buffer: backing }, exeBytes,
    Buffer, logs, apiNameCache: new Map(), pendingComApiId: -1,
    apiTable: [{ id: 0, name: 'IDirectInputDevice_GetDeviceData' }], apiCount: 0, apiCounts: null,
    TRACE_API: false, TRACE_CRITICAL: false, TRACE_INPUT_DISPATCH: false, TRACE_API_MEM: [],
    ESP_DELTA: false, QUIET_API: true, breakApis: [], criticalTracePending: null, lastApiName: null,
    require: name => {
      assert.equal(name, '../lib/morrowind-name-observer'); return { install: installer };
    }, translateGuest: mapAddress };
  // Execute the exact production installation statements, including their
  // default-off guard. Record the only transformation: isolation by markers.
  for (const marker of ['IMPORT', 'ATTACH']) {
    const begin = runner.indexOf('// MORROWIND_NAME_' + marker + '_BEGIN');
    const end = runner.indexOf('// MORROWIND_NAME_' + marker + '_END');
    assert(begin > 0 && end > begin);
    vm.runInNewContext(runner.slice(begin, end), context, { filename: 'production-runner-' + marker });
    if (marker === 'IMPORT') {
      // WebAssembly instantiation retains this exact import function.
      context.importedEip = host.log_eip;
    }
  }
  vm.runInNewContext(hookSources.api, context, { filename: 'production-runner-api-hooks' });
  vm.runInNewContext(hookSources.exit, context, { filename: 'production-runner-exit-hook' });
  function sync() {
    while (logs.length) records.push(JSON.parse(logs.shift().slice('[morrowind-name] '.length)));
  }
  function apiEnter(name = 'IDirectInputDevice_GetDeviceData') {
    context.apiTable[0].name = name;
    new Uint8Array(context.memory.buffer).set(Buffer.from('<ord>\0'));
    context.h.log_i32(0xc0de0000); // Real production ordinal decoding path.
    context.h.log(0, 5); sync();
  }
  function apiExit() {
    context.h.log_api_exit(); sync();
  }
  function hit(pc) { context.importedEip(pc); sync(); }
  const target = 0x4101000, stack = 0x7401000;
  function setText(s) { const bytes = Buffer.from(s); u32(target + 0x168, 0x4200000);
    u32(target + 0x16c, bytes.length); put(0x4200000, bytes); }
  function builder() { r.eax = target; hit(0x5e672d); setText('|'); }
  function poll({ hr = 0, count = 1, scan = 0x20, thread, wrong = false, caller = 0x58072b } = {}) {
    r.esp = stack;
    [0x406926, 0x4300000, wrong ? 16 : 20, stack + 28, stack + 24, 0, 1,
      scan, 0x80, 100, 42, 0].forEach((v, i) => u32(stack + 4 * i, v));
    u32(stack + 48, caller);
    apiEnter();
    if (thread) r.thread = thread;
    r.esp = stack + 24; r.eax = hr; u32(stack + 24, count);
    apiExit(); hit(0x406926);
  }
  function translate(character = 100) { r.eax = character; u32(r.esi + 0x84, 0);
    u32(r.esi + 0x9c, 0); u32(r.esi + 0x70, target); hit(0x5807c2); }
  function callback(pointer = target) {
    r.esp = stack + 0x100;
    [0x581100, 0x4400000, 0xffff803e, r.eax, 0, pointer].forEach((v, i) => u32(r.esp + i * 4, v));
    hit(0x638050);
  }
  function setter(s) { r.esp = stack + 0x200; u32(r.esp, 0x6385eb); r.ecx = target;
    hit(0x5726c0); setText(s); r.esp += 20; hit(0x6385eb); }
  sync();
  return { r, e, target, stack, records, reads, u32, put, hit, poll, translate, callback,
    builder, setter, setText, apiEnter, apiExit, observer: context.morrowindNameObserver };
}

// First behavioral group: exact production attach/import fragments, including
// initializer-time availability. This is not a full runner execution receipt.
check(runner.indexOf('MORROWIND_NAME_IMPORT_BEGIN') < runner.indexOf('const instance = await WebAssembly.instantiate'), 'import before instantiate');
check(runner.indexOf('MORROWIND_NAME_ATTACH_END') < runner.indexOf('callDllMain(ex,'), 'attach before DLL initializer route');
check(runner.includes('if (morrowindNameObserver) morrowindNameObserver.apiEnter(t);'), 'resolved API wiring');
check(runner.includes('if (morrowindNameObserver) morrowindNameObserver.apiExit();'), 'API completion wiring');
const disabled = fixture(install, { enabled: false });
check(disabled.observer === null && disabled.e.range === undefined && disabled.records.length === 0, 'production disabled path');
check(disabled.reads.length === 0 && disabled.e.apiLog === undefined, 'disabled has no memory reads or hook arming');
check(install({ enabled: false }) === null, 'disabled avoids all initialization');
const f = fixture();
f.builder(); f.poll(); f.translate(); f.callback(); f.setter('Codex|');
check(f.records.some(x => x.kind === 'poll-completion' && x.validEvent && x.event[0] === 0x20 && x.beforeNextGuestInstruction), 'matching completion');
check(f.records.some(x => x.kind === 'name-callback'), 'matching Name callback');
check(f.records.find(x => x.kind === 'setter-after').text.hex === Buffer.from('Codex|').toString('hex'), 'setter output');
check(f.records.find(x => x.kind === 'setter-before').pc === 0x5726c0, 'honest pre-setter location');
f.setText('cox|'); f.poll();
check(f.records.some(x => x.kind === 'later-text-sample' && x.changed && x.firstWriter === null), 'overwrite sample has no fabricated writer');

function stale(installer, hr, count) {
  const q = fixture(installer); q.builder(); q.poll({ hr, count }); q.translate(); q.callback();
  const result = q.records.find(x => x.kind === 'poll-completion');
  assert.equal(result.validEvent, false, 'stale record must not be valid');
  assert.equal(result.event, null);
  assert(!q.records.some(x => x.kind === 'name-callback'));
  // Reads of record words only happen on success/count1, never stale data.
  assert(!q.reads.some(([p]) => p >= q.stack + 28 && p < q.stack + 48));
}
for (const [hr, count] of [[0x8007001e, 1], [1, 1], [0, 0], [0, 2]]) stale(install, hr, count);
for (const options of [{ wrong: true }, { thread: 2 }, { caller: 0x5adc52 }]) {
  const q = fixture(); q.builder(); q.poll(options); q.translate(); q.callback();
  check(!q.records.some(x => x.kind === 'name-callback'), 'wrong invocation/thread');
}
{
  const q = fixture(); q.builder(); q.poll(); q.hit(0x406926); q.translate(); q.callback();
  check(!q.records.some(x => x.kind === 'name-callback'), 'duplicate return boundary cannot reuse invocation');
}
{
  const q = fixture(); q.builder(); q.poll(); q.hit(0x406900); q.translate(); q.callback();
  check(!q.records.some(x => x.kind === 'name-callback'), 'new poll block invalidates old completion even when API logging stops');
}
{
  const q = fixture(); q.builder(); q.poll(); q.hit(0x637d30); q.translate(); q.callback();
  check(!q.records.some(x => x.kind === 'name-callback'), 'observed submission ends target generation');
}
{
  const q = fixture(); q.builder();
  q.r.esp = q.stack;
  [0x406926, 0x4300000, 20, q.stack + 28, q.stack + 24, 0, 1, 0x20, 0x80, 100, 42, 0]
    .forEach((v,i) => q.u32(q.stack + 4*i,v));
  q.u32(q.stack + 48, 0x58072b);
  q.apiEnter();
  q.r.esp -= 64; q.u32(q.r.esp, 0x400100); q.apiEnter('UnrelatedNestedAPI'); q.apiExit();
  q.r.esp = q.stack + 24; q.r.eax = 0; q.apiExit(); q.hit(0x406926);
  check(q.records.filter(x => x.kind === 'poll-completion').length === 1, 'nested API exit cannot steal invocation');
}
{
  const q = fixture(); q.builder(); q.poll(); q.translate(); q.callback(q.target + 4);
  check(!q.records.some(x => x.kind === 'name-callback'), 'wrong target');
  q.builder(); q.translate(); q.callback();
  check(!q.records.some(x => x.kind === 'name-callback'), 'new builder lifetime invalidates old delivery');
}
{
  const q = fixture(); q.builder(); q.poll();
  // New unmatched invocation must invalidate the old delivery.
  q.r.esp = q.stack; q.u32(q.stack, 0x406926); q.u32(q.stack + 8, 16); q.apiEnter();
  q.r.esp += 24; q.apiExit(); q.hit(0x406926); q.translate(); q.callback();
  check(!q.records.some(x => x.kind === 'name-callback'), 'wrong latest invocation cannot reuse prior completion');
}
{
  const q = fixture(); q.builder(); q.poll(); q.translate(); q.setText('a'.repeat(100)); q.callback();
  const text = q.records.find(x => x.kind === 'name-callback').text;
  check(text.length === 100 && text.hex.length === 62 && text.truncated, 'bounded text31');
}
for (const [pointer, length] of [[0, 1], [0xfffffff0, 32], [0x4200000, 0x100001]]) {
  const q = fixture(); q.builder(); q.poll(); q.translate();
  q.u32(q.target + 0x168, pointer); q.u32(q.target + 0x16c, length); q.callback();
  check(q.records.some(x => x.kind === 'unavailable'), 'invalid pointer/length');
}
{
  const q = fixture(); q.builder(); q.poll(); q.translate(); q.callback(); q.hit(0x6385ff);
  check(q.records.some(x => x.kind === 'rejection-or-epilogue' && x.warning), 'shared rejection epilogue');
}
{
  const q = fixture(); q.builder(); for (let i = 0; i < 100; i++) q.poll();
  check(q.records.length === 128 && q.records.at(-1).kind === 'overflow', 'bounded explicit overflow');
  q.builder(); check(q.records.length === 128, 'observation stops after overflow');
}
assert.throws(() => fixture(install, { base: 0x500000 }), /relocation unsupported/);
assert.throws(() => fixture(install, { trace: '0x400000-0x700000' }), /conflicts/);
assert.throws(() => fixture(install, { corruptLoaded: true }), /loaded code\/relocation identity/);
{
  const badSource = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => name !== 'fs' ? require(name) : { readFileSync: () => Buffer.from('wrong source') },
    module: badSource, Buffer, __dirname: path.dirname(filename),
  }, { filename });
  assert.throws(() => fixture(badSource.exports.install), /source identity/);
}
{
  const wrong = Buffer.from(exeBytes); wrong[0] ^= 1;
  assert.throws(() => install({ enabled: true, exeBytes: wrong }), /executable identity/);
}
// Rejecting mutation: allow failed HRESULTs to publish stale returned records.
const mutant = { exports: {} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8').replace('hresult === 0 && returnedCount === 1', 'returnedCount === 1'),
  { require, module: mutant, Buffer, __dirname: path.dirname(filename) }, { filename });
assert.throws(() => stale(mutant.exports.install, 0x8007001e, 1), /stale record must not be valid/);

function trace(scans, overwrite) {
  const q = fixture(); q.builder(); let name = '';
  for (const [scan, char] of scans) { q.poll({ scan }); q.translate(char.charCodeAt(0)); q.callback();
    name += char; q.setter(name + '|'); }
  if (overwrite) q.setText('cox|');
  q.poll({ count: 0 }); return q.records;
}
const delivered = [[0x2e, 'C'], [0x18, 'o'], [0x20, 'd'], [0x12, 'e'], [0x2d, 'x']];
const full = trace(delivered, false), missing = trace(delivered.filter(([scan]) => scan !== 0x20), false), overwritten = trace(delivered, true);
check(full.filter(x => x.kind === 'name-callback').length === 5, 'ordered delivered5');
check(missing.filter(x => x.kind === 'name-callback').length === 4 && !missing.some(x => x.event && x.event[0] === 0x20), 'missing d absent at API contract');
check(overwritten.filter(x => x.kind === 'name-callback').length === 5 && overwritten.some(x => x.kind === 'later-text-sample' && x.changed), 'complete then changed distinct from missing');
console.log(JSON.stringify({ pass: true, assertions, negativeMutationRejected: true,
  runnerSHA256: hash(runner), observerSHA256: hash(fs.readFileSync(filename)),
  transformation: 'exact production IMPORT/ATTACH/API/log_i32/exit source slices isolated in vm; initializer ordering source-checked',
  hookHashes: Object.fromEntries(Object.entries(hookSources).map(([k,v]) => [k, hash(v)])),
  fullProductionRunnerExecuted: false, guestExecuted: false,
  controls: ['stale HRESULT/countzero/count2', 'wrong invocation/thread/target/lifetime', 'pointer/length/truncation',
    'overflow', 'default off', 'ordered delivered', 'missing d', 'complete then changed, writer unknown'] }));
