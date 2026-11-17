'use strict';
const assert = require('node:assert/strict');
const {createObserver, install} = require('../tools/nfs-public-timing.cjs');
const realGuard = require('../lib/cli-guarded-input');
function exercise(on) {
  let at = 100, applications = 0;
  const queue = [], renderer = {inputQueue: queue, peekKeyDownState: () => 0};
  const hostModule = {createHostImports: () => ({gpu_stream_kick(x) {
    if (x === 'throw') throw Error('render failure'); return x;
  }})};
  const guardModule = {...realGuard};
  class Server {emit(...args) {return args[0];}}
  const observer = createObserver({capacity: 16});
  if (on) install(observer, {http: {Server}, hostModule, guardModule});
  assert.equal(new Server().emit('request', {}), 'request');
  const host = hostModule.createHostImports();
  assert.equal(host.gpu_stream_kick(73), 73);
  assert.throws(() => host.gpu_stream_kick('throw'), /render failure/);
  const guard = guardModule.createGuardedInput({now: () => at, monotonic: () => at,
    snapshot: () => ({healthy: true, refs: {queue, renderer}}), cleanup() {queue.length = 0;}});
  const binding = guard.bind(), ticket = nonce => guard.prepare({...binding, nonce,
    reviewed: true, deadline: 110}, {action: 'keydown', code: 27});
  const expired = ticket('expired'); at = 111;
  assert.equal(guard.consume(expired, () => applications++).state, 'CANCELLED');
  at = 100;
  const valid = ticket('valid');
  const receipt = guard.consume(valid, () => applications++);
  assert.equal(receipt.consumed, true);
  guard.release(binding.owner);
  assert.throws(() => ticket('valid'), /already used/);
  return {applications, state: receipt.state, observer};
}
const off = exercise(false), on = exercise(true);
assert.equal(off.applications, 1); assert.equal(on.applications, 1);
assert.equal(on.state, off.state);
assert(on.observer.report().rows.some(r => r.phase === 'physical-up'));
assert(on.observer.report().rows.some(r => r.phase === 'http-entry'));
const bounded = createObserver({capacity: 8});
for (let i = 0; i < 50; i++) bounded.mark('bounded', {i});
assert.equal(bounded.report().rows.length, 8);
assert.equal(bounded.report().dropped, 42);
assert.equal(bounded.report().rows[0].i, 42);
// Interleave warmed controls to measure the observer, including ring rollover.
function cost(enabled) {
  const target = {render: x => x + 1}, observer = createObserver({capacity: 16});
  if (enabled) observer.wrap(target, 'render', 'render', undefined, 1);
  let result = 0;
  const start = performance.now();
  for (let i = 0; i < 100000; i++) result += target.render(i);
  assert.equal(result, 5000050000);
  return performance.now() - start;
}
cost(false); cost(true);
const samples = Array.from({length: 7}, () => ({offMs: cost(false), onMs: cost(true)}));
const increments = samples.map(s => (s.onMs - s.offMs) / 100000).sort((a,b) => a-b);
const medianMsPerCall = increments[3];
assert(medianMsPerCall < 0.05, 'passive observation exceeds 50us per call');
console.log(JSON.stringify({pass: true, guardSemanticsOnOff: true, bounded: true,
  samples, medianMsPerCall}));
