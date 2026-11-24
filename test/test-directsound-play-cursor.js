#!/usr/bin/env node

// What GetCurrentPosition reports is not cosmetic: a DirectSound streamer
// steers its writes with it. RollerCoaster Tycoon's music pump (0x40bb20)
// polls the play cursor, takes the delta since its last poll, and rewrites
// exactly that many bytes at its own write pointer -- i.e. it refills the span
// the cursor just crossed. Two things have to be true for that to sound right:
//
//   1. the play cursor must not run ahead of the speakers. Our snapshot cursor
//      comes from elapsed time, but a WebAudio source is not audible until the
//      render quantum and the device buffer have gone by, so an uncorrected
//      cursor makes the guest overwrite audio still in flight -- a seam on
//      every refill, which is what "the menu music glitches now and then"
//      sounded like.
//   2. the write cursor must lead the play cursor. DirectSound defines the
//      bytes between them as the region already handed to the hardware and
//      unsafe to touch; we used to report one value for both, which told an
//      app that region was free.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');

class FakeNode {
  connect(node) { return node; }
  disconnect() {}
}

class FakeParam {
  constructor(value = 0) { this.value = value; }
}

class FakeBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(channel) { return this.data[channel]; }
}

class FakeSource extends FakeNode {
  constructor(owner) {
    super();
    this.owner = owner;
    this.playbackRate = new FakeParam(1);
    this.loop = false;
  }
  start() { this.owner.started.push(this); }
  stop() { if (this.onended) this.onended(); }
}

// The latency a browser reports is a property of the output device, so it is
// fixed per context; each case installs a context class carrying its own.
function audioContextClass(baseLatency, outputLatency) {
  return class FakeAudioContext {
    constructor() {
      this.currentTime = 3;
      this.destination = new FakeNode();
      this.state = 'running';
      this.started = [];
      this.baseLatency = baseLatency;
      this.outputLatency = outputLatency;
    }
    createGain() { const n = new FakeNode(); n.gain = new FakeParam(1); return n; }
    createStereoPanner() { const n = new FakeNode(); n.pan = new FakeParam(0); return n; }
    createBufferSource() { return new FakeSource(this); }
    createBuffer(channels, length, rate) { return new FakeBuffer(channels, length, rate); }
    resume() {}
  };
}

// One second of 22050Hz mono 8-bit, looping, so a byte is a byte of elapsed
// audio and the arithmetic below stays readable.
const RATE = 22050;
const RING = RATE;

// A looping ring voice, plus the clock that drives its cursor.
function ringVoice(baseLatency, outputLatency) {
  const memory = new ArrayBuffer(128 * 1024);
  const ctx = { getMemory: () => memory };
  const { host } = createHostImports(ctx);
  const id = host.voice_open(RATE, 1, 8);
  host.voice_play_ring(id, 0x1000, RING, 0, 1);
  return { host, id, ac: ctx._voices._ac };
}

const oldAudioContext = globalThis.AudioContext;
try {
  // 1. With a device that is 100ms behind, the reported cursor is 100ms behind
  //    too -- the guest may rewrite what has been heard, not what is queued.
  globalThis.AudioContext = audioContextClass(0.02, 0.08);
  {
    const { host, id, ac } = ringVoice();
    assert(ac, 'the voice should have taken an AudioContext');
    ac.currentTime += 0.5;
    assert.strictEqual(host.voice_get_pos(id), Math.floor(0.4 * RATE),
      'the play cursor must trail elapsed time by baseLatency + outputLatency');

    // Never negative: right after Play, less time has passed than the device
    // is behind, and a cursor that wrapped to the end of the ring would send a
    // streamer off to refill the whole buffer.
    ac.currentTime -= 0.45;
    assert.strictEqual(host.voice_get_pos(id), 0,
      'before the first sample is audible the cursor stays at the start');
  }

  // 2. A context that reports no latency (older engines omit outputLatency)
  //    is left exactly as it was -- the correction is a subtraction, not a
  //    guess at some default.
  globalThis.AudioContext = audioContextClass(undefined, undefined);
  {
    const { host, id, ac } = ringVoice();
    ac.currentTime += 0.5;
    assert.strictEqual(host.voice_get_pos(id), Math.floor(0.5 * RATE),
      'an unreported latency must not be invented');
  }
} finally {
  globalThis.AudioContext = oldAudioContext;
}

// 3. A suspended AudioContext never fires source.onended. A one-shot must
// still retire against the guest clock or a movie waits forever on its final
// frame while a stale source object says it is playing.
globalThis.AudioContext = audioContextClass(undefined, undefined);
try {
  let clockMs = 100;
  const memory = new ArrayBuffer(128 * 1024);
  const ctx = { getMemory: () => memory, audioClockMs: () => clockMs };
  const { host } = createHostImports(ctx);
  const id = host.voice_open(RATE, 1, 8);
  host.voice_play_ring(id, 0x1000, RATE, 0, 0);
  assert.strictEqual(host.voice_is_playing(id), 1,
    'a new one-shot reports playing while its guest-clock duration remains');
  clockMs += 999;
  assert.strictEqual(host.voice_is_playing(id), 1,
    'the one-shot remains live immediately before its duration');
  clockMs += 1;
  assert.strictEqual(host.voice_is_playing(id), 0,
    'guest-clock expiry retires a stale browser source without onended');
} finally {
  globalThis.AudioContext = oldAudioContext;
}

// 4. A rate change must not retroactively rescale already-played samples.
for (const latency of [0, 0.1]) {
  globalThis.AudioContext = audioContextClass(latency, 0);
  try {
    const {host, id, ac} = ringVoice();
    const start = ac.currentTime;
    ac.currentTime = start + 0.4;
    const before = host.voice_get_pos(id);
    host.voice_set_freq(id, RATE * 2);
    assert.strictEqual(host.voice_get_pos(id), before, 'rate switch preserves audible cursor');
    ac.currentTime = start + 0.6;
    assert(Math.abs(host.voice_get_pos(id) - Math.floor((0.4 + (0.2-latency)*2)*RATE)) <= 1,
      'only samples after the rate boundary use the new frequency');
    host.voice_set_freq(id, RATE / 2);
    ac.currentTime = start + 0.9;
    assert(Math.abs(host.voice_get_pos(id) - Math.floor((0.8 + (0.3-latency)*0.5)*RATE)) <= 1,
      'a second rate boundary preserves fractional position');
  } finally { globalThis.AudioContext = oldAudioContext; }
}

// No AudioContext: cursor and one-shot completion use the same integral.
{
  globalThis.AudioContext = undefined;
  let clockMs = 0;
  const memory = new ArrayBuffer(128 * 1024);
  const ctx = {getMemory: () => memory, audioClockMs: () => clockMs};
  const {host} = createHostImports(ctx);
  const id = host.voice_open(1000, 1, 8);
  host.voice_play_ring(id, 0x1000, 1000, 0, 0);
  clockMs = 400;
  assert.strictEqual(host.voice_get_pos(id), 400);
  host.voice_set_freq(id, 2000);
  assert.strictEqual(host.voice_get_pos(id), 400);
  clockMs = 699;
  assert.strictEqual(host.voice_get_pos(id), 998);
  assert.strictEqual(host.voice_is_playing(id), 1);
  clockMs = 700;
  assert.strictEqual(host.voice_get_pos(id), 1000);
  assert.strictEqual(host.voice_is_playing(id), 0);
  // Repeated Play at the same guest tick is a fresh timeline too.
  host.voice_play_ring(id, 0x1000, 1000, 0, 1);
  assert.strictEqual(host.voice_get_pos(id), 0);
  host.voice_set_freq(id, 0);
  assert.strictEqual(host.voice_get_pos(id), 0);
  clockMs += 100;
  assert.strictEqual(host.voice_get_pos(id), 100);
  // Frozen-clock edits coalesce, and advancing edits retain only the needed
  // latency window; history must not grow with the lifetime of a looping voice.
  for (let i = 0; i < 1000; i++) host.voice_set_freq(id, i % 2 ? 1000 : 2000);
  assert.strictEqual(ctx._voices._map[id].rateClocks.snapshotGuest.segments.length, 1);
  for (let i = 0; i < 1000; i++) {
    clockMs++;
    host.voice_set_freq(id, i % 2 ? 1000 : 2000);
  }
  assert.strictEqual(ctx._voices._map[id].rateClocks.snapshotGuest.segments.length, 1);
  globalThis.AudioContext = oldAudioContext;
}

// Two boundaries can both still be in flight behind the output latency.
globalThis.AudioContext = audioContextClass(0.1, 0);
try {
  const {host, id, ac} = ringVoice();
  const start = ac.currentTime;
  ac.currentTime = start + 0.4; host.voice_set_freq(id, RATE*2);
  ac.currentTime = start + 0.45; host.voice_set_freq(id, RATE);
  ac.currentTime = start + 0.525;
  assert(Math.abs(host.voice_get_pos(id) - Math.floor(0.45*RATE)) <= 1,
    'audible query within an older segment retains its earlier rate');
  ac.currentTime = start + 0.575;
  assert(Math.abs(host.voice_get_pos(id) - Math.floor(0.525*RATE)) <= 1);
} finally { globalThis.AudioContext = oldAudioContext; }

// Stream clock shares the integral; reset starts again at zero.
globalThis.AudioContext = undefined;
try {
  let clockMs = 0;
  const memory = new ArrayBuffer(128*1024);
  const ctx = {getMemory:()=>memory, audioClockMs:()=>clockMs};
  const {host} = createHostImports(ctx);
  const id = host.voice_open(1000,1,8);
  host.voice_write_stream(id,0x1000,10000);
  clockMs=400; host.voice_set_freq(id,2000);
  assert.strictEqual(host.voice_get_pos(id),400);
  clockMs=600; assert.strictEqual(host.voice_get_pos(id),800);
  host.voice_stop(id);
  host.voice_write_stream(id,0x1000,10000);
  assert.strictEqual(host.voice_get_pos(id),0);
  clockMs=700; assert.strictEqual(host.voice_get_pos(id),200);
} finally { globalThis.AudioContext = oldAudioContext; }

// 5. The WAT side: the write cursor is a different number from the play
//    cursor, derived from the buffer's own format, and stays inside the ring.
{
  const wat = fs.readFileSync(
    path.join(__dirname, '..', 'src', '09a8-handlers-directx.wat'), 'utf8');
  const fn = wat.split('(func $handle_IDirectSoundBuffer_GetCurrentPosition')[1];
  assert(fn, 'GetCurrentPosition handler not found');
  const body = fn.split('\n  (func ')[0];
  const cursor = wat.split('(func $dsbuf_cursor')[1].split('\n  (func ')[0];
  const write = wat.split('(func $dsbuf_write_cursor')[1].split('\n  (func ')[0];
  assert(/call \$dsbuf_cursor/.test(body), 'GetCurrentPosition uses the shared cursor');
  assert(/call \$dsbuf_write_cursor/.test(body), 'GetCurrentPosition uses the shared write lead');
  assert(/local\.get \$lead/.test(write), 'the write cursor leads the play cursor');
  assert(/i32\.rem_u/.test(cursor) && /i32\.rem_u/.test(write),
    'play and write cursors wrap inside the ring');
  assert(/i32\.const 15/.test(write), 'the write lead is 15ms');
}

// A clock between two PCM frames must never expose bytes from the next
// frame. At ring wrap a one-byte tail otherwise becomes a zero-frame refill
// in SimGolf's original sound.dll converter (which uses a do/while loop).
for (const browserClock of [false, true]) {
  globalThis.AudioContext = browserClock ? audioContextClass(0, 0) : undefined;
  try {
    for (const [channels, bits] of [[2, 16], [1, 16], [2, 8], [1, 8]]) {
      let clockMs = 0;
      const ctx = {getMemory: () => new ArrayBuffer(128 * 1024),
        ...(browserClock ? {} : {audioClockMs: () => clockMs})};
      const {host} = createHostImports(ctx);
      const id = host.voice_open(1000, channels, bits);
      const frame = channels * bits / 8;
      const size = 100 * frame;
      host.voice_play_ring(id, 0x1000, size, 0, 1);
      const start = ctx._voices._ac?.currentTime;
      for (const frames of [0.75, 1.75, 99.75, 100.75]) {
        if (browserClock) ctx._voices._ac.currentTime = start + frames / 1000;
        else clockMs = frames;
        assert.strictEqual(host.voice_get_pos(id), Math.floor(frames) * frame % size,
          `${browserClock ? 'browser' : 'guest'} clock: ${channels}ch/${bits}bit complete frames at ${frames}`);
      }
    }
  } finally { globalThis.AudioContext = oldAudioContext; }
}

console.log('PASS  DirectSound cursors: complete frames, play trails the device, write leads play');
