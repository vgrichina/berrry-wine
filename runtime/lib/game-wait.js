// The in-game wait window: what a player sees while a running game is parked
// on game data that is still downloading (an HTTP-range miss, host.js
// io_wait). Companion to the launch window (lib/launch-progress.js) and bound
// by the same rule: nothing is shown for a wait shorter than 500 ms.
//
// One *episode* is a run of parks with gaps shorter than MERGE_GAP_MS between
// them -- a burst of chunk misses is one wait, not a flicker of windows. The
// window appears at episodeStart + REVEAL_DELAY_MS only if that episode is
// still open; the timer carries the episode token and re-checks it. It closes
// when the episode ends; there is no minimum display time.
//
// A failed fetch is shown at once, with Retry and Quit: the game stays parked
// on the same call until the player picks one, so a network error is never
// turned into a read fault the game did not expect.
//
// Bytes are shown only when the episode's total is known (`total` non-null);
// otherwise the body says how much has arrived so far.
//
// Pure logic with injected clock and timers (test/test-game-wait.js); the DOM
// view is created separately (createDomView) and reuses the launch window's
// Win98 classes.
(function (root) {
  'use strict';

  const REVEAL_DELAY_MS = 500;
  const MERGE_GAP_MS = 250;

  function formatBytes(n) {
    if (!(n >= 0)) return '';
    if (n < 1024) return `${n} bytes`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  }

  function createGameWaitController(opts = {}) {
    const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = opts.clearTimer || (id => clearTimeout(id));
    const revealDelay = opts.revealDelayMs == null ? REVEAL_DELAY_MS : opts.revealDelayMs;
    const mergeGap = opts.mergeGapMs == null ? MERGE_GAP_MS : opts.mergeGapMs;
    let view = opts.view || null;
    let seq = 0;
    let episode = null;      // the open (or closing) episode
    const stats = { episodes: 0, revealed: 0, waits: 0, failures: 0 };

    function model(ep) {
      return {
        token: ep.token,
        label: ep.label,
        file: ep.file,
        state: ep.failure ? 'error' : 'waiting',
        loaded: ep.loaded,
        total: ep.total,
        bytesText: ep.total != null
          ? `${formatBytes(ep.loaded)} of ${formatBytes(ep.total)}`
          : (ep.loaded ? `${formatBytes(ep.loaded)} so far` : ''),
        reason: ep.failure ? ep.failure.reason : null,
      };
    }

    function render(ep) { if (view && ep.visible) view.render(model(ep)); }

    function reveal(ep) {
      if (episode !== ep || ep.visible) return;
      ep.visible = true;
      ep.revealedAt = now();
      stats.revealed++;
      if (view) view.show(model(ep));
    }

    function close(ep) {
      if (ep.revealTimer != null) { clearTimer(ep.revealTimer); ep.revealTimer = null; }
      if (ep.closeTimer != null) { clearTimer(ep.closeTimer); ep.closeTimer = null; }
      if (episode === ep) episode = null;
      ep.closedAt = now();
      if (ep.visible) {
        ep.visible = false;
        if (view) view.hide();
      }
    }

    // A park started. Returns the episode token the caller passes back.
    function begin(info = {}) {
      stats.waits++;
      let ep = episode;
      if (ep && ep.closeTimer != null) {
        // Back within the merge gap: same episode, keep its clock.
        clearTimer(ep.closeTimer);
        ep.closeTimer = null;
      }
      if (!ep) {
        ep = episode = {
          token: ++seq,
          startedAt: now(),
          label: info.label || 'The game',
          file: info.file || '',
          loaded: 0,
          total: null,
          open: 0,
          visible: false,
          failure: null,
          resolveActions: [],
          revealTimer: null,
          closeTimer: null,
        };
        stats.episodes++;
        ep.revealTimer = setTimer(() => {
          ep.revealTimer = null;
          if (episode === ep && (ep.open > 0 || ep.failure)) reveal(ep);
        }, revealDelay);
      }
      if (info.file) ep.file = info.file;
      if (info.label) ep.label = info.label;
      if (info.total != null) ep.total = (ep.total || 0) + info.total;
      ep.open++;
      render(ep);
      return ep.token;
    }

    function progress(token, loaded) {
      const ep = episode;
      if (!ep || ep.token !== token) return;
      ep.loaded += Math.max(0, loaded | 0);
      render(ep);
    }

    // The park finished (the call is about to re-run).
    function end(token) {
      const ep = episode;
      if (!ep || ep.token !== token) return;
      ep.open = Math.max(0, ep.open - 1);
      if (ep.open > 0 || ep.failure) return;
      ep.closeTimer = setTimer(() => {
        ep.closeTimer = null;
        if (episode === ep && ep.open === 0) close(ep);
      }, mergeGap);
    }

    // A fetch failed for good. Shows the error now and resolves with the
    // player's answer: 'retry' (the caller fetches again, guest still parked)
    // or 'quit'.
    function fail(token, error) {
      const ep = episode;
      stats.failures++;
      if (!ep || ep.token !== token) return Promise.resolve('quit');
      const message = String(error && error.message || error || '');
      const http = message.match(/\b(?:answered|HTTP) (\d{3})\b/);
      ep.failure = {
        reason: http ? `the server answered HTTP ${http[1]}`
          : (typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'you are offline' : 'the network request failed'),
      };
      if (ep.revealTimer != null) { clearTimer(ep.revealTimer); ep.revealTimer = null; }
      if (ep.visible) render(ep); else reveal(ep);
      return new Promise(resolve => { ep.resolveActions.push(resolve); });
    }

    // The view's buttons.
    function action(name) {
      const ep = episode;
      if (!ep || !ep.resolveActions.length || !['retry', 'quit'].includes(name)) return;
      const answers = ep.resolveActions.splice(0);
      if (name === 'retry') {
        ep.failure = null;
        render(ep);
        for (const resolve of answers) resolve('retry');
      } else if (name === 'quit') {
        close(ep);
        for (const resolve of answers) resolve('quit');
      }
    }

    // The instance is going away: drop any window, answer any open question.
    function reset() {
      const ep = episode;
      if (!ep) { if (view && view.destroy) view.destroy(); return; }
      const answers = ep.resolveActions.splice(0);
      close(ep);
      for (const resolve of answers) resolve('quit');
      if (view && view.destroy) view.destroy();
    }

    return {
      begin, progress, end, fail, action, reset,
      setView(v) { view = v; },
      get visible() { return !!(episode && episode.visible); },
      get current() { return episode ? model(episode) : null; },
      stats,
    };
  }

  // A small Win98 dialog anchored over the game (opts.anchor() -> DOMRect or
  // null for the page centre), built from the launch window's classes.
  function createDomView(doc, opts = {}) {
    let el = null;
    let parts = null;
    const act = name => { if (opts.onAction) opts.onAction(name); };
    function build() {
      if (el) return;
      el = doc.createElement('div');
      el.className = 'wa-launch wa-game-wait';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-live', 'polite');
      el.dataset.winePageDialog = '1';
      el.hidden = true;
      el.innerHTML =
        '<div class="wa-launch-titlebar"><span class="wa-launch-titletext"></span></div>' +
        '<div class="wa-launch-body">' +
          '<div class="wa-launch-heading"></div>' +
          '<div class="wa-launch-bar" role="progressbar"><div class="wa-launch-fill"></div></div>' +
          '<div class="wa-launch-status"></div>' +
          '<div class="wa-launch-status wa-game-wait-note"></div>' +
          '<div class="wa-launch-foot">' +
            '<button type="button" class="wa-launch-btn wa-game-wait-quit">Quit game</button>' +
            '<button type="button" class="wa-launch-btn wa-launch-default wa-game-wait-retry">Retry</button>' +
          '</div>' +
        '</div>';
      const q = sel => el.querySelector(sel);
      parts = {
        title: q('.wa-launch-titletext'), heading: q('.wa-launch-heading'), bar: q('.wa-launch-bar'),
        fill: q('.wa-launch-fill'), status: q('.wa-launch-status'), foot: q('.wa-game-wait-note'),
        quit: q('.wa-game-wait-quit'), retry: q('.wa-game-wait-retry'),
      };
      parts.quit.addEventListener('click', () => act('quit'));
      parts.retry.addEventListener('click', () => act('retry'));
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
      });
      (opts.parent || doc.body).appendChild(el);
    }
    function place() {
      const r = opts.anchor ? opts.anchor() : null;
      el.style.left = r ? `${Math.round(r.left + r.width / 2)}px` : '50%';
      el.style.top = r ? `${Math.round(r.top + r.height / 2)}px` : '50%';
      el.style.transform = 'translate(-50%, -50%)';
    }
    function render(m) {
      const error = m.state === 'error';
      parts.title.textContent = `${m.label} — ${error ? 'Download problem' : 'Loading'}`;
      parts.heading.textContent = error
        ? `${m.label} couldn't load game data${m.file ? ` (${m.file})` : ''}: ${m.reason}.`
        : `${m.label} needs more game data to continue.`;
      const known = m.total != null && m.total > 0;
      parts.bar.hidden = error;
      parts.bar.classList.toggle('wa-launch-indeterminate', !known);
      parts.fill.style.width = known ? `${Math.min(100, Math.round(100 * m.loaded / m.total))}%` : '';
      parts.status.textContent = error ? '' : `Loading: ${m.file || 'game data'}${m.bytesText ? ` — ${m.bytesText}` : ''}`;
      parts.foot.textContent = error
        ? 'Waiting for game data. Retry to continue loading.'
        : 'Loading will continue automatically.';
      parts.retry.hidden = !error;
      parts.quit.hidden = !error;
    }
    return {
      show(m) { build(); render(m); place(); el.hidden = false; if (m.state === 'error') parts.retry.focus(); },
      render(m) { if (el) { render(m); if (m.state === 'error' && !el.hidden) parts.retry.focus(); } },
      hide() { if (el) el.hidden = true; },
      destroy() { if (el) el.remove(); el = null; parts = null; },
      get element() { return el; },
    };
  }

  const api = { REVEAL_DELAY_MS, MERGE_GAP_MS, createGameWaitController, createDomView, formatBytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GameWait = api;
})(typeof window !== 'undefined' ? window : null);
