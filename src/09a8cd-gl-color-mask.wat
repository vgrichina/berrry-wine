  ;; Four RGBA enable bits in context +228; workers copy the value, never
  ;; borrow the mutable context. The shared D3DIM span defaults to all writes.
  (global $gl_color_mask_worker (mut i32) (i32.const 15))
  (global $rast_color_mask (mut i32) (i32.const -1))

  (func $gl_color_mask (result i32)
    (local $ctx i32)
    (if (global.get $gl_sw_in_worker) (then (return (global.get $gl_color_mask_worker))))
    (local.set $ctx (call $gl_list_context))
    (if (result i32) (local.get $ctx)
      (then (i32.load offset=228 (local.get $ctx))) (else (i32.const 15))))

  (func $gl_color_mask_bits (param $rt i32) (result i32)
    (local $m i32) (local $bits i32)
    (local.set $m (call $gl_color_mask))
    (local.set $bits (i32.or
      (i32.or (select (i32.const 0x00ff0000) (i32.const 0) (i32.and (local.get $m) (i32.const 1)))
              (select (i32.const 0x0000ff00) (i32.const 0) (i32.and (local.get $m) (i32.const 2))))
      (i32.or (select (i32.const 0x000000ff) (i32.const 0) (i32.and (local.get $m) (i32.const 4)))
              (select (i32.const 0xff000000) (i32.const 0) (i32.and (local.get $m) (i32.const 8))))))
    (if (i32.eq (load.field DxObject bpp (local.get $rt)) (i32.const 16))
      (then (return (call $d3dim_encode_surface_pixel (local.get $rt) (local.get $bits) (i32.const 16)))))
    (local.get $bits))

  (func $gl_color_merge (param $old i32) (param $color i32) (param $mask i32) (result i32)
    (i32.or (i32.and (local.get $old) (i32.xor (local.get $mask) (i32.const -1)))
      (i32.and (local.get $color) (local.get $mask))))

  ;; Scissor views already provide the clipped pointer, pitch and dimensions.
  ;; Merge packed bits directly: disabled channels retain their exact value.
  (func $gl_color_clear (param $rt i32)
    (local $mask i32) (local $color i32) (local $bpp i32)
    (local $x i32) (local $y i32) (local $p i32) (local $row i32)
    (local.set $mask (call $gl_color_mask_bits (local.get $rt)))
    (if (i32.eqz (local.get $mask)) (then (return)))
    (local.set $bpp (load.field DxObject bpp (local.get $rt)))
    (local.set $color (global.get $gl_sw_clear_color))
    (if (i32.eq (local.get $bpp) (i32.const 16))
      (then (local.set $color (call $d3dim_encode_surface_pixel (local.get $rt) (local.get $color) (local.get $bpp)))))
    (block $done (loop $rows
      (br_if $done (i32.ge_u (local.get $y) (load.field DxObject height (local.get $rt))))
      (local.set $row (i32.add (load.field DxObject misc1 (local.get $rt))
        (i32.mul (local.get $y) (load.field DxObject pitch (local.get $rt)))))
      (local.set $x (i32.const 0))
      (block $endrow (loop $pixels
        (br_if $endrow (i32.ge_u (local.get $x) (load.field DxObject width (local.get $rt))))
        (local.set $p (i32.add (local.get $row) (i32.mul (local.get $x) (i32.shr_u (local.get $bpp) (i32.const 3)))))
        (if (i32.eq (local.get $bpp) (i32.const 32))
          (then (i32.store (local.get $p) (call $gl_color_merge (i32.load (local.get $p)) (local.get $color) (local.get $mask)))))
        (if (i32.eq (local.get $bpp) (i32.const 16))
          (then (i32.store16 (local.get $p) (call $gl_color_merge (i32.load16_u (local.get $p)) (local.get $color) (local.get $mask)))))
        (local.set $x (i32.add (local.get $x) (i32.const 1))) (br $pixels)))
      (local.set $y (i32.add (local.get $y) (i32.const 1))) (br $rows))))

  (func $gl_color_mask_intercept (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $i i32) (local $m i32) (local $v i32) (local $p i32)
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 140)) (then
      (loop $args
        ;; GLboolean occupies the low byte of each stdcall argument slot.
        (local.set $v (i32.ne (i32.load8_u (i32.add (local.get $stack)
          (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2))))) (i32.const 0)))
        (local.set $m (i32.or (local.get $m) (i32.shl (local.get $v) (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $args (i32.lt_u (local.get $i) (i32.const 4))))
      (i32.store offset=228 (local.get $ctx) (local.get $m))))
    (if (i32.and (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0xc23))
      (i32.or (i32.eq (local.get $op) (i32.const 13)) (i32.eq (local.get $op) (i32.const 103)))) (then
      (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
      (local.set $m (i32.load offset=228 (local.get $ctx)))
      (local.set $p (i32.load offset=8 (local.get $stack)))
      (loop $values
        (local.set $v (i32.and (i32.shr_u (local.get $m) (local.get $i)) (i32.const 1)))
        (call $gs32 (i32.add (local.get $p) (i32.shl (local.get $i) (i32.const 2)))
          (if (result i32) (i32.eq (local.get $op) (i32.const 13))
            (then (i32.reinterpret_f32 (f32.convert_i32_u (local.get $v)))) (else (local.get $v))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $values (i32.lt_u (local.get $i) (i32.const 4))))
      (return (i32.const 1))))
    (i32.const 0))
