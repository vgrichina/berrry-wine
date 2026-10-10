#!/usr/bin/env node
'use strict';

// The perf HUD's game-step metric is page-wide, but a page can run several
// hosts. Moorhuhn 3 ShellExecutes a helper exe that launches as its own app
// with no perf entry; its configurePerf(null) and its exit used to clear the
// game's metric, so the HUD dropped every count while the game's own counter
// poll kept running (seen on a headful boat, 2026-10-10). Only the host that
// set the metric may clear it.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const calls = [];
const hud = {
  enabled: true,
  logicalFrameMetric: null,
  setLogicalFrameMetric(m) { calls.push(m ? 'set' : 'clear'); this.logicalFrameMetric = m; },
};
const context = { console, setTimeout, setInterval, clearInterval, URLSearchParams, Uint8Array, window: { WinePerf: hud } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8')
  + '\n;globalThis.WineAssembly = WineAssembly;', context);
const P = context.WineAssembly.prototype;

const game = Object.create(P);
const helper = Object.create(P);

(async () => {
  // The game claims the metric (what configurePerf does once armed).
  P._claimPerfHud.call(game, hud, { label: 'GAME', verifier: 0 });
  assert.ok(hud.logicalFrameMetric, 'game set the metric');

  // The helper process launches with no perf entry, then exits.
  assert.strictEqual(await P.configurePerf.call(helper, null), false);
  assert.ok(hud.logicalFrameMetric, 'a host with no perf entry must not clear the game metric');
  P._stopPerfCounterPoll.call(helper);
  assert.ok(hud.logicalFrameMetric, 'another host stopping must not clear the game metric');

  // The owner still clears its own metric when it stops.
  P._stopPerfCounterPoll.call(game);
  assert.strictEqual(hud.logicalFrameMetric, null, 'the owner clears on stop');
  assert.deepStrictEqual(calls, ['set', 'clear']);

  console.log('PASS  only the host that set the HUD game-step metric clears it');
})().catch(e => { console.error(e); process.exit(1); });
