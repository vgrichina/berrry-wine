#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const methods = {
  CreatePlayer: 7, CreateGroup: 6, AddPlayerToGroup: 3,
  DestroyPlayer: 2, Send: 6, Receive: 6, Close: 1, Release: 1,
};
const wrappers = Object.entries(methods).map(([name, count]) => `
  (func (export "test_${name}") (param $stack i32)
      ${Array.from({ length: count }, (_, i) => `(param $a${i} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    ${Array.from({ length: count }, (_, i) => `(call $gs32
      (i32.add (local.get $stack) (i32.const ${(i + 1) * 4})) (local.get $a${i}))`).join('\n')}
    (call $handle_IDirectPlay3_${name}
      ${Array.from({ length: 5 }, (_, i) => i < count ? `(local.get $a${i})` : '(i32.const 0)').join(' ')}
      (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))`).join('\n');
const extraWat = `${wrappers}
  (func (export "test_object") (result i32)
    (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))
  (export "test_query" (func $dp_message_query))
  (export "test_enqueue" (func $dp_message_enqueue))
  (export "test_clear_queue" (func $dp_messages_clear_owner))
  (export "test_entity" (func $dp_find_entity))
  (func (export "test_bytes") (result i32) (i32.load offset=24 (global.get $DP_SHARED)))
`;

(async () => {
  const events = [];
  let countAtSignal = () => 0;
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none',
    extraHostOverrides: { set_event: handle => {
      events.push({ handle, count: countAtSignal() });
      return 1;
    } },
  });
  e.init_dx_com_thunks();
  const alloc = size => e.guest_alloc(size) >>> 0;
  const stack = alloc(64);
  const outId = alloc(4);
  const fromPtr = alloc(4), toPtr = alloc(4), sizePtr = alloc(4), output = alloc(16);
  const data = alloc(1048576);
  const owner = e.test_object() >>> 0, other = e.test_object() >>> 0;
  assert(owner && other && owner !== other);
  const call = (name, ...args) => {
    assert.strictEqual(args.length, methods[name]);
    const result = e[`test_${name}`](stack, ...args) >>> 0;
    assert.strictEqual(e.get_esp() >>> 0, stack + (methods[name] + 1) * 4,
      `${name} stdcall cleanup on every success/error path`);
    return result;
  };
  const player = (object, event = 0) => {
    assert.strictEqual(call('CreatePlayer', object, outId, 0, event, 0, 0, 0), 0);
    return e.guest_read32(outId) >>> 0;
  };
  const group = object => {
    assert.strictEqual(call('CreateGroup', object, outId, 0, 0, 0, 0), 0);
    return e.guest_read32(outId) >>> 0;
  };
  const p1 = player(owner, 100), p2 = player(owner, 101), p3 = player(owner, 102);
  const foreign = player(other, 201);
  const count = (object = owner, to = 0) => e.test_query(object, 1, 0, to, 0);
  countAtSignal = count;
  const send = (to, flags = 0, size = 8, buffer = data) =>
    call('Send', owner, p1, to, flags, buffer, size);
  const receive = (object, recipient, size = 16) => {
    e.guest_write32(toPtr, recipient);
    e.guest_write32(sizePtr, size);
    const result = call('Receive', object, fromPtr, toPtr, 2, output, sizePtr);
    return { result, from: e.guest_read32(fromPtr) >>> 0, size: e.guest_read32(sizePtr) >>> 0 };
  };
  const seed = [17, 34, 51, 68, 85, 102, 119, 136];
  seed.forEach((byte, i) => e.guest_write8(data + i, byte));
  assert.strictEqual(send(p2), 0);
  assert.deepStrictEqual(events.splice(0), [{ handle: 101, count: 1 }]);
  e.guest_write32(data, 0);
  assert.deepStrictEqual(receive(owner, p2), { result: 0, from: p1, size: 8 });
  assert.deepStrictEqual(seed.map((_, i) => e.guest_read8(output + i)), seed,
    'public Send transfers an owned copy to public Receive');
  assert.strictEqual(count(), 0);

  assert.strictEqual(send(p1), 0);
  assert.strictEqual(count(), 0, 'the sender is excluded from local delivery');
  assert.strictEqual(send(0, 1), 0, 'guaranteed local broadcast');
  assert.strictEqual(count(), 2);
  assert.strictEqual(count(other), 0, 'broadcast does not join an unrelated object');
  assert.deepStrictEqual(events.splice(0), [{ handle: 101, count: 2 }, { handle: 102, count: 2 }],
    'all recipient messages exist before the first event notification');
  assert.strictEqual(receive(owner, p2).result, 0);
  assert.strictEqual(receive(owner, p3).result, 0);

  const g = group(owner), foreignGroup = group(other);
  assert.strictEqual(call('AddPlayerToGroup', owner, g, p2), 0);
  assert.strictEqual(call('AddPlayerToGroup', owner, g, p1), 0);
  assert.strictEqual(send(g, 2), 0);
  assert.strictEqual(count(owner, p2), 1);
  assert.strictEqual(count(owner, p3), 0);
  const queued = e.test_query(owner, 1, 0, p2, 2) >>> 0;
  assert.strictEqual(e.guest_read32(queued + 24), 65535);
  assert.deepStrictEqual(events.splice(0), [{ handle: 101, count: 1 }]);
  assert.strictEqual(receive(owner, p2).result, 0);

  assert.strictEqual(call('Send', other, p1, foreign, 0, data, 8), 0x88770096,
    'a foreign object cannot impersonate the sender');
  assert.strictEqual(send(foreign), 0x887700aa);
  assert.strictEqual(send(foreignGroup), 0x887700aa);
  assert.strictEqual(send(0xdeadbeef), 0x88770096);
  assert.strictEqual(send(p2, 4), 0x88770078);
  for (const flag of [8, 16, 32, 64, 128, 512, 1024]) {
    assert.strictEqual(send(p2, flag), 0x80004001, 'unsupported modes must not claim delivery');
  }
  assert.strictEqual(send(p2, 0, 1048577), 0x887700e6);
  assert.strictEqual(send(p2, 0, 1, 0), 0x80070057);
  assert.strictEqual(count(), 0);
  assert.deepStrictEqual(events, []);
  assert.strictEqual(send(p2, 0, 0, 0), 0);
  assert.strictEqual(receive(owner, p2, 0).result, 0);
  events.length = 0;

  for (let i = 0; i < 63; i++) assert(e.test_enqueue(owner, p1, p2, 0, 0, 0, 1));
  assert.strictEqual(send(0), 0x8007000e);
  assert.strictEqual(count(), 63, 'partial broadcast rolls back its first recipient copy');
  assert.strictEqual(e.test_bytes(), 0);
  assert.deepStrictEqual(events, [], 'failed broadcast signals nobody');
  e.test_clear_queue(owner);
  for (let i = 0; i < 3; i++) assert(e.test_enqueue(owner, p1, p2, data, 1048576, 0, 1));
  assert.strictEqual(send(0, 0, 1048576), 0x8007000e);
  assert.strictEqual(count(), 3);
  assert.strictEqual(e.test_bytes(), 3145728, 'byte-limit failure releases partial-send payloads');
  assert.deepStrictEqual(events, []);
  e.test_clear_queue(owner);

  assert.strictEqual(send(0), 0);
  assert.strictEqual(call('DestroyPlayer', owner, p1), 0);
  assert.strictEqual(count(), 2, 'destroying a sender does not retract already delivered messages');
  assert.strictEqual(send(p2), 0x88770096);
  assert.strictEqual(call('DestroyPlayer', owner, p2), 0);
  assert.strictEqual(count(), 1, 'destroying a recipient discards its unread messages');
  assert(e.test_enqueue(other, foreign, foreign, data, 8, 0, 1));
  assert.strictEqual(call('Close', owner), 0);
  assert.strictEqual(count(), 0);
  assert.strictEqual(count(other), 1);
  assert.strictEqual(e.test_entity(p3, 1), 0);
  assert(e.test_entity(foreign, 1), 'Close preserves another object\'s players');
  const replacement = player(owner);
  assert(![p1, p2, p3].includes(replacement));
  assert.strictEqual(call('Release', owner), 0);
  assert.strictEqual(e.test_entity(replacement, 1), 0, 'final Release also retires owned players');
  assert.strictEqual(count(other), 1);
  assert.strictEqual(call('Release', other), 0);
  assert.strictEqual(e.test_entity(foreign, 1), 0);
  assert.strictEqual(e.test_bytes(), 0);

  const lastOwner = e.test_object() >>> 0;
  const full = Array.from({ length: 32 }, () => player(lastOwner));
  assert.strictEqual(call('Send', lastOwner, full[0], full[31], 0, data, 8), 0);
  assert.strictEqual(count(lastOwner), 1, 'recipient bit 31 is not lost to signed masks');
  assert.deepStrictEqual(receive(lastOwner, full[31]), { result: 0, from: full[0], size: 8 });
  assert.strictEqual(call('Close', lastOwner), 0);
  assert.strictEqual(call('Release', lastOwner), 0);
  console.log('PASS DirectPlay public local send/receive, owner isolation, events, rollback, and cleanup');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
