'use strict';

// Actual endpoint, software executor, shared ring and Atomics.waitAsync.
// Empty rings need no native exports; this tests notification lifetime only.
const assert = require('node:assert/strict');
const Endpoint = require('../lib/gpu-stream-render-worker');
const Doorbell = require('../lib/gpu-stream-doorbell');
const { CONST } = require('../lib/gpu-stream');
const { makeProducer } = require('./gpu-stream-fixture');

const tick = () => new Promise(resolve => setTimeout(resolve, 2));
async function until(predicate, label) {
  const end = performance.now() + 2000;
  while (!predicate()) {
    assert(performance.now() < end, label);
    await tick();
  }
}

async function observe(reopens) {
  const producer = makeProducer();
  const queue = [];
  const endpoint = Endpoint.create({
    instance: { exports: {} }, memory: { buffer: producer.buffer },
    backend: 'software', endpointId: 9,
    schedule(fn) { queue.push(fn); },
    sendFrame() { assert.fail('empty ring cannot present a frame'); },
  });
  const kick = mode => endpoint.execute({ t: 'gps-kick', ring: producer.header, mode });
  try {
    kick(CONST.KICK_ASYNC);
    for (let i = 0; i < reopens; i++) {
      // Closing notifies the old waiter. Reuse the same address before its
      // promise callback runs, as a new stream on the same endpoint can do.
      kick(CONST.KICK_CLOSE);
      kick(CONST.KICK_ASYNC);
      await until(() => queue.length === i + 1, 'retired notification queued');
    }
    const alreadyQueued = queue.length;
    Doorbell.ring(producer.i32, producer.header);
    await until(() => queue.length > alreadyQueued, 'current notification queued');
    while (queue.length) await queue.shift()();
    const reply = kick(CONST.KICK_ASYNC);
    assert.equal(reply.stats.records, 0);
    return reply.stats.doorbellDrains;
  } finally {
    endpoint.destroy();
    await tick();
    while (queue.length) await queue.shift()();
  }
}

(async () => {
  assert(Doorbell.supported(), 'this regression requires actual Atomics.waitAsync');
  const ordinary = await observe(0);
  assert.equal(ordinary, 1, 'one current notification has one drain');
  console.log('PASS ordinary real doorbell notification drains once');
  const reopened = await observe(1);
  console.log(JSON.stringify({ ordinary, reopened, scope: 'Node notification lifetime; no native GPU or WASM' }));
  assert.equal(reopened, 1, 'a retired notification cannot drain or subscribe to the reopened stream');
  assert.equal(await observe(3), 1, 'repeated reopen cannot accumulate retired subscriptions');
  console.log('PASS closed-stream notification cannot join its replacement at the same address');
})().catch(error => { console.error(error); process.exitCode = 1; });
