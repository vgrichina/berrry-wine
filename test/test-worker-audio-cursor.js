#!/usr/bin/env node
'use strict';

// Worker mode's DirectSound fast path: the page's AudioWorklet router keeps its
// voice descriptors in the guest's shared memory (lib/guest-rpc.js AUDIO_BASE)
// and publishes which voices it renders, so a guest Worker answers
// voice_get_pos from the worklet's own CURSOR and sends a routed ring's refresh
// Unlock without waiting for the page. Everything else -- an unrouted voice, a
// changed ring, a suspended AudioContext, a released voice -- still takes the
// blocking round trip.

const assert = require('assert');
const RPC = require('../lib/guest-rpc');
const { createWorkletRouter, DESC } = require('../lib/audio-worklet-host');

class FakeAudioWorkletNode {
  constructor(ac, name, opts) { this.opts = opts; }
  connect() {}
  disconnect() {}
}

(async () => {
  const oldNode = globalThis.AudioWorkletNode;
  globalThis.AudioWorkletNode = FakeAudioWorkletNode;
  try {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const ac = { audioWorklet: { addModule: () => Promise.resolve() }, destination: {} };
    const router = createWorkletRouter({ rpc: RPC });
    router.ensureModule(ac);
    await Promise.resolve(); await Promise.resolve();
    assert.strictEqual(router.moduleState, 'ready');

    const VOICE = 0x0B0001, PTR = 0x1000, LEN = 1280;
    const v = { id: VOICE, rate: 22050, channels: 1, bits: 8 };
    assert(router.route({}, ac, v, memory.buffer, PTR, LEN, 0, 1), 'a looping ring is routed');
    assert(router.sharesGuestMemory, 'the control block lives in guest shared memory');
    assert.strictEqual(router.controlOffset, RPC.AUDIO_BASE);
    const node = v.workletNode;
    assert.strictEqual(node.opts.processorOptions.controlOffset, RPC.AUDIO_BASE,
      'the processor is pointed at the same block');

    // The worklet publishes its cursor.
    const desc = new Int32Array(memory.buffer, RPC.AUDIO_BASE, RPC.AUDIO_VOICES * DESC.STRIDE);
    Atomics.store(desc, v.workletSlot * DESC.STRIDE + DESC.CURSOR, LEN + 700);

    const posted = [];
    const post = msg => {
      posted.push(msg);
      if (msg.t === 'rpc') {
        const b = RPC.views(memory, 1);
        b.i32[RPC.SLOT.RESULT] = 42;
        Atomics.store(b.i32, RPC.SLOT.STATUS, RPC.STATUS_RESP);
      }
    };
    const sigs = {
      voice_get_pos: { params: ['i32'], results: ['i32'] },
      voice_play_ring: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: ['i32'] },
      voice_refresh_ring: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: ['i32'] },
    };
    const { imports, stats } = RPC.createWorkerImports(memory, sigs, post, { slot: 1 });
    const host = imports.host;

    assert.strictEqual(host.voice_get_pos(VOICE), 700, 'routed cursor read locally, wrapped to the ring');
    assert.strictEqual(posted.length, 0, 'without a round trip');
    assert.strictEqual(stats.local, 1);

    assert.strictEqual(host.voice_play_ring(VOICE, PTR, LEN, 0, 2), 0);
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].t, 'call', 'a routed refresh is posted, not waited on');
    assert.deepStrictEqual(posted[0].args, [VOICE, PTR, LEN, 0, 2]);

    posted.length = 0;
    assert.strictEqual(host.voice_refresh_ring(VOICE, PTR, LEN, LEN-12, 24), 0);
    assert.strictEqual(posted[0].t, 'call', 'exact-span routed refresh remains asynchronous');
    assert.deepStrictEqual(posted[0].args, [VOICE, PTR, LEN, LEN-12, 24]);
    posted.length = 0;
    host.voice_refresh_ring(VOICE, PTR, LEN*2, LEN-12, 24);
    assert.strictEqual(posted[0].t, 'rpc', 'changed exact-span extent blocks');
    posted.length = 0;
    host.voice_refresh_ring(VOICE+1, PTR, LEN, 0, 24);
    assert.strictEqual(posted[0].t, 'rpc', 'unrouted exact-span refresh blocks');

    posted.length = 0;
    host.voice_play_ring(VOICE, PTR, LEN * 2, 0, 2);
    assert.strictEqual(posted[0].t, 'rpc', 'a refresh of a different extent blocks');
    posted.length = 0;
    host.voice_play_ring(VOICE, PTR, LEN, 0, 1);
    assert.strictEqual(posted[0].t, 'rpc', 'a Play blocks');
    posted.length = 0;
    assert.strictEqual(host.voice_get_pos(VOICE + 1), 42, 'an unrouted voice asks the page');
    assert.strictEqual(posted[0].t, 'rpc');

    posted.length = 0;
    router.setRunning(false);
    assert.strictEqual(host.voice_get_pos(VOICE), 42, 'a suspended context: the page answers');
    router.setRunning(true);
    assert.strictEqual(host.voice_get_pos(VOICE), 700, 'running again: local again');

    posted.length = 0;
    router.release(v);
    assert.strictEqual(host.voice_get_pos(VOICE), 42, 'a released voice asks the page');
    assert.strictEqual(posted[0].t, 'rpc');

    // A buffer too small to hold the block keeps the side buffer, as before.
    const small = createWorkletRouter({ rpc: RPC });
    small.ensureModule(ac);
    await Promise.resolve(); await Promise.resolve();
    const w = { id: 7, rate: 22050, channels: 1, bits: 8 };
    assert(small.route({}, ac, w, new SharedArrayBuffer(65536), 0, 1024, 0, 1));
    assert(!small.sharesGuestMemory, 'no reserved block, no guest-visible map');

    console.log('PASS worker audio cursor: routed voices answer voice_get_pos and refresh Unlocks without a page round trip');
  } finally {
    globalThis.AudioWorkletNode = oldNode;
  }
})().catch(err => { console.error(err); process.exit(1); });
