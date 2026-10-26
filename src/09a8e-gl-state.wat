  ;; OpenGL current attributes and client-array frontend. Kept separate from
  ;; record transport so the byte-stream encoder remains mechanically small.
  ;; $gl_state_intercept returns 1 when the call was fully consumed here.

  ;; Linked context nodes are { key, next, state }. Both nodes and state live
  ;; for the process lifetime, matching JS Map identity without a slot ceiling.
  (global $gl_state_contexts (mut i32) (i32.const 0))
  (global $gl_state_free_contexts (mut i32) (i32.const 0))
  (global $gl_state_attrib_head (mut i32) (i32.const 0))
  (global $gl_state_attrib_depth (mut i32) (i32.const 0))
  (global $gl_state_pointer_bits (mut i32) (i32.const 0))

  (func $gl_state_slot (param $context i32) (param $create i32) (result i32)
    (local $p i32) (local $guest i32) (local $state i32)
    (local.set $p (global.get $gl_state_contexts))
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
        (local.set $guest (call $heap_alloc (i32.const 12)))
        (if (i32.eqz (local.get $guest)) (then (unreachable)))
        (local.set $p (call $g2w (local.get $guest)))
        (local.set $guest (call $heap_alloc (i32.const 176)))
        (if (i32.eqz (local.get $guest)) (then
          (call $heap_free (call $w2g (local.get $p))) (unreachable)))
        (local.set $state (call $g2w (local.get $guest)))))
    (memory.fill (local.get $state) (i32.const 0) (i32.const 176))
    (i32.store (local.get $p) (local.get $context))
    (i32.store offset=4 (local.get $p) (global.get $gl_state_contexts))
    (i32.store offset=8 (local.get $p) (local.get $state))
    (global.set $gl_state_contexts (local.get $p))
    (local.get $state))

  (func $gl_state_save (param $context i32)
    (local $p i32)
    (local.set $p (call $gl_state_slot (local.get $context) (i32.const 1)))
    (if (i32.eqz (local.get $p)) (then (return)))
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
    (i32.store offset=144 (local.get $p) (global.get $gl_state_pointer_bits))
    (f32.store offset=148 (local.get $p) (global.get $gl_tex_r))
    (f32.store offset=152 (local.get $p) (global.get $gl_tex_q))
    (f32.store offset=156 (local.get $p) (global.get $gl_tex1_r))
    (f32.store offset=160 (local.get $p) (global.get $gl_tex1_q)))

  (func $gl_state_defaults
    (global.set $gl_color_r (f32.const 1)) (global.set $gl_color_g (f32.const 1))
    (global.set $gl_color_b (f32.const 1)) (global.set $gl_color_a (f32.const 1))
    (global.set $gl_tex_s (f32.const 0)) (global.set $gl_tex_t (f32.const 0))
    (global.set $gl_tex1_s (f32.const 0)) (global.set $gl_tex1_t (f32.const 0))
    (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1))
    (global.set $gl_tex1_r (f32.const 0)) (global.set $gl_tex1_q (f32.const 1))
    (global.set $gl_normal_x (f32.const 0)) (global.set $gl_normal_y (f32.const 0))
    (global.set $gl_normal_z (f32.const 1)) (global.set $gl_shade_model (i32.const 0x1D01))
    (global.set $gl_client_bits (i32.const 0)) (global.set $gl_client_tex_unit (i32.const 0))
    (global.set $gl_vp_size (i32.const 0)) (global.set $gl_np_type (i32.const 0))
    (global.set $gl_cp_size (i32.const 0)) (global.set $gl_tp0_size (i32.const 0))
    (global.set $gl_tp1_size (i32.const 0))
    (global.set $gl_state_attrib_head (i32.const 0))
    (global.set $gl_state_attrib_depth (i32.const 0))
    (global.set $gl_state_pointer_bits (i32.const 0)))

  (func $gl_state_context_changed (param $context i32)
    (local $p i32)
    (call $gl_state_save (global.get $gl_current_context))
    (call $gl_state_defaults)
    (local.set $p (call $gl_state_slot (local.get $context) (i32.const 0)))
    (if (local.get $p) (then
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
    (local.set $node (global.get $gl_state_contexts))
    (block $done
      (loop $find
        (br_if $done (i32.eqz (local.get $node)))
        (local.set $next (i32.load offset=4 (local.get $node)))
        (if (i32.eq (i32.load (local.get $node)) (local.get $context)) (then
          (if (local.get $prev)
            (then (i32.store offset=4 (local.get $prev) (local.get $next)))
            (else (global.set $gl_state_contexts (local.get $next))))
          (local.set $state (i32.load offset=8 (local.get $node)))
          (call $gl_state_free_attribs (i32.load offset=136 (local.get $state)))
          (memory.fill (local.get $state) (i32.const 0) (i32.const 176))
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
    (local $p i32) (local $b i32) (local $x f32) (local $y f32) (local $z f32)
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
      (if (i32.gt_u (global.get $gl_cp_size) (i32.const 0)) (then
        (global.set $gl_color_r (call $gl_array_read (local.get $p) (global.get $gl_cp_type) (i32.const 1)))))
      (if (i32.gt_u (global.get $gl_cp_size) (i32.const 1)) (then
        (global.set $gl_color_g (call $gl_array_read (i32.add (local.get $p) (local.get $b)) (global.get $gl_cp_type) (i32.const 1)))))
      (if (i32.gt_u (global.get $gl_cp_size) (i32.const 2)) (then
        (global.set $gl_color_b (call $gl_array_read (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 2))) (global.get $gl_cp_type) (i32.const 1)))))
      (if (i32.gt_u (global.get $gl_cp_size) (i32.const 3))
        (then (global.set $gl_color_a (call $gl_array_read (i32.add (local.get $p) (i32.mul (local.get $b) (i32.const 3))) (global.get $gl_cp_type) (i32.const 1))))
        (else (global.set $gl_color_a (f32.const 1))))))
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

  (func $gl_state_intercept (param $op i32) (param $stack i32) (result i32)
    (local $a i32) (local $unit i32) (local $i i32) (local $count i32) (local $p i32) (local $b i32)
    (local $w i32) (local $z f32)
    (if (i32.eq (local.get $op) (i32.const 23)) (then
      (global.set $gl_color_r (f32.load offset=4 (local.get $stack))) (global.set $gl_color_g (f32.load offset=8 (local.get $stack)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $stack))) (global.set $gl_color_a (f32.const 1)) (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 24)) (i32.eq (local.get $op) (i32.const 26))) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (global.set $gl_color_r (f32.load (local.get $p))) (global.set $gl_color_g (f32.load offset=4 (local.get $p)))
      (global.set $gl_color_b (f32.load offset=8 (local.get $p)))
      (if (i32.eq (local.get $op) (i32.const 26))
        (then (global.set $gl_color_a (f32.load offset=12 (local.get $p))))
        (else (global.set $gl_color_a (f32.const 1))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 25)) (then
      (global.set $gl_color_r (f32.load offset=4 (local.get $stack))) (global.set $gl_color_g (f32.load offset=8 (local.get $stack)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $stack))) (global.set $gl_color_a (f32.load offset=16 (local.get $stack))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 27)) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (global.set $gl_color_r (f32.div (f32.convert_i32_u (i32.load8_u (local.get $p))) (f32.const 255)))
      (global.set $gl_color_g (f32.div (f32.convert_i32_u (i32.load8_u offset=1 (local.get $p))) (f32.const 255)))
      (global.set $gl_color_b (f32.div (f32.convert_i32_u (i32.load8_u offset=2 (local.get $p))) (f32.const 255)))
      (global.set $gl_color_a (f32.div (f32.convert_i32_u (i32.load8_u offset=3 (local.get $p))) (f32.const 255))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 56)) (then
      (global.set $gl_color_r (f32.div (f32.convert_i32_u (i32.and (i32.load offset=4 (local.get $stack)) (i32.const 255))) (f32.const 255)))
      (global.set $gl_color_g (f32.div (f32.convert_i32_u (i32.and (i32.load offset=8 (local.get $stack)) (i32.const 255))) (f32.const 255)))
      (global.set $gl_color_b (f32.div (f32.convert_i32_u (i32.and (i32.load offset=12 (local.get $stack)) (i32.const 255))) (f32.const 255)))
      (global.set $gl_color_a (f32.div (f32.convert_i32_u (i32.and (i32.load offset=16 (local.get $stack)) (i32.const 255))) (f32.const 255))) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 58)) (then
      (local.set $p (call $g2w (i32.load offset=4 (local.get $stack))))
      (global.set $gl_color_r (f32.div (f32.convert_i32_u (i32.load8_u (local.get $p))) (f32.const 255)))
      (global.set $gl_color_g (f32.div (f32.convert_i32_u (i32.load8_u offset=1 (local.get $p))) (f32.const 255)))
      (global.set $gl_color_b (f32.div (f32.convert_i32_u (i32.load8_u offset=2 (local.get $p))) (f32.const 255)))
      (global.set $gl_color_a (f32.const 1)) (return (i32.const 1))))
    ;; 111 glColor3ub(r, g, b): GLubyte arguments widened to stack words.
    (if (i32.eq (local.get $op) (i32.const 111)) (then
      (global.set $gl_color_r (f32.div (f32.convert_i32_u (i32.and (i32.load offset=4 (local.get $stack)) (i32.const 255))) (f32.const 255)))
      (global.set $gl_color_g (f32.div (f32.convert_i32_u (i32.and (i32.load offset=8 (local.get $stack)) (i32.const 255))) (f32.const 255)))
      (global.set $gl_color_b (f32.div (f32.convert_i32_u (i32.and (i32.load offset=12 (local.get $stack)) (i32.const 255))) (f32.const 255)))
      (global.set $gl_color_a (f32.const 1)) (return (i32.const 1))))
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
      (local.set $a (call $heap_alloc (i32.const 68)))
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
        (global.set $gl_state_attrib_head (local.get $p))
        (global.set $gl_state_attrib_depth (i32.add (global.get $gl_state_attrib_depth) (i32.const 1)))
      (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 77)) (then
      (if (global.get $gl_state_attrib_head) (then
        (global.set $gl_state_attrib_depth (i32.sub (global.get $gl_state_attrib_depth) (i32.const 1)))
        (local.set $p (global.get $gl_state_attrib_head))
        (global.set $gl_state_attrib_head (i32.load (local.get $p)))
        (global.set $gl_color_r (f32.load offset=4 (local.get $p))) (global.set $gl_color_g (f32.load offset=8 (local.get $p)))
        (global.set $gl_color_b (f32.load offset=12 (local.get $p))) (global.set $gl_color_a (f32.load offset=16 (local.get $p)))
        (global.set $gl_tex_s (f32.load offset=20 (local.get $p))) (global.set $gl_tex_t (f32.load offset=24 (local.get $p)))
        (global.set $gl_tex1_s (f32.load offset=28 (local.get $p))) (global.set $gl_tex1_t (f32.load offset=32 (local.get $p)))
        (global.set $gl_normal_x (f32.load offset=36 (local.get $p))) (global.set $gl_normal_y (f32.load offset=40 (local.get $p)))
        (global.set $gl_normal_z (f32.load offset=44 (local.get $p))) (global.set $gl_shade_model (i32.load offset=48 (local.get $p)))
        (global.set $gl_tex_r (f32.load offset=52 (local.get $p))) (global.set $gl_tex_q (f32.load offset=56 (local.get $p)))
        (global.set $gl_tex1_r (f32.load offset=60 (local.get $p))) (global.set $gl_tex1_q (f32.load offset=64 (local.get $p)))
        (call $heap_free (call $w2g (local.get $p)))))
      (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 86)) (i32.eq (local.get $op) (i32.const 99))) (then
      (local.set $a (i32.load offset=4 (local.get $stack)))
      (local.set $unit (i32.const 0))
      (if (i32.eq (local.get $a) (i32.const 0x8078))
        (then (local.set $unit (select (i32.const 16) (i32.const 8) (global.get $gl_client_tex_unit)))))
      (if (i32.eq (local.get $a) (i32.const 0x8074)) (then (local.set $unit (i32.const 1))))
      (if (i32.eq (local.get $a) (i32.const 0x8075)) (then (local.set $unit (i32.const 2))))
      (if (i32.eq (local.get $a) (i32.const 0x8076)) (then (local.set $unit (i32.const 4))))
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
      (global.set $gl_immediate_mode (i32.load offset=4 (local.get $stack)))
      (global.set $gl_immediate_floats (i32.const 0))
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
      (global.set $gl_immediate_mode (i32.load offset=4 (local.get $stack)))
      (global.set $gl_immediate_floats (i32.const 0))
      (loop $elements (if (i32.lt_u (local.get $i) (local.get $count)) (then
        (call $gl_state_array_element (i32.add (local.get $a) (local.get $i)))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $elements))))
      (drop (call $gl_finish_immediate))
      (drop (call $gl_state_intercept (i32.const 77) (local.get $stack)))
      (return (i32.const 1))))
    (i32.const 0))

  (func $gl_state_reset
    (local $node i32) (local $next i32) (local $state i32)
    (call $gl_state_save (global.get $gl_current_context))
    (call $gl_state_defaults)
    (local.set $node (global.get $gl_state_contexts))
    (loop $free
      (if (i32.eqz (local.get $node)) (then
        (global.set $gl_state_contexts (i32.const 0)) (return)))
      (local.set $next (i32.load offset=4 (local.get $node)))
      (local.set $state (i32.load offset=8 (local.get $node)))
      (call $gl_state_free_attribs (i32.load offset=136 (local.get $state)))
      (memory.fill (local.get $state) (i32.const 0) (i32.const 176))
      (i32.store offset=4 (local.get $node) (global.get $gl_state_free_contexts))
      (global.set $gl_state_free_contexts (local.get $node))
      (local.set $node (local.get $next))
      (br $free)))
