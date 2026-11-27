  ;; ============================================================
  ;; x87 FPU SUPPORT
  ;; ============================================================
  ;;
  ;; This is an *x87-lite* implementation backed by WebAssembly f64. It is
  ;; deliberately not bit-exact to a real 8087/80387: WASM does not expose the
  ;; primitives required for full IEEE-754 / x87 compliance, and we do NOT
  ;; emulate them in software. The intentional differences are:
  ;;
  ;;   * 80-bit extended precision is unavailable. Arithmetic uses f64 (53-bit
  ;;     mantissa, 11-bit exponent). Exact physical register images retain all 80 bits; arithmetic converts between real 80-bit
  ;;     sign/exponent/explicit-mantissa values and f64, so code that depends
  ;;     on the extra ~11 bits of mantissa or the wider exponent range will
  ;;     still diverge.
  ;;
  ;;   * FMUL honors PC=24 on its f64 result, preserving the f64 exponent
  ;;     range. Other arithmetic still ignores PC; PC=53/64 remains f64.
  ;;     This is not exact extended arithmetic (double rounding can remain).
  ;;
  ;;   * Rounding Control (CW bits 10-11) is honored only for FRNDINT and
  ;;     FIST/FISTP via $fpu_round. FADD/FSUB/FMUL/FDIV/FSQRT use WASM's
  ;;     fixed round-to-nearest-even — directed rounding modes are NOT
  ;;     applied to arithmetic results except FMUL PC24 precision reduction.
  ;;
  ;;   * Denormals are handled by the WASM runtime; FTZ/DAZ-style flushing
  ;;     in the x87 control word is ignored.
  ;;
  ;;   * Exception masking (CW bits 0-5) is partially honored. We set the
  ;;     status-word exception flags (IE/DE/ZE/OE/UE/PE) for the cases we
  ;;     can detect cheaply (stack over/underflow, sqrt of negative,
  ;;     divide-by-zero, integer-conversion overflow, NaN compare in FCOMI),
  ;;     but we never raise #MF — masked or not, execution always continues.
  ;;
  ;;   * The tag word is reduced to one valid/empty bit per physical
  ;;     register (see $fpu_tag in 01-header.wat). The C0/C1/C2/C3 condition
  ;;     bits in the status word are kept for compare-and-FNSTSW patterns.
  ;;     C1 is set by FRNDINT to report rounding direction; arithmetic does
  ;;     not update C1.
  ;;
  ;;   * FCOMI/FUCOMI funnel into the lazy CPU flag system via
  ;;     $fpu_compare_eflags so that "FCOMI; Jcc" works, but the unordered
  ;;     case sets ZF|PF|CF as the spec requires while also flagging IE in
  ;;     the FPU status word for FCOMI (FUCOMI suppresses IE on QNaN).
  ;;
  ;; Decoder coverage is exhaustive: every D8..DF byte reaches one of the
  ;; three FPU thread handlers. Anything that lands in $fpu_exec_reg or
  ;; $fpu_exec_mem without a handler calls $fpu_crash_op, which logs
  ;; (group, reg, rm) and traps via $crash_unimplemented — so we fail loud
  ;; instead of silently no-op'ing unknown encodings.

  ;; --- Register file and tag-word helpers ---
  ;; The physical registers live in this thread's $FPU_FILE slice ($fpu_base):
  ;; value p at +p*8, exact-integer shadow p at +64+p*8. The tag words are
  ;; one bit per physical register, 1 = valid. These helpers are the only
  ;; code that knows the layout, and they are written without nested calls:
  ;; V8 inlines none of them into $fpu_exec_mem/reg, so every call here used
  ;; to cost a full call -- `$fpu_tag_phys`, whose whole body is `i & 7`, was
  ;; 157 ms of self time on the MCM race (box, 2026-09-19) -- and the values
  ;; were eight globals behind an eight-way branch.
  (func $fpu_tag_phys (param $i i32) (result i32)
    (i32.and (local.get $i) (i32.const 7)))
  (func $fpu_mark_valid (param $i i32)
    (global.set $fpu_tag (i32.or (global.get $fpu_tag)
      (i32.shl (i32.const 1)
        (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7))))))
  (func $fpu_mark_empty (param $i i32)
    (local $m i32)
    (local.set $m (i32.xor (i32.const 0xFF)
      (i32.shl (i32.const 1)
        (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))))
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag) (local.get $m)))
    (global.set $fpu_tag (i32.and (global.get $fpu_tag) (local.get $m))))
  (func $fpu_is_valid (param $i i32) (result i32)
    (i32.and (i32.shr_u (global.get $fpu_tag)
      (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
      (i32.const 1)))

  (func $fpu_raw_clear (param $i i32)
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag)
      (i32.xor (i32.const 0xFF)
        (i32.shl (i32.const 1)
          (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))))))

  (func $fpu_raw_valid (param $i i32) (result i32)
    (i32.and (i32.shr_u (global.get $fpu_raw_tag)
      (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
      (i32.const 1)))

  (func $fpu_raw_get_phys (param $p i32) (result i64)
    (i64.load offset=64 (i32.add (global.get $fpu_base)
      (i32.shl (i32.and (local.get $p) (i32.const 7)) (i32.const 3)))))

  (func $fpu_raw_get (param $i i32) (result i64)
    (i64.load offset=64 (i32.add (global.get $fpu_base)
      (i32.shl (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7))
               (i32.const 3)))))

  (func $fpu_raw_set (param $i i32) (param $v i64)
    (local $p i32)
    (if (global.get $eip_redirected) (then (return)))
    (local.set $p (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
    (i64.store offset=64 (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3)))
      (local.get $v))
    (global.set $fpu_raw_tag
      (i32.or (global.get $fpu_raw_tag) (i32.shl (i32.const 1) (local.get $p))))
    (call $phys80_invalidate (local.get $p))
    (call $phys80_materialize (local.get $p)))

  ;; Set status-word exception flags. Bits: IE=1, DE=2, ZE=4, OE=8, UE=16, PE=32,
  ;; SF=64 (stack fault, paired with IE), ES=128 (error summary).
  (func $fpu_set_exc (param $bits i32)
    (global.set $fpu_sw (i32.or (global.get $fpu_sw)
      (local.get $bits)))
    ;; Masked exceptions still set their individual flags, but ES summarizes
    ;; only unmasked exceptions. In particular a masked FIST overflow must
    ;; store integer indefinite with IE alone, not report a pending exception.
    (if (i32.and (i32.and (local.get $bits) (i32.const 0x3F))
                 (i32.xor (global.get $fpu_cw) (i32.const 0x3F)))
      (then (global.set $fpu_sw (i32.or (global.get $fpu_sw) (i32.const 0x80)))))
    (call $fpu_trace_exc (local.get $bits) (i32.const 1)))

  ;; --trace-fpu. `raised` tells a flag going up from FCLEX/FINIT taking them
  ;; all down again, which is the pair that matters: a status word read between
  ;; the two reports an exception, and read after the clear reports none.
  (func $fpu_trace_exc (param $bits i32) (param $raised i32)
    (if (global.get $fpu_trace)
      (then
        (call $host_log_i32 (i32.const 0xCAF00001))
        (call $host_log_i32 (local.get $bits))
        (call $host_log_i32 (local.get $raised))
        (call $host_log_i32 (global.get $eip)))))

  (func (export "set_fpu_trace") (param $on i32) (global.set $fpu_trace (local.get $on)))

  ;; Reset the current thread's logical x87 environment, retaining register
  ;; payload bytes as FNINIT does. Hardware uses 037F; the x86 CRT uses 027F.
  ;; raw_tag is validity metadata too: stale exact-integer shadows must not
  ;; survive an empty stack. No sibling thread's FPU_FILE slice is touched.
  (func $fpu_reset (param $cw i32)
    (global.set $fpu_top (i32.const 0))
    (global.set $fpu_cw (local.get $cw))
    (global.set $fpu_sw (i32.const 0))
    (global.set $fpu_tag (i32.const 0))
    (global.set $fpu_raw_tag (i32.const 0)))

  ;; Physical access does not change TOP, tags, or the exact integer shadow.
  (func $fpu_get_phys (param $p i32) (result f64)
    (f64.load (i32.add (global.get $fpu_base)
      (i32.shl (i32.and (local.get $p) (i32.const 7)) (i32.const 3)))))

  (func $fpu_set_phys (param $p i32) (param $v f64)
    (if (global.get $eip_redirected) (then (return)))
    (f64.store (i32.add (global.get $fpu_base)
      (i32.shl (i32.and (local.get $p) (i32.const 7)) (i32.const 3)))
      (local.get $v))
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag)
      (i32.xor (i32.const 255) (i32.shl (i32.const 1) (local.get $p)))))
    (call $phys80_invalidate (i32.and (local.get $p) (i32.const 7)))
    (call $phys80_materialize (i32.and (local.get $p) (i32.const 7))))

  (func $fpu_get (param $i i32) (result f64)
    (f64.load (i32.add (global.get $fpu_base)
      (i32.shl (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7))
               (i32.const 3)))))

  ;; Write ST(i): drop its exact-integer shadow and tag it valid.
  (func $fpu_set (param $i i32) (param $v f64)
    (local $p i32)
    (if (global.get $eip_redirected) (then (return)))
    (local.set $p (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
    (f64.store (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3)))
      (local.get $v))
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag)
      (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $p)))))
    (global.set $fpu_tag (i32.or (global.get $fpu_tag)
      (i32.shl (i32.const 1) (local.get $p))))
    (call $phys80_invalidate (local.get $p))
    (call $phys80_materialize (local.get $p)))

  (func $fpu_push (param $v f64)
    (local $p i32)
    (if (global.get $eip_redirected) (then (return)))
    ;; Stack overflow: pushing into a slot that is still tagged valid.
    ;; Real x87 sets IE|SF and (with IE masked) writes the "indefinite" QNaN.
    ;; We set the flag and keep going with the user's value, since we don't
    ;; have an indefinite-NaN bit pattern that round-trips f64.
    (local.set $p (i32.and (i32.sub (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
    (global.set $fpu_top (local.get $p))
    (if (i32.and (i32.shr_u (global.get $fpu_tag) (local.get $p)) (i32.const 1))
      (then (call $fpu_set_exc (i32.const 0x41))))   ;; IE | SF
    (f64.store (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3)))
      (local.get $v))
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag)
      (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $p)))))
    (global.set $fpu_tag (i32.or (global.get $fpu_tag)
      (i32.shl (i32.const 1) (local.get $p))))
    (call $phys80_invalidate (local.get $p))
    (call $phys80_materialize (local.get $p)))

  (func $fpu_pop (result f64)
    (local $p i32) (local $m i32)
    (local.set $p (i32.and (global.get $fpu_top) (i32.const 7)))
    ;; Stack underflow: popping a slot that is already tagged empty.
    (if (i32.eqz (i32.and (i32.shr_u (global.get $fpu_tag) (local.get $p)) (i32.const 1)))
      (then (call $fpu_set_exc (i32.const 0x41))))   ;; IE | SF
    (local.set $m (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $p))))
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag) (local.get $m)))
    (global.set $fpu_tag (i32.and (global.get $fpu_tag) (local.get $m)))
    (global.set $fpu_top (i32.and (i32.add (local.get $p) (i32.const 1)) (i32.const 7)))
    (f64.load (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3)))))

  ;; Crash on an x87 escape we don't implement. The string at 0x2F0 is
  ;; "FPU_UNIMPL\0"; the (group, reg, rm) triple is logged so the next
  ;; implementation pass knows exactly which encoding to add.
  (func $fpu_crash_op (param $group i32) (param $reg i32) (param $rm i32)
    (call $host_log_i32 (i32.or (i32.const 0xF0000000)
      (i32.or (i32.shl (local.get $group) (i32.const 8))
              (i32.or (i32.shl (local.get $reg) (i32.const 4)) (local.get $rm)))))
    (call $crash_unimplemented (i32.const 0x2F0))
    (unreachable))

  ;; Detect NaN: x != x is true only for NaN under IEEE-754.
  (func $fpu_is_nan (param $v f64) (result i32)
    (f64.ne (local.get $v) (local.get $v)))

  ;; FXAM classifies ST(0) in C3:C2:C0 and reports its sign in C1. VBRUN100
  ;; relies on C1 before raising a negative base to an integral power: losing
  ;; it sends -10 through FYL2X as log2(-10), producing a NaN and VB error 6.
  (func $fpu_fxam
    (local $v f64) (local $abs f64) (local $cc i32)
    (local $se i32) (local $exp i32)
    ;; Canonical normalized finite physical80 images can exceed the f64 range.
    (if (call $fpu_is_valid (i32.const 0))
      (then (if (i32.and (i32.load offset=16 (global.get $fpu_image_base))
                  (i32.shl (i32.const 1) (global.get $fpu_top)))
        (then
          (local.set $se (i32.load16_u (call $phys80_se_addr (global.get $fpu_top))))
          (local.set $exp (i32.and (local.get $se) (i32.const 32767)))
          ;; E=0,J=0 canonical images are zero or denormal, without exceptions.
          (if (i32.and (i32.eqz (local.get $exp))
                (i64.ge_s (i64.load (call $phys80_mant_addr (global.get $fpu_top))) (i64.const 0)))
            (then
              (global.set $fpu_sw
                (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xB8FF))
                  (i32.or
                    (select (i32.const 0x4000) (i32.const 0x4400)
                      (i64.eqz (i64.load (call $phys80_mant_addr (global.get $fpu_top)))))
                    (i32.shr_u (i32.and (local.get $se) (i32.const 32768)) (i32.const 6)))))
              (return)))
          (if (i32.and (i32.and (i32.gt_u (local.get $exp) (i32.const 0))
                               (i32.lt_u (local.get $exp) (i32.const 32767)))
                (i64.lt_s (i64.load (call $phys80_mant_addr (global.get $fpu_top))) (i64.const 0)))
            (then
              (global.set $fpu_sw
                (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xB8FF))
                  (i32.or (i32.const 0x0400)
                    (i32.shr_u (i32.and (local.get $se) (i32.const 32768)) (i32.const 6)))))
              (return)))))))
    (if (i32.eqz (call $fpu_is_valid (i32.const 0)))
      (then (local.set $cc (i32.const 0x4100)))       ;; empty: 101
      (else
        (local.set $v (call $fpu_get (i32.const 0)))
        (local.set $abs (f64.abs (local.get $v)))
        (if (call $fpu_is_nan (local.get $v))
          (then (local.set $cc (i32.const 0x0100)))   ;; NaN: 001
          (else (if (f64.gt (local.get $abs) (f64.const 1.7976931348623157e308))
            (then (local.set $cc (i32.const 0x0500))) ;; infinity: 011
            (else (if (f64.eq (local.get $abs) (f64.const 0))
              (then (local.set $cc (i32.const 0x4000))) ;; zero: 100
              (else (if (f64.lt (local.get $abs) (f64.const 2.2250738585072014e-308))
                (then (local.set $cc (i32.const 0x4400))) ;; denormal: 110
                (else (local.set $cc (i32.const 0x0400)))))))))) ;; normal: 010
        (if (i64.lt_s (i64.reinterpret_f64 (local.get $v)) (i64.const 0))
          (then (local.set $cc (i32.or (local.get $cc) (i32.const 0x0200)))))))
    (global.set $fpu_sw
      (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xB8FF)) (local.get $cc))))

  ;; FPREM/FPREM1 report the low three bits of the integer quotient in
  ;; C0=Q2, C3=Q1, C1=Q0, and clear C2 when the reduction is complete. A
  ;; large-argument trig reduction loop reads exactly those bits to pick the
  ;; quadrant; we used to clear C2 and leave all three alone, i.e. always
  ;; report quotient 0.
  ;;
  ;; Our reduction is exact in f64 rather than partial, so C2 is always
  ;; cleared and the bits are always the defined-meaningful case. The one
  ;; thing we cannot do is a quotient at or above 2^63: i64.trunc_f64_s would
  ;; trap and take the emulator with it, and real hardware would have reported
  ;; a partial reduction there instead. Report zero for the bits in that case
  ;; rather than risk the trap.
  (func $fpu_prem_quotient (param $q f64)
    (local $qi i64) (local $cc i32)
    ;; 0xB8FF clears C3|C2|C1|C0 (0x4700). C1 is easy to leave in by accident,
    ;; and a stale one reads back as Q0 -- quotient 10 comes out as 11.
    (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xB8FF)))
    (if (call $fpu_is_nan (local.get $q)) (then (return)))
    (if (f64.ge (f64.abs (local.get $q)) (f64.const 9223372036854775808.0))
      (then (return)))
    (local.set $qi (i64.trunc_f64_s (f64.abs (local.get $q))))
    (if (i64.eqz (i64.and (local.get $qi) (i64.const 1)))
      (then) (else (local.set $cc (i32.or (local.get $cc) (i32.const 0x0200))))) ;; Q0 -> C1
    (if (i64.eqz (i64.and (local.get $qi) (i64.const 2)))
      (then) (else (local.set $cc (i32.or (local.get $cc) (i32.const 0x4000))))) ;; Q1 -> C3
    (if (i64.eqz (i64.and (local.get $qi) (i64.const 4)))
      (then) (else (local.set $cc (i32.or (local.get $cc) (i32.const 0x0100))))) ;; Q2 -> C0
    (global.set $fpu_sw (i32.or (global.get $fpu_sw) (local.get $cc))))

  ;; FXTRACT splits ST(0) into its unbiased exponent (which replaces ST(0)) and
  ;; its significand, 1.0 <= |sig| < 2.0 with the original sign, which is then
  ;; pushed. This used to push (1.0, 0.0): the stack effect was right and both
  ;; numbers were wrong, which stays invisible until a CRT log/exp/frexp built
  ;; on top of it returns nonsense with no crash to point at.
  (func $fpu_fxtract
    (local $v f64) (local $abs f64) (local $bits i64)
    (local $e i32) (local $adj i32) (local $sig f64) (local $inf f64)
    (local $p i32) (local $se i32) (local $mant i64)
    ;; Exact canonical finite image path; all other cases retain the fallback.
    (local.set $p (global.get $fpu_top))
    (if (i32.and (call $fpu_is_valid (i32.const 0))
          (i32.eqz (call $fpu_is_valid (i32.const 7))))
      (then
        (if (i32.and (i32.load offset=16 (global.get $fpu_image_base))
              (i32.shl (i32.const 1) (local.get $p)))
          (then
            (local.set $mant (i64.load (call $phys80_mant_addr (local.get $p))))
            (local.set $se (i32.load16_u (call $phys80_se_addr (local.get $p))))
            (local.set $e (i32.and (local.get $se) (i32.const 32767)))
            ;; Canonical masked zero: existing fallback has exact results; clear C1.
            (if (i32.and
                  (i32.and (i32.eqz (local.get $e)) (i64.eqz (local.get $mant)))
                  (i32.eq (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63)))
              (then
                (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))))
            ;; Canonical infinity/QNaN only, with all exceptions masked.
            (if (i32.and
                  (i32.and (i32.eq (local.get $e) (i32.const 32767))
                    (i64.lt_s (local.get $mant) (i64.const 0)))
                  (i32.and
                    (i32.or (i64.eq (local.get $mant) (i64.const 0x8000000000000000))
                      (i64.ne (i64.and (local.get $mant) (i64.const 0x4000000000000000)) (i64.const 0)))
                    (i32.eq (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63))))
              (then
                (if (i64.eq (local.get $mant) (i64.const 0x8000000000000000))
                  (then (call $fpu_set (i32.const 0)
                    (f64.reinterpret_i64 (i64.const 0x7FF0000000000000)))))
                (call $fpu_push (call $phys80_decode (local.get $mant) (local.get $se)))
                (call $phys80_write (global.get $fpu_top) (local.get $mant) (local.get $se))
                (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
                (return)))
            ;; Canonical nonzero subnormal only; decline before any state mutation.
            (if (i32.and
                  (i32.and (i32.eqz (local.get $e))
                    (i64.gt_s (local.get $mant) (i64.const 0)))
                  (i32.eq (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63)))
              (then
                (local.set $e (i32.wrap_i64 (i64.clz (local.get $mant))))
                (local.set $mant (i64.shl (local.get $mant) (i64.extend_i32_u (local.get $e))))
                (call $fpu_set (i32.const 0)
                  (f64.convert_i32_s (i32.sub (i32.const -16382) (local.get $e))))
                (local.set $se (i32.or (i32.and (local.get $se) (i32.const 32768))
                                      (i32.const 16383)))
                (call $fpu_push (call $phys80_decode (local.get $mant) (local.get $se)))
                (call $phys80_write (global.get $fpu_top) (local.get $mant) (local.get $se))
                (call $fpu_set_exc (i32.const 2))
                (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
                (return)))
            (if (i32.and (i32.and (i32.gt_u (local.get $e) (i32.const 0))
                                  (i32.lt_u (local.get $e) (i32.const 32767)))
                         (i64.lt_s (local.get $mant) (i64.const 0)))
              (then
                (call $fpu_set (i32.const 0)
                  (f64.convert_i32_s (i32.sub (local.get $e) (i32.const 16383))))
                (local.set $se (i32.or (i32.and (local.get $se) (i32.const 32768))
                                      (i32.const 16383)))
                (call $fpu_push (call $phys80_decode (local.get $mant) (local.get $se)))
                (call $phys80_write (global.get $fpu_top) (local.get $mant) (local.get $se))
                (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
                (return)))))))
    (local.set $inf (f64.reinterpret_i64 (i64.const 0x7FF0000000000000)))
    (local.set $v (call $fpu_get (i32.const 0)))
    (local.set $abs (f64.abs (local.get $v)))
    ;; NaN in, that NaN out for both results.
    (if (call $fpu_is_nan (local.get $v))
      (then (call $fpu_push (local.get $v)) (return)))
    ;; Infinity: exponent +inf, significand the infinity itself.
    (if (f64.gt (local.get $abs) (f64.const 1.7976931348623157e308))
      (then
        (call $fpu_set (i32.const 0) (local.get $inf))
        (call $fpu_push (local.get $v)) (return)))
    ;; Zero: exponent -inf with ZE raised, significand keeps the signed zero.
    (if (f64.eq (local.get $abs) (f64.const 0))
      (then
        (call $fpu_set_exc (i32.const 0x04))
        (call $fpu_set (i32.const 0) (f64.neg (local.get $inf)))
        (call $fpu_push (local.get $v)) (return)))
    ;; A denormal has no leading 1 to read off, so scale it up by 2^64 first
    ;; and take those 64 back out of the exponent afterwards.
    (if (f64.lt (local.get $abs) (f64.const 2.2250738585072014e-308))
      (then
        (local.set $adj (i32.const 64))
        (local.set $v (f64.mul (local.get $v) (f64.const 18446744073709551616.0)))))
    (local.set $bits (i64.reinterpret_f64 (local.get $v)))
    (local.set $e (i32.wrap_i64
      (i64.and (i64.shr_u (local.get $bits) (i64.const 52)) (i64.const 0x7FF))))
    ;; Significand: keep the mantissa, force the exponent field to the bias,
    ;; then reapply the sign (built this way so no literal exceeds 2^63).
    (local.set $sig (f64.reinterpret_i64
      (i64.or (i64.and (local.get $bits) (i64.const 0x000FFFFFFFFFFFFF))
              (i64.const 0x3FF0000000000000))))
    (if (i64.lt_s (local.get $bits) (i64.const 0))
      (then (local.set $sig (f64.neg (local.get $sig)))))
    (call $fpu_set (i32.const 0)
      (f64.convert_i32_s
        (i32.sub (i32.sub (local.get $e) (i32.const 1023)) (local.get $adj))))
    (call $fpu_push (local.get $sig)))

  ;; FSIN/FCOS/FSINCOS/FPTAN report argument reduction through C2: each clears
  ;; it when |ST(0)| < 2^63 and otherwise SETS it and leaves the stack alone.
  ;; Leaving C2 untouched is not harmless, because C2 is sticky and FXAM runs
  ;; immediately before: every MSVC/Borland CRT sin/cos classifies its argument
  ;; with FXAM -- which sets C2=1 for a normal number -- and its compute arm is
  ;;
  ;;     fsin ; fnstsw ax ; sahf ; jp out_of_range
  ;;
  ;; where SAHF takes PF from AH bit 2, i.e. C2. With C2 left set, the CRT
  ;; believes every in-range argument needs reduction and takes its error path.
  ;; boids.exe's projection matrix came out all +/-infinity for exactly this:
  ;; cos(pi/8) returned -inf.
  ;;
  ;; Returns 1 when the operation should compute. NaN counts as in range (the
  ;; result is a NaN and C2 is cleared); infinities do not.
  (func $fpu_trig_c2 (param $v f64) (result i32)
    (if (i32.eqz (f64.ge (f64.abs (local.get $v)) (f64.const 9223372036854775808.0)))
      (then
        (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFBFF)))
        (return (i32.const 1))))
    (global.set $fpu_sw (i32.or (global.get $fpu_sw) (i32.const 0x0400)))
    (i32.const 0))

  (func $fpu_compare (param $a f64) (param $b f64)
    ;; FCOM / FCOMP / FCOMPP signal IE for any NaN.
    (if (i32.or (call $fpu_is_nan (local.get $a)) (call $fpu_is_nan (local.get $b)))
      (then (call $fpu_set_exc (i32.const 0x01))))
    (call $fpu_compare_unord (local.get $a) (local.get $b)))

  ;; FUCOM / FUCOMP / FUCOMPP: NaNs are quiet in our f64 x87-lite model,
  ;; as for FUCOMI. Publish unordered without adding IE; preserve sticky flags.
  (func $fpu_compare_unord (param $a f64) (param $b f64)
    (local $cc i32)
    (if (f64.lt (local.get $a) (local.get $b))
      (then (local.set $cc (i32.const 0x0100)))
      (else (if (f64.gt (local.get $a) (local.get $b))
        (then (local.set $cc (i32.const 0x0000)))
        (else (if (f64.eq (local.get $a) (local.get $b))
          (then (local.set $cc (i32.const 0x4000)))
          (else
            (local.set $cc (i32.const 0x4500))))))))
    (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xB8FF)) (local.get $cc))))

  ;; FCOMI / FCOMIP: ordered compare, sets eflags AND signals IE on NaN.
  (func $fpu_compare_eflags (param $a f64) (param $b f64)
    (if (i32.or (call $fpu_is_nan (local.get $a)) (call $fpu_is_nan (local.get $b)))
      (then (call $fpu_set_exc (i32.const 0x01))))
    (call $fpu_compare_eflags_unord (local.get $a) (local.get $b)))

  ;; FUCOMI / FUCOMIP: unordered compare. NaN (treated as QNaN) does NOT
  ;; raise IE — only the eflags are set to ZF=PF=CF=1.
  ;;
  ;; PF is not optional here, and getting it from the lazy arithmetic modes is
  ;; not merely imprecise, it inverts the most common float test MSVC emits:
  ;;
  ;;     fucomip st,st(1) ; lahf ; test ah,0x44 ; jp not_equal
  ;;
  ;; On real hardware an EQUAL compare leaves ZF=1, PF=0, so `ah & 0x44` is
  ;; 0x40 — one bit, odd parity, PF clear, and the JP is NOT taken. Deriving PF
  ;; from flag_res the way modes 2 and 3 do makes PF the parity of the low byte
  ;; of a synthetic result: equal stores flag_res = 0, whose parity is even, so
  ;; PF comes out SET, `ah & 0x44` reads 0x44, and the JP is taken. Every
  ;; `if (a == b)` on doubles then takes the not-equal branch. Black & White 2's
  ;; land loader is where that showed up: the insert at 0x9cef29 is gated by
  ;; exactly this sequence, it never ran, the list at [esp+0x50] stayed empty,
  ;; and 0x9cef45 dereferenced NULL 53 million times.
  ;;
  ;; So publish the three flags x87 actually defines through the exact raw mode
  ;; (flag_op 9), which carries CF in flag_a bit 0 and PF in flag_a bit 1
  ;; independently of flag_res. OF/SF/AF are cleared by FCOMI on real hardware,
  ;; which flag_b = 0 and a flag_res with bit 31 clear give us.
  (func $fpu_compare_eflags_unord (param $a f64) (param $b f64)
    (global.set $flag_op (i32.const 9))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_b (i32.const 0))  ;; OF = 0
    (if (f64.lt (local.get $a) (local.get $b))
      (then  ;; ZF=0 PF=0 CF=1
        (global.set $flag_a (i32.const 1))
        (global.set $flag_res (i32.const 1)))
      (else (if (f64.eq (local.get $a) (local.get $b))
        (then  ;; ZF=1 PF=0 CF=0
          (global.set $flag_a (i32.const 0))
          (global.set $flag_res (i32.const 0)))
        (else (if (f64.gt (local.get $a) (local.get $b))
          (then  ;; ZF=0 PF=0 CF=0
            (global.set $flag_a (i32.const 0))
            (global.set $flag_res (i32.const 1)))
          (else  ;; unordered: ZF=1 PF=1 CF=1
            (global.set $flag_a (i32.const 3))
            (global.set $flag_res (i32.const 0)))))))))

  ;; Apply current FPU rounding-control (CW bits 10-11) to an f64.
  ;; 00 = nearest-even, 01 = round down, 10 = round up, 11 = truncate.
  (func $fpu_round (param $v f64) (result f64)
    (call $fpu_round_by (local.get $v)
      (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 10)) (i32.const 3))))

  ;; The same rounding by an explicit RC value, for callers that round by a
  ;; mode of their own without touching the control word (WIN87EM BX=6).
  ;; FSCALE: $v * 2^trunc($n), exactly, like ldexp. The factor is applied in
  ;; representable steps (2^1023 / 2^-1022) because 2^n on its own leaves f64
  ;; for |n| > 1023 while x87's 80-bit exponent does not: the MSVC CRT's
  ;; underflow fix-up scales a zero result by 2^1536 and back, and one
  ;; 2^1536 = +Inf factor turned every CRT function that returns 0.0 into
  ;; 0 * Inf = NaN (MDK2's camera). Zero, infinity and NaN scale to themselves,
  ;; except the x87's invalid cases 0 * 2^+Inf and Inf * 2^-Inf (NaN).
  (func $fpu_scale (param $v f64) (param $n f64) (result f64)
    (local $k i32)
    (if (f64.ne (local.get $n) (local.get $n)) (then (return (local.get $n))))
    (if (i32.or (f64.eq (local.get $v) (f64.const 0))
                (i32.or (f64.ne (local.get $v) (local.get $v))
                        (f64.eq (f64.abs (local.get $v)) (f64.const inf))))
      (then
        (if (i32.or
              (i32.and (f64.eq (local.get $v) (f64.const 0)) (f64.eq (local.get $n) (f64.const inf)))
              (i32.and (f64.eq (f64.abs (local.get $v)) (f64.const inf)) (f64.eq (local.get $n) (f64.const -inf))))
          (then (call $fpu_set_exc (i32.const 0x01)) (return (f64.const nan))))
        (return (local.get $v))))
    ;; A finite nonzero f64 reaches 0 or Inf well inside +-4200 steps.
    (local.set $k (i32.trunc_sat_f64_s
      (f64.min (f64.max (f64.trunc (local.get $n)) (f64.const -4200)) (f64.const 4200))))
    (block $up_done (loop $up
      (br_if $up_done (i32.le_s (local.get $k) (i32.const 1023)))
      (local.set $v (f64.mul (local.get $v) (f64.reinterpret_i64 (i64.const 0x7FE0000000000000))))
      (local.set $k (i32.sub (local.get $k) (i32.const 1023)))
      (br $up)))
    (block $down_done (loop $down
      (br_if $down_done (i32.ge_s (local.get $k) (i32.const -1022)))
      (local.set $v (f64.mul (local.get $v) (f64.reinterpret_i64 (i64.const 0x0010000000000000))))
      (local.set $k (i32.add (local.get $k) (i32.const 1022)))
      (br $down)))
    (f64.mul (local.get $v)
      (f64.reinterpret_i64 (i64.shl (i64.extend_i32_u (i32.add (local.get $k) (i32.const 1023))) (i64.const 52)))))

  (func $fpu_round_by (param $v f64) (param $rc i32) (result f64)
    (if (result f64) (i32.eq (local.get $rc) (i32.const 1)) (then (f64.floor (local.get $v)))
    (else (if (result f64) (i32.eq (local.get $rc) (i32.const 2)) (then (f64.ceil (local.get $v)))
    (else (if (result f64) (i32.eq (local.get $rc) (i32.const 3)) (then (f64.trunc (local.get $v)))
    (else (f64.nearest (local.get $v)))))))))

  ;; Round an FMUL result to the selected 24-bit significand without reducing
  ;; the f64 exponent range to f32. PC=53/64 retain this engine's f64 behavior.
  ;; Like the rest of x87-lite, multiplication first rounds to f64: this does
  ;; not emulate 80-bit exponent range or eliminate double-rounding at a
  ;; 24-bit halfway boundary. RC applies to the precision reduction below.
  (func $fpu_mul (param $a f64) (param $b f64) (result f64)
    (local $v f64) (local $bits i64) (local $mag i64)
    (local $drop i64) (local $mask i64) (local $lost i64)
    (local $half i64) (local $rc i32) (local $up i32)
    (local.set $v (f64.mul (local.get $a) (local.get $b)))
    (if (i32.ne (i32.and (global.get $fpu_cw) (i32.const 0x300)) (i32.const 0))
      (then (return (local.get $v))))
    (local.set $bits (i64.reinterpret_f64 (local.get $v)))
    (local.set $mag (i64.and (local.get $bits) (i64.const 0x7fffffffffffffff)))
    ;; Preserve NaN payloads, infinities and signed zero.
    (if (i32.or (i64.ge_u (local.get $mag) (i64.const 0x7ff0000000000000))
                (i64.eqz (local.get $mag)))
      (then (return (local.get $v))))
    (local.set $drop (i64.const 29))
    ;; An f64 subnormal has no implicit leading bit. Keep 24 significant
    ;; bits relative to its actual leading bit, not the normal exponent.
    (if (i64.lt_u (local.get $mag) (i64.const 0x0010000000000000))
      (then
        (local.set $drop (i64.sub (i64.const 40) (i64.clz (local.get $mag))))
        (if (i64.le_s (local.get $drop) (i64.const 0))
          (then (return (local.get $v))))))
    (local.set $mask (i64.sub (i64.shl (i64.const 1) (local.get $drop)) (i64.const 1)))
    (local.set $lost (i64.and (local.get $mag) (local.get $mask)))
    (if (i64.eqz (local.get $lost)) (then (return (local.get $v))))
    (local.set $rc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 10)) (i32.const 3)))
    (if (i32.eqz (local.get $rc))
      (then
        (local.set $half (i64.shl (i64.const 1) (i64.sub (local.get $drop) (i64.const 1))))
        (local.set $up (i32.or (i64.gt_u (local.get $lost) (local.get $half))
          (i32.and (i64.eq (local.get $lost) (local.get $half))
            (i64.ne (i64.and (i64.shr_u (local.get $mag) (local.get $drop)) (i64.const 1)) (i64.const 0))))))
      (else
        (local.set $up (i32.or
          (i32.and (i32.eq (local.get $rc) (i32.const 1)) (i64.lt_s (local.get $bits) (i64.const 0)))
          (i32.and (i32.eq (local.get $rc) (i32.const 2)) (i64.ge_s (local.get $bits) (i64.const 0)))))))
    (local.set $mag (i64.and (local.get $mag) (i64.xor (local.get $mask) (i64.const -1))))
    (if (local.get $up)
      (then (local.set $mag (i64.add (local.get $mag) (i64.shl (i64.const 1) (local.get $drop))))))
    (f64.reinterpret_i64 (i64.or (local.get $mag)
      (i64.and (local.get $bits) (i64.const 0x8000000000000000)))))

  (func $fpu_arith (param $a f64) (param $b f64) (param $op i32) (result f64)
    ;; FDIV (op=6: a/b) and FDIVR (op=7: b/a) — flag ZE if the divisor is zero.
    ;; The WASM result is ±inf which we let through; real x87 with ZE masked
    ;; produces the same value.
    (if (i32.eq (local.get $op) (i32.const 6))
      (then (if (f64.eq (local.get $b) (f64.const 0)) (then (call $fpu_set_exc (i32.const 0x04))))))
    (if (i32.eq (local.get $op) (i32.const 7))
      (then (if (f64.eq (local.get $a) (f64.const 0)) (then (call $fpu_set_exc (i32.const 0x04))))))
    (if (result f64) (i32.eq (local.get $op) (i32.const 0)) (then (f64.add (local.get $a) (local.get $b)))
    (else (if (result f64) (i32.eq (local.get $op) (i32.const 1)) (then (call $fpu_mul (local.get $a) (local.get $b)))
    (else (if (result f64) (i32.eq (local.get $op) (i32.const 4)) (then (f64.sub (local.get $a) (local.get $b)))
    (else (if (result f64) (i32.eq (local.get $op) (i32.const 5)) (then (f64.sub (local.get $b) (local.get $a)))
    (else (if (result f64) (i32.eq (local.get $op) (i32.const 6)) (then (f64.div (local.get $a) (local.get $b)))
    (else (f64.div (local.get $b) (local.get $a)))))))))))))

  ;; Convert ST(0) (or popped TOS) to a signed integer in [-2^(width-1), 2^(width-1)-1].
  ;; Sets IE and returns the "integer indefinite" pattern on out-of-range or NaN.
  ;; Real x87 stores 0x80000000 / 0x8000 / 0x8000000000000000 in those cases.
  (func $fpu_to_i32 (param $v f64) (result i32)
    (local.set $v (call $fpu_round (local.get $v)))
    (if (i32.or (call $fpu_is_nan (local.get $v))
                (i32.or (f64.ge (local.get $v) (f64.const 2147483648.0))
                        (f64.lt (local.get $v) (f64.const -2147483648.0))))
      (then (call $fpu_set_exc (i32.const 0x01)) (return (i32.const -2147483648))))
    (i32.trunc_f64_s (local.get $v)))

  (func $fpu_to_i16 (param $v f64) (result i32)
    (local.set $v (call $fpu_round (local.get $v)))
    (if (i32.or (call $fpu_is_nan (local.get $v))
                (i32.or (f64.ge (local.get $v) (f64.const 32768.0))
                        (f64.lt (local.get $v) (f64.const -32768.0))))
      (then (call $fpu_set_exc (i32.const 0x01)) (return (i32.const 0x8000))))
    (i32.trunc_f64_s (local.get $v)))

  (func $fpu_to_i64 (param $v f64) (result i64)
    (local.set $v (call $fpu_round (local.get $v)))
    (if (i32.or (call $fpu_is_nan (local.get $v))
                (i32.or (f64.ge (local.get $v) (f64.const 9223372036854775808.0))
                        (f64.lt (local.get $v) (f64.const -9223372036854775808.0))))
      (then (call $fpu_set_exc (i32.const 0x01)) (return (i64.const -9223372036854775808))))
    (i64.trunc_f64_s (local.get $v)))

  (func $fpu_load_mem (param $addr i32) (param $group i32) (result f64)
    (if (result f64) (i32.eq (local.get $group) (i32.const 0))
      (then (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr)))))
    (else (if (result f64) (i32.eq (local.get $group) (i32.const 4))
      (then (f64.reinterpret_i64 (call $gl64 (local.get $addr))))
    (else (if (result f64) (i32.or (i32.eq (local.get $group) (i32.const 2)) (i32.eq (local.get $group) (i32.const 3)))
      (then (f64.convert_i32_s (call $gl32_native (local.get $addr))))
    (else (if (result f64) (i32.or (i32.eq (local.get $group) (i32.const 6)) (i32.eq (local.get $group) (i32.const 7)))
      (then (f64.convert_i32_s (i32.extend16_s (call $gl16 (local.get $addr)))))
    (else
      (f64.reinterpret_i64 (call $gl64 (local.get $addr))))))))))))

  (func $fpu_load_m80 (param $addr i32) (result f64)
    (call $phys80_decode (call $gl64 (local.get $addr))
      (call $gl16 (i32.add (local.get $addr) (i32.const 8)))))

  (func $phys80_decode (param $mant i64) (param $se i32) (result f64)
    (local $exp i32) (local $sign i32)
    (local $val f64)
    (local.set $exp (i32.and (local.get $se) (i32.const 0x7FFF)))
    (local.set $sign (i32.and (local.get $se) (i32.const 0x8000)))
    (if (i64.eqz (local.get $mant))
      (then
        (if (local.get $sign)
          (then (return (f64.const -0.0)))
          (else (return (f64.const 0.0))))))
    ;; Maximal exponent. Bit 63 is m80's EXPLICIT integer bit, so the low 63
    ;; bits decide: all zero is an infinity, anything else a NaN. $fpu_store_m80
    ;; right below already writes the two apart (0x8000.. against the QNaN
    ;; indefinite 0xC000..), so collapsing them back to DBL_MAX threw away a
    ;; distinction we had encoded: _isnan/_finite answer wrong on a reloaded
    ;; value, and a float32 store of DBL_MAX overflows straight back to +/-inf
    ;; a long way from the cause -- boids' CRT loads its indefinite constant
    ;; from 0x41f0f0 and it reached the projection matrix as 0xff800000.
    (if (i32.eq (local.get $exp) (i32.const 0x7FFF))
      (then
        (if (i64.eqz (i64.and (local.get $mant) (i64.const 0x7FFFFFFFFFFFFFFF)))
          (then (local.set $val (f64.reinterpret_i64 (i64.const 0x7FF0000000000000))))
          (else (local.set $val (f64.reinterpret_i64 (i64.const 0x7FF8000000000000)))))
        (if (local.get $sign) (then (local.set $val (f64.neg (local.get $val)))))
        (return (local.get $val))))
    (local.set $val
      (f64.mul
        (f64.div (f64.convert_i64_u (local.get $mant))
                 (f64.const 9223372036854775808.0))
        (call $host_math_pow2
          (f64.convert_i32_s (i32.sub (local.get $exp) (i32.const 16383))))))
    (if (local.get $sign) (then (local.set $val (f64.neg (local.get $val)))))
    (local.get $val))

  (func $fpu_store_m80_bits (param $addr i32) (param $mant i64) (param $sign_exp i32)
    (call $gs64 (local.get $addr) (local.get $mant))
    (call $gs16 (i32.add (local.get $addr) (i32.const 8)) (local.get $sign_exp)))

  (func $fpu_store_m80 (param $addr i32) (param $val f64)
    (local $sign i32) (local $exp i32) (local $mant i64)
    (local $abs f64) (local $scaled f64)
    (local.set $abs (f64.abs (local.get $val)))
    (if (i64.lt_s (i64.reinterpret_f64 (local.get $val)) (i64.const 0))
      (then (local.set $sign (i32.const 0x8000))))
    (if (call $fpu_is_nan (local.get $val))
      (then
        (call $fpu_store_m80_bits (local.get $addr) (i64.const -4611686018427387904)
          (i32.or (local.get $sign) (i32.const 0x7FFF)))
        (return)))
    (if (f64.eq (local.get $abs) (f64.const 0))
      (then
        (call $fpu_store_m80_bits (local.get $addr) (i64.const 0) (local.get $sign))
        (return)))
    (if (f64.ge (local.get $abs) (f64.const 1.7976931348623157e308))
      (then
        (call $fpu_store_m80_bits (local.get $addr) (i64.const -9223372036854775808)
          (i32.or (local.get $sign) (i32.const 0x7FFF)))
        (return)))
    (local.set $exp (i32.trunc_f64_s (f64.floor (call $host_math_log2 (local.get $abs)))))
    (local.set $scaled
      (f64.mul
        (f64.div (local.get $abs)
          (call $host_math_pow2 (f64.convert_i32_s (local.get $exp))))
        (f64.const 9223372036854775808.0)))
    (if (f64.ge (local.get $scaled) (f64.const 18446744073709551616.0))
      (then
        (local.set $mant (i64.const -9223372036854775808))
        (local.set $exp (i32.add (local.get $exp) (i32.const 1))))
      (else
        (local.set $mant (i64.trunc_f64_u (local.get $scaled)))))
    (call $fpu_store_m80_bits (local.get $addr) (local.get $mant)
      (i32.or (local.get $sign)
        (i32.and (i32.add (local.get $exp) (i32.const 16383)) (i32.const 0x7FFF)))))

  ;; ── FNSTENV / FLDENV / FNSAVE / FRSTOR / FBLD / FBSTP helpers ─────
  ;; 32-bit protected-mode env block (28 bytes): CW, SW (with TOP packed),
  ;; Tag word (2 bits/reg: 00=valid, 11=empty), FIP, FCS:opcode, FDP, FDS.
  ;; We collapse all "valid" subtypes to 00 since our tag global is 1-bit/reg.
  (func $fpu_pack_tag_word (result i32)
    (local $i i32) (local $w i32)
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (if (i32.eqz (i32.and (i32.shr_u (global.get $fpu_tag) (local.get $i)) (i32.const 1)))
        (then (local.set $w (i32.or (local.get $w)
          (i32.shl (i32.const 3) (i32.shl (local.get $i) (i32.const 1)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (local.get $w))

  (func $fpu_unpack_tag_word (param $tw i32)
    (local $i i32) (local $t i32)
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (if (i32.ne
            (i32.and (i32.shr_u (local.get $tw) (i32.shl (local.get $i) (i32.const 1))) (i32.const 3))
            (i32.const 3))
        (then (local.set $t (i32.or (local.get $t) (i32.shl (i32.const 1) (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (global.set $fpu_tag (local.get $t)))

  ;; FIP (+12) / FCS:FOP (+16) / FDP (+20) / FDS (+24): on real x87 these
  ;; record the linear address + selector + opcode of the last non-control
  ;; FPU instruction and its memory operand, so an #MF handler can identify
  ;; the faulting op. We never deliver #MF (masked exceptions only set SW
  ;; flags and continue), nothing in our test corpus reads these fields,
  ;; we have no segment selectors to report, and computing a real FIP would
  ;; require stashing EIP in every FPU thread handler. We write zeros and
  ;; document the gap. If a guest ever does parse them it sees a null
  ;; selector — easy to spot if it ever matters.
  (func $fpu_store_env (param $addr i32)
    (call $gs32 (local.get $addr) (global.get $fpu_cw))
    (call $gs32 (i32.add (local.get $addr) (i32.const 4))
      (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xC7FF))
              (i32.shl (global.get $fpu_top) (i32.const 11))))
    (call $gs32 (i32.add (local.get $addr) (i32.const 8)) (call $fpu_pack_tag_word))
    (call $gs32 (i32.add (local.get $addr) (i32.const 12)) (i32.const 0))   ;; FIP
    (call $gs32 (i32.add (local.get $addr) (i32.const 16)) (i32.const 0))   ;; FCS:FOP
    (call $gs32 (i32.add (local.get $addr) (i32.const 20)) (i32.const 0))   ;; FDP
    (call $gs32 (i32.add (local.get $addr) (i32.const 24)) (i32.const 0)))  ;; FDS

  (func $fpu_load_env (param $addr i32)
    (local $sw i32)
    (global.set $fpu_cw (i32.and (call $gl32_native (local.get $addr)) (i32.const 0xFFFF)))
    (local.set $sw (i32.and (call $gl32_native (i32.add (local.get $addr) (i32.const 4))) (i32.const 0xFFFF)))
    (global.set $fpu_top (i32.and (i32.shr_u (local.get $sw) (i32.const 11)) (i32.const 7)))
    (global.set $fpu_sw (i32.and (local.get $sw) (i32.const 0xC7FF)))
    (global.set $fpu_raw_tag (i32.const 0))
    (call $fpu_unpack_tag_word
      (i32.and (call $gl32_native (i32.add (local.get $addr) (i32.const 8))) (i32.const 0xFFFF))))

  ;; FNSAVE/FRSTOR ST area: 8 x 10-byte slots in PHYSICAL order.
  (func $fpu_store_regs (param $addr i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $each
      (call $phys80_store (i32.add (local.get $addr) (i32.mul (local.get $i) (i32.const 10)))
        (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $each (i32.lt_u (local.get $i) (i32.const 8)))))

  (func $fpu_load_regs (param $addr i32)
    (local $i i32)
    (loop $each
      (call $phys80_load (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7))
        (i32.add (local.get $addr) (i32.mul (local.get $i) (i32.const 10))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $each (i32.lt_u (local.get $i) (i32.const 8)))))

  ;; FBLD: 80-bit packed BCD → ST(0). 18 BCD digits in low 9 bytes
  ;; (low nibble = lower digit), sign byte at offset 9 (bit 7 = negative).
  (func $fpu_bld (param $addr i32)
    (local $i i32) (local $b i32) (local $val f64) (local $mult f64)
    (local.set $mult (f64.const 1))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 9)))
      (local.set $b (call $gl8 (i32.add (local.get $addr) (local.get $i))))
      (local.set $val (f64.add (local.get $val)
        (f64.mul (f64.convert_i32_u (i32.and (local.get $b) (i32.const 0x0F)))
                 (local.get $mult))))
      (local.set $mult (f64.mul (local.get $mult) (f64.const 10)))
      (local.set $val (f64.add (local.get $val)
        (f64.mul (f64.convert_i32_u (i32.and (i32.shr_u (local.get $b) (i32.const 4)) (i32.const 0x0F)))
                 (local.get $mult))))
      (local.set $mult (f64.mul (local.get $mult) (f64.const 10)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (if (i32.and (call $gl8 (i32.add (local.get $addr) (i32.const 9))) (i32.const 0x80))
      (then (local.set $val (f64.neg (local.get $val)))))
    (call $fpu_push (local.get $val)))

  ;; FBSTP: ST(0) → 80-bit packed BCD, then pop.
  (func $fpu_bstp (param $addr i32)
    (local $i i32) (local $sign i32) (local $val f64) (local $vi i64)
    (local $rem i32) (local $tens i32) (local $ones i32)
    (local.set $val (call $fpu_pop))
    (if (f64.lt (local.get $val) (f64.const 0))
      (then (local.set $sign (i32.const 0x80)) (local.set $val (f64.neg (local.get $val)))))
    (local.set $val (f64.nearest (local.get $val)))
    ;; BCD max is 10^18 - 1; clamp out-of-range and NaN to zero (i64.trunc traps otherwise).
    (if (i32.or (f64.ne (local.get $val) (local.get $val))
                (f64.ge (local.get $val) (f64.const 1e18)))
      (then (local.set $val (f64.const 0))))
    (local.set $vi (i64.trunc_f64_u (local.get $val)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 9)))
      (local.set $rem (i32.wrap_i64 (i64.rem_u (local.get $vi) (i64.const 100))))
      (local.set $vi  (i64.div_u (local.get $vi) (i64.const 100)))
      (local.set $ones (i32.rem_u (local.get $rem) (i32.const 10)))
      (local.set $tens (i32.div_u (local.get $rem) (i32.const 10)))
      (call $gs8 (i32.add (local.get $addr) (local.get $i))
        (i32.or (i32.shl (local.get $tens) (i32.const 4)) (local.get $ones)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (call $gs8 (i32.add (local.get $addr) (i32.const 9)) (local.get $sign)))

  ;; --no-fpu-direct: $fpu_exec_mem's direct-f64 memory forms off (A/B)
  (global $fpu_direct (mut i32) (i32.const 1))
  (func (export "set_fpu_direct") (param $on i32) (global.set $fpu_direct (i32.ne (local.get $on) (i32.const 0))))
  (func $fpu_exec_mem (param $group i32) (param $reg i32) (param $addr i32)
    (local $val f64) (local $raw i64) (local $p i32) (local $m i32) (local $a f64)
    ;; Group 0 (D8) / Group 4 (DC): arithmetic with float32/float64.
    ;; Direct f64: the operand loaded as $fpu_load_mem would, then ST(0),
    ;; the compare, the pop and the store written inline -- what $fpu_get /
    ;; $fpu_compare / $fpu_pop / $fpu_set do, in the same order, with their
    ;; exception paths ($fpu_set_exc) kept as calls. --no-fpu-direct
    ;; ($fpu_direct 0) runs the original calls below instead, for the A/B.
    (if (i32.and (i32.ne (global.get $fpu_direct) (i32.const 0))
                 (i32.eqz (i32.and (local.get $group) (i32.const 3))))
      (then
        (local.set $val
          (if (result f64) (i32.eqz (local.get $group))
            (then (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr)))))
            (else (f64.reinterpret_i64 (call $gl64 (local.get $addr))))))
        (local.set $p (global.get $fpu_top))
        (local.set $a (f64.load (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3)))))
        (if (i32.lt_u (i32.sub (local.get $reg) (i32.const 2)) (i32.const 2))
          (then
            ;; main's exact compare: the physical image first, f64 otherwise
            (call $fpu_image_compare (local.get $a) (local.get $val) (i32.const -1) (i32.const 0))
            (if (i32.eq (local.get $reg) (i32.const 3))
              (then
                (if (i32.eqz (i32.and (i32.shr_u (global.get $fpu_tag) (local.get $p)) (i32.const 1)))
                  (then (call $fpu_set_exc (i32.const 0x41))))
                (local.set $m (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $p))))
                (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag) (local.get $m)))
                (global.set $fpu_tag (i32.and (global.get $fpu_tag) (local.get $m)))
                (global.set $fpu_top (i32.and (i32.add (local.get $p) (i32.const 1)) (i32.const 7)))))
            (return)))
        ;; add / sub / subr inline; mul and the divides keep $fpu_arith
        ;; ($fpu_mul's precision control, the ZE checks)
        (local.set $a
          (if (result f64) (i32.eqz (local.get $reg)) (then (f64.add (local.get $a) (local.get $val)))
            (else (if (result f64) (i32.eq (local.get $reg) (i32.const 4)) (then (f64.sub (local.get $a) (local.get $val)))
              (else (if (result f64) (i32.eq (local.get $reg) (i32.const 5)) (then (f64.sub (local.get $val) (local.get $a)))
                (else (call $fpu_arith (local.get $a) (local.get $val) (local.get $reg)))))))))
        ;; $fpu_set 0: TOP re-read, as the original's argument order leaves it
        (if (global.get $eip_redirected) (then (return)))
        (local.set $p (global.get $fpu_top))
        (f64.store (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3))) (local.get $a))
        (local.set $m (i32.shl (i32.const 1) (local.get $p)))
        (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag) (i32.xor (i32.const 0xFF) (local.get $m))))
        (global.set $fpu_tag (i32.or (global.get $fpu_tag) (local.get $m)))
        (call $phys80_invalidate (local.get $p))
        (call $phys80_materialize (local.get $p))
        (return)))
    ;; FLD m64 (DD /0), FLD m32 (D9 /0), FILD m32 (DB /0): the operand
    ;; loaded first, then $fpu_push inline
    (if (i32.and (i32.and (i32.ne (global.get $fpu_direct) (i32.const 0)) (i32.eqz (local.get $reg)))
                 (i32.or (i32.eq (local.get $group) (i32.const 5))
                         (i32.or (i32.eq (local.get $group) (i32.const 1)) (i32.eq (local.get $group) (i32.const 3)))))
      (then
        (local.set $val
          (if (result f64) (i32.eq (local.get $group) (i32.const 5))
            (then (f64.reinterpret_i64 (call $gl64 (local.get $addr))))
            (else (if (result f64) (i32.eq (local.get $group) (i32.const 1))
              (then (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr)))))
              (else (f64.convert_i32_s (call $gl32 (local.get $addr))))))))
        (if (global.get $eip_redirected) (then (return)))
        (local.set $p (i32.and (i32.sub (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
        (global.set $fpu_top (local.get $p))
        (local.set $m (i32.shl (i32.const 1) (local.get $p)))
        (if (i32.ne (i32.and (global.get $fpu_tag) (local.get $m)) (i32.const 0))
          (then (call $fpu_set_exc (i32.const 0x41))))
        (f64.store (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3))) (local.get $val))
        (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag) (i32.xor (i32.const 0xFF) (local.get $m))))
        (global.set $fpu_tag (i32.or (global.get $fpu_tag) (local.get $m)))
        (call $phys80_invalidate (local.get $p))
        (call $phys80_materialize (local.get $p))
        (return)))
    ;; Group 0 (D8) / Group 4 (DC) with --no-fpu-direct
    (if (i32.or (i32.eq (local.get $group) (i32.const 0)) (i32.eq (local.get $group) (i32.const 4)))
      (then
        (local.set $val (call $fpu_load_mem (local.get $addr) (local.get $group)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $fpu_image_compare (call $fpu_get (i32.const 0)) (local.get $val) (i32.const -1) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $fpu_image_compare (call $fpu_get (i32.const 0)) (local.get $val) (i32.const -1) (i32.const 0)) (drop (call $fpu_pop)) (return)))
        (call $fpu_set (i32.const 0) (call $fpu_arith (call $fpu_get (i32.const 0)) (local.get $val) (local.get $reg)))
        (return)))
    ;; Group 2 (DA) / Group 6 (DE): arithmetic with int32/int16
    (if (i32.or (i32.eq (local.get $group) (i32.const 2)) (i32.eq (local.get $group) (i32.const 6)))
      (then
        (local.set $val (call $fpu_load_mem (local.get $addr) (local.get $group)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $fpu_image_compare (call $fpu_get (i32.const 0)) (local.get $val) (i32.const -1) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $fpu_image_compare (call $fpu_get (i32.const 0)) (local.get $val) (i32.const -1) (i32.const 0)) (drop (call $fpu_pop)) (return)))
        (call $fpu_set (i32.const 0) (call $fpu_arith (call $fpu_get (i32.const 0)) (local.get $val) (local.get $reg)))
        (return)))
    ;; Group 1 (D9): FLD/FST/FSTP float32, FLDENV, FLDCW, FNSTENV, FNSTCW
    (if (i32.eq (local.get $group) (i32.const 1))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_push (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr))))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then
            (call $gs32 (local.get $addr)
              (i32.reinterpret_f32 (f32.demote_f64 (call $fpu_get (i32.const 0)))))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then
            (call $gs32 (local.get $addr)
              (i32.reinterpret_f32 (f32.demote_f64 (call $fpu_pop))))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (global.set $fpu_cw (call $gl16 (local.get $addr))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          (then (call $gs16 (local.get $addr) (global.get $fpu_cw)) (return)))
        ;; reg=4 FLDENV, reg=6 FNSTENV — 28-byte 32-bit protected-mode env block.
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (call $fpu_load_env (local.get $addr)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_store_env (local.get $addr))
                ;; Real FNSTENV masks all exceptions in CW after save.
                (global.set $fpu_cw (i32.or (global.get $fpu_cw) (i32.const 0x3F)))
                (return)))
        (call $fpu_crash_op (local.get $group) (local.get $reg) (i32.const 0)) (return)))
    ;; Group 5 (DD): FLD/FST/FSTP float64, FRSTOR, FNSAVE, FNSTSW m16
    (if (i32.eq (local.get $group) (i32.const 5))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_push (f64.reinterpret_i64 (call $gl64 (local.get $addr)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then
            (call $gs64 (local.get $addr) (i64.reinterpret_f64 (call $fpu_get (i32.const 0))))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then
            (call $gs64 (local.get $addr) (i64.reinterpret_f64 (call $fpu_pop)))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          (then
            (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xC7FF))
              (i32.shl (global.get $fpu_top) (i32.const 11))))
            (call $gs16 (local.get $addr) (global.get $fpu_sw)) (return)))
        ;; reg=4 FRSTOR, reg=6 FNSAVE — 108-byte: 28-byte env + 8×10-byte STs.
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (call $fpu_load_env (local.get $addr))
                (call $fpu_load_regs (i32.add (local.get $addr) (i32.const 28)))
                (return)))
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_store_env (local.get $addr))
                (call $fpu_store_regs (i32.add (local.get $addr) (i32.const 28)))
                ;; Post-FNSAVE: reinit to power-on state (matches real x87).
                (call $fpu_reset (i32.const 0x037F))
                (return)))
        (call $fpu_crash_op (local.get $group) (local.get $reg) (i32.const 0)) (return)))
    ;; Group 3 (DB): FILD/FIST/FISTP int32, FLD/FSTP m80
    (if (i32.eq (local.get $group) (i32.const 3))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_push (f64.convert_i32_s (call $gl32 (local.get $addr)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $phys80_fist (local.get $addr) (i32.const 32) (i32.const 0) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $phys80_fist (local.get $addr) (i32.const 32) (i32.const 1) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          ;; FLD m80 — decode real 80-bit extended values into f64.
          (then (call $phys80_push_mem (local.get $addr)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          ;; FSTP m80 — convert f64-backed ST(0) to real 80-bit extended format.
          (then (call $phys80_store (local.get $addr) (global.get $fpu_top)) (if (i32.eqz (global.get $eip_redirected)) (then (drop (call $fpu_pop)))) (return)))
        (call $fpu_crash_op (local.get $group) (local.get $reg) (i32.const 0)) (return)))
    ;; Group 7 (DF): FILD/FIST/FISTP int16, FILD/FISTP int64
    (if (i32.eq (local.get $group) (i32.const 7))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_push (f64.convert_i32_s (i32.extend16_s (call $gl16 (local.get $addr))))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $phys80_fist (local.get $addr) (i32.const 16) (i32.const 0) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $phys80_fist (local.get $addr) (i32.const 16) (i32.const 1) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (call $fpu_bld (local.get $addr)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then
            (local.set $raw (call $gl64 (local.get $addr)))
            (call $fpu_push (f64.convert_i64_s (local.get $raw)))
            (call $fpu_raw_set (i32.const 0) (local.get $raw))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_bstp (local.get $addr)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          (then
            (call $phys80_fist (local.get $addr) (i32.const 64) (i32.const 1) (i32.const 0))
            (return)))
        (call $fpu_crash_op (local.get $group) (local.get $reg) (i32.const 0)) (return)))
    (call $fpu_crash_op (local.get $group) (local.get $reg) (i32.const 0))
  )

  (func $fpu_exec_reg (param $group i32) (param $reg i32) (param $rm i32)
    (local $v f64) (local $st0 f64)
    (local $raw0 i64) (local $rawi i64)
    (local $raw0_valid i32) (local $rawi_valid i32)
    (local.set $st0 (call $fpu_get (i32.const 0)))
    ;; Group 0 (D8): arith ST(0), ST(rm) — every reg value (0..7) is a valid op
    (if (i32.eq (local.get $group) (i32.const 0))
      (then
        (local.set $v (call $fpu_get (local.get $rm)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $fpu_image_compare (local.get $st0) (local.get $v) (local.get $rm) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $fpu_image_compare (local.get $st0) (local.get $v) (local.get $rm) (i32.const 0)) (drop (call $fpu_pop)) (return)))
        (call $fpu_set (i32.const 0) (call $fpu_arith (local.get $st0) (local.get $v) (local.get $reg)))
        (return)))
    ;; Group 1 (D9): FLD, FXCH, constants, transcendentals
    (if (i32.eq (local.get $group) (i32.const 1))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $phys80_push_copy (local.get $rm)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 1))
          (then
            (call $phys80_exchange (local.get $rm))
            (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
            (return)))
        ;; reg=2: only D9 D0 (rm=0) is FNOP. D9 D1..D7 are reserved.
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then
            (if (i32.eq (local.get $rm) (i32.const 0)) (then (return)))
            (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then
            (if (i32.eq (local.get $rm) (i32.const 0))
              (then (call $phys80_sign (i32.const 0)) (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF))) (return)))
            (if (i32.eq (local.get $rm) (i32.const 1))
              (then (call $phys80_sign (i32.const 1)) (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF))) (return)))
            (if (i32.eq (local.get $rm) (i32.const 4))
              (then (call $fpu_image_compare (local.get $st0) (f64.const 0) (i32.const -1) (i32.const 0)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 5))
              (then (call $fpu_fxam) (return)))
            ;; D9 E2/E3/E6/E7 — reserved.
            (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then
            (if (i32.eq (local.get $rm) (i32.const 0)) (then (call $fpu_push (f64.const 1.0)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 1)) (then (call $fpu_push (f64.const 3.321928094887362)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 2)) (then (call $fpu_push (f64.const 1.4426950408889634)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 3)) (then (call $fpu_push (f64.const 3.141592653589793)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 4)) (then (call $fpu_push (f64.const 0.3010299957316877)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 5)) (then (call $fpu_push (f64.const 0.6931471805599453)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 6)) (then (call $fpu_push (f64.const 0.0)) (return)))
            ;; D9 EF — reserved.
            (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then
            (if (i32.eq (local.get $rm) (i32.const 2))
              (then ;; FPTAN: ST(0) = tan(ST(0)), push 1.0
                (if (call $fpu_trig_c2 (local.get $st0))
                  (then
                    (call $fpu_set (i32.const 0) (call $host_math_tan (local.get $st0)))
                    (call $fpu_push (f64.const 1.0))))
                (return)))
            (if (i32.eq (local.get $rm) (i32.const 3))
              (then ;; FPATAN: ST(1) = atan2(ST(1), ST(0)), pop
                (call $fpu_set (i32.const 1) (call $host_math_atan2 (call $fpu_get (i32.const 1)) (local.get $st0)))
                (drop (call $fpu_pop)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 4))
              (then (call $fpu_fxtract) (return))) ;; FXTRACT
            (if (i32.eq (local.get $rm) (i32.const 6))
              (then (global.set $fpu_top (i32.and (i32.sub (global.get $fpu_top) (i32.const 1)) (i32.const 7))) (return)))
            (if (i32.eq (local.get $rm) (i32.const 7))
              (then (global.set $fpu_top (i32.and (i32.add (global.get $fpu_top) (i32.const 1)) (i32.const 7))) (return)))
            (if (i32.eq (local.get $rm) (i32.const 0))
              (then ;; F2XM1: ST(0) = 2^ST(0) - 1
                ;; Intel's zero results retain the input sign; 2^(-0) - 1 loses it.
                (if (f64.eq (local.get $st0) (f64.const 0))
                  (then (call $fpu_set (i32.const 0) (local.get $st0)) (return)))
                (call $fpu_set (i32.const 0) (f64.sub (call $host_math_pow2 (local.get $st0)) (f64.const 1.0))) (return)))
            (if (i32.eq (local.get $rm) (i32.const 1))
              (then ;; FYL2X: ST(1) = ST(1) * log2(ST(0)), pop
                (call $fpu_set (i32.const 1) (f64.mul (call $fpu_get (i32.const 1)) (call $host_math_log2 (local.get $st0))))
                (drop (call $fpu_pop)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 5))
              (then ;; FPREM1: IEEE remainder ST(0) mod ST(1); C2 clear, Q bits
                (local.set $v (f64.nearest (f64.div (local.get $st0) (call $fpu_get (i32.const 1)))))
                (call $fpu_set (i32.const 0)
                  (f64.sub (local.get $st0)
                    (f64.mul (local.get $v) (call $fpu_get (i32.const 1)))))
                ;; An exact zero keeps the original dividend sign (Intel SDM).
                (if (f64.eq (call $fpu_get (i32.const 0)) (f64.const 0))
                  (then (call $fpu_set (i32.const 0)
                    (f64.copysign (f64.const 0) (local.get $st0)))))
                (call $fpu_prem_quotient (local.get $v))
                (return)))
            (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          (then
            (if (i32.eq (local.get $rm) (i32.const 0))
              (then ;; FPREM: ST(0) = ST(0) mod ST(1); C2 clear (complete), Q bits
                (local.set $v (f64.trunc (f64.div (local.get $st0) (call $fpu_get (i32.const 1)))))
                (call $fpu_set (i32.const 0)
                  (f64.sub (local.get $st0)
                    (f64.mul (local.get $v) (call $fpu_get (i32.const 1)))))
                ;; An exact zero keeps the original dividend sign (Intel SDM).
                (if (f64.eq (call $fpu_get (i32.const 0)) (f64.const 0))
                  (then (call $fpu_set (i32.const 0)
                    (f64.copysign (f64.const 0) (local.get $st0)))))
                (call $fpu_prem_quotient (local.get $v))
                (return)))
            (if (i32.eq (local.get $rm) (i32.const 2))
              ;; FSQRT — set IE on negative input (WASM's f64.sqrt of a
              ;; negative produces NaN, equivalent to the masked-IE result).
              (then
                ;; Exact masked canonical zero, positive infinity and unary QNaN.
                (if (i32.and (call $fpu_is_valid (i32.const 0))
                      (i32.eq (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63)))
                  (then
                    (if (i32.and (i32.load offset=16 (global.get $fpu_image_base))
                          (i32.shl (i32.const 1) (global.get $fpu_top)))
                      (then
                        (local.set $raw0 (i64.load (call $phys80_mant_addr (global.get $fpu_top))))
                        (local.set $raw0_valid (i32.load16_u (call $phys80_se_addr (global.get $fpu_top))))
                        (if (i32.or
                              (i32.and (i32.eqz (i32.and (local.get $raw0_valid) (i32.const 32767))) (i64.eqz (local.get $raw0)))
                              (i32.and
                                (i32.eq (i32.and (local.get $raw0_valid) (i32.const 32767)) (i32.const 32767))
                                (i32.or
                                  (i32.and (i32.eq (local.get $raw0_valid) (i32.const 32767))
                                    (i64.eq (local.get $raw0) (i64.const 0x8000000000000000)))
                                  (i64.eq (i64.and (local.get $raw0) (i64.const 0xC000000000000000)) (i64.const 0xC000000000000000)))))
                          (then
                            (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
                            (return)))))))
                (if (call $phys80_sqrt_exact) (then (return)))
                (if (call $phys80_sqrt_subnormal_exact) (then (return)))
                (if (call $phys80_sqrt_rounded_bounded) (then (return)))
                (if (f64.lt (local.get $st0) (f64.const 0)) (then (call $fpu_set_exc (i32.const 0x01))))
                (call $fpu_set (i32.const 0) (f64.sqrt (local.get $st0))) (return)))
            (if (i32.eq (local.get $rm) (i32.const 3))
              (then ;; FSINCOS: ST(0) = sin, push cos
                (if (call $fpu_trig_c2 (local.get $st0))
                  (then
                    (local.set $v (call $host_math_cos (local.get $st0)))
                    (call $fpu_set (i32.const 0) (call $host_math_sin (local.get $st0)))
                    (call $fpu_push (local.get $v))))
                (return)))
            (if (i32.eq (local.get $rm) (i32.const 4))
              ;; FRNDINT — set C1 to 1 if result rounded up, else 0.
              (then
                (if (call $phys80_frndint) (then (return)))
                (local.set $v (call $fpu_round (local.get $st0)))
                (if (f64.gt (local.get $v) (local.get $st0))
                  (then (global.set $fpu_sw (i32.or (global.get $fpu_sw) (i32.const 0x0200))))
                  (else (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))))
                (call $fpu_set (i32.const 0) (local.get $v)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 6))
              (then ;; FSIN
                (if (call $fpu_trig_c2 (local.get $st0))
                  (then (call $fpu_set (i32.const 0) (call $host_math_sin (local.get $st0)))))
                (return)))
            (if (i32.eq (local.get $rm) (i32.const 7))
              (then ;; FCOS
                (if (call $fpu_trig_c2 (local.get $st0))
                  (then (call $fpu_set (i32.const 0) (call $host_math_cos (local.get $st0)))))
                (return)))
            (if (i32.eq (local.get $rm) (i32.const 1))
              (then ;; FYL2XP1: ST(1) = ST(1) * log2(ST(0) + 1), pop
                ;; Preserve the input zero sign (Intel SDM Table 3-49).
                (if (f64.eq (local.get $st0) (f64.const 0))
                  (then
                    (call $fpu_set (i32.const 1) (f64.mul (call $fpu_get (i32.const 1)) (local.get $st0)))
                    (drop (call $fpu_pop)) (return)))
                (call $fpu_set (i32.const 1) (f64.mul (call $fpu_get (i32.const 1)) (call $host_math_log2 (f64.add (local.get $st0) (f64.const 1.0)))))
                (drop (call $fpu_pop)) (return)))
            (if (i32.eq (local.get $rm) (i32.const 5))
              (then ;; FSCALE: ST(0) = ST(0) * 2^trunc(ST(1))
                (if (i32.eqz (call $phys80_scale))
                  (then (call $fpu_set (i32.const 0) (call $fpu_scale (local.get $st0) (call $fpu_get (i32.const 1)))))) (return)))
            (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Group 2 (DA): FCMOV / FUCOMPP
    (if (i32.eq (local.get $group) (i32.const 2))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (if (call $get_cf) (then (call $phys80_copy_logical (i32.const 0) (local.get $rm)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 1))
          (then (if (call $get_zf) (then (call $phys80_copy_logical (i32.const 0) (local.get $rm)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (if (i32.or (call $get_cf) (call $get_zf)) (then (call $phys80_copy_logical (i32.const 0) (local.get $rm)))) (return)))
        ;; DA E9 = FUCOMPP — unordered compare ST(0)<->ST(1), pop both
        (if (i32.and (i32.eq (local.get $reg) (i32.const 5)) (i32.eq (local.get $rm) (i32.const 1)))
          (then
            (call $fpu_image_compare (local.get $st0) (call $fpu_get (i32.const 1)) (i32.const 1) (i32.const 1))
            (drop (call $fpu_pop)) (drop (call $fpu_pop))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (if (call $phys80_fcmov_parity (local.get $rm) (i32.const 0)) (then (return)))))
        ;; reg=3 = FCMOVU (cmov-if-PF) — lazy flag system has no PF, not impl.
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Group 3 (DB): FCMOVN, FNINIT, FNCLEX, FUCOMI, FCOMI
    (if (i32.eq (local.get $group) (i32.const 3))
      (then
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (if (i32.eqz (call $get_cf)) (then (call $phys80_copy_logical (i32.const 0) (local.get $rm)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 1))
          (then (if (i32.eqz (call $get_zf)) (then (call $phys80_copy_logical (i32.const 0) (local.get $rm)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (if (i32.eqz (i32.or (call $get_cf) (call $get_zf))) (then (call $phys80_copy_logical (i32.const 0) (local.get $rm)))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then
            ;; DB E0 / E1 = FNENI / FNDISI — 8087 enable/disable interrupts;
            ;; documented as no-ops on 80287 and later. We accept and ignore.
            (if (i32.or (i32.eq (local.get $rm) (i32.const 0)) (i32.eq (local.get $rm) (i32.const 1)))
              (then (return)))
            ;; DB E2 = FNCLEX
            (if (i32.eq (local.get $rm) (i32.const 2))
              (then (call $fpu_trace_exc (i32.and (global.get $fpu_sw) (i32.const 0xFF)) (i32.const 0))
                    (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0x7F00))) (return)))
            ;; DB E3 = FNINIT — full reset (clear tag word too).
            (if (i32.eq (local.get $rm) (i32.const 3))
              (then (call $fpu_trace_exc (i32.and (global.get $fpu_sw) (i32.const 0xFF)) (i32.const 0))
                    (call $fpu_reset (i32.const 0x037F)) (return)))
            (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
        ;; DB E8..EF = FUCOMI ST(i)
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (local.get $rm)) (local.get $rm) (i32.const 3)) (return)))
        ;; DB F0..F7 = FCOMI ST(i)
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (local.get $rm)) (local.get $rm) (i32.const 2)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (if (call $phys80_fcmov_parity (local.get $rm) (i32.const 1)) (then (return)))))
        ;; reg=3 = FCMOVNU, reg=7 = reserved.
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Group 4 (DC): arith ST(rm), ST(0)
    (if (i32.eq (local.get $group) (i32.const 4))
      (then
        (local.set $v (call $fpu_get (local.get $rm)))
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_set (local.get $rm) (f64.add (local.get $v) (local.get $st0))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 1))
          (then (call $fpu_set (local.get $rm) (call $fpu_mul (local.get $v) (local.get $st0))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (call $fpu_set (local.get $rm) (f64.sub (local.get $st0) (local.get $v))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (call $fpu_set (local.get $rm) (f64.sub (local.get $v) (local.get $st0))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_set (local.get $rm) (f64.div (local.get $st0) (local.get $v))) (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          (then (call $fpu_set (local.get $rm) (f64.div (local.get $v) (local.get $st0))) (return)))
        ;; DC D0+i / DC D8+i: the undocumented FCOM / FCOMP ST(i) aliases of
        ;; D8 D0+i / D8 D8+i, which every x87 since the 8087 executes the same
        ;; way. Trespasser's compiler emits "fcomp st(0)" as DC D8 to compare
        ;; and pop (0x539172 in its level loader).
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $fpu_compare (local.get $st0) (local.get $v)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $fpu_compare (local.get $st0) (local.get $v)) (drop (call $fpu_pop)) (return)))
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Group 5 (DD): FFREE, FST, FSTP, FUCOM, FUCOMP
    (if (i32.eq (local.get $group) (i32.const 5))
      (then
        ;; DD C0..C7 = FFREE ST(i): mark target empty, leave value bits alone.
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_mark_empty (local.get $rm)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $phys80_copy_logical (local.get $rm) (i32.const 0)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $phys80_copy_logical (local.get $rm) (i32.const 0)) (drop (call $fpu_pop)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (local.get $rm)) (local.get $rm) (i32.const 1)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (local.get $rm)) (local.get $rm) (i32.const 1)) (drop (call $fpu_pop)) (return)))
        ;; reg=1 = FXCH alt, reg=6 = reserved, reg=7 = reserved.
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Group 6 (DE): FADDP/FMULP/FCOMPP/FSUBRP/FSUBP/FDIVRP/FDIVP
    (if (i32.eq (local.get $group) (i32.const 6))
      (then
        (local.set $v (call $fpu_get (local.get $rm)))
        (if (i32.eq (local.get $reg) (i32.const 0))
          (then (call $fpu_set (local.get $rm) (f64.add (local.get $v) (local.get $st0))) (drop (call $fpu_pop)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 1))
          (then (call $fpu_set (local.get $rm) (call $fpu_mul (local.get $v) (local.get $st0))) (drop (call $fpu_pop)) (return)))
        (if (i32.and (i32.eq (local.get $reg) (i32.const 3)) (i32.eq (local.get $rm) (i32.const 1)))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (i32.const 1)) (i32.const 1) (i32.const 0)) (drop (call $fpu_pop)) (drop (call $fpu_pop)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (call $fpu_set (local.get $rm) (f64.sub (local.get $st0) (local.get $v))) (drop (call $fpu_pop)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (call $fpu_set (local.get $rm) (f64.sub (local.get $v) (local.get $st0))) (drop (call $fpu_pop)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_set (local.get $rm) (f64.div (local.get $st0) (local.get $v))) (drop (call $fpu_pop)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 7))
          (then (call $fpu_set (local.get $rm) (f64.div (local.get $v) (local.get $st0))) (drop (call $fpu_pop)) (return)))
        ;; reg=2 = FCOMP alt — not impl.
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Group 7 (DF): FNSTSW AX, FUCOMIP, FCOMIP
    (if (i32.eq (local.get $group) (i32.const 7))
      (then
        ;; DF E0 = FNSTSW AX
        (if (i32.and (i32.eq (local.get $reg) (i32.const 4)) (i32.eq (local.get $rm) (i32.const 0)))
          (then
            (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xC7FF))
              (i32.shl (global.get $fpu_top) (i32.const 11))))
            (i32.store16 (global.get $reg_base) (global.get $fpu_sw))
            (return)))
        ;; DF E8..EF = FUCOMIP ST, ST(i) — pop after unordered compare.
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (local.get $rm)) (local.get $rm) (i32.const 3)) (drop (call $fpu_pop)) (return)))
        ;; DF F0..F7 = FCOMIP ST, ST(i)
        (if (i32.eq (local.get $reg) (i32.const 6))
          (then (call $fpu_image_compare (local.get $st0) (call $fpu_get (local.get $rm)) (local.get $rm) (i32.const 2)) (drop (call $fpu_pop)) (return)))
        ;; reg=0 = FFREEP ST(i), reg=1..3 = FXCH/FSTP aliases, reg=7 = reserved.
        (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm)) (return)))
    ;; Unknown group — should be impossible since the decoder only emits 0..7.
    (call $fpu_crash_op (local.get $group) (local.get $reg) (local.get $rm))
  )

  ;; 188: FPU memory op — op=(group<<4)|reg, addr in next word
  (func $th_fpu_mem (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (read-thread-word))
    (if (i32.eq (local.get $addr) (global.get $SIB_SENTINEL))
      (then (local.set $addr (global.get $ea_temp))))
    (call $fpu_exec_mem
      (i32.shr_u (local.get $op) (i32.const 4))
      (i32.and (local.get $op) (i32.const 0xF))
      (local.get $addr))
    (dispatch-next))

  ;; 189: FPU register op — op=(group<<8)|(reg<<4)|rm
  (func $th_fpu_reg (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $fpu_exec_reg
      (i32.shr_u (local.get $op) (i32.const 8))
      (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
      (i32.and (local.get $op) (i32.const 0xF)))
    (dispatch-next))

  ;; 500: the body of a statically linked MSVC _ftol, which the decoder
  ;; recognises by its exact bytes ($ftol_body_at) and emits as this op followed
  ;; by RET. The same semantics as the imported override $handle__ftol: pop
  ;; ST(0), convert with truncation (the body's `or ah,0Ch` + fldcw), restore
  ;; the caller's control word, return the 64-bit result in EDX:EAX. Not
  ;; reproduced, as with the import: the body's scratch stores below ESP and
  ;; the flags its `add esp`/`or ah` leave, both dead in the MSVC calling
  ;; convention. Croc 2 spends 14% of its block entries in this one body.
  (func $th_ftol_native (param $op i32)
    (local $nx_fn i32) (local $nx_op i32)
    (local $saved_cw i32)
    (local.set $saved_cw (global.get $fpu_cw))
    (global.set $fpu_cw (i32.or (local.get $saved_cw) (i32.const 0x0C00)))
    ;; This existing register-return path must publish the same conversion
    ;; status and exact retained-image integer as interpreted FISTP m64.
    (call $phys80_fist (i32.const 0) (i32.const 64) (i32.const 1) (i32.const 1))
    (global.set $fpu_cw (local.get $saved_cw))
    (dispatch-next))

  ;; 190: FPU memory op with base+disp — op=(group<<8)|(reg<<4)|base, disp in next word
  (func $th_fpu_mem_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $fpu_exec_mem
      (i32.shr_u (local.get $op) (i32.const 8))
      (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
      (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2)))) (read-thread-word)))
    (dispatch-next))

  ;; 439: canonical x87 compare branch tail:
  ;;   FNSTSW AX; TEST AH, imm8; Jcc
  ;;
  ;; MSVC emits this after FCOM/FCOMP because pre-P6 x87 comparisons publish
  ;; C0/C2/C3 in the x87 status word rather than EFLAGS.  Keep every observable
  ;; side effect of the three instructions, including TOP in the stored status
  ;; word, the upper half of EAX, TEST's lazy flags, and the final EIP.  Folding
  ;; the sequence saves two threaded dispatches at each scalar x87 comparison.
  ;; op: imm8 in bits 0-7, condition code in bits 8-11. Words: fall, target.
  (func $th_fnstsw_test_ah_jcc (param $op i32)
    (local $r i32) (local $cc i32) (local $fall i32) (local $target i32)
    (global.set $fpu_sw
      (i32.or
        (i32.and (global.get $fpu_sw) (i32.const 0xC7FF))
        (i32.shl (global.get $fpu_top) (i32.const 11))))
    (i32.store16 (global.get $reg_base) (global.get $fpu_sw))
    ;; AH is the status word's high byte; read it from $fpu_sw rather than
    ;; back out of the halfword just stored.
    (local.set $r
      (i32.and
        (i32.and (i32.shr_u (global.get $fpu_sw) (i32.const 8)) (i32.const 0xFF))
        (i32.and (local.get $op) (i32.const 0xFF))))
    (call $set_flags_logic (local.get $r))
    (global.set $flag_sign_shift (i32.const 7))
    (local.set $cc
      (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $fall (read-thread-word))
    (local.set $target (read-thread-word))
    (if (call $eval_cc (local.get $cc))
      (then (global.set $eip (local.get $target)))
      (else (global.set $eip (local.get $fall))))
    (return_call $branch_end))

(func $th_emms (param $op i32)
             (local $nx_fn i32) (local $nx_op i32)
  (global.set $fpu_top (i32.const 0))
  (global.set $fpu_tag (i32.const 0)) (dispatch-next))

  ;; Physical image: canonical low64 in MMX_FILE, SE/valid in allocated metadata.
  ;; Occupancy and signed FILD shadow validity are independent of image validity.
  (func $phys80_mant_addr (param $p i32) (result i32)
    (i32.add (global.get $mmx_base) (i32.shl (local.get $p) (i32.const 3))))
  (func $phys80_se_addr (param $p i32) (result i32)
    (i32.add (global.get $fpu_image_base) (i32.shl (local.get $p) (i32.const 1))))
  (func $phys80_invalidate (param $p i32)
    (i32.store offset=16 (global.get $fpu_image_base)
      (i32.and (i32.load offset=16 (global.get $fpu_image_base))
        (i32.xor (i32.const 255) (i32.shl (i32.const 1) (local.get $p))))))
  (func $phys80_publish (param $p i32) (param $mant i64) (param $se i32)
    (i64.store (call $phys80_mant_addr (local.get $p)) (local.get $mant))
    (i32.store16 (call $phys80_se_addr (local.get $p)) (local.get $se))
    (i32.store offset=16 (global.get $fpu_image_base)
      (i32.or (i32.load offset=16 (global.get $fpu_image_base))
        (i32.shl (i32.const 1) (local.get $p)))))
  (func $phys80_write (param $p i32) (param $mant i64) (param $se i32)
    (f64.store (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3)))
      (call $phys80_decode (local.get $mant) (local.get $se)))
    (global.set $fpu_raw_tag (i32.and (global.get $fpu_raw_tag)
      (i32.xor (i32.const 255) (i32.shl (i32.const 1) (local.get $p)))))
    (call $phys80_publish (local.get $p) (local.get $mant) (local.get $se)))
  (func $phys80_materialize (param $p i32)
    (local $bits i64) (local $mant i64) (local $mag i64)
    (local $exp i32) (local $se i32) (local $shift i64)
    (if (i32.and (i32.load offset=16 (global.get $fpu_image_base))
          (i32.shl (i32.const 1) (local.get $p))) (then (return)))
    (if (i32.and (global.get $fpu_raw_tag) (i32.shl (i32.const 1) (local.get $p)))
      (then
        (local.set $bits (call $fpu_raw_get_phys (local.get $p)))
        (local.set $mag (local.get $bits))
        (if (i64.lt_s (local.get $bits) (i64.const 0))
          (then (local.set $se (i32.const 32768))
            (local.set $mag (i64.sub (i64.const 0) (local.get $bits)))))
        (if (i64.ne (local.get $mag) (i64.const 0))
          (then
            (local.set $shift (i64.clz (local.get $mag)))
            (local.set $mant (i64.shl (local.get $mag) (local.get $shift)))
            (local.set $se (i32.or (local.get $se)
              (i32.sub (i32.const 16446) (i32.wrap_i64 (local.get $shift)))))))
        (call $phys80_publish (local.get $p) (local.get $mant) (local.get $se))
        (return)))
    (local.set $bits (i64.reinterpret_f64 (call $fpu_get_phys (local.get $p))))
    (local.set $se (i32.and (i32.wrap_i64 (i64.shr_u (local.get $bits) (i64.const 48))) (i32.const 32768)))
    (local.set $exp (i32.and (i32.wrap_i64 (i64.shr_u (local.get $bits) (i64.const 52))) (i32.const 2047)))
    (local.set $mant (i64.and (local.get $bits) (i64.const 0xFFFFFFFFFFFFF)))
    (if (i32.eqz (local.get $exp))
      (then
        (if (i64.ne (local.get $mant) (i64.const 0))
          (then
            (local.set $shift (i64.clz (local.get $mant)))
            (local.set $mant (i64.shl (local.get $mant) (local.get $shift)))
            (local.set $se (i32.or (local.get $se)
              (i32.sub (i32.const 15372) (i32.wrap_i64 (local.get $shift))))))))
      (else
        (local.set $mant (i64.or (i64.const 0x8000000000000000)
          (i64.shl (local.get $mant) (i64.const 11))))
        (local.set $se (i32.or (local.get $se)
          (select (i32.const 32767) (i32.add (local.get $exp) (i32.const 15360))
            (i32.eq (local.get $exp) (i32.const 2047)))))))
    (call $phys80_publish (local.get $p) (local.get $mant) (local.get $se)))
  (func $phys80_store (param $addr i32) (param $p i32)
    (call $phys80_materialize (local.get $p))
    (call $fpu_store_m80_bits (local.get $addr)
      (i64.load (call $phys80_mant_addr (local.get $p)))
      (i32.load16_u (call $phys80_se_addr (local.get $p)))))
  (func $phys80_load (param $p i32) (param $addr i32)
    (local $mant i64) (local $se i32)
    (local.set $mant (call $gl64 (local.get $addr)))
    (local.set $se (call $gl16 (i32.add (local.get $addr) (i32.const 8))))
    (if (i32.eqz (global.get $eip_redirected))
      (then (call $phys80_write (local.get $p) (local.get $mant) (local.get $se))
        (call $phys80_integer_shadow (local.get $p) (local.get $mant) (local.get $se)))))
  (func $phys80_push_mem (param $addr i32)
    (local $mant i64) (local $se i32)
    (local.set $mant (call $gl64 (local.get $addr)))
    (local.set $se (call $gl16 (i32.add (local.get $addr) (i32.const 8))))
    (if (global.get $eip_redirected) (then (return)))
    (call $fpu_push (call $phys80_decode (local.get $mant) (local.get $se)))
    (call $phys80_write (global.get $fpu_top) (local.get $mant) (local.get $se))
    (call $phys80_integer_shadow (global.get $fpu_top) (local.get $mant) (local.get $se)))
  (func $phys80_copy (param $dst i32) (param $src i32)
    (local $raw i64) (local $valid i32)
    (call $phys80_materialize (local.get $src))
    (local.set $valid (i32.and (i32.shr_u (global.get $fpu_raw_tag) (local.get $src)) (i32.const 1)))
    (local.set $raw (call $fpu_raw_get_phys (local.get $src)))
    (call $phys80_write (local.get $dst)
      (i64.load (call $phys80_mant_addr (local.get $src)))
      (i32.load16_u (call $phys80_se_addr (local.get $src))))
    (i64.store offset=64 (i32.add (global.get $fpu_base) (i32.shl (local.get $dst) (i32.const 3))) (local.get $raw))
    (global.set $fpu_raw_tag (i32.or (global.get $fpu_raw_tag)
      (i32.shl (local.get $valid) (local.get $dst)))))
  ;; Bounded parity moves: masked, occupied canonical images only.
  (func $phys80_fcmov_parity (param $src i32) (param $invert i32) (result i32)
    (local $n i32) (local $i i32) (local $p i32) (local $exp i32) (local $mant i64)
    (if (i32.ne (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63))
      (then (return (i32.const 0))))
    (loop $operands
      (local.set $i (select (local.get $src) (i32.const 0) (local.get $n)))
      (if (i32.eqz (call $fpu_is_valid (local.get $i))) (then (return (i32.const 0))))
      (local.set $p (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
      (if (i32.eqz (i32.and (i32.load offset=16 (global.get $fpu_image_base))
                      (i32.shl (i32.const 1) (local.get $p))))
        (then (return (i32.const 0))))
      (local.set $exp (i32.and (i32.load16_u (call $phys80_se_addr (local.get $p))) (i32.const 32767)))
      (local.set $mant (i64.load (call $phys80_mant_addr (local.get $p))))
      (if (i32.eqz (local.get $exp))
        (then (if (i64.lt_s (local.get $mant) (i64.const 0)) (then (return (i32.const 0)))))
        (else
          (if (i32.eq (local.get $exp) (i32.const 32767))
            (then
              (if (i32.eqz (i32.or
                    (i64.eq (local.get $mant) (i64.const 0x8000000000000000))
                    (i64.eq (i64.and (local.get $mant) (i64.const 0xC000000000000000)) (i64.const 0xC000000000000000))))
                (then (return (i32.const 0)))))
            (else (if (i64.ge_s (local.get $mant) (i64.const 0)) (then (return (i32.const 0))))))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br_if $operands (i32.lt_u (local.get $n) (i32.const 2))))
    (if (i32.xor (call $get_pf) (local.get $invert))
      (then (call $phys80_copy_logical (i32.const 0) (local.get $src))))
    (i32.const 1))
  (func $phys80_copy_logical (param $dst i32) (param $src i32)
    (local.set $dst (i32.and (i32.add (global.get $fpu_top) (local.get $dst)) (i32.const 7)))
    (call $phys80_copy (local.get $dst)
      (i32.and (i32.add (global.get $fpu_top) (local.get $src)) (i32.const 7)))
    (global.set $fpu_tag (i32.or (global.get $fpu_tag) (i32.shl (i32.const 1) (local.get $dst)))))
  (func $phys80_push_copy (param $i i32)
    (local $src i32) (local $mant i64) (local $se i32) (local $raw i64) (local $valid i32)
    (local.set $src (i32.and (i32.add (global.get $fpu_top) (local.get $i)) (i32.const 7)))
    (call $phys80_materialize (local.get $src))
    (local.set $mant (i64.load (call $phys80_mant_addr (local.get $src))))
    (local.set $se (i32.load16_u (call $phys80_se_addr (local.get $src))))
    (local.set $raw (call $fpu_raw_get_phys (local.get $src)))
    (local.set $valid (i32.and (i32.shr_u (global.get $fpu_raw_tag) (local.get $src)) (i32.const 1)))
    (call $fpu_push (call $fpu_get_phys (local.get $src)))
    (call $phys80_write (global.get $fpu_top) (local.get $mant) (local.get $se))
    (if (local.get $valid) (then (call $fpu_raw_set (i32.const 0) (local.get $raw)))))
  (func $phys80_exchange (param $i i32)
    (local $src i32) (local $p i32) (local $mant i64) (local $se i32) (local $raw i64) (local $valid i32)
    (local.set $p (global.get $fpu_top))
    (local.set $src (i32.and (i32.add (local.get $p) (local.get $i)) (i32.const 7)))
    (call $phys80_materialize (local.get $p))
    (local.set $mant (i64.load (call $phys80_mant_addr (local.get $p))))
    (local.set $se (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (local.set $raw (call $fpu_raw_get_phys (local.get $p)))
    (local.set $valid (i32.and (i32.shr_u (global.get $fpu_raw_tag) (local.get $p)) (i32.const 1)))
    (call $phys80_copy (local.get $p) (local.get $src))
    (call $phys80_write (local.get $src) (local.get $mant) (local.get $se))
    (i64.store offset=64 (i32.add (global.get $fpu_base) (i32.shl (local.get $src) (i32.const 3))) (local.get $raw))
    (global.set $fpu_raw_tag (i32.or (global.get $fpu_raw_tag) (i32.shl (local.get $valid) (local.get $src)))))
  (func $phys80_sign (param $abs i32)
    (local $p i32) (local $se i32) (local $raw i64) (local $valid i32)
    (local.set $p (global.get $fpu_top))
    (local.set $valid (call $fpu_raw_valid (i32.const 0)))
    (local.set $raw (call $fpu_raw_get (i32.const 0)))
    (call $phys80_materialize (local.get $p))
    (local.set $se (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (call $phys80_write (local.get $p) (i64.load (call $phys80_mant_addr (local.get $p)))
      (select (i32.and (local.get $se) (i32.const 32767))
        (i32.xor (local.get $se) (i32.const 32768)) (local.get $abs)))
    (if (i32.or (i32.eqz (local.get $abs)) (i64.lt_s (local.get $raw) (i64.const 0)))
      (then
        (if (i64.eq (local.get $raw) (i64.const 0x8000000000000000))
          (then (local.set $valid (i32.const 0))))
        (local.set $raw (i64.sub (i64.const 0) (local.get $raw)))))
    (i64.store offset=64 (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3))) (local.get $raw))
    (global.set $fpu_raw_tag (i32.or (global.get $fpu_raw_tag) (i32.shl (local.get $valid) (local.get $p)))))

  ;; Reconstruct only an exactly integral, in-range signed64 image after m80
  ;; load/restore. This is not a general 80-bit arithmetic/conversion engine.
  (func $phys80_integer_shadow (param $p i32) (param $mant i64) (param $se i32)
    (local $exp i32) (local $shift i64) (local $mag i64)
    (local.set $exp (i32.sub (i32.and (local.get $se) (i32.const 32767)) (i32.const 16383)))
    (if (i64.eqz (local.get $mant))
      (then
        (if (i32.ne (i32.and (local.get $se) (i32.const 32767)) (i32.const 0)) (then (return))))
      (else
        (if (i32.gt_u (local.get $exp) (i32.const 63)) (then (return)))
        (local.set $shift (i64.extend_i32_u (i32.sub (i32.const 63) (local.get $exp))))
        (local.set $mag (i64.shr_u (local.get $mant) (local.get $shift)))
        (if (i64.ne (i64.shl (local.get $mag) (local.get $shift)) (local.get $mant)) (then (return)))
        (if (i32.and (local.get $se) (i32.const 32768))
          (then
            (if (i64.gt_u (local.get $mag) (i64.const 0x8000000000000000)) (then (return)))
            (local.set $mag (i64.sub (i64.const 0) (local.get $mag))))
          (else (if (i64.lt_s (local.get $mag) (i64.const 0)) (then (return)))))))
    (i64.store offset=64 (i32.add (global.get $fpu_base) (i32.shl (local.get $p) (i32.const 3))) (local.get $mag))
    (global.set $fpu_raw_tag (i32.or (global.get $fpu_raw_tag) (i32.shl (i32.const 1) (local.get $p)))))

  ;; FIST must round the retained source image, before any f64 approximation.
  ;; This conversion does not provide extended-precision arithmetic or #MF delivery.
  ;; Static _ftol uses the same conversion with an EDX:EAX destination.
  ;; Its documented scratch-store omission remains; FIST uses guest stores.
  (func $phys80_fist (param $addr i32) (param $width i32) (param $pop i32) (param $to_regs i32)
    (local $mant i64) (local $mag i64) (local $lost i64) (local $half i64)
    (local $limit i64) (local $shift i64) (local $se i32) (local $exp i32)
    (local $neg i32) (local $rc i32) (local $up i32)
    (local $value i64) (local $status i32)
    (local.set $limit (i64.shl (i64.const 1)
      (i64.extend_i32_u (i32.sub (local.get $width) (i32.const 1)))))
    (call $phys80_materialize (global.get $fpu_top))
    (local.set $mant (i64.load (call $phys80_mant_addr (global.get $fpu_top))))
    (local.set $se (i32.load16_u (call $phys80_se_addr (global.get $fpu_top))))
    (local.set $neg (i32.ne (i32.and (local.get $se) (i32.const 32768)) (i32.const 0)))
    (local.set $exp (i32.and (local.get $se) (i32.const 32767)))
    (block $converted
    (block $invalid
      ;; NaN, infinity and unsupported unnormal encodings are invalid.
      (br_if $invalid (i32.eq (local.get $exp) (i32.const 32767)))
      (br_if $invalid (i32.and (i32.ne (local.get $exp) (i32.const 0))
        (i64.ge_s (local.get $mant) (i64.const 0))))
      (local.set $exp (i32.sub (local.get $exp) (i32.const 16383)))
      (br_if $invalid (i32.gt_s (local.get $exp) (i32.const 63)))
      (if (i32.eq (local.get $exp) (i32.const 63))
        (then (local.set $mag (local.get $mant)))
        (else
          (if (i32.ge_s (local.get $exp) (i32.const 0))
            (then
              (local.set $shift (i64.extend_i32_u (i32.sub (i32.const 63) (local.get $exp))))
              (local.set $mag (i64.shr_u (local.get $mant) (local.get $shift)))
              (local.set $lost (i64.and (local.get $mant)
                (i64.sub (i64.shl (i64.const 1) (local.get $shift)) (i64.const 1))))
              (local.set $half (i64.shl (i64.const 1) (i64.sub (local.get $shift) (i64.const 1)))))
            (else
              ;; Avoid Wasm's modulo-64 shift at |x| < 1.
              (local.set $lost (local.get $mant))
              (local.set $half (i64.const 0x8000000000000000))))
          (local.set $rc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 10)) (i32.const 3)))
          (if (i32.eqz (local.get $rc))
            (then
              (local.set $up (i32.and (i32.ge_s (local.get $exp) (i32.const -1))
                (i32.or (i64.gt_u (local.get $lost) (local.get $half))
                  (i32.and (i64.eq (local.get $lost) (local.get $half))
                    (i64.ne (i64.and (local.get $mag) (i64.const 1)) (i64.const 0)))))))
            (else
              (local.set $up (i32.and (i64.ne (local.get $lost) (i64.const 0))
                (i32.or
                  (i32.and (i32.eq (local.get $rc) (i32.const 1)) (local.get $neg))
                  (i32.and (i32.eq (local.get $rc) (i32.const 2)) (i32.eqz (local.get $neg))))))))
          (if (local.get $up) (then (local.set $mag (i64.add (local.get $mag) (i64.const 1)))))))
      (br_if $invalid (i64.gt_u (local.get $mag) (local.get $limit)))
      (br_if $invalid (i32.and (i64.eq (local.get $mag) (local.get $limit)) (i32.eqz (local.get $neg))))
      (local.set $value (select (i64.sub (i64.const 0) (local.get $mag)) (local.get $mag) (local.get $neg)))
      ;; Intel SDM Vol.1 8.5.6: truncating discarded bits is not round-up.
      ;; C1 records increment of magnitude, including for negative operands.
      ;; Range-invalid conversions take the IE path without a new PE or C1.
      (if (i64.ne (local.get $lost) (i64.const 0))
        (then (local.set $status (i32.or (i32.const 32)
          (i32.shl (local.get $up) (i32.const 9))))))
      (br $converted))
    (local.set $value (i64.sub (i64.const 0) (local.get $limit)))
    (local.set $status (i32.const 1)))
    (if (local.get $to_regs)
      (then
        (i32.store (global.get $reg_base) (i32.wrap_i64 (local.get $value)))
        (i32.store offset=8 (global.get $reg_base) (i32.wrap_i64 (i64.shr_u (local.get $value) (i64.const 32)))))
      (else
    (if (i32.eq (local.get $width) (i32.const 16))
      (then (call $gs16 (local.get $addr) (i32.wrap_i64 (local.get $value))))
      (else (if (i32.eq (local.get $width) (i32.const 32))
        (then (call $gs32 (local.get $addr) (i32.wrap_i64 (local.get $value))))
        (else (call $gs64 (local.get $addr) (local.get $value))))))))
    ;; Publish status and pop only after a successful store. A trapping store
    ;; never reaches here; a redirected fault preserves the prior status too.
    (if (global.get $eip_redirected) (then (return)))
    (global.set $fpu_sw (i32.or
      (i32.and (global.get $fpu_sw) (i32.const 0xFDFF))
      (i32.and (local.get $status) (i32.const 0x0200))))
    (if (i32.ne (i32.and (local.get $status) (i32.const 0x3F)) (i32.const 0))
      (then (call $fpu_set_exc (i32.and (local.get $status) (i32.const 0x3F)))))
    (if (local.get $pop) (then (drop (call $fpu_pop)))))

  ;; Exact positive canonical subnormal squares; every rejection keeps old FSQRT.
  (func $phys80_sqrt_subnormal_exact (result i32)
    (local $p i32) (local $s i32) (local $k i32) (local $pc i32)
    (local $m i64) (local $n i64) (local $r i64) (local $b i64) (local $t i64)
    (if (i32.ne (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $fpu_is_valid (i32.const 0))) (then (return (i32.const 0))))
    (local.set $p (global.get $fpu_top))
    (if (i32.eqz (i32.and (i32.load offset=16 (global.get $fpu_image_base))
          (i32.shl (i32.const 1) (local.get $p)))) (then (return (i32.const 0))))
    (local.set $s (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (local.set $m (i64.load (call $phys80_mant_addr (local.get $p))))
    (if (i32.or (i32.ne (local.get $s) (i32.const 0))
          (i64.le_s (local.get $m) (i64.const 0))) (then (return (i32.const 0))))
    (local.set $pc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 8)) (i32.const 3)))
    (if (i32.eq (local.get $pc) (i32.const 1)) (then (return (i32.const 0))))
    ;; x = odd(M) * 2^k. A rational binary root needs k even and odd(M)
    ;; a perfect integer square. Its root then has at most32 significant bits.
    (local.set $t (i64.ctz (local.get $m)))
    (local.set $k (i32.sub (i32.wrap_i64 (local.get $t)) (i32.const 16445)))
    (if (i32.and (local.get $k) (i32.const 1)) (then (return (i32.const 0))))
    (local.set $n (i64.shr_u (local.get $m) (local.get $t)))
    (local.set $b (i64.const 0x4000000000000000))
    ;; Unsigned restoring integer square root,32 bounded base4 digits.
    (loop $digit
      (local.set $t (i64.add (local.get $r) (local.get $b)))
      (if (i64.ge_u (local.get $n) (local.get $t))
        (then (local.set $n (i64.sub (local.get $n) (local.get $t)))
          (local.set $r (i64.add (i64.shr_u (local.get $r) (i64.const 1)) (local.get $b))))
        (else (local.set $r (i64.shr_u (local.get $r) (i64.const 1)))))
      (local.set $b (i64.shr_u (local.get $b) (i64.const 2)))
      (br_if $digit (i64.ne (local.get $b) (i64.const 0))))
    (if (i64.ne (local.get $n) (i64.const 0)) (then (return (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $pc)) (i64.ge_u (local.get $r) (i64.const 0x1000000)))
      (then (return (i32.const 0))))
    (local.set $t (i64.clz (local.get $r)))
    (call $phys80_write (local.get $p) (i64.shl (local.get $r) (local.get $t))
      (i32.sub (i32.add (i32.shr_s (local.get $k) (i32.const 1)) (i32.const 16446)) (i32.wrap_i64 (local.get $t))))
    (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)) (i32.const 2)))
    (i32.const 1))

  ;; Bounded rounded positive normals: input binades 0,1,2,48 only.
  ;; Exact roots fitting PC remain exclusively in the existing guards.
  (func $phys80_sqrt_rounded_bounded (result i32)
    (local $p i32) (local $s i32) (local $pc i32) (local $rc i32)
    (local $e i32) (local $i i32) (local $up i32) (local $nz i32)
    (local $m i64) (local $nh i64) (local $nl i64) (local $rh i64) (local $rl i64)
    (local $r i64) (local $th i64) (local $tl i64) (local $d i64) (local $lost i64) (local $half i64)
    (if (i32.ne (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63)) (then (return (i32.const 0))))
    (if (i32.eqz (call $fpu_is_valid (i32.const 0))) (then (return (i32.const 0))))
    (local.set $p (global.get $fpu_top))
    (if (i32.eqz (i32.and (i32.load offset=16 (global.get $fpu_image_base))
          (i32.shl (i32.const 1) (local.get $p)))) (then (return (i32.const 0))))
    (local.set $s (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (if (i32.eqz (i32.or (i32.or (i32.eq (local.get $s) (i32.const 1)) (i32.or (i32.eq (local.get $s) (i32.const 2)) (i32.or (i32.eq (local.get $s) (i32.const 15358)) (i32.or (i32.eq (local.get $s) (i32.const 15359)) (i32.or (i32.eq (local.get $s) (i32.const 16380)) (i32.or (i32.eq (local.get $s) (i32.const 16381)) (i32.or (i32.eq (local.get $s) (i32.const 16382)) (i32.or (i32.eq (local.get $s) (i32.const 16432)) (i32.or (i32.eq (local.get $s) (i32.const 17407)) (i32.or (i32.eq (local.get $s) (i32.const 17408)) (i32.or (i32.eq (local.get $s) (i32.const 32765)) (i32.eq (local.get $s) (i32.const 32766))))))))))))) (i32.or (i32.or (i32.eq (local.get $s) (i32.const 16383)) (i32.eq (local.get $s) (i32.const 16384)))
          (i32.or (i32.eq (local.get $s) (i32.const 16385)) (i32.eq (local.get $s) (i32.const 16431)))))) (then (return (i32.const 0))))
    (local.set $m (i64.load (call $phys80_mant_addr (local.get $p))))
    (if (i64.ge_s (local.get $m) (i64.const 0)) (then (return (i32.const 0))))
    (local.set $pc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 8)) (i32.const 3)))
    (if (i32.eq (local.get $pc) (i32.const 1)) (then (return (i32.const 0))))
    (local.set $e (i32.sub (local.get $s) (i32.const 16383)))
    ;; N=M*2^(63+(e&1)); sqrt(N) is the full64-bit normalized root.
    (if (i32.and (local.get $e) (i32.const 1))
      (then (local.set $nh (local.get $m)))
      (else (local.set $nh (i64.shr_u (local.get $m) (i64.const 1)))
        (local.set $nl (i64.shl (local.get $m) (i64.const 63)))))
    ;; Exactly64 base4 longhand digits. Two limbs retain the entire remainder.
    (loop $digit
      (local.set $rh (i64.or (i64.shl (local.get $rh) (i64.const 2)) (i64.shr_u (local.get $rl) (i64.const 62))))
      (local.set $rl (i64.or (i64.shl (local.get $rl) (i64.const 2)) (i64.shr_u (local.get $nh) (i64.const 62))))
      (local.set $nh (i64.or (i64.shl (local.get $nh) (i64.const 2)) (i64.shr_u (local.get $nl) (i64.const 62))))
      (local.set $nl (i64.shl (local.get $nl) (i64.const 2)))
      (local.set $th (i64.shr_u (local.get $r) (i64.const 62)))
      (local.set $tl (i64.or (i64.shl (local.get $r) (i64.const 2)) (i64.const 1)))
      (if (i32.or (i64.gt_u (local.get $rh) (local.get $th))
            (i32.and (i64.eq (local.get $rh) (local.get $th)) (i64.ge_u (local.get $rl) (local.get $tl))))
        (then (local.set $rh (i64.sub (i64.sub (local.get $rh) (local.get $th))
                  (i64.extend_i32_u (i64.lt_u (local.get $rl) (local.get $tl)))))
          (local.set $rl (i64.sub (local.get $rl) (local.get $tl)))
          (local.set $r (i64.or (i64.shl (local.get $r) (i64.const 1)) (i64.const 1))))
        (else (local.set $r (i64.shl (local.get $r) (i64.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $digit (i32.lt_u (local.get $i) (i32.const 64))))
    (local.set $d (if (result i64) (i32.eqz (local.get $pc)) (then (i64.const 40))
      (else (if (result i64) (i32.eq (local.get $pc) (i32.const 2)) (then (i64.const 11)) (else (i64.const 0))))))
    (local.set $lost (i64.and (local.get $r) (i64.sub (i64.shl (i64.const 1) (local.get $d)) (i64.const 1))))
    (local.set $nz (i64.ne (i64.or (local.get $rh) (local.get $rl)) (i64.const 0)))
    (if (i32.eqz (i32.or (local.get $nz) (i64.ne (local.get $lost) (i64.const 0)))) (then (return (i32.const 0))))
    (local.set $rc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 10)) (i32.const 3)))
    (local.set $up (i32.eq (local.get $rc) (i32.const 2)))
    (if (i32.eqz (local.get $rc))
      (then
        (if (i64.eqz (local.get $d))
          ;; N-r^2 > r+1/4 iff integer remainder > r. No64-bit tie.
          (then (local.set $up (i32.or (i64.ne (local.get $rh) (i64.const 0)) (i64.gt_u (local.get $rl) (local.get $r)))))
          (else (local.set $half (i64.shl (i64.const 1) (i64.sub (local.get $d) (i64.const 1))))
            (local.set $up (i32.or (i64.gt_u (local.get $lost) (local.get $half))
              (i32.and (i64.eq (local.get $lost) (local.get $half))
                (i32.or (local.get $nz) (i64.ne (i64.and (i64.shr_u (local.get $r) (local.get $d)) (i64.const 1)) (i64.const 0))))))))))
    (local.set $r (i64.sub (local.get $r) (local.get $lost)))
    (if (local.get $up) (then (local.set $r (i64.add (local.get $r) (i64.shl (i64.const 1) (local.get $d))))))
    (local.set $s (i32.add (i32.shr_u (local.get $e) (i32.const 1)) (i32.const 16383)))
    (if (i64.eqz (local.get $r)) (then (local.set $r (i64.const 0x8000000000000000)) (local.set $s (i32.add (local.get $s) (i32.const 1)))))
    (call $phys80_write (local.get $p) (local.get $r) (local.get $s))
    (global.set $fpu_sw (i32.or (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)) (i32.const 32))
      (i32.shl (local.get $up) (i32.const 9))))
    (i32.const 1))

  ;; Exact positive normal squares only; every rejection keeps old FSQRT.
  (func $phys80_sqrt_exact (result i32)
    (local $p i32) (local $s i32) (local $k i32) (local $pc i32)
    (local $m i64) (local $n i64) (local $r i64) (local $b i64) (local $t i64)
    (if (i32.ne (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $fpu_is_valid (i32.const 0))) (then (return (i32.const 0))))
    (local.set $p (global.get $fpu_top))
    (if (i32.eqz (i32.and (i32.load offset=16 (global.get $fpu_image_base))
          (i32.shl (i32.const 1) (local.get $p)))) (then (return (i32.const 0))))
    (local.set $s (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (local.set $m (i64.load (call $phys80_mant_addr (local.get $p))))
    (if (i32.or (i32.or (i32.eqz (local.get $s)) (i32.ge_u (local.get $s) (i32.const 32767)))
          (i64.ge_s (local.get $m) (i64.const 0))) (then (return (i32.const 0))))
    (local.set $pc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 8)) (i32.const 3)))
    (if (i32.eq (local.get $pc) (i32.const 1)) (then (return (i32.const 0))))
    ;; x = odd(M) * 2^k. A rational binary root needs k even and odd(M)
    ;; a perfect integer square. Its root then has at most32 significant bits.
    (local.set $t (i64.ctz (local.get $m)))
    (local.set $k (i32.add (i32.sub (local.get $s) (i32.const 16446)) (i32.wrap_i64 (local.get $t))))
    (if (i32.and (local.get $k) (i32.const 1)) (then (return (i32.const 0))))
    (local.set $n (i64.shr_u (local.get $m) (local.get $t)))
    (local.set $b (i64.const 0x4000000000000000))
    ;; Unsigned restoring integer square root,32 bounded base4 digits.
    (loop $digit
      (local.set $t (i64.add (local.get $r) (local.get $b)))
      (if (i64.ge_u (local.get $n) (local.get $t))
        (then (local.set $n (i64.sub (local.get $n) (local.get $t)))
          (local.set $r (i64.add (i64.shr_u (local.get $r) (i64.const 1)) (local.get $b))))
        (else (local.set $r (i64.shr_u (local.get $r) (i64.const 1)))))
      (local.set $b (i64.shr_u (local.get $b) (i64.const 2)))
      (br_if $digit (i64.ne (local.get $b) (i64.const 0))))
    (if (i64.ne (local.get $n) (i64.const 0)) (then (return (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $pc)) (i64.ge_u (local.get $r) (i64.const 0x1000000)))
      (then (return (i32.const 0))))
    (local.set $t (i64.clz (local.get $r)))
    (call $phys80_write (local.get $p) (i64.shl (local.get $r) (local.get $t))
      (i32.sub (i32.add (i32.shr_s (local.get $k) (i32.const 1)) (i32.const 16446)) (i32.wrap_i64 (local.get $t))))
    (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
    (i32.const 1))

  ;; FRNDINT's floating result has no signed-integer destination range limit.
  ;; Handle canonical zero and normalized finite images; other encodings keep
  ;; the existing path. This is integral rounding, not general80 arithmetic.
  (func $phys80_frndint (result i32)
    (local $mant i64) (local $mag i64) (local $lost i64) (local $half i64)
    (local $shift i64) (local $se i32) (local $exp i32)
    (local $neg i32) (local $rc i32) (local $up i32)
    (call $phys80_materialize (global.get $fpu_top))
    (local.set $mant (i64.load (call $phys80_mant_addr (global.get $fpu_top))))
    (local.set $se (i32.load16_u (call $phys80_se_addr (global.get $fpu_top))))
    (local.set $exp (i32.and (local.get $se) (i32.const 32767)))
    (if (i32.eqz (local.get $exp))
      (then (if (i64.ne (local.get $mant) (i64.const 0)) (then (return (i32.const 0)))))
      (else
        (if (i32.or (i32.eq (local.get $exp) (i32.const 32767))
              (i64.ge_s (local.get $mant) (i64.const 0)))
          (then (return (i32.const 0))))))
    ;; C1 is per-operation; all exception flags, including PE, are sticky.
    (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
    (local.set $exp (i32.sub (local.get $exp) (i32.const 16383)))
    (if (i32.or (i64.eqz (local.get $mant)) (i32.ge_s (local.get $exp) (i32.const 63)))
      (then (return (i32.const 1))))
    (local.set $neg (i32.ne (i32.and (local.get $se) (i32.const 32768)) (i32.const 0)))
    (if (i32.ge_s (local.get $exp) (i32.const 0))
      (then
        (local.set $shift (i64.extend_i32_u (i32.sub (i32.const 63) (local.get $exp))))
        (local.set $mag (i64.shr_u (local.get $mant) (local.get $shift)))
        (local.set $lost (i64.and (local.get $mant)
          (i64.sub (i64.shl (i64.const 1) (local.get $shift)) (i64.const 1))))
        (local.set $half (i64.shl (i64.const 1) (i64.sub (local.get $shift) (i64.const 1)))))
      (else
        ;; Avoid Wasm modulo-64 shifts when |x| < 1.
        (local.set $lost (local.get $mant))
        (local.set $half (i64.const 0x8000000000000000))))
    (if (i64.eqz (local.get $lost)) (then (return (i32.const 1))))
    (local.set $rc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 10)) (i32.const 3)))
    (if (i32.eqz (local.get $rc))
      (then
        (local.set $up (i32.and (i32.ge_s (local.get $exp) (i32.const -1))
          (i32.or (i64.gt_u (local.get $lost) (local.get $half))
            (i32.and (i64.eq (local.get $lost) (local.get $half))
              (i64.ne (i64.and (local.get $mag) (i64.const 1)) (i64.const 0)))))))
      (else
        (local.set $up (i32.or
          (i32.and (i32.eq (local.get $rc) (i32.const 1)) (local.get $neg))
          (i32.and (i32.eq (local.get $rc) (i32.const 2)) (i32.eqz (local.get $neg)))))))
    (local.set $mag (i64.add (local.get $mag) (i64.extend_i32_u (local.get $up))))
    (local.set $mant (i64.const 0))
    (local.set $se (i32.and (local.get $se) (i32.const 32768)))
    (if (i64.ne (local.get $mag) (i64.const 0))
      (then
        (local.set $shift (i64.clz (local.get $mag)))
        (local.set $mant (i64.shl (local.get $mag) (local.get $shift)))
        (local.set $se (i32.or (local.get $se)
          (i32.sub (i32.const 16446) (i32.wrap_i64 (local.get $shift)))))))
    (call $phys80_write (global.get $fpu_top) (local.get $mant) (local.get $se))
    (call $fpu_set_exc (i32.const 32))
    (global.set $fpu_sw (i32.or (global.get $fpu_sw) (i32.shl (local.get $up) (i32.const 9))))
    (i32.const 1))

  ;; Canonical finite ST(0) versus ST(i), or exact finite f64 memory operand.
  ;; Return -1/0/+1; 2 declines to the unchanged unsupported/NaN fallback.
  (func $phys80_compare (param $i i32) (param $b f64) (param $kind i32) (result i32)
    (local $p i32) (local $q i32) (local $s0 i32) (local $s1 i32)
    (local $e0 i32) (local $e1 i32) (local $less i32) (local $den i32)
    (local $m0 i64) (local $m1 i64) (local $bits i64) (local $shift i64)
    (local.set $p (global.get $fpu_top))
    (if (i32.eqz (i32.and (i32.shr_u (global.get $fpu_tag) (local.get $p)) (i32.const 1))) (then (return (i32.const 2))))
    (call $phys80_materialize (local.get $p))
    (local.set $m0 (i64.load (call $phys80_mant_addr (local.get $p))))
    (local.set $s0 (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (if (i32.ge_s (local.get $i) (i32.const 0))
      (then
        (local.set $q (i32.and (i32.add (local.get $p) (local.get $i)) (i32.const 7)))
        (if (i32.eqz (i32.and (i32.shr_u (global.get $fpu_tag) (local.get $q)) (i32.const 1))) (then (return (i32.const 2))))
        (call $phys80_materialize (local.get $q))
        (local.set $m1 (i64.load (call $phys80_mant_addr (local.get $q))))
        (local.set $s1 (i32.load16_u (call $phys80_se_addr (local.get $q)))))
      (else
        (local.set $bits (i64.reinterpret_f64 (local.get $b)))
        (local.set $s1 (i32.and (i32.wrap_i64 (i64.shr_u (local.get $bits) (i64.const 48))) (i32.const 32768)))
        (local.set $e1 (i32.and (i32.wrap_i64 (i64.shr_u (local.get $bits) (i64.const 52))) (i32.const 2047)))
        (if (i32.eq (local.get $e1) (i32.const 2047)) (then (return (i32.const 2))))
        (local.set $m1 (i64.and (local.get $bits) (i64.const 0xfffffffffffff)))
        (if (i32.eqz (local.get $e1))
          (then (if (i64.ne (local.get $m1) (i64.const 0))
            (then
              (local.set $shift (i64.clz (local.get $m1)))
              (local.set $m1 (i64.shl (local.get $m1) (local.get $shift)))
              (local.set $s1 (i32.or (local.get $s1) (i32.sub (i32.const 15372) (i32.wrap_i64 (local.get $shift))))))))
          (else
            (local.set $m1 (i64.or (i64.const 0x8000000000000000) (i64.shl (local.get $m1) (i64.const 11))))
            (local.set $s1 (i32.or (local.get $s1) (i32.add (local.get $e1) (i32.const 15360))))))))
    (local.set $e0 (i32.and (local.get $s0) (i32.const 32767)))
    (local.set $e1 (i32.and (local.get $s1) (i32.const 32767)))
    ;; New subnormal admission is limited to masked register status compares.
    (local.set $den (i32.or
      (i32.and (i32.eqz (local.get $e0)) (i64.ne (local.get $m0) (i64.const 0)))
      (i32.and (i32.eqz (local.get $e1)) (i64.ne (local.get $m1) (i64.const 0)))))
    (if (local.get $den)
      (then (if (i32.or
        (i32.or (i32.lt_s (local.get $i) (i32.const 0)) (i32.ge_u (local.get $kind) (i32.const 2)))
        (i32.ne (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63)))
        (then (return (i32.const 2))))))
    ;; Canonical signed zero/subnormal has E=0,J=0; normal finite has E>0,J=1.
    (if (i32.eqz (i32.or
      (i32.and (i32.eqz (local.get $e0)) (i64.ge_s (local.get $m0) (i64.const 0)))
      (i32.and (i32.and (i32.gt_u (local.get $e0) (i32.const 0)) (i32.lt_u (local.get $e0) (i32.const 32767)))
        (i64.lt_s (local.get $m0) (i64.const 0))))) (then (return (i32.const 2))))
    (if (i32.eqz (i32.or
      (i32.and (i32.eqz (local.get $e1)) (i64.ge_s (local.get $m1) (i64.const 0)))
      (i32.and (i32.and (i32.gt_u (local.get $e1) (i32.const 0)) (i32.lt_u (local.get $e1) (i32.const 32767)))
        (i64.lt_s (local.get $m1) (i64.const 0))))) (then (return (i32.const 2))))
    ;; Every admission guard precedes new sticky-status mutation.
    (if (local.get $den) (then (call $fpu_set_exc (i32.const 2))))
    (if (i32.and (i64.eqz (local.get $m0)) (i64.eqz (local.get $m1))) (then (return (i32.const 0))))
    (if (i32.ne (i32.and (local.get $s0) (i32.const 32768)) (i32.and (local.get $s1) (i32.const 32768)))
      (then (return (select (i32.const -1) (i32.const 1) (i32.and (local.get $s0) (i32.const 32768))))))
    (if (i32.and (i32.eq (local.get $e0) (local.get $e1)) (i64.eq (local.get $m0) (local.get $m1)))
      (then (return (i32.const 0))))
    (local.set $less (i32.or (i32.lt_u (local.get $e0) (local.get $e1))
      (i32.and (i32.eq (local.get $e0) (local.get $e1)) (i64.lt_u (local.get $m0) (local.get $m1)))))
    (select (i32.const -1) (i32.const 1)
      (i32.xor (local.get $less) (i32.ne (i32.and (local.get $s0) (i32.const 32768)) (i32.const 0)))))

  (func $fpu_image_compare (param $a f64) (param $b f64) (param $i i32) (param $kind i32)
    (local $relation i32)
    (local.set $relation (call $phys80_compare (local.get $i) (local.get $b) (local.get $kind)))
    (if (i32.ne (local.get $relation) (i32.const 2))
      (then
        (local.set $a (f64.convert_i32_s (local.get $relation)))
        (local.set $b (f64.const 0))
        ;; Intel FCOMI/FUCOMI: C1=0; C0/C2/C3 are unchanged.
        (if (i32.ge_u (local.get $kind) (i32.const 2))
          (then (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))))))
    (if (i32.eq (local.get $kind) (i32.const 0))
      (then (call $fpu_compare (local.get $a) (local.get $b)) (return)))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then (call $fpu_compare_unord (local.get $a) (local.get $b)) (return)))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (call $fpu_compare_eflags (local.get $a) (local.get $b)) (return)))
    (call $fpu_compare_eflags_unord (local.get $a) (local.get $b)))

  ;; Exact exponent-only FSCALE for canonical zero/normal operands and a
  ;; bounded finite scale. Also accept masked subnormal/zero results; decline rounding to normal.
  (func $phys80_scale (result i32)
    (local $p i32) (local $q i32) (local $m i64) (local $n i64)
    (local $r i64) (local $half i64) (local $inc i32) (local $raised i32) (local $rc i32)
    (local $mask i32) (local $s i32) (local $t i32) (local $e i32) (local $f i32) (local $k i32)
    (local.set $p (global.get $fpu_top))
    (local.set $q (i32.and (i32.add (local.get $p) (i32.const 1)) (i32.const 7)))
    (local.set $mask (i32.or (i32.shl (i32.const 1) (local.get $p))
      (i32.shl (i32.const 1) (local.get $q))))
    (if (i32.or
          (i32.ne (i32.and (global.get $fpu_tag) (local.get $mask)) (local.get $mask))
          (i32.ne (i32.and (i32.load offset=16 (global.get $fpu_image_base)) (local.get $mask)) (local.get $mask)))
      (then (return (i32.const 0))))
    (local.set $m (i64.load (call $phys80_mant_addr (local.get $p))))
    (local.set $n (i64.load (call $phys80_mant_addr (local.get $q))))
    (local.set $s (i32.load16_u (call $phys80_se_addr (local.get $p))))
    (local.set $t (i32.load16_u (call $phys80_se_addr (local.get $q))))
    (local.set $e (i32.and (local.get $s) (i32.const 32767)))
    (local.set $f (i32.and (local.get $t) (i32.const 32767)))
    ;; Canonical infinity/QNaN scaled by canonical finite normal or zero.
    ;; Exact result is the unchanged source image, including sign/payload.
    (if (i32.and (i32.eq (local.get $e) (i32.const 32767))
          (i32.and (i64.lt_s (local.get $m) (i64.const 0))
            (i32.and (i32.eq (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63))
              (i32.and (i32.or (i64.eq (local.get $m) (i64.const 0x8000000000000000))
                          (i64.ne (i64.and (local.get $m) (i64.const 0x4000000000000000)) (i64.const 0)))
                (i32.or (i32.and (i32.eqz (local.get $f)) (i64.eqz (local.get $n)))
                  (i32.and (i32.lt_u (i32.sub (local.get $f) (i32.const 1)) (i32.const 32766))
                    (i64.lt_s (local.get $n) (i64.const 0))))))))
      (then
        (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))
        (return (i32.const 1))))
    (if (i32.eqz (local.get $e))
      (then (if (i64.ne (local.get $m) (i64.const 0)) (then (return (i32.const 0)))))
      (else (if (i32.or (i32.eq (local.get $e) (i32.const 32767))
                   (i64.ge_s (local.get $m) (i64.const 0)))
        (then (return (i32.const 0))))))
    (if (i32.eqz (local.get $f))
      (then (if (i64.ne (local.get $n) (i64.const 0)) (then (return (i32.const 0)))))
      (else (if (i32.or (i32.ge_u (local.get $f) (i32.const 16398))
                   (i64.ge_s (local.get $n) (i64.const 0)))
        (then (return (i32.const 0))))))
    ;; Only 0 <= unbiased exponent <= 14 reaches this shift (49..63).
    (if (i32.ge_u (local.get $f) (i32.const 16383))
      (then
        (local.set $k (i32.wrap_i64 (i64.shr_u (local.get $n)
          (i64.extend_i32_u (i32.sub (i32.const 16446) (local.get $f))))))
        (if (i32.and (local.get $t) (i32.const 32768))
          (then (local.set $k (i32.sub (i32.const 0) (local.get $k)))))))
    (if (i64.ne (local.get $m) (i64.const 0))
      (then
        (local.set $e (i32.add (local.get $e) (local.get $k)))
        (if (i32.le_s (local.get $e) (i32.const 0))
          (then
            ;; Guard every decline before physical/status mutation.
            (if (i32.ne (i32.and (global.get $fpu_cw) (i32.const 63)) (i32.const 63))
              (then (return (i32.const 0))))
            (local.set $k (i32.sub (i32.const 1) (local.get $e)))
            (if (i32.lt_u (local.get $k) (i32.const 64))
              (then
                (local.set $n (i64.shr_u (local.get $m) (i64.extend_i32_u (local.get $k))))
                (local.set $r (i64.and (local.get $m)
                  (i64.sub (i64.shl (i64.const 1) (i64.extend_i32_u (local.get $k))) (i64.const 1))))
                (local.set $half (i64.shl (i64.const 1)
                  (i64.extend_i32_u (i32.sub (local.get $k) (i32.const 1))))))
              (else
                ;; Never shift by >=64: Wasm masks shift counts modulo 64.
                (local.set $n (i64.const 0))
                (local.set $r (local.get $m))
                (if (i32.eq (local.get $k) (i32.const 64))
                  (then (local.set $half (i64.const 0x8000000000000000))))))
            (if (i64.ne (local.get $r) (i64.const 0))
              (then
                (local.set $raised (i32.const 48))
                (local.set $rc (i32.and (i32.shr_u (global.get $fpu_cw) (i32.const 10)) (i32.const 3)))
                (if (i32.eqz (local.get $rc))
                  (then
                    (if (i32.le_u (local.get $k) (i32.const 64))
                      (then (local.set $inc (i32.or
                        (i64.gt_u (local.get $r) (local.get $half))
                        (i32.and (i64.eq (local.get $r) (local.get $half))
                          (i32.wrap_i64 (i64.and (local.get $n) (i64.const 1)))))))))
                  (else
                    (local.set $inc (i32.or
                      (i32.and (i32.eq (local.get $rc) (i32.const 1))
                        (i32.ne (i32.and (local.get $s) (i32.const 32768)) (i32.const 0)))
                      (i32.and (i32.eq (local.get $rc) (i32.const 2))
                        (i32.eqz (i32.and (local.get $s) (i32.const 32768))))))))))
            (local.set $m (i64.add (local.get $n) (i64.extend_i32_u (local.get $inc))))
            ;; Tininess reporting when rounding to normal remains unqualified.
            (if (i64.ge_u (local.get $m) (i64.const 0x8000000000000000))
              (then (return (i32.const 0))))
            (local.set $e (i32.const 0))))
        (if (i32.ge_s (local.get $e) (i32.const 32767))
          (then (return (i32.const 0))))
        (local.set $s (i32.or (i32.and (local.get $s) (i32.const 32768)) (local.get $e)))))
    (call $phys80_write (local.get $p) (local.get $m) (local.get $s))
    (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xFDFF))
      (i32.or (local.get $raised) (i32.shl (local.get $inc) (i32.const 9)))))
    (i32.const 1))
