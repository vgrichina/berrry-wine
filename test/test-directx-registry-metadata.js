#!/usr/bin/env node
'use strict';
const assert = require('assert');
const storage = require('../lib/storage');
const { g2w } = require('../lib/mem-utils');
const memory = new ArrayBuffer(0x30000), bytes = new Uint8Array(memory), dv = new DataView(memory);
const base = 0x400000, wa = p => g2w(p, base);
const api = storage.createStorageImports({getMemory: () => memory, exports: {get_image_base: () => base}});
const key = base + 0x1000, name = base + 0x1100, type = base + 0x1200;
const data = base + 0x1300, size = base + 0x1400;
const put = (p, s, wide = 0) => bytes.set(Buffer.from(s + '\0', wide ? 'utf16le' : 'latin1'), wa(p));
const u32 = p => dv.getUint32(wa(p), true);
const set32 = (p, n) => dv.setUint32(wa(p), n, true);
put(key, 'Software\\Microsoft\\Directx');
storage.clearStore();
assert.strictEqual(api.reg_open_key(0x80000002, wa(key), 0), 0, 'fresh state invents no DirectX key');
// Test supplied metadata, not a capability policy or the stopped installation.
storage.setRegValue('HKLM\\Software\\Microsoft\\DirectX', 'Version', 1, '1.02.003.0004');
const h = api.reg_open_key(0x80000002, wa(key), 0);
assert(h);
for (const wide of [0, 1]) {
  put(name, 'vErSiOn', wide);
  const expected = Buffer.from('1.02.003.0004\0', wide ? 'utf16le' : 'latin1');
  set32(size, 0);
  assert.strictEqual(api.reg_query_value(h, wa(name), type, 0, size, wide), 0);
  assert.strictEqual(u32(type), 1); assert.strictEqual(u32(size), expected.length);
  bytes.fill(0xa5, wa(data), wa(data) + 64); set32(size, expected.length - 1);
  assert.strictEqual(api.reg_query_value(h, wa(name), type, data, size, wide), 234);
  assert.strictEqual(u32(size), expected.length);
  assert(bytes.subarray(wa(data), wa(data) + 64).every(v => v === 0xa5));
  set32(size, expected.length);
  assert.strictEqual(api.reg_query_value(h, wa(name), type, data, size, wide), 0);
  assert.deepStrictEqual(Buffer.from(bytes.subarray(wa(data), wa(data) + expected.length)), expected);
  assert.strictEqual(bytes[wa(data) + expected.length], 0xa5, 'terminator/width bounded');
}
put(name, 'InstalledVersion'); set32(size, 64);
assert.strictEqual(api.reg_query_value(h, wa(name), type, data, size, 0), 2, 'no binary twin invented');
const snapshot = storage.exportStore();
storage.clearStore(); storage.importStore(snapshot);
assert(api.reg_open_key(0x80000002, wa(key), 0), 'imported installer metadata retained');
storage.clearStore();
assert.strictEqual(api.reg_open_key(0x80000002, wa(key), 0), 0, 'reset does not reseed version');
console.log('PASS DirectX registry absence, supplied metadata, A/W sizes, canaries, errors and restore');
