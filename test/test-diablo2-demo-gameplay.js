#!/usr/bin/env node
'use strict';

// Diablo II Shareware demo, Direct3D route (lib/apps.js seeds VideoConfig
// Render=1, so the game LoadLibrary's d2direct3d.dll at runtime).
//
// The route is driven event-first through test/run.js --control-stdin --frozen:
// every stage waits for the pixels that stage is supposed to produce instead of
// firing input at a fixed batch number. The previous fixed-schedule version was
// calibrated against one --batch-size, and both the renderer change and any
// budget change silently moved the screens out from under its clicks.
//
// By default the run stops at the Act I loading portal, which is the last stage
// that fits a bounded test: reaching the Rogue Encampment beyond it costs
// several more minutes of emulated Act I load on a shared box. Set
// DIABLO2_FULL_ROUTE=1 to continue into gameplay and assert the terrain and the
// life/mana orbs; docs/re-notes/diablo2-demo.md records that measurement.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PNG } = require('pngjs');
const { diffPng } = require('../tools/png-diff');
const { startControlSession } = require('./control-session');

const ROOT = path.resolve(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const INSTALLED = path.join(ROOT,
  'test/binaries/candidates/diablo-2-demo-installer/installed-extracted');
const FULL_ROUTE = process.env.DIABLO2_FULL_ROUTE === '1';
const SHOTS = process.env.DIABLO2_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), 'wine-assembly-diablo2-demo-gameplay');

// A batch is a budget of blocks, and this route spends almost none of the old
// 1,000,000 on work: measured over the first 100s of the D3D route, 99.7% of
// all 56M Win32 calls were a PeekMessageA/QueryPerformanceFrequency/
// QueryPerformanceCounter frame-limiter spin, and the only thing that ends it
// is the next batch's guest clock tick. Surplus budget therefore buys spin, not
// progress. Measured user CPU for this route: 91s at 200,000, 49s at 50,000,
// 51s at 20,000 -- 50,000 is the knee, below which per-batch host overhead
// takes the saving back.
const BATCH_SIZE = Number(process.env.DIABLO2_BATCH_SIZE) || 50000;
// The guest clock must stay at the default 200ms/batch: Storm's MPQ completion
// waits are 255ms, and a coarser tick steps straight over them, which the game
// reports as "This application has encountered a critical error".
// The default route costs 49s of user CPU and about 55s of wall clock on a box
// that is not busy. The guard is not the expected duration: this box runs
// several agent sweeps and reaches load 50, where the same work only gets a
// fraction of a core, so the guard is sized for that and tools/test-timeouts.js
// carries the matching 480s runner cap. The opt-in full route is never run by
// run-all.sh and gets the 900s its Act I load actually needs.
const GUEST_SECONDS = FULL_ROUTE ? 900 : 420;
// Extra run.js flags for a second renderer arm, e.g.
// DIABLO2_EXTRA_ARGS='--headless-gl --d3dim-gpu' for WebGL; empty = software.
const EXTRA_ARGS = (process.env.DIABLO2_EXTRA_ARGS || '').split(/\s+/).filter(Boolean);

if (!fs.existsSync(path.join(INSTALLED, 'diablo ii.exe'))) {
  console.log('SKIP Diablo II Demo installer-produced payload is not present');
  process.exit(0);
}

function stats(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const colors = new Set();
  let nonBlack = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r || g || b) nonBlack++;
    colors.add((r << 16) | (g << 8) | b);
  }
  const box = (x0, y0, x1, y1, predicate) => {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * png.width + x) * 4;
        if (predicate(png.data[i], png.data[i + 1], png.data[i + 2])) n++;
      }
    }
    return n;
  };
  // Diablo II's buttons are light stone plates; nothing else on these screens
  // is both bright and desaturated.
  const plate = (r, g, b) =>
    Math.min(r, g, b) > 90 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
  // The class screen is lit by one campfire, so its OK plate peaks at 131
  // against the main menu's 255. Measured: 1120 pixels over this floor once the
  // name box exists, and exactly 0 before it.
  const dimPlate = (r, g, b) =>
    Math.min(r, g, b) > 40 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
  return {
    file, width: png.width, height: png.height, nonBlack, colors: colors.size,
    singlePlayer: box(200, 145, 440, 185, plate),
    exitButton: box(200, 425, 440, 465, plate),
    okButton: box(495, 425, 615, 460, dimPlate),
    // The Act I loading portal is one centred illustration on black. Diablo
    // II's own "critical error" box also leaves a mostly black frame, but it
    // paints over the left margin, which the portal never touches.
    portal: box(185, 105, 455, 365, (r, g, b) => r || g || b),
    leftMargin: box(0, 0, 180, 480, (r, g, b) => r || g || b),
    terrain: box(0, 0, 640, 380, (r, g, b) => g > 30 && g > r * 1.08 && g > b * 1.2),
    lifeOrb: box(0, 360, 125, 480, (r, g, b) => r > 70 && r > g * 1.5 && r > b * 1.5),
    manaOrb: box(515, 360, 640, 480, (r, g, b) => b > 70 && b > r * 1.35 && b > g * 1.35),
  };
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const session = startControlSession([
    RUN,
    '--app=diablo2_demo',
    '--no-build',
    `--batch-size=${BATCH_SIZE}`,
    '--max-batches=1000000',
    `--max-seconds=${GUEST_SECONDS}`,
    '--repaint-every=10000',
    '--quiet-api',
    '--quiet-blocks',
    '--no-close',
    '--control-stdin',
    '--frozen',
    ...EXTRA_ARGS,
  ], { cwd: ROOT, idPrefix: 'd2g-' });

  let batch = 0;
  const step = async n => {
    const reply = await session.send({ action: 'step', n });
    assert.strictEqual(reply.ran, n,
      `requested ${n} frozen steps, ran ${reply.ran}\n${session.output().slice(-8000)}`);
    batch += n;
  };
  const capture = async name => {
    const file = path.join(SHOTS, `${name}.png`);
    await session.send({ action: 'png', path: file });
    return stats(file);
  };
  const click = async (x, y, settle) => {
    await session.send(`mousemove:${x}:${y}`);
    await step(2);
    await session.send(`mousedown:${x}:${y}`);
    await step(2);
    await session.send(`mouseup:${x}:${y}`);
    await step(settle);
  };
  // Waits for `accept`, stepping `chunk` batches between captures. Returns the
  // accepted frame; throws with the tail of the run's own output otherwise.
  const waitFor = async (name, accept, { attempts, chunk = 10 }) => {
    let last = null;
    for (let i = 0; i < attempts; i++) {
      await step(chunk);
      last = await capture(name);
      if (accept(last)) return last;
      assert(!session.output().includes('*** CRASH'),
        `Diablo II crashed waiting for ${name}\n${session.output().slice(-6000)}`);
    }
    throw new Error(`Diablo II never reached ${name} (batch ${batch}, last ` +
      `${JSON.stringify(last && { ...last, file: undefined })})\n` +
      session.output().slice(-8000));
  };

  let reached = false;
  try {
    // The intro cinematics are skippable and the menu will not appear until
    // they are dismissed.
    await step(4);
    for (let i = 0; i < 4; i++) {
      await session.send('keydown:27');
      await step(1);
      await session.send('keyup:27');
      await step(4);
    }

    const menu = await waitFor('01-main-menu',
      frame => frame.singlePlayer > 1000 && frame.exitButton > 1000,
      { attempts: 200 });
    assert.strictEqual(menu.width, 640);
    assert.strictEqual(menu.height, 480);
    // d2ddraw.dll is a static import on every route, so only a runtime load of
    // d2direct3d.dll proves the Render=1 seeding actually selected Direct3D.
    assert(/\[LoadLibrary\] d2direct3d\.dll loaded/i.test(session.output()),
      `the demo did not take the Direct3D route\n${session.output().slice(-6000)}`);

    await click(320, 164, 10); // SINGLE PLAYER
    const heroes = await waitFor('02-select-hero-class',
      frame => diffPng(menu.file, frame.file).changed > 40000 &&
        frame.exitButton < 500,
      { attempts: 40, chunk: 5 });

    // Hovering the Barbarian prints his name and blurb; double-clicking him is
    // what Diablo II accepts as the class choice (BN_DOUBLECLICKED).
    await session.send('mousemove:315:210');
    await step(4);
    await session.send('dblclick:315:210');
    const named = await waitFor('03-character-name',
      frame => frame.okButton > 400 &&
        diffPng(heroes.file, frame.file).changed > 2000,
      { attempts: 40, chunk: 10 });

    await click(320, 422, 6); // the CHARACTER NAME field
    for (const vk of [84, 69, 83, 84]) { // "TEST"
      await session.send(`keypress:${vk}`);
      await step(2);
    }
    const typed = await capture('04-character-named');
    assert(diffPng(named.file, typed.file).changed > 100,
      `typing the character name changed nothing\n${session.output().slice(-6000)}`);

    await click(553, 442, 20); // OK
    // Accepting the character tears the class screen down and puts up the Act I
    // loading portal: a small centred illustration on an otherwise black frame.
    const loading = await waitFor('05-act-i-loading',
      frame => frame.okButton < 200 && frame.leftMargin < 2000 &&
        frame.portal > 30000 && frame.colors > 100,
      { attempts: 150, chunk: 10 });
    console.log(`Diablo II reached the Act I load at batch ${batch} ` +
      `(${loading.portal} lit portal pixels, ${loading.colors} colors)`);

    if (!FULL_ROUTE) {
      reached = true;
      console.log('PASS Diablo II Demo creates a Barbarian on the Direct3D route ' +
        'and enters the Act I load (set DIABLO2_FULL_ROUTE=1 for the Rogue Encampment)');
      return;
    }

    // The green-pixel count is framing-dependent and the Act I load is one of
    // the nondeterministic paths, so the old `> 50000` pinned one camera
    // position: three captures of the same encampment -- grass, wagon,
    // campfire, NPC, Barbarian, both orbs, HUD -- scored 87,447, 43,950 and
    // 34,552. What the assertion protects against is the silent-success
    // DrawIndexedPrimitiveVB stub, whose black floor leaves 743-2,186, the same
    // range the menu and loading screens score. 20,000 is 10x over that failure
    // and 1.7x under the tightest frame that is genuinely gameplay.
    const world = await waitFor('06-rogue-encampment',
      frame => frame.terrain > 20000 && frame.lifeOrb > 2500 &&
        frame.manaOrb > 2000 && frame.colors > 100,
      { attempts: 400, chunk: 40 });
    assert(world.terrain > 20000,
      `Rogue Encampment terrain is missing (${world.terrain} green pixels)`);
    assert(world.lifeOrb > 2500, `life orb is missing (${world.lifeOrb} red pixels)`);
    assert(world.manaOrb > 2000, `mana orb is missing (${world.manaOrb} blue pixels)`);
    assert(world.colors > 100, `gameplay frame has too few colors (${world.colors})`);

    // Control response: a ground click walks the Barbarian and the camera
    // follows, so the whole view shifts. Rain and torches animate the idle
    // frame too, so compare against an idle interval of the same length.
    const idleA = await capture('07-idle-a');
    await step(40);
    const idleB = await capture('07-idle-b');
    await click(470, 200, 40);
    const moved = await capture('08-after-ground-click');
    const idleChanged = diffPng(idleA.file, idleB.file).changed;
    const movedChanged = diffPng(idleB.file, moved.file).changed;
    console.log(`Diablo II ground click: ${movedChanged} pixels changed vs ` +
      `${idleChanged} over the same idle interval`);
    assert(movedChanged > 2 * idleChanged && movedChanged > 20000,
      `a ground click did not move the view (${movedChanged} vs idle ${idleChanged})`);
    reached = true;
    console.log('PASS Diablo II Demo creates a Barbarian and renders playable ' +
      `Rogue Encampment gameplay on the Direct3D route (batch ${batch})`);
  } finally {
    const output = session.output();
    await session.quit({ ignoreReplyError: true });
    // Only when the route itself succeeded: an assertion thrown from a finally
    // block replaces the real failure with a less informative one.
    if (reached) {
      assert(!output.includes('UNIMPLEMENTED API: strncmp'), output.slice(-5000));
      assert(!output.includes('UNIMPLEMENTED API: _strnicmp'), output.slice(-5000));
      assert(!output.includes('*** CRASH'), output.slice(-5000));
    }
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
