// The launch progress window: a classic Win98 "File Download" dialog that
// appears only when a launch is still pending 500ms after the user asked for
// it (ops/handoffs/claude-launch-ux-design-20261003.md, sections 3R and 3D).
//
// Two halves. createLaunchController is pure state -- clock, timers and view
// are injected -- so test/test-launch-progress.js can drive the reveal
// deadline and the honest-progress rules with a fake clock. createDomView is
// the window itself. The browser build wires one of each as
// window.wineLaunchUi, and a direct ?app= link starts its launch here, before
// the rest of the runtime has loaded, so a slow cold load still gets a window
// at 500ms.
//
// Honesty rules the model enforces rather than the view:
//   - a percentage, a filled bar or "x of y copied" only when every file of
//     the current download batch has started and reported its size;
//   - a transfer rate only from bytes not known to be cached, after 2s;
//   - a time estimate only when both of those hold;
//   - "from cache" only when the transfer itself said so.
(function (root) {
  'use strict';

  const REVEAL_DELAY_MS = 500;
  const SLOW_MS = 8000;
  const RATE_MIN_MS = 2000;
  const RATE_WINDOW_MS = 4000;
  const TICK_MS = 1000;

  function formatBytes(n) {
    n = Math.max(0, Number(n) || 0);
    if (n < 1024) return `${n} bytes`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatRate(bytesPerSec) {
    if (bytesPerSec < 1024 * 1024) return `${Math.max(1, Math.round(bytesPerSec / 1024))} KB/Sec`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/Sec`;
  }

  function formatDuration(sec) {
    sec = Math.max(1, Math.ceil(sec));
    if (sec < 60) return `${sec} sec`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m} min ${s} sec` : `${m} min`;
  }

  function formatElapsed(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function fileNameOf(url) {
    const raw = String(url || '').split(/[?#]/, 1)[0].split('/').pop() || String(url || '');
    try { return decodeURIComponent(raw); } catch (_) { return raw; }
  }

  function createLaunchController(opts = {}) {
    const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = opts.clearTimer || (id => clearTimeout(id));
    const revealDelay = opts.revealDelayMs == null ? REVEAL_DELAY_MS : opts.revealDelayMs;
    const host = opts.host || '';
    let view = opts.view || null;
    let seq = 0;
    let current = null;
    // The launch whose content the view is showing (null when hidden).
    let onScreen = null;

    function render(launch) {
      if (!view || onScreen !== launch) return;
      view.render(launch.model());
    }

    function show(launch) {
      const wasHidden = !onScreen;
      onScreen = launch;
      launch.visible = true;
      if (view) {
        if (wasHidden) view.show(launch.model());
        else view.render(launch.model());
      }
      scheduleTick(launch);
    }

    function hide(launch) {
      if (onScreen !== launch) return;
      onScreen = null;
      launch.visible = false;
      if (view) view.hide();
    }

    function scheduleTick(launch) {
      if (launch.tick != null) return;
      launch.tick = setTimer(() => {
        launch.tick = null;
        if (onScreen !== launch) return;
        render(launch);
        if (launch.status === 'pending') scheduleTick(launch);
      }, TICK_MS);
    }

    function clearTimers(launch) {
      if (launch.timer != null) { clearTimer(launch.timer); launch.timer = null; }
      if (launch.tick != null) { clearTimer(launch.tick); launch.tick = null; }
    }

    function begin(info = {}) {
      const previous = current;
      const launch = {
        token: ++seq,
        appId: info.appId || '',
        label: info.label || info.appId || 'Program',
        iconUrl: info.iconUrl || '',
        mode: info.mode === 'direct' ? 'direct' : 'desktop',
        windowed: info.windowed !== false && info.mode !== 'direct',
        startedAt: info.startedAt == null ? now() : info.startedAt,
        status: 'pending',
        phase: 'preparing',
        visible: false,
        promptDepth: 0,
        revealDue: false,
        retrying: false,
        timer: null,
        tick: null,
        batches: [],
        transfers: new Map(),
        transferSeq: 0,
        net: { samples: [], firstAt: null },
        lastByteAt: null,
        error: null,
        handlers: info.handlers || {},
        lastAnnounce: '',
      };
      launch.revealAt = launch.startedAt + revealDelay;
      Object.assign(launch, launchMethods(launch));
      current = launch;
      if (previous && previous.status === 'pending') {
        previous.status = 'superseded';
        clearTimers(previous);
      }
      // A Retry from a visible error window keeps that window up, saying
      // "Retrying...", rather than taking it down and putting it back.
      if (onScreen && onScreen !== launch) {
        const old = onScreen;
        clearTimers(old);
        if (info.retryOf && info.retryOf === old) {
          launch.retrying = true;
          launch.retryModel = old.model();
          onScreen = launch;
          launch.visible = true;
          render(launch);
        } else {
          hide(old);
        }
      }
      const delay = Math.max(0, launch.revealAt - now());
      launch.timer = setTimer(() => {
        launch.timer = null;
        // The fire is a re-check, never a command: a launch that finished,
        // failed, was cancelled or was replaced must not reopen anything.
        if (current !== launch || launch.status !== 'pending') return;
        if (launch.promptDepth > 0) { launch.revealDue = true; return; }
        reveal(launch);
      }, delay);
      return launch;
    }

    function reveal(launch) {
      launch.retrying = false;
      launch.retryModel = null;
      launch.revealed = true;
      show(launch);
    }

    function launchMethods(launch) {
      const live = () => current === launch && launch.status === 'pending';
      const changed = () => { if (live()) render(launch); };
      return {
        setInfo(info = {}) {
          if (info.label) launch.label = info.label;
          if (info.iconUrl) launch.iconUrl = info.iconUrl;
          if (info.handlers) Object.assign(launch.handlers, info.handlers);
          if (info.windowed != null) launch.windowed = !!info.windowed && launch.mode !== 'direct';
          changed();
        },
        setPhase(phase) {
          if (!live() || launch.phase === phase) return;
          launch.phase = phase;
          changed();
        },
        beginBatch(label, expected) {
          if (!live()) return null;
          const batch = {
            label: String(label || launch.label),
            expected: Number.isFinite(expected) ? expected : null,
            ids: [],
            maxPercent: 0,
          };
          launch.batches.push(batch);
          launch.phase = 'downloading';
          launch.net = { samples: [], firstAt: null };
          changed();
          return batch;
        },
        // {kind:'start'|'progress'|'done'|'error', id, url, loaded, total, source}
        transfer(evt) {
          if (!evt || !live()) return;
          const t0 = now();
          let t = launch.transfers.get(evt.id);
          if (evt.kind === 'start' && t && t.state === 'failed') {
            // The same file, attempted again (host.js loadFiles retries).
            t.state = 'active';
            t.loaded = 0;
            t.total = evt.total == null ? null : evt.total;
            t.reason = null;
            launch.lastByteAt = t0;
            changed();
            return;
          }
          if (evt.kind === 'start' || !t) {
            if (t) {
              if (evt.total != null && t.total == null && t.loaded === 0) { t.total = evt.total; changed(); }
              return;
            }
            const batch = launch.batches[launch.batches.length - 1] || this.beginBatch(launch.label, null);
            t = {
              id: evt.id, url: evt.url, name: fileNameOf(evt.url),
              loaded: 0, total: evt.total == null ? null : evt.total,
              state: 'active', source: null, batch, order: ++launch.transferSeq,
            };
            launch.transfers.set(evt.id, t);
            batch.ids.push(evt.id);
            launch.lastByteAt = t0;
          }
          if (evt.total !== undefined && evt.kind !== 'start') t.total = evt.total == null ? null : evt.total;
          if (Number.isFinite(evt.loaded) && evt.loaded > t.loaded) {
            const gained = evt.loaded - t.loaded;
            t.loaded = evt.loaded;
            launch.lastByteAt = t0;
            if (evt.source !== 'cache' && evt.source !== 'kept') {
              const net = launch.net;
              if (net.firstAt == null) net.firstAt = t0;
              const last = net.samples.length ? net.samples[net.samples.length - 1][1] : 0;
              net.samples.push([t0, last + gained]);
              while (net.samples.length > 2 && t0 - net.samples[0][0] > RATE_WINDOW_MS) net.samples.shift();
            }
          }
          if (evt.kind === 'done') {
            t.state = 'done';
            // null: the page could not tell whether the cache answered.
            t.source = evt.source || null;
            if (t.total == null || t.total < t.loaded) t.total = t.loaded;
            // Bytes the browser cache answered are not a network rate; start
            // the rate window over from the next genuinely transferred byte.
            if (t.source === 'cache' || t.source === 'kept') launch.net = { samples: [], firstAt: null };
          } else if (evt.kind === 'error') {
            t.state = 'failed';
            t.reason = evt.reason || 'failed';
          }
          changed();
        },
        promptOpen() {
          if (!live()) return;
          launch.promptDepth++;
        },
        promptClose() {
          if (!live() || launch.promptDepth <= 0) return;
          launch.promptDepth--;
          if (launch.promptDepth === 0 && (!launch.visible || launch.retrying) &&
              (launch.revealDue || now() >= launch.revealAt)) {
            launch.revealDue = false;
            reveal(launch);
          }
        },
        ready() {
          if (!live()) return;
          launch.status = 'ready';
          clearTimers(launch);
          hide(launch);
        },
        // A failure the user can act on (a download). Shown at once, whether
        // or not the 500ms has passed: there is no loading window first.
        fail(error) {
          if (!live()) return;
          launch.status = 'failed';
          launch.error = error || { message: 'The program could not be started.' };
          clearTimers(launch);
          launch.revealed = true;
          show(launch);
        },
        // A failure reported elsewhere (the crash report) or a launch that
        // ended without anything to show: go away without a word.
        dismiss() {
          // Only a launch still waiting can be dismissed; an error or a
          // "cancelled" card on screen stays until the visitor answers it.
          if (current !== launch || launch.status !== 'pending') return;
          launch.status = 'dismissed';
          clearTimers(launch);
          hide(launch);
        },
        cancelled() {
          if (current !== launch || (launch.status !== 'pending' && launch.status !== 'cancelling')) return;
          launch.status = 'cancelled';
          clearTimers(launch);
          // A direct link has no desktop to fall back to, so it says what
          // happened and offers both ways on. Elsewhere the window just goes.
          if (launch.mode === 'direct') { launch.revealed = true; show(launch); }
          else hide(launch);
        },
        requestCancel() {
          if (!live()) return;
          if (launch.handlers.cancel) launch.handlers.cancel();
          else this.cancelled();
        },
        close() {
          if (current === launch && launch.status === 'pending') return;
          clearTimers(launch);
          hide(launch);
          if (current === launch) launch.status = launch.status === 'pending' ? 'closed' : launch.status;
        },
        model() { return buildModel(launch, now(), host); },
      };
    }

    return {
      begin,
      get current() { return current; },
      get onScreen() { return onScreen; },
      setView(next) { view = next; },
      focus() {
        if (onScreen && view && view.focus) view.focus();
        return !!onScreen;
      },
      // UI events from the view, routed to whichever launch is on screen.
      action(name) {
        const launch = onScreen;
        if (!launch) return;
        const h = launch.handlers;
        if (name === 'cancel') {
          if (launch.status === 'pending') launch.requestCancel();
          else launch.close();
        } else if (name === 'retry') {
          if (h.retry) h.retry(launch); else launch.close();
        } else if (name === 'close') {
          launch.close();
          if (h.closed) h.closed(launch);
        } else if (name === 'desktop') {
          launch.close();
          if (h.showDesktop) h.showDesktop(launch);
        } else if (name === 'again') {
          launch.close();
          if (h.again) h.again(launch);
        }
      },
    };
  }

  function batchStats(launch, batch) {
    const items = batch.ids.map(id => launch.transfers.get(id)).filter(Boolean);
    let loaded = 0, total = 0, sizesKnown = true, cached = 0;
    for (const t of items) {
      loaded += t.loaded;
      if (t.total == null) sizesKnown = false;
      else total += t.total;
      if (t.state === 'done' && (t.source === 'cache' || t.source === 'kept')) cached++;
    }
    const allStarted = batch.expected != null && items.length >= batch.expected;
    const determinate = allStarted && sizesKnown && total > 0 && loaded <= total;
    let percent = null;
    if (determinate) {
      percent = Math.min(100, Math.floor(loaded * 100 / total));
      // Never backwards inside one batch.
      batch.maxPercent = Math.max(batch.maxPercent, percent);
      percent = batch.maxPercent;
    }
    const active = items.filter(t => t.state === 'active').sort((a, b) => b.order - a.order);
    return { items, loaded, total, determinate, percent, cached, active };
  }

  function networkRate(launch, t) {
    const net = launch.net;
    if (net.firstAt == null || t - net.firstAt < RATE_MIN_MS || net.samples.length < 2) return null;
    const first = net.samples[0];
    const last = net.samples[net.samples.length - 1];
    const span = Math.max(t, last[0]) - first[0];
    if (span < 1000) return null;
    const bytes = last[1] - first[1];
    return bytes > 0 ? bytes * 1000 / span : null;
  }

  function overallSummary(launch) {
    let files = 0, bytes = 0, cached = 0;
    for (const t of launch.transfers.values()) {
      if (t.state !== 'done') continue;
      files++;
      bytes += t.loaded;
      if (t.source === 'cache' || t.source === 'kept') cached++;
    }
    if (!files) return null;
    return `${files} file${files === 1 ? '' : 's'}, ${formatBytes(bytes)}` +
      (cached ? ` (${cached} from cache)` : '');
  }

  // The Details list is a fixed number of rows, never a scrolling list: a
  // launch mounts up to thousands of files (Atlantis 2916), and the window
  // must fit a landscape phone without a scrollbar. Shown: failures first,
  // then files still loading, then the most recently finished; one summary
  // row stands for the rest.
  const DETAILS_MAX_ROWS = 6;

  function detailRows(launch) {
    const all = [...launch.transfers.values()].sort((a, b) => a.order - b.order);
    const row = t => {
      let status;
      if (t.state === 'failed') status = 'Failed';
      else if (t.state === 'done') status = t.source === 'cache' ? 'From cache'
        : t.source === 'kept' ? 'Kept' : 'Done';
      else if (t.total) status = `${Math.min(99, Math.floor(t.loaded * 100 / t.total))}%`;
      else status = t.loaded ? formatBytes(t.loaded) : 'Waiting';
      return { name: t.name, size: t.total == null ? '?' : formatBytes(t.total), status };
    };
    if (all.length <= DETAILS_MAX_ROWS) return all.map(row);
    const failed = all.filter(t => t.state === 'failed');
    const active = all.filter(t => t.state !== 'failed' && t.state !== 'done');
    const done = all.filter(t => t.state === 'done');
    const picked = [...failed, ...active, ...done.slice().reverse()].slice(0, DETAILS_MAX_ROWS - 1);
    const shown = new Set(picked);
    const rest = all.filter(t => !shown.has(t));
    const restDone = rest.filter(t => t.state === 'done').length;
    return [
      ...all.filter(t => shown.has(t)).map(row),
      { name: `${rest.length} more file${rest.length === 1 ? '' : 's'}`, size: '',
        status: `${restDone} done`, summary: true },
    ];
  }

  function buildModel(launch, t, host) {
    const label = launch.label;
    const elapsed = formatElapsed(t - launch.startedAt);
    const base = {
      token: launch.token,
      mode: launch.mode,
      windowed: launch.windowed,
      iconUrl: launch.iconUrl,
      appLabel: label,
      details: detailRows(launch),
      rows: [],
      status: [],
      saving: null,
      bar: null,
    };
    if (launch.status === 'pending' && launch.retrying && launch.retryModel) {
      return Object.assign({}, launch.retryModel, {
        token: launch.token,
        status: ['Retrying…'],
        buttons: [{ id: 'cancel', label: 'Cancel', primary: true }],
        announce: `Retrying ${label}`,
      });
    }
    if (launch.status === 'failed') {
      const e = launch.error || {};
      const lines = [];
      if (e.file) {
        lines.push(`${e.file}: ${e.reason || 'download failed'}` +
          (e.attempts > 1 ? ` after ${e.attempts} attempts.` : '.'));
      } else if (e.message) {
        lines.push(e.message);
      }
      const done = [...launch.transfers.values()].filter(x => x.state === 'done').length;
      const known = launch.transfers.size;
      if (done && e.retryKeeps !== false) {
        lines.push(`${done} of ${Math.max(known, e.totalFiles || 0)} files are already saved and will be kept for Retry.`);
      }
      return Object.assign(base, {
        kind: 'error',
        title: e.title || 'Download error',
        art: 'error',
        heading: e.heading || `${label} could not be downloaded.`,
        status: lines,
        buttons: [
          { id: 'details', label: 'Details >>' },
          launch.mode === 'direct'
            ? { id: 'desktop', label: 'Show desktop' }
            : { id: 'close', label: 'Close' },
          ...(e.retry === false ? [] : [{ id: 'retry', label: 'Retry', primary: true }]),
        ],
        announce: `Download error. ${e.heading || `${label} could not be downloaded.`} ${lines[0] || ''}`.trim(),
      });
    }
    if (launch.status === 'cancelled') {
      return Object.assign(base, {
        kind: 'cancelled',
        title: label,
        art: 'start',
        heading: `Starting ${label} was cancelled.`,
        status: [],
        buttons: [
          { id: 'desktop', label: 'Show desktop' },
          { id: 'again', label: 'Start again', primary: true },
        ],
        announce: `Starting ${label} was cancelled.`,
      });
    }
    const buttons = [{ id: 'details', label: 'Details >>' }, { id: 'cancel', label: 'Cancel', primary: true }];
    const summary = overallSummary(launch);
    if (launch.phase === 'downloading' && launch.batches.length) {
      const batch = launch.batches[launch.batches.length - 1];
      const s = batchStats(launch, batch);
      const rate = networkRate(launch, t);
      const stalled = s.active.length > 0 && launch.lastByteAt != null && t - launch.lastByteAt >= SLOW_MS;
      const rows = [];
      if (s.determinate) {
        const copied = `${formatBytes(s.loaded)} of ${formatBytes(s.total)} copied`;
        rows.push(['Estimated time left:', rate && !stalled
          ? `${formatDuration((s.total - s.loaded) / rate)} (${copied})`
          : `Not known (${copied})`]);
      } else {
        rows.push(['Estimated time left:', `Not known (${formatBytes(s.loaded)} copied)`]);
      }
      if (s.active.length) {
        const cur = s.active[0];
        rows.push(['Now saving:', cur.total == null ? `${cur.name} — size not reported by server` : cur.name]);
      }
      if (stalled) {
        rows.push(['Transfer rate:', `Waiting — no data for ${Math.floor((t - launch.lastByteAt) / 1000)} sec`]);
      } else if (rate) {
        rows.push(['Transfer rate:', formatRate(rate)]);
      }
      if (s.cached) rows.push(['From cache:', `${s.cached} of ${s.items.length} files`]);
      return Object.assign(base, {
        kind: 'progress',
        title: s.determinate ? `${s.percent}% of ${batch.label}` : `Downloading ${label}`,
        art: 'download',
        saving: `${batch.label}${host ? ` from ${host}` : ''}`,
        bar: s.determinate ? { determinate: true, percent: s.percent } : { determinate: false },
        rows,
        status: stalled ? [`Waiting for ${s.active[0].name} — the network is slow.`] : [],
        buttons,
        announce: `Downloading ${label}`,
      });
    }
    if (launch.phase === 'loading' || launch.phase === 'starting') {
      const starting = launch.phase === 'starting';
      return Object.assign(base, {
        kind: 'progress',
        title: `Starting ${label}`,
        art: 'start',
        status: starting
          ? [`Starting ${label}…`, `Waiting for the program's first window (${elapsed} elapsed).`]
          : ['Loading program…', `${elapsed} elapsed`],
        rows: summary ? [['Downloaded:', summary]] : [],
        buttons,
        announce: `Starting ${label}`,
      });
    }
    return Object.assign(base, {
      kind: 'progress',
      title: `Preparing ${label}`,
      art: 'start',
      status: ['Preparing emulator…', `${elapsed} elapsed`],
      rows: summary ? [['Downloaded:', summary]] : [],
      buttons,
      announce: `Preparing ${label}`,
    });
  }

  // ---------------------------------------------------------------- DOM view

  const ART = {
    download: '<svg viewBox="0 0 260 44" width="100%" height="44" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<g transform="translate(4,4)"><circle cx="18" cy="18" r="17" fill="#2a6ad8" stroke="#000"/>' +
      '<path d="M6 10c5 3 9-2 12 2s-3 8 2 10 6-4 10 0M8 26c4-2 6 2 10 1" fill="none" stroke="#3ab53a" stroke-width="4"/>' +
      '<ellipse cx="18" cy="18" rx="8" ry="17" fill="none" stroke="#bcd" stroke-width=".8"/></g>' +
      '<path d="M44 26 Q130 2 214 26" fill="none" stroke="#000" stroke-dasharray="2 3"/>' +
      '<g class="wa-launch-page"><path d="M0 0h11l4 4v16H0z" fill="#fff" stroke="#000"/>' +
      '<path d="M3 6h9M3 9h9M3 12h9M3 15h6" stroke="#808080"/></g>' +
      '<g transform="translate(218,8)"><path d="M0 4h12l3 3h21v25H0z" fill="#e8c840" stroke="#000"/>' +
      '<path d="M0 11h36v21H0z" fill="#ffe680" stroke="#000"/></g></svg>',
    start: '<svg viewBox="0 0 260 44" width="100%" height="44" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<g transform="translate(4,8)"><path d="M0 4h12l3 3h21v25H0z" fill="#e8c840" stroke="#000"/>' +
      '<path d="M0 11h36v21H0z" fill="#ffe680" stroke="#000"/></g>' +
      '<path d="M44 26 Q130 2 214 26" fill="none" stroke="#000" stroke-dasharray="2 3"/>' +
      '<g class="wa-launch-page"><path d="M0 0h11l4 4v16H0z" fill="#fff" stroke="#000"/>' +
      '<path d="M3 6h9M3 9h9M3 12h9M3 15h6" stroke="#808080"/></g>' +
      '<g transform="translate(216,2)"><rect width="38" height="28" fill="#c0c0c0" stroke="#000"/>' +
      '<rect x="4" y="4" width="30" height="20" fill="#008080" stroke="#404040"/>' +
      '<rect x="12" y="30" width="14" height="4" fill="#808080" stroke="#000"/>' +
      '<rect x="4" y="34" width="30" height="5" fill="#c0c0c0" stroke="#000"/>' +
      '<path d="M14 7h10M14 21h10M15 7c0 5 8 5 8 7s-8 2-8 7M23 7c0 5-8 5-8 7s8 2 8 7" fill="none" stroke="#fff" stroke-width="1.4"/></g></svg>',
    error: '',
  };

  function createDomView(doc, opts = {}) {
    let el = null;
    let parts = null;
    let lastModel = null;
    let detailsOpen = false;
    let pending = null;
    let lastAnnounce = '';
    let taskBtn = null;
    let minimized = false;
    let dragged = false;
    const act = name => { if (opts.onAction) opts.onAction(name); };

    function build() {
      if (el) return;
      el = doc.createElement('div');
      el.id = 'wine-launch-window';
      el.className = 'wa-launch';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-labelledby', 'wine-launch-title');
      el.setAttribute('aria-describedby', 'wine-launch-body');
      el.dataset.winePageDialog = '1';
      el.hidden = true;
      el.innerHTML =
        '<div class="wa-launch-titlebar">' +
          '<img class="wa-launch-ico" alt="" width="16" height="16">' +
          '<span id="wine-launch-title" class="wa-launch-titletext"></span>' +
          '<span class="wa-launch-tbtns">' +
            '<button type="button" class="wa-launch-tb wa-launch-min" aria-label="Minimize">_</button>' +
            '<button type="button" class="wa-launch-tb wa-launch-x" aria-label="Close">✕</button>' +
          '</span>' +
        '</div>' +
        '<div class="wa-launch-body" id="wine-launch-body">' +
          '<div class="wa-launch-art"></div>' +
          '<div class="wa-launch-err"><div class="wa-launch-erricon" aria-hidden="true">✕</div>' +
            '<div class="wa-launch-heading"></div></div>' +
          '<div class="wa-launch-saving"><div>Saving:</div><div class="wa-launch-savingtext"></div></div>' +
          '<div class="wa-launch-bar" role="progressbar" aria-label="Download progress"><div class="wa-launch-fill"></div></div>' +
          '<div class="wa-launch-status"></div>' +
          '<div class="wa-launch-grid"></div>' +
          '<div class="wa-launch-foot"></div>' +
          '<div class="wa-launch-details" hidden><table><thead><tr><th>Name</th><th>Size</th><th>Status</th></tr></thead><tbody></tbody></table></div>' +
        '</div>' +
        '<div class="wa-launch-live" aria-live="polite" aria-atomic="true"></div>';
      const q = sel => el.querySelector(sel);
      parts = {
        icon: q('.wa-launch-ico'), title: q('.wa-launch-titletext'), min: q('.wa-launch-min'),
        x: q('.wa-launch-x'), art: q('.wa-launch-art'), err: q('.wa-launch-err'),
        heading: q('.wa-launch-heading'), saving: q('.wa-launch-saving'),
        savingText: q('.wa-launch-savingtext'), bar: q('.wa-launch-bar'), fill: q('.wa-launch-fill'),
        status: q('.wa-launch-status'), grid: q('.wa-launch-grid'), foot: q('.wa-launch-foot'),
        details: q('.wa-launch-details'), tbody: q('tbody'), live: q('.wa-launch-live'),
        titlebar: q('.wa-launch-titlebar'),
      };
      parts.icon.addEventListener('error', () => { parts.icon.style.visibility = 'hidden'; });
      parts.x.addEventListener('click', () => act(lastModel && lastModel.kind === 'progress' ? 'cancel' : 'close'));
      parts.min.addEventListener('click', () => setMinimized(true));
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          act(lastModel && lastModel.kind === 'progress' ? 'cancel' : (lastModel && lastModel.mode === 'direct' ? 'desktop' : 'close'));
        }
      });
      wireDrag();
      (opts.parent || doc.body).appendChild(el);
    }

    function wireDrag() {
      let drag = null;
      parts.titlebar.addEventListener('pointerdown', e => {
        if (!lastModel || !lastModel.windowed || e.button !== 0 || e.target.closest('button')) return;
        const r = el.getBoundingClientRect();
        drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
        try { parts.titlebar.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
      });
      parts.titlebar.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const vw = doc.documentElement.clientWidth;
        const vh = doc.documentElement.clientHeight;
        const x = Math.min(Math.max(0, e.clientX - drag.dx), Math.max(0, vw - el.offsetWidth));
        const y = Math.min(Math.max(0, e.clientY - drag.dy), Math.max(0, vh - 24));
        el.style.left = Math.round(x) + 'px';
        el.style.top = Math.round(y) + 'px';
        el.style.transform = 'none';
        dragged = true;
      });
      const end = e => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        try { parts.titlebar.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      parts.titlebar.addEventListener('pointerup', end);
      parts.titlebar.addEventListener('pointercancel', end);
    }

    function setMinimized(on) {
      minimized = !!on;
      if (!el) return;
      el.classList.toggle('wa-launch-minimized', minimized);
      if (taskBtn) taskBtn.classList.toggle('active', !minimized);
    }

    function syncTaskButton(model) {
      const host = doc.getElementById('launch-task-buttons');
      if (!model || !model.windowed || !host) {
        if (taskBtn) { taskBtn.remove(); taskBtn = null; }
        return;
      }
      if (!taskBtn) {
        taskBtn = doc.createElement('button');
        taskBtn.type = 'button';
        taskBtn.className = 'task-btn launch-task-btn active';
        taskBtn.addEventListener('click', () => {
          if (minimized) setMinimized(false);
          else if (el && el.contains(doc.activeElement)) setMinimized(true);
          else focus();
        });
        host.appendChild(taskBtn);
      }
      taskBtn.textContent = model.title;
      taskBtn.title = model.title;
    }

    function button(spec) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'wa-launch-btn' + (spec.primary ? ' wa-launch-default' : '');
      b.dataset.action = spec.id;
      b.textContent = spec.id === 'details' ? (detailsOpen ? '<< Details' : 'Details >>') : spec.label;
      if (spec.id === 'details') b.setAttribute('aria-expanded', detailsOpen ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (spec.id === 'details') {
          detailsOpen = !detailsOpen;
          paint(lastModel);
          const again = parts.foot.querySelector('[data-action="details"]');
          if (again) again.focus();
          return;
        }
        act(spec.id);
      });
      return b;
    }

    function paint(m) {
      if (!el || !m) return;
      // Whatever was queued for the next frame is older than this; it must
      // not land afterwards and put a progress model back over an error.
      pending = null;
      lastModel = m;
      el.classList.toggle('wa-launch-direct', m.mode === 'direct');
      el.classList.toggle('wa-launch-windowed', !!m.windowed);
      el.classList.toggle('wa-launch-error', m.kind === 'error');
      el.setAttribute('aria-modal', m.windowed ? 'false' : 'true');
      parts.min.hidden = !m.windowed;
      parts.x.setAttribute('aria-label', m.kind === 'progress' ? 'Cancel' : 'Close');
      if (m.iconUrl && parts.icon.getAttribute('src') !== m.iconUrl) {
        parts.icon.style.visibility = '';
        parts.icon.src = m.iconUrl;
      }
      parts.title.textContent = m.title;
      if (parts.art.dataset.kind !== m.art) {
        parts.art.innerHTML = ART[m.art] || '';
        parts.art.dataset.kind = m.art;
      }
      parts.art.hidden = !ART[m.art];
      parts.err.hidden = m.kind !== 'error' && m.kind !== 'cancelled';
      parts.err.classList.toggle('wa-launch-noicon', m.kind === 'cancelled');
      parts.heading.textContent = m.heading || '';
      parts.saving.hidden = !m.saving;
      parts.savingText.textContent = m.saving || '';
      if (m.bar) {
        parts.bar.hidden = false;
        parts.bar.classList.toggle('wa-launch-indeterminate', !m.bar.determinate);
        if (m.bar.determinate) {
          parts.fill.style.width = m.bar.percent + '%';
          parts.bar.setAttribute('aria-valuemin', '0');
          parts.bar.setAttribute('aria-valuemax', '100');
          parts.bar.setAttribute('aria-valuenow', String(m.bar.percent));
          parts.bar.removeAttribute('aria-valuetext');
        } else {
          parts.fill.style.width = '';
          parts.bar.removeAttribute('aria-valuemin');
          parts.bar.removeAttribute('aria-valuemax');
          parts.bar.removeAttribute('aria-valuenow');
          const copied = m.rows.find(r => r[0] === 'Estimated time left:');
          parts.bar.setAttribute('aria-valuetext', copied ? copied[1] : 'Size not known');
        }
      } else {
        parts.bar.hidden = true;
      }
      parts.status.replaceChildren(...m.status.map(line => {
        const d = doc.createElement('div');
        d.textContent = line;
        return d;
      }));
      parts.grid.replaceChildren(...m.rows.flatMap(([k, v]) => {
        const a = doc.createElement('span');
        a.textContent = k;
        const b = doc.createElement('span');
        b.textContent = v;
        return [a, b];
      }));
      // Rebuild the buttons only when the set changes. Progress repaints
      // many times a second, and a button replaced between a press and its
      // release swallows the click.
      const buttonsKey = m.buttons.map(b => `${b.id}:${b.label}:${b.primary ? 1 : 0}`).join('|') +
        `|${detailsOpen}`;
      if (buttonsKey !== parts.buttonsKey) {
        parts.buttonsKey = buttonsKey;
        const hadFocus = el.contains(doc.activeElement) && doc.activeElement.dataset
          ? doc.activeElement.dataset.action : null;
        parts.foot.replaceChildren(...m.buttons.map(button));
        if (hadFocus) {
          const again = parts.foot.querySelector(`[data-action="${hadFocus}"]`) ||
            parts.foot.querySelector('.wa-launch-default');
          if (again) again.focus();
        }
      }
      parts.details.hidden = !detailsOpen;
      if (detailsOpen) {
        parts.tbody.replaceChildren(...(m.details.length ? m.details : [{ name: 'No files yet', size: '', status: '' }])
          .map(row => {
            const tr = doc.createElement('tr');
            for (const v of [row.name, row.size, row.status]) {
              const td = doc.createElement('td');
              td.textContent = v;
              tr.appendChild(td);
            }
            return tr;
          }));
      }
      if (m.announce && m.announce !== lastAnnounce) {
        lastAnnounce = m.announce;
        parts.live.textContent = m.announce;
      }
      syncTaskButton(m);
    }

    function schedule(m) {
      pending = m;
      if (paint._queued) return;
      paint._queued = true;
      const raf = (doc.defaultView && doc.defaultView.requestAnimationFrame) || (fn => setTimeout(fn, 16));
      raf(() => {
        paint._queued = false;
        if (pending && el && !el.hidden) paint(pending);
        pending = null;
      });
    }

    // A direct link owns the page, so an error or a card puts focus on its
    // default button. Progress never takes the keyboard: the game is often
    // already running behind it (its window is not up yet, or was not
    // recognised), and with Cancel focused the game's own Enter or Esc
    // cancelled the launch -- NFS III did exactly that. Progress buttons are
    // for the mouse and a deliberate Tab. On the desktop the window never
    // takes the keyboard away from an app that is already running there.
    function wantsFocus(m) {
      return !m.windowed && m.kind !== 'progress';
    }

    function focus() {
      if (!el || el.hidden) return;
      setMinimized(false);
      const b = parts.foot.querySelector('.wa-launch-default') || parts.foot.querySelector('button');
      if (b) b.focus({ preventScroll: true });
    }

    return {
      show(m) {
        build();
        detailsOpen = false;
        lastAnnounce = '';
        setMinimized(false);
        if (!dragged) { el.style.left = ''; el.style.top = ''; el.style.transform = ''; }
        el.hidden = false;
        paint(m);
        if (opts.onShow) opts.onShow(m);
        if (wantsFocus(m)) focus();
      },
      render(m) {
        if (!el || el.hidden) { this.show(m); return; }
        const kindChanged = lastModel && lastModel.kind !== m.kind;
        if (kindChanged) {
          paint(m);
          if (wantsFocus(m) || (m.kind !== 'progress' && el.contains(doc.activeElement))) focus();
        } else {
          schedule(m);
        }
      },
      hide() {
        if (!el || el.hidden) return;
        const hadFocus = el.contains(doc.activeElement);
        el.hidden = true;
        pending = null;
        lastModel = null;
        dragged = false;
        syncTaskButton(null);
        parts.live.textContent = '';
        if (opts.onHide) opts.onHide({ hadFocus });
      },
      focus,
      get element() { return el; },
    };
  }

  const api = {
    REVEAL_DELAY_MS,
    SLOW_MS,
    DETAILS_MAX_ROWS,
    createLaunchController,
    createDomView,
    formatBytes,
    formatRate,
    formatDuration,
    fileNameOf,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.LaunchProgress = api;
  if (typeof document === 'undefined') return;
  // The page's one launch window. host is shown as "from <host>".
  const controller = createLaunchController({
    host: (typeof location !== 'undefined' && location.host) || '',
  });
  controller.setView(createDomView(document, {
    onAction: name => controller.action(name),
    onHide: info => {
      if (info.hadFocus && root.wineLaunchUiRestoreFocus) root.wineLaunchUiRestoreFocus();
    },
  }));
  root.wineLaunchUi = controller;
  // A direct ?app= link: index.html's head script recorded the intent at
  // navigation start. The 500ms is counted from there, so it runs now --
  // while the rest of the runtime is still downloading -- not from whenever
  // the shell gets round to launching.
  const intent = root.__wineDirectLaunch;
  if (intent && intent.appId && !intent.launch) {
    const showDesktop = () => {
      const url = new URL(location.href);
      url.searchParams.delete('app');
      url.searchParams.delete('room');
      location.assign(url.href);
    };
    intent.launch = controller.begin({
      appId: intent.appId,
      label: intent.appId,
      mode: 'direct',
      startedAt: intent.startedAt || 0,
      // Runtime scripts can still be downloading. Until the shell adopts
      // this intent, navigation is the usable way out of a cancelled boot.
      handlers: {
        showDesktop,
        closed: showDesktop,
        again: () => location.reload(),
      },
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
