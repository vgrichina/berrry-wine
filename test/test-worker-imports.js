// What a worker thread inherits from its process, and what it must not.
//
// The two hosts build worker imports differently — the CLI from a free
// function, the browser from a method that closes over the page — so the only
// thing that can keep them agreeing is the shared list they both read. These
// checks are about that list: that process-scoped state crosses, that
// thread-scoped state does not, and that a missing thread primitive is loud
// rather than a wait that silently succeeds.

const assert = require('assert');
const {
  PROCESS_SHARED_KEYS,
  processSharedCtx,
  THREAD_PRIMITIVE_IMPORTS,
  adoptThreadPrimitives,
  makeWorkerApiLogger,
  workerApiShouldLog,
} = require('../lib/worker-imports');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

console.log('=== worker-imports ===');

check('the process-scoped half crosses into a worker', () => {
  const vfs = { files: new Map() };
  const wire = { id: 'wire' };
  const clock = () => 42;
  const closeSyncHandle = () => true;
  const worker = processSharedCtx({
    vfs, vlanWire: wire, guestNowMs: clock,
    sharedGdi: { bitmaps: 1 }, sharedAudio: { open: 0 },
    closeSyncHandle,
  });
  assert.strictEqual(worker.vfs, vfs, 'a worker must see main-thread file writes');
  assert.strictEqual(worker.vlanWire, wire, 'one wire per process, not per thread');
  assert.strictEqual(worker.guestNowMs, clock, 'threads cannot disagree about now');
  assert.strictEqual(worker.sharedAudio.open, 0);
  assert.strictEqual(worker.closeSyncHandle, closeSyncHandle,
    'worker CloseHandle must release the process synchronization object');
});

check('the thread-scoped half does not', () => {
  // instance/exports/threadId/memory are rebuilt per worker; copying them
  // would point every thread at the main instance.
  const worker = processSharedCtx({
    vfs: {}, instance: 'MAIN', exports: 'MAIN', threadId: 0, getMemory: () => null,
  });
  for (const key of ['instance', 'exports', 'threadId', 'getMemory']) {
    assert.ok(!(key in worker), `${key} is per-thread and must not be copied`);
  }
});

check('worker calendar APIs use the moving process calendar', () => {
  const { createHostImports } = require('../lib/host-imports');
  const memory = new ArrayBuffer(65536);
  let now = Date.UTC(1999, 5, 1, 12, 34, 56, 789);
  const mainCtx = { getMemory: () => memory, wallNowMs: () => now };
  const workerCtx = { ...processSharedCtx(mainCtx), getMemory: () => memory };
  const main = createHostImports(mainCtx).host;
  const worker = createHostImports(workerCtx).host;
  const bytes = new Uint8Array(memory);
  for (const advance of [0, 1234, 86400000]) {
    now += advance;
    for (const [kind, size] of [[0, 16], [1, 16], [2, 8], [3, 4]]) {
      assert.strictEqual(main.wall_clock(256, kind), 1);
      assert.strictEqual(worker.wall_clock(512, kind), 1);
      assert.deepStrictEqual([...bytes.subarray(512, 512 + size)],
        [...bytes.subarray(256, 256 + size)], `calendar kind ${kind}, advance ${advance}`);
    }
  }
  main.wall_clock(256, 0);
  assert.strictEqual(new DataView(memory).getUint16(256, true), 1999);
});

check('a guest thread kicks the process D3DIM ring consumer, not a second executor', () => {
  // Re-Volt's loader thread: main CREATEs the colour target, the thread's
  // first TARGETS names it. A per-thread bridge was a fresh executor that
  // had never seen the CREATE ("color target 11 was never created").
  const { createHostImports } = require('../lib/host-imports');
  const { makeProducer } = require('./gpu-stream-fixture');
  const GS = require('../lib/gpu-stream');
  const buffer = new SharedArrayBuffer(65536);
  const p = makeProducer({ buffer, ringBytes: 1024, arenaBytes: 1024 });
  const apiOff = GS.LAYOUTS.GpsRing.fields.find((f) => f.name === 'api').offset;
  new DataView(buffer).setUint32(64 + apiOff, GS.CONST.API_D3DIM, true);
  const memory = { buffer };
  const mainCtx = { getMemory: () => memory, d3dimBackend: 'null' };
  const main = createHostImports(mainCtx).host;
  const workerCtx = { ...processSharedCtx(mainCtx), getMemory: () => memory, d3dimBackend: 'null' };
  const worker = createHostImports(workerCtx).host;
  p.emit('CREATE', { id: 11, kind: 5, fmt: 15, levels: 1, width: 4, height: 4 });
  assert.strictEqual(main.gpu_stream_kick(64, 0), 1);
  assert.strictEqual(workerCtx.getD3dimBridge(), mainCtx.getD3dimBridge(),
    'the worker sees the process bridge before its own first kick');
  p.emit('TARGETS', { color: 11, depth: 0 });
  assert.strictEqual(worker.gpu_stream_kick(64, 0), 1);
  assert.strictEqual(workerCtx.getD3dimBridge(), mainCtx.getD3dimBridge(), 'one consumer per process');
});

check('a key the host does not have stays absent', () => {
  // The two hosts legitimately share different sets — the browser has a
  // sharedMixer because several apps play audio in one page, the CLI has
  // _waveStats because a test asserts on them. The list is what MAY cross.
  const cli = processSharedCtx({ vfs: {}, _waveStats: { open: 1 } });
  assert.ok(!('sharedMixer' in cli), 'absent stays absent, not undefined-valued');
  assert.strictEqual(cli._waveStats.open, 1);
  assert.deepStrictEqual(processSharedCtx(null), {}, 'no main context is empty, not a throw');
});

check('every documented key is one the list actually names', () => {
  assert.ok(PROCESS_SHARED_KEYS.includes('vfs'));
  assert.ok(PROCESS_SHARED_KEYS.includes('vlanWire'));
  assert.ok(PROCESS_SHARED_KEYS.includes('closeSyncHandle'));
  assert.strictEqual(new Set(PROCESS_SHARED_KEYS).size, PROCESS_SHARED_KEYS.length,
    'a duplicated key means two people added it without reading');
});

check('every declared thread primitive is adopted', () => {
  assert.ok(THREAD_PRIMITIVE_IMPORTS.includes('get_thread_priority'));
  assert.ok(THREAD_PRIMITIVE_IMPORTS.includes('set_thread_priority'));
  assert.ok(THREAD_PRIMITIVE_IMPORTS.includes('get_thread_locale'));
  assert.ok(THREAD_PRIMITIVE_IMPORTS.includes('set_thread_locale'));
  assert.ok(THREAD_PRIMITIVE_IMPORTS.includes('com_initialize_thread'));
  assert.ok(THREAD_PRIMITIVE_IMPORTS.includes('com_uninitialize_thread'));
  const main = {};
  for (const name of THREAD_PRIMITIVE_IMPORTS) main[name] = () => name;
  const worker = { wait_single: () => 0 };  // the stub host-imports installs
  adoptThreadPrimitives(worker, main);
  for (const name of THREAD_PRIMITIVE_IMPORTS) {
    assert.strictEqual(worker[name], main[name], `${name} still points at the stub`);
  }
  assert.strictEqual(worker.wait_single(), 'wait_single', 'the stub survived adoption');
});

check('a missing primitive throws instead of leaving a silent stub', () => {
  const main = {};
  for (const name of THREAD_PRIMITIVE_IMPORTS) main[name] = () => 0;
  delete main.wait_multiple;
  assert.throws(() => adoptThreadPrimitives({}, main), /wait_multiple/,
    'a guest that waits on nothing and continues is the failure this prevents');
});

check('the api logger shows a return only for a call it showed', () => {
  const mem = new WebAssembly.Memory({ initial: 1 });
  const bytes = new Uint8Array(mem.buffer);
  const write = (ptr, s) => {
    for (let i = 0; i < s.length; i++) bytes[ptr + i] = s.charCodeAt(i);
    bytes[ptr + s.length] = 0;
    return ptr;
  };
  write(0x100, 'CreateWindowExA');
  write(0x200, 'Sleep');

  const lines = [];
  const counted = [];
  const logger = makeWorkerApiLogger({
    getBuffer: () => mem.buffer,
    threadId: 3,
    onCall: (name) => counted.push(name),
    shouldLog: (name) => name === 'CreateWindowExA',
    emit: (line) => lines.push(line),
  });

  logger.log(0x100, 32);
  logger.log_i32(0x10004);
  logger.log(0x200, 32);
  logger.log_i32(0);

  assert.deepStrictEqual(lines, ['[API T3] CreateWindowExA', '  => 0x10004'],
    'the filtered call must take its return line with it');
  assert.deepStrictEqual(counted, ['CreateWindowExA', 'Sleep'],
    'every call is counted even when none is printed — the summary needs them');
});

check('the logger clamps a name to 256 bytes', () => {
  // len comes from the guest. A bad one must not read past the clamp.
  const mem = new WebAssembly.Memory({ initial: 1 });
  new Uint8Array(mem.buffer).fill(0x41, 0x100, 0x100 + 600);
  const lines = [];
  const logger = makeWorkerApiLogger({
    getBuffer: () => mem.buffer,
    threadId: 1,
    shouldLog: () => true,
    emit: (line) => lines.push(line),
  });
  logger.log(0x100, 600);
  assert.strictEqual(lines[0].length, '[API T1] '.length + 256);
});

check('a COM method on a worker is logged under its real name, not <ord>', () => {
  const mem = new WebAssembly.Memory({ initial: 1 });
  new Uint8Array(mem.buffer).set([0x3c, 0x6f, 0x72, 0x64, 0x3e, 0], 0x200); // "<ord>"
  const lines = [];
  const seen = [];
  const logger = makeWorkerApiLogger({
    getBuffer: () => mem.buffer,
    threadId: 1,
    resolveComName: (id) => (id === 1234 ? 'IDirectSoundBuffer_Lock' : null),
    onCall: (name) => seen.push(name),
    shouldLog: (name) => name === 'IDirectSoundBuffer_Lock',
    emit: (line) => lines.push(line),
  });
  logger.log_i32(0xC0DE0000 | 1234); // the dispatch marker is not a return value
  logger.log(0x200, 5);
  logger.log_i32(0);
  assert.deepStrictEqual(seen, ['IDirectSoundBuffer_Lock']);
  assert.deepStrictEqual(lines, ['[API T1] IDirectSoundBuffer_Lock', '  => 0x0']);
  // A marker resolves only the very next '<ord>'.
  logger.log(0x200, 5);
  assert.deepStrictEqual(seen, ['IDirectSoundBuffer_Lock', '<ord>']);
});

check('worker trace policy: a named filter logs under --quiet-api, a bare trace does not', () => {
  const filter = new Set(['IDirectSoundBuffer_Lock']);
  // --trace-api=NAMES --quiet-api: the named calls are what was asked for.
  assert.strictEqual(workerApiShouldLog({ traceApi: true, quietApi: true, filter }, 'IDirectSoundBuffer_Lock'), true);
  assert.strictEqual(workerApiShouldLog({ traceApi: true, quietApi: true, filter }, 'Sleep'), false);
  assert.strictEqual(workerApiShouldLog({ traceApi: true, quietApi: false, filter }, 'IDirectSoundBuffer_Lock'), true);
  // Bare --trace-api: everything, unless --quiet-api asks for silence.
  assert.strictEqual(workerApiShouldLog({ traceApi: true, quietApi: false, filter: null }, 'Sleep'), true);
  assert.strictEqual(workerApiShouldLog({ traceApi: true, quietApi: true, filter: null }, 'Sleep'), false);
  // No --trace-api at all: workers never log.
  assert.strictEqual(workerApiShouldLog({ traceApi: false, quietApi: false, filter }, 'IDirectSoundBuffer_Lock'), false);
});

console.log(failures === 0 ? '\nAll worker-imports checks passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
