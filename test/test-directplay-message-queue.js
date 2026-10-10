#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const addRefId = apis.find(api => api.name === 'IDirectPlay3_AddRef').id;

const extraWat = String.raw`
  (export "test_enqueue" (func $dp_message_enqueue))
  (export "test_find" (func $dp_message_find))
  (export "test_query" (func $dp_message_query))
  (export "test_remove" (func $dp_message_remove))
  (export "test_cancel_range" (func $dp_message_cancel_range))
  (export "test_clear" (func $dp_clear_entities))
  (export "test_sparse_map" (func $virtual_map_commit))
  (export "test_g2w" (func $g2w))
  (export "test_create_entity" (func $dp_create_entity))
  (func (export "test_object") (result i32)
    (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))
  (func (export "test_receive") (param $owner i32) (param $from i32) (param $to i32)
      (param $flags i32) (param $data i32) (param $size i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074FF000))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $size))
    (call $handle_IDirectPlay3_Receive (local.get $owner) (local.get $from) (local.get $to)
      (local.get $flags) (local.get $data) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_count") (param $owner i32) (param $player i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074FF000))
    (call $handle_IDirectPlay3_GetMessageCount (local.get $owner) (local.get $player)
      (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ref") (param $owner i32) (param $add i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074FF000))
    (if (local.get $add)
      (then (call $dispatch_api_table (i32.const ${addRefId}) (local.get $owner) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_IDirectPlay3_Release (local.get $owner) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_bytes") (result i32) (i32.load offset=24 (global.get $DP_SHARED)))
  (func (export "test_id_limit") (param $id i32) (i32.store offset=20 (global.get $DP_SHARED) (i32.sub (local.get $id) (i32.const 1))))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const data = e.guest_alloc(1048576) >>> 0;
  e.guest_write32(data, 0x11223344);
  const add = (owner = 1, size = 4, priority = 0, kind = 0) =>
    e.test_enqueue(owner, 10, 20, data, size, priority, kind) >>> 0;
  const a = add(1, 4, 10);
  const b = add(2, 4, 10);
  const c = add(1, 4, 20, 1);
  assert(a && b && c);
  assert.strictEqual(new Set([a, b, c]).size, 3);
  assert.strictEqual(e.test_bytes(), 12);
  assert.strictEqual(e.test_query(1, 0, 0, 0, 0), 1);
  assert.strictEqual(e.test_query(1, 0, 10, 20, 1), 4);
  assert.strictEqual(e.test_query(1, 1, 10, 20, 0), 1);
  assert.strictEqual(e.test_query(1, 0, 11, 20, 0), 0);
  assert.strictEqual(e.test_query(1, 0, 10, 21, 0), 0);
  assert.strictEqual(e.test_query(3, 0, 0, 0, 0), 0);
  e.guest_write32(data, 0xaabbccdd);
  const entry = e.test_find(1, a) >>> 0;
  assert.strictEqual(e.guest_read32(entry + 8), 10);
  assert.strictEqual(e.guest_read32(entry + 12), 20);
  assert.strictEqual(e.guest_read32(e.guest_read32(entry + 16)) >>> 0, 0x11223344,
    'queue owns payload bytes independently of the caller');
  assert.strictEqual(e.test_find(2, a), 0, 'IDs are owner-scoped');
  assert.strictEqual(e.test_remove(2, a), 0);
  assert.strictEqual(e.test_cancel_range(1, 0, 10, 10), 1);
  assert.strictEqual(e.test_find(1, a), 0);
  assert(e.test_find(2, b));
  assert(e.test_find(1, c), 'send cancellation leaves receive messages alone');
  assert.strictEqual(e.test_bytes(), 8);
  assert.strictEqual(e.test_cancel_range(1, 1, 21, 20), 0);
  assert.strictEqual(e.test_remove(1, c), 1);
  assert.strictEqual(e.test_remove(1, c), 0, 'removal is not repeated');
  assert.strictEqual(add(0), 0);
  assert.strictEqual(add(1, 1048577), 0, 'individual payload limit');
  assert.strictEqual(add(1, 4, 0, 2), 0, 'only send/receive kinds are valid');
  assert.strictEqual(e.test_enqueue(1, 10, 20, 0, 4, 0, 0), 0);
  assert.strictEqual(e.test_bytes(), 4, 'invalid writes do not change accounting');
  e.test_clear();
  assert.strictEqual(e.test_bytes(), 0, 'Close frees queues even before entity-table initialization');
  assert.strictEqual(e.test_find(2, b), 0);

  const page = 0x30000000;
  assert.strictEqual(e.test_sparse_map(page, 4096) >>> 0, page);
  assert.strictEqual(e.test_sparse_map(0x28000000, 12288) >>> 0, 0x28000000);
  assert.strictEqual(e.test_sparse_map(page + 4096, 4096) >>> 0, page + 4096);
  assert.notStrictEqual(e.test_g2w(page + 4095) + 1, e.test_g2w(page + 4096),
    'fixture has noncontiguous backing across adjacent guest pages');
  const pattern = [17, 34, 51, 68, 85, 102, 119, 136];
  pattern.forEach((value, i) => e.guest_write8(page + 4092 + i, value));
  const sparseId = e.test_enqueue(1, 10, 20, page + 4092, 8, -1, 0);
  assert(sparseId);
  const sparsePayload = e.guest_read32(e.test_find(1, sparseId) + 16) >>> 0;
  assert.deepStrictEqual(pattern.map((_, i) => e.guest_read8(sparsePayload + i)), pattern,
    'payload copy translates each sparse guest page');
  assert.strictEqual(e.test_cancel_range(1, 0, 0, 0x7fffffff), 0);
  assert.strictEqual(e.test_cancel_range(1, 0, 0x80000000, 0xffffffff), 1,
    'priority bounds use unsigned DWORD comparisons');
  assert.strictEqual(e.test_bytes(), 0);

  const ids = Array.from({ length: 64 }, () => add(1, 0));
  assert(ids.every(Boolean));
  assert.strictEqual(new Set(ids).size, 64);
  assert.strictEqual(add(1, 0), 0, 'slot capacity is bounded even for empty messages');
  assert.strictEqual(e.test_remove(1, ids[0]), 1);
  const reused = add(1, 0);
  assert(reused > ids[63], 'slot reuse must not recycle message IDs');
  assert.strictEqual(e.test_find(1, ids[0]), 0);
  assert.strictEqual(e.guest_read32(e.test_query(1, 0, 0, 0, 2)) >>> 0, ids[1],
    'FIFO lookup uses message order, not a recycled slot index');
  assert.strictEqual(e.test_query(1, 0, 0, 0, 0), 64);
  assert.strictEqual(e.test_query(1, 0, 0, 0, 1), 0);
  e.test_clear();

  const large = Array.from({ length: 4 }, () => add(1, 1048576));
  assert(large.every(Boolean));
  assert.strictEqual(e.test_bytes(), 4194304);
  assert.strictEqual(add(1, 1), 0, 'total payload budget is bounded');
  assert.strictEqual(e.test_remove(1, large[0]), 1);
  assert(add(1, 1048576), 'removal releases byte capacity');
  e.test_clear();
  assert.strictEqual(e.test_bytes(), 0);
  const owner = e.test_object() >>> 0;
  const otherOwner = e.test_object() >>> 0;
  assert(owner && otherOwner && owner !== otherOwner);
  const fromPtr = e.guest_alloc(4) >>> 0;
  const toPtr = e.guest_alloc(4) >>> 0;
  const sizePtr = e.guest_alloc(4) >>> 0;
  const countPtr = e.guest_alloc(4) >>> 0;
  const out = e.guest_alloc(16) >>> 0;
  assert.strictEqual(e.test_create_entity(toPtr, 0, 0, 0, 0, 1), 0);
  const player = e.guest_read32(toPtr) >>> 0;
  const incoming = e.test_enqueue(owner, 10, player, data, 4, 0, 1) >>> 0;
  const system = e.test_enqueue(owner, 0, player, data, 4, 0, 1) >>> 0;
  const foreign = e.test_enqueue(otherOwner, 10, player, data, 4, 0, 1) >>> 0;
  const pending = e.test_enqueue(owner, 10, player, data, 4, 0, 0) >>> 0;
  assert(incoming && system && foreign && pending);
  const receive = (flags = 0, buffer = out) => {
    const result = e.test_receive(owner, fromPtr, toPtr, flags, buffer, sizePtr) >>> 0;
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff01c, 'Receive pops six stdcall arguments');
    return result;
  };
  const count = (target = player) => {
    assert.strictEqual(e.test_count(owner, target, countPtr), 0);
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff010, 'GetMessageCount pops three arguments');
    return e.guest_read32(countPtr) >>> 0;
  };
  assert.strictEqual(count(), 2, 'count excludes sends and other COM objects');
  assert.strictEqual(count(0), 2);
  e.guest_write32(countPtr, 0xfeedface);
  assert.strictEqual(e.test_count(owner, 0xdeadbeef, countPtr) >>> 0, 0x88770096);
  assert.strictEqual(e.guest_read32(countPtr) >>> 0, 0xfeedface);
  assert.strictEqual(e.test_count(owner, player, 0) >>> 0, 0x80070057);
  e.guest_write32(fromPtr, 99);
  e.guest_write32(sizePtr, 16);
  e.guest_write32(out, 0xfeedface);
  assert.strictEqual(receive(4), 0x887700be, 'unmatched FROMPLAYER preserves outputs');
  assert.strictEqual(e.guest_read32(sizePtr), 16);
  assert.strictEqual(e.guest_read32(fromPtr), 99);
  assert.strictEqual(receive(16), 0x88770078, 'unknown flags fail');
  assert.strictEqual(e.guest_read32(out) >>> 0, 0xfeedface);
  e.guest_write32(sizePtr, 3);
  assert.strictEqual(receive(), 0x8877001e);
  assert.strictEqual(e.guest_read32(sizePtr), 4);
  assert.strictEqual(e.guest_read32(fromPtr), 99);
  assert.strictEqual(e.guest_read32(out) >>> 0, 0xfeedface);
  assert.strictEqual(receive(0, 0), 0x8877001e, 'null-buffer query retains message');
  assert.strictEqual(count(), 2);
  e.guest_write32(fromPtr, 0);
  e.guest_write32(sizePtr, 16);
  assert.strictEqual(receive(4 | 8), 0, 'peek exact system sender, not wildcard');
  assert.strictEqual(e.guest_read32(fromPtr), 0);
  assert.strictEqual(e.guest_read32(toPtr) >>> 0, player);
  assert.strictEqual(e.guest_read32(out), e.guest_read32(data));
  assert(e.test_find(owner, system));
  assert.strictEqual(count(), 2);
  assert.strictEqual(receive(4), 0);
  assert.strictEqual(e.test_find(owner, system), 0);
  assert.strictEqual(count(), 1);
  e.guest_write32(toPtr, player + 1);
  e.guest_write32(sizePtr, 16);
  assert.strictEqual(receive(2), 0x887700be);
  e.guest_write32(toPtr, player);
  assert.strictEqual(receive(2), 0);
  assert.strictEqual(e.guest_read32(fromPtr), 10);
  assert.strictEqual(e.test_find(owner, incoming), 0);
  assert.strictEqual(count(), 0);
  assert.strictEqual(receive(), 0x887700be, 'pending sends are not received');
  pattern.forEach((value, i) => e.guest_write8(data + i, value));
  assert(e.test_enqueue(owner, 10, player, data, 8, 0, 1));
  e.guest_write32(sizePtr, 8);
  assert.strictEqual(receive(0, page + 4092), 0);
  assert.deepStrictEqual(pattern.map((_, i) => e.guest_read8(page + 4092 + i)), pattern,
    'Receive copies across noncontiguous destination pages');
  assert(e.test_enqueue(owner, 10, player, 0, 0, 0, 1));
  e.guest_write32(sizePtr, 0);
  assert.strictEqual(receive(0, 0), 0x8877001e);
  assert.strictEqual(count(), 1, 'null-buffer probe retains an empty message too');
  assert.strictEqual(receive(), 0);
  assert.strictEqual(e.guest_read32(sizePtr), 0);
  assert.strictEqual(count(), 0);
  for (const args of [[0, toPtr, sizePtr], [fromPtr, 0, sizePtr], [fromPtr, toPtr, 0]]) {
    assert.strictEqual(e.test_receive(owner, args[0], args[1], 0, out, args[2]) >>> 0, 0x80070057);
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff01c);
  }
  assert.strictEqual(e.test_ref(owner, 1), 2);
  assert.strictEqual(e.test_ref(owner, 0), 1);
  assert(e.test_find(owner, pending), 'non-final Release retains queued sends');
  assert.strictEqual(e.test_ref(owner, 0), 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff008, 'Release pops this and return address');
  assert.strictEqual(e.test_find(owner, pending), 0);
  assert(e.test_find(otherOwner, foreign), 'final Release does not clear another object');
  assert.strictEqual(e.test_bytes(), 4);
  assert.strictEqual(e.test_ref(otherOwner, 0), 0);
  assert.strictEqual(e.test_bytes(), 0);
  e.test_clear();
  e.test_id_limit(-1);
  assert.strictEqual(add(1, 0), 0xffffffff);
  assert.strictEqual(add(1, 0), 0, 'ID exhaustion cannot silently wrap and alias');
  e.test_clear();
  assert.strictEqual(e.test_bytes(), 0);
  console.log('PASS DirectPlay queue storage, public Receive/count contracts, and COM-release cleanup');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
