'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sourcePath = process.env.FILE_BUNDLE_INDEPENDENT_SOURCE || path.join(__dirname, '../lib/file-bundle.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const chunkSize = 65536;

// Run the unchanged production algorithm with a small constant and measured
// Buffer constructors. No FileHandle/read loop is replaced. The synthetic IO
// implements Node's read contract and never allocates a file-sized fixture.
function harness(specs, cap = 11) {
  const events = [];
  let active = null;
  const measuredBuffer = new Proxy(Buffer, {
    get(target, key) {
      if (['alloc', 'allocUnsafe', 'allocUnsafeSlow'].includes(key)) {
        return (length, ...args) => {
          events.push({ kind: 'allocate', file: active, length });
          assert.ok(length <= Math.max(cap, 8), 'allocation exceeds total budget');
          return target[key](length, ...args);
        };
      }
      if (key === 'concat') return (parts, length) => {
        const actual = parts.reduce((n, b) => n + b.length, 0);
        assert.equal(length === undefined ? actual : length, actual, 'no padding/uninitialized tail');
        events.push({ kind: 'concat', file: active, count: parts.length, length: actual });
        return Buffer.concat(parts, length);
      };
      return Reflect.get(target, key);
    },
  });
  const io = {
    async readFile() { throw new Error('FORBIDDEN unbounded readFile'); },
    async open(name, flags) {
      assert.equal(flags, 'r');
      const spec = specs[name];
      events.push({ kind: 'open', file: name });
      if (!spec || spec.openError) throw new Error('open');
      active = name;
      let position = 0, calls = 0, closed = false;
      return {
        async stat() {
          events.push({ kind: 'stat', file: name });
          if (spec.statError) throw new Error('stat');
          return { size: spec.metadata ?? spec.length ?? 0, isFile: () => !spec.nonregular };
        },
        async read(buffer, offset, length, filePosition) {
          assert.equal(closed, false);
          assert.equal(filePosition, null);
          assert.ok(length > 0 && length <= chunkSize);
          assert.ok(offset >= 0 && offset + length <= buffer.length);
          events.push({ kind: 'read', file: name, length, offset, bufferLength: buffer.length, position });
          if (++calls === spec.errorAt) throw new Error('read');
          const n = Math.min(length, spec.short ?? length, Math.max(0, (spec.length ?? 0) - position));
          for (let i = 0; i < n; i++) buffer[offset + i] = ((position + i) % 23) + 65;
          position += n;
          return { bytesRead: n };
        },
        async close() {
          assert.equal(closed, false, 'close exactly once');
          closed = true;
          events.push({ kind: 'close', file: name, consumed: position });
          active = null;
          if (spec.closeError) throw new Error('close');
        },
      };
    },
  };
  const declaration = 'const MAX_BYTES = 64 * 1024 * 1024;';
  assert.equal(source.split(declaration).length, 2);
  const module = { exports: {} };
  vm.runInNewContext(source.replace(declaration, `const MAX_BYTES = ${cap};`), {
    module, Buffer: measuredBuffer,
    require(name) { assert.equal(name, 'fs/promises'); return io; },
  }, { filename: sourcePath, timeout: 1000 });
  return { api: module.exports, events, io };
}

function decode(body) {
  assert.equal(body.toString('ascii', 0, 4), 'WAB1');
  const headerEnd = 8 + body.readUInt32LE(4);
  assert.ok(headerEnd <= body.length);
  const entries = JSON.parse(body.toString('utf8', 8, headerEnd));
  const data = [];
  let offset = headerEnd;
  for (const e of entries) {
    if (Object.hasOwn(e, 'size')) {
      assert.ok(Number.isSafeInteger(e.size) && e.size >= 0);
      data.push(body.subarray(offset, offset + e.size));
      offset += e.size;
    } else assert.ok(e.status === 404 || e.status === 413);
  }
  assert.equal(offset, body.length, 'no trailing, missing or leaked bytes');
  return { entries, data };
}

function matching(h, file, kind) { return h.events.filter(e => e.file === file && e.kind === kind); }
function expectClosed(h, file, count = 1) { assert.equal(matching(h, file, 'close').length, count); }
function bytes(n) { return Buffer.from(Array.from({ length: n }, (_, i) => i % 23 + 65)); }

test('huge metadata and all nonregular kinds reject before ANY data allocation/read', async () => {
  const kinds = ['directory', 'fifo', 'socket', 'device'];
  const specs = Object.fromEntries(kinds.map(k => [k, { nonregular: true, length: 1 }]));
  specs.huge = { metadata: Number.MAX_SAFE_INTEGER, length: 0 };
  const h = harness(specs);
  const names = ['huge', ...kinds];
  const r = decode(await h.api.readBundle(names, f => f));
  assert.deepEqual(r.entries, names.map(f => ({ f, status: f === 'huge' ? 413 : 404 })));
  for (const file of names) {
    assert.equal(matching(h, file, 'allocate').length, 0);
    assert.equal(matching(h, file, 'read').length, 0);
    assert.equal(matching(h, file, 'concat').length, 0);
    expectClosed(h, file);
  }
});

test('remaining budget bounds allocation and actual IO after accepted and failed files', async () => {
  const h = harness({ a: { length: 7 }, grow: { metadata: 0, length: 1000000, short: 1 },
    error: { metadata: 0, length: 4, short: 1, errorAt: 2 }, fit: { length: 4 },
    empty: { length: 0 }, late: { metadata: 0, length: 999999 } });
  const names = ['a', 'grow', 'error', 'fit', 'empty', 'late'];
  const r = decode(await h.api.readBundle(names, f => f));
  assert.deepEqual(r.entries, [{ f: 'a', size: 7 }, { f: 'grow', status: 413 },
    { f: 'error', status: 404 }, { f: 'fit', size: 4 }, { f: 'empty', size: 0 }, { f: 'late', status: 413 }]);
  assert.deepEqual(r.data, [bytes(7), bytes(4), bytes(0)]);
  for (const file of ['grow', 'error', 'fit']) {
    assert.ok(matching(h, file, 'allocate').every(e => e.length <= 4));
    assert.ok(matching(h, file, 'read').every(e => e.length <= 4));
  }
  assert.equal(matching(h, 'grow', 'close')[0].consumed, 5, 'remaining + one probe, not total budget + probe');
  assert.deepEqual(matching(h, 'grow', 'allocate').map(e => e.length), [4, 1]);
  for (const file of ['empty', 'late']) {
    assert.deepEqual(matching(h, file, 'allocate').map(e => e.length), [1]);
    assert.deepEqual(matching(h, file, 'read').map(e => e.length), [1]);
  }
  names.forEach(f => expectClosed(h, f));
});

test('one-byte short reads retain one allocation per chunk, not per read', async () => {
  const cap = chunkSize + 7;
  const h = harness({ one: { length: cap, short: 1 } }, cap);
  const r = decode(await h.api.readBundle(['one'], f => f));
  assert.deepEqual(r.entries, [{ f: 'one', size: cap }]);
  assert.deepEqual(r.data[0], bytes(cap));
  assert.deepEqual(matching(h, 'one', 'allocate').map(e => e.length), [chunkSize, 7, 1]);
  assert.deepEqual(matching(h, 'one', 'concat').map(e => [e.count, e.length]), [[2, cap]]);
  assert.equal(matching(h, 'one', 'read').length, cap + 1);
  expectClosed(h, 'one');
});

test('EOF in second chunk frames only actual data and keeps all requests bounded', async () => {
  const cap = chunkSize + 19, actual = chunkSize + 3;
  const h = harness({ shrink: { metadata: cap, length: actual, short: 13 } }, cap);
  const r = decode(await h.api.readBundle(['shrink'], f => f));
  assert.deepEqual(r.entries, [{ f: 'shrink', size: actual }]);
  assert.deepEqual(r.data[0], bytes(actual));
  assert.deepEqual(matching(h, 'shrink', 'allocate').map(e => e.length), [chunkSize, 19]);
  assert.deepEqual(matching(h, 'shrink', 'concat').map(e => [e.count, e.length]), [[2, actual]]);
  expectClosed(h, 'shrink');
});

test('zero budget exact empty succeeds; growing file probes one byte and consumes no budget', async () => {
  const h = harness({ empty: { length: 0 }, grow: { metadata: 0, length: 1000000 }, huge: { metadata: 1 } }, 0);
  const r = decode(await h.api.readBundle(['grow', 'empty', 'huge', 'empty'], f => f));
  assert.deepEqual(r.entries, [{ f: 'grow', status: 413 }, { f: 'empty', size: 0 }, { f: 'huge', status: 413 }, { f: 'empty', size: 0 }]);
  assert.deepEqual(matching(h, 'grow', 'read').map(e => e.length), [1]);
  assert.equal(matching(h, 'huge', 'allocate').length, 0);
  expectClosed(h, 'grow'); expectClosed(h, 'empty', 2); expectClosed(h, 'huge');
});

test('errors at open/stat/partial read/probe/close preserve 404, cleanup, and later capacity', async () => {
  const specs = { open: { openError: true }, stat: { statError: true },
    read: { length: 3, short: 1, errorAt: 2 }, probe: { length: 11, errorAt: 2 },
    close: { length: 2, closeError: true }, ok: { length: 11 } };
  const h = harness(specs);
  const names = ['missing', 'resolveError', ...Object.keys(specs)];
  const r = decode(await h.api.readBundle(names, f => {
    if (f === 'resolveError') throw new Error('resolver');
    return f === 'missing' ? null : f;
  }));
  assert.deepEqual(r.entries, names.map(f => f === 'ok' ? { f, size: 11 } : { f, status: 404 }));
  assert.deepEqual(r.data, [bytes(11)]);
  assert.equal(matching(h, 'open', 'allocate').length, 0);
  Object.keys(specs).forEach(f => expectClosed(h, f, f === 'open' ? 0 : 1));
});

test('real handle growth/shrink/replacement AFTER metadata reads the opened inode safely', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bundle-independent-'));
  try {
    for (const mode of ['grow', 'shrink', 'replace']) {
      const file = path.join(dir, mode);
      await fsp.writeFile(file, mode === 'shrink' ? '12345678901' : 'old');
      const h = harness({}, 11);
      let closed = 0, consumed = 0, requests = [];
      h.io.open = async (name, flags) => {
        const handle = await fsp.open(name, flags);
        return {
          async stat() {
            const stat = await handle.stat();
            if (mode === 'grow') await fsp.appendFile(file, 'abcdefghijklmnopqrst');
            if (mode === 'shrink') await fsp.truncate(file, 2);
            if (mode === 'replace') {
              await fsp.rename(file, file + '.old');
              await fsp.writeFile(file, 'replacement too large');
            }
            return stat;
          },
          async read(...args) { requests.push(args[2]); const r = await handle.read(...args); consumed += r.bytesRead; return r; },
          async close() { closed++; await handle.close(); },
        };
      };
      const r = decode(await h.api.readBundle([mode], () => file));
      assert.equal(closed, 1);
      assert.ok(requests.every(n => n <= 11));
      if (mode === 'grow') {
        assert.deepEqual(r.entries, [{ f: mode, status: 413 }]);
        assert.equal(consumed, 12);
      } else {
        assert.deepEqual(r.entries, [{ f: mode, size: mode === 'shrink' ? 2 : 3 }]);
        assert.equal(r.data[0].toString(), mode === 'shrink' ? '12' : 'old');
      }
    }
  } finally { await fsp.rm(dir, { recursive: true, force: true }); }
});

test('wire order, duplicate names, Unicode, errors and write headers remain exact', async () => {
  const h = harness({ '\u00e9': { length: 3 }, huge: { metadata: 100 }, b: { length: 2 }, empty: { length: 0 } });
  const names = ['\u00e9', 'huge', 'missing', 'b', '\u00e9', 'empty'];
  let head, body;
  await h.api.writeBundle({ writeHead(status, headers) { head = { status, headers }; }, end(value) { body = value; } },
    names, f => f === 'missing' ? null : f, { 'X-Control': 'kept', 'Content-Length': 0 });
  assert.equal(head.status, 200);
  assert.equal(head.headers['X-Control'], 'kept');
  assert.equal(head.headers['Content-Type'], 'application/octet-stream');
  assert.equal(head.headers['Cache-Control'], 'no-store');
  assert.equal(head.headers['Content-Length'], body.length);
  const r = decode(body);
  assert.deepEqual(r.entries, [{ f: '\u00e9', size: 3 }, { f: 'huge', status: 413 }, { f: 'missing', status: 404 },
    { f: 'b', size: 2 }, { f: '\u00e9', size: 3 }, { f: 'empty', size: 0 }]);
  assert.deepEqual(r.data, [bytes(3), bytes(2), bytes(3), bytes(0)]);
  const finalConcat = h.events.filter(e => e.kind === 'concat').at(-1);
  assert.equal(finalConcat.length, body.length);
});
