'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { readBundle, writeBundle } = require('../lib/file-bundle');

const source = fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8');
function host() {
  const context = vm.createContext({ window: { memUtils: {} }, TextDecoder, URL });
  vm.runInContext(source, context, { timeout: 1000 });
  return { context, parse: vm.runInContext('WineAssembly.parseFileBundle', context) };
}
const { parse } = host();
function rawFrame(json, body = Buffer.alloc(0)) {
  const bytes = Buffer.isBuffer(json) ? json : Buffer.from(json);
  const prefix = Buffer.alloc(8);
  prefix.write('WAB1'); prefix.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([prefix, bytes, body]);
}
function frame(entries, body) { return rawFrame(JSON.stringify(entries), body); }
function keys(out) { return Array.from(out.keys()); }

test('actual server writer response, success/error sequence and zero-copy offset views', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wab-independent-'));
  try {
    fs.writeFileSync(path.join(dir, 'binary'), Buffer.from([0, 128, 255, 87, 65, 66, 49]));
    fs.writeFileSync(path.join(dir, 'empty'), '');
    const names = ['binary', 'missing', 'empty', 'resolver-throws', 'unreadable'];
    const resolve = name => {
      if (name === 'missing') return null;
      if (name === 'resolver-throws') throw new Error('fixture');
      return path.join(dir, name);
    };
    let headers, status, response;
    await writeBundle({ writeHead(s, h) { status = s; headers = h; }, end(b) { response = b; } }, names, resolve);
    assert.equal(status, 200); assert.equal(headers['Content-Length'], response.length);
    assert.equal(headers['Content-Type'], 'application/octet-stream');
    assert.equal(Buffer.compare(response, await readBundle(names, resolve)), 0);
    for (const padding of [0, 1, 7, 255]) {
      const storage = new Uint8Array(response.length + padding + 9);
      storage.fill(0xa5); storage.set(response, padding);
      const view = storage.subarray(padding, padding + response.length);
      const out = parse(view);
      assert.deepEqual(keys(out), ['binary', 'empty']);
      assert.deepEqual(Array.from(out.get('binary')), [0, 128, 255, 87, 65, 66, 49]);
      assert.equal(out.get('empty').length, 0);
      assert.equal(out.get('empty').byteOffset, padding + response.length);
      assert.equal(out.get('binary').buffer, storage.buffer);
      assert.equal(out.get('empty').buffer, storage.buffer);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('valid wire compatibility: errors, Unicode/special names, ordering, whitespace and empty sets', () => {
  const names = ['', '__proto__', 'constructor', 'toString', 'a,b', '雪/é', 'e\u0301', 'é', '\u0000'];
  const descriptors = [{ f: '404', status: 404 }, ...names.map(f => ({ size: 0, f })), { status: 413, f: '413' }];
  assert.deepEqual(keys(parse(rawFrame(' \n' + JSON.stringify(descriptors) + '\t\r'))), names);
  assert.equal(parse(frame([])).size, 0);
  assert.equal(parse(frame([{ f: 'missing', status: 404 }, { f: 'large', status: 413 }])).size, 0);
  const out = parse(frame([{ f: 'a', size: 2 }, { f: 'b', status: 413 }, { f: 'c', size: 1 }], Buffer.from('abc')));
  assert.equal(Buffer.from(out.get('a')).toString(), 'ab');
  assert.equal(Buffer.from(out.get('c')).toString(), 'c');
  assert.equal(parse(rawFrame('[{"f":"negative-zero","size":-0}]')).get('negative-zero').length, 0);
});

test('independent truncation and uint32 header boundary sweep stays within supplied view', () => {
  const valid = frame([{ f: 'a', size: 3 }, { f: 'b', size: 0 }], Buffer.from([0, 255, 1]));
  for (let end = 0; end < valid.length; end++) {
    const backing = new Uint8Array(valid.length + 17); backing.set(valid, 9);
    assert.equal(parse(backing.subarray(9, 9 + end)), null, `truncated length ${end}`);
  }
  for (const n of [0, 1, 2, valid.length - 8 - 1, valid.length - 8, valid.length - 7,
    0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff]) {
    const input = Buffer.from(valid); input.writeUInt32LE(n, 4);
    assert.equal(parse(input), null, `header length ${n}`);
  }
  for (let i = 0; i < 4; i++) { const input = Buffer.from(valid); input[i] ^= 0xff; assert.equal(parse(input), null); }
  for (const body of [Buffer.from([0]), Buffer.from('WAB1')]) assert.equal(parse(frame([], body)), null);
});

test('malformed JSON shapes and UTF-8 sequences reject atomically', () => {
  for (const json of ['null', 'true', 'false', '0', '"[]"', '{}', '{"0":{"f":"x","size":0}}',
    '[[]]', '[null]', '[false]', '[1]', '["x"]', '[{"f":"ok","size":0},{}]',
    '[{"f":"a","size":0},]', '[] []', '[{"f":"x","size":NaN}]']) {
    assert.equal(parse(rawFrame(json)), null, json);
  }
  for (const sequence of [[0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80], [0x80], [0xe2, 0x82], [0xff]]) {
    const json = Buffer.concat([Buffer.from('[{"f":"'), Buffer.from(sequence), Buffer.from('","size":0}]')]);
    assert.equal(parse(rawFrame(json)), null, Buffer.from(sequence).toString('hex'));
  }
});

test('descriptor/status/size and cross-kind duplicate matrix rejects malformed responses', () => {
  const bad = [{ f: 'a', size: 0, status: 404 }, { f: 'a', size: 0, extra: 1 },
    { f: 'a', status: 404, extra: 1 }, { f: 'a', extra: 0 }, { size: 0 },
    { f: ['a'], size: 0 }, { f: {}, status: 404 }];
  for (const status of ['404', '413', null, 0, 200, 403, 500, true, [], {}]) bad.push({ f: 'a', status });
  for (const size of [-1, 1.5, '1', null, true, [], {}, 9007199254740991, 9007199254740992, 1e100]) bad.push({ f: 'a', size });
  for (const entry of bad) assert.equal(parse(frame([{ f: 'prior', size: 0 }, entry])), null, JSON.stringify(entry));
  for (const a of [{ size: 0 }, { size: 1 }, { status: 404 }, { status: 413 }]) {
    for (const b of [{ size: 0 }, { size: 1 }, { status: 404 }, { status: 413 }]) {
      assert.equal(parse(frame([{ f: 'same', ...a }, { f: 'same', ...b }], Buffer.alloc((a.size || 0) + (b.size || 0)))), null);
    }
  }
});

test('inherited size/status cannot supply missing own fields; own special keys stay inert', () => {
  const h = host();
  vm.runInContext('Object.prototype.size = 0; Object.prototype.status = 404', h.context);
  assert.equal(h.parse(frame([{ f: 'a', extra: 1 }])), null);
  assert.equal(h.parse(frame([{ f: 'a', size: 0 }])).size, 1);
  assert.equal(h.parse(frame([{ f: 'a', status: 404 }])).size, 0);
  assert.equal(h.parse(rawFrame('[{"__proto__":{"f":"forged"},"size":0}]')), null);
});

test('inherited f must not turn missing-name success descriptor plus extra field into valid file', () => {
  const h = host();
  vm.runInContext('Object.prototype.f = "inherited-name"', h.context);
  // A wire descriptor has two OWN keys but neither is f. This must remain invalid.
  assert.equal(h.parse(frame([{ size: 1, extra: 'unexpected' }], Buffer.from('x'))), null);
});

test('inherited f must not turn missing-name error descriptor plus extra field into valid response', () => {
  const h = host();
  vm.runInContext('Object.prototype.f = "inherited-name"', h.context);
  assert.equal(h.parse(frame([{ status: 404, extra: 'unexpected' }])), null);
});

test('name-inheritance controls: clean realm rejects both repros and own f stays valid in polluted realm', () => {
  assert.equal(parse(frame([{ size: 1, extra: 'unexpected' }], Buffer.from('x'))), null);
  assert.equal(parse(frame([{ status: 404, extra: 'unexpected' }])), null);
  const h = host();
  vm.runInContext('Object.prototype.f = "inherited-name"', h.context);
  const out = h.parse(frame([{ f: 'own-name', size: 1 }], Buffer.from('x')));
  assert.deepEqual(keys(out), ['own-name']);
  assert.equal(Buffer.from(out.get('own-name')).toString(), 'x');
  assert.equal(h.parse(frame([{ f: 'own-error', status: 404 }])).size, 0);
  assert.equal(vm.runInContext('Object.prototype.f', host().context), undefined);
});
