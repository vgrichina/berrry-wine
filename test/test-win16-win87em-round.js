#!/usr/bin/env node

'use strict';

// WIN87EM.1 __fpmath with BX=6: round ST(0) to an integer by the
// rounding-control bits in AX (AX AND 0x0C00), without touching the control
// word. Visual Basic 1's runtime implements Int() as AX=0x0400 (round down)
// and Fix() as AX=0x0C00 (truncate). This entry used to answer AX=0 and leave
// ST(0) alone, so Int(-0.44) stayed -0.44 and the CInt after it rounded to 0
// instead of -1. Tic Tac Drop's drop row is Int((y - top) / h) + 1, and the
// row came out one cell off for the half-cell above its grid.
//
// The other __fpmath functions VB calls (install, init, set control word, and
// the BX=10 status query it polls on every statement batch) still answer AX=0
// and change nothing, and that is pinned here too.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t87_selector") (result i32)
    (call $win16_next_seg_set (i32.const 1))
    (call $win16_index_to_sel (call $win16_alloc_segment)))

  (func (export "t87_seg_base") (param $sel i32) (result i32)
    (call $win16_seg_base (call $win16_sel_to_index (local.get $sel))))

  (func (export "t87_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))

  (func (export "t87_ax") (result i32)
    (i32.load offset=0 (global.get $reg_base)))

  ;; __fpmath(BX=fn, AX=ax) with ST(0) = v; answers the new ST(0). The call
  ;; takes no stack arguments: just the far return address.
  (func (export "t87_fpmath") (param $esp i32) (param $sel i32) (param $fn i32) (param $ax i32)
      (param $v f64) (result f64)
    (local $r f64)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $gs16 (local.get $esp) (i32.const 0x100))                          ;; return IP
    (call $gs16 (i32.add (local.get $esp) (i32.const 2)) (local.get $sel))   ;; return CS
    (i32.store offset=0 (global.get $reg_base) (local.get $ax))
    (i32.store offset=12 (global.get $reg_base) (local.get $fn))
    (call $fpu_push (local.get $v))
    (drop (call $win16_win87em (i32.const 1)))
    (local.set $r (call $fpu_pop))
    (local.get $r))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat });

  const sel = wat.t87_selector() >>> 0;
  assert(wat.t87_seg_base(sel) >>> 0, 'the fake task got a mapped selector');
  const esp = wat.t87_seg_base(sel) + 0x8000;

  const round = (ax, v) => {
    const r = wat.t87_fpmath(esp, sel, 6, ax, v);
    assert.strictEqual(wat.t87_esp() >>> 0, (esp + 4) >>> 0, '__fpmath pops only its far return');
    assert.strictEqual(wat.t87_ax() & 0xFFFF, ax, 'BX=6 returns AX as it came in');
    return r;
  };

  // Int(): round down.
  assert.strictEqual(round(0x0400, -0.44), -1, 'Int(-0.44) = -1');
  assert.strictEqual(round(0x0400, 2.75), 2, 'Int(2.75) = 2');
  // Fix(): truncate toward zero.
  assert.strictEqual(round(0x0C00, -0.44) + 0, 0, 'Fix(-0.44) = 0 (x87 gives -0, which CInt stores as 0)');
  assert.strictEqual(round(0x0C00, -2.75), -2, 'Fix(-2.75) = -2');
  // Round up.
  assert.strictEqual(round(0x0800, 2.25), 3, 'round up 2.25 = 3');
  // Nearest, ties to even, and only the RC bits of AX count.
  assert.strictEqual(round(0x0000, 2.5), 2, 'nearest 2.5 = 2 (even)');
  assert.strictEqual(round(0x1332 & ~0x0C00, 3.5), 4, 'nearest 3.5 = 4, other AX bits ignored');
  assert.strictEqual(round(0x1332 | 0x0400, -1.5), -2, 'RC=down read from a full control word');

  // BX=10, the status query: AX=0 and ST(0) untouched.
  const r = wat.t87_fpmath(esp, sel, 10, 0x411d, -0.44);
  assert.strictEqual(r, -0.44, 'BX=10 leaves ST(0) alone');
  assert.strictEqual(wat.t87_ax() & 0xFFFF, 0, 'BX=10 answers AX=0');

  console.log('PASS  WIN87EM __fpmath BX=6 rounds ST(0) by AX rounding control (VB Int/Fix)');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
