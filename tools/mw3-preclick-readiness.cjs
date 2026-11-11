'use strict';
const assert = require('node:assert/strict');

// One already-armed recorder, one immutable command budget, no input or restart.
// Retain the last raw reply even when validation/identity/deadline refuses it.
exports.ready = async function({observer, validate, deadline, wait, save,
    label, checkIdentity, now = Date.now}) {
  assert(/^[a-z0-9-]+$/.test(label));
  assert(Number.isFinite(deadline));
  let snapshot = null, timer, expired = false;
  const end = () => assert(!expired && now() < deadline, 'completed mouse read deadline; no input');
  try {
    await Promise.race([(async () => {
      for (;;) {
        end();
        snapshot = await observer.read();
        end();
        assert.deepEqual(snapshot.errors, []);
        assert.equal(snapshot.drops, 0);
        assert.equal(snapshot.pending, 0);
        assert.equal(snapshot.active, true, 'mouse recorder inactive; no input');
        if (snapshot.diagnostic?.bindingMismatchReasons)
          assert.deepEqual(snapshot.diagnostic.bindingMismatchReasons, []);
        assert(Array.isArray(snapshot.records), 'completed read records required');
        if (snapshot.records.length) {
          await validate(snapshot);
          await checkIdentity();
          end();
          return;
        }
        await checkIdentity();
        end();
        await wait(Math.min(100, deadline - now()));
      }
    })(), new Promise((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(Error('completed mouse read deadline; no input')); },
        Math.max(0, deadline - now()));
    })]);
    save(label + '-preclick-ready.json', {at: now(), deadline, snapshot});
    return snapshot;
  } catch (error) {
    save(label + '-preclick-refusal.json', {at: now(), deadline,
      error: String(error.stack || error), snapshot, noInput: true, noReplay: true});
    throw error;
  } finally { clearTimeout(timer); }
};
