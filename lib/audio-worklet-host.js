// Main-thread half of the AudioWorklet PCM path.
//
// The worklet (lib/audio-voice-worklet.js) renders a guest DirectSound ring
// straight out of wasm memory, so a Lock/Unlock rewrite is picked up with no
// node splice at all. The splice is what went wrong in c9cc772d: the ring
// offset was sampled at ac.currentTime while the two nodes met at
// currentTime+5ms, replaying 5ms of audio on every refresh (5.4/s on a real
// iPhone running StarCraft = 27ms duplicated per second).
//
// THE CONSTRAINT THIS FILE EXISTS TO HONOUR: a Windows accessory that beeps
// occasionally must pay no steady-state CPU for any of it. An AudioWorklet
// runs process() every 128 frames forever, which is exactly the cost an app
// like Minesweeper must not acquire. So routing is by BEHAVIOUR, not by API:
//
//   Rule 1  a one-shot Play() never reaches the worklet. It has nothing to
//           gain -- the buffer is not rewritten under the cursor -- and it is
//           the only thing most Win32 apps ever do. Enforced in canRoute()
//           and asserted in test/test-audio-worklet-routing.js.
//   Rule 2  the module is fetched lazily, on the first ring that qualifies.
//           An app that never qualifies never downloads or compiles it.
//   Rule 3  a node's lifetime is the PLAYBACK, not the voice record. The
//           processor returns false when a one-shot ends; release() tears the
//           node down on Stop/Close.
//   Rule 4  routing needs SHARED memory. Without it the worklet would render a
//           private copy and a guest rewrite would be inaudible -- worse than
//           the splice it replaces -- so a non-shared host stays on the old
//           path rather than sounding subtly wrong.
//
// The control block is a SIDE SharedArrayBuffer, deliberately NOT a region of
// wasm memory: nothing here needs a region declaration, a WAT change or a
// rebuild, so the whole path is a JS-only opt-in that can be switched off.

'use strict';

const DESC = {
  SEQ: 0, FLAGS: 1, PTR: 2, LEN: 3, RATE: 4, CHANNELS: 5, BITS: 6,
  FREQ_RATIO: 7, CURSOR: 8, START_BYTE: 9, EPOCH: 10, ACK_EPOCH: 11,
  PROGRESS_LO: 12, PROGRESS_HI: 13, PROGRESS_SEQ: 14, PROGRESS_EPOCH: 15,
  STRIDE: 16,
};

const FLAGS = { ACTIVE: 1, PLAYING: 2, LOOPING: 4, PAUSED: 8 };

const DEFAULT_MAX_VOICES = 32;
const MODULE_URL = 'lib/audio-voice-worklet.js';

function createWorkletRouter(options = {}) {
  const maxVoices = options.maxVoices || DEFAULT_MAX_VOICES;
  const moduleUrl = options.moduleUrl || MODULE_URL;

  let control = null;
  let controlOffset = 0;
  let i32 = null;
  let f32 = null;
  let map = null;          // guest-rpc voice map, when the block is in guest memory
  let mapInts = 0;
  const freeSlots = [];
  let moduleState = 'idle';       // idle | loading | ready | failed
  let loadError = null;

  const _rpc = () => {
    if (options.rpc !== undefined) return options.rpc;
    if (typeof GuestRpc !== 'undefined') return GuestRpc;
    try { return typeof require !== 'undefined' ? require('./guest-rpc') : null; }
    catch (_) { return null; }
  };

  const _lazyControl = (memory) => {
    if (control) return control;
    // Only allocated once something actually qualifies, so Rule 1 apps never
    // pay even this.
    if (typeof SharedArrayBuffer === 'undefined') return null;
    const ints = maxVoices * DESC.STRIDE;
    // In the guest's own shared memory when it has the reserved block: then a
    // guest Worker reads a voice's CURSOR there itself (guest-rpc.js
    // audioVoiceViews) instead of blocking on voice_get_pos until the page
    // takes a turn. Otherwise a side buffer, as before.
    const Rpc = _rpc();
    if (Rpc && Rpc.AUDIO_BASE && memory instanceof SharedArrayBuffer &&
        maxVoices <= Rpc.AUDIO_VOICES && DESC.STRIDE === Rpc.AUDIO_DESC_INTS &&
        memory.byteLength >= Rpc.AUDIO_BASE + Rpc.AUDIO_BYTES) {
      control = memory;
      controlOffset = Rpc.AUDIO_BASE;
      mapInts = Rpc.AUDIO_MAP_INTS;
      map = new Int32Array(memory, Rpc.AUDIO_MAP_BASE, Rpc.AUDIO_VOICES * mapInts);
      map.fill(0);
    } else {
      control = new SharedArrayBuffer(ints * 4);
    }
    i32 = new Int32Array(control, controlOffset, ints);
    f32 = new Float32Array(control, controlOffset, ints);
    i32.fill(0);
    for (let s = maxVoices - 1; s >= 0; s--) freeSlots.push(s);
    return control;
  };

  // The voice map a guest Worker reads: LIVE is written last on publish and
  // first on retire, so a reader never pairs a live flag with the wrong voice.
  // A voice is published LIVE only while the AudioContext runs: a suspended
  // context (autoplay policy, before the first click) renders nothing, so its
  // CURSOR stands still, and a guest pacing its mixer on the cursor must get
  // the page's clock-derived answer instead of waiting on a frozen one.
  const slotIds = new Map();
  let running = true;
  const publishVoice = (slot, id) => {
    if (!map) return;
    const b = slot * mapInts;
    Atomics.store(map, b + 1, 0);
    Atomics.store(map, b, id | 0);
    if (running) Atomics.store(map, b + 1, 1);
  };
  const retireVoice = (slot) => {
    slotIds.delete(slot);
    if (!map) return;
    Atomics.store(map, slot * mapInts + 1, 0);
  };

  // Seqlock publish. The worklet reads under an odd/even guard and reuses its
  // previous copy on a torn read, so this never blocks the audio thread.
  const writeDesc = (slot, fields) => {
    const base = slot * DESC.STRIDE;
    Atomics.add(i32, base + DESC.SEQ, 1);
    for (const key of Object.keys(fields)) {
      if (key === 'FREQ_RATIO') f32[base + DESC.FREQ_RATIO] = fields[key];
      else i32[base + DESC[key]] = fields[key] | 0;
    }
    Atomics.add(i32, base + DESC.SEQ, 1);
  };

  const flagsFor = (v, loop) => {
    let flags = FLAGS.ACTIVE | FLAGS.PLAYING;
    if (loop) flags |= FLAGS.LOOPING;
    if (v.paused) flags |= FLAGS.PAUSED;
    return flags;
  };

  const router = {
    DESC, FLAGS,

    get moduleState() { return moduleState; },
    get loadError() { return loadError; },
    get controlBuffer() { return control; },
    get controlOffset() { return controlOffset; },
    // Test seam: whether guest Workers can see this router's voices.
    get sharesGuestMemory() { return !!map; },

    // Is the feature switched on at all? DEFAULT ON. The splice path it
    // replaces is structurally unable to do what DirectSound asks of it -- a
    // started AudioBufferSourceNode cannot be rewound or mutated, so every
    // Lock/Unlock has to be faked by meeting two nodes at one audio-clock
    // boundary, and the ring position at that boundary is a quantity that can
    // be computed wrong. c9cc772d was one instance; the splice is the class.
    //
    // `?no-audio-worklet` and ctx.audioWorklet === false are the way back to
    // it, kept because it is still the only path on a host without shared
    // memory or without AudioWorklet -- canRoute() falls through to it on its
    // own there, with no flag needed.
    enabled(ctx) {
      if (!ctx) return false;
      if (ctx.audioWorklet === true) return true;
      if (ctx.audioWorklet === false) return false;
      if (typeof location !== 'undefined' && location.search &&
          /[?&]no-audio-worklet\b/.test(location.search)) {
        return false;
      }
      return true;
    },

    // RULE 1 LIVES HERE. Every reason a voice must stay on the old path, in
    // one place, so the guard test has one thing to point at.
    canRoute(ctx, ac, v, loop, memory) {
      if (!this.enabled(ctx)) return false;
      // A one-shot has no ring being rewritten under it. This is the whole
      // CPU-safety argument for ordinary Windows apps.
      if (!loop) return false;
      if (!ac || !ac.audioWorklet || typeof AudioWorkletNode === 'undefined') return false;
      // Rule 4: without shared memory the worklet renders a stale private copy.
      if (typeof SharedArrayBuffer === 'undefined') return false;
      if (!memory || !(memory instanceof SharedArrayBuffer)) return false;
      if (!v || !v.rate || !v.channels || !v.bits) return false;
      return true;
    },

    // Rule 2: fetched on first qualifying ring, never at startup.
    ensureModule(ac) {
      if (moduleState === 'ready' || moduleState === 'loading') return moduleState;
      if (!ac || !ac.audioWorklet) return moduleState;
      moduleState = 'loading';
      let promise;
      try { promise = ac.audioWorklet.addModule(moduleUrl); }
      catch (err) { moduleState = 'failed'; loadError = err; return moduleState; }
      Promise.resolve(promise).then(
        () => { moduleState = 'ready'; },
        (err) => { moduleState = 'failed'; loadError = err; });
      return moduleState;
    },

    // Attach a worklet node to `v` and point it at the ring. Returns true when
    // the voice is now rendered by the worklet; false means the caller must run
    // the existing buffer-source path, which is always still correct.
    route(ctx, ac, v, memory, ptr, len, startOff, loop, refresh = false) {
      if (!this.canRoute(ctx, ac, v, loop, memory)) return false;
      if (this.ensureModule(ac) !== 'ready') return false;
      if (!_lazyControl(memory)) return false;

      const rateScale = (v.freq && v.freq !== v.rate) ? (v.freq / v.rate) : 1;

      // Already routed: a refresh is a DESCRIPTOR WRITE and nothing else. No
      // node, no splice, no scheduling decision -- which is the entire point.
      if (v.workletNode && v.workletSlot !== null && v.workletSlot !== undefined) {
        writeDesc(v.workletSlot, {
          FLAGS: flagsFor(v, loop),
          PTR: ptr, LEN: len, RATE: v.rate,
          CHANNELS: v.channels, BITS: v.bits,
          FREQ_RATIO: rateScale,
          ...(!refresh ? {
            START_BYTE: startOff,
            EPOCH: (i32[v.workletSlot * DESC.STRIDE + DESC.EPOCH] | 0) + 1,
          } : {}),
        });
        return true;
      }

      if (!freeSlots.length) return false;
      const slot = freeSlots.pop();
      // Seed the descriptor BEFORE the node exists, so the processor's first
      // process() call already has a valid ring rather than rendering a
      // quantum of silence or, worse, a zeroed PTR.
      writeDesc(slot, {
        FLAGS: flagsFor(v, loop),
        PTR: ptr, LEN: len, RATE: v.rate,
        CHANNELS: v.channels, BITS: v.bits,
        FREQ_RATIO: rateScale,
        START_BYTE: Math.max(0, Math.min(len, startOff | 0)),
        CURSOR: 0, ACK_EPOCH: 0,
        EPOCH: (i32[slot * DESC.STRIDE + DESC.EPOCH] | 0) + 1,
      });

      let node;
      // Progress belongs to a NODE, not a reusable descriptor slot. An audio
      // quantum finishing after disconnect cannot corrupt a new voice's count.
      const progress = new SharedArrayBuffer(DESC.STRIDE * 4);
      try {
        node = new AudioWorkletNode(ac, 'wine-voice', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          processorOptions: { control, controlOffset, controlInts: maxVoices * DESC.STRIDE,
                              memory, slot, progress },
        });
      } catch (err) {
        freeSlots.push(slot);
        loadError = err;
        return false;
      }
      try { node.connect(v.gain || ac.destination); }
      catch (_) { freeSlots.push(slot); return false; }

      v.workletNode = node;
      v.workletProgress = new Int32Array(progress);
      v.workletSlot = slot;
      if (v.id !== undefined) { slotIds.set(slot, v.id); publishVoice(slot, v.id); }
      return true;
    },

    // Rule 3. Called from Stop and Close: the node goes away with the sound,
    // not with the voice record, so nothing keeps rendering silence forever.
    release(v) {
      if (!v) return;
      if (v.workletNode) {
        try { v.workletNode.disconnect(); } catch (_) {}
        v.workletNode = null;
      }
      const slot = v.workletSlot;
      if (slot !== null && slot !== undefined && i32) {
        retireVoice(slot);
        writeDesc(slot, { FLAGS: 0, PTR: 0, LEN: 0 });
        freeSlots.push(slot);
      }
      v.workletSlot = null;
      v.workletProgress = null;
    },

    setPaused(v, paused) {
      if (!v || v.workletSlot === null || v.workletSlot === undefined || !i32) return;
      const base = v.workletSlot * DESC.STRIDE;
      const flags = i32[base + DESC.FLAGS];
      writeDesc(v.workletSlot, {
        FLAGS: paused ? (flags | FLAGS.PAUSED) : (flags & ~FLAGS.PAUSED),
      });
    },

    setFrequency(v, hz) {
      if (!v || v.workletSlot === null || v.workletSlot === undefined || !f32) return;
      const ratio = (hz && v.rate) ? (hz / v.rate) : 1;
      writeDesc(v.workletSlot, { FREQ_RATIO: ratio });
    },

    // The real play cursor, measured by the thing actually making sound,
    // instead of derived from a wall clock. Byte offset within the ring, or
    // null when this voice is not routed.
    cursorOf(v) {
      if (!v || v.workletSlot === null || v.workletSlot === undefined || !i32) return null;
      return Atomics.load(i32, v.workletSlot * DESC.STRIDE + DESC.CURSOR) >>> 0;
    },

    progressOf(v) {
      if (!v || v.workletSlot == null || !i32 || !v.workletProgress) return null;
      const b = v.workletSlot * DESC.STRIDE;
      const p = v.workletProgress;
      for (let tries = 0; tries < 4; tries++) {
        const seq = Atomics.load(p, DESC.PROGRESS_SEQ);
        if (seq & 1) continue;
        const lo = Atomics.load(p, DESC.PROGRESS_LO) >>> 0;
        const hi = Atomics.load(p, DESC.PROGRESS_HI) >>> 0;
        const epoch = Atomics.load(p, DESC.PROGRESS_EPOCH);
        if (seq === Atomics.load(p, DESC.PROGRESS_SEQ) &&
            epoch === Atomics.load(i32, b + DESC.EPOCH)) {
          return { epoch, bytes: hi * 4294967296 + lo };
        }
      }
      return null;
    },

    // The AudioContext started or stopped rendering: (un)publish every routed
    // voice to guest Workers accordingly. See publishVoice.
    setRunning(isRunning) {
      running = !!isRunning;
      for (const [slot, id] of slotIds) {
        if (running) publishVoice(slot, id);
        else if (map) Atomics.store(map, slot * mapInts + 1, 0);
      }
    },

    // Test seam: how many descriptor slots are currently handed out.
    activeSlots() {
      return control ? (maxVoices - freeSlots.length) : 0;
    },
  };

  return router;
}

// Loaded as a plain <script> in the browser (index.html's list) and through
// require() in Node, like every other lib/ file here.
if (typeof module !== 'undefined') {
  module.exports = { createWorkletRouter, DESC, FLAGS, MODULE_URL };
}
