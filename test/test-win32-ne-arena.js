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
(func $host_log_i32 (param i32) (unreachable))
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
