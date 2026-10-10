// The guest's PCM ring, rendered on the audio thread.
//
// DirectSound is a PULL model over memory the guest mutates in place; an
// AudioWorklet is a PULL model over whatever memory you hand it. They are the
// same shape. AudioBufferSourceNode is not: it acquires its buffer at start(),
// so "the guest rewrote the ring under the play cursor" has to be faked by
// splicing two nodes at an audio-clock boundary, and every seam in that splice
// is audible (see the 5ms replay fixed in c9cc772d).
//
// Here there is no seam because there is no splice: process() reads whatever
// bytes are in the ring right now. Tearing is what real hardware does and is
// therefore correct, not a defect.
//
// This file runs in an AudioWorkletGlobalScope, where `require` does not exist
// and neither does any test runner. So the DSP is written as free functions
// and exported at the bottom when `module` happens to exist -- that is what
// makes test/test-audio-voice-worklet.js able to test the real code rather
// than a transcription of it. Both `AudioWorkletProcessor` and
// `registerProcessor` are guarded for the same reason.

'use strict';

// One descriptor per voice, 16 i32 words. Main thread writes every field
// except CURSOR/ACK_EPOCH. PROGRESS uses a node-owned side block with the same
// offsets: a retired node must never publish progress into a reused slot.
// The layout is
// passed to the processor in processorOptions rather than duplicated, so there
// is exactly one definition of it in the tree.
const DESC = {
  SEQ: 0,          // seqlock: odd = a write is in progress
  FLAGS: 1,
  PTR: 2,          // byte offset of the ring inside the wasm memory
  LEN: 3,          // ring length in bytes
  RATE: 4,         // the PCM's own sample rate
  CHANNELS: 5,
  BITS: 6,         // 8 or 16
  FREQ_RATIO: 7,   // f32 view: SetFrequency / nominal rate
  CURSOR: 8,       // WORKLET-WRITTEN: byte offset within the ring.
                   // one i32 so a single store is a consistent publish.
  START_BYTE: 9,
  EPOCH: 10,       // main bumps on Play / SetCurrentPosition
  ACK_EPOCH: 11,   // WORKLET-WRITTEN: the epoch it has re-seeked to
  PROGRESS_LO: 12, // unwrapped consumed bytes since EPOCH, unsigned 64 bits
  PROGRESS_HI: 13,
  PROGRESS_SEQ: 14, // worklet-owned seqlock covering progress and its epoch
  PROGRESS_EPOCH: 15,
  STRIDE: 16,
};

const FLAGS = {
  ACTIVE: 1,
  PLAYING: 2,
  LOOPING: 4,
  PAUSED: 8,
};

// Bounded, because the audio thread must never block. A torn read reuses the
// caller's previous good copy, which is one render quantum stale at worst --
// 2.9ms of a parameter change, inaudible, and infinitely better than a lock.
const SEQLOCK_TRIES = 4;

function readDesc(i32, f32, base, out) {
  for (let attempt = 0; attempt < SEQLOCK_TRIES; attempt++) {
    const before = Atomics.load(i32, base + DESC.SEQ);
    if (before & 1) continue;
    out.flags = i32[base + DESC.FLAGS];
    out.ptr = i32[base + DESC.PTR];
    out.len = i32[base + DESC.LEN];
    out.rate = i32[base + DESC.RATE];
    out.channels = i32[base + DESC.CHANNELS];
    out.bits = i32[base + DESC.BITS];
    out.freqRatio = f32[base + DESC.FREQ_RATIO];
    out.startByte = i32[base + DESC.START_BYTE];
    out.epoch = i32[base + DESC.EPOCH];
    if (Atomics.load(i32, base + DESC.SEQ) === before) {
      out.valid = true;
      return true;
    }
  }
  return false;
}

// Read one sample as float in [-1, 1). `frame` is an integer frame index that
// the caller has already wrapped into range.
function sampleAt(u8, ptr, frame, channel, channels, bits) {
  if (bits === 16) {
    const off = ptr + (frame * channels + channel) * 2;
    const lo = u8[off];
    const hi = u8[off + 1];
    let v = (hi << 8) | lo;
    if (v & 0x8000) v -= 0x10000;
    return v / 32768;
  }
  // 8-bit PCM is UNSIGNED in both WAVE and DirectSound. Reading it as signed
  // is the classic way to get audible buzz on quiet material.
  return (u8[ptr + frame * channels + channel] - 128) / 128;
}

// Render `frames` output frames for one voice. Returns the new cursor in
// frames (fractional). `state.cursor` is kept by the caller across quanta so
// resampling does not accumulate rounding error through the descriptor.
//
// outL/outR are written ADDITIVELY? No -- a voice owns its node, so they are
// written, not mixed. One voice per node keeps the existing per-voice
// gain/pan/panner3d chain intact.
function renderVoice(state, u8, desc, outL, outR, frames, contextRate) {
  const frameBytes = desc.channels * (desc.bits >> 3);
  if (!frameBytes || !desc.len) return state.cursor;
  const totalFrames = Math.floor(desc.len / frameBytes);
  if (totalFrames <= 0) return state.cursor;

  const looping = !!(desc.flags & FLAGS.LOOPING);
  // Guest PCM rate against the graph's rate, times SetFrequency.
  const step = (desc.rate / contextRate) * (desc.freqRatio > 0 ? desc.freqRatio : 1);
  const stereoOut = !!outR;
  let cursor = state.cursor;
  const cursorStart = cursor;
  const consumedStart = state.consumed || 0;

  for (let i = 0; i < frames; i++) {
    if (cursor >= totalFrames) {
      if (!looping) {
        // One-shot ran off the end: silence the remainder and report done.
        for (let j = i; j < frames; j++) { outL[j] = 0; if (stereoOut) outR[j] = 0; }
        state.ended = true;
        state.consumed = consumedStart + Math.max(0, totalFrames - cursorStart);
        return totalFrames;
      }
      cursor -= totalFrames * Math.floor(cursor / totalFrames);
    }
    const i0 = Math.floor(cursor);
    const frac = cursor - i0;
    let i1 = i0 + 1;
    if (i1 >= totalFrames) i1 = looping ? 0 : i0;

    const l0 = sampleAt(u8, desc.ptr, i0, 0, desc.channels, desc.bits);
    const l1 = sampleAt(u8, desc.ptr, i1, 0, desc.channels, desc.bits);
    outL[i] = l0 + (l1 - l0) * frac;

    if (stereoOut) {
      if (desc.channels > 1) {
        const r0 = sampleAt(u8, desc.ptr, i0, 1, desc.channels, desc.bits);
        const r1 = sampleAt(u8, desc.ptr, i1, 1, desc.channels, desc.bits);
        outR[i] = r0 + (r1 - r0) * frac;
      } else {
        outR[i] = outL[i];
      }
    }
    cursor += step;
  }
  // Integrate once per quantum, outside the hot sample loop. Wrapping the
  // interpolation cursor must not wrap the amount the renderer consumed.
  state.consumed = consumedStart + (looping ? frames * step
    : Math.min(frames * step, Math.max(0, totalFrames - cursorStart)));
  return cursor;
}

const Base = (typeof AudioWorkletProcessor !== 'undefined')
  ? AudioWorkletProcessor
  : class {};

class WineVoiceProcessor extends Base {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    // The control block may be a region of the guest's shared memory (worker
    // mode: lib/guest-rpc.js AUDIO_BASE, so a guest Worker can read CURSOR)
    // rather than a buffer of its own.
    const off = opts.controlOffset | 0;
    const ints = opts.controlInts | 0;
    this._i32 = ints ? new Int32Array(opts.control, off, ints) : new Int32Array(opts.control);
    this._f32 = ints ? new Float32Array(opts.control, off, ints) : new Float32Array(opts.control);
    this._u8 = new Uint8Array(opts.memory);
    this._base = (opts.slot | 0) * DESC.STRIDE;
    this._progress = opts.progress ? new Int32Array(opts.progress) : this._i32;
    this._progressBase = opts.progress ? 0 : this._base;
    // `sampleRate` is a global in AudioWorkletGlobalScope; tests pass it.
    this._rate = (typeof sampleRate !== 'undefined') ? sampleRate : (opts.contextRate || 44100);
    this._state = { cursor: 0, ended: false };
    this._desc = { valid: false, epoch: -1 };
    this._lastEpoch = -1;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const outL = out[0];
    const outR = out.length > 1 ? out[1] : null;
    const frames = outL.length;

    readDesc(this._i32, this._f32, this._base, this._desc);
    const d = this._desc;
    if (!d.valid) return true;

    if (!(d.flags & FLAGS.PLAYING) || (d.flags & FLAGS.PAUSED)) {
      // Outputs arrive zeroed; leaving them alone IS silence and costs nothing.
      // Staying alive here is deliberate -- a paused voice resumes.
      return true;
    }

    // A Play or SetCurrentPosition re-seeks the ring.
    if (d.epoch !== this._lastEpoch) {
      const frameBytes = d.channels * (d.bits >> 3);
      this._state.cursor = frameBytes ? (d.startByte / frameBytes) : 0;
      this._state.ended = false;
      this._state.consumed = 0;
      this._lastEpoch = d.epoch;
      Atomics.store(this._i32, this._base + DESC.ACK_EPOCH, d.epoch | 0);
    }

    this._state.cursor = renderVoice(
      this._state, this._u8, d, outL, outR, frames, this._rate);

    // Publish the cursor so GetCurrentPosition reads a REAL play position
    // instead of deriving one from a wall clock.
    const frameBytes = d.channels * (d.bits >> 3);
    Atomics.store(this._i32, this._base + DESC.CURSOR,
      (Math.floor(this._state.cursor) * frameBytes) | 0);
    // A modulo cursor loses complete laps when the page is delayed. Publish
    // consumption independently of wrapping, with one coherent epoch.
    const bytes = Math.floor((this._state.consumed || 0) * frameBytes);
    Atomics.add(this._progress, this._progressBase + DESC.PROGRESS_SEQ, 1);
    Atomics.store(this._progress, this._progressBase + DESC.PROGRESS_LO, bytes >>> 0);
    Atomics.store(this._progress, this._progressBase + DESC.PROGRESS_HI, Math.floor(bytes / 4294967296));
    Atomics.store(this._progress, this._progressBase + DESC.PROGRESS_EPOCH, d.epoch);
    Atomics.add(this._progress, this._progressBase + DESC.PROGRESS_SEQ, 1);

    if (this._state.ended) {
      // A finished one-shot returns false so the node is released for good and
      // process() is never called again. This is the whole reason an idle app
      // pays nothing: node lifetime tracks PLAYBACK, not the voice record.
      return false;
    }
    return true;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('wine-voice', WineVoiceProcessor);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DESC, FLAGS, readDesc, renderVoice, sampleAt, WineVoiceProcessor };
}
