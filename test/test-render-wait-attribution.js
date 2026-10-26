'use strict';
// Offline: execute the exact CLI hook bodies and bridge methods, importing the
// actual diagnostic module. No CLI startup, Wasm, guest, renderer or real timers.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { createRenderWaitAttribution } = require('../lib/render-wait-attribution');
const runner = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(__dirname, '../lib/d3d9-host.js'), 'utf8');
const imports = fs.readFileSync(path.join(__dirname, '../lib/host-imports.js'), 'utf8');
const section = (s, a, b) => {
  const start = s.indexOf(a); assert(start >= 0, a);
  const end = s.indexOf(b, start); assert(end > start, b);
  assert.equal(s.indexOf(a, start + a.length), -1, `ambiguous production anchor ${a}`);
  return s.slice(start, end);
};
const hooks = section(runner, '  const renderWaitAttribution = createRenderWaitAttribution();', '  let lastSchedSig = null;');
const importHook = section(imports, '  ctx.waitD3DRender = token => {', '  ctx.closeD3DRender =');
const resultMethod = section(bridgeSource, '    _result(entry, value,', '    _poll(token)');
const issueMethod = section(bridgeSource, '    _issue(entry, opcode,', '    // Present is pipelined');
const waitMethod = section(bridgeSource, '    wait(token) {', '    _presentBoundary(entry)');
const terminal = section(runner, "  renderWaitAttribution.close(deadlineMs && Date.now() > deadlineMs ? 'deadline' : 'stopped');", '  if (PRESENT_CAP &&');
assert(runner.includes("const { createRenderWaitAttribution } = require('../lib/render-wait-attribution');"));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function harness(transform = x => x, baseline = false) {
  const clock = { t: 0 }, timers = [], errors = [];
  const fakeDate = { now: () => clock.t };
  const Bridge = vm.runInNewContext(`class Bridge {
    constructor() { this.requests = new Map(); this.nextRequest = -2; this.closed = false; }
    ${waitMethod}
    _deferrable() { return false; }
    _submit() { return this.value; }
    ${resultMethod} ${issueMethod}
  }; Bridge`, { Date: fakeDate, Stream: { OPCODES: { DRAW: 7, CLEAR: 8 } } });
  const bridge = new Bridge();
  const ctx = { d3d9Bridge: bridge };
  let token = -2, yieldReason = 16, cleared = 0;
  const ex = { get_yield_reason: () => yieldReason, get_d3d_render_token: () => token,
    clear_yield: () => { cleared++; yieldReason = 0; } };
  const logs = [];
  const sandbox = { ctx, _d3d9Bridge: bridge, createRenderWaitAttribution,
    instance: { exports: ex }, tickState: { batch: 42 }, Date: fakeDate,
    console: { log: x => logs.push(x), error: (...x) => errors.push(x) },
    setTimeout: fn => { timers.push(fn); }, hasFlag: () => false, REAL_TICK_SLEEPS: true,
    threadManager: { isMainNamedEventWaiting: () => false, _renderSendTargets: new Set(),
      noteMainSleep() {}, isMainSleeping: () => false, isMainThreadSuspended: () => false },
  };
  vm.createContext(sandbox);
  vm.runInContext(`let stopped=false, deadlineMs=0;
    ${importHook} ${transform(baseline ? baselineHooks.hooks : hooks)}
    globalThis.api={check:mainExecutionSuspended,park:awaitMainRenderPark,
      getWait:()=>mainRenderWait, stop:()=>{stopped=true;},deadline:v=>{deadlineMs=v;},
      close:()=>{${baseline ? '' : terminal}},stats:renderParkStats};`, sandbox);
  return { ...sandbox.api, ctx, clock, timers, errors, logs, bridge,
    token: n => { token = n; yieldReason = 16; }, cleared: () => cleared,
    request(operation = 'DRAW') {
      let resolve, reject;
      const value = new Promise((a, b) => { resolve = a; reject = b; });
      bridge.value = value;
      const entry = { queue: { generation: 1 } };
      // Exercise real _issue -> _result metadata for known operations.
      const id = operation === 'DRAW' ? bridge._issue(entry, 7, {}, () => 1)
        : bridge._result(entry, value, () => 1, false, operation);
      token = id; yieldReason = 16;
      return { id, resolve, reject, record: bridge.requests.get(id) };
    },
  };
}
const baselineHooks = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/render-park-control.json'), 'utf8'));
assert.equal(baselineHooks.runnerSHA256, '87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7');
async function compatibility() {
  // An unrecorded bridge token has no attributable readiness timestamp. Its
  // elapsed wait must stay explicitly unknown even if wait() resolves later.
  {
    const h = harness(); let resolve;
    h.token(-500); h.ctx.waitD3DRender = () => new Promise(r => { resolve = r; });
    const p = h.park(); await flush(); h.clock.t = 17; resolve(); await p;
    const s = h.ctx.renderWaitAttribution;
    assert.equal(s.unknownMs, 17); assert.equal(s.bridgePendingMs, 0); assert.equal(s.readyToResumeMs, 0);
    assert.equal(s.unknownRequests, 1); assert.equal(s.completed, 1);
  }
  const candidateTrace = [], baselineTrace = [];
  for (const baseline of [false, true]) {
    const trace = baseline ? baselineTrace : candidateTrace;
    for (const state of ['complete', 'reject', 'deadline', 'stop', 'instant']) {
      const h = harness(x => x, baseline), r = h.request();
      if (state === 'instant') { r.resolve(1); await flush(); h.check(); await flush(); }
      if (state === 'deadline') h.deadline(50);
      const p = h.park(); await flush();
      if (state === 'stop' || state === 'deadline') {
        h.clock.t = 100; if (state === 'stop') h.stop(); h.timers.shift()();
      } else { h.clock.t = state === 'instant' ? 0 : 13;
        if (state === 'reject') r.reject(new Error('same error')); else r.resolve(1); }
      await p;
      trace.push({ state, waits: h.stats.waits, wallMs: h.stats.wallMs,
        skippedBatches: h.stats.skippedBatches, parked: h.check(), cleared: h.cleared(),
        recordDone: r.record.done, recordError: !!r.record.error, errors: h.errors.length });
      // Resolve abandoned fixtures, without another park or guest call.
      r.resolve(1); await flush();
    }
  }
  assert.deepEqual(candidateTrace, baselineTrace);
  console.log('PASS unknown elapsed remains unknown; exact pinned baseline legacy counters/yields match (5 scenarios)');
}
async function delayedBoundary(transform) {
  const h = harness(transform), r = h.request();
  assert.equal(h.check(), true);
  const wait = h.getWait();
  for (let i = 0; i < 10; i++) { h.check(); assert.equal(h.getWait(), wait); }
  const parked = h.park(); await flush();
  assert.equal(h.ctx.renderWaitAttribution.requests, 1);
  assert.equal(h.ctx.renderWaitAttribution.pending, 1);
  assert.equal(h.stats.waits, 0); assert.equal(h.cleared(), 0);
  h.clock.t = 25; r.resolve(1);
  // Bridge completion timestamp is 25, then simulate a scheduling delay before
  // the main await resumes, using an already queued promise reaction.
  r.record.ready.then(() => { h.clock.t = 32; });
  await parked;
  const s = h.ctx.renderWaitAttribution;
  assert.equal(s.requests, 1); assert.equal(s.completed, 1); assert.equal(s.pending, 0);
  assert.equal(s.parkMs, 32); assert.equal(s.bridgePendingMs, 25);
  assert.equal(s.readyToResumeMs, 7); assert.equal(s.unknownMs, 0);
  assert.equal(s.slowest[0].operation, 'DRAW');
  assert.equal(h.stats.waits, 1); assert.equal(h.stats.wallMs, 32);
  assert.equal(h.stats.skippedBatches, 0); assert.equal(h.cleared(), 0);
  assert.equal(h.check(), false); assert.equal(h.cleared(), 1);
  h.close(); assert(h.logs.some(x => x.startsWith('render attribution:')));
  return s;
}
async function main() {
  if (process.argv.includes('--compatibility-only')) { await compatibility(); return; }
  // Earliest behavioral boundary first; exact runner hooks with no guest.
  await delayedBoundary(); console.log('PASS production CLI/import/bridge boundary delayed+repeat+partition');
  {
    const h = harness(), r = h.request('CLEAR'); r.resolve(1); await flush();
    h.check(); await flush(); await h.park(); h.check();
    assert.equal(h.ctx.renderWaitAttribution.completed, 1);
    assert.equal(h.ctx.renderWaitAttribution.parkMs, 0);
    assert.equal(h.stats.waits, 0);
  }
  for (const unknown of [false, true]) {
    const h = harness(); let r;
    if (unknown) h.token(-900); else r = h.request();
    const p = h.park(); await flush(); h.clock.t = 9;
    if (r) r.reject(new Error('fixture rejection'));
    await p;
    const s = h.ctx.renderWaitAttribution;
    assert.equal(s.requests, 1); assert.equal(s.pending, 0);
    assert.equal(s[unknown ? 'completed' : 'rejected'], 1);
    if (unknown) { assert.equal(s.unknownRequests, 1); assert.equal(s.slowest[0].operation, 'unknown'); }
    else assert(r.record.error);
  }
  {
    const h = harness(); h.ctx.waitD3DRender = () => Promise.reject(new Error('wait reject'));
    await h.park(); assert.equal(h.ctx.renderWaitAttribution.rejected, 1); assert.equal(h.errors.length, 1);
  }
  console.log('PASS instant/rejected/unknown and wait rejection');
  for (const state of ['deadline', 'stopped']) {
    const h = harness(), r = h.request();
    if (state === 'deadline') h.deadline(50);
    const p = h.park(); await flush(); h.clock.t = 100;
    if (state === 'stopped') h.stop();
    h.timers.shift()(); await p;
    const s = h.ctx.renderWaitAttribution;
    assert.equal(s[state], 1); assert.equal(s.pending, 0); assert.equal(s.parkMs, 100);
    assert.equal(s.bridgePendingMs, 100); assert.equal(h.cleared(), 0);
    h.clock.t = 900; r.resolve(1); await flush();
    assert.equal(s.lateSettlements, 1); assert.equal(s.completed, 0); assert.equal(s.parkMs, 100);
    h.close(); h.close(); assert.equal(s[state], 1);
  }
  {
    const h = harness(), r1 = h.request(); h.check();
    const r2 = h.request(); h.check(); h.check();
    assert.equal(h.ctx.renderWaitAttribution.superseded, 1);
    r1.resolve(1); r2.resolve(1); await flush();
    assert.equal(h.ctx.renderWaitAttribution.requests, 2);
    assert.equal(h.ctx.renderWaitAttribution.completed, 1);
    assert.equal(h.ctx.renderWaitAttribution.lateSettlements, 1);
    h.bridge.requests.clear();
    const r3 = h.request(); h.check(); h.close();
    assert.equal(h.ctx.renderWaitAttribution.stopped, 1);
    r3.resolve(1); await flush();
  }
  console.log('PASS deadline/stop/late settlement/token change/terminal cleanup');
  {
    const h = harness(); const s = h.ctx.renderWaitAttribution;
    for (let i = 0; i < 12000; i++) {
      const r = h.request(i % 2 ? 'READBACK' : 'not-a-source-operation');
      const p = h.park(); await flush(); h.clock.t += i % 11;
      r.resolve(1); await p; h.check(); h.bridge.requests.delete(r.id);
      h.timers.length = 0;
      assert(s.slowest.length <= 8); assert.equal(s.latencyBuckets.length, 7);
    }
    assert.equal(s.requests, 12000); assert.equal(s.completed, 12000); assert.equal(s.pending, 0);
    assert.equal(s.unknownRequests, 6000); assert.equal(s.dropped, 11992);
    assert.equal(s.latencyBuckets.reduce((a, b) => a + b), 12000);
    assert.equal(s.parkMs, s.bridgePendingMs + s.readyToResumeMs + s.unknownMs);
    assert.equal(s.parkMs, s.droppedMs + s.slowest.reduce((a, b) => a + b.parkMs, 0));
    assert(JSON.stringify(s).length < 4096); assert.equal(h.bridge.requests.size, 0);
  }
  console.log('PASS 12000 requests bounded collections/conservation/no double count');
  for (const transform of [
    x => x.replace('renderWaitAttribution.begin(wait, ctx.d3d9Bridge?.requests.get(token));', ''),
    x => x.replace(/renderWaitAttribution\.parkEnd\(wait, renderParkEnded,[\s\S]*?'pending'\)\);/, ''),
  ]) {
    await assert.rejects(() => delayedBoundary(transform), assert.AssertionError);
  }
  console.log('PASS failing controls detect omitted begin/miswired park accounting');
  await compatibility();
  console.log(JSON.stringify({runnerSHA256: crypto.createHash('sha256').update(runner).digest('hex'),
    bridgeSHA256: crypto.createHash('sha256').update(bridgeSource).digest('hex'),
    hookSHA256: crypto.createHash('sha256').update(hooks).digest('hex')}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
