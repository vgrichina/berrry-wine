'use strict';
// Two guest threads loading the SAME DLL at once (DLL-CONCURRENT-MAPPING).
//
// LoadLibrary checks for a loaded module and then yields to the host, so two
// threads asking for one DLL used to map it twice and run its DllMain twice.
// Windows maps a module once, and a second LoadLibrary of a module whose
// DLL_PROCESS_ATTACH is still running waits for it -- unless the asker is the
// thread running that DllMain. Here two real Workers share one memory:
//
//   A loads c:\demo\x.dll; its "DllMain" (the window between load_dll and
//   complete_dll_initialize, which callDllMain closes) is held at a barrier. During it,
//   B loads the same path, and A itself asks for it again.
//
// B must get A's HMODULE, without a DllMain of its own, and only once A's
// initializer is done; A must get it at once (no waiting on itself); one row
// is published. A different path with the same bytes is a different module.
// The guest's own LoadLibraryA finds the mapped module in WAT without asking
// the host: B's must park (yield 9, frame intact) until A's initializer is
// done, and A's, from inside that initializer, must not.
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const root = path.resolve(__dirname, '..');
const assert = require('node:assert/strict');

const A_MAPPED = 0, B_OBSERVED_INITIALIZING = 1;

if (!isMainThread) {
  (async () => {
    const { createHostImports } = require(root + '/lib/host-imports');
    const { loadDll, callDllMain, finishDllInitialization, loadedModuleNames } = require(root + '/lib/dll-loader');
    const memory = workerData.memory, ctl = new Int32Array(workerData.control);
    const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: () => {} };
    const imports = createHostImports(ctx); imports.host.memory = memory;
    for (const name of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event', 'set_event', 'reset_event', 'wait_single', 'wait_multiple']) imports.host[name] = () => 0;
    const instance = await WebAssembly.instantiate(workerData.module, imports), e = instance.exports; ctx.exports = e;
    e.init_thread(workerData.id === 'a' ? 2 : 3, e.get_image_base(), e.get_code_start(), e.get_code_end(),
      e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), 0);
    e.set_esp((e.guest_alloc(0x10000) >>> 0) + 0xfff0);
    e.set_fs_base(e.guest_alloc(0x1000));
    const fixture = new Uint8Array(workerData.fixture);
    // Inspect the shipped lifecycle ABI, not a host completion flag that could
    // be set before the real initializer returned.
    const state = index => Atomics.load(new Int32Array(memory.buffer),
      (e.get_dll_lifecycle_table() + index * e.get_dll_lifecycle_stride()) >>> 2);
    // A guest LoadLibraryA("x.dll") through the handler, once: 'parked' when
    // it yielded to retry, else the HMODULE it returned.
    const guestLoad = name => {
      if (!e.test_loadlibrary_once) return { missing: true };
      const g = e.guest_alloc(name.length + 1) >>> 0;
      for (let i = 0; i < name.length; i++) e.guest_write8(g + i, name.charCodeAt(i));
      e.guest_write8(g + name.length, 0);
      return e.test_loadlibrary_once(g) & 1 ? { parked: true } : { parked: false, eax: e.get_eax() >>> 0 };
    };
    parentPort.postMessage({ ready: true });
    parentPort.once('message', () => {
      try {
        const out = { id: workerData.id };
        if (workerData.id === 'a') {
          const first = loadDll(e, memory.buffer, fixture, 'c:\\demo\\x.dll');
          out.first = { loadAddr: first.loadAddr >>> 0, dllMain: first.dllMain >>> 0, existing: !!first.existing };
          Atomics.store(ctl, A_MAPPED, 1); Atomics.notify(ctl, A_MAPPED);
          // Inside our own DllMain: asking again must not wait for ourselves.
          const t0 = Date.now();
          const again = loadDll(e, memory.buffer, fixture, 'C:/DEMO/X.DLL');
          out.again = { loadAddr: again.loadAddr >>> 0, existing: !!again.existing, ms: Date.now() - t0 };
          // ...and so does the guest's own LoadLibraryA from inside it.
          out.guestSelf = guestLoad('x.dll');
          out.namesDuring = [...loadedModuleNames(e, memory.buffer)];
          while (!Atomics.load(ctl, B_OBSERVED_INITIALIZING)) {
            if (Atomics.wait(ctl, B_OBSERVED_INITIALIZING, 0, 10000) === 'timed-out')
              throw Error('B never inspected the initializing module');
          }
          // What callDllMain does on return (absent before the fix: the control
          // still reaches the identity assertions below).
          const outcome = callDllMain(e, first.loadAddr, first.dllMain, null, { requireCompletion: true });
          assert(outcome.completed && outcome.returnValue, 'real DLL_PROCESS_ATTACH must return TRUE');
          finishDllInitialization(e, memory.buffer, first, outcome);
          out.namesAfter = [...loadedModuleNames(e, memory.buffer)];
          // A different file is a different module, whatever its bytes.
          const other = loadDll(e, memory.buffer, fixture, 'c:\\demo\\y.dll');
          out.other = { loadAddr: other.loadAddr >>> 0, existing: !!other.existing };
        } else {
          while (Atomics.load(ctl, A_MAPPED) === 0) {
            if (Atomics.wait(ctl, A_MAPPED, 0, 10000) === 'timed-out') throw Error('A never mapped');
          }
          // The guest's LoadLibraryA finds the module mapped: it must park while
          // A's initializer runs, not return it.
          out.guestDuring = guestLoad('x.dll');
          out.guestDuringBeforeInit = state(0) === 1;
          out.namesDuring = [...loadedModuleNames(e, memory.buffer)];
          Atomics.store(ctl, B_OBSERVED_INITIALIZING, 1);
          Atomics.notify(ctl, B_OBSERVED_INITIALIZING);
          const got = loadDll(e, memory.buffer, fixture, 'c:\\demo\\x.dll');
          out.guestAfter = guestLoad('X.DLL');
          out.got = { loadAddr: got.loadAddr >>> 0, dllMain: got.dllMain >>> 0, existing: !!got.existing,
            afterInit: state(got.index) === 2 };
          out.namesAfter = [...loadedModuleNames(e, memory.buffer)];
        }
        out.dllCount = e.get_dll_count();
        parentPort.postMessage(out);
      } catch (error) { parentPort.postMessage({ id: workerData.id, error: String(error && error.stack || error) }); }
    });
  })().catch(error => parentPort.postMessage({ id: workerData.id, error: String(error) }));
} else {
  (async () => {
    // One section, and an entry point, so the row waits for its initializer.
    function dll() {
      const b = Buffer.alloc(0x400), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
      b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(pe, 0x3c);
      b.writeUInt32LE(0x4550, pe); b.writeUInt16LE(0x14c, pe + 4);
      b.writeUInt16LE(1, pe + 6); b.writeUInt16LE(0xe0, pe + 20);
      b.writeUInt16LE(0x210e, pe + 22); b.writeUInt16LE(0x10b, opt);
      b.writeUInt32LE(0x1000, opt + 16);                  // AddressOfEntryPoint
      b.writeUInt32LE(0x10000000, opt + 28);
      b.writeUInt32LE(0x1000, opt + 32); b.writeUInt32LE(0x200, opt + 36);
      b.writeUInt32LE(0x2000, opt + 56); b.writeUInt32LE(0x200, opt + 60);
      b.writeUInt32LE(16, opt + 92);
      b.write('.text\0\0\0', section, 'ascii');
      b.writeUInt32LE(0x200, section + 8); b.writeUInt32LE(0x1000, section + 12);
      b.writeUInt32LE(0x200, section + 16); b.writeUInt32LE(0x200, section + 20);
      b.writeUInt32LE(0xe0000060, section + 36);
      Buffer.from([0xb8, 1, 0, 0, 0, 0xc2, 0x0c, 0]).copy(b, 0x200); // mov eax,1; ret 12
      return b;
    }
    const module = await WebAssembly.compile(fs.readFileSync(root + '/build/wine-assembly.wasm'));
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const control = new SharedArrayBuffer(16);
    const fixture = dll();
    const workers = [], results = {}, ready = [], done = [];
    const guard = setTimeout(() => { for (const w of workers) w.terminate(); }, 60000);
    try {
      for (const id of ['a', 'b']) {
        const w = new Worker(__filename, { workerData: { id, module, memory, control, fixture } });
        workers.push(w);
        ready.push(new Promise(resolve => w.on('message', m => { if (m.ready) resolve(); })));
        done.push(new Promise(resolve => {
          w.on('message', m => { if (!m.ready) { results[id] = m; resolve(); } });
          w.on('error', error => { results[id] = { id, error: String(error) }; resolve(); });
          w.on('exit', resolve);
        }));
      }
      await Promise.all(ready);
      for (const w of workers) w.postMessage({ go: true });
      await Promise.all(done);
    } finally {
      clearTimeout(guard);
      for (const w of workers) w.terminate();
    }
    const { a, b } = results;
    assert.ok(a && !a.error, `worker a: ${a && a.error}`);
    assert.ok(b && !b.error, `worker b: ${b && b.error}`);
    assert.ok(a.first.dllMain && !a.first.existing, 'A maps the module and owns its DllMain');
    assert.equal(b.got.loadAddr, a.first.loadAddr, 'B gets A\'s HMODULE, not a second copy');
    assert.equal(b.got.existing, true, 'B is told the module was already loaded');
    assert.equal(b.got.dllMain, 0, 'B runs no DllMain of its own');
    assert.equal(b.got.afterInit, true, 'B returns only after A\'s DLL_PROCESS_ATTACH finished');
    assert.equal(a.again.loadAddr, a.first.loadAddr, 'A asking again from inside its DllMain gets the same module');
    // A must reach the barrier before it can initialize; a self-wait therefore
    // fails through the native loader's wait failure, without a speed threshold.
    assert.equal(a.again.existing, true);
    for (const result of [a, b]) {
      assert.ok(!result.namesDuring.includes('x.dll'), 'INITIALIZING row is excluded from ready module names');
      assert.ok(result.namesAfter.includes('x.dll'), 'TRUE DllMain publishes the ready module name');
    }
    // The guest-side LoadLibraryA (the handler's loaded-module fast path).
    assert.ok(b.guestDuringBeforeInit, 'B\'s guest LoadLibraryA ran inside A\'s initializer');
    assert.deepEqual(b.guestDuring, { parked: true }, 'B\'s LoadLibraryA parks while A\'s DllMain runs');
    assert.deepEqual(b.guestAfter, { parked: false, eax: a.first.loadAddr }, 'and returns A\'s module after it');
    assert.deepEqual(a.guestSelf, { parked: false, eax: a.first.loadAddr }, 'A\'s own LoadLibraryA from its DllMain does not park');
    assert.notEqual(a.other.loadAddr, a.first.loadAddr, 'a different path is a different module');
    assert.equal(a.other.existing, false);
    assert.equal(a.dllCount, 2, 'x.dll mapped once, y.dll once');

    // A executed the actual PE entry point and validated TRUE completion.
    // FALSE/faulting completion belongs to test-dllmain-completion.js.
    console.log('PASS test-dll-same-module-concurrent');
  })().catch(error => { console.error(error); process.exit(1); });
}
