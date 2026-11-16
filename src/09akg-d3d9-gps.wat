  ;; ---- D3D9 / D3D8 on GPU stream v2 (slices 9.5a/9.5b, on by default) -------
  ;; The D3D9 device -- and D3D8, which 09ac routes onto the same device code
  ;; -- also lowers its frames into GPS records on ring api 4. On unless a
  ;; host calls d3d9_gps_enable(0) (run.js --d3d9-gps=off); a host with no
  ;; executor answers the first kick with 0 and the arm turns itself off.
  ;; SHADOWED: the old
  ;; host path (opcodes 0x3000x, lib/d3d9-host.js) still executes every call,
  ;; so caps, the programmable gate, CreateDevice's failure without a GPU,
  ;; Reset and device loss are exactly what they were; the ring is fed only
  ;; after the old call reported success (1), from the same descriptor.
  ;;
  ;; Frames. A frame is GPU until something cannot be lowered: that is a
  ;; counted decline (d3d9_gps_stat 16 + reason) and the rest of the frame
  ;; is left to the old path, which presents it. A GPU frame is PRESENTed
  ;; from the ring and the old present (0x30002, which in software copies
  ;; the whole RT into the DIB) is skipped. After a decline the executor's
  ;; colour/depth/stencil are stale; the next frame is GPU again only once a
  ;; full-target Clear of each buffer the draws use has gone through
  ;; (reason 13 counts draws refused for that).
  ;;
  ;; Lowered: device targets (backbuffer RT, the bound depth surface as DS,
  ;; recreated on device change / Reset), Clear (viewport and scissor
  ;; clipped rects), draws of every Draw* entry point: the vertex stage is
  ;; POSITIONT (FVF XYZRHW, vs 0), the guest's vertex shader (core VS IR via
  ;; $d3d_shader_ir_canonicalize; D3D9 declaration or FVF layout; a D3D8
  ;; declaration's register map becomes the DCL-less shader's implicit
  ;; DCLs; c0..c255 as stage-0 CONSTS) or fixed-function T&L of an
  ;; untransformed FVF with lighting off (09aj cascade VS, matrices as
  ;; CONSTS). VB/IB draws are DRAWs from VBUF/IBUF copies of the 09ae
  ;; buffers, re-sent by their dirty range when locked; UP draws, fans
  ;; (expanded) and a negative base vertex copy the referenced range into
  ;; the arena as DRAW_UP;
  ;; textures (09ae decode to A8B8G8R8, re-uploaded per level when the
  ;; level's content seq moves), samplers, RASTER (blend + ops + separate
  ;; alpha, colour write mask, depth, stencil incl. two-sided, cull,
  ;; scissor, alpha test, vertex fog, depth bias), fixed-function pixel
  ;; stages (09aj cascade5/6, PS only) and guest pixel shaders, both through
  ;; $d3d_shader_ir_canonicalize, guest PS constants as CONSTS, Present.
  ;;
  ;; Decline reasons (d3d9_gps_stat 16 + r), and what each waits on:
  ;;   1 (retired in 9.5b: vertex shaders lower)
  ;;   2 declaration with fixed-function T&L   09aj registers from a decl
  ;;   3 no vertex pointer / bad stride   -
  ;;   4 offscreen colour target          RT objects for color surfaces
  ;;   5 render-target texture            RT-as-texture residency
  ;;   6 cube texture                     cube upload (executor has CUBE)
  ;;   7 bump-env stage                   bump constants into CONSTS
  ;;   8 canonicalizer declined           09af1
  ;;   9 09aj fixed lowering rejected     09aj
  ;;  10 texture not decodable/locked     09ae decode
  ;;  11 table (pixel) fog                fog table texture from start/end
  ;;  12 texture transform / texgen (or a  09aj rows +64 matrices as CONSTS
  ;;     non-default TEXCOORDINDEX behind a programmable VS with fixed PS)
  ;;  13 executor target stale after a decline (waits for a full Clear)
  ;;  14 blend factor BLENDFACTOR/SRCCOLOR2  executor blend-constant state
  ;;  15 point / wireframe fill           executor fill modes
  ;;  16 flat shading                     provoking-vertex expansion
  ;;  17 W-buffer                         D3D9 W depth mapping
  ;;  18 stencil without D24S8            -
  ;;  19 depth surface size != target     -
  ;;  20 draw too large for the arena     split draws
  ;;  21 index outside [min, min+num)     -
  ;;  22 point sprites / WRAPn / sRGB write  -
  ;;  23 backbuffer format not convertible -
  ;;  24 POSITIONT stage reads a texcoord set the FVF lacks
  ;;  25 texture over 2048
  ;;  26 primitive type out of range
  ;;  27 vertex input not lowerable: declaration element off stream 0, type
  ;;     past D3DCOLOR, POSITIONT in a declaration; XYZB/XYZW FVF; vertex
  ;;     blending; user clip planes
  ;;  28 fixed T&L with lighting on      DLT1 lights/material from state
  ;; Readback sites (stat 48 + s): 0 LockRect of the back buffer, 1 GetDC
  ;; on the back buffer, 2 GetRenderTargetData, 3 CLI capture
  ;; (d3d9_gps_sync_front). Nothing else reads the executor back.
  ;; Stats: 0 DRAW_UPs, 1 primitives, 2 clears, 3 ring presents, 4 GPU
  ;; frames, 5 old-path frames, 6 readbacks, 7 RT uploads (CPU wrote the
  ;; back buffer), 8 texture level uploads, 9 texture hits, 10 shaders,
  ;; 11 syncs, 12 declines, 13 old path did not report success (not
  ;; lowered), 14 ring opens, 15 no executor (arm dead), 16.. reasons,
  ;; 72 buffer uploads, 73 buffer hits, 74 DRAWs from buffers.
  ;;
  ;; Block $d9g_mem: +0 stats (128 words), +512 RASTER stage, +608 its
  ;; cache, +704 viewport cache (24), +768 bind cache {n, 6 x {slot, tex,
  ;; sampler}}, +864 PS consts cache (128), +1024 layout cache 32 x {fvf,
  ;; stride, texmap, id}, +1536 sampler cache 32 x {k0, k1, k2, k3, id, -},
  ;; +2304 guest PS cache 32 x {ptr, len, sum, id}, +2816 clear rect
  ;; scratch, +2848 BIND staging (6 x 12), +4096 fixed scratch (DFX1 288 +
  ;; 6 x 192 rows), +5632 fixed PS cache 32 x {id, len, key 1440}, +52224
  ;; texture cache 256 x 80 {t, id, w, h, levels, fmt, seq[13], -},
  ;; +72704 buffer cache 64 x {buf, seq, len, id}, +73728 VS constant
  ;; shadow 256 x 16, +77824 shadow valid, +77840 fixed VS c0..c11
  ;; staging, +78080 fixed T&L cache 16 x {vs, ps, len, key 1440},
  ;; +101312 guest VS cache 32 x {ptr, len, sum, d3d8 decl, id},
  ;; +101952 implicit-DCL table (16 words, see 09af1 $vc_implicit_dcl).

  (global $D9G_MEM_SIZE i32 (i32.const 102400))
  (global $d9g_on (mut i32) (i32.const 1))
  (global $d9g_dead (mut i32) (i32.const 0))
  (global $d9g_h (mut i32) (i32.const 0))
  (global $d9g_mem (mut i32) (i32.const 0))
  (global $d9g_kick_wp (mut i32) (i32.const 0))
  (global $d9g_kick_ah (mut i32) (i32.const 0))
  (global $d9g_next_id (mut i32) (i32.const 0))
  ;; Device targets.
  (global $d9g_dev (mut i32) (i32.const 0))
  (global $d9g_rt (mut i32) (i32.const 0))
  (global $d9g_rt_w (mut i32) (i32.const 0))
  (global $d9g_rt_h (mut i32) (i32.const 0))
  (global $d9g_rt_fmt (mut i32) (i32.const 0))
  (global $d9g_ds (mut i32) (i32.const 0))
  (global $d9g_ds_ptr (mut i32) (i32.const 0))
  (global $d9g_ds_d24 (mut i32) (i32.const 0))
  (global $d9g_ds_bad (mut i32) (i32.const 0))
  (global $d9g_cstale (mut i32) (i32.const 1))
  (global $d9g_zstale (mut i32) (i32.const 6))
  ;; Frame: 0 nothing lowered yet, 1 GPU, 2 declined (old path finishes it).
  (global $d9g_mode (mut i32) (i32.const 0))
  (global $d9g_frame (mut i32) (i32.const 0))
  (global $d9g_pseq0 (mut i32) (i32.const 0))
  (global $d9g_pseq1 (mut i32) (i32.const 0))
  (global $d9g_c_color (mut i32) (i32.const -1))
  (global $d9g_c_depth (mut i32) (i32.const -1))
  (global $d9g_rr_shader (mut i32) (i32.const 0))
  (global $d9g_rr_gps (mut i32) (i32.const 0))
  (global $d9g_rr_layout (mut i32) (i32.const 0))
  (global $d9g_rr_sampler (mut i32) (i32.const 0))
  (global $d9g_rr_buffer (mut i32) (i32.const 0))
  (global $d9g_rr_vs (mut i32) (i32.const 0))
  (global $d9g_rr_tl (mut i32) (i32.const 0))
  (global $d9g_tl_ps (mut i32) (i32.const 0))
  ;; Per call: program state and render-state block (wasm).
  (global $d9g_pw (mut i32) (i32.const 0))
  (global $d9g_rsw (mut i32) (i32.const 0))

  (func $d9g_fail (param $code i32)
    (call $host_log_i32 (i32.const 0x44394750))
    (call $host_log_i32 (local.get $code))
    (unreachable))

  (func $d9g_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $d9g_mem)) (then
      (local.set $g (call $gps_alloc (global.get $D9G_MEM_SIZE)))
      (if (i32.eqz (local.get $g)) (then (call $d9g_fail (i32.const 1))))
      (global.set $d9g_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $d9g_mem) (i32.const 0) (global.get $D9G_MEM_SIZE))))
    (global.get $d9g_mem))

  (func $d9g_stat (param $i i32) (param $n i32)
    (local $a i32)
    (local.set $a (i32.add (call $d9g_m) (i32.shl (local.get $i) (i32.const 2))))
    (i32.store (local.get $a) (i32.add (i32.load (local.get $a)) (local.get $n))))

  (func (export "d3d9_gps_enable") (param $on i32)
    (global.set $d9g_on (i32.ne (local.get $on) (i32.const 0))))
  (func (export "d3d9_gps_stat") (param $i i32) (result i32)
    (if (i32.or (i32.eqz (global.get $d9g_mem)) (i32.ge_u (local.get $i) (i32.const 128)))
      (then (return (i32.const 0))))
    (i32.load (i32.add (global.get $d9g_mem) (i32.shl (local.get $i) (i32.const 2)))))
  (func (export "d3d9_gps_active") (result i32)
    (i32.and (i32.ne (global.get $d9g_on) (i32.const 0)) (i32.eqz (global.get $d9g_dead))))

  ;; ---- ring plumbing ---------------------------------------------------------
  (func $d9g_kick (param $mode i32) (result i32)
    (global.set $d9g_kick_wp (load.field.memarg GpsRing write_pos (global.get $d9g_h)))
    (global.set $d9g_kick_ah (load.field.memarg GpsRing arena_head (global.get $d9g_h)))
    (call $gps_kick (global.get $d9g_h) (local.get $mode)))

  (func $d9g_begin (param $op i32) (param $n i32) (result i32)
    (local $h i32)
    (local.set $h (global.get $d9g_h))
    (if (i32.or
          (i32.ge_u (i32.sub (load.field.memarg GpsRing write_pos (local.get $h)) (global.get $d9g_kick_wp))
            (i32.const 0x40000))
          (i32.ge_u (i32.sub (load.field.memarg GpsRing arena_head (local.get $h)) (global.get $d9g_kick_ah))
            (i32.const 0x200000)))
      (then (drop (call $d9g_kick (global.get $GPS_KICK_ASYNC)))))
    (call $gps_begin (local.get $h) (local.get $op) (local.get $n)))

  (func $d9g_end (param $p i32) (result i32)
    (call $gps_end (global.get $d9g_h) (local.get $p) (i32.const 0)))

  (func $d9g_id (result i32)
    (global.set $d9g_next_id (i32.add (global.get $d9g_next_id) (i32.const 1)))
    (global.get $d9g_next_id))

  (func $d9g_arena (param $n i32) (result i32)
    (call $gps_arena_alloc (global.get $d9g_h) (local.get $n)))
  (func $d9g_aptr (param $pos i32) (result i32)
    (call $gps_arena_ptr (global.get $d9g_h) (local.get $pos)))

  (func $d9g_release (param $id i32)
    (if (i32.eqz (local.get $id)) (then (return)))
    ;; A released id may sit in the last BIND: force the next one out.
    (i32.store offset=768 (call $d9g_m) (i32.const -1))
    (call $gps_release (global.get $d9g_h) (local.get $id)))

  ;; The ring, opened on first use. 0 = no executor: the arm is off for the
  ;; run and the old path keeps every frame.
  (func $d9g_open (result i32)
    (local $h i32)
    (if (global.get $d9g_h) (then (return (i32.const 1))))
    (if (global.get $d9g_dead) (then (return (i32.const 0))))
    (drop (call $d9g_m))
    (local.set $h (call $gps_ring_open (i32.const 4) (i32.const 0x100000) (i32.const 0x800000)))
    (if (i32.eqz (local.get $h)) (then (call $d9g_fail (i32.const 2))))
    (global.set $d9g_h (local.get $h))
    (call $d9g_stat (i32.const 14) (i32.const 1))
    (if (i32.ne (call $d9g_kick (global.get $GPS_KICK_SYNC)) (i32.const 1)) (then
      (call $gps_ring_reset (local.get $h))
      (global.set $d9g_h (i32.const 0))
      (global.set $d9g_dead (i32.const 1))
      (call $d9g_stat (i32.const 15) (i32.const 1))
      (return (i32.const 0))))
    (i32.store offset=768 (call $d9g_m) (i32.const -1))
    (i32.const 1))

  ;; ---- state access ----------------------------------------------------------
  (func $d9g_rs (param $id i32) (result i32)
    (i32.load (i32.add (global.get $d9g_rsw) (i32.add (i32.const 256) (i32.shl (local.get $id) (i32.const 2))))))
  (func $d9g_tss (param $stage i32) (param $off i32) (result i32)
    (i32.load (i32.add (global.get $d9g_pw)
      (i32.add (i32.add (i32.const 20664) (i32.mul (local.get $stage) (i32.const 132))) (local.get $off)))))
  (func $d9g_samp (param $stage i32) (param $off i32) (result i32)
    (i32.load (i32.add (global.get $d9g_pw)
      (i32.add (call $d3d9_sampler_offset (local.get $stage)) (local.get $off)))))
  (func $d9g_tex_ptr (param $stage i32) (result i32)
    (i32.load (i32.add (global.get $d9g_pw) (call $d3d9_texture_offset (local.get $stage)))))

  ;; The descriptor scratch the old call just used (not rebuilt: a parked
  ;; call resumes with it intact).
  (func $d9g_desc (param $device i32) (result i32)
    (local $state i32)
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (i32.add (call $g2w (local.get $state)) (i32.const 1744)))

  (func $d9g_enter (param $desc i32)
    (global.set $d9g_pw (call $g2w (i32.load offset=4 (local.get $desc))))
    (global.set $d9g_rsw (call $g2w (i32.load offset=40 (local.get $desc)))))

  ;; ARGB (D3DCOLOR) -> R | G<<8 | B<<16 | A<<24.
  (func $d9g_rgba (param $c i32) (result i32)
    (i32.or (i32.and (local.get $c) (i32.const 0xff00ff00))
      (i32.or (i32.and (i32.shr_u (local.get $c) (i32.const 16)) (i32.const 255))
        (i32.shl (i32.and (local.get $c) (i32.const 255)) (i32.const 16)))))

  ;; D3DFORMAT of a colour buffer -> d3g pixel code | bpp << 8 (0 = none).
  (func $d9g_pix (param $f i32) (result i32)
    (if (i32.eq (local.get $f) (i32.const 21)) (then (return (i32.const 0x2005))))
    (if (i32.eq (local.get $f) (i32.const 22)) (then (return (i32.const 0x2000))))
    (if (i32.eq (local.get $f) (i32.const 23)) (then (return (i32.const 0x1001))))
    (if (i32.eq (local.get $f) (i32.const 24)) (then (return (i32.const 0x1002))))
    (if (i32.eq (local.get $f) (i32.const 25)) (then (return (i32.const 0x1003))))
    (if (i32.eq (local.get $f) (i32.const 26)) (then (return (i32.const 0x1004))))
    (i32.const 0))
  (func $d9g_has_alpha (param $f i32) (result i32)
    (i32.or (i32.eq (local.get $f) (i32.const 21))
      (i32.or (i32.eq (local.get $f) (i32.const 25)) (i32.eq (local.get $f) (i32.const 26)))))

  (func $d9g_decline (param $why i32)
    (call $d9g_stat (i32.const 12) (i32.const 1))
    (call $d9g_stat (i32.add (i32.const 16) (local.get $why)) (i32.const 1))
    (global.set $d9g_mode (i32.const 2))
    (global.set $d9g_cstale (i32.const 1))
    (global.set $d9g_zstale (i32.const 6)))

  ;; ---- targets ---------------------------------------------------------------
  (func $d9g_drop_targets
    (call $d9g_release (global.get $d9g_rt))
    (call $d9g_release (global.get $d9g_ds))
    (global.set $d9g_rt (i32.const 0))
    (global.set $d9g_ds (i32.const 0))
    (global.set $d9g_ds_ptr (i32.const 0))
    (global.set $d9g_dev (i32.const 0))
    (global.set $d9g_cstale (i32.const 1))
    (global.set $d9g_zstale (i32.const 6))
    (global.set $d9g_c_color (i32.const -1))
    (global.set $d9g_c_depth (i32.const -1)))

  ;; Make the device's back buffer (and bound depth surface) the executor
  ;; targets. 0, or a decline reason.
  (func $d9g_bind (param $device i32) (param $desc i32) (result i32)
    (local $w i32) (local $hgt i32) (local $fmt i32) (local $p i32) (local $pw i32) (local $dfmt i32)
    (local $t i32)
    (local.set $w (i32.load offset=12 (local.get $desc)))
    (local.set $hgt (i32.load offset=16 (local.get $desc)))
    (local.set $fmt (call $d3d9_backbuffer_format (local.get $device)))
    (if (i32.load offset=22020 (global.get $d9g_pw)) (then (return (i32.const 4))))
    (if (i32.eqz (call $d9g_pix (local.get $fmt))) (then (return (i32.const 23))))
    (if (i32.or (i32.or (i32.gt_u (local.get $w) (i32.const 4096)) (i32.gt_u (local.get $hgt) (i32.const 4096)))
          (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt))))
      (then (return (i32.const 23))))
    (if (i32.or (i32.ne (global.get $d9g_dev) (local.get $device))
          (i32.or (i32.or (i32.ne (global.get $d9g_rt_w) (local.get $w)) (i32.ne (global.get $d9g_rt_h) (local.get $hgt)))
            (i32.or (i32.ne (global.get $d9g_rt_fmt) (local.get $fmt)) (i32.eqz (global.get $d9g_rt)))))
      (then
        (call $d9g_drop_targets)
        (global.set $d9g_dev (local.get $device))
        (global.set $d9g_rt_w (local.get $w))
        (global.set $d9g_rt_h (local.get $hgt))
        (global.set $d9g_rt_fmt (local.get $fmt))
        (global.set $d9g_rt (call $d9g_id))
        (call $gps_create (global.get $d9g_h) (global.get $d9g_rt) (global.get $GPS_KIND_RT)
          (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))))
    ;; Depth surface: +36 id, +20 w, +24 h, +28 format.
    (local.set $p (i32.load offset=21752 (global.get $d9g_pw)))
    (if (i32.ne (local.get $p) (global.get $d9g_ds_ptr)) (then
      (call $d9g_release (global.get $d9g_ds))
      (global.set $d9g_ds (i32.const 0))
      (global.set $d9g_ds_bad (i32.const 0))
      (global.set $d9g_ds_ptr (local.get $p))
      (global.set $d9g_zstale (i32.const 6))
      (if (local.get $p) (then
        (local.set $pw (call $g2w (local.get $p)))
        (if (i32.or (i32.ne (i32.load offset=20 (local.get $pw)) (local.get $w))
              (i32.ne (i32.load offset=24 (local.get $pw)) (local.get $hgt)))
          (then (global.set $d9g_ds_bad (i32.const 1)))
          (else
            (local.set $dfmt (i32.load offset=28 (local.get $pw)))
            (global.set $d9g_ds_d24 (i32.eqz (i32.or (i32.eq (local.get $dfmt) (i32.const 70))
              (i32.eq (local.get $dfmt) (i32.const 80)))))
            (global.set $d9g_ds (call $d9g_id))
            (call $gps_create (global.get $d9g_h) (global.get $d9g_ds) (global.get $GPS_KIND_DS)
              (select (global.get $GPS_FMT_D24S8) (global.get $GPS_FMT_D16) (global.get $d9g_ds_d24))
              (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))))))))
    (if (i32.or (i32.ne (global.get $d9g_c_color) (global.get $d9g_rt))
          (i32.ne (global.get $d9g_c_depth) (global.get $d9g_ds)))
      (then
        (local.set $t (call $d9g_begin (global.get $GPS_OP_TARGETS) (size-of GpsTargets)))
        (store.field GpsTargets color (local.get $t) (global.get $d9g_rt))
        (store.field GpsTargets depth (local.get $t) (global.get $d9g_ds))
        (drop (call $d9g_end (local.get $t)))
        (global.set $d9g_c_color (global.get $d9g_rt))
        (global.set $d9g_c_depth (global.get $d9g_ds))
        ;; TARGETS reset the executor viewport.
        (i32.store offset=704 (call $d9g_m) (i32.const -1))))
    (i32.const 0))

  ;; The device viewport (+21728 x, y, w, h; w = 0 is the whole target),
  ;; clamped to the target, into $out (x, y, r, b).
  (func $d9g_vp_rect (param $out i32)
    (local $x i32) (local $y i32) (local $w i32) (local $hgt i32)
    (local.set $x (i32.load offset=21728 (global.get $d9g_pw)))
    (local.set $y (i32.load offset=21732 (global.get $d9g_pw)))
    (local.set $w (i32.load offset=21736 (global.get $d9g_pw)))
    (local.set $hgt (i32.load offset=21740 (global.get $d9g_pw)))
    (if (i32.eqz (local.get $w)) (then
      (local.set $x (i32.const 0)) (local.set $y (i32.const 0))
      (local.set $w (global.get $d9g_rt_w)) (local.set $hgt (global.get $d9g_rt_h))))
    (if (i32.gt_u (local.get $x) (global.get $d9g_rt_w)) (then (local.set $x (global.get $d9g_rt_w))))
    (if (i32.gt_u (local.get $y) (global.get $d9g_rt_h)) (then (local.set $y (global.get $d9g_rt_h))))
    (if (i32.gt_u (local.get $w) (i32.sub (global.get $d9g_rt_w) (local.get $x)))
      (then (local.set $w (i32.sub (global.get $d9g_rt_w) (local.get $x)))))
    (if (i32.gt_u (local.get $hgt) (i32.sub (global.get $d9g_rt_h) (local.get $y)))
      (then (local.set $hgt (i32.sub (global.get $d9g_rt_h) (local.get $y)))))
    (i32.store (local.get $out) (local.get $x))
    (i32.store offset=4 (local.get $out) (local.get $y))
    (i32.store offset=8 (local.get $out) (i32.add (local.get $x) (local.get $w)))
    (i32.store offset=12 (local.get $out) (i32.add (local.get $y) (local.get $hgt))))

  ;; Intersect rect $a (l, t, r, b) with the scissor when it is enabled.
  (func $d9g_scissor_clip (param $a i32)
    (local $s i32)
    (if (i32.eqz (call $d9g_rs (i32.const 174))) (then (return)))
    (local.set $s (i32.add (global.get $d9g_pw) (i32.const 22000)))
    (if (i32.gt_s (i32.load (local.get $s)) (i32.load (local.get $a)))
      (then (i32.store (local.get $a) (i32.load (local.get $s)))))
    (if (i32.gt_s (i32.load offset=4 (local.get $s)) (i32.load offset=4 (local.get $a)))
      (then (i32.store offset=4 (local.get $a) (i32.load offset=4 (local.get $s)))))
    (if (i32.lt_s (i32.load offset=8 (local.get $s)) (i32.load offset=8 (local.get $a)))
      (then (i32.store offset=8 (local.get $a) (i32.load offset=8 (local.get $s)))))
    (if (i32.lt_s (i32.load offset=12 (local.get $s)) (i32.load offset=12 (local.get $a)))
      (then (i32.store offset=12 (local.get $a) (i32.load offset=12 (local.get $s))))))

  ;; VIEWPORT, re-sent only when it changed. POSITIONT z is not remapped.
  (func $d9g_viewport
    (local $m i32) (local $r i32) (local $p i32)
    (local.set $m (call $d9g_m))
    (local.set $r (i32.add (local.get $m) (i32.const 728)))
    (call $d9g_vp_rect (local.get $r))
    (if (i32.and (i32.eq (i32.load offset=704 (local.get $m)) (i32.load (local.get $r)))
          (i32.and (i32.eq (i32.load offset=708 (local.get $m)) (i32.load offset=4 (local.get $r)))
            (i32.and (i32.eq (i32.load offset=712 (local.get $m)) (i32.load offset=8 (local.get $r)))
              (i32.eq (i32.load offset=716 (local.get $m)) (i32.load offset=12 (local.get $r))))))
      (then (return)))
    (memory.copy (i32.add (local.get $m) (i32.const 704)) (local.get $r) (i32.const 16))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_VIEWPORT) (size-of GpsViewport)))
    (store.field GpsViewport x (local.get $p) (i32.load (local.get $r)))
    (store.field GpsViewport y (local.get $p) (i32.load offset=4 (local.get $r)))
    (store.field GpsViewport w (local.get $p) (i32.sub (i32.load offset=8 (local.get $r)) (i32.load (local.get $r))))
    (store.field GpsViewport h (local.get $p) (i32.sub (i32.load offset=12 (local.get $r)) (i32.load offset=4 (local.get $r))))
    (store.field GpsViewport zmin (local.get $p) (f32.const 0))
    (store.field GpsViewport zmax (local.get $p) (f32.const 1))
    (drop (call $d9g_end (local.get $p))))

  ;; ---- RASTER ----------------------------------------------------------------
  ;; D3DBLEND 1..11 pass; BOTHSRCALPHA/BOTHINVSRCALPHA are expanded by the
  ;; caller; anything else is reason 14 (-1 here).
  (func $d9g_factor_ok (param $f i32) (result i32)
    (i32.and (i32.ge_u (local.get $f) (i32.const 1)) (i32.le_u (local.get $f) (i32.const 11))))

  (func $d9g_cmp (param $f i32) (result i32)
    (select (local.get $f) (i32.const 8)
      (i32.and (i32.ge_u (local.get $f) (i32.const 1)) (i32.le_u (local.get $f) (i32.const 8)))))
  (func $d9g_sop (param $f i32) (result i32)
    (select (local.get $f) (i32.const 1)
      (i32.and (i32.ge_u (local.get $f) (i32.const 1)) (i32.le_u (local.get $f) (i32.const 8)))))

  (func $d9g_raster (param $depth i32) (param $stencil i32) (param $fog i32) (result i32)
    (local $m i32) (local $s i32) (local $p i32) (local $src i32) (local $dst i32)
    (local $sa i32) (local $da i32) (local $op i32) (local $opa i32) (local $cull i32) (local $r i32)
    (local.set $m (call $d9g_m))
    (local.set $s (i32.add (local.get $m) (i32.const 512)))
    (memory.fill (local.get $s) (i32.const 0) (i32.const 96))
    (store.field GpsRaster depth_mode (local.get $s) (local.get $depth))
    (store.field GpsRaster zfunc (local.get $s) (call $d9g_cmp (call $d9g_rs (i32.const 23))))
    (store.field GpsRaster zwrite (local.get $s)
      (i32.and (local.get $depth) (i32.ne (call $d9g_rs (i32.const 14)) (i32.const 0))))
    (local.set $cull (call $d9g_rs (i32.const 22)))
    (store.field GpsRaster cull (local.get $s)
      (select (local.get $cull) (i32.const 1)
        (i32.and (i32.ge_u (local.get $cull) (i32.const 1)) (i32.le_u (local.get $cull) (i32.const 3)))))
    (if (call $d9g_rs (i32.const 27)) (then
      (local.set $src (call $d9g_rs (i32.const 19)))
      (local.set $dst (call $d9g_rs (i32.const 20)))
      (if (i32.eq (local.get $src) (i32.const 12)) (then (local.set $src (i32.const 5)) (local.set $dst (i32.const 6))))
      (if (i32.eq (local.get $src) (i32.const 13)) (then (local.set $src (i32.const 6)) (local.set $dst (i32.const 5))))
      (local.set $op (call $d9g_rs (i32.const 171)))
      (local.set $sa (local.get $src)) (local.set $da (local.get $dst)) (local.set $opa (local.get $op))
      (if (call $d9g_rs (i32.const 206)) (then
        (local.set $sa (call $d9g_rs (i32.const 207)))
        (local.set $da (call $d9g_rs (i32.const 208)))
        (local.set $opa (call $d9g_rs (i32.const 209)))
        (if (i32.eq (local.get $sa) (i32.const 12)) (then (local.set $sa (i32.const 5)) (local.set $da (i32.const 6))))
        (if (i32.eq (local.get $sa) (i32.const 13)) (then (local.set $sa (i32.const 6)) (local.set $da (i32.const 5))))))
      (if (i32.eqz (i32.and (i32.and (call $d9g_factor_ok (local.get $src)) (call $d9g_factor_ok (local.get $dst)))
            (i32.and (call $d9g_factor_ok (local.get $sa)) (call $d9g_factor_ok (local.get $da)))))
        (then (return (i32.const 14))))
      (store.field GpsRaster blend (local.get $s) (i32.const 1))
      (store.field GpsRaster src_rgb (local.get $s) (local.get $src))
      (store.field GpsRaster dst_rgb (local.get $s) (local.get $dst))
      (store.field GpsRaster src_alpha (local.get $s) (local.get $sa))
      (store.field GpsRaster dst_alpha (local.get $s) (local.get $da))
      (store.field GpsRaster blend_op (local.get $s)
        (select (local.get $op) (i32.const 1)
          (i32.and (i32.ge_u (local.get $op) (i32.const 1)) (i32.le_u (local.get $op) (i32.const 5)))))
      (store.field GpsRaster blend_op_alpha (local.get $s)
        (select (local.get $opa) (i32.const 1)
          (i32.and (i32.ge_u (local.get $opa) (i32.const 1)) (i32.le_u (local.get $opa) (i32.const 5)))))))
    (if (i32.eqz (call $d9g_rs (i32.const 27))) (then
      (store.field GpsRaster blend_op (local.get $s) (i32.const 1))
      (store.field GpsRaster blend_op_alpha (local.get $s) (i32.const 1))))
    (if (call $d9g_rs (i32.const 15))
      (then
        (store.field GpsRaster alpha_func (local.get $s) (call $d9g_cmp (call $d9g_rs (i32.const 25))))
        (store.field GpsRaster alpha_ref (local.get $s) (i32.and (call $d9g_rs (i32.const 24)) (i32.const 255))))
      (else (store.field GpsRaster alpha_func (local.get $s) (i32.const 8))))
    ;; An X8 / 565 / X1 target has no alpha to write; its alpha stays 255.
    (store.field GpsRaster colormask (local.get $s)
      (i32.and (i32.and (call $d9g_rs (i32.const 168)) (i32.const 15))
        (select (i32.const 15) (i32.const 7) (call $d9g_has_alpha (global.get $d9g_rt_fmt)))))
    (store.field GpsRaster fog_mode (local.get $s) (select (global.get $GPS_FOG_VERTEX_ALPHA) (i32.const 0) (local.get $fog)))
    (store.field GpsRaster fill (local.get $s) (i32.const 3))
    (store.field GpsRaster fog_color (local.get $s) (select (call $d9g_rgba (call $d9g_rs (i32.const 34))) (i32.const 0) (local.get $fog)))
    (local.set $r (i32.add (local.get $m) (i32.const 744)))
    (i32.store (local.get $r) (i32.const 0))
    (i32.store offset=4 (local.get $r) (i32.const 0))
    (i32.store offset=8 (local.get $r) (global.get $d9g_rt_w))
    (i32.store offset=12 (local.get $r) (global.get $d9g_rt_h))
    (call $d9g_scissor_clip (local.get $r))
    (if (i32.lt_s (i32.load offset=8 (local.get $r)) (i32.load (local.get $r)))
      (then (i32.store offset=8 (local.get $r) (i32.load (local.get $r)))))
    (if (i32.lt_s (i32.load offset=12 (local.get $r)) (i32.load offset=4 (local.get $r)))
      (then (i32.store offset=12 (local.get $r) (i32.load offset=4 (local.get $r)))))
    (store.field GpsRaster scissor_left (local.get $s) (i32.load (local.get $r)))
    (store.field GpsRaster scissor_top (local.get $s) (i32.load offset=4 (local.get $r)))
    (store.field GpsRaster scissor_right (local.get $s) (i32.load offset=8 (local.get $r)))
    (store.field GpsRaster scissor_bottom (local.get $s) (i32.load offset=12 (local.get $r)))
    (if (local.get $stencil) (then
      (store.field GpsRaster stencil_enable (local.get $s) (i32.const 1))
      (store.field GpsRaster two_sided (local.get $s) (i32.ne (call $d9g_rs (i32.const 185)) (i32.const 0)))
      (store.field GpsRaster stencil_func (local.get $s) (call $d9g_cmp (call $d9g_rs (i32.const 56))))
      (store.field GpsRaster stencil_fail (local.get $s) (call $d9g_sop (call $d9g_rs (i32.const 53))))
      (store.field GpsRaster stencil_zfail (local.get $s) (call $d9g_sop (call $d9g_rs (i32.const 54))))
      (store.field GpsRaster stencil_pass (local.get $s) (call $d9g_sop (call $d9g_rs (i32.const 55))))
      (store.field GpsRaster ccw_func (local.get $s) (call $d9g_cmp (call $d9g_rs (i32.const 189))))
      (store.field GpsRaster ccw_fail (local.get $s) (call $d9g_sop (call $d9g_rs (i32.const 186))))
      (store.field GpsRaster ccw_zfail (local.get $s) (call $d9g_sop (call $d9g_rs (i32.const 187))))
      (store.field GpsRaster ccw_pass (local.get $s) (call $d9g_sop (call $d9g_rs (i32.const 188))))
      (store.field GpsRaster stencil_ref (local.get $s) (i32.and (call $d9g_rs (i32.const 57)) (i32.const 255)))
      (store.field GpsRaster stencil_mask (local.get $s) (i32.and (call $d9g_rs (i32.const 58)) (i32.const 255)))
      (store.field GpsRaster stencil_wmask (local.get $s) (i32.and (call $d9g_rs (i32.const 59)) (i32.const 255)))))
    (if (local.get $depth) (then
      (store.field GpsRaster z_bias (local.get $s) (f32.reinterpret_i32 (call $d9g_rs (i32.const 195))))
      (store.field GpsRaster slope_bias (local.get $s) (f32.reinterpret_i32 (call $d9g_rs (i32.const 175))))))
    (if (call $d3g_row_eq (local.get $s) (i32.add (local.get $m) (i32.const 608)) (i32.const 96))
      (then (if (i32.load offset=760 (local.get $m)) (then (return (i32.const 0))))))
    (i32.store offset=760 (local.get $m) (i32.const 1))
    (memory.copy (i32.add (local.get $m) (i32.const 608)) (local.get $s) (i32.const 96))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_RASTER) (i32.const 96)))
    (memory.copy (local.get $p) (local.get $s) (i32.const 96))
    (drop (call $d9g_end (local.get $p)))
    (i32.const 0))

  ;; ---- samplers --------------------------------------------------------------
  (func $d9g_filter (param $f i32) (result i32)
    (select (i32.const 1) (i32.const 2) (i32.le_u (local.get $f) (i32.const 1))))
  (func $d9g_addr (param $a i32) (result i32)
    (select (local.get $a) (i32.const 1)
      (i32.and (i32.ge_u (local.get $a) (i32.const 1)) (i32.le_u (local.get $a) (i32.const 5)))))

  (func $d9g_sampler (param $stage i32) (param $base_lod i32) (result i32)
    (local $k0 i32) (local $k1 i32) (local $k2 i32) (local $k3 i32) (local $i i32) (local $e i32)
    (local $id i32) (local $p i32) (local $mip i32) (local $max i32)
    (local.set $mip (call $d9g_samp (local.get $stage) (i32.const 28)))
    (local.set $mip (select (i32.const 0) (select (i32.const 1) (i32.const 2) (i32.eq (local.get $mip) (i32.const 1)))
      (i32.eqz (local.get $mip))))
    (local.set $max (call $d9g_samp (local.get $stage) (i32.const 36)))
    (if (i32.lt_u (local.get $max) (local.get $base_lod)) (then (local.set $max (local.get $base_lod))))
    (if (i32.gt_u (local.get $max) (i32.const 15)) (then (local.set $max (i32.const 15))))
    (local.set $k0 (i32.or
      (i32.or (call $d9g_addr (call $d9g_samp (local.get $stage) (i32.const 4)))
        (i32.shl (call $d9g_addr (call $d9g_samp (local.get $stage) (i32.const 8))) (i32.const 8)))
      (i32.or (i32.shl (call $d9g_filter (call $d9g_samp (local.get $stage) (i32.const 24))) (i32.const 16))
        (i32.shl (call $d9g_filter (call $d9g_samp (local.get $stage) (i32.const 20))) (i32.const 24)))))
    (local.set $k1 (i32.or (i32.or (local.get $mip) (i32.shl (local.get $max) (i32.const 8))) (i32.const 0x80000000)))
    (local.set $k2 (call $d9g_samp (local.get $stage) (i32.const 32)))
    (local.set $k3 (call $d9g_rgba (call $d9g_samp (local.get $stage) (i32.const 16))))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1536)) (i32.mul (local.get $i) (i32.const 24))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $k0)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $k1)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $k2)) (i32.eq (i32.load offset=12 (local.get $e)) (local.get $k3))))
        (then (return (i32.load offset=16 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_SAMPLER) (size-of GpsSampler)))
    (store.field GpsSampler id (local.get $p) (local.get $id))
    (store.field GpsSampler address_u (local.get $p) (i32.and (local.get $k0) (i32.const 255)))
    (store.field GpsSampler address_v (local.get $p) (i32.and (i32.shr_u (local.get $k0) (i32.const 8)) (i32.const 255)))
    (store.field GpsSampler min (local.get $p) (i32.and (i32.shr_u (local.get $k0) (i32.const 16)) (i32.const 255)))
    (store.field GpsSampler mag (local.get $p) (i32.shr_u (local.get $k0) (i32.const 24)))
    (store.field GpsSampler mip (local.get $p) (local.get $mip))
    (store.field GpsSampler address_w (local.get $p) (i32.const 0))
    (store.field GpsSampler max_level (local.get $p) (local.get $max))
    (store.field GpsSampler max_aniso (local.get $p) (i32.const 0))
    (store.field GpsSampler lod_bias (local.get $p) (f32.reinterpret_i32 (local.get $k2)))
    (store.field GpsSampler border (local.get $p) (local.get $k3))
    (drop (call $d9g_end (local.get $p)))
    (local.set $i (global.get $d9g_rr_sampler))
    (global.set $d9g_rr_sampler (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1536)) (i32.mul (local.get $i) (i32.const 24))))
    (if (i32.load offset=4 (local.get $e)) (then (call $d9g_release (i32.load offset=16 (local.get $e)))))
    (i32.store (local.get $e) (local.get $k0))
    (i32.store offset=4 (local.get $e) (local.get $k1))
    (i32.store offset=8 (local.get $e) (local.get $k2))
    (i32.store offset=12 (local.get $e) (local.get $k3))
    (i32.store offset=16 (local.get $e) (local.get $id))
    (local.get $id))

  ;; ---- textures --------------------------------------------------------------
  ;; Decode level $level of texture object $t (wasm) into the executor.
  (func $d9g_upload_level (param $id i32) (param $t i32) (param $level i32) (result i32)
    (local $mip i32) (local $w i32) (local $hgt i32) (local $y i32) (local $n i32) (local $pos i32) (local $p i32)
    (local.set $mip (i32.add (local.get $t) (i32.add (i32.const 64) (i32.shl (local.get $level) (i32.const 5)))))
    (local.set $w (i32.load (local.get $mip)))
    (local.set $hgt (i32.load offset=4 (local.get $mip)))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y) (local.get $hgt)))
      (local.set $n (call $d3d9_texture_decode_rows (local.get $mip) (i32.load offset=36 (local.get $t)) (local.get $y)))
      (if (i32.eqz (local.get $n)) (then
        (if (local.get $y) (then (call $d3d9_texture_decode_release)))
        (return (i32.const 0))))
      (local.set $pos (call $d9g_arena (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n))))
      (memory.copy (call $d9g_aptr (local.get $pos)) (call $d3d9_texture_decode_scratch)
        (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (local.set $p (call $d9g_begin (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
      (store.field GpsUpload id (local.get $p) (local.get $id))
      (store.field GpsUpload level (local.get $p) (local.get $level))
      (store.field GpsUpload face (local.get $p) (i32.const 0))
      (store.field GpsUpload x (local.get $p) (i32.const 0))
      (store.field GpsUpload y (local.get $p) (local.get $y))
      (store.field GpsUpload w (local.get $p) (local.get $w))
      (store.field GpsUpload h (local.get $p) (local.get $n))
      (store.field GpsUpload pitch (local.get $p) (i32.shl (local.get $w) (i32.const 2)))
      (store.field GpsUpload src (local.get $p) (local.get $pos))
      (store.field GpsUpload bytes (local.get $p) (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (drop (call $d9g_end (local.get $p)))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (if (local.get $hgt) (then (call $d3d9_texture_decode_release)))
    (call $d9g_stat (i32.const 8) (i32.const 1))
    (i32.const 1))

  ;; Executor id of the texture bound at $stage, or -reason.
  (func $d9g_texture (param $stage i32) (result i32)
    (local $t i32) (local $levels i32) (local $fmt i32) (local $w i32) (local $hgt i32)
    (local $base i32) (local $i i32) (local $e i32) (local $slot i32) (local $id i32) (local $l i32)
    (local $mip i32) (local $fresh i32)
    (local.set $t (call $g2w (call $d9g_tex_ptr (local.get $stage))))
    (if (i32.eq (i32.load offset=12 (local.get $t)) (i32.const 5)) (then (return (i32.const -6))))
    (if (i32.ne (i32.load offset=12 (local.get $t)) (i32.const 3)) (then (return (i32.const -10))))
    (if (i32.load offset=56 (local.get $t)) (then (return (i32.const -5))))
    (local.set $levels (i32.load offset=32 (local.get $t)))
    (local.set $fmt (i32.load offset=36 (local.get $t)))
    (if (i32.or (i32.eqz (local.get $levels)) (i32.gt_u (local.get $levels) (i32.const 13)))
      (then (return (i32.const -10))))
    (local.set $w (i32.load offset=64 (local.get $t)))
    (local.set $hgt (i32.load offset=68 (local.get $t)))
    (if (i32.or (i32.gt_u (local.get $w) (i32.const 2048)) (i32.gt_u (local.get $hgt) (i32.const 2048)))
      (then (return (i32.const -25))))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt))) (then (return (i32.const -10))))
    ;; A locked level cannot be sampled (the old path refused the draw too).
    (loop $locks
      (if (i32.load offset=84 (i32.add (local.get $t) (i32.shl (local.get $l) (i32.const 5))))
        (then (return (i32.const -10))))
      (local.set $l (i32.add (local.get $l) (i32.const 1)))
      (br_if $locks (i32.lt_u (local.get $l) (local.get $levels))))
    (local.set $base (i32.add (call $d9g_m) (i32.const 52224)))
    (local.set $slot (i32.const -1))
    (loop $probe
      (local.set $e (i32.add (local.get $base)
        (i32.mul (i32.and (i32.add (i32.shr_u (local.get $t) (i32.const 6)) (local.get $i)) (i32.const 255)) (i32.const 80))))
      (if (i32.eq (i32.load (local.get $e)) (local.get $t)) (then (local.set $slot (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $probe (i32.and (i32.eq (local.get $slot) (i32.const -1)) (i32.lt_u (local.get $i) (i32.const 8)))))
    (if (i32.ne (local.get $slot) (i32.const -1)) (then
      (if (i32.or (i32.or (i32.ne (i32.load offset=8 (local.get $slot)) (local.get $w))
            (i32.ne (i32.load offset=12 (local.get $slot)) (local.get $hgt)))
            (i32.or (i32.ne (i32.load offset=16 (local.get $slot)) (local.get $levels))
              (i32.ne (i32.load offset=20 (local.get $slot)) (local.get $fmt))))
        (then
          (call $d9g_release (i32.load offset=4 (local.get $slot)))
          (local.set $fresh (i32.const 1))))))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then
      ;; Miss: take a free probe slot, else evict the home slot.
      (local.set $i (i32.const 0))
      (loop $free
        (local.set $e (i32.add (local.get $base)
          (i32.mul (i32.and (i32.add (i32.shr_u (local.get $t) (i32.const 6)) (local.get $i)) (i32.const 255)) (i32.const 80))))
        (if (i32.eqz (i32.load (local.get $e))) (then (local.set $slot (local.get $e))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $free (i32.and (i32.eq (local.get $slot) (i32.const -1)) (i32.lt_u (local.get $i) (i32.const 8)))))
      (if (i32.eq (local.get $slot) (i32.const -1)) (then
        (local.set $slot (i32.add (local.get $base)
          (i32.mul (i32.and (i32.shr_u (local.get $t) (i32.const 6)) (i32.const 255)) (i32.const 80))))
        (call $d9g_release (i32.load offset=4 (local.get $slot)))))
      (local.set $fresh (i32.const 1))))
    (if (local.get $fresh) (then
      (local.set $id (call $d9g_id))
      (call $gps_create (global.get $d9g_h) (local.get $id) (global.get $GPS_KIND_TEX2D)
        (global.get $GPS_FMT_A8B8G8R8) (local.get $levels) (local.get $w) (local.get $hgt) (i32.const 0))
      (i32.store (local.get $slot) (local.get $t))
      (i32.store offset=4 (local.get $slot) (local.get $id))
      (i32.store offset=8 (local.get $slot) (local.get $w))
      (i32.store offset=12 (local.get $slot) (local.get $hgt))
      (i32.store offset=16 (local.get $slot) (local.get $levels))
      (i32.store offset=20 (local.get $slot) (local.get $fmt))))
    (local.set $id (i32.load offset=4 (local.get $slot)))
    (local.set $l (i32.const 0))
    (loop $levels_loop
      (local.set $mip (i32.add (local.get $t) (i32.add (i32.const 64) (i32.shl (local.get $l) (i32.const 5)))))
      (local.set $e (i32.add (local.get $slot) (i32.add (i32.const 24) (i32.shl (local.get $l) (i32.const 2)))))
      ;; seq (mip+28) is the level's content identity; a new level always
      ;; uploads. Store seq+1 so a zero-content level still counts as sent.
      (if (i32.or (local.get $fresh) (i32.ne (i32.load (local.get $e)) (i32.add (i32.load offset=28 (local.get $mip)) (i32.const 1))))
        (then
          (if (i32.eqz (call $d9g_upload_level (local.get $id) (local.get $t) (local.get $l)))
            (then
              (i32.store (local.get $slot) (i32.const 0))
              (call $d9g_release (local.get $id))
              (return (i32.const -10))))
          (i32.store (local.get $e) (i32.add (i32.load offset=28 (local.get $mip)) (i32.const 1))))
        (else (call $d9g_stat (i32.const 9) (i32.const 1))))
      (local.set $l (i32.add (local.get $l) (i32.const 1)))
      (br_if $levels_loop (i32.lt_u (local.get $l) (local.get $levels))))
    (local.get $id))

  ;; ---- pixel shaders ---------------------------------------------------------
  ;; Publish canonical core IR as a SHADER record; its id, or 0 if the
  ;; canonicalizer declined.
  (func $d9g_shader_emit (param $ir i32) (param $stage i32) (result i32)
    (local $core i32) (local $bytes i32) (local $id i32) (local $p i32)
    (local.set $core (call $d3d_shader_ir_canonicalize (local.get $ir)))
    (if (i32.eqz (local.get $core)) (then (return (i32.const 0))))
    (local.set $bytes (i32.load offset=24 (local.get $core)))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_SHADER) (i32.add (size-of GpsShader) (local.get $bytes))))
    (store.field GpsShader id (local.get $p) (local.get $id))
    (store.field GpsShader stage (local.get $p) (local.get $stage))
    (store.field GpsShader pad (local.get $p) (i32.const 0))
    (store.field GpsShader pad2 (local.get $p) (i32.const 0))
    (store.field GpsShader ir_bytes (local.get $p) (local.get $bytes))
    (memory.copy (i32.add (local.get $p) (size-of GpsShader)) (local.get $core) (local.get $bytes))
    (call $d3d_shader_ir_free (local.get $core))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_stat (i32.const 10) (i32.const 1))
    (local.get $id))

  ;; Guest pixel shader (object guest $ptr): retained IR at +24 + length.
  (func $d9g_guest_ps (param $ptr i32) (result i32)
    (local $sw i32) (local $len i32) (local $sum i32) (local $i i32) (local $e i32) (local $id i32)
    (local.set $sw (call $g2w (local.get $ptr)))
    (local.set $len (i32.load offset=16 (local.get $sw)))
    (block $done (loop $hash
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 31))
        (i32.load8_u (i32.add (i32.add (local.get $sw) (i32.const 24)) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $hash)))
    (local.set $i (i32.const 0))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 2304)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $ptr)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $len)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $sum)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $d9g_shader_emit (i32.add (i32.add (local.get $sw) (i32.const 24)) (local.get $len))
      (global.get $GPS_STAGE_PS)))
    (if (i32.eqz (local.get $id)) (then (return (i32.const -8))))
    (local.set $i (global.get $d9g_rr_gps))
    (global.set $d9g_rr_gps (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 2304)) (i32.shl (local.get $i) (i32.const 4))))
    (call $d9g_release (i32.load offset=12 (local.get $e)))
    (i32.store (local.get $e) (local.get $ptr))
    (i32.store offset=4 (local.get $e) (local.get $len))
    (i32.store offset=8 (local.get $e) (local.get $sum))
    (i32.store offset=12 (local.get $e) (local.get $id))
    (local.get $id))

  ;; Guest PS constants c0..c7 (program +1552), re-sent when they changed.
  (func $d9g_ps_consts
    (local $m i32) (local $p i32)
    (local.set $m (call $d9g_m))
    (if (i32.and (i32.ne (i32.load offset=992 (local.get $m)) (i32.const 0))
          (call $d3g_row_eq (i32.add (local.get $m) (i32.const 864)) (i32.add (global.get $d9g_pw) (i32.const 1552)) (i32.const 128)))
      (then (return)))
    (i32.store offset=992 (local.get $m) (i32.const 1))
    (memory.copy (i32.add (local.get $m) (i32.const 864)) (i32.add (global.get $d9g_pw) (i32.const 1552)) (i32.const 128))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_CONSTS) (i32.add (size-of GpsConsts) (i32.const 128))))
    (store.field GpsConsts stage (local.get $p) (global.get $GPS_STAGE_PS))
    (store.field GpsConsts pad (local.get $p) (i32.const 0))
    (store.field GpsConsts first (local.get $p) (i32.const 0))
    (store.field GpsConsts count (local.get $p) (i32.const 8))
    (memory.copy (i32.add (local.get $p) (size-of GpsConsts)) (i32.add (global.get $d9g_pw) (i32.const 1552)) (i32.const 128))
    (drop (call $d9g_end (local.get $p))))

  ;; A stage argument that names D3DTA_SPECULAR.
  (func $d9g_spec_arg (param $stage i32) (result i32)
    (i32.or
      (i32.or (i32.eq (i32.and (call $d9g_tss (local.get $stage) (i32.const 8)) (i32.const 15)) (i32.const 4))
        (i32.eq (i32.and (call $d9g_tss (local.get $stage) (i32.const 12)) (i32.const 15)) (i32.const 4)))
      (i32.or
        (i32.or (i32.eq (i32.and (call $d9g_tss (local.get $stage) (i32.const 20)) (i32.const 15)) (i32.const 4))
          (i32.eq (i32.and (call $d9g_tss (local.get $stage) (i32.const 24)) (i32.const 15)) (i32.const 4)))
        (i32.or (i32.eq (i32.and (call $d9g_tss (local.get $stage) (i32.const 104)) (i32.const 15)) (i32.const 4))
          (i32.eq (i32.and (call $d9g_tss (local.get $stage) (i32.const 108)) (i32.const 15)) (i32.const 4))))))

  ;; Stages the fixed cascade runs: up to the first DISABLE, or a stage
  ;; whose COLORARG1 is TEXTURE with nothing bound (lib/d3d-shader-ir.js).
  (func $d9g_active_stages (result i32)
    (local $i i32)
    (block $done (loop $stages
      (br_if $done (i32.ge_u (local.get $i) (i32.const 6)))
      (br_if $done (i32.eq (call $d9g_tss (local.get $i) (i32.const 4)) (i32.const 1)))
      (br_if $done (i32.and (i32.eq (call $d9g_tss (local.get $i) (i32.const 8)) (i32.const 2))
        (i32.eqz (call $d9g_tex_ptr (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $stages)))
    (local.get $i))

  ;; Fixed-function pixel stages -> 09aj cascade (PS only) -> core IR. The
  ;; DFX1 descriptor and rows are packed exactly as fixedCascade(fixedVS
  ;; false, fixedPS true) does; the packed bytes are the cache key.
  ;; With $fvf (untransformed) the vertex half is packed too, as
  ;; fixedCascade(fixedVS true, fixedPS !$guest_ps) does with the input
  ;; registers of $d9g_fixed_tl; matrices stay zero. Returns the key length.
  (func $d9g_fixed_pack (param $active i32) (param $fvf i32) (param $guest_ps i32) (result i32)
    (local $m i32) (local $d i32) (local $tab i32) (local $six i32) (local $stride i32) (local $len i32)
    (local $i i32) (local $r i32) (local $ntex i32) (local $set i32)
    (local.set $m (call $d9g_m))
    (local.set $d (i32.add (local.get $m) (i32.const 4096)))
    (local.set $tab (i32.add (local.get $d) (i32.const 288)))
    (local.set $six (i32.ne (call $d9g_rs (i32.const 29)) (i32.const 0)))
    (if (i32.and (i32.ne (local.get $fvf) (i32.const 0)) (i32.ne (local.get $guest_ps) (i32.const 0)))
      (then (local.set $six (i32.ne (i32.and (local.get $fvf) (i32.const 128)) (i32.const 0)))))
    (block $scan (loop $sargs
      (br_if $scan (i32.or (i32.ge_u (local.get $i) (local.get $active)) (i32.ne (local.get $guest_ps) (i32.const 0))))
      (if (call $d9g_spec_arg (local.get $i)) (then (local.set $six (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sargs)))
    (local.set $stride (select (i32.const 192) (i32.const 160) (local.get $six)))
    (local.set $len (i32.add (i32.const 288) (i32.mul (local.get $stride) (i32.const 6))))
    (memory.fill (local.get $d) (i32.const 0) (i32.const 1440))
    (i32.store (local.get $d) (i32.const 0x44465831))
    (i32.store offset=4 (local.get $d) (i32.const 1))
    (i32.store offset=8 (local.get $d) (select (i32.const 8) (i32.const 0) (i32.ne (call $d9g_tex_ptr (i32.const 0)) (i32.const 0))))
    (i32.store offset=12 (local.get $d) (i32.const 0))
    (i32.store offset=16 (local.get $d) (i32.const 1))
    (i32.store offset=20 (local.get $d) (i32.const 2))
    (i32.store offset=24 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 4)))
    (i32.store offset=28 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 8)))
    (i32.store offset=32 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 12)))
    (i32.store offset=36 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 16)))
    (i32.store offset=40 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 20)))
    (i32.store offset=44 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 24)))
    (i32.store offset=48 (local.get $d) (call $d9g_rs (i32.const 60)))
    (i32.store offset=52 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 128)))
    (i32.store offset=56 (local.get $d) (call $d9g_tss (i32.const 1) (i32.const 4)))
    (call $d9g_vp_rect (i32.add (local.get $m) (i32.const 744)))
    (i32.store offset=68 (local.get $d) (i32.load offset=744 (local.get $m)))
    (i32.store offset=72 (local.get $d) (i32.load offset=748 (local.get $m)))
    (i32.store offset=76 (local.get $d) (i32.sub (i32.load offset=752 (local.get $m)) (i32.load offset=744 (local.get $m))))
    (i32.store offset=80 (local.get $d) (i32.sub (i32.load offset=756 (local.get $m)) (i32.load offset=748 (local.get $m))))
    (f32.store offset=84 (local.get $d) (f32.load offset=21744 (global.get $d9g_pw)))
    (f32.store offset=88 (local.get $d) (f32.load offset=21748 (global.get $d9g_pw)))
    (local.set $i (i32.const 0))
    (loop $rows
      (local.set $r (i32.add (local.get $tab) (i32.mul (local.get $i) (local.get $stride))))
      (i32.store (local.get $r) (call $d9g_tss (local.get $i) (i32.const 4)))
      (i32.store offset=4 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 8)))
      (i32.store offset=8 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 12)))
      (i32.store offset=12 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 16)))
      (i32.store offset=16 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 20)))
      (i32.store offset=20 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 24)))
      (i32.store offset=24 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 128)))
      (i32.store offset=28 (local.get $r) (i32.ne (call $d9g_tex_ptr (local.get $i)) (i32.const 0)))
      (i32.store offset=32 (local.get $r) (i32.const 16))
      (i32.store offset=36 (local.get $r) (i32.const 0))
      (i32.store offset=40 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 44)))
      (i32.store offset=44 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 112)))
      (i32.store offset=48 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 104)))
      (i32.store offset=52 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 108)))
      (i32.store offset=128 (local.get $r) (i32.const 16))
      (i32.store offset=132 (local.get $r)
        (i32.or (i32.ne (call $d9g_rs (i32.const 143)) (i32.const 0))
          (select (i32.const 2) (i32.const 0) (i32.ne (call $d9g_rs (i32.const 142)) (i32.const 0)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $i) (i32.const 6))))
    (if (local.get $six) (then
      (i32.store offset=160 (local.get $tab) (i32.const 17))
      (local.set $r (i32.const 0))
      (local.set $i (i32.const 0))
      (block $sdone (loop $sloop
        (br_if $sdone (i32.ge_u (local.get $i) (local.get $active)))
        (if (call $d9g_spec_arg (local.get $i)) (then (local.set $r (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $sloop)))
      (i32.store offset=164 (local.get $tab)
        (i32.or (local.get $r) (select (i32.const 2) (i32.const 0) (i32.ne (call $d9g_rs (i32.const 29)) (i32.const 0)))))))
    (if (i32.eqz (local.get $fvf)) (then (return (local.get $len))))
    ;; Vertex half: v0 POSITION, v1 COLOR0, v(2+k) TEXCOORDk, v10 COLOR1.
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (if (local.get $guest_ps) (then (memory.fill (i32.add (local.get $d) (i32.const 24)) (i32.const 0) (i32.const 36))))
    (local.set $set (i32.and (call $d9g_tss (i32.const 0) (i32.const 44)) (i32.const 0xffff)))
    (i32.store offset=8 (local.get $d) (i32.or (i32.load offset=8 (local.get $d))
      (i32.or (select (i32.const 2) (i32.const 0) (i32.ne (i32.and (local.get $fvf) (i32.const 64)) (i32.const 0)))
        (select (i32.const 4) (i32.const 0) (i32.lt_u (local.get $set) (local.get $ntex))))))
    (i32.store offset=20 (local.get $d)
      (select (i32.add (local.get $set) (i32.const 2)) (i32.const 12) (i32.lt_u (local.get $set) (local.get $ntex))))
    (i32.store offset=60 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 96)))
    (i32.store offset=64 (local.get $d) (call $d9g_tss (i32.const 0) (i32.const 44)))
    (local.set $i (i32.const 0))
    (loop $vrows
      (local.set $r (i32.add (local.get $tab) (i32.mul (local.get $i) (local.get $stride))))
      (local.set $set (i32.and (call $d9g_tss (local.get $i) (i32.const 44)) (i32.const 0xffff)))
      (if (i32.lt_u (local.get $set) (local.get $ntex)) (then
        (i32.store offset=32 (local.get $r) (i32.add (local.get $set) (i32.const 2)))
        (i32.store offset=56 (local.get $r) (call $d9g_tc_size (local.get $fvf) (local.get $set)))))
      (i32.store offset=36 (local.get $r) (call $d9g_tss (local.get $i) (i32.const 96)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $vrows (i32.lt_u (local.get $i) (i32.const 6))))
    (if (i32.and (i32.ne (call $d9g_rs (i32.const 28)) (i32.const 0)) (i32.eqz (call $d9g_rs (i32.const 35)))) (then
      (i32.store offset=136 (local.get $tab)
        (i32.or (i32.const 1) (select (i32.const 2) (i32.const 0) (i32.ne (call $d9g_rs (i32.const 48)) (i32.const 0)))))
      (i32.store offset=140 (local.get $tab) (call $d9g_rs (i32.const 140)))
      (i32.store offset=144 (local.get $tab) (call $d9g_rs (i32.const 36)))
      (i32.store offset=148 (local.get $tab) (call $d9g_rs (i32.const 37)))
      (i32.store offset=152 (local.get $tab) (call $d9g_rs (i32.const 38)))
      (i32.store offset=156 (local.get $tab)
        (select (i32.const 10) (i32.const 16) (i32.ne (i32.and (local.get $fvf) (i32.const 128)) (i32.const 0))))))
    (if (local.get $six) (then
      (i32.store offset=160 (local.get $tab)
        (select (i32.const 10) (i32.const 16) (i32.ne (i32.and (local.get $fvf) (i32.const 128)) (i32.const 0))))
      (if (local.get $guest_ps) (then (i32.store offset=164 (local.get $tab) (i32.const 0))))))
    (local.get $len))

  (func $d9g_fixed_ps (param $active i32) (result i32)
    (local $m i32) (local $d i32) (local $len i32) (local $i i32) (local $e i32) (local $bundle i32) (local $id i32)
    (local $tab i32)
    (local.set $m (call $d9g_m))
    (local.set $d (i32.add (local.get $m) (i32.const 4096)))
    (local.set $tab (i32.add (local.get $d) (i32.const 288)))
    (local.set $len (call $d9g_fixed_pack (local.get $active) (i32.const 0) (i32.const 0)))
    ;; Cache: {id, len, key bytes}.
    (local.set $i (i32.const 0))
    (loop $cache
      (local.set $e (i32.add (i32.add (local.get $m) (i32.const 5632)) (i32.mul (local.get $i) (i32.const 1448))))
      (if (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $len)))
        (then (if (call $d3g_row_eq (i32.add (local.get $e) (i32.const 8)) (local.get $d) (local.get $len))
          (then (return (i32.load (local.get $e)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cache (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $bundle (if (result i32) (i32.eq (local.get $len) (i32.const 1440))
      (then (call $d3d_fixed_compile_cascade6 (local.get $d) (local.get $tab) (i32.const 6) (i32.const 2) (i32.const 0)))
      (else (call $d3d_fixed_compile_cascade5 (local.get $d) (local.get $tab) (i32.const 6) (i32.const 2) (i32.const 0)))))
    (if (i32.eqz (local.get $bundle)) (then (return (i32.const -9))))
    (local.set $id (call $d9g_shader_emit (i32.load offset=8 (local.get $bundle)) (global.get $GPS_STAGE_PS)))
    (call $d3d_fixed_free (local.get $bundle))
    (if (i32.eqz (local.get $id)) (then (return (i32.const -8))))
    (local.set $i (global.get $d9g_rr_shader))
    (global.set $d9g_rr_shader (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (local.get $m) (i32.const 5632)) (i32.mul (local.get $i) (i32.const 1448))))
    (call $d9g_release (i32.load (local.get $e)))
    (i32.store (local.get $e) (local.get $id))
    (i32.store offset=4 (local.get $e) (local.get $len))
    (memory.copy (i32.add (local.get $e) (i32.const 8)) (local.get $d) (local.get $len))
    (local.get $id))

  ;; ---- layout ----------------------------------------------------------------
  ;; Byte offset of FVF texcoord set $set (16 + optional psize/diffuse/
  ;; specular, then the sets); its size in floats via $d9g_tc_size.
  (func $d9g_tc_size (param $fvf i32) (param $set i32) (result i32)
    (i32.and (i32.shr_u (i32.const 0x1432) (i32.shl (i32.and (i32.shr_u (local.get $fvf)
      (i32.add (i32.const 16) (i32.shl (local.get $set) (i32.const 1)))) (i32.const 3)) (i32.const 2))) (i32.const 15)))
  (func $d9g_tc_off (param $fvf i32) (param $set i32) (result i32)
    (local $o i32) (local $i i32)
    (local.set $o (i32.const 16))
    (if (i32.and (local.get $fvf) (i32.const 16)) (then (local.set $o (i32.add (local.get $o) (i32.const 12)))))
    (if (i32.and (local.get $fvf) (i32.const 32)) (then (local.set $o (i32.add (local.get $o) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then (local.set $o (i32.add (local.get $o) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then (local.set $o (i32.add (local.get $o) (i32.const 4)))))
    (block $done (loop $sets
      (br_if $done (i32.ge_u (local.get $i) (local.get $set)))
      (local.set $o (i32.add (local.get $o) (i32.shl (call $d9g_tc_size (local.get $fvf) (local.get $i)) (i32.const 2))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sets)))
    (local.get $o))

  (func $d9g_elem (param $p i32) (param $type i32) (param $usage i32) (param $index i32) (param $off i32) (result i32)
    (store.field GpsLayoutElem slot (local.get $p) (i32.const 0))
    (store.field GpsLayoutElem type (local.get $p) (local.get $type))
    (store.field GpsLayoutElem usage (local.get $p) (local.get $usage))
    (store.field GpsLayoutElem index (local.get $p) (local.get $index))
    (store.field GpsLayoutElem offset (local.get $p) (local.get $off))
    (store.field GpsLayoutElem pad (local.get $p) (i32.const 0))
    (i32.add (local.get $p) (size-of GpsLayoutElem)))

  ;; $texmap: 4 bits per stage 0..5, the FVF set it reads (15 = none).
  (func $d9g_layout (param $fvf i32) (param $stride i32) (param $texmap i32) (result i32)
    (local $i i32) (local $e i32) (local $id i32) (local $p i32) (local $q i32) (local $n i32) (local $set i32)
    (local $off i32)
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $fvf)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $stride)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $texmap)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $n (i32.const 1))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
    (local.set $i (i32.const 0))
    (loop $count
      (if (i32.ne (i32.and (i32.shr_u (local.get $texmap) (i32.shl (local.get $i) (i32.const 2))) (i32.const 15)) (i32.const 15))
        (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $count (i32.lt_u (local.get $i) (i32.const 6))))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (local.get $n) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (local.get $n))
    (store.field GpsLayout stride (local.get $p) (local.get $stride))
    (local.set $q (call $d9g_elem (i32.add (local.get $p) (size-of GpsLayout))
      (global.get $GPS_VTYPE_FLOAT4) (global.get $GPS_USAGE_POSITIONT) (i32.const 0) (i32.const 0)))
    (local.set $off (i32.const 16))
    (if (i32.and (local.get $fvf) (i32.const 16)) (then (local.set $off (i32.add (local.get $off) (i32.const 12)))))
    (if (i32.and (local.get $fvf) (i32.const 32)) (then (local.set $off (i32.add (local.get $off) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_D3DCOLOR) (global.get $GPS_USAGE_COLOR)
        (i32.const 0) (local.get $off)))
      (local.set $off (i32.add (local.get $off) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_D3DCOLOR) (global.get $GPS_USAGE_COLOR)
        (i32.const 1) (local.get $off)))))
    (local.set $i (i32.const 0))
    (loop $tc
      (local.set $set (i32.and (i32.shr_u (local.get $texmap) (i32.shl (local.get $i) (i32.const 2))) (i32.const 15)))
      (if (i32.ne (local.get $set) (i32.const 15)) (then
        (local.set $q (call $d9g_elem (local.get $q)
          (i32.sub (call $d9g_tc_size (local.get $fvf) (local.get $set)) (i32.const 1))
          (global.get $GPS_USAGE_TEXCOORD) (local.get $i) (call $d9g_tc_off (local.get $fvf) (local.get $set))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $tc (i32.lt_u (local.get $i) (i32.const 6))))
    (drop (call $d9g_end (local.get $p)))
    (local.set $i (global.get $d9g_rr_layout))
    (global.set $d9g_rr_layout (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
    (call $d9g_release (i32.load offset=12 (local.get $e)))
    (i32.store (local.get $e) (local.get $fvf))
    (i32.store offset=4 (local.get $e) (local.get $stride))
    (i32.store offset=8 (local.get $e) (local.get $texmap))
    (i32.store offset=12 (local.get $e) (local.get $id))
    (local.get $id))

  ;; BIND {slot, texture, sampler} for the $n entries staged at mem+1440..,
  ;; re-sent when the set changed.
  (func $d9g_bind_tex (param $n i32)
    (local $m i32) (local $p i32) (local $bytes i32)
    (local.set $m (call $d9g_m))
    (local.set $bytes (i32.mul (local.get $n) (i32.const 12)))
    (if (i32.eq (i32.load offset=768 (local.get $m)) (local.get $n))
      (then (if (call $d3g_row_eq (i32.add (local.get $m) (i32.const 772)) (i32.add (local.get $m) (i32.const 2848)) (local.get $bytes))
        (then (return)))))
    (i32.store offset=768 (local.get $m) (local.get $n))
    (memory.copy (i32.add (local.get $m) (i32.const 772)) (i32.add (local.get $m) (i32.const 2848)) (local.get $bytes))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_BIND) (i32.add (size-of GpsBind) (local.get $bytes))))
    (store.field GpsBind count (local.get $p) (local.get $n))
    (memory.copy (i32.add (local.get $p) (size-of GpsBind)) (i32.add (local.get $m) (i32.const 2848)) (local.get $bytes))
    (drop (call $d9g_end (local.get $p))))

  ;; ---- vertex / index buffers (9.5b) -----------------------------------------
  ;; 09ae calls this when a buffer is created (whole buffer) and locked (the
  ;; locked range): +44 content seq, +56/+60 the dirty byte range [lo, hi)
  ;; not yet sent (hi 0 = clean). $d9g_buffer sends the range and clears it.
  (func $d9g_buffer_dirty (param $wa i32) (param $offset i32) (param $size i32)
    (local $hi i32)
    (call $d3d9_texture_touch (i32.add (local.get $wa) (i32.const 44)))
    (local.set $hi (i32.add (local.get $offset) (local.get $size)))
    (if (i32.eqz (i32.load offset=60 (local.get $wa))) (then
      (i32.store offset=56 (local.get $wa) (local.get $offset))
      (i32.store offset=60 (local.get $wa) (local.get $hi))
      (return)))
    (if (i32.lt_u (local.get $offset) (i32.load offset=56 (local.get $wa)))
      (then (i32.store offset=56 (local.get $wa) (local.get $offset))))
    (if (i32.gt_u (local.get $hi) (i32.load offset=60 (local.get $wa)))
      (then (i32.store offset=60 (local.get $wa) (local.get $hi)))))

  ;; UPLOAD buffer bytes [$lo, $hi) of 09ae buffer $wa (data at +64), in
  ;; chunks of at most 1 MB (x = destination byte offset).
  (func $d9g_buffer_upload (param $id i32) (param $wa i32) (param $lo i32) (param $hi i32)
    (local $n i32) (local $pos i32) (local $p i32)
    (block $done (loop $chunks
      (br_if $done (i32.ge_u (local.get $lo) (local.get $hi)))
      (local.set $n (i32.sub (local.get $hi) (local.get $lo)))
      (if (i32.gt_u (local.get $n) (i32.const 0x100000)) (then (local.set $n (i32.const 0x100000))))
      (local.set $pos (call $d9g_arena (local.get $n)))
      (memory.copy (call $d9g_aptr (local.get $pos))
        (i32.add (i32.add (local.get $wa) (i32.const 64)) (local.get $lo)) (local.get $n))
      (local.set $p (call $d9g_begin (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
      (store.field GpsUpload id (local.get $p) (local.get $id))
      (store.field GpsUpload level (local.get $p) (i32.const 0))
      (store.field GpsUpload face (local.get $p) (i32.const 0))
      (store.field GpsUpload x (local.get $p) (local.get $lo))
      (store.field GpsUpload y (local.get $p) (i32.const 0))
      (store.field GpsUpload w (local.get $p) (local.get $n))
      (store.field GpsUpload h (local.get $p) (i32.const 1))
      (store.field GpsUpload pitch (local.get $p) (local.get $n))
      (store.field GpsUpload src (local.get $p) (local.get $pos))
      (store.field GpsUpload bytes (local.get $p) (local.get $n))
      (drop (call $d9g_end (local.get $p)))
      (local.set $lo (i32.add (local.get $lo) (local.get $n)))
      (br $chunks)))
    (call $d9g_stat (i32.const 72) (i32.const 1)))

  ;; Executor id of 09ae buffer object $buf (guest) as GPS $kind (VBUF/IBUF),
  ;; with whatever changed since it was last sent uploaded first. Cache at
  ;; mem+72704: 64 x {buf, seq, len, id}, round-robin eviction.
  (func $d9g_buffer (param $buf i32) (param $kind i32) (result i32)
    (local $wa i32) (local $i i32) (local $e i32) (local $slot i32) (local $len i32) (local $id i32)
    (local $lo i32) (local $hi i32)
    (local.set $wa (call $g2w (local.get $buf)))
    (local.set $len (i32.load offset=24 (local.get $wa)))
    (local.set $slot (i32.const -1))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 72704)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.eq (i32.load (local.get $e)) (local.get $buf)) (then (local.set $slot (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.and (i32.eq (local.get $slot) (i32.const -1)) (i32.lt_u (local.get $i) (i32.const 64)))))
    (if (i32.ne (local.get $slot) (i32.const -1)) (then
      (if (i32.eq (i32.load offset=8 (local.get $slot)) (local.get $len)) (then
        (local.set $id (i32.load offset=12 (local.get $slot)))
        (if (i32.eq (i32.load offset=4 (local.get $slot)) (i32.load offset=44 (local.get $wa))) (then
          (call $d9g_stat (i32.const 73) (i32.const 1))
          (return (local.get $id))))
        (local.set $lo (i32.load offset=56 (local.get $wa)))
        (local.set $hi (i32.load offset=60 (local.get $wa)))
        (if (i32.or (i32.eqz (local.get $hi)) (i32.or (i32.gt_u (local.get $hi) (local.get $len)) (i32.ge_u (local.get $lo) (local.get $hi))))
          (then (local.set $lo (i32.const 0)) (local.set $hi (local.get $len))))
        (call $d9g_buffer_upload (local.get $id) (local.get $wa) (local.get $lo) (local.get $hi))
        (i32.store offset=56 (local.get $wa) (i32.const 0))
        (i32.store offset=60 (local.get $wa) (i32.const 0))
        (i32.store offset=4 (local.get $slot) (i32.load offset=44 (local.get $wa)))
        (return (local.get $id))))
      (call $d9g_release (i32.load offset=12 (local.get $slot)))))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then
      (local.set $i (global.get $d9g_rr_buffer))
      (global.set $d9g_rr_buffer (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 63)))
      (local.set $slot (i32.add (i32.add (call $d9g_m) (i32.const 72704)) (i32.shl (local.get $i) (i32.const 4))))
      (call $d9g_release (i32.load offset=12 (local.get $slot)))))
    (local.set $id (call $d9g_id))
    (call $gps_create (global.get $d9g_h) (local.get $id) (local.get $kind) (i32.const 0)
      (i32.const 1) (local.get $len) (i32.const 1) (local.get $len))
    (call $d9g_buffer_upload (local.get $id) (local.get $wa) (i32.const 0) (local.get $len))
    (i32.store offset=56 (local.get $wa) (i32.const 0))
    (i32.store offset=60 (local.get $wa) (i32.const 0))
    (i32.store (local.get $slot) (local.get $buf))
    (i32.store offset=4 (local.get $slot) (i32.load offset=44 (local.get $wa)))
    (i32.store offset=8 (local.get $slot) (local.get $len))
    (i32.store offset=12 (local.get $slot) (local.get $id))
    (local.get $id))

  ;; ---- vertex stage (9.5b) ---------------------------------------------------
  ;; Stage-0 constants c[$first .. $first+$count) from $src: only the run of
  ;; registers that differs from what the executor holds (shadow at
  ;; mem+73728, 256 x 16; mem+77824 = shadow valid) is sent.
  (func $d9g_vs_consts (param $src i32) (param $first i32) (param $count i32)
    (local $m i32) (local $sh i32) (local $i i32) (local $lo i32) (local $hi i32) (local $p i32) (local $n i32)
    (local.set $m (call $d9g_m))
    (local.set $sh (i32.add (local.get $m) (i32.const 73728)))
    (if (i32.eqz (i32.load offset=77824 (local.get $m))) (then
      ;; The executor's constants start zeroed; say so once explicitly.
      (i32.store offset=77824 (local.get $m) (i32.const 1))
      (memory.fill (local.get $sh) (i32.const 0) (i32.const 4096))
      (local.set $p (call $d9g_begin (global.get $GPS_OP_CONSTS) (i32.add (size-of GpsConsts) (i32.const 4096))))
      (store.field GpsConsts stage (local.get $p) (global.get $GPS_STAGE_VS))
      (store.field GpsConsts pad (local.get $p) (i32.const 0))
      (store.field GpsConsts first (local.get $p) (i32.const 0))
      (store.field GpsConsts count (local.get $p) (i32.const 256))
      (memory.fill (i32.add (local.get $p) (size-of GpsConsts)) (i32.const 0) (i32.const 4096))
      (drop (call $d9g_end (local.get $p)))))
    (local.set $lo (i32.const -1))
    (block $done (loop $regs
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (if (i32.eqz (call $d3g_row_eq
            (i32.add (local.get $sh) (i32.shl (i32.add (local.get $first) (local.get $i)) (i32.const 4)))
            (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 4))) (i32.const 16)))
        (then
          (if (i32.eq (local.get $lo) (i32.const -1)) (then (local.set $lo (local.get $i))))
          (local.set $hi (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $regs)))
    (if (i32.eq (local.get $lo) (i32.const -1)) (then (return)))
    (local.set $n (i32.shl (i32.add (i32.sub (local.get $hi) (local.get $lo)) (i32.const 1)) (i32.const 4)))
    (memory.copy (i32.add (local.get $sh) (i32.shl (i32.add (local.get $first) (local.get $lo)) (i32.const 4)))
      (i32.add (local.get $src) (i32.shl (local.get $lo) (i32.const 4))) (local.get $n))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_CONSTS) (i32.add (size-of GpsConsts) (local.get $n))))
    (store.field GpsConsts stage (local.get $p) (global.get $GPS_STAGE_VS))
    (store.field GpsConsts pad (local.get $p) (i32.const 0))
    (store.field GpsConsts first (local.get $p) (i32.add (local.get $first) (local.get $lo)))
    (store.field GpsConsts count (local.get $p) (i32.shr_u (local.get $n) (i32.const 4)))
    (memory.copy (i32.add (local.get $p) (size-of GpsConsts))
      (i32.add (local.get $src) (i32.shl (local.get $lo) (i32.const 4))) (local.get $n))
    (drop (call $d9g_end (local.get $p))))

  ;; Guest vertex shader (object guest $ptr, retained IR at +24 + length).
  ;; $d3d8 is the bound D3D8 declaration (0 for D3D9): its register map,
  ;; already in the implicit-DCL table at mem+101952, declares the v#
  ;; a DCL-less vs_1_x reads, so it is part of the cache key.
  ;; Cache mem+101312: 32 x {ptr, len, sum, d3d8, id}.
  (func $d9g_guest_vs (param $ptr i32) (param $d3d8 i32) (result i32)
    (local $sw i32) (local $len i32) (local $sum i32) (local $i i32) (local $e i32) (local $id i32)
    (local.set $sw (call $g2w (local.get $ptr)))
    (local.set $len (i32.load offset=16 (local.get $sw)))
    (block $done (loop $hash
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 31))
        (i32.load8_u (i32.add (i32.add (local.get $sw) (i32.const 24)) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $hash)))
    (if (local.get $d3d8) (then
      (local.set $i (i32.const 0))
      (loop $map
        (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 31))
          (i32.load (i32.add (i32.add (call $d9g_m) (i32.const 101952)) (i32.shl (local.get $i) (i32.const 2))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $map (i32.lt_u (local.get $i) (i32.const 16))))))
    (local.set $i (i32.const 0))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 101312)) (i32.mul (local.get $i) (i32.const 20))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $ptr)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $len)))
            (i32.and (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $sum)) (i32.eq (i32.load offset=12 (local.get $e)) (local.get $d3d8)))
              (i32.ne (i32.load offset=16 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=16 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (if (local.get $d3d8) (then (global.set $vc_implicit_dcl (i32.add (call $d9g_m) (i32.const 101952)))))
    (local.set $id (call $d9g_shader_emit (i32.add (i32.add (local.get $sw) (i32.const 24)) (local.get $len))
      (global.get $GPS_STAGE_VS)))
    (global.set $vc_implicit_dcl (i32.const 0))
    (if (i32.eqz (local.get $id)) (then (return (i32.const -8))))
    (local.set $i (global.get $d9g_rr_vs))
    (global.set $d9g_rr_vs (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 101312)) (i32.mul (local.get $i) (i32.const 20))))
    (call $d9g_release (i32.load offset=16 (local.get $e)))
    (i32.store (local.get $e) (local.get $ptr))
    (i32.store offset=4 (local.get $e) (local.get $len))
    (i32.store offset=8 (local.get $e) (local.get $sum))
    (i32.store offset=12 (local.get $e) (local.get $d3d8))
    (i32.store offset=16 (local.get $e) (local.get $id))
    (local.get $id))

  ;; Programmable LAYOUT from a bound declaration (wasm $dw), cached by
  ;; (decl, stride, element hash). Stream 0, method DEFAULT, FLOAT1..4 /
  ;; D3DCOLOR, no POSITIONT only (else -27). A D3D8 declaration also fills
  ;; the implicit-DCL table (mem+101952) from its register map.
  (func $d9g_layout_decl (param $decl i32) (param $stride i32) (result i32)
    (local $dw i32) (local $n i32) (local $i i32) (local $el i32) (local $type i32) (local $usage i32)
    (local $off i32) (local $sum i32) (local $e i32) (local $id i32) (local $p i32) (local $q i32)
    (local $d3d8 i32) (local $reg i32) (local $tab i32)
    (local.set $dw (call $g2w (local.get $decl)))
    (local.set $n (i32.sub (i32.shr_u (i32.load offset=16 (local.get $dw)) (i32.const 3)) (i32.const 1)))
    (if (i32.or (i32.lt_s (local.get $n) (i32.const 1)) (i32.gt_u (local.get $n) (i32.const 16))) (then (return (i32.const -27))))
    (local.set $d3d8 (i32.eq (i32.load offset=12 (local.get $dw)) (i32.const 0xd3d80002)))
    (local.set $tab (i32.add (call $d9g_m) (i32.const 101952)))
    (memory.fill (local.get $tab) (i32.const 0) (i32.const 64))
    (local.set $sum (local.get $stride))
    (block $done (loop $els
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
      (local.set $type (i32.load8_u offset=4 (local.get $el)))
      (local.set $usage (i32.load8_u offset=6 (local.get $el)))
      (local.set $off (i32.load16_u offset=2 (local.get $el)))
      (if (i32.or (i32.or (i32.load16_u (local.get $el)) (i32.load8_u offset=5 (local.get $el)))
            (i32.or (i32.gt_u (local.get $type) (i32.const 4)) (i32.eq (local.get $usage) (i32.const 9))))
        (then (return (i32.const -27))))
      (if (i32.or (i32.and (local.get $off) (i32.const 3))
            (i32.gt_u (i32.add (local.get $off) (select (i32.const 4) (i32.shl (i32.add (local.get $type) (i32.const 1)) (i32.const 2))
              (i32.eq (local.get $type) (i32.const 4)))) (local.get $stride)))
        (then (return (i32.const -27))))
      (if (local.get $d3d8) (then
        (local.set $reg (i32.load8_u (i32.add (i32.add (i32.add (local.get $dw) (i32.const 24))
          (i32.load offset=16 (local.get $dw))) (local.get $i))))
        (if (i32.gt_u (local.get $reg) (i32.const 15)) (then (return (i32.const -27))))
        (i32.store (i32.add (local.get $tab) (i32.shl (local.get $reg) (i32.const 2)))
          (i32.or (i32.const 0x80000000) (i32.or (local.get $usage)
            (i32.shl (i32.load8_u offset=7 (local.get $el)) (i32.const 16)))))))
      (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 31)) (i32.load (local.get $el))))
      (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 31)) (i32.load offset=4 (local.get $el))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $els)))
    (local.set $sum (i32.or (i32.and (local.get $sum) (i32.const 0x0fffffff)) (i32.const 0x50000000)))
    (local.set $i (i32.const 0))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $decl)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $stride)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $sum)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (local.get $n) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (local.get $n))
    (store.field GpsLayout stride (local.get $p) (local.get $stride))
    (local.set $q (i32.add (local.get $p) (size-of GpsLayout)))
    (local.set $i (i32.const 0))
    (block $edone (loop $emit
      (br_if $edone (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
      (local.set $q (call $d9g_elem (local.get $q) (i32.load8_u offset=4 (local.get $el)) (i32.load8_u offset=6 (local.get $el))
        (i32.load8_u offset=7 (local.get $el)) (i32.load16_u offset=2 (local.get $el))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $emit)))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_layout_cache (local.get $decl) (local.get $stride) (local.get $sum) (local.get $id))
    (local.get $id))

  (func $d9g_layout_cache (param $k0 i32) (param $k1 i32) (param $k2 i32) (param $id i32)
    (local $i i32) (local $e i32)
    (local.set $i (global.get $d9g_rr_layout))
    (global.set $d9g_rr_layout (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
    (call $d9g_release (i32.load offset=12 (local.get $e)))
    (i32.store (local.get $e) (local.get $k0))
    (i32.store offset=4 (local.get $e) (local.get $k1))
    (i32.store offset=8 (local.get $e) (local.get $k2))
    (i32.store offset=12 (local.get $e) (local.get $id)))

  ;; Untransformed FVF (position XYZ, 12 bytes): bytes per vertex, and the
  ;; byte offset of texcoord set $set.
  (func $d9g_xyz_tc_off (param $fvf i32) (param $set i32) (result i32)
    (i32.sub (call $d9g_tc_off (local.get $fvf) (local.get $set)) (i32.const 4)))

  ;; Programmable LAYOUT for an untransformed FVF: POSITION0 FLOAT3, NORMAL0,
  ;; PSIZE0, COLOR0/1 (D3DCOLOR), TEXCOORDk = FVF set k. Cache key (fvf,
  ;; stride, 0x40000000).
  (func $d9g_layout_fvf (param $fvf i32) (param $stride i32) (result i32)
    (local $i i32) (local $e i32) (local $id i32) (local $p i32) (local $q i32) (local $n i32) (local $ntex i32)
    (local $off i32)
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $fvf)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $stride)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (i32.const 0x40000000)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (local.set $n (i32.add (i32.const 1) (local.get $ntex)))
    (if (i32.and (local.get $fvf) (i32.const 16)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
    (if (i32.and (local.get $fvf) (i32.const 32)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (local.get $n) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (local.get $n))
    (store.field GpsLayout stride (local.get $p) (local.get $stride))
    (local.set $q (call $d9g_elem (i32.add (local.get $p) (size-of GpsLayout))
      (global.get $GPS_VTYPE_FLOAT3) (i32.const 0) (i32.const 0) (i32.const 0)))
    (local.set $off (i32.const 12))
    (if (i32.and (local.get $fvf) (i32.const 16)) (then
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT3) (i32.const 3) (i32.const 0) (local.get $off)))
      (local.set $off (i32.add (local.get $off) (i32.const 12)))))
    (if (i32.and (local.get $fvf) (i32.const 32)) (then
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT1) (i32.const 4) (i32.const 0) (local.get $off)))
      (local.set $off (i32.add (local.get $off) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_D3DCOLOR) (global.get $GPS_USAGE_COLOR)
        (i32.const 0) (local.get $off)))
      (local.set $off (i32.add (local.get $off) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_D3DCOLOR) (global.get $GPS_USAGE_COLOR)
        (i32.const 1) (local.get $off)))))
    (local.set $i (i32.const 0))
    (block $tdone (loop $tc
      (br_if $tdone (i32.ge_u (local.get $i) (local.get $ntex)))
      (local.set $q (call $d9g_elem (local.get $q)
        (i32.sub (call $d9g_tc_size (local.get $fvf) (local.get $i)) (i32.const 1))
        (global.get $GPS_USAGE_TEXCOORD) (local.get $i) (call $d9g_xyz_tc_off (local.get $fvf) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $tc)))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_layout_cache (local.get $fvf) (local.get $stride) (i32.const 0x40000000) (local.get $id))
    (local.get $id))

  ;; Fixed-function T&L (untransformed FVF, lighting off) -> 09aj cascade
  ;; VS (+ PS unless the guest binds one). The cascade's world / view /
  ;; projection DEFs (c0..c11) are packed as zero so the key, and the
  ;; compiled shader, do not depend on them; the DEFs are dropped from the
  ;; IR and the real columns go out as stage-0 CONSTS per draw instead.
  ;; Inputs: v0 POSITION, v1 COLOR0, v(2+k) TEXCOORDk, v10 COLOR1 (the
  ;; implicit DCLs). Returns the VS id or -reason; $d9g_tl_ps gets the PS.
  ;; Cache mem+78080: 16 x {vs, ps, len, key 1440}.
  (func $d9g_fixed_tl (param $active i32) (param $fvf i32) (param $guest_ps i32) (result i32)
    (local $m i32) (local $d i32) (local $tab i32) (local $len i32) (local $i i32) (local $e i32)
    (local $bundle i32) (local $vs i32) (local $ps i32) (local $ir i32) (local $rec i32) (local $ntex i32)
    (local $uv i32) (local $set i32) (local $imp i32) (local $c i32) (local $mat i32)
    (local.set $m (call $d9g_m))
    (local.set $d (i32.add (local.get $m) (i32.const 4096)))
    (local.set $tab (i32.add (local.get $d) (i32.const 288)))
    (local.set $len (call $d9g_fixed_pack (local.get $active) (local.get $fvf) (local.get $guest_ps)))
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    ;; World / view / projection columns -> c0..c11 (mem+77840).
    (local.set $i (i32.const 0))
    (loop $cols
      (local.set $mat (i32.add (global.get $d9g_pw) (i32.add (i32.const 2068)
        (i32.shl (select (i32.const 10) (select (i32.const 0) (i32.const 1) (i32.eq (i32.shr_u (local.get $i) (i32.const 2)) (i32.const 1)))
          (i32.eqz (i32.shr_u (local.get $i) (i32.const 2)))) (i32.const 6)))))
      (local.set $mat (i32.add (local.get $mat) (i32.shl (i32.and (local.get $i) (i32.const 3)) (i32.const 2))))
      (local.set $c (i32.add (i32.add (local.get $m) (i32.const 77840)) (i32.shl (local.get $i) (i32.const 4))))
      (i32.store (local.get $c) (i32.load (local.get $mat)))
      (i32.store offset=4 (local.get $c) (i32.load offset=16 (local.get $mat)))
      (i32.store offset=8 (local.get $c) (i32.load offset=32 (local.get $mat)))
      (i32.store offset=12 (local.get $c) (i32.load offset=48 (local.get $mat)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cols (i32.lt_u (local.get $i) (i32.const 12))))
    (local.set $i (i32.const 0))
    (loop $finite
      (if (i32.eq (i32.and (i32.load (i32.add (i32.add (local.get $m) (i32.const 77840)) (i32.shl (local.get $i) (i32.const 2))))
            (i32.const 0x7f800000)) (i32.const 0x7f800000)) (then (return (i32.const -9))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $finite (i32.lt_u (local.get $i) (i32.const 48))))
    (local.set $i (i32.const 0))
    (loop $cache
      (local.set $e (i32.add (i32.add (local.get $m) (i32.const 78080)) (i32.mul (local.get $i) (i32.const 1452))))
      (if (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0)) (i32.eq (i32.load offset=8 (local.get $e)) (local.get $len)))
        (then (if (call $d3g_row_eq (i32.add (local.get $e) (i32.const 12)) (local.get $d) (local.get $len))
          (then
            (global.set $d9g_tl_ps (i32.load offset=4 (local.get $e)))
            (return (i32.load (local.get $e)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cache (i32.lt_u (local.get $i) (i32.const 16))))
    ;; uvRequired (VS only): the stages whose coordinate set exists.
    (if (local.get $guest_ps) (then
      (local.set $i (i32.const 0))
      (loop $uvs
        (local.set $set (call $d9g_tss (local.get $i) (i32.const 44)))
        (if (i32.lt_u (local.get $set) (local.get $ntex))
          (then (local.set $uv (i32.or (local.get $uv) (i32.shl (i32.const 1) (local.get $i))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $uvs (i32.lt_u (local.get $i) (i32.const 6))))))
    (local.set $bundle (if (result i32) (i32.eq (local.get $len) (i32.const 1440))
      (then (call $d3d_fixed_compile_cascade6 (local.get $d) (local.get $tab) (i32.const 6)
        (select (i32.const 1) (i32.const 3) (local.get $guest_ps)) (local.get $uv)))
      (else (call $d3d_fixed_compile_cascade5 (local.get $d) (local.get $tab) (i32.const 6)
        (select (i32.const 1) (i32.const 3) (local.get $guest_ps)) (local.get $uv)))))
    (if (i32.eqz (local.get $bundle)) (then (return (i32.const -9))))
    ;; Drop the matrix DEFs (op 81, c0..c11).
    (local.set $ir (i32.load offset=4 (local.get $bundle)))
    (local.set $i (i32.const 0))
    (block $ddone (loop $defs
      (br_if $ddone (i32.ge_u (local.get $i) (i32.load offset=16 (local.get $ir))))
      (local.set $rec (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (if (i32.and (i32.eq (i32.load (local.get $rec)) (i32.const 81))
            (i32.and (i32.eq (i32.load offset=16 (local.get $rec)) (i32.const 2)) (i32.lt_u (i32.load offset=20 (local.get $rec)) (i32.const 12))))
        (then (i32.store (local.get $rec) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $defs)))
    ;; Implicit DCLs for the FVF's inputs.
    (local.set $imp (i32.add (local.get $m) (i32.const 101952)))
    (memory.fill (local.get $imp) (i32.const 0) (i32.const 64))
    (i32.store (local.get $imp) (i32.const 0x80000000))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then (i32.store offset=4 (local.get $imp) (i32.const 0x8000000a))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then (i32.store offset=40 (local.get $imp) (i32.const 0x8001000a))))
    (local.set $i (i32.const 0))
    (block $tdone (loop $tcs
      (br_if $tdone (i32.ge_u (local.get $i) (local.get $ntex)))
      (i32.store (i32.add (local.get $imp) (i32.shl (i32.add (local.get $i) (i32.const 2)) (i32.const 2)))
        (i32.or (i32.const 0x80000005) (i32.shl (local.get $i) (i32.const 16))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $tcs)))
    (global.set $vc_implicit_dcl (local.get $imp))
    (local.set $vs (call $d9g_shader_emit (local.get $ir) (global.get $GPS_STAGE_VS)))
    (global.set $vc_implicit_dcl (i32.const 0))
    (if (i32.and (i32.ne (local.get $vs) (i32.const 0)) (i32.eqz (local.get $guest_ps)))
      (then
        (local.set $ps (call $d9g_shader_emit (i32.load offset=8 (local.get $bundle)) (global.get $GPS_STAGE_PS)))
        (if (i32.eqz (local.get $ps)) (then (call $d9g_release (local.get $vs)) (local.set $vs (i32.const 0))))))
    (call $d3d_fixed_free (local.get $bundle))
    (if (i32.eqz (local.get $vs)) (then (return (i32.const -8))))
    (local.set $i (global.get $d9g_rr_tl))
    (global.set $d9g_rr_tl (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 15)))
    (local.set $e (i32.add (i32.add (local.get $m) (i32.const 78080)) (i32.mul (local.get $i) (i32.const 1452))))
    (call $d9g_release (i32.load (local.get $e)))
    (call $d9g_release (i32.load offset=4 (local.get $e)))
    (i32.store (local.get $e) (local.get $vs))
    (i32.store offset=4 (local.get $e) (local.get $ps))
    (i32.store offset=8 (local.get $e) (local.get $len))
    (memory.copy (i32.add (local.get $e) (i32.const 12)) (local.get $d) (local.get $len))
    (global.set $d9g_tl_ps (local.get $ps))
    (local.get $vs))

  ;; ---- draws -----------------------------------------------------------------
  (func $d9g_vcount (param $prim i32) (param $n i32) (result i32)
    (if (i32.eq (local.get $prim) (i32.const 1)) (then (return (local.get $n))))
    (if (i32.eq (local.get $prim) (i32.const 2)) (then (return (i32.shl (local.get $n) (i32.const 1)))))
    (if (i32.eq (local.get $prim) (i32.const 3)) (then (return (i32.add (local.get $n) (i32.const 1)))))
    (if (i32.eq (local.get $prim) (i32.const 4)) (then (return (i32.mul (local.get $n) (i32.const 3)))))
    (i32.add (local.get $n) (i32.const 2)))

  ;; FVF vertex bytes (POSITIONT only reaches here).
  (func $d9g_fvf_size (param $fvf i32) (result i32)
    (local $n i32)
    (local.set $n (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (if (i32.gt_u (local.get $n) (i32.const 8)) (then (return (i32.const 0x7fffffff))))
    (call $d9g_tc_off (local.get $fvf) (local.get $n)))

  ;; $kind: 0 DrawPrimitiveUP, 1 DrawIndexedPrimitiveUP, 2 DrawPrimitive,
  ;; 3 DrawIndexedPrimitive. 0 = lowered (or nothing to draw), else reason.
  ;; Vertex stage ($vsmode): 0 POSITIONT FVF (vs 0, pretransformed layout),
  ;; 1 the guest's vertex shader (declaration or FVF layout), 2 fixed-
  ;; function T&L of an untransformed FVF (09aj cascade VS). VB/IB draws
  ;; are DRAWs from executor VBUF/IBUF copies of the 09ae buffers; fans and
  ;; a negative base vertex keep the DRAW_UP range copy.
  (func $d9g_draw_try (param $device i32) (param $desc i32) (param $kind i32) (result i32)
    (local $fvf i32) (local $r i32) (local $prim i32) (local $count i32) (local $n i32)
    (local $depth i32) (local $stencil i32) (local $fog i32) (local $active i32) (local $ps i32)
    (local $i i32) (local $nb i32) (local $tex i32) (local $set i32) (local $texmap i32) (local $ntex i32)
    (local $layout i32) (local $vptr i32) (local $stride i32) (local $iptr i32) (local $isize i32)
    (local $min i32) (local $num i32) (local $vpos i32) (local $ipos i32) (local $osize i32) (local $ocount i32)
    (local $dst i32) (local $v i32) (local $k i32) (local $slot i32) (local $guest_ps i32) (local $p i32)
    (local $oprim i32) (local $i0 i32) (local $b i32)
    (local $vsmode i32) (local $vs i32) (local $decl i32) (local $d3d8 i32) (local $direct i32)
    (local $vbuf i32) (local $ibuf i32) (local $voff i32) (local $ioff i32) (local $vcount i32) (local $minstride i32)
    (local.set $vs (i32.load (global.get $d9g_pw)))
    (local.set $decl (i32.load offset=8 (global.get $d9g_pw)))
    (local.set $fvf (i32.load offset=12 (global.get $d9g_pw)))
    (if (local.get $vs)
      (then
        (local.set $vsmode (i32.const 1))
        (if (i32.eqz (local.get $decl)) (then
          (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 2)) (then (return (i32.const 27))))))
        (if (local.get $decl) (then
          (local.set $d3d8 (i32.eq (i32.load offset=12 (call $g2w (local.get $decl))) (i32.const 0xd3d80002))))))
      (else
        (if (local.get $decl) (then (return (i32.const 2))))
        (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 4)) (then
          (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 2)) (then (return (i32.const 27))))
          (local.set $vsmode (i32.const 2))))))
    (if (local.get $vsmode) (then
      (if (call $d9g_rs (i32.const 152)) (then (return (i32.const 27))))
      (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
        (if (i32.or (call $d9g_rs (i32.const 151)) (call $d9g_rs (i32.const 167))) (then (return (i32.const 27))))
        (if (call $d9g_rs (i32.const 137)) (then (return (i32.const 28))))))))
    (local.set $prim (i32.load offset=24 (local.get $desc)))
    (local.set $count (i32.load offset=28 (local.get $desc)))
    (if (i32.or (i32.eqz (local.get $prim)) (i32.gt_u (local.get $prim) (i32.const 6))) (then (return (i32.const 26))))
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (local.set $r (call $d9g_bind (local.get $device) (local.get $desc)))
    (if (local.get $r) (then (return (local.get $r))))
    (if (global.get $d9g_cstale) (then (return (i32.const 13))))
    (if (i32.ne (call $d9g_rs (i32.const 8)) (i32.const 3)) (then (return (i32.const 15))))
    (if (i32.eq (call $d9g_rs (i32.const 9)) (i32.const 1)) (then (return (i32.const 16))))
    (if (i32.or (call $d9g_rs (i32.const 156)) (call $d9g_rs (i32.const 194))) (then (return (i32.const 22))))
    (local.set $i (i32.const 128))
    (loop $wraps
      (if (call $d9g_rs (local.get $i)) (then (return (i32.const 22))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $wraps (i32.lt_u (local.get $i) (i32.const 136))))
    (if (i32.eq (call $d9g_rs (i32.const 7)) (i32.const 2)) (then (return (i32.const 17))))
    (local.set $depth (i32.and (i32.eq (call $d9g_rs (i32.const 7)) (i32.const 1)) (i32.ne (global.get $d9g_ds_ptr) (i32.const 0))))
    (if (i32.and (local.get $depth) (i32.ne (global.get $d9g_ds_bad) (i32.const 0))) (then (return (i32.const 19))))
    (if (i32.and (local.get $depth) (i32.ne (i32.and (global.get $d9g_zstale) (i32.const 2)) (i32.const 0)))
      (then (return (i32.const 13))))
    (local.set $stencil (i32.and (i32.ne (call $d9g_rs (i32.const 52)) (i32.const 0)) (i32.ne (global.get $d9g_ds) (i32.const 0))))
    (if (i32.and (local.get $stencil) (i32.eqz (global.get $d9g_ds_d24))) (then (return (i32.const 18))))
    (if (i32.and (local.get $stencil) (i32.ne (i32.and (global.get $d9g_zstale) (i32.const 4)) (i32.const 0)))
      (then (return (i32.const 13))))
    (local.set $fog (i32.ne (call $d9g_rs (i32.const 28)) (i32.const 0)))
    (if (i32.and (local.get $fog) (i32.ne (call $d9g_rs (i32.const 35)) (i32.const 0))) (then (return (i32.const 11))))
    ;; Pixel stage: the guest's shader, or the fixed cascade.
    (local.set $guest_ps (i32.load offset=4 (global.get $d9g_pw)))
    (local.set $active (if (result i32) (local.get $guest_ps) (then (i32.const 6)) (else (call $d9g_active_stages))))
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (local.set $texmap (i32.const 0xffffff))
    (local.set $i (i32.const 0))
    (block $sdone (loop $stages
      (br_if $sdone (i32.ge_u (local.get $i) (local.get $active)))
      (if (i32.eqz (local.get $guest_ps)) (then
        (if (i32.or (i32.eq (call $d9g_tss (local.get $i) (i32.const 4)) (i32.const 22))
              (i32.eq (call $d9g_tss (local.get $i) (i32.const 4)) (i32.const 23)))
          (then (return (i32.const 7))))))
      ;; POSITIONT: a guest PS may read t_i with no texture bound: map every
      ;; stage whose set the FVF has (fixed VS output t_i = TEXCOORDINDEX set).
      (local.set $set (call $d9g_tss (local.get $i) (i32.const 44)))
      (if (i32.and (i32.and (i32.eqz (local.get $vsmode)) (i32.ne (local.get $guest_ps) (i32.const 0)))
            (i32.and (i32.eqz (call $d9g_tex_ptr (local.get $i))) (i32.lt_u (local.get $set) (local.get $ntex))))
        (then (local.set $texmap (i32.and (local.get $texmap)
          (i32.xor (i32.shl (i32.xor (local.get $set) (i32.const 15)) (i32.shl (local.get $i) (i32.const 2))) (i32.const -1))))))
      (if (call $d9g_tex_ptr (local.get $i)) (then
        (if (i32.ne (local.get $vsmode) (i32.const 1)) (then
          (if (call $d9g_tss (local.get $i) (i32.const 96)) (then (return (i32.const 12))))
          (if (i32.shr_u (local.get $set) (i32.const 16)) (then (return (i32.const 12))))))
        ;; Fixed pixel stages behind a programmable VS read t_i.
        (if (i32.and (i32.eq (local.get $vsmode) (i32.const 1)) (i32.eqz (local.get $guest_ps)))
          (then (if (i32.ne (local.get $set) (local.get $i)) (then (return (i32.const 12))))))
        (if (i32.eqz (local.get $vsmode)) (then
          (if (i32.ge_u (local.get $set) (local.get $ntex)) (then (return (i32.const 24))))
          (local.set $texmap (i32.and (local.get $texmap)
            (i32.xor (i32.shl (i32.xor (local.get $set) (i32.const 15)) (i32.shl (local.get $i) (i32.const 2))) (i32.const -1))))))
        (local.set $tex (call $d9g_texture (local.get $i)))
        (if (i32.lt_s (local.get $tex) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $tex)))))
        (local.set $slot (i32.add (i32.add (call $d9g_m) (i32.const 2848)) (i32.mul (local.get $nb) (i32.const 12))))
        (i32.store (local.get $slot) (local.get $i))
        (i32.store offset=4 (local.get $slot) (local.get $tex))
        (i32.store offset=8 (local.get $slot) (call $d9g_sampler (local.get $i)
          (i32.load offset=48 (call $g2w (call $d9g_tex_ptr (local.get $i))))))
        (local.set $nb (i32.add (local.get $nb) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $stages)))
    (if (i32.eq (local.get $vsmode) (i32.const 2))
      (then
        (local.set $vs (call $d9g_fixed_tl (local.get $active) (local.get $fvf) (local.get $guest_ps)))
        (if (i32.lt_s (local.get $vs) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $vs)))))
        (local.set $ps (if (result i32) (local.get $guest_ps)
          (then (call $d9g_guest_ps (local.get $guest_ps))) (else (global.get $d9g_tl_ps)))))
      (else
        (if (local.get $guest_ps)
          (then (local.set $ps (call $d9g_guest_ps (local.get $guest_ps))))
          (else (local.set $ps (call $d9g_fixed_ps (local.get $active)))))))
    (if (i32.lt_s (local.get $ps) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $ps)))))
    ;; Vertex source.
    (if (i32.le_u (local.get $kind) (i32.const 1))
      (then
        (local.set $vptr (i32.load offset=32 (local.get $desc)))
        (local.set $stride (i32.load offset=36 (local.get $desc))))
      (else
        (local.set $slot (call $g2w (call $d3d9_stream_slot (i32.load offset=4 (local.get $desc)) (i32.const 0))))
        (local.set $vbuf (i32.load (local.get $slot)))
        (local.set $vptr (i32.load offset=12 (local.get $slot)))
        (local.set $stride (i32.load offset=8 (local.get $slot)))))
    (local.set $minstride (call $d9g_fvf_size (local.get $fvf)))
    (if (local.get $vsmode) (then (local.set $minstride (i32.sub (local.get $minstride) (i32.const 4)))))
    (if (local.get $decl) (then (local.set $minstride (i32.const 4))))
    (if (i32.or (i32.or (i32.eqz (local.get $vptr)) (i32.and (local.get $stride) (i32.const 3)))
          (i32.or (i32.gt_u (local.get $stride) (i32.const 1024))
            (i32.lt_u (local.get $stride) (local.get $minstride))))
      (then (return (i32.const 3))))
    ;; Vertex stage objects (the declaration's layout first: a D3D8 one also
    ;; declares the shader's inputs).
    (if (i32.eq (local.get $vsmode) (i32.const 1)) (then
      (local.set $layout (if (result i32) (local.get $decl)
        (then (call $d9g_layout_decl (local.get $decl) (local.get $stride)))
        (else (call $d9g_layout_fvf (local.get $fvf) (local.get $stride)))))
      (if (i32.lt_s (local.get $layout) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $layout)))))
      (local.set $vs (call $d9g_guest_vs (local.get $vs) (select (local.get $decl) (i32.const 0) (local.get $d3d8))))
      (if (i32.lt_s (local.get $vs) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $vs)))))))
    (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
      (local.set $layout (call $d9g_layout_fvf (local.get $fvf) (local.get $stride)))))
    (local.set $n (call $d9g_vcount (local.get $prim) (local.get $count)))
    (local.set $oprim (select (i32.const 4) (local.get $prim) (i32.eq (local.get $prim) (i32.const 6))))
    (local.set $ocount (select (i32.mul (local.get $count) (i32.const 3)) (local.get $n) (i32.eq (local.get $prim) (i32.const 6))))
    (if (i32.and (local.get $kind) (i32.const 1))
      (then
        (local.set $iptr (i32.load offset=44 (local.get $desc)))
        (local.set $isize (select (i32.const 2) (i32.const 4) (i32.eq (i32.load offset=48 (local.get $desc)) (i32.const 101))))
        (local.set $min (i32.load offset=52 (local.get $desc)))
        (local.set $num (i32.load offset=56 (local.get $desc))))
      (else (local.set $min (i32.const 0)) (local.set $num (local.get $n))))
    (if (i32.or (i32.eqz (local.get $num)) (i32.gt_u (local.get $num) (i32.const 0x100000))) (then (return (i32.const 20))))
    (if (i32.gt_u (local.get $ocount) (i32.const 0x80000)) (then (return (i32.const 20))))
    ;; DRAW from the buffers: not a fan, base vertex inside the buffer.
    (if (i32.and (i32.ge_u (local.get $kind) (i32.const 2)) (i32.ne (local.get $prim) (i32.const 6))) (then
      (local.set $voff (i32.sub (local.get $vptr) (i32.add (local.get $vbuf) (i32.const 64))))
      (local.set $direct (i32.and (i32.ge_s (local.get $voff) (i32.const 0)) (i32.eqz (i32.and (local.get $voff) (i32.const 3)))))))
    (if (i32.and (i32.eqz (local.get $direct))
          (i32.gt_u (i32.mul (local.get $num) (local.get $stride)) (i32.const 0x200000)))
      (then (return (i32.const 20))))
    (local.set $depth (select (global.get $GPS_DEPTH_Z) (i32.const 0) (local.get $depth)))
    (local.set $r (call $d9g_raster (local.get $depth) (local.get $stencil) (local.get $fog)))
    (if (local.get $r) (then (return (local.get $r))))
    (if (local.get $direct)
      (then
        (local.set $vcount (select (i32.add (local.get $min) (local.get $num)) (local.get $n) (i32.and (local.get $kind) (i32.const 1))))
        (if (i32.and (local.get $kind) (i32.const 1)) (then
          ;; Indices are relative to the base vertex and must stay below vcount.
          (local.set $ibuf (i32.load offset=1732 (global.get $d9g_pw)))
          (local.set $ioff (i32.sub (local.get $iptr) (i32.add (local.get $ibuf) (i32.const 64))))
          (local.set $iptr (call $g2w (local.get $iptr)))
          (local.set $k (i32.const 0))
          (block $vdone (loop $vidx
            (br_if $vdone (i32.ge_u (local.get $k) (local.get $ocount)))
            (local.set $v (if (result i32) (i32.eq (local.get $isize) (i32.const 2))
              (then (i32.load16_u (i32.add (local.get $iptr) (i32.shl (local.get $k) (i32.const 1)))))
              (else (i32.load (i32.add (local.get $iptr) (i32.shl (local.get $k) (i32.const 2)))))))
            (if (i32.ge_u (local.get $v) (local.get $vcount)) (then (return (i32.const 21))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $vidx)))
          (local.set $ibuf (call $d9g_buffer (local.get $ibuf) (global.get $GPS_KIND_IBUF)))))
        (local.set $vbuf (call $d9g_buffer (local.get $vbuf) (global.get $GPS_KIND_VBUF))))
      (else
        ;; Indices first (they can still refuse), then the vertex range.
        (local.set $osize (select (i32.const 2) (i32.const 4) (i32.le_u (local.get $num) (i32.const 65536))))
        (if (i32.or (i32.and (local.get $kind) (i32.const 1)) (i32.eq (local.get $prim) (i32.const 6))) (then
          (local.set $ipos (call $d9g_arena (i32.add (i32.mul (local.get $ocount) (local.get $osize)) (i32.const 4))))
          (local.set $dst (call $d9g_aptr (local.get $ipos)))
          (local.set $iptr (select (call $g2w (local.get $iptr)) (i32.const 0) (i32.and (local.get $kind) (i32.const 1))))
          (local.set $k (i32.const 0))
          (block $idone (loop $idx
            (br_if $idone (i32.ge_u (local.get $k) (local.get $ocount)))
            ;; Source position: fans read (0, j+1, j+2) of the fan sequence.
            (local.set $b (local.get $k))
            (if (i32.eq (local.get $prim) (i32.const 6)) (then
              (local.set $i0 (i32.rem_u (local.get $k) (i32.const 3)))
              (local.set $b (select (i32.const 0) (i32.add (i32.div_u (local.get $k) (i32.const 3)) (local.get $i0))
                (i32.eqz (local.get $i0))))))
            (local.set $v (if (result i32) (local.get $iptr)
              (then (if (result i32) (i32.eq (local.get $isize) (i32.const 2))
                (then (i32.load16_u (i32.add (local.get $iptr) (i32.shl (local.get $b) (i32.const 1)))))
                (else (i32.load (i32.add (local.get $iptr) (i32.shl (local.get $b) (i32.const 2)))))))
              (else (local.get $b))))
            (local.set $v (i32.sub (local.get $v) (local.get $min)))
            (if (i32.ge_u (local.get $v) (local.get $num)) (then (return (i32.const 21))))
            (if (i32.eq (local.get $osize) (i32.const 2))
              (then (i32.store16 (i32.add (local.get $dst) (i32.shl (local.get $k) (i32.const 1))) (local.get $v)))
              (else (i32.store (i32.add (local.get $dst) (i32.shl (local.get $k) (i32.const 2))) (local.get $v))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $idx)))))
        (local.set $vpos (call $d9g_arena (i32.mul (local.get $num) (local.get $stride))))
        (memory.copy (call $d9g_aptr (local.get $vpos))
          (i32.add (call $g2w (local.get $vptr)) (i32.mul (local.get $min) (local.get $stride)))
          (i32.mul (local.get $num) (local.get $stride)))))
    (if (local.get $guest_ps) (then (call $d9g_ps_consts)))
    (if (i32.eq (local.get $vsmode) (i32.const 1)) (then
      (call $d9g_vs_consts (i32.add (global.get $d9g_pw) (i32.const 16)) (i32.const 0) (i32.const 96))
      (call $d9g_vs_consts (i32.add (global.get $d9g_pw) (i32.const 22684)) (i32.const 96) (i32.const 160))))
    (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
      (call $d9g_vs_consts (i32.add (call $d9g_m) (i32.const 77840)) (i32.const 0) (i32.const 12))))
    (call $d9g_bind_tex (local.get $nb))
    (call $d9g_viewport)
    (if (i32.eqz (local.get $vsmode)) (then
      (local.set $layout (call $d9g_layout (local.get $fvf) (local.get $stride) (local.get $texmap)))))
    (if (local.get $direct)
      (then
        (local.set $p (call $d9g_begin (global.get $GPS_OP_DRAW) (size-of GpsDraw)))
        (store.field GpsDraw prim (local.get $p) (local.get $prim))
        (store.field GpsDraw index_size (local.get $p)
          (select (local.get $isize) (i32.const 0) (i32.and (local.get $kind) (i32.const 1))))
        (store.field GpsDraw pad2 (local.get $p) (i32.const 0))
        (store.field GpsDraw vs (local.get $p) (local.get $vs))
        (store.field GpsDraw ps (local.get $p) (local.get $ps))
        (store.field GpsDraw layout (local.get $p) (local.get $layout))
        (store.field GpsDraw vbuf (local.get $p) (local.get $vbuf))
        (store.field GpsDraw voff (local.get $p) (local.get $voff))
        (store.field GpsDraw stride (local.get $p) (local.get $stride))
        (store.field GpsDraw ibuf (local.get $p) (select (local.get $ibuf) (i32.const 0) (i32.and (local.get $kind) (i32.const 1))))
        (store.field GpsDraw ioff (local.get $p) (select (local.get $ioff) (i32.const 0) (i32.and (local.get $kind) (i32.const 1))))
        (store.field GpsDraw count (local.get $p) (local.get $n))
        (store.field GpsDraw vcount (local.get $p) (local.get $vcount))
        (drop (call $d9g_end (local.get $p)))
        (call $d9g_stat (i32.const 74) (i32.const 1)))
      (else
        (local.set $p (call $d9g_begin (global.get $GPS_OP_DRAW_UP) (size-of GpsDraw)))
        (store.field GpsDraw prim (local.get $p) (local.get $oprim))
        (store.field GpsDraw index_size (local.get $p)
          (select (local.get $osize) (i32.const 0)
            (i32.or (i32.ne (i32.and (local.get $kind) (i32.const 1)) (i32.const 0)) (i32.eq (local.get $prim) (i32.const 6)))))
        (store.field GpsDraw pad2 (local.get $p) (i32.const 0))
        (store.field GpsDraw vs (local.get $p) (local.get $vs))
        (store.field GpsDraw ps (local.get $p) (local.get $ps))
        (store.field GpsDraw layout (local.get $p) (local.get $layout))
        (store.field GpsDraw vbuf (local.get $p) (i32.const 0))
        (store.field GpsDraw voff (local.get $p) (local.get $vpos))
        (store.field GpsDraw stride (local.get $p) (local.get $stride))
        (store.field GpsDraw ibuf (local.get $p) (i32.const 0))
        (store.field GpsDraw ioff (local.get $p) (local.get $ipos))
        (store.field GpsDraw count (local.get $p) (local.get $ocount))
        (store.field GpsDraw vcount (local.get $p) (local.get $num))
        (drop (call $d9g_end (local.get $p)))
        (call $d9g_stat (i32.const 0) (i32.const 1))))
    (call $d9g_stat (i32.const 1) (local.get $count))
    (i32.const 0))

  ;; Shared entry: the arm is on, the ring is up and this frame is not
  ;; already declined. Sets the state pointers. 0 = skip the call.
  (func $d9g_ready (param $desc i32) (result i32)
    (if (i32.or (i32.eqz (global.get $d9g_on)) (global.get $d9g_dead)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $desc)) (then (return (i32.const 0))))
    (if (i32.eq (global.get $d9g_mode) (i32.const 2)) (then (return (i32.const 0))))
    (if (i32.eqz (call $d9g_open)) (then (return (i32.const 0))))
    (call $d9g_enter (local.get $desc))
    (global.set $d9g_mode (i32.const 1))
    (i32.const 1))

  ;; After the old path drew ($result 1). See $d9g_draw_try for $kind.
  (func $d9g_draw (param $device i32) (param $kind i32) (param $result i32)
    (local $desc i32) (local $r i32)
    (if (i32.eqz (global.get $d9g_on)) (then (return)))
    (if (i32.ne (local.get $result) (i32.const 1)) (then
      (call $d9g_stat (i32.const 13) (i32.const 1)) (return)))
    (local.set $desc (call $d9g_desc (local.get $device)))
    (if (i32.eqz (call $d9g_ready (local.get $desc))) (then (return)))
    (local.set $r (call $d9g_draw_try (local.get $device) (local.get $desc) (local.get $kind)))
    (if (local.get $r) (then (call $d9g_decline (local.get $r)))))

  ;; After the old path cleared ($result 1). Viewport (and scissor) clip
  ;; every rect; a clear of the whole target makes that buffer coherent.
  (func $d9g_clear (param $device i32) (param $result i32)
    (local $desc i32) (local $r i32) (local $flags i32) (local $m i32) (local $clip i32) (local $rc i32)
    (local $count i32) (local $rects i32) (local $i i32) (local $p i32) (local $full i32) (local $rgba i32)
    (local $z f32)
    (if (i32.eqz (global.get $d9g_on)) (then (return)))
    (if (i32.ne (local.get $result) (i32.const 1)) (then
      (call $d9g_stat (i32.const 13) (i32.const 1)) (return)))
    (local.set $desc (call $d9g_desc (local.get $device)))
    (if (i32.eqz (call $d9g_ready (local.get $desc))) (then (return)))
    (local.set $r (call $d9g_bind (local.get $device) (local.get $desc)))
    (if (local.get $r) (then (call $d9g_decline (local.get $r)) (return)))
    (local.set $flags (i32.and (i32.load offset=44 (local.get $desc)) (i32.const 7)))
    (if (i32.or (i32.eqz (global.get $d9g_ds)) (global.get $d9g_ds_bad))
      (then (local.set $flags (i32.and (local.get $flags) (i32.const 1)))))
    (if (i32.eqz (global.get $d9g_ds_d24)) (then (local.set $flags (i32.and (local.get $flags) (i32.const 3)))))
    (if (i32.eqz (local.get $flags)) (then (return)))
    (local.set $m (call $d9g_m))
    (local.set $clip (i32.add (local.get $m) (i32.const 1008)))
    (call $d9g_vp_rect (local.get $clip))
    (call $d9g_scissor_clip (local.get $clip))
    (local.set $rgba (call $d9g_rgba (i32.load offset=48 (local.get $desc))))
    (if (i32.eqz (call $d9g_has_alpha (global.get $d9g_rt_fmt)))
      (then (local.set $rgba (i32.or (local.get $rgba) (i32.const 0xff000000)))))
    (local.set $z (f32.min (f32.const 1) (f32.max (f32.const 0) (f32.reinterpret_i32 (i32.load offset=52 (local.get $desc))))))
    (local.set $count (i32.load offset=56 (local.get $desc)))
    (local.set $rects (i32.load offset=60 (local.get $desc)))
    (if (i32.or (i32.eqz (local.get $rects)) (i32.eqz (local.get $count))) (then (local.set $count (i32.const 0))))
    (if (i32.gt_u (local.get $count) (i32.const 256)) (then (call $d9g_decline (i32.const 20)) (return)))
    (block $done (loop $each
      ;; $p = clip, or clip intersected with the guest rect $rc.
      (local.set $p (i32.add (local.get $m) (i32.const 2816)))
      (memory.copy (local.get $p) (local.get $clip) (i32.const 16))
      (if (local.get $count) (then
        (local.set $rc (call $g2w (i32.add (local.get $rects) (i32.shl (local.get $i) (i32.const 4)))))
        (if (i32.gt_s (i32.load (local.get $rc)) (i32.load (local.get $p))) (then (i32.store (local.get $p) (i32.load (local.get $rc)))))
        (if (i32.gt_s (i32.load offset=4 (local.get $rc)) (i32.load offset=4 (local.get $p))) (then (i32.store offset=4 (local.get $p) (i32.load offset=4 (local.get $rc)))))
        (if (i32.lt_s (i32.load offset=8 (local.get $rc)) (i32.load offset=8 (local.get $p))) (then (i32.store offset=8 (local.get $p) (i32.load offset=8 (local.get $rc)))))
        (if (i32.lt_s (i32.load offset=12 (local.get $rc)) (i32.load offset=12 (local.get $p))) (then (i32.store offset=12 (local.get $p) (i32.load offset=12 (local.get $rc)))))))
      (if (i32.and (i32.lt_s (i32.load (local.get $p)) (i32.load offset=8 (local.get $p)))
            (i32.lt_s (i32.load offset=4 (local.get $p)) (i32.load offset=12 (local.get $p))))
        (then
          (if (i32.and (i32.and (i32.eqz (i32.load (local.get $p))) (i32.eqz (i32.load offset=4 (local.get $p))))
                (i32.and (i32.eq (i32.load offset=8 (local.get $p)) (global.get $d9g_rt_w))
                  (i32.eq (i32.load offset=12 (local.get $p)) (global.get $d9g_rt_h))))
            (then (local.set $full (i32.const 1))))
          (local.set $r (call $d9g_begin (global.get $GPS_OP_CLEAR) (size-of GpsClear)))
          (store.field GpsClear mask (local.get $r) (local.get $flags))
          (store.field GpsClear colormask (local.get $r) (i32.const 15))
          (store.field GpsClear pad (local.get $r) (i32.const 0))
          (store.field GpsClear rgba (local.get $r) (local.get $rgba))
          (store.field GpsClear z (local.get $r) (local.get $z))
          (store.field GpsClear stencil (local.get $r) (i32.and (i32.load offset=24 (local.get $desc)) (i32.const 255)))
          (store.field GpsClear left (local.get $r) (i32.load (local.get $p)))
          (store.field GpsClear top (local.get $r) (i32.load offset=4 (local.get $p)))
          (store.field GpsClear right (local.get $r) (i32.load offset=8 (local.get $p)))
          (store.field GpsClear bottom (local.get $r) (i32.load offset=12 (local.get $p)))
          (drop (call $d9g_end (local.get $r)))
          (call $d9g_stat (i32.const 2) (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $each (i32.lt_u (local.get $i) (local.get $count)))))
    (if (local.get $full) (then
      (if (i32.and (local.get $flags) (i32.const 1)) (then (global.set $d9g_cstale (i32.const 0))))
      (global.set $d9g_zstale (i32.and (global.get $d9g_zstale)
        (i32.xor (i32.and (local.get $flags) (i32.const 6)) (i32.const -1))))
      ;; D16 has no stencil to go stale.
      (if (i32.eqz (global.get $d9g_ds_d24))
        (then (global.set $d9g_zstale (i32.and (global.get $d9g_zstale) (i32.const 2))))))))

  (func $d9g_frame_end (param $gpu i32)
    (call $d9g_stat (select (i32.const 4) (i32.const 5) (local.get $gpu)) (i32.const 1))
    (global.set $d9g_mode (i32.const 0))
    (global.set $d9g_frame (i32.add (global.get $d9g_frame) (i32.const 1))))

  ;; Device / swap-chain Present, before the old present. 1 = PRESENTed from
  ;; the ring (the caller skips 0x30002 and its RT -> DIB copy).
  (func $d9g_present (param $device i32) (result i32)
    (local $h i32) (local $p i32) (local $seq i32) (local $hwnd i32) (local $state i32)
    (if (i32.or (i32.eqz (global.get $d9g_on)) (global.get $d9g_dead)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $d9g_h)) (then (return (i32.const 0))))
    ;; Old-path presents by cause (stat 64 + k): 0 another device / no
    ;; target, 1 declined frame, 2 executor target stale, 3 no window.
    (if (i32.or (i32.ne (local.get $device) (global.get $d9g_dev)) (i32.eqz (global.get $d9g_rt)))
      (then (call $d9g_stat (i32.const 64) (i32.const 1)) (call $d9g_frame_end (i32.const 0)) (return (i32.const 0))))
    (if (i32.eq (global.get $d9g_mode) (i32.const 2))
      (then (call $d9g_stat (i32.const 65) (i32.const 1)) (call $d9g_frame_end (i32.const 0)) (return (i32.const 0))))
    (if (global.get $d9g_cstale)
      (then (call $d9g_stat (i32.const 66) (i32.const 1)) (call $d9g_frame_end (i32.const 0)) (return (i32.const 0))))
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (local.set $hwnd (if (result i32) (local.get $state)
      (then (call $gl32 (i32.add (local.get $state) (i32.const 1684)))) (else (i32.const 0))))
    (if (i32.eqz (local.get $hwnd))
      (then (call $d9g_stat (i32.const 67) (i32.const 1)) (call $d9g_frame_end (i32.const 0)) (return (i32.const 0))))
    (local.set $h (global.get $d9g_h))
    ;; At most two PRESENTs in flight.
    (if (i32.and (i32.ne (global.get $d9g_pseq0) (i32.const 0))
          (i32.lt_s (i32.sub (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing done_seq))) (global.get $d9g_pseq0)) (i32.const 0)))
      (then
        (call $d9g_stat (i32.const 11) (i32.const 1))
        (if (i32.ne (call $d9g_kick (global.get $GPS_KICK_SYNC)) (i32.const 1)) (then (call $d9g_fail (i32.const 4))))))
    (call $gps_mark (local.get $h) (global.get $d9g_frame) (i32.const 0x44394650))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_PRESENT) (size-of GpsPresent)))
    (store.field GpsPresent rt (local.get $p) (global.get $d9g_rt))
    (store.field GpsPresent gamma (local.get $p) (i32.const 0))
    (store.field GpsPresent x (local.get $p) (i32.const 0))
    (store.field GpsPresent y (local.get $p) (i32.const 0))
    (store.field GpsPresent w (local.get $p) (global.get $d9g_rt_w))
    (store.field GpsPresent h (local.get $p) (global.get $d9g_rt_h))
    (store.field GpsPresent surface (local.get $p) (local.get $hwnd))
    (store.field GpsPresent dst_x (local.get $p) (i32.const 0))
    (store.field GpsPresent dst_y (local.get $p) (i32.const 0))
    (store.field GpsPresent stamp (local.get $p) (global.get $d9g_frame))
    (local.set $seq (call $d9g_end (local.get $p)))
    (global.set $d9g_pseq0 (global.get $d9g_pseq1))
    (global.set $d9g_pseq1 (local.get $seq))
    ;; GDI touching the window now asks the host for the GPU picture first.
    (local.set $state (call $gdi_window_surface_record (local.get $hwnd) (i32.const 0)))
    (if (local.get $state) (then (i32.atomic.store offset=28 (local.get $state) (i32.const 1))))
    (call $d9g_stat (i32.const 3) (i32.const 1))
    (drop (call $d9g_kick (global.get $GPS_KICK_ASYNC)))
    (call $d9g_frame_end (i32.const 1))
    (i32.const 1))

  ;; ---- readbacks and CPU writes ---------------------------------------------
  ;; Executor RT -> guest pixels at wasm $bits (pitch, D3DFORMAT $fmt).
  (func $d9g_readback (param $bits i32) (param $pitch i32) (param $fmt i32) (param $site i32)
    (local $w i32) (local $hgt i32) (local $pix i32) (local $band i32) (local $y i32) (local $n i32)
    (local $pos i32) (local $p i32) (local $seq i32) (local $src i32) (local $k i32) (local $h i32)
    (local.set $h (global.get $d9g_h))
    (local.set $w (global.get $d9g_rt_w))
    (local.set $hgt (global.get $d9g_rt_h))
    (local.set $pix (call $d9g_pix (local.get $fmt)))
    (if (i32.eqz (local.get $pix)) (then (return)))
    (local.set $band (i32.div_u (i32.const 0x200000) (i32.shl (local.get $w) (i32.const 2))))
    (if (i32.eqz (local.get $band)) (then (local.set $band (i32.const 1))))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $y) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $y)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $d9g_arena (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n))))
      (call $gps_slot_arm (local.get $h) (i32.const 0))
      (local.set $p (call $d9g_begin (global.get $GPS_OP_READBACK) (size-of GpsReadback)))
      (store.field GpsReadback rt (local.get $p) (global.get $d9g_rt))
      (store.field GpsReadback x (local.get $p) (i32.const 0))
      (store.field GpsReadback y (local.get $p) (local.get $y))
      (store.field GpsReadback w (local.get $p) (local.get $w))
      (store.field GpsReadback h (local.get $p) (local.get $n))
      (store.field GpsReadback fmt (local.get $p) (global.get $GPS_FMT_A8B8G8R8))
      (store.field GpsReadback dst (local.get $p) (local.get $pos))
      (store.field GpsReadback pitch (local.get $p) (i32.shl (local.get $w) (i32.const 2)))
      (store.field GpsReadback slot (local.get $p) (i32.const 0))
      (local.set $seq (call $d9g_end (local.get $p)))
      (call $d9g_stat (i32.const 11) (i32.const 1))
      (call $gps_slot_wait (local.get $h) (i32.const 0) (local.get $seq))
      (local.set $src (call $d9g_aptr (local.get $pos)))
      (local.set $k (i32.const 0))
      (block $rd (loop $rows
        (br_if $rd (i32.ge_u (local.get $k) (local.get $n)))
        (call $d3g_rgba_to_row
          (i32.add (local.get $src) (i32.mul (local.get $k) (i32.shl (local.get $w) (i32.const 2))))
          (i32.add (local.get $bits) (i32.mul (i32.add (local.get $y) (local.get $k)) (local.get $pitch)))
          (local.get $w) (i32.and (local.get $pix) (i32.const 255)) (i32.shr_u (local.get $pix) (i32.const 8)))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $rows)))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (call $page_watch_write (local.get $bits) (i32.mul (local.get $hgt) (local.get $pitch)))
    (call $d9g_stat (i32.const 6) (i32.const 1))
    (call $d9g_stat (i32.add (i32.const 48) (local.get $site)) (i32.const 1)))

  ;; Guest pixels -> executor RT rows [x, x+w) x [y, y+h).
  (func $d9g_upload_rect (param $bits i32) (param $pitch i32) (param $fmt i32)
      (param $x i32) (param $y i32) (param $w i32) (param $hgt i32)
    (local $pix i32) (local $band i32) (local $row i32) (local $n i32) (local $pos i32) (local $p i32) (local $k i32)
    (local $dst i32) (local $bpp i32)
    (local.set $pix (call $d9g_pix (local.get $fmt)))
    (if (i32.or (i32.eqz (local.get $pix)) (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt)))) (then (return)))
    (local.set $bpp (i32.shr_u (local.get $pix) (i32.const 8)))
    (local.set $band (i32.div_u (i32.const 0x200000) (i32.shl (local.get $w) (i32.const 2))))
    (if (i32.eqz (local.get $band)) (then (local.set $band (i32.const 1))))
    (block $done (loop $bands
      (br_if $done (i32.ge_u (local.get $row) (local.get $hgt)))
      (local.set $n (i32.sub (local.get $hgt) (local.get $row)))
      (if (i32.gt_u (local.get $n) (local.get $band)) (then (local.set $n (local.get $band))))
      (local.set $pos (call $d9g_arena (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n))))
      (local.set $dst (call $d9g_aptr (local.get $pos)))
      (local.set $k (i32.const 0))
      (block $cd (loop $rows
        (br_if $cd (i32.ge_u (local.get $k) (local.get $n)))
        (call $d3g_row_to_rgba
          (i32.add (local.get $bits) (i32.add
            (i32.mul (i32.add (i32.add (local.get $y) (local.get $row)) (local.get $k)) (local.get $pitch))
            (i32.mul (local.get $x) (i32.shr_u (local.get $bpp) (i32.const 3)))))
          (i32.add (local.get $dst) (i32.mul (local.get $k) (i32.shl (local.get $w) (i32.const 2))))
          (local.get $w) (i32.and (local.get $pix) (i32.const 255)) (local.get $bpp))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $rows)))
      (local.set $p (call $d9g_begin (global.get $GPS_OP_UPLOAD) (size-of GpsUpload)))
      (store.field GpsUpload id (local.get $p) (global.get $d9g_rt))
      (store.field GpsUpload level (local.get $p) (i32.const 0))
      (store.field GpsUpload face (local.get $p) (i32.const 0))
      (store.field GpsUpload x (local.get $p) (local.get $x))
      (store.field GpsUpload y (local.get $p) (i32.add (local.get $y) (local.get $row)))
      (store.field GpsUpload w (local.get $p) (local.get $w))
      (store.field GpsUpload h (local.get $p) (local.get $n))
      (store.field GpsUpload pitch (local.get $p) (i32.shl (local.get $w) (i32.const 2)))
      (store.field GpsUpload src (local.get $p) (local.get $pos))
      (store.field GpsUpload bytes (local.get $p) (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (drop (call $d9g_end (local.get $p)))
      (local.set $row (i32.add (local.get $row) (local.get $n)))
      (br $bands)))
    (call $d9g_stat (i32.const 7) (i32.const 1)))

  ;; The executor RT holds this device's back buffer and is coherent.
  (func $d9g_coherent (param $device i32) (result i32)
    (i32.and
      (i32.and (i32.ne (global.get $d9g_on) (i32.const 0)) (i32.eqz (global.get $d9g_dead)))
      (i32.and
        (i32.and (i32.ne (global.get $d9g_h) (i32.const 0)) (i32.ne (global.get $d9g_rt) (i32.const 0)))
        (i32.and (i32.eq (global.get $d9g_dev) (local.get $device)) (i32.eqz (global.get $d9g_cstale))))))

  ;; 09am $d3d9_backbuffer_dc_sync, after the old call: a coherent executor
  ;; back buffer is what LockRect / GetDC see (readback, sites 0/1); what the
  ;; CPU wrote on unlock / ReleaseDC goes back up.
  (func $d9g_bb_sync (param $device i32) (param $upload i32) (param $result i32) (result i32)
    (local $rt i32) (local $state i32) (local $flags i32)
    (if (i32.ne (local.get $result) (i32.const 1)) (then (return (local.get $result))))
    (if (i32.or (i32.eqz (global.get $d9g_on)) (global.get $d9g_dead)) (then (return (local.get $result))))
    (if (i32.or (i32.eqz (global.get $d9g_h)) (i32.ne (global.get $d9g_dev) (local.get $device)))
      (then (return (local.get $result))))
    (if (i32.eqz (global.get $d9g_rt)) (then (return (local.get $result))))
    (local.set $rt (call $d3ddev_rt_entry (local.get $device)))
    (local.set $flags (load.field DxObject flags (local.get $rt)))
    (if (local.get $upload)
      (then
        (if (i32.and (local.get $flags) (i32.shl (i32.const 1) (i32.const 26)))
          (then
            (local.set $state (call $g2w (call $d3d9_program_state (local.get $device))))
            (call $d9g_upload_rect (load.field DxObject misc1 (local.get $rt)) (load.field DxObject pitch (local.get $rt))
              (global.get $d9g_rt_fmt)
              (i32.load offset=22028 (local.get $state)) (i32.load offset=22032 (local.get $state))
              (i32.load offset=22036 (local.get $state)) (i32.load offset=22040 (local.get $state))))
          (else
            (call $d9g_upload_rect (load.field DxObject misc1 (local.get $rt)) (load.field DxObject pitch (local.get $rt))
              (global.get $d9g_rt_fmt) (i32.const 0) (i32.const 0) (global.get $d9g_rt_w) (global.get $d9g_rt_h)))))
      (else
        (if (call $d9g_coherent (local.get $device)) (then
          (call $d9g_readback (load.field DxObject misc1 (local.get $rt)) (load.field DxObject pitch (local.get $rt))
            (global.get $d9g_rt_fmt)
            (select (i32.const 0) (i32.const 1) (i32.ne (i32.and (local.get $flags) (i32.shl (i32.const 1) (i32.const 29))) (i32.const 0))))))))
    (local.get $result))

  ;; GetRenderTargetData of the back buffer into the surface $dst (wasm),
  ;; after the old call succeeded.
  (func $d9g_rtdata (param $device i32) (param $dst i32) (param $result i32)
    (if (i32.ne (local.get $result) (i32.const 1)) (then (return)))
    (if (i32.eqz (call $d9g_coherent (local.get $device))) (then (return)))
    (call $d9g_readback (call $g2w (i32.load offset=40 (local.get $dst))) (i32.load offset=48 (local.get $dst))
      (i32.load offset=28 (local.get $dst)) (i32.const 2)))

  ;; 09am: StretchRect / ColorFill / UpdateSurface wrote the device's back
  ;; buffer on the old path only. The executor copy is stale until a full
  ;; Clear: this frame presents from the old path, readbacks leave the old
  ;; pixels alone, and draws until that Clear decline (13).
  (func $d9g_rt_written (param $device i32)
    (if (i32.and (i32.ne (global.get $d9g_dev) (i32.const 0)) (i32.eq (global.get $d9g_dev) (local.get $device)))
      (then (global.set $d9g_cstale (i32.const 1)))))

  ;; Reset succeeded / device released: the executor targets are gone.
  (func $d9g_reset (param $device i32)
    (if (i32.or (i32.eqz (global.get $d9g_on)) (i32.eqz (global.get $d9g_h))) (then (return)))
    (if (i32.ne (global.get $d9g_dev) (local.get $device)) (then (return)))
    (call $d9g_drop_targets)
    (global.set $d9g_mode (i32.const 0)))

  ;; CLI capture: land the executor's picture in the back buffer DIB.
  ;; The last frame was ring-presented, so the old present's RT -> DIB copy
  ;; and $dx_present never ran for it: do both from the executor here.
  ;; Skipped (stat 68 + k): 0 executor not coherent, 1 no target entry.
  (func (export "d3d9_gps_sync_front")
    (local $rt i32)
    (if (i32.eqz (call $d9g_coherent (global.get $d9g_dev)))
      (then (call $d9g_stat (i32.const 68) (i32.const 1)) (return)))
    (local.set $rt (call $d3ddev_rt_entry (global.get $d9g_dev)))
    (if (i32.eqz (local.get $rt)) (then (call $d9g_stat (i32.const 69) (i32.const 1)) (return)))
    (call $d9g_readback (load.field DxObject misc1 (local.get $rt)) (load.field DxObject pitch (local.get $rt))
      (global.get $d9g_rt_fmt) (i32.const 3))
    (call $dx_present (local.get $rt)))
