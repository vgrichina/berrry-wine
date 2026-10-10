#!/usr/bin/env node
'use strict';

// A WM_TIMER keeps its own period however late it is noticed.
//
// The headless CLI advances guest time in whole batches (200ms by default) and
// GetMessage only sees a timer at a batch edge, so a 1000ms timer set off the
// batch grid is always noticed a little late. When delivery restarted the
// period from the delivery time, every late notice stretched the period to the
// next multiple of the app's polling cadence (16 ticks instead of 20 below at
// 200ms batches; this test fails that way on the old code). 16-bit
// Solitaire's clock read 13 / 18 / 22 after 20 guest-seconds at those three
// tick sizes (scratch/runs/20261010T0655Z-sol16-move-timer). USER keeps the
// phase: the next tick is due one interval after the previous DUE time, and
// periods missed entirely coalesce into the one WM_TIMER that is delivered.
//
// It goes through the table walk GetMessage/PeekMessage use ($timer_check_due,
// consume = 1). This drives a 1000ms timer set at t=30ms (off every grid below), polled once
// every third batch for 20 seconds, and counts WM_TIMER messages: 20 at every batch
// size. It also checks the coalescing rule: a 100ms timer polled every 350ms
// delivers once per poll, never a backlog.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  let now = 0;
  const { exports: e } = await bootRenderHarness({
    extraHostOverrides: { get_ticks: () => now },
  });
  const msg = 0x3000;
  const WM_TIMER = 0x113;

  // Count WM_TIMERs for timer `id` over `durationMs`, polling once per `step`.
  function countTicks(id, intervalMs, setAt, step, durationMs) {
    now = setAt;
    e.test_timer_set(0, id, intervalMs, 0);
    let ticks = 0;
    // Polls fall on the absolute batch grid (multiples of `step`), as batch
    // edges do, and a busy app reaches GetMessage only every third batch, so
    // the timer -- set 30ms into a batch -- is noticed up to three batches
    // late. A grid that divides the period would realign after one late tick;
    // a cadence that does not is what made sol16 lose ticks.
    const cadence = step * 3;
    for (now = Math.ceil((setAt + 1) / cadence) * cadence; now <= setAt + durationMs; now += cadence) {
      // Drain everything this poll can see, as a pumping game does.
      while (e.test_timer_check(msg, 1)) {
        if (e.guest_read32(msg + 4) === WM_TIMER && e.guest_read32(msg + 8) === id) ticks++;
      }
    }
    e.test_timer_kill(0, id);
    return ticks;
  }

  for (const step of [200, 100, 50]) {
    const ticks = countTicks(7, 1000, 30, step, 20000);
    assert.ok(Math.abs(ticks - 20) <= 1,
      `a 1000ms timer polled every ${step}ms delivers ${ticks} WM_TIMERs in 20s (want 20 +- 1)`);
  }

  // Coalescing: three periods of a 100ms timer pass between 350ms polls, and
  // each poll delivers exactly one WM_TIMER, as USER does.
  now = 0;
  e.test_timer_set(0, 9, 100, 0);
  now = 350;
  let seen = 0;
  while (e.test_timer_check(msg, 1)) if (e.guest_read32(msg + 4) === WM_TIMER) seen++;
  assert.strictEqual(seen, 1, 'missed periods coalesce into one WM_TIMER');
  e.test_timer_kill(0, 9);

  console.log('PASS  WM_TIMER keeps its own period: 20 ticks in 20s at 200/100/50ms polls, missed periods coalesce');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
