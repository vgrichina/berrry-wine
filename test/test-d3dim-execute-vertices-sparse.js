'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const extraWat = String.raw`
 (func (export "device") (result i32)
   (local $p i32) (local $s i32)
   (local.set $p (call $dx_create_com_obj (i32.const 20) (i32.const 0)))
   (local.set $s (call $heap_alloc (i32.const 4096)))
   (call $d3ddev_init_state (local.get $s))
   (i32.store offset=16 (call $dx_from_this (local.get $p)) (local.get $s))
   (local.get $p))
 (func (export "make") (param $buf i32) (param $cache i32) (result i32)
   (local $p i32) (local $entry i32)
   (local.set $p (call $dx_create_com_obj (i32.const 21) (i32.const 0)))
   (local.set $entry (call $dx_from_this (local.get $p)))
   (store.field DxObject misc0 (local.get $entry) (local.get $buf))
   (i32.store offset=12 (local.get $entry) (i32.const 128))
   (if (local.get $cache) (then
     (call $gs32 (local.get $cache) (local.get $buf))
     (call $gs32 (i32.add (local.get $cache) (i32.const 4)) (i32.const 128))
     (call $guest_memmove (i32.add (local.get $cache) (i32.const 32)) (local.get $buf) (i32.const 128))
     (call $guest_memmove (i32.add (local.get $cache) (i32.const 160)) (local.get $buf) (i32.const 128))
     (call $gs32 (i32.add (local.get $cache) (i32.const 288)) (i32.const 0))
     (i32.store (i32.add (global.get $D3DIM_EB_CACHE_PTRS)
       (i32.mul (call $dx_slot_of (local.get $entry)) (i32.const 4))) (local.get $cache))))
   (local.get $p))
 (func (export "close") (param $p i32) (param $borrowed i32)
   (if (local.get $borrowed) (then
     (i32.store (i32.add (global.get $D3DIM_EB_CACHE_PTRS)
       (i32.mul (call $dx_slot_of (call $dx_from_this (local.get $p))) (i32.const 4))) (i32.const 0))))
   (call $d3dim_execbuf_cache_clear (local.get $p))
   (call $dx_free (call $dx_from_this (local.get $p))))
 (func (export "output") (param $buf i32) (result i32)
   (call $d3dim_execbuf_output_guest (local.get $buf) (i32.const 0)))
 (func (export "refresh") (param $p i32) (call $d3dim_execbuf_cache_refresh (local.get $p)))
 (func (export "process") (param $dev i32) (param $p i32) (param $buf i32) (param $rec i32)
   (call $d3dim_exec_process_vertices (local.get $dev) (local.get $p) (local.get $buf) (local.get $rec) (i32.const 1)))
`;
(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const dev = e.device(), regular = e.guest_alloc(144) + 4, rec = e.guest_alloc(16);
  const bases = [0x3a000000, 0x3b000000];
  for (const base of bases) {
    for (const p of [base, base + 0x10000, base + 4096]) e.test_virtual_map_commit(p, 4096);
    assert.notStrictEqual(e.guest_to_wasm(base + 4096), e.guest_to_wasm(base) + 4096);
    for (let i = 0; i < 4096; i++) e.guest_write8(base + 0x10000 + i, 0xa7);
  }
  const f = new Float32Array([0.25, 0.5, 0.75, 1, 0.1, 0.2, 0.3, 0.4]);
  const bytes = new Uint8Array(f.buffer);
  function run(buf, mode, cacheMode) {
    for (let i = -4; i < 132; i++) e.guest_write8(buf + i, 0xcc);
    for (let i = 0; i < 64; i++) e.guest_write8(buf + i, bytes[i % 32]);
    const borrowed = cacheMode === 2 ? bases[1] + 4058 : 0;
    const p = cacheMode ? e.make(buf, borrowed) : 0;
    [mode, 2 << 16, 2, 0].forEach((v, i) => e.guest_write32(rec + i * 4, v));
    const cursor = e.guest_span_cursor_bytes(), overflow = e.guest_span_overflow_count();
    e.process(dev, p, buf, rec);
    assert.strictEqual(e.guest_span_cursor_bytes(), cursor, 'vertex spans released');
    assert.strictEqual(e.guest_span_overflow_count(), overflow);
    const output = e.output(buf);
    const result = Array.from({ length: 128 }, (_, i) => e.guest_read8(output + i));
    if (p) {
      for (let i = 0; i < 64; i++) assert.strictEqual(e.guest_read8(buf + i), bytes[i % 32],
        'PROCESSVERTICES preserves Lock-visible source bytes');
      const before = result.slice(64, 80);
      const source = Array.from({ length: 128 }, (_, i) => e.guest_read8(buf + i));
      for (let cycle = 0; cycle < 32; cycle++) {
        const color = (0xff12ab34 + cycle) >>> 0;
        e.guest_write32(buf + 16, color);
        e.refresh(p);
        assert.deepStrictEqual(Array.from({ length: 16 }, (_, i) => e.guest_read8(output + 64 + i)), before,
          'Unlock preserves the separately owned processed stream');
        e.process(dev, p, buf, rec);
        assert.deepStrictEqual(Array.from({ length: 16 }, (_, i) => e.guest_read8(output + 64 + i)), before,
          'color-only Unlock must not re-transform prior TL positions');
        assert.strictEqual(e.guest_read32(output + 64 + 16) >>> 0, mode === 0 ?
          new DataView(Uint8Array.from(result.slice(80, 84)).buffer).getUint32(0, true) : color);
        for (let i = 0; i < 128; i++) if (i < 16 || i >= 20)
          assert.strictEqual(e.guest_read8(buf + i), source[i], 'only application color bytes change');
      }
    }
    for (let i = 1; i <= 4; i++) assert.strictEqual(e.guest_read8(buf - i), 0xcc);
    for (let i = 128; i < 132; i++) assert.strictEqual(e.guest_read8(buf + i), 0xcc);
    if (p) e.close(p, borrowed);
    return result;
  }
  let cases = 0;
  for (const mode of [0, 1, 2]) for (const cacheMode of [0, 1, 2]) {
    const expected = run(regular, mode, cacheMode);
    for (const offset of [4090, 4030]) {
      assert.deepStrictEqual(run(bases[0] + offset, mode, cacheMode), expected,
        `mode=${mode} cache=${cacheMode} offset=${offset}`);
      for (const base of bases) for (let i = 0; i < 4096; i++)
        assert.strictEqual(e.guest_read8(base + 0x10000 + i), 0xa7, 'neighbor backing preserved');
      cases++;
    }
  }
  console.log(`PASS Execute PROCESSVERTICES: ${cases} sparse/control comparisons, all modes, absent/owned/sparse cache, 32 color-only cycles, byte/canary/span guards`);
})().catch(error => { console.error(error); process.exitCode = 1; });
