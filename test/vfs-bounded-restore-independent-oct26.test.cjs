'use strict';
// Independent acceptance: exercise exported attach(), never copy the preflight.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const sourcePath = process.env.VFS_PERSISTENCE_SOURCE || require.resolve('../lib/vfs-persistence.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const candidate = '69a838665969d09be78f3b6ba8f7f13ae49a7cf8';
const results = [];
let cases = 0;
function group(name, body) {
  try { body(); results.push({ name, result: 'PASS' }); }
  catch (error) {
    results.push({ name, result: 'FAIL', error: error.stack });
    process.exitCode = 1;
  }
  console.log(results.at(-1).result + ' ' + name);
  if (results.at(-1).error) console.error(results.at(-1).error);
  if (process.env.VFS_ACCEPT_CHECKPOINT) {
    const path = process.env.VFS_ACCEPT_CHECKPOINT;
    fs.writeFileSync(path + '.tmp', JSON.stringify({ candidate,
      at: new Date().toISOString(), sourcePath, sourceSha256: hash(source),
      fixtureSha256: hash(fs.readFileSync(__filename)), results, cases,
      supplied: 'ops/supplied.log: unchanged 17 PASS',
      evidence: 'ops/independent.log',
      remaining: ['remaining groups in fixture until final summary', 'scoped review and publication'],
      blockers: results.filter(x => x.result === 'FAIL'),
    }, null, 2) + '\n');
    fs.renameSync(path + '.tmp', path);
  }
}
const prefix = 'wine-assembly:vfs:independent:';
const pathFor = id => 'c:\\save\\' + id + '.sav';
const keyFor = id => prefix + encodeURIComponent(pathFor(id));
const record = (id, data, extra = {}) => [keyFor(id), JSON.stringify({ version: 1, data, ...extra })];
function engine(mode) {
  let active;
  const decode = value => {
    active.calls.push(value);
    if (active.failDecoder) throw Error('decoder sentinel');
    if (active.override !== undefined) return active.override;
    return mode === 'atob' ? atob(value) : Buffer.from(value, 'base64').toString('binary');
  };
  const context = { module: { exports: {} }, Uint8Array };
  if (mode === 'atob') {
    context.atob = decode;
    context.Buffer = { from() { throw Error('unexpected Buffer decoder'); } };
  } else {
    context.Buffer = { from(value, encoding) {
      assert.equal(encoding, 'base64');
      // Spy at the real allocating Buffer decoder entry, with its real semantics.
      const binary = decode(value);
      return { toString(kind) { assert.equal(kind, 'binary'); return binary; } };
    } };
  }
  vm.runInNewContext(source, context, { filename: sourcePath });
  return (records, options = {}) => {
    cases++;
    const values = new Map(records);
    const initialStorage = [...values];
    const original = { data: Uint8Array.of(91), attrs: 0x20 };
    const files = new Map(records.map(([key]) => {
      let path;
      try { path = decodeURIComponent(key.slice(prefix.length)).toLowerCase(); }
      catch (_) { path = key; }
      return [path, original];
    }));
    const calls = [], logs = [], parents = [], writes = [];
    active = { calls, failDecoder: options.failDecoder, override: options.override };
    const storage = {
      get length() { if (options.storageError === 'length') throw Error('storage sentinel'); return values.size; },
      key(index) { return [...values.keys()][index]; },
      getItem(key) { if (options.readErrorKey === key) throw Error('read sentinel'); return values.get(key); },
      setItem(...args) { writes.push(['set', ...args]); },
      removeItem(...args) { writes.push(['remove', ...args]); },
    };
    const api = context.module.exports.attach({ files, ensureParentDirs(path) { parents.push(path); } }, {
      storage, appId: 'independent', patterns: ['c:\\save\\*.sav'],
      maxFileBytes: options.cap === undefined ? 3 : options.cap,
      log(message) { logs.push(message); },
    });
    assert.equal(api.enabled, true);
    assert.equal(api.pendingCount, 0, 'hydration must not schedule persistence');
    assert.equal(JSON.stringify(api.lastFlush), JSON.stringify({ attempted: 0, saved: 0, failed: 0, pending: 0 }));
    assert.deepEqual(writes, []);
    assert.deepEqual([...values], initialStorage, 'restore must retain stored records');
    return { api, files, original, calls, logs, parents, writes };
  };
}
for (const mode of ['atob', 'Buffer']) {
  const restore = engine(mode);
  group(mode + ': boundary matrix, padded/unpadded/HTML whitespace, decoded mod3', () => {
    for (let cap = 1; cap <= 12; cap++) {
      for (let length = Math.max(0, cap - 2); length <= cap + 2; length++) {
        const bytes = Buffer.from(Array.from({ length }, (_, i) => (i * 71 + 255) & 255));
        const padded = bytes.toString('base64');
        const unpadded = padded.replace(/=+$/, '');
        for (const encoded of new Set([padded, unpadded,
          ' \t\n\f\r' + [...padded].join(' \t\n\f\r') + '\r\n',
          '\f' + [...unpadded].join('\t') + ' '])) {
          const r = restore([record('boundary', encoded)], { cap, failDecoder: length > cap });
          assert.equal(r.api.restored, Number(length <= cap), `cap=${cap}, length=${length}`);
          assert.deepEqual(r.calls, length <= cap ? [encoded] : [], 'raw saved string passed only if within limit');
          assert.equal(r.parents.length, Number(length <= cap));
          assert.deepEqual(r.logs, [], 'oversize is a silent skip');
          if (length <= cap) assert.deepEqual(r.files.get(pathFor('boundary')).data, new Uint8Array(bytes));
          else assert.equal(r.files.get(pathFor('boundary')), r.original);
        }
      }
    }
  });
  group(mode + ': empty and noncanonical pad bits retain native atob-compatible bytes', () => {
    for (const encoded of ['', ' \t\f\r\n', '/x==', '/x', '//9=', '//9']) {
      const r = restore([record('empty', encoded)]);
      assert.equal(r.api.restored, 1);
      assert.deepEqual(r.calls, [encoded]);
      assert.deepEqual(r.files.get(pathFor('empty')).data, Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
    }
  });
  group(mode + ': malformed alphabet and padding rejected before real decoder', () => {
    const invalid = ['A', 'AAAAA', '=', '==', '===', '====', 'A=', 'A==', 'A===',
      'AA=', 'AA===', 'AAA==', 'AAAA=', 'AAAA==', 'AA=A', '=AAA', 'A=AA',
      'AA==AA', 'AA==\n=', 'AA==\tA', 'AA-_', 'AA$=', 'AA\u00a0==', 'AA\v==',
      'AA\0==', 'AA\u2028==', 'AA\uFEFF==', 'éA==', 'ＡA==', '💾', 'AA==!'];
    for (const encoded of invalid) {
      // High bounded cap ensures parser rejection, rather than size cutoff.
      const r = restore([record('invalid', encoded)], { cap: 16, failDecoder: true });
      assert.equal(r.api.restored, 0, JSON.stringify(encoded));
      assert.deepEqual(r.calls, []);
      assert.equal(r.files.get(pathFor('invalid')), r.original);
      assert.equal(r.logs.length, 1);
      assert.match(r.logs[0], /Invalid saved file base64/);
    }
  });
  group(mode + ': early size cutoff policy and late malformed suffix never decode', () => {
    for (const encoded of ['AAAAAAAA', 'AAAAAAAA!', 'AAAAAAAA===', 'AAAAA', 'AAAAA!']) {
      const r = restore([record('oversize', encoded)], { cap: 1, failDecoder: true });
      assert.equal(r.api.restored, 0);
      assert.deepEqual(r.calls, []);
      assert.deepEqual(r.logs, [], 'size cutoff wins after fifth significant character');
    }
    const r = restore([record('invalidfirst', '!AAAAAAA')], { cap: 1, failDecoder: true });
    assert.deepEqual(r.calls, []);
    assert.match(r.logs[0], /Invalid saved file base64/);
  });
  group(mode + ': actual option normalization including default, clamp and numeric coercion', () => {
    // Source uses Math.max(1, options.maxFileBytes || 2MiB), not a zero-byte cap.
    for (const cap of [0, null, false, '', NaN]) {
      const r = restore([record('default', 'AQIDBA==')], { cap });
      assert.equal(r.api.restored, 1);
    }
    for (const cap of [-3, -Infinity, 0.5, true, '1']) {
      const r = restore([record('clamp', 'AQ=='), record('over', 'AQI=')], { cap });
      assert.equal(r.api.restored, 1);
      assert.deepEqual(r.calls, ['AQ==']);
    }
    for (const cap of [1.5, '2']) {
      const r = restore([record('one', 'AQ=='), record('two', 'AQI=')], { cap });
      assert.equal(r.api.restored, cap === 1.5 ? 1 : 2);
    }
  });
  group(mode + ': mixed skips/errors preserve later restores, metadata and counters', () => {
    const saved = { name: 'Good.SAV', attrs: 0x21,
      creationTime: { lo: -1, hi: 2 }, lastAccessTime: { lo: 3, hi: 4 },
      lastWriteTime: { lo: 5, hi: 6 } };
    const records = [record('over', 'AQIDBA=='), record('bad', 'AA=A'),
      [keyFor('json'), '{'], record('read', 'AQ=='), record('wrongversion', 'AQ==', { version: 2 }),
      record('wrongtype', null), [prefix + '%ZZ', '{}'],
      [prefix + encodeURIComponent('c:\\other\\excluded.sav'), JSON.stringify({ version: 1, data: 'AQ==' })],
      record('good', '/wAB', saved), record('empty', ''),
      record('last', 'Ag', { name: 'Wrong.SAV', attrs: 0, creationTime: { lo: '7', hi: 8 } })];
    const r = restore(records, { readErrorKey: keyFor('read') });
    assert.equal(r.api.restored, 3);
    assert.deepEqual(r.calls, ['/wAB', '', 'Ag']);
    assert.deepEqual(r.parents, ['good', 'empty', 'last'].map(pathFor));
    for (const id of ['over', 'bad', 'json', 'read', 'wrongversion', 'wrongtype'])
      assert.equal(r.files.get(pathFor(id)), r.original);
    const good = r.files.get(pathFor('good'));
    assert.equal(good.name, saved.name); assert.equal(good.attrs, saved.attrs);
    assert.deepEqual(good.data, Uint8Array.of(255, 0, 1));
    assert.equal(JSON.stringify(good.creationTime), JSON.stringify({ lo: 4294967295, hi: 2 }));
    for (const field of ['lastAccessTime', 'lastWriteTime'])
      assert.equal(JSON.stringify(good[field]), JSON.stringify(saved[field]));
    const last = r.files.get(pathFor('last'));
    assert.equal(last.attrs, 0x80); assert.equal(last.name, undefined); assert.equal(last.creationTime, undefined);
    assert.equal(r.logs.length, 4, 'invalid base64, malformed JSON, failed read, bad URI log once each');
    assert.equal(r.api.flush(), 0);
    assert.equal(JSON.stringify(r.api.lastFlush), JSON.stringify({ attempted: 0, saved: 0, failed: 0, pending: 0 }));
    assert.deepEqual(r.writes, []);
  });
  group(mode + ': decoder failure, postdecode size guard and listing error stay contained', () => {
    const fail = restore([record('first', 'AQ=='), record('last', '')], { failDecoder: true });
    assert.equal(fail.api.restored, 0); assert.equal(fail.calls.length, 2);
    assert.equal(fail.logs.length, 2);
    for (const msg of fail.logs) assert.match(msg, /decoder sentinel/);
    const guarded = restore([record('first', 'AQ==')], { override: '1234' });
    assert.equal(guarded.api.restored, 0); assert.equal(guarded.calls.length, 1);
    assert.equal(guarded.files.get(pathFor('first')), guarded.original);
    const listing = restore([record('first', 'AQ==')], { storageError: 'length' });
    assert.equal(listing.api.restored, 0); assert.deepEqual(listing.calls, []);
    assert.match(listing.logs[0], /listing failed: storage sentinel/);
  });
}
console.log(JSON.stringify({ passed: results.filter(x => x.result === 'PASS').length,
  failed: results.filter(x => x.result === 'FAIL').length, cases }));
