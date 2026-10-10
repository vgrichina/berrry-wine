'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const extraWat = String.raw`
  (func (export "test_adapter_monitor") (param $version i32) (param $adapter i32) (result i32)
    (global.set $image_base (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (if (i32.eq (local.get $version) (i32.const 8))
      (then (call $handle_IDirect3D8_GetAdapterMonitor (i32.const 1) (local.get $adapter)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_IDirect3D9_GetAdapterMonitor (i32.const 1) (local.get $adapter)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load (global.get $reg_base)))
  (func (export "test_adapter_info") (param $monitor i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $handle_GetMonitorInfoA (local.get $monitor) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
`;
(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none', width: 800, height: 600 });
  for (const version of [8, 9]) {
    const monitor = e.test_adapter_monitor(version, 0);
    assert.equal(monitor, 0x10000, `D3D${version} shares USER32 primary monitor`);
    assert.equal(e.test_adapter_monitor(version, 1), 0, 'absent adapter has no monitor');
    assert.equal(e.test_adapter_monitor(version, -1), 0, 'invalid unsigned ordinal has no monitor');
    const out = 0x20000;
    e.guest_write32(out, 72);
    e.guest_write32(out + 72, 0x12345678);
    assert.equal(e.test_adapter_info(monitor, out), 1, 'returned handle is accepted by GetMonitorInfoA');
    assert.equal(e.guest_read32(out + 12), 800);
    assert.equal(e.guest_read32(out + 16), 600);
    let name = '';
    for (let i = 0; i < 32; i++) {
      const b = e.guest_read8(out + 40 + i);
      if (!b) break;
      name += String.fromCharCode(b);
    }
    assert.equal(name, String.raw`\\.\DISPLAY1`, 'launcher can consume the device name');
    assert.equal(e.guest_read32(out + 72), 0x12345678, 'MONITORINFOEXA write stays bounded');
  }
  console.log('PASS D3D8/D3D9 adapter monitor handles resolve to USER32 device information');
})().catch(error => { console.error(error); process.exitCode = 1; });
