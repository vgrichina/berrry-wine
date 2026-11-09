'use strict';

// Keep the real caller's ten predicates intact. This reports a refusal; it
// neither repairs nor qualifies an actor whose original sample was lost.
function requireLiveIdentity({ live, base, identity, save }) {
  const value = v => ({ type: typeof v, value: v === undefined ? null :
    typeof v === 'bigint' || (typeof v === 'number' && !Number.isFinite(v)) ? String(v) : v });
  const operands = [];
  const equal = (name, actual, expected) => operands.push({ name,
    actual: value(actual), expected: value(expected), operator: '===',
    passed: actual === expected });
  const positive = (name, actual) => operands.push({ name,
    actual: value(actual), expected: value(0), operator: '>', passed: actual > 0 });
  equal('base', live.base, base);
  equal('back', live.back, live.object);
  equal('vtable', live.vtable, base + 0x150b20);
  equal('endpoint', live.endpoint, identity.endpoint);
  equal('slot', live.slot, 0);
  equal('process', live.process, identity.processId);
  positive('epoch', live.epoch);
  positive('root', live.root);
  positive('token', live.token);
  positive('thread', live.thread);
  const report = { schema: 'drakan-live-identity-v1', passed: operands.every(p => p.passed),
    operands, failed: operands.filter(p => !p.passed).map(p => p.name),
    physicalDownDispatched: false, observerStarted: false };
  // Synchronous persistence must finish before throwing or admitting a down.
  save('live-identity', report);
  if (!report.passed) {
    const error = Error('Drakan live identity refused: ' + report.failed.join(', '));
    error.code = 'DRAKAN_LIVE_IDENTITY_REFUSED'; error.identityReport = report;
    throw error;
  }
  return report;
}

module.exports = { requireLiveIdentity };
