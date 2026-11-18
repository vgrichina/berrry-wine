'use strict';

// Ordinary browser gestures reuse the existing independent UP child. Complete
// live owner/module validation before arming its short physical-release clock.
// No guest call, native ACK, input poll or runtime state write is introduced.
const assert = require('node:assert/strict');

async function deliver({validate, arm, down, holdMs = 120, now = Date.now}) {
  assert(Number.isInteger(holdMs) && holdMs >= 50 && holdMs <= 1200, 'finite ordinary hold');
  const startedAt = now();
  await validate();
  const validatedAt = now();
  const release = await arm();
  let downAt = null, acknowledgementAt = null, error = null, wait;
  try {
    assert(Number.isFinite(release.fallback), 'finite prearmed fallback');
    assert(now() + holdMs + 50 < release.fallback, 'NOT_SENT: insufficient prearmed hold window');
    downAt = now();
    await down();
    acknowledgementAt = now();
    release.schedule(Math.min(release.fallback, downAt + holdMs));
  } catch (e) {
    error = e;
  } finally {
    wait = await release.finish();
  }
  if (error) throw error;
  return {startedAt, validatedAt, downAt, acknowledgementAt, fallback: release.fallback, wait,
    deliveryBoundary: 'ordinary browser transport; no native consumption ACK asserted'};
}

module.exports = {deliver};
