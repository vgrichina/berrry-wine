#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { bootRenderHarness } = require('./render-helper');
const ITERATIONS = 128;

function wrappers() {
  const apis = { create: ['HeapCreate', 3], destroy: ['HeapDestroy', 1], alloc: ['HeapAlloc', 3],
    free: ['HeapFree', 3], realloc: ['HeapReAlloc', 4], size: ['HeapSize', 3], validate: ['HeapValidate', 3],
    virtualAlloc: ['VirtualAlloc', 4], initialize: ['InitializeCriticalSection', 1] };
  return Object.entries(apis).map(([name, [api, count]]) => `
  (func (export "probe_${name}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_${api} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.add (local.get $esp) (i32.const ${(count + 1) * 4}))) (then (unreachable)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load (global.get $reg_base)))`).join('\n') + `
  (func (export "probe_read") (param $p i32) (result i32) (call $gl32 (local.get $p)))
  (func (export "probe_write") (param $p i32) (param $v i32) (call $gs32 (local.get $p) (local.get $v)))
  (func (export "probe_read8") (param $p i32) (result i32) (call $gl8 (local.get $p)))
  (func (export "probe_write16") (param $p i32) (param $v i32) (call $gs16 (local.get $p) (local.get $v)))
  (func (export "probe_raw") (param $p i32) (result i32) (call $g2w (local.get $p)))
  (func (export "probe_error") (result i32) (global.get $last_error))
`;
}
const create = e => e.probe_create(0x04000000, 4096, 0, 0) >>> 0;
function loadImage(h) {
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(h.memory.buffer).set(image, h.exports.get_staging());
  h.exports.load_pe(image.length);
}
function increments(h, ptr, tid = 0) {
  const e = h.exports, base = e.get_image_base();
  const code = base + 0x100000 + tid * 0x1000;
  const stack = base + 0xd00000 + tid * 0x1000;
  const wa = ga => require('../lib/region-map.generated').g2w(ga, base);
  const le = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24];
  // mov ecx,ITERATIONS; lock inc dword [ptr]; loop -9; ret. The lock crosses a
  // qword boundary when ptr+6 is supplied; the authority still owns one CAS.
  new Uint8Array(h.memory.buffer).set([0xb9, ...le(ITERATIONS), 0xf0, 0xff, 0x05, ...le(ptr), 0xe2, 0xf7, 0xc3], wa(code));
  new DataView(h.memory.buffer).setUint32(wa(stack), 0, true);
  e.set_lock_atomic_mode(0);
  e.set_esp(stack); e.set_eip(code); e.run(100000);
  assert.equal(e.get_eip(), 0, 'actual x86 LOCK code returns');
}
async function peer(module, memory, tid, heap, ptr, privateHeap, init, beforeIncrements) {
  const h = await bootRenderHarness({ prebuiltModule: module, memory, fonts: 'none' });
  const e = h.exports;
  if (!tid) loadImage(h);
  if (tid) e.init_thread(tid, ...init);
  assert.equal(create(e), heap);
  assert.equal(e.probe_read(ptr) >>> 0, 0xdeadbeef);
  e.probe_write(ptr + 4, 0xfedcba98);
  assert.equal(e.probe_alloc(privateHeap, 0, 8, 0) === 0, !tid, 'ordinary heaps stay process private');
  const owned = e.probe_alloc(heap, 8, 24, 0) >>> 0;
  assert(owned);
  e.probe_write(owned, 0x1234abcd);
  if (beforeIncrements) await beforeIncrements();
  increments(h, ptr + 22, tid);
  return { owned };
}
async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-shared-heap-test-'));
  try {
    const bytes = require('./compile-src').compileSrcWasm((name, text) => name === '13-exports.wat' ? text + wrappers() : text);
    const file = path.join(tmp, 'probe.wasm'); fs.writeFileSync(file, bytes);
    const module = await WebAssembly.compile(bytes);
    const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none' });
    const e = h.exports;
    loadImage(h);
    const heap = create(e);
    assert(heap);
    assert.equal(create(e), heap, 'HEAP_SHARED returns the authority heap');
    const privateHeap = e.probe_create(0, 4096, 0, 0) >>> 0;
    assert(privateHeap && privateHeap !== heap);
    const ptr = e.probe_alloc(heap, 8, 32, 0) >>> 0;
    assert(ptr);
    for (let i = 0; i < 32; i++) assert.equal(e.probe_read8(ptr + i), 0);
    e.probe_write(ptr, 0xdeadbeef);
    e.probe_write16(ptr + 9, 0xabcd);
    assert.equal(e.probe_read8(ptr + 9), 0xcd);
    assert.equal(e.probe_read8(ptr + 10), 0xab);
    assert.equal(e.probe_size(heap, 0, ptr, 0), 32);
    assert.equal(e.probe_validate(heap, 0, ptr, 0), 1);
    assert.equal(e.probe_validate(heap, 2, ptr, 0), 0);
    assert.equal(e.probe_free(privateHeap, 0, ptr, 0), 0, 'private free cannot adopt shared bytes');
    assert.equal(e.probe_size(privateHeap, 0, ptr, 0), -1);
    assert.equal(e.probe_realloc(privateHeap, 0, ptr, 64), 0, 'private realloc cannot adopt shared bytes');
    assert.equal(e.probe_error(), 87);
    assert.equal(e.probe_virtualAlloc(ptr, 4096, 0x3000, 4), 0, 'VirtualAlloc cannot alias system bytes');
    assert.equal(e.probe_error(), 487);
    assert.equal(e.probe_alloc(heap, 4, 8, 0), 0, 'unsupported exception flags fail explicitly');
    assert.equal(e.probe_error(), 50);
    const cs = e.probe_alloc(heap, 8, 24, 0) >>> 0;
    e.probe_initialize(cs, 0, 0, 0);
    assert.deepEqual(Array.from({ length: 6 }, (_, i) => e.probe_read(cs + i * 4)), [0, -1, 0, 0, 0, 0]);
    assert.equal(e.probe_free(heap, 0, cs, 0), 1);
    assert.throws(() => e.probe_raw(ptr), /ESHAREDHEAP_LINEAR_ACCESS/);
    const init = ['get_image_base', 'get_code_start', 'get_code_end', 'get_thunk_base', 'get_thunk_end', 'get_num_thunks', 'get_rsrc_rva'].map(name => e[name]());
    const thread = new Worker(__filename, { workerData: { module, memory: h.memory, heap, ptr, privateHeap, init } });
    const threadResult = await new Promise((resolve, reject) => {
      thread.once('message', resolve); thread.once('error', reject);
      thread.once('exit', code => { if (code) reject(new Error(`worker exit ${code}`)); });
    });
    await new Promise(resolve => thread.threadId === -1 ? resolve() : thread.once('exit', resolve));
    assert.equal(e.probe_read(ptr + 4) >>> 0, 0xfedcba98);
    assert.equal(e.probe_read(threadResult.owned) >>> 0, 0x1234abcd, 'allocation survives real Worker exit');
    // The child uses a new WASM memory in a separate native process. Only the
    // authority endpoint crosses the process boundary, never allocation bytes.
    const child = fork(__filename, ['--peer', file, String(heap), String(ptr), String(privateHeap)], {
      env: require('../lib/thread-manager').ThreadManager.namedEventEnvironment(), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let out = '', err = '', childResult;
    child.stdout.on('data', x => out += x); child.stderr.on('data', x => err += x);
    const ready = new Promise((resolve, reject) => {
      child.on('message', x => { if (x.ready) resolve(); else childResult = x; });
      child.once('error', reject);
      child.once('exit', code => { if (code) reject(new Error('child before ready: ' + code)); });
    });
    await ready;
    // Child startup is complete before both CPUs begin their locked loops.
    child.send({ go: true });
    increments(h, ptr + 22);
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`child ${code}: ${out}\n${err}`)));
    });
    assert(childResult);
    assert.equal(e.probe_read(ptr + 22), ITERATIONS * 3, 'main/Worker/process LOCK operations conserve count');
    assert.equal(e.probe_read(childResult.owned) >>> 0, 0x1234abcd, 'allocation survives creator process exit');
    assert.equal(e.probe_destroy(heap, 0, 0, 0), 1);
    assert.equal(e.probe_read(ptr) >>> 0, 0xdeadbeef, 'HeapDestroy cannot retire the system heap');
    const grown = e.probe_realloc(heap, 8, ptr, 80) >>> 0;
    assert(grown && grown !== ptr);
    assert.equal(e.probe_read(grown) >>> 0, 0xdeadbeef);
    for (let i = 32; i < 80; i++) assert.equal(e.probe_read8(grown + i), 0);
    assert.equal(e.probe_realloc(heap, 16, grown, 1024), 0);
    assert.equal(e.probe_size(heap, 0, grown, 0), 80, 'failed realloc retains the original');
    assert.equal(e.probe_alloc(heap, 0, 0xffffffff, 0), 0);
    assert.equal(e.probe_free(heap, 0, grown, 0), 1);
    assert.equal(e.probe_free(heap, 0, grown, 0), 0, 'double free fails');
    assert.equal(e.probe_size(heap, 0, grown, 0), -1);
    assert.throws(() => e.probe_read(grown), /ESHAREDHEAP_ACCESS/);
    const stale = (heap ^ 1) >>> 0;
    assert.equal(e.probe_alloc(stale, 0, 8, 0), 0, 'tag alone cannot authorize a heap');
    assert.equal(e.probe_error(), 6);
    assert.equal(e.probe_destroy(stale, 0, 0, 0), 0);
    assert.equal(e.probe_free(heap, 0, privateHeap, 0), 0, 'private allocation is not in the authority');
    for (const p of [threadResult.owned, childResult.owned]) assert.equal(e.probe_free(heap, 0, p, 0), 1);
    const whole = e.probe_alloc(heap, 0, 0x01000000, 0) >>> 0;
    assert(whole, 'coalescing and freed tail restore the full system arena');
    assert.equal(e.probe_alloc(heap, 0, 1, 0), 0, 'capacity exhaustion cannot wrap or escape authority');
    assert.equal(e.probe_free(heap, 0, whole, 0), 1);
    const small = e.probe_alloc(heap, 0, 10, 0) >>> 0;
    e.probe_write16(small + 10, 0xabcd);
    assert.equal(e.probe_realloc(heap, 24, small, 16) >>> 0, small);
    assert.equal(e.probe_read8(small + 10), 0, 'in-place zero growth clears former padding');
    assert.equal(e.probe_size(heap, 0, small, 0), 16);
    assert.equal(e.probe_free(heap, 0, small, 0), 1);
    assert.throws(() => e.probe_write(small, 0), /ESHAREDHEAP_ACCESS/, 'freed stores cannot create a private alias');
    assert.equal(e.probe_destroy(privateHeap, 0, 0, 0), 1);
    // Run the browser script without CommonJS or Node globals, using the same
    // host imports and two genuinely separate process memories.
    const browser = { crypto: require('node:crypto').webcrypto };
    require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/shared-heap.js'), 'utf8'), browser);
    const browserBoot = () => bootRenderHarness({ prebuiltModule: module, fonts: 'none',
      beforeInstantiate: ctx => { ctx.sharedHeapOperation = browser.SharedHeapAuthority.systemOperation; } });
    const pageA = (await browserBoot()).exports, pageB = (await browserBoot()).exports;
    const pageHeap = create(pageA);
    assert.equal(create(pageB), pageHeap);
    const pagePtr = pageA.probe_alloc(pageHeap, 8, 16, 0) >>> 0;
    pageB.probe_write(pagePtr, 0xffffffff);
    assert.equal(pageA.probe_read(pagePtr), -1);
    assert.equal(pageB.probe_free(pageHeap, 0, pagePtr, 0), 1);
    console.log('PASS shared heap: public stdcall APIs, real Worker/process, x86 LOCK, exit lifetime, stale handles, capacity/realloc, browser authority and explicit linear-access boundary');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
const watchdog = setTimeout(() => { console.error('shared heap test deadline'); process.exit(124); }, 90000);
(async () => {
  if (!isMainThread) {
    parentPort.postMessage(await peer(workerData.module, workerData.memory, 1, workerData.heap, workerData.ptr, workerData.privateHeap, workerData.init));
    parentPort.close();
  } else if (process.argv[2] === '--peer') {
    const [, , , file, heap, ptr, privateHeap] = process.argv;
    const result = await peer(await WebAssembly.compile(fs.readFileSync(file)), null, 0, +heap, +ptr, +privateHeap, null, () =>
      new Promise(resolve => { process.once('message', msg => { assert(msg.go); resolve(); }); process.send({ ready: true }); }));
    process.send(result); process.disconnect();
  } else await main();
})().then(() => clearTimeout(watchdog), error => { clearTimeout(watchdog); console.error(error); process.exitCode = 1; });
