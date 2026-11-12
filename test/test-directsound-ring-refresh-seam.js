#!/usr/bin/env node
//
// A DirectSound software mixer (Miles, and StarCraft's) keeps one secondary
// buffer looping and rewrites its ring through Lock/Unlock. The host answers
// each Unlock by starting a replacement AudioBufferSource and stopping the old
// one at a shared audio-clock boundary `when`.
//
// The seam has one invariant: the ring position the new source starts at must
// be the ring position the OLD source would have been at at `when`. Sampling it
// at `ac.currentTime` instead — 5ms earlier — makes every refresh replay those
// 5ms. That is silent in any aggregate and perfectly audible: measured on a
// real iPhone running StarCraft, 5.4 refreshes/s x 5ms is 27ms of duplicated
// audio per second, so the ring stuttered five times a second AND fell a full
// second behind real time every 37 seconds.
//
// So this asserts continuity across the splice directly, in terms of the two
// numbers the implementation publishes (`stop(when)` and `start(when, offset)`)
// rather than in terms of how it computes them.

'use strict';

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');

class FakeParam {
  constructor(value = 0) { this.value = value; }
}

class FakeNode {
  connect(node) { return node; }
  disconnect() {}
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
    this.starts = [];
    this.stops = [];
  }
  start(time, offset) { this.starts.push({ time, offset }); this.owner.started.push(this); }
  stop(time) { this.stops.push(time); if (this.onended) this.onended(); }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 3;
    this.destination = new FakeNode();
    this.state = 'running';
    this.started = [];
    this.buffers = 0;
    this.listeners = [];
  }
  createGain() { const n = new FakeNode(); n.gain = new FakeParam(1); return n; }
  createStereoPanner() { const n = new FakeNode(); n.pan = new FakeParam(0); return n; }
  createAnalyser() { throw new Error('analyser not needed'); }
  createBufferSource() { return new FakeSource(this); }
  createBuffer(channels, length, rate) { this.buffers++; return new FakeBuffer(channels, length, rate); }
  addEventListener(type, fn) { if (type === 'statechange') this.listeners.push(fn); }
  setState(state) { this.state = state; for (const fn of this.listeners) fn(); }
  resume() {}
}

let checks = 0;
const ok = (cond, label) => {
  assert.ok(cond, label);
  console.log(`  ok   ${label}`);
  checks++;
};

const RATE = 22050;
const RING_BYTES = RATE;          // exactly one second of 8-bit mono at 22050
const PTR = 0x2000;

const oldAudioContext = globalThis.AudioContext;
globalThis.AudioContext = FakeAudioContext;

try {
  console.log('DirectSound ring-refresh seam');

  const memory = new ArrayBuffer(128 * 1024);
  const pcm = new Uint8Array(memory);
  for (let i = 0; i < RING_BYTES; i++) pcm[PTR + i] = (i * 37) & 0xFF;

  const ctx = { getMemory: () => memory };
  const { host } = createHostImports(ctx);
  const voice = host.voice_open(RATE, 1, 8);

  host.voice_play_ring(voice, PTR, RING_BYTES, 0, 1);
  const ac = ctx._voices._ac;
  const v = ctx._voices._map[voice];
  const first = v.currentSrc;
  ok(first && first.loop, 'DSBPLAY_LOOPING starts one looping source');
  const ringDuration = first.buffer.duration;
  ok(Math.abs(ringDuration - 1) < 1e-9, 'the ring is one second long');

  // --- refresh one: a quarter of the way through the ring -------------------
  const playStartBefore = v.playStart;
  ac.currentTime = 3.25;
  host.voice_play_ring(voice, PTR, RING_BYTES, 0, 2);

  const second = v.currentSrc;
  ok(second && second !== first, 'Unlock refresh installs a replacement source');

  const when = second.starts[0].time;
  ok(first.stops[0] === when, 'old and new source meet at one audio-clock boundary');
  ok(when > ac.currentTime, `the splice is scheduled in the future (${when} > ${ac.currentTime})`);

  // THE INVARIANT. Where was the old ring at `when`? That is where the new one
  // must begin. Computed from the old source's own origin, not from anything
  // the refresh path recorded.
  const expected = ((when - playStartBefore) * 1) % ringDuration;
  const actual = second.starts[0].offset;
  ok(Math.abs(actual - expected) < 1e-9,
    `no audio is repeated or skipped at the splice ` +
    `(offset ${actual.toFixed(6)}s, ring position at the boundary ${expected.toFixed(6)}s)`);

  // Name the regression explicitly: sampling at `currentTime` lands a whole
  // scheduling lead early, and that is the bug this test exists for.
  const lead = when - ac.currentTime;
  ok(Math.abs(actual - (expected - lead)) > 1e-9,
    `the offset is not the ring position a scheduling lead (${(lead * 1000).toFixed(1)}ms) ago`);

  // --- refresh two: playStart bookkeeping must survive a splice -------------
  const playStartAfter = v.playStart;
  ac.currentTime = 3.7;
  host.voice_play_ring(voice, PTR, RING_BYTES, 0, 2);
  const third = v.currentSrc;
  const when2 = third.starts[0].time;
  const expected2 = ((when2 - playStartAfter) * 1) % ringDuration;
  ok(Math.abs(third.starts[0].offset - expected2) < 1e-9,
    'a second refresh is continuous against the origin the first one left behind');

  // Two refreshes, no drift: the ring origin must still be where it started.
  ok(Math.abs(v.playStart - playStartBefore) < 1e-9,
    `repeated refreshes do not drift the ring origin ` +
    `(${v.playStart} vs ${playStartBefore})`);

  // --- a resampled voice advances its ring at the scaled rate ---------------
  const fast = host.voice_open(RATE, 1, 8);
  host.voice_set_freq(fast, RATE * 2);
  ac.currentTime = 10;
  host.voice_play_ring(fast, PTR, RING_BYTES, 0, 1);
  const fv = ctx._voices._map[fast];
  const fastOrigin = fv.playStart;
  ac.currentTime = 10.1;
  host.voice_play_ring(fast, PTR, RING_BYTES, 0, 2);
  const fastSrc = fv.currentSrc;
  const fastWhen = fastSrc.starts[0].time;
  const fastExpected = ((fastWhen - fastOrigin) * 2) % ringDuration;
  ok(Math.abs(fastSrc.starts[0].offset - fastExpected) < 1e-9,
    `a SetFrequency-resampled ring splices at its scaled position ` +
    `(${fastSrc.starts[0].offset.toFixed(6)}s)`);

  // A suspended browser does not process scheduled stops/onended. Replacing
  // its ring at currentTime+5ms on every Unlock retains every PCM allocation.
  ac.setState('suspended');
  let guestTime = 1000;
  ctx.audioClockMs = () => guestTime;
  const pendingVoice = host.voice_open(RATE, 1, 8);
  host.voice_set_freq(pendingVoice, RATE * 2);
  host.voice_play_ring(pendingVoice, PTR, RING_BYTES, 0, 1);
  const pending = ctx._voices._map[pendingVoice];
  const buffersBefore = ac.buffers, sourcesBefore = ac.started.length;
  const guestOrigin = pending.snapshotStartMs;
  for (let i = 0; i < 2000; i++) {
    pcm[PTR] = i & 255;
    guestTime++;
    host.voice_play_ring(pendingVoice, PTR, RING_BYTES, 0, 2);
  }
  ok(ac.buffers === buffersBefore && ac.started.length === sourcesBefore,
    '2000 suspended Unlocks allocate no PCM buffers or scheduled sources');
  ok(pending.snapshotStartMs === guestOrigin && pending.snapshotPlaying,
    'suspended refresh preserves guest playback and clock origin');
  guestTime += 123;
  const cursorAtResume = host.voice_get_pos(pendingVoice);
  ac.setState('running');
  const resumed = pending.currentSrc;
  ok(ac.buffers === buffersBefore + 1 && ac.started.length === sourcesBefore + 1,
    'resume coalesces pending refreshes into one replacement');
  ok(Math.abs(resumed.buffer.getChannelData(0)[0] - ((1999 & 255) - 128) / 128) < 1e-6,
    'resume decodes the latest guest PCM, not a suspended copy');
  const resumeOffset = (cursorAtResume / RATE + 0.005 * 2) % 1;
  ok(Math.abs(resumed.starts[0].offset - resumeOffset) < 1e-9,
    'resume splices at the current guest cursor plus the scheduling lead');
  const resumedBuffers = ac.buffers;
  ac.setState('running');
  ok(ac.buffers === resumedBuffers, 'duplicate state notification does not replay a refresh');
  ac.setState('suspended');
  host.voice_play_ring(pendingVoice, PTR, RING_BYTES, 0, 2);
  host.voice_stop(pendingVoice);
  ac.setState('running');
  ok(ac.buffers === resumedBuffers && !pending.snapshotPlaying,
    'Stop cancels a pending refresh before resume');

  console.log(`\nPASS  ${checks}/${checks} checks passed`);
} finally {
  globalThis.AudioContext = oldAudioContext;
}
