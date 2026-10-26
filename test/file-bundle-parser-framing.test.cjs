'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { readBundle } = require('../lib/file-bundle');

// Evaluate the complete browser host, without constructing an emulator or
// exporting/copying the parser into a test-only implementation.
const context = vm.createContext({ window: { memUtils: {} }, TextDecoder, URL });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8'), context);
const parse = vm.runInContext('WineAssembly.parseFileBundle', context);

function frame(header, body = Buffer.alloc(0)) {
  const json = Buffer.isBuffer(header) ? header : Buffer.from(JSON.stringify(header));
  const prefix = Buffer.alloc(8);
  prefix.write('WAB1');
  prefix.writeUInt32LE(json.length, 4);
  return Buffer.concat([prefix, json, body]);
}

test('real server multi-file response, missing file, zero size, and offset views', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wab1-framing-'));
  try {
    fs.writeFileSync(path.join(dir, 'one'), Buffer.from([0, 255, 65]));
    fs.writeFileSync(path.join(dir, 'empty'), '');
    fs.writeFileSync(path.join(dir, 'two'), 'second');
    const response = await readBundle(['one', 'missing', 'empty', 'two'],
      name => name === 'missing' ? null : path.join(dir, name));
    const padded = Buffer.concat([Buffer.from('prefix'), response, Buffer.from('suffix')]);
    const view = new Uint8Array(padded.buffer, padded.byteOffset + 6, response.length);
    const out = parse(view);
    assert.deepEqual(Array.from(out.keys()), ['one', 'empty', 'two']);
    assert.deepEqual(Array.from(out.get('one')), [0, 255, 65]);
    assert.equal(out.get('empty').length, 0);
    assert.equal(Buffer.from(out.get('two')).toString(), 'second');
    assert.equal(out.get('one').buffer, view.buffer);
    assert.equal(out.get('one').byteOffset, view.byteOffset + 8 + view[4] + (view[5] << 8));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('404 and 413 consume no bytes; successful files can follow either', () => {
  const out = parse(frame([{ f: 'missing', status: 404 }, { f: 'large', status: 413 },
    { f: 'empty', size: 0 }, { f: 'present', size: 2 }], Buffer.from('ok')));
  assert.deepEqual(Array.from(out.keys()), ['empty', 'present']);
  assert.equal(Buffer.from(out.get('present')).toString(), 'ok');
  assert.equal(parse(frame([])).size, 0);
  assert.equal(parse(frame([{ f: 'a', status: 404 }, { f: 'b', status: 413 }])).size, 0);
});

test('malformed descriptor shapes and names reject the whole response', () => {
  for (const entry of [null, false, 0, '', [], {}, { size: 0 }, { f: 1, size: 0 },
    { f: null, status: 404 }, { f: 'a' }, { f: 'a', size: 0, extra: true },
    { f: 'a', status: 404, extra: true }]) {
    assert.equal(parse(frame([{ f: 'valid', size: 0 }, entry])), null, JSON.stringify(entry));
  }
});

test('only explicit numeric 404/413 statuses without size are valid errors', () => {
  for (const status of [0, 200, 400, 500, '404', null, false, {}, []]) {
    assert.equal(parse(frame([{ f: 'a', status }])), null, JSON.stringify(status));
  }
  for (const status of [404, 413, 200, null]) {
    for (const size of [0, 1, null, '0']) {
      assert.equal(parse(frame([{ f: 'a', status, size }], size === 1 ? Buffer.from('x') : undefined)), null);
    }
  }
});

test('sizes must be nonnegative safe integers fitting the remaining body', () => {
  for (const size of [-1, 0.5, '0', null, false, {}, [], Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1, 1e100]) {
    assert.equal(parse(frame([{ f: 'a', size }])), null, JSON.stringify(size));
  }
  assert.equal(parse(frame([{ f: 'a', size: 2 }], Buffer.from('x'))), null);
  assert.equal(parse(frame([{ f: 'a', size: 1 }, { f: 'b', size: 2 }], Buffer.from('xy'))), null);
});

test('duplicate names reject successes, errors, and mixed descriptors in either order', () => {
  for (const first of [{ size: 0 }, { size: 1 }, { status: 404 }, { status: 413 }]) {
    for (const second of [{ size: 0 }, { size: 1 }, { status: 404 }, { status: 413 }]) {
      const body = Buffer.alloc((first.size || 0) + (second.size || 0));
      assert.equal(parse(frame([{ f: 'same', ...first }, { f: 'same', ...second }], body)), null);
    }
  }
});

test('invalid prefix, header framing, JSON and trailing bytes reject', () => {
  assert.equal(parse(null), null);
  const valid = frame([{ f: 'a', size: 1 }], Buffer.from('x'));
  for (let length = 0; length < valid.length; length++) assert.equal(parse(valid.subarray(0, length)), null);
  const badMagic = Buffer.from(valid); badMagic[0] = 0;
  assert.equal(parse(badMagic), null);
  const hugeHeader = Buffer.from(valid); hugeHeader.writeUInt32LE(0xffffffff, 4);
  assert.equal(parse(hugeHeader), null);
  for (const header of [null, {}, 'text', 1]) assert.equal(parse(frame(header)), null);
  assert.equal(parse(frame(Buffer.from('['))), null);
  for (const header of [[], [{ f: 'a', size: 0 }], [{ f: 'a', status: 413 }]]) {
    assert.equal(parse(frame(header, Buffer.from('extra'))), null);
  }
});

test('invalid UTF-8 is not silently replaced in file names', () => {
  const header = Buffer.concat([Buffer.from('[{"f":"'), Buffer.from([0xff]), Buffer.from('","size":0}]')]);
  assert.equal(parse(frame(header)), null);
});
