'use strict';
const assert = require('node:assert/strict');
const { describeSystemThunk } = require('./system-thunk-identity');
const memory = new ArrayBuffer(256), dv = new DataView(memory), b = new Uint8Array(memory);
const e = { get_thunk_base: () => 32, get_thunk_end: () => 48,
  guest_to_wasm: p => p, get_guest_base: () => 0 };
const name = 'waveOutGetErrorTextA', id = 4590;
for (const [address, nameOffset] of [[32, 80], [40, 128]]) {
  dv.setUint32(address, nameOffset - 2, true); dv.setUint32(address + 4, id, true);
  b.set(Buffer.from(name + '\0'), nameOffset);
}
const resolve = p => describeSystemThunk(e, memory, p, name, id);
assert.notEqual(resolve(32).address, resolve(40).address);
assert.equal(resolve(32).apiId, resolve(40).apiId);
assert.throws(() => assert.equal(32, 40)); // Original fixture's false rejection.
dv.setUint32(36, id + 1, true);
assert.throws(() => resolve(32), /system thunk API identity/);
dv.setUint32(36, id, true); b[80] ^= 1;
assert.throws(() => resolve(32), /system thunk imported name/); b[80] ^= 1;
assert.throws(() => resolve(33), /range\/alignment/);
assert.throws(() => resolve(48), /range\/alignment/);
dv.setUint32(32, 255, true);
assert.throws(() => resolve(32), /name bounds/);
console.log('PASS: distinct same-API thunks accepted; changed ID/name/range/alignment/name bounds rejected');
