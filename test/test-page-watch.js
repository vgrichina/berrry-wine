#!/usr/bin/env node
'use strict';
// Real VM accessors, shared instances, bulk/native writes and cache consumers.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const extraWat = `
  (export "watch_store64" (func $gs64))
  (export "watch_copy" (func $guest_memmove))
  (export "watch_fill" (func $guest_memset))
  (export "watch_native_copy" (func $memcpy))
  (export "watch_native_zero" (func $zero_memory))
  (export "watch_window" (func $uop_window_set))
  (export "watch_block" (func $uop_rg_block_ok))
  (export "watch_dib_alloc" (func $dib_alloc))
  (export "watch_dib_free" (func $dib_free_wasm))
  (export "watch_fill_rect" (func $viewport_fill_rect))
  (export "watch_surface_fmt" (func $dx_surf_fmt_set))
  (export "watch_surface_free" (func $dx_free))
  (export "watch_gdi_upload" (func $gdi_write_surface_upload))
  (export "watch_bitmap_alloc" (func $gdi_bitmap_alloc))
  (export "watch_bitmap_bits" (func $gdi_bitmap_storage))
  (func (export "watch_epoch") (result i32) (i32.atomic.load (global.get $UOP_WIN_EPOCH)))
  (func (export "watch_alias") (param $g i32) (param $wa i32)
    (drop (call $guest_page_publish_range (local.get $g) (i32.const 4096)
      (local.get $wa) (i32.const 4))))
`;

(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: e, memory } = h;
  e.heap_init(0x2000000);
  const u32 = new Uint32Array(memory.buffer), u64 = new BigUint64Array(memory.buffer);
  const root = e.page_watch_root() >>> 0;
  const cell = wa => Atomics.load(u32, (root >>> 2) + (wa >>> 22)) + ((wa >>> 12) & 1023) * 16;
  const generation = wa => cell(wa) ? Atomics.load(u64, (cell(wa) + 8) >>> 3) : 0n;
  const refs = wa => Atomics.load(u32, cell(wa) >>> 2);
  const changed = (addresses, fn) => {
    const before = addresses.map(generation); fn();
    addresses.forEach((p, i) => assert(generation(p) > before[i], `missing notification at ${p.toString(16)}`));
  };
  const g = 0x60000000;
  assert(e.test_virtual_map_commit(g, 65536));
  const wa = e.guest_to_wasm(g) >>> 0;
  const window = e.guest_to_wasm(0x420000) >>> 0;
  assert.equal(e.watch_window(window, g, 65536, 1), 1);

  const dibGuest = e.watch_dib_alloc(8192), dib = e.guest_to_wasm(dibGuest) >>> 0;
  assert.equal(e.page_watch_acquire(dib, 8192), 1);
  changed([dib, dib + 4096], () => e.watch_dib_free(dib));
  assert.equal(e.watch_dib_alloc(8192), dibGuest, 'backing is recycled');
  e.page_watch_release(dib, 8192);

  // The actual WAT software rasterizer notifies the DIB pages it writes. (The
  // GPU texture/target caches that consumed these watches are the WAT
  // producer's now: see test-d3dim-palette-alpha-page-watch.js and
  // test-d3dim-surface-fence.js.)
  const surface = e.test_dx_alloc(2) >>> 0, view = new DataView(memory.buffer);
  view.setUint16(surface + 12, 64, true); view.setUint16(surface + 14, 64, true);
  view.setUint16(surface + 16, 16, true); view.setUint16(surface + 18, 128, true);
  view.setUint32(surface + 20, dib, true); e.watch_surface_fmt(surface, 1);
  assert.equal(e.page_watch_acquire(dib, 8192), 1);
  changed([dib], () => e.watch_fill_rect(surface, 0, 0, 20, 20, 0xff0000));
  changed([dib + 4096], () => e.guest_write16(dibGuest + 40 * 128, 0x07e0));
  e.page_watch_release(dib, 8192);
  e.watch_surface_free(surface);
  assert.equal(refs(dib), 0, 'released watches leave no reference');
  const bitmap = e.watch_bitmap_alloc(32, 32, 32, 1, dib, 128, 0, 0);
  assert(bitmap); assert.equal(e.page_watch_acquire(dib, 4096), 1);
  changed([dib], () => e.watch_gdi_upload(bitmap, 0, 0, 32, 32));
  // The canonical host surface also notifies on actual JS pixel production,
  // while presentation-only markDirty must not make GPU readbacks dirty again.
  const { GdiSurface } = require('../lib/gdi-surface');
  const jsSurface = new GdiSurface({ width: 32, height: 32, bpp: 32,
    storage: new Uint8Array(memory.buffer), storageOffset: dib,
    onWrite: (p, n) => e.page_watch_write(p, n) });
  changed([dib], () => jsSurface.fillRect(0, 0, 32, 32, 0xabcdef));
  changed([dib], () => jsSurface.writePixel(1, 1, 0));
  changed([dib], () => jsSurface.writeRgbaRect(1, 1, 1, 1, new Uint8Array([255, 0, 0, 255])));
  const shown = generation(dib); jsSurface.markDirty(0, 0, 32, 32);
  assert.equal(generation(dib), shown);
  e.page_watch_release(dib, 4096);
  const epoch = e.watch_epoch();
  assert.equal(e.page_watch_acquire(wa + 4090, 20), 1);
  assert.notEqual(e.watch_epoch(), epoch, 'old fast-store windows become invalid');
  assert.equal(e.watch_window(window, g, 65536, 1), 0);
  assert.equal(e.watch_window(window, g, 65536, 0), 1, 'read windows remain valid');
  assert.equal(e.watch_block(g, g + 65536, wa, 1), 0, '64KB reguard cannot skip watched interior');
  assert.equal(e.watch_block(g, g + 65536, wa, 0), 1);
  changed([wa], () => e.guest_write8(g + 17, 4));
  changed([wa, wa + 4096], () => e.guest_write16(g + 4095, 0x1234));
  changed([wa, wa + 4096], () => e.guest_write32(g + 4094, 0x12345678));
  changed([wa, wa + 4096], () => e.watch_store64(g + 4093, 123456789n));
  changed([wa, wa + 4096], () => e.watch_copy(g + 4090, g + 8192, 20));
  changed([wa, wa + 4096], () => e.watch_fill(g + 4090, 42, 20));
  changed([wa, wa + 4096], () => e.watch_native_copy(wa + 4090, wa + 8192, 20));
  changed([wa, wa + 4096], () => e.watch_native_zero(wa + 4090, 20));
  changed([wa], () => e.invalidate_code_range(g, 4));
  h.hostCtx.readFile = () => new Uint8Array([1, 2, 3, 4]);
  changed([wa], () => assert.equal(h.host.read_file(wa + 8192, wa, 4), 4));
  changed([wa], () => assert.equal(h.host.wall_clock(wa, 2), 1));
  const unchanged = generation(wa + 8192);
  e.guest_write32(g + 8192, 8);
  assert.equal(generation(wa + 8192), unchanged, 'unwatched page has no generation traffic');

  // Aliases and non-contiguous neighbouring guest pages share backing versions.
  const alias = 0x65000000;
  e.watch_alias(alias, wa); e.watch_alias(alias + 4096, wa + 32768);
  assert.equal(e.page_watch_acquire(wa + 32768, 4096), 1);
  changed([wa], () => e.guest_write32(alias, 7));
  changed([wa, wa + 32768], () => e.watch_store64(alias + 4093, 998877n));
  changed([wa, wa + 32768], () => e.watch_copy(alias + 4090, g + 8192, 20));
  e.page_watch_release(wa + 32768, 4096);

  // A different instance has no private copy of the watch directory.
  const second = new WebAssembly.Instance(h.module, { host: h.host });
  changed([wa], () => second.exports.guest_write32(g, 11));
  assert.equal(e.page_watch_acquire(wa, 1), 1);
  assert.equal(refs(wa), 2);
  e.page_watch_release(wa + 4090, 20);
  assert.equal(refs(wa), 1); assert.equal(refs(wa + 4096), 0);
  e.page_watch_release(wa, 1);
  const released = generation(wa);
  e.guest_write32(g, 12);
  assert.equal(generation(wa), released);
  assert.equal(e.watch_window(window, g, 65536, 1), 1);

  // Exercise overflow with an existing live reference; no wrapping refcount.
  Atomics.store(u32, (root + 2048) >>> 2, 0);
  assert.equal(e.page_watch_acquire(wa, 8192), 1);
  Atomics.store(u32, cell(wa + 4096) >>> 2, 0xffffffff);
  assert.equal(e.page_watch_acquire(wa, 8192), 0);
  assert.equal(refs(wa), 1, 'failed registration rolls its earlier page back');
  assert.equal(refs(wa + 4096), 0xffffffff, 'refcount did not wrap');
  Atomics.store(u32, cell(wa + 4096) >>> 2, 1);
  Atomics.store(u32, (root + 2048) >>> 2, 0);
  Atomics.store(u64, (cell(wa) + 8) >>> 3, 0xffffffffffffffffn);
  e.page_watch_write(wa, 1);
  assert.equal(Atomics.load(u32, (root + 2048) >>> 2), 1, 'version wrap fails closed');
  e.page_watch_release(wa, 8192);
  assert.equal(e.page_watch_acquire(memory.buffer.byteLength - 2, 4), 0);
  console.log('PASS selective page watches: stores, aliases, shared instances, windows, bulk copies, rasterizer writes, release and overflow');
})().catch(error => { console.error(error); process.exitCode = 1; });
