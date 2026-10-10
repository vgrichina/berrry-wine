#!/usr/bin/env node

'use strict';

// A WSAAsyncSelect server parked in GetMessage must wake when a peer's frame
// arrives on the wire.
//
// WHY: a host resumes a GetMessage park only when has_pending_message() says
// there is something to deliver, and the thing that turns an inbound frame
// into its FD_ACCEPT/FD_READ message is the $vsock_pump at the top of
// GetMessage -- which never runs while the guest is parked. Two copies of
// TetriNET in one browser tab therefore sat for good: the client's SYN in the
// server's inbox (pending=1), the server parked with nothing "pending", the
// client waiting for an answer. The CLI never showed it because run.js pumps
// the wire between batches on its own. has_pending_message() now drains the
// wire first, as the vlan_pump export does.

const assert = require('assert');
const { LoopbackSegment } = require('../lib/vlan-wire');
const { makeNode, AF_INET, SOCK_STREAM } = require('./vlan-node');
const { compileSrcWasm } = require('./compile-src');

const PORT = 31457;
const WM_SOCKET = 0x501;
const FD_ACCEPT = 0x08;

(async () => {
  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + String.raw`
    ;; A live HWND, so WSAAsyncSelect's posts route to this thread's queue.
    (func (export "test_make_window") (result i32)
      (local $hwnd i32)
      (local.set $hwnd (global.get $next_hwnd))
      (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
      (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
      (local.get $hwnd))
  ` : source);
  const segment = new LoopbackSegment();
  const server = await makeNode(wasm, segment.attach(), '10.0.0.1');
  const client = await makeNode(wasm, segment.attach(), '10.0.0.2');

  // The server: listening, told about connections by window message only.
  const srv = server.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
  assert.strictEqual(server.wat.test_call_bind(srv, server.sockaddr('0.0.0.0', PORT), 16) | 0, 0);
  assert.strictEqual(server.wat.test_call_listen(srv, 5) | 0, 0);
  const hwnd = server.wat.test_make_window() | 0;
  assert.strictEqual(server.wat.test_call_WSAAsyncSelect(srv, hwnd, WM_SOCKET, FD_ACCEPT) | 0, 0);
  server.wat.set_post_queue_count(0);
  assert.strictEqual(server.wat.has_pending_message() | 0, 0,
    'an idle listener with an empty wire has nothing to deliver');

  // The client connects; its SYN lands in the server's inbox and nothing on
  // the server side has run since.
  const cli = client.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
  client.nonblocking(cli);
  client.wat.test_call_connect(cli, client.sockaddr('10.0.0.1', PORT), 16);
  assert(server.wire.pending > 0, 'the SYN is waiting in the server inbox');

  // The question a parked GetMessage is resumed on.
  assert.strictEqual(server.wat.has_pending_message() | 0, 1,
    'an inbound connection wakes a GetMessage park');
  assert.strictEqual(server.wire.pending, 0, 'the frame was drained, not left for later');
  const posted = [];
  for (let i = 0; i < (server.wat.get_post_queue_count() | 0); i++) {
    posted.push({ msg: server.wat.post_queue_peek(i, 1) | 0,
      wParam: server.wat.post_queue_peek(i, 2) | 0, lParam: server.wat.post_queue_peek(i, 3) | 0 });
  }
  assert(posted.some(m => m.msg === WM_SOCKET && m.wParam === srv && (m.lParam & 0xFFFF) === FD_ACCEPT),
    `FD_ACCEPT is posted to the listener's window (posted ${JSON.stringify(posted)})`);

  console.log('PASS  an inbound frame wakes a WSAAsyncSelect server parked in GetMessage');

  // FD_READ is a re-enabling notification: one post, then none until the app
  // calls recv, which re-posts only if data is still queued. One post per
  // frame handed Delphi's ScktComp an FD_READ with nothing behind it, and its
  // ReceiveText turned the uninitialized buffer into TetriNET's next command.
  const FD_READ = 0x01;
  const acc = server.wat.test_call_accept(srv, 0, 0) | 0;
  assert(acc > 0, 'the listener accepts the queued connection');
  client.pump();                                    // the SYNACK
  assert.strictEqual(server.wat.test_call_WSAAsyncSelect(acc, hwnd, WM_SOCKET, FD_READ) | 0, 0);
  const reads = () => {
    let n = 0;
    for (let i = 0; i < (server.wat.get_post_queue_count() | 0); i++) {
      if ((server.wat.post_queue_peek(i, 1) | 0) === WM_SOCKET
          && (server.wat.post_queue_peek(i, 2) | 0) === acc
          && (server.wat.post_queue_peek(i, 3) & 0xFFFF) === FD_READ) n++;
    }
    return n;
  };
  server.wat.set_post_queue_count(0);
  for (const text of ['newgame', 'f 1 ']) {
    const bytes = Buffer.from(text);
    assert.strictEqual(client.wat.test_call_send(cli, client.buf(bytes), bytes.length, 0) | 0, bytes.length);
  }
  server.pump();
  assert.strictEqual(reads(), 1, 'two frames arriving together post one FD_READ');
  const into = server.buf(64);
  assert.strictEqual(server.wat.test_call_recv(acc, into, 4, 0) | 0, 4);
  assert.strictEqual(reads(), 2, 'a recv that leaves data queued re-posts FD_READ');
  assert.strictEqual(server.wat.test_call_recv(acc, into, 64, 0) | 0, 7);
  assert.strictEqual(reads(), 2, 'a recv that drains the socket posts nothing more');
  console.log('PASS  FD_READ is re-enabled by recv, not posted once per frame');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
