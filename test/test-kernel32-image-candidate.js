#!/usr/bin/env node
'use strict';
// Explicit prebuilt full-module integration. Never compiles or runs a game.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { createHostImports } = require('../lib/host-imports');
const { serviceDllUnloadAsync } = require('../lib/dll-loader');
const { BASE, iat } = require('../tools/kernel32-native-fixture');
const { REGIONS } = require('../lib/region-map.generated');
const manifest = require('../src/kernel32-exports.json');
const option = n => process.argv.find(a => a.startsWith('--' + n + '='))?.slice(n.length + 3);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const deadline = Date.now() + 60000;
function bounded() { assert(Date.now() < deadline, '60-second integration deadline'); }
async function context(module, memory, init, stack) {
  const logged = [];
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
    terminate_thread: () => 0, create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0, com_create_instance: () => 0x80004002,
    log: (p, n) => logged.push(Buffer.from(bytes.slice(p, p + n)).toString('ascii')) });
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  if (init) e.init_thread(...init);
  e.set_api_log(1);
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const read = p => dv.getUint32(wa(p), true);
  const string = p => { let s = ''; for (let n = 0; n < 260; n++) { const c = bytes[wa(p + n)]; if (!c) return s; s += String.fromCharCode(c); } throw Error('Unterminated string'); };
  async function call(addr, args, nargs) {
    bounded();
    e.set_esp(stack || e.get_esp());
    e.call_func(addr, args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0);
    const before = e.get_esp() >>> 0;
    for (let i = 0; i < 20000; i++) {
      bounded(); e.run(100);
      const yieldReason = e.get_yield_reason();
      if (yieldReason) {
        const unloaded = await serviceDllUnloadAsync({ exports: e, memoryBuffer: memory.buffer });
        if (!unloaded) {
          assert.equal(yieldReason, 9, 'only loader-lock contention may park');
          e.clear_yield(); await new Promise(resolve => setImmediate(resolve));
        }
      }
      if (!e.get_eip() && !e.get_yield_reason()) break;
      if (i === 19999) throw Error('API dispatch budget exhausted');
    }
    assert.equal(e.get_eip(), 0);
    assert.equal(e.get_esp() >>> 0, before + 4 * (nargs + 1), 'stdcall cleanup');
    return e.get_eax() >>> 0;
  }
  const counts = { GetModuleHandleA: 1, LoadLibraryA: 1, GetProcAddress: 2, FreeLibrary: 1,
    SetLastError: 1, GetLastError: 0, GetModuleFileNameA: 3 };
  const api = (name, args = []) => call(read(iat(name)), args, counts[name]);
  return { e, wa, read, string, call, api, logged };
}
function waitGate(words, phase) {
  while (Atomics.load(words, 0) < phase) { bounded(); Atomics.wait(words, 0, Atomics.load(words, 0), 50); }
}
async function child() {
  // An Atomics.waitAsync promise does not keep a Node Worker alive. Production
  // workers have a parent-port message listener; this one-shot fixture needs
  // its own live handle until the bounded operation completes.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const d = workerData, gate = new Int32Array(d.gate);
    const c = await context(d.module, d.memory, d.init, d.stack);
    parentPort.postMessage({ phase: 'ready' }); waitGate(gate, 1);
    const h = await c.api('GetModuleHandleA', [d.names.kernel]);
    assert(h && h !== BASE); assert.equal(c.read(h + 60), 128);
    for (let i = 0; i < 32; i++) assert.equal(await c.api('LoadLibraryA', [d.names.kernel]), h);
    const entry = manifest.exports.find(e => e.name === 'GetLastError');
    const exp = h + c.read(h + c.read(h + 60) + 120);
    const direct = h + c.read(h + c.read(exp + 28) + (entry.ordinal - 1) * 4);
    const dynamic = await c.api('GetProcAddress', [h, d.names.error]);
    assert.equal(dynamic, direct);
    const marker = 0x10203000 + d.tid;
    await c.api('SetLastError', [marker]);
    assert.equal(await c.call(direct, [], 0), marker, 'actual x86 JMP executes native handler');
    assert(c.logged.includes('GetLastError'), 'dispatcher decodes complete native export name');
    assert.equal(await c.api('GetProcAddress', [h, d.names.callback]), 0);
    assert.equal(await c.api('GetProcAddress', [h, d.names.qt]), 0);
    for (const ordinal of [35, 36, 37]) assert.equal(await c.api('GetProcAddress', [h, ordinal]), 0);
    const callback = await c.api('GetProcAddress', [BASE, d.names.callback]);
    assert.equal(await c.call(callback, [], 0), 0x12345678);
    parentPort.postMessage({ phase: 'loaded', h, direct }); waitGate(gate, 2);
    for (let i = 0; i < 32; i++) {
      assert.equal(await c.api('FreeLibrary', [h]), 1);
      if ((i + 1) % 8 === 0) parentPort.postMessage({ phase: 'releasing', count: i + 1 });
    }
    assert.equal(await c.api('GetModuleHandleA', [d.names.kernel]), h);
    parentPort.postMessage({ phase: 'done', h });
  } finally { clearInterval(keepAlive); }
}
async function main() {
  assert(option('wasm') && option('fixture') && option('fixture-sha256'));
  const wasm = fs.readFileSync(option('wasm')), fixture = fs.readFileSync(option('fixture'));
  assert.equal(sha(fixture), option('fixture-sha256'));
  console.log(JSON.stringify({ wasm: sha(wasm), fixture: sha(fixture), sparse: process.argv.includes('--sparse') }));
  const module = await WebAssembly.compile(wasm);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const c = await context(module, memory);
  new Uint8Array(memory.buffer).set(fixture, c.e.get_staging());
  assert(c.e.load_pe(fixture.length));
  const names = {};
  for (const [key, text] of Object.entries({ kernel: 'kernel32.dll', error: 'GetLastError',
    callback: 'FixtureExeCallback', qt: 'QT_Thunk', system: 'C:\\WINDOWS\\SYSTEM\\kernel32.dll',
    private: 'C:\\private\\kernel32.dll' })) {
    const p = c.e.guest_alloc(text.length + 1) >>> 0;
    new Uint8Array(memory.buffer).set(Buffer.from(text + '\0'), c.wa(p)); names[key] = p;
  }
  if (process.argv.includes('--expect-old-identity')) {
    assert.equal(await c.api('GetModuleHandleA', [names.kernel]), BASE);
    console.log('PASS baseline negative control: old KERNEL32 identity aliases EXE');
    return;
  }
  const stacks = [c.e.guest_alloc(65536) + 65520, c.e.guest_alloc(65536) + 65520];
  if (process.argv.includes('--sparse')) {
    let spilled = false;
    for (let n = 0; n < 2048; n++) {
      const p = c.e.guest_alloc(65536) >>> 0; assert(p, 'bounded heap-pressure fixture');
      if (c.wa(p) !== ((p - BASE + c.e.get_guest_base()) >>> 0)) { spilled = true; break; }
    }
    assert(spilled, 'heap pressure must reach sparse allocation');
  }
  const gate = new SharedArrayBuffer(4), words = new Int32Array(gate), workers = [], states = [];
  let failure;
  const snapshot = () => ({ states, phase: Atomics.load(words, 0),
    refs: Atomics.load(new Int32Array(memory.buffer, REGIONS.KERNEL32_MODULE.base + 4, 1), 0),
    callbackGate: Array.from(new Int32Array(memory.buffer, c.e.get_dll_callback_lock(), 2)) });
  try {
    for (let i = 0; i < 2; i++) {
      const tid = i + 1;
      const w = new Worker(__filename, { workerData: { module, memory, gate, tid, stack: stacks[i], names,
        init: [tid, BASE, c.e.get_code_start(), c.e.get_code_end(), c.e.get_thunk_base(), c.e.get_thunk_end(), c.e.get_num_thunks(), 0] } });
      workers.push(w); states.push({});
      w.on('message', msg => {
        console.log(JSON.stringify({ worker: tid, ...msg }));
        if (msg.error) failure = Error(msg.error); else states[i][msg.phase] = msg;
      });
      w.on('error', err => { failure = err; });
      w.on('exit', code => {
        const evidence = { worker: tid, exit: code, ...snapshot() };
        console.log(JSON.stringify(evidence));
        if ((code || !states[i].done) && !failure) failure = Error('worker exited before completion: ' + JSON.stringify(evidence));
      });
    }
    async function wait(phase) {
      while (!states.every(s => s[phase])) {
        assert(Date.now() < deadline, '60-second integration deadline waiting ' + phase + ': ' + JSON.stringify(snapshot()));
        if (failure) throw failure; await new Promise(r => setTimeout(r, 10));
      }
    }
    await wait('ready'); Atomics.store(words, 0, 1); Atomics.notify(words, 0);
    await wait('loaded');
    assert.equal(states[0].loaded.h, states[1].loaded.h, 'concurrent publication is unique');
    assert.equal(states[0].loaded.direct, states[1].loaded.direct);
    const h = states[0].loaded.h;
    if (process.argv.includes('--sparse')) assert.notEqual(c.wa(h), ((h - BASE + c.e.get_guest_base()) >>> 0));
    const refs = new Int32Array(memory.buffer, REGIONS.KERNEL32_MODULE.base + 4, 1);
    assert.equal(Atomics.load(refs, 0), 64, 'two independent workers retain all refs');
    Atomics.store(words, 0, 2); Atomics.notify(words, 0);
    await wait('done'); assert.equal(Atomics.load(refs, 0), 0, 'concurrent frees balance');
    assert.equal(await c.api('FreeLibrary', [h]), 0, 'over-release fails');
    assert.equal(await c.api('LoadLibraryA', [names.system]), h);
    assert.equal(await c.api('LoadLibraryA', [names.private]), 0);
    assert.equal(await c.api('FreeLibrary', [h]), 1);
    assert.equal(await c.api('GetModuleHandleA', [0]), BASE);
  } finally { await Promise.all(workers.map(w => w.terminate())); }
  new Uint8Array(memory.buffer).set(fixture, c.e.get_staging());
  assert(c.e.load_pe(fixture.length));
  assert.equal(new DataView(memory.buffer).getUint32(REGIONS.KERNEL32_MODULE.base, true), 0,
    'new process cannot retain an old heap-backed module pointer');
  const reloadedName = c.e.guest_alloc(13) >>> 0;
  new Uint8Array(memory.buffer).set(Buffer.from('kernel32.dll\0'), c.wa(reloadedName));
  const reloaded = await c.api('GetModuleHandleA', [reloadedName]);
  assert(reloaded && reloaded !== BASE); assert.equal(c.read(reloaded + 60), 128);
  console.log('PASS full module: concurrent publication/refcounts, actual JMP dispatch/name/ESP, EXE separation, path lifetime and process reload');
}
(isMainThread ? main() : child()).catch(error => {
  if (!isMainThread) parentPort.postMessage({ error: error.stack });
  else console.error(error.stack);
  process.exitCode = 1;
});
