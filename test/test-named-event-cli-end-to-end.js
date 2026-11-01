'use strict';
// Production source-slice acceptance, not a full VM or game qualification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const { Worker } = require('node:worker_threads');
const root = path.resolve(__dirname, '..');
const base = 'a9a60c69f8598562d80bf8b97f64b3864476280b';
const baseline = process.argv.includes('--baseline');
const mutant = process.argv.find(x => x.startsWith('--mutant='))?.split('=')[1];
const delay = ms => new Promise(r => setTimeout(r, ms));
const block = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (process.argv.includes('--authority')) {
  const { NamedEventAuthority } = require('../lib/named-event-authority');
  const owner = new NamedEventAuthority();
  process.send(owner.endpoint);
  process.on('message', async () => { await owner.close(); process.disconnect(); });
  return;
}
function source(file) {
  return baseline ? cp.execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
function load(file) {
  const mod = new Module(path.join(root, file), module);
  mod.filename = path.join(root, file); mod.paths = Module._nodeModulePaths(path.dirname(mod.filename));
  let text = source(file);
  if (file === 'lib/thread-manager.js' && mutant === 'duplicate-registration') {
    const needle = 'const registered = client.registerWait(reference, timeout, clock);';
    assert(text.includes(needle)); text = text.replace(needle, 'client.registerWait(reference, timeout, clock); ' + needle);
  }
  if (file === 'lib/thread-manager.js' && mutant === 'lost-pulse') {
    const needle = 'this._eventClient().waitStatus(wait.waitId)';
    assert(text.includes(needle));
    text = text.replace(needle, "{ state: this._eventClient().acquire(wait.reference) ? 'signaled' : 'pending' }");
  }
  if (file === 'lib/thread-manager.js' && mutant === 'stale-continuation') {
    const needle = 'this._authorityContinuations.get(continuation) !== wait';
    assert(text.includes(needle)); text = text.replace(needle, 'false');
  }
  mod._compile(text, mod.filename); return mod.exports;
}
const { ThreadManager } = load('lib/thread-manager.js');
const RPC = load('lib/guest-rpc.js');
const cli = source('test/run.js');
const sigs = { wait_single: { params: ['i32', 'i32'], results: ['i32'] } };
function adapter(tm, tid, instance = null) {
  const start = cli.indexOf('    wh.wait_single = ');
  const end = cli.indexOf('\n    };', start) + 7;
  assert(start > 0 && end > start);
  const wh = {}, h = { wait_single: (handle, timeout) => tm.waitSingle(handle, timeout, tid + 1) };
  new Function('wh', 'workerInstance', 'threadManager', 'tid', 'h', cli.slice(start, end))(wh, instance, tm, tid, h);
  return wh;
}
function mainAdapter(tm) {
  const start = cli.indexOf('  h.wait_single = ');
  const end = cli.indexOf('\n  h.wait_multiple', start);
  const h = {};
  new Function('h', 'threadManager', 'nestedSyncMessage', 'win32ThreadId', cli.slice(start, end))
    (h, tm, () => false, () => 1);
  return h;
}
let serial = 0;
function fixture(big = false) {
  const memory = new WebAssembly.Memory({ initial: big ? 8192 : 2, maximum: big ? 8192 : 2, shared: true });
  const tm = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({ host: {} }));
  tm._log = () => {}; tm.enableNamedEventAuthority();
  return { memory, tm, create: (manual = false, signal = false) =>
    tm.createEvent(manual, signal, `e2e-${process.pid}-${++serial}`) & 0x7fffffff };
}
function frame(handle, timeout) {
  let yr = 1, eax, esp = 256, completions = 0;
  return { get_sync_table: () => 0, get_yield_reason: () => yr, get_wait_handle: () => handle,
    get_wait_timeout: () => timeout, get_wait_handles_ptr: () => 0, get_wait_stack_bytes: () => 12,
    get_esp: () => esp, guest_read32: () => 0x401234, get_eip: () => 0x401000,
    clear_yield: () => { yr = 0; completions++; }, set_eax: v => { eax = v >>> 0; },
    set_esp: v => { esp = v; }, set_eip: v => assert.equal(v, 0x401234),
    result: () => eax, completed: () => { assert.equal(esp, 268); assert.equal(completions, 1); } };
}
async function workerFixture(slot = 0) {
  const f = fixture(true), errors = [];
  const h = slot ? adapter(f.tm, slot) : mainAdapter(f.tm);
  const broker = RPC.createMainBroker(f.memory, h, sigs, { onError: (n, e) => errors.push(e.code) });
  // Baseline Worker code is evaluated from its exact historical source too.
  let workerSource = source('lib/guest-worker.js');
  if (mutant === 'duplicate-completion') {
    const needle = 'if (msg.namedWaitSequence || namedWaitTransport?.getNamedWaitSequence()) {';
    assert(workerSource.includes(needle)); workerSource = workerSource.replace(needle, 'if (false) {');
  }
  const completionStart = workerSource.indexOf("    if (msg.t === 'completeWait') {");
  const completionEnd = workerSource.indexOf("    if (msg.t === 'beginProcessSendWait'", completionStart);
  const w = new Worker(`
    const {parentPort,workerData:d}=require('node:worker_threads');
    const Module=require('node:module');
    const m=new Module(d.file);m.filename=d.file;m.paths=Module._nodeModulePaths(require('node:path').dirname(d.file));
    m._compile(d.source,d.file);const RPC=m.exports;
    const built=RPC.createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),
      {slot:d.slot,getSyncMsgDepth:()=>0}), h=built.imports.host;
    let esp=256,eax,clears=0;
    const instance={exports:{guest_read32:()=>0x401234,get_esp:()=>esp,clear_yield:()=>{clears++;},
      set_eax:v=>{eax=v>>>0;},set_esp:v=>{esp=v;},set_eip:()=>{}}};
    const complete=new Function('msg','instance','namedWaitTransport','threadSendFrames','send',d.completion);
    parentPort.on('message', c=>{
      if(c.t==='completeWait') {
        complete(c,instance,built,[],m=>parentPort.postMessage({...m,esp,eax,clears,done:true}));return;
      }
      const at=process.hrtime.bigint();
      try { const result=h.wait_single(c.handle,c.timeout)>>>0;
        parentPort.postMessage({done:true,result,namedWaitSequence:built.getNamedWaitSequence?.(),elapsed:Number(process.hrtime.bigint()-at)/1e6}); }
      catch(e){parentPort.postMessage({done:true,error:e.message});}
    });
    parentPort.postMessage({ready:true});
  `, { eval: true, workerData: { memory: f.memory, sigs, slot, file: path.join(root, 'lib/guest-rpc.js'), source: source('lib/guest-rpc.js'), completion: workerSource.slice(completionStart, completionEnd) } });
  await new Promise((resolve, reject) => { w.once('error', reject); w.once('message', resolve); });
  let priorEntry;
  const call = (handle, timeout, options = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('worker watchdog')), 5000);
    async function receive(m) {
      if (m.t === 'rpc') {
        if (options.delay) await delay(options.delay);
        let entry = m.waitEntry;
        if (options.mutate) entry = options.mutate(entry, priorEntry);
        priorEntry = m.waitEntry;
        try { broker.serveRpc(m.slot, entry); } catch (e) { clearTimeout(timer); reject(e); }
      } else if (m.done) { clearTimeout(timer); w.off('message', receive); resolve(m); }
    }
    w.on('message', receive); w.postMessage({ handle, timeout });
  });
  const complete = msg => new Promise(resolve => { w.once('message', resolve); w.postMessage({ t: 'completeWait', ...msg }); });
  return { ...f, call, complete, errors, broker, slot, close: async () => { await w.terminate(); f.tm.closeNamedEventAuthority?.(); } };
}
async function timing() {
  for (const slot of [0, 7]) {
    const f = await workerFixture(slot);
    try {
      const h = f.create(false, true), client = f.tm._eventClient();
      if (mutant === 'recapture') {
        const original = client.validateWaitClock.bind(client);
        client.validateWaitClock = () => original(RPC.captureWaitEntry().clock);
      }
      const first = await f.call(h, 50, { delay: 180 });
      console.log(JSON.stringify({ test: 'entry-delay', slot, ...first }));
      assert.equal(first.result, 258, '50ms original budget must expire across 180ms RPC delivery');
      assert.equal(f.tm.waitSingle(h, 0), 0, 'expired registration preserves signal');
      f.tm.setEvent(h);
      const validate = client.validateWaitClock.bind(client);
      client.validateWaitClock = clock => {
        const stamp = validate(clock);
        assert.deepEqual(stamp.callerClock, clock, 'authority echoes the exact integer sample and domain');
        assert(Number(process.hrtime.bigint() - BigInt(clock.tick)) / 1e6 < 50, 'validation precedes expiry');
        block(180); return stamp;
      };
      const second = await f.call(h, 50);
      assert.equal(second.result, 258, 'delay AFTER validation must expire atomically at registration');
      assert.equal(f.tm.waitSingle(h, 0), 0);
      client.validateWaitClock = validate;
      f.tm.setEvent(h);
      const register = client.registerWait.bind(client);
      client.registerWait = (...args) => { const value = register(...args); block(180); return value; };
      assert.equal((await f.call(h, 50)).result, 0, 'assigned before expiry survives late registration reply');
      client.registerWait = register;
      // Missing, stale, cross-call, malformed, foreign, and version mismatch.
      for (const mutate of [() => undefined, (e, old) => old, e => ({ ...e, handle: e.handle + 1 }),
        e => ({ ...e, version: 2 }), e => ({ ...e, clock: { ...e.clock, tick: '1.5' } }),
        (e, old) => ({ ...e, clock: old.clock }),
        e => ({ ...e, clock: { ...e.clock, domain: 'foreign' } })]) {
        f.tm.setEvent(h);
        assert((await f.call(h, 50, { mutate })).error, 'bad metadata must trap');
        assert.equal(f.tm.waitSingle(h, 0), 0, 'bad metadata must not acquire');
      }
      // Same Worker, fresh invocation and metadata after every rejection.
      for (let i = 0; i < 12; i++) { f.tm.setEvent(h); assert.equal((await f.call(h, 500)).result, 0); }
      const words = new Int32Array(f.memory.buffer, RPC.RPC_BASE + slot * RPC.RPC_STRIDE, RPC.CTRL_INTS);
      Atomics.store(words, RPC.SLOT.WAIT_VERSION, 0);
      f.tm.setEvent(h);
      assert((await f.call(h, 50)).error, 'version disagreement rejects before the authority sees a wait');
      assert.equal(f.tm.waitSingle(h, 0), 0);
      Atomics.store(words, RPC.SLOT.WAIT_VERSION, 1);
      f.tm.setEvent(h); assert.equal((await f.call(h, 0)).result, 0);
      assert.equal((await f.call(0x12345, 50)).result, 0, 'nonnamed legacy route remains unchanged');
      f.tm.setEvent(h); assert.equal((await f.call(h, -1)).result, 0xffffffff);
      assert.equal(f.tm.waitSingle(h, 0), 0);
      assert.equal(f.tm._authorityWaits.size, 0);
      // Actual production Worker completion body, over Worker transport, with
      // explicit register fixtures. Stale/duplicate completion cannot pop ESP.
      const waiting = await f.call(h, 500);
      assert.equal(waiting.result, 65535);
      const r = { waitHandle: h, waitTimeout: 500, waitStackBytes: 12, namedWaitSequence: waiting.namedWaitSequence };
      assert.equal(f.tm.resolveWait(r, {}, { threadId: slot + 1 }), null);
      f.tm.setEvent(h); f.tm.resetEvent(h);
      const done = f.tm.resolveWait(r, {}, { threadId: slot + 1 });
      assert.notEqual(done, null, 'registered Worker Set-Reset wake must not be lost');
      assert.equal(done.result, 0);
      const bad = await f.complete({ ...done, namedWaitSequence: waiting.namedWaitSequence - 1 });
      assert(bad.ownershipMismatch); assert.equal(bad.esp, 256);
      const completed = await f.complete({ ...done, namedWaitSequence: waiting.namedWaitSequence });
      assert.equal(completed.esp, 268); assert.equal(completed.clears, 1); assert.equal(completed.eax, 0);
      const duplicate = await f.complete({ ...done, namedWaitSequence: waiting.namedWaitSequence });
      assert(duplicate.ownershipMismatch); assert.equal(duplicate.esp, 268); assert.equal(duplicate.clears, 1);
      console.log('PASS production Worker timing, identity, errors and repeated calls slot', slot);
    } finally { await f.close(); }
  }
}
async function reservations() {
  const f = fixture(), { tm } = f, client = tm._eventClient();
  try {
    let registrations = 0, acquisitions = 0;
    const register = client.registerWait.bind(client), acquire = client.acquire.bind(client);
    client.registerWait = (...a) => { registrations++; return register(...a); };
    client.acquire = (...a) => { acquisitions++; return acquire(...a); };
    for (const manual of [true, false]) {
      const h = f.create(manual), before = registrations;
      assert.equal(tm.waitSingle(h, 500, 2), 65535);
      assert.equal(tm.waitSingle(h, 500, 3), 65535);
      assert.equal(tm.waitSingle(h, 500, 2), 0xffffffff, 'duplicate import cannot overwrite reservation');
      for (let i = 0; i < 3; i++) assert.equal(tm._resolveAuthorityWait(h, 500, 2), null);
      tm.setEvent(h); tm.resetEvent(h);
      assert.equal(tm._resolveAuthorityWait(h, 500, 2), 0, 'registered Set-Reset pulse must survive');
      assert.equal(tm._resolveAuthorityWait(h, 500, 3), manual ? 0 : null, 'manual all, auto exactly one');
      if (!manual) { tm.setEvent(h); tm.resetEvent(h); assert.equal(tm._resolveAuthorityWait(h, 500, 3), 0); }
      assert.equal(registrations - before, 2, 'polls never register again');
      assert.equal(acquisitions, 0, 'finite waits never reacquire');
      tm.closeEvent(h);
    }
    const h = f.create();
    const validClock = tm.captureNamedWaitEntry().clock;
    for (const tick of [null, 1, '', '-1', '1.5', ' 1', '1e3', '9'.repeat(25), (process.hrtime.bigint() + 10000000000n).toString()]) {
      assert.throws(() => client.validateWaitClock({ ...validClock, tick }), { code: 'EINVAL' });
    }
    assert.throws(() => client.validateWaitClock({ ...validClock, domain: 'foreign' }), { code: 'ECLOCKSCOPE' });
    assert.equal(mainAdapter(tm).wait_single(h, 50), 65535);
    const e = frame(h, 50); tm.mainInstance.exports = e;
    tm.setEvent(h); tm.resetEvent(h); await delay(180);
    assert.equal(tm.checkMainYield(), false); assert.equal(e.result(), 0); e.completed();
    tm.checkMainYield(); e.completed();
    assert.equal(tm._authorityWaits.size, 0);
    // Actual Worker scheduler resolver retains invocation identity on its reply.
    assert.equal(tm.waitSingle(h, 1000, 4), 65535);
    const r = { waitHandle: h, waitTimeout: 1000, waitStackBytes: 12 };
    assert.equal(tm.resolveWait(r, {}, { threadId: 4 }), null);
    tm.setEvent(h); assert.equal(tm.resolveWait(r, {}, { threadId: 4 }).result, 0);
    assert.equal(tm.waitSingle(h, 1000, 4), 65535);
    tm.setEvent(h);
    assert.equal(tm.resolveWait(r, {}, { threadId: 4 }).result, 0xffffffff, 'stale continuation cannot complete a new invocation');
    assert.equal(tm.resolveWait({ ...r }, {}, { threadId: 4 }).result, 0);
    // Closure resolves status and forgets immediately, including committed success.
    for (const signaled of [false, true]) {
      const event = f.create(); assert.equal(tm.waitSingle(event, 1000, 5), 65535);
      const id = tm._authorityWaits.get(5).waitId;
      if (signaled) tm.setEvent(event);
      tm.closeEvent(event);
      assert.throws(() => client.waitStatus(id), { code: 'EBADWAIT' });
      assert.equal(tm._resolveAuthorityWait(event, 1000, 5), signaled ? 0 : 0xffffffff);
    }
    assert.equal(tm.waitSingle(h, 1000, 6), 65535);
    const cancelled = tm._authorityWaits.get(6).waitId;
    tm._markThreadExited(123, { tid: 5, state: 'active' }, 0, 'acceptance');
    assert.throws(() => client.waitStatus(cancelled), { code: 'EBADWAIT' });
    tm.setEvent(h); assert.equal(tm.waitSingle(h, 0), 0, 'cancelled waiter cannot consume later signal');
    const stamp = tm.captureNamedWaitEntry(); tm.setEvent(h);
    assert.equal(tm.waitSingle(h, 500, 7, stamp), 0);
    assert.throws(() => tm.waitSingle(h, 500, 8, stamp), { code: 'EWAITPROTOCOL' });
    // Terminal forgetting exceeds the authority session quota without a leak.
    for (let i = 0; i < 270; i++) { tm.setEvent(h); assert.equal(tm.waitSingle(h, 500), 0); }
    const held = [];
    for (let i = 0; i < 256; i++) { assert.equal(tm.waitSingle(h, 10000, i + 10), 65535); held.push(i + 10); }
    assert.throws(() => tm.waitSingle(h, 10000, 999), { code: 'ENOSPC' });
    for (const id of held) tm._cancelAuthorityWait(id);
    assert.equal(tm._authorityWaits.size, 0);
    tm.setEvent(h); assert.equal(tm.waitSingleCooperative(h, 50), 0xffffffff);
    new Uint32Array(f.memory.buffer, 65536, 1)[0] = h;
    assert.equal(tm.waitMultiple(1, 65536, false, 50), 0);
    assert.equal(tm.waitSingle(h, 0), 258, 'ready multiple wait consumes the named signal');
    assert.equal(tm.waitSingle(h, 25), 65535); await delay(60);
    tm.setEvent(h); assert.equal(tm._resolveAuthorityWait(h, 25, 1), 258);
    assert.equal(tm.waitSingle(h, 0), 0, 'timeout leaves later signal unconsumed');
    console.log('PASS reservations, pulse, status, single completion, stale continuation, teardown, quotas');
  } finally { tm.closeNamedEventAuthority(); }
}
// Real production WAT API calls backed by the real authority. Unlike the
// adapter tests above, subsequent API consumers are the signal-state oracle.
async function readyAnyWat() {
  const { bootRenderHarness } = require('./render-helper');
  let tm, memory;
  const extraWat = `
    (func (export "ready_init") (global.set $image_base (i32.const 0)))
    (func (export "ready_create") (param $name i32) (param $manual i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
      (call $handle_CreateEventA (i32.const 0) (local.get $manual) (i32.const 0) (local.get $name) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "ready_set") (param $h i32) (result i32)
      (call $handle_SetEvent (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "ready_single") (param $h i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
      (call $handle_WaitForSingleObject (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "ready_many") (param $p i32) (param $all i32) (param $timeout i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
      (call $handle_WaitForMultipleObjects (i32.const 2) (local.get $p) (local.get $all) (local.get $timeout) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "ready_close") (param $h i32) (result i32)
      (call $handle_CloseHandle (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
  `;
  const h = await bootRenderHarness({ fonts: 'none', extraWat, extraHostOverrides: {
    create_event: (manual, initial, wa) => {
      let name = ''; const bytes = new Uint8Array(memory.buffer);
      if (wa) for (let i = wa; bytes[i]; i++) name += String.fromCharCode(bytes[i]);
      return tm.createEvent(manual, initial, name);
    },
    set_event: h => tm.setEvent(h),
    fs_close_handle: h => tm.closeSyncHandle(h) ? 1 : 0,
    wait_single: (...a) => tm.waitSingle(...a, 1),
    wait_multiple: (...a) => tm.waitMultiple(...a, 1),
  }});
  memory = h.memory; const e = h.exports; e.ready_init();
  tm = new ThreadManager(h.module, memory, h.instance, () => ({ host: {} }));
  tm.enableNamedEventAuthority();
  try {
    const name = 0x2000, ptr = 0x3000;
    Buffer.from(`ReadyAny-${process.pid}\0`).forEach((v, i) => e.guest_write8(name + i, v));
    const local = e.ready_create(0, 0) >>> 0, named = e.ready_create(name, 0) >>> 0;
    const duplicate = e.ready_create(name, 1) >>> 0;
    assert.equal(duplicate, named, 'WAT strips the private existing-object tag');
    const pair = (a, b, timeout = -1, all = 0) => {
      e.guest_write32(ptr, a); e.guest_write32(ptr + 4, b);
      return e.ready_many(ptr, all, timeout) >>> 0;
    };
    for (const timeout of [-1, 50, 0]) {
      assert.equal(e.ready_set(local), 1);
      assert.equal(pair(local, named, timeout), 0, 'ready unnamed event wins mixed wait');
      assert.equal(e.ready_single(local), 258, 'mixed wait consumed auto signal');
      assert.equal(e.ready_set(named), 1);
      assert.equal(pair(local, named, timeout), 1, 'ready authority event can win');
      assert.equal(e.ready_single(named), 258, 'authority consumed exactly once');
      e.ready_set(local); e.ready_set(named);
      assert.equal(pair(named, local, timeout), 0, 'lowest ready index wins in reversed order');
      assert.equal(e.ready_single(named), 258);
      assert.equal(e.ready_single(local), 0, 'higher ready signal remains unconsumed');
    }
    assert.equal(pair(local, named, 0), 258, 'no-ready zero poll times out');
    for (const timeout of [-1, 50]) {
      assert.equal(pair(local, named, timeout), 0xffffffff, 'no-ready remote multiwait remains unsupported');
    }
    e.ready_set(local); e.ready_set(named);
    assert.equal(pair(local, named, -1, 1), 0xffffffff, 'remote wait-all remains unsupported');
    assert.equal(e.ready_single(local), 0);
    assert.equal(e.ready_single(named), 0, 'rejected wait-all consumes neither event');
    for (const invalid of [0, 0x12345678, named | 0x80000000]) {
      e.ready_set(local);
      assert.equal(pair(local, invalid), 0xffffffff);
      assert.equal(e.ready_single(local), 0, 'invalid later handle leaves signal available');
      e.ready_set(named);
      assert.equal(pair(named, invalid), 0xffffffff);
      assert.equal(e.ready_single(named), 0, 'invalid later handle also preserves authority signal');
    }
    assert.equal(e.ready_close(named), 1, 'partial close retains existing reference');
    e.ready_set(named); assert.equal(pair(local, named), 1);
    assert.equal(e.ready_close(named), 1);
    e.ready_set(local);
    assert.equal(pair(local, named), 0xffffffff, 'closed authority handle invalidates entire wait');
    assert.equal(e.ready_single(local), 0);
    Buffer.from(`ReadyManual-${process.pid}\0`).forEach((v, i) => e.guest_write8(name + i, v));
    const manual = e.ready_create(name, 1) >>> 0;
    assert.notEqual(manual, named, 'recreated slot has a new handle');
    e.ready_set(manual);
    assert.equal(pair(local, manual), 1);
    assert.equal(pair(local, manual), 1, 'manual authority event remains signaled');
    assert.equal(tm._authorityWaits?.size || 0, 0, 'ready probes register no blocking continuation');
    console.log('PASS production WAT mixed ready-any API: order, consumption, invalid/closed/tagged handles, manual reset, no-ready rejection');
  } finally { tm.closeNamedEventAuthority(); }
}

async function main() {
  const child = cp.fork(__filename, ['--authority'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const endpoint = await new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); });
  process.env.WINE_NAMED_EVENT_ENDPOINT = JSON.stringify(endpoint);
  try { await timing(); if (!baseline) { await reservations(); await readyAnyWat(); } }
  finally { child.send('close'); await new Promise(resolve => child.once('exit', resolve)); }
  console.log('PASS qualified source-slice end-to-end acceptance; no full VM/game/Windows qualification');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
