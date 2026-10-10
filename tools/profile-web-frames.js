#!/usr/bin/env node
// Measure browser frame pacing for any app in index.html.
//
//   node tools/profile-web-frames.js --app=blobby_volley --seconds=15 \
//        [--guest-click=X:Y@atSec[:holdSec],...] [--warmup=8] [--present-log=FILE]
//
// Every run also reports guest presents inside the sample by source
// (gdi, directdraw:SLOT, gpu, glide) with a rate and a p95 of that source's
// own intervals; --present-log writes the raw timestamps. That is the
// emulated program's presentation rate, distinct from page fps/rAF.
//
// WHY THIS EXISTS: the CLI harness cannot answer "does it feel janky". It has
// no rAF, no compositor and no main-thread contention -- it just runs batches
// back to back and reports how long each took. Jank is a scheduling property
// of the browser: how evenly frames are delivered, and how long a single task
// blocks the main thread between them. So this measures the two things that
// actually correspond to the complaint:
//
//   frame intervals  - rAF delta distribution. Smooth is ~16.7ms and tight;
//                      jank is a fat tail.
//   long tasks       - PerformanceObserver('longtask'), i.e. main-thread work
//                      over 50ms. Each one is a frame the page could not draw.
//
// It reports the distribution and the worst offenders, plus a burst analysis,
// because "smooth, then a crawl, then fine again" is a clustering question
// that a mean or an average FPS actively hides.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
// Only for decoding the 1x1 clips the pixel-anchored wait takes; the film
// path writes PNGs straight to disk and never parses one.
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const APP = opt('app', 'blobby_volley');
const SECONDS = Number(opt('seconds', 15));
const WARMUP = Number(opt('warmup', 8));
const CLICKS = (opt('guest-click', '') || '').split(',').filter(Boolean);
// --guest-script=ACTION,ACTION,...  one ordered walk through a UI, where
// ACTION is click:X:Y@delaySec[:holdSec], type:TEXT@delaySec[:secPerChar] or
// key:0xVK[/0xCHAR]@delaySec[:holdSec]. Each delay is measured from the end of the
// previous action, so the list reads like the sequence a person performs.
//
// A delay written as `fN` (e.g. `@f120`) waits for N GUEST FRAMES instead of N
// seconds. Reach for that form on a loaded box: wall time keeps running through
// a host stall and the guest does not, so a wall-clock walk fires its whole
// sequence into a frozen screen — measured on Warcraft III, where one film went
// from 231s straight to 1147s and every remaining click landed in that gap.
// Frames are counted in the page off the emulator's own present hook, so the
// pacing is the emulated machine's progress, not this machine's load. A frame
// wait still gives up after `--frame-wait-cap` seconds (default 240) so a guest
// that stops presenting cannot hang the run.
//
// `wait:X:Y:RRGGBB@timeoutSec[:tol]` is the third pacing form and the only one
// that is CLOSED LOOP: it polls the pixel at X,Y until it matches the
// colour -- and X,Y here are FILM coordinates, the ones you read off a --film
// frame, NOT the guest coordinates a click takes. They differ whenever the
// guest runs exclusive/fullscreen, because a click maps guest -> canvas
// through _exclusiveTransform and a film frame is already the canvas. Sample
// the target colour from a film frame and pass those same coordinates --
// colour (or, with `!RRGGBB`, until it stops matching) and only then lets the
// walk continue. It performs no input of its own. Reach for it when the screen
// a walk depends on appears after a variable delay, which on this box is most
// of them: measured on Warcraft III, the campaign map load took ~560s in one
// run and past 1100s in another on the identical walk, and a first click that
// lands before the menu exists sends every later click into the wrong screen.
// Neither of the other two forms fixes that -- frames pace the emulated
// machine, and this variance is in how much WORK a screen costs, not in how
// much time passes. It gives up at its timeout rather than hanging the run,
// and prints the colour it actually saw, which is what you need in order to
// pick a better anchor next time.
const SCRIPT = (opt('guest-script', '') || '').split(',').filter(Boolean).map(spec => {
  const [head, timing] = spec.split('@');
  const [at, hold] = (timing || '').split(':');
  const colon = head.indexOf(':');
  const kind = head.slice(0, colon);
  const rest = head.slice(colon + 1);
  const frames = /^f\d+$/i.test(String(at || '')) ? Number(String(at).slice(1)) : 0;
  const act = {
    kind, frames,
    at: frames ? 0 : (Number(at) || 0),
    hold: Math.max(0.1, Number(hold) || 0.4),
  };
  if (kind === 'click') { const [x, y] = rest.split(':').map(Number); return { ...act, x, y }; }
  // fclick is the same press in FILM coordinates -- see the wait form below
  // for why those are not the same numbers as a click's guest coordinates.
  if (kind === 'fclick') { const [x, y] = rest.split(':').map(Number); return { ...act, x, y }; }
  if (kind === 'type') return { ...act, text: rest, hold: Math.max(0.05, Number(hold) || 0.3) };
  // key:VK[/CHAR] -- CHAR is the character code TranslateMessage would produce
  // (defaults to VK itself, which is already right for space, Return and the
  // digit/letter keys).
  if (kind === 'key') {
    const [vk, ch] = rest.split('/').map(Number);
    return { ...act, vk, ch: Number.isFinite(ch) ? ch : vk };
  }
  // wait:X:Y:RRGGBB or wait:X:Y:!RRGGBB -- `at` is a TIMEOUT here rather than a
  // delay, and `hold` is the per-channel tolerance.
  if (kind === 'wait') {
    const [x, y, colour] = rest.split(':');
    const hex = String(colour).replace('!', '');
    return {
      kind, x: Number(x), y: Number(y),
      negate: String(colour).startsWith('!'),
      rgb: [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)),
      timeout: Number(at) || 600,
      tol: Number(hold) || 24,
      frames: 0, at: 0,
    };
  }
  // gate:PATH@timeoutSec -- hold the walk until PATH exists. This is the seam
  // for driving the page by hand or with tools/ctl.js (frozen mode, png,
  // click, step) through the dev-server hub: reach the screen you want, then
  // `touch PATH` and the sample starts there.
  if (kind === 'gate') return { kind, file: rest, timeout: Number(at) || 1800, frames: 0, at: 0 };
  throw new Error(`--guest-script: unknown action "${kind}" in ${spec}`);
});
const FRAME_WAIT_CAP = Number(opt('frame-wait-cap', 240));
const PROTOCOL_TIMEOUT = Number(opt('protocol-timeout', 900));
const SHOT = opt('screenshot', '');
// --count=ADDR[,ADDR] (`module+0xVA` accepted): arm the emulator's own native
// hit counters and report how often each address was entered. run.js has had
// this since forever, but a guest that only runs in a browser -- anything on
// the GL path, because lib/gl-compat.js needs a document -- could not use it,
// which is exactly where "is this function ever reached?" is hardest to answer
// another way. The counters are plain wasm exports (set_count/get_count), so
// the flag is just a page-side caller for them.
const COUNTS = (opt('count', '') || '').split(',').filter(Boolean);
// Query string appended to index.html. "?debug" is a materially different
// page -- it keeps the debug log panel, and that panel is a plausible cost
// centre in its own right -- so profiling without it can miss the report.
const QUERY = opt('query', '');
// JS evaluated once after the instance is up, before sampling. Use it to A/B
// a single page setting against an otherwise identical run.
const AFTER_LAUNCH = opt('after-launch', '');
// JS evaluated in every new document BEFORE any page script runs. --after-launch
// is too late to wrap anything the page touches during startup (an AudioContext
// the guest opens in its first second, say); this is the seam for that.
const BEFORE_LOAD = opt('before-load', '');
// --swiftshader: give headless Chrome a software WebGL implementation instead
// of no GPU at all. Frame pacing then measures the rasterizer, so use it for
// functional runs of OpenGL/D3D guests, not for numbers about how an app feels.
const SWIFTSHADER = argv.includes('--swiftshader');
const CPU_PROFILE = argv.includes('--cpu-profile');
// --cpu-profile-dir=DIR: also write each thread's raw .cpuprofile (loadable in
// DevTools' Performance panel); --cpu-profile-top=N rows per thread.
const CPU_PROFILE_DIR = opt('cpu-profile-dir', '');
const CPU_PROFILE_TOP = Number(opt('cpu-profile-top', '12')) || 12;
// --headful: run in a visible Chrome window instead of a headless one. Headless
// Chrome is a different renderer -- no compositor surface, no display refresh
// to pace rAF against -- so its frame intervals and long tasks describe a
// browser nobody is running. Use this whenever the number is going to be quoted
// as what the app feels like; headless stays the default for pass/fail checks
// that only need the page to work.
const HEADFUL = argv.includes('--headful');
// --software-browser: Chrome's own compositing and canvas raster on the CPU
// (--disable-gpu), with SwiftShader kept for WebGL so a GL guest still gets a
// context. For a machine with no GPU: left to itself, headful Chrome there
// drives its compositor through Mesa llvmpipe -- GL emulated on the CPU -- and
// on ascii.dev that is a slower, burstier renderer than software compositing,
// so its rAF cadence measures the emulated GL rather than the app.
const SOFTWARE_BROWSER = argv.includes('--software-browser');
// --threads runs the guest on the isolated Worker backend instead of the
// cooperative scheduler — the browser twin of test/run.js's --threads. The
// opt-in is a localStorage key read at launch, so it has to be written before
// the reload that starts the app, and the page only honours it on a
// cross-origin-isolated origin (see startStaticServer). The run reports which
// backend actually came up: worker startup can fail and fall back.
const THREADS = argv.includes('--threads');
// --guest-key=VK@atSec:holdSec[,...]: hold a guest key down for a while DURING
// the sample. Scrolling a map is the workload that separates "the app is idle"
// from "the app is redrawing everything", and it is a held arrow key, not a
// click. VK is a Windows virtual-key code: 0x25/26/27/28 = left/up/right/down.
const KEYS = (opt('guest-key', '') || '').split(',').filter(Boolean).map(spec => {
  const [vk, when] = spec.split('@');
  const [at, hold] = (when || '0:1').split(':');
  return { vk: Number(vk), at: Number(at), hold: Number(hold || 1) };
});
// --resize-viewport=WxH@Ns[,WxH@Ns]: resize the browser window partway through
// the sample. The emulator's screen canvas is sized from its wrapper, so this
// is the only way to exercise renderer.handleScreenResize -- and the windows it
// re-lays-out -- from a script. Page JS cannot resize its own window, so
// setting the wrapper's style instead does NOT reach the same path.
const RESIZES = (opt('resize-viewport', '') || '').split(',').filter(Boolean).map(spec => {
  const [size, at] = spec.split('@');
  const [w, h] = size.split('x').map(Number);
  return { w, h, at: Number((at || '0').replace(/s$/, '')) };
});
// Use an already-running server (e.g. `node tools/dev-server.js`) instead of
// this file's own static one. Required for anything that talks to a same-
// origin API, since the throwaway server serves files and nothing else.
const ORIGIN = (opt('origin', '') || '').replace(/\/$/, '');
// JS evaluated after sampling; its result is printed. Pairs with
// --after-launch to install a counter and then read it back.
// --film=DIR[:everySec]: write a numbered PNG of the emulator canvas every
// everySec (default 2) from launch until the sample ends, so ONE run shows a
// whole menu transition instead of a single end-of-run screenshot. An in-page
// timer cannot do this reliably -- the emulator's step chain starves it -- and
// a screenshot taken only at the end cannot say which click changed anything.
const FILM = opt('film', '');
// --relay=REGEX: print every page console line matching REGEX, as it happens.
const RELAY = opt('relay', '') ? new RegExp(opt('relay', '')) : null;
const FILM_DIR = FILM.includes(':') ? FILM.slice(0, FILM.lastIndexOf(':')) : FILM;
const FILM_EVERY = FILM.includes(':') ? Number(FILM.slice(FILM.lastIndexOf(':') + 1)) || 2 : 2;
const REPORT_EVAL = opt('report-eval', '');
const TRACE_APIS = (opt('trace-api', '') || '').split(',').filter(Boolean);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Every profile directory this tool makes is named with this prefix, which is
// also what makes an abandoned browser from a previous run identifiable: it is
// the only string on a Chrome command line that says "this browser belongs to
// profile-web-frames.js". Nothing else on the box uses it.
const PROFILE_PREFIX = 'wine-assembly-frames-';

// Kill any browser left over from an earlier run of this tool.
//
// The leak is not a missing `browser.close()` -- the finally block has always
// had one. It is that the browser is a CHILD of this node process, and the two
// ways a run actually ends skip that block entirely: `timeout N` sends SIGTERM,
// and `pkill -f profile-web-frames` sends whatever it is asked to. Node dies,
// Chrome is reparented to launchd and keeps its guest, its GPU context and its
// several hundred MB. Killing the harness has therefore been ADDING a browser
// to the box, not removing one, and the runs are serial so the survivors pile
// up. A SIGKILL cannot be trapped at all, so a handler alone cannot close this;
// the only complete fix is for the next launch to clean up after the last one.
// Only an ORPHANED browser is stale. Several agents share this box and run
// this tool at the same time, and killing every Chrome whose command line
// carries the prefix killed their live runs mid-sample (2026-10-06 11:11:
// two arms died with "frame got detached"). Each run therefore writes its own
// pid into its profile directory (OWNER_FILE), and a browser is reaped only
// when the harness that owns its profile is gone. A profile with no owner
// file comes from an older copy of this tool, possibly still running in
// another worktree: it is reaped only once it is clearly abandoned
// (LEGACY_STALE_MS since its profile was last touched).
const OWNER_FILE = 'wine-assembly-owner.pid';
const LEGACY_STALE_MS = 30 * 60 * 1000;

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function killStaleBrowsers() {
  const { execFileSync } = require('child_process');
  let out = '';
  try {
    out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (_) { return 0; }
  const pids = [];
  const verdicts = new Map();   // profile dir -> stale?
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m || !m[2].includes(PROFILE_PREFIX)) continue;
    const pid = Number(m[1]);
    if (!(pid > 0) || pid === process.pid) continue;
    const dirMatch = m[2].match(/--user-data-dir=(\S*?wine-assembly-frames-[^\s/]+)/);
    if (!dirMatch) continue;           // not one of our browsers' processes
    const dir = dirMatch[1];
    if (!verdicts.has(dir)) {
      let stale;
      try {
        const owner = Number(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8').trim());
        stale = !(owner > 0 && pidAlive(owner));
      } catch (_) {
        let age = Infinity;
        try { age = Date.now() - fs.statSync(dir).mtimeMs; } catch (_) {}
        stale = age > LEGACY_STALE_MS;
      }
      verdicts.set(dir, stale);
    }
    if (verdicts.get(dir)) pids.push(pid);
  }
  for (const p of pids) { try { process.kill(p, 'SIGKILL'); } catch (_) {} }
  if (pids.length) console.log(`killed ${pids.length} orphaned harness browser process(es)`);
  const live = [...verdicts.values()].filter(v => !v).length;
  if (live) console.log(`left ${live} other live harness browser(s) alone`);
  return pids.length;
}

function mimeType(file) {
  if (file.endsWith('.html')) return 'text/html';
  if (file.endsWith('.js')) return 'text/javascript';
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.json')) return 'application/json';
  if (file.endsWith('.wasm')) return 'application/wasm';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startStaticServer() {
  const root = fs.realpathSync(ROOT);
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (_) { res.writeHead(400); res.end('bad url'); return; }
    if (pathname === '/') pathname = '/index.html';
    const file = path.normalize(path.join(root, pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end(error.code || 'read error'); return; }
      res.writeHead(200, {
        'Content-Type': mimeType(file),
        'Cache-Control': 'no-store',
        // A shared WebAssembly.Memory needs a cross-origin-isolated page, so
        // without these two headers the threads opt-in silently falls back to
        // the cooperative scheduler and the run measures the wrong backend.
        ...(THREADS ? {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        } : {}),
      });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

function stats(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const at = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return {
    n: s.length, mean: vals.reduce((a, b) => a + b, 0) / s.length,
    p50: at(0.5), p90: at(0.9), p99: at(0.99), max: s[s.length - 1],
  };
}

async function main() {
  // --origin points the run at a server that is already up (typically
  // tools/dev-server.js, which is the only one with the /api/perf sink), so
  // a relative-URL feature like ?perf-stream can be exercised for real
  // instead of against this file's throwaway static server.
  const server = ORIGIN ? null : await startStaticServer();
  const port = server ? server.address().port : 0;
  const base = ORIGIN || `http://127.0.0.1:${port}`;
  killStaleBrowsers();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX));
  // Marks this profile's browser as belonging to a live harness (see
  // killStaleBrowsers): another run's cleanup leaves it alone while we live.
  fs.writeFileSync(path.join(profile, OWNER_FILE), String(process.pid));
  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    executablePath: CHROME,
    userDataDir: profile,
    // Puppeteer gives every CDP call 30s and then throws ProtocolError, which
    // kills the run. A guest that blocks the main thread for longer than that
    // is not a hung page — Warcraft III's campaign load does it repeatedly
    // under SwiftShader — and losing the run at that exact moment throws away
    // the one sample that was worth taking. Five minutes is still a deadline.
    // Measured 2026-09-12: five minutes was not enough. Two WC3 runs died on
    // `Runtime.callFunctionOn timed out` inside the campaign map load, on a box
    // at load average 15, after the walk had already got that far.
    protocolTimeout: PROTOCOL_TIMEOUT * 1000,
    // --disable-gpu only in headless: forcing software compositing in a visible
    // window would measure a browser nobody runs, which is the whole reason
    // --headful exists.
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check']
      .concat(SOFTWARE_BROWSER ? ['--disable-gpu', '--enable-unsafe-swiftshader'] : [])
      .concat(HEADFUL || SOFTWARE_BROWSER ? [] : (SWIFTSHADER
        // Headless Chrome has no GPU and, since Chrome 120, refuses to fall
        // back to SwiftShader for WebGL unless asked. Without this an OpenGL
        // guest gets a NULL context from wglCreateContext and takes its
        // "no 3D hardware" path, which looks exactly like an emulator bug.
        ? ['--enable-unsafe-swiftshader', '--use-gl=angle',
           '--use-angle=swiftshader']
        : ['--disable-gpu'])),
  });
  // SIGTERM is what `timeout N` sends and what a plain `pkill` sends, and both
  // are how these runs normally end. Without this the finally block never runs
  // and the browser outlives the harness. SIGKILL is untrappable, so this is
  // only half the fix -- killStaleBrowsers() above is the other half.
  const reap = (sig) => {
    try { const p = browser.process(); if (p) p.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    process.exit(sig === 'SIGINT' ? 130 : 143);
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => reap(sig));
  const problems = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    page.on('pageerror', e => problems.push(String(e)));
    page.on('console', m => {
      const t = m.text();
      if (TRACE_APIS.length && /^\[API\]|^\s*=>/.test(t)) console.log(`[page] ${t}`);
      // A guest that puts up a message box is telling you what went wrong in
      // its own words, and it is the one console line worth relaying from
      // every run: the box renders as a picture, so a screenshot shows that
      // there IS a complaint without showing what it says.
      if (/^\[MessageBox\]/.test(t)) console.log(`[page] ${t}`);
      // --relay=REGEX is the escape hatch for a probe whose answer has to
      // survive the page dying. --report-eval runs once at the end and returns
      // nothing at all when the guest has put up a modal crash box and stopped
      // pumping — the CDP call just times out — so a probe that only reports
      // then loses exactly the run it was written for. Logging each sample and
      // relaying it here puts the series in the run log as it happens.
      if (RELAY && RELAY.test(t)) console.log(`[page] ${t}`);
      if (/UNIMPLEMENTED API:|RuntimeError|LinkError|crashed|FATAL:/i.test(t)) problems.push(t);
    });
    if (BEFORE_LOAD) {
      await page.evaluateOnNewDocument(src => {
        try { (0, eval)(src); } catch (e) { console.log('[before-load] failed: ' + e); }
      }, BEFORE_LOAD);
    }
    if (TRACE_APIS.length) {
      await page.evaluateOnNewDocument(names => {
        globalThis.__waTraceApiNames = new Set(names);
      }, TRACE_APIS);
    }
    // Threads are the page default now, so the cooperative arm must say so
    // before the page's first script runs: otherwise a non-isolated page
    // installs sw-coi.js and reloads itself under our evaluate() calls.
    // On every document, so it survives the clear-and-reload below.
    if (!THREADS) {
      await page.evaluateOnNewDocument(() => {
        try { localStorage.setItem('wine-assembly.threads', '0'); } catch (_) {}
      });
    }
    await page.goto(`${base}/index.html${QUERY}`, { waitUntil: 'load', timeout: 60000 });
    // Start with empty persisted state, then reload so startup gets a chance to
    // recreate its one-shot defaults. Clearing after startup deletes seeded
    // registry values (notably RCT's install Path) and creates failures that a
    // real first-time visitor cannot reach. Keep this ordering aligned with
    // tools/web-input-probe.js.
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
    // After the clear, before the reload: the clear would wipe it, and the
    // launch path reads it once at startup.
    if (THREADS) {
      const isolated = await page.evaluate(() => {
        try { localStorage.setItem('wine-assembly.threads', '1'); } catch (_) {}
        return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
      });
      if (!isolated) {
        throw new Error('--threads needs a cross-origin-isolated origin; with --origin, ' +
          'point it at `node tools/dev-server.js --isolate`');
      }
    }
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('typeof launchApp === "function"', { timeout: 60000 });

    console.log(`launching ${APP} ...`);
    // initDesktop() removes every <option> not in its desktop app set, so an
    // app can be fully wired in `apps` and still be unreachable from the UI.
    // Profiling should not depend on that cosmetic list -- re-add the option
    // when it is missing, and say so, because a human cannot launch it either.
    const injected = await page.evaluate(app => {
      const sel = document.getElementById('app-select');
      if (typeof apps === 'undefined' || !apps[app]) throw new Error(`index.html has no app named ${app}`);
      if ([...sel.options].some(o => o.value === app)) return false;
      const opt = document.createElement('option');
      opt.value = app;
      opt.textContent = app;
      sel.appendChild(opt);
      return true;
    }, APP);
    if (injected) console.log(`  note: ${APP} is not in the launcher list; option injected for this run`);

    await page.evaluate(app => {
      stopAllApps();
      document.getElementById('app-select').value = app;
      return launchApp();
    }, APP);

    // launchApp() resolves before the instance is up; wait for a running app
    // AND a renderer, or every measurement below silently reads null.
    try {
      await page.waitForFunction(
        'typeof runningApps !== "undefined" && runningApps.length > 0 && typeof sharedRenderer !== "undefined" && sharedRenderer',
        { timeout: 90000 });
    } catch (e) {
      // The page's own debug log says why far better than a timeout does.
      const state = await page.evaluate(() => {
        const el = document.getElementById('log');
        const sel = document.getElementById('app-select');
        return {
          log: el ? el.textContent.slice(-2000) : '(no #log element)',
          selectValue: sel ? sel.value : '(no #app-select)',
          knownApp: typeof apps !== 'undefined' ? Object.keys(apps).includes(sel && sel.value) : 'apps undefined',
          appKeys: typeof apps !== 'undefined' ? Object.keys(apps).length : 0,
          running: typeof runningApps !== 'undefined' ? runningApps.length : 'undefined',
        };
      }).catch(() => null);
      console.error('app did not come up:\n' + JSON.stringify(state, null, 2));
      throw e;
    }
    if (AFTER_LAUNCH) {
      const r = await page.evaluate(js => String(eval(js)), AFTER_LAUNCH);
      console.log(`  after-launch: ${AFTER_LAUNCH} => ${r}`);
    }
    // Arming has to wait for the warmup: the DLL table it reads is written by
    // the PE loader, so at launch time it is empty and every `module+0xVA`
    // spec fails with "module not loaded" -- or, before the instance exists at
    // all, with "this build exports no set_count", which reads like a build
    // problem and is not one.
    const armCounts = async () => {
      if (!COUNTS.length) return;
      const armed = await page.evaluate(specs => {
        // `runningApps` is a let/const binding in the page, so it is reachable
        // as a bare identifier and is NOT a property of globalThis. Reading it
        // off globalThis returns undefined and reports as "no set_count",
        // which looks like a build problem and is not one.
        const app = (typeof runningApps !== 'undefined' ? runningApps : [])[0];
        const wine = app && app.wine;
        // The wasm exports live on the instance; `wine` is the host object
        // around it, and its own `exports` is a different thing.
        const e = wine && ((wine.instance && wine.instance.exports) || wine.exports);
        if (!e || !e.set_count) return { error: 'this build exports no set_count' };
        // `module+0xVA` is the static VA out of a disassembler. It only equals
        // the runtime VA when the image got its preferred base, so resolve
        // through the PE header the loader recorded rather than assuming it,
        // and report both so a relocated module is visible rather than silent.
        // The DLL table the PE loader keeps in WAT is the authority on where
        // an image landed. wine.moduleMap only has what went through
        // LoadLibrary, so a statically imported DLL is missing from it.
        const dv = new DataView(wine.memory.buffer);
        const imageBase = e.get_image_base ? (e.get_image_base() >>> 0) : 0;
        const g2w = guest => RegionMap.g2w(guest >>> 0, imageBase);
        const readLinearStr = (wa, max) => {
          let s = '';
          for (let i = 0; i < max && wa + i < dv.byteLength; i++) {
            const c = dv.getUint8(wa + i);
            if (!c) break;
            s += String.fromCharCode(c);
          }
          return s;
        };
        const modules = [];
        if (e.get_dll_table && e.get_dll_count) {
          const table = e.get_dll_table() >>> 0;
          const count = e.get_dll_count() | 0;
          for (let i = 0; i < count; i++) {
            const entry = table + i * 32;
            if (entry + 12 > dv.byteLength) break;
            const loadAddr = dv.getUint32(entry, true) >>> 0;
            const exportRva = dv.getUint32(entry + 8, true) >>> 0;
            if (!loadAddr || !exportRva) continue;
            const exportDir = g2w(loadAddr + exportRva);
            if (exportDir + 16 > dv.byteLength) continue;
            const nameRva = dv.getUint32(exportDir + 12, true) >>> 0;
            if (!nameRva) continue;
            const name = readLinearStr(g2w(loadAddr + nameRva), 96);
            // The original image base is NOT readable from guest memory: the
            // DLL loader copies sections, not the DOS/PE headers, so
            // `[hdr+0x3c]` is not an e_lfanew and the value that comes back is
            // 0 — which resolves every `module+0xVA` one image base too low and
            // prints as a plausible address. host.js records what the loader
            // read off the file bytes; the header read stays only as a fallback
            // for a page that predates it.
            const known = (wine.moduleBases || {})[String(name).toLowerCase()];
            const hdr = g2w(loadAddr);
            let origBase = known ? (known.origBase >>> 0) : 0;
            if (!origBase && hdr + 0x40 < dv.byteLength) {
              const peOff = dv.getUint32(hdr + 0x3c, true) >>> 0;
              if (peOff && hdr + peOff + 56 < dv.byteLength) {
                origBase = dv.getUint32(hdr + peOff + 52, true) >>> 0;
              }
            }
            modules.push({ name, base: loadAddr, origBase });
          }
        }
        const resolve = (spec) => {
          const plus = spec.lastIndexOf('+');
          if (plus < 0) return { spec, addr: Number(spec) >>> 0, module: null };
          const name = spec.slice(0, plus).toLowerCase();
          const va = Number(spec.slice(plus + 1)) >>> 0;
          const m = modules.find(x => String(x.name).toLowerCase() === name ||
            String(x.name).toLowerCase() === name + '.dll' ||
            String(x.name).toLowerCase().replace(/\.(dll|exe)$/, '') === name);
          if (!m) return { spec, addr: 0, error: 'module not loaded' };
          return { spec, addr: (m.base + (va - m.origBase)) >>> 0,
            module: m.name, base: m.base, origBase: m.origBase };
        };
        const out = specs.map(resolve);
        e.clear_counts && e.clear_counts();
        out.forEach((r, i) => { if (r.addr) e.set_count(i, r.addr); });
        return { resolved: out, modules: modules.map(m => m.name).join(' ') };
      }, COUNTS);
      if (armed && armed.error) console.log(`  count: ${armed.error}`);
      else for (const r of armed.resolved) {
        console.log(`  count[${armed.resolved.indexOf(r)}] ${r.spec} -> `
          + (r.addr ? `0x${r.addr.toString(16)}` : `FAILED: ${r.error}`)
          + (r.module ? ` (${r.module} @0x${r.base.toString(16)}`
            + `, orig 0x${r.origBase.toString(16)})` : ''));
      }
    };
    // Start filming before the warmup, so the clicks below are ON camera.
    let filmTimer = null, filmN = 0, filmBusy = false, filmErr = null;
    if (FILM_DIR) {
      fs.mkdirSync(FILM_DIR, { recursive: true });
      const t0film = Date.now();
      filmTimer = setInterval(async () => {
        if (filmBusy) return;               // a slow screenshot must not queue up
        filmBusy = true;
        const at = ((Date.now() - t0film) / 1000).toFixed(0).padStart(3, '0');
        const file = `${FILM_DIR}/f${String(filmN).padStart(3, '0')}-${at}s.png`;
        try {
          // Clip to the canvas's box rather than screenshotting the element:
          // an element screenshot of a canvas inside a clipping container comes
          // back as a failure, and a swallowed failure films an empty directory
          // while still counting frames.
          const box = await page.evaluate(() => {
            const c = document.getElementById('screen');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          if (filmN === 0) console.log(`film clip: ${JSON.stringify(box)}`);
          if (box && box.width >= 1 && box.height >= 1) {
            await page.screenshot({ path: file, clip: box });
          } else {
            await page.screenshot({ path: file });
          }
          filmN++;
        } catch (e) { if (!filmErr) filmErr = String(e && e.message || e); }
        filmBusy = false;
      }, FILM_EVERY * 1000);
    }
    // The guest needs to be past its loader before pacing means anything.
    await wait(WARMUP * 1000);
    console.log(`slice size: ${await page.evaluate(() => (runningApps[0] || {}).wine ? runningApps[0].wine.stepsPerSlice : null)} steps`);
    // Report the backend that actually came up rather than the one requested:
    // Worker startup can fail and fall back cooperatively, and a threads run
    // that quietly measured the cooperative scheduler is worse than no run.
    const backend = await page.evaluate(() => {
      const w = (runningApps[0] || {}).wine;
      return (w && w.threadManager && w.threadManager.backend) || 'cooperative (no thread manager yet)';
    });
    console.log(`guest backend: ${backend}${THREADS ? ' (--threads requested)' : ''}`);
    if (THREADS && !/worker/.test(backend)) {
      console.log('  WARNING: --threads was requested but the guest is not on the Worker backend');
    }
    await armCounts();

    // One event per evaluate, with real time in between. Delivering all four
    // synchronously means the guest never runs between them, so it never
    // sees the cursor MOVE -- and a guest that hit-tests against its own
    // tracked cursor (Blobby does) then ignores the click entirely.
    const step = (fn) => page.evaluate((x, y, which) => {
      const t = sharedRenderer && sharedRenderer._exclusiveTransform;
      const cx = t && t.srcW ? Math.round((t.dstX || 0) + ((x - (t.srcX || 0)) * t.dstW / t.srcW)) : x;
      const cy = t && t.srcH ? Math.round((t.dstY || 0) + ((y - (t.srcY || 0)) * t.dstH / t.srcH)) : y;
      if (which === 'move') sharedRenderer.handleMouseMove(cx, cy);
      else if (which === 'down') sharedRenderer.handleMouseDown(cx, cy, 1);
      else if (sharedRenderer.handleMouseUp) sharedRenderer.handleMouseUp(cx, cy, 1);
    }, fn.x, fn.y, fn.which);

    // A press is only as long as the guest's own clock makes it. Under
    // SwiftShader on a loaded box the emulated machine can advance a single
    // frame in several seconds, and a game that samples the button once a
    // frame (rather than taking WM_LBUTTONDOWN off its queue) then never
    // sees a press that went down and up between two of its samples. The
    // default stays short so existing command lines behave the same; pass
    // a hold when the guest is slow.
    // Press at FILM coordinates: the renderer's handlers already take canvas
    // coordinates, and a film frame IS the canvas, so this is `step` with the
    // guest->canvas transform left out. Reach for it whenever the point was
    // measured off a --film frame, which is the only way to measure one for a
    // guest that draws its own UI. Measured on Warcraft III: the walk's
    // "Single Player at 805,165" was a film coordinate all along, and putting
    // it through the transform pressed a different button -- the run opened
    // Options and then spent twenty minutes there looking like a hang.
    // Film -> backing store. Measured on Warcraft III: the canvas backing is
    // 800x600 (the guest screen), its CSS box is 940x702, and --film clips the
    // CSS box -- so a film frame is the guest screen scaled by 1.175, and the
    // renderer's handlers take BACKING coordinates. Passing a film coordinate
    // straight through therefore lands about 17% too far right and down, which
    // is how a walk aimed at "Single Player" kept opening other things.
    const fstep = (x, y, which) => page.evaluate((fx, fy, w) => {
      const c = document.getElementById('screen');
      const r = c.getBoundingClientRect();
      const cx = Math.round(fx * (c.width / (r.width || c.width)));
      const cy = Math.round(fy * (c.height / (r.height || c.height)));
      if (w === 'move') sharedRenderer.handleMouseMove(cx, cy);
      else if (w === 'down') sharedRenderer.handleMouseDown(cx, cy, 1);
      else if (sharedRenderer.handleMouseUp) sharedRenderer.handleMouseUp(cx, cy, 1);
    }, x, y, which);

    const clickFilm = async (fx, fy, hold) => {
      await fstep(fx, fy, 'move');
      await wait(400);
      await fstep(fx + 1, fy + 1, 'move');
      await wait(400);
      await fstep(fx + 1, fy + 1, 'down');
      await wait(hold * 1000);
      await fstep(fx + 1, fy + 1, 'up');
      await wait(400);
      console.log(`clicked film ${fx},${fy} (held ${hold}s)`);
    };

    const clickGuest = async (gx, gy, hold) => {
      await step({ x: gx, y: gy, which: 'move' });
      await wait(400);
      // Second move one pixel on: some guests only redraw/re-hit-test on a delta.
      await step({ x: gx + 1, y: gy + 1, which: 'move' });
      await wait(400);
      await step({ x: gx + 1, y: gy + 1, which: 'down' });
      await wait(hold * 1000);
      await step({ x: gx + 1, y: gy + 1, which: 'up' });
      await wait(400);
      console.log(`clicked guest ${gx},${gy} (held ${hold}s)`);
    };

    // Type one character the way a browser does: WM_KEYDOWN, WM_CHAR, WM_KEYUP.
    // handleKeyDown alone is not enough for a game that reads text -- an engine
    // with its own edit box takes the character off WM_CHAR, and a virtual-key
    // code is not a character.
    const typeGuest = async (text, perChar) => {
      for (const ch of text) {
        const code = ch.charCodeAt(0);
        const vk = (ch >= 'a' && ch <= 'z') ? code - 32
          : (ch === ' ') ? 32 : code;
        await page.evaluate((v, c) => {
          sharedRenderer.handleKeyDown(v);
          sharedRenderer.handleKeyPress(c);
          sharedRenderer.handleKeyUp(v);
        }, vk, code);
        await wait(perChar * 1000);
      }
      console.log(`typed guest ${JSON.stringify(text)} (${perChar}s/char)`);
    };

    // --guest-script: one sequential list, so a menu walk that needs
    // click -> type -> click can be written down in the order it happens.
    // Separate flags cannot express that: each is its own loop, so the last
    // click of a walk would always fire before the first keystroke.
    // Count guest presents in the page. The emulator's onGuestFrame slot is
    // already taken by the shell, so chain rather than replace it.
    const armFrameCounter = () => page.evaluate(() => {
      const w = (runningApps[0] || {}).wine;
      if (!w) return false;
      // The shell only installs its own onGuestFrame for some apps, and it may
      // install it after this arms, so chain whatever is there (possibly
      // nothing) and re-arm whenever the slot stops being ours.
      if (w.onGuestFrame === w.__pwfHookFn) return true;
      if (window.__pwfFrames === undefined) window.__pwfFrames = 0;
      const prev = w.onGuestFrame;
      w.__pwfHookFn = f => {
        window.__pwfFrames = (window.__pwfFrames || 0) + 1;
        // Inside the sample window, keep each present's time and source so
        // the report can count one presentation path (e.g. DirectDraw Flip
        // slot 5) and give its own interval percentile.
        if (window.__pwfPresentOn) {
          window.__pwfPresents.push([performance.now(), (f && f.kind) || '?', f && f.slot !== undefined ? f.slot : -1]);
        }
        return typeof prev === 'function' ? prev(f) : undefined;
      };
      w.onGuestFrame = w.__pwfHookFn;
      return true;
    });
    const readFrames = () => page.evaluate(() => window.__pwfFrames || 0);
    const waitFrames = async (n) => {
      await armFrameCounter();
      const start = await readFrames();
      const deadline = Date.now() + FRAME_WAIT_CAP * 1000;
      let seen = start;
      while (seen - start < n && Date.now() < deadline) {
        await wait(250);
        await armFrameCounter();          // the shell may have taken the slot back
        seen = await readFrames();
      }
      console.log(`waited ${seen - start}/${n} guest frames`
        + `${seen - start < n ? ` (gave up after ${FRAME_WAIT_CAP}s)` : ''}`);
    };

    // Read one pixel in FILM coordinates -- the same x,y you would read off a
    // frame in --film, NOT the guest coordinates a click takes. Those two
    // spaces are different whenever the guest runs exclusive/fullscreen: the
    // renderer stretches the guest screen into the canvas, so clickGuest maps
    // guest -> canvas through _exclusiveTransform while a film frame IS the
    // canvas. Applying that transform here read a point ~20px away from the
    // one the film showed, which matched nothing and looked exactly like a
    // stuck guest. Film coordinates are also the ones you can actually sample
    // a target colour from, since that is what is on disk.
    //
    // The read goes through a 1x1 page screenshot rather than getImageData,
    // because the screen canvas is WebGL for anything on the OpenGL path
    // (Warcraft III is) and getContext('2d') on one of those returns null,
    // which would silently turn every wait into its timeout.
    const readPixel = async (gx, gy) => {
      const at = await page.evaluate((x, y) => {
        const c = document.getElementById('screen');
        if (!c || !c.width || !c.height) return null;
        // No backing-store scaling. --film clips this same rect in CSS pixels,
        // so a film pixel is a CSS offset into it; multiplying by
        // r.width / c.width sampled ~20px away whenever the backing store and
        // the CSS box disagree, which is every exclusive-mode guest. Measured
        // on Warcraft III: the film read #fed40d and the scaled probe #120905
        // at the same coordinate in the same frame.
        const r = c.getBoundingClientRect();
        return { x: r.x + x, y: r.y + y, cw: c.width, rw: r.width };
      }, gx, gy);
      if (!at) return null;
      try {
        const buf = await page.screenshot({
          clip: { x: at.x, y: at.y, width: 1, height: 1 },
        });
        const png = PNG.sync.read(Buffer.from(buf));
        return [png.data[0], png.data[1], png.data[2]];
      } catch (_) { return null; }
    };

    const hex = c => c === null ? 'n/a'
      : '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

    // Poll a guest pixel until it matches (or stops matching) a colour. This is
    // the only pacing form that reacts to what is actually on screen; see the
    // --guest-script comment at the top for why the clock is not usable here.
    const waitPixel = async (act) => {
      const deadline = Date.now() + act.timeout * 1000;
      let seen = null, hits = 0, polls = 0;
      while (Date.now() < deadline) {
        seen = await readPixel(act.x, act.y);
        // Say what is being sampled, at the start and then occasionally. A
        // silent wait cannot be told apart from a wait that is reading the
        // wrong pixel, and that difference cost a 40-minute run: the film
        // showed the anchor colour on screen while the probe matched nothing.
        if (polls === 0 || polls % 30 === 29) {
          console.log(`  wait ${act.x},${act.y}: saw ${hex(seen)}`
            + ` (want ${act.negate ? '!=' : '=='} ${hex(act.rgb)} +/-${act.tol})`);
        }
        polls++;
        if (seen) {
          const near = seen.every((v, i) => Math.abs(v - act.rgb[i]) <= act.tol);
          // Two consecutive agreeing samples, because these screens animate and
          // a single frame can catch a transient (rain, a cursor, a fade).
          if (near !== act.negate) { if (++hits >= 2) break; } else hits = 0;
        }
        // Every poll is a CDP screenshot, and a screenshot is not free on the
        // thread the guest runs on. At one a second a long wait measurably
        // starves the emulator it is waiting for, so poll slowly -- nothing
        // here needs sub-4s resolution and two agreeing samples still confirm
        // inside ten seconds.
        await wait(4000);
      }
      const met = hits >= 2;
      console.log(`wait ${act.x},${act.y} ${act.negate ? '!=' : '=='} `
        + `${hex(act.rgb)} +/-${act.tol}: ${met ? 'met' : `TIMED OUT after ${act.timeout}s`}`
        + `, saw ${hex(seen)}`);
      return met;
    };

    for (const act of SCRIPT) {
      if (act.frames) await waitFrames(act.frames);
      else if (act.at) await wait(act.at * 1000);
      if (act.kind === 'wait') await waitPixel(act);
      else if (act.kind === 'gate') {
        console.log(`gate: waiting for ${act.file} (up to ${act.timeout}s)`);
        const deadline = Date.now() + act.timeout * 1000;
        while (!fs.existsSync(act.file) && Date.now() < deadline) await wait(500);
        console.log(`gate: ${fs.existsSync(act.file) ? 'open' : `TIMED OUT after ${act.timeout}s`}`);
      }
      else if (act.kind === 'click') await clickGuest(act.x, act.y, act.hold);
      else if (act.kind === 'fclick') await clickFilm(act.x, act.y, act.hold);
      else if (act.kind === 'type') await typeGuest(act.text, act.hold);
      else if (act.kind === 'key') {
        // Down, then the character, then up. A real keyboard produces all
        // three and TranslateMessage is what turns the first into the second,
        // so a guest that waits on WM_CHAR -- "press any key to continue"
        // screens usually do -- never sees a down/up pair on its own.
        await page.evaluate((v, c) => {
          sharedRenderer.handleKeyDown(v);
          if (c) sharedRenderer.handleKeyPress(c);
        }, act.vk, act.ch || 0);
        await wait(act.hold * 1000);
        await page.evaluate(v => sharedRenderer.handleKeyUp(v), act.vk);
        console.log(`key 0x${act.vk.toString(16)} tapped (held ${act.hold}s)`);
      }
    }

    // Clicks are given in GUEST coordinates and mapped through the renderer's
    // exclusive transform, the same way the web tests do it.
    for (const spec of CLICKS) {
      const [pt, timing] = spec.split('@');
      const [delaySec, holdSec] = (timing || '').split(':');
      const [gx, gy] = pt.split(':').map(Number);
      const hold = Math.max(0.4, Number(holdSec) || 0.4);
      if (delaySec) await wait(Number(delaySec) * 1000);
      await clickGuest(gx, gy, hold);
    }

    // Attribute time to the canvas primitives the presentation path uses.
    // putImageData is the interesting one: it is the raw-GDI-surface blit, it
    // runs on the main thread, and Chrome cannot GPU-accelerate it.
    await page.evaluate(() => {
      // BOTH prototypes: GDI surfaces are backed by OffscreenCanvas, whose 2D
      // context does NOT share CanvasRenderingContext2D.prototype. Patching
      // only the visible-canvas prototype reports "putImageData: 0 calls"
      // while every surface blit in the app goes past unmeasured.
      const protos = [CanvasRenderingContext2D.prototype];
      if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
        protos.push(OffscreenCanvasRenderingContext2D.prototype);
      }
      window.__canvasStats = { putImageData: { n: 0, ms: 0, px: 0 }, drawImage: { n: 0, ms: 0 }, getImageData: { n: 0, ms: 0 } };
      for (const proto of protos) for (const name of ['putImageData', 'drawImage', 'getImageData']) {
        const orig = proto[name];
        if (!orig) continue;
        proto[name] = function (...args) {
          const t = performance.now();
          const r = orig.apply(this, args);
          const s = window.__canvasStats[name];
          s.ms += performance.now() - t;
          s.n++;
          if (name === 'putImageData' && args[0] && args[0].width) s.px += args[0].width * args[0].height;
          return r;
        };
      }
    });

    // --cpu-profile: V8 sampling profiler over the same window, aggregated by
    // self time. Long tasks tell you a frame was blocked; this tells you by
    // what. Costs a little overhead, so it is opt-in.
    // The page session sees only the page's own thread. With --threads every
    // guest thread is a Worker, and the D3D rasterizer is a render Worker, so
    // a page-only profile silently leaves out most of the CPU -- each worker
    // is profiled through its own session and reported as its own thread.
    let cdp = null;
    const profTargets = [];
    const startProfiler = async (label, session) => {
      try {
        await session.send('Profiler.enable');
        await session.send('Profiler.setSamplingInterval', { interval: 200 });
        await session.send('Profiler.start');
        profTargets.push({ label, session });
      } catch (e) { console.log(`  cpu-profile: could not start on ${label}: ${e.message}`); }
    };
    const workerLabel = w => w.url().replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '');
    const onWorker = w => { if (w.client) startProfiler(`worker ${workerLabel(w)} (late)`, w.client); };
    if (CPU_PROFILE) {
      cdp = await page.target().createCDPSession();
      await startProfiler('page', cdp);
      for (const w of page.workers()) if (w.client) await startProfiler(`worker ${workerLabel(w)}`, w.client);
      page.on('workercreated', onWorker);
    }

    // MACHINE LOAD, printed either side of the sample. This is not a detail:
    // on a busy box the SAME command has produced 48, 19 and 0 long tasks,
    // and reading that spread as a difference between configurations is the
    // easiest wrong conclusion available here. A frame profile taken at load
    // 40 measures the box, not the app.
    const loadBefore = os.loadavg();
    console.log(`load average before: ${loadBefore.map(n => n.toFixed(2)).join(' ')}`);

    // Fire the scheduled viewport resizes alongside the sample rather than
    // before it, so the frames either side of each one are in the histogram.
    for (const r of RESIZES) {
      setTimeout(() => {
        page.setViewport({ width: r.w, height: r.h, deviceScaleFactor: 1 })
          .then(() => console.log(`  resized viewport to ${r.w}x${r.h}`))
          .catch(() => {});
      }, r.at * 1000);
    }

    // Held keys, scheduled inside the sample for the same reason the resizes
    // are: the frames the scroll costs have to land in the histogram, not
    // before it.
    for (const k of KEYS) {
      setTimeout(() => {
        page.evaluate(vk => sharedRenderer.handleKeyDown(vk), k.vk)
          .then(() => console.log(`  key 0x${k.vk.toString(16)} down`))
          .catch(() => {});
      }, k.at * 1000);
      setTimeout(() => {
        page.evaluate(vk => sharedRenderer.handleKeyUp(vk), k.vk)
          .then(() => console.log(`  key 0x${k.vk.toString(16)} up`))
          .catch(() => {});
      }, (k.at + k.hold) * 1000);
    }

    console.log(`sampling ${SECONDS}s ...`);
    await armFrameCounter();
    const result = await page.evaluate(seconds => new Promise(resolve => {
      const frames = [];
      const tasks = [];
      window.__pwfPresents = [];
      window.__pwfPresentOn = true;
      // LIVENESS. A page that is not running the guest at all reports a
      // flawless 60fps and zero long tasks, which is indistinguishable from
      // "smooth" unless something checks that the screen is actually moving.
      // Sample a strip of the canvas once a second and count distinct hashes.
      // Downscale the WHOLE canvas into a thumbnail and hash that. Sampling a
      // crop is how this probe lied on its first outing: a centre crop of a
      // Blobby match is net and sand, which barely move, so a live game read
      // as "idle" while the ball and both players animated just outside it.
      const screen = document.getElementById('screen');
      const thumb = document.createElement('canvas');
      thumb.width = 64; thumb.height = 48;
      const probeCtx = thumb.getContext('2d', { willReadFrequently: true });
      const hashes = [];
      const sizes = [];
      const probe = () => {
        if (!probeCtx || !screen || !screen.width || !screen.height) return;
        try {
          // Track the backing store size too: a canvas whose width/height is
          // reassigned reallocates and drops any GPU acceleration, which makes
          // every canvas op on it slower at once.
          sizes.push(screen.width + 'x' + screen.height);
          probeCtx.drawImage(screen, 0, 0, thumb.width, thumb.height);
          const d = probeCtx.getImageData(0, 0, thumb.width, thumb.height).data;
          let acc = 0;
          for (let i = 0; i < d.length; i += 7) acc = (acc * 31 + d[i]) | 0;
          hashes.push(acc);
        } catch (_) { /* tainted or zero-size canvas */ }
      };
      probe();
      const probeTimer = setInterval(probe, 1000);
      let observer = null;
      try {
        observer = new PerformanceObserver(list => {
          for (const e of list.getEntries()) tasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration) });
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (_) { /* longtask unsupported; frame intervals still work */ }
      let prev = performance.now();
      const t0 = prev;
      function tick(now) {
        frames.push(now - prev);
        prev = now;
        if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
        else {
          if (observer) observer.disconnect();
          clearInterval(probeTimer);
          probe();
          window.__pwfPresentOn = false;
          resolve({
            presents: window.__pwfPresents.map(([t, kind, slot]) => [t - t0, kind, slot]),
            frames, tasks, elapsed: now - t0,
            probes: hashes.length, distinct: new Set(hashes).size,
            canvasSizes: [...new Set(sizes)],
          });
        }
      }
      requestAnimationFrame(tick);
    }), SECONDS);

    // Guest presents inside the sample, per source (kind[:slot]). This is the
    // emulated program's presentation rate -- not page fps, not rAF -- and the
    // p95 is of its own intervals in this window (sorted, index
    // floor(n*0.95)), never derived from the mean.
    {
      const bySource = new Map();
      for (const [t, kind, slot] of result.presents) {
        const key = slot >= 0 ? `${kind}:${slot}` : kind;
        if (!bySource.has(key)) bySource.set(key, []);
        bySource.get(key).push(t);
      }
      const summary = [...bySource].map(([source, ts]) => {
        const iv = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
        return {
          source, presents: ts.length, durationMs: +result.elapsed.toFixed(1),
          perSecond: +(ts.length * 1000 / result.elapsed).toFixed(2),
          p95IntervalMs: iv.length ? +iv[Math.min(iv.length - 1, Math.floor(iv.length * 0.95))].toFixed(2) : null,
        };
      }).sort((a, b) => b.presents - a.presents);
      console.log('');
      console.log(`guest presents over the ${(result.elapsed / 1000).toFixed(1)}s sample, by source:`);
      for (const s of summary) {
        console.log(`  ${s.source.padEnd(14)} ${String(s.presents).padStart(6)} presents  ${s.perSecond.toFixed(2).padStart(7)}/s  p95 interval ${s.p95IntervalMs === null ? '-' : s.p95IntervalMs + 'ms'}`);
      }
      const presentLog = opt('present-log', null);
      if (presentLog) fs.writeFileSync(presentLog, JSON.stringify({ elapsedMs: result.elapsed, summary, presents: result.presents }));
    }

    if (cdp) {
      page.off('workercreated', onWorker);
      const summary = [];
      for (const t of profTargets) {
        let profile;
        try { ({ profile } = await t.session.send('Profiler.stop')); }
        catch (e) { console.log(`  cpu-profile: ${t.label} ended before the sample did (${e.message})`); continue; }
        if (CPU_PROFILE_DIR) {
          fs.mkdirSync(CPU_PROFILE_DIR, { recursive: true });
          const file = path.join(CPU_PROFILE_DIR, `${summary.length}-${t.label.replace(/[^\w.-]+/g, '_')}.cpuprofile`);
          fs.writeFileSync(file, JSON.stringify(profile));
        }
        const byId = new Map(profile.nodes.map(n => [n.id, n]));
        const self = new Map();
        let idle = 0;
        // timeDeltas[i] is the time attributed to samples[i].
        for (let i = 0; i < profile.samples.length; i++) {
          const n = byId.get(profile.samples[i]);
          if (!n) continue;
          const f = n.callFrame;
          const dt = profile.timeDeltas[i] || 0;
          if (f.functionName === '(idle)') { idle += dt; continue; }
          const where = f.url ? `${f.url.replace(/^https?:\/\/[^/]+\//, '')}:${f.lineNumber + 1}` : '';
          const key = `${f.functionName || '(anonymous)'}  ${where}`;
          self.set(key, (self.get(key) || 0) + dt);
        }
        const busy = [...self.values()].reduce((a, b) => a + b, 0);
        summary.push({ label: t.label, busy, idle, self });
      }
      const span = SECONDS * 1e6;
      console.log('');
      console.log(`CPU per thread over the ${SECONDS}s sample (busy = sampled non-idle time):`);
      for (const s of summary) {
        console.log(`  ${(100 * s.busy / span).toFixed(1).padStart(5)}% of wall  ${(s.busy / 1000).toFixed(0).padStart(6)}ms busy  ${s.label}`);
      }
      for (const s of summary) {
        if (s.busy < span * 0.01) continue;
        console.log('');
        console.log(`CPU self time, ${s.label} (top ${CPU_PROFILE_TOP}, % of this thread's busy time):`);
        for (const [k, us] of [...s.self.entries()].sort((a, b) => b[1] - a[1]).slice(0, CPU_PROFILE_TOP)) {
          console.log(`  ${(100 * us / (s.busy || 1)).toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(0).padStart(6)}ms  ${k}`);
        }
      }
    }

    // The debug log panel grows without bound and appendDebugLog rebuilds its
    // whole textContent then forces a synchronous layout via scrollTop. Its
    // size is therefore a cost, not a curiosity.
    const logChars = await page.evaluate(() => {
      const el = document.getElementById('log');
      return el ? el.textContent.length : -1;
    });
    if (logChars >= 0) console.log(`debug log panel: ${logChars} chars`);

    const canvasStats = await page.evaluate(() => window.__canvasStats);
    console.log('');
    console.log('canvas primitives during the sample:');
    for (const [name, s] of Object.entries(canvasStats)) {
      const per = s.n ? (s.ms / s.n).toFixed(2) : '0.00';
      const px = s.px ? `  ${(s.px / 1e6).toFixed(1)}M px` : '';
      console.log(`  ${name.padEnd(13)} ${String(s.n).padStart(6)} calls  ${s.ms.toFixed(0).padStart(6)}ms total  ${per}ms each${px}`);
    }

    // Is the EMULATOR advancing, independent of what reaches the screen? A
    // guest can be running hard while drawing nothing, and a stopped guest
    // looks identical to a smooth one in frame stats alone.
    const eips = [];
    for (let i = 0; i < 5; i++) {
      eips.push(await page.evaluate(() => {
        const a = (typeof runningApps !== 'undefined' && runningApps[0]) || null;
        const e = a && a.wine && a.wine.instance && a.wine.instance.exports;
        return e && e.get_eip ? '0x' + (e.get_eip() >>> 0).toString(16) : null;
      }));
      await wait(200);
    }
    console.log(`guest eip samples: ${eips.join(' ')}  (${new Set(eips).size} distinct)`);
    if (filmTimer) {
      clearInterval(filmTimer);
      console.log(`film: ${filmN} frames in ${FILM_DIR}${filmErr ? ` (first error: ${filmErr})` : ''}`);
    }
    if (SHOT) {
      await page.screenshot({ path: SHOT });
      console.log(`screenshot: ${SHOT}`);
    }

    if (COUNTS.length) {
      const counts = await page.evaluate(n => {
        const wine = ((globalThis.runningApps || [])[0] || {}).wine;
        const x = wine && ((wine.instance && wine.instance.exports) || wine.exports);
        if (!x || !x.get_count) return null;
        const out = [];
        for (let i = 0; i < n; i++) out.push(x.get_count(i) | 0);
        return out;
      }, COUNTS.length).catch(() => null);
      console.log('Hit counts:');
      COUNTS.forEach((spec, i) => console.log(
        `  ${spec}: ${counts ? counts[i] : 'unavailable'}`));
    }

    if (REPORT_EVAL) {
      const r = await page.evaluate(js => String(eval(js)), REPORT_EVAL).catch(e => `error: ${e.message}`);
      console.log(`report-eval: ${r}`);
    }

    const loadAfter = os.loadavg();
    console.log(`load average after:  ${loadAfter.map(n => n.toFixed(2)).join(' ')}` +
      (loadAfter[0] > 4 ? '   <-- BUSY: treat the numbers below as a floor, not a measurement of the app' : ''));

    const f = stats(result.frames);
    console.log('');
    // Report liveness FIRST -- every number below is meaningless without it.
    if (result.distinct <= 1) {
      console.log(`WARNING: the screen never changed across ${result.probes} probes.`);
      console.log('The guest is idle or stopped, so the frame numbers below measure an idle page, not gameplay.');
    } else {
      console.log(`screen changed in ${result.distinct} of ${result.probes} probes (guest is live)`);
    }
    if (result.canvasSizes && result.canvasSizes.length > 1) {
      console.log(`WARNING: canvas backing store was resized during the sample: ${result.canvasSizes.join(' -> ')}`);
    } else if (result.canvasSizes) {
      console.log(`canvas: ${result.canvasSizes[0]} (stable)`);
    }
    console.log(`frames: ${f.n} in ${(result.elapsed / 1000).toFixed(1)}s  =>  ${(f.n / (result.elapsed / 1000)).toFixed(1)} fps average`);
    console.log('frame interval (ms)   mean    p50    p90    p99    max');
    console.log(`                   ${f.mean.toFixed(1).padStart(7)}${f.p50.toFixed(1).padStart(7)}` +
      `${f.p90.toFixed(1).padStart(7)}${f.p99.toFixed(1).padStart(7)}${f.max.toFixed(1).padStart(7)}`);

    // 33ms = a dropped frame at 60Hz; 100ms = visible hitch.
    const dropped = result.frames.filter(v => v > 33).length;
    const hitches = result.frames.filter(v => v > 100).length;
    console.log(`over 33ms: ${dropped} (${(100 * dropped / f.n).toFixed(1)}%)   over 100ms: ${hitches}`);

    if (result.tasks.length) {
      const t = stats(result.tasks.map(x => x.ms));
      console.log('');
      console.log(`long tasks (>50ms blocking the main thread): ${t.n}`);
      console.log(`  mean ${t.mean.toFixed(1)}ms  p50 ${t.p50}ms  p90 ${t.p90}ms  max ${t.max}ms`);
      console.log(`  total blocked: ${result.tasks.reduce((a, x) => a + x.ms, 0)}ms of ${Math.round(result.elapsed)}ms ` +
        `(${(100 * result.tasks.reduce((a, x) => a + x.ms, 0) / result.elapsed).toFixed(0)}%)`);
      // WHERE the stalls sit decides what they are: clustered at the start is
      // asset loading, spread across the run is steady-state cost.
      const t0 = result.tasks[0].start;
      console.log('  worst, as seconds into the sample:');
      for (const x of [...result.tasks].sort((a, b) => b.ms - a.ms).slice(0, 6)) {
        console.log(`    +${((x.start - t0) / 1000).toFixed(1)}s  ${x.ms}ms`);
      }
    } else {
      console.log('');
      console.log('long tasks: none observed');
    }

    // Sawtooth check: are the slow frames spread out, or bunched?
    const RAMP = ' .:-=+*#%@';
    const BUCKETS = 60;
    const per = Math.max(1, Math.ceil(result.frames.length / BUCKETS));
    const cells = [];
    for (let i = 0; i < result.frames.length; i += per) {
      const chunk = result.frames.slice(i, i + per);
      cells.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
    }
    const peak = Math.max(...cells, 1);
    console.log('');
    console.log(`timeline (${per} frame(s)/cell, peak ${peak.toFixed(0)}ms):`);
    console.log('  ' + cells.map(v => RAMP[Math.min(9, Math.floor(v / peak * 9))]).join(''));

    if (problems.length) {
      console.log('');
      console.log('page problems:');
      for (const p of problems.slice(0, 5)) console.log('  ' + p);
    }
  } finally {
    // A guest that is blocking the main thread can make the graceful close hang
    // for as long as it likes, and a hung close is the same leak by a different
    // route -- so give it 10s and then take the process out.
    await Promise.race([
      browser.close().catch(() => {}),
      new Promise(r => setTimeout(r, 10000)),
    ]);
    try { const p = browser.process(); if (p && !p.killed) p.kill('SIGKILL'); } catch (_) {}
    if (server) server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { killStaleBrowsers, OWNER_FILE, PROFILE_PREFIX };
