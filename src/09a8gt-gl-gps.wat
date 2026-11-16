  ;; ---- Software GL on GPU stream v2 (slice G3a) ---------------------------
  ;; With gl_gps_enable(1) (run.js --gl-gps) the software-GL pipeline of
  ;; 09a8g keeps doing everything up to the screen records -- transform,
  ;; lighting, clipping, culling, mip choice, the scissor box -- and hands
  ;; each triangle or line/point span to this file instead of to the shared
  ;; span rasterizer. They go out as pretransformed DRAW_UP batches; texenv
  ;; combine (GL1.1 tables 3.10/3.11, aware of the base internal format) is
  ;; a ps_1_4 shader; RASTER carries depth/blend/alpha test/scissor; Swap is
  ;; PRESENT. The DIBs stop being the picture: they are read back only when
  ;; the CPU must touch them (glReadPixels and every read_surface lease, a
  ;; capture, GDI over the window via the window's GPU-owned flag, or a draw
  ;; this file declines).
  ;;
  ;; Frames. A frame is GPU (draws on the ring) or SW (the old rasterizer
  ;; into the DIBs). Something the executor cannot draw is a counted decline
  ;; ($glg_decline, gl_gps_stat 16 + reason); in a GPU frame it reads the
  ;; back buffer back and finishes the frame in software. The next frame is
  ;; GPU again only if this one had no declines (SW frames classify their
  ;; primitives too, without emitting). A SW frame's front is uploaded and
  ;; PRESENTed, so the picture always comes from the executor.
  ;;
  ;; Depth. The executor's DS can be neither uploaded nor read back, so the
  ;; two depth buffers are kept equal instead: every glClear(DEPTH) is done
  ;; on both, and a SW->GPU switch waits for one when software has written
  ;; depth since (reason 16). After a GPU->SW switch the CPU depth is stale;
  ;; a software draw that then depth-tests fails loudly ($glg_fail 20).
  ;;
  ;; Decline reasons (gl_gps_stat 16 + r) and the executor growth each needs:
  ;;   1 logic op               CAP_LOGIC_OP in the software executor
  ;;   2 partial colour mask    per-channel RASTER colormask
  ;;   3 polygon stipple        fragment position + a stipple mask texture
  ;;   4 stencil test           none in the executor (D24S8 + RASTER stencil
  ;;                            exist); WAT must keep the stencil on the GPU
  ;;   5 front buffer draw      none (WAT: draw to the front RT)
  ;;   6 both buffers           none (WAT: draw twice)
  ;;   7 bitmap drawable        none (WAT: RT over the bitmap, read back)
  ;;   8 foreign DIB target     none (as 7)
  ;;   9 1D texture unit 0      none (WAT: Wx1 TEX2D, S plane from 1d_planes)
  ;;  10 border texels          border texel ring around the image
  ;;  11 unit 1 on a line/point none (WAT: per-span S1/T1 from the line planes)
  ;;  12 projective line/point  none (WAT: pass Q in TEXCOORD0.z)
  ;;  13 glBitmap/DrawPixels    none (WAT: textured quads)
  ;;  14 stencil DrawPixels     as 4
  ;;  15 glAccum                accumulation RT + blend ops
  ;;  16 depth not in sync      DS UPLOAD (counted once per frame, no fallback)
  ;;  17 bottom-up target       none (WAT: flip y)
  ;;  18 texture over 2048      none
  ;;  19 no executor            -
  ;;  20 depth lost (fatal)     DS READBACK
  ;;  21 1D texture unit 1      as 9
  ;;  22 non-32bpp texture      none
  ;;  23 blend factor > 13      none
  ;;  24 target grew past the executor's device size   resizable device
  ;;  25 env without a texture_draw descriptor         none
  ;; Readback sites (gl_gps_stat 48 + s): 0 read_surface (glReadPixels),
  ;; 1 capture, 2 decline, 3 drawable switch, 4 framebuffer -> texture or
  ;; CopyPixels (COPY RT->TEX2D would remove it), 5 front for a CPU draw.
  ;; Stats 0 DRAW_UPs, 1 triangles, 2 span quads, 3 clears, 4 presents,
  ;; 5 readbacks, 6 readback rows, 7 RT uploads, 8 RT upload rows, 9 texture
  ;; uploads, 10 GPU frames, 11 SW frames, 12 syncs, 13 texture hits,
  ;; 14 declines, 15 frames with a decline.
  ;;
  ;; Block $glg_mem: +0 stats (128 words), +512 RASTER stage, +608 its
  ;; cache, +1024 shader cache 64 x {key, id}, +1536 sampler cache
  ;; 32 x {key, border, id, -}, +2048 IR buffer, +4096 texture cache
  ;; 1024 x {wa, id, w, h, valid, -, -, -} hashed by texel address.

  (global $GLG_MEM_SIZE i32 (i32.const 36864))
  (global $GLG_BATCH i32 (i32.const 3072))
  (global $glg_on (mut i32) (i32.const 0))
  (global $glg_dead (mut i32) (i32.const 0))
  (global $glg_h (mut i32) (i32.const 0))
  (global $glg_mem (mut i32) (i32.const 0))
  (global $glg_kick_wp (mut i32) (i32.const 0))
  (global $glg_kick_ah (mut i32) (i32.const 0))
  (global $glg_next_id (mut i32) (i32.const 0))
  (global $glg_layout (mut i32) (i32.const 0))
  (global $glg_dev_w (mut i32) (i32.const 0))
  (global $glg_dev_h (mut i32) (i32.const 0))
  ;; Bound drawable: DIB entries and their executor ids.
  (global $glg_back_e (mut i32) (i32.const 0))
  (global $glg_front_e (mut i32) (i32.const 0))
  (global $glg_zbuf_e (mut i32) (i32.const 0))
  (global $glg_back_id (mut i32) (i32.const 0))
  (global $glg_front_id (mut i32) (i32.const 0))
  (global $glg_ds_id (mut i32) (i32.const 0))
  (global $glg_w (mut i32) (i32.const 0))
  (global $glg_hh (mut i32) (i32.const 0))
  ;; Frame state.
  (global $glg_gpu (mut i32) (i32.const 0))
  (global $glg_armed (mut i32) (i32.const 1))
  (global $glg_declined (mut i32) (i32.const 0))
  (global $glg_zwait (mut i32) (i32.const 0))
  (global $glg_frame (mut i32) (i32.const 0))
  (global $glg_presented (mut i32) (i32.const 0))
  (global $glg_pseq0 (mut i32) (i32.const 0))
  (global $glg_pseq1 (mut i32) (i32.const 0))
  ;; Which copy is newer: back_gpu (RT ahead of the DIB), back_cpu (DIB
  ;; ahead), front_gpu, z_gpu / z_cpu, zlost (CPU depth stale for good until
  ;; the next full depth clear), zfresh (the CPU depth surface was just made
  ;; and holds the clear value).
  (global $glg_back_gpu (mut i32) (i32.const 0))
  (global $glg_back_cpu (mut i32) (i32.const 0))
  (global $glg_front_gpu (mut i32) (i32.const 0))
  (global $glg_z_gpu (mut i32) (i32.const 0))
  (global $glg_z_cpu (mut i32) (i32.const 0))
  (global $glg_zlost (mut i32) (i32.const 0))
  (global $glg_zfresh (mut i32) (i32.const 0))
  ;; The open DRAW_UP batch and the state it was opened under.
  (global $glg_b_pos (mut i32) (i32.const 0))
  (global $glg_b_n (mut i32) (i32.const 0))
  (global $glg_b_ps (mut i32) (i32.const 0))
  (global $glg_b_t0 (mut i32) (i32.const 0))
  (global $glg_b_s0 (mut i32) (i32.const 0))
  (global $glg_b_t1 (mut i32) (i32.const 0))
  (global $glg_b_s1 (mut i32) (i32.const 0))
  (global $glg_b_fog (mut i32) (i32.const 0))
  (global $glg_b_env0 (mut i32) (i32.const 0))
  (global $glg_b_env1 (mut i32) (i32.const 0))
  ;; Emitted-state caches.
  (global $glg_c_color (mut i32) (i32.const -1))
  (global $glg_c_depth (mut i32) (i32.const -1))
  (global $glg_c_bind (mut i32) (i32.const 0))
  (global $glg_c_t0 (mut i32) (i32.const 0))
  (global $glg_c_s0 (mut i32) (i32.const 0))
  (global $glg_c_t1 (mut i32) (i32.const 0))
  (global $glg_c_s1 (mut i32) (i32.const 0))
  (global $glg_c_consts (mut i32) (i32.const 0))
  (global $glg_c_fog (mut i32) (i32.const 0))
  (global $glg_c_env0 (mut i32) (i32.const 0))
  (global $glg_c_env1 (mut i32) (i32.const 0))
  (global $glg_c_raster (mut i32) (i32.const 0))
  (global $glg_last_key (mut i32) (i32.const 0))
  (global $glg_last_ps (mut i32) (i32.const 0))
  ;; Per draw.
  (global $glg_draw_reason (mut i32) (i32.const 0))
  (global $glg_need_raster (mut i32) (i32.const 0))
  (global $glg_read_site (mut i32) (i32.const 0))
  (global $glg_q1_bad (mut i32) (i32.const 0))

  (func $glg_fail (param $code i32)
    (call $host_log_i32 (i32.const 0x474c4750))
    (call $host_log_i32 (local.get $code))
    (unreachable))

  (func $glg_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $glg_mem)) (then
      (local.set $g (call $gps_alloc (global.get $GLG_MEM_SIZE)))
      (if (i32.eqz (local.get $g)) (then (call $glg_fail (i32.const 2))))
      (global.set $glg_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $glg_mem) (i32.const 0) (global.get $GLG_MEM_SIZE))))
    (global.get $glg_mem))

  (func $glg_stat (param $i i32) (param $n i32)
    (local $a i32)
    (local.set $a (i32.add (call $glg_m) (i32.shl (local.get $i) (i32.const 2))))
    (i32.store (local.get $a) (i32.add (i32.load (local.get $a)) (local.get $n))))

  (func (export "gl_gps_enable") (param $on i32)
    (global.set $glg_on (i32.ne (local.get $on) (i32.const 0))))
  (func (export "gl_gps_stat") (param $i i32) (result i32)
    (if (i32.or (i32.eqz (global.get $glg_mem)) (i32.ge_u (local.get $i) (i32.const 128)))
      (then (return (i32.const 0))))
    (i32.load (i32.add (global.get $glg_mem) (i32.shl (local.get $i) (i32.const 2)))))
  (func (export "gl_gps_active") (result i32)
    (i32.and (i32.ne (global.get $glg_on) (i32.const 0)) (i32.eqz (global.get $glg_dead))))

  ;; ---- ring plumbing ---------------------------------------------------------
  (func $glg_kick (param $mode i32) (result i32)
    (global.set $glg_kick_wp (load.field.memarg GpsRing write_pos (global.get $glg_h)))
    (global.set $glg_kick_ah (load.field.memarg GpsRing arena_head (global.get $glg_h)))
    (call $gps_kick (global.get $glg_h) (local.get $mode)))

  ;; Every record and every arena allocation first closes the open batch:
  ;; the batch's arena chunk is then always the newest allocation, and no
  ;; record can overtake the draws queued before it.
  (func $glg_begin (param $op i32) (param $n i32) (result i32)
    (local $h i32)
    (if (global.get $glg_b_n) (then (call $glg_flush)))
    (local.set $h (global.get $glg_h))
    (if (i32.or
          (i32.ge_u (i32.sub (load.field.memarg GpsRing write_pos (local.get $h)) (global.get $glg_kick_wp))
            (i32.const 0x40000))
          (i32.ge_u (i32.sub (load.field.memarg GpsRing arena_head (local.get $h)) (global.get $glg_kick_ah))
            (i32.const 0x200000)))
      (then (drop (call $glg_kick (global.get $GPS_KICK_ASYNC)))))
    (call $gps_begin (local.get $h) (local.get $op) (local.get $n)))

  (func $glg_end (param $p i32) (result i32)
    (call $gps_end (global.get $glg_h) (local.get $p) (i32.const 0)))

  (func $glg_id (result i32)
    (global.set $glg_next_id (i32.add (global.get $glg_next_id) (i32.const 1)))
    (global.get $glg_next_id))

  (func $glg_arena (param $n i32) (result i32)
    (if (global.get $glg_b_n) (then (call $glg_flush)))
    (call $gps_arena_alloc (global.get $glg_h) (local.get $n)))

  (func $glg_aptr (param $pos i32) (result i32)
    (call $gps_arena_ptr (global.get $glg_h) (local.get $pos)))

  (func $glg_release (param $id i32)
    (if (i32.eqz (local.get $id)) (then (return)))
    (if (global.get $glg_b_n) (then (call $glg_flush)))
    (call $gps_release (global.get $glg_h) (local.get $id)))

  (func $glg_flush
    (local $p i32) (local $n i32)
    (local.set $n (global.get $glg_b_n))
    (if (i32.eqz (local.get $n)) (then (return)))
    (global.set $glg_b_n (i32.const 0))
    (local.set $p (call $glg_begin (global.get $GPS_OP_DRAW_UP) (size-of GpsDraw)))
    (store.field GpsDraw prim (local.get $p) (global.get $GPS_PRIM_TRIANGLELIST))
    (store.field GpsDraw index_size (local.get $p) (i32.const 0))
    (store.field GpsDraw pad2 (local.get $p) (i32.const 0))
    (store.field GpsDraw vs (local.get $p) (i32.const 0))
    (store.field GpsDraw ps (local.get $p) (global.get $glg_b_ps))
    (store.field GpsDraw layout (local.get $p) (global.get $glg_layout))
    (store.field GpsDraw vbuf (local.get $p) (i32.const 0))
    (store.field GpsDraw voff (local.get $p) (global.get $glg_b_pos))
    (store.field GpsDraw stride (local.get $p) (i32.const 48))
    (store.field GpsDraw ibuf (local.get $p) (i32.const 0))
    (store.field GpsDraw ioff (local.get $p) (i32.const 0))
    (store.field GpsDraw count (local.get $p) (local.get $n))
    (store.field GpsDraw vcount (local.get $p) (local.get $n))
    (drop (call $glg_end (local.get $p)))
    (call $glg_stat (i32.const 0) (i32.const 1)))

  ;; Room for $k more vertices in the batch; their wasm address.
  (func $glg_vtx (param $k i32) (result i32)
    (local $o i32)
    (if (i32.gt_u (i32.add (global.get $glg_b_n) (local.get $k)) (global.get $GLG_BATCH))
      (then (call $glg_flush)))
    (if (i32.eqz (global.get $glg_b_n)) (then
      (global.set $glg_b_pos (call $gps_arena_alloc (global.get $glg_h) (i32.mul (global.get $GLG_BATCH) (i32.const 48))))))
    (local.set $o (i32.add (call $glg_aptr (global.get $glg_b_pos)) (i32.mul (global.get $glg_b_n) (i32.const 48))))
    (global.set $glg_b_n (i32.add (global.get $glg_b_n) (local.get $k)))
    (local.get $o))

  ;; POSITIONT xyzw @0, COLOR0 @16, COLOR1 (fog factor in alpha) @20,
  ;; TEXCOORD0 (S, T, Q) @24, TEXCOORD1 (S1, T1, Q1) @36.
  (func $glg_layout_make (result i32)
    (local $id i32) (local $p i32) (local $e i32) (local $i i32)
    (local.set $id (call $glg_id))
    (local.set $p (call $glg_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (i32.const 5) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (i32.const 5))
    (store.field GpsLayout stride (local.get $p) (i32.const 48))
    (loop $elems
      (local.set $e (i32.add (i32.add (local.get $p) (size-of GpsLayout)) (i32.mul (local.get $i) (size-of GpsLayoutElem))))
      (store.field GpsLayoutElem slot (local.get $e) (i32.const 0))
      (store.field GpsLayoutElem type (local.get $e)
        (if (result i32) (i32.eqz (local.get $i)) (then (global.get $GPS_VTYPE_FLOAT4))
          (else (if (result i32) (i32.lt_u (local.get $i) (i32.const 3)) (then (global.get $GPS_VTYPE_D3DCOLOR))
            (else (global.get $GPS_VTYPE_FLOAT3))))))
      (store.field GpsLayoutElem usage (local.get $e)
        (if (result i32) (i32.eqz (local.get $i)) (then (global.get $GPS_USAGE_POSITIONT))
          (else (if (result i32) (i32.lt_u (local.get $i) (i32.const 3)) (then (global.get $GPS_USAGE_COLOR))
            (else (global.get $GPS_USAGE_TEXCOORD))))))
      (store.field GpsLayoutElem index (local.get $e)
        (select (i32.const 1) (i32.const 0) (i32.or (i32.eq (local.get $i) (i32.const 2)) (i32.eq (local.get $i) (i32.const 4)))))
      (store.field GpsLayoutElem offset (local.get $e)
        (i32.and (i32.shr_u (i32.const 0x24181410) (i32.shl (i32.sub (local.get $i) (i32.const 1)) (i32.const 3)))
          (select (i32.const 255) (i32.const 0) (i32.ne (local.get $i) (i32.const 0)))))
      (store.field GpsLayoutElem pad (local.get $e) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $elems (i32.lt_u (local.get $i) (i32.const 5))))
    (drop (call $glg_end (local.get $p)))
    (local.get $id))

  ;; The ring, opened on first use. 0 = no executor: the arm turns itself
  ;; off for the run and every draw takes the software path.
  (func $glg_open (result i32)
    (local $h i32)
    (if (global.get $glg_h) (then (return (i32.const 1))))
    (if (global.get $glg_dead) (then (return (i32.const 0))))
    (drop (call $glg_m))
    (local.set $h (call $gps_ring_open (i32.const 3) (i32.const 0x100000) (i32.const 0x800000)))
    (if (i32.eqz (local.get $h)) (then (call $glg_fail (i32.const 3))))
    (global.set $glg_h (local.get $h))
    (global.set $glg_layout (call $glg_layout_make))
    (if (i32.ne (call $glg_kick (global.get $GPS_KICK_SYNC)) (i32.const 1)) (then
      (call $gps_ring_reset (local.get $h))
      (global.set $glg_dead (i32.const 19))
      (call $glg_stat (i32.const 35) (i32.const 1))
      (return (i32.const 0))))
    (i32.const 1))

  ;; ---- targets ---------------------------------------------------------------
  (func $glg_targets
    (local $p i32)
    (if (i32.and (i32.eq (global.get $glg_c_color) (global.get $glg_back_id))
                 (i32.eq (global.get $glg_c_depth) (global.get $glg_ds_id))) (then (return)))
    (local.set $p (call $glg_begin (global.get $GPS_OP_TARGETS) (size-of GpsTargets)))
    (store.field GpsTargets color (local.get $p) (global.get $glg_back_id))
    (store.field GpsTargets depth (local.get $p) (global.get $glg_ds_id))
    (drop (call $glg_end (local.get $p)))
    (global.set $glg_c_color (global.get $glg_back_id))
    (global.set $glg_c_depth (global.get $glg_ds_id)))

  ;; CLEAR on the bound back RT / DS. $color ARGB, $z 0..1.
  (func $glg_clear_rec (param $mask i32) (param $cm i32) (param $color i32) (param $z f32)
      (param $l i32) (param $t i32) (param $r i32) (param $b i32)
    (local $p i32)
    (call $glg_targets)
    (local.set $p (call $glg_begin (global.get $GPS_OP_CLEAR) (size-of GpsClear)))
    (store.field GpsClear mask (local.get $p) (local.get $mask))
    (store.field GpsClear colormask (local.get $p) (local.get $cm))
    (store.field GpsClear pad (local.get $p) (i32.const 0))
    (store.field GpsClear rgba (local.get $p)
      (i32.or (i32.or (i32.and (local.get $color) (i32.const 0xff00ff00))
        (i32.and (i32.shr_u (local.get $color) (i32.const 16)) (i32.const 255)))
        (i32.shl (i32.and (local.get $color) (i32.const 255)) (i32.const 16))))
    (store.field GpsClear z (local.get $p) (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $z))))
    (store.field GpsClear stencil (local.get $p) (i32.const 0))
    (store.field GpsClear left (local.get $p) (local.get $l))
    (store.field GpsClear top (local.get $p) (local.get $t))
    (store.field GpsClear right (local.get $p) (local.get $r))
    (store.field GpsClear bottom (local.get $p) (local.get $b))
    (drop (call $glg_end (local.get $p)))
    (call $glg_stat (i32.const 3) (i32.const 1)))

  (func $glg_clear_z (result f32)
    (f32.div (f32.convert_i32_u (i32.and (global.get $gl_sw_clear_depth_value) (i32.const 0xffff))) (f32.const 65535)))

  ;; Rows per 2 MB band of $w RGBA pixels.
  (func $glg_band (param $w i32) (result i32)
    (local $n i32)
    (local.set $n (i32.div_u (i32.const 0x200000) (i32.shl (local.get $w) (i32.const 2))))
    (select (local.get $n) (i32.const 1) (i32.ne (local.get $n) (i32.const 0))))

  ;; The 32bpp DIB of $entry -> RT $id (alpha kept).
  (func $glg_upload_rt (param $id i32) (param $entry i32)
    (local $w i32) (local $hgt i32) (local $pitch i32) (local $dib i32)
    (local $y i32) (local $n i32) (local $k i32) (local $pos i32) (local $dst i32) (local $p i32) (local $band i32)
    (local.set $w (load.field DxObject width (local.get $entry)))
    (local.set $hgt (load.field DxObject height (local.get $entry)))
    (local.set $pitch (load.field DxObject pitch (local.get $entry)))
    (local.set $dib (load.field DxObject misc1 (local.get $entry)))
    (local.set $band (call $glg_band (local.get $w)))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $y)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $glg_arena (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n))))
      (local.set $dst (call $glg_aptr (local.get $pos)))
      (local.set $k (i32.const 0))
      (block $rd (loop $rows
        (br_if $rd (i32.ge_u (local.get $k) (local.get $n)))
        (call $d3g_row_to_rgba
          (i32.add (local.get $dib) (i32.mul (i32.add (local.get $y) (local.get $k)) (local.get $pitch)))
          (i32.add (local.get $dst) (i32.mul (local.get $k) (i32.shl (local.get $w) (i32.const 2))))
          (local.get $w) (i32.const 5) (i32.const 32))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $rows)))
      (local.set $p (call $glg_begin (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
      (store.field GpsUpload id (local.get $p) (local.get $id))
      (store.field GpsUpload level (local.get $p) (i32.const 0))
      (store.field GpsUpload face (local.get $p) (i32.const 0))
      (store.field GpsUpload x (local.get $p) (i32.const 0))
      (store.field GpsUpload y (local.get $p) (local.get $y))
      (store.field GpsUpload w (local.get $p) (local.get $w))
      (store.field GpsUpload h (local.get $p) (local.get $n))
      (store.field GpsUpload pitch (local.get $p) (i32.shl (local.get $w) (i32.const 2)))
      (store.field GpsUpload src (local.get $p) (local.get $pos))
      (store.field GpsUpload bytes (local.get $p) (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (drop (call $glg_end (local.get $p)))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (call $glg_stat (i32.const 7) (i32.const 1))
    (call $glg_stat (i32.const 8) (local.get $hgt)))

  ;; RT $id -> the 32bpp DIB of $entry, charged to readback site $site.
  (func $glg_readback (param $id i32) (param $entry i32) (param $site i32)
    (local $w i32) (local $hgt i32) (local $pitch i32) (local $dib i32) (local $h i32)
    (local $y i32) (local $n i32) (local $k i32) (local $pos i32) (local $src i32) (local $p i32)
    (local $band i32) (local $seq i32)
    (local.set $h (global.get $glg_h))
    (local.set $w (load.field DxObject width (local.get $entry)))
    (local.set $hgt (load.field DxObject height (local.get $entry)))
    (local.set $pitch (load.field DxObject pitch (local.get $entry)))
    (local.set $dib (load.field DxObject misc1 (local.get $entry)))
    (local.set $band (call $glg_band (local.get $w)))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $y)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $glg_arena (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n))))
      (call $gps_slot_arm (local.get $h) (i32.const 0))
      (local.set $p (call $glg_begin (global.get $GPS_OP_READBACK) (size-of GpsReadback)))
      (store.field GpsReadback rt (local.get $p) (local.get $id))
      (store.field GpsReadback x (local.get $p) (i32.const 0))
      (store.field GpsReadback y (local.get $p) (local.get $y))
      (store.field GpsReadback w (local.get $p) (local.get $w))
      (store.field GpsReadback h (local.get $p) (local.get $n))
      (store.field GpsReadback fmt (local.get $p) (global.get $GPS_FMT_A8B8G8R8))
      (store.field GpsReadback dst (local.get $p) (local.get $pos))
      (store.field GpsReadback pitch (local.get $p) (i32.shl (local.get $w) (i32.const 2)))
      (store.field GpsReadback slot (local.get $p) (i32.const 0))
      (local.set $seq (call $glg_end (local.get $p)))
      (call $glg_stat (i32.const 12) (i32.const 1))
      (call $gps_slot_wait (local.get $h) (i32.const 0) (local.get $seq))
      (local.set $src (call $glg_aptr (local.get $pos)))
      (local.set $k (i32.const 0))
      (block $rd (loop $rows
        (br_if $rd (i32.ge_u (local.get $k) (local.get $n)))
        (call $d3g_rgba_to_row
          (i32.add (local.get $src) (i32.mul (local.get $k) (i32.shl (local.get $w) (i32.const 2))))
          (i32.add (local.get $dib) (i32.mul (i32.add (local.get $y) (local.get $k)) (local.get $pitch)))
          (local.get $w) (i32.const 5) (i32.const 32))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $rows)))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (call $page_watch_write (local.get $dib)
      (i32.add (i32.mul (i32.sub (local.get $hgt) (i32.const 1)) (local.get $pitch)) (i32.shl (local.get $w) (i32.const 2))))
    (call $glg_stat (i32.const 5) (i32.const 1))
    (call $glg_stat (i32.const 6) (local.get $hgt))
    (call $glg_stat (i32.add (i32.const 48) (i32.and (local.get $site) (i32.const 15))) (i32.const 1)))

  ;; Forget the executor copies (their DIBs are gone or are being replaced).
  (func $glg_unbind
    (if (i32.eqz (global.get $glg_back_e)) (then (return)))
    (call $glg_flush)
    (call $glg_release (global.get $glg_back_id))
    (call $glg_release (global.get $glg_front_id))
    (call $glg_release (global.get $glg_ds_id))
    (global.set $glg_back_id (i32.const 0))
    (global.set $glg_front_id (i32.const 0))
    (global.set $glg_ds_id (i32.const 0))
    (global.set $glg_back_e (i32.const 0))
    (global.set $glg_front_e (i32.const 0))
    (global.set $glg_zbuf_e (i32.const 0))
    (global.set $glg_c_color (i32.const -1))
    (global.set $glg_c_depth (i32.const -1))
    (global.set $glg_gpu (i32.const 0)))

  ;; The current drawable is about to change: land what the executor holds.
  (func $glg_detach
    (if (i32.eqz (global.get $glg_back_e)) (then (return)))
    (if (global.get $glg_back_gpu)
      (then (call $glg_readback (global.get $glg_back_id) (global.get $glg_back_e) (i32.const 3))))
    (if (global.get $glg_front_gpu)
      (then (call $glg_readback (global.get $glg_front_id) (global.get $glg_front_e) (i32.const 3))))
    (if (global.get $glg_z_gpu) (then (global.set $glg_zlost (i32.const 1))))
    (global.set $glg_back_gpu (i32.const 0))
    (global.set $glg_front_gpu (i32.const 0))
    (global.set $glg_z_gpu (i32.const 0))
    (call $glg_unbind))

  ;; Hooks for 09a8g: a drawable switch, a surface replacement, a fresh
  ;; depth surface.
  (func $glg_hook_detach
    (if (i32.and (i32.ne (global.get $glg_on) (i32.const 0)) (i32.ne (global.get $glg_h) (i32.const 0)))
      (then (call $glg_detach))))
  (func $glg_hook_unbind
    (if (i32.and (i32.ne (global.get $glg_on) (i32.const 0)) (i32.ne (global.get $glg_h) (i32.const 0)))
      (then (call $glg_unbind))))
  (func $glg_hook_zfresh (global.set $glg_zfresh (i32.const 1)))

  ;; Turn the arm off for the rest of the run: the DIBs become the picture.
  (func $glg_kill (param $why i32)
    (if (global.get $glg_dead) (then (return)))
    (if (global.get $glg_back_e) (then
      (call $glg_detach)))
    (global.set $glg_dead (local.get $why))
    (global.set $glg_presented (i32.const 0))
    (call $glg_stat (i32.add (i32.const 16) (local.get $why)) (i32.const 1)))

  ;; Executor copies of the current drawable; 0 when there is none to draw on.
  (func $glg_bind (result i32)
    (local $w i32) (local $hgt i32)
    (if (global.get $glg_dead) (then (return (i32.const 0))))
    (if (i32.or (i32.eqz (global.get $gl_sw_rt)) (i32.eqz (global.get $gl_sw_front))) (then (return (i32.const 0))))
    (if (i32.and (i32.eq (global.get $glg_back_e) (global.get $gl_sw_rt))
          (i32.and (i32.eq (global.get $glg_front_e) (global.get $gl_sw_front))
                   (i32.eq (global.get $glg_zbuf_e) (global.get $gl_sw_zbuf))))
      (then (return (i32.const 1))))
    (if (i32.eqz (call $glg_open)) (then (return (i32.const 0))))
    (call $glg_detach)
    (local.set $w (load.field DxObject width (global.get $gl_sw_rt)))
    (local.set $hgt (load.field DxObject height (global.get $gl_sw_rt)))
    (if (i32.or (i32.ne (load.field DxObject bpp (global.get $gl_sw_rt)) (i32.const 32))
          (i32.or (i32.ne (load.field DxObject width (global.get $gl_sw_front)) (local.get $w))
                  (i32.ne (load.field DxObject height (global.get $gl_sw_front)) (local.get $hgt))))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $glg_dev_w)) (then
      (global.set $glg_dev_w (local.get $w))
      (global.set $glg_dev_h (local.get $hgt))))
    (if (i32.or (i32.gt_u (local.get $w) (global.get $glg_dev_w)) (i32.gt_u (local.get $hgt) (global.get $glg_dev_h)))
      (then (call $glg_kill (i32.const 24)) (return (i32.const 0))))
    (global.set $glg_back_id (call $glg_id))
    (call $gps_create (global.get $glg_h) (global.get $glg_back_id) (global.get $GPS_KIND_RT)
      (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
    (global.set $glg_front_id (call $glg_id))
    (call $gps_create (global.get $glg_h) (global.get $glg_front_id) (global.get $GPS_KIND_RT)
      (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
    (global.set $glg_ds_id (call $glg_id))
    (call $gps_create (global.get $glg_h) (global.get $glg_ds_id) (global.get $GPS_KIND_DS)
      (global.get $GPS_FMT_D16) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
    (global.set $glg_back_e (global.get $gl_sw_rt))
    (global.set $glg_front_e (global.get $gl_sw_front))
    (global.set $glg_zbuf_e (global.get $gl_sw_zbuf))
    (global.set $glg_w (local.get $w))
    (global.set $glg_hh (local.get $hgt))
    ;; A depth surface made since the last bind holds the clear value, so
    ;; the executor's can be made equal to it.
    (call $glg_clear_rec (i32.const 3) (i32.const 15) (i32.const 0) (call $glg_clear_z)
      (i32.const 0) (i32.const 0) (local.get $w) (local.get $hgt))
    (global.set $glg_z_cpu (i32.eqz (global.get $glg_zfresh)))
    (global.set $glg_zfresh (i32.const 0))
    (global.set $glg_back_cpu (i32.const 1))
    (global.set $glg_back_gpu (i32.const 0))
    (global.set $glg_front_gpu (i32.const 0))
    (global.set $glg_z_gpu (i32.const 0))
    (global.set $glg_zlost (i32.const 0))
    (global.set $glg_gpu (i32.const 0))
    (global.set $glg_c_raster (i32.const 0))
    (global.set $glg_c_bind (i32.const 0))
    (global.set $glg_c_consts (i32.const 0))
    (i32.const 1))

  ;; Into a GPU frame if this one may be one. $zok: the caller is about to
  ;; clear all of depth on both sides.
  (func $glg_enter (param $zok i32)
    (if (i32.or (global.get $glg_gpu) (i32.eqz (global.get $glg_armed))) (then (return)))
    (if (i32.eqz (call $glg_bind)) (then (return)))
    (if (i32.and (i32.ne (global.get $glg_z_cpu) (i32.const 0)) (i32.eqz (local.get $zok))) (then
      (if (i32.eqz (global.get $glg_zwait)) (then
        (global.set $glg_zwait (i32.const 1))
        (call $glg_stat (i32.const 32) (i32.const 1))))
      (return)))
    ;; After a GPU->SW switch with no software depth since, the executor's
    ;; depth is the right one again.
    (if (global.get $glg_zlost) (then
      (global.set $glg_zlost (i32.const 0))
      (global.set $glg_z_gpu (i32.const 1))))
    (if (global.get $glg_back_cpu) (then
      (call $glg_upload_rt (global.get $glg_back_id) (global.get $glg_back_e))
      (global.set $glg_back_cpu (i32.const 0))))
    (global.set $glg_gpu (i32.const 1)))

  (func $glg_front_sync (param $site i32)
    (if (i32.and (i32.ne (global.get $glg_front_gpu) (i32.const 0)) (i32.ne (global.get $glg_back_e) (i32.const 0))) (then
      (call $glg_readback (global.get $glg_front_id) (global.get $glg_front_e) (local.get $site))
      (global.set $glg_front_gpu (i32.const 0)))))

  ;; GPU frame -> software for the rest of it.
  (func $glg_to_sw
    (call $glg_flush)
    (if (global.get $glg_back_gpu) (then
      (call $glg_readback (global.get $glg_back_id) (global.get $glg_back_e) (i32.const 2))
      (global.set $glg_back_gpu (i32.const 0))))
    (if (global.get $glg_z_gpu) (then
      (global.set $glg_zlost (i32.const 1))
      (global.set $glg_z_gpu (i32.const 0))))
    (global.set $glg_gpu (i32.const 0)))

  (func $glg_decline (param $why i32)
    (call $glg_stat (i32.const 14) (i32.const 1))
    (call $glg_stat (i32.add (i32.const 16) (local.get $why)) (i32.const 1))
    (global.set $glg_declined (i32.const 1))
    (if (global.get $glg_gpu) (then (call $glg_to_sw)))
    (if (i32.or (i32.eq (local.get $why) (i32.const 5)) (i32.eq (local.get $why) (i32.const 6)))
      (then (call $glg_front_sync (i32.const 5)))))

  (func $glg_sync_back (param $site i32)
    (if (i32.and (i32.ne (global.get $glg_back_gpu) (i32.const 0)) (i32.ne (global.get $glg_back_e) (i32.const 0))) (then
      (call $glg_flush)
      (call $glg_readback (global.get $glg_back_id) (global.get $glg_back_e) (local.get $site))
      (global.set $glg_back_gpu (i32.const 0)))))

  ;; A primitive the software rasterizer is about to draw.
  (func $glg_cpu_prim
    (local $s i32)
    (if (i32.or (i32.eqz (global.get $glg_on)) (global.get $glg_dead)) (then (return)))
    (if (i32.eq (global.get $gl_sw_rt) (global.get $glg_back_e)) (then (call $glg_sync_back (i32.const 2))))
    (global.set $glg_back_cpu (i32.const 1))
    (local.set $s (global.get $gl_sw_st))
    (if (i32.and (i32.ne (i32.and (i32.load (local.get $s)) (i32.const 8)) (i32.const 0))
          (i32.ne (global.get $gl_sw_zbuf) (i32.const 0))) (then
      (if (global.get $glg_zlost) (then (call $glg_fail (i32.const 20))))
      (if (i32.load offset=24 (local.get $s)) (then (global.set $glg_z_cpu (i32.const 1)))))))

  ;; glBitmap / DrawPixels / stencil DrawPixels / glAccum write the colour
  ;; buffer from the CPU.
  (func $glg_cpu_write (param $why i32)
    (if (i32.or (i32.eqz (global.get $glg_on)) (global.get $glg_dead)) (then (return)))
    (call $glg_decline (local.get $why))
    (if (i32.or (i32.eq (global.get $gl_sw_rt) (global.get $gl_sw_front)) (i32.ne (global.get $gl_sw_second) (i32.const 0)))
      (then (call $glg_front_sync (i32.const 5))))
    (global.set $glg_back_cpu (i32.const 1)))

  ;; A read_surface lease of $rt: its DIB must hold the picture.
  (func $glg_cpu_read (param $rt i32)
    (if (i32.or (i32.eqz (global.get $glg_on)) (i32.eqz (global.get $glg_back_e))) (then (return)))
    (if (i32.and (i32.eq (local.get $rt) (global.get $glg_back_e)) (i32.ne (global.get $glg_back_gpu) (i32.const 0))) (then
      (call $glg_readback (global.get $glg_back_id) (global.get $glg_back_e) (global.get $glg_read_site))
      (global.set $glg_back_gpu (i32.const 0))))
    (if (i32.eq (local.get $rt) (global.get $glg_front_e))
      (then (call $glg_front_sync (global.get $glg_read_site)))))

  ;; A CPU read of the depth surface (glReadPixels/CopyPixels DEPTH).
  (func $glg_cpu_zread
    (if (i32.or (i32.eqz (global.get $glg_on)) (global.get $glg_dead)) (then (return)))
    (if (i32.or (global.get $glg_z_gpu) (global.get $glg_zlost)) (then (call $glg_fail (i32.const 20)))))

  (func $glg_set_read_site (param $site i32) (result i32)
    (local $old i32)
    (local.set $old (global.get $glg_read_site))
    (global.set $glg_read_site (local.get $site))
    (local.get $old))

  ;; Capture: the front DIB holds the last presented frame.
  (func (export "gl_gps_sync_front") (result i32)
    (if (i32.or (i32.eqz (global.get $glg_on)) (i32.eqz (global.get $glg_h))) (then (return (i32.const 0))))
    (call $glg_front_sync (i32.const 1))
    (i32.const 1))

  ;; ---- state records ---------------------------------------------------------
  ;; RASTER for the draw's first primitive (target view, alpha test, depth,
  ;; blend and colour mask are constant across a draw).
  (func $glg_raster
    (local $s i32) (local $st i32) (local $caps i32) (local $depth i32) (local $blend i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $p i32)
    (local.set $s (i32.add (call $glg_m) (i32.const 512)))
    (local.set $st (global.get $gl_sw_st))
    (local.set $caps (i32.load (local.get $st)))
    (memory.fill (local.get $s) (i32.const 0) (i32.const 96))
    (local.set $depth (i32.and (i32.ne (i32.and (local.get $caps) (i32.const 8)) (i32.const 0))
      (i32.ne (global.get $gl_sw_zbuf) (i32.const 0))))
    (local.set $blend (i32.and (i32.ne (i32.and (local.get $caps) (i32.const 2)) (i32.const 0))
      (i32.eqz (global.get $rast_gl_logic))))
    (store.field GpsRaster depth_mode (local.get $s) (local.get $depth))
    (store.field GpsRaster zfunc (local.get $s) (select (i32.load offset=20 (local.get $st)) (i32.const 8) (local.get $depth)))
    (store.field GpsRaster zwrite (local.get $s)
      (i32.and (local.get $depth) (i32.ne (i32.load offset=24 (local.get $st)) (i32.const 0))))
    (store.field GpsRaster cull (local.get $s) (i32.const 1))
    (store.field GpsRaster blend (local.get $s) (local.get $blend))
    (store.field GpsRaster src_rgb (local.get $s) (select (i32.load offset=4 (local.get $st)) (i32.const 2) (local.get $blend)))
    (store.field GpsRaster dst_rgb (local.get $s) (select (i32.load offset=8 (local.get $st)) (i32.const 1) (local.get $blend)))
    (store.field GpsRaster src_alpha (local.get $s) (select (i32.load offset=4 (local.get $st)) (i32.const 2) (local.get $blend)))
    (store.field GpsRaster dst_alpha (local.get $s) (select (i32.load offset=8 (local.get $st)) (i32.const 1) (local.get $blend)))
    (store.field GpsRaster alpha_func (local.get $s)
      (select (i32.and (global.get $gl_sw_r_alpha) (i32.const 255)) (i32.const 8) (i32.ne (global.get $gl_sw_r_alpha) (i32.const 0))))
    (store.field GpsRaster alpha_ref (local.get $s) (i32.and (i32.shr_u (global.get $gl_sw_r_alpha) (i32.const 8)) (i32.const 255)))
    (store.field GpsRaster colormask (local.get $s) (select (i32.const 0) (i32.const 15) (i32.eqz (global.get $rast_color_mask))))
    (store.field GpsRaster fill (local.get $s) (i32.const 3))
    (local.set $r (global.get $glg_w))
    (local.set $b (global.get $glg_hh))
    (if (i32.ne (global.get $gl_sw_r_rt) (global.get $gl_sw_rt)) (then
      (local.set $l (global.get $gl_sw_sc_x))
      (local.set $t (global.get $gl_sw_sc_y))
      (local.set $r (i32.add (local.get $l) (load.field DxObject width (global.get $gl_sw_r_rt))))
      (local.set $b (i32.add (local.get $t) (load.field DxObject height (global.get $gl_sw_r_rt))))))
    (store.field GpsRaster scissor_left (local.get $s) (local.get $l))
    (store.field GpsRaster scissor_top (local.get $s) (local.get $t))
    (store.field GpsRaster scissor_right (local.get $s) (local.get $r))
    (store.field GpsRaster scissor_bottom (local.get $s) (local.get $b))
    (store.field GpsRaster blend_op (local.get $s) (i32.const 1))
    (store.field GpsRaster blend_op_alpha (local.get $s) (i32.const 1))
    (if (i32.and (i32.ne (global.get $glg_c_raster) (i32.const 0))
          (call $d3g_row_eq (local.get $s) (i32.add (global.get $glg_mem) (i32.const 608)) (i32.const 96)))
      (then (return)))
    (memory.copy (i32.add (global.get $glg_mem) (i32.const 608)) (local.get $s) (i32.const 96))
    (global.set $glg_c_raster (i32.const 1))
    (local.set $p (call $glg_begin (global.get $GPS_OP_RASTER) (i32.const 96)))
    (memory.copy (local.get $p) (local.get $s) (i32.const 96))
    (drop (call $glg_end (local.get $p))))

  (func $glg_bind_rec (param $t0 i32) (param $s0 i32) (param $t1 i32) (param $s1 i32)
    (local $p i32) (local $n i32) (local $e i32)
    (if (i32.and (i32.ne (global.get $glg_c_bind) (i32.const 0))
          (i32.and (i32.and (i32.eq (global.get $glg_c_t0) (local.get $t0)) (i32.eq (global.get $glg_c_s0) (local.get $s0)))
                   (i32.and (i32.eq (global.get $glg_c_t1) (local.get $t1)) (i32.eq (global.get $glg_c_s1) (local.get $s1)))))
      (then (return)))
    (local.set $n (i32.add (i32.ne (local.get $t0) (i32.const 0)) (i32.ne (local.get $t1) (i32.const 0))))
    (local.set $p (call $glg_begin (global.get $GPS_OP_BIND)
      (i32.add (size-of GpsBind) (i32.mul (local.get $n) (size-of GpsBindEntry)))))
    (store.field GpsBind count (local.get $p) (local.get $n))
    (local.set $e (i32.add (local.get $p) (size-of GpsBind)))
    (if (local.get $t0) (then
      (store.field GpsBindEntry slot (local.get $e) (i32.const 0))
      (store.field GpsBindEntry texture (local.get $e) (local.get $t0))
      (store.field GpsBindEntry sampler (local.get $e) (local.get $s0))
      (local.set $e (i32.add (local.get $e) (size-of GpsBindEntry)))))
    (if (local.get $t1) (then
      (store.field GpsBindEntry slot (local.get $e) (i32.const 1))
      (store.field GpsBindEntry texture (local.get $e) (local.get $t1))
      (store.field GpsBindEntry sampler (local.get $e) (local.get $s1))))
    (drop (call $glg_end (local.get $p)))
    (global.set $glg_c_bind (i32.const 1))
    (global.set $glg_c_t0 (local.get $t0))
    (global.set $glg_c_s0 (local.get $s0))
    (global.set $glg_c_t1 (local.get $t1))
    (global.set $glg_c_s1 (local.get $s1)))

  ;; One packed colour as four floats: ARGB when $argb, else R|G<<8|B<<16|A<<24.
  (func $glg_f4 (param $at i32) (param $c i32) (param $argb i32)
    (if (local.get $argb) (then
      (local.set $c (i32.or (i32.or (i32.and (local.get $c) (i32.const 0xff00ff00))
        (i32.and (i32.shr_u (local.get $c) (i32.const 16)) (i32.const 255)))
        (i32.shl (i32.and (local.get $c) (i32.const 255)) (i32.const 16))))))
    (f32.store (local.get $at) (f32.div (f32.convert_i32_u (i32.and (local.get $c) (i32.const 255))) (f32.const 255)))
    (f32.store offset=4 (local.get $at) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (i32.const 8)) (i32.const 255))) (f32.const 255)))
    (f32.store offset=8 (local.get $at) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (i32.const 16)) (i32.const 255))) (f32.const 255)))
    (f32.store offset=12 (local.get $at) (f32.div (f32.convert_i32_u (i32.shr_u (local.get $c) (i32.const 24))) (f32.const 255))))

  ;; c0 fog colour, c1 / c2 the texture env colours of units 0 / 1.
  (func $glg_consts (param $fog i32) (param $env0 i32) (param $env1 i32)
    (local $p i32) (local $c i32)
    (if (i32.and (i32.ne (global.get $glg_c_consts) (i32.const 0))
          (i32.and (i32.eq (global.get $glg_c_fog) (local.get $fog))
            (i32.and (i32.eq (global.get $glg_c_env0) (local.get $env0)) (i32.eq (global.get $glg_c_env1) (local.get $env1)))))
      (then (return)))
    (local.set $p (call $glg_begin (global.get $GPS_OP_CONSTS) (i32.add (size-of GpsConsts) (i32.const 48))))
    (store.field GpsConsts stage (local.get $p) (global.get $GPS_STAGE_PS))
    (store.field GpsConsts pad (local.get $p) (i32.const 0))
    (store.field GpsConsts first (local.get $p) (i32.const 0))
    (store.field GpsConsts count (local.get $p) (i32.const 3))
    (local.set $c (i32.add (local.get $p) (size-of GpsConsts)))
    (call $glg_f4 (local.get $c) (local.get $fog) (i32.const 1))
    (call $glg_f4 (i32.add (local.get $c) (i32.const 16)) (local.get $env0) (i32.const 0))
    (call $glg_f4 (i32.add (local.get $c) (i32.const 32)) (local.get $env1) (i32.const 0))
    (drop (call $glg_end (local.get $p)))
    (global.set $glg_c_consts (i32.const 1))
    (global.set $glg_c_fog (local.get $fog))
    (global.set $glg_c_env0 (local.get $env0))
    (global.set $glg_c_env1 (local.get $env1)))

  ;; GL wrap as a GPS address mode: GL_CLAMP is the border mode when the
  ;; filter can reach past the edge, clamp when it cannot.
  (func $glg_addr (param $code i32) (param $linear i32) (result i32)
    (if (i32.eq (local.get $code) (i32.const 0x2900))
      (then (return (select (i32.const 4) (i32.const 3) (local.get $linear)))))
    (select (i32.const 3) (i32.const 1) (i32.eq (local.get $code) (i32.const 3))))

  (func $glg_sampler (param $au i32) (param $av i32) (param $linear i32) (param $border i32) (result i32)
    (local $key i32) (local $i i32) (local $e i32) (local $id i32) (local $p i32) (local $f i32)
    (local.set $f (select (i32.const 2) (i32.const 1) (local.get $linear)))
    (local.set $key (i32.or (i32.or (local.get $au) (i32.shl (local.get $av) (i32.const 4)))
      (i32.or (i32.shl (local.get $f) (i32.const 8)) (i32.const 0x80000000))))
    ;; Border colour matters only to the border mode.
    (if (i32.and (i32.ne (local.get $au) (i32.const 4)) (i32.ne (local.get $av) (i32.const 4)))
      (then (local.set $border (i32.const 0))))
    (local.set $border (i32.or (i32.or (i32.and (local.get $border) (i32.const 0xff00ff00))
      (i32.and (i32.shr_u (local.get $border) (i32.const 16)) (i32.const 255)))
      (i32.shl (i32.and (local.get $border) (i32.const 255)) (i32.const 16))))
    (loop $scan
      (local.set $e (i32.add (i32.add (global.get $glg_mem) (i32.const 1536)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.eq (i32.load (local.get $e)) (local.get $key)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $border)))
        (then (return (i32.load offset=8 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $glg_id))
    (local.set $p (call $glg_begin (global.get $GPS_OP_SAMPLER) (size-of GpsSampler)))
    (store.field GpsSampler id (local.get $p) (local.get $id))
    (store.field GpsSampler address_u (local.get $p) (local.get $au))
    (store.field GpsSampler address_v (local.get $p) (local.get $av))
    (store.field GpsSampler min (local.get $p) (local.get $f))
    (store.field GpsSampler mag (local.get $p) (local.get $f))
    (store.field GpsSampler mip (local.get $p) (i32.const 0))
    (store.field GpsSampler address_w (local.get $p) (i32.const 0))
    (store.field GpsSampler max_level (local.get $p) (i32.const 0))
    (store.field GpsSampler max_aniso (local.get $p) (i32.const 0))
    (store.field GpsSampler lod_bias (local.get $p) (f32.const 0))
    (store.field GpsSampler border (local.get $p) (local.get $border))
    (drop (call $glg_end (local.get $p)))
    ;; Round-robin replacement; slot 31 rotates so a stale id is released.
    (local.set $i (i32.and (local.get $id) (i32.const 31)))
    (local.set $e (i32.add (i32.add (global.get $glg_mem) (i32.const 1536)) (i32.shl (local.get $i) (i32.const 4))))
    (if (i32.load offset=8 (local.get $e)) (then
      (if (i32.and (i32.eq (global.get $glg_c_s0) (i32.load offset=8 (local.get $e))) (i32.ne (global.get $glg_c_bind) (i32.const 0)))
        (then (global.set $glg_c_bind (i32.const 0))))
      (if (i32.and (i32.eq (global.get $glg_c_s1) (i32.load offset=8 (local.get $e))) (i32.ne (global.get $glg_c_bind) (i32.const 0)))
        (then (global.set $glg_c_bind (i32.const 0))))
      (call $glg_release (i32.load offset=8 (local.get $e)))))
    (i32.store (local.get $e) (local.get $key))
    (i32.store offset=4 (local.get $e) (local.get $border))
    (i32.store offset=8 (local.get $e) (local.get $id))
    (local.get $id))

  ;; ---- textures --------------------------------------------------------------
  (func $glg_tex_slot (param $wa i32) (result i32)
    (i32.add (i32.add (global.get $glg_mem) (i32.const 4096))
      (i32.shl (i32.shr_u (i32.mul (local.get $wa) (i32.const 0x9E3779B1)) (i32.const 22)) (i32.const 5))))

  ;; Texels at $wa changed (09a8g/09a8b texel writers call this).
  (func $glg_tex_dirty (param $wa i32)
    (local $e i32)
    (if (i32.eqz (global.get $glg_mem)) (then (return)))
    (local.set $e (call $glg_tex_slot (local.get $wa)))
    (if (i32.eq (i32.load (local.get $e)) (local.get $wa))
      (then (i32.store offset=16 (local.get $e) (i32.const 0)))))

  ;; 0, or the decline reason a texture surface earns.
  (func $glg_tex_ok (param $entry i32) (result i32)
    (local $w i32) (local $hgt i32)
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 22))))
    (if (i32.ne (load.field DxObject bpp (local.get $entry)) (i32.const 32)) (then (return (i32.const 22))))
    (local.set $w (load.field DxObject width (local.get $entry)))
    (local.set $hgt (load.field DxObject height (local.get $entry)))
    (if (i32.or (i32.or (i32.lt_s (local.get $w) (i32.const 1)) (i32.gt_s (local.get $w) (i32.const 2048)))
                (i32.or (i32.lt_s (local.get $hgt) (i32.const 1)) (i32.gt_s (local.get $hgt) (i32.const 2048))))
      (then (return (i32.const 18))))
    (if (call $gl_2d_border_record (load.field DxObject misc1 (local.get $entry))) (then (return (i32.const 10))))
    (i32.const 0))

  ;; The executor texture holding $entry's current texels (one level).
  (func $glg_tex (param $entry i32) (result i32)
    (local $wa i32) (local $w i32) (local $hgt i32) (local $e i32) (local $id i32) (local $pitch i32)
    (local $fmt i32) (local $y i32) (local $n i32) (local $k i32) (local $pos i32) (local $dst i32)
    (local $p i32) (local $band i32)
    (local.set $wa (load.field DxObject misc1 (local.get $entry)))
    (local.set $w (load.field DxObject width (local.get $entry)))
    (local.set $hgt (load.field DxObject height (local.get $entry)))
    (local.set $e (call $glg_tex_slot (local.get $wa)))
    (if (i32.and (i32.eq (i32.load (local.get $e)) (local.get $wa))
          (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $w))
                   (i32.eq (i32.load offset=12 (local.get $e)) (local.get $hgt))))
      (then
        (if (i32.load offset=16 (local.get $e)) (then
          (call $glg_stat (i32.const 13) (i32.const 1))
          (return (i32.load offset=4 (local.get $e)))))
        (local.set $id (i32.load offset=4 (local.get $e))))
      (else
        (if (i32.load offset=4 (local.get $e)) (then
          (if (i32.eq (global.get $glg_c_t0) (i32.load offset=4 (local.get $e))) (then (global.set $glg_c_bind (i32.const 0))))
          (if (i32.eq (global.get $glg_c_t1) (i32.load offset=4 (local.get $e))) (then (global.set $glg_c_bind (i32.const 0))))
          (if (i32.eq (global.get $glg_b_t0) (i32.load offset=4 (local.get $e))) (then (call $glg_flush)))
          (if (i32.eq (global.get $glg_b_t1) (i32.load offset=4 (local.get $e))) (then (call $glg_flush)))
          (call $glg_release (i32.load offset=4 (local.get $e)))))
        (local.set $id (call $glg_id))
        (call $glg_flush)
        (call $gps_create (global.get $glg_h) (local.get $id) (global.get $GPS_KIND_TEX2D)
          (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
        (i32.store (local.get $e) (local.get $wa))
        (i32.store offset=4 (local.get $e) (local.get $id))
        (i32.store offset=8 (local.get $e) (local.get $w))
        (i32.store offset=12 (local.get $e) (local.get $hgt))))
    (local.set $pitch (load.field DxObject pitch (local.get $entry)))
    (local.set $fmt (call $dx_surf_fmt_get (local.get $entry)))
    (local.set $band (call $glg_band (local.get $w)))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $y)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $glg_arena (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n))))
      (local.set $dst (call $glg_aptr (local.get $pos)))
      (local.set $k (i32.const 0))
      (block $rd (loop $rows
        (br_if $rd (i32.ge_u (local.get $k) (local.get $n)))
        (call $d3g_row_to_rgba
          (i32.add (local.get $wa) (i32.mul (i32.add (local.get $y) (local.get $k)) (local.get $pitch)))
          (i32.add (local.get $dst) (i32.mul (local.get $k) (i32.shl (local.get $w) (i32.const 2))))
          (local.get $w) (local.get $fmt) (i32.const 32))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $rows)))
      (local.set $p (call $glg_begin (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
      (store.field GpsUpload id (local.get $p) (local.get $id))
      (store.field GpsUpload level (local.get $p) (i32.const 0))
      (store.field GpsUpload face (local.get $p) (i32.const 0))
      (store.field GpsUpload x (local.get $p) (i32.const 0))
      (store.field GpsUpload y (local.get $p) (local.get $y))
      (store.field GpsUpload w (local.get $p) (local.get $w))
      (store.field GpsUpload h (local.get $p) (local.get $n))
      (store.field GpsUpload pitch (local.get $p) (i32.shl (local.get $w) (i32.const 2)))
      (store.field GpsUpload src (local.get $p) (local.get $pos))
      (store.field GpsUpload bytes (local.get $p) (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (drop (call $glg_end (local.get $p)))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (i32.store offset=16 (local.get $e) (i32.const 1))
    (call $glg_stat (i32.const 9) (i32.const 1))
    (local.get $id))

  ;; ---- texenv combine -> ps_1_4 ----------------------------------------------
  ;; GL mode as 0 MODULATE (and anything else, as the software combine
  ;; treats it), 1 REPLACE, 2 DECAL, 3 BLEND.
  (func $glg_mode (param $unit i32) (result i32)
    (local $m i32)
    (local.set $m (i32.load (i32.add (global.get $gl_texture_draw) (i32.mul (local.get $unit) (i32.const 20)))))
    (if (i32.eq (local.get $m) (i32.const 0x1e01)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $m) (i32.const 0x2101)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $m) (i32.const 0xbe2)) (then (return (i32.const 3))))
    (i32.const 0))

  (func $glg_base (param $unit i32) (result i32)
    (call $gl_texture_base (i32.load (i32.add (global.get $gl_texture_draw)
      (i32.add (i32.const 40) (i32.shl (local.get $unit) (i32.const 2)))))))

  ;; Unit $unit's env colour as R|G<<8|B<<16|A<<24 bytes, rounded as the
  ;; software combine rounds it.
  (func $glg_env (param $unit i32) (result i32)
    (local $p i32) (local $i i32) (local $out i32)
    (local.set $p (i32.add (i32.add (global.get $gl_texture_draw) (i32.mul (local.get $unit) (i32.const 20))) (i32.const 4)))
    (loop $ch
      (local.set $out (i32.or (local.get $out) (i32.shl
        (i32.trunc_sat_f32_s (f32.nearest (f32.mul (f32.const 255) (f32.load (i32.add (local.get $p) (i32.shl (local.get $i) (i32.const 2)))))))
        (i32.shl (local.get $i) (i32.const 3)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $ch (i32.lt_u (local.get $i) (i32.const 4))))
    (local.get $out))

  (func $glg_ins (param $buf i32) (param $n i32) (param $op i32) (param $dst i32)
      (param $a i32) (param $b i32) (param $c i32) (result i32)
    (call $gps_ir_ins (local.get $buf) (local.get $n) (local.get $op)
      (if (result i32) (i32.eq (local.get $op) (i32.const 18)) (then (i32.const 4))
        (else (if (result i32) (i32.or (i32.eq (local.get $op) (global.get $GPS_IR_MOV)) (i32.eq (local.get $op) (global.get $GPS_IR_TEX))) (then (i32.const 2)) (else (i32.const 3)))))
      (local.get $dst) (local.get $a) (local.get $b) (local.get $c)))

  ;; One unit of $gl_texture_combine into register $reg: texel in r$tex,
  ;; incoming fragment colour token $d, env colour c$cidx.
  (func $glg_stage (param $buf i32) (param $n i32) (param $reg i32) (param $mode i32) (param $base i32)
      (param $tex i32) (param $d i32) (param $cidx i32) (result i32)
    (local $t i32) (local $tx i32) (local $tw i32) (local $c i32) (local $ta i32) (local $da i32) (local $dr i32)
    (local.set $t (i32.or (i32.const 0x80E40000) (local.get $tex)))
    (local.set $tx (i32.or (i32.const 0x80000000) (local.get $tex)))
    (local.set $tw (i32.or (i32.const 0x80FF0000) (local.get $tex)))
    (local.set $c (i32.or (i32.const 0xA0E40000) (local.get $cidx)))
    ;; INTENSITY takes its alpha from R.
    (local.set $ta (select (local.get $tx) (local.get $t) (i32.eq (local.get $base) (i32.const 6))))
    (local.set $da (call $d3g_dst (local.get $reg) (i32.const 8)))
    (local.set $dr (call $d3g_dst (local.get $reg) (i32.const 7)))
    ;; Alpha.
    (if (i32.or (i32.eq (local.get $base) (i32.const 1)) (i32.eq (local.get $base) (i32.const 3)))
      (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (local.get $da)
        (local.get $d) (i32.const 0) (i32.const 0))))
      (else (if (i32.eq (local.get $mode) (i32.const 1))
        (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (local.get $da)
          (local.get $ta) (i32.const 0) (i32.const 0))))
        (else (if (i32.eq (local.get $mode) (i32.const 2))
          (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (local.get $da)
            (local.get $d) (i32.const 0) (i32.const 0))))
          (else (if (i32.and (i32.eq (local.get $mode) (i32.const 3)) (i32.eq (local.get $base) (i32.const 6)))
            (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (i32.const 18) (local.get $da)
              (local.get $tx) (local.get $c) (local.get $d))))
            (else (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MUL) (local.get $da)
              (local.get $ta) (local.get $d) (i32.const 0)))))))))))
    ;; Colour.
    (if (i32.eq (local.get $base) (i32.const 5))
      (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (local.get $dr)
        (local.get $d) (i32.const 0) (i32.const 0))))
      (else (if (i32.eq (local.get $mode) (i32.const 1))
        (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (local.get $dr)
          (local.get $t) (i32.const 0) (i32.const 0))))
        (else (if (i32.eq (local.get $mode) (i32.const 3))
          (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (i32.const 18) (local.get $dr)
            (local.get $t) (local.get $c) (local.get $d))))
          (else (if (i32.eq (local.get $mode) (i32.const 2))
            (then (if (i32.eq (local.get $base) (i32.const 3))
              (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV) (local.get $dr)
                (local.get $t) (i32.const 0) (i32.const 0))))
              (else (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (i32.const 18) (local.get $dr)
                (select (local.get $tx) (local.get $tw) (i32.eq (local.get $base) (i32.const 6)))
                (local.get $t) (local.get $d))))))
            (else (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MUL) (local.get $dr)
              (local.get $t) (local.get $d) (i32.const 0)))))))))))
    (local.get $n))

  ;; Key: bit0 unit 0 textured, 1-2 its mode, 3-5 its base, bit6 unit 1,
  ;; 7-8 its mode, 9-11 its base, bit12 fog.
  (func $glg_shader (param $key i32) (result i32)
    (local $i i32) (local $e i32) (local $id i32) (local $p i32) (local $buf i32) (local $n i32)
    (local $bytes i32) (local $cur i32)
    (local.set $key (i32.or (local.get $key) (i32.const 0x80000000)))
    (if (i32.eq (global.get $glg_last_key) (local.get $key)) (then (return (global.get $glg_last_ps))))
    (loop $scan
      (local.set $e (i32.add (i32.add (global.get $glg_mem) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 3))))
      (if (i32.eq (i32.load (local.get $e)) (local.get $key)) (then
        (global.set $glg_last_key (local.get $key))
        (global.set $glg_last_ps (i32.load offset=4 (local.get $e)))
        (return (i32.load offset=4 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 64))))
    (local.set $buf (i32.add (global.get $glg_mem) (i32.const 2048)))
    (if (i32.and (local.get $key) (i32.const 1))
      (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_TEX)
        (call $d3g_dst (i32.const 0) (i32.const 15)) (i32.const 0xB0E40000) (i32.const 0) (i32.const 0)))))
    (if (i32.and (local.get $key) (i32.const 64))
      (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_TEX)
        (call $d3g_dst (i32.const 1) (i32.const 15)) (i32.const 0xB0E40001) (i32.const 0) (i32.const 0)))))
    (local.set $cur (i32.const 0x90E40000))
    (if (i32.and (local.get $key) (i32.const 1)) (then
      (local.set $n (call $glg_stage (local.get $buf) (local.get $n) (i32.const 2)
        (i32.and (i32.shr_u (local.get $key) (i32.const 1)) (i32.const 3))
        (i32.and (i32.shr_u (local.get $key) (i32.const 3)) (i32.const 7))
        (i32.const 0) (local.get $cur) (i32.const 1)))
      (local.set $cur (i32.const 0x80E40002))))
    (if (i32.and (local.get $key) (i32.const 64)) (then
      (local.set $n (call $glg_stage (local.get $buf) (local.get $n) (i32.const 3)
        (i32.and (i32.shr_u (local.get $key) (i32.const 7)) (i32.const 3))
        (i32.and (i32.shr_u (local.get $key) (i32.const 9)) (i32.const 7))
        (i32.const 1) (local.get $cur) (i32.const 2)))
      (local.set $cur (i32.const 0x80E40003))))
    (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (global.get $GPS_IR_MOV)
      (call $d3g_dst (i32.const 0) (i32.const 15)) (local.get $cur) (i32.const 0) (i32.const 0)))
    (if (i32.and (local.get $key) (i32.const 0x1000))
      ;; GL fog: f * C + (1 - f) * fog colour, f in COLOR1's alpha.
      (then (local.set $n (call $glg_ins (local.get $buf) (local.get $n) (i32.const 18)
        (call $d3g_dst (i32.const 0) (i32.const 7)) (i32.const 0x90FF0001) (i32.const 0x80E40000) (i32.const 0xA0E40000)))))
    (local.set $bytes (call $gps_ir_finish (local.get $buf) (local.get $n) (global.get $GPS_STAGE_PS) (i32.const 0xffff0104)))
    (local.set $id (call $glg_id))
    (local.set $p (call $glg_begin (global.get $GPS_OP_SHADER) (i32.add (size-of GpsShader) (local.get $bytes))))
    (store.field GpsShader id (local.get $p) (local.get $id))
    (store.field GpsShader stage (local.get $p) (global.get $GPS_STAGE_PS))
    (store.field GpsShader pad (local.get $p) (i32.const 0))
    (store.field GpsShader pad2 (local.get $p) (i32.const 0))
    (store.field GpsShader ir_bytes (local.get $p) (local.get $bytes))
    (memory.copy (i32.add (local.get $p) (size-of GpsShader)) (local.get $buf) (local.get $bytes))
    (drop (call $glg_end (local.get $p)))
    ;; 64 live shaders is more than any key space a GL app reaches; the
    ;; slot is the id's low bits, releasing what was there.
    (local.set $e (i32.add (i32.add (global.get $glg_mem) (i32.const 1024))
      (i32.shl (i32.and (local.get $id) (i32.const 63)) (i32.const 3))))
    (if (i32.load offset=4 (local.get $e)) (then
      (if (i32.eq (global.get $glg_b_ps) (i32.load offset=4 (local.get $e))) (then (call $glg_flush)))
      (call $glg_release (i32.load offset=4 (local.get $e)))))
    (i32.store (local.get $e) (local.get $key))
    (i32.store offset=4 (local.get $e) (local.get $id))
    (global.set $glg_last_key (local.get $key))
    (global.set $glg_last_ps (local.get $id))
    (local.get $id))

  ;; ---- draws -----------------------------------------------------------------
  ;; Draw-level classification, from $gl_sw_draw once its per-draw state is set.
  (func $glg_draw_begin
    (local $why i32) (local $st i32) (local $caps i32) (local $m i32)
    (global.set $glg_draw_reason (i32.const 0))
    (if (i32.eqz (global.get $glg_on)) (then (return)))
    (if (global.get $glg_dead) (then (global.set $glg_draw_reason (i32.const -1)) (return)))
    (local.set $st (global.get $gl_sw_st))
    (local.set $caps (i32.load (local.get $st)))
    (local.set $m (global.get $rast_color_mask))
    (block $ok
      (local.set $why (i32.const 7)) (br_if $ok (global.get $gl_sw_bitmap))
      (local.set $why (i32.const 8)) (br_if $ok (i32.eqz (global.get $gl_sw_rt_obj)))
      (local.set $why (i32.const 5)) (br_if $ok (i32.eq (global.get $gl_sw_rt) (global.get $gl_sw_front)))
      (local.set $why (i32.const 8)) (br_if $ok (i32.ne (global.get $gl_sw_rt) (call $dx_from_this (global.get $gl_sw_rt_obj))))
      (local.set $why (i32.const 6)) (br_if $ok (global.get $gl_sw_second))
      (local.set $why (i32.const 1)) (br_if $ok (global.get $rast_gl_logic))
      (local.set $why (i32.const 4)) (br_if $ok (global.get $rast_stencil_state))
      (local.set $why (i32.const 2)) (br_if $ok (i32.and (i32.ne (local.get $m) (i32.const -1)) (i32.ne (local.get $m) (i32.const 0))))
      (local.set $why (i32.const 3)) (br_if $ok (i32.ne (i32.and (local.get $caps) (i32.const 0x1000000)) (i32.const 0)))
      (local.set $why (i32.const 17)) (br_if $ok (i32.eqz (global.get $gl_sw_flip_y)))
      (local.set $why (i32.const 23)) (br_if $ok (i32.and (i32.ne (i32.and (local.get $caps) (i32.const 2)) (i32.const 0))
        (i32.or (i32.gt_u (i32.sub (i32.load offset=4 (local.get $st)) (i32.const 1)) (i32.const 12))
                (i32.gt_u (i32.sub (i32.load offset=8 (local.get $st)) (i32.const 1)) (i32.const 12)))))
      (local.set $why (i32.const 0)))
    (if (local.get $why) (then
      (global.set $glg_draw_reason (local.get $why))
      (call $glg_decline (local.get $why))
      (return)))
    (if (i32.eqz (call $glg_bind)) (then
      (global.set $glg_draw_reason (i32.const -1))
      (return)))
    (global.set $glg_need_raster (i32.const 1)))

  ;; Per-primitive classification and state. 1: the executor draws it and
  ;; the batch is ready for its vertices.
  (func $glg_prim (param $span i32) (result i32)
    (local $why i32) (local $tex i32) (local $t1 i32) (local $key i32) (local $caps i32)
    (local $t0id i32) (local $s0 i32) (local $t1id i32) (local $s1 i32) (local $ps i32)
    (local $fog i32) (local $env0 i32) (local $env1 i32) (local $flags i32) (local $lin i32)
    (if (global.get $glg_draw_reason) (then (return (i32.const 0))))
    (local.set $caps (i32.load (global.get $gl_sw_st)))
    (local.set $tex (i32.ne (global.get $gl_sw_r_tex) (global.get $gl_sw_white)))
    (local.set $t1 (i32.ne (global.get $rast_t1_on) (i32.const 0)))
    (block $ok
      (local.set $why (i32.const 9)) (br_if $ok (call $gl_1d_selected (i32.const 0)))
      ;; Projective texture coordinates (Q != 1 or a texture matrix): the
      ;; executor in this tree has no projected texld (t#_dz) yet.
      (local.set $why (i32.const 12)) (br_if $ok (i32.or
        (i32.and (local.get $tex) (i32.ne (global.get $rast_t0_q_on) (i32.const 0)))
        (i32.and (local.get $t1) (i32.ne (global.get $glg_q1_bad) (i32.const 0)))))
      (local.set $why (i32.const 3)) (br_if $ok (i32.ne (global.get $rast_gl_stipple) (i32.const 0)))
      (if (local.get $t1) (then
        (local.set $why (i32.const 11)) (br_if $ok (local.get $span))
        (local.set $why (i32.const 21)) (br_if $ok (call $gl_1d_selected (i32.const 1)))
        (local.set $why (i32.const 25)) (br_if $ok (i32.ne (global.get $rast_t1_op) (i32.const 0x10001)))
        (local.set $why (call $glg_tex_ok (global.get $rast_t1_entry))) (br_if $ok (local.get $why))))
      (if (local.get $tex) (then
        (local.set $why (i32.const 25)) (br_if $ok (i32.eqz (global.get $gl_texture_draw)))
        (local.set $why (call $glg_tex_ok (global.get $gl_sw_r_tex))) (br_if $ok (local.get $why))))
      (local.set $why (i32.const 0)))
    (if (local.get $why) (then (call $glg_decline (local.get $why)) (return (i32.const 0))))
    (if (i32.eqz (global.get $glg_gpu)) (then
      (call $glg_enter (i32.const 0))
      (if (i32.eqz (global.get $glg_gpu)) (then (return (i32.const 0))))))
    (if (global.get $glg_need_raster) (then
      (global.set $glg_need_raster (i32.const 0))
      (call $glg_raster)))
    (if (local.get $tex) (then
      (local.set $flags (global.get $gl_sw_r_flags))
      (local.set $lin (i32.and (local.get $flags) (i32.const 1)))
      (local.set $t0id (call $glg_tex (global.get $gl_sw_r_tex)))
      (local.set $s0 (call $glg_sampler
        (call $glg_addr (call $gl_sw_flags_address (local.get $flags) (i32.const 2)) (local.get $lin))
        (call $glg_addr (call $gl_sw_flags_address (local.get $flags) (i32.const 4)) (local.get $lin))
        (local.get $lin) (global.get $gl_sw_r_border)))
      (local.set $key (i32.or (i32.const 1) (i32.or (i32.shl (call $glg_mode (i32.const 0)) (i32.const 1))
        (i32.shl (call $glg_base (i32.const 0)) (i32.const 3)))))
      (local.set $env0 (call $glg_env (i32.const 0)))))
    (if (local.get $t1) (then
      (local.set $lin (i32.ne (global.get $rast_t1_linear) (i32.const 0)))
      (local.set $t1id (call $glg_tex (global.get $rast_t1_entry)))
      (local.set $s1 (call $glg_sampler
        (call $glg_addr (global.get $rast_t1_addr_u) (local.get $lin))
        (call $glg_addr (global.get $rast_t1_addr_v) (local.get $lin))
        (local.get $lin) (global.get $rast_t1_border)))
      (local.set $key (i32.or (local.get $key) (i32.or (i32.const 64) (i32.or (i32.shl (call $glg_mode (i32.const 1)) (i32.const 7))
        (i32.shl (call $glg_base (i32.const 1)) (i32.const 9))))))
      (local.set $env1 (call $glg_env (i32.const 1)))))
    (if (i32.and (local.get $caps) (i32.const 64)) (then
      (local.set $key (i32.or (local.get $key) (i32.const 0x1000)))
      (local.set $fog (global.get $gl_sw_fog_color))))
    (local.set $ps (call $glg_shader (local.get $key)))
    (if (i32.eqz (i32.and (i32.ne (global.get $glg_b_n) (i32.const 0))
          (i32.and
            (i32.and (i32.and (i32.eq (global.get $glg_b_ps) (local.get $ps)) (i32.eq (global.get $glg_b_t0) (local.get $t0id)))
              (i32.and (i32.eq (global.get $glg_b_s0) (local.get $s0)) (i32.eq (global.get $glg_b_t1) (local.get $t1id))))
            (i32.and (i32.and (i32.eq (global.get $glg_b_s1) (local.get $s1)) (i32.eq (global.get $glg_b_fog) (local.get $fog)))
              (i32.and (i32.eq (global.get $glg_b_env0) (local.get $env0)) (i32.eq (global.get $glg_b_env1) (local.get $env1)))))))
      (then
        (call $glg_flush)
        (call $glg_targets)
        (call $glg_bind_rec (local.get $t0id) (local.get $s0) (local.get $t1id) (local.get $s1))
        (call $glg_consts (local.get $fog) (local.get $env0) (local.get $env1))
        (global.set $glg_b_ps (local.get $ps))
        (global.set $glg_b_t0 (local.get $t0id))
        (global.set $glg_b_s0 (local.get $s0))
        (global.set $glg_b_t1 (local.get $t1id))
        (global.set $glg_b_s1 (local.get $s1))
        (global.set $glg_b_fog (local.get $fog))
        (global.set $glg_b_env0 (local.get $env0))
        (global.set $glg_b_env1 (local.get $env1))))
    (global.set $glg_back_gpu (i32.const 1))
    (if (i32.and (i32.and (i32.ne (i32.and (local.get $caps) (i32.const 8)) (i32.const 0))
          (i32.ne (global.get $gl_sw_zbuf) (i32.const 0)))
          (i32.ne (i32.load offset=24 (global.get $gl_sw_st)) (i32.const 0)))
      (then (global.set $glg_z_gpu (i32.const 1))))
    (i32.const 1))

  ;; A fog factor (0..1, 1 = no fog) as COLOR1 with it in alpha.
  (func $glg_fogc (param $f f32) (result i32)
    (i32.shl (i32.trunc_sat_f32_u (f32.nearest (f32.mul (f32.const 255)
      (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $f)))))) (i32.const 24)))

  ;; One vertex from screen record $r at (x, y); unit 0 (S, T, Q), unit 1
  ;; from clip record $c (S1, T1, Q1) or (0, 0, 1).
  (func $glg_v (param $o i32) (param $x f32) (param $y f32) (param $r i32) (param $q0 f32) (param $c i32) (param $spec i32)
    (f32.store (local.get $o) (local.get $x))
    (f32.store offset=4 (local.get $o) (local.get $y))
    (f32.store offset=8 (local.get $o) (f32.load offset=8 (local.get $r)))
    (f32.store offset=12 (local.get $o) (f32.load offset=12 (local.get $r)))
    (i32.store offset=16 (local.get $o) (i32.load offset=24 (local.get $r)))
    (i32.store offset=20 (local.get $o) (local.get $spec))
    (f32.store offset=24 (local.get $o) (f32.load offset=16 (local.get $r)))
    (f32.store offset=28 (local.get $o) (f32.load offset=20 (local.get $r)))
    (f32.store offset=32 (local.get $o) (local.get $q0))
    (if (local.get $c)
      (then
        (f32.store offset=36 (local.get $o) (f32.load offset=40 (local.get $c)))
        (f32.store offset=40 (local.get $o) (f32.load offset=44 (local.get $c)))
        (f32.store offset=44 (local.get $o) (f32.load offset=52 (local.get $c))))
      (else
        (f32.store offset=36 (local.get $o) (f32.const 0))
        (f32.store offset=40 (local.get $o) (f32.const 0))
        (f32.store offset=44 (local.get $o) (f32.const 1)))))

  (func $glg_tri_v (param $o i32) (param $k i32) (param $c i32)
    (local $r i32)
    (local.set $r (call $gl_sw_screen_at (local.get $k)))
    (call $glg_v (local.get $o)
      (f32.convert_i32_s (i32.add (i32.load (local.get $r)) (global.get $gl_sw_r_dx)))
      (f32.convert_i32_s (i32.add (i32.load offset=4 (local.get $r)) (global.get $gl_sw_r_dy)))
      (local.get $r) (f32.load offset=48 (local.get $c)) (local.get $c)
      (if (result i32) (i32.and (i32.load (global.get $gl_sw_st)) (i32.const 64))
        (then (call $glg_fogc (f32.load offset=28 (local.get $r))))
        (else (i32.const 0xff000000)))))

  ;; 09a8g's triangle, screen records 0..2 (in the scissor view's
  ;; coordinates), clip records $c0..$c2. 1: drawn here, skip the rasterizer.
  (func $glg_tri (param $c0 i32) (param $c1 i32) (param $c2 i32) (result i32)
    (local $o i32)
    (if (i32.eqz (global.get $glg_on)) (then (return (i32.const 0))))
    (global.set $glg_q1_bad (i32.or (f32.ne (f32.load offset=52 (local.get $c0)) (f32.const 1))
      (i32.or (f32.ne (f32.load offset=52 (local.get $c1)) (f32.const 1))
              (f32.ne (f32.load offset=52 (local.get $c2)) (f32.const 1)))))
    (if (i32.eqz (call $glg_prim (i32.const 0))) (then (call $glg_cpu_prim) (return (i32.const 0))))
    (local.set $o (call $glg_vtx (i32.const 3)))
    (call $glg_tri_v (local.get $o) (i32.const 0) (local.get $c0))
    (call $glg_tri_v (i32.add (local.get $o) (i32.const 48)) (i32.const 1) (local.get $c1))
    (call $glg_tri_v (i32.add (local.get $o) (i32.const 96)) (i32.const 2) (local.get $c2))
    (call $glg_stat (i32.const 1) (i32.const 1))
    (i32.const 1))

  (func $glg_span_fog (param $x i32) (param $y i32) (result i32)
    (if (i32.eqz (global.get $rast_fog_on)) (then (return (i32.const 0xff000000))))
    (call $glg_fogc (f32.add (global.get $rast_fog_c)
      (f32.add (f32.mul (global.get $rast_fog_a) (f32.convert_i32_s (local.get $x)))
               (f32.mul (global.get $rast_fog_b) (f32.convert_i32_s (local.get $y)))))))

  ;; 09a8g's line/point span: row $y, columns [$xa, $xb), attributes of
  ;; screen records $pa at $xa and $pb at $xb; a one-row quad.
  (func $glg_span (param $y i32) (param $xa i32) (param $pa i32) (param $xb i32) (param $pb i32) (result i32)
    (local $o i32) (local $x0 f32) (local $x1 f32) (local $y0 f32) (local $y1 f32) (local $fa i32) (local $fb i32)
    (if (i32.eqz (global.get $glg_on)) (then (return (i32.const 0))))
    (if (i32.le_s (local.get $xb) (local.get $xa)) (then (return (i32.const 0))))
    (if (i32.eqz (call $glg_prim (i32.const 1))) (then (call $glg_cpu_prim) (return (i32.const 0))))
    (local.set $fa (call $glg_span_fog (local.get $xa) (local.get $y)))
    (local.set $fb (call $glg_span_fog (local.get $xb) (local.get $y)))
    (local.set $x0 (f32.convert_i32_s (i32.add (local.get $xa) (global.get $gl_sw_r_dx))))
    (local.set $x1 (f32.convert_i32_s (i32.add (local.get $xb) (global.get $gl_sw_r_dx))))
    (local.set $y0 (f32.sub (f32.convert_i32_s (i32.add (local.get $y) (global.get $gl_sw_r_dy))) (f32.const 0.5)))
    (local.set $y1 (f32.add (local.get $y0) (f32.const 1)))
    (local.set $o (call $glg_vtx (i32.const 6)))
    (call $glg_v (local.get $o) (local.get $x0) (local.get $y0) (local.get $pa) (f32.const 1) (i32.const 0) (local.get $fa))
    (call $glg_v (i32.add (local.get $o) (i32.const 48)) (local.get $x1) (local.get $y0) (local.get $pb) (f32.const 1) (i32.const 0) (local.get $fb))
    (call $glg_v (i32.add (local.get $o) (i32.const 96)) (local.get $x0) (local.get $y1) (local.get $pa) (f32.const 1) (i32.const 0) (local.get $fa))
    (call $glg_v (i32.add (local.get $o) (i32.const 144)) (local.get $x1) (local.get $y0) (local.get $pb) (f32.const 1) (i32.const 0) (local.get $fb))
    (call $glg_v (i32.add (local.get $o) (i32.const 192)) (local.get $x1) (local.get $y1) (local.get $pb) (f32.const 1) (i32.const 0) (local.get $fb))
    (call $glg_v (i32.add (local.get $o) (i32.const 240)) (local.get $x0) (local.get $y1) (local.get $pa) (f32.const 1) (i32.const 0) (local.get $fa))
    (call $glg_stat (i32.const 2) (i32.const 1))
    (i32.const 1))

  ;; ---- clear and swap --------------------------------------------------------
  ;; glClear($mask), after $gl_sw_target. 1: the colour part is done here.
  (func $glg_clear (param $mask i32) (result i32)
    (local $st i32) (local $mode i32) (local $cm i32) (local $why i32) (local $view i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $full i32) (local $color i32)
    (local $depth i32) (local $gmask i32)
    (if (i32.or (i32.eqz (global.get $glg_on)) (global.get $glg_dead)) (then (return (i32.const 0))))
    (local.set $st (global.get $gl_sw_st))
    (local.set $mode (call $gl_color_selection (i32.const 0)))
    (local.set $color (i32.and (i32.ne (i32.and (local.get $mask) (i32.const 0x4000)) (i32.const 0))
      (i32.ne (local.get $mode) (i32.const 0))))
    (local.set $cm (select (i32.and (call $gl_color_mask) (i32.const 15)) (i32.const 0) (local.get $color)))
    (if (i32.eqz (local.get $cm)) (then (local.set $color (i32.const 0))))
    (local.set $depth (i32.and (i32.ne (i32.and (local.get $mask) (i32.const 0x100)) (i32.const 0))
      (i32.ne (global.get $gl_sw_zbuf) (i32.const 0))))
    (block $ok
      (local.set $why (i32.const 7)) (br_if $ok (global.get $gl_sw_bitmap))
      (local.set $why (i32.const 8)) (br_if $ok (i32.eqz (global.get $gl_sw_rt_obj)))
      (local.set $why (i32.const 17)) (br_if $ok (i32.eqz (global.get $gl_sw_flip_y)))
      (local.set $why (i32.const 0)) (br_if $ok (i32.eqz (local.get $color)))
      (local.set $why (i32.const 5)) (br_if $ok (call $gl_color_front (local.get $mode)))
      (local.set $why (i32.const 6)) (br_if $ok (call $gl_color_both (local.get $mode)))
      (local.set $why (i32.const 2)) (br_if $ok (i32.and (i32.ne (i32.and (local.get $cm) (i32.const 7)) (i32.const 0))
        (i32.ne (i32.and (local.get $cm) (i32.const 7)) (i32.const 7))))
      (local.set $why (i32.const 0)))
    (if (local.get $why) (then (call $glg_decline (local.get $why)) (return (i32.const 0))))
    (if (i32.eqz (call $glg_bind)) (then (return (i32.const 0))))
    (local.set $r (global.get $glg_w))
    (local.set $b (global.get $glg_hh))
    (local.set $full (i32.const 1))
    (if (i32.and (i32.load (local.get $st)) (i32.const 32)) (then
      (local.set $view (call $gl_sw_scissor_view))
      (if (i32.eqz (local.get $view)) (then (return (i32.const 0))))
      (if (i32.ne (local.get $view) (global.get $gl_sw_rt)) (then
        (local.set $full (i32.const 0))
        (local.set $l (global.get $gl_sw_sc_x))
        (local.set $t (global.get $gl_sw_sc_y))
        (local.set $r (i32.add (local.get $l) (load.field DxObject width (local.get $view))))
        (local.set $b (i32.add (local.get $t) (load.field DxObject height (local.get $view))))))))
    (if (i32.eqz (global.get $glg_gpu)) (then
      ;; A full opaque colour clear makes the back DIB irrelevant.
      (if (i32.and (i32.and (local.get $color) (local.get $full)) (i32.eq (local.get $cm) (i32.const 15)))
        (then (global.set $glg_back_cpu (i32.const 0))))
      (call $glg_enter (i32.and (local.get $depth) (local.get $full)))
      ;; Still software: the CPU clear lands on a DIB that must be current.
      (if (i32.and (local.get $color) (i32.eqz (global.get $glg_gpu))) (then
        (if (i32.and (local.get $full) (i32.eq (local.get $cm) (i32.const 15)))
          (then (global.set $glg_back_gpu (i32.const 0)))
          (else (call $glg_sync_back (i32.const 2))))))))
    (local.set $gmask (i32.or (select (i32.const 1) (i32.const 0) (i32.and (local.get $color) (global.get $glg_gpu)))
      (select (i32.const 2) (i32.const 0) (local.get $depth))))
    (if (local.get $gmask)
      (then (call $glg_clear_rec (local.get $gmask) (select (local.get $cm) (i32.const 15) (local.get $color))
        (global.get $gl_sw_clear_color) (call $glg_clear_z)
        (local.get $l) (local.get $t) (local.get $r) (local.get $b))))
    ;; The CPU fills depth too ($gl_sw_fill_depth runs after this).
    (if (local.get $depth) (then
      (if (local.get $full)
        (then
          (global.set $glg_z_gpu (i32.const 0))
          (global.set $glg_z_cpu (i32.const 0))
          (global.set $glg_zlost (i32.const 0)))
        (else (if (global.get $glg_gpu) (then (global.set $glg_z_gpu (i32.const 1))))))))
    (if (i32.and (local.get $color) (global.get $glg_gpu)) (then
      (global.set $glg_back_gpu (i32.const 1))
      (return (i32.const 1))))
    (if (local.get $color) (then (global.set $glg_back_cpu (i32.const 1))))
    (i32.const 0))

  ;; The window the drawable belongs to; 0 for none.
  (func $glg_hwnd (result i32)
    (local $w i32)
    (if (i32.eqz (global.get $gl_sw_drawable_node)) (then (return (i32.const 0))))
    (local.set $w (i32.load (global.get $gl_sw_drawable_node)))
    (select (local.get $w) (i32.const 0) (i32.gt_s (local.get $w) (i32.const 0))))

  ;; PRESENT $rt to the drawable's window; at most two in flight.
  (func $glg_present (param $rt i32)
    (local $h i32) (local $p i32) (local $seq i32) (local $hwnd i32) (local $rec i32)
    (local.set $hwnd (call $glg_hwnd))
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (local.set $h (global.get $glg_h))
    (call $glg_flush)
    (if (i32.and (i32.ne (global.get $glg_pseq0) (i32.const 0))
          (i32.lt_s (i32.sub (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing done_seq))) (global.get $glg_pseq0)) (i32.const 0)))
      (then
        (call $glg_stat (i32.const 12) (i32.const 1))
        (if (i32.ne (call $glg_kick (global.get $GPS_KICK_SYNC)) (i32.const 1)) (then (call $glg_fail (i32.const 4))))))
    (call $gps_mark (local.get $h) (global.get $glg_frame) (i32.const 0x474c4650))
    (local.set $p (call $glg_begin (global.get $GPS_OP_PRESENT) (size-of GpsPresent)))
    (store.field GpsPresent rt (local.get $p) (local.get $rt))
    (store.field GpsPresent gamma (local.get $p) (i32.const 0))
    (store.field GpsPresent x (local.get $p) (i32.const 0))
    (store.field GpsPresent y (local.get $p) (i32.const 0))
    (store.field GpsPresent w (local.get $p) (global.get $glg_w))
    (store.field GpsPresent h (local.get $p) (global.get $glg_hh))
    (store.field GpsPresent surface (local.get $p) (local.get $hwnd))
    (store.field GpsPresent dst_x (local.get $p) (i32.const 0))
    (store.field GpsPresent dst_y (local.get $p) (i32.const 0))
    (store.field GpsPresent stamp (local.get $p) (global.get $glg_frame))
    (local.set $seq (call $glg_end (local.get $p)))
    (global.set $glg_pseq0 (global.get $glg_pseq1))
    (global.set $glg_pseq1 (local.get $seq))
    ;; GDI touching the window now asks the host for the GPU picture first.
    (local.set $rec (call $gdi_window_surface_record (local.get $hwnd) (i32.const 0)))
    (if (local.get $rec) (then (i32.atomic.store offset=28 (local.get $rec) (i32.const 1))))
    (global.set $glg_presented (i32.const 1))
    (call $glg_stat (i32.const 4) (i32.const 1))
    (drop (call $glg_kick (global.get $GPS_KICK_ASYNC))))

  (func $glg_frame_end (param $gpu i32)
    (call $glg_stat (select (i32.const 10) (i32.const 11) (local.get $gpu)) (i32.const 1))
    (if (global.get $glg_declined) (then (call $glg_stat (i32.const 15) (i32.const 1))))
    (global.set $glg_armed (i32.eqz (global.get $glg_declined)))
    (global.set $glg_declined (i32.const 0))
    (global.set $glg_zwait (i32.const 0))
    (global.set $glg_frame (i32.add (global.get $glg_frame) (i32.const 1))))

  ;; SwapBuffers, before 09a8g's. 1: done here (a GPU frame).
  (func $glg_swap (result i32)
    (local $t i32)
    (if (i32.or (i32.eqz (global.get $glg_on)) (global.get $glg_dead)) (then (return (i32.const 0))))
    (if (i32.ne (global.get $glg_back_e) (global.get $gl_sw_rt)) (then (return (i32.const 0))))
    ;; A software frame that never touched the back still has its picture
    ;; on the executor.
    (if (i32.eqz (i32.or (global.get $glg_gpu)
          (i32.and (i32.ne (global.get $glg_back_gpu) (i32.const 0)) (i32.eqz (global.get $glg_back_cpu)))))
      (then (return (i32.const 0))))
    (call $glg_present (global.get $glg_back_id))
    (local.set $t (global.get $glg_back_id))
    (global.set $glg_back_id (global.get $glg_front_id))
    (global.set $glg_front_id (local.get $t))
    ;; The new back is cleared to (0,0,0,0), as 09a8g's swap does.
    (call $glg_clear_rec (i32.const 1) (i32.const 15) (i32.const 0) (f32.const 1)
      (i32.const 0) (i32.const 0) (global.get $glg_w) (global.get $glg_hh))
    (global.set $glg_back_gpu (i32.const 1))
    (global.set $glg_front_gpu (i32.const 1))
    (global.set $gl_sw_presents (i32.add (global.get $gl_sw_presents) (i32.const 1)))
    (call $glg_frame_end (i32.const 1))
    (i32.const 1))

  ;; After 09a8g's own swap (back copied to front, back zeroed): the front
  ;; goes up and is presented, and the executor back is zeroed to match.
  (func $glg_after_sw_swap
    (if (i32.or (i32.eqz (global.get $glg_on)) (global.get $glg_dead)) (then (return)))
    (if (i32.eqz (call $glg_bind)) (then (return)))
    (call $glg_upload_rt (global.get $glg_front_id) (global.get $glg_front_e))
    (call $glg_present (global.get $glg_front_id))
    (call $glg_clear_rec (i32.const 1) (i32.const 15) (i32.const 0) (f32.const 1)
      (i32.const 0) (i32.const 0) (global.get $glg_w) (global.get $glg_hh))
    (global.set $glg_back_cpu (i32.const 0))
    (global.set $glg_back_gpu (i32.const 0))
    (global.set $glg_front_gpu (i32.const 0))
    (call $glg_frame_end (i32.const 0)))
