#!/usr/bin/env node

'use strict';

// Opt-in, per-app pacing of small stream sends to a wire peer (Nagle-style).
//
// WHY: a program's back-to-back small records reach the far side apart on a
// real network -- Nagle holds a small segment while the previous one is
// unacknowledged, and the receiver delays its ACK -- and some programs depend
// on that gap. Jazz Jackrabbit 2's server sends a 36-byte and a 2-byte join
// record together; when both reached the client in the same instant it never
// answered (1 of 5 joins on a loaded boat; the same runs with a 300 ms relay
// gap between DATA frames joined 5 of 5). An app that opts in (lib/apps.js
// vlanNagleMs, written with set_vlan_nagle_ms) has a small send made within
// that long of the socket's last DATA frame held. It is off by default --
// test-vlan-wire.js covers that small writes then arrive at once.

const assert = require('assert');
const { LoopbackSegment } = require('../lib/vlan-wire');
const { compile, makeNode, AF_INET, SOCK_STREAM } = require('./vlan-node');

const PORT = 10052;
const NAGLE_MS = 200;

(async () => {
  const wasm = await compile();
  const segment = new LoopbackSegment();
  let now = 1000000;
  const clock = { realNowMs: () => now };
  const server = await makeNode(wasm, segment.attach(), '10.0.0.1', clock);
  const client = await makeNode(wasm, segment.attach(), '10.0.0.2', clock);

  const srv = server.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
  assert.strictEqual(server.wat.test_call_bind(srv, server.sockaddr('0.0.0.0', PORT), 16) | 0, 0);
  assert.strictEqual(server.wat.test_call_listen(srv, 5) | 0, 0);
  const cli = client.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
  client.nonblocking(cli);
  client.wat.test_call_connect(cli, client.sockaddr('10.0.0.1', PORT), 16);
  server.pump();
  const acc = server.wat.test_call_accept(srv, 0, 0) | 0;
  assert(acc > 0, 'the server accepts the connection');
  server.nonblocking(acc);
  client.pump();
  // Off by default: back-to-back small sends both go at once.
  now += 1000;
  assert.strictEqual(server.wat.get_vlan_nagle_ms() | 0, 0, 'pacing is off unless an app asks');
  const into = client.buf(8192);
  for (const b of [Buffer.from('u'), Buffer.from('v')]) {
    assert.strictEqual(server.wat.test_call_send(acc, server.buf(b), 1, 0) | 0, 1);
  }
  assert.strictEqual(client.wire.pending, 2, 'without pacing both frames are on the wire');
  client.pump();
  assert.strictEqual(client.wat.test_call_recv(cli, into, 8192, 0) | 0, 2);
  console.log('PASS  pacing is off by default');
  server.wat.set_vlan_nagle_ms(NAGLE_MS);
  const send = bytes => server.wat.test_call_send(acc, server.buf(bytes), bytes.length, 0) | 0;

  // 1. Back-to-back small records: the first goes, the second waits.
  now += 1000;
  assert.strictEqual(send(Buffer.alloc(36, 0x24)), 36);
  assert.strictEqual(send(Buffer.from([2, 9])), 2, 'a held send still reports its bytes taken');
  assert.strictEqual(client.wire.pending, 1, 'only the first record is on the wire');
  client.pump();
  assert.strictEqual(client.wat.test_call_recv(cli, into, 8192, 0) | 0, 36);
  now += NAGLE_MS / 2;
  server.pump();
  assert.strictEqual(client.wire.pending, 0, 'not before the hold time has passed');
  now += NAGLE_MS;
  server.pump();
  assert.strictEqual(client.wire.pending, 1, 'then the held record goes out');
  client.pump();
  assert.strictEqual(client.wat.test_call_recv(cli, into, 8192, 0) | 0, 2);
  assert.deepStrictEqual(client.readBuf(into, 2), [2, 9]);
  console.log('PASS  back-to-back small sends reach the peer apart');

  // 2. A full-frame write is not held, and goes behind what is.
  now += 1000;
  assert.strictEqual(send(Buffer.from('a')), 1);           // goes now
  assert.strictEqual(send(Buffer.from('b')), 1);           // held
  const big = Buffer.alloc(4096, 0x63);
  assert.strictEqual(send(big), 4096);
  assert.strictEqual(client.wire.pending, 3, 'held bytes are flushed ahead of the full frame');
  client.pump();
  let got = '';
  for (;;) {
    const n = client.wat.test_call_recv(cli, into, 8192, 0) | 0;
    if (n <= 0) break;
    got += Buffer.from(client.readBuf(into, n)).toString('latin1');
  }
  assert.strictEqual(got, 'ab' + big.toString('latin1'), 'stream order is kept');
  console.log('PASS  a full-frame write is not held and keeps stream order');

  // 3. shutdown(SD_SEND) sends held bytes before its FIN.
  now += 1000;
  assert.strictEqual(send(Buffer.from('x')), 1);
  assert.strictEqual(send(Buffer.from('yz')), 2);           // held
  assert.strictEqual(server.wat.test_call_shutdown(acc, 1) | 0, 0);
  client.pump();
  assert.strictEqual(client.wat.test_call_recv(cli, into, 8192, 0) | 0, 3, 'the held bytes arrive');
  assert.strictEqual(Buffer.from(client.readBuf(into, 3)).toString(), 'xyz');
  assert.strictEqual(client.wat.test_call_recv(cli, into, 8192, 0) | 0, 0, 'then the orderly end');
  console.log('PASS  held bytes go out before the FIN');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
