'use strict';
// IDirectSoundBuffer::Lock must hand out the guest address of the ring that
// Play/Unlock pass to the host voice, wherever $heap_alloc put that ring.
//
// Myth: The Fallen Lords was silent in-level: once its heap had spilled into
// the sparse VirtualAlloc backing, Lock rebuilt the guest pointer with the
// direct-window inverse (wa - GUEST_BASE + image_base), which names unmapped
// guest memory there. The game's mixer wrote ~2.8M times into the NULL
// sentinel and every voice refresh played the ring's zeros.
const assert = require('assert');
const {bootRenderHarness} = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
  (func (export "ds_call") (param $id i32) (param $a i32) (param $b i32)
      (param $c i32) (param $d i32) (param $e i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b)
      (local.get $c) (local.get $d) (local.get $e) (i32.const 0))
    (i32.load (global.get $reg_base)))
`;
(async () => {
  const plays = [];
  let mem = null;
  const {exports: e, memory} = await bootRenderHarness({fonts: 'none', extraWat, extraHostOverrides: {
    voice_open: () => 1, voice_set_freq: () => {}, voice_set_volume_db: () => {}, voice_set_pan: () => {},
    voice_play_ring: (id, wa, len, start, loop) => {
      const bytes = new Uint8Array((mem || memory).buffer, wa, Math.min(len, 64));
      plays.push({ wa, len, head: Array.from(bytes.slice(0, 16)) });
      return 0;
    },
    voice_stop: () => 0, voice_close: () => 0, voice_get_pos: () => 0,
  }});
  mem = memory;
  e.init_dx_com_thunks();
  const stack = e.guest_alloc(64), out = e.guest_alloc(32), desc = e.guest_alloc(20), fmt = e.guest_alloc(20);
  const ptr1 = e.guest_alloc(4), len1 = e.guest_alloc(4), ptr2 = e.guest_alloc(4), len2 = e.guest_alloc(4);
  const call = (name, args, pop) => {
    const r = e.ds_call(apis.find(a => a.name === name).id, ...Array.from({length: 5}, (_, i) => args[i] || 0), stack) >>> 0;
    assert.strictEqual(e.get_esp() >>> 0, stack + pop, name);
    return r;
  };
  assert.strictEqual(call('DirectSoundCreate', [0, out, 0], 16), 0);
  const root = e.guest_read32(out);
  [0x00010001, 22050, 44100, 0x00100002, 0].forEach((v, i) => e.guest_write32(fmt + 4 * i, v));
  const report = [];
  for (const bytes of [0x10000, 0x400000, 0x1000000]) {
    [20, 0x20, bytes, 0, fmt].forEach((v, i) => e.guest_write32(desc + 4 * i, v));
    assert.strictEqual(call('IDirectSound_CreateSoundBuffer', [root, desc, out], 20), 0, `create ${bytes}`);
    const buf = e.guest_read32(out);
    // Lock(offset 0, 4 KB): 8 stdcall args; the last three live on the stack.
    e.guest_write32(stack + 24, ptr2); e.guest_write32(stack + 28, len2); e.guest_write32(stack + 32, 0);
    assert.strictEqual(call('IDirectSoundBuffer_Lock', [buf, 0, 4096, ptr1, len1], 36), 0, 'Lock');
    // arg4 (pdwAudioBytes1) arrives through the fifth fast argument slot.
    const p = e.guest_read32(ptr1) >>> 0;
    const pattern = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
    pattern.forEach((v, i) => e.guest_write8(p + i, v));
    plays.length = 0;
    assert.strictEqual(call('IDirectSoundBuffer_Play', [buf, 0, 0, 0], 20), 0, 'Play');
    assert.strictEqual(plays.length, 1, 'Play hands the ring to the host voice');
    report.push({ bytes, guest: '0x' + p.toString(16), wa: '0x' + plays[0].wa.toString(16) });
    assert.deepStrictEqual(plays[0].head.slice(0, 8), pattern,
      `bytes written through Lock's pointer reach the voice (ring ${bytes} bytes at guest 0x${p.toString(16)})`);
  }
  console.log(JSON.stringify(report));
  console.log('PASS  DirectSound Lock pointer maps to the ring the voice plays, direct and sparse heap alike');
})().catch(err => { console.error(err); process.exit(1); });
