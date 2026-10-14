'use strict';

// Two actual Workers share one mapped PE process. A's guest DllMain pauses in
// nested LoadLibrary byte resolution while B requests a different DllMain.
// The browser/main-style event loop must remain able to serve that lookup and
// a cooperative pending loader operation must retain its guest continuation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { createHostImports } = require('../lib/host-imports');
const loader = require(process.env.WA_DLL_LOADER || '../lib/dll-loader');
const boot = require('../lib/process-boot');
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const ACTIVE = 0x401380, OVERLAP = ACTIVE + 4, B_ENTERED = ACTIVE + 8;
function pe(code, dll = true, name = 'nested.dll') {
  const b = Buffer.alloc(0x600), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(dll ? 0x210e : 0x010e, p + 22); b.writeUInt16LE(0x10b, o);
  b.writeUInt32LE(0x1000, o + 16); b.writeUInt32LE(dll ? 0x10000000 : 0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x400, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x400, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  Buffer.from(code).copy(b, 0x200);
  b.writeUInt32LE(0x1200, o + 104); b.writeUInt32LE(40, o + 108);
  b.writeUInt32LE(0x1100, 0x400); b.writeUInt32LE(0x1280, 0x40c); b.writeUInt32LE(0x1100, 0x410);
  b.writeUInt32LE(0x12a0, 0x300); b.write('kernel32.dll\0', 0x480); b.write('LoadLibraryA\0', 0x4a2);
  b.write(name + '\0', 0x500);
  return b;
}
const ret = [0xb8, 1, 0, 0, 0, 0xc2, 12, 0];
const nested = pe(ret);
async function instantiate(module, memory) {
  const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  // These fixture files are supplied by the real async resolver below.
  imports.host.has_dll_file = () => 1;
  const instance = await WebAssembly.instantiate(module, imports); ctx.exports = instance.exports;
  return instance.exports;
}
function listen(worker, type) {
  return new Promise((resolve, reject) => {
    const onMessage = msg => { if (msg.type === type) { cleanup(); resolve(msg); } };
    const onError = error => { cleanup(); reject(error); };
    const onExit = code => onError(new Error(`worker exited ${code} before ${type}`));
    const cleanup = () => { worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit); };
    worker.on('message', onMessage); worker.on('error', onError); worker.on('exit', onExit);
  });
}
async function workerMain() {
  // Production guest-worker keeps its command port listening while awaiting
  // the callback gate; waitAsync alone does not keep a Node worker alive.
  parentPort.on('message', () => {});
  const { module, memory, tid, image, state } = workerData;
  const e = await instantiate(module, memory);
  e.init_thread(tid, ...state);
  e.set_esp((e.guest_alloc(0x10000) >>> 0) + 0xfff0);
  e.set_fs_base(e.guest_alloc(0x1000)); e.set_eip(0x401000);
  parentPort.postMessage({ type: 'ready' });
  await new Promise(resolve => parentPort.once('message', resolve));
  parentPort.postMessage({ type: 'attempt' });
  const outcome = await loader.callDllMainAsync(e, image.loadAddr, image.dllMain, null, {
    requireCompletion: true,
    onLoadLibraryYield: async () => {
      await boot.handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer,
        findDll: async () => {
          parentPort.postMessage({ type: 'lookup' });
          const bytes = await new Promise(resolve => parentPort.once('message', msg => resolve(msg.bytes)));
          return new Uint8Array(bytes);
        } });
      return true;
    },
  });
  loader.finishDllInitialization(e, memory.buffer, image, outcome);
  parentPort.postMessage({ type: 'done', outcome });
  parentPort.close();
}
async function main() {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM || path.join(__dirname, '../build/wine-assembly.wasm')));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const e = await instantiate(module, memory);
  const exe = pe([0x68, ...u32(0x401300), 0xff, 0x15, ...u32(0x401100), 0xcc], false, 'cooperative.dll');
  new Uint8Array(memory.buffer, e.get_staging(), exe.length).set(exe); e.load_pe(exe.length);
  // A's callback owns an outstanding async lookup; B's guest code records any
  // overlap. This is a real interpreted callback, not a lock-helper assertion.
  const a = loader.loadDll(e, memory.buffer, pe([
    0x53, 0x8b, 0x5c, 0x24, 8,
    0xc7, 0x05, ...u32(ACTIVE), 1, 0, 0, 0,
    0x8d, 0x83, ...u32(0x1300), 0x50, 0xff, 0x93, ...u32(0x1100),
    0xc7, 0x05, ...u32(ACTIVE), 0, 0, 0, 0, 0x5b, ...ret,
  ]), 'C:\\serial-a.dll');
  const b = loader.loadDll(e, memory.buffer, pe([
    0xa1, ...u32(ACTIVE), 0xa3, ...u32(OVERLAP),
    0xc7, 0x05, ...u32(B_ENTERED), 1, 0, 0, 0, ...ret,
  ]), 'C:\\serial-b.dll');
  e.run(1000);
  assert.equal(e.get_yield_reason(), 5, 'main PE must really issue LoadLibrary');
  const saved = [e.get_eip(), e.get_esp(), e.get_eax(), e.get_yield_reason()];
  const state = [e.get_image_base(), e.get_code_start(), e.get_code_end(), e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks()];
  const workers = [a, b].map((image, i) => new Worker(__filename, { workerData: { module, memory, tid: i + 1, image, state } }));
  const guard = setTimeout(() => workers.forEach(w => w.terminate()), 20000);
  try {
    await Promise.all(workers.map(w => listen(w, 'ready')));
    const lookup = listen(workers[0], 'lookup'), aDone = listen(workers[0], 'done');
    workers[0].postMessage({ type: 'start' }); await lookup;
    const bAttempt = listen(workers[1], 'attempt'), bDone = listen(workers[1], 'done');
    workers[1].postMessage({ type: 'start' }); await bAttempt;
    let syncLookups = 0;
    const syncOpts = { exports: e, memoryBuffer: memory.buffer, findDllSync() { syncLookups++; return nested; } };
    assert.equal(boot.serviceLoadLibraryYieldSync(syncOpts), false, 'main must park on the worker-owned gate');
    assert.deepEqual([e.get_eip(), e.get_esp(), e.get_eax(), e.get_yield_reason()], saved, 'park must preserve the complete guest API continuation');
    assert.equal(syncLookups, 0, 'no transaction may publish while another owner is in DllMain');
    await new Promise(resolve => setTimeout(resolve, 75));
    const read = g => new DataView(memory.buffer).getUint32(e.guest_to_wasm(g), true);
    const before = read(B_ENTERED);
    workers[0].postMessage({ bytes: nested }); // reverse worker->main resolver stays live
    const outcomes = await Promise.all([aDone, bDone]);
    assert(outcomes.every(x => x.outcome.completed && x.outcome.returnValue));
    assert.equal(before, 0, 'B entered DllMain while A awaited nested bytes');
    assert.equal(read(OVERLAP), 0, 'guest callbacks from different owners overlapped');
    assert.equal(read(B_ENTERED), 1, 'B must eventually run');
    assert.equal(boot.serviceLoadLibraryYieldSync(syncOpts), true, 'parked cooperative operation must complete after gate release');
    assert.equal(e.get_yield_reason(), 0);
    assert(e.get_eax() >>> 0, 'cooperative LoadLibrary must return its real mapped handle');
    console.log('PASS real PE callbacks serialize across Workers; same-owner nested lookup and main parking/retry complete');
  } finally { clearTimeout(guard); await Promise.all(workers.map(w => w.terminate())); }
}
(isMainThread ? main() : workerMain()).catch(error => { console.error(error); process.exitCode = 1; });
