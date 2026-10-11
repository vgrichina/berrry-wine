'use strict';
// The D3DIM execute-buffer cache is keyed by the buffer's DX_OBJECTS slot, and
// that slot space is shared with every surface, texture and device ($DX_MAX).
// The table used to hold 512 pointers, so a buffer created after ~512 DirectX
// objects got E_OUTOFMEMORY from SetExecuteData: Forsaken's level load
// ("Mload : SetExecuteData Failed", then "RenderScene failed").
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
 (func (export "slot_of") (param $p i32) (result i32)
   (call $dx_slot_of (call $dx_from_this (local.get $p))))
 (func (export "invoke") (param $id i32) (param $sp i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
`;
(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_dx_com_thunks();
  const sp = e.guest_alloc(128), desc = e.guest_alloc(20), out = e.guest_alloc(4);
  const data = e.guest_alloc(48);
  const id = name => apis.find(api => api.name === name).id;
  const call = (name, a, b = 0, c = 0) => e.invoke(id(name), sp, a, b, c) >>> 0;
  // D3DEXECUTEBUFFERDESC {dwSize, dwFlags=D3DDEB_BUFSIZE, dwCaps, dwBufferSize, lpData}
  [20, 1, 0, 64, 0].forEach((v, i) => e.guest_write32(desc + i * 4, v));
  // D3DEXECUTEDATA {dwSize=48, vertex offset/count, instruction offset/length, ...}
  [48, 0, 1, 32, 8].forEach((v, i) => e.guest_write32(data + i * 4, v));
  let last = 0;
  let maxSlot = 0;
  for (let i = 0; i < 600; i++) {
    assert.strictEqual(call('IDirect3DDevice_CreateExecuteBuffer', 0, desc, out), 0, `create #${i}`);
    last = e.guest_read32(out);
    maxSlot = Math.max(maxSlot, e.slot_of(last));
  }
  assert(maxSlot >= 512, `600 buffers should reach DX slot 512+ (max ${maxSlot})`);
  assert.strictEqual(call('IDirect3DExecuteBuffer_SetExecuteData', last, data), 0,
    `SetExecuteData on a buffer in DX slot ${e.slot_of(last)} must succeed`);
  console.log(`PASS  execute buffer in DX slot ${e.slot_of(last)} accepts SetExecuteData (600 buffers)`);
})().catch(error => { console.error(error); process.exit(1); });
