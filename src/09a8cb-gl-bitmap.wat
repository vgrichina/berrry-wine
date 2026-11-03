  ;; Bitmap-font front end. Context offsets 40..108 extend the native list
  ;; namespace with raster attributes and unpack state; 112..159 are scratch.
  ;; Captured bitmaps own one byte per source bit, normalized at compile time.
  ;; Transport mode 0x10000 contains window-space pixels, never object vertices.
  (func $gl_bitmap_context_init (param $ctx i32)
    (i32.store offset=40 (local.get $ctx) (i32.const 1))
    (f32.store offset=56 (local.get $ctx) (f32.const 1))
    (f32.store offset=60 (local.get $ctx) (f32.const 1))
    (f32.store offset=64 (local.get $ctx) (f32.const 1))
    (f32.store offset=68 (local.get $ctx) (f32.const 1))
    (f32.store offset=72 (local.get $ctx) (f32.const 1))
    (i32.store offset=80 (local.get $ctx) (i32.const 4))
    (f32.store offset=164 (local.get $ctx) (f32.const 1))
    ;; +264 distance, +268 index, +272/+288 texture vec4s, +304 private
    ;; evaluator input, +380 S/T texgen modes. All are owned by this context.
    (f32.store offset=268 (local.get $ctx) (f32.const 1))
    (f32.store offset=284 (local.get $ctx) (f32.const 1))
    (f32.store offset=300 (local.get $ctx) (f32.const 1))
    (call $gl_raster_texgen_init (local.get $ctx)))

  (func $gl_bitmap_count (param $ctx i32) (param $stack i32) (result i32)
    (local $w i32) (local $h i32) (local $n i64)
    (local.set $w (i32.load offset=4 (local.get $stack)))
    (local.set $h (i32.load offset=8 (local.get $stack)))
    (if (i32.or (i32.lt_s (local.get $w) (i32.const 0)) (i32.lt_s (local.get $h) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const -1))))
    (if (i32.eqz (i32.load offset=28 (local.get $stack))) (then (return (i32.const 0))))
    (local.set $n (i64.mul (i64.extend_i32_u (local.get $w)) (i64.extend_i32_u (local.get $h))))
    (if (i64.gt_u (local.get $n) (i64.const 0x7fffff00))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const -1))))
    (i32.wrap_i64 (local.get $n)))

  (func $gl_bitmap_copy (param $ctx i32) (param $stack i32) (param $out i32)
    (local $w i32) (local $h i32) (local $row i64) (local $align i64)
    (local $ptr i64) (local $bit i64) (local $address i64) (local $x i32) (local $y i32) (local $byte i32)
    (local.set $w (i32.load offset=4 (local.get $stack)))
    (local.set $h (i32.load offset=8 (local.get $stack)))
    (local.set $ptr (i64.extend_i32_u (i32.load offset=28 (local.get $stack))))
    (if (i32.or (i32.eqz (local.get $w)) (i32.or (i32.eqz (local.get $h)) (i64.eqz (local.get $ptr)))) (then (return)))
    (local.set $row (i64.extend_i32_u (select (i32.load offset=84 (local.get $ctx)) (local.get $w)
      (i32.ne (i32.load offset=84 (local.get $ctx)) (i32.const 0)))))
    (local.set $align (i64.extend_i32_u (i32.load offset=80 (local.get $ctx))))
    (local.set $row (i64.div_u (i64.add (local.get $row) (i64.const 7)) (i64.const 8)))
    (local.set $row (i64.mul (i64.div_u (i64.add (local.get $row)
      (i64.sub (local.get $align) (i64.const 1))) (local.get $align)) (local.get $align)))
    (loop $rows
      (local.set $x (i32.const 0))
      (loop $bits
        (local.set $bit (i64.add (i64.extend_i32_u (i32.load offset=92 (local.get $ctx))) (i64.extend_i32_u (local.get $x))))
        (local.set $address (i64.add (local.get $ptr) (i64.add
          (i64.mul (i64.add (i64.extend_i32_u (i32.load offset=88 (local.get $ctx)))
            (i64.extend_i32_u (local.get $y))) (local.get $row))
          (i64.div_u (local.get $bit) (i64.const 8)))))
        (if (i64.gt_u (local.get $address) (i64.const 0xffffffff)) (then (unreachable)))
        (local.set $byte (i32.load8_u (call $g2w (i32.wrap_i64 (local.get $address)))))
        (i32.store8 (local.get $out) (i32.and (i32.shr_u (local.get $byte)
          (select (i32.and (i32.wrap_i64 (local.get $bit)) (i32.const 7))
            (i32.sub (i32.const 7) (i32.and (i32.wrap_i64 (local.get $bit)) (i32.const 7)))
            (i32.ne (i32.load offset=96 (local.get $ctx)) (i32.const 0)))) (i32.const 1)))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $bits (i32.lt_u (local.get $x) (local.get $w))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $y) (local.get $h)))))

  (func $gl_bitmap_raster_pos (param $ctx i32) (param $stack i32) (param $four i32)
    (local $b i32) (local $v i32) (local $eye i32) (local $clip i32) (local $vp i32)
    (local $w f32) (local $i i32) (local $n f32) (local $far f32)
    (local $caps i32) (local $saved i32) (local $reverse i32) (local $light i32) (local $vertex i32)
    (local.set $b (call $gl_mtx_block))
    (if (call $gl_mtx_export_untrusted) (then (call $gl_bitmap_unsupported_raster_state)))
    (local.set $v (i32.add (local.get $ctx) (i32.const 112)))
    (local.set $eye (i32.add (local.get $ctx) (i32.const 128)))
    (local.set $clip (i32.add (local.get $ctx) (i32.const 144)))
    (call $gl_mtx_set4 (local.get $v) (f32.load offset=4 (local.get $stack))
      (f32.load offset=8 (local.get $stack))
      (if (result f32) (local.get $four) (then (f32.load offset=12 (local.get $stack))) (else (f32.const 0)))
      (if (result f32) (local.get $four) (then (f32.load offset=16 (local.get $stack))) (else (f32.const 1))))
    (call $gl_mtx_transform4 (local.get $eye) (call $gl_mtx_stack_top (local.get $b) (i32.const 0)) (local.get $v))
    (call $gl_mtx_transform4 (local.get $clip) (call $gl_mtx_stack_top (local.get $b) (i32.const 1)) (local.get $eye))
    (i32.store offset=40 (local.get $ctx) (i32.const 0))
    (local.set $w (f32.load offset=12 (local.get $clip)))
    (if (i32.eqz (f32.gt (local.get $w) (f32.const 0))) (then (return)))
    (loop $clip_axes
      (if (i32.eqz (f32.le (f32.abs (f32.load (i32.add (local.get $clip) (i32.shl (local.get $i) (i32.const 2)))))
          (local.get $w))) (then (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $clip_axes (i32.lt_u (local.get $i) (i32.const 3))))
    (local.set $i (i32.const 0))
    (loop $user_planes
      (if (call $gl_clip_enabled (local.get $i)) (then
        (if (f64.lt (call $gl_clip_distance (local.get $i) (local.get $eye)) (f64.const 0)) (then (return)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $user_planes (i32.lt_u (local.get $i) (i32.const 6))))
    ;; A private record feeds the existing lighting evaluator; it never enters
    ;; the immediate vertex buffer, stream or primitive assembly.
    (local.set $vertex (i32.add (local.get $ctx) (i32.const 304)))
    (memory.fill (local.get $vertex) (i32.const 0) (i32.const 76))
    (memory.copy (local.get $vertex) (local.get $v) (i32.const 12))
    (f32.store offset=56 (local.get $vertex) (f32.load offset=12 (local.get $v)))
    (f32.store offset=12 (local.get $vertex) (global.get $gl_color_r))
    (f32.store offset=16 (local.get $vertex) (global.get $gl_color_g))
    (f32.store offset=20 (local.get $vertex) (global.get $gl_color_b))
    (f32.store offset=24 (local.get $vertex) (global.get $gl_color_a))
    (f32.store offset=36 (local.get $vertex) (global.get $gl_normal_x))
    (f32.store offset=40 (local.get $vertex) (global.get $gl_normal_y))
    (f32.store offset=44 (local.get $vertex) (global.get $gl_normal_z))
    ;; Raster normals use the full inverse-transpose modelview. A separate
    ;; evaluator record preserves object coordinates for linear texgen.
    (memory.copy (i32.add (local.get $ctx) (i32.const 680)) (local.get $vertex) (i32.const 76))
    (call $gl_mtx_set4 (local.get $v) (global.get $gl_normal_x) (global.get $gl_normal_y)
      (global.get $gl_normal_z) (f32.const 0))
    (call $gl_raster_eye_plane (local.get $b) (i32.add (local.get $ctx) (i32.const 716)) (call $w2g (local.get $v)))
    (local.set $vp (call $gl_mtx_export_viewport_ptr))
    (if (i32.eqz (i32.load offset=168 (local.get $ctx))) (then
      (local.set $vp (i32.add (local.get $ctx) (i32.const 112)))
      (memory.fill (local.get $vp) (i32.const 0) (i32.const 16))
      (i32.store offset=8 (local.get $vp) (global.get $gl_sw_default_w))
      (i32.store offset=12 (local.get $vp) (global.get $gl_sw_default_h))))
    (f32.store offset=44 (local.get $ctx) (f32.add (f32.convert_i32_s (i32.load (local.get $vp)))
      (f32.mul (f32.mul (f32.add (f32.div (f32.load (local.get $clip)) (local.get $w)) (f32.const 1)) (f32.const 0.5))
        (f32.convert_i32_s (i32.load offset=8 (local.get $vp))))))
    (f32.store offset=48 (local.get $ctx) (f32.add (f32.convert_i32_s (i32.load offset=4 (local.get $vp)))
      (f32.mul (f32.mul (f32.add (f32.div (f32.load offset=4 (local.get $clip)) (local.get $w)) (f32.const 1)) (f32.const 0.5))
        (f32.convert_i32_s (i32.load offset=12 (local.get $vp))))))
    (local.set $n (f32.load offset=160 (local.get $ctx)))
    (local.set $far (f32.load offset=164 (local.get $ctx)))
    (f32.store offset=52 (local.get $ctx) (f32.add (local.get $n)
      (f32.mul (f32.mul (f32.add (f32.div (f32.load offset=8 (local.get $clip)) (local.get $w)) (f32.const 1))
        (f32.const 0.5)) (f32.sub (local.get $far) (local.get $n)))))
    (f32.store offset=56 (local.get $ctx) (local.get $w))
    (local.set $caps (i32.load offset=9036 (local.get $b)))
    (if (i32.and (local.get $caps) (i32.const 128)) (then
      ;; The evaluator reads software cap bits; use the authoritative native
      ;; context mirror even when the selected backend is WebGL.
      (local.set $saved (i32.load (global.get $gl_sw_st)))
      (local.set $reverse (global.get $gl_sw_reverse_normal))
      (local.set $light (global.get $gl_sw_light_block))
      (i32.store (global.get $gl_sw_st) (local.get $caps))
      (global.set $gl_sw_reverse_normal (i32.const 0))
      (call $gl_sw_light_setup (local.get $b))
      (call $gl_sw_light_evaluate (i32.add (local.get $ctx) (i32.const 680))
        (i32.add (local.get $ctx) (i32.const 60)) (i32.const 1))
      (i32.store (global.get $gl_sw_st) (local.get $saved))
      (global.set $gl_sw_reverse_normal (local.get $reverse))
      (global.set $gl_sw_light_block (local.get $light)))
      (else (memory.copy (i32.add (local.get $ctx) (i32.const 60))
        (i32.add (local.get $vertex) (i32.const 12)) (i32.const 16))))
    ;; Preserve the admitted integer color before its normalized f32 value
    ;; loses a boundary bit. Queryable raster color remains the GL float value.
    (i32.store offset=980 (local.get $ctx)
      (i32.and (i32.eqz (i32.and (local.get $caps) (i32.const 128)))
        (i32.ne (global.get $gl_source_tag) (i32.const 0))))
    (if (i32.load offset=980 (local.get $ctx)) (then
      (call $gl_source_save (i32.add (local.get $ctx) (i32.const 984)))
      (i32.store offset=976 (local.get $ctx) (call $gl_source_pack (i32.add (local.get $ctx) (i32.const 984))))))
    (local.set $i (i32.const 0))
    (loop $clamp_color
      (f32.store (i32.add (i32.add (local.get $ctx) (i32.const 60)) (local.get $i))
        (f32.min (f32.const 1) (f32.max (f32.const 0)
          (f32.load (i32.add (i32.add (local.get $ctx) (i32.const 60)) (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $clamp_color (i32.lt_u (local.get $i) (i32.const 16))))
    ;; Associated texture coordinates are captured after the texture matrix,
    ;; retaining r and q. Later current coordinates and matrices cannot alter them.
    (call $gl_mtx_set4 (local.get $v) (global.get $gl_tex_s) (global.get $gl_tex_t)
      (global.get $gl_tex_r) (global.get $gl_tex_q))
    (call $gl_raster_texgen (local.get $ctx) (i32.const 0) (local.get $v)
      (local.get $vertex) (local.get $eye) (local.get $b))
    (call $gl_mtx_transform4 (i32.add (local.get $ctx) (i32.const 272))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 2)) (local.get $v))
    (call $gl_mtx_set4 (local.get $v) (global.get $gl_tex1_s) (global.get $gl_tex1_t)
      (global.get $gl_tex1_r) (global.get $gl_tex1_q))
    (call $gl_raster_texgen (local.get $ctx) (i32.const 1) (local.get $v)
      (local.get $vertex) (local.get $eye) (local.get $b))
    (call $gl_mtx_transform4 (i32.add (local.get $ctx) (i32.const 288))
      (call $gl_mtx_stack_top (local.get $b) (i32.const 3)) (local.get $v))
    ;; Euclidean distance in eye space, after dehomogenization.
    (call $gl_sw_dehomogenize (local.get $eye))
    (f32.store offset=264 (local.get $ctx) (f32.sqrt (call $gl_sw_dot3 (local.get $eye) (local.get $eye))))
    (i32.store offset=40 (local.get $ctx) (i32.const 1)))

  (func $gl_bitmap_draw (param $ctx i32) (param $stack i32) (param $bits i32)
    (local $w i32) (local $h i32) (local $x i32) (local $y i32) (local $start i32)
    (local $count i32) (local $v i32) (local $ox f32) (local $oy f32)
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return)))
    (if (i32.eqz (i32.load offset=40 (local.get $ctx))) (then (return)))
    (local.set $w (i32.load offset=4 (local.get $stack)))
    (local.set $h (i32.load offset=8 (local.get $stack)))
    (local.set $ox (f32.floor (f32.sub (f32.load offset=44 (local.get $ctx)) (f32.load offset=12 (local.get $stack)))))
    (local.set $oy (f32.floor (f32.sub (f32.load offset=48 (local.get $ctx)) (f32.load offset=16 (local.get $stack)))))
    (if (i32.and (i32.ne (local.get $bits) (i32.const 0))
        (i32.and (i32.gt_s (local.get $w) (i32.const 0)) (i32.gt_s (local.get $h) (i32.const 0)))) (then
      (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
      (drop (call $gl_wat_stream_flush))
      (local.set $start (call $gl_packed_begin (i32.const 0x10000)))
      (loop $rows
        (local.set $x (i32.const 0))
        (loop $pixels
          (if (i32.load8_u (local.get $bits)) (then
            (if (i32.ge_u (local.get $count) (i32.const 27000)) (then
              (call $gl_packed_finish (local.get $start) (local.get $count))
              (drop (call $gl_wat_stream_flush))
              (local.set $start (call $gl_packed_begin (i32.const 0x10000)))
              (local.set $count (i32.const 0))))
            (local.set $v (i32.add (i32.add (local.get $start) (i32.const 32)) (i32.mul (local.get $count) (i32.const 76))))
            (memory.fill (local.get $v) (i32.const 0) (i32.const 76))
            (f32.store (local.get $v) (f32.add (local.get $ox) (f32.convert_i32_u (local.get $x))))
            (f32.store offset=4 (local.get $v) (f32.add (local.get $oy) (f32.convert_i32_u (local.get $y))))
            (f32.store offset=8 (local.get $v) (f32.load offset=52 (local.get $ctx)))
            (memory.copy (i32.add (local.get $v) (i32.const 12)) (i32.add (local.get $ctx) (i32.const 60)) (i32.const 16))
            (if (i32.load offset=980 (local.get $ctx)) (then
              (f32.store offset=12 (local.get $v) (f32.div (f32.convert_i32_u
                (i32.and (i32.shr_u (i32.load offset=976 (local.get $ctx)) (i32.const 16)) (i32.const 255))) (f32.const 255)))
              (f32.store offset=16 (local.get $v) (f32.div (f32.convert_i32_u
                (i32.and (i32.shr_u (i32.load offset=976 (local.get $ctx)) (i32.const 8)) (i32.const 255))) (f32.const 255)))
              (f32.store offset=20 (local.get $v) (f32.div (f32.convert_i32_u
                (i32.and (i32.load offset=976 (local.get $ctx)) (i32.const 255))) (f32.const 255)))
              (f32.store offset=24 (local.get $v) (f32.div (f32.convert_i32_u
                (i32.shr_u (i32.load offset=976 (local.get $ctx)) (i32.const 24))) (f32.const 255)))))
            ;; Homogeneous raster coordinates, already generated/transformed.
            (memory.copy (i32.add (local.get $v) (i32.const 28)) (i32.add (local.get $ctx) (i32.const 272)) (i32.const 8))
            (memory.copy (i32.add (local.get $v) (i32.const 48)) (i32.add (local.get $ctx) (i32.const 288)) (i32.const 8))
            (memory.copy (i32.add (local.get $v) (i32.const 60)) (i32.add (local.get $ctx) (i32.const 280)) (i32.const 8))
            (memory.copy (i32.add (local.get $v) (i32.const 68)) (i32.add (local.get $ctx) (i32.const 296)) (i32.const 8))
            (f32.store offset=36 (local.get $v) (f32.load offset=264 (local.get $ctx)))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))))
          (local.set $bits (i32.add (local.get $bits) (i32.const 1)))
          (local.set $x (i32.add (local.get $x) (i32.const 1)))
          (br_if $pixels (i32.lt_u (local.get $x) (local.get $w))))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $y) (local.get $h))))
      (call $gl_packed_finish (local.get $start) (local.get $count))))
    (f32.store offset=44 (local.get $ctx) (f32.add (f32.load offset=44 (local.get $ctx)) (f32.load offset=20 (local.get $stack))))
    (f32.store offset=48 (local.get $ctx) (f32.add (f32.load offset=48 (local.get $ctx)) (f32.load offset=24 (local.get $stack)))))

  (func $gl_bitmap_unsupported_raster_state (unreachable))

  (func $gl_calllists_size (param $ctx i32) (param $type i32) (result i32)
    (if (i32.or (i32.eq (local.get $type) (i32.const 0x1400)) (i32.eq (local.get $type) (i32.const 0x1401))) (then (return (i32.const 1))))
    (if (i32.or (i32.or (i32.eq (local.get $type) (i32.const 0x1402)) (i32.eq (local.get $type) (i32.const 0x1403)))
        (i32.eq (local.get $type) (i32.const 0x1407))) (then (return (i32.const 2))))
    (if (i32.eq (local.get $type) (i32.const 0x1408)) (then (return (i32.const 3))))
    (if (i32.or (i32.and (i32.ge_u (local.get $type) (i32.const 0x1404)) (i32.le_u (local.get $type) (i32.const 0x1406)))
        (i32.eq (local.get $type) (i32.const 0x1409))) (then (return (i32.const 4))))
    (call $gl_list_error (local.get $ctx) (i32.const 0x500))
    (i32.const 0))

  (func $gl_calllists_copy (param $stack i32) (param $step i32) (param $out i32)
    (local $n i32) (local $type i32) (local $src i32) (local $i i32) (local $value i32) (local $j i32)
    (local.set $n (i32.load offset=4 (local.get $stack)))
    (local.set $type (i32.load offset=8 (local.get $stack)))
    (local.set $src (i32.load offset=12 (local.get $stack)))
    (block $done (loop $names
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $value (i32.const 0))
      (local.set $j (i32.const 0))
      (loop $bytes
        (if (i32.ge_u (local.get $type) (i32.const 0x1407))
          (then (local.set $value (i32.or (i32.shl (local.get $value) (i32.const 8)) (call $gl8 (i32.add (local.get $src) (local.get $j))))))
          (else (local.set $value (i32.or (local.get $value) (i32.shl (call $gl8 (i32.add (local.get $src) (local.get $j)))
            (i32.mul (local.get $j) (i32.const 8)))))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $bytes (i32.lt_u (local.get $j) (local.get $step))))
      (if (i32.eq (local.get $type) (i32.const 0x1400)) (then (local.set $value (i32.extend8_s (local.get $value)))))
      (if (i32.eq (local.get $type) (i32.const 0x1402)) (then (local.set $value (i32.extend16_s (local.get $value)))))
      (if (i32.eq (local.get $type) (i32.const 0x1406)) (then (local.set $value
        (i32.wrap_i64 (i64.trunc_sat_f32_s (f32.reinterpret_i32 (local.get $value)))))))
      (i32.store (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2))) (local.get $value))
      (local.set $src (i32.add (local.get $src) (local.get $step)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $names))))

  (func $gl_calllists_play (param $ctx i32) (param $names i32) (param $n i32)
    (local $base i32) (local $i i32)
    (local.set $base (i32.load offset=100 (local.get $ctx)))
    (block $done (loop $play
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (call $gl_list_call (local.get $ctx) (i32.add (local.get $base)
        (i32.load (i32.add (local.get $names) (i32.shl (local.get $i) (i32.const 2))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $play))))

  (func $gl_calllists (param $ctx i32) (param $stack i32) (param $record i32)
    (local $step i32) (local $n i32) (local $p i32) (local $out i32)
    (local.set $n (i32.load offset=4 (local.get $stack)))
    (if (i32.lt_s (local.get $n) (i32.const 0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return)))
    (local.set $step (call $gl_calllists_size (local.get $ctx) (i32.load offset=8 (local.get $stack))))
    (if (i32.eqz (local.get $step)) (then (return)))
    (if (i32.gt_u (local.get $n) (i32.const 0x1fffffe0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return)))
    (if (local.get $record) (then
      (local.set $p (call $gl_list_record_owned (local.get $ctx) (i32.const 133) (local.get $stack) (i32.shl (local.get $n) (i32.const 2))))
      (if (i32.eqz (local.get $p)) (then (return)))
      (local.set $out (i32.add (local.get $p) (i32.const 88))))
      (else
        (if (i32.eqz (local.get $n)) (then (return)))
        (local.set $out (call $gl_list_alloc (i32.shl (local.get $n) (i32.const 2))))
        (if (i32.eqz (local.get $out)) (then
          (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return)))))
    (call $gl_calllists_copy (local.get $stack) (local.get $step) (local.get $out))
    (if (i32.or (i32.eqz (local.get $record)) (i32.eq (i32.load offset=24 (local.get $ctx)) (i32.const 0x1301)))
      (then (call $gl_calllists_play (local.get $ctx) (local.get $out) (local.get $n))))
    (if (i32.eqz (local.get $record)) (then (call $heap_free (call $w2g (local.get $out))))))

  (func $gl_list_record_owned (param $ctx i32) (param $op i32) (param $stack i32) (param $bytes i32) (result i32)
    (local $p i32) (local $tail i32)
    (local.set $p (call $gl_list_alloc (i32.add (i32.const 88) (local.get $bytes))))
    (if (i32.eqz (local.get $p)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 0))))
    (i32.store offset=4 (local.get $p) (local.get $op))
    (memory.copy (i32.add (local.get $p) (i32.const 8)) (local.get $stack)
      (i32.shl (i32.add (call $gl_arg_words (local.get $op)) (i32.const 1)) (i32.const 2)))
    (i32.store offset=84 (local.get $p) (local.get $bytes))
    (local.set $tail (i32.load offset=20 (local.get $ctx)))
    (if (local.get $tail) (then (i32.store (local.get $tail) (local.get $p)))
      (else (i32.store offset=16 (local.get $ctx) (local.get $p))))
    (i32.store offset=20 (local.get $ctx) (local.get $p))
    (local.get $p))

  (func $gl_bitmap_record (param $ctx i32) (param $stack i32)
    (local $n i32) (local $p i32) (local $bits i32)
    (local.set $n (call $gl_bitmap_count (local.get $ctx) (local.get $stack)))
    (if (i32.lt_s (local.get $n) (i32.const 0)) (then (return)))
    (local.set $p (call $gl_list_record_owned (local.get $ctx) (i32.const 131) (local.get $stack) (local.get $n)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (if (local.get $n) (then
      (local.set $bits (i32.add (local.get $p) (i32.const 88)))
      (call $gl_bitmap_copy (local.get $ctx) (local.get $stack) (local.get $bits))))
    (if (i32.eq (i32.load offset=24 (local.get $ctx)) (i32.const 0x1301))
      (then (call $gl_bitmap_draw (local.get $ctx) (local.get $stack) (local.get $bits)))))

  (func $gl_bitmap_sw_draw (param $start i32) (param $count i32)
    (local $i i32) (local $v i32) (local $p i32) (local $x i32) (local $y i32)
    (if (i32.eqz (call $gl_sw_target)) (then (return)))
    (call $d3dim_worker_fence)
    (if (i32.eqz (call $gl_sw_raster_state)) (then (return)))
    (if (i32.eqz (call $gl_stencil_prepare)) (then (return)))
    (call $gl_logic_begin)
    (global.set $rast_stencil_state (call $gl_stencil_state))
    (global.set $rast_color_mask (call $gl_color_mask_bits (global.get $gl_sw_rt)))
    (if (global.get $rast_stencil_state) (then
      (if (i32.eqz (i32.load (global.get $rast_stencil_state)))
        (then (global.set $rast_stencil_state (i32.const 0))))))
    (call $gl_sw_prim_done)
    (local.set $p (call $gl_sw_screen_at (i32.const 0)))
    (memory.fill (local.get $p) (i32.const 0) (i32.const 32))
    (f32.store offset=12 (local.get $p) (f32.const 1))
    (block $done (loop $pixels
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $v (i32.add (i32.add (local.get $start) (i32.const 32)) (i32.mul (local.get $i) (i32.const 76))))
      (if (i32.eqz (i32.and
          (i32.and (f32.ge (f32.load (local.get $v)) (f32.const 0))
            (f32.lt (f32.load (local.get $v)) (f32.convert_i32_u (load.field DxObject width (global.get $gl_sw_rt)))))
          (i32.and (f32.ge (f32.load offset=4 (local.get $v)) (f32.const 0))
            (f32.lt (f32.load offset=4 (local.get $v)) (f32.convert_i32_u (load.field DxObject height (global.get $gl_sw_rt)))))))
        (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $pixels)))
      (local.set $x (i32.sub (i32.trunc_sat_f32_s (f32.load (local.get $v))) (global.get $gl_sw_r_dx)))
      (local.set $y (i32.trunc_sat_f32_s (f32.load offset=4 (local.get $v))))
      (if (global.get $gl_sw_flip_y) (then
        (local.set $y (i32.sub (i32.sub (load.field DxObject height (global.get $gl_sw_rt)) (i32.const 1)) (local.get $y)))))
      (local.set $y (i32.sub (local.get $y) (global.get $gl_sw_r_dy)))
      (f32.store offset=8 (local.get $p) (f32.load offset=8 (local.get $v)))
      ;; One bitmap sample has constant S/Q and T/Q; no interpolation or
      ;; second texture-matrix application is appropriate here.
      (f32.store offset=16 (local.get $p) (f32.div (f32.load offset=28 (local.get $v)) (f32.load offset=64 (local.get $v))))
      (f32.store offset=20 (local.get $p) (f32.div (f32.load offset=32 (local.get $v)) (f32.load offset=64 (local.get $v))))
      (if (call $gl_sw_t1_bind) (then
        (global.set $rast_t1_on (i32.const 1))
        (global.set $rast_t1_qa (f32.const 0)) (global.set $rast_t1_qb (f32.const 0)) (global.set $rast_t1_qc (f32.const 1))
        (global.set $rast_t1_ua (f32.const 0)) (global.set $rast_t1_ub (f32.const 0))
        (global.set $rast_t1_uc (f32.div (f32.load offset=48 (local.get $v)) (f32.load offset=72 (local.get $v))))
        (global.set $rast_t1_va (f32.const 0)) (global.set $rast_t1_vb (f32.const 0))
        (global.set $rast_t1_vc (f32.div (f32.load offset=52 (local.get $v)) (f32.load offset=72 (local.get $v))))))
      (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 64)) (then
        (global.set $rast_fog_on (i32.const 1))
        (global.set $rast_fog_a (f32.const 0)) (global.set $rast_fog_b (f32.const 0))
        (global.set $rast_fog_c (call $gl_sw_fog_factor (f32.load offset=36 (local.get $v))))
        (global.set $rast_fog_color (global.get $gl_sw_fog_color))))
      (i32.store offset=24 (local.get $p) (call $gl_sw_color (local.get $v)))
      (call $gl_sw_span (local.get $y) (local.get $x) (local.get $p) (i32.add (local.get $x) (i32.const 1)) (local.get $p))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $pixels)))
    (call $gl_sw_prim_done)
    (global.set $rast_stencil_state (i32.const 0))
    (global.set $rast_color_mask (i32.const -1))
    (global.set $rast_gl_logic (i32.const 0))
    (global.set $rast_gl_dither (i32.const 0)))

  (func $gl_bitmap_intercept (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $a i32) (local $v i32) (local $p i32) (local $n i32) (local $bits i32)
    (local $mask i32) (local $b i32) (local $j i32) (local $value f32)
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (if (call $gl_accum_intercept (local.get $op) (local.get $stack)) (then (return (i32.const 1))))
    (local.set $a (i32.load offset=4 (local.get $stack)))
    (local.set $v (i32.load offset=8 (local.get $stack)))
    (call $gl_raster_texgen_state (local.get $ctx) (local.get $op) (local.get $stack))
    (if (i32.eq (local.get $op) (i32.const 20))
      (then (i32.store offset=168 (local.get $ctx) (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 7)) (then
      (f32.store offset=160 (local.get $ctx) (f32.demote_f64 (f64.min (f64.const 1) (f64.max (f64.const 0) (f64.load offset=4 (local.get $stack))))))
      (f32.store offset=164 (local.get $ctx) (f32.demote_f64 (f64.min (f64.const 1) (f64.max (f64.const 0) (f64.load offset=12 (local.get $stack))))))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10))) (then
      (if (i32.eq (local.get $a) (i32.const 0x0DE1)) (then
        (local.set $mask (i32.shl (i32.const 1) (i32.load offset=4 (call $gl_mtx_block))))))
      (if (i32.eq (local.get $a) (i32.const 0x0B60)) (then (local.set $mask (i32.const 4))))
      (if (i32.eq (local.get $a) (i32.const 0x0B50)) (then (local.set $mask (i32.const 8))))
      (i32.store offset=108 (local.get $ctx)
        (if (result i32) (i32.eq (local.get $op) (i32.const 10))
          (then (i32.or (i32.load offset=108 (local.get $ctx)) (local.get $mask)))
          (else (i32.and (i32.load offset=108 (local.get $ctx)) (i32.xor (local.get $mask) (i32.const -1))))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 73))
        (i32.le_u (i32.sub (local.get $a) (i32.const 0xd00)) (i32.const 5))) (then
      (if (i32.or
          (i32.and (i32.ge_u (local.get $a) (i32.const 0xd02))
            (i32.and (i32.le_u (local.get $a) (i32.const 0xd04)) (i32.lt_s (local.get $v) (i32.const 0))))
          (i32.and (i32.eq (local.get $a) (i32.const 0xd05))
            (i32.eqz (i32.or (i32.or (i32.eq (local.get $v) (i32.const 1)) (i32.eq (local.get $v) (i32.const 2)))
              (i32.or (i32.eq (local.get $v) (i32.const 4)) (i32.eq (local.get $v) (i32.const 8)))))))
        (then (call $gl_list_error (local.get $ctx) (i32.const 0x501)))
        (else (i32.store (i32.add (call $gl_texture_block) (i32.add (i32.const 268)
          (i32.shl (i32.sub (local.get $a) (i32.const 0xd00)) (i32.const 2))))
          (select (i32.ne (local.get $v) (i32.const 0)) (local.get $v) (i32.lt_u (local.get $a) (i32.const 0xd02))))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 73)) (i32.eq (local.get $a) (i32.const 0xcf0))) (then
      (i32.store offset=196 (call $gl_texture_block) (i32.ne (local.get $v) (i32.const 0)))))
    (if (i32.eq (local.get $op) (i32.const 73)) (then
      (if (i32.eq (local.get $a) (i32.const 0x0CF5)) (then
        (if (i32.or (i32.or (i32.eq (local.get $v) (i32.const 1)) (i32.eq (local.get $v) (i32.const 2)))
            (i32.or (i32.eq (local.get $v) (i32.const 4)) (i32.eq (local.get $v) (i32.const 8))))
          (then (i32.store offset=80 (local.get $ctx) (local.get $v)))
          (else (call $gl_list_error (local.get $ctx) (i32.const 0x501))))))
      (if (i32.and (i32.ge_u (local.get $a) (i32.const 0x0CF2)) (i32.le_u (local.get $a) (i32.const 0x0CF4))) (then
        (if (i32.lt_s (local.get $v) (i32.const 0))
          (then (call $gl_list_error (local.get $ctx) (i32.const 0x501)))
          (else (i32.store (i32.add (i32.add (local.get $ctx) (i32.const 84))
            (i32.shl (i32.sub (local.get $a) (i32.const 0x0CF2)) (i32.const 2))) (local.get $v))))))
      (if (i32.eq (local.get $a) (i32.const 0x0CF1)) (then
        (i32.store offset=96 (local.get $ctx) (i32.ne (local.get $v) (i32.const 0)))))))
    ;; Client stack: context +176=head, +180=depth. Frames own a mask,
    ;; supported pixel-store modes (+80..96), and all native client arrays.
    ;; Only the two defined bits select groups; ALL_ATTRIB_BITS selects both.
    (if (i32.or (i32.eq (local.get $op) (i32.const 134))
                (i32.eq (local.get $op) (i32.const 135))) (then
      (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))))
    (if (i32.eq (local.get $op) (i32.const 134)) (then
      (if (i32.ge_u (i32.load offset=180 (local.get $ctx)) (i32.const 16)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x503)) (return (i32.const 1))))
      (local.set $p (call $gl_list_alloc (i32.const 144)))
      (if (i32.eqz (local.get $p)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 1))))
      (i32.store (local.get $p) (i32.load offset=176 (local.get $ctx)))
      (i32.store offset=4 (local.get $p) (local.get $a))
      (memory.copy (i32.add (local.get $p) (i32.const 8))
        (i32.add (local.get $ctx) (i32.const 80)) (i32.const 20))
      (i32.store offset=116 (local.get $p) (i32.load offset=196 (call $gl_texture_block)))
      (memory.copy (i32.add (local.get $p) (i32.const 120)) (i32.add (call $gl_texture_block) (i32.const 268)) (i32.const 24))
      (i32.store offset=28 (local.get $p) (global.get $gl_client_bits))
      (i32.store offset=32 (local.get $p) (global.get $gl_client_tex_unit))
      (i32.store offset=36 (local.get $p) (global.get $gl_state_pointer_bits))
      (i32.store offset=40 (local.get $p) (global.get $gl_vp_size))
      (i32.store offset=44 (local.get $p) (global.get $gl_vp_type))
      (i32.store offset=48 (local.get $p) (global.get $gl_vp_stride))
      (i32.store offset=52 (local.get $p) (global.get $gl_vp_guest))
      (i32.store offset=56 (local.get $p) (global.get $gl_np_type))
      (i32.store offset=60 (local.get $p) (global.get $gl_np_stride))
      (i32.store offset=64 (local.get $p) (global.get $gl_np_guest))
      (i32.store offset=68 (local.get $p) (global.get $gl_cp_size))
      (i32.store offset=72 (local.get $p) (global.get $gl_cp_type))
      (i32.store offset=76 (local.get $p) (global.get $gl_cp_stride))
      (i32.store offset=80 (local.get $p) (global.get $gl_cp_guest))
      (i32.store offset=84 (local.get $p) (global.get $gl_tp0_size))
      (i32.store offset=88 (local.get $p) (global.get $gl_tp0_type))
      (i32.store offset=92 (local.get $p) (global.get $gl_tp0_stride))
      (i32.store offset=96 (local.get $p) (global.get $gl_tp0_guest))
      (i32.store offset=100 (local.get $p) (global.get $gl_tp1_size))
      (i32.store offset=104 (local.get $p) (global.get $gl_tp1_type))
      (i32.store offset=108 (local.get $p) (global.get $gl_tp1_stride))
      (i32.store offset=112 (local.get $p) (global.get $gl_tp1_guest))
      (i32.store offset=176 (local.get $ctx) (local.get $p))
      (i32.store offset=180 (local.get $ctx) (i32.add (i32.load offset=180 (local.get $ctx)) (i32.const 1)))))
    (if (i32.eq (local.get $op) (i32.const 135)) (then
      (local.set $p (i32.load offset=176 (local.get $ctx)))
      (if (i32.eqz (local.get $p)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x504)) (return (i32.const 1))))
      (local.set $mask (i32.load offset=4 (local.get $p)))
      (if (i32.and (local.get $mask) (i32.const 1)) (then
        (i32.store offset=196 (call $gl_texture_block) (i32.load offset=116 (local.get $p)))
        (memory.copy (i32.add (call $gl_texture_block) (i32.const 268)) (i32.add (local.get $p) (i32.const 120)) (i32.const 24))
        (memory.copy (i32.add (local.get $ctx) (i32.const 80))
          (i32.add (local.get $p) (i32.const 8)) (i32.const 20))
        (i32.store offset=44 (global.get $gl_sw_st) (i32.load offset=8 (local.get $p)))))
      (if (i32.and (local.get $mask) (i32.const 2)) (then
        (global.set $gl_client_bits (i32.load offset=28 (local.get $p)))
        (global.set $gl_client_tex_unit (i32.load offset=32 (local.get $p)))
        (global.set $gl_state_pointer_bits (i32.load offset=36 (local.get $p)))
        (global.set $gl_vp_size (i32.load offset=40 (local.get $p)))
        (global.set $gl_vp_type (i32.load offset=44 (local.get $p)))
        (global.set $gl_vp_stride (i32.load offset=48 (local.get $p)))
        (global.set $gl_vp_guest (i32.load offset=52 (local.get $p)))
        (global.set $gl_np_type (i32.load offset=56 (local.get $p)))
        (global.set $gl_np_stride (i32.load offset=60 (local.get $p)))
        (global.set $gl_np_guest (i32.load offset=64 (local.get $p)))
        (global.set $gl_cp_size (i32.load offset=68 (local.get $p)))
        (global.set $gl_cp_type (i32.load offset=72 (local.get $p)))
        (global.set $gl_cp_stride (i32.load offset=76 (local.get $p)))
        (global.set $gl_cp_guest (i32.load offset=80 (local.get $p)))
        (global.set $gl_tp0_size (i32.load offset=84 (local.get $p)))
        (global.set $gl_tp0_type (i32.load offset=88 (local.get $p)))
        (global.set $gl_tp0_stride (i32.load offset=92 (local.get $p)))
        (global.set $gl_tp0_guest (i32.load offset=96 (local.get $p)))
        (global.set $gl_tp1_size (i32.load offset=100 (local.get $p)))
        (global.set $gl_tp1_type (i32.load offset=104 (local.get $p)))
        (global.set $gl_tp1_stride (i32.load offset=108 (local.get $p)))
        (global.set $gl_tp1_guest (i32.load offset=112 (local.get $p)))))
      (i32.store offset=176 (local.get $ctx) (i32.load (local.get $p)))
      (i32.store offset=180 (local.get $ctx) (i32.sub (i32.load offset=180 (local.get $ctx)) (i32.const 1)))
      (call $heap_free (call $w2g (local.get $p)))))
    ;; Query the native stack and supported pixel modes, never a stale backend.
    (if (i32.or (i32.eq (local.get $op) (i32.const 13)) (i32.eq (local.get $op) (i32.const 103))) (then
      (local.set $n (i32.const -1))
      (if (i32.eq (local.get $a) (i32.const 0x0BB1)) (then (local.set $n (i32.load offset=180 (local.get $ctx)))))
      (if (i32.eq (local.get $a) (i32.const 0x0D3B)) (then (local.set $n (i32.const 16))))
      (if (i32.eq (local.get $a) (i32.const 0x84E1)) (then (local.set $n (i32.add (i32.const 0x84C0) (global.get $gl_client_tex_unit)))))
      (if (i32.eq (local.get $a) (i32.const 0x0CF5)) (then (local.set $n (i32.load offset=80 (local.get $ctx)))))
      (if (i32.and (i32.ge_u (local.get $a) (i32.const 0x0CF2)) (i32.le_u (local.get $a) (i32.const 0x0CF4))) (then
        (local.set $n (i32.load (i32.add (i32.add (local.get $ctx) (i32.const 84))
          (i32.shl (i32.sub (local.get $a) (i32.const 0x0CF2)) (i32.const 2)))))))
      (if (i32.eq (local.get $a) (i32.const 0x0CF1)) (then (local.set $n (i32.load offset=96 (local.get $ctx)))))
      (if (i32.ge_s (local.get $n) (i32.const 0)) (then
        (call $gs32 (local.get $v) (if (result i32) (i32.eq (local.get $op) (i32.const 13))
          (then (i32.reinterpret_f32 (f32.convert_i32_s (local.get $n)))) (else (local.get $n))))
        (return (i32.const 1))))))
    (if (i32.eq (local.get $op) (i32.const 130)) (then
      (call $gl_bitmap_raster_pos (local.get $ctx) (local.get $stack) (i32.const 0)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 146)) (then
      (call $gl_bitmap_raster_pos (local.get $ctx) (local.get $stack) (i32.const 1)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 131)) (then
      (local.set $n (call $gl_bitmap_count (local.get $ctx) (local.get $stack)))
      (if (i32.lt_s (local.get $n) (i32.const 0)) (then (return (i32.const 1))))
      (if (local.get $n) (then
        (local.set $bits (call $gl_list_alloc (local.get $n)))
        (if (i32.eqz (local.get $bits)) (then
          (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 1))))
        (call $gl_bitmap_copy (local.get $ctx) (local.get $stack) (local.get $bits))))
      (call $gl_bitmap_draw (local.get $ctx) (local.get $stack) (local.get $bits))
      (if (local.get $bits) (then (call $heap_free (call $w2g (local.get $bits)))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 132)) (then
      (i32.store offset=100 (local.get $ctx) (local.get $a)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 133)) (then
      (call $gl_calllists (local.get $ctx) (local.get $stack) (i32.const 0)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 76)) (then
      (if (i32.ge_u (i32.load offset=172 (local.get $ctx)) (i32.const 16)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x503)) (return (i32.const 1))))
      (local.set $p (call $gl_list_alloc (i32.const 672)))
      (if (i32.eqz (local.get $p)) (then (unreachable)))
      (i32.store (local.get $p) (i32.load offset=104 (local.get $ctx)))
      (i32.store offset=4 (local.get $p) (local.get $a))
      (i32.store offset=8 (local.get $p) (i32.load offset=100 (local.get $ctx)))
      (i32.store offset=12 (local.get $p) (i32.load offset=108 (local.get $ctx)))
      (memory.copy (i32.add (local.get $p) (i32.const 16)) (i32.add (local.get $ctx) (i32.const 40)) (i32.const 40))
      (memory.copy (i32.add (local.get $p) (i32.const 56)) (i32.add (local.get $ctx) (i32.const 192)) (i32.const 36))
      (i32.store offset=92 (local.get $p) (i32.load offset=228 (local.get $ctx)))
      (i32.store offset=96 (local.get $p) (i32.load offset=232 (local.get $ctx)))
      (i32.store offset=100 (local.get $p) (i32.load offset=236 (local.get $ctx)))
      (i32.store offset=104 (local.get $p) (global.get $gl_sw_clear_color))
      (memory.copy (i32.add (local.get $p) (i32.const 108)) (i32.add (local.get $ctx) (i32.const 248)) (i32.const 16))
      (memory.copy (i32.add (local.get $p) (i32.const 124))
        (i32.add (local.get $ctx) (i32.const 264)) (i32.const 40))
      (memory.copy (i32.add (local.get $p) (i32.const 164))
        (i32.add (local.get $ctx) (i32.const 384)) (i32.const 296))
      (memory.copy (i32.add (local.get $p) (i32.const 464))
        (call $gl_clip_state) (i32.const 200))
      (memory.copy (i32.add (local.get $p) (i32.const 664)) (i32.add (local.get $ctx) (i32.const 976)) (i32.const 8))
      (i32.store offset=104 (local.get $ctx) (local.get $p))
      (i32.store offset=172 (local.get $ctx) (i32.add (i32.load offset=172 (local.get $ctx)) (i32.const 1)))))
    (if (i32.eq (local.get $op) (i32.const 77)) (then
      (local.set $p (i32.load offset=104 (local.get $ctx)))
      (if (i32.eqz (local.get $p)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x504)) (return (i32.const 1))))
      (local.set $mask (i32.load offset=4 (local.get $p)))
      (if (i32.and (local.get $mask) (i32.const 0x1000)) (then
        (memory.copy (call $gl_clip_state) (i32.add (local.get $p) (i32.const 464)) (i32.const 192))))
      (if (i32.and (local.get $mask) (i32.const 0x3000)) (then
        (i32.store offset=192 (call $gl_clip_state) (i32.load offset=656 (local.get $p)))))
      (if (i32.and (local.get $mask) (i32.const 0x200)) (then
        (memory.copy (i32.add (local.get $ctx) (i32.const 248)) (i32.add (local.get $p) (i32.const 108)) (i32.const 16))))
      (if (i32.and (local.get $mask) (i32.const 0x4000))
        (then
          (i32.store offset=228 (local.get $ctx) (i32.load offset=92 (local.get $p)))
          (i32.store offset=232 (local.get $ctx) (i32.load offset=96 (local.get $p)))
          (global.set $gl_sw_clear_color (i32.load offset=104 (local.get $p)))))
      (if (i32.and (local.get $mask) (i32.const 0x20)) (then
        (i32.store offset=236 (local.get $ctx) (i32.load offset=100 (local.get $p)))))
      (if (i32.and (local.get $mask) (i32.const 0x20000))
        (then (i32.store offset=100 (local.get $ctx) (i32.load offset=8 (local.get $p)))))
      (if (i32.and (local.get $mask) (i32.const 0x400)) (then
        (memory.copy (i32.add (local.get $ctx) (i32.const 192)) (i32.add (local.get $p) (i32.const 56)) (i32.const 36))))
      (if (i32.and (local.get $mask) (i32.const 0x2000))
        (then (i32.store offset=192 (local.get $ctx) (i32.load offset=56 (local.get $p)))))
      (if (i32.and (local.get $mask) (i32.const 1))
        (then (memory.copy (i32.add (local.get $ctx) (i32.const 976)) (i32.add (local.get $p) (i32.const 664)) (i32.const 8))
          (memory.copy (i32.add (local.get $ctx) (i32.const 40)) (i32.add (local.get $p) (i32.const 16)) (i32.const 40))
          (memory.copy (i32.add (local.get $ctx) (i32.const 264))
            (i32.add (local.get $p) (i32.const 124)) (i32.const 40))))
      (if (i32.and (local.get $mask) (i32.const 0x40000)) (then
        (memory.copy (i32.add (local.get $ctx) (i32.const 384))
          (i32.add (local.get $p) (i32.const 164)) (i32.const 296))))
      (if (i32.and (local.get $mask) (i32.const 0x2000)) (then
        (i32.store offset=384 (local.get $ctx) (i32.load offset=164 (local.get $p)))
        (i32.store offset=532 (local.get $ctx) (i32.load offset=312 (local.get $p)))))
      (local.set $b (i32.const 0))
      (if (i32.and (local.get $mask) (i32.const 0x2000)) (then (local.set $b (i32.const 15))))
      (if (i32.and (local.get $mask) (i32.const 0x40000)) (then (local.set $b (i32.or (local.get $b) (i32.const 3)))))
      (if (i32.and (local.get $mask) (i32.const 0x80)) (then (local.set $b (i32.or (local.get $b) (i32.const 4)))))
      (if (i32.and (local.get $mask) (i32.const 0x40)) (then (local.set $b (i32.or (local.get $b) (i32.const 8)))))
      (i32.store offset=108 (local.get $ctx) (i32.or
        (i32.and (i32.load offset=108 (local.get $ctx)) (i32.xor (local.get $b) (i32.const -1)))
        (i32.and (i32.load offset=12 (local.get $p)) (local.get $b))))
      (i32.store offset=104 (local.get $ctx) (i32.load (local.get $p)))
      (i32.store offset=172 (local.get $ctx) (i32.sub (i32.load offset=172 (local.get $ctx)) (i32.const 1)))
      (call $heap_free (call $w2g (local.get $p)))))
    ;; Raster queries are answered from the native state that actually draws.
    (if (i32.or (i32.eq (local.get $op) (i32.const 13)) (i32.eq (local.get $op) (i32.const 103))) (then
      (if (i32.eq (local.get $a) (i32.const 0x0B07)) (then (local.set $p (i32.add (local.get $ctx) (i32.const 44))) (local.set $n (i32.const 4))))
      (if (i32.eq (local.get $a) (i32.const 0x0B04)) (then (local.set $p (i32.add (local.get $ctx) (i32.const 60))) (local.set $n (i32.const 4))))
      (if (i32.eq (local.get $a) (i32.const 0x0B08)) (then (local.set $p (i32.add (local.get $ctx) (i32.const 40))) (local.set $n (i32.const 1))))
      (if (i32.eq (local.get $a) (i32.const 0x0B32)) (then (local.set $p (i32.add (local.get $ctx) (i32.const 100))) (local.set $n (i32.const 1))))
      (if (local.get $p) (then
        (loop $query
          (local.set $value (if (result f32) (i32.eq (local.get $n) (i32.const 4))
            (then (f32.load (i32.add (local.get $p) (i32.shl (local.get $j) (i32.const 2)))))
            (else (f32.convert_i32_u (i32.load (local.get $p))))))
          (call $gs32 (i32.add (local.get $v) (i32.shl (local.get $j) (i32.const 2)))
            (if (result i32) (i32.eq (local.get $op) (i32.const 13))
              (then (i32.reinterpret_f32 (local.get $value)))
              (else (if (result i32) (i32.eq (local.get $n) (i32.const 1))
                (then (i32.load (local.get $p)))
                (else (if (result i32) (i32.eq (local.get $a) (i32.const 0x0B04))
                  (then (i32.trunc_sat_f64_s (f64.nearest (f64.mul
                    (f64.promote_f32 (local.get $value)) (f64.const 2147483647)))))
                  (else (i32.trunc_sat_f32_s (f32.nearest (local.get $value))))))))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $query (i32.lt_u (local.get $j) (local.get $n))))
        (return (i32.const 1))))))
    (i32.const 0))

  ;; Per-context, per-unit texgen: enables, four modes, object and eye planes.
  (func $gl_raster_texgen_init (param $ctx i32)
    (local $u i32) (local $i i32) (local $p i32)
    (loop $units
      (local.set $p (i32.add (local.get $ctx) (i32.add (i32.const 384) (i32.mul (local.get $u) (i32.const 148)))))
      (local.set $i (i32.const 0))
      (loop $coords
        (i32.store (i32.add (local.get $p) (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2)))) (i32.const 0x2400))
        ;; Default S=x, T=y; R and Q planes are zero.
        (if (i32.lt_u (local.get $i) (i32.const 2)) (then
          (f32.store (i32.add (local.get $p) (i32.add (i32.const 20) (i32.mul (local.get $i) (i32.const 20)))) (f32.const 1))
          (f32.store (i32.add (local.get $p) (i32.add (i32.const 84) (i32.mul (local.get $i) (i32.const 20)))) (f32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $coords (i32.lt_u (local.get $i) (i32.const 4))))
      (local.set $u (i32.add (local.get $u) (i32.const 1)))
      (br_if $units (i32.lt_u (local.get $u) (i32.const 2)))))

  ;; Solve modelview^T * result = supplied plane using pivoted f64
  ;; elimination. This handles non-affine matrices as well as translations.
  ;; Singular matrices leave the plane undefined, as the GL specification does.
  (func $gl_raster_eye_plane (param $b i32) (param $dst i32) (param $p i32)
    (local $a i32) (local $m i32) (local $row i32) (local $col i32)
    (local $k i32) (local $pivot i32) (local $i i32) (local $j i32)
    (local $ar i32) (local $ak i32) (local $v f64) (local $n f64) (local $t f64)
    (local.set $a (call $gl_list_alloc (i32.const 160)))
    (if (i32.eqz (local.get $a)) (then
      (call $gl_list_error (call $gl_list_context) (i32.const 0x505)) (return)))
    (local.set $m (call $gl_mtx_stack_top (local.get $b) (i32.const 0)))
    (loop $rows
      (local.set $col (i32.const 0))
      (local.set $ar (i32.add (local.get $a) (i32.mul (local.get $row) (i32.const 40))))
      (loop $cols
        (f64.store (i32.add (local.get $ar) (i32.shl (local.get $col) (i32.const 3)))
          (f64.promote_f32 (f32.load (i32.add (local.get $m)
            (i32.shl (i32.add (i32.shl (local.get $row) (i32.const 2)) (local.get $col)) (i32.const 2))))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br_if $cols (i32.lt_u (local.get $col) (i32.const 4))))
      (f64.store offset=32 (local.get $ar) (f64.promote_f32
        (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $p) (i32.shl (local.get $row) (i32.const 2)))))))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $row) (i32.const 4))))
    (block $singular
      (loop $eliminate
        (local.set $pivot (local.get $k)) (local.set $i (local.get $k)) (local.set $n (f64.const 0))
        (loop $find
          (local.set $v (f64.abs (f64.load (i32.add (local.get $a)
            (i32.add (i32.mul (local.get $i) (i32.const 40)) (i32.shl (local.get $k) (i32.const 3)))))))
          (if (f64.gt (local.get $v) (local.get $n)) (then (local.set $pivot (local.get $i)) (local.set $n (local.get $v))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $find (i32.lt_u (local.get $i) (i32.const 4))))
        (br_if $singular (f64.eq (local.get $n) (f64.const 0)))
        (local.set $ak (i32.add (local.get $a) (i32.mul (local.get $k) (i32.const 40))))
        (local.set $ar (i32.add (local.get $a) (i32.mul (local.get $pivot) (i32.const 40))))
        (local.set $j (i32.const 0))
        (loop $swap
          (local.set $t (f64.load (i32.add (local.get $ak) (local.get $j))))
          (f64.store (i32.add (local.get $ak) (local.get $j)) (f64.load (i32.add (local.get $ar) (local.get $j))))
          (f64.store (i32.add (local.get $ar) (local.get $j)) (local.get $t))
          (local.set $j (i32.add (local.get $j) (i32.const 8)))
          (br_if $swap (i32.lt_u (local.get $j) (i32.const 40))))
        (local.set $n (f64.load (i32.add (local.get $ak) (i32.shl (local.get $k) (i32.const 3)))))
        (local.set $j (i32.const 0))
        (loop $normalize
          (f64.store (i32.add (local.get $ak) (local.get $j))
            (f64.div (f64.load (i32.add (local.get $ak) (local.get $j))) (local.get $n)))
          (local.set $j (i32.add (local.get $j) (i32.const 8)))
          (br_if $normalize (i32.lt_u (local.get $j) (i32.const 40))))
        (local.set $i (i32.const 0))
        (loop $reduce
          (if (i32.ne (local.get $i) (local.get $k)) (then
            (local.set $ar (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 40))))
            (local.set $v (f64.load (i32.add (local.get $ar) (i32.shl (local.get $k) (i32.const 3)))))
            (local.set $j (i32.const 0))
            (loop $subtract
              (f64.store (i32.add (local.get $ar) (local.get $j))
                (f64.sub (f64.load (i32.add (local.get $ar) (local.get $j)))
                  (f64.mul (local.get $v) (f64.load (i32.add (local.get $ak) (local.get $j))))))
              (local.set $j (i32.add (local.get $j) (i32.const 8)))
              (br_if $subtract (i32.lt_u (local.get $j) (i32.const 40))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $reduce (i32.lt_u (local.get $i) (i32.const 4))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br_if $eliminate (i32.lt_u (local.get $k) (i32.const 4))))
      (local.set $i (i32.const 0))
      (loop $result
        (f32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
          (f32.demote_f64 (f64.load (i32.add (local.get $a)
            (i32.add (i32.mul (local.get $i) (i32.const 40)) (i32.const 32))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $result (i32.lt_u (local.get $i) (i32.const 4)))))
    (call $heap_free (call $w2g (local.get $a))))

  (func $gl_raster_texgen (param $ctx i32) (param $unit i32) (param $v i32)
      (param $vertex i32) (param $eye i32) (param $b i32)
    (local $p i32) (local $i i32) (local $mode i32) (local $plane i32)
    (local $light i32) (local $k i32) (local $sum f32) (local $point i32)
    (local.set $p (i32.add (local.get $ctx) (i32.add (i32.const 384) (i32.mul (local.get $unit) (i32.const 148)))))
    (loop $coords
      (if (i32.and (i32.load (local.get $p)) (i32.shl (i32.const 1) (local.get $i))) (then
        (local.set $mode (i32.load (i32.add (local.get $p) (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2))))))
        (if (i32.eq (local.get $mode) (i32.const 0x2402)) (then
          (local.set $light (global.get $gl_sw_light_block))
          (call $gl_sw_light_setup (local.get $b))
          ;; Use global evaluator scratch, leaving input and eye position intact.
          (call $gl_sw_sphere_evaluate (i32.add (local.get $ctx) (i32.const 680))
            (i32.add (global.get $gl_sw_scratch) (i32.const 0x700)) (i32.const 1))
          (global.set $gl_sw_light_block (local.get $light))
          (f32.store (i32.add (local.get $v) (i32.shl (local.get $i) (i32.const 2)))
            (f32.load (i32.add (global.get $gl_sw_scratch) (i32.add (i32.const 0x710) (i32.shl (local.get $i) (i32.const 2)))))))
        (else
          (local.set $point (select (local.get $eye) (local.get $vertex) (i32.eq (local.get $mode) (i32.const 0x2400))))
          (local.set $plane (i32.add (local.get $p) (i32.add
            (select (i32.const 84) (i32.const 20) (i32.eq (local.get $mode) (i32.const 0x2400)))
            (i32.shl (local.get $i) (i32.const 4)))))
          (local.set $sum (f32.const 0)) (local.set $k (i32.const 0))
          (loop $dot
            (local.set $sum (f32.add (local.get $sum)
              (f32.mul (f32.load (i32.add (local.get $plane) (i32.shl (local.get $k) (i32.const 2))))
                (if (result f32) (i32.and (i32.eq (local.get $mode) (i32.const 0x2401)) (i32.eq (local.get $k) (i32.const 3)))
                  (then (f32.load offset=56 (local.get $vertex)))
                  (else (f32.load (i32.add (local.get $point) (i32.shl (local.get $k) (i32.const 2)))))))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br_if $dot (i32.lt_u (local.get $k) (i32.const 4))))
          (f32.store (i32.add (local.get $v) (i32.shl (local.get $i) (i32.const 2))) (local.get $sum))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $coords (i32.lt_u (local.get $i) (i32.const 4)))))

  (func $gl_raster_texgen_state (param $ctx i32) (param $op i32) (param $stack i32)
    (local $coord i32) (local $pname i32) (local $p i32) (local $mode i32) (local $src i32) (local $i i32)
    (if (i32.eqz (i32.or
        (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10)))
        (i32.lt_u (i32.sub (local.get $op) (i32.const 83)) (i32.const 3)))) (then (return)))
    (local.set $coord (i32.load offset=4 (local.get $stack)))
    (local.set $p (i32.add (local.get $ctx) (i32.add (i32.const 384)
      (i32.mul (i32.load offset=4 (call $gl_mtx_block)) (i32.const 148)))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10))) (then
      (local.set $coord (i32.sub (local.get $coord) (i32.const 0xc60)))
      (if (i32.lt_u (local.get $coord) (i32.const 4)) (then
        (local.set $mode (i32.shl (i32.const 1) (local.get $coord)))
        (i32.store (local.get $p) (if (result i32) (i32.eq (local.get $op) (i32.const 10))
          (then (i32.or (i32.load (local.get $p)) (local.get $mode)))
          (else (i32.and (i32.load (local.get $p)) (i32.xor (local.get $mode) (i32.const -1)))))))) (return)))
    (local.set $pname (i32.load offset=8 (local.get $stack)))
    (local.set $coord (i32.sub (local.get $coord) (i32.const 0x2000)))
    (if (i32.ge_u (local.get $coord) (i32.const 4)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x2500)) (then
      (if (i32.eq (local.get $op) (i32.const 85)) (then
        (call $gl_texcoord_check (i32.load offset=12 (local.get $stack)) (i32.const 4))))
      (local.set $mode (if (result i32) (i32.eq (local.get $op) (i32.const 83))
        (then (i32.load offset=12 (local.get $stack)))
        (else (i32.trunc_sat_f32_s (if (result f32) (i32.eq (local.get $op) (i32.const 84))
          (then (f32.load offset=12 (local.get $stack)))
          (else (f32.reinterpret_i32 (call $gl32 (i32.load offset=12 (local.get $stack))))))))))
      (if (i32.or (i32.gt_u (i32.sub (local.get $mode) (i32.const 0x2400)) (i32.const 2))
          (i32.and (i32.eq (local.get $mode) (i32.const 0x2402)) (i32.ge_u (local.get $coord) (i32.const 2)))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return)))
      (i32.store (i32.add (local.get $p) (i32.add (i32.const 4) (i32.shl (local.get $coord) (i32.const 2)))) (local.get $mode)) (return)))
    (if (i32.or (i32.ne (local.get $op) (i32.const 85))
        (i32.gt_u (i32.sub (local.get $pname) (i32.const 0x2501)) (i32.const 1))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return)))
    (local.set $src (i32.load offset=12 (local.get $stack)))
    (call $gl_texcoord_check (local.get $src) (i32.const 16))
    (local.set $p (i32.add (local.get $p) (i32.add
      (select (i32.const 84) (i32.const 20) (i32.eq (local.get $pname) (i32.const 0x2502)))
      (i32.shl (local.get $coord) (i32.const 4)))))
    (if (i32.eq (local.get $pname) (i32.const 0x2502))
      (then (call $gl_raster_eye_plane (call $gl_mtx_block) (local.get $p) (local.get $src)))
      (else (call $gl_copy_from_guest (local.get $p) (local.get $src) (i32.const 16)))))

  ;; Validate all texgen variants before list capture or any observer. An enum
  ;; rejection must not dereference an irrelevant plane pointer or record data.
  (func $gl_texgen_validate (param $ctx i32) (param $op i32) (param $stack i32) (result i32)
    (local $coord i32) (local $name i32) (local $n i32) (local $raw i32) (local $v f64)
    (if (i32.ge_u (i32.sub (local.get $op) (i32.const 83)) (i32.const 3))
      (then (return (i32.const 0))))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $coord (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x2000)))
    (local.set $name (i32.load offset=8 (local.get $stack)))
    (local.set $n (call $gl_texgen_count (local.get $name)))
    (if (i32.or (i32.ge_u (local.get $coord) (i32.const 4))
        (i32.or (i32.eqz (local.get $n)) (i32.and (i32.ne (local.get $op) (i32.const 85)) (i32.ne (local.get $n) (i32.const 1))))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (local.set $raw (i32.load offset=12 (local.get $stack)))
    (if (i32.eq (local.get $op) (i32.const 85)) (then
      (call $gl_texcoord_check (local.get $raw) (i32.shl (local.get $n) (i32.const 2)))
      (local.set $raw (call $gl32 (local.get $raw)))))
    (if (i32.eq (local.get $n) (i32.const 1)) (then
      (local.set $v (if (result f64) (i32.eq (local.get $op) (i32.const 83))
        (then (f64.convert_i32_s (local.get $raw)))
        (else (f64.promote_f32 (f32.reinterpret_i32 (local.get $raw))))))
      (if (i32.eqz (i32.or (i32.or (f64.eq (local.get $v) (f64.const 9216)) (f64.eq (local.get $v) (f64.const 9217)))
          (i32.and (f64.eq (local.get $v) (f64.const 9218)) (i32.lt_u (local.get $coord) (i32.const 2))))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))))
    (i32.const 0))

(func $gl_pixels_stencil_draw (param $start i32) (param $count i32)
 (local $rt i32) (local $view i32) (local $dx i32) (local $dy i32)
 (local $w i32) (local $h i32) (local $mask i32) (local $i i32) (local $v i32)
 (local $x i32) (local $y i32) (local $p i32)
 (if (i32.eqz (call $gl_sw_target)) (then (return)))
 (call $d3dim_worker_fence)
 (if (i32.eqz (call $gl_stencil_ensure)) (then (return)))
 (local.set $rt (global.get $gl_sw_rt)) (local.set $view (local.get $rt))
 (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 32)) (then
   (local.set $view (call $gl_sw_scissor_view))
   (if (i32.eqz (local.get $view)) (then (return)))
   (if (i32.ne (local.get $view) (local.get $rt)) (then
     (local.set $dx (global.get $gl_sw_sc_x)) (local.set $dy (global.get $gl_sw_sc_y))))))
 (local.set $w (load.field DxObject width (local.get $view)))
 (local.set $h (load.field DxObject height (local.get $view)))
 (local.set $mask (i32.and (i32.load offset=16 (call $gl_stencil_state)) (i32.const 255)))
 (block $done (loop $pixels
   (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
   (local.set $v (i32.add (i32.add (local.get $start) (i32.const 32)) (i32.mul (local.get $i) (i32.const 76))))
   (local.set $x (i32.trunc_sat_f32_s (f32.load (local.get $v))))
   (local.set $y (i32.trunc_sat_f32_s (f32.load offset=4 (local.get $v))))
   (if (global.get $gl_sw_flip_y) (then
     (local.set $y (i32.sub (i32.sub (load.field DxObject height (local.get $rt)) (i32.const 1)) (local.get $y)))))
   (if (i32.and (i32.lt_u (i32.sub (local.get $x) (local.get $dx)) (local.get $w))
       (i32.lt_u (i32.sub (local.get $y) (local.get $dy)) (local.get $h))) (then
     (local.set $p (i32.add (global.get $gl_stencil_pixels)
       (i32.add (i32.mul (local.get $y) (global.get $gl_stencil_pitch)) (local.get $x))))
     (i32.store8 (local.get $p) (i32.or
       (i32.and (i32.load8_u (local.get $p)) (i32.xor (local.get $mask) (i32.const 255)))
       (i32.and (i32.trunc_sat_f32_u (f32.load offset=12 (local.get $v))) (local.get $mask))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $pixels))))
