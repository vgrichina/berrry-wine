#!/usr/bin/env node
'use strict';

// Source-only: execute production initialization, including startup wrappers,
// guest clock construction and the actual h.get_ticks assignment. No guest VM.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { createBatchClock } = require('../lib/batch-clock');
const { createGuestClockSource } = require('../lib/guest-clock');
const { createStartupClock } = require('../lib/startup-clock');
const { createInputConsumptionTrace } = require('./input-consumption-trace');
const source = fs.readFileSync(require.resolve('./run.js'), 'utf8');
const start = source.indexOf('  // Startup dilation wraps the batch clock');
const end = source.indexOf('  // Every OTHER import table', start);
assert(start >= 0 && end > start, 'production initialization markers');
const initialization = source.slice(start, end);
// The initialization also checks the independent scheduler-observer flag.
// Use the production parser with no CLI flags, leaving that observer disabled.
const flagParser = source.match(/^const hasFlag = .*;$/m)?.[0];
assert(flagParser, 'production flag parser');

function fixture(code, { enabled = true, real = false, startup = true } = {}) {
  const batchClock = createBatchClock(200);
  let now = 500, probes = 0;
  const c = vm.createContext({
    args: [],
    batchClock, tickState: batchClock.state, createStartupClock,
    serviceClock: false, gameplayBench: null,
    STARTUP_CLOCK_CFG: startup
      ? { factor: 0.01, maxMs: 30000, endOn: 'firstPresent:directdraw' } : null,
    createGuestClockSource: options => {
      const clock = createGuestClockSource({ ...options, now: () => now }), ticks = clock.ticks;
      clock.ticks = () => { probes++; return ticks(); };
      return clock;
    },
    createInputConsumptionTrace, TRACE_INPUT_DISPATCH: enabled,
    REAL_TICKS: real, TIME_SCALE: 2, CLOCK_ORIGIN: 500,
    Date: { now: () => now }, DX_LOCK_PAUSE: {}, VBLANK: {},
    ctx: { sharedAudio: {} }, h: {}, logs: [], console: { log() {} },
  });
  vm.runInContext(flagParser + '\n' + code, c);
  const api = vm.runInContext('({guestClock, startupClock, inputConsumptionTrace})', c);
  return { ...api, h: c.h, ctx: c.ctx, logs: c.logs, batchClock,
    setNow: n => { now = n; }, probes: () => probes };
}

function observe(f, expectedTick, expectedMs) {
  const before = JSON.stringify(f.batchClock.state), probes = f.probes();
  f.inputConsumptionTrace.schedule({ batch: 2, action: 'keydown' });
  assert.strictEqual(f.probes(), probes, 'trace spent a guest probe');
  assert.strictEqual(JSON.stringify(f.batchClock.state), before, 'snapshot changed clock state');
  assert(f.logs.at(-1).includes(`guestMs=${expectedMs} clock=`), 'published guest time');
  assert(f.logs.at(-1).endsWith(`lastGuestTick=${expectedTick}`), 'actual last guest return');
}

function checks(code) {
  const f = fixture(code);
  f.batchClock.state.batch = 7;
  const actual = f.h.get_ticks(); // actual production host import, not fixture wiring
  assert.strictEqual(actual, 14, 'production startup guest return');
  assert.strictEqual(f.batchClock.state.lastTick, 1400, 'raw clock semantics preserved');
  observe(f, actual, 14);
  // Release at a later raw instant. Remapping the old raw lastTick here would
  // invent a different past return. Publication alone must keep lastGuestTick.
  f.batchClock.state.batch = 9;
  f.ctx.startupClockEvent('firstPresent:directdraw');
  assert.strictEqual(f.startupClock.active, false);
  observe(f, 14, 18);
  f.batchClock.state.batch = 10;
  assert.strictEqual(f.h.get_ticks(), 219);
  observe(f, 219, 218);
  observe(f, 219, 218);

  const fresh = fixture(code);
  fresh.batchClock.state.batch = 7;
  observe(fresh, 'unavailable', 14);
  // A publish at the automatic deadline may release startup but is not a tick
  // read. The captured last return must survive that transition too.
  fresh.h.get_ticks();
  fresh.batchClock.state.batch = 151;
  observe(fresh, 14, 500);
  assert.strictEqual(fresh.startupClock.state.reason, 'maxMs');
  assert.strictEqual(fresh.h.get_ticks(), 501);
  observe(fresh, 501, 500);

  const plain = fixture(code, { startup: false });
  plain.batchClock.state.batch = 7;
  observe(plain, 'unavailable', 1400);
  assert.strictEqual(plain.h.get_ticks(), 1400);
  assert.strictEqual(plain.h.get_ticks(), 1401);
  observe(plain, 1401, 1400);
  plain.batchClock.state.batch = 11;
  observe(plain, 1401, 2200);
  plain.batchClock.setTickMsPerBatch(5);
  plain.batchClock.state.batch = 12;
  plain.batchClock.state.pausedMs = 17;
  observe(plain, 1401, 2222);
  assert.strictEqual(plain.h.get_ticks(), 2224);
  observe(plain, 2224, 2222);

  for (const startup of [false, true]) {
    const real = fixture(code, { real: true, startup });
    real.setNow(1200); // 1400 raw elapsed ms after timeScale=2
    observe(real, 'unavailable', startup ? 14 : 1400);
    assert.strictEqual(real.h.get_ticks(), startup ? 14 : 1400);
    real.setNow(1400); // 1800 raw
    if (startup) real.ctx.startupClockEvent('firstPresent:directdraw');
    observe(real, startup ? 14 : 1400, startup ? 18 : 1800);
    real.setNow(1500); // 2000 raw
    assert.strictEqual(real.h.get_ticks(), startup ? 218 : 2000);
    observe(real, startup ? 218 : 2000, startup ? 218 : 2000);
  }

  // Enabled/disabled initialization has identical returns and clock state.
  // Disabled observeTicks preserves the original function, with no wrapper.
  const offTrace = createInputConsumptionTrace({ enabled: false });
  const fn = () => 123;
  assert.strictEqual(offTrace.observeTicks(fn), fn);
  for (const real of [false, true]) {
    const run = enabled => {
      const x = fixture(code, { enabled, real });
      const returns = [];
      for (let batch = 1; batch <= 12; batch++) {
        x.batchClock.state.batch = batch; x.setNow(500 + batch * 100);
        if (batch === 9) x.ctx.startupClockEvent('firstPresent:directdraw');
        returns.push(x.h.get_ticks(), x.guestClock.ticks());
        x.inputConsumptionTrace.schedule({ batch: 2 });
      }
      return { returns, state: JSON.stringify(x.batchClock.state),
        startup: JSON.stringify(x.startupClock.state), probes: x.probes() };
    };
    assert.deepStrictEqual(run(true), run(false), 'trace changes clock behavior');
  }

  // A capped trace never calls snapshot again or probes the guest clock.
  const capped = fixture(code);
  capped.batchClock.state.batch = 7;
  capped.h.get_ticks();
  let samples = 0;
  const publish = capped.guestClock.publish;
  capped.guestClock.publish = () => { samples++; return publish(); };
  const before = JSON.stringify(capped.batchClock.state), probes = capped.probes();
  for (let i = 0; i < 1100; i++) capped.inputConsumptionTrace.schedule({ batch: 2 });
  assert.strictEqual(capped.logs.length, 1001);
  assert.strictEqual(samples, 1000);
  assert.strictEqual(capped.probes(), probes);
  assert.strictEqual(JSON.stringify(capped.batchClock.state), before);
}

checks(initialization);
console.log('PASS production startup batch14/raw1400, release/stale returns, automatic release, nonstartup/rebased/paused batch, real scaled/mapped clocks, host import, disabled equivalence, cap/no probes');

const mutations = [
  ['raw-state-label', 'inputConsumptionTrace.lastGuestTick', 'tickState.lastTick', /actual last guest return/],
  ['remap-history', 'inputConsumptionTrace.lastGuestTick', 'startupClock.map(tickState.lastTick)', /actual last guest return/],
  ['trace-probes-clock', 'guestMs: guestClock.publish()', 'guestMs: guestClock.ticks()', /trace spent a guest probe/],
  ['detached-host-reader', 'h.get_ticks = () => guestClock.ticks();', 'h.get_ticks = guestClock.ticks;', /actual last guest return/],
  ['drop-last-tick', 'lastGuestTick: inputConsumptionTrace.lastGuestTick', 'lastGuestTick: undefined', /actual last guest return/],
];
for (const [name, from, to, expected] of mutations) {
  assert(initialization.includes(from), `mutation anchor ${name}`);
  assert.throws(() => checks(initialization.replace(from, to)), expected, name);
  console.log(`PASS rejecting mutation ${name}`);
}
