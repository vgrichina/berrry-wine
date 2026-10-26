'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const utility = require('../../../tools/thps2-exit-entry-observer.cjs');
const { EXPECTED: E, REGISTERS, createObserver, createFileObserver, transformRunner } = utility;

function fixture(options = {}) {
  const memory = new ArrayBuffer(2048), bytes = new Uint8Array(memory);
  const stack = Buffer.from(bytes.buffer, 512, 64);
  for (let i = 0; i < 16; i++) stack.writeUInt32LE(0x12340000 + i, i * 4);
  [E.returnPC, 1, 0xabcd, 0x4f0306, 1, 0, 0, 0x4c63bc, 1].forEach((v, i) => stack.writeUInt32LE(v, i * 4));
  bytes.set(Buffer.from(E.instructionHex, 'hex'), 1024);
  const log = Buffer.from('synthetic log\r\n\0\xff', 'latin1');
  const entry = { data: log };
  const vfs = { files: new Map([['c:\\thps2\\thpcerr.log', entry]]) };
  const exports = Object.fromEntries(REGISTERS.map((k, i) => ['get_' + k,
    () => k === 'esp' ? E.esp : (k === 'image_base' ? 0x400000 : 0x4f0000 + i)]));
  const translate = address => address >= E.esp && address < E.esp + 64
    ? 512 + address - E.esp
    : (address >= E.instructionVA && address < E.instructionVA + 6 ? 1024 + address - E.instructionVA : 0xf0);
  return { memory, bytes, stack, log, entry, vfs, exports,
    event: { name: E.name, ordinal: E.ordinal, thread: 0, exports, memory, translate, vfs }, ...options };
}

test('exact entry copies all 64 raw bytes and the complete binary log before handler mutation', () => {
  const f = fixture(), observer = createObserver();
  const stackHex = f.stack.toString('hex'), logHex = f.log.toString('hex');
  const seen = observer.onApi(f.event);
  f.stack.fill(0); f.log.fill(0); f.exports.get_esp = () => 0x777;
  assert.equal(seen.stack64Hex, stackHex);
  assert.equal(Buffer.from(seen.log.base64, 'base64').toString('hex'), logHex);
  assert.equal(seen.registers.esp, E.esp);
  assert.equal(seen.registers.eip, 0x4f0000); // deliberately NOT the instruction VA
  assert.equal(seen.callIdentity.instructionVA, E.instructionVA);
  assert.equal(seen.log.truncated, false);
  assert.equal(seen.log.sha256, crypto.createHash('sha256').update(Buffer.from(logHex, 'hex')).digest('hex'));
  assert.equal(observer.finish().complete, true);
  assert.throws(() => { seen.registers.esp = 0; }, TypeError);
  assert.throws(() => { seen.log.bytes = 0; }, TypeError);
  assert.equal(observer.observation(), seen);
});

const rejecting = [
  ['wrong API at selected call', f => { f.event.name = 'GetMessageA'; }, 'wrong-name'],
  ['wrong invocation ordinal', f => { f.event.ordinal--; }, 'wrong-ordinal'],
  ['worker invocation', f => { f.event.thread = 3; }, 'wrong-thread'],
  ['pre-CALL ESP', f => { f.exports.get_esp = () => E.esp + 4; }, 'wrong-esp'],
  ['wrong return word', f => { f.stack.writeUInt32LE(E.returnPC + 1, 0); }, 'wrong-return'],
  ['wrong status', f => { f.stack.writeUInt32LE(2, 4); }, 'wrong-status'],
  ['wrong live CALL operand', f => { f.bytes[1026] ^= 1; }, 'wrong-call-instruction'],
  ['short mapped stack', f => {
    const old = f.event.translate; f.event.translate = a => a === E.esp + 63 ? 2048 : old(a);
  }, 'invalid-guest-map'],
  ['NULL sentinel mapping', f => { f.event.translate = () => 0xf0; }, 'invalid-guest-map'],
  ['negative mapping', f => { f.event.translate = () => -1; }, 'invalid-guest-map'],
  ['invalid buffer does not allocate from a length-like value', f => { f.event.memory = 0x7fffffff; }, 'invalid-memory-buffer'],
  ['missing log', f => { f.vfs.files.clear(); }, 'missing-log'],
  ['oversized log', f => { f.entry.data = Buffer.alloc(65537); }, 'oversized-log'],
  ['truncated log', f => { f.entry._size = f.log.length + 1; }, 'truncated-log'],
  ['provider cannot masquerade as full log', f => { f.entry._provider = {}; }, 'nonresident-log'],
  ['getter never read to enforce cap before materialization', f => {
    Object.defineProperty(f.entry, 'data', { get() { throw Error('getter-must-not-run'); } });
  }, 'nonresident-log'],
  ['VFS read error', f => { f.vfs.files.get = () => { throw Error('vfs-read-error'); }; }, 'vfs-read-error'],
  ['missing register', f => { delete f.exports.get_edi; }, 'missing-register-edi'],
];
for (const [label, mutate, reason] of rejecting) test(label, () => {
  const f = fixture(); mutate(f);
  let failure;
  const observer = createObserver({ onFailure: r => { failure = r; } });
  assert.throws(() => observer.onApi(f.event), new RegExp(reason));
  assert.throws(() => observer.finish(), new RegExp(reason));
  assert.equal(failure.complete, false);
  if (['missing-log', 'oversized-log', 'truncated-log', 'vfs-read-error'].includes(reason))
    assert.equal(failure.partial.stack64Hex.length, 128);
});

test('unrelated APIs never read registers, mappings or VFS', () => {
  const observer = createObserver();
  assert.equal(observer.onApi({ name: 'LoadLibraryA', ordinal: 1 }), null);
  assert.throws(() => observer.finish(), /missing-exit-entry/);
});
test('reentrant callbacks latch failure even if the callback catches the error', () => {
  const f = fixture(); let observer;
  observer = createObserver({ onCapture: () => { assert.throws(() => observer.onApi(f.event), /reentrant/); } });
  assert.throws(() => observer.onApi(f.event), /reentrant/);
  assert.throws(() => observer.finish(), /reentrant/);
});
test('second exit fails without altering the first observation', () => {
  const f = fixture(), observer = createObserver();
  const first = observer.onApi(f.event);
  f.stack.writeUInt32LE(0xdead, 28);
  assert.throws(() => observer.onApi(f.event), /multiple-exit/);
  assert.equal(observer.observation(), first);
  assert.equal(Buffer.from(first.stack64Hex, 'hex').readUInt32LE(28), 0x4c63bc);
  assert.throws(() => observer.finish(), /multiple-exit/);
});
test('reentrant finalization cannot publish an incomplete write as success', () => {
  const f = fixture(); let observer;
  observer = createObserver({ onCapture: () => { assert.throws(() => observer.finish(), /reentrant-finalize/); } });
  assert.throws(() => observer.onApi(f.event), /reentrant-finalize/);
  assert.throws(() => observer.finish(), /reentrant-finalize/);
});
test('guest page slices can have noncontiguous backing; byte 63 is retained', () => {
  const f = fixture(), old = f.event.translate;
  const last = f.bytes[575]; f.bytes[1400] = last;
  f.event.translate = a => a === E.esp + 63 ? 1400 : old(a);
  assert.equal(Buffer.from(createObserver().onApi(f.event).stack64Hex, 'hex')[63], last);
});
test('explicit cap accepts exactly-sized and empty resident logs', () => {
  for (const size of [0, 19]) {
    const f = fixture(); f.entry.data = Buffer.alloc(size, 0xff);
    const result = createObserver({ logCap: 19 }).onApi(f.event);
    assert.equal(result.log.bytes, size);
  }
  for (const logCap of [0, -1, 1048577, NaN]) assert.throws(() => createObserver({ logCap }), /invalid-log-cap/);
});
test('synchronous output failure latches rejection', () => {
  const f = fixture(), observer = createObserver({ onCapture() { throw Error('disk-write-error'); } });
  assert.throws(() => observer.onApi(f.event), /disk-write-error/);
  assert.throws(() => observer.finish(), /disk-write-error/);
});
test('real file writer retains exact bytes, and rejects reused invocation directory', () => {
  const root = fs.mkdtempSync(path.join(process.env.THPS2_TEST_TMP || os.tmpdir(), 'observer-test-'));
  try {
    const directory = path.join(root, 'capture'), f = fixture();
    const observer = createFileObserver(directory);
    observer.onApi(f.event); observer.finalize();
    assert.deepEqual(fs.readFileSync(path.join(directory, 'entry-stack64.bin')), f.stack);
    assert.deepEqual(fs.readFileSync(path.join(directory, 'thpcerr.log')), f.log);
    const entry = JSON.parse(fs.readFileSync(path.join(directory, 'entry.json')));
    assert.equal(entry.log.base64, undefined);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'verdict.json'))).complete, true);
    assert.throws(() => createFileObserver(directory), /EEXIST/);
    const failedDirectory = path.join(root, 'failure'), missing = fixture(); missing.vfs.files.clear();
    const failed = createFileObserver(failedDirectory);
    assert.throws(() => failed.onApi(missing.event), /missing-log/);
    assert.throws(() => failed.finalize(), /missing-log/);
    assert.deepEqual(fs.readFileSync(path.join(failedDirectory, 'entry-stack64.bin')), missing.stack);
    assert.equal(fs.existsSync(path.join(failedDirectory, 'thpcerr.log')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(failedDirectory, 'verdict.json'))).complete, false);
  } finally { fs.rmSync(root, { recursive: true }); }
});

// This is the authentic runner's exact transformed entry prefix, evaluated
// with fake registers/memory/VFS, NOT a game or WASM execution.
const runner = fs.readFileSync(process.env.THPS2_PINNED_RUNNER, 'utf8');
const transformed = transformRunner(runner);
test('identity transform rejects any changed runner and is not idempotent', () => {
  assert.throws(() => transformRunner(runner + '\n'), /runner-identity-mismatch/);
  assert.throws(() => transformRunner(transformed.source), /runner-identity-mismatch/);
  assert.equal(transformed.receipt.replacements, 5);
  assert.match(transformed.source, /apiLogOff = false && QUIET_API/);
  assert.match(transformed.source, /unsupported-native-worker-logging/);
  assert.match(transformed.source, /unsupported-worker-exit-entry/);
});
function authenticHook(observer, f) {
  const begin = transformed.source.indexOf('  h.log = (ptr, len) => {');
  const end = transformed.source.indexOf('    if (apiCounts)', begin);
  assert(begin > 0 && end > begin);
  const entryPrefix = transformed.source.slice(begin, end) + '\n  };';
  f.bytes.set(Buffer.from('ExitProcess\0'), 1200);
  const context = { h: {}, apiNameCache: new Map(), pendingComApiId: -1,
    apiTable: [], apiCount: 3547, memory: { buffer: f.memory },
    instance: { exports: f.exports }, ctx: { vfs: f.vfs },
    translateGuest: f.event.translate, thpsExitObserver: observer, Uint8Array };
  vm.runInNewContext(entryPrefix, context);
  return context;
}
test('actual runner entry prefix executes capture before fake handler changes ESP', () => {
  const f = fixture(), observer = createObserver(), context = authenticHook(observer, f);
  const before = Buffer.from(f.stack);
  context.h.log(1200, 11);
  f.exports.get_esp = () => E.esp + 8; f.stack.fill(0);
  assert.equal(observer.observation().stack64Hex, before.toString('hex'));
  assert.equal(context.apiCount, 3548);
  assert.equal(observer.finish().complete, true);
});
test('actual runner prefix rejects wrong API and resolved ordinal alias mismatches', () => {
  for (const ordinalAlias of [false, true]) {
    const f = fixture(), observer = createObserver(), c = authenticHook(observer, f);
    if (ordinalAlias) {
      f.bytes.set(Buffer.from('<ord>\0'), 1200);
      c.pendingComApiId = 144; c.apiTable[144] = { id: 144, name: 'NotExitProcess' };
    } else f.bytes.set(Buffer.from('GetMessageA\0'), 1200);
    assert.throws(() => c.h.log(1200, 11), /wrong-name/);
  }
});

test('pinned VirtualFS create/write/append exposes the complete logical log, excluding capacity', () => {
  const source = fs.readFileSync(process.env.THPS2_PINNED_VFS, 'utf8');
  const end = source.indexOf('function createFilesystemImports');
  assert(end > 0);
  const c = { Uint8Array, Map, Set };
  vm.runInNewContext(source.slice(0, end) + '\nglobalThis.VFS = VirtualFS;', c);
  const vfs = new c.VFS();
  const handle = vfs.createFile('C:\\THPS2\\thpcerr.log', 0x40000000, 2);
  const a = Buffer.from('first line\r\n'), b = Buffer.from('last line\0\xff', 'latin1');
  vfs.writeFile(handle, a, a.length);
  vfs.writeFile(handle, b, b.length);
  const f = fixture(); f.event.vfs = vfs;
  const record = createObserver().onApi(f.event);
  assert.deepEqual(Buffer.from(record.log.base64, 'base64'), Buffer.concat([a, b]));
  assert.equal(record.log.bytes, a.length + b.length);
});

test('pinned source places host entry before argument loads/handler, with CALL return already pushed', () => {
  const dispatch = fs.readFileSync(process.env.THPS2_PINNED_DISPATCH, 'utf8');
  const start = dispatch.indexOf(';; ── Normal API dispatch');
  assert(start > 0);
  const entry = dispatch.indexOf('(call $host_log (local.get $name_ptr)', start);
  const args = dispatch.indexOf(';; Load args from guest stack', start);
  const handler = dispatch.indexOf('(call $dispatch_api', start);
  assert(entry > start && args > entry && handler > args);
  const core = fs.readFileSync(process.env.THPS2_PINNED_ALU, 'utf8');
  const call = core.indexOf('(func $th_call_ind (');
  assert(call > 0);
  const end = core.indexOf('\n  (func ', call + 1);
  const slice = core.slice(call, end);
  assert(slice.indexOf('(call $gs32') < slice.indexOf('(call $win32_dispatch'));
});
