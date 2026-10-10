#!/usr/bin/env node
'use strict';

// VirtualAlloc(lpAddress, size, MEM_RESERVE) at a fixed address below the
// sparse arena. Only the image's own window of the direct mapping is guest
// memory, plus the four $GUEST_FIXED_POOL_* holes 00-regions.wat leaves for
// Crusaders of Might and Magic, whose level files hold pointers already
// relocated to 0x04000000, 0x05000000, 0x06000000 and 0x08000000: those pools
// must be honoured at exactly those addresses, and must be guest memory, not
// the emulator tables the direct window used to translate them onto (the first
// once "succeeded" onto the window title table). Anything else past the image
// window still fails, as Windows fails a reservation it cannot place exactly.
// A fixed reserve inside the image window keeps its old literal meaning.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_valloc") (param $addr i32) (param $size i32) (param $type i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualAlloc (local.get $addr) (local.get $size) (local.get $type)
      (i32.const 4) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.add (local.get $sp) (i32.const 20)))
      (then (unreachable)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_last_error") (result i32) (global.get $last_error))
  (func (export "t_floor") (result i32) (call $virtual_alloc_min))
  (func (export "t_image_base") (result i32) (global.get $image_base))
  (func (export "t_set_image_base") (param $b i32) (global.set $image_base (local.get $b)))
  (func (export "t_image_end") (result i32)
    (i32.add (global.get $image_base)
      (i32.sub (region.end $GUEST_BASE) (global.get $GUEST_BASE))))
  (func (export "t_g2w") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  (func (export "t_pool") (param $i i32) (result i32)
    (if (result i32) (i32.eqz (local.get $i)) (then (global.get $GUEST_FIXED_POOL_A))
      (else (if (result i32) (i32.eq (local.get $i) (i32.const 1)) (then (global.get $GUEST_FIXED_POOL_D))
        (else (if (result i32) (i32.eq (local.get $i) (i32.const 2)) (then (global.get $GUEST_FIXED_POOL_B))
          (else (global.get $GUEST_FIXED_POOL_C))))))))
  (func (export "t_title_table") (result i32) (global.get $TITLE_TABLE))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  // No PE is loaded in this harness; give it the default image base a loaded
  // exe would, since the pool holes are placed relative to it.
  e.t_set_image_base(0x400000);
  assert.strictEqual(e.t_image_base() >>> 0, 0x400000, 'fixture uses the default image base');
  const imageEnd = e.t_image_end() >>> 0;
  const floor = e.t_floor() >>> 0;
  // Crusaders' exact calls (0x450ea0 and 0x450fc0): guest 64, 80, 96 and 128 MB.
  // Written in MB because these are GUEST addresses; as hex the last one would
  // read as the wasm base of the sparse backing pool, which it is not.
  const MB = 0x100000;
  const pools = [[64 * MB, 0x80000, 0x2000], [80 * MB, 0x29040, 0x3000],
    [96 * MB, 0xee1000, 0x2000], [128 * MB, 0x100000, 0x2000]];
  assert(pools.every(([a, n]) => a + n <= floor), 'the pools sit below the sparse arena');

  pools.forEach(([addr, size, type], i) => {
    assert.strictEqual(e.t_valloc(addr, size, type) >>> 0, addr,
      `fixed pool 0x${addr.toString(16)} is honoured at exactly that address`);
    assert.strictEqual(e.t_g2w(addr) >>> 0, e.t_pool(i) >>> 0,
      `pool 0x${addr.toString(16)} translates into its own hole`);
  });
  assert.notStrictEqual(e.t_g2w(0x04000000) >>> 0, e.t_title_table() >>> 0,
    'the first pool no longer lands on the window title table');

  // Past the image window and not wholly inside a pool: still refused.
  for (const [addr, size] of [[imageEnd - 0x10000, 0x20000], [0x04080000, 0x1000],
    [0x05000000, 0x40000], [0x07000000, 0x10000], [0x06000000, 0xf00000]]) {
    assert.strictEqual(e.t_valloc(addr, size, 0x2000) >>> 0, 0,
      `reserve at 0x${addr.toString(16)}+0x${size.toString(16)} outside the pools fails`);
    assert.strictEqual(e.t_last_error(), 487, 'ERROR_INVALID_ADDRESS');
  }

  const inside = imageEnd - 0x200000;
  assert.strictEqual(e.t_valloc(inside, 0x10000, 0x2000) >>> 0, inside,
    'a fixed reserve inside the image window is honoured literally');
  assert.notStrictEqual(e.t_valloc(0, 0x10000, 0x2000) >>> 0, 0, 'a NULL reserve still places');
  console.log('PASS  fixed pools honoured exactly and backed by their own holes; other fixed reserves past the image window fail with ERROR_INVALID_ADDRESS');
})().catch(error => { console.error(error); process.exit(1); });
