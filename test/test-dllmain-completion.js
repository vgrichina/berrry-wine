'use strict';

// Real PE entry points through the interpreter, on the main instance and an
// actual Worker. No callback/export mocks: RET, NULL jumps, Sleep and ExitThread
// must be distinguished by the production callback runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { createHostImports } = require('../lib/host-imports');
const { loadDll, callDllMain } = require(process.env.WA_DLL_LOADER || '../lib/dll-loader');

function pe(code, api, dll = true) {
  const b = Buffer.alloc(0x600), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c);
  b.writeUInt32LE(0x4550, p); b.writeUInt16LE(0x14c, p + 4);
  b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(dll ? 0x210e : 0x010e, p + 22);
  b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(dll ? 0x10000000 : 0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(2, o + 68); b.writeUInt32LE(0x100000, o + 72);
  b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x400, s + 8);
  b.writeUInt32LE(0x1000, s + 12); b.writeUInt32LE(0x400, s + 16);
  b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  Buffer.from(code).copy(b, 0x200);
  if (api) {
    b.writeUInt32LE(0x1200, o + 104); b.writeUInt32LE(40, o + 108);
    b.writeUInt32LE(0x1100, 0x400); b.writeUInt32LE(0x1280, 0x40c);
    b.writeUInt32LE(0x1100, 0x410); b.writeUInt32LE(0x12a0, 0x300);
    b.write('kernel32.dll\0', 0x480); b.write(api + '\0', 0x4a2);
  }
  return b;
}

async function exercise(module) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const exits = [];
  const ctx = { getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: () => {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  imports.host.exit_thread = code => { exits.push(code >>> 0); };
  const { exports: e } = await WebAssembly.instantiate(module, imports); ctx.exports = e;
  const exe = pe([0xc3], null, false);
  new Uint8Array(memory.buffer, e.get_staging(), exe.length).set(exe); e.load_pe(exe.length);
  const g32 = g => new DataView(memory.buffer).getUint32(e.guest_to_wasm(g) >>> 0, true);
  const put32 = (g, v) => new DataView(memory.buffer).setUint32(e.guest_to_wasm(g) >>> 0, v, true);
  const savedEip = e.get_eip(), savedEsp = e.get_esp(), fsBase = e.get_fs_base();
  let n = 0;
  function invoke(code, api, options = {}) {
    e.clear_yield(); e.set_eip(savedEip); e.set_esp(savedEsp);
    const row = e.get_dll_count(), image = pe(code, api);
    const loaded = loadDll(e, memory.buffer, image, `C:\\completion${n++}.dll`);
    put32(fsBase, 0x13572468); e.set_eax(0x12345678); e.set_ebx(0x23456789);
    const outcome = callDllMain(e, loaded.loadAddr, loaded.dllMain, null, options);
    const flags = new DataView(memory.buffer).getUint32(e.get_dll_flags_table() + row * 4, true);
    return { outcome, flags, loaded };
  }
  const ret = value => [0xb8, value, 0, 0, 0, 0xc2, 12, 0];
  let r = invoke(ret(0));
  assert.equal(r.flags & 4, 0, 'FALSE cannot publish attach success');
  assert.equal(r.outcome.completed, true, 'FALSE is a completed callback, not a trap');
  assert.equal(r.outcome.returnValue, 0);
  const detachFalse = callDllMain(e, r.loaded.loadAddr, r.loaded.dllMain, null,
    { reason: 0, requireCompletion: true });
  assert.equal(detachFalse.completed, true, 'detach return value is ignored');

  r = invoke(ret(7));
  assert.equal(r.outcome.completed, true, 'any nonzero BOOL completes attach');
  assert.equal(r.outcome.returnValue, 7);
  assert.ok(r.flags & 4, 'successful callback publishes initialized');
  assert.equal(e.get_eax(), 0x12345678, 'callback preserves enclosing volatile registers');
  assert.equal(e.get_eip(), savedEip); assert.equal(e.get_esp(), savedEsp);

  r = invoke([0x31, 0xc0, 0xff, 0xe0]); // xor eax,eax; jmp eax
  assert.equal(r.outcome.completed, false, 'NULL jump without RET is not completion');
  assert.equal(r.flags & 4, 0);
  r = invoke([0xeb, 0xfe], null, { maxBlocks: 1 });
  assert.equal(r.outcome.completed, false, 'budget exhaustion is not completion');
  assert.equal(r.flags & 4, 0);
  assert.throws(() => invoke([0xeb, 0xfe], null, { maxBlocks: 1, requireCompletion: true }),
    /DllMain did not complete/, 'unload callers must reject unfinished detach');

  // Overwrite FS:[0], then return: the caller owns its SEH chain even after
  // a successful callback. Previously only the trap path restored it.
  r = invoke([0x64, 0xc7, 0x05, 0, 0, 0, 0, 0x11, 0x22, 0x33, 0x44, ...ret(1)]);
  assert.equal(r.outcome.completed, true); assert.equal(g32(fsBase), 0x13572468);

  let ticks = 0;
  r = invoke([0x8b, 0x5c, 0x24, 4, 0x6a, 5, 0xff, 0x93, 0, 0x11, 0, 0, ...ret(1)],
    'Sleep', { advanceGuestTime: ms => { ticks += ms; } });
  assert.equal(r.outcome.completed, true); assert.equal(ticks, 5);
  assert.equal(e.get_ebx(), 0x23456789);

  // Terminal exit must survive callback unwinding; the post-call RET is not
  // executed, and neither the caller's EIP nor attach-success is restored.
  r = invoke([0x8b, 0x5c, 0x24, 4, 0x6a, 23, 0xff, 0x93, 0, 0x11, 0, 0, ...ret(1)], 'ExitThread');
  assert.deepEqual(exits, [23]); assert.equal(r.outcome.exited, true);
  assert.equal(r.outcome.completed, false); assert.equal(r.flags & 4, 0);
  assert.equal(e.get_eip(), 0); assert.equal(e.get_yield_reason(), 2);

  // Thread-detach notifications run *after* exit. Their ordinary return must
  // preserve that pending exit disposition, rather than interpret it as a new
  // exit from the callback or clear it for the scheduler.
  const prior = invoke(ret(1));
  e.set_yield_state(2, 1); e.set_eip(0);
  const detach = callDllMain(e, prior.loaded.loadAddr, prior.loaded.dllMain, null, { reason: 3 });
  assert.equal(detach.completed, true); assert.equal(detach.exited, false);
  assert.equal(e.get_eip(), 0); assert.equal(e.get_yield_reason(), 2);
  return { cases: 11 };
}

if (!isMainThread) {
  exercise(workerData.module).then(result => parentPort.postMessage(result), error => { throw error; });
} else {
  (async () => {
    const wasm = process.env.WA_TEST_WASM || path.join(__dirname, '../build/wine-assembly.wasm');
    const module = await WebAssembly.compile(fs.readFileSync(wasm));
    const main = await exercise(module);
    const worker = new Worker(__filename, { workerData: { module } });
    const guard = setTimeout(() => worker.terminate(), 30000);
    try {
      const result = await new Promise((resolve, reject) => {
        worker.once('message', resolve); worker.once('error', reject);
        worker.once('exit', code => reject(new Error(`worker exited before result (${code})`)));
      });
      assert.deepEqual(result, main);
    } finally { clearTimeout(guard); await worker.terminate(); }
    console.log('PASS DllMain completion, failure, continuation and terminal exit on real PE/main/Worker');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
