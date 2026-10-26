;; Backend-neutral shader IR ABI 1. All public pointers are WASM addresses.
;; Header (32 bytes): magic, ABI, stage(0 VS/1 PS), version, instruction count,
;; consumed DWORDs, total bytes, flags(bit0 relative, bit1 coissue).
;; Instructions (128 bytes): opcode, origin DWORD, operand count, coissue;
;; then up to five 16-byte operands {bank,index,selector,modifier}.
;; Destination selector=mask; modifier=sat | (signed shift byte << 8).
;; Source selector=swizzle; modifier=source modifier | (relative << 8).
;; DEF literals: bank255/index=IEEE bits. DCL semantic: bank254/index=usage,
;; selector=usage index. Remaining bytes are zero. Raw tokens stay shader-owned.
;; Errors: 1 bounds,2 version,3 opcode/control,4 truncated,5 parameter,
;; 6 register,7 modifier,8 relative,9 coissue,10 position,11 limit,12 OOM,
;; 13 declaration,14 DEF,15 matrix,16 profile legality,17 uninitialized temp,
;; 18 read port limit,19 instruction slot limit, 20 refused by the software
;; VM at create (09ad, never this validator). Offsets are original DWORDs.
;; Profile references (Microsoft primary tables):
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-instructions-vs-1-1
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-instructions-ps-1-x
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-modifiers-write-mask
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-modifiers-source-register-swizzling
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-instructions-modifiers-ps-1-x
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-registers-vs-1-1
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-ps-1-x
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texm3x2depth---ps
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texkill---ps
;; VS1.1/PS1.1-1.3 validation remains bounded: oFog, volume sampling,
;; native numerical/seam and CMP pairing boundary references remain gates,
;; not claims of SM1 completeness. Inline declarations are not required;
;; frontend-supplied declarations and version-specific linkage remain separate.
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-registers-point-size
;; oPts uses scalar x. Mask1/default15 are accepted pending historic assembler
;; encoding reference; other masks and vector matrix macros remain unsupported.
;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dcl-usage-input-register---vs
;; https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3ddeclusage
;; One whole-register binding per v# is the bounded lowering contract;
;; duplicate-register declarations fail unsupported (13), not a native-parity
;; claim. Identical semantics on DIFFERENT v# are retained (possible fan-out).
;; Lifetime list is private to the compiling instance; cross-worker consumers
;; retain immutable bytes, and return release to the producer after their fence.
  (global $d3d_ir_error (mut i32) (i32.const 0))
  (global $d3d_ir_error_offset (mut i32) (i32.const 0))
  (global $d3d_ir_head (mut i32) (i32.const 0))
  (global $d3d_ir_live_bytes (mut i32) (i32.const 0))
  (global $d3d_ir_length (mut i32) (i32.const 0))
  (global $d3d_ir_flags (mut i32) (i32.const 0))
  (func (export "d3d_shader_ir_error") (result i32) (global.get $d3d_ir_error))
  (func (export "d3d_shader_ir_error_offset") (result i32) (global.get $d3d_ir_error_offset))
  (func $d3d_ir_fail (param $code i32) (param $offset i32) (result i32)
    (global.set $d3d_ir_error (local.get $code))
    (global.set $d3d_ir_error_offset (local.get $offset)) (i32.const -1))
  ;; Sole decode arity definition for the initial supported profile subset.
  (func $d3d_ir_arity (export "d3d_shader_ir_arity") (param $op i32) (result i32)
    (if (i32.eq (local.get $op) (i32.const 84)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 88)) (then (return (i32.const 4))))
    (if (call $d3d_ir_ps12_texture (local.get $op)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 75)) (then (return (i32.const 3))))
    (if (i32.eqz (local.get $op)) (then (return (i32.const 0))))
    (if (i32.and (i32.ge_u (local.get $op) (i32.const 64)) (i32.le_u (local.get $op) (i32.const 66)))
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 81)) (then (return (i32.const 5))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 4))
          (i32.or (i32.eq (local.get $op) (i32.const 18)) (i32.eq (local.get $op) (i32.const 80))))
      (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 1))
          (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 6)) (i32.le_u (local.get $op) (i32.const 7)))
          (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 14)) (i32.le_u (local.get $op) (i32.const 16)))
          (i32.or (i32.eq (local.get $op) (i32.const 19))
          (i32.or (i32.eq (local.get $op) (i32.const 31))
          (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 67)) (i32.le_u (local.get $op) (i32.const 76)))
          (i32.and (i32.ge_u (local.get $op) (i32.const 78)) (i32.le_u (local.get $op) (i32.const 79)))))))))
      (then (return (i32.const 2))))
    (if (i32.and (i32.ge_u (local.get $op) (i32.const 2)) (i32.le_u (local.get $op) (i32.const 24)))
      (then (return (i32.const 3))))
    (i32.const -1))
  (func $d3d_ir_bank (param $token i32) (result i32)
    (i32.or (i32.and (i32.shr_u (local.get $token) (i32.const 28)) (i32.const 7))
      (i32.and (i32.shr_u (local.get $token) (i32.const 8)) (i32.const 24))))
  ;; Token shape is version-dependent starting at PS1.4: TEXCOORD/TEX
  ;; become two-operand TEXCRD/TEXLD. This is decode metadata, NOT a claim
  ;; that a version is executable or publicly accepted by CreateShader.
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texcrd---ps
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/texld---ps-1-4
  (func $d3d_ir_arity_version (export "d3d_shader_ir_arity_version")
    (param $version i32) (param $op i32) (result i32)
    (if (i32.eq (local.get $version) (i32.const 0xffff0104)) (then
      (if (i32.eq (local.get $op) (i32.const 0xfffd)) (then (return (i32.const 0))))
      (if (i32.or (i32.eq (local.get $op) (i32.const 64)) (i32.eq (local.get $op) (i32.const 66)))
        (then (return (i32.const 2))))
      (if (i32.eq (local.get $op) (i32.const 87)) (then (return (i32.const 1))))
      (if (i32.eq (local.get $op) (i32.const 89)) (then (return (i32.const 3))))
      (if (i32.eqz (i32.or (i32.le_u (local.get $op) (i32.const 5))
        (i32.or (i32.eq (local.get $op) (i32.const 8))
        (i32.or (i32.eq (local.get $op) (i32.const 9))
        (i32.or (i32.eq (local.get $op) (i32.const 18))
        (i32.or (i32.eq (local.get $op) (i32.const 65))
        (i32.or (i32.eq (local.get $op) (i32.const 80))
        (i32.or (i32.eq (local.get $op) (i32.const 81)) (i32.eq (local.get $op) (i32.const 88))))))))))
        (then (return (i32.const -1))))
      (return (call $d3d_ir_arity (local.get $op)))))
    (if (i32.eqz (i32.or (i32.or (i32.eq (local.get $version) (i32.const 0xfffe0100)) (i32.eq (local.get $version) (i32.const 0xfffe0101)))
      (i32.or (i32.eq (local.get $version) (i32.const 0xffff0101))
      (i32.or (i32.eq (local.get $version) (i32.const 0xffff0102)) (i32.eq (local.get $version) (i32.const 0xffff0103))))))
      (then (return (i32.const -1))))
    (call $d3d_ir_arity (local.get $op)))
  ;; Internal structural prepass: caller has validated ptr/count bounds.
  ;; Locate an actual PHASE instruction, never a matching DEF immediate or
  ;; comment word. Return its DWORD offset, 0 for implicit phase2, -1 error.
  ;; The semantic scan will use this to forbid v# before the marker, retain
  ;; RGB initialization across it, and invalidate temporary alpha. Without
  ;; this prepass, an absent marker would wrongly be treated as phase1.
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/phase---ps
  (func $d3d_ir_phase_split (param $ptr i32) (param $count i32) (result i32)
    (local $at i32) (local $token i32) (local $op i32) (local $arity i32)
    (local $split i32) (local $version i32)
    (local.set $version (i32.load (local.get $ptr)))
    (local.set $at (i32.const 1))
    (loop $instructions
      (if (i32.ge_u (local.get $at) (local.get $count))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $at)))))
      (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
      (if (i32.eq (local.get $token) (i32.const 65535)) (then (return (local.get $split))))
      (local.set $op (i32.and (local.get $token) (i32.const 65535)))
      (if (i32.eq (local.get $op) (i32.const 65534))
        (then (local.set $arity (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 32767))))
        (else
          (local.set $arity (call $d3d_ir_arity_version (local.get $version) (local.get $op)))
          (if (i32.or (i32.lt_s (local.get $arity) (i32.const 0))
                (i32.ne (i32.and (local.get $token) (i32.const 0xbfff0000)) (i32.const 0)))
            (then (return (call $d3d_ir_fail (i32.const 3) (local.get $at)))))
          (if (i32.eq (local.get $op) (i32.const 0xfffd)) (then
            (if (i32.or (local.get $split) (i32.ne (local.get $token) (i32.const 0xfffd)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $at)))))
            (local.set $split (local.get $at))))))
      (if (i32.ge_u (i32.add (local.get $at) (local.get $arity)) (local.get $count))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $at)))))
      (local.set $at (i32.add (local.get $at) (i32.add (local.get $arity) (i32.const 1))))
      (br $instructions))
    (i32.const -1))
  ;; PS1.4 validator, called by the public compile ($d3d_shader_ir_compile_mode)
  ;; since six-stage execution and software/WebGL1/WebGL2 parity were proven
  ;; (test-d3d9-ps14-web.js, test-d3d9-shader-web.js). It emits the SAME IR
  ;; ABI; PHASE is a zero-operand instruction, retaining its source offset.
  ;; No marker means phase2. PHASE kills alpha initialization, not RGB.
  ;; Coissue reads pre-pair values; partial RGB + alpha masks share a slot.
  ;; Combined read-port limit3 is a conservative reference-gated contract.
  (func $d3d_ir_scan14 (param $ptr i32) (param $count i32) (param $out i32) (result i32)
    (local $split i32) (local $at i32) (local $start i32) (local $op i32) (local $token i32)
    (local $arity i32) (local $n i32) (local $record i32) (local $operand i32)
    (local $phase2 i32) (local $slots i32) (local $co i32) (local $prevop i32) (local $prevmask i32)
    (local $temps i32) (local $before i32) (local $newtemps i32) (local $mask i32) (local $dstindex i32)
    (local $i i32) (local $arg i32) (local $bank i32) (local $index i32) (local $sel i32)
    (local $mod i32) (local $shift i32) (local $needed i32)
    (local $constants i32)
    (local $texture i32) (local $textures i32) (local $phase1temps i32) (local $dzuses i32)
    (local $selector_seen i32) (local $selector_xyw i32) (local $bems i32) (local $depthused i32)
    (local.set $split (call $d3d_ir_phase_split (local.get $ptr) (local.get $count)))
    (if (i32.lt_s (local.get $split) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $phase2 (i32.eqz (local.get $split)))
    (local.set $at (i32.const 1))
    (global.set $d3d_ir_flags (i32.const 0))
    (block $end (loop $instructions
      (if (i32.ge_u (local.get $at) (local.get $count))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $at)))))
      (local.set $start (local.get $at))
      (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
      (local.set $at (i32.add (local.get $at) (i32.const 1)))
      (br_if $end (i32.eq (local.get $token) (i32.const 65535)))
      (local.set $op (i32.and (local.get $token) (i32.const 65535)))
      (if (i32.eq (local.get $op) (i32.const 65534)) (then
        (local.set $at (i32.add (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 32767))))
        (if (i32.gt_u (local.get $at) (local.get $count))
          (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
        (br $instructions)))
      (local.set $texture (i32.or (i32.eq (local.get $op) (i32.const 87))
        (i32.and (i32.ge_u (local.get $op) (i32.const 64)) (i32.le_u (local.get $op) (i32.const 66)))))
      (if (local.get $texture) (then
        (if (local.get $slots) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $textures (i32.add (local.get $textures) (i32.const 1)))
        (if (i32.gt_u (local.get $textures) (i32.const 6)) (then (return (call $d3d_ir_fail (i32.const 19) (local.get $start)))))))
      (if (i32.eq (local.get $op) (i32.const 89)) (then
        (if (i32.or (local.get $phase2) (local.get $bems)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $bems (i32.const 1))))
      (local.set $co (i32.ne (i32.and (local.get $token) (i32.const 0x40000000)) (i32.const 0)))
      (local.set $arity (call $d3d_ir_arity_version (i32.const 0xffff0104) (local.get $op)))
      (if (i32.or (i32.lt_s (local.get $arity) (i32.const 0))
        (i32.ne (i32.and (local.get $token) (i32.const 0xbfff0000)) (i32.const 0)))
        (then (return (call $d3d_ir_fail (i32.const 3) (local.get $start)))))
      (if (i32.gt_u (i32.add (local.get $at) (local.get $arity)) (local.get $count))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
      (if (i32.and (i32.eq (local.get $op) (i32.const 65533))
        (i32.or (local.get $co) (i32.ne (local.get $start) (local.get $split))))
        (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
      (if (i32.ge_u (local.get $n) (i32.const 4096)) (then (return (call $d3d_ir_fail (i32.const 11) (local.get $start)))))
      (if (local.get $out) (then
        (if (i32.ge_u (local.get $n) (i32.load offset=16 (local.get $out)))
          (then (return (call $d3d_ir_fail (i32.const 11) (local.get $start)))))))
      (local.set $record (i32.add (local.get $out) (i32.add (i32.const 32) (i32.shl (local.get $n) (i32.const 7)))))
      (if (local.get $out) (then
        (i32.store (local.get $record) (local.get $op))
        (i32.store offset=4 (local.get $record) (local.get $start))
        (i32.store offset=8 (local.get $record) (local.get $arity))
        (i32.store offset=12 (local.get $record) (local.get $co))))
      (local.set $mask (i32.const 0))
      (if (local.get $arity) (then
        (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
        (local.set $mask (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 15)))
        (local.set $dstindex (i32.and (local.get $token) (i32.const 2047)))))
      (if (local.get $co) (then
        (if (i32.or (local.get $texture) (i32.or (i32.eq (local.get $op) (i32.const 89)) (i32.eq (local.get $prevop) (i32.const 89))))
          (then (return (call $d3d_ir_fail (i32.const 9) (local.get $start)))))
        (if (i32.or (i32.eq (local.get $op) (i32.const 9))
          (i32.or (i32.eq (local.get $prevop) (i32.const 9))
          (i32.or (i32.eq (local.get $op) (i32.const 81))
          (i32.eqz (i32.or
            (i32.and (i32.eq (local.get $mask) (i32.const 8)) (i32.and (i32.gt_u (local.get $prevmask) (i32.const 0)) (i32.lt_u (local.get $prevmask) (i32.const 8))))
            (i32.and (i32.eq (local.get $prevmask) (i32.const 8)) (i32.and (i32.gt_u (local.get $mask) (i32.const 0)) (i32.lt_u (local.get $mask) (i32.const 8)))))))))
          (then (return (call $d3d_ir_fail (i32.const 9) (local.get $start)))))
        (global.set $d3d_ir_flags (i32.or (global.get $d3d_ir_flags) (i32.const 2)))))
      (local.set $constants (i32.const 0))
      (local.set $newtemps (local.get $temps)) (local.set $i (i32.const 0))
      (block $args_end (loop $args
        (br_if $args_end (i32.ge_u (local.get $i) (local.get $arity)))
        (local.set $arg (i32.load (i32.add (local.get $ptr) (i32.shl (i32.add (local.get $at) (local.get $i)) (i32.const 2)))))
        (local.set $bank (call $d3d_ir_bank (local.get $arg)))
        (local.set $index (i32.and (local.get $arg) (i32.const 2047)))
        (local.set $sel (i32.and (i32.shr_u (local.get $arg) (i32.const 16)) (i32.const 255)))
        (local.set $mod (i32.and (i32.shr_u (local.get $arg) (i32.const 24)) (i32.const 15)))
        (block $normalized
          (if (i32.and (i32.eq (local.get $op) (i32.const 81)) (i32.ne (local.get $i) (i32.const 0))) (then
            (if (i32.eq (i32.and (local.get $arg) (i32.const 0x7f800000)) (i32.const 0x7f800000))
              (then (return (call $d3d_ir_fail (i32.const 14) (i32.add (local.get $at) (local.get $i))))))
            (local.set $bank (i32.const 255)) (local.set $index (local.get $arg))
            (local.set $sel (i32.const 0)) (local.set $mod (i32.const 0)) (br $normalized)))
          (if (i32.or (i32.eqz (i32.and (local.get $arg) (i32.const 0x80000000)))
            (i32.ne (i32.and (local.get $arg) (i32.const 0xe000)) (i32.const 0)))
            (then (return (call $d3d_ir_fail (i32.const 5) (i32.add (local.get $at) (local.get $i))))))
          (if (i32.and (local.get $depthused) (i32.and (i32.eqz (local.get $bank)) (i32.eq (local.get $index) (i32.const 5))))
            (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
          (if (local.get $texture) (then
            (if (i32.ge_u (local.get $index) (i32.const 6))
              (then (return (call $d3d_ir_fail (i32.const 6) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.eqz (local.get $i)) (then
              (if (i32.or (local.get $mod) (i32.ne (i32.shr_u (local.get $sel) (i32.const 4)) (i32.const 0)))
                (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))
              (if (i32.eqz (i32.or (i32.eqz (local.get $bank))
                (i32.and (i32.eq (local.get $op) (i32.const 65)) (i32.eq (local.get $bank) (i32.const 3)))))
                (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))
              (if (i32.eq (local.get $op) (i32.const 64))
                (then
                  (if (i32.eqz (i32.or (i32.eq (local.get $sel) (i32.const 3)) (i32.eq (local.get $sel) (i32.const 7))))
                    (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start))))))
                (else (if (i32.ne (local.get $sel) (i32.const 15))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
              (if (i32.or (i32.eq (local.get $op) (i32.const 65)) (i32.eq (local.get $op) (i32.const 87)))
                (then
                  (if (i32.eq (local.get $op) (i32.const 87)) (then
                    (if (i32.or (i32.eqz (local.get $phase2)) (i32.or (i32.eqz (local.get $split)) (i32.ne (local.get $index) (i32.const 5))))
                      (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
                  (if (i32.eqz (local.get $bank)) (then
                    (local.set $needed (i32.shl (select (i32.const 3) (i32.const 7) (i32.eq (local.get $op) (i32.const 87)))
                      (i32.shl (local.get $index) (i32.const 2))))
                    (if (i32.ne (i32.and (local.get $temps) (local.get $needed)) (local.get $needed))
                      (then (return (call $d3d_ir_fail (i32.const 17) (local.get $at))))))))
                (else
                  ;; TEXCRD explicitly invalidates destination undefined lanes.
                  (local.set $newtemps (i32.or
                    (i32.and (local.get $newtemps) (i32.xor (i32.shl (i32.const 15) (i32.shl (local.get $index) (i32.const 2))) (i32.const -1)))
                    (i32.shl (local.get $mask) (i32.shl (local.get $index) (i32.const 2)))))))
              (br $normalized)))
            ;; TEXCRD reads only t#; TEXLD may additionally read previous-phase
            ;; initialized r#. Its sampler is destination r#, independent of t#.
            (if (i32.eqz (i32.or (i32.eq (local.get $bank) (i32.const 3))
              (i32.and (i32.eq (local.get $op) (i32.const 66)) (i32.and (local.get $phase2) (i32.eqz (local.get $bank))))))
              (then (return (call $d3d_ir_fail (i32.const 6) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.eqz (local.get $bank)) (then
              (local.set $needed (i32.shl (i32.const 7) (i32.shl (local.get $index) (i32.const 2))))
              (if (i32.ne (i32.and (local.get $phase1temps) (local.get $needed)) (local.get $needed))
                (then (return (call $d3d_ir_fail (i32.const 17) (i32.add (local.get $at) (local.get $i))))))
              (if (i32.or (i32.ne (local.get $sel) (i32.const 228))
                (i32.eqz (i32.or (i32.eqz (local.get $mod)) (i32.eq (local.get $mod) (i32.const 9)))))
                (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))
              (if (i32.eq (local.get $mod) (i32.const 9)) (then
                (local.set $dzuses (i32.add (local.get $dzuses) (i32.const 1)))
                (if (i32.gt_u (local.get $dzuses) (i32.const 2)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start))))))))
            (else
              (if (i32.or (i32.eqz (i32.or (i32.eq (local.get $sel) (i32.const 228)) (i32.eq (local.get $sel) (i32.const 244))))
                (i32.eqz (i32.or (i32.eqz (local.get $mod)) (i32.and (i32.eq (local.get $mod) (i32.const 10)) (i32.eq (local.get $sel) (i32.const 244))))))
                (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))
              (local.set $needed (i32.shl (i32.const 1) (local.get $index)))
              (if (i32.and (local.get $selector_seen) (local.get $needed)) (then
                (if (i32.ne (i32.ne (i32.and (local.get $selector_xyw) (local.get $needed)) (i32.const 0)) (i32.eq (local.get $sel) (i32.const 244)))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
              (local.set $selector_seen (i32.or (local.get $selector_seen) (local.get $needed)))
              (if (i32.eq (local.get $sel) (i32.const 244)) (then (local.set $selector_xyw (i32.or (local.get $selector_xyw) (local.get $needed)))))))
            (if (i32.eq (local.get $op) (i32.const 64)) (then
              (if (i32.ne (local.get $mask) (select (i32.const 3) (i32.const 7) (i32.eq (local.get $mod) (i32.const 10))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (br $normalized)))
          (if (i32.eqz (local.get $i)) (then
            (if (i32.eq (local.get $op) (i32.const 81))
              (then
                (if (i32.or (i32.ne (local.get $bank) (i32.const 2)) (i32.ge_u (local.get $index) (i32.const 8)))
                  (then (return (call $d3d_ir_fail (i32.const 14) (local.get $start)))))
                (if (i32.or (i32.ne (local.get $sel) (i32.const 15)) (local.get $mod))
                  (then (return (call $d3d_ir_fail (i32.const 14) (local.get $start))))))
              (else
                (if (i32.or (i32.ne (local.get $bank) (i32.const 0)) (i32.ge_u (local.get $index) (i32.const 6)))
                  (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))
                (local.set $newtemps (i32.or (local.get $newtemps) (i32.shl (local.get $mask) (i32.shl (local.get $index) (i32.const 2)))))))
            (local.set $shift (local.get $mod))
            (local.set $mod (i32.shr_u (local.get $sel) (i32.const 4)))
            (local.set $sel (i32.and (local.get $sel) (i32.const 15)))
            (if (i32.and (i32.eq (local.get $op) (i32.const 89)) (i32.ne (local.get $sel) (i32.const 3)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (if (i32.or (i32.eqz (local.get $sel)) (i32.or (i32.gt_u (local.get $mod) (i32.const 1))
              (i32.and (i32.gt_u (local.get $shift) (i32.const 3)) (i32.lt_u (local.get $shift) (i32.const 13)))))
              (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))
            (local.set $shift (select (i32.sub (local.get $shift) (i32.const 16)) (local.get $shift) (i32.ge_u (local.get $shift) (i32.const 13))))
            (local.set $mod (i32.or (local.get $mod) (i32.shl (i32.and (local.get $shift) (i32.const 255)) (i32.const 8)))))
          (else
            (if (i32.eqz (i32.or (i32.and (i32.eqz (local.get $bank)) (i32.lt_u (local.get $index) (i32.const 6)))
              (i32.or (i32.and (i32.eq (local.get $bank) (i32.const 2)) (i32.lt_u (local.get $index) (i32.const 8)))
                (i32.and (local.get $phase2) (i32.and (i32.eq (local.get $bank) (i32.const 1)) (i32.lt_u (local.get $index) (i32.const 2)))))))
              (then (return (call $d3d_ir_fail (i32.const 6) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.or (i32.gt_u (local.get $mod) (i32.const 8))
              (i32.and (i32.eq (local.get $bank) (i32.const 2)) (i32.ne (local.get $mod) (i32.const 0))))
              (then (return (call $d3d_ir_fail (i32.const 7) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.eqz (i32.or (i32.eq (local.get $sel) (i32.const 228))
              (i32.eq (i32.rem_u (local.get $sel) (i32.const 85)) (i32.const 0))))
              (then (return (call $d3d_ir_fail (i32.const 7) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.eqz (local.get $bank)) (then
              ;; CND1.4 compares each component, unlike legacy r0.a.
              (local.set $needed (call $d3d_ir_swizzle_mask
                (select (local.get $mask) (call $d3d_ir_read_mask (local.get $op) (local.get $i) (local.get $mask))
                  (i32.eq (local.get $op) (i32.const 80))) (local.get $sel)))
              (local.set $needed (i32.shl (local.get $needed) (i32.shl (local.get $index) (i32.const 2))))
              (if (i32.ne (i32.and (select (local.get $before) (local.get $temps) (local.get $co)) (local.get $needed)) (local.get $needed))
                (then (return (call $d3d_ir_fail (i32.const 17) (i32.add (local.get $at) (local.get $i))))))))
            (if (i32.eq (local.get $bank) (i32.const 2)) (then
              (local.set $constants (i32.or (local.get $constants) (i32.shl (i32.const 1) (local.get $index)))))))))
        (local.set $operand (i32.add (local.get $record) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 4)))))
        (if (local.get $out) (then
          (i32.store (local.get $operand) (local.get $bank)) (i32.store offset=4 (local.get $operand) (local.get $index))
          (i32.store offset=8 (local.get $operand) (local.get $sel)) (i32.store offset=12 (local.get $operand) (local.get $mod))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $args)))
      ;; Microsoft "ps_1_1..ps_1_4 Registers", Read Port Limit: the count of
      ;; distinct registers per type "in a single instruction" -- 1.4 c#2, r#3
      ;; (three sources can't exceed r#3). No combined limit for a coissued
      ;; pair: B&W2's grass.sdv pairs read four distinct temps.
      ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-ps-1-x
      (if (i32.gt_u (i32.popcnt (local.get $constants)) (i32.const 2))
        (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))
      (local.set $before (local.get $temps)) (local.set $temps (local.get $newtemps))
      (local.set $prevmask (select (local.get $mask) (i32.const 0)
        (i32.and (i32.eqz (local.get $co)) (i32.and (i32.eqz (local.get $texture)) (i32.ne (local.get $op) (i32.const 81))))))
      (local.set $prevop (local.get $op))
      (if (i32.eq (local.get $op) (i32.const 65533))
        (then (local.set $phase2 (i32.const 1)) (local.set $slots (i32.const 0)) (local.set $textures (i32.const 0))
          (local.set $temps (i32.and (local.get $temps) (i32.const 0x777777)))
          (local.set $phase1temps (local.get $temps)))
        (else (if (i32.and (i32.eqz (local.get $texture)) (i32.and (i32.ne (local.get $op) (i32.const 0)) (i32.ne (local.get $op) (i32.const 81))))
          (then (local.set $slots (i32.add (local.get $slots) (i32.add (i32.eqz (local.get $co)) (i32.eq (local.get $op) (i32.const 89)))))))))
      (if (i32.eq (local.get $op) (i32.const 87)) (then (local.set $depthused (i32.const 1))))
      (if (i32.gt_u (local.get $slots) (i32.const 8)) (then (return (call $d3d_ir_fail (i32.const 19) (local.get $start)))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (local.set $at (i32.add (local.get $at) (local.get $arity))) (br $instructions)))
    (global.set $d3d_ir_length (local.get $at)) (local.get $n))
  ;; Component dependencies before source swizzle. Purely constant result
  ;; lanes (LIT.xw, DST.x, EXPP.w) do not demand unrelated temporary values.
  ;; Reads are static unions for data-dependent expressions, not value folding.
  (func $d3d_ir_read_mask (param $op i32) (param $source i32) (param $mask i32) (result i32)
    (if (i32.eq (local.get $op) (i32.const 8)) (then (return (i32.const 7))))
    (if (i32.eq (local.get $op) (i32.const 9)) (then (return (i32.const 15))))
    (if (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 6)) (i32.le_u (local.get $op) (i32.const 7)))
          (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 14)) (i32.le_u (local.get $op) (i32.const 15)))
            (i32.eq (local.get $op) (i32.const 79)))) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 78))
      (then (return (i32.ne (i32.and (local.get $mask) (i32.const 7)) (i32.const 0)))))
    (if (i32.eq (local.get $op) (i32.const 16)) (then
      (return (i32.or (select (i32.const 1) (i32.const 0) (i32.and (local.get $mask) (i32.const 2)))
        (select (i32.const 11) (i32.const 0) (i32.and (local.get $mask) (i32.const 4)))))))
    (if (i32.eq (local.get $op) (i32.const 17)) (then
      (return (i32.and (local.get $mask) (select (i32.const 6) (i32.const 10) (i32.eq (local.get $source) (i32.const 1)))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 80)) (i32.eq (local.get $source) (i32.const 1)))
      (then (return (i32.const 8))))
    (if (i32.and (i32.ge_u (local.get $op) (i32.const 20)) (i32.le_u (local.get $op) (i32.const 24)))
      (then (return (select (i32.const 15) (i32.const 7) (i32.le_u (local.get $op) (i32.const 21))))))
    (local.get $mask))
  (func $d3d_ir_swizzle_mask (param $mask i32) (param $swizzle i32) (result i32)
    (local $c i32) (local $out i32)
    (loop $components
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $c))) (then
        (local.set $out (i32.or (local.get $out) (i32.shl (i32.const 1)
          (i32.and (i32.shr_u (local.get $swizzle) (i32.shl (local.get $c) (i32.const 1))) (i32.const 3)))))))
      (local.set $c (i32.add (local.get $c) (i32.const 1)))
      (br_if $components (i32.lt_u (local.get $c) (i32.const 4))))
    (local.get $out))

  (func $d3d_ir_ps12_texture (param $op i32) (result i32)
    (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 82)) (i32.le_u (local.get $op) (i32.const 83)))
      (i32.and (i32.ge_u (local.get $op) (i32.const 85)) (i32.le_u (local.get $op) (i32.const 86)))))
  (func $d3d_ir_ps12_op (param $op i32) (result i32)
    (i32.or (call $d3d_ir_ps12_texture (local.get $op)) (i32.or (i32.eq (local.get $op) (i32.const 9)) (i32.eq (local.get $op) (i32.const 88)))))
  (func $d3d_ir_profile_op (param $pixel i32) (param $op i32) (result i32)
    ;; TEXREG2GB: Microsoft's ps-1-x overview and Wine shader_sm1.c permit
    ;; PS1.1; the dedicated texreg2gb---ps page disagrees. Native-reference gate
    ;; remains documented, rather than silently upgrading the shader version.
    (if (local.get $pixel) (then
      (return (i32.or (i32.le_u (local.get $op) (i32.const 5))
        (i32.or (i32.eq (local.get $op) (i32.const 8))
        (i32.or (i32.eq (local.get $op) (i32.const 18))
        (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 64)) (i32.le_u (local.get $op) (i32.const 66)))
        (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 67)) (i32.le_u (local.get $op) (i32.const 76)))
          (i32.and (i32.ge_u (local.get $op) (i32.const 80)) (i32.le_u (local.get $op) (i32.const 81)))))))))))
    (i32.or (i32.and (i32.le_u (local.get $op) (i32.const 24)) (i32.ne (local.get $op) (i32.const 18)))
      (i32.or (i32.eq (local.get $op) (i32.const 31))
        (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 78)) (i32.le_u (local.get $op) (i32.const 79)))
          (i32.eq (local.get $op) (i32.const 81))))))
  (func $d3d_ir_reg_ok (param $pixel i32) (param $bank i32) (param $index i32) (param $write i32) (result i32)
    (if (i32.eqz (local.get $bank))
      (then (return (i32.lt_u (local.get $index) (select (i32.const 2) (i32.const 12) (local.get $pixel))))))
    (if (i32.eq (local.get $bank) (i32.const 1))
      (then (return (i32.and (i32.eqz (local.get $write))
        (i32.lt_u (local.get $index) (select (i32.const 2) (i32.const 16) (local.get $pixel)))))))
    (if (i32.eq (local.get $bank) (i32.const 2))
      (then (return (i32.and (i32.eqz (local.get $write))
        (i32.lt_u (local.get $index) (select (i32.const 8) (i32.const 96) (local.get $pixel)))))))
    (if (i32.eq (local.get $bank) (i32.const 3))
      (then (return (select (i32.lt_u (local.get $index) (i32.const 4))
        (i32.and (local.get $write) (i32.eqz (local.get $index))) (local.get $pixel)))))
    (if (local.get $pixel) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $write)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $bank) (i32.const 4))
      (then (return (i32.le_u (local.get $index) (i32.const 2)))))
    (if (i32.eq (local.get $bank) (i32.const 5)) (then (return (i32.lt_u (local.get $index) (i32.const 2)))))
    (i32.and (i32.eq (local.get $bank) (i32.const 6)) (i32.lt_u (local.get $index) (i32.const 8))))
  ;; Scan twice: validate/count without allocating, then emit into exact storage.
  (func $d3d_ir_scan (param $ptr i32) (param $count i32) (param $out i32) (result i32)
    (local $pixel i32) (local $at i32) (local $start i32) (local $token i32)
    (local $op i32) (local $arity i32) (local $n i32) (local $i i32)
    (local $arg i32) (local $bank i32) (local $index i32) (local $sel i32) (local $mod i32)
    (local $shift i32) (local $relative i32) (local $address i32) (local $position i32)
    (local $coissue i32) (local $lastwrite i32) (local $record i32) (local $operand i32)
    (local $write i32) (local $matrix i32) (local $rows i32)
    (local $dstmask i32) (local $dstbank i32) (local $dstindex i32) (local $previousmask i32)
    (local $temps i64) (local $before_previous i64) (local $newtemps i64)
    (local $needed i64) (local $readmask i32) (local $readrows i32) (local $readrow i32)
    (local $firstconst i32) (local $secondconst i32) (local $firstinput i32)
    (local $firsttexture i32) (local $secondtexture i32) (local $ports i32)
    (local $constant_reads i32) (local $texture_reads i32)
    (local $previous_constant_reads i32) (local $previous_texture_reads i32)
    (local $padstage i32) (local $padsource i32) (local $texwritten i32) (local $texmatrix i32)
    (local $padnext i32)
    (local $minor i32) (local $cmps i32) (local $previousop i32) (local $depthused i32)
    (local $bumpused i32) (local $bumpop i32)
    (local $executable i32) (local $declared_inputs i32)
    (local $arithmetic i32) (local $textures i32) (local $cost i32) (local $textureop i32)
    (local.set $minor (i32.and (i32.load (local.get $ptr)) (i32.const 255)))
    (local.set $pixel (i32.eq (i32.shr_u (i32.load (local.get $ptr)) (i32.const 16)) (i32.const 65535)))
    (local.set $at (i32.const 1))
    (global.set $d3d_ir_flags (i32.const 0))
    (block $end (loop $instructions
      (if (i32.ge_u (local.get $at) (local.get $count))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $at)))))
      (local.set $start (local.get $at))
      (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
      (local.set $at (i32.add (local.get $at) (i32.const 1)))
      (if (i32.eq (local.get $token) (i32.const 65535)) (then
        (if (local.get $padstage) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (br $end)))
      (local.set $op (i32.and (local.get $token) (i32.const 65535)))
      (if (i32.eq (local.get $op) (i32.const 65534)) (then
        (local.set $at (i32.add (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 32767))))
        (if (i32.gt_u (local.get $at) (local.get $count))
          (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
        (br $instructions)))
      ;; Initial matrix macro slice requires adjacent executable PAD/TEX.
      ;; Comments do not interrupt the pair; wider interleaving is unsupported.
      (if (i32.and (i32.ne (local.get $padstage) (i32.const 0)) (i32.ne
        (select (i32.const 72) (select (i32.const 74) (local.get $op) (i32.or (i32.eq (local.get $op) (i32.const 86)) (i32.and (i32.ge_u (local.get $op) (i32.const 75)) (i32.le_u (local.get $op) (i32.const 76))))) (i32.eq (local.get $op) (i32.const 84)))
        (local.get $padnext)))
        (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
      (local.set $texmatrix (i32.or (i32.eq (local.get $op) (i32.const 84)) (i32.or (i32.eq (local.get $op) (i32.const 86)) (i32.and (i32.ge_u (local.get $op) (i32.const 71)) (i32.le_u (local.get $op) (i32.const 76))))))
      (local.set $coissue (i32.ne (i32.and (local.get $token) (i32.const 0x40000000)) (i32.const 0)))
      (if (i32.or (i32.ne (i32.and (local.get $token) (i32.const 0xbfff0000)) (i32.const 0))
            (i32.and (local.get $coissue) (i32.eqz (local.get $pixel))))
        (then (return (call $d3d_ir_fail (i32.const 3) (local.get $start)))))
      (local.set $arity (call $d3d_ir_arity_version (i32.load (local.get $ptr)) (local.get $op)))
      (if (i32.lt_s (local.get $arity) (i32.const 0))
        (then (return (call $d3d_ir_fail (i32.const 3) (local.get $start)))))
      (if (i32.eqz (i32.or (call $d3d_ir_profile_op (local.get $pixel) (local.get $op))
        (i32.and (local.get $pixel) (i32.or
          (i32.and (i32.ge_u (local.get $minor) (i32.const 2)) (call $d3d_ir_ps12_op (local.get $op)))
          (i32.and (i32.eq (local.get $minor) (i32.const 3)) (i32.eq (local.get $op) (i32.const 84)))))))
        (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
      (if (i32.eq (local.get $op) (i32.const 31)) (then
        (if (local.get $executable)
          (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start))))))
        (else (if (i32.ne (local.get $op) (i32.const 81))
          (then (local.set $executable (i32.const 1))))))
      (if (i32.gt_u (i32.add (local.get $at) (local.get $arity)) (local.get $count))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
      (if (i32.ge_u (local.get $n) (i32.const 4096))
        (then (return (call $d3d_ir_fail (i32.const 11) (local.get $start)))))
      ;; Even if another instance changes input during the two passes, emission
      ;; cannot exceed the exact allocation reserved by the first pass.
      (if (local.get $out) (then
        (if (i32.ge_u (local.get $n) (i32.load offset=16 (local.get $out)))
          (then (return (call $d3d_ir_fail (i32.const 11) (local.get $start)))))))
      (local.set $record (i32.add (local.get $out) (i32.add (i32.const 32) (i32.shl (local.get $n) (i32.const 7)))))
      (if (local.get $out) (then
        (i32.store (local.get $record) (local.get $op))
        (i32.store offset=4 (local.get $record) (local.get $start))
        (i32.store offset=8 (local.get $record) (local.get $arity))
        (i32.store offset=12 (local.get $record) (local.get $coissue))))
      (local.set $matrix (i32.and (i32.ge_u (local.get $op) (i32.const 20)) (i32.le_u (local.get $op) (i32.const 24))))
      (local.set $bumpop (i32.and (i32.ge_u (local.get $op) (i32.const 67)) (i32.le_u (local.get $op) (i32.const 68))))
      (local.set $textureop (i32.and (local.get $pixel) (i32.ge_u (local.get $op) (i32.const 64))))
      (if (i32.ge_u (local.get $op) (i32.const 80)) (then (local.set $textureop (i32.const 0))))
      (if (call $d3d_ir_ps12_texture (local.get $op)) (then (local.set $textureop (local.get $pixel))))
      (if (i32.eq (local.get $op) (i32.const 84)) (then (local.set $textureop (local.get $pixel))))
      (if (i32.eq (local.get $op) (i32.const 88)) (then
        (local.set $cmps (i32.add (local.get $cmps) (i32.const 1)))
        (if (i32.gt_u (local.get $cmps) (i32.const 3)) (then (return (call $d3d_ir_fail (i32.const 19) (local.get $start)))))))
      ;; DP4 occupies both vector and alpha pipelines (DX8.1 SDK dp4).
      (if (i32.and (local.get $coissue) (i32.or (i32.eq (local.get $op) (i32.const 9)) (i32.eq (local.get $previousop) (i32.const 9))))
        (then (return (call $d3d_ir_fail (i32.const 9) (local.get $start)))))
      (local.set $dstmask (i32.const 0)) (local.set $dstbank (i32.const -1))
      (if (local.get $arity) (then
        (local.set $arg (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
        (local.set $dstmask (i32.and (i32.shr_u (local.get $arg) (i32.const 16)) (i32.const 15)))
        (local.set $dstbank (call $d3d_ir_bank (local.get $arg)))
        (local.set $dstindex (i32.and (local.get $arg) (i32.const 2047)))))
      ;; oFog/oPts consume only the scalar result x, irrespective of implicit
      ;; default mask15 vs explicit scalar encoding1. IR retains raw operands.
      (if (i32.and (i32.eqz (local.get $pixel)) (i32.and (i32.eq (local.get $dstbank) (i32.const 4)) (i32.ne (local.get $dstindex) (i32.const 0)))) (then
        (if (i32.or (local.get $matrix) (i32.eqz (i32.or (i32.eq (local.get $dstmask) (i32.const 1)) (i32.eq (local.get $dstmask) (i32.const 15)))))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $dstmask (i32.const 1))))
      (if (i32.and (local.get $pixel) (i32.and (i32.eq (local.get $op) (i32.const 9)) (i32.ne (local.get $dstbank) (i32.const 0))))
        (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
      (if (local.get $coissue) (then
        (if (i32.or (local.get $textureop)
              (i32.eqz (i32.or (i32.and (i32.eq (local.get $previousmask) (i32.const 7)) (i32.eq (local.get $dstmask) (i32.const 8)))
                (i32.and (i32.eq (local.get $previousmask) (i32.const 8)) (i32.eq (local.get $dstmask) (i32.const 7))))))
          (then (return (call $d3d_ir_fail (i32.const 9) (local.get $start)))))))
      (local.set $firstconst (i32.const -1)) (local.set $secondconst (i32.const -1))
      (local.set $firstinput (i32.const -1)) (local.set $firsttexture (i32.const -1)) (local.set $secondtexture (i32.const -1))
      (local.set $constant_reads (i32.const 0)) (local.set $texture_reads (i32.const 0))
      (local.set $newtemps (local.get $temps))
      (if (i32.and (local.get $matrix) (local.get $pixel))
        (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))
      (if (local.get $coissue) (then
        (if (i32.or (i32.eqz (local.get $lastwrite))
              (i32.or (i32.eq (local.get $op) (i32.const 31))
                (i32.or (i32.eq (local.get $op) (i32.const 81)) (i32.eq (local.get $op) (i32.const 65)))))
          (then (return (call $d3d_ir_fail (i32.const 9) (local.get $start)))))
        (global.set $d3d_ir_flags (i32.or (global.get $d3d_ir_flags) (i32.const 2)))))
      (local.set $i (i32.const 0))
      (block $args_end (loop $args
        (br_if $args_end (i32.ge_u (local.get $i) (local.get $arity)))
        (local.set $arg (i32.load (i32.add (local.get $ptr) (i32.shl (i32.add (local.get $at) (local.get $i)) (i32.const 2)))))
        (local.set $bank (call $d3d_ir_bank (local.get $arg)))
        (local.set $index (i32.and (local.get $arg) (i32.const 2047)))
        (local.set $write (i32.eqz (local.get $i)))
        (local.set $relative (i32.ne (i32.and (local.get $arg) (i32.const 8192)) (i32.const 0)))
        (local.set $sel (i32.and (i32.shr_u (local.get $arg) (i32.const 16)) (i32.const 255)))
        (local.set $mod (i32.and (i32.shr_u (local.get $arg) (i32.const 24)) (i32.const 15)))
        (block $normalized
          (if (i32.and (i32.eq (local.get $op) (i32.const 81)) (i32.ne (local.get $i) (i32.const 0))) (then
            (if (i32.eq (i32.and (local.get $arg) (i32.const 0x7f800000)) (i32.const 0x7f800000))
              (then (return (call $d3d_ir_fail (i32.const 14) (i32.add (local.get $at) (local.get $i))))))
            (local.set $bank (i32.const 255)) (local.set $index (local.get $arg))
            (local.set $sel (i32.const 0)) (local.set $mod (i32.const 0)) (br $normalized)))
          (if (i32.eqz (i32.and (local.get $arg) (i32.const 0x80000000)))
            (then (return (call $d3d_ir_fail (i32.const 5) (i32.add (local.get $at) (local.get $i))))))
          (if (i32.and (local.get $arg) (i32.const 0xc000))
            (then (return (call $d3d_ir_fail (i32.const 5) (i32.add (local.get $at) (local.get $i))))))
          (if (local.get $relative) (then
            (if (i32.or (local.get $pixel) (i32.or (local.get $write)
                  (i32.or (i32.ne (local.get $bank) (i32.const 2))
                    (i32.or (i32.eq (local.get $op) (i32.const 31)) (i32.eqz (local.get $address))))))
              (then (return (call $d3d_ir_fail (i32.const 8) (i32.add (local.get $at) (local.get $i))))))
            (global.set $d3d_ir_flags (i32.or (global.get $d3d_ir_flags) (i32.const 1)))))
          (if (i32.eq (local.get $op) (i32.const 31)) (then
            (if (local.get $pixel) (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
            (if (local.get $write) (then
              ;; Supported usage0..13, usage-index[19:16], parameter bit31.
              (if (i32.or (i32.ne (i32.and (local.get $arg) (i32.const 0x7ff0fff0)) (i32.const 0))
                    (i32.gt_u (i32.and (local.get $arg) (i32.const 15)) (i32.const 13)))
                (then (return (call $d3d_ir_fail (i32.const 13) (i32.add (local.get $at) (local.get $i))))))
              (local.set $bank (i32.const 254))
              (local.set $index (i32.and (local.get $arg) (i32.const 15)))
              (local.set $sel (i32.and (local.get $sel) (i32.const 15)))
              (local.set $mod (i32.const 0)) (br $normalized)))
            (if (i32.ne (local.get $bank) (i32.const 1))
              (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
            (if (i32.ge_u (local.get $index) (i32.const 16))
              (then (return (call $d3d_ir_fail (i32.const 6) (i32.add (local.get $at) (local.get $i))))))
            ;; VS1.1 input declarations bind a whole register, no source
            ;; swizzle, destination shift/saturate, relative or reserved bits.
            (if (i32.ne (local.get $arg) (i32.or (i32.const 0x900f0000) (local.get $index)))
              (then (return (call $d3d_ir_fail (i32.const 13) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.and (local.get $declared_inputs) (i32.shl (i32.const 1) (local.get $index)))
              (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
            (local.set $declared_inputs (i32.or (local.get $declared_inputs) (i32.shl (i32.const 1) (local.get $index))))
            ;; DCL's register token is a declaration destination, not a source.
            (local.set $sel (i32.and (local.get $sel) (i32.const 15)))
            (local.set $mod (i32.const 0)) (br $normalized)))
          (if (i32.and (i32.eq (local.get $op) (i32.const 81)) (local.get $write)) (then
            (if (i32.or (i32.ne (local.get $bank) (i32.const 2))
                  (i32.ge_u (local.get $index) (select (i32.const 8) (i32.const 96) (local.get $pixel))))
              (then (return (call $d3d_ir_fail (i32.const 14) (local.get $start)))))
            (local.set $sel (i32.const 15)) (local.set $mod (i32.const 0)) (br $normalized)))
          (if (i32.eqz (call $d3d_ir_reg_ok (local.get $pixel) (local.get $bank) (local.get $index) (local.get $write)))
            (then (return (call $d3d_ir_fail (i32.const 6) (i32.add (local.get $at) (local.get $i))))))
          ;; TEXKILL reads original coordinates, not the mutable texture
          ;; register consumed by TEXBEM; it does not consume a register port.
          ;; TEXM3x2DEPTH consumes its destination for the remainder of shader.
          (if (i32.and (local.get $pixel) (i32.and (i32.eq (local.get $bank) (i32.const 3))
            (i32.ne (i32.and (local.get $depthused) (i32.shl (i32.const 1) (local.get $index))) (i32.const 0))))
            (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
          (if (i32.and (local.get $write) (i32.eq (local.get $op) (i32.const 84))) (then
            (if (i32.or (i32.ne (local.get $bank) (i32.const 3)) (i32.or (i32.ne (local.get $sel) (i32.const 15)) (local.get $mod)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
          (if (i32.and (local.get $write)
                (i32.or (call $d3d_ir_ps12_texture (local.get $op)) (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 64)) (i32.le_u (local.get $op) (i32.const 66)))
                  (i32.and (i32.ge_u (local.get $op) (i32.const 67)) (i32.le_u (local.get $op) (i32.const 76))))))
            (then (if (i32.or (i32.eqz (local.get $pixel)) (i32.ne (local.get $bank) (i32.const 3)))
              (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))))
          (if (local.get $write) (then
            (local.set $shift (local.get $mod))
            (local.set $mod (i32.shr_u (local.get $sel) (i32.const 4)))
            (local.set $sel (i32.and (local.get $sel) (i32.const 15)))
            (if (i32.eqz (local.get $pixel)) (then
              (if (i32.or (i32.ne (local.get $mod) (i32.const 0)) (i32.ne (local.get $shift) (i32.const 0)))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              ;; oPos must be COMPLETELY written by the end of the shader, not
              ;; by any one instruction. Requiring a full xyzw mask here
              ;; refused the ordinary vs_1_1 transform, which is four separate
              ;; dp4s -- oPos.x, oPos.y, oPos.z, oPos.w against four rows of
              ;; the clip matrix. Black & White 2 writes every one of its
              ;; vertex shaders that way, so this rule refused 107 of the 137
              ;; shaders it creates at the main menu, the game silently fell
              ;; back to fixed-function vertex processing for all of them, and
              ;; the world painted flat. The completeness requirement itself is
              ;; real and is enforced at the end of the scan, where $position
              ;; is now the union of the masks rather than a flag.
              ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-registers-output-1-1
              ;; FRC is a restricted vs_1_1 macro, not the later full-vector op.
              (if (i32.and (i32.eq (local.get $op) (i32.const 19))
                    (i32.and (i32.ne (local.get $sel) (i32.const 2)) (i32.ne (local.get $sel) (i32.const 3))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (if (local.get $pixel) (then
              (if (i32.or (i32.eq (local.get $shift) (i32.const 3))
                    (i32.or (i32.eq (local.get $shift) (i32.const 13)) (i32.eq (local.get $shift) (i32.const 14))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.eqz (i32.or (i32.eq (local.get $sel) (i32.const 15))
                    (i32.or (i32.eq (local.get $sel) (i32.const 7)) (i32.eq (local.get $sel) (i32.const 8)))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.and (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $sel) (i32.const 8)))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.and (local.get $textureop) (i32.or (i32.ne (local.get $sel) (i32.const 15))
                    (i32.or (i32.ne (local.get $mod) (i32.const 0)) (i32.ne (local.get $shift) (i32.const 0)))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (if (local.get $matrix) (then
              (local.set $rows (select (i32.const 4) (select (i32.const 2) (i32.const 3) (i32.eq (local.get $op) (i32.const 24)))
                (i32.or (i32.eq (local.get $op) (i32.const 20)) (i32.eq (local.get $op) (i32.const 22)))))
              ;; Legacy VS1.0 binaries encode the default xyzw mask for matrix
              ;; macros. Lower only their implicit row count, preserving other
              ;; components, as Wine shader_glsl_mnxn does. VS1.1 retains its
              ;; explicit-mask validation; arbitrary partial masks still fail.
              ;; https://github.com/wine-mirror/wine/blob/master/dlls/wined3d/glsl_shader.c
              (if (i32.and (i32.eq (i32.load (local.get $ptr)) (i32.const 0xfffe0100))
                    (i32.eq (local.get $sel) (i32.const 15))) (then
                (local.set $sel (i32.sub (i32.shl (i32.const 1) (local.get $rows)) (i32.const 1)))
                (local.set $dstmask (local.get $sel))))
              (if (i32.ne (local.get $sel) (i32.sub (i32.shl (i32.const 1) (local.get $rows)) (i32.const 1)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))))
            (if (i32.or (i32.eqz (local.get $sel))
                  (i32.or (i32.gt_u (local.get $mod) (i32.const 1))
                    (i32.and (i32.gt_u (local.get $shift) (i32.const 3)) (i32.lt_u (local.get $shift) (i32.const 13)))))
              (then (return (call $d3d_ir_fail (i32.const 7) (i32.add (local.get $at) (local.get $i))))))
            (if (i32.gt_u (local.get $shift) (i32.const 8))
              (then (local.set $shift (i32.sub (local.get $shift) (i32.const 16)))))
            (local.set $mod (i32.or (local.get $mod) (i32.shl (i32.and (local.get $shift) (i32.const 255)) (i32.const 8))))
            (if (i32.and (i32.eqz (local.get $pixel)) (i32.eq (local.get $bank) (i32.const 3))) (then
              (if (i32.or (i32.ne (local.get $op) (i32.const 1)) (i32.ne (local.get $sel) (i32.const 1)))
                (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))))
            ;; Accumulate which components of oPos have been written, the way
            ;; $d3d_ir_scan20 already does, so a shader that fills it across
            ;; several instructions is accepted and one that leaves a
            ;; component unwritten is still refused.
            (if (i32.and (i32.eqz (local.get $pixel)) (i32.and (i32.eq (local.get $bank) (i32.const 4)) (i32.eqz (local.get $index))))
              (then (local.set $position (i32.or (local.get $position) (local.get $sel)))))
            (if (i32.eqz (local.get $bank))
              (then (local.set $newtemps (i64.or (local.get $newtemps) (i64.shl (i64.extend_i32_u (local.get $sel))
                (i64.extend_i32_u (i32.shl (local.get $index) (i32.const 2)))))))))
          (else
            (if (i32.eqz (local.get $bank)) (then
              (local.set $readmask (call $d3d_ir_swizzle_mask
                (call $d3d_ir_read_mask (local.get $op) (local.get $i) (local.get $dstmask)) (local.get $sel)))
              (local.set $readrows (select (local.get $rows) (i32.const 1)
                (i32.and (local.get $matrix) (i32.eq (local.get $i) (i32.const 2)))))
              (if (i32.gt_u (i32.add (local.get $index) (local.get $readrows)) (i32.const 12))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))
              (local.set $readrow (i32.const 0))
              (loop $temporary_rows
                (local.set $needed (i64.shl (i64.extend_i32_u (local.get $readmask))
                  (i64.extend_i32_u (i32.shl (i32.add (local.get $index) (local.get $readrow)) (i32.const 2)))))
                (if (i64.ne (i64.and (select (local.get $before_previous) (local.get $temps) (local.get $coissue))
                      (local.get $needed)) (local.get $needed))
                  (then (return (call $d3d_ir_fail (i32.const 17) (i32.add (local.get $at) (local.get $i))))))
                (local.set $readrow (i32.add (local.get $readrow) (i32.const 1)))
                (br_if $temporary_rows (i32.lt_u (local.get $readrow) (local.get $readrows))))))
            (if (i32.eqz (local.get $pixel)) (then
              (if (i32.gt_u (local.get $mod) (i32.const 1))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.eq (local.get $bank) (i32.const 1)) (then
                (if (i32.and (i32.ne (local.get $firstinput) (i32.const -1)) (i32.ne (local.get $firstinput) (local.get $index)))
                  (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))
                (local.set $firstinput (local.get $index))))))
            (if (local.get $pixel) (then
              (if (i32.gt_u (local.get $mod) (i32.const 6))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.eqz (i32.or (i32.eq (local.get $sel) (i32.const 228))
                    (i32.or (i32.eq (local.get $sel) (i32.const 255))
                      (i32.and (i32.eq (local.get $sel) (i32.const 170)) (i32.eq (local.get $dstmask) (i32.const 8))))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.and (i32.and (local.get $textureop) (i32.eqz (i32.and (i32.eq (local.get $op) (i32.const 75)) (i32.eq (local.get $i) (i32.const 2))))) (i32.or (i32.and (i32.ne (local.get $mod) (i32.const 0))
                    (i32.eqz (i32.and (i32.or (local.get $texmatrix) (i32.ge_u (local.get $minor) (i32.const 2))) (i32.eq (local.get $mod) (i32.const 4)))))
                    (i32.or (i32.ne (local.get $sel) (i32.const 228)) (i32.ne (local.get $bank) (i32.const 3)))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              (if (i32.and (i32.and (i32.eq (local.get $i) (i32.const 1)) (i32.and (i32.ge_u (local.get $op) (i32.const 67)) (i32.le_u (local.get $op) (i32.const 76)))) (i32.ge_u (local.get $index) (local.get $dstindex)))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              ;; SPEC's eye vector is an unmodified constant, not a texture
              ;; register; only xyz contributes. General modifiers deferred.
              (if (i32.and (i32.eq (local.get $op) (i32.const 75)) (i32.eq (local.get $i) (i32.const 2))) (then
                (if (i32.or (i32.ne (local.get $bank) (i32.const 2)) (i32.or (i32.ne (local.get $sel) (i32.const 228)) (local.get $mod)))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
              (if (i32.and (call $d3d_ir_ps12_texture (local.get $op)) (i32.eq (local.get $i) (i32.const 1))) (then
                (if (i32.or (i32.ge_u (local.get $index) (local.get $dstindex))
                  (i32.eqz (i32.and (local.get $texwritten) (i32.shl (i32.const 1) (local.get $index)))))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
              (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 88)) (i32.eq (local.get $op) (i32.const 9))) (i32.and
                (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $index) (local.get $dstindex))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
              ;; TEXBEM sources become unavailable to subsequent non-bump reads.
              (if (i32.and (i32.eq (local.get $bank) (i32.const 3))
                    (i32.eqz (local.get $bumpop))) (then
                (if (i32.and (local.get $bumpused) (i32.shl (i32.const 1) (local.get $index)))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
              (if (local.get $bumpop) (then
                (local.set $bumpused (i32.or (local.get $bumpused) (i32.shl (i32.const 1) (local.get $index))))))
              (if (i32.and (i32.eq (local.get $op) (i32.const 80)) (i32.eq (local.get $i) (i32.const 1)))
                (then (if (i32.or (i32.ne (local.get $bank) (i32.const 0))
                    (i32.or (i32.ne (local.get $index) (i32.const 0))
                      (i32.or (i32.ne (local.get $sel) (i32.const 255)) (i32.ne (local.get $mod) (i32.const 0)))))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))))
            (if (i32.eq (local.get $bank) (i32.const 2)) (then
              (if (local.get $pixel) (then (local.set $constant_reads
                (i32.or (local.get $constant_reads) (i32.shl (i32.const 1) (local.get $index))))))
              (local.set $ports (i32.or (local.get $index) (i32.shl (local.get $relative) (i32.const 16))))
              (if (i32.eq (local.get $firstconst) (i32.const -1)) (then (local.set $firstconst (local.get $ports))))
              (if (i32.ne (local.get $firstconst) (local.get $ports)) (then
                (if (i32.eqz (local.get $pixel)) (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))
                (if (i32.eq (local.get $secondconst) (i32.const -1)) (then (local.set $secondconst (local.get $ports))))
                (if (i32.ne (local.get $secondconst) (local.get $ports)) (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))))))
            (if (i32.and (local.get $pixel) (i32.eq (local.get $bank) (i32.const 3))) (then
              (local.set $texture_reads (i32.or (local.get $texture_reads) (i32.shl (i32.const 1) (local.get $index))))
              (if (i32.eq (local.get $firsttexture) (i32.const -1)) (then (local.set $firsttexture (local.get $index))))
              (if (i32.ne (local.get $firsttexture) (local.get $index)) (then
                (if (i32.eq (local.get $secondtexture) (i32.const -1)) (then (local.set $secondtexture (local.get $index))))
                (if (i32.ne (local.get $secondtexture) (local.get $index)) (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))))))
            (if (i32.and (local.get $matrix) (i32.eq (local.get $i) (i32.const 1))) (then
              (if (i32.eq (local.get $bank) (i32.const 2))
                (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))
              (if (i32.and (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $index) (local.get $dstindex)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))))
            (if (i32.gt_u (local.get $mod) (i32.const 8))
              (then (return (call $d3d_ir_fail (i32.const 7) (i32.add (local.get $at) (local.get $i))))))
            (local.set $mod (i32.or (local.get $mod) (i32.shl (local.get $relative) (i32.const 8))))
            (if (i32.and (local.get $matrix) (i32.eq (local.get $i) (i32.const 2))) (then
              (if (i32.or (i32.ne (local.get $sel) (i32.const 228)) (i32.ne (i32.and (local.get $mod) (i32.const 255)) (i32.const 0)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))
              (local.set $rows (select (i32.const 4)
                (select (i32.const 2) (i32.const 3) (i32.eq (local.get $op) (i32.const 24)))
                (i32.or (i32.eq (local.get $op) (i32.const 20)) (i32.eq (local.get $op) (i32.const 22)))))
              (if (i32.eqz (call $d3d_ir_reg_ok (local.get $pixel) (local.get $bank)
                    (i32.sub (i32.add (local.get $index) (local.get $rows)) (i32.const 1)) (i32.const 0)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start))))))))))
        (if (local.get $out) (then
          (local.set $operand (i32.add (local.get $record) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 4)))))
          (i32.store (local.get $operand) (local.get $bank))
          (i32.store offset=4 (local.get $operand) (local.get $index))
          (i32.store offset=8 (local.get $operand) (local.get $sel))
          (i32.store offset=12 (local.get $operand) (local.get $mod))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $args)))
      ;; SDK DirectX8.1 Registers p49: coissued instructions have a combined
      ;; limit of THREE distinct registers per bank, not two. The individual
      ;; instruction limit above remains two. Color/temp banks have only two
      ;; PS1.1 registers, so their combined limit cannot be exceeded.
      ;; https://documentation.help/directx8_c/documentation.pdf
      (if (local.get $coissue) (then
        (if (i32.or
              (i32.gt_u (i32.popcnt (i32.or (local.get $constant_reads) (local.get $previous_constant_reads))) (i32.const 3))
              (i32.gt_u (i32.popcnt (i32.or (local.get $texture_reads) (local.get $previous_texture_reads))) (i32.const 3)))
          (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))))
      (local.set $previous_constant_reads (local.get $constant_reads))
      (local.set $previous_texture_reads (local.get $texture_reads))
      ;; PS1.1 texm3x2 sequence uses the same initialized source register and
      ;; modifier, with destination stages m and m+1. PAD does not publish t(m).
      (if (local.get $texmatrix) (then
        (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (i32.add (local.get $start) (i32.const 2)) (i32.const 2)))))
        (if (i32.eqz (i32.and (local.get $texwritten) (i32.shl (i32.const 1) (i32.and (local.get $token) (i32.const 2047)))))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (if (i32.and (i32.eqz (local.get $padstage)) (i32.or
          (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 73)))) (then
          (if (i32.ge_u (local.get $dstindex) (select (i32.const 2) (i32.const 3) (i32.eq (local.get $op) (i32.const 73))))
            (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
          (local.set $padnext (select (i32.const 73) (i32.const 72) (i32.eq (local.get $op) (i32.const 73))))
          (local.set $padstage (local.get $dstindex)) (local.set $padsource (local.get $token)))
        (else
          (if (i32.or (i32.eqz (local.get $padstage)) (i32.or
                (i32.ne (local.get $dstindex) (i32.add (local.get $padstage) (i32.const 1)))
                (i32.ne (local.get $token) (local.get $padsource))))
            (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
          (if (i32.eq (local.get $op) (i32.const 73)) (then
            (local.set $padstage (local.get $dstindex)) (local.set $padnext (i32.const 74)))
          (else (local.set $padstage (i32.const 0))))))))
      (if (i32.and (local.get $pixel) (i32.and (i32.eq (local.get $dstbank) (i32.const 3))
            (i32.and (i32.ne (local.get $op) (i32.const 65)) (i32.and (i32.ne (local.get $op) (i32.const 71)) (i32.ne (local.get $op) (i32.const 73))))))
        (then (local.set $texwritten (i32.or (local.get $texwritten) (i32.shl (i32.const 1) (local.get $dstindex))))))
      ;; Address writes become available only after all sources were validated.
      (if (i32.eq (local.get $op) (i32.const 84)) (then
        (local.set $depthused (i32.or (local.get $depthused) (i32.shl (i32.const 1) (local.get $dstindex))))))
      (local.set $before_previous (local.get $temps)) (local.set $temps (local.get $newtemps))
      (local.set $cost (i32.const 0))
      (if (i32.and (i32.ne (local.get $op) (i32.const 31)) (i32.ne (local.get $op) (i32.const 81))) (then
        (local.set $cost (i32.const 1))
        (if (local.get $pixel) (then
          (if (i32.or (i32.eq (local.get $op) (i32.const 9)) (i32.eq (local.get $op) (i32.const 88))) (then (local.set $cost (i32.const 2))))
          ;; Inferred conservative scheduling policy: a paired group costs
          ;; max(member slots), so any CMP pair costs two. Exact historic REF
          ;; boundary acceptance remains a conformance gate, not measured here.
          (if (local.get $coissue) (then
            (local.set $cost (i32.and (i32.eq (local.get $op) (i32.const 88)) (i32.ne (local.get $previousop) (i32.const 88))))))
          (if (i32.eqz (local.get $op)) (then (local.set $cost (i32.const 0)))))
        (else
          (if (local.get $matrix) (then (local.set $cost (local.get $rows))))
          (if (i32.or (i32.eq (local.get $op) (i32.const 14)) (i32.eq (local.get $op) (i32.const 15)))
            (then (local.set $cost (i32.const 10))))
          (if (i32.eq (local.get $op) (i32.const 19)) (then (local.set $cost (i32.const 3))))))))
      (if (local.get $textureop) (then (local.set $textures (i32.add (local.get $textures) (local.get $cost))))
        (else (local.set $arithmetic (i32.add (local.get $arithmetic) (local.get $cost)))))
      ;; TEXBEML consumes both one texture slot and one arithmetic slot.
      (if (i32.eq (local.get $op) (i32.const 68))
        (then (local.set $arithmetic (i32.add (local.get $arithmetic) (i32.const 1)))))
      (if (i32.or (i32.gt_u (local.get $textures) (i32.const 4))
            (i32.gt_u (local.get $arithmetic) (select (i32.const 8) (i32.const 128) (local.get $pixel))))
        (then (return (call $d3d_ir_fail (i32.const 19) (local.get $start)))))
      (if (i32.ne (local.get $op) (i32.const 0)) (then (local.set $previousmask (local.get $dstmask))))
      (if (i32.eqz (local.get $op)) (then (local.set $lastwrite (i32.const 0))))
      (local.set $previousop (local.get $op))
      (if (i32.and (i32.eqz (local.get $pixel)) (i32.eq (local.get $op) (i32.const 1)))
        (then (if (i32.eq (call $d3d_ir_bank (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2))))) (i32.const 3))
          (then (local.set $address (i32.const 1))))))
      (if (i32.ne (local.get $op) (i32.const 0)) (then
        (local.set $lastwrite (i32.and (i32.eqz (local.get $coissue))
          (i32.and (i32.ne (local.get $op) (i32.const 31))
            (i32.and (i32.ne (local.get $op) (i32.const 81)) (i32.ne (local.get $op) (i32.const 65))))))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (local.set $at (i32.add (local.get $at) (local.get $arity))) (br $instructions)))
    ;; All four components, not merely "something wrote oPos" -- the same
    ;; condition $d3d_ir_scan20 ends on. A shader that writes only oPos.xyz
    ;; leaves w undefined and the projection divide is then meaningless.
    (if (i32.and (i32.eqz (local.get $pixel)) (i32.ne (local.get $position) (i32.const 15)))
      (then (return (call $d3d_ir_fail (i32.const 10) (local.get $start)))))
    (global.set $d3d_ir_length (local.get $at)) (local.get $n))
  ;; Private VS2.0 prerequisite. Same normalized IR ABI; relative bit8 means
  ;; explicitly encoded a0 component (bits11..12), or scalar aL with bit10.
  ;; Address-register/VS-differences pages specify vector a0 for VS2.0 despite
  ;; MOVA remarks saying2_x. Follow the former; no public gate change.
  ;; https://learn.microsoft.com/en-us/windows-hardware/drivers/display/shader-relative-addressing
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/loop---vs
  ;; https://learn.microsoft.com/en-us/windows-hardware/drivers/display/instruction-token
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-registers-vs-2-0
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/mova---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-instructions-vs-2-0
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/expp---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/crs---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/nrm---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/pow---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/sgn---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/sincos---vs
  ;; https://learn.microsoft.com/en-us/windows-hardware/drivers/display/sincos-instruction
  (func $d3d_ir_arity20 (param $op i32) (result i32)
    (if (i32.or (i32.eq (local.get $op) (i32.const 25)) (i32.eq (local.get $op) (i32.const 30))) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 26)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 28)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 27)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 29)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 38)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 39)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 40)) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 42)) (i32.eq (local.get $op) (i32.const 43))) (then (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 47)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $op) (i32.const 48)) (then (return (i32.const 5))))
    (if (i32.eq (local.get $op) (i32.const 37)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $op) (i32.const 34)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $op) (i32.const 32)) (then (return (i32.const 3))))
    (if (i32.eq (local.get $op) (i32.const 33)) (then (return (i32.const 3))))
    (if (i32.eq (local.get $op) (i32.const 36)) (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 46)) (i32.eq (local.get $op) (i32.const 35))) (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 78)) (i32.eq (local.get $op) (i32.const 79)))
      (then (return (call $d3d_ir_arity (local.get $op)))))
    (if (i32.and (i32.ge_u (local.get $op) (i32.const 20)) (i32.le_u (local.get $op) (i32.const 24)))
      (then (return (call $d3d_ir_arity (local.get $op)))))
    (if (i32.or (i32.le_u (local.get $op) (i32.const 19))
      (i32.or (i32.eq (local.get $op) (i32.const 19))
      (i32.or (i32.eq (local.get $op) (i32.const 31)) (i32.eq (local.get $op) (i32.const 81)))))
      (then (return (call $d3d_ir_arity (local.get $op)))))
    (i32.const -1))
  ;; Private profile dependencies, before source swizzle. Keep VS1 EXPP.w
  ;; constant-one behavior in the shared legacy helper, not in this profile.
  (func $d3d_ir_read_mask20 (param $op i32) (param $source i32) (param $mask i32) (result i32)
    (if (i32.eq (local.get $op) (i32.const 37)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 34)) (then (return (local.get $mask))))
    (if (i32.eq (local.get $op) (i32.const 32)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 78)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 33)) (then
      (return (i32.or (select (i32.const 6) (i32.const 0) (i32.and (local.get $mask) (i32.const 1)))
        (i32.or (select (i32.const 5) (i32.const 0) (i32.and (local.get $mask) (i32.const 2)))
          (select (i32.const 3) (i32.const 0) (i32.and (local.get $mask) (i32.const 4))))))))
    (if (i32.eq (local.get $op) (i32.const 36)) (then
      (return (i32.or (i32.const 7) (i32.and (local.get $mask) (i32.const 8))))))
    (call $d3d_ir_read_mask (local.get $op) (local.get $source) (local.get $mask)))
  ;; VS2 calls are forward-only and nonnested. CALLNZ may use Boolean NOT.
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/call---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/callnz-bool---vs
  ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/ret---vs
  ;; Bounded source lookup, no allocation or execution. Return the first
  ;; canonical label's body offset; the lexical scan rejects duplicates.
  (func $d3d_ir_label20 (param $ptr i32) (param $count i32) (param $label i32) (result i32)
    (local $at i32) (local $token i32) (local $next i32)
    (local.set $at (i32.const 1))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $at) (local.get $count)))
      (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
      (br_if $done (i32.eq (local.get $token) (i32.const 65535)))
      (local.set $next (i32.add (i32.add (local.get $at) (i32.const 1))
        (select (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 32767))
          (i32.and (i32.shr_u (local.get $token) (i32.const 24)) (i32.const 15))
          (i32.eq (i32.and (local.get $token) (i32.const 65535)) (i32.const 65534)))))
      (br_if $done (i32.gt_u (local.get $next) (local.get $count)))
      (if (i32.eq (local.get $token) (i32.const 0x0100001e))
        (then (if (i32.eq (i32.load (i32.add (local.get $ptr) (i32.shl (i32.add (local.get $at) (i32.const 1)) (i32.const 2))))
                   (i32.or (i32.const 0xa0e41000) (local.get $label)))
          (then (return (local.get $next))))))
      (local.set $at (local.get $next)) (br $scan)))
    (i32.const 0))
  (func $d3d_ir_scan20 (param $ptr i32) (param $count i32) (param $out i32) (result i32)
    (local $guest i32) (local $result i32)
    ;; One bounded stack per validation pass; all inner early exits return here.
    (local.set $guest (call $heap_alloc (i32.const 896)))
    (if (i32.eqz (local.get $guest)) (then (return (call $d3d_ir_fail (i32.const 12) (i32.const 0)))))
    (local.set $result (call $d3d_ir_scan20_inner (local.get $ptr) (local.get $count) (local.get $out) (call $g2w (local.get $guest))))
    (call $heap_free (local.get $guest)) (local.get $result))
  (func $d3d_ir_scan20_inner (param $ptr i32) (param $count i32) (param $out i32) (param $flow_stack i32) (result i32)
    (local $at i32) (local $start i32) (local $token i32) (local $op i32) (local $length i32) (local $end i32)
    (local $arity i32) (local $n i32) (local $record i32) (local $i i32) (local $arg i32) (local $operand i32)
    (local $bank i32) (local $index i32) (local $sel i32) (local $mod i32) (local $relative i32)
    (local $dstbank i32) (local $dstindex i32) (local $mask i32) (local $needed i32)
    (local $declared i32) (local $address i32) (local $position i32) (local $slots i32) (local $executable i32)
    (local $firstconst i32) (local $firstinput i32) (local $constantreads i32) (local $key i32) (local $temps i64)
    (local $rows i32) (local $row i32) (local $vectorbank i32) (local $rowindex i32)
    (local $scratch1 i32) (local $scratch2 i32)
    (local $definition i32)
    (local $depth i32) (local $flow_count i32) (local $frame i32)
    (local $rep_active i32) (local $rep_writes i64) (local $rep_reads i64)
    (local $loop_begin i32) (local $loop_end i32) (local $relative_token i32) (local $relative_component i32)
    (local $call_active i32) (local $replaying i32) (local $emit i32)
    (local $routine i32) (local $body_closed i32) (local $main_position i32)
    (local $target i32) (local $resume i32) (local $call_cond i32) (local $call_depth i32)
    (local $call_temps i64) (local $call_address i32) (local $call_position i32) (local $call_writes i64)
    (global.set $d3d_ir_flags (i32.const 0))
    (local.set $at (i32.const 1))
    (block $done (loop $instructions
      (if (i32.ge_u (local.get $at) (local.get $count)) (then (return (call $d3d_ir_fail (i32.const 4) (local.get $at)))))
      (local.set $start (local.get $at))
      (local.set $replaying (local.get $call_active))
      (local.set $emit (select (i32.const 0) (local.get $out) (local.get $replaying)))
      (local.set $token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
      (local.set $at (i32.add (local.get $at) (i32.const 1)))
      (br_if $done (i32.eq (local.get $token) (i32.const 65535)))
      (local.set $op (i32.and (local.get $token) (i32.const 65535)))
      (if (i32.eq (local.get $op) (i32.const 65534)) (then
        (if (i32.lt_s (local.get $token) (i32.const 0)) (then (return (call $d3d_ir_fail (i32.const 3) (local.get $start)))))
        (local.set $at (i32.add (local.get $at) (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 32767))))
        (if (i32.gt_u (local.get $at) (local.get $count)) (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
        (br $instructions)))
      (if (i32.ne (i32.and (local.get $token) (i32.const 0xf0ff0000)) (i32.const 0))
        (then (return (call $d3d_ir_fail (i32.const 3) (local.get $start)))))
      (local.set $arity (call $d3d_ir_arity20 (local.get $op)))
      (local.set $loop_begin (i32.or (i32.eq (local.get $op) (i32.const 27)) (i32.eq (local.get $op) (i32.const 38))))
      (local.set $loop_end (i32.or (i32.eq (local.get $op) (i32.const 29)) (i32.eq (local.get $op) (i32.const 39))))
      (if (i32.lt_s (local.get $arity) (i32.const 0)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
      (local.set $definition (i32.or (i32.eq (local.get $op) (i32.const 81))
        (i32.or (i32.eq (local.get $op) (i32.const 47)) (i32.eq (local.get $op) (i32.const 48)))))
      (if (i32.and (i32.and (local.get $body_closed) (i32.eqz (local.get $replaying)))
            (i32.and (i32.ne (local.get $op) (i32.const 30)) (i32.eqz (local.get $definition))))
        (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
      (local.set $rows (i32.const 0))
      (if (i32.and (i32.ge_u (local.get $op) (i32.const 20)) (i32.le_u (local.get $op) (i32.const 24))) (then
        (local.set $rows (select (i32.const 4) (select (i32.const 2) (i32.const 3) (i32.eq (local.get $op) (i32.const 24)))
          (i32.or (i32.eq (local.get $op) (i32.const 20)) (i32.eq (local.get $op) (i32.const 22)))))))
      (local.set $length (i32.and (i32.shr_u (local.get $token) (i32.const 24)) (i32.const 15)))
      (local.set $end (i32.add (local.get $at) (local.get $length)))
      (if (i32.or (i32.gt_u (local.get $end) (local.get $count)) (i32.lt_u (local.get $length) (local.get $arity)))
        (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
      (if (i32.eq (local.get $op) (i32.const 31)) (then
        (if (local.get $executable) (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start))))))
        (else (if (i32.eqz (local.get $definition)) (then (local.set $executable (i32.const 1))))))
      (if (local.get $emit) (then
        (if (i32.ge_u (local.get $n) (i32.load offset=16 (local.get $out)))
          (then (return (call $d3d_ir_fail (i32.const 11) (local.get $start)))))))
      (local.set $record (i32.add (local.get $out) (i32.add (i32.const 32) (i32.shl (local.get $n) (i32.const 7)))))
      (if (local.get $emit) (then
        (i32.store (local.get $record) (local.get $op)) (i32.store offset=4 (local.get $record) (local.get $start))
        (i32.store offset=8 (local.get $record) (local.get $arity))))
      (local.set $i (i32.const 0)) (local.set $firstconst (i32.const -1)) (local.set $firstinput (i32.const -1))
      (local.set $constantreads (i32.const 0)) (local.set $mask (i32.const 0))
      (block $args_done (loop $args
        (br_if $args_done (i32.ge_u (local.get $i) (local.get $arity)))
        (if (i32.ge_u (local.get $at) (local.get $end)) (then (return (call $d3d_ir_fail (i32.const 4) (local.get $at)))))
        (local.set $arg (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
        (local.set $at (i32.add (local.get $at) (i32.const 1)))
        (local.set $bank (call $d3d_ir_bank (local.get $arg))) (local.set $index (i32.and (local.get $arg) (i32.const 2047)))
        (local.set $sel (i32.and (i32.shr_u (local.get $arg) (i32.const 16)) (i32.const 255)))
        (local.set $mod (i32.and (i32.shr_u (local.get $arg) (i32.const 24)) (i32.const 15)))
        (block $normalized
          (if (i32.and (local.get $definition) (i32.ne (local.get $i) (i32.const 0))) (then
            (local.set $bank (i32.const 255)) (local.set $index (local.get $arg)) (local.set $sel (i32.const 0)) (local.set $mod (i32.const 0)) (br $normalized)))
          (if (i32.or (i32.ge_s (local.get $arg) (i32.const 0)) (i32.ne (i32.and (local.get $arg) (i32.const 0xc000)) (i32.const 0)))
            (then (return (call $d3d_ir_fail (i32.const 5) (i32.sub (local.get $at) (i32.const 1))))))
          ;; IF/REP have a Boolean/integer source, not a destination. This
          ;; private slice accepts canonical identity/no-modifier syntax.
          ;; REP count validity is a runtime contract, not a DEFI token filter.
          ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/rep---vs
          (if (i32.or (i32.eq (local.get $op) (i32.const 25))
                (i32.or (i32.eq (local.get $op) (i32.const 26)) (i32.eq (local.get $op) (i32.const 30)))) (then
            (if (i32.eqz (local.get $i))
              (then
                (if (i32.ne (local.get $arg) (i32.or (i32.const 0xa0e41000) (local.get $index)))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
                (local.set $target (call $d3d_ir_label20 (local.get $ptr) (local.get $count) (local.get $index))))
              (else
                (if (i32.or (i32.ge_u (local.get $index) (i32.const 16))
                      (i32.and (i32.ne (local.get $arg) (i32.or (i32.const 0xe0e40800) (local.get $index)))
                        (i32.ne (local.get $arg) (i32.or (i32.const 0xede40800) (local.get $index)))))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (br $normalized)))
          (if (i32.eq (local.get $op) (i32.const 27)) (then
            (if (i32.eqz (local.get $i))
              (then (if (i32.ne (local.get $arg) (i32.const 0xf0e40800))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start))))))
              (else (if (i32.or (i32.ge_u (local.get $index) (i32.const 16))
                  (i32.ne (local.get $arg) (i32.or (i32.const 0xf0e40000) (local.get $index))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (br $normalized)))
          (if (i32.or (i32.eq (local.get $op) (i32.const 40)) (i32.eq (local.get $op) (i32.const 38))) (then
            (if (i32.or (i32.ge_u (local.get $index) (i32.const 16))
                (i32.ne (local.get $arg) (i32.or
                  (select (i32.const 0xe0e40800) (i32.const 0xf0e40000) (i32.eq (local.get $op) (i32.const 40))) (local.get $index))))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (br $normalized)))
          (if (i32.eq (local.get $op) (i32.const 31)) (then
            (if (i32.eqz (local.get $i)) (then
              (if (i32.or (i32.ne (i32.and (local.get $arg) (i32.const 0xfff0fff0)) (i32.const 0x80000000)) (i32.gt_u (i32.and (local.get $arg) (i32.const 15)) (i32.const 13)))
                (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
              (local.set $bank (i32.const 254)) (local.set $index (i32.and (local.get $arg) (i32.const 15)))
              (local.set $sel (i32.and (local.get $sel) (i32.const 15))))
            (else
              (if (i32.or (i32.ge_u (local.get $index) (i32.const 16)) (i32.ne (local.get $arg) (i32.or (i32.const 0x900f0000) (local.get $index))))
                (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
              (if (i32.and (local.get $declared) (i32.shl (i32.const 1) (local.get $index))) (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
              (local.set $declared (i32.or (local.get $declared) (i32.shl (i32.const 1) (local.get $index))))
              (local.set $sel (i32.const 15))))
            (local.set $mod (i32.const 0)) (br $normalized)))
          (if (i32.eqz (local.get $i)) (then
            (local.set $sel (i32.and (local.get $sel) (i32.const 15)))
            (if (i32.or (i32.eqz (local.get $sel)) (i32.ne (i32.and (local.get $arg) (i32.const 0x0fe0e000)) (i32.const 0)))
              (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))
            (local.set $mod (i32.and (i32.shr_u (local.get $arg) (i32.const 20)) (i32.const 1)))
            (if (i32.eq (local.get $op) (i32.const 37)) (then
              (if (i32.or (i32.ne (local.get $bank) (i32.const 0)) (i32.gt_u (local.get $sel) (i32.const 3)))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (if (i32.and (i32.eq (local.get $op) (i32.const 32)) (i32.ne (local.get $bank) (i32.const 0)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (if (i32.or (i32.eq (local.get $op) (i32.const 33)) (i32.eq (local.get $op) (i32.const 36))) (then
              (if (i32.or (i32.ne (local.get $bank) (i32.const 0))
                (i32.and (i32.eq (local.get $op) (i32.const 33)) (i32.gt_u (local.get $sel) (i32.const 7))))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (if (i32.ne (local.get $rows) (i32.const 0)) (then
              (if (i32.ne (local.get $sel) (i32.sub (i32.shl (i32.const 1) (local.get $rows)) (i32.const 1)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))))
            (if (i32.eq (local.get $op) (i32.const 81)) (then
              (if (i32.or (i32.ne (local.get $bank) (i32.const 2)) (i32.or (i32.ge_u (local.get $index) (i32.const 256)) (i32.or (i32.ne (local.get $sel) (i32.const 15)) (local.get $mod))))
                (then (return (call $d3d_ir_fail (i32.const 14) (local.get $start))))) (br $normalized)))
            ;; Canonical full-mask typed definitions. Immediate raw words are
            ;; never interpreted as parameter tokens or floating-point values.
            ;; DEFB accepts any nonzero DWORD as TRUE; execution normalizes it.
            (if (i32.or (i32.eq (local.get $op) (i32.const 47)) (i32.eq (local.get $op) (i32.const 48))) (then
              (if (i32.or (i32.ne (local.get $bank)
                    (select (i32.const 14) (i32.const 7) (i32.eq (local.get $op) (i32.const 47))))
                  (i32.or (i32.ge_u (local.get $index) (i32.const 16))
                    (i32.or (i32.ne (local.get $sel) (i32.const 15)) (local.get $mod))))
                (then (return (call $d3d_ir_fail (i32.const 14) (local.get $start)))))
              (br $normalized)))
            (if (i32.eq (local.get $op) (i32.const 46)) (then
              (if (i32.ne (local.get $arg) (i32.or (i32.const 0xb0000000) (i32.shl (local.get $sel) (i32.const 16))))
                (then (return (call $d3d_ir_fail (i32.const 8) (local.get $start))))))
            (else
              (if (i32.eq (local.get $bank) (i32.const 3)) (then (return (call $d3d_ir_fail (i32.const 8) (local.get $start)))))
              (if (i32.eqz (call $d3d_ir_reg_ok (i32.const 0) (local.get $bank) (local.get $index) (i32.const 1)))
                (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))
              (if (i32.and (i32.eq (local.get $bank) (i32.const 4)) (i32.ne (local.get $index) (i32.const 0))) (then
                (if (i32.ne (local.get $sel) (i32.const 1)) (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))))))
            (local.set $dstbank (local.get $bank)) (local.set $dstindex (local.get $index)) (local.set $mask (local.get $sel)) (br $normalized)))
          (if (i32.gt_u (local.get $mod) (i32.const 1)) (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))
          (if (i32.and (i32.eq (local.get $op) (i32.const 37)) (i32.eq (local.get $i) (i32.const 1))) (then
            (if (i32.and (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $index) (local.get $dstindex)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (if (i32.ne (local.get $sel) (i32.mul (i32.and (local.get $sel) (i32.const 3)) (i32.const 85)))
              (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))))
          ;; SGN scratch operands are clobbers, not reads. Source/destination
          ;; overlap is not prohibited by the published instruction contract.
          (if (i32.and (i32.eq (local.get $op) (i32.const 34)) (i32.ge_u (local.get $i) (i32.const 2))) (then
            (if (i32.or (i32.ne (local.get $bank) (i32.const 0)) (i32.ge_u (local.get $index) (i32.const 12)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (if (i32.and (local.get $arg) (i32.const 8192))
              (then (return (call $d3d_ir_fail (i32.const 8) (local.get $start)))))
            (if (i32.eq (local.get $i) (i32.const 2)) (then (local.set $scratch1 (local.get $index)))
              (else
                (local.set $scratch2 (local.get $index))
                (if (i32.eq (local.get $scratch1) (local.get $scratch2))
                  (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (br $normalized)))
          ;; POW may overwrite its base, but never its exponent register.
          (if (i32.and (i32.eq (local.get $op) (i32.const 32)) (i32.eq (local.get $i) (i32.const 2))) (then
            (if (i32.and (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $index) (local.get $dstindex)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
          (if (i32.eq (local.get $op) (i32.const 32)) (then
            (if (i32.ne (local.get $sel) (i32.mul (i32.and (local.get $sel) (i32.const 3)) (i32.const 85)))
              (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))))
          (if (i32.or (i32.eq (local.get $op) (i32.const 33)) (i32.eq (local.get $op) (i32.const 36))) (then
            (if (i32.and (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $index) (local.get $dstindex)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (if (i32.and (i32.eq (local.get $op) (i32.const 33)) (i32.ne (local.get $sel) (i32.const 228)))
              (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))))
          (if (i32.and (i32.ne (local.get $rows) (i32.const 0)) (i32.eq (local.get $i) (i32.const 1))) (then
            (local.set $vectorbank (local.get $bank))
            (if (i32.and (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $index) (local.get $dstindex)))
              (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))))
          (local.set $relative (i32.ne (i32.and (local.get $arg) (i32.const 8192)) (i32.const 0)))
          (if (local.get $relative) (then
            (if (i32.or (i32.ne (local.get $bank) (i32.const 2)) (i32.ge_u (local.get $at) (local.get $end)))
              (then (return (call $d3d_ir_fail (i32.const 8) (local.get $start)))))
            (local.set $relative_token (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $at) (i32.const 2)))))
            (if (i32.eq (local.get $relative_token) (i32.const 0xf0000800))
              (then
                (if (i32.and (i32.ne (local.get $rep_active) (i32.const 2))
                      (i32.or (i32.eqz (local.get $routine)) (local.get $replaying)))
                  (then (return (call $d3d_ir_fail (i32.const 8) (local.get $at)))))
                (local.set $mod (i32.or (local.get $mod) (i32.const 1024))))
              (else
                (local.set $relative_component (i32.and (i32.shr_u (local.get $relative_token) (i32.const 16)) (i32.const 3)))
                (if (i32.or (i32.ne (local.get $relative_token)
                      (i32.or (i32.const 0xb0000000) (i32.shl (i32.mul (local.get $relative_component) (i32.const 85)) (i32.const 16))))
                      (i32.eqz (i32.and (local.get $address) (i32.shl (i32.const 1) (local.get $relative_component)))))
                  (then (return (call $d3d_ir_fail (i32.const 8) (local.get $at)))))
                (local.set $mod (i32.or (local.get $mod) (i32.shl (local.get $relative_component) (i32.const 11))))))
            (local.set $at (i32.add (local.get $at) (i32.const 1)))
            (local.set $mod (i32.or (local.get $mod) (i32.const 256))) (global.set $d3d_ir_flags (i32.const 1))))
          ;; The two coefficient banks are an instruction macro contract,
          ;; not simultaneous ordinary ALU constant-port reads. Macro values
          ;; are supplied at runtime; token validation cannot establish them.
          (if (i32.and (i32.eq (local.get $op) (i32.const 37)) (i32.ge_u (local.get $i) (i32.const 2))) (then
            (if (i32.or (i32.ne (local.get $bank) (i32.const 2)) (i32.ge_u (local.get $index) (i32.const 256)))
              (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
            (if (i32.eq (local.get $i) (i32.const 2)) (then (local.set $scratch1 (local.get $index)))
              (else (if (i32.eq (local.get $scratch1) (local.get $index))
                (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
            (br $normalized)))
          ;; Matrix macros consume consecutive registers as separate DP rows.
          ;; Validate every row before publishing any destination initialization.
          ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/m3x2---vs
          (if (i32.and (i32.ne (local.get $rows) (i32.const 0)) (i32.eq (local.get $i) (i32.const 2))) (then
            (if (i32.or (i32.ne (local.get $sel) (i32.const 228)) (i32.ne (i32.and (local.get $mod) (i32.const 255)) (i32.const 0)))
              (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))
            (if (i32.and (i32.eq (local.get $bank) (local.get $vectorbank))
              (i32.or (i32.eq (local.get $bank) (i32.const 1)) (i32.eq (local.get $bank) (i32.const 2))))
              (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))
            (local.set $row (i32.const 0))
            (loop $matrix_rows
              (local.set $rowindex (i32.add (local.get $index) (local.get $row)))
              (if (i32.eq (local.get $bank) (i32.const 2)) (then
                (if (i32.ge_u (local.get $rowindex) (i32.const 256)) (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start))))))
              (else (if (i32.eqz (call $d3d_ir_reg_ok (i32.const 0) (local.get $bank) (local.get $rowindex) (i32.const 0)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))))
              (if (i32.and (i32.eq (local.get $bank) (local.get $dstbank)) (i32.eq (local.get $rowindex) (local.get $dstindex)))
                (then (return (call $d3d_ir_fail (i32.const 15) (local.get $start)))))
              (if (i32.eq (local.get $bank) (i32.const 1)) (then
                (if (i32.eqz (i32.and (local.get $declared) (i32.shl (i32.const 1) (local.get $rowindex))))
                  (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))))
              (if (i32.eqz (local.get $bank)) (then
                (local.set $needed (call $d3d_ir_read_mask (local.get $op) (local.get $i) (local.get $mask)))
                (if (local.get $rep_active) (then
                  (local.set $rep_reads (i64.or (local.get $rep_reads) (i64.and
                    (i64.shl (i64.extend_i32_u (local.get $needed)) (i64.extend_i32_u (i32.shl (local.get $rowindex) (i32.const 2))))
                    (i64.xor (local.get $rep_writes) (i64.const -1)))))))
                (if (i32.ne (i32.and (i32.wrap_i64 (i64.shr_u (local.get $temps) (i64.extend_i32_u (i32.shl (local.get $rowindex) (i32.const 2))))) (local.get $needed)) (local.get $needed))
                  (then (return (call $d3d_ir_fail (i32.const 17) (local.get $start)))))))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br_if $matrix_rows (i32.lt_u (local.get $row) (local.get $rows))))))
          (if (i32.eq (local.get $bank) (i32.const 2)) (then
            (if (i32.ge_u (local.get $index) (i32.const 256)) (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))
            (local.set $key (i32.or (local.get $index) (i32.shl (i32.and (local.get $mod) (i32.const 7424)) (i32.const 8))))
            (if (i32.eq (local.get $firstconst) (i32.const -1)) (then (local.set $firstconst (local.get $key))))
            (local.set $constantreads (i32.add (local.get $constantreads) (i32.const 1)))
            (if (i32.or (i32.ne (local.get $firstconst) (local.get $key)) (i32.gt_u (local.get $constantreads) (i32.const 2)))
              (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start))))))
          (else
            (if (i32.eqz (call $d3d_ir_reg_ok (i32.const 0) (local.get $bank) (local.get $index) (i32.const 0)))
              (then (return (call $d3d_ir_fail (i32.const 6) (local.get $start)))))
            (if (i32.eq (local.get $bank) (i32.const 1)) (then
              (if (i32.eqz (i32.and (local.get $declared) (i32.shl (i32.const 1) (local.get $index))))
                (then (return (call $d3d_ir_fail (i32.const 13) (local.get $start)))))
              (if (i32.eq (local.get $firstinput) (i32.const -1)) (then (local.set $firstinput (local.get $index))))
              (if (i32.ne (local.get $firstinput) (local.get $index)) (then (return (call $d3d_ir_fail (i32.const 18) (local.get $start)))))))))
          (if (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 6)) (i32.le_u (local.get $op) (i32.const 7)))
            (i32.or (i32.and (i32.ge_u (local.get $op) (i32.const 14)) (i32.le_u (local.get $op) (i32.const 15)))
              (i32.or (i32.eq (local.get $op) (i32.const 78)) (i32.eq (local.get $op) (i32.const 79))))) (then
            (if (i32.ne (local.get $sel) (i32.mul (i32.and (local.get $sel) (i32.const 3)) (i32.const 85)))
              (then (return (call $d3d_ir_fail (i32.const 7) (local.get $start)))))))
          (if (i32.eqz (local.get $bank)) (then
            (local.set $needed (call $d3d_ir_swizzle_mask
              (call $d3d_ir_read_mask20 (local.get $op) (local.get $i) (local.get $mask)) (local.get $sel)))
            (if (local.get $rep_active) (then
              (local.set $rep_reads (i64.or (local.get $rep_reads) (i64.and
                (i64.shl (i64.extend_i32_u (local.get $needed)) (i64.extend_i32_u (i32.shl (local.get $index) (i32.const 2))))
                (i64.xor (local.get $rep_writes) (i64.const -1)))))))
            (if (i32.ne (i32.and (i32.wrap_i64 (i64.shr_u (local.get $temps) (i64.extend_i32_u (i32.shl (local.get $index) (i32.const 2))))) (local.get $needed)) (local.get $needed))
              (then (return (call $d3d_ir_fail (i32.const 17) (local.get $start))))))))
        (if (local.get $emit) (then
          (local.set $operand (i32.add (local.get $record) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 4)))))
          (i32.store (local.get $operand) (local.get $bank)) (i32.store offset=4 (local.get $operand) (local.get $index))
          (i32.store offset=8 (local.get $operand) (local.get $sel)) (i32.store offset=12 (local.get $operand) (local.get $mod))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $args)))
      (if (i32.ne (local.get $at) (local.get $end)) (then (return (call $d3d_ir_fail (i32.const 4) (local.get $start)))))
      ;; Static flow count includes IF, ELSE, REP, LOOP. Frame56: entry and then
      ;; temps/address/position, else flag32, type36 (0IF/1REP/2LOOP), per-iteration
      ;; must-write masks at40/48. Combined loop depth1; IFs may nest inside it.
      ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-vs-instructions-flow-control
      (if (i32.and (i32.eqz (local.get $replaying)) (i32.or (local.get $loop_begin)
        (i32.or (i32.or (i32.eq (local.get $op) (i32.const 25)) (i32.eq (local.get $op) (i32.const 26)))
          (i32.or (i32.eq (local.get $op) (i32.const 40)) (i32.eq (local.get $op) (i32.const 42)))))) (then
        (local.set $flow_count (i32.add (local.get $flow_count) (i32.const 1)))
        (if (i32.gt_u (local.get $flow_count) (i32.const 16)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))))
      (if (local.get $loop_begin) (then
        (if (local.get $rep_active) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $rep_active (select (i32.const 2) (i32.const 1) (i32.eq (local.get $op) (i32.const 27)))) (local.set $rep_writes (i64.const 0)) (local.set $rep_reads (i64.const 0))))
      (if (i32.or (i32.eq (local.get $op) (i32.const 40)) (local.get $loop_begin)) (then
        (if (i32.ge_u (local.get $depth) (i32.const 16)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $frame (i32.add (local.get $flow_stack) (i32.mul (local.get $depth) (i32.const 56))))
        (i64.store (local.get $frame) (local.get $temps))
        (i32.store offset=8 (local.get $frame) (local.get $address))
        (i32.store offset=12 (local.get $frame) (local.get $position))
        (i32.store offset=32 (local.get $frame) (i32.const 0))
        (i32.store offset=36 (local.get $frame) (select (local.get $rep_active) (i32.const 0) (local.get $loop_begin)))
        (i64.store offset=40 (local.get $frame) (local.get $rep_writes))
        (local.set $depth (i32.add (local.get $depth) (i32.const 1)))))
      (if (i32.or (i32.eq (local.get $op) (i32.const 42)) (i32.eq (local.get $op) (i32.const 43))) (then
        (if (i32.and (local.get $replaying) (i32.le_u (local.get $depth) (local.get $call_depth)))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (if (i32.eqz (local.get $depth)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $frame (i32.add (local.get $flow_stack) (i32.mul (i32.sub (local.get $depth) (i32.const 1)) (i32.const 56))))
        (if (i32.load offset=36 (local.get $frame)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (if (i32.eq (local.get $op) (i32.const 42)) (then
          (if (i32.load offset=32 (local.get $frame)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
          (i64.store offset=16 (local.get $frame) (local.get $temps))
          (i32.store offset=24 (local.get $frame) (local.get $address))
          (i32.store offset=28 (local.get $frame) (local.get $position))
          (i32.store offset=32 (local.get $frame) (i32.const 1))
          (i64.store offset=48 (local.get $frame) (local.get $rep_writes))
          (local.set $rep_writes (i64.load offset=40 (local.get $frame)))
          (local.set $temps (i64.load (local.get $frame)))
          (local.set $address (i32.load offset=8 (local.get $frame)))
          (local.set $position (i32.load offset=12 (local.get $frame))))
        (else
          (local.set $rep_writes (i64.and (local.get $rep_writes)
            (i64.load (i32.add (local.get $frame) (select (i32.const 48) (i32.const 40) (i32.load offset=32 (local.get $frame)))))))
          (if (i32.load offset=32 (local.get $frame)) (then (local.set $frame (i32.add (local.get $frame) (i32.const 16)))))
          (local.set $temps (i64.and (local.get $temps) (i64.load (local.get $frame))))
          (local.set $address (i32.and (local.get $address) (i32.load offset=8 (local.get $frame))))
          (local.set $position (i32.and (local.get $position) (i32.load offset=12 (local.get $frame))))
          (local.set $depth (i32.sub (local.get $depth) (i32.const 1)))))))
      (if (local.get $loop_end) (then
        (if (i32.and (local.get $replaying) (i32.le_u (local.get $depth) (local.get $call_depth)))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (if (i32.eqz (local.get $depth)) (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $frame (i32.add (local.get $flow_stack) (i32.mul (i32.sub (local.get $depth) (i32.const 1)) (i32.const 56))))
        (if (i32.ne (i32.load offset=36 (local.get $frame))
              (select (i32.const 2) (i32.const 1) (i32.eq (local.get $op) (i32.const 29))))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        ;; Reads relying on entry values must still be defined at the backedge.
        ;; a0 cannot currently be clobbered, so ordinary init checks suffice.
        (if (i64.ne (i64.and (local.get $rep_reads) (local.get $temps)) (local.get $rep_reads))
          (then (return (call $d3d_ir_fail (i32.const 17) (local.get $start)))))
        (local.set $temps (i64.and (local.get $temps) (i64.load (local.get $frame))))
        (local.set $address (i32.and (local.get $address) (i32.load offset=8 (local.get $frame))))
        (local.set $position (i32.and (local.get $position) (i32.load offset=12 (local.get $frame))))
        (local.set $depth (i32.sub (local.get $depth) (i32.const 1))) (local.set $rep_active (i32.const 0))))
      ;; Validate the meaningful source before invalidating either scratch.
      ;; Publish destination writes afterwards, including overlapping scratch.
      (if (i32.eq (local.get $op) (i32.const 34)) (then
        (local.set $temps (i64.and (local.get $temps) (i64.xor (i64.const -1)
          (i64.or (i64.shl (i64.const 15) (i64.extend_i32_u (i32.shl (local.get $scratch1) (i32.const 2))))
            (i64.shl (i64.const 15) (i64.extend_i32_u (i32.shl (local.get $scratch2) (i32.const 2))))))))))
      ;; VS2 SINCOS leaves unwritten XYZ undefined; W remains untouched.
      (if (i32.eq (local.get $op) (i32.const 37)) (then
        (local.set $temps (i64.and (local.get $temps) (i64.xor (i64.const -1)
          (i64.shl (i64.const 7) (i64.extend_i32_u (i32.shl (local.get $dstindex) (i32.const 2)))))))))
      (local.set $rep_writes (i64.and (local.get $rep_writes) (local.get $temps)))
      (if (local.get $mask) (then
        (if (i32.eqz (local.get $dstbank)) (then
          (local.set $rep_writes (i64.or (local.get $rep_writes)
            (i64.shl (i64.extend_i32_u (local.get $mask)) (i64.extend_i32_u (i32.shl (local.get $dstindex) (i32.const 2))))))))
        (if (i32.eqz (local.get $dstbank)) (then (local.set $temps (i64.or (local.get $temps) (i64.shl (i64.extend_i32_u (local.get $mask)) (i64.extend_i32_u (i32.shl (local.get $dstindex) (i32.const 2))))))))
        (if (i32.and (i32.eq (local.get $dstbank) (i32.const 4)) (i32.eqz (local.get $dstindex)))
          (then (local.set $position (i32.or (local.get $position) (local.get $mask)))))
        (if (i32.eq (local.get $op) (i32.const 46)) (then (local.set $address (i32.or (local.get $address) (local.get $mask)))))))
      (if (i32.and (i32.eqz (local.get $replaying))
            (i32.and (i32.ne (local.get $op) (i32.const 30))
              (i32.and (i32.ne (local.get $op) (i32.const 31)) (i32.eqz (local.get $definition))))) (then
        (if (i32.eq (local.get $op) (i32.const 25)) (then (local.set $slots (i32.add (local.get $slots) (i32.const 1)))))
        (if (i32.eq (local.get $op) (i32.const 26)) (then (local.set $slots (i32.add (local.get $slots) (i32.const 2)))))
        ;; Conservative IF3 from the profile table; its individual page says1.
        ;; ELSE/ENDIF use one slot. Preserve this explicit discrepancy policy.
        (if (i32.eq (local.get $op) (i32.const 40)) (then (local.set $slots (i32.add (local.get $slots) (i32.const 2)))))
        (if (local.get $loop_begin) (then (local.set $slots (i32.add (local.get $slots) (i32.const 2)))))
        (if (local.get $loop_end) (then (local.set $slots (i32.add (local.get $slots) (i32.const 1)))))
        (local.set $slots (i32.add (local.get $slots)
          (select (i32.const 8) (select (i32.const 3) (select (i32.const 2)
            (select (local.get $rows) (i32.const 1) (i32.ne (local.get $rows) (i32.const 0)))
            (i32.or (i32.eq (local.get $op) (i32.const 18)) (i32.eq (local.get $op) (i32.const 33))))
            (i32.or (i32.eq (local.get $op) (i32.const 34))
              (i32.or (i32.eq (local.get $op) (i32.const 32))
                (i32.or (i32.eq (local.get $op) (i32.const 16)) (i32.eq (local.get $op) (i32.const 36))))))
            (i32.eq (local.get $op) (i32.const 37)))))
        (if (i32.gt_u (local.get $slots) (i32.const 256)) (then (return (call $d3d_ir_fail (i32.const 19) (local.get $start)))))))
      (if (i32.eqz (local.get $replaying)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (if (i32.gt_u (local.get $n) (i32.const 4096)) (then (return (call $d3d_ir_fail (i32.const 11) (local.get $start)))))
      (if (i32.eq (local.get $op) (i32.const 30)) (then
        (if (i32.or (local.get $replaying) (i32.or (local.get $depth)
              (i32.or (i32.eqz (local.get $body_closed)) (i32.ne (local.get $target) (local.get $at)))))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $routine (i32.const 1)) (local.set $body_closed (i32.const 0))
        ;; Syntax-check unused routines with maximal incoming definitions;
        ;; every real call is additionally validated with its actual state.
        (local.set $temps (i64.const -1)) (local.set $address (i32.const 15))
        (local.set $position (i32.const 15)) (local.set $rep_writes (i64.const 0)) (local.set $rep_reads (i64.const 0))))
      (if (i32.eq (local.get $op) (i32.const 28)) (then
        (if (i32.ne (local.get $depth) (select (local.get $call_depth) (i32.const 0) (local.get $replaying)))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (if (local.get $replaying) (then
          (if (local.get $call_cond) (then
            (local.set $temps (i64.and (local.get $temps) (local.get $call_temps)))
            (local.set $address (i32.and (local.get $address) (local.get $call_address)))
            (local.set $position (i32.and (local.get $position) (local.get $call_position)))
            (local.set $rep_writes (i64.and (local.get $rep_writes) (local.get $call_writes)))))
          (local.set $at (local.get $resume)) (local.set $call_active (i32.const 0)))
        (else
          (if (i32.eqz (local.get $routine)) (then
            (local.set $main_position (local.get $position))))
          (local.set $body_closed (i32.const 1))))))
      (if (i32.or (i32.eq (local.get $op) (i32.const 25)) (i32.eq (local.get $op) (i32.const 26))) (then
        (if (i32.or (local.get $replaying) (i32.or (local.get $routine) (i32.le_u (local.get $target) (local.get $at))))
          (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
        (local.set $resume (local.get $at)) (local.set $call_depth (local.get $depth))
        (local.set $call_cond (i32.eq (local.get $op) (i32.const 26)))
        (local.set $call_temps (local.get $temps)) (local.set $call_address (local.get $address))
        (local.set $call_position (local.get $position)) (local.set $call_writes (local.get $rep_writes))
        (local.set $call_active (i32.const 1)) (local.set $at (local.get $target))))
      (br $instructions)))
    (if (i32.or (local.get $depth) (i32.or (local.get $call_active) (i32.and (i32.ne (local.get $routine) (i32.const 0)) (i32.eqz (local.get $body_closed)))))
      (then (return (call $d3d_ir_fail (i32.const 16) (local.get $start)))))
    (if (i32.or (local.get $routine) (local.get $body_closed)) (then (local.set $position (local.get $main_position))))
    (if (i32.ne (local.get $position) (i32.const 15)) (then (return (call $d3d_ir_fail (i32.const 10) (local.get $start)))))
    (global.set $d3d_ir_length (local.get $at)) (local.get $n))
  (func $d3d_shader_ir_compile (export "d3d_shader_ir_compile") (param $ptr i32) (param $count i32) (result i32)
    (call $d3d_shader_ir_compile_mode (local.get $ptr) (local.get $count) (i32.const 0)))
  (func $d3d_shader_ir_compile20 (param $ptr i32) (param $count i32) (result i32)
    (call $d3d_shader_ir_compile_mode (local.get $ptr) (local.get $count) (i32.const 1)))
  (func $d3d_shader_ir_compile_mode (param $ptr i32) (param $count i32) (param $private20 i32) (result i32)
    (local $n i32) (local $bytes i32) (local $guest i32) (local $base i32) (local $ir i32) (local $ps14 i32)
    (global.set $d3d_ir_error (i32.const 0)) (global.set $d3d_ir_error_offset (i32.const 0))
    (if (i32.or (i32.eqz (local.get $ptr))
          (i32.or (i32.ne (i32.and (local.get $ptr) (i32.const 3)) (i32.const 0))
          (i32.or (i32.lt_u (local.get $count) (i32.const 2))
          (i32.or (i32.gt_u (local.get $count) (i32.const 65536))
          (i64.gt_u (i64.add (i64.extend_i32_u (local.get $ptr)) (i64.shl (i64.extend_i32_u (local.get $count)) (i64.const 2)))
            (i64.shl (i64.extend_i32_u (memory.size)) (i64.const 16)))))))
      (then (drop (call $d3d_ir_fail (i32.const 1) (i32.const 0))) (return (i32.const 0))))
    (if (local.get $private20) (then
      (if (i32.ne (i32.load (local.get $ptr)) (i32.const 0xfffe0200))
        (then (drop (call $d3d_ir_fail (i32.const 2) (i32.const 0))) (return (i32.const 0)))))
    (else (if (i32.and (i32.and (i32.ne (i32.load (local.get $ptr)) (i32.const 0xfffe0100)) (i32.ne (i32.load (local.get $ptr)) (i32.const 0xfffe0101)))
          (i32.and (i32.ne (i32.load (local.get $ptr)) (i32.const 0xffff0101))
            (i32.and (i32.ne (i32.load (local.get $ptr)) (i32.const 0xffff0102))
              (i32.and (i32.ne (i32.load (local.get $ptr)) (i32.const 0xffff0103))
                (i32.ne (i32.load (local.get $ptr)) (i32.const 0xffff0104))))))
      (then (drop (call $d3d_ir_fail (i32.const 2) (i32.const 0))) (return (i32.const 0))))))
    ;; ps_1_4 is public: its own validator ($d3d_ir_scan14) emits the same IR
    ;; ABI, with PHASE as a zero-operand instruction.
    (local.set $ps14 (i32.and (i32.eqz (local.get $private20))
      (i32.eq (i32.load (local.get $ptr)) (i32.const 0xffff0104))))
    (local.set $n (if (result i32) (local.get $private20)
      (then (call $d3d_ir_scan20 (local.get $ptr) (local.get $count) (i32.const 0)))
      (else (if (result i32) (local.get $ps14)
        (then (call $d3d_ir_scan14 (local.get $ptr) (local.get $count) (i32.const 0)))
        (else (call $d3d_ir_scan (local.get $ptr) (local.get $count) (i32.const 0)))))))
    (if (i32.lt_s (local.get $n) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $bytes (i32.add (i32.const 32) (i32.shl (local.get $n) (i32.const 7))))
    ;; Per-instance immutable IR ownership is bounded independently of the
    ;; guest heap's expandable arenas. Callers may evict after completed fences.
    (if (i32.gt_u (i32.add (global.get $d3d_ir_live_bytes) (local.get $bytes)) (i32.const 4194304))
      (then (drop (call $d3d_ir_fail (i32.const 12) (i32.const 0))) (return (i32.const 0))))
    (local.set $guest (call $heap_alloc (i32.add (local.get $bytes) (i32.const 16))))
    (if (i32.eqz (local.get $guest))
      (then (drop (call $d3d_ir_fail (i32.const 12) (i32.const 0))) (return (i32.const 0))))
    (local.set $base (call $g2w (local.get $guest)))
    (local.set $ir (i32.add (local.get $base) (i32.const 16)))
    (memory.fill (local.get $ir) (i32.const 0) (local.get $bytes))
    (i32.store offset=16 (local.get $ir) (local.get $n))
    (if (i32.ne (if (result i32) (local.get $private20)
      (then (call $d3d_ir_scan20 (local.get $ptr) (local.get $count) (local.get $ir)))
      (else (if (result i32) (local.get $ps14)
        (then (call $d3d_ir_scan14 (local.get $ptr) (local.get $count) (local.get $ir)))
        (else (call $d3d_ir_scan (local.get $ptr) (local.get $count) (local.get $ir)))))) (local.get $n))
      (then (call $heap_free (local.get $guest)) (return (i32.const 0))))
    (i32.store (local.get $ir) (i32.const 0x44534952))
    (i32.store offset=4 (local.get $ir) (i32.const 1))
    (i32.store offset=8 (local.get $ir) (i32.eq (i32.shr_u (i32.load (local.get $ptr)) (i32.const 16)) (i32.const 65535)))
    (i32.store offset=12 (local.get $ir) (i32.load (local.get $ptr)))
    (i32.store offset=16 (local.get $ir) (local.get $n))
    (i32.store offset=20 (local.get $ir) (global.get $d3d_ir_length))
    (i32.store offset=24 (local.get $ir) (local.get $bytes))
    (i32.store offset=28 (local.get $ir) (global.get $d3d_ir_flags))
    (i32.store (local.get $base) (global.get $d3d_ir_head))
    (i32.store offset=4 (local.get $base) (local.get $guest))
    (i32.store offset=8 (local.get $base) (local.get $bytes))
    (global.set $d3d_ir_live_bytes (i32.add (global.get $d3d_ir_live_bytes) (local.get $bytes)))
    (global.set $d3d_ir_head (local.get $base)) (local.get $ir))
  (func $d3d_shader_ir_free (export "d3d_shader_ir_free") (param $ir i32)
    (local $node i32) (local $prev i32) (local $next i32) (local $guest i32)
    (local.set $node (global.get $d3d_ir_head))
    (block $done (loop $walk
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next (i32.load (local.get $node)))
      (if (i32.eq (local.get $ir) (i32.add (local.get $node) (i32.const 16))) (then
        (if (local.get $prev) (then (i32.store (local.get $prev) (local.get $next)))
          (else (global.set $d3d_ir_head (local.get $next))))
        (local.set $guest (i32.load offset=4 (local.get $node)))
        (global.set $d3d_ir_live_bytes (i32.sub (global.get $d3d_ir_live_bytes) (i32.load offset=8 (local.get $node))))
        (i32.store (local.get $ir) (i32.const 0))
        (call $heap_free (local.get $guest)) (return)))
      (local.set $prev (local.get $node)) (local.set $node (local.get $next)) (br $walk))))
