'use strict';

// Node-only composition: the real page bridge and caller, installed media,
// and the actual caller read expression over synthetic shared memory. No guest
// exports execute: the three read-only diagnostic exports below are fixtures.
const fs = require('fs'), vm = require('vm'), path = require('path');
const assert = require('assert/strict'), crypto = require('crypto');
const api = require('../lib/drakan-observer-worker.js');
const RegionMap = require('../lib/region-map.generated.js');
const root = path.resolve(__dirname, '..');
const SELECTED = 'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295';
const mediaDir = 'test/binaries/win98-games-a-d/DrakanOrderOfTheFlameDemoD3D-installed/drakan demo/';
const runtimePins = { files: [
  { path: mediaDir + 'drakan.exe', sha256: api.MEDIA.exe },
  { path: mediaDir + 'dragon.rfl', sha256: api.MEDIA.rfl },
] };
const read = name => fs.readFileSync(path.join(root, mediaDir, name));
const base = 0x713000, object = 0x1800000, actor = 0x1900000;
const device = RegionMap.BASE.DX_OBJECTS;
// Projection of retained living-before-t-capture.json, SHA pinned in the note.
// In particular, capture epoch is a page UUID; Worker epoch is a positive i64.
// They are different identities and must never be substituted for each other.
const identity = { moduleSha256: SELECTED, workerTarget: '822930DCEDE35EECF80578F7DC667B73',
  endpoint: 1, slot: 0, processId: 1000, epoch: 'a29e0d86-7a76-4496-ad1e-c5f690af7c74' };

async function scenario(mode, installed, bytes) {
  const callerPath = path.resolve(__dirname, 'drakan-real-caller.cjs');
  delete require.cache[callerPath];
  const caller = require(callerPath);
  const memory = { buffer: new SharedArrayBuffer(RegionMap.BASE.VIRTUAL_BACKING_BASE) };
  const d = new DataView(memory.buffer), at = a => RegionMap.g2w(a, 0x400000);
  const u = (a, v) => d.setUint32(at(a), v, true);
  u(0x47b700, object); u(object + 0xa0, actor); u(object + 0xa8, base + 0x4b320);
  u(actor, base + 0x150b20); u(actor + 0x58, object);
  d.setUint32(device, 7, true); d.setUint32(device + 8, 1, true);
  Atomics.store(new Int32Array(memory.buffer), RegionMap.BASE.SHARED_PROCESS_ID >>> 2, identity.processId);
  Atomics.store(new BigUint64Array(memory.buffer), (RegionMap.BASE.CALLBACK_OWNERSHIP + 8) >>> 3, 1n);
  for (const p of Object.values(installed)) new Uint8Array(memory.buffer, at(p.address), p.bytes.length).set(p.bytes);
  const diagnostics = { root: 2n, token: 3n, thread: 1 };
  const workerState = { memory, RegionMap, endpointIdentity: identity.endpoint, workerSlot: 0,
    instance: { exports: { null_diag_root: () => diagnostics.root,
      null_diag_token: () => diagnostics.token, get_current_thread_id: () => diagnostics.thread } } };
  if (mode === 'base') u(object + 0xa8, base + 0x4b324);
  if (mode === 'back') u(actor + 0x58, object + 4);
  if (mode === 'vtable') u(actor, base + 0x150b24);
  if (mode === 'endpoint') workerState.endpointIdentity++;
  if (mode === 'slot') workerState.workerSlot = 1;
  if (mode === 'slot-type') workerState.workerSlot = '0';
  if (mode === 'missing-slot') workerState.workerSlot = undefined;
  if (mode === 'process') d.setUint32(RegionMap.BASE.SHARED_PROCESS_ID, 1001, true);
  if (mode === 'epoch') Atomics.store(new BigUint64Array(memory.buffer), (RegionMap.BASE.CALLBACK_OWNERSHIP + 8) >>> 3, 0n);
  if (mode === 'root') diagnostics.root = 0n;
  if (mode === 'token') diagnostics.token = 0n;
  if (mode === 'thread') diagnostics.thread = 0;
  const worker = vm.createContext(workerState);
  let downAt, upAt, originalStarted, completion = false, joined = false;
  const rows = [], requests = [], listeners = {}, saved = new Map(), bindingTasks = [];
  const link = { drakanModuleBytes: bytes, endpointIdentity: identity.endpoint, slot: 0,
    worker: { addEventListener() {} } };
  const wine = { _wasmModule: {}, memory: {}, instance: {}, processId: identity.processId,
    moduleMap: [{ name: 'dragon.rfl', base }],
    renderer: { _diKeyboardClients: [{ deref: () => new Map([[device,
      { active: true, length: 1, capacity: 64, head: 0, events: [{ key: 0x154, stamp: 913, sequence: 9 }] }]]) }] } };
  wine.guestWorker = { link };
  const owner = { link, worker: wine.guestWorker, module: wine._wasmModule,
    memory: wine.memory, instance: wine.instance, used: false };
  wine.observeDrakanActor = async o => {
    originalStarted = o.actionStartedAt;
    assert(originalStarted >= downAt && originalStarted <= Date.now() + 2);
    assert.equal(o.timestamp, 913); assert.equal(o.maxMs, 100);
    try {
      const release = o.releaseT(); assert(!completion); await release; assert(completion);
      return { result: { status: mode === 'unknown' ? 'UNKNOWN' : 'COMPLETE' }, released: true };
    } finally { joined = true; }
  };
  const s = { console, Promise, Uint8Array, setTimeout, performance, crypto: crypto.webcrypto,
    runningApps: [{ wine }], drakanBrowserOwners: new Map([[wine, owner]]),
    addEventListener: (n, f) => { (listeners[n] ??= []).push(f); },
    __drakanReleaseRequest: payload => {
      requests.push(payload);
      bindingTasks.push(new Promise((resolve, reject) => setImmediate(() =>
        caller.binding({ payload }).then(resolve, reject))));
    } };
  s.window = s;
  const page = vm.createContext(s);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'drakan-caller-page.js'), 'utf8'), page);
  if (mode === 'wrong-actual-owner') link.drakanModuleBytes = Buffer.from('wrong actual selected bytes');
  let liveRead = false;
  const evaluate = async (text, session) => {
    if (session === 'worker') liveRead = true;
    const result = await vm.runInContext(text, session === 'worker' ? worker : page);
    // Runtime.evaluate returnByValue crosses the CDP JSON boundary.
    return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
  };
  const send = async (method, p) => {
    assert.equal(method, 'Input.dispatchKeyEvent'); rows.push(p);
    if (p.type === 'keyDown') {
      downAt = Date.now(); assert(saved.get('live-identity').passed, 'saved gate before down');
      for (const f of listeners.keydown) f({ type: 'keydown', code: 'KeyT', key: 't', isTrusted: true, repeat: false, timeStamp: 42 });
    } else {
      upAt = Date.now(); await new Promise(r => setTimeout(r, 15));
      if (mode === 'release-error') throw Error('physical release fixture rejection');
      completion = true;
      for (const f of listeners.keyup) f({ type: 'keyup', code: 'KeyT', key: 't', isTrusted: true, timeStamp: 43 });
    }
  };
  let result, error;
  try {
    result = await caller.hold({ send, evaluate, workers: new Map([['cpu',
      { targetId: identity.workerTarget, sessionId: 'worker' }]]), session: 'page', identity,
      holdMs: 100, save: (n, v) => saved.set(n, JSON.parse(JSON.stringify(v))), root, runtimePins });
  } catch (e) { error = e; }
  await Promise.all(bindingTasks);
  if (page.__drakanCaller.outcome) await page.__drakanCaller.outcome;
  assert(page.__drakanCaller.pending == null, 'release bridge joined');
  const normal = ['complete', 'unknown', 'release-error'].includes(mode);
  if (mode === 'wrong-actual-owner') { assert(error); assert(!liveRead); assert.equal(rows.length, 0); }
  else if (!normal) {
    assert(liveRead); assert.equal(error?.code, 'DRAKAN_LIVE_IDENTITY_REFUSED');
    const report = saved.get('live-identity'); assert(report && !report.passed);
    assert.equal(report.operands.length, 10);
    assert.deepEqual(report.failed, [mode.includes('slot') ? 'slot' : mode]);
    if (mode === 'missing-slot') assert.deepEqual(report.operands[4].actual, {type:'undefined',value:null});
    if (mode === 'slot-type') assert.deepEqual(report.operands[4].actual, {type:'string',value:'0'});
    assert.equal(rows.length, 0); assert.equal(requests.length, 0); assert(!originalStarted);
    assert(!page.__drakanCaller.armed); assert(!page.__drakanCaller.used);
  } else {
    if (mode !== 'release-error') assert(!error, String(error));
    assert(liveRead); assert.equal(rows.filter(r => r.type === 'keyDown').length, 1);
    assert.equal(rows.filter(r => r.type === 'keyUp').length, 1);
    assert(upAt - downAt <= 2000); assert(joined); assert(originalStarted >= downAt);
    if (mode === 'release-error') {
      assert.match(String(error), /physical release fixture rejection/);
      // No input/rearm: reject at the first read. This proves the joined
      // rejection no longer strands the module's private release binding.
      const fence = Error('closure cleanup probe; no input');
      await assert.rejects(caller.hold({ identity, holdMs:100, workers:new Map([['cpu',
        {targetId:identity.workerTarget,sessionId:'worker'}]]),
        evaluate:async()=>{throw fence;} }), e => e === fence);
    }
    else { assert(!error, String(error)); assert(completion);
      assert.equal(result.result.result.result.status, mode === 'unknown' ? 'UNKNOWN' : 'COMPLETE'); }
  }
  console.log(JSON.stringify({ mode, passed: true, liveRead, downs: rows.filter(r => r.type === 'keyDown').length,
    ups: rows.filter(r => r.type === 'keyUp').length, joined, guestExecution: false,
    actorQualification: false, failed: saved.get('live-identity')?.failed }));
}

(async () => {
  const bytes = fs.readFileSync(path.join(root, 'build/wine-assembly.wasm'));
  assert.equal(await api.verifiedModuleSha256(bytes), SELECTED);
  const installed = await api.installedPins(read('drakan.exe'), read('dragon.rfl'), base);
  for (const mode of ['complete', 'unknown', 'release-error', 'wrong-actual-owner',
    'base', 'back', 'vtable', 'endpoint', 'slot', 'slot-type', 'missing-slot',
    'process', 'epoch', 'root', 'token', 'thread']) await scenario(mode, installed, bytes);
  const { requireLiveIdentity } = require('./drakan-live-identity.cjs');
  const live = { base, object, back: object, vtable: base + 0x150b20, endpoint: 1,
    slot: 0, process: 1000, epoch: 1, root: '2', token: '3', thread: 1 };
  let saved;
  const multiple = {...live, base: base + 4, slot: 1, root: '0'};
  assert.throws(() => requireLiveIdentity({live:multiple,base,identity,save:(n,v)=>{saved=v;}}),
    e => e.identityReport === saved && saved.failed.join(',') === 'base,slot,root');
  const fault = Error('evidence persistence rejected');
  assert.throws(() => requireLiveIdentity({live,base,identity,save(){throw fault;}}), e => e === fault);
  const originalGate = v => v.base===base&&v.back===v.object&&v.vtable===base+0x150b20&&
    v.endpoint===identity.endpoint&&v.slot===0&&v.process===identity.processId&&
    v.epoch>0&&v.root>0&&v.token>0&&v.thread>0;
  let parity = 0;
  for (const field of ['base','back','vtable','endpoint','slot','process','epoch','root','token','thread'])
    for (const value of [undefined,null,0,-1,1,NaN,Infinity,'0','1',1n]) {
      const sample = {...live,[field]:value}; let report;
      try { requireLiveIdentity({live:sample,base,identity,save:(n,v)=>{report=v;}}); } catch(e) {
        assert.equal(e.code,'DRAKAN_LIVE_IDENTITY_REFUSED');
      }
      assert.equal(report.passed,originalGate(sample)); parity++;
    }
  console.log(JSON.stringify({multipleOperandsSavedBeforeThrow:true,persistenceFailureClosed:true,originalPredicateParity:parity}));
})().catch(e => { console.error(e); process.exitCode = 1; });
