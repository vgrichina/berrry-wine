'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8');
function host(pollution = '') {
  const context = vm.createContext({ window: { memUtils: {} }, TextDecoder, URL });
  vm.runInContext(source, context, { timeout: 1000 });
  vm.runInContext(pollution, context, { timeout: 1000 });
  return vm.runInContext('WineAssembly.parseFileBundle', context);
}
function frame(entries, body = '') {
  const json = Buffer.from(JSON.stringify(entries));
  const prefix = Buffer.alloc(8);
  prefix.write('WAB1'); prefix.writeUInt32LE(json.length, 4);
  return Buffer.concat([prefix, json, Buffer.from(body)]);
}

test('missing own f rejects success and both errors despite inherited name', () => {
  for (const pollution of ['', 'Object.prototype.f = "inherited"',
    'Object.defineProperty(Object.prototype, "f", { get() { throw Error("must not read inherited f"); } })']) {
    const parse = host(pollution);
    for (const fields of [{ size: 1 }, { status: 404 }, { status: 413 }]) {
      for (const extra of [{}, { extra: 'unexpected' }]) {
        assert.equal(parse(frame([{ f: 'prior', size: 0 }, { ...fields, ...extra }], fields.size ? 'x' : '')), null);
      }
    }
  }
});

test('all required fields must be own; inherited size/status never complete a descriptor', () => {
  const parse = host('Object.prototype.f = "inherited"; Object.prototype.size = 0; Object.prototype.status = 404');
  for (const entry of [{ f: 'own' }, { f: 'own', extra: 0 }, { extra: 0, other: 1 }]) {
    assert.equal(parse(frame([entry])), null);
  }
  assert.equal(parse(frame([{ f: 'own', size: 0 }])).get('own').length, 0);
  for (const status of [404, 413]) assert.equal(parse(frame([{ status, f: 'own' }])).size, 0);
});

test('own f validation rejects nonstrings and extra keys under contamination', () => {
  const parse = host('Object.prototype.f = "inherited"');
  for (const f of [null, 0, false, [], {}]) {
    for (const fields of [{ size: 0 }, { status: 404 }, { status: 413 }]) {
      assert.equal(parse(frame([{ f, ...fields }])), null);
    }
  }
  for (const fields of [{ size: 0 }, { status: 404 }, { status: 413 }]) {
    assert.equal(parse(frame([{ f: 'own', ...fields, extra: 0 }])), null);
  }
});

test('own names, zero sizes, offset views and error ordering survive polluted realm', () => {
  for (const pollution of ['', 'Object.prototype.f = "inherited"; Object.prototype.size = 7; Object.prototype.status = 404']) {
    const parse = host(pollution);
    const names = ['', '__proto__', 'constructor', 'hasOwnProperty', '雪,a'];
    const wire = frame([{ f: 'missing', status: 404 }, ...names.map(f => ({ size: 0, f })),
      { status: 413, f: 'large' }, { size: 1, f: 'present' }], 'x');
    const storage = new Uint8Array(wire.length + 11); storage.set(wire, 5);
    const view = storage.subarray(5, 5 + wire.length);
    const out = parse(view);
    assert.deepEqual(Array.from(out.keys()), [...names, 'present']);
    for (const name of names) assert.equal(out.get(name).length, 0);
    assert.equal(Buffer.from(out.get('present')).toString(), 'x');
    assert.equal(out.get('present').buffer, storage.buffer);
    assert.equal(out.get('present').byteOffset, 5 + wire.length - 1);
    assert.equal(parse(frame([{ f: 'same', status: 404 }, { f: 'same', size: 0 }])), null);
    assert.equal(parse(frame([], 'trailing')), null);
  }
  assert.equal(host()(frame([{ size: 1, extra: 'unexpected' }], 'x')), null);
});
