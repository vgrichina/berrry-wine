#!/usr/bin/env node
'use strict';

// `relmousemove:DX:DY:STEPS` spreads one relative delta over STEPS consecutive
// batches instead of handing it to the guest in a single lump.
//
// Why it exists: a DirectInput game reads everything accumulated since its own
// last poll, and a headless batch is roughly one of its frames, so an injected
// sweep arrives as a delta no hand could produce. A 2D menu clamps such a value
// at the screen edge; a 3D scene feeds it to a camera or a terrain pick, and
// Black & White 2's land picker stops presenting entirely when it gets one
// (docs/re-notes/black-white-2.md). Stepped, the same sweep looks like motion.
//
// --frozen makes this exact rather than timing-dependent: one `step` is one
// batch, so the cursor must advance by exactly one step's worth per batch, and
// the remainder must land on the last step so the total always arrives.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { startControlSession } = require('./control-session');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(__dirname, 'binaries', 'xp', 'winmine.exe');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  winmine.exe not found at ' + EXE);
  process.exit(0);
}

const session = startControlSession([
  'test/run.js', '--exe=' + EXE, '--control-stdin', '--frozen',
  '--max-seconds=30', '--quiet-api', '--quiet-blocks', '--no-build',
], { cwd: ROOT, idPrefix: 'rms-' });

const point = (x, y) => ((y << 16) | x) >>> 0;

(async () => {
  try {
    await session.send({ action: 'eval', code: 'renderer.setMousePosition(100, 100)' });

    // 41 and 9 divide by 4 with a remainder on both axes, which is the case a
    // plain integer division would silently drop.
    assert.strictEqual((await session.send('relmousemove:41:9:4')).queued, true);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await session.step(1);
      seen.push(await session.send({ action: 'eval', code: 'renderer.getMousePosition()' }));
    }
    assert.deepStrictEqual(seen,
      [point(110, 102), point(120, 104), point(130, 106), point(141, 109)],
      'each batch takes one step, and the last one takes the remainder');

    // A further batch must not move it again: the schedule is spent, not looping.
    await session.step(1);
    assert.strictEqual(
      await session.send({ action: 'eval', code: 'renderer.getMousePosition()' }),
      point(141, 109), 'the stepped move kept going after its last step');

    // No STEPS field is the old behaviour, unchanged: one batch, whole delta.
    assert.strictEqual((await session.send('relmousemove:-41:-9')).queued, true);
    await session.step(1);
    assert.strictEqual(
      await session.send({ action: 'eval', code: 'renderer.getMousePosition()' }),
      point(100, 100), 'an unstepped relmousemove is still delivered in one batch');

    const code = await session.quit();
    assert.strictEqual(code, 0, session.output().slice(-3000));
    assert.match(session.output(),
      /\[input\] relmousemove 10,2 at batch \d+ \(step 4 of 41,9 remaining\)/);
    console.log('PASS  a stepped relmousemove arrives one step per batch, remainder last');
  } catch (error) {
    await session.quit({ ignoreReplyError: true });
    throw error;
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
