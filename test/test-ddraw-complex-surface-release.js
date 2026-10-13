#!/usr/bin/env node
'use strict';

// Releasing the front of a complex surface destroys the implicit attachments
// CreateSurface made for it: a flip chain's back buffer and every mip level
// below the top. The Plus! 98 Organic Art savers rebuild their whole D3DRM
// device on each form change, and every rebuild used to leave a 640x480 back
// buffer live in the DIB arena. A reference the application still holds keeps
// the attachment alive, exactly as on Windows.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_cs_caps") (param $driver i32) (param $hel i32)
    (call $handle_IDirectDraw_GetCaps (i32.const 0)
      (local.get $driver) (local.get $hel) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_cs_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl)))
  (func (export "test_cs_ddraw") (result i32)
    (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
  (func (export "test_cs_create") (param $ddraw i32) (param $desc i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_cs_attached") (param $surface i32) (param $caps i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetAttachedSurface
      (local.get $surface) (local.get $caps) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_cs_release") (param $surface i32) (result i32)
    (call $dx_surface_release (local.get $surface)))
  (func (export "test_cs_live") (param $surface i32) (result i32)
    (i32.ne (call $ddraw_surface_entry_checked (local.get $surface)) (i32.const 0)))
  (func (export "test_cs_qi") (param $surface i32) (param $iid i32) (param $out i32) (result i32)
    (global.set $DX_VTBL_DDSURF3 (i32.const 0x53000000))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_QueryInterface (local.get $surface) (local.get $iid) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_cs_addref") (param $surface i32) (result i32)
    (call $dx_com_addref (local.get $surface)))
  (func (export "test_cs_vidmem") (result i32) (global.get $dx_vidmem_used))
  (func (export "test_cs_flip") (param $surface i32) (param $target i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Flip (local.get $surface) (local.get $target)
      (i32.const 8) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_cs_bits") (param $surface i32) (result i32)
    (call $w2g (load.field DxObject misc1 (call $dx_from_this (local.get $surface)))))
  (func (export "test_cs_surface_caps") (param $surface i32) (result i32)
    (i32.load (call $dx_surf_meta_ptr (call $dx_from_this (local.get $surface)))))
  (func (export "test_cs_desc") (param $surface i32) (param $desc i32)
    (call $handle_IDirectDrawSurface_GetSurfaceDesc (local.get $surface) (local.get $desc)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_cs_surface_count") (result i32)
    (local $i i32) (local $n i32)
    (loop $scan
      (if (i32.eq (i32.load (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $i) (i32.const 5)))) (i32.const 2))
        (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (global.get $DX_MAX))))
    (local.get $n))
  ;; Reserve empty slots to exercise a real allocation failure after the
  ;; front and first backbuffer exist. No implementation branch is mocked.
  (func (export "test_cs_reserve_slots") (param $available i32)
    (local $i i32) (local $p i32)
    (loop $scan
      (local.set $p (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.eqz (i32.load (local.get $p)))
        (then
          (if (local.get $available)
            (then (local.set $available (i32.sub (local.get $available) (i32.const 1))))
            (else (i32.store (local.get $p) (i32.const 99))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (global.get $DX_MAX)))))
  (func (export "test_cs_unreserve_slots")
    (local $i i32) (local $p i32)
    (loop $scan
      (local.set $p (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.eq (i32.load (local.get $p)) (i32.const 99))
        (then (i32.store (local.get $p) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (global.get $DX_MAX)))))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat });
  const desc = 0x410000, out = 0x410100, caps = 0x410200, got = 0x410300;
  wat.test_cs_seed(0x51000000, 0x52000000);
  const ddraw = wat.test_cs_ddraw();
  const vidmemBefore = wat.test_cs_vidmem();

  // SS2 checks DX6 ddsCaps, not merely dwZBufferBitDepths. Preserve the
  // legacy field too, and never write a newer field into an older buffer.
  for (const size of [132, 136, 316, 364, 368, 380]) {
    for (const p of [0x411000, 0x412000]) {
      for (let n = 0; n < 400; n += 4) wat.guest_write32(p + n, 0xa5a5a5a5);
      wat.guest_write32(p, size);
    }
    wat.test_cs_caps(0x411000, 0x412000);
    for (const p of [0x411000, 0x412000]) {
      assert.strictEqual(wat.guest_read32(p), size);
      assert.strictEqual(wat.guest_read32(p + size) >>> 0, 0xa5a5a5a5,
        `GetCaps overwrote the ${size}-byte caller buffer`);
      assert(wat.guest_read32(p + 56) & 0x400, '16-bit depth is supported');
      if (size >= 136) assert(wat.guest_read32(p + 132) & 0x20000,
        'legacy surface caps must advertise implemented depth surfaces');
      if (size >= 368) assert(wat.guest_read32(p + 364) & 0x20000,
        'DX6 surface caps must advertise implemented depth surfaces');
      // dwCaps2 at +8: Trespasser asks "Direct Draw NOT certified" without
      // DDCAPS2_CERTIFIED; windowed rendering and gamma stay advertised.
      if (p === 0x411000) {
        assert.strictEqual(wat.guest_read32(p + 8) & 0xA0001, 0xA0001,
          'driver caps report a certified driver that renders windowed with gamma');
      }
    }
  }

  function describe(flags, w, h, count, capsBits) {
    for (let i = 0; i < 108; i += 4) wat.guest_write32(desc + i, 0);
    wat.guest_write32(desc, 108);
    wat.guest_write32(desc + 4, flags);
    wat.guest_write32(desc + 8, h);
    wat.guest_write32(desc + 12, w);
    wat.guest_write32(desc + 20, count);   // dwBackBufferCount / dwMipMapCount union
    wat.guest_write32(desc + 104, capsBits);
  }

  function attachment(surface, capsBits) {
    wat.guest_write32(caps, capsBits);
    assert.strictEqual(wat.test_cs_attached(surface, caps, got) >>> 0, 0,
      'GetAttachedSurface finds the implicit attachment');
    return wat.guest_read32(got) >>> 0;
  }

  // Run this same API assertion against the unchanged control source. Its
  // expected failure must be the missing second attachment, not a new export
  // or a different capability/descriptor assertion masking that regression.
  if (process.env.DDRAW_SECOND_BACKBUFFER_CONTROL === '1') {
    describe(0x21, 0, 0, 2, 0x4218);
    assert.strictEqual(wat.test_cs_create(ddraw, desc, out), 0);
    const root = wat.guest_read32(out) >>> 0;
    const first = attachment(root, 0x4004);
    wat.guest_write32(caps, 0x4000);
    assert.strictEqual(wat.test_cs_attached(first, caps, got) >>> 0, 0,
      'requested second backbuffer must exist');
    wat.test_cs_release(wat.guest_read32(got));
    wat.test_cs_release(first);
    wat.test_cs_release(root);
    console.log('PASS  requested second backbuffer exists');
    return;
  }

  // Recoil converts the original interface to Surface3, then expects the
  // original Release to reach zero while the Surface3 keeps storage alive.
  describe(0x7, 32, 32, 0, 0x40);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out), 0);
  const original = wat.guest_read32(out) >>> 0;
  const iid = 0x410400;
  [0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800].forEach((v,i) => wat.guest_write32(iid + i*4, v));
  assert.strictEqual(wat.test_cs_qi(original, iid, got), 0);
  const version3 = wat.guest_read32(got) >>> 0;
  assert.notStrictEqual(version3, original);
  assert.strictEqual(wat.test_cs_addref(version3), 2);
  assert.strictEqual(wat.test_cs_release(version3), 1);
  assert.strictEqual(wat.test_cs_release(original), 0, 'original interface reaches zero independently');
  assert.strictEqual(wat.test_cs_live(version3), 1, 'Surface3 retains the underlying surface');
  assert.strictEqual(wat.test_cs_release(version3), 0);
  assert.strictEqual(wat.test_cs_live(version3), 0);
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore, 'final interface release frees storage');

  // Flip chain: DDSD_CAPS|DDSD_BACKBUFFERCOUNT, PRIMARY|FLIP|COMPLEX.
  describe(0x21, 0, 0, 1, 0x200 | 0x10 | 0x8);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0);
  let front = wat.guest_read32(out) >>> 0;
  let back = attachment(front, 0x4);          // DDSCAPS_BACKBUFFER
  assert.notStrictEqual(back, front);
  assert.strictEqual(wat.test_cs_release(back), 1,
    'dropping the caller\'s reference leaves the chain\'s own');
  assert.strictEqual(wat.test_cs_release(front), 0);
  assert.strictEqual(wat.test_cs_live(back), 0,
    'the back buffer dies with the front of its flip chain');
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore,
    'every byte of the chain is refunded');

  // A reference the application still holds keeps the back buffer alive.
  describe(0x21, 0, 0, 1, 0x200 | 0x10 | 0x8);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0);
  front = wat.guest_read32(out) >>> 0;
  back = attachment(front, 0x4);
  assert.strictEqual(wat.test_cs_release(front), 0);
  assert.strictEqual(wat.test_cs_live(back), 1,
    'a held back buffer outlives its front');
  assert.strictEqual(wat.test_cs_release(back), 0);
  assert.strictEqual(wat.test_cs_live(back), 0);
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore);

  // Mip chain: DDSD_CAPS|HEIGHT|WIDTH|MIPMAPCOUNT, TEXTURE|MIPMAP|COMPLEX.
  describe(0x7 | 0x20000, 64, 64, 3, 0x1000 | 0x400000 | 0x8);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0);
  const top = wat.guest_read32(out) >>> 0;
  const level1 = attachment(top, 0x1000 | 0x400000);
  const level2 = attachment(level1, 0x1000 | 0x400000);
  assert.strictEqual(wat.test_cs_release(level1), 1);
  assert.strictEqual(wat.test_cs_release(level2), 1);
  assert.strictEqual(wat.test_cs_release(top), 0);
  assert.strictEqual(wat.test_cs_live(level1), 0, 'mip level 1 dies with the top level');
  assert.strictEqual(wat.test_cs_live(level2), 0, 'and so does level 2, through level 1');
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore);

  // Double, triple and four-buffer chains: unique storage and stable role
  // caps, with every buffer participating in each rotation. This is the API
  // contract used by Silver's original 8-bit, two-backbuffer CreateSurface.
  for (const backCount of [1, 2, 3]) {
    describe(0x21, 0, 0, backCount, 0x4218);
    assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0);
    const chain = [wat.guest_read32(out) >>> 0];
    wat.test_cs_desc(chain[0], desc);
    assert.strictEqual(wat.guest_read32(desc + 20), backCount, 'GetSurfaceDesc reports the full chain count');
    chain.push(attachment(chain[0], 0x4004));
    for (let i = 1; i < backCount; i++) chain.push(attachment(chain[i], 0x4000));
    const initialBits = chain.map(s => wat.test_cs_bits(s) >>> 0);
    assert.strictEqual(new Set(initialBits).size, chain.length, 'each buffer owns distinct storage');
    const initialCaps = chain.map(s => wat.test_cs_surface_caps(s) >>> 0);
    assert.strictEqual(initialCaps[0] & 0x224, 0x220, 'only root is primary/front');
    assert.strictEqual(initialCaps[1] & 0x224, 4, 'first attached buffer has BACKBUFFER role');
    for (const c of initialCaps.slice(2)) assert.strictEqual(c & 0x224, 0, 'other buffers have neither role');
    for (const c of initialCaps) assert.strictEqual(c & 0x4018, 0x4018);
    assert.strictEqual(attachment(chain.at(-1), 0x20), chain[0], 'tail sees front without an ownership cycle');
    assert.strictEqual(wat.test_cs_release(chain[0]), 1, 'release tail lookup reference');
    wat.guest_write32(caps, 0x400000 | 0x1000);
    wat.guest_write32(got, 0xfeedface);
    assert.strictEqual(wat.test_cs_attached(chain[0], caps, got) >>> 0, 0x887600ff);
    assert.strictEqual(wat.guest_read32(got), 0, 'wrong caps cannot select an unrelated attachment');
    for (let i = 0; i < chain.length; i++) wat.guest_write32(initialBits[i], 0x11223300 + i);
    let order = initialBits.slice();
    const checkOrder = () => {
      assert.deepStrictEqual(chain.map(s => wat.test_cs_bits(s) >>> 0), order);
      assert.deepStrictEqual(chain.map(s => wat.guest_read32(wat.test_cs_bits(s)) >>> 0),
        order.map(p => 0x11223300 + initialBits.indexOf(p)), 'pixel colors follow the rotated storage');
      assert.deepStrictEqual(chain.map(s => wat.test_cs_surface_caps(s) >>> 0), initialCaps);
    };
    for (let i = 0; i < chain.length + 1; i++) {
      assert.strictEqual(wat.test_cs_flip(chain[0], 0) >>> 0, 0);
      order.push(order.shift());
      checkOrder();
    }
    const distance = chain.length - 1;
    assert.strictEqual(wat.test_cs_flip(chain[0], chain[distance]) >>> 0, 0);
    order = order.slice(distance).concat(order.slice(0, distance));
    checkOrder();
    assert.strictEqual(wat.test_cs_flip(chain[0], chain[0]) >>> 0, 0, 'front override is a no-op');
    checkOrder();
    describe(0x7, 16, 16, 0, 0x40);
    assert.strictEqual(wat.test_cs_create(ddraw, desc, out), 0);
    const unrelated = wat.guest_read32(out) >>> 0;
    assert.strictEqual(wat.test_cs_flip(chain[0], unrelated) >>> 0, 0x80070057);
    assert.strictEqual(wat.test_cs_flip(chain[0], 0x12345678) >>> 0, 0x80070057);
    assert.strictEqual(wat.test_cs_flip(chain[1], 0) >>> 0, 0x88760246);
    checkOrder(); // failed target/caller validation changes no buffer association
    wat.test_cs_release(unrelated);
    for (const s of chain.slice(1)) assert.strictEqual(wat.test_cs_release(s), 1);
    assert.strictEqual(wat.test_cs_release(chain[0]), 0);
    for (const s of chain) assert.strictEqual(wat.test_cs_live(s), 0);
    assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore, 'full rotated chain refunds every allocation');
  }

  // Holding an intermediate member retains its remaining attachments after
  // the front goes away. The tail must not rediscover a freed/recycled front.
  describe(0x21, 0, 0, 2, 0x4218);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out), 0);
  front = wat.guest_read32(out) >>> 0;
  back = attachment(front, 4);
  const tail = attachment(back, 0x4000);
  assert.strictEqual(wat.test_cs_release(tail), 1);
  assert.strictEqual(wat.test_cs_release(front), 0);
  assert.strictEqual(wat.test_cs_live(back), 1);
  assert.strictEqual(wat.test_cs_live(tail), 1);
  wat.guest_write32(caps, 0x20);
  assert.strictEqual(wat.test_cs_attached(tail, caps, got) >>> 0, 0x887600ff);
  assert.strictEqual(wat.test_cs_release(back), 0);
  assert.strictEqual(wat.test_cs_live(tail), 0);
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore);

  const liveBefore = wat.test_cs_surface_count();
  // Exhaust object slots midway through creation: no partially built chain
  // or storage survives, and no invalid output pointer is published.
  wat.test_cs_reserve_slots(2);
  try {
    describe(0x21, 0, 0, 2, 0x4218);
    wat.guest_write32(out, 0xfeedface);
    assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0x8876017c);
    assert.strictEqual(wat.guest_read32(out), 0);
    assert.strictEqual(wat.test_cs_surface_count(), liveBefore);
    assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore);
  } finally { wat.test_cs_unreserve_slots(); }
  // A count beyond the finite video arena exercises storage failure after
  // multiple successful allocations, rather than the object-slot branch.
  describe(0x21, 0, 0, 1024, 0x4218);
  wat.guest_write32(out, 0xfeedface);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0x8876017c);
  assert.strictEqual(wat.guest_read32(out), 0);
  assert.strictEqual(wat.test_cs_surface_count(), liveBefore);
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore);
  describe(0x21, 0, 0, 2, 0x4218);
  assert.strictEqual(wat.test_cs_create(ddraw, desc, out), 0, 'allocator is usable after rollback');
  assert.strictEqual(wat.test_cs_release(wat.guest_read32(out)), 0);
  assert.strictEqual(wat.test_cs_vidmem(), vidmemBefore);
  for (const [flags, count, capsBits] of [[0x21, 0, 0x4218], [0x1, 2, 0x4218], [0x21, 2, 0x4210]]) {
    describe(flags, 0, 0, count, capsBits);
    assert.strictEqual(wat.test_cs_create(ddraw, desc, out) >>> 0, 0x80070057);
    assert.strictEqual(wat.guest_read32(out), 0);
  }

  console.log('PASS  complex surface lifetime, multi-buffer flips and allocation rollback');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
