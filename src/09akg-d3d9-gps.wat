  ;; ---- D3D9 / D3D8 on GPU stream v2 (the only D3D9 renderer) ---------------
  ;; The D3D9 device -- and D3D8, which 09ac routes onto the same device code
  ;; -- renders by lowering every draw, clear, surface operation and present
  ;; into GPS records on ring api 4, executed by the host's webgl, software
  ;; or null executor. There is no other path (d3d9-retire S4 deleted the
  ;; old JS host, lib/d3d9-host.js and its 0x3000x opcodes): a host with no
  ;; executor answers the first kick with 0, and CreateDevice then fails
  ;; with D3DERR_NOTAVAILABLE ($d3d9_executor_ok).
  ;;
  ;; Fail fast. Anything the ring cannot express yet is a DECLINE: counted
  ;; (d3d9_gps_stat 12 and 16 + reason), logged (0x44394750, 0x100 + reason)
  ;; and a trap. Nothing renders it some other way and nothing is skipped.
  ;;
  ;; Pixels live in the executor; the guest's CPU copies are written only
  ;; when the guest touches them: LockRect / GetDC of the back buffer
  ;; ($d9g_bb_sync), Lock of a colour surface ($d9r_cpu_sync),
  ;; GetRenderTargetData, and the CLI capture -- each a READBACK (or a fill
  ;; when the RT is one known Clear colour). The back buffer RT is made on
  ;; first use and starts from the back buffer DIB as a held upload
  ;; ($d9r_lead0); a colour surface's RT starts from its CPU bits.
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
  ;;   2 declaration with fixed-function T&L that has neither (or both of)
  ;;     POSITION0 and POSITIONT0. A declaration that is not an FVF layout
  ;;     is gathered into one since d9ms ("d9ms: gathered vertex input"),
  ;;     and so are the 27 cases multi-stream, types past D3DCOLOR and
  ;;     XYZW / XYZBn FVFs; 27 keeps POSITIONT under a VS, a declaration
  ;;     of more than 15 elements under a VS, a POSITIONT one with PSIZE or
  ;;     a non-D3DCOLOR colour, a blend without its BLENDWEIGHT /
  ;;     BLENDINDICES (or a tween without POSITION1 / NORMAL1), a VERTEXBLEND
  ;;     value D3D does not define, and an index that is not an integer in
  ;;     0..255. Vertex blending and tweening lower since d9ms ("vertex
  ;;     blending"); entries past the 22-entry shader palette blend on the
  ;;     CPU since d9cpu ("indexed vertex blending on the CPU")
  ;;   3 no vertex pointer / bad stride   -
  ;;   4 offscreen colour target          RT objects for color surfaces
  ;;   5 render-target texture            RT-as-texture residency
  ;;   6 cube texture -- lowers since d9cpu (CREATE kind CUBE, six faces);
  ;;     only a non-square cube declines
  ;;   7 bump-env stage                   bump constants into CONSTS
  ;;   8 canonicalizer declined           09af1
  ;;   9 09aj fixed lowering rejected     09aj
  ;;  10 texture not decodable/locked     09ae decode
  ;;  11 table (pixel) fog                fog table texture from start/end
  ;;  12 texture transform / texgen (or a  09aj rows +64 matrices as CONSTS
  ;;     non-default TEXCOORDINDEX behind a programmable VS with fixed PS);
  ;;     PROJECTED lowers but for COUNT1 and the cases the d9pj block lists
  ;;  13 (retired in S4: no decline leaves an executor target stale)
  ;;  14 blend factor BLENDFACTOR/SRCCOLOR2  executor blend-constant state
  ;;  15 point / wireframe fill           executor fill modes
  ;;  16 flat shading the CPU cannot make exact: under a guest VS or fixed
  ;;     lighting the VS runs on the CPU since d9fv (POSITIONT list draws),
  ;;     declining only vertex fog, a primitive that needs clipping, an
  ;;     oT6/7 write or a VM failure (stats 121..124); flat colours from the
  ;;     vertex data expand on the CPU (d9cpu); points ignore it
  ;;  17 W-buffer the ring cannot express: an executor without
  ;;     GPS_CAP_WBUFFER, a projection with no finite positive Wfar, or a
  ;;     DEPTHBIAS / SLOPESCALEDEPTHBIAS under it (d9wb block); W-buffering
  ;;     itself lowers since d9wb (RASTER depth_mode 3)
  ;;  18 stencil without D24S8            -
  ;;  19 depth surface size != target     -
  ;;  20 a zero-vertex draw, over 16M elements or 64K Clear rects; larger
  ;;     draws are split on the CPU and Clears emit one record per rect (d9cpu)
  ;;  21 index outside [min, min+num)     -
  ;;  22 point sprites / WRAPn / sRGB write  -
  ;;  23 backbuffer format not convertible -
  ;;  24 (unused since d9cpu: the missing set reads (0,0) from a padded copy)
  ;;  25 texture over 2048 (unreachable: CreateTexture refuses > 2048)
  ;;  26 primitive type out of range
  ;;  27 vertex input not lowerable: declaration element off stream 0, type
  ;;     past D3DCOLOR, POSITIONT in a declaration; XYZB/XYZW FVF; vertex
  ;;     blending; user clip planes without GPS_CAP_CLIP_PLANES, or fixed
  ;;     T&L planes under a singular View*Projection (d9cl block)
  ;;  28 lighting the ring cannot express: more than 8 lights, a bad light
  ;;     type or material source, a non-finite light/material value, a
  ;;     singular world-view (normal matrix). Lighting itself lowers since
  ;;     S3: compiled once per SHAPE (light types, spot falloff class,
  ;;     sources, flags), values sent as c40..c95 per draw.
  ;; Readback sites (stat 48 + s): 0 LockRect of the back buffer, 1 GetDC
  ;; on the back buffer, 2 GetRenderTargetData / colour surface Lock, 3 CLI
  ;; capture (d3d9_gps_sync_front), 4 the ring's back buffer passes to
  ;; another device (the first one's picture lands in its DIB), 5 (retired:
  ;; only a released surface or a Reset drops a colour RT, and neither
  ;; keeps its pixels). Nothing else reads the executor back.
  ;; Traps ($d9g_fail, logged 0x44394750 then the code): 1 / 40 / 41 no
  ;; scratch memory, 2 ring open failed, 4 PRESENT sync kick failed, 10 no
  ;; executor for a call CreateDevice should have refused, 11 device without
  ;; program state, 12 Present with no window, 13 / 14 back buffer RT not
  ;; makeable (Present / GetRenderTargetData), 15 surface table full, 16
  ;; ColorFill, 17 UpdateSurface, 18 StretchRect, 19 GetRenderTargetData of
  ;; a colour surface -- each one the ring cannot express; 0x100 + r a
  ;; draw / clear decline.
  ;; Stats: 0 DRAW_UPs, 1 primitives, 2 clears, 3 ring presents, 4 frames,
  ;; 5 (retired), 6 readbacks, 7 RT uploads (CPU wrote the
  ;; back buffer), 8 texture level uploads, 9 texture hits, 10 shaders,
  ;; 11 syncs, 12 declines, 13 (retired), 14 ring opens, 15 no executor,
  ;; 16.. reasons,
  ;; 72 buffer uploads, 73 buffer hits, 74 DRAWs from buffers, 75 CLIP
  ;; records sent, 76 back
  ;; buffer locks that needed no readback (the DIB was current), 77 locks
  ;; filled with the last full Clear's colour, 78 unlock uploads folded into
  ;; a later one, 79 colour surface locks that needed no readback, 80
  ;; (retired), 81 back buffer RTs seeded from the DIB, 82 draws
  ;; blended on the CPU (d9cpu), 83 draws expanded on the CPU into list
  ;; DRAW_UPs, 84 DRAW_UP chunks those emitted (d9cpu), 88 windowed Presents
  ;; stretched from source to destination rect ($d9g_present), 89 stretched
  ;; Presents shown unscaled (no COPY cap), 120..125 d9fv (its block).
  ;;
  ;; Block $d9g_mem: +0 stats (128 words), +512 RASTER stage, +608 its
  ;; cache, +704 viewport cache (24), +768 bind cache {n, 6 x {slot, tex,
  ;; sampler}}, +864 PS consts cache (128), +1024 layout cache 32 x {fvf,
  ;; stride, texmap, id}, +1536 sampler cache 32 x {k0, k1, k2, k3, id, -},
  ;; +2304 guest PS cache 32 x {ptr, len, sum, id}, +2816 clear rect
  ;; scratch, +2848 BIND staging (6 x 12), +2944 Present stretch RT {id,
  ;; w, h} ($d9g_present_target), +4096 fixed scratch (DFX1 288 +
  ;; 6 x 192 rows), +5632 fixed PS cache 32 x {id, len, key 1440}, +52224
  ;; texture cache 256 x 80 {t, id, w, h, levels, fmt, seq[13], -},
  ;; +72704 buffer cache 64 x {buf, seq, len, id}, +73728 VS constant
  ;; shadow 256 x 16, +77824 shadow valid, +77840 fixed VS c0..c11
  ;; staging, +78080 fixed T&L cache 16 x {vs, ps, len, key 1440},
  ;; +101312 guest VS cache 32 x {ptr, len, sum, d3d8 decl, id},
  ;; +101952 implicit-DCL table (16 words, see 09af1 $vc_implicit_dcl),
  ;; +102400 fixed T&L lighting-shape keys 16 x 64 (beside +78080's
  ;; entries), +103424 DLT1 block (128 + 8 x 128), +104576 its shape key
  ;; (64), +104640 DFX1 with the real matrices (288), +104928 lit VS
  ;; c40..c95 staging (56 x 16), +105824 its memo {valid, len, matrices
  ;; 128, DLT1 1152}, +107136 value-scratch IR (32 + 32 x 128), +111616
  ;; fixed VS texture-matrix c16..c39 staging (24 x 16), +112000 cube face
  ;; seqs, 256 x 312 beside the texture cache's slots (d9cpu), +191872
  ;; d9rt surface table 128 x 32 (see "d9rt").

  (global $D9G_MEM_SIZE i32 (i32.const 195968))
  (global $d9g_dead (mut i32) (i32.const 0))
  (global $d9g_h (mut i32) (i32.const 0))
  (global $d9g_mem (mut i32) (i32.const 0))
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
  ;; The last $d9g_fixed_tl was lit: its c40..c95 are staged at mem+104928.
  (global $d9g_tl_lit (mut i32) (i32.const 0))
  ;; ... and its texture-transform stage mask (c16..c39 staged at
  ;; mem+111616) and whether a texgen read the normal matrix (c40..c43 at
  ;; mem+104928 when unlit; the lit staging already carries them).
  (global $d9g_tl_tex (mut i32) (i32.const 0))
  (global $d9g_tl_nrm (mut i32) (i32.const 0))
  ;; Per call: program state and render-state block (wasm).
  (global $d9g_pw (mut i32) (i32.const 0))
  (global $d9g_rsw (mut i32) (i32.const 0))
  ;; The guest's copy of the executor RT (the back buffer DIB at
  ;; $d9g_cpu_bits / $d9g_cpu_pitch), while $d9g_coherent: 0 unknown, 1 the
  ;; DIB holds the RT, 2 the DIB is newer inside [px0,px1) x [py0,py1) (an
  ;; Unlock's upload not sent yet: $d9g_flush sends it before the executor
  ;; next reads the RT), 3 the RT is one full Clear of $d9g_cpu_rgba (a Lock
  ;; fills the DIB instead of reading back).
  (global $d9g_cpu (mut i32) (i32.const 0))
  (global $d9g_cpu_bits (mut i32) (i32.const 0))
  (global $d9g_cpu_pitch (mut i32) (i32.const 0))
  (global $d9g_cpu_rgba (mut i32) (i32.const 0))
  (global $d9g_px0 (mut i32) (i32.const 0))
  (global $d9g_py0 (mut i32) (i32.const 0))
  (global $d9g_px1 (mut i32) (i32.const 0))
  (global $d9g_py1 (mut i32) (i32.const 0))

  ;; Process-owned GPS frontend state. CPU Workers instantiate this module
  ;; separately, but share one D3D9 consumer and its resource namespace. Copy
  ;; the complete frontend state at OUTER D3D guard boundaries, including caches
  ;; and frame stamps: sharing only the next id leaves another producer's
  ;; executor state hidden behind this instance's stale cache. The guard owns
  ;; DX_PROCESS_STATE+40 (snapshot WA); +36 already owns serialization. No
  ;; region/map change, host executor reset, or resource-id exception is needed.
  ;; Keep this layout complete: test-d3d9-state-guard checks all mutable fields.
  (layout D3d9GpsState
    (field d9g_dead i32)
    (field d9g_h i32)
    (field d9g_mem i32)
    (field d9g_next_id i32)
    (field d9g_dev i32)
    (field d9g_rt i32)
    (field d9g_rt_w i32)
    (field d9g_rt_h i32)
    (field d9g_rt_fmt i32)
    (field d9g_ds i32)
    (field d9g_ds_ptr i32)
    (field d9g_ds_d24 i32)
    (field d9g_ds_bad i32)
    (field d9g_frame i32)
    (field d9g_pseq0 i32)
    (field d9g_pseq1 i32)
    (field d9g_c_color i32)
    (field d9g_c_depth i32)
    (field d9g_rr_shader i32)
    (field d9g_rr_gps i32)
    (field d9g_rr_layout i32)
    (field d9g_rr_sampler i32)
    (field d9g_rr_buffer i32)
    (field d9g_rr_vs i32)
    (field d9g_rr_tl i32)
    (field d9g_tl_ps i32)
    (field d9g_tl_lit i32)
    (field d9g_tl_tex i32)
    (field d9g_tl_nrm i32)
    (field d9g_pw i32)
    (field d9g_rsw i32)
    (field d9g_cpu i32)
    (field d9g_cpu_bits i32)
    (field d9g_cpu_pitch i32)
    (field d9g_cpu_rgba i32)
    (field d9g_px0 i32)
    (field d9g_py0 i32)
    (field d9g_px1 i32)
    (field d9g_py1 i32)
    (field d3d9_profile i32)
    (field d9g_caps i32)
    (field d9cl_mem i32)
    (field d9cl_proj i32)
    (field d9wb_far f32)
    (field d9ms_mem i32)
    (field d9ms_n i32)
    (field d9ms_stride i32)
    (field d9ms_vsmode i32)
    (field d9ms_fvf i32)
    (field d9ms_types i32)
    (field d9ms_blend i32)
    (field d9ms_bi i32)
    (field d9ms_bcount i32)
    (field d9cpu_mem i32)
    (field d9cpu_blend i32)
    (field d9cpu_nrm i32)
    (field d9cpu_nrm4 i32)
    (field d9cpu_bw i32)
    (field d9cpu_bwc i32)
    (field d9cpu_bi i32)
    (field d9cpu_bic i32)
    (field d9fv_force i32)
    (field d9fv_mem i32)
    (field d9fv_rr i32)
    (field d9fv_lrr i32)
    (field d9fv_on i32)
    (field d9fv_prog i32)
    (field d9fv_ctx i32)
    (field d9fv_nin i32)
    (field d9fv_olayout i32)
    (field d9r_tgt i32)
    (field d9r_dse i32)
    (field d9g_tw i32)
    (field d9g_th i32)
    (field d9g_tfmt i32)
    (field d9r_gen i32)
    (field d9r_sid i32)
    (field d9r_sw i32)
    (field d9r_sh i32)
    (field d9r_sfmt i32)
  )
  (func $d9g_state_load
    (local $p i32)
    (local.set $p (i32.load offset=40 (global.get $DX_PROCESS_STATE)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (global.set $d9g_dead (load.field D3d9GpsState d9g_dead (local.get $p)))
    (global.set $d9g_h (load.field D3d9GpsState d9g_h (local.get $p)))
    (global.set $d9g_mem (load.field D3d9GpsState d9g_mem (local.get $p)))
    (global.set $d9g_next_id (load.field D3d9GpsState d9g_next_id (local.get $p)))
    (global.set $d9g_dev (load.field D3d9GpsState d9g_dev (local.get $p)))
    (global.set $d9g_rt (load.field D3d9GpsState d9g_rt (local.get $p)))
    (global.set $d9g_rt_w (load.field D3d9GpsState d9g_rt_w (local.get $p)))
    (global.set $d9g_rt_h (load.field D3d9GpsState d9g_rt_h (local.get $p)))
    (global.set $d9g_rt_fmt (load.field D3d9GpsState d9g_rt_fmt (local.get $p)))
    (global.set $d9g_ds (load.field D3d9GpsState d9g_ds (local.get $p)))
    (global.set $d9g_ds_ptr (load.field D3d9GpsState d9g_ds_ptr (local.get $p)))
    (global.set $d9g_ds_d24 (load.field D3d9GpsState d9g_ds_d24 (local.get $p)))
    (global.set $d9g_ds_bad (load.field D3d9GpsState d9g_ds_bad (local.get $p)))
    (global.set $d9g_frame (load.field D3d9GpsState d9g_frame (local.get $p)))
    (global.set $d9g_pseq0 (load.field D3d9GpsState d9g_pseq0 (local.get $p)))
    (global.set $d9g_pseq1 (load.field D3d9GpsState d9g_pseq1 (local.get $p)))
    (global.set $d9g_c_color (load.field D3d9GpsState d9g_c_color (local.get $p)))
    (global.set $d9g_c_depth (load.field D3d9GpsState d9g_c_depth (local.get $p)))
    (global.set $d9g_rr_shader (load.field D3d9GpsState d9g_rr_shader (local.get $p)))
    (global.set $d9g_rr_gps (load.field D3d9GpsState d9g_rr_gps (local.get $p)))
    (global.set $d9g_rr_layout (load.field D3d9GpsState d9g_rr_layout (local.get $p)))
    (global.set $d9g_rr_sampler (load.field D3d9GpsState d9g_rr_sampler (local.get $p)))
    (global.set $d9g_rr_buffer (load.field D3d9GpsState d9g_rr_buffer (local.get $p)))
    (global.set $d9g_rr_vs (load.field D3d9GpsState d9g_rr_vs (local.get $p)))
    (global.set $d9g_rr_tl (load.field D3d9GpsState d9g_rr_tl (local.get $p)))
    (global.set $d9g_tl_ps (load.field D3d9GpsState d9g_tl_ps (local.get $p)))
    (global.set $d9g_tl_lit (load.field D3d9GpsState d9g_tl_lit (local.get $p)))
    (global.set $d9g_tl_tex (load.field D3d9GpsState d9g_tl_tex (local.get $p)))
    (global.set $d9g_tl_nrm (load.field D3d9GpsState d9g_tl_nrm (local.get $p)))
    (global.set $d9g_pw (load.field D3d9GpsState d9g_pw (local.get $p)))
    (global.set $d9g_rsw (load.field D3d9GpsState d9g_rsw (local.get $p)))
    (global.set $d9g_cpu (load.field D3d9GpsState d9g_cpu (local.get $p)))
    (global.set $d9g_cpu_bits (load.field D3d9GpsState d9g_cpu_bits (local.get $p)))
    (global.set $d9g_cpu_pitch (load.field D3d9GpsState d9g_cpu_pitch (local.get $p)))
    (global.set $d9g_cpu_rgba (load.field D3d9GpsState d9g_cpu_rgba (local.get $p)))
    (global.set $d9g_px0 (load.field D3d9GpsState d9g_px0 (local.get $p)))
    (global.set $d9g_py0 (load.field D3d9GpsState d9g_py0 (local.get $p)))
    (global.set $d9g_px1 (load.field D3d9GpsState d9g_px1 (local.get $p)))
    (global.set $d9g_py1 (load.field D3d9GpsState d9g_py1 (local.get $p)))
    (global.set $d3d9_profile (load.field D3d9GpsState d3d9_profile (local.get $p)))
    (global.set $d9g_caps (load.field D3d9GpsState d9g_caps (local.get $p)))
    (global.set $d9cl_mem (load.field D3d9GpsState d9cl_mem (local.get $p)))
    (global.set $d9cl_proj (load.field D3d9GpsState d9cl_proj (local.get $p)))
    (global.set $d9wb_far (load.field D3d9GpsState d9wb_far (local.get $p)))
    (global.set $d9ms_mem (load.field D3d9GpsState d9ms_mem (local.get $p)))
    (global.set $d9ms_n (load.field D3d9GpsState d9ms_n (local.get $p)))
    (global.set $d9ms_stride (load.field D3d9GpsState d9ms_stride (local.get $p)))
    (global.set $d9ms_vsmode (load.field D3d9GpsState d9ms_vsmode (local.get $p)))
    (global.set $d9ms_fvf (load.field D3d9GpsState d9ms_fvf (local.get $p)))
    (global.set $d9ms_types (load.field D3d9GpsState d9ms_types (local.get $p)))
    (global.set $d9ms_blend (load.field D3d9GpsState d9ms_blend (local.get $p)))
    (global.set $d9ms_bi (load.field D3d9GpsState d9ms_bi (local.get $p)))
    (global.set $d9ms_bcount (load.field D3d9GpsState d9ms_bcount (local.get $p)))
    (global.set $d9cpu_mem (load.field D3d9GpsState d9cpu_mem (local.get $p)))
    (global.set $d9cpu_blend (load.field D3d9GpsState d9cpu_blend (local.get $p)))
    (global.set $d9cpu_nrm (load.field D3d9GpsState d9cpu_nrm (local.get $p)))
    (global.set $d9cpu_nrm4 (load.field D3d9GpsState d9cpu_nrm4 (local.get $p)))
    (global.set $d9cpu_bw (load.field D3d9GpsState d9cpu_bw (local.get $p)))
    (global.set $d9cpu_bwc (load.field D3d9GpsState d9cpu_bwc (local.get $p)))
    (global.set $d9cpu_bi (load.field D3d9GpsState d9cpu_bi (local.get $p)))
    (global.set $d9cpu_bic (load.field D3d9GpsState d9cpu_bic (local.get $p)))
    (global.set $d9fv_force (load.field D3d9GpsState d9fv_force (local.get $p)))
    (global.set $d9fv_mem (load.field D3d9GpsState d9fv_mem (local.get $p)))
    (global.set $d9fv_rr (load.field D3d9GpsState d9fv_rr (local.get $p)))
    (global.set $d9fv_lrr (load.field D3d9GpsState d9fv_lrr (local.get $p)))
    (global.set $d9fv_on (load.field D3d9GpsState d9fv_on (local.get $p)))
    (global.set $d9fv_prog (load.field D3d9GpsState d9fv_prog (local.get $p)))
    (global.set $d9fv_ctx (load.field D3d9GpsState d9fv_ctx (local.get $p)))
    (global.set $d9fv_nin (load.field D3d9GpsState d9fv_nin (local.get $p)))
    (global.set $d9fv_olayout (load.field D3d9GpsState d9fv_olayout (local.get $p)))
    (global.set $d9r_tgt (load.field D3d9GpsState d9r_tgt (local.get $p)))
    (global.set $d9r_dse (load.field D3d9GpsState d9r_dse (local.get $p)))
    (global.set $d9g_tw (load.field D3d9GpsState d9g_tw (local.get $p)))
    (global.set $d9g_th (load.field D3d9GpsState d9g_th (local.get $p)))
    (global.set $d9g_tfmt (load.field D3d9GpsState d9g_tfmt (local.get $p)))
    (global.set $d9r_gen (load.field D3d9GpsState d9r_gen (local.get $p)))
    (global.set $d9r_sid (load.field D3d9GpsState d9r_sid (local.get $p)))
    (global.set $d9r_sw (load.field D3d9GpsState d9r_sw (local.get $p)))
    (global.set $d9r_sh (load.field D3d9GpsState d9r_sh (local.get $p)))
    (global.set $d9r_sfmt (load.field D3d9GpsState d9r_sfmt (local.get $p)))
  )
  (func $d9g_state_save
    (local $p i32) (local $g i32)
    (local.set $p (i32.load offset=40 (global.get $DX_PROCESS_STATE)))
    ;; D3DIM-only dispatch and guard users need no D3D9 allocation.
    (if (i32.and (i32.eqz (local.get $p)) (i32.eqz (global.get $d9g_mem)))
      (then (return)))
    (if (i32.eqz (local.get $p)) (then
      (local.set $g (call $gps_alloc (size-of D3d9GpsState)))
      (if (i32.eqz (local.get $g)) (then (call $d9g_fail (i32.const 1))))
      (local.set $p (call $gps_wa (local.get $g)))))
    (store.field D3d9GpsState d9g_dead (local.get $p) (global.get $d9g_dead))
    (store.field D3d9GpsState d9g_h (local.get $p) (global.get $d9g_h))
    (store.field D3d9GpsState d9g_mem (local.get $p) (global.get $d9g_mem))
    (store.field D3d9GpsState d9g_next_id (local.get $p) (global.get $d9g_next_id))
    (store.field D3d9GpsState d9g_dev (local.get $p) (global.get $d9g_dev))
    (store.field D3d9GpsState d9g_rt (local.get $p) (global.get $d9g_rt))
    (store.field D3d9GpsState d9g_rt_w (local.get $p) (global.get $d9g_rt_w))
    (store.field D3d9GpsState d9g_rt_h (local.get $p) (global.get $d9g_rt_h))
    (store.field D3d9GpsState d9g_rt_fmt (local.get $p) (global.get $d9g_rt_fmt))
    (store.field D3d9GpsState d9g_ds (local.get $p) (global.get $d9g_ds))
    (store.field D3d9GpsState d9g_ds_ptr (local.get $p) (global.get $d9g_ds_ptr))
    (store.field D3d9GpsState d9g_ds_d24 (local.get $p) (global.get $d9g_ds_d24))
    (store.field D3d9GpsState d9g_ds_bad (local.get $p) (global.get $d9g_ds_bad))
    (store.field D3d9GpsState d9g_frame (local.get $p) (global.get $d9g_frame))
    (store.field D3d9GpsState d9g_pseq0 (local.get $p) (global.get $d9g_pseq0))
    (store.field D3d9GpsState d9g_pseq1 (local.get $p) (global.get $d9g_pseq1))
    (store.field D3d9GpsState d9g_c_color (local.get $p) (global.get $d9g_c_color))
    (store.field D3d9GpsState d9g_c_depth (local.get $p) (global.get $d9g_c_depth))
    (store.field D3d9GpsState d9g_rr_shader (local.get $p) (global.get $d9g_rr_shader))
    (store.field D3d9GpsState d9g_rr_gps (local.get $p) (global.get $d9g_rr_gps))
    (store.field D3d9GpsState d9g_rr_layout (local.get $p) (global.get $d9g_rr_layout))
    (store.field D3d9GpsState d9g_rr_sampler (local.get $p) (global.get $d9g_rr_sampler))
    (store.field D3d9GpsState d9g_rr_buffer (local.get $p) (global.get $d9g_rr_buffer))
    (store.field D3d9GpsState d9g_rr_vs (local.get $p) (global.get $d9g_rr_vs))
    (store.field D3d9GpsState d9g_rr_tl (local.get $p) (global.get $d9g_rr_tl))
    (store.field D3d9GpsState d9g_tl_ps (local.get $p) (global.get $d9g_tl_ps))
    (store.field D3d9GpsState d9g_tl_lit (local.get $p) (global.get $d9g_tl_lit))
    (store.field D3d9GpsState d9g_tl_tex (local.get $p) (global.get $d9g_tl_tex))
    (store.field D3d9GpsState d9g_tl_nrm (local.get $p) (global.get $d9g_tl_nrm))
    (store.field D3d9GpsState d9g_pw (local.get $p) (global.get $d9g_pw))
    (store.field D3d9GpsState d9g_rsw (local.get $p) (global.get $d9g_rsw))
    (store.field D3d9GpsState d9g_cpu (local.get $p) (global.get $d9g_cpu))
    (store.field D3d9GpsState d9g_cpu_bits (local.get $p) (global.get $d9g_cpu_bits))
    (store.field D3d9GpsState d9g_cpu_pitch (local.get $p) (global.get $d9g_cpu_pitch))
    (store.field D3d9GpsState d9g_cpu_rgba (local.get $p) (global.get $d9g_cpu_rgba))
    (store.field D3d9GpsState d9g_px0 (local.get $p) (global.get $d9g_px0))
    (store.field D3d9GpsState d9g_py0 (local.get $p) (global.get $d9g_py0))
    (store.field D3d9GpsState d9g_px1 (local.get $p) (global.get $d9g_px1))
    (store.field D3d9GpsState d9g_py1 (local.get $p) (global.get $d9g_py1))
    (store.field D3d9GpsState d3d9_profile (local.get $p) (global.get $d3d9_profile))
    (store.field D3d9GpsState d9g_caps (local.get $p) (global.get $d9g_caps))
    (store.field D3d9GpsState d9cl_mem (local.get $p) (global.get $d9cl_mem))
    (store.field D3d9GpsState d9cl_proj (local.get $p) (global.get $d9cl_proj))
    (store.field D3d9GpsState d9wb_far (local.get $p) (global.get $d9wb_far))
    (store.field D3d9GpsState d9ms_mem (local.get $p) (global.get $d9ms_mem))
    (store.field D3d9GpsState d9ms_n (local.get $p) (global.get $d9ms_n))
    (store.field D3d9GpsState d9ms_stride (local.get $p) (global.get $d9ms_stride))
    (store.field D3d9GpsState d9ms_vsmode (local.get $p) (global.get $d9ms_vsmode))
    (store.field D3d9GpsState d9ms_fvf (local.get $p) (global.get $d9ms_fvf))
    (store.field D3d9GpsState d9ms_types (local.get $p) (global.get $d9ms_types))
    (store.field D3d9GpsState d9ms_blend (local.get $p) (global.get $d9ms_blend))
    (store.field D3d9GpsState d9ms_bi (local.get $p) (global.get $d9ms_bi))
    (store.field D3d9GpsState d9ms_bcount (local.get $p) (global.get $d9ms_bcount))
    (store.field D3d9GpsState d9cpu_mem (local.get $p) (global.get $d9cpu_mem))
    (store.field D3d9GpsState d9cpu_blend (local.get $p) (global.get $d9cpu_blend))
    (store.field D3d9GpsState d9cpu_nrm (local.get $p) (global.get $d9cpu_nrm))
    (store.field D3d9GpsState d9cpu_nrm4 (local.get $p) (global.get $d9cpu_nrm4))
    (store.field D3d9GpsState d9cpu_bw (local.get $p) (global.get $d9cpu_bw))
    (store.field D3d9GpsState d9cpu_bwc (local.get $p) (global.get $d9cpu_bwc))
    (store.field D3d9GpsState d9cpu_bi (local.get $p) (global.get $d9cpu_bi))
    (store.field D3d9GpsState d9cpu_bic (local.get $p) (global.get $d9cpu_bic))
    (store.field D3d9GpsState d9fv_force (local.get $p) (global.get $d9fv_force))
    (store.field D3d9GpsState d9fv_mem (local.get $p) (global.get $d9fv_mem))
    (store.field D3d9GpsState d9fv_rr (local.get $p) (global.get $d9fv_rr))
    (store.field D3d9GpsState d9fv_lrr (local.get $p) (global.get $d9fv_lrr))
    (store.field D3d9GpsState d9fv_on (local.get $p) (global.get $d9fv_on))
    (store.field D3d9GpsState d9fv_prog (local.get $p) (global.get $d9fv_prog))
    (store.field D3d9GpsState d9fv_ctx (local.get $p) (global.get $d9fv_ctx))
    (store.field D3d9GpsState d9fv_nin (local.get $p) (global.get $d9fv_nin))
    (store.field D3d9GpsState d9fv_olayout (local.get $p) (global.get $d9fv_olayout))
    (store.field D3d9GpsState d9r_tgt (local.get $p) (global.get $d9r_tgt))
    (store.field D3d9GpsState d9r_dse (local.get $p) (global.get $d9r_dse))
    (store.field D3d9GpsState d9g_tw (local.get $p) (global.get $d9g_tw))
    (store.field D3d9GpsState d9g_th (local.get $p) (global.get $d9g_th))
    (store.field D3d9GpsState d9g_tfmt (local.get $p) (global.get $d9g_tfmt))
    (store.field D3d9GpsState d9r_gen (local.get $p) (global.get $d9r_gen))
    (store.field D3d9GpsState d9r_sid (local.get $p) (global.get $d9r_sid))
    (store.field D3d9GpsState d9r_sw (local.get $p) (global.get $d9r_sw))
    (store.field D3d9GpsState d9r_sh (local.get $p) (global.get $d9r_sh))
    (store.field D3d9GpsState d9r_sfmt (local.get $p) (global.get $d9r_sfmt))
    (i32.store offset=40 (global.get $DX_PROCESS_STATE) (local.get $p)))

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

  ;; ---- capabilities (retirement slice S2) ------------------------------------
  ;; What the guest is told about the device is decided here, from two
  ;; things known without asking the host per call: the launch profile the
  ;; host states once (d3d9_profile_set: bit 0 the app opted in to the
  ;; programmable profile -- lib/apps.js d3d9Programmable, --d3d9-programmable
  ;; -- bit 1 the executor is the software one, whose shaders run on the WAT
  ;; VM), and the ring's capability block, read at $d9g_open. BLENDOP and
  ;; the R5G6B5 back buffer stay software-executor answers. 0: no executor
  ;; (CreateDevice fails then, so nothing else is asked).
  (global $d3d9_profile (mut i32) (i32.const 0))
  (global $d9g_caps (mut i32) (i32.const 0))
  (func (export "d3d9_profile_set") (param $bits i32)
    (global.set $d3d9_profile (i32.and (local.get $bits) (i32.const 3))))
  (func $d3d9_caps_profile (result i32)
    (if (i32.eqz (call $d9g_open)) (then (return (i32.const 0))))
    ;; No executor stated its caps: nothing is advertised.
    (if (i32.eqz (i32.and (global.get $d9g_caps) (global.get $GPS_CAP_VALID))) (then (return (i32.const 0))))
    (global.get $d3d9_profile))
  ;; CreateDevice: 1 when an executor drains the ring.
  (func $d3d9_executor_ok (result i32)
    (call $d9g_open))
  ;; 1 when the programmable profile is on and the executor is software.
  (func $d3d9_caps_software (param $profile i32) (result i32)
    (i32.eq (local.get $profile) (i32.const 3)))
  (func (export "d3d9_gps_stat") (param $i i32) (result i32)
    (if (i32.or (i32.eqz (global.get $d9g_mem)) (i32.ge_u (local.get $i) (i32.const 128)))
      (then (return (i32.const 0))))
    (i32.load (i32.add (global.get $d9g_mem) (i32.shl (local.get $i) (i32.const 2)))))
  (func (export "d3d9_gps_active") (result i32)
    (i32.ne (global.get $d9g_h) (i32.const 0)))

  ;; ---- ring plumbing ---------------------------------------------------------
  (func $d9g_kick (param $mode i32) (result i32)
    (call $gps_kick_mark (global.get $d9g_h))
    (call $gps_kick (global.get $d9g_h) (local.get $mode)))

  (func $d9g_begin (param $op i32) (param $n i32) (result i32)
    (call $gps_begin_auto (global.get $d9g_h) (local.get $op) (local.get $n)))

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

  ;; The ring, opened on first use. 0 = no executor for the run (D3D9 has
  ;; no device then).
  (func $d9g_open (result i32)
    (local $h i32)
    (if (global.get $d9g_h) (then (return (i32.const 1))))
    (if (global.get $d9g_dead) (then (return (i32.const 0))))
    (drop (call $d9g_m))
    (local.set $h (call $gps_ring_open (global.get $GPS_API_D3D9) (i32.const 0x100000) (i32.const 0x800000)))
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
    ;; The consumer wrote its capability block before it ran the SYNC.
    (global.set $d9g_caps (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing caps_flags))))
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

  ;; Fail fast: a decline is counted, logged (0x100 + reason) and traps.
  (func $d9g_decline (param $why i32)
    (call $d9g_stat (i32.const 12) (i32.const 1))
    (call $gps_stat_api (global.get $GPS_API_D3D9) (global.get $GPS_STAT_DECLINES) (i32.const 1))
    (call $d9g_stat (i32.add (i32.const 16) (local.get $why)) (i32.const 1))
    (call $d9g_fail (i32.add (i32.const 0x100) (local.get $why))))

  ;; ---- targets ---------------------------------------------------------------
  ;; The back buffer RT goes (another device takes the ring, a resize).
  (func $d9g_drop_bb
    (call $d9g_release (global.get $d9g_rt))
    (call $d9g_drop_present_target)
    (global.set $d9g_rt (i32.const 0))
    (global.set $d9g_dev (i32.const 0))
    (global.set $d9g_cpu (i32.const 0))
    (global.set $d9r_tgt (i32.const 0))
    (global.set $d9r_dse (i32.const 0))
    (global.set $d9g_ds (i32.const 0))
    (global.set $d9g_ds_ptr (i32.const 0))
    (global.set $d9g_c_color (i32.const -1))
    (global.set $d9g_c_depth (i32.const -1)))

  ;; Reset / device release: every executor target goes.
  (func $d9g_drop_targets
    (call $d9g_drop_bb)
    (call $d9r_drop_all))

  ;; The ring's back buffer is about to stop being $d9g_dev's: land that
  ;; device's picture in its back buffer DIB (readback site 4), which its
  ;; next RT starts from ($d9r_lead0).
  (func $d9g_park
    (local $rt i32) (local $bits i32) (local $pitch i32)
    (if (i32.or (i32.eqz (global.get $d9g_rt)) (i32.eqz (global.get $d9g_dev))) (then (return)))
    (call $d9g_flush)
    (local.set $rt (call $d3ddev_rt_entry (global.get $d9g_dev)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $bits (load.field DxObject misc1 (local.get $rt)))
    (local.set $pitch (load.field DxObject pitch (local.get $rt)))
    (if (i32.or (i32.eqz (local.get $bits))
          (i32.or (i32.ne (load.field DxObject width (local.get $rt)) (global.get $d9g_rt_w))
            (i32.ne (load.field DxObject height (local.get $rt)) (global.get $d9g_rt_h))))
      (then (return)))
    (block $have
      (br_if $have (i32.and (i32.eq (global.get $d9g_cpu) (i32.const 1))
        (i32.and (i32.eq (global.get $d9g_cpu_bits) (local.get $bits)) (i32.eq (global.get $d9g_cpu_pitch) (local.get $pitch)))))
      (if (i32.eq (global.get $d9g_cpu) (i32.const 3)) (then
        (br_if $have (call $d9g_fill (local.get $bits) (local.get $pitch) (global.get $d9g_rt_fmt) (global.get $d9g_cpu_rgba)))))
      (call $d9g_readback (local.get $bits) (local.get $pitch) (global.get $d9g_rt_fmt) (i32.const 4))))

  ;; The device's back buffer as executor RT $d9g_rt ($w x $hgt, from the
  ;; call's descriptor or the swap chain entry). 0, or a decline reason.
  (func $d9g_bb (param $device i32) (param $w i32) (param $hgt i32) (result i32)
    (local $fmt i32)
    (local.set $fmt (call $d3d9_backbuffer_format (local.get $device)))
    (if (i32.eqz (call $d9g_pix (local.get $fmt))) (then (return (i32.const 23))))
    (if (i32.or (i32.or (i32.gt_u (local.get $w) (i32.const 4096)) (i32.gt_u (local.get $hgt) (i32.const 4096)))
          (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt))))
      (then (return (i32.const 23))))
    (if (i32.or (i32.ne (global.get $d9g_dev) (local.get $device))
          (i32.or (i32.or (i32.ne (global.get $d9g_rt_w) (local.get $w)) (i32.ne (global.get $d9g_rt_h) (local.get $hgt)))
            (i32.or (i32.ne (global.get $d9g_rt_fmt) (local.get $fmt)) (i32.eqz (global.get $d9g_rt)))))
      (then
        ;; Another device takes the executor: its picture goes to its DIB.
        (if (i32.ne (global.get $d9g_dev) (local.get $device)) (then (call $d9g_park)))
        (call $d9g_drop_bb)
        (global.set $d9g_dev (local.get $device))
        (global.set $d9g_rt_w (local.get $w))
        (global.set $d9g_rt_h (local.get $hgt))
        (global.set $d9g_rt_fmt (local.get $fmt))
        (global.set $d9g_rt (call $d9g_id))
        (call $gps_create (global.get $d9g_h) (global.get $d9g_rt) (global.get $GPS_KIND_RT)
          (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
        (call $d9r_lead0 (local.get $device) (local.get $w) (local.get $hgt))))
    (i32.const 0))

  ;; 1 when the ring holds $device's back buffer, made now if needed (a
  ;; surface operation or Present before any draw). A back buffer format
  ;; the ring cannot hold declines (23).
  (func $d9g_bb_ensure (param $device i32) (result i32)
    (local $rt i32) (local $r i32)
    (if (i32.eqz (local.get $device)) (then (return (i32.const 0))))
    (if (i32.eqz (call $d9g_open)) (then (call $d9g_fail (i32.const 10))))
    (if (i32.and (i32.eq (global.get $d9g_dev) (local.get $device)) (i32.ne (global.get $d9g_rt) (i32.const 0)))
      (then (return (i32.const 1))))
    (local.set $rt (call $d3ddev_rt_entry (local.get $device)))
    (if (i32.eqz (local.get $rt)) (then (return (i32.const 0))))
    (local.set $r (call $d9g_bb (local.get $device)
      (load.field DxObject width (local.get $rt)) (load.field DxObject height (local.get $rt))))
    (if (local.get $r) (then (call $d9g_decline (local.get $r))))
    (i32.const 1))

  ;; d9rt lead0: a back buffer RT the ring makes for $device starts from
  ;; the back buffer DIB (where the guest's CPU writes and a parked picture
  ;; are), held like an Unlock's upload ($d9g_flush): a full Clear first
  ;; drops it. Without a DIB of the RT's size it starts as created.
  (func $d9r_lead0 (param $device i32) (param $w i32) (param $hgt i32)
    (local $rt i32)
    (local.set $rt (call $d3ddev_rt_entry (local.get $device)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (if (i32.or (i32.eqz (load.field DxObject misc1 (local.get $rt)))
          (i32.or (i32.ne (load.field DxObject width (local.get $rt)) (local.get $w))
            (i32.ne (load.field DxObject height (local.get $rt)) (local.get $hgt))))
      (then (return)))
    (global.set $d9g_cpu_bits (load.field DxObject misc1 (local.get $rt)))
    (global.set $d9g_cpu_pitch (load.field DxObject pitch (local.get $rt)))
    (global.set $d9g_px0 (i32.const 0))
    (global.set $d9g_py0 (i32.const 0))
    (global.set $d9g_px1 (local.get $w))
    (global.set $d9g_py1 (local.get $hgt))
    (global.set $d9g_cpu (i32.const 2))
    (call $d9g_stat (i32.const 81) (i32.const 1)))

  ;; Make the device's bound RT0 (the back buffer, or a colour surface's ring
  ;; RT -- d9rt) and its bound depth surface the executor targets. 0, or a
  ;; decline reason.
  (func $d9g_bind (param $device i32) (param $desc i32) (result i32)
    (local $r i32) (local $p i32) (local $e i32) (local $color i32) (local $ds i32)
    (local.set $r (call $d9g_bb (local.get $device) (i32.load offset=12 (local.get $desc)) (i32.load offset=16 (local.get $desc))))
    (if (local.get $r) (then (return (local.get $r))))
    ;; d9rt: colour target.
    (local.set $p (i32.load offset=22020 (global.get $d9g_pw)))
    (if (local.get $p)
      (then
        (local.set $e (call $d9r_color (local.get $device) (local.get $p)))
        (if (i32.eqz (local.get $e)) (then (return (i32.const 4))))
        (global.set $d9r_tgt (local.get $e))
        (local.set $color (i32.load offset=8 (local.get $e)))
        (global.set $d9g_tw (i32.load offset=12 (local.get $e)))
        (global.set $d9g_th (i32.load offset=16 (local.get $e)))
        (global.set $d9g_tfmt (i32.load offset=20 (local.get $e)))
        (call $d9r_wrote (local.get $e)))
      (else
        (global.set $d9r_tgt (i32.const 0))
        (local.set $color (global.get $d9g_rt))
        (global.set $d9g_tw (global.get $d9g_rt_w))
        (global.set $d9g_th (global.get $d9g_rt_h))
        (global.set $d9g_tfmt (global.get $d9g_rt_fmt))))
    ;; Depth surface: its own ring DS (d9rt). +20 w, +24 h, +28 format.
    (local.set $p (i32.load offset=21752 (global.get $d9g_pw)))
    (if (i32.ne (local.get $p) (global.get $d9g_ds_ptr)) (then
      (global.set $d9r_dse (i32.const 0))
      (global.set $d9g_ds_ptr (local.get $p))
      (if (local.get $p) (then
        (global.set $d9r_dse (call $d9r_depth (local.get $device) (local.get $p)))))))
    (global.set $d9g_ds (i32.const 0))
    (global.set $d9g_ds_bad (i32.const 0))
    (if (global.get $d9g_ds_ptr) (then
      (if (i32.or (i32.eqz (global.get $d9r_dse))
            (i32.or (i32.ne (i32.load offset=12 (global.get $d9r_dse)) (global.get $d9g_tw))
              (i32.ne (i32.load offset=16 (global.get $d9r_dse)) (global.get $d9g_th))))
        (then (global.set $d9g_ds_bad (i32.const 1)))
        (else
          (global.set $d9g_ds_d24 (i32.ne (i32.and (i32.load offset=24 (global.get $d9r_dse)) (i32.const 8)) (i32.const 0)))
          (global.set $d9g_ds (i32.load offset=8 (global.get $d9r_dse)))))))
    (call $d9r_targets (local.get $color) (global.get $d9g_ds))
    (i32.const 0))

  ;; TARGETS, sent only when they changed (they reset the executor viewport).
  (func $d9r_targets (param $color i32) (param $ds i32)
    (local $t i32)
    (if (i32.and (i32.eq (global.get $d9g_c_color) (local.get $color)) (i32.eq (global.get $d9g_c_depth) (local.get $ds)))
      (then (return)))
    (local.set $t (call $d9g_begin (global.get $GPS_OP_TARGETS) (size-of GpsTargets)))
    (store.field GpsTargets color (local.get $t) (local.get $color))
    (store.field GpsTargets depth (local.get $t) (local.get $ds))
    (drop (call $d9g_end (local.get $t)))
    (global.set $d9g_c_color (local.get $color))
    (global.set $d9g_c_depth (local.get $ds))
    (i32.store offset=704 (call $d9g_m) (i32.const -1)))

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
      (local.set $w (global.get $d9g_tw)) (local.set $hgt (global.get $d9g_th))))
    (if (i32.gt_u (local.get $x) (global.get $d9g_tw)) (then (local.set $x (global.get $d9g_tw))))
    (if (i32.gt_u (local.get $y) (global.get $d9g_th)) (then (local.set $y (global.get $d9g_th))))
    (if (i32.gt_u (local.get $w) (i32.sub (global.get $d9g_tw) (local.get $x)))
      (then (local.set $w (i32.sub (global.get $d9g_tw) (local.get $x)))))
    (if (i32.gt_u (local.get $hgt) (i32.sub (global.get $d9g_th) (local.get $y)))
      (then (local.set $hgt (i32.sub (global.get $d9g_th) (local.get $y)))))
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

  ;; ---- d9cl: user clip planes (reason 27) begin ------------------------------
  ;; D3DRS_CLIPPLANEENABLE (152) + SetClipPlane (program +25244 + 16*i) -> one
  ;; sticky CLIP record (GpsClip, D3D clip space) when the executor states
  ;; GPS_CAP_CLIP_PLANES. A guest VS's planes are already in clip space; fixed
  ;; T&L planes are in world space and go through inverse(View * Projection):
  ;; with clip = world * A, plane Pc = inverse(A) * Pw (column vector).
  ;; POSITIONT draws ignore the planes (D3D clips only processed vertices).
  ;; Own block (528 bytes): +0 staged GpsClip payload (100), +112 last sent
  ;; payload (zero = the executor's initial state), +256 f64 4x8 scratch.
  (global $d9cl_mem (mut i32) (i32.const 0))
  (func $d9cl_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $d9cl_mem)) (then
      (local.set $g (call $gps_alloc (i32.const 528)))
      (if (i32.eqz (local.get $g)) (then (call $d9g_fail (i32.const 1))))
      (global.set $d9cl_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $d9cl_mem) (i32.const 0) (i32.const 528))))
    (global.get $d9cl_mem))
  ;; Scratch element [r][c] of the 4x8 f64 Gauss-Jordan matrix.
  (func $d9cl_at (param $r i32) (param $c i32) (result i32)
    (i32.add (i32.add (call $d9cl_m) (i32.const 256))
      (i32.shl (i32.add (i32.shl (local.get $r) (i32.const 3)) (local.get $c)) (i32.const 3))))
  ;; Stage the payload for a draw with a VS (vsmode 1 guest, 2 fixed T&L).
  ;; 0 = staged (mask may be 0), 27 = decline (no cap, singular View*Proj
  ;; or a non-finite plane).
  (func $d9cl_prep (param $vsmode i32) (result i32)
    (local $m i32) (local $mask i32) (local $i i32) (local $j i32) (local $k i32) (local $piv i32)
    (local $s f64) (local $t f64) (local $best f64) (local $src i32) (local $x f32)
    (local.set $m (call $d9cl_m))
    (local.set $mask (i32.and (call $d9g_rs (i32.const 152)) (i32.const 63)))
    (memory.fill (local.get $m) (i32.const 0) (i32.const 100))
    (i32.store (local.get $m) (local.get $mask))
    (if (i32.eqz (local.get $mask)) (then (return (i32.const 0))))
    (if (i32.eqz (i32.and (global.get $d9g_caps) (global.get $GPS_CAP_CLIP_PLANES))) (then (return (i32.const 27))))
    (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
      ;; [A | I] with A = View * Projection (row-major D3DMATRIX).
      (local.set $i (i32.const 0))
      (loop $rows
        (local.set $j (i32.const 0))
        (loop $cols
          (local.set $s (f64.const 0))
          (local.set $k (i32.const 0))
          (loop $dot
            (local.set $s (f64.add (local.get $s) (f64.mul
              (f64.promote_f32 (f32.load (i32.add (global.get $d9g_pw)
                (i32.add (i32.const 2068) (i32.shl (i32.add (i32.shl (local.get $i) (i32.const 2)) (local.get $k)) (i32.const 2))))))
              (f64.promote_f32 (f32.load (i32.add (global.get $d9g_pw)
                (i32.add (i32.const 2132) (i32.shl (i32.add (i32.shl (local.get $k) (i32.const 2)) (local.get $j)) (i32.const 2)))))))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br_if $dot (i32.lt_u (local.get $k) (i32.const 4))))
          (f64.store (call $d9cl_at (local.get $i) (local.get $j)) (local.get $s))
          (f64.store (call $d9cl_at (local.get $i) (i32.add (local.get $j) (i32.const 4)))
            (select (f64.const 1) (f64.const 0) (i32.eq (local.get $i) (local.get $j))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $cols (i32.lt_u (local.get $j) (i32.const 4))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $i) (i32.const 4))))
      ;; Gauss-Jordan, partial pivoting. NaN never beats the threshold.
      (local.set $k (i32.const 0))
      (loop $pivots
        (local.set $piv (local.get $k))
        (local.set $best (f64.abs (f64.load (call $d9cl_at (local.get $k) (local.get $k)))))
        (local.set $i (i32.add (local.get $k) (i32.const 1)))
        (block $found (loop $search
          (br_if $found (i32.ge_u (local.get $i) (i32.const 4)))
          (if (f64.gt (f64.abs (f64.load (call $d9cl_at (local.get $i) (local.get $k)))) (local.get $best)) (then
            (local.set $piv (local.get $i))
            (local.set $best (f64.abs (f64.load (call $d9cl_at (local.get $i) (local.get $k)))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $search)))
        (if (i32.eqz (f64.gt (local.get $best) (f64.const 1e-30))) (then (return (i32.const 27))))
        (local.set $j (i32.const 0))
        (loop $swap
          (local.set $t (f64.load (call $d9cl_at (local.get $k) (local.get $j))))
          (f64.store (call $d9cl_at (local.get $k) (local.get $j)) (f64.load (call $d9cl_at (local.get $piv) (local.get $j))))
          (f64.store (call $d9cl_at (local.get $piv) (local.get $j)) (local.get $t))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $swap (i32.lt_u (local.get $j) (i32.const 8))))
        (local.set $t (f64.load (call $d9cl_at (local.get $k) (local.get $k))))
        (local.set $j (i32.const 0))
        (loop $scale
          (f64.store (call $d9cl_at (local.get $k) (local.get $j))
            (f64.div (f64.load (call $d9cl_at (local.get $k) (local.get $j))) (local.get $t)))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $scale (i32.lt_u (local.get $j) (i32.const 8))))
        (local.set $i (i32.const 0))
        (loop $elim
          (if (i32.ne (local.get $i) (local.get $k)) (then
            (local.set $t (f64.load (call $d9cl_at (local.get $i) (local.get $k))))
            (local.set $j (i32.const 0))
            (loop $sub
              (f64.store (call $d9cl_at (local.get $i) (local.get $j))
                (f64.sub (f64.load (call $d9cl_at (local.get $i) (local.get $j)))
                  (f64.mul (local.get $t) (f64.load (call $d9cl_at (local.get $k) (local.get $j))))))
              (local.set $j (i32.add (local.get $j) (i32.const 1)))
              (br_if $sub (i32.lt_u (local.get $j) (i32.const 8))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $elim (i32.lt_u (local.get $i) (i32.const 4))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br_if $pivots (i32.lt_u (local.get $k) (i32.const 4))))))
    (local.set $i (i32.const 0))
    (loop $planes
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $i))) (then
        (local.set $src (i32.add (global.get $d9g_pw) (i32.add (i32.const 25244) (i32.shl (local.get $i) (i32.const 4)))))
        (if (i32.eq (local.get $vsmode) (i32.const 1))
          (then (memory.copy (i32.add (local.get $m) (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 4)))) (local.get $src) (i32.const 16)))
          (else
            (local.set $j (i32.const 0))
            (loop $comp
              (local.set $s (f64.const 0))
              (local.set $k (i32.const 0))
              (loop $dot2
                (local.set $s (f64.add (local.get $s) (f64.mul
                  (f64.load (call $d9cl_at (local.get $j) (i32.add (local.get $k) (i32.const 4))))
                  (f64.promote_f32 (f32.load (i32.add (local.get $src) (i32.shl (local.get $k) (i32.const 2))))))))
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br_if $dot2 (i32.lt_u (local.get $k) (i32.const 4))))
              (local.set $x (f32.demote_f64 (local.get $s)))
              (if (f32.ne (f32.sub (local.get $x) (local.get $x)) (f32.const 0)) (then (return (i32.const 27))))
              (f32.store (i32.add (local.get $m) (i32.add (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 4))) (i32.shl (local.get $j) (i32.const 2))))
                (local.get $x))
              (local.set $j (i32.add (local.get $j) (i32.const 1)))
              (br_if $comp (i32.lt_u (local.get $j) (i32.const 4))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $planes (i32.lt_u (local.get $i) (i32.const 6))))
    (i32.const 0))
  ;; Emit the staged payload when it differs from the last one sent.
  (func $d9cl_emit
    (local $m i32) (local $p i32)
    (local.set $m (call $d9cl_m))
    (if (call $d3g_row_eq (local.get $m) (i32.add (local.get $m) (i32.const 112)) (size-of GpsClip)) (then (return)))
    (memory.copy (i32.add (local.get $m) (i32.const 112)) (local.get $m) (size-of GpsClip))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_CLIP) (size-of GpsClip)))
    (memory.copy (local.get $p) (local.get $m) (size-of GpsClip))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_stat (i32.const 75) (i32.const 1)))
  ;; ---- d9cl: user clip planes end --------------------------------------------

  ;; ---- d9cl: projected texture coordinates (reason 12) begin
  ;; D3DTTFF_PROJECTED | COUNT3/4 under fixed T&L lowers with no new
  ;; protocol: the fixed VS writes the full transformed coordinate (09aj
  ;; accepts 259/260) and the pixel stage's raw `tex t#` samples with the
  ;; core texld DZ / DW coordinate modifier, which every executor divides
  ;; per pixel (q == 0 samples (1, 1), as texld_dz does). Only for the fixed
  ;; cascade or a guest ps1.1-1.3: ps1.4 and 2.0 project explicitly
  ;; (texld_dw / texldp), and the old path refused them too. $d9cl_proj is
  ;; the 09af1 $cn_projected word for the current draw.
  (global $d9cl_proj (mut i32) (i32.const 0))

  ;; Stage $i's TEXTURETRANSFORMFLAGS for the decline checks: a lowerable
  ;; PROJECTED | COUNT3/4 is recorded in $d9cl_proj and reads as COUNT3/4.
  ;; d9pj: also PROJECTED | COUNT2 (the divide by the second coordinate,
  ;; see "d9pj" below), and a guest ps_1_4+ ignores PROJECTED (it projects
  ;; explicitly), so the flag reads as its COUNT there.
  (func $d9cl_tt (param $i i32) (param $guest_ps i32) (result i32)
    (local $tt i32) (local $eff i32)
    (local.set $tt (call $d9g_tss (local.get $i) (i32.const 96)))
    (local.set $eff (call $d9pj_eff (local.get $i) (local.get $guest_ps)))
    (if (i32.or (i32.eqz (i32.and (local.get $tt) (i32.const 256)))
          (i32.and (i32.ne (local.get $eff) (i32.const 259)) (i32.ne (local.get $eff) (i32.const 260))))
      (then (return (local.get $eff))))
    (global.set $d9cl_proj (i32.or (global.get $d9cl_proj)
      (i32.shl (i32.and (local.get $eff) (i32.const 255)) (i32.shl (local.get $i) (i32.const 2)))))
    (i32.and (local.get $eff) (i32.const 255)))

  ;; ---- d9pj: projected texture coordinates, the rest of reason 12 ----------
  ;; D3DTTFF_PROJECTED divides the coordinates by the last one COUNT names,
  ;; which is consumed: COUNT3 samples (x/z, y/z), COUNT4 (x/y/z over w),
  ;; COUNT2 (x/y, 0) -- the second coordinate is the divisor, so nothing is
  ;; left for v (Wine's projected_textures rules, checked against Windows
  ;; drivers: the y column moves into w and y is zeroed). All of them are a
  ;; per-pixel divide the executors already do (core texld DZ / DW), so no
  ;; executor feature: COUNT2 is reshaped into a DW divide in WAT --
  ;;   fixed T&L: the texture matrix's y column goes out as its w column and
  ;;     y becomes zero (c16.. constants), the stage runs as COUNT4|PROJECTED;
  ;;   POSITIONT (where D3D applies no transform but still projects): the
  ;;     CPU expansion appends one FLOAT4 lane (x, 0, 0, y) of the stage's
  ;;     set to every vertex (texmap nibble 13) and the stage reads it with DW.
  ;;     COUNT3 / COUNT4 read the set in place with DZ / DW.
  ;; Still 12: PROJECTED | COUNT1 (nothing would remain after the divide;
  ;; D3D leaves it undefined), COUNT0 or flag bits past PROJECTED, more than
  ;; one POSITIONT COUNT2 stage in a draw, a COUNT2 stage on a set the
  ;; vertex lacks, ps_1_0 or a non-ps guest shader, and non-projected
  ;; transform flags on POSITIONT (as before).
  ;; Effective TEXTURETRANSFORMFLAGS of stage $i for the cascade (09aj takes
  ;; 0, 2..4, 259, 260): PROJECTED | COUNT2 -> 260; under a guest ps_1_4+
  ;; PROJECTED is dropped. Anything else is returned as it is (the caller's
  ;; checks decline it).
  (func $d9pj_eff (param $i i32) (param $guest_ps i32) (result i32)
    (local $tt i32) (local $c i32) (local $sw i32) (local $ver i32)
    (local.set $tt (call $d9g_tss (local.get $i) (i32.const 96)))
    (if (i32.or (i32.eqz (i32.and (local.get $tt) (i32.const 256))) (i32.gt_u (local.get $tt) (i32.const 260)))
      (then (return (local.get $tt))))
    (local.set $c (i32.and (local.get $tt) (i32.const 255)))
    (if (i32.eqz (local.get $c)) (then (return (local.get $tt))))
    (if (local.get $guest_ps) (then
      (local.set $sw (call $g2w (local.get $guest_ps)))
      (local.set $ver (i32.load offset=12 (i32.add (i32.add (local.get $sw) (i32.const 24)) (i32.load offset=16 (local.get $sw)))))
      (if (i32.and (i32.ge_u (local.get $ver) (i32.const 0xffff0104)) (i32.le_u (local.get $ver) (i32.const 0xffff03ff)))
        (then (return (local.get $c))))
      (if (i32.or (i32.lt_u (local.get $ver) (i32.const 0xffff0101)) (i32.gt_u (local.get $ver) (i32.const 0xffff0103)))
        (then (return (local.get $tt))))))
    (if (i32.eq (local.get $c) (i32.const 1)) (then (return (local.get $tt))))
    (select (i32.const 260) (local.get $tt) (i32.eq (local.get $c) (i32.const 2))))
  ;; Is stage $i a PROJECTED | COUNT2 one that lowered (its DW is recorded)?
  (func $d9pj_c2 (param $i i32) (result i32)
    (i32.and (i32.eq (i32.and (call $d9g_tss (local.get $i) (i32.const 96)) (i32.const 0x1ff)) (i32.const 258))
      (i32.eq (i32.and (i32.shr_u (global.get $d9cl_proj) (i32.shl (local.get $i) (i32.const 2))) (i32.const 15)) (i32.const 4))))
  ;; Fixed PS cache tag of $d9cl_proj: each stage's 0 / 3 / 4 as a base-3
  ;; digit (< 729), so the tag is exact.
  (func $d9pj_has13 (param $texmap i32) (result i32)
    (local $i i32)
    (loop $st
      (if (i32.eq (i32.and (i32.shr_u (local.get $texmap) (i32.shl (local.get $i) (i32.const 2))) (i32.const 15)) (i32.const 13))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $st (i32.lt_u (local.get $i) (i32.const 6))))
    (i32.const 0))
  (func $d9pj_tag (result i32)
    (local $i i32) (local $t i32) (local $s i32)
    (local.set $i (i32.const 5))
    (loop $st
      (local.set $s (i32.and (i32.shr_u (global.get $d9cl_proj) (i32.shl (local.get $i) (i32.const 2))) (i32.const 15)))
      (local.set $t (i32.add (i32.mul (local.get $t) (i32.const 3))
        (select (i32.sub (local.get $s) (i32.const 2)) (i32.const 0) (i32.ne (local.get $s) (i32.const 0)))))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (br_if $st (i32.ge_s (local.get $i) (i32.const 0))))
    (local.get $t))
  ;; ---- d9pj end ----------------------------------------------------------------

  ;; A pixel-stage SHADER under the draw's projected stages.
  (func $d9cl_ps_emit (param $ir i32) (result i32)
    (local $id i32)
    (global.set $cn_projected (global.get $d9cl_proj))
    (local.set $id (call $d9g_shader_emit (local.get $ir) (global.get $GPS_STAGE_PS)))
    (global.set $cn_projected (i32.const 0))
    (local.get $id))
  ;; ---- d9cl: projected texture coordinates (reason 12) end ----------------

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

  ;; ---- d9wb: D3DZB_USEW ------------------------------------------------------
  ;; D3D9 W-buffering stores w / Wfar, w = 1 / interpolated rhw (the clip w
  ;; of a transformed vertex). The runtime takes Wfar from the PROJECTION
  ;; transform whatever the vertex stage (a vertex shader or POSITIONT
  ;; draw too): Wfar = (m44 - m43) / (m33 - m34) * m34 + m44, which is zf
  ;; for a perspective matrix and 1 for an orthographic one. The executor
  ;; writes that per pixel (RASTER depth_mode 3, GPS_CAP_WBUFFER); 17 is
  ;; what it cannot say: no cap, m33 == m34 or a Wfar that is not finite
  ;; and positive, or a depth bias (D3D defines it for Z).
  (global $d9wb_far (mut f32) (f32.const 0))
  (func $d9wb_prep (result i32)
    (local $p i32) (local $den f64) (local $far f64)
    (if (i32.eqz (i32.and (global.get $d9g_caps) (global.get $GPS_CAP_WBUFFER))) (then (return (i32.const 17))))
    (if (i32.or (f32.ne (f32.reinterpret_i32 (call $d9g_rs (i32.const 195))) (f32.const 0))
          (f32.ne (f32.reinterpret_i32 (call $d9g_rs (i32.const 175))) (f32.const 0)))
      (then (return (i32.const 17))))
    (local.set $p (i32.add (global.get $d9g_pw) (i32.const 2132)))
    (local.set $den (f64.sub (f64.promote_f32 (f32.load offset=40 (local.get $p))) (f64.promote_f32 (f32.load offset=44 (local.get $p)))))
    (if (f64.eq (local.get $den) (f64.const 0)) (then (return (i32.const 17))))
    (local.set $far (f64.add
      (f64.mul (f64.div (f64.sub (f64.promote_f32 (f32.load offset=60 (local.get $p))) (f64.promote_f32 (f32.load offset=56 (local.get $p))))
          (local.get $den))
        (f64.promote_f32 (f32.load offset=44 (local.get $p))))
      (f64.promote_f32 (f32.load offset=60 (local.get $p)))))
    (global.set $d9wb_far (f32.demote_f64 (local.get $far)))
    (if (i32.eqz (i32.and (f32.gt (global.get $d9wb_far) (f32.const 0)) (f32.lt (global.get $d9wb_far) (f32.const inf))))
      (then (global.set $d9wb_far (f32.const 0)) (return (i32.const 17))))
    (i32.const 0))
  ;; ---- end d9wb

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
        (select (i32.const 15) (i32.const 7) (call $d9g_has_alpha (global.get $d9g_tfmt)))))
    (store.field GpsRaster fog_mode (local.get $s) (select (global.get $GPS_FOG_VERTEX_ALPHA) (i32.const 0) (local.get $fog)))
    (store.field GpsRaster fill (local.get $s) (i32.const 3))
    (store.field GpsRaster fog_color (local.get $s) (select (call $d9g_rgba (call $d9g_rs (i32.const 34))) (i32.const 0) (local.get $fog)))
    (local.set $r (i32.add (local.get $m) (i32.const 744)))
    (i32.store (local.get $r) (i32.const 0))
    (i32.store offset=4 (local.get $r) (i32.const 0))
    (i32.store offset=8 (local.get $r) (global.get $d9g_tw))
    (i32.store offset=12 (local.get $r) (global.get $d9g_th))
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
    (if (i32.eq (local.get $depth) (global.get $GPS_DEPTH_Z)) (then
      (store.field GpsRaster z_bias (local.get $s) (f32.reinterpret_i32 (call $d9g_rs (i32.const 195))))
      (store.field GpsRaster slope_bias (local.get $s) (f32.reinterpret_i32 (call $d9g_rs (i32.const 175))))))
    (if (i32.eq (local.get $depth) (global.get $GPS_DEPTH_WBUFFER)) (then ;; d9wb
      (store.field GpsRaster w_far (local.get $s) (global.get $d9wb_far))))
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
  ;; Decode mip entry $idx of texture object $t (wasm) into level $level,
  ;; face $face of executor texture $id (a cube's entry is face * levels +
  ;; level, $d3d9_cube_index).
  (func $d9g_upload_level (param $id i32) (param $t i32) (param $idx i32) (param $level i32) (param $face i32) (result i32)
    (local $mip i32) (local $w i32) (local $hgt i32) (local $y i32) (local $n i32) (local $pos i32) (local $p i32)
    (local.set $mip (i32.add (local.get $t) (i32.add (i32.const 64) (i32.shl (local.get $idx) (i32.const 5)))))
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
      (call $gps_upload (global.get $d9g_h) (local.get $id) (local.get $level) (local.get $face) (i32.const 0) (local.get $y)
        (local.get $w) (local.get $n) (i32.shl (local.get $w) (i32.const 2))
        (local.get $pos) (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (local.set $y (i32.add (local.get $y) (local.get $n)))
      (br $bands)))
    (if (local.get $hgt) (then (call $d3d9_texture_decode_release)))
    (call $d9g_stat (i32.const 8) (i32.const 1))
    (i32.const 1))

  ;; ---- d9cpu: cube textures ---------------------------------------------------
  ;; Cube textures (6, until d9cpu) are CREATE kind CUBE with each face's
  ;; levels UPLOADed by face: the same decode, no new protocol. Their
  ;; per-face content seqs live in the side table at +112000 (one 312-byte
  ;; row of 6 x 13 seqs per texture-cache slot); a 2D texture keeps its 13
  ;; in the slot. Mip entry face * levels + level ($d3d9_cube_index).

  ;; Executor id of the texture bound at $stage, or -reason.
  (func $d9g_texture (param $stage i32) (result i32)
    (local $t i32) (local $levels i32) (local $fmt i32) (local $w i32) (local $hgt i32)
    (local $base i32) (local $i i32) (local $e i32) (local $slot i32) (local $id i32) (local $l i32)
    (local $mip i32) (local $fresh i32)
    (local $cube i32) (local $faces i32) (local $f i32) (local $n i32) (local $idx i32) ;; d9cpu
    (local.set $t (call $g2w (call $d9g_tex_ptr (local.get $stage))))
    (local.set $cube (i32.eq (i32.load offset=12 (local.get $t)) (i32.const 5)))
    (if (i32.and (i32.ne (i32.load offset=12 (local.get $t)) (i32.const 3)) (i32.eqz (local.get $cube)))
      (then (return (i32.const -10))))
    (local.set $faces (select (i32.const 6) (i32.const 1) (local.get $cube)))
    (local.set $levels (i32.load offset=32 (local.get $t)))
    ;; d9rt: a RENDERTARGET texture samples its levels' ring RTs.
    (if (i32.load offset=56 (local.get $t)) (then
      (if (i32.and (i32.eq (local.get $levels) (i32.const 1)) (i32.eqz (local.get $cube)))
        (then (return (call $d9r_rt_texture (local.get $t)))))))
    (local.set $fmt (i32.load offset=36 (local.get $t)))
    (if (i32.or (i32.eqz (local.get $levels)) (i32.gt_u (local.get $levels) (i32.const 13)))
      (then (return (i32.const -10))))
    (local.set $w (i32.load offset=64 (local.get $t)))
    (local.set $hgt (i32.load offset=68 (local.get $t)))
    ;; Unreachable today: CreateTexture / CreateCubeTexture refuse > 2048.
    (if (i32.or (i32.gt_u (local.get $w) (i32.const 2048)) (i32.gt_u (local.get $hgt) (i32.const 2048)))
      (then (return (i32.const -25))))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt))) (then (return (i32.const -10))))
    (if (i32.and (local.get $cube) (i32.ne (local.get $w) (local.get $hgt))) (then (return (i32.const -10))))
    ;; A locked level cannot be sampled (the old path refused the draw too).
    (local.set $n (i32.mul (local.get $levels) (local.get $faces)))
    (loop $locks
      (if (i32.load offset=84 (i32.add (local.get $t) (i32.shl (local.get $l) (i32.const 5))))
        (then (return (i32.const -10))))
      (local.set $l (i32.add (local.get $l) (i32.const 1)))
      (br_if $locks (i32.lt_u (local.get $l) (local.get $n))))
    ;; The cache's format word also names the shape (cube: bit 31).
    (local.set $fmt (i32.or (local.get $fmt) (i32.shl (local.get $cube) (i32.const 31))))
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
      (call $gps_create (global.get $d9g_h) (local.get $id)
        (select (global.get $GPS_KIND_CUBE) (global.get $GPS_KIND_TEX2D) (local.get $cube))
        (global.get $GPS_FMT_A8B8G8R8) (local.get $levels) (local.get $w) (local.get $hgt) (i32.const 0))
      (i32.store (local.get $slot) (local.get $t))
      (i32.store offset=4 (local.get $slot) (local.get $id))
      (i32.store offset=8 (local.get $slot) (local.get $w))
      (i32.store offset=12 (local.get $slot) (local.get $hgt))
      (i32.store offset=16 (local.get $slot) (local.get $levels))
      (i32.store offset=20 (local.get $slot) (local.get $fmt))))
    (local.set $id (i32.load offset=4 (local.get $slot)))
    (local.set $f (i32.const 0))
    (loop $faces_loop
      (local.set $l (i32.const 0))
      (loop $levels_loop
        ;; Guest mip entry: face * levels + l.
        (local.set $idx (i32.add (i32.mul (local.get $f) (local.get $levels)) (local.get $l)))
        (local.set $mip (i32.add (local.get $t) (i32.add (i32.const 64) (i32.shl (local.get $idx) (i32.const 5)))))
        (local.set $e (if (result i32) (local.get $cube)
          (then (i32.add (i32.add (i32.add (call $d9g_m) (i32.const 112000))
            (i32.mul (i32.div_u (i32.sub (local.get $slot) (local.get $base)) (i32.const 80)) (i32.const 312)))
            (i32.shl (i32.add (i32.mul (local.get $f) (i32.const 13)) (local.get $l)) (i32.const 2))))
          (else (i32.add (local.get $slot) (i32.add (i32.const 24) (i32.shl (local.get $l) (i32.const 2)))))))
        (block $next_level
        ;; d9rt: a RENDERTARGET level is COPYed from its RT (by generation).
        (if (i32.load offset=56 (local.get $t)) (then
          (local.set $mip (call $d9r_rt_level (local.get $id) (local.get $t) (local.get $idx) (local.get $l)
            (local.get $f) (i32.load (local.get $e)) (local.get $fresh)))
          (if (i32.lt_s (local.get $mip) (i32.const 0)) (then
            (i32.store (local.get $slot) (i32.const 0))
            (call $d9g_release (local.get $id))
            (return (local.get $mip))))
          (i32.store (local.get $e) (local.get $mip))
          (br $next_level)))
        ;; seq (mip+28) is the level's content identity; a new level always
        ;; uploads. Store seq+1 so a zero-content level still counts as sent.
        (if (i32.or (local.get $fresh) (i32.ne (i32.load (local.get $e)) (i32.add (i32.load offset=28 (local.get $mip)) (i32.const 1))))
          (then
            (if (i32.eqz (call $d9g_upload_level (local.get $id) (local.get $t) (local.get $idx) (local.get $l) (local.get $f)))
              (then
                (i32.store (local.get $slot) (i32.const 0))
                (call $d9g_release (local.get $id))
                (return (i32.const -10))))
            (i32.store (local.get $e) (i32.add (i32.load offset=28 (local.get $mip)) (i32.const 1))))
          (else (call $d9g_stat (i32.const 9) (i32.const 1)))))
        (local.set $l (i32.add (local.get $l) (i32.const 1)))
        (br_if $levels_loop (i32.lt_u (local.get $l) (local.get $levels))))
      (local.set $f (i32.add (local.get $f) (i32.const 1)))
      (br_if $faces_loop (i32.lt_u (local.get $f) (local.get $faces))))
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
    (if (i32.and (global.get $d9fv_force) (i32.eq (local.get $stage) (global.get $GPS_STAGE_VS)))
      (then (call $d9fv_keep (local.get $id) (local.get $core)))) ;; d9fv
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
    ;; d9cl: the projected word is part of the key (an odd multiple, so two
    ;; words never give one shader the same sum).
    (local.set $sum (i32.add (local.get $sum) (i32.mul (global.get $d9cl_proj) (i32.const 0x9e3779b1))))
    (local.set $i (i32.const 0))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 2304)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $ptr)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $len)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $sum)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $d9cl_ps_emit (i32.add (i32.add (local.get $sw) (i32.const 24)) (local.get $len)))) ;; d9cl
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
      (i32.store offset=36 (local.get $r) (call $d9pj_eff (local.get $i) (local.get $guest_ps))) ;; d9pj
      ;; NORMAL is v11 (texgen CAMERASPACENORMAL / REFLECTIONVECTOR read it).
      (if (i32.and (local.get $fvf) (i32.const 16)) (then (i32.store offset=128 (local.get $r) (i32.const 11))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $vrows (i32.lt_u (local.get $i) (i32.const 6))))
    ;; Identity world / view / projection: the key stays value-free, and the
    ;; cascade's texgen normal matrix (c40..c42, dropped with the other
    ;; value DEFs) is computable. Texture matrices (+64 of each row) stay zero.
    (f32.store offset=96 (local.get $d) (f32.const 1)) (f32.store offset=116 (local.get $d) (f32.const 1))
    (f32.store offset=136 (local.get $d) (f32.const 1)) (f32.store offset=156 (local.get $d) (f32.const 1))
    (f32.store offset=160 (local.get $d) (f32.const 1)) (f32.store offset=180 (local.get $d) (f32.const 1))
    (f32.store offset=200 (local.get $d) (f32.const 1)) (f32.store offset=220 (local.get $d) (f32.const 1))
    (f32.store offset=224 (local.get $d) (f32.const 1)) (f32.store offset=244 (local.get $d) (f32.const 1))
    (f32.store offset=264 (local.get $d) (f32.const 1)) (f32.store offset=284 (local.get $d) (f32.const 1))
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
    (local $tab i32) (local $tag i32)
    (local.set $m (call $d9g_m))
    (local.set $d (i32.add (local.get $m) (i32.const 4096)))
    (local.set $tab (i32.add (local.get $d) (i32.const 288)))
    (local.set $len (call $d9g_fixed_pack (local.get $active) (i32.const 0) (i32.const 0)))
    ;; Cache: {id, len | projected tag << 11 (d9pj), key bytes}.
    (local.set $tag (i32.or (local.get $len) (i32.shl (call $d9pj_tag) (i32.const 11))))
    (local.set $i (i32.const 0))
    (loop $cache
      (local.set $e (i32.add (i32.add (local.get $m) (i32.const 5632)) (i32.mul (local.get $i) (i32.const 1448))))
      (if (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0)) (i32.eq (i32.load offset=4 (local.get $e)) (local.get $tag)))
        (then (if (call $d3g_row_eq (i32.add (local.get $e) (i32.const 8)) (local.get $d) (local.get $len))
          (then (return (i32.load (local.get $e)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cache (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $bundle (if (result i32) (i32.eq (local.get $len) (i32.const 1440))
      (then (call $d3d_fixed_compile_cascade6 (local.get $d) (local.get $tab) (i32.const 6) (i32.const 2) (i32.const 0)))
      (else (call $d3d_fixed_compile_cascade5 (local.get $d) (local.get $tab) (i32.const 6) (i32.const 2) (i32.const 0)))))
    (if (i32.eqz (local.get $bundle)) (then (return (i32.const -9))))
    (local.set $id (call $d9cl_ps_emit (i32.load offset=8 (local.get $bundle)))) ;; d9pj: POSITIONT projected stages
    (call $d3d_fixed_free (local.get $bundle))
    (if (i32.eqz (local.get $id)) (then (return (i32.const -8))))
    (local.set $i (global.get $d9g_rr_shader))
    (global.set $d9g_rr_shader (i32.and (i32.add (local.get $i) (i32.const 1)) (i32.const 31)))
    (local.set $e (i32.add (i32.add (local.get $m) (i32.const 5632)) (i32.mul (local.get $i) (i32.const 1448))))
    (call $d9g_release (i32.load (local.get $e)))
    (i32.store (local.get $e) (local.get $id))
    (i32.store offset=4 (local.get $e) (local.get $tag))
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
      ;; d9cpu: set 14 is the default (0, 0) appended at stride - 8 (or
      ;; before a set 13 lane); d9pj: set 13, a FLOAT4 at stride - 16.
      (if (i32.eq (local.get $set) (i32.const 14)) (then
        (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT2)
          (global.get $GPS_USAGE_TEXCOORD) (local.get $i)
          (i32.sub (local.get $stride) (select (i32.const 24) (i32.const 8) (call $d9pj_has13 (local.get $texmap))))))))
      (if (i32.eq (local.get $set) (i32.const 13)) (then
        (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT4)
          (global.get $GPS_USAGE_TEXCOORD) (local.get $i) (i32.sub (local.get $stride) (i32.const 16))))))
      (if (i32.lt_u (local.get $set) (i32.const 13)) (then
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
    (local $n i32) (local $pos i32)
    (block $done (loop $chunks
      (br_if $done (i32.ge_u (local.get $lo) (local.get $hi)))
      (local.set $n (i32.sub (local.get $hi) (local.get $lo)))
      (if (i32.gt_u (local.get $n) (i32.const 0x100000)) (then (local.set $n (i32.const 0x100000))))
      (local.set $pos (call $d9g_arena (local.get $n)))
      (memory.copy (call $d9g_aptr (local.get $pos))
        (i32.add (i32.add (local.get $wa) (i32.const 64)) (local.get $lo)) (local.get $n))
      (call $gps_upload (global.get $d9g_h) (local.get $id) (i32.const 0) (i32.const 0) (local.get $lo) (i32.const 0)
        (local.get $n) (i32.const 1) (local.get $n) (local.get $pos) (local.get $n))
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
        (then
          (if (i32.eqz (global.get $d9fv_force)) (then (return (i32.load offset=16 (local.get $e)))))
          ;; d9fv: re-emit (its core IR is kept): drop this entry.
          (call $d9g_release (i32.load offset=16 (local.get $e)))
          (i32.store offset=16 (local.get $e) (i32.const 0))))
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
    (call $d9fv_lkeep (local.get $p)) ;; d9fv
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
    (call $d9fv_lkeep (local.get $p)) ;; d9fv
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_layout_cache (local.get $fvf) (local.get $stride) (i32.const 0x40000000) (local.get $id))
    (local.get $id))

  ;; ---- fixed-function lighting -----------------------------------------------
  ;; D3D9 lighting state -> DLT1 (09aj $d3d_fixed_bind_lighting) at
  ;; mem+103424, packed as lib/d3d-shader-ir.js fixedCascade packs it: the
  ;; material, the enabled lights in list order, RS 139/141/142/143/145-148
  ;; and SPECULARENABLE (ABI3), with $d9g_fixed_tl's input registers
  ;; (NORMAL v11, COLOR0 v1, COLOR1 v10). Also the shape key at mem+104576:
  ;; everything the lowered instructions depend on -- counts, registers,
  ;; selectors, light types, the spot falloff class (0, 1 or other picks
  ;; different code) -- and none of the values, which reach the VS as
  ;; c40..c95 per draw ($d9g_light_values). 0, or 28: more than eight
  ;; enabled lights, a bad light type or material source, a non-finite
  ;; value, or a light list that does not end (all refused by the old path
  ;; too).
  (func $d9g_dlt1 (param $fvf i32) (result i32)
    (local $m i32) (local $L i32) (local $S i32) (local $node i32) (local $p i32) (local $l i32)
    (local $n i32) (local $abi i32) (local $sh i32) (local $row i32) (local $type i32) (local $i i32)
    (local $mat i32) (local $end i32) (local $hops i32) (local $f f32) (local $phi f64) (local $theta f64)
    (local.set $m (call $d9g_m))
    (local.set $L (i32.add (local.get $m) (i32.const 103424)))
    (local.set $S (i32.add (local.get $m) (i32.const 104576)))
    (memory.fill (local.get $L) (i32.const 0) (i32.const 1216))
    (local.set $abi (i32.const 1))
    (local.set $node (i32.load offset=21996 (global.get $d9g_pw)))
    (block $counted (loop $count
      (br_if $counted (i32.eqz (local.get $node)))
      (local.set $hops (i32.add (local.get $hops) (i32.const 1)))
      (if (i32.gt_u (local.get $hops) (i32.const 4096)) (then (return (i32.const 28))))
      (local.set $p (call $g2w (local.get $node)))
      (if (i32.load offset=12 (local.get $p)) (then
        (local.set $type (i32.load offset=16 (local.get $p)))
        (if (i32.or (i32.eqz (local.get $type)) (i32.gt_u (local.get $type) (i32.const 3))) (then (return (i32.const 28))))
        (if (i32.ne (local.get $type) (i32.const 3)) (then (local.set $abi (i32.const 2))))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (if (i32.gt_u (local.get $n) (i32.const 8)) (then (return (i32.const 28))))))
      (local.set $node (i32.load (local.get $p)))
      (br $count)))
    (if (call $d9g_rs (i32.const 29)) (then (local.set $abi (i32.const 3))))
    (local.set $sh (select (i32.const 7) (i32.const 6) (i32.gt_u (local.get $abi) (i32.const 1))))
    (if (i32.or (i32.gt_u (call $d9g_rs (i32.const 145)) (i32.const 2))
          (i32.or (i32.gt_u (call $d9g_rs (i32.const 147)) (i32.const 2)) (i32.gt_u (call $d9g_rs (i32.const 148)) (i32.const 2))))
      (then (return (i32.const 28))))
    (i32.store (local.get $L) (i32.const 0x444c5431))
    (i32.store offset=4 (local.get $L) (local.get $abi))
    (i32.store offset=8 (local.get $L) (local.get $n))
    (i32.store offset=12 (local.get $L) (select (i32.const 11) (i32.const 16) (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0))))
    (i32.store offset=16 (local.get $L) (select (i32.const 1) (i32.const 16) (i32.ne (i32.and (local.get $fvf) (i32.const 64)) (i32.const 0))))
    (i32.store offset=20 (local.get $L) (select (i32.const 10) (i32.const 16) (i32.ne (i32.and (local.get $fvf) (i32.const 128)) (i32.const 0))))
    (i32.store offset=24 (local.get $L) (i32.ne (call $d9g_rs (i32.const 143)) (i32.const 0)))
    (i32.store offset=28 (local.get $L) (i32.ne (call $d9g_rs (i32.const 141)) (i32.const 0)))
    (i32.store offset=32 (local.get $L) (call $d9g_rs (i32.const 145)))
    (i32.store offset=36 (local.get $L) (call $d9g_rs (i32.const 147)))
    (i32.store offset=40 (local.get $L) (call $d9g_rs (i32.const 148)))
    (i32.store offset=48 (local.get $L) (call $d9g_rs (i32.const 139)))
    ;; D3DMATERIAL9: diffuse 0, ambient 16, specular 32, emissive 48, power 64.
    (local.set $mat (i32.add (global.get $d9g_pw) (i32.const 21928)))
    (memory.copy (i32.add (local.get $L) (i32.const 64)) (local.get $mat) (i32.const 16))
    (memory.copy (i32.add (local.get $L) (i32.const 80)) (i32.add (local.get $mat) (i32.const 16)) (i32.const 16))
    (memory.copy (i32.add (local.get $L) (i32.const 96)) (i32.add (local.get $mat) (i32.const 48)) (i32.const 16))
    (if (i32.eq (local.get $abi) (i32.const 3)) (then
      (if (i32.gt_u (call $d9g_rs (i32.const 146)) (i32.const 2)) (then (return (i32.const 28))))
      (if (i32.eqz (f32.ge (f32.load offset=64 (local.get $mat)) (f32.const 0))) (then (return (i32.const 28))))
      (i32.store offset=52 (local.get $L)
        (i32.or (i32.const 1) (select (i32.const 4) (i32.const 0) (i32.ne (call $d9g_rs (i32.const 142)) (i32.const 0)))))
      (i32.store offset=56 (local.get $L) (call $d9g_rs (i32.const 146)))
      (memory.copy (i32.add (local.get $L) (i32.const 112)) (i32.add (local.get $mat) (i32.const 32)) (i32.const 12))
      (f32.store offset=124 (local.get $L) (f32.load offset=64 (local.get $mat)))))
    ;; Rows. D3DLIGHT9 (node+16): type 0, diffuse 4, specular 20, ambient 36,
    ;; position 52, direction 64, range 76, falloff 80, attenuation 84/88/92,
    ;; theta 96, phi 100.
    (local.set $row (i32.add (local.get $L) (i32.const 128)))
    (local.set $node (i32.load offset=21996 (global.get $d9g_pw)))
    (block $built (loop $rows
      (br_if $built (i32.eqz (local.get $node)))
      (local.set $p (call $g2w (local.get $node)))
      (if (i32.load offset=12 (local.get $p)) (then
        (local.set $l (i32.add (local.get $p) (i32.const 16)))
        (local.set $type (i32.load (local.get $l)))
        (i32.store (local.get $row) (local.get $type))
        (memory.copy (i32.add (local.get $row) (i32.const 4)) (i32.add (local.get $l) (i32.const 4)) (i32.const 16))
        (memory.copy (i32.add (local.get $row) (i32.const 20)) (i32.add (local.get $l) (i32.const 36)) (i32.const 16))
        (if (i32.eq (local.get $abi) (i32.const 3)) (then
          (memory.copy (i32.add (local.get $row) (i32.const 88)) (i32.add (local.get $l) (i32.const 20)) (i32.const 12))))
        (if (i32.ne (local.get $type) (i32.const 1)) (then
          (memory.copy (i32.add (local.get $row) (i32.const 36)) (i32.add (local.get $l) (i32.const 64)) (i32.const 12))))
        (if (i32.ne (local.get $type) (i32.const 3)) (then
          (memory.copy (i32.add (local.get $row) (i32.const 48)) (i32.add (local.get $l) (i32.const 52)) (i32.const 12))
          (f32.store offset=60 (local.get $row) (f32.load offset=76 (local.get $l)))
          (memory.copy (i32.add (local.get $row) (i32.const 64)) (i32.add (local.get $l) (i32.const 84)) (i32.const 12))))
        (if (i32.eq (local.get $type) (i32.const 2)) (then
          ;; Half-angle cosines (09aj runs no transcendental); D3D9 bounds
          ;; phi to [0, pi] and theta to [0, phi].
          (local.set $f (f32.load offset=80 (local.get $l)))
          (f32.store offset=76 (local.get $row) (local.get $f))
          (local.set $phi (f64.promote_f32 (f32.load offset=100 (local.get $l))))
          (local.set $theta (f64.promote_f32 (f32.load offset=96 (local.get $l))))
          (if (i32.eqz (i32.and (f64.le (f64.abs (local.get $phi)) (f64.const 3.4028234663852886e38))
                (f64.le (f64.abs (local.get $theta)) (f64.const 3.4028234663852886e38))))
            (then (return (i32.const 28))))
          (local.set $phi (f64.min (f64.max (local.get $phi) (f64.const 0)) (f64.const 3.141592653589793)))
          (local.set $theta (f64.min (f64.max (local.get $theta) (f64.const 0)) (local.get $phi)))
          (f32.store offset=80 (local.get $row) (f32.demote_f64 (call $host_math_cos (f64.mul (local.get $theta) (f64.const 0.5)))))
          (f32.store offset=84 (local.get $row) (f32.demote_f64 (call $host_math_cos (f64.mul (local.get $phi) (f64.const 0.5)))))
          (i32.store offset=52 (local.get $S) (i32.or (i32.load offset=52 (local.get $S))
            (i32.shl (select (i32.const 0) (select (i32.const 1) (i32.const 2) (f32.eq (local.get $f) (f32.const 1)))
              (f32.eq (local.get $f) (f32.const 0))) (i32.shl (local.get $i) (i32.const 1)))))))
        (i32.store offset=48 (local.get $S) (i32.or (i32.load offset=48 (local.get $S))
          (i32.shl (local.get $type) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $row (i32.add (local.get $row) (i32.shl (i32.const 1) (local.get $sh))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))))
      (local.set $node (i32.load (local.get $p)))
      (br $rows)))
    ;; Every value word finite: material 64..127, rows past their type word.
    (local.set $end (i32.add (i32.const 128) (i32.shl (local.get $n) (local.get $sh))))
    (local.set $i (i32.const 64))
    (block $finite (loop $words
      (br_if $finite (i32.ge_u (local.get $i) (local.get $end)))
      (if (i32.or (i32.lt_u (local.get $i) (i32.const 128))
            (i32.ne (i32.and (i32.sub (local.get $i) (i32.const 128)) (i32.sub (i32.shl (i32.const 1) (local.get $sh)) (i32.const 1))) (i32.const 0)))
        (then (if (i32.eq (i32.and (i32.load (i32.add (local.get $L) (local.get $i))) (i32.const 0x7f800000)) (i32.const 0x7f800000))
          (then (return (i32.const 28))))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br $words)))
    ;; Shape: header words 4..47 (abi .. reserved), flags, specular source.
    (memory.copy (local.get $S) (i32.add (local.get $L) (i32.const 4)) (i32.const 44))
    (i32.store offset=44 (local.get $S) (i32.load offset=52 (local.get $L)))
    (i32.store offset=56 (local.get $S) (i32.load offset=56 (local.get $L)))
    (i32.store offset=60 (local.get $S) (i32.const 1))
    (i32.const 0))

  ;; Copy the c40..c95 DEFs of scratch IR $ir into $out (c40 at +0), then
  ;; empty the IR.
  (func $d9g_harvest (param $ir i32) (param $out i32)
    (local $i i32) (local $rec i32) (local $r i32) (local $dst i32)
    (block $done (loop $recs
      (br_if $done (i32.ge_u (local.get $i) (i32.load offset=16 (local.get $ir))))
      (local.set $rec (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (local.set $r (i32.load offset=20 (local.get $rec)))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $rec)) (i32.const 81)) (i32.eq (i32.load offset=16 (local.get $rec)) (i32.const 2)))
            (i32.and (i32.ge_u (local.get $r) (i32.const 40)) (i32.lt_u (local.get $r) (i32.const 96))))
        (then
          (local.set $dst (i32.add (local.get $out) (i32.shl (i32.sub (local.get $r) (i32.const 40)) (i32.const 4))))
          (i32.store (local.get $dst) (i32.load offset=36 (local.get $rec)))
          (i32.store offset=4 (local.get $dst) (i32.load offset=52 (local.get $rec)))
          (i32.store offset=8 (local.get $dst) (i32.load offset=68 (local.get $rec)))
          (i32.store offset=12 (local.get $dst) (i32.load offset=84 (local.get $rec)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $recs)))
    (i32.store offset=16 (local.get $ir) (i32.const 0)))

  ;; The values $d3d_fixed_bind_lighting DEFs (c40..c95) for the DLT1 at
  ;; mem+103424 and the matrices of the DFX1 at mem+104640, into mem+104928.
  ;; The same 09aj routines write them into a scratch IR (mem+107136) --
  ;; normal matrix, positional rows -- and the rest is bind_lighting's own
  ;; arithmetic, so a shader compiled once takes any light/matrix values.
  ;; Memoized on the matrices and DLT1 bytes. 0, or 28 (singular normal
  ;; matrix: bind_lighting refuses it too).
  (func $d9g_light_values (result i32)
    (local $m i32) (local $L i32) (local $D i32) (local $out i32) (local $memo i32) (local $X i32)
    (local $len i32) (local $n i32) (local $sh i32) (local $spec i32) (local $kend i32) (local $k i32)
    (local $i i32) (local $p i32) (local $type i32)
    (local $x f32) (local $y f32) (local $z f32) (local $d f32)
    (local.set $m (call $d9g_m))
    (local.set $L (i32.add (local.get $m) (i32.const 103424)))
    (local.set $D (i32.add (local.get $m) (i32.const 104640)))
    (local.set $out (i32.add (local.get $m) (i32.const 104928)))
    (local.set $memo (i32.add (local.get $m) (i32.const 105824)))
    (local.set $X (i32.add (local.get $m) (i32.const 107136)))
    (local.set $n (i32.load offset=8 (local.get $L)))
    (local.set $sh (select (i32.const 7) (i32.const 6) (i32.ge_u (i32.load offset=4 (local.get $L)) (i32.const 2))))
    (local.set $spec (i32.and (i32.load offset=52 (local.get $L)) (i32.const 1)))
    (local.set $len (i32.add (i32.const 128) (i32.shl (local.get $n) (local.get $sh))))
    (if (i32.and (i32.eq (i32.load (local.get $memo)) (i32.const 1)) (i32.eq (i32.load offset=4 (local.get $memo)) (local.get $len)))
      (then (if (call $d3g_row_eq (i32.add (local.get $memo) (i32.const 8)) (i32.add (local.get $D) (i32.const 96)) (i32.const 128))
        (then (if (call $d3g_row_eq (i32.add (local.get $memo) (i32.const 136)) (local.get $L) (local.get $len))
          (then (return (i32.const 0))))))))
    (i32.store (local.get $memo) (i32.const 0))
    (memory.fill (local.get $out) (i32.const 0) (i32.const 896))
    (i32.store offset=16 (local.get $X) (i32.const 0))
    (if (i32.eqz (call $d3d_fixed_normal_matrix (local.get $D) (local.get $X))) (then (return (i32.const 28))))
    (call $d3d_fixed_def (local.get $X) (i32.const 43) (f32.const 0) (f32.const 0) (f32.const 1) (f32.const 3.4028234663852886e38))
    (local.set $i (i32.const 0))
    (loop $material
      (local.set $p (i32.add (local.get $L) (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 4)))))
      (call $d3d_fixed_def (local.get $X) (i32.add (i32.const 48) (local.get $i))
        (f32.load (local.get $p)) (f32.load offset=4 (local.get $p)) (f32.load offset=8 (local.get $p)) (f32.load offset=12 (local.get $p)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $material (i32.lt_u (local.get $i) (i32.const 3))))
    (call $d3d_fixed_argb (local.get $X) (i32.const 51) (i32.load offset=48 (local.get $L)))
    (if (local.get $spec) (then
      (call $d3d_fixed_def (local.get $X) (i32.const 46) (f32.load offset=112 (local.get $L)) (f32.load offset=116 (local.get $L))
        (f32.load offset=120 (local.get $L)) (f32.load offset=124 (local.get $L)))))
    (call $d9g_harvest (local.get $X) (local.get $out))
    ;; Light constants from c52 (directional 3, point 4, spot 5), then the
    ;; per-light specular colours at kend + i.
    (local.set $kend (i32.const 52))
    (local.set $i (i32.const 0))
    (block $kdone (loop $ks
      (br_if $kdone (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $type (i32.load (i32.add (local.get $L) (i32.add (i32.const 128) (i32.shl (local.get $i) (local.get $sh))))))
      (local.set $kend (i32.add (local.get $kend) (select (i32.const 3) (select (i32.const 5) (i32.const 4) (i32.eq (local.get $type) (i32.const 2)))
        (i32.eq (local.get $type) (i32.const 3)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $ks)))
    (local.set $k (i32.const 52))
    (local.set $i (i32.const 0))
    (block $ldone (loop $lights
      (br_if $ldone (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $p (i32.add (local.get $L) (i32.add (i32.const 128) (i32.shl (local.get $i) (local.get $sh)))))
      (local.set $type (i32.load (local.get $p)))
      (if (local.get $spec) (then
        (call $d3d_fixed_def (local.get $X) (i32.add (local.get $kend) (local.get $i))
          (f32.load offset=88 (local.get $p)) (f32.load offset=92 (local.get $p)) (f32.load offset=96 (local.get $p)) (f32.const 0))))
      (if (i32.ne (local.get $type) (i32.const 3))
        (then
          (call $d3d_fixed_positional_light (local.get $X) (local.get $D) (local.get $p) (local.get $k))
          (local.set $k (i32.add (local.get $k) (select (i32.const 5) (i32.const 4) (i32.eq (local.get $type) (i32.const 2))))))
        (else
          ;; Directional: -normalize(direction * view3x3), diffuse, ambient.
          (local.set $x (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=160 (local.get $D)))
            (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=176 (local.get $D))))
            (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=192 (local.get $D)))))
          (local.set $y (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=164 (local.get $D)))
            (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=180 (local.get $D))))
            (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=196 (local.get $D)))))
          (local.set $z (f32.add (f32.add (f32.mul (f32.load offset=36 (local.get $p)) (f32.load offset=168 (local.get $D)))
            (f32.mul (f32.load offset=40 (local.get $p)) (f32.load offset=184 (local.get $D))))
            (f32.mul (f32.load offset=44 (local.get $p)) (f32.load offset=200 (local.get $D)))))
          (local.set $d (f32.add (f32.add (f32.mul (local.get $x) (local.get $x)) (f32.mul (local.get $y) (local.get $y)))
            (f32.mul (local.get $z) (local.get $z))))
          (if (i32.and (f32.gt (local.get $d) (f32.const 0)) (f32.le (local.get $d) (f32.const 3.4028234663852886e38)))
            (then
              (local.set $d (f32.neg (f32.div (f32.const 1) (f32.sqrt (local.get $d)))))
              (local.set $x (f32.mul (local.get $x) (local.get $d)))
              (local.set $y (f32.mul (local.get $y) (local.get $d)))
              (local.set $z (f32.mul (local.get $z) (local.get $d))))
            (else (local.set $x (f32.const 0)) (local.set $y (f32.const 0)) (local.set $z (f32.const 0))))
          (call $d3d_fixed_def (local.get $X) (local.get $k) (local.get $x) (local.get $y) (local.get $z) (f32.const 0))
          (call $d3d_fixed_def (local.get $X) (i32.add (local.get $k) (i32.const 1)) (f32.load offset=4 (local.get $p))
            (f32.load offset=8 (local.get $p)) (f32.load offset=12 (local.get $p)) (f32.load offset=16 (local.get $p)))
          (call $d3d_fixed_def (local.get $X) (i32.add (local.get $k) (i32.const 2)) (f32.load offset=20 (local.get $p))
            (f32.load offset=24 (local.get $p)) (f32.load offset=28 (local.get $p)) (f32.load offset=32 (local.get $p)))
          (local.set $k (i32.add (local.get $k) (i32.const 3)))))
      (call $d9g_harvest (local.get $X) (local.get $out))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lights)))
    (i32.store offset=4 (local.get $memo) (local.get $len))
    (memory.copy (i32.add (local.get $memo) (i32.const 8)) (i32.add (local.get $D) (i32.const 96)) (i32.const 128))
    (memory.copy (i32.add (local.get $memo) (i32.const 136)) (local.get $L) (local.get $len))
    (i32.store (local.get $memo) (i32.const 1))
    (i32.const 0))

  ;; Fixed-function T&L (untransformed FVF, lit or not) -> 09aj cascade
  ;; VS (+ PS unless the guest binds one). The cascade's world / view /
  ;; projection DEFs (c0..c11) are packed as zero so the key, and the
  ;; compiled shader, do not depend on them; the DEFs are dropped from the
  ;; IR and the real columns go out as stage-0 CONSTS per draw instead.
  ;; Inputs: v0 POSITION, v1 COLOR0, v(2+k) TEXCOORDk, v10 COLOR1 (the
  ;; implicit DCLs). Returns the VS id or -reason; $d9g_tl_ps gets the PS.
  ;; Lit (RS 137): the DLT1 of $d9g_dlt1 is bound into the VS
  ;; ($d3d_fixed_bind_lighting, against the real matrices), its DEFs
  ;; (c40..c95) are dropped like the matrices' and $d9g_light_values stages
  ;; them per draw; NORMAL is v11, and lighting writes oD1. The lighting
  ;; shape key (mem+102400 + 64 i, zero when unlit) is part of the key.
  ;; Cache mem+78080: 16 x {vs, ps, len, key 1440}.
  (func $d9g_fixed_tl (param $active i32) (param $fvf i32) (param $guest_ps i32) (result i32)
    (local $m i32) (local $d i32) (local $tab i32) (local $len i32) (local $i i32) (local $e i32)
    (local $bundle i32) (local $vs i32) (local $ps i32) (local $ir i32) (local $rec i32) (local $ntex i32)
    (local $uv i32) (local $set i32) (local $imp i32) (local $c i32) (local $mat i32)
    (local $S i32) (local $D i32) (local $first i32)
    (local.set $m (call $d9g_m))
    (local.set $d (i32.add (local.get $m) (i32.const 4096)))
    (local.set $tab (i32.add (local.get $d) (i32.const 288)))
    (local.set $S (i32.add (local.get $m) (i32.const 104576)))
    (local.set $D (i32.add (local.get $m) (i32.const 104640)))
    (local.set $len (call $d9g_fixed_pack (local.get $active) (local.get $fvf) (local.get $guest_ps)))
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (global.set $d9g_tl_lit (i32.ne (call $d9g_rs (i32.const 137)) (i32.const 0)))
    ;; Texture transforms (TSS+96) and texgen (TEXCOORDINDEX >> 16): the
    ;; flags and index are in the key rows; the matrices go out as c16..c39
    ;; columns per draw (09aj DEFs c(16 + 4 stage + row)), and a
    ;; CAMERASPACENORMAL / REFLECTIONVECTOR texgen's normal matrix as
    ;; c40..c42. $d9g_draw_try already refused unknown flags (PROJECTED
    ;; COUNT3/4 is the pixel stage's divide: d9cl block),
    ;; generators past 3 and a normal texgen without NORMAL.
    (global.set $d9g_tl_tex (i32.const 0))
    (global.set $d9g_tl_nrm (i32.const 0))
    (local.set $i (i32.const 0))
    (loop $tts
      (if (call $d9g_tss (local.get $i) (i32.const 96)) (then
        (global.set $d9g_tl_tex (i32.or (global.get $d9g_tl_tex) (i32.shl (i32.const 1) (local.get $i))))
        (local.set $mat (i32.add (global.get $d9g_pw) (i32.add (i32.const 2196) (i32.shl (local.get $i) (i32.const 6)))))
        (local.set $c (i32.const 0))
        (loop $tcols
          (if (i32.eq (i32.and (i32.load (i32.add (local.get $mat) (i32.shl (local.get $c) (i32.const 2))))
                (i32.const 0x7f800000)) (i32.const 0x7f800000)) (then (return (i32.const -12))))
          (local.set $rec (i32.add (i32.add (local.get $m) (i32.const 111616))
            (i32.shl (i32.add (i32.shl (local.get $i) (i32.const 2)) (i32.and (local.get $c) (i32.const 3))) (i32.const 4))))
          (i32.store (i32.add (local.get $rec) (i32.shl (i32.shr_u (local.get $c) (i32.const 2)) (i32.const 2)))
            (i32.load (i32.add (local.get $mat) (i32.shl (local.get $c) (i32.const 2)))))
          ;; d9pj: PROJECTED | COUNT2 runs as COUNT4 with the y column as w
          ;; and y zero (the divisor is consumed).
          (if (call $d9pj_c2 (local.get $i)) (then
            (if (i32.eq (i32.and (local.get $c) (i32.const 3)) (i32.const 1)) (then
              (i32.store (i32.add (local.get $rec) (i32.shl (i32.shr_u (local.get $c) (i32.const 2)) (i32.const 2))) (i32.const 0))))
            (if (i32.eq (i32.and (local.get $c) (i32.const 3)) (i32.const 3)) (then
              (i32.store (i32.add (local.get $rec) (i32.shl (i32.shr_u (local.get $c) (i32.const 2)) (i32.const 2)))
                (i32.load (i32.add (local.get $mat) (i32.shl (i32.sub (local.get $c) (i32.const 2)) (i32.const 2)))))))))
          (local.set $c (i32.add (local.get $c) (i32.const 1)))
          (br_if $tcols (i32.lt_u (local.get $c) (i32.const 16))))))
      (local.set $set (i32.shr_u (call $d9g_tss (local.get $i) (i32.const 44)) (i32.const 16)))
      (if (i32.and (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0))
            (i32.or (i32.eq (local.get $set) (i32.const 1)) (i32.eq (local.get $set) (i32.const 3))))
        (then (global.set $d9g_tl_nrm (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $tts (i32.lt_u (local.get $i) (i32.const 6))))
    (if (global.get $d9g_tl_lit)
      (then
        (if (call $d9g_dlt1 (local.get $fvf)) (then (return (i32.const -28))))
        ;; Lighting writes oD1 (zero without SPECULARENABLE).
        (if (i32.eq (local.get $len) (i32.const 1440)) (then (i32.store offset=160 (local.get $tab) (i32.const 16)))))
      (else (memory.fill (local.get $S) (i32.const 0) (i32.const 64))))
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
    ;; ---- d9ms: a blend's world is the identity; its matrices are c96..
    (if (call $d9ms_blend_world) (then (call $d9ms_identity (i32.add (local.get $m) (i32.const 77840)))))
    (if (global.get $d9ms_blend) (then (if (call $d9ms_blend_consts) (then (return (i32.const -27))))))
    ;; ---- end d9ms
    (if (i32.or (global.get $d9g_tl_lit) (global.get $d9g_tl_nrm)) (then
      ;; DFX1 with the row-major world (+96), view (+160), projection (+224).
      (memory.copy (local.get $D) (local.get $d) (i32.const 288))
      (memory.copy (i32.add (local.get $D) (i32.const 96)) (i32.add (global.get $d9g_pw) (i32.const 2708)) (i32.const 64))
      (if (call $d9ms_blend_world) (then (call $d9ms_identity (i32.add (local.get $D) (i32.const 96))))) ;; d9ms
      (memory.copy (i32.add (local.get $D) (i32.const 160)) (i32.add (global.get $d9g_pw) (i32.const 2068)) (i32.const 64))
      (memory.copy (i32.add (local.get $D) (i32.const 224)) (i32.add (global.get $d9g_pw) (i32.const 2132)) (i32.const 64))
      (if (global.get $d9g_tl_lit)
        (then (if (call $d9g_light_values) (then (return (i32.const -28)))))
        (else
          ;; Unlit texgen: the normal matrix and c43 into the lit staging
          ;; (whose memo no longer describes it).
          (i32.store (i32.add (local.get $m) (i32.const 105824)) (i32.const 0))
          (memory.fill (i32.add (local.get $m) (i32.const 104928)) (i32.const 0) (i32.const 64))
          (i32.store offset=16 (i32.add (local.get $m) (i32.const 107136)) (i32.const 0))
          (if (i32.eqz (call $d3d_fixed_normal_matrix (local.get $D) (i32.add (local.get $m) (i32.const 107136))))
            (then (return (i32.const -12))))
          (call $d3d_fixed_def (i32.add (local.get $m) (i32.const 107136)) (i32.const 43)
            (f32.const 0) (f32.const 0) (f32.const 1) (f32.const 3.4028234663852886e38))
          (call $d9g_harvest (i32.add (local.get $m) (i32.const 107136)) (i32.add (local.get $m) (i32.const 104928)))))))
    (local.set $i (i32.const 0))
    (loop $cache
      (local.set $e (i32.add (i32.add (local.get $m) (i32.const 78080)) (i32.mul (local.get $i) (i32.const 1452))))
      (if (i32.and (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0)) (i32.eq (i32.load offset=8 (local.get $e)) (local.get $len)))
            (i32.eq (call $d9ms_tl_key (local.get $i)) (global.get $d9ms_blend))) ;; d9ms
        (then (if (if (result i32) (call $d3g_row_eq (i32.add (local.get $e) (i32.const 12)) (local.get $d) (local.get $len))
              (then (call $d3g_row_eq (i32.add (i32.add (local.get $m) (i32.const 102400)) (i32.shl (local.get $i) (i32.const 6))) (local.get $S) (i32.const 64)))
              (else (i32.const 0)))
          (then
            (if (i32.eqz (global.get $d9fv_force)) (then
              (global.set $d9g_tl_ps (i32.load offset=4 (local.get $e)))
              (return (i32.load (local.get $e)))))
            ;; d9fv: re-emit (its core IR is kept): drop this entry.
            (call $d9g_release (i32.load (local.get $e)))
            (call $d9g_release (i32.load offset=4 (local.get $e)))
            (i32.store (local.get $e) (i32.const 0))
            (i32.store offset=4 (local.get $e) (i32.const 0))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cache (i32.lt_u (local.get $i) (i32.const 16))))
    ;; uvRequired (VS only): the stages whose coordinate set exists.
    (if (local.get $guest_ps) (then
      (local.set $i (i32.const 0))
      (loop $uvs
        (local.set $set (call $d9g_tss (local.get $i) (i32.const 44)))
        ;; d9cl: a generated coordinate (TEXCOORDINDEX >> 16) needs no input
        ;; set but is still the stage's output (it was dropped: t# read 0).
        (if (i32.or (i32.lt_u (i32.and (local.get $set) (i32.const 0xffff)) (local.get $ntex))
              (i32.ne (i32.shr_u (local.get $set) (i32.const 16)) (i32.const 0)))
          (then (local.set $uv (i32.or (local.get $uv) (i32.shl (i32.const 1) (local.get $i))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $uvs (i32.lt_u (local.get $i) (i32.const 6))))))
    (local.set $bundle (if (result i32) (i32.eq (local.get $len) (i32.const 1440))
      (then (call $d3d_fixed_compile_cascade6 (local.get $d) (local.get $tab) (i32.const 6)
        (select (i32.const 1) (i32.const 3) (local.get $guest_ps)) (local.get $uv)))
      (else (call $d3d_fixed_compile_cascade5 (local.get $d) (local.get $tab) (i32.const 6)
        (select (i32.const 1) (i32.const 3) (local.get $guest_ps)) (local.get $uv)))))
    (if (i32.eqz (local.get $bundle)) (then (return (i32.const -9))))
    ;; Lighting appends to the VS; its DEFs are the records from $first on.
    (local.set $first (i32.const 0x7fffffff))
    (if (global.get $d9g_tl_lit) (then
      (local.set $first (i32.load offset=16 (i32.load offset=4 (local.get $bundle))))
      (if (i32.eqz (call $d3d_fixed_bind_lighting (local.get $bundle) (local.get $D)
            (i32.add (local.get $m) (i32.const 103424))))
        (then (call $d3d_fixed_free (local.get $bundle)) (return (i32.const -28))))))
    ;; Drop the matrix DEFs (op 81, c0..c11) and lighting's (c40..c95).
    (local.set $ir (i32.load offset=4 (local.get $bundle)))
    (local.set $i (i32.const 0))
    (block $ddone (loop $defs
      (br_if $ddone (i32.ge_u (local.get $i) (i32.load offset=16 (local.get $ir))))
      (local.set $rec (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (if (i32.and (i32.eq (i32.load (local.get $rec)) (i32.const 81))
            (i32.and (i32.eq (i32.load offset=16 (local.get $rec)) (i32.const 2)) (i32.lt_u (i32.load offset=20 (local.get $rec)) (i32.const 12))))
        (then (i32.store (local.get $rec) (i32.const 0))))
      ;; The cascade's texture matrices (c16..c39) and texgen normal matrix
      ;; (c40..c42), built from the key's zero / identity matrices.
      (if (i32.and (i32.eq (i32.load (local.get $rec)) (i32.const 81))
            (i32.and (i32.eq (i32.load offset=16 (local.get $rec)) (i32.const 2))
              (i32.and (i32.ge_u (i32.load offset=20 (local.get $rec)) (i32.const 16)) (i32.lt_u (i32.load offset=20 (local.get $rec)) (i32.const 43)))))
        (then (i32.store (local.get $rec) (i32.const 0))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $rec)) (i32.const 81)) (i32.ge_u (local.get $i) (local.get $first)))
            (i32.and (i32.eq (i32.load offset=16 (local.get $rec)) (i32.const 2))
              (i32.and (i32.ge_u (i32.load offset=20 (local.get $rec)) (i32.const 40)) (i32.lt_u (i32.load offset=20 (local.get $rec)) (i32.const 96)))))
        (then (i32.store (local.get $rec) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $defs)))
    ;; d9ms: the blend / tween prologue (a new IR, freed after the emit).
    (if (global.get $d9ms_blend) (then
      (local.set $ir (call $d9ms_blend_ir (local.get $ir)))
      (if (i32.eqz (local.get $ir)) (then (call $d3d_fixed_free (local.get $bundle)) (return (i32.const -9))))))
    ;; Implicit DCLs for the FVF's inputs.
    (local.set $imp (i32.add (local.get $m) (i32.const 101952)))
    (memory.fill (local.get $imp) (i32.const 0) (i32.const 64))
    (i32.store (local.get $imp) (i32.const 0x80000000))
    (if (i32.and (local.get $fvf) (i32.const 64)) (then (i32.store offset=4 (local.get $imp) (i32.const 0x8000000a))))
    (if (i32.and (local.get $fvf) (i32.const 128)) (then (i32.store offset=40 (local.get $imp) (i32.const 0x8001000a))))
    (if (i32.and (local.get $fvf) (i32.const 16))
      (then (i32.store offset=44 (local.get $imp) (i32.const 0x80000003))))
    (local.set $i (i32.const 0))
    (block $tdone (loop $tcs
      (br_if $tdone (i32.ge_u (local.get $i) (local.get $ntex)))
      (i32.store (i32.add (local.get $imp) (i32.shl (i32.add (local.get $i) (i32.const 2)) (i32.const 2)))
        (i32.or (i32.const 0x80000005) (i32.shl (local.get $i) (i32.const 16))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $tcs)))
    (call $d9ms_blend_dcls (local.get $imp)) ;; d9ms
    (global.set $vc_implicit_dcl (local.get $imp))
    (local.set $vs (call $d9g_shader_emit (local.get $ir) (global.get $GPS_STAGE_VS)))
    (global.set $vc_implicit_dcl (i32.const 0))
    (if (global.get $d9ms_blend) (then (call $d3d_shader_vm_free (local.get $ir)))) ;; d9ms
    (if (i32.and (i32.ne (local.get $vs) (i32.const 0)) (i32.eqz (local.get $guest_ps)))
      (then
        (local.set $ps (call $d9cl_ps_emit (i32.load offset=8 (local.get $bundle)))) ;; d9cl
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
    (call $d9ms_tl_key_set (local.get $i) (global.get $d9ms_blend)) ;; d9ms
    (memory.copy (i32.add (local.get $e) (i32.const 12)) (local.get $d) (local.get $len))
    (memory.copy (i32.add (i32.add (local.get $m) (i32.const 102400)) (i32.shl (local.get $i) (i32.const 6))) (local.get $S) (i32.const 64))
    (global.set $d9g_tl_ps (local.get $ps))
    (local.get $vs))

  ;; ---- d9ms: gathered vertex input ------------------------------------------
  ;; A vertex input the executor cannot read in place -- a declaration
  ;; element on stream 1..15, a D3DDECLTYPE past D3DCOLOR, a declaration that
  ;; is not exactly an FVF layout under fixed function, an XYZW / XYZBn FVF
  ;; -- is gathered per draw into one interleaved arena vertex of canonical
  ;; types and drawn as DRAW_UP. Each element becomes FLOATn (its D3D
  ;; component count, converted exactly as D3D defines the type: the f64
  ;; quotient rounded once to f32) or stays D3DCOLOR (4 raw bytes; the
  ;; executor reads it in D3D order). Vertex v of the draw reads stream s at
  ;; pointer_s + v * stride_s: pointer_s is the base-vertex pointer 09ae
  ;; published ($d3d9_stream_pointer), v runs MinIndex .. MinIndex +
  ;; NumVertices (0 .. n for a non-indexed draw), so BaseVertexIndex,
  ;; MinIndex and NumVertices are the D3D ones. A Draw*UP is stream 0.
  ;; Stream frequency cannot reach a draw: SetStreamSourceFreq is still
  ;; crash_unimplemented in 09ad.
  ;;
  ;; Vertex stages from a gathered input ($d9ms_vsmode):
  ;;   1 guest VS: every element in declared order, a LAYOUT of its own
  ;;     (POSITIONT stays reason 27, as for an ungathered declaration);
  ;;   2 fixed T&L: POSITION / NORMAL / PSIZE / COLOR0..1 / TEXCOORD0..7 by
  ;;     semantic (others are not fixed-function inputs and are skipped),
  ;;     run as the FVF those semantics make ($d9ms_fvf, for 09aj's shape);
  ;;     texcoord gaps are zero FLOAT2 sets; the LAYOUT is ours;
  ;;   0 POSITIONT: gathered in exactly the XYZRHW FVF's byte order (so
  ;;     $d9g_layout's texmap layout applies); colours must be D3DCOLOR and
  ;;     PSIZE declines (27).
  ;; Block $d9ms_mem: +0 gather plan 16 x 32 {src wasm (vertex 0 + element
  ;; offset), src stride, src type (255 = zero fill), dst offset, dst comps,
  ;; usage, index, dst vtype}, +512 synthetic declaration from an FVF (the
  ;; 09ae object shape: +12 tag, +16 bytes, +24 elements).
  (global $d9ms_mem (mut i32) (i32.const 0))
  (global $d9ms_n (mut i32) (i32.const 0))
  (global $d9ms_stride (mut i32) (i32.const 0))
  (global $d9ms_vsmode (mut i32) (i32.const 0))
  (global $d9ms_fvf (mut i32) (i32.const 0))

  (func $d9ms_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $d9ms_mem)) (then
      (local.set $g (call $gps_alloc (i32.const 4096)))
      (if (i32.eqz (local.get $g)) (then (call $d9g_fail (i32.const 40))))
      (global.set $d9ms_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $d9ms_mem) (i32.const 0) (i32.const 4096))))
    (global.get $d9ms_mem))

  ;; D3DDECLTYPE 0..16: components (low nibble) and bytes (high nibble / 4).
  (func $d9ms_comps (param $type i32) (result i32)
    (i32.and (i32.load8_u (i32.add (global.get $d9ms_types) (local.get $type))) (i32.const 15)))
  (func $d9ms_bytes (param $type i32) (result i32)
    (i32.shr_u (i32.and (i32.load8_u (i32.add (global.get $d9ms_types) (local.get $type))) (i32.const 0xf0)) (i32.const 2)))
  (global $d9ms_types (mut i32) (i32.const 0))
  (func $d9ms_types_init
    (local $t i32)
    (if (global.get $d9ms_types) (then (return)))
    (local.set $t (i32.add (call $d9ms_m) (i32.const 1000)))
    ;; FLOAT1..4, D3DCOLOR, UBYTE4, SHORT2, SHORT4, UBYTE4N, SHORT2N, SHORT4N,
    ;; USHORT2N, USHORT4N, UDEC3, DEC3N, FLOAT16_2, FLOAT16_4.
    (i64.store (local.get $t) (i64.const 0x2412141444332211))
    (i64.store offset=8 (local.get $t) (i64.const 0x1213132412241214))
    (i32.store8 offset=16 (local.get $t) (i32.const 0x24))
    (global.set $d9ms_types (local.get $t)))

  ;; Synthetic declaration for an untransformed FVF (XYZ, XYZW, XYZB1..5)
  ;; into +512; its wasm address, or 0 when the FVF is not one of those.
  (func $d9ms_fvf_decl (param $fvf i32) (result i32)
    (local $dw i32) (local $n i32) (local $off i32) (local $pos i32) (local $nb i32) (local $nw i32)
    (local $beta i32) (local $i i32) (local $ntex i32) (local $code i32)
    (local.set $dw (i32.add (call $d9ms_m) (i32.const 512)))
    (local.set $pos (i32.and (local.get $fvf) (i32.const 0x400e)))
    (if (i32.eq (local.get $pos) (i32.const 4)) (then (return (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $pos)) (i32.and (local.get $pos) (i32.const 0x4000))) (then
      (if (i32.ne (local.get $pos) (i32.const 0x4002)) (then (return (i32.const 0))))))
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (if (i32.gt_u (local.get $ntex) (i32.const 8)) (then (return (i32.const 0))))
    (i32.store offset=12 (local.get $dw) (i32.const 0))
    (if (i32.eq (local.get $pos) (i32.const 0x4002))
      (then
        (call $d9ms_el (local.get $dw) (local.get $n) (i32.const 0) (i32.const 3) (i32.const 0) (i32.const 0))
        (local.set $off (i32.const 16)))
      (else
        (call $d9ms_el (local.get $dw) (local.get $n) (i32.const 0) (i32.const 2) (i32.const 0) (i32.const 0))
        (local.set $off (i32.const 12))
        (local.set $nb (i32.shr_s (i32.sub (local.get $pos) (i32.const 4)) (i32.const 1)))
        (if (i32.gt_s (local.get $nb) (i32.const 0)) (then
          (local.set $beta (i32.and (local.get $fvf) (i32.const 0x9000)))
          (if (i32.eq (local.get $beta) (i32.const 0x9000)) (then (return (i32.const 0))))
          (local.set $nw (i32.sub (local.get $nb) (i32.ne (local.get $beta) (i32.const 0))))
          (if (local.get $nw) (then
            (local.set $n (i32.add (local.get $n) (i32.const 1)))
            (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off) (i32.sub (local.get $nw) (i32.const 1))
              (i32.const 1) (i32.const 0))
            (local.set $off (i32.add (local.get $off) (i32.shl (local.get $nw) (i32.const 2))))))
          (if (local.get $beta) (then
            (local.set $n (i32.add (local.get $n) (i32.const 1)))
            (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off)
              (select (i32.const 5) (i32.const 4) (i32.eq (local.get $beta) (i32.const 0x1000))) (i32.const 2) (i32.const 0))
            (local.set $off (i32.add (local.get $off) (i32.const 4)))))))))
      (if (i32.and (local.get $fvf) (i32.const 16)) (then
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off) (i32.const 2) (i32.const 3) (i32.const 0))
        (local.set $off (i32.add (local.get $off) (i32.const 12)))))
      (if (i32.and (local.get $fvf) (i32.const 32)) (then
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off) (i32.const 0) (i32.const 4) (i32.const 0))
        (local.set $off (i32.add (local.get $off) (i32.const 4)))))
      (if (i32.and (local.get $fvf) (i32.const 64)) (then
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off) (i32.const 4) (i32.const 10) (i32.const 0))
        (local.set $off (i32.add (local.get $off) (i32.const 4)))))
      (if (i32.and (local.get $fvf) (i32.const 128)) (then
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off) (i32.const 4) (i32.const 10) (i32.const 1))
        (local.set $off (i32.add (local.get $off) (i32.const 4)))))
      (block $tdone (loop $tc
        (br_if $tdone (i32.ge_u (local.get $i) (local.get $ntex)))
        ;; FVF size code 0..3 = 2, 3, 4, 1 floats -> FLOAT2, FLOAT3, FLOAT4, FLOAT1.
        (local.set $code (i32.and (i32.shr_u (local.get $fvf) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 1)))) (i32.const 3)))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (call $d9ms_el (local.get $dw) (local.get $n) (local.get $off)
          (i32.and (i32.add (local.get $code) (i32.const 1)) (i32.const 3)) (i32.const 5) (local.get $i))
        (local.set $off (i32.add (local.get $off) (i32.shl (call $d9g_tc_size (local.get $fvf) (local.get $i)) (i32.const 2))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $tc)))
    (local.set $n (i32.add (local.get $n) (i32.const 1)))
    (i32.store offset=16 (local.get $dw) (i32.shl (i32.add (local.get $n) (i32.const 1)) (i32.const 3)))
    (local.get $dw))

  (func $d9ms_el (param $dw i32) (param $i i32) (param $off i32) (param $type i32) (param $usage i32) (param $index i32)
    (local $el i32)
    (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
    (i32.store16 (local.get $el) (i32.const 0))
    (i32.store16 offset=2 (local.get $el) (local.get $off))
    (i32.store8 offset=4 (local.get $el) (local.get $type))
    (i32.store8 offset=5 (local.get $el) (i32.const 0))
    (i32.store8 offset=6 (local.get $el) (local.get $usage))
    (i32.store8 offset=7 (local.get $el) (local.get $index)))

  ;; Does declaration $dw need a gather under a guest VS? (an element off
  ;; stream 0 or past D3DCOLOR).
  (func $d9ms_decl_needs (param $dw i32) (result i32)
    (local $n i32) (local $i i32) (local $el i32)
    (local.set $n (i32.sub (i32.shr_u (i32.load offset=16 (local.get $dw)) (i32.const 3)) (i32.const 1)))
    (block $done (loop $els
      (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
      (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
      (if (i32.or (i32.ne (i32.load16_u (local.get $el)) (i32.const 0)) (i32.gt_u (i32.load8_u offset=4 (local.get $el)) (i32.const 4)))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $els)))
    (i32.const 0))

  ;; One plan entry: element $el of $dw read from its stream into dst
  ;; offset $doff as $dcomps components (or D3DCOLOR when $dcomps is 0).
  ;; Advances $d9ms_n; the dst offset after it, or a negative reason.
  (func $d9ms_add (param $el i32) (param $doff i32) (param $dcomps i32) (param $kind i32) (param $desc i32) (result i32)
    (local $e i32) (local $s i32) (local $type i32) (local $ptr i32) (local $stride i32) (local $slot i32) (local $off i32)
    (if (i32.ge_u (global.get $d9ms_n) (i32.const 16)) (then (return (i32.const -27))))
    (local.set $e (i32.add (call $d9ms_m) (i32.shl (global.get $d9ms_n) (i32.const 5))))
    (global.set $d9ms_n (i32.add (global.get $d9ms_n) (i32.const 1)))
    (i32.store offset=12 (local.get $e) (local.get $doff))
    (i32.store offset=16 (local.get $e) (local.get $dcomps))
    (i32.store offset=28 (local.get $e) (select (i32.sub (local.get $dcomps) (i32.const 1)) (global.get $GPS_VTYPE_D3DCOLOR) (local.get $dcomps)))
    (if (i32.eqz (local.get $el)) (then
      ;; A zero-filled texcoord gap (usage/index set by the caller).
      (i32.store offset=8 (local.get $e) (i32.const 255))
      (return (i32.add (local.get $doff) (i32.shl (local.get $dcomps) (i32.const 2))))))
    (local.set $s (i32.load16_u (local.get $el)))
    (local.set $type (i32.load8_u offset=4 (local.get $el)))
    (local.set $off (i32.load16_u offset=2 (local.get $el)))
    (i32.store offset=20 (local.get $e) (i32.load8_u offset=6 (local.get $el)))
    (i32.store offset=24 (local.get $e) (i32.load8_u offset=7 (local.get $el)))
    (if (i32.or (i32.gt_u (local.get $s) (i32.const 15)) (i32.or (i32.gt_u (local.get $type) (i32.const 16))
          (i32.ne (i32.load8_u offset=5 (local.get $el)) (i32.const 0))))
      (then (return (i32.const -27))))
    (if (i32.le_u (local.get $kind) (i32.const 1))
      (then
        ;; Draw*UP: stream 0 is the user pointer; nothing else is bound.
        (if (local.get $s) (then (return (i32.const -3))))
        (local.set $ptr (i32.load offset=32 (local.get $desc)))
        (local.set $stride (i32.load offset=36 (local.get $desc))))
      (else
        (local.set $slot (call $g2w (call $d3d9_stream_slot (i32.load offset=4 (local.get $desc)) (local.get $s))))
        (local.set $ptr (i32.load offset=12 (local.get $slot)))
        (local.set $stride (i32.load offset=8 (local.get $slot)))))
    (if (i32.or (i32.or (i32.eqz (local.get $ptr)) (i32.eqz (local.get $stride)))
          (i32.or (i32.gt_u (local.get $stride) (i32.const 1024))
            (i32.gt_u (i32.add (local.get $off) (call $d9ms_bytes (local.get $type))) (local.get $stride))))
      (then (return (i32.const -3))))
    (i32.store (local.get $e) (i32.add (call $g2w (local.get $ptr)) (local.get $off)))
    (i32.store offset=4 (local.get $e) (local.get $stride))
    (i32.store offset=8 (local.get $e) (local.get $type))
    (i32.add (local.get $doff) (select (i32.shl (local.get $dcomps) (i32.const 2)) (i32.const 4) (local.get $dcomps))))

  ;; Canonical dst components of $type: 0 = D3DCOLOR (kept raw).
  (func $d9ms_dcomps (param $type i32) (result i32)
    (select (i32.const 0) (call $d9ms_comps (local.get $type)) (i32.eq (local.get $type) (i32.const 4))))

  ;; Plans the gather for this draw. $vsmode 1 (a guest VS) or 2 (fixed
  ;; function: becomes 0 when the input is POSITIONT). Sets $d9ms_n,
  ;; $d9ms_stride, $d9ms_vsmode, $d9ms_fvf; 0, or a decline reason.
  (func $d9ms_plan (param $dw i32) (param $vsmode i32) (param $kind i32) (param $desc i32) (result i32)
    (local $n i32) (local $i i32) (local $el i32) (local $usage i32) (local $idx i32) (local $type i32)
    (local $off i32) (local $pos i32) (local $post i32) (local $nrm i32) (local $psz i32) (local $c0 i32) (local $c1 i32)
    (local $tc i32) (local $ntex i32) (local $fvf i32) (local $k i32) (local $t i32) (local $c i32) (local $e i32)
    (local $bw i32) (local $bi i32) (local $pos1 i32) (local $nrm1 i32)
    (call $d9ms_types_init)
    (global.set $d9ms_n (i32.const 0))
    (local.set $n (i32.sub (i32.shr_u (i32.load offset=16 (local.get $dw)) (i32.const 3)) (i32.const 1)))
    (if (i32.or (i32.lt_s (local.get $n) (i32.const 1)) (i32.gt_u (local.get $n) (i32.const 16))) (then (return (i32.const 27))))
    (if (i32.eq (local.get $vsmode) (i32.const 1)) (then
      (block $done (loop $els
        (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
        (if (i32.eq (i32.load8_u offset=6 (local.get $el)) (i32.const 9)) (then (return (i32.const 27))))
        (local.set $off (call $d9ms_add (local.get $el) (local.get $off)
          (call $d9ms_dcomps (i32.load8_u offset=4 (local.get $el))) (local.get $kind) (local.get $desc)))
        (if (i32.lt_s (local.get $off) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $off)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $els)))
      ;; The executor repacks each element to a 16-byte lane, at most 255 bytes.
      (if (i32.gt_u (global.get $d9ms_n) (i32.const 15)) (then (return (i32.const 27))))
      (global.set $d9ms_stride (local.get $off))
      (global.set $d9ms_vsmode (i32.const 1))
      ;; (the FVF the VS selection in $d9g_draw_try accepts)
      (global.set $d9ms_fvf (i32.const 2))
      (return (i32.const 0))))
    ;; Fixed function: find the fixed inputs by semantic.
    (block $done (loop $find
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
      (local.set $usage (i32.load8_u offset=6 (local.get $el)))
      (local.set $idx (i32.load8_u offset=7 (local.get $el)))
      (if (i32.eqz (local.get $idx)) (then
        (if (i32.eqz (local.get $usage)) (then (local.set $pos (local.get $el))))
        (if (i32.eq (local.get $usage) (i32.const 9)) (then (local.set $post (local.get $el))))
        (if (i32.eq (local.get $usage) (i32.const 3)) (then (local.set $nrm (local.get $el))))
        (if (i32.eq (local.get $usage) (i32.const 4)) (then (local.set $psz (local.get $el))))
        ;; blend inputs
        (if (i32.eq (local.get $usage) (i32.const 1)) (then (local.set $bw (local.get $el))))
        (if (i32.eq (local.get $usage) (i32.const 2)) (then (local.set $bi (local.get $el))))))
      (if (i32.eq (local.get $idx) (i32.const 1)) (then
        (if (i32.eqz (local.get $usage)) (then (local.set $pos1 (local.get $el))))
        (if (i32.eq (local.get $usage) (i32.const 3)) (then (local.set $nrm1 (local.get $el))))))
      (if (i32.eq (local.get $usage) (i32.const 10)) (then
        (if (i32.eqz (local.get $idx)) (then (local.set $c0 (local.get $el))))
        (if (i32.eq (local.get $idx) (i32.const 1)) (then (local.set $c1 (local.get $el))))))
      (if (i32.and (i32.eq (local.get $usage) (i32.const 5)) (i32.lt_u (local.get $idx) (i32.const 8))) (then
        (i32.store (i32.add (i32.add (call $d9ms_m) (i32.const 896)) (i32.shl (local.get $idx) (i32.const 2))) (local.get $el))
        (local.set $tc (i32.or (local.get $tc) (i32.shl (i32.const 1) (local.get $idx))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $find)))
    (if (i32.eqz (i32.xor (i32.eqz (local.get $pos)) (i32.eqz (local.get $post)))) (then (return (i32.const 2))))
    (local.set $ntex (i32.sub (i32.const 32) (i32.clz (local.get $tc))))
    (if (local.get $post)
      (then
        ;; XYZRHW byte order: POSITIONT as 4 floats, D3DCOLOR colours, sets.
        (if (local.get $psz) (then (return (i32.const 27))))
        (if (i32.and (i32.ne (local.get $c0) (i32.const 0)) (i32.ne (i32.load8_u offset=4 (local.get $c0)) (i32.const 4)))
          (then (return (i32.const 27))))
        (if (i32.and (i32.ne (local.get $c1) (i32.const 0)) (i32.ne (i32.load8_u offset=4 (local.get $c1)) (i32.const 4)))
          (then (return (i32.const 27))))
        (local.set $fvf (i32.const 4))
        (local.set $off (call $d9ms_add (local.get $post) (i32.const 0) (i32.const 4) (local.get $kind) (local.get $desc))))
      (else
        (local.set $fvf (i32.const 2))
        ;; d9cpu: an indexed blend gathers POSITION as 4 floats (w defaults
        ;; to 1), the slot $d9cpu_run writes the blended (x, y, z, w) into.
        (local.set $off (call $d9ms_add (local.get $pos) (i32.const 0)
          (select (i32.const 4) (call $d9ms_dcomps (i32.load8_u offset=4 (local.get $pos)))
            (i32.or (i32.eq (i32.load8_u offset=4 (local.get $pos)) (i32.const 4)) (call $d9cpu_pos4)))
          (local.get $kind) (local.get $desc)))
        (if (i32.and (i32.ne (local.get $nrm) (i32.const 0)) (i32.ge_s (local.get $off) (i32.const 0))) (then
          (local.set $fvf (i32.or (local.get $fvf) (i32.const 16)))
          (local.set $off (call $d9ms_add (local.get $nrm) (local.get $off)
            (select (i32.const 4) (call $d9ms_dcomps (i32.load8_u offset=4 (local.get $nrm)))
              (i32.eq (i32.load8_u offset=4 (local.get $nrm)) (i32.const 4)))
            (local.get $kind) (local.get $desc)))))
        (if (i32.and (i32.ne (local.get $psz) (i32.const 0)) (i32.ge_s (local.get $off) (i32.const 0))) (then
          (local.set $fvf (i32.or (local.get $fvf) (i32.const 32)))
          (local.set $off (call $d9ms_add (local.get $psz) (local.get $off)
            (select (i32.const 4) (call $d9ms_dcomps (i32.load8_u offset=4 (local.get $psz)))
              (i32.eq (i32.load8_u offset=4 (local.get $psz)) (i32.const 4)))
            (local.get $kind) (local.get $desc)))))
        (if (i32.ge_s (local.get $off) (i32.const 0)) (then
          (local.set $off (call $d9ms_blend_plan (local.get $bw) (local.get $bi) (local.get $pos1) (local.get $nrm1)
            (local.get $nrm) (local.get $off) (local.get $kind) (local.get $desc)))))))
    (if (i32.lt_s (local.get $off) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $off)))))
    (if (local.get $c0) (then
      (local.set $fvf (i32.or (local.get $fvf) (i32.const 64)))
      (local.set $off (call $d9ms_add (local.get $c0) (local.get $off)
        (call $d9ms_dcomps (i32.load8_u offset=4 (local.get $c0))) (local.get $kind) (local.get $desc)))
      (if (i32.lt_s (local.get $off) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $off)))))))
    (if (local.get $c1) (then
      (local.set $fvf (i32.or (local.get $fvf) (i32.const 128)))
      (local.set $off (call $d9ms_add (local.get $c1) (local.get $off)
        (call $d9ms_dcomps (i32.load8_u offset=4 (local.get $c1))) (local.get $kind) (local.get $desc)))
      (if (i32.lt_s (local.get $off) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $off)))))))
    (local.set $fvf (i32.or (local.get $fvf) (i32.shl (local.get $ntex) (i32.const 8))))
    (block $tdone (loop $sets
      (br_if $tdone (i32.ge_u (local.get $k) (local.get $ntex)))
      (if (i32.and (local.get $tc) (i32.shl (i32.const 1) (local.get $k)))
        (then
          (local.set $el (i32.load (i32.add (i32.add (call $d9ms_m) (i32.const 896)) (i32.shl (local.get $k) (i32.const 2)))))
          (local.set $t (i32.load8_u offset=4 (local.get $el)))
          ;; A D3DCOLOR set is read as its 4 normalized floats.
          (local.set $c (select (i32.const 4) (call $d9ms_comps (local.get $t)) (i32.eq (local.get $t) (i32.const 4))))
          (local.set $off (call $d9ms_add (local.get $el) (local.get $off)
            (select (i32.const 0) (local.get $c) (i32.and (i32.eq (local.get $t) (i32.const 4)) (i32.ne (local.get $post) (i32.const 0))))
            (local.get $kind) (local.get $desc)))
          (if (i32.lt_s (local.get $off) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $off)))))
          ;; POSITIONT: the FVF layout reads a set as floats only.
          (if (i32.and (i32.eq (local.get $t) (i32.const 4)) (i32.ne (local.get $post) (i32.const 0))) (then (return (i32.const 27)))))
        (else
          (local.set $c (i32.const 2))
          (local.set $e (i32.add (call $d9ms_m) (i32.shl (global.get $d9ms_n) (i32.const 5))))
          (local.set $off (call $d9ms_add (i32.const 0) (local.get $off) (i32.const 2) (local.get $kind) (local.get $desc)))
          (i32.store offset=20 (local.get $e) (i32.const 5))
          (i32.store offset=24 (local.get $e) (local.get $k))))
      ;; FVF size code of $c floats: 1 -> 3, 2 -> 0, 3 -> 1, 4 -> 2.
      (local.set $fvf (i32.or (local.get $fvf) (i32.shl (i32.and (i32.add (local.get $c) (i32.const 2)) (i32.const 3))
        (i32.add (i32.const 16) (i32.shl (local.get $k) (i32.const 1))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $sets)))
    (global.set $d9ms_stride (local.get $off))
    (global.set $d9ms_fvf (local.get $fvf))
    (global.set $d9ms_vsmode (select (i32.const 0) (i32.const 2) (i32.ne (local.get $post) (i32.const 0))))
    (i32.const 0))

  ;; IEEE half -> f32 (exact: every half is an f32).
  (func $d9ms_half (param $h i32) (result f32)
    (local $e i32) (local $m i32) (local $s i32)
    (local.set $s (i32.shl (i32.and (local.get $h) (i32.const 0x8000)) (i32.const 16)))
    (local.set $e (i32.and (i32.shr_u (local.get $h) (i32.const 10)) (i32.const 31)))
    (local.set $m (i32.and (local.get $h) (i32.const 0x3ff)))
    (if (i32.eqz (local.get $e)) (then
      (return (f32.mul (f32.convert_i32_s (select (i32.sub (i32.const 0) (local.get $m)) (local.get $m) (local.get $s)))
        (f32.const 0x1p-24)))))
    (if (i32.eq (local.get $e) (i32.const 31)) (then
      (return (f32.reinterpret_i32 (i32.or (local.get $s)
        (i32.or (i32.const 0x7f800000) (select (i32.const 0x400000) (i32.const 0) (local.get $m))))))))
    (f32.reinterpret_i32 (i32.or (local.get $s) (i32.or (i32.shl (i32.add (local.get $e) (i32.const 112)) (i32.const 23))
      (i32.shl (local.get $m) (i32.const 13))))))

  ;; Component $c of a $type element at wasm $src, as D3D defines it.
  (func $d9ms_comp (param $src i32) (param $type i32) (param $c i32) (result f32)
    (local $raw i32)
    (block $f16 (block $dec3n (block $udec3 (block $usn (block $sn (block $ubn (block $short (block $ub (block $flt
      (br_table $flt $flt $flt $flt $ub $ub $short $short $ubn $sn $sn $usn $usn $udec3 $dec3n $f16 $f16 (local.get $type)))
      (return (f32.load (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 2))))))
      (return (f32.convert_i32_u (i32.load8_u (i32.add (local.get $src) (local.get $c))))))
      (return (f32.convert_i32_s (i32.load16_s (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 1)))))))
      (return (f32.demote_f64 (f64.div (f64.convert_i32_u (i32.load8_u (i32.add (local.get $src) (local.get $c)))) (f64.const 255)))))
      (return (f32.demote_f64 (f64.div (f64.convert_i32_s (i32.load16_s (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 1)))))
        (f64.const 32767)))))
      (return (f32.demote_f64 (f64.div (f64.convert_i32_u (i32.load16_u (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 1)))))
        (f64.const 65535)))))
      (return (f32.convert_i32_u (i32.and (i32.shr_u (i32.load (local.get $src)) (i32.mul (local.get $c) (i32.const 10))) (i32.const 0x3ff)))))
      (local.set $raw (i32.and (i32.shr_u (i32.load (local.get $src)) (i32.mul (local.get $c) (i32.const 10))) (i32.const 0x3ff)))
      (return (f32.demote_f64 (f64.div (f64.convert_i32_s
        (select (i32.sub (local.get $raw) (i32.const 1024)) (local.get $raw) (i32.gt_u (local.get $raw) (i32.const 511))))
        (f64.const 511)))))
    (call $d9ms_half (i32.load16_u (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 1))))))

  ;; Gathers vertices $min .. $min + $num into wasm $dst ($d9ms_stride each).
  (func $d9ms_gather (param $dst i32) (param $min i32) (param $num i32)
    (local $v i32) (local $i i32) (local $e i32) (local $src i32) (local $d i32) (local $type i32)
    (local $c i32) (local $sc i32) (local $dc i32) (local $out i32)
    (block $vdone (loop $verts
      (br_if $vdone (i32.ge_u (local.get $v) (local.get $num)))
      (local.set $out (i32.add (local.get $dst) (i32.mul (local.get $v) (global.get $d9ms_stride))))
      (local.set $i (i32.const 0))
      (block $edone (loop $els
        (br_if $edone (i32.ge_u (local.get $i) (global.get $d9ms_n)))
        (local.set $e (i32.add (call $d9ms_m) (i32.shl (local.get $i) (i32.const 5))))
        (local.set $type (i32.load offset=8 (local.get $e)))
        (local.set $d (i32.add (local.get $out) (i32.load offset=12 (local.get $e))))
        (local.set $dc (i32.load offset=16 (local.get $e)))
        (if (i32.eq (local.get $type) (i32.const 255))
          (then (memory.fill (local.get $d) (i32.const 0) (i32.shl (local.get $dc) (i32.const 2))))
          (else
            (local.set $src (i32.add (i32.load (local.get $e))
              (i32.mul (i32.add (local.get $min) (local.get $v)) (i32.load offset=4 (local.get $e)))))
            (if (i32.eqz (local.get $dc))
              (then (i32.store (local.get $d) (i32.load (local.get $src))))
              (else
                (local.set $sc (call $d9ms_comps (local.get $type)))
                (if (i32.lt_u (local.get $type) (i32.const 4))
                  ;; Floats are copied as their bits.
                  (then (memory.copy (local.get $d) (local.get $src)
                    (i32.shl (select (local.get $sc) (local.get $dc) (i32.lt_u (local.get $sc) (local.get $dc))) (i32.const 2))))
                  (else
                    (local.set $c (i32.const 0))
                    (block $cdone (loop $comps
                      (br_if $cdone (i32.ge_u (local.get $c) (select (local.get $sc) (local.get $dc) (i32.lt_u (local.get $sc) (local.get $dc)))))
                      (f32.store (i32.add (local.get $d) (i32.shl (local.get $c) (i32.const 2)))
                        (if (result f32) (i32.eq (local.get $type) (i32.const 4))
                          ;; D3DCOLOR as floats: R, G, B, A from bytes 2, 1, 0, 3.
                          (then (f32.demote_f64 (f64.div (f64.convert_i32_u (i32.load8_u (i32.add (local.get $src)
                            (i32.xor (local.get $c) (select (i32.const 2) (i32.const 0) (i32.lt_u (local.get $c) (i32.const 3)))))))
                            (f64.const 255))))
                          (else (call $d9ms_comp (local.get $src) (local.get $type) (local.get $c)))))
                      (local.set $c (i32.add (local.get $c) (i32.const 1)))
                      (br $comps)))))
                ;; Missing components default to (0, 0, 0, 1).
                (local.set $c (local.get $sc))
                (block $fdone (loop $fill
                  (br_if $fdone (i32.ge_u (local.get $c) (local.get $dc)))
                  (f32.store (i32.add (local.get $d) (i32.shl (local.get $c) (i32.const 2)))
                    (select (f32.const 1) (f32.const 0) (i32.eq (local.get $c) (i32.const 3))))
                  (local.set $c (i32.add (local.get $c) (i32.const 1)))
                  (br $fill)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $els)))
      (local.set $v (i32.add (local.get $v) (i32.const 1)))
      (br $verts))))

  ;; The programmable LAYOUT of the planned gather (modes 1 and 2), cached
  ;; by a hash of its elements (key tag 0x6.......).
  (func $d9ms_layout (result i32)
    (local $i i32) (local $e i32) (local $h1 i32) (local $h2 i32) (local $id i32) (local $p i32) (local $q i32) (local $w i32)
    (local.set $h1 (global.get $d9ms_stride))
    (local.set $h2 (global.get $d9ms_n))
    (block $done (loop $hash
      (br_if $done (i32.ge_u (local.get $i) (global.get $d9ms_n)))
      (local.set $e (i32.add (call $d9ms_m) (i32.shl (local.get $i) (i32.const 5))))
      (local.set $w (i32.or (i32.or (i32.load offset=28 (local.get $e)) (i32.shl (i32.load offset=20 (local.get $e)) (i32.const 8)))
        (i32.or (i32.shl (i32.load offset=24 (local.get $e)) (i32.const 16)) (i32.shl (i32.load offset=12 (local.get $e)) (i32.const 20)))))
      (local.set $h1 (i32.add (i32.mul (local.get $h1) (i32.const 31)) (local.get $w)))
      (local.set $h2 (i32.xor (i32.mul (local.get $h2) (i32.const 0x01000193)) (local.get $w)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $hash)))
    (local.set $h2 (i32.or (i32.and (local.get $h2) (i32.const 0x0fffffff)) (i32.const 0x60000000)))
    (local.set $i (i32.const 0))
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (local.get $h1)) (i32.eq (i32.load offset=4 (local.get $e)) (global.get $d9ms_stride)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (local.get $h2)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (global.get $d9ms_n) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (global.get $d9ms_n))
    (store.field GpsLayout stride (local.get $p) (global.get $d9ms_stride))
    (local.set $q (i32.add (local.get $p) (size-of GpsLayout)))
    (local.set $i (i32.const 0))
    (block $edone (loop $emit
      (br_if $edone (i32.ge_u (local.get $i) (global.get $d9ms_n)))
      (local.set $e (i32.add (call $d9ms_m) (i32.shl (local.get $i) (i32.const 5))))
      (local.set $q (call $d9g_elem (local.get $q) (i32.load offset=28 (local.get $e)) (i32.load offset=20 (local.get $e))
        (i32.load offset=24 (local.get $e)) (i32.load offset=12 (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $emit)))
    (call $d9fv_lkeep (local.get $p)) ;; d9fv
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_layout_cache (local.get $h1) (global.get $d9ms_stride) (local.get $h2) (local.get $id))
    (local.get $id))

  ;; Entry from $d9g_draw_try: 0 = not gathered (the in-place path reads
  ;; it), 1 = planned (read $d9ms_vsmode / $d9ms_fvf), else -reason.
  (func $d9ms_select (param $vs i32) (param $decl i32) (param $fvf i32) (param $kind i32) (param $desc i32) (result i32)
    (local $dw i32) (local $r i32) (local $tab i32) (local $n i32) (local $i i32) (local $el i32) (local $reg i32)
    (local $blend i32)
    (global.set $d9ms_blend (i32.const 0))
    (global.set $d9cpu_blend (i32.const 0)) ;; d9cpu
    ;; A blend (fixed function only) always gathers its inputs.
    (local.set $blend (i32.and (i32.eqz (local.get $vs)) (call $d9ms_blend_rs)))
    (if (local.get $decl)
      (then
        (local.set $dw (call $g2w (local.get $decl)))
        (if (local.get $vs)
          (then (if (i32.eqz (call $d9ms_decl_needs (local.get $dw))) (then (return (i32.const 0)))))
          (else (if (i32.and (i32.ne (call $d9g_decl_fvf (local.get $decl)) (i32.const 0)) (i32.eqz (local.get $blend)))
            (then (return (i32.const 0)))))))
      (else
        ;; XYZ and XYZRHW FVFs are read in place.
        (if (i32.and (i32.eq (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 2)) (i32.eqz (local.get $blend)))
          (then (return (i32.const 0))))
        (if (i32.eq (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 4)) (then (return (i32.const 0))))
        (local.set $dw (call $d9ms_fvf_decl (local.get $fvf)))
        (if (i32.eqz (local.get $dw)) (then (return (i32.const -27))))))
    (local.set $r (call $d9ms_plan (local.get $dw) (select (i32.const 1) (i32.const 2) (i32.ne (local.get $vs) (i32.const 0)))
      (local.get $kind) (local.get $desc)))
    (if (local.get $r) (then (return (i32.sub (i32.const 0) (local.get $r)))))
    ;; A D3D8 declaration's register map declares a DCL-less shader's inputs
    ;; (as $d9g_layout_decl does).
    (if (i32.and (i32.ne (local.get $vs) (i32.const 0)) (i32.ne (local.get $decl) (i32.const 0))) (then
      (if (i32.eq (i32.load offset=12 (local.get $dw)) (i32.const 0xd3d80002)) (then
        (local.set $tab (i32.add (call $d9g_m) (i32.const 101952)))
        (memory.fill (local.get $tab) (i32.const 0) (i32.const 64))
        (local.set $n (i32.sub (i32.shr_u (i32.load offset=16 (local.get $dw)) (i32.const 3)) (i32.const 1)))
        (block $done (loop $els
          (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
          (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
          (local.set $reg (i32.load8_u (i32.add (i32.add (i32.add (local.get $dw) (i32.const 24))
            (i32.load offset=16 (local.get $dw))) (local.get $i))))
          (if (i32.gt_u (local.get $reg) (i32.const 15)) (then (return (i32.const -27))))
          (i32.store (i32.add (local.get $tab) (i32.shl (local.get $reg) (i32.const 2)))
            (i32.or (i32.const 0x80000000) (i32.or (i32.load8_u offset=6 (local.get $el))
              (i32.shl (i32.load8_u offset=7 (local.get $el)) (i32.const 16)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $els)))))))
    (i32.const 1))
  ;; ---- d9ms: vertex blending / tweening under fixed T&L ------------------
  ;; D3DRS_VERTEXBLEND (151) 1..3 WEIGHTS, 0WEIGHTS with
  ;; INDEXEDVERTEXBLENDENABLE (167), and TWEENING (255), lowered the way S3
  ;; lowers lighting: a prologue on 09aj's cascade VS, compiled once per
  ;; SHAPE ($d9ms_blend, part of the fixed T&L cache key), with the values
  ;; sent as CONSTS per draw. The input is always gathered (BLENDWEIGHT0
  ;; v12, BLENDINDICES0 v13, POSITION1 v14, NORMAL1 v15, as implicit DCLs).
  ;;   blend: r12 = sum_i w_i (v0 . W_i), r13.xyz = sum_i w_i (v11 . W_i^-T)
  ;;     (the last weight is 1 - the others), with the world matrix then the
  ;;     identity in c0..c3 and the DFX1, so the cascade's world-view path
  ;;     and lighting / texgen run on the blended world-space vertex; W_i is
  ;;     world matrix i, or the palette entry BLENDINDICES.i when indexed.
  ;;   tween: r12 = lerp(v0, v14, TWEENFACTOR), r13 = lerp(v11, v15, ...),
  ;;     under the real world matrix.
  ;; The cascade's v0 / v11 reads become r12 / r13. Matrix k (world k, or
  ;; palette entry k) is c(96 + 7k): four position columns, then three
  ;; inverse-transpose columns (zero when singular). Indexed: a0 = 7 x
  ;; index (D3DCOLOR indices are their RGBA order, x 255), 22 entries
  ;; (c96..c249); a draw naming an entry past 21 blends on the CPU instead
  ;; (d9cpu block). c250 / c251
  ;; are the prologue's DEFs. Shape: matrices (bits 0..2), indexed 8,
  ;; D3DCOLOR indices 16, tween 32, NORMAL 64.
  ;; d9ms block +1024: the shape of each fixed T&L cache entry (16 x 4);
  ;; +1536: the per-draw blend constants (up to 154 x 16).
  (global $d9ms_blend (mut i32) (i32.const 0))
  (global $d9ms_bi (mut i32) (i32.const 0))
  (global $d9ms_bcount (mut i32) (i32.const 0))

  ;; Does the render state ask for a blend (or a tween)?
  (func $d9ms_blend_rs (result i32)
    (local $vb i32)
    (local.set $vb (call $d9g_rs (i32.const 151)))
    (if (i32.eqz (local.get $vb)) (then (return (i32.const 0))))
    ;; 0WEIGHTS without indices is the one world matrix: unblended.
    (if (i32.eq (local.get $vb) (i32.const 256))
      (then (return (i32.ne (call $d9g_rs (i32.const 167)) (i32.const 0)))))
    (i32.const 1))

  ;; Float components a gathered element gets (D3DCOLOR: its 4 normalized).
  (func $d9ms_fcomps (param $el i32) (result i32)
    (call $d9ms_comps (i32.load8_u offset=4 (local.get $el))))

  ;; Plans the blend inputs after POSITION / NORMAL / PSIZE ($d9ms_plan,
  ;; fixed function); the next dst offset, or -reason. Sets $d9ms_blend.
  (func $d9ms_blend_plan (param $bw i32) (param $bi i32) (param $pos1 i32) (param $nrm1 i32) (param $nrm i32)
    (param $off i32) (param $kind i32) (param $desc i32) (result i32)
    (local $vb i32) (local $n i32) (local $shape i32) (local $t i32)
    (global.set $d9ms_blend (i32.const 0))
    (if (i32.eqz (call $d9ms_blend_rs)) (then (return (local.get $off))))
    (local.set $vb (call $d9g_rs (i32.const 151)))
    (local.set $shape (select (i32.const 0x40) (i32.const 0) (i32.ne (local.get $nrm) (i32.const 0))))
    (if (i32.eq (local.get $vb) (i32.const 255)) (then
      (if (i32.eqz (local.get $pos1)) (then (return (i32.const -27))))
      (if (i32.and (i32.ne (local.get $nrm) (i32.const 0)) (i32.eqz (local.get $nrm1))) (then (return (i32.const -27))))
      (local.set $off (call $d9ms_add (local.get $pos1) (local.get $off) (call $d9ms_fcomps (local.get $pos1))
        (local.get $kind) (local.get $desc)))
      (if (i32.and (i32.ne (local.get $nrm) (i32.const 0)) (i32.ge_s (local.get $off) (i32.const 0))) (then
        (local.set $off (call $d9ms_add (local.get $nrm1) (local.get $off) (call $d9ms_fcomps (local.get $nrm1))
          (local.get $kind) (local.get $desc)))))
      (global.set $d9ms_blend (i32.or (local.get $shape) (i32.const 0x20)))
      (return (local.get $off))))
    (local.set $n (select (i32.const 1) (i32.add (local.get $vb) (i32.const 1)) (i32.eq (local.get $vb) (i32.const 256))))
    (if (i32.gt_u (local.get $n) (i32.const 4)) (then (return (i32.const -27))))
    (local.set $shape (i32.or (local.get $shape) (local.get $n)))
    (if (i32.gt_u (local.get $n) (i32.const 1)) (then
      (if (i32.eqz (local.get $bw)) (then (return (i32.const -27))))
      (if (i32.lt_u (call $d9ms_fcomps (local.get $bw)) (i32.sub (local.get $n) (i32.const 1))) (then (return (i32.const -27))))
      (local.set $off (call $d9ms_add (local.get $bw) (local.get $off) (call $d9ms_fcomps (local.get $bw))
        (local.get $kind) (local.get $desc)))
      (if (i32.lt_s (local.get $off) (i32.const 0)) (then (return (local.get $off))))))
    (if (call $d9g_rs (i32.const 167)) (then
      (if (i32.eqz (local.get $bi)) (then (return (i32.const -27))))
      (local.set $t (i32.load8_u offset=4 (local.get $bi)))
      (local.set $shape (i32.or (local.get $shape)
        (i32.or (i32.const 8) (select (i32.const 16) (i32.const 0) (i32.eq (local.get $t) (i32.const 4))))))
      (global.set $d9ms_bi (i32.add (call $d9ms_m) (i32.shl (global.get $d9ms_n) (i32.const 5))))
      (local.set $off (call $d9ms_add (local.get $bi) (local.get $off) (call $d9ms_fcomps (local.get $bi))
        (local.get $kind) (local.get $desc)))))
    (global.set $d9ms_blend (local.get $shape))
    (local.get $off))

  ;; d9cpu: the largest palette entry an indexed blend's vertices [min,
  ;; min + num) name, each entry marked in the d9cpu used mask; -1 when one
  ;; is not an integer in 0..255 (the draw declines 27).
  (func $d9cpu_idx_scan (param $min i32) (param $num i32) (result i32)
    (local $e i32) (local $v i32) (local $c i32) (local $src i32) (local $type i32) (local $sc i32) (local $n i32) (local $f f32)
    (local $k i32) (local $max i32) (local $mask i32)
    (local.set $mask (i32.add (call $d9cpu_m) (global.get $D9CPU_MASK)))
    (local.set $e (global.get $d9ms_bi))
    (local.set $type (i32.load offset=8 (local.get $e)))
    (local.set $sc (call $d9ms_comps (local.get $type)))
    (local.set $n (i32.and (global.get $d9ms_blend) (i32.const 7)))
    (if (i32.lt_u (local.get $sc) (local.get $n)) (then (local.set $n (local.get $sc))))
    (block $vdone (loop $verts
      (br_if $vdone (i32.ge_u (local.get $v) (local.get $num)))
      (local.set $src (i32.add (i32.load (local.get $e))
        (i32.mul (i32.add (local.get $min) (local.get $v)) (i32.load offset=4 (local.get $e)))))
      (local.set $c (i32.const 0))
      (block $cdone (loop $comps
        (br_if $cdone (i32.ge_u (local.get $c) (local.get $n)))
        (local.set $f (if (result f32) (i32.eq (local.get $type) (i32.const 4))
          (then (f32.convert_i32_u (i32.load8_u (i32.add (local.get $src)
            (i32.xor (local.get $c) (select (i32.const 2) (i32.const 0) (i32.lt_u (local.get $c) (i32.const 3))))))))
          (else (call $d9ms_comp (local.get $src) (local.get $type) (local.get $c)))))
        (if (i32.eqz (i32.and (i32.and (f32.ge (local.get $f) (f32.const 0)) (f32.le (local.get $f) (f32.const 255)))
              (f32.eq (local.get $f) (f32.nearest (local.get $f)))))
          (then (return (i32.const -1))))
        (local.set $k (i32.trunc_f32_u (local.get $f)))
        (if (i32.gt_u (local.get $k) (local.get $max)) (then (local.set $max (local.get $k))))
        (i32.store8 (i32.add (local.get $mask) (local.get $k)) (i32.const 1))
        (local.set $c (i32.add (local.get $c) (i32.const 1)))
        (br $comps)))
      (local.set $v (i32.add (local.get $v) (i32.const 1)))
      (br $verts)))
    (local.get $max))

  ;; Blending replaces the world matrix by the identity (tweening does not);
  ;; so does a blend done on the CPU (d9cpu), whose output is world space.
  (func $d9ms_blend_world (result i32)
    (i32.or (i32.ne (global.get $d9cpu_blend) (i32.const 0))
      (i32.and (i32.ne (global.get $d9ms_blend) (i32.const 0))
        (i32.eqz (i32.and (global.get $d9ms_blend) (i32.const 0x20))))))
  (func $d9ms_identity (param $p i32)
    (memory.fill (local.get $p) (i32.const 0) (i32.const 64))
    (f32.store (local.get $p) (f32.const 1))
    (f32.store offset=20 (local.get $p) (f32.const 1))
    (f32.store offset=40 (local.get $p) (f32.const 1))
    (f32.store offset=60 (local.get $p) (f32.const 1)))

  ;; The shape a fixed T&L cache entry was compiled for.
  (func $d9ms_tl_key (param $i i32) (result i32)
    (i32.load (i32.add (i32.add (call $d9ms_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 2)))))
  (func $d9ms_tl_key_set (param $i i32) (param $v i32)
    (i32.store (i32.add (i32.add (call $d9ms_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))

  ;; Cofactor (r, c) of the 3x3 of row-major matrix $mat, in f64 (exact
  ;; products of f32s, one rounding).
  (func $d9ms_a (param $mat i32) (param $r i32) (param $c i32) (result f64)
    (f64.promote_f32 (f32.load (i32.add (local.get $mat)
      (i32.shl (i32.add (i32.shl (i32.rem_u (local.get $r) (i32.const 3)) (i32.const 2)) (i32.rem_u (local.get $c) (i32.const 3)))
        (i32.const 2))))))
  (func $d9ms_cof (param $mat i32) (param $r i32) (param $c i32) (result f64)
    (f64.sub
      (f64.mul (call $d9ms_a (local.get $mat) (i32.add (local.get $r) (i32.const 1)) (i32.add (local.get $c) (i32.const 1)))
        (call $d9ms_a (local.get $mat) (i32.add (local.get $r) (i32.const 2)) (i32.add (local.get $c) (i32.const 2))))
      (f64.mul (call $d9ms_a (local.get $mat) (i32.add (local.get $r) (i32.const 1)) (i32.add (local.get $c) (i32.const 2)))
        (call $d9ms_a (local.get $mat) (i32.add (local.get $r) (i32.const 2)) (i32.add (local.get $c) (i32.const 1))))))

  ;; Stages this draw's blend constants (c96.. at block +1536, count in
  ;; $d9ms_bcount); 0, or 27 for a non-finite matrix or tween factor.
  (func $d9ms_blend_consts (result i32)
    (local $st i32) (local $shape i32) (local $P i32) (local $k i32) (local $mat i32) (local $o i32) (local $j i32)
    (local $r i32) (local $det f64) (local $ok i32) (local $t f32)
    (local.set $st (i32.add (call $d9ms_m) (i32.const 1536)))
    (local.set $shape (global.get $d9ms_blend))
    (if (i32.and (local.get $shape) (i32.const 0x20)) (then
      (local.set $t (f32.reinterpret_i32 (call $d9g_rs (i32.const 170))))
      (if (i32.eqz (f32.lt (f32.abs (local.get $t)) (f32.const inf))) (then (return (i32.const 27))))
      (memory.fill (local.get $st) (i32.const 0) (i32.const 16))
      (f32.store (local.get $st) (local.get $t))
      (global.set $d9ms_bcount (i32.const 1))
      (return (i32.const 0))))
    (local.set $P (select (i32.const 22) (i32.and (local.get $shape) (i32.const 7)) (i32.and (local.get $shape) (i32.const 8))))
    (block $kdone (loop $mats
      (br_if $kdone (i32.ge_u (local.get $k) (local.get $P)))
      (local.set $mat (i32.add (global.get $d9g_pw) (i32.add (i32.const 2708) (i32.shl (local.get $k) (i32.const 6)))))
      (local.set $o (i32.add (local.get $st) (i32.mul (local.get $k) (i32.const 112))))
      (local.set $j (i32.const 0))
      (loop $cols
        (i32.store (i32.add (local.get $o) (i32.shl (local.get $j) (i32.const 4)))
          (i32.load (i32.add (local.get $mat) (i32.shl (local.get $j) (i32.const 2)))))
        (i32.store offset=4 (i32.add (local.get $o) (i32.shl (local.get $j) (i32.const 4)))
          (i32.load offset=16 (i32.add (local.get $mat) (i32.shl (local.get $j) (i32.const 2)))))
        (i32.store offset=8 (i32.add (local.get $o) (i32.shl (local.get $j) (i32.const 4)))
          (i32.load offset=32 (i32.add (local.get $mat) (i32.shl (local.get $j) (i32.const 2)))))
        (i32.store offset=12 (i32.add (local.get $o) (i32.shl (local.get $j) (i32.const 4)))
          (i32.load offset=48 (i32.add (local.get $mat) (i32.shl (local.get $j) (i32.const 2)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $cols (i32.lt_u (local.get $j) (i32.const 4))))
      (local.set $j (i32.const 0))
      (loop $finite
        (if (i32.eq (i32.and (i32.load (i32.add (local.get $mat) (i32.shl (local.get $j) (i32.const 2)))) (i32.const 0x7f800000))
              (i32.const 0x7f800000)) (then (return (i32.const 27))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $finite (i32.lt_u (local.get $j) (i32.const 16))))
      ;; Normal columns j = row j of the 3x3 inverse = (cof(0,j), cof(1,j),
      ;; cof(2,j)) / det, so dp3(n, column j) is (n . W^-T).j.
      (memory.fill (i32.add (local.get $o) (i32.const 64)) (i32.const 0) (i32.const 48))
      (if (i32.and (local.get $shape) (i32.const 0x40)) (then
        (local.set $det (f64.add (f64.add
          (f64.mul (call $d9ms_a (local.get $mat) (i32.const 0) (i32.const 0)) (call $d9ms_cof (local.get $mat) (i32.const 0) (i32.const 0)))
          (f64.mul (call $d9ms_a (local.get $mat) (i32.const 0) (i32.const 1)) (call $d9ms_cof (local.get $mat) (i32.const 0) (i32.const 1))))
          (f64.mul (call $d9ms_a (local.get $mat) (i32.const 0) (i32.const 2)) (call $d9ms_cof (local.get $mat) (i32.const 0) (i32.const 2)))))
        (if (f64.ne (local.get $det) (f64.const 0)) (then
          (local.set $j (i32.const 0))
          (loop $ncols
            (local.set $r (i32.const 0))
            (loop $nrows
              (f32.store (i32.add (i32.add (local.get $o) (i32.const 64))
                  (i32.add (i32.shl (local.get $j) (i32.const 4)) (i32.shl (local.get $r) (i32.const 2))))
                (f32.demote_f64 (f64.div (call $d9ms_cof (local.get $mat) (local.get $r) (local.get $j)) (local.get $det))))
              (local.set $r (i32.add (local.get $r) (i32.const 1)))
              (br_if $nrows (i32.lt_u (local.get $r) (i32.const 3))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br_if $ncols (i32.lt_u (local.get $j) (i32.const 3))))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $mats)))
    (global.set $d9ms_bcount (i32.mul (local.get $P) (i32.const 7)))
    (i32.const 0))

  ;; Implicit DCLs of the blend inputs (beside $d9g_fixed_tl's).
  (func $d9ms_blend_dcls (param $imp i32)
    (local $shape i32)
    (local.set $shape (global.get $d9ms_blend))
    (if (i32.eqz (local.get $shape)) (then (return)))
    (if (i32.and (local.get $shape) (i32.const 0x20)) (then
      (i32.store offset=56 (local.get $imp) (i32.const 0x80010000))
      (if (i32.and (local.get $shape) (i32.const 0x40)) (then (i32.store offset=60 (local.get $imp) (i32.const 0x80010003))))
      (return)))
    (if (i32.gt_u (i32.and (local.get $shape) (i32.const 7)) (i32.const 1))
      (then (i32.store offset=48 (local.get $imp) (i32.const 0x80000001))))
    (if (i32.and (local.get $shape) (i32.const 8)) (then (i32.store offset=52 (local.get $imp) (i32.const 0x80000002)))))

  ;; The last record of IR $ir.
  (func $d9ms_last (param $ir i32) (result i32)
    (i32.add (i32.add (local.get $ir) (i32.const 32))
      (i32.shl (i32.sub (i32.load offset=16 (local.get $ir)) (i32.const 1)) (i32.const 7))))

  ;; dp3 / dp4 $dst.(1 << $comp) = $a . (column $col of blend matrix $i).
  (func $d9ms_dp (param $ir i32) (param $op i32) (param $dst i32) (param $comp i32) (param $a i32) (param $i i32) (param $col i32)
    (local $q i32)
    (if (i32.and (global.get $d9ms_blend) (i32.const 8))
      (then
        (call $d3d_fixed_op (local.get $ir) (local.get $op) (i32.const 0) (local.get $dst) (i32.shl (i32.const 1) (local.get $comp))
          (i32.const 0) (local.get $a) (call $d3d_fixed_source (i32.const 2) (i32.const 0) (i32.const 0xe4) (i32.const 0)) (i32.const 0))
        ;; c[a0.i + 96 + col]
        (local.set $q (i32.add (call $d9ms_last (local.get $ir)) (i32.const 48)))
        (i32.store offset=4 (local.get $q) (i32.add (i32.const 96) (local.get $col)))
        (i32.store offset=12 (local.get $q) (i32.or (i32.const 256) (i32.shl (local.get $i) (i32.const 11)))))
      (else
        (call $d3d_fixed_op (local.get $ir) (local.get $op) (i32.const 0) (local.get $dst) (i32.shl (i32.const 1) (local.get $comp))
          (i32.const 0) (local.get $a)
          (call $d3d_fixed_source (i32.const 2) (i32.add (i32.add (i32.const 96) (i32.mul (local.get $i) (i32.const 7))) (local.get $col))
            (i32.const 0xe4) (i32.const 0))
          (i32.const 0)))))

  ;; The blend / tween prologue into $ir (see the block comment).
  (func $d9ms_prologue (param $ir i32)
    (local $shape i32) (local $nm i32) (local $nrm i32) (local $i i32) (local $j i32) (local $w i32) (local $p i32)
    (local.set $shape (global.get $d9ms_blend))
    (local.set $nrm (i32.ne (i32.and (local.get $shape) (i32.const 0x40)) (i32.const 0)))
    (if (i32.and (local.get $shape) (i32.const 0x20)) (then
      ;; r12 = v0 + (v14 - v0) t; r13 = v11 + (v15 - v11) t.
      (call $d3d_fixed_op (local.get $ir) (i32.const 2) (i32.const 0) (i32.const 14) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.const 14) (i32.const 0xe4) (i32.const 0))
        (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 0xe4) (i32.const 1)) (i32.const 0))
      (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 12) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 0) (i32.const 14) (i32.const 0xe4) (i32.const 0))
        (call $d3d_fixed_source (i32.const 2) (i32.const 96) (i32.const 0) (i32.const 0))
        (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 0xe4) (i32.const 0)))
      (if (local.get $nrm) (then
        (call $d3d_fixed_op (local.get $ir) (i32.const 2) (i32.const 0) (i32.const 16) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 1) (i32.const 15) (i32.const 0xe4) (i32.const 0))
          (call $d3d_fixed_source (i32.const 1) (i32.const 11) (i32.const 0xe4) (i32.const 1)) (i32.const 0))
        (call $d3d_fixed_op (local.get $ir) (i32.const 4) (i32.const 0) (i32.const 13) (i32.const 15) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 16) (i32.const 0xe4) (i32.const 0))
          (call $d3d_fixed_source (i32.const 2) (i32.const 96) (i32.const 0) (i32.const 0))
          (call $d3d_fixed_source (i32.const 1) (i32.const 11) (i32.const 0xe4) (i32.const 0)))))
      (return)))
    (local.set $nm (i32.and (local.get $shape) (i32.const 7)))
    ;; c250 = (1, 7 x index scale, 0, 0); c251 = 1 for each stored weight.
    (call $d3d_fixed_def (local.get $ir) (i32.const 250) (f32.const 1)
      (select (f32.const 1785) (f32.const 7) (i32.and (local.get $shape) (i32.const 16))) (f32.const 0) (f32.const 0))
    (call $d3d_fixed_def (local.get $ir) (i32.const 251)
      (select (f32.const 1) (f32.const 0) (i32.gt_u (local.get $nm) (i32.const 1)))
      (select (f32.const 1) (f32.const 0) (i32.gt_u (local.get $nm) (i32.const 2)))
      (select (f32.const 1) (f32.const 0) (i32.gt_u (local.get $nm) (i32.const 3))) (f32.const 0))
    (if (i32.and (local.get $shape) (i32.const 8)) (then
      ;; a0 = round(v13 x 7 x scale): each component a palette base.
      (call $d3d_fixed_op (local.get $ir) (i32.const 5) (i32.const 0) (i32.const 17) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.const 13) (i32.const 0xe4) (i32.const 0))
        (call $d3d_fixed_source (i32.const 2) (i32.const 250) (i32.const 0x55) (i32.const 0)) (i32.const 0))
      (local.set $p (call $d3d_fixed_instruction (local.get $ir) (i32.const 46) (i32.const 2)))
      (call $d3d_fixed_operand (local.get $p) (i32.const 0) (i32.const 3) (i32.const 0) (i32.const 15) (i32.const 0))
      (call $d3d_fixed_operand (local.get $p) (i32.const 1) (i32.const 0) (i32.const 17) (i32.const 0xe4) (i32.const 0))))
    (if (i32.gt_u (local.get $nm) (i32.const 1)) (then
      ;; r15.x = 1 - (the stored weights).
      (call $d3d_fixed_op (local.get $ir) (i32.const 9) (i32.const 0) (i32.const 15) (i32.const 1) (i32.const 0)
        (call $d3d_fixed_source (i32.const 1) (i32.const 12) (i32.const 0xe4) (i32.const 0))
        (call $d3d_fixed_source (i32.const 2) (i32.const 251) (i32.const 0xe4) (i32.const 0)) (i32.const 0))
      (call $d3d_fixed_op (local.get $ir) (i32.const 2) (i32.const 0) (i32.const 15) (i32.const 1) (i32.const 0)
        (call $d3d_fixed_source (i32.const 2) (i32.const 250) (i32.const 0) (i32.const 0))
        (call $d3d_fixed_source (i32.const 0) (i32.const 15) (i32.const 0) (i32.const 1)) (i32.const 0))))
    (block $done (loop $mats
      (br_if $done (i32.ge_u (local.get $i) (local.get $nm)))
      (local.set $w (if (result i32) (i32.lt_u (local.get $i) (i32.sub (local.get $nm) (i32.const 1)))
        (then (call $d3d_fixed_source (i32.const 1) (i32.const 12) (i32.mul (local.get $i) (i32.const 0x55)) (i32.const 0)))
        (else (if (result i32) (i32.eq (local.get $nm) (i32.const 1))
          (then (call $d3d_fixed_source (i32.const 2) (i32.const 250) (i32.const 0) (i32.const 0)))
          (else (call $d3d_fixed_source (i32.const 0) (i32.const 15) (i32.const 0) (i32.const 0)))))))
      (local.set $j (i32.const 0))
      (loop $pcols
        (call $d9ms_dp (local.get $ir) (i32.const 9) (i32.const 14) (local.get $j)
          (call $d3d_fixed_source (i32.const 1) (i32.const 0) (i32.const 0xe4) (i32.const 0)) (local.get $i) (local.get $j))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $pcols (i32.lt_u (local.get $j) (i32.const 4))))
      (call $d3d_fixed_op (local.get $ir) (select (i32.const 4) (i32.const 5) (local.get $i))
        (i32.const 0) (i32.const 12) (i32.const 15) (i32.const 0)
        (call $d3d_fixed_source (i32.const 0) (i32.const 14) (i32.const 0xe4) (i32.const 0)) (local.get $w)
        (call $d3d_fixed_source (i32.const 0) (i32.const 12) (i32.const 0xe4) (i32.const 0)))
      (if (local.get $nrm) (then
        (local.set $j (i32.const 0))
        (loop $ncols
          (call $d9ms_dp (local.get $ir) (i32.const 8) (i32.const 16) (local.get $j)
            (call $d3d_fixed_source (i32.const 1) (i32.const 11) (i32.const 0xe4) (i32.const 0)) (local.get $i)
            (i32.add (local.get $j) (i32.const 4)))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $ncols (i32.lt_u (local.get $j) (i32.const 3))))
        (call $d3d_fixed_op (local.get $ir) (select (i32.const 4) (i32.const 5) (local.get $i))
          (i32.const 0) (i32.const 13) (i32.const 7) (i32.const 0)
          (call $d3d_fixed_source (i32.const 0) (i32.const 16) (i32.const 0xe4) (i32.const 0)) (local.get $w)
          (call $d3d_fixed_source (i32.const 0) (i32.const 13) (i32.const 0xe4) (i32.const 0)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $mats)))
    (if (local.get $nrm) (then
      (call $d3d_fixed_op (local.get $ir) (i32.const 1) (i32.const 0) (i32.const 13) (i32.const 8) (i32.const 0)
        (call $d3d_fixed_source (i32.const 2) (i32.const 250) (i32.const 0xaa) (i32.const 0)) (i32.const 0) (i32.const 0)))))

  ;; The cascade VS $ir with the prologue: a new IR (the caller frees it),
  ;; or 0 when the cascade already uses r12..r27 or c96 and up.
  (func $d9ms_blend_ir (param $ir i32) (result i32)
    (local $n i32) (local $out i32) (local $i i32) (local $j i32) (local $rec i32) (local $p i32) (local $q i32)
    (local $op i32) (local $pass i32) (local $decl i32) (local $nrm i32)
    (local.set $nrm (i32.ne (i32.and (global.get $d9ms_blend) (i32.const 0x40)) (i32.const 0)))
    (local.set $n (i32.load offset=16 (local.get $ir)))
    (block $sdone (loop $scan
      (br_if $sdone (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $rec (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (if (i32.load (local.get $rec)) (then
        (local.set $j (i32.const 0))
        (block $odone (loop $ops
          (br_if $odone (i32.ge_u (local.get $j) (i32.load offset=8 (local.get $rec))))
          (local.set $q (i32.add (i32.add (local.get $rec) (i32.const 16)) (i32.shl (local.get $j) (i32.const 4))))
          (if (i32.and (i32.eqz (i32.load (local.get $q)))
                (i32.and (i32.ge_u (i32.load offset=4 (local.get $q)) (i32.const 12)) (i32.lt_u (i32.load offset=4 (local.get $q)) (i32.const 28))))
            (then (return (i32.const 0))))
          (if (i32.and (i32.eq (i32.load (local.get $q)) (i32.const 2)) (i32.ge_u (i32.load offset=4 (local.get $q)) (i32.const 96)))
            (then (return (i32.const 0))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br $ops)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.set $out (call $d3d_fixed_ir_sized (i32.load offset=8 (local.get $ir))
      (i32.add (i32.const 32) (i32.shl (i32.add (local.get $n) (i32.const 80)) (i32.const 7)))))
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
    (i32.store offset=12 (local.get $out) (i32.load offset=12 (local.get $ir)))
    (i32.store offset=28 (local.get $out) (i32.load offset=28 (local.get $ir)))
    ;; Pass 0: DCL / DEF records; then the prologue; pass 1: the program,
    ;; reading r12 / r13 for v0 / v11.
    (loop $passes
      (if (local.get $pass) (then (call $d9ms_prologue (local.get $out))))
      (local.set $i (i32.const 0))
      (block $rdone (loop $recs
        (br_if $rdone (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $rec (i32.add (i32.add (local.get $ir) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
        (local.set $op (i32.load (local.get $rec)))
        (local.set $decl (i32.or (i32.eq (local.get $op) (i32.const 31)) (i32.eq (local.get $op) (i32.const 81))))
        (if (i32.and (i32.ne (local.get $op) (i32.const 0)) (i32.eq (local.get $decl) (i32.eqz (local.get $pass)))) (then
          (local.set $p (call $d3d_fixed_instruction (local.get $out) (local.get $op) (i32.load offset=8 (local.get $rec))))
          (memory.copy (i32.add (local.get $p) (i32.const 12)) (i32.add (local.get $rec) (i32.const 12)) (i32.const 116))
          (if (local.get $pass) (then
            (local.set $j (i32.const 1))
            (block $odone (loop $ops
              (br_if $odone (i32.ge_u (local.get $j) (i32.load offset=8 (local.get $p))))
              (local.set $q (i32.add (i32.add (local.get $p) (i32.const 16)) (i32.shl (local.get $j) (i32.const 4))))
              (if (i32.eq (i32.load (local.get $q)) (i32.const 1)) (then
                (if (i32.eqz (i32.load offset=4 (local.get $q))) (then
                  (i32.store (local.get $q) (i32.const 0))
                  (i32.store offset=4 (local.get $q) (i32.const 12))))
                (if (i32.and (local.get $nrm) (i32.eq (i32.load offset=4 (local.get $q)) (i32.const 11))) (then
                  (i32.store (local.get $q) (i32.const 0))
                  (i32.store offset=4 (local.get $q) (i32.const 13))))))
              (local.set $j (i32.add (local.get $j) (i32.const 1)))
              (br $ops)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $recs)))
      (local.set $pass (i32.add (local.get $pass) (i32.const 1)))
      (br_if $passes (i32.lt_u (local.get $pass) (i32.const 2))))
    (local.get $out))
  ;; ---- end d9ms ----------------------------------------------------------------

  ;; ---- d9cpu: indexed vertex blending on the CPU ------------------------------
  ;; The shader palette above holds 22 matrices (c96..c249). An indexed
  ;; blend whose vertices name an entry past 21 -- D3D allows 0..255, the
  ;; software vertex-processing limit -- is blended here instead, inside the
  ;; d9ms gather: the vertex is gathered as usual (POSITION as 4 floats),
  ;; then $d9cpu_run overwrites its POSITION with sum_i w_i (p . W_i) and
  ;; its NORMAL with sum_i w_i (n . W_i^-T) -- the prologue's arithmetic in
  ;; the prologue's order (dp4 / dp3 left to right, the first product a mul,
  ;; the rest mads, the last weight 1 - dp4(weights, mask)) -- and the draw
  ;; runs the plain cascade VS ($d9ms_blend 0) under the identity world
  ;; ($d9ms_blend_world), so lighting and texgen see the same world-space
  ;; vertex as on the shader path. The BLENDWEIGHT / BLENDINDICES lanes stay
  ;; in the vertex unread. Only an index that is not an integer in 0..255 or
  ;; a non-finite matrix still declines 27. Stat 82 counts CPU-blended draws.
  ;; Block $d9cpu_mem: +0 256 x 112 per palette entry {the row-major matrix
  ;; (64), the 3x3 inverse transpose as rows (3 x 16, w 0)}, +28672 the
  ;; used-entry mask (256 bytes).
  (global $D9CPU_MASK i32 (i32.const 28672))
  (global $d9cpu_mem (mut i32) (i32.const 0))
  ;; The blend shape done on the CPU this draw (0: none), and the gathered
  ;; vertex's NORMAL (-1: none), weight and index offsets and their lanes.
  (global $d9cpu_blend (mut i32) (i32.const 0))
  (global $d9cpu_nrm (mut i32) (i32.const -1))
  (global $d9cpu_nrm4 (mut i32) (i32.const 0))
  (global $d9cpu_bw (mut i32) (i32.const 0))
  (global $d9cpu_bwc (mut i32) (i32.const 0))
  (global $d9cpu_bi (mut i32) (i32.const 0))
  (global $d9cpu_bic (mut i32) (i32.const 0))

  (func $d9cpu_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $d9cpu_mem)) (then
      (local.set $g (call $gps_alloc (i32.const 28928)))
      (if (i32.eqz (local.get $g)) (then (call $d9g_fail (i32.const 41))))
      (global.set $d9cpu_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $d9cpu_mem) (i32.const 0) (i32.const 28928))))
    (global.get $d9cpu_mem))

  ;; Does this draw's state ask for an indexed blend (POSITION as 4 floats)?
  (func $d9cpu_pos4 (result i32)
    (i32.and (call $d9ms_blend_rs) (i32.ne (call $d9g_rs (i32.const 167)) (i32.const 0))))

  ;; Palette entry $k into the table: 0, or 27 for a non-finite matrix.
  (func $d9cpu_mat (param $k i32) (param $nrm i32) (result i32)
    (local $mat i32) (local $o i32) (local $j i32) (local $r i32) (local $det f64)
    (local.set $mat (i32.add (global.get $d9g_pw) (i32.add (i32.const 2708) (i32.shl (local.get $k) (i32.const 6)))))
    (local.set $o (i32.add (call $d9cpu_m) (i32.mul (local.get $k) (i32.const 112))))
    (loop $finite
      (if (i32.eq (i32.and (i32.load (i32.add (local.get $mat) (i32.shl (local.get $j) (i32.const 2)))) (i32.const 0x7f800000))
            (i32.const 0x7f800000)) (then (return (i32.const 27))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br_if $finite (i32.lt_u (local.get $j) (i32.const 16))))
    (memory.copy (local.get $o) (local.get $mat) (i32.const 64))
    (memory.fill (i32.add (local.get $o) (i32.const 64)) (i32.const 0) (i32.const 48))
    (if (i32.eqz (local.get $nrm)) (then (return (i32.const 0))))
    ;; Row r of W^-T is (cof(r, 0), cof(r, 1), cof(r, 2)) / det: the same
    ;; values $d9ms_blend_consts stores as the prologue's columns.
    (local.set $det (f64.add (f64.add
      (f64.mul (call $d9ms_a (local.get $mat) (i32.const 0) (i32.const 0)) (call $d9ms_cof (local.get $mat) (i32.const 0) (i32.const 0)))
      (f64.mul (call $d9ms_a (local.get $mat) (i32.const 0) (i32.const 1)) (call $d9ms_cof (local.get $mat) (i32.const 0) (i32.const 1))))
      (f64.mul (call $d9ms_a (local.get $mat) (i32.const 0) (i32.const 2)) (call $d9ms_cof (local.get $mat) (i32.const 0) (i32.const 2)))))
    (if (f64.eq (local.get $det) (f64.const 0)) (then (return (i32.const 0))))
    (local.set $r (i32.const 0))
    (loop $rows
      (local.set $j (i32.const 0))
      (loop $cols
        (f32.store (i32.add (i32.add (local.get $o) (i32.const 64))
            (i32.add (i32.shl (local.get $r) (i32.const 4)) (i32.shl (local.get $j) (i32.const 2))))
          (f32.demote_f64 (f64.div (call $d9ms_cof (local.get $mat) (local.get $r) (local.get $j)) (local.get $det))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $cols (i32.lt_u (local.get $j) (i32.const 3))))
      (local.set $r (i32.add (local.get $r) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $r) (i32.const 3))))
    (i32.const 0))

  ;; Called by $d9g_draw_try once the draw has vertices: an indexed blend
  ;; (shader shape planned by d9ms) naming an entry past 21 moves to the CPU
  ;; (sets $d9cpu_blend, clears $d9ms_blend, fills the table). 0, or 27.
  (func $d9cpu_pick (param $desc i32) (param $kind i32) (param $n i32) (result i32)
    (local $min i32) (local $num i32) (local $max i32) (local $k i32) (local $i i32) (local $e i32) (local $mask i32)
    (if (i32.eqz (i32.and (global.get $d9ms_blend) (i32.const 8))) (then (return (i32.const 0))))
    (if (i32.and (local.get $kind) (i32.const 1))
      (then
        (local.set $min (i32.load offset=52 (local.get $desc)))
        (local.set $num (i32.load offset=56 (local.get $desc))))
      (else (local.set $num (local.get $n))))
    ;; (an empty or oversized range declines 20 later)
    (if (i32.or (i32.eqz (local.get $num)) (i32.gt_u (local.get $num) (i32.const 0x100000))) (then (return (i32.const 0))))
    (local.set $mask (i32.add (call $d9cpu_m) (global.get $D9CPU_MASK)))
    (memory.fill (local.get $mask) (i32.const 0) (i32.const 256))
    (local.set $max (call $d9cpu_idx_scan (local.get $min) (local.get $num)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (return (i32.const 27))))
    (if (i32.le_u (local.get $max) (i32.const 21)) (then (return (i32.const 0))))
    ;; Lanes the index element lacks read 0 (x, y, z) or 1 (w).
    (i32.store8 (local.get $mask) (i32.const 1))
    (i32.store8 offset=1 (local.get $mask) (i32.const 1))
    (if (i32.and (global.get $d9ms_blend) (i32.const 16))
      (then (i32.store8 offset=255 (local.get $mask) (i32.const 1))))
    (block $kdone (loop $mats
      (if (i32.load8_u (i32.add (local.get $mask) (local.get $k))) (then
        (if (call $d9cpu_mat (local.get $k) (i32.and (global.get $d9ms_blend) (i32.const 0x40)))
          (then (return (i32.const 27))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br_if $mats (i32.lt_u (local.get $k) (i32.const 256)))))
    ;; The gathered lanes, by semantic (POSITION is plan entry 0, offset 0).
    (global.set $d9cpu_nrm (i32.const -1))
    (block $edone (loop $ents
      (br_if $edone (i32.ge_u (local.get $i) (global.get $d9ms_n)))
      (local.set $e (i32.add (call $d9ms_m) (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.eqz (i32.load offset=24 (local.get $e))) (then
        (if (i32.eq (i32.load offset=20 (local.get $e)) (i32.const 3)) (then
          (global.set $d9cpu_nrm (i32.load offset=12 (local.get $e)))
          (global.set $d9cpu_nrm4 (i32.ge_u (i32.load offset=16 (local.get $e)) (i32.const 4)))))
        (if (i32.eq (i32.load offset=20 (local.get $e)) (i32.const 1)) (then
          (global.set $d9cpu_bw (i32.load offset=12 (local.get $e)))
          (global.set $d9cpu_bwc (i32.load offset=16 (local.get $e)))))
        (if (i32.eq (i32.load offset=20 (local.get $e)) (i32.const 2)) (then
          (global.set $d9cpu_bi (i32.load offset=12 (local.get $e)))
          (global.set $d9cpu_bic (i32.load offset=16 (local.get $e)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $ents)))
    (if (i32.eqz (i32.and (global.get $d9ms_blend) (i32.const 0x40))) (then (global.set $d9cpu_nrm (i32.const -1))))
    (if (i32.le_u (i32.and (global.get $d9ms_blend) (i32.const 7)) (i32.const 1)) (then (global.set $d9cpu_bwc (i32.const 0))))
    (global.set $d9cpu_blend (global.get $d9ms_blend))
    (global.set $d9ms_blend (i32.const 0))
    (call $d9g_stat (i32.const 82) (i32.const 1))
    (i32.const 0))

  ;; Lane $c of the gathered vector at $p with $n lanes ((0, 0, 0, 1) past them).
  (func $d9cpu_lane (param $p i32) (param $n i32) (param $c i32) (result f32)
    (if (result f32) (i32.lt_u (local.get $c) (local.get $n))
      (then (f32.load (i32.add (local.get $p) (i32.shl (local.get $c) (i32.const 2)))))
      (else (select (f32.const 1) (f32.const 0) (i32.eq (local.get $c) (i32.const 3))))))

  ;; Weight i of $nm matrices at gathered vertex $base.
  (func $d9cpu_weight (param $base i32) (param $nm i32) (param $i i32) (result f32)
    (local $p i32) (local $n i32)
    (if (i32.eq (local.get $nm) (i32.const 1)) (then (return (f32.const 1))))
    (local.set $p (i32.add (local.get $base) (global.get $d9cpu_bw)))
    (local.set $n (global.get $d9cpu_bwc))
    (if (i32.lt_u (local.get $i) (i32.sub (local.get $nm) (i32.const 1)))
      (then (return (call $d9cpu_lane (local.get $p) (local.get $n) (local.get $i)))))
    ;; 1 - dp4(v12, (nm > 1, nm > 2, nm > 3, 0)).
    (f32.add (f32.const 1) (f32.neg
      (f32.add (f32.add (f32.add
        (f32.mul (call $d9cpu_lane (local.get $p) (local.get $n) (i32.const 0)) (f32.const 1))
        (f32.mul (call $d9cpu_lane (local.get $p) (local.get $n) (i32.const 1))
          (select (f32.const 1) (f32.const 0) (i32.gt_u (local.get $nm) (i32.const 2)))))
        (f32.mul (call $d9cpu_lane (local.get $p) (local.get $n) (i32.const 2))
          (select (f32.const 1) (f32.const 0) (i32.gt_u (local.get $nm) (i32.const 3)))))
        (f32.mul (call $d9cpu_lane (local.get $p) (local.get $n) (i32.const 3)) (f32.const 0))))))

  ;; Table address of the palette entry weight i of gathered vertex $base names.
  (func $d9cpu_entry (param $base i32) (param $i i32) (result i32)
    (local $f f32)
    (local.set $f (call $d9cpu_lane (i32.add (local.get $base) (global.get $d9cpu_bi)) (global.get $d9cpu_bic) (local.get $i)))
    ;; D3DCOLOR indices were gathered as byte / 255.
    (if (i32.and (global.get $d9cpu_blend) (i32.const 16)) (then (local.set $f (f32.mul (local.get $f) (f32.const 255)))))
    (i32.add (call $d9cpu_m) (i32.mul (i32.and (i32.trunc_sat_f32_u (f32.nearest (local.get $f))) (i32.const 255)) (i32.const 112))))

  ;; Blends the $num gathered vertices at $dst in place (see the block
  ;; comment), in v128: p . M is x row0 + y row1 + z row2 + w row3, lane j
  ;; the dp4 ((x m0j + y m1j) + z m2j) + w m3j in the prologue's order. A
  ;; scalar version gave bit-identical vertices and took 1.77x the user CPU
  ;; on a fixed-work micro (4096 vertices x 400, four matrices + NORMAL:
  ;; 35.3 vs 20.0 ns/vertex, node 24 arm64), so only this one ships.
  (func $d9cpu_run (param $dst i32) (param $num i32)
    (local $v i32) (local $base i32) (local $nm i32) (local $i i32) (local $t i32) (local $np i32) (local $nrm i32)
    (local $p v128) (local $n v128) (local $q v128) (local $acc v128) (local $nacc v128) (local $wt v128)
    (local.set $nm (i32.and (global.get $d9cpu_blend) (i32.const 7)))
    (local.set $nrm (i32.ge_s (global.get $d9cpu_nrm) (i32.const 0)))
    (block $vdone (loop $verts
      (br_if $vdone (i32.ge_u (local.get $v) (local.get $num)))
      (local.set $base (i32.add (local.get $dst) (i32.mul (local.get $v) (global.get $d9ms_stride))))
      (local.set $p (v128.load (local.get $base)))
      (if (local.get $nrm) (then
        (local.set $np (i32.add (local.get $base) (global.get $d9cpu_nrm)))
        (local.set $n (v128.load (local.get $np)))))
      (local.set $i (i32.const 0))
      (block $mdone (loop $mats
        (br_if $mdone (i32.ge_u (local.get $i) (local.get $nm)))
        (local.set $wt (f32x4.splat (call $d9cpu_weight (local.get $base) (local.get $nm) (local.get $i))))
        (local.set $t (call $d9cpu_entry (local.get $base) (local.get $i)))
        (local.set $q (f32x4.mul (f32x4.add (f32x4.add (f32x4.add
          (f32x4.mul (i8x16.shuffle 0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3 (local.get $p) (local.get $p)) (v128.load (local.get $t)))
          (f32x4.mul (i8x16.shuffle 4 5 6 7 4 5 6 7 4 5 6 7 4 5 6 7 (local.get $p) (local.get $p)) (v128.load offset=16 (local.get $t))))
          (f32x4.mul (i8x16.shuffle 8 9 10 11 8 9 10 11 8 9 10 11 8 9 10 11 (local.get $p) (local.get $p)) (v128.load offset=32 (local.get $t))))
          (f32x4.mul (i8x16.shuffle 12 13 14 15 12 13 14 15 12 13 14 15 12 13 14 15 (local.get $p) (local.get $p)) (v128.load offset=48 (local.get $t))))
          (local.get $wt)))
        (local.set $acc (if (result v128) (local.get $i) (then (f32x4.add (local.get $q) (local.get $acc))) (else (local.get $q))))
        (if (local.get $nrm) (then
          (local.set $q (f32x4.mul (f32x4.add (f32x4.add
            (f32x4.mul (i8x16.shuffle 0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3 (local.get $n) (local.get $n)) (v128.load offset=64 (local.get $t)))
            (f32x4.mul (i8x16.shuffle 4 5 6 7 4 5 6 7 4 5 6 7 4 5 6 7 (local.get $n) (local.get $n)) (v128.load offset=80 (local.get $t))))
            (f32x4.mul (i8x16.shuffle 8 9 10 11 8 9 10 11 8 9 10 11 8 9 10 11 (local.get $n) (local.get $n)) (v128.load offset=96 (local.get $t))))
            (local.get $wt)))
          (local.set $nacc (if (result v128) (local.get $i) (then (f32x4.add (local.get $q) (local.get $nacc))) (else (local.get $q))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $mats)))
      (v128.store (local.get $base) (local.get $acc))
      (if (local.get $nrm) (then
        (if (global.get $d9cpu_nrm4)
          (then (v128.store (local.get $np) (local.get $nacc)))
          (else
            (i64.store (local.get $np) (i64x2.extract_lane 0 (local.get $nacc)))
            (f32.store offset=8 (local.get $np) (f32x4.extract_lane 2 (local.get $nacc)))))))
      (local.set $v (i32.add (local.get $v) (i32.const 1)))
      (br $verts))))
  ;; ---- d9cpu: CPU expansion into list DRAW_UPs ----------------------------
  ;; Three declines are a reshape of the vertex stream the executors already
  ;; draw, so WAT rewrites the draw as non-indexed lists (points, lines or
  ;; triangles) in DRAW_UP chunks:
  ;;   16 flat shading: every primitive gets its own vertices and the
  ;;      provoking vertex's COLOR0 / COLOR1 are copied into the others, so
  ;;      Gouraud interpolation of equal values is flat. The provoking vertex
  ;;      is D3D's (and GL's first-vertex convention): the first of a list
  ;;      or strip primitive, the second of a fan triangle. Only where the
  ;;      colours are vertex data: POSITIONT, or fixed T&L with LIGHTING off
  ;;      (a guest VS or lit colours still decline 16).
  ;;   24 a POSITIONT stage reading a texcoord set the FVF lacks: each
  ;;      vertex gets 8 zero bytes and the stage reads them as FLOAT2, the
  ;;      D3D default (0, 0, 0, 1) (texmap nibble 14, $d9g_layout).
  ;;   20 a draw over the arena / index limits: chunks of at most 1 MB of
  ;;      vertices, each a separate DRAW_UP.
  ;; Primitive order and winding are kept: an odd strip triangle (t, t+1,
  ;; t+2) is emitted (t, t+2, t+1), a fan triangle (0, t+1, t+2) as (t+1,
  ;; t+2, 0) -- rotations, so the provoking vertex comes first in both.
  ;; Indices were validated by the caller (21) before anything is emitted.
  ;; Stats 83 expanded draws, 84 their DRAW_UP chunks.

  ;; Source position (in the index / vertex sequence) of output vertex $j
  ;; of primitive $t.
  (func $d9cpu_seq (param $prim i32) (param $t i32) (param $j i32) (result i32)
    (if (i32.eq (local.get $prim) (i32.const 1)) (then (return (local.get $t))))
    (if (i32.eq (local.get $prim) (i32.const 2)) (then (return (i32.add (i32.shl (local.get $t) (i32.const 1)) (local.get $j)))))
    (if (i32.eq (local.get $prim) (i32.const 3)) (then (return (i32.add (local.get $t) (local.get $j)))))
    (if (i32.eq (local.get $prim) (i32.const 4)) (then (return (i32.add (i32.mul (local.get $t) (i32.const 3)) (local.get $j)))))
    (if (i32.eq (local.get $prim) (i32.const 5)) (then
      (if (i32.and (i32.and (local.get $t) (i32.const 1)) (i32.ne (local.get $j) (i32.const 0)))
        (then (return (i32.add (local.get $t) (i32.sub (i32.const 3) (local.get $j))))))
      (return (i32.add (local.get $t) (local.get $j)))))
    ;; Fan.
    (if (i32.eq (local.get $j) (i32.const 2)) (then (return (i32.const 0))))
    (i32.add (local.get $t) (i32.add (local.get $j) (i32.const 1))))

  ;; Byte offset / size of COLOR $c (0, 1) in the draw's vertex (-1: none).
  (func $d9cpu_coff (param $c i32) (param $gather i32) (param $fvf i32) (param $vsmode i32) (result i32)
    (local $i i32) (local $e i32) (local $o i32)
    (if (local.get $gather) (then
      (block $done (loop $els
        (br_if $done (i32.ge_u (local.get $i) (global.get $d9ms_n)))
        (local.set $e (i32.add (call $d9ms_m) (i32.shl (local.get $i) (i32.const 5))))
        (if (i32.and (i32.eq (i32.load offset=20 (local.get $e)) (i32.const 10)) (i32.eq (i32.load offset=24 (local.get $e)) (local.get $c)))
          (then (return (i32.load offset=12 (local.get $e)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $els)))
      (return (i32.const -1))))
    (if (i32.eqz (i32.and (local.get $fvf) (i32.shl (i32.const 64) (local.get $c)))) (then (return (i32.const -1))))
    (local.set $o (select (i32.const 12) (i32.const 16) (local.get $vsmode)))
    (if (i32.and (local.get $fvf) (i32.const 16)) (then (local.set $o (i32.add (local.get $o) (i32.const 12)))))
    (if (i32.and (local.get $fvf) (i32.const 32)) (then (local.set $o (i32.add (local.get $o) (i32.const 4)))))
    (if (i32.and (i32.eq (local.get $c) (i32.const 1)) (i32.ne (i32.and (local.get $fvf) (i32.const 64)) (i32.const 0)))
      (then (local.set $o (i32.add (local.get $o) (i32.const 4)))))
    (local.get $o))
  (func $d9cpu_csize (param $c i32) (param $gather i32) (result i32)
    (local $i i32) (local $e i32)
    (if (i32.eqz (local.get $gather)) (then (return (i32.const 4))))
    (block $done (loop $els
      (br_if $done (i32.ge_u (local.get $i) (global.get $d9ms_n)))
      (local.set $e (i32.add (call $d9ms_m) (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.and (i32.eq (i32.load offset=20 (local.get $e)) (i32.const 10)) (i32.eq (i32.load offset=24 (local.get $e)) (local.get $c)))
        (then (return (select (i32.shl (i32.load offset=16 (local.get $e)) (i32.const 2)) (i32.const 4)
          (i32.ne (i32.load offset=16 (local.get $e)) (i32.const 0))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $els)))
    (i32.const 0))

  ;; Emits the draw as list DRAW_UPs. $iptr (wasm) / $isize: the guest
  ;; indices, or 0; $vsrc: wasm address of vertex 0 (not read for a
  ;; gather); vertex $v of the sequence is source vertex $min + ($idx - $min).
  (func $d9cpu_expand (param $prim i32) (param $count i32) (param $iptr i32) (param $isize i32)
      (param $min i32) (param $vsrc i32) (param $stride i32) (param $gather i32) (param $pad i32)
      (param $flat i32) (param $fvf i32) (param $vsmode i32) (param $vs i32) (param $ps i32) (param $layout i32)
      (param $pj i32) (param $pjn i32) (result i32)
    (local $fv i32) (local $opos i32) (local $odst i32) (local $kept i32) (local $fb i32) (local $fs i32) ;; d9fv
    (local $vpp i32) (local $oprim i32) (local $ostride i32) (local $cp i32) (local $p0 i32) (local $np i32)
    (local $nv i32) (local $pos i32) (local $dst i32) (local $k i32) (local $t i32) (local $b i32) (local $v i32)
    (local $out i32) (local $c0 i32) (local $c1 i32) (local $s0 i32) (local $s1 i32) (local $q i32) (local $j i32)
    (local $p i32)
    (local.set $vpp (select (i32.const 1) (select (i32.const 2) (i32.const 3) (i32.le_u (local.get $prim) (i32.const 3)))
      (i32.eq (local.get $prim) (i32.const 1))))
    (local.set $oprim (select (i32.const 1) (select (i32.const 2) (i32.const 4) (i32.le_u (local.get $prim) (i32.const 3)))
      (i32.eq (local.get $prim) (i32.const 1))))
    (local.set $ostride (i32.add (local.get $stride) (i32.shl (local.get $pad) (i32.const 3))))
    ;; d9pj: $pj = 1 + the byte offset of a PROJECTED | COUNT2 stage's set,
    ;; appended as (x, 0, 0, y) after the pad for a DW divide.
    (if (local.get $pj) (then (local.set $ostride (i32.add (local.get $ostride) (i32.const 16)))))
    ;; d9fv: the VS runs on the CPU into 144-byte POSITIONT vertices too.
    (local.set $fv (global.get $d9fv_on))
    (local.set $cp (i32.div_u (i32.const 0x100000) (i32.mul (local.get $vpp)
      (i32.add (local.get $ostride) (select (i32.const 144) (i32.const 0) (local.get $fv))))))
    (if (i32.eqz (local.get $cp)) (then (local.set $cp (i32.const 1))))
    (local.set $c0 (i32.const -1)) (local.set $c1 (i32.const -1))
    (if (i32.and (local.get $flat) (i32.gt_u (local.get $vpp) (i32.const 1))) (then
      (local.set $c0 (call $d9cpu_coff (i32.const 0) (local.get $gather) (local.get $fvf) (local.get $vsmode)))
      (local.set $c1 (call $d9cpu_coff (i32.const 1) (local.get $gather) (local.get $fvf) (local.get $vsmode)))
      (local.set $s0 (call $d9cpu_csize (i32.const 0) (local.get $gather)))
      (local.set $s1 (call $d9cpu_csize (i32.const 1) (local.get $gather)))))
    (if (local.get $fv) (then
      (local.set $c0 (i32.const 16)) (local.set $c1 (i32.const 32)) (local.set $s0 (i32.const 16)) (local.set $s1 (i32.const 16))))
    (call $d9g_stat (i32.const 83) (i32.const 1))
    (block $done (loop $chunks
      (br_if $done (i32.ge_u (local.get $p0) (local.get $count)))
      (local.set $np (select (local.get $cp) (i32.sub (local.get $count) (local.get $p0))
        (i32.lt_u (local.get $cp) (i32.sub (local.get $count) (local.get $p0)))))
      (local.set $nv (i32.mul (local.get $np) (local.get $vpp)))
      (local.set $pos (call $d9g_arena (i32.mul (local.get $nv) (local.get $ostride))))
      (local.set $dst (call $d9g_aptr (local.get $pos)))
      (local.set $k (i32.const 0))
      (block $vdone (loop $verts
        (br_if $vdone (i32.ge_u (local.get $k) (local.get $nv)))
        (local.set $t (i32.add (local.get $p0) (i32.div_u (local.get $k) (local.get $vpp))))
        (local.set $b (call $d9cpu_seq (local.get $prim) (local.get $t) (i32.rem_u (local.get $k) (local.get $vpp))))
        (local.set $v (if (result i32) (local.get $iptr)
          (then (i32.sub (if (result i32) (i32.eq (local.get $isize) (i32.const 2))
              (then (i32.load16_u (i32.add (local.get $iptr) (i32.shl (local.get $b) (i32.const 1)))))
              (else (i32.load (i32.add (local.get $iptr) (i32.shl (local.get $b) (i32.const 2))))))
            (local.get $min)))
          (else (local.get $b))))
        (local.set $out (i32.add (local.get $dst) (i32.mul (local.get $k) (local.get $ostride))))
        (if (local.get $gather)
          (then (call $d9ms_gather (local.get $out) (i32.add (local.get $min) (local.get $v)) (i32.const 1)))
          (else (memory.copy (local.get $out)
            (i32.add (local.get $vsrc) (i32.mul (i32.add (local.get $min) (local.get $v)) (local.get $stride)))
            (local.get $stride))))
        (if (local.get $pad) (then (i64.store (i32.add (local.get $out) (local.get $stride)) (i64.const 0))))
        (if (local.get $pj) (then
          (local.set $j (i32.add (i32.add (local.get $out) (local.get $stride)) (i32.shl (local.get $pad) (i32.const 3))))
          (i32.store (local.get $j) (i32.load (i32.add (local.get $out) (i32.sub (local.get $pj) (i32.const 1)))))
          (i64.store offset=4 (local.get $j) (i64.const 0))
          (i32.store offset=12 (local.get $j) (i32.load offset=4 (i32.add (local.get $out) (i32.sub (local.get $pj) (i32.const 1)))))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $verts)))
      (if (global.get $d9cpu_blend) (then (call $d9cpu_run (local.get $dst) (local.get $nv))))
      (local.set $fb (local.get $dst)) (local.set $fs (local.get $ostride))
      (if (local.get $fv) (then
        (local.set $opos (call $d9g_arena (i32.mul (local.get $nv) (i32.const 144))))
        (local.set $odst (call $d9g_aptr (local.get $opos)))
        (if (call $d9fv_run (local.get $dst) (local.get $nv) (local.get $ostride) (local.get $odst))
          (then (call $d9g_stat (i32.const 122) (i32.const 1)) (return (i32.const 16))))
        (local.set $fb (local.get $odst)) (local.set $fs (i32.const 144))))
      ;; Flat: the provoking (first) vertex's colours into the others.
      (if (i32.or (i32.ge_s (local.get $c0) (i32.const 0)) (i32.ge_s (local.get $c1) (i32.const 0))) (then
        (local.set $q (i32.const 0))
        (block $fdone (loop $prims
          (br_if $fdone (i32.ge_u (local.get $q) (local.get $np)))
          (local.set $out (i32.add (local.get $fb) (i32.mul (i32.mul (local.get $q) (local.get $vpp)) (local.get $fs))))
          (local.set $j (i32.const 1))
          (block $jdone (loop $others
            (br_if $jdone (i32.ge_u (local.get $j) (local.get $vpp)))
            (if (i32.ge_s (local.get $c0) (i32.const 0)) (then
              (memory.copy (i32.add (i32.add (local.get $out) (i32.mul (local.get $j) (local.get $fs))) (local.get $c0))
                (i32.add (local.get $out) (local.get $c0)) (local.get $s0))))
            (if (i32.ge_s (local.get $c1) (i32.const 0)) (then
              (memory.copy (i32.add (i32.add (local.get $out) (i32.mul (local.get $j) (local.get $fs))) (local.get $c1))
                (i32.add (local.get $out) (local.get $c1)) (local.get $s1))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $others)))
          (local.set $q (i32.add (local.get $q) (i32.const 1)))
          (br $prims)))))
      (if (local.get $fv) (then
        (local.set $kept (call $d9fv_cull (local.get $dst) (local.get $ostride) (local.get $odst) (local.get $np) (local.get $vpp)))
        (if (i32.lt_s (local.get $kept) (i32.const 0)) (then (return (i32.const 16))))
        (local.set $nv (i32.mul (local.get $kept) (local.get $vpp)))))
      (if (local.get $nv) (then
      (local.set $p (call $d9g_begin (global.get $GPS_OP_DRAW_UP) (size-of GpsDraw)))
      (store.field GpsDraw prim (local.get $p) (local.get $oprim))
      (store.field GpsDraw index_size (local.get $p) (i32.const 0))
      (store.field GpsDraw pad2 (local.get $p) (i32.const 0))
      (store.field GpsDraw vs (local.get $p) (select (i32.const 0) (local.get $vs) (local.get $fv)))
      (store.field GpsDraw ps (local.get $p) (local.get $ps))
      (store.field GpsDraw layout (local.get $p) (select (global.get $d9fv_olayout) (local.get $layout) (local.get $fv)))
      (store.field GpsDraw vbuf (local.get $p) (i32.const 0))
      (store.field GpsDraw voff (local.get $p) (select (local.get $opos) (local.get $pos) (local.get $fv)))
      (store.field GpsDraw stride (local.get $p) (select (i32.const 144) (local.get $ostride) (local.get $fv)))
      (store.field GpsDraw ibuf (local.get $p) (i32.const 0))
      (store.field GpsDraw ioff (local.get $p) (i32.const 0))
      (store.field GpsDraw count (local.get $p) (local.get $nv))
      (store.field GpsDraw vcount (local.get $p) (local.get $nv))
      (drop (call $d9g_end (local.get $p)))
      (call $d9g_stat (i32.const 0) (i32.const 1))
      (call $d9g_stat (i32.const 84) (i32.const 1))))
      (local.set $p0 (i32.add (local.get $p0) (local.get $np)))
      (br $chunks)))
    (i32.const 0))
  ;; ---- end d9cpu ---------------------------------------------------------------

  ;; ---- d9fv: flat shading under a vertex stage, on the CPU (reason 16) -------
  ;; D3DSHADE_FLAT under a guest vertex shader or fixed-function lighting:
  ;; the colours are VS outputs, so the provoking vertex's cannot be copied
  ;; in the input. The VS runs here instead, in the shader VM (09ag) the
  ;; software executor runs it in, over the draw's vertices (gathered,
  ;; CPU-blended and expanded to a list by $d9cpu_expand as usual); its
  ;; outputs become POSITIONT list vertices (x, y, z, rhw | oD0 | oD1 |
  ;; oT0..5, all FLOAT4, stride 144) for the draw's own pixel shader, with
  ;; the provoking vertex's oD0/oD1 in every vertex of a primitive. Clip
  ;; space goes through the viewport exactly as 09ah $d3d_software_project
  ;; maps it (z through 0..1: the VIEWPORT record's range); oD0/oD1 clamp
  ;; to 0..1 as D3D's do. A POSITIONT draw is not clipped, so a primitive
  ;; is kept only when every vertex is inside 0 <= z <= w, w > 0 and every
  ;; enabled user plane (x/y need none: VIEWPORT clips pretransformed draws
  ;; to the same rectangle); one wholly outside a plane, or with a
  ;; non-finite vertex, is dropped as the executor would drop it. What is
  ;; not exact declines 16 with a sub-case stat: 121 vertex fog (a POSITIONT
  ;; draw's fog_mode 1 reads COLOR0 alpha, not oFog), 122 no VM program or
  ;; context, or the VM failed, 123 an input the layout lacks or an oT6/7
  ;; write (POSITIONT carries t0..5), 124 a primitive that needs clipping
  ;; (a later chunk's decline leaves earlier chunks drawn, on a target the
  ;; decline marks stale). 120 counts draws run here, 125 primitives
  ;; dropped. Points need no flat colour and draw on the GPU (16 retired).
  ;; The VS's program comes from re-emitting its SHADER once with
  ;; $d9fv_force set: the guest-VS / fixed T&L caches drop the hit entry,
  ;; and $d9g_shader_emit hands the core IR to $d9fv_keep before freeing it.
  ;; Own block (5456 bytes): +0 programs 8 x {vs id, program, flags, DCL
  ;; per v# (16 words: 0x80000000 | usage | index << 8)}, +640 layout
  ;; copies 32 x {id, count, stride, -, 16 GpsLayoutElem}, +5248 input map
  ;; 16 x {reg, type, offset}, +5440 viewport rect (l, t, r, b).
  (global $d9fv_force (mut i32) (i32.const 0))
  (global $d9fv_mem (mut i32) (i32.const 0))
  (global $d9fv_rr (mut i32) (i32.const 0))
  (global $d9fv_lrr (mut i32) (i32.const 0))
  (global $d9fv_on (mut i32) (i32.const 0))
  (global $d9fv_prog (mut i32) (i32.const 0))
  (global $d9fv_ctx (mut i32) (i32.const 0))
  (global $d9fv_nin (mut i32) (i32.const 0))
  (global $d9fv_olayout (mut i32) (i32.const 0))
  (func $d9fv_m (result i32)
    (local $g i32)
    (if (i32.eqz (global.get $d9fv_mem)) (then
      (local.set $g (call $gps_alloc (i32.const 5456)))
      (if (i32.eqz (local.get $g)) (then (call $d9g_fail (i32.const 1))))
      (global.set $d9fv_mem (call $gps_wa (local.get $g)))
      (memory.fill (global.get $d9fv_mem) (i32.const 0) (i32.const 5456))))
    (global.get $d9fv_mem))

  ;; The emitted VS $id's core IR: compile its program, note its DCLs and
  ;; whether it writes oT6/7. The core stays the caller's.
  (func $d9fv_keep (param $id i32) (param $core i32)
    (local $e i32) (local $i i32) (local $n i32) (local $rec i32) (local $reg i32) (local $flags i32)
    (local.set $e (i32.add (call $d9fv_m) (i32.mul (global.get $d9fv_rr) (i32.const 80))))
    (global.set $d9fv_rr (i32.and (i32.add (global.get $d9fv_rr) (i32.const 1)) (i32.const 7)))
    (call $d3d_shader_vm_free (i32.load offset=4 (local.get $e)))
    (memory.fill (local.get $e) (i32.const 0) (i32.const 80))
    (local.set $n (i32.load offset=16 (local.get $core)))
    (block $done (loop $recs
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $rec (i32.add (i32.add (local.get $core) (i32.const 32)) (i32.shl (local.get $i) (i32.const 7))))
      (if (i32.eq (i32.load (local.get $rec)) (i32.const 31))
        (then
          (local.set $reg (i32.load offset=36 (local.get $rec)))
          (if (i32.lt_u (local.get $reg) (i32.const 16)) (then
            (i32.store (i32.add (i32.add (local.get $e) (i32.const 12)) (i32.shl (local.get $reg) (i32.const 2)))
              (i32.or (i32.const 0x80000000) (i32.or (i32.and (i32.load offset=20 (local.get $rec)) (i32.const 255))
                (i32.shl (i32.and (i32.load offset=24 (local.get $rec)) (i32.const 255)) (i32.const 8))))))))
        (else
          (if (i32.and (i32.eq (i32.load offset=16 (local.get $rec)) (i32.const 6))
                (i32.ge_u (i32.load offset=20 (local.get $rec)) (i32.const 6)))
            (then (local.set $flags (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $recs)))
    (i32.store (local.get $e) (local.get $id))
    (i32.store offset=4 (local.get $e) (call $d3d_shader_vm_compile (local.get $core)))
    (i32.store offset=8 (local.get $e) (local.get $flags)))
  (func $d9fv_find (param $vs i32) (result i32)
    (local $i i32) (local $e i32)
    (loop $scan
      (local.set $e (i32.add (call $d9fv_m) (i32.mul (local.get $i) (i32.const 80))))
      (if (i32.and (i32.eq (i32.load (local.get $e)) (local.get $vs)) (i32.ne (local.get $vs) (i32.const 0)))
        (then (return (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 8))))
    (i32.const 0))

  ;; A programmable LAYOUT payload $p about to be published: keep a copy.
  (func $d9fv_lkeep (param $p i32)
    (local $e i32) (local $n i32)
    (local.set $e (i32.add (i32.add (call $d9fv_m) (i32.const 640)) (i32.mul (global.get $d9fv_lrr) (i32.const 144))))
    (global.set $d9fv_lrr (i32.and (i32.add (global.get $d9fv_lrr) (i32.const 1)) (i32.const 31)))
    (local.set $n (load.field GpsLayout count (local.get $p)))
    (i32.store (local.get $e) (load.field GpsLayout id (local.get $p)))
    (i32.store offset=4 (local.get $e) (select (local.get $n) (i32.const -1) (i32.le_u (local.get $n) (i32.const 16))))
    (i32.store offset=8 (local.get $e) (load.field GpsLayout stride (local.get $p)))
    (if (i32.le_u (local.get $n) (i32.const 16)) (then
      (memory.copy (i32.add (local.get $e) (i32.const 16)) (i32.add (local.get $p) (size-of GpsLayout))
        (i32.mul (local.get $n) (size-of GpsLayoutElem))))))
  (func $d9fv_lfind (param $id i32) (result i32)
    (local $i i32) (local $e i32)
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9fv_m) (i32.const 640)) (i32.mul (local.get $i) (i32.const 144))))
      (if (i32.and (i32.eq (i32.load (local.get $e)) (local.get $id)) (i32.le_u (i32.load offset=4 (local.get $e)) (i32.const 16)))
        (then (return (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (i32.const 0))

  ;; The output LAYOUT: POSITIONT, COLOR0, COLOR1, TEXCOORD0..5, FLOAT4 each.
  (func $d9fv_layout (result i32)
    (local $i i32) (local $e i32) (local $id i32) (local $p i32) (local $q i32)
    (loop $scan
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 1024)) (i32.shl (local.get $i) (i32.const 4))))
      (if (i32.and (i32.and (i32.eq (i32.load (local.get $e)) (i32.const 0x7f000001)) (i32.eq (i32.load offset=4 (local.get $e)) (i32.const 144)))
            (i32.and (i32.eq (i32.load offset=8 (local.get $e)) (i32.const 0x70000000)) (i32.ne (i32.load offset=12 (local.get $e)) (i32.const 0))))
        (then (return (i32.load offset=12 (local.get $e)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 32))))
    (local.set $id (call $d9g_id))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_LAYOUT)
      (i32.add (size-of GpsLayout) (i32.mul (i32.const 9) (size-of GpsLayoutElem)))))
    (store.field GpsLayout id (local.get $p) (local.get $id))
    (store.field GpsLayout count (local.get $p) (i32.const 9))
    (store.field GpsLayout stride (local.get $p) (i32.const 144))
    (local.set $q (call $d9g_elem (i32.add (local.get $p) (size-of GpsLayout))
      (global.get $GPS_VTYPE_FLOAT4) (global.get $GPS_USAGE_POSITIONT) (i32.const 0) (i32.const 0)))
    (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT4) (global.get $GPS_USAGE_COLOR) (i32.const 0) (i32.const 16)))
    (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT4) (global.get $GPS_USAGE_COLOR) (i32.const 1) (i32.const 32)))
    (local.set $i (i32.const 0))
    (loop $tc
      (local.set $q (call $d9g_elem (local.get $q) (global.get $GPS_VTYPE_FLOAT4) (global.get $GPS_USAGE_TEXCOORD)
        (local.get $i) (i32.add (i32.const 48) (i32.shl (local.get $i) (i32.const 4)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $tc (i32.lt_u (local.get $i) (i32.const 6))))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_layout_cache (i32.const 0x7f000001) (i32.const 144) (i32.const 0x70000000) (local.get $id))
    (local.get $id))

  ;; Draw setup once the VS ($vs) and its input layout are known: 0, or 16
  ;; with the sub-case counted. Allocates nothing.
  (func $d9fv_prep (param $vs i32) (param $layout i32) (result i32)
    (local $e i32) (local $l i32) (local $r i32) (local $w i32) (local $k i32) (local $el i32) (local $map i32)
    (local.set $e (call $d9fv_find (local.get $vs)))
    (if (i32.eqz (local.get $e)) (then (call $d9g_stat (i32.const 122) (i32.const 1)) (return (i32.const 16))))
    (if (i32.eqz (i32.load offset=4 (local.get $e))) (then (call $d9g_stat (i32.const 122) (i32.const 1)) (return (i32.const 16))))
    (local.set $l (call $d9fv_lfind (local.get $layout)))
    (if (i32.or (i32.eqz (local.get $l)) (i32.ne (i32.load offset=8 (local.get $e)) (i32.const 0)))
      (then (call $d9g_stat (i32.const 123) (i32.const 1)) (return (i32.const 16))))
    (local.set $map (i32.add (call $d9fv_m) (i32.const 5248)))
    (global.set $d9fv_nin (i32.const 0))
    (block $regs_done (loop $regs
      (br_if $regs_done (i32.ge_u (local.get $r) (i32.const 16)))
      (local.set $w (i32.load (i32.add (i32.add (local.get $e) (i32.const 12)) (i32.shl (local.get $r) (i32.const 2)))))
      (if (local.get $w) (then
        (local.set $k (i32.const 0))
        (block $found (loop $els
          (if (i32.ge_u (local.get $k) (i32.load offset=4 (local.get $l))) (then
            (call $d9g_stat (i32.const 123) (i32.const 1)) (return (i32.const 16))))
          (local.set $el (i32.add (i32.add (local.get $l) (i32.const 16)) (i32.mul (local.get $k) (size-of GpsLayoutElem))))
          (br_if $found (i32.and
            (i32.eq (load.field GpsLayoutElem usage (local.get $el)) (i32.and (local.get $w) (i32.const 255)))
            (i32.eq (load.field GpsLayoutElem index (local.get $el)) (i32.and (i32.shr_u (local.get $w) (i32.const 8)) (i32.const 255)))))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br $els)))
        (local.set $k (i32.add (local.get $map) (i32.mul (global.get $d9fv_nin) (i32.const 12))))
        (i32.store (local.get $k) (local.get $r))
        (i32.store offset=4 (local.get $k) (load.field GpsLayoutElem type (local.get $el)))
        (i32.store offset=8 (local.get $k) (load.field GpsLayoutElem offset (local.get $el)))
        (global.set $d9fv_nin (i32.add (global.get $d9fv_nin) (i32.const 1)))))
      (local.set $r (i32.add (local.get $r) (i32.const 1)))
      (br $regs)))
    (global.set $d9fv_prog (i32.load offset=4 (local.get $e)))
    (call $d9g_vp_rect (i32.add (call $d9fv_m) (i32.const 5440)))
    (global.set $d9fv_olayout (call $d9fv_layout))
    (i32.const 0))

  ;; Runs the VS over $n vertices at $src ($istride apart) into $n output
  ;; vertices at $out; each source vertex's first word becomes its clip
  ;; code (bit 0 z < 0, 1 z > w, 2 w <= 0, 3 + i user plane i, 30 not
  ;; finite). 0, or -1 when the VM cannot run it.
  (func $d9fv_run (param $src i32) (param $n i32) (param $istride i32) (param $out i32) (result i32)
    (local $vm i32) (local $i i32) (local $lane i32) (local $bits i32) (local $v i32) (local $k i32) (local $t i32)
    (local $base i32) (local $c i32) (local $j i32) (local $st i32) (local $o i32) (local $code i32) (local $vp i32)
    (local $cl i32) (local $mask i32)
    (local $x f32) (local $y f32) (local $z f32) (local $w f32) (local $d f32)
    (local.set $vm (global.get $d9fv_ctx))
    (if (i32.eqz (local.get $vm)) (then
      (local.set $vm (call $d3d_shader_vm_context (global.get $d9fv_prog) (i32.const 15)))
      (if (i32.eqz (local.get $vm)) (then (return (i32.const -1))))
      (global.set $d9fv_ctx (local.get $vm))
      (call $d3d_software_constants (local.get $vm) (i32.add (call $d9g_m) (i32.const 73728)) (i32.const 256))))
    (local.set $vp (i32.add (call $d9fv_m) (i32.const 5440)))
    (local.set $cl (call $d9cl_m))
    (local.set $mask (i32.load (local.get $cl)))
    (block $done (loop $batches
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (memory.fill (i32.add (local.get $vm) (i32.const 32)) (i32.const 0) (i32.const 16384))
      (memory.fill (i32.add (local.get $vm) (i32.const 24608)) (i32.const 0) (i32.const 32768))
      (local.set $lane (i32.const 0)) (local.set $bits (i32.const 0))
      (block $filled (loop $fill
        (br_if $filled (i32.ge_u (i32.add (local.get $i) (local.get $lane)) (local.get $n)))
        (local.set $v (i32.add (local.get $src) (i32.mul (i32.add (local.get $i) (local.get $lane)) (local.get $istride))))
        (local.set $k (i32.const 0))
        (block $ins_done (loop $ins
          (br_if $ins_done (i32.ge_u (local.get $k) (global.get $d9fv_nin)))
          (local.set $t (i32.add (i32.add (call $d9fv_m) (i32.const 5248)) (i32.mul (local.get $k) (i32.const 12))))
          (local.set $base (i32.add (i32.add (local.get $vm) (i32.const 8224))
            (i32.add (i32.shl (i32.load (local.get $t)) (i32.const 6)) (i32.shl (local.get $lane) (i32.const 2)))))
          (local.set $c (i32.add (local.get $v) (i32.load offset=8 (local.get $t))))
          (if (i32.eq (i32.load offset=4 (local.get $t)) (global.get $GPS_VTYPE_D3DCOLOR))
            (then
              ;; B, G, R, A bytes -> (R, G, B, A).
              (local.set $c (i32.load (local.get $c)))
              (f32.store (local.get $base) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (i32.const 16)) (i32.const 255))) (f32.const 255)))
              (f32.store offset=16 (local.get $base) (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (i32.const 8)) (i32.const 255))) (f32.const 255)))
              (f32.store offset=32 (local.get $base) (f32.div (f32.convert_i32_u (i32.and (local.get $c) (i32.const 255))) (f32.const 255)))
              (f32.store offset=48 (local.get $base) (f32.div (f32.convert_i32_u (i32.shr_u (local.get $c) (i32.const 24))) (f32.const 255))))
            (else
              ;; FLOATn: the missing components read (0, 0, 1) behind.
              (local.set $j (i32.const 0))
              (loop $comps
                (f32.store (i32.add (local.get $base) (i32.shl (local.get $j) (i32.const 4)))
                  (if (result f32) (i32.le_u (local.get $j) (i32.load offset=4 (local.get $t)))
                    (then (f32.load (i32.add (local.get $c) (i32.shl (local.get $j) (i32.const 2)))))
                    (else (select (f32.const 1) (f32.const 0) (i32.eq (local.get $j) (i32.const 3))))))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br_if $comps (i32.lt_u (local.get $j) (i32.const 4))))))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br $ins)))
        (local.set $bits (i32.or (local.get $bits) (i32.shl (i32.const 1) (local.get $lane))))
        (local.set $lane (i32.add (local.get $lane) (i32.const 1)))
        (br_if $fill (i32.lt_u (local.get $lane) (i32.const 4)))))
      (i32.store offset=8 (local.get $vm) (i32.const 0)) (i32.store offset=12 (local.get $vm) (i32.const 1))
      (i32.store offset=16 (local.get $vm) (local.get $bits))
      (loop $run
        (local.set $st (call $d3d_shader_vm_run (local.get $vm) (i32.const 0x1000000)))
        (br_if $run (i32.eq (local.get $st) (i32.const 1))))
      (if (local.get $st) (then (return (i32.const -1))))
      (local.set $lane (i32.const 0))
      (block $stored (loop $store
        (br_if $stored (i32.ge_u (i32.add (local.get $i) (local.get $lane)) (local.get $n)))
        (local.set $base (i32.add (i32.add (local.get $vm) (i32.const 32800)) (i32.shl (local.get $lane) (i32.const 2))))
        (local.set $x (f32.load (local.get $base))) (local.set $y (f32.load offset=16 (local.get $base)))
        (local.set $z (f32.load offset=32 (local.get $base))) (local.set $w (f32.load offset=48 (local.get $base)))
        (local.set $code (i32.const 0))
        (if (i32.eqz (i32.and
              (i32.and (f32.le (f32.abs (local.get $x)) (f32.const 3.4028234663852886e38)) (f32.le (f32.abs (local.get $y)) (f32.const 3.4028234663852886e38)))
              (i32.and (f32.le (f32.abs (local.get $z)) (f32.const 3.4028234663852886e38)) (f32.le (f32.abs (local.get $w)) (f32.const 3.4028234663852886e38)))))
          (then (local.set $code (i32.const 0x40000000))))
        (if (f32.lt (local.get $z) (f32.const 0)) (then (local.set $code (i32.or (local.get $code) (i32.const 1)))))
        (if (f32.gt (local.get $z) (local.get $w)) (then (local.set $code (i32.or (local.get $code) (i32.const 2)))))
        (if (f32.le (local.get $w) (f32.const 0)) (then (local.set $code (i32.or (local.get $code) (i32.const 4)))))
        (local.set $j (i32.const 0))
        (loop $planes
          (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $j))) (then
            (local.set $c (i32.add (i32.add (local.get $cl) (i32.const 4)) (i32.shl (local.get $j) (i32.const 4))))
            (local.set $d (f32.add
              (f32.add (f32.mul (f32.load (local.get $c)) (local.get $x)) (f32.mul (f32.load offset=4 (local.get $c)) (local.get $y)))
              (f32.add (f32.mul (f32.load offset=8 (local.get $c)) (local.get $z)) (f32.mul (f32.load offset=12 (local.get $c)) (local.get $w)))))
            (if (f32.lt (local.get $d) (f32.const 0)) (then
              (local.set $code (i32.or (local.get $code) (i32.shl (i32.const 8) (local.get $j))))))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $planes (i32.lt_u (local.get $j) (i32.const 6))))
        (i32.store (i32.add (local.get $src) (i32.mul (i32.add (local.get $i) (local.get $lane)) (local.get $istride))) (local.get $code))
        (local.set $o (i32.add (local.get $out) (i32.mul (i32.add (local.get $i) (local.get $lane)) (i32.const 144))))
        ;; As $d3d_software_project: the viewport's pixels, z/w, 1/w.
        (f32.store (local.get $o) (f32.add (f32.convert_i32_u (i32.load (local.get $vp)))
          (f32.mul (f32.mul (f32.add (f32.div (local.get $x) (local.get $w)) (f32.const 1)) (f32.const 0.5))
            (f32.convert_i32_u (i32.sub (i32.load offset=8 (local.get $vp)) (i32.load (local.get $vp)))))))
        (f32.store offset=4 (local.get $o) (f32.add (f32.convert_i32_u (i32.load offset=4 (local.get $vp)))
          (f32.mul (f32.mul (f32.sub (f32.const 1) (f32.div (local.get $y) (local.get $w))) (f32.const 0.5))
            (f32.convert_i32_u (i32.sub (i32.load offset=12 (local.get $vp)) (i32.load offset=4 (local.get $vp)))))))
        (f32.store offset=8 (local.get $o) (f32.div (local.get $z) (local.get $w)))
        (f32.store offset=12 (local.get $o) (f32.div (f32.const 1) (local.get $w)))
        ;; oD0, oD1 (clamped), oT0..5.
        (local.set $j (i32.const 0))
        (loop $outs
          (local.set $c (i32.add (i32.add (local.get $vm)
            (select (i32.add (i32.const 40992) (i32.shl (i32.shr_u (local.get $j) (i32.const 2)) (i32.const 6)))
              (i32.add (i32.const 49184) (i32.shl (i32.shr_u (i32.sub (local.get $j) (i32.const 8)) (i32.const 2)) (i32.const 6)))
              (i32.lt_u (local.get $j) (i32.const 8))))
            (i32.add (i32.shl (i32.and (local.get $j) (i32.const 3)) (i32.const 4)) (i32.shl (local.get $lane) (i32.const 2)))))
          (local.set $d (f32.load (local.get $c)))
          (if (i32.lt_u (local.get $j) (i32.const 8)) (then
            (local.set $d (f32.min (f32.max (local.get $d) (f32.const 0)) (f32.const 1)))))
          (f32.store (i32.add (i32.add (local.get $o) (i32.const 16)) (i32.shl (local.get $j) (i32.const 2))) (local.get $d))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br_if $outs (i32.lt_u (local.get $j) (i32.const 32))))
        (local.set $lane (i32.add (local.get $lane) (i32.const 1)))
        (br_if $store (i32.lt_u (local.get $lane) (i32.const 4)))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br $batches)))
    (i32.const 0))

  ;; Keeps the $np primitives ($vpp vertices) at $out every vertex of which
  ;; is inside, compacted; drops those wholly outside one plane or with a
  ;; non-finite vertex. The kept count, or -1 when one needs clipping.
  (func $d9fv_cull (param $src i32) (param $istride i32) (param $out i32) (param $np i32) (param $vpp i32) (result i32)
    (local $q i32) (local $j i32) (local $c i32) (local $and i32) (local $or i32) (local $kept i32) (local $bytes i32)
    (local.set $bytes (i32.mul (local.get $vpp) (i32.const 144)))
    (block $done (loop $prims
      (br_if $done (i32.ge_u (local.get $q) (local.get $np)))
      (local.set $and (i32.const -1)) (local.set $or (i32.const 0)) (local.set $j (i32.const 0))
      (loop $verts
        (local.set $c (i32.load (i32.add (local.get $src)
          (i32.mul (i32.add (i32.mul (local.get $q) (local.get $vpp)) (local.get $j)) (local.get $istride)))))
        (local.set $and (i32.and (local.get $and) (local.get $c)))
        (local.set $or (i32.or (local.get $or) (local.get $c)))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $verts (i32.lt_u (local.get $j) (local.get $vpp))))
      (if (i32.or (i32.ne (local.get $and) (i32.const 0)) (i32.ne (i32.and (local.get $or) (i32.const 0x40000000)) (i32.const 0)))
        (then (call $d9g_stat (i32.const 125) (i32.const 1)))
        (else
          (if (local.get $or) (then (call $d9g_stat (i32.const 124) (i32.const 1)) (return (i32.const -1))))
          (if (i32.ne (local.get $kept) (local.get $q)) (then
            (memory.copy (i32.add (local.get $out) (i32.mul (local.get $kept) (local.get $bytes)))
              (i32.add (local.get $out) (i32.mul (local.get $q) (local.get $bytes))) (local.get $bytes))))
          (local.set $kept (i32.add (local.get $kept) (i32.const 1)))))
      (local.set $q (i32.add (local.get $q) (i32.const 1)))
      (br $prims)))
    (local.get $kept))

  (func $d9fv_end
    (call $d3d_shader_vm_free (global.get $d9fv_ctx))
    (global.set $d9fv_ctx (i32.const 0))
    (global.set $d9fv_on (i32.const 0)))
  ;; ---- end d9fv ----------------------------------------------------------------

  ;; ---- draws -----------------------------------------------------------------
  (func $d9g_vcount (param $prim i32) (param $n i32) (result i32)
    (if (i32.eq (local.get $prim) (i32.const 1)) (then (return (local.get $n))))
    (if (i32.eq (local.get $prim) (i32.const 2)) (then (return (i32.shl (local.get $n) (i32.const 1)))))
    (if (i32.eq (local.get $prim) (i32.const 3)) (then (return (i32.add (local.get $n) (i32.const 1)))))
    (if (i32.eq (local.get $prim) (i32.const 4)) (then (return (i32.mul (local.get $n) (i32.const 3)))))
    (i32.add (local.get $n) (i32.const 2)))

  ;; FVF vertex bytes (POSITIONT only reaches here).
  ;; A D3D9 declaration that is exactly an FVF layout -> that FVF, else 0:
  ;; stream 0, method DEFAULT, POSITION FLOAT3 or POSITIONT FLOAT4,
  ;; optional NORMAL FLOAT3, COLOR0 / COLOR1 D3DCOLOR, TEXCOORD0..n-1
  ;; FLOAT1..4, each once and at the offset the FVF would give it. Fixed
  ;; T&L then runs it as that FVF (registers and layout as for the FVF).
  (func $d9g_decl_fvf (param $decl i32) (result i32)
    (local $dw i32) (local $n i32) (local $i i32) (local $el i32) (local $type i32) (local $usage i32)
    (local $idx i32) (local $fvf i32) (local $seen i32) (local $bit i32) (local $t i32) (local $base i32) (local $o i32)
    (local.set $dw (call $g2w (local.get $decl)))
    (if (i32.eq (i32.load offset=12 (local.get $dw)) (i32.const 0xd3d80002)) (then (return (i32.const 0))))
    (local.set $n (i32.sub (i32.shr_u (i32.load offset=16 (local.get $dw)) (i32.const 3)) (i32.const 1)))
    (if (i32.or (i32.lt_s (local.get $n) (i32.const 1)) (i32.gt_u (local.get $n) (i32.const 16))) (then (return (i32.const 0))))
    (block $bad
      (block $done1 (loop $els1
        (br_if $done1 (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
        (br_if $bad (i32.or (i32.load16_u (local.get $el)) (i32.load8_u offset=5 (local.get $el))))
        (local.set $type (i32.load8_u offset=4 (local.get $el)))
        (local.set $usage (i32.load8_u offset=6 (local.get $el)))
        (local.set $idx (i32.load8_u offset=7 (local.get $el)))
        (local.set $bit (i32.const 0))
        (if (i32.and (i32.eqz (local.get $usage)) (i32.eqz (local.get $idx))) (then
          (br_if $bad (i32.ne (local.get $type) (i32.const 2)))
          (local.set $bit (i32.const 1)) (local.set $fvf (i32.or (local.get $fvf) (i32.const 2)))))
        (if (i32.and (i32.eq (local.get $usage) (i32.const 9)) (i32.eqz (local.get $idx))) (then
          (br_if $bad (i32.ne (local.get $type) (i32.const 3)))
          (local.set $bit (i32.const 1)) (local.set $fvf (i32.or (local.get $fvf) (i32.const 4)))))
        (if (i32.and (i32.eq (local.get $usage) (i32.const 3)) (i32.eqz (local.get $idx))) (then
          (br_if $bad (i32.ne (local.get $type) (i32.const 2)))
          (local.set $bit (i32.const 2)) (local.set $fvf (i32.or (local.get $fvf) (i32.const 16)))))
        (if (i32.and (i32.eq (local.get $usage) (i32.const 10)) (i32.lt_u (local.get $idx) (i32.const 2))) (then
          (br_if $bad (i32.ne (local.get $type) (i32.const 4)))
          (local.set $bit (i32.shl (i32.const 4) (local.get $idx)))
          (local.set $fvf (i32.or (local.get $fvf) (i32.shl (i32.const 64) (local.get $idx))))))
        (if (i32.and (i32.eq (local.get $usage) (i32.const 5)) (i32.lt_u (local.get $idx) (i32.const 8))) (then
          (br_if $bad (i32.gt_u (local.get $type) (i32.const 3)))
          (local.set $bit (i32.shl (i32.const 16) (local.get $idx)))
          (local.set $fvf (i32.or (local.get $fvf) (i32.shl (i32.and (i32.add (local.get $type) (i32.const 3)) (i32.const 3))
            (i32.add (i32.const 16) (i32.shl (local.get $idx) (i32.const 1))))))))
        (br_if $bad (i32.eqz (local.get $bit)))
        (br_if $bad (i32.and (local.get $seen) (local.get $bit)))
        (local.set $seen (i32.or (local.get $seen) (local.get $bit)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $els1)))
      (br_if $bad (i32.eqz (i32.and (local.get $seen) (i32.const 1))))
      ;; TEXCOORD0..n-1 with no gap.
      (local.set $t (i32.shr_u (local.get $seen) (i32.const 4)))
      (br_if $bad (i32.and (local.get $t) (i32.add (local.get $t) (i32.const 1))))
      (local.set $fvf (i32.or (local.get $fvf) (i32.shl (i32.popcnt (local.get $t)) (i32.const 8))))
      (local.set $base (select (i32.const 16) (i32.const 12) (i32.ne (i32.and (local.get $fvf) (i32.const 4)) (i32.const 0))))
      (local.set $i (i32.const 0))
      (block $done2 (loop $els2
        (br_if $done2 (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $el (i32.add (i32.add (local.get $dw) (i32.const 24)) (i32.shl (local.get $i) (i32.const 3))))
        (local.set $usage (i32.load8_u offset=6 (local.get $el)))
        (local.set $idx (i32.load8_u offset=7 (local.get $el)))
        (local.set $o (i32.const 0))
        (if (i32.eq (local.get $usage) (i32.const 3)) (then (local.set $o (local.get $base))))
        (if (i32.eq (local.get $usage) (i32.const 10)) (then
          (local.set $o (i32.add (local.get $base) (select (i32.const 12) (i32.const 0) (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0)))))
          (if (local.get $idx) (then
            (local.set $o (i32.add (local.get $o) (select (i32.const 4) (i32.const 0) (i32.ne (i32.and (local.get $fvf) (i32.const 64)) (i32.const 0)))))))))
        (if (i32.eq (local.get $usage) (i32.const 5)) (then
          (local.set $o (i32.add (i32.sub (call $d9g_tc_off (local.get $fvf) (local.get $idx)) (i32.const 16)) (local.get $base)))))
        (br_if $bad (i32.ne (i32.load16_u offset=2 (local.get $el)) (local.get $o)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $els2)))
      (return (local.get $fvf)))
    (i32.const 0))

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
    (local $gather i32) ;; d9ms
    (local $xflat i32) (local $xpad i32) (local $xbig i32) (local $expand i32) ;; d9cpu
    (local $tt i32) (local $xproj i32) (local $pjoff i32) (local $pjn i32) ;; d9pj
    (local $xfv i32) ;; d9fv
    (local.set $vs (i32.load (global.get $d9g_pw)))
    (local.set $decl (i32.load offset=8 (global.get $d9g_pw)))
    (local.set $fvf (i32.load offset=12 (global.get $d9g_pw)))
    ;; ---- d9ms: an input the executor cannot read in place is gathered;
    ;; the selection below then sees the FVF the gather stands for (XYZ,
    ;; or XYZRHW for POSITIONT) and no declaration under fixed function.
    (local.set $gather (call $d9ms_select (local.get $vs) (local.get $decl) (local.get $fvf) (local.get $kind) (local.get $desc)))
    (if (i32.lt_s (local.get $gather) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $gather)))))
    (if (local.get $gather) (then
      (local.set $fvf (global.get $d9ms_fvf))
      (if (i32.eqz (local.get $vs)) (then (local.set $decl (i32.const 0))))))
    ;; ---- end d9ms
    (if (local.get $vs)
      (then
        (local.set $vsmode (i32.const 1))
        (if (i32.eqz (local.get $decl)) (then
          (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 2)) (then (return (i32.const 27))))))
        (if (local.get $decl) (then
          (local.set $d3d8 (i32.eq (i32.load offset=12 (call $g2w (local.get $decl))) (i32.const 0xd3d80002))))))
      (else
        ;; A declaration that is an FVF layout runs as that FVF (else 2).
        (if (local.get $decl) (then
          (local.set $fvf (call $d9g_decl_fvf (local.get $decl)))
          (if (i32.eqz (local.get $fvf)) (then (return (i32.const 2))))
          (local.set $decl (i32.const 0))))
        (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 4)) (then
          (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x400e)) (i32.const 2)) (then (return (i32.const 27))))
          (local.set $vsmode (i32.const 2))))))
    (if (local.get $vsmode) (then
      ;; d9cl: user clip planes staged here, emitted with the viewport.
      (local.set $r (call $d9cl_prep (local.get $vsmode)))
      (if (local.get $r) (then (return (local.get $r))))
      (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
        ;; d9ms: blending lowers ($d9ms_blend); a blend nothing planned is 27.
        (if (i32.and (call $d9ms_blend_rs) (i32.eqz (global.get $d9ms_blend))) (then (return (i32.const 27))))))))
    (local.set $prim (i32.load offset=24 (local.get $desc)))
    (local.set $count (i32.load offset=28 (local.get $desc)))
    (if (i32.or (i32.eqz (local.get $prim)) (i32.gt_u (local.get $prim) (i32.const 6))) (then (return (i32.const 26))))
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    ;; d9cpu: an indexed blend past the constant palette blends on the CPU.
    (local.set $r (call $d9cpu_pick (local.get $desc) (local.get $kind) (call $d9g_vcount (local.get $prim) (local.get $count))))
    (if (local.get $r) (then (return (local.get $r))))
    (local.set $r (call $d9g_bind (local.get $device) (local.get $desc)))
    (if (local.get $r) (then (return (local.get $r))))
    ;; d9rt lead0: the bind may have just taken the DIB as a held upload.
    (call $d9g_flush)
    (if (i32.eqz (global.get $d9r_tgt)) (then (global.set $d9g_cpu (i32.const 0))))
    (if (i32.ne (call $d9g_rs (i32.const 8)) (i32.const 3)) (then (return (i32.const 15))))
    ;; d9cpu: flat shading expands when the colours are vertex data.
    ;; d9fv: colours a vertex stage computes: that stage runs on the CPU.
    ;; Points have no flat colour to give.
    (if (i32.and (i32.eq (call $d9g_rs (i32.const 9)) (i32.const 1)) (i32.ne (local.get $prim) (i32.const 1))) (then
      (local.set $xflat (i32.const 1))
      (if (i32.or (i32.eq (local.get $vsmode) (i32.const 1))
            (i32.and (i32.eq (local.get $vsmode) (i32.const 2)) (i32.ne (call $d9g_rs (i32.const 137)) (i32.const 0))))
        (then
          (local.set $xfv (i32.const 1))
          (if (call $d9g_rs (i32.const 28)) (then (call $d9g_stat (i32.const 121) (i32.const 1)) (return (i32.const 16))))))))
    (if (i32.or (call $d9g_rs (i32.const 156)) (call $d9g_rs (i32.const 194))) (then (return (i32.const 22))))
    (local.set $i (i32.const 128))
    (loop $wraps
      (if (call $d9g_rs (local.get $i)) (then (return (i32.const 22))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $wraps (i32.lt_u (local.get $i) (i32.const 136))))
    ;; d9wb: D3DZB_USEW is depth_mode 3 (w / w_far) behind GPS_CAP_WBUFFER.
    (global.set $d9wb_far (f32.const 0))
    (if (i32.and (i32.eq (call $d9g_rs (i32.const 7)) (i32.const 2)) (i32.ne (global.get $d9g_ds_ptr) (i32.const 0))) (then
      (local.set $r (call $d9wb_prep))
      (if (local.get $r) (then (return (local.get $r))))))
    (local.set $depth (i32.and (i32.lt_u (i32.sub (call $d9g_rs (i32.const 7)) (i32.const 1)) (i32.const 2))
      (i32.ne (global.get $d9g_ds_ptr) (i32.const 0))))
    (if (i32.and (local.get $depth) (i32.ne (global.get $d9g_ds_bad) (i32.const 0))) (then (return (i32.const 19))))
    (local.set $stencil (i32.and (i32.ne (call $d9g_rs (i32.const 52)) (i32.const 0)) (i32.ne (global.get $d9g_ds) (i32.const 0))))
    (if (i32.and (local.get $stencil) (i32.eqz (global.get $d9g_ds_d24))) (then (return (i32.const 18))))
    (local.set $fog (i32.ne (call $d9g_rs (i32.const 28)) (i32.const 0)))
    (if (i32.and (local.get $fog) (i32.ne (call $d9g_rs (i32.const 35)) (i32.const 0))) (then (return (i32.const 11))))
    ;; Pixel stage: the guest's shader, or the fixed cascade.
    (local.set $guest_ps (i32.load offset=4 (global.get $d9g_pw)))
    (local.set $active (if (result i32) (local.get $guest_ps) (then (i32.const 6)) (else (call $d9g_active_stages))))
    (local.set $ntex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (local.set $texmap (i32.const 0xffffff))
    (global.set $d9cl_proj (i32.const 0)) ;; d9cl
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
        ;; POSITIONT: no texture transform or texgen. Fixed T&L: COUNT2..4
        ;; transforms (PROJECTED with COUNT3/4 too: $d9cl_tt) and generators
        ;; 1..3, a normal one only with NORMAL.
        (if (i32.eqz (local.get $vsmode)) (then
          ;; d9pj: PROJECTED is a per-pixel divide (D3D applies no matrix
          ;; to POSITIONT); plain transform flags still decline.
          (if (call $d9g_tss (local.get $i) (i32.const 96)) (then
            (if (i32.eqz (i32.and (call $d9g_tss (local.get $i) (i32.const 96)) (i32.const 256))) (then (return (i32.const 12))))
            (local.set $tt (call $d9cl_tt (local.get $i) (local.get $guest_ps)))
            (if (i32.or (i32.gt_u (local.get $tt) (i32.const 4)) (i32.eq (local.get $tt) (i32.const 1))) (then (return (i32.const 12))))
            (if (call $d9pj_c2 (local.get $i)) (then
              (if (i32.or (local.get $xproj) (i32.ge_u (i32.and (local.get $set) (i32.const 0xffff)) (local.get $ntex)))
                (then (return (i32.const 12))))
              (local.set $xproj (i32.add (local.get $i) (i32.const 1)))
              (local.set $pjoff (call $d9g_tc_off (local.get $fvf) (local.get $set)))
              (local.set $pjn (call $d9g_tc_size (local.get $fvf) (local.get $set)))))
            ;; The set must exist and hold the divisor.
            (if (i32.and (i32.ne (local.get $tt) (i32.and (call $d9g_tss (local.get $i) (i32.const 96)) (i32.const 0x1ff)))
                  (i32.or (i32.ge_u (i32.and (local.get $set) (i32.const 0xffff)) (local.get $ntex))
                    (i32.lt_u (call $d9g_tc_size (local.get $fvf) (i32.and (local.get $set) (i32.const 0xffff)))
                      (i32.and (call $d9g_tss (local.get $i) (i32.const 96)) (i32.const 7)))))
              (then (return (i32.const 12))))))
          (if (i32.shr_u (local.get $set) (i32.const 16)) (then (return (i32.const 12))))))
        (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
          ;; d9cl: PROJECTED | COUNT3/4 reads as COUNT3/4 ($d9cl_tt).
          (if (i32.gt_u (call $d9cl_tt (local.get $i) (local.get $guest_ps)) (i32.const 4)) (then (return (i32.const 12))))
          (if (i32.eq (call $d9cl_tt (local.get $i) (local.get $guest_ps)) (i32.const 1)) (then (return (i32.const 12))))
          (if (i32.gt_u (i32.shr_u (local.get $set) (i32.const 16)) (i32.const 3)) (then (return (i32.const 12))))
          (if (i32.and (i32.eqz (i32.and (local.get $fvf) (i32.const 16)))
                (i32.and (i32.shr_u (local.get $set) (i32.const 16)) (i32.const 1)))
            (then (return (i32.const 12))))))
        ;; Fixed pixel stages behind a programmable VS read t_i.
        (if (i32.and (i32.eq (local.get $vsmode) (i32.const 1)) (i32.eqz (local.get $guest_ps)))
          (then (if (i32.ne (local.get $set) (local.get $i)) (then (return (i32.const 12))))))
        (if (i32.eqz (local.get $vsmode)) (then
          ;; d9cpu: a set the FVF lacks reads the appended default (14).
          (if (i32.ge_u (local.get $set) (local.get $ntex)) (then
            (local.set $set (i32.const 14))
            (local.set $xpad (i32.const 1))))
          ;; d9pj: a COUNT2 projected stage reads the appended lane (13).
          (if (i32.eq (local.get $xproj) (i32.add (local.get $i) (i32.const 1))) (then (local.set $set (i32.const 13))))
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
        ;; d9fv: a VS run on the CPU needs its program: re-emit it once.
        (if (i32.and (local.get $xfv) (i32.gt_s (local.get $vs) (i32.const 0))) (then
          (if (i32.eqz (call $d9fv_find (local.get $vs))) (then
            (global.set $d9fv_force (i32.const 1))
            (local.set $vs (call $d9g_fixed_tl (local.get $active) (local.get $fvf) (local.get $guest_ps)))
            (global.set $d9fv_force (i32.const 0))))))
        (if (i32.lt_s (local.get $vs) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $vs)))))
        (local.set $ps (if (result i32) (local.get $guest_ps)
          (then (call $d9g_guest_ps (local.get $guest_ps))) (else (global.get $d9g_tl_ps)))))
      (else
        (if (local.get $guest_ps)
          (then (local.set $ps (call $d9g_guest_ps (local.get $guest_ps))))
          (else (local.set $ps (call $d9g_fixed_ps (local.get $active)))))))
    (if (i32.lt_s (local.get $ps) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $ps)))))
    ;; Vertex source.
    ;; ---- d9ms: a gathered input has its own canonical stride.
    (if (local.get $gather) (then (local.set $stride (global.get $d9ms_stride))) (else
    ;; ---- end d9ms
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
      (then (return (i32.const 3))))))
    ;; Vertex stage objects (the declaration's layout first: a D3D8 one also
    ;; declares the shader's inputs).
    (if (i32.eq (local.get $vsmode) (i32.const 1)) (then
      (local.set $layout (if (result i32) (local.get $gather) (then (call $d9ms_layout)) (else ;; d9ms
        (if (result i32) (local.get $decl)
        (then (call $d9g_layout_decl (local.get $decl) (local.get $stride)))
        (else (call $d9g_layout_fvf (local.get $fvf) (local.get $stride)))))))
      (if (i32.lt_s (local.get $layout) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $layout)))))
      (local.set $r (call $d9g_guest_vs (local.get $vs) (select (local.get $decl) (i32.const 0) (local.get $d3d8))))
      ;; d9fv: a VS run on the CPU needs its program: re-emit it once.
      (if (i32.and (local.get $xfv) (i32.gt_s (local.get $r) (i32.const 0))) (then
        (if (i32.eqz (call $d9fv_find (local.get $r))) (then
          (global.set $d9fv_force (i32.const 1))
          (local.set $r (call $d9g_guest_vs (local.get $vs) (select (local.get $decl) (i32.const 0) (local.get $d3d8))))
          (global.set $d9fv_force (i32.const 0))))))
      (local.set $vs (local.get $r))
      (if (i32.lt_s (local.get $vs) (i32.const 0)) (then (return (i32.sub (i32.const 0) (local.get $vs)))))))
    (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
      (local.set $layout (if (result i32) (local.get $gather) (then (call $d9ms_layout)) ;; d9ms
        (else (call $d9g_layout_fvf (local.get $fvf) (local.get $stride)))))))
    (if (local.get $xfv) (then ;; d9fv
      (local.set $r (call $d9fv_prep (local.get $vs) (local.get $layout)))
      (if (local.get $r) (then (return (local.get $r))))))
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
    (if (i32.eqz (local.get $num)) (then (return (i32.const 20))))
    ;; d9cpu: past the arena / index limits the draw is split ($xbig), up to
    ;; 2^24 vertices in the sequence.
    (if (i32.gt_u (local.get $n) (i32.const 0x1000000)) (then (return (i32.const 20))))
    (local.set $xbig (i32.or (i32.gt_u (local.get $num) (i32.const 0x100000)) (i32.gt_u (local.get $ocount) (i32.const 0x80000))))
    ;; DRAW from the buffers: not a fan, base vertex inside the buffer.
    (if (i32.and (i32.and (i32.ge_u (local.get $kind) (i32.const 2)) (i32.ne (local.get $prim) (i32.const 6)))
          (i32.eqz (local.get $gather))) (then ;; d9ms: a gather is a DRAW_UP
      (local.set $voff (i32.sub (local.get $vptr) (i32.add (local.get $vbuf) (i32.const 64))))
      (local.set $direct (i32.and (i32.ge_s (local.get $voff) (i32.const 0)) (i32.eqz (i32.and (local.get $voff) (i32.const 3)))))))
    (if (i32.and (i32.eqz (local.get $direct))
          (i32.gt_u (i32.mul (local.get $num) (local.get $stride)) (i32.const 0x200000)))
      (then (local.set $xbig (i32.const 1)))) ;; d9cpu (was 20)
    (local.set $expand (i32.or (i32.or (i32.or (local.get $xflat) (local.get $xpad)) (local.get $xbig)) (i32.ne (local.get $xproj) (i32.const 0))))
    (if (local.get $expand) (then (local.set $direct (i32.const 0))))
    (local.set $depth (select (global.get $GPS_DEPTH_Z) (i32.const 0) (local.get $depth)))
    (if (f32.gt (global.get $d9wb_far) (f32.const 0)) (then (local.set $depth (global.get $GPS_DEPTH_WBUFFER)))) ;; d9wb
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
      (else (if (local.get $expand)
      (then
        ;; d9cpu: validate every index now; $d9cpu_expand emits at the end.
        (if (i32.and (local.get $kind) (i32.const 1)) (then
          (local.set $iptr (call $g2w (local.get $iptr)))
          (local.set $k (i32.const 0))
          (block $xdone (loop $xidx
            (br_if $xdone (i32.ge_u (local.get $k) (local.get $n)))
            (local.set $v (if (result i32) (i32.eq (local.get $isize) (i32.const 2))
              (then (i32.load16_u (i32.add (local.get $iptr) (i32.shl (local.get $k) (i32.const 1)))))
              (else (i32.load (i32.add (local.get $iptr) (i32.shl (local.get $k) (i32.const 2)))))))
            (if (i32.ge_u (i32.sub (local.get $v) (local.get $min)) (local.get $num)) (then (return (i32.const 21))))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $xidx)))))
        (if (i32.eqz (local.get $gather)) (then (local.set $vptr (call $g2w (local.get $vptr))))))
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
        (if (local.get $gather)
          (then
            (call $d9ms_gather (call $d9g_aptr (local.get $vpos)) (local.get $min) (local.get $num)) ;; d9ms
            (if (global.get $d9cpu_blend) (then (call $d9cpu_run (call $d9g_aptr (local.get $vpos)) (local.get $num))))) ;; d9cpu
          (else
        (memory.copy (call $d9g_aptr (local.get $vpos))
          (i32.add (call $g2w (local.get $vptr)) (i32.mul (local.get $min) (local.get $stride)))
          (i32.mul (local.get $num) (local.get $stride))))))))) ;; d9cpu: + (else (if $expand ...))
    (if (local.get $guest_ps) (then (call $d9g_ps_consts)))
    (if (i32.eq (local.get $vsmode) (i32.const 1)) (then
      (call $d9g_vs_consts (i32.add (global.get $d9g_pw) (i32.const 16)) (i32.const 0) (i32.const 96))
      (call $d9g_vs_consts (i32.add (global.get $d9g_pw) (i32.const 22684)) (i32.const 96) (i32.const 160))))
    (if (i32.eq (local.get $vsmode) (i32.const 2)) (then
      (call $d9g_vs_consts (i32.add (call $d9g_m) (i32.const 77840)) (i32.const 0) (i32.const 12))
      (if (global.get $d9g_tl_lit) (then
        (call $d9g_vs_consts (i32.add (call $d9g_m) (i32.const 104928)) (i32.const 40) (i32.const 56)))
      (else (if (global.get $d9g_tl_nrm) (then
        (call $d9g_vs_consts (i32.add (call $d9g_m) (i32.const 104928)) (i32.const 40) (i32.const 4))))))
      (if (global.get $d9g_tl_tex) (then
        (call $d9g_vs_consts (i32.add (call $d9g_m) (i32.const 111616)) (i32.const 16) (i32.const 24))))
      (if (global.get $d9ms_blend) (then ;; d9ms
        (call $d9g_vs_consts (i32.add (call $d9ms_m) (i32.const 1536)) (i32.const 96) (global.get $d9ms_bcount))))))
    (call $d9g_bind_tex (local.get $nb))
    (call $d9g_viewport)
    (if (local.get $vsmode) (then (call $d9cl_emit))) ;; d9cl
    (if (i32.eqz (local.get $vsmode)) (then
      (local.set $layout (call $d9g_layout (local.get $fvf)
        (i32.add (i32.add (local.get $stride) (i32.shl (local.get $xpad) (i32.const 3)))
          (select (i32.const 16) (i32.const 0) (i32.ne (local.get $xproj) (i32.const 0)))) (local.get $texmap)))))
    (if (local.get $expand) (then ;; d9cpu
      (global.set $d9fv_on (local.get $xfv)) ;; d9fv
      (local.set $r (call $d9cpu_expand (local.get $prim) (local.get $count)
        (select (local.get $iptr) (i32.const 0) (i32.and (local.get $kind) (i32.const 1))) (local.get $isize)
        (local.get $min) (local.get $vptr) (local.get $stride) (local.get $gather) (local.get $xpad)
        (local.get $xflat) (local.get $fvf) (local.get $vsmode) (local.get $vs) (local.get $ps) (local.get $layout)
        (select (i32.add (local.get $pjoff) (i32.const 1)) (i32.const 0) (i32.ne (local.get $xproj) (i32.const 0))) (local.get $pjn)))
      (call $d9fv_end) ;; d9fv
      (if (local.get $r) (then (return (local.get $r))))
      (if (local.get $xfv) (then (call $d9g_stat (i32.const 120) (i32.const 1))))
      (call $d9g_stat (i32.const 1) (local.get $count))
      (return (i32.const 0))))
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

  ;; Shared entry: the ring is up and the call's state is readable. Sets the
  ;; state pointers. A device with no ring or no program state cannot have
  ;; been created (CreateDevice checks $d3d9_executor_ok): trap.
  (func $d9g_ready (param $desc i32)
    (if (i32.eqz (local.get $desc)) (then (call $d9g_fail (i32.const 11))))
    (if (i32.eqz (call $d9g_open)) (then (call $d9g_fail (i32.const 10))))
    (call $d9g_enter (local.get $desc)))

  ;; Draw call site (every Draw* entry point; $kind as $d9g_draw_try).
  ;; 1 = drawn; anything not lowerable traps ($d9g_decline).
  (func $d9g_draw_call (param $device i32) (param $kind i32) (result i32)
    (local $desc i32) (local $r i32)
    (call $d9g_flush)
    (local.set $desc (call $d9g_desc (local.get $device)))
    (call $d9g_ready (local.get $desc))
    (if (i32.eqz (i32.load offset=22020 (global.get $d9g_pw))) (then (global.set $d9g_cpu (i32.const 0))))
    (local.set $r (call $d9g_draw_try (local.get $device) (local.get $desc) (local.get $kind)))
    (if (local.get $r) (then (call $d9g_decline (local.get $r))))
    (i32.const 1))

  ;; Clear call site. Viewport (and scissor) clip every rect.
  (func $d9g_clear_call (param $device i32) (result i32)
    (local $desc i32) (local $r i32)
    (call $d9g_flush)
    (local.set $desc (call $d9g_desc (local.get $device)))
    (call $d9g_ready (local.get $desc))
    (local.set $r (call $d9g_clear_lower (local.get $device) (local.get $desc)))
    (if (local.get $r) (then (call $d9g_decline (local.get $r))))
    (i32.const 1))

  ;; Clear records for the call in $desc. 0 = lowered, else decline reason.
  (func $d9g_clear_lower (param $device i32) (param $desc i32) (result i32)
    (local $r i32) (local $flags i32) (local $m i32) (local $clip i32) (local $rc i32)
    (local $count i32) (local $rects i32) (local $i i32) (local $p i32) (local $full i32) (local $rgba i32)
    (local $z f32)
    (local.set $r (call $d9g_bind (local.get $device) (local.get $desc)))
    (if (local.get $r) (then (return (local.get $r))))
    (local.set $flags (i32.and (i32.load offset=44 (local.get $desc)) (i32.const 7)))
    ;; d9rt lead0: a held upload (the bind's DIB) survives only a clear that
    ;; replaces every pixel: whole-target viewport, no scissor, no rects.
    (if (i32.eq (global.get $d9g_cpu) (i32.const 2)) (then
      (local.set $m (call $d9g_m))
      (call $d9g_vp_rect (i32.add (local.get $m) (i32.const 1008)))
      (call $d9g_scissor_clip (i32.add (local.get $m) (i32.const 1008)))
      (if (i32.eqz (i32.and (i32.and (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
                (i32.eqz (global.get $d9r_tgt)))
              (i32.or (i32.eqz (i32.load offset=56 (local.get $desc))) (i32.eqz (i32.load offset=60 (local.get $desc)))))
            (i32.and (i32.and (i32.eqz (i32.load offset=1008 (local.get $m))) (i32.eqz (i32.load offset=1012 (local.get $m))))
              (i32.and (i32.eq (i32.load offset=1016 (local.get $m)) (global.get $d9g_tw))
                (i32.eq (i32.load offset=1020 (local.get $m)) (global.get $d9g_th))))))
        (then (call $d9g_flush)))))
    (if (i32.and (i32.and (local.get $flags) (i32.const 1)) (i32.eqz (global.get $d9r_tgt)))
      (then (global.set $d9g_cpu (i32.const 0))))
    (if (i32.or (i32.eqz (global.get $d9g_ds)) (global.get $d9g_ds_bad))
      (then (local.set $flags (i32.and (local.get $flags) (i32.const 1)))))
    (if (i32.eqz (global.get $d9g_ds_d24)) (then (local.set $flags (i32.and (local.get $flags) (i32.const 3)))))
    (if (i32.eqz (local.get $flags)) (then (return (i32.const 0))))
    (local.set $m (call $d9g_m))
    (local.set $clip (i32.add (local.get $m) (i32.const 1008)))
    (call $d9g_vp_rect (local.get $clip))
    (call $d9g_scissor_clip (local.get $clip))
    (local.set $rgba (call $d9g_rgba (i32.load offset=48 (local.get $desc))))
    (if (i32.eqz (call $d9g_has_alpha (global.get $d9g_tfmt)))
      (then (local.set $rgba (i32.or (local.get $rgba) (i32.const 0xff000000)))))
    (local.set $z (f32.min (f32.const 1) (f32.max (f32.const 0) (f32.reinterpret_i32 (i32.load offset=52 (local.get $desc))))))
    (local.set $count (i32.load offset=56 (local.get $desc)))
    (local.set $rects (i32.load offset=60 (local.get $desc)))
    (if (i32.or (i32.eqz (local.get $rects)) (i32.eqz (local.get $count))) (then (local.set $count (i32.const 0))))
    ;; d9cpu: each rect is its own CLEAR record already, so a long list is
    ;; just more records (was 20 past 256).
    (if (i32.gt_u (local.get $count) (i32.const 0x10000)) (then (return (i32.const 20))))
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
                (i32.and (i32.eq (i32.load offset=8 (local.get $p)) (global.get $d9g_tw))
                  (i32.eq (i32.load offset=12 (local.get $p)) (global.get $d9g_th))))
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
      ;; d9rt: the back buffer's coherence globals; a colour surface's ring
      ;; RT was made fresh when it was bound.
      (if (i32.and (i32.and (local.get $flags) (i32.const 1)) (i32.eqz (global.get $d9r_tgt))) (then
        (global.set $d9g_cpu (i32.const 3))
        (global.set $d9g_cpu_rgba (local.get $rgba))))))
    (i32.const 0))

  ;; The Present stretch target (d9g_mem +2944 {id, w, h}) goes with the
  ;; back buffer RT it is copied from.
  (func $d9g_drop_present_target
    (local $m i32)
    (local.set $m (i32.add (call $d9g_m) (i32.const 2944)))
    (call $d9g_release (i32.load (local.get $m)))
    (i32.store (local.get $m) (i32.const 0))
    (i32.store offset=4 (local.get $m) (i32.const 0))
    (i32.store offset=8 (local.get $m) (i32.const 0)))

  ;; An executor RT of $w x $hgt that a stretched Present lands in, kept
  ;; across frames and remade when the destination size changes.
  (func $d9g_present_target (param $w i32) (param $hgt i32) (result i32)
    (local $m i32)
    (local.set $m (i32.add (call $d9g_m) (i32.const 2944)))
    (if (i32.and (i32.ne (i32.load (local.get $m)) (i32.const 0))
          (i32.and (i32.eq (i32.load offset=4 (local.get $m)) (local.get $w))
            (i32.eq (i32.load offset=8 (local.get $m)) (local.get $hgt))))
      (then (return (i32.load (local.get $m)))))
    (call $d9g_drop_present_target)
    (i32.store (local.get $m) (call $d9g_id))
    (i32.store offset=4 (local.get $m) (local.get $w))
    (i32.store offset=8 (local.get $m) (local.get $hgt))
    (call $gps_create (global.get $d9g_h) (i32.load (local.get $m)) (global.get $GPS_KIND_RT)
      (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
    (i32.load (local.get $m)))

  ;; Device / swap-chain Present: a PRESENT of the back buffer RT, made from
  ;; the DIB first if nothing drew yet. 1 = presented.
  ;; $srect / $drect are the guest RECT pointers of Present (0 = NULL). On a
  ;; windowed device, as on Windows: the source rect is clipped to the back
  ;; buffer, a NULL destination is the whole client area of the device
  ;; window, and when the two differ in size the picture is stretched
  ;; (linear, as the runtime's StretchRect-style blit does). GameMaker 8
  ;; keeps a 640x480 back buffer and presents (0,0,960,720) -> (0,0,960,720)
  ;; once Spelunky's settings.cfg scale 3 resizes its window. A fullscreen
  ;; device owns the whole screen at the back buffer's size: no rects.
  (func $d9g_present (param $device i32) (param $srect i32) (param $drect i32) (result i32)
    (local $h i32) (local $p i32) (local $seq i32) (local $hwnd i32) (local $state i32)
    (local $sx i32) (local $sy i32) (local $sw i32) (local $sh i32)
    (local $dx i32) (local $dy i32) (local $dw i32) (local $dh i32)
    (local $rt i32) (local $cs i32) (local $v i32)
    (local.set $state (call $d3d9_program_state (local.get $device)))
    (local.set $hwnd (if (result i32) (local.get $state)
      (then (call $gl32 (i32.add (local.get $state) (i32.const 1684)))) (else (i32.const 0))))
    ;; No window to present to (the old path's own refusal): stat 67.
    (if (i32.eqz (local.get $hwnd)) (then (call $d9g_stat (i32.const 67) (i32.const 1)) (call $d9g_fail (i32.const 12))))
    (if (i32.eqz (call $d9g_bb_ensure (local.get $device))) (then (call $d9g_fail (i32.const 13))))
    (call $d9g_flush)
    ;; Source and destination rects (whole back buffer at 0,0 by default).
    (local.set $sw (global.get $d9g_rt_w))
    (local.set $sh (global.get $d9g_rt_h))
    (local.set $dw (local.get $sw))
    (local.set $dh (local.get $sh))
    (if (i32.and (i32.ne (call $d3d9_windowed_hwnd_get) (i32.const 0))
          (i32.eq (call $d3d9_windowed_hwnd_get) (local.get $hwnd)))
      (then
        (if (local.get $srect) (then
          (local.set $sx (call $gl32 (local.get $srect)))
          (local.set $sy (call $gl32 (i32.add (local.get $srect) (i32.const 4))))
          (local.set $sw (call $gl32 (i32.add (local.get $srect) (i32.const 8))))
          (local.set $sh (call $gl32 (i32.add (local.get $srect) (i32.const 12))))
          (if (i32.lt_s (local.get $sx) (i32.const 0)) (then (local.set $sx (i32.const 0))))
          (if (i32.lt_s (local.get $sy) (i32.const 0)) (then (local.set $sy (i32.const 0))))
          (if (i32.gt_s (local.get $sw) (global.get $d9g_rt_w)) (then (local.set $sw (global.get $d9g_rt_w))))
          (if (i32.gt_s (local.get $sh) (global.get $d9g_rt_h)) (then (local.set $sh (global.get $d9g_rt_h))))
          ;; right/bottom -> width/height
          (local.set $sw (i32.sub (local.get $sw) (local.get $sx)))
          (local.set $sh (i32.sub (local.get $sh) (local.get $sy)))))
        (if (local.get $drect)
          (then
            (local.set $dx (call $gl32 (local.get $drect)))
            (local.set $dy (call $gl32 (i32.add (local.get $drect) (i32.const 4))))
            (local.set $dw (i32.sub (call $gl32 (i32.add (local.get $drect) (i32.const 8))) (local.get $dx)))
            (local.set $dh (i32.sub (call $gl32 (i32.add (local.get $drect) (i32.const 12))) (local.get $dy))))
          (else
            (local.set $cs (call $host_get_window_client_size (local.get $hwnd)))
            (local.set $dw (i32.and (local.get $cs) (i32.const 0xFFFF)))
            (local.set $dh (i32.shr_u (local.get $cs) (i32.const 16)))
            ;; A window with no client area yet shows the source as it is.
            (if (i32.or (i32.eqz (local.get $dw)) (i32.eqz (local.get $dh))) (then
              (local.set $dw (local.get $sw))
              (local.set $dh (local.get $sh))))))))
    ;; An empty source or destination shows nothing (D3D presents no pixels).
    (if (i32.or (i32.or (i32.le_s (local.get $sw) (i32.const 0)) (i32.le_s (local.get $sh) (i32.const 0)))
          (i32.or (i32.le_s (local.get $dw) (i32.const 0)) (i32.le_s (local.get $dh) (i32.const 0))))
      (then (return (i32.const 0))))
    (local.set $rt (global.get $d9g_rt))
    (if (i32.or (i32.ne (local.get $sw) (local.get $dw)) (i32.ne (local.get $sh) (local.get $dh))) (then
      (if (i32.and (i32.ne (i32.and (global.get $d9g_caps) (global.get $GPS_CAP_COPY)) (i32.const 0))
            (i32.and (i32.le_u (local.get $dw) (i32.const 4096)) (i32.le_u (local.get $dh) (i32.const 4096))))
        (then
          (local.set $v (call $d9g_present_target (local.get $dw) (local.get $dh)))
          (local.set $p (call $d9g_begin (global.get $GPS_OP_COPY) (size-of GpsCopy)))
          (store.field GpsCopy src (local.get $p) (local.get $rt))
          (store.field GpsCopy dst (local.get $p) (local.get $v))
          (store.field GpsCopy sx (local.get $p) (local.get $sx))
          (store.field GpsCopy sy (local.get $p) (local.get $sy))
          (store.field GpsCopy sw (local.get $p) (local.get $sw))
          (store.field GpsCopy sh (local.get $p) (local.get $sh))
          (store.field GpsCopy dx (local.get $p) (i32.const 0))
          (store.field GpsCopy dy (local.get $p) (i32.const 0))
          (store.field GpsCopy dw (local.get $p) (local.get $dw))
          (store.field GpsCopy dh (local.get $p) (local.get $dh))
          ;; Linear; the window shows no alpha.
          (store.field GpsCopy filter (local.get $p) (i32.const 0x1000002))
          (drop (call $d9g_end (local.get $p)))
          (call $d9g_stat (i32.const 88) (i32.const 1))
          (local.set $rt (local.get $v))
          (local.set $sx (i32.const 0))
          (local.set $sy (i32.const 0))
          (local.set $sw (local.get $dw))
          (local.set $sh (local.get $dh)))
        (else (call $d9g_stat (i32.const 89) (i32.const 1))))))
    (local.set $h (global.get $d9g_h))
    ;; At most two PRESENTs in flight.
    (if (i32.and (i32.ne (global.get $d9g_pseq0) (i32.const 0))
          (i32.lt_s (i32.sub (i32.atomic.load (i32.add (local.get $h) (offset-of GpsRing done_seq))) (global.get $d9g_pseq0)) (i32.const 0)))
      (then
        (call $d9g_stat (i32.const 11) (i32.const 1))
        (if (i32.ne (call $d9g_kick (global.get $GPS_KICK_SYNC)) (i32.const 1)) (then (call $d9g_fail (i32.const 4))))))
    (call $gps_mark (local.get $h) (global.get $d9g_frame) (i32.const 0x44394650))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_PRESENT) (size-of GpsPresent)))
    (store.field GpsPresent rt (local.get $p) (local.get $rt))
    (store.field GpsPresent gamma (local.get $p) (i32.const 0))
    (store.field GpsPresent x (local.get $p) (local.get $sx))
    (store.field GpsPresent y (local.get $p) (local.get $sy))
    (store.field GpsPresent w (local.get $p) (local.get $sw))
    (store.field GpsPresent h (local.get $p) (local.get $sh))
    (store.field GpsPresent surface (local.get $p) (local.get $hwnd))
    (store.field GpsPresent dst_x (local.get $p) (local.get $dx))
    (store.field GpsPresent dst_y (local.get $p) (local.get $dy))
    (store.field GpsPresent stamp (local.get $p) (global.get $d9g_frame))
    (local.set $seq (call $d9g_end (local.get $p)))
    (global.set $d9g_pseq0 (global.get $d9g_pseq1))
    (global.set $d9g_pseq1 (local.get $seq))
    ;; GDI touching the window now asks the host for the GPU picture first.
    (local.set $state (call $gdi_window_surface_record (local.get $hwnd) (i32.const 0)))
    (if (local.get $state) (then (i32.atomic.store offset=28 (local.get $state) (i32.const 1))))
    (call $d9g_stat (i32.const 3) (i32.const 1))
    (drop (call $d9g_kick (global.get $GPS_KICK_ASYNC)))
    (call $d9g_stat (i32.const 4) (i32.const 1))
    (global.set $d9g_frame (i32.add (global.get $d9g_frame) (i32.const 1)))
    (i32.const 1))

  ;; ---- readbacks and CPU writes ---------------------------------------------
  ;; Executor RT -> guest pixels at wasm $bits (pitch, D3DFORMAT $fmt).
  (func $d9g_readback (param $bits i32) (param $pitch i32) (param $fmt i32) (param $site i32)
    (call $d9g_rb (global.get $d9g_rt) (i32.const 0) (i32.const 0) (global.get $d9g_rt_w) (global.get $d9g_rt_h)
      (local.get $bits) (local.get $pitch) (local.get $fmt) (local.get $site)))
  ;; d9rt: rect [x, x+w) x [y, y+hgt) of executor RT $id -> guest pixels, the
  ;; rect's top-left at wasm $bits.
  (func $d9g_rb (param $id i32) (param $x i32) (param $y0 i32) (param $w i32) (param $hgt i32)
      (param $bits i32) (param $pitch i32) (param $fmt i32) (param $site i32)
    (local $pix i32)
    (local.set $pix (call $d9g_pix (local.get $fmt)))
    (if (i32.eqz (local.get $pix)) (then (return)))
    (call $d9g_stat (i32.const 11)
      (call $gps_readback_rect (global.get $d9g_h) (local.get $id) (local.get $x) (local.get $y0)
        (local.get $w) (local.get $hgt) (local.get $bits) (local.get $pitch)
        (i32.and (local.get $pix) (i32.const 255)) (i32.shr_u (local.get $pix) (i32.const 8))))
    (call $page_watch_write (local.get $bits) (i32.mul (local.get $hgt) (local.get $pitch)))
    (call $d9g_stat (i32.const 6) (i32.const 1))
    (call $d9g_stat (i32.add (i32.const 48) (local.get $site)) (i32.const 1)))

  ;; Guest pixels -> executor RT rows [x, x+w) x [y, y+h).
  (func $d9g_upload_rect (param $bits i32) (param $pitch i32) (param $fmt i32)
      (param $x i32) (param $y i32) (param $w i32) (param $hgt i32)
    (call $d9g_upload_to (global.get $d9g_rt) (local.get $bits) (local.get $pitch) (local.get $fmt)
      (local.get $x) (local.get $y) (local.get $w) (local.get $hgt)))
  ;; d9rt: the same into executor RT $id ($bits is the surface's pixel 0,0).
  (func $d9g_upload_to (param $id i32) (param $bits i32) (param $pitch i32) (param $fmt i32)
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
      (call $gps_upload (global.get $d9g_h) (local.get $id) (i32.const 0) (i32.const 0) (local.get $x) (i32.add (local.get $y) (local.get $row))
        (local.get $w) (local.get $n) (i32.shl (local.get $w) (i32.const 2))
        (local.get $pos) (i32.mul (i32.shl (local.get $w) (i32.const 2)) (local.get $n)))
      (local.set $row (i32.add (local.get $row) (local.get $n)))
      (br $bands)))
    (call $d9g_stat (i32.const 7) (i32.const 1)))

  ;; The executor RT holds this device's back buffer.
  (func $d9g_coherent (param $device i32) (result i32)
    (i32.and (i32.ne (global.get $d9g_rt) (i32.const 0))
      (i32.and (i32.ne (local.get $device) (i32.const 0)) (i32.eq (global.get $d9g_dev) (local.get $device)))))

  ;; Send the Unlock upload $d9g_cpu 2 has been holding back: the
  ;; executor is about to read or write its RT.
  (func $d9g_flush
    (if (i32.ne (global.get $d9g_cpu) (i32.const 2)) (then (return)))
    (global.set $d9g_cpu (i32.const 0))
    (if (i32.eqz (call $d9g_coherent (global.get $d9g_dev))) (then (return)))
    (call $d9g_upload_rect (global.get $d9g_cpu_bits) (global.get $d9g_cpu_pitch) (global.get $d9g_rt_fmt)
      (global.get $d9g_px0) (global.get $d9g_py0)
      (i32.sub (global.get $d9g_px1) (global.get $d9g_px0)) (i32.sub (global.get $d9g_py1) (global.get $d9g_py0)))
    (global.set $d9g_cpu (i32.const 1)))

  ;; The RT is one solid colour (rgba): write it to the DIB at $bits as the
  ;; readback would have converted it. 0 = not done (row under 4 bytes).
  (func $d9g_fill (param $bits i32) (param $pitch i32) (param $fmt i32) (param $rgba i32) (result i32)
    (local $pix i32) (local $row i32) (local $n i32) (local $c i32) (local $y i32)
    (local.set $pix (call $d9g_pix (local.get $fmt)))
    (local.set $row (i32.mul (global.get $d9g_rt_w) (i32.shr_u (local.get $pix) (i32.const 11))))
    (if (i32.lt_u (local.get $row) (i32.const 4)) (then (return (i32.const 0))))
    (i32.store (local.get $bits) (local.get $rgba))
    (call $d3g_rgba_to_row (local.get $bits) (local.get $bits) (i32.const 1)
      (i32.and (local.get $pix) (i32.const 255)) (i32.shr_u (local.get $pix) (i32.const 8)))
    (local.set $n (i32.shr_u (local.get $pix) (i32.const 11)))
    (block $d (loop $dbl
      (br_if $d (i32.ge_u (local.get $n) (local.get $row)))
      (local.set $c (i32.sub (local.get $row) (local.get $n)))
      (if (i32.gt_u (local.get $c) (local.get $n)) (then (local.set $c (local.get $n))))
      (memory.copy (i32.add (local.get $bits) (local.get $n)) (local.get $bits) (local.get $c))
      (local.set $n (i32.add (local.get $n) (local.get $c)))
      (br $dbl)))
    (local.set $y (i32.const 1))
    (block $e (loop $rows
      (br_if $e (i32.ge_u (local.get $y) (global.get $d9g_rt_h)))
      (memory.copy (i32.add (local.get $bits) (i32.mul (local.get $y) (local.get $pitch))) (local.get $bits) (local.get $row))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows)))
    (call $page_watch_write (local.get $bits) (i32.mul (global.get $d9g_rt_h) (local.get $pitch)))
    (call $d9g_stat (i32.const 77) (i32.const 1))
    (i32.const 1))

  ;; 09am LockRect / GetDC ($upload 0) and UnlockRect / ReleaseDC ($upload
  ;; 1) of the back buffer. Before the ring holds this device's back buffer
  ;; the DIB is the back buffer (the RT, once made, starts from it) and
  ;; nothing moves. After: a Lock lands the RT in the DIB (readback, sites
  ;; 0/1) unless the DIB already holds it ($d9g_cpu); what the CPU wrote goes
  ;; back up before the executor next uses its RT. A DIB-window back buffer
  ;; is not read at the Lock: a lazy entry (09a8gv) reads it back at the
  ;; guest's first translation of it ($d9g_lazy_settle), and an Unlock that
  ;; finds the entry still armed has nothing to upload.
  (func $d9g_bb_sync (param $device i32) (param $upload i32)
    (local $rt i32) (local $state i32) (local $flags i32) (local $bits i32) (local $pitch i32)
    (local $x i32) (local $y i32) (local $w i32) (local $hgt i32) (local $site i32)
    (if (i32.eqz (call $d9g_coherent (local.get $device))) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $device)))
    (local.set $flags (load.field DxObject flags (local.get $rt)))
    (local.set $bits (load.field DxObject misc1 (local.get $rt)))
    (local.set $pitch (load.field DxObject pitch (local.get $rt)))
    ;; The copy is of another DIB: start over.
    (if (i32.and (i32.or (i32.eq (global.get $d9g_cpu) (i32.const 1)) (i32.eq (global.get $d9g_cpu) (i32.const 2)))
          (i32.or (i32.ne (global.get $d9g_cpu_bits) (local.get $bits)) (i32.ne (global.get $d9g_cpu_pitch) (local.get $pitch))))
      (then
        (call $d9g_flush)
        (global.set $d9g_cpu (i32.const 0))))
    (if (local.get $upload)
      (then
        ;; Never translated since the Lock: the guest wrote nothing.
        (if (call $gps_lazy_disarm (global.get $GPS_API_D3D9) (local.get $bits)) (then (return)))
        (local.set $w (global.get $d9g_rt_w))
        (local.set $hgt (global.get $d9g_rt_h))
        (if (i32.and (local.get $flags) (i32.shl (i32.const 1) (i32.const 26)))
          (then
            (local.set $state (call $g2w (call $d3d9_program_state (local.get $device))))
            (local.set $x (i32.load offset=22028 (local.get $state)))
            (local.set $y (i32.load offset=22032 (local.get $state)))
            (local.set $w (i32.load offset=22036 (local.get $state)))
            (local.set $hgt (i32.load offset=22040 (local.get $state)))))
        (if (i32.or (i32.eq (global.get $d9g_cpu) (i32.const 1)) (i32.eq (global.get $d9g_cpu) (i32.const 2)))
          (then
            ;; Hold the upload back; widen one already held.
            (if (i32.eq (global.get $d9g_cpu) (i32.const 2))
              (then
                (call $d9g_stat (i32.const 78) (i32.const 1))
                (if (i32.lt_u (local.get $x) (global.get $d9g_px0)) (then (global.set $d9g_px0 (local.get $x))))
                (if (i32.lt_u (local.get $y) (global.get $d9g_py0)) (then (global.set $d9g_py0 (local.get $y))))
                (if (i32.gt_u (i32.add (local.get $x) (local.get $w)) (global.get $d9g_px1))
                  (then (global.set $d9g_px1 (i32.add (local.get $x) (local.get $w)))))
                (if (i32.gt_u (i32.add (local.get $y) (local.get $hgt)) (global.get $d9g_py1))
                  (then (global.set $d9g_py1 (i32.add (local.get $y) (local.get $hgt))))))
              (else
                (global.set $d9g_px0 (local.get $x)) (global.set $d9g_py0 (local.get $y))
                (global.set $d9g_px1 (i32.add (local.get $x) (local.get $w)))
                (global.set $d9g_py1 (i32.add (local.get $y) (local.get $hgt)))
                (global.set $d9g_cpu (i32.const 2)))))
          (else
            (global.set $d9g_cpu (i32.const 0))
            (call $d9g_upload_rect (local.get $bits) (local.get $pitch) (global.get $d9g_rt_fmt)
              (local.get $x) (local.get $y) (local.get $w) (local.get $hgt)))))
      (else
        (global.set $d9g_cpu_bits (local.get $bits))
        (global.set $d9g_cpu_pitch (local.get $pitch))
        (block $have
          (if (i32.or (i32.eq (global.get $d9g_cpu) (i32.const 1)) (i32.eq (global.get $d9g_cpu) (i32.const 2)))
            (then (call $d9g_stat (i32.const 76) (i32.const 1)) (br $have)))
          (if (i32.eq (global.get $d9g_cpu) (i32.const 3)) (then
            (br_if $have (call $d9g_fill (local.get $bits) (local.get $pitch) (global.get $d9g_rt_fmt) (global.get $d9g_cpu_rgba)))))
          (local.set $site (select (i32.const 0) (i32.const 1)
            (i32.ne (i32.and (local.get $flags) (i32.shl (i32.const 1) (i32.const 29))) (i32.const 0))))
          (if (call $gps_lazy_range_ok (local.get $bits) (i32.mul (global.get $d9g_rt_h) (local.get $pitch))) (then
            (call $gps_lazy_arm (global.get $GPS_API_D3D9) (local.get $bits) (local.get $bits)
              (i32.mul (global.get $d9g_rt_h) (local.get $pitch))
              (global.get $d9g_rt) (global.get $d9g_rt_w) (global.get $d9g_rt_h) (local.get $pitch)
              (global.get $d9g_rt_fmt) (local.get $site))
            (global.set $d9g_cpu (i32.const 0))
            (return)))
          (call $d9g_readback (local.get $bits) (local.get $pitch) (global.get $d9g_rt_fmt) (local.get $site)))
        (if (i32.ne (global.get $d9g_cpu) (i32.const 2)) (then (global.set $d9g_cpu (i32.const 1)))))))

  ;; 09a8gv, with the process-state lock (globals loaded) and the lazy mutex
  ;; held: the guest's first translation of a lazily locked back buffer
  ;; (entry $e: key = bits, +20 RT id, +24 w, +28 h, +32 pitch, +36 format,
  ;; +40 site). $discard: a REP MOVS/STOS overwrites all of it, so nothing is
  ;; read; either way the DIB then holds the newest pixels. An RT or DIB
  ;; changed since the Lock leaves nothing of this one to read.
  (func $d9g_lazy_settle (param $e i32) (param $discard i32)
    (if (i32.or (global.get $d9g_dead) (i32.eqz (global.get $d9g_h))) (then (return)))
    (if (i32.or (i32.ne (global.get $d9g_rt) (i32.load offset=20 (local.get $e)))
          (i32.ne (global.get $d9g_cpu_bits) (i32.load offset=12 (local.get $e)))) (then (return)))
    (if (i32.eqz (local.get $discard)) (then
      (call $d9g_rb (i32.load offset=20 (local.get $e)) (i32.const 0) (i32.const 0)
        (i32.load offset=24 (local.get $e)) (i32.load offset=28 (local.get $e))
        (i32.load offset=12 (local.get $e)) (i32.load offset=32 (local.get $e))
        (i32.load offset=36 (local.get $e)) (i32.load offset=40 (local.get $e)))))
    (global.set $d9g_cpu (i32.const 1)))

  ;; Occlusion bracket (09ae IDirect3DQuery9::Issue). $kind
  ;; $GPS_FENCEK_OCCLUSION_BEGIN opens the executor's sample count and
  ;; returns 0; $GPS_FENCEK_OCCLUSION_END closes it and returns the count,
  ;; waiting for it (completion slot 1, apart from READBACK's slot 0). The
  ;; caller has built the device's descriptor.
  (func $d9g_occlusion (param $device i32) (param $kind i32) (result i32)
    (local $p i32) (local $pos i32) (local $seq i32) (local $h i32)
    (call $d9g_ready (call $d9g_desc (local.get $device)))
    (local.set $h (global.get $d9g_h))
    (call $gps_slot_arm (local.get $h) (i32.const 1))
    (if (i32.eq (local.get $kind) (global.get $GPS_FENCEK_OCCLUSION_END))
      (then (local.set $pos (call $d9g_arena (i32.const 4)))))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_FENCE) (size-of GpsFence)))
    (store.field GpsFence slot (local.get $p) (i32.const 1))
    (store.field GpsFence kind (local.get $p) (local.get $kind))
    (store.field GpsFence pad (local.get $p) (i32.const 0))
    (store.field GpsFence pad2 (local.get $p) (i32.const 0))
    (store.field GpsFence dst (local.get $p) (local.get $pos))
    (local.set $seq (call $d9g_end (local.get $p)))
    (if (i32.ne (local.get $kind) (global.get $GPS_FENCEK_OCCLUSION_END)) (then (return (i32.const 0))))
    (call $gps_slot_wait (local.get $h) (i32.const 1) (local.get $seq))
    (i32.load (call $d9g_aptr (local.get $pos))))

  ;; GetRenderTargetData of the back buffer into the surface $dst (wasm).
  (func $d9g_rtdata (param $device i32) (param $dst i32)
    (if (i32.eqz (call $d9g_bb_ensure (local.get $device))) (then (call $d9g_fail (i32.const 14))))
    (call $d9g_flush)
    (call $d9g_readback (call $g2w (i32.load offset=40 (local.get $dst))) (i32.load offset=48 (local.get $dst))
      (i32.load offset=28 (local.get $dst)) (i32.const 2)))

  ;; Reset succeeded / device released: the executor targets are gone.
  (func $d9g_reset (param $device i32)
    (if (i32.eqz (global.get $d9g_h)) (then (return)))
    (if (i32.ne (global.get $d9g_dev) (local.get $device)) (then (return)))
    (call $d9g_drop_targets))

  ;; CLI capture: land the executor's picture in the back buffer DIB (the
  ;; ring presented it; the DIB is only the CPU's copy) and present that.
  ;; Skipped (stat 68 + k): 0 executor not coherent, 1 no target entry.
  (func (export "d3d9_gps_sync_front")
    ;; A synchronous host capture cannot return success with stale pixels.
    ;; Contention traps without touching the guest's API retry/CPU state.
    (if (i32.eqz (call $d3d_state_try_enter_host)) (then (unreachable)))
    (call $d9g_sync_front_locked)
    (call $d3d_state_leave))
  (func $d9g_sync_front_locked
    (local $rt i32)
    (call $d9g_flush)
    (if (i32.eqz (call $d9g_coherent (global.get $d9g_dev)))
      (then (call $d9g_stat (i32.const 68) (i32.const 1)) (return)))
    (local.set $rt (call $d3ddev_rt_entry (global.get $d9g_dev)))
    (if (i32.eqz (local.get $rt)) (then (call $d9g_stat (i32.const 69) (i32.const 1)) (return)))
    (call $d9g_readback (load.field DxObject misc1 (local.get $rt)) (load.field DxObject pitch (local.get $rt))
      (global.get $d9g_rt_fmt) (i32.const 3))
    (global.set $d9g_cpu_bits (load.field DxObject misc1 (local.get $rt)))
    (global.set $d9g_cpu_pitch (load.field DxObject pitch (local.get $rt)))
    (global.set $d9g_cpu (i32.const 1))
    (call $dx_present (local.get $rt)))

  ;; ---- d9rt: render targets and surfaces begin --------------------------------
  ;; Colour surfaces (0xd3d90006 records: CreateRenderTarget, offscreen plain
  ;; surfaces, the levels of RENDERTARGET textures and cubes) and depth
  ;; surfaces (0xd3d90005) get their own executor RT / DS, created on first
  ;; use. A colour RT starts from the record's CPU bits (+40); a DS starts
  ;; at depth 1.0, stencil 0, as every executor creates one.
  ;;
  ;; Until a surface has an entry its CPU bits are the surface. After, the
  ;; executor is: a Lock reads it back into the CPU bits only when the ring
  ;; wrote it since the CPU bits last matched (flag 2), and an Unlock
  ;; uploads them ($d9r_cpu_sync).
  ;;
  ;; Table at $d9g_mem+191872, 128 entries x 32: +0 record (guest), +4 its
  ;; serial (+36: identity across heap reuse), +8 executor id, +12 w, +16 h,
  ;; +20 D3DFORMAT, +24 flags, +28 colour write generation ($d9r_gen, so a
  ;; sampled copy knows it is current). Flags: 1 depth, 2 the ring wrote it
  ;; since its CPU bits matched, 8 D24S8.
  ;;
  ;; Sampling: a one-level 2D RENDERTARGET texture BINDs its level's RT
  ;; directly (RT row 0 is the top row, as for TEX2D); a mipmapped or cube
  ;; one keeps a TEX2D / CUBE in the texture cache, each level / face COPYed
  ;; in (GPS_CAP_COPY) when its RT's generation moved. Sampling the bound
  ;; colour target stays reason 5.
  (global $d9r_tgt (mut i32) (i32.const 0))
  (global $d9r_dse (mut i32) (i32.const 0))
  (global $d9g_tw (mut i32) (i32.const 0))
  (global $d9g_th (mut i32) (i32.const 0))
  (global $d9g_tfmt (mut i32) (i32.const 0))
  (global $d9r_gen (mut i32) (i32.const 0))

  (func $d9r_tab (result i32) (i32.add (call $d9g_m) (i32.const 191872)))

  ;; Entry of surface record $rec (guest), or 0.
  (func $d9r_find (param $rec i32) (result i32)
    (local $e i32) (local $end i32) (local $serial i32)
    (if (i32.or (i32.eqz (local.get $rec)) (i32.eqz (global.get $d9g_mem))) (then (return (i32.const 0))))
    (local.set $serial (i32.load offset=36 (call $g2w (local.get $rec))))
    (local.set $e (call $d9r_tab))
    (local.set $end (i32.add (local.get $e) (i32.const 4096)))
    (loop $scan
      (if (i32.and (i32.eq (i32.load (local.get $e)) (local.get $rec))
            (i32.eq (i32.load offset=4 (local.get $e)) (local.get $serial)))
        (then (return (local.get $e))))
      (local.set $e (i32.add (local.get $e) (i32.const 32)))
      (br_if $scan (i32.lt_u (local.get $e) (local.get $end))))
    (i32.const 0))

  (func $d9r_new (param $rec i32) (param $flags i32) (result i32)
    (local $e i32) (local $end i32) (local $wa i32)
    (local.set $e (call $d9r_tab))
    (local.set $end (i32.add (local.get $e) (i32.const 4096)))
    (block $found (loop $scan
      (br_if $found (i32.eqz (i32.load (local.get $e))))
      (local.set $e (i32.add (local.get $e) (i32.const 32)))
      (br_if $scan (i32.lt_u (local.get $e) (local.get $end)))
      ;; 128 live executor surfaces: a fixed table, not a silent miss.
      (call $d9g_fail (i32.const 15))))
    (local.set $wa (call $g2w (local.get $rec)))
    (i32.store (local.get $e) (local.get $rec))
    (i32.store offset=4 (local.get $e) (i32.load offset=36 (local.get $wa)))
    (i32.store offset=8 (local.get $e) (call $d9g_id))
    (i32.store offset=12 (local.get $e) (i32.load offset=20 (local.get $wa)))
    (i32.store offset=16 (local.get $e) (i32.load offset=24 (local.get $wa)))
    (i32.store offset=20 (local.get $e) (i32.load offset=28 (local.get $wa)))
    (i32.store offset=24 (local.get $e) (local.get $flags))
    (i32.store offset=28 (local.get $e) (i32.const 0))
    (local.get $e))

  ;; Executor RT entry of colour record $rec (guest), created on first use.
  ;; 0 = not lowerable (format, size).
  (func $d9r_color (param $device i32) (param $rec i32) (result i32)
    (local $e i32) (local $wa i32) (local $w i32) (local $hgt i32) (local $fmt i32)
    (local.set $e (call $d9r_find (local.get $rec)))
    (if (local.get $e) (then (return (local.get $e))))
    (if (i32.eqz (call $d9g_open)) (then (call $d9g_fail (i32.const 10))))
    (local.set $wa (call $g2w (local.get $rec)))
    (if (i32.ne (i32.load offset=12 (local.get $wa)) (i32.const 0xd3d90006)) (then (return (i32.const 0))))
    (local.set $w (i32.load offset=20 (local.get $wa)))
    (local.set $hgt (i32.load offset=24 (local.get $wa)))
    (local.set $fmt (i32.load offset=28 (local.get $wa)))
    (if (i32.eqz (call $d9g_pix (local.get $fmt))) (then (return (i32.const 0))))
    (if (i32.or (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt)))
          (i32.or (i32.gt_u (local.get $w) (i32.const 2048)) (i32.gt_u (local.get $hgt) (i32.const 2048))))
      (then (return (i32.const 0))))
    (local.set $e (call $d9r_new (local.get $rec) (i32.const 0)))
    (call $gps_create (global.get $d9g_h) (i32.load offset=8 (local.get $e)) (global.get $GPS_KIND_RT)
      (global.get $GPS_FMT_A8B8G8R8) (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
    (call $d9g_upload_to (i32.load offset=8 (local.get $e)) (call $g2w (i32.load offset=40 (local.get $wa)))
      (i32.load offset=48 (local.get $wa)) (local.get $fmt) (i32.const 0) (i32.const 0) (local.get $w) (local.get $hgt))
    (global.set $d9r_gen (i32.add (global.get $d9r_gen) (i32.const 1)))
    (i32.store offset=28 (local.get $e) (global.get $d9r_gen))
    (local.get $e))

  ;; Executor DS entry of depth record $rec (guest), created on first use.
  (func $d9r_depth (param $device i32) (param $rec i32) (result i32)
    (local $e i32) (local $wa i32) (local $w i32) (local $hgt i32) (local $fmt i32) (local $d24 i32)
    (local.set $e (call $d9r_find (local.get $rec)))
    (if (local.get $e) (then (return (local.get $e))))
    (if (i32.eqz (call $d9g_open)) (then (call $d9g_fail (i32.const 10))))
    (local.set $wa (call $g2w (local.get $rec)))
    (local.set $w (i32.load offset=20 (local.get $wa)))
    (local.set $hgt (i32.load offset=24 (local.get $wa)))
    (local.set $fmt (i32.load offset=28 (local.get $wa)))
    (if (i32.or (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $hgt)))
          (i32.or (i32.gt_u (local.get $w) (i32.const 4096)) (i32.gt_u (local.get $hgt) (i32.const 4096))))
      (then (return (i32.const 0))))
    (local.set $d24 (i32.eqz (i32.or (i32.eq (local.get $fmt) (i32.const 70)) (i32.eq (local.get $fmt) (i32.const 80)))))
    (local.set $e (call $d9r_new (local.get $rec) (i32.or (i32.const 1) (i32.shl (local.get $d24) (i32.const 3)))))
    (call $gps_create (global.get $d9g_h) (i32.load offset=8 (local.get $e)) (global.get $GPS_KIND_DS)
      (select (global.get $GPS_FMT_D24S8) (global.get $GPS_FMT_D16) (local.get $d24))
      (i32.const 1) (local.get $w) (local.get $hgt) (i32.const 0))
    (local.get $e))

  ;; The ring wrote colour entry $e: its CPU bits are behind.
  (func $d9r_wrote (param $e i32)
    (global.set $d9r_gen (i32.add (global.get $d9r_gen) (i32.const 1)))
    (i32.store offset=28 (local.get $e) (global.get $d9r_gen))
    (i32.store offset=24 (local.get $e) (i32.or (i32.load offset=24 (local.get $e)) (i32.const 2))))

  ;; Release every entry (Reset, device release). Default-pool surfaces are
  ;; what the ring writes, and those do not outlive either.
  (func $d9r_drop_all
    (local $e i32) (local $end i32)
    (if (i32.eqz (global.get $d9g_mem)) (then (return)))
    (local.set $e (call $d9r_tab))
    (local.set $end (i32.add (local.get $e) (i32.const 4096)))
    (loop $scan
      (if (i32.load (local.get $e)) (then
        (call $d9g_release (i32.load offset=8 (local.get $e)))
        (memory.fill (local.get $e) (i32.const 0) (i32.const 32))))
      (local.set $e (i32.add (local.get $e) (i32.const 32)))
      (br_if $scan (i32.lt_u (local.get $e) (local.get $end))))
    (global.set $d9r_tgt (i32.const 0))
    (global.set $d9r_dse (i32.const 0))
    (global.set $d9g_ds (i32.const 0)))

  ;; A surface record is being freed (09ak $d3d9_depth_retire).
  (func $d9r_forget (param $rec i32)
    (local $e i32)
    (local.set $e (call $d9r_find (local.get $rec)))
    (if (i32.eqz (local.get $e)) (then (return)))
    (if (i32.eq (local.get $e) (global.get $d9r_tgt)) (then
      (global.set $d9r_tgt (i32.const 0)) (global.set $d9g_c_color (i32.const -1))))
    (if (i32.eq (local.get $e) (global.get $d9r_dse)) (then
      (global.set $d9r_dse (i32.const 0)) (global.set $d9g_ds_ptr (i32.const 0))
      (global.set $d9g_ds (i32.const 0)) (global.set $d9g_c_depth (i32.const -1))))
    (call $d9g_release (i32.load offset=8 (local.get $e)))
    (memory.fill (local.get $e) (i32.const 0) (i32.const 32)))

  ;; A RENDERTARGET texture (wasm $t) is being freed: its level records and
  ;; its texture-cache slot (the sampled copy) go.
  (func $d9r_forget_texture (param $t i32)
    (local $base i32) (local $n i32) (local $i i32) (local $e i32)
    (if (i32.eqz (global.get $d9g_mem)) (then (return)))
    (local.set $base (i32.load offset=56 (local.get $t)))
    (local.set $n (i32.mul (i32.load offset=32 (local.get $t))
      (select (i32.const 6) (i32.const 1) (i32.eq (i32.load offset=12 (local.get $t)) (i32.const 5)))))
    (block $done (loop $levels
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (call $d9r_forget (i32.add (local.get $base) (i32.mul (local.get $i) (i32.const 80))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $levels)))
    (local.set $i (i32.const 0))
    (loop $slots
      (local.set $e (i32.add (i32.add (call $d9g_m) (i32.const 52224)) (i32.mul (local.get $i) (i32.const 80))))
      (if (i32.eq (i32.load (local.get $e)) (local.get $t)) (then
        (call $d9g_release (i32.load offset=4 (local.get $e)))
        (i32.store (local.get $e) (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $slots (i32.lt_u (local.get $i) (i32.const 256)))))

  ;; ColorFill of colour record $rec (guest; 0 = the back buffer) on the
  ;; ring: TARGETS (no depth) + CLEAR of the rect. 1 = lowered, 0 = the
  ;; surface cannot be an executor RT.
  (func $d9r_fill (param $device i32) (param $rec i32) (param $l i32) (param $t i32) (param $r i32) (param $b i32)
      (param $argb i32) (result i32)
    (local $e i32) (local $id i32) (local $fmt i32) (local $w i32) (local $hgt i32) (local $full i32) (local $p i32)
    (local $rgba i32)
    (if (local.get $rec)
      (then
        (local.set $e (call $d9r_color (local.get $device) (local.get $rec)))
        (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
        (call $d9g_flush)
        (local.set $id (i32.load offset=8 (local.get $e)))
        (local.set $w (i32.load offset=12 (local.get $e)))
        (local.set $hgt (i32.load offset=16 (local.get $e)))
        (local.set $fmt (i32.load offset=20 (local.get $e))))
      (else
        (if (i32.eqz (call $d9g_bb_ensure (local.get $device))) (then (return (i32.const 0))))
        (local.set $id (global.get $d9g_rt))
        (local.set $w (global.get $d9g_rt_w))
        (local.set $hgt (global.get $d9g_rt_h))
        (local.set $fmt (global.get $d9g_rt_fmt))))
    (local.set $full (i32.and (i32.and (i32.eqz (local.get $l)) (i32.eqz (local.get $t)))
      (i32.and (i32.eq (local.get $r) (local.get $w)) (i32.eq (local.get $b) (local.get $hgt)))))
    ;; A held back buffer upload survives only a fill that does not cover it.
    (if (i32.eqz (local.get $rec)) (then
      (if (local.get $full)
        (then (if (i32.eq (global.get $d9g_cpu) (i32.const 2)) (then (global.set $d9g_cpu (i32.const 0)))))
        (else (call $d9g_flush)))))
    (local.set $rgba (call $d9g_rgba (local.get $argb)))
    (if (i32.eqz (call $d9g_has_alpha (local.get $fmt)))
      (then (local.set $rgba (i32.or (local.get $rgba) (i32.const 0xff000000)))))
    (call $d9r_targets (local.get $id) (i32.const 0))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_CLEAR) (size-of GpsClear)))
    (store.field GpsClear mask (local.get $p) (global.get $GPS_CLEAR_COLOR))
    (store.field GpsClear colormask (local.get $p) (i32.const 15))
    (store.field GpsClear pad (local.get $p) (i32.const 0))
    (store.field GpsClear rgba (local.get $p) (local.get $rgba))
    (store.field GpsClear z (local.get $p) (f32.const 1))
    (store.field GpsClear stencil (local.get $p) (i32.const 0))
    (store.field GpsClear left (local.get $p) (local.get $l))
    (store.field GpsClear top (local.get $p) (local.get $t))
    (store.field GpsClear right (local.get $p) (local.get $r))
    (store.field GpsClear bottom (local.get $p) (local.get $b))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_stat (i32.const 2) (i32.const 1))
    (if (local.get $e)
      (then (call $d9r_wrote (local.get $e)))
      (else
        (if (local.get $full)
          (then
            (global.set $d9g_cpu (i32.const 3))
            (global.set $d9g_cpu_rgba (local.get $rgba)))
          (else (global.set $d9g_cpu (i32.const 0))))))
    (i32.const 1))

  ;; Executor texture for a one-level 2D RENDERTARGET texture (wasm $t): its
  ;; level's RT, or -reason.
  (func $d9r_rt_texture (param $t i32) (result i32)
    (local $e i32)
    (local.set $e (call $d9r_color (global.get $d9g_dev) (i32.load offset=56 (local.get $t))))
    (if (i32.eqz (local.get $e)) (then (return (i32.const -10))))
    (if (i32.eq (local.get $e) (global.get $d9r_tgt)) (then (return (i32.const -5))))
    (call $d9g_stat (i32.const 86) (i32.const 1))
    (i32.load offset=8 (local.get $e)))

  ;; Level $level, face $face of the sampled copy $id of a RENDERTARGET
  ;; texture (wasm $t, record index $idx), COPYed from that level's RT when
  ;; $seq (the slot's word: generation + 1) is behind. The new word, or
  ;; -reason.
  (func $d9r_rt_level (param $id i32) (param $t i32) (param $idx i32) (param $level i32) (param $face i32)
      (param $seq i32) (param $fresh i32) (result i32)
    (local $e i32) (local $p i32)
    (if (i32.eqz (i32.and (global.get $d9g_caps) (global.get $GPS_CAP_COPY))) (then (return (i32.const -5))))
    (local.set $e (call $d9r_color (global.get $d9g_dev)
      (i32.add (i32.load offset=56 (local.get $t)) (i32.mul (local.get $idx) (i32.const 80)))))
    (if (i32.eqz (local.get $e)) (then (return (i32.const -10))))
    (if (i32.eq (local.get $e) (global.get $d9r_tgt)) (then (return (i32.const -5))))
    (if (i32.and (i32.eqz (local.get $fresh))
          (i32.eq (local.get $seq) (i32.add (i32.load offset=28 (local.get $e)) (i32.const 1))))
      (then (call $d9g_stat (i32.const 9) (i32.const 1)) (return (local.get $seq))))
    (local.set $p (call $d9g_begin (global.get $GPS_OP_COPY) (size-of GpsCopy)))
    (store.field GpsCopy src (local.get $p) (i32.load offset=8 (local.get $e)))
    (store.field GpsCopy dst (local.get $p) (local.get $id))
    (store.field GpsCopy sx (local.get $p) (i32.const 0))
    (store.field GpsCopy sy (local.get $p) (i32.const 0))
    (store.field GpsCopy sw (local.get $p) (i32.load offset=12 (local.get $e)))
    (store.field GpsCopy sh (local.get $p) (i32.load offset=16 (local.get $e)))
    (store.field GpsCopy dx (local.get $p) (i32.const 0))
    (store.field GpsCopy dy (local.get $p) (i32.const 0))
    (store.field GpsCopy dw (local.get $p) (i32.load offset=12 (local.get $e)))
    (store.field GpsCopy dh (local.get $p) (i32.load offset=16 (local.get $e)))
    (store.field GpsCopy filter (local.get $p) (i32.or (i32.const 1)
      (i32.or (i32.shl (local.get $level) (i32.const 8)) (i32.shl (local.get $face) (i32.const 16)))))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_stat (i32.const 87) (i32.const 1))
    (i32.add (i32.load offset=28 (local.get $e)) (i32.const 1)))
  ;; ---- d9rt: surface operations on the ring ------------------------------------
  ;; Colour surface $rec (guest; 0 = the back buffer) as an executor RT:
  ;; sets $d9r_sid / $d9r_sw / $d9r_sh / $d9r_sfmt; the entry, -1 for the
  ;; back buffer, 0 = it cannot be an executor RT.
  (global $d9r_sid (mut i32) (i32.const 0))
  (global $d9r_sw (mut i32) (i32.const 0))
  (global $d9r_sh (mut i32) (i32.const 0))
  (global $d9r_sfmt (mut i32) (i32.const 0))
  (func $d9r_surf (param $device i32) (param $rec i32) (result i32)
    (local $e i32)
    (if (i32.eqz (local.get $rec)) (then
      (if (i32.eqz (call $d9g_bb_ensure (local.get $device))) (then (return (i32.const 0))))
      (global.set $d9r_sid (global.get $d9g_rt))
      (global.set $d9r_sw (global.get $d9g_rt_w))
      (global.set $d9r_sh (global.get $d9g_rt_h))
      (global.set $d9r_sfmt (global.get $d9g_rt_fmt))
      (return (i32.const -1))))
    (local.set $e (call $d9r_color (local.get $device) (local.get $rec)))
    (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
    (global.set $d9r_sid (i32.load offset=8 (local.get $e)))
    (global.set $d9r_sw (i32.load offset=12 (local.get $e)))
    (global.set $d9r_sh (i32.load offset=16 (local.get $e)))
    (global.set $d9r_sfmt (i32.load offset=20 (local.get $e)))
    (local.get $e))

  ;; The ring wrote surface $e (from $d9r_surf).
  (func $d9r_surf_wrote (param $e i32)
    (if (i32.eq (local.get $e) (i32.const -1))
      (then (global.set $d9g_cpu (i32.const 0)))
      (else (call $d9r_wrote (local.get $e)))))

  ;; StretchRect on the ring: COPY of src rect (x, y, w, h at $srect, wasm)
  ;; of $srec into $drect of $drec (guest records, 0 = back buffer), with
  ;; D3DTEXF $filter. 1 = lowered, 0 = the ring cannot express it.
  (func $d9r_stretch (param $device i32) (param $srec i32) (param $drec i32)
      (param $srect i32) (param $drect i32) (param $filter i32) (result i32)
    (local $s i32) (local $d i32) (local $sid i32) (local $sfmt i32) (local $p i32)
    (if (i32.eqz (i32.and (global.get $d9g_caps) (global.get $GPS_CAP_COPY))) (then (return (i32.const 0))))
    (if (i32.eq (local.get $srec) (local.get $drec)) (then (return (i32.const 0))))
    (local.set $s (call $d9r_surf (local.get $device) (local.get $srec)))
    (if (i32.eqz (local.get $s)) (then (return (i32.const 0))))
    (local.set $sid (global.get $d9r_sid))
    (local.set $sfmt (global.get $d9r_sfmt))
    (local.set $d (call $d9r_surf (local.get $device) (local.get $drec)))
    (if (i32.eqz (local.get $d)) (then (return (i32.const 0))))
    (call $d9g_flush)
    (local.set $p (call $d9g_begin (global.get $GPS_OP_COPY) (size-of GpsCopy)))
    (store.field GpsCopy src (local.get $p) (local.get $sid))
    (store.field GpsCopy dst (local.get $p) (global.get $d9r_sid))
    (store.field GpsCopy sx (local.get $p) (i32.load (local.get $srect)))
    (store.field GpsCopy sy (local.get $p) (i32.load offset=4 (local.get $srect)))
    (store.field GpsCopy sw (local.get $p) (i32.load offset=8 (local.get $srect)))
    (store.field GpsCopy sh (local.get $p) (i32.load offset=12 (local.get $srect)))
    (store.field GpsCopy dx (local.get $p) (i32.load (local.get $drect)))
    (store.field GpsCopy dy (local.get $p) (i32.load offset=4 (local.get $drect)))
    (store.field GpsCopy dw (local.get $p) (i32.load offset=8 (local.get $drect)))
    (store.field GpsCopy dh (local.get $p) (i32.load offset=12 (local.get $drect)))
    (store.field GpsCopy filter (local.get $p) (i32.or
      (select (i32.const 2) (i32.const 1) (i32.eq (local.get $filter) (i32.const 2)))
      (select (i32.const 0x1000000) (i32.const 0)
        (i32.and (i32.eqz (call $d9g_has_alpha (global.get $d9r_sfmt))) (call $d9g_has_alpha (local.get $sfmt))))))
    (drop (call $d9g_end (local.get $p)))
    (call $d9g_stat (i32.const 87) (i32.const 1))
    (call $d9r_surf_wrote (local.get $d))
    (i32.const 1))

  ;; UpdateSurface / DC upload on the ring: guest pixels ($bits wasm, row
  ;; pitch, D3DFORMAT) into rect (x, y, w, h) of $drec (0 = back buffer).
  ;; 1 = lowered, 0 = the ring cannot express it.
  (func $d9r_update (param $device i32) (param $drec i32) (param $bits i32) (param $pitch i32) (param $fmt i32)
      (param $x i32) (param $y i32) (param $w i32) (param $hgt i32) (result i32)
    (local $d i32)
    (if (i32.eqz (call $d9g_pix (local.get $fmt))) (then (return (i32.const 0))))
    (local.set $d (call $d9r_surf (local.get $device) (local.get $drec)))
    (if (i32.eqz (local.get $d)) (then (return (i32.const 0))))
    (call $d9g_flush)
    (call $d9g_upload_to (global.get $d9r_sid) (i32.sub (local.get $bits)
        (i32.add (i32.mul (local.get $y) (local.get $pitch)) (i32.mul (local.get $x) (call $d3d9_color_bytes (local.get $fmt)))))
      (local.get $pitch) (local.get $fmt) (local.get $x) (local.get $y) (local.get $w) (local.get $hgt))
    (call $d9r_surf_wrote (local.get $d))
    (i32.const 1))

  ;; Lock / Unlock of colour surface $rec: once it has an executor RT the
  ;; ring is its storage. $upload 0: the guest is about to read the CPU bits
  ;; (READBACK, site 2, unless $discard or they already match: stat 79); 1:
  ;; the guest wrote them (UPLOAD). 0 = no entry: the CPU bits are the
  ;; surface.
  (func $d9r_cpu_sync (param $rec i32) (param $upload i32) (param $discard i32) (result i32)
    (local $e i32) (local $wa i32)
    (local.set $e (call $d9r_find (local.get $rec)))
    (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $rec)))
    (call $d9g_flush)
    (if (local.get $upload)
      (then
        (call $d9g_upload_to (i32.load offset=8 (local.get $e)) (call $g2w (i32.load offset=40 (local.get $wa)))
          (i32.load offset=48 (local.get $wa)) (i32.load offset=20 (local.get $e))
          (i32.const 0) (i32.const 0) (i32.load offset=12 (local.get $e)) (i32.load offset=16 (local.get $e)))
        (call $d9r_wrote (local.get $e)))
      (else
        (if (i32.or (local.get $discard) (i32.eqz (i32.and (i32.load offset=24 (local.get $e)) (i32.const 2))))
          (then (call $d9g_stat (i32.const 79) (i32.const 1)))
          (else
            (call $d9g_rb (i32.load offset=8 (local.get $e)) (i32.const 0) (i32.const 0)
              (i32.load offset=12 (local.get $e)) (i32.load offset=16 (local.get $e))
              (call $g2w (i32.load offset=40 (local.get $wa))) (i32.load offset=48 (local.get $wa))
              (i32.load offset=20 (local.get $e)) (i32.const 2))))))
    ;; Either way the CPU bits and the RT match now (a discard's are about
    ;; to be replaced, and its Unlock uploads them).
    (i32.store offset=24 (local.get $e) (i32.and (i32.load offset=24 (local.get $e)) (i32.const -3)))
    (i32.const 1))

  ;; GetRenderTargetData of colour surface $rec into system-memory surface
  ;; $dst (wasm record). 1 = done, 0 = the ring cannot express it.
  (func $d9r_rtdata (param $device i32) (param $rec i32) (param $dst i32) (result i32)
    (local $e i32)
    (local.set $e (call $d9r_surf (local.get $device) (local.get $rec)))
    (if (i32.le_s (local.get $e) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.or (i32.ne (i32.load offset=20 (local.get $dst)) (global.get $d9r_sw))
          (i32.ne (i32.load offset=24 (local.get $dst)) (global.get $d9r_sh)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $d9g_pix (i32.load offset=28 (local.get $dst)))) (then (return (i32.const 0))))
    (call $d9g_flush)
    (call $d9g_rb (global.get $d9r_sid) (i32.const 0) (i32.const 0) (global.get $d9r_sw) (global.get $d9r_sh)
      (call $g2w (i32.load offset=40 (local.get $dst))) (i32.load offset=48 (local.get $dst))
      (i32.load offset=28 (local.get $dst)) (i32.const 2))
    (i32.const 1))
  ;; ---- d9rt end -----------------------------------------------------------------
