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
console.log('PASS test-startup-clock');
