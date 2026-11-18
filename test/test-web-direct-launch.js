#!/usr/bin/env node
// Direct ?app= links and the launch window, in a real browser.
//
// WHY: a direct link used to build the whole desktop first -- ~90 icon images,
// seven whole executables fetched only for their icons, the teal desktop and
// taskbar painted -- and only then, after `load`, start the program, with a
// busy cursor as the only feedback. The approved design
// (ops/handoffs/claude-launch-ux-design-20261003.md) replaces that with: no
// desktop work or paint on a direct link, only the runtime plus the selected
// program's files on the wire, and a Win98 "File Download" window that
// appears only when a launch is still pending 500ms after it was asked for.
//
// The 500ms timing rules themselves are proved on a fake clock in
// test/test-launch-progress.js, where a boundary cannot be blurred by machine
// load. This test proves what only a browser can: what was requested, what
// was painted, and that the window's states are reachable with real
// downloads. The server slows, stalls, strips the size from, or fails
// individual files, so each state is forced rather than hoped for.
//
// Stages: direct link with a known size, unknown size + stall on a landscape
// phone, failure + Retry on a portrait phone, Cancel, the desktop with a
// running app, a warm relaunch, and the browser cache. Screenshots go to
// build/direct-launch-web/ and a JSON receipt of every stage's measurements
// to build/direct-launch-web/receipt.json.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'direct-launch-web');
const CHROME = process.env.CHROME ||
  ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    .find(p => fs.existsSync(p));
const SOL_EXE = '/binaries/entertainment-pack/sol.exe';
// What a direct ?app=sol link may fetch beyond the shared runtime.
const SOL_FILES = new Set([
  SOL_EXE,
  '/binaries/entertainment-pack/cards.dll',
  '/binaries/help/sol.hlp',
  '/icons/apps/sol.png',
]);
const STAGE_MS = 60000;

if (!CHROME) {
  console.log('SKIP  Chrome not found for direct-launch test');
  process.exit(0);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rules = new Map();
const requests = [];
let cacheable = false;
let failures = 0;
const receipt = { stages: {} };

function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}${detail ? ` -- ${detail}` : ''}`); }
}

// The server's half of each stage: serve one file slowly, with or without a
// size, stall it, or fail it outright.
async function handleRequest(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  requests.push({ path: pathname, at: Date.now() });
  const rule = rules.get(pathname);
  if (!rule) return false;
  if (rule.status) {
    response.writeHead(rule.status, { 'Cache-Control': 'no-store' });
    response.end('unavailable');
    return true;
  }
  const data = fs.readFileSync(path.join(ROOT, pathname));
  const headers = { 'Content-Type': pathname.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'Cache-Control': 'no-store' };
  if (!rule.noLength) headers['Content-Length'] = data.length;
  response.writeHead(200, headers);
  let closed = false;
  response.on('close', () => { closed = true; });
  const chunk = rule.chunk || 2048;
  let stalled = false;
  for (let off = 0; off < data.length && !closed; off += chunk) {
    if (rule.stallAt != null && off >= rule.stallAt && !stalled) {
      stalled = true;
      await sleep(rule.stallMs);
    }
    response.write(data.subarray(off, off + chunk));
    await sleep(rule.delay || 100);
  }
  if (!closed) response.end();
  return true;
}

// Installed before any page script: one sample per animation frame of what
// is on screen -- the launch window's state and title, whether any app window
// exists yet, and whether any desktop furniture is visible.
function installProbe() {
  const P = window.__launchProbe = { states: [], desktopSeen: 0, taskbarSeen: 0, firstDesktopAt: null };
  let lastKey = '';
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const tick = () => {
    const t = performance.now();
    if (document.body) {
      const lw = document.getElementById('wine-launch-window');
      const shown = !!lw && !lw.hidden && !lw.classList.contains('wa-launch-minimized') && visible(lw);
      let kind = 'hidden';
      if (shown) {
        kind = lw.classList.contains('wa-launch-error') ? 'error'
          : (!lw.querySelector('.wa-launch-err').hidden ? 'card' : 'progress');
      }
      const title = shown ? (document.getElementById('wine-launch-title') || {}).textContent : '';
      const shell = window.wineShell;
      const firstWindow = !!(shell && shell.runningApps &&
        shell.runningApps.some(r => r && r.wine && shell.firstTopLevelWindow(r.wine)));
      const key = `${kind}|${title}|${firstWindow}`;
      if (key !== lastKey) {
        lastKey = key;
        P.states.push({ t: Math.round(t), kind, title, firstWindow });
      }
      const icon = document.querySelector('#desktop-icons .desktop-icon');
      if (icon && visible(icon)) {
        P.desktopSeen++;
        if (P.firstDesktopAt == null) P.firstDesktopAt = Math.round(t);
      }
      if (visible(document.getElementById('taskbar'))) P.taskbarSeen++;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function newPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(installProbe);
  page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
  // DIRECT_LAUNCH_CONSOLE=1: the page console and every failed request, which
  // is what names a stage timing out because a file was refused.
  if (process.env.DIRECT_LAUNCH_CONSOLE) {
    page.on('console', m => console.log(`  [console] ${m.text().slice(0, 300)}`));
    page.on('response', r => { if (r.status() >= 400) console.log(`  [http ${r.status()}] ${r.url()}`); });
    page.on('requestfailed', r => console.log(`  [reqfail] ${r.url()} ${r.failure() && r.failure().errorText}`));
  }
  return page;
}

const probe = page => page.evaluate(() => window.__launchProbe);
const waitState = (page, fn, arg, timeout = STAGE_MS) =>
  page.waitForFunction(fn, { timeout, polling: 50 }, arg);

function firstWith(states, pred) { return states.find(pred) || null; }

async function directStageKnownSize(browser, base) {
  rules.clear();
  rules.set(SOL_EXE, { chunk: 2048, delay: 80 });  // ~2.4s, size sent
  requests.length = 0;
  const page = await newPage(browser, { width: 1024, height: 768 });
  const navAt = Date.now();
  await page.goto(`${base}/index.html?app=sol`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
  await waitState(page, () => /% of SOL\.EXE$/.test(
    (document.getElementById('wine-launch-title') || {}).textContent || ''));
  await page.screenshot({ path: path.join(OUT, 'direct-known-size.png') });
  const midModel = await page.evaluate(() => window.wineLaunchUi.current.model());
  const details = await page.$('#wine-launch-window [data-action="details"]');
  const box = await details.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(200); // several real download updates between press and release
  await page.mouse.up();
  check('progress redraw preserves a pressed Details button',
    await page.$eval('#wine-launch-window .wa-launch-details', el => !el.hidden));
  await waitState(page, () => window.__launchProbe.states.some(s => s.firstWindow));
  await sleep(300);
  const p = await probe(page);
  await page.screenshot({ path: path.join(OUT, 'direct-app-running.png') });
  const reqs = requests.filter(r => r.at >= navAt).map(r => r.path);
  const firstShown = firstWith(p.states, s => s.kind !== 'hidden');
  const firstWin = firstWith(p.states, s => s.firstWindow);
  const hiddenAfterWin = firstWith(p.states, s => s.firstWindow && s.kind === 'hidden');
  const appRequests = reqs.filter(r => r.startsWith('/binaries/') || r.startsWith('/test/binaries/') ||
    r.startsWith('/icons/') || r === '/lib/app-icon-manifest.json');
  // Allowed beyond SOL_FILES: the page's own PWA icon (manifest.webmanifest),
  // the shared Windows system DLLs the program's import graph names
  // (sol -> msvcrt.dll), and the local-only shared system data files, read
  // from the boot list itself so a new one (stdole32.tlb) is not a stray.
  const systemData = new Set(require('../lib/process-boot').SYSTEM_DATA_FILES
    .filter(f => f.localOnly).map(f => '/' + f.url));
  // The page's own icons: the PWA icon and index.html's rel=icon favicon.
  const pageIcons = new Set(['/icons/icon-192.png', '/icons/favicon-32.png']);
  const stray = appRequests.filter(r => !SOL_FILES.has(r) && !pageIcons.has(r) &&
    !r.startsWith('/binaries/dlls/') && !systemData.has(r));
  receipt.stages.directKnownSize = { requests: reqs, stray, states: p.states, midModel,
    desktopFramesSeen: p.desktopSeen, taskbarFramesSeen: p.taskbarSeen };
  check('direct link: never paints the desktop icons or the taskbar before the program',
    p.desktopSeen === 0 && p.taskbarSeen === 0, `icons ${p.desktopSeen} frames, taskbar ${p.taskbarSeen}`);
  check('direct link: requests only the runtime and this program\'s files',
    stray.length === 0, stray.join(', '));
  check('direct link: no icon manifest, no other icons, no Start-menu art',
    !reqs.includes('/lib/app-icon-manifest.json') && !reqs.some(r => r.startsWith('/icons/ui/')));
  check('direct link: the launch window does not appear before 500ms',
    !!firstShown && firstShown.t >= 500, firstShown && `first shown at ${firstShown.t}ms`);
  check('direct link: a known size shows a real percentage and "x of y copied"',
    midModel.bar && midModel.bar.determinate &&
    /copied\)$/.test(midModel.rows[0][1]) && / of /.test(midModel.rows[0][1]),
    JSON.stringify(midModel.rows));
  const closeLag = firstWin && hiddenAfterWin ? hiddenAfterWin.t - firstWin.t : null;
  check('direct link: the window closes at the first app window, with no minimum time',
    !!firstWin && (firstWin.kind === 'hidden' || (closeLag != null && closeLag <= 120)),
    `first window at ${firstWin && firstWin.t}ms (${firstWin && firstWin.kind}), hidden ${closeLag}ms later`);
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  check('direct link: the page stays the program\'s while it runs',
    htmlClass.includes('direct-launch'), htmlClass);
  await page.close();
}

async function directStageUnknownStall(browser, base) {
  rules.clear();
  // No Content-Length, and the body stops for 9.5s a third of the way in.
  rules.set(SOL_EXE, { chunk: 2048, delay: 40, noLength: true, stallAt: 20480, stallMs: 9500 });
  const page = await newPage(browser,
    { width: 667, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/index.html?app=sol`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
  // Wait for the painted window, not just the model: the screenshot is
  // evidence of what a visitor sees.
  await waitState(page, () => {
    const lw = document.getElementById('wine-launch-window');
    return !!lw && !lw.hidden && /no data for \d+ sec/.test(lw.textContent) &&
      /network is slow/.test(lw.textContent);
  });
  const model = await page.evaluate(() => window.wineLaunchUi.current.model());
  const geometry = await page.evaluate(() => {
    const lw = document.getElementById('wine-launch-window');
    const r = lw.getBoundingClientRect();
    return {
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      viewport: { w: innerWidth, h: innerHeight },
      buttons: [...lw.querySelectorAll('.wa-launch-btn')].map(b => b.getBoundingClientRect().height),
      bar: (() => {
        const b = lw.querySelector('.wa-launch-bar');
        return { indeterminate: b.classList.contains('wa-launch-indeterminate'),
          valuenow: b.getAttribute('aria-valuenow'), valuetext: b.getAttribute('aria-valuetext') };
      })(),
      role: lw.getAttribute('role'), modal: lw.getAttribute('aria-modal'),
      live: lw.querySelector('[aria-live]').textContent,
    };
  });
  await page.screenshot({ path: path.join(OUT, 'phone-landscape-unknown-stalled.png') });
  receipt.stages.unknownStall = { model, geometry };
  check('unknown size: no percentage, an indeterminate bar, "Not known (N copied)"',
    model.title === 'Downloading Solitaire' && model.bar && !model.bar.determinate &&
    /^Not known \([\d.]+ (KB|bytes) copied\)$/.test(model.rows[0][1]) &&
    geometry.bar.indeterminate && geometry.bar.valuenow === null,
    `${model.title} / ${model.rows[0][1]}`);
  check('stall: the window says it is waiting and names the file',
    model.status.some(s => /^Waiting for sol\.exe/i.test(s)) &&
    model.rows.some(r => /size not reported by server/.test(r[1])), JSON.stringify(model.status));
  const g = geometry;
  check('landscape phone: the window fits the screen',
    g.rect.left >= 0 && g.rect.top >= 0 && g.rect.right <= g.viewport.w && g.rect.bottom <= g.viewport.h,
    JSON.stringify(g.rect));
  check('touch: buttons are at least 44px tall', g.buttons.every(h => h >= 44), g.buttons.join(','));
  check('a11y: dialog role, modal on a direct link, live region announced',
    g.role === 'dialog' && g.modal === 'true' && /Solitaire/.test(g.live), JSON.stringify(g));
  // Progress takes no keyboard focus, even on a direct link: the game is often
  // already running behind it, and with Cancel focused NFS III's own Enter
  // cancelled the launch. Keys the game gets must not reach the window.
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    return { inDialog: !!(a && a.closest && a.closest('#wine-launch-window')),
      text: a && a.textContent };
  });
  check('progress does not take keyboard focus', !focus.inDialog, JSON.stringify(focus));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 500));
  const afterKeys = await page.evaluate(() => window.__launchProbe.states.slice(-1)[0].kind);
  check('Enter/Esc/Space do not cancel a launch in progress', afterKeys === 'progress', afterKeys);
  // Cancel is still one deliberate click away.
  await page.click('#wine-launch-window [data-action="cancel"]');
  await waitState(page, () => window.__launchProbe.states.slice(-1)[0].kind === 'card', null, 10000);
  check('clicking Cancel cancels the launch', true);
  await page.close();
}

async function directStageErrorRetry(browser, base) {
  rules.clear();
  rules.set(SOL_EXE, { status: 503 });
  const page = await newPage(browser,
    { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/index.html?app=sol`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
  await waitState(page, () => window.__launchProbe.states.some(s => s.kind === 'error'));
  const p = await probe(page);
  const firstShown = firstWith(p.states, s => s.kind !== 'hidden');
  const model = await page.evaluate(() => window.wineLaunchUi.current.model());
  const crashVisible = await page.evaluate(() =>
    (document.getElementById('wine-crash-report') || {}).style?.display === 'flex');
  await page.screenshot({ path: path.join(OUT, 'phone-portrait-error.png') });
  const portrait = await page.evaluate(() => {
    const r = document.getElementById('wine-launch-window').getBoundingClientRect();
    return {
      fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      buttons: [...document.querySelectorAll('#wine-launch-window .wa-launch-btn')]
        .map(b => b.getBoundingClientRect().height),
    };
  });
  check('portrait phone: the window fits and its buttons are touch-sized',
    portrait.fits && portrait.buttons.every(h => h >= 44), JSON.stringify(portrait));
  receipt.stages.errorRetry = { firstShown, model, states: p.states };
  // A cold page may or may not reach the failing request inside 500ms; either
  // way nothing appears before 500ms unless it is the error, and the error,
  // once shown, stays (the fast case is forced in the desktop stage).
  const errorAt = p.states.findIndex(s => s.kind === 'error');
  const beforeError = p.states.slice(0, errorAt).filter(s => s.kind !== 'hidden');
  const afterError = p.states.slice(errorAt + 1).filter(s => s.kind !== 'error');
  check('error: no loading window before 500ms, and the error is not painted over',
    errorAt >= 0 && beforeError.every(s => s.t >= 500) && afterError.length === 0,
    JSON.stringify(p.states));
  check('error: names the file and the server answer, offers Retry',
    model.title === 'Download error' && /sol\.exe: server error \(HTTP 503\)/.test(model.status[0]) &&
    model.buttons.some(b => b.id === 'retry'), JSON.stringify(model.status));
  check('error: a download failure is not a crash report', !crashVisible);
  rules.clear();
  const before = requests.length;
  await page.click('#wine-launch-window [data-action="retry"]');
  await waitState(page, () => window.__launchProbe.states.some(s => s.firstWindow));
  await waitState(page, () => window.__launchProbe.states.slice(-1)[0].kind === 'hidden');
  const retried = requests.slice(before).map(r => r.path);
  receipt.stages.errorRetry.retryRequests = retried;
  check('Retry: the program starts and the window goes away',
    await page.evaluate(() => window.wineShell.runningApps.some(r => r.name === 'sol')));
  check('Retry: fetches the failed file again', retried.includes(SOL_EXE), retried.join(', '));
  await page.close();
}

// A link to an id that names nothing: an actionable window, no desktop
// underneath until asked for, and no program files fetched.
async function directStageUnknownId(browser, base) {
  rules.clear();
  const page = await newPage(browser, { width: 1024, height: 768 });
  const navAt = Date.now();
  await page.goto(`${base}/index.html?app=no_such_program`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
  await waitState(page, () => window.__launchProbe.states.some(s => s.kind === 'error'));
  const model = await page.evaluate(() => window.wineLaunchUi.current.model());
  const p = await probe(page);
  const fetched = requests.filter(r => r.at >= navAt && r.path.startsWith('/binaries/')).map(r => r.path);
  receipt.stages.unknownId = { model, fetched };
  check('unknown id: says there is no such program and offers the desktop',
    /no program called “no_such_program”/.test(model.heading) &&
    model.buttons.map(b => b.id).join() === 'details,desktop' && p.desktopSeen === 0,
    JSON.stringify({ heading: model.heading, buttons: model.buttons }));
  check('unknown id: fetches no program files', fetched.length === 0, fetched.join(', '));
  await page.close();
}

async function directStageCancel(browser, base) {
  rules.clear();
  rules.set(SOL_EXE, { chunk: 1024, delay: 200 });  // ~12s
  const page = await newPage(browser, { width: 1024, height: 768 });
  await page.goto(`${base}/index.html?app=sol`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
  await waitState(page, () => window.__launchProbe.states.some(s => /of SOL\.EXE$/.test(s.title)));
  await page.click('#wine-launch-window [data-action="cancel"]');
  const cancelAt = Date.now();
  await waitState(page, () => window.__launchProbe.states.slice(-1)[0].kind === 'card');
  await sleep(1500);
  const late = requests.filter(r => r.at > cancelAt + 300 && r.path.startsWith('/binaries/')).map(r => r.path);
  const state = await page.evaluate(() => ({
    running: window.wineShell.runningApps.length,
    inFlight: window.wineShell.launchInFlight,
    booting: document.body.classList.contains('app-booting'),
    direct: document.documentElement.classList.contains('direct-launch'),
    model: window.wineLaunchUi.current.model(),
  }));
  await page.screenshot({ path: path.join(OUT, 'direct-cancelled.png') });
  check('Cancel: no program files are requested afterwards', late.length === 0, late.join(', '));
  check('Cancel: nothing left running or booting',
    state.running === 0 && !state.inFlight && !state.booting, JSON.stringify(state));
  check('Cancel on a direct link: says so, offers Start again / Show desktop, no desktop yet',
    state.direct && state.model.kind === 'cancelled' &&
    state.model.buttons.map(b => b.id).join() === 'desktop,again');
  await page.click('#wine-launch-window [data-action="desktop"]');
  await waitState(page, () => document.querySelectorAll('#desktop-icons .desktop-icon').length > 0);
  const after = await page.evaluate(() => ({
    direct: document.documentElement.classList.contains('direct-launch'),
    icons: document.querySelectorAll('#desktop-icons .desktop-icon').length,
  }));
  check('Show desktop: builds the desktop on demand', !after.direct && after.icons > 0, JSON.stringify(after));
  receipt.stages.cancel = { late, state, after };
  await page.close();
}

async function desktopStage(browser, base) {
  rules.clear();
  const page = await newPage(browser, { width: 1024, height: 768 });
  await page.goto(`${base}/index.html?single-app=0`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
  await waitState(page, () => document.querySelectorAll('#desktop-icons .desktop-icon').length > 0);
  await page.evaluate(() => window.wineShell.launchApp('winmine_wep'));
  await waitState(page, () => window.wineShell.runningApps.some(r =>
    r.name === 'winmine_wep' && window.wineShell.firstTopLevelWindow(r.wine)));
  // Count keys reaching the guest renderer from here on.
  await page.evaluate(() => {
    const r = window.wineShell.renderer;
    window.__keys = 0;
    const orig = r.handleKeyDown.bind(r);
    r.handleKeyDown = (...a) => { window.__keys++; return orig(...a); };
  });
  rules.set(SOL_EXE, { chunk: 1024, delay: 150 });  // ~9s
  await page.evaluate(() => { void window.wineShell.launchApp('sol'); });
  await waitState(page, () => {
    const s = window.__launchProbe.states.slice(-1)[0];
    return s.kind === 'progress' && /SOL\.EXE|Solitaire/.test(s.title);
  });
  const during = await page.evaluate(async () => {
    const canvas = document.getElementById('screen');
    canvas.focus();
    return {
      modal: document.getElementById('wine-launch-window').getAttribute('aria-modal'),
      focusInDialog: !!document.activeElement.closest('#wine-launch-window'),
      taskButton: (document.querySelector('#launch-task-buttons .launch-task-btn') || {}).textContent || '',
      winmineRunning: window.wineShell.runningApps.some(r => r.name === 'winmine_wep' && r.wine.running),
    };
  });
  const keysBefore = await page.evaluate(() => window.__keys);
  await page.keyboard.press('F2');
  await sleep(100);
  const keysAfter = await page.evaluate(() => window.__keys);
  await page.screenshot({ path: path.join(OUT, 'desktop-launch-window.png') });
  check('desktop: the window is not modal and does not take the keyboard',
    during.modal === 'false' && !during.focusInDialog, JSON.stringify(during));
  check('desktop: the running app keeps receiving keys', keysAfter > keysBefore, `${keysBefore} -> ${keysAfter}`);
  check('desktop: the taskbar shows the launch', /SOL\.EXE|Solitaire/.test(during.taskButton), during.taskButton);
  check('desktop: the running app keeps running', during.winmineRunning);

  // Details, Minimize/restore from the taskbar, reduced motion.
  await page.click('#wine-launch-window [data-action="details"]');
  const details = await page.evaluate(() => [...document.querySelectorAll('#wine-launch-window tbody tr')]
    .map(tr => [...tr.cells].map(td => td.textContent)));
  check('Details lists each file with its size and state',
    details.some(([name, size, status]) => name === 'sol.exe' && /KB$/.test(size) && /^\d+%$/.test(status)),
    JSON.stringify(details));
  await page.click('#wine-launch-window .wa-launch-min');
  const minimized = await page.evaluate(() => getComputedStyle(document.getElementById('wine-launch-window')).display);
  await page.click('#launch-task-buttons .launch-task-btn');
  const restored = await page.evaluate(() => getComputedStyle(document.getElementById('wine-launch-window')).display);
  check('Minimize hides the window and its taskbar button brings it back',
    minimized === 'none' && restored !== 'none', `${minimized} -> ${restored}`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const motion = await page.evaluate(() => {
    const page = document.querySelector('#wine-launch-window .wa-launch-page');
    return page ? getComputedStyle(page).animationName : 'no-art';
  });
  await page.emulateMediaFeatures([]);
  check('reduced motion stops the flying page', motion === 'none', motion);
  await page.click('#wine-launch-window [data-action="cancel"]');
  await waitState(page, () => window.__launchProbe.states.slice(-1)[0].kind === 'hidden' &&
    !window.wineShell.launchInFlight);
  const afterCancel = await page.evaluate(() => ({
    names: window.wineShell.runningApps.map(r => r.name),
    taskButton: !!document.querySelector('#launch-task-buttons .launch-task-btn'),
  }));
  check('desktop Cancel: the other app is untouched and the taskbar entry goes',
    afterCancel.names.join() === 'winmine_wep' && !afterCancel.taskButton, JSON.stringify(afterCancel));

  // A warm relaunch: wasm compiled, nothing throttled. Whatever it takes,
  // the window is shown only if the launch was still pending at 500ms.
  rules.clear();
  const warm = await page.evaluate(async () => {
    const P = window.__launchProbe;
    const from = P.states.length;
    const t0 = performance.now();
    void window.wineShell.launchApp('sol');
    const deadline = t0 + 30000;
    while (performance.now() < deadline) {
      if (window.wineShell.runningApps.some(r => r.name === 'sol' && window.wineShell.firstTopLevelWindow(r.wine))) break;
      await new Promise(r => requestAnimationFrame(r));
    }
    const readyAt = performance.now() - t0;
    await new Promise(r => setTimeout(r, 200));
    const shown = P.states.slice(from).filter(s => s.kind !== 'hidden').map(s => ({ ...s, t: s.t - t0 }));
    return { readyAt: Math.round(readyAt), shown };
  });
  check(`warm relaunch: window shown only if still pending at 500ms (ready at ${warm.readyAt}ms)`,
    warm.readyAt < 500 ? warm.shown.length === 0 : warm.shown.every(s => s.t >= 480),
    JSON.stringify(warm.shown.slice(0, 3)));

  // A failure well inside 500ms on the warm page: the actionable error
  // appears directly, with no loading window first.
  rules.set('/binaries/entertainment-pack/reversi.exe', { status: 404 });
  const fastFail = await page.evaluate(async () => {
    const P = window.__launchProbe;
    const from = P.states.length;
    const t0 = performance.now();
    void window.wineShell.launchApp('reversi');
    const deadline = t0 + 20000;
    while (performance.now() < deadline && !P.states.slice(from).some(s => s.kind === 'error')) {
      await new Promise(r => requestAnimationFrame(r));
    }
    await new Promise(r => setTimeout(r, 200));
    return {
      shown: P.states.slice(from).filter(s => s.kind !== 'hidden').map(s => ({ ...s, t: Math.round(s.t - t0) })),
      model: window.wineLaunchUi.current.model(),
      crash: (document.getElementById('wine-crash-report') || {}).style?.display === 'flex',
    };
  });
  await page.screenshot({ path: path.join(OUT, 'desktop-fast-error.png') });
  rules.clear();
  receipt.stages.desktop = { during, keysBefore, keysAfter, afterCancel, warm, fastFail };
  const firstFast = fastFail.shown[0];
  check(`fast failure (${firstFast && firstFast.t}ms): the error is the first thing shown`,
    !!firstFast && firstFast.kind === 'error' && firstFast.t < 500, JSON.stringify(fastFail.shown));
  check('fast failure: names the file, offers Retry and Close, no crash report',
    /reversi\.exe: not found on the server \(HTTP 404\)/.test(fastFail.model.status[0]) &&
    fastFail.model.buttons.map(b => b.id).join() === 'details,close,retry' && !fastFail.crash,
    JSON.stringify(fastFail.model.status));
  await page.click('#wine-launch-window [data-action="close"]');
  const closed = await page.evaluate(() => ({
    hidden: document.getElementById('wine-launch-window').hidden,
    names: window.wineShell.runningApps.map(r => r.name),
  }));
  check('Close: the error goes, the running apps stay', closed.hidden &&
    closed.names.includes('winmine_wep'), JSON.stringify(closed));
  await page.close();
}

// Two fresh profiles. Without a service worker, Resource Timing can say what
// the HTTP cache answered, and the window reports it. With sw-coi.js in
// between (the live site installs it for Worker threads) it cannot, and the
// window must claim nothing -- unknown is not a cache hit.
async function cacheStage(browser, base) {
  rules.clear();
  cacheable = true;
  const result = {};
  for (const [label, blockSw] of [['noServiceWorker', true], ['serviceWorker', false]]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.evaluateOnNewDocument(installProbe);
    if (blockSw) {
      await page.evaluateOnNewDocument(() => {
        if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});
      });
    } else {
      // index.html installs sw-coi.js only for a real visitor: it skips the
      // install when navigator.webdriver is set, so a harness page stays as
      // isolated as its server makes it. Present as a visitor here, so the
      // page's own install path puts the worker in front of the second load.
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
      });
    }
    const sources = async () => page.evaluate(() =>
      [...window.wineLaunchUi.current.transfers.values()].map(t => [t.name, t.source]));
    const loads = [];
    for (const n of [1, 2]) {
      await page.goto(`${base}/index.html?app=sol&cache=${n}`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
      await waitState(page, () => window.__launchProbe.states.some(s => s.firstWindow));
      loads.push({
        sources: await sources(),
        sw: await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)),
      });
      if (!blockSw && n === 1) {
        await page.evaluate(() => Promise.race([
          navigator.serviceWorker.ready,
          new Promise(resolve => setTimeout(resolve, 10000)),
        ]).then(() => undefined));
      }
    }
    result[label] = loads;
    await context.close();
  }
  cacheable = false;
  receipt.stages.cache = result;
  const [cold, warm] = result.noServiceWorker;
  check('cache: a cold load claims no cache hits',
    cold.sources.length > 0 && cold.sources.every(([, s]) => s !== 'cache'), JSON.stringify(cold.sources));
  check('cache: a reload reports the files the browser cache answered',
    !warm.sw && warm.sources.some(([, s]) => s === 'cache'), JSON.stringify(warm));
  const swLoads = result.serviceWorker;
  check('cache: behind a service worker, nothing is claimed either way',
    swLoads[1].sw && swLoads.every(l => l.sources.every(([, s]) => s !== 'cache')), JSON.stringify(swLoads));
}

async function cancelDuringInitStage(browser, base) {
  rules.clear();
  requests.length = 0;
  const wasm = '/build/wine-assembly.wasm';
  rules.set(wasm, { chunk: 2000000, stallAt: 0, stallMs: 2500, delay: 1 });
  const page = await newPage(browser, { width: 1024, height: 768 });
  try {
    await page.setBypassServiceWorker(true);
    await page.goto(`${base}/index.html?app=sol`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
    await waitState(page, () => window.wineShell?.launchInFlight &&
      window.wineLaunchUi?.current?.visible);
    await page.click('#wine-launch-window [data-action="cancel"]');
    await page.click('#wine-launch-window [data-action="again"]');
    const queued = await page.evaluate(() => ({
      token: wineLaunchUi.current.token, status: wineLaunchUi.current.status,
      inFlight: wineShell.launchInFlight,
    }));
    check('Cancel during init: immediate Start again keeps a new pending request',
      queued.token === 2 && queued.status === 'pending' && queued.inFlight, JSON.stringify(queued));
    await waitState(page, () => wineShell.runningApps.some(r => wineShell.firstTopLevelWindow(r.wine)) &&
      wineLaunchUi.current.status === 'ready');
    const final = await page.evaluate(() => ({
      token: wineLaunchUi.current.token, status: wineLaunchUi.current.status,
      apps: wineShell.runningApps.map(r => r.name), visible: !!wineLaunchUi.onScreen,
    }));
    check('Cancel during init: replacement starts once, stale completion does not reopen UI',
      final.token === 2 && final.apps.join() === 'sol' && !final.visible, JSON.stringify(final));
    const wasmRequests = requests.filter(r => r.path === wasm).length;
    check('Cancel during init: shared WASM download survives cancellation', wasmRequests === 1, String(wasmRequests));
    receipt.stages.cancelDuringInit = { queued, final, wasmRequests };
  } finally { await page.close(); rules.clear(); }
}

async function earlyRuntimeCancelStage(browser, base) {
  rules.clear();
  rules.set('/lib/mem-utils.js', { chunk: 2000000, stallAt: 0, stallMs: 2500, delay: 1 });
  const page = await newPage(browser, { width: 1024, height: 768 });
  try {
    await page.setBypassServiceWorker(true);
    const navigation = page.goto(`${base}/index.html?app=sol`,
      { waitUntil: 'domcontentloaded', timeout: STAGE_MS }).catch(() => null);
    await waitState(page, () => window.wineLaunchUi?.current?.visible && !window.wineShell);
    await page.click('#wine-launch-window [data-action="cancel"]');
    rules.clear();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: STAGE_MS }),
      page.click('#wine-launch-window [data-action="desktop"]'),
    ]);
    await navigation;
    await waitState(page, () => document.querySelectorAll('#desktop-icons .desktop-icon').length > 0);
    check('Cancel before shell loads: Show desktop remains usable',
      !new URL(page.url()).searchParams.has('app'), page.url());
    receipt.stages.earlyRuntimeCancel = { desktopUrl: page.url() };
  } finally { await page.close(); rules.clear(); }
}

async function manifestCancelStage(browser, base) {
  rules.clear(); requests.length = 0;
  const app = require('../lib/apps').APPS.cave_story;
  const manifest = '/' + app.localFileManifest;
  rules.set(manifest, { status: 503 });
  const page = await newPage(browser, { width: 1024, height: 768 });
  try {
    await page.setBypassServiceWorker(true);
    await page.goto(`${base}/index.html?app=cave_story`, { waitUntil: 'domcontentloaded', timeout: STAGE_MS });
    await waitState(page, () => wineLaunchUi.current.status === 'failed');
    const failed = await page.evaluate(() => wineLaunchUi.current.model());
    check('Manifest failure: actionable download error offers Retry',
      failed.title === 'Download error' && failed.buttons.some(b => b.id === 'retry') &&
      failed.status.some(s => s.includes('HTTP 503')), JSON.stringify(failed.status));
    await page.click('#wine-launch-window [data-action="retry"]');
    await waitState(page, () => wineLaunchUi.current.token === 2 && wineLaunchUi.current.status === 'failed');
    const retry = await page.evaluate(() => wineLaunchUi.current.model());
    check('Fast repeated failure: stays actionable instead of Retrying forever',
      retry.buttons.some(b => b.id === 'retry') && !retry.status.includes('Retrying…'), JSON.stringify(retry.status));
    rules.set(manifest, { chunk: 2000000, stallAt: 0, stallMs: 1800, delay: 1 });
    const request = page.waitForRequest(req => new URL(req.url()).pathname === manifest, { timeout: STAGE_MS });
    // error -> error is not a kind change, so the window repaints on the next
    // animation frame: the model can already say "failed" while the DOM still
    // shows "Retrying..." with no Retry button. Wait for the button itself.
    await page.waitForSelector('#wine-launch-window [data-action="retry"]', { visible: true, timeout: STAGE_MS });
    await page.click('#wine-launch-window [data-action="retry"]');
    await request;
    await page.click('#wine-launch-window [data-action="cancel"]');
    await sleep(2000);
    const cancelled = await page.evaluate(() => ({
      resolved: !!wineApps.APPS.cave_story._localFilesResolved,
      status: wineLaunchUi.current.status, inFlight: wineShell.launchInFlight,
    }));
    check('Cancel manifest: no late registry mutation or guest start',
      !cancelled.resolved && cancelled.status === 'cancelled' && !cancelled.inFlight &&
      !requests.some(r => r.path === '/' + app.exe), JSON.stringify(cancelled));
    await page.click('#wine-launch-window [data-action="desktop"]');
    check('Show desktop clears direct app URL', !new URL(page.url()).searchParams.has('app'), page.url());
    receipt.stages.manifestCancel = { failed, retry, cancelled, desktopUrl: page.url() };
  } finally { await page.close(); rules.clear(); }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startStaticServer({
    root: ROOT,
    handleRequest,
    // A worktree links its corpus (binaries/, test/binaries/) to a shared
    // checkout, so those files realpath outside ROOT and the static server
    // refuses them with 403 unless the link targets are allowlisted: then
    // cards.dll and msvcrt.dll never arrive, sol.exe dies in cdtInit, and
    // every stage that waits for Solitaire's first window times out.
    allowedRealRoots: ['binaries', 'test/binaries', 'fonts']
      .map(dir => path.join(ROOT, dir)).filter(dir => fs.existsSync(dir)),
    headers: (request) => (cacheable && /^\/binaries\//.test(new URL(request.url, 'http://x').pathname)
      ? { 'Cache-Control': 'max-age=600' } : {}),
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--no-first-run'],
  });
  const started = Date.now();
  try {
    const only = process.env.DIRECT_LAUNCH_STAGES
      ? new Set(process.env.DIRECT_LAUNCH_STAGES.split(',')) : null;
    for (const [key, name, stage] of [
      ['known', 'direct, known size', directStageKnownSize],
      ['stall', 'direct, unknown size + stall', directStageUnknownStall],
      ['error', 'direct, error + Retry', directStageErrorRetry],
      ['unknown', 'direct, unknown id', directStageUnknownId],
      ['cancel', 'direct, Cancel', directStageCancel],
      ['desktop', 'desktop + warm relaunch', desktopStage],
      ['cache', 'cache', cacheStage],
      ['init-cancel', 'Cancel and restart during shared initialization', cancelDuringInitStage],
      ['early-cancel', 'Cancel while runtime scripts load', earlyRuntimeCancelStage],
      ['manifest-cancel', 'manifest failure, retry and cancellation', manifestCancelStage],
    ]) {
      if (only && !only.has(key)) continue;
      console.log(`--- ${name}`);
      try { await stage(browser, base); }
      catch (e) { failures++; console.log(`FAIL  ${name}: ${e && e.stack || e}`); }
    }
  } finally {
    await browser.close();
    await closeServer(server);
    receipt.chrome = CHROME;
    receipt.seconds = Math.round((Date.now() - started) / 1000);
    receipt.failures = failures;
    fs.writeFileSync(path.join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 2));
  }
  if (failures) { console.log(`${failures} check(s) failed`); process.exit(1); }
  console.log('PASS  direct launch and launch window');
}

main().catch(error => { console.error(error); process.exit(1); });
