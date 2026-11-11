  (global $gl_source_tag (mut i32) (i32.const 0))
  (global $gl_source_r (mut i32) (i32.const 0))
  (global $gl_source_g (mut i32) (i32.const 0))
  (global $gl_source_b (mut i32) (i32.const 0))
  (global $gl_source_a (mut i32) (i32.const 0))
  ;; Private typed color command; public opcode numbering is unchanged.
  (func $gl_source_arg_words (param $op i32) (result i32)
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 0x10030)) (i32.const 2)) (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 0x10023)) (i32.const 4)) (then
      (return (select (i32.const 0) (i32.const 1)
        (i32.or (i32.eq (local.get $op) (i32.const 0x10024)) (i32.eq (local.get $op) (i32.const 0x10027)))))))
    (if (i32.eq (local.get $op) (i32.const 0x10006)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $op) (i32.const 0x10007)) (then (return (i32.const 0))))
    (if (result i32) (i32.eq (local.get $op) (i32.const 0x10004))
      (then (i32.const 4)) (else
    (if (result i32) (i32.eq (local.get $op) (i32.const 0x10003))
      (then (i32.const 5)) (else (call $gl_arg_words (local.get $op)))))))
  (func $gl_source_save (param $p i32)
    (i32.store offset=0 (local.get $p) (global.get $gl_source_tag))
    (i32.store offset=4 (local.get $p) (global.get $gl_source_r))
    (i32.store offset=8 (local.get $p) (global.get $gl_source_g))
    (i32.store offset=12 (local.get $p) (global.get $gl_source_b))
    (i32.store offset=16 (local.get $p) (global.get $gl_source_a))
  )
  (func $gl_source_restore (param $p i32)
    (global.set $gl_source_tag (i32.load offset=0 (local.get $p)))
    (global.set $gl_source_r (i32.load offset=4 (local.get $p)))
    (global.set $gl_source_g (i32.load offset=8 (local.get $p)))
    (global.set $gl_source_b (i32.load offset=12 (local.get $p)))
    (global.set $gl_source_a (i32.load offset=16 (local.get $p)))
  )
  (func $gl_source_install (param $tag i32) (param $r i32) (param $g i32) (param $b i32) (param $a i32)
    (global.set $gl_source_tag (local.get $tag))
    (global.set $gl_source_r (local.get $r))
    (global.set $gl_source_g (local.get $g))
    (global.set $gl_source_b (local.get $b))
    (global.set $gl_source_a (local.get $a))
    (global.set $gl_color_r (call $gl_source_query (local.get $r) (i32.and (local.get $tag) (i32.const 255)) (i32.and (local.get $tag) (i32.const 256))))
    (global.set $gl_color_g (call $gl_source_query (local.get $g) (i32.and (local.get $tag) (i32.const 255)) (i32.and (local.get $tag) (i32.const 256))))
    (global.set $gl_color_b (call $gl_source_query (local.get $b) (i32.and (local.get $tag) (i32.const 255)) (i32.and (local.get $tag) (i32.const 256))))
    (global.set $gl_color_a (call $gl_source_query (local.get $a) (i32.and (local.get $tag) (i32.const 255)) (i32.and (local.get $tag) (i32.const 256))))
    (if (i32.and (local.get $tag) (i32.const 512)) (then (global.set $gl_color_a (f32.const 1)))))
  (func $gl_source_vertex (param $p i32)
    (f32.store offset=76 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_r) (i32.const 0)) (i32.const 65535))))
    (f32.store offset=80 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_r) (i32.const 16)) (i32.const 65535))))
    (f32.store offset=84 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_g) (i32.const 0)) (i32.const 65535))))
    (f32.store offset=88 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_g) (i32.const 16)) (i32.const 65535))))
    (f32.store offset=92 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_b) (i32.const 0)) (i32.const 65535))))
    (f32.store offset=96 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_b) (i32.const 16)) (i32.const 65535))))
    (f32.store offset=100 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_a) (i32.const 0)) (i32.const 65535))))
    (f32.store offset=104 (local.get $p) (f32.convert_i32_u (i32.and (i32.shr_u (global.get $gl_source_a) (i32.const 16)) (i32.const 65535))))
    (f32.store offset=108 (local.get $p) (f32.convert_i32_u (global.get $gl_source_tag))))
  (global $gl_immediate_has_source (mut i32) (i32.const 0))
  (func $gl_source_packed_stride (param $p i32) (result i32)
    (if (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 0x10009)) (then (return (i32.const 116))))
    (select (i32.const 112) (i32.const 76) (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 0x10002))))
  (func $gl_source_packed_begin (param $mode i32) (param $exact i32) (result i32)
    (local $p i32)
    (local.set $p (call $gl_packed_begin (local.get $mode)))
    (if (local.get $exact) (then (i32.store offset=4 (local.get $p) (i32.const 0x10002))))
    (local.get $p))
  (func $gl_source_query (param $raw i32) (param $bits i32) (param $signed i32) (result f32)
    (local $shift i32) (local $c i32) (local $value f64) (local $den f64)
    (local.set $shift (i32.sub (i32.const 32) (local.get $bits)))
    (local.set $c (i32.shr_u (i32.shl (local.get $raw) (local.get $shift)) (local.get $shift)))
    (local.set $den (f64.convert_i64_u
      (i64.sub (i64.shl (i64.const 1) (i64.extend_i32_u (local.get $bits))) (i64.const 1))))
    (if (local.get $signed)
      (then
        (local.set $c (i32.shr_s (i32.shl (local.get $c) (local.get $shift)) (local.get $shift)))
        (local.set $value (f64.add (f64.mul (f64.convert_i32_s (local.get $c)) (f64.const 2)) (f64.const 1))))
      (else (local.set $value (f64.convert_i32_u (local.get $c)))))
    (f32.demote_f64 (f64.div (local.get $value) (local.get $den))))

  (func $gl_source_u8 (param $raw i32) (param $tag i32) (param $alpha i32) (result i32)
    (local $bits i32) (local $shift i32) (local $c i32) (local $value f64) (local $den f64)
    (if (i32.and (i32.ne (local.get $alpha) (i32.const 0))
        (i32.ne (i32.and (local.get $tag) (i32.const 0x200)) (i32.const 0)))
      (then (return (i32.const 255))))
    (local.set $bits (i32.and (local.get $tag) (i32.const 255)))
    (if (i32.eqz (i32.or (i32.eq (local.get $bits) (i32.const 8))
        (i32.or (i32.eq (local.get $bits) (i32.const 16))
          (i32.eq (local.get $bits) (i32.const 32))))) (then (unreachable)))
    (local.set $shift (i32.sub (i32.const 32) (local.get $bits)))
    (local.set $c (i32.shr_u (i32.shl (local.get $raw) (local.get $shift)) (local.get $shift)))
    (if (i32.eqz (i32.and (local.get $tag) (i32.const 0x100)))
      (then (return (i32.shr_u (local.get $c) (i32.sub (local.get $bits) (i32.const 8))))))
    (local.set $c (i32.shr_s (i32.shl (local.get $c) (local.get $shift)) (local.get $shift)))
    (local.set $value (f64.add (f64.mul (f64.convert_i32_s (local.get $c)) (f64.const 2)) (f64.const 1)))
    (if (f64.le (local.get $value) (f64.const 0)) (then (return (i32.const 0))))
    (local.set $den (f64.convert_i64_u
      (i64.sub (i64.shl (i64.const 1) (i64.extend_i32_u (local.get $bits))) (i64.const 1))))
    (i32.trunc_sat_f64_u (f64.add
      (f64.div (f64.mul (local.get $value) (f64.const 255)) (local.get $den)) (f64.const 0.5))))

  (func $gl_source_pack (param $p i32) (result i32)
    (local $tag i32)
    (local.set $tag (i32.load (local.get $p)))
    ;; Call only for a nonzero source tag after lighting/clipping decisions.
    (i32.or
      (i32.or
        (i32.shl (call $gl_source_u8 (i32.load offset=16 (local.get $p)) (local.get $tag) (i32.const 1)) (i32.const 24))
        (i32.shl (call $gl_source_u8 (i32.load offset=4 (local.get $p)) (local.get $tag) (i32.const 0)) (i32.const 16)))
      (i32.or
        (i32.shl (call $gl_source_u8 (i32.load offset=8 (local.get $p)) (local.get $tag) (i32.const 0)) (i32.const 8))
        (call $gl_source_u8 (i32.load offset=12 (local.get $p)) (local.get $tag) (i32.const 0)))))
  ;; ============================================================
  ;; Native OpenGL command encoder
  ;; ============================================================
  ;; Records deliberately match lib/gl-command-stream.js byte-for-byte.  The
  ;; host endpoint (opcode 0x10001) consumes a bounded span in linear memory.
  ;; Buffers are allocated lazily from the guest heap so the frontend
  ;; does not permanently enlarge every instance's static memory map.

  (global $gl_stream_wa (mut i32) (i32.const 0))
  ;; Opt-in leased transport: host admission keeps at most two published
  ;; buffers live before acknowledging a submission. The third is the writer.
  ;; Once initialized these allocations and the rotation survive encoder reset.
  (global $gl_stream_pool_enabled (mut i32) (i32.const 0))
  (global $gl_stream_pool_0 (mut i32) (i32.const 0))
  (global $gl_stream_pool_1 (mut i32) (i32.const 0))
  (global $gl_stream_pool_2 (mut i32) (i32.const 0))
  (global $gl_stream_pool_index (mut i32) (i32.const 0))
  (global $gl_stream_used_bytes (mut i32) (i32.const 0))
  (global $gl_stream_command_count (mut i32) (i32.const 0))
  (global $gl_wat_stat_calls (mut i64) (i64.const 0))
  (global $gl_wat_stat_spans (mut i64) (i64.const 0))
  (global $gl_wat_stat_vertices (mut i64) (i64.const 0))
  (global $gl_wat_stat_flushes (mut i64) (i64.const 0))
  (global $gl_immediate_wa (mut i32) (i32.const 0))
  (global $gl_immediate_guest (mut i32) (i32.const 0))
  (global $gl_immediate_capacity (mut i32) (i32.const 0))
  (global $gl_immediate_floats (mut i32) (i32.const 0))
  ;; Only material-changing primitives use prelit transport mode bit 0x20000.
  (global $gl_material_prelit (mut i32) (i32.const 0))
  (global $gl_material_lit_floats (mut i32) (i32.const 0))
  (global $gl_immediate_mode (mut i32) (i32.const -1))
  (global $gl_shade_model (mut i32) (i32.const 0x1D01))
  (global $gl_current_context (mut i32) (i32.const 0))
  ;; The HDC the current context was made current on (wglGetCurrentDC).
  (global $gl_current_dc (mut i32) (i32.const 0))
  (global $gl_color_r (mut f32) (f32.const 1))
  (global $gl_color_g (mut f32) (f32.const 1))
  (global $gl_color_b (mut f32) (f32.const 1))
  (global $gl_color_a (mut f32) (f32.const 1))
  (global $gl_tex_s (mut f32) (f32.const 0))
  (global $gl_tex_t (mut f32) (f32.const 0))
  (global $gl_tex1_s (mut f32) (f32.const 0))
  (global $gl_tex1_t (mut f32) (f32.const 0))
  ;; r and q of each unit's current coordinate: (0, 1) unless glTexCoord4f,
  ;; glMultiTexCoord4fARB or a 3/4-component array set them. q is projective.
  (global $gl_tex_r (mut f32) (f32.const 0))
  (global $gl_tex_q (mut f32) (f32.const 1))
  (global $gl_tex1_r (mut f32) (f32.const 0))
  (global $gl_tex1_q (mut f32) (f32.const 1))
  (global $gl_normal_x (mut f32) (f32.const 0))
  (global $gl_normal_y (mut f32) (f32.const 0))
  (global $gl_normal_z (mut f32) (f32.const 1))
  (global $gl_client_bits (mut i32) (i32.const 0))
  (global $gl_client_tex_unit (mut i32) (i32.const 0))
  (global $gl_vp_size (mut i32) (i32.const 0))
  (global $gl_vp_type (mut i32) (i32.const 0))
  (global $gl_vp_stride (mut i32) (i32.const 0))
  (global $gl_vp_guest (mut i32) (i32.const 0))
  (global $gl_np_type (mut i32) (i32.const 0))
  (global $gl_np_stride (mut i32) (i32.const 0))
  (global $gl_np_guest (mut i32) (i32.const 0))
  (global $gl_cp_size (mut i32) (i32.const 0))
  (global $gl_cp_type (mut i32) (i32.const 0))
  (global $gl_cp_stride (mut i32) (i32.const 0))
  (global $gl_cp_guest (mut i32) (i32.const 0))
  (global $gl_tp0_size (mut i32) (i32.const 0))
  (global $gl_tp0_type (mut i32) (i32.const 0))
  (global $gl_tp0_stride (mut i32) (i32.const 0))
  (global $gl_tp0_guest (mut i32) (i32.const 0))
  (global $gl_tp1_size (mut i32) (i32.const 0))
  (global $gl_tp1_type (mut i32) (i32.const 0))
  (global $gl_tp1_stride (mut i32) (i32.const 0))
  (global $gl_tp1_guest (mut i32) (i32.const 0))

  (func $gl_alloc_affine (param $size i32) (result i32)
    (local $guest i32) (local $base i32) (local $off i32)
    (local.set $guest (call $heap_alloc (local.get $size)))
    (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
    (local.set $base (call $g2w (local.get $guest)))
    (loop $pages
      (if (i32.ne (call $g2w (i32.add (local.get $guest) (local.get $off)))
          (i32.add (local.get $base) (local.get $off))) (then
        (call $heap_free (local.get $guest)) (return (i32.const 0))))
      (local.set $off (i32.add (local.get $off) (i32.const 0x1000)))
      (br_if $pages (i32.lt_u (local.get $off) (local.get $size))))
    (if (i32.ne (call $g2w (i32.add (local.get $guest) (i32.sub (local.get $size) (i32.const 1))))
        (i32.add (local.get $base) (i32.sub (local.get $size) (i32.const 1)))) (then
      (call $heap_free (local.get $guest)) (return (i32.const 0))))
    (local.get $guest))

  (func $gl_wat_init (result i32)
    (local $guest i32) (local $extra1 i32) (local $extra2 i32)
    (if (i32.eqz (global.get $gl_stream_wa))
      (then
        (local.set $guest (call $gl_alloc_affine (i32.const 0x00200000)))
        (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
        (global.set $gl_stream_wa (call $g2w (local.get $guest)))
        (global.set $gl_stream_pool_0 (global.get $gl_stream_wa))))
    (if (i32.eqz (global.get $gl_immediate_wa))
      (then
        (local.set $guest (call $gl_alloc_affine (i32.const 0x00000E00)))
        (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
        (global.set $gl_immediate_guest (local.get $guest))
        (global.set $gl_immediate_wa (call $g2w (local.get $guest)))
        (global.set $gl_immediate_capacity (i32.const 0x00000E00))))
    (if (i32.and (i32.ne (global.get $gl_stream_pool_enabled) (i32.const 0))
        (i32.eqz (global.get $gl_stream_pool_1)))
      (then
        (local.set $extra1 (call $gl_alloc_affine (i32.const 0x00200000)))
        (if (local.get $extra1)
          (then (local.set $extra2 (call $gl_alloc_affine (i32.const 0x00200000)))))
        (if (i32.eqz (local.get $extra2))
          (then
            ;; Never publish a partial pool. Keep the original synchronous
            ;; buffer, free any unpublished extra and do not retry each call.
            (if (local.get $extra1) (then (call $heap_free (local.get $extra1))))
            (global.set $gl_stream_pool_enabled (i32.const 0)))
          (else
            (global.set $gl_stream_pool_1 (call $g2w (local.get $extra1)))
            (global.set $gl_stream_pool_2 (call $g2w (local.get $extra2)))))))
    (i32.const 1))

  (func $gl_wat_stream_pool_enable (param $enable i32) (result i32)
    ;; Configuration only before first allocation, including after reset/OOM.
    (if (i32.or (i32.ne (global.get $gl_stream_wa) (i32.const 0))
        (i32.gt_u (local.get $enable) (i32.const 1))) (then (return (i32.const 0))))
    (global.set $gl_stream_pool_enabled (local.get $enable))
    (i32.const 1))

  (func $gl_wat_stream_pool_base (param $index i32) (result i32)
    (if (i32.eqz (local.get $index)) (then (return (global.get $gl_stream_pool_0))))
    (if (i32.eq (local.get $index) (i32.const 1)) (then (return (global.get $gl_stream_pool_1))))
    (if (i32.eq (local.get $index) (i32.const 2)) (then (return (global.get $gl_stream_pool_2))))
    (i32.const 0))

  (func $gl_wat_stream_flush (result i32)
    (local $result i32)
    (if (i32.eqz (global.get $gl_stream_used_bytes)) (then (return (i32.const 0))))
    (local.set $result (call $host_gpu_gl_call (i32.const 0x10001)
      (global.get $gl_stream_wa) (global.get $gl_stream_used_bytes)))
    (global.set $gl_wat_stat_flushes (i64.add (global.get $gl_wat_stat_flushes) (i64.const 1)))
    (global.set $gl_stream_used_bytes (i32.const 0))
    (global.set $gl_stream_command_count (i32.const 0))
    (if (global.get $gl_stream_pool_2)
      (then
        (global.set $gl_stream_pool_index (i32.rem_u
          (i32.add (global.get $gl_stream_pool_index) (i32.const 1)) (i32.const 3)))
        (global.set $gl_stream_wa (call $gl_wat_stream_pool_base (global.get $gl_stream_pool_index)))))
    (local.get $result))

  ;; $len bytes of guest memory at $ga into wasm $dst. One $g2w is good for
  ;; one guest page only; a matrix or light vector that crosses into a sparse
  ;; page backed elsewhere is gathered byte by byte instead.
  (func $gl_copy_from_guest (param $dst i32) (param $ga i32) (param $len i32)
    (local $wa i32) (local $i i32)
    (local.set $wa (call $g2w_affine_span (local.get $ga) (local.get $len)))
    (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
      (then (memory.copy (local.get $dst) (local.get $wa) (local.get $len)) (return)))
    (block $done (loop $bytes
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (i32.store8 (i32.add (local.get $dst) (local.get $i))
        (call $gl8 (i32.add (local.get $ga) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $bytes))))

  (func $gl_emit_record (param $op i32) (param $stack i32) (param $aux i32)
      (param $ptr_guest i32) (param $ptr_len i32) (param $borrow i32) (result i32)
    (local $words i32) (local $stack_bytes i32) (local $copy_bytes i32)
    (local $record_bytes i32) (local $start i32) (local $ptr_off i32)
    (local.set $words (call $gl_source_arg_words (local.get $op)))
    (if (i32.lt_s (local.get $words) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $stack_bytes (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))
    (local.set $copy_bytes (select (i32.const 0) (local.get $ptr_len) (local.get $borrow)))
    (local.set $record_bytes (i32.and
      (i32.add (i32.add (i32.const 35) (local.get $stack_bytes)) (local.get $copy_bytes))
      (i32.const -4)))
    (if (i32.gt_u (local.get $record_bytes) (i32.const 0x00200000))
      (then (return (i32.const 0))))
    (if (i32.gt_u (i32.add (global.get $gl_stream_used_bytes) (local.get $record_bytes))
        (i32.const 0x00200000)) (then (drop (call $gl_wat_stream_flush))))
    ;; Start renderer work at 512 KiB; retain 2 MiB capacity for large records.
    (if (i32.gt_u (i32.add (global.get $gl_stream_used_bytes) (local.get $record_bytes))
        (i32.const 0x00080000)) (then (drop (call $gl_wat_stream_flush))))
    (local.set $start (i32.add (global.get $gl_stream_wa) (global.get $gl_stream_used_bytes)))
    (local.set $ptr_off (select
      (i32.add (global.get $gl_stream_used_bytes) (i32.add (i32.const 32) (local.get $stack_bytes)))
      (i32.const 0) (i32.ne (local.get $copy_bytes) (i32.const 0))))
    (i32.store (local.get $start) (local.get $record_bytes))
    (i32.store offset=4 (local.get $start) (local.get $op))
    (i32.store offset=8 (local.get $start) (local.get $aux))
    (i32.store offset=12 (local.get $start) (local.get $stack_bytes))
    (i32.store offset=16 (local.get $start) (local.get $ptr_guest))
    (i32.store offset=20 (local.get $start) (local.get $ptr_len))
    (i32.store offset=24 (local.get $start) (local.get $ptr_off))
    (i32.store offset=28 (local.get $start) (select (i32.const 2) (i32.const 1) (local.get $borrow)))
    (if (i32.eqz (local.get $ptr_len)) (then (i32.store offset=28 (local.get $start) (i32.const 0))))
    (memory.copy (i32.add (local.get $start) (i32.const 32)) (local.get $stack) (local.get $stack_bytes))
    (if (local.get $copy_bytes) (then
      (call $gl_copy_from_guest
        (i32.add (local.get $start) (i32.add (i32.const 32) (local.get $stack_bytes)))
        (local.get $ptr_guest) (local.get $copy_bytes))))
    (global.set $gl_stream_used_bytes (i32.add (global.get $gl_stream_used_bytes) (local.get $record_bytes)))
    (global.set $gl_stream_command_count (i32.add (global.get $gl_stream_command_count) (i32.const 1)))
    (i32.const 1))

  ;; One immediate-mode vertex: position (x, y, z, w) plus the current colour,
  ;; texcoords and normal -- 19 floats: w at 14, then unit 0's r, q and unit
  ;; 1's r, q, appended so every older field keeps its offset
  ;; (lib/gl-command-stream.js VERTEX_FLOATS).
  (func $gl_append_vertex (param $x f32) (param $y f32) (param $z f32)
    (call $gl_append_vertex4 (local.get $x) (local.get $y) (local.get $z) (f32.const 1)))

  (func $gl_append_vertex4 (param $x f32) (param $y f32) (param $z f32) (param $w f32)
    (local $p i32) (local $guest i32) (local $needed i32) (local $cap i32)
    (if (i32.lt_s (global.get $gl_immediate_mode) (i32.const 0)) (then (return)))
    (local.set $needed (i32.shl (i32.add (global.get $gl_immediate_floats) (i32.const 28)) (i32.const 2)))
    (if (i32.gt_u (local.get $needed) (global.get $gl_immediate_capacity)) (then
      (local.set $cap (global.get $gl_immediate_capacity))
      (loop $grow (if (i32.lt_u (local.get $cap) (local.get $needed)) (then
        (if (i32.gt_u (local.get $cap) (i32.const 0x3FFFFFFF)) (then (unreachable)))
        (local.set $cap (i32.shl (local.get $cap) (i32.const 1))) (br $grow))))
      (local.set $guest (call $gl_alloc_affine (local.get $cap)))
      (if (i32.eqz (local.get $guest)) (then (unreachable)))
      (memory.copy (call $g2w (local.get $guest)) (global.get $gl_immediate_wa)
        (i32.shl (global.get $gl_immediate_floats) (i32.const 2)))
      (call $heap_free (global.get $gl_immediate_guest))
      (global.set $gl_immediate_guest (local.get $guest))
      (global.set $gl_immediate_wa (call $g2w (local.get $guest)))
      (global.set $gl_immediate_capacity (local.get $cap))))
    ;; This private allocation was checked across its whole span by
    ;; gl_alloc_affine, including after growth. Reuse its mapped base; unlike
    ;; arbitrary guest client arrays, these fields cannot cross sparse backing.
    (local.set $p (i32.add (global.get $gl_immediate_wa)
      (i32.shl (global.get $gl_immediate_floats) (i32.const 2))))
    (f32.store (local.get $p) (local.get $x))
    (f32.store offset=4 (local.get $p) (local.get $y))
    (f32.store offset=8 (local.get $p) (local.get $z))
    (f32.store offset=12 (local.get $p) (global.get $gl_color_r))
    (f32.store offset=16 (local.get $p) (global.get $gl_color_g))
    (f32.store offset=20 (local.get $p) (global.get $gl_color_b))
    (f32.store offset=24 (local.get $p) (global.get $gl_color_a))
    (f32.store offset=28 (local.get $p) (global.get $gl_tex_s))
    (f32.store offset=32 (local.get $p) (global.get $gl_tex_t))
    (f32.store offset=36 (local.get $p) (global.get $gl_normal_x))
    (f32.store offset=40 (local.get $p) (global.get $gl_normal_y))
    (f32.store offset=44 (local.get $p) (global.get $gl_normal_z))
    (f32.store offset=48 (local.get $p) (global.get $gl_tex1_s))
    (f32.store offset=52 (local.get $p) (global.get $gl_tex1_t))
    (f32.store offset=56 (local.get $p) (local.get $w))
    (f32.store offset=60 (local.get $p) (global.get $gl_tex_r))
    (f32.store offset=64 (local.get $p) (global.get $gl_tex_q))
    (f32.store offset=68 (local.get $p) (global.get $gl_tex1_r))
    (f32.store offset=72 (local.get $p) (global.get $gl_tex1_q))
    (call $gl_source_vertex (local.get $p))
    ;; Private immediate storage shares the exact-color tag word. The edge bit
    ;; is stripped by gl_copy_vertex before any ordinary transport record.
    (f32.store offset=108 (local.get $p) (f32.convert_i32_u (i32.or
      (global.get $gl_source_tag) (i32.shl (global.get $gl_edge_flag) (i32.const 10)))))
    (global.set $gl_immediate_has_source (i32.or (global.get $gl_immediate_has_source) (global.get $gl_source_tag)))
    (global.set $gl_immediate_floats (i32.add (global.get $gl_immediate_floats) (i32.const 28))))

  ;; Finalize only vertices preceding the next material update. Keep the
  ;; original topology and current colour untouched. The existing lighting
  ;; evaluator writes into scratch first (COLOR_MATERIAL reads input colour).
  (func $gl_material_light_pending
    (local $b i32) (local $caps i32) (local $saved i32) (local $v i32) (local $k i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $caps (i32.load offset=9036 (local.get $b)))
    (if (i32.eqz (i32.and (local.get $caps) (i32.const 128))) (then (return)))
    (local.set $saved (i32.load (global.get $gl_sw_st)))
    (i32.store (global.get $gl_sw_st) (local.get $caps))
    (call $gl_sw_light_setup (local.get $b))
    (block $done (loop $vertices
      (br_if $done (i32.ge_u (global.get $gl_material_lit_floats) (global.get $gl_immediate_floats)))
      (local.set $v (i32.add (global.get $gl_immediate_wa)
        (i32.shl (global.get $gl_material_lit_floats) (i32.const 2))))
      (call $gl_sw_light_vertex (local.get $v) (i32.add (global.get $gl_sw_scratch) (i32.const 0x500)))
      (local.set $k (i32.const 0))
      (loop $channels
        (f32.store (i32.add (i32.add (local.get $v) (i32.const 12)) (local.get $k))
          (f32.min (f32.const 1) (f32.max (f32.const 0)
            (f32.load (i32.add (i32.add (global.get $gl_sw_scratch) (i32.const 0x500)) (local.get $k))))))
        (local.set $k (i32.add (local.get $k) (i32.const 4)))
        (br_if $channels (i32.lt_u (local.get $k) (i32.const 16))))
      (f32.store offset=108 (local.get $v) (f32.convert_i32_u
        (i32.and (i32.trunc_f32_u (f32.load offset=108 (local.get $v))) (i32.const 1024))))
      (global.set $gl_material_lit_floats (i32.add (global.get $gl_material_lit_floats) (i32.const 28)))
      (br $vertices)))
    (i32.store (global.get $gl_sw_st) (local.get $saved)))

  (func $gl_copy_vertex (param $dst i32) (param $index i32) (param $color_index i32) (param $exact i32)
    (local $src i32) (local $csrc i32) (local $i i32) (local $from i32)
    ;; Both source vertices belong to the same verified affine allocation.
    (local.set $src (i32.add (global.get $gl_immediate_wa)
      (i32.mul (local.get $index) (i32.const 112))))
    (local.set $csrc (i32.add (global.get $gl_immediate_wa)
      (i32.add (i32.mul (local.get $color_index) (i32.const 112)) (i32.const 12))))
    (loop $words
      (local.set $from (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2))))
      (if (i32.and (i32.ge_s (local.get $color_index) (i32.const 0))
          (i32.or (i32.and (i32.ge_u (local.get $i) (i32.const 3)) (i32.lt_u (local.get $i) (i32.const 7))) (i32.ge_u (local.get $i) (i32.const 19))))
        (then (local.set $from (i32.add (local.get $csrc)
          (i32.shl (i32.sub (local.get $i) (i32.const 3)) (i32.const 2))))))
      (i32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
        (i32.load (local.get $from)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $words (i32.lt_u (local.get $i) (select (i32.const 28) (i32.const 19) (local.get $exact)))))
    (if (local.get $exact) (then
      (f32.store offset=108 (local.get $dst) (f32.convert_i32_u
        (i32.and (i32.trunc_f32_u (f32.load offset=108 (local.get $dst))) (i32.const 1023)))))))

  (func $gl_pixel_components (param $format i32) (result i32)
    (if (result i32) (i32.or (i32.eq (local.get $format) (i32.const 0x1906))
        (i32.eq (local.get $format) (i32.const 0x1909)))
      (then (i32.const 1))
      (else (if (result i32) (i32.eq (local.get $format) (i32.const 0x190A))
        (then (i32.const 2))
        (else (if (result i32) (i32.or (i32.eq (local.get $format) (i32.const 0x1907))
            (i32.eq (local.get $format) (i32.const 0x80E0)))
          (then (i32.const 3)) (else (i32.const 4))))))))

  (func $gl_pixel_bytes (param $format i32) (param $type i32) (result i32)
    (local $n i32)
    (local.set $n (call $gl_pixel_components (local.get $format)))
    (if (result i32) (i32.or (i32.eq (local.get $type) (i32.const 0x1400))
        (i32.eq (local.get $type) (i32.const 0x1401)))
      (then (local.get $n))
      (else (if (result i32) (i32.or
          (i32.or (i32.eq (local.get $type) (i32.const 0x8363))
            (i32.eq (local.get $type) (i32.const 0x8033)))
          (i32.eq (local.get $type) (i32.const 0x8034)))
        (then (i32.const 2))
        (else (if (result i32) (i32.or
            (i32.or (i32.eq (local.get $type) (i32.const 0x1402))
              (i32.eq (local.get $type) (i32.const 0x1403)))
            (i32.const 0))
          (then (i32.mul (local.get $n) (i32.const 2)))
          (else (if (result i32) (i32.or
              (i32.or (i32.eq (local.get $type) (i32.const 0x1404))
                (i32.eq (local.get $type) (i32.const 0x1405)))
              (i32.eq (local.get $type) (i32.const 0x1406)))
            (then (i32.mul (local.get $n) (i32.const 4)))
            (else (local.get $n))))))))))

  (func $gl_checked_image_bytes (param $w i32) (param $h i32)
      (param $format i32) (param $type i32) (result i32)
    (local $n i64) (local $row i64)
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h)))
      (then (return (i32.const 0))))
    (local.set $row (i64.mul (i64.extend_i32_u (local.get $w))
      (i64.extend_i32_u (call $gl_pixel_bytes (local.get $format) (local.get $type)))))
    (if (i64.gt_u (local.get $row) (i64.const 0x7FFFFFFF)) (then (unreachable)))
    (local.set $n (i64.mul (local.get $row) (i64.extend_i32_u (local.get $h))))
    (if (i64.gt_u (local.get $n) (i64.const 0x7FFFFFFF)) (then (unreachable)))
    (i32.wrap_i64 (local.get $n)))

  (func $gl_packed_begin (param $mode i32) (result i32)
    (local $start i32)
    (if (i32.gt_u (i32.add (global.get $gl_stream_used_bytes) (i32.const 32))
        (i32.const 0x00200000)) (then (drop (call $gl_wat_stream_flush))))
    (local.set $start (i32.add (global.get $gl_stream_wa) (global.get $gl_stream_used_bytes)))
    (i32.store (local.get $start) (i32.const 32))
    (i32.store offset=4 (local.get $start) (i32.const 0x10000))
    (i32.store offset=8 (local.get $start) (i32.or (local.get $mode)
      (select (i32.const 0x20000) (i32.const 0) (global.get $gl_material_prelit))))
    (i32.store offset=12 (local.get $start) (i32.const 0))
    (i32.store offset=16 (local.get $start) (i32.const 0))
    (i32.store offset=20 (local.get $start) (i32.const 0))
    (i32.store offset=24 (local.get $start) (i32.add (global.get $gl_stream_used_bytes) (i32.const 32)))
    (i32.store offset=28 (local.get $start) (i32.const 1))
    (local.get $start))

  (func $gl_packed_finish (param $start i32) (param $vertices i32)
    (local $bytes i32)
    (if (i32.eqz (local.get $vertices)) (then (return)))
    (local.set $bytes (i32.mul (local.get $vertices) (call $gl_source_packed_stride (local.get $start))))
    (i32.store (local.get $start) (i32.add (local.get $bytes) (i32.const 32)))
    (i32.store offset=20 (local.get $start) (local.get $bytes))
    ;; Selection/feedback consume the same complete primitive records, on the
    ;; calling producer, before any draw can reach either rendering backend.
    (if (call $gl_sf_consume (local.get $start) (local.get $vertices)) (then (return)))
    (global.set $gl_stream_used_bytes (i32.add (global.get $gl_stream_used_bytes)
      (i32.add (local.get $bytes) (i32.const 32))))
    (global.set $gl_stream_command_count (i32.add (global.get $gl_stream_command_count) (i32.const 1)))
    ;; The one funnel every immediate-mode and vertex-array draw passes
    ;; through, and the record is complete here -- so it is where the WAT
    ;; software rasterizer reads a draw (src/09a8g-gl-raster.wat). Inert
    ;; unless a host enabled it.
    (call $gl_sw_consume (local.get $start) (local.get $vertices))
    ;; Submit only complete draws, after the software consumer has read them.
    (if (i32.ge_u (global.get $gl_stream_used_bytes) (i32.const 0x00080000))
      (then (drop (call $gl_wat_stream_flush)))))

  (func $gl_finish_immediate (result i32)
    (local $exact i32) (local $stride i32) (local $count i32) (local $mode i32) (local $out_mode i32)
    (local $i i32) (local $start i32) (local $n i32) (local $need i32) (local $q i32)
    (local $flat i32) (local $prov i32) (local $a i32) (local $b i32) (local $c i32)
    (local $out_count i32) (local $group i32) (local $max_chunk i32) (local $first_chunk i32)
    (local $boundary i32) (local $edges i32)
    (if (global.get $gl_material_prelit) (then (call $gl_material_light_pending)))
    (local.set $exact (global.get $gl_immediate_has_source))
    (global.set $gl_immediate_has_source (i32.const 0))
    (local.set $stride (select (i32.const 112) (i32.const 76) (local.get $exact)))
    (local.set $count (i32.div_u (global.get $gl_immediate_floats) (i32.const 28)))
    (local.set $mode (global.get $gl_immediate_mode))
    (global.set $gl_immediate_mode (i32.const -1))
    (global.set $gl_immediate_floats (i32.const 0))
    (global.set $gl_immediate_has_source (i32.const 0))
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (local.set $boundary (i32.or (i32.ne (call $gl_sf_mode) (i32.const 0x1c00))
      (i32.or (i32.ne (i32.load offset=4108 (global.get $gl_sw_st)) (i32.const 0x1b02))
        (i32.ne (i32.load offset=4112 (global.get $gl_sw_st)) (i32.const 0x1b02)))))
    (if (i32.and (local.get $boundary) (i32.le_u (i32.sub (local.get $mode) (i32.const 4)) (i32.const 5))) (then
      (call $gl_edge_finish (local.get $count) (local.get $mode)) (return (i32.const 1))))
    (local.set $flat (i32.eq (global.get $gl_shade_model) (i32.const 0x1D00)))
    (local.set $out_mode (local.get $mode))
    (if (i32.or (i32.or (i32.eq (local.get $mode) (i32.const 5))
          (i32.eq (local.get $mode) (i32.const 6)))
        (i32.or (i32.or (i32.eq (local.get $mode) (i32.const 7))
          (i32.eq (local.get $mode) (i32.const 8)))
          (i32.eq (local.get $mode) (i32.const 9))))
      (then (local.set $out_mode (i32.const 4))))
    (if (i32.or (i32.eq (local.get $mode) (i32.const 2))
        (i32.eq (local.get $mode) (i32.const 3)))
      (then (local.set $out_mode (i32.const 1))))
    (local.set $out_count (local.get $count))
    (if (i32.and (local.get $flat) (i32.eq (local.get $mode) (i32.const 4)))
      (then (local.set $out_count (i32.sub (local.get $count) (i32.rem_u (local.get $count) (i32.const 3))))))
    (if (i32.and (local.get $flat) (i32.eq (local.get $mode) (i32.const 1)))
      (then (local.set $out_count (i32.sub (local.get $count) (i32.rem_u (local.get $count) (i32.const 2))))))
    (if (i32.eq (local.get $mode) (i32.const 7))
      (then (local.set $out_count (i32.mul (i32.div_u (local.get $count) (i32.const 4)) (i32.const 6)))))
    (if (i32.eq (local.get $mode) (i32.const 8))
      (then (local.set $out_count (select
        (i32.mul (i32.div_u (i32.sub (local.get $count) (i32.const 2)) (i32.const 2)) (i32.const 6))
        (i32.const 0) (i32.gt_u (local.get $count) (i32.const 2))))))
    (if (i32.or (i32.or (i32.eq (local.get $mode) (i32.const 5))
          (i32.eq (local.get $mode) (i32.const 6))) (i32.eq (local.get $mode) (i32.const 9)))
      (then (local.set $out_count (select (i32.mul (i32.sub (local.get $count) (i32.const 2)) (i32.const 3))
        (i32.const 0) (i32.gt_u (local.get $count) (i32.const 2))))))
    (if (i32.eq (local.get $mode) (i32.const 2))
      (then (local.set $out_count (i32.mul (local.get $count) (i32.const 2)))))
    (if (i32.eq (local.get $mode) (i32.const 3))
      (then (local.set $out_count (select (i32.mul (i32.sub (local.get $count) (i32.const 1)) (i32.const 2))
        (i32.const 0) (i32.gt_u (local.get $count) (i32.const 1))))))
    (if (i32.eqz (local.get $out_count)) (then (return (i32.const 0))))
    (global.set $gl_wat_stat_spans (i64.add (global.get $gl_wat_stat_spans) (i64.const 1)))
    (global.set $gl_wat_stat_vertices (i64.add (global.get $gl_wat_stat_vertices)
      (i64.extend_i32_u (local.get $out_count))))
    (local.set $group (select (i32.const 3)
      (select (i32.const 2) (i32.const 1) (i32.eq (local.get $out_mode) (i32.const 1)))
      (i32.eq (local.get $out_mode) (i32.const 4))))
    (local.set $max_chunk (i32.mul
      (i32.div_u (i32.div_u (i32.sub (i32.const 0x00200000) (i32.const 32)) (local.get $stride))
        (local.get $group)) (local.get $group)))
    (local.set $first_chunk (select (local.get $out_count) (local.get $max_chunk)
      (i32.lt_u (local.get $out_count) (local.get $max_chunk))))
    (if (i32.gt_u (i32.add (global.get $gl_stream_used_bytes)
          (i32.add (i32.const 32) (i32.mul (local.get $first_chunk) (local.get $stride))))
        (i32.const 0x00200000)) (then (drop (call $gl_wat_stream_flush))))
    (local.set $start (call $gl_source_packed_begin (local.get $out_mode) (local.get $exact)))
    ;; Keep strip/loop connectivity after lowering to independent pairs.
    (if (i32.or (i32.eq (local.get $mode) (i32.const 2)) (i32.eq (local.get $mode) (i32.const 3)))
      (then (i32.store offset=8 (local.get $start) (i32.or (i32.load offset=8 (local.get $start)) (i32.const 0x1000000)))))

    ;; Emit one vertex, reopening the current record when NEED vertices would
    ;; overflow it. Every caller passes a complete primitive's size as NEED.
    (block $done
      (loop $emit
        (local.set $need
          (if (result i32) (i32.eq (local.get $out_mode) (i32.const 4))
            (then (i32.const 3))
            (else (if (result i32) (i32.eq (local.get $out_mode) (i32.const 1))
              (then (i32.const 2)) (else (i32.const 1))))))
        ;; TRIANGLES, smooth or flat, already have independent topology.
        (if (i32.eq (local.get $mode) (i32.const 4)) (then
          (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.ge_u (i32.add (local.get $i) (i32.const 2)) (local.get $count))
            (then
              (if (local.get $flat) (then (br $done)))
              (local.set $need (i32.const 1)) (local.set $a (local.get $i))
              (local.set $prov (i32.const -1)) (local.set $i (i32.add (local.get $i) (i32.const 1))))
            (else
              (local.set $a (local.get $i)) (local.set $b (i32.add (local.get $i) (i32.const 1)))
              (local.set $c (i32.add (local.get $i) (i32.const 2)))
              (local.set $prov (select (local.get $c) (i32.const -1) (local.get $flat)))
              (local.set $i (i32.add (local.get $i) (i32.const 3)))))))
        ;; LINES.
        (if (i32.eq (local.get $mode) (i32.const 1)) (then
          (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count))
            (then
              (if (local.get $flat) (then (br $done)))
              (local.set $need (i32.const 1)) (local.set $a (local.get $i))
              (local.set $prov (i32.const -1)) (local.set $i (i32.add (local.get $i) (i32.const 1))))
            (else
              (local.set $a (local.get $i)) (local.set $b (i32.add (local.get $i) (i32.const 1)))
              (local.set $prov (select (local.get $b) (i32.const -1) (local.get $flat)))
              (local.set $i (i32.add (local.get $i) (i32.const 2)))))))
        ;; POINTS and other directly accepted modes.
        (if (i32.or (i32.eq (local.get $mode) (i32.const 0))
            (i32.gt_u (local.get $mode) (i32.const 9))) (then
          (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
          (local.set $a (local.get $i)) (local.set $prov (i32.const -1))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))))
        ;; LINE_LOOP / LINE_STRIP.
        (if (i32.or (i32.eq (local.get $mode) (i32.const 2))
            (i32.eq (local.get $mode) (i32.const 3))) (then
          (if (i32.eq (local.get $mode) (i32.const 2))
            (then (br_if $done (i32.ge_u (local.get $i) (local.get $count))))
            (else (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))))
          (local.set $a (local.get $i))
          (local.set $b (i32.rem_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
          (local.set $prov (select (local.get $b) (i32.const -1) (local.get $flat)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))))
        ;; TRIANGLE_STRIP, alternating winding.
        (if (i32.eq (local.get $mode) (i32.const 5)) (then
          (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 2)) (local.get $count)))
          (if (i32.and (local.get $i) (i32.const 1))
            (then (local.set $a (i32.add (local.get $i) (i32.const 1))) (local.set $b (local.get $i)))
            (else (local.set $a (local.get $i)) (local.set $b (i32.add (local.get $i) (i32.const 1)))))
          (local.set $c (i32.add (local.get $i) (i32.const 2)))
          (local.set $prov (select (local.get $c) (i32.const -1) (local.get $flat)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))))
        ;; TRIANGLE_FAN and POLYGON differ only in the flat provoking vertex.
        (if (i32.or (i32.eq (local.get $mode) (i32.const 6))
            (i32.eq (local.get $mode) (i32.const 9))) (then
          (if (i32.eqz (local.get $i)) (then (local.set $i (i32.const 1))))
          (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
          (local.set $a (i32.const 0)) (local.set $b (local.get $i))
          (local.set $c (i32.add (local.get $i) (i32.const 1)))
          (local.set $prov (i32.const -1))
          (if (local.get $flat) (then (local.set $prov
            (select (i32.const 0) (local.get $c) (i32.eq (local.get $mode) (i32.const 9))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))))
        ;; QUADS / QUAD_STRIP use two iterations per logical quad. N toggles.
        (if (i32.or (i32.eq (local.get $mode) (i32.const 7))
            (i32.eq (local.get $mode) (i32.const 8))) (then
          (if (i32.eq (local.get $mode) (i32.const 7))
            (then
              (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 3)) (local.get $count)))
              (local.set $a (local.get $i))
              (local.set $b (select (i32.add (local.get $i) (i32.const 2))
                (i32.add (local.get $i) (i32.const 1)) (local.get $q)))
              (local.set $c (select (i32.add (local.get $i) (i32.const 3))
                (i32.add (local.get $i) (i32.const 2)) (local.get $q))))
            (else
              (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 3)) (local.get $count)))
              (local.set $a (local.get $i))
              (local.set $b (select (i32.add (local.get $i) (i32.const 3))
                (i32.add (local.get $i) (i32.const 1)) (local.get $q)))
              (local.set $c (select (i32.add (local.get $i) (i32.const 2))
                (i32.add (local.get $i) (i32.const 3)) (local.get $q)))))
          (local.set $prov (select (i32.add (local.get $i) (i32.const 3)) (i32.const -1) (local.get $flat)))
          (if (local.get $q)
            (then (local.set $i (i32.add (local.get $i)
              (select (i32.const 2) (i32.const 4) (i32.eq (local.get $mode) (i32.const 8)))))
              (local.set $q (i32.const 0)))
            (else (local.set $q (i32.const 1))))))

        (if (i32.and (local.get $boundary) (i32.eq (local.get $need) (i32.const 3))) (then
          (if (local.get $n) (then
            (call $gl_packed_finish (local.get $start) (local.get $n))
            (local.set $start (call $gl_source_packed_begin (local.get $out_mode) (local.get $exact)))
            (local.set $n (i32.const 0))))))
        (if (i32.gt_u (i32.add (i32.add (global.get $gl_stream_used_bytes) (i32.const 32))
              (i32.mul (i32.add (local.get $n) (local.get $need)) (local.get $stride)))
            (i32.const 0x00200000)) (then
          (call $gl_packed_finish (local.get $start) (local.get $n))
          (drop (call $gl_wat_stream_flush))
          (local.set $start (call $gl_source_packed_begin (local.get $out_mode) (local.get $exact)))
          (if (i32.or (i32.eq (local.get $mode) (i32.const 2)) (i32.eq (local.get $mode) (i32.const 3)))
            (then (i32.store offset=8 (local.get $start) (i32.or (i32.load offset=8 (local.get $start)) (i32.const 0x3000000)))))
          (local.set $n (i32.const 0))))
        (if (i32.and (local.get $boundary) (i32.eq (local.get $need) (i32.const 3))) (then
          (local.set $edges (i32.const 7))
          (if (i32.eq (local.get $mode) (i32.const 7)) (then
            (local.set $edges (select (i32.const 3) (i32.const 6)
              (i32.eq (local.get $b) (i32.add (local.get $a) (i32.const 1)))))))
          (if (i32.eq (local.get $mode) (i32.const 8)) (then
            (local.set $edges (select (i32.const 3) (i32.const 6)
              (i32.eq (local.get $b) (i32.add (local.get $a) (i32.const 1)))))))
          (if (i32.eq (local.get $mode) (i32.const 9)) (then
            (local.set $edges (i32.or (i32.const 2) (i32.or
              (i32.eq (local.get $b) (i32.const 1))
              (i32.shl (i32.eq (i32.add (local.get $c) (i32.const 1)) (local.get $count)) (i32.const 2)))))))
          ;; A split logical polygon shares its stipple counter across records.
          (if (i32.or
              (i32.and (i32.or (i32.eq (local.get $mode) (i32.const 7))
                (i32.eq (local.get $mode) (i32.const 8))) (i32.eq (local.get $edges) (i32.const 6)))
              (i32.and (i32.eq (local.get $mode) (i32.const 9)) (i32.gt_u (local.get $b) (i32.const 1)))) (then
            (i32.store offset=8 (local.get $start) (i32.or (i32.load offset=8 (local.get $start)) (i32.const 0x2000000)))))
          (i32.store offset=8 (local.get $start) (i32.or (i32.load offset=8 (local.get $start))
            (i32.or (i32.shl (i32.const 1) (i32.const 27)) (i32.shl (local.get $edges) (i32.const 28)))))))

        (call $gl_copy_vertex (i32.add (local.get $start)
          (i32.add (i32.const 32) (i32.mul (local.get $n) (local.get $stride)))) (local.get $a) (local.get $prov) (local.get $exact))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (if (i32.gt_u (local.get $need) (i32.const 1)) (then
          (call $gl_copy_vertex (i32.add (local.get $start)
            (i32.add (i32.const 32) (i32.mul (local.get $n) (local.get $stride)))) (local.get $b) (local.get $prov) (local.get $exact))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
        (if (i32.gt_u (local.get $need) (i32.const 2)) (then
          (call $gl_copy_vertex (i32.add (local.get $start)
            (i32.add (i32.const 32) (i32.mul (local.get $n) (local.get $stride)))) (local.get $c) (local.get $prov) (local.get $exact))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
        (br $emit)))
    (call $gl_packed_finish (local.get $start) (local.get $n))
    (i32.const 1))

  ;; Preserve complete logical polygons through clipping. Ordinary filled
  ;; geometry keeps its established compact ABI; boundary draws own an edge
  ;; byte-as-float after the exact-color vertex, and never carry guest pointers.
  (func $gl_edge_finish (param $count i32) (param $mode i32)
    (local $i i32) (local $k i32) (local $n i32) (local $index i32)
    (local $prov i32) (local $start i32) (local $dst i32) (local $edge i32)
    (block $done (loop $polygons
      (local.set $n (select (i32.const 4) (i32.const 3)
        (i32.or (i32.eq (local.get $mode) (i32.const 7)) (i32.eq (local.get $mode) (i32.const 8)))))
      (if (i32.eq (local.get $mode) (i32.const 9)) (then (local.set $n (local.get $count))))
      (if (i32.or (i32.eq (local.get $mode) (i32.const 6)) (i32.eq (local.get $mode) (i32.const 5))) (then
        (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 2)) (local.get $count))))
        (else (br_if $done (i32.gt_u (i32.add (local.get $i) (local.get $n)) (local.get $count)))))
      (br_if $done (i32.lt_u (local.get $n) (i32.const 3)))
      ;; The transport owns at most 2MiB. Refuse an oversized polygon rather
      ;; than split its connectivity or publish only a prefix.
      (if (i32.gt_u (local.get $n) (i32.const 18078)) (then
        (call $gl_list_error (call $gl_list_context) (i32.const 0x505)) (br $done)))
      (if (i32.gt_u (i32.add (global.get $gl_stream_used_bytes)
          (i32.add (i32.const 32) (i32.mul (local.get $n) (i32.const 116)))) (i32.const 0x200000))
        (then (drop (call $gl_wat_stream_flush))))
      (local.set $start (call $gl_packed_begin (i32.const 9)))
      (i32.store offset=4 (local.get $start) (i32.const 0x10009))
      (local.set $prov (i32.const -1))
      (if (i32.eq (global.get $gl_shade_model) (i32.const 0x1d00)) (then
        (local.set $prov (i32.add (local.get $i) (i32.sub (local.get $n) (i32.const 1))))
        (if (i32.eq (local.get $mode) (i32.const 9)) (then (local.set $prov (i32.const 0))))
        (if (i32.eq (local.get $mode) (i32.const 6)) (then (local.set $prov (i32.add (local.get $i) (i32.const 2)))))))
      (local.set $k (i32.const 0))
      (loop $vertices
        (local.set $index (i32.add (local.get $i) (local.get $k)))
        (if (i32.eq (local.get $mode) (i32.const 6)) (then
          (local.set $index (select (i32.const 0) (i32.add (local.get $i) (local.get $k)) (i32.eqz (local.get $k))))))
        (if (i32.and (i32.eq (local.get $mode) (i32.const 5)) (i32.ne (i32.and (local.get $i) (i32.const 1)) (i32.const 0))) (then
          (if (i32.lt_u (local.get $k) (i32.const 2)) (then
            (local.set $index (i32.add (local.get $i) (i32.sub (i32.const 1) (local.get $k))))))))
        (if (i32.and (i32.eq (local.get $mode) (i32.const 8)) (i32.ge_u (local.get $k) (i32.const 2))) (then
          (local.set $index (i32.add (local.get $i) (i32.sub (i32.const 5) (local.get $k))))))
        (local.set $dst (i32.add (local.get $start) (i32.add (i32.const 32) (i32.mul (local.get $k) (i32.const 116)))))
        (call $gl_copy_vertex (local.get $dst) (local.get $index) (local.get $prov) (i32.const 1))
        (local.set $edge (i32.const 1))
        (if (i32.or (i32.eq (local.get $mode) (i32.const 4))
            (i32.or (i32.eq (local.get $mode) (i32.const 7)) (i32.eq (local.get $mode) (i32.const 9)))) (then
          (local.set $edge (i32.and (i32.shr_u (i32.trunc_f32_u (f32.load offset=108
            (i32.add (global.get $gl_immediate_wa) (i32.mul (local.get $index) (i32.const 112))))) (i32.const 10)) (i32.const 1)))))
        (f32.store offset=112 (local.get $dst) (f32.convert_i32_u (local.get $edge)))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br_if $vertices (i32.lt_u (local.get $k) (local.get $n))))
      (call $gl_packed_finish (local.get $start) (local.get $n))
      (if (i32.eq (local.get $mode) (i32.const 9)) (then (br $done)))
      (local.set $i (i32.add (local.get $i) (select (i32.const 1)
        (select (i32.const 2) (local.get $n) (i32.eq (local.get $mode) (i32.const 8)))
        (i32.or (i32.eq (local.get $mode) (i32.const 5)) (i32.eq (local.get $mode) (i32.const 6))))))
      (br $polygons))))

  ;; Validate enums before touching a vector pointer. Invalid enum calls still
  ;; reach the host for GL error reporting but carry no pointed payload.
  (func $gl_tex_parameter_bytes (param $stack i32) (result i32)
    (local $pname i32)
    (if (i32.gt_u (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE0)) (i32.const 1))
      (then (return (i32.const 0))))
    (local.set $pname (i32.load offset=8 (local.get $stack)))
    (if (i32.eq (local.get $pname) (i32.const 0x1004)) (then (return (i32.const 16))))
    (if (i32.or (i32.eq (local.get $pname) (i32.const 0x8066))
      (i32.and (i32.ge_u (local.get $pname) (i32.const 0x2800))
               (i32.le_u (local.get $pname) (i32.const 0x2803))))
      (then (return (i32.const 4))))
    (i32.const 0))

  (func $gl_pointer_length (param $op i32) (param $stack i32) (result i64)
    (local $arg i32) (local $len i32) (local $borrow i32) (local $p i32)
    (local $wide i64)
    (if (i32.eq (local.get $op) (i32.const 148)) (then
      (return (i64.or (i64.extend_i32_u (i32.load offset=8 (local.get $stack)))
        (i64.shl (i64.const 32) (i64.const 32))))))
    (local.set $arg (i32.const -1))
    (if (i32.eq (local.get $op) (i32.const 169)) (then
      (local.set $arg (i32.const 4))
      (local.set $len (i32.shl (i32.mul (i32.load offset=4 (local.get $stack)) (i32.load offset=8 (local.get $stack))) (i32.const 4)))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 163)) (i32.const 2)) (then
      (local.set $arg (i32.const 2))
      (local.set $len (i32.mul (i32.load offset=8 (local.get $stack))
        (select (i32.const 2) (i32.const 4) (i32.eq (local.get $op) (i32.const 165)))))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 149)) (i32.eq (local.get $op) (i32.const 150))) (then
      (local.set $arg (select (i32.const 7) (i32.const 6) (i32.eq (local.get $op) (i32.const 149))))
      (local.set $len (i32.shl (i32.load offset=16 (local.get $stack))
        (select (i32.const 4) (i32.const 2) (i32.eq
          (i32.load (i32.add (local.get $stack) (select (i32.const 28) (i32.const 24) (i32.eq (local.get $op) (i32.const 149))))) (i32.const 0x1406)))))))

    (if (i32.le_u (i32.sub (local.get $op) (i32.const 158)) (i32.const 1)) (then
      (local.set $arg (i32.const 8))
      (local.set $len (i32.shl (i32.mul
        (i32.load (i32.add (local.get $stack) (select (i32.const 20) (i32.const 16) (i32.eq (local.get $op) (i32.const 159)))))
        (i32.load (i32.add (local.get $stack) (select (i32.const 24) (i32.const 20) (i32.eq (local.get $op) (i32.const 159))))))
        ;; RGBA8 canonical (unsigned-byte uploads) is 4 B/texel, float is 16.
        (select (i32.const 2) (i32.const 4) (i32.eq (i32.load offset=32 (local.get $stack)) (i32.const 0x1401)))))))
    (if (i32.eq (local.get $op) (i32.const 147)) (then
      (local.set $arg (i32.const 2))
      (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x2300)) (then
        (local.set $len (i32.shl (call $gl_texture_count (i32.const 1)
          (i32.load offset=8 (local.get $stack)) (i32.const 0)) (i32.const 2)))))))
    (if (i32.eq (local.get $op) (i32.const 112)) (then
      (local.set $arg (i32.const 2))
      (local.set $len (call $gl_tex_parameter_bytes (local.get $stack)))))
    (if (i32.eq (local.get $op) (i32.const 34)) (then (local.set $arg (i32.const 0)) (local.set $len (i32.const 64))))
    ;; 109 glMultMatrixf: the same 16 floats as glLoadMatrixf.
    (if (i32.eq (local.get $op) (i32.const 109)) (then (local.set $arg (i32.const 0)) (local.set $len (i32.const 64))))
    (if (i32.eq (local.get $op) (i32.const 43)) (then
      (local.set $arg (i32.const 1))
      (local.set $wide (i64.shl (i64.extend_i32_u (i32.load offset=4 (local.get $stack))) (i64.const 2)))
      (if (i64.gt_u (local.get $wide) (i64.const 0x7FFFFFFF)) (then (unreachable)))
      (local.set $len (i32.wrap_i64 (local.get $wide)))))
    (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 67)) (i32.eq (local.get $op) (i32.const 68)))
        (i32.or (i32.eq (local.get $op) (i32.const 69)) (i32.eq (local.get $op) (i32.const 78)))) (then
      (local.set $arg (select (i32.const 2) (i32.const 1) (i32.le_u (local.get $op) (i32.const 68))))
      (local.set $len (i32.shl (call $gl_lmf_count (call $gl_lmf_family (local.get $op))
        (i32.load (i32.add (local.get $stack) (i32.shl (local.get $arg) (i32.const 2))))) (i32.const 2)))))
    (if (i32.eq (local.get $op) (i32.const 85)) (then (local.set $arg (i32.const 2))
      (local.set $len (select (i32.const 4) (i32.const 16) (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x2500))))))
    ;; Texture uploads default to borrowed, synchronous consumption.
    (if (i32.eq (local.get $op) (i32.const 45)) (then (local.set $arg (i32.const 8))
      (local.set $len (call $gl_checked_image_bytes
        (i32.load offset=16 (local.get $stack)) (i32.load offset=20 (local.get $stack))
        (i32.load offset=28 (local.get $stack)) (i32.load offset=32 (local.get $stack))))
      (local.set $borrow (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 47)) (then (local.set $arg (i32.const 8))
      (local.set $len (call $gl_checked_image_bytes
        (i32.load offset=20 (local.get $stack)) (i32.load offset=24 (local.get $stack))
        (i32.load offset=28 (local.get $stack)) (i32.load offset=32 (local.get $stack))))
      (local.set $borrow (i32.const 1))
      ;; Small RGBA/BGRA byte updates own their pixels in the stream. Even
      ;; widths make a row divisible by every supported unpack alignment
      ;; (1/2/4/8); a single row has no trailing padding. Other layouts retain
      ;; the borrowed path, whose consumer computes its aligned read extent.
      (if (i32.and
          (i32.and (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
            (i32.eq (i32.load offset=32 (local.get $stack)) (i32.const 0x1401)))
          (i32.and
            (i32.or (i32.eq (i32.load offset=28 (local.get $stack)) (i32.const 0x1908))
              (i32.eq (i32.load offset=28 (local.get $stack)) (i32.const 0x80E1)))
            (i32.and (i32.le_u (local.get $len) (i32.const 0x10000))
              (i32.or (i32.eqz (i32.and (i32.load offset=20 (local.get $stack)) (i32.const 1)))
                (i32.eq (i32.load offset=24 (local.get $stack)) (i32.const 1))))))
        (then (local.set $borrow (i32.const 0))))))
    (if (i32.eq (local.get $op) (i32.const 61)) (then (local.set $arg (i32.const 6))
      (local.set $len (call $gl_checked_image_bytes
        (i32.load offset=12 (local.get $stack)) (i32.load offset=16 (local.get $stack))
        (i32.load offset=20 (local.get $stack)) (i32.load offset=24 (local.get $stack))))
      (local.set $borrow (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 98)) (then (local.set $arg (i32.const 5))
      (local.set $len (call $gl_checked_image_bytes
        (i32.load offset=12 (local.get $stack)) (i32.const 1)
        (i32.load offset=16 (local.get $stack)) (i32.load offset=20 (local.get $stack))))
      (local.set $borrow (i32.const 1))))
    (if (i32.lt_s (local.get $arg) (i32.const 0)) (then (return (i64.const 0))))
    (local.set $p (i32.load (i32.add (local.get $stack)
      (i32.shl (i32.add (local.get $arg) (i32.const 1)) (i32.const 2)))))
    (if (i32.or (i32.eqz (local.get $p)) (i32.eqz (local.get $len))) (then (return (i64.const 0))))
    (i64.or (i64.or (i64.extend_i32_u (local.get $p))
        (i64.shl (i64.extend_i32_u (local.get $len)) (i64.const 32)))
      (i64.shl (i64.extend_i32_u (local.get $borrow)) (i64.const 63))))

  (func $gl_object_enter
    (call $gl_sw_private_state)
    (if (i32.eqz (global.get $gl_object_lock_depth)) (then
      (loop $claim
        (br_if $claim (i32.ne (i32.atomic.rmw.cmpxchg (region.addr $GL_MTX_BLOCKS 8)
          (i32.const 0) (i32.const 1)) (i32.const 0))))))
    (global.set $gl_object_lock_depth (i32.add (global.get $gl_object_lock_depth) (i32.const 1))))
  (func $gl_object_leave
    ;; Native argument gather/texture conversion and list replay can hold an
    ;; outer lock around nested encoder calls. Publish at the actual outer
    ;; completion, before another producer can observe the shared objects.
    ;; Begin/End geometry stays private; only completed server values publish.
    (if (i32.and (i32.ne (global.get $gl_current_context) (i32.const 0))
        (i32.eq (global.get $gl_object_lock_depth) (i32.const 1))) (then
      (call $gl_state_publish (global.get $gl_current_context))
      (if (i32.lt_s (global.get $gl_immediate_mode) (i32.const 0))
        (then (call $gl_sw_context_publish)))
      (drop (call $gl_wat_stream_flush))))
    (global.set $gl_object_lock_depth (i32.sub (global.get $gl_object_lock_depth) (i32.const 1)))
    (if (i32.eqz (global.get $gl_object_lock_depth))
      (then (i32.atomic.store (region.addr $GL_MTX_BLOCKS 8) (i32.const 0)))))
  ;; Immediate-mode attribute/vertex fast path. Inside Begin/End, outside
  ;; display-list compilation, glColor3f/4f (23/25), glTexCoord2f (28) and
  ;; glVertex2f/3f/3fv (29/30/31) are consumed by $gl_state_intercept; every
  ;; validator, query and observer ahead of it in $gl_wat_encode_call_locked
  ;; is gated on other opcodes. Vertices only append to this instance's
  ;; private primitive and change no published server value, so they also
  ;; skip the object lock and its publish; current-attribute setters keep it.
  ;; Returns 1 when the call was consumed, 0 to take the general path.
  (func $gl_imm_fast (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $vertex i32)
    (if (i32.eqz (i32.or (i32.or (i32.eq (local.get $op) (i32.const 23)) (i32.eq (local.get $op) (i32.const 25)))
        (i32.le_u (i32.sub (local.get $op) (i32.const 28)) (i32.const 3))))
      (then (return (i32.const 0))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    ;; $gl_list_intercept captures exactly when a list is open and not replaying.
    (if (i32.and (i32.ne (i32.load offset=12 (local.get $ctx)) (i32.const 0))
                 (i32.eqz (i32.load offset=28 (local.get $ctx))))
      (then (return (i32.const 0))))
    (local.set $vertex (i32.ge_u (local.get $op) (i32.const 29)))
    (if (i32.eqz (local.get $vertex)) (then (call $gl_object_enter)))
    (global.set $gl_sw_border_set_failed (i32.const 0))
    (global.set $gl_wat_stat_calls (i64.add (global.get $gl_wat_stat_calls) (i64.const 1)))
    (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
    (if (i32.eqz (call $gl_state_intercept (local.get $op) (local.get $stack))) (then (unreachable)))
    (if (i32.eqz (local.get $vertex)) (then (call $gl_object_leave)))
    (i32.const 1))

  ;; Publish completed outer server calls while still holding the process lock.
  ;; A later producer cannot drain this instance's private stream: admit its
  ;; completed prefix now, before the next producer acquires the lock. Nested
  ;; replay publishes at outer completion. Begin/End geometry stays private,
  ;; but legal current/material setters inside Begin are completed server state.
  (func $gl_wat_encode_call (param $op i32) (param $stack i32) (param $aux i32) (result i32)
    (local $result i32)
    (if (i32.and (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
                 (i32.ne (global.get $gl_current_context) (i32.const 0)))
      (then (if (call $gl_imm_fast (local.get $op) (local.get $stack)) (then (return (i32.const 0))))))
    (call $gl_object_enter)
    (local.set $result (call $gl_wat_encode_call_locked (local.get $op) (local.get $stack) (local.get $aux)))
    (if (i32.and (i32.ne (global.get $gl_current_context) (i32.const 0))
        (i32.eq (local.get $op) (i32.const 77))) (then (call $gl_period_color)))
    (call $gl_object_leave)
    (local.get $result))

  (func $gl_wat_encode_call_locked (param $op i32) (param $stack i32) (param $aux i32) (result i32)
    (local $spec i64) (local $ptr i32) (local $len i32) (local $borrow i32) (local $result i32)
    (local $error i32)
    (local $source_guest i32) (local $source_stack i32) (local $source_p i32) (local $source_last i32)
    ;; Client array definitions execute immediately, including GL_COMPILE.
    (if (i32.eq (local.get $op) (i32.const 0x10033)) (then
      (drop (call $gl_index_command (local.get $op) (local.get $stack))) (return (i32.const 0))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 0x10020)) (i32.const 7)) (then
      (return (call $gl_sf_command (local.get $op) (local.get $stack)))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 0x10010)) (i32.const 4)) (then
      (call $gl_eval_execute (local.get $op) (local.get $stack)) (return (i32.const 0))))
    ;; Private transaction entry. Never bind or query the foreign source.
    (if (i32.eq (local.get $op) (i32.const 0x10005)) (then
      (return (call $gl_copy_context (i32.load offset=4 (local.get $stack))
        (i32.load offset=8 (local.get $stack)) (i32.load offset=12 (local.get $stack))))))
    ;; Canonicalize byte vectors before list capture. The pointed bytes must
    ;; belong to the list, just like the wider integer vector entrypoints.
    (if (i32.or (i32.eq (local.get $op) (i32.const 27)) (i32.eq (local.get $op) (i32.const 58))) (then
      (local.set $source_p (i32.load offset=4 (local.get $stack)))
      (local.set $source_last (select (i32.const 2) (i32.const 3) (i32.eq (local.get $op) (i32.const 58))))
      (if (i32.gt_u (local.get $source_p) (i32.sub (i32.const -1) (local.get $source_last))) (then (unreachable)))
      (if (i32.eq (call $g2w (local.get $source_p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
      (if (i32.eq (call $g2w (i32.add (local.get $source_p) (local.get $source_last))) (global.get $NULL_SENTINEL)) (then (unreachable)))
      (local.set $source_guest (call $gl_alloc_affine (i32.const 24)))
      (if (i32.eqz (local.get $source_guest)) (then (unreachable)))
      (local.set $source_stack (call $g2w (local.get $source_guest)))
      (i32.store (local.get $source_stack) (i32.const 0))
      (i32.store offset=4 (local.get $source_stack)
        (select (i32.const 520) (i32.const 8) (i32.eq (local.get $op) (i32.const 58))))
      (i32.store offset=8 (local.get $source_stack) (call $gl8 (local.get $source_p)))
      (i32.store offset=12 (local.get $source_stack) (call $gl8 (i32.add (local.get $source_p) (i32.const 1))))
      (i32.store offset=16 (local.get $source_stack) (call $gl8 (i32.add (local.get $source_p) (i32.const 2))))
      (i32.store offset=20 (local.get $source_stack)
        (if (result i32) (i32.eq (local.get $op) (i32.const 27))
          (then (call $gl8 (i32.add (local.get $source_p) (i32.const 3)))) (else (i32.const 0))))
      (local.set $result (call $gl_wat_encode_call_locked (i32.const 0x10003) (local.get $source_stack) (i32.const 0)))
      (call $heap_free (local.get $source_guest))
      (return (local.get $result))))

    (if (i32.and (i32.eq (local.get $op) (i32.const 49))
        (i32.eqz (call $gl_share_context_find (i32.load offset=4 (local.get $stack))))) (then
      (global.set $last_error (i32.const 6)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 178)) (then
      ;; WGL reports Win32 errors without consuming or changing GL errors.
      (local.set $error (call $gl_share_validate (i32.load offset=4 (local.get $stack))
        (i32.load offset=8 (local.get $stack))))
      (if (local.get $error) (then
        (global.set $last_error (local.get $error)) (return (i32.const 0))))))
    (if (i32.and (i32.ne (global.get $gl_current_context) (i32.const 0)) (i32.eq (local.get $op) (i32.const 113))) (then
      (call $gl_texture_query (i32.const 0) (i32.const 0)
        (i32.load offset=4 (local.get $stack)) (i32.load offset=8 (local.get $stack))
        (i32.load offset=12 (local.get $stack))) (return (i32.const 0))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 163)) (i32.const 5)) (then
      (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 0))))
      (local.set $error (call $gl_pixel_map_validate (local.get $op) (local.get $stack)))
      (if (local.get $error) (then (call $gl_list_error (call $gl_list_context) (local.get $error)) (return (i32.const 0))))
      (if (i32.ge_u (local.get $op) (i32.const 166)) (then
        (call $gl_pixel_map_get (local.get $op) (local.get $stack)) (return (i32.const 0))))
      (call $gl_1d_span (i32.load offset=12 (local.get $stack))
        (i32.mul (i32.load offset=8 (local.get $stack)) (select (i32.const 2) (i32.const 4) (i32.eq (local.get $op) (i32.const 165)))))))
    (if (call $gl_sf_query (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_eval_query (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_pointer_query (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_client_enable_query (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_native_query (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_clip_query (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_1d_query (local.get $op) (local.get $stack)) (then (return (global.get $gl_list_result))))
    (if (i32.eq (local.get $op) (i32.const 155)) (then
      (call $gl_texture_get_image (i32.load offset=4 (local.get $stack)) (i32.load offset=8 (local.get $stack))
        (i32.load offset=12 (local.get $stack)) (i32.load offset=16 (local.get $stack)) (i32.load offset=20 (local.get $stack)))
      (return (i32.const 0))))
    (if (i32.and (i32.ne (global.get $gl_current_context) (i32.const 0))
        (i32.or (i32.eq (local.get $op) (i32.const 45)) (i32.eq (local.get $op) (i32.const 47)))) (then
      (call $gl_2d_upload (i32.eq (local.get $op) (i32.const 47)) (local.get $stack)) (return (i32.const 0))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 151)) (i32.const 3)) (then
      (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 0))))
      (local.set $error (call $gl_texture_copy_validate (local.get $op) (local.get $stack)))
      (if (local.get $error) (then (call $gl_list_error (call $gl_list_context) (local.get $error)) (return (i32.const 0))))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 156)) (i32.const 1)) (then
      (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 0))))
      (local.set $error (select (i32.const 0) (i32.const 0x500) (call $gl_transfer_valid (i32.load offset=4 (local.get $stack)))))
      (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (i32.load offset=36 (call $gl_list_context)))
        (then (local.set $error (i32.const 0x502))))
      (if (local.get $error) (then (call $gl_list_error (call $gl_list_context) (local.get $error)) (return (i32.const 0))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 158)) (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x8064))) (then
      (drop (call $gl_2d_store (i32.const 0) (local.get $stack))) (return (i32.const 0))))
    ;; Proxy definitions are immediate even during display-list compilation.
    (if (i32.and (i32.eq (local.get $op) (i32.const 149)) (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x8063))) (then
      (drop (call $gl_1d_store (i32.const 0) (local.get $stack))) (return (i32.const 0))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 169)) (i32.const 2)) (then
      (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 0))))
      (local.set $error (call $gl_pixels_validate (local.get $op) (local.get $stack)))
      (if (local.get $error) (then (call $gl_list_error (call $gl_list_context) (local.get $error)) (return (i32.const 0))))))
    (if (call $gl_stipple_intercept (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_list_intercept (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_index_command (local.get $op) (local.get $stack)) (then (return (i32.const 0))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 2))
        (i32.ne (call $gl_sf_mode) (i32.const 0x1c00))) (then
      (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (then (call $gl_list_error (call $gl_list_context) (i32.const 0x502)))
        (else (if (i32.and (i32.load offset=4 (local.get $stack)) (i32.const 0xffffb8ff))
          (then (call $gl_list_error (call $gl_list_context) (i32.const 0x501))))))
      (return (i32.const 0))))
    (if (call $gl_eval_enable (local.get $op) (local.get $stack)) (then (return (i32.const 0))))
    (call $gl_eval_attrib (local.get $op) (local.get $stack))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 169)) (i32.const 2)) (then
      (call $gl_pixels_execute (local.get $op) (local.get $stack)) (return (i32.const 0))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 163)) (i32.const 2)) (then
      (call $gl_pixel_map_set (local.get $op) (local.get $stack))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 149)) (i32.eq (local.get $op) (i32.const 150))) (then
      (if (i32.eqz (call $gl_1d_store (i32.eq (local.get $op) (i32.const 150)) (local.get $stack))) (then (return (i32.const 0))))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 151)) (i32.const 3)) (then
      (call $gl_texture_copy_execute (local.get $op) (local.get $stack)) (return (i32.const 0))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 156)) (i32.const 1)) (then
      (call $gl_transfer_observe (local.get $stack) (i32.eq (local.get $op) (i32.const 157)))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 158)) (i32.const 1)) (then
      (if (i32.eqz (call $gl_2d_store (i32.eq (local.get $op) (i32.const 159)) (local.get $stack))) (then (return (i32.const 0))))))
    (if (call $gl_query_validate_setter (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_color_selection_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_stencil_intercept (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_color_mask_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_bitmap_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (global.set $gl_wat_stat_calls (i64.add (global.get $gl_wat_stat_calls) (i64.const 1)))
    (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
    (if (i32.eq (local.get $op) (i32.const 142)) (then
      (call $gl_rectf (local.get $stack)) (return (i32.const 0))))
    ;; Shadow the fixed-function transform/lighting state into WAT. This only
    ;; observes -- the call goes on to the stream unchanged, so nothing about
    ;; what gets drawn moves. It runs BEFORE $gl_state_intercept because that
    ;; function absorbs some of the calls the mirror has to see: 76 and 77
    ;; (glPushAttrib/glPopAttrib) return 1 from it and would otherwise never
    ;; reach the observer, leaving the mirror silently stale instead of
    ;; marked untrusted. See src/09a8f-gl-matrix.wat.
    (if (i32.and (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.or (i32.eq (local.get $op) (i32.const 68))
                (i32.or (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 92))))) (then
      (call $gl_material_light_pending)
      (global.set $gl_material_prelit (i32.ne
        (i32.and (i32.load offset=9036 (call $gl_mtx_block)) (i32.const 128)) (i32.const 0)))))
    (call $gl_clip_observe (local.get $op) (local.get $stack))
    (call $gl_texture_observe (local.get $op) (local.get $stack))
    (if (i32.eq (local.get $op) (i32.const 43)) (then (call $gl_texture_delete (local.get $stack))))
    (call $gl_mtx_observe (local.get $op) (local.get $stack))
    ;; glClear/glClearColor for the WAT software target; inert when it is off.
    (call $gl_sf_observe (local.get $op) (local.get $stack))
    (call $gl_sw_observe (local.get $op) (local.get $stack))
    (call $gl_period_observe (local.get $op) (local.get $stack))
    (call $gl_hint_observe (local.get $op) (local.get $stack))
    (if (i32.or (i32.eq (local.get $op) (i32.const 77)) (i32.or (i32.eq (local.get $op) (i32.const 42)) (i32.eq (local.get $op) (i32.const 43))))
      (then
        (call $gl_texture_sync_sampling)
        (if (global.get $gl_current_context) (then
          (call $gl_texture_collect (i32.load offset=968 (call $gl_list_context)))))))
    ;; Native allocation failure must not leave the replay frontend claiming
    ;; a color was installed. The record carries the same GL error instead.
    (if (i32.and (i32.eq (local.get $op) (i32.const 112))
                 (i32.ne (global.get $gl_sw_border_set_failed) (i32.const 0)))
      (then (local.set $aux (i32.const 0x0505))))
    (if (call $gl_state_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 19)) (then
      (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then (unreachable)))
      (global.set $gl_shade_model (i32.load offset=4 (local.get $stack))) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 21)) (then
      (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then (unreachable)))
      (global.set $gl_immediate_mode (i32.load offset=4 (local.get $stack)))
      (global.set $gl_material_prelit (i32.const 0))
      (global.set $gl_material_lit_floats (i32.const 0))
      (global.set $gl_immediate_floats (i32.const 0))
    (global.set $gl_immediate_has_source (i32.const 0)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 22)) (then
      (drop (call $gl_finish_immediate))
      (global.set $gl_material_prelit (i32.const 0))
      (global.set $gl_material_lit_floats (i32.const 0)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 23)) (then
      (global.set $gl_color_r (f32.load offset=4 (local.get $stack)))
      (global.set $gl_color_g (f32.load offset=8 (local.get $stack)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $stack)))
      (global.set $gl_color_a (f32.const 1)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 25)) (then
      (global.set $gl_color_r (f32.load offset=4 (local.get $stack)))
      (global.set $gl_color_g (f32.load offset=8 (local.get $stack)))
      (global.set $gl_color_b (f32.load offset=12 (local.get $stack)))
      (global.set $gl_color_a (f32.load offset=16 (local.get $stack))) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 28)) (then
      (global.set $gl_tex_s (f32.load offset=4 (local.get $stack)))
      (global.set $gl_tex_t (f32.load offset=8 (local.get $stack)))
      (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 30)) (then
      (call $gl_append_vertex (f32.load offset=4 (local.get $stack))
        (f32.load offset=8 (local.get $stack)) (f32.load offset=12 (local.get $stack)))
      (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 29)) (then
      (call $gl_append_vertex (f32.load offset=4 (local.get $stack))
        (f32.load offset=8 (local.get $stack)) (f32.const 0)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 63)) (then
      (global.set $gl_normal_x (f32.load offset=4 (local.get $stack)))
      (global.set $gl_normal_y (f32.load offset=8 (local.get $stack)))
      (global.set $gl_normal_z (f32.load offset=12 (local.get $stack))) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 107)) (then
      (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x84C1))
        (then (global.set $gl_tex1_s (f32.load offset=8 (local.get $stack)))
          (global.set $gl_tex1_t (f32.load offset=12 (local.get $stack)))
          (global.set $gl_tex1_r (f32.const 0)) (global.set $gl_tex1_q (f32.const 1)))
        (else (global.set $gl_tex_s (f32.load offset=8 (local.get $stack)))
          (global.set $gl_tex_t (f32.load offset=12 (local.get $stack)))
          (global.set $gl_tex_r (f32.const 0)) (global.set $gl_tex_q (f32.const 1))))
      (return (i32.const 0))))
    (if (i32.and (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 68))
                        (i32.or (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 92)))))) (then (unreachable)))
    (if (i32.and (global.get $gl_sw_enabled) (i32.eq (local.get $op) (i32.const 17)))
      (then (local.set $aux (call $gl_sw_read_surface))))
    (local.set $spec (call $gl_pointer_length (local.get $op) (local.get $stack)))
    (local.set $ptr (i32.wrap_i64 (local.get $spec)))
    (local.set $len (i32.and
      (i32.wrap_i64 (i64.shr_u (local.get $spec) (i64.const 32))) (i32.const 0x7FFFFFFF)))
    (local.set $borrow (i32.wrap_i64 (i64.shr_u (local.get $spec) (i64.const 63))))
    (if (i32.and (i32.ne (local.get $len) (i32.const 0))
        (i32.gt_u (i32.add (i32.add (i32.const 36)
          (i32.shl (call $gl_source_arg_words (local.get $op)) (i32.const 2))) (local.get $len))
          (i32.const 0x00200000)))
      (then (local.set $borrow (i32.const 1))))
    (if (i32.eqz (call $gl_emit_record (local.get $op) (local.get $stack) (local.get $aux)
      (local.get $ptr) (local.get $len) (local.get $borrow))) (then (unreachable)))
    (if (i32.or (i32.ne (local.get $borrow) (i32.const 0))
        (call $gl_is_barrier (local.get $op)))
      (then (local.set $result (call $gl_wat_stream_flush))))
    (if (local.get $result) (then
      (if (i32.eq (local.get $op) (i32.const 48))
        (then (drop (call $gl_list_context_key (local.get $result)))))
      (if (i32.eq (local.get $op) (i32.const 178))
        (then (call $gl_share_install (i32.load offset=4 (local.get $stack)) (i32.load offset=8 (local.get $stack)))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 178)) (i32.eqz (local.get $result)))
      (then (global.set $last_error (i32.const 87))))
    (if (i32.and (i32.eqz (local.get $result)) (i32.eq (local.get $op) (i32.const 49)))
      (then (global.set $last_error (i32.const 170))))
    (if (i32.and (i32.eqz (local.get $result)) (i32.eq (local.get $op) (i32.const 51))) (then
      (call $gl_state_context_changed (i32.const 0))
      (call $gl_sw_bind_drawable (i32.const 0))
      (global.set $gl_current_dc (i32.const 0))
      (global.set $last_error (select (i32.const 170) (i32.const 6)
        (call $gl_share_context_find (i32.load offset=8 (local.get $stack)))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 51)) (i32.ne (local.get $result) (i32.const 0)))
      (then
        (call $gl_state_context_changed (i32.load offset=8 (local.get $stack)))
        (call $gl_sw_bind_drawable
          (select (local.get $aux) (i32.const 0) (i32.load offset=8 (local.get $stack))))
        ;; wglMakeCurrent(hdc, NULL) releases the context and its DC alike.
        (global.set $gl_current_dc
          (if (result i32) (i32.load offset=8 (local.get $stack))
            (then (i32.load offset=4 (local.get $stack)))
            (else (i32.const 0))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 49)) (i32.ne (local.get $result) (i32.const 0)))
      (then
        (call $gl_state_context_deleted (i32.load offset=4 (local.get $stack)))
        (call $gl_list_context_deleted (i32.load offset=4 (local.get $stack)))))
    (local.get $result))

  (func $gl_wat_encoder_reset
    (call $gl_object_enter)
    (global.set $gl_material_prelit (i32.const 0))
    (global.set $gl_material_lit_floats (i32.const 0))
    (call $gl_list_reset)
    (drop (call $gl_wat_stream_flush))
    (global.set $gl_stream_used_bytes (i32.const 0))
    (global.set $gl_stream_command_count (i32.const 0))
    (global.set $gl_immediate_floats (i32.const 0))
    (global.set $gl_immediate_has_source (i32.const 0))
    (global.set $gl_immediate_mode (i32.const -1))
    (call $gl_state_reset)
    (global.set $gl_current_context (i32.const 0))
    (global.set $gl_current_dc (i32.const 0))
    (call $gl_object_leave))


  ;; Copy only server value fields. Every pointer, client descriptor, resource,
  ;; error and stack frame stays owned by its original destination context.
  (func $gl_copy_values (param $mask i32)
    (param $src_state i32) (param $dst_state i32)
    (param $src_matrix i32) (param $dst_matrix i32)
    (param $src_ctx i32) (param $dst_ctx i32)
    (param $src_raster i32) (param $dst_raster i32)
    (param $src_texture i32) (param $dst_texture i32)
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (i32.store offset=1044 (local.get $dst_ctx) (i32.load offset=1044 (local.get $src_ctx)))))
    (if (i32.and (local.get $mask) (i32.const 0x4000)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 1048))
        (i32.add (local.get $src_ctx) (i32.const 1048)) (i32.const 8))))
    (if (i32.and (local.get $mask) (i32.const 8)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 4180)) (i32.add (local.get $src_raster) (i32.const 4180)) (i32.const 8))))
    (if (i32.and (local.get $mask) (i32.const 0x2008)) (then
      (i32.store offset=4188 (local.get $dst_raster) (i32.load offset=4188 (local.get $src_raster)))))
    ;; current RGBA/normal/first two texture coordinates
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (memory.copy (i32.add (local.get $dst_state) (i32.const 4))
        (i32.add (local.get $src_state) (i32.const 4)) (i32.const 44))))
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (i32.store offset=164 (local.get $dst_state) (i32.load offset=164 (local.get $src_state)))))
    ;; current projective texture coordinates
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (memory.copy (i32.add (local.get $dst_state) (i32.const 148))
        (i32.add (local.get $src_state) (i32.const 148)) (i32.const 16))))
    ;; exact typed current color
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (memory.copy (i32.add (local.get $dst_state) (i32.const 176))
        (i32.add (local.get $src_state) (i32.const 176)) (i32.const 20))))
    ;; raster validity/position/color/initial coordinates
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 40))
        (i32.add (local.get $src_ctx) (i32.const 40)) (i32.const 40))))
    ;; raster distance/index/two projective coordinates
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 264))
        (i32.add (local.get $src_ctx) (i32.const 264)) (i32.const 40))))
    ;; packed raster color, validity and exact typed tail
    (if (i32.and (local.get $mask) (i32.const 1)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 976))
        (i32.add (local.get $src_ctx) (i32.const 976)) (i32.const 32))))
    ;; point size
    (if (i32.and (local.get $mask) (i32.const 2)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1808))
        (i32.add (local.get $src_raster) (i32.const 1808)) (i32.const 4))))
    ;; line width
    (if (i32.and (local.get $mask) (i32.const 4)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1812))
        (i32.add (local.get $src_raster) (i32.const 1812)) (i32.const 4))))
    ;; line stipple factor/pattern
    (if (i32.and (local.get $mask) (i32.const 4)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1844))
        (i32.add (local.get $src_raster) (i32.const 1844)) (i32.const 8))))
    ;; cull face/front face
    (if (i32.and (local.get $mask) (i32.const 8)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 28))
        (i32.add (local.get $src_raster) (i32.const 28)) (i32.const 8))))
    ;; front/back polygon modes
    (if (i32.and (local.get $mask) (i32.const 8)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 4164))
        (i32.add (local.get $src_raster) (i32.const 4164)) (i32.const 8))))
    ;; polygon stipple bytes
    (if (i32.and (local.get $mask) (i32.const 16)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1852))
        (i32.add (local.get $src_raster) (i32.const 1852)) (i32.const 128))))
    ;; read buffer
    (if (i32.and (local.get $mask) (i32.const 32)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 236))
        (i32.add (local.get $src_ctx) (i32.const 236)) (i32.const 4))))
    ;; pixel transfer values
    (if (i32.and (local.get $mask) (i32.const 32)) (then
      (memory.copy (i32.add (local.get $dst_texture) (i32.const 204))
        (i32.add (local.get $src_texture) (i32.const 204)) (i32.const 64))))
    ;; pixel zoom
    (if (i32.and (local.get $mask) (i32.const 32)) (then
      (memory.copy (i32.add (local.get $dst_texture) (i32.const 300))
        (i32.add (local.get $src_texture) (i32.const 300)) (i32.const 8))))
    ;; shade model
    (if (i32.and (local.get $mask) (i32.const 64)) (then
      (memory.copy (i32.add (local.get $dst_state) (i32.const 48))
        (i32.add (local.get $src_state) (i32.const 48)) (i32.const 4))))
    ;; ambient/lights/front material
    (if (i32.and (local.get $mask) (i32.const 64)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 8352))
        (i32.add (local.get $src_matrix) (i32.const 8352)) (i32.const 608))))
    ;; light extras/back material
    (if (i32.and (local.get $mask) (i32.const 64)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 10832))
        (i32.add (local.get $src_matrix) (i32.const 10832)) (i32.const 336))))
    ;; local viewer/two side
    (if (i32.and (local.get $mask) (i32.const 64)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 11192))
        (i32.add (local.get $src_matrix) (i32.const 11192)) (i32.const 8))))
    ;; color material face/parameter
    (if (i32.and (local.get $mask) (i32.const 64)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 4172))
        (i32.add (local.get $src_raster) (i32.const 4172)) (i32.const 8))))
    ;; fog mode/density/start/end/color
    (if (i32.and (local.get $mask) (i32.const 128)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 8960))
        (i32.add (local.get $src_matrix) (i32.const 8960)) (i32.const 32))))
    ;; fog index
    (if (i32.and (local.get $mask) (i32.const 128)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 11200))
        (i32.add (local.get $src_matrix) (i32.const 11200)) (i32.const 4))))
    ;; software fog values
    (if (i32.and (local.get $mask) (i32.const 128)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1824))
        (i32.add (local.get $src_raster) (i32.const 1824)) (i32.const 20))))
    ;; depth function/write mask
    (if (i32.and (local.get $mask) (i32.const 256)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 20))
        (i32.add (local.get $src_raster) (i32.const 20)) (i32.const 8))))
    ;; clear depth
    (if (i32.and (local.get $mask) (i32.const 256)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1796))
        (i32.add (local.get $src_raster) (i32.const 1796)) (i32.const 4))))
    ;; clear accumulation values
    (if (i32.and (local.get $mask) (i32.const 512)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 248))
        (i32.add (local.get $src_ctx) (i32.const 248)) (i32.const 16))))
    ;; stencil values except overlapping enable
    (if (i32.and (local.get $mask) (i32.const 1024)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 196))
        (i32.add (local.get $src_ctx) (i32.const 196)) (i32.const 32))))
    ;; viewport/depth range
    (if (i32.and (local.get $mask) (i32.const 2048)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 9008))
        (i32.add (local.get $src_matrix) (i32.const 9008)) (i32.const 24))))
    ;; raster depth range/viewport-valid
    (if (i32.and (local.get $mask) (i32.const 2048)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 160))
        (i32.add (local.get $src_ctx) (i32.const 160)) (i32.const 12))))
    ;; matrix mode only
    (if (i32.and (local.get $mask) (i32.const 4096)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 0))
        (i32.add (local.get $src_matrix) (i32.const 0)) (i32.const 4))))
    ;; eye-space clip equations
    (if (i32.and (local.get $mask) (i32.const 4096)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 768))
        (i32.add (local.get $src_ctx) (i32.const 768)) (i32.const 192))))
    ;; blend/alpha function/reference
    (if (i32.and (local.get $mask) (i32.const 16384)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 4))
        (i32.add (local.get $src_raster) (i32.const 4)) (i32.const 16))))
    ;; clear color
    (if (i32.and (local.get $mask) (i32.const 16384)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1792))
        (i32.add (local.get $src_raster) (i32.const 1792)) (i32.const 4))))
    ;; logic operation
    (if (i32.and (local.get $mask) (i32.const 16384)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 4160))
        (i32.add (local.get $src_raster) (i32.const 4160)) (i32.const 4))))
    ;; color mask/draw buffer
    (if (i32.and (local.get $mask) (i32.const 16384)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 228))
        (i32.add (local.get $src_ctx) (i32.const 228)) (i32.const 8))))
    ;; five exact hint values
    (if (i32.and (local.get $mask) (i32.const 32768)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 1008))
        (i32.add (local.get $src_ctx) (i32.const 1008)) (i32.const 20))))
    ;; list base only
    (if (i32.and (local.get $mask) (i32.const 131072)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 100))
        (i32.add (local.get $src_ctx) (i32.const 100)) (i32.const 4))))
    ;; active texture selector
    (if (i32.and (local.get $mask) (i32.const 262144)) (then
      (memory.copy (i32.add (local.get $dst_matrix) (i32.const 4))
        (i32.add (local.get $src_matrix) (i32.const 4)) (i32.const 4))))
    ;; per-unit texgen values
    (if (i32.and (local.get $mask) (i32.const 262144)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 384))
        (i32.add (local.get $src_ctx) (i32.const 384)) (i32.const 296))))
    ;; per-unit texture environment values
    (if (i32.and (local.get $mask) (i32.const 262144)) (then
      (memory.copy (i32.add (local.get $dst_texture) (i32.const 32))
        (i32.add (local.get $src_texture) (i32.const 32)) (i32.const 40))))
    ;; software texture environment
    (if (i32.and (local.get $mask) (i32.const 262144)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 36))
        (i32.add (local.get $src_raster) (i32.const 36)) (i32.const 4))))
    ;; software active selector
    (if (i32.and (local.get $mask) (i32.const 262144)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1800))
        (i32.add (local.get $src_raster) (i32.const 1800)) (i32.const 4))))
    ;; software texgen modes
    (if (i32.and (local.get $mask) (i32.const 262144)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 1816))
        (i32.add (local.get $src_raster) (i32.const 1816)) (i32.const 4))))
    ;; scissor box
    (if (i32.and (local.get $mask) (i32.const 524288)) (then
      (memory.copy (i32.add (local.get $dst_raster) (i32.const 48))
        (i32.add (local.get $src_raster) (i32.const 48)) (i32.const 16))))
    ;; stencil enable
    (if (i32.and (local.get $mask) (i32.const 9216)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 192))
        (i32.add (local.get $src_ctx) (i32.const 192)) (i32.const 4))))
    ;; clip enables
    (if (i32.and (local.get $mask) (i32.const 12288)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 960))
        (i32.add (local.get $src_ctx) (i32.const 960)) (i32.const 4))))
    ;; unit0 texgen enables
    (if (i32.and (local.get $mask) (i32.const 270336)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 384))
        (i32.add (local.get $src_ctx) (i32.const 384)) (i32.const 4))))
    ;; unit1 texgen enables
    (if (i32.and (local.get $mask) (i32.const 270336)) (then
      (memory.copy (i32.add (local.get $dst_ctx) (i32.const 532))
        (i32.add (local.get $src_ctx) (i32.const 532)) (i32.const 4))))
    ;; 1D enables
    (if (i32.and (local.get $mask) (i32.const 270336)) (then
      (memory.copy (i32.add (local.get $dst_texture) (i32.const 192))
        (i32.add (local.get $src_texture) (i32.const 192)) (i32.const 4))))
  )
  (func $gl_copy_bits (param $a i32) (param $b i32) (param $bits i32)
    (i32.store (local.get $b) (i32.or
      (i32.and (i32.load (local.get $b)) (i32.xor (local.get $bits) (i32.const -1)))
      (i32.and (i32.load (local.get $a)) (local.get $bits)))))

  ;; Initialize never-bound contexts by key, without changing producer globals.
  (func $gl_copy_state (param $key i32) (result i32)
    (local $p i32)
    (local.set $p (call $gl_state_slot (local.get $key) (i32.const 0)))
    (if (local.get $p) (then (return (local.get $p))))
    (local.set $p (call $gl_state_slot (local.get $key) (i32.const 1)))
    (f32.store offset=4 (local.get $p) (f32.const 1))
    (f32.store offset=8 (local.get $p) (f32.const 1))
    (f32.store offset=12 (local.get $p) (f32.const 1))
    (f32.store offset=16 (local.get $p) (f32.const 1))
    (f32.store offset=36 (local.get $p) (f32.const 1))
    (f32.store offset=152 (local.get $p) (f32.const 1))
    (f32.store offset=160 (local.get $p) (f32.const 1))
    (i32.store offset=164 (local.get $p) (i32.const 1))
    (i32.store offset=48 (local.get $p) (i32.const 7425))
    (i32.store offset=60 (local.get $p) (i32.const 4))
    (i32.store offset=64 (local.get $p) (i32.const 5126))
    (i32.store offset=76 (local.get $p) (i32.const 5126))
    (i32.store offset=88 (local.get $p) (i32.const 4))
    (i32.store offset=92 (local.get $p) (i32.const 5126))
    (i32.store offset=104 (local.get $p) (i32.const 4))
    (i32.store offset=108 (local.get $p) (i32.const 5126))
    (i32.store offset=120 (local.get $p) (i32.const 4))
    (i32.store offset=124 (local.get $p) (i32.const 5126))
    (local.get $p))
  (func $gl_copy_raster (param $ctx i32) (result i32)
    (local $p i32)
    (local.set $p (i32.load offset=240 (local.get $ctx)))
    (if (local.get $p) (then (return (local.get $p))))
    (local.set $p (call $gl_list_alloc (i32.const 4192)))
    (if (i32.eqz (local.get $p)) (then (unreachable)))
    (i32.store offset=0 (local.get $p) (i32.const 134217728))
    (i32.store offset=4 (local.get $p) (i32.const 2))
    (i32.store offset=8 (local.get $p) (i32.const 1))
    (i32.store offset=12 (local.get $p) (i32.const 8))
    (i32.store offset=20 (local.get $p) (i32.const 2))
    (i32.store offset=24 (local.get $p) (i32.const 1))
    (i32.store offset=28 (local.get $p) (i32.const 1029))
    (i32.store offset=32 (local.get $p) (i32.const 1))
    (i32.store offset=36 (local.get $p) (i32.const 4))
    (i32.store offset=44 (local.get $p) (i32.const 4))
    (i32.store offset=56 (local.get $p) (i32.const -1))
    (i32.store offset=60 (local.get $p) (i32.const -1))
    (i32.store offset=1796 (local.get $p) (i32.const 65535))
    (i32.store offset=1816 (local.get $p) (i32.const 603988992))
    (i32.store offset=1824 (local.get $p) (i32.const 2048))
    (i32.store offset=1844 (local.get $p) (i32.const 1))
    (i32.store offset=1848 (local.get $p) (i32.const 65535))
    (i32.store offset=4160 (local.get $p) (i32.const 5379))
    (i32.store offset=4164 (local.get $p) (i32.const 6914))
    (i32.store offset=4168 (local.get $p) (i32.const 6914))
    (i32.store offset=4172 (local.get $p) (i32.const 1032))
    (i32.store offset=4176 (local.get $p) (i32.const 5634))
    (f32.store offset=1808 (local.get $p) (f32.const 1))
    (f32.store offset=1812 (local.get $p) (f32.const 1))
    (f32.store offset=1828 (local.get $p) (f32.const 1))
    (f32.store offset=1836 (local.get $p) (f32.const 1))
    (memory.fill (i32.add (local.get $p) (i32.const 1852)) (i32.const 255) (i32.const 128))
    (i32.store offset=240 (local.get $ctx) (local.get $p))
    (local.get $p))

  ;; Abort owns every unlinked texture node; success transfers that chain.
  (func $gl_copy_plan_free (param $plan i32) (param $abort i32)
    (local $p i32) (local $next i32)
    (if (local.get $abort) (then
      (local.set $p (i32.load offset=32 (local.get $plan)))
      (block $done (loop $nodes
        (br_if $done (i32.eqz (local.get $p)))
        (local.set $next (i32.load (local.get $p)))
        (call $heap_free (call $w2g (local.get $p)))
        (local.set $p (local.get $next)) (br $nodes)))))
    (call $heap_free (call $w2g (local.get $plan))))

  (func $gl_copy_context (param $source i32) (param $target i32) (param $mask i32) (result i32)
    (local $a i32) (local $b i32) (local $as i32) (local $bs i32)
    (local $am i32) (local $bm i32) (local $ar i32) (local $br i32)
    (local $at i32) (local $bt i32) (local $plan i32) (local $stack i32)
    (local $i i32) (local $j i32) (local $obj i32) (local $dst i32)
    (local $name i32) (local $bits i32) (local $flags i32) (local $error i32)
    (local.set $a (call $gl_share_context_find (local.get $source)))
    (local.set $b (call $gl_share_context_find (local.get $target)))
    (if (i32.or (i32.eqz (local.get $a)) (i32.eqz (local.get $b))) (then
      (global.set $last_error (i32.const 6)) (return (i32.const 0))))
    (if (i32.and (local.get $mask) (i32.const 0xfff00000)) (then
      (global.set $last_error (i32.const 87)) (return (i32.const 0))))
    ;; The host checks live identities, implementation/format, and EVERY owner.
    ;; Phase zero is validation only, before allocations or destination writes.
    (local.set $stack (call $gl_list_alloc (i32.const 32)))
    (if (i32.eqz (local.get $stack)) (then (global.set $last_error (i32.const 8)) (return (i32.const 0))))
    (i32.store offset=4 (local.get $stack) (local.get $source))
    (i32.store offset=8 (local.get $stack) (local.get $target))
    (i32.store offset=12 (local.get $stack) (local.get $mask))
    (drop (call $gl_emit_record (i32.const 0x10006) (local.get $stack) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (local.set $error (call $gl_wat_stream_flush))
    (if (local.get $error) (then
      (call $heap_free (call $w2g (local.get $stack)))
      (global.set $last_error (local.get $error)) (return (i32.const 0))))
    (if (i32.eqz (local.get $mask)) (then
      (call $heap_free (call $w2g (local.get $stack))) (return (i32.const 1))))
    (local.set $as (call $gl_copy_state (local.get $source)))
    (if (i32.load offset=196 (local.get $as))
      (then (local.set $as (i32.add (local.get $as) (i32.const 196)))))
    (local.set $bs (call $gl_copy_state (local.get $target)))
    (local.set $am (call $gl_mtx_slot (local.get $source) (i32.const 1)))
    (local.set $bm (call $gl_mtx_slot (local.get $target) (i32.const 1)))
    (local.set $ar (call $gl_copy_raster (local.get $a)))
    (local.set $br (call $gl_copy_raster (local.get $b)))
    (local.set $at (call $gl_texture_block_for (local.get $a)))
    (local.set $bt (call $gl_texture_block_for (local.get $b)))
    (if (i32.and (local.get $mask) (i32.or (i32.const 0x10000) (i32.const 0x2000))) (then
      (drop (call $gl_eval_state (local.get $a))) (drop (call $gl_eval_state (local.get $b)))))
    ;; Plan contains four resolved destination bindings and staged new objects.
    ;; No source object pointer is installed in a destination namespace.
    (local.set $plan (call $gl_list_alloc (i32.const 36)))
    (if (i32.eqz (local.get $plan)) (then
      (call $heap_free (call $w2g (local.get $stack)))
      (global.set $last_error (i32.const 8)) (return (i32.const 0))))
    (if (i32.and (local.get $mask) (i32.const 0x40000)) (then
      (block $prepared (loop $prepare
        (local.set $obj (i32.load (i32.add (local.get $at) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2))))))
        (local.set $name (i32.load offset=4 (local.get $obj)))
        (local.set $dst (if (result i32) (local.get $name)
          (then (call $gl_texture_find (local.get $bt) (local.get $name)))
          (else (i32.add (local.get $bt) (select (i32.const 136) (i32.const 80) (i32.and (local.get $i) (i32.const 1)))))))
        ;; Repeated names resolve to the same prepared destination object.
        (local.set $j (i32.const 0))
        (block $seen (loop $previous
          (br_if $seen (i32.ge_u (local.get $j) (local.get $i)))
          (if (i32.eq (local.get $obj) (i32.load (i32.add (local.get $plan) (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 2))))))
            (then (local.set $dst (i32.load (i32.add (local.get $plan) (i32.shl (local.get $j) (i32.const 2))))) (br $seen)))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $previous)))
        (if (local.get $dst) (then
          (if (i32.ne (i32.load offset=8 (local.get $obj)) (i32.load offset=8 (local.get $dst)))
            (then (local.set $error (i32.const 87)))))
          (else
            (local.set $dst (call $gl_list_alloc (i32.const 56)))
            (if (i32.eqz (local.get $dst)) (then (local.set $error (i32.const 8)) (br $prepared)))
            (i32.store (local.get $dst) (i32.load offset=32 (local.get $plan)))
            (i32.store offset=32 (local.get $plan) (local.get $dst))
            (call $gl_texture_object_init (local.get $dst) (i32.load offset=8 (local.get $obj)))
            (i32.store offset=4 (local.get $dst) (local.get $name))))
        (i32.store (i32.add (local.get $plan) (i32.shl (local.get $i) (i32.const 2))) (local.get $dst))
        (i32.store (i32.add (local.get $plan) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2)))) (local.get $obj))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $prepare (i32.lt_u (local.get $i) (i32.const 4)))))))
    (if (local.get $error) (then
      (call $gl_copy_plan_free (local.get $plan) (i32.const 1)) (call $heap_free (call $w2g (local.get $stack)))
      (global.set $last_error (local.get $error)) (return (i32.const 0))))
    ;; Prepare host values including canonical CURRENT that packing absorbed.
    (i32.store offset=16 (local.get $stack) (call $w2g (i32.add (local.get $as) (i32.const 4))))
    (drop (call $gl_emit_record (i32.const 0x10006) (local.get $stack) (i32.const 1)
      (call $w2g (i32.add (local.get $as) (i32.const 4))) (i32.const 16) (i32.const 0)))
    (local.set $error (call $gl_wat_stream_flush))
    (if (local.get $error) (then
      (call $gl_copy_plan_free (local.get $plan) (i32.const 1)) (call $heap_free (call $w2g (local.get $stack)))
      (global.set $last_error (local.get $error)) (return (i32.const 0))))
    ;; Commit: all validation/allocation is complete. No bind/query/device call.
    (call $gl_eval_copy (local.get $a) (local.get $b) (local.get $mask))
    (local.set $dst (i32.load offset=32 (local.get $plan)))
    (if (local.get $dst) (then
      (local.set $obj (local.get $dst))
      (block $tail (loop $next
        (br_if $tail (i32.eqz (i32.load (local.get $obj))))
        (local.set $obj (i32.load (local.get $obj))) (br $next)))
      (i32.store (local.get $obj) (i32.load offset=8 (i32.load offset=308 (local.get $bt))))
      (i32.store offset=8 (i32.load offset=308 (local.get $bt)) (local.get $dst))))

    (call $gl_copy_values (local.get $mask) (local.get $as) (local.get $bs)
      (local.get $am) (local.get $bm) (local.get $a) (local.get $b)
      (local.get $ar) (local.get $br) (local.get $at) (local.get $bt))
    (if (i32.and (local.get $mask) (i32.const 270336)) (then (call $gl_copy_bits (i32.add (local.get $a) (i32.const 108)) (i32.add (local.get $b) (i32.const 108)) (i32.const 3))))
    (if (i32.and (local.get $mask) (i32.const 8320)) (then (call $gl_copy_bits (i32.add (local.get $a) (i32.const 108)) (i32.add (local.get $b) (i32.const 108)) (i32.const 4))))
    (if (i32.and (local.get $mask) (i32.const 8256)) (then (call $gl_copy_bits (i32.add (local.get $a) (i32.const 108)) (i32.add (local.get $b) (i32.const 108)) (i32.const 8))))
    (if (i32.and (local.get $mask) (i32.const 270336)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 1966081))))
    (if (i32.and (local.get $mask) (i32.const 24576)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 234881030))))
    (if (i32.and (local.get $mask) (i32.const 8448)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 8))))
    (if (i32.and (local.get $mask) (i32.const 8200)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 16))))
    (if (i32.and (local.get $mask) (i32.const 532480)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 32))))
    (if (i32.and (local.get $mask) (i32.const 8320)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 64))))
    (if (i32.and (local.get $mask) (i32.const 8256)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 130944))))
    (if (i32.and (local.get $mask) (i32.const 12288)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 4194304))))
    (if (i32.and (local.get $mask) (i32.const 8196)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 8388608))))
    (if (i32.and (local.get $mask) (i32.const 8200)) (then (call $gl_copy_bits (local.get $ar) (local.get $br) (i32.const 16777216))))
    (if (i32.and (local.get $mask) (i32.const 8256)) (then (call $gl_copy_bits (i32.add (local.get $am) (i32.const 9036)) (i32.add (local.get $bm) (i32.const 9036)) (i32.const 130944))))
    (if (i32.and (local.get $mask) (i32.const 8320)) (then (call $gl_copy_bits (i32.add (local.get $am) (i32.const 9036)) (i32.add (local.get $bm) (i32.const 9036)) (i32.const 64))))
    (if (i32.and (local.get $mask) (i32.const 12288)) (then (call $gl_copy_bits (i32.add (local.get $am) (i32.const 9036)) (i32.add (local.get $bm) (i32.const 9036)) (i32.const 4194304))))
    (if (i32.and (local.get $mask) (i32.const 0x40000)) (then
      (local.set $i (i32.const 0))
      (loop $install
        (local.set $dst (i32.load (i32.add (local.get $plan) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $obj (i32.load (i32.add (local.get $plan) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2))))))
        (memory.copy (i32.add (local.get $dst) (i32.const 12)) (i32.add (local.get $obj) (i32.const 12)) (i32.const 36))
        (i32.store (i32.add (local.get $bt) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2)))) (local.get $dst))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $install (i32.lt_u (local.get $i) (i32.const 4))))))
    (drop (call $gl_emit_record (i32.const 0x10007) (local.get $stack) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (drop (call $gl_wat_stream_flush))
    (call $gl_copy_plan_free (local.get $plan) (i32.const 0))
    (call $heap_free (call $w2g (local.get $stack)))
    (i32.const 1))
