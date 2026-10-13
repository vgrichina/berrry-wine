'use strict';
// Real PE API calls in two WebAssembly Workers sharing the registry. The
// resolver handshake holds one DllMain in guest nested LoadLibrary while the
// other worker attempts a competing operation; no loader methods are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { createHostImports } = require('../lib/host-imports');
const loader = require('../lib/dll-loader');
const boot = require('../lib/process-boot');
const { X86, pe, u32, BASE, DATA } = require('./test-dll-lifecycle-real-pe');
const ret = [0xb8, 1, 0, 0, 0, 0xc2, 12, 0];
function dll(bad = false) {
  const a = new X86();
  a.emit(0x53, 0x8b, 0x5c, 0x24, 8, 0x8b, 0x44, 0x24, 12);
  a.emit(0xff, 0x04, 0x85, u32(DATA));
  a.emit(0x85, 0xc0).branch([0x0f, 0x85], 'done');
  if (bad) a.emit(0x31, 0xc0, 0xff, 0xe0); // NULL jump without returning the callback frame
  else {
    a.eaxFrom(0x20).emit(0x85, 0xc0).branch([0x0f, 0x84], 'done');
    a.emit(0x8d, 0x83, u32(0x1500), 0x50).api('LoadLibraryA', true);
    a.emit(0x50).api('FreeLibrary', true);
  }
  a.label('done').emit(0x5b, ...ret);
  return pe([[0x1000, a.finish()], [0x1500, 'pause.dll\0']], true);
}
const files = { 'race.dll': dll(), 'bad.dll': dll(true), 'pause.dll': pe([[0x1000, ret]], true) };
files['large.dll'] = pe([], true);
files['large.dll'].writeUInt32LE(0, 0x80 + 24 + 16);
files['large.dll'].writeUInt32LE(0x09000000, 0x80 + 24 + 56);
const load = name => new X86().push(BASE + name).api('LoadLibraryA').emit(0xc3).finish();
const exe = pe([[0x2000, load(0x1500)], [0x2200, new X86().emit(0x50).api('FreeLibrary').emit(0xc3).finish()],
  [0x2600, load(0x1560)], [0x1560, 'large.dll\0'],
  [0x2700, new X86().push(28).push(DATA + 0x1c0).emit(0x50).api('VirtualQuery').emit(0xc3).finish()],
  [0x2400, load(0x1520)], [0x2500, load(0x1540)], [0x1540, 'other/race.dll\0'], [0x1500, 'race.dll\0'], [0x1520, 'bad.dll\0']]);
async function instance(module, memory) {
  const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
  const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.has_dll_file = () => 1;
  const i = await WebAssembly.instantiate(module, imports); ctx.exports = i.exports; return i.exports;
}
async function invoke(e, memory, entry, arg, findDll) {
  const sp = e.guest_alloc(0x10000) + 0xfff0;
  new DataView(memory.buffer).setUint32(e.guest_to_wasm(sp), 0, true);
  e.set_esp(sp); e.set_eip(entry); e.set_eax(arg || 0); e.clear_yield();
  try {
    for (let n = 0; n < 20000; n++) {
      e.run(10000);
      if (e.get_yield_reason() === 5 || e.get_yield_reason() === 3) {
        await boot.handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer, findDll });
      } else if (e.get_yield_reason() === 9) {
        await new Promise(resolve => setTimeout(resolve, 1)); e.clear_yield();
      } else if (!e.get_eip()) return e.get_eax() >>> 0;
    }
    throw new Error('guest operation did not return');
  } finally { e.guest_free(sp - 0xfff0); }
}
const nameOf = name => String(name).replace(/\\/g, '/').split('/').pop().toLowerCase();
function wait(worker, type) {
  return new Promise((resolve, reject) => {
    const msg = x => { if (x.type === type) { clean(); resolve(x); } };
    const err = e => { clean(); reject(e); };
    const exit = n => err(new Error('worker exited ' + n + ' before ' + type));
    function clean() { worker.off('message', msg); worker.off('error', err); worker.off('exit', exit); }
    worker.on('message', msg); worker.on('error', err); worker.on('exit', exit);
  });
}
async function workerMain() {
  const { module, memory, state, tid } = workerData;
  const e = await instance(module, memory); e.init_thread(tid, ...state); e.set_fs_base(e.guest_alloc(0x1000));
  let chain = Promise.resolve();
  parentPort.on('message', msg => {
    if (msg.type !== 'run') return;
    chain = chain.then(async () => {
      parentPort.postMessage({ type: 'attempt' });
      try {
        const value = await invoke(e, memory, msg.entry, msg.arg, async name => {
          if (nameOf(name) === 'pause.dll') {
            parentPort.postMessage({ type: 'lookup' });
            await new Promise(resolve => {
              const f = x => { if (x.type === 'reply') { parentPort.off('message', f); resolve(); } };
              parentPort.on('message', f);
            });
          }
          return files[nameOf(name)];
        });
        parentPort.postMessage({ type: 'done', value });
      } catch (error) { parentPort.postMessage({ type: 'done', error: String(error) }); }
    });
  });
  parentPort.postMessage({ type: 'ready' });
}
async function main() {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM || path.join(__dirname, '../build/wine-assembly.wasm')));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const e = await instance(module, memory); new Uint8Array(memory.buffer, e.get_staging(), exe.length).set(exe); e.load_pe(exe.length);
  const view = new DataView(memory.buffer), read = offset => view.getUint32(e.guest_to_wasm(DATA + offset), true);
  const write = (offset, value) => view.setUint32(e.guest_to_wasm(DATA + offset), value, true);
  const call = (rva, arg) => invoke(e, memory, BASE + rva, arg, async name => files[nameOf(name)]);
  const handle = await call(0x2000), index = e.get_dll_index(handle), generation = e.get_dll_generation(index);
  assert(handle); assert.equal(read(4), 1);
  const state = [e.get_image_base(), e.get_code_start(), e.get_code_end(), e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks()];
  const workers = [1, 2].map(tid => new Worker(__filename, { workerData: { module, memory, state, tid } }));
  const guard = setTimeout(() => workers.forEach(w => w.terminate()), 20000);
  const start = (w, entry, arg) => { const done = wait(w, 'done'); w.postMessage({ type: 'run', entry: BASE + entry, arg }); return done; };
  try {
    await Promise.all(workers.map(w => wait(w, 'ready')));
    write(0x20, 1);
    const lookup = wait(workers[0], 'lookup'), freed = start(workers[0], 0x2200, handle); await lookup;
    const attempted = wait(workers[1], 'attempt'), reloaded = start(workers[1], 0x2000); await attempted;
    let premature = false; reloaded.then(() => { premature = true; }, () => {});
    freed.catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(premature, false, 'same-path load must wait for final detach to complete');
    workers[0].postMessage({ type: 'reply' });
    assert.deepEqual(await freed, { type: 'done', value: 1 });
    const replacement = await reloaded; assert(!replacement.error); assert.equal(replacement.value, handle, 'fixture requires actual row/base reuse');
    assert.equal(read(0), 1); assert.equal(read(4), 2);
    assert(e.get_dll_generation(index) > generation);
    const life = e.get_dll_lifecycle_table() + index * e.get_dll_lifecycle_stride();
    const snapshot = Buffer.from(new Uint8Array(memory.buffer, life, 64));
    assert.equal(e.complete_dll_initialize(index, generation, 2), 0, 'stale FALSE completion cannot poison replacement');
    assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer, life, 64)), snapshot);
    write(0x20, 0);
    const double = await Promise.all(workers.map(w => start(w, 0x2200, handle)));
    assert.deepEqual(double.map(x => x.value).sort(), [0, 1], 'exactly one competing final free owns the sole reference');
    assert.equal(read(0), 2, 'competing frees must call PROCESS_DETACH only once');
    assert.equal(e.get_dll_index(handle), -1);
    const pathA = await call(0x2000), pathB = await call(0x2500);
    assert(pathA && pathB); assert.notEqual(pathA, pathB, 'qualified path must not retain an unrelated same-basename DLL');
    assert.equal(await call(0x2200, pathA), 1); assert.equal(await call(0x2200, pathB), 1);
    const bad = await call(0x2400), badIndex = e.get_dll_index(bad), badGeneration = e.get_dll_generation(badIndex);
    const wa = e.guest_to_wasm(bad), bytes = Buffer.from(new Uint8Array(memory.buffer, wa, 0x3000));
    const failure = await start(workers[0], 0x2200, bad);
    assert.match(failure.error || '', /detach did not return|DllMain did not complete/);
    assert.equal(e.get_dll_generation(badIndex), badGeneration);
    assert.equal(view.getUint32(e.get_dll_lifecycle_table() + badIndex * e.get_dll_lifecycle_stride(), true), 3, 'failed detach stays reserved');
    assert.notEqual(e.get_available_dll_slot(), badIndex);
    assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer, wa, 0x3000)), bytes, 'failed callback cannot clear its mapped image');
    const large = await call(0x2600), largeIndex = e.get_dll_index(large);
    assert(large); assert.notEqual(largeIndex, badIndex, 'quarantined image must not be reused');
    assert.equal(view.getUint32(e.get_dll_lifecycle_table() + largeIndex * e.get_dll_lifecycle_stride() + 32, true), 1, 'large PE must use actual sparse mapping');
    assert.equal(await call(0x2700, large), 28); assert.equal(read(0x1d0), 0x1000);
    assert.equal(await call(0x2200, large), 1);
    assert.equal(await call(0x2700, large), 28); assert.equal(read(0x1d0), 0x10000, 'sparse reservation must become MEM_FREE');
    const reclaimed = await call(0x2600); assert.equal(reclaimed, large, 'freed sparse range is reusable');
    assert.equal(await call(0x2200, reclaimed), 1);
    console.log('PASS same-path load/final-free contention, two competing final frees, stale generation rejection, non-returning detach quarantine');
  } finally { clearTimeout(guard); await Promise.all(workers.map(w => w.terminate())); }
}
(isMainThread ? main() : workerMain()).catch(error => { console.error(error); process.exitCode = 1; });
