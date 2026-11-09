#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { setEnvironmentVariable, setEnvironmentVariableOwned } = require('../lib/process-boot');
const { createGuestMainOwner } = require('../lib/guest-main-owner');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const path = require('path');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;

const extraWat = String.raw`
  (func (export "test_launch_env_len") (result i32) (global.get $launch_env_len))
  (func (export "test_env_block") (result i32) (global.get $env_block))
  (func (export "test_zero_image_base") (global.set $image_base (i32.const 0)))
  (func (export "test_get_environment_a")
      (param $name i32) (param $buffer i32) (param $size i32) (result i32)
    (global.set $image_base (i32.const 0))
    (call $env_get (local.get $name) (local.get $buffer) (local.get $size) (i32.const 0)))
`;

(async () => {
  const { exports: wat, memory, module } = await bootRenderHarness({ extraWat, fonts: 'none' });
  assert(setEnvironmentVariable(wat, memory.buffer, 'SDL_RENDER_DRIVER', 'software'));
  assert.strictEqual(wat.test_launch_env_len(), 27);
  assert.strictEqual(wat.test_env_block(), 0, 'environment remains lazy before first query');

  const name = 0x2600;
  const buffer = 0x2700;
  const bytes = new TextEncoder().encode('SDL_RENDER_DRIVER\0');
  wat.test_zero_image_base();
  bytes.forEach((value, index) => wat.guest_write8(name + index, value));
  const result = wat.test_get_environment_a(name, buffer, 32);
  if (result !== 8) {
    const env = [];
    const envBlock = wat.test_env_block();
    for (let i = 0, zeros = 0; i < 512 && zeros < 2; i++) {
      const ch = wat.guest_read8(envBlock + i);
      env.push(ch);
      zeros = ch ? 0 : zeros + 1;
    }
    throw new Error(`launch environment lookup returned ${result}: ${Buffer.from(env).toString('latin1').replace(/\0/g, '|')}`);
  }
  const value = Buffer.from(Array.from({ length: 9 }, (_, index) => wat.guest_read8(buffer + index)))
    .toString('latin1').replace(/\0.*$/, '');
  assert.strictEqual(value, 'software');
  for (const remote of [false, true]) {
    const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none' });
    let worker;
    try {
      if (remote) {
        h.exports.set_host_shadow(1);
        worker = new GuestThreadHost({ module, memory: h.memory, hostImports: h.host, sigs,
          workerUrl: path.join(__dirname, '../lib/guest-worker.js'), clockIntervalMs: 0 });
        await worker.start();
      }
      const owner = createGuestMainOwner(remote ? { worker } : { localExports: h.exports });
      assert(await setEnvironmentVariableOwned(owner, h.memory.buffer, 'SDL_RENDER_DRIVER', 'software'));
      assert.deepStrictEqual(await owner.read(['test_launch_env_len', 'test_env_block']),
        { test_launch_env_len: 27, test_env_block: 0 });
      assert.strictEqual(await setEnvironmentVariableOwned(owner, h.memory.buffer, 'SDL_RENDER_DRIVER', null),
        false, 'launch override API rejects null; it is not a runtime deletion API');
      assert(await setEnvironmentVariableOwned(owner, h.memory.buffer, 'EMPTY', ''));
      if (remote) assert.strictEqual(h.exports.test_launch_env_len(), 0, 'shadow did not queue override');
      await owner.call('test_zero_image_base');
      for (let i = 0; i < bytes.length; i++) await owner.call('guest_write8', name + i, bytes[i]);
      assert.strictEqual(await owner.call('test_get_environment_a', name, buffer, 32), 8);
      const actual = [];
      for (let i = 0; i < 8; i++) actual.push(await owner.call('guest_read8', buffer + i));
      assert.strictEqual(Buffer.from(actual).toString(), 'software');
      if (remote) assert.strictEqual(h.exports.test_env_block(), 0, 'query initializes only owning instance');
    } finally { await worker?.stop(); }
  }
  const scratch = new ArrayBuffer(32), sentinel = new Uint8Array(scratch);
  sentinel.fill(0xa5);
  const fake = { supports: () => true,
    read: async () => ({ get_staging: 28, get_staging_size: 4 }),
    call: () => assert.fail('invalid staging must not enter guest') };
  await assert.rejects(setEnvironmentVariableOwned(fake, scratch, 'name', 'value'), /staging range/);
  assert(sentinel.every(v => v === 0xa5), 'overflow does not write even partial strings');
  for (const [key, val] of [['bad=name', 'x'], ['name', 'bad\0value']])
    await assert.rejects(setEnvironmentVariableOwned(fake, scratch, key, val), /invalid process|contains NUL/);
  assert.strictEqual(await setEnvironmentVariableOwned({ supports: () => false }, scratch, 'a', 'b'), false);
  const staged = [];
  const fakeValid = { supports: () => true,
    read: async () => ({ get_staging: 1, get_staging_size: 31 }),
    call: async (fn, n, v) => { staged.push([fn, n, v]); return 1; } };
  assert(await setEnvironmentVariableOwned(fakeValid, scratch, 'a', ''));
  assert.strictEqual(staged[0][2], 3, 'empty string has a real non-null pointer');
  assert.strictEqual(sentinel[3], 0);
  assert(await setEnvironmentVariableOwned(fakeValid, scratch, 'a', null));
  assert.strictEqual(staged[1][2], 0, 'null is passed through for the native API to reject');
  await assert.rejects(setEnvironmentVariableOwned({ ...fakeValid,
    call: async () => { throw new Error('owner failure'); } }, scratch, 'a', 'b'), /owner failure/);
  console.log('PASS per-process launch environment is merged lazily');
  console.log('PASS local/Worker owner environment, shadow isolation, bounds, empty/null and errors');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
