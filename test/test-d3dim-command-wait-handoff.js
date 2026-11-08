'use strict';
const assert = require('node:assert/strict');
const { WriterEpoch, CommandWriterHandoff } = require('../lib/render-worker');
const { Encoder } = require('../lib/d3d-command-stream');
const { WorkerLink } = require('../lib/guest-thread-host');

function command() {
  const epoch = new WriterEpoch(), ticket = epoch.begin();
  const parent = CommandWriterHandoff.create(epoch, ticket, 41, 7);
  const worker = new CommandWriterHandoff(parent.descriptor(), 41, 7);
  return { epoch, ticket, parent, worker };
}
function finish(c) { c.parent.close(); c.epoch.end(c.ticket); }

// Actual Encoder method: intercept only its blocking primitive to inspect the
// interval where a native render consumer can run. Restore on every exit path.
for (const mode of ['success', 'error', 'strict-error', 'wait-throws', 'retire']) {
  const c = command(), control = new Int32Array(new SharedArrayBuffer(64));
  const encoder = Object.create(Encoder.prototype);
  Object.assign(encoder, { control, strictReady: mode === 'strict-error',
    getCommandWriterHandoff: () => c.worker, stats: { waits: 0, waitMs: 0 } });
  const wait = Atomics.wait;
  let calls = 0, stamp;
  Atomics.wait = () => {
    calls++; stamp = c.epoch.snapshot(); assert(stamp);
    assert.equal(Atomics.load(c.parent.state, 0), 2);
    const other = c.epoch.begin(); assert.equal(c.epoch.snapshot(), null);
    c.epoch.end(other);
    if (mode === 'wait-throws') throw Error('injected wait failure');
    if (mode === 'retire') c.epoch.invalidate();
    if (mode.includes('error')) Atomics.store(control, 2, 1);
    else Atomics.store(control, 1, 1);
  };
  try {
    if (mode === 'strict-error' || mode === 'wait-throws') assert.throws(() => encoder._waitFor(1));
    else assert.equal(encoder._waitFor(1), mode !== 'error');
  } finally { Atomics.wait = wait; }
  assert.equal(calls, 1); assert.equal(c.epoch.words[0], 1);
  assert.equal(c.epoch.snapshot(), null); assert(!c.epoch.unchanged(stamp));
  assert.equal(c.parent.state[0], 1); finish(c);
  assert.equal(c.epoch.words[0], 0);
}

// A completed fence never changes the command's writer state. A consumer
// racing ahead of the park must see the live ticket and reject qualification.
{
  const c = command(), encoder = Object.create(Encoder.prototype);
  Object.assign(encoder, { control: new Int32Array(new SharedArrayBuffer(64)),
    getCommandWriterHandoff: () => c.worker, stats: {} });
  encoder.control[1] = 1;
  const before = [...c.epoch.words]; assert(encoder._waitFor(1));
  assert.deepEqual([...c.epoch.words], before); finish(c);
}
for (const mismatch of ['owner', 'generation', 'ticket']) {
  const c = command(), d = c.parent.descriptor();
  if (mismatch === 'ticket') d.ticket++;
  assert.throws(() => new CommandWriterHandoff(d, mismatch === 'owner' ? 42 : 41,
    mismatch === 'generation' ? 8 : 7), /identity/);
  assert.equal(c.epoch.words[2], 1);
}
{
  const c = command(); c.worker.park();
  assert.throws(() => c.worker.park(), /not active/);
  c.worker.resume(); finish(c);
  assert.throws(() => c.worker.park(), /not active/);
  assert.throws(() => c.parent.close(), /closed/);
}
{
  const a = command(); a.worker.park();
  const ticket = a.epoch.begin();
  const parent = CommandWriterHandoff.create(a.epoch, ticket, 41, 8);
  const worker = new CommandWriterHandoff(parent.descriptor(), 41, 8);
  assert.notEqual(parent.buffer, a.parent.buffer);
  assert.equal(a.epoch.snapshot(), null, 'another command keeps its own writer');
  worker.park(); assert(a.epoch.snapshot());
  worker.resume(); parent.close(); a.epoch.end(ticket);
  assert.equal(a.parent.state[0], 2); a.worker.resume(); finish(a);
}
{
  const c = command(); c.worker.park();
  Atomics.store(c.parent.identity, 1, 8n);
  assert.throws(() => c.worker.resume(), /identity/);
  assert.equal(c.epoch.words[0], 1); assert.equal(c.epoch.words[2], 1);
}

(async () => {
  // Real parent timeout and retirement paths, including a late reply. The
  // timed-out command remains ambiguous even if the Worker was parked then.
  for (const mode of ['timeout', 'retire']) {
    const epoch = new WriterEpoch(); let msg;
    const link = new WorkerLink({ slot: 0, writerObservation: epoch });
    link.worker = { postMessage: m => { msg = m; } };
    const pending = link._ask({ t: 'callExport', name: 'run', args: [] }, 10);
    const w = new CommandWriterHandoff(msg.commandWriterHandoff, link.endpointIdentity, msg.seq);
    w.park(); assert(epoch.snapshot());
    if (mode === 'retire') link._beginRetiring();
    await assert.rejects(pending, mode === 'timeout' ? /did not answer/ : /retired/);
    assert.equal(epoch.words[2], 1); assert.equal(epoch.snapshot(), null);
    w.resume(); assert.equal(epoch.words[0], 1);
    link._onMessage({ t: 'exportResult', seq: msg.seq, value: 0 });
    assert.equal(epoch.words[0], 1); assert.equal(epoch.words[2], 1);
    assert.throws(() => link.setWriterObservation(new WriterEpoch()), /idle live/,
      'a new epoch cannot hide ambiguous execution after timeout or retirement');
  }
  console.log('command wait handoff: native wait exits, race, overlap, owner/generation/ABA, timeout/retirement PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
