#!/usr/bin/env node
'use strict';

// waveOut CALLBACK_FUNCTION end to end through the real wasm: the state
// $handle_waveOutOpen writes into $WAVE_OUT_SHARED must be the state the host
// completion path (lib/host-audio.js) and the `fire_wave_out_callback` export
// read back.
//
// Both readers used to hard-code 0xD160.. — the region's base before the
// allocator placed the map — while waveOutOpen wrote through `region.addr`.
// Nothing failed: the completion saw a garbage cbType, quietly posted nothing
// and entered no callback. SDL 1.2's DIB audio thread waits on a semaphore
// its waveOutProc releases, so every SDL 1.2 game (ScummVM FOTAQ) starved its
// audio thread after two buffers and froze on the first spoken line.
// test/test-waveout-audio.js drives the host half alone and had copied the
// same literals, so it stayed green; this one lets waveOutOpen write the state.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const WOM_DONE = 0x3BD;
const CALLBACK_FUNCTION = 0x30000;
const WHDR_DONE = 0x01;
const WHDR_PREPARED = 0x02;
const WHDR_INQUEUE = 0x10;
const CALLBACK_VA = 0x00401230;
const INSTANCE = 0x12345678;

const extraWat = String.raw`
  (func (export "test_wo_begin_process") (call $invocation_process_begin))
  (func (export "test_wo_alloc") (param $n i32) (result i32)
    (local $p i32)
    (local.set $p (call $heap_alloc (local.get $n)))
    (memory.fill (call $g2w (local.get $p)) (i32.const 0) (local.get $n))
    (local.get $p))

  (func (export "test_wo_g2w") (param $ga i32) (result i32)
    (call $g2w (local.get $ga)))

  ;; waveOutOpen(&hwo, WAVE_MAPPER, fmt, cb, inst, fdwOpen) with the stdcall
  ;; frame laid out on a scratch stack: [esp] ret, [esp+4..+24] the six args.
  (func (export "test_wo_open")
      (param $stack i32) (param $phwo i32) (param $fmt i32) (param $cb i32)
      (param $inst i32) (param $flags i32) (result i32)
    (call $gs32 (i32.add (local.get $stack) (i32.const 24)) (local.get $flags))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_waveOutOpen (local.get $phwo) (i32.const -1) (local.get $fmt)
      (local.get $cb) (local.get $inst) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  let clockMs = 0;
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: e, hostCtx, host } = harness;
  hostCtx.audioClockMs = () => clockMs;

  const fmt = e.test_wo_alloc(32);
  e.guest_write32(fmt + 0, 0x00020001);       // PCM, 2 channels
  e.guest_write32(fmt + 4, 22050);
  e.guest_write32(fmt + 8, 22050 * 4);
  e.guest_write32(fmt + 12, 0x00100004);      // block align 4, 16 bits
  const stack = e.test_wo_alloc(64);
  const phwo = e.test_wo_alloc(4);

  assert.strictEqual(e.test_wo_open(stack, phwo, fmt, CALLBACK_VA, INSTANCE, CALLBACK_FUNCTION), 0,
    'waveOutOpen(CALLBACK_FUNCTION) succeeds');
  const hwo = e.guest_read32(phwo) >>> 0;
  assert.notStrictEqual(hwo, 0, 'waveOutOpen returned a handle');

  const hdr = e.test_wo_alloc(32);
  const hdrWA = e.test_wo_g2w(hdr);
  e.guest_write32(hdr + 16, WHDR_PREPARED | WHDR_INQUEUE);
  host.wave_out_schedule_done(hwo, hdrWA, hdr, 0);

  // bootRenderHarness has no loaded guest EIP: a page/shadow context must not
  // admit the callback. Give this synthetic owner its mapped spin-loop resume PC.
  assert.strictEqual(e.fire_wave_out_callback(hwo, hdr), 0, 'uninitialized/shadow owner rejects callback');
  const resume = e.test_wo_alloc(16);
  e.guest_write32(resume, 0x0000FEEB); // jmp $: synthetic interrupted guest loop
  e.test_wo_begin_process(); // The harness has no PE loader to establish its root.
  e.set_eip(resume);
  const espBefore = e.get_esp() >>> 0;
  clockMs = 1000;
  hostCtx.pumpAudioCompletions();   // completes the header, queues WOM_DONE
  hostCtx.pumpAudioCompletions();   // delivers it at the slice boundary

  assert.strictEqual(e.guest_read32(hdr + 16) >>> 0, WHDR_PREPARED | WHDR_DONE,
    'the header comes back DONE and out of the queue');
  assert.strictEqual(e.get_eip() >>> 0, CALLBACK_VA,
    'the waveOutProc the guest passed to waveOutOpen is entered');
  const esp = e.get_esp() >>> 0;
  assert.ok(esp < espBefore, 'the callback frame is pushed below the interrupted stack');
  assert.strictEqual(e.guest_read32(esp + 4) >>> 0, hwo, 'hwo');
  assert.strictEqual(e.guest_read32(esp + 8) >>> 0, WOM_DONE, 'uMsg = WOM_DONE');
  assert.strictEqual(e.guest_read32(esp + 12) >>> 0, INSTANCE, 'dwInstance from waveOutOpen');
  assert.strictEqual(e.guest_read32(esp + 16) >>> 0, hdr, 'dwParam1 = the WAVEHDR');
  assert.strictEqual(e.guest_read32(esp + 20) >>> 0, 0, 'dwParam2 = 0');

  console.log('PASS  waveOutOpen CALLBACK_FUNCTION state reaches the WOM_DONE callback');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
