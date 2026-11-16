#!/usr/bin/env node
'use strict';
// A SYNC doorbell waiter must tell a render Worker that is busy inside one
// long record from one that is gone.
//
// Browser Threads, Hexen II on the default software+gps renderer: the WebGL
// executor's first draw compiles its programs, and with SwiftShader shared
// with a busy page one record ran past the 30s stall bound. read_pos cannot
// move until the record returns, so the guest trapped with "render Worker
// made no progress for 30000 ms" while the Worker was working. The consumer
// now marks itself BUSY around a drain; an idle consumer keeps the short
// bound, and a detached ring cannot be re-armed by a late BUSY.
const assert = require('node:assert/strict');
const Doorbell = require('../lib/gpu-stream-doorbell');

const RING = 4096;
const i32 = new Int32Array(new SharedArrayBuffer(RING + Doorbell.HEADER_BYTES));
const word = name => (RING >> 2) + Doorbell.W[name];
const publishOne = () => { Atomics.store(i32, word('write_pos'), 64); Atomics.store(i32, word('read_pos'), 0); };

// Token keeps its value; BUSY is a separate bit and does not disarm.
Doorbell.attach(i32, RING, 7);
assert.equal(Atomics.load(i32, word('consumer')), 7);
Doorbell.busy(i32, RING, true);
assert.equal(Atomics.load(i32, word('consumer')), 7 | Doorbell.BUSY);
assert.equal(Doorbell.armed(i32, RING), true);
Doorbell.busy(i32, RING, false);
assert.equal(Atomics.load(i32, word('consumer')), 7);
// A token cannot smuggle the BUSY bit in.
Doorbell.attach(i32, RING, Doorbell.BUSY | 3);
assert.equal(Atomics.load(i32, word('consumer')), 3);
console.log('PASS BUSY bit is separate from the consumer token');

// Idle consumer: the short bound still fails loudly.
publishOne();
let t0 = Date.now();
assert.throws(() => Doorbell.waitDrained(i32, RING, { stallMs: 60, busyStallMs: 5000 }),
  /render Worker made no progress for 60 ms/);
assert(Date.now() - t0 < 2000, 'idle consumer is not given the busy allowance');
console.log('PASS idle consumer still stalls out at the short bound');

// Busy consumer: survives far past the short bound, then the long bound applies.
Doorbell.busy(i32, RING, true);
t0 = Date.now();
assert.throws(() => Doorbell.waitDrained(i32, RING, { stallMs: 60, busyStallMs: 600 }),
  /render Worker made no progress for 600 ms/);
const waited = Date.now() - t0;
assert(waited >= 550, `busy consumer kept waiting past the idle bound (${waited}ms)`);
Doorbell.busy(i32, RING, false);
console.log(`PASS busy consumer waited ${waited}ms before the long bound`);

// A detached ring stays detached even if the consumer's finally runs late.
Doorbell.detach(i32, RING);
Doorbell.busy(i32, RING, true);
assert.equal(Atomics.load(i32, word('consumer')), 0);
assert.equal(Doorbell.armed(i32, RING), false);
assert.deepEqual(Object.keys(Doorbell.waitDrained(i32, RING, { stallMs: 60 })).sort(), ['drained', 'ms']);
assert.equal(Doorbell.waitDrained(i32, RING, { stallMs: 60 }).drained, false);
console.log('PASS late BUSY cannot re-arm a detached ring');
