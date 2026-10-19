#!/usr/bin/env node
'use strict';
// Native validation lane only: actual OS Worker, compiled x86 API routes and
// production synchronous import broker. No substitute snapshot implementation.
const assert = require('node:assert/strict');
const {Worker} = require('node:worker_threads');
const {bootRenderHarness} = require('./render-helper');
const {ThreadManager} = require('../lib/thread-manager');
const RPC = require('../lib/guest-rpc');
const {sigs} = require('../lib/host-import-sigs.generated.json');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');
const tailCalls = !process.argv.includes('--no-tail-calls');
(async () => {
  let manager, failure = 0;
  const staging = [];
  const h = await bootRenderHarness({fonts: 'none', tailCalls, extraHostOverrides: {
    snapshot_threads: (...args) => {
      staging.push(args[0]);
      return failure || manager.snapshotThreads(...args);
    },
  }}), e = h.exports;
  manager = new ThreadManager(h.module, h.memory, h.instance, () => ({}));
  manager._log = () => {};
  // Actual native execution below uses slot1/tid2. Retain it in the production
  // authority just as the backend does when installing a Worker link.
  manager.threads.set(0xe1000, {tid: 1, state: 'active', priority: 2});
  const pe = makeFixture();
  new Uint8Array(h.memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const stack = e.get_esp();
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return [...b]; };
  const bytes = data => { const p = e.guest_alloc(data.length); data.forEach((b, i) => e.guest_write8(p + i, b)); return p; };
  const program = (pointer, args) => bytes([
    ...args.slice().reverse().flatMap(n => [0x68, ...u32(n)]),
    0xb8, ...u32(pointer), 0xff, 0xd0, 0xc3,
  ]);
  const run = pointer => {
    e.set_esp(stack); e.clear_yield(); e.call_func(pointer, 0, 0, 0, 0);
    const before = e.get_esp(); e.run(10000);
    assert.equal(e.get_eip(), 0); assert.equal(e.get_esp(), before + 4);
    return e.get_eax() >>> 0;
  };
  const call = (pointer, args = []) => run(program(pointer, args));
  const read = p => e.guest_read32(p) >>> 0;
  const string = s => bytes([...Buffer.from(s + '\0')]);
  const module = call(read(iat('LoadLibraryA')), [string('KERNEL32.DLL')]);
  const api = Object.fromEntries(['CreateToolhelp32Snapshot', 'Thread32First', 'Thread32Next',
    'Heap32ListFirst', 'CloseHandle', 'GetLastError'].map(name => {
    const pointer = call(read(iat('GetProcAddress')), [module, string(name)]);
    assert(pointer, name); return [name, pointer];
  }));
  const entry = e.guest_alloc(28), workerEntry = e.guest_alloc(28), heapEntry = e.guest_alloc(16);
  e.guest_write32(entry, 28); e.guest_write32(workerEntry, 28); e.guest_write32(heapEntry, 16);
  const capture = program(api.CreateToolhelp32Snapshot, [4, 0]);
  const getError = program(api.GetLastError, []);
  const metadata = [1, e.get_image_base(), e.get_code_start(), e.get_code_end(),
    e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), e.get_rsrc_rva()];
  const workerStack = e.guest_alloc(65536) + 65520;
  const broker = RPC.createMainBroker(h.memory, h.host, sigs, {});
  const worker = new Worker(`
    const {parentPort,workerData:d}=require('node:worker_threads');
    const remote=require(d.rpc).createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),{slot:3});
    const gdi={}; for(const i of WebAssembly.Module.imports(d.module)) if(i.module==='gdi') gdi[i.name]=()=>{throw Error('unexpected GDI '+i.name)};
    const e=new WebAssembly.Instance(d.module,{host:remote.imports.host,gdi}).exports;
    e.init_thread(...d.metadata);
    const run=p=>{e.set_esp(d.stack);e.clear_yield();e.call_func(p,0,0,0,0);const before=e.get_esp();e.run(10000);
      if(e.get_eip()!==0||e.get_esp()!==before+4)throw Error('guest frame did not return');return e.get_eax()>>>0;};
    parentPort.on('message',m=>{
      if(m.race) parentPort.postMessage({t:'racing'});
      const results=[];
      for(let i=0;i<(m.repeat||1);i++) {
        const value=run(m.pointer), error=run(d.error);
        results.push([value,error]);
      }
      parentPort.postMessage({t:'done',results});
    });
  `, {eval: true, workerData: {module: h.module, memory: h.memory, sigs,
    rpc: require.resolve('../lib/guest-rpc'), metadata, stack: workerStack, error: getError}});
  let hold = false, held = null, workerError;
  const queued = [], waiters = new Map();
  const deliver = m => {
    if (waiters.has(m.t)) { const resolve = waiters.get(m.t); waiters.delete(m.t); resolve(m); }
    else queued.push(m);
  };
  const receive = type => new Promise((resolve, reject) => {
    const at = queued.findIndex(m => m.t === type);
    if (at >= 0) return resolve(queued.splice(at, 1)[0]);
    const timer = setTimeout(() => {waiters.delete(type); reject(Error('Worker timeout: ' + type));}, 10000);
    waiters.set(type, m => {clearTimeout(timer); resolve(m);});
  });
  worker.on('error', error => {workerError = error;});
  worker.on('message', m => {
    if (m.t !== 'rpc') return deliver(m);
    if (hold) {held = m; deliver({t: 'held'});}
    else broker.serveRpc(m.slot);
  });
  try {
    hold = true; worker.postMessage({pointer: capture}); await receive('held');
    // Main must finish while the Worker is blocked. A held Toolhelp lock
    // deadlocks here; the admitted process-group timeout is the outer guard.
    const interleaved = call(api.CreateToolhelp32Snapshot, [1, 0]); assert(interleaved);
    assert.equal(call(api.Heap32ListFirst, [interleaved, heapEntry]), 1);
    const kept = call(api.CreateToolhelp32Snapshot, [1, 0]); assert(kept);
    assert.equal(call(api.CloseHandle, [interleaved]), 1);
    hold = false; broker.serveRpc(held.slot);
    const snapshot = (await receive('done')).results[0][0]; assert(snapshot && snapshot !== 0xffffffff);
    assert.equal(call(api.Heap32ListFirst, [kept, heapEntry]), 1, 'publication preserved newer list head');
    assert.equal(call(api.Thread32First, [snapshot, entry]), 1); assert.equal(read(entry + 8), 1);
    worker.postMessage({pointer: program(api.Thread32Next, [snapshot, workerEntry])});
    assert.equal((await receive('done')).results[0][0], 1);
    assert.equal(read(workerEntry + 8), 2); assert.equal(read(workerEntry + 16), 10);
    manager.threads.get(0xe1000).state = 'exited';
    manager.threads.set(0xe1001, {tid: 1, state: 'active', priority: -2});
    assert.equal(call(api.Thread32First, [snapshot, entry]), 1);
    assert.equal(call(api.Thread32Next, [snapshot, entry]), 1);
    assert.equal(read(entry + 16), 10, 'captured priority survives exit and slot reuse');
    // Every failed broker capture frees its unpublished allocation. Reusing
    // one guest program avoids incidental test allocations between failures.
    for (const error of [-8, -50, -120]) {
      failure = error; staging.length = 0;
      worker.postMessage({pointer: capture, repeat: 64});
      for (const result of (await receive('done')).results) assert.deepEqual(result, [0xffffffff, -error]);
      assert.equal(new Set(staging).size, 1, 'repeated broker failure reuses freed staging allocation');
      assert.equal(call(api.Heap32ListFirst, [kept, heapEntry]), 1, 'failure never corrupts published list');
    }
    failure = 0;
    const firstProgram = program(api.Thread32First, [snapshot, workerEntry]);
    worker.postMessage({pointer: firstProgram, repeat: 1024, race: true}); await receive('racing');
    assert.equal(call(api.CloseHandle, [snapshot]), 1);
    for (const [value, error] of (await receive('done')).results) {
      assert(value === 1 || (value === 0 && error === 6), 'enumeration atomically wins or sees closed handle');
    }
    worker.postMessage({pointer: firstProgram});
    assert.deepEqual((await receive('done')).results[0], [0, 6]);
    assert.equal(call(api.CloseHandle, [kept]), 1);
    assert.equal(workerError, undefined);
  } finally { await worker.terminate(); h.hostCtx.stopAudio(); }
  assert.equal(worker.threadId, -1);
  console.log('Toolhelp actual OS Worker broker/lock/publication/failure cleanup/close race PASS; tailCalls=' + tailCalls);
})().catch(error => {console.error(error); process.exitCode = 1;});
