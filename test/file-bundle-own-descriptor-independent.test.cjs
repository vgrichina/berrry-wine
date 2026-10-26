'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { writeBundle } = require('../lib/file-bundle');

// Exercise the complete production host in an isolated realm, never a copied parser.
const source = fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8');
function realm() {
  const context = vm.createContext({ window: { memUtils: {} }, TextDecoder, URL });
  const run = code => vm.runInContext(code, context, { timeout: 1000 });
  run(source);
  return { run, parse: run('WineAssembly.parseFileBundle') };
}
function wire(entries, body = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(entries));
  const prefix = Buffer.alloc(8);
  prefix.write('WAB1'); prefix.writeUInt32LE(json.length, 4);
  return Buffer.concat([prefix, json, body]);
}
function keys(out) { assert.ok(out); return Array.from(out.keys()); }
function contaminated(h, descriptors, check) {
  // Explicitly restore this SAME realm, even when an assertion fails.
  h.run(`globalThis.savedFields = Object.getOwnPropertyDescriptors(Object.prototype);
    globalThis.inheritedReads = 0;
    Object.defineProperties(Object.prototype, ${descriptors});`);
  try { check(); } finally {
    h.run(`for (const key of ['f', 'size', 'status']) {
      if (Object.hasOwn(savedFields, key)) Object.defineProperty(Object.prototype, key, savedFields[key]);
      else delete Object.prototype[key];
    }`);
    assert.equal(h.run("['f','size','status'].every(k => Object.hasOwn(Object.prototype,k) === Object.hasOwn(savedFields,k))"), true);
  }
}

test('own-field subsets reject inherited substitutes, including a misleading second own key', () => {
  const h = realm();
  contaminated(h, '{ f: {value:"borrowed", configurable:true}, size: {value:0, configurable:true}, status: {value:404, configurable:true} }', () => {
    const bad = [{}, { extra: 1 }, { size: 0 }, { status: 404 }, { status: 413 },
      { size: 0, extra: 1 }, { status: 404, extra: 1 }, { status: 413, extra: 1 },
      { f: 'own' }, { f: 'own', extra: 1 }, { extra: 1, another: 2 }];
    for (const entry of bad) {
      assert.equal(h.parse(wire([{ f: 'prior', size: 0 }, entry])), null, JSON.stringify(entry));
    }
    assert.deepEqual(keys(h.parse(wire([{ f: 'own', size: 0 }]))), ['own']);
    assert.equal(h.parse(wire([{ f: 'own', status: 413 }])).size, 0);
  });
  assert.equal(h.parse(wire([{ size: 0, extra: 1 }])), null);
});

test('missing own f never reads inherited throwing getter; cleanup restores same parser', () => {
  const h = realm();
  contaminated(h, '{f:{configurable:true,get(){inheritedReads++;throw Error("inherited f read");}}}', () => {
    for (const fields of [{ size: 0 }, { status: 404 }, { status: 413 }]) {
      assert.equal(h.parse(wire([{ ...fields, other: true }])), null);
    }
    assert.equal(h.run('inheritedReads'), 0);
    assert.deepEqual(keys(h.parse(wire([{ f: 'own', size: 0 }]))), ['own']);
  });
  assert.deepEqual(keys(h.parse(wire([{ f: 'restored', size: 0 }]))), ['restored']);
  assert.equal(realm().run('Object.hasOwn(Object.prototype,"f")'), false);
});

test('unused inherited size/status getters do not interfere with either own descriptor kind', () => {
  const h = realm();
  contaminated(h, '{size:{configurable:true,get(){inheritedReads++;throw Error("size");}},status:{configurable:true,get(){inheritedReads++;throw Error("status");}}}', () => {
    const out = h.parse(wire([{ f: 'empty', size: 0 }, { f: 'missing', status: 404 },
      { f: 'large', status: 413 }, { f: 'last', size: 1 }], Buffer.from([255])));
    assert.deepEqual(keys(out), ['empty', 'last']);
    assert.deepEqual(Array.from(out.get('last')), [255]);
    assert.equal(h.parse(wire([{ f: 'missing-own', extra: 0 }])), null);
    assert.equal(h.run('inheritedReads'), 0);
  });
});

test('own prototype-like wire fields are inert extra keys and cannot supply f', () => {
  const h = realm();
  for (const key of ['__proto__', 'constructor', 'hasOwnProperty', 'toString']) {
    const entry = JSON.parse(`{"${key}":{"f":"forged"},"size":0}`);
    assert.equal(h.parse(wire([entry])), null);
    assert.equal(h.parse(wire([{ f: 'own', size: 0, [key]: 0 }])), null);
  }
  assert.equal(h.run('Object.hasOwn(Object.prototype,"f")'), false);
  assert.deepEqual(keys(h.parse(wire([{ f: '__proto__', size: 0 }, { f: 'constructor', status: 404 }]))), ['__proto__']);
});

test('valid zero/error descriptors and binary body respect exact offset views', () => {
  const h = realm();
  const names = ['', 'f', 'size', 'status', '__proto__', 'a,b', '雪'];
  const bytes = wire([{ f: 'absent', status: 404 }, ...names.map(f => ({ size: 0, f })),
    { f: 'large', status: 413 }, { size: 3, f: 'bytes' }, { f: 'tail', size: 0 }], Buffer.from([0, 128, 255]));
  for (const offset of [1, 3, 16]) {
    const backing = new Uint8Array(bytes.length + offset + 8).fill(0xff);
    backing.set(bytes, offset);
    const out = h.parse(backing.subarray(offset, offset + bytes.length));
    assert.deepEqual(keys(out), [...names, 'bytes', 'tail']);
    assert.deepEqual(Array.from(out.get('bytes')), [0, 128, 255]);
    for (const value of out.values()) assert.equal(value.buffer, backing.buffer);
    assert.equal(out.get('tail').byteOffset, offset + bytes.length);
    backing[offset + bytes.length - 1] = 17;
    assert.equal(out.get('bytes')[2], 17); // Establish aliasing, not merely equal bytes.
  }
});

test('duplicate reservation includes error names under contamination in both orders', () => {
  const h = realm();
  contaminated(h, '{f:{value:"irrelevant",configurable:true}}', () => {
    for (const name of ['', '__proto__', 'a,b']) {
      for (const a of [{ size: 0 }, { size: 1 }, { status: 404 }, { status: 413 }]) {
        for (const b of [{ size: 0 }, { size: 1 }, { status: 404 }, { status: 413 }]) {
          assert.equal(h.parse(wire([{ f: name, ...a }, { f: name, ...b }],
            Buffer.alloc((a.size || 0) + (b.size || 0)))), null);
        }
      }
    }
  });
});

test('every truncated view rejects despite complete backing buffer; trailing data rejects', () => {
  const h = realm();
  const bytes = wire([{ f: 'ok', size: 1 }, { f: 'empty', size: 0 }, { f: 'err', status: 413 }], Buffer.from('x'));
  const backing = Buffer.concat([Buffer.from('pad'), bytes, Buffer.from('hidden')]);
  for (let end = 0; end < bytes.length; end++) {
    assert.equal(h.parse(backing.subarray(3, 3 + end)), null, `length ${end}`);
  }
  assert.deepEqual(keys(h.parse(backing.subarray(3, 3 + bytes.length))), ['ok', 'empty']);
  for (let extra = 1; extra <= 6; extra++) assert.equal(h.parse(backing.subarray(3, 3 + bytes.length + extra)), null);
  for (const n of [0, 1, 0x80000000, 0xffffffff]) {
    const bad = Buffer.from(bytes); bad.writeUInt32LE(n, 4); assert.equal(h.parse(bad), null);
  }
});

test('actual server writeBundle response is compatible in polluted and restored parser realm', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'own-descriptor-server-'));
  try {
    fs.writeFileSync(path.join(dir, 'a,b'), Buffer.from([0, 255, 127]));
    fs.writeFileSync(path.join(dir, '雪'), '');
    let status, headers, bytes;
    await writeBundle({ writeHead(s, h) { status = s; headers = h; }, end(b) { bytes = b; } },
      ['missing', 'a,b', '雪', 'throws'], name => {
        if (name === 'missing') return null;
        if (name === 'throws') throw Error('resolver fixture');
        return path.join(dir, name);
      });
    assert.equal(status, 200); assert.equal(headers['Content-Length'], bytes.length);
    assert.equal(headers['Content-Type'], 'application/octet-stream');
    const h = realm();
    function check() {
      const out = h.parse(bytes);
      assert.deepEqual(keys(out), ['a,b', '雪']);
      assert.deepEqual(Array.from(out.get('a,b')), [0, 255, 127]);
      assert.equal(out.get('雪').length, 0);
    }
    contaminated(h, '{f:{value:"forged",configurable:true},size:{value:19,configurable:true},status:{value:413,configurable:true}}', check);
    check();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
