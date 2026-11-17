#!/usr/bin/env node
'use strict';

// Diagnostic reproducer, not a passing correctness test. Prints observed
// hazards in the opt-in experiment; a corrected implementation changes these
// observations. Uses real WAT access paths and a deterministic GPU readback.
const assert = require('assert');
const { bootRenderHarness } = require('../test/render-helper');

(async () => {
  let reads = 0, dib = 0, memory;
  const h = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: { gpu_gl_call(op) {
      if (op === 0x20007) return 1; // both instances use this shared fixture owner
      if (op === 0x20001) {
        reads++;
        new Uint16Array(memory.buffer, dib, 2).set([0xf800, 0x07e0]);
        return 1;
      }
      return 0;
    } },
    extraWat: `
      (func (export "audit_surface") (result i32)
        (local $this i32) (local $e i32)
        (local.set $this (call $dx_create_com_obj (i32.const 2) (i32.const 0)))
        (local.set $e (call $dx_from_this (local.get $this)))
        (store.field DxObject width (local.get $e) (i32.const 2))
        (store.field DxObject height (local.get $e) (i32.const 1))
        (store.field DxObject bpp (local.get $e) (i32.const 16))
        (store.field DxObject pitch (local.get $e) (i32.const 4))
        (store.field DxObject misc1 (local.get $e)
          (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
        (call $dx_surf_fmt_set (local.get $e) (i32.const 1))
        (local.get $this))
      (func (export "audit_dib") (result i32)
        (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
      (func (export "audit_arm") (param $this i32) (param $on i32)
        (global.set $d3dim_lazy_on (local.get $on))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_lock_fence (call $dx_from_this (local.get $this))))
      (func (export "audit_read") (param $wa i32) (result i32)
        (call $gl16 (call $w2g (local.get $wa))))
      (func (export "audit_write") (param $wa i32)
        (call $gs16 (call $w2g (local.get $wa)) (i32.const 0x1234)))
      (func (export "audit_unlock") (param $this i32) (result i32)
        (call $d3dim_lazy_unlock (call $dx_from_this (local.get $this))))
      (func (export "audit_flush") (call $d3dim_worker_fence))
      (func (export "audit_hdc") (param $this i32) (result i32)
        (local $hdc i32)
        (local.set $hdc (i32.add (i32.const 0x200000)
          (call $dx_slot_of (call $dx_from_this (local.get $this)))))
        (drop (call $gdi_dx_dc_bind (local.get $hdc)))
        (local.get $hdc))
      (func (export "audit_getpixel") (param $hdc i32) (result i32)
        (call $handle_GetPixel (local.get $hdc) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0))
        (i32.load (global.get $reg_base)))
      (func (export "audit_setpixel") (param $hdc i32)
        (drop (call $gdi_hdc_set_pixel (local.get $hdc) (i32.const 0)
          (i32.const 0) (i32.const 0xff0000))))
      (func (export "audit_x87") (param $wa i32) (result i64)
        (call $fpu_exec_mem (i32.const 5) (i32.const 0) (call $w2g (local.get $wa)))
        (i64.reinterpret_f64 (call $fpu_pop)))
    ` });
  memory = h.memory;
  // Instantiate before setting fixtures: active data segments can initialize
  // shared bytes. No concurrency is needed to expose instance-local state.
  const other = (await WebAssembly.instantiate(h.module, { host: h.host, gdi: h.gdi })).exports;
  other.d3dim_lazy_enable(1);
  const ex = h.exports, surface = ex.audit_surface();
  dib = ex.audit_dib();
  const pixels = new Uint16Array(memory.buffer, dib, 2);
  const hdc = ex.audit_hdc(surface);
  function arm(on = 1) {
    ex.audit_flush(); pixels.fill(0); reads = 0;
    ex.audit_arm(surface, on);
  }
  const findings = [];
  arm(0);
  assert.equal(ex.audit_read(dib), 0xf800);
  assert.equal(ex.audit_getpixel(hdc), 0xff);
  new Uint8Array(memory.buffer, dib - 4, 4).fill(0);
  const eagerX87 = ex.audit_x87(dib - 4).toString(16);
  assert.equal(eagerX87, '7e0f80000000000');
  arm();
  assert.equal(ex.audit_read(dib), 0xf800);
  assert.equal(reads, 1, 'ordinary same-instance access must synchronize');
  arm();
  const stale = other.audit_read(dib);
  other.audit_write(dib);
  const writeBefore = pixels[0];
  const untouched = ex.audit_unlock(surface);
  ex.audit_flush();
  findings.push({ path: 'second WASM instance', stale, writeBefore,
    writeAfterReadback: pixels[0], reportedUntouched: untouched });
  arm();
  const gdiRead = ex.audit_getpixel(hdc);
  ex.audit_setpixel(hdc);
  const gdiWrite = pixels[0], gdiFences = reads;
  const gdiUntouched = ex.audit_unlock(surface);
  ex.audit_flush();
  findings.push({ path: 'previously bound GDI DC', stale: gdiRead,
    writeBefore: gdiWrite, writeAfterReadback: pixels[0],
    fencesBeforeUnlock: gdiFences, reportedUntouched: gdiUntouched });
  arm();
  new Uint8Array(memory.buffer, dib - 4, 4).fill(0);
  const x87 = ex.audit_x87(dib - 4).toString(16);
  findings.push({ path: 'x87 FLD m64 across aligned start', bits: x87,
    eagerBits: eagerX87, fences: reads, reportedUntouched: ex.audit_unlock(surface) });
  ex.audit_flush();
  console.log(JSON.stringify({ controls: 'eager and ordinary lazy reads pass', findings }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
