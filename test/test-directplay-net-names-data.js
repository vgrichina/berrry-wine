#!/usr/bin/env node
'use strict';

// The DirectPlay virtual-LAN provider (src/09d4-dplay-net.wat), receive side,
// without a second process: what a peer's PLAYER_ADD and PLAYER_DATA frames
// and a session record turn into on this machine.
//
//   1. PLAYER_ADD carrying the owner's IDirectPlay4W short name after the 1252
//      one: W GetPlayerName returns those UTF-16 units exactly, including one
//      1252 cannot hold. Age of Empires II stores 1252 bytes in its W name
//      fields, and before this every remote name came back "?".
//      A PLAYER_ADD without the tail still widens its 1252 name.
//   2. PLAYER_DATA (a SetPlayerData without DPSET_LOCAL elsewhere): the remote
//      player's GetPlayerData returns it, and the local players receive
//      DPMSG_SETPLAYERORGROUPDATA from DPID_SYSMSG with lpData pointing at the
//      data inside the buffer Receive filled. Age of Empires keeps its lobby
//      state there and leaves the join ("Unable to join game") without it.
//   3. PLAYER_DATA in the join snapshot updates the data and queues nothing;
//      PLAYER_DATA naming a player of this machine is ignored.
//   4. GetSessionDesc through IDirectPlay4W returns the host's own UTF-16
//      session name when the record carries one, and widens the 1252 name of
//      a record that does not (an ANSI host, or the original 76-byte reply).
//
// The two-process routes these serve are test-aoe2-vlan-gameplay.js and
// test-aoe1-vlan-gameplay.js (heavy, boat).

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const methods = { CreatePlayer: 7, Receive: 6 };
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
  (func (export "test_w8") (param $ga i32) (param $v i32) (call $gs8 (local.get $ga) (local.get $v)))
  (func (export "test_r8") (param $ga i32) (result i32) (call $gl8 (local.get $ga)))
  (func (export "test_r16") (param $ga i32) (result i32) (call $gl16 (local.get $ga)))
  (func (export "test_net_host") (param $owner i32) (result i32)
    (if (i32.eqz (call $dpn_activate (local.get $owner))) (then (return (i32.const 0))))
    (i32.store offset=44 (global.get $DP_SHARED) (local.get $owner))
    (i32.store offset=40 (global.get $DP_SHARED) (i32.const 1))
    (i32.load offset=80 (global.get $DP_SHARED)))
  ;; What $dpn_deliver does with a PLAYER_ADD payload of $len bytes.
  (func (export "test_player_add") (param $id i32) (param $payload i32) (param $len i32) (param $ip i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dpn_add_remote (local.get $id) (call $gl32 (local.get $payload))
      (i32.add (local.get $payload) (i32.const 4)) (local.get $ip)))
    (if (local.get $entry)
      (then (call $dpn_remote_wide_name (local.get $entry) (local.get $payload) (local.get $len))))
    (local.get $entry))
  (export "test_player_data" (func $dpn_receive_player_data))
  (export "test_w_name" (func $dpw_get_name))
  (export "test_get_data" (func $dp_get_data))
  (export "test_session_desc" (func $dpn_get_session_desc))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_dx_com_thunks();
  const alloc = size => e.guest_alloc(size) >>> 0;
  const r32 = ga => e.guest_read32(ga) >>> 0;
  const w32 = (ga, v) => e.guest_write32(ga, v);
  const bytes = (ga, list) => list.forEach((b, i) => e.test_w8(ga + i, b));
  const units = (ga, n) => Array.from({ length: n }, (_, i) => e.test_r16(ga + i * 2));
  const stack = alloc(64), outId = alloc(4), sizePtr = alloc(4);
  const fromPtr = alloc(4), toPtr = alloc(4), buf = alloc(512);

  const owner = e.test_object() >>> 0;
  assert(owner, 'DirectPlay object');
  assert.strictEqual(e.test_CreatePlayer(stack, owner, outId, 0, 0, 0, 0, 0) >>> 0, 0, 'local player');
  const local = r32(outId);
  const session = e.test_net_host(owner) >>> 0;
  assert(session, 'provider activates');
  const peer = 0x0200000a;   // 10.0.0.2

  // 1. W name rides after the 1252 one, as raw units ending in a 16-bit NUL.
  const remote = 0x30101;
  const nameW = [0x52, 0x65, 0x6e, 0x0100, 0x65];   // "Ren" U+0100 "e"
  const add = alloc(64);
  w32(add, 0);
  bytes(add + 4, [0x52, 0x65, 0x6e, 0x3f, 0x65, 0]);
  nameW.concat([0]).forEach((u, i) => bytes(add + 10 + i * 2, [u & 0xff, u >> 8]));
  assert(e.test_player_add(remote, add, 10 + 12, peer), 'remote player added');
  w32(sizePtr, 512);
  assert.strictEqual(e.test_w_name(remote, 1, buf, sizePtr) >>> 0, 0, 'W GetPlayerName');
  assert.deepStrictEqual(units(r32(buf + 8), 6), nameW.concat([0]),
    'W short name is the owner\'s exact units, not a 1252 round trip');
  console.log('PASS  PLAYER_ADD carries the IDirectPlay4W name losslessly');

  const legacy = 0x30102;
  const add2 = alloc(16);
  w32(add2, 0);
  bytes(add2 + 4, [0x43, 0x61, 0x66, 0xe9, 0]);   // "Caf\xe9", no W tail
  assert(e.test_player_add(legacy, add2, 9, peer), 'legacy remote player added');
  w32(sizePtr, 512);
  assert.strictEqual(e.test_w_name(legacy, 1, buf, sizePtr) >>> 0, 0, 'W GetPlayerName (legacy)');
  assert.deepStrictEqual(units(r32(buf + 8), 5), [0x43, 0x61, 0x66, 0xe9, 0],
    'a PLAYER_ADD without the tail widens its 1252 name');
  console.log('PASS  PLAYER_ADD without a W name widens the 1252 one');

  // 2. PLAYER_DATA after the join: readable, and announced.
  const data = alloc(16);
  bytes(data, [1, 2, 3, 4, 5, 6, 7, 8]);
  e.test_player_data(remote, 0, data, 8);
  const got = alloc(16);
  w32(sizePtr, 16);
  assert.strictEqual(e.test_get_data(remote, 1, got, sizePtr, 0) >>> 0, 0, 'GetPlayerData on the remote player');
  assert.strictEqual(r32(sizePtr), 8);
  assert.deepStrictEqual(Array.from({ length: 8 }, (_, i) => e.test_r8(got + i)), [1, 2, 3, 4, 5, 6, 7, 8]);
  w32(fromPtr, 0); w32(toPtr, 0); w32(sizePtr, 512);
  assert.strictEqual(e.test_Receive(stack, owner, fromPtr, toPtr, 0, buf, sizePtr) >>> 0, 0, 'Receive the system message');
  assert.strictEqual(r32(fromPtr), 0, 'from DPID_SYSMSG');
  assert.strictEqual(r32(toPtr), local, 'to the local player');
  assert.strictEqual(r32(sizePtr), 28, '20-byte header + 8 data bytes');
  assert.strictEqual(r32(buf), 0x102, 'DPSYS_SETPLAYERORGROUPDATA');
  assert.strictEqual(r32(buf + 4), 1, 'DPPLAYERTYPE_PLAYER');
  assert.strictEqual(r32(buf + 8), remote, 'dpId');
  assert.strictEqual(r32(buf + 12), buf + 20, 'lpData points into the received buffer');
  assert.strictEqual(r32(buf + 16), 8, 'dwDataSize');
  assert.deepStrictEqual(Array.from({ length: 8 }, (_, i) => e.test_r8(buf + 20 + i)), [1, 2, 3, 4, 5, 6, 7, 8]);
  console.log('PASS  PLAYER_DATA updates GetPlayerData and delivers DPMSG_SETPLAYERORGROUPDATA');

  // 3. Join snapshot: data only. A frame naming a local player is ignored.
  bytes(data, [9, 9, 9]);
  e.test_player_data(remote, 1, data, 3);
  w32(sizePtr, 16);
  assert.strictEqual(e.test_get_data(remote, 1, got, sizePtr, 0) >>> 0, 0);
  assert.strictEqual(r32(sizePtr), 3, 'snapshot data replaces the old data');
  w32(sizePtr, 512);
  assert.strictEqual(e.test_Receive(stack, owner, fromPtr, toPtr, 0, buf, sizePtr) >>> 0, 0x887700BE,
    'a snapshot queues no message (DPERR_NOMESSAGES)');
  e.test_player_data(local, 0, data, 3);
  w32(sizePtr, 16);
  assert.strictEqual(e.test_get_data(local, 1, got, sizePtr, 0) >>> 0, 0);
  assert.strictEqual(r32(sizePtr), 0, 'a peer cannot overwrite a player of this machine');
  console.log('PASS  snapshot PLAYER_DATA is silent; local players are not overwritten');

  // 4. Session names. Record: +44 1252 name (32 bytes), +76 UTF-16 name.
  const sname = [0x48, 0x6f, 0x0100, 0x74];   // "Ho" U+0100 "t"
  bytes(session + 44, [0x48, 0x6f, 0x3f, 0x74, 0]);
  sname.concat([0]).forEach((u, i) => bytes(session + 76 + i * 2, [u & 0xff, u >> 8]));
  w32(sizePtr, 0);
  assert.strictEqual(e.test_session_desc(0, sizePtr, 1) >>> 0, 0x8877001E, 'size probe');
  assert.strictEqual(r32(sizePtr), 80 + 10, 'W size counts the UTF-16 name');
  w32(sizePtr, 512);
  assert.strictEqual(e.test_session_desc(buf, sizePtr, 1) >>> 0, 0, 'W GetSessionDesc');
  assert.strictEqual(r32(buf + 48), buf + 80);
  assert.deepStrictEqual(units(buf + 80, 5), sname.concat([0]), 'the host\'s own units');
  w32(sizePtr, 512);
  assert.strictEqual(e.test_session_desc(buf, sizePtr, 0) >>> 0, 0, 'A GetSessionDesc');
  assert.deepStrictEqual(Array.from({ length: 5 }, (_, i) => e.test_r8(buf + 80 + i)), [0x48, 0x6f, 0x3f, 0x74, 0],
    'ANSI readers keep the 1252 name');
  bytes(session + 44, [0x43, 0x61, 0x66, 0xe9, 0]);
  bytes(session + 76, [0, 0]);
  w32(sizePtr, 512);
  assert.strictEqual(e.test_session_desc(buf, sizePtr, 1) >>> 0, 0);
  assert.deepStrictEqual(units(buf + 80, 5), [0x43, 0x61, 0x66, 0xe9, 0], 'no W name: the 1252 one widened');
  console.log('PASS  GetSessionDesc W name: stored units, else the 1252 name widened');

  console.log('test-directplay-net-names-data: all checks passed');
})().catch(err => { console.error(err); process.exit(1); });
