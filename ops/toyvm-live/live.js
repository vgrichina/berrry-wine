'use strict';
// ToyVM live session for one original-DOS corpus title (served at /toyvm/).
// The launch is a small state machine with every effect injected, so the
// rules the user asked for are testable without a browser:
//   - the loading dialog appears only if the launch is still pending after
//     500 ms (a fast launch never flashes it);
//   - progress is bytes received against the manifest's known sizes, so a
//     percentage is shown only where it is real; the runtime script, whose
//     load the page cannot observe, shows elapsed time instead of a guess;
//   - every file is checked against its manifest sha256 before it is mounted;
//   - Cancel aborts every fetch and returns to the start; an error names what
//     failed and offers Retry, which starts the launch again from the start.
// ToyVM reads files whole and synchronously, so every file is downloaded
// before boot; the page says so instead of pretending to stream.
(function (root) {
  const DIALOG_DELAY_MS = 500;
  const CONCURRENCY = 4;

  function formatBytes(n) {
    if (!Number.isFinite(n)) return '?';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  }
  function hex(buf) { return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''); }

  // Manifest paths are relative, slash-separated names. Keep their spelling
  // for mounts, but reject names DOS would alias (including parent file/dir
  // conflicts) before downloading or starting a run.
  function validateMountPaths(files, field = 'path') {
    const names = new Set();
    for (const file of files) {
      const f = { path: field === 'guestPath' ? file.guestPath ?? file.path : file.path };
      if (typeof f.path !== 'string' || /[\\:*?\x00-\x1f]/.test(f.path)) throw new Error('Invalid mounted path: ' + f.path);
      const parts = f.path.split('/');
      if (parts.some(p => !p || p === '.' || p === '..')) throw new Error('Invalid mounted path: ' + f.path);
      const key = parts.map(p => p.toLowerCase().replace(/[ÿ ]/g, '').replace(/\.+$/, ''));
      if (key.some(p => !p) || names.has(key.join('/'))) throw new Error('Ambiguous mounted path: ' + f.path);
      names.add(key.join('/'));
    }
    for (const name of names) {
      const parts = name.split('/');
      while (parts.length > 1) {
        parts.pop();
        if (names.has(parts.join('/'))) throw new Error('File/directory mounted path conflict: ' + name);
      }
    }
  }

  // deps: { fetch, setTimeout, clearTimeout, now, digest(bytes)->Promise<ArrayBuffer>,
  //         loadRuntime(signal)->Promise, start(files)->Promise<run>, ui }
  // ui: { showDialog(), hideDialog(), phase(p), error(e), ready(), running(run), cancelled() }
  function createLauncher(title, deps) {
    let controller = null, timer = null, dialogShown = false, generation = 0, state = 'idle';
    const ui = deps.ui;
    function clearDialog() {
      if (timer !== null) { deps.clearTimeout(timer); timer = null; }
      if (dialogShown) { ui.hideDialog(); dialogShown = false; }
    }
    function finish(next) { state = next; clearDialog(); controller = null; }
    async function fetchFile(f, signal, onBytes) {
      const res = await deps.fetch(f.url, { signal, cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const why = res.status === 401 ? 'Your dashboard session has expired. Sign in again, then retry.' : text || `HTTP ${res.status}`;
        throw Object.assign(new Error(`${f.path}: ${why}`), { status: res.status });
      }
      const chunks = []; let got = 0;
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onBytes(value.length); }
      } else { const buf = new Uint8Array(await res.arrayBuffer()); chunks.push(buf); got = buf.length; onBytes(got); }
      if (got !== f.size) throw new Error(`${f.path}: received ${got} bytes, the manifest says ${f.size}.`);
      const out = new Uint8Array(got); let at = 0;
      for (const c of chunks) { out.set(c, at); at += c.length; }
      return out;
    }
    async function launch() {
      if (state === 'loading' || state === 'running') return;
      const my = ++generation; state = 'loading';
      controller = new AbortController();
      const signal = controller.signal, started = deps.now();
      dialogShown = false;
      timer = deps.setTimeout(() => { timer = null; if (my === generation && state === 'loading') { dialogShown = true; ui.showDialog(); } }, DIALOG_DELAY_MS);
      const files = title.files, total = files.reduce((n, f) => n + f.size, 0);
      let received = 0, done = 0;
      const live = () => my === generation && !signal.aborted;
      try {
        validateMountPaths(files);
        validateMountPaths(files, 'guestPath');
        ui.phase({ id: 'runtime', label: 'Loading the ToyVM runtime', detail: 'about 2 MB; this step cannot report progress', started });
        await deps.loadRuntime(signal);
        if (!live()) return;
        ui.phase({ id: 'download', label: 'Downloading game files', received, total, files: files.length, done, percent: total ? 0 : 100 });
        const bytes = new Array(files.length); let next = 0;
        const worker = async () => {
          while (live() && next < files.length) {
            const i = next++;
            bytes[i] = await fetchFile(files[i], signal, (n) => {
              received += n;
              if (live()) ui.phase({ id: 'download', label: 'Downloading game files', received, total, files: files.length, done, percent: total ? Math.floor(100 * received / total) : 100 });
            });
            done++;
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
        if (!live()) return;
        for (let i = 0; i < files.length; i++) {
          if (!live()) return;
          ui.phase({ id: 'verify', label: 'Checking files against the manifest', done: i, files: files.length, percent: Math.floor(100 * i / files.length) });
          const got = hex(await deps.digest(bytes[i]));
          if (got !== files[i].sha256) throw new Error(`${files[i].path} does not match its manifest sha256; the payload changed. Regenerate the corpus manifest.`);
        }
        if (!live()) return;
        ui.phase({ id: 'boot', label: 'Starting ToyVM' });
        const map = Object.create(null);
        files.forEach((f, i) => { map[f.guestPath ?? f.path] = bytes[i]; });
        const run = await deps.start(map);
        if (!live()) { try { run && run.stop && run.stop(); } catch (_) {} return; }
        finish('running');
        ui.running(run);
        return run;
      } catch (e) {
        if (my !== generation) return;
        if (signal.aborted) { finish('idle'); ui.cancelled(); return; }
        finish('error');
        ui.error({ message: String((e && e.message) || e), status: e && e.status });
      }
    }
    function cancel() {
      if (state !== 'loading') return false;
      generation++; if (controller) controller.abort();
      finish('idle'); ui.cancelled();
      return true;
    }
    return { launch, cancel, retry: launch, get state() { return state; }, get dialogShown() { return dialogShown; } };
  }

  const api = { createLauncher, formatBytes, DIALOG_DELAY_MS, validateMountPaths };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ToyvmLive = api;

  // ---------------------------------------------------------------- page ---
  if (typeof document === 'undefined' || !document.getElementById('toyvm-app')) return;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const id = new URLSearchParams(location.search).get('title') || '';
  let run = null, launcher = null, lastPhase = null, ticker = null;

  function setStatus(text) { $('status').textContent = text; }
  function show(el, on) { el.hidden = !on; }
  function loadScript(src, signal) {
    return new Promise((resolve, reject) => {
      if (root.ToyVM) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('The ToyVM runtime did not load (' + src + ').'));
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
      document.head.appendChild(s);
    });
  }
  function renderPhase(p) {
    lastPhase = p;
    $('phase-label').textContent = p.label;
    const bar = $('phase-bar');
    if (p.id === 'download' || p.id === 'verify') {
      bar.hidden = false; bar.value = p.percent; bar.max = 100; bar.removeAttribute('aria-busy');
      $('phase-detail').textContent = p.id === 'download'
        ? `${formatBytes(p.received)} of ${formatBytes(p.total)} · ${p.done} of ${p.files} files · ${p.percent}%`
        : `${p.done} of ${p.files} files`;
    } else {
      bar.hidden = true;
      const secs = p.started ? Math.round((Date.now() - p.started) / 1000) : 0;
      $('phase-detail').textContent = (p.detail || '') + (secs >= 2 ? ` · ${secs} s` : '');
    }
  }
  function blockedView(t) {
    const facts = t.facts || {};
    const rows = (list) => list.map((b) => `<li><p>${esc(b.text)}</p>${(b.facts || []).map((f) => facts[f] ? `<p class="fact">${esc(facts[f].text)} <span class="cite">${esc(facts[f].cite)}</span></p>` : '').join('')}</li>`).join('');
    return `${t.blockers.length ? `<h2>Why there is no ToyVM session</h2><ul class="reasons">${rows(t.blockers)}</ul>` : ''}`
      + `${t.cautions.length ? `<details><summary>Other limits (${t.cautions.length})</summary><ul class="reasons">${rows(t.cautions)}</ul></details>` : ''}`;
  }

  let keyboardBound = false;
  async function init() {
    $('back').href = '/#dos';
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) { $('title').textContent = 'No title selected'; setStatus('Open a title from the dashboard\'s DOS / ToyVM view.'); return; }
    let t;
    try {
      const res = await fetch('/toyvm/api/title?id=' + encodeURIComponent(id), { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401) throw new Error('Your dashboard session has expired. Sign in again from the dashboard.');
      if (!res.ok) throw new Error((await res.text()) || 'HTTP ' + res.status);
      t = await res.json();
    } catch (e) { $('title').textContent = id; setStatus(String(e.message || e)); return; }
    document.title = t.title + ' · ToyVM';
    $('title').textContent = t.title;
    $('entry').textContent = `${t.entry.program}${t.entry.args ? ' ' + t.entry.args : ''}`;
    $('pill').textContent = t.status === 'reviewed-gameplay' ? 'Reviewed ToyVM route' : t.launchable ? 'Untested on ToyVM' : t.status === 'blocked' ? 'Blocked on ToyVM' : 'Not available';
    $('pill').className = 'pill ' + (t.launchable ? 'warn' : 'bad');
    $('verdict').textContent = t.verdict || t.reason || '';
    $('details').innerHTML = blockedView(t);
    if (!t.launchable) { setStatus(t.reason || 'No session is offered for this title.'); return; }
    const total = t.files.reduce((n, f) => n + f.size, 0);
    $('size').textContent = `${t.files.length} files, ${formatBytes(total)}, all downloaded before boot (ToyVM cannot fetch files on demand). Keyboard only.`;
    show($('start'), true);
    const canvas = $('screen');
    launcher = createLauncher(t, {
      fetch: (u, o) => fetch(u, o), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h), now: () => Date.now(),
      digest: (bytes) => crypto.subtle.digest('SHA-256', bytes),
      loadRuntime: (signal) => loadScript('/toyvm/runtime/toyvm-bundle.js', signal),
      start: async (files) => {
        const ToyVM = root.ToyVM; ToyVM.unmountAll();
        for (const [name, bytes] of Object.entries(files)) ToyVM.mount(name, bytes);
        const { LiveRun, bindKeyboard } = ToyVM.require('tools/toyvm/live.js');
        if (!keyboardBound) { bindKeyboard(canvas, () => run); keyboardBound = true; }
        const env = Object.entries(t.entry.env || {}).map(([k, v]) => `${k}=${v}`);
        const exe = Object.keys(files).find(name => name.toLowerCase() === t.entry.program.toLowerCase());
        const r = new LiveRun({ canvas, exe, args: t.entry.args || '', files, env, card: 'full',
          autoKey: false, mips: 10, paced: true, sound: false, soundPref: 'silent', jit: false,
          onStatus: (s) => setStatus(s.state === 'running' ? 'Running. Click the screen, then type.' : s.state === 'waiting' ? 'Waiting for a key. Click the screen and press one.' : s.state === 'exited' ? 'The program exited.' : s.state === 'stopped' ? 'Stopped.' : s.state) });
        await r.start();
        return r;
      },
      ui: {
        // A phase with no measurable progress re-renders its elapsed time each
        // second, so the dialog never looks frozen.
        showDialog() { const d = $('loading'); if (!d.open) d.show(); $('cancel').focus(); ticker = setInterval(() => { if (lastPhase && lastPhase.started) renderPhase(lastPhase); }, 1000); },
        hideDialog() { const d = $('loading'); if (d.open) d.close(); clearInterval(ticker); ticker = null; },
        phase: renderPhase,
        error(e) { show($('error'), true); $('error-text').textContent = e.message; show($('start'), false); setStatus('The launch failed.'); $('retry').focus(); },
        cancelled() { show($('start'), true); setStatus('Cancelled. Nothing is running.'); $('start').focus(); },
        running(r) { run = r; show($('stage'), true); show($('stop'), true); show($('start'), false); canvas.focus(); },
      },
    });
    setStatus('Ready. Starting downloads the files above.');
  }
  function start() { show($('error'), false); show($('start'), false); setStatus('Starting…'); launcher.launch(); }
  $('start').addEventListener('click', start);
  $('retry').addEventListener('click', start);
  $('cancel').addEventListener('click', () => launcher && launcher.cancel());
  // A non-modal dialog fires no 'cancel' event, so Escape is handled here.
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && launcher && launcher.state === 'loading') { e.preventDefault(); launcher.cancel(); } });
  $('stop').addEventListener('click', () => { if (run) { run.stop(); run = null; } show($('stop'), false); show($('start'), true); setStatus('Stopped.'); });
  $('screen').addEventListener('pointerdown', () => $('screen').focus());
  init();
})(typeof self !== 'undefined' ? self : globalThis);
