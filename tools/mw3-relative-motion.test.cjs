'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {request, completion, correlate} = require('./mw3-relative-motion.cjs');
function fixture() {
  const memory = {buffer: new ArrayBuffer(8192)}, d = new DataView(memory.buffer);
  const put = (p, n) => d.setUint32(p, n >>> 0, true);
  let esp = 1024, eax = 0;
  const ex = {guest_to_wasm: a => a, get_esp: () => esp, get_eax: () => eax};
  [999, 2048, 16, 3072].forEach((n, i) => put(esp + i * 4, n));
  put(2052, 0); put(4096, 7); put(4104, 2); put(4116, 16); put(4124, 0x400);
  return {memory, ex, put, layout: {objectsBase: 4096, objectsSize: 32, stateBase: 5000},
    finish: n => {esp += 16; eax = n;}};
}
test('complete mouse request, stack, device, HRESULT and signed state', () => {
  const f = fixture(), r = request(f.ex, f.memory, f.layout);
  f.put(3072, -8); f.put(3076, 3); f.finish(0);
  const c = completion(f.ex, f.memory, r);
  assert.equal(c.dx, -8); assert.equal(c.dy, 3); assert.equal(c.state.length, 16);
  f.put(1028, 2049); assert.throws(() => completion(f.ex, f.memory, r), /thisPtr/);
});
test('failed completion cannot present a successful state', () => {
  const f = fixture(), r = request(f.ex, f.memory, f.layout); f.finish(0x8007000c);
  assert.equal(completion(f.ex, f.memory, r).state, null);
});
test('device replacement and absolute/custom/unacquired formats refuse', () => {
  for (const [p, n] of [[5000, 1], [4124, 0xc00], [4124, 0], [4116, 20]]) {
    const f = fixture(); f.put(p, n); assert.throws(() => request(f.ex, f.memory, f.layout));
  }
  const f = fixture(), r = request(f.ex, f.memory, f.layout); f.finish(0); f.put(4124, 0xc00);
  assert.throws(() => completion(f.ex, f.memory, r), /device changed/);
});
test('trusted delivery and ACKs do not imply consumed motion', () => {
  const motion = {steps: [{dx: -8, dy: 3, attemptedAt: 10, ackAt: 40}], completedAt: 50};
  const events = [{at: 30, type: 'mousemove', movementX: -8, movementY: 3, trusted: true}];
  assert.deepEqual(correlate({motion, events, records: []}).consumedDelta, [0, 0]);
  const records = [{requestAt: 20, at: 25, eax: 0, state: Array(16).fill(0), dx: -8, dy: 3}];
  assert.deepEqual(correlate({motion, events, records}).consumedDelta, [-8, 3]);
  records[0].eax = 1;
  assert.equal(correlate({motion, events, records}).successfulReads, 0);
  events[0].trusted = false; assert.throws(() => correlate({motion, events, records}), /trusted/);
});
