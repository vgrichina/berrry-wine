'use strict';
const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_wave_state_init")
    (global.set $wave_out_handle (i32.const 1234))
    (i32.store (region.addr $WAVE_OUT_SHARED 0) (i32.const 1234))
    (i32.store (region.addr $WAVE_OUT_SHARED 4) (i32.const 0))
    (i32.store (region.addr $WAVE_OUT_SHARED 12) (i32.const 1)))
  (func (export "test_wave_state") (result i64)
    (i64.or (i64.extend_i32_u (global.get $wave_out_handle))
      (i64.shl (i64.extend_i32_u (i32.load (region.addr $WAVE_OUT_SHARED 0))) (i64.const 32))))
  (func (export "test_wave_posts") (result i32) (call $shared_post_queue_total_count))
  (func (export "test_wave_out_close") (param $h i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_waveOutClose (local.get $h)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
  (func (export "test_wave_out_reset") (param $h i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_waveOutReset (local.get $h)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
`;

(async () => {
  const calls = [];
  let hostResult = 5;
  const { exports: e } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      wave_out_close: handle => { calls.push(['close', handle >>> 0]); return hostResult; },
      wave_out_reset: handle => { calls.push(['reset', handle >>> 0]); return hostResult; },
    },
  });
  e.test_wave_state_init();
  const state = e.test_wave_state();
  const posts = e.test_wave_posts();
  let result = e.test_wave_out_close(0xBAD);
  assert.strictEqual(Number(result & 0xffffffffn), 5, 'Close returns MMSYSERR_INVALHANDLE');
  assert.strictEqual(Number(result >> 32n), 0x00300008, 'failed Close pops its stdcall frame');
  result = e.test_wave_out_reset(0xBAD);
  assert.strictEqual(Number(result & 0xffffffffn), 5, 'Reset returns MMSYSERR_INVALHANDLE');
  assert.strictEqual(Number(result >> 32n), 0x00300008, 'failed Reset pops its stdcall frame');
  assert.deepStrictEqual(calls, [['close', 0xBAD], ['reset', 0xBAD]]);
  assert.strictEqual(e.test_wave_state(), state, 'invalid calls preserve local and shared device ownership');
  assert.strictEqual(e.test_wave_posts(), posts, 'invalid close does not post MM_WOM_CLOSE');
  hostResult = 0;
  result = e.test_wave_out_close(1234);
  assert.strictEqual(Number(result & 0xffffffffn), 0, 'successful close still succeeds');
  assert.strictEqual(e.test_wave_state(), 0n, 'successful close clears local and shared handles');
  assert.strictEqual(e.test_wave_posts(), posts + 1, 'successful close posts MM_WOM_CLOSE');

  const memory = new ArrayBuffer(0x10000);
  const ctx = { getMemory: () => memory };
  const host = createHostImports(ctx).host;
  const live = host.wave_out_open(22050, 1, 16, 0, 0, 0);
  assert.strictEqual(host.wave_out_close(0xBAD), 5, 'unknown close is rejected');
  assert.strictEqual(host.wave_out_reset(0xBAD), 5, 'unknown reset is rejected');
  assert(ctx._voices._map[live], 'invalid calls retain the live voice');
  assert.strictEqual(host.wave_out_pause(live), 0, 'live voice remains usable');
  assert.strictEqual(host.wave_out_reset(live), 0, 'live reset succeeds');
  assert.strictEqual(host.wave_out_close(live), 0, 'live close succeeds');
  assert.strictEqual(host.wave_out_close(live), 5, 'closed handle is invalid');
  console.log('PASS invalid waveOut close/reset preserve the live device');
})().catch(error => { console.error(error); process.exit(1); });
