  ;; ============================================================
  ;; MMX
  ;; ============================================================
  ;; The eight MMX registers live in i64 globals, not v128 ones, because that
  ;; is what the code we actually run wants. Across the two binaries that drive
  ;; this (Liquid War's blitter and SMACKW32's Smacker decoder) 222 of 236 and
  ;; 147 of 167 MMX instructions are whole-register moves, boolean ops and
  ;; 64-bit shifts -- all of which are one exact i64 instruction and would
  ;; otherwise pay a splat/extract round trip on every operation.
  ;;
  ;; The genuinely packed ops go the other way: they widen to v128, use the
  ;; real wasm SIMD instruction, and take lane 0 back. Those mappings are
  ;; exact, not approximations -- pmaddwd IS i32x4.dot_i16x8_s, paddusb IS
  ;; i8x16.add_sat_u, punpcklbw IS an i8x16.shuffle. Splatting means the upper
  ;; half computes the same result as the lower half and is discarded; that is
  ;; cheaper than masking and cannot introduce lane-crossing errors.
  ;;
  ;; Architecturally MMX aliases the x87 mantissas and any MMX write should
  ;; mark the FPU tag word full. We keep the two files separate: no guest mixes
  ;; MMX and x87 without an EMMS between them (that is the whole point of
  ;; EMMS), and $th_emms already clears the tag word.

  ;; ---- Register file ----
  ;; MMn is the i64 at $mmx_base + n*8 in this thread's $MMX_FILE slice. The
  ;; &7 keeps a stray index inside the slice.
  (func $mmx_get (param $i i32) (result i64)
    (i64.load (i32.add (global.get $mmx_base)
      (i32.shl (i32.and (local.get $i) (i32.const 7)) (i32.const 3)))))

  (func $mmx_set (param $i i32) (param $v i64)
    (i64.store (i32.add (global.get $mmx_base)
      (i32.shl (i32.and (local.get $i) (i32.const 7)) (i32.const 3))) (local.get $v)))

  ;; ============================================================
  ;; SSE base used by SDL2
  ;; ============================================================
  ;; XMM state lives in this thread's slice of $XMM_FILE (01-header.wat):
  ;; XMMn is the v128 at $xmm_base + n*16. Guest memory goes through
  ;; $gl128/$gs128 (one translation and one v128 op for a same-page operand)
  ;; or $gl32/$gs32 for the narrower forms, so page-edge, sparse-allocation
  ;; and DIB-backed operands obey the same translation rules as scalar code.
  ;; Only eight registers exist in 32-bit mode; the &7 keeps a stray index
  ;; inside this thread's own 128-byte slice.
  (func $xmm_addr (param $i i32) (result i32)
    (i32.add (global.get $xmm_base)
      (i32.shl (i32.and (local.get $i) (i32.const 7)) (i32.const 4))))

  (func $xmm_get (param $i i32) (result v128)
    (v128.load (call $xmm_addr (local.get $i))))

  (func $xmm_set (param $i i32) (param $v v128)
    (v128.store (call $xmm_addr (local.get $i)) (local.get $v)))

  (func $xmm_lane_get (param $v v128) (param $lane i32) (result i32)
    (if (i32.eq (local.get $lane) (i32.const 0))
      (then (return (i32x4.extract_lane 0 (local.get $v)))))
    (if (i32.eq (local.get $lane) (i32.const 1))
      (then (return (i32x4.extract_lane 1 (local.get $v)))))
    (if (i32.eq (local.get $lane) (i32.const 2))
      (then (return (i32x4.extract_lane 2 (local.get $v)))))
    (i32x4.extract_lane 3 (local.get $v)))

  ;; SHUFPS has a runtime immediate, while WebAssembly's native shuffle lane
  ;; indices are compile-time immediates. Build the four selected dwords with
  ;; static replace-lane instructions so all 256 guest masks remain exact.
  (func $sse_shufps (param $d v128) (param $s v128) (param $imm i32) (result v128)
    (i32x4.replace_lane 3
      (i32x4.replace_lane 2
        (i32x4.replace_lane 1
          (i32x4.replace_lane 0 (i32x4.splat (i32.const 0))
            (call $xmm_lane_get (local.get $d)
              (i32.and (local.get $imm) (i32.const 3))))
          (call $xmm_lane_get (local.get $d)
            (i32.and (i32.shr_u (local.get $imm) (i32.const 2)) (i32.const 3))))
        (call $xmm_lane_get (local.get $s)
          (i32.and (i32.shr_u (local.get $imm) (i32.const 4)) (i32.const 3))))
      (call $xmm_lane_get (local.get $s)
        (i32.and (i32.shr_u (local.get $imm) (i32.const 6)) (i32.const 3)))))

  ;; CVTT* converts with truncation toward zero and returns x86's integer
  ;; indefinite value for NaN or overflow. WebAssembly's saturating conversion
  ;; avoids a host trap; explicit bounds restore x86's high-overflow behavior.
  (func $sse_cvtt_f32_i32 (param $v f32) (result i32)
    (if (i32.or
          (f32.ne (local.get $v) (local.get $v))
          (i32.or
            (f32.ge (local.get $v) (f32.const 2147483648))
            (f32.lt (local.get $v) (f32.const -2147483648))))
      (then (return (i32.const 0x80000000))))
    (i32.trunc_sat_f32_s (local.get $v)))

  ;; Scalar unordered comparison sets independent ZF/PF/CF values. Do not
  ;; synthesize an integer subtraction: its parity/sign flags are different.
  ;; MXCSR exception reporting is not yet modeled by this SSE subset.
  ;; COMISS/UCOMISS write ZF/PF/CF from the compare and clear OF/SF/AF, so
  ;; every flag the lazy record models is known here and nothing needs to be
  ;; read back from it: write the exact-raw record (mode 9, the shape
  ;; $load_eflags produces) directly. DF and $eflags_extra are untouched.
  ;;   greater 000, less CF, equal ZF, unordered ZF|PF|CF
  (func $sse_compare_flags (param $a f32) (param $b f32)
    (local $un i32)
    (local.set $un (i32.or (f32.ne (local.get $a) (local.get $a))
                           (f32.ne (local.get $b) (local.get $b))))
    (global.set $flag_op (i32.const 9))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_a (i32.or
      (i32.or (f32.lt (local.get $a) (local.get $b)) (local.get $un))
      (i32.shl (local.get $un) (i32.const 1))))
    (global.set $flag_b (i32.const 0))
    (global.set $flag_res (i32.eqz (i32.or (f32.eq (local.get $a) (local.get $b))
                                           (local.get $un)))))

  ;; CMPPS predicates 0..7: EQ, LT, LE, UNORD, NEQ, NLT, NLE, ORD. A true
  ;; lane is all ones. The negated predicates are true for unordered inputs,
  ;; matching x86 rather than WebAssembly's NaN-false ordered comparisons.
  (func $sse_cmp_lane (param $a f32) (param $b f32) (param $pred i32) (result i32)
    (local $u i32)
    (local.set $pred (i32.and (local.get $pred) (i32.const 7)))
    (local.set $u (i32.or (f32.ne (local.get $a) (local.get $a))
                          (f32.ne (local.get $b) (local.get $b))))
    (if (i32.eq (local.get $pred) (i32.const 0))
      (then (return (select (i32.const -1) (i32.const 0)
        (i32.and (i32.eqz (local.get $u)) (f32.eq (local.get $a) (local.get $b)))))))
    (if (i32.eq (local.get $pred) (i32.const 1))
      (then (return (select (i32.const -1) (i32.const 0)
        (i32.and (i32.eqz (local.get $u)) (f32.lt (local.get $a) (local.get $b)))))))
    (if (i32.eq (local.get $pred) (i32.const 2))
      (then (return (select (i32.const -1) (i32.const 0)
        (i32.and (i32.eqz (local.get $u)) (f32.le (local.get $a) (local.get $b)))))))
    (if (i32.eq (local.get $pred) (i32.const 3))
      (then (return (select (i32.const -1) (i32.const 0) (local.get $u)))))
    (if (i32.eq (local.get $pred) (i32.const 4))
      (then (return (select (i32.const -1) (i32.const 0)
        (i32.or (local.get $u) (f32.ne (local.get $a) (local.get $b)))))))
    (if (i32.eq (local.get $pred) (i32.const 5))
      (then (return (select (i32.const -1) (i32.const 0)
        (i32.or (local.get $u) (f32.ge (local.get $a) (local.get $b)))))))
    (if (i32.eq (local.get $pred) (i32.const 6))
      (then (return (select (i32.const -1) (i32.const 0)
        (i32.or (local.get $u) (f32.gt (local.get $a) (local.get $b)))))))
    (select (i32.const -1) (i32.const 0) (i32.eqz (local.get $u))))

  (func $sse_cmpps (param $a v128) (param $b v128) (param $pred i32) (result v128)
    (i32x4.replace_lane 3
      (i32x4.replace_lane 2
        (i32x4.replace_lane 1
          (i32x4.replace_lane 0 (i32x4.splat (i32.const 0))
            (call $sse_cmp_lane (f32x4.extract_lane 0 (local.get $a))
              (f32x4.extract_lane 0 (local.get $b)) (local.get $pred)))
          (call $sse_cmp_lane (f32x4.extract_lane 1 (local.get $a))
            (f32x4.extract_lane 1 (local.get $b)) (local.get $pred)))
        (call $sse_cmp_lane (f32x4.extract_lane 2 (local.get $a))
          (f32x4.extract_lane 2 (local.get $b)) (local.get $pred)))
      (call $sse_cmp_lane (f32x4.extract_lane 3 (local.get $a))
        (f32x4.extract_lane 3 (local.get $b)) (local.get $pred))))

  ;; One threaded handler per operand shape, one br_table over the subop.
  ;; Subops (op bits 8..15), shared by all three shapes:
  ;;   0 move (MOVAPS/MOVUPS)  1 XORPS  2 MOVSS  3 UNPCKLPS  4 MOVLHPS/MOVHPS
  ;;   5 CVTTPS2PI  6 CVTTSS2SI  7 SHUFPS (imm8 in op bits 16..23)
  ;;   8/9 ADDPS/MULPS  10/11 ADDSS/MULSS  12 UCOMISS/COMISS  13/14 DIVSS/SUBSS
  ;;   15/16 DIVPS/SUBPS  17 CVTSI2SS  18 CVTSS2SI  19..26 SQRTPS RSQRTPS RCPPS
  ;;   ANDPS ANDNPS ORPS MAXPS MINPS  27..29 SQRTSS RSQRTSS RCPSS  30 MOVLPS
  ;;   31 CMPPS (predicate in op bits 16..23)  32 MOVMSKPS
  ;;   33 MOVNTPS store (instruction offset within block in op bits16..31)
  ;; Scalar forms preserve the destination's upper 96 bits. RSQRT*/RCP* are
  ;; exact here where silicon gives ~12 bits -- the safe direction, and callers
  ;; that care refine with Newton-Raphson (B&W2's normalizer at 0x00962cb6).
  ;; MINPS/MAXPS return the SOURCE when unordered or equal: wasm pmin/pmax with
  ;; the operands swapped, not f32x4.min/max, which propagate NaN.
  ;;
  ;; This used to be an if-chain over ~20 subops plus two helper calls, with
  ;; the registers in i64 globals behind eight-way branches -- on Black & White
  ;; 2 these three handlers are ~19% of all threaded ops.
  (func $th_sse_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $dst i32) (local $src i32)
    (local $dp i32) (local $d v128) (local $s v128) (local $v v128)
    (local.set $sub (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xFF)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $src (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $dp (call $xmm_addr (local.get $dst)))
    (local.set $d (v128.load (local.get $dp)))
    (local.set $s (call $xmm_get (local.get $src)))
    (block $wr
      (block $movmsk
      (block $cmpps
      (block $rcpss
      (block $rsqrtss
      (block $sqrtss
      (block $minps
      (block $maxps
      (block $orps
      (block $andnps
      (block $andps
      (block $rcpps
      (block $rsqrtps
      (block $sqrtps
      (block $cvtss2si
      (block $cvtsi2ss
      (block $subps
      (block $divps
      (block $subss
      (block $divss
      (block $comiss
      (block $mulss
      (block $addss
      (block $mulps
      (block $addps
      (block $shufps
      (block $cvttss2si
      (block $cvttps2pi
      (block $movlh
      (block $unpck
      (block $movss
      (block $xor
      (block $mov
        (br_table $mov $xor $movss $unpck $movlh $cvttps2pi $cvttss2si $shufps $addps $mulps $addss $mulss $comiss $divss $subss $divps $subps $cvtsi2ss $cvtss2si $sqrtps $rsqrtps $rcpps $andps $andnps $orps $maxps $minps $sqrtss $rsqrtss $rcpss $mov $cmpps $movmsk $mov (local.get $sub)))
      ;; mov
      (local.set $v (local.get $s))
      (br $wr))
      ;; xor
      (local.set $v (v128.xor (local.get $d) (local.get $s)))
      (br $wr))
      ;; movss
      (local.set $v (i32x4.replace_lane 0 (local.get $d) (i32x4.extract_lane 0 (local.get $s))))
      (br $wr))
      ;; unpck
      (local.set $v (i32x4.replace_lane 3
        (i32x4.replace_lane 2
          (i32x4.replace_lane 1 (local.get $d)
            (i32x4.extract_lane 0 (local.get $s)))
          (i32x4.extract_lane 1 (local.get $d)))
        (i32x4.extract_lane 1 (local.get $s))))
      (br $wr))
      ;; movlh
      (local.set $v (i32x4.replace_lane 3
        (i32x4.replace_lane 2 (local.get $d)
          (i32x4.extract_lane 0 (local.get $s)))
        (i32x4.extract_lane 1 (local.get $s))))
      (br $wr))
      ;; cvttps2pi
      (call $mmx_set (local.get $dst)
        (i64.or
          (i64.extend_i32_u (call $sse_cvtt_f32_i32 (f32x4.extract_lane 0 (local.get $s))))
          (i64.shl (i64.extend_i32_u (call $sse_cvtt_f32_i32 (f32x4.extract_lane 1 (local.get $s))))
                   (i64.const 32))))
      (dispatch-next))
      ;; cvttss2si
      (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (call $sse_cvtt_f32_i32 (f32x4.extract_lane 0 (local.get $s))))
      (dispatch-next))
      ;; shufps
      (local.set $v (call $sse_shufps (local.get $d) (local.get $s) (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xFF))))
      (br $wr))
      ;; addps
      (local.set $v (f32x4.add (local.get $d) (local.get $s)))
      (br $wr))
      ;; mulps
      (local.set $v (f32x4.mul (local.get $d) (local.get $s)))
      (br $wr))
      ;; addss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.add (f32x4.extract_lane 0 (local.get $d)) (f32x4.extract_lane 0 (local.get $s)))))
      (br $wr))
      ;; mulss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.mul (f32x4.extract_lane 0 (local.get $d)) (f32x4.extract_lane 0 (local.get $s)))))
      (br $wr))
      ;; comiss
      (call $sse_compare_flags (f32x4.extract_lane 0 (local.get $d)) (f32x4.extract_lane 0 (local.get $s)))
      (dispatch-next))
      ;; divss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.div (f32x4.extract_lane 0 (local.get $d)) (f32x4.extract_lane 0 (local.get $s)))))
      (br $wr))
      ;; subss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.sub (f32x4.extract_lane 0 (local.get $d)) (f32x4.extract_lane 0 (local.get $s)))))
      (br $wr))
      ;; divps
      (local.set $v (f32x4.div (local.get $d) (local.get $s)))
      (br $wr))
      ;; subps
      (local.set $v (f32x4.sub (local.get $d) (local.get $s)))
      (br $wr))
      ;; cvtsi2ss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.convert_i32_s (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $src) (i32.const 2)))))))
      (br $wr))
      ;; cvtss2si
      (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (call $sse_cvtt_f32_i32 (f32.nearest (f32x4.extract_lane 0 (local.get $s)))))
      (dispatch-next))
      ;; sqrtps
      (local.set $v (f32x4.sqrt (local.get $s)))
      (br $wr))
      ;; rsqrtps
      (local.set $v (f32x4.div (f32x4.splat (f32.const 1)) (f32x4.sqrt (local.get $s))))
      (br $wr))
      ;; rcpps
      (local.set $v (f32x4.div (f32x4.splat (f32.const 1)) (local.get $s)))
      (br $wr))
      ;; andps
      (local.set $v (v128.and (local.get $d) (local.get $s)))
      (br $wr))
      ;; andnps
      (local.set $v (v128.andnot (local.get $s) (local.get $d)))
      (br $wr))
      ;; orps
      (local.set $v (v128.or (local.get $d) (local.get $s)))
      (br $wr))
      ;; maxps
      (local.set $v (f32x4.pmax (local.get $s) (local.get $d)))
      (br $wr))
      ;; minps
      (local.set $v (f32x4.pmin (local.get $s) (local.get $d)))
      (br $wr))
      ;; sqrtss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.sqrt (f32x4.extract_lane 0 (local.get $s)))))
      (br $wr))
      ;; rsqrtss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.div (f32.const 1) (f32.sqrt (f32x4.extract_lane 0 (local.get $s))))))
      (br $wr))
      ;; rcpss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.div (f32.const 1) (f32x4.extract_lane 0 (local.get $s)))))
      (br $wr))
      ;; cmpps
      (local.set $v (call $sse_cmpps (local.get $d) (local.get $s) (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xFF))))
      (br $wr))
      ;; movmsk
      (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (i32x4.bitmask (local.get $s)))
      (dispatch-next))
    (v128.store (local.get $dp) (local.get $v))
    (dispatch-next))

  ;; Memory source. Scalar and 64-bit forms read exactly the bytes x86 reads
  ;; (four or eight), because the rest of the 16 may sit on an unmapped page.
  ;; MOVSS from memory zeroes the destination's upper 96 bits; only the
  ;; register-to-register MOVSS preserves them.
  (func $th_sse_rm (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $dst i32) (local $addr i32)
    (local $dp i32) (local $d v128) (local $s v128) (local $v v128)
    (local.set $sub (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xFF)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $addr (call $read_addr))
    (local.set $dp (call $xmm_addr (local.get $dst)))
    (local.set $d (v128.load (local.get $dp)))
    (block $wr
      (block $cmpps
      (block $movlps
      (block $rcpss
      (block $rsqrtss
      (block $sqrtss
      (block $minps
      (block $maxps
      (block $orps
      (block $andnps
      (block $andps
      (block $rcpps
      (block $rsqrtps
      (block $sqrtps
      (block $cvtss2si
      (block $cvtsi2ss
      (block $subps
      (block $divps
      (block $subss
      (block $divss
      (block $comiss
      (block $mulss
      (block $addss
      (block $mulps
      (block $addps
      (block $shufps
      (block $cvttss2si
      (block $cvttps2pi
      (block $movlh
      (block $unpck
      (block $movss
      (block $xor
      (block $mov
        (br_table $mov $xor $movss $unpck $movlh $cvttps2pi $cvttss2si $shufps $addps $mulps $addss $mulss $comiss $divss $subss $divps $subps $cvtsi2ss $cvtss2si $sqrtps $rsqrtps $rcpps $andps $andnps $orps $maxps $minps $sqrtss $rsqrtss $rcpss $movlps $cmpps $mov $mov (local.get $sub)))
      ;; mov
      (local.set $v (call $gl128 (local.get $addr)))
      (br $wr))
      ;; xor
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (v128.xor (local.get $d) (local.get $s)))
      (br $wr))
      ;; movss
      (local.set $v (i32x4.replace_lane 0 (v128.const i32x4 0 0 0 0) (call $gl32 (local.get $addr))))
      (br $wr))
      ;; unpck
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (i32x4.replace_lane 3
        (i32x4.replace_lane 2
          (i32x4.replace_lane 1 (local.get $d)
            (i32x4.extract_lane 0 (local.get $s)))
          (i32x4.extract_lane 1 (local.get $d)))
        (i32x4.extract_lane 1 (local.get $s))))
      (br $wr))
      ;; movlh
      (local.set $v (i32x4.replace_lane 3
        (i32x4.replace_lane 2 (local.get $d) (call $gl32 (local.get $addr)))
        (call $gl32 (i32.add (local.get $addr) (i32.const 4)))))
      (br $wr))
      ;; cvttps2pi
      (call $mmx_set (local.get $dst)
        (i64.or
          (i64.extend_i32_u (call $sse_cvtt_f32_i32 (f32.reinterpret_i32 (call $gl32 (local.get $addr)))))
          (i64.shl (i64.extend_i32_u (call $sse_cvtt_f32_i32
                     (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $addr) (i32.const 4))))))
                   (i64.const 32))))
      (dispatch-next))
      ;; cvttss2si
      (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (call $sse_cvtt_f32_i32 (f32.reinterpret_i32 (call $gl32 (local.get $addr)))))
      (dispatch-next))
      ;; shufps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (call $sse_shufps (local.get $d) (local.get $s) (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xFF))))
      (br $wr))
      ;; addps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.add (local.get $d) (local.get $s)))
      (br $wr))
      ;; mulps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.mul (local.get $d) (local.get $s)))
      (br $wr))
      ;; addss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.add (f32x4.extract_lane 0 (local.get $d)) (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (br $wr))
      ;; mulss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.mul (f32x4.extract_lane 0 (local.get $d)) (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (br $wr))
      ;; comiss
      (call $sse_compare_flags (f32x4.extract_lane 0 (local.get $d)) (f32.reinterpret_i32 (call $gl32 (local.get $addr))))
      (dispatch-next))
      ;; divss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.div (f32x4.extract_lane 0 (local.get $d)) (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (br $wr))
      ;; subss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.sub (f32x4.extract_lane 0 (local.get $d)) (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (br $wr))
      ;; divps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.div (local.get $d) (local.get $s)))
      (br $wr))
      ;; subps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.sub (local.get $d) (local.get $s)))
      (br $wr))
      ;; cvtsi2ss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.convert_i32_s (call $gl32 (local.get $addr)))))
      (br $wr))
      ;; cvtss2si
      (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (call $sse_cvtt_f32_i32 (f32.nearest (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (dispatch-next))
      ;; sqrtps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.sqrt (local.get $s)))
      (br $wr))
      ;; rsqrtps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.div (f32x4.splat (f32.const 1)) (f32x4.sqrt (local.get $s))))
      (br $wr))
      ;; rcpps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.div (f32x4.splat (f32.const 1)) (local.get $s)))
      (br $wr))
      ;; andps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (v128.and (local.get $d) (local.get $s)))
      (br $wr))
      ;; andnps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (v128.andnot (local.get $s) (local.get $d)))
      (br $wr))
      ;; orps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (v128.or (local.get $d) (local.get $s)))
      (br $wr))
      ;; maxps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.pmax (local.get $s) (local.get $d)))
      (br $wr))
      ;; minps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (f32x4.pmin (local.get $s) (local.get $d)))
      (br $wr))
      ;; sqrtss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.sqrt (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (br $wr))
      ;; rsqrtss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.div (f32.const 1) (f32.sqrt (f32.reinterpret_i32 (call $gl32 (local.get $addr)))))))
      (br $wr))
      ;; rcpss
      (local.set $v (f32x4.replace_lane 0 (local.get $d) (f32.div (f32.const 1) (f32.reinterpret_i32 (call $gl32 (local.get $addr))))))
      (br $wr))
      ;; movlps
      (local.set $v (i32x4.replace_lane 1
        (i32x4.replace_lane 0 (local.get $d) (call $gl32 (local.get $addr)))
        (call $gl32 (i32.add (local.get $addr) (i32.const 4)))))
      (br $wr))
      ;; cmpps
      (local.set $s (call $gl128 (local.get $addr)))
      (local.set $v (call $sse_cmpps (local.get $d) (local.get $s) (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xFF))))
      (br $wr))
    (v128.store (local.get $dp) (local.get $v))
    (dispatch-next))

  ;; Memory destination: MOVSS (2), MOVHPS (4), MOVLPS (30), else a 128-bit
  ;; MOVAPS/MOVUPS store.
  (func $th_sse_mr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $addr i32) (local $v v128)
    (local.set $sub (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 255)))
    (local.set $v (call $xmm_get (i32.shr_u (local.get $op) (i32.const 4))))
    (local.set $addr (call $read_addr))
    (if (i32.and (i32.eq (local.get $sub) (i32.const 33))
      (i32.ne (i32.and (local.get $addr) (i32.const 15)) (i32.const 0))) (then
      ;; MOVNTPS requires alignment even when ordinary unaligned guest stores
      ;; are allowed. Raise before touching any byte, at the actual instruction.
      (global.set $fault_address (local.get $addr))
      (global.set $eip (i32.add (global.get $eip) (i32.shr_u (local.get $op) (i32.const 16))))
      (call $raise_exception (i32.const 0xC0000005))
      (return)))
    (if (i32.eq (local.get $sub) (i32.const 2))
      (then (call $gs32 (local.get $addr) (i32x4.extract_lane 0 (local.get $v)))
            (dispatch-next)))
    (if (i32.eq (local.get $sub) (i32.const 30))
      (then (call $gs64 (local.get $addr) (i64x2.extract_lane 0 (local.get $v)))
            (dispatch-next)))
    (if (i32.eq (local.get $sub) (i32.const 4))
      (then (call $gs64 (local.get $addr) (i64x2.extract_lane 1 (local.get $v)))
            (dispatch-next)))
    (call $gs128 (local.get $addr) (local.get $v))
    (dispatch-next))

  ;; ---- Dedicated scalar handlers (478..490) ----
  ;; The decoder picks one of these instead of $th_sse_rr/rm/mr for the hot
  ;; scalar subops, so the dispatch that reached the handler already names the
  ;; operation and no second br_table runs. Operand word is the generic
  ;; form's low byte (dst<<4|src, or dst<<4 with an address word following).
  ;; A scalar op touches lane 0 only, so it reads and writes that one f32 in
  ;; the XMM file; the upper 96 bits stay where they are in memory.
  (func $th_addss_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32)
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp)
      (f32.add (f32.load (local.get $dp)) (f32.load (call $xmm_addr (local.get $op)))))
    (dispatch-next))

  (func $th_addss_rm (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $read_addr))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.add (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_subss_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32)
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp)
      (f32.sub (f32.load (local.get $dp)) (f32.load (call $xmm_addr (local.get $op)))))
    (dispatch-next))

  (func $th_subss_rm (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $read_addr))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.sub (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_mulss_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32)
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp)
      (f32.mul (f32.load (local.get $dp)) (f32.load (call $xmm_addr (local.get $op)))))
    (dispatch-next))

  (func $th_mulss_rm (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $read_addr))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.mul (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_divss_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32)
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp)
      (f32.div (f32.load (local.get $dp)) (f32.load (call $xmm_addr (local.get $op)))))
    (dispatch-next))

  (func $th_divss_rm (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $read_addr))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.div (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  ;; MOVSS xmm,xmm keeps the destination's upper lanes.
  (func $th_movss_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32)
    (i32.store (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4)))
      (i32.load (call $xmm_addr (local.get $op))))
    (dispatch-next))

  ;; MOVSS xmm,m32 zeroes bits 32..127.
  (func $th_movss_load (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $v i32)
    (local.set $v (call $gl32 (call $read_addr)))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (i32.store (local.get $dp) (local.get $v))
    (i32.store offset=4 (local.get $dp) (i32.const 0))
    (i64.store offset=8 (local.get $dp) (i64.const 0))
    (dispatch-next))

  (func $th_movss_store (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $v i32)
    (local.set $v (i32.load (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4)))))
    (call $gs32 (call $read_addr) (local.get $v))
    (dispatch-next))

  (func $th_comiss_rr (param $op i32)
    (local $nx_fn i32) (local $nx_op i32)
    (call $sse_compare_flags
      (f32.load (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
      (f32.load (call $xmm_addr (local.get $op))))
    (dispatch-next))

  (func $th_comiss_rm (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $read_addr))))
    (call $sse_compare_flags
      (f32.load (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
      (local.get $b))
    (dispatch-next))

  ;; ---- [reg+disp] forms (491..497) ----
  ;; The integer _ro handlers' trick for the scalar ops: operand word is
  ;; disp<<8 | xmm<<4 | base, so the address is one register load and an add
  ;; inside the handler, instead of a $th_compute_ea_sib dispatch ahead of it
  ;; and a round trip through ea_temp. Displacements past signed 24 bits and
  ;; indexed or absolute operands keep the generic path.
  (func $sse_ro_addr (param $op i32) (result i32)
    (i32.add
      (i32.load (i32.add (global.get $reg_base)
        (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))))
      (i32.shr_s (local.get $op) (i32.const 8))))

  (func $th_movss_load_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $v i32)
    (local.set $v (call $gl32 (call $sse_ro_addr (local.get $op))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (i32.store (local.get $dp) (local.get $v))
    (i32.store offset=4 (local.get $dp) (i32.const 0))
    (i64.store offset=8 (local.get $dp) (i64.const 0))
    (dispatch-next))

  (func $th_movss_store_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32)
    (call $gs32 (call $sse_ro_addr (local.get $op))
      (i32.load (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4)))))
    (dispatch-next))

  (func $th_addss_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $sse_ro_addr (local.get $op)))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.add (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_subss_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $sse_ro_addr (local.get $op)))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.sub (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_mulss_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $sse_ro_addr (local.get $op)))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.mul (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_divss_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $dp i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $sse_ro_addr (local.get $op)))))
    (local.set $dp (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
    (f32.store (local.get $dp) (f32.div (f32.load (local.get $dp)) (local.get $b)))
    (dispatch-next))

  (func $th_comiss_ro (param $op i32)
    (local $nx_fn i32) (local $nx_op i32) (local $b f32)
    (local.set $b (f32.reinterpret_i32 (call $gl32 (call $sse_ro_addr (local.get $op)))))
    (call $sse_compare_flags
      (f32.load (call $xmm_addr (i32.shr_u (local.get $op) (i32.const 4))))
      (local.get $b))
    (dispatch-next))

  ;; Emit an SSE memory-operand op: the packed [reg+disp] handler when the
  ;; subop has one and the operand fits, else the address op + generic or
  ;; dedicated handler + address word. $decode_modrm and $apply_seg_override
  ;; have already run.
  (func $emit_sse_mem (param $h i32) (param $op i32)
    (local $sub i32) (local $ro i32) (local $a i32)
    (local.set $sub (i32.shr_u (local.get $op) (i32.const 8)))
    (if (i32.eq (local.get $h) (i32.const 433))
      (then
        (if (i32.eq (local.get $sub) (i32.const 2))  (then (local.set $ro (i32.const 491))))
        (if (i32.eq (local.get $sub) (i32.const 10)) (then (local.set $ro (i32.const 493))))
        (if (i32.eq (local.get $sub) (i32.const 14)) (then (local.set $ro (i32.const 494))))
        (if (i32.eq (local.get $sub) (i32.const 11)) (then (local.set $ro (i32.const 495))))
        (if (i32.eq (local.get $sub) (i32.const 13)) (then (local.set $ro (i32.const 496))))
        (if (i32.eq (local.get $sub) (i32.const 12)) (then (local.set $ro (i32.const 497))))))
    (if (i32.and (i32.eq (local.get $h) (i32.const 434))
                 (i32.eq (local.get $sub) (i32.const 2)))
      (then (local.set $ro (i32.const 492))))
    (if (i32.and
          (i32.and (i32.ne (local.get $ro) (i32.const 0))
                   (call $mr_simple_base))
          (i32.and (i32.eqz (global.get $d_addr16))
                   (i32.eq (i32.shr_s (i32.shl (global.get $mr_disp) (i32.const 8)) (i32.const 8))
                           (global.get $mr_disp))))
      (then
        (call $te (local.get $ro)
          (i32.or (i32.shl (global.get $mr_disp) (i32.const 8))
            (i32.or (i32.and (local.get $op) (i32.const 0xF0)) (global.get $mr_base))))
        (return)))
    (local.set $a (call $emit_sib_or_abs))
    (call $te_sse (local.get $h) (local.get $op))
    (call $te_raw (local.get $a)))

  ;; Emit an SSE op, swapping the generic handler for a dedicated one when
  ;; the subop has one. Only the low byte of the operand word survives,
  ;; which is all the dedicated handlers read.
  (func $te_sse (param $h i32) (param $op i32)
    (local $sub i32) (local $d i32)
    (local.set $sub (i32.shr_u (local.get $op) (i32.const 8)))
    (if (i32.eq (local.get $h) (i32.const 432))
      (then
        (if (i32.eq (local.get $sub) (i32.const 2))  (then (local.set $d (i32.const 486))))
        (if (i32.eq (local.get $sub) (i32.const 10)) (then (local.set $d (i32.const 478))))
        (if (i32.eq (local.get $sub) (i32.const 11)) (then (local.set $d (i32.const 482))))
        (if (i32.eq (local.get $sub) (i32.const 12)) (then (local.set $d (i32.const 489))))
        (if (i32.eq (local.get $sub) (i32.const 13)) (then (local.set $d (i32.const 484))))
        (if (i32.eq (local.get $sub) (i32.const 14)) (then (local.set $d (i32.const 480))))))
    (if (i32.eq (local.get $h) (i32.const 433))
      (then
        (if (i32.eq (local.get $sub) (i32.const 2))  (then (local.set $d (i32.const 487))))
        (if (i32.eq (local.get $sub) (i32.const 10)) (then (local.set $d (i32.const 479))))
        (if (i32.eq (local.get $sub) (i32.const 11)) (then (local.set $d (i32.const 483))))
        (if (i32.eq (local.get $sub) (i32.const 12)) (then (local.set $d (i32.const 490))))
        (if (i32.eq (local.get $sub) (i32.const 13)) (then (local.set $d (i32.const 485))))
        (if (i32.eq (local.get $sub) (i32.const 14)) (then (local.set $d (i32.const 481))))))
    (if (i32.and (i32.eq (local.get $h) (i32.const 434))
                 (i32.eq (local.get $sub) (i32.const 2)))
      (then (local.set $d (i32.const 488))))
    (if (local.get $d)
      (then (call $te (local.get $d) (i32.and (local.get $op) (i32.const 0xFF))))
      (else (call $te (local.get $h) (local.get $op)))))

  ;; ---- Guest 64-bit access ----
  ;; Two 32-bit accesses rather than one i64.load on g2w: $gl32/$gs32 carry the
  ;; page-boundary and DIB-backing logic, and an MMX blitter reads straight out
  ;; of surfaces that use it.
  (func $mmx_load64 (param $ga i32) (result i64)
    (i64.or
      (i64.extend_i32_u (call $gl32 (local.get $ga)))
      (i64.shl (i64.extend_i32_u (call $gl32 (i32.add (local.get $ga) (i32.const 4))))
               (i64.const 32))))

  (func $mmx_store64 (param $ga i32) (param $v i64)
    (call $gs64 (local.get $ga) (local.get $v)))

  ;; ---- Packed ops ----
  ;; $sub is the subop id assigned by $mmx_opcode_subop below. Whole-register
  ;; work stays in i64; anything lane-shaped widens to v128.
  ;;
  ;; The pack instructions all reduce two source halves to one, and wasm's
  ;; narrow_* puts the first operand's lanes in bytes 0..7 and the second's in
  ;; 8..15. Since both inputs are splatted, the four lanes we want from each
  ;; sit at bytes 0..3 and 8..11 -- hence the same shuffle for all three.
  (func $mmx_binop (param $a i64) (param $b i64) (param $sub i32) (result i64)
    (local $va v128) (local $vb v128)

    ;; --- whole-register, no lanes involved ---
    (if (i32.eq (local.get $sub) (i32.const 3))
      (then (return (i64.and (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $sub) (i32.const 4))     ;; pandn: ~dst & src
      (then (return (i64.and (i64.xor (local.get $a) (i64.const -1)) (local.get $b)))))
    (if (i32.eq (local.get $sub) (i32.const 5))
      (then (return (i64.or (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $sub) (i32.const 6))
      (then (return (i64.xor (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $sub) (i32.const 7))     ;; punpckldq
      (then (return (i64.or
              (i64.and (local.get $a) (i64.const 0xFFFFFFFF))
              (i64.shl (local.get $b) (i64.const 32))))))
    (if (i32.eq (local.get $sub) (i32.const 8))     ;; punpckhdq
      (then (return (i64.or
              (i64.shr_u (local.get $a) (i64.const 32))
              (i64.and (local.get $b) (i64.const -4294967296))))))  ;; 0xFFFFFFFF00000000

    (local.set $va (i64x2.splat (local.get $a)))
    (local.set $vb (i64x2.splat (local.get $b)))

    ;; --- interleave ---
    (if (i32.eq (local.get $sub) (i32.const 9))     ;; punpcklbw
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 0 16 1 17 2 18 3 19 0 0 0 0 0 0 0 0
              (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 10))    ;; punpckhbw
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 4 20 5 21 6 22 7 23 0 0 0 0 0 0 0 0
              (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 11))    ;; punpcklwd
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 0 1 16 17 2 3 18 19 0 0 0 0 0 0 0 0
              (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 12))    ;; punpckhwd
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 4 5 20 21 6 7 22 23 0 0 0 0 0 0 0 0
              (local.get $va) (local.get $vb))))))

    ;; --- pack with saturation ---
    (if (i32.eq (local.get $sub) (i32.const 13))    ;; packsswb
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 0 1 2 3 8 9 10 11 0 0 0 0 0 0 0 0
              (i8x16.narrow_i16x8_s (local.get $va) (local.get $vb))
              (i8x16.narrow_i16x8_s (local.get $va) (local.get $vb)))))))
    (if (i32.eq (local.get $sub) (i32.const 14))    ;; packssdw
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 0 1 2 3 8 9 10 11 0 0 0 0 0 0 0 0
              (i16x8.narrow_i32x4_s (local.get $va) (local.get $vb))
              (i16x8.narrow_i32x4_s (local.get $va) (local.get $vb)))))))
    (if (i32.eq (local.get $sub) (i32.const 15))    ;; packuswb
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 0 1 2 3 8 9 10 11 0 0 0 0 0 0 0 0
              (i8x16.narrow_i16x8_u (local.get $va) (local.get $vb))
              (i8x16.narrow_i16x8_u (local.get $va) (local.get $vb)))))))

    ;; --- multiply ---
    ;; pmaddwd is exactly i32x4.dot_i16x8_s: lanes 0 and 1 of the result are
    ;; a0*b0+a1*b1 and a2*b2+a3*b3, which is the whole 64-bit answer.
    (if (i32.eq (local.get $sub) (i32.const 16))
      (then (return (i64x2.extract_lane 0 (i32x4.dot_i16x8_s (local.get $va) (local.get $vb))))))
    ;; pmulhw/pmulhuw: widen to 32-bit products, then keep the high half of
    ;; each -- bytes 2,3 of every dword.
    (if (i32.eq (local.get $sub) (i32.const 17))
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 2 3 6 7 10 11 14 15 0 0 0 0 0 0 0 0
              (i32x4.extmul_low_i16x8_s (local.get $va) (local.get $vb))
              (i32x4.extmul_low_i16x8_s (local.get $va) (local.get $vb)))))))
    (if (i32.eq (local.get $sub) (i32.const 18))
      (then (return (i64x2.extract_lane 0 (i8x16.shuffle 2 3 6 7 10 11 14 15 0 0 0 0 0 0 0 0
              (i32x4.extmul_low_i16x8_u (local.get $va) (local.get $vb))
              (i32x4.extmul_low_i16x8_u (local.get $va) (local.get $vb)))))))
    (if (i32.eq (local.get $sub) (i32.const 19))    ;; pmullw
      (then (return (i64x2.extract_lane 0 (i16x8.mul (local.get $va) (local.get $vb))))))

    ;; --- elementwise, 32 + kind*4 + width ---
    (if (i32.eq (local.get $sub) (i32.const 32)) (then (return (i64x2.extract_lane 0 (i8x16.add (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 33)) (then (return (i64x2.extract_lane 0 (i16x8.add (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 34)) (then (return (i64x2.extract_lane 0 (i32x4.add (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 35)) (then (return (i64.add (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $sub) (i32.const 36)) (then (return (i64x2.extract_lane 0 (i8x16.sub (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 37)) (then (return (i64x2.extract_lane 0 (i16x8.sub (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 38)) (then (return (i64x2.extract_lane 0 (i32x4.sub (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 39)) (then (return (i64.sub (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $sub) (i32.const 40)) (then (return (i64x2.extract_lane 0 (i8x16.add_sat_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 41)) (then (return (i64x2.extract_lane 0 (i16x8.add_sat_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 44)) (then (return (i64x2.extract_lane 0 (i8x16.sub_sat_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 45)) (then (return (i64x2.extract_lane 0 (i16x8.sub_sat_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 48)) (then (return (i64x2.extract_lane 0 (i8x16.add_sat_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 49)) (then (return (i64x2.extract_lane 0 (i16x8.add_sat_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 52)) (then (return (i64x2.extract_lane 0 (i8x16.sub_sat_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 53)) (then (return (i64x2.extract_lane 0 (i16x8.sub_sat_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 56)) (then (return (i64x2.extract_lane 0 (i8x16.eq (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 57)) (then (return (i64x2.extract_lane 0 (i16x8.eq (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 58)) (then (return (i64x2.extract_lane 0 (i32x4.eq (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 60)) (then (return (i64x2.extract_lane 0 (i8x16.gt_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 61)) (then (return (i64x2.extract_lane 0 (i16x8.gt_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 62)) (then (return (i64x2.extract_lane 0 (i32x4.gt_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 64)) (then (return (i64x2.extract_lane 0 (i8x16.min_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 68)) (then (return (i64x2.extract_lane 0 (i8x16.max_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 73)) (then (return (i64x2.extract_lane 0 (i16x8.min_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 77)) (then (return (i64x2.extract_lane 0 (i16x8.max_s (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 80)) (then (return (i64x2.extract_lane 0 (i8x16.avgr_u (local.get $va) (local.get $vb))))))
    (if (i32.eq (local.get $sub) (i32.const 81)) (then (return (i64x2.extract_lane 0 (i16x8.avgr_u (local.get $va) (local.get $vb))))))

    ;; Shifts (128 + dir*4 + width). The count is the whole second operand, not
    ;; a lane value, and x86 flushes to zero (or to all sign bits for an
    ;; arithmetic shift) once it is wider than the lane. wasm instead takes the
    ;; count modulo the lane width, so an unguarded psrlw mm0, 32 would shift
    ;; by 0 and return the input untouched.
    (if (i32.ge_u (local.get $sub) (i32.const 128))
      (then (return (call $mmx_shift (local.get $a) (local.get $b) (local.get $sub)))))

    ;; Unreachable: the decoder only emits subops listed above.
    (call $host_log_i32 (i32.or (i32.const 0x0FD00000) (local.get $sub)))
    (unreachable))

  ;; Shift by a variable (or immediate) count, with x86 out-of-range behaviour.
  (func $mmx_shift (param $a i64) (param $cnt i64) (param $sub i32) (result i64)
    (local $n i32) (local $w i32) (local $dir i32) (local $max i32)
    (local $va v128)
    (local.set $dir (i32.div_u (i32.sub (local.get $sub) (i32.const 128)) (i32.const 4)))
    (local.set $w (i32.and (local.get $sub) (i32.const 3)))
    ;; Lane width in bits: w=1 -> 16, w=2 -> 32, w=3 -> 64.
    (local.set $max (i32.shl (i32.const 8) (local.get $w)))
    ;; A count of 2^32 or more is out of range for every width; clamping to the
    ;; width itself keeps the comparisons below in i32.
    (local.set $n (select (i32.const 255) (i32.wrap_i64 (local.get $cnt))
                    (i64.gt_u (local.get $cnt) (i64.const 255))))

    (if (i32.ge_u (local.get $n) (local.get $max))
      (then
        ;; Out of range: logical shifts produce zero, arithmetic replicates the
        ;; sign bit, which is the same as shifting by width-1.
        (if (i32.ne (local.get $dir) (i32.const 2))
          (then (return (i64.const 0))))
        (local.set $n (i32.sub (local.get $max) (i32.const 1)))))

    (if (i32.eq (local.get $w) (i32.const 3))
      (then
        ;; 64-bit shifts have no lane structure -- plain i64.
        (if (i32.eq (local.get $dir) (i32.const 0))
          (then (return (i64.shl (local.get $a) (i64.extend_i32_u (local.get $n))))))
        (if (i32.eq (local.get $dir) (i32.const 1))
          (then (return (i64.shr_u (local.get $a) (i64.extend_i32_u (local.get $n))))))
        (return (i64.shr_s (local.get $a) (i64.extend_i32_u (local.get $n))))))

    (local.set $va (i64x2.splat (local.get $a)))
    (if (i32.eq (local.get $w) (i32.const 1))
      (then
        (if (i32.eq (local.get $dir) (i32.const 0))
          (then (return (i64x2.extract_lane 0 (i16x8.shl (local.get $va) (local.get $n))))))
        (if (i32.eq (local.get $dir) (i32.const 1))
          (then (return (i64x2.extract_lane 0 (i16x8.shr_u (local.get $va) (local.get $n))))))
        (return (i64x2.extract_lane 0 (i16x8.shr_s (local.get $va) (local.get $n))))))
    (if (i32.eq (local.get $dir) (i32.const 0))
      (then (return (i64x2.extract_lane 0 (i32x4.shl (local.get $va) (local.get $n))))))
    (if (i32.eq (local.get $dir) (i32.const 1))
      (then (return (i64x2.extract_lane 0 (i32x4.shr_u (local.get $va) (local.get $n))))))
    (i64x2.extract_lane 0 (i32x4.shr_s (local.get $va) (local.get $n))))

  ;; ---- Threaded handlers ----
  ;; 407: mm, mm      op = sub<<8 | dst<<4 | src
  ;; 408: mm, m       op = sub<<8 | dst<<4        ; address word follows
  ;; 409: m, mm       op = sub<<8 | src<<4        ; address word follows
  ;; 410: mm, imm8    op = sub<<12 | dst<<8 | imm8

  (func $th_mmx_rr (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $dst i32) (local $src i32)
    (global.set $mmx_exec_count (i32.add (global.get $mmx_exec_count) (i32.const 1)))
    (local.set $sub (i32.shr_u (local.get $op) (i32.const 8)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $src (i32.and (local.get $op) (i32.const 0xF)))
    ;; movq mm, mm
    (if (i32.eqz (local.get $sub))
      (then (call $mmx_set (local.get $dst) (call $mmx_get (local.get $src))) (dispatch-next)))
    ;; movd mm, r32 -- src names a general register, not an MMX one.
    (if (i32.eq (local.get $sub) (i32.const 1))
      (then (call $mmx_set (local.get $dst)
              (i64.extend_i32_u (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $src) (i32.const 2))))))
            (dispatch-next)))
    ;; movd r32, mm -- dst names a general register.
    (if (i32.eq (local.get $sub) (i32.const 2))
      (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (i32.wrap_i64 (call $mmx_get (local.get $src))))
            (dispatch-next)))
    ;; pmovmskb r32, mm -- the sign bits of the eight bytes.
    (if (i32.eq (local.get $sub) (i32.const 20))
      (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (i32.and (i8x16.bitmask (i64x2.splat (call $mmx_get (local.get $src))))
                       (i32.const 0xFF)))
            (dispatch-next)))
    (call $mmx_set (local.get $dst)
      (call $mmx_binop (call $mmx_get (local.get $dst)) (call $mmx_get (local.get $src))
            (local.get $sub)))
    (dispatch-next))

  (func $th_mmx_rm (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $dst i32) (local $addr i32)
    (global.set $mmx_exec_count (i32.add (global.get $mmx_exec_count) (i32.const 1)))
    (local.set $sub (i32.shr_u (local.get $op) (i32.const 8)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $addr (call $read_addr))
    (if (i32.eqz (local.get $sub))
      (then (call $mmx_set (local.get $dst) (call $mmx_load64 (local.get $addr)))
            (dispatch-next)))
    (if (i32.eq (local.get $sub) (i32.const 1))     ;; movd mm, m32
      (then (call $mmx_set (local.get $dst)
              (i64.extend_i32_u (call $gl32 (local.get $addr))))
            (dispatch-next)))
    (call $mmx_set (local.get $dst)
      (call $mmx_binop (call $mmx_get (local.get $dst)) (call $mmx_load64 (local.get $addr))
            (local.get $sub)))
    (dispatch-next))

  (func $th_mmx_mr (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $src i32) (local $addr i32)
    (global.set $mmx_exec_count (i32.add (global.get $mmx_exec_count) (i32.const 1)))
    (local.set $sub (i32.shr_u (local.get $op) (i32.const 8)))
    (local.set $src (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $addr (call $read_addr))
    (if (i32.eq (local.get $sub) (i32.const 2))     ;; movd m32, mm
      (then (call $gs32 (local.get $addr) (i32.wrap_i64 (call $mmx_get (local.get $src))))
            (dispatch-next)))
    (call $mmx_store64 (local.get $addr) (call $mmx_get (local.get $src)))
    (dispatch-next))

  (func $th_mmx_ri (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $sub i32) (local $dst i32)
    (global.set $mmx_exec_count (i32.add (global.get $mmx_exec_count) (i32.const 1)))
    (local.set $sub (i32.shr_u (local.get $op) (i32.const 12)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (call $mmx_set (local.get $dst)
      (call $mmx_binop (call $mmx_get (local.get $dst))
            (i64.extend_i32_u (i32.and (local.get $op) (i32.const 0xFF)))
            (local.get $sub)))
    (dispatch-next))

  ;; ---- Decoder support ----
  ;; Map a second opcode byte to a subop, or -1 when it is not an MMX
  ;; instruction we implement. Called by $decode_block before it consumes the
  ;; ModRM byte, so it must decide purely from the opcode.
  ;;
  ;; Prefixed forms (66/F2/F3 before 0F) are the xmm variants and are NOT MMX;
  ;; the caller rejects them and lets the unknown-0F trap report them, which is
  ;; the honest outcome while CPUID advertises MMX but not SSE.
  (func $mmx_opcode_subop (param $op i32) (result i32)
    ;; 0x60-0x6B: interleave and pack
    (if (i32.eq (local.get $op) (i32.const 0x60)) (then (return (i32.const 9))))   ;; punpcklbw
    (if (i32.eq (local.get $op) (i32.const 0x61)) (then (return (i32.const 11))))  ;; punpcklwd
    (if (i32.eq (local.get $op) (i32.const 0x62)) (then (return (i32.const 7))))   ;; punpckldq
    (if (i32.eq (local.get $op) (i32.const 0x63)) (then (return (i32.const 13))))  ;; packsswb
    (if (i32.eq (local.get $op) (i32.const 0x64)) (then (return (i32.const 60))))  ;; pcmpgtb
    (if (i32.eq (local.get $op) (i32.const 0x65)) (then (return (i32.const 61))))  ;; pcmpgtw
    (if (i32.eq (local.get $op) (i32.const 0x66)) (then (return (i32.const 62))))  ;; pcmpgtd
    (if (i32.eq (local.get $op) (i32.const 0x67)) (then (return (i32.const 15))))  ;; packuswb
    (if (i32.eq (local.get $op) (i32.const 0x68)) (then (return (i32.const 10))))  ;; punpckhbw
    (if (i32.eq (local.get $op) (i32.const 0x69)) (then (return (i32.const 12))))  ;; punpckhwd
    (if (i32.eq (local.get $op) (i32.const 0x6A)) (then (return (i32.const 8))))   ;; punpckhdq
    (if (i32.eq (local.get $op) (i32.const 0x6B)) (then (return (i32.const 14))))  ;; packssdw
    (if (i32.eq (local.get $op) (i32.const 0x6E)) (then (return (i32.const 1))))   ;; movd mm, r/m32
    (if (i32.eq (local.get $op) (i32.const 0x6F)) (then (return (i32.const 0))))   ;; movq mm, mm/m64
    ;; 0x74-0x76: compare equal
    (if (i32.eq (local.get $op) (i32.const 0x74)) (then (return (i32.const 56))))
    (if (i32.eq (local.get $op) (i32.const 0x75)) (then (return (i32.const 57))))
    (if (i32.eq (local.get $op) (i32.const 0x76)) (then (return (i32.const 58))))
    (if (i32.eq (local.get $op) (i32.const 0x7E)) (then (return (i32.const 2))))   ;; movd r/m32, mm
    (if (i32.eq (local.get $op) (i32.const 0x7F)) (then (return (i32.const 0))))   ;; movq mm/m64, mm
    ;; 0xD1-0xD3: shift right logical by mm/m64
    (if (i32.eq (local.get $op) (i32.const 0xD1)) (then (return (i32.const 133))))
    (if (i32.eq (local.get $op) (i32.const 0xD2)) (then (return (i32.const 134))))
    (if (i32.eq (local.get $op) (i32.const 0xD3)) (then (return (i32.const 135))))
    (if (i32.eq (local.get $op) (i32.const 0xD4)) (then (return (i32.const 35))))  ;; paddq
    (if (i32.eq (local.get $op) (i32.const 0xD5)) (then (return (i32.const 19))))  ;; pmullw
    (if (i32.eq (local.get $op) (i32.const 0xD7)) (then (return (i32.const 20))))  ;; pmovmskb
    (if (i32.eq (local.get $op) (i32.const 0xD8)) (then (return (i32.const 52))))  ;; psubusb
    (if (i32.eq (local.get $op) (i32.const 0xD9)) (then (return (i32.const 53))))  ;; psubusw
    (if (i32.eq (local.get $op) (i32.const 0xDA)) (then (return (i32.const 64))))  ;; pminub
    (if (i32.eq (local.get $op) (i32.const 0xDB)) (then (return (i32.const 3))))   ;; pand
    (if (i32.eq (local.get $op) (i32.const 0xDC)) (then (return (i32.const 48))))  ;; paddusb
    (if (i32.eq (local.get $op) (i32.const 0xDD)) (then (return (i32.const 49))))  ;; paddusw
    (if (i32.eq (local.get $op) (i32.const 0xDE)) (then (return (i32.const 68))))  ;; pmaxub
    (if (i32.eq (local.get $op) (i32.const 0xDF)) (then (return (i32.const 4))))   ;; pandn
    (if (i32.eq (local.get $op) (i32.const 0xE0)) (then (return (i32.const 80))))  ;; pavgb
    (if (i32.eq (local.get $op) (i32.const 0xE1)) (then (return (i32.const 137)))) ;; psraw
    (if (i32.eq (local.get $op) (i32.const 0xE2)) (then (return (i32.const 138)))) ;; psrad
    (if (i32.eq (local.get $op) (i32.const 0xE3)) (then (return (i32.const 81))))  ;; pavgw
    (if (i32.eq (local.get $op) (i32.const 0xE4)) (then (return (i32.const 18))))  ;; pmulhuw
    (if (i32.eq (local.get $op) (i32.const 0xE5)) (then (return (i32.const 17))))  ;; pmulhw
    (if (i32.eq (local.get $op) (i32.const 0xE8)) (then (return (i32.const 44))))  ;; psubsb
    (if (i32.eq (local.get $op) (i32.const 0xE9)) (then (return (i32.const 45))))  ;; psubsw
    (if (i32.eq (local.get $op) (i32.const 0xEA)) (then (return (i32.const 73))))  ;; pminsw
    (if (i32.eq (local.get $op) (i32.const 0xEB)) (then (return (i32.const 5))))   ;; por
    (if (i32.eq (local.get $op) (i32.const 0xEC)) (then (return (i32.const 40))))  ;; paddsb
    (if (i32.eq (local.get $op) (i32.const 0xED)) (then (return (i32.const 41))))  ;; paddsw
    (if (i32.eq (local.get $op) (i32.const 0xEE)) (then (return (i32.const 77))))  ;; pmaxsw
    (if (i32.eq (local.get $op) (i32.const 0xEF)) (then (return (i32.const 6))))   ;; pxor
    ;; 0xF1-0xF3: shift left logical by mm/m64
    (if (i32.eq (local.get $op) (i32.const 0xF1)) (then (return (i32.const 129))))
    (if (i32.eq (local.get $op) (i32.const 0xF2)) (then (return (i32.const 130))))
    (if (i32.eq (local.get $op) (i32.const 0xF3)) (then (return (i32.const 131))))
    (if (i32.eq (local.get $op) (i32.const 0xF5)) (then (return (i32.const 16))))  ;; pmaddwd
    (if (i32.eq (local.get $op) (i32.const 0xF8)) (then (return (i32.const 36))))  ;; psubb
    (if (i32.eq (local.get $op) (i32.const 0xF9)) (then (return (i32.const 37))))  ;; psubw
    (if (i32.eq (local.get $op) (i32.const 0xFA)) (then (return (i32.const 38))))  ;; psubd
    (if (i32.eq (local.get $op) (i32.const 0xFB)) (then (return (i32.const 39))))  ;; psubq
    (if (i32.eq (local.get $op) (i32.const 0xFC)) (then (return (i32.const 32))))  ;; paddb
    (if (i32.eq (local.get $op) (i32.const 0xFD)) (then (return (i32.const 33))))  ;; paddw
    (if (i32.eq (local.get $op) (i32.const 0xFE)) (then (return (i32.const 34))))  ;; paddd
    (i32.const -1))

  ;; 0x0F 0x71/0x72/0x73 select the shift by the ModRM reg field and take an
  ;; imm8. Width comes from the opcode: 0x71 word, 0x72 dword, 0x73 qword.
  (func $mmx_group_subop (param $op i32) (param $reg i32) (result i32)
    (local $w i32)
    (local.set $w (i32.sub (local.get $op) (i32.const 0x70)))
    (if (i32.eq (local.get $reg) (i32.const 2))     ;; psrl
      (then (return (i32.add (i32.const 132) (local.get $w)))))
    (if (i32.eq (local.get $reg) (i32.const 6))     ;; psll
      (then (return (i32.add (i32.const 128) (local.get $w)))))
    (if (i32.eq (local.get $reg) (i32.const 4))     ;; psra -- no qword form
      (then
        (if (i32.eq (local.get $w) (i32.const 3)) (then (return (i32.const -1))))
        (return (i32.add (i32.const 136) (local.get $w)))))
    (i32.const -1))
