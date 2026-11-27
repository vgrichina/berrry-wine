#!/usr/bin/env node
'use strict';
// lib/startup-clock.js: the guest clock runs `factor` times real speed until
// startup ends, then at real speed from where it had got to. The guest must
// never see that switch: no jump, no step backwards, and a missed end event
// may not leave the app slow for good (maxMs). Comanche Gold uses it to give
// main the race against its own 33 ms sound timer (lib/apps.js).
const assert = require('assert');
const { createStartupClock, normalizeStartupClock } = require('../lib/startup-clock');

// Config validation: only a slow-down in (0, 1) is a startup clock.
assert.strictEqual(normalizeStartupClock(null), null);
assert.strictEqual(normalizeStartupClock({ factor: 1 }), null, 'factor 1 is no dilation');
assert.strictEqual(normalizeStartupClock({ factor: 2 }), null, 'a speed-up is not a startup clock');
assert.strictEqual(normalizeStartupClock({ factor: 0 }), null);
assert.deepStrictEqual(normalizeStartupClock({ factor: 0.25 }),
  { factor: 0.25, maxMs: 30000, endOn: 'none' }, 'defaults: only maxMs ends it');
assert.strictEqual(createStartupClock(null).active, false, 'no config: inactive');
assert.strictEqual(createStartupClock(null).map(1234), 1234, 'inactive maps identity');

// Dilated while active, continuous and real-speed after end().
{
  const c = createStartupClock({ factor: 0.1, maxMs: 30000 });
  assert.strictEqual(c.map(1000), 100, 'active: raw * factor');
  c.end(2000, 'firstPresent:directdraw');
  assert.strictEqual(c.active, false);
  assert.strictEqual(c.state.reason, 'firstPresent:directdraw');
  assert.strictEqual(c.map(2000), 200, 'continuous at the end instant');
  assert.strictEqual(c.map(2500), 700, 'real speed afterwards');
  c.end(9000, 'again');
  assert.strictEqual(c.map(2500), 700, 'a second end() changes nothing');
  assert.strictEqual(c.unmap(700), 2500, 'unmap inverts after the end');
}

// Monotonic across the end, sampled finely.
{
  const c = createStartupClock({ factor: 0.2 });
  let last = -1;
  for (let raw = 0; raw <= 5000; raw += 7) {
    if (raw === 1001) c.end(raw);
    const g = c.map(raw);
    assert(g >= last, `monotonic at raw ${raw}: ${g} < ${last}`);
    last = g;
  }
}

// A missed end event is bounded by maxMs, again without a jump.
{
  const c = createStartupClock({ factor: 0.5, maxMs: 4000 });
  assert.strictEqual(c.map(3999), 1999.5);
  assert.strictEqual(c.map(4000), 2000, 'ends at maxMs');
  assert.strictEqual(c.active, false);
  assert.strictEqual(c.state.reason, 'maxMs');
  assert.strictEqual(c.map(5000), 3000, 'real speed after the bound');
  assert.strictEqual(c.unmap(2000), 4000);
}

// unmap while active.
{
  const c = createStartupClock({ factor: 0.1 });
  assert.strictEqual(c.unmap(50), 500);
}

// An event can arrive after the raw limit before map() samples the limit.
// The first boundary still wins; an independent earlier-event clock keeps its
// own offset. All expected times below are literal contract values.
{
  const late = createStartupClock({ factor: 0.25, maxMs: 40 });
  const early = createStartupClock({ factor: 0.25, maxMs: 40 });
  assert.strictEqual(late.map(20), 5);
  assert.strictEqual(early.map(20), 5);
  early.end(20, 'firstPresent:directdraw');
  assert.strictEqual(late.map(39), 9.75);
  assert.strictEqual(late.unmap(9.75), 39);
  late.end(50, 'firstPresent:directdraw');
  const limitState = { active: false, offset: -30, endedAtRaw: 40, reason: 'maxMs' };
  const earlyState = { active: false, offset: -15, endedAtRaw: 20,
    reason: 'firstPresent:directdraw' };
  assert.deepStrictEqual(late.state, limitState, 'late event must respect the earlier raw limit');
  assert.strictEqual(late.active, false);
  assert.strictEqual(late.map(40), 10, 'continuous at the limit');
  assert.strictEqual(late.unmap(10), 40);
  assert.strictEqual(late.map(50), 20);
  assert.strictEqual(late.unmap(20), 50);
  assert.strictEqual(late.map(60), 30);
  assert.strictEqual(late.unmap(30), 60);
  late.end(80, 'again');
  assert.deepStrictEqual(late.state, limitState, 'repeated end preserves the first boundary');
  assert.strictEqual(late.map(80), 50);
  assert.strictEqual(late.unmap(50), 80);
  assert.deepStrictEqual(early.state, earlyState, 'sibling clock is independent');
  assert.strictEqual(early.map(39), 24);
  assert.strictEqual(early.unmap(24), 39);
  early.end(50, 'late');
  assert.deepStrictEqual(early.state, earlyState, 'an earlier event survives a later limit');
  assert.strictEqual(early.map(50), 35);
  assert.strictEqual(early.unmap(35), 50);
  assert.deepStrictEqual(late.state, limitState);
}

// Just before, exactly at and just beyond maxMs, without a crossing map.
// At the tie the raw maximum has been reached, matching map()'s maxMs reason.
for (const [raw, endedAtRaw, offset, reason, guestAt50] of [
  [39, 39, -29.25, 'event', 20.75],
  [40, 40, -30, 'maxMs', 20],
  [41, 40, -30, 'maxMs', 20],
]) {
  const c = createStartupClock({ factor: 0.25, maxMs: 40 });
  c.end(raw);
  assert.deepStrictEqual(c.state, { active: false, offset, endedAtRaw, reason });
  assert.strictEqual(c.map(50), guestAt50);
  assert.strictEqual(c.unmap(guestAt50), 50);
}

// A crossing map followed by an event selects the same limit; disabled end
// remains a no-op (including its null config).
{
  const c = createStartupClock({ factor: 0.25, maxMs: 40 });
  assert.strictEqual(c.map(50), 20);
  c.end(50, 'event');
  assert.deepStrictEqual(c.state, { active: false, offset: -30, endedAtRaw: 40, reason: 'maxMs' });
  assert.strictEqual(c.unmap(20), 50);
  const disabled = createStartupClock(null);
  disabled.end(50);
  assert.deepStrictEqual(disabled.state, { active: false, offset: 0, endedAtRaw: null, reason: null });
  assert.strictEqual(disabled.map(50), 50);
  assert.strictEqual(disabled.unmap(50), 50);
}
console.log('PASS test-startup-clock');
