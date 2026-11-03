  (func $gl_source_array (param $index i32) (param $stack i32) (result i32)
    (local $p i32) (local $bits i32) (local $stride i32) (local $tag i32)
    (if (i32.gt_u (i32.sub (global.get $gl_cp_type) (i32.const 0x1400)) (i32.const 5))
      (then (return (i32.const 0))))
    (local.set $stride (call $gl_array_type_bytes (global.get $gl_cp_type)))
    (local.set $bits (i32.shl (local.get $stride) (i32.const 3)))
    (local.set $tag (i32.or (local.get $bits) (i32.or
      (select (i32.const 256) (i32.const 0) (i32.eqz (i32.and (global.get $gl_cp_type) (i32.const 1))))
      (select (i32.const 512) (i32.const 0) (i32.eq (global.get $gl_cp_size) (i32.const 3))))))
    (local.set $p (call $gl_array_addr (global.get $gl_cp_guest) (global.get $gl_cp_size)
      (global.get $gl_cp_type) (global.get $gl_cp_stride) (local.get $index)))
    (i32.store offset=4 (local.get $stack) (local.get $tag))
    (i32.store offset=8 (local.get $stack) (call $gl_source_load (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 0))) (local.get $bits)))
    (i32.store offset=12 (local.get $stack) (call $gl_source_load (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 1))) (local.get $bits)))
    (i32.store offset=16 (local.get $stack) (call $gl_source_load (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 2))) (local.get $bits)))
    (i32.store offset=20 (local.get $stack) (if (result i32) (i32.eq (global.get $gl_cp_size) (i32.const 4)) (then (call $gl_source_load (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 3))) (local.get $bits))) (else (i32.const 0))))
    (i32.const 1))
  ;; OpenGL current attributes and client-array frontend. Kept separate from
  ;; record transport so the byte-stream encoder remains mechanically small.
  ;; $gl_state_intercept returns 1 when the call was fully consumed here.

  ;; Linked context nodes are { key, next, state }. Both nodes and state live
  ;; for the process lifetime, matching JS Map identity without a slot ceiling.
  ;; Saved attributes follow a context when it moves between producers.
  (global $gl_state_free_contexts (mut i32) (i32.const 0))
  (global $gl_state_attrib_head (mut i32) (i32.const 0))
  (global $gl_state_attrib_depth (mut i32) (i32.const 0))
  (global $gl_state_pointer_bits (mut i32) (i32.const 0))

  (func $gl_state_slot (param $context i32) (param $create i32) (result i32)
    (local $p i32) (local $guest i32) (local $state i32)
    (local.set $p (i32.atomic.load (region.addr $GL_MTX_BLOCKS 12)))
    (block $scan_done
      (loop $scan
        (br_if $scan_done (i32.eqz (local.get $p)))
        (if (i32.eq (i32.load (local.get $p)) (local.get $context))
          (then (return (i32.load offset=8 (local.get $p)))))
        (local.set $p (i32.load offset=4 (local.get $p)))
        (br $scan)))
    (if (i32.eqz (local.get $create)) (then (return (i32.const 0))))
    (local.set $p (global.get $gl_state_free_contexts))
    (if (local.get $p)
      (then
        (global.set $gl_state_free_contexts (i32.load offset=4 (local.get $p)))
        (local.set $state (i32.load offset=8 (local.get $p))))
      (else
        (local.set $guest (call $heap_alloc (i32.const 16)))
        (if (i32.eqz (local.get $guest)) (then (unreachable)))
        (local.set $p (call $g2w (local.get $guest)))
        (local.set $guest (call $heap_alloc (i32.const 392)))
        (if (i32.eqz (local.get $guest)) (then
          (call $heap_free (call $w2g (local.get $p))) (unreachable)))
        (local.set $state (call $g2w (local.get $guest)))))
    (memory.fill (local.get $state) (i32.const 0) (i32.const 392))
    (i32.store (local.get $p) (local.get $context))
    (i32.store offset=12 (local.get $p) (global.get $current_thread_id))
    (i32.store offset=4 (local.get $p) (i32.atomic.load (region.addr $GL_MTX_BLOCKS 12)))
    (i32.store offset=8 (local.get $p) (local.get $state))
    (i32.atomic.store (region.addr $GL_MTX_BLOCKS 12) (local.get $p))
    (local.get $state))

  ;; Keep the committed primitive snapshot intact through Begin/End. A second
  ;; value-only half publishes legal completed setters for foreign copy reads;
  ;; +196 is its active flag, never a client or resource pointer.
  (func $gl_state_publish (param $context i32)
    (local $p i32)
    (if (i32.eqz (local.get $context)) (then (return)))
    (local.set $p (call $gl_state_slot (local.get $context) (i32.const 1)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (i32.store offset=196 (local.get $p) (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)))
    (if (i32.load offset=196 (local.get $p))
      (then (local.set $p (i32.add (local.get $p) (i32.const 196)))))
    (call $gl_state_publish_to (local.get $p)))

  ;; All fields below are server values; geometry/client arrays/stack identity
  ;; are written only by their existing context-switch or immutable draw paths.
  (func $gl_state_publish_to (param $p i32)
    (call $gl_source_save (i32.add (local.get $p) (i32.const 176)))
    (f32.store offset=4 (local.get $p) (global.get $gl_color_r))
    (f32.store offset=8 (local.get $p) (global.get $gl_color_g))
    (f32.store offset=12 (local.get $p) (global.get $gl_color_b))
    (f32.store offset=16 (local.get $p) (global.get $gl_color_a))
    (f32.store offset=20 (local.get $p) (global.get $gl_tex_s))
    (f32.store offset=24 (local.get $p) (global.get $gl_tex_t))
    (f32.store offset=28 (local.get $p) (global.get $gl_normal_x))
    (f32.store offset=32 (local.get $p) (global.get $gl_normal_y))
    (f32.store offset=36 (local.get $p) (global.get $gl_normal_z))
    (f32.store offset=40 (local.get $p) (global.get $gl_tex1_s))
    (f32.store offset=44 (local.get $p) (global.get $gl_tex1_t))
    (i32.store offset=48 (local.get $p) (global.get $gl_shade_model))
    (f32.store offset=148 (local.get $p) (global.get $gl_tex_r))
    (f32.store offset=152 (local.get $p) (global.get $gl_tex_q))
    (f32.store offset=156 (local.get $p) (global.get $gl_tex1_r))
    (f32.store offset=160 (local.get $p) (global.get $gl_tex1_q)))

  ;; Context switches additionally transfer client and stack ownership.
  (func $gl_state_save (param $context i32)
    (local $p i32)
    (if (i32.eqz (local.get $context)) (then (return)))
    (call $gl_state_publish (local.get $context))
    (local.set $p (call $gl_state_slot (local.get $context) (i32.const 0)))
    (call $gl_state_publish_to (local.get $p))
    (i32.store offset=196 (local.get $p) (i32.const 0))
    (i32.store offset=52 (local.get $p) (global.get $gl_client_bits))
    (i32.store offset=56 (local.get $p) (global.get $gl_client_tex_unit))
    (i32.store offset=60 (local.get $p) (global.get $gl_vp_size))
    (i32.store offset=64 (local.get $p) (global.get $gl_vp_type))
    (i32.store offset=68 (local.get $p) (global.get $gl_vp_stride))
    (i32.store offset=72 (local.get $p) (global.get $gl_vp_guest))
    (i32.store offset=76 (local.get $p) (global.get $gl_np_type))
    (i32.store offset=80 (local.get $p) (global.get $gl_np_stride))
    (i32.store offset=84 (local.get $p) (global.get $gl_np_guest))
    (i32.store offset=88 (local.get $p) (global.get $gl_cp_size))
    (i32.store offset=92 (local.get $p) (global.get $gl_cp_type))
    (i32.store offset=96 (local.get $p) (global.get $gl_cp_stride))
    (i32.store offset=100 (local.get $p) (global.get $gl_cp_guest))
    (i32.store offset=104 (local.get $p) (global.get $gl_tp0_size))
    (i32.store offset=108 (local.get $p) (global.get $gl_tp0_type))
    (i32.store offset=112 (local.get $p) (global.get $gl_tp0_stride))
    (i32.store offset=116 (local.get $p) (global.get $gl_tp0_guest))
    (i32.store offset=120 (local.get $p) (global.get $gl_tp1_size))
    (i32.store offset=124 (local.get $p) (global.get $gl_tp1_type))
    (i32.store offset=128 (local.get $p) (global.get $gl_tp1_stride))
    (i32.store offset=132 (local.get $p) (global.get $gl_tp1_guest))
    (i32.store offset=136 (local.get $p) (global.get $gl_state_attrib_head))
    (i32.store offset=140 (local.get $p) (global.get $gl_state_attrib_depth))
    (i32.store offset=144 (local.get $p) (global.get $gl_state_pointer_bits)))

  (func $gl_native_query_count (param $p i32) (result i32)
    (if (i32.or (i32.eq (local.get $p) (i32.const 0x8038)) (i32.eq (local.get $p) (i32.const 0x2a00))) (then (return (i32.const 1))))
    (if (call $gl_hint_target (local.get $p)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $p) (i32.const 0xb40)) (then (return (i32.const 2))))
    (if (i32.le_u (i32.sub (local.get $p) (i32.const 0xb55)) (i32.const 2)) (then (return (i32.const 1))))
    (if (i32.or (i32.le_u (i32.sub (local.get $p) (i32.const 0xbf0)) (i32.const 2))
        (i32.eq (local.get $p) (i32.const 0xbd0))) (then (return (i32.const 1))))
    (if (call $gl_client_cap_bit (local.get $p)) (then (return (i32.const 1))))
    (if (i32.or (i32.le_u (i32.sub (local.get $p) (i32.const 0xb24)) (i32.const 2))
        (i32.eq (local.get $p) (i32.const 0xb42))) (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $p) (i32.const 0xd16)) (i32.const 1)) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $p) (i32.const 0xd34))
        (i32.le_u (i32.sub (local.get $p) (i32.const 0xcb0)) (i32.const 9))) (then (return (i32.const 1))))
    (if (i32.or (call $gl_transfer_valid (local.get $p))
        (i32.le_u (i32.sub (local.get $p) (i32.const 0xd00)) (i32.const 5)))
      (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $p) (i32.const 0xde0))
      (i32.or (i32.eq (local.get $p) (i32.const 0x8068)) (i32.eq (local.get $p) (i32.const 0xcf0)))) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $p) (i32.const 0xd32))
        (i32.lt_u (i32.sub (local.get $p) (i32.const 0x3000)) (i32.const 6)))
      (then (return (i32.const 1))))
    (if (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xb51)) (i32.eq (local.get $p) (i32.const 0xb52))) (i32.eq (local.get $p) (i32.const 0xb61))) (then (return (i32.const 1))))
    (if (i32.eq (local.get $p) (i32.const 0xb06)) (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $p) (i32.const 0xb05))
        (i32.eq (local.get $p) (i32.const 0xb09))) (then (return (i32.const 1))))
    (if (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xba0)) (i32.eq (local.get $p) (i32.const 0x84e0))) (i32.eq (local.get $p) (i32.const 0x84e1))) (i32.eq (local.get $p) (i32.const 0xba3))) (i32.eq (local.get $p) (i32.const 0xba4))) (i32.eq (local.get $p) (i32.const 0xba5))) (i32.eq (local.get $p) (i32.const 0xd31))) (i32.eq (local.get $p) (i32.const 0x84e2))) (i32.eq (local.get $p) (i32.const 0xd36))) (i32.eq (local.get $p) (i32.const 0xd38))) (i32.eq (local.get $p) (i32.const 0xd39))) (i32.eq (local.get $p) (i32.const 0xd35))) (i32.eq (local.get $p) (i32.const 0xd3b))) (i32.eq (local.get $p) (i32.const 0xb31))) (i32.eq (local.get $p) (i32.const 0xbb0))) (i32.eq (local.get $p) (i32.const 0xbb1))) (i32.eq (local.get $p) (i32.const 0xb54))) (i32.eq (local.get $p) (i32.const 0xb30))) (i32.eq (local.get $p) (i32.const 0xb33))) (i32.eq (local.get $p) (i32.const 0xb65))) (i32.eq (local.get $p) (i32.const 0xb62))) (i32.eq (local.get $p) (i32.const 0xb63))) (i32.eq (local.get $p) (i32.const 0xb64))) (i32.eq (local.get $p) (i32.const 0xb08))) (i32.eq (local.get $p) (i32.const 0xb32))) (i32.eq (local.get $p) (i32.const 0xcf5))) (i32.eq (local.get $p) (i32.const 0xcf2))) (i32.eq (local.get $p) (i32.const 0xcf3))) (i32.eq (local.get $p) (i32.const 0xcf4))) (i32.eq (local.get $p) (i32.const 0xcf1))) (i32.eq (local.get $p) (i32.const 0xb90))) (i32.eq (local.get $p) (i32.const 0xb91))) (i32.eq (local.get $p) (i32.const 0xb92))) (i32.eq (local.get $p) (i32.const 0xb93))) (i32.eq (local.get $p) (i32.const 0xb94))) (i32.eq (local.get $p) (i32.const 0xb95))) (i32.eq (local.get $p) (i32.const 0xb96))) (i32.eq (local.get $p) (i32.const 0xb97))) (i32.eq (local.get $p) (i32.const 0xb98))) (i32.eq (local.get $p) (i32.const 0xd57))) (i32.eq (local.get $p) (i32.const 0xd58))) (i32.eq (local.get $p) (i32.const 0xd59))) (i32.eq (local.get $p) (i32.const 0xd5a))) (i32.eq (local.get $p) (i32.const 0xd5b))) (i32.eq (local.get $p) (i32.const 0x807a))) (i32.eq (local.get $p) (i32.const 0x8081))) (i32.eq (local.get $p) (i32.const 0x807b))) (i32.eq (local.get $p) (i32.const 0x807c))) (i32.eq (local.get $p) (i32.const 0x807e))) (i32.eq (local.get $p) (i32.const 0x807f))) (i32.eq (local.get $p) (i32.const 0x8082))) (i32.eq (local.get $p) (i32.const 0x8083))) (i32.eq (local.get $p) (i32.const 0x8088))) (i32.eq (local.get $p) (i32.const 0x8089))) (i32.eq (local.get $p) (i32.const 0x808a))) (i32.eq (local.get $p) (i32.const 0x8074))) (i32.eq (local.get $p) (i32.const 0x8075))) (i32.eq (local.get $p) (i32.const 0x8076))) (i32.eq (local.get $p) (i32.const 0x8078))) (then (return (i32.const 1))))
    (if (i32.eq (local.get $p) (i32.const 0xb70)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $p) (i32.const 0xb02)) (then (return (i32.const 3))))
    (if (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xb00)) (i32.eq (local.get $p) (i32.const 0xb03))) (i32.eq (local.get $p) (i32.const 0xb66))) (i32.eq (local.get $p) (i32.const 0xb53))) (i32.eq (local.get $p) (i32.const 0xba2))) (i32.eq (local.get $p) (i32.const 0xb07))) (i32.eq (local.get $p) (i32.const 0xb04))) (i32.eq (local.get $p) (i32.const 0xc23))) (i32.eq (local.get $p) (i32.const 0xb80))) (then (return (i32.const 4))))
    (if (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xba6)) (i32.eq (local.get $p) (i32.const 0xba7))) (i32.eq (local.get $p) (i32.const 0xba8))) (then (return (i32.const 16))))
    (if (global.get $gl_sw_enabled) (then
    (if (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xc01)) (i32.eq (local.get $p) (i32.const 0xc02))) (i32.eq (local.get $p) (i32.const 0x8069))) (i32.eq (local.get $p) (i32.const 0xb11))) (i32.eq (local.get $p) (i32.const 0xb21))) (i32.eq (local.get $p) (i32.const 0xb45))) (i32.eq (local.get $p) (i32.const 0xb46))) (i32.eq (local.get $p) (i32.const 0xbe1))) (i32.eq (local.get $p) (i32.const 0xbe0))) (i32.eq (local.get $p) (i32.const 0xbc1))) (i32.eq (local.get $p) (i32.const 0xb74))) (i32.eq (local.get $p) (i32.const 0xb72))) (i32.eq (local.get $p) (i32.const 0xbe2))) (i32.eq (local.get $p) (i32.const 0xbc0))) (i32.eq (local.get $p) (i32.const 0xb71))) (i32.eq (local.get $p) (i32.const 0xb44))) (i32.eq (local.get $p) (i32.const 0xc11))) (i32.eq (local.get $p) (i32.const 0xb60))) (i32.eq (local.get $p) (i32.const 0xb50))) (i32.eq (local.get $p) (i32.const 0xb57))) (i32.eq (local.get $p) (i32.const 0x4000))) (i32.eq (local.get $p) (i32.const 0x4001))) (i32.eq (local.get $p) (i32.const 0x4002))) (i32.eq (local.get $p) (i32.const 0x4003))) (i32.eq (local.get $p) (i32.const 0x4004))) (i32.eq (local.get $p) (i32.const 0x4005))) (i32.eq (local.get $p) (i32.const 0x4006))) (i32.eq (local.get $p) (i32.const 0x4007))) (i32.eq (local.get $p) (i32.const 0xde1))) (i32.eq (local.get $p) (i32.const 0xd52))) (i32.eq (local.get $p) (i32.const 0xd53))) (i32.eq (local.get $p) (i32.const 0xd54))) (i32.eq (local.get $p) (i32.const 0xd55))) (i32.eq (local.get $p) (i32.const 0xd56))) (i32.eq (local.get $p) (i32.const 0xc31))) (i32.eq (local.get $p) (i32.const 0xc33))) (i32.eq (local.get $p) (i32.const 0xc00))) (i32.eq (local.get $p) (i32.const 0xc32))) (then (return (i32.const 1))))
    (if (i32.eq (local.get $p) (i32.const 0xc10)) (then (return (i32.const 4))))
    ))
    (i32.const 0))

  (func $gl_native_query_value (param $p i32) (param $i i32) (result f64)
    (if (i32.eq (local.get $p) (i32.const 0x8038)) (then (return (f64.promote_f32 (f32.load offset=4124 (global.get $gl_sw_st))))))
    (if (i32.eq (local.get $p) (i32.const 0x2a00)) (then (return (f64.promote_f32 (f32.load offset=4128 (global.get $gl_sw_st))))))
    (if (call $gl_hint_target (local.get $p)) (then
      (return (f64.convert_i32_u (i32.load (call $gl_hint_ptr (call $gl_list_context) (local.get $p)))))))
    (if (i32.eq (local.get $p) (i32.const 0xb40)) (then
      (return (f64.convert_i32_u (i32.load (i32.add (global.get $gl_sw_st)
        (i32.add (i32.const 4108) (i32.shl (local.get $i) (i32.const 2)))))))))
    (if (i32.le_u (i32.sub (local.get $p) (i32.const 0xb55)) (i32.const 1)) (then
      (return (f64.convert_i32_u (i32.load (i32.add (global.get $gl_sw_st)
        (i32.add (i32.const 4116) (i32.shl (i32.sub (local.get $p) (i32.const 0xb55)) (i32.const 2)))))))))
    (if (i32.eq (local.get $p) (i32.const 0xb57)) (then
      (return (f64.convert_i32_u (i32.ne (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 0x10000)) (i32.const 0))))))
    (if (i32.eq (local.get $p) (i32.const 0xbf0))
      (then (return (f64.convert_i32_u (i32.load offset=4104 (global.get $gl_sw_st))))))
    (if (i32.or (i32.le_u (i32.sub (local.get $p) (i32.const 0xbf1)) (i32.const 1))
        (i32.eq (local.get $p) (i32.const 0xbd0))) (then
      (return (f64.convert_i32_u (i32.ne (i32.and (i32.load (global.get $gl_sw_st))
        (call $gl_sw_cap_bit (local.get $p))) (i32.const 0))))))
    (if (call $gl_client_cap_bit (local.get $p)) (then
      (return (f64.convert_i32_u (i32.ne (i32.and (global.get $gl_client_bits)
        (call $gl_client_cap_bit (local.get $p))) (i32.const 0))))))
    (if (i32.eq (local.get $p) (i32.const 0xb25)) (then (return (f64.convert_i32_u (i32.load offset=1796 (global.get $gl_sw_st))))))
    (if (i32.eq (local.get $p) (i32.const 0xb26)) (then (return (f64.convert_i32_u (i32.load offset=1792 (global.get $gl_sw_st))))))
    (if (i32.or (i32.eq (local.get $p) (i32.const 0xb24)) (i32.eq (local.get $p) (i32.const 0xb42)))
      (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load (global.get $gl_sw_st)) (call $gl_sw_cap_bit (local.get $p))) (i32.const 0))))))
    (if (i32.le_u (i32.sub (local.get $p) (i32.const 0xd16)) (i32.const 1)) (then
      (return (f64.promote_f32 (f32.load (i32.add (call $gl_texture_block)
        (i32.add (i32.const 300) (i32.shl (i32.sub (local.get $p) (i32.const 0xd16)) (i32.const 2)))))))))
    (if (i32.eq (local.get $p) (i32.const 0xd34)) (then (return (f64.const 256))))
    (if (i32.le_u (i32.sub (local.get $p) (i32.const 0xcb0)) (i32.const 9)) (then
      (return (f64.convert_i32_u (call $gl_pixel_map_size (i32.sub (local.get $p) (i32.const 0xcb0)))))))
    (if (call $gl_transfer_valid (local.get $p)) (then
      (return (if (result f64) (i32.lt_u (local.get $p) (i32.const 0xd14))
        (then (f64.convert_i32_s (i32.load (i32.add (call $gl_transfer_state)
          (i32.shl (i32.sub (local.get $p) (i32.const 0xd10)) (i32.const 2))))))
        (else (f64.promote_f32 (f32.load (i32.add (call $gl_transfer_state)
          (i32.shl (i32.sub (local.get $p) (i32.const 0xd10)) (i32.const 2))))))))))
    (if (i32.le_u (i32.sub (local.get $p) (i32.const 0xd00)) (i32.const 5)) (then
      (return (f64.convert_i32_s (i32.load (i32.add (call $gl_texture_block)
        (i32.add (i32.const 268) (i32.shl (i32.sub (local.get $p) (i32.const 0xd00)) (i32.const 2)))))))))
    (if (i32.eq (local.get $p) (i32.const 0xde0)) (then (return (f64.convert_i32_u
      (i32.and (i32.const 1) (i32.shr_u (i32.load offset=192 (call $gl_texture_block)) (i32.load offset=4 (call $gl_mtx_block))))))))
    (if (i32.eq (local.get $p) (i32.const 0x8068)) (then (return (f64.convert_i32_u
      (i32.load offset=4 (i32.load (call $gl_texture_binding (call $gl_texture_block) (i32.const 0xde0))))))))
    (if (i32.eq (local.get $p) (i32.const 0xcf0)) (then (return (f64.convert_i32_u
      (i32.load offset=196 (call $gl_texture_block))))))
    (if (i32.eq (local.get $p) (i32.const 0xd32)) (then (return (f64.const 6))))
    (if (i32.lt_u (i32.sub (local.get $p) (i32.const 0x3000)) (i32.const 6))
      (then (return (f64.convert_i32_u (call $gl_clip_enabled (i32.sub (local.get $p) (i32.const 0x3000)))))))
    (if (i32.eq (local.get $p) (i32.const 0xb51)) (then (return (f64.convert_i32_u (i32.load offset=11192 (call $gl_mtx_block))))))
    (if (i32.eq (local.get $p) (i32.const 0xb52)) (then (return (f64.convert_i32_u (i32.load offset=11196 (call $gl_mtx_block))))))
    (if (i32.eq (local.get $p) (i32.const 0xb61)) (then (return (f64.promote_f32 (f32.load offset=11200 (call $gl_mtx_block))))))
    (if (i32.eq (local.get $p) (i32.const 0xb06)) (then
      (return (f64.promote_f32 (f32.load (i32.add (call $gl_list_context)
        (i32.add (i32.const 272) (i32.add
          (i32.shl (i32.load offset=4 (call $gl_mtx_block)) (i32.const 4))
          (i32.shl (local.get $i) (i32.const 2))))))))))
    (if (i32.eq (local.get $p) (i32.const 0xb05)) (then (return (f64.const 1))))
    (if (i32.eq (local.get $p) (i32.const 0xb09)) (then
      (return (f64.promote_f32 (f32.load offset=264 (call $gl_list_context))))))
    ;; 0x0ba6 column-major matrix
    (if (i32.eq (local.get $p) (i32.const 0xba6)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_stack_top (call $gl_mtx_block) (i32.const 0)) (i32.add (i32.const 0) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0ba7 column-major matrix
    (if (i32.eq (local.get $p) (i32.const 0xba7)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_stack_top (call $gl_mtx_block) (i32.const 1)) (i32.add (i32.const 0) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0ba8 column-major matrix
    (if (i32.eq (local.get $p) (i32.const 0xba8)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_stack_top (call $gl_mtx_block) (i32.add (i32.const 2) (i32.load offset=4 (call $gl_mtx_block)))) (i32.add (i32.const 0) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0ba0
    (if (i32.eq (local.get $p) (i32.const 0xba0)) (then (return (f64.convert_i32_u (i32.load offset=0 (call $gl_mtx_block))))))
    ;; 0x84e0
    (if (i32.eq (local.get $p) (i32.const 0x84e0)) (then (return (f64.convert_i32_u (i32.add (i32.const 0x84c0) (i32.load offset=4 (call $gl_mtx_block)))))))
    ;; 0x84e1
    (if (i32.eq (local.get $p) (i32.const 0x84e1)) (then (return (f64.convert_i32_u (i32.add (i32.const 0x84c0) (global.get $gl_client_tex_unit))))))
    ;; 0x0ba3
    (if (i32.eq (local.get $p) (i32.const 0xba3)) (then (return (f64.convert_i32_u (i32.add (i32.const 1) (i32.load (call $gl_mtx_depth_addr (call $gl_mtx_block) (i32.const 0))))))))
    ;; 0x0ba4
    (if (i32.eq (local.get $p) (i32.const 0xba4)) (then (return (f64.convert_i32_u (i32.add (i32.const 1) (i32.load (call $gl_mtx_depth_addr (call $gl_mtx_block) (i32.const 1))))))))
    ;; 0x0ba5
    (if (i32.eq (local.get $p) (i32.const 0xba5)) (then (return (f64.convert_i32_u (i32.add (i32.const 1) (i32.load (call $gl_mtx_depth_addr (call $gl_mtx_block) (i32.add (i32.const 2) (i32.load offset=4 (call $gl_mtx_block))))))))))
    ;; 0x0d31
    (if (i32.eq (local.get $p) (i32.const 0xd31)) (then (return (f64.const 8))))
    ;; 0x84e2
    (if (i32.eq (local.get $p) (i32.const 0x84e2)) (then (return (f64.const 2))))
    ;; 0x0d36
    (if (i32.eq (local.get $p) (i32.const 0xd36)) (then (return (f64.const 32))))
    ;; 0x0d38
    (if (i32.eq (local.get $p) (i32.const 0xd38)) (then (return (f64.const 32))))
    ;; 0x0d39
    (if (i32.eq (local.get $p) (i32.const 0xd39)) (then (return (f64.const 32))))
    ;; 0x0d35
    (if (i32.eq (local.get $p) (i32.const 0xd35)) (then (return (f64.const 16))))
    ;; 0x0d3b
    (if (i32.eq (local.get $p) (i32.const 0xd3b)) (then (return (f64.const 16))))
    ;; 0x0b31
    (if (i32.eq (local.get $p) (i32.const 0xb31)) (then (return (f64.const 64))))
    ;; 0x0bb0
    (if (i32.eq (local.get $p) (i32.const 0xbb0)) (then (return (f64.convert_i32_u (i32.load offset=172 (call $gl_list_context))))))
    ;; 0x0bb1
    (if (i32.eq (local.get $p) (i32.const 0xbb1)) (then (return (f64.convert_i32_u (i32.load offset=180 (call $gl_list_context))))))
    ;; 0x0b00
    (if (i32.eq (local.get $p) (i32.const 0xb00)) (then (return (if (result f64) (i32.eq (local.get $i) (i32.const 3)) (then (f64.promote_f32 (global.get $gl_color_a))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 2)) (then (f64.promote_f32 (global.get $gl_color_b))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 1)) (then (f64.promote_f32 (global.get $gl_color_g))) (else (f64.promote_f32 (global.get $gl_color_r)))))))))))
    ;; 0x0b02
    (if (i32.eq (local.get $p) (i32.const 0xb02)) (then (return (if (result f64) (i32.eq (local.get $i) (i32.const 2)) (then (f64.promote_f32 (global.get $gl_normal_z))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 1)) (then (f64.promote_f32 (global.get $gl_normal_y))) (else (f64.promote_f32 (global.get $gl_normal_x)))))))))
    ;; 0x0b03
    (if (i32.eq (local.get $p) (i32.const 0xb03)) (then (return (if (result f64) (i32.eq (local.get $i) (i32.const 3)) (then (if (result f64) (i32.load offset=4 (call $gl_mtx_block)) (then (f64.promote_f32 (global.get $gl_tex1_q))) (else (f64.promote_f32 (global.get $gl_tex_q))))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 2)) (then (if (result f64) (i32.load offset=4 (call $gl_mtx_block)) (then (f64.promote_f32 (global.get $gl_tex1_r))) (else (f64.promote_f32 (global.get $gl_tex_r))))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 1)) (then (if (result f64) (i32.load offset=4 (call $gl_mtx_block)) (then (f64.promote_f32 (global.get $gl_tex1_t))) (else (f64.promote_f32 (global.get $gl_tex_t))))) (else (if (result f64) (i32.load offset=4 (call $gl_mtx_block)) (then (f64.promote_f32 (global.get $gl_tex1_s))) (else (f64.promote_f32 (global.get $gl_tex_s)))))))))))))
    ;; 0x0b54
    (if (i32.eq (local.get $p) (i32.const 0xb54)) (then (return (f64.convert_i32_u (global.get $gl_shade_model)))))
    ;; 0x0b30
    (if (i32.eq (local.get $p) (i32.const 0xb30)) (then (return (f64.convert_i32_u (if (result i32) (i32.load offset=12 (call $gl_list_context)) (then (i32.load offset=24 (call $gl_list_context))) (else (i32.const 0)))))))
    ;; 0x0b33
    (if (i32.eq (local.get $p) (i32.const 0xb33)) (then (return (f64.convert_i32_u (call $gl_query_list_index (call $gl_list_context))))))
    ;; 0x0b65
    (if (i32.eq (local.get $p) (i32.const 0xb65)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 8960) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b62
    (if (i32.eq (local.get $p) (i32.const 0xb62)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 8964) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b63
    (if (i32.eq (local.get $p) (i32.const 0xb63)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 8968) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b64
    (if (i32.eq (local.get $p) (i32.const 0xb64)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 8972) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b66
    (if (i32.eq (local.get $p) (i32.const 0xb66)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 8976) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b53
    (if (i32.eq (local.get $p) (i32.const 0xb53)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 8352) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0ba2
    (if (i32.eq (local.get $p) (i32.const 0xba2)) (then (return (if (result f64) (i32.load offset=168 (call $gl_list_context)) (then (f64.convert_i32_s (i32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 9008) (i32.shl (local.get $i) (i32.const 2))))))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 3)) (then (f64.convert_i32_u (global.get $gl_sw_default_h))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 2)) (then (f64.convert_i32_u (global.get $gl_sw_default_w))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 1)) (then (f64.const 0)) (else (f64.const 0))))))))))))
    ;; 0x0b70
    (if (i32.eq (local.get $p) (i32.const 0xb70)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_mtx_block) (i32.add (i32.const 9024) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b07
    (if (i32.eq (local.get $p) (i32.const 0xb07)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_list_context) (i32.add (i32.const 44) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b04
    (if (i32.eq (local.get $p) (i32.const 0xb04)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_list_context) (i32.add (i32.const 60) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b08
    (if (i32.eq (local.get $p) (i32.const 0xb08)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 40) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0b32
    (if (i32.eq (local.get $p) (i32.const 0xb32)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 100) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0cf5
    (if (i32.eq (local.get $p) (i32.const 0xcf5)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 80) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0cf2
    (if (i32.eq (local.get $p) (i32.const 0xcf2)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 84) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0cf3
    (if (i32.eq (local.get $p) (i32.const 0xcf3)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 88) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0cf4
    (if (i32.eq (local.get $p) (i32.const 0xcf4)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 92) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0cf1
    (if (i32.eq (local.get $p) (i32.const 0xcf1)) (then (return (f64.convert_i32_u (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 96) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0c23
    (if (i32.eq (local.get $p) (i32.const 0xc23)) (then (return (f64.convert_i32_u (i32.and (i32.shr_u (i32.load offset=228 (call $gl_list_context)) (local.get $i)) (i32.const 1))))))
    ;; 0x0b90
    (if (i32.eq (local.get $p) (i32.const 0xb90)) (then (return (f64.convert_i32_u (i32.load offset=192 (call $gl_list_context))))))
    ;; 0x0b91
    (if (i32.eq (local.get $p) (i32.const 0xb91)) (then (return (f64.convert_i32_u (i32.load offset=224 (call $gl_list_context))))))
    ;; 0x0b92
    (if (i32.eq (local.get $p) (i32.const 0xb92)) (then (return (f64.convert_i32_u (i32.load offset=196 (call $gl_list_context))))))
    ;; 0x0b93
    (if (i32.eq (local.get $p) (i32.const 0xb93)) (then (return (f64.convert_i32_u (i32.load offset=204 (call $gl_list_context))))))
    ;; 0x0b94
    (if (i32.eq (local.get $p) (i32.const 0xb94)) (then (return (f64.convert_i32_u (i32.load offset=212 (call $gl_list_context))))))
    ;; 0x0b95
    (if (i32.eq (local.get $p) (i32.const 0xb95)) (then (return (f64.convert_i32_u (i32.load offset=216 (call $gl_list_context))))))
    ;; 0x0b96
    (if (i32.eq (local.get $p) (i32.const 0xb96)) (then (return (f64.convert_i32_u (i32.load offset=220 (call $gl_list_context))))))
    ;; 0x0b97
    (if (i32.eq (local.get $p) (i32.const 0xb97)) (then (return (f64.convert_i32_u (i32.load offset=200 (call $gl_list_context))))))
    ;; 0x0b98
    (if (i32.eq (local.get $p) (i32.const 0xb98)) (then (return (f64.convert_i32_u (i32.load offset=208 (call $gl_list_context))))))
    ;; 0x0d57
    (if (i32.eq (local.get $p) (i32.const 0xd57)) (then (return (f64.const 8))))
    ;; 0x0b80
    (if (i32.eq (local.get $p) (i32.const 0xb80)) (then (return (f64.promote_f32 (f32.load (i32.add (call $gl_list_context) (i32.add (i32.const 248) (i32.shl (local.get $i) (i32.const 2)))))))))
    ;; 0x0d58
    (if (i32.eq (local.get $p) (i32.const 0xd58)) (then (return (f64.const 32))))
    ;; 0x0d59
    (if (i32.eq (local.get $p) (i32.const 0xd59)) (then (return (f64.const 32))))
    ;; 0x0d5a
    (if (i32.eq (local.get $p) (i32.const 0xd5a)) (then (return (f64.const 32))))
    ;; 0x0d5b
    (if (i32.eq (local.get $p) (i32.const 0xd5b)) (then (return (f64.const 32))))
    ;; 0x0c01
    (if (i32.eq (local.get $p) (i32.const 0xc01)) (then (return (f64.convert_i32_u (i32.load offset=232 (call $gl_list_context))))))
    ;; 0x0c02
    (if (i32.eq (local.get $p) (i32.const 0xc02)) (then (return (f64.convert_i32_u (i32.load offset=236 (call $gl_list_context))))))
    ;; 0x807a
    (if (i32.eq (local.get $p) (i32.const 0x807a)) (then (return (f64.convert_i32_u (global.get $gl_vp_size)))))
    ;; 0x8081
    (if (i32.eq (local.get $p) (i32.const 0x8081)) (then (return (f64.convert_i32_u (global.get $gl_cp_size)))))
    ;; 0x807b
    (if (i32.eq (local.get $p) (i32.const 0x807b)) (then (return (f64.convert_i32_u (global.get $gl_vp_type)))))
    ;; 0x807c
    (if (i32.eq (local.get $p) (i32.const 0x807c)) (then (return (f64.convert_i32_u (global.get $gl_vp_stride)))))
    ;; 0x807e
    (if (i32.eq (local.get $p) (i32.const 0x807e)) (then (return (f64.convert_i32_u (global.get $gl_np_type)))))
    ;; 0x807f
    (if (i32.eq (local.get $p) (i32.const 0x807f)) (then (return (f64.convert_i32_u (global.get $gl_np_stride)))))
    ;; 0x8082
    (if (i32.eq (local.get $p) (i32.const 0x8082)) (then (return (f64.convert_i32_u (global.get $gl_cp_type)))))
    ;; 0x8083
    (if (i32.eq (local.get $p) (i32.const 0x8083)) (then (return (f64.convert_i32_u (global.get $gl_cp_stride)))))
    ;; 0x8088
    (if (i32.eq (local.get $p) (i32.const 0x8088)) (then (return (if (result f64) (global.get $gl_client_tex_unit) (then (f64.convert_i32_u (global.get $gl_tp1_size))) (else (f64.convert_i32_u (global.get $gl_tp0_size)))))))
    ;; 0x8089
    (if (i32.eq (local.get $p) (i32.const 0x8089)) (then (return (if (result f64) (global.get $gl_client_tex_unit) (then (f64.convert_i32_u (global.get $gl_tp1_type))) (else (f64.convert_i32_u (global.get $gl_tp0_type)))))))
    ;; 0x808a
    (if (i32.eq (local.get $p) (i32.const 0x808a)) (then (return (if (result f64) (global.get $gl_client_tex_unit) (then (f64.convert_i32_u (global.get $gl_tp1_stride))) (else (f64.convert_i32_u (global.get $gl_tp0_stride)))))))
    ;; 0x8074
    (if (i32.eq (local.get $p) (i32.const 0x8074)) (then (return (f64.convert_i32_u (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 1)) (i32.const 0))))))
    ;; 0x8075
    (if (i32.eq (local.get $p) (i32.const 0x8075)) (then (return (f64.convert_i32_u (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 2)) (i32.const 0))))))
    ;; 0x8076
    (if (i32.eq (local.get $p) (i32.const 0x8076)) (then (return (f64.convert_i32_u (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 4)) (i32.const 0))))))
    ;; 0x8078
    (if (i32.eq (local.get $p) (i32.const 0x8078)) (then (return (f64.convert_i32_u (i32.ne (i32.and (global.get $gl_client_bits) (select (i32.const 16) (i32.const 8) (global.get $gl_client_tex_unit))) (i32.const 0))))))
    ;; 0x8069
    (if (i32.eq (local.get $p) (i32.const 0x8069)) (then (return (f64.convert_i32_u
      (i32.load offset=4 (i32.load (call $gl_texture_binding (call $gl_texture_block) (i32.const 0xde1))))))))
    ;; 0x0c10
    (if (i32.eq (local.get $p) (i32.const 0xc10)) (then (return (if (result f64) (i32.lt_s (i32.load offset=56 (global.get $gl_sw_st)) (i32.const 0)) (then (if (result f64) (i32.eq (local.get $i) (i32.const 3)) (then (f64.convert_i32_u (global.get $gl_sw_default_h))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 2)) (then (f64.convert_i32_u (global.get $gl_sw_default_w))) (else (if (result f64) (i32.eq (local.get $i) (i32.const 1)) (then (f64.const 0)) (else (f64.const 0)))))))) (else (f64.convert_i32_s (i32.load (i32.add (global.get $gl_sw_st) (i32.add (i32.const 48) (i32.shl (local.get $i) (i32.const 2)))))))))))
    ;; 0x0b11
    (if (i32.eq (local.get $p) (i32.const 0xb11)) (then (return (f64.promote_f32 (global.get $gl_sw_point_size)))))
    ;; 0x0b21
    (if (i32.eq (local.get $p) (i32.const 0xb21)) (then (return (f64.promote_f32 (global.get $gl_sw_line_width)))))
    ;; 0x0b45
    (if (i32.eq (local.get $p) (i32.const 0xb45)) (then (return (f64.convert_i32_u (i32.load offset=28 (global.get $gl_sw_st))))))
    ;; 0x0b46
    (if (i32.eq (local.get $p) (i32.const 0xb46)) (then (return (f64.convert_i32_u (select (i32.const 0x901) (i32.const 0x900) (i32.load offset=32 (global.get $gl_sw_st)))))))
    ;; 0x0be1
    (if (i32.eq (local.get $p) (i32.const 0xbe1)) (then (return (f64.convert_i32_u (call $gl_query_blend_enum (i32.load offset=4 (global.get $gl_sw_st)))))))
    ;; 0x0be0
    (if (i32.eq (local.get $p) (i32.const 0xbe0)) (then (return (f64.convert_i32_u (call $gl_query_blend_enum (i32.load offset=8 (global.get $gl_sw_st)))))))
    ;; 0x0bc1
    (if (i32.eq (local.get $p) (i32.const 0xbc1)) (then (return (f64.convert_i32_u (i32.add (i32.const 0x1ff) (i32.load offset=12 (global.get $gl_sw_st)))))))
    ;; 0x0b74
    (if (i32.eq (local.get $p) (i32.const 0xb74)) (then (return (f64.convert_i32_u (i32.add (i32.const 0x1ff) (i32.load offset=20 (global.get $gl_sw_st)))))))
    ;; 0x0b72
    (if (i32.eq (local.get $p) (i32.const 0xb72)) (then (return (f64.convert_i32_u (i32.load offset=24 (global.get $gl_sw_st))))))
    ;; 0x0be2
    (if (i32.eq (local.get $p) (i32.const 0xbe2)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 2)) (i32.const 0))))))
    ;; 0x0bc0
    (if (i32.eq (local.get $p) (i32.const 0xbc0)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 4)) (i32.const 0))))))
    ;; 0x0b71
    (if (i32.eq (local.get $p) (i32.const 0xb71)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 8)) (i32.const 0))))))
    ;; 0x0b44
    (if (i32.eq (local.get $p) (i32.const 0xb44)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 16)) (i32.const 0))))))
    ;; 0x0c11
    (if (i32.eq (local.get $p) (i32.const 0xc11)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 32)) (i32.const 0))))))
    ;; 0x0b60
    (if (i32.eq (local.get $p) (i32.const 0xb60)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 64)) (i32.const 0))))))
    ;; 0x0b50
    (if (i32.eq (local.get $p) (i32.const 0xb50)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 128)) (i32.const 0))))))
    ;; 0x0b57
    (if (i32.eq (local.get $p) (i32.const 0xb57)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 65536)) (i32.const 0))))))
    ;; 0x4000
    (if (i32.eq (local.get $p) (i32.const 0x4000)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 256)) (i32.const 0))))))
    ;; 0x4001
    (if (i32.eq (local.get $p) (i32.const 0x4001)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 512)) (i32.const 0))))))
    ;; 0x4002
    (if (i32.eq (local.get $p) (i32.const 0x4002)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 1024)) (i32.const 0))))))
    ;; 0x4003
    (if (i32.eq (local.get $p) (i32.const 0x4003)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 2048)) (i32.const 0))))))
    ;; 0x4004
    (if (i32.eq (local.get $p) (i32.const 0x4004)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 4096)) (i32.const 0))))))
    ;; 0x4005
    (if (i32.eq (local.get $p) (i32.const 0x4005)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 8192)) (i32.const 0))))))
    ;; 0x4006
    (if (i32.eq (local.get $p) (i32.const 0x4006)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 16384)) (i32.const 0))))))
    ;; 0x4007
    (if (i32.eq (local.get $p) (i32.const 0x4007)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (i32.const 32768)) (i32.const 0))))))
    ;; 0x0de1
    (if (i32.eq (local.get $p) (i32.const 0xde1)) (then (return (f64.convert_i32_u (i32.ne (i32.and (i32.load offset=0 (global.get $gl_sw_st)) (select (i32.const 0x80000) (i32.const 1) (global.get $gl_sw_active_unit))) (i32.const 0))))))
    ;; 0x0d52
    (if (i32.eq (local.get $p) (i32.const 0xd52)) (then (return (f64.convert_i32_u (select (i32.const 5) (i32.const 8) (i32.eq (if (result i32) (global.get $gl_sw_bitmap) (then (call $gdi_bitmap_bpp (global.get $gl_sw_bitmap))) (else (i32.const 32))) (i32.const 16)))))))
    ;; 0x0d53
    (if (i32.eq (local.get $p) (i32.const 0xd53)) (then (return (f64.convert_i32_u (select (select (i32.const 6) (i32.const 5) (i32.eq (call $dx_surf_fmt_get (global.get $gl_sw_rt)) (i32.const 1))) (i32.const 8) (i32.eq (if (result i32) (global.get $gl_sw_bitmap) (then (call $gdi_bitmap_bpp (global.get $gl_sw_bitmap))) (else (i32.const 32))) (i32.const 16)))))))
    ;; 0x0d54
    (if (i32.eq (local.get $p) (i32.const 0xd54)) (then (return (f64.convert_i32_u (select (i32.const 5) (i32.const 8) (i32.eq (if (result i32) (global.get $gl_sw_bitmap) (then (call $gdi_bitmap_bpp (global.get $gl_sw_bitmap))) (else (i32.const 32))) (i32.const 16)))))))
    ;; 0x0d55
    (if (i32.eq (local.get $p) (i32.const 0xd55)) (then (return (f64.convert_i32_u (select (i32.const 8) (i32.const 0) (i32.eq (if (result i32) (global.get $gl_sw_bitmap) (then (call $gdi_bitmap_bpp (global.get $gl_sw_bitmap))) (else (i32.const 32))) (i32.const 32)))))))
    ;; 0x0d56
    (if (i32.eq (local.get $p) (i32.const 0xd56)) (then (return (f64.const 16))))
    ;; 0x0c31
    (if (i32.eq (local.get $p) (i32.const 0xc31)) (then (return (f64.const 1))))
    ;; 0x0c33
    (if (i32.eq (local.get $p) (i32.const 0xc33)) (then (return (f64.const 0))))
    ;; 0x0c00
    (if (i32.eq (local.get $p) (i32.const 0xc00)) (then (return (f64.const 0))))
    ;; 0x0c32
    (if (i32.eq (local.get $p) (i32.const 0xc32)) (then (return (f64.convert_i32_u (i32.eqz (global.get $gl_sw_bitmap))))))
    (unreachable))

  (func $gl_query_list_index (param $ctx i32) (result i32)
    (i32.load offset=12 (local.get $ctx)))

  (func $gl_query_blend_enum (param $v i32) (result i32)
    (if (i32.le_u (local.get $v) (i32.const 2)) (then (return (i32.sub (local.get $v) (i32.const 1)))))
    (i32.add (local.get $v) (i32.const 0x2fd)))

  (func $gl_query_normalized (param $p i32) (result i32) (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xb00)) (i32.eq (local.get $p) (i32.const 0xb02))) (i32.eq (local.get $p) (i32.const 0xb04))) (i32.eq (local.get $p) (i32.const 0xb70))) (i32.eq (local.get $p) (i32.const 0xb80))) (i32.eq (local.get $p) (i32.const 0xb66))) (i32.eq (local.get $p) (i32.const 0xb53))))

  (func $gl_query_unsigned (param $p i32) (result i32) (i32.or (i32.or (i32.or (i32.eq (local.get $p) (i32.const 0xb93)) (i32.eq (local.get $p) (i32.const 0xb98))) (i32.eq (local.get $p) (i32.const 0xb32))) (i32.eq (local.get $p) (i32.const 0x8069))))

  ;; One conversion/writer for native queries. No guest temporary and no
  ;; f32 intermediate on the double or integer->double path.
  (func $gl_native_query (param $op i32) (param $stack i32) (result i32)
    (local $p i32) (local $n i32) (local $out i32) (local $width i32)
    (local $bytes i32) (local $i i32) (local $v f64) (local $ctx i32)
    (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 161))
      (i32.or (i32.eq (local.get $op) (i32.const 145))
        (i32.or (i32.eq (local.get $op) (i32.const 13)) (i32.eq (local.get $op) (i32.const 103))))))
      (then (return (i32.const 0))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    ;; A recorded Begin during GL_COMPILE has not executed. Get executes now.
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $p (i32.load offset=4 (local.get $stack)))
    (local.set $n (call $gl_native_query_count (local.get $p)))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    (local.set $out (i32.load offset=8 (local.get $stack)))
    (local.set $width (select (i32.const 1)
      (select (i32.const 8) (i32.const 4) (i32.eq (local.get $op) (i32.const 145)))
      (i32.eq (local.get $op) (i32.const 161))))
    (local.set $bytes (i32.mul (local.get $n) (local.get $width)))
    (if (i32.gt_u (local.get $out) (i32.sub (i32.const -1) (i32.sub (local.get $bytes) (i32.const 1))))
      (then (unreachable)))
    ;; At most128 bytes; validate before any component write, including pages
    ;; within a sparse, unaligned output span.
    (loop $validate
      (if (i32.eq (call $g2w (i32.add (local.get $out) (local.get $i))) (global.get $NULL_SENTINEL))
        (then (unreachable)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $validate (i32.lt_u (local.get $i) (local.get $bytes))))
    (local.set $i (i32.const 0))
    (loop $values
      (local.set $v (call $gl_native_query_value (local.get $p) (local.get $i)))
      ;; GLboolean is one byte; signed zeros are false, all other
      ;; native numeric values (including preserved NaN) are true.
      (if (i32.eq (local.get $op) (i32.const 161))
        (then (call $gs8 (i32.add (local.get $out) (local.get $i))
          (f64.ne (local.get $v) (f64.const 0))))
        (else (if (i32.eq (local.get $op) (i32.const 145))
        (then (call $gs64 (i32.add (local.get $out) (i32.mul (local.get $i) (local.get $width)))
          (i64.reinterpret_f64 (local.get $v))))
        (else (if (i32.eq (local.get $op) (i32.const 13))
          (then (call $gs32 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2)))
            (i32.reinterpret_f32 (f32.demote_f64 (local.get $v)))))
          (else
            ;; GL1.1 chapter6/table4.7 special signed component normalization.
            (if (call $gl_query_normalized (local.get $p)) (then
              (local.set $v (f64.mul (f64.const 0.5)
                (f64.sub (f64.mul (local.get $v) (f64.const 4294967295)) (f64.const 1))))))
            (call $gs32 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2)))
              (if (result i32) (call $gl_query_unsigned (local.get $p))
                (then (i32.trunc_sat_f64_u (f64.nearest (local.get $v))))
                (else (i32.trunc_sat_f64_s (f64.nearest (local.get $v))))))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $values (i32.lt_u (local.get $i) (local.get $n))))
    (i32.const 1))
  ;; Reject setters before any native observer can corrupt queried state.
  (func $gl_query_validate_setter (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $v i32) (local $error i32)
    (if (i32.eqz (i32.or
        (i32.or (i32.or (i32.eq (local.get $op) (i32.const 7)) (i32.eq (local.get $op) (i32.const 18)))
                (i32.or (i32.eq (local.get $op) (i32.const 20)) (i32.eq (local.get $op) (i32.const 35))))
        (i32.or (i32.eq (local.get $op) (i32.const 105)) (i32.eq (local.get $op) (i32.const 106)))))
      (then (return (i32.const 0))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $v (i32.load offset=4 (local.get $stack)))
    (if (i32.and (i32.eq (local.get $op) (i32.const 35))
        (i32.gt_u (i32.sub (local.get $v) (i32.const 0x1700)) (i32.const 2)))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 105)) (i32.eq (local.get $op) (i32.const 106)))
        (i32.gt_u (i32.sub (local.get $v) (i32.const 0x84c0)) (i32.const 1)))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 18)) (i32.eq (local.get $op) (i32.const 20)))
        (i32.or (i32.lt_s (i32.load offset=12 (local.get $stack)) (i32.const 0))
                (i32.lt_s (i32.load offset=16 (local.get $stack)) (i32.const 0))))
      (then (local.set $error (i32.const 0x501))))
    (if (local.get $error) (then (call $gl_list_error (local.get $ctx) (local.get $error)) (return (i32.const 1))))
    (i32.const 0))

  (func $gl_state_defaults
    (global.set $gl_source_tag (i32.const 0))
    (global.set $gl_color_r (f32.const 1)) (global.set $gl_color_g (f32.const 1))
    (global.set $gl_color_b (f32.const 1)) (global.set $gl_color_a (f32.const 1))
    (global.set $gl_tex_s (f32.const 0)) (global.set $gl_tex_t (f32.const 0))
    (global.set $gl_tex1_s (f32.const 0)) (global.set $gl_tex1_t (f32.const 0))
    (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1))
    (global.set $gl_tex1_r (f32.const 0)) (global.set $gl_tex1_q (f32.const 1))
    (global.set $gl_normal_x (f32.const 0)) (global.set $gl_normal_y (f32.const 0))
    (global.set $gl_normal_z (f32.const 1)) (global.set $gl_shade_model (i32.const 0x1D01))
    (global.set $gl_client_bits (i32.const 0)) (global.set $gl_client_tex_unit (i32.const 0))
    (global.set $gl_vp_size (i32.const 4)) (global.set $gl_np_type (i32.const 0x1406))
    (global.set $gl_cp_size (i32.const 4)) (global.set $gl_tp0_size (i32.const 4))
    (global.set $gl_tp1_size (i32.const 4))
    (global.set $gl_vp_type (i32.const 0x1406)) (global.set $gl_cp_type (i32.const 0x1406))
    (global.set $gl_tp0_type (i32.const 0x1406)) (global.set $gl_tp1_type (i32.const 0x1406))
    (global.set $gl_vp_stride (i32.const 0)) (global.set $gl_np_stride (i32.const 0))
    (global.set $gl_cp_stride (i32.const 0)) (global.set $gl_tp0_stride (i32.const 0))
    (global.set $gl_tp1_stride (i32.const 0))
    (global.set $gl_vp_guest (i32.const 0)) (global.set $gl_np_guest (i32.const 0))
    (global.set $gl_cp_guest (i32.const 0)) (global.set $gl_tp0_guest (i32.const 0))
    (global.set $gl_tp1_guest (i32.const 0))
    (global.set $gl_state_attrib_head (i32.const 0))
    (global.set $gl_state_attrib_depth (i32.const 0))
    (global.set $gl_state_pointer_bits (i32.const 0)))

  (func $gl_state_context_changed (param $context i32)
    (local $p i32)
    (call $gl_sw_context_save)
    (call $gl_state_save (global.get $gl_current_context))
    (call $gl_state_defaults)
    (local.set $p (call $gl_state_slot (local.get $context) (i32.const 0)))
    (if (local.get $p) (then
      (call $gl_source_restore (i32.add (local.get $p) (i32.const 176)))
      (global.set $gl_color_r (f32.load offset=4 (local.get $p)))
      (global.set $gl_color_g (f32.load offset=8 (local.get $p)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $p)))
      (global.set $gl_color_a (f32.load offset=16 (local.get $p)))
      (global.set $gl_tex_s (f32.load offset=20 (local.get $p)))
      (global.set $gl_tex_t (f32.load offset=24 (local.get $p)))
      (global.set $gl_normal_x (f32.load offset=28 (local.get $p)))
      (global.set $gl_normal_y (f32.load offset=32 (local.get $p)))
      (global.set $gl_normal_z (f32.load offset=36 (local.get $p)))
      (global.set $gl_tex1_s (f32.load offset=40 (local.get $p)))
      (global.set $gl_tex1_t (f32.load offset=44 (local.get $p)))
      (global.set $gl_shade_model (i32.load offset=48 (local.get $p)))
      (global.set $gl_client_bits (i32.load offset=52 (local.get $p)))
      (global.set $gl_client_tex_unit (i32.load offset=56 (local.get $p)))
      (global.set $gl_vp_size (i32.load offset=60 (local.get $p)))
      (global.set $gl_vp_type (i32.load offset=64 (local.get $p)))
      (global.set $gl_vp_stride (i32.load offset=68 (local.get $p)))
      (global.set $gl_vp_guest (i32.load offset=72 (local.get $p)))
      (global.set $gl_np_type (i32.load offset=76 (local.get $p)))
      (global.set $gl_np_stride (i32.load offset=80 (local.get $p)))
      (global.set $gl_np_guest (i32.load offset=84 (local.get $p)))
      (global.set $gl_cp_size (i32.load offset=88 (local.get $p)))
      (global.set $gl_cp_type (i32.load offset=92 (local.get $p)))
      (global.set $gl_cp_stride (i32.load offset=96 (local.get $p)))
      (global.set $gl_cp_guest (i32.load offset=100 (local.get $p)))
      (global.set $gl_tp0_size (i32.load offset=104 (local.get $p)))
      (global.set $gl_tp0_type (i32.load offset=108 (local.get $p)))
      (global.set $gl_tp0_stride (i32.load offset=112 (local.get $p)))
      (global.set $gl_tp0_guest (i32.load offset=116 (local.get $p)))
      (global.set $gl_tp1_size (i32.load offset=120 (local.get $p)))
      (global.set $gl_tp1_type (i32.load offset=124 (local.get $p)))
      (global.set $gl_tp1_stride (i32.load offset=128 (local.get $p)))
      (global.set $gl_tp1_guest (i32.load offset=132 (local.get $p)))
      (global.set $gl_state_attrib_head (i32.load offset=136 (local.get $p)))
      (global.set $gl_state_attrib_depth (i32.load offset=140 (local.get $p)))
      (global.set $gl_state_pointer_bits (i32.load offset=144 (local.get $p)))
      (global.set $gl_tex_r (f32.load offset=148 (local.get $p)))
      (global.set $gl_tex_q (f32.load offset=152 (local.get $p)))
      (global.set $gl_tex1_r (f32.load offset=156 (local.get $p)))
      (global.set $gl_tex1_q (f32.load offset=160 (local.get $p)))))
    (global.set $gl_current_context (local.get $context))
    (call $gl_sw_context_load)
    (if (local.get $context) (then (call $gl_texture_sync_sampling)))
  )

  (func $gl_state_free_attribs (param $head i32)
    (local $next i32)
    (loop $free
      (if (i32.eqz (local.get $head)) (then (return)))
      (local.set $next (i32.load (local.get $head)))
      (call $heap_free (call $w2g (local.get $head)))
      (local.set $head (local.get $next))
      (br $free)))

  (func $gl_state_context_deleted (param $context i32)
    (local $node i32) (local $prev i32) (local $next i32) (local $state i32)
    ;; Switch first so the context-zero snapshot is restored before the dying
    ;; state is unlinked and freed.
    (if (i32.eq (global.get $gl_current_context) (local.get $context))
      (then
        (call $gl_state_context_changed (i32.const 0))
        (global.set $gl_current_dc (i32.const 0))))
    (local.set $node (i32.atomic.load (region.addr $GL_MTX_BLOCKS 12)))
    (block $done
      (loop $find
        (br_if $done (i32.eqz (local.get $node)))
        (local.set $next (i32.load offset=4 (local.get $node)))
        (if (i32.eq (i32.load (local.get $node)) (local.get $context)) (then
          (if (local.get $prev)
            (then (i32.store offset=4 (local.get $prev) (local.get $next)))
            (else (i32.atomic.store (region.addr $GL_MTX_BLOCKS 12) (local.get $next))))
          (local.set $state (i32.load offset=8 (local.get $node)))
          (call $gl_state_free_attribs (i32.load offset=136 (local.get $state)))
          (memory.fill (local.get $state) (i32.const 0) (i32.const 392))
          (i32.store offset=4 (local.get $node) (global.get $gl_state_free_contexts))
          (global.set $gl_state_free_contexts (local.get $node))
          (br $done)))
        (local.set $prev (local.get $node))
        (local.set $node (local.get $next))
        (br $find)))
    (if (i32.eqz (local.get $context)) (then (call $gl_state_defaults))))

  (func $gl_array_type_bytes (param $type i32) (result i32)
    (if (i32.or (i32.eq (local.get $type) (i32.const 0x1400))
        (i32.eq (local.get $type) (i32.const 0x1401))) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $type) (i32.const 0x1402))
        (i32.eq (local.get $type) (i32.const 0x1403))) (then (return (i32.const 2))))
    (if (i32.or (i32.or (i32.eq (local.get $type) (i32.const 0x1404))
        (i32.eq (local.get $type) (i32.const 0x1405)))
        (i32.eq (local.get $type) (i32.const 0x1406))) (then (return (i32.const 4))))
    (if (i32.eq (local.get $type) (i32.const 0x140A)) (then (return (i32.const 8))))
    (i32.const 0))

  ;; Client arrays are read by GUEST address, translated one component at a
  ;; time. A $g2w result is good for one guest page only, and a guest array
  ;; need not be contiguous in wasm memory past it: Warcraft III's index and
  ;; vertex buffers live in sparse VirtualAlloc pages, and walking one wasm
  ;; pointer across a page end read unrelated memory as indices -- vertices
  ;; at 1.7e38 and a cliff mesh smeared across the Prologue cinematic.
  (func $gl_array_read (param $ga i32) (param $type i32) (param $normalize i32) (result f32)
    (local $v f32) (local $p i32)
    (local.set $p (call $g2w (local.get $ga)))
    (if (i32.eq (local.get $type) (i32.const 0x1400)) (then
      (local.set $v (f32.convert_i32_s (i32.load8_s (local.get $p))))
      (if (local.get $normalize) (then (local.set $v (f32.demote_f64 (f64.max (f64.const -1)
        (f64.div (f64.convert_i32_s (i32.load8_s (local.get $p))) (f64.const 127)))))))))
    (if (i32.eq (local.get $type) (i32.const 0x1401)) (then
      (local.set $v (f32.convert_i32_u (i32.load8_u (local.get $p))))
      (if (local.get $normalize) (then (local.set $v (f32.demote_f64
        (f64.div (f64.convert_i32_u (i32.load8_u (local.get $p))) (f64.const 255))))))))
    (if (i32.eq (local.get $type) (i32.const 0x1402)) (then
      (local.set $v (f32.convert_i32_s (i32.load16_s (local.get $p))))
      (if (local.get $normalize) (then (local.set $v (f32.demote_f64 (f64.max (f64.const -1)
        (f64.div (f64.convert_i32_s (i32.load16_s (local.get $p))) (f64.const 32767)))))))))
    (if (i32.eq (local.get $type) (i32.const 0x1403)) (then
      (local.set $v (f32.convert_i32_u (i32.load16_u (local.get $p))))
      (if (local.get $normalize) (then (local.set $v (f32.demote_f64
        (f64.div (f64.convert_i32_u (i32.load16_u (local.get $p))) (f64.const 65535))))))))
    (if (i32.eq (local.get $type) (i32.const 0x1404)) (then
      (local.set $v (f32.convert_i32_s (i32.load (local.get $p))))
      (if (local.get $normalize) (then (local.set $v (f32.demote_f64 (f64.max (f64.const -1)
        (f64.div (f64.convert_i32_s (i32.load (local.get $p))) (f64.const 2147483647)))))))))
    (if (i32.eq (local.get $type) (i32.const 0x1405)) (then
      (local.set $v (f32.convert_i32_u (i32.load (local.get $p))))
      (if (local.get $normalize) (then (local.set $v (f32.demote_f64
        (f64.div (f64.convert_i32_u (i32.load (local.get $p))) (f64.const 4294967295))))))))
    (if (i32.eq (local.get $type) (i32.const 0x1406)) (then (local.set $v (f32.load (local.get $p)))))
    (if (i32.eq (local.get $type) (i32.const 0x140A)) (then (local.set $v (f32.demote_f64 (f64.load (local.get $p))))))
    (local.get $v))

  ;; JavaScript's `value || 0` is observable for NaN and signed zero. For a
  ;; double, test truthiness before demotion so a tiny nonzero value may still
  ;; round to -0 in the packed f32 stream, exactly like the oracle.
  (func $gl_array_read_or_zero (param $ga i32) (param $type i32) (result f32)
    (local $d f64) (local $v f32)
    (if (i32.eq (local.get $type) (i32.const 0x140A)) (then
      (local.set $d (f64.load (call $g2w (local.get $ga))))
      (if (i32.or (f64.eq (local.get $d) (f64.const 0))
          (f64.ne (local.get $d) (local.get $d))) (then (return (f32.const 0))))
      (return (f32.demote_f64 (local.get $d)))))
    (local.set $v (call $gl_array_read (local.get $ga) (local.get $type) (i32.const 0)))
    (if (i32.or (f32.eq (local.get $v) (f32.const 0))
        (f32.ne (local.get $v) (local.get $v))) (then (return (f32.const 0))))
    (local.get $v))

  ;; The GUEST address of element $index; $gl_array_read translates it.
  (func $gl_array_addr (param $guest i32) (param $size i32) (param $type i32)
      (param $stride i32) (param $index i32) (result i32)
    (local $bytes i32)
    (local.set $bytes (call $gl_array_type_bytes (local.get $type)))
    (if (i32.eqz (local.get $stride))
      (then (local.set $stride (i32.mul (local.get $size) (local.get $bytes)))))
    (i32.add (local.get $guest) (i32.mul (local.get $index) (local.get $stride))))

  (func $gl_state_array_element (param $index i32)
    (local $source_guest i32) (local $source_stack i32) (local $p i32) (local $b i32) (local $x f32) (local $y f32) (local $z f32)
    (if (i32.and (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 2)) (i32.const 0))
        (i32.and (i32.ne (i32.and (global.get $gl_state_pointer_bits) (i32.const 2)) (i32.const 0))
          (i32.ne (call $gl_array_type_bytes (global.get $gl_np_type)) (i32.const 0)))) (then
      (local.set $p (call $gl_array_addr (global.get $gl_np_guest) (i32.const 3)
        (global.get $gl_np_type) (global.get $gl_np_stride) (local.get $index)))
      (local.set $b (call $gl_array_type_bytes (global.get $gl_np_type)))
      (global.set $gl_normal_x (call $gl_array_read (local.get $p) (global.get $gl_np_type) (i32.const 1)))
      (global.set $gl_normal_y (call $gl_array_read (i32.add (local.get $p) (local.get $b)) (global.get $gl_np_type) (i32.const 1)))
      (global.set $gl_normal_z (call $gl_array_read (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 2))) (global.get $gl_np_type) (i32.const 1)))))
    (if (i32.and (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 4)) (i32.const 0))
        (i32.and (i32.ne (i32.and (global.get $gl_state_pointer_bits) (i32.const 4)) (i32.const 0))
          (i32.ne (call $gl_array_type_bytes (global.get $gl_cp_type)) (i32.const 0)))) (then
      (local.set $p (call $gl_array_addr (global.get $gl_cp_guest) (global.get $gl_cp_size)
        (global.get $gl_cp_type) (global.get $gl_cp_stride) (local.get $index)))
      (local.set $b (call $gl_array_type_bytes (global.get $gl_cp_type)))
      (local.set $source_guest (call $gl_alloc_affine (i32.const 24)))
      (if (i32.eqz (local.get $source_guest)) (then (unreachable)))
      (local.set $source_stack (call $g2w (local.get $source_guest)))
      (if (call $gl_source_array (local.get $index) (local.get $source_stack))
        (then (drop (call $gl_state_intercept (i32.const 0x10003) (local.get $source_stack))))
        (else
          (global.set $gl_source_tag (i32.const 0))
          (if (i32.gt_u (global.get $gl_cp_size) (i32.const 0)) (then
            (global.set $gl_color_r (call $gl_array_read (local.get $p) (global.get $gl_cp_type) (i32.const 1)))))
          (if (i32.gt_u (global.get $gl_cp_size) (i32.const 1)) (then
            (global.set $gl_color_g (call $gl_array_read (i32.add (local.get $p) (local.get $b)) (global.get $gl_cp_type) (i32.const 1)))))
          (if (i32.gt_u (global.get $gl_cp_size) (i32.const 2)) (then
            (global.set $gl_color_b (call $gl_array_read (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 2))) (global.get $gl_cp_type) (i32.const 1)))))
          (if (i32.gt_u (global.get $gl_cp_size) (i32.const 3))
            (then (global.set $gl_color_a (call $gl_array_read (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 3))) (global.get $gl_cp_type) (i32.const 1))))
            (else (global.set $gl_color_a (f32.const 1))))))
      (call $heap_free (local.get $source_guest))))
    (if (i32.and (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 8)) (i32.const 0))
        (i32.and (i32.ne (i32.and (global.get $gl_state_pointer_bits) (i32.const 8)) (i32.const 0))
          (i32.ne (call $gl_array_type_bytes (global.get $gl_tp0_type)) (i32.const 0)))) (then
      (local.set $p (call $gl_array_addr (global.get $gl_tp0_guest) (global.get $gl_tp0_size)
        (global.get $gl_tp0_type) (global.get $gl_tp0_stride) (local.get $index)))
      (local.set $b (call $gl_array_type_bytes (global.get $gl_tp0_type)))
      (global.set $gl_tex_s (call $gl_array_read_or_zero (local.get $p) (global.get $gl_tp0_type)))
      (if (i32.gt_u (global.get $gl_tp0_size) (i32.const 1))
        (then (global.set $gl_tex_t (call $gl_array_read_or_zero (i32.add (local.get $p) (local.get $b)) (global.get $gl_tp0_type))))
        (else (global.set $gl_tex_t (f32.const 0))))
      ;; Missing components take GL's defaults, r = 0 and q = 1.
      (if (i32.gt_u (global.get $gl_tp0_size) (i32.const 2))
        (then (global.set $gl_tex_r (call $gl_array_read_or_zero (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 2))) (global.get $gl_tp0_type))))
        (else (global.set $gl_tex_r (f32.const 0))))
      (if (i32.gt_u (global.get $gl_tp0_size) (i32.const 3))
        (then (global.set $gl_tex_q (call $gl_array_read_or_zero (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 3))) (global.get $gl_tp0_type))))
        (else (global.set $gl_tex_q (f32.const 1))))))
    (if (i32.and (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 16)) (i32.const 0))
        (i32.and (i32.ne (i32.and (global.get $gl_state_pointer_bits) (i32.const 16)) (i32.const 0))
          (i32.ne (call $gl_array_type_bytes (global.get $gl_tp1_type)) (i32.const 0)))) (then
      (local.set $p (call $gl_array_addr (global.get $gl_tp1_guest) (global.get $gl_tp1_size)
        (global.get $gl_tp1_type) (global.get $gl_tp1_stride) (local.get $index)))
      (local.set $b (call $gl_array_type_bytes (global.get $gl_tp1_type)))
      (global.set $gl_tex1_s (call $gl_array_read_or_zero (local.get $p) (global.get $gl_tp1_type)))
      (if (i32.gt_u (global.get $gl_tp1_size) (i32.const 1))
        (then (global.set $gl_tex1_t (call $gl_array_read_or_zero (i32.add (local.get $p) (local.get $b)) (global.get $gl_tp1_type))))
        (else (global.set $gl_tex1_t (f32.const 0))))
      (if (i32.gt_u (global.get $gl_tp1_size) (i32.const 2))
        (then (global.set $gl_tex1_r (call $gl_array_read_or_zero (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 2))) (global.get $gl_tp1_type))))
        (else (global.set $gl_tex1_r (f32.const 0))))
      (if (i32.gt_u (global.get $gl_tp1_size) (i32.const 3))
        (then (global.set $gl_tex1_q (call $gl_array_read_or_zero (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 3))) (global.get $gl_tp1_type))))
        (else (global.set $gl_tex1_q (f32.const 1))))))
    (if (i32.and (i32.ne (i32.and (global.get $gl_client_bits) (i32.const 1)) (i32.const 0))
        (i32.and (i32.ne (i32.and (global.get $gl_state_pointer_bits) (i32.const 1)) (i32.const 0))
          (i32.ne (call $gl_array_type_bytes (global.get $gl_vp_type)) (i32.const 0)))) (then
      (local.set $p (call $gl_array_addr (global.get $gl_vp_guest) (global.get $gl_vp_size)
        (global.get $gl_vp_type) (global.get $gl_vp_stride) (local.get $index)))
      (local.set $b (call $gl_array_type_bytes (global.get $gl_vp_type)))
      (local.set $x (f32.const 0)) (local.set $y (f32.const 0))
      (if (i32.gt_u (global.get $gl_vp_size) (i32.const 0)) (then
        (local.set $x (call $gl_array_read_or_zero (local.get $p) (global.get $gl_vp_type)))))
      (if (i32.gt_u (global.get $gl_vp_size) (i32.const 1)) (then
        (local.set $y (call $gl_array_read_or_zero (i32.add (local.get $p) (local.get $b)) (global.get $gl_vp_type)))))
      (local.set $z (f32.const 0))
      (if (i32.gt_u (global.get $gl_vp_size) (i32.const 2)) (then
        (local.set $z (call $gl_array_read_or_zero (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 2))) (global.get $gl_vp_type)))))
      ;; A 4-component position array carries w; fewer components mean w = 1.
      (call $gl_append_vertex4 (local.get $x) (local.get $y) (local.get $z)
        (if (result f32) (i32.gt_u (global.get $gl_vp_size) (i32.const 3))
          (then (call $gl_array_read_or_zero (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 3))) (global.get $gl_vp_type)))
          (else (f32.const 1)))))))

  ;; Texture unit $unit's (s, t, r, q) from four f32 at wasm $p; a unit other
  ;; than 0 or 1 is ignored, as glMultiTexCoord2fARB ignores it.
  (func $gl_state_set_tex4 (param $unit i32) (param $p i32)
    (if (i32.eqz (local.get $unit)) (then
      (global.set $gl_tex_s (f32.load (local.get $p))) (global.set $gl_tex_t (f32.load offset=4 (local.get $p)))
      (global.set $gl_tex_r (f32.load offset=8 (local.get $p))) (global.set $gl_tex_q (f32.load offset=12 (local.get $p)))))
    (if (i32.eq (local.get $unit) (i32.const 1)) (then
      (global.set $gl_tex1_s (f32.load (local.get $p))) (global.set $gl_tex1_t (f32.load offset=4 (local.get $p)))
      (global.set $gl_tex1_r (f32.load offset=8 (local.get $p))) (global.set $gl_tex1_q (f32.load offset=12 (local.get $p))))))

  ;; The same from a guest vector, gathered into scratch first: sixteen
  ;; bytes may straddle a page that $g2w resolves somewhere else.
  (func $gl_state_set_tex4_guest (param $unit i32) (param $ga i32)
    (local $tmp i32)
    (local.set $tmp (global.get $gl_state_vec4))
    (if (i32.eqz (local.get $tmp)) (then
      (local.set $tmp (call $heap_alloc (i32.const 16)))
      (if (i32.eqz (local.get $tmp)) (then (unreachable)))
      (local.set $tmp (call $g2w (local.get $tmp)))
      (global.set $gl_state_vec4 (local.get $tmp))))
    (call $gl_copy_from_guest (local.get $tmp) (local.get $ga) (i32.const 16))
    (call $gl_state_set_tex4 (local.get $unit) (local.get $tmp)))
  (global $gl_state_vec4 (mut i32) (i32.const 0))

  ;; CURRENT_COLOR comes from the same native values that build vertices.
  ;; Get commands execute immediately during list compilation; queries must
  ;; neither clamp signed components nor consult stale host renderer state.
  (func $gl_current_color_query (param $op i32) (param $stack i32) (result i32)
    (local $p i32) (local $i i32) (local $ctx i32) (local $value f32)
    (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 13))
        (i32.eq (local.get $op) (i32.const 103)))) (then (return (i32.const 0))))
    (if (i32.ne (i32.load offset=4 (local.get $stack)) (i32.const 0x0B00)) (then (return (i32.const 0))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
      (local.set $ctx (call $gl_list_context))
      (if (local.get $ctx) (then (call $gl_list_error (local.get $ctx) (i32.const 0x502))))
      (return (i32.const 1))))
    (local.set $p (i32.load offset=8 (local.get $stack)))
    (if (i32.gt_u (local.get $p) (i32.const 0xfffffff0)) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (i32.const 15))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (loop $values
      (local.set $value (if (result f32) (i32.eqz (local.get $i))
        (then (global.get $gl_color_r))
        (else (if (result f32) (i32.eq (local.get $i) (i32.const 1))
          (then (global.get $gl_color_g))
          (else (if (result f32) (i32.eq (local.get $i) (i32.const 2))
            (then (global.get $gl_color_b)) (else (global.get $gl_color_a))))))))
      (call $gs32 (i32.add (local.get $p) (i32.shl (local.get $i) (i32.const 2)))
        (if (result i32) (i32.eq (local.get $op) (i32.const 13))
          (then (i32.reinterpret_f32 (local.get $value)))
          ;; OpenGL 1.1 table 4.7 reverses signed component normalization.
          (else (i32.trunc_sat_f64_s (f64.nearest (f64.mul (f64.const 0.5)
            (f64.sub (f64.mul (f64.promote_f32 (local.get $value)) (f64.const 4294967295)) (f64.const 1))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $values (i32.lt_u (local.get $i) (i32.const 4))))
    (i32.const 1))

  (func $gl_state_intercept (param $op i32) (param $stack i32) (result i32)
    (local $a i32) (local $unit i32) (local $i i32) (local $count i32) (local $p i32) (local $b i32)
    (local $w i32) (local $z f32)
    (if (i32.eq (local.get $op) (i32.const 0x10003)) (then
      (call $gl_source_install (i32.load offset=4 (local.get $stack)) (i32.load offset=8 (local.get $stack)) (i32.load offset=12 (local.get $stack)) (i32.load offset=16 (local.get $stack)) (i32.load offset=20 (local.get $stack)))
      (call $gl_period_color) (return (i32.const 1))))
    (if (call $gl_interleaved_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (call $gl_current_color_query (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 23)) (then
      (global.set $gl_source_tag (i32.const 0))
      (global.set $gl_color_r (f32.load offset=4 (local.get $stack))) (global.set $gl_color_g (f32.load offset=8 (local.get $stack)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $stack))) (global.set $gl_color_a (f32.const 1)) (call $gl_period_color) (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 24)) (i32.eq (local.get $op) (i32.const 26))) (then
      (global.set $gl_source_tag (i32.const 0))
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (global.set $gl_color_r (f32.load (local.get $p))) (global.set $gl_color_g (f32.load offset=4 (local.get $p)))
      (global.set $gl_color_b (f32.load offset=8 (local.get $p)))
      (if (i32.eq (local.get $op) (i32.const 26))
        (then (global.set $gl_color_a (f32.load offset=12 (local.get $p))))
        (else (global.set $gl_color_a (f32.const 1))))
      (call $gl_period_color) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 25)) (then
      (global.set $gl_source_tag (i32.const 0))
      (global.set $gl_color_r (f32.load offset=4 (local.get $stack))) (global.set $gl_color_g (f32.load offset=8 (local.get $stack)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $stack))) (global.set $gl_color_a (f32.load offset=16 (local.get $stack))) (call $gl_period_color) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 27)) (then
      (call $gl_source_install (i32.const 8) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 0))) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 1))) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 2))) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 3))))
      (call $gl_period_color) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 56)) (then
      (call $gl_source_install (i32.const 8) (i32.and (i32.load offset=4 (local.get $stack)) (i32.const 255)) (i32.and (i32.load offset=8 (local.get $stack)) (i32.const 255)) (i32.and (i32.load offset=12 (local.get $stack)) (i32.const 255)) (i32.and (i32.load offset=16 (local.get $stack)) (i32.const 255)))
      (call $gl_period_color) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 58)) (then
      (call $gl_source_install (i32.const 520) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 0))) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 1))) (call $gl8 (i32.add (i32.load offset=4 (local.get $stack)) (i32.const 2))) (i32.const 0))
      (call $gl_period_color) (return (i32.const 1))))
    ;; 111 glColor3ub(r, g, b): GLubyte arguments widened to stack words.
    (if (i32.eq (local.get $op) (i32.const 111)) (then
      (call $gl_source_install (i32.const 520) (i32.and (i32.load offset=4 (local.get $stack)) (i32.const 255)) (i32.and (i32.load offset=8 (local.get $stack)) (i32.const 255)) (i32.and (i32.load offset=12 (local.get $stack)) (i32.const 255)) (i32.const 0))
      (call $gl_period_color) (return (i32.const 1))))
    ;; Two-component texture coordinates leave r = 0 and q = 1, as GL defines.
    (if (i32.eq (local.get $op) (i32.const 28)) (then
      (global.set $gl_tex_s (f32.load offset=4 (local.get $stack))) (global.set $gl_tex_t (f32.load offset=8 (local.get $stack)))
      (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 95)) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (global.set $gl_tex_s (f32.load (local.get $p))) (global.set $gl_tex_t (f32.load offset=4 (local.get $p)))
      (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1)) (return (i32.const 1))))
    ;; 120 glTexCoord4f(s, t, r, q) / 121 glTexCoord4fv(v): Oni's projective
    ;; coordinates. q rides in the packed vertex; the rasterizers interpolate
    ;; s/w, t/w and q/w and divide per fragment.
    (if (i32.eq (local.get $op) (i32.const 120)) (then
      (call $gl_state_set_tex4 (i32.const 0) (i32.add (local.get $stack) (i32.const 4)))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 121)) (then
      (call $gl_state_set_tex4_guest (i32.const 0) (i32.load offset=4 (local.get $stack)))
      (return (i32.const 1))))
    ;; 122 glMultiTexCoord4fARB(target, s, t, r, q) / 123 ...4fvARB(target, v).
    (if (i32.eq (local.get $op) (i32.const 122)) (then
      (call $gl_state_set_tex4 (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0))
        (i32.add (local.get $stack) (i32.const 8)))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 123)) (then
      (call $gl_state_set_tex4_guest (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0))
        (i32.load offset=8 (local.get $stack)))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 63)) (then
      (global.set $gl_normal_x (f32.load offset=4 (local.get $stack))) (global.set $gl_normal_y (f32.load offset=8 (local.get $stack)))
      (global.set $gl_normal_z (f32.load offset=12 (local.get $stack))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 64)) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (global.set $gl_normal_x (f32.load (local.get $p))) (global.set $gl_normal_y (f32.load offset=4 (local.get $p)))
      (global.set $gl_normal_z (f32.load offset=8 (local.get $p))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 107)) (then
      (local.set $unit (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0)))
      (if (i32.eq (local.get $unit) (i32.const 1))
        (then (global.set $gl_tex1_s (f32.load offset=8 (local.get $stack))) (global.set $gl_tex1_t (f32.load offset=12 (local.get $stack)))
          (global.set $gl_tex1_r (f32.const 0)) (global.set $gl_tex1_q (f32.const 1)))
        (else (if (i32.eqz (local.get $unit)) (then (global.set $gl_tex_s (f32.load offset=8 (local.get $stack))) (global.set $gl_tex_t (f32.load offset=12 (local.get $stack)))
          (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1))))))
      (return (i32.const 1))))
    ;; 117 glMultiTexCoord2fvARB(target, v): 107 with the pair behind a
    ;; pointer (Soldier of Fortune's ref_gl draws its lightmap pass with it).
    (if (i32.eq (local.get $op) (i32.const 117)) (then
      (local.set $unit (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0)))
      (local.set $p (call $g2w (i32.load offset=8 (local.get $stack))))
      (if (i32.eq (local.get $unit) (i32.const 1))
        (then (global.set $gl_tex1_s (f32.load (local.get $p))) (global.set $gl_tex1_t (f32.load offset=4 (local.get $p)))
          (global.set $gl_tex1_r (f32.const 0)) (global.set $gl_tex1_q (f32.const 1)))
        (else (if (i32.eqz (local.get $unit)) (then (global.set $gl_tex_s (f32.load (local.get $p))) (global.set $gl_tex_t (f32.load offset=4 (local.get $p)))
          (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1))))))
      (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 29)) (i32.eq (local.get $op) (i32.const 30))) (then
      (local.set $z (f32.const 0))
      (if (i32.eq (local.get $op) (i32.const 30))
        (then (local.set $z (f32.load offset=12 (local.get $stack)))))
      (call $gl_append_vertex (f32.load offset=4 (local.get $stack))
        (f32.load offset=8 (local.get $stack)) (local.get $z))
      (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 31)) (i32.eq (local.get $op) (i32.const 91))) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (local.set $z (f32.const 0))
      (if (i32.eq (local.get $op) (i32.const 31))
        (then (local.set $z (f32.load offset=8 (local.get $p)))))
      (call $gl_append_vertex (f32.load (local.get $p))
        (f32.load offset=4 (local.get $p)) (local.get $z))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 97)) (then
      (call $gl_append_vertex (f32.convert_i32_s (i32.load offset=4 (local.get $stack)))
        (f32.convert_i32_s (i32.load offset=8 (local.get $stack))) (f32.const 0)) (return (i32.const 1))))
    ;; 118 glVertex4f(x, y, z, w) / 119 glVertex4fv(v): a projective vertex
    ;; keeps its w in the packed record; the rasterizers divide by clip w.
    (if (i32.eq (local.get $op) (i32.const 118)) (then
      (call $gl_append_vertex4 (f32.load offset=4 (local.get $stack))
        (f32.load offset=8 (local.get $stack)) (f32.load offset=12 (local.get $stack))
        (f32.load offset=16 (local.get $stack)))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 119)) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (call $gl_append_vertex4 (f32.load (local.get $p)) (f32.load offset=4 (local.get $p))
        (f32.load offset=8 (local.get $p)) (f32.load offset=12 (local.get $p)))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 76)) (then
      (local.set $a (call $heap_alloc (i32.const 112)))
      (if (i32.eqz (local.get $a)) (then (unreachable)))
      (local.set $p (call $g2w (local.get $a)))
        (i32.store (local.get $p) (global.get $gl_state_attrib_head))
        (f32.store offset=4 (local.get $p) (global.get $gl_color_r)) (f32.store offset=8 (local.get $p) (global.get $gl_color_g))
        (f32.store offset=12 (local.get $p) (global.get $gl_color_b)) (f32.store offset=16 (local.get $p) (global.get $gl_color_a))
        (f32.store offset=20 (local.get $p) (global.get $gl_tex_s)) (f32.store offset=24 (local.get $p) (global.get $gl_tex_t))
        (f32.store offset=28 (local.get $p) (global.get $gl_tex1_s)) (f32.store offset=32 (local.get $p) (global.get $gl_tex1_t))
        (f32.store offset=36 (local.get $p) (global.get $gl_normal_x)) (f32.store offset=40 (local.get $p) (global.get $gl_normal_y))
        (f32.store offset=44 (local.get $p) (global.get $gl_normal_z)) (i32.store offset=48 (local.get $p) (global.get $gl_shade_model))
        (f32.store offset=52 (local.get $p) (global.get $gl_tex_r)) (f32.store offset=56 (local.get $p) (global.get $gl_tex_q))
        (f32.store offset=60 (local.get $p) (global.get $gl_tex1_r)) (f32.store offset=64 (local.get $p) (global.get $gl_tex1_q))
        (call $gl_source_save (i32.add (local.get $p) (i32.const 72)))
        (memory.copy (i32.add (local.get $p) (i32.const 92))
          (i32.add (call $gl_list_context) (i32.const 1008)) (i32.const 20))
        (i32.store offset=68 (local.get $p) (i32.load offset=4 (local.get $stack)))
        (global.set $gl_state_attrib_head (local.get $p))
        (global.set $gl_state_attrib_depth (i32.add (global.get $gl_state_attrib_depth) (i32.const 1)))
      (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 77)) (then
      (if (global.get $gl_state_attrib_head) (then
        (global.set $gl_state_attrib_depth (i32.sub (global.get $gl_state_attrib_depth) (i32.const 1)))
        (local.set $p (global.get $gl_state_attrib_head))
        (global.set $gl_state_attrib_head (i32.load (local.get $p)))
        (if (i32.and (i32.load offset=68 (local.get $p)) (i32.const 0x8000)) (then
          (memory.copy (i32.add (call $gl_list_context) (i32.const 1008))
            (i32.add (local.get $p) (i32.const 92)) (i32.const 20))))
        (if (i32.and (i32.load offset=68 (local.get $p)) (i32.const 1)) (then
          (call $gl_source_restore (i32.add (local.get $p) (i32.const 72)))
        (global.set $gl_color_r (f32.load offset=4 (local.get $p))) (global.set $gl_color_g (f32.load offset=8 (local.get $p)))
        (global.set $gl_color_b (f32.load offset=12 (local.get $p))) (global.set $gl_color_a (f32.load offset=16 (local.get $p)))
        ))
        ;; Current texture coordinates on both units belong to GL_CURRENT_BIT,
        ;; including r/q. Unrelated attribute masks leave changed values live.
        (if (i32.and (i32.load offset=68 (local.get $p)) (i32.const 1)) (then
          (global.set $gl_tex_s (f32.load offset=20 (local.get $p))) (global.set $gl_tex_t (f32.load offset=24 (local.get $p)))
          (global.set $gl_tex1_s (f32.load offset=28 (local.get $p))) (global.set $gl_tex1_t (f32.load offset=32 (local.get $p)))
          (global.set $gl_tex_r (f32.load offset=52 (local.get $p))) (global.set $gl_tex_q (f32.load offset=56 (local.get $p)))
          (global.set $gl_tex1_r (f32.load offset=60 (local.get $p))) (global.set $gl_tex1_q (f32.load offset=64 (local.get $p)))))
        ;; The current normal belongs only to GL_CURRENT_BIT. Other masks
        ;; must preserve normal changes made after the corresponding push.
        (if (i32.and (i32.load offset=68 (local.get $p)) (i32.const 1)) (then
          (global.set $gl_normal_x (f32.load offset=36 (local.get $p)))
          (global.set $gl_normal_y (f32.load offset=40 (local.get $p)))
          (global.set $gl_normal_z (f32.load offset=44 (local.get $p)))))
        (global.set $gl_shade_model (i32.load offset=48 (local.get $p)))
        (call $heap_free (call $w2g (local.get $p)))))
      (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 86)) (i32.eq (local.get $op) (i32.const 99))) (then
      (local.set $a (i32.load offset=4 (local.get $stack)))
      (local.set $unit (call $gl_client_cap_bit (local.get $a)))
      (if (i32.eq (local.get $op) (i32.const 86))
        (then (global.set $gl_client_bits (i32.or (global.get $gl_client_bits) (local.get $unit))))
        (else (global.set $gl_client_bits (i32.and (global.get $gl_client_bits) (i32.xor (local.get $unit) (i32.const -1))))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 88)) (then
      (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 1)))
      (global.set $gl_vp_size (i32.load offset=4 (local.get $stack))) (global.set $gl_vp_type (i32.load offset=8 (local.get $stack)))
      (global.set $gl_vp_stride (i32.load offset=12 (local.get $stack))) (global.set $gl_vp_guest (i32.load offset=16 (local.get $stack))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 89)) (then
      (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 2)))
      (global.set $gl_np_type (i32.load offset=4 (local.get $stack))) (global.set $gl_np_stride (i32.load offset=8 (local.get $stack)))
      (global.set $gl_np_guest (i32.load offset=12 (local.get $stack))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 100)) (then
      (if (global.get $gl_client_tex_unit)
        (then (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 16)))
          (global.set $gl_tp1_size (i32.load offset=4 (local.get $stack))) (global.set $gl_tp1_type (i32.load offset=8 (local.get $stack)))
          (global.set $gl_tp1_stride (i32.load offset=12 (local.get $stack))) (global.set $gl_tp1_guest (i32.load offset=16 (local.get $stack))))
        (else (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 8)))
          (global.set $gl_tp0_size (i32.load offset=4 (local.get $stack))) (global.set $gl_tp0_type (i32.load offset=8 (local.get $stack)))
          (global.set $gl_tp0_stride (i32.load offset=12 (local.get $stack))) (global.set $gl_tp0_guest (i32.load offset=16 (local.get $stack)))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 101)) (then
      (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 4)))
      (global.set $gl_cp_size (i32.load offset=4 (local.get $stack))) (global.set $gl_cp_type (i32.load offset=8 (local.get $stack)))
      (global.set $gl_cp_stride (i32.load offset=12 (local.get $stack))) (global.set $gl_cp_guest (i32.load offset=16 (local.get $stack))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 106)) (then
      (local.set $unit (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0)))
      (if (i32.lt_u (local.get $unit) (i32.const 2)) (then (global.set $gl_client_tex_unit (local.get $unit))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 87)) (then
      (call $gl_state_array_element (i32.load offset=4 (local.get $stack))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 102)) (then
      (local.set $count (i32.load offset=8 (local.get $stack)))
      (local.set $a (i32.load offset=12 (local.get $stack)))
      (local.set $p (i32.load offset=16 (local.get $stack)))
      (local.set $b (call $gl_array_type_bytes (local.get $a)))
      (if (i32.eqz (local.get $b)) (then (return (i32.const 1))))
      (if (i32.or (i32.eqz (i32.and (global.get $gl_client_bits) (i32.const 1)))
          (i32.or (i32.eqz (i32.and (global.get $gl_state_pointer_bits) (i32.const 1)))
            (i32.eqz (call $gl_array_type_bytes (global.get $gl_vp_type)))))
        (then (return (i32.const 1))))
      ;; DrawElements updates array-derived attributes while assembling the
      ;; draw, then restores the caller's current attributes on return.
      (drop (call $gl_state_intercept (i32.const 76) (local.get $stack)))
      ;; Internal save/restore covers current attributes regardless of mode.
      (i32.store offset=68 (global.get $gl_state_attrib_head) (i32.const 1))
      (global.set $gl_immediate_mode (i32.load offset=4 (local.get $stack)))
      (global.set $gl_immediate_floats (i32.const 0))
      (global.set $gl_immediate_has_source (i32.const 0))
      ;; $p stays a guest address and each index is translated on its own:
      ;; the index array may run past the end of a guest page (see
      ;; $gl_array_read).
      (loop $indices (if (i32.lt_u (local.get $i) (local.get $count)) (then
        (local.set $w (call $g2w (local.get $p)))
        (if (i32.eq (local.get $a) (i32.const 0x1400)) (then (local.set $unit (i32.load8_s (local.get $w)))))
        (if (i32.eq (local.get $a) (i32.const 0x1401)) (then (local.set $unit (i32.load8_u (local.get $w)))))
        (if (i32.eq (local.get $a) (i32.const 0x1402)) (then (local.set $unit (i32.load16_s (local.get $w)))))
        (if (i32.eq (local.get $a) (i32.const 0x1403)) (then (local.set $unit (i32.load16_u (local.get $w)))))
        (if (i32.or (i32.eq (local.get $a) (i32.const 0x1404))
            (i32.eq (local.get $a) (i32.const 0x1405))) (then (local.set $unit (i32.load (local.get $w)))))
        (if (i32.eq (local.get $a) (i32.const 0x1406))
          (then (local.set $unit (i32.trunc_sat_f32_s (f32.load (local.get $w))))))
        (if (i32.eq (local.get $a) (i32.const 0x140A))
          (then (local.set $unit (i32.trunc_sat_f64_s (f64.load (local.get $w))))))
        (call $gl_state_array_element (local.get $unit))
        (local.set $p (i32.add (local.get $p) (local.get $b))) (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $indices))))
      (drop (call $gl_finish_immediate))
      (drop (call $gl_state_intercept (i32.const 77) (local.get $stack)))
      (return (i32.const 1))))
    ;; glDrawArrays(mode, first, count): DrawElements with the implicit index
    ;; sequence first .. first+count-1, under the same array preconditions.
    (if (i32.eq (local.get $op) (i32.const 108)) (then
      (local.set $a (i32.load offset=8 (local.get $stack)))
      (local.set $count (i32.load offset=12 (local.get $stack)))
      (if (i32.or (i32.lt_s (local.get $count) (i32.const 1)) (i32.lt_s (local.get $a) (i32.const 0)))
        (then (return (i32.const 1))))
      (if (i32.or (i32.eqz (i32.and (global.get $gl_client_bits) (i32.const 1)))
          (i32.or (i32.eqz (i32.and (global.get $gl_state_pointer_bits) (i32.const 1)))
            (i32.eqz (call $gl_array_type_bytes (global.get $gl_vp_type)))))
        (then (return (i32.const 1))))
      (drop (call $gl_state_intercept (i32.const 76) (local.get $stack)))
      ;; Internal save/restore covers current attributes regardless of mode.
      (i32.store offset=68 (global.get $gl_state_attrib_head) (i32.const 1))
      (global.set $gl_immediate_mode (i32.load offset=4 (local.get $stack)))
      (global.set $gl_immediate_floats (i32.const 0))
      (global.set $gl_immediate_has_source (i32.const 0))
      (loop $elements (if (i32.lt_u (local.get $i) (local.get $count)) (then
        (call $gl_state_array_element (i32.add (local.get $a) (local.get $i)))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $elements))))
      (drop (call $gl_finish_immediate))
      (drop (call $gl_state_intercept (i32.const 77) (local.get $stack)))
      (return (i32.const 1))))
    (i32.const 0))

  (func $gl_state_reset
    (local $node i32) (local $next i32)
    (call $gl_state_save (global.get $gl_current_context))
    (call $gl_state_defaults)
    (local.set $node (i32.atomic.load (region.addr $GL_MTX_BLOCKS 12)))
    (block $done (loop $free
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next (i32.load offset=4 (local.get $node)))
      (if (i32.eq (i32.load offset=12 (local.get $node)) (global.get $current_thread_id))
        (then (call $gl_state_context_deleted (i32.load (local.get $node)))))
      (local.set $node (local.get $next)) (br $free))))

  ;; OpenGL 1.1 signed normals use the endpoint-linear signed conversion,
  ;; shared with signed current colors. Decode in binary64 and demote only
  ;; at the authoritative float current-normal boundary. No length rescaling.
  (func $gl_normal_typed_component (param $p i32) (param $bits i32) (result f32)
    (if (result f32) (i32.eq (local.get $bits) (i32.const 64))
      (then (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p)))))
      (else (call $gl_color_integer_component (local.get $p) (local.get $bits) (i32.const 1)))))

  ;; All eight typed entrypoints snapshot to opcode63 BEFORE list interception.
  ;; DWORD scalar slots and tightly packed vectors have different strides;
  ;; binary64 scalar slots occupy two DWORDs. Read guest addresses separately
  ;; so neither a vector nor an argument may assume adjacent backing pages.
  (func $handle_glNormal_typed (param $bits i32) (param $vector i32)
    (local $esp i32) (local $p i32) (local $stride i32) (local $last i32)
    (local $guest i32) (local $stack i32)
    (local $x f32) (local $y f32) (local $z f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xfffffffb)) (then (unreachable)))
    (local.set $p (i32.add (local.get $esp) (i32.const 4)))
    (if (local.get $vector) (then
      ;; The pointer slot can itself cross sparse pages. Reject a missing
      ;; slot before interpreting sentinel bytes as a guest vector address.
      (if (i32.gt_u (local.get $p) (i32.const 0xfffffffc)) (then (unreachable)))
      (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
      (if (i32.eq (call $g2w (i32.add (local.get $p) (i32.const 3))) (global.get $NULL_SENTINEL)) (then (unreachable)))
      (local.set $p (call $gl32 (local.get $p)))))
    (local.set $stride (select (i32.shr_u (local.get $bits) (i32.const 3))
      (i32.const 4) (i32.or (local.get $vector) (i32.eq (local.get $bits) (i32.const 64)))))
    (local.set $last (i32.sub (i32.add (i32.mul (local.get $stride) (i32.const 2))
      (i32.shr_u (local.get $bits) (i32.const 3))) (i32.const 1)))
    ;; At most 24 bytes: validating both endpoint pages covers every byte.
    ;; Validate before any current-state, list, heap or register mutation.
    (if (i32.gt_u (local.get $p) (i32.sub (i32.const -1) (local.get $last))) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (local.get $last))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $x (call $gl_normal_typed_component (local.get $p) (local.get $bits)))
    (local.set $y (call $gl_normal_typed_component (i32.add (local.get $p) (local.get $stride)) (local.get $bits)))
    (local.set $z (call $gl_normal_typed_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 2))) (local.get $bits)))
    (local.set $guest (call $gl_alloc_affine (i32.const 16)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $x))
    (f32.store offset=8 (local.get $stack) (local.get $y))
    (f32.store offset=12 (local.get $stack) (local.get $z))
    (drop (call $gl_wat_encode_call (i32.const 63) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp)
      (select (i32.const 8) (select (i32.const 28) (i32.const 16)
        (i32.eq (local.get $bits) (i32.const 64))) (local.get $vector)))))

  ;; Six GLdouble eye-space equations at +768; enables at +960. Zeroed
  ;; context allocation supplies GL's defaults. Worker draws use a snapshot.
  (global $gl_clip_override (mut i32) (i32.const 0))
  (func $gl_clip_state (result i32)
    (local $ctx i32)
    (if (global.get $gl_clip_override) (then (return (global.get $gl_clip_override))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (i32.add (local.get $ctx) (i32.const 768)))

  (func $gl_clip_enabled (param $plane i32) (result i32)
    (if (i32.eqz (call $gl_clip_state)) (then (return (i32.const 0))))
    (i32.ne (i32.and (i32.load offset=192 (call $gl_clip_state))
      (i32.shl (i32.const 1) (local.get $plane))) (i32.const 0)))

  ;; A plane/eye homogeneous dot product; no divide by eye w.
  (func $gl_clip_distance (param $plane i32) (param $eye i32) (result f64)
    (local $p i32) (local $i i32) (local $d f64)
    (local.set $p (i32.add (call $gl_clip_state) (i32.shl (local.get $plane) (i32.const 5))))
    (loop $dot
      (local.set $d (f64.add (local.get $d)
        (f64.mul (f64.load (i32.add (local.get $p) (i32.shl (local.get $i) (i32.const 3))))
          (f64.promote_f32 (f32.load (i32.add (local.get $eye) (i32.shl (local.get $i) (i32.const 2))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $dot (i32.lt_u (local.get $i) (i32.const 4))))
    (local.get $d))

  ;; Runs before display-list capture. Rejected calls neither enter lists nor
  ;; change native/host state, even when their pointer is inaccessible.
  (func $gl_clip_validate (param $ctx i32) (param $op i32) (param $stack i32) (result i32)
    (local $cap i32) (local $index i32)
    (local.set $cap (i32.load offset=4 (local.get $stack)))
    (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 148))
        (i32.and (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10)))
          (i32.lt_u (i32.sub (local.get $cap) (i32.const 0x3000)) (i32.const 0x1000)))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $index (i32.sub (local.get $cap) (i32.const 0x3000)))
    (if (i32.ge_u (local.get $index) (i32.const 6))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 148))
      (then (call $gl_texcoord_check (i32.load offset=8 (local.get $stack)) (i32.const 32))))
    (i32.const 0))

  (func $gl_clip_observe (param $op i32) (param $stack i32)
    (local $s i32) (local $i i32) (local $mask i32)
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (local.set $i (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x3000)))
    (if (i32.ge_u (local.get $i) (i32.const 6)) (then (return)))
    (local.set $s (call $gl_clip_state))
    (if (i32.eq (local.get $op) (i32.const 148)) (then
      (call $gl_clip_eye_plane (call $gl_mtx_block)
        (i32.add (local.get $s) (i32.shl (local.get $i) (i32.const 5)))
        (i32.load offset=8 (local.get $stack))) (return)))
    (local.set $mask (i32.shl (i32.const 1) (local.get $i)))
    (if (i32.eq (local.get $op) (i32.const 10))
      (then (i32.store offset=192 (local.get $s) (i32.or (i32.load offset=192 (local.get $s)) (local.get $mask)))))
    (if (i32.eq (local.get $op) (i32.const 8))
      (then (i32.store offset=192 (local.get $s) (i32.and (i32.load offset=192 (local.get $s))
        (i32.xor (local.get $mask) (i32.const -1)))))))

  (func $gl_clip_query (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $cap i32)
    (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 65))
        (i32.or (i32.eq (local.get $op) (i32.const 13))
          (i32.or (i32.eq (local.get $op) (i32.const 103)) (i32.eq (local.get $op) (i32.const 145))))))
      (then (return (i32.const 0))))
    (local.set $cap (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x3000)))
    (if (i32.ge_u (local.get $cap) (i32.const 0x1000)) (then (return (i32.const 0))))
    (global.set $gl_list_result (i32.const 0))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 1))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (if (i32.ge_u (local.get $cap) (i32.const 6))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (global.set $gl_list_result (call $gl_clip_enabled (local.get $cap)))
    (i32.const 1))

  ;; GL1.1 2.11: solve M^T * eye = equation without narrowing GLdouble.
  (func $gl_clip_eye_plane (param $b i32) (param $dst i32) (param $p i32)
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
      (f64.store offset=32 (local.get $ar) (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $p) (i32.shl (local.get $row) (i32.const 3))))))
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
        (f64.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 3)))
          (f64.load (i32.add (local.get $a)
            (i32.add (i32.mul (local.get $i) (i32.const 40)) (i32.const 32)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $result (i32.lt_u (local.get $i) (i32.const 4)))))
    (call $heap_free (call $w2g (local.get $a))))

  ;; Query the saved x86 address itself. Never translate/dereference a client
  ;; pointer merely to report it, and do not confuse NULL with an unset array.
  (func $gl_pointer_query (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $p i32) (local $value i32) (local $out i32) (local $i i32)
    (if (i32.ne (local.get $op) (i32.const 162)) (then (return (i32.const 0))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 1))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $p (i32.load offset=4 (local.get $stack)))
    (block $selected
      (if (i32.eq (local.get $p) (i32.const 0x808e)) (then
        (local.set $value (global.get $gl_vp_guest)) (br $selected)))
      (if (i32.eq (local.get $p) (i32.const 0x808f)) (then
        (local.set $value (global.get $gl_np_guest)) (br $selected)))
      (if (i32.eq (local.get $p) (i32.const 0x8090)) (then
        (local.set $value (global.get $gl_cp_guest)) (br $selected)))
      (if (i32.eq (local.get $p) (i32.const 0x8092)) (then
        (local.set $value (select (global.get $gl_tp1_guest) (global.get $gl_tp0_guest)
          (global.get $gl_client_tex_unit))) (br $selected)))
      ;; Selection/feedback and index/edge arrays have no supported state.
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1)))
    (local.set $out (i32.load offset=8 (local.get $stack)))
    (if (i32.gt_u (local.get $out) (i32.const 0xfffffffc)) (then (unreachable)))
    (loop $validate_pointer_output
      (if (i32.eq (call $g2w (i32.add (local.get $out) (local.get $i))) (global.get $NULL_SENTINEL)) (then (unreachable)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $validate_pointer_output (i32.lt_u (local.get $i) (i32.const 4))))
    (call $gs32 (local.get $out) (local.get $value))
    (i32.const 1))

  ;; The complete GL1.1 array enable set shares one context/client-stack word.
  (func $gl_client_cap_bit (param $cap i32) (result i32)
    (if (i32.eq (local.get $cap) (i32.const 0x8074)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $cap) (i32.const 0x8075)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $cap) (i32.const 0x8076)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $cap) (i32.const 0x8077)) (then (return (i32.const 32))))
    (if (i32.eq (local.get $cap) (i32.const 0x8079)) (then (return (i32.const 64))))
    (if (i32.eq (local.get $cap) (i32.const 0x8078)) (then
      (return (select (i32.const 16) (i32.const 8) (global.get $gl_client_tex_unit)))))
    (i32.const 0))

  (func $gl_client_enable_query (param $op i32) (param $stack i32) (result i32)
    (local $bit i32) (local $ctx i32)
    (if (i32.ne (local.get $op) (i32.const 65)) (then (return (i32.const 0))))
    (local.set $bit (call $gl_client_cap_bit (i32.load offset=4 (local.get $stack))))
    (if (i32.eqz (local.get $bit)) (then (return (i32.const 0))))
    (global.set $gl_list_result (i32.const 0))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 1))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x502)))
      (else (global.set $gl_list_result
        (i32.ne (i32.and (global.get $gl_client_bits) (local.get $bit)) (i32.const 0)))))
    (i32.const 1))

  ;; GL 1.1 section 2.8, table 2.5 and its equivalent command sequence.
  (func $gl_interleaved_intercept (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $format i32) (local $stride i32) (local $base i32)
    (local $vs i32) (local $ts i32) (local $cs i32) (local $ct i32)
    (local $co i32) (local $no i32) (local $vo i32) (local $packed i32)
    (local $normal i32) (local $bits i32) (local $texture_bit i32)
    (if (i32.ne (local.get $op) (i32.const 177)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 1))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $format (i32.load offset=4 (local.get $stack)))
    (local.set $stride (i32.load offset=8 (local.get $stack)))
    (if (i32.gt_u (i32.sub (local.get $format) (i32.const 0x2a20)) (i32.const 13)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (if (i32.lt_s (local.get $stride) (i32.const 0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const 1))))
    (local.set $base (i32.load offset=12 (local.get $stack)))
    (local.set $vs (i32.const 3)) (local.set $ct (i32.const 0x1406))
    ;; Layout cases are encoded locally, independently of test literal layouts.
    (if (i32.eq (local.get $format) (i32.const 0x2a20)) (then
      (local.set $vs (i32.const 2)) (local.set $packed (i32.const 8))))
    (if (i32.eq (local.get $format) (i32.const 0x2a21)) (then
      (local.set $packed (i32.const 12))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x2a22))
                (i32.eq (local.get $format) (i32.const 0x2a23))) (then
      (local.set $cs (i32.const 4)) (local.set $ct (i32.const 0x1401))
      (local.set $vo (i32.const 4))
      (local.set $vs (select (i32.const 2) (i32.const 3) (i32.eq (local.get $format) (i32.const 0x2a22))))
      (local.set $packed (i32.add (i32.const 4) (i32.mul (local.get $vs) (i32.const 4))))))
    (if (i32.eq (local.get $format) (i32.const 0x2a24)) (then
      (local.set $cs (i32.const 3)) (local.set $vo (i32.const 12)) (local.set $packed (i32.const 24))))
    (if (i32.eq (local.get $format) (i32.const 0x2a25)) (then
      (local.set $normal (i32.const 1)) (local.set $vo (i32.const 12)) (local.set $packed (i32.const 24))))
    (if (i32.eq (local.get $format) (i32.const 0x2a26)) (then
      (local.set $cs (i32.const 4)) (local.set $normal (i32.const 1))
      (local.set $no (i32.const 16)) (local.set $vo (i32.const 28)) (local.set $packed (i32.const 40))))
    (if (i32.eq (local.get $format) (i32.const 0x2a27)) (then
      (local.set $ts (i32.const 2)) (local.set $vo (i32.const 8)) (local.set $packed (i32.const 20))))
    (if (i32.eq (local.get $format) (i32.const 0x2a28)) (then
      (local.set $ts (i32.const 4)) (local.set $vs (i32.const 4))
      (local.set $vo (i32.const 16)) (local.set $packed (i32.const 32))))
    (if (i32.eq (local.get $format) (i32.const 0x2a29)) (then
      (local.set $ts (i32.const 2)) (local.set $cs (i32.const 4)) (local.set $ct (i32.const 0x1401))
      (local.set $co (i32.const 8)) (local.set $vo (i32.const 12)) (local.set $packed (i32.const 24))))
    (if (i32.eq (local.get $format) (i32.const 0x2a2a)) (then
      (local.set $ts (i32.const 2)) (local.set $cs (i32.const 3))
      (local.set $co (i32.const 8)) (local.set $vo (i32.const 20)) (local.set $packed (i32.const 32))))
    (if (i32.eq (local.get $format) (i32.const 0x2a2b)) (then
      (local.set $ts (i32.const 2)) (local.set $normal (i32.const 1))
      (local.set $no (i32.const 8)) (local.set $vo (i32.const 20)) (local.set $packed (i32.const 32))))
    (if (i32.eq (local.get $format) (i32.const 0x2a2c)) (then
      (local.set $ts (i32.const 2)) (local.set $cs (i32.const 4)) (local.set $normal (i32.const 1))
      (local.set $co (i32.const 8)) (local.set $no (i32.const 24))
      (local.set $vo (i32.const 36)) (local.set $packed (i32.const 48))))
    (if (i32.eq (local.get $format) (i32.const 0x2a2d)) (then
      (local.set $ts (i32.const 4)) (local.set $cs (i32.const 4)) (local.set $normal (i32.const 1))
      (local.set $vs (i32.const 4)) (local.set $co (i32.const 16)) (local.set $no (i32.const 32))
      (local.set $vo (i32.const 44)) (local.set $packed (i32.const 60))))
    (if (i32.eqz (local.get $stride)) (then (local.set $stride (local.get $packed))))
    ;; Preserve the other texture unit and any unrelated future client bits.
    (local.set $texture_bit (select (i32.const 16) (i32.const 8) (global.get $gl_client_tex_unit)))
    (local.set $bits (i32.or (i32.and (global.get $gl_client_bits)
      (i32.xor (i32.or (i32.const 103) (local.get $texture_bit)) (i32.const -1))) (i32.const 1)))
    (global.set $gl_vp_size (local.get $vs)) (global.set $gl_vp_type (i32.const 0x1406))
    (global.set $gl_vp_stride (local.get $stride)) (global.set $gl_vp_guest (i32.add (local.get $base) (local.get $vo)))
    (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 1)))
    (if (local.get $cs) (then
      (local.set $bits (i32.or (local.get $bits) (i32.const 4)))
      (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 4)))
      (global.set $gl_cp_size (local.get $cs)) (global.set $gl_cp_type (local.get $ct))
      (global.set $gl_cp_stride (local.get $stride)) (global.set $gl_cp_guest (i32.add (local.get $base) (local.get $co)))))
    (if (local.get $normal) (then
      (local.set $bits (i32.or (local.get $bits) (i32.const 2)))
      (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (i32.const 2)))
      (global.set $gl_np_type (i32.const 0x1406)) (global.set $gl_np_stride (local.get $stride))
      (global.set $gl_np_guest (i32.add (local.get $base) (local.get $no)))))
    (if (local.get $ts) (then
      (local.set $bits (i32.or (local.get $bits) (local.get $texture_bit)))
      (global.set $gl_state_pointer_bits (i32.or (global.get $gl_state_pointer_bits) (local.get $texture_bit)))
      (if (global.get $gl_client_tex_unit)
        (then (global.set $gl_tp1_size (local.get $ts)) (global.set $gl_tp1_type (i32.const 0x1406))
          (global.set $gl_tp1_stride (local.get $stride)) (global.set $gl_tp1_guest (local.get $base)))
        (else (global.set $gl_tp0_size (local.get $ts)) (global.set $gl_tp0_type (i32.const 0x1406))
          (global.set $gl_tp0_stride (local.get $stride)) (global.set $gl_tp0_guest (local.get $base))))))
    (global.set $gl_client_bits (local.get $bits))
    (i32.const 1))

  ;; Hints are context-owned server values. The process GL lock protects the
  ;; shared five-word tail; a foreign producer never needs to rebind or query
  ;; the source to observe a completed hint. Raster quality remains advisory.
  (func $gl_hint_target (param $target i32) (result i32)
    (i32.le_u (i32.sub (local.get $target) (i32.const 0xc50)) (i32.const 4)))
  (func $gl_hint_ptr (param $ctx i32) (param $target i32) (result i32)
    (i32.add (local.get $ctx) (i32.add (i32.const 1008)
      (i32.shl (i32.sub (local.get $target) (i32.const 0xc50)) (i32.const 2)))))
  (func $gl_hint_defaults (param $ctx i32)
    (local $i i32)
    (loop $hints
      (i32.store (i32.add (local.get $ctx) (i32.add (i32.const 1008)
        (i32.shl (local.get $i) (i32.const 2)))) (i32.const 0x1100))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $hints (i32.lt_u (local.get $i) (i32.const 5)))))
  (func $gl_hint_validate (param $ctx i32) (param $op i32) (param $stack i32) (result i32)
    (if (i32.ne (local.get $op) (i32.const 75)) (then (return (i32.const 0))))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.load offset=36 (local.get $ctx))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (if (i32.or (i32.eqz (call $gl_hint_target (i32.load offset=4 (local.get $stack))))
        (i32.gt_u (i32.sub (i32.load offset=8 (local.get $stack)) (i32.const 0x1100)) (i32.const 2))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (i32.const 0))
  (func $gl_hint_observe (param $op i32) (param $stack i32)
    (if (i32.and (i32.eq (local.get $op) (i32.const 75))
        (i32.ne (global.get $gl_current_context) (i32.const 0))) (then
      (i32.store (call $gl_hint_ptr (call $gl_list_context) (i32.load offset=4 (local.get $stack)))
        (i32.load offset=8 (local.get $stack))))))
