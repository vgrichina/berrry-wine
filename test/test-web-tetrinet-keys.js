#!/usr/bin/env node

// TetriNET's falling piece answering real page keystrokes.
//
//   node test/test-web-tetrinet-keys.js [--timeout=300] [--headful] [--keep]
//
// test-vlan-tetrinet.js presses keys through test/run.js. Here they are real
// browser keydown events (puppeteer's keyboard), so they take the page's own
// path: lib/browser-input.js -> renderer.handleKeyDown -> the guest's focus
// window. That path is where the bug was: every arrow key moved the focus off
// the Playing Fields form onto an EDIT on the main form, and the piece never
// moved (fixed in f5fa852b6; this test fails without it).
//
// The server starts a game on its own (no client needed), launched on the
// tab's virtual LAN segment as "Both players here" would. One game, four
// readings of the falling piece from the Playing Fields form's back-canvas:
// t0; t1 a moment later with no key (it falls, same column); t2 after six
// ArrowLeft presses (it moves left); t3 after Space (it lands at the bottom).
// Click points are test-vlan-tetrinet.js's, translated by where each form
// actually sits on the page, since the page's screen is not the CLI's 640x480.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer } = require('./static-server');
const H = require('./hearts-web-helper');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'test', 'binaries', 'candidates', 'tetrinet', 'TETRINET.EXE');
const OUT = path.join(ROOT, 'test', 'output', 'web-tetrinet-keys');

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : dflt;
};
const flag = name => process.argv.includes(`--${name}`);
const MILESTONE_MS = arg('milestone-timeout', 90) * 1000;

let passed = 0;
let failed = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail && !ok ? ` -- ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

const CHROME = H.findChrome();
if (!fs.existsSync(EXE)) {
  console.log('SKIP  TETRINET.EXE not found');
  process.exit(0);
}
if (!CHROME) {
  console.log('SKIP  no Chrome (set CHROME=)');
  process.exit(0);
}
H.budget(arg('timeout', 300) * 1000);
fs.mkdirSync(OUT, { recursive: true });
H.clearPngs(OUT);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.wat': 'text/plain', '.watx': 'text/plain', '.exe': 'application/octet-stream',
};

// Forms by size (they are fixed-size dialogs), and where each sat in the CLI
// run whose coordinates the steps below come from.
const FORMS = {
  // The first-run TMessageForm sizes itself to its text, and the page's
  // fonts are not the CLI's (704x123 here, 397x143 there), so it is found
  // by title and answered with Enter.
  message: { title: 'Information' },
  main: { w: 597, h: 467, cli: [21, 6] },         // TForm1
  fields: { w: 605, h: 472, cli: [17, 4] },       // TForm2, Playing Fields
};

// The instance's visible top-level whose size names the form, from the
// renderer's own window records (canvas coordinates).
const findForm = ({ index, w, h, title }) => {
  const app = runningApps[index];
  if (!app) return null;
  const base = (app.wine._hwndBase >>> 0) & 0xFFFF0000;
  const win = Object.values(sharedRenderer.windows || {}).find(r => r && r.visible && !r.isChild
    && ((r.hwnd >>> 0) & 0xFFFF0000) === base
    && (title ? r.title === title : r.w === w && r.h === h));
  return win ? { hwnd: win.hwnd >>> 0, x: win.x, y: win.y, w: win.w, h: win.h, z: win.zOrder || 0 } : null;
};

// The falling piece: the box of saturated pixels in the own field, the left
// third of the Playing Fields form (the six fields are textured grey).
const pieceBox = ({ index, w, h }) => {
  const f = findForm({ index, w, h });
  if (!f) return null;
  const surface = sharedRenderer.getWindowCanvas(f.hwnd);
  if (!surface || !surface.canvas) return null;
  const c = surface.canvas;
  const d = surface.ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = 40; y < c.height - 82; y++) {
    for (let x = 4; x < Math.floor(c.width * 0.36); x++) {
      const i = (y * c.width + x) * 4;
      const hi = Math.max(d[i], d[i + 1], d[i + 2]), lo = Math.min(d[i], d[i + 1], d[i + 2]);
      if (hi - lo > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
  }
  const copy = document.createElement('canvas');
  copy.width = c.width;
  copy.height = c.height;
  copy.getContext('2d').drawImage(c, 0, 0);
  return { found: x1 >= 0, x0, x1, y0, y1, fieldBottom: c.height - 82, png: copy.toDataURL('image/png') };
};

async function form(page, index, name) {
  const spec = FORMS[name];
  const f = await H.until(page, `instance ${index}: no ${name} form`, findForm,
    { index, w: spec.w, h: spec.h, title: spec.title }, MILESTONE_MS);
  if (!f) {
    // Say what IS there: sizes, visibility and the instance's hwnd base.
    console.log(await page.evaluate(i => {
      const app = runningApps[i];
      const base = app && app.wine ? (app.wine._hwndBase >>> 0) : null;
      const rows = Object.values(sharedRenderer.windows || {}).filter(r => r && !r.isChild)
        .map(r => `0x${(r.hwnd >>> 0).toString(16)} ${r.w}x${r.h}@${r.x},${r.y} vis=${r.visible} "${r.title || ''}"`);
      return `  windows (instance ${i} base=${base === null ? '?' : '0x' + base.toString(16)}): ${rows.join(' | ')}`;
    }, index));
  }
  return f;
}

// Click where the CLI clicked, relative to the form that point lands on.
async function clickAt(page, index, name, [cx, cy]) {
  const f = await bringToFront(page, index, name);
  if (!f) return false;
  const [ox, oy] = FORMS[name].cli;
  await H.click(page, [f.x + cx - ox, f.y + cy - oy]);
  return true;
}

// A real page click on a form's caption: it makes that form (and its
// instance) the one the page's keyboard goes to, as a player's click does.
async function captionClick(page, f) {
  const rect = await page.evaluate(() => {
    const c = sharedRenderer.canvas;
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, sx: r.width / c.width, sy: r.height / c.height };
  });
  await page.mouse.click(rect.left + (f.x + Math.min(200, f.w >> 1)) * rect.sx, rect.top + (f.y + 10) * rect.sy);
  await H.sleep(500);
}

// Both copies share one desktop and sit on top of each other, so a form is
// brought to the front by its own taskbar button before it is clicked or
// typed at, the way a person switches between the two players. Buttons are
// in the renderer's captioned top-level order (see hearts-web-helper raise).
async function bringToFront(page, index, name) {
  const f = await form(page, index, name);
  if (!f) return null;
  const hit = await page.evaluate(hwnd => {
    const order = Object.values(sharedRenderer.windows).filter(w => !w.isChild && w.hasCaption);
    const at = order.findIndex(w => (w.hwnd >>> 0) === hwnd);
    const buttons = [...document.querySelectorAll('#task-buttons .task-btn')];
    if (at < 0 || !buttons[at]) return false;
    const top = () => Object.values(sharedRenderer.windows)
      .filter(w => w.visible && !w.isChild && w.hasCaption)
      .sort((a, b) => (b.zOrder || 0) - (a.zOrder || 0))[0];
    const front = top();
    if (front && (front.hwnd >>> 0) === hwnd) return true;
    buttons[at].click();
    if (!order[at].visible) buttons[at].click();
    return true;
  }, f.hwnd);
  await H.sleep(600);
  return hit ? await form(page, index, name) : null;
}

// The box's one button sits centred, 26px above its bottom edge (CLI:
// a 75x22 TButton at 158,81 in a 397x143 form); the form's width follows
// its text, its button layout does not.
async function okClick(page, box) {
  await H.click(page, [box.x + (box.w >> 1), box.y + box.h - 26]);
  await H.sleep(400);
}

async function typeText(page, text) {
  for (const ch of text) {
    await page.evaluate(code => sharedRenderer.handleKeyPress(code), ch.charCodeAt(0));
    await H.sleep(120);
  }
}

async function launch(page, index, label) {
  await page.evaluate(() => {
    shell.launchApp('tetrinet', { lanLink: shell.joinPageSegment() });
  });
  const started = await H.until(page, `${label}: instance never started`,
    i => runningApps.length > i, index, MILESTONE_MS);
  return !!started;
}

async function piece(page, index, name) {
  const s = await page.evaluate(pieceBox, { index, w: FORMS.fields.w, h: FORMS.fields.h });
  H.savePng(OUT, name, s && s.png);
  if (s) delete s.png;
  console.log(`  ${name}: ${JSON.stringify(s)}`);
  return s;
}

async function press(page, key, times) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.down(key);
    await H.sleep(60);
    await page.keyboard.up(key);
    await H.sleep(140);
  }
}

(async () => {
  const server = await startStaticServer({ root: ROOT, mimeTypes: MIME });
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'web-tetrinet-keys-'));
  const browser = await puppeteer.launch({
    headless: !flag('headful'),
    executablePath: CHROME,
    userDataDir: profile,
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check'],
  });
  const problems = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    page.on('pageerror', e => problems.push(String(e)));
    // A missing game file reads as "the instance never started" and nothing
    // else (an out-of-root symlinked test/binaries is refused with a 403).
    page.on('response', r => {
      if (r.status() >= 400 && /tetrinet|dlls|tlbs/i.test(r.url())) {
        const line = `HTTP ${r.status()} ${r.url().replace(base, '')}`;
        // test/binaries/dlls is gitignored; TetriNET then runs on the WAT
        // stubs for comctl32/oleaut32, exactly as the CLI does.
        if (!/\/dlls\//.test(r.url())) problems.push(line);
        console.log(`  ${line}`);
      }
    });
    page.on('console', m => {
      const t = m.text();
      if (/UNIMPLEMENTED API:|RuntimeError|LinkError|crashed|FATAL:/i.test(t)) {
        problems.push(t.slice(0, 300));
      }
    });
    await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('typeof launchApp === "function"', { timeout: 60000 });
    await H.installHelpers(page);
    await page.evaluate(`window.findForm = ${findForm.toString()}; window.pieceBox = ${pieceBox.toString()};`);

    // ---- the server (bob) -----------------------------------------------
    const host = 0;
    check('the server launched', await launch(page, host, 'server'));
    const box = await bringToFront(page, host, 'message');
    check('the server put up its first-run box', !!box);
    if (box) await okClick(page, box);
    check('the server main form is up', !!(await form(page, host, 'main')));
    await clickAt(page, host, 'main', [520, 455]);           // toolbar: server screen
    await H.sleep(800);
    await clickAt(page, host, 'main', [253, 62]);            // nickname
    await typeText(page, 'bob');
    await clickAt(page, host, 'main', [407, 408]);           // Start Server
    const listening = await H.until(page, 'the server never listened', () => {
      const w = runningApps[0] && runningApps[0].wine.vlanWire;
      return !!w;
    }, null, MILESTONE_MS);
    check('the server is on the tab segment', !!listening);

    // ---- the game -------------------------------------------------------
    await clickAt(page, host, 'main', [139, 455]);           // toolbar: Partyline
    await H.sleep(800);
    await clickAt(page, host, 'main', [529, 417]);           // Start New Game
    await H.sleep(1000);
    await clickAt(page, host, 'main', [40, 455]);            // toolbar: Playing Fields
    const fields = await bringToFront(page, host, 'fields');
    check('the server shows its Playing Fields', !!fields);
    if (!fields) throw new Error('no playing fields');

    // A real click on the form's caption, so the page itself hands it the
    // keyboard the way a player's click would.
    await captionClick(page, fields);

    const t0 = await piece(page, host, 't0');
    check('a falling piece is on the server field', !!t0 && t0.found, JSON.stringify(t0));
    await H.sleep(1500);
    const t1 = await piece(page, host, 't1-nokey');
    check('with no key the piece keeps its column', !!t1 && t1.found && t1.x0 === t0.x0,
      JSON.stringify({ t0, t1 }));

    await press(page, 'ArrowLeft', 6);
    await H.sleep(300);
    const t2 = await piece(page, host, 't2-left');
    check(`six real ArrowLeft keydowns move the piece left (x ${t1 && t1.x0} -> ${t2 && t2.x0})`,
      !!t2 && t2.found && t2.x0 <= t1.x0 - 32, JSON.stringify({ t1, t2 }));

    await press(page, 'Space', 1);
    await H.sleep(700);
    const t3 = await piece(page, host, 't3-space');
    check('Space drops it to the bottom of the field', !!t3 && t3.found && t3.y1 >= t3.fieldBottom - 24,
      JSON.stringify(t3));

    const focus = await page.evaluate(i => {
      const e = runningApps[i].wine.exports || (runningApps[i].wine.instance && runningApps[i].wine.instance.exports);
      return e && e.get_focus_hwnd ? e.get_focus_hwnd() >>> 0 : null;
    }, host);
    check(`keyboard focus stayed on the Playing Fields form (0x${(focus || 0).toString(16)})`,
      focus === fields.hwnd, `fields=0x${fields.hwnd.toString(16)}`);

    await page.screenshot({ path: path.join(OUT, 'page.png') });
    check('the page reported no errors', problems.length === 0, problems.join(' | '));
    console.log(`Screenshots: ${OUT}`);
  } finally {
    if (!flag('keep')) await browser.close();
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  console.error(error.stack || error);
  console.log(`\n${passed} passed, ${failed + 1} failed`);
  process.exit(1);
});
