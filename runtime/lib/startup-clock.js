'use strict';

// Startup clock dilation: the guest clock runs `factor` times real speed until
// startup ends, then at real speed from wherever it had got to.
//
// Why an app needs it: some games race a timer thread against their own
// initialisation and win on real hardware only because a Pentium finishes the
// initialisation in a few tens of milliseconds. Comanche Gold arms a 33 ms
// timeSetEvent and its 4th tick runs a generated sound mixer; main patches that
// mixer only after ~2.76M blocks of startup work, which takes this interpreter
// several times longer, so the tick runs the unpatched placeholder and the timer
// thread executes garbage (docs/re-notes/comanche-gold-demo.md). Slowing the
// clock while the game starts gives the race back to main, and ending the
// dilation keeps gameplay at real speed.
//
// The mapping is piecewise linear and continuous, so the guest never sees the
// clock jump or run backwards:
//   active:  dilated = raw * factor
//   ended:   dilated = raw + offset,  offset = rawEnd * factor - rawEnd
// `raw` is whatever elapsed-time unit the host already has (wall ms since the
// guest clock's origin in the page and under --real-ticks, batch-clock ms in
// the headless runner). Startup ends at the first of: end() (the host saw the
// app's end event) or raw reaching `maxMs` -- a bound so a missed event can
// never leave an app slow for good.
//
// Config, from lib/apps.js `startupClock`: { factor, maxMs, endOn }.
// `endOn` names the event the host watches: 'firstPresent:<kind>' is the first
// frame the app presents through that path (directdraw, gdi, gpu, glide), as
// counted by lib/host-imports.js _noteGuestFrame in both hosts. A visible
// window is NOT a usable end: Comanche shows its window before it even arms
// the timer, let alone patches the mixer.
(() => {
function normalizeStartupClock(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  const factor = Number(cfg.factor);
  if (!(factor > 0 && factor < 1)) return null;
  const maxMs = Number(cfg.maxMs);
  return {
    factor,
    maxMs: Number.isFinite(maxMs) && maxMs > 0 ? maxMs : 30000,
    endOn: typeof cfg.endOn === 'string' ? cfg.endOn : 'none',
  };
}

function createStartupClock(cfg) {
  const c = normalizeStartupClock(cfg);
  const state = { active: !!c, offset: 0, endedAtRaw: null, reason: null };
  const finish = (raw, reason) => {
    if (!state.active) return;
    state.active = false;
    state.endedAtRaw = raw;
    state.offset = raw * c.factor - raw;
    state.reason = reason;
  };
  return {
    config: c,
    state,
    get active() { return state.active; },
    // Raw elapsed -> guest elapsed.
    map(raw) {
      if (state.active && raw >= c.maxMs) finish(c.maxMs, 'maxMs');
      if (state.active) return raw * c.factor;
      return raw + state.offset;
    },
    // The inverse, for a host that stores guest time and must find the raw
    // instant it corresponds to (a wall-origin slide on resume).
    unmap(guest) {
      if (state.active) return guest / c.factor;
      return guest - state.offset;
    },
    end(raw, reason = 'event') { finish(raw, reason); },
  };
}

  const api = { createStartupClock, normalizeStartupClock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.StartupClock = api;
})();
