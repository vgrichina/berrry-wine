'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.VFS_PERSISTENCE_SOURCE ||
  require.resolve('../lib/vfs-persistence.js'), 'utf8');
const path = 'c:\\save\\slot.sav';
const key = 'wine-assembly:vfs:bounded:' + encodeURIComponent(path);
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function restore(encoded, { cap = 3, fallback = false, decoder, saved = {}, storageError } = {}) {
  let calls = 0, writes = 0, parents = 0;
  const decode = value => { calls++; return decoder ? decoder(value) : atob(value); };
  const context = { module: { exports: {} }, Uint8Array, Buffer: {
    from(value, encoding) { assert.equal(encoding, 'base64'); return {
      toString(kind) { assert.equal(kind, 'binary'); return decode(value); },
    }; },
  } };
  if (!fallback) context.atob = decode;
  vm.runInNewContext(source, context);
  const original = { data: Uint8Array.of(77), attrs: 0x20 };
  const files = new Map([[path, original]]), logs = [];
  const storage = {
    get length() { if (storageError === 'length') throw Error('denied'); return 1; },
    key() { if (storageError === 'key') throw Error('denied'); return key; },
    getItem() { if (storageError === 'getItem') throw Error('denied');
      return JSON.stringify({ version: 1, data: encoded, ...saved }); },
    setItem() { writes++; }, removeItem() { writes++; },
  };
  const result = context.module.exports.attach({ files, ensureParentDirs() { parents++; } }, {
    appId: 'bounded', patterns: ['c:\\save\\*'], storage, maxFileBytes: cap,
    log: message => logs.push(message),
  });
  return { result, calls, writes, parents, files, original, logs };
}
function rejected(encoded, options) {
  const r = restore(encoded, options);
  assert.equal(r.calls, 0, 'rejected data must not invoke decoder');
  assert.equal(r.result.restored, 0);
  assert.equal(r.files.get(path), r.original, 'mounted entry must survive');
  assert.equal(r.parents, 0); assert.equal(r.writes, 0);
}
for (const fallback of [false, true]) {
  const mode = fallback ? 'Buffer' : 'atob';
  test(mode + ' overlimit encoded length skips throwing sentinel', () =>
    rejected('AAAA'.repeat(8), { fallback, decoder() { throw Error('decoder sentinel'); } }));
  test(mode + ' same encoded length but decoded bytes over cap', () => {
    rejected('AQID', { cap: 1, fallback });
    rejected('AQI=', { cap: 1, fallback });
    rejected('AQID', { cap: 2, fallback });
  });
  test(mode + ' malformed input never reaches decoder', () => {
    for (const value of ['!', 'A', 'A===', '====', '=AAA', 'AA=A', 'AA==A',
      'AAA==', 'AAAA=', 'AA-_', 'AA\u00a0==', 'AA\v==', 'AA\0==', 'AAAA!!!!']) {
      rejected(value, { fallback });
    }
    for (const value of [null, 42, {}, []]) rejected(value, { fallback });
    rejected('AQ==', { fallback, saved: { version: 2 } });
  });
  test(mode + ' empty and every boundary remainder preserve binary bytes', () => {
    for (let cap = 1; cap <= 9; cap++) {
      for (let length = 0; length <= cap; length++) {
        const bytes = Buffer.from(Array.from({ length }, (_, i) => (i * 127 + 128) & 255));
        const r = restore(bytes.toString('base64'), { cap, fallback });
        assert.equal(r.result.restored, 1); assert.equal(r.calls, 1);
        assert.deepEqual(r.files.get(path).data, new Uint8Array(bytes));
        assert.equal(r.parents, 1); assert.equal(r.writes, 0);
      }
      rejected(Buffer.alloc(cap + 1).toString('base64'), { cap, fallback });
    }
  });
  test(mode + ' old atob-compatible whitespace and unpadded data', () => {
    for (const value of ['', ' \t\r\n\f', 'AQ', 'AQI', 'AQID', ' A\tQ==\r\n', 'A Q I=']) {
      const r = restore(value, { fallback });
      assert.equal(r.result.restored, 1);
      assert.deepEqual(r.files.get(path).data, Uint8Array.from(Buffer.from(value, 'base64')));
    }
  });
  test(mode + ' attrs name and all timestamps survive', () => {
    const saved = { name: 'Slot.SAV', attrs: 0x21, creationTime: { lo: 7, hi: 8 },
      lastAccessTime: { lo: 9, hi: 10 }, lastWriteTime: { lo: 11, hi: 12 } };
    const r = restore('/wAB', { fallback, saved });
    const entry = r.files.get(path);
    assert.equal(entry.name, saved.name); assert.equal(entry.attrs, saved.attrs);
    for (const field of ['creationTime', 'lastAccessTime', 'lastWriteTime'])
      assert.equal(JSON.stringify(entry[field]), JSON.stringify(saved[field]));
    assert.deepEqual(entry.data, Uint8Array.of(255, 0, 1));
  });
  test(mode + ' final actual-byte check remains authoritative', () => {
    const r = restore('AQ==', { fallback, decoder: () => '1234' });
    assert.equal(r.calls, 1); assert.equal(r.result.restored, 0);
    assert.equal(r.files.get(path), r.original); assert.equal(r.parents, 0);
  });
  test(mode + ' decoder exception is isolated and logged', () => {
    const r = restore('AQ==', { fallback, decoder() { throw Error('decoder failure'); } });
    assert.equal(r.calls, 1); assert.equal(r.result.restored, 0);
    assert.equal(r.files.get(path), r.original);
    assert(r.logs.some(x => x.includes('decoder failure')));
  });
}
test('storage exceptions remain contained without mutation or decoding', () => {
  for (const storageError of ['length', 'key', 'getItem']) {
    const r = restore('AQ==', { storageError });
    assert.equal(r.calls, 0); assert.equal(r.result.restored, 0);
    assert.equal(r.files.get(path), r.original); assert.equal(r.parents, 0);
    assert(r.logs.some(x => x.includes('denied')));
  }
});
console.log(JSON.stringify({ passed, failed }));
if (failed) process.exitCode = 1;
