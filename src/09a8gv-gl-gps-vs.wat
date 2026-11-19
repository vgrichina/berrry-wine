  ;; ---- GL fixed-function T&L as a vertex shader (GL GPS, slice G4) -------
  ;; With the GL GPS producer on (09a8gt), a whole glBegin/glEnd or vertex
  ;; array triangle draw goes to the executor as raw GL vertices plus a
  ;; generated vs_2_0 core-IR vertex shader instead of CPU-transformed,
  ;; clipped, culled screen triangles. $gl_sw_draw (09a8g) offers each draw
  ;; to $glv_draw before its triangle loop; 1 means the executor has it and
  ;; the loop is skipped, 0 means the CPU path runs exactly as before (and
  ;; may still reach the executor pretransformed through $glg_prim).
  ;;
  ;; What the executor then does that the CPU did: modelview/projection and
  ;; the viewport (VIEWPORT, depth range as zmin/zmax), the six-plane clip,
  ;; face culling (RASTER cull, mapped from glFrontFace/glCullFace onto the
  ;; executor's screen winding), polygon offset (RASTER z_bias/slope_bias),
  ;; unit 0/1 texture matrices and Q, GL fog (linear/exp/exp2 from the eye
  ;; distance, as the CPU's per-vertex factor in COLOR1.a), and mip selection
  ;; (09a8gt's mip-chain cache, $glg_t0_chain: the whole chain as one TEX2D
  ;; and the GL min/mag/mip filters in the sampler, per pixel -- the same
  ;; texture $glg_prim binds for a pretransformed draw).
  ;;
  ;; Precision matches the CPU path where it quantizes: the vertex colour and
  ;; the fog factor are rounded to k/255 in the shader as the CPU's D3DCOLOR
  ;; packing does, and positions sit half a pixel up-left (D3D's integer
  ;; pixel centres = GL's fragment centres) through the folded c0..c3.
  ;;
  ;; Anything else is a counted decline to the CPU path (gl_gps_stat 96 + r,
  ;; table in 09a8gt's header): lighting, sphere map, user clip planes,
  ;; selection/feedback, flat shading, non-fill polygon modes, lines and
  ;; points, 1D textures, a vertex w other than 1, viewports past the target.
  ;; Stats: 80 VS draws, 81 their triangles, 82 their vertices, 84 VS builds,
  ;; 86 vertices the CPU transformed while the producer was on (every vertex
  ;; of a draw this file did not take). Mip chains count in 09a8gt's 72-76.
  ;;
  ;; Constants (CONSTS stage 0, c0..c14, re-sent only when changed):
  ;;   c0..c3  rows of projection x modelview, x/y moved half a pixel and z
  ;;           mapped to D3D's 0..w:  r0 - r3/vw,  r1 + r3/vh,  (r2 + r3)/2
  ;;           ((r3 - r2)/2 under a reversed glDepthRange)
  ;;   c4, c5  modelview rows 2, 3 (eye z, eye w: the fog distance)
  ;;   c6      fog: linear (-1/(end-start), end/(end-start)), z = -density
  ;;           * log2(e) (exp), w = density (exp2)
  ;;   c7      (-log2(e), 1/255, 0, 0)
  ;;   c8..c10 unit 0 texture matrix rows 0, 1, 3; c11..c13 unit 1's
  ;;   c14     (0, 1, 255, 0.5)
  ;; Inputs, one layout per used set, stride 76 (the packed GL vertex as
  ;; 09a8c wrote it, copied whole): POSITION FLOAT3 @0, COLOR FLOAT4 @12,
  ;; TEXCOORD0 FLOAT2 @28 (s, t), TEXCOORD1 FLOAT2 @48 (s1, t1), TEXCOORD3
  ;; FLOAT2 @60 (r, q), TEXCOORD4 FLOAT2 @68 (r1, q1).
  ;;
  ;; Block $glv_mem: +0 VS cache 32 x {key, id}, +256 layout ids by input
  ;; set and stride (32 words), +384 VIEWPORT cache (24 bytes), +416
  ;; implicit DCLs (16 words), +512 constants being built (240), +768 the last sent,
  ;; +1024 IR buffer (32 + 64 x 128).
  (global $GLV_MEM_SIZE i32 (i32.const 9280))
  (global $glv_mem (mut i32) (i32.const 0))
  ;; 1 while c0..c14 at +768 are what the executor holds; 09a8gt $glg_bind
  ;; clears it with its own constant cache.
  (global $glv_c_ok (mut i32) (i32.const 0))
  ;; 1 while the executor holds this file's VIEWPORT; 09a8gt $glg_targets
  ;; clears it (TARGETS resets the executor's), $glg_flush restores the
  ;; whole target before a pretransformed batch.
  (global $glv_vp_on (mut i32) (i32.const 0))
  ;; The open batch, when it is 09a8gv's: consecutive draws whose state
  ;; emitted no record share one DRAW_UP. It rides 09a8gt's batch protocol
  ;; ($glg_b_n, $glg_b_pos; every record and arena allocation flushes it
  ;; first) with its own shader pair and layout; $glg_flush hands it to
  ;; $glv_flush. $glg_b_ps stays 0 meanwhile, so $glg_prim never appends
  ;; pretransformed vertices to it.
  (global $glv_b_vs (mut i32) (i32.const 0))
  (global $glv_b_ps (mut i32) (i32.const 0))
  (global $glv_b_layout (mut i32) (i32.const 0))
  (global $glv_b_cap (mut i32) (i32.const 0))
  (global $glv_b_stride (mut i32) (i32.const 76))
  ;; This draw's packed vertex stride: 76, or 112 for a record that also
  ;; carries the exact source colour (09a8c 0x10002; the float colour at
  ;; +12 is the same value, which the VS rounds to the same 8 bits).
  (global $glv_stride (mut i32) (i32.const 76))
  (global $GLV_BATCH i32 (i32.const 1536))
  ;; gl_gps_vs_enable(0) keeps every draw on the CPU path (A/B arms, the
  ;; focused test's control): on by default.
  (global $glv_on (mut i32) (i32.const 1))
  (func (export "gl_gps_vs_enable") (param $on i32)
    (global.set $glv_on (i32.ne (local.get $on) (i32.const 0))))

  (func $glv_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $glv_mem)) (then
      (local.set $g (call $gps_alloc (global.get $GLV_MEM_SIZE)))
      (if (i32.eqz (local.get $g)) (then (call $glg_fail (i32.const 2))))
      (global.set $glv_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $glv_mem) (i32.const 0) (global.get $GLV_MEM_SIZE))))
    (global.get $glv_mem))

  ;; A pretransformed batch is next: the whole target is its viewport.
  (func $glv_vp_reset
    (local $p i32)
    (if (i32.eqz (global.get $glv_vp_on)) (then (return)))
    (global.set $glv_vp_on (i32.const 0))
    (local.set $p (call $glg_begin (global.get $GPS_OP_VIEWPORT) (size-of GpsViewport)))
    (store.field GpsViewport x (local.get $p) (i32.const 0))
    (store.field GpsViewport y (local.get $p) (i32.const 0))
    (store.field GpsViewport w (local.get $p) (global.get $glg_w))
    (store.field GpsViewport h (local.get $p) (global.get $glg_hh))
    (store.field GpsViewport zmin (local.get $p) (f32.const 0))
    (store.field GpsViewport zmax (local.get $p) (f32.const 1))
    (drop (call $glg_end (local.get $p))))

  ;; From $glg_flush: the open VS batch's $n vertices as one DRAW_UP.
  (func $glv_flush (param $n i32)
    (local $p i32) (local $vs i32)
    (local.set $vs (global.get $glv_b_vs))
    (global.set $glv_b_vs (i32.const 0))
    (local.set $p (call $glg_begin (global.get $GPS_OP_DRAW_UP) (size-of GpsDraw)))
    (store.field GpsDraw prim (local.get $p) (global.get $GPS_PRIM_TRIANGLELIST))
    (store.field GpsDraw index_size (local.get $p) (i32.const 0))
    (store.field GpsDraw pad2 (local.get $p) (i32.const 0))
    (store.field GpsDraw vs (local.get $p) (local.get $vs))
    (store.field GpsDraw ps (local.get $p) (global.get $glv_b_ps))
    (store.field GpsDraw layout (local.get $p) (global.get $glv_b_layout))
    (store.field GpsDraw vbuf (local.get $p) (i32.const 0))
    (store.field GpsDraw voff (local.get $p) (global.get $glg_b_pos))
    (store.field GpsDraw stride (local.get $p) (global.get $glv_b_stride))
    (store.field GpsDraw ibuf (local.get $p) (i32.const 0))
    (store.field GpsDraw ioff (local.get $p) (i32.const 0))
    (store.field GpsDraw count (local.get $p) (local.get $n))
    (store.field GpsDraw vcount (local.get $p) (local.get $n))
    (drop (call $glg_end (local.get $p)))
    (call $glg_stat (i32.const 0) (i32.const 1)))

  (func $glv_decline (param $why i32) (param $n i32) (result i32)
    (call $glg_stat (i32.add (i32.const 96) (local.get $why)) (i32.const 1))
    (call $glg_stat (i32.const 86) (local.get $n))
    (i32.const 0))

  ;; ---- vertex shader -------------------------------------------------------
  ;; One instruction; operand count from the opcode.
  (func $glv_i (param $n i32) (param $op i32) (param $d i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    (call $gps_ir_ins (i32.add (global.get $glv_mem) (i32.const 1024)) (local.get $n) (local.get $op)
      (if (result i32) (i32.or (i32.eq (local.get $op) (i32.const 4)) (i32.eq (local.get $op) (i32.const 18)))
        (then (i32.const 4))
        (else (if (result i32) (i32.or (i32.or (i32.eq (local.get $op) (i32.const 1)) (i32.eq (local.get $op) (i32.const 6)))
                (i32.or (i32.or (i32.eq (local.get $op) (i32.const 14)) (i32.eq (local.get $op) (i32.const 19)))
                  (i32.eq (local.get $op) (i32.const 35))))
          (then (i32.const 2)) (else (i32.const 3)))))
      (local.get $d) (local.get $a) (local.get $b) (local.get $c)))

  ;; Unit $unit's texture coordinates: input $st (s, t), $rq (r, q),
  ;; matrix rows at c$m, output oT$unit. $mode 0 (s, t), 1 (s, t, q),
  ;; 2 the matrix over (s, t, r, q) -> (s', t', q').
  (func $glv_tc (param $n i32) (param $unit i32) (param $st i32) (param $rq i32) (param $m i32) (param $mode i32) (result i32)
    (local $o i32)
    (local.set $o (i32.or (i32.const 0xE0000000) (local.get $unit)))
    (if (i32.eq (local.get $mode) (i32.const 2)) (then
      (local.set $n (call $glv_i (local.get $n) (i32.const 1) (i32.const 0x80030001)
        (i32.or (i32.const 0x90E40000) (local.get $st)) (i32.const 0) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 1) (i32.const 0x800C0001)
        (i32.or (i32.const 0x90440000) (local.get $rq)) (i32.const 0) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.or (local.get $o) (i32.const 0x10000))
        (i32.const 0x80E40001) (i32.or (i32.const 0xA0E40000) (local.get $m)) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.or (local.get $o) (i32.const 0x20000))
        (i32.const 0x80E40001) (i32.or (i32.const 0xA0E40000) (i32.add (local.get $m) (i32.const 1))) (i32.const 0)))
      (return (call $glv_i (local.get $n) (i32.const 9) (i32.or (local.get $o) (i32.const 0x40000))
        (i32.const 0x80E40001) (i32.or (i32.const 0xA0E40000) (i32.add (local.get $m) (i32.const 2))) (i32.const 0)))))
    (local.set $n (call $glv_i (local.get $n) (i32.const 1) (i32.or (local.get $o) (i32.const 0x30000))
      (i32.or (i32.const 0x90E40000) (local.get $st)) (i32.const 0) (i32.const 0)))
    (if (local.get $mode) (then
      (local.set $n (call $glv_i (local.get $n) (i32.const 1) (i32.or (local.get $o) (i32.const 0x40000))
        (i32.or (i32.const 0x90550000) (local.get $rq)) (i32.const 0) (i32.const 0)))))
    (local.get $n))

  ;; Round temp $r's masked lanes to k/255 (the CPU path's u8 packing):
  ;; clamp to [0, 1], x*255 + 0.5, minus its fraction, / 255 into $dst.
  (func $glv_q8 (param $n i32) (param $r i32) (param $mask i32) (param $src i32) (param $dst i32) (result i32)
    (local $d i32) (local $s i32) (local $sh i32)
    (local.set $sh (i32.shl (local.get $mask) (i32.const 16)))
    (local.set $d (i32.or (i32.or (i32.const 0x80000000) (local.get $sh)) (local.get $r)))
    (local.set $s (i32.or (i32.const 0x80E40000) (local.get $r)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 11) (local.get $d) (local.get $src) (i32.const 0xA000000E) (i32.const 0)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 10) (local.get $d) (local.get $s) (i32.const 0xA055000E) (i32.const 0)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 4) (local.get $d) (local.get $s) (i32.const 0xA0AA000E) (i32.const 0xA0FF000E)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 19) (i32.or (i32.const 0x80000004) (local.get $sh)) (local.get $s) (i32.const 0) (i32.const 0)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 2) (local.get $d) (local.get $s) (i32.const 0x81E40004) (i32.const 0)))
    ;; One lane: replicate it, so any destination lane reads the result.
    (call $glv_i (local.get $n) (i32.const 5) (local.get $dst)
      (select (local.get $s) (i32.or (i32.const 0x80000000) (local.get $r)) (i32.eq (local.get $mask) (i32.const 15)))
      (i32.const 0xA0550007) (i32.const 0)))

  ;; Key: bit0 unit 0 textured, bit1 unit 1, bits 2-3 unit 0 mode, 4-5
  ;; unit 1 mode ($glv_tc), bits 6-7 fog (1 linear, 2 exp, 3 exp2).
  (func $glv_vs (param $key i32) (result i32)
    (local $i i32) (local $e i32) (local $id i32) (local $p i32) (local $n i32)
    (local $core i32) (local $bytes i32) (local $m i32) (local $fog i32) (local $imp i32)
    (local.set $m (call $glv_m))
    (local.set $key (i32.or (local.get $key) (i32.const 0x80000000)))
    (loop $scan
      (local.set $e (i32.add (local.get $m) (i32.shl (local.get $i) (i32.const 3))))
      (if (i32.eq (i32.load (local.get $e)) (local.get $key)) (then (return (i32.load offset=4 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    ;; Position.
    (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.const 0xC0010000) (i32.const 0x90E40000) (i32.const 0xA0E40000) (i32.const 0)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.const 0xC0020000) (i32.const 0x90E40000) (i32.const 0xA0E40001) (i32.const 0)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.const 0xC0040000) (i32.const 0x90E40000) (i32.const 0xA0E40002) (i32.const 0)))
    (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.const 0xC0080000) (i32.const 0x90E40000) (i32.const 0xA0E40003) (i32.const 0)))
    ;; Colour, rounded to 8 bits.
    (local.set $n (call $glv_q8 (local.get $n) (i32.const 3) (i32.const 15) (i32.const 0x90E40001) (i32.const 0xD00F0000)))
    (if (i32.and (local.get $key) (i32.const 1)) (then
      (local.set $n (call $glv_tc (local.get $n) (i32.const 0) (i32.const 2) (i32.const 5) (i32.const 8)
        (i32.and (i32.shr_u (local.get $key) (i32.const 2)) (i32.const 3))))))
    (if (i32.and (local.get $key) (i32.const 2)) (then
      (local.set $n (call $glv_tc (local.get $n) (i32.const 1) (i32.const 3) (i32.const 6) (i32.const 11)
        (i32.and (i32.shr_u (local.get $key) (i32.const 4)) (i32.const 3))))))
    (local.set $fog (i32.and (i32.shr_u (local.get $key) (i32.const 6)) (i32.const 3)))
    (if (local.get $fog) (then
      ;; d = |(MV row 2 . v) / (MV row 3 . v)|
      (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.const 0x80010002) (i32.const 0x90E40000) (i32.const 0xA0E40004) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 9) (i32.const 0x80020002) (i32.const 0x90E40000) (i32.const 0xA0E40005) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 6) (i32.const 0x80020002) (i32.const 0x80550002) (i32.const 0) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 5) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0x80550002) (i32.const 0)))
      (local.set $n (call $glv_i (local.get $n) (i32.const 35) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0) (i32.const 0)))
      (if (i32.eq (local.get $fog) (i32.const 1))
        (then (local.set $n (call $glv_i (local.get $n) (i32.const 4) (i32.const 0x80010002) (i32.const 0x80000002)
          (i32.const 0xA0000006) (i32.const 0xA0550006))))
        (else
          (if (i32.eq (local.get $fog) (i32.const 2))
            (then (local.set $n (call $glv_i (local.get $n) (i32.const 5) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0xA0AA0006) (i32.const 0))))
            (else
              (local.set $n (call $glv_i (local.get $n) (i32.const 5) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0xA0FF0006) (i32.const 0)))
              (local.set $n (call $glv_i (local.get $n) (i32.const 5) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0x80000002) (i32.const 0)))
              (local.set $n (call $glv_i (local.get $n) (i32.const 5) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0xA0000007) (i32.const 0)))))
          (local.set $n (call $glv_i (local.get $n) (i32.const 14) (i32.const 0x80010002) (i32.const 0x80000002) (i32.const 0) (i32.const 0)))))
      (local.set $n (call $glv_i (local.get $n) (i32.const 1) (i32.const 0xD00F0001) (i32.const 0xA000000E) (i32.const 0) (i32.const 0)))
      (local.set $n (call $glv_q8 (local.get $n) (i32.const 2) (i32.const 1) (i32.const 0x80000002) (i32.const 0xD0080001)))))
    (drop (call $gps_ir_finish (i32.add (local.get $m) (i32.const 1024)) (local.get $n) (global.get $GPS_STAGE_VS) (i32.const 0xfffe0200)))
    ;; The inputs this shader reads, as implicit DCLs (09af1).
    (local.set $imp (i32.add (local.get $m) (i32.const 416)))
    (memory.fill (local.get $imp) (i32.const 0) (i32.const 64))
    (i32.store (local.get $imp) (i32.const 0x80000000))
    (i32.store offset=4 (local.get $imp) (i32.const 0x8000000a))
    (if (i32.and (local.get $key) (i32.const 1)) (then
      (i32.store offset=8 (local.get $imp) (i32.const 0x80000005))
      (if (i32.and (local.get $key) (i32.const 12))
        (then (i32.store offset=20 (local.get $imp) (i32.const 0x80030005))))))
    (if (i32.and (local.get $key) (i32.const 2)) (then
      (i32.store offset=12 (local.get $imp) (i32.const 0x80010005))
      (if (i32.and (local.get $key) (i32.const 48))
        (then (i32.store offset=24 (local.get $imp) (i32.const 0x80040005))))))
    (global.set $vc_implicit_dcl (local.get $imp))
    (local.set $core (call $d3d_shader_ir_canonicalize (i32.add (local.get $m) (i32.const 1024))))
    (global.set $vc_implicit_dcl (i32.const 0))
    (if (i32.eqz (local.get $core)) (then (return (i32.const 0))))
    (local.set $bytes (i32.load offset=24 (local.get $core)))
    (local.set $id (call $glg_id))
    (local.set $p (call $glg_begin (global.get $GPS_OP_SHADER) (i32.add (size-of GpsShader) (local.get $bytes))))
    (store.field GpsShader id (local.get $p) (local.get $id))
    (store.field GpsShader stage (local.get $p) (global.get $GPS_STAGE_VS))
    (store.field GpsShader pad (local.get $p) (i32.const 0))
    (store.field GpsShader pad2 (local.get $p) (i32.const 0))
    (store.field GpsShader ir_bytes (local.get $p) (local.get $bytes))
    (memory.copy (i32.add (local.get $p) (size-of GpsShader)) (local.get $core) (local.get $bytes))
    (call $d3d_shader_ir_free (local.get $core))
    (drop (call $glg_end (local.get $p)))
    (call $glg_stat (i32.const 84) (i32.const 1))
    ;; 32 live shaders cover the key space a GL app reaches; the slot is the
    ;; id's low bits, releasing what was there.
    (local.set $e (i32.add (local.get $m) (i32.shl (i32.and (local.get $id) (i32.const 31)) (i32.const 3))))
    (if (i32.load offset=4 (local.get $e)) (then (call $glg_release (i32.load offset=4 (local.get $e)))))
    (i32.store (local.get $e) (local.get $key))
    (i32.store offset=4 (local.get $e) (local.get $id))
    (local.get $id))

  ;; The LAYOUT for input set $set (bit0 TEXCOORD0, bit1 TEXCOORD1, bit2
  ;; TEXCOORD3, bit3 TEXCOORD4; bit4 stride 112), made once per run.
  (func $glv_layout (param $set i32) (result i32)
    (local $cell i32) (local $id i32) (local $p i32) (local $e i32) (local $k i32) (local $n i32)
    (local.set $cell (i32.add (i32.add (call $glv_m) (i32.const 256)) (i32.shl (local.get $set) (i32.const 2))))
    (if (i32.load (local.get $cell)) (then (return (i32.load (local.get $cell)))))
    (local.set $n (i32.add (i32.const 2) (i32.popcnt (i32.and (local.get $set) (i32.const 15)))))
    (local.set $id (call $glg_id))
    (local.set $p (call $glg_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (local.get $n) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (local.get $n))
    (store.field GpsLayout stride (local.get $p) (select (i32.const 112) (i32.const 76) (i32.and (local.get $set) (i32.const 16))))
    (local.set $e (i32.add (local.get $p) (size-of GpsLayout)))
    (call $glv_elem (local.get $e) (global.get $GPS_VTYPE_FLOAT3) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $glv_elem (i32.add (local.get $e) (size-of GpsLayoutElem)) (global.get $GPS_VTYPE_FLOAT4)
      (global.get $GPS_USAGE_COLOR) (i32.const 0) (i32.const 12))
    (local.set $e (i32.add (local.get $e) (i32.mul (i32.const 2) (size-of GpsLayoutElem))))
    (loop $each
      (if (i32.and (local.get $set) (i32.shl (i32.const 1) (local.get $k))) (then
        (call $glv_elem (local.get $e) (global.get $GPS_VTYPE_FLOAT2) (global.get $GPS_USAGE_TEXCOORD)
          (i32.add (local.get $k) (i32.ge_u (local.get $k) (i32.const 2)))
          (i32.and (i32.shr_u (i32.const 0x443c301c) (i32.shl (local.get $k) (i32.const 3))) (i32.const 255)))
        (local.set $e (i32.add (local.get $e) (size-of GpsLayoutElem)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $each (i32.lt_u (local.get $k) (i32.const 4))))
    (drop (call $glg_end (local.get $p)))
    (i32.store (local.get $cell) (local.get $id))
    (local.get $id))

  (func $glv_elem (param $e i32) (param $type i32) (param $usage i32) (param $index i32) (param $off i32)
    (store.field GpsLayoutElem slot (local.get $e) (i32.const 0))
    (store.field GpsLayoutElem type (local.get $e) (local.get $type))
    (store.field GpsLayoutElem usage (local.get $e) (local.get $usage))
    (store.field GpsLayoutElem index (local.get $e) (local.get $index))
    (store.field GpsLayoutElem offset (local.get $e) (local.get $off))
    (store.field GpsLayoutElem pad (local.get $e) (i32.const 0)))

  ;; ---- constants -------------------------------------------------------------
  ;; c$i = row $row of column-major $m (scaled by $s), plus $t times its row 3.
  (func $glv_row (param $c i32) (param $m i32) (param $row i32) (param $s f32) (param $t f32)
    (local $k i32) (local $a i32)
    (loop $each
      (local.set $a (i32.add (local.get $m) (i32.shl (local.get $k) (i32.const 4))))
      (f32.store (i32.add (local.get $c) (i32.shl (local.get $k) (i32.const 2)))
        (f32.mul (local.get $s) (f32.add (f32.load (i32.add (local.get $a) (i32.shl (local.get $row) (i32.const 2))))
          (f32.mul (local.get $t) (f32.load offset=12 (local.get $a))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $each (i32.lt_u (local.get $k) (i32.const 4)))))

  (func $glv_consts (param $mvp i32) (param $vw f32) (param $vh f32) (param $zflip i32)
    (local $c i32) (local $range f32) (local $p i32)
    (local.set $c (i32.add (call $glv_m) (i32.const 512)))
    (memory.fill (local.get $c) (i32.const 0) (i32.const 240))
    (call $glv_row (local.get $c) (local.get $mvp) (i32.const 0) (f32.const 1) (f32.div (f32.const -1) (local.get $vw)))
    (call $glv_row (i32.add (local.get $c) (i32.const 16)) (local.get $mvp) (i32.const 1) (f32.const 1) (f32.div (f32.const 1) (local.get $vh)))
    (call $glv_row (i32.add (local.get $c) (i32.const 32)) (local.get $mvp) (i32.const 2)
      (select (f32.const -0.5) (f32.const 0.5) (local.get $zflip)) (select (f32.const -1) (f32.const 1) (local.get $zflip)))
    (call $glv_row (i32.add (local.get $c) (i32.const 48)) (local.get $mvp) (i32.const 3) (f32.const 1) (f32.const 0))
    (if (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 64)) (then
      (call $glv_row (i32.add (local.get $c) (i32.const 64)) (global.get $gl_sw_mv) (i32.const 2) (f32.const 1) (f32.const 0))
      (call $glv_row (i32.add (local.get $c) (i32.const 80)) (global.get $gl_sw_mv) (i32.const 3) (f32.const 1) (f32.const 0))
      (local.set $range (f32.sub (global.get $gl_sw_fog_end) (global.get $gl_sw_fog_start)))
      (if (f32.eq (local.get $range) (f32.const 0))
        (then (f32.store offset=100 (local.get $c) (f32.const 1)))
        (else
          (f32.store offset=96 (local.get $c) (f32.div (f32.const -1) (local.get $range)))
          (f32.store offset=100 (local.get $c) (f32.div (global.get $gl_sw_fog_end) (local.get $range)))))
      (f32.store offset=104 (local.get $c) (f32.mul (global.get $gl_sw_fog_density) (f32.const -1.4426950408889634)))
      (f32.store offset=108 (local.get $c) (global.get $gl_sw_fog_density))))
    (f32.store offset=112 (local.get $c) (f32.const -1.4426950408889634))
    (f32.store offset=116 (local.get $c) (f32.div (f32.const 1) (f32.const 255)))
    (if (global.get $gl_sw_texmtx) (then
      (call $glv_row (i32.add (local.get $c) (i32.const 128)) (global.get $gl_sw_texmtx) (i32.const 0) (f32.const 1) (f32.const 0))
      (call $glv_row (i32.add (local.get $c) (i32.const 144)) (global.get $gl_sw_texmtx) (i32.const 1) (f32.const 1) (f32.const 0))
      (call $glv_row (i32.add (local.get $c) (i32.const 160)) (global.get $gl_sw_texmtx) (i32.const 3) (f32.const 1) (f32.const 0))))
    (if (global.get $gl_sw_texmtx1) (then
      (call $glv_row (i32.add (local.get $c) (i32.const 176)) (global.get $gl_sw_texmtx1) (i32.const 0) (f32.const 1) (f32.const 0))
      (call $glv_row (i32.add (local.get $c) (i32.const 192)) (global.get $gl_sw_texmtx1) (i32.const 1) (f32.const 1) (f32.const 0))
      (call $glv_row (i32.add (local.get $c) (i32.const 208)) (global.get $gl_sw_texmtx1) (i32.const 3) (f32.const 1) (f32.const 0))))
    (f32.store offset=228 (local.get $c) (f32.const 1))
    (f32.store offset=232 (local.get $c) (f32.const 255))
    (f32.store offset=236 (local.get $c) (f32.const 0.5))
    (if (i32.and (i32.ne (global.get $glv_c_ok) (i32.const 0))
          (call $d3g_row_eq (local.get $c) (i32.add (local.get $c) (i32.const 256)) (i32.const 240)))
      (then (return)))
    (memory.copy (i32.add (local.get $c) (i32.const 256)) (local.get $c) (i32.const 240))
    (global.set $glv_c_ok (i32.const 1))
    (local.set $p (call $glg_begin (global.get $GPS_OP_CONSTS) (i32.add (size-of GpsConsts) (i32.const 240))))
    (store.field GpsConsts stage (local.get $p) (global.get $GPS_STAGE_VS))
    (store.field GpsConsts pad (local.get $p) (i32.const 0))
    (store.field GpsConsts first (local.get $p) (i32.const 0))
    (store.field GpsConsts count (local.get $p) (i32.const 15))
    (memory.copy (i32.add (local.get $p) (size-of GpsConsts)) (local.get $c) (i32.const 240))
    (drop (call $glg_end (local.get $p))))

  (func $glv_viewport (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $zmin f32) (param $zmax f32)
    (local $v i32) (local $p i32)
    (local.set $v (i32.add (call $glv_m) (i32.const 384)))
    (if (i32.and (i32.ne (global.get $glv_vp_on) (i32.const 0))
          (i32.and (i32.and (i32.eq (i32.load (local.get $v)) (local.get $x)) (i32.eq (i32.load offset=4 (local.get $v)) (local.get $y)))
            (i32.and (i32.and (i32.eq (i32.load offset=8 (local.get $v)) (local.get $w)) (i32.eq (i32.load offset=12 (local.get $v)) (local.get $h)))
              (i32.and (f32.eq (f32.load offset=16 (local.get $v)) (local.get $zmin)) (f32.eq (f32.load offset=20 (local.get $v)) (local.get $zmax))))))
      (then (return)))
    (local.set $p (call $glg_begin (global.get $GPS_OP_VIEWPORT) (size-of GpsViewport)))
    (store.field GpsViewport x (local.get $p) (local.get $x))
    (store.field GpsViewport y (local.get $p) (local.get $y))
    (store.field GpsViewport w (local.get $p) (local.get $w))
    (store.field GpsViewport h (local.get $p) (local.get $h))
    (store.field GpsViewport zmin (local.get $p) (local.get $zmin))
    (store.field GpsViewport zmax (local.get $p) (local.get $zmax))
    (drop (call $glg_end (local.get $p)))
    (i32.store (local.get $v) (local.get $x))
    (i32.store offset=4 (local.get $v) (local.get $y))
    (i32.store offset=8 (local.get $v) (local.get $w))
    (i32.store offset=12 (local.get $v) (local.get $h))
    (f32.store offset=16 (local.get $v) (local.get $zmin))
    (f32.store offset=20 (local.get $v) (local.get $zmax))
    (global.set $glv_vp_on (i32.const 1)))

  ;; ---- the draw ----------------------------------------------------------------
  ;; From $gl_sw_draw with its per-draw state set: packed record $start,
  ;; $vertices vertices in steps of $step, $mvp = projection x modelview,
  ;; $vp the GL viewport (x, y, w, h). 1: the executor draws it.
  (func $glv_draw (param $start i32) (param $vertices i32) (param $step i32) (param $mvp i32) (param $vp i32) (result i32)
    (if (i32.eqz (global.get $glg_on)) (then (return (i32.const 0))))
    (if (global.get $gl_sw_in_worker) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $glv_on)) (then
      (call $glg_stat (i32.const 86) (local.get $vertices))
      (return (i32.const 0))))
    (call $glv_try (local.get $start) (local.get $vertices) (local.get $step) (local.get $mvp) (local.get $vp)))

  (func $glv_try (param $start i32) (param $vertices i32) (param $step i32) (param $mvp i32) (param $vp i32) (result i32)
    (local $st i32) (local $caps i32) (local $n i32) (local $i i32) (local $v i32) (local $w f32)
    (local $proj0 i32) (local $proj1 i32) (local $tex i32) (local $t1 i32) (local $flags i32) (local $b i32)
    (local $zn f32) (local $zf f32) (local $vx i32) (local $vy i32) (local $vw i32) (local $vh i32) (local $th i32)
    (local $cull i32) (local $front_ccw i32) (local $mode i32)
    (local $t0id i32) (local $s0 i32) (local $t1id i32) (local $s1 i32)
    (local $lin i32) (local $key i32) (local $vkey i32) (local $ps i32) (local $vs i32)
    (local $fog i32) (local $env0 i32) (local $env1 i32) (local $set i32) (local $layout i32) (local $pos i32) (local $p i32)
    (local.set $st (global.get $gl_sw_st))
    (local.set $caps (i32.load (local.get $st)))
    (local.set $n (local.get $vertices))
    (if (i32.ne (local.get $step) (i32.const 3)) (then (return (call $glv_decline (i32.const 7) (local.get $n)))))
    (local.set $n (i32.sub (local.get $vertices) (i32.rem_u (local.get $vertices) (i32.const 3))))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    (if (i32.eq (i32.load offset=4 (local.get $start)) (i32.const 0x10009)) (then (return (call $glv_decline (i32.const 7) (local.get $n)))))
    (global.set $glv_stride (global.get $gl_sw_vertex_stride))
    (if (i32.and (i32.ne (global.get $glv_stride) (i32.const 76)) (i32.ne (global.get $glv_stride) (i32.const 112)))
      (then (return (call $glv_decline (i32.const 8) (local.get $n)))))
    (if (global.get $glg_draw_reason) (then (return (call $glv_decline (i32.const 14) (local.get $n)))))
    (if (i32.eqz (call $glg_cap (global.get $GPS_CAP_VS_IR))) (then (return (call $glv_decline (i32.const 11) (local.get $n)))))
    (if (global.get $gl_sw_lit) (then (return (call $glv_decline (i32.const 1) (local.get $n)))))
    (if (global.get $gl_sw_sphere) (then (return (call $glv_decline (i32.const 2) (local.get $n)))))
    (if (global.get $gl_sw_user_mask) (then (return (call $glv_decline (i32.const 3) (local.get $n)))))
    (if (global.get $gl_sf_active) (then (return (call $glv_decline (i32.const 4) (local.get $n)))))
    ;; Polygon modes: both faces filled (a culled face's mode never shows).
    (local.set $cull (select (i32.load offset=28 (local.get $st)) (i32.const 0) (i32.ne (i32.and (local.get $caps) (i32.const 16)) (i32.const 0))))
    (if (i32.or
          (i32.and (i32.ne (local.get $cull) (i32.const 0x404)) (i32.ne (i32.load offset=4108 (local.get $st)) (i32.const 0x1b02)))
          (i32.and (i32.ne (local.get $cull) (i32.const 0x405)) (i32.ne (i32.load offset=4112 (local.get $st)) (i32.const 0x1b02))))
      (then (return (call $glv_decline (i32.const 6) (local.get $n)))))
    (if (i32.or (call $gl_1d_selected (i32.const 0)) (call $gl_1d_selected (i32.const 1)))
      (then (return (call $glv_decline (i32.const 9) (local.get $n)))))
    (if (i32.gt_u (local.get $n) (i32.const 16384)) (then (return (call $glv_decline (i32.const 15) (local.get $n)))))
    ;; Vertex w and texture Q: one pass over the raw vertices.
    (local.set $v (i32.add (local.get $start) (i32.const 32)))
    (block $scanned (loop $scan
      (br_if $scanned (i32.ge_u (local.get $i) (local.get $n)))
      (if (f32.ne (f32.load offset=56 (local.get $v)) (f32.const 1))
        (then (return (call $glv_decline (i32.const 13) (local.get $n)))))
      (local.set $proj0 (i32.or (local.get $proj0) (f32.ne (f32.load offset=64 (local.get $v)) (f32.const 1))))
      (local.set $proj1 (i32.or (local.get $proj1) (f32.ne (f32.load offset=72 (local.get $v)) (f32.const 1))))
      ;; Flat shading is Gouraud when each triangle's three colours are one
      ;; (Quake 2 leaves GL_FLAT set and draws with one glColor per polygon).
      (if (i32.and (i32.eq (global.get $gl_shade_model) (i32.const 0x1D00))
            (i32.eqz (i32.rem_u (local.get $i) (i32.const 3)))) (then
        (if (i32.or
              (i32.or (i64.ne (i64.load offset=12 (local.get $v)) (i64.load offset=12 (i32.add (local.get $v) (global.get $glv_stride))))
                      (i64.ne (i64.load offset=20 (local.get $v)) (i64.load offset=20 (i32.add (local.get $v) (global.get $glv_stride)))))
              (i32.or (i64.ne (i64.load offset=12 (local.get $v)) (i64.load offset=12 (i32.add (local.get $v) (i32.shl (global.get $glv_stride) (i32.const 1)))))
                      (i64.ne (i64.load offset=20 (local.get $v)) (i64.load offset=20 (i32.add (local.get $v) (i32.shl (global.get $glv_stride) (i32.const 1)))))))
          (then (return (call $glv_decline (i32.const 5) (local.get $n)))))))
      (local.set $v (i32.add (local.get $v) (global.get $glv_stride)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    ;; Viewport and depth range as a VIEWPORT inside the target.
    (local.set $vx (i32.load (local.get $vp)))
    (local.set $vw (i32.load offset=8 (local.get $vp)))
    (local.set $vh (i32.load offset=12 (local.get $vp)))
    (local.set $th (load.field DxObject height (global.get $gl_sw_rt)))
    (local.set $vy (i32.sub (i32.sub (local.get $th) (i32.load offset=4 (local.get $vp))) (local.get $vh)))
    (local.set $b (call $gl_mtx_block))
    (local.set $zn (f32.load offset=9024 (local.get $b)))
    (local.set $zf (f32.load offset=9028 (local.get $b)))
    (if (i32.and (f32.eq (local.get $zn) (f32.const 0)) (f32.eq (local.get $zf) (f32.const 0)))
      (then (local.set $zf (f32.const 1))))
    (if (i32.or (i32.or (i32.or (i32.lt_s (local.get $vx) (i32.const 0)) (i32.lt_s (local.get $vy) (i32.const 0)))
                        (i32.or (i32.le_s (local.get $vw) (i32.const 0)) (i32.le_s (local.get $vh) (i32.const 0))))
          (i32.or (i32.or (i32.gt_s (i32.add (local.get $vx) (local.get $vw)) (global.get $glg_w))
                          (i32.gt_s (i32.add (local.get $vy) (local.get $vh)) (global.get $glg_hh)))
            (i32.or (i32.ne (local.get $th) (global.get $glg_hh))
              (i32.eqz (i32.and (i32.and (f32.ge (local.get $zn) (f32.const 0)) (f32.le (local.get $zn) (f32.const 1)))
                (i32.and (f32.ge (local.get $zf) (f32.const 0)) (f32.le (local.get $zf) (f32.const 1))))))))
      (then (return (call $glv_decline (i32.const 10) (local.get $n)))))
    (if (i32.eqz (global.get $gl_sw_flip_y)) (then (return (call $glv_decline (i32.const 19) (local.get $n)))))
    (if (i32.eqz (call $gl_sw_raster_state)) (then (return (call $glv_decline (i32.const 18) (local.get $n)))))
    ;; Texture state, as $glg_prim checks it.
    (local.set $tex (i32.ne (global.get $gl_sw_r_tex) (global.get $gl_sw_white)))
    (local.set $flags (global.get $gl_sw_r_flags))
    (local.set $t1 (call $gl_sw_t1_bind))
    (if (local.get $t1) (then
      (if (i32.or (i32.ne (global.get $rast_t1_op) (i32.const 0x10001))
            (i32.or (call $glg_tex_ok (global.get $rast_t1_entry))
              (call $glg_border_bad (global.get $rast_t1_addr_u) (global.get $rast_t1_addr_v) (i32.ne (global.get $rast_t1_linear) (i32.const 0)))))
        (then (return (call $glv_decline (i32.const 12) (local.get $n)))))))
    ;; Addressing and the border check see the magnification filter, as
    ;; $glg_prim's do.
    (local.set $lin (i32.and (local.get $flags) (i32.const 1)))
    (if (local.get $tex) (then
      (if (i32.or (i32.eqz (global.get $gl_texture_draw))
            (i32.or (call $glg_tex_ok (global.get $gl_sw_r_tex))
              (call $glg_border_bad (call $gl_sw_flags_address (local.get $flags) (i32.const 2))
                (call $gl_sw_flags_address (local.get $flags) (i32.const 4)) (local.get $lin))))
        (then (return (call $glv_decline (i32.const 12) (local.get $n)))))))
    ;; Onto the executor.
    (if (i32.eqz (global.get $glg_gpu)) (then
      (call $glg_enter (i32.const 0))
      (if (i32.eqz (global.get $glg_gpu)) (then (return (call $glv_decline (i32.const 14) (local.get $n)))))))
    (if (global.get $glg_front_draw) (then (call $glg_front_current)))
    ;; RASTER with culling and polygon offset. GL decides the face on its
    ;; y-up window, the executor on the y-down target: CCW there is CW here.
    (local.set $front_ccw (i32.ne (i32.load offset=32 (local.get $st)) (i32.const 0)))
    (global.set $glg_r_cull (i32.const 1))
    (if (i32.eq (local.get $cull) (i32.const 0x405)) (then (global.set $glg_r_cull (select (i32.const 2) (i32.const 3) (local.get $front_ccw)))))
    (if (i32.eq (local.get $cull) (i32.const 0x404)) (then (global.set $glg_r_cull (select (i32.const 3) (i32.const 2) (local.get $front_ccw)))))
    (if (i32.eq (local.get $cull) (i32.const 0x408)) (then
      (global.set $glg_r_cull (i32.const 1))
      (call $glg_stat (i32.const 80) (i32.const 1))
      (return (i32.const 1))))
    (if (i32.and (i32.load offset=4132 (local.get $st)) (i32.const 1)) (then
      (global.set $glg_r_slope (f32.load offset=4124 (local.get $st)))
      (global.set $glg_r_zbias (f32.div (f32.load offset=4128 (local.get $st)) (f32.const 65535)))))
    (call $glg_raster)
    (global.set $glg_r_cull (i32.const 1))
    (global.set $glg_r_zbias (f32.const 0))
    (global.set $glg_r_slope (f32.const 0))
    (global.set $glg_need_raster (i32.const 1))
    ;; Unit 0: the GL texture whole, from 09a8gt's mip-chain cache (one
    ;; TEX2D with every level, min/mag/mip filters in its sampler) -- the
    ;; same texture and sampler $glg_prim binds. 0 means only the per-level
    ;; path (one level per triangle, chosen on the CPU) draws it: decline.
    (if (local.get $tex) (then
      (local.set $t0id (call $glg_t0_chain))
      (if (i32.eqz (local.get $t0id)) (then (return (call $glv_decline (i32.const 20) (local.get $n)))))
      (local.set $s0 (global.get $glg_t0_smp))
      (local.set $key (i32.or (i32.const 1) (i32.or (i32.shl (call $glg_mode (i32.const 0)) (i32.const 1))
        (i32.shl (call $glg_base (i32.const 0)) (i32.const 3)))))
      (local.set $vkey (i32.const 1))
      (if (global.get $gl_sw_texmtx)
        (then (local.set $vkey (i32.or (local.get $vkey) (i32.const 8))))
        (else (if (local.get $proj0) (then (local.set $vkey (i32.or (local.get $vkey) (i32.const 4)))))))
      (if (i32.and (local.get $vkey) (i32.const 12)) (then (local.set $key (i32.or (local.get $key) (i32.const 0x2000)))))
      (local.set $key (i32.or (local.get $key) (i32.shl (call $glg_clamp_mask (i32.const 0)) (i32.const 16))))
      (local.set $env0 (call $glg_env (i32.const 0)))))
    (if (local.get $t1) (then
      (local.set $lin (i32.ne (global.get $rast_t1_linear) (i32.const 0)))
      (global.set $glg_keep_tex (local.get $t0id))
      (global.set $glg_keep_smp (local.get $s0))
      (local.set $t1id (call $glg_tex (global.get $rast_t1_entry)))
      (local.set $s1 (call $glg_sampler
        (call $glg_addr (global.get $rast_t1_addr_u) (local.get $lin))
        (call $glg_addr (global.get $rast_t1_addr_v) (local.get $lin))
        (local.get $lin) (global.get $rast_t1_border)))
      (global.set $glg_keep_tex (i32.const 0))
      (global.set $glg_keep_smp (i32.const 0))
      (local.set $key (i32.or (local.get $key) (i32.or (i32.const 64) (i32.or (i32.shl (call $glg_mode (i32.const 1)) (i32.const 7))
        (i32.shl (call $glg_base (i32.const 1)) (i32.const 9))))))
      (local.set $vkey (i32.or (local.get $vkey) (i32.const 2)))
      (if (global.get $gl_sw_texmtx1)
        (then (local.set $vkey (i32.or (local.get $vkey) (i32.const 32))))
        (else (if (local.get $proj1) (then (local.set $vkey (i32.or (local.get $vkey) (i32.const 16)))))))
      (if (i32.and (local.get $vkey) (i32.const 48)) (then (local.set $key (i32.or (local.get $key) (i32.const 0x4000)))))
      (local.set $key (i32.or (local.get $key) (i32.shl (call $glg_clamp_mask (i32.const 1)) (i32.const 18))))
      (local.set $env1 (call $glg_env (i32.const 1)))))
    (if (i32.and (local.get $caps) (i32.const 64)) (then
      (local.set $key (i32.or (local.get $key) (i32.const 0x1000)))
      (local.set $fog (global.get $gl_sw_fog_color))
      (local.set $mode (global.get $gl_sw_fog_mode))
      (local.set $vkey (i32.or (local.get $vkey)
        (if (result i32) (i32.eq (local.get $mode) (i32.const 0x2601)) (then (i32.const 64))
          (else (if (result i32) (i32.eq (local.get $mode) (i32.const 0x0801)) (then (i32.const 192)) (else (i32.const 128)))))))))
    (local.set $ps (call $glg_shader (local.get $key)))
    (if (i32.eqz (local.get $ps)) (then (return (call $glv_decline (i32.const 17) (local.get $n)))))
    (local.set $vs (call $glv_vs (local.get $vkey)))
    (if (i32.eqz (local.get $vs)) (then (return (call $glv_decline (i32.const 16) (local.get $n)))))
    (local.set $set (i32.or
      (i32.or (i32.and (local.get $vkey) (i32.const 1)) (i32.and (local.get $vkey) (i32.const 2)))
      (i32.or (i32.shl (i32.ne (i32.and (local.get $vkey) (i32.const 12)) (i32.const 0)) (i32.const 2))
              (i32.shl (i32.ne (i32.and (local.get $vkey) (i32.const 48)) (i32.const 0)) (i32.const 3)))))
    (if (i32.eq (global.get $glv_stride) (i32.const 112)) (then (local.set $set (i32.or (local.get $set) (i32.const 16)))))
    (local.set $layout (call $glv_layout (local.get $set)))
    (call $glg_targets)
    (call $glg_bind_rec (local.get $t0id) (local.get $s0) (local.get $t1id) (local.get $s1))
    (call $glg_consts (local.get $fog) (local.get $env0) (local.get $env1))
    ;; A reversed depth range (Half-Life's glDepthRange(1, 0) z-trick) is
    ;; the ordered VIEWPORT range with the shader's z reversed: ndc -1 lands
    ;; on zmax = near, and the 0..w clip is still GL's -w..w.
    (call $glv_viewport (local.get $vx) (local.get $vy) (local.get $vw) (local.get $vh)
      (f32.min (local.get $zn) (local.get $zf)) (f32.max (local.get $zn) (local.get $zf)))
    (call $glv_consts (local.get $mvp) (f32.convert_i32_s (local.get $vw)) (f32.convert_i32_s (local.get $vh))
      (f32.gt (local.get $zn) (local.get $zf)))
    ;; The vertices, as they are: onto the open VS batch when nothing since
    ;; its last draw emitted a record (state unchanged) and it has room,
    ;; else into a new one.
    (if (i32.eqz (i32.and (i32.and (i32.ne (global.get $glg_b_n) (i32.const 0))
            (i32.eq (global.get $glv_b_vs) (local.get $vs)))
          (i32.and (i32.and (i32.eq (global.get $glv_b_ps) (local.get $ps)) (i32.eq (global.get $glv_b_layout) (local.get $layout)))
            (i32.le_u (i32.add (global.get $glg_b_n) (local.get $n)) (global.get $glv_b_cap)))))
      (then
        (if (global.get $glg_b_n) (then (call $glg_flush)))
        (global.set $glv_b_cap (select (local.get $n) (global.get $GLV_BATCH) (i32.gt_u (local.get $n) (global.get $GLV_BATCH))))
        (global.set $glv_b_stride (global.get $glv_stride))
        (global.set $glg_b_pos (call $glg_arena (i32.mul (global.get $glv_b_cap) (global.get $glv_stride))))
        (global.set $glv_b_vs (local.get $vs))
        (global.set $glv_b_ps (local.get $ps))
        (global.set $glv_b_layout (local.get $layout))))
    (memory.copy (i32.add (call $glg_aptr (global.get $glg_b_pos)) (i32.mul (global.get $glg_b_n) (global.get $glv_stride)))
      (i32.add (local.get $start) (i32.const 32)) (i32.mul (local.get $n) (global.get $glv_stride)))
    (global.set $glg_b_n (i32.add (global.get $glg_b_n) (local.get $n)))
    (call $glg_stat (i32.const 80) (i32.const 1))
    (call $glg_stat (i32.const 81) (i32.div_u (local.get $n) (i32.const 3)))
    (call $glg_stat (i32.const 82) (local.get $n))
    (if (i32.eqz (global.get $glg_front_draw)) (then (global.set $glg_back_gpu (i32.const 1))))
    (if (global.get $rast_stencil_state) (then
      (if (call $glg_stencil_writes (global.get $rast_stencil_state)) (then (global.set $glg_s_gpu (i32.const 1))))))
    (if (i32.and (i32.and (i32.ne (i32.and (local.get $caps) (i32.const 8)) (i32.const 0))
          (i32.ne (global.get $gl_sw_zbuf) (i32.const 0)))
          (i32.ne (i32.load offset=24 (local.get $st)) (i32.const 0)))
      (then (global.set $glg_z_gpu (i32.const 1))))
    ;; This BIND/CONSTS/VIEWPORT is not the open batch's: the next
    ;; pretransformed draw re-emits its own.
    (global.set $glg_b_ps (i32.const 0))
    (i32.const 1))
