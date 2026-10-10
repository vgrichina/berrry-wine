#!/usr/bin/env node

// Two copies of TetriNET in one browser tab join each other and play.
//
//   node test/test-web-tetrinet-lan.js [--timeout=300] [--headful] [--keep]
//
// "Both players here": two instances on the tab's own virtual LAN segment, the
// first hosting (Start Server), the second connecting to it. TetriNET is a
// WSAAsyncSelect server -- it calls no socket function while it waits, it
// sits in GetMessage until told -- and a page host resumes a GetMessage park
// only when has_pending_message() says so. Until that export pumped the wire,
// the client's SYN sat in the server's inbox for good (sent=1 / pending=1)
// and neither side ever moved again. The CLI never showed it, because run.js
// pumps the wire between batches by itself; test/test-vlan-getmessage-wake.js
// is the unit-level gate, this is the page.
//
// The second thing this catches is the match staying up. Both copies deal the
// same pieces, so their first pieces land at the same instant, and the start
// packet and the first field record reach the client in one pump. Posting an
// FD_READ per frame then gave Delphi's ScktComp an FD_READ with nothing behind
// it; its ReceiveText returned the uninitialized receive buffer, TetriNET glued
// that to its next command ("\xC83f 1 ..."), did not recognise it and hung up
// ("Server has Shut Down"). Winsock's FD_READ is re-enabling -- one post until
// recv -- and the counters alone miss a late drop, so the last check reads the
// client's own field.
//
// Both copies sit on one desktop, so every form is raised through its own
// taskbar button before it is clicked, as a person switching players would.
// Click points are test-vlan-tetrinet.js's, translated by where each form
// actually sits on the page.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer } = require('./static-server');
const H = require('./hearts-web-helper');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'test', 'binaries', 'candidates', 'tetrinet', 'TETRINET.EXE');
const OUT = path.join(ROOT, 'test', 'output', 'web-tetrinet-lan');

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

(async () => {
  const server = await startStaticServer({ root: ROOT, mimeTypes: MIME });
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'web-tetrinet-lan-'));
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


    // ---- the client (ann) -----------------------------------------------
    const guest = 1;
    check('a second TetriNET started without stopping the first',
      await launch(page, guest, 'client') && await page.evaluate(() => runningApps.length) === 2);
    const box2 = await bringToFront(page, guest, 'message');
    if (box2) await okClick(page, box2);
    await form(page, guest, 'main');
    await clickAt(page, guest, 'main', [57, 455]);
    await H.sleep(1000);
    await clickAt(page, guest, 'fields', [606, 15]);
    await H.sleep(800);
    await clickAt(page, guest, 'main', [450, 455]);          // Client Settings
    await H.sleep(800);
    await clickAt(page, guest, 'main', [455, 186]);
    await typeText(page, '10.0.0.1');
    await clickAt(page, guest, 'main', [455, 213]);
    await typeText(page, 'ann');
    await clickAt(page, guest, 'main', [437, 279]);          // Connect
    const wire = () => page.evaluate(() => wireStats());
    const joined = await H.until(page, 'the login never crossed the tab segment', () => {
      const w = runningApps.map(a => a.wine.vlanWire);
      // The SYN, its answer and the login exchange: several frames each way,
      // and nothing left unread in either inbox.
      return w.length === 2 && w.every(x => x && x.sentFrames >= 3 && x.recvFrames >= 3 && x.pending === 0);
    }, null, MILESTONE_MS);
    check('the client connected and logged in across the tab segment', !!joined, JSON.stringify(await wire()));
    await H.sleep(2000);
    // As in test-vlan-tetrinet.js: the client goes back to its Partyline to
    // wait for the game.
    await clickAt(page, guest, 'main', [139, 455]);
    await H.sleep(1000);

    // ---- the game -------------------------------------------------------
    await clickAt(page, host, 'main', [139, 455]);           // toolbar: Partyline
    await H.sleep(800);
    await clickAt(page, host, 'main', [529, 417]);           // Start New Game
    // TetriNET does not raise the fields itself: each player opens Playing
    // Fields from the toolbar, as test-vlan-tetrinet.js does. The client has
    // to before the first field update arrives -- without its fields form it
    // drops the connection on that update -- so it goes first.
    await clickAt(page, guest, 'main', [40, 455]);           // client: Playing Fields
    const clientFields = await form(page, guest, 'fields');
    check('the client opens its Playing Fields in the running game', !!clientFields);
    const clientPic = await page.evaluate(pieceBox, { index: guest, w: FORMS.fields.w, h: FORMS.fields.h });
    H.savePng(OUT, 'client-fields', clientPic && clientPic.png);
    check('the client has a falling piece of its own', !!clientPic && clientPic.found,
      JSON.stringify(clientPic && { ...clientPic, png: undefined }));
    await clickAt(page, host, 'main', [40, 455]);            // server: Playing Fields
    const hostPic = await page.evaluate(pieceBox, { index: host, w: FORMS.fields.w, h: FORMS.fields.h });
    H.savePng(OUT, 'server-fields', hostPic && hostPic.png);
    check('the server has a falling piece too', !!hostPic && hostPic.found);

    // Untouched pieces land within ~20 s, and each landing sends a field
    // update ("f <player> ...") to the other side. The match is live while
    // those keep crossing and neither side has closed.
    const atStart = await wire();
    await H.sleep(30000);
    const later = await wire();
    check(`field updates cross both ways during the match (${JSON.stringify(atStart.map(w => [w.sent, w.recv]))} -> ${JSON.stringify(later.map(w => [w.sent, w.recv]))})`,
      later.length === 2 && later.every((w, i) => w.sent > atStart[i].sent && w.recv > atStart[i].recv));
    const stillOpen = await page.evaluate(i => !!findForm({ index: i, w: 605, h: 472 }), guest);
    check('the client is still in the game (its fields are still up)', stillOpen);
    const clientLater = await page.evaluate(pieceBox, { index: guest, w: FORMS.fields.w, h: FORMS.fields.h });
    H.savePng(OUT, 'client-fields-later', clientLater && clientLater.png);
    // A client that dropped out leaves its fields form up but clears it: an
    // empty field here is the disconnect the counters above can miss when it
    // happens late in the window.
    check('the client\'s own field still has pieces at the end', !!clientLater && clientLater.found,
      JSON.stringify(clientLater && { ...clientLater, png: undefined }));
    console.log(`  wire: ${JSON.stringify(await wire())}`);
    // What each copy is showing, from its own back-canvas (they overlap on
    // the shared desktop): the partyline text says what each one heard.
    for (const [i, who] of [[host, 'server'], [guest, 'client']]) {
      const pics = await page.evaluate(i => Object.values(sharedRenderer.windows || {})
        .filter(r => r && !r.isChild && r.w > 300
          && ((r.hwnd >>> 0) & 0xFFFF0000) === ((runningApps[i].wine._hwndBase >>> 0) & 0xFFFF0000))
        .map(r => {
          const surface = sharedRenderer.getWindowCanvas(r.hwnd);
          return { hwnd: r.hwnd >>> 0, visible: !!r.visible,
            png: (() => {
            if (!surface || !surface.canvas) return null;
            const c = document.createElement('canvas');
            c.width = surface.canvas.width;
            c.height = surface.canvas.height;
            c.getContext('2d').drawImage(surface.canvas, 0, 0);
            return c.toDataURL('image/png');
          })() };
        }), i);
      for (const p of pics) H.savePng(OUT, `${who}-0x${p.hwnd.toString(16)}-${p.visible ? 'vis' : 'hid'}`, p.png);
    }

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
