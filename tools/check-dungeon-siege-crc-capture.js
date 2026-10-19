'use strict';
// Pure JS mocked capture/protocol checks, no guest/native/HTTP server execution.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const crypto = require('node:crypto'), { EventEmitter } = require('node:events');
const { captureCrcBoundary } = require('./dungeon-siege-crc-capture');
const memory = { buffer: new ArrayBuffer(8 * 1024 ** 2) }, view = new Uint8Array(memory.buffer);
const layout = { GUEST_BASE: 0x12000, BASE: { GUEST_PAGE_TABLE: 0x400000, DIB_BACKING_BASE: 0x1c000000 }, SIZE: { GUEST_PAGE_TABLE: 0x400000 } };
const dv = new DataView(memory.buffer), owner = 0x400000, buffer = 0x9000000, length = 1836044;
const g2w = a => a >= buffer && a < buffer + length
  ? 0x100000 + (500 - ((a - buffer) >>> 12)) * 4096 + (a & 4095)
  : a - 0x400000 + 0x12000;
const word = (a, v) => dv.setUint32(g2w(a), v, true);
for (let i = 0; i < Math.ceil(length / 4096); i++) dv.setUint32(layout.BASE.GUEST_PAGE_TABLE + ((buffer >>> 12) + i) * 4,
  (g2w(buffer + i * 4096) | 0x800) >>> 0, true);
for (const [off, value] of [[4, 0], [12, buffer], [16, length], [20, 4096], [24, 0x401000],
  [0x94, 194793312], [0x9c, length], [0xd8, 0x6fdb45eb]]) word(owner + off, value);
word(0x401004, 0x7000000a);
for (let n = 0; n < 256; n++) { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; word(0x6f6468 + n * 4, c); }
for (let i = 0; i < length; i++) view[g2w(buffer + i)] = i & 255;
const exportsMock = { get_eip: () => 0x628d6a, get_esi: () => owner, get_eax: () => 123, get_image_base: () => 0x400000,
  guest_to_wasm: () => { throw new Error('Mutating translator forbidden'); } };
const ctx = { vfs: { handles: new Map([[0x7000000a, { path: 'c:\\demo.ds', pos: 194794100 }]]),
  readFile: () => { throw new Error('Filesystem materialization forbidden'); } } };
const hash = () => crypto.createHash('sha256').update(view).digest('hex');
const before = hash(), result = captureCrcBoundary(exportsMock, memory, layout, ctx, b => Buffer.from(b).toString('base64'));
const captured = Buffer.from(result.bytesBase64, 'base64');
assert.equal(captured.length, length);
for (let i = 0; i < length; i++) assert.equal(captured[i], i & 255);
assert.equal(hash(), before); assert.equal(result.files[0].pos, 194794100);
assert(result.pages[1].wasm < result.pages[0].wasm, 'Fixture really has non-contiguous guest pages');
assert.throws(() => captureCrcBoundary({ ...exportsMock, get_eip: () => 0 }, memory, layout, ctx, String), /Wrong breakpoint/);
const pteAt = layout.BASE.GUEST_PAGE_TABLE + ((buffer >>> 12) + 1) * 4, oldPte = dv.getUint32(pteAt, true);
dv.setUint32(pteAt, 0, true);
const holeBefore = hash(), holeResult = captureCrcBoundary(exportsMock, memory, layout, ctx, b => Buffer.from(b).toString('base64'));
assert.equal(hash(), holeBefore); assert.equal(holeResult.holes.length, 1);
assert.equal(holeResult.holes[0].guest, buffer + 4096); assert.equal(holeResult.holes[0].pte, 0);
assert.equal(holeResult.bytesBase64, null); assert.equal(holeResult.capturedCrc, null);
assert.equal(holeResult.mappedFragments.reduce((n, p) => n + Buffer.from(p.bytesBase64, 'base64').length, 0), length - 4096);
dv.setUint32(pteAt, oldPte, true);
word(owner + 0x9c, length + 1);
assert.throws(() => captureCrcBoundary(exportsMock, memory, layout, ctx, String), /Unexpected/);
word(owner + 0x9c, length); assert.equal(hash(), before);
assert.throws(() => captureCrcBoundary(exportsMock, memory, layout, { vfs: { handles: new Map() } }, String), /Missing live/);

// The controller waits for the existing debugger prompt, captures once, then
// sends only debugger q. Split output chunks cannot trigger early continuation.
const controllerSource = fs.readFileSync(require.resolve('./dungeon-siege-retry-controller'), 'utf8');
const receiverSource = controllerSource.slice(controllerSource.indexOf('const receive ='), controllerSource.indexOf("child.stdout.on('data'"));
for (const failedCapture of [false, true]) {
  const writes = [], stops = []; let calls = 0, callback;
  const scope = { captureCrc: true, captureStarted: false, captureComplete: false, captureProcess: null,
    promptTail: '', reason: null, bytes: 0, fd: 1, id: 'fixture', __dirname: '.', process,
    path: require('node:path'), fs: { writeSync: () => {} }, save: () => {},
    cp: { execFile: (...args) => { calls++; callback = args.at(-1); return {}; } },
    child: { stdin: { destroyed: false, write: s => writes.push(s) } }, quit: why => stops.push(why) };
  vm.createContext(scope);
  vm.runInContext(receiverSource + ';globalThis.receive = receive;', scope);
  scope.receive(Buffer.from('ordinary output')); assert.equal(calls, 0);
  scope.receive(Buffer.from('[s]tep/[c]ont/')); assert.equal(calls, 0);
  scope.receive(Buffer.from('[d]ump ADDR:LEN > ')); assert.equal(calls, 1);
  callback(failedCapture ? new Error('fixture refusal') : null, '', '');
  assert.deepEqual(writes, failedCapture ? [] : ['q\n']);
  assert.deepEqual(stops, failedCapture ? ['capture-failed'] : []);
  scope.receive(Buffer.from('[s]tep/[c]ont/[d]ump')); assert.equal(calls, 1);
}

// Exercise the production JS g2w on a missing sparse PTE: no allocation or writes.
const { g2w: translate } = require('../lib/mem-utils');
const sparse = new ArrayBuffer(512 * 1024 ** 2);
assert.equal(translate(buffer, 0x400000, sparse), 0xf0);
const regions = require('../lib/region-map.generated');
assert.equal(new DataView(sparse).getUint32(regions.BASE.GUEST_PAGE_TABLE + (buffer >>> 12) * 4, true), 0);

(async () => {
  const source = fs.readFileSync(require.resolve('./dungeon-siege-crc-capture'), 'utf8');
  for (const mode of ['success', 'holes', 'rejected', 'overflow']) {
    const writes = [], errors = [], moduleMock = { exports: {} };
    const fakeFs = { readFileSync: () => JSON.stringify({ captureCrc: true }), existsSync: () => false,
      writeFileSync: (p, b) => writes.push([p, b]) };
    const http = { request: (options, callback) => {
      const req = new EventEmitter(); req.setTimeout = () => {};
      req.destroy = e => req.emit('error', e);
      req.end = () => queueMicrotask(() => {
        const res = new EventEmitter(); res.statusCode = 200; callback(res);
        res.emit('data', Buffer.from(JSON.stringify(mode === 'rejected' ? { ok: false, error: 'fixture rejection' }
          : { ok: true, value: mode === 'holes' ? holeResult : result })));
        if (mode === 'overflow') res.emit('data', Buffer.alloc(1024 * 1024));
        res.emit('end');
      }); return req;
    } };
    const requireMock = n => n === 'node:fs' ? fakeFs : n === 'node:http' ? http : require(n);
    requireMock.main = moduleMock;
    vm.runInNewContext(source, { require: requireMock, module: moduleMock, process: { argv: ['node', 'capture', '20261019-dungeon-siege-fixture'] },
      console: { log: () => {}, error: e => errors.push(e) }, Buffer, Uint8Array, DataView });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes.length, mode === 'success' || mode === 'holes' ? 2 : 0);
    assert.equal(errors.length, mode === 'success' || mode === 'holes' ? 0 : 1);
    if (mode === 'holes') assert(writes.every(([p]) => !p.endsWith('crc-buffer.bin')));
  }
  console.log('PASS: scattered PTE capture, unchanged memory/cursor, wrong-EIP/length refusal, holes without invented bytes, pure JS PTE miss, debugger completion and protocol success/holes/rejection/overflow.');
})();
