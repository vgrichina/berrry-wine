#!/usr/bin/env node
// Drive an app in the real browser with scripted mouse input and read state back.
//
//   node tools/web-input-probe.js --app=mspaint98 \
//        --steps='wait:4000;move:180,200;move:180,331' [--eval='expr'] [--cpu=2]
//
// WHY THIS EXISTS: test/run.js shares lib/renderer-input.js and the wasm with
// the browser, so it can answer "does WAT pick the right cursor". It cannot
// answer "does the *page* show it" — the CLI has no canvas.style.cursor, no
// pointer, and no CSS. tools/profile-web-frames.js does drive the real page,
// but only launches and samples frame timing; it has no mouse scripting.
// Anything of the form "WAT looks right, the browser looks wrong" needs this.
//
// Coordinates are GUEST canvas pixels (the same numbers test/run.js takes for
// --input=B:mousemove:X:Y). They are converted to page coordinates through the
// canvas bounding rect, so the CSS scaling of #screen-wrap is accounted for.
//
// Steps (semicolon separated, left to right):
//   move:X,Y      move the pointer to guest pixel X,Y
//   click:X,Y     move, then press and release the left button (60ms hold)
//   qclick:X,Y    the same with no hold: press and release in one tick, as a
//                 fast click or a tap reaches a busy guest (both queued together)
//   tap:X,Y       a touchscreen tap (needs --touch); drives the touch bridge,
//                 which `click` never reaches
//   down:X,Y      / up:X,Y   — the halves of a drag
//   rdown:X,Y     / rup:X,Y  — the same with the right button (an RTS move order)
//   key:Name      keyboard press (puppeteer key name, e.g. Enter, KeyA); a
//                 combo holds its modifiers: key:Alt+KeyS, key:Shift+F2
//   keydown:Name  / keyup:Name — hold a key across wait: steps (a frame-polled
//                 game misses a key: press, which releases in the same tick)
//   type:TEXT     type literal text through browser key events
//   wait:MS       idle, letting the guest run
//   eval:EXPR     evaluate EXPR in the page and print its result
//   evalfile:PATH evaluate the contents of PATH in the page (no ';' escaping)
//   shot:PATH     screenshot to PATH
//
// `--eval=@PATH` reads the final readout expression from a file too. Reach for
// the file forms for anything longer than one expression: steps split on ';',
// so an inline `eval:` has to escape every semicolon and one slip costs a whole
// launch to discover.
//
// After every step the CSS cursor of the canvas is printed, since that is the
// pixel-visible answer to "what does the user see under the pointer".
// A `viewport:667x375` step rotates the emulated device mid-run, which is the
// only way to reach the state a few rotations on a real phone leave behind.
// --viewport=WxH[@DPR] and --touch emulate a device; a phone-sized viewport
// puts index.html into single-app mode (add `single-app=1` to --query to force
// it regardless of the emulated screen size).
//
// --gpu runs the page on SwiftShader instead of Chrome's default --disable-gpu,
// so the WebGL presentation paths (scale-auto, fsr1, dedither, CRT) actually
// run. Without it every presentation falls back to 2D canvas and a GPU-only
// bug looks fixed.
//
// --url=https://host drives that origin instead of this working tree, which is
// how a "works locally, broken on the deployed site" report gets checked.
//
// --cpu=N applies Chrome's CPU throttling while preserving real browser audio
// timing, which is useful for scheduler-sensitive game/audio failures.
//
// --threads opts into the isolated guest-Worker backend before page scripts
// run. Point --url at `tools/dev-server.js --isolate` (or another COOP/COEP
// origin); otherwise the page correctly falls back to cooperative execution.
//
// --lan=solo|local|cancel answers the virtual-LAN lobby a `lan:` app puts up
// before it boots (default solo). Without it the launch waits on a button
// nobody is there to click and the probe times out.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(`--${name}=`));
  return a === undefined ? dflt : a.slice(name.length + 3);
};

const APP = opt('app', 'mspaint98');
// The launch controls are intentionally hidden in the normal desktop view.
// This is a diagnostic driver, so default to the debug shell that exposes the
// Program selector and trusted Launch button.
const QUERY = opt('query', '?debug');
// Steps are semicolon-separated, but an `eval:` step is JavaScript and wants
// semicolons of its own. `\;` escapes one so real statements can be written
// without contorting them into comma expressions.
const STEPS = (opt('steps', '') || '')
  .split(/(?<!\\);/)
  .map(s => s.trim().replace(/\\;/g, ';'))
  .filter(Boolean);
const READY_MS = Number(opt('ready', 6000));
const LAUNCH_MS = Number(opt('launch', 90000));
// The "Starting <app>" launch window sits over the page until the shell
// recognises the app's first window. Input sent while it is up is input the
// app may never see, so steps wait for it to come down first, up to this
// long; a window that never clears is reported as `launcher: STILL UP`
// (mobile-app-sweep.js records it per row) instead of passing silently.
const LAUNCHER_MS = Number(opt('launcher-wait', 60000));
const PROTOCOL_TIMEOUT_MS = Number(opt('protocol-timeout', 600000));
// How long browser.close() may take before Chrome is killed outright.
const CLOSE_TIMEOUT_MS = 20000;
const CPU_RATE = Number(opt('cpu', 1));
const THREADS = argv.includes('--threads');
const PRESENTATION_SCALE = opt('scale', '');
// A LAN-capable app (lib/apps.js `lan:`) shows the vlan lobby before it boots
// and the launch blocks on a button nobody clicks in a headless run, so the
// probe used to time out waiting for runningApps. Answer it the way a person
// would: solo | local ("Both players here") | cancel.
const LAN_ANSWER = opt('lan', 'solo');
// Headless Chrome runs with --disable-gpu by default, which sends presentation
// down the 2D canvas paths. A real phone browser has WebGL and takes the GPU
// paths instead, so bugs that only exist there (a viewport crop the shaders
// ignore) are invisible without --gpu, which swaps in SwiftShader.
const GPU = argv.includes('--gpu');
// --auto-launch: the page starts the app itself from ?app= (the private ops
// route /emulator/?app=ID, or index.html?app=ID), so there is no Launch button
// or desktop icon to press; skip straight to waiting for the running app.
const AUTO_LAUNCH = argv.includes('--auto-launch');
// --headful opens a visible Chrome window on the real GPU. Headless Chrome has
// no compositor or display refresh, so any duration quoted from a run (how
// long a save takes, how fast a screen advances) needs this.
const HEADFUL = argv.includes('--headful');
// iPhone Safari exposes NO element Fullscreen API -- not requestFullscreen,
// not the webkit spelling, on anything that is not a <video>. Chrome always
// has it, so the only way to drive the fallback the page uses there is to take
// the API away before any page script runs. --touch alone does not do this:
// an emulated phone in Chrome still reports full fullscreen support.
const NO_FULLSCREEN_API = argv.includes('--no-fullscreen-api');
// Base origin to drive. Empty = serve this working tree over a temp server.
const URL_BASE = (opt('url', '') || '').replace(/\/+$/, '');
// A phone is a different page, not a smaller one: single-app mode, no taskbar,
// a phone-sized emulated screen. --viewport=390x844 (optionally with a
// device-pixel ratio, 390x844@3) and --touch reproduce one.
const VIEWPORT = (() => {
  const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(opt('viewport', '1280x900'));
  if (!m) throw new Error('--viewport must look like 390x844 or 390x844@3');
  return {
    width: Number(m[1]),
    height: Number(m[2]),
    deviceScaleFactor: m[3] ? Number(m[3]) : 1,
    hasTouch: argv.includes('--touch'),
    isMobile: argv.includes('--touch'),
  };
})();
// `--eval=@path` reads the expression from a file, so a readout with
// semicolons in it does not have to be escaped past the shell and the step
// splitter both.
const FINAL_EVAL_RAW = opt('eval', '');
// --before-load=JS (or @PATH): run in every new document before any page script,
// as profile-web-frames.js's flag does. The seam for changing what the page
// itself reads at startup, e.g. an app's registry args:
//   Object.defineProperty(window, 'wineApps', { configurable: true,
//     set(v) { v.APPS.ut348_demo.args = 'DM-Morpheus -window'; this._wa = v; },
//     get() { return this._wa; } })
const BEFORE_LOAD_RAW = opt('before-load', '');
const BEFORE_LOAD = BEFORE_LOAD_RAW.startsWith('@')
  ? fs.readFileSync(BEFORE_LOAD_RAW.slice(1), 'utf8') : BEFORE_LOAD_RAW;
const FINAL_EVAL = FINAL_EVAL_RAW.startsWith('@')
  ? require('fs').readFileSync(FINAL_EVAL_RAW.slice(1), 'utf8')
  : FINAL_EVAL_RAW;
// --trace=dx,gdi turns on the same trace categories test/run.js exposes as
// --trace-dx / --trace-gdi, inside the page. host.js hands
// window.__waTraceCategories to lib/host-imports.js as ctx.trace, so the
// browser prints the identical [dx]/[gdi] lines. --console-out=FILE captures
// every console line the page emits (a traced run is far too chatty for the
// terminal).
const TRACE = (opt('trace', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const CONSOLE_OUT = opt('console-out', '');
// --trace-api=Name1,Name2 is the page's --trace-api=NAMES: host.js already
// reads window.__waTraceApiNames, this just fills it before the app launches.
const TRACE_API = (opt('trace-api', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const BEFORE_LAUNCH = opt('before-launch', '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
    fs.stat(file, (error, st) => {
      if (error || !st.isFile()) {
        res.writeHead(error && error.code !== 'ENOENT' ? 500 : 404);
        res.end((error && error.code) || 'not a file');
        return;
      }
      const headers = Object.assign({
        'Content-Type': mimeType(file), 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes',
      }, THREADS ? {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      } : {});
      // One byte range, as tools/dev-server.js serves it. The page's lazy file
      // loader (HttpRangeProvider) refuses a 200 to its Range request, so
      // without this an app with on-demand data -- Dungeons of Dredmor's
      // tweakdb.xml -- stopped on "the server answered HTTP 200" here only.
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        let start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]);
        let end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        if (start >= st.size || start > end) {
          res.writeHead(416, Object.assign(headers, { 'Content-Range': `bytes */${st.size}` }));
          res.end();
          return;
        }
        res.writeHead(206, Object.assign(headers, {
          'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1,
        }));
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// The on-screen desktop canvas. NOT `querySelector('canvas')`: #screen-present
// (the GPU presentation target) comes first in the DOM and is display:none, so
// its bounding rect is all zeroes -- mapping through it silently collapsed
// every guest pixel to page (0,0) and the clicks landed on BODY.
// Guest canvas pixel -> page coordinate, through the live bounding rect.
async function toPage(page, gx, gy) {
  return page.evaluate(([x, y]) => {
    const c = document.getElementById('screen') ||
      [...document.querySelectorAll('canvas')].find(el => el.getBoundingClientRect().width > 0);
    const r = c.getBoundingClientRect();
    // Exclusive fullscreen and single-app mode present a crop of the desktop
    // canvas scaled to the display, so guest pixels are not canvas pixels.
    // Invert that viewport the same way renderer-input maps a tap back.
    const v = typeof sharedRenderer !== 'undefined' && sharedRenderer &&
      sharedRenderer._exclusivePresentationViewport;
    let cx = x + 0.5;
    let cy = y + 0.5;
    if (v && v.nativeW > 0 && v.nativeH > 0 && v.outputW > 0 && v.outputH > 0) {
      cx = (v.dstX + (x + 0.5 - v.nativeX) * v.dstW / v.nativeW) * c.width / v.outputW;
      cy = (v.dstY + (y + 0.5 - v.nativeY) * v.dstH / v.nativeH) * c.height / v.outputH;
    }
    return {
      x: r.left + cx * (r.width / c.width),
      y: r.top + cy * (r.height / c.height),
    };
  }, [gx, gy]);
}

// What the launch window shows right now: null when it is down, else its kind
// and title. Reads the DOM, not the model, because the DOM is what covers the
// game and what a click or key would land on.
async function readLauncher(page) {
  return page.evaluate(() => {
    const lw = document.getElementById('wine-launch-window');
    if (!lw || lw.hidden || lw.classList.contains('wa-launch-minimized')) return null;
    const r = lw.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const a = document.activeElement;
    return {
      kind: lw.classList.contains('wa-launch-error') ? 'error' : 'progress',
      title: ((document.getElementById('wine-launch-title') || {}).textContent || '').trim(),
      status: ((lw.querySelector('.wa-launch-status') || {}).textContent || '').trim().slice(0, 120),
      focusInside: !!(a && lw.contains(a)),
    };
  }).catch(() => null);
}

async function waitForLauncher(page, ms) {
  const t0 = Date.now();
  let last = await readLauncher(page);
  while (last && Date.now() - t0 < ms) {
    await wait(250);
    last = await readLauncher(page);
  }
  const dt = Date.now() - t0;
  if (last) console.log(`launcher: STILL UP after ${dt}ms ${JSON.stringify(last)}`);
  else console.log(`launcher: cleared after ${dt}ms`);
  return !last;
}

const readCursor = page => page.evaluate(() => {
  const c = document.getElementById('screen') ||
    [...document.querySelectorAll('canvas')].find(el => el.getBoundingClientRect().width > 0);
  const inline = c.style.cursor;
  const computed = getComputedStyle(c).cursor;
  // A custom cursor is a long data: URL; name it rather than printing 30KB.
  const shorten = v => (v && v.startsWith('url(')
    ? `custom(${v.length} chars)${v.includes('),') ? ' fallback=' + v.slice(v.lastIndexOf('), ') + 3) : ''}`
    : v);
  return { inline: shorten(inline), computed: shorten(computed) };
});

// Close Chrome AND let go of its stdio, or this process never exits.
//
// Puppeteer spawns Chrome with stdout/stderr as pipes into this process. A
// branded Chrome on macOS hands those same descriptors to the helpers it
// starts, and one of them is not Chrome's to stop: on startup Chrome wakes
// GoogleUpdater (`GoogleUpdater --wake-all --system`, reparented to launchd),
// which inherits fds 1 and 2 and keeps running for minutes after the browser
// is gone. Node holds the event loop open on those pipes until they EOF, so
// the probe printed everything, closed the browser in ~400ms, and then sat
// until mobile-app-sweep's 240s SIGKILL (`exit: null`). The wake is throttled
// system-wide, so only the first Chrome(s) launched in a window spawn it --
// which is why the first two jobs of a sweep hung and every later one exited.
// No Chrome switch suppresses the wake, so the fix is here: once the browser
// has closed, nothing it left behind may keep us alive.
async function closeBrowser(browser) {
  const proc = browser.process();
  let timer;
  const graceful = browser.close().then(() => true, () => false);
  // Bounded fallback: a graceful close waits for the browser process to exit
  // with no limit of its own.
  const ok = await Promise.race([graceful,
    new Promise(r => { timer = setTimeout(() => r(false), CLOSE_TIMEOUT_MS); })]);
  clearTimeout(timer);
  if (!ok && proc && proc.exitCode === null && proc.signalCode === null) {
    console.error(`browser.close did not finish in ${CLOSE_TIMEOUT_MS}ms; killing Chrome pid ${proc.pid}`);
    proc.kill('SIGKILL');
  }
  if (proc) {
    for (const s of [proc.stdin, proc.stdout, proc.stderr, ...(proc.stdio || [])]) {
      if (s && !s.destroyed) s.destroy();
    }
  }
}

async function main() {
  // --url points the probe at an already-running origin (the deployed site, or
  // a dev server) instead of serving the working tree. "It works here but not
  // on wine-assembly.berrry.app" is otherwise unanswerable from this tool.
  const server = URL_BASE ? null : await startStaticServer();
  const base = URL_BASE || `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-assembly-input-'));
  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    executablePath: CHROME,
    userDataDir: profile,
    defaultViewport: HEADFUL ? null : undefined,
    // Every CDP call this tool makes lands on a page whose main thread is
    // running an x86 interpreter, and the guest slice is not preemptible. A
    // heavy app (Winamp, StarCraft, Heroes II, RollerCoaster Tycoon) on a
    // loaded box starves the polling evaluate behind waitForFunction past
    // puppeteer's 180s default, and it surfaces as
    // "Runtime.callFunctionOn timed out" -- which reads exactly like the app
    // failing to launch, and is not. Raise it well past any wait we ask for.
    protocolTimeout: PROTOCOL_TIMEOUT_MS,
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check'].concat(
      HEADFUL ? [`--window-size=${VIEWPORT.width},${VIEWPORT.height + 120}`]
        : GPU
          ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
          : ['--disable-gpu']),
  });
  const problems = [];
  try {
    const page = await browser.newPage();
    if (CPU_RATE > 1) {
      const cdp = await page.target().createCDPSession();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
    }
    await page.setViewport(VIEWPORT);
    // Stack, not just the message: a bare "Cannot read properties of null"
    // names neither the file nor the caller, which is most of what you need.
    page.on('pageerror', e => problems.push((e && e.stack) || String(e)));
    // A later step failing with "Attempted to use detached Frame" says only
    // that the page went away. A renderer crash (OOM on a loaded box) and a
    // reload or navigation of the main frame look identical there, so name
    // whichever happened, with the time, the moment it happens.
    const probeStart = Date.now();
    const stamp = () => `+${((Date.now() - probeStart) / 1000).toFixed(1)}s`;
    page.on('error', e => console.log(`PAGE CRASHED ${stamp()}: ${(e && e.message) || e}`));
    page.on('close', () => console.log(`PAGE CLOSED ${stamp()}`));
    let mainLoads = 0;
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && ++mainLoads > 1) {
        console.log(`PAGE NAVIGATED ${stamp()}: main frame is now ${frame.url()}`);
      }
    });
    const consoleLines = [];
    // Chrome's own console line for a failed fetch is "Failed to load resource:
    // the server responded with a status of 404 (Not Found)" and names NOTHING
    // -- not the URL, not the initiator. A run with 47 of those says only that
    // something is missing. The response event has the URL, so record it.
    page.on('response', r => {
      if (r.status() >= 400 && CONSOLE_OUT) {
        consoleLines.push(`[http ${r.status()}] ${r.url()}`);
      }
    });
    page.on('console', m => {
      const t = m.text();
      if (CONSOLE_OUT) consoleLines.push(t);
      if (/UNIMPLEMENTED API:|RuntimeError|LinkError|crashed|FATAL:/i.test(t)) problems.push(t);
    });
    if (CONSOLE_OUT) {
      const flush = () => fs.writeFileSync(CONSOLE_OUT, consoleLines.join('\n') + '\n');
      setInterval(flush, 2000).unref();
      process.on('exit', flush);
    }
    if (TRACE.length || TRACE_API.length) {
      await page.evaluateOnNewDocument((cats, apis) => {
        if (cats.length) window.__waTraceCategories = new Set(cats);
        if (apis.length) window.__waTraceApiNames = new Set(apis);
      }, TRACE, TRACE_API);
    }
    if (BEFORE_LOAD) await page.evaluateOnNewDocument(BEFORE_LOAD);
    if (NO_FULLSCREEN_API) {
      await page.evaluateOnNewDocument(() => {
        for (const name of ['requestFullscreen', 'webkitRequestFullscreen',
                            'mozRequestFullScreen', 'msRequestFullscreen']) {
          delete Element.prototype[name];
        }
      });
    }
    {
      // Threads are the page default now, so a cooperative probe says so.
      await page.evaluateOnNewDocument((threads, scale) => {
        localStorage.setItem('wine-assembly.threads', threads ? '1' : '0');
        if (scale) localStorage.setItem('wine-assembly:2d-scale', scale);
      }, THREADS, PRESENTATION_SCALE);
    }
    await page.goto(`${base}/index.html${QUERY}`, { waitUntil: 'load', timeout: 60000 });
    // Start from an empty profile, then RELOAD. lib/storage.js seeds its
    // default registry (RCT's install Path, Plus!98 MediaDirectory, ...) once
    // at script load, so clearing localStorage after the page is up deletes
    // seeds nothing puts back: RCT then reads an empty install path, writes
    // its scenario index to the drive root and dies in its own GSK Error
    // Trapper -- a failure no real visitor can reach.
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('typeof launchApp === "function"', { timeout: 60000 });

    console.log(`launching ${APP} ...`);
    if (BEFORE_LAUNCH) {
      await page.evaluate(js => (0, eval)(js), BEFORE_LAUNCH);
    }
    if (!AUTO_LAUNCH) {
    await page.evaluate(app => {
      const sel = document.getElementById('app-select');
      if (typeof apps === 'undefined' || !apps[app]) throw new Error(`index.html has no app named ${app}`);
      if (![...sel.options].some(o => o.value === app)) {
        const o = document.createElement('option');
        o.value = app; o.textContent = app; sel.appendChild(o);
      }
      stopAllApps();
      sel.value = app;
    }, APP);
    // A fresh shipping profile opens the Read Me over the desktop. Dismiss it
    // before locating the icon or the synthetic double-click hits its text.
    await page.evaluate(() => {
      const readme = document.getElementById('readme-window');
      if (readme && !readme.hidden && typeof closeReadme === 'function') closeReadme();
    });
    // Use a trusted browser gesture for launch. AudioContext.resume() is
    // gated on user activation, so calling launchApp() through evaluate()
    // silently exercises a suspended-audio path that real users never take.
    // Without ?debug there is no Launch button — the shipping desktop starts
    // an app by double-clicking its icon, which is also the only launch path a
    // phone has. Fall back to it so the real page can be driven too.
    const launchPoint = await page.evaluate(app => {
      const visible = el => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
          getComputedStyle(el).visibility !== 'hidden';
      };
      const centre = el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };
      const button = [...document.querySelectorAll('button[onclick="launchApp()"]')].find(visible);
      if (button) return { ...centre(button), icon: false };
      const icon = document.querySelector(`.desktop-icon[data-app="${app}"]`);
      if (!visible(icon)) throw new Error(`no visible Launch button and no desktop icon for ${app}`);
      // On a phone the icon grid is a scroller with every app in it, so an
      // icon near the end of the list has a real size and a real position --
      // several screens below the viewport. Clicking its centre then clicks
      // nothing at all, and the run dies 90s later in the wait for
      // runningApps with an empty #status and no boot ever started, which
      // reads exactly like the app failing to launch. Winamp, StarCraft,
      // Heroes II and RollerCoaster Tycoon are all down there.
      icon.scrollIntoView({ block: 'center', behavior: 'instant' });
      const point = centre(icon);
      if (point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) {
        throw new Error(`desktop icon for ${app} is off-screen at ` +
          `${Math.round(point.x)},${Math.round(point.y)} in ${innerWidth}x${innerHeight}`);
      }
      const hit = document.elementFromPoint(point.x, point.y)?.closest('.desktop-icon');
      if (hit !== icon) {
        throw new Error(`desktop icon for ${app} is covered at ` +
          `${Math.round(point.x)},${Math.round(point.y)} by ` +
          `${document.elementFromPoint(point.x, point.y)?.outerHTML?.slice(0, 120) || 'nothing'}`);
      }
      return { ...point, icon: true };
    }, APP);
    await page.mouse.click(launchPoint.x, launchPoint.y);
    // The desktop's own handler counts two click events within 500ms.
    if (launchPoint.icon) {
      await wait(80);
      await page.mouse.click(launchPoint.x, launchPoint.y);
    }
    }
    // The lobby appears asynchronously (it is awaited inside launchApp), so
    // poll for it rather than assuming it is up on the next tick.
    for (let i = 0; i < 60; i++) {
      const answered = await page.evaluate(answer => {
        const overlay = document.querySelector('.vln-lobby');
        if (!overlay) return null;
        const buttons = [...overlay.querySelectorAll('button')];
        const want = { solo: /play solo/i, local: /both players/i, cancel: /cancel/i }[answer];
        const button = want && buttons.find(b => want.test(b.textContent || ''));
        if (!button) return `no ${answer} button (saw: ${buttons.map(b => b.textContent).join(', ')})`;
        button.click();
        return `clicked "${button.textContent}"`;
      }, LAN_ANSWER);
      if (answered) { console.log(`lan lobby: ${answered}`); break; }
      await wait(250);
    }

    // How long the app gets to exist at all. 90s covers everything in the
    // corpus on an idle box, but this machine regularly sits at load 40+ with
    // several agents sweeping, and the heavy apps (Winamp's DLL graph,
    // StarCraft, Heroes II, RollerCoaster Tycoon's 76 data files) then time
    // out here and report as a launch failure they are not. --launch= raises
    // it rather than making every run wait longer.
    try {
      await page.waitForFunction(
        'typeof runningApps !== "undefined" && runningApps.length > 0 && typeof sharedRenderer !== "undefined" && sharedRenderer',
        { timeout: LAUNCH_MS });
    } catch (e) {
      // A launch timeout on its own says nothing about WHY. The shell narrates
      // its own boot into #status ("Loading PE...", "Loading DLLs...",
      // "Loading data files... 14/76", "Failed to load"), so read that before
      // giving up: a boot parked on one phase is a different bug from a boot
      // that never started, and both look identical from out here.
      const diag = await page.evaluate(() => {
        const text = el => (el && el.textContent || '').trim().slice(0, 300);
        return {
          status: text(document.getElementById('status')),
          running: typeof runningApps === 'undefined' ? 'undefined' : runningApps.length,
          renderer: typeof sharedRenderer !== 'undefined' && !!sharedRenderer,
          body: document.body.className,
          dialogs: [...document.querySelectorAll('.modal, .dialog, .vln-lobby')].map(text),
        };
      }).catch(err => ({ diagFailed: err.message }));
      console.log(`launch diag ${JSON.stringify(diag)}`);
      throw e;
    }
    await waitForLauncher(page, LAUNCHER_MS);
    await wait(READY_MS);
    console.log(`ready  cursor=${JSON.stringify(await readCursor(page))}`);

    for (const step of STEPS) {
      const colon = step.indexOf(':');
      const kind = colon < 0 ? step : step.slice(0, colon);
      const rest = colon < 0 ? '' : step.slice(colon + 1);
      if (kind === 'wait') {
        await wait(Number(rest) || 0);
      } else if (kind === 'eval') {
        const v = await page.evaluate(async expr => {
          try { return JSON.stringify(await eval(expr)); } catch (e) { return 'ERROR: ' + e.message; }
        }, rest);
        console.log(`eval ${rest} => ${v}`);
        continue;
      } else if (kind === 'evalfile') {
        // Steps split on ';', so an `eval:` step has to escape every semicolon
        // it contains and any real instrumentation becomes unreadable — and a
        // mis-escape shows up as "Invalid or unexpected token" after the whole
        // launch has already been paid for. Read the script from a file
        // instead; its last expression is the value, same as `eval:`.
        const source = require('fs').readFileSync(rest, 'utf8');
        const v = await page.evaluate(async expr => {
          try { return JSON.stringify(await eval(expr)); } catch (e) { return 'ERROR: ' + e.message; }
        }, source);
        console.log(`evalfile ${rest} => ${v}`);
        continue;
      } else if (kind === 'viewport') {
        // Rotation, mid-run. A phone bug can need several of these: the page
        // re-sizes the guest desktop on every one, and what that does to a
        // window depends on the state the previous rotation left behind.
        const vm = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(rest);
        if (!vm) throw new Error(`viewport step must look like 667x375: "${step}"`);
        await page.setViewport({
          ...VIEWPORT,
          width: Number(vm[1]),
          height: Number(vm[2]),
          deviceScaleFactor: vm[3] ? Number(vm[3]) : VIEWPORT.deviceScaleFactor,
        });
        console.log(`viewport ${rest}`);
      } else if (kind === 'shot') {
        await page.screenshot({ path: rest });
        console.log(`shot ${rest}`);
        continue;
      } else if (kind === 'key') {
        // `Alt+KeyS`, `Shift+F2`: hold the leading modifiers around the press.
        const keys = rest.split('+');
        const last = keys.pop();
        for (const k of keys) await page.keyboard.down(k);
        await page.keyboard.press(last);
        for (const k of keys.reverse()) await page.keyboard.up(k);
      } else if (kind === 'keydown' || kind === 'keyup') {
        // The halves of a held key. `key:` releases in the same tick it
        // presses, which a game polling a key table once a frame never sees
        // at all (Moorhuhn's title): hold with keydown, wait, keyup.
        await page.keyboard[kind === 'keydown' ? 'down' : 'up'](rest);
      } else if (kind === 'type') {
        await page.keyboard.type(rest);
      } else if (kind === 'tap') {
        // A real finger, not a mouse: `click` drives page.mouse and therefore
        // exercises none of the touchstart/touchend bridge, which is where the
        // phone-only input bugs live. Needs --touch (an emulated device
        // without a touchscreen has nothing to dispatch to).
        const [gx, gy] = rest.split(',').map(Number);
        const p = await toPage(page, gx, gy);
        await page.touchscreen.tap(p.x, p.y);
      } else if (kind === 'pressel') {
        // A real mouse press on a page element (a taskbar button) held for
        // MS before the release: `pressel:#task-buttons .task-btn@1000`. The
        // page keeps repainting during the hold, which a click step's 60 ms
        // press almost never spans (TASKBAR-RESTORE-INPUT).
        const at = rest.lastIndexOf('@');
        const sel = at > 0 ? rest.slice(0, at) : rest;
        const ms = at > 0 ? Number(rest.slice(at + 1)) : 150;
        const p = await page.evaluate(s => {
          const el = document.querySelector(s);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, sel);
        if (!p) throw new Error(`pressel: no element matches ${sel}`);
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await wait(ms);
        await page.mouse.up();
        console.log(`pressel ${sel} at ${Math.round(p.x)},${Math.round(p.y)} held ${ms} ms`);
      } else if (kind === 'move' || kind === 'click' || kind === 'qclick' || kind === 'dbl'
                 || kind === 'down' || kind === 'up' || kind === 'rdown' || kind === 'rup') {
        const [gx, gy] = rest.split(',').map(Number);
        const p = await toPage(page, gx, gy);
        await page.mouse.move(p.x, p.y);
        if (kind === 'click') { await page.mouse.down(); await wait(60); await page.mouse.up(); }
        else if (kind === 'qclick') { await page.mouse.down(); await page.mouse.up(); }
        // A double-click has to happen inside one step: every step is followed
        // by a settle wait, so two `click` steps are always further apart than
        // any guest's double-click time. Diablo's Choose Class screen confirms
        // on a double-click and looked unresponsive until this existed.
        else if (kind === 'dbl') {
          await page.mouse.click(p.x, p.y, { clickCount: 1 });
          await wait(40);
          await page.mouse.click(p.x, p.y, { clickCount: 2 });
        }
        else if (kind === 'down') await page.mouse.down();
        else if (kind === 'up') await page.mouse.up();
        else if (kind === 'rdown') await page.mouse.down({ button: 'right' });
        else if (kind === 'rup') await page.mouse.up({ button: 'right' });
      } else {
        throw new Error(`unknown step "${step}"`);
      }
      // Give the guest pump a few slices to consume the input before reading.
      await wait(400);
      const cur = await readCursor(page);
      console.log(`${step.padEnd(18)} cursor inline=${cur.inline || '(unset)'} computed=${cur.computed}`);
    }

    // A launch window that comes back (an error) or never left is part of
    // what the final picture shows; say so next to it.
    const endLauncher = await readLauncher(page);
    console.log(`launcher at end: ${endLauncher ? JSON.stringify(endLauncher) : 'down'}`);

    if (FINAL_EVAL) {
      const v = await page.evaluate(async expr => {
        try { return JSON.stringify(await eval(expr)); } catch (e) { return 'ERROR: ' + e.message; }
      }, FINAL_EVAL);
      console.log(`eval => ${v}`);
    }
  } finally {
    await closeBrowser(browser);
    if (server) {
      server.closeAllConnections();
      server.close();
    }
    fs.rmSync(profile, { recursive: true, force: true });
  }
  if (problems.length) {
    console.log('\npage problems:');
    for (const p of problems.slice(0, 20)) console.log('  ' + p);
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { startStaticServer };
