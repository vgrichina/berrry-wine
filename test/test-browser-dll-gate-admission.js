'use strict';
// Actual browser host methods + production scheduler/loader + interpreted PEs.
// No DOM/rendering/gameplay claim; uses the ordinary prebuilt module.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const boot = require(path.join(root, 'lib/process-boot'));
const loader = require(path.join(root, 'lib/dll-loader'));
const { ThreadManager } = require(path.join(root, 'lib/thread-manager'));
const { createHostImports } = require(path.join(root, 'lib/host-imports'));
function browserClass(processBoot = boot) {
  const context = vm.createContext({ window: { processBoot }, require: name => require(path.resolve(root, name)),
    console, setTimeout, clearTimeout, performance, URLSearchParams });
  const source = fs.readFileSync(process.env.WA_TEST_HOST || path.join(root, 'host.js'), 'utf8');
  vm.runInContext(source + '\n globalThis.TestHost = WineAssembly;', context, { filename: 'host.js' });
  return context.TestHost;
}
'use strict';
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const M = 0x403000;
function image(code, dll, imports, strings = {}) {
  const b = Buffer.alloc(0x2400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(dll ? 0x210e : 0x010e, p + 22); b.writeUInt16LE(0x10b, o);
  b.writeUInt32LE(0x1000, o + 16); b.writeUInt32LE(dll ? 0x10000000 : 0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x4000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x3000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x2200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  Buffer.from(code).copy(b, 0x200);
  if (imports.length) {
    b.writeUInt32LE(0x2000, o + 104); b.writeUInt32LE(40, o + 108);
    b.writeUInt32LE(0x2100, 0x1200); b.writeUInt32LE(0x2200, 0x120c); b.writeUInt32LE(0x2100, 0x1210);
    b.write('kernel32.dll\0', 0x1400);
    imports.forEach((name, i) => {
      const rva = 0x2240 + i * 64;
      b.writeUInt32LE(rva, 0x1300 + i * 4); b.write(name + '\0', rva - 0x1000 + 0x200 + 2);
    });
  }
  for (const [rva, value] of Object.entries(strings)) b.write(value + '\0', Number(rva) - 0x1000 + 0x200);
  return b;
}
function assembler() {
  const code = [], labels = {}, fixups = [];
  return {
    code, emit(...bytes) { code.push(...bytes); },
    label(name) { labels[name] = code.length; },
    branch(op, name) { code.push(...op); fixups.push([code.length, name]); code.push(0, 0, 0, 0); },
    done() { const b = Buffer.from(code); for (const [off, label] of fixups) b.writeInt32LE(labels[label] - off - 4, off); return b; },
  };
}


function fixture(mode) {
  const ordinary = mode === 'ordinary', faultOwner = mode === 'fault';
  const a = assembler(), emit = (...b) => a.emit(...b);
  // Load the real DLL, spawn a real cooperative thread, wait for its attach,
  // then request FreeLibrary while that callback still owns the gate.
  emit(0x68, ...u32(0x402600), 0xff, 0x15, ...u32(0x402100), 0xa3, ...u32(M + 20));
  for (const n of [0, 0, 0, 0x401200, 0, 0]) emit(0x68, ...u32(n));
  emit(0xff, 0x15, ...u32(0x402104), 0xa3, ...u32(M + 24));
  a.label('wait'); emit(0x83, 0x3d, ...u32(M + (ordinary ? 12 : 0)), 0); a.branch([0x0f, 0x84], 'wait');
  emit(0xff, 0x35, ...u32(M + 20), 0xff, 0x15, ...u32(0x402108), 0xa3, ...u32(M + 16));
  a.label('done'); emit(0xeb, 0xfe);
  const exe = image(a.done(), false, ['LoadLibraryA', 'CreateThread', 'FreeLibrary', 'ExitThread'], { 0x2600: 'owner.dll' });
  // Thread body uses the production ExitThread import, after its attach.
  Buffer.from([0xc7, 0x05, ...u32(M + 12), 1, 0, 0, 0, 0x6a, 77, 0xff, 0x15, ...u32(0x40210c)]).copy(exe, 0x400);
  const d = assembler();
  d.emit(0x53, 0x8b, 0x5c, 0x24, 8, 0x83, 0x7c, 0x24, 12, 2); d.branch([0x0f, 0x85], 'other');
  d.emit(0xc7, 0x05, ...u32(M), 1, 0, 0, 0);
  d.emit(0xff, 0x93, ...u32(0x2100), 0xa3, ...u32(M + 28)); // real owning thread id
  d.emit(0x8d, 0x83, ...u32(0x2600), 0x50, 0xff, 0x93, ...u32(0x2104), 0xa3, ...u32(M + 32));
  d.emit(0x50, 0xff, 0x93, ...u32(0x2108), 0xb9, ...u32(50000)); // nested owner load/unload
  if (mode === 'sleep') d.emit(0x6a, 80, 0xff, 0x93, ...u32(0x210c));
  d.label('loop'); d.emit(0x49); d.branch([0x0f, 0x85], 'loop');
  if (faultOwner) d.emit(0x0f, 0x0b); // real guest fault, retired by runSlice
  d.emit(0xc7, 0x05, ...u32(M + 4), 1, 0, 0, 0); d.branch([0xe9], 'return');
  d.label('other'); d.emit(0x83, 0x7c, 0x24, 12, 0); d.branch([0x0f, 0x85], 'return');
  // PROCESS_DETACH observes whether THREAD_ATTACH really finished first.
  d.emit(0xa1, ...u32(M + 4), 0xa3, ...u32(M + 8));
  d.label('return'); d.emit(0x5b, 0xb8, 1, 0, 0, 0, 0xc2, 12, 0);
  return { exe, files: new Map([
    ['owner.dll', image(d.done(), true, ['GetCurrentThreadId', 'LoadLibraryA', 'FreeLibrary', 'Sleep'], { 0x2600: 'nested.dll' })],
    ['nested.dll', image([0xb8, 1, 0, 0, 0, 0xc2, 12, 0], true, [])],
  ]) };
}

async function interpreted(mode) {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM || path.join(root, 'build/wine-assembly.wasm')));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const { exe, files } = fixture(mode);
  let manager;
  const makeImports = () => {
    const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
    const imports = createHostImports(ctx); imports.host.memory = memory;
    imports.host.has_dll_file = () => 1;
    imports.host.create_thread = (...args) => manager.createThread(...args);
    imports.host.exit_thread = code => manager.exitThread(code);
    imports.__setInstance = instance => { ctx.exports = instance.exports; };
    return imports;
  };
  const imports = makeImports(), instance = await WebAssembly.instantiate(module, imports);
  imports.__setInstance(instance);
  const e = instance.exports;
  new Uint8Array(memory.buffer, e.get_staging(), exe.length).set(exe); e.load_pe(exe.length);
  manager = new ThreadManager(module, memory, instance, makeImports);
  manager._log = () => {};
  manager._serviceDllYield = exports => boot.serviceLoadLibraryYieldSync({ exports, memoryBuffer: memory.buffer,
    findDllSync: name => files.get(name.toLowerCase()) || null });
  const Host = browserClass(), host = Object.create(Host.prototype);
  Object.assign(host, { instance, memory, threadManager: manager, running: true, stepsPerSlice: 1000, moduleMap: [],
    _findDllBytes: async name => files.get(name.toLowerCase()) || null,
    _findDllBytesSync: name => files.get(name.toLowerCase()) || null,
    _advanceGuestTickMs() { throw Error('admission must not manufacture guest time'); },
  });
  let contention = null, mainSlices = 0, advanceCalls = 0, trueWaits = 0;
  const original = manager.runDllCallbackOwnerSlice.bind(manager);
  manager.runDllCallbackOwnerSlice = (owner, budget) => {
    advanceCalls++;
    assert.equal(owner, 2, 'only actual gate owner is advanced');
    const stats = original(owner, budget);
    if (!stats || !stats.threadsRun) trueWaits++;
    return stats;
  };
  const read = i => e.guest_read32(M + i * 4) >>> 0;
  for (let turn = 0; turn < 250 && !read(4); turn++) {
    e.run(1000); mainSlices++;
    const y = e.get_yield_reason();
    if (y === 5) {
      const gate = Array.from(new Int32Array(memory.buffer, e.get_dll_callback_lock(), 2));
      if (gate[0] === 2) {
        const t = [...manager.threads.values()].find(t => t.instance?.exports.get_dll_callback_owner() === 2);
        assert(t && t.state === 'active' && t._dllAttachOperation && !t._dllAttachNotified);
        contention = { gate, caller: e.get_dll_callback_owner(), yield: y, mainSlices,
          eip: e.get_eip() >>> 0, attachFinished: read(1), threadState: t.state };
        console.log('CONTENTION ' + JSON.stringify(contention));
      }
      const saved = [e.get_eip(), e.get_esp(), e.get_eax(), e.get_yield_reason()];
      let timer;
      try {
        await Promise.race([host.handleLoadLibrary(), new Promise((_, reject) => {
          timer = setTimeout(() => {
            assert.deepEqual([e.get_eip(), e.get_esp(), e.get_eax(), e.get_yield_reason()], saved);
            assert.deepEqual(Array.from(new Int32Array(memory.buffer, e.get_dll_callback_lock(), 2)), [2, 1]);
            reject(Error('browser main awaiting gate owner 2 before cooperative scheduler'));
          }, 1800);
        })]);
      } finally { clearTimeout(timer); }
    }
    manager.spawnPending();
    manager.runSlice(1000);
    await host.handleCooperativeThreadLoadLibraries();
  }
  const result = Array.from({ length: 9 }, (_, i) => read(i));
  assert.deepEqual(result.slice(0, 5), mode === 'fault' ? [1, 0, 0, 0, 1] : [1, 1, 1, 1, 1]);
  assert(result[5] && result[6]); assert.equal(result[7], 2); assert(result[8]);
  assert.deepEqual(Array.from(new Int32Array(memory.buffer, e.get_dll_callback_lock(), 2)), [0, 0]);
  if (mode === 'ordinary') { assert.equal(contention, null); assert.equal(advanceCalls, 0); }
  else { assert(contention); assert(advanceCalls > 1, 'callback spans multiple real scheduler quanta'); }
  if (mode === 'sleep') assert(trueWaits > 0, 'real sleeping callback must remain a true wait');
  if (mode === 'fault') {
    const index = e.get_dll_index(result[5]); assert(index >= 0);
    const pins = new DataView(memory.buffer).getUint32(e.get_dll_lifecycle_table() + index * e.get_dll_lifecycle_stride() + 12, true);
    assert(pins > 0, 'faulted callback retains quarantine mapping pin');
  }
  console.log('PASS browser admission ' + JSON.stringify({ mode, mainSlices, advanceCalls, trueWaits, contention, result }));
}
if (require.main === module) (async () => {
  for (const mode of process.argv[2] ? [process.argv[2]] : ['contended', 'ordinary', 'sleep', 'fault'])
    await interpreted(mode);
})().catch(error => {
  console.error(error); process.exit(1);
});
module.exports = { browserClass, interpreted };
