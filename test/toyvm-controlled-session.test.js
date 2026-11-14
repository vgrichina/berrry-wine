'use strict';

// PURE_CONTROL_ONLY_NO_NATIVE: these protocol bytes are not gameplay frames.
// No run-dos/live/Machine/VM/WASM import or emulated guest is executed here.
const assert = require('assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const { createPersistentController } = require('../tools/toyvm/controlled-input');

const bind = s => ({ targetId: s.targetId, programId: s.programId, frameId: s.frameId, digest: s.digest });
const key = s => ({ ...bind(s), action: { kind: 'key', key: 'Enter', code: 'Enter' } });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function adapter() {
  let steps = 0, pixel = 0, program = 'protocol-owner-1', owned = true;
  const calls = [];
  return {
    calls, step: () => { calls.push('step'); steps++; },
    change: () => pixel++, transition: () => { program += '-next'; }, lose: () => { owned = false; },
    progress: () => steps, programIdentity: () => program, ownsTarget: () => owned,
    capture: () => ({ width: 1, height: 1, text: false, rgba: Buffer.from([pixel, 0, 0, 255]) }),
    keyDown: () => calls.push('down'), mouseInput: () => calls.push('mouseDown'),
    releaseKeys: () => calls.push('keysUp'), releaseMouse: () => calls.push('mouseUp'),
  };
}
async function use(review, fn, extra = {}) {
  const options = { at: 0, dedicatedProcess: true, deadline: Date.now() + 10000,
    maxActions: 3, review, observe: bind, ...extra };
  const c = await createPersistentController(options);
  try { await fn(c, options); } finally { await c.close(); }
}
async function consequence(c, a) {
  a.step(); await c.afterStep(a);
  assert.equal(c.ready, false, 'release alone is not a consequence');
  a.step(); await c.afterStep(a);
}

async function main() {
  for (const extra of [{ maxActions: 0 }, { maxActions: 101 }, { observe: null }, { dedicatedProcess: false }]) {
    await assert.rejects(createPersistentController({ at: 0, dedicatedProcess: true,
      deadline: Date.now() + 1000, maxActions: 3, review: key, observe: bind, ...extra }), /invalid/);
  }
  const frames = [], observations = [], a = adapter();
  await use(s => {
    frames.push(s);
    if (frames.length === 3) return { ...bind(s), stop: true };
    return frames.length === 2 ? { ...bind(s), action: { kind: 'mouse', x: 123, y: 45, buttons: 1 } } : key(s);
  }, async (c, options) => {
    const deadline = c.watchdog.deadline, watchdog = c.watchdog.pid;
    options.deadline += 100000; options.maxActions = 100; options.review = () => { throw Error('mutated'); };
    await c.act(a); await consequence(c, a);
    assert.equal(c.ready, true);
    a.transition(); // A different program must get a different target binding.
    await c.act(a); await consequence(c, a);
    assert.equal(await c.act(a), null);
    assert.equal(c.result.status, 'STOPPED');
    assert.equal(c.result.actions.length, 2);
    assert.equal(c.result.reviewsConsumed, 3);
    assert.equal(c.watchdog.pid, watchdog); assert.equal(c.watchdog.deadline, deadline);
    assert.notEqual(frames[0].targetId, frames[1].targetId);
    assert.equal(frames[1].targetId, frames[2].targetId);
    assert.equal(new Set(frames.map(s => s.frameId)).size, 3);
    assert.equal(observations.length, 2);
    assert.deepEqual(a.calls, ['down', 'step', 'keysUp', 'mouseUp', 'step',
      'mouseDown', 'step', 'keysUp', 'mouseUp', 'step']);
    await Promise.all([c.close(), c.close()]);
  }, { observe: s => { observations.push(s); return bind(s); } });

  const bounded = adapter();
  await use(key, async c => {
    await c.act(bounded); await consequence(c, bounded);
    assert.equal(c.result.status, 'COMPLETE');
    await assert.rejects(c.act(bounded), /consequence/);
    assert.equal(c.result.status, 'UNKNOWN');
    assert.equal(bounded.calls.filter(x => x === 'down').length, 1);
  }, { maxActions: 1 });

  for (const reason of ['oldReview', 'wrongProgram', 'pixels', 'progress', 'owner', 'transition', 'null', 'sequence', 'throws', 'stale']) {
    const t = adapter(); let old;
    await use(async s => {
      if (!old) { old = key(s); return old; }
      if (reason === 'oldReview') return old;
      if (reason === 'pixels') t.change();
      if (reason === 'progress') t.step();
      if (reason === 'owner') t.lose();
      if (reason === 'transition') t.transition();
      if (reason === 'null') return null;
      if (reason === 'sequence') return { ...bind(s), action: [{ kind: 'key' }] };
      if (reason === 'throws') throw Error('review failed');
      if (reason === 'stale') await delay(20);
      return { ...key(s), ...(reason === 'wrongProgram' ? { programId: 'other' } : {}) };
    }, async c => {
      await c.act(t); await consequence(c, t);
      await assert.rejects(c.act(t), /stale|unsupported|review failed/);
      assert.equal(c.result.status, 'UNKNOWN');
      await assert.rejects(c.act(t), /UNKNOWN/);
      assert.equal(t.calls.filter(x => x === 'down').length, 1);
    }, reason === 'stale' ? { maxFrameAgeMs: 10 } : {});
  }

  for (const phase of ['beforeRelease', 'afterRelease', 'noProgress', 'observation', 'observationOwner']) {
    const t = adapter(); let reviews = 0;
    await use(s => { reviews++; return key(s); }, async c => {
      await c.act(t);
      if (phase !== 'beforeRelease' && phase !== 'noProgress') { t.step(); await c.afterStep(t); }
      if (phase === 'observation' || phase === 'observationOwner') {
        t.step();
        await assert.rejects(c.afterStep(t), /consequence/);
      } else if (phase === 'noProgress') await assert.rejects(c.afterStep(t), /no execution/);
      else await assert.rejects(c.act(t), /consequence/);
      assert.equal(reviews, 1); assert.equal(c.result.status, 'UNKNOWN');
    }, { observe: s => { if (phase === 'observationOwner') t.lose(); return phase === 'observation' ? {} : bind(s); } });
    assert.equal(t.calls.filter(x => x === 'keysUp').length, 1);
  }

  const changed = adapter(); let reviewedTarget, observedTarget;
  await use(s => { reviewedTarget = s.targetId; return key(s); }, async c => {
    await c.act(changed); changed.step(); await c.afterStep(changed);
    changed.transition(); changed.step(); await c.afterStep(changed);
    assert.notEqual(reviewedTarget, observedTarget);
  }, { observe: s => { observedTarget = s.targetId; return bind(s); } });

  const downThrows = adapter();
  downThrows.keyDown = () => { downThrows.calls.push('partialDown'); throw Error('hardware failure'); };
  await use(key, async c => {
    await assert.rejects(c.act(downThrows), /hardware/);
    assert.equal(c.result.status, 'UNKNOWN');
  });
  assert.deepEqual(downThrows.calls, ['partialDown', 'keysUp', 'mouseUp']);

  const early = adapter();
  await use(key, async c => {
    await c.act(early); await c.close();
    assert.equal(c.result.status, 'UNKNOWN');
    assert.equal(c.result.held, false);
  });

  const waiting = adapter(); let waitReviews = 0;
  await use(s => { waitReviews++; return { ...bind(s), wait: true }; }, async c => {
    await c.act(waiting); assert.equal(c.ready, true); assert.equal(c.awaitingExecution, false);
    waiting.step(); await c.act(waiting); waiting.step();
    assert.equal(await c.act(waiting), null);
    assert.equal(c.result.status, 'STOPPED'); assert.equal(waitReviews, 2);
    assert.equal(c.result.actions.length, 0); assert.deepEqual(waiting.calls, ['step', 'step']);
  }, { maxActions: 1, maxReviews: 2 });

  const swapped = adapter();
  await use(key, async c => {
    await c.act(swapped); await consequence(c, swapped);
    await assert.rejects(c.act(adapter()), /ownership changed/);
    assert.equal(c.result.status, 'UNKNOWN');
  });

  let resumeReview;
  const concurrent = adapter();
  await use(s => new Promise(resolve => { resumeReview = () => resolve(key(s)); }), async c => {
    const first = c.act(concurrent);
    await assert.rejects(c.act(concurrent), /consequence/);
    resumeReview(); await assert.rejects(first, /UNKNOWN/);
    assert.deepEqual(concurrent.calls, []);
    assert.equal(c.result.reviewsConsumed, 1);
  });

  for (const mode of ['reviewStall', 'heldStall', 'releaseFail', 'releaseMouseFail',
    'observationStall', 'pendingClose', 'expiredReview', 'overallDeadline']) {
    await victimTest(mode);
  }
  console.log('PASS PURE_CONTROL_ONLY_NO_NATIVE persistent reviews/consequences/tombstones/ownership/finally-release/immutable watchdog');
}

async function victimTest(mode) {
  const child = spawn(process.execPath, [__filename, mode], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 6000);
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  assert.match(stdout, /ARMED/); assert.match(stdout, /WATCHDOG_PID=\d+/);
  assert.equal(result.signal, 'SIGKILL', stderr); assert.equal(result.code, null);
  assert(!stdout.includes('REPLAYED'));
  if (mode === 'overallDeadline') assert.match(stdout, /ACTIONS=2 SAME_WATCHDOG=true/);
  const pid = Number(/WATCHDOG_PID=(\d+)/.exec(stdout)[1]);
  for (let i = 0; i < 100; i++) {
    try {
      if (fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].startsWith('Z ')) break;
    } catch (err) { if (err.code === 'ENOENT') break; throw err; }
    await delay(10);
  }
  try { assert(fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].startsWith('Z ')); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  console.log(JSON.stringify({ label: 'PURE_CONTROL_ONLY_NO_NATIVE', mode, ownerPid: child.pid,
    watchdogPid: pid, ...result, stdout: stdout.trim() }));
}

async function victim(mode) {
  const t = adapter(); let c;
  const review = mode === 'reviewStall' ? () => new Promise(() => {})
    : mode === 'expiredReview' ? async s => { await delay(1500); return key(s); }
      : mode === 'pendingClose' ? async s => {
        await assert.rejects(c.close(), /pending/); return key(s);
      } : key;
  c = await createPersistentController({ at: 0, deadline: Date.now() + 800, maxActions: 3,
    dedicatedProcess: true, review, observe: mode === 'observationStall' ? () => new Promise(() => {}) : bind });
  console.log(`ARMED WATCHDOG_PID=${c.watchdog.pid} DEADLINE=${c.watchdog.deadline}`);
  if (mode === 'pendingClose') await assert.rejects(c.act(t), /UNKNOWN/);
  else await c.act(t);
  if (mode === 'releaseFail' || mode === 'releaseMouseFail') {
    const method = mode === 'releaseFail' ? 'releaseKeys' : 'releaseMouse';
    t[method] = () => { t.calls.push('failedUp'); throw Error('release failed'); };
    t.step(); await assert.rejects(c.afterStep(t), /release failed/);
    await assert.rejects(c.close(), /previously failed/);
    assert.deepEqual(t.calls, mode === 'releaseFail' ? ['down', 'step', 'failedUp', 'mouseUp']
      : ['down', 'step', 'keysUp', 'failedUp']);
  }
  if (mode === 'observationStall') await consequence(c, t);
  if (mode === 'overallDeadline') {
    const pid = c.watchdog.pid, expiry = c.watchdog.deadline;
    await consequence(c, t); await delay(350);
    await c.act(t); await consequence(c, t);
    console.log(`ACTIONS=${c.result.actions.length} SAME_WATCHDOG=${pid === c.watchdog.pid && expiry === c.watchdog.deadline}`);
  }
  while (true) { /* disposable pure JS owner, independent watchdog terminates */ }
}

(process.argv[2] ? victim(process.argv[2]) : main()).catch(err => { console.error(err); process.exitCode = 1; });
