#!/usr/bin/env node
'use strict';

// Which apps does the present-rate cap ($present_pace) get WRONG?
//
//   node tools/present-rate-sweep.js [--apps=a,b] [--cap=60] [--seconds=8]
//        [--warmup=25] [--list] [--limit=N] [--json=F] [--md=F] [--headful] [--software-browser]
//        [--start-key=VK@SEC] [--start-click=X:Y@SEC] [--start-text=TEXT@SEC]
//        [--start-input=ENTRY@SEC] [--shots=DIR]
//
// THE FAILURE IT LOOKS FOR. The cap paces a present only when that present
// ends a whole frame: a blit covering more than half the target, or the
// Unlock closing a whole-surface Lock. An app that ends one frame with TWO
// such presents -- locks the whole primary for the background and again for
// the sprites -- is paced twice per frame and runs at cap/2. That is a
// halved game, and it is silent: the app looks like it is simply slow.
//
// The symptom is arithmetic, which is why this is a sweep and not an opinion:
//
//   uncapped  ~437/s   capped  60.0/s   -> OK        (one present per frame)
//   uncapped  ~437/s   capped  30.1/s   -> SUBMULTIPLE x2  (two per frame)
//   uncapped    31/s   capped  31.0/s   -> UNDER_CAP (self-paced, untouched)
//
// Each app runs twice, uncapped then capped, and the rate is WinePerf's
// PRESENT/s -- one count per Flip, per D3D Present, per full blit, per
// Unlock-present -- read back from the page. Runs are serial: two browsers
// on one box measure the box.
//
// PRESENT/s IS NOT THE FRAME RATE. It counts every paced-or-not present, and
// measured 2026-09-23 on ascii.dev StarCraft makes ~97 of them a second while
// the screen changes 18 times, Marbles 243 against 12. So each run also counts
// DISTINCT DISPLAYED frames -- a 160x120 downsample of the screen hashed on
// every rAF -- and how many ms a second the cap actually slept. The last
// column is the limiter recommendation that follows from those two:
//
//   ON           the cap slept (the app outruns it) and the displayed frame
//                rate held within 10% -- the paced presents are real frames
//   OFF-NO-BIND  the cap never slept: it costs nothing and buys nothing
//   OFF-HURTS    the cap slept and the displayed frame rate fell
//   OFF-SLOW     the app's own game-step counter (lib/apps.js
//                perf.logicalFrame) runs below the cap: the cap slept only
//                on presents that are not frames. StarCraft in gameplay makes
//                ~119 presents/s for ~18 game steps/s; the cap cuts presents
//                to ~68 and changes neither game steps nor displayed frames,
//                which is idle-CPU saving, not frame limiting.
//
// Displayed frames are bounded by the display refresh in both arms, so they
// compare like with like; pass --headful for numbers worth quoting.
//
// WHAT IT CANNOT SEE. It drives no input, so an app is measured wherever it
// parks itself on startup: a title screen, a menu, an attract loop. That is
// a real present loop and a real answer for it, but an app whose fast path is
// only reached in gameplay reads as UNDER_CAP or NOPRESENT here. Those rows
// mean "not measured", not "safe" -- drive them with tools/profile-web-frames
// --guest-script and read the same two numbers.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(`--${name}=`));
  return a === undefined ? dflt : a.slice(name.length + 3);
};
// Every occurrence of a repeatable flag, comma lists included. Reading only
// the first one silently dropped the second --start-click of a two-click
// route (Half-Life's New game -> Easy never got its Easy).
const optAll = name => argv.filter(x => x.startsWith(`--${name}=`))
  .flatMap(a => a.slice(name.length + 3).split(',')).filter(Boolean);
const CAP = Number(opt('cap', 60));
const SECONDS = Number(opt('seconds', 8));
const WARMUP = Number(opt('warmup', 25));
const LIMIT = Number(opt('limit', 0));
const JSON_OUT = opt('json', '');
const MD_OUT = opt('md', '');
const ONLY = (opt('apps', '') || '').split(',').filter(Boolean);
const HEADFUL = argv.includes('--headful');
// --start-key=VK@SEC[,...]: tap a guest key SEC seconds after launch, during
// the warmup, so the sample measures the screen that key leads to. An app
// that parks on a menu or briefing without input is otherwise measured THERE:
// StarCraft's `ophelia terran1` route stops on the mission briefing, whose
// animated portraits make ~160 presents/s while its game loop runs zero steps.
// Pair with a --warmup long enough to cover the load after the key.
const START_KEYS = optAll('start-key').map(spec => {
  const [vk, at] = spec.split('@');
  return { vk: Number(vk), at: Number(at || 0) };
});
// --start-click=X:Y@SEC[,...]: the same for a left click at GUEST pixel X,Y
// (StarCraft's briefing Start button is 545:393 -- its hotkey does nothing
// there). Mapped through the exclusive-presentation viewport the way
// tools/web-input-probe.js toPage() maps it, then fed to the renderer.
const START_CLICKS = optAll('start-click').map(spec => {
  const [xy, at] = spec.split('@');
  const [x, y] = xy.split(':').map(Number);
  return { x, y, at: Number(at || 0) };
});
// --start-text=TEXT@SEC[,...]: type TEXT (no commas or @) as keydown +
// keypress + keyup per character. keydown alone types nothing into a field
// that reads only WM_CHAR -- the browser synthesizes WM_CHAR from keypress
// (Motocross Madness's Enter Name box).
const START_TEXTS = optAll('start-text').map(spec => {
  const i = spec.lastIndexOf('@');
  return { text: spec.slice(0, i), at: Number(spec.slice(i + 1) || 0) };
});
// --start-input=ENTRY@SEC[,...]: one run.js-style input entry at SEC seconds
// after launch: relmousemove:DX:DY, mousedown:X:Y, mouseup:X:Y (guest pixels),
// keydown:VK, keyup:VK. For routes that a click or key tap cannot express:
// MechWarrior 3's menus read DirectInput relative motion, so its cursor is
// parked and moved with relmousemove, and a press is a held down/up pair.
const START_INPUTS = optAll('start-input').map(spec => {
  const i = spec.lastIndexOf('@');
  const [kind, a, b] = spec.slice(0, i).split(':');
  if (!['relmousemove', 'mousedown', 'mouseup', 'keydown', 'keyup'].includes(kind))
    throw new Error(`--start-input: unsupported entry ${JSON.stringify(spec)}`);
  return { kind, a: Number(a), b: Number(b), at: Number(spec.slice(i + 1) || 0) };
});
// --shots=DIR: screenshot each run at the end of its sample, so what was
// measured can be looked at rather than assumed.
const SHOTS = opt('shots', '');

// A present-capable app is one whose executable names a DLL that can reach a
// paced path. A byte scan rather than an import walk on purpose: a game that
// LoadLibrary's ddraw at runtime imports nothing and still presents.
const PRESENT_DLLS = ['ddraw.dll', 'd3d8.dll', 'd3d9.dll', 'd3drm.dll', 'opengl32.dll'];
const scanForDlls = file => {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  const hay = buf.toString('latin1').toLowerCase();
  return PRESENT_DLLS.filter(d => hay.includes(d));
};

const { APPS } = require(path.join(ROOT, 'lib', 'apps.js'));

const candidates = [];
for (const [id, app] of Object.entries(APPS)) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  if (!app || !app.exe) continue;
  const exe = path.join(ROOT, app.exe.startsWith('binaries/') ? 'test/' + app.exe : app.exe);
  const dlls = ONLY.length ? (scanForDlls(exe) || []) : scanForDlls(exe);
  if (dlls === null) continue;              // exe not on this machine
  if (!ONLY.length && !dlls.length) continue;
  candidates.push({ id, dlls });
}
candidates.sort((a, b) => a.id.localeCompare(b.id));
const apps = LIMIT ? candidates.slice(0, LIMIT) : candidates;

if (argv.includes('--list')) {
  for (const c of apps) console.log(`${c.id.padEnd(28)} ${c.dlls.join(' ')}`);
  console.log(`\n${apps.length} present-capable app(s) of ${Object.keys(APPS).length}`);
  process.exit(0);
}

// Starts the distinct-displayed-frame counter and marks the pacing counters
// when the warmup ends, so both cover exactly the sample window.
const AFTER_LAUNCH = `${START_KEYS.map(k => `setTimeout(() => {
  sharedRenderer.handleKeyDown(${k.vk});
  setTimeout(() => sharedRenderer.handleKeyUp(${k.vk}), 200);
}, ${k.at * 1000});`).join('\n')}
${START_TEXTS.map(k => `setTimeout(() => {
  const text = ${JSON.stringify(k.text)};
  [...text].forEach((ch, i) => setTimeout(() => {
    const vk = ch.toUpperCase().charCodeAt(0);
    sharedRenderer.handleKeyDown(vk);
    sharedRenderer.handleKeyPress(ch.charCodeAt(0));
    setTimeout(() => sharedRenderer.handleKeyUp(vk), 80);
  }, i * 250));
}, ${k.at * 1000});`).join('\n')}
${START_CLICKS.map(k => `setTimeout(() => {
  const c = document.getElementById('screen');
  const v = sharedRenderer._exclusivePresentationViewport;
  let cx = ${k.x} + 0.5, cy = ${k.y} + 0.5;
  if (v && v.nativeW > 0 && v.nativeH > 0 && v.outputW > 0 && v.outputH > 0) {
    cx = (v.dstX + (cx - v.nativeX) * v.dstW / v.nativeW) * c.width / v.outputW;
    cy = (v.dstY + (cy - v.nativeY) * v.dstH / v.nativeH) * c.height / v.outputH;
  }
  sharedRenderer.handleMouseMove(cx, cy);
  setTimeout(() => sharedRenderer.handleMouseDown(cx, cy, 0), 100);
  setTimeout(() => sharedRenderer.handleMouseUp(cx, cy, 0), 250);
}, ${k.at * 1000});`).join('\n')}
${START_INPUTS.map(k => `setTimeout(() => {
  const kind = ${JSON.stringify(k.kind)}, a = ${k.a}, b = ${k.b};
  if (kind === 'relmousemove') return sharedRenderer.handleRelativeMouseMove(a, b);
  if (kind === 'keydown') return sharedRenderer.handleKeyDown(a);
  if (kind === 'keyup') return sharedRenderer.handleKeyUp(a);
  const c = document.getElementById('screen');
  const v = sharedRenderer._exclusivePresentationViewport;
  let cx = a + 0.5, cy = b + 0.5;
  if (v && v.nativeW > 0 && v.nativeH > 0 && v.outputW > 0 && v.outputH > 0) {
    cx = (v.dstX + (cx - v.nativeX) * v.dstW / v.nativeW) * c.width / v.outputW;
    cy = (v.dstY + (cy - v.nativeY) * v.dstH / v.nativeH) * c.height / v.outputH;
  }
  if (kind === 'mousedown') sharedRenderer.handleMouseDown(cx, cy, 0);
  else sharedRenderer.handleMouseUp(cx, cy, 0);
}, ${k.at * 1000});`).join('\n')}
setTimeout(() => {
  const a = runningApps.find(x => x && x.wine);
  const ex = a && a.wine.instance && a.wine.instance.exports;
  const screen = document.getElementById('screen');
  const small = document.createElement('canvas');
  small.width = 160; small.height = 120;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const D = window.__prsD = { t: performance.now(), n: 0, raf: 0, last: -1,
    pacedMs: ex && ex.get_present_paced_ms ? ex.get_present_paced_ms() : null };
  // An app with a proven game-step counter (lib/apps.js perf.logicalFrame)
  // has its cumulative count polled into this ring every 500ms.
  const L = WinePerf.logicalFrameCounts;
  D.game0 = L && L.length ? L[L.length - 1] : null;
  const tick = () => {
    try {
      sctx.drawImage(screen, 0, 0, 160, 120);
      const px = new Uint32Array(sctx.getImageData(0, 0, 160, 120).data.buffer);
      let h = 0x811c9dc5;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 16777619);
      if (h !== D.last) { D.n++; D.last = h; }
      D.raf++;
    } catch (_) {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, ${WARMUP * 1000}); 'armed'`;

// PRESENT/s as the page itself counts it, plus a liveness hash so a frozen
// app is not reported as a well-behaved slow one.
const REPORT = `JSON.stringify((() => {
  const s = WinePerf.snapshot();
  const a = runningApps.find(x => x && x.wine);
  const D = window.__prsD, ex = a && a.wine.instance && a.wine.instance.exports;
  const sec = D ? (performance.now() - D.t) / 1000 : 0;
  const distinct = D && sec > 0 ? D.n / sec : null;
  const raf = D && sec > 0 ? D.raf / sec : null;
  const pacedMs = D && sec > 0 && D.pacedMs !== null && ex
    ? (ex.get_present_paced_ms() - D.pacedMs) / sec : null;
  // Game steps/s over the sample, from the app's own counter (null if none).
  const L = WinePerf.logicalFrameCounts, g1 = L && L.length ? L[L.length - 1] : null;
  const gdt = D && D.game0 && g1 ? (g1.at - D.game0.at) / 1000 : 0;
  const game = gdt > 0 ? (g1.count - D.game0.count) / gdt : null;
  const gameVerifier = gdt > 0 && g1.verifier != null && D.game0.verifier != null
    ? (g1.verifier - D.game0.verifier) / gdt : null;
  const c = document.getElementById('screen');
  let hash = 0;
  try {
    const t = document.createElement('canvas'); t.width = 32; t.height = 24;
    const cx = t.getContext('2d', { willReadFrequently: true });
    cx.drawImage(c, 0, 0, 32, 24);
    const d = cx.getImageData(0, 0, 32, 24).data;
    hash = 2166136261;
    for (let i = 0; i < d.length; i += 4) { hash ^= d[i]; hash = Math.imul(hash, 16777619); }
    hash >>>= 0;
  } catch (e) {}
  return { fps: s.guestFps, running: !!(a && a.wine.running), hash, distinct, raf, pacedMs, game, gameVerifier };
})())`;

const runOnce = (id, cap) => {
  const args = ['tools/profile-web-frames.js', `--app=${id}`, `--seconds=${SECONDS}`,
    `--warmup=${WARMUP}`, `--query=?debug&perf&present-cap=${cap}`,
    `--after-launch=${AFTER_LAUNCH}`, `--report-eval=${REPORT}`];
  if (HEADFUL) args.push('--headful');
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    args.push(`--screenshot=${path.join(SHOTS, `${id}-cap${cap}.png`)}`);
  }
  if (argv.includes('--software-browser')) args.push('--software-browser');
  let out = '';
  try {
    out = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8',
      maxBuffer: 1 << 28, timeout: (WARMUP + SECONDS + 120) * 1000 });
  } catch (e) { out = String((e.stdout || '') + (e.stderr || '')); }
  const m = out.match(/report-eval:\s*(\{.*\})/);
  if (!m) return { fps: null, running: false, hash: 0, error: 'no report' };
  try { return JSON.parse(m[1]); } catch { return { fps: null, running: false, hash: 0, error: 'bad json' }; }
};

// The limiter recommendation (see the header): ON only where the cap binds
// and the frame rate survives it. An app with its own game-step counter is
// judged on game steps -- the frames the game logic actually ran -- rather
// than on displayed frames, which rAF caps and a screen hash only proxies.
const limiter = (un, cp) => {
  if (!(cp.pacedMs >= 20)) return 'OFF-NO-BIND';
  if (un.game > 0.5 && cp.game >= 0) {
    if (un.game < 0.9 * CAP) return 'OFF-SLOW';
    return cp.game >= 0.9 * un.game ? 'ON' : 'OFF-HURTS';
  }
  if (!(un.distinct > 0.5) || !(cp.distinct >= 0)) return 'OFF-NO-BIND';
  return cp.distinct >= 0.9 * un.distinct ? 'ON' : 'OFF-HURTS';
};

const classify = (u, c) => {
  if (u === null || c === null) return { verdict: 'ERROR' };
  if (u < 1) return { verdict: 'NOPRESENT' };
  if (u <= CAP * 1.15) return { verdict: 'UNDER_CAP' };
  if (c >= CAP * 0.85) return { verdict: 'OK' };
  // cap/k for an integer k >= 2 is the multi-present-per-frame signature.
  const k = Math.round(CAP / Math.max(c, 0.001));
  if (k >= 2 && Math.abs(c - CAP / k) <= 0.2 * (CAP / k)) return { verdict: `SUBMULTIPLE_x${k}`, k };
  return { verdict: 'LOW' };
};

(async () => {
  console.log(`present-rate sweep: ${apps.length} app(s), cap ${CAP}/s, ` +
    `${SECONDS}s sample after ${WARMUP}s warmup, serial\n`);
  const rows = [];
  for (const [i, c] of apps.entries()) {
    const load = require('os').loadavg()[0].toFixed(1);
    process.stdout.write(`[${i + 1}/${apps.length}] ${c.id} (load ${load}) ... `);
    const un = runOnce(c.id, 0);
    const cp = runOnce(c.id, CAP);
    const u = typeof un.fps === 'number' ? un.fps : null;
    const p = typeof cp.fps === 'number' ? cp.fps : null;
    const res = classify(u, p);
    const row = { id: c.id, dlls: c.dlls, uncapped: u, capped: p, ...res,
      frozen: un.hash !== 0 && un.hash === cp.hash,
      distinctUncapped: un.distinct, distinctCapped: cp.distinct,
      gameUncapped: un.game, gameCapped: cp.game,
      gameVerifierUncapped: un.gameVerifier, gameVerifierCapped: cp.gameVerifier,
      pacedMs: cp.pacedMs, limiter: limiter(un, cp) };
    rows.push(row);
    const f1 = v => (typeof v === 'number' ? v.toFixed(1) : 'n/a');
    console.log(`${f1(u).padStart(7)} -> ${f1(p).padStart(6)}  ${res.verdict}` +
      `  distinct ${f1(un.distinct)} -> ${f1(cp.distinct)}` +
      (un.game != null || cp.game != null ? `  game ${f1(un.game)} -> ${f1(cp.game)}` +
        ` (verifier ${f1(un.gameVerifier)} -> ${f1(cp.gameVerifier)})` : '') +
      `  slept ${f1(cp.pacedMs)}ms/s  ${row.limiter}`);
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
  }

  const order = ['SUBMULTIPLE', 'LOW', 'OK', 'UNDER_CAP', 'NOPRESENT', 'ERROR'];
  rows.sort((a, b) => order.findIndex(o => a.verdict.startsWith(o)) -
                      order.findIndex(o => b.verdict.startsWith(o)));
  const f1 = v => (typeof v === 'number' ? v.toFixed(1) : 'n/a');
  const lines = ['', '| app | dlls | uncapped/s | capped/s | verdict | distinct/s unc -> cap | cap slept ms/s | limiter |',
    '|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    lines.push(`| ${r.id} | ${r.dlls.join(' ')} | ${f1(r.uncapped)} | ${f1(r.capped)} | ${r.verdict} ` +
      `| ${f1(r.distinctUncapped)} -> ${f1(r.distinctCapped)} | ${f1(r.pacedMs)} | ${r.limiter} |`);
  }
  console.log(lines.join('\n'));
  const bad = rows.filter(r => r.verdict.startsWith('SUBMULTIPLE') || r.verdict === 'LOW');
  if (bad.length) {
    console.log(`\n${bad.length} app(s) the cap may halve -- repro each with:`);
    for (const r of bad) {
      console.log(`  node tools/profile-web-frames.js --app=${r.id} --seconds=${SECONDS} ` +
        `--warmup=${WARMUP} --query='?debug&perf&present-cap=${CAP}' --headful`);
    }
    console.log('  (fix per app with `presentCap: 0` in lib/apps.js, or make the rule coalesce)');
  } else {
    console.log('\nno app landed on a submultiple of the cap');
  }
  const on = rows.filter(r => r.limiter === 'ON').map(r => r.id);
  console.log(`\nlimiter ON (set presentCap: 60 in lib/apps.js): ${on.length ? on.join(', ') : 'none'}`);
  if (MD_OUT) fs.writeFileSync(MD_OUT, lines.join('\n') + '\n');
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
})();
