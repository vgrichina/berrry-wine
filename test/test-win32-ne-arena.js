'use strict';
// Actual arena/publication/metadata and affine-span helpers; allocator behavior
// is controlled here. A native real-allocator fixture remains an activation gate.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { compileClosure } = require('../tools/watx-closure');
const root = path.join(__dirname, '..');
const RegionMap = require('../lib/region-map.generated');
const all = fs.readdirSync(path.join(root, 'src')).filter(n => n.endsWith('.wat'))
  .map(n => fs.readFileSync(path.join(root, 'src', n), 'utf8')).join('\n');
function form(name) {
  const start = all.indexOf('(func $' + name + ' ');
  assert(start >= 0, name);
  let depth = 0, comment = false, quoted = false;
  for (let i = start; i < all.length; i++) {
    const c = all[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (quoted) { if (c === '\\') i++; else if (c === '"') quoted = false; continue; }
    if (c === ';' && all[i + 1] === ';') { comment = true; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '(') depth++;
    if (c === ')' && !--depth) return all.slice(start, i + 1);
  }
  throw Error(name);
}
const names = ['win16_arena_base', 'win16_process_arena_ensure', 'win16_process_arena_release',
  'win16_arena_slot_base', 'win16_task_shared', 'win16_dll_rec', 'win16_dll_refs_ptr',
  'g2w_affine_span', 'zero_memory', 'lock_owner_id', 'lock_acquire', 'lock_release'];
let source = names.map(form).join('\n').replaceAll('(region.addr $WIN16_PROCESS_ARENA 0)', '(i32.const 256)')
  .replaceAll('(region.addr $WIN16_PROCESS_ARENA 4)', '(i32.const 260)')
  .replaceAll('(region.addr $D3DIM_LAZY_SHARED 4)', '(i32.const 272)')
  .replaceAll('(region.end $DIRECT_WINDOW)', '(i32.const 1048576)');
const globals = { WIN16_ARENA: 0x100000, WIN16_SEG_MAX: 943, DLL_LOAD_LOCK: 512,
  image_base: 0x400000, GUEST_BASE: RegionMap.BASE.GUEST_BASE, NULL_SENTINEL: 0xf0,
  DIB_GUEST_BASE: 0x50000000, DIB_GUEST_CAPACITY: 0x10000, DIB_BACKING_BASE: 0x80000,
  host_shadow: 0, uwc_on: 0 };
source = `
(import "host" "memory" (memory 1024 1024 shared))
(import "host" "current_thread_id" (global $current_thread_id i32))
(import "host" "is_win16" (global $is_win16 i32))
(import "host" "reserve" (func $virtual_reserve_place (param i32 i32 i32) (result i32)))
(import "host" "commit" (func $virtual_map_commit_protect (param i32 i32 i32) (result i32)))
(import "host" "release" (func $virtual_map_release (param i32) (result i32)))
(import "host" "affine" (func $guest_page_affine_span (param i32 i32) (result i32)))
(import "host" "translate" (func $g2w (param i32) (result i32)))
(import "host" "watch" (func $page_watch_write (param i32 i32)))
(func $host_log_i32 (param i32) (nop))
(func $d3dim_lazy_access (param i32 i32) (unreachable))
(func $uwc_bulk_note (param i32 i32) (unreachable))
${Object.entries(globals).map(([n,v]) => `(global $${n} i32 (i32.const ${v}))`).join('\n')}
${source}
${names.filter(n => !n.startsWith('win16_process_')).map(n => `(export "${n}" (func $${n}))`).join('\n')}`;
const compiled = compileClosure({ source, vfs: new Map() }, { tailCalls: true });
assert(compiled.success, compiled.error);
const moduleUnderTest = new WebAssembly.Module(compiled.wasmBinary);
const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024, shared: true });
const bytes = new Uint8Array(memory.buffer), words = new Int32Array(memory.buffer);
const BASE = 0x30000000, BACKING = 0x100000, SIZE = 944 * 65536;
let mode = 'ok', reserved = false, committed = false, allocations = 0, releases = 0;
let observer;
const unpublished = () => {
  assert.equal(Atomics.load(words, 256 / 4), 0, 'no partial publication');
  if (observer) assert.equal(observer.win16_arena_base(), globals.WIN16_ARENA);
};
function instance(id, pure = 0) {
  return new WebAssembly.Instance(moduleUnderTest, { host: {
    memory, current_thread_id: id, is_win16: pure,
    reserve(size, down, protect) {
      unpublished(); assert.equal(size, SIZE); assert.equal(down, 0); assert.equal(protect, 4);
      assert.equal(Atomics.load(words, 512 / 4), id, 'publication lock held');
      allocations++; if (mode === 'reserve-fail') return 0;
      assert(!reserved); reserved = true; return BASE;
    },
    commit(base, size) {
      unpublished(); assert(reserved); assert.equal(base, BASE); assert.equal(size, SIZE);
      if (mode === 'commit-fail' || mode === 'rollback-fail') return 0;
      committed = true; bytes.fill(0x81, BACKING, BACKING + SIZE);
      return mode === 'partial-fail' ? 0 : BASE;
    },
    release(base) { assert.equal(base, BASE); assert(reserved); releases++; if (mode === 'release-fail' || mode === 'rollback-fail') return 0; reserved = committed = false; return 1; },
    affine(base, size) {
      unpublished(); assert.equal(base, BASE); assert.equal(size, SIZE); assert(committed);
      return mode === 'non-affine' ? globals.NULL_SENTINEL : BACKING;
    },
    translate(ga) {
      if (ga >= BASE && ga < BASE + SIZE) { assert(committed); return BACKING + ga - BASE; }
      return ga - globals.image_base + globals.GUEST_BASE;
    },
    watch(wa, size) {
      unpublished(); assert.equal(wa, BACKING); assert.equal(size, SIZE);
      assert.equal(bytes[BACKING], 0); assert.equal(bytes[BACKING + SIZE - 1], 0);
    },
  } }).exports;
}
const first = instance(1), second = instance(2); observer = second;
bytes.fill(0x5a, globals.GUEST_BASE, globals.GUEST_BASE + 4096);
bytes[BACKING - 1] = 0xab; bytes[BACKING + SIZE] = 0xcd;
for (const failure of ['reserve-fail', 'commit-fail', 'partial-fail', 'non-affine']) {
  mode = failure; const before = releases;
  assert.equal(first.win16_process_arena_ensure(), 0, failure);
  assert.equal(releases, before + (failure !== 'reserve-fail' ? 1 : 0));
  assert(!reserved && !committed); unpublished(); assert.equal(Atomics.load(words, 128), 0);
}
mode = 'rollback-fail'; assert.equal(first.win16_process_arena_ensure(), 0);
assert(reserved); assert.equal(Atomics.load(words, 65), BASE); unpublished();
const pendingCount = allocations; assert.equal(second.win16_process_arena_ensure(), 0);
assert.equal(allocations, pendingCount, 'failed cleanup cannot allocate a second arena');
mode = 'ok'; assert.equal(first.win16_process_arena_ensure(), BASE);
assert.equal(Atomics.load(words, 65), 0, 'successful publication clears pending cleanup');
assert.equal(second.win16_arena_base(), BASE);
const count = allocations; assert.equal(second.win16_process_arena_ensure(), BASE); assert.equal(allocations, count);
assert.equal(second.win16_arena_slot_base(1), BASE);
assert.equal(second.win16_arena_slot_base(2), BASE + 65536);
assert.equal(second.win16_task_shared(0), BACKING + 943 * 65536 + 0xf000);
assert.equal(second.win16_dll_rec(3), BACKING + 943 * 65536 + 0x8030);
assert.equal(second.win16_dll_refs_ptr(3), BACKING + 943 * 65536 + 0x8a0c);
assert(bytes.subarray(globals.GUEST_BASE, globals.GUEST_BASE + 4096).every(v => v === 0x5a));
assert.equal(bytes[BACKING - 1], 0xab); assert.equal(bytes[BACKING + SIZE], 0xcd);
mode = 'release-fail'; assert.equal(second.win16_process_arena_release(), 0);
assert(reserved && committed); assert.equal(first.win16_arena_base(), BASE);
mode = 'ok'; assert.equal(second.win16_process_arena_release(), 1); assert(!reserved && !committed); unpublished();
assert.equal(first.win16_process_arena_ensure(), BASE, 'retry after whole-process release');
first.win16_process_arena_release();
const pure = instance(3, 1), before = allocations;
assert.equal(pure.win16_process_arena_ensure(), globals.WIN16_ARENA);
assert.equal(pure.win16_arena_slot_base(2), globals.WIN16_ARENA + 65536);
assert.equal(allocations, before, 'pure NE never invokes PE allocator');
// Every arena-dependent consumer must go through the shared accessor.
assert.equal((all.match(/\(global.get \$WIN16_ARENA\)/g) || []).length, 2);
console.log('PASS actual NE arena helpers: shared publication, PE canaries, rollback, non-affine rejection, metadata, reload and pure NE');

// Contend on the real shared DLL lock from two native JS Workers instantiating
// only the tiny module above. The first allocator pauses before commit, while
// the second enters ensure. No process image or emulator build is executed.
async function concurrentPublication() {
  const { Worker } = require('node:worker_threads');
  const shared = new WebAssembly.Memory({ initial: 1024, maximum: 1024, shared: true });
  const control = new Int32Array(new SharedArrayBuffer(16));
  const state = new Int32Array(shared.buffer);
  const workerSource = `
    const { parentPort, workerData: d } = require('node:worker_threads');
    const assert = require('node:assert/strict');
    const control = new Int32Array(d.control), state = new Int32Array(d.memory.buffer);
    const imports = {
      memory: d.memory, current_thread_id: d.id, is_win16: 0,
      reserve(size) {
        assert.equal(size, d.size); assert.equal(Atomics.load(state, 64), 0);
        Atomics.add(control, 0, 1); parentPort.postMessage('reserved');
        while (!Atomics.load(control, 1)) Atomics.wait(control, 1, 0);
        return d.base;
      },
      commit(base, size) {
        assert.equal(base, d.base); assert.equal(size, d.size);
        new Uint8Array(d.memory.buffer).fill(0x91, d.backing, d.backing + d.size);
        return base;
      },
      release() { throw Error('unexpected release'); },
      affine(base, size) { assert.equal(base, d.base); assert.equal(size, d.size); return d.backing; },
      translate(ga) { return d.backing + ga - d.base; },
      watch(wa, size) {
        assert.equal(Atomics.load(state, 64), 0, 'no publication before initialization');
        assert.equal(wa, d.backing); assert.equal(size, d.size);
        const bytes = new Uint8Array(d.memory.buffer);
        assert.equal(bytes[wa], 0); assert.equal(bytes[wa + size - 1], 0);
      },
    };
    const e = new WebAssembly.Instance(d.module, { host: imports }).exports;
    parentPort.once('message', () => {
      parentPort.postMessage('entered');
      const result = e.win16_process_arena_ensure();
      parentPort.postMessage({ result, metadata: e.win16_dll_rec(3) });
      parentPort.close();
    });
    parentPort.postMessage('ready');
  `;
  const workers = [], phases = [], results = [];
  let wake;
  const changed = () => { if (wake) { const f = wake; wake = null; f(); } };
  let failure;
  const fail = error => { failure = error; changed(); };
  const timer = setTimeout(() => fail(Error('concurrent tiny arena timeout: ' + JSON.stringify(phases))), 5000);
  async function until(predicate) {
    while (!predicate()) { if (failure) throw failure; await new Promise(resolve => { wake = resolve; }); }
    if (failure) throw failure;
  }
  try {
    for (let id = 1; id <= 2; id++) {
      const index = id - 1; phases[index] = [];
      const worker = new Worker(workerSource, { eval: true, workerData: {
        id, module: moduleUnderTest, memory: shared, control: control.buffer,
        base: BASE, backing: BACKING, size: SIZE,
      } });
      workers.push(worker);
      worker.on('message', event => {
        if (typeof event === 'string') phases[index].push(event);
        else { results[index] = event; phases[index].push('done'); }
        changed();
      });
      worker.on('error', fail);
      worker.on('exit', code => {
        phases[index].push('exit:' + code);
        if (code !== 0 || !results[index]) fail(Error('early Worker exit ' + id + ': ' + JSON.stringify(phases[index])));
        changed();
      });
    }
    await until(() => phases.every(p => p.includes('ready')));
    workers[0].postMessage('start');
    await until(() => phases[0].includes('reserved'));
    workers[1].postMessage('start');
    await until(() => phases[1].includes('entered'));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(Atomics.load(state, 128), 1, 'first initializer owns loader lock');
    assert.equal(Atomics.load(state, 64), 0, 'no usable arena published while commit is pending');
    assert.equal(Atomics.load(control, 0), 1, 'contender cannot reserve a second arena');
    assert.equal(results.filter(Boolean).length, 0);
    Atomics.store(control, 1, 1); Atomics.notify(control, 1);
    await until(() => phases.every(p => p.includes('exit:0')));
    assert.deepEqual(results, [1, 2].map(() => ({ result: BASE, metadata: BACKING + 943 * 65536 + 0x8030 })));
    assert.equal(Atomics.load(control, 0), 1);
    assert.equal(Atomics.load(state, 64), BASE);
    assert.equal(Atomics.load(state, 65), 0);
    assert.equal(Atomics.load(state, 128), 0);
    console.log('PASS concurrent tiny Workers: one reservation, atomic publication, shared metadata, clean exits');
  } finally {
    clearTimeout(timer);
    Atomics.store(control, 1, 1); Atomics.notify(control, 1);
    await Promise.all(workers.map(worker => worker.terminate()));
  }
}
concurrentPublication().catch(error => { console.error(error); process.exitCode = 1; });
