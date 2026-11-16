#!/usr/bin/env node
'use strict';

// Cost experiment ONLY. Both arms allocate/watch the same backing-page table;
// candidate adds scalar and bulk write checks and rejects watched uop store
// windows. Renderer comparisons stay enabled. Native/host write coverage,
// retirement, and independent cache consumers are NOT implemented here.
// Consequently these artifacts must not be used to skip texture comparisons.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { compileSrcWasm } = require('../test/compile-src');
// Archived pre-implementation experiment. Adding these synthetic hooks on top
// of production tracking would double-count its write cost and mislabel arms.
if (fs.existsSync(path.join(__dirname, '../src/03a-page-watch.wat'))) {
  throw new Error('Historical watch-cost prototype requires the pre-tracker source. bench-d3dim-gameplay.js went with lib/d3dim-gpu.js; tools/bench-lazy-games.js and tools/bench-mw3-readbacks.js read the WAT producer counters.');
}
const out = path.resolve(process.argv[2] || 'build/d3dim-watch-cost');
fs.mkdirSync(out, { recursive: true });
const extra = `
  (global $bench_watch_table (mut i32) (i32.const 0))
  (func $bench_watch_init (export "bench_watch_init")
    (if (global.get $bench_watch_table) (then (return)))
    ;; 2 GB backing / 4 KB * 4 bytes. Heap-owned experiment storage; does not
    ;; borrow staging memory while a real executable is running.
    (global.set $bench_watch_table (call $g2w (call $heap_alloc (i32.const 2097152))))
    (memory.fill (global.get $bench_watch_table) (i32.const 0) (i32.const 2097152)))
  (func $bench_watch_cell (param $wa i32) (result i32)
    (i32.add (global.get $bench_watch_table)
      (i32.shl (i32.shr_u (local.get $wa) (i32.const 12)) (i32.const 2))))
  (func (export "bench_watch_stamp") (param $wa i32) (result i32)
    (i32.atomic.load (call $bench_watch_cell (local.get $wa))))
  (func $bench_is_watched (param $wa i32) (result i32)
    (if (i32.eqz (global.get $bench_watch_table)) (then (return (i32.const 0))))
    (i32.and (i32.atomic.load (call $bench_watch_cell (local.get $wa))) (i32.const 1)))
  (func (export "bench_watch_range") (param $wa i32) (param $len i32)
    (local $end i32) (local $changed i32)
    (call $bench_watch_init)
    (if (i32.eqz (local.get $len)) (then (return)))
    (local.set $end (i32.add (local.get $wa) (i32.sub (local.get $len) (i32.const 1))))
    (local.set $wa (i32.and (local.get $wa) (i32.const -4096)))
    (loop $pages
      (if (i32.eqz (i32.and (i32.atomic.rmw.or
            (call $bench_watch_cell (local.get $wa)) (i32.const 1)) (i32.const 1)))
        (then (local.set $changed (i32.const 1))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 4096)))
      (br_if $pages (i32.le_u (local.get $wa) (local.get $end))))
    (if (local.get $changed) (then (call $uop_win_bump))))
  (func $bench_dirty_wa (param $wa i32)
    (if (call $bench_is_watched (local.get $wa))
      (then (drop (i32.atomic.rmw.add (call $bench_watch_cell (local.get $wa)) (i32.const 2))))))
  (func $bench_dirty_guest (param $ga i32) (param $len i32)
    (local $end i32)
    (if (i32.eqz (global.get $bench_watch_table)) (then (return)))
    (if (i32.eqz (local.get $len)) (then (return)))
    (local.set $end (i32.add (local.get $ga) (i32.sub (local.get $len) (i32.const 1))))
    (local.set $ga (i32.and (local.get $ga) (i32.const -4096)))
    (loop $pages
      (call $bench_dirty_wa (call $g2w (local.get $ga)))
      (local.set $ga (i32.add (local.get $ga) (i32.const 4096)))
      (br_if $pages (i32.le_u (local.get $ga) (local.get $end)))))
`;
const sources = new Map();
const artifacts = [];
// Freeze the source closure for both compiles, even in this shared worktree.
const { watxSourceClosure } = require('./watx-closure');
for (const [file, source] of watxSourceClosure().vfs) if (!file.includes('/')) sources.set(file, source);
for (const candidate of [false, true]) {
  const wasm = compileSrcWasm((file, source) => {
    source = sources.get(file) ?? source;
    if (file === '13-exports.wat') return source + extra;
    if (!candidate) return source;
    if (file === '03-registers.wat') {
      for (const [bits, width] of [[8, 1], [16, 2], [32, 4], [64, 8]]) {
        const start = source.indexOf(`  (func $gs${bits} `);
        const next = source.indexOf('\n  (func ', start + 1);
        assert(start >= 0 && next > start);
        let body = source.slice(start, next);
        const seam = body.match(/\(local.set \$wa \((?:call \$g2w|g2w-fast) \(local.get \$ga\)\)\)/)?.[0];
        assert(seam, `gs${bits} translation changed`);
        // Match the existing code-write filter's single-page fast path.
        body = body.replace(seam, seam + `
    (call $bench_dirty_wa (local.get $wa))
    ${width > 1 ? `(if (i32.gt_u (i32.and (local.get $ga) (i32.const 4095)) (i32.const ${4096 - width}))
      (then (call $bench_dirty_wa (call $g2w (i32.add (local.get $ga) (i32.const ${width - 1}))))))` : ''}`);
        source = source.slice(0, start) + body + source.slice(next);
      }
      const seam = '(func $invalidate_code_write (param $ga i32) (param $len i32)';
      assert(source.includes(seam));
      source = source.replace(seam, seam + '\n    (call $bench_dirty_guest (local.get $ga) (local.get $len))');
    }
    if (file === '07d-uop-engine.wat') {
      const start = source.indexOf('(func $uop_window_set ');
      const end = source.indexOf('\n  (func ', start + 1);
      assert(start >= 0 && end > start);
      let body = source.slice(start, end);
      const match = body.match(/\(call \$code_write_is_code \(local.get (\$\w+)\)\)/);
      assert(match, 'uop store-window guard changed');
      body = body.replace(match[0], `(i32.or ${match[0]}
        (call $bench_is_watched (call $g2w (local.get ${match[1]}))))`);
      source = source.slice(0, start) + body + source.slice(end);
    }
    return source;
  });
  const filename = path.join(out, candidate ? 'candidate.wasm' : 'control.wasm');
  fs.writeFileSync(filename, wasm);
  artifacts.push({ wasm, candidate });
  console.log(filename, wasm.length);
}

// Verify the probe really marks backing pages and preserves the guest store,
// including a cross-page DWORD. This does not certify missing write paths.
(async () => {
  const { createHostImports } = require('../lib/host-imports');
  for (const { wasm, candidate } of artifacts) {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 32768, shared: true });
    const ctx = { getMemory: () => memory.buffer, exports: null };
    const imports = createHostImports(ctx);
    imports.host.memory = memory;
    const { instance } = await WebAssembly.instantiate(wasm, imports);
    const e = ctx.exports = instance.exports;
    const ga = e.guest_section_reserve(12288) >>> 0;
    assert(ga && e.guest_section_commit(ga, 0, 12288, 4));
    const wa0 = e.guest_to_wasm(ga) >>> 0, wa1 = e.guest_to_wasm(ga + 4096) >>> 0;
    e.bench_watch_range(wa0, 4096);
    e.bench_watch_range(wa1, 4096);
    e.guest_write32(ga + 4094, 0x12345678);
    assert.strictEqual(e.guest_read32(ga + 4094), 0x12345678);
    for (const wa of [wa0, wa1]) assert(candidate ? e.bench_watch_stamp(wa) > 1 : e.bench_watch_stamp(wa) === 1);
    const wa2 = e.guest_to_wasm(ga + 8192) >>> 0;
    e.guest_write32(ga + 8192, 123);
    assert.strictEqual(e.bench_watch_stamp(wa2), 0, 'ordinary pages must stay untracked');
    console.log('PASS', candidate ? 'candidate' : 'control', 'watched crossing and ordinary page');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
