#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RPC = require('../lib/guest-rpc');
const { sigs } = require('../lib/host-import-sigs.generated.json');
const STACK = 0x300000;
const wrapper = (name, n) => `
  (func (export "t_${name}") ${Array.from({ length: n }, (_, i) => `(param $p${i} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $handle_${name} ${Array.from({ length: 5 }, (_, i) => i < n ? `(local.get $p${i})` : '(i32.const 0)').join(' ')} (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const ${STACK + 4})) (then (unreachable)))
    (i32.load (global.get $reg_base)))`;
const extraWat = `
  (func (export "t_init") (global.set $image_base (i32.const 0)))
  (func (export "t_query") (param $fd i32) (result i32) (call $host_fs_crt_descriptor_query (local.get $fd)))
  ${wrapper('_open', 2)} ${wrapper('_dup', 1)} ${wrapper('_close', 1)}
  ${wrapper('_read', 3)} ${wrapper('_write', 3)} ${wrapper('_lseek', 3)}
`;
(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = h.exports, vfs = h.hostCtx.vfs;
  e.t_init();
  const path = 0x1000, buf = 0x2000;
  Buffer.from('c:\\descriptor-io.dat\0').forEach((b, i) => e.guest_write8(path + i, b));
  const fd = e.t__open(path, 0x8302);
  assert(fd > 0);
  assert.strictEqual(e.t_query(fd), 15);
  Buffer.from('abcdef').forEach((b, i) => e.guest_write8(buf + i, b));
  assert.strictEqual(e.t__write(fd, buf, 6), 6);
  assert.strictEqual(e.t__lseek(fd, 2, 0), 2);
  const dup = e.t__dup(fd);
  assert.strictEqual(e.t_query(dup), 15);
  assert.strictEqual(e.t__read(dup, buf, 2), 2);
  assert.strictEqual(e.guest_read8(buf), 99);
  assert.strictEqual(e.guest_read8(buf + 1), 100);
  assert.strictEqual(e.t__lseek(fd, 0, 1), 4);
  // Real generic broker round trip, using the same VFS and allocated memory.
  const broker = RPC.createMainBroker(h.memory, h.host, sigs, {});
  const remote = RPC.createWorkerImports(h.memory, sigs, msg => broker.serveRpc(msg.slot), { slot: 3 });
  assert.strictEqual(remote.imports.host.fs_crt_descriptor_query(fd), 15);
  assert.strictEqual(e.t__close(fd), 0);
  assert.strictEqual(remote.imports.host.fs_crt_descriptor_query(fd), 0);
  assert.strictEqual(e.t__read(fd, buf, 1), -1);
  assert.strictEqual(e.t__write(fd, buf, 1), -1);
  assert.strictEqual(e.t__lseek(fd, 0, 0), -1);
  assert.strictEqual(e.t__dup(fd), -1);
  assert.strictEqual(e.t__close(fd), -1);
  assert.strictEqual(e.t__read(dup, buf, 2), 2);
  assert.strictEqual(e.guest_read8(buf), 101);
  assert.strictEqual(e.t__close(dup), 0);
  const append = e.t__open(path, 0x8009);
  assert.strictEqual(e.t__lseek(append, 1, 0), 1);
  e.guest_write8(buf, 33);
  assert.strictEqual(e.t__write(append, buf, 1), 1);
  assert.strictEqual(e.t__read(append, buf, 1), -1);
  assert.strictEqual(Buffer.from(vfs.files.get('c:\\descriptor-io.dat').data).toString(), 'abcdef!');
  assert.strictEqual(e.t__close(append), 0);
  console.log('CRT descriptor actual WAT I/O and broker: PASS');
})().catch(error => { console.error(error); process.exit(1); });
