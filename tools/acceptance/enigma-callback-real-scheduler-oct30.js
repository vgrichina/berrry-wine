'use strict';
// Scheduler/component qualification only. Guest exports below are synthetic:
// callback admission/return, instructions, and wait frames are declared inputs.
// No x86, WAT continuation authentication, browser, worker backend or CLI runs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const pins = {
  '../../lib/thread-manager.js': 'afbd576a564dcc304d11c885b70b4a1ccd65db9a40e1407ac45ea0f098d7f08a',
  '../../lib/host-audio.js': '954e76b678502d6147475ea737af85b96e2408a488a2bd19c643dd2cf7969438',
  '../../lib/callback-lifecycle-trace.js': '92b7a6296f1c8883866321ed3dbdeaa422ec9a6b32d53a35a432dff10d641cac',
};
for (const [p, expected] of Object.entries(pins)) assert.equal(hash(fs.readFileSync(require.resolve(p))), expected, p);
const { ThreadManager } = require('../../lib/thread-manager');
const { createAudioHost } = require('../../lib/host-audio');
const { createCallbackLifecycleTrace } = require('../../lib/callback-lifecycle-trace');
const realRunSlice = ThreadManager.prototype.runSlice;

function scenario(enabled, corruptCorrelation = false) {
  const trace = enabled ? createCallbackLifecycleTrace() : null;
  const memory = { buffer: new SharedArrayBuffer(65536) };
  const main = { get_sync_table: () => 0, get_current_thread_id: () => 1 };
  const tm = new ThreadManager(null, memory, { exports: main }, null,
    { callbackLifecycleTrace: trace, now: () => 100, waitNow: () => 100 });
  const rows = [], log = [];
  // Two callback owners restore distinct unsignaled waits. Each callback
  // releases a different worker semaphore. All handles belong to the real TM.
  const work = [tm.createSemaphore(0, 1, ''), tm.createSemaphore(0, 1, '')];
  const gates = [tm.createSemaphore(0, 1, ''), tm.createSemaphore(0, 1, '')];
  function guest(tid, handle, producer = -1) {
    const initial = { eip: 0x1000 + tid * 16, esp: 0x8000 + tid * 64,
      yield: 1, wait: handle, timeout: 0xffffffff, stackBytes: 12, eax: 77 };
    let s = { ...initial }, saved = null, active = 0, serial = 0, returned = 0;
    let returnedState = null, traceOn = false, runs = 0, toggles = 0;
    const markers = () => [active, returned, returnedState?.eip || 0,
      returnedState?.esp || 0, returnedState?.yield || 0,
      returnedState?.wait || 0, returnedState?.timeout || 0,
      returnedState?.stackBytes || 0];
    const e = {
      get_current_thread_id: () => tid, get_eip: () => s.eip,
      get_esp: () => s.esp, get_eax: () => s.eax,
      get_yield_reason: () => s.yield, get_wait_handle: () => s.wait,
      get_wait_timeout: () => s.timeout, get_wait_stack_bytes: () => s.stackBytes,
      get_wait_handles_ptr: () => 0, is_mm_timer_callback_active: () => active ? 1 : 0,
      set_audio_callback_trace: n => { traceOn = !!n; toggles++; },
      get_audio_callback_trace: n => markers()[n],
      clear_yield: () => { s.yield = 0; }, set_eax: n => { s.eax = n; },
      set_esp: n => { s.esp = n; }, set_eip: n => { s.eip = n; },
      guest_read32: addr => { assert.equal(addr, initial.esp); return initial.eip + 5; },
      get_last_run_blocks: () => 1,
      fire_wave_out_callback_bound: () => {
        assert(producer >= 0);
        if (active) return 0;
        saved = { ...s }; active = ++serial;
        s = { ...s, yield: 0, eip: 0x9000 + tid, esp: s.esp - 32 };
        // Model the caller's scheduler bookkeeping save explicitly. The real
        // runSlice must restore it only after the guest callback is inactive.
        row.thread.waveWaitSaved = { waitPolls: row.thread.waitPolls,
          waitStartedAt: row.thread.waitStartedAt };
        Object.assign(row.thread, { waitPolls: 0, waitStartedAt: 0, sleepCount: 0 });
        return 1;
      },
      run: budget => {
        assert.equal(budget, 1); runs++;
        if (active) {
          assert.equal(tm._runningThreadHandle, tid);
          assert.equal(tm.releaseSemaphore(work[producer], 1, 0), 1);
          log.push(['callback', tid]);
          s = saved; saved = null;
          if (traceOn) { returned = active; returnedState = { ...s }; }
          active = 0;
        } else {
          // The scheduler, rather than this synthetic export, must complete
          // the parked wait, including the stdcall stack and result register.
          assert.deepEqual(s, { ...initial, yield: 0, eax: 0,
            eip: initial.eip + 5, esp: initial.esp + 12 });
          log.push(['consume', tid]);
          s = { ...initial }; // next guest wait on the same empty semaphore
        }
      },
    };
    const row = { e, initial, state: () => ({ ...s }), runs: () => runs,
      toggles: () => toggles, thread: { tid, state: 'active', instance: { exports: e },
        _dllAttachNotified: true, waitPolls: 7 + tid, waitStartedAt: 40 + tid,
        sleepCount: 2, sleepUntil: 0, lastSleepMs: 0 } };
    tm.threads.set(tid, row.thread); rows.push(row); return row;
  }
  const producers = [guest(11, gates[0], 0), guest(22, gates[1], 1)];
  const consumers = [guest(33, work[0]), guest(44, work[1])];
  const hosts = producers.map(row => {
    const audioMemory = new SharedArrayBuffer(65536);
    const voices = { _map: {}, notifyPump: () => 0, open: () => 7, _installUnlock() {} };
    const host = createAudioHost({ exports: row.e, sharedAudio: { voices },
      getMemory: () => audioMemory, audioClockMs: () => 100,
      callbackLifecycleTrace: trace }, {});
    const h = host.imports.wave_out_open(22050, 2, 16, 3, 0xec9bd0, 123);
    new DataView(audioMemory).setUint32(4096 + 16, 0x10, true);
    host.imports.wave_out_schedule_done(h, 4096, 4096, 0);
    return host;
  });
  const slice = row => {
    assert.equal(tm.runSlice, realRunSlice); // no extraction, patch or stub
    return tm.runSlice(1, { quantumSteps: 1, onlyThreadHandle: row.thread.tid });
  };
  // First behavioral checkpoint: real cooperative scheduler dispatch. Empty
  // semaphores must keep all parked threads out of synthetic guest run().
  assert.equal(tm.runSlice(1, { quantumSteps: 1 }).threadsRun, 0);
  hosts.forEach(h => h.pumpWaveOutCompletions());
  if (trace) {
    const pending = trace.snapshot().pending;
    assert.deepEqual(pending.map(p => [p.thread, p.token]), [[11, 1], [22, 1]]);
    assert.equal(new Set(pending.map(p => p.owner)).size, 2);
  }
  for (let i = 0; i < 2; i++) {
    const p = producers[i], c = consumers[i];
    const meta = { ...p.thread.waveWaitSaved };
    const stats = slice(p);
    assert.deepEqual([stats.threadsRun, stats.steps, stats.blocks], [1, 1, 1]);
    assert.deepEqual(p.state(), p.initial, 'callback restored guest wait');
    for (const [k, v] of Object.entries(meta)) assert.equal(p.thread[k], v, k);
    assert.equal(p.thread.sleepCount, 0, 'normal post-run nonsleeper bookkeeping');
    assert.equal(p.thread.waveWaitSaved, null, 'scheduler restored wait bookkeeping');
    assert.equal(c.thread.grantedWait, work[i]);
    if (trace) {
      const s = trace.snapshot();
      assert.deepEqual(s.pending.map(v => v.thread), i === 0 ? [22] : []);
      assert.deepEqual(s.events.filter(v => v.event === 'returned').map(v => v.thread), i === 0 ? [11] : [11, 22]);
      if (corruptCorrelation && i === 0) c.thread.grantedWaitTrace = 999;
    }
    assert.equal(slice(c).threadsRun, 1);
    assert.equal(c.thread.grantedWait, 0, 'real enclosing scheduler clears grant');
    if (trace) assert.equal(c.thread.grantedWaitTrace, null);
    // No second release: polling the same wait must not run or consume again.
    assert.equal(slice(c).threadsRun, 0);
    assert.equal(c.runs(), 1);
    assert.equal(slice(p).threadsRun, 0, 'restored unsignaled owner wait remains parked');
  }
  assert.deepEqual(log, [['callback', 11], ['consume', 33], ['callback', 22], ['consume', 44]]);
  if (trace) {
    const events = trace.snapshot().events;
    for (let i = 0; i < 2; i++) {
      const release = events.filter(v => v.event === 'semaphore-release')[i];
      const grant = events.filter(v => v.event === 'semaphore-grant')[i];
      const consume = events.filter(v => v.event === 'semaphore-grant-consumed')[i];
      const admitted = events.filter(v => v.event === 'admitted')[i];
      const returned = events.filter(v => v.event === 'returned')[i];
      const initial = producers[i].initial;
      assert.deepEqual([returned.owner, returned.thread, returned.token],
        [admitted.owner, admitted.thread, admitted.token]);
      assert.deepEqual(returned.returned, { eip: initial.eip, esp: initial.esp,
        yield: initial.yield, wait: initial.wait, timeout: initial.timeout,
        stackBytes: initial.stackBytes });
      assert.deepEqual([release.context.thread, release.callbackToken, release.owner],
        [producers[i].thread.tid, 1, admitted.owner]);
      assert.deepEqual([release.result, release.before, release.after], [1, 0, 0]);
      assert.equal(grant.release, release.release);
      assert.equal(consume.release, release.release, 'consume release correlation');
      assert.deepEqual([consume.owner, consume.context.thread, consume.handle],
        [grant.owner, consumers[i].thread.tid, work[i]]);
    }
    assert.equal(events.filter(v => v.event === 'semaphore-grant-consumed').length, 2);
    assert.equal(events.filter(v => v.event === 'semaphore-grant').length, 2);
    assert.deepEqual(events.filter(v => v.event === 'semaphore-release').map(v => v.release), [1, 2]);
    assert.equal(events.some(v => v.event === 'incomplete-return'), false);
  } else assert(rows.every(r => r.toggles() === 0), 'disabled trace never enabled guest hooks');
  return { log, states: rows.map(r => r.state()), runs: rows.map(r => r.runs()),
    sync: Array.from(tm.syncView.slice(0, 16)), events: trace?.snapshot().events };
}

const enabled = scenario(true);
const disabled = scenario(false);
for (const k of ['log', 'states', 'runs', 'sync']) assert.deepEqual(disabled[k], enabled[k], 'disabled parity: ' + k);
// Distinguishing rejecting control: same unchanged scheduler with one stale
// grant correlation input. Behavioral scheduling still succeeds; the precise
// release-to-consume oracle must reject it (not any incidental exception).
assert.throws(() => scenario(true, true), error =>
  error.code === 'ERR_ASSERTION' && error.message.includes('consume release correlation'));
console.log(JSON.stringify({ status: 'PASS', candidate: 'd3c9e74f2e54c9294624f3e9ca9c0ac4d62b9a62',
  scope: 'real cooperative runSlice with declared synthetic guest exports',
  groups: ['production-scheduler-dispatch-first', 'grant-consumed-once-and-repark',
    'callback-and-bookkeeping-wait-restoration', 'two-owner-equal-token-isolation',
    'callback-release-grant-consume-correlation', 'disabled-parity', 'stale-correlation-rejected'],
  events: enabled.events }, null, 2));
