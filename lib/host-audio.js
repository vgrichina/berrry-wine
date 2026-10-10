// Audio half of the host import layer: the WinMM mixer buses, the voice
// manager shared by waveOut and DirectSound, waveIn capture, the MIDI
// synthesiser, and MCI.
//
// Split out of lib/host-imports.js, which still owns the flat `host` import
// namespace: it calls createAudioHost() once and spreads `.imports` into the
// same object the guest sees, so nothing about the WASM import shape changed.
// Everything this half needs from the other one arrives through `shared`;
// nothing here reaches back into host-imports' closure.

// Opt-in AudioWorklet PCM path (lib/audio-worklet-host.js + the worklet in
// lib/audio-voice-worklet.js). DEFAULT ON for self-refreshing looping rings;
// every routing gate, including the one that keeps one-shot Play() away from
// it and the fallbacks to the old splice path, lives in that file.
// waveOutOpen's callback record ({handle, callback, instance, cbType}) lives
// in the allocator-placed $WAVE_OUT_SHARED region, so read its base from the
// generated mirror rather than a literal.
var _audioRegionMap = typeof require !== 'undefined' ? require('./region-map.generated')
  : (typeof self !== 'undefined' ? self.RegionMap : globalThis.RegionMap);

var _workletRouterModule = (typeof require !== 'undefined')
  ? require('./audio-worklet-host')
  : { createWorkletRouter: (typeof createWorkletRouter !== 'undefined' ? createWorkletRouter : null) };

// MediaDevices is browser-global while audio hosts are per emulated process
// (and workers construct their own import closures).  One bridge per native
// MediaDevices object prevents N processes/threads from installing N identical
// listeners; subscribers are released through ctx.stopAudio at app teardown.
var _audioDeviceChangeBridges = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

function _audioDeviceKeyCounts(devices) {
  const counts = new Map();
  for (const device of Array.from(devices || [])) {
    const kind = String(device && device.kind || '');
    if (kind !== 'audioinput' && kind !== 'audiooutput') continue;
    // deviceId is stable where permission allows it. groupId/label retain a
    // useful identity in stricter browsers; a count still detects multiple
    // anonymous devices of the same kind.
    const identity = String(device.deviceId || device.groupId || device.label || 'anonymous');
    const key = `${kind}\0${identity}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function _audioDeviceCountDelta(before, after) {
  let added = false;
  let removed = false;
  const keys = new Set([...(before ? before.keys() : []), ...(after ? after.keys() : [])]);
  for (const key of keys) {
    const oldCount = before ? (before.get(key) || 0) : 0;
    const newCount = after ? (after.get(key) || 0) : 0;
    if (newCount > oldCount) added = true;
    if (newCount < oldCount) removed = true;
  }
  return { added, removed };
}

function _subscribeAudioDeviceChanges(mediaDevices, subscriber) {
  if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function' ||
      typeof mediaDevices.addEventListener !== 'function' || !_audioDeviceChangeBridges) {
    return null;
  }
  let bridge = _audioDeviceChangeBridges.get(mediaDevices);
  if (!bridge) {
    bridge = { subscribers: new Set(), snapshot: null, pending: Promise.resolve() };
    const refresh = async notify => {
      let devices;
      try { devices = await mediaDevices.enumerateDevices(); }
      catch (_) { return; }
      const next = _audioDeviceKeyCounts(devices);
      if (notify && bridge.snapshot) {
        const delta = _audioDeviceCountDelta(bridge.snapshot, next);
        // A replacement is removal followed by arrival, matching the order a
        // refresh-oriented Win32 client expects when rebuilding device lists.
        if (delta.removed) {
          for (const fn of Array.from(bridge.subscribers)) {
            try { fn(0x8004); } catch (_) {}
          }
        }
        if (delta.added) {
          for (const fn of Array.from(bridge.subscribers)) {
            try { fn(0x8000); } catch (_) {}
          }
        }
      }
      bridge.snapshot = next;
    };
    bridge.onChange = () => {
      bridge.pending = bridge.pending.then(() => refresh(true), () => refresh(true));
    };
    bridge.pending = bridge.pending.then(() => refresh(false));
    mediaDevices.addEventListener('devicechange', bridge.onChange);
    _audioDeviceChangeBridges.set(mediaDevices, bridge);
  }
  bridge.subscribers.add(subscriber);
  let subscribed = true;
  return {
    ready: bridge.pending,
    flush: () => bridge.pending,
    unsubscribe: () => {
      if (!subscribed) return;
      subscribed = false;
      bridge.subscribers.delete(subscriber);
      if (bridge.subscribers.size) return;
      try { mediaDevices.removeEventListener('devicechange', bridge.onChange); } catch (_) {}
      _audioDeviceChangeBridges.delete(mediaDevices);
    },
  };
}

function createAudioHost(ctx, shared) {
  const readStr = shared.readStr;
  const readStrW = shared.readStrW;
  const _readVfsFile = shared.readVfsFile;
  const _readVfsFileAsync = shared.readVfsFileAsync;
  const _profileNow = shared.profileNow;
  const _profileEvent = shared.profileEvent;
  // The import map is built here but installed by host-imports.js, so audio
  // callbacks that want to signal an event reach the finished namespace
  // late rather than capturing a half-built object.
  const getHost = shared.getHost;

  const _mediaDevices = ctx.mediaDevices ||
    (typeof navigator !== 'undefined' && navigator.mediaDevices) || null;
  let _deviceNotifications = null;
  // threadId is zero/absent for the process main instance. Worker import
  // closures share the same native MediaDevices and must not subscribe again.
  if ((ctx.threadId | 0) === 0 && _mediaDevices) {
    _deviceNotifications = _subscribeAudioDeviceChanges(_mediaDevices, event => {
      const e = ctx.exports || (ctx.instance && ctx.instance.exports) ||
        (ctx.renderer && ctx.renderer.wasm && ctx.renderer.wasm.exports);
      if (e && typeof e.device_notify_audio_change === 'function') {
        e.device_notify_audio_change(event >>> 0);
      }
    });
  }

  // ---- Audio mixer buses -------------------------------------------------
  // A shared master plus wave and MIDI child buses. The native WinMM mixer
  // controls these nodes, while recorder.js can continue tapping the master.
  // Mixer controls are desktop-wide in the browser, while voices/MCI devices
  // remain process-owned so closing one application cannot stop another.
  const _audioMixerState = ctx.sharedMixer || ctx.sharedAudio || ctx;
  if (!_audioMixerState.mixerVolumes) {
    _audioMixerState.mixerVolumes = [0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF];
  }
  if (!_audioMixerState.mixerMutes) _audioMixerState.mixerMutes = [0, 0, 0];
  if (!_audioMixerState.mixerContexts) _audioMixerState.mixerContexts = new Set();
  if (!_audioMixerState.mixerPeaks) {
    _audioMixerState.mixerPeaks = Array.from({ length: 3 }, () => ({ value: 0, holdUntil: 0, decayUntil: 0 }));
  }
  const _mixerGain = (packed) => {
    const value = packed >>> 0;
    return Math.max(0, Math.min(1, (((value & 0xFFFF) + (value >>> 16)) / 2) / 0xFFFF));
  };
  const _applyAudioMixerVolume = (ac, bus) => {
    if (!ac) return;
    const volume = _audioMixerState.mixerVolumes[bus] >>> 0;
    const node = bus === 0 ? ac._wineMaster : bus === 1 ? ac._wineWaveBus : ac._wineMidiBus;
    if (node && node.gain) node.gain.value = _audioMixerState.mixerMutes[bus] ? 0 : _mixerGain(volume);
  };
  const _audioMixerPeakNow = () => {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  };
  const _markAudioMixerPeak = (bus, value, holdMs = 120, now = _audioMixerPeakNow()) => {
    const channel = Math.max(0, Math.min(2, bus | 0));
    const peak = Math.max(0, Math.min(1, Number(value) || 0));
    const state = _audioMixerState.mixerPeaks[channel];
    state.value = Math.max(state.value || 0, peak);
    state.holdUntil = Math.max(state.holdUntil || 0, now + Math.max(50, Number(holdMs) || 0));
    state.decayUntil = Math.max(state.decayUntil || 0, state.holdUntil + 280);
  };
  const _fallbackAudioMixerPeak = (bus) => {
    const state = _audioMixerState.mixerPeaks[Math.max(0, Math.min(2, bus | 0))];
    if (!state) return 0;
    const now = _audioMixerPeakNow();
    if (now <= state.holdUntil) return state.value || 0;
    if (now >= state.decayUntil) {
      state.value = 0;
      return 0;
    }
    return (state.value || 0) * ((state.decayUntil - now) / Math.max(1, state.decayUntil - state.holdUntil));
  };
  // PCM spans are measured lazily. Scanning every sample of every buffer the
  // guest submits is a full pass over all of its audio, and only
  // audio_mixer_get_peak ever reads the result -- a V8 profile of NFS II SE's
  // race put that scan at 23% of the page thread's busy time with nothing
  // asking. So a submit records the span and its mark time, and the next peak
  // query measures what is still inside its hold window. A guest that never
  // queries pays one small record per buffer, bounded by the window.
  const _PENDING_PCM_PEAKS_MAX = 64;
  const _markPcmPeak = (bus, mem, ptr, len, channels, bits, holdMs = 120) => {
    let pending = _audioMixerState.pendingPcmPeaks;
    if (!pending) pending = _audioMixerState.pendingPcmPeaks = [];
    if (pending.length >= _PENDING_PCM_PEAKS_MAX) pending.shift();
    pending.push({ bus, mem, ptr, len, channels, bits, holdMs, at: _audioMixerPeakNow() });
  };
  const _flushPendingPcmPeaks = () => {
    const pending = _audioMixerState.pendingPcmPeaks;
    if (!pending || !pending.length) return;
    _audioMixerState.pendingPcmPeaks = [];
    const now = _audioMixerPeakNow();
    for (const p of pending) {
      // Past its hold and decay it could not raise the meter any more.
      if (now > p.at + Math.max(50, Number(p.holdMs) || 0) + 280) continue;
      _markAudioMixerPeak(p.bus, _measurePcmPeak(p.mem, p.ptr, p.len, p.channels, p.bits), p.holdMs, p.at);
    }
  };
  const _attachAudioMixerAnalyser = (ac, source, destination, key) => {
    if (!ac || !source || !destination || typeof ac.createAnalyser !== 'function') {
      source.connect(destination);
      return null;
    }
    try {
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(destination);
      ac[key] = analyser;
      return analyser;
    } catch (_) {
      source.connect(destination);
      return null;
    }
  };
  const _getAudioMaster = (ac) => {
    if (!ac) return null;
    if (!ac._wineMaster) {
      try {
        const m = ac.createGain();
        _attachAudioMixerAnalyser(ac, m, ac.destination, '_wineMasterAnalyser');
        ac._wineMaster = m;
      } catch (_) { return ac.destination; }
    }
    _audioMixerState.mixerContexts.add(ac);
    _applyAudioMixerVolume(ac, 0);
    return ac._wineMaster;
  };
  const _getAudioBus = (ac, bus) => {
    if (!ac || bus === 0) return _getAudioMaster(ac);
    const key = bus === 2 ? '_wineMidiBus' : '_wineWaveBus';
    if (!ac[key]) {
      try {
        const node = ac.createGain();
        _attachAudioMixerAnalyser(
          ac, node, _getAudioMaster(ac), bus === 2 ? '_wineMidiAnalyser' : '_wineWaveAnalyser');
        ac[key] = node;
      } catch (_) { return _getAudioMaster(ac); }
    }
    _audioMixerState.mixerContexts.add(ac);
    _applyAudioMixerVolume(ac, bus);
    return ac[key];
  };
  const _setAudioMixerVolume = (bus, packed) => {
    const channel = Math.max(0, Math.min(2, bus | 0));
    _audioMixerState.mixerVolumes[channel] = packed >>> 0;
    for (const ac of _audioMixerState.mixerContexts) _applyAudioMixerVolume(ac, channel);
  };
  ctx.setAudioMixerVolume = _setAudioMixerVolume;
  const _readAudioMixerAnalyser = (analyser) => {
    if (!analyser) return 0;
    try {
      const length = Math.max(32, analyser.fftSize || 256);
      if (typeof analyser.getFloatTimeDomainData === 'function') {
        const samples = analyser._winePeakFloat && analyser._winePeakFloat.length === length
          ? analyser._winePeakFloat : (analyser._winePeakFloat = new Float32Array(length));
        analyser.getFloatTimeDomainData(samples);
        let peak = 0;
        for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
        return Math.min(1, peak);
      }
      if (typeof analyser.getByteTimeDomainData === 'function') {
        const samples = analyser._winePeakBytes && analyser._winePeakBytes.length === length
          ? analyser._winePeakBytes : (analyser._winePeakBytes = new Uint8Array(length));
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] - 128) / 128);
        return Math.min(1, peak);
      }
    } catch (_) {}
    return 0;
  };
  const _getAudioMixerPeak = (bus) => {
    _flushPendingPcmPeaks();
    const channel = Math.max(0, Math.min(2, bus | 0));
    if (_audioMixerState.mixerMutes[channel]) return 0;
    const analyserKey = channel === 0 ? '_wineMasterAnalyser' :
      channel === 1 ? '_wineWaveAnalyser' : '_wineMidiAnalyser';
    let peak = 0;
    for (const ac of _audioMixerState.mixerContexts) {
      peak = Math.max(peak, _readAudioMixerAnalyser(ac && ac[analyserKey]));
    }
    const masterGain = _audioMixerState.mixerMutes[0] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[0]);
    if (channel === 0) {
      const waveGain = _audioMixerState.mixerMutes[1] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[1]);
      const midiGain = _audioMixerState.mixerMutes[2] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[2]);
      peak = Math.max(peak,
        _fallbackAudioMixerPeak(1) * waveGain * masterGain,
        _fallbackAudioMixerPeak(2) * midiGain * masterGain);
    } else {
      const gain = _audioMixerState.mixerMutes[channel] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[channel]);
      peak = Math.max(peak, _fallbackAudioMixerPeak(channel) * gain);
    }
    return Math.max(0, Math.min(32767, Math.round(peak * 32767)));
  };

  // How far behind our clock the speakers actually are. A snapshot voice's
  // play cursor is derived from elapsed time, but the AudioBufferSourceNode
  // does not become audible until the render quantum plus the device buffer
  // have gone by, so the cursor we would otherwise report leads what is coming
  // out of the DAC. That matters because a DirectSound streamer refills
  // everything *behind* the play cursor: RollerCoaster Tycoon's music pump
  // advances its own write pointer by the play-cursor delta and rewrites that
  // span, so an over-reported cursor makes it overwrite tens of milliseconds
  // of audio still in flight, and the seam clicks. Under-reporting only makes
  // an app write less than it could, which is always safe. Headless has no
  // AudioContext and gets 0.
  const _outputLatencySec = (ac) => {
    if (!ac) return 0;
    const base = Number.isFinite(ac.baseLatency) ? ac.baseLatency : 0;
    const out = Number.isFinite(ac.outputLatency) ? ac.outputLatency : 0;
    return Math.max(0, Math.min(0.5, base + out));
  };

  const _measurePcmPeak = (mem, ptr, len, channels, bits) => {
    const bytesPerSample = bits === 16 ? 2 : bits === 8 ? 1 : 0;
    if (!mem || !bytesPerSample || len <= 0 || channels <= 0) return 0;
    const end = Math.min(mem.length, ptr + len);
    let peak = 0;
    for (let off = ptr; off + bytesPerSample <= end; off += bytesPerSample) {
      let sample;
      if (bits === 16) {
        const raw = mem[off] | (mem[off + 1] << 8);
        sample = Math.abs((raw > 32767 ? raw - 65536 : raw) / 32768);
      } else {
        sample = Math.abs((mem[off] - 128) / 128);
      }
      if (sample > peak) peak = sample;
    }
    return Math.min(1, peak);
  };

  // ---- Voice manager ----------------------------------------------------
  // Single owner of the AudioContext + per-voice gain/pan graph. waveOut and
  // DSOUND both go through this. Each voice has a sample format and a
  // GainNode→(StereoPannerNode|PannerNode)→destination chain; PCM is decoded
  // from guest memory on submit and queued as AudioBufferSourceNodes.
  const _audioDoneState = ctx.sharedAudio || ctx;
  if (!_audioDoneState.waveDoneQueue) _audioDoneState.waveDoneQueue = [];
  const _audioClockMs = () => {
    if (typeof ctx.audioClockMs === 'function') return ctx.audioClockMs();
    if (ctx.sharedAudio && typeof ctx.sharedAudio.audioClockMs === 'function') return ctx.sharedAudio.audioClockMs();
    return null;
  };
  // Ring queue. A refilled looping ring can stop sounding from the ring
  // itself: each Unlock's newly written span is queued and played back to
  // back, a little behind the moment it arrived, so a refill that is late
  // still plays in order instead of the cursor replaying last lap's audio.
  // The cursor the guest reads keeps running on the AudioContext clock.
  //
  // Only a SMALL ring needs it. A mixer whose ring is longer than
  // _RING_QUEUE_MAX_LAP_SEC keeps its own lead well clear of the gaps between
  // host steps (StarCraft's and Diablo's rings are 1.5s); fmod in Moorhuhn 2
  // runs an 80ms ring 60ms ahead, and one 60ms host step eats all of it.
  // Measured there with the deadline clock: 10ms of slack takes underruns to
  // zero at 1.00x real time.
  //
  // `?audio-delay=MS` forces the queue on every looping ring with MS of
  // slack (0 is a real setting: a queue with no added slack); `off` disables
  // it. Absent: _RING_QUEUE_DEFAULT_SEC on small rings only, and only in a
  // page -- headless has no host-step gaps to absorb and its batch clock
  // would only reorder what a recording captures.
  const _RING_QUEUE_DEFAULT_SEC = 0.010;
  const _RING_QUEUE_MAX_LAP_SEC = 0.100;
  // The most audio the queue may hold ahead of the AudioContext clock beyond
  // its slack. Whatever the guest mixes into the ring -- a shot included --
  // plays that far behind, so a backlog is latency, and nothing else drains
  // it: the mixer writes at the rate the queue plays. Measured in Chrome: the
  // context sat suspended until the first click (autoplay policy) while fmod
  // kept mixing off the guest clock, and every shot afterwards was 2.4s late.
  const _RING_QUEUE_MAX_LEAD_SEC = 0.150;
  const _ringDelayParam = (() => {
    try {
      if (typeof location === 'undefined') return null;
      const raw = new URLSearchParams(location.search).get('audio-delay');
      if (raw === null || raw === '') return undefined;
      if (raw === 'off') return null;
      const ms = Number(raw);
      return Number.isFinite(ms) && ms >= 0 ? Math.min(500, ms) / 1000 : undefined;
    } catch (_) { return undefined; }
  })();
  // The queue's slack for this ring in seconds, or null to play the ring as is.
  const _ringDelayFor = (v, len) => {
    if (_ringDelayParam === null) return null;
    if (_ringDelayParam !== undefined) return _ringDelayParam;
    const bytesPerSec = Math.max(1, v.rate * v.channels * (v.bits / 8));
    return len / bytesPerSec < _RING_QUEUE_MAX_LAP_SEC ? _RING_QUEUE_DEFAULT_SEC : null;
  };
  const _RING_CELL = 64;
  // The queue path for one Unlock. Diffs the ring against the last copy in
  // cells, starts at the write pointer (or skips ahead to where the guest
  // actually wrote, if it jumped), and appends the contiguous written run.
  const _ringDelayRefresh = (ac, v, pcm, ptr, len, delaySec) => {
    let q = v.delayQ;
    if (!q || q.len !== len || q.ptr !== ptr) {
      q = v.delayQ = { ptr, len, snap: pcm.slice(ptr, ptr + len), wp: -1, next: 0, delaySec,
        pending: [],
        stats: { delayMs: delaySec * 1000, chunks: 0, bytes: 0, underruns: 0,
          gapMs: 0, skips: 0, skipBytes: 0, empty: 0, trims: 0, idle: 0, leadMs: [] } };
      // The ring source keeps running as the cursor's clock, silently.
      if (v.currentSrc) { try { v.currentSrc.disconnect(); } catch (_) {} }
      return;
    }
    // A context that is not running has a clock that is not moving (browsers
    // hold it suspended until a user gesture), so anything queued now would
    // all be waiting when it starts. Track the ring and queue nothing; the
    // first write after it runs starts a fresh queue from the write it sees.
    if (ac.state !== 'running') {
      q.snap.set(pcm.subarray(ptr, ptr + len));
      q.wp = -1;
      q.stats.idle++;
      return;
    }
    const cells = Math.ceil(len / _RING_CELL);
    const changed = new Uint8Array(cells);
    let any = false;
    for (let c = 0; c < cells; c++) {
      const a = c * _RING_CELL, e = Math.min(len, a + _RING_CELL);
      for (let i = a; i < e; i++) {
        if (pcm[ptr + i] !== q.snap[i]) { changed[c] = 1; any = true; break; }
      }
    }
    if (!any) { q.stats.empty++; return; }
    let start;
    if (q.wp < 0) {
      // First write: begin at the start of a changed run (a changed cell
      // whose predecessor is unchanged), or cell 0 if all of it changed.
      start = 0;
      for (let c = 0; c < cells; c++) {
        if (changed[c] && !changed[(c + cells - 1) % cells]) { start = c; break; }
      }
    } else {
      start = Math.floor(q.wp / _RING_CELL) % cells;
      let first = 0;
      while (first < cells && !changed[(start + first) % cells]) first++;
      // The guest wrote somewhere other than where it left off (it fell a
      // lap behind and resynced to the cursor): follow it.
      if (first > 2) { q.stats.skips++; q.stats.skipBytes += first * _RING_CELL; }
      if (first > 0) start = (start + first) % cells;
    }
    // Extend while cells are changed, tolerating holes of up to 2 unchanged
    // cells (a rewrite that happened to produce identical bytes).
    let n = 0, lastChanged = -1;
    for (let k = 0; k < cells; k++) {
      const c = (start + k) % cells;
      if (changed[c]) lastChanged = k;
      else if (k - lastChanged > 2) break;
    }
    n = lastChanged + 1;
    q.snap.set(pcm.subarray(ptr, ptr + len));
    if (n <= 0) { q.stats.empty++; return; }
    const from = start * _RING_CELL;
    const bytes = Math.min(len, n * _RING_CELL);
    const tmp = new Uint8Array(bytes);
    const firstPart = Math.min(bytes, len - from);
    tmp.set(pcm.subarray(ptr + from, ptr + from + firstPart), 0);
    if (bytes > firstPart) tmp.set(pcm.subarray(ptr, ptr + bytes - firstPart), firstPart);
    q.wp = (from + bytes) % len;
    const buf = _decodePcm(ac, tmp, 0, bytes, v.channels, v.bits, v.rate);
    if (!buf) return;
    const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
    const now = ac.currentTime;
    if (q.next < now + 0.002) {
      if (q.stats.chunks > 0) {
        q.stats.underruns++;
        q.stats.gapMs += Math.max(0, now + q.delaySec - q.next) * 1000;
      }
      q.next = now + Math.max(0.002, q.delaySec);
    }
    // Drop what has already played, then trim a backlog: stop the spans that
    // have not started and restart from the slack. The trimmed audio is lost,
    // which is the point -- it is the part the ear would hear late.
    while (q.pending.length && q.pending[0].end <= now) q.pending.shift();
    if (q.next - now > q.delaySec + _RING_QUEUE_MAX_LEAD_SEC) {
      q.stats.trims++;
      const keep = [];
      for (const p of q.pending) {
        if (p.start > now) { try { p.src.stop(); } catch (_) {} try { p.src.disconnect(); } catch (_) {} }
        else keep.push(p);
      }
      q.pending = keep;
      q.next = Math.max(now + Math.max(0.002, q.delaySec), keep.length ? keep[keep.length - 1].end : 0);
    }
    if (q.stats.leadMs.length < 20000) q.stats.leadMs.push(+((q.next - now) * 1000).toFixed(1));
    const src = ac.createBufferSource();
    src.buffer = buf;
    if (rateScale !== 1) src.playbackRate.value = rateScale;
    src.connect(v.gain || _getAudioBus(ac, 1));
    src.start(q.next);
    const spanStart = q.next;
    q.next += buf.duration / rateScale;
    q.pending.push({ src, start: spanStart, end: q.next });
    q.stats.chunks++;
    q.stats.bytes += bytes;
  };
  const _audioWallMs = () => {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  };

  // Integrate playback rate in clock time rather than applying today's rate
  // to the entire lifetime of a voice. Keep recent boundaries for queries of
  // already-rendered but not-yet-audible samples (device latency / deadline).
  // A changed origin means Play, a splice, or stream restart rebased the clock.
  // Times stay in the source clock's units (guest milliseconds or audio
  // seconds), avoiding loss of exact integer guest ticks at rate boundaries.
  const _rateElapsed = (v, key, start, now, delay = 0) => {
    if (now - start <= delay) return 0;
    const clock = v.rateClocks && v.rateClocks[key];
    if (!clock || clock.start !== start) return (now - start - delay) * (v.freq / v.rate);
    let segment = clock.segments[0];
    for (let i = clock.segments.length - 1; i >= 0; i--) {
      if (clock.segments[i].at <= now - delay) { segment = clock.segments[i]; break; }
    }
    return Math.max(0, segment.elapsed + (now - segment.at - delay) * segment.rate);
  };
  const _changeRateClock = (v, key, start, now, rate, retain) => {
    if (!Number.isFinite(start) || !Number.isFinite(now)) return;
    const clocks = v.rateClocks || (v.rateClocks = Object.create(null));
    let clock = clocks[key];
    if (!clock || clock.start !== start) {
      clock = clocks[key] = {start, segments: [{at: start, elapsed: 0, rate: v.freq / v.rate}]};
    }
    const at = Math.max(start, now);
    const elapsed = _rateElapsed(v, key, start, at);
    const segments = clock.segments;
    // Several changes while the guest clock is frozen are one boundary.
    if (segments[segments.length - 1].at === at) segments.pop();
    segments.push({at, elapsed, rate});
    // Preserve one anchor before the oldest audible query. This bounds a
    // long-running ring by changes within latency, not its whole lifetime.
    let remove = 0;
    while (remove + 1 < segments.length && segments[remove + 1].at <= now - retain) remove++;
    if (remove) segments.splice(0, remove);
  };

  // ---- frozen-recording PCM tap (docs/design-frozen-recording.md) --------
  //
  // Every sound this emulator makes originates as guest PCM arriving at one
  // of the two submit seams below, and every one of them is timestamped off
  // `_audioClockMs()` — the GUEST clock, which in frozen mode advances by
  // tickMs per executed step and not at all in between. So a tap placed here
  // records a session's audio on the same timeline as its frames, and hours
  // of agent think-time between steps cost the reconstruction nothing.
  //
  // The tap is passive: it copies bytes and never touches scheduling, so a
  // recorded session sounds exactly like an unrecorded one. `ctx.audioTap()`
  // is host.js's recorder (null when nothing is recording).
  const _audioTap = () => {
    try {
      const tap = typeof ctx.audioTap === 'function' ? ctx.audioTap() : null;
      return tap && tap.active ? tap : null;
    } catch (_) { return null; }
  };
  // What this voice's PCM is worth by the time it leaves the master bus:
  // its own GainNode, the WAVE bus, the master bus and the mixer mutes the
  // guest set through mixerSetControlDetails. Pan is the equal-power law a
  // StereoPannerNode applies, so a hard-panned effect stays hard-panned in
  // the recording rather than arriving centred.
  const _tapGain = (v) => {
    // Voice controls are guest state, not Web Audio state. Headless CLI runs
    // have no GainNode/StereoPannerNode, but DirectSound still changes these
    // values continuously (RCT attenuates its 1.2s ride loops to about 3%).
    // Reading only the optional nodes made every recorded ring full-volume,
    // so the short mechanical sample drowned the music and sounded stuck.
    const voiceGain = (v && Number.isFinite(v.gainValue)) ? v.gainValue
      : (v && v.gain && v.gain.gain && Number.isFinite(v.gain.gain.value))
        ? v.gain.gain.value : 1;
    const wave = _audioMixerState.mixerMutes[1] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[1] >>> 0);
    const master = _audioMixerState.mixerMutes[0] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[0] >>> 0);
    const amp = voiceGain * wave * master;
    const pan = (v && Number.isFinite(v.panValue)) ? v.panValue
      : (v && v.pan && v.pan.pan && Number.isFinite(v.pan.pan.value)) ? v.pan.pan.value : 0;
    const theta = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
    return { gainL: amp * Math.cos(theta), gainR: amp * Math.sin(theta) };
  };
  const _tapEmit = (v, guestStartMs, bytes) => {
    const tap = _audioTap();
    if (!tap || guestStartMs === null || guestStartMs === undefined) return;
    if (!bytes || !bytes.length) return;
    const { gainL, gainR } = _tapGain(v);
    try {
      tap.pcm({
        guestStartMs, sampleRate: (v.freq || v.rate) | 0,
        channels: v.channels | 0, bits: v.bits | 0, gainL, gainR, bytes,
      });
    } catch (_) { /* a full sink must never break the guest */ }
  };
  const _tapFrameBytes = (v) => Math.max(1, (v.channels | 0) * ((v.bits | 0) / 8));
  // A DirectSound secondary buffer is a RING the guest rewrites underneath a
  // play cursor that getPos() already derives from the guest clock. Mirror
  // exactly that cursor: on every event that changes the ring (Play, an
  // Unlock refresh, Stop) emit the window the cursor swept since last time,
  // read out of the ring content that was current DURING that window.
  const _tapFlushRing = (v, untilMs) => {
    const r = v && v.tapRing;
    if (!r || !r.bytes || !r.bytes.length) return;
    const now = (untilMs === null || untilMs === undefined) ? _audioClockMs() : untilMs;
    if (now === null || now === undefined) return;
    const bytesPerSec = r.bytesPerSec;
    const frame = r.frameBytes;
    let toByte = Math.floor((r.base || 0) + Math.max(0, (now - r.startMs) / 1000 * bytesPerSec));
    toByte -= toByte % frame;
    if (!r.loop) toByte = Math.min(toByte, r.bytes.length);
    const n = toByte - r.cursor;
    if (n <= 0) return;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = r.bytes[(r.cursor + i) % r.bytes.length];
    _tapEmit(v, r.startMs + ((r.cursor - (r.base || 0)) / bytesPerSec) * 1000, out);
    r.cursor = toByte;
  };
  // A looping ring that started before the recorder went live -- a menu theme
  // begun during an intro -- has no tap, because only Play created one, so a
  // long-running streamed track recorded as silence. Join it at the cursor
  // getPos() reports now, reading the ring where the last Play/refresh left it.
  const _tapJoinRing = (v, cursorByte) => {
    if (!v || v.tapRing || !v.snapshotLoop || !v.snapshotPlaying) return;
    const len = v.ringLen | 0;
    if (len <= 0 || !_audioTap()) return;
    const pcm = new Uint8Array(ctx.getMemory());
    const at = (cursorByte >>> 0) % len;
    _tapRingStart(v, pcm.slice(v.ringPtr, v.ringPtr + len), _audioClockMs(), true,
      at - (at % _tapFrameBytes(v)));
  };
  const _tapRingStart = (v, bytes, startMs, loop, startByte = 0) => {
    if (!_audioTap() || startMs === null || startMs === undefined || !bytes.length) {
      v.tapRing = null;
      return;
    }
    const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
    const base = Math.max(0, Math.min(bytes.length, startByte | 0));
    v.tapRing = {
      bytes, startMs, cursor: base, base, loop: !!loop,
      frameBytes: _tapFrameBytes(v),
      bytesPerSec: Math.max(1, v.rate * v.channels * (v.bits / 8) * rateScale),
    };
  };
  const _markWaveOutHot = (ms) => {
    const now = _audioWallMs();
    const hotMs = Math.max(250, Number.isFinite(ms) ? ms : 250);
    _audioDoneState.lastWaveActivityAt = now;
    _audioDoneState.waveOutHotUntilMs = Math.max(_audioDoneState.waveOutHotUntilMs || 0, now + hotMs);
    // Sound is imminent. If the host suspended the context for silence, bring
    // it back now — this runs on open and on every buffer submit, so the first
    // effect after a quiet stretch is not the one that gets swallowed.
    if (typeof ctx.wakeAudio === 'function') ctx.wakeAudio();
  };
  // MIDI liveness, kept DELIBERATELY separate from the waveOut hot window.
  //
  // Both keep the AudioContext out of idle suspend, but only waveOut wants the
  // other thing _isAudioHot() buys: a short interpreter quantum so the guest
  // refills its PCM buffers promptly. MIDI never refills anything -- notes are
  // scheduled ahead into Web Audio (0.85s for TinySynth, the whole song for
  // the oscillator fallback) -- so routing it through _markWaveOutHot would
  // throttle every MIDI app's emulator quantum for no benefit at all.
  const _markMidiHot = (ms) => {
    const now = _audioWallMs();
    const hotMs = Math.max(250, Number.isFinite(ms) ? ms : 250);
    _audioDoneState.midiHotUntilMs = Math.max(_audioDoneState.midiHotUntilMs || 0, now + hotMs);
    if (typeof ctx.wakeAudio === 'function') ctx.wakeAudio();
  };
  const _markWaveOutPending = (delta) => {
    const next = ((_audioDoneState.pendingWaveDoneCount || 0) + delta) | 0;
    _audioDoneState.pendingWaveDoneCount = Math.max(0, next);
    _markWaveOutHot(250);
  };
  if (!_audioDoneState.waveOutOpenHandles) _audioDoneState.waveOutOpenHandles = new Set();
  if (!_audioDoneState.waveScheduledHeaders) _audioDoneState.waveScheduledHeaders = new Map();
  if (!_audioDoneState.waveFunctionDoneQueue) _audioDoneState.waveFunctionDoneQueue = [];
  if (!_audioDoneState.waveRegistrations) _audioDoneState.waveRegistrations = new Map();
  if (!_audioDoneState.waveSubmissionSerial) _audioDoneState.waveSubmissionSerial = 0;
  if (!_audioDoneState.directSoundLoopingVoices) {
    _audioDoneState.directSoundLoopingVoices = new Set();
  }

  const _trackWaveOutHeader = (handle, waveHdrWA, waveHdrGA) => {
    if (!waveHdrWA) return;
    const key = handle >>> 0;
    let headers = _audioDoneState.waveScheduledHeaders.get(key);
    if (!headers) {
      headers = new Map();
      _audioDoneState.waveScheduledHeaders.set(key, headers);
    }
    const submission = {waveHdrGA:waveHdrGA>>>0,
      registration:_audioDoneState.waveRegistrations.get(key) || null,
      serial:++_audioDoneState.waveSubmissionSerial};
    headers.set(waveHdrWA >>> 0, submission);
    return submission;
  };

  const _untrackWaveOutHeader = (handle, waveHdrWA) => {
    if (!waveHdrWA || !_audioDoneState.waveScheduledHeaders) return;
    const key = handle >>> 0;
    const headers = _audioDoneState.waveScheduledHeaders.get(key);
    if (!headers) return;
    headers.delete(waveHdrWA >>> 0);
    if (!headers.size) _audioDoneState.waveScheduledHeaders.delete(key);
  };

  function _completeWaveOutDone(handle, waveHdrWA, waveHdrGA, expected) {
    try {
      const live=_audioDoneState.waveScheduledHeaders.get(handle>>>0)?.get(waveHdrWA>>>0);
      if (!live || (expected && live!==expected)) return 0;
      const registration=live.registration;
      if (registration && registration.retired) return 0;
      _untrackWaveOutHeader(handle, waveHdrWA);
      const dv = new DataView(ctx.getMemory());
      let wasInQueue = true;
      if (waveHdrWA) {
        const flags = dv.getUint32(waveHdrWA + 16, true);
        wasInQueue = (flags & 0x10) !== 0;
        dv.setUint32(waveHdrWA + 16, (flags | 1) & ~0x10, true); // WHDR_DONE, clear WHDR_INQUEUE
      }
      if (!wasInQueue) return 0;
      _markWaveOutPending(-1);
      const waveShared = _audioRegionMap.BASE.WAVE_OUT_SHARED;
      const cbType = registration ? registration.type : dv.getUint32(waveShared + 12, true);
      const cbHandle = registration ? registration.callback : dv.getUint32(waveShared + 4, true);
      if (cbType === 5 && cbHandle && getHost().set_event) getHost().set_event(cbHandle);
      if (cbType === 1 && cbHandle) {
        const e = ctx.exports || (ctx.renderer && ctx.renderer.wasm && ctx.renderer.wasm.exports);
        if (e && typeof e.post_message_q === 'function') {
          e.post_message_q(cbHandle >>> 0, 0x03BD, handle >>> 0, waveHdrGA >>> 0);
        }
      }
      if (cbType === 3 && cbHandle) {
        // CALLBACK_FUNCTION is an actual guest call, not a window message.
        // Queue it until the next slice boundary: mutating EIP while a host
        // import is unwinding would overwrite the live waveOutWrite frame.
        _audioDoneState.waveFunctionDoneQueue.push({
          handle: handle >>> 0,
          waveHdrGA: waveHdrGA >>> 0, registration, submission:live.serial,
        });
        if (typeof ctx.wakeWaveCallback === 'function') ctx.wakeWaveCallback();
      }
      return 1;
    } catch (_) {
      return 0;
    }
  }

  const _pumpWaveOutCompletions = () => {
    const notified = ctx._voices ? ctx._voices.notifyPump() : 0;
    const nowMs = _audioClockMs();
    if (nowMs === null) return notified;
    const q = _audioDoneState.waveDoneQueue || [];
    let write = 0;
    let completed = notified;
    for (let read = 0; read < q.length; read++) {
      const item = q[read];
      const voice = item && ctx._voices && ctx._voices._map
        ? ctx._voices._map[item.handle >>> 0] : null;
      const due = item && item.dueByte !== undefined && voice
        ? (!voice.paused && (ctx._voices.getPos(item.handle) >>> 0) >= (item.dueByte >>> 0))
        : !!(item && item.dueMs <= nowMs);
      if (due) {
        if (item.dueByte !== undefined && ctx._voices && ctx._voices.releaseStreamThrough) {
          ctx._voices.releaseStreamThrough(item.handle, item.dueByte);
        }
        completed += _completeWaveOutDone(item.handle, item.waveHdrWA, item.waveHdrGA, item.submission);
      } else {
        q[write++] = item;
      }
    }
    q.length = write;
    // Browser delivery uses its owner-aware boundary; standalone cooperative
    // hosts retain their synchronous explicit pump contract.
    if(typeof ctx.offerWaveCallback!=='function') {
      const q=_audioDoneState.waveFunctionDoneQueue,item=q[0],r=item?.registration,e=r?.owner?.exports;
      if(r?.retired) q.shift();
      else if(r?.owner?.kind==='cooperative' && e===ctx.exports && e.fire_wave_out_callback_bound &&
          e.fire_wave_out_callback_bound(r.handle,item.waveHdrGA,r.callback,r.instance)) q.shift();
    }
    return completed;
  };

  const _completeWaveOutHandle = (handle) => {
    let completed = 0;
    const key = handle >>> 0;
    const headers = _audioDoneState.waveScheduledHeaders &&
      _audioDoneState.waveScheduledHeaders.get(key);
    if (headers && headers.size) {
      for (const [waveHdrWA, submission] of Array.from(headers.entries())) {
        completed += _completeWaveOutDone(key, waveHdrWA, submission.waveHdrGA, submission);
      }
    }
    return completed;
  };

  // ---- waveIn capture --------------------------------------------------
  // Capture devices and queued WAVEHDRs are shared with worker imports in
  // the same app. Browser input is converted to the guest PCM format before
  // being copied into those buffers.
  const _waveIn = _audioDoneState.waveIn || (_audioDoneState.waveIn = {
    nextHandle: 0x0A0001,
    devices: new Map(),
  });

  const _getUserMedia = () => ctx.getUserMedia ||
    (typeof navigator !== 'undefined' && navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices));

  const _waveInConstraints = device => ({ audio: {
    // Capture at the device's native format, then resample below. Exact
    // 22050 Hz constraints are rejected by some Safari/mobile devices.
    channelCount: { ideal: device ? device.channels : 1 },
    sampleRate: { ideal: device ? device.rate : 22050 },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  } });

  const _stopCaptureStream = stream => {
    if (!stream || !stream.getTracks) return;
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch (_) {}
    }
  };

  const _claimWaveInAudioSession = active => {
    if (typeof window === 'undefined' || !window.claimAudioSession) return;
    window.claimAudioSession(active ? 'play-and-record' : 'playback');
  };

  const _restorePlaybackAudioSession = () => {
    if (_waveIn.primedCapture) return;
    for (const device of _waveIn.devices.values()) {
      if (device.running || device.acquirePending || device.stream) return;
    }
    _claimWaveInAudioSession(false);
  };

  // getUserMedia must be called directly from Safari's trusted DOM gesture.
  // Keep only one short-lived stream reservation; wave_in_start consumes the
  // promise once the guest handles that input, or the unused stream is
  // stopped so clicking another Sound Recorder control cannot hold the mic.
  const _primeWaveInCapture = () => {
    const getUserMedia = _getUserMedia();
    if (!getUserMedia || typeof window === 'undefined') return null;
    if (_waveIn.primedCapture) return _waveIn.primedCapture.promise;
    const primed = { claimed: false, stream: null, error: null, timer: 0, promise: null };
    _waveIn.primedCapture = primed;
    _waveIn.primeRequests = (_waveIn.primeRequests | 0) + 1;
    _claimWaveInAudioSession(true);
    let request;
    try {
      // Intentionally invoke before constructing another async boundary.
      request = getUserMedia(_waveInConstraints(null));
    } catch (error) {
      primed.error = error;
      request = null;
    }
    primed.promise = Promise.resolve(request).then(stream => {
      if (!stream) throw primed.error || new Error('microphone unavailable');
      primed.stream = stream;
      if (!primed.claimed) {
        primed.timer = setTimeout(() => {
          if (_waveIn.primedCapture !== primed || primed.claimed) return;
          _stopCaptureStream(stream);
          _waveIn.primedCapture = null;
          _restorePlaybackAudioSession();
        }, 10000);
      }
      return stream;
    }).catch(error => {
      primed.error = error;
      if (_waveIn.primedCapture === primed && !primed.claimed) {
        _waveIn.primedCapture = null;
      }
      _restorePlaybackAudioSession();
      return null;
    });
    return primed.promise;
  };
  if (typeof window !== 'undefined') _waveIn.primeCapture = _primeWaveInCapture;

  const _reportWaveInError = (device, error) => {
    const message = error && error.message ? error.message : String(error || 'microphone unavailable');
    if (device) device.lastError = message;
    _audioDoneState.waveInLastError = message;
    if (typeof ctx.onAudioCaptureError === 'function') {
      try { ctx.onAudioCaptureError(message); } catch (_) {}
    }
    console.warn('[waveIn] microphone acquisition failed:', message);
  };

  const _postWaveInMessage = (device, msg, waveHdrGA = 0) => {
    if (!device) return;
    if (device.callbackType === 1 && device.callback) {
      const e = ctx.exports || (ctx.renderer && ctx.renderer.wasm && ctx.renderer.wasm.exports);
      if (e && typeof e.post_message_q === 'function') {
        e.post_message_q(device.callback >>> 0, msg >>> 0, device.handle >>> 0, waveHdrGA >>> 0);
      }
    } else if (device.callbackType === 5 && device.callback && getHost().set_event) {
      getHost().set_event(device.callback >>> 0);
    }
  };

  const _completeWaveInBuffer = (device, buffer) => {
    if (!device || !buffer) return 0;
    try {
      const dv = new DataView(ctx.getMemory());
      dv.setUint32(buffer.waveHdrWA + 8, buffer.written >>> 0, true);
      const flags = dv.getUint32(buffer.waveHdrWA + 16, true);
      dv.setUint32(buffer.waveHdrWA + 16, (flags | 1) & ~0x10, true); // DONE, clear INQUEUE
      _postWaveInMessage(device, 0x03C0, buffer.waveHdrGA); // MM_WIM_DATA
      return 1;
    } catch (_) {
      return 0;
    }
  };

  const _flushWaveIn = (device, all) => {
    if (!device || !device.queue.length) return 0;
    let completed = 0;
    if (!all) {
      const first = device.queue[0];
      if (first && first.written > 0) {
        device.queue.shift();
        completed += _completeWaveInBuffer(device, first);
      }
      return completed;
    }
    while (device.queue.length) completed += _completeWaveInBuffer(device, device.queue.shift());
    return completed;
  };

  const _stopWaveInNodes = (device) => {
    if (!device) return;
    for (const node of [device.source, device.processor, device.silentGain]) {
      try { if (node && node.disconnect) node.disconnect(); } catch (_) {}
    }
    if (device.stream && device.stream.getTracks) {
      for (const track of device.stream.getTracks()) {
        try { track.stop(); } catch (_) {}
      }
    }
    device.source = null;
    device.processor = null;
    device.silentGain = null;
    device.stream = null;
  };

  const _feedWaveInPcm = (handle, channelData, sourceRate) => {
    let device = _waveIn.devices.get(handle >>> 0);
    if (!device && !handle) device = _waveIn.devices.values().next().value;
    if (!device || !device.running || !device.queue.length) return 0;
    const channels = Array.isArray(channelData) ? channelData : [channelData];
    if (!channels.length || !channels[0] || !channels[0].length) return 0;
    const frames = channels.reduce((n, data) => Math.min(n, data.length), channels[0].length);
    const ratio = Math.max(1, sourceRate || device.rate) / Math.max(1, device.rate);
    const bytesPerSample = device.bits === 16 ? 2 : 1;
    const bytes = new Uint8Array(ctx.getMemory());
    let phase = Number.isFinite(device.resamplePhase) ? device.resamplePhase : 0;
    let writtenFrames = 0;
    while (phase < frames && device.queue.length) {
      const sourceFrame = Math.min(frames - 1, Math.floor(phase));
      const buffer = device.queue[0];
      if (buffer.written + bytesPerSample * device.channels > buffer.length) {
        device.queue.shift();
        _completeWaveInBuffer(device, buffer);
        continue;
      }
      let mono = 0;
      for (const data of channels) mono += Number(data[sourceFrame]) || 0;
      mono /= channels.length;
      for (let ch = 0; ch < device.channels; ch++) {
        const sample = Math.max(-1, Math.min(1,
          device.channels === 1 ? mono : Number((channels[ch] || channels[0])[sourceFrame]) || 0));
        const ptr = buffer.dataWA + buffer.written;
        if (device.bits === 16) {
          const value = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
          bytes[ptr] = value & 0xFF;
          bytes[ptr + 1] = (value >> 8) & 0xFF;
        } else {
          bytes[ptr] = Math.max(0, Math.min(255, Math.round((sample + 1) * 127.5)));
        }
        buffer.written += bytesPerSample;
      }
      writtenFrames++;
      phase += ratio;
      if (buffer.written >= buffer.length) {
        device.queue.shift();
        _completeWaveInBuffer(device, buffer);
      }
    }
    device.resamplePhase = phase - frames;
    device.capturedFrames = (device.capturedFrames || 0) + writtenFrames;
    return writtenFrames;
  };

  function _copyPcmToAudioBuffer(buf, mem, ptr, len, channels, bits) {
    if (!buf || !mem || !channels || (bits !== 8 && bits !== 16)) return 0;
    const bps = bits / 8;
    const numSamples = Math.min(buf.length | 0, (len / (bps * channels)) | 0);
    if (numSamples <= 0) return 0;
    const bufferChannels = Number.isFinite(buf.numberOfChannels)
      ? buf.numberOfChannels | 0
      : (buf.channels && buf.channels.length) || channels;
    for (let ch = 0; ch < Math.min(channels, bufferChannels); ch++) {
      const dst = buf.getChannelData(ch);
      for (let i = 0; i < numSamples; i++) {
        const off = ptr + (i * channels + ch) * bps;
        if (bits === 16) {
          const s = mem[off] | (mem[off + 1] << 8);
          dst[i] = (s > 32767 ? s - 65536 : s) / 32768;
        } else {
          dst[i] = (mem[off] - 128) / 128;
        }
      }
    }
    return numSamples;
  }

  function _decodePcm(audioCtx, mem, ptr, len, channels, bits, rate) {
    const profileStartedAt = _profileNow();
    const bps = bits / 8;
    const numSamples = (len / (bps * channels)) | 0;
    let ok = false;
    try {
      if (numSamples <= 0) return null;
      const buf = audioCtx.createBuffer(channels, numSamples, rate);
      _copyPcmToAudioBuffer(buf, mem, ptr, len, channels, bits);
      ok = true;
      return buf;
    } finally {
      _profileEvent('audio.decodePcm', profileStartedAt, { bytes: len | 0, samples: numSamples | 0, channels: channels | 0, bits: bits | 0, rate: rate | 0, ok });
    }
  }

  // DirectSound passes D3DVALUE arguments as IEEE-754 floats. The WAT host
  // boundary deliberately keeps them as i32 bit patterns so the ordinary
  // Win32 dispatcher does not need a second float calling convention.
  const _voiceFloatBitsBuffer = new ArrayBuffer(4);
  const _voiceFloatBitsU32 = new Uint32Array(_voiceFloatBitsBuffer);
  const _voiceFloatBitsF32 = new Float32Array(_voiceFloatBitsBuffer);
  const _voiceFloatFromBits = (bits) => {
    _voiceFloatBitsU32[0] = bits >>> 0;
    return Number(_voiceFloatBitsF32[0]);
  };
  const _voiceFloatToBits = (value) => {
    _voiceFloatBitsF32[0] = Number(value) || 0;
    return _voiceFloatBitsU32[0] | 0;
  };

  const _voiceSpatialDefaults = () => ({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    coneAngles: [360, 360],
    coneOrientation: [0, 0, 1],
    coneOutsideVolume: 0,
    minDistance: 1,
    maxDistance: 1000000000,
    mode: 0, // DS3DMODE_NORMAL
  });

  const _listenerSpatialDefaults = () => ({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    orientFront: [0, 0, 1],
    orientTop: [0, 1, 0],
    distanceFactor: 1,
    rolloffFactor: 1,
    dopplerFactor: 1,
    commitSerial: 0,
  });

  const _setAudioParam = (param, value, ac) => {
    if (!param) return;
    try {
      if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, ac.currentTime);
      else param.value = value;
    } catch (_) {}
  };

  const _updateVoiceSpatialNode = (v) => {
    const panner = v && v.spatialPanner;
    const state = v && v.spatial;
    const ac = v && v.audioContext;
    if (!panner || !state || !ac) return;

    // DirectSound's default listener faces +Z; Web Audio's faces -Z. Mirror Z
    // while preserving DirectSound's +X-right, +Y-up coordinate convention.
    const listener = _voices && _voices._listener;
    const distanceFactor = listener ? listener.distanceFactor : 1;
    const x = state.position[0] * distanceFactor;
    const y = state.position[1] * distanceFactor;
    const z = -state.position[2] * distanceFactor;
    if (panner.positionX) {
      _setAudioParam(panner.positionX, x, ac);
      _setAudioParam(panner.positionY, y, ac);
      _setAudioParam(panner.positionZ, z, ac);
    } else if (typeof panner.setPosition === 'function') {
      try { panner.setPosition(x, y, z); } catch (_) {}
    }

    const ox = state.coneOrientation[0];
    const oy = state.coneOrientation[1];
    const oz = -state.coneOrientation[2];
    if (panner.orientationX) {
      _setAudioParam(panner.orientationX, ox, ac);
      _setAudioParam(panner.orientationY, oy, ac);
      _setAudioParam(panner.orientationZ, oz, ac);
    } else if (typeof panner.setOrientation === 'function') {
      try { panner.setOrientation(ox, oy, oz); } catch (_) {}
    }

    try {
      panner.refDistance = Math.max(0.000001, state.minDistance * distanceFactor);
      panner.maxDistance = Math.max(panner.refDistance, state.maxDistance * distanceFactor);
      panner.rolloffFactor = listener ? listener.rolloffFactor : 1;
      panner.coneInnerAngle = Math.max(0, Math.min(360, state.coneAngles[0]));
      panner.coneOuterAngle = Math.max(0, Math.min(360, state.coneAngles[1]));
      const cB = Math.max(-10000, Math.min(0, state.coneOutsideVolume | 0));
      panner.coneOuterGain = Math.pow(10, cB / 2000);
    } catch (_) {}
  };

  const _ensureVoiceSpatialNode = (v) => {
    if (!v || v.spatialPanner) return v && v.spatialPanner;
    const ac = v.audioContext;
    if (!ac || typeof ac.createPanner !== 'function') return null;
    try {
      const panner = ac.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.rolloffFactor = 1;
      panner.connect(v.master || _getAudioBus(ac, 1));
      v.spatialPanner = panner;
      _updateVoiceSpatialNode(v);
      return panner;
    } catch (_) {
      return null;
    }
  };

  const _routeVoiceSpatial = (v) => {
    if (!v || !v.gain) return;
    const enabled = !!v.spatial && v.spatial.mode !== 2; // DS3DMODE_DISABLE
    const panner = enabled ? _ensureVoiceSpatialNode(v) : null;
    try { v.gain.disconnect(); } catch (_) {}
    try {
      if (panner) v.gain.connect(panner);
      else if (v.pan) v.gain.connect(v.pan);
      else v.gain.connect(v.master || _getAudioBus(v.audioContext, 1));
    } catch (_) {}

    // Browsers without PannerNode still get useful left/right placement.
    if (enabled && !panner && v.pan && v.pan.pan) {
      const x = v.spatial.position[0];
      const distance = Math.hypot(x, v.spatial.position[1], v.spatial.position[2]);
      v.pan.pan.value = Math.max(-1, Math.min(1, x / Math.max(1, distance)));
    }
  };

  const _updateListenerSpatialNode = () => {
    if (!_voices) return;
    const state = _voices._listener;
    const ac = _voices._ac || ctx._audioCtx;
    const listener = ac && ac.listener;
    if (listener) {
      const scale = state.distanceFactor;
      const x = state.position[0] * scale;
      const y = state.position[1] * scale;
      const z = -state.position[2] * scale;
      const fx = state.orientFront[0];
      const fy = state.orientFront[1];
      const fz = -state.orientFront[2];
      const ux = state.orientTop[0];
      const uy = state.orientTop[1];
      const uz = -state.orientTop[2];
      if (listener.positionX) {
        _setAudioParam(listener.positionX, x, ac);
        _setAudioParam(listener.positionY, y, ac);
        _setAudioParam(listener.positionZ, z, ac);
      } else if (typeof listener.setPosition === 'function') {
        try { listener.setPosition(x, y, z); } catch (_) {}
      }
      if (listener.forwardX) {
        _setAudioParam(listener.forwardX, fx, ac);
        _setAudioParam(listener.forwardY, fy, ac);
        _setAudioParam(listener.forwardZ, fz, ac);
        _setAudioParam(listener.upX, ux, ac);
        _setAudioParam(listener.upY, uy, ac);
        _setAudioParam(listener.upZ, uz, ac);
      } else if (typeof listener.setOrientation === 'function') {
        try { listener.setOrientation(fx, fy, fz, ux, uy, uz); } catch (_) {}
      }
    }
    for (const voice of Object.values(_voices._map)) _updateVoiceSpatialNode(voice);
  };

  // One router per host, shared with the other instances through sharedAudio so
  // two apps cannot each allocate a control block and a module load.
  const _workletState = ctx.sharedAudio || ctx;
  if (!_workletState.voiceWorkletRouter && _workletRouterModule.createWorkletRouter) {
    _workletState.voiceWorkletRouter = _workletRouterModule.createWorkletRouter();
  }
  const _worklet = _workletState.voiceWorkletRouter || null;
  // Keep the router's LIVE flags (what a guest Worker may read the cursor
  // from) in step with whether the AudioContext is rendering at all.
  const _watchWorkletRunning = (ac) => {
    if (!_worklet || !ac || _workletState.voiceWorkletWatched === ac) return;
    _workletState.voiceWorkletWatched = ac;
    const sync = () => { if (_worklet.setRunning) _worklet.setRunning(ac.state === 'running'); };
    sync();
    if (typeof ac.addEventListener === 'function') ac.addEventListener('statechange', sync);
  };

  let _voices;
  if (ctx.sharedAudio && ctx.sharedAudio.voices) {
    _voices = ctx._voices = ctx.sharedAudio.voices;
  } else {
    _voices = ctx._voices = {
      _next: 0x0B0001,
      _map: {},
      _listener: _listenerSpatialDefaults(),
      _ac: null,
      _unlockInstalled: false,
      _notifyTimer: null,
      _notifyLive: new Set(),
      _notifySignal(handle) {
        // Resolve the final host namespace, including ThreadManager's
        // SetEvent override, so blocked Worker waiters receive Atomics.notify.
        const host = getHost();
        if (host && host.set_event) host.set_event(handle >>> 0);
      },
      notifySet(id, ptr, count, size) {
        const v = this._map[id];
        if (!v) return 0x80070057;
        this.notifyPump();
        if (v.snapshotPlaying) return 0x88780032;
        const memory = ctx.getMemory();
        ptr >>>= 0; count >>>= 0; size >>>= 0;
        if (!size || count > 100000 || (count && (!ptr || ptr + count * 8 > memory.byteLength))) return 0x80070057;
        let entries;
        try {
          entries = [];
          const data = new DataView(memory);
          for (let i = 0; i < count; i++) {
            const offset = data.getUint32(ptr + i * 8, true);
            const handle = data.getUint32(ptr + i * 8 + 4, true);
            if (!handle || (handle & 0x80000000) || (offset !== 0xffffffff && offset >= size)) return 0x80070057;
            const tm = ctx.threadManager;
            if (tm && typeof tm._getSyncIdx === 'function') {
              const idx = tm._getSyncIdx(handle);
              if (idx < 0 || Atomics.load(tm.syncView, idx * 4 + 1) !== 1) return 0x80070057;
            }
            entries.push({ offset, handle });
          }
        } catch (_) { return 0x8007000e; }
        // Commit only after the entire array has been copied and validated.
        v.notify = { entries, size, active: false, last: 0, raw: 0, clock: null, workletBase: null, segments: [] };
        this._notifyLive.delete(v);
        this.notifyPump();
        return 0;
      },
      _notifyClock() {
        // AudioContext.currentTime is frozen during output suspension. Only
        // a host with no audio device uses the deterministic guest clock.
        return this._ac ? this._ac.currentTime * 1000 : _audioClockMs();
      },
      notifyStart(v, size, off, loop) {
        const n = v.notify;
        if (!n || !n.entries.length) return;
        n.size = size; n.start = off; n.loop = !!loop;
        n.last = off - 1; n.raw = 0; n.clock = this._notifyClock();
        n.clockSource = this._ac;
        n.segments = [{ at: n.clock, raw: 0, rate: Math.max(1, v.freq * v.channels * (v.bits / 8)) }];
        n.workletBase = null; n.active = true;
        this._notifyLive.add(v);
        this.notifyPump();
      },
      notifyWorklet(v) {
        const n = v.notify;
        if (!n || !n.active) return;
        // Promotion preserves the interval already accounted by the source
        // clock. A new worklet's consumption begins at zero in its own epoch.
        n.workletBase = Math.max(0, n.last - n.start);
      },
      notifyProgress(v) {
        const n = v.notify;
        if (!n || !n.active) return null;
        let consumed;
        if (_worklet && v.workletNode && n.workletBase !== null) {
          const progress = _worklet.progressOf(v);
          if (!progress) return null; // pending first render or torn read
          consumed = n.workletBase + progress.bytes;
        } else {
          const now = this._notifyClock();
          const rate = Math.max(1, v.freq * v.channels * (v.bits / 8));
          if (now === null || n.clock === null) {
            n.clock = now;
            n.segments = [{ at: now, raw: n.raw, rate }];
            return null;
          }
          if (n.clockSource !== this._ac) {
            // A device can appear after a headless/muted start. Clock units
            // are milliseconds in both cases, but their origins differ.
            n.raw = Math.max(0, n.last - n.start);
            n.clock = now; n.clockSource = this._ac;
            n.segments = [{ at: now, raw: n.raw, rate }];
          }
          // Rate changes are pumped before v.freq is updated. The next
          // interval starts at that saved boundary, including sub-byte time.
          if (n.segments.at(-1).rate !== rate) n.segments.push({ at: n.clock, raw: n.raw, rate });
          n.raw += Math.max(0, now - n.clock) * rate / 1000;
          n.clock = now;
          const audibleAt = now - _outputLatencySec(this._ac) * 1000;
          while (n.segments.length > 1 && n.segments[1].at <= audibleAt - 500) n.segments.shift();
          let segment = n.segments[0];
          for (let i = n.segments.length - 1; i >= 0; i--) {
            if (n.segments[i].at <= audibleAt) { segment = n.segments[i]; break; }
          }
          consumed = Math.max(0, segment.raw + (audibleAt - segment.at) * segment.rate / 1000);
        }
        return n.start + (n.loop ? consumed : Math.min(n.size - n.start, consumed));
      },
      notifyPump() {
        let signaled = 0, active = false;
        for (const v of this._notifyLive) {
          const n = v.notify;
          if (!n || !n.active) continue;
          const position = this.notifyProgress(v);
          if (position !== null) {
            const end = Math.max(n.last, Math.floor(position));
            for (const item of n.entries) {
              if (item.offset === 0xffffffff) continue;
              // Count boundaries in the unwrapped interval (last, end].
              // At least one crossing sets the kernel event once; SetEvent
              // coalesces repeated signals while it remains signaled anyway.
              const crossed = n.loop
                ? Math.floor((end - item.offset) / n.size) > Math.floor((n.last - item.offset) / n.size)
                : n.last < item.offset && end >= item.offset;
              if (crossed) { this._notifySignal(item.handle); signaled++; }
            }
            n.last = end;
            if (!n.loop && end >= n.size) {
              n.active = false; v.snapshotPlaying = false;
              this._notifyLive.delete(v);
              for (const item of n.entries) if (item.offset === 0xffffffff) {
                this._notifySignal(item.handle); signaled++;
              }
            }
          }
          active ||= n.active;
        }
        // The existing completion pump is used by normal guest slices. The
        // timer also runs while every guest thread is blocked on an event.
        if (active && this._notifyTimer === null) {
          this._notifyTimer = setInterval(() => this.notifyPump(), 10);
          if (this._notifyTimer.unref) this._notifyTimer.unref();
        } else if (!active && this._notifyTimer !== null) {
          clearInterval(this._notifyTimer); this._notifyTimer = null;
        }
        return signaled;
      },
      notifyStop(v) {
        const n = v.notify;
        if (!n) return;
        const wasActive = n.active;
        this.notifyPump();
        // Natural completion already sent STOP during the pump.
        if (!wasActive || n.active) for (const item of n.entries) {
          if (item.offset === 0xffffffff) this._notifySignal(item.handle);
        }
        n.active = false;
        this._notifyLive.delete(v);
        this.notifyPump();
      },
      _installUnlock() {
        if (this._unlockInstalled || typeof window === 'undefined') return;
        this._unlockInstalled = true;
        const unlock = () => {
          // Cheap, idempotent, and has to happen inside a gesture on iOS for
          // the session change to stick -- see claimAudioSession in host.js.
          if (window.claimAudioSession) window.claimAudioSession();
          let ac = this._ac;
          if (ac && ac.state === 'closed') {
            this._ac = null;
            if (ctx._audioCtx === ac) ctx._audioCtx = null;
            ac = null;
          }
          if (!ac) ac = ctx._audioCtx;
          if (ac && ac.state === 'closed') {
            if (ctx._audioCtx === ac) ctx._audioCtx = null;
            ac = null;
          }
          if (!ac) ac = this._ensureCtx(44100);
          if (ac && ac.state === 'suspended') {
            try {
              const resumed = ac.resume();
              if (resumed && typeof resumed.then === 'function') {
                resumed.then(() => this._resyncAfterResume(), () => {});
              } else {
                this._resyncAfterResume();
              }
            } catch (_) {}
          }
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        window.addEventListener('click', unlock, { passive: true });
      },
      _ensureCtx(rate) {
        // First call is the guest asking for sound. The host holds an
        // AudioContext back until this happens (host.js primeAudio), because a
        // running context keeps the audio hardware powered for the whole
        // session and most apps never make a sound.
        if (typeof ctx.markAudioRequested === 'function') ctx.markAudioRequested();
        if (this._ac && this._ac.state === 'closed') this._ac = null;
        if (ctx._audioCtx && ctx._audioCtx.state === 'closed') ctx._audioCtx = null;
        if (this._ac) return this._ac;
        if (ctx._audioCtx) {
          this._ac = ctx._audioCtx;
          this._installUnlock();
          return this._ac;
        }
        const AC = (typeof AudioContext !== 'undefined') ? AudioContext :
                   (typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null;
        if (!AC) return null;
        if (typeof window !== 'undefined' && window.claimAudioSession) {
          const capturing = !!_waveIn.primedCapture ||
            Array.from(_waveIn.devices.values()).some(device =>
              device.running || device.acquirePending || device.stream);
          window.claimAudioSession(capturing ? 'play-and-record' : 'playback');
        }
        try { this._ac = new AC({ sampleRate: rate }); }
        catch (_) {
          try { this._ac = new AC(); } catch (_) { this._ac = null; }
        }
        if (this._ac) ctx._audioCtx = this._ac;
        this._installUnlock();
        return this._ac;
      },
      open(rate, channels, bits) {
        const id = this._next++;
        const v = {
          id, rate, channels, bits,
          mode: null,
          bytesWritten: 0,
          nextTime: 0,
          streamStartTime: null,
          streamStartTimeMs: null,
          nextDoneTimeMs: null,
          paused: false,
          pausedPosition: 0,
          streamChunks: [],
          sources: new Set(),
          timers: new Set(),
          gain: null,
          pan: null,
          // Canonical voice controls also exist without an AudioContext. The
          // browser nodes mirror these; the frozen recorder reads them.
          gainValue: 1,
          panValue: 0,
          master: null,
          audioContext: null,
          spatial: null,
          spatialPanner: null,
          freq: rate,
          currentSrc: null,
          snapshotPlaying: false,
          playStart: 0,
          lastDuration: 0,
          // Frozen-recording tap state (docs/design-frozen-recording.md):
          // where this voice's next queued waveOut chunk lands on the guest
          // clock, and the DirectSound ring being swept by the play cursor.
          tapNextMs: null,
          tapRing: null,
        };
        const ac = this._ensureCtx(rate);
        if (ac) {
          _updateListenerSpatialNode();
          v.gain = ac.createGain();
          const _master = _getAudioBus(ac, 1);
          v.master = _master;
          v.audioContext = ac;
          try { v.pan = ac.createStereoPanner(); v.gain.connect(v.pan); v.pan.connect(_master); }
          catch (_) { v.gain.connect(_master); }
          v.nextTime = ac.currentTime;
        }
        this._map[id] = v;
        return id;
      },
      _streamBytesPerSec(v) {
        return Math.max(1, v.rate * v.channels * (v.bits / 8));
      },
      _scheduleStreamChunk(v, chunk, when, offsetBytes = 0) {
        const ac = this._ac;
        if (!ac || !chunk || !chunk.buffer) return when;
        const bytesPerSec = this._streamBytesPerSec(v);
        const clampedOffset = Math.max(0, Math.min(chunk.byteLength, offsetBytes | 0));
        const remainingBytes = chunk.byteLength - clampedOffset;
        if (!remainingBytes) return when;
        try {
          const src = ac.createBufferSource();
          src.buffer = chunk.buffer;
          const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
          if (rateScale !== 1) src.playbackRate.value = rateScale;
          src.connect(v.gain || _getAudioBus(ac, 1));
          const offsetSec = clampedOffset / bytesPerSec;
          const durationSec = remainingBytes / bytesPerSec / Math.max(0.000001, rateScale);
          chunk.source = src;
          chunk.scheduledAt = when;
          chunk.scheduledOffset = clampedOffset;
          src.onended = () => {
            v.sources.delete(src);
            if (chunk.source === src) chunk.source = null;
          };
          src.start(when, offsetSec);
          v.sources.add(src);
          return when + durationSec;
        } catch (_) {
          return when;
        }
      },
      // The other half of the suspended-context guard in writeStream. A
      // context can be suspended by iOS, by a phone call, by the idle watcher
      // or by the tab going away, and whatever was already scheduled at that
      // moment is still queued at a `when` the frozen clock never reached.
      // Resuming would play that stale backlog before any live audio. Drop it
      // and rebase every voice's byte clock on the new now, so the next
      // submit is the next thing heard.
      _resyncAfterResume() {
        const ac = this._ac;
        if (!ac || ac.state !== 'running') return;
        for (const key of Object.keys(this._map)) {
          const v = this._map[key];
          if (!v) continue;
          this._stopStreamSources(v);
          v.nextTime = ac.currentTime;
          // null, not `currentTime`: writeStream re-derives it from the byte
          // offset of whatever arrives next, which is the only value that
          // keeps getPos() honest across the gap.
          v.streamStartTime = null;
          if (v.mode === 'stream' && v.streamChunks) v.streamChunks.length = 0;
        }
      },
      _stopStreamSources(v) {
        if (!v || !v.sources || !v.sources.size) return;
        for (const src of Array.from(v.sources)) {
          try { src.stop(0); } catch (_) {}
        }
        v.sources.clear();
        for (const chunk of v.streamChunks || []) chunk.source = null;
      },
      writeStream(id, ptr, len) {
        const profileStartedAt = _profileNow();
        const v = this._map[id]; if (!v) return;
        let scheduled = false;
        try {
          v.mode = 'stream';
          const startByte = v.bytesWritten;
          v.bytesWritten += len;
          const pcm = new Uint8Array(ctx.getMemory());
          const durationMs = len / Math.max(1, v.rate * v.channels * (v.bits / 8)) * 1000;
          _markPcmPeak(1, pcm, ptr, len, v.channels, v.bits, durationMs);
          // Frozen-recording tap. A waveOut stream is a queue, not a ring:
          // buffer k plays where buffer k-1 ended, and a stream that drained
          // restarts at "now" — the same rebase `v.nextTime` does against the
          // AudioContext clock, mirrored here against the guest clock. Placed
          // before the no-AudioContext return so a muted/headless page still
          // records what the guest submitted.
          if (_audioTap()) {
            const nowMs = _audioClockMs();
            if (nowMs !== null) {
              const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
              const bytesPerSec = Math.max(1, v.rate * v.channels * (v.bits / 8) * rateScale);
              const at = (v.tapNextMs === null || v.tapNextMs === undefined || v.tapNextMs < nowMs)
                ? nowMs : v.tapNextMs;
              _tapEmit(v, at, pcm.slice(ptr, ptr + len));
              v.tapNextMs = at + (len / bytesPerSec) * 1000;
            }
          }
          const ac = this._ac;
          if (!ac) {
            const nowMs = _audioClockMs();
            if (nowMs !== null && v.streamStartTimeMs === null) v.streamStartTimeMs = nowMs;
            return;
          }
          try {
            const buf = _decodePcm(ac, pcm, ptr, len, v.channels, v.bits, v.rate);
            if (!buf) return;
            const chunk = {
              buffer: buf,
              startByte,
              endByte: startByte + len,
              byteLength: len,
              source: null,
            };
            v.streamChunks.push(chunk);
            // A suspended AudioContext has a FROZEN currentTime, so a chunk
            // scheduled into one lands at whatever `v.nextTime` has climbed
            // to and every later chunk stacks behind it. Nothing plays while
            // the context is down, so the queue is unbounded, and the resume
            // pays it all out from the past at once -- which is what the last
            // few seconds of a game replaying on a loop after you tap to bring
            // sound back actually is. Real hardware does not hear audio it was
            // not playing; don't schedule it, and let the resume rebase.
            if (!v.paused && ac.state === 'running') {
              const t = Math.max(ac.currentTime, v.nextTime);
              const bytesPerSec = this._streamBytesPerSec(v);
              const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
              // A stream can drain and later receive another buffer. Rebase
              // its continuous byte clock at that boundary so the silent gap
              // is not counted as audio that played.
              if (v.streamStartTime === null ||
                  (!v.sources.size && ac.currentTime >= v.nextTime)) {
                v.streamStartTime = t - startByte / bytesPerSec / Math.max(0.000001, rateScale);
              }
              v.nextTime = this._scheduleStreamChunk(v, chunk, t, 0);
              scheduled = !!chunk.source;
            }
          } catch (_) {}
        } finally {
          _profileEvent('audio.writeStream', profileStartedAt, { id: id >>> 0, bytes: len | 0, scheduled });
        }
      },
      playRing(id, ptr, len, startOff, loop) {
        const v = this._map[id]; if (!v) return;
        this.notifyPump();
        v.mode = 'snapshot';
        const pcm = new Uint8Array(ctx.getMemory());
        // DirectSound software mixers such as Miles keep one secondary buffer
        // looping and rewrite its ring through Lock/Unlock. `loop === 2` is
        // the internal refresh operation used by the WAT Unlock handler. A
        // started AudioBufferSource acquires its AudioBuffer contents, so
        // mutating getChannelData() in place is not a portable streaming
        // mechanism. Replace it at the same loop offset instead: the old and
        // new sources meet on one scheduled audio-clock boundary while the
        // DirectSound play cursor continues independently from snapshotStartMs.
        if (loop === 2) {
          _markWaveOutHot(500);
          // Frozen-recording tap: the ring changed under a cursor that is
          // still sweeping. Emit everything that played from the OLD content
          // first, then swap in what the guest just wrote.
          v.ringPtr = ptr;
          v.ringLen = len;
          if (v.tapRing) {
            _tapFlushRing(v);
            v.tapRing.bytes = pcm.slice(ptr, ptr + len);
          } else {
            _tapJoinRing(v, this.getPos(id));
          }
          // Already rendered by the worklet? Then an Unlock is a descriptor
          // write and nothing else -- no replacement node, no `when`, and so
          // no seam to sample at the wrong instant.
          if (_worklet && v.workletNode &&
              _worklet.route(ctx, this._ac, v, ctx.getMemory(), ptr, len, 0, 1, true)) {
            _markPcmPeak(1, pcm, ptr, len, v.channels, v.bits, 120);
            return;
          }
          const old = v.currentSrc;
          const live = old && old.buffer;
          const ac = this._ac;
          // Worker mode: the mixer thread free-runs, so the ring is kept full
          // whatever the page is doing, and the worklet can play it straight
          // out of shared memory -- no queue, no splice, and (guest-rpc.js)
          // no page round trip for the cursor or for this Unlock. The module
          // loads lazily, so the Play that started this ring usually found it
          // still loading; promote the ring on the first refresh after it is
          // ready, continuing from where the ring audibly is.
          if (_worklet && !v.workletNode && ctx.liveAudioRing && ac && live && old.loop) {
            const at = this.getPos(id) >>> 0;
            if (_worklet.route(ctx, ac, v, ctx.getMemory(), ptr, len, at, 1)) {
              this.notifyWorklet(v);
              _watchWorkletRunning(ac);
              try { old.stop(); } catch (_) {}
              v.currentSrc = null;
              const q = v.delayQ;
              if (q && q.pending) for (const span of q.pending) { try { span.src.stop(); } catch (_) {} }
              v.delayQ = null;
              v.snapshotBytes = len;
              v.playStart = ac.currentTime - at / Math.max(1, v.rate * v.channels * (v.bits / 8));
              _markPcmPeak(1, pcm, ptr, len, v.channels, v.bits, 120);
              return;
            }
          }
          const delaySec = ac && live && old.loop ? _ringDelayFor(v, len) : null;
          if (delaySec !== null) {
            _ringDelayRefresh(ac, v, pcm, ptr, len, delaySec);
            _markPcmPeak(1, pcm, ptr, len, v.channels, v.bits, 120);
            return;
          }
          if (ac && live && old.loop) {
            const replacement = _decodePcm(ac, pcm, ptr, len, v.channels, v.bits, v.rate);
            if (!replacement) return;
            const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
            const duration = Math.max(0.000001, replacement.duration);
            // The splice happens at `when`, not now, so the ring position has
            // to be sampled AT `when`. Measuring it at `ac.currentTime` and
            // starting the replacement there replays the intervening 5ms on
            // every refresh: measured on a real iPhone running StarCraft,
            // 5.4 refreshes/s x 5ms = 27ms of duplicated audio per second, so
            // the ring both stuttered five times a second and fell a full
            // second behind real time every 37s.
            const when = ac.currentTime + 0.005;
            const elapsed = _rateElapsed(v, 'snapshotAudio', v.playStart, when);
            const offset = elapsed % duration;
            const src = ac.createBufferSource();
            src.buffer = replacement;
            src.loop = true;
            if (rateScale !== 1) src.playbackRate.value = rateScale;
            src.connect(v.gain || _getAudioBus(ac, 1));
            src.start(when, offset);
            v.currentSrc = src;
            v.playStart = when - offset / Math.max(0.000001, rateScale);
            src.onended = () => {
              if (v.currentSrc === src) {
                v.currentSrc = null;
                v.snapshotPlaying = false;
              }
            };
            try { old.stop(when); } catch (_) {}
            _markPcmPeak(1, pcm, ptr, len, v.channels, v.bits, 120);
          }
          return;
        }
        const bytesPerSecond = Math.max(1, v.rate * v.channels * (v.bits / 8));
        const off = Math.max(0, Math.min(len, startOff | 0));
        v.delayQ = null;
        // A LOOPING DirectSound buffer is a ring: the cursor starts at `off`
        // and wraps through the whole buffer, it does not stop at the end.
        // Truncating it to the tail is what made Miles unbearable in SimGolf
        // — its mixer resyncs with Stop / SetCurrentPosition / Play several
        // times a second, and by then the cursor sits near the end of the
        // 64KB ring, so the tail was 25, then 12, then 1 byte of PCM looped
        // at 22kHz. Only a one-shot Play really plays offset..end.
        const playFrom = loop ? 0 : off;
        const playLength = loop ? len : Math.max(0, len - off);
        const startSec = loop ? off / bytesPerSecond : 0;
        const durationMs = playLength / bytesPerSecond * 1000;
        if (loop) _audioDoneState.directSoundLoopingVoices.add(id >>> 0);
        else _audioDoneState.directSoundLoopingVoices.delete(id >>> 0);
        _markWaveOutHot(durationMs + 250);
        // Remember when this snapshot started against the audio clock, not the
        // AudioContext one. A DirectSound game polls GetCurrentPosition to pace
        // itself, and with no AudioContext (headless) the cursor otherwise sits
        // at a constant forever and the game waits on a sound that never plays.
        v.rateClocks = null;
        v.snapshotStartMs = _audioClockMs();
        v.snapshotBytes = playLength;
        v.snapshotLoop = !!loop;
        v.snapshotStartByte = playFrom === 0 ? off : 0;
        v.snapshotPlaying = playLength > 0;
        v.ringPtr = ptr + playFrom;
        v.ringLen = playLength;
        // A one-shot must retire an earlier looping worklet before falling
        // back to its BufferSource; otherwise both keep making sound.
        if (!loop && _worklet && v.workletNode) _worklet.release(v);
        this.notifyStart(v, len, off, loop);
        // Frozen-recording tap: a new Play replaces whatever was sounding.
        // Retire the old ring's remaining window, then start a fresh one at
        // the same guest instant getPos() will measure its cursor from.
        // Guarded, not just short-circuited inside: the ring copy is a real
        // allocation on a path every DirectSound effect takes, and an
        // unrecorded session must not pay for it.
        if (_audioTap()) {
          _tapFlushRing(v);
          _tapRingStart(v, pcm.slice(ptr + playFrom, ptr + playFrom + playLength),
                        v.snapshotStartMs, loop, v.snapshotStartByte);
        } else if (v.tapRing) {
          v.tapRing = null;
        }
        _markPcmPeak(1, pcm, ptr + playFrom, playLength, v.channels, v.bits,
          loop ? 500 : durationMs);
        const ac = this._ac; if (!ac) return;
        // A LOOPING ring is the only shape that gains anything from the
        // worklet, and route() refuses everything else -- a one-shot Play()
        // never gets here with a truthy `loop` and so never creates a node.
        if (_worklet && _worklet.route(ctx, ac, v, ctx.getMemory(),
                                       ptr + playFrom, playLength, startSec ? off : 0, loop)) {
          this.notifyWorklet(v);
          _watchWorkletRunning(ac);
          if (v.currentSrc) { try { v.currentSrc.stop(); } catch (_) {} v.currentSrc = null; }
          v.playStart = ac.currentTime - startSec;
          return;
        }
        try {
          const buf = _decodePcm(ac, pcm, ptr + playFrom, playLength,
                                 v.channels, v.bits, v.rate);
          if (!buf) return;
          if (v.currentSrc) { try { v.currentSrc.stop(); } catch (_) {} v.currentSrc = null; }
          const src = ac.createBufferSource();
          src.buffer = buf;
          // Preserve DirectSound semantics exactly. Software mixers such as
          // Miles deliberately start their secondary buffers looping, then
          // service and stop them from a periodic callback.
          src.loop = !!loop;
          if (v.freq && v.freq !== v.rate) src.playbackRate.value = v.freq / v.rate;
          src.connect(v.gain || _getAudioBus(ac, 1));
          v.lastDuration = buf.duration;
          // Start where the guest's play cursor is. `playStart` stays the
          // instant byte 0 of the ring would have sounded, so getPos() and
          // the tap keep measuring from the same origin.
          const now = ac.currentTime;
          v.playStart = now - startSec;
          src.start(now, Math.min(startSec, Math.max(0, buf.duration - 0.000001)));
          v.currentSrc = src;
          src.onended = () => {
            if (v.currentSrc === src) {
              v.currentSrc = null;
              v.snapshotPlaying = false;
            }
          };
        } catch (_) {}
      },
      stop(id) {
        const v = this._map[id]; if (!v) return;
        this.notifyStop(v);
        _audioDoneState.directSoundLoopingVoices.delete(id >>> 0);
        // Frozen-recording tap: everything up to this instant was audible.
        _tapFlushRing(v);
        v.tapRing = null;
        v.tapNextMs = null;
        v.snapshotPlaying = false;
        if (v.currentSrc) { try { v.currentSrc.stop(); } catch (_) {} v.currentSrc = null; }
        // Rule 3: the node's lifetime is the playback, not the voice record.
        // A Stop releases it (and its descriptor slot) rather than leaving a
        // process() callback running silence for the rest of the session.
        if (_worklet) _worklet.release(v);
        this._stopStreamSources(v);
        if (v.timers && v.timers.size) {
          for (const timer of Array.from(v.timers)) {
            try { clearTimeout(timer); } catch (_) {}
          }
          v.timers.clear();
        }
        if (v.mode === 'stream') {
          v.rateClocks = null;
          v.bytesWritten = 0;
          v.streamStartTime = null;
          v.streamStartTimeMs = null;
          v.nextTime = this._ac ? this._ac.currentTime : 0;
          v.nextDoneTimeMs = null;
          v.paused = false;
          v.pausedPosition = 0;
          v.streamChunks.length = 0;
          if (_audioDoneState.waveDoneQueue && _audioDoneState.waveDoneQueue.length) {
            _audioDoneState.waveDoneQueue = _audioDoneState.waveDoneQueue.filter(item => (item.handle >>> 0) !== (id >>> 0));
          }
        }
      },
      pauseStream(id) {
        const v = this._map[id];
        if (!v || v.mode !== 'stream') return 5; // MMSYSERR_INVALHANDLE
        if (v.paused) return 0;
        v.pausedPosition = this.getPos(id) >>> 0;
        v.paused = true;
        this._stopStreamSources(v);
        return 0;
      },
      restartStream(id) {
        const v = this._map[id];
        if (!v || v.mode !== 'stream') return 5; // MMSYSERR_INVALHANDLE
        if (!v.paused) return 0;
        const bytesPerSec = this._streamBytesPerSec(v);
        const rateScale = v.freq && v.freq !== v.rate ? (v.freq / v.rate) : 1;
        const position = Math.max(0, Math.min(v.bytesWritten, v.pausedPosition >>> 0));
        v.paused = false;
        if (!this._ac) {
          const nowMs = _audioClockMs();
          if (nowMs !== null) {
            v.streamStartTimeMs = nowMs - position / bytesPerSec /
              Math.max(0.000001, rateScale) * 1000;
          }
          return 0;
        }
        let when = this._ac.currentTime;
        v.streamStartTime = when - position / bytesPerSec /
          Math.max(0.000001, rateScale);
        for (const chunk of v.streamChunks) {
          if (chunk.endByte <= position) continue;
          const offset = Math.max(0, position - chunk.startByte);
          when = this._scheduleStreamChunk(v, chunk, when, offset);
        }
        v.nextTime = when;
        return 0;
      },
      releaseStreamThrough(id, byteOffset) {
        const v = this._map[id];
        if (!v || !v.streamChunks || !v.streamChunks.length) return;
        const limit = byteOffset >>> 0;
        v.streamChunks = v.streamChunks.filter(chunk => chunk.endByte > limit);
      },
      close(id) {
        const v = this._map[id];
        // Release cancels registration before retiring the playback. No late
        // timer may signal a handle after the owning buffer is destroyed.
        if (v) { v.notify = null; this._notifyLive.delete(v); }
        this.stop(id);
        this.notifyPump();
        delete this._map[id];
      },
      getPos(id) {
        this.notifyPump();
        const v = this._map[id]; if (!v) return 0;
        if (v.notify && v.notify.active) {
          const n = v.notify, position = Math.max(n.start, n.last);
          return n.loop ? position % n.size : Math.min(n.size - n.start, position - n.start);
        }
        const bytesPerSec = v.rate * v.channels * (v.bits / 8);
        // For STREAM/waveOut voices, report bytes that have actually reached
        // the AudioContext clock. If there is no browser audio clock (CLI PCM
        // capture), fall back to submitted bytes so headless decode keeps moving.
        if (v.mode === 'stream') {
          if (v.paused) return Math.max(0, Math.min(v.bytesWritten, v.pausedPosition >>> 0));
          if (!this._ac) {
            const nowMs = _audioClockMs();
            if (nowMs === null || v.streamStartTimeMs === null) return v.bytesWritten;
            const played = Math.floor(_rateElapsed(v, 'streamGuest', v.streamStartTimeMs, nowMs) * bytesPerSec / 1000);
            return Math.max(0, Math.min(v.bytesWritten, played));
          }
          if (v.streamStartTime === null) return v.bytesWritten;
          const played = Math.floor(_rateElapsed(v, 'streamAudio', v.streamStartTime, this._ac.currentTime) * bytesPerSec);
          return Math.max(0, Math.min(v.bytesWritten, played));
        }
        // For SNAPSHOT voices, derive cursor from elapsed audio time. This has
        // to hold with an AudioContext too, not just headless: a one-shot
        // source clears currentSrc from onended, and falling through to
        // bytesWritten then snaps the play cursor back to 0 for a sound that
        // already finished. A game pacing itself on GetCurrentPosition sees
        // the cursor go backwards and waits forever -- Diablo's Storm video
        // pump (0x4532dd) froze the intro on exactly that, in the browser
        // only, because headless took this branch and the browser did not.
        //
        // A routed voice knows its cursor rather than inferring one: the
        // worklet publishes the byte it last rendered from. Everything below
        // reconstructs that from a clock and an assumed start instant, which
        // is exactly the reasoning that drifted when the splice was wrong --
        // the guest cursor stayed plausible while the audible ring did not.
        // Only while the context renders: a suspended one leaves the cursor
        // standing still (see audio-worklet-host.js publishVoice).
        if (_worklet && v.workletNode && (!this._ac || this._ac.state === 'running')) {
          const cursor = _worklet.cursorOf(v);
          if (cursor !== null && v.snapshotBytes > 0) return cursor % v.snapshotBytes;
        }
        // A queued ring (see _ringDelayFor) plays from the queue, so its
        // cursor is the ring source's own start instant on the AudioContext
        // clock -- the clock the queue schedules against.
        if (v.delayQ && v.snapshotLoop && v.currentSrc && this._ac &&
            this._ac.state === 'running' && typeof v.playStart === 'number' &&
            v.snapshotBytes > 0) {
          // Under the global deadline clock a wake run late sees the cursor
          // as it stood at the time that clock reads, like every other clock.
          const lagSec = typeof ctx.deadlineLagMs === 'function' ? ctx.deadlineLagMs() / 1000 : 0;
          let played = Math.floor(_rateElapsed(v, 'snapshotAudio', v.playStart,
            this._ac.currentTime, lagSec) * bytesPerSec);
          // Never behind what a caller already saw: a mixer reading the
          // cursor go backwards takes it for a lap and writes a block twice.
          if (v.cursorStart !== v.playStart) { v.cursorStart = v.playStart; v.cursorMax = 0; }
          if (played < v.cursorMax) played = v.cursorMax; else v.cursorMax = played;
          const frame = Math.max(1, v.channels * (v.bits / 8));
          return (played - played % frame) % v.snapshotBytes;
        }
        if (v.snapshotBytes > 0) {
          let playedSeconds = null;
          const nowMs = _audioClockMs();
          const latency = _outputLatencySec(this._ac);
          if (nowMs !== null && v.snapshotStartMs !== null
              && v.snapshotStartMs !== undefined) {
            playedSeconds = _rateElapsed(v, 'snapshotGuest', v.snapshotStartMs, nowMs, latency * 1000) / 1000;
          } else if (this._ac && typeof v.playStart === 'number') {
            playedSeconds = _rateElapsed(v, 'snapshotAudio', v.playStart, this._ac.currentTime, latency);
          }
          if (playedSeconds !== null) {
            const played = Math.floor(playedSeconds * bytesPerSec);
            // A looping ring was started at snapshotStartByte, not at 0.
            return v.snapshotLoop
              ? ((v.snapshotStartByte || 0) + played) % v.snapshotBytes
              : Math.min(v.snapshotBytes, played);
          }
        }
        if (v.currentSrc && v.lastDuration > 0 && this._ac) {
          const elapsed = this._ac.currentTime - v.playStart;
          const cursor = (elapsed * bytesPerSec) | 0;
          const total = (v.lastDuration * bytesPerSec) | 0;
          return total > 0 ? (cursor % total) : 0;
        }
        return v.bytesWritten;
      },
      isPlaying(id) {
        this.notifyPump();
        const v = this._map[id];
        if (!v) return false;
        if (v.notify && v.notify.active) return true;
        if (v.mode === 'snapshot') {
          if (!v.snapshotPlaying) return false;
          if (v.snapshotLoop) return true;
          // Retire a one-shot from the same guest clock that advances its
          // cursor even when an AudioBufferSourceNode still exists. Browsers
          // may keep a newly-created AudioContext suspended until a user
          // gesture, in which case source.onended never fires and treating
          // currentSrc as authoritative leaves movie players waiting forever
          // on their already-finished final frame.
          const nowMs = _audioClockMs();
          if (nowMs === null || v.snapshotStartMs === null || v.snapshotStartMs === undefined) {
            return !!v.currentSrc;
          }
          const bytesPerSec = Math.max(1, v.rate * v.channels * (v.bits / 8));
          const elapsedMs = _rateElapsed(v, 'snapshotGuest', v.snapshotStartMs, nowMs);
          if (elapsedMs * bytesPerSec < v.snapshotBytes * 1000) return true;
          v.snapshotPlaying = false;
          if (v.currentSrc) {
            const src = v.currentSrc;
            v.currentSrc = null;
            try { src.stop(); } catch (_) {}
          }
          return false;
        }
        return !!(v.sources && v.sources.size);
      },
      setGain(id, g) {
        const v = this._map[id]; if (!v) return;
        v.gainValue = g;
        if (v.gain) v.gain.gain.value = g;
      },
      setPan(id, p) {
        const v = this._map[id]; if (!v) return;
        v.panValue = p;
        if (v.pan) v.pan.pan.value = p;
      },
      setSpatial(id, property, a, b, c) {
        if ((id >>> 0) === 0) {
          const s = this._listener;
          switch (property | 0) {
            case 0: s.position = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
            case 3: s.velocity = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
            case 6: s.orientFront = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
            case 9: s.orientTop = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
            case 12: s.distanceFactor = Math.max(0.000001, _voiceFloatFromBits(a)); break;
            case 13: s.rolloffFactor = Math.max(0, _voiceFloatFromBits(a)); break;
            case 14: s.dopplerFactor = Math.max(0, _voiceFloatFromBits(a)); break;
            case 15: s.commitSerial = (s.commitSerial + 1) >>> 0; break;
            default: return;
          }
          _updateListenerSpatialNode();
          return;
        }
        const v = this._map[id]; if (!v) return;
        if (!v.spatial) v.spatial = _voiceSpatialDefaults();
        const s = v.spatial;
        switch (property | 0) {
          case 0: s.position = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
          case 3: s.velocity = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
          case 6: s.coneAngles = [a >>> 0, b >>> 0]; break;
          case 8: s.coneOrientation = [_voiceFloatFromBits(a), _voiceFloatFromBits(b), _voiceFloatFromBits(c)]; break;
          case 11: s.coneOutsideVolume = a | 0; break;
          case 12: s.minDistance = Math.max(0.000001, _voiceFloatFromBits(a)); break;
          case 13: s.maxDistance = Math.max(0.000001, _voiceFloatFromBits(a)); break;
          case 14: s.mode = a >>> 0; break;
          case 15: break; // enable the default 3D state without changing it
          default: return;
        }
        _updateVoiceSpatialNode(v);
        _routeVoiceSpatial(v);
      },
      getSpatial(id, property) {
        if ((id >>> 0) === 0) {
          const s = this._listener;
          switch (property | 0) {
            case 0: case 1: case 2: return _voiceFloatToBits(s.position[property | 0]);
            case 3: case 4: case 5: return _voiceFloatToBits(s.velocity[(property | 0) - 3]);
            case 6: case 7: case 8: return _voiceFloatToBits(s.orientFront[(property | 0) - 6]);
            case 9: case 10: case 11: return _voiceFloatToBits(s.orientTop[(property | 0) - 9]);
            case 12: return _voiceFloatToBits(s.distanceFactor);
            case 13: return _voiceFloatToBits(s.rolloffFactor);
            case 14: return _voiceFloatToBits(s.dopplerFactor);
            case 15: return s.commitSerial | 0;
            default: return 0;
          }
        }
        const v = this._map[id];
        const s = v && v.spatial ? v.spatial : _voiceSpatialDefaults();
        switch (property | 0) {
          case 0: case 1: case 2: return _voiceFloatToBits(s.position[property | 0]);
          case 3: case 4: case 5: return _voiceFloatToBits(s.velocity[(property | 0) - 3]);
          case 6: return s.coneAngles[0] | 0;
          case 7: return s.coneAngles[1] | 0;
          case 8: case 9: case 10: return _voiceFloatToBits(s.coneOrientation[(property | 0) - 8]);
          case 11: return s.coneOutsideVolume | 0;
          case 12: return _voiceFloatToBits(s.minDistance);
          case 13: return _voiceFloatToBits(s.maxDistance);
          case 14: return s.mode | 0;
          default: return 0;
        }
      },
      setFreq(id, hz) {
        this.notifyPump();
        const v = this._map[id]; if (!v) return;
        const frequency = hz || v.rate;
        if (frequency === v.freq) return;
        const rate = frequency / v.rate;
        const nowMs = _audioClockMs();
        const ac = this._ac;
        // Publish the old-rate interval before _tapEmit observes the new
        // frequency. Retain sub-frame progress; rounding on every edit would
        // freeze a ring whose rate is updated more often than one PCM frame.
        if (v.tapRing && nowMs !== null) {
          _tapFlushRing(v, nowMs);
          const r = v.tapRing;
          r.base = (r.base || 0) + Math.max(0, nowMs - r.startMs) / 1000 * r.bytesPerSec;
          if (!r.loop) r.base = Math.min(r.base, r.bytes.length);
          r.startMs = nowMs;
          r.bytesPerSec = Math.max(1, frequency * v.channels * (v.bits / 8));
        }
        const retain = _outputLatencySec(ac) +
          (typeof ctx.deadlineLagMs === 'function' ? Math.max(0, ctx.deadlineLagMs() / 1000) : 0);
        if (v.mode === 'snapshot' && v.snapshotPlaying) {
          if (nowMs !== null && v.snapshotStartMs != null)
            _changeRateClock(v, 'snapshotGuest', v.snapshotStartMs, nowMs, rate, retain * 1000);
          if (ac) _changeRateClock(v, 'snapshotAudio', v.playStart, ac.currentTime, rate, retain);
        } else if (v.mode === 'stream' && !v.paused) {
          if (nowMs !== null && v.streamStartTimeMs != null)
            _changeRateClock(v, 'streamGuest', v.streamStartTimeMs, nowMs, rate, retain * 1000);
          if (ac && v.streamStartTime != null)
            _changeRateClock(v, 'streamAudio', v.streamStartTime, ac.currentTime, rate, retain);
        }
        v.freq = frequency;
        if (v.currentSrc) { try { v.currentSrc.playbackRate.value = v.freq / v.rate; } catch (_) {} }
        // A routed voice resamples in process(), so SetFrequency is one f32 in
        // the descriptor -- no node to rebuild, no restart.
        if (_worklet) _worklet.setFrequency(v, v.freq);
      },
    };
    if (ctx.sharedAudio) ctx.sharedAudio.voices = _voices;
  }
  if (!_voices._listener) _voices._listener = _listenerSpatialDefaults();
  _voices._installUnlock();

  // ---- MCI sequencer / MIDI bridge -------------------------------------
  // MCI handles are process-owned, not thread-owned. CD Player opens cdaudio
  // on its short-lived drive-probe thread and sends all later status/play
  // commands from the UI thread. Both HostImports instances therefore have
  // to resolve the same device table through sharedAudio.
  const _mciState = ctx.sharedAudio || ctx;
  const _mci = ctx._mci = _mciState.mci || (_mciState.mci = {
    nextId: 1,
    devices: new Map(),
  });
  if (!_mci.aliases) _mci.aliases = new Map();

  const _midiOut = ctx._midiOut = ctx._midiOut || {
    nextHandle: 0x0C0001,
    devices: new Map(),
    defaultVolume: 0xFFFFFFFF,
  };
  const _midiMasterGain = 1.0;
  const _tinySynthMasterGain = 0.35;
  const _midiSequencerNoteGain = 0.22;
  const _midiOutNoteGain = 0.30;

  // MIDI is synthesized directly into Web Audio and therefore never crosses
  // the waveOut/DirectSound PCM seams above. The direct CLI supplies an
  // offline renderer based on the bundled TinySynth timbre definitions; the
  // browser path remains untouched because it has no audioTap renderer.
  const _tapMidiSequence = (dev, firstStart) => {
    const tap = _audioTap();
    const notes = dev && dev.smf && dev.smf.notes;
    if (!tap || !notes || !notes.length) return;
    const guestNow = _audioClockMs();
    if (!Number.isFinite(guestNow)) return;
    if (typeof ctx.renderMidiForTap !== 'function') return;
    let rendered;
    try { rendered = ctx.renderMidiForTap(dev.smf, { firstStart }); }
    catch (_) { return; }
    if (!rendered || !rendered.bytes || !rendered.bytes.length) return;
    const pcm = rendered.bytes;
    const midi = _audioMixerState.mixerMutes[2] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[2] >>> 0);
    const master = _audioMixerState.mixerMutes[0] ? 0 : _mixerGain(_audioMixerState.mixerVolumes[0] >>> 0);
    const gain = midi * master;
    try {
      tap.pcm({
        guestStartMs: guestNow,
        sampleRate: rendered.sampleRate,
        channels: rendered.channels,
        bits: rendered.bits,
        gainL: gain,
        gainR: gain,
        bytes: pcm,
      });
    } catch (_) { /* recording must never break the guest */ }
  };

  const _tinySynthCtor = () => {
    if (ctx.midiBackend === 'oscillator') return null;
    if (ctx.WebAudioTinySynth) return ctx.WebAudioTinySynth;
    if (typeof WebAudioTinySynth !== 'undefined') return WebAudioTinySynth;
    if (typeof window !== 'undefined' && window.WebAudioTinySynth) return window.WebAudioTinySynth;
    if (typeof globalThis !== 'undefined' && globalThis.WebAudioTinySynth) return globalThis.WebAudioTinySynth;
    return null;
  };

  const _ensureTinySynth = (ac) => {
    const Ctor = _tinySynthCtor();
    if (!Ctor || !ac) return null;
    if (ctx._tinySynth && ctx._tinySynth.ac === ac) return ctx._tinySynth.synth;
    try {
      const synth = new Ctor({ quality: 1, useReverb: 1, voices: 64, internalcontext: 0, internalContext: 0 });
      if (synth.setAudioContext) synth.setAudioContext(ac, _getAudioBus(ac, 2));
      if (synth.setTsMode) synth.setTsMode(0);
      if (synth.setMasterVol) synth.setMasterVol(_tinySynthMasterGain);
      ctx._tinySynth = { ac, synth };
      console.log('[MIDI] using WebAudioTinySynth backend');
      return synth;
    } catch (e) {
      console.warn('[MIDI] WebAudioTinySynth init failed, falling back to oscillator synth:', e);
      ctx.midiBackend = 'oscillator';
      return null;
    }
  };

  const _writeStrA = (ptr, len, s) => {
    if (!ptr || !len) return;
    const mem = new Uint8Array(ctx.getMemory());
    const n = Math.max(0, Math.min(len - 1, String(s).length));
    for (let i = 0; i < n; i++) mem[ptr + i] = String(s).charCodeAt(i) & 0xFF;
    mem[ptr + n] = 0;
  };


  const _extractSmfBytes = (bytes) => {
    if (!bytes || bytes.length < 14) return null;
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const text4 = (p) => String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
    if (text4(0) === 'MThd') return u8;
    if (u8.length >= 24 && text4(0) === 'RIFF' && text4(8) === 'RMID') {
      const le32 = (p) => (u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24)) >>> 0;
      let p = 12;
      while (p + 8 <= u8.length) {
        const id = text4(p);
        const size = le32(p + 4);
        const dataStart = p + 8;
        const dataEnd = dataStart + size;
        if (dataEnd > u8.length) break;
        if (id === 'data') {
          const payload = u8.subarray(dataStart, dataEnd);
          return payload.length >= 14 && String.fromCharCode(payload[0], payload[1], payload[2], payload[3]) === 'MThd'
            ? payload
            : null;
        }
        p = dataEnd + (size & 1);
      }
    }
    return null;
  };

  const _parseSmf = (bytes) => {
    const u8 = _extractSmfBytes(bytes);
    if (!u8) return null;
    const text4 = (p) => String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
    const u16 = (p) => (u8[p] << 8) | u8[p + 1];
    const u32 = (p) => ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0;
    const varLen = (state, end) => {
      let v = 0, b = 0;
      do {
        if (state.p >= end) return v;
        b = u8[state.p++];
        v = (v << 7) | (b & 0x7F);
      } while (b & 0x80);
      return v >>> 0;
    };
    const hdrLen = u32(4);
    const tracks = u16(10);
    const division = u16(12);
    if (!division || (division & 0x8000)) return null;
    const trackEvents = [];
    const tempos = [{ tick: 0, usPerQn: 500000 }];
    let p = 8 + hdrLen;
    for (let tr = 0; tr < tracks && p + 8 <= u8.length; tr++) {
      if (text4(p) !== 'MTrk') break;
      const end = Math.min(u8.length, p + 8 + u32(p + 4));
      const state = { p: p + 8 };
      let tick = 0;
      let running = 0;
      while (state.p < end) {
        tick += varLen(state, end);
        let status = u8[state.p++];
        if (status < 0x80) {
          state.p--;
          status = running;
        } else if (status < 0xF0) {
          running = status;
        }
        if (status === 0xFF) {
          const type = u8[state.p++];
          const len = varLen(state, end);
          if (type === 0x51 && len === 3 && state.p + 3 <= end) {
            const usPerQn = (u8[state.p] << 16) | (u8[state.p + 1] << 8) | u8[state.p + 2];
            const prev = tempos[tempos.length - 1];
            if (prev && prev.tick === tick) prev.usPerQn = usPerQn;
            else tempos.push({ tick, usPerQn });
          }
          state.p += len;
          continue;
        }
        if (status === 0xF0 || status === 0xF7) {
          state.p += varLen(state, end);
          continue;
        }
        const op = status & 0xF0;
        const ch = status & 0x0F;
        const a = u8[state.p++] || 0;
        const hasB = op !== 0xC0 && op !== 0xD0;
        const b = hasB ? (u8[state.p++] || 0) : 0;
        const raw = hasB ? [status, a, b] : [status, a];
        if (op === 0x90 && b > 0) trackEvents.push({ tick, type: 'on', ch, note: a, vel: b, raw });
        else if (op === 0x80 || (op === 0x90 && b === 0)) trackEvents.push({ tick, type: 'off', ch, note: a, vel: b, raw });
        else if (op === 0xC0) trackEvents.push({ tick, type: 'program', ch, program: a, raw });
        else if (op === 0xB0) trackEvents.push({ tick, type: 'cc', ch, cc: a, value: b, raw });
        else if (op === 0xE0) trackEvents.push({ tick, type: 'pitch', ch, value: ((b << 7) | a) - 8192, raw });
        else if (op === 0xD0) trackEvents.push({ tick, type: 'pressure', ch, value: a, raw });
        else if (op === 0xA0) trackEvents.push({ tick, type: 'polyPressure', ch, note: a, value: b, raw });
      }
      p = end;
    }
    tempos.sort((a, b) => a.tick - b.tick);
    const tickToSec = (tick) => {
      let sec = 0, lastTick = 0, us = 500000;
      for (const t of tempos) {
        if (t.tick > tick) break;
        sec += (t.tick - lastTick) * us / division / 1000000;
        lastTick = t.tick;
        us = t.usPerQn || us;
      }
      return sec + (tick - lastTick) * us / division / 1000000;
    };
    const events = trackEvents
      .sort((a, b) => a.tick - b.tick)
      .map(ev => ({ ...ev, time: tickToSec(ev.tick) }));
    const open = new Map();
    const notes = [];
    const programs = new Array(16).fill(0);
    const pans = new Array(16).fill(64);
    const volumes = new Array(16).fill(100);
    const expressions = new Array(16).fill(127);
    for (const ev of events) {
      if (ev.type === 'program') {
        programs[ev.ch] = ev.program;
      } else if (ev.type === 'cc') {
        if (ev.cc === 7) volumes[ev.ch] = ev.value;
        else if (ev.cc === 10) pans[ev.ch] = ev.value;
        else if (ev.cc === 11) expressions[ev.ch] = ev.value;
      } else if (ev.type === 'on') {
        const key = ev.ch + ':' + ev.note;
        if (!open.has(key)) open.set(key, []);
        open.get(key).push({
          ...ev,
          program: programs[ev.ch],
          pan: pans[ev.ch],
          channelGain: Math.pow(volumes[ev.ch] / 100, 2) * Math.pow(expressions[ev.ch] / 127, 2),
        });
      } else if (ev.type === 'off') {
        const key = ev.ch + ':' + ev.note;
        const stack = open.get(key);
        const start = stack && stack.shift();
        if (start && ev.tick > start.tick) {
          notes.push({
            start: tickToSec(start.tick),
            dur: Math.max(0.03, tickToSec(ev.tick) - tickToSec(start.tick)),
            ch: start.ch,
            note: start.note,
            vel: start.vel,
            program: start.program,
            pan: start.pan,
            channelGain: start.channelGain,
          });
        }
      }
    }
    notes.sort((a, b) => a.start - b.start);
    const tempoEvents = tempos.map(t => ({ tick: t.tick, time: tickToSec(t.tick), usPerQn: t.usPerQn }));
    const eventDuration = events.reduce((m, ev) => Math.max(m, ev.time), 0);
    const noteDuration = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
    const duration = Math.max(eventDuration, noteDuration);
    return { events, notes, tempos: tempoEvents, division, duration };
  };

  const _parseWave = (bytes) => {
    if (!bytes) return null;
    const u8 = bytes instanceof Uint8Array
      ? bytes : new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength || undefined);
    if (u8.length < 44) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const fourcc = (off) => off + 4 <= u8.length
      ? String.fromCharCode(u8[off], u8[off + 1], u8[off + 2], u8[off + 3]) : '';
    if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WAVE') return null;
    let fmt = null;
    let dataOffset = 0;
    let dataLength = 0;
    for (let off = 12; off + 8 <= u8.length;) {
      const id = fourcc(off);
      const declared = dv.getUint32(off + 4, true);
      const start = off + 8;
      const size = Math.min(declared, Math.max(0, u8.length - start));
      if (id === 'fmt ' && size >= 16) {
        let tag = dv.getUint16(start, true);
        // WAVE_FORMAT_EXTENSIBLE stores the real tag at the start of its
        // SubFormat GUID. PCM and IEEE float retain their ordinary values.
        if (tag === 0xFFFE && size >= 40) tag = dv.getUint16(start + 24, true);
        fmt = {
          tag,
          channels: dv.getUint16(start + 2, true),
          rate: dv.getUint32(start + 4, true),
          byteRate: dv.getUint32(start + 8, true),
          blockAlign: dv.getUint16(start + 12, true),
          bits: dv.getUint16(start + 14, true),
        };
      } else if (id === 'data' && !dataOffset) {
        dataOffset = start;
        dataLength = size;
      }
      off = start + declared + (declared & 1);
      if (off > u8.length) break;
    }
    if (!fmt || !dataOffset || !dataLength || !fmt.channels || !fmt.rate) return null;
    if (fmt.tag !== 1 && fmt.tag !== 3) return null; // PCM or IEEE float
    const bytesPerSample = Math.ceil(fmt.bits / 8);
    const blockAlign = fmt.blockAlign || fmt.channels * bytesPerSample;
    if (!bytesPerSample || !blockAlign || (fmt.tag === 3 && fmt.bits !== 32 && fmt.bits !== 64)) return null;
    if (fmt.tag === 1 && ![8, 16, 24, 32].includes(fmt.bits)) return null;
    const frames = Math.floor(dataLength / blockAlign);
    if (!frames) return null;
    return {
      bytes: u8,
      tag: fmt.tag,
      channels: fmt.channels,
      rate: fmt.rate,
      bits: fmt.bits,
      blockAlign,
      dataOffset,
      dataLength: Math.min(dataLength, frames * blockAlign),
      frames,
      duration: frames / fmt.rate,
    };
  };

  const _decodeWave = (ac, wave) => {
    if (!ac || !wave || typeof ac.createBuffer !== 'function') return null;
    const out = ac.createBuffer(wave.channels, wave.frames, wave.rate);
    const dv = new DataView(wave.bytes.buffer, wave.bytes.byteOffset, wave.bytes.byteLength);
    const bytesPerSample = Math.ceil(wave.bits / 8);
    for (let ch = 0; ch < wave.channels; ch++) {
      const dst = out.getChannelData(ch);
      for (let frame = 0; frame < wave.frames; frame++) {
        const off = wave.dataOffset + frame * wave.blockAlign + ch * bytesPerSample;
        let sample = 0;
        if (wave.tag === 3) {
          sample = wave.bits === 32 ? dv.getFloat32(off, true) : dv.getFloat64(off, true);
        } else if (wave.bits === 8) {
          sample = (wave.bytes[off] - 128) / 128;
        } else if (wave.bits === 16) {
          sample = dv.getInt16(off, true) / 32768;
        } else if (wave.bits === 24) {
          let value = wave.bytes[off] | (wave.bytes[off + 1] << 8) | (wave.bytes[off + 2] << 16);
          if (value & 0x800000) value |= 0xFF000000;
          sample = value / 8388608;
        } else if (wave.bits === 32) {
          sample = dv.getInt32(off, true) / 2147483648;
        }
        dst[frame] = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
      }
    }
    return out;
  };

  // A Redump-style CD-DA BIN is the bytes the drive would return for each raw
  // audio sector: 588 interleaved signed-16 stereo frames, little-endian. Keep
  // the source in that compact form and expand only the slice MCI is playing.
  const _decodeCdAudio = (ac, bytes, firstSector, sectorCount) => {
    if (!ac || !bytes || typeof ac.createBuffer !== 'function' || sectorCount <= 0) return null;
    const sectorBytes = 2352;
    const framesPerSector = 588;
    const frames = sectorCount * framesPerSector;
    const start = firstSector * sectorBytes;
    const end = start + sectorCount * sectorBytes;
    if (start < 0 || end > bytes.byteLength) return null;
    const out = ac.createBuffer(2, frames, 44100);
    const left = out.getChannelData(0);
    const right = out.getChannelData(1);
    const dv = new DataView(bytes.buffer, bytes.byteOffset + start, end - start);
    for (let frame = 0, off = 0; frame < frames; frame++, off += 4) {
      left[frame] = dv.getInt16(off, true) / 32768;
      right[frame] = dv.getInt16(off + 2, true) / 32768;
    }
    return out;
  };

  const _cdFindDisc = (element) => {
    const drives = ctx.vfs && ctx.vfs.cdAudioDrives;
    if (!drives || !drives.size) return null;
    const match = /^([A-Za-z]):/.exec(String(element || ''));
    if (match) return drives.get(match[1].toLowerCase()) || null;
    return drives.values().next().value || null;
  };

  const _cdTrackAt = (disc, sector) => {
    if (!disc || !disc.tracks) return null;
    let found = disc.tracks[0] || null;
    for (const track of disc.tracks) {
      if (sector < track.discStartSector) break;
      found = track;
    }
    return found;
  };

  const _cdPackMsf = (sectors) => {
    const value = Math.max(0, Math.round(sectors || 0));
    const minute = Math.floor(value / (75 * 60));
    const second = Math.floor(value / 75) % 60;
    const frame = value % 75;
    return (minute & 0xFF) | ((second & 0xFF) << 8) | ((frame & 0xFF) << 16);
  };

  const _cdPackTmsf = (track, sectors) => {
    const msf = _cdPackMsf(sectors);
    return (track & 0xFF) | ((msf & 0xFF) << 8) |
      ((msf & 0xFF00) << 8) | ((msf & 0xFF0000) << 8);
  };

  const _cdUnpackMsf = (value) =>
    (((value & 0xFF) * 60 + ((value >>> 8) & 0xFF)) * 75 + ((value >>> 16) & 0xFF));

  const _cdValueToSector = (dev, value) => {
    const raw = value >>> 0;
    if (!dev || !dev.disc) return 0;
    if (dev.timeFormat === 10) { // MCI_FORMAT_TMSF
      const track = dev.disc.track(raw & 0xFF);
      const offset = _cdUnpackMsf(raw >>> 8);
      return track ? track.discStartSector + offset : dev.disc.leadOutSector;
    }
    if (dev.timeFormat === 2) return _cdUnpackMsf(raw); // MCI_FORMAT_MSF
    if (dev.timeFormat === 3) return raw; // MCI_FORMAT_FRAMES
    return Math.round(raw * 75 / 1000); // MCI_FORMAT_MILLISECONDS/default
  };

  const _cdSectorToValue = (dev, sector, duration = false) => {
    const clamped = Math.max(0, Math.round(sector || 0));
    if (!dev) return 0;
    if (dev.timeFormat === 10) { // MCI_FORMAT_TMSF
      if (duration) return _cdPackTmsf(0, clamped);
      const track = _cdTrackAt(dev.disc, clamped);
      return track ? _cdPackTmsf(track.number, Math.max(0, clamped - track.discStartSector)) : 0;
    }
    if (dev.timeFormat === 2) return _cdPackMsf(clamped);
    if (dev.timeFormat === 3) return clamped >>> 0;
    return Math.round(clamped * 1000 / 75) >>> 0;
  };

  const _cdStopSources = (dev) => {
    if (!dev || !dev.cdSources) return;
    for (const source of dev.cdSources) {
      try { source.onended = null; } catch (_) {}
      try { source.stop(0); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    dev.cdSources = [];
  };

  const _cdNotify = (dev, status) => {
    if (!dev || !dev.notifyPending || !dev.notifyHwnd) return;
    dev.notifyPending = false;
    const host = getHost && getHost();
    if (host && typeof host.post_window_message === 'function') {
      // MM_MCINOTIFY(hwnd, MCI_NOTIFY_*, deviceId)
      host.post_window_message(dev.notifyHwnd >>> 0, 0x03B9, status >>> 0, dev.id >>> 0);
    }
  };

  // The host's idle watcher normally suspends an AudioContext after ten
  // seconds without waveOut submissions. MCI CD-DA schedules long-lived
  // AudioBufferSourceNodes instead, so it must publish its own lease or Safari
  // goes silent mid-track until the next pointer gesture resumes the context.
  // Recompute across devices when one stops so a second playing drive keeps
  // the shared process context awake.
  const _publishCdAudioHot = () => {
    let hotUntil = 0;
    for (const item of _mci.devices.values()) {
      if (item && item.type === 'cdaudio' && item.state === 'playing') {
        hotUntil = Math.max(hotUntil, Number(item.cdHotUntilMs) || 0);
      }
    }
    _audioDoneState.cdAudioHotUntilMs = hotUntil;
    if (hotUntil > _audioWallMs() && typeof ctx.wakeAudio === 'function') ctx.wakeAudio();
  };

  const _cdFinish = (dev) => {
    if (!dev || dev.state === 'stopped') return;
    _cdStopSources(dev);
    if (dev.cdTimer) { clearTimeout(dev.cdTimer); dev.cdTimer = null; }
    dev.cdPositionSector = dev.cdEndSector;
    dev.state = 'stopped';
    dev.cdHotUntilMs = 0;
    _publishCdAudioHot();
    _cdNotify(dev, 1); // MCI_NOTIFY_SUCCESSFUL
  };

  const _cdRefresh = (dev) => {
    if (!dev) return 0;
    if (dev.state === 'playing') {
      const elapsed = Math.max(0, _mciNowMs() - (dev.playStartMs || 0));
      dev.cdPositionSector = Math.min(dev.cdEndSector,
        dev.cdStartSector + Math.floor(elapsed * 75 / 1000));
      if (dev.cdPositionSector >= dev.cdEndSector) _cdFinish(dev);
    }
    return Math.max(0, dev.cdPositionSector || 0);
  };

  const _cdSchedule = (dev, startSector, endSector) => {
    if (!dev || !dev.disc) return 0x106;
    const audio = dev.disc.audioTracks || [];
    const firstAudio = audio[0];
    const lastAudio = audio[audio.length - 1];
    if (!firstAudio || !lastAudio) return 0x113; // MCIERR_OUTOFRANGE
    let start = Number.isFinite(startSector) ? Math.round(startSector) :
      (dev.cdPositionSector || firstAudio.discStartSector);
    let end = Number.isFinite(endSector) ? Math.round(endSector) : lastAudio.discEndSector;
    start = Math.max(firstAudio.discStartSector, Math.min(lastAudio.discEndSector, start));
    end = Math.max(start, Math.min(lastAudio.discEndSector, end));
    // A FROM value can name the data track; real CD drivers advance to the
    // next audio track rather than trying to send MODE1 sectors to the DAC.
    const startTrack = _cdTrackAt(dev.disc, start);
    if (startTrack && !startTrack.isAudio) start = firstAudio.discStartSector;
    if (end <= start) return 0x113;

    dev.cdGeneration = (dev.cdGeneration || 0) + 1;
    const generation = dev.cdGeneration;
    _cdStopSources(dev);
    if (dev.cdTimer) clearTimeout(dev.cdTimer);
    dev.cdStartSector = start;
    dev.cdEndSector = end;
    dev.cdPositionSector = start;
    dev.playStartMs = _mciNowMs();
    dev.state = 'playing';
    const runMs = Math.max(1, Math.round((end - start) * 1000 / 75));
    dev.cdHotUntilMs = _audioWallMs() + runMs + 1000;
    _publishCdAudioHot();
    dev.cdTimer = setTimeout(() => {
      if (dev.cdGeneration === generation) _cdFinish(dev);
    }, runMs + 100);

    const pieces = audio.map(track => ({
      track,
      start: Math.max(start, track.discStartSector),
      end: Math.min(end, track.discEndSector),
    })).filter(piece => piece.end > piece.start);
    Promise.all(pieces.map(piece => piece.track.load())).then(loaded => {
      if (dev.cdGeneration !== generation || dev.state !== 'playing') return;
      const ac = _voices._ensureCtx(44100);
      if (!ac) return;
      if (ac.state === 'suspended') {
        try { ac.resume(); } catch (_) {}
      }
      let when = ac.currentTime;
      dev.cdSources = [];
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const track = piece.track;
        const fileSector = track.index1Sector + (piece.start - track.discStartSector);
        const count = piece.end - piece.start;
        const buffer = _decodeCdAudio(ac, loaded[i], fileSector, count);
        if (!buffer) continue;
        const source = ac.createBufferSource();
        source.buffer = buffer;
        source.connect(_getAudioBus(ac, 1));
        source.start(when);
        when += buffer.duration;
        dev.cdSources.push(source);
      }
      const last = dev.cdSources[dev.cdSources.length - 1];
      if (last) last.onended = () => {
        if (dev.cdGeneration === generation && dev.state === 'playing') _cdFinish(dev);
      };
      _markAudioMixerPeak(1, 1, runMs);
    }).catch(error => {
      if (dev.cdGeneration !== generation) return;
      console.warn(`[MCI] cdaudio track load failed: ${error.message}`);
      _cdFinish(dev);
    });
    return 0;
  };

  const _cdStop = (dev, resetPosition = false) => {
    if (!dev) return;
    _cdRefresh(dev);
    dev.cdGeneration = (dev.cdGeneration || 0) + 1;
    _cdStopSources(dev);
    if (dev.cdTimer) { clearTimeout(dev.cdTimer); dev.cdTimer = null; }
    dev.state = 'stopped';
    dev.cdHotUntilMs = 0;
    _publishCdAudioHot();
    if (resetPosition && dev.disc && dev.disc.audioTracks.length) {
      dev.cdPositionSector = dev.disc.audioTracks[0].discStartSector;
    }
  };

  const _cdPause = (dev) => {
    if (!dev || dev.state !== 'playing') return 0;
    _cdRefresh(dev);
    dev.cdGeneration = (dev.cdGeneration || 0) + 1;
    _cdStopSources(dev);
    if (dev.cdTimer) { clearTimeout(dev.cdTimer); dev.cdTimer = null; }
    dev.state = 'paused';
    dev.cdHotUntilMs = 0;
    _publishCdAudioHot();
    return 0;
  };

  const _mciNowMs = () => {
    if (typeof ctx.mciClockMs === 'function') {
      try {
        const v = ctx.mciClockMs();
        if (Number.isFinite(v)) return v;
      } catch (_) {}
    }
    const ac = (ctx._voices && ctx._voices._ac) || ctx._audioCtx;
    if (ac && Number.isFinite(ac.currentTime)) return ac.currentTime * 1000;
    const audioMs = _audioClockMs();
    if (Number.isFinite(audioMs)) return audioMs;
    return _audioWallMs();
  };

  const _mciLengthMs = (dev) => {
    if (dev && dev.type === 'cdaudio' && dev.disc) {
      return Math.max(0, Math.round(dev.disc.leadOutSector * 1000 / 75));
    }
    const duration = dev && dev.smf && Number.isFinite(dev.smf.duration) ? dev.smf.duration :
      dev && dev.wave && Number.isFinite(dev.wave.duration) ? dev.wave.duration : 0;
    return Math.max(0, Math.round(duration * 1000));
  };

  const _mciStartPlaybackClock = (dev, firstStart = 0) => {
    const now = _mciNowMs();
    const lengthMs = _mciLengthMs(dev);
    const startPositionMs = Math.min(lengthMs, Math.max(0, Math.round(firstStart * 1000)));
    const runMs = Math.max(0, lengthMs - startPositionMs);
    dev.playStartMs = now;
    dev.playStartPositionMs = startPositionMs;
    dev.playLengthMs = lengthMs;
    dev.playRunMs = runMs;
    dev.playEndMs = now + runMs + 100;
    dev.playPositionMs = startPositionMs;
  };

  const _mciMarkPlaybackDone = (dev) => {
    if (!dev) return;
    if (dev.type === 'cdaudio') {
      _cdFinish(dev);
      return;
    }
    if (dev.scheduler) { clearInterval(dev.scheduler); dev.scheduler = null; }
    if (dev.timer) { clearTimeout(dev.timer); dev.timer = null; }
    if (dev.waveSource) {
      const src = dev.waveSource;
      dev.waveSource = null;
      try { src.onended = null; } catch (_) {}
      try { src.stop(0); } catch (_) {}
      try { src.disconnect(); } catch (_) {}
    }
    dev.playPositionMs = Math.max(dev.playPositionMs || 0, dev.playLengthMs || _mciLengthMs(dev));
    dev.state = 'stopped';
  };

  const _mciRefreshPlaybackState = (dev) => {
    if (!dev) return 0;
    if (dev.type === 'cdaudio') {
      return Math.round(_cdRefresh(dev) * 1000 / 75);
    }
    if (dev.state === 'playing') {
      const now = _mciNowMs();
      const start = Number.isFinite(dev.playStartMs) ? dev.playStartMs : now;
      const startPosition = Number.isFinite(dev.playStartPositionMs) ? dev.playStartPositionMs : 0;
      const lengthMs = Number.isFinite(dev.playLengthMs) ? dev.playLengthMs : _mciLengthMs(dev);
      const elapsed = Math.max(0, Math.round(now - start));
      dev.playPositionMs = lengthMs > 0 ? Math.min(lengthMs, startPosition + elapsed) : startPosition + elapsed;
      const end = Number.isFinite(dev.playEndMs) ? dev.playEndMs : start + lengthMs;
      if (now >= end) _mciMarkPlaybackDone(dev);
    }
    return Math.max(0, Math.round(dev.playPositionMs || 0));
  };

  const _midiSchedule = (dev) => {
    if (!dev || !dev.smf || !dev.smf.notes.length) {
      // A play that arrives while the file is still being fetched is not a
      // no-op: remember it so the bytes start playing when they land.
      if (dev && !dev.smf && dev.lateFetch) dev.playPending = true;
      _midiStop(dev);
      return 0;
    }
    const firstStart = ctx.trimMidiLeadIn && dev.smf.notes.length ? dev.smf.notes[0].start : 0;
    // The frozen CLI has no AudioContext, but its recorder still needs the
    // sequencer rendition.  Tap before the browser-only context guard.
    _tapMidiSequence(dev, firstStart);
    const ac = ctx._voices._ensureCtx(44100);
    if (!ac) {
      _midiStop(dev);
      return 0;
    }
    if (ac.state === 'suspended') {
      try { ac.resume(); } catch (_) {}
    }
    const tiny = _ensureTinySynth(ac);
    if (tiny && dev.smf.events && dev.smf.events.length) {
      _midiStop(dev);
      dev.state = 'playing';
      dev.nodes = [];
      dev.tinySynth = tiny;
      dev.midiCursor = 0;
      _mciStartPlaybackClock(dev, firstStart);
      dev.midiBaseTime = ac.currentTime + 0.08 - firstStart;
      const pumpTiny = () => {
        if (!dev || dev.state !== 'playing') return;
        const events = dev.smf.events;
        const until = ac.currentTime + 0.85;
        let scheduled = 0;
        while (dev.midiCursor < events.length &&
               dev.midiBaseTime + events[dev.midiCursor].time <= until &&
               scheduled < 1024) {
          const ev = events[dev.midiCursor++];
          try { tiny.send(ev.raw, dev.midiBaseTime + ev.time); } catch (_) {}
          scheduled++;
        }
        if (dev.midiCursor >= events.length && dev.scheduler) {
          clearInterval(dev.scheduler);
          dev.scheduler = null;
        }
      };
      pumpTiny();
      dev.scheduler = setInterval(pumpTiny, 100);
      if (dev.timer) clearTimeout(dev.timer);
      dev.timer = setTimeout(() => {
        _mciMarkPlaybackDone(dev);
      }, Math.max(1, (dev.playRunMs || 0) + 100));
      return 0;
    }
    _midiStop(dev);
    dev.state = 'playing';
    dev.nodes = [];
    dev.midiCursor = 0;
    _mciStartPlaybackClock(dev, firstStart);
    const master = ac.createGain();
    dev.master = master;
    master.gain.value = _midiMasterGain;
    master.connect(_getAudioBus(ac, 2));
    dev.nodes.push(master);
    dev.midiBaseTime = ac.currentTime + 0.08 - firstStart;
    const scheduleOne = (n) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const freq = 440 * Math.pow(2, (n.note - 69) / 12);
      const start = dev.midiBaseTime + n.start;
      const end = start + Math.min(n.dur, 8);
      osc.type = n.ch === 9 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.002, (n.vel / 127) * _midiSequencerNoteGain), start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(master);
      try {
        osc.start(start);
        osc.stop(end + 0.03);
        osc.onended = () => {
          try { osc.disconnect(); } catch (_) {}
          try { gain.disconnect(); } catch (_) {}
        };
        dev.nodes.push(osc);
      } catch (_) {}
    };
    const pump = () => {
      if (!dev || dev.state !== 'playing') return;
      const notes = dev.smf.notes;
      const until = ac.currentTime + 0.85;
      let scheduled = 0;
      while (dev.midiCursor < notes.length &&
             dev.midiBaseTime + notes[dev.midiCursor].start <= until &&
             scheduled < 512) {
        scheduleOne(notes[dev.midiCursor++]);
        scheduled++;
      }
      if (dev.midiCursor >= notes.length && dev.scheduler) {
        clearInterval(dev.scheduler);
        dev.scheduler = null;
      }
    };
    pump();
    dev.scheduler = setInterval(pump, 100);
    if (dev.timer) clearTimeout(dev.timer);
    dev.timer = setTimeout(() => {
      _mciMarkPlaybackDone(dev);
    }, Math.max(1, (dev.playRunMs || 0) + 100));
    return 0;
  };

  function _midiStop(dev) {
    if (!dev) return;
    if (dev.scheduler) { clearInterval(dev.scheduler); dev.scheduler = null; }
    if (dev.timer) { clearTimeout(dev.timer); dev.timer = null; }
    if (dev.tinySynth) {
      for (let ch = 0; ch < 16; ch++) {
        try {
          if (dev.tinySynth.allSoundOff) dev.tinySynth.allSoundOff(ch);
          else dev.tinySynth.send([0xB0 | ch, 120, 0], 0);
        } catch (_) {}
      }
      dev.tinySynth = null;
    }
    if (dev.master && dev.master.gain) dev.master.gain.value = 0;
    if (dev.nodes) {
      for (const n of dev.nodes) {
        try { if (n.stop) n.stop(0); } catch (_) {}
        try { if (n.disconnect) n.disconnect(); } catch (_) {}
      }
    }
    dev.nodes = [];
    dev.state = 'stopped';
    dev.playStartMs = 0;
    dev.playStartPositionMs = 0;
    dev.playEndMs = 0;
    dev.playRunMs = 0;
    dev.playPositionMs = 0;
  }

  const _waveStopSource = (dev) => {
    if (!dev) return;
    if (dev.timer) { clearTimeout(dev.timer); dev.timer = null; }
    const src = dev.waveSource;
    dev.waveSource = null;
    if (src) {
      try { src.onended = null; } catch (_) {}
      try { src.stop(0); } catch (_) {}
      try { src.disconnect(); } catch (_) {}
    }
  };

  const _waveStop = (dev, resetPosition = true) => {
    if (!dev) return;
    _waveStopSource(dev);
    dev.state = 'stopped';
    if (resetPosition) dev.playPositionMs = 0;
    dev.playStartMs = 0;
    dev.playStartPositionMs = dev.playPositionMs || 0;
    dev.playEndMs = 0;
    dev.playRunMs = 0;
  };

  const _wavePause = (dev) => {
    if (!dev || dev.state !== 'playing') return 0;
    const position = _mciRefreshPlaybackState(dev);
    if (dev.state !== 'playing') return 0;
    _waveStopSource(dev);
    dev.playPositionMs = position;
    dev.playStartPositionMs = position;
    dev.playStartMs = 0;
    dev.playEndMs = 0;
    dev.playRunMs = 0;
    dev.state = 'paused';
    return 0;
  };

  const _waveSchedule = (dev, requestedPositionMs) => {
    if (!dev || !dev.wave) return 0;
    const lengthMs = _mciLengthMs(dev);
    let positionMs = Number.isFinite(requestedPositionMs)
      ? requestedPositionMs : (dev.state === 'paused' ? dev.playPositionMs : 0);
    positionMs = Math.max(0, Math.min(lengthMs, Math.round(positionMs || 0)));
    if (positionMs >= lengthMs) positionMs = 0;
    _waveStopSource(dev);
    const ac = _voices._ensureCtx(dev.wave.rate);
    if (ac && ac.state === 'suspended') {
      try { ac.resume(); } catch (_) {}
    }
    if (ac) {
      try {
        if (!dev.waveBuffer || dev.waveBufferContext !== ac) {
          dev.waveBuffer = _decodeWave(ac, dev.wave);
          dev.waveBufferContext = ac;
        }
        if (dev.waveBuffer) {
          const src = ac.createBufferSource();
          src.buffer = dev.waveBuffer;
          src.connect(_getAudioBus(ac, 1));
          src.onended = () => {
            if (dev.waveSource !== src || dev.state !== 'playing') return;
            dev.waveSource = null;
            _mciMarkPlaybackDone(dev);
          };
          src.start(ac.currentTime, positionMs / 1000);
          dev.waveSource = src;
        }
      } catch (_) {
        dev.waveSource = null;
      }
    }
    const pcm = dev.wave.bytes;
    _markPcmPeak(1, pcm, dev.wave.dataOffset, dev.wave.dataLength, dev.wave.channels, dev.wave.bits,
      Math.max(1, lengthMs - positionMs));
    _mciStartPlaybackClock(dev, positionMs / 1000);
    dev.state = 'playing';
    if (dev.timer) clearTimeout(dev.timer);
    dev.timer = setTimeout(() => _mciMarkPlaybackDone(dev), Math.max(1, dev.playRunMs + 100));
    return 0;
  };

  const _midiOutGainValue = (volume) => {
    const left = volume & 0xFFFF;
    const right = (volume >>> 16) & 0xFFFF;
    return Math.max(0, Math.min(1, ((left + right) / 2) / 0xFFFF));
  };

  const _midiOutEnsureMaster = (dev, ac) => {
    if (dev.master && !dev.master.disconnected) return dev.master;
    const master = ac.createGain();
    master.gain.value = _midiMasterGain * _midiOutGainValue(dev.volume);
    master.connect(_getAudioBus(ac, 2));
    dev.master = master;
    return master;
  };

  const _midiOutStopNote = (dev, key) => {
    const voice = dev && dev.active && dev.active.get(key);
    if (!voice) return;
    dev.active.delete(key);
    const ac = ctx._voices && ctx._voices._ac;
    const now = ac ? ac.currentTime : 0;
    try { voice.gain.gain.cancelScheduledValues && voice.gain.gain.cancelScheduledValues(now); } catch (_) {}
    try { voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value || 0.0001), now); } catch (_) {}
    try { voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04); } catch (_) {}
    try { voice.osc.stop(now + 0.06); } catch (_) {}
  };

  const _midiOutResetDevice = (dev) => {
    if (!dev) return 5; // MMSYSERR_INVALHANDLE
    if (dev.tinySynth) {
      for (let ch = 0; ch < 16; ch++) {
        try {
          if (dev.tinySynth.allSoundOff) dev.tinySynth.allSoundOff(ch);
          else dev.tinySynth.send([0xB0 | ch, 120, 0], 0);
        } catch (_) {}
      }
      dev.tinySynth = null;
    }
    for (const key of Array.from(dev.active.keys())) _midiOutStopNote(dev, key);
    if (dev.master) {
      try { dev.master.disconnect(); } catch (_) {}
      dev.master = null;
    }
    return 0;
  };

  const _midiOutNoteOn = (dev, ch, note, vel) => {
    if (!dev || !vel) return 5;
    const ac = ctx._voices._ensureCtx(44100);
    if (!ac) return 0;
    if (ac.state === 'suspended') {
      try { ac.resume(); } catch (_) {}
    }
    const key = ch + ':' + note;
    _midiOutStopNote(dev, key);
    const master = _midiOutEnsureMaster(dev, ac);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    const now = ac.currentTime;
    osc.type = ch === 9 ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, (vel / 127) * _midiOutNoteGain), now + 0.01);
    osc.connect(gain);
    gain.connect(master);
    try {
      osc.start(now);
      dev.active.set(key, { osc, gain });
    } catch (_) {}
    return 0;
  };

  const _midiOutTinySend = (dev, raw) => {
    const ac = ctx._voices._ensureCtx(44100);
    const tiny = _ensureTinySynth(ac);
    if (!tiny) return false;
    if (ac && ac.state === 'suspended') {
      try { ac.resume(); } catch (_) {}
    }
    try {
      tiny.send(raw, ac ? ac.currentTime : 0);
      dev.tinySynth = tiny;
      return true;
    } catch (_) {
      return false;
    }
  };

  const _mciTokenize = (s) => {
    const out = [];
    String(s || '').replace(/"([^"]*)"|(\S+)/g, (_, q, bare) => {
      out.push(q != null ? q : bare);
      return '';
    });
    return out;
  };

  // A sequencer opened on a file the launch never mounted. Real MCI is free
  // to still be preparing a device when `open` returns, which is what makes
  // this legal: fetch the bytes off the main thread, attach them when they
  // arrive, and honour a `play` that came in while we were waiting. Without
  // an async reader (the CLI, whose VFS is a real directory) a miss is final
  // and this does nothing.
  const _mciFetchLate = (dev) => {
    const ready = dev && (dev.type === 'sequencer' ? dev.smf : dev.type === 'waveaudio' ? dev.wave : true);
    if (!dev || ready || !dev.element || !_readVfsFileAsync || !ctx.readFileAsync) return;
    dev.lateFetch = true;
    _readVfsFileAsync(dev.element).then(bytes => {
      dev.lateFetch = false;
      if (!bytes || !_mci.devices.has(dev.id)) return;
      if (dev.type === 'sequencer') {
        if (dev.smf) return;
        dev.smf = _parseSmf(bytes);
        console.log(`[MCI] late-attach id=${dev.id} element="${dev.element}" notes=${dev.smf ? dev.smf.notes.length : 0}`);
      } else if (dev.type === 'waveaudio') {
        if (dev.wave) return;
        dev.wave = _parseWave(bytes);
        console.log(`[MCI] late-attach waveaudio id=${dev.id} element="${dev.element}" frames=${dev.wave ? dev.wave.frames : 0}`);
      }
      if (dev.playPending) {
        dev.playPending = false;
        if (dev.type === 'waveaudio') _waveSchedule(dev, 0);
        else _midiSchedule(dev);
      }
    });
  };

  const _mciCommand = (hostId, command, flags, paramsWa) => {
    const dev = _mci.devices.get(hostId >>> 0);
    if (!dev) return 0x106; // MCIERR_INVALID_DEVICE_ID
    switch (command >>> 0) {
      case 0x080B: { // MCI_GETDEVCAPS
        if (paramsWa) {
          const dv = new DataView(ctx.getMemory());
          const item = dv.getUint32(paramsWa + 8, true);
          let value = 0;
          if (item === 2) value = 1; // MCI_GETDEVCAPS_HAS_AUDIO
          else if (item === 4) value = dev.type === 'cdaudio' ? 0x204 :
            dev.type === 'sequencer' ? 0x20B : 0x20A;
          else if (item === 5) value = dev.type === 'cdaudio' ? 0 : 1; // MCI_GETDEVCAPS_USES_FILES
          else if (item === 6) value = dev.type === 'cdaudio' ? 0 : 1; // MCI_GETDEVCAPS_COMPOUND_DEVICE
          else if (item === 8) value = 1; // MCI_GETDEVCAPS_CAN_PLAY
          dv.setUint32(paramsWa + 4, value >>> 0, true);
        }
        return 0;
      }
      case 0x0804: // MCI_CLOSE
        if (dev.type === 'cdaudio') _cdStop(dev);
        else if (dev.type === 'waveaudio') _waveStop(dev);
        else _midiStop(dev);
        _mci.devices.delete(hostId >>> 0);
        for (const [alias, aliasId] of Array.from(_mci.aliases.entries())) {
          if (aliasId === (hostId >>> 0)) _mci.aliases.delete(alias);
        }
        return 0;
      case 0x0806: // MCI_PLAY
        if (dev.type === 'cdaudio') {
          const dv = paramsWa ? new DataView(ctx.getMemory()) : null;
          const from = dv && (flags & 0x00000004)
            ? _cdValueToSector(dev, dv.getUint32(paramsWa + 4, true)) : dev.cdPositionSector;
          const to = dv && (flags & 0x00000008)
            ? _cdValueToSector(dev, dv.getUint32(paramsWa + 8, true)) : undefined;
          dev.notifyHwnd = dv ? dv.getUint32(paramsWa, true) : 0;
          dev.notifyPending = !!(flags & 0x00000001);
          console.log(`[MCI] play cdaudio id=${hostId >>> 0} sectors=${from}-${to == null ? 'end' : to}`);
          return _cdSchedule(dev, from, to);
        }
        if (dev.type === 'sequencer') {
          console.log(`[MCI] play sequencer id=${hostId >>> 0} element="${dev.element || ''}" notes=${dev.smf ? dev.smf.notes.length : 0}`);
          return _midiSchedule(dev);
        }
        if (dev.type === 'waveaudio') {
          console.log(`[MCI] play waveaudio id=${hostId >>> 0} element="${dev.element || ''}" frames=${dev.wave ? dev.wave.frames : 0} duration=${_mciLengthMs(dev)}ms`);
          if (!dev.wave && dev.lateFetch) dev.playPending = true;
          return _waveSchedule(dev);
        }
        return 0;
      case 0x0808: // MCI_STOP
        dev.playPending = false;
        if (dev.type === 'cdaudio') {
          _cdStop(dev);
          dev.notifyPending = false;
        } else if (dev.type === 'waveaudio') _waveStop(dev);
        else _midiStop(dev);
        return 0;
      case 0x0809: // MCI_PAUSE
        dev.playPending = false;
        if (dev.type === 'cdaudio') return _cdPause(dev);
        if (dev.type === 'waveaudio') return _wavePause(dev);
        _midiStop(dev);
        return 0;
      case 0x0855: // MCI_RESUME
        if (dev.type === 'cdaudio') return _cdSchedule(dev, dev.cdPositionSector, dev.cdEndSector);
        if (dev.type === 'waveaudio') return _waveSchedule(dev, dev.playPositionMs);
        return _midiSchedule(dev);
      case 0x080D: { // MCI_SET
        if (dev.type === 'cdaudio' && paramsWa && (flags & 0x00000400)) {
          const format = new DataView(ctx.getMemory()).getUint32(paramsWa + 4, true);
          if (![0, 2, 3, 10].includes(format)) return 0x11C; // MCIERR_BAD_TIME_FORMAT
          dev.timeFormat = format;
        }
        return 0;
      }
      case 0x0814: { // MCI_STATUS
        if (paramsWa) {
          const dv = new DataView(ctx.getMemory());
          const item = dv.getUint32(paramsWa + 8, true);
          let ret = 0;
          if (dev.type === 'cdaudio') {
            const trackNumber = dv.getUint32(paramsWa + 12, true);
            const track = dev.disc && dev.disc.track(trackNumber);
            _cdRefresh(dev);
            if (item === 1) { // MCI_STATUS_LENGTH
              const sectors = (flags & 0x10) && track ? track.playableSectors : dev.disc.leadOutSector;
              ret = _cdSectorToValue(dev, sectors, true);
            } else if (item === 2) { // MCI_STATUS_POSITION
              const sector = (flags & 0x10) && track ? track.discStartSector : dev.cdPositionSector;
              ret = _cdSectorToValue(dev, sector);
            } else if (item === 3) ret = dev.disc.tracks.length; // MCI_STATUS_NUMBER_OF_TRACKS
            else if (item === 4) ret = dev.state === 'playing' ? 526 : dev.state === 'paused' ? 529 : 525;
            else if (item === 5 || item === 7) ret = 1; // MEDIA_PRESENT / READY
            else if (item === 6) ret = dev.timeFormat; // MCI_STATUS_TIME_FORMAT
            else if (item === 8) { // MCI_STATUS_CURRENT_TRACK
              const current = _cdTrackAt(dev.disc, dev.cdPositionSector);
              ret = current ? current.number : dev.disc.firstTrack;
            } else if (item === 0x4001) { // MCI_CDA_STATUS_TYPE_TRACK
              ret = track && track.isAudio ? 0x440 : 0x441; // MCI_CDA_TRACK_AUDIO / OTHER
            }
          } else {
            _mciRefreshPlaybackState(dev);
            if (item === 4) ret = dev.state === 'playing' ? 526 : dev.state === 'paused' ? 529 : 525; // MCI_STATUS_MODE
            else if (item === 1) ret = _mciLengthMs(dev);
            else if (item === 2) ret = _mciRefreshPlaybackState(dev);
            else if (item === 3) ret = 1;
          }
          dv.setUint32(paramsWa + 4, ret >>> 0, true);
        }
        return 0;
      }
      default:
        return 0;
    }
  };

  const _mciStringCommand = (cmdWa, retWa, retLen) => {
    const cmd = cmdWa ? readStr(cmdWa, 512).trim() : '';
    if (!cmd) return 0;
    const tokens = _mciTokenize(cmd);
    const verb = (tokens[0] || '').toLowerCase();
    const lower = tokens.map(t => String(t).toLowerCase());
    const tokenAfter = (name) => {
      const i = lower.indexOf(name);
      return i >= 0 && i + 1 < tokens.length ? tokens[i + 1] : '';
    };
    if (verb === 'open') {
      let element = '';
      let type = tokenAfter('type');
      const alias = tokenAfter('alias');
      if (!type && lower[1] === 'sequencer') type = 'sequencer';
      if (!type && lower[1] === 'waveaudio') type = 'waveaudio';
      if (!type && lower[1] === 'cdaudio') type = 'cdaudio';
      if (tokens[1] && lower[1] !== 'type' && lower[1] !== 'alias' &&
          lower[1] !== 'sequencer' && lower[1] !== 'waveaudio' && lower[1] !== 'cdaudio') element = tokens[1];
      if (!type && /\.m(id|idi|rmi)$/i.test(element)) type = 'sequencer';
      if (!type && /\.wav$/i.test(element)) type = 'waveaudio';
      const data = _readVfsFile(element);
      const isSeq = type === 'sequencer' || /\.m(id|idi|rmi)$/i.test(element);
      const isWave = type === 'waveaudio' || type === 'waveformaudio' || type === '522' || /\.wav$/i.test(element);
      const isCd = type === 'cdaudio' || type === '516';
      const disc = isCd ? _cdFindDisc(element) : null;
      if (isCd && !disc) return 0x115; // MCIERR_DEVICE_NOT_READY
      const firstAudio = disc && disc.audioTracks && disc.audioTracks[0];
      const id = _mci.nextId++;
      const dev = {
        id,
        type: isCd ? 'cdaudio' : isSeq ? 'sequencer' : isWave ? 'waveaudio' : (type || 'auto'),
        element,
        disc,
        timeFormat: isCd ? 2 : 0,
        cdPositionSector: firstAudio ? firstAudio.discStartSector : 0,
        cdStartSector: firstAudio ? firstAudio.discStartSector : 0,
        cdEndSector: disc ? disc.leadOutSector : 0,
        cdSources: [],
        smf: isSeq && data ? _parseSmf(data) : null,
        wave: isWave && data ? _parseWave(data) : null,
        state: 'stopped',
        nodes: [],
        timer: null,
        playStartMs: 0,
        playStartPositionMs: 0,
        playEndMs: 0,
        playLengthMs: 0,
        playRunMs: 0,
        playPositionMs: 0,
      };
      _mci.devices.set(id, dev);
      _mci.aliases.set(alias || String(id), id);
      if (isCd && !_mci.aliases.has('cdaudio')) _mci.aliases.set('cdaudio', id);
      if ((isSeq && !dev.smf) || (isWave && !dev.wave)) _mciFetchLate(dev);
      if (dev.type === 'sequencer') {
        console.log(`[MCI] open sequencer id=${id} element="${element || ''}" alias="${alias || ''}" notes=${dev.smf ? dev.smf.notes.length : 0}`);
      } else if (dev.type === 'waveaudio') {
        console.log(`[MCI] open waveaudio id=${id} element="${element || ''}" alias="${alias || ''}" frames=${dev.wave ? dev.wave.frames : 0}`);
      } else if (dev.type === 'cdaudio') {
        console.log(`[MCI] open cdaudio id=${id} drive=${disc.drive}: tracks=${disc.firstTrack}-${disc.lastTrack}`);
      }
      return 0;
    }
    const name = tokens[1] || '';
    const id = _mci.aliases.get(name) || (Number(name) >>> 0);
    const dev = _mci.devices.get(id);
    if (!dev) return 0x106; // MCIERR_INVALID_DEVICE_ID
    if (verb === 'play' && dev.type === 'cdaudio') {
      const parse = value => {
        const parts = String(value || '').split(':').map(Number);
        if (dev.timeFormat === 10 && parts.length === 4) {
          const track = dev.disc.track(parts[0]);
          return track ? track.discStartSector + ((parts[1] * 60 + parts[2]) * 75 + parts[3]) : dev.disc.leadOutSector;
        }
        if (parts.length === 3) return (parts[0] * 60 + parts[1]) * 75 + parts[2];
        return Math.round((Number(value) || 0) * 75 / 1000);
      };
      const fromToken = tokenAfter('from');
      const toToken = tokenAfter('to');
      return _cdSchedule(dev, fromToken ? parse(fromToken) : undefined, toToken ? parse(toToken) : undefined);
    }
    if (verb === 'play') return _mciCommand(id, 0x0806, 0, 0);
    if (verb === 'stop' || verb === 'pause') return _mciCommand(id, verb === 'pause' ? 0x0809 : 0x0808, 0, 0);
    if (verb === 'resume') return _mciCommand(id, 0x0855, 0, 0);
    if (verb === 'close') {
      for (const [alias, aliasId] of Array.from(_mci.aliases.entries())) {
        if (aliasId === id) _mci.aliases.delete(alias);
      }
      return _mciCommand(id, 0x0804, 0, 0);
    }
    if (verb === 'set' && dev.type === 'cdaudio' && lower.includes('time') && lower.includes('format')) {
      const value = tokenAfter('format').toLowerCase();
      const formats = { milliseconds: 0, msf: 2, frames: 3, tmsf: 10 };
      if (!(value in formats)) return 0x11C;
      dev.timeFormat = formats[value];
      return 0;
    }
    if (verb === 'status') {
      const item = lower.includes('length') ? 'length' :
                   lower.includes('position') ? 'position' :
                   lower.includes('mode') ? 'mode' :
                   lower.includes('tracks') ? 'tracks' : '';
      let value = '';
      _mciRefreshPlaybackState(dev);
      if (dev.type === 'cdaudio') {
        const trackToken = tokenAfter('track');
        const track = trackToken ? dev.disc.track(Number(trackToken)) : null;
        if (item === 'length') {
          const sectors = track ? track.playableSectors : dev.disc.leadOutSector;
          if (dev.timeFormat === 10 || dev.timeFormat === 2) {
            const packed = _cdPackMsf(sectors);
            value = `${packed & 0xFF}:${(packed >>> 8) & 0xFF}:${(packed >>> 16) & 0xFF}`;
          } else value = String(_cdSectorToValue(dev, sectors, true));
        } else if (item === 'position') {
          const sector = track ? track.discStartSector : _cdRefresh(dev);
          const current = _cdTrackAt(dev.disc, sector);
          const offset = current ? sector - current.discStartSector : sector;
          const packed = _cdPackMsf(offset);
          value = dev.timeFormat === 10 && current
            ? `${current.number}:${packed & 0xFF}:${(packed >>> 8) & 0xFF}:${(packed >>> 16) & 0xFF}`
            : String(_cdSectorToValue(dev, sector));
        } else if (item === 'tracks') value = String(dev.disc.tracks.length);
        else if (item === 'mode') value = dev.state === 'playing' ? 'playing' : dev.state === 'paused' ? 'paused' : 'stopped';
      } else if (item === 'length') value = String(_mciLengthMs(dev));
      else if (item === 'position') value = String(_mciRefreshPlaybackState(dev));
      else if (item === 'mode') value = dev.state === 'playing' ? 'playing' : dev.state === 'paused' ? 'paused' : 'stopped';
      else if (item === 'tracks') value = '1';
      _writeStrA(retWa, retLen, value);
      return 0;
    }
    return 0;
  };

  const _mciOpen = (deviceTypeOrWa, elementWa, flags, isWide) => {
    const read = isWide ? readStrW : readStr;
    let type = '';
    if ((flags & 0x1000) === 0 && deviceTypeOrWa) {
      try { type = read(deviceTypeOrWa, 64).toLowerCase(); } catch (_) { type = ''; }
    } else if (deviceTypeOrWa) {
      type = String(deviceTypeOrWa >>> 0);
    }
    let element = elementWa ? read(elementWa, 260) : '';
    const typeLooksMidiFile = /\.m(id|idi|rmi)$/i.test(type);
    const typeLooksWaveFile = /\.wav$/i.test(type);
    if (!element && (typeLooksMidiFile || typeLooksWaveFile)) {
      element = type;
      type = typeLooksMidiFile ? 'sequencer' : 'waveaudio';
    }
    const lower = element.toLowerCase();
    const isMidi = type === 'sequencer' || /\.m(id|idi|rmi)$/.test(lower);
    const isWave = type === 'waveaudio' || type === 'waveformaudio' || type === '522' || /\.wav$/.test(lower);
    const isCd = type === 'cdaudio' || type === '516';
    const disc = isCd ? _cdFindDisc(element) : null;
    if (isCd && !disc) return 0;
    const firstAudio = disc && disc.audioTracks && disc.audioTracks[0];
    const data = _readVfsFile(element);
    const id = _mci.nextId++;
    const dev = {
      id,
      type: isCd ? 'cdaudio' : isMidi ? 'sequencer' : isWave ? 'waveaudio' : (type || 'auto'),
      element,
      disc,
      timeFormat: isCd ? 2 : 0,
      cdPositionSector: firstAudio ? firstAudio.discStartSector : 0,
      cdStartSector: firstAudio ? firstAudio.discStartSector : 0,
      cdEndSector: disc ? disc.leadOutSector : 0,
      cdSources: [],
      smf: isMidi && data ? _parseSmf(data) : null,
      wave: isWave && data ? _parseWave(data) : null,
      state: 'stopped',
      nodes: [],
      timer: null,
      playStartMs: 0,
      playStartPositionMs: 0,
      playEndMs: 0,
      playLengthMs: 0,
      playRunMs: 0,
      playPositionMs: 0,
    };
    _mci.devices.set(id, dev);
    if (isCd && !_mci.aliases.has('cdaudio')) _mci.aliases.set('cdaudio', id);
    if ((isMidi && !dev.smf) || (isWave && !dev.wave)) _mciFetchLate(dev);
    if (isMidi) {
      console.log(`[MCI] open sequencer id=${id} element="${element || ''}" notes=${dev.smf ? dev.smf.notes.length : 0}`);
    } else if (isWave) {
      console.log(`[MCI] open waveaudio id=${id} element="${element || ''}" frames=${dev.wave ? dev.wave.frames : 0} rate=${dev.wave ? dev.wave.rate : 0} channels=${dev.wave ? dev.wave.channels : 0} bits=${dev.wave ? dev.wave.bits : 0}`);
    } else if (isCd) {
      console.log(`[MCI] open cdaudio id=${id} drive=${disc.drive}: tracks=${disc.firstTrack}-${disc.lastTrack}`);
    }
    return id;
  };

  ctx.stopAudio = () => {
    if (_deviceNotifications) {
      _deviceNotifications.unsubscribe();
      _deviceNotifications = null;
    }
    for (const dev of Array.from(_mci.devices.values())) {
      if (dev.type === 'cdaudio') _cdStop(dev);
      else if (dev.type === 'waveaudio') _waveStop(dev);
      else _midiStop(dev);
    }
    _mci.devices.clear();
    if (_mci.aliases) _mci.aliases.clear();

    for (const dev of Array.from(_midiOut.devices.values())) _midiOutResetDevice(dev);
    _midiOut.devices.clear();

    if (_voices && _voices._map) {
      for (const id of Object.keys(_voices._map)) {
        try { _voices.close(Number(id)); } catch (_) {}
      }
    }

    if (ctx._tinySynth && ctx._tinySynth.synth) {
      const synth = ctx._tinySynth.synth;
      for (let ch = 0; ch < 16; ch++) {
        try {
          if (synth.allSoundOff) synth.allSoundOff(ch);
          else if (synth.send) synth.send([0xB0 | ch, 120, 0], 0);
        } catch (_) {}
      }
      try { if (synth.stopMIDI) synth.stopMIDI(); } catch (_) {}
      ctx._tinySynth = null;
    }

    const ac = (_voices && _voices._ac) || ctx._audioCtx;
    if (ac) {
      try {
        if (ac.close) ac.close();
        else if (ac.suspend) ac.suspend();
      } catch (_) {}
      if (ac._wineMaster && ac._wineMaster.gain) {
        try { ac._wineMaster.gain.value = 0; } catch (_) {}
      }
    }
    if (_audioMixerState.mixerContexts) _audioMixerState.mixerContexts.delete(ac);
    if (_voices) _voices._ac = null;
    ctx._audioCtx = null;
  };

  // The audio slice of the flat host import namespace. host-imports.js
  // spreads these into `host` in place, so the guest still sees one object.
  const imports = {
    message_beep: (uType) => {
      try {
        const audioCtx = ctx._voices._ensureCtx(22050);
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
          try { audioCtx.resume(); } catch (_) {}
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const systemFreq = { 0x10: 200, 0x20: 300, 0x30: 400, 0x40: 600 };
        const freq = systemFreq[uType] || (360 + ((uType >>> 0) % 19) * 28);
        const now = audioCtx.currentTime;
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain);
        gain.connect(_getAudioBus(audioCtx, 1));
        osc.start(now);
        osc.stop(now + 0.13);
      } catch (_) {}
    },
    // PlaySound/sndPlaySound: play a complete RIFF/WAVE image out of guest
    // memory and hand the caller a voice id for it. The id is what makes the
    // sound stoppable — PlaySound stops the sound it started before starting
    // the next one, and PlaySound(NULL)/SND_PURGE stop it outright — so the
    // one-shot goes on a real VoiceManager voice (its gain node, and therefore
    // the wave mixer slider, included) instead of a loose buffer source
    // nothing holds a reference to. Decoding is async, so the voice exists
    // before the sound does and voice_stop before decode still cancels it.
    play_sound: (wasmPtr, length, loop) => {
      try {
        const audioCtx = ctx._voices._ensureCtx(22050);
        // Copy WAV data out of WASM memory before anything can move it.
        const wavData = new Uint8Array(ctx.getMemory(), wasmPtr, length).slice();
        const id = ctx._voices.open(22050, 1, 16);
        const v = ctx._voices._map[id];
        if (!v) return 0;
        v.mode = 'snapshot';
        v.snapshotLoop = !!loop;
        v.snapshotPlaying = true;
        v.snapshotStartMs = _audioClockMs();
        v.snapshotBytes = 0;
        if (!audioCtx) return id;      // no output here; still stoppable
        ctx._audioCtx = audioCtx;
        if (audioCtx.state === 'suspended') {
          try { audioCtx.resume(); } catch (_) {}
        }
        audioCtx.decodeAudioData(wavData.buffer).then(audioBuffer => {
          // A stop that landed while the decode was in flight already
          // retired this voice; do not resurrect it.
          if (ctx._voices._map[id] !== v || !v.snapshotPlaying) return;
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.loop = !!loop;
          source.connect(v.gain || _getAudioBus(audioCtx, 1));
          v.rate = audioBuffer.sampleRate;
          v.channels = audioBuffer.numberOfChannels;
          v.bits = 16;
          v.freq = v.rate;
          v.snapshotBytes = audioBuffer.length * v.channels * 2;
          v.snapshotStartMs = _audioClockMs();
          v.playStart = audioCtx.currentTime;
          v.lastDuration = audioBuffer.duration;
          source.start();
          v.currentSrc = source;
          source.onended = () => {
            if (v.currentSrc !== source) return;
            v.currentSrc = null;
            v.snapshotPlaying = false;
            // A finished one-shot is never asked about again; releasing the
            // slot keeps a chatty app from accumulating one voice per sound.
            if (ctx._voices._map[id] === v) ctx._voices.close(id);
          };
        }).catch(() => {
          v.snapshotPlaying = false;
          if (ctx._voices._map[id] === v) ctx._voices.close(id);
        });
        return id;
      } catch (_) { return 0; }
    },
    mci_open: (deviceTypeOrWa, elementWa, flags) => _mciOpen(deviceTypeOrWa, elementWa, flags, false),
    mci_open_w: (deviceTypeOrWa, elementWa, flags) => _mciOpen(deviceTypeOrWa, elementWa, flags, true),
    mci_command: _mciCommand,
    mci_string: _mciStringCommand,
    mci_get_device_id: (nameWa) => {
      const name = nameWa ? readStr(nameWa, 512).trim() : '';
      if (!name || !_mci.aliases) return 0;
      const direct = _mci.aliases.get(name);
      if (direct) return direct >>> 0;
      const lower = name.toLowerCase();
      for (const [alias, id] of _mci.aliases.entries()) {
        if (String(alias).toLowerCase() === lower) return id >>> 0;
      }
      return 0;
    },
    midi_num_devs: () => 1,
    midi_out_open: (deviceId, callback, callbackInstance, flags) => {
      const devId = deviceId >>> 0;
      if (devId !== 0 && devId !== 0xFFFFFFFF) return 0;
      const handle = _midiOut.nextHandle++;
      _midiOut.devices.set(handle, {
        handle,
        deviceId: devId,
        callback: callback >>> 0,
        callbackInstance: callbackInstance >>> 0,
        flags: flags >>> 0,
        volume: _midiOut.defaultVolume >>> 0,
        program: new Array(16).fill(0),
        channelVolume: new Array(16).fill(127),
        active: new Map(),
        master: null,
      });
      return handle;
    },
    midi_out_close: (handle) => {
      const dev = _midiOut.devices.get(handle >>> 0);
      if (!dev) return 5; // MMSYSERR_INVALHANDLE
      _midiOutResetDevice(dev);
      _midiOut.devices.delete(handle >>> 0);
      return 0;
    },
    midi_out_short_msg: (handle, msg) => {
      const dev = _midiOut.devices.get(handle >>> 0);
      if (!dev) return 5; // MMSYSERR_INVALHANDLE
      const status = msg & 0xFF;
      const a = (msg >>> 8) & 0xFF;
      const b = (msg >>> 16) & 0xFF;
      const op = status & 0xF0;
      const ch = status & 0x0F;
      const raw = (op === 0xC0 || op === 0xD0) ? [status, a] : [status, a, b];
      if (op === 0x90) {
        // A real-time note stream has no declared duration, so hold the
        // context open on a rolling window rather than a computed end.
        if (b) _markMidiHot(1000);
        if (b) _markAudioMixerPeak(2, Math.min(127, b * (dev.channelVolume[ch] || 127) / 127) / 127, 160);
        if (_midiOutTinySend(dev, raw)) return 0;
        if (b) return _midiOutNoteOn(dev, ch, a, Math.min(127, b * (dev.channelVolume[ch] || 127) / 127));
        _midiOutStopNote(dev, ch + ':' + a);
        return 0;
      }
      if (op === 0x80) {
        if (_midiOutTinySend(dev, raw)) return 0;
        _midiOutStopNote(dev, ch + ':' + a);
        return 0;
      }
      if (op === 0xB0) {
        _midiOutTinySend(dev, raw);
        if (a === 7) dev.channelVolume[ch] = b;
        if (a === 120 || a === 123) {
          for (const key of Array.from(dev.active.keys())) {
            if (key.startsWith(ch + ':')) _midiOutStopNote(dev, key);
          }
        }
        return 0;
      }
      if (op === 0xC0) {
        _midiOutTinySend(dev, raw);
        dev.program[ch] = a;
        return 0;
      }
      if (op === 0xE0 || op === 0xD0 || op === 0xA0) {
        _midiOutTinySend(dev, raw);
        return 0;
      }
      return 0;
    },
    midi_out_reset: (handle) => _midiOutResetDevice(_midiOut.devices.get(handle >>> 0)),
    midi_out_get_volume: (handle, volumeWa) => {
      const dev = _midiOut.devices.get(handle >>> 0);
      if (!volumeWa) return 11; // MMSYSERR_INVALPARAM
      if (!dev && (handle >>> 0) !== 0 && (handle >>> 0) !== 0xFFFFFFFF) return 5; // MMSYSERR_INVALHANDLE
      new DataView(ctx.getMemory()).setUint32(volumeWa, (dev ? dev.volume : _midiOut.defaultVolume) >>> 0, true);
      return 0;
    },
    midi_out_set_volume: (handle, volume) => {
      const dev = _midiOut.devices.get(handle >>> 0);
      if (!dev && (handle >>> 0) !== 0 && (handle >>> 0) !== 0xFFFFFFFF) return 5; // MMSYSERR_INVALHANDLE
      if (!dev) {
        _midiOut.defaultVolume = volume >>> 0;
        for (const d of _midiOut.devices.values()) {
          d.volume = volume >>> 0;
          if (d.master && d.master.gain) d.master.gain.value = _midiMasterGain * _midiOutGainValue(d.volume);
        }
        return 0;
      }
      dev.volume = volume >>> 0;
      if (dev.master && dev.master.gain) dev.master.gain.value = _midiMasterGain * _midiOutGainValue(dev.volume);
      return 0;
    },
    audio_mixer_get_volume: (bus) => {
      const channel = Math.max(0, Math.min(2, bus | 0));
      return _audioMixerState.mixerVolumes[channel] >>> 0;
    },
    audio_mixer_set_volume: (bus, volume) => {
      const channel = Math.max(0, Math.min(2, bus | 0));
      _setAudioMixerVolume(channel, volume);
      console.log(`[mixer] ${['master', 'wave', 'midi'][channel]} volume=0x${(volume >>> 0).toString(16).padStart(8, '0')}`);
    },
    audio_mixer_get_mute: (bus) => {
      const channel = Math.max(0, Math.min(2, bus | 0));
      return _audioMixerState.mixerMutes[channel] ? 1 : 0;
    },
    audio_mixer_set_mute: (bus, mute) => {
      const channel = Math.max(0, Math.min(2, bus | 0));
      _audioMixerState.mixerMutes[channel] = mute ? 1 : 0;
      for (const ac of _audioMixerState.mixerContexts) _applyAudioMixerVolume(ac, channel);
      console.log(`[mixer] ${['master', 'wave', 'midi'][channel]} mute=${mute ? 1 : 0}`);
    },
    audio_mixer_get_peak: (bus) => _getAudioMixerPeak(bus),
    audio_mixer_mark_peak: (bus, value, holdMs) => {
      _markAudioMixerPeak(bus, Math.max(0, Math.min(32767, value | 0)) / 32767, holdMs | 0);
    },
    // ---- Unified voice audio bridge ----
    // Both waveOut (stream submit) and DSOUND (snapshot/loop) sit on top of a
    // single VoiceManager. Each voice = one mixer slot with format + gain/pan/rate
    // + connection to the shared AudioContext destination.
    //   wave_out_*       → voice in STREAM mode (queued one-shots, no random write)
    //   IDirectSoundBuffer_* → voice in SNAPSHOT mode (Play() captures the guest
    //                          ring, and looping Lock/Unlock refreshes it in place)
    voice_open: (sampleRate, channels, bitsPerSample) => {
      return ctx._voices.open(sampleRate, channels, bitsPerSample);
    },
    voice_write_stream: (id, pcmDataWA, byteLength) => {
      const prevProfileThreadId = _audioDoneState.profileThreadId;
      _audioDoneState.profileThreadId = (ctx.threadId || 0) | 0;
      try {
        ctx._voices.writeStream(id, pcmDataWA, byteLength);
        return 0;
      } finally {
        _audioDoneState.profileThreadId = prevProfileThreadId;
      }
    },
    voice_play_ring: (id, pcmDataWA, byteLength, startOffset, loop) => {
      ctx._voices.playRing(id, pcmDataWA, byteLength, startOffset, loop);
      return 0;
    },
    voice_stop: (id) => { ctx._voices.stop(id); return 0; },
    voice_close: (id) => { ctx._voices.close(id); return 0; },
    voice_get_pos: (id) => ctx._voices.getPos(id),
    voice_is_playing: (id) => ctx._voices.isPlaying(id) ? 1 : 0,
    voice_notify_set: (id, arrayWA, count, bufferBytes) =>
      ctx._voices.notifySet(id, arrayWA, count, bufferBytes),
    voice_set_volume_linear: (id, vol_0_65535) => {
      ctx._voices.setGain(id, Math.max(0, Math.min(1, vol_0_65535 / 65535)));
    },
    voice_set_volume_db: (id, centibels) => {
      // DSOUND attenuation: 0 = full, -10000 = silent. Linear = 10^(cB/2000).
      const cB = Math.max(-10000, Math.min(0, centibels | 0));
      ctx._voices.setGain(id, Math.pow(10, cB / 2000));
    },
    voice_set_pan: (id, centibels) => {
      // DSOUND pan: -10000 = full left, +10000 = full right. Linear in [-1, 1].
      const cB = Math.max(-10000, Math.min(10000, centibels | 0));
      ctx._voices.setPan(id, cB / 10000);
    },
    voice_set_freq: (id, hz) => { ctx._voices.setFreq(id, hz | 0); },
    // IDirectSound3DBuffer properties. Float arguments/results cross the WAT
    // boundary as their raw i32 bits; property numbers match the getter slots
    // documented in VoiceManager.setSpatial/getSpatial above.
    voice_3d_set: (id, property, a, b, c) => {
      ctx._voices.setSpatial(id, property, a, b, c);
    },
    voice_3d_get: (id, property) => ctx._voices.getSpatial(id, property),

    // ---- waveOut compatibility shims (wrap a single STREAM voice) ----
    wave_out_open: (sampleRate, channels, bitsPerSample, callbackType, callback, instance) => {
      const id = ctx._voices.open(sampleRate, channels, bitsPerSample);
      if (ctx._voices._map[id]) ctx._voices._map[id].mode = 'stream';
      console.log(`[waveOut] open: ${sampleRate}Hz ${channels}ch ${bitsPerSample}bit -> voice#${id}`);
      if (_audioDoneState.waveOutOpenHandles && _audioDoneState.waveOutOpenHandles.add) {
        _audioDoneState.waveOutOpenHandles.add(id >>> 0);
      }
      const prior=_audioDoneState.waveRegistrations.get(id>>>0);
      if(prior) prior.retired=true;
      _audioDoneState.waveRegistrations.set(id>>>0,{handle:id>>>0,type:callbackType|0,
        callback:callback>>>0,instance:instance>>>0,owner:ctx.waveCallbackOwner || (!('waveCallbackOwner' in ctx) && !ctx.threadManager?.workerBackend && ctx.exports ? {kind:'cooperative',exports:ctx.exports} : null),retired:false});
      _markWaveOutHot(500);
      // Capture format for an optional WAV-header finalize at exit.
      ctx._audioOutFormat = { rate: sampleRate, ch: channels, bits: bitsPerSample };
      return id;
    },
    wave_out_write: (handle, pcmDataWA, byteLength) => {
      const prevProfileThreadId = _audioDoneState.profileThreadId;
      _audioDoneState.profileThreadId = (ctx.threadId || 0) | 0;
      try {
        ctx._voices.writeStream(handle, pcmDataWA, byteLength);
      } finally {
        _audioDoneState.profileThreadId = prevProfileThreadId;
      }
      const v = ctx._voices && ctx._voices._map ? ctx._voices._map[handle] : null;
      if (v && byteLength > 0) {
        const bytesPerSec = Math.max(1, v.rate * v.channels * (v.bits / 8));
        const durationMs = (byteLength / bytesPerSec) * 1000;
        const ac = ctx._voices && ctx._voices._ac;
        const queuedMs = ac && Number.isFinite(v.nextTime)
          ? Math.max(0, (v.nextTime - ac.currentTime) * 1000)
          : durationMs;
        _markWaveOutHot(Math.max(durationMs, queuedMs) + 250);
      } else {
        _markWaveOutHot(250);
      }
      // Optional raw PCM dump for offline test inspection
      if (ctx._audioOutFd !== undefined) {
        try {
          // --audio-out-max caps the file; the shared count keeps running.
          const count = ctx._audioOutCount || (ctx._audioOutCount = { max: 0, bytes: 0 });
          const room = count.max ? Math.max(0, count.max - count.bytes) : byteLength;
          if (room > 0) {
            const buf = Buffer.from(ctx.getMemory(), pcmDataWA, Math.min(byteLength, room));
            require('fs').writeSync(ctx._audioOutFd, buf);
          }
          count.bytes += byteLength;
        } catch (_) {}
      }
      return 0;
    },
    wave_out_schedule_done: (handle, waveHdrWA, waveHdrGA, byteLength) => {
      if (byteLength === undefined) {
        byteLength = waveHdrGA;
        waveHdrGA = 0;
      }
      const submission=_trackWaveOutHeader(handle, waveHdrWA, waveHdrGA);
      const v = ctx._voices && ctx._voices._map ? ctx._voices._map[handle] : null;
      const ac = ctx._voices && ctx._voices._ac;
      const dueByte = v ? (v.bytesWritten >>> 0) : 0;
      const complete = () => {
        if (ctx._voices && ctx._voices.releaseStreamThrough) {
          ctx._voices.releaseStreamThrough(handle, dueByte);
        }
        _completeWaveOutDone(handle, waveHdrWA, waveHdrGA, submission);
      };
      if (typeof window !== 'undefined' && ac && v && Number.isFinite(v.nextTime)) {
        _markWaveOutPending(1);
        _markWaveOutHot(Math.max(0, (v.nextTime - ac.currentTime) * 1000) + 250);
        const arm = (ms) => {
          const timer = setTimeout(() => {
            v.timers.delete(timer);
            poll();
          }, ms);
          v.timers.add(timer);
        };
        // A WAVEHDR that never comes back is a hang, not silence. Miles hands
        // waveOutWrite a buffer and then spins on WHDR_DONE with its mixer
        // mutex held (Mss32 0x21113484: `test [hdr+0x10],1 / jz $-7`), so the
        // whole guest stops until that bit is set. A suspended AudioContext
        // freezes `currentTime`, `getPos` stops advancing, and the poll below
        // re-arms forever — measured on Warcraft III in headless Chrome: the
        // context suspends at currentTime 0.006 with 4 bytes submitted and the
        // guest never leaves the loop. A page the user has not gestured at yet
        // suspends the same way. So when the context is not running, pace the
        // completion off the wall clock: nothing is audible either way, and
        // Windows always returns the buffer. A guest-requested waveOutPause is
        // different and still holds the buffer, which is what Windows does.
        const wallNow = () =>
          (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const submittedAt = wallNow();
        const bytesPerSecAtSubmit = Math.max(1, v.rate * v.channels * (v.bits / 8));
        const durationMs = (Math.max(0, byteLength | 0) / bytesPerSecAtSubmit) * 1000;
        const poll = () => {
          if (!ctx._voices || ctx._voices._map[handle] !== v) return;
          const played = ctx._voices.getPos(handle) >>> 0;
          if (!v.paused && ac.state !== 'running') {
            const elapsed = wallNow() - submittedAt;
            if (elapsed >= durationMs) { complete(); return; }
            arm(Math.max(8, Math.min(50, durationMs - elapsed)));
            return;
          }
          if (v.paused || played < dueByte) {
            const bytesPerSec = Math.max(1, v.rate * v.channels * (v.bits / 8));
            const ms = v.paused ? 50 : Math.max(8, Math.min(50,
              (dueByte - played) / bytesPerSec * 1000));
            arm(ms);
            return;
          }
          complete();
        };
        const ms = Math.max(0, Math.min(50,
          (dueByte - (ctx._voices.getPos(handle) >>> 0)) /
          Math.max(1, v.rate * v.channels * (v.bits / 8)) * 1000));
        arm(ms);
      } else if (v && typeof byteLength === 'number' && byteLength > 0 && _audioClockMs() !== null) {
        const bytesPerSec = Math.max(1, v.rate * v.channels * (v.bits / 8));
        const nowMs = _audioClockMs();
        const durationMs = (byteLength / bytesPerSec) * 1000;
        const dueMs = Math.max(nowMs, v.nextDoneTimeMs || nowMs) + durationMs;
        v.nextDoneTimeMs = dueMs;
        _markWaveOutPending(1);
        _markWaveOutHot(durationMs + 250);
        _audioDoneState.waveDoneQueue.push({
          handle: handle >>> 0,
          waveHdrWA: waveHdrWA >>> 0,
          waveHdrGA: waveHdrGA >>> 0,
          dueMs,
          dueByte, submission,
        });
      } else {
        complete();
      }
      return 0;
    },
    wave_out_reset: (handle) => {
      handle >>>= 0;
      if (!_audioDoneState.waveOutOpenHandles.has(handle)) return 5; // MMSYSERR_INVALHANDLE
      const completed = _completeWaveOutHandle(handle);
      if (ctx._voices && ctx._voices.stop) ctx._voices.stop(handle);
      if (!completed) _markWaveOutHot(250);
      return 0;
    },
    wave_out_pause: (handle) => ctx._voices.pauseStream(handle),
    wave_out_restart: (handle) => ctx._voices.restartStream(handle),
    wave_out_close: (handle) => {
      handle >>>= 0;
      if (!_audioDoneState.waveOutOpenHandles.has(handle)) return 5; // MMSYSERR_INVALHANDLE
      const registration=_audioDoneState.waveRegistrations.get(handle>>>0);
      if(registration) {registration.retired=true;_audioDoneState.waveRegistrations.delete(handle>>>0);}
      // A pump can be awaiting an unrelated owning-Worker offer. Preserve its
      // queue identity or accepted entries survive in a cloned live queue.
      const callbacks=_audioDoneState.waveFunctionDoneQueue;
      for(let i=callbacks.length-1;i>=0;i--) {
        if(callbacks[i].registration===registration && !registration?.owner?.link?._waveOffer) callbacks.splice(i,1);
      }
      console.log(`[waveOut] close voice#${handle}`);
      ctx._voices.close(handle);
      if (_audioDoneState.waveScheduledHeaders) {
        _audioDoneState.waveScheduledHeaders.delete(handle >>> 0);
      }
      if (_audioDoneState.waveOutOpenHandles && _audioDoneState.waveOutOpenHandles.delete) {
        _audioDoneState.waveOutOpenHandles.delete(handle >>> 0);
      }
      if (_audioDoneState.waveOutOpenHandles && _audioDoneState.waveOutOpenHandles.size === 0) {
        _audioDoneState.pendingWaveDoneCount = 0;
      }
      _markWaveOutHot(250);
      return 0;
    },
    wave_out_get_pos: (handle) => ctx._voices.getPos(handle),
    wave_out_set_volume: (handle, volume) => {
      ctx._voices.setGain(handle, Math.max(0, Math.min(1, volume / 65535)));
    },

    // ---- waveIn capture ------------------------------------------------
    wave_in_open: (sampleRate, channels, bitsPerSample, callback, instance, callbackType) => {
      const handle = _waveIn.nextHandle++;
      _waveIn.devices.set(handle, {
        handle,
        rate: Math.max(1, sampleRate | 0),
        channels: Math.max(1, Math.min(2, channels | 0)),
        bits: bitsPerSample === 8 ? 8 : 16,
        callback: callback >>> 0,
        instance: instance >>> 0,
        callbackType: callbackType | 0,
        queue: [],
        running: false,
        resamplePhase: 0,
        stream: null,
        source: null,
        processor: null,
        silentGain: null,
        capturedFrames: 0,
        lastError: '',
      });
      console.log(`[waveIn] open: ${sampleRate}Hz ${channels}ch ${bitsPerSample}bit -> input#${handle}`);
      return handle;
    },
    wave_in_add_buffer: (handle, waveHdrWA, waveHdrGA, dataWA, byteLength) => {
      const device = _waveIn.devices.get(handle >>> 0);
      if (!device || !waveHdrWA || !dataWA || byteLength <= 0) return 11; // MMSYSERR_INVALPARAM
      device.queue.push({
        waveHdrWA: waveHdrWA >>> 0,
        waveHdrGA: waveHdrGA >>> 0,
        dataWA: dataWA >>> 0,
        length: byteLength >>> 0,
        written: 0,
      });
      return 0;
    },
    wave_in_start: (handle) => {
      const device = _waveIn.devices.get(handle >>> 0);
      if (!device) return 5; // MMSYSERR_INVALHANDLE
      device.running = true;
      if (device.stream || device.acquirePending) return 0;
      const getUserMedia = _getUserMedia();
      if (!getUserMedia) {
        // Node/CLI tests inject PCM through wave_in_feed_pcm. In a browser,
        // however, this means capture is unavailable (usually an insecure
        // origin) and must not look like a successful recording start.
        if (typeof window === 'undefined') return 0;
        device.running = false;
        _reportWaveInError(device, new Error('Microphone capture requires browser permission and a secure connection'));
        return 8; // MMSYSERR_NOTSUPPORTED
      }
      device.acquirePending = true;
      _claimWaveInAudioSession(true);
      const primed = _waveIn.primedCapture;
      let acquisition;
      if (primed) {
        primed.claimed = true;
        if (primed.timer) clearTimeout(primed.timer);
        _waveIn.primedCapture = null;
        _waveIn.primeConsumes = (_waveIn.primeConsumes | 0) + 1;
        acquisition = primed.promise.then(stream => {
          if (!stream) throw primed.error || new Error('microphone unavailable');
          return stream;
        });
      } else {
        acquisition = Promise.resolve(getUserMedia(_waveInConstraints(device)));
      }
      acquisition.then(stream => {
        device.acquirePending = false;
        if (!_waveIn.devices.has(device.handle) || !device.running) {
          if (stream && stream.getTracks) for (const track of stream.getTracks()) track.stop();
          _restorePlaybackAudioSession();
          return;
        }
        const ac = _voices._ensureCtx(device.rate);
        if (!ac || !ac.createMediaStreamSource || !ac.createScriptProcessor) {
          if (stream && stream.getTracks) for (const track of stream.getTracks()) track.stop();
          device.running = false;
          _reportWaveInError(device, new Error('This browser does not provide the required microphone audio APIs'));
          return;
        }
        device.stream = stream;
        device.source = ac.createMediaStreamSource(stream);
        device.processor = ac.createScriptProcessor(4096, device.channels, 1);
        device.processor.onaudioprocess = event => {
          if (!device.running || !event || !event.inputBuffer) return;
          const input = event.inputBuffer;
          const inputChannels = [];
          for (let ch = 0; ch < input.numberOfChannels; ch++) inputChannels.push(input.getChannelData(ch));
          _feedWaveInPcm(device.handle, inputChannels, input.sampleRate || ac.sampleRate || device.rate);
        };
        device.silentGain = ac.createGain();
        // A mathematically silent branch can be optimized away by WebKit,
        // which stops ScriptProcessor callbacks. This remains inaudible.
        device.silentGain.gain.value = 1e-8;
        device.source.connect(device.processor);
        device.processor.connect(device.silentGain);
        device.silentGain.connect(ac.destination);
        if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
      }).catch(error => {
        device.acquirePending = false;
        device.running = false;
        _reportWaveInError(device, error);
        _restorePlaybackAudioSession();
      });
      return 0;
    },
    wave_in_stop: (handle) => {
      const device = _waveIn.devices.get(handle >>> 0);
      if (!device) return 5;
      device.running = false;
      _stopWaveInNodes(device);
      _flushWaveIn(device, false);
      _restorePlaybackAudioSession();
      return 0;
    },
    wave_in_reset: (handle) => {
      const device = _waveIn.devices.get(handle >>> 0);
      if (!device) return 5;
      device.running = false;
      _stopWaveInNodes(device);
      _flushWaveIn(device, true);
      _restorePlaybackAudioSession();
      return 0;
    },
    wave_in_close: (handle) => {
      const device = _waveIn.devices.get(handle >>> 0);
      if (!device) return 5;
      device.running = false;
      _stopWaveInNodes(device);
      _flushWaveIn(device, true);
      _postWaveInMessage(device, 0x03BF, 0); // MM_WIM_CLOSE
      _waveIn.devices.delete(handle >>> 0);
      _restorePlaybackAudioSession();
      console.log(`[waveIn] close input#${handle}`);
      return 0;
    },
    // Test/CLI injection bridge. Browser capture calls the same converter.
    wave_in_feed_pcm: (handle, channelData, sourceRate) =>
      _feedWaveInPcm(handle, channelData, sourceRate),
  };

  // A looping DirectSound buffer the guest never touches again would emit
  // nothing until Stop. The recorder therefore pumps every live ring once per
  // captured frame, which is what makes a held music loop record as music
  // rather than as one burst at the end.
  const _pumpAudioTap = () => {
    if (!_audioTap()) return;
    for (const [id, v] of Object.entries(_voices._map)) {
      try {
        if (!v.tapRing) _tapJoinRing(v, _voices.getPos(Number(id)));
        _tapFlushRing(v);
      } catch (_) {}
    }
  };
  if (typeof ctx.registerAudioTapPump === 'function') {
    try { ctx.registerAudioTapPump(_pumpAudioTap); } catch (_) {}
  }

  const _pumpWaveOutCallbacks = async () => {
    if (_audioDoneState.waveCallbackPumpBusy) return;
    _audioDoneState.waveCallbackPumpBusy=true;
    try {
      const q=_audioDoneState.waveFunctionDoneQueue;
      // Preserve ordering; ambiguity stays at the head, never converted to a new token.
      for(let n=0;n<8 && q.length;n++) {
        const item=q[0], registration=item.registration;
        if(registration?.retired && !registration.owner?.link?._waveOffer) {q.shift();continue;}
        if(!registration || !registration.owner || typeof ctx.offerWaveCallback!=='function') break;
        const result=await ctx.offerWaveCallback(item);
        if(result?.status==='accepted' || result?.status==='retired') {
          if(q[0]===item) q.shift();
          continue;
        }
        item.deliveryStatus=result?.status || 'unknown';
        break;
      }
    } finally {_audioDoneState.waveCallbackPumpBusy=false;}
  };
  const _retireWaveCallbacks = () => {
    for(const r of _audioDoneState.waveRegistrations.values()) r.retired=true;
    _audioDoneState.waveRegistrations.clear();
    _audioDoneState.waveFunctionDoneQueue.length=0;
  };

  return {
    imports,
    pumpWaveOutCallbacks:_pumpWaveOutCallbacks,
    retireWaveCallbacks:_retireWaveCallbacks,
    pumpWaveOutCompletions: _pumpWaveOutCompletions,
    pumpAudioTap: _pumpAudioTap,
    deviceNotificationsReady: _deviceNotifications ? _deviceNotifications.ready : Promise.resolve(),
    flushDeviceNotifications: () => _deviceNotifications ? _deviceNotifications.flush() : Promise.resolve(),
  };
}

if (typeof module !== 'undefined') module.exports = { createAudioHost };
