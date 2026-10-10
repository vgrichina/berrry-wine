#!/usr/bin/env node

// Slice 2 gate for the virtual LAN wire (docs/virtual-lan-party.md).
//
// Two independent emulator instances — separate memories, separate socket
// tables, separate room addresses — are put on one loopback segment and
// made to complete a TCP conversation through the public Winsock handlers.
// Slice 1 proved the switch behaves like TCP inside one process; this
// proves the same semantics survive being split across the wire, which is
// the property the WebRTC transport will later have to preserve.
//
// No Liquid War binary is involved. The two-process gate that runs the real
// client and server is test/test-vlan-loopback.js.

'use strict';

const assert = require('assert');
const { LoopbackSegment, describeFrame } = require('../lib/vlan-wire');
const { compile, makeNode, ip2int, AF_INET, SOCK_STREAM, INVALID_SOCKET } = require('./vlan-node');

const SOCK_DGRAM = 2;
const IPPROTO_UDP = 17;

const SD_SEND = 1;

const WSAEWOULDBLOCK = 10035;
const WSAEALREADY = 10037;
const WSAECONNRESET = 10054;
const WSAETIMEDOUT = 10060;
const WSAECONNREFUSED = 10061;

const HOST_IP = '10.0.0.1';
const PEER_IP = '10.0.0.2';
const GAME_PORT = 8035;

const VLN_MAGIC = 0x314e4c56;
const VLN_HDR = 28;
const MAX_PAYLOAD = 4096;

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
}

// Everything below drives nonblocking sockets and pumps explicitly, so a
// call that cannot make progress fails the assertion instead of hanging.
function settle(...nodes) {
  for (let round = 0; round < 8; round++) {
    let moved = false;
    for (const n of nodes) {
      if (n.wire.pending) { moved = true; }
      n.wat.vlan_pump();
    }
    if (!moved) break;
  }
}

async function main() {
  // The [net] trace names what it carries. DDEML frames share the wire under
  // 'DDE1' and must be read with their own layout: decoded as vln/1, a Hearts
  // poke (DDE type 6) printed as "DGRAM", and test-win16-hearts-vlan.js, which
  // counts pokes by that line, never saw one.
  check('describeFrame names DDE frames and keeps vln/1 type 6 as DGRAM', () => {
    const frame = (magic, type, words) => {
      const b = Buffer.alloc(28);
      b.writeUInt32LE(magic, 0); b.writeUInt32LE(type, 4);
      words.forEach((w, i) => b.writeUInt32LE(w >>> 0, 8 + i * 4));
      return new Uint8Array(b.buffer, b.byteOffset, b.length);
    };
    assert.strictEqual(describeFrame(frame(0x31454444, 6, [ip2int(PEER_IP), 1, 7, 1, 0])),
      'dde POKE 10.0.0.2 conv 1 -> 7 len=1');
    assert.strictEqual(describeFrame(frame(VLN_MAGIC, 6, [ip2int(PEER_IP), 5, ip2int(HOST_IP), 7, 46])),
      'DGRAM 10.0.0.2:5 -> 10.0.0.1:7 len=46');
  });

  const wasm = await compile();
  const segment = new LoopbackSegment();
  const host = await makeNode(wasm, segment.attach(), HOST_IP);
  const peer = await makeNode(wasm, segment.attach(), PEER_IP);

  check('each process keeps its own room address', () => {
    assert.strictEqual(host.wat.get_vlan_local_ip() >>> 0, ip2int(HOST_IP));
    assert.strictEqual(peer.wat.get_vlan_local_ip() >>> 0, ip2int(PEER_IP));
  });

  // ---- connectionless datagrams --------------------------------------

  const udpHost = host.wat.test_call_socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP) | 0;
  const udpPeer = peer.wat.test_call_socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP) | 0;
  host.nonblocking(udpHost);
  peer.nonblocking(udpPeer);
  assert.strictEqual(host.wat.test_call_bind(
    udpHost, host.sockaddr('0.0.0.0', GAME_PORT + 1), 16) | 0, 0);

  check('a UDP datagram crosses the wire with its source address', () => {
    const msg = Array.from(Buffer.from('UT2003/query'));
    assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(msg), msg.length, 0,
      peer.sockaddr(HOST_IP, GAME_PORT + 1), 16) | 0, msg.length);
    settle(host, peer);

    const rx = host.buf(64);
    const from = host.alloc(16);
    const fromLen = host.alloc(4);
    new DataView(host.memory.buffer, host.wa(fromLen), 4).setUint32(0, 16, true);
    const got = host.wat.test_call_recvfrom(udpHost, rx, 64, 0, from, fromLen) | 0;
    assert.strictEqual(got, msg.length,
      `recvfrom failed with WSA error ${host.err()} (wire pending ${host.wire.pending})`);
    assert.deepStrictEqual(host.readBuf(rx, msg.length), msg);
    assert.strictEqual(host.readSockaddr(from).ip, PEER_IP);
  });

  check('UDP preserves datagram boundaries while the receiver drains', () => {
    const one = [1, 2, 3];
    const two = [4, 5];
    const dst = peer.sockaddr(HOST_IP, GAME_PORT + 1);
    assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(one), one.length, 0, dst, 16) | 0, one.length);
    assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(two), two.length, 0, dst, 16) | 0, two.length);
    settle(host, peer);
    const rx = host.buf(8);
    assert.strictEqual(host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0, one.length);
    assert.deepStrictEqual(host.readBuf(rx, one.length), one);
    settle(host, peer);
    assert.strictEqual(host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0, two.length);
    assert.deepStrictEqual(host.readBuf(rx, two.length), two);
  });

  // Every Quake II client binds the server port and never reads it unless it
  // hosts. A datagram waiting for that socket sat at the head of the wire,
  // and everything behind it waited too: one player's server search froze
  // every other client in the room.
  check('a datagram for a socket nobody reads does not stall the wire', () => {
    const idle = host.wat.test_call_socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP) | 0;
    host.nonblocking(idle);
    assert.strictEqual(host.wat.test_call_bind(
      idle, host.sockaddr('0.0.0.0', GAME_PORT + 2), 16) | 0, 0);
    const toIdle = peer.sockaddr(HOST_IP, GAME_PORT + 2);
    for (const d of [[7], [8]]) {
      assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(d), 1, 0, toIdle, 16) | 0, 1);
    }
    const live = [9, 9];
    assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(live), live.length, 0,
      peer.sockaddr(HOST_IP, GAME_PORT + 1), 16) | 0, live.length);
    for (let i = 0; i < 100; i++) host.wat.vlan_pump();
    const rx = host.buf(8);
    assert.strictEqual(host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0, live.length,
      `the live socket got nothing: ${host.wire.pending} frame(s) still queued behind the idle one`);
    assert.deepStrictEqual(host.readBuf(rx, live.length), live);
    // The idle socket queued both, in order, each still one datagram.
    assert.strictEqual(host.wat.test_call_recvfrom(idle, rx, 8, 0, 0, 0) | 0, 1);
    assert.deepStrictEqual(host.readBuf(rx, 1), [7]);
    assert.strictEqual(host.wat.test_call_recvfrom(idle, rx, 8, 0, 0, 0) | 0, 1);
    assert.deepStrictEqual(host.readBuf(rx, 1), [8]);
    assert.strictEqual(host.wat.test_call_recvfrom(idle, rx, 8, 0, 0, 0) | 0, -1);
  });

  // Atomic Bomberman's join request is sent on every pass of a one-second
  // wait loop, and its IPX reader pulls up to 64 datagrams per poll into a
  // 64-slot ring that reads as empty after exactly 64. A real receive buffer
  // drops the flood; an unbounded queue hands all of it over.
  check('a flooded datagram socket keeps a bounded backlog and drops the rest', () => {
    const dst = peer.sockaddr(HOST_IP, GAME_PORT + 1);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf([i]), 1, 0, dst, 16) | 0, 1);
    }
    settle(host, peer);
    assert.strictEqual(host.wire.pending, 0, 'the flood must not wait on the wire');
    const rx = host.buf(8);
    const got = [];
    for (let n; (n = host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0) > 0;) {
      got.push(host.readBuf(rx, n)[0]);
    }
    assert.deepStrictEqual(got, Array.from({ length: 32 }, (_, i) => i));
  });

  // FIONREAD is a poll: a program that loops on sendto + FIONREAD and never
  // takes a message must still see what arrived, and a datagram socket
  // reports the payload bytes of everything queued.
  check('FIONREAD moves the wire and counts queued datagram payload', () => {
    const FIONREAD = 0x4004667f | 0;
    const dst = peer.sockaddr(HOST_IP, GAME_PORT + 1);
    for (const d of [[1, 2, 3], [4, 5]]) {
      assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(d), d.length, 0, dst, 16) | 0, d.length);
    }
    assert.strictEqual(host.wire.pending, 2);
    const p = host.buf(4);
    assert.strictEqual(host.wat.test_call_ioctlsocket(udpHost, FIONREAD, p) | 0, 0);
    assert.deepStrictEqual(host.readBuf(p, 4), [5, 0, 0, 0]);
    const rx = host.buf(8);
    const from = host.buf(16);
    const fromLen = host.buf([16, 0, 0, 0]);
    assert.strictEqual(host.wat.test_call_recvfrom(udpHost, rx, 8, 0, from, fromLen) | 0, 3);
    assert.strictEqual(host.readSockaddr(from).ip, PEER_IP);
    assert.strictEqual(host.wat.test_call_ioctlsocket(udpHost, FIONREAD, p) | 0, 0);
    assert.deepStrictEqual(host.readBuf(p, 4), [2, 0, 0, 0]);
    assert.strictEqual(host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0, 2);
  });

  check('a socket that is being read keeps every datagram in order', () => {
    const dst = peer.sockaddr(HOST_IP, GAME_PORT + 1);
    const burst = [[1], [2], [3], [4], [5]];
    for (const d of burst) {
      assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(d), 1, 0, dst, 16) | 0, 1);
    }
    const rx = host.buf(8);
    const got = [];
    for (let i = 0; i < 40 && got.length < burst.length; i++) {
      host.wat.vlan_pump();
      host.wat.vlan_pump();
      const n = host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0;
      if (n > 0) got.push(host.readBuf(rx, n)[0]);
    }
    assert.deepStrictEqual(got, [1, 2, 3, 4, 5]);
  });

  // ---- opening a connection across the wire ---------------------------

  const srv = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
  host.nonblocking(srv);
  assert.strictEqual(host.wat.test_call_bind(srv, host.sockaddr('0.0.0.0', GAME_PORT), 16) | 0, 0);
  assert.strictEqual(host.wat.test_call_listen(srv, 5) | 0, 0);

  const cli = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
  peer.nonblocking(cli);

  check('a nonblocking connect to another process is still in progress', () => {
    const r = peer.wat.test_call_connect(cli, peer.sockaddr(HOST_IP, GAME_PORT), 16) | 0;
    assert.strictEqual(r, -1);
    assert.strictEqual(peer.err(), WSAEWOULDBLOCK);
    // The SYN is on the wire; nothing has reached the host process yet.
    assert.strictEqual(host.wire.pending, 1);
  });

  check('polling an unfinished connect reports it is already under way', () => {
    // The host has not been given a chance to run, so the answer cannot
    // have arrived yet.
    const r = peer.wat.test_call_connect(cli, peer.sockaddr(HOST_IP, GAME_PORT), 16) | 0;
    assert.strictEqual(r, -1);
    assert.strictEqual(peer.err(), WSAEALREADY);
  });

  let acc = INVALID_SOCKET;
  check('the listener becomes readable once the SYN is delivered', () => {
    host.wat.vlan_pump();
    const set = host.fdset([srv]);
    const n = host.wat.test_call_select(0, set, 0, 0, host.timeval(0, 0)) | 0;
    assert.strictEqual(n, 1);
    assert.deepStrictEqual(host.fdsetList(set), [srv]);
  });

  check('accept reports the address of the process on the other side', () => {
    const sa = host.alloc(16);
    const len = host.alloc(4);
    new DataView(host.memory.buffer, host.wa(len), 4).setUint32(0, 16, true);
    acc = host.wat.test_call_accept(srv, sa, len) | 0;
    assert.notStrictEqual(acc, INVALID_SOCKET);
    host.nonblocking(acc);
    assert.strictEqual(host.readSockaddr(sa).ip, PEER_IP);
  });

  check('the connecting side completes once the answer comes back', () => {
    settle(host, peer);
    const r = peer.wat.test_call_connect(cli, peer.sockaddr(HOST_IP, GAME_PORT), 16) | 0;
    assert.strictEqual(r, 0);
  });

  // ---- bytes ----------------------------------------------------------

  check('bytes cross the wire in both directions', () => {
    const msg = Array.from(Buffer.from('LWSRV/hello'));
    assert.strictEqual(peer.wat.test_call_send(cli, peer.buf(msg), msg.length, 0) | 0, msg.length);
    settle(host, peer);
    const rx = host.buf(64);
    assert.strictEqual(host.wat.test_call_recv(acc, rx, 64, 0) | 0, msg.length);
    assert.deepStrictEqual(host.readBuf(rx, msg.length), msg);

    const back = Array.from(Buffer.from('LWCLI/ok'));
    assert.strictEqual(host.wat.test_call_send(acc, host.buf(back), back.length, 0) | 0, back.length);
    settle(host, peer);
    const rx2 = peer.buf(64);
    assert.strictEqual(peer.wat.test_call_recv(cli, rx2, 64, 0) | 0, back.length);
    assert.deepStrictEqual(peer.readBuf(rx2, back.length), back);
  });

  check('the wire preserves stream order across many small writes', () => {
    const expected = [];
    for (let i = 0; i < 40; i++) {
      const chunk = [i & 0xff, (i * 7) & 0xff, (i * 13) & 0xff];
      expected.push(...chunk);
      assert.strictEqual(peer.wat.test_call_send(cli, peer.buf(chunk), 3, 0) | 0, 3);
    }
    settle(host, peer);
    const rx = host.buf(256);
    const got = [];
    for (;;) {
      const n = host.wat.test_call_recv(acc, rx, 256, 0) | 0;
      if (n <= 0) break;
      got.push(...host.readBuf(rx, n));
      if (got.length >= expected.length) break;
    }
    assert.deepStrictEqual(got, expected, 'stream order must survive framing');
  });

  check('a write larger than one frame reports a partial count', () => {
    const big = new Array(MAX_PAYLOAD + 500).fill(0x5a);
    const n = peer.wat.test_call_send(cli, peer.buf(big), big.length, 0) | 0;
    assert.strictEqual(n, MAX_PAYLOAD, 'one send produces at most one frame');
    settle(host, peer);
    let drained = 0;
    const rx = host.buf(MAX_PAYLOAD);
    for (;;) {
      const got = host.wat.test_call_recv(acc, rx, MAX_PAYLOAD, 0) | 0;
      if (got <= 0) break;
      drained += got;
    }
    assert.strictEqual(drained, MAX_PAYLOAD);
  });

  // ---- flow control ---------------------------------------------------
  //
  // A stream frame that does not fit its ring cannot be dropped, and while it
  // waits at the head of the wire nothing behind it moves. So the sender
  // stops at the far ring's size, and the reader hands the room back.

  const WINDOW = 16384;
  const drainStream = () => {
    const rx = host.buf(MAX_PAYLOAD);
    let total = 0;
    for (;;) {
      settle(host, peer);
      const got = host.wat.test_call_recv(acc, rx, MAX_PAYLOAD, 0) | 0;
      if (got <= 0) break;
      total += got;
    }
    settle(host, peer);
    return total;
  };
  const writable = (node, s) =>
    (node.wat.test_call_select(0, 0, node.fdset([s]), 0, node.timeval(0, 0)) | 0) === 1;

  check('a sender stops at the far ring\'s size and is no longer writable', () => {
    const big = peer.buf(new Array(MAX_PAYLOAD).fill(0x33));
    let sent = 0;
    for (let i = 0; i < 16; i++) {
      const n = peer.wat.test_call_send(cli, big, MAX_PAYLOAD, 0) | 0;
      if (n < 0) { assert.strictEqual(peer.err(), WSAEWOULDBLOCK); break; }
      sent += n;
      settle(host, peer);
    }
    assert.strictEqual(sent, WINDOW);
    assert.strictEqual(writable(peer, cli), false);
  });

  check('a stalled connection does not hold up the rest of the wire', () => {
    // Nobody has read the stream, yet a datagram sent after it arrives.
    const msg = [9, 8, 7];
    assert.strictEqual(peer.wat.test_call_sendto(udpPeer, peer.buf(msg), msg.length, 0,
      peer.sockaddr(HOST_IP, GAME_PORT + 1), 16) | 0, msg.length);
    settle(host, peer);
    assert.strictEqual(host.wire.pending, 0, 'a frame is stuck at the head of the wire');
    const rx = host.buf(8);
    assert.strictEqual(host.wat.test_call_recvfrom(udpHost, rx, 8, 0, 0, 0) | 0, msg.length);
    assert.deepStrictEqual(host.readBuf(rx, msg.length), msg);
  });

  check('reading hands the window back, and the sender carries on', () => {
    const rx = host.buf(MAX_PAYLOAD);
    assert.strictEqual(host.wat.test_call_recv(acc, rx, MAX_PAYLOAD, 0) | 0, MAX_PAYLOAD);
    settle(host, peer);
    assert.strictEqual(writable(peer, cli), true);
    const big = peer.buf(new Array(MAX_PAYLOAD).fill(0x44));
    assert.strictEqual(peer.wat.test_call_send(cli, big, MAX_PAYLOAD, 0) | 0, MAX_PAYLOAD);
    settle(host, peer);
    assert.strictEqual(drainStream(), WINDOW);
  });

  check('a flood of 1-byte sends is bounded in frames, not only bytes', () => {
    const one = peer.buf([1]);
    let frames = 0;
    for (;;) {
      const n = peer.wat.test_call_send(cli, one, 1, 0) | 0;
      if (n < 0) { assert.strictEqual(peer.err(), WSAEWOULDBLOCK); break; }
      frames++;
      assert.ok(frames <= WINDOW, 'the window never closed');
    }
    assert.strictEqual(frames, WINDOW / 64);
    assert.strictEqual(host.wire.pending, frames);
    // Taking the frames off the wire returns their overhead without the
    // guest reading a byte.
    settle(host, peer);
    assert.strictEqual(writable(peer, cli), true);
    assert.strictEqual(drainStream(), frames);
  });

  // ---- addressing and malformed input ---------------------------------

  check('a frame addressed to another member is ignored', () => {
    const f = new Uint8Array(VLN_HDR);
    const v = new DataView(f.buffer);
    v.setUint32(0, VLN_MAGIC, true);
    v.setUint32(4, 5, true);                    // RST
    v.setUint32(8, ip2int('10.0.0.9'), true);
    v.setUint32(12, 1234, true);
    v.setUint32(16, ip2int('10.0.0.7'), true); // not this process
    v.setUint32(20, GAME_PORT, true);
    v.setUint32(24, 0, true);
    host.wire.deliver(f);
    host.wat.vlan_pump();
    assert.strictEqual(host.wire.pending, 0, 'the frame is consumed, not stuck');
    // The established connection is untouched.
    const msg = [1, 2, 3];
    assert.strictEqual(host.wat.test_call_send(acc, host.buf(msg), 3, 0) | 0, 3);
    settle(host, peer);
    const rx = peer.buf(8);
    assert.strictEqual(peer.wat.test_call_recv(cli, rx, 8, 0) | 0, 3);
  });

  check('a malformed frame is dropped without stalling the wire', () => {
    host.wire.deliver(new Uint8Array([1, 2, 3]));                  // too short
    const bad = new Uint8Array(VLN_HDR);
    new DataView(bad.buffer).setUint32(0, 0xdeadbeef, true);       // wrong magic
    host.wire.deliver(bad);
    host.wat.vlan_pump();
    assert.strictEqual(host.wire.pending, 0);
    const msg = [9, 9];
    assert.strictEqual(peer.wat.test_call_send(cli, peer.buf(msg), 2, 0) | 0, 2);
    settle(host, peer);
    const rx = host.buf(8);
    assert.strictEqual(host.wat.test_call_recv(acc, rx, 8, 0) | 0, 2);
  });

  check('a frame whose declared length disagrees with its size is dropped', () => {
    const f = new Uint8Array(VLN_HDR + 4);
    const v = new DataView(f.buffer);
    v.setUint32(0, VLN_MAGIC, true);
    v.setUint32(4, 3, true);
    v.setUint32(8, ip2int(PEER_IP), true);
    v.setUint32(12, 40000, true);
    v.setUint32(16, ip2int(HOST_IP), true);
    v.setUint32(20, GAME_PORT, true);
    v.setUint32(24, 999, true);                 // claims 999 payload bytes
    host.wire.deliver(f);
    host.wat.vlan_pump();
    assert.strictEqual(host.wire.pending, 0);
  });

  // ---- closing --------------------------------------------------------

  check('an orderly shutdown delivers EOF to the other process', () => {
    assert.strictEqual(peer.wat.test_call_shutdown(cli, SD_SEND) | 0, 0);
    settle(host, peer);
    const rx = host.buf(8);
    assert.strictEqual(host.wat.test_call_recv(acc, rx, 8, 0) | 0, 0, 'EOF, not an error');
  });

  check('an abortive close resets the other process', () => {
    const s2 = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    host.nonblocking(s2);
    assert.strictEqual(host.wat.test_call_bind(s2, host.sockaddr('0.0.0.0', 9100), 16) | 0, 0);
    assert.strictEqual(host.wat.test_call_listen(s2, 5) | 0, 0);

    const c2 = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    peer.nonblocking(c2);
    peer.wat.test_call_connect(c2, peer.sockaddr(HOST_IP, 9100), 16);
    settle(host, peer);
    const a2 = host.wat.test_call_accept(s2, 0, 0) | 0;
    assert.notStrictEqual(a2, INVALID_SOCKET);
    host.nonblocking(a2);
    settle(host, peer);
    assert.strictEqual(peer.wat.test_call_connect(c2, peer.sockaddr(HOST_IP, 9100), 16) | 0, 0);

    // Close with the write half still open: TCP aborts.
    assert.strictEqual(host.wat.test_call_closesocket(a2) | 0, 0);
    settle(host, peer);
    const rx = peer.buf(8);
    assert.strictEqual(peer.wat.test_call_recv(c2, rx, 8, 0) | 0, -1);
    assert.strictEqual(peer.err(), WSAECONNRESET);
    host.wat.test_call_closesocket(s2);
    peer.wat.test_call_closesocket(c2);
  });

  check('connecting to a port nobody listens on is refused across the wire', () => {
    const c3 = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    peer.nonblocking(c3);
    assert.strictEqual(peer.wat.test_call_connect(c3, peer.sockaddr(HOST_IP, 9999), 16) | 0, -1);
    assert.strictEqual(peer.err(), WSAEWOULDBLOCK);
    settle(host, peer);
    assert.strictEqual(peer.wat.test_call_connect(c3, peer.sockaddr(HOST_IP, 9999), 16) | 0, -1);
    assert.strictEqual(peer.err(), WSAECONNREFUSED);
    peer.wat.test_call_closesocket(c3);
  });

  check('an address outside the room is unreachable, wire or not', () => {
    const c4 = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    peer.nonblocking(c4);
    assert.strictEqual(peer.wat.test_call_connect(c4, peer.sockaddr('93.184.216.34', 80), 16) | 0, -1);
    assert.strictEqual(peer.err(), 10051, 'WSAENETUNREACH');
    assert.strictEqual(peer.wire.sentFrames > 0, true);
    peer.wat.test_call_closesocket(c4);
  });

  // ---- blocking parks the call instead of lying ------------------------

  check('a blocking accept with an empty backlog parks on the net_wait yield', () => {
    const s5 = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(host.wat.test_call_bind(s5, host.sockaddr('0.0.0.0', 9200), 16) | 0, 0);
    assert.strictEqual(host.wat.test_call_listen(s5, 5) | 0, 0);
    assert.strictEqual(host.wat.get_yield_reason() | 0, 0);
    host.wat.test_call_accept(s5, 0, 0);
    assert.strictEqual(host.wat.get_yield_reason() | 0, 8, 'net_wait');
    host.wat.clear_yield();
    host.wat.test_call_closesocket(s5);
  });

  check('a blocking recv on an idle connection parks the same way', () => {
    const s6 = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    host.nonblocking(s6);
    assert.strictEqual(host.wat.test_call_bind(s6, host.sockaddr('0.0.0.0', 9300), 16) | 0, 0);
    assert.strictEqual(host.wat.test_call_listen(s6, 5) | 0, 0);
    const c6 = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    peer.nonblocking(c6);
    peer.wat.test_call_connect(c6, peer.sockaddr(HOST_IP, 9300), 16);
    settle(host, peer);
    const a6 = host.wat.test_call_accept(s6, 0, 0) | 0;
    assert.notStrictEqual(a6, INVALID_SOCKET);
    // a6 stays blocking: nothing is buffered, so recv must park.
    host.wat.test_call_recv(a6, host.buf(8), 8, 0);
    assert.strictEqual(host.wat.get_yield_reason() | 0, 8, 'net_wait');
    host.wat.clear_yield();
    host.wat.test_call_closesocket(a6);
    host.wat.test_call_closesocket(s6);
    peer.wat.test_call_closesocket(c6);
    settle(host, peer);
  });

  check('select with a finite timeout waits rather than returning at once', () => {
    const s7 = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    host.nonblocking(s7);
    assert.strictEqual(host.wat.test_call_bind(s7, host.sockaddr('0.0.0.0', 9400), 16) | 0, 0);
    assert.strictEqual(host.wat.test_call_listen(s7, 5) | 0, 0);
    const set = host.fdset([s7]);
    host.wat.test_call_select(0, set, 0, 0, host.timeval(1, 0));
    assert.strictEqual(host.wat.get_yield_reason() | 0, 8, 'net_wait');
    // The set is untouched, so the re-entered call still knows what to watch.
    assert.deepStrictEqual(host.fdsetList(set), [s7]);
    host.wat.clear_yield();
    host.wat.test_call_closesocket(s7);
  });

  check('select with a zero timeout is a poll and empties the sets', () => {
    const s8 = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    host.nonblocking(s8);
    assert.strictEqual(host.wat.test_call_bind(s8, host.sockaddr('0.0.0.0', 9500), 16) | 0, 0);
    assert.strictEqual(host.wat.test_call_listen(s8, 5) | 0, 0);
    const set = host.fdset([s8]);
    assert.strictEqual(host.wat.test_call_select(0, set, 0, 0, host.timeval(0, 0)) | 0, 0);
    assert.strictEqual(host.wat.get_yield_reason() | 0, 0, 'a poll never parks');
    assert.deepStrictEqual(host.fdsetList(set), []);
    host.wat.test_call_closesocket(s8);
  });

  // ---- a peer that leaves without a word ------------------------------

  check('a closed link resets every connection to that address', () => {
    const s9 = host.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    host.nonblocking(s9);
    assert.strictEqual(host.wat.test_call_bind(s9, host.sockaddr('0.0.0.0', 9600), 16) | 0, 0);
    assert.strictEqual(host.wat.test_call_listen(s9, 5) | 0, 0);
    const c9 = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    peer.nonblocking(c9);
    peer.wat.test_call_connect(c9, peer.sockaddr(HOST_IP, 9600), 16);
    settle(host, peer);
    const a9 = host.wat.test_call_accept(s9, 0, 0) | 0;
    assert.notStrictEqual(a9, INVALID_SOCKET);
    // a9 stays blocking: with no GONE this recv would park for ever.
    host.wat.test_call_recv(a9, host.buf(8), 8, 0);
    assert.strictEqual(host.wat.get_yield_reason() | 0, 8, 'parked before the link closes');
    host.wat.clear_yield();
    host.wire.peerGone(ip2int(PEER_IP));
    assert.strictEqual(host.wat.test_call_recv(a9, host.buf(8), 8, 0) | 0, -1);
    assert.strictEqual(host.err(), WSAECONNRESET);
    assert.strictEqual(host.wat.get_yield_reason() | 0, 0, 'answered, not parked');
    // The listener belongs to nobody in particular and keeps listening.
    const set = host.fdset([s9]);
    assert.strictEqual(host.wat.test_call_select(0, 0, 0, set, host.timeval(0, 0)) | 0, 0);
    host.wat.test_call_closesocket(a9);
    host.wat.test_call_closesocket(s9);
    peer.wat.test_call_closesocket(c9);
    host.wire.inbox.length = 0;
  });

  check('losing every address fails a connect in flight with WSAETIMEDOUT', () => {
    const c10 = peer.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    peer.nonblocking(c10);
    assert.strictEqual(peer.wat.test_call_connect(c10, peer.sockaddr(HOST_IP, 9700), 16) | 0, -1);
    assert.strictEqual(peer.err(), WSAEWOULDBLOCK);
    host.wire.inbox.length = 0;         // the SYN is lost with the link
    peer.wire.peerGone(0xFFFFFFFF);
    assert.strictEqual(peer.wat.test_call_connect(c10, peer.sockaddr(HOST_IP, 9700), 16) | 0, -1);
    assert.strictEqual(peer.err(), WSAETIMEDOUT);
    peer.wat.test_call_closesocket(c10);
  });

  await mutePeer(wasm);

  console.log(`\n${passed}/${passed} virtual LAN wire checks passed`);
}

// A connect whose SYN reaches nobody gives up after the 20 s the switch
// allows, measured on the WALL clock -- here a clock the test moves. Not the
// guest clock: test/run.js runs that at 200 ms a batch, and a client idling
// while its SYN crossed the process hub gave up in milliseconds and reset the
// server's freshly accepted socket (TetriNET, Liquid War: WSAECONNRESET).
async function mutePeer(wasm) {
  const segment = new LoopbackSegment();
  let now = 1000;
  let guest = 1000;
  const node = await makeNode(wasm, segment.attach(), PEER_IP,
    { realNowMs: () => now, guestNowMs: () => guest });
  segment.attach();                     // a seat that never reads its wire
  check('a connect nobody answers times out on the wall clock, not the guest clock', () => {
    const c = node.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    // Blocking: the call parks and is re-entered, as the host does.
    node.wat.test_call_connect(c, node.sockaddr(HOST_IP, 9800), 16);
    assert.strictEqual(node.wat.get_yield_reason() | 0, 8, 'net_wait');
    node.wat.clear_yield();
    guest += 600000;                    // ten guest minutes, no real time
    node.wat.test_call_connect(c, node.sockaddr(HOST_IP, 9800), 16);
    assert.strictEqual(node.wat.get_yield_reason() | 0, 8,
      'the guest clock racing ahead does not time the connect out');
    node.wat.clear_yield();
    now += 19000;
    node.wat.test_call_connect(c, node.sockaddr(HOST_IP, 9800), 16);
    assert.strictEqual(node.wat.get_yield_reason() | 0, 8, 'still waiting at 19 s');
    node.wat.clear_yield();
    now += 2000;
    assert.strictEqual(node.wat.test_call_connect(c, node.sockaddr(HOST_IP, 9800), 16) | 0, -1);
    assert.strictEqual(node.err(), WSAETIMEDOUT);
    // A late answer is refused for it: the switch sent a reset after the SYN.
    assert.strictEqual(node.wire.sentFrames, 2);
    // And the socket can be pointed somewhere else.
    node.wat.test_call_connect(c, node.sockaddr(HOST_IP, 9801), 16);
    assert.strictEqual(node.wat.get_yield_reason() | 0, 8, 'a fresh connect');
    node.wat.clear_yield();
  });
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
