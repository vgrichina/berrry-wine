  ;; ============================================================
  ;; GL texel conversion, pixel transfer and pack: GPU stream v2 slice G2.
  ;; ============================================================
  ;; The executor contract (docs/gpu-stream-v2-migration.md section 0,
  ;; "Formats") accepts only A8B8G8R8 colour, so WAT finishes every GL texel
  ;; before it leaves: unpack (09a8b $gl_2d_upload / $handle_gl_tex1d_upload,
  ;; which already produced the canonical f32/RGBA8/index cells), then the
  ;; execution-time pixel transfer (scale, bias, MAP_COLOR, index shift/offset
  ;; and I_TO_* maps), then the base internal format (GL 1.1 table 3.15). The
  ;; old transport receives only those finished RGBA8 rows; lib/gl-compat.js
  ;; no longer converts anything. glReadPixels runs the other way: the
  ;; executor writes tight RGBA8, and WAT applies pixel transfer and PACK.
  ;;
  ;; The first section is PURE (wasm addresses in, no globals, no calls out),
  ;; so test/test-gl-texel-wat.js compiles it alone and replays a fixture
  ;; generated from the JS converters it replaced, bit for bit. Rounding is
  ;; therefore JavaScript's Math.round (ties toward +inf), not f64.nearest.
  ;;
  ;; Transfer state $t is the 64-byte GL_PIXEL_MODE block (09a8b
  ;; $gl_transfer_state): i32 MAP_COLOR @0, MAP_STENCIL @4, INDEX_SHIFT @8,
  ;; INDEX_OFFSET @12, then f32 RED_SCALE/BIAS @16/20, GREEN @32/36,
  ;; BLUE @40/44, ALPHA @48/52. Maps $maps is $gl_pixel_maps: i32 sizes[10]
  ;; then f64 values[10][256] at +40.
  ;;
  ;; Base internal formats: 1 LUMINANCE, 2 LUMINANCE_ALPHA, 3 RGB, 4 RGBA,
  ;; 5 ALPHA, 6 INTENSITY. Pixels in this file are ARGB u32 (B in the low
  ;; byte), the layout of the CPU texture surfaces.

  ;; ---------------- @pure-begin ----------------

  ;; Math.round: nearest, ties toward +infinity. NaN stays NaN.
  (func $gl_g2_round (param $x f64) (result f64)
    (local $f f64)
    (local.set $f (f64.floor (local.get $x)))
    (select (f64.add (local.get $f) (f64.const 1)) (local.get $f)
      (f64.ge (f64.sub (local.get $x) (local.get $f)) (f64.const 0.5))))

  ;; Math.max(0, Math.min(1, x)); NaN propagates.
  (func $gl_g2_clamp (param $x f64) (result f64)
    (f64.max (f64.const 0) (f64.min (f64.const 1) (local.get $x))))

  ;; Normalized [0,1] -> byte; NaN -> 0.
  (func $gl_g2_byte (param $x f64) (result i32)
    (i32.trunc_sat_f64_u (call $gl_g2_round (f64.mul (call $gl_g2_clamp (local.get $x)) (f64.const 255)))))

  (func $gl_g2_base (param $fmt i32) (result i32)
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 1))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x1909))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x803f)) (i32.const 3)))) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 2))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x190a))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x8043)) (i32.const 5)))) (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 3))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x1907))
        (i32.or (i32.eq (local.get $fmt) (i32.const 0x2a10))
          (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x804f)) (i32.const 5))))) (then (return (i32.const 3))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 4))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x1908))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x8055)) (i32.const 6)))) (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 0x1906))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x803b)) (i32.const 3))) (then (return (i32.const 5))))
    (i32.const 6)) ;; INTENSITY

  ;; Stored texel for a base internal format: LUMINANCE replicates R and is
  ;; opaque, LUMINANCE_ALPHA keeps A, INTENSITY copies R into A, ALPHA zeroes
  ;; RGB, RGB is opaque.
  (func $gl_g2_select (param $px i32) (param $internal i32) (result i32)
    (local $base i32) (local $r i32)
    (local.set $base (call $gl_g2_base (local.get $internal)))
    (local.set $r (i32.and (i32.shr_u (local.get $px) (i32.const 16)) (i32.const 255)))
    (if (i32.eq (local.get $base) (i32.const 3)) (then (return (i32.or (local.get $px) (i32.const 0xff000000)))))
    (if (i32.eq (local.get $base) (i32.const 4)) (then (return (local.get $px))))
    (if (i32.eq (local.get $base) (i32.const 5)) (then (return (i32.and (local.get $px) (i32.const 0xff000000)))))
    (i32.or (i32.mul (local.get $r) (i32.const 0x10101))
      (if (result i32) (i32.eq (local.get $base) (i32.const 1)) (then (i32.const 0xff000000))
        (else (if (result i32) (i32.eq (local.get $base) (i32.const 2))
          (then (i32.and (local.get $px) (i32.const 0xff000000)))
          (else (i32.shl (local.get $r) (i32.const 24))))))))

  ;; One colour component through scale/bias and, with MAP_COLOR, the
  ;; R_TO_R..A_TO_A map (index Math.round(clamp(v) * (size-1))), to a byte.
  (func $gl_g2_channel (param $v f64) (param $c i32) (param $t i32) (param $maps i32) (result i32)
    (local $off i32) (local $map i32) (local $x f64)
    (local.set $off (select (i32.const 16)
      (i32.add (i32.const 24) (i32.shl (local.get $c) (i32.const 3)))
      (i32.eqz (local.get $c))))
    (local.set $v (f64.add (f64.mul (local.get $v)
      (f64.promote_f32 (f32.load (i32.add (local.get $t) (local.get $off)))))
      (f64.promote_f32 (f32.load offset=4 (i32.add (local.get $t) (local.get $off))))))
    (if (i32.load (local.get $t)) (then
      (local.set $map (i32.add (local.get $c) (i32.const 6)))
      (local.set $x (call $gl_g2_round (f64.mul (call $gl_g2_clamp (local.get $v))
        (f64.convert_i32_u (i32.sub (i32.load (i32.add (local.get $maps) (i32.shl (local.get $map) (i32.const 2))))
          (i32.const 1))))))
      ;; JS indexed the map with NaN: undefined, which converts to 0.
      (if (f64.ne (local.get $x) (local.get $x)) (then (return (i32.const 0))))
      (local.set $v (f64.load (i32.add (local.get $maps) (i32.add (i32.const 40)
        (i32.add (i32.shl (local.get $map) (i32.const 11))
          (i32.shl (i32.trunc_sat_f64_u (local.get $x)) (i32.const 3)))))))))
    (call $gl_g2_byte (local.get $v)))

  ;; Colour index -> RGBA through INDEX_SHIFT (8 fractional bits, 40-bit
  ;; zero-fill), INDEX_OFFSET and the I_TO_R..I_TO_A maps.
  (func $gl_g2_index_rgba (param $value f64) (param $t i32) (param $maps i32) (result i32)
    (local $shift i32) (local $bits i64) (local $index i32) (local $i i32)
    (local $map i32) (local $out i32)
    (if (f64.eq (f64.sub (local.get $value) (local.get $value)) (f64.const 0))
      (then (local.set $bits (i64.and (i64.trunc_sat_f64_s (f64.mul (local.get $value) (f64.const 256)))
        (i64.const 0xffffffffff)))))
    (local.set $shift (i32.load offset=8 (local.get $t)))
    (if (i32.ge_s (local.get $shift) (i32.const 0))
      (then (local.set $bits (if (result i64) (i32.ge_u (local.get $shift) (i32.const 40)) (then (i64.const 0))
        (else (i64.and (i64.shl (local.get $bits) (i64.extend_i32_u (local.get $shift))) (i64.const 0xffffffffff))))))
      (else (local.set $bits (if (result i64) (i32.le_s (local.get $shift) (i32.const -40)) (then (i64.const 0))
        (else (i64.shr_u (local.get $bits) (i64.extend_i32_u (i32.sub (i32.const 0) (local.get $shift)))))))))
    (local.set $index (i32.wrap_i64 (i64.trunc_sat_f64_s (call $gl_g2_round (f64.add
      (f64.div (f64.convert_i64_u (local.get $bits)) (f64.const 256))
      (f64.convert_i32_s (i32.load offset=12 (local.get $t))))))))
    (loop $channels
      (local.set $map (i32.add (local.get $i) (i32.const 2)))
      (local.set $out (i32.or (local.get $out) (i32.shl
        (i32.trunc_sat_f64_u (call $gl_g2_round (f64.mul (f64.const 255)
          (f64.load (i32.add (local.get $maps) (i32.add (i32.const 40)
            (i32.add (i32.shl (local.get $map) (i32.const 11))
              (i32.shl (i32.and (local.get $index)
                (i32.sub (i32.load (i32.add (local.get $maps) (i32.shl (local.get $map) (i32.const 2)))) (i32.const 1)))
                (i32.const 3)))))))))
        (select (i32.const 24) (i32.sub (i32.const 16) (i32.shl (local.get $i) (i32.const 3)))
          (i32.eq (local.get $i) (i32.const 3))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $channels (i32.lt_u (local.get $i) (i32.const 4))))
    (local.get $out))

  ;; One canonical cell -> finished ARGB texel. $kind 0: four f32 RGBA;
  ;; 1: four bytes RGBA; 2: f64 colour index. $internal 4 (RGBA) skips the
  ;; base-format step, which is what glReadPixels wants.
  (func $gl_g2_texel (param $p i32) (param $kind i32) (param $internal i32)
      (param $t i32) (param $maps i32) (result i32)
    (local $i i32) (local $out i32) (local $v f64)
    (if (i32.eq (local.get $kind) (i32.const 2)) (then
      (return (call $gl_g2_select (call $gl_g2_index_rgba (f64.load (local.get $p)) (local.get $t) (local.get $maps))
        (local.get $internal)))))
    (loop $channels
      (local.set $v (if (result f64) (local.get $kind)
        (then (f64.div (f64.convert_i32_u (i32.load8_u (i32.add (local.get $p) (local.get $i)))) (f64.const 255)))
        (else (f64.promote_f32 (f32.load (i32.add (local.get $p) (i32.shl (local.get $i) (i32.const 2))))))))
      (local.set $out (i32.or (local.get $out) (i32.shl
        (call $gl_g2_channel (local.get $v) (local.get $i) (local.get $t) (local.get $maps))
        (select (i32.const 24) (i32.sub (i32.const 16) (i32.shl (local.get $i) (i32.const 3)))
          (i32.eq (local.get $i) (i32.const 3))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $channels (i32.lt_u (local.get $i) (i32.const 4))))
    (call $gl_g2_select (local.get $out) (local.get $internal)))

  ;; One packed byte component -> the integer/float bits glReadPixels and
  ;; glGetTexImage store for $type (GL 1.1 table 4.7; signed uses (c*(2^k-1)-1)/2,
  ;; both rounded to nearest-even, float is f32(byte/255)).
  (func $gl_g2_pack_value (param $value i32) (param $type i32) (result i32)
    (local $n i32) (local $scaled f64)
    (if (i32.eq (local.get $type) (i32.const 0x1406))
      (then (return (i32.reinterpret_f32 (f32.demote_f64
        (f64.div (f64.convert_i32_u (local.get $value)) (f64.const 255)))))))
    (local.set $n (select (i32.const 1) (select (i32.const 2) (i32.const 4)
      (i32.le_u (i32.sub (local.get $type) (i32.const 0x1402)) (i32.const 1)))
      (i32.le_u (local.get $type) (i32.const 0x1401))))
    (local.set $scaled (f64.mul
      (f64.div (f64.convert_i32_u (local.get $value)) (f64.const 255))
      (f64.sub (f64.convert_i64_u (i64.shl (i64.const 1)
        (i64.extend_i32_u (i32.shl (local.get $n) (i32.const 3))))) (f64.const 1))))
    (if (result i32) (i32.and (local.get $type) (i32.const 1))
      (then (i32.trunc_sat_f64_u (f64.nearest (local.get $scaled))))
      (else (i32.trunc_sat_f64_s (f64.nearest
        (f64.mul (f64.sub (local.get $scaled) (f64.const 1)) (f64.const 0.5)))))))

  ;; ---------------- @pure-end ----------------

  ;; A canonical cell at guest $p (as $gl_2d_upload / copy / list storage
  ;; left it) -> ARGB after transfer, before the base format.
  (func $gl_g2_canonical (param $p i32) (param $type i32) (param $format i32) (result i32)
    (call $gl_g2_texel (call $g2w (local.get $p))
      (if (result i32) (i32.eq (local.get $format) (i32.const 0x1900)) (then (i32.const 2))
        (else (i32.eq (local.get $type) (i32.const 0x1401))))
      (i32.const 4) (call $gl_transfer_state) (call $gl_pixel_maps)))

  ;; Finish $n canonical cells from guest $src into tight RGBA8 at wasm $out.
  (func $gl_g2_finish_cells (param $src i32) (param $n i32) (param $type i32) (param $format i32)
      (param $internal i32) (param $out i32)
    (local $i i32) (local $step i32)
    (if (i32.eqz (local.get $n)) (then (return)))
    (local.set $step (select (i32.const 4) (i32.const 16)
      (i32.and (i32.eq (local.get $type) (i32.const 0x1401)) (i32.ne (local.get $format) (i32.const 0x1900)))))
    (loop $cells
      (i32.store (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2)))
        (call $gl_rgba8_swap_rb (call $gl_g2_select
          (call $gl_g2_canonical (local.get $src) (local.get $type) (local.get $format)) (local.get $internal))))
      (local.set $src (i32.add (local.get $src) (local.get $step)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cells (i32.lt_u (local.get $i) (local.get $n)))))

  ;; Called by $gl_wat_encode_call_locked just before a record is emitted.
  ;; For the texture uploads (149/150 1D, 158/159 2D canonical), the GLU
  ;; mipmap builders (61/98) and glReadPixels (17), returns a guest scratch
  ;; block whose first 64 bytes replace the call's stack: finished RGBA8 /
  ;; UNSIGNED_BYTE, tight, at +64. 0 = emit the call unchanged. The caller
  ;; hands the block back to $gl_g2_emit_done after the flush.
  (func $gl_g2_emit_prepare (param $op i32) (param $stack i32) (result i32)
    (local $w i32) (local $h i32) (local $g i32) (local $s i32) (local $bytes i32)
    (local $internal i32) (local $record i32) (local $fmt_at i32) (local $type_at i32)
    (local $ptr_at i32) (local $sub i32) (local $ctx i32)
    (block $known
      (if (i32.eq (local.get $op) (i32.const 17)) (then
        (local.set $w (i32.load offset=12 (local.get $stack))) (local.set $h (i32.load offset=16 (local.get $stack)))
        (local.set $fmt_at (i32.const 20)) (local.set $type_at (i32.const 24)) (local.set $ptr_at (i32.const 28))
        (br $known)))
      (if (i32.le_u (i32.sub (local.get $op) (i32.const 158)) (i32.const 1)) (then
        (local.set $sub (i32.eq (local.get $op) (i32.const 159)))
        (local.set $w (i32.load (i32.add (local.get $stack) (select (i32.const 20) (i32.const 16) (local.get $sub)))))
        (local.set $h (i32.load (i32.add (local.get $stack) (select (i32.const 24) (i32.const 20) (local.get $sub)))))
        (local.set $fmt_at (i32.const 28)) (local.set $type_at (i32.const 32)) (local.set $ptr_at (i32.const 36))
        (br $known)))
      (if (i32.le_u (i32.sub (local.get $op) (i32.const 149)) (i32.const 1)) (then
        (local.set $sub (i32.eq (local.get $op) (i32.const 150)))
        (local.set $w (i32.load offset=16 (local.get $stack))) (local.set $h (i32.const 1))
        (local.set $fmt_at (select (i32.const 20) (i32.const 24) (local.get $sub)))
        (local.set $type_at (i32.add (local.get $fmt_at) (i32.const 4)))
        (local.set $ptr_at (i32.add (local.get $fmt_at) (i32.const 8)))
        (br $known)))
      (if (i32.eq (local.get $op) (i32.const 61)) (then
        (local.set $w (i32.load offset=12 (local.get $stack))) (local.set $h (i32.load offset=16 (local.get $stack)))
        (local.set $fmt_at (i32.const 20)) (local.set $type_at (i32.const 24)) (local.set $ptr_at (i32.const 28))
        (br $known)))
      (if (i32.eq (local.get $op) (i32.const 98)) (then
        (local.set $w (i32.load offset=12 (local.get $stack))) (local.set $h (i32.const 1))
        (local.set $fmt_at (i32.const 16)) (local.set $type_at (i32.const 20)) (local.set $ptr_at (i32.const 24))
        (br $known)))
      (return (i32.const 0)))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (if (i32.or (i32.gt_u (local.get $w) (i32.const 0x1000)) (i32.gt_u (local.get $h) (i32.const 0x1000)))
      (then (if (i32.ne (local.get $op) (i32.const 17)) (then (unreachable)))))
    (local.set $bytes (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2)))
    ;; +8 bytes per row of slack: the record's extent may be computed with
    ;; the guest's UNPACK_ALIGNMENT even though the rows are tight.
    (local.set $g (call $gl_alloc_affine (i32.add (i32.add (i32.const 64) (local.get $bytes))
      (i32.shl (local.get $h) (i32.const 3)))))
    (if (i32.eqz (local.get $g)) (then (unreachable)))
    (local.set $s (call $g2w (local.get $g)))
    (memory.fill (local.get $s) (i32.const 0) (i32.add (i32.add (i32.const 64) (local.get $bytes))
      (i32.shl (local.get $h) (i32.const 3))))
    (memory.copy (local.get $s) (local.get $stack) (i32.const 40))
    (i32.store (i32.add (local.get $s) (local.get $fmt_at)) (i32.const 0x1908))
    (i32.store (i32.add (local.get $s) (local.get $type_at)) (i32.const 0x1401))
    (i32.store (i32.add (local.get $s) (local.get $ptr_at)) (i32.add (local.get $g) (i32.const 64)))
    (if (i32.eq (local.get $op) (i32.const 17)) (then (return (local.get $g))))
    ;; NULL data: zero texels (no transfer), stored in the level's base format.
    (if (i32.eqz (i32.load (i32.add (local.get $stack) (local.get $ptr_at)))) (then
      (local.set $internal (call $gl_g2_null_internal (local.get $op) (local.get $stack) (local.get $sub)))
      (local.set $record (call $gl_rgba8_swap_rb (call $gl_g2_select (i32.const 0) (local.get $internal))))
      (local.set $internal (i32.const 0))
      (block $filled (loop $fill
        (br_if $filled (i32.ge_u (local.get $internal) (local.get $bytes)))
        (i32.store (i32.add (i32.add (local.get $s) (i32.const 64)) (local.get $internal)) (local.get $record))
        (local.set $internal (i32.add (local.get $internal) (i32.const 4)))
        (br $fill)))
      (return (local.get $g))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 61)) (i32.eq (local.get $op) (i32.const 98))) (then
      (call $gl_g2_unpack_image (local.get $ctx) (local.get $stack) (local.get $w) (local.get $h)
        (i32.load (i32.add (local.get $stack) (local.get $fmt_at)))
        (i32.load (i32.add (local.get $stack) (local.get $type_at)))
        (i32.load (i32.add (local.get $stack) (local.get $ptr_at)))
        (i32.load offset=8 (local.get $stack))
        (i32.add (local.get $s) (i32.const 64)))
      (return (local.get $g))))
    ;; Uploads: the level's base internal format decides the stored texel.
    (local.set $internal (call $gl_g2_null_internal (local.get $op) (local.get $stack) (local.get $sub)))
    (call $gl_g2_finish_cells (i32.load (i32.add (local.get $stack) (local.get $ptr_at)))
      (i32.mul (local.get $w) (local.get $h))
      (i32.load (i32.add (local.get $stack) (local.get $type_at)))
      (i32.load (i32.add (local.get $stack) (local.get $fmt_at)))
      (local.get $internal) (i32.add (local.get $s) (i32.const 64)))
    (local.get $g))

  ;; The internal format whose base format a record's texels are stored in:
  ;; GLU's components argument, the call's own, or for a sub-image the
  ;; existing level's (which $gl_2d_store / $gl_1d_store just validated).
  (func $gl_g2_null_internal (param $op i32) (param $stack i32) (param $sub i32) (result i32)
    (local $record i32)
    (if (i32.or (i32.eq (local.get $op) (i32.const 61)) (i32.eq (local.get $op) (i32.const 98)))
      (then (return (i32.load offset=8 (local.get $stack)))))
    (if (i32.eqz (local.get $sub)) (then (return (i32.load offset=12 (local.get $stack)))))
    (local.set $record (call $gl_texture_image_level (i32.load offset=4 (local.get $stack))
      (i32.load offset=8 (local.get $stack)) (i32.const 0)))
    (if (i32.eqz (local.get $record)) (then (unreachable)))
    (i32.load offset=12 (local.get $record)))

  ;; GLU source image under the guest's UNPACK state -> finished RGBA8
  ;; (transfer and the requested components' base format applied), the
  ;; same unpack $gl_2d_upload performs for glTexImage2D.
  (func $gl_g2_unpack_image (param $ctx i32) (param $stack i32) (param $w i32) (param $h i32)
      (param $format i32) (param $type i32) (param $src i32) (param $internal i32) (param $out i32)
    (local $n i32) (local $pitch i64) (local $start i64) (local $align i64) (local $row i32)
    (local $x i32) (local $p i32) (local $g i32) (local $cell i32) (local $swap i32)
    (if (i32.or (i32.eqz (local.get $src)) (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h)))) (then (return)))
    (if (i32.or (i32.eqz (call $gl_1d_components (local.get $format))) (i32.eqz (call $gl_1d_type_bytes (local.get $type))))
      (then (unreachable))) ;; GLU BITMAP sources: not implemented, fail fast
    (local.set $n (i32.mul (call $gl_1d_components (local.get $format)) (call $gl_1d_type_bytes (local.get $type))))
    (local.set $align (i64.extend_i32_u (i32.load offset=80 (local.get $ctx))))
    (local.set $pitch (i64.mul (i64.extend_i32_u (select (i32.load offset=84 (local.get $ctx)) (local.get $w)
      (i32.ne (i32.load offset=84 (local.get $ctx)) (i32.const 0)))) (i64.extend_i32_u (local.get $n))))
    (local.set $pitch (i64.and (i64.add (local.get $pitch) (i64.sub (local.get $align) (i64.const 1))) (i64.sub (i64.const 0) (local.get $align))))
    (local.set $start (i64.add (i64.mul (i64.extend_i32_u (i32.load offset=88 (local.get $ctx))) (local.get $pitch))
      (i64.mul (i64.extend_i32_u (i32.load offset=92 (local.get $ctx))) (i64.extend_i32_u (local.get $n)))))
    (loop $validate
      (if (i64.gt_u (i64.add (i64.add (i64.add (i64.extend_i32_u (local.get $src)) (local.get $start))
          (i64.mul (i64.extend_i32_u (local.get $row)) (local.get $pitch)))
          (i64.extend_i32_u (i32.mul (local.get $w) (local.get $n)))) (i64.const 0x100000000)) (then (unreachable)))
      (call $gl_1d_span (i32.wrap_i64 (i64.add (i64.add (i64.extend_i32_u (local.get $src)) (local.get $start))
        (i64.mul (i64.extend_i32_u (local.get $row)) (local.get $pitch)))) (i32.mul (local.get $w) (local.get $n)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $validate (i32.lt_u (local.get $row) (local.get $h))))
    (local.set $g (call $gl_alloc_affine (i32.const 16)))
    (if (i32.eqz (local.get $g)) (then (unreachable)))
    (local.set $cell (call $g2w (local.get $g)))
    (local.set $swap (i32.load offset=196 (call $gl_texture_block)))
    (local.set $row (i32.const 0))
    (loop $rows
      (local.set $p (i32.wrap_i64 (i64.add (i64.add (i64.extend_i32_u (local.get $src)) (local.get $start))
        (i64.mul (i64.extend_i32_u (local.get $row)) (local.get $pitch)))))
      (local.set $x (i32.const 0))
      (loop $pixels
        (call $gl_texture_expand (i32.add (local.get $p) (i32.mul (local.get $x) (local.get $n)))
          (local.get $format) (local.get $type) (local.get $swap) (local.get $cell))
        (i32.store (local.get $out) (call $gl_rgba8_swap_rb
          (call $gl_g2_select (call $gl_g2_canonical (local.get $g) (i32.const 0x1406) (local.get $format))
            (local.get $internal))))
        (local.set $out (i32.add (local.get $out) (i32.const 4)))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $pixels (i32.lt_u (local.get $x) (local.get $w))))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $row) (local.get $h))))
    (call $heap_free (local.get $g)))

  ;; After the flush: glReadPixels' tight RGBA8 is put through pixel
  ;; transfer and PACK into the guest's buffer; then the block is freed.
  (func $gl_g2_emit_done (param $op i32) (param $stack i32) (param $g i32)
    (if (i32.eq (local.get $op) (i32.const 17)) (then
      (call $gl_g2_pack_read_pixels (local.get $stack) (i32.add (local.get $g) (i32.const 64)))))
    (call $heap_free (local.get $g)))

  (func $gl_g2_pack_read_pixels (param $stack i32) (param $rgba i32)
    (local $w i32) (local $h i32) (local $format i32) (local $type i32) (local $out i32)
    (local $n i32) (local $bytes i32) (local $pack i32) (local $align i64) (local $stride i64)
    (local $start i64) (local $count i64) (local $row i32) (local $x i32) (local $dest i32)
    (local $pixel i32) (local $component i32) (local $t i32) (local $maps i32) (local $src i32)
    (local.set $w (i32.load offset=12 (local.get $stack)))
    (local.set $h (i32.load offset=16 (local.get $stack)))
    (local.set $format (i32.load offset=20 (local.get $stack)))
    (local.set $type (i32.load offset=24 (local.get $stack)))
    (local.set $out (i32.load offset=28 (local.get $stack)))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))) (then (return)))
    (local.set $n (call $gl_1d_components (local.get $format)))
    (if (i32.eq (local.get $format) (i32.const 0x80e0)) (then (local.set $n (i32.const 3))))
    (if (i32.eq (local.get $format) (i32.const 0x80e1)) (then (local.set $n (i32.const 4))))
    (local.set $bytes (call $gl_1d_type_bytes (local.get $type)))
    (if (i32.or (i32.eqz (local.get $n)) (i32.eqz (local.get $bytes))) (then (unreachable)))
    (local.set $pack (i32.add (call $gl_texture_block) (i32.const 268)))
    (local.set $align (i64.extend_i32_u (i32.load offset=20 (local.get $pack))))
    (local.set $stride (i64.mul (i64.extend_i32_u (i32.mul (local.get $n) (local.get $bytes)))
      (i64.extend_i32_u (select (i32.load offset=8 (local.get $pack)) (local.get $w)
        (i32.ne (i32.load offset=8 (local.get $pack)) (i32.const 0))))))
    (local.set $stride (i64.and (i64.add (local.get $stride) (i64.sub (local.get $align) (i64.const 1)))
      (i64.sub (i64.const 0) (local.get $align))))
    (local.set $start (i64.add (i64.mul (i64.extend_i32_u (i32.load offset=12 (local.get $pack))) (local.get $stride))
      (i64.mul (i64.extend_i32_u (i32.load offset=16 (local.get $pack)))
        (i64.extend_i32_u (i32.mul (local.get $n) (local.get $bytes))))))
    (local.set $count (i64.extend_i32_u (i32.mul (local.get $w) (i32.mul (local.get $n) (local.get $bytes)))))
    (loop $validate
      (if (i64.gt_u (i64.add (i64.add (i64.extend_i32_u (local.get $out)) (local.get $start))
          (i64.add (i64.mul (i64.extend_i32_u (local.get $row)) (local.get $stride)) (local.get $count)))
          (i64.const 0x100000000)) (then (unreachable)))
      (call $gl_1d_span (i32.wrap_i64 (i64.add (i64.add (i64.extend_i32_u (local.get $out)) (local.get $start))
        (i64.mul (i64.extend_i32_u (local.get $row)) (local.get $stride)))) (i32.wrap_i64 (local.get $count)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $validate (i32.lt_u (local.get $row) (local.get $h))))
    (local.set $t (call $gl_transfer_state))
    (local.set $maps (call $gl_pixel_maps))
    (local.set $src (call $g2w (local.get $rgba)))
    (local.set $row (i32.const 0))
    (loop $rows
      (local.set $dest (i32.wrap_i64 (i64.add (i64.add (i64.extend_i32_u (local.get $out)) (local.get $start))
        (i64.mul (i64.extend_i32_u (local.get $row)) (local.get $stride)))))
      (local.set $x (i32.const 0))
      (loop $pixels
        (local.set $pixel (call $gl_g2_texel (local.get $src) (i32.const 1) (i32.const 4) (local.get $t) (local.get $maps)))
        (local.set $src (i32.add (local.get $src) (i32.const 4)))
        (local.set $component (i32.const 0))
        (loop $components
          (call $gl_texture_pack_scalar (local.get $dest)
            (call $gl_texture_pack_component (local.get $pixel) (local.get $format) (local.get $component))
            (local.get $type) (i32.load (local.get $pack)))
          (local.set $dest (i32.add (local.get $dest) (local.get $bytes)))
          (local.set $component (i32.add (local.get $component) (i32.const 1)))
          (br_if $components (i32.lt_u (local.get $component) (local.get $n))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $pixels (i32.lt_u (local.get $x) (local.get $w))))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $row) (local.get $h)))))
