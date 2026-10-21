'use strict';
const assert = require('assert');
const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
const serial = new BigUint64Array(memory.buffer);
Atomics.store(serial, 0, 42n);
const before = Buffer.from(memory.buffer); // candidate lines 181, 193, 205
const realSnapshot = Buffer.from(new Uint8Array(memory.buffer));
Atomics.store(serial, 0, 43n); // simulate a forbidden serial change in a rejection phase
assert.deepStrictEqual(Buffer.from(memory.buffer), before); // candidate oracle PASSES
assert.strictEqual(before.readBigUInt64LE(0), 43n);
assert.strictEqual(realSnapshot.readBigUInt64LE(0), 42n);
assert.throws(() => assert.deepStrictEqual(Buffer.from(memory.buffer), realSnapshot), assert.AssertionError);
console.log('CONFIRMED: serial changed 42 -> 43; candidate whole-memory oracle passed; copied snapshot rejected.');
