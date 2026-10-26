;; Native fixed-function lowering, descriptor DFX1 ABI1 288 / ABI2..3 320 bytes.
;; +8 flags: POSITIONT1, diffuse-present2, UV-present4, texture0-present8,
;; software screen-space output16 (requires POSITIONT; XYZ/RHW bypass projection).
;; All other flags (lighting/fog/specular/alpha-test etc.) reject in this slice.
;; +12/+16/+20 position/diffuse/UV input register indices; +24 COLOROP,
;; +28/+32 COLORARG1/2,+36 ALPHAOP,+40/+44 ALPHAARG1/2,
;; +48 texture-factor ARGB,+52 stage-constant ARGB,+56 stage1 COLOROP,
;; +60 texture transform flags,+64 coordinate index,
;; +68/+72 viewport XY,+76/+80 WH,+84/+88 min/maxZ,+92 reserved0,
;; +96/+160/+224 row-major world/view/projection matrices (16 floats each).
;; ABI2 adds flags32 emit oPts and64 distance attenuation (requires32),
;; +288 point size,+292/+296/+300 attenuation A/B/C, +304..319 reserved0.
;; POSITIONT ignores distance attenuation; raster applies min/max/device caps.
;; ABI3 adds flag128 per-vertex PSIZE at register +304; +308..319 stay zero.
;; Bundle DFB1 (32 bytes): +4 VSIR,+8 PSIR,+12 VS packets,+16 PS packets,
;; +20 sampled0/1,+24 raster input-map nibbles,+28 original flags.
;; Bundle owns all four derived allocations until d3d_fixed_free. Callers retain
;; the bundle while queued raster contexts reference either program.
;; Generated IR is shared ABI1, with flag4 marking fixed-state origin; normal
;; stage/profile fields describe the instruction vocabulary, NOT guest-profile
;; legality. It never enters CreateShader or substitutes for failed guest code.

;; Per-device bounded semantic packet cache. No guest shader or object state.
;; Header32: magic, capacity, used node bytes, MRU head, hits, misses, evictions,
;; count. Nodes own one allocation: next/bytes/IRbytes/packetbytes + IR + packet.
;; The selected cache is scoped to one synchronous lowering call, never a yield.
(global $d3d_fixed_active_cache (mut i32) (i32.const 0))
(func $d3d_fixed_cache_valid (param $cache i32) (result i32)
  (if (i32.eqz (local.get $cache)) (then (return (i32.const 1))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $cache) (i32.const 32))) (then (return (i32.const 0))))
  (i32.eq (i32.load (local.get $cache)) (i32.const 0x44464331)))
(func (export "d3d_fixed_compile_cached") (param $cache i32) (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (result i32)
  (local $old i32) (local $result i32)
  (if (i32.eqz (call $d3d_fixed_cache_valid (local.get $cache))) (then (return (i32.const 0))))
  (local.set $old (global.get $d3d_fixed_active_cache)) (global.set $d3d_fixed_active_cache (local.get $cache))
  (local.set $result (call $d3d_fixed_compile_cascade5 (local.get $desc) (local.get $table) (local.get $count) (local.get $stages) (local.get $uvmask)))
  (global.set $d3d_fixed_active_cache (local.get $old)) (local.get $result))
(func (export "d3d_fixed_light_cached") (param $cache i32) (param $bundle i32) (param $desc i32) (param $lighting i32) (result i32)
  (local $old i32) (local $result i32)
  (if (i32.eqz (call $d3d_fixed_cache_valid (local.get $cache))) (then (return (i32.const 0))))
  (local.set $old (global.get $d3d_fixed_active_cache)) (global.set $d3d_fixed_active_cache (local.get $cache))
  (local.set $result (call $d3d_fixed_bind_lighting (local.get $bundle) (local.get $desc) (local.get $lighting)))
  (global.set $d3d_fixed_active_cache (local.get $old)) (local.get $result))
(func (export "d3d_fixed_cache_create") (param $capacity i32) (result i32)
  (local $p i32)
  (if (i32.gt_u (local.get $capacity) (i32.const 1048576)) (then (return (i32.const 0))))
  (local.set $p (call $heap_alloc (i32.const 32)))
  (if (i32.eqz (local.get $p)) (then (return (i32.const 0))))
  (local.set $p (call $g2w (local.get $p))) (memory.fill (local.get $p) (i32.const 0) (i32.const 32))
  (i32.store (local.get $p) (i32.const 0x44464331)) (i32.store offset=4 (local.get $p) (local.get $capacity)) (local.get $p))
(func $d3d_fixed_cache_evict (param $cache i32)
  (local $p i32) (local $prev i32)
  (local.set $p (i32.load offset=12 (local.get $cache)))
  (if (i32.eqz (local.get $p)) (then (return)))
  (loop $tail
    (if (i32.load (local.get $p)) (then
      (local.set $prev (local.get $p)) (local.set $p (i32.load (local.get $p))) (br $tail))))
  (i32.store (select (local.get $prev) (i32.add (local.get $cache) (i32.const 12)) (i32.ne (local.get $prev) (i32.const 0))) (i32.const 0))
  (i32.store offset=8 (local.get $cache) (i32.sub (i32.load offset=8 (local.get $cache)) (i32.load offset=4 (local.get $p))))
  (i32.store offset=28 (local.get $cache) (i32.sub (i32.load offset=28 (local.get $cache)) (i32.const 1)))
  (i32.store offset=24 (local.get $cache) (i32.add (i32.load offset=24 (local.get $cache)) (i32.const 1)))
  (call $d3d_shader_vm_free (local.get $p)))
(func (export "d3d_fixed_cache_free") (param $cache i32)
  (if (local.get $cache) (then
    (loop $nodes
      (if (i32.load offset=12 (local.get $cache)) (then (call $d3d_fixed_cache_evict (local.get $cache)) (br $nodes))))
    (call $d3d_shader_vm_free (local.get $cache)))))
(func $d3d_fixed_semantic_equal (param $a i32) (param $b i32) (param $bytes i32) (result i32)
  (local $i i32) (local $offset i32)
  (loop $words
    (block $skip
      (if (i32.ge_u (local.get $i) (i32.const 32)) (then
        (local.set $offset (i32.and (i32.sub (local.get $i) (i32.const 32)) (i32.const 127)))
        (if (i32.eq (i32.load (i32.add (local.get $a) (i32.sub (local.get $i) (local.get $offset)))) (i32.const 81)) (then
          (br_if $skip (i32.or (i32.eq (local.get $offset) (i32.const 36))
            (i32.or (i32.eq (local.get $offset) (i32.const 52)) (i32.or (i32.eq (local.get $offset) (i32.const 68)) (i32.eq (local.get $offset) (i32.const 84))))))))))
      (if (i32.ne (i32.load (i32.add (local.get $a) (local.get $i))) (i32.load (i32.add (local.get $b) (local.get $i)))) (then (return (i32.const 0)))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $words (i32.lt_u (local.get $i) (local.get $bytes))))
  (i32.const 1))
(func $d3d_fixed_packet (param $ir i32) (result i32)
  (local $cache i32) (local $p i32) (local $prev i32) (local $out i32) (local $bytes i32) (local $packetbytes i32)
  (local $nodebytes i32) (local $i i32) (local $ins i32) (local $pkt i32)
  (local.set $cache (global.get $d3d_fixed_active_cache))
  (if (i32.eqz (local.get $cache)) (then (return (call $d3d_shader_vm_compile (local.get $ir)))))
  (local.set $bytes (i32.load offset=24 (local.get $ir)))
  (local.set $p (i32.load offset=12 (local.get $cache)))
  (block $miss (loop $find
    (br_if $miss (i32.eqz (local.get $p)))
    (if (i32.eq (i32.load offset=8 (local.get $p)) (local.get $bytes)) (then
      (if (call $d3d_fixed_semantic_equal (local.get $ir) (i32.add (local.get $p) (i32.const 16)) (local.get $bytes)) (then
        (local.set $packetbytes (i32.load offset=12 (local.get $p)))
        (local.set $out (call $heap_alloc (local.get $packetbytes)))
        (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
        (local.set $out (call $g2w (local.get $out)))
        (memory.copy (local.get $out) (i32.add (local.get $p) (i32.add (i32.const 16) (local.get $bytes))) (local.get $packetbytes))
        ;; DEF packets are the immutable VM prologue, in original DEF order.
        (local.set $pkt (i32.add (local.get $out) (i32.const 16)))
        (loop $defs
          (local.set $ins (i32.add (local.get $ir) (i32.add (i32.const 32) (i32.shl (local.get $i) (i32.const 7)))))
          (if (i32.eq (i32.load (local.get $ins)) (i32.const 81)) (then
            (i32.store offset=16 (local.get $pkt) (i32.load offset=36 (local.get $ins)))
            (i32.store offset=20 (local.get $pkt) (i32.load offset=52 (local.get $ins)))
            (i32.store offset=24 (local.get $pkt) (i32.load offset=68 (local.get $ins)))
            (i32.store offset=28 (local.get $pkt) (i32.load offset=84 (local.get $ins)))
            (local.set $pkt (i32.add (local.get $pkt) (i32.const 64)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $defs (i32.lt_u (local.get $i) (i32.load offset=16 (local.get $ir)))))
        (if (local.get $prev) (then
          (i32.store (local.get $prev) (i32.load (local.get $p)))
          (i32.store (local.get $p) (i32.load offset=12 (local.get $cache)))
          (i32.store offset=12 (local.get $cache) (local.get $p))))
        (i32.store offset=16 (local.get $cache) (i32.add (i32.load offset=16 (local.get $cache)) (i32.const 1)))
        (return (local.get $out))))))
    (local.set $prev (local.get $p)) (local.set $p (i32.load (local.get $p))) (br $find)))
  (i32.store offset=20 (local.get $cache) (i32.add (i32.load offset=20 (local.get $cache)) (i32.const 1)))
  (local.set $out (call $d3d_shader_vm_compile (local.get $ir)))
  (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
  (local.set $packetbytes (i32.load offset=12 (local.get $out)))
  (local.set $nodebytes (i32.add (i32.const 16) (i32.add (local.get $bytes) (local.get $packetbytes))))
  (if (i32.gt_u (local.get $nodebytes) (i32.load offset=4 (local.get $cache))) (then (return (local.get $out))))
  (loop $room
    (if (i32.or (i32.gt_u (i32.add (i32.load offset=8 (local.get $cache)) (local.get $nodebytes)) (i32.load offset=4 (local.get $cache)))
      (i32.ge_u (i32.load offset=28 (local.get $cache)) (i32.const 64))) (then (call $d3d_fixed_cache_evict (local.get $cache)) (br $room))))
  (local.set $p (call $heap_alloc (local.get $nodebytes)))
  (if (i32.eqz (local.get $p)) (then (return (local.get $out))))
  (local.set $p (call $g2w (local.get $p)))
  (i32.store (local.get $p) (i32.load offset=12 (local.get $cache))) (i32.store offset=4 (local.get $p) (local.get $nodebytes))
  (i32.store offset=8 (local.get $p) (local.get $bytes)) (i32.store offset=12 (local.get $p) (local.get $packetbytes))
  (memory.copy (i32.add (local.get $p) (i32.const 16)) (local.get $ir) (local.get $bytes))
  (memory.copy (i32.add (local.get $p) (i32.add (i32.const 16) (local.get $bytes))) (local.get $out) (local.get $packetbytes))
  (i32.store offset=12 (local.get $cache) (local.get $p))
  (i32.store offset=8 (local.get $cache) (i32.add (i32.load offset=8 (local.get $cache)) (local.get $nodebytes)))
  (i32.store offset=28 (local.get $cache) (i32.add (i32.load offset=28 (local.get $cache)) (i32.const 1)))
  (local.get $out))

(func $d3d_fixed_free (export "d3d_fixed_free") (param $bundle i32)
  (if (local.get $bundle) (then
    (call $d3d_shader_vm_free (i32.load offset=4 (local.get $bundle)))
    (call $d3d_shader_vm_free (i32.load offset=8 (local.get $bundle)))
    (call $d3d_shader_vm_free (i32.load offset=12 (local.get $bundle)))
    (call $d3d_shader_vm_free (i32.load offset=16 (local.get $bundle)))
    (call $d3d_shader_vm_free (local.get $bundle)))))

(func $d3d_fixed_ir (param $stage i32) (result i32)
  (call $d3d_fixed_ir_sized (local.get $stage) (i32.const 16416)))
;; A lit program with positional lights needs up to 30 records per light, so
;; DLT1 ABI2 lowers into an IR sized to its own worst case (at most 512 records).
(func $d3d_fixed_ir_sized (param $stage i32) (param $bytes i32) (result i32)
  (local $p i32)
  (local.set $p (call $heap_alloc (local.get $bytes)))
  (if (i32.eqz (local.get $p)) (then (return (i32.const 0))))
  (local.set $p (call $g2w (local.get $p)))
  (memory.fill (local.get $p) (i32.const 0) (local.get $bytes))
  (i32.store (local.get $p) (i32.const 0x44534952))
  (i32.store offset=4 (local.get $p) (i32.const 1))
  (i32.store offset=8 (local.get $p) (local.get $stage))
  (i32.store offset=12 (local.get $p) (select (i32.const 0xffff0101) (i32.const 0xfffe0101) (local.get $stage)))
  (i32.store offset=20 (local.get $p) (i32.const 2))
  (i32.store offset=24 (local.get $p) (i32.const 32))
  (i32.store offset=28 (local.get $p) (i32.const 4))
  (local.get $p))

(func $d3d_fixed_instruction (param $ir i32) (param $op i32) (param $arity i32) (result i32)
  (local $n i32) (local $p i32)
  ;; Every caller is a bounded lowering below; fewer than128 instructions/stage,
  ;; including six ADDSMOOTH stages and TEMP save/restore routing.
  (local.set $n (i32.load offset=16 (local.get $ir)))
  (local.set $p (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $n) (i32.const 7))))
  (i32.store (local.get $p) (local.get $op))
  (i32.store offset=4 (local.get $p) (i32.add (local.get $n) (i32.const 1)))
  (i32.store offset=8 (local.get $p) (local.get $arity))
  (local.set $n (i32.add (local.get $n) (i32.const 1)))
  (i32.store offset=16 (local.get $ir) (local.get $n))
  (i32.store offset=20 (local.get $ir) (i32.add (local.get $n) (i32.const 2)))
  (i32.store offset=24 (local.get $ir) (i32.add (i32.const 32) (i32.shl (local.get $n) (i32.const 7))))
  (local.get $p))

(func $d3d_fixed_operand (param $p i32) (param $j i32) (param $bank i32) (param $index i32) (param $selector i32) (param $modifier i32)
  (local.set $p (i32.add (i32.add (local.get $p) (i32.const 16)) (i32.shl (local.get $j) (i32.const 4))))
  (i32.store (local.get $p) (local.get $bank)) (i32.store offset=4 (local.get $p) (local.get $index))
  (i32.store offset=8 (local.get $p) (local.get $selector)) (i32.store offset=12 (local.get $p) (local.get $modifier)))

(func $d3d_fixed_source (param $bank i32) (param $index i32) (param $swizzle i32) (param $modifier i32) (result i32)
  (i32.or (i32.or (local.get $bank) (i32.shl (local.get $index) (i32.const 4)))
    (i32.or (i32.shl (local.get $swizzle) (i32.const 12)) (i32.shl (local.get $modifier) (i32.const 20)))))

(func $d3d_fixed_op (param $ir i32) (param $op i32) (param $bank i32) (param $index i32) (param $mask i32) (param $modifier i32)
  (param $a i32) (param $b i32) (param $c i32)
  (local $p i32) (local $arity i32) (local $i i32) (local $src i32)
  (local.set $arity (call $d3d_shader_vm_arity (local.get $op)))
  (local.set $p (call $d3d_fixed_instruction (local.get $ir) (local.get $op) (local.get $arity)))
  (call $d3d_fixed_operand (local.get $p) (i32.const 0) (local.get $bank) (local.get $index) (local.get $mask) (local.get $modifier))
  (local.set $i (i32.const 1))
  (block $done (loop $sources
    (br_if $done (i32.ge_u (local.get $i) (local.get $arity)))
    (local.set $src (select (local.get $a) (select (local.get $b) (local.get $c) (i32.eq (local.get $i) (i32.const 2))) (i32.eq (local.get $i) (i32.const 1))))
    (call $d3d_fixed_operand (local.get $p) (local.get $i) (i32.and (local.get $src) (i32.const 15))
      (i32.and (i32.shr_u (local.get $src) (i32.const 4)) (i32.const 255))
      (i32.and (i32.shr_u (local.get $src) (i32.const 12)) (i32.const 255))
      (i32.shr_u (local.get $src) (i32.const 20)))
    (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $sources))))

(func $d3d_fixed_def (param $ir i32) (param $index i32) (param $x f32) (param $y f32) (param $z f32) (param $w f32)
  (local $p i32)
  (local.set $p (call $d3d_fixed_instruction (local.get $ir) (i32.const 81) (i32.const 5)))
  (call $d3d_fixed_operand (local.get $p) (i32.const 0) (i32.const 2) (local.get $index) (i32.const 15) (i32.const 0))
  (call $d3d_fixed_operand (local.get $p) (i32.const 1) (i32.const 255) (i32.reinterpret_f32 (local.get $x)) (i32.const 0) (i32.const 0))
  (call $d3d_fixed_operand (local.get $p) (i32.const 2) (i32.const 255) (i32.reinterpret_f32 (local.get $y)) (i32.const 0) (i32.const 0))
  (call $d3d_fixed_operand (local.get $p) (i32.const 3) (i32.const 255) (i32.reinterpret_f32 (local.get $z)) (i32.const 0) (i32.const 0))
  (call $d3d_fixed_operand (local.get $p) (i32.const 4) (i32.const 255) (i32.reinterpret_f32 (local.get $w)) (i32.const 0) (i32.const 0)))

(func $d3d_fixed_argb (param $ir i32) (param $index i32) (param $color i32)
  (call $d3d_fixed_def (local.get $ir) (local.get $index)
    (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $color) (i32.const 16)) (i32.const 255))) (f32.const 255))
    (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $color) (i32.const 8)) (i32.const 255))) (f32.const 255))
    (f32.div (f32.convert_i32_u (i32.and (local.get $color) (i32.const 255))) (f32.const 255))
    (f32.div (f32.convert_i32_u (i32.shr_u (local.get $color) (i32.const 24))) (f32.const 255))))

(func $d3d_fixed_argument (param $value i32) (param $flags i32) (result i32)
  (local $base i32) (local $bank i32) (local $index i32)
  (if (i32.gt_u (local.get $value) (i32.const 63)) (then (return (i32.const -1))))
  (local.set $base (i32.and (local.get $value) (i32.const 15)))
  (if (i32.le_u (local.get $base) (i32.const 1)) (then (local.set $bank (i32.const 1)))
    (else (if (i32.eq (local.get $base) (i32.const 2))
      (then
        (if (i32.eqz (i32.and (local.get $flags) (i32.const 8))) (then (return (i32.const -1))))
        (local.set $bank (i32.const 3)))
      (else
        (local.set $bank (i32.const 2))
        (if (i32.eq (local.get $base) (i32.const 3)) (then (local.set $index (i32.const 0)))
          (else (if (i32.eq (local.get $base) (i32.const 6)) (then (local.set $index (i32.const 1)))
            (else (if (i32.eq (local.get $base) (i32.const 4)) (then (local.set $index (i32.const 3)))
              (else (return (i32.const -1))))))))))))
  (call $d3d_fixed_source (local.get $bank) (local.get $index)
    (select (i32.const 255) (i32.const 228) (i32.and (local.get $value) (i32.const 32)))
    (select (i32.const 6) (i32.const 0) (i32.and (local.get $value) (i32.const 16)))))

(func $d3d_fixed_combine (param $ir i32) (param $mode i32) (param $a i32) (param $b i32) (param $mask i32) (param $half i32)
  (local $shift i32)
  (if (i32.le_u (local.get $mode) (i32.const 3)) (then
    (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (select (local.get $a) (local.get $b) (i32.eq (local.get $mode) (i32.const 2))) (i32.const 0) (i32.const 0))
    (return)))
  (if (i32.le_u (local.get $mode) (i32.const 6)) (then
    (local.set $shift (i32.shl (i32.sub (local.get $mode) (i32.const 4)) (i32.const 8)))
    (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 0) (local.get $mask) (i32.or (local.get $shift) (i32.const 1))
      (local.get $a) (local.get $b) (i32.const 0)) (return)))
  (if (i32.eq (local.get $mode) (i32.const 11)) (then
    (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 1) (local.get $mask) (i32.const 0) (local.get $a) (local.get $b) (i32.const 0))))
  (call $d3d_fixed_op (local.get $ir) (select (i32.const 3) (i32.const 2) (i32.eq (local.get $mode) (i32.const 10)))
    (i32.const 0) (i32.const 0) (local.get $mask)
    (select (i32.const 1) (i32.const 0) (i32.or (i32.eq (local.get $mode) (i32.const 7)) (i32.eq (local.get $mode) (i32.const 10))))
    (local.get $a) (local.get $b) (i32.const 0))
  (if (i32.or (i32.eq (local.get $mode) (i32.const 8)) (i32.eq (local.get $mode) (i32.const 9))) (then
    (call $d3d_fixed_op (local.get $ir) (i32.const 3) (i32.const 0) (i32.const 0) (local.get $mask)
      (select (i32.const 257) (i32.const 1) (i32.eq (local.get $mode) (i32.const 9)))
      (call $d3d_fixed_source (i32.const 0) (i32.const 0) (i32.const 228) (i32.const 0))
      (call $d3d_fixed_source (i32.const 2) (local.get $half) (i32.const 228) (i32.const 0)) (i32.const 0))))
  (if (i32.eq (local.get $mode) (i32.const 11)) (then
    (call $d3d_fixed_op (local.get $ir) (i32.const 3) (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (call $d3d_fixed_source (i32.const 0) (i32.const 0) (i32.const 228) (i32.const 0))
      (call $d3d_fixed_source (i32.const 0) (i32.const 1) (i32.const 228) (i32.const 0)) (i32.const 0)))))

(func $d3d_fixed_points (param $ir i32) (param $desc i32) (param $flags i32)
  (local $size_source i32)
  (local.set $size_source (call $d3d_fixed_source
    (select (i32.const 1) (i32.const 2) (i32.and (local.get $flags) (i32.const 128)))
    (select (i32.load offset=304 (local.get $desc)) (i32.const 13) (i32.and (local.get $flags) (i32.const 128)))
    (select (i32.const 0) (i32.const 255) (i32.and (local.get $flags) (i32.const 128))) (i32.const 0)))
  (call $d3d_fixed_def (local.get $ir) (i32.const 13) (f32.load offset=292 (local.get $desc)) (f32.load offset=296 (local.get $desc)) (f32.load offset=300 (local.get $desc)) (f32.load offset=288 (local.get $desc)))
  (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 64)) (i32.const 0)) (i32.eqz (i32.and (local.get $flags) (i32.const 1)))) (then
    ;; Camera-space r1 survives world/view/projection lowering. Native SIMD
    ;; computes viewportHeight * size / sqrt(A + B*distance + C*distance^2).
    (call $d3d_fixed_def (local.get $ir) (i32.const 14) (f32.convert_i32_u (i32.load offset=80 (local.get $desc))) (f32.const 0) (f32.const 0) (f32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 8) (i32.const 0) (i32.const 2) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 1) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 1) (i32.const 228) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 7) (i32.const 0) (i32.const 2) (i32.const 2) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 6) (i32.const 0) (i32.const 2) (i32.const 2) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 85) (i32.const 0)) (i32.const 0) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 2) (i32.const 4) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 13) (i32.const 85) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 2) (i32.const 4) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 13) (i32.const 170) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 170) (i32.const 0)))
    (call $d3d_fixed_op (local.get $ir) (i32.const 2) (i32.const 0) (i32.const 2) (i32.const 4) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 170) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 13) (i32.const 0) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 7) (i32.const 0) (i32.const 2) (i32.const 4) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 170) (i32.const 0)) (i32.const 0) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 2) (i32.const 4) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 170) (i32.const 0)) (local.get $size_source) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 4) (i32.const 2) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 170) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 14) (i32.const 0) (i32.const 0)) (i32.const 0))
  ) (else
    (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 4) (i32.const 2) (i32.const 1) (i32.const 0) (local.get $size_source) (i32.const 0) (i32.const 0))
  )))

;; Full 4x4 world-view inverse, computed in bounded WAT f64 scratch. Normal
;; output component j dots the input with inverse row j (inverse transpose
;; in D3D row-vector notation), including non-affine fourth-row effects.
(func $d3d_fixed_normal_matrix (param $desc i32) (param $ir i32) (result i32)
  (local $guest i32) (local $p i32) (local $r i32) (local $c i32) (local $k i32) (local $pivot i32) (local $a i32) (local $b i32)
  (local $sum f64) (local $divisor f64) (local $scale f64) (local $swap f64)
  (local.set $guest (call $heap_alloc (i32.const 256))) (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
  (local.set $p (call $g2w (local.get $guest)))
  (block $failure
    (loop $rows
      (local.set $c (i32.const 0))
      (loop $columns
        (local.set $sum (f64.const 0)) (local.set $k (i32.const 0))
        (loop $product
          (local.set $sum (f64.add (local.get $sum) (f64.mul
            (f64.promote_f32 (f32.load (i32.add (local.get $desc) (i32.add (i32.const 96) (i32.shl (i32.add (i32.shl (local.get $r) (i32.const 2)) (local.get $k)) (i32.const 2))))))
            (f64.promote_f32 (f32.load (i32.add (local.get $desc) (i32.add (i32.const 160) (i32.shl (i32.add (i32.shl (local.get $k) (i32.const 2)) (local.get $c)) (i32.const 2)))))))))
          (local.set $k (i32.add (local.get $k) (i32.const 1))) (br_if $product (i32.lt_u (local.get $k) (i32.const 4))))
        (local.set $a (i32.add (local.get $p) (i32.add (i32.shl (local.get $r) (i32.const 6)) (i32.shl (local.get $c) (i32.const 3)))))
        (f64.store (local.get $a) (local.get $sum))
        (f64.store offset=32 (local.get $a) (f64.convert_i32_u (i32.eq (local.get $r) (local.get $c))))
        (local.set $c (i32.add (local.get $c) (i32.const 1))) (br_if $columns (i32.lt_u (local.get $c) (i32.const 4))))
      (local.set $r (i32.add (local.get $r) (i32.const 1))) (br_if $rows (i32.lt_u (local.get $r) (i32.const 4))))
    (local.set $c (i32.const 0))
    (loop $eliminate
      (local.set $pivot (local.get $c)) (local.set $r (i32.add (local.get $c) (i32.const 1)))
      (block $searched (loop $search
        (br_if $searched (i32.ge_u (local.get $r) (i32.const 4)))
        (if (f64.gt (f64.abs (f64.load (i32.add (local.get $p) (i32.add (i32.shl (local.get $r) (i32.const 6)) (i32.shl (local.get $c) (i32.const 3))))))
          (f64.abs (f64.load (i32.add (local.get $p) (i32.add (i32.shl (local.get $pivot) (i32.const 6)) (i32.shl (local.get $c) (i32.const 3)))))))
          (then (local.set $pivot (local.get $r))))
        (local.set $r (i32.add (local.get $r) (i32.const 1))) (br $search)))
      (local.set $a (i32.add (local.get $p) (i32.shl (local.get $c) (i32.const 6))))
      (local.set $b (i32.add (local.get $p) (i32.shl (local.get $pivot) (i32.const 6))))
      (local.set $divisor (f64.load (i32.add (local.get $b) (i32.shl (local.get $c) (i32.const 3)))))
      (br_if $failure (i32.or (f64.eq (local.get $divisor) (f64.const 0)) (f64.ne (local.get $divisor) (local.get $divisor))))
      (local.set $k (i32.const 0))
      (loop $swap_rows
        (local.set $swap (f64.load (i32.add (local.get $a) (local.get $k))))
        (f64.store (i32.add (local.get $a) (local.get $k)) (f64.div (f64.load (i32.add (local.get $b) (local.get $k))) (local.get $divisor)))
        (if (i32.ne (local.get $a) (local.get $b)) (then (f64.store (i32.add (local.get $b) (local.get $k)) (local.get $swap))))
        (local.set $k (i32.add (local.get $k) (i32.const 8))) (br_if $swap_rows (i32.lt_u (local.get $k) (i32.const 64))))
      (local.set $r (i32.const 0))
      (loop $others
        (if (i32.ne (local.get $r) (local.get $c)) (then
          (local.set $b (i32.add (local.get $p) (i32.shl (local.get $r) (i32.const 6))))
          (local.set $scale (f64.load (i32.add (local.get $b) (i32.shl (local.get $c) (i32.const 3)))))
          (local.set $k (i32.const 0))
          (loop $subtract
            (f64.store (i32.add (local.get $b) (local.get $k)) (f64.sub (f64.load (i32.add (local.get $b) (local.get $k)))
              (f64.mul (local.get $scale) (f64.load (i32.add (local.get $a) (local.get $k))))))
            (local.set $k (i32.add (local.get $k) (i32.const 8))) (br_if $subtract (i32.lt_u (local.get $k) (i32.const 64))))))
        (local.set $r (i32.add (local.get $r) (i32.const 1))) (br_if $others (i32.lt_u (local.get $r) (i32.const 4))))
      (local.set $c (i32.add (local.get $c) (i32.const 1))) (br_if $eliminate (i32.lt_u (local.get $c) (i32.const 4))))
    (local.set $r (i32.const 0))
    (loop $validate_inverse
      (local.set $a (i32.add (local.get $p) (i32.add (i32.shl (i32.shr_u (local.get $r) (i32.const 2)) (i32.const 6))
        (i32.add (i32.const 32) (i32.shl (i32.and (local.get $r) (i32.const 3)) (i32.const 3))))))
      (br_if $failure (i32.eqz (f64.le (f64.abs (f64.load (local.get $a))) (f64.const 3.4028234663852886e38))))
      (local.set $r (i32.add (local.get $r) (i32.const 1))) (br_if $validate_inverse (i32.lt_u (local.get $r) (i32.const 16))))
    (local.set $r (i32.const 0))
    (loop $constants
      (local.set $a (i32.add (local.get $p) (i32.add (i32.shl (local.get $r) (i32.const 6)) (i32.const 32))))
      (call $d3d_fixed_def (local.get $ir) (i32.add (i32.const 40) (local.get $r))
        (f32.demote_f64 (f64.load (local.get $a))) (f32.demote_f64 (f64.load offset=8 (local.get $a))) (f32.demote_f64 (f64.load offset=16 (local.get $a))) (f32.const 0))
      (local.set $r (i32.add (local.get $r) (i32.const 1))) (br_if $constants (i32.lt_u (local.get $r) (i32.const 3))))
    (call $heap_free (local.get $guest)) (return (i32.const 1)))
  (call $heap_free (local.get $guest)) (i32.const 0))

(func $d3d_fixed_normalize (param $ir i32) (param $reg i32)
;; CND selects values rather than multiplying invalid data by zero. Squared
;; length zero/underflow/overflow/NaN deterministically returns zero.
  (call $d3d_fixed_op (local.get $ir) (i32.const 8) (i32.const 0) (i32.const 10) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (local.get $reg) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (local.get $reg) (i32.const 228) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 12) (i32.const 0) (i32.const 10) (i32.const 2) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 0) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 13) (i32.const 0) (i32.const 10) (i32.const 4) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 43) (i32.const 255) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 0) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 10) (i32.const 2) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 170) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 80) (i32.const 0) (i32.const 11) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 255) (i32.const 0)))
  (call $d3d_fixed_op (local.get $ir) (i32.const 7) (i32.const 0) (i32.const 11) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 11) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 11) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (local.get $reg) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 11) (i32.const 0) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 80) (i32.const 0) (local.get $reg) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 11) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 0) (i32.const 0))))

;; cascade5 fog tail: flags+136 (enabled1/range2), mode140, start144,
;; end148, density152, specular input156 (16=absent). RGB blend is raster-owned.
(func $d3d_fixed_fog (param $desc i32) (param $row i32) (param $ir i32) (result i32)
  (local $flags i32) (local $mode i32) (local $reg i32) (local $source i32)
  (local $start f32) (local $end f32) (local $density f32)
  (local.set $flags (i32.load offset=136 (local.get $row)))
  (if (i32.gt_u (local.get $flags) (i32.const 3)) (then (return (i32.const 0))))
  (if (i32.eqz (i32.and (local.get $flags) (i32.const 1))) (then (return (i32.const 1))))
  (local.set $mode (select (i32.const 0) (i32.load offset=140 (local.get $row)) (i32.and (i32.load offset=8 (local.get $desc)) (i32.const 1))))
  (if (i32.gt_u (local.get $mode) (i32.const 3)) (then (return (i32.const 0))))
  (call $d3d_fixed_def (local.get $ir) (i32.const 45) (f32.const 0) (f32.const 1) (f32.const 1) (f32.const 1))
  (if (i32.eqz (local.get $mode)) (then
    (local.set $reg (i32.load offset=156 (local.get $row)))
    (if (i32.gt_u (local.get $reg) (i32.const 16)) (then (return (i32.const 0))))
    (local.set $source (call $d3d_fixed_source (select (i32.const 2) (i32.const 1) (i32.eq (local.get $reg) (i32.const 16)))
      (select (i32.const 45) (local.get $reg) (i32.eq (local.get $reg) (i32.const 16))) (select (i32.const 0) (i32.const 255) (i32.eq (local.get $reg) (i32.const 16))) (i32.const 0))))
  (else
    (local.set $start (f32.load offset=144 (local.get $row))) (local.set $end (f32.load offset=148 (local.get $row))) (local.set $density (f32.load offset=152 (local.get $row)))
    (if (i32.eq (local.get $mode) (i32.const 3)) (then
      (if (i32.eqz (i32.and (i32.and (f32.le (f32.abs (local.get $start)) (f32.const 3.4028234663852886e38)) (f32.le (f32.abs (local.get $end)) (f32.const 3.4028234663852886e38))) (f32.ne (local.get $start) (local.get $end)))) (then (return (i32.const 0)))))
    (else (if (i32.eqz (f32.le (f32.abs (local.get $density)) (f32.const 3.4028234663852886e38))) (then (return (i32.const 0))))))
    (call $d3d_fixed_def (local.get $ir) (i32.const 44) (local.get $start) (local.get $end) (local.get $density) (f32.const -1.4426950408889634))
  (call $d3d_fixed_op (local.get $ir) (i32.const 20) (i32.const 0) (i32.const 6) (i32.const 15) (i32.const 0) (call $d3d_fixed_source (i32.const 1) (i32.load offset=12 (local.get $desc)) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 20) (i32.const 0) (i32.const 7) (i32.const 15) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 4) (i32.const 228) (i32.const 0)) (i32.const 0))
    (if (i32.and (local.get $flags) (i32.const 2)) (then
  (call $d3d_fixed_op (local.get $ir) (i32.const 8) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 228) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 12) (i32.const 0) (i32.const 6) (i32.const 2) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 45) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 80) (i32.const 0) (i32.const 7) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 45) (i32.const 85) (i32.const 0)))
  (call $d3d_fixed_op (local.get $ir) (i32.const 7) (i32.const 0) (i32.const 7) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 0) (i32.const 0)) (i32.const 0))
    ) (else
  (call $d3d_fixed_op (local.get $ir) (i32.const 11) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 170) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 170) (i32.const 1)) (i32.const 0))
    ))
    (if (i32.eq (local.get $mode) (i32.const 3)) (then
  (call $d3d_fixed_op (local.get $ir) (i32.const 3) (i32.const 0) (i32.const 7) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 44) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 3) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 44) (i32.const 85) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 44) (i32.const 0) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 6) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (i32.const 0))
    ) (else
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 44) (i32.const 170) (i32.const 0)) (i32.const 0))
      (if (i32.eq (local.get $mode) (i32.const 2)) (then
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (i32.const 0))
      ))
  (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 44) (i32.const 255) (i32.const 0)) (i32.const 0))
  (call $d3d_fixed_op (local.get $ir) (i32.const 14) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0))
    ))
    (local.set $source (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)))))
  (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 4) (i32.const 1) (i32.const 1) (i32.const 1) (local.get $source) (i32.const 0) (i32.const 0))
  (i32.const 1))

(func $d3d_fixed_compile_stages (param $desc i32) (param $stages i32) (param $uv i32) (result i32)
  (local $bundle i32) (local $vs i32) (local $ps i32) (local $flags i32) (local $disabled i32)
  (local $colorop i32) (local $alphaop i32) (local $ca i32) (local $cb i32) (local $aa i32) (local $ab i32)
  (local $sampled i32) (local $i i32) (local $matrix i32) (local $p i32) (local $pos i32) (local $map i32)
  (local $sx f32) (local $sy f32) (local $sz f32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 288))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $desc)) (i32.const 0x44465831))
    (i32.or (i32.lt_u (i32.load offset=4 (local.get $desc)) (i32.const 1)) (i32.gt_u (i32.load offset=4 (local.get $desc)) (i32.const 3)))) (then (return (i32.const 0))))
  (local.set $flags (i32.load offset=8 (local.get $desc)))
  (if (i32.or (i32.gt_u (local.get $flags) (select (i32.const 255) (select (i32.const 127) (i32.const 31) (i32.eq (i32.load offset=4 (local.get $desc)) (i32.const 2))) (i32.eq (i32.load offset=4 (local.get $desc)) (i32.const 3)))) (i32.ne (i32.load offset=92 (local.get $desc)) (i32.const 0))) (then (return (i32.const 0))))
  (if (i32.ge_u (i32.load offset=4 (local.get $desc)) (i32.const 2)) (then
    (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 320))) (then (return (i32.const 0))))
    (if (i32.or (i32.load offset=308 (local.get $desc)) (i32.or (i32.load offset=312 (local.get $desc)) (i32.load offset=316 (local.get $desc)))) (then (return (i32.const 0))))
    (if (i32.and (local.get $flags) (i32.const 128)) (then
      (local.set $i (i32.load offset=304 (local.get $desc)))
      (if (i32.or (i32.gt_u (local.get $i) (i32.const 15)) (i32.or (i32.eq (local.get $i) (i32.load offset=12 (local.get $desc)))
        (i32.or (i32.eq (local.get $i) (i32.load offset=16 (local.get $desc))) (i32.eq (local.get $i) (i32.load offset=20 (local.get $desc)))))) (then (return (i32.const 0))))
    ) (else (if (i32.load offset=304 (local.get $desc)) (then (return (i32.const 0))))))
    (local.set $i (i32.const 288))
    (loop $point_values
      (local.set $sx (f32.load (i32.add (local.get $desc) (local.get $i))))
      (if (i32.eqz (i32.and (f32.ge (local.get $sx) (f32.const 0)) (f32.le (local.get $sx) (f32.const 3.4028234663852886e38)))) (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $point_values (i32.lt_u (local.get $i) (i32.const 304))))))
  (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 64)) (i32.const 0)) (i32.eqz (i32.and (local.get $flags) (i32.const 32)))) (then (return (i32.const 0))))
  (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 128)) (i32.const 0)) (i32.eqz (i32.and (local.get $flags) (i32.const 32)))) (then (return (i32.const 0))))
  (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 16)) (i32.const 0))
    (i32.eqz (i32.and (local.get $flags) (i32.const 1)))) (then (return (i32.const 0))))
  (if (i32.gt_u (local.get $uv) (i32.const 1)) (then (return (i32.const 0))))
  (if (i32.and (local.get $stages) (i32.const 1)) (then
  (if (i32.or (i32.gt_u (i32.load offset=12 (local.get $desc)) (i32.const 15))
    (i32.or (i32.gt_u (i32.load offset=16 (local.get $desc)) (i32.const 15))
      (i32.gt_u (i32.load offset=20 (local.get $desc)) (i32.const 15)))) (then (return (i32.const 0))))
  (if (i32.or (i32.eq (i32.load offset=12 (local.get $desc)) (i32.load offset=16 (local.get $desc)))
    (i32.or (i32.eq (i32.load offset=12 (local.get $desc)) (i32.load offset=20 (local.get $desc)))
      (i32.eq (i32.load offset=16 (local.get $desc)) (i32.load offset=20 (local.get $desc))))) (then (return (i32.const 0))))
  ))
  (if (i32.and (local.get $stages) (i32.const 2)) (then
  (local.set $colorop (i32.load offset=24 (local.get $desc))) (local.set $alphaop (i32.load offset=36 (local.get $desc)))
  (local.set $disabled (i32.or (i32.eq (local.get $colorop) (i32.const 1))
    (i32.and (i32.eq (i32.load offset=28 (local.get $desc)) (i32.const 2)) (i32.eqz (i32.and (local.get $flags) (i32.const 8))))))
  (if (i32.eqz (local.get $disabled)) (then
    (if (i32.ne (i32.load offset=56 (local.get $desc)) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $stages) (i32.const 3)) (then
      (if (i32.or (i32.ne (i32.load offset=60 (local.get $desc)) (i32.const 0))
        (i32.gt_u (i32.load offset=64 (local.get $desc)) (i32.const 7))) (then (return (i32.const 0))))))
    (if (i32.or (i32.lt_u (local.get $colorop) (i32.const 2))
      (i32.or (i32.gt_u (local.get $colorop) (i32.const 11))
      (i32.or (i32.lt_u (local.get $alphaop) (i32.const 1)) (i32.gt_u (local.get $alphaop) (i32.const 11))))) (then (return (i32.const 0))))
    (if (i32.ne (local.get $colorop) (i32.const 3)) (then (local.set $ca (call $d3d_fixed_argument (i32.load offset=28 (local.get $desc)) (local.get $flags)))))
    (if (i32.ne (local.get $colorop) (i32.const 2)) (then (local.set $cb (call $d3d_fixed_argument (i32.load offset=32 (local.get $desc)) (local.get $flags)))))
    (if (i32.eq (local.get $alphaop) (i32.const 1))
      (then (local.set $aa (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 228) (i32.const 0))))
      (else
        (if (i32.ne (local.get $alphaop) (i32.const 3)) (then (local.set $aa (call $d3d_fixed_argument (i32.load offset=40 (local.get $desc)) (local.get $flags)))))
        (if (i32.ne (local.get $alphaop) (i32.const 2)) (then (local.set $ab (call $d3d_fixed_argument (i32.load offset=44 (local.get $desc)) (local.get $flags)))))))
    (if (i32.or (i32.lt_s (local.get $ca) (i32.const 0))
      (i32.or (i32.lt_s (local.get $cb) (i32.const 0))
      (i32.or (i32.lt_s (local.get $aa) (i32.const 0)) (i32.lt_s (local.get $ab) (i32.const 0))))) (then (return (i32.const 0))))
    (local.set $sampled (i32.or (i32.eq (i32.and (local.get $ca) (i32.const 15)) (i32.const 3))
      (i32.or (i32.eq (i32.and (local.get $cb) (i32.const 15)) (i32.const 3))
      (i32.or (i32.eq (i32.and (local.get $aa) (i32.const 15)) (i32.const 3)) (i32.eq (i32.and (local.get $ab) (i32.const 15)) (i32.const 3))))))
  ))))
  (if (i32.eq (local.get $stages) (i32.const 3)) (then (local.set $uv (local.get $sampled))))
  (if (i32.and (local.get $stages) (i32.const 1)) (then
  (if (i32.and (local.get $uv) (i32.eqz (i32.and (local.get $flags) (i32.const 4)))) (then (return (i32.const 0))))
  (if (local.get $uv) (then
    (if (i32.or (i32.ne (i32.load offset=60 (local.get $desc)) (i32.const 0))
      (i32.gt_u (i32.load offset=64 (local.get $desc)) (i32.const 7))) (then (return (i32.const 0))))))
  (if (i32.or (i32.eqz (i32.load offset=76 (local.get $desc)))
    (i32.or (i32.eqz (i32.load offset=80 (local.get $desc)))
    (i32.or (i32.gt_u (i32.load offset=76 (local.get $desc)) (i32.const 2048))
    (i32.or (i32.gt_u (i32.load offset=80 (local.get $desc)) (i32.const 2048))
    (i32.or (i32.gt_u (i32.load offset=68 (local.get $desc)) (i32.const 2048))
      (i32.gt_u (i32.load offset=72 (local.get $desc)) (i32.const 2048))))))) (then (return (i32.const 0))))
  (if (i32.eqz (i32.and (f32.ge (f32.load offset=84 (local.get $desc)) (f32.const 0))
    (i32.and (f32.le (f32.load offset=88 (local.get $desc)) (f32.const 1))
      (f32.le (f32.load offset=84 (local.get $desc)) (f32.load offset=88 (local.get $desc)))))) (then (return (i32.const 0))))
  (if (i32.eqz (i32.and (local.get $flags) (i32.const 1))) (then
    (local.set $i (i32.const 0))
    (loop $matrices
      (if (i32.eqz (f32.le (f32.abs (f32.load (i32.add (i32.add (local.get $desc) (i32.const 96)) (i32.shl (local.get $i) (i32.const 2))))) (f32.const 3.4028234663852886e38))) (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $matrices (i32.lt_u (local.get $i) (i32.const 48))))))
  ))
  (local.set $bundle (call $heap_alloc (i32.const 32)))
  (if (i32.eqz (local.get $bundle)) (then (return (i32.const 0))))
  (local.set $bundle (call $g2w (local.get $bundle))) (memory.fill (local.get $bundle) (i32.const 0) (i32.const 32))
  (i32.store (local.get $bundle) (i32.const 0x44464231))
  (block $failure
    (if (i32.and (local.get $stages) (i32.const 1)) (then
    (local.set $vs (call $d3d_fixed_ir (i32.const 0))) (i32.store offset=4 (local.get $bundle) (local.get $vs))
    (br_if $failure (i32.eqz (local.get $vs)))
    (call $d3d_fixed_def (local.get $vs) (i32.const 12) (f32.const 1) (f32.const 1) (f32.const 1) (f32.const 1))
    (local.set $pos (call $d3d_fixed_source (i32.const 1) (i32.load offset=12 (local.get $desc)) (i32.const 228) (i32.const 0)))
    (block $position_done
    (if (i32.and (local.get $flags) (i32.const 16)) (then
      (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 4) (i32.const 0) (i32.const 15) (i32.const 0)
        (local.get $pos) (i32.const 0) (i32.const 0))
      (br $position_done)))
    (if (i32.and (local.get $flags) (i32.const 1))
      (then
        (local.set $sx (f32.div (f32.const 2) (f32.convert_i32_u (i32.load offset=76 (local.get $desc)))))
        (local.set $sy (f32.div (f32.const -2) (f32.convert_i32_u (i32.load offset=80 (local.get $desc)))))
        (local.set $sz (f32.sub (f32.load offset=88 (local.get $desc)) (f32.load offset=84 (local.get $desc))))
        (if (f32.ne (local.get $sz) (f32.const 0)) (then (local.set $sz (f32.div (f32.const 1) (local.get $sz)))))
        (call $d3d_fixed_def (local.get $vs) (i32.const 0) (local.get $sx) (local.get $sy) (local.get $sz) (f32.const 0))
        (call $d3d_fixed_def (local.get $vs) (i32.const 1)
          (f32.sub (f32.const -1) (f32.mul (f32.convert_i32_u (i32.load offset=68 (local.get $desc))) (local.get $sx)))
          (f32.sub (f32.const 1) (f32.mul (f32.convert_i32_u (i32.load offset=72 (local.get $desc))) (local.get $sy)))
          (f32.neg (f32.mul (f32.load offset=84 (local.get $desc)) (local.get $sz))) (f32.const 1))
        (call $d3d_fixed_op (local.get $vs) (i32.const 6) (i32.const 0) (i32.const 1) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 1) (i32.load offset=12 (local.get $desc)) (i32.const 255) (i32.const 0)) (i32.const 0) (i32.const 0))
        (call $d3d_fixed_op (local.get $vs) (i32.const 4) (i32.const 0) (i32.const 0) (i32.const 15) (i32.const 0) (local.get $pos)
          (call $d3d_fixed_source (i32.const 2) (i32.const 0) (i32.const 228) (i32.const 0))
          (call $d3d_fixed_source (i32.const 2) (i32.const 1) (i32.const 228) (i32.const 0)))
        (call $d3d_fixed_op (local.get $vs) (i32.const 5) (i32.const 4) (i32.const 0) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 0) (i32.const 228) (i32.const 0))
          (call $d3d_fixed_source (i32.const 0) (i32.const 1) (i32.const 228) (i32.const 0)) (i32.const 0)))
      (else
        (local.set $i (i32.const 0))
        (loop $matrix_defs
          (local.set $matrix (i32.add (i32.add (local.get $desc) (i32.const 96)) (i32.mul (i32.shr_u (local.get $i) (i32.const 2)) (i32.const 64))))
          (local.set $p (i32.add (local.get $matrix) (i32.shl (i32.and (local.get $i) (i32.const 3)) (i32.const 2))))
          (call $d3d_fixed_def (local.get $vs) (local.get $i) (f32.load (local.get $p)) (f32.load offset=16 (local.get $p)) (f32.load offset=32 (local.get $p)) (f32.load offset=48 (local.get $p)))
          (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $matrix_defs (i32.lt_u (local.get $i) (i32.const 12))))
        (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 0) (i32.const 15) (i32.const 0) (local.get $pos)
          (call $d3d_fixed_source (i32.const 2) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0))
        (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 1) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 0) (i32.const 228) (i32.const 0))
          (call $d3d_fixed_source (i32.const 2) (i32.const 4) (i32.const 228) (i32.const 0)) (i32.const 0))
        (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 4) (i32.const 0) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 1) (i32.const 228) (i32.const 0))
          (call $d3d_fixed_source (i32.const 2) (i32.const 8) (i32.const 228) (i32.const 0)) (i32.const 0)))))
    (if (i32.and (local.get $flags) (i32.const 32)) (then (call $d3d_fixed_points (local.get $vs) (local.get $desc) (local.get $flags))))
    (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 5) (i32.const 0) (i32.const 15) (i32.const 1)
      (select (call $d3d_fixed_source (i32.const 1) (i32.load offset=16 (local.get $desc)) (i32.const 228) (i32.const 0))
        (call $d3d_fixed_source (i32.const 2) (i32.const 12) (i32.const 228) (i32.const 0)) (i32.and (local.get $flags) (i32.const 2))) (i32.const 0) (i32.const 0))
    (if (local.get $uv) (then
      (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 6) (i32.const 0) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.load offset=20 (local.get $desc)) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))))
    (i32.store offset=12 (local.get $bundle) (call $d3d_fixed_packet (local.get $vs)))
    (br_if $failure (i32.eqz (i32.load offset=12 (local.get $bundle))))
    (local.set $map (i32.or (i32.load offset=12 (local.get $desc))
      (i32.or (i32.shl (i32.load offset=16 (local.get $desc)) (i32.const 4)) (i32.shl (i32.load offset=20 (local.get $desc)) (i32.const 8)))))
    (i32.store offset=24 (local.get $bundle) (local.get $map))
    ))
    (if (i32.and (local.get $stages) (i32.const 2)) (then
    (local.set $ps (call $d3d_fixed_ir (i32.const 1))) (i32.store offset=8 (local.get $bundle) (local.get $ps))
    (br_if $failure (i32.eqz (local.get $ps)))
    (call $d3d_fixed_argb (local.get $ps) (i32.const 0) (i32.load offset=48 (local.get $desc)))
    (call $d3d_fixed_argb (local.get $ps) (i32.const 1) (i32.load offset=52 (local.get $desc)))
    (call $d3d_fixed_def (local.get $ps) (i32.const 2) (f32.const 0.5) (f32.const 0.5) (f32.const 0.5) (f32.const 0.5))
    (call $d3d_fixed_def (local.get $ps) (i32.const 3) (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 0))
    (if (local.get $sampled) (then (call $d3d_fixed_op (local.get $ps) (i32.const 66) (i32.const 3) (i32.const 0) (i32.const 15) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (local.get $disabled)
      (then (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0)))
      (else
        (call $d3d_fixed_combine (local.get $ps) (local.get $colorop) (local.get $ca) (local.get $cb) (i32.const 7) (i32.const 2))
        (call $d3d_fixed_combine (local.get $ps) (select (i32.const 2) (local.get $alphaop) (i32.eq (local.get $alphaop) (i32.const 1))) (local.get $aa) (local.get $ab) (i32.const 8) (i32.const 2))))
    (i32.store offset=16 (local.get $bundle) (call $d3d_fixed_packet (local.get $ps)))
    (br_if $failure (i32.eqz (i32.load offset=16 (local.get $bundle))))
    (i32.store offset=20 (local.get $bundle) (local.get $sampled))
    ))
    (i32.store offset=28 (local.get $bundle) (local.get $flags))
    (return (local.get $bundle)))
  (call $d3d_fixed_free (local.get $bundle)) (i32.const 0))

;; DLT1 lighting ABI1: header128, active directional rows64 (maximum8).
;; Header: magic/version/count/normalReg, diffuseReg/specularReg (16 absent),
;; normalize/COLORVERTEX, diffuse/ambient/emissive sources0..2, reserved,
;; ambientARGB, reserved52..63, material diffuse64/ambient80/emissive96,
;; reserved112..127. Row: type3, diffuse4, ambient20, direction36, reserved48..63.
;; ABI2 (version 2) widens each row to 128 bytes and admits D3DLIGHT_POINT (1)
;; and D3DLIGHT_SPOT (2): position48, range60, attenuation0/1/2 at 64/68/72,
;; falloff76, cos(theta/2)80, cos(phi/2)84, reserved88..127. The cosines are
;; the caller's, so no transcendental runs here. Positional terms are computed
;; per vertex in eye space from r1 (world*view position, left by the fixed VS):
;; atten = [d < range] / (a0 + a1*d + a2*d*d), spot = clamp((rho - cos(phi/2)) /
;; (cos(theta/2) - cos(phi/2)))^falloff, and both scale diffuse AND ambient, as
;; D3D9 does. Constants are packed from c52 by type -- directional 3, point 4,
;; spot 5 (its cone scale and falloff ride in diffuse.w/ambient.w) -- so eight
;; spots end at c91, inside vs_1_1's 96-constant file.
;; State lowering only: all vertex lighting still executes as native VM ops.
(func $d3d_fixed_light_source (param $p i32) (param $selector i32) (param $constant i32) (result i32)
  (local $reg i32)
  (local.set $reg (i32.const 16))
  (if (i32.load offset=28 (local.get $p)) (then
    (if (i32.eq (local.get $selector) (i32.const 1)) (then (local.set $reg (i32.load offset=16 (local.get $p)))))
    (if (i32.eq (local.get $selector) (i32.const 2)) (then (local.set $reg (i32.load offset=20 (local.get $p)))))))
  (call $d3d_fixed_source (select (i32.const 1) (i32.const 2) (i32.lt_u (local.get $reg) (i32.const 16)))
    (select (local.get $reg) (local.get $constant) (i32.lt_u (local.get $reg) (i32.const 16))) (i32.const 228) (i32.const 0)))

;; Shorthands for the positional-light lowering: temp/constant sources, and a
;; temp-destination op with no result modifier.
(func $d3d_fl_r (param $i i32) (param $s i32) (result i32) (call $d3d_fixed_source (i32.const 0) (local.get $i) (local.get $s) (i32.const 0)))
(func $d3d_fl_c (param $i i32) (param $s i32) (result i32) (call $d3d_fixed_source (i32.const 2) (local.get $i) (local.get $s) (i32.const 0)))
(func $d3d_fl_t (param $ir i32) (param $op i32) (param $reg i32) (param $mask i32) (param $a i32) (param $b i32) (param $c i32)
  (call $d3d_fixed_op (local.get $ir) (local.get $op) (i32.const 0) (local.get $reg) (local.get $mask) (i32.const 0) (local.get $a) (local.get $b) (local.get $c)))

;; One ABI2 point/spot row: constants c_k..c_k+3 (spot: +c_k+4, with the cone
;; scale in c_k+1.w and the falloff in c_k+2.w), then r3.w = atten*spot and
;; r2.xyz = normalized vertex-to-light vector. The caller accumulates.
(func $d3d_fixed_positional_light (param $ir i32) (param $desc i32) (param $p i32) (param $k i32)
  (local $x f32) (local $y f32) (local $z f32) (local $d f32) (local $a0 f32) (local $inv f32) (local $falloff f32)
  ;; Eye-space position: the row vector (px,py,pz,1) times the row-major view.
  (local.set $x (f32.add (f32.add (f32.add (f32.mul (f32.load offset=48 (local.get $p)) (f32.load offset=160 (local.get $desc))) (f32.mul (f32.load offset=52 (local.get $p)) (f32.load offset=176 (local.get $desc)))) (f32.mul (f32.load offset=56 (local.get $p)) (f32.load offset=192 (local.get $desc)))) (f32.load offset=208 (local.get $desc))))
  (local.set $y (f32.add (f32.add (f32.add (f32.mul (f32.load offset=48 (local.get $p)) (f32.load offset=164 (local.get $desc))) (f32.mul (f32.load offset=52 (local.get $p)) (f32.load offset=180 (local.get $desc)))) (f32.mul (f32.load offset=56 (local.get $p)) (f32.load offset=196 (local.get $desc)))) (f32.load offset=212 (local.get $desc))))
  (local.set $z (f32.add (f32.add (f32.add (f32.mul (f32.load offset=48 (local.get $p)) (f32.load offset=168 (local.get $desc))) (f32.mul (f32.load offset=52 (local.get $p)) (f32.load offset=184 (local.get $desc)))) (f32.mul (f32.load offset=56 (local.get $p)) (f32.load offset=200 (local.get $desc)))) (f32.load offset=216 (local.get $desc))))
  (call $d3d_fixed_def (local.get $ir) (local.get $k) (local.get $x) (local.get $y) (local.get $z) (f32.const 1))
  ;; Spot cone scale; an inner cone no wider than the outer one is a hard edge.
  (local.set $inv (f32.sub (f32.load offset=80 (local.get $p)) (f32.load offset=84 (local.get $p))))
  (local.set $inv (select (f32.div (f32.const 1) (local.get $inv)) (f32.const 1e30) (f32.gt (local.get $inv) (f32.const 1e-30))))
  (local.set $falloff (f32.load offset=76 (local.get $p)))
  (call $d3d_fixed_def (local.get $ir) (i32.add (local.get $k) (i32.const 1)) (f32.load offset=4 (local.get $p)) (f32.load offset=8 (local.get $p)) (f32.load offset=12 (local.get $p)) (local.get $inv))
  (call $d3d_fixed_def (local.get $ir) (i32.add (local.get $k) (i32.const 2)) (f32.load offset=20 (local.get $p)) (f32.load offset=24 (local.get $p)) (f32.load offset=28 (local.get $p)) (local.get $falloff))
  ;; All-zero attenuation has no defined value; treat it as constant 1.
  (local.set $a0 (f32.load offset=64 (local.get $p)))
  (if (i32.and (i32.and (f32.eq (local.get $a0) (f32.const 0)) (f32.eq (f32.load offset=68 (local.get $p)) (f32.const 0)))
      (f32.eq (f32.load offset=72 (local.get $p)) (f32.const 0))) (then (local.set $a0 (f32.const 1))))
  (call $d3d_fixed_def (local.get $ir) (i32.add (local.get $k) (i32.const 3)) (f32.load offset=60 (local.get $p))
    (local.get $a0) (f32.load offset=68 (local.get $p)) (f32.load offset=72 (local.get $p)))
  (call $d3d_fl_t (local.get $ir) (i32.const 3) (i32.const 2) (i32.const 7) (call $d3d_fl_c (local.get $k) (i32.const 228)) (call $d3d_fl_r (i32.const 1) (i32.const 228)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 8) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 2) (i32.const 228)) (call $d3d_fl_r (i32.const 2) (i32.const 228)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 7) (i32.const 3) (i32.const 2) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (i32.const 0) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 2) (i32.const 7) (call $d3d_fl_r (i32.const 2) (i32.const 228)) (call $d3d_fl_r (i32.const 3) (i32.const 85)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 3) (i32.const 4) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fl_r (i32.const 3) (i32.const 85)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 4) (i32.const 3) (i32.const 8) (call $d3d_fl_r (i32.const 3) (i32.const 170)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 3)) (i32.const 170)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 3)) (i32.const 85)))
  (call $d3d_fl_t (local.get $ir) (i32.const 4) (i32.const 3) (i32.const 8) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 3)) (i32.const 255)) (call $d3d_fl_r (i32.const 3) (i32.const 255)))
  (call $d3d_fl_t (local.get $ir) (i32.const 6) (i32.const 3) (i32.const 8) (call $d3d_fl_r (i32.const 3) (i32.const 255)) (i32.const 0) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 12) (i32.const 2) (i32.const 8) (call $d3d_fl_r (i32.const 3) (i32.const 170)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 3)) (i32.const 0)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 3) (i32.const 8) (call $d3d_fl_r (i32.const 3) (i32.const 255)) (call $d3d_fl_r (i32.const 2) (i32.const 255)) (i32.const 0))
  (if (i32.ne (i32.load (local.get $p)) (i32.const 2)) (then (return)))
  ;; Spot: the light's own direction in eye space, normalized, not negated.
  (local.set $x (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=160 (local.get $desc))) (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=176 (local.get $desc)))) (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=192 (local.get $desc)))))
  (local.set $y (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=164 (local.get $desc))) (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=180 (local.get $desc)))) (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=196 (local.get $desc)))))
  (local.set $z (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=168 (local.get $desc))) (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=184 (local.get $desc)))) (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=200 (local.get $desc)))))
  (local.set $d (f32.add (f32.add (f32.mul (local.get $x) (local.get $x)) (f32.mul (local.get $y) (local.get $y))) (f32.mul (local.get $z) (local.get $z))))
  (if (i32.and (f32.gt (local.get $d) (f32.const 0)) (f32.le (local.get $d) (f32.const 3.4028234663852886e38))) (then
    (local.set $d (f32.div (f32.const 1) (f32.sqrt (local.get $d))))
    (local.set $x (f32.mul (local.get $x) (local.get $d))) (local.set $y (f32.mul (local.get $y) (local.get $d))) (local.set $z (f32.mul (local.get $z) (local.get $d))))
  (else (local.set $x (f32.const 0)) (local.set $y (f32.const 0)) (local.set $z (f32.const 0))))
  (call $d3d_fixed_def (local.get $ir) (i32.add (local.get $k) (i32.const 4)) (local.get $x) (local.get $y) (local.get $z) (f32.load offset=84 (local.get $p)))
  (call $d3d_fixed_op (local.get $ir) (i32.const 8) (i32.const 0) (i32.const 3) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 228) (i32.const 1)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 4)) (i32.const 228)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 2) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.add (local.get $k) (i32.const 4)) (i32.const 255) (i32.const 1)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 1)) (i32.const 255)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 11) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fl_c (i32.const 43) (i32.const 0)) (i32.const 0))
  (call $d3d_fl_t (local.get $ir) (i32.const 10) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fl_c (i32.const 43) (i32.const 170)) (i32.const 0))
  (if (f32.eq (local.get $falloff) (f32.const 0))
    (then (call $d3d_fl_t (local.get $ir) (i32.const 12) (i32.const 3) (i32.const 1) (call $d3d_fl_c (i32.const 43) (i32.const 0)) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (i32.const 0)))
    (else (if (f32.ne (local.get $falloff) (f32.const 1)) (then
      (call $d3d_fl_t (local.get $ir) (i32.const 15) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (i32.const 0) (i32.const 0))
      (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 2)) (i32.const 255)) (i32.const 0))
      (call $d3d_fl_t (local.get $ir) (i32.const 14) (i32.const 3) (i32.const 1) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (i32.const 0) (i32.const 0))))))
  (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 3) (i32.const 8) (call $d3d_fl_r (i32.const 3) (i32.const 255)) (call $d3d_fl_r (i32.const 3) (i32.const 0)) (i32.const 0)))

(func $d3d_fixed_bind_lighting (export "d3d_fixed_bind_lighting") (param $bundle i32) (param $desc i32) (param $lighting i32) (result i32)
  (local $old i32) (local $ir i32) (local $program i32) (local $n i32) (local $i i32) (local $j i32) (local $p i32) (local $k i32)
  (local $md i32) (local $ma i32) (local $me i32)
  (local $v2 i32) (local $shift i32) (local $end i32) (local $type i32)
  (local $x f32) (local $y f32) (local $z f32) (local $d f32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $bundle) (i32.const 32))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 288))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $lighting) (i32.const 128))) (then (return (i32.const 0))))
  (if (i32.or (i32.ne (i32.load (local.get $bundle)) (i32.const 0x44464231))
    (i32.or (i32.ne (i32.load (local.get $lighting)) (i32.const 0x444c5431))
      (i32.or (i32.lt_u (i32.load offset=4 (local.get $lighting)) (i32.const 1))
        (i32.gt_u (i32.load offset=4 (local.get $lighting)) (i32.const 2))))) (then (return (i32.const 0))))
  (local.set $v2 (i32.eq (i32.load offset=4 (local.get $lighting)) (i32.const 2)))
  (local.set $shift (select (i32.const 7) (i32.const 6) (local.get $v2)))
  (local.set $end (select (i32.const 88) (i32.const 48) (local.get $v2)))
  (if (i32.and (i32.load offset=8 (local.get $desc)) (i32.const 1)) (then (return (i32.const 1))))
  (local.set $old (i32.load offset=4 (local.get $bundle)))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $old) (i32.const 32))) (then (return (i32.const 0))))
  (if (i32.gt_u (i32.load offset=16 (local.get $old)) (i32.const 128)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=24 (local.get $old)) (i32.add (i32.const 32) (i32.shl (i32.load offset=16 (local.get $old)) (i32.const 7)))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $old) (i32.load offset=24 (local.get $old)))) (then (return (i32.const 0))))
  (local.set $n (i32.load offset=8 (local.get $lighting)))
  (if (i32.or (i32.gt_u (local.get $n) (i32.const 8))
    (i32.gt_u (i32.add (i32.load offset=16 (local.get $old)) (i32.add (i32.const 32) (i32.mul (local.get $n) (select (i32.const 30) (i32.const 7) (local.get $v2)))))
      (select (i32.const 512) (i32.const 128) (local.get $v2)))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $lighting) (i32.add (i32.const 128) (i32.shl (local.get $n) (local.get $shift))))) (then (return (i32.const 0))))
  ;; normalReg 16 = the declaration has no NORMAL. D3D9 lights such a vertex
  ;; with N = 0: every diffuse and specular term vanishes and only the ambient
  ;; and emissive sums remain (Morrowind's unlit-mesh draws).
  (if (i32.or (i32.gt_u (i32.load offset=12 (local.get $lighting)) (i32.const 16))
    (i32.or (i32.gt_u (i32.load offset=16 (local.get $lighting)) (i32.const 16))
      (i32.gt_u (i32.load offset=20 (local.get $lighting)) (i32.const 16)))) (then (return (i32.const 0))))
  (if (i32.or (i32.gt_u (i32.load offset=24 (local.get $lighting)) (i32.const 1))
    (i32.gt_u (i32.load offset=28 (local.get $lighting)) (i32.const 1))) (then (return (i32.const 0))))
  (if (i32.or (i32.and (i32.lt_u (i32.load offset=12 (local.get $lighting)) (i32.const 16))
      (i32.or (i32.eq (i32.load offset=12 (local.get $lighting)) (i32.load offset=16 (local.get $lighting)))
        (i32.eq (i32.load offset=12 (local.get $lighting)) (i32.load offset=20 (local.get $lighting)))))
    (i32.and (i32.lt_u (i32.load offset=16 (local.get $lighting)) (i32.const 16))
      (i32.eq (i32.load offset=16 (local.get $lighting)) (i32.load offset=20 (local.get $lighting))))) (then (return (i32.const 0))))
  (if (i32.load offset=44 (local.get $lighting)) (then (return (i32.const 0))))
  (local.set $i (i32.const 52))
  (loop $reserved
    (if (i32.load (i32.add (local.get $lighting) (local.get $i))) (then (return (i32.const 0))))
    (local.set $i (select (i32.const 112) (i32.add (local.get $i) (i32.const 4)) (i32.eq (local.get $i) (i32.const 60))))
    (br_if $reserved (i32.lt_u (local.get $i) (i32.const 128))))
  (local.set $i (i32.const 32))
  (loop $selectors
    (if (i32.gt_u (i32.load (i32.add (local.get $lighting) (local.get $i))) (i32.const 2)) (then (return (i32.const 0))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $selectors (i32.le_u (local.get $i) (i32.const 40))))
  (local.set $i (i32.const 64))
  (loop $materials
    (if (i32.eqz (f32.le (f32.abs (f32.load (i32.add (local.get $lighting) (local.get $i)))) (f32.const 3.4028234663852886e38))) (then (return (i32.const 0))))
    (local.set $i (i32.add (local.get $i) (i32.const 4))) (br_if $materials (i32.lt_u (local.get $i) (i32.const 112))))
  (local.set $i (i32.const 0))
  (block $validated (loop $lights
    (br_if $validated (i32.ge_u (local.get $i) (local.get $n)))
    (local.set $p (i32.add (local.get $lighting) (i32.add (i32.const 128) (i32.shl (local.get $i) (local.get $shift)))))
    (local.set $type (i32.load (local.get $p)))
    ;; ABI1 rows are directional only; ABI2 adds point (1) and spot (2).
    (if (i32.eqz (i32.or (i32.eq (local.get $type) (i32.const 3))
      (i32.and (local.get $v2) (i32.and (i32.ge_u (local.get $type) (i32.const 1)) (i32.le_u (local.get $type) (i32.const 2))))))
      (then (return (i32.const 0))))
    (local.set $j (i32.const 4))
    (loop $values
      (if (i32.eqz (f32.le (f32.abs (f32.load (i32.add (local.get $p) (local.get $j)))) (f32.const 3.4028234663852886e38))) (then (return (i32.const 0))))
      (local.set $j (i32.add (local.get $j) (i32.const 4))) (br_if $values (i32.lt_u (local.get $j) (local.get $end))))
    (loop $row_reserved
      (if (i32.load (i32.add (local.get $p) (local.get $j))) (then (return (i32.const 0))))
      (local.set $j (i32.add (local.get $j) (i32.const 4))) (br_if $row_reserved (i32.lt_u (local.get $j) (i32.shl (i32.const 1) (local.get $shift)))))
    (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $lights)))
  ;; Clone before append: failure leaves the old bundle and packets intact.
  (local.set $ir (call $d3d_fixed_ir_sized (i32.const 0) (select
    (i32.add (i32.const 32) (i32.shl (i32.add (i32.load offset=16 (local.get $old)) (i32.add (i32.const 32) (i32.mul (local.get $n) (i32.const 30)))) (i32.const 7)))
    (i32.const 16416) (local.get $v2))))
  (if (i32.eqz (local.get $ir)) (then (return (i32.const 0))))
  (memory.copy (local.get $ir) (local.get $old) (i32.load offset=24 (local.get $old)))
  (block $failure
    (br_if $failure (i32.eqz (call $d3d_fixed_normal_matrix (local.get $desc) (local.get $ir))))
    (call $d3d_fixed_def (local.get $ir) (i32.const 43) (f32.const 0) (f32.const 0) (f32.const 1) (f32.const 3.4028234663852886e38))
    (if (i32.eq (i32.load offset=12 (local.get $lighting)) (i32.const 16)) (then
    (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 0) (i32.const 8) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 43) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0)))
    (else
    (call $d3d_fixed_op (local.get $ir) (i32.const 23) (i32.const 0) (i32.const 8) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 1) (i32.load offset=12 (local.get $lighting)) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 40) (i32.const 228) (i32.const 0)) (i32.const 0))
    (if (i32.load offset=24 (local.get $lighting)) (then (call $d3d_fixed_normalize (local.get $ir) (i32.const 8))))))
    (local.set $i (i32.const 0))
    (loop $material_defs
      (local.set $p (i32.add (local.get $lighting) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4)))))
      (call $d3d_fixed_def (local.get $ir) (i32.add (i32.const 48) (local.get $i))
        (f32.load (local.get $p)) (f32.load offset=4 (local.get $p)) (f32.load offset=8 (local.get $p)) (f32.load offset=12 (local.get $p)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $material_defs (i32.lt_u (local.get $i) (i32.const 3))))
    (call $d3d_fixed_argb (local.get $ir) (i32.const 51) (i32.load offset=48 (local.get $lighting)))
    (local.set $md (call $d3d_fixed_light_source (local.get $lighting) (i32.load offset=32 (local.get $lighting)) (i32.const 48)))
    (local.set $ma (call $d3d_fixed_light_source (local.get $lighting) (i32.load offset=36 (local.get $lighting)) (i32.const 49)))
    (local.set $me (call $d3d_fixed_light_source (local.get $lighting) (i32.load offset=40 (local.get $lighting)) (i32.const 50)))
    (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 0) (i32.const 4) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 51) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
    (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 0) (i32.const 5) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 0) (i32.const 0)) (i32.const 0) (i32.const 0))
    (local.set $i (i32.const 0)) (local.set $k (i32.const 52))
    (block $lit (loop $accumulate
      (br_if $lit (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $p (i32.add (local.get $lighting) (i32.add (i32.const 128) (i32.shl (local.get $i) (local.get $shift)))))
      (if (i32.ne (i32.load (local.get $p)) (i32.const 3)) (then
        (call $d3d_fixed_positional_light (local.get $ir) (local.get $desc) (local.get $p) (local.get $k))
        (call $d3d_fl_t (local.get $ir) (i32.const 8) (i32.const 6) (i32.const 1) (call $d3d_fl_r (i32.const 8) (i32.const 228)) (call $d3d_fl_r (i32.const 2) (i32.const 228)) (i32.const 0))
        (call $d3d_fl_t (local.get $ir) (i32.const 11) (i32.const 6) (i32.const 1) (call $d3d_fl_r (i32.const 6) (i32.const 0)) (call $d3d_fl_c (i32.const 15) (i32.const 0)) (i32.const 0))
        (call $d3d_fl_t (local.get $ir) (i32.const 5) (i32.const 6) (i32.const 1) (call $d3d_fl_r (i32.const 6) (i32.const 0)) (call $d3d_fl_r (i32.const 3) (i32.const 255)) (i32.const 0))
        (call $d3d_fl_t (local.get $ir) (i32.const 4) (i32.const 5) (i32.const 7) (call $d3d_fl_r (i32.const 6) (i32.const 0)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 1)) (i32.const 228)) (call $d3d_fl_r (i32.const 5) (i32.const 228)))
        (call $d3d_fl_t (local.get $ir) (i32.const 4) (i32.const 4) (i32.const 7) (call $d3d_fl_r (i32.const 3) (i32.const 255)) (call $d3d_fl_c (i32.add (local.get $k) (i32.const 2)) (i32.const 228)) (call $d3d_fl_r (i32.const 4) (i32.const 228)))
        (local.set $k (i32.add (local.get $k) (select (i32.const 5) (i32.const 4) (i32.eq (i32.load (local.get $p)) (i32.const 2)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $accumulate)))
      (local.set $x (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=160 (local.get $desc))) (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=176 (local.get $desc)))) (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=192 (local.get $desc))))) (local.set $y (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=164 (local.get $desc))) (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=180 (local.get $desc)))) (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=196 (local.get $desc))))) (local.set $z (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=168 (local.get $desc))) (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=184 (local.get $desc)))) (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=200 (local.get $desc)))))
      (local.set $d (f32.add (f32.add (f32.mul (local.get $x) (local.get $x)) (f32.mul (local.get $y) (local.get $y))) (f32.mul (local.get $z) (local.get $z))))
      (if (i32.and (f32.gt (local.get $d) (f32.const 0)) (f32.le (local.get $d) (f32.const 3.4028234663852886e38))) (then
        (local.set $d (f32.neg (f32.div (f32.const 1) (f32.sqrt (local.get $d)))))
        (local.set $x (f32.mul (local.get $x) (local.get $d))) (local.set $y (f32.mul (local.get $y) (local.get $d))) (local.set $z (f32.mul (local.get $z) (local.get $d))))
      (else (local.set $x (f32.const 0)) (local.set $y (f32.const 0)) (local.set $z (f32.const 0))))
      (call $d3d_fixed_def (local.get $ir) (local.get $k) (local.get $x) (local.get $y) (local.get $z) (f32.const 0))
      (call $d3d_fixed_def (local.get $ir) (i32.add (local.get $k) (i32.const 1)) (f32.load offset=4 (local.get $p)) (f32.load offset=8 (local.get $p)) (f32.load offset=12 (local.get $p)) (f32.load offset=16 (local.get $p)))
      (call $d3d_fixed_def (local.get $ir) (i32.add (local.get $k) (i32.const 2)) (f32.load offset=20 (local.get $p)) (f32.load offset=24 (local.get $p)) (f32.load offset=28 (local.get $p)) (f32.load offset=32 (local.get $p)))
      (call $d3d_fixed_op (local.get $ir) (i32.const 8) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 8) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (local.get $k) (i32.const 228) (i32.const 0)) (i32.const 0))
      (call $d3d_fixed_op (local.get $ir) (i32.const 11) (i32.const 0) (i32.const 6) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 0) (i32.const 0)) (i32.const 0))
      (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 5) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.add (local.get $k) (i32.const 1)) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 5) (i32.const 228) (i32.const 0)))
      (call $d3d_fixed_op (local.get $ir) (i32.const 2) (i32.const 0) (i32.const 4) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 4) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.add (local.get $k) (i32.const 2)) (i32.const 228) (i32.const 0)) (i32.const 0))
      (local.set $k (i32.add (local.get $k) (i32.const 3)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $accumulate)))
    (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 4) (i32.const 7) (i32.const 0) (local.get $ma) (call $d3d_fixed_source (i32.const 0) (i32.const 4) (i32.const 228) (i32.const 0)) (local.get $me))
    (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 5) (i32.const 0) (i32.const 7) (i32.const 1) (local.get $md) (call $d3d_fixed_source (i32.const 0) (i32.const 5) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 4) (i32.const 228) (i32.const 0)))
    (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 5) (i32.const 0) (i32.const 8) (i32.const 1) (local.get $md) (i32.const 0) (i32.const 0))
    (local.set $program (call $d3d_fixed_packet (local.get $ir)))
    (br_if $failure (i32.eqz (local.get $program)))
    (call $d3d_shader_vm_free (i32.load offset=12 (local.get $bundle)))
    (call $d3d_shader_vm_free (local.get $old))
    (i32.store offset=4 (local.get $bundle) (local.get $ir))
    (i32.store offset=12 (local.get $bundle) (local.get $program))
    (return (i32.const 1)))
  (call $d3d_shader_vm_free (local.get $ir)) (i32.const 0))


;; Selected-stage bundles retain the paired ABI and ownership rules. Unused
;; stage pointers are zero; callers supply the independently bound guest stage.
(func $d3d_fixed_compile (export "d3d_fixed_compile") (param $desc i32) (result i32)
  (call $d3d_fixed_compile_stages (local.get $desc) (i32.const 3) (i32.const 0)))
;; Shared executor profile 1: FLOAT4 POSITIONT + diffuse + UV0, texture0,
;; MODULATE(texture,diffuse) for RGB and alpha. Constants remain immutable DEF
;; records in the returned DFB1 IR. Both executors run the clip-space VS; do
;; not set the software-only screen-space flag16 for this contract.
;; Identity viewport depth only. The bridge additionally admits only in-range
;; POSITIONT vertex depths (vertices are not part of this compiler descriptor).
;; Other depth ranges retain the established per-executor fixed fallback.
(func (export "d3d_fixed_compile_positiont") (param $desc i32) (result i32)
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $desc) (i32.const 288))) (then (return (i32.const 0))))
  (if (i32.eqz (i32.and (f32.eq (f32.load offset=84 (local.get $desc)) (f32.const 0))
    (f32.eq (f32.load offset=88 (local.get $desc)) (f32.const 1)))) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=8 (local.get $desc)) (i32.const 15)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=24 (local.get $desc)) (i32.const 4)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=28 (local.get $desc)) (i32.const 2)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=32 (local.get $desc)) (i32.const 0)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=36 (local.get $desc)) (i32.const 4)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=40 (local.get $desc)) (i32.const 2)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=44 (local.get $desc)) (i32.const 0)) (then (return (i32.const 0))))
  (if (i32.ne (i32.load offset=56 (local.get $desc)) (i32.const 1)) (then (return (i32.const 0))))
  (if (i32.load offset=60 (local.get $desc)) (then (return (i32.const 0))))
  (if (i32.load offset=64 (local.get $desc)) (then (return (i32.const 0))))
  (call $d3d_fixed_compile (local.get $desc)))
(func (export "d3d_fixed_compile_vertex") (param $desc i32) (param $uv0_required i32) (result i32)
  (call $d3d_fixed_compile_stages (local.get $desc) (i32.const 1) (local.get $uv0_required)))
(func (export "d3d_fixed_compile_pixel") (param $desc i32) (result i32)
  (call $d3d_fixed_compile_stages (local.get $desc) (i32.const 2) (i32.const 0)))

;; Cascade table: count1..6 records of48 bytes, each COLOROP/ARG1/ARG2,
;; ALPHAOP/ARG1/ARG2, ARGB constant, texture-present0/1, VS UV register
;; (16 means missing =>0,0,0,1), transform flags, coordinate index, RESULTARG1/5
;; (zero retains the original table ABI's implicit CURRENT).
;; The unchanged DFX descriptor supplies transforms, PSIZE and texture factor.
;; Raw CURRENT is a pre-stage r2 snapshot; RGB writes cannot affect that stage's
;; alpha inputs. c0=factor,c1=half,c2..7=stage constants; r3=zero specular,
;; r4=TEMP, r5=explicit CURRENT after the preceding PREMODULATE mask. A TEMP
;; destination is published only after both channel groups, restoring raw r2.
(func $d3d_fixed_cascade_arg (param $value i32) (param $stage i32) (param $bound i32) (result i32)
  (local $src i32) (local $base i32) (local $reg i32)
  (if (i32.and (i32.le_u (local.get $value) (i32.const 63)) (i32.eq (i32.and (local.get $value) (i32.const 15)) (i32.const 5))) (then
    (return (call $d3d_fixed_source (i32.const 0) (i32.const 4)
      (select (i32.const 255) (i32.const 228) (i32.and (local.get $value) (i32.const 32)))
      (select (i32.const 6) (i32.const 0) (i32.and (local.get $value) (i32.const 16)))))))
  (local.set $src (call $d3d_fixed_argument (local.get $value) (i32.shl (local.get $bound) (i32.const 3))))
  (if (i32.lt_s (local.get $src) (i32.const 0)) (then (return (local.get $src))))
  (local.set $base (i32.and (local.get $value) (i32.const 15)))
  (local.set $reg (i32.and (local.get $src) (i32.const 4095)))
  (if (i32.eq (local.get $base) (i32.const 1)) (then (local.set $reg (i32.const 80))))
  (if (i32.eq (local.get $base) (i32.const 2)) (then (local.set $reg (i32.or (i32.const 3) (i32.shl (local.get $stage) (i32.const 4))))))
  (if (i32.eq (local.get $base) (i32.const 4)) (then (local.set $reg (i32.const 48))))
  (if (i32.eq (local.get $base) (i32.const 6)) (then (local.set $reg (i32.or (i32.const 2) (i32.shl (i32.add (local.get $stage) (i32.const 2)) (i32.const 4))))))
  (i32.or (i32.and (local.get $src) (i32.const -4096)) (local.get $reg)))

(func $d3d_fixed_cascade_combine (param $ir i32) (param $mode i32) (param $a i32) (param $b i32) (param $mask i32) (param $stage i32) (param $c i32)
  (local $factor i32) (local $alpha i32)
  (if (i32.or (i32.eq (local.get $mode) (i32.const 22)) (i32.eq (local.get $mode) (i32.const 23))) (then
    (call $d3d_fixed_combine (local.get $ir) (i32.const 2)
      (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 228) (i32.const 0)) (i32.const 0) (local.get $mask) (i32.const 1)) (return)))
  (if (i32.eq (local.get $mode) (i32.const 17)) (then
    (call $d3d_fixed_combine (local.get $ir) (i32.const 2) (local.get $a) (local.get $b) (local.get $mask) (i32.const 1)) (return)))
  (if (i32.le_u (local.get $mode) (i32.const 11)) (then
    (call $d3d_fixed_combine (local.get $ir) (local.get $mode) (local.get $a) (local.get $b) (local.get $mask) (i32.const 1)) (return)))
  (if (i32.eq (local.get $mode) (i32.const 24)) (then
    ;; D3DTOP_DOTPRODUCT3 permits COLOROP and ALPHAOP independently.
    ;; Signed scaling: 2*x-1, after complement/alpha-replicate. Complement
    ;; becomes negative-bx2; the RGB swizzle remains intact even for ALPHAOP.
    ;; https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop
    ;; https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx9-graphics-reference-asm-ps-registers-modifiers-signed-scale
    (call $d3d_fixed_op (local.get $ir) (i32.const 8) (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (i32.or (i32.and (local.get $a) (i32.const 1048575))
        (select (i32.const 5242880) (i32.const 4194304) (i32.ne (i32.shr_u (local.get $a) (i32.const 20)) (i32.const 0))))
      (i32.or (i32.and (local.get $b) (i32.const 1048575))
        (select (i32.const 5242880) (i32.const 4194304) (i32.ne (i32.shr_u (local.get $b) (i32.const 20)) (i32.const 0))))
      (i32.const 0)) (return)))
  (if (i32.ge_u (local.get $mode) (i32.const 25)) (then
    ;; MULTIPLYADD = ARG0 + ARG1*ARG2; LERP = ARG0*ARG1+(1-ARG0)*ARG2.
    (call $d3d_fixed_op (local.get $ir) (select (i32.const 4) (i32.const 18) (i32.eq (local.get $mode) (i32.const 25)))
      (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (select (local.get $a) (local.get $c) (i32.eq (local.get $mode) (i32.const 25)))
      (select (local.get $b) (local.get $a) (i32.eq (local.get $mode) (i32.const 25)))
      (select (local.get $c) (local.get $b) (i32.eq (local.get $mode) (i32.const 25)))) (return)))
  (if (i32.ge_u (local.get $mode) (i32.const 18)) (then
    (local.set $alpha (i32.or (i32.and (local.get $a) (i32.const -1044481)) (i32.const 1044480)))
    (if (i32.eq (local.get $mode) (i32.const 20)) (then (local.set $alpha (i32.xor (local.get $alpha) (i32.const 6291456)))))
    (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (select (local.get $alpha) (select (i32.xor (local.get $a) (i32.const 6291456)) (local.get $a) (i32.eq (local.get $mode) (i32.const 21)))
        (i32.or (i32.eq (local.get $mode) (i32.const 18)) (i32.eq (local.get $mode) (i32.const 20))))
      (local.get $b) (select (local.get $a) (local.get $alpha)
        (i32.or (i32.eq (local.get $mode) (i32.const 18)) (i32.eq (local.get $mode) (i32.const 20))))) (return)))
  (local.set $factor (call $d3d_fixed_source
    (select (i32.const 1) (select (i32.const 0) (select (i32.const 2) (i32.const 3) (i32.eq (local.get $mode) (i32.const 14))) (i32.eq (local.get $mode) (i32.const 16))) (i32.eq (local.get $mode) (i32.const 12)))
    (select (i32.const 2) (select (i32.const 0) (local.get $stage) (i32.or (i32.eq (local.get $mode) (i32.const 12)) (i32.eq (local.get $mode) (i32.const 14)))) (i32.eq (local.get $mode) (i32.const 16)))
    (i32.const 255) (i32.const 0)))
  (if (i32.eq (local.get $mode) (i32.const 15))
    (then (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (i32.or (local.get $factor) (i32.const 6291456)) (local.get $b) (local.get $a)))
    (else (call $d3d_fixed_op (local.get $ir) (i32.const 18) (i32.const 0) (i32.const 0) (local.get $mask) (i32.const 1)
      (local.get $factor) (local.get $a) (local.get $b)))))

;; Original 48-byte rows retain implicit CURRENT ARG0. Version2 appends
;; COLORARG0/ALPHAARG0 at48/52, without changing the DFX or bundle ABI.
(func (export "d3d_fixed_compile_cascade") (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (result i32)
  (call $d3d_fixed_compile_cascade_table (local.get $desc) (local.get $table) (local.get $count) (local.get $stages) (local.get $uvmask) (i32.const 48)))
(func (export "d3d_fixed_compile_cascade2") (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (result i32)
  (call $d3d_fixed_compile_cascade_table (local.get $desc) (local.get $table) (local.get $count) (local.get $stages) (local.get $uvmask) (i32.const 56)))
;; Version3: 128-byte rows append input dimension+56, reserved0+60, matrix+64.
(func (export "d3d_fixed_compile_cascade3") (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (result i32)
  (call $d3d_fixed_compile_cascade_table (local.get $desc) (local.get $table) (local.get $count) (local.get $stages) (local.get $uvmask) (i32.const 128)))
;; Version4 preserves the128-byte prefix; +128 normal input register, +132
;; normalizeNormals bit0/localViewer bit1. Old exports retain their gates.
(func (export "d3d_fixed_compile_cascade4") (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (result i32)
  (call $d3d_fixed_compile_cascade_table (local.get $desc) (local.get $table) (local.get $count) (local.get $stages) (local.get $uvmask) (i32.const 136)))
(func $d3d_fixed_compile_cascade5 (export "d3d_fixed_compile_cascade5") (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (result i32)
  (call $d3d_fixed_compile_cascade_table (local.get $desc) (local.get $table) (local.get $count) (local.get $stages) (local.get $uvmask) (i32.const 160)))
(func $d3d_fixed_compile_cascade_table (param $desc i32) (param $table i32) (param $count i32) (param $stages i32) (param $uvmask i32) (param $stride i32) (result i32)
  (local $bundle i32) (local $vs i32) (local $ps i32) (local $i i32) (local $p i32)
  (local $color i32) (local $alpha i32) (local $ca i32) (local $cb i32) (local $aa i32) (local $ab i32)
  (local $cc i32) (local $ac i32) (local $arg0 i32)
  (local $premod i32)
  (local $normalreg i32) (local $normalflags i32) (local $normalready i32) (local $reflectionready i32) (local $cachedreg i32) (local $cachedflags i32)
  (local $bump i32) (local $previous_bump i32)
  (local $transform i32) (local $coords i32) (local $dimension i32) (local $j i32) (local $matrix i32) (local $source i32)
  (local $bound i32) (local $sampled i32) (local $mask i32) (local $reg i32) (local $result i32) (local $last i32)
  (local.set $last (i32.const 1))
  (if (i32.or (i32.lt_u (local.get $count) (i32.const 1)) (i32.or (i32.gt_u (local.get $count) (i32.const 6))
    (i32.or (i32.lt_u (local.get $stages) (i32.const 1)) (i32.or (i32.gt_u (local.get $stages) (i32.const 3)) (i32.gt_u (local.get $uvmask) (i32.const 63)))))) (then (return (i32.const 0))))
  (if (i32.eqz (call $d3d_shader_vm_range (local.get $table) (i32.mul (local.get $count) (local.get $stride)))) (then (return (i32.const 0))))
  (local.set $bundle (call $d3d_fixed_compile_stages (local.get $desc) (i32.and (local.get $stages) (i32.const 1)) (i32.const 0)))
  (if (i32.eqz (local.get $bundle)) (then (return (i32.const 0))))
  (block $failure
    (if (i32.and (local.get $stages) (i32.const 2)) (then
      (local.set $ps (call $d3d_fixed_ir (i32.const 1))) (i32.store offset=8 (local.get $bundle) (local.get $ps))
      (br_if $failure (i32.eqz (local.get $ps)))
      (call $d3d_fixed_argb (local.get $ps) (i32.const 0) (i32.load offset=48 (local.get $desc)))
      (call $d3d_fixed_def (local.get $ps) (i32.const 1) (f32.const 0.5) (f32.const 0.5) (f32.const 0.5) (f32.const 0.5))
      (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
      (call $d3d_fixed_op (local.get $ps) (i32.const 3) (i32.const 0) (i32.const 3) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 228) (i32.const 0))
        (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0))
      (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 4) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 0) (i32.const 3) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
      (block $terminated (loop $cascade
        (br_if $terminated (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $p (i32.add (local.get $table) (i32.mul (local.get $i) (local.get $stride))))
        (local.set $color (i32.load (local.get $p))) (local.set $alpha (i32.load offset=12 (local.get $p)))
        (local.set $bump (i32.or (i32.eq (local.get $color) (i32.const 22)) (i32.eq (local.get $color) (i32.const 23))))
        (local.set $bound (i32.load offset=28 (local.get $p)))
        (br_if $failure (i32.gt_u (local.get $bound) (i32.const 1)))
        (br_if $terminated (i32.or (i32.eq (local.get $color) (i32.const 1))
          (i32.and (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 2)) (i32.eqz (local.get $bound)))))
        (local.set $result (i32.load offset=44 (local.get $p)))
        (if (i32.eqz (local.get $result)) (then (local.set $result (i32.const 1))))
        (br_if $failure (i32.and (i32.ne (local.get $result) (i32.const 1)) (i32.ne (local.get $result) (i32.const 5))))
        (local.set $last (local.get $result))
        (br_if $failure (i32.or (i32.lt_u (local.get $color) (i32.const 2)) (i32.gt_u (local.get $color) (i32.const 26))))
        (br_if $failure (i32.or (i32.lt_u (local.get $alpha) (i32.const 1)) (i32.and (i32.gt_u (local.get $alpha) (i32.const 17))
          (i32.and (i32.ne (local.get $alpha) (i32.const 24))
            (i32.and (i32.ne (local.get $alpha) (i32.const 25)) (i32.ne (local.get $alpha) (i32.const 26)))))))
        (local.set $ca (i32.const 0)) (local.set $cb (i32.const 0)) (local.set $aa (i32.const 0)) (local.set $ab (i32.const 0))
        (local.set $cc (i32.const 0)) (local.set $ac (i32.const 0))
        (if (i32.ge_u (local.get $color) (i32.const 25)) (then
          (local.set $arg0 (i32.const 1))
          (if (i32.ge_u (local.get $stride) (i32.const 56)) (then (local.set $arg0 (i32.load offset=48 (local.get $p)))))
          (local.set $cc (call $d3d_fixed_cascade_arg (local.get $arg0) (local.get $i) (local.get $bound)))))
        (if (i32.ge_u (local.get $alpha) (i32.const 25)) (then
          (local.set $arg0 (i32.const 1))
          (if (i32.ge_u (local.get $stride) (i32.const 56)) (then (local.set $arg0 (i32.load offset=52 (local.get $p)))))
          (local.set $ac (call $d3d_fixed_cascade_arg (local.get $arg0) (local.get $i) (local.get $bound)))))
        (br_if $failure (i32.or (i32.lt_s (local.get $cc) (i32.const 0)) (i32.lt_s (local.get $ac) (i32.const 0))))
        (if (i32.and (i32.eqz (local.get $bump)) (i32.ne (local.get $color) (i32.const 3))) (then (local.set $ca (call $d3d_fixed_cascade_arg (i32.load offset=4 (local.get $p)) (local.get $i) (local.get $bound)))))
        (if (i32.and (i32.eqz (local.get $bump)) (i32.and (i32.ne (local.get $color) (i32.const 2)) (i32.ne (local.get $color) (i32.const 17)))) (then (local.set $cb (call $d3d_fixed_cascade_arg (i32.load offset=8 (local.get $p)) (local.get $i) (local.get $bound)))))
        (if (i32.eq (local.get $alpha) (i32.const 1))
          (then (local.set $aa (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 228) (i32.const 0))))
          (else
            (if (i32.ne (local.get $alpha) (i32.const 3)) (then (local.set $aa (call $d3d_fixed_cascade_arg (i32.load offset=16 (local.get $p)) (local.get $i) (local.get $bound)))))
            (if (i32.and (i32.ne (local.get $alpha) (i32.const 2)) (i32.ne (local.get $alpha) (i32.const 17))) (then (local.set $ab (call $d3d_fixed_cascade_arg (i32.load offset=20 (local.get $p)) (local.get $i) (local.get $bound)))))))
        (br_if $failure (i32.or (i32.lt_s (local.get $ca) (i32.const 0)) (i32.or (i32.lt_s (local.get $cb) (i32.const 0))
          (i32.or (i32.lt_s (local.get $aa) (i32.const 0)) (i32.lt_s (local.get $ab) (i32.const 0))))))
        (call $d3d_fixed_argb (local.get $ps) (i32.add (local.get $i) (i32.const 2)) (i32.load offset=24 (local.get $p)))
        (local.set $sampled (i32.or (i32.eq (i32.and (local.get $ca) (i32.const 15)) (i32.const 3))
          (i32.or (i32.eq (i32.and (local.get $cb) (i32.const 15)) (i32.const 3))
          (i32.or (i32.eq (i32.and (local.get $aa) (i32.const 15)) (i32.const 3)) (i32.eq (i32.and (local.get $ab) (i32.const 15)) (i32.const 3))))))
        (local.set $sampled (i32.or (local.get $sampled) (i32.or (i32.or (i32.eq (local.get $color) (i32.const 13)) (i32.eq (local.get $color) (i32.const 15)))
          (i32.or (i32.eq (local.get $alpha) (i32.const 13)) (i32.eq (local.get $alpha) (i32.const 15))))))
        (local.set $sampled (i32.or (local.get $sampled) (i32.or
          (i32.eq (i32.and (local.get $cc) (i32.const 15)) (i32.const 3)) (i32.eq (i32.and (local.get $ac) (i32.const 15)) (i32.const 3)))))
        (if (i32.eqz (local.get $bound)) (then (local.set $premod (i32.const 0))))
        (local.set $sampled (i32.or (local.get $sampled) (i32.ne (local.get $premod) (i32.const 0))))
        (local.set $sampled (i32.or (local.get $sampled) (local.get $bump)))
        (br_if $failure (i32.and (i32.ne (local.get $sampled) (i32.const 0)) (i32.eqz (local.get $bound))))
        (if (local.get $sampled) (then
          (local.set $mask (i32.or (local.get $mask) (i32.shl (i32.const 1) (local.get $i))))
          (call $d3d_fixed_op (local.get $ps)
            (select (i32.add (local.get $previous_bump) (i32.const 45)) (i32.const 66) (local.get $previous_bump))
            (i32.const 3) (local.get $i) (i32.const 15) (i32.const 0)
            (call $d3d_fixed_source (i32.const 3) (i32.sub (local.get $i) (i32.const 1)) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))))
        (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 2) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
        ;; r2 remains raw CURRENT for implicit alpha/factors and TEMP restore.
        ;; Explicit CURRENT arguments read r5, premultiplied only for this stage
        ;; before their complement/alpha-replicate modifiers are evaluated.
        (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 5) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
        (if (local.get $premod) (then
          (call $d3d_fixed_op (local.get $ps) (i32.const 5) (i32.const 0) (i32.const 5) (local.get $premod) (i32.const 0)
            (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 228) (i32.const 0))
            (call $d3d_fixed_source (i32.const 3) (local.get $i) (i32.const 228) (i32.const 0)) (i32.const 0))))
        (call $d3d_fixed_cascade_combine (local.get $ps) (local.get $color) (local.get $ca) (local.get $cb) (i32.const 7) (local.get $i) (local.get $cc))
        (call $d3d_fixed_cascade_combine (local.get $ps) (select (i32.const 2) (local.get $alpha) (i32.eq (local.get $alpha) (i32.const 1))) (local.get $aa) (local.get $ab) (i32.const 8) (local.get $i) (local.get $ac))
        (if (i32.eq (local.get $result) (i32.const 5)) (then
          (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 4) (i32.const 15) (i32.const 0)
            (call $d3d_fixed_source (i32.const 0) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
          (call $d3d_fixed_op (local.get $ps) (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 15) (i32.const 0)
            (call $d3d_fixed_source (i32.const 0) (i32.const 2) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))))
        (local.set $premod (i32.or
          (select (i32.const 7) (i32.const 0) (i32.eq (local.get $color) (i32.const 17)))
          (select (i32.const 8) (i32.const 0) (i32.eq (local.get $alpha) (i32.const 17)))))
        (local.set $previous_bump (select (local.get $color) (i32.const 0) (local.get $bump)))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $cascade)))
      (br_if $failure (i32.ne (local.get $last) (i32.const 1)))
      (i32.store offset=16 (local.get $bundle) (call $d3d_fixed_packet (local.get $ps)))
      (br_if $failure (i32.eqz (i32.load offset=16 (local.get $bundle))))
      (i32.store offset=20 (local.get $bundle) (local.get $mask))
      (local.set $uvmask (local.get $mask))))
    (if (i32.and (local.get $stages) (i32.const 1)) (then
      (local.set $vs (i32.load offset=4 (local.get $bundle)))
      (call $d3d_fixed_def (local.get $vs) (i32.const 15) (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 1))
      (local.set $i (i32.const 0))
      (loop $coordinates
        (if (i32.and (local.get $uvmask) (i32.shl (i32.const 1) (local.get $i))) (then
          (br_if $failure (i32.ge_u (local.get $i) (local.get $count)))
          (local.set $p (i32.add (local.get $table) (i32.mul (local.get $i) (local.get $stride))))
          (local.set $reg (i32.load offset=32 (local.get $p)))
          (local.set $transform (i32.load offset=36 (local.get $p)))
          (local.set $coords (i32.load offset=40 (local.get $p)))
          (br_if $failure (i32.gt_u (local.get $reg) (i32.const 16)))
          (if (i32.ge_u (local.get $stride) (i32.const 128)) (then
            (local.set $dimension (i32.load offset=56 (local.get $p)))
            (br_if $failure (i32.or (i32.gt_u (local.get $dimension) (i32.const 4)) (i32.ne (i32.load offset=60 (local.get $p)) (i32.const 0))))
            (br_if $failure (i32.or (i32.gt_u (i32.and (local.get $coords) (i32.const 65535)) (i32.const 5))
              (i32.and (i32.ne (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 0))
                (i32.and (i32.ne (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 2))
                  (i32.or (i32.lt_u (local.get $stride) (i32.const 136)) (i32.gt_u (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 3)))))))
            (br_if $failure (i32.and (i32.ne (local.get $transform) (i32.const 0))
              (i32.and (i32.ne (local.get $transform) (i32.const 2)) (i32.and (i32.ne (local.get $transform) (i32.const 3))
                (i32.and (i32.ne (local.get $transform) (i32.const 4)) (i32.and (i32.ne (local.get $transform) (i32.const 259)) (i32.ne (local.get $transform) (i32.const 260))))))))
          ) (else
            (br_if $failure (i32.or (i32.ne (local.get $transform) (i32.const 0)) (i32.gt_u (local.get $coords) (i32.const 5))))))
          (local.set $source (call $d3d_fixed_source (select (i32.const 2) (i32.const 1) (i32.eq (local.get $reg) (i32.const 16)))
            (select (i32.const 15) (local.get $reg) (i32.eq (local.get $reg) (i32.const 16))) (i32.const 228) (i32.const 0)))
          (if (i32.eq (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 2)) (then
            (br_if $failure (i32.ne (i32.and (i32.load offset=8 (local.get $desc)) (i32.const 1)) (i32.const 0)))
            ;; Camera coordinates are world then view, independent of oPts scratch.
            (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 6) (i32.const 15) (i32.const 0)
              (call $d3d_fixed_source (i32.const 1) (i32.load offset=12 (local.get $desc)) (i32.const 228) (i32.const 0))
              (call $d3d_fixed_source (i32.const 2) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0))
            (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 7) (i32.const 15) (i32.const 0)
              (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 228) (i32.const 0))
              (call $d3d_fixed_source (i32.const 2) (i32.const 4) (i32.const 228) (i32.const 0)) (i32.const 0))
            (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 7) (i32.const 8) (i32.const 0)
              (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 255) (i32.const 0)) (i32.const 0) (i32.const 0))
            (local.set $source (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 228) (i32.const 0)))))
          (if (i32.or (i32.eq (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 1)) (i32.eq (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 3))) (then
            (br_if $failure (i32.ne (i32.and (i32.load offset=8 (local.get $desc)) (i32.const 1)) (i32.const 0)))
            (local.set $normalreg (i32.load offset=128 (local.get $p))) (local.set $normalflags (i32.load offset=132 (local.get $p)))
            (br_if $failure (i32.or (i32.gt_u (local.get $normalreg) (i32.const 15)) (i32.gt_u (local.get $normalflags) (i32.const 3))))
            (if (local.get $normalready) (then
              (br_if $failure (i32.or (i32.ne (local.get $normalreg) (local.get $cachedreg)) (i32.ne (local.get $normalflags) (local.get $cachedflags)))))
            (else
              (br_if $failure (i32.eqz (call $d3d_fixed_normal_matrix (local.get $desc) (local.get $vs))))
              (call $d3d_fixed_def (local.get $vs) (i32.const 43) (f32.const 0) (f32.const 0) (f32.const 1) (f32.const 3.4028234663852886e38))
    (call $d3d_fixed_op (local.get $vs) (i32.const 23) (i32.const 0) (i32.const 8) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 1) (local.get $normalreg) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 40) (i32.const 228) (i32.const 0)) (i32.const 0))
              (if (i32.and (local.get $normalflags) (i32.const 1)) (then (call $d3d_fixed_normalize (local.get $vs) (i32.const 8))))
    (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 8) (i32.const 8) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 255) (i32.const 0)) (i32.const 0) (i32.const 0))
              (local.set $normalready (i32.const 1)) (local.set $cachedreg (local.get $normalreg)) (local.set $cachedflags (local.get $normalflags))))
            (local.set $source (call $d3d_fixed_source (i32.const 0) (i32.const 8) (i32.const 228) (i32.const 0)))
            (if (i32.eq (i32.shr_u (local.get $coords) (i32.const 16)) (i32.const 3)) (then
              (if (i32.eqz (local.get $reflectionready)) (then
                (if (i32.and (local.get $normalflags) (i32.const 2)) (then
    (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 6) (i32.const 15) (i32.const 0) (call $d3d_fixed_source (i32.const 1) (i32.load offset=12 (local.get $desc)) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 0) (i32.const 228) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 9) (i32.const 15) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 2) (i32.const 4) (i32.const 228) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 9) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 9) (i32.const 228) (i32.const 1)) (i32.const 0) (i32.const 0))
                  (call $d3d_fixed_normalize (local.get $vs) (i32.const 9)))
                (else
    (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 9) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 43) (i32.const 228) (i32.const 0)) (i32.const 0) (i32.const 0))
                ))
    (call $d3d_fixed_op (local.get $vs) (i32.const 8) (i32.const 0) (i32.const 10) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 9) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 8) (i32.const 228) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $vs) (i32.const 2) (i32.const 0) (i32.const 10) (i32.const 1) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 0) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $vs) (i32.const 5) (i32.const 0) (i32.const 11) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 10) (i32.const 0) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 8) (i32.const 228) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $vs) (i32.const 3) (i32.const 0) (i32.const 9) (i32.const 7) (i32.const 0) (call $d3d_fixed_source (i32.const 0) (i32.const 11) (i32.const 228) (i32.const 0)) (call $d3d_fixed_source (i32.const 0) (i32.const 9) (i32.const 228) (i32.const 0)) (i32.const 0))
    (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 9) (i32.const 8) (i32.const 0) (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 255) (i32.const 0)) (i32.const 0) (i32.const 0))
                (local.set $reflectionready (i32.const 1))))
              (local.set $source (call $d3d_fixed_source (i32.const 0) (i32.const 9) (i32.const 228) (i32.const 0)))))
          ))
          (if (i32.and (i32.ne (local.get $transform) (i32.const 0)) (i32.eqz (i32.and (i32.load offset=8 (local.get $desc)) (i32.const 1)))) (then
            (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 6) (i32.const 15) (i32.const 0) (local.get $source) (i32.const 0) (i32.const 0))
            ;; Microsoft FLOAT2 _31/_32 translation example requires z=1.
            ;; Retain existing w=1 padding; fourth-row behavior awaits reference.
            (if (i32.and (i32.eq (local.get $dimension) (i32.const 2)) (i32.eqz (i32.shr_u (local.get $coords) (i32.const 16)))) (then
              (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 0) (i32.const 6) (i32.const 4) (i32.const 0)
                (call $d3d_fixed_source (i32.const 2) (i32.const 15) (i32.const 255) (i32.const 0)) (i32.const 0) (i32.const 0))))
            (local.set $j (i32.const 0))
            (loop $texture_rows
              (local.set $matrix (i32.add (i32.add (local.get $p) (i32.const 64)) (i32.shl (local.get $j) (i32.const 2))))
              (br_if $failure (i32.or (i32.or
                (i32.eq (i32.and (i32.load (local.get $matrix)) (i32.const 0x7f800000)) (i32.const 0x7f800000))
                (i32.eq (i32.and (i32.load offset=16 (local.get $matrix)) (i32.const 0x7f800000)) (i32.const 0x7f800000)))
                (i32.or (i32.eq (i32.and (i32.load offset=32 (local.get $matrix)) (i32.const 0x7f800000)) (i32.const 0x7f800000))
                  (i32.eq (i32.and (i32.load offset=48 (local.get $matrix)) (i32.const 0x7f800000)) (i32.const 0x7f800000)))))
              (call $d3d_fixed_def (local.get $vs) (i32.add (i32.const 16) (i32.add (i32.shl (local.get $i) (i32.const 2)) (local.get $j)))
                (f32.load (local.get $matrix)) (f32.load offset=16 (local.get $matrix)) (f32.load offset=32 (local.get $matrix)) (f32.load offset=48 (local.get $matrix)))
              (local.set $j (i32.add (local.get $j) (i32.const 1))) (br_if $texture_rows (i32.lt_u (local.get $j) (i32.const 4))))
            (call $d3d_fixed_op (local.get $vs) (i32.const 20) (i32.const 0) (i32.const 7) (i32.const 15) (i32.const 0)
              (call $d3d_fixed_source (i32.const 0) (i32.const 6) (i32.const 228) (i32.const 0))
              (call $d3d_fixed_source (i32.const 2) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2))) (i32.const 228) (i32.const 0)) (i32.const 0))
            (local.set $source (call $d3d_fixed_source (i32.const 0) (i32.const 7) (i32.const 228) (i32.const 0)))))
          (call $d3d_fixed_op (local.get $vs) (i32.const 1) (i32.const 6) (local.get $i) (i32.const 15) (i32.const 0)
            (local.get $source) (i32.const 0) (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br_if $coordinates (i32.lt_u (local.get $i) (i32.const 6))))
      (if (i32.eq (local.get $stride) (i32.const 160)) (then
        (br_if $failure (i32.eqz (call $d3d_fixed_fog (local.get $desc) (local.get $table) (local.get $vs))))))
      (call $d3d_shader_vm_free (i32.load offset=12 (local.get $bundle)))
      (i32.store offset=12 (local.get $bundle) (call $d3d_fixed_packet (local.get $vs)))
      (br_if $failure (i32.eqz (i32.load offset=12 (local.get $bundle))))))
    (return (local.get $bundle)))
  (call $d3d_fixed_free (local.get $bundle)) (i32.const 0))
