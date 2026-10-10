#!/usr/bin/env node
'use strict';
// No guest execution: real audio host, renderer DSP, RPC broker, kernel event
// table and a genuinely blocked native Worker. Root owns running this test.
const assert = require('assert');
const { Worker } = require('worker_threads');
const { createAudioHost } = require('../lib/host-audio');
const { WineVoiceProcessor, DESC } = require('../lib/audio-voice-worklet');
const { DESC: HOST_DESC } = require('../lib/audio-worklet-host');
const RPC = require('../lib/guest-rpc');
const { ThreadManager } = require('../lib/thread-manager');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;

class Node {
  connect(n) { return n; }
  disconnect() {}
}
class AC {
  constructor() {
    this.currentTime = 0; this.state = 'running'; this.sampleRate = 1000;
    this.destination = new Node(); this.audioWorklet = { addModule: async () => {} };
  }
  createGain() { const n = new Node(); n.gain = { value: 1 }; return n; }
  createStereoPanner() { const n = new Node(); n.pan = { value: 0 }; return n; }
  createBuffer(ch, len, rate) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { duration: len / rate, getChannelData: c => data[c] };
  }
  createBufferSource() {
    const n = new Node(); n.playbackRate = { value: 1 }; n.start = () => {}; n.stop = () => {};
    return n;
  }
}
class WorkletNode extends Node {
  constructor(ac, name, opts) {
    super(); this.processor = new WineVoiceProcessor({
      processorOptions: { ...opts.processorOptions, contextRate: ac.sampleRate },
    });
  }
  render(frames) { return this.processor.process([], [[new Float32Array(frames), new Float32Array(frames)]]); }
}

(async () => {
  assert.deepStrictEqual(HOST_DESC, DESC, 'descriptor ABI agrees on both threads');
  assert.deepStrictEqual(sigs.voice_notify_set, { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] });
  // The broker lives in the established high RPC region. This is deliberately
  // not a small-memory toy layout, and must stay in the serialized test lane.
  const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
  let now = 0, tm = null;
  const signals = [];
  const ctx = { getMemory: () => memory.buffer, audioClockMs: () => now };
  const audio = createAudioHost(ctx, {
    readStr: () => '', readStrW: () => '', readVfsFile: () => null,
    readVfsFileAsync: async () => null, profileNow: () => 0, profileEvent: () => {},
    getHost: () => host,
  });
  const host = { ...audio.imports, set_event: h => {
    signals.push(h >>> 0); if (tm) tm.setEvent(h); return 1;
  } };
  const data = new DataView(memory.buffer), array = 4096, pcm = 16384;
  new Uint8Array(memory.buffer, pcm, 100).fill(128);
  const register = (id, entries) => {
    entries.forEach(([off, h], i) => { data.setUint32(array + i * 8, off, true); data.setUint32(array + i * 8 + 4, h, true); });
    return host.voice_notify_set(id, array, entries.length, 100) >>> 0;
  };
  const id = host.voice_open(1000, 1, 8);
  assert.strictEqual(register(id, [[0, 10], [25, 11], [25, 12], [99, 13], [0xffffffff, 14]]), 0);
  data.setUint32(array + 12, 999, true);
  host.voice_play_ring(id, pcm, 100, 0, 1);
  assert.deepStrictEqual(signals.splice(0), [10], 'offset zero at playback start');
  now = 300; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [10, 11, 12, 13], 'three whole laps, duplicate offsets, copied handles');
  assert.strictEqual(register(id, []), 0x88780032, 'live replacement is atomic');
  now = 325; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [11, 12]);
  host.voice_play_ring(id, pcm, 100, 0, 2); // refresh must retain timeline
  now = 350; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), []);
  host.voice_set_freq(id, 2000);
  now = 375; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [10, 13], 'frequency integrates previous rate rather than scaling history');
  host.voice_play_ring(id, pcm, 100, 70, 1); // live seek: no swept seek interval
  assert.deepStrictEqual(signals.splice(0), []);
  now = 390; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [10, 13], 'seek resumes at new offset and wraps');
  host.voice_stop(id);
  assert.deepStrictEqual(signals.splice(0), [14], 'explicit stop sentinel');
  now += 1000; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [], 'stopped playback produces no crossings');
  assert.strictEqual(ctx._voices._notifyTimer, null, 'idle registrations have no polling timer');
  assert.strictEqual(register(id, [[50, 20], [0xffffffff, 21]]), 0);
  assert.strictEqual(register(id, [[100, 999]]), 0x80070057);
  assert.strictEqual(register(id, [[25, 0]]), 0x80070057);
  assert.strictEqual(register(id, [[25, 0x800e0000]]), 0x80070057, 'reject internal ReleaseMutex tag');
  host.voice_set_freq(id, 1000);
  host.voice_play_ring(id, pcm, 100, 40, 0);
  now += 60; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [20, 21], 'nonzero-start one-shot signals position and natural stop');
  audio.pumpWaveOutCompletions(); assert.deepStrictEqual(signals.splice(0), [], 'end only once');
  assert.strictEqual(register(id, []), 0);
  host.voice_play_ring(id, pcm, 100, 0, 1); now += 200; audio.pumpWaveOutCompletions();
  assert.deepStrictEqual(signals.splice(0), [], 'clear disables delivery'); host.voice_stop(id);

  // Actual worklet rendering drives notifications, even if host/guest clocks
  // jump ahead or do not advance at all. Suspend renders no frames.
  const savedNode = globalThis.AudioWorkletNode;
  globalThis.AudioWorkletNode = WorkletNode;
  try {
    // Match the worker host: Unlock may promote a live shared ring after module loading.
    ctx.liveAudioRing = true;
    const ac = new AC(); ctx._voices._ac = ac;
    assert.strictEqual(register(id, [[25, 30], [0xffffffff, 31]]), 0);
    host.voice_play_ring(id, pcm, 100, 0, 1);
    await Promise.resolve(); await Promise.resolve();
    host.voice_play_ring(id, pcm, 100, 0, 2); // promote once module is ready
    const voice = ctx._voices._map[id], node = voice.workletNode;
    assert(node, 'ring routed to the real DSP processor');
    now += 10000; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'clock jump cannot fabricate worklet consumption');
    node.render(325); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [30], 'complete worklet laps retained');
    host.voice_play_ring(id, pcm, 100, 0, 2);
    node.render(100); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [30], 'refresh does not reset progress epoch');
    host.voice_set_freq(id, 2000);
    node.render(100); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [30], 'worklet frequency follows actual resampling');
    host.voice_set_freq(id, 1000);
    host.voice_play_ring(id, pcm, 100, 70, 1);
    audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'old-epoch progress ignored after seek');
    node.render(55); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [30], 'seek epoch uses new origin');
    ac.state = 'suspended'; now += 10000; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), []);
    assert.strictEqual(host.voice_is_playing(id), 1, 'suspension preserves playback');
    host.voice_close(id); node.render(100); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'release suppresses stop and stale worklet progress');
    assert.strictEqual(ctx._voices._notifyTimer, null);
    ac.state = 'running';
    const reused = host.voice_open(1000, 1, 8);
    assert.strictEqual(register(reused, [[25, 32]]), 0);
    host.voice_play_ring(reused, pcm, 100, 0, 1);
    const newNode = ctx._voices._map[reused].workletNode;
    assert(newNode);
    node.render(125); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'retired node cannot publish into reused slot progress');
    newNode.render(25); audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [32]);
    host.voice_play_ring(reused, pcm, 100, 0, 0);
    assert.strictEqual(ctx._voices._map[reused].workletNode, null, 'one-shot retires looping renderer');
    ac.currentTime += 0.1; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [32], 'one-shot continues on actual source clock');
    host.voice_close(reused);
    ctx.audioWorklet = false; ac.baseLatency = 0.02;
    const sourceVoice = host.voice_open(1000, 1, 8);
    assert.strictEqual(register(sourceVoice, [[25, 40], [0xffffffff, 41]]), 0);
    host.voice_play_ring(sourceVoice, pcm, 100, 0, 1);
    ac.currentTime += 0.03; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'device latency delays source-clock crossing');
    host.voice_set_freq(sourceVoice, 2000);
    ac.currentTime += 0.01; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'old-rate audio remains in latency window');
    ac.currentTime += 0.006; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [40], 'latency history crosses offset at its original rate');
    ac.state = 'suspended'; now += 10000; audio.pumpWaveOutCompletions();
    assert.deepStrictEqual(signals.splice(0), [], 'suspended output does not follow guest time');
    host.voice_stop(sourceVoice);
    assert.deepStrictEqual(signals.splice(0), [41]);
    host.voice_close(sourceVoice); delete ctx.audioWorklet;
    ctx._voices._ac = null;
  } finally {
    if (savedNode === undefined) delete globalThis.AudioWorkletNode;
    else globalThis.AudioWorkletNode = savedNode;
  }

  // Real kernel table + broker + blocked Worker. The completion timer must
  // wake this waiter without GetCurrentPosition or a guest-slice pump.
  tm = new ThreadManager({}, memory, { exports: {
    get_sync_table: () => RPC.SYNC_TABLE, get_num_thunks: () => 0,
    sync_thunk_state: () => {}, get_bp_addr: () => 0, get_watch_addr: () => 0,
  } }, () => ({ host: {} }));
  tm._log = () => {}; ctx.threadManager = tm;
  const event = tm.createEvent(false, false), idx = tm._getSyncIdx(event);
  const workerVoice = host.voice_open(1000, 1, 8);
  data.setUint32(array, 0xffffffff, true); data.setUint32(array + 4, event, true);
  const workerSigs = { voice_notify_set: sigs.voice_notify_set, voice_play_ring: sigs.voice_play_ring };
  const broker = RPC.createMainBroker(memory, host, workerSigs);
  const worker = new Worker(`
    const {parentPort, workerData:d} = require('worker_threads');
    const RPC = require(d.rpc);
    const bridge = RPC.createWorkerImports({buffer:d.buffer}, d.sigs, m => parentPort.postMessage(m), {slot:1});
    const h = bridge.imports.host;
    const registered = h.voice_notify_set(d.id, d.array, 1, 100) >>> 0;
    const played = h.voice_play_ring(d.id, d.pcm, 100, 0, 0);
    parentPort.postMessage({t:'parked', registered, played});
    const sync = new Int32Array(d.buffer, RPC.SYNC_TABLE, RPC.SYNC_OBJECTS * 4);
    const result = Atomics.wait(sync, d.idx * 4 + 2, 0, 2000);
    parentPort.postMessage({t:'done', result, state:Atomics.load(sync, d.idx * 4 + 2)});
  `, { eval: true, workerData: {
    rpc: require.resolve('../lib/guest-rpc'), buffer: memory.buffer, sigs: workerSigs,
    id: workerVoice, array, pcm, idx,
  } });
  try {
    const result = await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', msg => {
        if (msg.t === 'rpc') broker.serveRpc(msg.slot);
        else if (msg.t === 'parked') {
          assert.strictEqual(msg.registered, 0); assert.strictEqual(msg.played, 0);
          now += 100; // Only the autonomous notification timer runs next.
        } else if (msg.t === 'done') resolve(msg);
      });
      worker.on('exit', code => { if (code) reject(new Error('Worker exit ' + code)); });
    });
    assert(['ok', 'not-equal'].includes(result.result), 'blocked native waiter awakened');
    assert.strictEqual(result.state, 1);
    assert.strictEqual(tm.waitSingle(event, 0), 0, 'auto-reset consumes delivered event');
    assert.strictEqual(tm.waitSingle(event, 0), 0x102);
    assert.strictEqual(register(workerVoice, [[25, event]]), 0);
    tm.closeSyncHandle(event);
    const replacement = tm.createEvent(false, false);
    assert.notStrictEqual(replacement, event, 'generation prevents stale-handle ABA');
    host.voice_play_ring(workerVoice, pcm, 100, 0, 1); now += 100;
    audio.pumpWaveOutCompletions();
    assert.strictEqual(tm.waitSingle(replacement, 0), 0x102, 'closed registered handle cannot signal replacement');
    host.voice_close(workerVoice);
  } finally { await worker.terminate(); ctx.stopAudio(); }
  assert.strictEqual(ctx._voices._notifyTimer, null);
  console.log('PASS DirectSoundNotify host clocks, worklet laps/epochs, RPC ownership and blocked Atomics waiter');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
