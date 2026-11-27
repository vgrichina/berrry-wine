#!/usr/bin/env node
// MSVCR110 /arch:SSE2 math helpers (_libm_sse2_{sin,cos,sqrt}_precise) and
// _time64. The helpers take and return a double in XMM0's low qword (the
// VS2012 glxgears gear builder: cvtps2pd xmm0,xmm0 / call / cvtsd2ss), pop
// only the return address, keep XMM0's upper qword and every other XMM
// register, quiet a NaN argument (sign and payload kept), and return the x86
// QNaN indefinite with errno EDOM for sin/cos(inf) and sqrt(x < -0).
// Finite results are compared bit-for-bit with JS Math (the same fdlibm
// routines the host import uses) and correctly-rounded f64 sqrt.

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const ERRNO_SENTINEL = 0x1234;

const extraWat = String.raw`
  (func (export "t_set_xmm") (param $i i32) (param $lo i64) (param $hi i64)
    (call $xmm_set (local.get $i)
      (i64x2.replace_lane 1 (i64x2.splat (local.get $lo)) (local.get $hi))))
  (func (export "t_xmm_lo") (param $i i32) (result i64)
    (i64x2.extract_lane 0 (call $xmm_get (local.get $i))))
  (func (export "t_xmm_hi") (param $i i32) (result i64)
    (i64x2.extract_lane 1 (call $xmm_get (local.get $i))))
  (func (export "t_set_errno") (param $v i32)
    (call $msvcrt_set_errno (local.get $v)))
  (func (export "t_errno") (result i32)
    (call $gl32 (global.get $msvcrt_errno_ptr)))
  (func (export "t_libm") (param $kind i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (if (i32.eqz (local.get $kind)) (then
      (call $handle__libm_sse2_sin_precise
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 1)) (then
      (call $handle__libm_sse2_cos_precise
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 2)) (then
      (call $handle__libm_sse2_sqrt_precise
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))))
  (func (export "t_time64") (param $p i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $handle__time64
      (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "t_time32") (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $handle_time
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_eax") (result i32) (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_edx") (result i32) (i32.load offset=8 (global.get $reg_base)))
  (func (export "t_gl32") (param $a i32) (result i32) (call $gl32 (local.get $a)))
  (func (export "t_gs32") (param $a i32) (param $v i32) (call $gs32 (local.get $a) (local.get $v)))
`;

const buf = new DataView(new ArrayBuffer(8));
const bitsOf = x => { buf.setFloat64(0, x, true); return buf.getBigUint64(0, true); };
const u64 = b => BigInt.asUintN(64, b);
const hex = b => '0x' + u64(b).toString(16).padStart(16, '0');
const INDEF = 0xfff8000000000000n;
const UPPER = 0x0123456789abcdefn;
const NAMES = ['sin', 'cos', 'sqrt'];

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x00400000, 0, 0, 0, 0, 0);
  e.heap_init(0x00420000);

  let checks = 0;
  const run = (kind, inBits, expectBits, expectErrno, label) => {
    for (let r = 1; r < 8; r++) e.t_set_xmm(r, BigInt(0x1111 * r), BigInt(0x2222 * r));
    e.t_set_xmm(0, inBits, UPPER);
    e.t_set_errno(ERRNO_SENTINEL);
    e.t_libm(kind);
    const got = u64(e.t_xmm_lo(0));
    assert.strictEqual(hex(got), hex(expectBits), `${NAMES[kind]}(${label}) result bits`);
    assert.strictEqual(u64(e.t_xmm_hi(0)), UPPER, `${NAMES[kind]}(${label}) keeps XMM0's upper qword`);
    for (let r = 1; r < 8; r++) {
      assert.strictEqual(u64(e.t_xmm_lo(r)), BigInt(0x1111 * r), `${NAMES[kind]} leaves XMM${r} low`);
      assert.strictEqual(u64(e.t_xmm_hi(r)), BigInt(0x2222 * r), `${NAMES[kind]} leaves XMM${r} high`);
    }
    assert.strictEqual(e.get_esp() >>> 0, STACK + 4, `${NAMES[kind]} pops only the return address`);
    assert.strictEqual(e.t_errno(), expectErrno, `${NAMES[kind]}(${label}) errno`);
    checks++;
  };
  const viaJs = (kind, x) => bitsOf(kind === 0 ? Math.sin(x) : kind === 1 ? Math.cos(x) : Math.sqrt(x));

  const finite = [
    ['+0', 0], ['-0', -0], ['1', 1], ['-1', -1], ['pi', Math.PI], ['-pi/2', -Math.PI / 2],
    ['0.5', 0.5], ['1e-8', 1e-8], ['min denormal', 5e-324], ['-max denormal', -2.2250738585072009e-308],
    ['min normal', 2.2250738585072014e-308], ['1e22', 1e22], ['2^53', 2 ** 53], ['1e300', 1e300],
    ['-1e300', -1e300], ['max', Number.MAX_VALUE], ['gear angle', 2 * Math.PI * 7 / 20],
  ];
  for (const kind of [0, 1]) {
    for (const [label, x] of finite) run(kind, bitsOf(x), viaJs(kind, x), ERRNO_SENTINEL, label);
  }
  // Exact-value spot checks independent of the host import.
  run(0, bitsOf(-0), 0x8000000000000000n, ERRNO_SENTINEL, '-0 keeps sign');
  run(1, bitsOf(0), bitsOf(1), ERRNO_SENTINEL, '0 is exactly 1');
  run(0, bitsOf(5e-324), bitsOf(5e-324), ERRNO_SENTINEL, 'denormal is identity');

  for (const [label, x] of finite) {
    if (x < 0) run(2, bitsOf(x), INDEF, 33, label + ' (domain)');
    else run(2, bitsOf(x), viaJs(2, x), ERRNO_SENTINEL, label);
  }
  run(2, bitsOf(-0), 0x8000000000000000n, ERRNO_SENTINEL, '-0 stays -0');
  run(2, bitsOf(4), bitsOf(2), ERRNO_SENTINEL, '4');
  run(2, bitsOf(2), 0x3ff6a09e667f3bcdn, ERRNO_SENTINEL, '2 correctly rounded');
  run(2, bitsOf(Infinity), bitsOf(Infinity), ERRNO_SENTINEL, '+inf');
  run(2, bitsOf(-Infinity), INDEF, 33, '-inf');

  for (const kind of [0, 1]) {
    run(kind, bitsOf(Infinity), INDEF, 33, '+inf');
    run(kind, bitsOf(-Infinity), INDEF, 33, '-inf');
  }
  // NaNs: quieted, sign and payload kept, errno untouched.
  for (const kind of [0, 1, 2]) {
    run(kind, 0x7ff8000000000000n, 0x7ff8000000000000n, ERRNO_SENTINEL, '+QNaN');
    run(kind, INDEF, INDEF, ERRNO_SENTINEL, 'indefinite');
    run(kind, 0x7ff0000000000001n, 0x7ff8000000000001n, ERRNO_SENTINEL, 'SNaN payload 1');
    run(kind, 0xfff4000000abcdefn, 0xfffc000000abcdefn, ERRNO_SENTINEL, '-SNaN payload');
  }

  // _time64: EDX:EAX is the full second count, *p receives the same qword,
  // cdecl, and it agrees with time() from the same clock.
  const t32 = e.t_time32() >>> 0;
  const P = 0x00410000;
  e.t_gs32(P, 0xdeadbeef); e.t_gs32(P + 4, 0xdeadbeef);
  e.t_time64(P);
  assert.strictEqual(e.get_esp() >>> 0, STACK + 4, '_time64 is cdecl');
  const lo = e.t_eax() >>> 0, hi = e.t_edx() >>> 0;
  assert.strictEqual(hi, 0, '_time64 high dword for a post-1970, pre-2106 clock');
  assert.ok(lo >= t32 && lo - t32 < 5, `_time64 ${lo} agrees with time() ${t32}`);
  assert.ok(lo > 946684800, '_time64 is a calendar time, not a tick count');
  assert.strictEqual(e.t_gl32(P) >>> 0, lo, '_time64 stores the low dword');
  assert.strictEqual(e.t_gl32(P + 4) >>> 0, hi, '_time64 stores the high dword');
  e.t_time64(0);
  assert.strictEqual(e.get_esp() >>> 0, STACK + 4, '_time64(NULL) is cdecl');
  checks += 3;

  console.log(`PASS  _libm_sse2_{sin,cos,sqrt}_precise XMM0 ABI and edge values, _time64 (${checks} groups)`);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
