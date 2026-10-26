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
    (local.set $words (call $gl_arg_words (local.get $op)))
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
    (local.set $needed (i32.shl (i32.add (global.get $gl_immediate_floats) (i32.const 19)) (i32.const 2)))
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
    (global.set $gl_immediate_floats (i32.add (global.get $gl_immediate_floats) (i32.const 19))))

  (func $gl_copy_vertex (param $dst i32) (param $index i32) (param $color_index i32)
    (local $src i32) (local $csrc i32) (local $i i32) (local $from i32)
    ;; Both source vertices belong to the same verified affine allocation.
    (local.set $src (i32.add (global.get $gl_immediate_wa)
      (i32.mul (local.get $index) (i32.const 76))))
    (local.set $csrc (i32.add (global.get $gl_immediate_wa)
      (i32.add (i32.mul (local.get $color_index) (i32.const 76)) (i32.const 12))))
    (loop $words
      (local.set $from (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2))))
      (if (i32.and (i32.ge_s (local.get $color_index) (i32.const 0))
          (i32.and (i32.ge_u (local.get $i) (i32.const 3)) (i32.lt_u (local.get $i) (i32.const 7))))
        (then (local.set $from (i32.add (local.get $csrc)
          (i32.shl (i32.sub (local.get $i) (i32.const 3)) (i32.const 2))))))
      (i32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
        (i32.load (local.get $from)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $words (i32.lt_u (local.get $i) (i32.const 19)))))

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
    (i32.store offset=8 (local.get $start) (local.get $mode))
    (i32.store offset=12 (local.get $start) (i32.const 0))
    (i32.store offset=16 (local.get $start) (i32.const 0))
    (i32.store offset=20 (local.get $start) (i32.const 0))
    (i32.store offset=24 (local.get $start) (i32.add (global.get $gl_stream_used_bytes) (i32.const 32)))
    (i32.store offset=28 (local.get $start) (i32.const 1))
    (local.get $start))

  (func $gl_packed_finish (param $start i32) (param $vertices i32)
    (local $bytes i32)
    (if (i32.eqz (local.get $vertices)) (then (return)))
    (local.set $bytes (i32.mul (local.get $vertices) (i32.const 76)))
    (i32.store (local.get $start) (i32.add (local.get $bytes) (i32.const 32)))
    (i32.store offset=20 (local.get $start) (local.get $bytes))
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
    (local $count i32) (local $mode i32) (local $out_mode i32)
    (local $i i32) (local $start i32) (local $n i32) (local $need i32) (local $q i32)
    (local $flat i32) (local $prov i32) (local $a i32) (local $b i32) (local $c i32)
    (local $out_count i32) (local $group i32) (local $max_chunk i32) (local $first_chunk i32)
    (local.set $count (i32.div_u (global.get $gl_immediate_floats) (i32.const 19)))
    (local.set $mode (global.get $gl_immediate_mode))
    (global.set $gl_immediate_mode (i32.const -1))
    (global.set $gl_immediate_floats (i32.const 0))
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
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
      (i32.div_u (i32.div_u (i32.sub (i32.const 0x00200000) (i32.const 32)) (i32.const 76))
        (local.get $group)) (local.get $group)))
    (local.set $first_chunk (select (local.get $out_count) (local.get $max_chunk)
      (i32.lt_u (local.get $out_count) (local.get $max_chunk))))
    (if (i32.gt_u (i32.add (global.get $gl_stream_used_bytes)
          (i32.add (i32.const 32) (i32.mul (local.get $first_chunk) (i32.const 76))))
        (i32.const 0x00200000)) (then (drop (call $gl_wat_stream_flush))))
    (local.set $start (call $gl_packed_begin (local.get $out_mode)))

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

        (if (i32.gt_u (i32.add (i32.add (global.get $gl_stream_used_bytes) (i32.const 32))
              (i32.mul (i32.add (local.get $n) (local.get $need)) (i32.const 76)))
            (i32.const 0x00200000)) (then
          (call $gl_packed_finish (local.get $start) (local.get $n))
          (drop (call $gl_wat_stream_flush))
          (local.set $start (call $gl_packed_begin (local.get $out_mode)))
          (local.set $n (i32.const 0))))
        (call $gl_copy_vertex (i32.add (local.get $start)
          (i32.add (i32.const 32) (i32.mul (local.get $n) (i32.const 76)))) (local.get $a) (local.get $prov))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (if (i32.gt_u (local.get $need) (i32.const 1)) (then
          (call $gl_copy_vertex (i32.add (local.get $start)
            (i32.add (i32.const 32) (i32.mul (local.get $n) (i32.const 76)))) (local.get $b) (local.get $prov))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
        (if (i32.gt_u (local.get $need) (i32.const 2)) (then
          (call $gl_copy_vertex (i32.add (local.get $start)
            (i32.add (i32.const 32) (i32.mul (local.get $n) (i32.const 76)))) (local.get $c) (local.get $prov))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
        (br $emit)))
    (call $gl_packed_finish (local.get $start) (local.get $n))
    (i32.const 1))

  ;; Validate enums before touching a vector pointer. Invalid enum calls still
  ;; reach the host for GL error reporting but carry no pointed payload.
  (func $gl_tex_parameter_bytes (param $stack i32) (result i32)
    (local $pname i32)
    (if (i32.ne (i32.load offset=4 (local.get $stack)) (i32.const 0x0DE1))
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
    (local.set $arg (i32.const -1))
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
    (if (i32.eq (local.get $op) (i32.const 67)) (then (local.set $arg (i32.const 2)) (local.set $len (i32.const 16))))
    (if (i32.eq (local.get $op) (i32.const 68)) (then (local.set $arg (i32.const 2))
      (local.set $len (select (i32.const 4) (i32.const 16) (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x1601))))))
    (if (i32.eq (local.get $op) (i32.const 69)) (then (local.set $arg (i32.const 1)) (local.set $len (i32.const 16))))
    (if (i32.eq (local.get $op) (i32.const 78)) (then (local.set $arg (i32.const 1))
      (local.set $len (select (i32.const 16) (i32.const 4) (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0B66))))))
    (if (i32.eq (local.get $op) (i32.const 83)) (then (local.set $arg (i32.const 2))
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

  (func $gl_wat_encode_call (param $op i32) (param $stack i32) (param $aux i32) (result i32)
    (local $spec i64) (local $ptr i32) (local $len i32) (local $borrow i32) (local $result i32)
    (if (call $gl_list_intercept (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_stencil_intercept (local.get $op) (local.get $stack))
      (then (return (global.get $gl_list_result))))
    (if (call $gl_color_mask_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (if (call $gl_bitmap_intercept (local.get $op) (local.get $stack))
      (then (return (i32.const 0))))
    (global.set $gl_wat_stat_calls (i64.add (global.get $gl_wat_stat_calls) (i64.const 1)))
    (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
    ;; Shadow the fixed-function transform/lighting state into WAT. This only
    ;; observes -- the call goes on to the stream unchanged, so nothing about
    ;; what gets drawn moves. It runs BEFORE $gl_state_intercept because that
    ;; function absorbs some of the calls the mirror has to see: 76 and 77
    ;; (glPushAttrib/glPopAttrib) return 1 from it and would otherwise never
    ;; reach the observer, leaving the mirror silently stale instead of
    ;; marked untrusted. See src/09a8f-gl-matrix.wat.
    (call $gl_mtx_observe (local.get $op) (local.get $stack))
    ;; glClear/glClearColor for the WAT software target; inert when it is off.
    (call $gl_sw_observe (local.get $op) (local.get $stack))
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
      (global.set $gl_immediate_floats (i32.const 0)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 22)) (then
      (drop (call $gl_finish_immediate)) (return (i32.const 0))))
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
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then (unreachable)))
    (local.set $spec (call $gl_pointer_length (local.get $op) (local.get $stack)))
    (local.set $ptr (i32.wrap_i64 (local.get $spec)))
    (local.set $len (i32.and
      (i32.wrap_i64 (i64.shr_u (local.get $spec) (i64.const 32))) (i32.const 0x7FFFFFFF)))
    (local.set $borrow (i32.wrap_i64 (i64.shr_u (local.get $spec) (i64.const 63))))
    (if (i32.and (i32.ne (local.get $len) (i32.const 0))
        (i32.gt_u (i32.add (i32.add (i32.const 36)
          (i32.shl (call $gl_arg_words (local.get $op)) (i32.const 2))) (local.get $len))
          (i32.const 0x00200000)))
      (then (local.set $borrow (i32.const 1))))
    (if (i32.eqz (call $gl_emit_record (local.get $op) (local.get $stack) (local.get $aux)
      (local.get $ptr) (local.get $len) (local.get $borrow))) (then (unreachable)))
    (if (i32.or (i32.ne (local.get $borrow) (i32.const 0))
        (call $gl_is_barrier (local.get $op)))
      (then (local.set $result (call $gl_wat_stream_flush))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 51)) (i32.ne (local.get $result) (i32.const 0)))
      (then
        (call $gl_state_context_changed (i32.load offset=8 (local.get $stack)))
        ;; wglMakeCurrent(hdc, NULL) releases the context and its DC alike.
        (global.set $gl_current_dc
          (if (result i32) (i32.load offset=8 (local.get $stack))
            (then (i32.load offset=4 (local.get $stack)))
            (else (i32.const 0))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 49)) (i32.ne (local.get $result) (i32.const 0)))
      (then
        (call $gl_list_context_deleted (i32.load offset=4 (local.get $stack)))
        (call $gl_state_context_deleted (i32.load offset=4 (local.get $stack)))))
    (local.get $result))

  (func $gl_wat_encoder_reset
    (call $gl_list_reset)
    (drop (call $gl_wat_stream_flush))
    (global.set $gl_stream_used_bytes (i32.const 0))
    (global.set $gl_stream_command_count (i32.const 0))
    (global.set $gl_immediate_floats (i32.const 0))
    (global.set $gl_immediate_mode (i32.const -1))
    (call $gl_state_reset)
    (global.set $gl_current_context (i32.const 0))
    (global.set $gl_current_dc (i32.const 0)))
