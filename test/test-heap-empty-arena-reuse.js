'use strict';
// Exercise the production WASM closure, never a JS copy of its allocator.
// An explicit module path tests a pinned shipped artifact without rebuilding.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const regions = require(path.join(root, 'lib/region-map.generated'));
const sigs = require(path.join(root, 'lib/host-import-sigs.generated.json')).sigs;
const modulePath = process.argv[2] || null;
const expectOld = process.argv.includes('--expect-old');
const image = 0x400000;
const began = Date.now();
function bound() {
  assert(Date.now() - began < 180000, 'three-minute test bound');
}
(async () => {
  bound();
  const binary = modulePath ? fs.readFileSync(modulePath) : require('./compile-src').compileSrcWasm();
  const module = await WebAssembly.compile(binary);
  const report = {module: modulePath || 'production source closure', sha256: crypto.createHash('sha256').update(binary).digest('hex'), node: process.version, memoryBytes: 512 * 1024 * 1024};
  async function boot(sparse = false, withPeer = true) {
    const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
    const host = {memory}, oom = [];
    for (const [n, s] of Object.entries(sigs)) host[n] = s.results?.length ? () => 0 : () => {};
    host.heap_oom_trace = (size, reason) => { if (oom.length < 8) oom.push({size: size >>> 0, reason}); };
    const a = (await WebAssembly.instantiate(module, {host})).exports;
    a.init_thread(0, image, 0, 0, 0, 0, 0);
    a.heap_init(regions[sparse ? 'END' : 'BASE'].GUEST_HEAP_BASE - regions.GUEST_BASE + image);
    async function peer() {
      const b = (await WebAssembly.instantiate(module, {host})).exports;
      b.init_thread(1, image, 0, 0, 0, 0, 0);
      return b;
    }
    const b = withPeer ? await peer() : null;
    const view = new DataView(memory.buffer), bytes = new Uint8Array(memory.buffer);
    const wa = p => a.guest_to_wasm(p) >>> 0;
    const maps = () => view.getUint32(regions.BASE.VIRTUAL_MAP_STATE, true);
    const mark = (p, n, tag) => bytes.fill(tag, wa(p), wa(p) + n);
    const check = (p, n, tag) => assert(bytes.subarray(wa(p), wa(p) + n).every(v => v === tag), `contents 0x${p.toString(16)}`);
    function valid(e = a) {
      assert.strictEqual(e.d3d_render_free_list_diagnostic(0), 0, 'passive free-list validation');
      const base = regions.BASE.HEAP_ARENAS, count = view.getUint32(base, true);
      assert(count <= 1024);
      for (let i = 0; i < count; i++) {
        const rec = base + 16 + i * 16, lo = view.getUint32(rec, true);
        if (!lo) continue;
        const high = view.getUint32(rec + 8, true), end = view.getUint32(rec + 4, true);
        assert(lo <= high && high <= end);
        for (let g = lo; g < high;) {
          const n = view.getUint32(wa(g), true);
          assert(n >= 16 && !(n & 7) && g + n <= high, 'surviving carved header');
          g += n;
        }
        if (lo >= 0x10000000) assert(wa(lo) >= regions.BASE.VIRTUAL_BACKING_BASE && wa(end - 1) < regions.END.VIRTUAL_BACKING_BASE, 'mapping survives reuse');
      }
    }
    return {a, b, peer, memory, view, bytes, wa, maps, mark, check, valid, oom};
  }
  // Exact probe sequence, with no getters that flush bins during the sequence.
  {
    const h = await boot(false, false); let completed = 0, failed = null;
    outer: for (const [phase, limit] of [['constant', 2000], ['ascending', 100000]]) {
      for (let i = 0; i < limit; i++) {
        if (!(i % 1024)) bound();
        const n = 32 * (phase === 'constant' ? 1009 : 811 + i % 567);
        const p = h.a.guest_alloc(n) >>> 0;
        if (!p) { failed = {phase, i, n}; break outer; }
        h.a.guest_free(p); completed++;
      }
    }
    report.exact = {completed, failed, maps: h.maps(), oom: h.oom};
    if (expectOld) {
      assert.deepStrictEqual(failed, {phase: 'ascending', i: 15051, n: 35840});
      assert.strictEqual(completed, 17051); assert.strictEqual(h.maps(), 288);
      h.valid(); console.log(JSON.stringify(report)); return;
    }
    assert.strictEqual(failed, null, JSON.stringify(report.exact));
    assert(h.maps() <= 2, 'balanced packs reuse current backing');
    h.valid();
    // Vary across bins, page boundaries and the small/large threshold. A live
    // peer allocation and a live large allocation must retain all their bytes.
    h.b = await h.peer();
    const guard = h.b.guest_alloc(90000) >>> 0, large = h.a.guest_alloc(700000) >>> 0;
    assert(guard && large); h.mark(guard, 90000, 0x6b); h.mark(large, 700000, 0x7c);
    let seed = 0x13579bdf;
    for (let i = 0; i < 20000; i++) {
      if (!(i % 1024)) { bound(); h.check(guard, 90000, 0x6b); h.check(large, 700000, 0x7c); }
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const n = i % 5 === 0 ? 1 + (seed >>> 0) % 252 : 257 + (seed >>> 0) % 600000;
      const p = h.a.guest_alloc(n) >>> 0; assert(p, `extended allocation ${i}/${n}`);
      h.check(p, n, 0); h.mark(p, n, 0xa5); h.a.guest_free(p);
    }
    h.check(guard, 90000, 0x6b); h.check(large, 700000, 0x7c);
    h.a.guest_free(large); h.b.guest_free(guard); h.valid(); h.valid(h.b);
    report.extended = {pairs: 20000, maps: h.maps()};
  }
  // A complete owner list (including a binned 136-byte extent) permits rewind.
  // A live block or a peer-owned free header prevents it. Neither a retained
  // local bin nor a peer's old header may alias the new live allocation.
  for (const mode of ['owner', 'live', 'peer']) {
    const h = await boot(true), held = h.a.guest_alloc(128) >>> 0;
    h.mark(held, 128, 0x51);
    if (mode === 'peer') h.b.guest_free(held);
    const firstEnd = h.a.get_heap_sparse_end() >>> 0;
    const owned = [];
    while (firstEnd - (h.a.get_heap_sparse_ptr() >>> 0) > 64) {
      const n = Math.min(200000, firstEnd - (h.a.get_heap_sparse_ptr() >>> 0) - 64) - 4;
      const p = h.a.guest_alloc(n) >>> 0; assert(p); owned.push(p);
    }
    for (const p of owned) h.a.guest_free(p);
    if (mode === 'owner') h.a.guest_free(held);
    const mapBefore = Buffer.from(new Uint8Array(h.memory.buffer, regions.BASE.VIRTUAL_MAP_TABLE, regions.REGIONS.VIRTUAL_MAP_TABLE.size));
    const next = h.a.guest_alloc(300000) >>> 0; assert(next);
    if (mode === 'owner') {
      assert.strictEqual(h.a.get_heap_sparse_end() >>> 0, firstEnd, 'complete local ownership rewinds');
      assert.strictEqual(next, held, 'rewound bump starts at arena base');
      assert(mapBefore.equals(Buffer.from(new Uint8Array(h.memory.buffer, regions.BASE.VIRTUAL_MAP_TABLE, mapBefore.length))), 'rewind preserves map records');
      h.check(next, 300000, 0);
    } else assert.notStrictEqual(h.a.get_heap_sparse_end() >>> 0, firstEnd, 'incomplete local ownership refuses rewind');
    h.mark(next, 300000, 0x62);
    if (mode === 'peer') {
      const reused = h.b.guest_alloc(128) >>> 0;
      assert.strictEqual(reused, held, 'peer still owns and reuses its header');
      h.mark(reused, 128, 0x73); h.check(next, 300000, 0x62); h.b.guest_free(reused);
    } else if (mode === 'live') { h.check(held, 128, 0x51); h.a.guest_free(held); }
    else {
      const small = h.a.guest_alloc(128) >>> 0; assert(small);
      assert(small < next || small >= next + 300000, 'old local bin was purged');
      h.mark(small, 128, 0x84); h.check(next, 300000, 0x62); h.a.guest_free(small);
    }
    h.a.guest_free(next); h.valid(); h.valid(h.b);
  }
  report.pass = true; report.elapsedMs = Date.now() - began;
  console.log(JSON.stringify(report));
})().catch(e => { console.error(e); process.exitCode = 1; });
