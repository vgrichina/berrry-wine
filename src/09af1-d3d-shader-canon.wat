;; ps1.x -> core shader IR canonicalizer (GPU stream v2 slice 9.3).
;;
;; Input: a validated pixel IR (ABI 1) from $d3d_shader_ir_compile (ps_1_1..1_4)
;; or the 09aj fixed-origin pixel IR (flag 4). Output: a NEW IR in the same
;; ABI with header flag 8 ("core"), which every executor consumes without
;; knowing any ps1.x rule. It uses only the core subset of
;; docs/gpu-stream-v2-migration.md section 0:
;;   mov1 add2 mad4 mul5 rcp6 dp3 8 dp4 9 min10 max11 lrp18 cmp88 def81
;;   texld66 = 3 operands {dst temp, coord, sampler bank10/index s/selector
;;     0 any, 2 must be 2D, 3 must be cube}; coord modifier 0, or 9/10 = the
;;     projected form (xy divided by the RAW register's z/w, divisor 0 -> 1.0)
;;   texkill65 = 1 operand {register, selector = component mask}; kills when any
;;     masked component < 0 (this slice emits mask 7, the ps1.x rule)
;;   mov oDepth: destination bank 9 index 0 mask 1
;; Source modifiers are 0 or 1 (negate) and swizzles; destinations carry a
;; write mask and NO saturate/shift. Everything else is lowered here:
;; bias/bx2/x2/complement source modifiers, _x2.._d8/_sat, coissue, sub, cnd,
;; tex/texcoord/texkill on t#, texbem(l), texreg2*, texm3x2*, texm3x3*,
;; texdp3(tex), texcrd, texdepth, bem and phase.
;;
;; Register model of the core IR (pixel):
;;   r0..r5   guest temps (r0 is the colour result)   r8..r13  guest t# results
;;   r16..r23 guest c0..c7 clamped to [-1,1]          r24..r31 canonicalizer scratch
;;   v0..v1   colour inputs   t0..t5 interpolated texture coordinates (read-only)
;;   c0..c7   guest constants
;;   c8  = (0, 0.5, 1, 2) and c9 = (4, 8, 0.25, 0.125), DEF'd here
;;   c16+2s = bump matrix of stage s (m00, m01, m10, m11)
;;   c17+2s = (lscale, loffset, 0, 0) of stage s          (s = 0..5)
;; The bump pair is ordinary constant state the executor binds; no executor
;; has a bump concept. Guest (non-fixed) constants are clamped to [-1,1], the
;; ps1.x constant range; fixed-origin constants are emulator values, unclamped.
;;
;; Anything not handled returns 0 and bumps $d3d_canon_declines, with the
;; declined opcode in $d3d_canon_decline_op: a counted decline, never a
;; silently wrong shader. The result is freed with d3d_shader_ir_free.
  (global $d3d_canon_declines (mut i32) (i32.const 0))
  (global $d3d_canon_decline_op (mut i32) (i32.const 0))
  (global $cn_out (mut i32) (i32.const 0))
  (global $cn_n (mut i32) (i32.const 0))
  (global $cn_cap (mut i32) (i32.const 0))
  (global $cn_origin (mut i32) (i32.const 1))
  (global $cn_ps14 (mut i32) (i32.const 0))
  (global $cn_clamp (mut i32) (i32.const 0))
  (global $cn_fixed (mut i32) (i32.const 0))
  (global $cn_pad (mut i32) (i32.const 0))
  ;; d9cl: D3DTTFF_PROJECTED stages for a ps1.1-1.3 (fixed T&L): 4 bits per
  ;; stage, 3 (divide by z) or 4 (by w). A raw `tex t#` samples t# with the
  ;; core texld DZ / DW modifier (9 / 10); any other texture-addressing
  ;; instruction on such a stage declines. Set by the caller around one
  ;; canonicalization and cleared after it (09akg $d9cl_ps_emit).
  (global $cn_projected (mut i32) (i32.const 0))
  (func (export "d3d_shader_ir_canon_declines") (result i32) (global.get $d3d_canon_declines))
  (func (export "d3d_shader_ir_canon_decline_op") (result i32) (global.get $d3d_canon_decline_op))

  ;; Packed source: swizzle bits0-7, index bits8-15, bank bits16-20,
  ;; modifier bits21-24. Packed destination: mask bits0-3, index 8-15, bank 16-20.
  (func $cn_s (param $bank i32) (param $index i32) (param $swz i32) (param $mod i32) (result i32)
    (i32.or (i32.or (local.get $swz) (i32.shl (local.get $index) (i32.const 8)))
      (i32.or (i32.shl (local.get $bank) (i32.const 16)) (i32.shl (local.get $mod) (i32.const 21)))))
  (func $cn_d (param $bank i32) (param $index i32) (param $mask i32) (result i32)
    (call $cn_s (local.get $bank) (local.get $index) (local.get $mask) (i32.const 0)))
  (func $cn_r (param $index i32) (result i32) (call $cn_s (i32.const 0) (local.get $index) (i32.const 0xe4) (i32.const 0)))
  ;; Literal c8/c9 component k replicated, optionally negated.
  (func $cn_lit (param $reg i32) (param $k i32) (param $neg i32) (result i32)
    (call $cn_s (i32.const 2) (local.get $reg) (i32.mul (local.get $k) (i32.const 0x55)) (local.get $neg)))
  (func $cn_zero (result i32) (call $cn_lit (i32.const 8) (i32.const 0) (i32.const 0)))
  (func $cn_half (result i32) (call $cn_lit (i32.const 8) (i32.const 1) (i32.const 0)))
  (func $cn_one (result i32) (call $cn_lit (i32.const 8) (i32.const 2) (i32.const 0)))
  (func $cn_two (result i32) (call $cn_lit (i32.const 8) (i32.const 3) (i32.const 0)))
  (func $cn_neg (param $s i32) (result i32) (i32.xor (local.get $s) (i32.const 0x200000)))
  ;; Component k of a packed source's swizzle, replicated to all four lanes.
  (func $cn_rep (param $s i32) (param $k i32) (result i32)
    (i32.or (i32.and (local.get $s) (i32.const -256))
      (i32.mul (i32.and (i32.shr_u (local.get $s) (i32.shl (local.get $k) (i32.const 1))) (i32.const 3)) (i32.const 0x55))))
  ;; Recompose a swizzle: lane j takes the source's component (sel >> 2j)&3.
  (func $cn_swz (param $s i32) (param $sel i32) (result i32)
    (local $j i32) (local $out i32) (local $c i32)
    (loop $lanes
      (local.set $c (i32.and (i32.shr_u (local.get $sel) (i32.shl (local.get $j) (i32.const 1))) (i32.const 3)))
      (local.set $out (i32.or (local.get $out) (i32.shl
        (i32.and (i32.shr_u (local.get $s) (i32.shl (local.get $c) (i32.const 1))) (i32.const 3))
        (i32.shl (local.get $j) (i32.const 1)))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br_if $lanes (i32.lt_u (local.get $j) (i32.const 4))))
    (i32.or (i32.and (local.get $s) (i32.const -256)) (local.get $out)))

  (func $cn_operand (param $rec i32) (param $j i32) (param $s i32)
    (local $p i32)
    (local.set $p (i32.add (local.get $rec) (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 4)))))
    (i32.store (local.get $p) (i32.and (i32.shr_u (local.get $s) (i32.const 16)) (i32.const 31)))
    (i32.store offset=4 (local.get $p) (i32.and (i32.shr_u (local.get $s) (i32.const 8)) (i32.const 255)))
    (i32.store offset=8 (local.get $p) (i32.and (local.get $s) (i32.const 255)))
    (i32.store offset=12 (local.get $p) (i32.and (i32.shr_u (local.get $s) (i32.const 21)) (i32.const 15))))
  ;; Append one record; returns 0 once the output is full (caller declines).
  (func $cn_emit (param $op i32) (param $count i32) (param $d i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    (local $rec i32)
    (if (i32.ge_u (global.get $cn_n) (global.get $cn_cap)) (then (return (i32.const 0))))
    (local.set $rec (i32.add (i32.add (global.get $cn_out) (i32.const 32)) (i32.shl (global.get $cn_n) (i32.const 7))))
    (memory.fill (local.get $rec) (i32.const 0) (i32.const 128))
    (i32.store (local.get $rec) (local.get $op))
    (i32.store offset=4 (local.get $rec) (global.get $cn_origin))
    (i32.store offset=8 (local.get $rec) (local.get $count))
    (call $cn_operand (local.get $rec) (i32.const 0) (local.get $d))
    (if (i32.gt_u (local.get $count) (i32.const 1)) (then (call $cn_operand (local.get $rec) (i32.const 1) (local.get $a))))
    (if (i32.gt_u (local.get $count) (i32.const 2)) (then (call $cn_operand (local.get $rec) (i32.const 2) (local.get $b))))
    (if (i32.gt_u (local.get $count) (i32.const 3)) (then (call $cn_operand (local.get $rec) (i32.const 3) (local.get $c))))
    (global.set $cn_n (i32.add (global.get $cn_n) (i32.const 1)))
    (i32.const 1))
  (func $cn_op1 (param $op i32) (param $d i32) (param $a i32) (result i32)
    (call $cn_emit (local.get $op) (i32.const 2) (local.get $d) (local.get $a) (i32.const 0) (i32.const 0)))
  (func $cn_op2 (param $op i32) (param $d i32) (param $a i32) (param $b i32) (result i32)
    (call $cn_emit (local.get $op) (i32.const 3) (local.get $d) (local.get $a) (local.get $b) (i32.const 0)))
  (func $cn_op3 (param $op i32) (param $d i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    (call $cn_emit (local.get $op) (i32.const 4) (local.get $d) (local.get $a) (local.get $b) (local.get $c)))
  (func $cn_def (param $index i32) (param $x f32) (param $y f32) (param $z f32) (param $w f32) (result i32)
    (local $rec i32)
    (if (i32.eqz (call $cn_emit (i32.const 81) (i32.const 1) (call $cn_d (i32.const 2) (local.get $index) (i32.const 15))
      (i32.const 0) (i32.const 0) (i32.const 0))) (then (return (i32.const 0))))
    (local.set $rec (i32.add (i32.add (global.get $cn_out) (i32.const 32)) (i32.shl (i32.sub (global.get $cn_n) (i32.const 1)) (i32.const 7))))
    (i32.store offset=8 (local.get $rec) (i32.const 5))
    (i32.store offset=32 (local.get $rec) (i32.const 255)) (i32.store offset=36 (local.get $rec) (i32.reinterpret_f32 (local.get $x)))
    (i32.store offset=48 (local.get $rec) (i32.const 255)) (i32.store offset=52 (local.get $rec) (i32.reinterpret_f32 (local.get $y)))
    (i32.store offset=64 (local.get $rec) (i32.const 255)) (i32.store offset=68 (local.get $rec) (i32.reinterpret_f32 (local.get $z)))
    (i32.store offset=80 (local.get $rec) (i32.const 255)) (i32.store offset=84 (local.get $rec) (i32.reinterpret_f32 (local.get $w)))
    (i32.const 1))

  (func $cn_decline (param $op i32) (result i32)
    (global.set $d3d_canon_declines (i32.add (global.get $d3d_canon_declines) (i32.const 1)))
    (global.set $d3d_canon_decline_op (local.get $op))
    (i32.const -1))

  ;; Guest register -> core register (packed source with swizzle 0, mod 0).
  (func $cn_map (param $bank i32) (param $index i32) (result i32)
    (if (i32.eqz (local.get $bank)) (then (return (call $cn_s (i32.const 0) (local.get $index) (i32.const 0) (i32.const 0)))))
    (if (i32.eq (local.get $bank) (i32.const 1)) (then (return (call $cn_s (i32.const 1) (local.get $index) (i32.const 0) (i32.const 0)))))
    (if (i32.eq (local.get $bank) (i32.const 2)) (then
      (return (if (result i32) (global.get $cn_clamp)
        (then (call $cn_s (i32.const 0) (i32.add (i32.const 16) (local.get $index)) (i32.const 0) (i32.const 0)))
        (else (call $cn_s (i32.const 2) (local.get $index) (i32.const 0) (i32.const 0)))))))
    (if (i32.eq (local.get $bank) (i32.const 3)) (then
      (return (if (result i32) (global.get $cn_ps14)
        (then (call $cn_s (i32.const 3) (local.get $index) (i32.const 0) (i32.const 0)))
        (else (call $cn_s (i32.const 0) (i32.add (i32.const 8) (local.get $index)) (i32.const 0) (i32.const 0)))))))
    (i32.const -1))
  (func $cn_in (param $index i32) (result i32) (call $cn_s (i32.const 3) (local.get $index) (i32.const 0xe4) (i32.const 0)))
  (func $cn_bump (param $stage i32) (param $swz i32) (result i32)
    (call $cn_s (i32.const 2) (i32.add (i32.const 16) (i32.shl (local.get $stage) (i32.const 1))) (local.get $swz) (i32.const 0)))
  (func $cn_bumpl (param $stage i32) (param $swz i32) (result i32)
    (call $cn_s (i32.const 2) (i32.add (i32.const 17) (i32.shl (local.get $stage) (i32.const 1))) (local.get $swz) (i32.const 0)))

  ;; Guest source operand at $p -> core source. Modifiers other than none and
  ;; negate are materialized into scratch r(24+$k). Returns -1 to decline.
  (func $cn_source (param $p i32) (param $k i32) (result i32)
    (local $m i32) (local $mod i32) (local $x i32) (local $r i32) (local $ok i32)
    (local.set $mod (i32.load offset=12 (local.get $p)))
    (if (i32.gt_u (local.get $mod) (i32.const 255)) (then (return (call $cn_decline (i32.const 0x10000)))))
    (local.set $m (call $cn_map (i32.load (local.get $p)) (i32.load offset=4 (local.get $p))))
    (if (i32.eq (local.get $m) (i32.const -1)) (then (return (call $cn_decline (i32.const 0x10001)))))
    (local.set $x (i32.or (local.get $m) (i32.and (i32.load offset=8 (local.get $p)) (i32.const 255))))
    (if (i32.le_u (local.get $mod) (i32.const 1)) (then
      (return (i32.or (local.get $x) (i32.shl (local.get $mod) (i32.const 21))))))
    (local.set $r (call $cn_d (i32.const 0) (i32.add (i32.const 24) (local.get $k)) (i32.const 15)))
    (local.set $ok (i32.const 0))
    (block $done
      (if (i32.eq (local.get $mod) (i32.const 2)) (then ;; x - 0.5
        (local.set $ok (call $cn_op2 (i32.const 2) (local.get $r) (local.get $x) (call $cn_neg (call $cn_half)))) (br $done)))
      (if (i32.eq (local.get $mod) (i32.const 3)) (then ;; 0.5 - x
        (local.set $ok (call $cn_op2 (i32.const 2) (local.get $r) (call $cn_neg (local.get $x)) (call $cn_half))) (br $done)))
      (if (i32.eq (local.get $mod) (i32.const 4)) (then ;; 2x - 1
        (local.set $ok (call $cn_op3 (i32.const 4) (local.get $r) (local.get $x) (call $cn_two) (call $cn_neg (call $cn_one)))) (br $done)))
      (if (i32.eq (local.get $mod) (i32.const 5)) (then ;; 1 - 2x
        (local.set $ok (call $cn_op3 (i32.const 4) (local.get $r) (call $cn_neg (local.get $x)) (call $cn_two) (call $cn_one))) (br $done)))
      (if (i32.eq (local.get $mod) (i32.const 6)) (then ;; 1 - x
        (local.set $ok (call $cn_op2 (i32.const 2) (local.get $r) (call $cn_neg (local.get $x)) (call $cn_one))) (br $done)))
      (if (i32.eq (local.get $mod) (i32.const 7)) (then ;; 2x
        (local.set $ok (call $cn_op2 (i32.const 5) (local.get $r) (local.get $x) (call $cn_two))) (br $done)))
      (if (i32.eq (local.get $mod) (i32.const 8)) (then ;; -2x
        (local.set $ok (call $cn_op2 (i32.const 5) (local.get $r) (local.get $x) (call $cn_neg (call $cn_two)))) (br $done)))
      (return (call $cn_decline (i32.or (i32.const 0x20000) (local.get $mod)))))
    (if (i32.eqz (local.get $ok)) (then (return (call $cn_decline (i32.const 0x30000)))))
    (call $cn_r (i32.add (i32.const 24) (local.get $k))))

  ;; Result modifiers of a guest destination modifier word applied in place to
  ;; scratch $w (mask $mask): shift then saturate. Returns 0 on overflow.
  (func $cn_result_mods (param $w i32) (param $mask i32) (param $mod i32) (result i32)
    (local $shift i32) (local $d i32) (local $f i32)
    (local.set $d (call $cn_d (i32.const 0) (local.get $w) (local.get $mask)))
    (local.set $shift (i32.shr_s (i32.shl (local.get $mod) (i32.const 16)) (i32.const 24)))
    (if (local.get $shift) (then
      (local.set $f (block $factor (result i32)
        (if (i32.eq (local.get $shift) (i32.const 1)) (then (br $factor (call $cn_two))))
        (if (i32.eq (local.get $shift) (i32.const 2)) (then (br $factor (call $cn_lit (i32.const 9) (i32.const 0) (i32.const 0)))))
        (if (i32.eq (local.get $shift) (i32.const 3)) (then (br $factor (call $cn_lit (i32.const 9) (i32.const 1) (i32.const 0)))))
        (if (i32.eq (local.get $shift) (i32.const -1)) (then (br $factor (call $cn_half))))
        (if (i32.eq (local.get $shift) (i32.const -2)) (then (br $factor (call $cn_lit (i32.const 9) (i32.const 2) (i32.const 0)))))
        (if (i32.eq (local.get $shift) (i32.const -3)) (then (br $factor (call $cn_lit (i32.const 9) (i32.const 3) (i32.const 0)))))
        (i32.const -1)))
      (if (i32.eq (local.get $f) (i32.const -1)) (then (return (i32.const 0))))
      (if (i32.eqz (call $cn_op2 (i32.const 5) (local.get $d) (call $cn_r (local.get $w)) (local.get $f))) (then (return (i32.const 0))))))
    (if (i32.and (local.get $mod) (i32.const 1)) (then
      (if (i32.eqz (call $cn_op2 (i32.const 11) (local.get $d) (call $cn_r (local.get $w)) (call $cn_zero))) (then (return (i32.const 0))))
      (if (i32.eqz (call $cn_op2 (i32.const 10) (local.get $d) (call $cn_r (local.get $w)) (call $cn_one))) (then (return (i32.const 0))))))
    (i32.const 1))

  ;; Guest destination operand at $p -> core destination (packed, with mask).
  (func $cn_dest (param $p i32) (result i32)
    (local $m i32)
    (local.set $m (call $cn_map (i32.load (local.get $p)) (i32.load offset=4 (local.get $p))))
    (if (i32.or (i32.eq (local.get $m) (i32.const -1))
          (i32.and (i32.eq (i32.load (local.get $p)) (i32.const 2)) (i32.const 1)))
      (then (return (i32.const -1))))
    (i32.or (local.get $m) (i32.and (i32.load offset=8 (local.get $p)) (i32.const 15))))

  ;; Arithmetic instruction at $ins. $w = 0: write the destination directly
  ;; when there are no result modifiers; otherwise compute into scratch r$w
  ;; and leave the commit (mov dst, r$w) to the caller via $cn_commit.
  (func $cn_alu (param $ins i32) (param $w i32) (result i32)
    (local $op i32) (local $a i32) (local $b i32) (local $c i32) (local $d i32) (local $t i32) (local $mask i32) (local $mod i32)
    (local $nsrc i32) (local $target i32) (local $ok i32)
    (local.set $op (i32.load (local.get $ins)))
    (local.set $nsrc (i32.sub (i32.load offset=8 (local.get $ins)) (i32.const 1)))
    (local.set $d (call $cn_dest (i32.add (local.get $ins) (i32.const 16))))
    (if (i32.eq (local.get $d) (i32.const -1)) (then (return (call $cn_decline (local.get $op)))))
    (local.set $mask (i32.and (local.get $d) (i32.const 15)))
    (local.set $mod (i32.load offset=28 (local.get $ins)))
    (if (i32.ge_s (local.get $nsrc) (i32.const 1)) (then
      (local.set $a (call $cn_source (i32.add (local.get $ins) (i32.const 32)) (i32.const 0)))
      (if (i32.eq (local.get $a) (i32.const -1)) (then (return (i32.const -1))))))
    (if (i32.ge_s (local.get $nsrc) (i32.const 2)) (then
      (local.set $b (call $cn_source (i32.add (local.get $ins) (i32.const 48)) (i32.const 1)))
      (if (i32.eq (local.get $b) (i32.const -1)) (then (return (i32.const -1))))))
    (if (i32.ge_s (local.get $nsrc) (i32.const 3)) (then
      (local.set $c (call $cn_source (i32.add (local.get $ins) (i32.const 64)) (i32.const 2)))
      (if (i32.eq (local.get $c) (i32.const -1)) (then (return (i32.const -1))))))
    (local.set $target (if (result i32) (i32.or (i32.ne (local.get $w) (i32.const 0)) (i32.ne (local.get $mod) (i32.const 0)))
      (then (call $cn_d (i32.const 0) (select (local.get $w) (i32.const 30) (local.get $w)) (local.get $mask)))
      (else (local.get $d))))
    (block $lowered
      (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 1)) (i32.eq (local.get $op) (i32.const 2)))
            (i32.or (i32.or (i32.eq (local.get $op) (i32.const 4)) (i32.eq (local.get $op) (i32.const 5)))
              (i32.or (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 9)))
                (i32.or (i32.or (i32.eq (local.get $op) (i32.const 18)) (i32.eq (local.get $op) (i32.const 88)))
                  ;; min/max: GPS-private ps_1_4 IR only (glide); guest ps1.x never has them.
                  (i32.or (i32.eq (local.get $op) (i32.const 10)) (i32.eq (local.get $op) (i32.const 11)))))))
        (then (local.set $ok (call $cn_emit (local.get $op) (i32.load offset=8 (local.get $ins))
          (local.get $target) (local.get $a) (local.get $b) (local.get $c))) (br $lowered)))
      (if (i32.eq (local.get $op) (i32.const 3)) (then ;; sub = add with negated second source
        (local.set $ok (call $cn_op2 (i32.const 2) (local.get $target) (local.get $a) (call $cn_neg (local.get $b)))) (br $lowered)))
      (if (i32.eq (local.get $op) (i32.const 80)) (then
        ;; cnd: a > 0.5 ? b : c == cmp(0.5 - a, c, b). ps1.1-1.3 test a.w only.
        (if (i32.eqz (global.get $cn_ps14)) (then (local.set $a (call $cn_rep (local.get $a) (i32.const 3)))))
        (local.set $t (call $cn_d (i32.const 0) (i32.const 27) (i32.const 15)))
        (if (i32.eqz (call $cn_op2 (i32.const 2) (local.get $t) (call $cn_neg (local.get $a)) (call $cn_half))) (then (return (call $cn_decline (local.get $op)))))
        (local.set $ok (call $cn_op3 (i32.const 88) (local.get $target) (call $cn_r (i32.const 27)) (local.get $c) (local.get $b))) (br $lowered)))
      (if (i32.eq (local.get $op) (i32.const 89)) (then
        ;; bem (ps1.4): dst.rg = a.xy + (dot(B.xz, b.xy), dot(B.yw, b.xy)), B = stage dst#.
        (local.set $t (i32.load offset=20 (local.get $ins)))
        (local.set $ok (i32.and
          (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 3)) (call $cn_rep (local.get $b) (i32.const 0)) (call $cn_bump (local.get $t) (i32.const 0x44)))
          (call $cn_op3 (i32.const 4) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 3)) (call $cn_rep (local.get $b) (i32.const 1)) (call $cn_bump (local.get $t) (i32.const 0xee)) (call $cn_r (i32.const 27)))))
        (local.set $ok (i32.and (local.get $ok)
          (call $cn_op2 (i32.const 2) (local.get $target) (call $cn_r (i32.const 27)) (local.get $a)))) (br $lowered)))
      (return (call $cn_decline (local.get $op))))
    (if (i32.eqz (local.get $ok)) (then (return (call $cn_decline (local.get $op)))))
    (if (i32.and (i32.eqz (local.get $w)) (i32.ne (local.get $mod) (i32.const 0))) (then
      (if (i32.eqz (call $cn_result_mods (i32.const 30) (local.get $mask) (local.get $mod))) (then (return (call $cn_decline (local.get $op)))))
      (if (i32.eqz (call $cn_op1 (i32.const 1) (local.get $d) (call $cn_r (i32.const 30)))) (then (return (call $cn_decline (local.get $op)))))))
    (i32.const 1))
  ;; Coissue / scratch commit: modifiers on r$w, then mov dst.mask, r$w.
  (func $cn_commit (param $ins i32) (param $w i32) (result i32)
    (local $d i32)
    (local.set $d (call $cn_dest (i32.add (local.get $ins) (i32.const 16))))
    (if (i32.eqz (call $cn_result_mods (local.get $w) (i32.and (local.get $d) (i32.const 15)) (i32.load offset=28 (local.get $ins))))
      (then (return (i32.const 0))))
    (call $cn_op1 (i32.const 1) (local.get $d) (call $cn_r (local.get $w))))

  ;; oDepth = (d == 0) ? 1 : clamp(n / d, 0, 1), NaN -> 1 (texdepth, texm3x2depth).
  (func $cn_depth (param $n i32) (param $d i32) (result i32)
    (local $x i32)
    (local.set $x (call $cn_d (i32.const 0) (i32.const 29) (i32.const 1)))
    (i32.and (i32.and (i32.and
      (call $cn_op1 (i32.const 6) (local.get $x) (local.get $d))
      (call $cn_op2 (i32.const 5) (local.get $x) (local.get $n) (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 0))))
      (i32.and
        (call $cn_op2 (i32.const 11) (local.get $x) (call $cn_r (i32.const 29)) (call $cn_zero))
        (call $cn_op2 (i32.const 10) (local.get $x) (call $cn_r (i32.const 29)) (call $cn_one))))
    (i32.and (i32.and
      (call $cn_op2 (i32.const 2) (call $cn_d (i32.const 0) (i32.const 29) (i32.const 2))
        (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 0)) (call $cn_neg (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 0))))
      (call $cn_op3 (i32.const 88) (local.get $x) (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 1))
        (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 0)) (call $cn_one)))
    (i32.and (i32.and
      (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 29) (i32.const 4)) (local.get $d) (local.get $d))
      (call $cn_op3 (i32.const 88) (local.get $x) (call $cn_neg (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 2)))
        (call $cn_one) (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 0))))
      (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 9) (i32.const 0) (i32.const 1)) (call $cn_rep (call $cn_r (i32.const 29)) (i32.const 0)))))))

  ;; Reflection R = 2 dot(N,E)/dot(N,N) N - E into r28, N = r26, E = $e.
  (func $cn_reflect (param $e i32) (result i32)
    (i32.and (i32.and (i32.and
      (call $cn_op2 (i32.const 8) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 1)) (call $cn_r (i32.const 26)) (local.get $e))
      (call $cn_op2 (i32.const 8) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 2)) (call $cn_r (i32.const 26)) (call $cn_r (i32.const 26))))
      (i32.and
        (call $cn_op1 (i32.const 6) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 4)) (call $cn_rep (call $cn_r (i32.const 27)) (i32.const 1)))
        (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 1)) (call $cn_r (i32.const 27)) (call $cn_rep (call $cn_r (i32.const 27)) (i32.const 2)))))
    (i32.and (i32.and
      (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 27) (i32.const 1)) (call $cn_r (i32.const 27)) (call $cn_two))
      (call $cn_op3 (i32.const 4) (call $cn_d (i32.const 0) (i32.const 28) (i32.const 7)) (call $cn_r (i32.const 26))
        (call $cn_rep (call $cn_r (i32.const 27)) (i32.const 0)) (call $cn_neg (local.get $e))))
      (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 28) (i32.const 8)) (call $cn_zero)))))

  ;; ps1.1-1.3 texture-addressing instruction (destination t$n).
  (func $cn_texop (param $ins i32) (result i32)
    (local $op i32) (local $n i32) (local $dst i32) (local $s i32) (local $u i32) (local $ok i32) (local $sel i32)
    (local.set $op (i32.load (local.get $ins)))
    (local.set $n (i32.load offset=20 (local.get $ins)))
    (if (i32.or (i32.ne (i32.load offset=16 (local.get $ins)) (i32.const 3)) (i32.ge_u (local.get $n) (i32.const 6)))
      (then (return (call $cn_decline (local.get $op)))))
    (if (i32.ne (i32.load offset=28 (local.get $ins)) (i32.const 0)) (then (return (call $cn_decline (local.get $op)))))
    (local.set $dst (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 15)))
    (local.set $u (call $cn_d (i32.const 0) (i32.const 26) (i32.const 15)))
    ;; d9cl: projected stage (see $cn_projected).
    (local.set $sel (i32.and (i32.shr_u (global.get $cn_projected) (i32.shl (local.get $n) (i32.const 2))) (i32.const 15)))
    (if (i32.and (i32.ne (local.get $sel) (i32.const 0))
          (i32.and (i32.ne (local.get $op) (i32.const 66)) (i32.ne (local.get $op) (i32.const 64))))
      (then (return (call $cn_decline (local.get $op)))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 66)) (i32.ne (local.get $sel) (i32.const 0))) (then
      (return (call $cn_op2 (i32.const 66) (local.get $dst)
        (call $cn_s (i32.const 3) (local.get $n) (i32.const 0xe4) (select (i32.const 9) (i32.const 10) (i32.eq (local.get $sel) (i32.const 3))))
        (call $cn_s (i32.const 10) (local.get $n) (i32.const 0) (i32.const 0))))))
    (local.set $sel (i32.const 0))
    (if (i32.eq (local.get $op) (i32.const 66)) (then
      (return (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_in (local.get $n)) (call $cn_s (i32.const 10) (local.get $n) (i32.const 0) (i32.const 0))))))
    (if (i32.eq (local.get $op) (i32.const 64)) (then
      (return (i32.and (i32.and
        (call $cn_op2 (i32.const 11) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 7)) (call $cn_in (local.get $n)) (call $cn_zero))
        (call $cn_op2 (i32.const 10) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 7)) (call $cn_r (i32.add (i32.const 8) (local.get $n))) (call $cn_one)))
        (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 8)) (call $cn_one))))))
    (if (i32.eq (local.get $op) (i32.const 65)) (then
      ;; ps1.1-1.3 TEXKILL tests the interpolated coordinates, not t# data.
      (return (call $cn_emit (i32.const 65) (i32.const 1) (call $cn_d (i32.const 3) (local.get $n) (i32.const 7)) (i32.const 0) (i32.const 0) (i32.const 0)))))
    ;; All remaining ops read a source t# register (operand 1).
    (local.set $s (call $cn_source (i32.add (local.get $ins) (i32.const 32)) (i32.const 0)))
    (if (i32.eq (local.get $s) (i32.const -1)) (then (return (i32.const -1))))
    (local.set $sel (call $cn_s (i32.const 10) (local.get $n) (i32.const 2) (i32.const 0)))
    (block $done
      (if (i32.or (i32.eq (local.get $op) (i32.const 67)) (i32.eq (local.get $op) (i32.const 68))) (then
        (local.set $ok (i32.and (i32.and
          (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 25) (i32.const 3)) (call $cn_rep (local.get $s) (i32.const 0)) (call $cn_bump (local.get $n) (i32.const 0x44)))
          (call $cn_op3 (i32.const 4) (call $cn_d (i32.const 0) (i32.const 25) (i32.const 3)) (call $cn_rep (local.get $s) (i32.const 1)) (call $cn_bump (local.get $n) (i32.const 0xee)) (call $cn_r (i32.const 25))))
          (i32.and (i32.and
            (call $cn_op2 (i32.const 2) (call $cn_d (i32.const 0) (i32.const 25) (i32.const 3)) (call $cn_r (i32.const 25)) (call $cn_in (local.get $n)))
            (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 25) (i32.const 12)) (call $cn_zero)))
            (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_r (i32.const 25)) (local.get $sel)))))
        (if (i32.eq (local.get $op) (i32.const 68)) (then
          (local.set $ok (i32.and (local.get $ok) (call $cn_op3 (i32.const 4) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 1))
            (call $cn_rep (local.get $s) (i32.const 2)) (call $cn_bumpl (local.get $n) (i32.const 0)) (call $cn_bumpl (local.get $n) (i32.const 0x55)))))
          (if (global.get $cn_fixed)
            (then ;; fixed-origin TEXBEML: clamp luminance, preserve sampled alpha
              (local.set $ok (i32.and (i32.and (local.get $ok)
                (call $cn_op2 (i32.const 11) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 1)) (call $cn_r (i32.const 26)) (call $cn_zero)))
                (i32.and (call $cn_op2 (i32.const 10) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 1)) (call $cn_r (i32.const 26)) (call $cn_one))
                  (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 7))
                    (call $cn_r (i32.add (i32.const 8) (local.get $n))) (call $cn_rep (call $cn_r (i32.const 26)) (i32.const 0)))))))
            (else (local.set $ok (i32.and (local.get $ok)
              (call $cn_op2 (i32.const 5) (local.get $dst) (call $cn_r (i32.add (i32.const 8) (local.get $n))) (call $cn_rep (call $cn_r (i32.const 26)) (i32.const 0)))))))))
        (br $done)))
      (if (i32.eq (local.get $op) (i32.const 69)) (then ;; texreg2ar: (src.a, src.r)
        (local.set $ok (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_swz (local.get $s) (i32.const 0x03)) (local.get $sel))) (br $done)))
      (if (i32.eq (local.get $op) (i32.const 70)) (then ;; texreg2gb: (src.g, src.b)
        (local.set $ok (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_swz (local.get $s) (i32.const 0xa9)) (local.get $sel))) (br $done)))
      (if (i32.eq (local.get $op) (i32.const 82)) (then ;; texreg2rgb: (src.r, src.g, src.b), 2D or cube
        (local.set $ok (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_swz (local.get $s) (i32.const 0xa4))
          (call $cn_s (i32.const 10) (local.get $n) (i32.const 0) (i32.const 0)))) (br $done)))
      (if (i32.eq (local.get $op) (i32.const 85)) (then ;; texdp3: dot replicated
        (local.set $ok (call $cn_op2 (i32.const 8) (local.get $dst) (local.get $s) (call $cn_in (local.get $n)))) (br $done)))
      (if (i32.eq (local.get $op) (i32.const 83)) (then ;; texdp3tex: sample (dot, 0)
        (local.set $ok (i32.and (i32.and
          (call $cn_op2 (i32.const 8) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 1)) (local.get $s) (call $cn_in (local.get $n)))
          (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 14)) (call $cn_zero)))
          (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_r (i32.const 26)) (local.get $sel)))) (br $done)))
      (if (i32.or (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 73))) (then
        ;; PAD rows: u (then v) dotted with this stage's ORIGINAL coordinates.
        (if (i32.gt_u (global.get $cn_pad) (i32.const 1)) (then (return (call $cn_decline (local.get $op)))))
        (local.set $ok (call $cn_op2 (i32.const 8) (call $cn_d (i32.const 0) (i32.const 26) (i32.shl (i32.const 1) (global.get $cn_pad)))
          (local.get $s) (call $cn_in (local.get $n))))
        (global.set $cn_pad (i32.add (global.get $cn_pad) (i32.const 1))) (br $done)))
      (if (i32.or (i32.eq (local.get $op) (i32.const 72)) (i32.eq (local.get $op) (i32.const 84))) (then
        (if (i32.ne (global.get $cn_pad) (i32.const 1)) (then (return (call $cn_decline (local.get $op)))))
        (global.set $cn_pad (i32.const 0))
        (local.set $ok (call $cn_op2 (i32.const 8) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 2)) (local.get $s) (call $cn_in (local.get $n))))
        (if (i32.eq (local.get $op) (i32.const 84)) (then
          (local.set $ok (i32.and (local.get $ok) (call $cn_depth (call $cn_rep (call $cn_r (i32.const 26)) (i32.const 0)) (call $cn_rep (call $cn_r (i32.const 26)) (i32.const 1)))))
          (br $done)))
        (local.set $ok (i32.and (i32.and (local.get $ok)
          (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 12)) (call $cn_zero)))
          (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_r (i32.const 26)) (local.get $sel)))) (br $done)))
      (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 74)) (i32.eq (local.get $op) (i32.const 86)))
            (i32.or (i32.eq (local.get $op) (i32.const 75)) (i32.eq (local.get $op) (i32.const 76)))) (then
        (if (i32.ne (global.get $cn_pad) (i32.const 2)) (then (return (call $cn_decline (local.get $op)))))
        (global.set $cn_pad (i32.const 0))
        (local.set $ok (call $cn_op2 (i32.const 8) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 4)) (local.get $s) (call $cn_in (local.get $n))))
        (if (i32.eq (local.get $op) (i32.const 86)) (then ;; texm3x3: (u, v, w, 1)
          (local.set $ok (i32.and (i32.and (local.get $ok)
            (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 7)) (call $cn_r (i32.const 26))))
            (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $n)) (i32.const 8)) (call $cn_one))))
          (br $done)))
        (local.set $sel (call $cn_s (i32.const 10) (local.get $n) (i32.const 3) (i32.const 0)))
        (if (i32.eq (local.get $op) (i32.const 74)) (then
          (local.set $ok (i32.and (i32.and (local.get $ok)
            (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 26) (i32.const 8)) (call $cn_zero)))
            (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_r (i32.const 26)) (local.get $sel))))
          (br $done)))
        (if (i32.eq (local.get $op) (i32.const 75)) (then ;; texm3x3spec: constant eye vector
          (local.set $u (call $cn_source (i32.add (local.get $ins) (i32.const 48)) (i32.const 1)))
          (if (i32.eq (local.get $u) (i32.const -1)) (then (return (i32.const -1))))))
        (if (i32.eq (local.get $op) (i32.const 76)) (then ;; texm3x3vspec: eye from the three rows' q
          (if (i32.lt_u (local.get $n) (i32.const 2)) (then (return (call $cn_decline (local.get $op)))))
          (local.set $ok (i32.and (i32.and (local.get $ok)
            (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 29) (i32.const 1)) (call $cn_rep (call $cn_in (i32.sub (local.get $n) (i32.const 2))) (i32.const 3))))
            (i32.and
              (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 29) (i32.const 2)) (call $cn_rep (call $cn_in (i32.sub (local.get $n) (i32.const 1))) (i32.const 3)))
              (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.const 29) (i32.const 4)) (call $cn_rep (call $cn_in (local.get $n)) (i32.const 3))))))
          (local.set $u (call $cn_r (i32.const 29)))))
        (local.set $ok (i32.and (i32.and (local.get $ok) (call $cn_reflect (local.get $u)))
          (call $cn_op2 (i32.const 66) (local.get $dst) (call $cn_r (i32.const 28)) (local.get $sel))))
        (br $done)))
      (return (call $cn_decline (local.get $op))))
    (if (i32.eqz (local.get $ok)) (then (return (call $cn_decline (local.get $op)))))
    (i32.const 1))

  ;; ps1.4 texcrd / texld / texkill / texdepth / phase.
  (func $cn_tex14 (param $ins i32) (result i32)
    (local $op i32) (local $n i32) (local $d i32) (local $src i32) (local $mod i32) (local $raw i32) (local $den i32) (local $mask i32)
    (local $rmod i32) (local $final i32)
    (local.set $op (i32.load (local.get $ins)))
    (local.set $n (i32.load offset=20 (local.get $ins)))
    (if (i32.eq (local.get $op) (i32.const 65533)) (then
      (local.set $n (i32.const 0))
      (loop $alpha
        (if (i32.eqz (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (local.get $n) (i32.const 8)) (call $cn_zero)))
          (then (return (call $cn_decline (local.get $op)))))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (br_if $alpha (i32.lt_u (local.get $n) (i32.const 6))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 65)) (then
      (local.set $d (call $cn_map (i32.load offset=16 (local.get $ins)) (local.get $n)))
      (if (i32.eq (local.get $d) (i32.const -1)) (then (return (call $cn_decline (local.get $op)))))
      (if (i32.eqz (call $cn_emit (i32.const 65) (i32.const 1) (i32.or (local.get $d) (i32.const 7)) (i32.const 0) (i32.const 0) (i32.const 0)))
        (then (return (call $cn_decline (local.get $op)))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 87)) (then ;; texdepth r5: depth = r5.r / r5.g
      (if (i32.eqz (call $cn_depth (call $cn_s (i32.const 0) (local.get $n) (i32.const 0x00) (i32.const 0))
          (call $cn_s (i32.const 0) (local.get $n) (i32.const 0x55) (i32.const 0))))
        (then (return (call $cn_decline (local.get $op)))))
      (return (i32.const 1))))
    ;; Result modifiers: texld only (GPS producers emit texld_sat, 09abg). The
    ;; sample lands in scratch r30, gets the modifiers, then commits to dst.
    (local.set $rmod (i32.load offset=28 (local.get $ins)))
    (if (i32.and (i32.ne (local.get $rmod) (i32.const 0)) (i32.ne (local.get $op) (i32.const 66)))
      (then (return (call $cn_decline (local.get $op)))))
    (local.set $d (call $cn_dest (i32.add (local.get $ins) (i32.const 16))))
    (if (i32.eq (local.get $d) (i32.const -1)) (then (return (call $cn_decline (local.get $op)))))
    (local.set $mask (i32.and (local.get $d) (i32.const 15)))
    (local.set $final (local.get $d))
    (if (local.get $rmod) (then (local.set $d (call $cn_d (i32.const 0) (i32.const 30) (i32.const 15)))))
    (local.set $mod (i32.load offset=44 (local.get $ins)))
    (local.set $raw (call $cn_map (i32.load offset=32 (local.get $ins)) (i32.load offset=36 (local.get $ins))))
    (if (i32.or (i32.eq (local.get $raw) (i32.const -1))
          (i32.and (i32.ne (local.get $mod) (i32.const 0)) (i32.and (i32.ne (local.get $mod) (i32.const 9)) (i32.ne (local.get $mod) (i32.const 10)))))
      (then (return (call $cn_decline (local.get $op)))))
    (local.set $src (i32.or (local.get $raw) (i32.and (i32.load offset=40 (local.get $ins)) (i32.const 255))))
    (if (i32.eq (local.get $op) (i32.const 66)) (then
      (if (i32.eqz (call $cn_op2 (i32.const 66) (i32.or (i32.and (local.get $d) (i32.const -16)) (i32.const 15))
          (i32.or (local.get $src) (i32.shl (local.get $mod) (i32.const 21)))
          (call $cn_s (i32.const 10) (local.get $n) (i32.const 0) (i32.const 0))))
        (then (return (call $cn_decline (local.get $op)))))
      (if (local.get $rmod) (then
        (if (i32.eqz (call $cn_result_mods (i32.const 30) (local.get $mask) (local.get $rmod))) (then (return (call $cn_decline (local.get $op)))))
        (if (i32.eqz (call $cn_op1 (i32.const 1) (local.get $final) (call $cn_r (i32.const 30)))) (then (return (call $cn_decline (local.get $op)))))))
      (return (i32.const 1))))
    (if (i32.ne (local.get $op) (i32.const 64)) (then (return (call $cn_decline (local.get $op)))))
    ;; texcrd: (xyz, 0) or projected (x/q, y/q, 0, 0) with q == 0 -> (1, 1).
    (if (i32.eqz (local.get $mod)) (then
      (if (i32.eqz (i32.and
          (call $cn_op1 (i32.const 1) (i32.or (i32.and (local.get $d) (i32.const -16)) (i32.and (local.get $mask) (i32.const 7))) (local.get $src))
          (call $cn_op1 (i32.const 1) (i32.or (i32.and (local.get $d) (i32.const -16)) (i32.const 8)) (call $cn_zero))))
        (then (return (call $cn_decline (local.get $op)))))
      (return (i32.const 1))))
    (local.set $den (i32.or (local.get $raw) (select (i32.const 0xaa) (i32.const 0xff) (i32.eq (local.get $mod) (i32.const 9)))))
    (if (i32.eqz (i32.and (i32.and (i32.and
        (call $cn_op1 (i32.const 6) (call $cn_d (i32.const 0) (i32.const 24) (i32.const 1)) (local.get $den))
        (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 24) (i32.const 3)) (local.get $src) (call $cn_rep (call $cn_r (i32.const 24)) (i32.const 0))))
        (i32.and
          (call $cn_op2 (i32.const 5) (call $cn_d (i32.const 0) (i32.const 24) (i32.const 4)) (local.get $den) (local.get $den))
          (call $cn_op3 (i32.const 88) (call $cn_d (i32.const 0) (i32.const 24) (i32.const 3)) (call $cn_neg (call $cn_rep (call $cn_r (i32.const 24)) (i32.const 2)))
            (call $cn_one) (call $cn_r (i32.const 24)))))
      (i32.and
        (call $cn_op1 (i32.const 1) (i32.or (i32.and (local.get $d) (i32.const -16)) (i32.and (local.get $mask) (i32.const 3))) (call $cn_r (i32.const 24)))
        (call $cn_op1 (i32.const 1) (i32.or (i32.and (local.get $d) (i32.const -16)) (i32.const 12)) (call $cn_zero)))))
      (then (return (call $cn_decline (local.get $op)))))
    (i32.const 1))

  (func $cn_is_alu (param $op i32) (result i32)
    (i32.or (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 1)) (i32.le_u (local.get $op) (i32.const 5)))
        (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 9))))
      (i32.or (i32.or (i32.eq (local.get $op) (i32.const 18)) (i32.eq (local.get $op) (i32.const 80)))
        (i32.or (i32.or (i32.eq (local.get $op) (i32.const 88)) (i32.eq (local.get $op) (i32.const 89)))
          (i32.or (i32.eq (local.get $op) (i32.const 10)) (i32.eq (local.get $op) (i32.const 11)))))))

  (func $d3d_shader_ir_canonicalize (export "d3d_shader_ir_canonicalize") (param $ir i32) (result i32)
    (local $n i32) (local $i i32) (local $ins i32) (local $op i32) (local $j i32) (local $p i32)
    (local $used i32) (local $cused i32) (local $bytes i32) (local $guest i32) (local $base i32) (local $flags i32)
    (local $r i32) (local $next i32)
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $ir) (i32.const 32)))
      (then (drop (call $cn_decline (i32.const 0x40000))) (return (i32.const 0))))
    (if (i32.or (i32.ne (i32.load (local.get $ir)) (i32.const 0x44534952)) (i32.ne (i32.load offset=4 (local.get $ir)) (i32.const 1)))
      (then (drop (call $cn_decline (i32.const 0x40000))) (return (i32.const 0))))
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $ir)
          (i32.add (i32.const 32) (i32.shl (i32.and (i32.load offset=16 (local.get $ir)) (i32.const 0xffff)) (i32.const 7)))))
      (then (drop (call $cn_decline (i32.const 0x40000))) (return (i32.const 0))))
    ;; Vertex IR and already-core sampler-naming pixel IR: the VS section below.
    (if (i32.eqz (i32.load offset=8 (local.get $ir))) (then (return (call $d3d_vs_canonicalize (local.get $ir)))))
    (if (i32.eq (i32.load offset=12 (local.get $ir)) (i32.const 0xffff0200)) (then (return (call $d3d_ps_core_copy (local.get $ir)))))
    (local.set $flags (i32.load offset=28 (local.get $ir)))
    (if (i32.or (i32.ne (i32.load offset=8 (local.get $ir)) (i32.const 1))
          ;; Bit0 (relative) is admitted: GPS producers set it, and ps1.x has no
          ;; relative operand -- one would carry modifier bit 256 and decline.
          (i32.or (i32.ne (i32.and (local.get $flags) (i32.const -8)) (i32.const 0))
            (i32.or (i32.lt_u (i32.load offset=12 (local.get $ir)) (i32.const 0xffff0101))
              (i32.gt_u (i32.load offset=12 (local.get $ir)) (i32.const 0xffff0104)))))
      (then (drop (call $cn_decline (i32.const 0x40001))) (return (i32.const 0))))
    (local.set $n (i32.load offset=16 (local.get $ir)))
    (if (i32.gt_u (local.get $n) (i32.const 1024)) (then (drop (call $cn_decline (i32.const 0x40002))) (return (i32.const 0))))
    (global.set $cn_ps14 (i32.eq (i32.load offset=12 (local.get $ir)) (i32.const 0xffff0104)))
    (global.set $cn_fixed (i32.ne (i32.and (local.get $flags) (i32.const 4)) (i32.const 0)))
    (global.set $cn_clamp (i32.eqz (global.get $cn_fixed)))
    (global.set $cn_pad (i32.const 0))
    ;; Registers referenced: bit k of $used = t#k, bit k of $cused = c#k read.
    (block $scanned (loop $scan
      (br_if $scanned (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (if (i32.ne (i32.load (local.get $ins)) (i32.const 81)) (then
        (local.set $j (i32.const 0))
        (block $ops (loop $operands
          (br_if $ops (i32.ge_u (local.get $j) (i32.load offset=8 (local.get $ins))))
          (br_if $ops (i32.ge_u (local.get $j) (i32.const 5)))
          (local.set $p (i32.add (local.get $ins) (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 4)))))
          (if (i32.gt_u (i32.load offset=4 (local.get $p)) (i32.const 7)) (then
            (if (i32.le_u (i32.load (local.get $p)) (i32.const 3)) (then (drop (call $cn_decline (i32.const 0x40003))) (return (i32.const 0))))))
          (if (i32.eq (i32.load (local.get $p)) (i32.const 3))
            (then (local.set $used (i32.or (local.get $used) (i32.shl (i32.const 1) (i32.load offset=4 (local.get $p)))))))
          (if (i32.and (i32.eq (i32.load (local.get $p)) (i32.const 2)) (i32.ne (local.get $j) (i32.const 0)))
            (then (local.set $cused (i32.or (local.get $cused) (i32.shl (i32.const 1) (i32.load offset=4 (local.get $p)))))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $operands)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    ;; Worst case: 40 records per guest instruction plus a 32-record prologue.
    (global.set $cn_cap (i32.add (i32.mul (local.get $n) (i32.const 40)) (i32.const 32)))
    (local.set $bytes (i32.add (i32.const 32) (i32.shl (global.get $cn_cap) (i32.const 7))))
    (if (i32.gt_u (i32.add (global.get $d3d_ir_live_bytes) (local.get $bytes)) (i32.const 4194304))
      (then (drop (call $cn_decline (i32.const 0x40004))) (return (i32.const 0))))
    (local.set $guest (call $heap_alloc (i32.add (local.get $bytes) (i32.const 16))))
    (if (i32.eqz (local.get $guest)) (then (drop (call $cn_decline (i32.const 0x40004))) (return (i32.const 0))))
    (local.set $base (call $g2w (local.get $guest)))
    (global.set $cn_out (i32.add (local.get $base) (i32.const 16)))
    (global.set $cn_n (i32.const 0))
    (global.set $cn_origin (i32.const 1))
    (memory.fill (global.get $cn_out) (i32.const 0) (i32.const 32))
    (local.set $r (i32.const 1))
    (block $fail
      ;; Prologue: literals, the guest's own DEFs, t# result copies, clamped constants.
      (br_if $fail (i32.eqz (call $cn_def (i32.const 8) (f32.const 0) (f32.const 0.5) (f32.const 1) (f32.const 2))))
      (br_if $fail (i32.eqz (call $cn_def (i32.const 9) (f32.const 4) (f32.const 8) (f32.const 0.25) (f32.const 0.125))))
      (local.set $i (i32.const 0))
      (block $defs (loop $def
        (br_if $defs (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
        (if (i32.eq (i32.load (local.get $ins)) (i32.const 81)) (then
          (if (i32.or (i32.ne (i32.load offset=16 (local.get $ins)) (i32.const 2)) (i32.gt_u (i32.load offset=20 (local.get $ins)) (i32.const 7)))
            (then (local.set $r (call $cn_decline (i32.const 81))) (br $fail)))
          (br_if $fail (i32.ge_u (global.get $cn_n) (global.get $cn_cap)))
          (memory.copy (i32.add (i32.add (global.get $cn_out) (i32.const 32)) (i32.shl (global.get $cn_n) (i32.const 7))) (local.get $ins) (i32.const 128))
          (i32.store offset=4 (i32.add (i32.add (global.get $cn_out) (i32.const 32)) (i32.shl (global.get $cn_n) (i32.const 7))) (i32.const 1))
          (global.set $cn_n (i32.add (global.get $cn_n) (i32.const 1)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $def)))
      (local.set $i (i32.const 0))
      (loop $copies
        (if (i32.and (i32.eqz (global.get $cn_ps14)) (i32.ne (i32.and (local.get $used) (i32.shl (i32.const 1) (local.get $i))) (i32.const 0))) (then
          (br_if $fail (i32.eqz (call $cn_op1 (i32.const 1) (call $cn_d (i32.const 0) (i32.add (i32.const 8) (local.get $i)) (i32.const 15)) (call $cn_in (local.get $i)))))))
        (if (i32.and (global.get $cn_clamp) (i32.ne (i32.and (local.get $cused) (i32.shl (i32.const 1) (local.get $i))) (i32.const 0))) (then
          (br_if $fail (i32.eqz (call $cn_op2 (i32.const 11) (call $cn_d (i32.const 0) (i32.add (i32.const 16) (local.get $i)) (i32.const 15))
            (call $cn_s (i32.const 2) (local.get $i) (i32.const 0xe4) (i32.const 0)) (call $cn_neg (call $cn_one)))))
          (br_if $fail (i32.eqz (call $cn_op2 (i32.const 10) (call $cn_d (i32.const 0) (i32.add (i32.const 16) (local.get $i)) (i32.const 15))
            (call $cn_r (i32.add (i32.const 16) (local.get $i))) (call $cn_one))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $copies (i32.lt_u (local.get $i) (i32.const 8))))
      ;; Body.
      (local.set $i (i32.const 0))
      (block $body (loop $each
        (br_if $body (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
        (local.set $op (i32.load (local.get $ins)))
        (global.set $cn_origin (i32.load offset=4 (local.get $ins)))
        (local.set $next (i32.add (local.get $i) (i32.const 1)))
        (block $handled
          (br_if $handled (i32.or (i32.eqz (local.get $op)) (i32.eq (local.get $op) (i32.const 81))))
          (if (i32.load offset=12 (local.get $ins)) (then (local.set $r (call $cn_decline (i32.const 0x50000))) (br $fail)))
          (if (call $cn_is_alu (local.get $op)) (then
            ;; A coissued successor reads the pre-pair state: compute both
            ;; into r30/r31, then commit both.
            (if (i32.and (i32.lt_u (local.get $next) (local.get $n))
                  (i32.ne (i32.load offset=12 (i32.add (local.get $ins) (i32.const 128))) (i32.const 0))) (then
              (if (i32.eqz (call $cn_is_alu (i32.load (i32.add (local.get $ins) (i32.const 128)))))
                (then (local.set $r (call $cn_decline (i32.const 0x50001))) (br $fail)))
              (local.set $r (call $cn_alu (local.get $ins) (i32.const 30)))
              (br_if $fail (i32.ne (local.get $r) (i32.const 1)))
              (global.set $cn_origin (i32.load offset=132 (local.get $ins)))
              (local.set $r (call $cn_alu (i32.add (local.get $ins) (i32.const 128)) (i32.const 31)))
              (br_if $fail (i32.ne (local.get $r) (i32.const 1)))
              (local.set $r (i32.and (call $cn_commit (local.get $ins) (i32.const 30))
                (call $cn_commit (i32.add (local.get $ins) (i32.const 128)) (i32.const 31))))
              (if (i32.eqz (local.get $r)) (then (local.set $r (call $cn_decline (i32.const 0x50002))) (br $fail)))
              (local.set $next (i32.add (local.get $i) (i32.const 2)))
              (br $handled)))
            (local.set $r (call $cn_alu (local.get $ins) (i32.const 0)))
            (br_if $fail (i32.ne (local.get $r) (i32.const 1)))
            (br $handled)))
          (if (global.get $cn_ps14) (then
            (if (global.get $cn_projected) (then (local.set $r (call $cn_decline (local.get $op))) (br $fail))) ;; d9cl
            (local.set $r (call $cn_tex14 (local.get $ins)))
            (br_if $fail (i32.ne (local.get $r) (i32.const 1)))
            (br $handled)))
          (if (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 64)) (i32.le_u (local.get $op) (i32.const 76)))
                (i32.and (i32.ge_u (local.get $op) (i32.const 82)) (i32.le_u (local.get $op) (i32.const 86)))) (then
            (local.set $r (call $cn_texop (local.get $ins)))
            (br_if $fail (i32.ne (local.get $r) (i32.const 1)))
            (br $handled)))
          (local.set $r (call $cn_decline (local.get $op))) (br $fail))
        (local.set $i (local.get $next)) (br $each)))
      (if (global.get $cn_pad) (then (local.set $r (call $cn_decline (i32.const 0x50003))) (br $fail)))
      ;; Publish: same ABI header, flag 8 (core) plus the fixed-origin bit.
      (i32.store (global.get $cn_out) (i32.const 0x44534952))
      (i32.store offset=4 (global.get $cn_out) (i32.const 1))
      (i32.store offset=8 (global.get $cn_out) (i32.const 1))
      (i32.store offset=12 (global.get $cn_out) (i32.load offset=12 (local.get $ir)))
      (i32.store offset=16 (global.get $cn_out) (global.get $cn_n))
      (i32.store offset=20 (global.get $cn_out) (i32.load offset=20 (local.get $ir)))
      (i32.store offset=24 (global.get $cn_out) (i32.add (i32.const 32) (i32.shl (global.get $cn_n) (i32.const 7))))
      (i32.store offset=28 (global.get $cn_out) (i32.or (i32.const 8) (i32.and (local.get $flags) (i32.const 4))))
      (i32.store (local.get $base) (global.get $d3d_ir_head))
      (i32.store offset=4 (local.get $base) (local.get $guest))
      (i32.store offset=8 (local.get $base) (local.get $bytes))
      (global.set $d3d_ir_live_bytes (i32.add (global.get $d3d_ir_live_bytes) (local.get $bytes)))
      (global.set $d3d_ir_head (local.get $base))
      (return (global.get $cn_out)))
    (if (i32.eq (local.get $r) (i32.const 1)) (then (drop (call $cn_decline (i32.const 0x40005)))))
    (call $heap_free (local.get $guest))
    (i32.const 0))

;; vs_1_x / vs_2_0 -> core VERTEX shader IR (GPU stream v2 slice 9.4b), and
;; the core pixel IR version 0xffff0200 pass-through (sampler-naming ABI).
;;
;; Reached from $d3d_shader_ir_canonicalize (above) for a stage-0 IR (from
;; $d3d_shader_ir_compile vs_1_0/1_1, or the private vs_2_0 IR) and for a
;; pixel IR that is already core at version 0xffff0200. Output: a NEW IR in
;; ABI 1, stage 0, version 0xfffe0200, header flags 8 (core) | guest bit0.
;; docs/gpu-stream-v2.md "Vertex shaders" is the contract. Core vertex ops:
;;   mov1 add2 mad4 mul5 rcp6 rsq7 dp3 8 dp4 9 min10 max11 slt12 sge13
;;   exp14 log15 frc19 mova46 (round to nearest even) cmp88 (per component
;;   a >= 0 ? b : c, a pure select, destination never a source) dcl31 def81
;; rcp/rsq/exp/log sources always carry a replicate swizzle. Source modifiers
;; are 0 or 1 (negate) plus the relative bits (256 = c[a0.? + n], component
;; in bits 11..12; an index outside c0..c255 reads 0). Destinations carry a
;; write mask and optional saturate (modifier 1), never a shift.
;; Registers: r0..r11 guest temps, r28..r31 scratch of this file
;;   (r31 = (0, 0.5, 1, 2) and r30.x = 127.99609375 when a lowering needs
;;   them; built from c0 by slt/sge, so no constant slot is taken from the
;;   guest), v0..v15 inputs each named by a DCL, c0..c255, a0,
;;   oPos (bank 4 index 0), oFog (4/1, .x), oPts (4/2, .x), oD0..1, oT0..7.
;; Lowered here: sub, abs, lrp, lit, dst, expp, logp, m4x4/m4x3/m3x4/m3x3/
;; m3x2, pow, nrm, crs, vs_1_x "mov a0" (floor, then mova), and the 09aj
;; fixed-function cnd (via cmp).
;; Declined (counted, never silently wrong): flow control, sincos, sgn,
;; defb/defi, a source modifier other than negate, a result shift, and a v#
;; read that no DCL names (the executor binds inputs only by declaration).
  (global $vc_out (mut i32) (i32.const 0))
  (global $vc_n (mut i32) (i32.const 0))
  (global $vc_cap (mut i32) (i32.const 0))
  (global $vc_origin (mut i32) (i32.const 1))

  ;; Append one zeroed record with $count operands; 0 when full.
  (func $vc_rec (param $op i32) (param $count i32) (result i32)
    (local $rec i32)
    (if (i32.ge_u (global.get $vc_n) (global.get $vc_cap)) (then (return (i32.const 0))))
    (local.set $rec (i32.add (i32.add (global.get $vc_out) (i32.const 32)) (i32.shl (global.get $vc_n) (i32.const 7))))
    (memory.fill (local.get $rec) (i32.const 0) (i32.const 128))
    (i32.store (local.get $rec) (local.get $op))
    (i32.store offset=4 (local.get $rec) (global.get $vc_origin))
    (i32.store offset=8 (local.get $rec) (local.get $count))
    (global.set $vc_n (i32.add (global.get $vc_n) (i32.const 1)))
    (local.get $rec))
  (func $vc_slot (param $rec i32) (param $j i32) (result i32)
    (i32.add (local.get $rec) (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 4)))))
  (func $vc_put (param $rec i32) (param $j i32) (param $bank i32) (param $index i32) (param $sel i32) (param $mod i32)
    (local $p i32)
    (local.set $p (call $vc_slot (local.get $rec) (local.get $j)))
    (i32.store (local.get $p) (local.get $bank))
    (i32.store offset=4 (local.get $p) (local.get $index))
    (i32.store offset=8 (local.get $p) (local.get $sel))
    (i32.store offset=12 (local.get $p) (local.get $mod)))
  ;; Swizzle composition: component i reads $sel's component $pat[i].
  (func $vc_compose (param $sel i32) (param $pat i32) (result i32)
    (local $i i32) (local $r i32)
    (loop $each
      (local.set $r (i32.or (local.get $r) (i32.shl
        (i32.and (i32.shr_u (local.get $sel)
          (i32.shl (i32.and (i32.shr_u (local.get $pat) (i32.shl (local.get $i) (i32.const 1))) (i32.const 3)) (i32.const 1)))
          (i32.const 3))
        (i32.shl (local.get $i) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $each (i32.lt_u (local.get $i) (i32.const 4))))
    (local.get $r))
  ;; Guest source operand $p into slot $j: swizzle composed with $pat (0xe4 =
  ;; unchanged), negate toggled by $neg, register index advanced by $row.
  (func $vc_src (param $rec i32) (param $j i32) (param $p i32) (param $pat i32) (param $neg i32) (param $row i32)
    (call $vc_put (local.get $rec) (local.get $j) (i32.load (local.get $p))
      (i32.add (i32.load offset=4 (local.get $p)) (local.get $row))
      (call $vc_compose (i32.load offset=8 (local.get $p)) (local.get $pat))
      (i32.xor (i32.load offset=12 (local.get $p)) (local.get $neg))))
  ;; Replicate component $k of guest source $p (its swizzle applied first).
  (func $vc_srck (param $rec i32) (param $j i32) (param $p i32) (param $k i32)
    (call $vc_src (local.get $rec) (local.get $j) (local.get $p) (i32.mul (local.get $k) (i32.const 85)) (i32.const 0) (i32.const 0)))
  ;; Guest destination $p into slot 0 unchanged (mask, saturate).
  (func $vc_dst (param $rec i32) (param $p i32)
    (memory.copy (call $vc_slot (local.get $rec) (i32.const 0)) (local.get $p) (i32.const 16)))
  ;; Scratch/literal register helpers: temp $r with swizzle $sel, modifier $mod.
  (func $vc_t (param $rec i32) (param $j i32) (param $r i32) (param $sel i32) (param $mod i32)
    (call $vc_put (local.get $rec) (local.get $j) (i32.const 0) (local.get $r) (local.get $sel) (local.get $mod)))
  ;; One-source / two-source scratch ops: dst temp $d mask $m.
  (func $vc_op (param $op i32) (param $count i32) (param $d i32) (param $m i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vc_rec (local.get $op) (local.get $count)))
    (if (local.get $rec) (then (call $vc_put (local.get $rec) (i32.const 0) (i32.const 0) (local.get $d) (local.get $m) (i32.const 0))))
    (local.get $rec))
  ;; mov guest-dest, r28 (the guest's mask and saturate).
  (func $vc_commit (param $p i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vc_rec (i32.const 1) (i32.const 2)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_dst (local.get $rec) (local.get $p))
    (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xe4) (i32.const 0))
    (i32.const 1))
  ;; Literal sources: r31 = (0, .5, 1, 2), r30.x = 127.99609375.
  (func $vc_lit (param $rec i32) (param $j i32) (param $k i32) (param $mod i32)
    (call $vc_t (local.get $rec) (local.get $j) (i32.const 31) (i32.mul (local.get $k) (i32.const 85)) (local.get $mod)))

  ;; Prologue: r31 from c0 (any finite c0: c0.x < c0.x is 0, >= is 1).
  (func $vc_prologue (param $lit i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vc_op (i32.const 12) (i32.const 3) (i32.const 31) (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_put (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $vc_put (local.get $rec) (i32.const 2) (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 13) (i32.const 3) (i32.const 31) (i32.const 4)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_put (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $vc_put (local.get $rec) (i32.const 2) (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 31) (i32.const 8)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0))
    (call $vc_lit (local.get $rec) (i32.const 2) (i32.const 2) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 6) (i32.const 2) (i32.const 31) (i32.const 2)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 3) (i32.const 0))
    (if (i32.eqz (local.get $lit)) (then (return (i32.const 1))))
    ;; r30.x = 2*2, ^2, ^2 = 256; r30.y = 1/256; r30.x = 256*0.5 - 1/256.
    (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 30) (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 3) (i32.const 0))
    (call $vc_lit (local.get $rec) (i32.const 2) (i32.const 3) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 30) (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_t (local.get $rec) (i32.const 1) (i32.const 30) (i32.const 0) (i32.const 0))
    (call $vc_t (local.get $rec) (i32.const 2) (i32.const 30) (i32.const 0) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 30) (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_t (local.get $rec) (i32.const 1) (i32.const 30) (i32.const 0) (i32.const 0))
    (call $vc_t (local.get $rec) (i32.const 2) (i32.const 30) (i32.const 0) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 6) (i32.const 2) (i32.const 30) (i32.const 2)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_t (local.get $rec) (i32.const 1) (i32.const 30) (i32.const 0) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 30) (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_t (local.get $rec) (i32.const 1) (i32.const 30) (i32.const 0) (i32.const 0))
    (call $vc_lit (local.get $rec) (i32.const 2) (i32.const 1) (i32.const 0))
    (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 30) (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (call $vc_t (local.get $rec) (i32.const 1) (i32.const 30) (i32.const 0) (i32.const 0))
    (call $vc_t (local.get $rec) (i32.const 2) (i32.const 30) (i32.const 0x55) (i32.const 1))
    (i32.const 1))

  ;; Copy a guest record whose op is already core; rcp/rsq/exp/log get their
  ;; replicate swizzle made explicit (component x of the guest swizzle).
  (func $vc_copy (param $ins i32) (param $op i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vc_rec (local.get $op) (i32.load offset=8 (local.get $ins))))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (memory.copy (i32.add (local.get $rec) (i32.const 16)) (i32.add (local.get $ins) (i32.const 16)) (i32.const 80))
    (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 6)) (i32.eq (local.get $op) (i32.const 7)))
          (i32.or (i32.eq (local.get $op) (i32.const 14)) (i32.eq (local.get $op) (i32.const 15)))) (then
      (call $vc_srck (local.get $rec) (i32.const 1) (i32.add (local.get $ins) (i32.const 32)) (i32.const 0))))
    (i32.const 1))

  ;; One guest instruction. 1 = done, 0 = output full, -1 = declined.
  (func $vc_ins (param $ins i32) (param $vs1 i32) (result i32)
    (local $op i32) (local $d i32) (local $a i32) (local $b i32) (local $c i32)
    (local $rec i32) (local $j i32) (local $p i32) (local $rows i32) (local $dot i32)
    (local.set $op (i32.load (local.get $ins)))
    (local.set $d (i32.add (local.get $ins) (i32.const 16)))
    (local.set $a (i32.add (local.get $ins) (i32.const 32)))
    (local.set $b (i32.add (local.get $ins) (i32.const 48)))
    (local.set $c (i32.add (local.get $ins) (i32.const 64)))
    (if (i32.eqz (local.get $op)) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 31)) (i32.eq (local.get $op) (i32.const 81)))
      (then (return (call $vc_copy (local.get $ins) (local.get $op)))))
    (if (i32.load offset=12 (local.get $ins)) (then (return (call $cn_decline (i32.const 0x60001)))))
    ;; Destination: mask + optional saturate only.
    (if (i32.gt_u (i32.load offset=12 (local.get $d)) (i32.const 1)) (then (return (call $cn_decline (i32.const 0x60002)))))
    ;; Sources: negate and relative bits only.
    (local.set $j (i32.const 1))
    (block $ok (loop $each
      (br_if $ok (i32.ge_u (local.get $j) (i32.load offset=8 (local.get $ins))))
      (local.set $p (call $vc_slot (local.get $ins) (local.get $j)))
      (if (i32.gt_u (i32.and (i32.load offset=12 (local.get $p)) (i32.const 0xff)) (i32.const 1))
        (then (return (call $cn_decline (i32.const 0x60003)))))
      (if (i32.and (i32.load offset=12 (local.get $p)) (i32.const 0x400))
        (then (return (call $cn_decline (i32.const 0x60004)))))
      (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $each)))
    ;; vs_1_x "mov a0": floor (x - frc x) then an exact mova.
    (if (i32.and (i32.eq (local.get $op) (i32.const 1)) (i32.eq (i32.load (local.get $d)) (i32.const 3))) (then
      (local.set $rec (call $vc_op (i32.const 19) (i32.const 2) (i32.const 28) (i32.const 15)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 28) (i32.const 15)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 28) (i32.const 0xe4) (i32.const 1))
      (local.set $rec (call $vc_rec (i32.const 46) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xe4) (i32.const 0))
      (return (i32.const 1))))
    (if (i32.or (i32.or (i32.or (i32.eq (local.get $op) (i32.const 1)) (i32.eq (local.get $op) (i32.const 2)))
          (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 4)) (i32.le_u (local.get $op) (i32.const 15)))
            (i32.eq (local.get $op) (i32.const 19))))
          (i32.eq (local.get $op) (i32.const 46)))
      (then (return (call $vc_copy (local.get $ins) (local.get $op)))))
    ;; sub a, b = add a, -b.
    (if (i32.eq (local.get $op) (i32.const 3)) (then
      (if (i32.eqz (call $vc_copy (local.get $ins) (i32.const 2))) (then (return (i32.const 0))))
      (local.set $p (call $vc_slot (i32.add (i32.add (global.get $vc_out) (i32.const 32))
        (i32.shl (i32.sub (global.get $vc_n) (i32.const 1)) (i32.const 7))) (i32.const 2)))
      (i32.store offset=12 (local.get $p) (i32.xor (i32.load offset=12 (local.get $p)) (i32.const 1)))
      (return (i32.const 1))))
    ;; abs a = max(a, -a).
    (if (i32.eq (local.get $op) (i32.const 35)) (then
      (local.set $rec (call $vc_rec (i32.const 11) (i32.const 3)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $a) (i32.const 0xe4) (i32.const 1) (i32.const 0))
      (return (i32.const 1))))
    ;; lrp a, b, c = a * (b - c) + c.
    (if (i32.eq (local.get $op) (i32.const 18)) (then
      (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 28) (i32.const 15)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $b) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $c) (i32.const 0xe4) (i32.const 1) (i32.const 0))
      (local.set $rec (call $vc_rec (i32.const 4) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 28) (i32.const 0xe4) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 3) (local.get $c) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (return (i32.const 1))))
    ;; Matrix macros: one dp per row into r28, then the guest's masked write.
    (if (i32.and (i32.ge_u (local.get $op) (i32.const 20)) (i32.le_u (local.get $op) (i32.const 24))) (then
      (local.set $rows (select (i32.const 4)
        (select (i32.const 2) (i32.const 3) (i32.eq (local.get $op) (i32.const 24)))
        (i32.or (i32.eq (local.get $op) (i32.const 20)) (i32.eq (local.get $op) (i32.const 22)))))
      (local.set $dot (select (i32.const 9) (i32.const 8) (i32.le_u (local.get $op) (i32.const 21))))
      (local.set $j (i32.const 0))
      (loop $row
        (local.set $rec (call $vc_op (local.get $dot) (i32.const 3) (i32.const 28) (i32.shl (i32.const 1) (local.get $j))))
        (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
        (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
        (call $vc_src (local.get $rec) (i32.const 2) (local.get $b) (i32.const 0xe4) (i32.const 0) (local.get $j))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $row (i32.lt_u (local.get $j) (local.get $rows))))
      (return (call $vc_commit (local.get $d)))))
    ;; dst = (1, a.y * b.y, a.z, b.w).
    (if (i32.eq (local.get $op) (i32.const 17)) (then
      (local.set $rec (call $vc_op (i32.const 1) (i32.const 2) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 28) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $b) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 1) (i32.const 2) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 1) (i32.const 2) (i32.const 28) (i32.const 8)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $b) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (return (call $vc_commit (local.get $d)))))
    ;; lit: (1, max(x,0), x>0 && y>0 ? 2^(clamp(w,+-L) * log2 y) : 0, 1).
    ;; y is replaced by 1 when y <= 0, so the gated power is always finite.
    (if (i32.eq (local.get $op) (i32.const 16)) (then
      ;; r29.x = 0 < x, r29.y = 0 < y, r29.z = gate, r29.w = 1 - r29.y.
      (local.set $rec (call $vc_op (i32.const 12) (i32.const 3) (i32.const 29) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 0) (i32.const 0))
      (call $vc_srck (local.get $rec) (i32.const 2) (local.get $a) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 12) (i32.const 3) (i32.const 29) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 0) (i32.const 0))
      (call $vc_srck (local.get $rec) (i32.const 2) (local.get $a) (i32.const 1))
      (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 29) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 29) (i32.const 0x00) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 29) (i32.const 0x55) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 29) (i32.const 8)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 29) (i32.const 0x55) (i32.const 1))
      ;; r28.z = y * gy + (1 - gy)
      (local.set $rec (call $vc_op (i32.const 4) (i32.const 4) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 1))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 29) (i32.const 0x55) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 3) (i32.const 29) (i32.const 0xff) (i32.const 0))
      ;; r29.x = clamp(w, -L, L)
      (local.set $rec (call $vc_op (i32.const 10) (i32.const 3) (i32.const 29) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 3))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 30) (i32.const 0x00) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 11) (i32.const 3) (i32.const 29) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 29) (i32.const 0x00) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 30) (i32.const 0x00) (i32.const 1))
      ;; r28.z = gate * exp(w' * log(y'))
      (local.set $rec (call $vc_op (i32.const 15) (i32.const 2) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xaa) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xaa) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 29) (i32.const 0x00) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 14) (i32.const 2) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xaa) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xaa) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 29) (i32.const 0xaa) (i32.const 0))
      ;; r28.y = max(x, 0); r28.xw = 1
      (local.set $rec (call $vc_op (i32.const 11) (i32.const 3) (i32.const 28) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0))
      (call $vc_lit (local.get $rec) (i32.const 2) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 1) (i32.const 2) (i32.const 28) (i32.const 9)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0))
      (return (call $vc_commit (local.get $d)))))
    ;; expp: vs_1_x (2^floor x, frc x, 2^x, 1); vs_2_0 replicated 2^x.
    ;; logp: replicated log2|x| (both profiles; log 0 is the finite sentinel).
    (if (i32.or (i32.eq (local.get $op) (i32.const 78)) (i32.eq (local.get $op) (i32.const 79))) (then
      (if (i32.or (i32.eq (local.get $op) (i32.const 79)) (i32.eqz (local.get $vs1)))
        (then (return (call $vc_copy (local.get $ins) (select (i32.const 15) (i32.const 14) (i32.eq (local.get $op) (i32.const 79)))))))
      (local.set $rec (call $vc_op (i32.const 19) (i32.const 2) (i32.const 29) (i32.const 15)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 29) (i32.const 0x00) (i32.const 1))
      (local.set $rec (call $vc_op (i32.const 14) (i32.const 2) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0x00) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 1) (i32.const 2) (i32.const 28) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 29) (i32.const 0x00) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 14) (i32.const 2) (i32.const 28) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 1) (i32.const 2) (i32.const 28) (i32.const 8)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_lit (local.get $rec) (i32.const 1) (i32.const 2) (i32.const 0))
      (return (call $vc_commit (local.get $d)))))
    ;; pow a, b = 2^(b * log2|a|) (log2 0 = -FLT_MAX gives 0^+ = 0, 0^- = inf, x^0 = 1).
    (if (i32.eq (local.get $op) (i32.const 32)) (then
      (local.set $rec (call $vc_op (i32.const 15) (i32.const 2) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_srck (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0x00) (i32.const 0))
      (call $vc_srck (local.get $rec) (i32.const 2) (local.get $b) (i32.const 0))
      (local.set $rec (call $vc_rec (i32.const 14) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0x00) (i32.const 0))
      (return (i32.const 1))))
    ;; nrm a = a * rsq(dp3(a, a)).
    (if (i32.eq (local.get $op) (i32.const 36)) (then
      (local.set $rec (call $vc_op (i32.const 8) (i32.const 3) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 7) (i32.const 2) (i32.const 28) (i32.const 1)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0x00) (i32.const 0))
      (local.set $rec (call $vc_rec (i32.const 5) (i32.const 3)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 2) (i32.const 28) (i32.const 0x00) (i32.const 0))
      (return (i32.const 1))))
    ;; crs a, b = a.yzx * b.zxy - a.zxy * b.yzx.
    (if (i32.eq (local.get $op) (i32.const 33)) (then
      (local.set $rec (call $vc_op (i32.const 5) (i32.const 3) (i32.const 28) (i32.const 7)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xd2) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $b) (i32.const 0xc9) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_rec (i32.const 4) (i32.const 4)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xc9) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $b) (i32.const 0xd2) (i32.const 0) (i32.const 0))
      (call $vc_t (local.get $rec) (i32.const 3) (i32.const 28) (i32.const 0xe4) (i32.const 1))
      (return (i32.const 1))))
    ;; cnd a, b, c = a > 0.5 ? b : c per component (09aj fixed-function IR
    ;; only: its normalize selects rather than multiplying a non-finite length
    ;; by zero) = cmp(0.5 - a, c, b) into r29 -- cmp never writes one of its
    ;; sources -- then the guest's write.
    (if (i32.eq (local.get $op) (i32.const 80)) (then
      (local.set $rec (call $vc_op (i32.const 2) (i32.const 3) (i32.const 28) (i32.const 15)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_src (local.get $rec) (i32.const 1) (local.get $a) (i32.const 0xe4) (i32.const 1) (i32.const 0))
      (call $vc_lit (local.get $rec) (i32.const 2) (i32.const 1) (i32.const 0))
      (local.set $rec (call $vc_op (i32.const 88) (i32.const 4) (i32.const 29) (i32.const 15)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 28) (i32.const 0xe4) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 2) (local.get $c) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (call $vc_src (local.get $rec) (i32.const 3) (local.get $b) (i32.const 0xe4) (i32.const 0) (i32.const 0))
      (local.set $rec (call $vc_rec (i32.const 1) (i32.const 2)))
      (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
      (call $vc_dst (local.get $rec) (local.get $d))
      (call $vc_t (local.get $rec) (i32.const 1) (i32.const 29) (i32.const 0xe4) (i32.const 0))
      (return (i32.const 1))))
    (call $cn_decline (local.get $op)))

  ;; Allocate the output for $cap records; returns the guest pointer or 0.
  (func $vc_alloc (param $cap i32) (result i32)
    (local $bytes i32) (local $guest i32)
    (local.set $bytes (i32.add (i32.const 32) (i32.shl (local.get $cap) (i32.const 7))))
    (if (i32.gt_u (i32.add (global.get $d3d_ir_live_bytes) (local.get $bytes)) (i32.const 4194304)) (then (return (i32.const 0))))
    (local.set $guest (call $heap_alloc (i32.add (local.get $bytes) (i32.const 16))))
    (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
    (global.set $vc_out (i32.add (call $g2w (local.get $guest)) (i32.const 16)))
    (global.set $vc_cap (local.get $cap))
    (global.set $vc_n (i32.const 0))
    (global.set $vc_origin (i32.const 1))
    (memory.fill (global.get $vc_out) (i32.const 0) (i32.const 32))
    (local.get $guest))
  ;; Publish: header, then link into the IR ownership list.
  (func $vc_publish (param $guest i32) (param $ir i32) (param $stage i32) (param $version i32) (param $flags i32) (result i32)
    (local $base i32) (local $bytes i32)
    (local.set $base (i32.sub (global.get $vc_out) (i32.const 16)))
    (local.set $bytes (i32.add (i32.const 32) (i32.shl (global.get $vc_cap) (i32.const 7))))
    (i32.store (global.get $vc_out) (i32.const 0x44534952))
    (i32.store offset=4 (global.get $vc_out) (i32.const 1))
    (i32.store offset=8 (global.get $vc_out) (local.get $stage))
    (i32.store offset=12 (global.get $vc_out) (local.get $version))
    (i32.store offset=16 (global.get $vc_out) (global.get $vc_n))
    (i32.store offset=20 (global.get $vc_out) (i32.load offset=20 (local.get $ir)))
    (i32.store offset=24 (global.get $vc_out) (i32.add (i32.const 32) (i32.shl (global.get $vc_n) (i32.const 7))))
    (i32.store offset=28 (global.get $vc_out) (local.get $flags))
    (i32.store (local.get $base) (global.get $d3d_ir_head))
    (i32.store offset=4 (local.get $base) (local.get $guest))
    (i32.store offset=8 (local.get $base) (local.get $bytes))
    (global.set $d3d_ir_live_bytes (i32.add (global.get $d3d_ir_live_bytes) (local.get $bytes)))
    (global.set $d3d_ir_head (local.get $base))
    (global.get $vc_out))

  ;; Implicit declarations (wasm address of 16 words, 0 = none), set by a
  ;; producer around one canonicalize call: word v = 0x80000000 | usage |
  ;; index << 16 names v# for an IR without DCLs (D3D8 vs_1_1 declares its
  ;; inputs in the device declaration; 09aj fixed-function IR names none).
  (global $vc_implicit_dcl (mut i32) (i32.const 0))

  ;; Stage-0 entry (range and magic already checked by the caller).
  (func $d3d_vs_canonicalize (param $ir i32) (result i32)
    (local $n i32) (local $i i32) (local $ins i32) (local $op i32) (local $j i32) (local $p i32)
    (local $declared i32) (local $lits i32) (local $lit i32) (local $vs1 i32) (local $guest i32) (local $r i32)
    (local $version i32) (local $flags i32) (local $implicit i32) (local $w i32) (local $rec i32)
    (local.set $version (i32.load offset=12 (local.get $ir)))
    (local.set $flags (i32.load offset=28 (local.get $ir)))
    ;; Flags: 1 guest-origin, 4 fixed-function origin (09aj); nothing else.
    (if (i32.or (i32.ne (i32.and (local.get $flags) (i32.const -6)) (i32.const 0))
          (i32.eqz (i32.or (i32.or (i32.eq (local.get $version) (i32.const 0xfffe0100))
            (i32.eq (local.get $version) (i32.const 0xfffe0101))) (i32.eq (local.get $version) (i32.const 0xfffe0200)))))
      (then (drop (call $cn_decline (i32.const 0x60000))) (return (i32.const 0))))
    (local.set $vs1 (i32.ne (local.get $version) (i32.const 0xfffe0200)))
    (local.set $n (i32.load offset=16 (local.get $ir)))
    (if (i32.gt_u (local.get $n) (i32.const 1024)) (then (drop (call $cn_decline (i32.const 0x40002))) (return (i32.const 0))))
    ;; Declarations, literal needs, and the DCL rule.
    (block $scanned (loop $scan
      (br_if $scanned (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (local.set $op (i32.load (local.get $ins)))
      (if (i32.gt_u (i32.load offset=8 (local.get $ins)) (i32.const 5)) (then (drop (call $cn_decline (i32.const 0x60005))) (return (i32.const 0))))
      (if (i32.eq (local.get $op) (i32.const 31)) (then
        (if (i32.or (i32.ne (i32.load offset=32 (local.get $ins)) (i32.const 1)) (i32.ge_u (i32.load offset=36 (local.get $ins)) (i32.const 16)))
          (then (drop (call $cn_decline (i32.const 0x60006))) (return (i32.const 0))))
        (local.set $declared (i32.or (local.get $declared) (i32.shl (i32.const 1) (i32.load offset=36 (local.get $ins)))))))
      (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 16)) (i32.eq (local.get $op) (i32.const 80)))
            (i32.or (i32.eq (local.get $op) (i32.const 17)) (i32.and (local.get $vs1) (i32.eq (local.get $op) (i32.const 78)))))
        (then (local.set $lits (i32.const 1))))
      (if (i32.eq (local.get $op) (i32.const 16)) (then (local.set $lit (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (if (global.get $vc_implicit_dcl) (then
      (local.set $i (i32.const 0))
      (loop $imp
        (if (i32.and (i32.ne (i32.and (i32.load (i32.add (global.get $vc_implicit_dcl) (i32.shl (local.get $i) (i32.const 2))))
                (i32.const 0x80000000)) (i32.const 0))
              (i32.eqz (i32.and (local.get $declared) (i32.shl (i32.const 1) (local.get $i)))))
          (then (local.set $implicit (i32.or (local.get $implicit) (i32.shl (i32.const 1) (local.get $i))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $imp (i32.lt_u (local.get $i) (i32.const 16))))
      (local.set $declared (i32.or (local.get $declared) (local.get $implicit)))))
    (local.set $i (i32.const 0))
    (block $checked (loop $check
      (br_if $checked (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (if (i32.and (i32.ne (i32.load (local.get $ins)) (i32.const 31)) (i32.ne (i32.load (local.get $ins)) (i32.const 81))) (then
        (local.set $j (i32.const 1))
        (block $ops (loop $operands
          (br_if $ops (i32.ge_u (local.get $j) (i32.load offset=8 (local.get $ins))))
          (local.set $p (call $vc_slot (local.get $ins) (local.get $j)))
          (if (i32.eq (i32.load (local.get $p)) (i32.const 1)) (then
            (if (i32.or (i32.ge_u (i32.load offset=4 (local.get $p)) (i32.const 16))
                  (i32.eqz (i32.and (local.get $declared) (i32.shl (i32.const 1) (i32.load offset=4 (local.get $p))))))
              (then (drop (call $cn_decline (i32.const 0x60007))) (return (i32.const 0))))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $operands)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $check)))
    ;; Worst case: 18 records per guest instruction (lit) plus the prologue.
    (local.set $guest (call $vc_alloc (i32.add (i32.mul (local.get $n) (i32.const 18)) (i32.const 32))))
    (if (i32.eqz (local.get $guest)) (then (drop (call $cn_decline (i32.const 0x40004))) (return (i32.const 0))))
    (local.set $r (i32.const 1))
    (block $fail
      (local.set $i (i32.const 0))
      (block $dcls (loop $dcl
        (br_if $dcls (i32.ge_u (local.get $i) (i32.const 16)))
        (if (i32.and (local.get $implicit) (i32.shl (i32.const 1) (local.get $i))) (then
          (local.set $w (i32.load (i32.add (global.get $vc_implicit_dcl) (i32.shl (local.get $i) (i32.const 2)))))
          (local.set $rec (call $vc_rec (i32.const 31) (i32.const 2)))
          (if (i32.eqz (local.get $rec)) (then (local.set $r (i32.const 0)) (br $fail)))
          (call $vc_put (local.get $rec) (i32.const 0) (i32.const 254) (i32.and (local.get $w) (i32.const 0xffff))
            (i32.and (i32.shr_u (local.get $w) (i32.const 16)) (i32.const 0x7fff)) (i32.const 0))
          (call $vc_put (local.get $rec) (i32.const 1) (i32.const 1) (local.get $i) (i32.const 15) (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $dcl)))
      (if (local.get $lits) (then (br_if $fail (i32.eqz (call $vc_prologue (local.get $lit))))))
      (local.set $i (i32.const 0))
      (block $body (loop $each
        (br_if $body (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
        (global.set $vc_origin (i32.load offset=4 (local.get $ins)))
        (local.set $r (call $vc_ins (local.get $ins) (local.get $vs1)))
        (br_if $fail (i32.ne (local.get $r) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $each)))
      (return (call $vc_publish (local.get $guest) (local.get $ir) (i32.const 0) (i32.const 0xfffe0200)
        (i32.or (i32.const 8) (i32.and (local.get $flags) (i32.const 1))))))
    (if (i32.eqz (local.get $r)) (then (drop (call $cn_decline (i32.const 0x40005)))))
    (call $heap_free (local.get $guest))
    (i32.const 0))

  ;; Core pixel IR at version 0xffff0200 (texld names its sampler 0..7, t0..7):
  ;; validated against the core pixel subset and copied unchanged.
  (func $d3d_ps_core_copy (param $ir i32) (result i32)
    (local $n i32) (local $i i32) (local $ins i32) (local $op i32) (local $j i32) (local $p i32) (local $guest i32)
    (if (i32.ne (i32.and (i32.load offset=28 (local.get $ir)) (i32.const -2)) (i32.const 8))
      (then (drop (call $cn_decline (i32.const 0x60010))) (return (i32.const 0))))
    (local.set $n (i32.load offset=16 (local.get $ir)))
    (if (i32.gt_u (local.get $n) (i32.const 4096)) (then (drop (call $cn_decline (i32.const 0x40002))) (return (i32.const 0))))
    (block $checked (loop $check
      (br_if $checked (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $ins (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (local.set $op (i32.load (local.get $ins)))
      (if (i32.eqz (i32.or (i32.or (i32.or (i32.eq (local.get $op) (i32.const 1)) (i32.eq (local.get $op) (i32.const 2)))
              (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 4)) (i32.le_u (local.get $op) (i32.const 6)))
                (i32.and (i32.ge_u (local.get $op) (i32.const 8)) (i32.le_u (local.get $op) (i32.const 11)))))
            (i32.or (i32.or (i32.eq (local.get $op) (i32.const 18)) (i32.eq (local.get $op) (i32.const 88)))
              (i32.or (i32.eq (local.get $op) (i32.const 81))
                (i32.or (i32.eq (local.get $op) (i32.const 65)) (i32.eq (local.get $op) (i32.const 66)))))))
        (then (drop (call $cn_decline (local.get $op))) (return (i32.const 0))))
      (if (i32.load offset=12 (local.get $ins)) (then (drop (call $cn_decline (i32.const 0x60011))) (return (i32.const 0))))
      (if (i32.ne (local.get $op) (i32.const 81)) (then
        (local.set $j (i32.const 0))
        (block $ops (loop $operands
          (br_if $ops (i32.ge_u (local.get $j) (i32.load offset=8 (local.get $ins))))
          (br_if $ops (i32.ge_u (local.get $j) (i32.const 5)))
          (local.set $p (call $vc_slot (local.get $ins) (local.get $j)))
          ;; t# (bank 3) and samplers (bank 10) name 0..7; temps < 32, c < 32.
          (if (i32.ge_u (i32.load offset=4 (local.get $p))
                (select (i32.const 8) (i32.const 32)
                  (i32.or (i32.eq (i32.load (local.get $p)) (i32.const 3)) (i32.eq (i32.load (local.get $p)) (i32.const 10)))))
            (then (drop (call $cn_decline (i32.const 0x60012))) (return (i32.const 0))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $operands)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $check)))
    (local.set $guest (call $vc_alloc (local.get $n)))
    (if (i32.eqz (local.get $guest)) (then (drop (call $cn_decline (i32.const 0x40004))) (return (i32.const 0))))
    (memory.copy (i32.add (global.get $vc_out) (i32.const 32)) (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $n) (i32.const 7)))
    (global.set $vc_n (local.get $n))
    (call $vc_publish (local.get $guest) (local.get $ir) (i32.const 1) (i32.const 0xffff0200) (i32.load offset=28 (local.get $ir))))
