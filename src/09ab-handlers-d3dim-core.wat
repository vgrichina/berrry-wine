  ;; ============================================================
  ;; D3DIM CORE HELPERS — hand-written
  ;; Forwarding helpers shared by the v1/v2/v3/v7 stub handlers in
  ;; 09aa-handlers-d3dim.wat. These give the stubs a single place to
  ;; route into the existing IDirect3DDevice3/IDirect3DViewport3 cores
  ;; in 09a8-handlers-directx.wat without arg-shuffle thunks.
  ;;
  ;; Phases 1+ replace stub bodies and these helpers as real semantics arrive.
  ;; ============================================================

  ;; ── D3DIM extended state-block layout ─────────────────────────
  ;; Existing 09a8 layout:
  ;;   +0     4 matrices × 64 bytes = 256
  ;;   +256   render state (512 i32 slots = 2048 bytes)
  ;;   +2304  light state  (128 i32 slots = 512 bytes)
  ;;   total used: 2816 ; allocated: 4096 ; free: 1280 bytes
  ;; D3DIM additions (Phase 0+) — packed into the spare 1280:
  ;;   +2816  current viewport DX slot                (i32, 4)
  ;;   +2820  current material handle                 (i32, 4)
  ;;   +2824  texture stage 0: bound texture DX slot  (i32, 4)
  ;;   +2828  z-buffer DDSurface DX slot              (i32, 4)  (Phase 3 fills)
  ;;   +2832  texture-stage state[8 stages × 32]      (256 bytes)  → ends 3088
  ;;   +3088  viewport rect: dwX,dwY,dwW,dwH          (16)         → ends 3104
  ;;   +3104  viewport scale: dvScaleX,dvScaleY,dvMinZ,dvMaxZ (16) → ends 3120
  ;;   +3120  viewport offset: dvOriginX,dvOriginY    (8)          → ends 3128
  ;;   +3128  attached-viewport list head/tail        (8)          → ends 3136
  ;;   +3136  matrix multiply scratch                  (64)
  ;;   +3200  indexed-draw TL vertex scratch           (96)
  ;;   +3296  execute-buffer clipped TL scratch         (64)
  ;;   +3360  v1 STATETRANSFORM matrix handles W,V,P    (12)
  ;;   +3376  current D3DMATERIAL7 copy                 (68)
  ;;   +3448  D3DLIGHT7 table guest ptr                 (i32, 4)
  ;;   +3452  D3DLIGHT7 enable bitmask                  (i32, 4)
  ;;   +3456  D3D7 user clip planes[6]                  (96)
  ;;   +3552  extended texture-stage state[8 × 6]       (192)         → ends 3744
  ;;          types 11,13,14,16,17,18 (TCI/address/filter/mip filter)
  ;;   +3744  direct-primitive clip polygon A (5 × 32)  (160)         → ends 3904
  ;;   +3904  legacy clip normalization (sx,tx,sy,ty,sz,tz) (24)
  ;;   +3928  legacy clip normalization enabled        (i32, 4)
  ;;   +3932  immutable legacy creation version (0=other) (i32, 4)
  ;;   +3936  active legacy TEXTUREMAPBLEND mode (1/2/3/4/7/8, or 0 for TSS) (4)
  ;;   +3940  stage-zero MIPFILTER explicitly set (i32, including NONE)
  ;;   +3944  owned SetTexture reference (guest interface ptr; never captured)
  ;;   +3948  initialized light-parameter membership mask (never captured)
  ;;   +3952  defined light-enable membership mask (never captured)
  ;;   +3956  scene bracket (new Device2/3 immediate draws require it)
  ;;   +3968  render Worker producer descriptor scratch (32)
  ;;   +4000  D3DCLIPSTATUS round-trip storage          (24)
  ;;   +4024  texture-transform block guest ptr        (i32, 4)  ($d3dim_tex_block)
  ;;   +4028  owned Device2/3 immediate stream descriptor (never captured)
  ;;   +4032  vertex_project vec temp                  (16)
  ;;   +4048  texgen temp A                            (16)
  ;;   +4064  vertex_project clip temp                 (16)
  ;;   +4080  texgen temp B                            (16)
  ;; Last (texture slot, resolved?) pair reported through $host_dx_trace kind
  ;; 16. Only a change is logged, so a per-triangle call site stays quiet while
  ;; still showing every rebind. -1 can never collide with a real pair.
  (global $d3dim_dbg_tex_last (mut i32) (i32.const -1))
  ;; Per-instance only. The render Worker points this at its command-owned
  ;; 4KB snapshot while replaying; the guest instance keeps zero and therefore
  ;; continues to use the live device entry.
  (global $d3dim_state_override (mut i32) (i32.const 0))
  (global $D3DIM_OFF_CUR_VP    i32 (i32.const 2816))
  (global $D3DIM_OFF_CUR_MAT   i32 (i32.const 2820))
  (global $D3DIM_OFF_TEX_STAGE i32 (i32.const 2824))
  (global $D3DIM_OFF_ZBUF_SLOT i32 (i32.const 2828))
  (global $D3DIM_OFF_TSS_STATE i32 (i32.const 2832))
  (global $D3DIM_OFF_VP_RECT   i32 (i32.const 3088))
  (global $D3DIM_OFF_VP_SCALE  i32 (i32.const 3104))
  (global $D3DIM_OFF_VP_ORIGIN i32 (i32.const 3120))
  (global $D3DIM_OFF_VP_LIST_HEAD i32 (i32.const 3128))
  (global $D3DIM_OFF_VP_LIST_TAIL i32 (i32.const 3132))
  (global $D3DIM_OFF_XFORM_HANDLES i32 (i32.const 3360))
  (global $D3DIM_OFF_D3D7_MAT  i32 (i32.const 3376))
  (global $D3DIM_OFF_D3D7_LIGHTS i32 (i32.const 3448))
  (global $D3DIM_OFF_D3D7_LIGHT_ENABLE i32 (i32.const 3452))
  (global $D3DIM_OFF_D3D7_CLIP_PLANES i32 (i32.const 3456))
  (global $D3DIM_OFF_TSS_EXT i32 (i32.const 3552))
  (global $D3DIM_OFF_CLIP_STATUS i32 (i32.const 4000))
  ;; Producer-only descriptor scratch in the unused gap before CLIP_STATUS.
  (global $D3DIM_OFF_WORKER_DESC i32 (i32.const 3968))

  ;; Nonzero while this instance has draws queued on the render Worker that
  ;; no fence has waited for yet. Every fence site is on a path that touches
  ;; pixels or state the queued draws read, so this gate is what keeps those
  ;; sites free when no Worker is present or nothing is outstanding.
  (global $d3dim_worker_pending (mut i32) (i32.const 0))
  ;; Primary surface entry whose Flip went to the render Worker and has not
  ;; been presented yet. The Worker swaps the flip chain's DIBs in draw order,
  ;; so the front buffer holds that frame only once a fence has waited for it;
  ;; the fence presents it then. Zero when no present is owed.
  (global $d3dim_present_pending (mut i32) (i32.const 0))

  ;; Direct3D never writes a pixel outside the current viewport, transformed
  ;; or pre-transformed (XYZRHW) vertices alike: the viewport rectangle is the
  ;; clip region on the render target. Age of Wonders II draws its lower UI
  ;; panel into the back buffer once and then redraws only the map viewport
  ;; each frame; with draws clipped to the whole target its terrain mesh
  ;; painted over the panel and left black wedges where the mesh runs off the
  ;; map. The rectangle is draw-scoped: $d3dim_clip_begin/$d3dim_clip_end
  ;; bracket every draw funnel (they nest), and only the span and rect writers
  ;; a draw reaches consult it, so clears and blits are unaffected. Off when no
  ;; viewport is set or it already covers the whole target. x1/y1 exclusive.
  (global $d3dim_clip_on (mut i32) (i32.const 0))
  (global $d3dim_clip_depth (mut i32) (i32.const 0))
  (global $d3dim_clip_x0 (mut i32) (i32.const 0))
  (global $d3dim_clip_y0 (mut i32) (i32.const 0))
  (global $d3dim_clip_x1 (mut i32) (i32.const 0))
  (global $d3dim_clip_y1 (mut i32) (i32.const 0))

  (func $d3dim_clip_begin (param $this i32)
    (global.set $d3dim_clip_depth (i32.add (global.get $d3dim_clip_depth) (i32.const 1)))
    (if (i32.gt_s (global.get $d3dim_clip_depth) (i32.const 1)) (then (return)))
    (global.set $d3dim_clip_on (call $d3dim_clip_compute (local.get $this))))

  ;; Device $this's viewport clip on its current target into
  ;; $d3dim_clip_x0..y1; result 1 when it clips anything. It reads the state
  ;; through $d3ddev_state, so a replayed snapshot ($d3dim_state_override)
  ;; yields the clip its draw was issued with -- the GPU executor describes
  ;; queued draws that way, outside any draw scope.
  (func $d3dim_clip_compute (param $this i32) (result i32)
    (local $state i32) (local $rt i32) (local $sw i32)
    (local $vx i32) (local $vy i32) (local $vw i32) (local $vh i32)
    (local $rtw i32) (local $rth i32)
    (local $x0 i32) (local $y0 i32) (local $x1 i32) (local $y1 i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $rt (call $d3ddev_rt_entry (local.get $this)))
    (if (i32.eqz (local.get $rt)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $vx (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT))))
    (local.set $vy (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4)))))
    (local.set $vw (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8)))))
    (local.set $vh (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12)))))
    (if (i32.or (i32.le_s (local.get $vw) (i32.const 0)) (i32.le_s (local.get $vh) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $rtw (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $rth (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))
    (local.set $x0 (select (local.get $vx) (i32.const 0) (i32.gt_s (local.get $vx) (i32.const 0))))
    (local.set $y0 (select (local.get $vy) (i32.const 0) (i32.gt_s (local.get $vy) (i32.const 0))))
    (local.set $x1 (i32.add (local.get $vx) (local.get $vw)))
    (local.set $y1 (i32.add (local.get $vy) (local.get $vh)))
    (if (i32.gt_s (local.get $x1) (local.get $rtw)) (then (local.set $x1 (local.get $rtw))))
    (if (i32.gt_s (local.get $y1) (local.get $rth)) (then (local.set $y1 (local.get $rth))))
    (if (i32.and
          (i32.and (i32.eqz (local.get $x0)) (i32.eqz (local.get $y0)))
          (i32.and (i32.ge_s (local.get $x1) (local.get $rtw)) (i32.ge_s (local.get $y1) (local.get $rth))))
      (then (return (i32.const 0))))
    (global.set $d3dim_clip_x0 (local.get $x0))
    (global.set $d3dim_clip_y0 (local.get $y0))
    (global.set $d3dim_clip_x1 (local.get $x1))
    (global.set $d3dim_clip_y1 (local.get $y1))
    (i32.const 1))

  (func $d3dim_clip_end
    (global.set $d3dim_clip_depth (i32.sub (global.get $d3dim_clip_depth) (i32.const 1)))
    (if (i32.le_s (global.get $d3dim_clip_depth) (i32.const 0)) (then
      (global.set $d3dim_clip_depth (i32.const 0))
      (global.set $d3dim_clip_on (i32.const 0)))))

  ;; 1 when row $y lies outside the active draw clip.
  (func $d3dim_clip_row_out (param $y i32) (result i32)
    (if (i32.eqz (global.get $d3dim_clip_on)) (then (return (i32.const 0))))
    (i32.or (i32.lt_s (local.get $y) (global.get $d3dim_clip_y0))
            (i32.ge_s (local.get $y) (global.get $d3dim_clip_y1))))

  (func $d3dim_worker_fence
    (local $front i32)
    (drop (call $d3dim_lazy_fence (i32.const 0) (i32.const 0)))
    (if (i32.or (global.get $d3dim_worker_pending) (global.get $d3dim_gpu_cooperative)) (then
      (global.set $d3dim_worker_pending (i32.const 0))
      (drop (call $host_gpu_gl_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))))
    (if (global.get $d3dim_present_pending) (then
      (local.set $front (global.get $d3dim_present_pending))
      (global.set $d3dim_present_pending (i32.const 0))
      (call $dx_present (local.get $front)))))

  ;; The WebGL executor's queued Flip (lib/d3dim-gpu.js _flip) owes one
  ;; present: its back buffer's readback is still in flight into the DIB that
  ;; is now the front's. Collect just that -- a fence ranged to the front DIB,
  ;; which never reads back the frame being drawn now -- and present it.
  (func $d3dim_gpu_present_owed
    (local $front i32)
    (local.set $front (global.get $d3dim_present_pending))
    (if (i32.eqz (local.get $front)) (then (return)))
    (global.set $d3dim_present_pending (i32.const 0))
    (drop (call $host_gpu_gl_call (i32.const 0x20001)
      (load.field DxObject misc1 (local.get $front))
      (i32.mul (load.field DxObject pitch (local.get $front))
               (load.field DxObject height (local.get $front)))))
    (call $dx_present (local.get $front)))

  ;; CPU access to one surface: WebGL executes draws synchronously, so only
  ;; overlapping GPU-owned backing bytes need readback. Result 2 keeps pending
  ;; set for other dirty targets; result 1 says all targets are synchronized.
  ;; The software render Worker and deferred presentation retain global ordering.
  (func $d3dim_surface_fence (param $entry i32)
    (local $dib i32) (local $length i32) (local $synchronized i32)
    (if (global.get $d3dim_gpu_on) (then (call $d3dim_gpu_present_owed)))
    (if (local.get $entry) (then
      (local.set $synchronized (call $d3dim_lazy_fence (load.field DxObject misc1 (local.get $entry))
        (i32.mul (load.field DxObject pitch (local.get $entry))
                 (load.field DxObject height (local.get $entry)))))))
    (if (i32.and (global.get $d3dim_gpu_on)
                (i32.eqz (global.get $d3dim_present_pending))) (then
      ;; The shared barrier already submitted this producer and synchronized
      ;; this exact span. Result 2 only means OTHER targets remain dirty.
      (if (local.get $synchronized) (then (return)))
      (if (i32.eqz (i32.or (global.get $d3dim_worker_pending)
                           (global.get $d3dim_gpu_cooperative))) (then (return)))
      (if (local.get $entry) (then
        (local.set $dib (load.field DxObject misc1 (local.get $entry)))
        (local.set $length (i32.mul (load.field DxObject pitch (local.get $entry))
                                  (load.field DxObject height (local.get $entry))))
        (if (i32.and (i32.ne (local.get $dib) (i32.const 0))
                     (i32.ne (local.get $length) (i32.const 0))) (then
          (if (i32.eq (call $host_gpu_gl_call (i32.const 0x20001)
                (local.get $dib) (local.get $length)) (i32.const 1))
            (then (global.set $d3dim_worker_pending (i32.const 0))))
          (return)))))))
    (call $d3dim_worker_fence))

  ;; Queue a flip-chain DIB swap behind the draws still on the render Worker,
  ;; so the frame keeps rasterizing into the buffer it started in while the
  ;; guest runs on. Only worth it with draws outstanding: with none, the
  ;; caller's synchronous swap costs nothing. Result 1 means queued; the
  ;; present is then owed to the next fence.
  (func $d3dim_worker_try_flip (param $front i32) (param $back i32) (result i32)
    (local $desc i32)
    (if (i32.eqz (global.get $d3dim_worker_pending)) (then (return (i32.const 0))))
    ;; The render Worker keeps one frame in flight: a second Flip fences
    ;; first. The WebGL executor collects only the owed frame and goes on, so
    ;; its next readback is queued too instead of paid synchronously.
    (if (global.get $d3dim_present_pending) (then
      (if (global.get $d3dim_gpu_on)
        (then (call $d3dim_gpu_present_owed))
        (else (return (i32.const 0))))))
    (local.set $desc (global.get $d3dim_flip_desc))
    (if (i32.eqz (local.get $desc)) (then
      (local.set $desc (call $g2w (call $heap_alloc (i32.const 8))))
      (global.set $d3dim_flip_desc (local.get $desc))))
    (i32.store offset=0 (local.get $desc) (local.get $front))
    (i32.store offset=4 (local.get $desc) (local.get $back))
    (if (i32.eqz (call $host_gpu_gl_call (i32.const 0x20003) (local.get $desc) (i32.const 0)))
      (then (return (i32.const 0))))
    (global.set $d3dim_present_pending (local.get $front))
    (i32.const 1))
  (global $d3dim_flip_desc (mut i32) (i32.const 0))

  ;; The render Worker's half of a queued Flip: the same DIB swap
  ;; $handle_IDirectDrawSurface_Flip does synchronously, run after every draw
  ;; queued before it. Both arguments are DX_OBJECTS entry addresses.
  (func (export "d3dim_worker_flip") (param $front i32) (param $back i32)
    (local $tmp i32)
    (local.set $tmp (load.field DxObject misc1 (local.get $front)))
    (store.field DxObject misc1 (local.get $front) (load.field DxObject misc1 (local.get $back)))
    (store.field DxObject misc1 (local.get $back) (local.get $tmp)))

  ;; Every D3DIM draw funnels through $d3dim_draw_primitive or
  ;; $d3dim_draw_indexed_primitive. The non-indexed core calls this once its
  ;; vertices are transformed (type 3): lights and materials are read live
  ;; from DX_OBJECTS, outside the state snapshot, so the Worker only ever
  ;; rasterizes. It queues the draw when a Worker is attached and otherwise
  ;; waits for queued work before the caller rasterizes here, so the target
  ;; sees draws in guest order either way. The renderer instance replays with
  ;; $d3dim_state_override set and never re-queues.
  ;; Internal type 4 retains supplied UV in a 32-byte TL record. The linear
  ;; texture transform is deferred until after geometric clipping. This keeps
  ;; texture q independent of position rhw without dividing at the vertices.
  (global $d3dim_supplied_projection (mut i32) (i32.const 0))
  (func $d3dim_supplied_projected (param $state i32) (result i32)
    (local $block i32) (local $flags i32)
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 4024))))
    (if (i32.eqz (local.get $block)) (then (return (i32.const 0))))
    (local.set $flags (call $gl32 (i32.add (local.get $block) (i32.const 512))))
    (i32.and
      ;; Supplied sets have no TCI high word. FVF packing already selected
      ;; their FLOAT2 pair; generated coordinates have different prerequisites.
      (i32.le_u (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11)) (i32.const 7))
      (i32.and (i32.ge_u (local.get $flags) (i32.const 0x102))
        (i32.le_u (local.get $flags) (i32.const 0x104)))))

  ;; The encoder owns a copy in the WVP scratch of a type-4 TL snapshot. TL
  ;; replay never recomputes WVP, so this does not alias live matrix scratch.
  (func $d3dim_supplied_matrix (param $state i32) (result i32)
    (local $matrix i32) (local $copy i32) (local $column i32) (local $row i32)
    (if (global.get $d3dim_state_override) (then
      (return (i32.add (call $g2w (local.get $state)) (i32.const 3136)))))
    (local.set $matrix (call $g2w (call $gl32 (i32.add (local.get $state) (i32.const 4024)))))
    (if (i32.eq (global.get $d3dim_supplied_projection) (i32.const 3))
      (then (return (local.get $matrix))))
    ;; Normalize the last output component into z, keeping both numerators.
    ;; COUNT2 therefore yields (x/y,y/y) for a 2D sampler; COUNT4 ignores the
    ;; third quotient and samples (x/w,y/w). No vertex division takes place.
    (local.set $column (i32.shl (i32.sub
      (i32.and (i32.load offset=512 (local.get $matrix)) (i32.const 0xff)) (i32.const 1)) (i32.const 2)))
    (if (i32.eqz (i32.or (i32.eq (local.get $column) (i32.const 4))
          (i32.eq (local.get $column) (i32.const 12)))) (then (return (local.get $matrix))))
    (local.set $copy (i32.add (call $g2w (local.get $state)) (i32.const 3136)))
    (call $memcpy (local.get $copy) (local.get $matrix) (i32.const 64))
    (loop $rows
      (i32.store offset=8 (i32.add (local.get $copy) (local.get $row))
        (i32.load (i32.add (i32.add (local.get $matrix) (local.get $row)) (local.get $column))))
      (local.set $row (i32.add (local.get $row) (i32.const 16)))
      (br_if $rows (i32.lt_u (local.get $row) (i32.const 64))))
    (local.get $copy))
  (func (export "d3dim_gpu_supplied_matrix") (param $this i32) (result i32)
    (call $d3dim_supplied_matrix (call $d3ddev_state (local.get $this))))

  (func $d3dim_worker_route
    (param $this i32) (param $primitive i32) (param $vertices i32) (param $count i32)
    (result i32)
    (if (global.get $d3dim_state_override) (then (return (i32.const 0))))
    (if (call $d3dim_worker_try_draw
          (local.get $this) (local.get $primitive)
          (if (result i32) (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2))
            (then (i32.add (global.get $d3dim_supplied_projection) (i32.const 3)))
            (else (select (i32.const 4) (i32.const 3) (global.get $d3dim_supplied_projection))))
          (local.get $vertices) (local.get $count))
      (then (return (i32.const 1))))
    (call $d3dim_worker_fence)
    (i32.const 0))

  ;; The Worker consumes non-indexed vertices, so with one attached an indexed
  ;; draw is expanded in index order -- which preserves list, strip and fan
  ;; topology -- and handed to the non-indexed core, which transforms it here
  ;; and queues the result. Out-of-range indices keep the draw on the
  ;; synchronous indexed path, whose per-index validation decides what it
  ;; skips. Result 1 means the draw was issued.
  (func $d3dim_worker_try_draw_indexed
    (param $this i32) (param $primitive i32) (param $vertex_type i32)
    (param $vertices i32) (param $count i32)
    (param $indices i32) (param $index_count i32) (result i32)
    (local $size i32) (local $tmp i32) (local $dst i32) (local $src i32)
    (local $idx_wa i32) (local $i i32) (local $idx i32) (local $ok i32)
    (if (global.get $d3dim_state_override) (then (return (i32.const 0))))
    (if (i32.ne (call $d3dim_vertex_type_stride (local.get $vertex_type)) (i32.const 32))
      (then (return (i32.const 0))))
    ;; 0x20002: is a render Worker attached and ready? Asked before paying for
    ;; the expansion, which is wasted when the answer is no.
    (if (i32.eqz (call $host_gpu_gl_call (i32.const 0x20002) (i32.const 0) (i32.const 0)))
      (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $index_count) (i32.const 0x20000))
      (then (return (i32.const 0))))
    (local.set $size (i32.mul (local.get $index_count) (i32.const 32)))
    ;; One grow-only buffer per instance. A heap_alloc/heap_free pair per draw
    ;; sent every free through the heap's reclaim path: 630ms of a 6.6s MCM
    ;; race window went to $heap_free_list_purge + $heap_free_impl.
    (if (i32.gt_u (local.get $size) (global.get $d3dim_expand_cap)) (then
      (if (global.get $d3dim_expand_buf)
        (then (call $heap_free (global.get $d3dim_expand_buf))))
      (global.set $d3dim_expand_cap (i32.const 0x10000))
      (block $sized (loop $grow
        (br_if $sized (i32.ge_u (global.get $d3dim_expand_cap) (local.get $size)))
        (global.set $d3dim_expand_cap (i32.shl (global.get $d3dim_expand_cap) (i32.const 1)))
        (br $grow)))
      (global.set $d3dim_expand_buf (call $heap_alloc (global.get $d3dim_expand_cap)))
      (if (i32.eqz (global.get $d3dim_expand_buf))
        (then (global.set $d3dim_expand_cap (i32.const 0))))))
    (local.set $tmp (global.get $d3dim_expand_buf))
    (if (i32.eqz (local.get $tmp)) (then (return (i32.const 0))))
    (local.set $dst (call $g2w (local.get $tmp)))
    (local.set $src (call $g2w (local.get $vertices)))
    (local.set $idx_wa (call $g2w (local.get $indices)))
    (local.set $ok (i32.const 1))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $index_count)))
      (local.set $idx (i32.load16_u (i32.add (local.get $idx_wa) (i32.shl (local.get $i) (i32.const 1)))))
      (if (i32.ge_u (local.get $idx) (local.get $count))
        (then (local.set $ok (i32.const 0)) (br $done)))
      (memory.copy
        (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 5)))
        (i32.add (local.get $src) (i32.shl (local.get $idx) (i32.const 5)))
        (i32.const 32))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (if (local.get $ok) (then
      (call $d3dim_draw_primitive
        (local.get $this) (local.get $primitive) (local.get $vertex_type)
        (local.get $tmp) (local.get $index_count))))
    ;; The encoder copied the vertices into its ring before returning, so the
    ;; buffer is free for the next draw.
    (local.get $ok))
  (global $d3dim_expand_buf (mut i32) (i32.const 0))
  (global $d3dim_expand_cap (mut i32) (i32.const 0))
  (global $d3dim_xform_buf (mut i32) (i32.const 0))
  (global $d3dim_xform_cap (mut i32) (i32.const 0))

  ;; Snapshot ownership is established by the JS encoder before this returns.
  ;; Result 1 means a render Worker accepted the draw; 0 selects the existing
  ;; synchronous rasterizer without changing non-Threads behavior.
  (func $d3dim_worker_try_draw
    (param $this i32) (param $primitive i32) (param $vertex_type i32)
    (param $vertices i32) (param $count i32) (result i32)
    (local $state i32) (local $desc i32)
    (if (global.get $d3dim_state_override) (then (return (i32.const 0))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $desc (i32.add (call $g2w (local.get $state))
      (global.get $D3DIM_OFF_WORKER_DESC)))
    (i32.store offset=0 (local.get $desc) (local.get $this))
    (i32.store offset=4 (local.get $desc) (local.get $primitive))
    (i32.store offset=8 (local.get $desc) (local.get $vertex_type))
    (i32.store offset=12 (local.get $desc) (local.get $vertices))
    (i32.store offset=16 (local.get $desc) (local.get $count))
    (i32.store offset=20 (local.get $desc) (local.get $state))
    (if (i32.eqz (call $host_gpu_gl_call (i32.const 0x20000) (local.get $desc) (i32.const 0)))
      (then (return (i32.const 0))))
    (global.set $d3dim_worker_pending (i32.const 1))
    (i32.const 1))

  ;; A renderer-only instance needs guest-address translation and a private
  ;; heap arena for its immutable command workspace, but it never decodes or
  ;; executes x86. Do not call init_thread here: that also assigns page/cache
  ;; partitions, and the old experimental slot 63 wrote beyond the eight-slot
  ;; PAGE_DIR arena. The process heap cursor itself is shared and atomically
  ;; hands this instance a non-overlapping arena on its first guest_alloc.
  (func (export "d3dim_worker_init") (param $img_base i32)
    ;; The renderer materializes these very pixels; never wait on its client.
    (global.set $d3dim_lazy_bypass (i32.const 1))
    ;; Not a guest thread: take a lock identity no guest thread can have, or
    ;; every shared-table lock recurses with the main thread's (see
    ;; $lock_identity). One render worker per process hosts all endpoints.
    (global.set $lock_identity (i32.const 0x40000000))
    (global.set $image_base (local.get $img_base))
    (global.set $heap_ptr (i32.const 0))
    (global.set $heap_end (i32.const 0))
    (global.set $heap_base
      (i32.load (region.addr $HEAP_SHARED 4))))

  (func (export "d3dim_worker_draw")
    (param $this i32) (param $primitive i32) (param $vertex_type i32)
    (param $vertices i32) (param $count i32) (param $state i32)
    (global.set $d3dim_state_override (local.get $state))
    (call $d3dim_draw_primitive (local.get $this) (local.get $primitive)
      (local.get $vertex_type) (local.get $vertices) (local.get $count))
    (global.set $d3dim_state_override (i32.const 0)))

  ;; Render endpoints share one instance. A native trap bypasses ordinary
  ;; draw epilogues, so its scheduler clears optional raster hooks before the
  ;; next endpoint can run. Only call after all asynchronous draw slices end.
  ;; Coefficients and private GL matrix storage are persistent scratch; the
  ;; enable flags below guard their use and each draw supplies fresh values.
  (func (export "d3d_render_reset_transients")
    (global.set $d3dim_supplied_projection (i32.const 0))
    (global.set $d3dim_color_on (i32.const 0))
    (global.set $d3dim_mip_on (i32.const 0))
    (global.set $rast_fog_on (i32.const 0))
    (global.set $rast_t1_on (i32.const 0))
    (global.set $d3dim_state_override (i32.const 0)))

  ;; ── GPU executor seam ─────────────────────────────────────────
  ;; With a GPU executor attached (lib/d3dim-gpu.js), the same 0x20000 draw /
  ;; 0x20001 fence / 0x20003 flip records go to it instead of the render
  ;; Worker, and clears go too (0x20004), because a clear the software path
  ;; paints into the DIB is invisible to a GPU target. The executor never
  ;; reads the 4KB state snapshot itself: it asks d3dim_gpu_describe, which
  ;; applies the same state interpretation the software rasterizer uses, so
  ;; the two backends differ in how they draw and never in what they draw.
  (global $d3dim_gpu_on (mut i32) (i32.const 0))
  ;; Cooperative instances share a host GPU owner. A sibling can have pending
  ;; pixels even when this instance has never drawn, so CPU barriers must query
  ;; the owner rather than consulting only this instance's pending flag.
  (global $d3dim_gpu_cooperative (mut i32) (i32.const 0))
  ;; Opt-in experiment. Only DIB-backed,
  ;; nonprimary Locks qualify; host/other-surface barriers remain eager.
  ;; Translation is conservative: an address proof may synchronize early.
  (global $d3dim_lazy_on (mut i32) (i32.const 0))
  (global $d3dim_lazy_armed (mut i32) (i32.const 0))
  (global $d3dim_lazy_touched (mut i32) (i32.const 0))
  (global $d3dim_lazy_untouched (mut i32) (i32.const 0))
  ;; No active data segment: instantiating another guest must not reset this.
  ;; +0 mutex, +4 armed length, +8 start, +12 entry, +16 deferred GPU work.
  (global $D3DIM_LAZY_SHARED i32 (region.addr $D3DIM_LAZY_SHARED 0))
  (global $D3DIM_LAZY_SHARED_SIZE i32 (i32.const 32))
  (global $d3dim_lazy_bypass (mut i32) (i32.const 0))
  (func $d3dim_lazy_enter
    (loop $retry
      (if (i32.atomic.rmw.cmpxchg (region.addr $D3DIM_LAZY_SHARED 0) (i32.const 0) (i32.const 1)) (then
        ;; A failed renderer must not leave another guest waiting forever.
        (if (i32.eq (memory.atomic.wait32 (region.addr $D3DIM_LAZY_SHARED 0)
              (i32.const 1) (i64.const 30000000000)) (i32.const 2)) (then (unreachable)))
        (br $retry))))
    (global.set $d3dim_lazy_bypass (i32.const 1)))
  (func $d3dim_lazy_leave
    (global.set $d3dim_lazy_bypass (i32.const 0))
    (i32.atomic.store (region.addr $D3DIM_LAZY_SHARED 0) (i32.const 0))
    (drop (memory.atomic.notify (region.addr $D3DIM_LAZY_SHARED 0) (i32.const 2147483647))))
  ;; Called with the mutex held. Keep the range visible until readback ends.
  (func $d3dim_lazy_materialize (param $wa i32) (param $len i32)
    (local $result i32)
    (local.set $result (call $host_gpu_gl_call (i32.const 0x20001) (local.get $wa) (local.get $len)))
    (if (i32.eqz (local.get $result)) (then (unreachable)))
    (if (i32.eq (local.get $result) (i32.const 1)) (then
      (i32.atomic.store (region.addr $D3DIM_LAZY_SHARED 16) (i32.const 0))
      (global.set $d3dim_worker_pending (i32.const 0))))
    (if (i32.or (i32.eq (local.get $result) (i32.const 1))
          (i32.or (i32.eqz (local.get $len)) (call $d3dim_lazy_overlaps (local.get $wa) (local.get $len)))) (then
      (i32.atomic.store (region.addr $D3DIM_LAZY_SHARED 4) (i32.const 0)))))
  (func $d3dim_lazy_overlaps (param $wa i32) (param $len i32) (result i32)
    (i32.and (i32.ne (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)) (i32.const 0))
      (i32.and (i32.lt_u (local.get $wa) (i32.add
          (i32.load (region.addr $D3DIM_LAZY_SHARED 8)) (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4))))
        (i64.gt_u (i64.add (i64.extend_i32_u (local.get $wa)) (i64.extend_i32_u (local.get $len)))
          (i64.extend_i32_u (i32.load (region.addr $D3DIM_LAZY_SHARED 8)))))))
  (func $d3dim_lazy_fence (param $wa i32) (param $len i32) (result i32)
    (local $synchronized i32)
    (if (global.get $d3dim_lazy_bypass) (then (return (i32.const 0))))
    (if (i32.eqz (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 16))) (then (return (i32.const 0))))
    (call $d3dim_lazy_enter)
    (if (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 16)) (then
      (call $d3dim_lazy_materialize (local.get $wa) (local.get $len))
      (local.set $synchronized (i32.const 1))))
    (call $d3dim_lazy_leave)
    (local.get $synchronized))
  (func (export "d3dim_lazy_enable") (param $on i32)
    (call $d3dim_worker_fence)
    (global.set $d3dim_lazy_on (i32.ne (local.get $on) (i32.const 0))))
  (func (export "get_d3dim_lazy_armed") (result i32) (global.get $d3dim_lazy_armed))
  (func (export "get_d3dim_lazy_touched") (result i32) (global.get $d3dim_lazy_touched))
  (func (export "get_d3dim_lazy_untouched") (result i32) (global.get $d3dim_lazy_untouched))
  (func $d3dim_lazy_access (param $wa i32) (param $len i32)
    (if (global.get $d3dim_lazy_bypass) (then (return)))
    (call $d3dim_lazy_enter)
    (if (i32.and (i32.ne (local.get $len) (i32.const 0))
          (call $d3dim_lazy_overlaps (local.get $wa) (local.get $len))) (then
      (global.set $d3dim_lazy_touched (i32.add (global.get $d3dim_lazy_touched) (i32.const 1)))
      (call $d3dim_lazy_materialize (i32.load (region.addr $D3DIM_LAZY_SHARED 8))
        (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)))))
    (call $d3dim_lazy_leave))
  ;; Host file reads scatter directly through JS views, bypassing g2w stores.
  ;; Run on the owning instance BEFORE its host import, never on the page
  ;; shadow after copying. Lock only arms backing wholly inside this DIB
  ;; window; other mappings need no lazy-surface materialization here.
  (func $d3dim_host_write_interval (param $start i64) (param $end i64)
    (local $lo i64) (local $hi i64) (local $window_end i64)
    (local.set $lo (i64.extend_i32_u (global.get $DIB_GUEST_BASE)))
    (local.set $window_end (i64.add (local.get $lo)
      (i64.extend_i32_u (global.get $DIB_GUEST_CAPACITY))))
    (if (i64.gt_u (local.get $start) (local.get $lo))
      (then (local.set $lo (local.get $start))))
    (local.set $hi (select (local.get $end) (local.get $window_end)
      (i64.lt_u (local.get $end) (local.get $window_end))))
    (if (i64.lt_u (local.get $lo) (local.get $hi)) (then
      (call $d3dim_lazy_access
        (i32.add (global.get $DIB_BACKING_BASE)
          (i32.sub (i32.wrap_i64 (local.get $lo)) (global.get $DIB_GUEST_BASE)))
        (i32.wrap_i64 (i64.sub (local.get $hi) (local.get $lo)))))))
  (func $d3dim_host_write_fence (param $ga i32) (param $len i32)
    (local $end i64)
    (if (i32.eqz (local.get $len)) (then (return)))
    (if (i32.eqz (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4))) (then (return)))
    ;; Match filesystem guestChunk((bufGA + moved) >>> 0), without changing
    ;; its mapping validation or errors. Widen before adding; do not mistake
    ;; a wrapping interval for an empty/nonoverlapping one.
    (local.set $end (i64.add (i64.extend_i32_u (local.get $ga))
      (i64.extend_i32_u (local.get $len))))
    (call $d3dim_host_write_interval (i64.extend_i32_u (local.get $ga))
      (select (local.get $end) (i64.const 4294967296)
        (i64.lt_u (local.get $end) (i64.const 4294967296))))
    (if (i64.gt_u (local.get $end) (i64.const 4294967296)) (then
      (call $d3dim_host_write_interval (i64.const 0)
        (i64.sub (local.get $end) (i64.const 4294967296))))))
  (func $d3dim_lock_fence (param $entry i32)
    (local $dib i32) (local $len i32)
    ;; Nested locks take the conservative barrier before replacing the range.
    (if (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)) (then (call $d3dim_worker_fence)))
    (if (i32.and (global.get $d3dim_lazy_on)
          (i32.and (global.get $d3dim_gpu_on)
            (i32.and (global.get $d3dim_worker_pending)
              (i32.eqz (global.get $d3dim_present_pending))))) (then
      (local.set $dib (load.field DxObject misc1 (local.get $entry)))
      (local.set $len (i32.mul (load.field DxObject pitch (local.get $entry))
                              (load.field DxObject height (local.get $entry))))
      ;; Scalar helpers may translate only the first byte unless crossing a
      ;; page. Keep unaligned surface starts eager so straddling reads/writes
      ;; cannot enter the range without triggering a second translation.
      (if (i32.and (local.get $dib) (i32.const 4095)) (then
        (call $d3dim_surface_fence (local.get $entry)) (return)))
      (if (i32.and (i32.eqz (i32.and (load.field DxObject flags (local.get $entry)) (i32.const 1)))
            (i32.and (i32.ne (local.get $len) (i32.const 0))
              (i32.and (i32.lt_u (i32.sub (local.get $dib) (global.get $DIB_BACKING_BASE)) (global.get $DIB_GUEST_CAPACITY))
                (i32.le_u (local.get $len) (i32.sub (global.get $DIB_GUEST_CAPACITY)
                  (i32.sub (local.get $dib) (global.get $DIB_BACKING_BASE))))))) (then
        ;; Publish queued snapshots to the independent renderer before another
        ;; guest can request readback. No pixel readback at this boundary.
        ;; A private executor cannot synchronize another guest: keep it eager.
        (if (i32.ne (call $host_gpu_gl_call (i32.const 0x20007) (i32.const 0) (i32.const 0)) (i32.const 1)) (then
          (call $d3dim_surface_fence (local.get $entry)) (return)))
        (call $d3dim_lazy_enter)
        (if (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)) (then
          (call $d3dim_lazy_materialize (i32.const 0) (i32.const 0))))
        (i32.store (region.addr $D3DIM_LAZY_SHARED 8) (local.get $dib))
        (i32.store (region.addr $D3DIM_LAZY_SHARED 12) (local.get $entry))
        (i32.atomic.store (region.addr $D3DIM_LAZY_SHARED 16) (i32.const 1))
        (i32.atomic.store (region.addr $D3DIM_LAZY_SHARED 4) (local.get $len))
        (global.set $d3dim_lazy_armed (i32.add (global.get $d3dim_lazy_armed) (i32.const 1)))
        ;; Cached read windows must re-prove their DIB span before use.
        (call $uop_win_bump)
        (call $d3dim_lazy_leave)
        (return)))))
    (call $d3dim_surface_fence (local.get $entry)))
  (func $d3dim_lazy_unlock (param $entry i32) (result i32)
    (local $untouched i32)
    (if (i32.eqz (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4))) (then (return (i32.const 0))))
    (call $d3dim_lazy_enter)
    (if (i32.and (i32.ne (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 4)) (i32.const 0))
          (i32.eq (local.get $entry) (i32.load (region.addr $D3DIM_LAZY_SHARED 12)))) (then
      (i32.atomic.store (region.addr $D3DIM_LAZY_SHARED 4) (i32.const 0))
      (global.set $d3dim_lazy_untouched (i32.add (global.get $d3dim_lazy_untouched) (i32.const 1)))
      (local.set $untouched (i32.const 1))))
    (call $d3dim_lazy_leave)
    (local.get $untouched))
  (global $d3dim_gpu_desc (mut i32) (i32.const 0))
  (global $d3dim_gpu_scratch (mut i32) (i32.const 0))
  (global $d3dim_gpu_scratch_cap (mut i32) (i32.const 0))
  (func (export "d3dim_gpu_enable") (param $on i32)
    (global.set $d3dim_gpu_on (i32.ne (local.get $on) (i32.const 0))))
  ;; Joins this instance to a host GPU owner shared with cooperative
  ;; siblings. The fence first retires anything this instance still owes
  ;; (including an async-Flip present), so the host can then switch to
  ;; synchronous Flip before a sibling touches the chain.
  (func (export "d3dim_gpu_cooperative_enable")
    (call $d3dim_worker_fence)
    (global.set $d3dim_gpu_cooperative (i32.const 1))
    (global.set $d3dim_gpu_on (i32.const 1)))
  ;; The process render owner describes an immutable queued state snapshot.
  ;; Reset to zero after each GPU batch draw, including exceptional exits.
  (func (export "d3dim_gpu_state_override") (param $state i32)
    (global.set $d3dim_state_override (local.get $state)))

  ;; The seam's one WAT-owned scratch: clear descriptor at +0, describe at +64.
  (func $d3dim_gpu_buffer (result i32)
    (if (i32.eqz (global.get $d3dim_gpu_desc)) (then
      (global.set $d3dim_gpu_desc (call $g2w (call $heap_alloc (i32.const 256))))))
    (global.get $d3dim_gpu_desc))
  (func (export "d3dim_gpu_surface_fmt") (param $entry i32) (result i32)
    (call $dx_surf_fmt_get (local.get $entry)))
  (func (export "d3dim_gpu_surface_live") (param $entry i32) (result i32)
    (if (i32.ge_u (i32.sub (local.get $entry) (global.get $DX_OBJECTS))
          (global.get $DX_OBJECTS_SIZE)) (then (return (i32.const 0))))
    (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2)))

  ;; Result 1: the executor took the clear, and it now owes a fence.
  ;; $tex nonzero is a viewport background image: the colour half becomes that
  ;; texture stretched over the rect, as $viewport_fill_rect_texture paints it.
  ;; Its surface fields ride at +32 in describe's texture order (entry, w, h,
  ;; bpp, pitch, dib_wa, key raw, palette); keyed is always 0, since the
  ;; software fill ignores the colour key too.
  (func $d3dim_gpu_try_clear
    (param $rt i32) (param $flags i32) (param $color i32) (param $z f32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $tex i32) (result i32)
    (local $d i32)
    (local.set $d (call $d3dim_gpu_buffer))
    (call $zero_memory (i32.add (local.get $d) (i32.const 32)) (i32.const 32))
    (if (local.get $tex) (then
      (i32.store offset=32 (local.get $d) (local.get $tex))
      (i32.store offset=36 (local.get $d) (i32.load16_u offset=12 (local.get $tex)))
      (i32.store offset=40 (local.get $d) (i32.load16_u offset=14 (local.get $tex)))
      (i32.store offset=44 (local.get $d) (i32.load16_u offset=16 (local.get $tex)))
      (i32.store offset=48 (local.get $d) (i32.load16_u offset=18 (local.get $tex)))
      (i32.store offset=52 (local.get $d) (i32.load offset=20 (local.get $tex)))
      (i32.store offset=56 (local.get $d) (i32.load offset=24 (local.get $tex)))
      (if (i32.eq (i32.load16_u offset=16 (local.get $tex)) (i32.const 8))
        (then (i32.store offset=60 (local.get $d) (call $dx_surf_pal_get (local.get $tex)))))))
    (i32.store offset=64 (local.get $d) (call $dx_surf_pal_alpha (local.get $tex)))
    (i32.store offset=0 (local.get $d) (local.get $rt))
    (i32.store offset=4 (local.get $d) (i32.and (local.get $flags) (i32.const 3)))
    (i32.store offset=8 (local.get $d) (local.get $color))
    (f32.store offset=12 (local.get $d) (local.get $z))
    (i32.store offset=16 (local.get $d) (local.get $x))
    (i32.store offset=20 (local.get $d) (local.get $y))
    (i32.store offset=24 (local.get $d) (local.get $w))
    (i32.store offset=28 (local.get $d) (local.get $h))
    (if (i32.eqz (call $host_gpu_gl_call (i32.const 0x20004) (local.get $d) (i32.const 0)))
      (then (return (i32.const 0))))
    (global.set $d3dim_worker_pending (i32.const 1))
    (i32.const 1))

  ;; DDBLT_DEPTHFILL on a Z surface attached to a render target: the GPU's
  ;; depth buffer is its own, so the fill Blt writes into the Z DIB never
  ;; reaches it. MW3 resets its reversed GREATEREQUAL buffer to 0 this way
  ;; every frame; left alone, the GPU depth stays at its initial 1.0 and
  ;; every later triangle fails the test. The caller still fills the DIB.
  (func $d3dim_gpu_depth_fill
    (param $z_entry i32) (param $fill i32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32) (result i32)
    (local $parent i32) (local $bits i32) (local $z f32)
    (if (i32.eqz (global.get $d3dim_gpu_on)) (then (return (i32.const 0))))
    (local.set $parent (i32.load offset=4 (call $dx_surf_meta_ptr (local.get $z_entry))))
    (if (i32.or (i32.eqz (local.get $parent))
                (i32.ge_u (local.get $parent) (i32.add (global.get $DX_MAX) (i32.const 1))))
      (then (return (i32.const 0))))
    (local.set $parent (i32.add (global.get $DX_OBJECTS)
      (i32.mul (i32.sub (local.get $parent) (i32.const 1)) (global.get $DX_ENTRY_SIZE))))
    (if (i32.ne (load.field DxObject type (local.get $parent)) (i32.const 2)) (then (return (i32.const 0))))
    (local.set $bits (load.field DxObject bpp (local.get $z_entry)))
    (if (i32.eq (local.get $bits) (i32.const 16))
      (then (local.set $z (f32.div
        (f32.convert_i32_u (i32.and (local.get $fill) (i32.const 0xFFFF)))
        (f32.const 65535))))
      (else (local.set $z (f32.div
        (f32.convert_i32_u (local.get $fill)) (f32.const 4294967295)))))
    (call $d3dim_gpu_try_clear (local.get $parent) (i32.const 2) (i32.const 0) (local.get $z)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0)))

  ;; The draw state of device $this, normalized the way
  ;; $d3dim_draw_tl_triangle_textured reads it, into dwords in the seam
  ;; buffer at +64. Result: that address, or 0 when there is no target or state.
  ;;   0 rt   1 w   2 h   3 bpp   4 pitch   5 dib_wa   6 fmt
  ;;   7 tex  8 tw  9 th  10 tbpp 11 tpitch 12 tdib_wa 13 keyed 14 key raw 15 pal
  ;;   16 zenable 17 zfunc 18 zwrite  19 blend 20 src 21 dst
  ;;   22 colorop 23 alphaop 24 addr u 25 addr v 26 linear 27 cull 28 shade
  ;;   29 alphafunc (0 = test off, else D3DCMPFUNC)  30 alpharef
  ;;   31 vertex fog (FOGENABLE with FOGTABLEMODE NONE)  32 fogcolor  33 wrap
  ;;   34 viewport clip on  35 x0  36 y0  37 x1  38 y1 (exclusive)
  (func (export "d3dim_gpu_describe") (param $this i32) (result i32)
    (local $out i32) (local $rt i32) (local $state i32) (local $tex i32)
    (local $zen i32) (local $zfunc i32) (local $zwrite i32) (local $v i32)
    (local.set $rt (call $d3ddev_rt_entry (local.get $this)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.or (i32.eqz (local.get $rt)) (i32.eqz (local.get $state)))
      (then (return (i32.const 0))))
    (local.set $out (i32.add (call $d3dim_gpu_buffer) (i32.const 64)))
    (call $zero_memory (local.get $out) (i32.const 192))
    (i32.store offset=0 (local.get $out) (local.get $rt))
    (i32.store offset=4 (local.get $out) (i32.load16_u offset=12 (local.get $rt)))
    (i32.store offset=8 (local.get $out) (i32.load16_u offset=14 (local.get $rt)))
    (i32.store offset=12 (local.get $out) (i32.load16_u offset=16 (local.get $rt)))
    (i32.store offset=16 (local.get $out) (i32.load16_u offset=18 (local.get $rt)))
    (i32.store offset=20 (local.get $out) (i32.load offset=20 (local.get $rt)))
    (i32.store offset=24 (local.get $out) (call $dx_surf_fmt_get (local.get $rt)))
    (local.set $tex (call $d3dim_bound_texture_entry (local.get $this)))
    (i32.store offset=28 (local.get $out) (local.get $tex))
    (if (local.get $tex) (then
      (i32.store offset=32 (local.get $out) (i32.load16_u offset=12 (local.get $tex)))
      (i32.store offset=36 (local.get $out) (i32.load16_u offset=14 (local.get $tex)))
      (i32.store offset=40 (local.get $out) (i32.load16_u offset=16 (local.get $tex)))
      (i32.store offset=44 (local.get $out) (i32.load16_u offset=18 (local.get $tex)))
      (i32.store offset=48 (local.get $out) (i32.load offset=20 (local.get $tex)))
      (i32.store offset=52 (local.get $out)
        (i32.and
          (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 420))) (i32.const 0))
          (i32.ne (i32.and (i32.load offset=28 (local.get $tex)) (i32.const 0x100)) (i32.const 0))))
      (i32.store offset=56 (local.get $out) (i32.load offset=24 (local.get $tex)))
      (if (i32.eq (i32.load16_u offset=16 (local.get $tex)) (i32.const 8))
        (then (i32.store offset=60 (local.get $out) (call $dx_surf_pal_get (local.get $tex)))))))
    ;; Depth: ZENABLE, then ZFUNC (default LESSEQUAL) and ZWRITEENABLE.
    ;; ALWAYS without a write is no depth work at all, as in the software path.
    (local.set $zen (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 284))) (i32.const 0)))
    (if (local.get $zen) (then
      (local.set $zfunc (call $gl32 (i32.add (local.get $state) (i32.const 348))))
      (local.set $zwrite (call $gl32 (i32.add (local.get $state) (i32.const 312))))))
    (if (i32.eqz (local.get $zfunc)) (then (local.set $zfunc (i32.const 4))))
    (if (i32.and (i32.eq (local.get $zfunc) (i32.const 8)) (i32.eqz (local.get $zwrite)))
      (then (local.set $zen (i32.const 0))))
    (i32.store offset=64 (local.get $out) (local.get $zen))
    (i32.store offset=68 (local.get $out) (local.get $zfunc))
    (i32.store offset=72 (local.get $out) (i32.ne (local.get $zwrite) (i32.const 0)))
    (i32.store offset=76 (local.get $out)
      (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 364))) (i32.const 0)))
    (local.set $v (call $gl32 (i32.add (local.get $state) (i32.const 332))))
    (i32.store offset=80 (local.get $out) (select (local.get $v) (i32.const 2) (local.get $v)))
    (local.set $v (call $gl32 (i32.add (local.get $state) (i32.const 336))))
    (i32.store offset=84 (local.get $out) (select (local.get $v) (i32.const 1) (local.get $v)))
    (i32.store offset=88 (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 1)))
    (i32.store offset=92 (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 4)))
    (local.set $v (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 13)))
    (i32.store offset=96 (local.get $out) (select (local.get $v) (i32.const 1) (local.get $v)))
    (local.set $v (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 14)))
    (i32.store offset=100 (local.get $out) (select (local.get $v) (i32.const 1) (local.get $v)))
    ;; Keep independent MIN/MAG/MIP selection, including legacy defaults and
    ;; explicit stage NONE. Fields 45-47 extend describe within its 256 bytes.
    (call $d3dim_mip_filters (local.get $state))
    (i32.store offset=104 (local.get $out) (global.get $d3dim_mip_mag))
    (i32.store offset=180 (local.get $out) (i32.add (global.get $d3dim_mip_min) (i32.const 1)))
    (i32.store offset=184 (local.get $out) (i32.add (global.get $d3dim_mip_mag) (i32.const 1)))
    (i32.store offset=188 (local.get $out) (global.get $d3dim_mip_mip))
    (i32.store offset=108 (local.get $out) (call $gl32 (i32.add (local.get $state) (i32.const 344))))
    (i32.store offset=112 (local.get $out) (call $gl32 (i32.add (local.get $state) (i32.const 292))))
    ;; Alpha test, normalized the way $d3dim_draw_tl_triangle_textured reads it:
    ;; ALPHATESTENABLE=15 (offset 316), ALPHAREF=24 (352), ALPHAFUNC=25 (356).
    ;; Published as a bare D3DCMPFUNC because the GPU's fixed-function pixel
    ;; shader compares in exactly that numbering; 0 means no test, so an
    ;; enabled test whose ALPHAFUNC was never set stays off here too.
    (if (call $gl32 (i32.add (local.get $state) (i32.const 316))) (then
      (local.set $v (i32.and (call $gl32 (i32.add (local.get $state) (i32.const 356)))
                             (i32.const 0xFF)))
      (i32.store offset=116 (local.get $out) (local.get $v))
      (i32.store offset=120 (local.get $out)
        (i32.and (call $gl32 (i32.add (local.get $state) (i32.const 352)))
                 (i32.const 0xFF)))))
    (i32.store offset=124 (local.get $out) (i32.and
      (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 368))) (i32.const 0))
      (i32.eqz (call $gl32 (i32.add (local.get $state) (i32.const 396))))))
    (i32.store offset=128 (local.get $out) (call $gl32 (i32.add (local.get $state) (i32.const 392))))
    ;; Field 33: stage-0 WRAPU/WRAPV bits, as $d3dim_wrap_flags reads them.
    (i32.store offset=132 (local.get $out) (call $d3dim_wrap_flags (local.get $state)))
    ;; Fields 34-38: the draw's viewport clip (on, x0, y0, x1, y1 exclusive),
    ;; which the executor applies as a scissor -- the software spans' clip.
    ;; Computed here, not read from the draw scope: the executor describes a
    ;; queued draw later, against its state snapshot, outside any draw.
    (i32.store offset=136 (local.get $out) (call $d3dim_clip_compute (local.get $this)))
    (i32.store offset=140 (local.get $out) (global.get $d3dim_clip_x0))
    (i32.store offset=144 (local.get $out) (global.get $d3dim_clip_y0))
    (i32.store offset=148 (local.get $out) (global.get $d3dim_clip_x1))
    (i32.store offset=152 (local.get $out) (global.get $d3dim_clip_y1))
    (i32.store offset=156 (local.get $out) (call $dx_surf_pal_alpha (local.get $tex)))
    ;; Field 40 is explicit DX7 COLORKEYBLENDENABLE, not an inferred default.
    (i32.store offset=160 (local.get $out)
      (i32.eq (call $gl32 (i32.add (local.get $state) (i32.const 832))) (i32.const 1)))
    ;; Fields 41-44: raw stage-0 arguments, including selector modifiers.
    (i32.store offset=164 (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 2)))
    (i32.store offset=168 (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 3)))
    (i32.store offset=172 (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 5)))
    (i32.store offset=176 (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 6)))
    (local.get $out))

  ;; A validated mip successor and its own upload metadata. Reuses the clear
  ;; part (+0..39) of the seam after JS has copied describe. No guest pointers
  ;; or inferred packed layouts cross the WebGL boundary.
  (func (export "d3dim_gpu_mip_next") (param $tex i32) (result i32)
    (local $n i32) (local $out i32)
    (local.set $n (call $d3dim_mip_next (local.get $tex)))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    ;; A halved depth/flip attachment is not a texture mip image.
    (if (i32.ne (i32.and (i32.load (call $dx_surf_meta_ptr (local.get $n)))
          (i32.const 0x421000)) (i32.const 0x401000))
      (then (return (i32.const 0))))
    (local.set $out (call $d3dim_gpu_buffer))
    (i32.store (local.get $out) (local.get $n))
    (i32.store offset=4 (local.get $out) (load.field DxObject width (local.get $n)))
    (i32.store offset=8 (local.get $out) (load.field DxObject height (local.get $n)))
    (i32.store offset=12 (local.get $out) (load.field DxObject bpp (local.get $n)))
    (i32.store offset=16 (local.get $out) (load.field DxObject pitch (local.get $n)))
    (i32.store offset=20 (local.get $out) (i32.load offset=20 (local.get $n)))
    (i32.store offset=24 (local.get $out) (call $dx_surf_pal_get (local.get $n)))
    (i32.store offset=28 (local.get $out) (call $dx_surf_pal_alpha (local.get $n)))
    (i32.store offset=32 (local.get $out) (i32.load offset=24 (local.get $n)))
    (i32.store offset=36 (local.get $out)
      (i32.ne (i32.and (i32.load offset=28 (local.get $n)) (i32.const 0x100)) (i32.const 0)))
    (local.get $out))

  ;; Texture $tex decoded to RGBA8 bytes in a reused scratch buffer (result is
  ;; its wasm address, 0 when the surface has no pixels). With $keyed, a texel
  ;; matching the source colour key gets alpha 0 for executor discard (mode1),
  ;; or RGBA zero before filtering for explicit COLORKEYBLENDENABLE (mode2).
  ;; Indexed textures compare native indices; truecolor keeps RGB matching.
  ;; DDPCAPS_ALPHA/key precedence remains unresolved, not inferred here.
  (func (export "d3dim_gpu_decode_texture") (param $tex i32) (param $keyed i32) (result i32)
    (local $tw i32) (local $th i32) (local $tbpp i32) (local $tpitch i32) (local $tdib i32)
    (local $tfmt i32) (local $tpal i32) (local $bytes i32) (local $dst i32)
    (local $x i32) (local $y i32) (local $c i32) (local $key i32) (local $key_match i32)
    (if (i32.and (i32.eq (local.get $keyed) (i32.const 2))
          (i32.ne (call $dx_surf_pal_alpha (local.get $tex)) (i32.const 0)))
      (then (unreachable)))
    (local.set $tw (i32.load16_u offset=12 (local.get $tex)))
    (local.set $th (i32.load16_u offset=14 (local.get $tex)))
    (local.set $tbpp (i32.load16_u offset=16 (local.get $tex)))
    (local.set $tpitch (i32.load16_u offset=18 (local.get $tex)))
    (local.set $tdib (i32.load offset=20 (local.get $tex)))
    (if (i32.or (i32.or (i32.eqz (local.get $tw)) (i32.eqz (local.get $th)))
                (i32.or (i32.eqz (local.get $tpitch)) (i32.eqz (local.get $tdib))))
      (then (return (i32.const 0))))
    (local.set $tfmt (call $dx_surf_fmt_get (local.get $tex)))
    (if (i32.eq (local.get $tbpp) (i32.const 8))
      (then (local.set $tpal (call $dx_surf_pal_get (local.get $tex)))))
    (local.set $bytes (i32.shl (i32.mul (local.get $tw) (local.get $th)) (i32.const 2)))
    (if (i32.gt_u (local.get $bytes) (global.get $d3dim_gpu_scratch_cap)) (then
      (if (global.get $d3dim_gpu_scratch)
        (then (call $heap_free (global.get $d3dim_gpu_scratch))))
      (global.set $d3dim_gpu_scratch (call $heap_alloc (local.get $bytes)))
      (global.set $d3dim_gpu_scratch_cap (local.get $bytes))))
    (if (local.get $keyed) (then
      ;; SetColorKey stores a native pixel: for 8bpp this is a palette index.
      (local.set $key (i32.load offset=24 (local.get $tex)))
      (if (i32.ne (local.get $tbpp) (i32.const 8)) (then
        (local.set $key (i32.and (call $d3dim_decode_surface_pixel
          (local.get $tex) (local.get $key) (local.get $tbpp))
          (i32.const 0x00ffffff)))))))
    (local.set $dst (call $g2w (global.get $d3dim_gpu_scratch)))
    (block $ydone (loop $ylp
      (br_if $ydone (i32.ge_u (local.get $y) (local.get $th)))
      (local.set $x (i32.const 0))
      (block $xdone (loop $xlp
        (br_if $xdone (i32.ge_u (local.get $x) (local.get $tw)))
        ;; Compare the index before palette expansion: equal RGB entries may
        ;; have different key membership. Do not read indexed bytes for RGB.
        (if (i32.and (i32.ne (local.get $keyed) (i32.const 0))
                     (i32.eq (local.get $tbpp) (i32.const 8))) (then
          (local.set $key_match (i32.eq (local.get $key)
            (i32.load8_u (i32.add (local.get $tdib)
              (i32.add (i32.mul (local.get $y) (local.get $tpitch)) (local.get $x))))))))
        (local.set $c (call $d3dim_texture_fetch_prepared
          (local.get $tbpp) (local.get $tpitch) (local.get $tdib) (local.get $tfmt) (local.get $tpal) (call $dx_surf_pal_alpha (local.get $tex))
          (local.get $x) (local.get $y)))
        (if (i32.ne (local.get $tbpp) (i32.const 8)) (then
          (local.set $key_match
            (i32.eq (i32.and (local.get $c) (i32.const 0x00ffffff)) (local.get $key)))))
        (if (i32.and (i32.ne (local.get $keyed) (i32.const 0)) (local.get $key_match))
          (then (local.set $c (select (i32.const 0)
            (i32.and (local.get $c) (i32.const 0x00ffffff))
            (i32.eq (local.get $keyed) (i32.const 2))))))
        ;; ARGB value to R,G,B,A bytes.
        (i32.store (local.get $dst)
          (i32.or (i32.and (local.get $c) (i32.const 0xff00ff00))
            (i32.or (i32.and (i32.shr_u (local.get $c) (i32.const 16)) (i32.const 0xff))
                    (i32.shl (i32.and (local.get $c) (i32.const 0xff)) (i32.const 16)))))
        (local.set $dst (i32.add (local.get $dst) (i32.const 4)))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br $xlp)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $ylp)))
    (call $g2w (global.get $d3dim_gpu_scratch)))

  ;; Crash-name strings for unimplemented D3DIM paths live in the high
  ;; WAT-private scratch area so they cannot collide with low system strings
  ;; or sparse VirtualAlloc map state.
  ;; The encompassing sized region makes the memory-map gate account for the
  ;; strings, execute-buffer pointer cache, state blocks, and matrix-used map.
  (global $D3DIM_AUX i32 (region.addr $D3DIM_AUX 0))
  (global $D3DIM_AUX_SIZE i32 (region.size $D3DIM_AUX))
  (data (region.addr $D3DIM_AUX 0) "D3DIM:Execute opcode\00")
  (data (region.addr $D3DIM_AUX 0x20) "D3DIM:DrawPrimitive vtx/prim\00")
  (global $D3DIM_UNIMPL_EXEC_OP i32 (region.addr $D3DIM_AUX 0x00000000))
  (global $D3DIM_UNIMPL_DRAW    i32 (region.addr $D3DIM_AUX 0x00000020))
  (data (region.addr $D3DIM_AUX 0x40) "D3DIM:keyed mip filtering\00")
  ;; One i32 guest pointer per DX_OBJECTS slot ($DX_MAX), keyed by slot. Each
  ;; cached execute buffer block is [buf_guest, buf_size, D3DSTATUS (24
  ;; bytes), original bytes...]. D3DRM reads the status extents back through
  ;; GetExecuteData to decide whether its windowed render target needs another
  ;; primary Blt. (Bytes 0x40..0x840 of $D3DIM_AUX held the old 512-entry
  ;; table and are now unused.)
  (global $D3DIM_EB_CACHE_PTRS i32 (region.addr $D3DIM_EB_CACHE_PTRS 0))
  (global $D3DIM_EB_CACHE_PTRS_SIZE i32 (region.size $D3DIM_EB_CACHE_PTRS))
  (global $D3DIM_EB_CACHE_MAX  i32 (i32.const 16384)) ;; = $DX_MAX
  (global $D3DIM_EB_CACHE_HEADER i32 (i32.const 32))
  ;; D3D7 state blocks: 32 entries × [values_guest, owner_state_guest, token].
  ;; token=0 denotes an open recorder. Values never contain device storage.
  (global $D3DIM_STATEBLOCKS i32 (region.addr $D3DIM_AUX 0x00000840))
  (global $D3DIM_STATEBLOCK_MAX i32 (i32.const 32))
  (global $d3dim_stateblock_serial (mut i32) (i32.const 0))
  (global $d3dim_dbg_vproj_count (mut i32) (i32.const 0))

  ;; D3DSTATS is dwSize followed by five counters.  The software renderer does
  ;; not retain the legacy hardware statistics, so publish a deterministic
  ;; empty sample while preserving the caller-supplied structure size.
  (func $d3dim_get_stats (param $stats_guest i32) (result i32)
    (local $stats i32)
    (if (i32.eqz (local.get $stats_guest))
      (then (return (i32.const 0x80070057)))) ;; DDERR_INVALIDPARAMS
    (local.set $stats (call $g2w (local.get $stats_guest)))
    (memory.fill
      (i32.add (local.get $stats) (i32.const 4))
      (i32.const 0)
      (i32.const 20))
    (i32.const 0))

  ;; Owned typed records: count followed by 112-byte {kind,index,value[104]}.
  ;; No device snapshot, ownership list, mutable indirect pointer or draw scratch.
  ;; Kinds: 0 RS, 1 stage/TSS, 2 transform, 3 material, 4 light parameters,
  ;; 5 light enable, 6 clip plane, 7 viewport, 8 retained texture, 9 derived.
  ;; The finite key space is <1024 records. Allocate before Begin succeeds, so
  ;; recording a valid setter cannot fail half way through a state block.
  (func $d3dim_sb_find (param $this i32) (param $token i32) (result i32)
    (local $owner i32) (local $i i32) (local $block_entry i32)
    (local.set $owner (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $owner)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $D3DIM_STATEBLOCK_MAX)))
      (local.set $block_entry (i32.add (global.get $D3DIM_STATEBLOCKS) (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.and (i32.ne (i32.load (local.get $block_entry)) (i32.const 0))
            (i32.and (i32.eq (i32.load offset=4 (local.get $block_entry)) (local.get $owner))
              (i32.eq (i32.load offset=8 (local.get $block_entry)) (local.get $token))))
        (then (return (local.get $block_entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (i32.const 0))

  (func $d3dim_sb_begin (param $this i32) (result i32)
    (local $i i32) (local $block_entry i32) (local $data i32) (local $owner i32)
    (if (call $d3dim_sb_find (local.get $this) (i32.const 0))
      (then (return (i32.const 0x88760835)))) ;; D3DERR_INBEGINSTATEBLOCK
    (local.set $owner (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $owner)) (then (return (i32.const 0x80070057))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $D3DIM_STATEBLOCK_MAX)))
      (local.set $block_entry (i32.add (global.get $D3DIM_STATEBLOCKS) (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.eqz (i32.load (local.get $block_entry))) (then
        (local.set $data (call $heap_alloc (i32.const 114692)))
        (if (i32.eqz (local.get $data)) (then (return (i32.const 0x8007000e))))
        (call $gs32 (local.get $data) (i32.const 0))
        (i32.store (local.get $block_entry) (local.get $data))
        (i32.store offset=4 (local.get $block_entry) (local.get $owner))
        (i32.store offset=8 (local.get $block_entry) (i32.const 0))
        (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (i32.const 0x8007000e))

  (func $d3dim_sb_end (param $this i32) (param $out i32) (result i32)
    (local $block_entry i32)
    (local.set $block_entry (call $d3dim_sb_find (local.get $this) (i32.const 0)))
    (if (i32.eqz (local.get $block_entry)) (then (return (i32.const 0x88760836))))
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80070057))))
    ;; Tokens are process-unique until exhaustion. Never silently resurrect a
    ;; deleted token or a token whose device allocation has since been reused.
    (if (i32.eq (global.get $d3dim_stateblock_serial) (i32.const -1))
      (then (return (i32.const 0x8007000e))))
    (global.set $d3dim_stateblock_serial (i32.add (global.get $d3dim_stateblock_serial) (i32.const 1)))
    (i32.store offset=8 (local.get $block_entry) (global.get $d3dim_stateblock_serial))
    (call $gs32 (local.get $out) (global.get $d3dim_stateblock_serial))
    (i32.const 0))

  ;; Return a member's guest value address, inserting it on the first write.
  (func $d3dim_sb_member (param $block_entry i32) (param $kind i32) (param $index i32) (result i32)
    (local $data i32) (local $count i32) (local $i i32) (local $record i32)
    (local.set $data (i32.load (local.get $block_entry)))
    (local.set $count (call $gl32 (local.get $data)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $record (i32.add (local.get $data) (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 112)))))
      (if (i32.and (i32.eq (call $gl32 (local.get $record)) (local.get $kind))
            (i32.eq (call $gl32 (i32.add (local.get $record) (i32.const 4))) (local.get $index)))
        (then (return (i32.add (local.get $record) (i32.const 8)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (local.set $record (i32.add (local.get $data) (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 112)))))
    (call $guest_memset (local.get $record) (i32.const 0) (i32.const 112))
    (call $gs32 (local.get $record) (local.get $kind))
    (call $gs32 (i32.add (local.get $record) (i32.const 4)) (local.get $index))
    (call $gs32 (local.get $data) (i32.add (local.get $count) (i32.const 1)))
    (i32.add (local.get $record) (i32.const 8)))

  ;; Intercept only documented recordable setters, after their argument checks.
  ;; scalar for size=0, immediate copy of the caller's bytes otherwise.
  (func $d3dim_sb_record (param $this i32) (param $kind i32) (param $index i32)
      (param $value i32) (param $size i32) (result i32)
    (local $block_entry i32) (local $dst i32)
    (local.set $block_entry (call $d3dim_sb_find (local.get $this) (i32.const 0)))
    (if (i32.eqz (local.get $block_entry)) (then (return (i32.const 0))))
    ;; WORLD1..3/blended transforms are not implemented by this renderer.
    ;; Never record its fallback composite/scratch slot as a transform value.
    (if (i32.and (i32.eq (local.get $kind) (i32.const 2))
          (i32.eqz (i32.or
            (i32.le_u (i32.sub (local.get $index) (i32.const 1)) (i32.const 2))
            (i32.le_u (i32.sub (local.get $index) (i32.const 16)) (i32.const 7)))))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (return (i32.const 1))))
    (local.set $dst (call $d3dim_sb_member (local.get $block_entry) (local.get $kind) (local.get $index)))
    (if (i32.eq (local.get $kind) (i32.const 8)) (then
      ;; Retain the resource, without asserting native state-block AddRef counts.
      ;; Acquire first: replacing a member with itself must remain safe.
      (if (local.get $value) (then (drop (call $dx_com_addref (local.get $value)))))
      (if (call $gl32 (local.get $dst))
        (then (drop (call $dx_surface_release (call $gl32 (local.get $dst))))))))
    (if (local.get $size)
      (then (call $guest_memmove (local.get $dst) (local.get $value) (local.get $size)))
      (else (call $gs32 (local.get $dst) (local.get $value))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.const 1))

  (func $d3dim_sb_retire (param $block_entry i32)
    (local $data i32) (local $i i32) (local $count i32) (local $r i32)
    (local.set $data (i32.load (local.get $block_entry)))
    (local.set $count (call $gl32 (local.get $data)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $r (i32.add (local.get $data) (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 112)))))
      (if (i32.and (i32.eq (call $gl32 (local.get $r)) (i32.const 8))
            (i32.ne (call $gl32 (i32.add (local.get $r) (i32.const 8))) (i32.const 0)))
        (then (drop (call $dx_surface_release (call $gl32 (i32.add (local.get $r) (i32.const 8)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (call $zero_memory (local.get $block_entry) (i32.const 12))
    (call $heap_free (local.get $data)))

  (func $d3dim_sb_destroy_device (param $owner i32)
    (local $block_entry i32) (local $i i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $D3DIM_STATEBLOCK_MAX)))
      (local.set $block_entry (i32.add (global.get $D3DIM_STATEBLOCKS) (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.and (i32.ne (i32.load (local.get $block_entry)) (i32.const 0))
            (i32.eq (i32.load offset=4 (local.get $block_entry)) (local.get $owner)))
        (then (call $d3dim_sb_retire (local.get $block_entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan))))

  ;; Capture and Apply share the identical fixed membership walk. Apply uses
  ;; ordinary setters so derived state follows selected state changes only.
  (func $d3dim_sb_transfer (param $this i32) (param $block_entry i32) (param $apply i32)
    (local $data i32) (local $count i32) (local $i i32) (local $record i32)
    (local $kind i32) (local $index i32) (local $value i32)
    (local $blend i32) (local $has_blend i32) (local $mip i32) (local $has_mip i32) (local $previous i32)
    (local.set $data (i32.load (local.get $block_entry)))
    (local.set $count (call $gl32 (local.get $data)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $record (i32.add (local.get $data) (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 112)))))
      (local.set $kind (call $gl32 (local.get $record)))
      (local.set $index (call $gl32 (i32.add (local.get $record) (i32.const 4))))
      (local.set $value (i32.add (local.get $record) (i32.const 8)))
      (if (i32.eq (local.get $kind) (i32.const 0)) (then
        (if (local.get $apply)
          (then (call $d3dim_set_render_state (local.get $this) (local.get $index) (call $gl32 (local.get $value))))
          (else (call $d3dim_get_render_state (local.get $this) (local.get $index) (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 1)) (then
        (if (local.get $apply)
          (then (call $d3dim_set_tss (local.get $this) (i32.shr_u (local.get $index) (i32.const 5)) (i32.and (local.get $index) (i32.const 31)) (call $gl32 (local.get $value))))
          (else (call $d3dim_get_tss (local.get $this) (i32.shr_u (local.get $index) (i32.const 5)) (i32.and (local.get $index) (i32.const 31)) (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 2)) (then
        (if (local.get $apply)
          (then (call $d3dim_set_transform (local.get $this) (local.get $index) (local.get $value)))
          (else (call $d3dim_get_transform (local.get $this) (local.get $index) (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 3)) (then
        (if (local.get $apply)
          (then (call $d3dim_device7_set_material (local.get $this)  (local.get $value)))
          (else (call $d3dim_device7_get_material (local.get $this)  (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 4)) (then
        (if (local.get $apply)
          (then (call $d3dim_device7_set_light (local.get $this) (local.get $index) (local.get $value)))
          (else (call $d3dim_device7_get_light (local.get $this) (local.get $index) (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 5)) (then
        (if (local.get $apply)
          (then (call $d3dim_device7_light_enable (local.get $this) (local.get $index) (call $gl32 (local.get $value))))
          (else (call $d3dim_device7_get_light_enable (local.get $this) (local.get $index) (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 6)) (then
        (if (local.get $apply)
          (then (call $d3dim_device7_set_clip_plane (local.get $this) (local.get $index) (local.get $value)))
          (else (call $d3dim_device7_get_clip_plane (local.get $this) (local.get $index) (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 7)) (then
        (if (local.get $apply)
          (then (call $d3dim_device7_set_viewport (local.get $this)  (local.get $value)))
          (else (call $d3dim_device7_get_viewport (local.get $this)  (local.get $value))))))
      (if (i32.eq (local.get $kind) (i32.const 8)) (then
        (if (local.get $apply)
          (then (call $d3dim_set_texture (local.get $this) (i32.const 0) (call $gl32 (local.get $value))))
          (else
            (local.set $previous (call $gl32 (local.get $value)))
            (call $d3dim_get_texture (local.get $this) (i32.const 0) (local.get $value))
            (if (local.get $previous)
              (then (drop (call $dx_surface_release (local.get $previous)))))))))
      (if (i32.eq (local.get $kind) (i32.const 9)) (then
        (if (local.get $apply)
          (then (if (local.get $index)
            (then (local.set $mip (call $gl32 (local.get $value))) (local.set $has_mip (i32.const 1)))
            (else (local.set $blend (call $gl32 (local.get $value))) (local.set $has_blend (i32.const 1)))))
          (else (call $gs32 (local.get $value)
            (call $gl32 (i32.add (call $d3ddev_state (local.get $this))
              (i32.add (i32.const 3936) (i32.shl (local.get $index) (i32.const 2))))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    ;; These effective-state markers describe selected raw states. Restore them
    ;; after setter replay, so key insertion order cannot override last-write.
    (if (local.get $has_blend) (then (call $gs32
      (i32.add (call $d3ddev_state (local.get $this)) (i32.const 3936)) (local.get $blend))))
    (if (local.get $has_mip) (then (call $gs32
      (i32.add (call $d3ddev_state (local.get $this)) (i32.const 3940)) (local.get $mip)))))

  ;; Allocate selected indirect destinations before changing any member value.
  (func $d3dim_sb_prepare (param $this i32) (param $block_entry i32) (param $apply i32) (result i32)
    (local $data i32) (local $i i32) (local $count i32) (local $r i32)
    (local $kind i32) (local $index i32) (local $state i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $data (i32.load (local.get $block_entry)))
    (local.set $count (call $gl32 (local.get $data)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $r (i32.add (local.get $data) (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 112)))))
      (local.set $kind (call $gl32 (local.get $r)))
      (local.set $index (call $gl32 (i32.add (local.get $r) (i32.const 4))))
      (if (i32.or (i32.and (i32.eq (local.get $kind) (i32.const 2)) (i32.ge_u (local.get $index) (i32.const 16)))
            (i32.and (i32.eq (local.get $kind) (i32.const 1)) (i32.eq (i32.and (local.get $index) (i32.const 31)) (i32.const 24))))
        (then (if (i32.eqz (call $d3dim_tex_block (local.get $state))) (then (return (i32.const 0x8007000e))))))
      (if (i32.and (i32.ne (local.get $apply) (i32.const 0)) (i32.eq (local.get $kind) (i32.const 4)))
        (then (if (i32.eqz (call $d3dim_device7_light_table (local.get $state))) (then (return (i32.const 0x8007000e))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
    (i32.const 0))

  (func $d3dim_sb_operation (param $this i32) (param $token i32) (param $op i32) (result i32)
    (local $block_entry i32) (local $hr i32)
    (if (call $d3dim_sb_find (local.get $this) (i32.const 0))
      (then (return (i32.const 0x88760835))))
    (if (i32.eqz (local.get $token)) (then (return (i32.const 0x88760834))))
    (local.set $block_entry (call $d3dim_sb_find (local.get $this) (local.get $token)))
    (if (i32.eqz (local.get $block_entry)) (then (return (i32.const 0x88760834))))
    (if (i32.eq (local.get $op) (i32.const 2))
      (then (call $d3dim_sb_retire (local.get $block_entry)))
      (else
        (local.set $hr (call $d3dim_sb_prepare (local.get $this) (local.get $block_entry) (local.get $op)))
        (if (local.get $hr) (then (return (local.get $hr))))
        (call $d3dim_sb_transfer (local.get $this) (local.get $block_entry) (local.get $op))))
    (i32.const 0))

  (func $d3dim_sb_predefined_member (param $type i32) (param $kind i32) (param $index i32) (result i32)
    ;; ALL uses the DX7 TSS enum, excluding the compact array's unused slot 0.
    (if (i32.and (i32.eq (local.get $type) (i32.const 1))
          (i32.eq (local.get $kind) (i32.const 1)))
      (then (return (i32.le_u (i32.sub (local.get $index) (i32.const 1)) (i32.const 23)))))
    (if (i32.eq (local.get $type) (i32.const 1)) (then
      (if (i32.eqz (local.get $kind)) (then (return (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 2)) (i32.eq (local.get $index) (i32.const 4))) (i32.or (i32.eq (local.get $index) (i32.const 7)) (i32.eq (local.get $index) (i32.const 8)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 9)) (i32.eq (local.get $index) (i32.const 10))) (i32.or (i32.eq (local.get $index) (i32.const 14)) (i32.eq (local.get $index) (i32.const 15))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 16)) (i32.eq (local.get $index) (i32.const 19))) (i32.or (i32.eq (local.get $index) (i32.const 20)) (i32.eq (local.get $index) (i32.const 22)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 23)) (i32.eq (local.get $index) (i32.const 24))) (i32.or (i32.eq (local.get $index) (i32.const 25)) (i32.eq (local.get $index) (i32.const 26)))))) (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 27)) (i32.eq (local.get $index) (i32.const 28))) (i32.or (i32.eq (local.get $index) (i32.const 29)) (i32.eq (local.get $index) (i32.const 30)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 33)) (i32.eq (local.get $index) (i32.const 34))) (i32.or (i32.eq (local.get $index) (i32.const 35)) (i32.eq (local.get $index) (i32.const 36))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 37)) (i32.eq (local.get $index) (i32.const 38))) (i32.or (i32.eq (local.get $index) (i32.const 40)) (i32.eq (local.get $index) (i32.const 41)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 47)) (i32.eq (local.get $index) (i32.const 48))) (i32.or (i32.eq (local.get $index) (i32.const 52)) (i32.eq (local.get $index) (i32.const 53))))))) (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 54)) (i32.eq (local.get $index) (i32.const 55))) (i32.or (i32.eq (local.get $index) (i32.const 56)) (i32.eq (local.get $index) (i32.const 57)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 58)) (i32.eq (local.get $index) (i32.const 59))) (i32.or (i32.eq (local.get $index) (i32.const 60)) (i32.eq (local.get $index) (i32.const 128))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 129)) (i32.eq (local.get $index) (i32.const 130))) (i32.or (i32.eq (local.get $index) (i32.const 131)) (i32.eq (local.get $index) (i32.const 132)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 133)) (i32.eq (local.get $index) (i32.const 134))) (i32.or (i32.eq (local.get $index) (i32.const 135)) (i32.eq (local.get $index) (i32.const 136)))))) (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 137)) (i32.eq (local.get $index) (i32.const 138))) (i32.or (i32.eq (local.get $index) (i32.const 139)) (i32.eq (local.get $index) (i32.const 140)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 141)) (i32.eq (local.get $index) (i32.const 142))) (i32.or (i32.eq (local.get $index) (i32.const 143)) (i32.eq (local.get $index) (i32.const 144))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 145)) (i32.eq (local.get $index) (i32.const 146))) (i32.or (i32.eq (local.get $index) (i32.const 147)) (i32.eq (local.get $index) (i32.const 148)))) (i32.or (i32.eq (local.get $index) (i32.const 151)) (i32.eq (local.get $index) (i32.const 152))))))))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $type) (i32.const 2)) (then
      (if (i32.eq (local.get $kind) (i32.const 0)) (then (return (i32.or (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 2)) (i32.eq (local.get $index) (i32.const 4))) (i32.or (i32.eq (local.get $index) (i32.const 7)) (i32.eq (local.get $index) (i32.const 8)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 9)) (i32.eq (local.get $index) (i32.const 10))) (i32.or (i32.eq (local.get $index) (i32.const 14)) (i32.eq (local.get $index) (i32.const 15))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 16)) (i32.eq (local.get $index) (i32.const 19))) (i32.or (i32.eq (local.get $index) (i32.const 20)) (i32.eq (local.get $index) (i32.const 23)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 24)) (i32.eq (local.get $index) (i32.const 25))) (i32.or (i32.eq (local.get $index) (i32.const 26)) (i32.eq (local.get $index) (i32.const 27)))))) (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 33)) (i32.eq (local.get $index) (i32.const 36))) (i32.or (i32.eq (local.get $index) (i32.const 37)) (i32.eq (local.get $index) (i32.const 38)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 40)) (i32.eq (local.get $index) (i32.const 41))) (i32.or (i32.eq (local.get $index) (i32.const 47)) (i32.eq (local.get $index) (i32.const 52))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 53)) (i32.eq (local.get $index) (i32.const 54))) (i32.or (i32.eq (local.get $index) (i32.const 55)) (i32.eq (local.get $index) (i32.const 56)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 57)) (i32.eq (local.get $index) (i32.const 58))) (i32.or (i32.eq (local.get $index) (i32.const 59)) (i32.eq (local.get $index) (i32.const 60))))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 128)) (i32.eq (local.get $index) (i32.const 129))) (i32.or (i32.eq (local.get $index) (i32.const 130)) (i32.eq (local.get $index) (i32.const 131)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 132)) (i32.eq (local.get $index) (i32.const 133))) (i32.or (i32.eq (local.get $index) (i32.const 134)) (i32.eq (local.get $index) (i32.const 135)))))))))
      (if (i32.eq (local.get $kind) (i32.const 1)) (then (return (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 1)) (i32.eq (local.get $index) (i32.const 2))) (i32.or (i32.eq (local.get $index) (i32.const 3)) (i32.eq (local.get $index) (i32.const 4)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 5)) (i32.eq (local.get $index) (i32.const 6))) (i32.or (i32.eq (local.get $index) (i32.const 7)) (i32.eq (local.get $index) (i32.const 8))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 9)) (i32.eq (local.get $index) (i32.const 10))) (i32.or (i32.eq (local.get $index) (i32.const 11)) (i32.eq (local.get $index) (i32.const 12)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 13)) (i32.eq (local.get $index) (i32.const 14))) (i32.or (i32.eq (local.get $index) (i32.const 15)) (i32.eq (local.get $index) (i32.const 16)))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 17)) (i32.eq (local.get $index) (i32.const 18))) (i32.or (i32.eq (local.get $index) (i32.const 19)) (i32.eq (local.get $index) (i32.const 20)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 21)) (i32.eq (local.get $index) (i32.const 22))) (i32.or (i32.eq (local.get $index) (i32.const 23)) (i32.eq (local.get $index) (i32.const 24)))))))))
    ))
    (if (i32.eq (local.get $type) (i32.const 3)) (then
      (if (i32.eq (local.get $kind) (i32.const 0)) (then (return (i32.or (i32.or (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 9)) (i32.eq (local.get $index) (i32.const 22))) (i32.or (i32.eq (local.get $index) (i32.const 28)) (i32.eq (local.get $index) (i32.const 29)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 34)) (i32.eq (local.get $index) (i32.const 35))) (i32.or (i32.eq (local.get $index) (i32.const 36)) (i32.eq (local.get $index) (i32.const 37))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 38)) (i32.eq (local.get $index) (i32.const 48))) (i32.or (i32.eq (local.get $index) (i32.const 136)) (i32.eq (local.get $index) (i32.const 137)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 138)) (i32.eq (local.get $index) (i32.const 139))) (i32.or (i32.eq (local.get $index) (i32.const 140)) (i32.eq (local.get $index) (i32.const 141)))))) (i32.or (i32.or (i32.or (i32.eq (local.get $index) (i32.const 142)) (i32.eq (local.get $index) (i32.const 143))) (i32.or (i32.eq (local.get $index) (i32.const 145)) (i32.eq (local.get $index) (i32.const 146)))) (i32.or (i32.or (i32.eq (local.get $index) (i32.const 147)) (i32.eq (local.get $index) (i32.const 148))) (i32.or (i32.eq (local.get $index) (i32.const 151)) (i32.eq (local.get $index) (i32.const 152)))))))))
      (if (i32.eq (local.get $kind) (i32.const 1)) (then (return (i32.or (i32.eq (local.get $index) (i32.const 11)) (i32.eq (local.get $index) (i32.const 24))))))
      (return (i32.or (i32.eq (local.get $kind) (i32.const 2)) (i32.or (i32.eq (local.get $kind) (i32.const 5)) (i32.eq (local.get $kind) (i32.const 6)))))
    ))
    (i32.const 0))

  (func $d3dim_sb_create (param $this i32) (param $type i32) (param $out i32) (result i32)
    (local $hr i32) (local $block_entry i32) (local $kind i32) (local $index i32)
    (local $limit i32) (local $stage i32)
    (if (call $d3dim_sb_find (local.get $this) (i32.const 0))
      (then (return (i32.const 0x88760835))))
    (if (i32.or (i32.eqz (local.get $out))
          (i32.gt_u (i32.sub (local.get $type) (i32.const 1)) (i32.const 2)))
      (then (return (i32.const 0x80070057))))
    (local.set $hr (call $d3dim_sb_begin (local.get $this)))
    (if (local.get $hr) (then (return (local.get $hr))))
    (local.set $block_entry (call $d3dim_sb_find (local.get $this) (i32.const 0)))
    ;; All three DX7 groups include texture transform flags; allocate before
    ;; the address resolver can turn allocation failure into missing membership.
    (if (i32.eqz (call $d3dim_tex_block (call $d3ddev_state (local.get $this)))) (then
      (call $d3dim_sb_retire (local.get $block_entry)) (return (i32.const 0x8007000e))))
    (block $done (loop $kinds
      (br_if $done (i32.ge_u (local.get $kind) (i32.const 9)))
      (local.set $limit (i32.const 1))
      (if (i32.eqz (local.get $kind)) (then (local.set $limit (i32.const 512))))
      (if (i32.eq (local.get $kind) (i32.const 1)) (then (local.set $limit (i32.const 32))))
      (if (i32.eq (local.get $kind) (i32.const 2)) (then (local.set $limit (i32.const 24))))
      (if (i32.eq (local.get $kind) (i32.const 4)) (then (local.set $limit (i32.const 8))))
      (if (i32.eq (local.get $kind) (i32.const 5)) (then (local.set $limit (i32.const 32))))
      (if (i32.eq (local.get $kind) (i32.const 6)) (then (local.set $limit (i32.const 6))))
      (local.set $index (i32.const 0))
      (block $next (loop $indices
        (br_if $next (i32.ge_u (local.get $index) (local.get $limit)))
        (if (i32.and (i32.or (i32.ne (local.get $kind) (i32.const 5))
              (i32.ne (i32.and (call $gl32 (i32.add (call $d3ddev_state (local.get $this)) (i32.const 3952)))
                (i32.shl (i32.const 1) (local.get $index))) (i32.const 0)))
            (i32.and (i32.or (i32.ne (local.get $kind) (i32.const 4))
              (i32.ne (i32.and (call $gl32 (i32.add (call $d3ddev_state (local.get $this)) (i32.const 3948)))
                (i32.shl (i32.const 1) (local.get $index))) (i32.const 0)))
            (i32.and (call $d3dim_sb_predefined_member (local.get $type) (local.get $kind) (local.get $index))
              (i32.or (i32.ne (local.get $kind) (i32.const 2))
                (i32.or (i32.and (i32.ge_u (local.get $index) (i32.const 1)) (i32.le_u (local.get $index) (i32.const 3)))
                  (i32.ge_u (local.get $index) (i32.const 16))))))) (then
          (if (i32.eq (local.get $kind) (i32.const 1))
            (then
              (local.set $stage (i32.const 0))
              (block $stages_done (loop $stages
                (br_if $stages_done (i32.ge_u (local.get $stage) (i32.const 8)))
                (if (call $d3dim_tss_addr (call $d3ddev_state (local.get $this)) (local.get $stage) (local.get $index))
                  (then (drop (call $d3dim_sb_member (local.get $block_entry) (local.get $kind)
                    (i32.or (i32.shl (local.get $stage) (i32.const 5)) (local.get $index))))))
                (local.set $stage (i32.add (local.get $stage) (i32.const 1))) (br $stages))))
            (else (drop (call $d3dim_sb_member (local.get $block_entry) (local.get $kind) (local.get $index)))))))
        (local.set $index (i32.add (local.get $index) (i32.const 1))) (br $indices)))
      (local.set $kind (i32.add (local.get $kind) (i32.const 1))) (br $kinds)))
    (if (i32.ne (local.get $type) (i32.const 3)) (then
      (drop (call $d3dim_sb_member (local.get $block_entry) (i32.const 9) (i32.const 0)))
      (drop (call $d3dim_sb_member (local.get $block_entry) (i32.const 9) (i32.const 1)))))
    (call $d3dim_sb_transfer (local.get $this) (local.get $block_entry) (i32.const 0))
    (local.set $hr (call $d3dim_sb_end (local.get $this) (local.get $out)))
    (if (local.get $hr) (then (call $d3dim_sb_retire (local.get $block_entry))))
    (local.get $hr))

  ;; ── QueryInterface upgrade routing ────────────────────────────
  ;; Return a matching interface wrapper and AddRef its DX_OBJECTS slot.
  ;; Roots and child-core families validate complete IIDs; legacy device,
  ;; texture and vertex-buffer routing below still needs the same audit.
  ;;
  ;; family: 1=D3D, 2=Device, 3=Viewport,
  ;;         4=Material, 5=Texture, 6=VertexBuffer
  ;;
  ;; Returns S_OK (0) on match (and writes ppvObj), E_NOINTERFACE (0x80004002)
  ;; on miss (and writes NULL to ppvObj).
  ;; Microsoft d3d.h child identities: family 3=viewport, 4=material,
  ;; 7=light, 8=execute buffer.
  ;; Share span/identity/refcount ownership, but never cross the family ABI.
  (func $d3dim_child_qi (param $family i32) (param $this i32) (param $riid i32) (param $out i32) (result i32)
    (local $iid i32) (local $unknown i32) (local $vtbl i32) (local $entry i32) (local $obj i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x80004003))))
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $riid)) (then (return (i32.const 0x80004003))))
    (local.set $iid (call $guest_span_in (local.get $riid) (i32.const 16)))
    (local.set $unknown (call $guid_words_equal (local.get $iid)
      (i32.const 0) (i32.const 0) (i32.const 0xC0) (i32.const 0x46000000)))
    (if (i32.eq (local.get $family) (i32.const 3)) (then
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0x4417C146) (i32.const 0x11CF33AD) (i32.const 0x00006F81) (i32.const 0x6E1520C0))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DVP1))))
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0x93281500) (i32.const 0x11D08CF8) (i32.const 0xA000AB89) (i32.const 0x294105C9))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DVP2))))
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0xB0AB3B61) (i32.const 0x11D133D7) (i32.const 0xC00081A9) (i32.const 0x74B1D74F))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DVP3))))))
    (if (i32.eq (local.get $family) (i32.const 4)) (then
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0x4417C144) (i32.const 0x11CF33AD) (i32.const 0x00006F81) (i32.const 0x6E1520C0))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DMAT1))))
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0x93281503) (i32.const 0x11D08CF8) (i32.const 0xA000AB89) (i32.const 0x294105C9))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DMAT2))))
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0xCA9C46F4) (i32.const 0x11D1D3C5) (i32.const 0x60005AB7) (i32.const 0x12B35208))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DMAT3))))))
    (if (i32.eq (local.get $family) (i32.const 7)) (then
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0x4417C142) (i32.const 0x11CF33AD) (i32.const 0x00006F81) (i32.const 0x6E1520C0))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DLIGHT))))))
    (if (i32.eq (local.get $family) (i32.const 8)) (then
      (if (call $guid_words_equal (local.get $iid)
            (i32.const 0x4417C145) (i32.const 0x11CF33AD) (i32.const 0x00006F81) (i32.const 0x6E1520C0))
        (then (local.set $vtbl (global.get $DX_VTBL_D3DEXEC))))))
    (call $guest_span_release (local.get $iid) (i32.const 16))
    (if (i32.and (i32.eqz (local.get $unknown)) (i32.eqz (local.get $vtbl)))
      (then (return (i32.const 0x80004002))))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (local.get $unknown)
      (then (local.set $obj (call $d3dim_primary_guest (local.get $entry))))
      (else (local.set $obj (call $dx_get_wrapper_for_vtbl (call $dx_slot_of (local.get $entry)) (local.get $vtbl)))))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0x8007000E))))
    (store.field DxObject refcount (local.get $entry)
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.const 0))

  (func $d3dim_qi (param $family i32) (param $this i32) (param $riid i32) (param $ppvObj i32) (result i32)
    (local $iid0 i32) (local $entry i32) (local $vtbl i32) (local $obj_wa i32)
    (local $iid_wa i32) (local $kind i32)
    (local $i i32) (local $ptr i32) (local $ddraw_guest i32)
    (local $saved_sp i32) (local $saved_ax i32) (local $surface_hr i32)
    ;; A texture is another view of the same surface. Use the surface's full
    ;; IID/version/refcount route instead of mapping every surface to v2.
    (if (i32.eq (local.get $family) (i32.const 5)) (then
      (local.set $saved_sp (i32.load offset=16 (global.get $reg_base)))
      (local.set $saved_ax (i32.load (global.get $reg_base)))
      (call $handle_IDirectDrawSurface_QueryInterface (local.get $this) (local.get $riid)
        (local.get $ppvObj) (i32.const 0) (i32.const 0) (i32.const 0))
      (local.set $surface_hr (i32.load (global.get $reg_base)))
      (i32.store offset=16 (global.get $reg_base) (local.get $saved_sp))
      (i32.store (global.get $reg_base) (local.get $saved_ax))
      (return (local.get $surface_hr))))
    (if (i32.or (i32.eq (local.get $family) (i32.const 3)) (i32.eq (local.get $family) (i32.const 4)))
      (then (return (call $d3dim_child_qi (local.get $family) (local.get $this) (local.get $riid) (local.get $ppvObj)))))
    ;; Sanity: NULL ppvObj ⇒ E_POINTER
    (if (i32.eqz (local.get $ppvObj)) (then (return (i32.const 0x80004003))))
    ;; Root interfaces share the complete identity classifier with DirectDraw.
    ;; Acquire once: a caller's GUID can straddle nonadjacent sparse pages.
    ;; Release the temporary span before any return or ownership change.
    (if (i32.eq (local.get $family) (i32.const 1))
      (then
        (call $gs32 (local.get $ppvObj) (i32.const 0))
        (if (i32.eqz (local.get $riid)) (then (return (i32.const 0x80004003))))
        (local.set $iid_wa (call $guest_span_in (local.get $riid) (i32.const 16)))
        (local.set $kind (call $ddraw_iid_kind_wa (local.get $iid_wa)))
        (local.set $iid0 (i32.load (local.get $iid_wa)))
        (call $guest_span_release (local.get $iid_wa) (i32.const 16))
        ;; Preserve the supported root set: IUnknown, DDraw1, D3D1/2/3/7.
        (if (i32.or (i32.eqz (local.get $kind))
              (i32.and (i32.ge_u (local.get $kind) (i32.const 3))
                       (i32.le_u (local.get $kind) (i32.const 5))))
          (then (return (i32.const 0x80004002))))
        (if (i32.eq (local.get $kind) (i32.const 1))
          (then
            (local.set $entry (call $dx_from_this (local.get $this)))
            (call $gs32 (local.get $ppvObj) (call $d3dim_primary_guest (local.get $entry)))
            (store.field DxObject refcount (local.get $entry)
              (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
            (return (i32.const 0)))))
      (else
        ;; Other interface families still need their own complete-IID audit.
        (local.set $iid0 (call $gl32 (local.get $riid)))))
    ;; Pick target vtable by family + IID-first-DWORD.
    (local.set $vtbl (i32.const 0))
    ;; Always honor IID_IUnknown (00000000-0000-0000-...) by returning the
    ;; same vtable currently bound to `this`.
    (if (i32.eqz (local.get $iid0)) (then
      (local.set $obj_wa (call $g2w (local.get $this)))
      (local.set $vtbl (i32.load (local.get $obj_wa)))))
    ;; D3D family → IID_IDirectDraw (0x6C14DB80): return the parent DDraw.
    ;; Priority 1: read the parent DDraw slot linked at entry+8 (set by
    ;; IDirectDraw::QI when the child D3D was created). This is exact and
    ;; survives Release cycles that would have zeroed the parent's type field.
    ;; Priority 2 fallback: scan DX_OBJECTS for any type=1 (DDraw) entry.
    (if (i32.and (i32.eq (local.get $family) (i32.const 1))
                 (i32.eq (local.get $iid0) (i32.const 0x6C14DB80))) (then
      (local.set $entry (call $dx_from_this (local.get $this)))
      (local.set $i (load.field DxObject misc0 (local.get $entry)))
      (if (i32.ne (local.get $i) (i32.const 0)) (then
        (local.set $ptr (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $i) (i32.const 32))))
        (i32.store (i32.add (local.get $ptr) (i32.const 4))
          (i32.add (i32.load (i32.add (local.get $ptr) (i32.const 4))) (i32.const 1)))
        (local.set $ddraw_guest (i32.add
          (i32.sub (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $i) (i32.const 8)))
                   (global.get $GUEST_BASE))
          (global.get $image_base)))
        (call $gs32 (local.get $ppvObj) (local.get $ddraw_guest))
        (return (i32.const 0))))
      (local.set $i (i32.const 0))
      (block $done (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
        (local.set $ptr (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $i) (i32.const 32))))
        (if (i32.eq (i32.load (local.get $ptr)) (i32.const 1)) (then
          ;; AddRef the DDraw entry and return its wrapper guest ptr.
          (i32.store (i32.add (local.get $ptr) (i32.const 4))
            (i32.add (i32.load (i32.add (local.get $ptr) (i32.const 4))) (i32.const 1)))
          (local.set $ddraw_guest (i32.add
            (i32.sub (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $i) (i32.const 8)))
                     (global.get $GUEST_BASE))
            (global.get $image_base)))
          (call $gs32 (local.get $ppvObj) (local.get $ddraw_guest))
          (return (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
      ;; No DDraw found — fall through to E_NOINTERFACE below.
    ))
    (if (i32.eq (local.get $family) (i32.const 1)) (then
      ;; D3D family
      (if (i32.eq (local.get $iid0) (i32.const 0x3BBA0080)) (then (local.set $vtbl (global.get $DX_VTBL_D3D))))
      (if (i32.eq (local.get $iid0) (i32.const 0x6AAE1EC1)) (then (local.set $vtbl (global.get $DX_VTBL_D3D2))))
      (if (i32.eq (local.get $iid0) (i32.const 0xBB223240)) (then (local.set $vtbl (global.get $DX_VTBL_D3D3))))
      (if (i32.eq (local.get $iid0) (i32.const 0xF5049E77)) (then (local.set $vtbl (global.get $DX_VTBL_D3D7))))))
    ;; Device family → IID_IDirectDrawSurface (0x6C14DB81): return the render
    ;; target surface that was bound at CreateDevice time. d3drm.dll asks for
    ;; this to introspect the back buffer; failing it causes a NULL-vtable
    ;; Release crash in the caller's cleanup path.
    (if (i32.and (i32.eq (local.get $family) (i32.const 2))
                 (i32.eq (local.get $iid0) (i32.const 0x6C14DB81))) (then
      (local.set $entry (call $dx_from_this (local.get $this)))
      (local.set $i (load.field DxObject misc0 (local.get $entry))) ;; rt_slot
      (if (i32.ne (local.get $i) (i32.const 0)) (then
        (local.set $ptr (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $i) (i32.const 32))))
        (if (i32.ne (i32.load (local.get $ptr)) (i32.const 0)) (then
          (local.set $ddraw_guest (i32.add
            (i32.sub (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $i) (i32.const 8)))
                     (global.get $GUEST_BASE))
            (global.get $image_base)))
          (local.set $saved_sp (i32.load offset=16 (global.get $reg_base)))
          (local.set $saved_ax (i32.load (global.get $reg_base)))
          (call $handle_IDirectDrawSurface_QueryInterface (local.get $ddraw_guest) (local.get $riid)
            (local.get $ppvObj) (i32.const 0) (i32.const 0) (i32.const 0))
          (local.set $surface_hr (i32.load (global.get $reg_base)))
          (i32.store offset=16 (global.get $reg_base) (local.get $saved_sp))
          (i32.store (global.get $reg_base) (local.get $saved_ax))
          (return (local.get $surface_hr))))))))
    (if (i32.eq (local.get $family) (i32.const 2)) (then
      ;; Device family
      (if (i32.eq (local.get $iid0) (i32.const 0x64108800)) (then (local.set $vtbl (global.get $DX_VTBL_D3DDEV1))))
      (if (i32.eq (local.get $iid0) (i32.const 0x93281501)) (then (local.set $vtbl (global.get $DX_VTBL_D3DDEV2))))
      (if (i32.eq (local.get $iid0) (i32.const 0xB0AB3B60)) (then (local.set $vtbl (global.get $DX_VTBL_D3DDEV3))))
      (if (i32.eq (local.get $iid0) (i32.const 0xF5049E79)) (then (local.set $vtbl (global.get $DX_VTBL_D3DDEV7))))))
    (if (i32.eq (local.get $family) (i32.const 6)) (then
      (if (i32.eqz (local.get $obj_wa))
        (then (local.set $obj_wa (call $g2w (local.get $this)))))
      (local.set $vtbl (i32.load (local.get $obj_wa)))))
    ;; Miss → fail.
    (if (i32.eqz (local.get $vtbl)) (then
      (call $gs32 (local.get $ppvObj) (i32.const 0))
      (return (i32.const 0x80004002))))
    ;; Hit → return a wrapper (aux or primary) that reports the requested vtbl
    ;; backed by the same DX_OBJECTS slot. Must NOT mutate the primary wrapper's
    ;; vtbl in place: callers keep the original `this` register alive and
    ;; continue to invoke methods on the original vtbl (observed in d3rm.dll
    ;; Device2::QI→Device1 sequences where [esi] must still resolve to Device2).
    (local.set $entry (call $dx_from_this (local.get $this)))
    (call $gs32 (local.get $ppvObj)
      (call $dx_get_wrapper_for_vtbl
        (call $dx_slot_of (local.get $entry))
        (local.get $vtbl)))
    ;; AddRef the backing slot.
    (store.field DxObject refcount (local.get $entry) (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (i32.const 0))

  ;; ── CreateDevice forwarding (D3D2/D3D3/D3D7) ──────────────────
  ;; Shared device type 20 and 4KB state block on the guest heap.
  ;; All three versions use the same
  ;; underlying type — the only externally-visible difference is the vtable
  ;; the caller sees on the returned object, and QI handles upgrades.
  ;; Device entry fields: +8 = current render-target slot, +12 = creator
  ;; D3D slot + 1 (0 means no parent, e.g. surface-QI-created device).
  (func $d3dim_create_device (param $this i32) (param $rt_surf i32) (param $ppDev i32) (param $vtbl i32)
    (local $obj i32) (local $entry i32) (local $rt_entry i32) (local $rt_slot i32) (local $state i32)
    (local $parent_entry i32) (local $parent_slot i32) (local $version i32)
    (call $gs32 (local.get $ppDev) (i32.const 0))
    ;; Acquire fallible heap storage before consuming a permanently retired
    ;; DX slot. No parent reference or output is published until both exist.
    (local.set $state (call $heap_alloc (i32.const 4096)))
    (if (i32.eqz (local.get $state)) (then
      (i32.store (global.get $reg_base) (i32.const 0x8007000E))
      (return)))
    (local.set $obj (call $dx_create_com_obj (i32.const 20) (local.get $vtbl)))
    (if (i32.eqz (local.get $obj)) (then
      (call $heap_free (local.get $state))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (call $d3ddev_init_state (local.get $state))
    ;; DX7 D3DRENDERSTATETYPE defaults: COLORVERTEX and LOCALVIEWER are
    ;; TRUE; SPECULARMATERIALSOURCE is COLOR2. The common zeroed state
    ;; already supplies FALSE for SPECULARENABLE and NORMALIZENORMALS.
    ;; Apply only at Device7 creation, never when QI changes an interface.
    (if (i32.eq (local.get $vtbl) (global.get $DX_VTBL_D3DDEV7)) (then
      (call $gs32 (i32.add (local.get $state) (i32.const 820)) (i32.const 1))
      (call $gs32 (i32.add (local.get $state) (i32.const 824)) (i32.const 1))
      (call $gs32 (i32.add (local.get $state) (i32.const 840)) (i32.const 2))))
    ;; QueryInterface changes the visible interface, not this creation policy.
    (if (i32.eq (local.get $vtbl) (global.get $DX_VTBL_D3DDEV1)) (then (local.set $version (i32.const 1))))
    (if (i32.eq (local.get $vtbl) (global.get $DX_VTBL_D3DDEV2)) (then (local.set $version (i32.const 2))))
    (if (i32.eq (local.get $vtbl) (global.get $DX_VTBL_D3DDEV3)) (then (local.set $version (i32.const 3))))
    (call $gs32 (i32.add (local.get $state) (i32.const 3932)) (local.get $version))
    (i32.store offset=16 (local.get $entry) (local.get $state))
    (if (local.get $this) (then
      (local.set $parent_entry (call $dx_from_this (local.get $this)))
      (if (i32.ne (i32.load (local.get $parent_entry)) (i32.const 0)) (then
        (local.set $parent_slot (call $dx_slot_of (local.get $parent_entry)))
        (i32.store (i32.add (local.get $entry) (i32.const 12))
          (i32.add (local.get $parent_slot) (i32.const 1)))
        (store.field DxObject refcount (local.get $parent_entry)
          (i32.add (load.field DxObject refcount (local.get $parent_entry)) (i32.const 1)))))))
    (if (local.get $rt_surf) (then
      (local.set $rt_entry (call $dx_from_this (local.get $rt_surf)))
      (local.set $rt_slot (call $dx_slot_of (local.get $rt_entry)))
      (store.field DxObject misc0 (local.get $entry) (local.get $rt_slot))
      ;; D3DRENDERSTATE_ZENABLE (7, state +284) defaults to D3DZB_TRUE when a
      ;; depth buffer is attached to the render target at creation, FALSE
      ;; otherwise. Tomb Raider III attaches one and never sets ZENABLE; with
      ;; the old FALSE default its rooms drew without a depth test.
      (if (call $d3dim_attached_zbuffer (local.get $rt_entry))
        (then (call $gs32 (i32.add (local.get $state) (i32.const 284)) (i32.const 1))))))
    (call $gs32 (local.get $ppDev) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_direct3d (param $this i32) (param $ppD3D i32) (param $vtbl i32)
    (local $entry i32) (local $parent_idx i32) (local $parent_slot i32) (local $parent_entry i32)
    (if (i32.eqz (local.get $ppD3D)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
      (return)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $parent_idx (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (if (i32.eqz (local.get $parent_idx)) (then
      (call $gs32 (local.get $ppD3D) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    (local.set $parent_slot (i32.sub (local.get $parent_idx) (i32.const 1)))
    (if (i32.ge_u (local.get $parent_slot) (global.get $DX_MAX)) (then
      (call $gs32 (local.get $ppD3D) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    (local.set $parent_entry (i32.add (global.get $DX_OBJECTS)
      (i32.mul (local.get $parent_slot) (i32.const 32))))
    (if (i32.eqz (i32.load (local.get $parent_entry))) (then
      (call $gs32 (local.get $ppD3D) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    (i32.store (i32.add (local.get $parent_entry) (i32.const 4))
      (i32.add (i32.load (i32.add (local.get $parent_entry) (i32.const 4))) (i32.const 1)))
    (call $gs32 (local.get $ppD3D)
      (call $dx_get_wrapper_for_vtbl (local.get $parent_slot) (local.get $vtbl)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; ── BeginScene / EndScene ─────────────────────────────────────
  (func $d3dim_begin_scene (param $this i32)
    (local $state i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state) (then
      (call $gs32 (i32.add (local.get $state) (i32.const 3956)) (i32.const 1))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
  (func $d3dim_end_scene (param $this i32)
    (local $rt i32) (local $state i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state) (then
      (call $gs32 (i32.add (local.get $state) (i32.const 3956)) (i32.const 0))))
    ;; If the RT is the primary surface, present it now. d3drm-based apps
    ;; (ARCHITEC, others) never call Flip/Unlock — they rely on EndScene
    ;; to make the frame visible. Non-primary RTs are left untouched; the
    ;; app's own Flip or Blt-to-primary will handle those.
    (local.set $rt (call $d3ddev_rt_entry (local.get $this)))
    (if (local.get $rt) (then
      (if (i32.and (i32.load (i32.add (local.get $rt) (i32.const 28))) (i32.const 1))
        (then (call $d3dim_worker_fence) (call $dx_present (local.get $rt))
          (call $present_frame_end)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; DX5 Device2 / DX6 Device3 Begin-family. SDK references and the exact
  ;; supported FVF subset are recorded in d3dim-immediate-drawing-20261105.md.
  ;; Descriptor (guest allocation, 48 bytes): mode, primitive, FVF, flags,
  ;; input stride, submitted count, stream capacity, owned canonical stream,
  ;; owned canonical indexed source, source count, sticky HRESULT, vertex type.
  ;; No instance-global builder: independently interleaved devices own all data.
  ;; 65536 submissions / 4MB input is a deliberate finite implementation limit.
  (func $d3dim_immediate_desc (param $this i32) (result i32)
    (local $state i32)
    (if (global.get $d3dim_state_override) (then (return (i32.const 0))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (call $gl32 (i32.add (local.get $state) (i32.const 4028))))

  (func $d3dim_immediate_error (param $desc i32) (param $hr i32)
    (if (local.get $desc) (then
      (if (i32.eqz (call $gl32 (i32.add (local.get $desc) (i32.const 40)))) (then
        (call $gs32 (i32.add (local.get $desc) (i32.const 40)) (local.get $hr))))))
    (i32.store (global.get $reg_base) (local.get $hr)))

  (func $d3dim_immediate_forbid (param $this i32) (result i32)
    (local $d i32)
    (local.set $d (call $d3dim_immediate_desc (local.get $this)))
    (if (local.get $d) (then
      (if (call $gl32 (local.get $d)) (then
        (call $d3dim_immediate_error (local.get $d) (i32.const 0x80070057))
        (return (i32.const 1))))))
    (i32.const 0))

  ;; Public Device2/3 entry points use this before any query, callback, state
  ;; change or alternate draw during a sequence. IUnknown reference/lifetime
  ;; methods remain available; the submitted storage belongs to the device.
  (func $d3dim_immediate_reject (param $this i32) (param $pop i32) (result i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then
      (i32.store offset=16 (global.get $reg_base)
        (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $pop)))
      (return (i32.const 1))))
    (i32.const 0))

  (func $d3dim_immediate_destroy (param $state i32)
    (local $d i32) (local $p i32)
    (local.set $d (call $gl32 (i32.add (local.get $state) (i32.const 4028))))
    (if (i32.eqz (local.get $d)) (then (return)))
    (call $gs32 (i32.add (local.get $state) (i32.const 4028)) (i32.const 0))
    (local.set $p (call $gl32 (i32.add (local.get $d) (i32.const 28))))
    (if (local.get $p) (then (call $heap_free (local.get $p))))
    (local.set $p (call $gl32 (i32.add (local.get $d) (i32.const 32))))
    (if (local.get $p) (then (call $heap_free (local.get $p))))
    (call $heap_free (local.get $d)))

  (func $d3dim_immediate_begin
    (param $this i32) (param $prim i32) (param $format i32) (param $flags i32)
    (param $source i32) (param $count i32) (param $indexed i32) (param $version i32)
    (local $state i32) (local $d i32) (local $fvf i32) (local $stride i32)
    (local $copy i32) (local $type i32) (local $span i32) (local $hr i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $hr (i32.const 0x80070057))
    (block $bad
      (br_if $bad (i32.eqz (local.get $state)))
      (if (i32.eqz (call $gl32 (i32.add (local.get $state) (i32.const 3956)))) (then
        (local.set $hr (i32.const 0x887602f9)) (br $bad)))
      (br_if $bad (i32.or (i32.lt_u (local.get $prim) (i32.const 1))
        (i32.gt_u (local.get $prim) (i32.const 6))))
      (br_if $bad (i32.and (i32.ne (local.get $indexed) (i32.const 0))
        (i32.eq (local.get $prim) (i32.const 1))))
      (br_if $bad (i32.and (local.get $flags)
        (i32.xor (select (i32.const 15) (i32.const 29)
          (i32.eq (local.get $version) (i32.const 2))) (i32.const -1))))
      (local.set $fvf (local.get $format))
      (if (i32.eq (local.get $version) (i32.const 2)) (then
        (br_if $bad (i32.or (i32.lt_u (local.get $format) (i32.const 1))
          (i32.gt_u (local.get $format) (i32.const 3))))
        (local.set $fvf (select (i32.const 0x112)
          (select (i32.const 0x1e2) (i32.const 0x1c4) (i32.eq (local.get $format) (i32.const 2)))
          (i32.eq (local.get $format) (i32.const 1))))))
      ;; DX6 XYZ or XYZRHW, optional normal/colors, zero to eight 2D UV sets.
      ;; DX7 blending/coordinate dimension extensions are explicitly unsupported.
      (br_if $bad (i32.eqz (call $d3dim_fvf_vtxtype (local.get $fvf))))
      (br_if $bad (i32.and (local.get $fvf) (i32.const 1)))
      (br_if $bad (i32.eq (i32.and (local.get $fvf) (i32.const 6)) (i32.const 6)))
      (br_if $bad (i32.and (i32.ne (i32.and (local.get $fvf) (i32.const 4)) (i32.const 0))
        (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0))))
      (local.set $hr (i32.const 0x80004001))
      (br_if $bad (i32.and (local.get $fvf) (i32.const 0xfffff009)))
      (br_if $bad (i32.gt_u (i32.shr_u (i32.and (local.get $fvf) (i32.const 0xf00)) (i32.const 8)) (i32.const 8)))
      (br_if $bad (i32.and (i32.ne (i32.and (local.get $fvf) (i32.const 32)) (i32.const 0))
        (i32.ne (local.get $fvf) (i32.const 0x1e2))))
      ;; The existing canonical pipeline cannot retain a normal AND prelit
      ;; colors. DONOTLIGHT explicitly chooses the supplied colors instead.
      (br_if $bad (i32.and (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0))
        (i32.and (i32.ne (i32.and (local.get $fvf) (i32.const 192)) (i32.const 0))
          (i32.eqz (i32.and (local.get $flags) (i32.const 16))))))
      ;; Extended texture transforms / generated coordinates require the DX7
      ;; extended-vertex path, not this DX5/6 canonical representation.
      (br_if $bad (i32.eqz (call $d3dim_fvf_supplied_valid (local.get $this) (local.get $fvf))))
      (br_if $bad (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 24)))
      (br_if $bad (i32.shr_u (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11)) (i32.const 16)))
      (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
      (local.set $type (call $d3dim_fvf_vtxtype (local.get $fvf)))
      (if (local.get $indexed) (then
        (local.set $hr (i32.const 0x80070057))
        (br_if $bad (i32.or (i32.eqz (local.get $source)) (i32.eqz (local.get $count))))
        (local.set $hr (i32.const 0x8007000e))
        (br_if $bad (i32.or (i32.gt_u (local.get $count) (i32.const 65536))
          (i32.gt_u (i32.mul (local.get $count) (local.get $stride)) (i32.const 0x400000))))
        (local.set $span (call $g2w_affine_span (local.get $source) (i32.mul (local.get $count) (local.get $stride))))
        (local.set $hr (i32.const 0x80004001))
        (br_if $bad (i32.eq (local.get $span) (global.get $NULL_SENTINEL)))
        (local.set $copy (call $d3dim_pack_fvf_vertices (local.get $fvf) (local.get $source)
          (local.get $count) (call $d3dim_texcoord_index (local.get $this))))
        (local.set $hr (i32.const 0x8007000e))
        (br_if $bad (i32.eqz (local.get $copy)))))
      (local.set $d (call $d3dim_immediate_desc (local.get $this)))
      (if (i32.eqz (local.get $d)) (then
        (local.set $d (call $heap_alloc (i32.const 48)))
        (local.set $hr (i32.const 0x8007000e))
        (br_if $bad (i32.eqz (local.get $d)))
        (call $zero_memory (call $g2w (local.get $d)) (i32.const 48))
        (call $gs32 (i32.add (local.get $state) (i32.const 4028)) (local.get $d))))
      (call $gs32 (local.get $d) (i32.add (local.get $indexed) (i32.const 1)))
      (call $gs32 (i32.add (local.get $d) (i32.const 4)) (local.get $prim))
      (call $gs32 (i32.add (local.get $d) (i32.const 8)) (local.get $fvf))
      (call $gs32 (i32.add (local.get $d) (i32.const 12)) (local.get $flags))
      (call $gs32 (i32.add (local.get $d) (i32.const 16)) (local.get $stride))
      (call $gs32 (i32.add (local.get $d) (i32.const 20)) (i32.const 0))
      (call $gs32 (i32.add (local.get $d) (i32.const 32)) (local.get $copy))
      (call $gs32 (i32.add (local.get $d) (i32.const 36)) (local.get $count))
      (call $gs32 (i32.add (local.get $d) (i32.const 40)) (i32.const 0))
      (call $gs32 (i32.add (local.get $d) (i32.const 44)) (local.get $type))
      (i32.store (global.get $reg_base) (i32.const 0)) (return))
    (if (local.get $copy) (then (call $heap_free (local.get $copy))))
    (i32.store (global.get $reg_base) (local.get $hr)))

  (func $d3dim_immediate_submit (param $this i32) (param $value i32) (param $indexed i32)
    (local $d i32) (local $count i32) (local $cap i32) (local $p i32)
    (local $old i32) (local $src i32) (local $hr i32) (local $stride i32)
    (local.set $d (call $d3dim_immediate_desc (local.get $this)))
    (local.set $hr (i32.const 0x80070057))
    (block $bad
      (br_if $bad (i32.eqz (local.get $d)))
      (br_if $bad (i32.ne (call $gl32 (local.get $d)) (i32.add (local.get $indexed) (i32.const 1))))
      (local.set $hr (call $gl32 (i32.add (local.get $d) (i32.const 40))))
      (br_if $bad (local.get $hr))
      (local.set $hr (i32.const 0x80070057))
      (if (local.get $indexed) (then
        (local.set $value (i32.and (local.get $value) (i32.const 65535)))
        (br_if $bad (i32.ge_u (local.get $value) (call $gl32 (i32.add (local.get $d) (i32.const 36))))))
        (else
          (br_if $bad (i32.eqz (local.get $value)))
          (local.set $stride (call $gl32 (i32.add (local.get $d) (i32.const 16))))
          (local.set $hr (i32.const 0x80004001))
          (br_if $bad (i32.eq (call $g2w_affine_span (local.get $value) (local.get $stride)) (global.get $NULL_SENTINEL)))))
      (local.set $count (call $gl32 (i32.add (local.get $d) (i32.const 20))))
      (local.set $hr (i32.const 0x8007000e))
      (br_if $bad (i32.ge_u (local.get $count) (i32.const 65536)))
      (local.set $cap (call $gl32 (i32.add (local.get $d) (i32.const 24))))
      (if (i32.ge_u (local.get $count) (local.get $cap)) (then
        (local.set $cap (select (i32.shl (local.get $cap) (i32.const 1)) (i32.const 16) (i32.ne (local.get $cap) (i32.const 0))))
        (local.set $p (call $heap_alloc (i32.mul (local.get $cap) (i32.const 32))))
        (br_if $bad (i32.eqz (local.get $p)))
        (local.set $old (call $gl32 (i32.add (local.get $d) (i32.const 28))))
        (if (local.get $old) (then
          (call $memcpy (call $g2w (local.get $p)) (call $g2w (local.get $old)) (i32.mul (local.get $count) (i32.const 32)))
          (call $heap_free (local.get $old))))
        (call $gs32 (i32.add (local.get $d) (i32.const 28)) (local.get $p))
        (call $gs32 (i32.add (local.get $d) (i32.const 24)) (local.get $cap))))
      (local.set $p (i32.add (call $gl32 (i32.add (local.get $d) (i32.const 28))) (i32.mul (local.get $count) (i32.const 32))))
      (if (local.get $indexed) (then
        (call $gs32 (local.get $p) (local.get $value)))
        (else
          (local.set $src (call $d3dim_pack_fvf_vertices
            (call $gl32 (i32.add (local.get $d) (i32.const 8))) (local.get $value) (i32.const 1)
            (call $d3dim_texcoord_index (local.get $this))))
          (br_if $bad (i32.eqz (local.get $src)))
          (call $memcpy (call $g2w (local.get $p)) (call $g2w (local.get $src)) (i32.const 32))
          (call $heap_free (local.get $src))))
      (call $gs32 (i32.add (local.get $d) (i32.const 20)) (i32.add (local.get $count) (i32.const 1)))
      (i32.store (global.get $reg_base) (i32.const 0)) (return))
    (call $d3dim_immediate_error (local.get $d) (local.get $hr)))

  (func $d3dim_immediate_end (param $this i32) (param $reserved i32)
    (local $d i32) (local $mode i32) (local $prim i32) (local $count i32)
    (local $state i32) (local $hr i32) (local $out i32) (local $src i32)
    (local $stream i32) (local $source i32) (local $type i32) (local $i i32)
    (local $flags i32) (local $fvf i32) (local $clip0 v128) (local $clip1 i64)
    (local.set $d (call $d3dim_immediate_desc (local.get $this)))
    (local.set $hr (i32.const 0x80070057))
    (block $done
      (br_if $done (i32.eqz (local.get $d)))
      (local.set $mode (call $gl32 (local.get $d)))
      (br_if $done (i32.eqz (local.get $mode)))
      ;; Every End closes, including a rejected/failed sequence. No partial draw.
      (call $gs32 (local.get $d) (i32.const 0))
      (local.set $source (call $gl32 (i32.add (local.get $d) (i32.const 32))))
      (call $gs32 (i32.add (local.get $d) (i32.const 32)) (i32.const 0))
      (br_if $done (local.get $reserved))
      (local.set $hr (call $gl32 (i32.add (local.get $d) (i32.const 40))))
      (br_if $done (local.get $hr))
      (local.set $hr (i32.const 0x80070057))
      (local.set $count (call $gl32 (i32.add (local.get $d) (i32.const 20))))
      (local.set $prim (call $gl32 (i32.add (local.get $d) (i32.const 4))))
      (br_if $done (i32.lt_u (local.get $count)
        (select (i32.const 1) (select (i32.const 2) (i32.const 3) (i32.le_u (local.get $prim) (i32.const 3)))
          (i32.eq (local.get $prim) (i32.const 1)))))
      ;; Disjoint lists ignore an incomplete trailing primitive, as SDK5/6 say.
      (if (i32.eq (local.get $prim) (i32.const 2)) (then
        (local.set $count (i32.and (local.get $count) (i32.const -2)))))
      (if (i32.eq (local.get $prim) (i32.const 4)) (then
        (local.set $count (i32.mul (i32.div_u (local.get $count) (i32.const 3)) (i32.const 3)))))
      (local.set $out (call $heap_alloc (i32.mul (local.get $count) (i32.const 32))))
      (local.set $hr (i32.const 0x8007000e))
      (br_if $done (i32.eqz (local.get $out)))
      (local.set $state (call $d3ddev_state (local.get $this)))
      (local.set $stream (call $gl32 (i32.add (local.get $d) (i32.const 28))))
      (local.set $type (call $gl32 (i32.add (local.get $d) (i32.const 44))))
      (local.set $flags (call $gl32 (i32.add (local.get $d) (i32.const 12))))
      (local.set $fvf (call $gl32 (i32.add (local.get $d) (i32.const 8))))
      (local.set $clip0 (v128.load (i32.add (call $g2w (local.get $state)) (i32.const 4000))))
      (local.set $clip1 (i64.load (i32.add (call $g2w (local.get $state)) (i32.const 4016))))
      (call $d3ddev_composite_wvp (local.get $state))
      (call $d3dim_lights_refresh (local.get $state))
      (block $vertices_done (loop $vertices
        (br_if $vertices_done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $src (i32.add (local.get $stream) (i32.mul (local.get $i) (i32.const 32))))
        (if (i32.eq (local.get $mode) (i32.const 2)) (then
          (local.set $src (i32.add (local.get $source) (i32.shl (call $gl32 (local.get $src)) (i32.const 5))))))
        (local.set $src (call $g2w (local.get $src)))
        (if (i32.and (local.get $flags) (i32.const 16)) (then
          (if (i32.and (i32.eqz (i32.and (local.get $fvf) (i32.const 192)))
                (i32.eqz (i32.and (local.get $fvf) (i32.const 4)))) (then
            (i32.store offset=12 (local.get $src) (i32.const 0))
            (i32.store offset=16 (local.get $src) (i32.const -1))
            (local.set $type (i32.const 2))))
          (if (i32.eqz (i32.and (local.get $fvf) (i32.const 128))) (then
            (i32.store offset=20 (local.get $src) (i32.const 0))))))
        (call $d3dim_prepare_draw_vertex (local.get $state) (local.get $type) (local.get $src)
          (i32.add (call $g2w (local.get $out)) (i32.shl (local.get $i) (i32.const 5))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $vertices)))
      ;; Existing producer encodes/copies vertex bytes before returning. Its
      ;; delayed consumer never owns pointers into these temporary allocations.
      (call $d3dim_draw_primitive (local.get $this) (local.get $prim)
        (select (i32.const 4) (i32.const 3) (call $d3dim_supplied_projected (local.get $state)))
        (local.get $out) (local.get $count))
      (if (i32.and (local.get $flags) (i32.const 8)) (then
        (v128.store (i32.add (call $g2w (local.get $state)) (i32.const 4000)) (local.get $clip0))
        (i64.store (i32.add (call $g2w (local.get $state)) (i32.const 4016)) (local.get $clip1))))
      (if (i32.and (local.get $flags) (i32.const 1)) (then (call $d3dim_worker_fence)))
      (local.set $hr (i32.const 0)))
    (if (local.get $out) (then (call $heap_free (local.get $out))))
    (if (local.get $source) (then (call $heap_free (local.get $source))))
    (i32.store (global.get $reg_base) (local.get $hr)))

  ;; ── State-block forwarders ────────────────────────────────────
  ;; Mirror IDirect3DDevice3_SetTransform / SetRenderState / SetLightState
  ;; bodies inline (we can't easily call the existing handlers because they
  ;; manage ESP themselves).
  ;; Shared core: copy 64-byte matrix from WASM-addr $src_wa into the device's
  ;; per-xtype slot of its state block. Used by SetTransform (which passes a
  ;; guest matrix ptr via $g2w) and the D3DOP_STATETRANSFORM walker (which
  ;; resolves a matrix handle into D3DIM_MATRICES).
  (func $d3dim_apply_transform (param $this i32) (param $xtype i32) (param $src_wa i32)
    (local $state i32) (local $slot i32) (local $tex i32)
    (if (i32.eqz (local.get $src_wa)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $tex (call $d3dim_tex_matrix (local.get $state) (local.get $xtype)))
    (if (local.get $tex) (then
      (call $memcpy (local.get $tex) (local.get $src_wa) (i32.const 64))
      (return)))
    (local.set $slot (call $d3ddev_matrix_slot (local.get $xtype)))
    (call $memcpy
      (call $g2w (i32.add (local.get $state) (i32.mul (local.get $slot) (i32.const 64))))
      (local.get $src_wa)
      (i32.const 64)))

  (func $d3dim_bind_transform_handle (param $this i32) (param $xtype i32) (param $handle i32)
    (local $state i32) (local $sw i32) (local $slot i32)
    (local.set $slot (call $d3ddev_matrix_slot (local.get $xtype)))
    (if (i32.ge_u (local.get $slot) (i32.const 3)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (i32.store
      (i32.add (local.get $sw)
        (i32.add (global.get $D3DIM_OFF_XFORM_HANDLES)
          (i32.mul (local.get $slot) (i32.const 4))))
      (local.get $handle)))

  (func $d3dim_refresh_bound_matrix (param $this i32) (param $handle i32)
    (local $state i32) (local $sw i32) (local $slot i32) (local $mat_wa i32)
    (if (i32.or (i32.lt_u (local.get $handle) (i32.const 1))
                (i32.gt_u (local.get $handle) (global.get $D3DIM_MATRIX_MAX)))
      (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $mat_wa
      (i32.add (global.get $D3DIM_MATRICES)
        (i32.mul (i32.sub (local.get $handle) (i32.const 1)) (i32.const 64))))
    (local.set $slot (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $slot) (i32.const 3)))
      (if (i32.eq
            (i32.load
              (i32.add (local.get $sw)
                (i32.add (global.get $D3DIM_OFF_XFORM_HANDLES)
                  (i32.mul (local.get $slot) (i32.const 4)))))
            (local.get $handle))
        (then
          (call $memcpy
            (call $g2w
              (i32.add (local.get $state)
                (i32.mul (local.get $slot) (i32.const 64))))
            (local.get $mat_wa)
            (i32.const 64))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br 0))))

  (func $d3dim_set_transform (param $this i32) (param $xtype i32) (param $lpmat i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (if (i32.ne (local.get $lpmat) (i32.const 0)) (then (if (call $d3dim_sb_record (local.get $this) (i32.const 2) (local.get $xtype) (local.get $lpmat) (i32.const 64)) (then (return)))))
    (if (local.get $lpmat) (then
      ;; kind=27 Xform: the raw matrix the guest supplied, before any
      ;; composition. Half-Life's D3D renderer is a GL shim -- 221
      ;; MultiplyTransform calls to 106 SetTransform in three frames is a GL
      ;; matrix stack -- so the accumulated world matrix is a product of many
      ;; supplied matrices and only the sequence says which step is wrong.
      (call $host_dx_trace (i32.const 27) (local.get $xtype)
        (call $g2w (local.get $lpmat)) (i32.const 0) (i32.const 0))
      (call $d3dim_bind_transform_handle (local.get $this) (local.get $xtype) (i32.const 0))
      (call $d3dim_apply_transform (local.get $this) (local.get $xtype)
        (call $g2w (local.get $lpmat)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_transform (param $this i32) (param $xtype i32) (param $lpmat i32)
    (local $state i32) (local $slot i32) (local $tex i32)
    (if (i32.eqz (local.get $lpmat)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $tex (call $d3dim_tex_matrix (local.get $state) (local.get $xtype)))
    (if (local.get $tex) (then
      (call $memcpy (call $g2w (local.get $lpmat)) (local.get $tex) (i32.const 64))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return)))
    (local.set $slot (call $d3ddev_matrix_slot (local.get $xtype)))
    (call $memcpy
      (call $g2w (local.get $lpmat))
      (call $g2w (i32.add (local.get $state) (i32.mul (local.get $slot) (i32.const 64))))
      (i32.const 64))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_multiply_transform (param $this i32) (param $xtype i32) (param $lpmat i32)
    (local $state i32) (local $sw i32) (local $slot i32) (local $dst_wa i32) (local $tmp_wa i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (if (i32.eqz (local.get $lpmat)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $slot (call $d3ddev_matrix_slot (local.get $xtype)))
    (local.set $dst_wa (call $d3dim_tex_matrix (local.get $state) (local.get $xtype)))
    (if (i32.eqz (local.get $dst_wa)) (then
      (local.set $dst_wa (i32.add (local.get $sw) (i32.mul (local.get $slot) (i32.const 64))))))
    (local.set $tmp_wa (i32.add (local.get $sw) (i32.const 3136)))
    (call $host_dx_trace (i32.const 27) (i32.or (local.get $xtype) (i32.const 0x100))
      (call $g2w (local.get $lpmat)) (i32.const 0) (i32.const 0))
    ;; The supplied matrix goes on the LEFT. D3D transforms row vectors as
    ;; v * World * View * Proj, so the factor appended by a MultiplyTransform
    ;; has to end up leftmost to be the one applied to the vertex FIRST -- that
    ;; is what makes a sequence of these calls behave like OpenGL's matrix
    ;; stack, where glMultMatrix post-multiplies a column-vector matrix. The
    ;; two conventions are transposes, and (M*A)^T = A^T * M^T.
    ;;
    ;; With the operands the other way round Half-Life's D3D renderer -- which
    ;; is a GL shim, and drives this entry point 74 times a frame with Quake's
    ;; R_SetupGL sequence (rotate -90 x, rotate 90 z, pitch, roll, yaw,
    ;; translate -vieworg) and no SetTransform at all -- got its camera basis
    ;; built in reverse. The product was still a proper rotation, so nothing
    ;; looked malformed: it was a valid camera rolled 180 degrees, with the
    ;; glTranslatef operand surviving verbatim in the composite's translation
    ;; row instead of being rotated by the factors that must precede it. The
    ;; world then rendered upside down with most of it behind the eye.
    (call $mat4_mul (local.get $tmp_wa) (call $g2w (local.get $lpmat)) (local.get $dst_wa))
    (call $memcpy (local.get $dst_wa) (local.get $tmp_wa) (i32.const 64))
    (call $d3dim_bind_transform_handle (local.get $this) (local.get $xtype) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_set_render_state (param $this i32) (param $rs i32) (param $val i32)
    (local $state i32) (local $slot i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (if (i32.lt_u (local.get $rs) (i32.const 512)) (then (if (call $d3dim_sb_record (local.get $this) (i32.const 0) (local.get $rs) (local.get $val) (i32.const 0)) (then (if (i32.eq (local.get $rs) (i32.const 21)) (then
        (drop (call $d3dim_sb_record (local.get $this) (i32.const 9) (i32.const 0)
          (select (local.get $val) (i32.const 0) (i32.or
            (i32.le_u (i32.sub (local.get $val) (i32.const 1)) (i32.const 3))
            (i32.le_u (i32.sub (local.get $val) (i32.const 7)) (i32.const 1)))) (i32.const 0))))) (return)))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $rs) (i32.const 512)))
      (then
            (local.set $slot (i32.add (local.get $state)
              (i32.add (i32.const 256) (i32.mul (local.get $rs) (i32.const 4)))))
            ;; kind=29 RState: a render state whose value changes. Every
            ;; interface revision and execute-buffer STATERENDER lands here,
            ;; so this answers "does any app set WRAPU/WRAPV/WRAP0-7, table
            ;; fog, ..." without a per-app guess.
            (if (i32.ne (call $gl32 (local.get $slot)) (local.get $val))
              (then (call $host_dx_trace (i32.const 29) (local.get $rs)
                      (local.get $val) (i32.const 0) (i32.const 0))))
            (call $gs32 (local.get $slot) (local.get $val))
            ;; Legacy texture blending is a separate effective stage state.
            ;; Preserve the application's raw TSS values for GetTextureStageState.
            (if (i32.eq (local.get $rs) (i32.const 21)) (then
              (call $gs32 (i32.add (local.get $state) (i32.const 3936))
                (select (local.get $val) (i32.const 0)
                  (i32.or (i32.le_u (i32.sub (local.get $val) (i32.const 1)) (i32.const 3))
                          (i32.le_u (i32.sub (local.get $val) (i32.const 7)) (i32.const 1)))))))
            ;; D3DRENDERSTATE_TEXTUREHANDLE = 1 in the v1 execute-buffer API.
            (if (i32.eq (local.get $rs) (i32.const 1))
              (then
                (call $gs32
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_TEX_STAGE))
                  (local.get $val))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_render_state (param $this i32) (param $rs i32) (param $out i32)
    (local $state i32) (local $val i32)
    (if (i32.eqz (local.get $out)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $rs) (i32.const 512)))
      (then (local.set $val
              (call $gl32
                (i32.add (local.get $state)
                  (i32.add (i32.const 256) (i32.mul (local.get $rs) (i32.const 4))))))))
    (call $gs32 (local.get $out) (local.get $val))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_set_light_state (param $this i32) (param $ls i32) (param $val i32)
    (local $state i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $ls) (i32.const 128)))
      (then (call $gs32
              (i32.add (local.get $state)
                (i32.add (i32.const 2304) (i32.mul (local.get $ls) (i32.const 4))))
              (local.get $val))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_light_state (param $this i32) (param $ls i32) (param $out i32)
    (local $state i32) (local $val i32)
    (if (i32.eqz (local.get $out)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.and (i32.ne (local.get $state) (i32.const 0))
                 (i32.lt_u (local.get $ls) (i32.const 128)))
      (then (local.set $val
              (call $gl32
                (i32.add (local.get $state)
                  (i32.add (i32.const 2304) (i32.mul (local.get $ls) (i32.const 4))))))))
    (call $gs32 (local.get $out) (local.get $val))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_set_clip_status (param $this i32) (param $lpClip i32)
    (local $state i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (if (i32.eqz (local.get $lpClip)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.and (call $gl32 (local.get $lpClip)) (i32.const 4)) (then
      (i32.store (global.get $reg_base) (i32.const 0x80004001)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then (call $memcpy
              (call $g2w (i32.add (local.get $state) (global.get $D3DIM_OFF_CLIP_STATUS)))
              (call $g2w (local.get $lpClip))
              (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_clip_status (param $this i32) (param $lpClip i32)
    (local $state i32)
    (if (i32.eqz (local.get $lpClip)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then (call $memcpy
              (call $g2w (local.get $lpClip))
              (call $g2w (i32.add (local.get $state) (global.get $D3DIM_OFF_CLIP_STATUS)))
              (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Execute-buffer source bytes and processed TL vertices have separate owners.
  ;; Lock/Unlock publishes application source; PROCESSVERTICES must never write
  ;; its TL result back into that source (color-only locks would feed TL into XYZ).
  ;; Allocation: 32-byte status header, source[size], output[size], processed u32.
  ;; One owner for lazy snapshots and Unlock refreshes. Return a guest header.
  ;; Keep an old cache owned until a replacement has allocated and initialized.
  (func $d3dim_execbuf_cache_ensure
    (param $entry i32) (param $refresh i32) (result i32)
    (local $slot i32) (local $tbl i32) (local $buf i32) (local $size i32)
    (local $old i32) (local $cache i32)
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.ge_u (local.get $slot) (global.get $D3DIM_EB_CACHE_MAX))
      (then (return (i32.const 0))))
    (local.set $buf (load.field DxObject misc0 (local.get $entry)))
    (local.set $size (i32.load offset=12 (local.get $entry)))
    (if (i32.or (i32.eqz (local.get $buf))
          (i32.or (i32.eqz (local.get $size)) (i32.gt_u (local.get $size) (i32.const 0x100000))))
      (then (return (i32.const 0))))
    (local.set $tbl (i32.add (global.get $D3DIM_EB_CACHE_PTRS)
      (i32.mul (local.get $slot) (i32.const 4))))
    (local.set $old (i32.load (local.get $tbl)))
    (if (local.get $old) (then
      (if (i32.and
            (i32.eq (call $gl32 (local.get $old)) (local.get $buf))
            (i32.eq (call $gl32 (i32.add (local.get $old) (i32.const 4))) (local.get $size)))
        (then
          (if (local.get $refresh) (then
            (call $guest_memmove
              (i32.add (local.get $old) (global.get $D3DIM_EB_CACHE_HEADER))
              (local.get $buf) (local.get $size))))
          (return (local.get $old))))))
    (local.set $cache (call $heap_alloc
      (i32.add (i32.mul (local.get $size) (i32.const 2))
        (i32.add (global.get $D3DIM_EB_CACHE_HEADER) (i32.const 4)))))
    (if (i32.eqz (local.get $cache)) (then (return (i32.const 0))))
    (call $gs32 (local.get $cache) (local.get $buf))
    (call $gs32 (i32.add (local.get $cache) (i32.const 4)) (local.get $size))
    (call $guest_memset (i32.add (local.get $cache) (i32.const 8)) (i32.const 0) (i32.const 24))
    (call $guest_memmove
      (i32.add (local.get $cache) (global.get $D3DIM_EB_CACHE_HEADER))
      (local.get $buf) (local.get $size))
    (call $guest_memmove
      (i32.add (i32.add (local.get $cache) (global.get $D3DIM_EB_CACHE_HEADER)) (local.get $size))
      (local.get $buf) (local.get $size))
    (call $gs32 (i32.add (i32.add (local.get $cache) (global.get $D3DIM_EB_CACHE_HEADER))
      (i32.mul (local.get $size) (i32.const 2))) (i32.const 0))
    (i32.store (local.get $tbl) (local.get $cache))
    (if (local.get $old) (then (call $heap_free (local.get $old))))
    (local.get $cache))

  (func $d3dim_execbuf_source_guest (param $buf_guest i32) (result i32)
    (local $i i32) (local $entry i32) (local $cache_g i32)
    (if (i32.eqz (local.get $buf_guest)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (block $found (loop $scan
      (br_if $found (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $entry (i32.add (global.get $DX_OBJECTS)
        (i32.mul (local.get $i) (global.get $DX_ENTRY_SIZE))))
      (if (i32.and
            (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 21))
            (i32.eq (load.field DxObject misc0 (local.get $entry)) (local.get $buf_guest)))
        (then (br $found)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.ge_u (local.get $i) (global.get $D3DIM_EB_CACHE_MAX))
      (then (return (local.get $buf_guest))))
    (local.set $cache_g (call $d3dim_execbuf_cache_ensure (local.get $entry) (i32.const 0)))
    (if (i32.eqz (local.get $cache_g))
      (then (return (local.get $buf_guest))))
    (i32.add (local.get $cache_g) (global.get $D3DIM_EB_CACHE_HEADER)))

  ;; Primitives/Pick consume the driver's processed stream. Before any
  ;; PROCESSVERTICES, preserve the legacy direct-TL path from the live buffer.
  (func $d3dim_execbuf_output_guest (param $buf_guest i32) (param $activate i32) (result i32)
    (local $source i32) (local $size i32) (local $flag i32)
    (local.set $source (call $d3dim_execbuf_source_guest (local.get $buf_guest)))
    (if (i32.or (i32.eqz (local.get $source)) (i32.eq (local.get $source) (local.get $buf_guest)))
      (then (return (local.get $buf_guest))))
    (local.set $size (call $gl32 (i32.sub (local.get $source) (i32.const 28))))
    (local.set $flag (i32.add (local.get $source) (i32.mul (local.get $size) (i32.const 2))))
    (if (local.get $activate) (then (call $gs32 (local.get $flag) (i32.const 1))))
    (if (result i32) (call $gl32 (local.get $flag))
      (then (i32.add (local.get $source) (local.get $size)))
      (else (local.get $buf_guest))))

  ;; Return the guest cache header for one execute-buffer COM object. Unlock creates
  ;; this before SetExecuteData, which is the order used by the DX1 runtime.
  (func $d3dim_execbuf_cache_header_guest (param $this i32) (result i32)
    (local $entry i32) (local $slot i32) (local $cache_g i32)
    (if (i32.eqz (local.get $this)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.ge_u (local.get $slot) (global.get $D3DIM_EB_CACHE_MAX))
      (then (return (i32.const 0))))
    (local.set $cache_g (i32.load (i32.add (global.get $D3DIM_EB_CACHE_PTRS)
      (i32.mul (local.get $slot) (i32.const 4)))))
    (if (i32.eqz (local.get $cache_g)) (then (return (i32.const 0))))
    (if (i32.or
          (i32.ne (call $gl32 (local.get $cache_g))
            (load.field DxObject misc0 (local.get $entry)))
          (i32.ne (call $gl32 (i32.add (local.get $cache_g) (i32.const 4)))
            (i32.load (i32.add (local.get $entry) (i32.const 12)))))
      (then (return (i32.const 0))))
    (local.get $cache_g))

  ;; SETSTATUS installs exactly the selected fields, including inverted seeds.
  (func $d3dim_exec_set_status (param $eb_this i32) (param $rec_guest i32)
    (local $header i32) (local $status i32) (local $flags i32)
    (local.set $header (call $d3dim_execbuf_cache_header_guest (local.get $eb_this)))
    (if (i32.eqz (local.get $header)) (then (return)))
    (local.set $status (i32.add (local.get $header) (i32.const 8)))
    (local.set $flags (call $gl32 (local.get $rec_guest)))
    (call $gs32 (local.get $status) (local.get $flags))
    (if (i32.and (local.get $flags) (i32.const 1)) (then
      (call $gs32 (i32.add (local.get $status) (i32.const 4))
        (call $gl32 (i32.add (local.get $rec_guest) (i32.const 4))))))
    (if (i32.and (local.get $flags) (i32.const 2)) (then
      (call $guest_memmove (i32.add (local.get $status) (i32.const 8))
        (i32.add (local.get $rec_guest) (i32.const 8)) (i32.const 16)))))

  ;; Synchronous Execute saves/restores this per-instance (thread-local) scope.
  ;; The rectangle itself has one owner: the ExecuteBuffer's guest status.
  (global $d3dim_exec_extent_guest (mut i32) (i32.const 0))
  (global $d3dim_exec_extent_rt (mut i32) (i32.const 0))
  (func $d3dim_extent_add (param $rect i32)
    (param $x1 i32) (param $y1 i32) (param $x2 i32) (param $y2 i32)
    (if (i32.lt_s (local.get $x1) (call $gl32 (i32.add (local.get $rect) (i32.const 0)))) (then
      (call $gs32 (i32.add (local.get $rect) (i32.const 0)) (local.get $x1))))
    (if (i32.lt_s (local.get $y1) (call $gl32 (i32.add (local.get $rect) (i32.const 4)))) (then
      (call $gs32 (i32.add (local.get $rect) (i32.const 4)) (local.get $y1))))
    (if (i32.gt_s (local.get $x2) (call $gl32 (i32.add (local.get $rect) (i32.const 8)))) (then
      (call $gs32 (i32.add (local.get $rect) (i32.const 8)) (local.get $x2))))
    (if (i32.gt_s (local.get $y2) (call $gl32 (i32.add (local.get $rect) (i32.const 12)))) (then
      (call $gs32 (i32.add (local.get $rect) (i32.const 12)) (local.get $y2))))
  )
  ;; Call only after raster clipping, for nonempty spans/rectangles. This bounds
  ;; coverage, before per-fragment alpha/depth rejection, not a pixel diff.
  (func $d3dim_exec_extent_draw (param $rt i32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (call $page_watch_write
      (i32.add (load.field DxObject misc1 (local.get $rt))
        (i32.mul (local.get $y) (load.field DxObject pitch (local.get $rt))))
      (i32.mul (local.get $h) (load.field DxObject pitch (local.get $rt))))
    (if (i32.eqz (global.get $d3dim_exec_extent_guest)) (then (return)))
    (if (i32.ne (local.get $rt) (global.get $d3dim_exec_extent_rt)) (then (return)))
    (call $d3dim_extent_add (global.get $d3dim_exec_extent_guest)
      (local.get $x) (local.get $y)
      (i32.add (local.get $x) (local.get $w)) (i32.add (local.get $y) (local.get $h))))

  ;; GPU acceptance is synchronous even when submission/readback is deferred.
  ;; Publish conservative clipped coverage while Execute still owns its status;
  ;; do not announce a CPU DIB write (the GPU fence owns that later).
  (func (export "d3dim_gpu_extent") (param $rt i32)
    (param $left i32) (param $top i32) (param $right i32) (param $bottom i32)
    (if (i32.eqz (global.get $d3dim_exec_extent_guest)) (then (return)))
    (if (i32.ne (local.get $rt) (global.get $d3dim_exec_extent_rt)) (then (return)))
    (if (i32.le_s (local.get $right) (local.get $left)) (then (return)))
    (if (i32.le_s (local.get $bottom) (local.get $top)) (then (return)))
    (call $d3dim_extent_add (global.get $d3dim_exec_extent_guest)
      (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)))

  (func $d3dim_execbuf_cache_clear (param $this i32)
    (local $entry i32) (local $slot i32) (local $tbl i32) (local $cache_g i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (if (i32.ge_u (local.get $slot) (global.get $D3DIM_EB_CACHE_MAX)) (then (return)))
    (local.set $tbl (i32.add (global.get $D3DIM_EB_CACHE_PTRS)
      (i32.mul (local.get $slot) (i32.const 4))))
    (local.set $cache_g (i32.load (local.get $tbl)))
    (if (local.get $cache_g) (then
      (call $heap_free (local.get $cache_g))
      (i32.store (local.get $tbl) (i32.const 0)))))

  (func $d3dim_execbuf_cache_refresh (param $this i32)
    (if (i32.eqz (local.get $this)) (then (return)))
    (drop (call $d3dim_execbuf_cache_ensure
      (call $dx_from_this (local.get $this)) (i32.const 1))))

  ;; ── Vertex-buffer backing storage ─────────────────────────────
  ;; DX7 vertex buffers need at least enough guest memory for Lock callers to
  ;; upload vertices. We store data at entry+8, byte size at +12, a copied
  ;; D3DVERTEXBUFFERDESC at +16, and cached FVF/vertex count at +20/+24.
  ;; D3DFVF_TEXCOORDSIZE encodes FLOAT2/3/4/1 as 0/1/2/3.
  (func $d3dim_fvf_tex_size (param $fvf i32) (param $set i32) (result i32)
    (local $code i32)
    (local.set $code (i32.and (i32.shr_u (local.get $fvf)
      (i32.add (i32.const 16) (i32.shl (local.get $set) (i32.const 1)))) (i32.const 3)))
    (if (result i32) (i32.eq (local.get $code) (i32.const 3))
      (then (i32.const 1)) (else (i32.add (local.get $code) (i32.const 2)))))

  (func $d3dim_fvf_tex_offset (param $fvf i32) (param $set i32) (result i32)
    (local $i i32) (local $bytes i32)
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $i) (local.get $set)))
      (local.set $bytes (i32.add (local.get $bytes)
        (i32.shl (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $i)) (i32.const 2))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $next)))
    (local.get $bytes))

  ;; FVF draws validate supplied selectors against the declared layout.
  ;; Enabled transforms preserve all input components in extended TL records.
  (func $d3dim_fvf_supplied_valid (param $this i32) (param $fvf i32) (result i32)
    (local $state i32) (local $selector i32) (local $count i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $selector (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11)))
    (local.set $count (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (if (i32.gt_u (local.get $count) (i32.const 8)) (then (return (i32.const 0))))
    ;; Generated modes keep their existing, separate prerequisites.
    (if (i32.gt_u (local.get $selector) (i32.const 0xffff)) (then (return (i32.const 1))))
    (if (i32.and (i32.ne (local.get $count) (i32.const 0))
          (i32.ge_u (local.get $selector) (local.get $count))) (then (return (i32.const 0))))
    (i32.const 1))

  ;; Internal type 5/6: TL header plus supplied (u,v,z,w), 40 bytes.
  ;; Type 5 is projected; type 6 is an ordinary linear texture transform.
  ;; Keep the inputs, not vertex quotients, through queue capture and clipping.
  (func $d3dim_d7_supplied_type (param $this i32) (result i32)
    (local $state i32) (local $flags i32) (local $selector i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $selector (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11)))
    (local.set $flags (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 24)))
    (if (i32.gt_u (local.get $selector) (i32.const 7)) (then
      ;; All supported generated vectors must retain their three components
      ;; for PROJECTED draws instead of interpolating vertex quotients.
      (if (i32.and
          (i32.and
            (i32.ge_u (i32.shr_u (local.get $selector) (i32.const 16)) (i32.const 1))
            (i32.le_u (i32.shr_u (local.get $selector) (i32.const 16)) (i32.const 3)))
          (i32.and (i32.ge_u (local.get $flags) (i32.const 0x102))
                   (i32.le_u (local.get $flags) (i32.const 0x104))))
        (then (return (i32.const 5))))
      (return (i32.const 0))))
    (if (i32.or (i32.eqz (i32.and (local.get $flags) (i32.const 255)))
        (i32.gt_u (i32.and (local.get $flags) (i32.const 255)) (i32.const 4)))
      (then (return (i32.const 0))))
    (select (i32.const 5) (i32.const 6) (i32.and (local.get $flags) (i32.const 256))))

  ;; Strided normal/reflection generation has not supplied an original normal
  ;; to the extended-vector producer. Keep its previous route separate.
  (func $d3dim_d7_strided_supplied_type (param $this i32) (result i32)
    (local $mode i32)
    (local.set $mode (i32.shr_u (call $d3dim_tss_load
      (call $d3ddev_state (local.get $this)) (i32.const 0) (i32.const 11)) (i32.const 16)))
    (if (i32.or (i32.eq (local.get $mode) (i32.const 1))
                (i32.eq (local.get $mode) (i32.const 3))) (then (return (i32.const 0))))
    (call $d3dim_d7_supplied_type (local.get $this)))

  (func $d3dim_d7_supplied_vertices
    (param $this i32) (param $fvf i32) (param $original i32)
    (param $packed i32) (param $count i32) (param $type i32) (result i32)
    (local $out i32) (local $ow i32) (local $pw i32) (local $src i32)
    (local $state i32) (local $i i32) (local $dst i32) (local $stride i32)
    (local $sets i32) (local $selector i32) (local $dimension i32) (local $offset i32)
    (local $position i32) (local $input i32) (local $camera i32) (local $mode i32)
    (if (i32.or (i32.eqz (local.get $packed)) (i32.gt_u (local.get $count) (i32.const 104857)))
      (then (return (i32.const 0))))
    (local.set $out (call $heap_alloc (i32.mul (local.get $count) (i32.const 40))))
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
    (local.set $ow (call $g2w (local.get $out)))
    (local.set $pw (call $g2w (local.get $packed)))
    (local.set $src (call $g2w (local.get $original)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $mode
      (i32.shr_u (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11)) (i32.const 16)))
    (local.set $position (i32.eq (local.get $mode) (i32.const 2)))
    (if (i32.and
          (i32.or (i32.eq (local.get $mode) (i32.const 1)) (i32.eq (local.get $mode) (i32.const 3)))
          (i32.ne (i32.and (local.get $fvf) (i32.const 0x16)) (i32.const 0x12))) (then
      (call $heap_free (local.get $out)) (return (i32.const 0))))
    (call $d3ddev_composite_wvp (local.get $state))
    (call $d3dim_lights_refresh (local.get $state))
    (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
    (local.set $sets (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (local.set $selector (call $d3dim_texcoord_index (local.get $this)))
    (local.set $dimension (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $selector)))
    (local.set $offset (i32.add (i32.sub (local.get $stride)
      (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $sets)))
      (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $selector))))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $dst (i32.add (local.get $ow) (i32.mul (local.get $i) (i32.const 40))))
      (call $d3dim_prepare_draw_vertex (local.get $state) (local.get $type)
        (i32.add (local.get $pw) (i32.mul (local.get $i) (i32.const 32))) (local.get $dst))
      (f32.store offset=32 (local.get $dst) (f32.const 0))
      (f32.store offset=36 (local.get $dst) (f32.const 1))
      (if (local.get $sets) (then
        (if (i32.ge_u (local.get $dimension) (i32.const 3)) (then
          (i32.store offset=32 (local.get $dst) (i32.load offset=8
            (i32.add (local.get $src) (i32.add (i32.mul (local.get $i) (local.get $stride)) (local.get $offset)))))))
        (if (i32.eq (local.get $dimension) (i32.const 4)) (then
          (i32.store offset=36 (local.get $dst) (i32.load offset=12
            (i32.add (local.get $src) (i32.add (i32.mul (local.get $i) (local.get $stride)) (local.get $offset)))))))))
      (if (local.get $position) (then
        ;; Use the original XYZ prefix, independent of FVF colors/lighting and
        ;; supplied selector. Scratch belongs to this call, never to the queue.
        (local.set $input (i32.add (call $g2w (local.get $state)) (i32.const 4048)))
        (local.set $camera (i32.add (call $g2w (local.get $state)) (i32.const 4080)))
        (memory.copy (local.get $input)
          (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $stride))) (i32.const 12))
        (f32.store offset=12 (local.get $input) (f32.const 1))
        (call $mat4_transform_vec4 (local.get $camera) (call $g2w (local.get $state)) (local.get $input))
        (call $mat4_transform_vec4 (local.get $input)
          (i32.add (call $g2w (local.get $state)) (i32.const 64)) (local.get $camera))
        (memory.copy (i32.add (local.get $dst) (i32.const 24)) (local.get $input) (i32.const 16))))
      (if (i32.or (i32.eq (local.get $mode) (i32.const 1))
                  (i32.eq (local.get $mode) (i32.const 3))) (then
        ;; The packed normal may already be replaced by colors or lighting.
        ;; Generate from original XYZ|NORMAL, without texture transformation or
        ;; division. The type-5 consumer owns matrix application and texture q.
        (local.set $input (call $d3dim_texgen_input (local.get $state) (i32.const 1)
          (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $stride)))))
        (memory.copy (i32.add (local.get $dst) (i32.const 24)) (local.get $input) (i32.const 12))
        (f32.store offset=36 (local.get $dst) (f32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $lp)))
    (local.get $out))

  (func $d3dim_tl_stride (result i32)
    (select (i32.const 40) (i32.const 32) (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2))))
  (global $d3dim_extended_clip (mut i32) (i32.const 0))

  (func $d3dim_fvf_stride (param $fvf i32) (result i32)
    (local $stride i32) (local $tex i32)
    (if (i32.and (local.get $fvf) (i32.const 0x0004))
      (then (local.set $stride (i32.const 16)))  ;; XYZRHW
      (else
        (if (i32.and (local.get $fvf) (i32.const 0x0002))
          (then (local.set $stride (i32.const 12)))))) ;; XYZ
    (if (i32.and (local.get $fvf) (i32.const 0x0010))
      (then (local.set $stride (i32.add (local.get $stride) (i32.const 12)))))
    ;; D3DFVF_LVERTEX (0x1e2) includes dwReserved after XYZ. It is
    ;; storage, not an ignorable flag: Lock callers write 32-byte vertices.
    (if (i32.and (local.get $fvf) (i32.const 0x0020))
      (then (local.set $stride (i32.add (local.get $stride) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 0x0040))
      (then (local.set $stride (i32.add (local.get $stride) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 0x0080))
      (then (local.set $stride (i32.add (local.get $stride) (i32.const 4)))))
    (local.set $tex (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 0xF)))
    (local.set $stride (i32.add (local.get $stride) (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $tex))))
    (if (i32.eqz (local.get $stride)) (then (local.set $stride (i32.const 32))))
    (local.get $stride))

  (func $d3dim_fvf_vtxtype (param $fvf i32) (result i32)
    (if (i32.and (local.get $fvf) (i32.const 0x0004))
      (then (return (i32.const 3)))) ;; XYZRHW -> TLVERTEX
    (if (i32.and (local.get $fvf) (i32.const 0x0002))
      (then
        (if (i32.or (i32.and (local.get $fvf) (i32.const 0x0040))
                    (i32.and (local.get $fvf) (i32.const 0x0080)))
          (then (return (i32.const 2)))) ;; diffuse/specular -> LVERTEX
        (return (i32.const 1))))         ;; XYZ[/NORMAL] -> VERTEX
    (i32.const 0))

  (func $d3dim_vertex_type_stride (param $vtxType i32) (result i32)
    ;; D3DLVERTEX includes a reserved DWORD between xyz and diffuse:
    ;; {x,y,z,dwReserved,color,specular,tu,tv}. It is therefore the same
    ;; 32-byte size as D3DVERTEX and D3DTLVERTEX, not 28 bytes.
    (i32.const 32))

  (func $d3dim_pack_fvf_vertices
    (param $fvf i32) (param $src_g i32) (param $count i32) (param $tex_index i32) (result i32)
    (call $d3dim_pack_fvf_vertices_into (local.get $fvf) (local.get $src_g)
      (local.get $count) (local.get $tex_index) (i32.const 0)))

  ;; A nonzero destination is caller-owned storage for count * 32 bytes.
  ;; Ordinary draw callers retain the allocating/freeing contract above.
  (func $d3dim_pack_fvf_vertices_into
    (param $fvf i32) (param $src_g i32) (param $count i32) (param $tex_index i32)
    (param $dst_g i32) (result i32)
    (local $type i32) (local $stride i32) (local $dst_stride i32) (local $size i32)
    (local $src_wa i32) (local $dst_wa i32) (local $i i32) (local $src i32) (local $dst i32)
    (local $offset i32) (local $tex_count i32)
    (local $head v128)
    (if (i32.or (i32.eqz (local.get $src_g)) (i32.eqz (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $type (call $d3dim_fvf_vtxtype (local.get $fvf)))
    (if (i32.eqz (local.get $type)) (then (return (i32.const 0))))
    (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
    (local.set $tex_count (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 0xF)))
    (if (i32.ge_u (local.get $tex_index) (local.get $tex_count))
      (then (local.set $tex_index (i32.const 0))))
    (local.set $dst_stride (call $d3dim_vertex_type_stride (local.get $type)))
    (local.set $size (i32.mul (local.get $count) (local.get $dst_stride)))
    (if (i32.or (i32.eqz (local.get $size)) (i32.gt_u (local.get $size) (i32.const 0x400000)))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $dst_g))
      (then (local.set $dst_g (call $heap_alloc (local.get $size)))))
    (if (i32.eqz (local.get $dst_g)) (then (return (i32.const 0))))
    (local.set $src_wa (call $g2w (local.get $src_g)))
    (local.set $dst_wa (call $g2w (local.get $dst_g)))
    ;; MW3's dominant format is exactly XYZRHW|DIFFUSE|SPECULAR|TEX3. Avoid
    ;; zeroing and repeatedly decoding that FVF for every vertex: all eight
    ;; canonical dwords are known, with only the selected UV pair non-contiguous.
    (if (i32.eq (local.get $fvf) (i32.const 0x3c4)) (then
      (local.set $i (i32.const 0))
      (block $fast_done (loop $fast_lp
        (br_if $fast_done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $src (i32.add (local.get $src_wa) (i32.mul (local.get $i) (i32.const 48))))
        (local.set $dst (i32.add (local.get $dst_wa) (i32.shl (local.get $i) (i32.const 5))))
        (local.set $head (v128.load (local.get $src)))
        (v128.store (local.get $dst) (local.get $head))
        (i64.store offset=16 (local.get $dst) (i64.load offset=16 (local.get $src)))
        (local.set $offset (i32.add (i32.const 24) (i32.shl (local.get $tex_index) (i32.const 3))))
        (i32.store offset=24 (local.get $dst) (i32.load (i32.add (local.get $src) (local.get $offset))))
        (i32.store offset=28 (local.get $dst)
          (i32.load offset=4 (i32.add (local.get $src) (local.get $offset))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $fast_lp)))
      (return (local.get $dst_g))))
    (call $zero_memory (local.get $dst_wa) (local.get $size))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $src (i32.add (local.get $src_wa) (i32.mul (local.get $i) (local.get $stride))))
      (local.set $dst (i32.add (local.get $dst_wa) (i32.mul (local.get $i) (local.get $dst_stride))))
      (if (i32.eq (local.get $type) (i32.const 3))
        (then
          (call $memcpy (local.get $dst) (local.get $src) (i32.const 16))
          (local.set $offset (i32.const 16))
          (if (i32.and (local.get $fvf) (i32.const 0x0020))
            (then (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
          (i32.store (i32.add (local.get $dst) (i32.const 16)) (i32.const 0xFFFFFFFF))
          ;; No D3DFVF_SPECULAR: black specular whose alpha (the fog factor) is no fog.
          (i32.store (i32.add (local.get $dst) (i32.const 20)) (i32.const 0xFF000000))
          (if (i32.and (local.get $fvf) (i32.const 0x0040)) (then
            (i32.store (i32.add (local.get $dst) (i32.const 16))
              (i32.load (i32.add (local.get $src) (local.get $offset))))
            (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
          (if (i32.and (local.get $fvf) (i32.const 0x0080)) (then
            (i32.store (i32.add (local.get $dst) (i32.const 20))
              (i32.load (i32.add (local.get $src) (local.get $offset))))
            (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
          (if (local.get $tex_count) (then
            (local.set $offset (i32.add (local.get $offset) (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $tex_index))))
            (i32.store (i32.add (local.get $dst) (i32.const 24))
              (i32.load (i32.add (local.get $src) (local.get $offset))))
            (if (i32.ge_u (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $tex_index)) (i32.const 2)) (then (i32.store (i32.add (local.get $dst) (i32.const 28))
              (i32.load (i32.add (local.get $src) (i32.add (local.get $offset) (i32.const 4))))))))))
        (else
          (if (i32.eq (local.get $type) (i32.const 2))
            (then
              ;; D3DLVERTEX is {x,y,z, dwReserved, dcColor, dcSpecular, tu, tv}:
              ;; the reserved DWORD at +12 pushes colour to +16 and the texture
              ;; coordinates to +24/+28, which is where $d3dim_prepare_draw_vertex
              ;; and every other consumer of this canonical form read them.
              ;; Packing them two dwords early (as this branch did) silently fed
              ;; the transform a zero colour and the wrong pair of dwords as UV.
              (call $memcpy (local.get $dst) (local.get $src) (i32.const 12))
              (local.set $offset (i32.const 12))
              (i32.store (i32.add (local.get $dst) (i32.const 12)) (i32.const 0))
              (i32.store (i32.add (local.get $dst) (i32.const 16)) (i32.const 0xFFFFFFFF))
              (i32.store (i32.add (local.get $dst) (i32.const 20)) (i32.const 0xFF000000)) ;; fog factor: none
              (if (i32.and (local.get $fvf) (i32.const 0x0010))
                (then (local.set $offset (i32.add (local.get $offset) (i32.const 12)))))
              (if (i32.and (local.get $fvf) (i32.const 0x0020))
                (then (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
              (if (i32.and (local.get $fvf) (i32.const 0x0040)) (then
                (i32.store (i32.add (local.get $dst) (i32.const 16))
                  (i32.load (i32.add (local.get $src) (local.get $offset))))
                (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
              (if (i32.and (local.get $fvf) (i32.const 0x0080)) (then
                (i32.store (i32.add (local.get $dst) (i32.const 20))
                  (i32.load (i32.add (local.get $src) (local.get $offset))))
                (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
              (if (local.get $tex_count) (then
                (local.set $offset (i32.add (local.get $offset) (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $tex_index))))
                (i32.store (i32.add (local.get $dst) (i32.const 24))
                  (i32.load (i32.add (local.get $src) (local.get $offset))))
                (if (i32.ge_u (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $tex_index)) (i32.const 2)) (then (i32.store (i32.add (local.get $dst) (i32.const 28))
                  (i32.load (i32.add (local.get $src) (i32.add (local.get $offset) (i32.const 4))))))))))
            (else
              (call $memcpy (local.get $dst) (local.get $src) (i32.const 12))
              (local.set $offset (i32.const 12))
              (if (i32.and (local.get $fvf) (i32.const 0x0010))
                (then
                  (call $memcpy (i32.add (local.get $dst) (i32.const 12))
                                (i32.add (local.get $src) (local.get $offset))
                                (i32.const 12))
                  (local.set $offset (i32.add (local.get $offset) (i32.const 12))))
                (else
                  (f32.store (i32.add (local.get $dst) (i32.const 20)) (f32.const 1.0))))
              (if (i32.and (local.get $fvf) (i32.const 0x0020))
                (then (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
              (if (local.get $tex_count) (then
                (local.set $offset (i32.add (local.get $offset) (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $tex_index))))
                (i32.store (i32.add (local.get $dst) (i32.const 24))
                  (i32.load (i32.add (local.get $src) (local.get $offset))))
                (if (i32.ge_u (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $tex_index)) (i32.const 2)) (then (i32.store (i32.add (local.get $dst) (i32.const 28))
                  (i32.load (i32.add (local.get $src) (i32.add (local.get $offset) (i32.const 4)))))))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (local.get $dst_g))

  (func $d3dim_create_vb (param $lpDesc i32) (param $ppVB i32) (param $vtbl i32)
    (local $obj i32) (local $entry i32) (local $desc_g i32) (local $data_g i32)
    (local $desc_size i32) (local $fvf i32) (local $count i32) (local $size i32)
    (local $bytes i64)
    (if (i32.eqz (local.get $ppVB)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (call $gs32 (local.get $ppVB) (i32.const 0))
    ;; Stage owned allocations before consuming a permanent COM wrapper slot.
    (if (local.get $lpDesc) (then
      (local.set $desc_size (call $gl32 (local.get $lpDesc)))
      (if (i32.lt_u (local.get $desc_size) (i32.const 16)) (then (local.set $desc_size (i32.const 16))))
      (if (i32.gt_u (local.get $desc_size) (i32.const 32)) (then (local.set $desc_size (i32.const 32))))
      (local.set $fvf (call $gl32 (i32.add (local.get $lpDesc) (i32.const 8))))
      (local.set $count (call $gl32 (i32.add (local.get $lpDesc) (i32.const 12))))
      (local.set $desc_g (call $heap_alloc (i32.const 36)))
      (if (i32.eqz (local.get $desc_g)) (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
      (call $guest_memset (local.get $desc_g) (i32.const 0) (i32.const 36))
      (call $guest_memmove (local.get $desc_g) (local.get $lpDesc) (local.get $desc_size))
      (call $gs32 (local.get $desc_g) (local.get $desc_size))))
    ;; Never let vertex count describe more storage than was allocated.
    (local.set $bytes (i64.mul
      (i64.extend_i32_u (call $d3dim_fvf_stride (local.get $fvf)))
      (i64.extend_i32_u (local.get $count))))
    (if (i64.gt_u (local.get $bytes) (i64.const 0xFFFFFFFF)) (then
      (if (local.get $desc_g) (then (call $heap_free (local.get $desc_g))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
    (local.set $size (i32.wrap_i64 (local.get $bytes)))
    (if (i32.eqz (local.get $size)) (then (local.set $size (i32.const 4096))))
    (local.set $data_g (call $heap_alloc (local.get $size)))
    (if (i32.eqz (local.get $data_g)) (then
      (if (local.get $desc_g) (then (call $heap_free (local.get $desc_g))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
    (local.set $obj (call $dx_create_com_obj (i32.const 22) (local.get $vtbl)))
    (if (i32.eqz (local.get $obj)) (then
      (call $heap_free (local.get $data_g))
      (if (local.get $desc_g) (then (call $heap_free (local.get $desc_g))))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005)) (return)))
    (call $guest_memset (local.get $data_g) (i32.const 0) (local.get $size))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject misc0 (local.get $entry) (local.get $data_g))
    (i32.store offset=16 (local.get $entry) (local.get $desc_g))
    (i32.store (i32.add (local.get $entry) (i32.const 12)) (local.get $size))
    (store.field DxObject misc1 (local.get $entry) (local.get $fvf))
    (store.field DxObject misc2 (local.get $entry) (local.get $count))
    (call $gs32 (local.get $ppVB) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_vb_free_entry (param $entry i32)
    (local $ptr i32)
    (local.set $ptr (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    (local.set $ptr (i32.load (i32.add (local.get $entry) (i32.const 16))))
    (if (local.get $ptr) (then
      (if (call $gl32 (i32.add (local.get $ptr) (i32.const 32))) (then
        (call $heap_free (call $gl32 (i32.add (local.get $ptr) (i32.const 32))))))
      (call $heap_free (local.get $ptr))))
    (call $dx_free (local.get $entry)))

  (func $d3dim_vb_lock (param $this i32) (param $ppData i32) (param $pSize i32)
    (local $entry i32) (local $data_g i32) (local $size i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    ;; The flags union is unused by VB storage; preserve legacy Lock outputs while
    ;; exposing the SDK processing prohibition to every VB alias.
    (if (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 22))
      (then (store.field DxObject flags (local.get $entry) (i32.const 1))))
    (local.set $data_g (load.field DxObject misc0 (local.get $entry)))
    (local.set $size (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (if (local.get $ppData) (then (call $gs32 (local.get $ppData) (local.get $data_g))))
    (if (local.get $pSize) (then (call $gs32 (local.get $pSize) (local.get $size))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_vb_get_desc (param $this i32) (param $lpDesc i32)
    (local $entry i32) (local $desc_g i32) (local $copy_size i32)
    (if (i32.eqz (local.get $lpDesc)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $desc_g (i32.load (i32.add (local.get $entry) (i32.const 16))))
    (local.set $copy_size (call $gl32 (local.get $lpDesc)))
    (if (i32.lt_u (local.get $copy_size) (i32.const 16)) (then (local.set $copy_size (i32.const 16))))
    (if (i32.gt_u (local.get $copy_size) (i32.const 32)) (then (local.set $copy_size (i32.const 32))))
    (if (local.get $desc_g)
      (then (call $guest_memmove (local.get $lpDesc) (local.get $desc_g) (local.get $copy_size)))
      (else (call $guest_memset (local.get $lpDesc) (i32.const 0) (local.get $copy_size))))
    (call $gs32 (local.get $lpDesc) (local.get $copy_size))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Write one canonical 32-byte TLVERTEX back out in an arbitrary destination
  ;; FVF layout. The inverse of $d3dim_pack_fvf_vertices, and the half
  ;; ProcessVertices needs: its destination buffer declares its own FVF, and a
  ;; buffer that is XYZRHW|DIFFUSE|TEX1 (28 bytes) is not the 32-byte TLVERTEX
  ;; the transform produces. Texture sets are copied separately from the
  ;; original FVF records: the canonical TLVERTEX holds only one UV pair.
  (func $d3dim_unpack_tl_vertex (param $fvf i32) (param $src_wa i32) (param $dst_wa i32)
    (call $d3dim_unpack_tl_vertex_fields (local.get $fvf) (local.get $src_wa) (local.get $dst_wa) (i32.const 3)))

  ;; Position always changes. Select default normal/reserved stores (bit 1)
  ;; and color stores (bit 2) independently for D3DPV_DONOTCOPYDATA.
  ;; Field offsets advance even when the destination bytes are preserved.
  (func $d3dim_unpack_tl_vertex_fields
    (param $fvf i32) (param $src_wa i32) (param $dst_wa i32) (param $copy_fields i32)
    (local $offset i32)
    (if (i32.and (local.get $fvf) (i32.const 0x0004))
      (then
        (call $memcpy (local.get $dst_wa) (local.get $src_wa) (i32.const 16))
        (local.set $offset (i32.const 16)))
      (else
        ;; No position bits at all means a descriptor we never saw; the output
        ;; of a transform is XYZRHW by definition, so lay it out that way.
        (call $memcpy (local.get $dst_wa) (local.get $src_wa)
          (select (i32.const 12) (i32.const 16)
            (i32.ne (i32.and (local.get $fvf) (i32.const 0x0002)) (i32.const 0))))
        (local.set $offset
          (select (i32.const 12) (i32.const 16)
            (i32.ne (i32.and (local.get $fvf) (i32.const 0x0002)) (i32.const 0))))))
    (if (i32.and (local.get $fvf) (i32.const 0x0010)) (then
      ;; A transformed vertex has no normal left to carry; zero rather than
      ;; leave whatever the last batch wrote at that offset.
      (if (i32.and (local.get $copy_fields) (i32.const 1)) (then
        (call $zero_memory (i32.add (local.get $dst_wa) (local.get $offset)) (i32.const 12))))
      (local.set $offset (i32.add (local.get $offset) (i32.const 12)))))
    (if (i32.and (local.get $fvf) (i32.const 0x0020)) (then
      (if (i32.and (local.get $copy_fields) (i32.const 1)) (then
        (i32.store (i32.add (local.get $dst_wa) (local.get $offset)) (i32.const 0))))
      (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 0x0040)) (then
      (if (i32.and (local.get $copy_fields) (i32.const 2)) (then
        (i32.store (i32.add (local.get $dst_wa) (local.get $offset))
          (i32.load (i32.add (local.get $src_wa) (i32.const 16))))))
      (local.set $offset (i32.add (local.get $offset) (i32.const 4)))))
    (if (i32.and (local.get $fvf) (i32.const 0x0080)) (then
      (if (i32.and (local.get $copy_fields) (i32.const 2)) (then
        (i32.store (i32.add (local.get $dst_wa) (local.get $offset))
          (i32.load (i32.add (local.get $src_wa) (i32.const 20))))))
      (local.set $offset (i32.add (local.get $offset) (i32.const 4))))))

  ;; ProcessVertices does not collapse texture sets to the active draw-stage
  ;; selector. Preserve each set's supplied components in its own FVF layout.
  (func $d3dim_vb_copy_texcoords
      (param $src_fvf i32) (param $src i32) (param $dst_fvf i32) (param $dst i32)
      (param $generated_uv i32)
    (local $src_sets i32) (local $dst_sets i32) (local $set i32)
    (local $src_dim i32) (local $dst_dim i32) (local $c i32)
    (local.set $src_sets (i32.and (i32.shr_u (local.get $src_fvf) (i32.const 8)) (i32.const 15)))
    (local.set $dst_sets (i32.and (i32.shr_u (local.get $dst_fvf) (i32.const 8)) (i32.const 15)))
    (local.set $src (i32.add (local.get $src) (i32.sub
      (call $d3dim_fvf_stride (local.get $src_fvf))
      (call $d3dim_fvf_tex_offset (local.get $src_fvf) (local.get $src_sets)))))
    (local.set $dst (i32.add (local.get $dst) (i32.sub
      (call $d3dim_fvf_stride (local.get $dst_fvf))
      (call $d3dim_fvf_tex_offset (local.get $dst_fvf) (local.get $dst_sets)))))
    (block $done (loop $next_set
      (br_if $done (i32.ge_u (local.get $set) (local.get $dst_sets)))
      (local.set $src_dim (i32.const 0))
      (if (i32.lt_u (local.get $set) (local.get $src_sets)) (then
        (local.set $src_dim (call $d3dim_fvf_tex_size (local.get $src_fvf) (local.get $set)))))
      ;; Keep the existing generated-coordinate route's canonical UV output.
      (if (local.get $generated_uv) (then
        (local.set $src (local.get $generated_uv))
        (local.set $src_dim (i32.const 2))))
      (local.set $dst_dim (call $d3dim_fvf_tex_size (local.get $dst_fvf) (local.get $set)))
      (local.set $c (i32.const 0))
      (block $components_done (loop $component
        (br_if $components_done (i32.ge_u (local.get $c) (local.get $dst_dim)))
        (i32.store (i32.add (local.get $dst) (i32.shl (local.get $c) (i32.const 2)))
          (if (result i32) (i32.lt_u (local.get $c) (local.get $src_dim))
            (then (i32.load (i32.add (local.get $src) (i32.shl (local.get $c) (i32.const 2)))))
            (else (select (i32.const 0x3f800000) (i32.const 0) (i32.eq (local.get $c) (i32.const 3))))))
        (local.set $c (i32.add (local.get $c) (i32.const 1))) (br $component)))
      (local.set $src (i32.add (local.get $src) (i32.shl (local.get $src_dim) (i32.const 2))))
      (local.set $dst (i32.add (local.get $dst) (i32.shl (local.get $dst_dim) (i32.const 2))))
      (local.set $set (i32.add (local.get $set) (i32.const 1))) (br $next_set))))

  ;; The vertex-buffer draw path had no tracing of its own. DPBlend/DPVtx
  ;; (kinds 17/18) are emitted by $d3dim_draw_primitive only, so an app that
  ;; batches through ProcessVertices + DrawIndexedPrimitiveVB -- Half-Life's
  ;; D3D renderer does, ~164 draws a frame -- produced texture binds and
  ;; presents with not one line saying what was drawn, which reads exactly
  ;; like "the world is never submitted". These two say what the VB path
  ;; actually saw. Both are change-gated like $d3dim_dbg_tex_last, so a
  ;; per-draw call site stays quiet while every transition is still reported.
  ;; -1 can never collide with a real key.
  (global $d3dim_dbg_pv_last (mut i32) (i32.const -1))
  (global $d3dim_dbg_vb_last (mut i32) (i32.const -1))

  ;; Final processing output uses the SDK7 output depth range. Keep this
  ;; outside vertex_project: internal triangle clipping reconstructs clip Z
  ;; from its normalized Z/W representation. Legacy viewport objects already
  ;; normalize their clip volume and store the output range [0,1].
  (func $d3dim_process_viewport_depth (param $state i32) (param $out i32)
    (local $range i32) (local $min f32) (local $max f32)
    (local.set $range (i32.add (call $g2w (local.get $state)) (global.get $D3DIM_OFF_VP_SCALE)))
    (local.set $min (f32.load offset=8 (local.get $range)))
    (local.set $max (f32.load offset=12 (local.get $range)))
    (if (i32.or (f32.ne (local.get $min) (f32.const 0)) (f32.ne (local.get $max) (f32.const 1))) (then
      (f32.store offset=8 (local.get $out)
        (f32.add (local.get $min)
          (f32.mul (f32.sub (local.get $max) (local.get $min)) (f32.load offset=8 (local.get $out))))))))

  ;; Private processed-VB metadata follows the public descriptor's 32 bytes.
  ;; Each record keeps clip XYZW, homogeneous screen XYZ, and a valid bit.
  ;; The third screen component is viewport depth, independent of clip Z.
  (func $d3dim_pv_clip_storage (param $entry i32) (param $op i32) (result i32)
    (local $desc i32) (local $ptr i32) (local $bytes i32)
    (local.set $desc (i32.load offset=16 (local.get $entry)))
    (if (i32.eqz (local.get $desc)) (then (return (i32.const 0))))
    (local.set $ptr (call $gl32 (i32.add (local.get $desc) (i32.const 32))))
    (if (i32.and (i32.eqz (local.get $ptr))
      (i32.ne (i32.and (local.get $op) (i32.const 4)) (i32.const 0))) (then
      (if (i32.gt_u (load.field DxObject misc2 (local.get $entry)) (i32.const 0x07ffffff)) (then (return (i32.const 0))))
      (local.set $bytes (i32.shl (load.field DxObject misc2 (local.get $entry)) (i32.const 5)))
      (local.set $ptr (call $heap_alloc (local.get $bytes)))
      (if (local.get $ptr) (then
        (call $guest_memset (local.get $ptr) (i32.const 0) (local.get $bytes))
        (call $gs32 (i32.add (local.get $desc) (i32.const 32)) (local.get $ptr))))))
    (local.get $ptr))

  (func $d3dim_pv_clip_allowed (param $entry i32) (result i32)
    (local $desc i32)
    (local.set $desc (i32.load offset=16 (local.get $entry)))
    (if (i32.eqz (local.get $desc)) (then (return (i32.const 0))))
    (i32.eqz (i32.and (call $gl32 (i32.add (local.get $desc) (i32.const 4))) (i32.const 1))))

  (func $d3dim_pv_clip_code (param $clip i32) (result i32)
    (local $code i32) (local $w f32)
    (local.set $w (f32.load offset=12 (local.get $clip)))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.le (f32.load offset=0 (local.get $clip)) (f32.neg (local.get $w))) (i32.const 0))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.gt (f32.load offset=0 (local.get $clip)) (local.get $w)) (i32.const 1))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.gt (f32.load offset=4 (local.get $clip)) (local.get $w)) (i32.const 2))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.le (f32.load offset=4 (local.get $clip)) (f32.neg (local.get $w))) (i32.const 3))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.le (f32.load offset=8 (local.get $clip)) (f32.const 0)) (i32.const 4))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.gt (f32.load offset=8 (local.get $clip)) (local.get $w)) (i32.const 5))))
    (local.get $code))

  (func $d3dim_pv_record (param $state i32) (param $op i32) (param $tl i32) (param $record i32)
    (local $sw i32) (local $clip i32) (local $status i32) (local $code i32) (local $w f32) (local $minz f32) (local $range f32)
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $clip (i32.add (local.get $sw) (i32.const 4064)))
    (local.set $status (i32.add (local.get $sw) (global.get $D3DIM_OFF_CLIP_STATUS)))
    (if (local.get $record) (then
      (i32.store offset=28 (local.get $record) (i32.and (local.get $op) (i32.const 4)))
      (if (i32.and (local.get $op) (i32.const 4)) (then
        (memory.copy (local.get $record) (local.get $clip) (i32.const 16))
        (local.set $w (f32.load offset=12 (local.get $clip)))
        (f32.store offset=16 (local.get $record)
          (f32.add (f32.mul (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))) (local.get $w))
            (f32.mul (f32.load (local.get $clip)) (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))))))
        (f32.store offset=20 (local.get $record)
          (f32.sub (f32.mul (f32.load offset=4 (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))) (local.get $w))
            (f32.mul (f32.load offset=4 (local.get $clip)) (f32.load offset=4 (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))))))
        (local.set $minz (f32.load offset=8 (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))))
        (local.set $range (f32.sub (f32.load offset=12 (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))) (local.get $minz)))
        (f32.store offset=24 (local.get $record)
          (f32.add (f32.mul (local.get $minz) (local.get $w))
            (f32.mul (local.get $range) (f32.load offset=8 (local.get $clip)))))))))
    (if (i32.and (local.get $op) (i32.const 4)) (then
      ;; Flags describe valid fields, not an opt-out from an explicit CLIP.
      ;; A new status accumulator starts at the SDK's D3DSTATUS_DEFAULT.
      (if (i32.eqz (i32.and (i32.load (local.get $status)) (i32.const 1))) (then
        (i32.store offset=4 (local.get $status) (i32.const 0x01fff000))
        (i32.store (local.get $status) (i32.or (i32.load (local.get $status)) (i32.const 1)))))
      (local.set $code (call $d3dim_pv_clip_code (local.get $clip)))
      (i32.store offset=4 (local.get $status)
        (i32.or (local.get $code) (i32.and (i32.load offset=4 (local.get $status))
          (i32.or (i32.const 0xfffc0fff) (i32.shl (local.get $code) (i32.const 12))))))))
    (if (i32.and (local.get $op) (i32.const 8)) (then
      (if (i32.eqz (i32.and (i32.load (local.get $status)) (i32.const 2))) (then
        (f32.store offset=8 (local.get $status) (f32.load (local.get $tl)))
        (f32.store offset=12 (local.get $status) (f32.load (local.get $tl)))
        (f32.store offset=16 (local.get $status) (f32.load offset=4 (local.get $tl)))
        (f32.store offset=20 (local.get $status) (f32.load offset=4 (local.get $tl)))))
      (f32.store offset=8 (local.get $status) (f32.min (f32.load offset=8 (local.get $status)) (f32.load offset=0 (local.get $tl))))
      (f32.store offset=12 (local.get $status) (f32.max (f32.load offset=12 (local.get $status)) (f32.load offset=0 (local.get $tl))))
      (f32.store offset=16 (local.get $status) (f32.min (f32.load offset=16 (local.get $status)) (f32.load offset=4 (local.get $tl))))
      (f32.store offset=20 (local.get $status) (f32.max (f32.load offset=20 (local.get $status)) (f32.load offset=4 (local.get $tl))))
      (i32.store (local.get $status) (i32.or (i32.load (local.get $status)) (i32.const 2))))))

  ;; Distances in the retained, un-divided clip space; vertex is 64 bytes.
  (func $d3dim_pv_distance (param $v i32) (param $plane i32) (result f32)
    (local $w f32)
    (local.set $w (f32.load offset=44 (local.get $v)))
    (if (i32.eqz (local.get $plane)) (then (return (f32.add (local.get $w) (f32.load offset=32 (local.get $v))))))
    (if (i32.eq (local.get $plane) (i32.const 1)) (then (return (f32.sub (local.get $w) (f32.load offset=32 (local.get $v))))))
    (if (i32.eq (local.get $plane) (i32.const 2)) (then (return (f32.sub (local.get $w) (f32.load offset=36 (local.get $v))))))
    (if (i32.eq (local.get $plane) (i32.const 3)) (then (return (f32.add (local.get $w) (f32.load offset=36 (local.get $v))))))
    (if (i32.eq (local.get $plane) (i32.const 4)) (then (return (f32.load offset=40 (local.get $v)))))
    (f32.sub (local.get $w) (f32.load offset=40 (local.get $v))))

  ;; SDK7 clipfrml.gif uses strict lower and inclusive upper boundaries.
  (func $d3dim_pv_inside (param $d f32) (param $plane i32) (result i32)
    (if (i32.or (i32.eqz (local.get $plane))
      (i32.or (i32.eq (local.get $plane) (i32.const 3)) (i32.eq (local.get $plane) (i32.const 4))))
      (then (return (f32.gt (local.get $d) (f32.const 0)))))
    (f32.ge (local.get $d) (f32.const 0)))

  (func $d3dim_pv_intersection (param $a i32) (param $b i32) (param $out i32) (param $plane i32)
    (local $da f32) (local $db f32) (local $t f32) (local $i i32)
    (local $av f32) (local $bv f32)
    (local.set $da (call $d3dim_pv_distance (local.get $a) (local.get $plane)))
    (local.set $db (call $d3dim_pv_distance (local.get $b) (local.get $plane)))
    (local.set $t (f32.div (local.get $da) (f32.sub (local.get $da) (local.get $db))))
    ;; Read both inputs before writing each component; out may alias either.
    (local.set $i (i32.const 32))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 60)))
      (local.set $av (f32.load (i32.add (local.get $a) (local.get $i))))
      (local.set $bv (f32.load (i32.add (local.get $b) (local.get $i))))
      (f32.store (i32.add (local.get $out) (local.get $i))
        (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
      (local.set $i (i32.add (local.get $i) (i32.const 4))) (br $lp)))
    (i32.store offset=16 (local.get $out) (call $d3dim_color_lerp
      (i32.load offset=16 (local.get $a)) (i32.load offset=16 (local.get $b)) (local.get $t)))
    (i32.store offset=20 (local.get $out) (call $d3dim_color_lerp
      (i32.load offset=20 (local.get $a)) (i32.load offset=20 (local.get $b)) (local.get $t)))
    (local.set $av (f32.load offset=24 (local.get $a)))
    (local.set $bv (f32.load offset=24 (local.get $b)))
    (f32.store offset=24 (local.get $out)
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (local.set $av (f32.load offset=28 (local.get $a)))
    (local.set $bv (f32.load offset=28 (local.get $b)))
    (f32.store offset=28 (local.get $out)
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (i32.store offset=60 (local.get $out) (i32.const 4)))

  (func $d3dim_pv_polygon (param $in i32) (param $count i32) (param $out i32) (param $plane i32) (result i32)
    (local $i i32) (local $n i32) (local $prev i32) (local $cur i32)
    (local $pd f32) (local $cd f32)
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (local.set $prev (i32.add (local.get $in) (i32.shl (i32.sub (local.get $count) (i32.const 1)) (i32.const 6))))
    (local.set $pd (call $d3dim_pv_distance (local.get $prev) (local.get $plane)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $cur (i32.add (local.get $in) (i32.shl (local.get $i) (i32.const 6))))
      (local.set $cd (call $d3dim_pv_distance (local.get $cur) (local.get $plane)))
      (if (i32.ne (call $d3dim_pv_inside (local.get $pd) (local.get $plane)) (call $d3dim_pv_inside (local.get $cd) (local.get $plane))) (then
        (call $d3dim_pv_intersection (local.get $prev) (local.get $cur)
          (i32.add (local.get $out) (i32.shl (local.get $n) (i32.const 6))) (local.get $plane))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (if (call $d3dim_pv_inside (local.get $cd) (local.get $plane)) (then
        (memory.copy (i32.add (local.get $out) (i32.shl (local.get $n) (i32.const 6))) (local.get $cur) (i32.const 64))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $prev (local.get $cur)) (local.set $pd (local.get $cd))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $lp)))
    (local.get $n))

  (func $d3dim_pv_project_record (param $v i32) (param $out i32)
    (local $q f32)
    (local.set $q (f32.div (f32.const 1) (f32.load offset=44 (local.get $v))))
    (f32.store (local.get $out) (f32.mul (f32.load offset=48 (local.get $v)) (local.get $q)))
    (f32.store offset=4 (local.get $out) (f32.mul (f32.load offset=52 (local.get $v)) (local.get $q)))
    (f32.store offset=8 (local.get $out) (f32.mul (f32.load offset=56 (local.get $v)) (local.get $q)))
    (f32.store offset=12 (local.get $out) (local.get $q))
    (memory.copy (i32.add (local.get $out) (i32.const 16)) (i32.add (local.get $v) (i32.const 16)) (i32.const 16)))

  ;; Clip before enqueue: consumers own canonical bytes, never VB sidecars.
  ;; Inputs are packed TL vertices and relative WORD indices, when present.
  (func $d3dim_pv_draw_clipped
    (param $this i32) (param $prim i32) (param $packed i32) (param $count i32)
    (param $records i32) (param $start i32) (param $indices i32) (param $index_count i32) (result i32)
    (local $scratch i32) (local $a i32) (local $b i32) (local $out i32)
    (local $i i32) (local $j i32) (local $idx i32) (local $n i32) (local $step i32)
    (local $end i32) (local $in_count i32) (local $out_count i32) (local $plane i32)
    (local $v i32) (local $record i32) (local $all i32) (local $tmp i32)
    (local $d0 f32) (local $d1 f32)
    (if (i32.or (i32.lt_u (local.get $prim) (i32.const 1)) (i32.gt_u (local.get $prim) (i32.const 6)))
      (then (return (i32.const 0x80070057))))
    (local.set $n (select (local.get $index_count) (local.get $count) (i32.ne (local.get $indices) (i32.const 0))))
    (local.set $in_count (select (i32.const 1) (select (i32.const 2) (i32.const 3) (i32.le_u (local.get $prim) (i32.const 3))) (i32.eq (local.get $prim) (i32.const 1))))
    (if (i32.lt_u (local.get $n) (local.get $in_count)) (then (return (i32.const 0))))
    (local.set $step (select (local.get $in_count) (i32.const 1)
      (i32.or (i32.eq (local.get $prim) (i32.const 2)) (i32.eq (local.get $prim) (i32.const 4)))))
    ;; Validate the complete index stream before any draw is published.
    (if (local.get $indices) (then
      (block $checked (loop $check
        (br_if $checked (i32.ge_u (local.get $i) (local.get $n)))
        (if (i32.ge_u (i32.load16_u (i32.add (call $g2w (local.get $indices)) (i32.shl (local.get $i) (i32.const 1)))) (local.get $count))
          (then (return (i32.const 0x80070057))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $check)))))
    ;; Two convex 12-vertex buffers and a 21-vertex triangle fan expansion.
    (local.set $scratch (call $heap_alloc (i32.const 2208)))
    (if (i32.eqz (local.get $scratch)) (then (return (i32.const 0x8007000e))))
    (local.set $a (call $g2w (local.get $scratch)))
    (local.set $b (i32.add (local.get $a) (i32.const 768)))
    (local.set $out (i32.add (local.get $a) (i32.const 1536)))
    (local.set $end (i32.sub (local.get $n) (local.get $in_count)))
    (local.set $i (i32.const 0))
    (block $done (loop $primitive
      (br_if $done (i32.gt_u (local.get $i) (local.get $end)))
      (local.set $j (i32.const 0)) (local.set $all (i32.const 1))
      (block $gathered (loop $gather
        (br_if $gathered (i32.ge_u (local.get $j) (local.get $in_count)))
        (local.set $idx (i32.add (local.get $i) (local.get $j)))
        (if (i32.eq (local.get $prim) (i32.const 6)) (then
          (local.set $idx (select (i32.const 0) (local.get $idx) (i32.eqz (local.get $j))))))
        (if (i32.and (i32.eq (local.get $prim) (i32.const 5))
          (i32.and (i32.ne (i32.and (local.get $i) (i32.const 1)) (i32.const 0)) (i32.lt_u (local.get $j) (i32.const 2)))) (then
          (local.set $idx (i32.add (local.get $i) (i32.xor (local.get $j) (i32.const 1))))))
        (if (local.get $indices) (then
          (local.set $idx (i32.load16_u (i32.add (call $g2w (local.get $indices)) (i32.shl (local.get $idx) (i32.const 1)))))))
        (local.set $v (i32.add (local.get $a) (i32.shl (local.get $j) (i32.const 6))))
        (local.set $record (i32.add (call $g2w (local.get $records)) (i32.shl (i32.add (local.get $start) (local.get $idx)) (i32.const 5))))
        (memory.copy (local.get $v) (i32.add (call $g2w (local.get $packed)) (i32.shl (local.get $idx) (i32.const 5))) (i32.const 32))
        (memory.copy (i32.add (local.get $v) (i32.const 32)) (local.get $record) (i32.const 32))
        (local.set $all (i32.and (local.get $all) (i32.ne (i32.load offset=28 (local.get $record)) (i32.const 0))))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $gather)))
      (local.set $out_count (i32.const 0))
      (block $emit
        (if (i32.eqz (local.get $all)) (then
          ;; Unprocessed ranges carry no generated clip flags.
          (local.set $j (i32.const 0))
          (block $copied (loop $copy
            (br_if $copied (i32.ge_u (local.get $j) (local.get $in_count)))
            (memory.copy (i32.add (local.get $out) (i32.shl (local.get $j) (i32.const 5)))
              (i32.add (local.get $a) (i32.shl (local.get $j) (i32.const 6))) (i32.const 32))
            (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $copy)))
          (local.set $out_count (local.get $in_count)) (br $emit)))
        (local.set $plane (i32.const 0)) (local.set $n (local.get $in_count))
        (block $clipped (loop $clip
          (br_if $clipped (i32.ge_u (local.get $plane) (i32.const 6)))
          (block $plane_done
            (local.set $d0 (call $d3dim_pv_distance (local.get $a) (local.get $plane)))
            (if (i32.eq (local.get $in_count) (i32.const 1)) (then
              (br_if $emit (i32.eqz (call $d3dim_pv_inside (local.get $d0) (local.get $plane))))
              (br $plane_done)))
            (if (i32.eq (local.get $in_count) (i32.const 2)) (then
              (local.set $d1 (call $d3dim_pv_distance (i32.add (local.get $a) (i32.const 64)) (local.get $plane)))
              (br_if $emit (i32.and (i32.eqz (call $d3dim_pv_inside (local.get $d0) (local.get $plane))) (i32.eqz (call $d3dim_pv_inside (local.get $d1) (local.get $plane)))))
              (if (i32.eqz (call $d3dim_pv_inside (local.get $d0) (local.get $plane)))
                (then (call $d3dim_pv_intersection (local.get $a) (i32.add (local.get $a) (i32.const 64)) (local.get $a) (local.get $plane)))
                (else (if (i32.eqz (call $d3dim_pv_inside (local.get $d1) (local.get $plane)))
                  (then (call $d3dim_pv_intersection (local.get $a) (i32.add (local.get $a) (i32.const 64)) (i32.add (local.get $a) (i32.const 64)) (local.get $plane))))))
              (br $plane_done)))
            (local.set $n (call $d3dim_pv_polygon (local.get $a) (local.get $n) (local.get $b) (local.get $plane)))
            (br_if $emit (i32.lt_u (local.get $n) (i32.const 3)))
            (local.set $tmp (local.get $a)) (local.set $a (local.get $b)) (local.set $b (local.get $tmp)))
          (local.set $plane (i32.add (local.get $plane) (i32.const 1))) (br $clip)))
        ;; A surviving eye-plane degeneracy has no projectable area.
        (local.set $j (i32.const 0))
        (block $positive (loop $wcheck
          (br_if $positive (i32.ge_u (local.get $j) (local.get $n)))
          (br_if $emit (f32.le (f32.load offset=44 (i32.add (local.get $a) (i32.shl (local.get $j) (i32.const 6)))) (f32.const 0)))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $wcheck)))
        (if (i32.lt_u (local.get $in_count) (i32.const 3)) (then
          (call $d3dim_pv_project_record (local.get $a) (local.get $out))
          (if (i32.eq (local.get $in_count) (i32.const 2)) (then
            (call $d3dim_pv_project_record (i32.add (local.get $a) (i32.const 64)) (i32.add (local.get $out) (i32.const 32)))))
          (local.set $out_count (local.get $in_count)))
          (else
            (local.set $j (i32.const 1))
            (block $fanned (loop $fan
              (br_if $fanned (i32.ge_u (i32.add (local.get $j) (i32.const 1)) (local.get $n)))
              (local.set $v (i32.add (local.get $out) (i32.shl (local.get $out_count) (i32.const 5))))
              (call $d3dim_pv_project_record (local.get $a) (local.get $v))
              (call $d3dim_pv_project_record (i32.add (local.get $a) (i32.shl (local.get $j) (i32.const 6))) (i32.add (local.get $v) (i32.const 32)))
              (call $d3dim_pv_project_record (i32.add (local.get $a) (i32.shl (i32.add (local.get $j) (i32.const 1)) (i32.const 6))) (i32.add (local.get $v) (i32.const 64)))
              (local.set $out_count (i32.add (local.get $out_count) (i32.const 3)))
              (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $fan))))))
      (if (local.get $out_count) (then
        (call $d3dim_draw_primitive (local.get $this)
          (select (i32.const 1) (select (i32.const 2) (i32.const 4) (i32.eq (local.get $in_count) (i32.const 2))) (i32.eq (local.get $in_count) (i32.const 1)))
          (i32.const 3) (i32.add (local.get $scratch) (i32.const 1536)) (local.get $out_count))))
      (local.set $i (i32.add (local.get $i) (local.get $step))) (br $primitive)))
    (call $heap_free (local.get $scratch)) (i32.const 0))

  ;; ProcessVerticesStrided accepts a source FVF (not a source index) after
  ;; twelve D3DDP_PTRSTRIDE pairs. See SDK7 imover_6uqs/imover_3grp and d3d.h.
  ;; Keep all input reads and fallible allocation before destination stores.
  (func $d3dim_pvs_object (param $this i32) (param $type i32) (result i32)
    (local $wa i32) (local $slot i32) (local $entry i32)
    (if (i32.eqz (local.get $this)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w_affine_span (local.get $this) (i32.const 8)))
    (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL)) (then (return (i32.const 0))))
    (local.set $slot (i32.load offset=4 (local.get $wa)))
    (if (i32.ge_u (local.get $slot) (global.get $DX_MAX)) (then (return (i32.const 0))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $slot) (i32.const 5))))
    (if (i32.or (i32.ne (load.field DxObject type (local.get $entry)) (local.get $type))
      (i32.le_s (load.field DxObject refcount (local.get $entry)) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.get $entry))

  ;; This method supports ordinary XYZ input and XYZRHW output, optional
  ;; normal/colors and up to eight dimensional UV sets. Reserved/blended
  ;; formats are rejected rather than using fvf_stride's compatibility fallback.
  (func $d3dim_pvs_fvf_valid (param $fvf i32) (param $position i32) (result i32)
    (local $sets i32)
    (if (i32.ne (i32.and (local.get $fvf) (i32.const 14)) (local.get $position))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $fvf) (i32.const 0xf021)) (then (return (i32.const 0))))
    (if (i32.and (i32.eq (local.get $position) (i32.const 4))
      (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $sets (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
    (if (i32.gt_u (local.get $sets) (i32.const 8)) (then (return (i32.const 0))))
    ;; Dimensional flags beyond the declared texture count are reserved here.
    (if (i32.and (i32.lt_u (local.get $sets) (i32.const 8))
      (i32.ne (i32.shr_u (local.get $fvf) (i32.add (i32.const 16) (i32.shl (local.get $sets) (i32.const 1)))) (i32.const 0)))
      (then (return (i32.const 0))))
    (i32.const 1))

  (func $d3dim_vb_process_vertices_strided
    (param $this i32) (param $op i32) (param $index i32) (param $count i32)
    (param $streams i32) (param $fvf i32) (param $device i32) (param $flags i32) (result i32)
    (local $entry i32) (local $dev i32) (local $state i32) (local $desc i32)
    (local $dst_fvf i32) (local $dst_stride i32) (local $dst i32) (local $capacity i32)
    (local $stride i32) (local $source i32) (local $source_wa i32)
    (local $packed i32) (local $packed_wa i32) (local $output i32) (local $output_wa i32)
    (local $table i32) (local $table_wa i32) (local $stream i32) (local $size i32)
    (local $pointer i32) (local $step i32) (local $span i32) (local $offset i32)
    (local $i i32) (local $j i32) (local $sets i32) (local $dst_sets i32)
    (local $dim i32) (local $dst_dim i32) (local $src_tex i32) (local $dst_tex i32)
    (local $src_color i32) (local $dst_color i32) (local $lit i32) (local $hr i32)
    (local $end i64) (local $clip_records i32)
    (local.set $hr (i32.const 0x80070057))
    (block $failed
      (br_if $failed (i32.eqz (i32.and (local.get $op) (i32.const 1))))
      (br_if $failed (i32.and (local.get $op) (i32.const -1038))) ;; known TRANSFORM|CLIP|EXTENTS|LIGHT
      (br_if $failed (i32.and (local.get $flags) (i32.const -2)))
      (local.set $hr (i32.const 0x88760800)) ;; D3DERR_INVALIDVERTEXFORMAT
      (br_if $failed (i32.eqz (call $d3dim_pvs_fvf_valid (local.get $fvf) (i32.const 2))))
      (br_if $failed (i32.and (i32.ne (i32.and (local.get $op) (i32.const 1024)) (i32.const 0))
        (i32.eqz (i32.and (local.get $fvf) (i32.const 16)))))
      (local.set $hr (i32.const 0x88760082)) ;; DDERR_INVALIDOBJECT
      (local.set $entry (call $d3dim_pvs_object (local.get $this) (i32.const 22)))
      (local.set $dev (call $d3dim_pvs_object (local.get $device) (i32.const 20)))
      (br_if $failed (i32.or (i32.eqz (local.get $entry)) (i32.eqz (local.get $dev))))
      (local.set $state (i32.load offset=16 (local.get $dev)))
      (br_if $failed (i32.eqz (local.get $state)))
      (local.set $dst_fvf (load.field DxObject misc1 (local.get $entry)))
      (local.set $hr (i32.const 0x88760800))
      (br_if $failed (i32.eqz (call $d3dim_pvs_fvf_valid (local.get $dst_fvf) (i32.const 4))))
      (br_if $failed (i32.and (i32.ne (i32.and (local.get $op) (i32.const 4)) (i32.const 0))
        (i32.eqz (call $d3dim_pv_clip_allowed (local.get $entry)))))
      (local.set $hr (i32.const 0x80004001))
      (br_if $failed (i32.and (i32.ne (i32.and (local.get $op) (i32.const 4)) (i32.const 0))
        (i32.ne (call $d3dim_d7_rs (call $g2w (local.get $state)) (i32.const 152)) (i32.const 0))))
      (local.set $hr (i32.const 0x887601ae)) ;; DDERR_SURFACEBUSY
      (br_if $failed (load.field DxObject flags (local.get $entry))) ;; VB Lock state
      (local.set $hr (i32.const 0x80004001))
      ;; Supplied coordinates are copied as declared. Texture transforms and
      ;; generated coordinates on processed output need a separate contract.
      (block $stages_done (loop $stages
        (br_if $stages_done (i32.ge_u (local.get $i) (i32.const 8)))
        (br_if $failed (call $d3dim_tss_load (local.get $state) (local.get $i) (i32.const 24)))
        (br_if $failed (i32.shr_u (call $d3dim_tss_load (local.get $state) (local.get $i) (i32.const 11)) (i32.const 16)))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $stages)))
      (br_if $failed (call $d3dim_d7_rs (call $g2w (local.get $state)) (i32.const 28))) ;; fog not computed
      (local.set $lit (i32.and (i32.ne (i32.and (local.get $op) (i32.const 1024)) (i32.const 0))
        (i32.eq (call $d3dim_d7_rs (call $g2w (local.get $state)) (i32.const 137)) (i32.const 1))))
      ;; The shared Device7 light stage deliberately skips an unconfigured
      ;; all-zero material with no light table. Do not report that skip as a
      ;; completed LIGHT operation here.
      (if (local.get $lit) (then
        (local.set $span (call $g2w (local.get $state)))
        (local.set $j (v128.any_true (v128.or
          (v128.load (i32.add (local.get $span) (global.get $D3DIM_OFF_D3D7_MAT)))
          (v128.or
            (v128.load offset=16 (i32.add (local.get $span) (global.get $D3DIM_OFF_D3D7_MAT)))
            (v128.load offset=48 (i32.add (local.get $span) (global.get $D3DIM_OFF_D3D7_MAT)))))))
        (br_if $failed (i32.and
          (i32.eqz (i32.load (i32.add (local.get $span) (global.get $D3DIM_OFF_D3D7_LIGHTS))))
          (i32.eqz (local.get $j))))))
      (local.set $dst_stride (call $d3dim_fvf_stride (local.get $dst_fvf)))
      (local.set $capacity (load.field DxObject misc2 (local.get $entry)))
      (local.set $hr (i32.const 0x80070057))
      (br_if $failed (i32.gt_u (local.get $index) (local.get $capacity)))
      (br_if $failed (i32.gt_u (local.get $count) (i32.sub (local.get $capacity) (local.get $index))))
      (br_if $failed (i32.gt_u (local.get $count) (i32.const 131072)))
      ;; Zero vertices is a validated no-op and never reads component storage.
      (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
      (local.set $dst (load.field DxObject misc0 (local.get $entry)))
      (br_if $failed (i32.eqz (local.get $dst)))
      (br_if $failed (i32.gt_u (local.get $capacity)
        (i32.div_u (i32.load offset=12 (local.get $entry)) (local.get $dst_stride))))
      (local.set $dst (i32.add (local.get $dst) (i32.mul (local.get $index) (local.get $dst_stride))))
      (br_if $failed (i32.eq (call $g2w_affine_span (local.get $dst) (i32.mul (local.get $count) (local.get $dst_stride))) (global.get $NULL_SENTINEL)))
      (br_if $failed (i32.eqz (local.get $streams)))
      (local.set $desc (call $g2w_affine_span (local.get $streams) (i32.const 96)))
      (br_if $failed (i32.eq (local.get $desc) (global.get $NULL_SENTINEL)))
      (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
      (local.set $sets (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 15)))
      ;; Owned descriptor snapshot stores affine pointers/strides/widths in
      ;; 12-byte rows. Do not reread caller descriptors after allocation.
      (local.set $hr (i32.const 0x8007000e))
      (local.set $table (call $heap_alloc (i32.const 144)))
      (br_if $failed (i32.eqz (local.get $table)))
      (local.set $table_wa (call $g2w (local.get $table)))
      (call $zero_memory (local.get $table_wa) (i32.const 144))
      (local.set $stream (i32.const 0))
      (block $streams_done (loop $validate
        (br_if $streams_done (i32.ge_u (local.get $stream) (i32.add (local.get $sets) (i32.const 4))))
        (local.set $size (i32.const 0))
        (if (i32.eqz (local.get $stream)) (then (local.set $size (i32.const 12))))
        (if (i32.and (i32.eq (local.get $stream) (i32.const 1))
          (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0))) (then (local.set $size (i32.const 12))))
        (if (i32.and (i32.eq (local.get $stream) (i32.const 2))
          (i32.ne (i32.and (local.get $fvf) (i32.const 64)) (i32.const 0))) (then (local.set $size (i32.const 4))))
        (if (i32.and (i32.eq (local.get $stream) (i32.const 3))
          (i32.ne (i32.and (local.get $fvf) (i32.const 128)) (i32.const 0))) (then (local.set $size (i32.const 4))))
        (if (i32.ge_u (local.get $stream) (i32.const 4)) (then
          (local.set $size (i32.shl (call $d3dim_fvf_tex_size (local.get $fvf) (i32.sub (local.get $stream) (i32.const 4))) (i32.const 2)))))
        (if (local.get $size) (then
          (local.set $pointer (i32.load (i32.add (local.get $desc) (i32.shl (local.get $stream) (i32.const 3)))))
          (local.set $step (i32.load offset=4 (i32.add (local.get $desc) (i32.shl (local.get $stream) (i32.const 3)))))
          (local.set $hr (i32.const 0x80070057))
          (br_if $failed (i32.eqz (local.get $pointer)))
          ;; Zero stride has no SDK7 fallback. Require a complete element.
          (br_if $failed (i32.lt_u (local.get $step) (local.get $size)))
          (local.set $end (i64.add (i64.extend_i32_u (local.get $size))
            (i64.mul (i64.extend_i32_u (i32.sub (local.get $count) (i32.const 1))) (i64.extend_i32_u (local.get $step)))))
          (br_if $failed (i64.gt_u (i64.add (i64.extend_i32_u (local.get $pointer)) (local.get $end)) (i64.const 0x100000000)))
          (local.set $span (call $g2w_affine_span (local.get $pointer) (i32.wrap_i64 (local.get $end))))
          (br_if $failed (i32.eq (local.get $span) (global.get $NULL_SENTINEL)))
          (i32.store (i32.add (local.get $table_wa) (i32.mul (local.get $stream) (i32.const 12))) (local.get $span))
          (i32.store offset=4 (i32.add (local.get $table_wa) (i32.mul (local.get $stream) (i32.const 12))) (local.get $step))
          (i32.store offset=8 (i32.add (local.get $table_wa) (i32.mul (local.get $stream) (i32.const 12))) (local.get $size))))
        (local.set $stream (i32.add (local.get $stream) (i32.const 1))) (br $validate)))
      (local.set $hr (i32.const 0x8007000e))
      (local.set $source (call $heap_alloc (i32.mul (local.get $count) (local.get $stride))))
      (br_if $failed (i32.eqz (local.get $source)))
      (local.set $source_wa (call $g2w (local.get $source)))
      (local.set $stream (i32.const 0)) (local.set $offset (i32.const 0))
      (block $gathered (loop $gather
        (br_if $gathered (i32.ge_u (local.get $stream) (i32.add (local.get $sets) (i32.const 4))))
        (local.set $span (i32.add (local.get $table_wa) (i32.mul (local.get $stream) (i32.const 12))))
        (local.set $size (i32.load offset=8 (local.get $span)))
        (if (local.get $size) (then
          (local.set $pointer (i32.load (local.get $span)))
          (local.set $step (i32.load offset=4 (local.get $span)))
          (local.set $i (i32.const 0))
          (block $component_done (loop $component
            (br_if $component_done (i32.ge_u (local.get $i) (local.get $count)))
            (call $memcpy (i32.add (i32.add (local.get $source_wa) (local.get $offset)) (i32.mul (local.get $i) (local.get $stride)))
              (i32.add (local.get $pointer) (i32.mul (local.get $i) (local.get $step))) (local.get $size))
            (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $component)))
          (local.set $offset (i32.add (local.get $offset) (local.get $size)))))
        (local.set $stream (i32.add (local.get $stream) (i32.const 1))) (br $gather)))
      (local.set $packed (call $d3dim_pack_fvf_vertices (local.get $fvf) (local.get $source) (local.get $count) (i32.const 0)))
      (br_if $failed (i32.eqz (local.get $packed)))
      (local.set $packed_wa (call $g2w (local.get $packed)))
      (local.set $src_color (select (i32.const 24) (i32.const 12) (i32.ne (i32.and (local.get $fvf) (i32.const 16)) (i32.const 0))))
      ;; Canonical normals overlap colors. Supply colors from original records,
      ;; then light from the separate gathered normals; projection uses type 2.
      (local.set $i (i32.const 0))
      (block $colors_done (loop $colors
        (br_if $colors_done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $pointer (i32.add (i32.add (local.get $source_wa) (i32.mul (local.get $i) (local.get $stride))) (local.get $src_color)))
        (local.set $span (i32.add (local.get $packed_wa) (i32.shl (local.get $i) (i32.const 5))))
        (i32.store offset=16 (local.get $span) (i32.const 0))
        (i32.store offset=20 (local.get $span) (i32.const 0))
        (if (i32.and (local.get $fvf) (i32.const 64)) (then
          (i32.store offset=16 (local.get $span) (i32.load (local.get $pointer)))
          (local.set $pointer (i32.add (local.get $pointer) (i32.const 4)))))
        (if (i32.and (local.get $fvf) (i32.const 128)) (then
          (i32.store offset=20 (local.get $span) (i32.load (local.get $pointer)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $colors)))
      (if (local.get $lit) (then
        (drop (call $d3dim_d7_light_vertices (local.get $device) (local.get $fvf) (local.get $source) (local.get $packed) (local.get $count) (i32.const 2)))))
      (local.set $output (call $heap_alloc (i32.add (i32.mul (local.get $count) (local.get $dst_stride)) (i32.const 32))))
      (br_if $failed (i32.eqz (local.get $output)))
      (local.set $clip_records (call $d3dim_pv_clip_storage (local.get $entry) (local.get $op)))
      (br_if $failed (i32.and (i32.ne (i32.and (local.get $op) (i32.const 4)) (i32.const 0))
        (i32.eqz (local.get $clip_records))))
      (local.set $output_wa (call $g2w (local.get $output)))
      (call $memcpy (local.get $output_wa) (call $g2w (local.get $dst)) (i32.mul (local.get $count) (local.get $dst_stride)))
      (call $d3ddev_composite_wvp (local.get $state))
      (local.set $dst_sets (i32.and (i32.shr_u (local.get $dst_fvf) (i32.const 8)) (i32.const 15)))
      (local.set $src_tex (i32.sub (local.get $stride) (call $d3dim_fvf_tex_offset (local.get $fvf) (local.get $sets))))
      (local.set $dst_tex (i32.sub (local.get $dst_stride) (call $d3dim_fvf_tex_offset (local.get $dst_fvf) (local.get $dst_sets))))
      (local.set $i (i32.const 0))
      (block $processed (loop $process
        (br_if $processed (i32.ge_u (local.get $i) (local.get $count)))
        ;; Projection writes a canonical 32-byte record into trailing scratch.
        (local.set $span (i32.add (local.get $output_wa) (i32.mul (local.get $count) (local.get $dst_stride))))
        (call $vertex_project (local.get $state) (i32.add (local.get $packed_wa) (i32.shl (local.get $i) (i32.const 5))) (local.get $span))
        (call $d3dim_process_viewport_depth (local.get $state) (local.get $span))
        (call $d3dim_pv_record (local.get $state) (local.get $op) (local.get $span)
          (if (result i32) (local.get $clip_records)
            (then (i32.add (call $g2w (local.get $clip_records)) (i32.shl (i32.add (local.get $index) (local.get $i)) (i32.const 5))))
            (else (i32.const 0))))
        (local.set $pointer (i32.add (local.get $output_wa) (i32.mul (local.get $i) (local.get $dst_stride))))
        (call $memcpy (local.get $pointer) (local.get $span) (i32.const 16))
        (local.set $dst_color (i32.const 16))
        (local.set $span (i32.add (local.get $packed_wa) (i32.shl (local.get $i) (i32.const 5))))
        (if (i32.and (local.get $dst_fvf) (i32.const 64)) (then
          (if (i32.or (local.get $lit) (i32.eqz (local.get $flags))) (then
            (i32.store offset=16 (local.get $pointer) (i32.load offset=16 (local.get $span)))))
          (local.set $dst_color (i32.const 20))))
        (if (i32.and (local.get $dst_fvf) (i32.const 128)) (then
          (if (i32.or (local.get $lit) (i32.eqz (local.get $flags))) (then
            (i32.store (i32.add (local.get $pointer) (local.get $dst_color)) (i32.load offset=20 (local.get $span)))))))
        (if (i32.eqz (local.get $flags)) (then
          (local.set $stream (i32.const 0))
          (local.set $offset (local.get $dst_tex))
          (local.set $span (i32.add (i32.add (local.get $source_wa) (i32.mul (local.get $i) (local.get $stride))) (local.get $src_tex)))
          (block $texture_done (loop $texture
            (br_if $texture_done (i32.ge_u (local.get $stream) (local.get $dst_sets)))
            (local.set $dim (i32.const 0))
            (if (i32.lt_u (local.get $stream) (local.get $sets)) (then
              (local.set $dim (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $stream)))))
            (local.set $dst_dim (call $d3dim_fvf_tex_size (local.get $dst_fvf) (local.get $stream)))
            (local.set $j (i32.const 0))
            (block $tex_component_done (loop $tex_component
              (br_if $tex_component_done (i32.ge_u (local.get $j) (local.get $dst_dim)))
              (i32.store (i32.add (i32.add (local.get $pointer) (local.get $offset)) (i32.shl (local.get $j) (i32.const 2)))
                (if (result i32) (i32.lt_u (local.get $j) (local.get $dim))
                  (then (i32.load (i32.add (local.get $span) (i32.shl (local.get $j) (i32.const 2))))) (else (i32.const 0))))
              (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $tex_component)))
            (local.set $span (i32.add (local.get $span) (i32.shl (local.get $dim) (i32.const 2))))
            (local.set $offset (i32.add (local.get $offset) (i32.shl (local.get $dst_dim) (i32.const 2))))
            (local.set $stream (i32.add (local.get $stream) (i32.const 1))) (br $texture)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $process)))
      (call $memcpy (call $g2w (local.get $dst)) (local.get $output_wa) (i32.mul (local.get $count) (local.get $dst_stride)))
      (local.set $hr (i32.const 0)))
    (if (local.get $output) (then (call $heap_free (local.get $output))))
    (if (local.get $packed) (then (call $heap_free (local.get $packed))))
    (if (local.get $source) (then (call $heap_free (local.get $source))))
    (if (local.get $table) (then (call $heap_free (local.get $table))))
    (local.get $hr))

  ;; All VB interface versions share the same object flags/lock state.
  (func $d3dim_vb_unlock (param $this i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $d3dim_pvs_object (local.get $this) (i32.const 22)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0x88760082))))
    (store.field DxObject flags (local.get $entry) (i32.const 0))
    (i32.const 0))

  ;; IDirect3DVertexBuffer::ProcessVertices -- transform and light dwCount
  ;; vertices out of lpSrcBuffer INTO this buffer, which the caller then draws
  ;; from with the transform already applied. Half-Life's D3D renderer batches
  ;; every frame this way, so a stub that returns S_OK without doing the work
  ;; leaves the destination as the zeros CreateVertexBuffer wrote and collapses
  ;; the frame to a single point.
  ;;
  ;; The maths is the one $d3dim_draw_primitive already runs for untransformed
  ;; vertices, reused rather than rebuilt: pack the source FVF into the
  ;; canonical 32-byte vertex, project and light it through
  ;; $d3dim_prepare_draw_vertex, then unpack into the destination's own FVF.
  ;; LIGHT first applies Device7 material/source/light state to the packed
  ;; colours, using the original FVF normals just as Device7 VB draws do.
  ;; TRANSFORM is mandatory. CLIP retains homogeneous coordinates privately;
  ;; EXTENTS accumulates the device screen rectangle during processing.
  ;; ProcessVertices consumes these bytes synchronously. VB draw paths either
  ;; consume them inline or copy them into an owned command-stream packet
  ;; before returning; none calls guest code. The per-instance buffer therefore
  ;; supports both without sharing mutable input with another guest/renderer.
  ;; Packing the whole source before writing still supports overlapping VBs.
  (global $d3dim_fvf_buffer (mut i32) (i32.const 0))
  (global $d3dim_fvf_capacity (mut i32) (i32.const 0))
  (func $d3dim_fvf_scratch_reserve (param $count i32) (result i32)
    (local $need i32) (local $cap i32) (local $grown i32)
    (if (i32.gt_u (local.get $count) (i32.const 0x20000))
      (then (return (i32.const 0))))
    (local.set $need (i32.add (i32.shl (local.get $count) (i32.const 5)) (i32.const 32)))
    (if (i32.gt_u (local.get $need) (global.get $d3dim_fvf_capacity)) (then
      (local.set $cap (select (global.get $d3dim_fvf_capacity) (i32.const 1024)
        (i32.ne (global.get $d3dim_fvf_capacity) (i32.const 0))))
      (block $sized (loop $grow
        (br_if $sized (i32.ge_u (local.get $cap) (local.get $need)))
        (local.set $cap (i32.shl (local.get $cap) (i32.const 1)))
        (br $grow)))
      (if (i32.gt_u (local.get $cap) (i32.const 0x400020))
        (then (local.set $cap (i32.const 0x400020))))
      (local.set $grown (call $heap_alloc (local.get $cap)))
      (if (i32.eqz (local.get $grown)) (then (return (i32.const 0))))
      (if (global.get $d3dim_fvf_buffer)
        (then (call $heap_free (global.get $d3dim_fvf_buffer))))
      (global.set $d3dim_fvf_buffer (local.get $grown))
      (global.set $d3dim_fvf_capacity (local.get $cap))))
    (global.get $d3dim_fvf_buffer))

  (func $d3dim_pack_fvf_scratch
    (param $fvf i32) (param $src i32) (param $count i32) (param $tex_index i32) (result i32)
    (local $dst i32)
    (local.set $dst (call $d3dim_fvf_scratch_reserve (local.get $count)))
    (if (i32.eqz (local.get $dst)) (then (return (i32.const 0))))
    (call $d3dim_pack_fvf_vertices_into (local.get $fvf) (local.get $src)
      (local.get $count) (local.get $tex_index) (local.get $dst)))

  (func $d3dim_vb_process_vertices
      (param $dst_this i32) (param $vertex_op i32) (param $dest_index i32) (param $count i32)
      (param $src_this i32) (param $src_index i32) (param $device i32) (param $flags i32)
      (result i32)
    (local $dst_entry i32) (local $src_entry i32)
    (local $src_data_g i32) (local $src_size i32) (local $src_fvf i32)
    (local $src_stride i32) (local $src_vtx i32) (local $src_max i32)
    (local $dst_data_g i32) (local $dst_size i32) (local $dst_fvf i32)
    (local $dst_stride i32) (local $dst_max i32)
    (local $state i32) (local $packed_g i32) (local $packed_wa i32)
    (local $scratch_g i32) (local $scratch_wa i32) (local $dst_wa i32) (local $i i32)
    (local $dbg_key i32)
    (local $source_g i32) (local $source_copy i32) (local $clip_records i32)
    (if (i32.or (i32.eqz (i32.and (local.get $vertex_op) (i32.const 1)))
      (i32.or (i32.ne (i32.and (local.get $vertex_op) (i32.const -1038)) (i32.const 0))
        (i32.ne (i32.and (local.get $flags) (i32.const -2)) (i32.const 0))))
      (then (return (i32.const 0x80070057))))
    (if (i32.and (local.get $vertex_op) (i32.const 12)) (then
      (if (i32.or
        (i32.eqz (call $d3dim_pvs_object (local.get $dst_this) (i32.const 22)))
        (i32.eqz (call $d3dim_pvs_object (local.get $src_this) (i32.const 22))))
        (then (return (i32.const 0x88760082))))
      (if (i32.eqz (call $d3dim_pvs_object (local.get $device) (i32.const 20)))
        (then (return (i32.const 0x88760082))))))
    (if (i32.or (i32.eqz (local.get $dst_this)) (i32.eqz (local.get $src_this)))
      (then (return (i32.const 0x80004003))))  ;; E_POINTER
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (local.set $state (call $d3ddev_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x80004003))))
    (local.set $dst_entry (call $dx_from_this (local.get $dst_this)))
    (local.set $src_entry (call $dx_from_this (local.get $src_this)))
    (if (i32.or (i32.eqz (local.get $dst_entry)) (i32.eqz (local.get $src_entry)))
      (then (return (i32.const 0x80004003))))
    (if (i32.and (local.get $vertex_op) (i32.const 4)) (then
      (if (i32.eqz (call $d3dim_pv_clip_allowed (local.get $dst_entry)))
        (then (return (i32.const 0x88760800))))
      (if (call $d3dim_d7_rs (call $g2w (local.get $state)) (i32.const 152))
        (then (return (i32.const 0x80004001))))))
    (if (i32.and (local.get $vertex_op) (i32.const 12)) (then
      (if (i32.or (load.field DxObject flags (local.get $src_entry)) (load.field DxObject flags (local.get $dst_entry)))
        (then (return (i32.const 0x887601ae))))
      (if (i32.or
        (i32.eqz (call $d3dim_pvs_fvf_valid (load.field DxObject misc1 (local.get $src_entry)) (i32.const 2)))
        (i32.eqz (call $d3dim_pvs_fvf_valid (load.field DxObject misc1 (local.get $dst_entry)) (i32.const 4))))
        (then (return (i32.const 0x88760800))))))
    (local.set $src_data_g (load.field DxObject misc0 (local.get $src_entry)))
    (local.set $dst_data_g (load.field DxObject misc0 (local.get $dst_entry)))
    (if (i32.or (i32.eqz (local.get $src_data_g)) (i32.eqz (local.get $dst_data_g)))
      (then (return (i32.const 0x8007000E))))  ;; E_OUTOFMEMORY
    (local.set $src_size (i32.load (i32.add (local.get $src_entry) (i32.const 12))))
    (local.set $dst_size (i32.load (i32.add (local.get $dst_entry) (i32.const 12))))
    (local.set $src_fvf (load.field DxObject misc1 (local.get $src_entry)))
    (local.set $dst_fvf (load.field DxObject misc1 (local.get $dst_entry)))
    (if (i32.or
      (i32.gt_u (i32.and (i32.shr_u (local.get $src_fvf) (i32.const 8)) (i32.const 15)) (i32.const 8))
      (i32.gt_u (i32.and (i32.shr_u (local.get $dst_fvf) (i32.const 8)) (i32.const 15)) (i32.const 8)))
      (then (return (i32.const 0x80070057))))
    ;; A destination whose descriptor never reached us has no layout to unpack
    ;; into; the output of a transform is TLVERTEX, so say so explicitly rather
    ;; than let $d3dim_fvf_stride's 32-byte fallback imply it.
    (if (i32.eqz (i32.and (local.get $dst_fvf) (i32.const 0x0006)))
      (then (local.set $dst_fvf (i32.const 0x1C4)))) ;; XYZRHW|DIFFUSE|SPECULAR|TEX1
    (local.set $src_vtx (call $d3dim_fvf_vtxtype (local.get $src_fvf)))
    ;; A source with no position bits carries nothing to transform.
    (if (i32.eqz (local.get $src_vtx)) (then (return (i32.const 0x80070057)))) ;; E_INVALIDARG
    (local.set $src_stride (call $d3dim_fvf_stride (local.get $src_fvf)))
    (local.set $dst_stride (call $d3dim_fvf_stride (local.get $dst_fvf)))
    ;; kind=24 PVtx: the source and destination layouts this transform saw.
    ;; The destination FVF is the one that decides whether the later
    ;; DrawIndexedPrimitiveVB treats these vertices as already transformed;
    ;; if it does not, they are transformed a second time and the frame
    ;; collapses. Report it rather than infer it.
    (local.set $dbg_key (i32.xor (local.get $src_fvf)
      (i32.shl (local.get $dst_fvf) (i32.const 16))))
    (if (i32.ne (local.get $dbg_key) (global.get $d3dim_dbg_pv_last)) (then
      (global.set $d3dim_dbg_pv_last (local.get $dbg_key))
      (call $host_dx_trace (i32.const 24) (local.get $count)
        (local.get $src_fvf) (local.get $dst_fvf)
        (i32.or (local.get $src_stride)
                (i32.shl (local.get $dst_stride) (i32.const 16))))))
    ;; Clamp against what both buffers actually hold rather than trusting the
    ;; caller's count: an over-long batch would otherwise walk off the heap
    ;; block $d3dim_create_vb sized from the declared vertex count.
    (local.set $src_max (i32.div_u (local.get $src_size) (local.get $src_stride)))
    (local.set $dst_max (i32.div_u (local.get $dst_size) (local.get $dst_stride)))
    (if (i32.or (i32.ge_u (local.get $src_index) (local.get $src_max))
                (i32.ge_u (local.get $dest_index) (local.get $dst_max)))
      (then (return (i32.const 0x80070057))))
    (if (i32.gt_u (local.get $count) (i32.sub (local.get $src_max) (local.get $src_index)))
      (then (local.set $count (i32.sub (local.get $src_max) (local.get $src_index)))))
    (if (i32.gt_u (local.get $count) (i32.sub (local.get $dst_max) (local.get $dest_index)))
      (then (local.set $count (i32.sub (local.get $dst_max) (local.get $dest_index)))))
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (local.set $source_g (i32.add (local.get $src_data_g) (i32.mul (local.get $src_index) (local.get $src_stride))))
    ;; Overlapping ranges in the same VB must read the pre-call coordinates,
    ;; just as the canonical position/light pack already does.
    (if (i32.eq (local.get $src_data_g) (local.get $dst_data_g)) (then
      (local.set $source_copy (call $heap_alloc (i32.mul (local.get $count) (local.get $src_stride))))
      (if (i32.eqz (local.get $source_copy)) (then (return (i32.const 0x8007000E))))
      (call $guest_memmove (local.get $source_copy) (local.get $source_g) (i32.mul (local.get $count) (local.get $src_stride)))
      (local.set $source_g (local.get $source_copy))))
    (local.set $packed_g (call $d3dim_fvf_scratch_reserve (local.get $count)))
    (if (i32.eqz (local.get $packed_g)) (then
      (if (local.get $source_copy) (then (call $heap_free (local.get $source_copy))))
      (return (i32.const 0x8007000E))))
    (local.set $packed_g (call $d3dim_pack_fvf_vertices_into
      (local.get $src_fvf)
      (local.get $source_g)
      (local.get $count)
      (call $d3dim_texcoord_index (local.get $device)) (local.get $packed_g)))
    (if (i32.eqz (local.get $packed_g)) (then
      (if (local.get $source_copy) (then (call $heap_free (local.get $source_copy))))
      (return (i32.const 0x8007000E))))
    (if (i32.and (local.get $vertex_op) (i32.const 0x400)) (then
      (local.set $src_vtx (call $d3dim_d7_light_vertices
        (local.get $device) (local.get $src_fvf) (local.get $source_g)
        (local.get $packed_g) (local.get $count) (local.get $src_vtx)))))
    ;; One scratch TLVERTEX for the whole call. Transforming in place would
    ;; alias $vertex_project's source with its destination.
    (local.set $scratch_g (i32.add (local.get $packed_g)
      (i32.shl (local.get $count) (i32.const 5))))
    (local.set $clip_records (call $d3dim_pv_clip_storage (local.get $dst_entry) (local.get $vertex_op)))
    (if (i32.and (i32.ne (i32.and (local.get $vertex_op) (i32.const 4)) (i32.const 0))
      (i32.eqz (local.get $clip_records))) (then
      (if (local.get $source_copy) (then (call $heap_free (local.get $source_copy))))
      (return (i32.const 0x8007000e))))
    (call $d3ddev_composite_wvp (local.get $state))
    (call $d3dim_lights_refresh (local.get $state))
    (local.set $packed_wa (call $g2w (local.get $packed_g)))
    (local.set $scratch_wa (call $g2w (local.get $scratch_g)))
    (local.set $dst_wa (call $g2w
      (i32.add (local.get $dst_data_g) (i32.mul (local.get $dest_index) (local.get $dst_stride)))))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (call $d3dim_prepare_draw_vertex
        (local.get $state) (local.get $src_vtx)
        (i32.add (local.get $packed_wa) (i32.shl (local.get $i) (i32.const 5)))
        (local.get $scratch_wa))
      ;; Already transformed sources retain supplied depth, as before.
      (if (i32.ne (local.get $src_vtx) (i32.const 3)) (then
        (call $d3dim_process_viewport_depth (local.get $state) (local.get $scratch_wa))))
      (call $d3dim_pv_record (local.get $state) (local.get $vertex_op) (local.get $scratch_wa)
        (if (result i32) (local.get $clip_records)
          (then (i32.add (call $g2w (local.get $clip_records)) (i32.shl (i32.add (local.get $dest_index) (local.get $i)) (i32.const 5))))
          (else (i32.const 0))))
      (call $d3dim_unpack_tl_vertex_fields
        (local.get $dst_fvf) (local.get $scratch_wa)
        (i32.add (local.get $dst_wa) (i32.mul (local.get $i) (local.get $dst_stride)))
        (select
          (select (i32.const 2) (i32.const 0)
            (i32.and
              (i32.ne (i32.and (local.get $vertex_op) (i32.const 1024)) (i32.const 0))
              (i32.eq (call $d3dim_d7_rs (call $g2w (local.get $state)) (i32.const 137)) (i32.const 1))))
          (i32.const 3) (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))))
      (if (i32.eqz (i32.and (local.get $flags) (i32.const 1))) (then
        (call $d3dim_vb_copy_texcoords
          (local.get $src_fvf) (call $g2w (i32.add (local.get $source_g) (i32.mul (local.get $i) (local.get $src_stride))))
          (local.get $dst_fvf) (i32.add (local.get $dst_wa) (i32.mul (local.get $i) (local.get $dst_stride)))
          (select (i32.add (local.get $scratch_wa) (i32.const 24)) (i32.const 0)
            (i32.gt_u (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11)) (i32.const 0xffff))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    ;; kind=20 SetMtx over the composite world*view*projection actually used,
    ;; and kind=26 PVout for the first vertex it produced. Together these say
    ;; whether a missing world is a bad matrix or a bad vertex: the HUD is
    ;; correct on this same device because it supplies TLVERTEX and never
    ;; touches a matrix, so the matrices are only observable here. Both are
    ;; per-call, so window them with --trace-from/--trace-to.
    ;; The composite, tagged 0xC0FFEE so it reads apart from the guest's own
    ;; SetTransform records. A composite can be internally consistent -- a
    ;; proper rotation, a plausible eye -- and still describe a camera the
    ;; guest never asked for, which is what a large BEHIND-EYE share below
    ;; means. When it disagrees with the guest, the kind=27 Xform records are
    ;; the sequence that built it.
    (call $host_dx_trace (i32.const 20) (i32.const 0xC0FFEE)
      (i32.add (call $g2w (local.get $state)) (i32.const 192))
      (i32.const 0) (i32.const 0))
    (call $host_dx_trace (i32.const 26) (local.get $count)
      (i32.load (local.get $dst_wa))
      (i32.load (i32.add (local.get $dst_wa) (i32.const 4)))
      (i32.load (i32.add (local.get $dst_wa) (i32.const 12))))
    (if (local.get $source_copy) (then (call $heap_free (local.get $source_copy))))
    (i32.const 0))

  (func $d3dim_vb_draw_primitive
    (param $this i32) (param $primType i32) (param $vb i32) (param $start i32) (param $count i32)
    (local $entry i32) (local $data_g i32) (local $size i32) (local $fvf i32)
    (local $stride i32) (local $max_count i32) (local $vtxType i32) (local $packed i32)
    (local $supplied i32) (local $extended i32) (local $clip_records i32) (local $hr i32)
    (if (i32.or (i32.eqz (local.get $vb)) (i32.eqz (local.get $count)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $entry (call $dx_from_this (local.get $vb)))
    (local.set $data_g (load.field DxObject misc0 (local.get $entry)))
    (local.set $size (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (local.set $fvf (load.field DxObject misc1 (local.get $entry)))
    (if (i32.eqz (call $d3dim_fvf_supplied_valid (local.get $this) (local.get $fvf))) (then
      (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $fvf)))
    (if (i32.eqz (local.get $vtxType))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $max_count (i32.div_u (local.get $size) (local.get $stride)))
    (if (i32.ge_u (local.get $start) (local.get $max_count))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.gt_u (local.get $count) (i32.sub (local.get $max_count) (local.get $start)))
      (then (local.set $count (i32.sub (local.get $max_count) (local.get $start)))))
    (local.set $packed (call $d3dim_pack_fvf_scratch
      (local.get $fvf)
      (i32.add (local.get $data_g) (i32.mul (local.get $start) (local.get $stride)))
      (local.get $count)
      (call $d3dim_texcoord_index (local.get $this))))
    (local.set $vtxType (call $d3dim_d7_light_vertices (local.get $this) (local.get $fvf)
      (i32.add (local.get $data_g) (i32.mul (local.get $start) (local.get $stride)))
      (local.get $packed) (local.get $count) (local.get $vtxType)))
    ;; Use the same supplied-vector representation as immediate FVF draws.
    ;; The original records begin at start, including for relative indices.
    (if (i32.lt_u (local.get $vtxType) (i32.const 3)) (then
      (local.set $supplied (call $d3dim_d7_supplied_type (local.get $this)))))
    (if (i32.and (i32.ne (local.get $packed) (i32.const 0))
                 (i32.ne (local.get $supplied) (i32.const 0))) (then
      (local.set $extended (call $d3dim_d7_supplied_vertices
        (local.get $this) (local.get $fvf)
        (i32.add (local.get $data_g) (i32.mul (local.get $start) (local.get $stride)))
        (local.get $packed) (local.get $count) (local.get $vtxType)))
      ;; The canonical input is borrowed per-instance scratch. Only the
      ;; expanded supplied-vector representation belongs to this draw.
      (local.set $packed (local.get $extended))
      (local.set $vtxType (local.get $supplied))))
    (local.set $clip_records (call $d3dim_pv_clip_storage (local.get $entry) (i32.const 0)))
    (if (i32.and (i32.ne (local.get $packed) (i32.const 0))
      (i32.and (i32.eq (local.get $vtxType) (i32.const 3)) (i32.ne (local.get $clip_records) (i32.const 0)))) (then
      (local.set $hr (call $d3dim_pv_draw_clipped (local.get $this) (local.get $primType)
        (local.get $packed) (local.get $count) (local.get $clip_records) (local.get $start)
        (i32.const 0) (i32.const 0)))
      (if (local.get $extended) (then (call $heap_free (local.get $extended))))
      (i32.store (global.get $reg_base) (local.get $hr)) (return)))
    (if (local.get $packed) (then
      (call $d3dim_draw_primitive
        (local.get $this) (local.get $primType) (local.get $vtxType)
        (local.get $packed) (local.get $count))))
    (if (local.get $extended) (then (call $heap_free (local.get $extended))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_vb_draw_indexed_primitive
    (param $this i32) (param $primType i32) (param $vb i32) (param $start i32) (param $count i32)
    (param $indices i32) (param $index_count i32)
    (local $entry i32) (local $data_g i32) (local $size i32) (local $fvf i32)
    (local $stride i32) (local $max_count i32) (local $vtxType i32) (local $packed i32)
    (local $supplied i32) (local $extended i32) (local $clip_records i32) (local $hr i32)
    (local $dbg_key i32) (local $ibase_wa i32) (local $i i32) (local $idx i32) (local $need i32)
    (if (i32.or
          (i32.or (i32.eqz (local.get $vb)) (i32.eqz (local.get $count)))
          (i32.or (i32.eqz (local.get $indices)) (i32.eqz (local.get $index_count))))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $entry (call $dx_from_this (local.get $vb)))
    (local.set $data_g (load.field DxObject misc0 (local.get $entry)))
    (local.set $size (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (local.set $fvf (load.field DxObject misc1 (local.get $entry)))
    (if (i32.eqz (call $d3dim_fvf_supplied_valid (local.get $this) (local.get $fvf))) (then
      (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $fvf)))
    (if (i32.eqz (local.get $vtxType))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $max_count (i32.div_u (local.get $size) (local.get $stride)))
    (if (i32.ge_u (local.get $start) (local.get $max_count))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.gt_u (local.get $count) (i32.sub (local.get $max_count) (local.get $start)))
      (then (local.set $count (i32.sub (local.get $max_count) (local.get $start)))))
    ;; DrawIndexedPrimitiveVB has no vertex count in its signature -- the whole
    ;; buffer is the pool and the indices choose from it -- so the callers pass
    ;; count=-1 and the clamp above turns that into the buffer's CAPACITY. That
    ;; is a real buffer: Half-Life's is 32768 vertices, so packing it whole cost
    ;; a 1MB $heap_alloc and 32768 conversions on every draw, ~164 draws a
    ;; frame, to rasterize the handful of vertices the indices name. Worse than
    ;; slow: when that 1MB allocation fails the pack returns 0 and the draw is
    ;; dropped in silence, which is most of a frame's world geometry going
    ;; missing with nothing logged.
    ;; The indices are what is actually referenced, so pack only up to the
    ;; highest one. Bounded by the clamped count, so a hostile index cannot
    ;; grow the pack, and the per-index validation in
    ;; $d3dim_draw_indexed_primitive still rejects anything past it.
    (local.set $ibase_wa (call $g2w (local.get $indices)))
    (local.set $i (i32.const 0))
    (local.set $need (i32.const 0))
    (block $scanned (loop $scan
      (br_if $scanned (i32.ge_u (local.get $i) (local.get $index_count)))
      (local.set $idx (i32.load16_u
        (i32.add (local.get $ibase_wa) (i32.shl (local.get $i) (i32.const 1)))))
      (if (i32.gt_u (local.get $idx) (local.get $need))
        (then (local.set $need (local.get $idx))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.set $need (i32.add (local.get $need) (i32.const 1)))
    (if (i32.lt_u (local.get $need) (local.get $count))
      (then (local.set $count (local.get $need))))
    ;; kind=25 DrawVB: what the VB draw believes it is holding. vtxType 3 is
    ;; TLVERTEX (already transformed, rasterize as-is); 1 or 2 mean this draw
    ;; will run the transform over vertices ProcessVertices already
    ;; transformed. The primitive type and index count come along because a
    ;; wrong primType silently draws nothing on this path.
    (local.set $dbg_key (i32.xor (local.get $fvf)
      (i32.shl (local.get $vtxType) (i32.const 24))))
    (if (i32.ne (local.get $dbg_key) (global.get $d3dim_dbg_vb_last)) (then
      (global.set $d3dim_dbg_vb_last (local.get $dbg_key))
      (call $host_dx_trace (i32.const 25)
        (i32.or (local.get $primType) (i32.shl (local.get $index_count) (i32.const 8)))
        (local.get $fvf)
        (i32.or (local.get $stride) (i32.shl (local.get $vtxType) (i32.const 16)))
        (local.get $count))))
    (local.set $packed (call $d3dim_pack_fvf_scratch
      (local.get $fvf)
      (i32.add (local.get $data_g) (i32.mul (local.get $start) (local.get $stride)))
      (local.get $count)
      (call $d3dim_texcoord_index (local.get $this))))
    (local.set $vtxType (call $d3dim_d7_light_vertices (local.get $this) (local.get $fvf)
      (i32.add (local.get $data_g) (i32.mul (local.get $start) (local.get $stride)))
      (local.get $packed) (local.get $count) (local.get $vtxType)))
    ;; Use the same supplied-vector representation as immediate FVF draws.
    ;; The original records begin at start, including for relative indices.
    (if (i32.lt_u (local.get $vtxType) (i32.const 3)) (then
      (local.set $supplied (call $d3dim_d7_supplied_type (local.get $this)))))
    (if (i32.and (i32.ne (local.get $packed) (i32.const 0))
                 (i32.ne (local.get $supplied) (i32.const 0))) (then
      (local.set $extended (call $d3dim_d7_supplied_vertices
        (local.get $this) (local.get $fvf)
        (i32.add (local.get $data_g) (i32.mul (local.get $start) (local.get $stride)))
        (local.get $packed) (local.get $count) (local.get $vtxType)))
      ;; Keep reusable canonical scratch alive; release only the owned
      ;; expanded representation after this submission consumes it.
      (local.set $packed (local.get $extended))
      (local.set $vtxType (local.get $supplied))))
    (local.set $clip_records (call $d3dim_pv_clip_storage (local.get $entry) (i32.const 0)))
    (if (i32.and (i32.ne (local.get $packed) (i32.const 0))
      (i32.and (i32.eq (local.get $vtxType) (i32.const 3)) (i32.ne (local.get $clip_records) (i32.const 0)))) (then
      (local.set $hr (call $d3dim_pv_draw_clipped (local.get $this) (local.get $primType)
        (local.get $packed) (local.get $count) (local.get $clip_records) (local.get $start)
        (local.get $indices) (local.get $index_count)))
      (if (local.get $extended) (then (call $heap_free (local.get $extended))))
      (i32.store (global.get $reg_base) (local.get $hr)) (return)))
    (if (local.get $packed) (then
      (call $d3dim_draw_indexed_primitive
        (local.get $this) (local.get $primType) (local.get $vtxType)
        (local.get $packed) (local.get $count)
        (local.get $indices) (local.get $index_count))))
    (if (local.get $extended) (then (call $heap_free (local.get $extended))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_pack_strided_tl
    (param $fvf i32) (param $strided i32) (param $count i32) (param $tex_index i32) (result i32)
    (local $type i32) (local $size i32) (local $dst_g i32) (local $dst_wa i32) (local $i i32)
    (local $pos_g i32) (local $pos_stride i32) (local $pos_wa i32)
    (local $norm_g i32) (local $norm_stride i32) (local $norm_wa i32)
    (local $diff_g i32) (local $diff_stride i32) (local $diff_wa i32)
    (local $spec_g i32) (local $spec_stride i32) (local $spec_wa i32)
    (local $tex_g i32) (local $tex_stride i32) (local $tex_wa i32)
    (local $src i32) (local $dst i32) (local $dimension i32)
    (local.set $type (call $d3dim_fvf_vtxtype (local.get $fvf)))
    (if (i32.or
          (i32.or (i32.eqz (local.get $strided)) (i32.eqz (local.get $count)))
          (i32.eqz (local.get $type)))
      (then (return (i32.const 0))))
    ;; Bound the count before multiplication or touching component arrays.
    (if (i32.gt_u (local.get $count) (i32.const 131072))
      (then (return (i32.const 0))))
    (local.set $pos_g (call $gl32 (local.get $strided)))
    (local.set $pos_stride (call $gl32 (i32.add (local.get $strided) (i32.const 4))))
    (if (i32.eqz (local.get $pos_g)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $pos_stride)) (then
      (if (i32.eq (local.get $type) (i32.const 3))
        (then (local.set $pos_stride (i32.const 16)))
        (else (local.set $pos_stride (i32.const 12))))))
    (local.set $pos_wa (call $g2w (local.get $pos_g)))
    (if (i32.and (local.get $fvf) (i32.const 0x0010)) (then
      (local.set $norm_g (call $gl32 (i32.add (local.get $strided) (i32.const 8))))
      (local.set $norm_stride (call $gl32 (i32.add (local.get $strided) (i32.const 12))))
      (if (i32.eqz (local.get $norm_stride)) (then (local.set $norm_stride (i32.const 12))))
      (if (local.get $norm_g) (then (local.set $norm_wa (call $g2w (local.get $norm_g)))))))
    (if (i32.and (local.get $fvf) (i32.const 0x0040)) (then
      (local.set $diff_g (call $gl32 (i32.add (local.get $strided) (i32.const 16))))
      (local.set $diff_stride (call $gl32 (i32.add (local.get $strided) (i32.const 20))))
      (if (i32.eqz (local.get $diff_stride)) (then (local.set $diff_stride (i32.const 4))))
      (if (local.get $diff_g) (then (local.set $diff_wa (call $g2w (local.get $diff_g)))))))
    (if (i32.and (local.get $fvf) (i32.const 0x0080)) (then
      (local.set $spec_g (call $gl32 (i32.add (local.get $strided) (i32.const 24))))
      (local.set $spec_stride (call $gl32 (i32.add (local.get $strided) (i32.const 28))))
      (if (i32.eqz (local.get $spec_stride)) (then (local.set $spec_stride (i32.const 4))))
      (if (local.get $spec_g) (then (local.set $spec_wa (call $g2w (local.get $spec_g)))))))
    (if (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 0xF)) (then
      (if (i32.ge_u (local.get $tex_index)
            (i32.and (i32.shr_u (local.get $fvf) (i32.const 8)) (i32.const 0xF)))
        (then (local.set $tex_index (i32.const 0))))
      (local.set $tex_g (call $gl32 (i32.add (local.get $strided)
        (i32.add (i32.const 32) (i32.shl (local.get $tex_index) (i32.const 3))))))
      (local.set $tex_stride (call $gl32 (i32.add (local.get $strided)
        (i32.add (i32.const 36) (i32.shl (local.get $tex_index) (i32.const 3))))))
      (local.set $dimension (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $tex_index)))
      (if (i32.eqz (local.get $tex_stride)) (then
        (local.set $tex_stride (i32.shl (local.get $dimension) (i32.const 2)))))
      (if (local.get $tex_g) (then (local.set $tex_wa (call $g2w (local.get $tex_g)))))))
    (local.set $size (i32.mul (local.get $count) (i32.const 32)))
    (if (i32.or (i32.eqz (local.get $size)) (i32.gt_u (local.get $size) (i32.const 0x400000)))
      (then (return (i32.const 0))))
    (local.set $dst_g (call $heap_alloc (local.get $size)))
    (if (i32.eqz (local.get $dst_g)) (then (return (i32.const 0))))
    (local.set $dst_wa (call $g2w (local.get $dst_g)))
    (call $zero_memory (local.get $dst_wa) (local.get $size))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $dst (i32.add (local.get $dst_wa) (i32.mul (local.get $i) (i32.const 32))))
      (local.set $src (i32.add (local.get $pos_wa) (i32.mul (local.get $i) (local.get $pos_stride))))
      (if (i32.eq (local.get $type) (i32.const 3))
        (then
          (f32.store (local.get $dst) (f32.load (local.get $src)))
          (f32.store (i32.add (local.get $dst) (i32.const 4)) (f32.load (i32.add (local.get $src) (i32.const 4))))
          (f32.store (i32.add (local.get $dst) (i32.const 8)) (f32.load (i32.add (local.get $src) (i32.const 8))))
          (f32.store (i32.add (local.get $dst) (i32.const 12)) (f32.load (i32.add (local.get $src) (i32.const 12)))))
        (else
          (f32.store (local.get $dst) (f32.load (local.get $src)))
          (f32.store (i32.add (local.get $dst) (i32.const 4)) (f32.load (i32.add (local.get $src) (i32.const 4))))
          (f32.store (i32.add (local.get $dst) (i32.const 8)) (f32.load (i32.add (local.get $src) (i32.const 8))))
          (if (local.get $norm_wa)
            (then
              (local.set $src (i32.add (local.get $norm_wa) (i32.mul (local.get $i) (local.get $norm_stride))))
              (call $memcpy (i32.add (local.get $dst) (i32.const 12)) (local.get $src) (i32.const 12)))
            (else
              (f32.store (i32.add (local.get $dst) (i32.const 20)) (f32.const 1.0))))))
      (if (local.get $diff_wa)
        (then
          (i32.store (i32.add (local.get $dst) (i32.const 16))
            (i32.load (i32.add (local.get $diff_wa) (i32.mul (local.get $i) (local.get $diff_stride))))))
        (else (i32.store (i32.add (local.get $dst) (i32.const 16)) (i32.const 0xFFFFFFFF))))
      (if (local.get $spec_wa) (then
        (i32.store (i32.add (local.get $dst) (i32.const 20))
          (i32.load (i32.add (local.get $spec_wa) (i32.mul (local.get $i) (local.get $spec_stride)))))))
      (if (local.get $tex_wa) (then
        (local.set $src (i32.add (local.get $tex_wa) (i32.mul (local.get $i) (local.get $tex_stride))))
        (f32.store (i32.add (local.get $dst) (i32.const 24)) (f32.load (local.get $src)))
        (if (i32.ge_u (local.get $dimension) (i32.const 2)) (then
          (f32.store (i32.add (local.get $dst) (i32.const 28))
            (f32.load (i32.add (local.get $src) (i32.const 4))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (local.get $dst_g))

  ;; The strided selector addresses a separate dimensional array. Retain its
  ;; z/w just like packed FVF/VB input, before matrix application and queuing.
  (func $d3dim_strided_supplied_vertices
    (param $this i32) (param $fvf i32) (param $strided i32)
    (param $packed i32) (param $count i32) (param $type i32) (result i32)
    (local $out i32) (local $ow i32) (local $pw i32) (local $state i32)
    (local $selector i32) (local $dimension i32) (local $ptr i32) (local $stride i32)
    (local $i i32) (local $dst i32) (local $src i32)
    (if (i32.or (i32.eqz (local.get $packed)) (i32.gt_u (local.get $count) (i32.const 104857)))
      (then (return (i32.const 0))))
    (local.set $out (call $heap_alloc (i32.mul (local.get $count) (i32.const 40))))
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
    (local.set $ow (call $g2w (local.get $out)))
    (local.set $pw (call $g2w (local.get $packed)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (call $d3ddev_composite_wvp (local.get $state))
    (call $d3dim_lights_refresh (local.get $state))
    (local.set $selector (call $d3dim_texcoord_index (local.get $this)))
    (local.set $dimension (call $d3dim_fvf_tex_size (local.get $fvf) (local.get $selector)))
    (if (i32.and (local.get $fvf) (i32.const 0xf00)) (then
      (local.set $src (i32.add (local.get $strided)
        (i32.add (i32.const 32) (i32.shl (local.get $selector) (i32.const 3)))))
      (local.set $ptr (call $gl32 (local.get $src)))
      (local.set $stride (call $gl32 (i32.add (local.get $src) (i32.const 4))))
      (if (i32.eqz (local.get $stride)) (then
        (local.set $stride (i32.shl (local.get $dimension) (i32.const 2)))))
      (if (local.get $ptr) (then (local.set $ptr (call $g2w (local.get $ptr)))))))
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $dst (i32.add (local.get $ow) (i32.mul (local.get $i) (i32.const 40))))
      (call $d3dim_prepare_draw_vertex (local.get $state) (local.get $type)
        (i32.add (local.get $pw) (i32.mul (local.get $i) (i32.const 32))) (local.get $dst))
      (f32.store offset=32 (local.get $dst) (f32.const 0))
      (f32.store offset=36 (local.get $dst) (f32.const 1))
      (if (local.get $ptr) (then
        (local.set $src (i32.add (local.get $ptr) (i32.mul (local.get $i) (local.get $stride))))
        (if (i32.ge_u (local.get $dimension) (i32.const 3)) (then
          (i32.store offset=32 (local.get $dst) (i32.load offset=8 (local.get $src)))))
        (if (i32.eq (local.get $dimension) (i32.const 4)) (then
          (i32.store offset=36 (local.get $dst) (i32.load offset=12 (local.get $src)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $next)))
    (local.get $out))

  (func $d3dim_draw_primitive_strided
    (param $this i32) (param $primType i32) (param $fvf i32) (param $strided i32) (param $count i32)
    (local $scratch i32) (local $vtxType i32) (local $extended i32) (local $supplied i32)
    (if (i32.eqz (call $d3dim_fvf_supplied_valid (local.get $this) (local.get $fvf))) (then
      (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $fvf)))
    (local.set $scratch (call $d3dim_pack_strided_tl
      (local.get $fvf) (local.get $strided) (local.get $count)
      (call $d3dim_texcoord_index (local.get $this))))
    (if (i32.lt_u (local.get $vtxType) (i32.const 3)) (then
      (local.set $supplied (call $d3dim_d7_strided_supplied_type (local.get $this)))))
    (if (i32.and (i32.ne (local.get $scratch) (i32.const 0))
                 (i32.ne (local.get $supplied) (i32.const 0))) (then
      (local.set $extended (call $d3dim_strided_supplied_vertices
        (local.get $this) (local.get $fvf) (local.get $strided)
        (local.get $scratch) (local.get $count) (local.get $vtxType)))
      (call $heap_free (local.get $scratch))
      (local.set $scratch (local.get $extended))
      (local.set $vtxType (local.get $supplied))))
    (if (local.get $scratch) (then
      (call $d3dim_draw_primitive
        (local.get $this) (local.get $primType) (local.get $vtxType)
        (local.get $scratch) (local.get $count))
      (call $heap_free (local.get $scratch))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_draw_indexed_primitive_strided
    (param $this i32) (param $primType i32) (param $fvf i32) (param $strided i32) (param $count i32)
    (param $indices i32) (param $index_count i32)
    (local $scratch i32) (local $vtxType i32) (local $extended i32) (local $supplied i32)
    (if (i32.eqz (call $d3dim_fvf_supplied_valid (local.get $this) (local.get $fvf))) (then
      (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $vtxType (call $d3dim_fvf_vtxtype (local.get $fvf)))
    (local.set $scratch (call $d3dim_pack_strided_tl
      (local.get $fvf) (local.get $strided) (local.get $count)
      (call $d3dim_texcoord_index (local.get $this))))
    (if (i32.lt_u (local.get $vtxType) (i32.const 3)) (then
      (local.set $supplied (call $d3dim_d7_strided_supplied_type (local.get $this)))))
    (if (i32.and (i32.ne (local.get $scratch) (i32.const 0))
                 (i32.ne (local.get $supplied) (i32.const 0))) (then
      (local.set $extended (call $d3dim_strided_supplied_vertices
        (local.get $this) (local.get $fvf) (local.get $strided)
        (local.get $scratch) (local.get $count) (local.get $vtxType)))
      (call $heap_free (local.get $scratch))
      (local.set $scratch (local.get $extended))
      (local.set $vtxType (local.get $supplied))))
    (if (local.get $scratch) (then
      (call $d3dim_draw_indexed_primitive
        (local.get $this) (local.get $primType) (local.get $vtxType)
        (local.get $scratch) (local.get $count)
        (local.get $indices) (local.get $index_count))
      (call $heap_free (local.get $scratch))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; ── Material/background state ─────────────────────────────────
  ;; Material objects keep a private D3DMATERIAL copy at entry+8, with the
  ;; stored byte count at entry+12. Legacy material handles are DX slot ids.
  (func $d3dim_material_release (param $this i32) (result i32)
    (local $entry i32) (local $payload i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eq (load.field DxObject refcount (local.get $entry)) (i32.const 1)) (then
      (local.set $payload (load.field DxObject misc0 (local.get $entry)))
      (store.field DxObject misc0 (local.get $entry) (i32.const 0))
      (if (local.get $payload) (then (call $heap_free (local.get $payload))))))
    (call $dx_com_release_basic (local.get $this)))

  (func $d3dim_material_set (param $this i32) (param $lpMat i32)
    (local $entry i32) (local $dst i32) (local $sz i32)
    (if (i32.eqz (local.get $lpMat)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $entry)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $sz (call $gl32 (local.get $lpMat)))
    (if (i32.or (i32.eqz (local.get $sz)) (i32.gt_u (local.get $sz) (i32.const 80)))
      (then (local.set $sz (i32.const 80))))
    (if (i32.lt_u (local.get $sz) (i32.const 4)) (then (local.set $sz (i32.const 4))))
    (local.set $dst (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $dst)) (then
      (local.set $dst (call $heap_alloc (i32.const 80)))
      (if (i32.eqz (local.get $dst)) (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E))
        (return)))
      (store.field DxObject misc0 (local.get $entry) (local.get $dst))))
    (call $guest_memset (local.get $dst) (i32.const 0) (i32.const 80))
    (call $guest_memmove (local.get $dst) (local.get $lpMat) (local.get $sz))
    (i32.store (i32.add (local.get $entry) (i32.const 12)) (local.get $sz))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_material_get (param $this i32) (param $lpMat i32)
    (local $entry i32) (local $src i32) (local $stored_sz i32) (local $sz i32)
    (if (i32.eqz (local.get $lpMat)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $entry)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $src (load.field DxObject misc0 (local.get $entry)))
    (local.set $stored_sz (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (local.set $sz (call $gl32 (local.get $lpMat)))
    (if (i32.eqz (local.get $stored_sz)) (then (local.set $stored_sz (i32.const 80))))
    (if (i32.or (i32.eqz (local.get $sz)) (i32.gt_u (local.get $sz) (local.get $stored_sz)))
      (then (local.set $sz (local.get $stored_sz))))
    (if (i32.gt_u (local.get $sz) (i32.const 80)) (then (local.set $sz (i32.const 80))))
    (if (local.get $src)
      (then (call $guest_memmove (local.get $lpMat) (local.get $src) (local.get $sz)))
      (else (call $guest_memset (local.get $lpMat) (i32.const 0) (local.get $sz))))
    (call $gs32 (local.get $lpMat) (local.get $sz))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_material_get_handle (param $this i32) (param $lpDev i32) (param $lpHandle i32)
    (local $entry i32)
    (if (local.get $lpHandle) (then
      (local.set $entry (call $dx_from_this (local.get $this)))
      (call $gs32 (local.get $lpHandle) (call $dx_slot_of (local.get $entry)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_set_material (param $this i32) (param $lpMat i32)
    (local $state i32)
    (if (i32.eqz (local.get $lpMat)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (call $d3dim_sb_record (local.get $this) (i32.const 3) (i32.const 0) (local.get $lpMat) (i32.const 68)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then (call $guest_memmove
              (i32.add (local.get $state) (global.get $D3DIM_OFF_D3D7_MAT))
              (local.get $lpMat)
              (i32.const 68))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_get_material (param $this i32) (param $lpMat i32)
    (local $state i32)
    (if (i32.eqz (local.get $lpMat)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then (call $guest_memmove
              (local.get $lpMat)
              (i32.add (local.get $state) (global.get $D3DIM_OFF_D3D7_MAT))
              (i32.const 68)))
      (else (call $guest_memset (local.get $lpMat) (i32.const 0) (i32.const 68))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_light_table (param $state i32) (result i32)
    (local $sw i32) (local $table i32)
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $table (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_LIGHTS))))
    (if (i32.eqz (local.get $table)) (then
      (local.set $table (call $heap_alloc (i32.const 832)))
      (if (local.get $table) (then
        (call $zero_memory (call $g2w (local.get $table)) (i32.const 832))
        (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_LIGHTS))
          (local.get $table))))))
    (local.get $table))

  (func $d3dim_device7_set_light (param $this i32) (param $idx i32) (param $lpLight i32)
    (local $state i32) (local $table i32)
    (if (i32.eqz (local.get $lpLight)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.ge_u (local.get $idx) (i32.const 8)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (call $d3dim_sb_record (local.get $this) (i32.const 4) (local.get $idx) (local.get $lpLight) (i32.const 104)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $table (call $d3dim_device7_light_table (local.get $state)))
    (if (local.get $table)
      (then
        (call $gs32 (i32.add (local.get $state) (i32.const 3952))
          (i32.or (call $gl32 (i32.add (local.get $state) (i32.const 3952)))
            (i32.shl (i32.const 1) (local.get $idx))))
        (call $gs32 (i32.add (local.get $state) (i32.const 3948))
          (i32.or (call $gl32 (i32.add (local.get $state) (i32.const 3948)))
            (i32.shl (i32.const 1) (local.get $idx))))
        (call $memcpy
              (call $g2w (i32.add (local.get $table) (i32.mul (local.get $idx) (i32.const 104))))
              (call $g2w (local.get $lpLight))
              (i32.const 104))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_get_light (param $this i32) (param $idx i32) (param $lpLight i32)
    (local $state i32) (local $table i32)
    (if (i32.eqz (local.get $lpLight)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.ge_u (local.get $idx) (i32.const 8))
      (then
        (call $zero_memory (call $g2w (local.get $lpLight)) (i32.const 104))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then
        (local.set $table
          (i32.load
            (i32.add (call $g2w (local.get $state)) (global.get $D3DIM_OFF_D3D7_LIGHTS))))))
    (if (local.get $table)
      (then (call $memcpy
              (call $g2w (local.get $lpLight))
              (call $g2w (i32.add (local.get $table) (i32.mul (local.get $idx) (i32.const 104))))
              (i32.const 104)))
      (else (call $zero_memory (call $g2w (local.get $lpLight)) (i32.const 104))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_light_enable (param $this i32) (param $idx i32) (param $enable i32)
    (local $state i32) (local $sw i32) (local $mask i32) (local $bit i32)
    (if (i32.lt_u (local.get $idx) (i32.const 32)) (then (if (call $d3dim_sb_record (local.get $this) (i32.const 5) (local.get $idx) (local.get $enable) (i32.const 0)) (then (return)))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.and
          (i32.ne (local.get $state) (i32.const 0))
          (i32.lt_u (local.get $idx) (i32.const 32))) (then
      (call $gs32 (i32.add (local.get $state) (i32.const 3952)) (i32.or (call $gl32 (i32.add (local.get $state) (i32.const 3952))) (i32.shl (i32.const 1) (local.get $idx))))
      (local.set $sw (call $g2w (local.get $state)))
      (local.set $mask (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_LIGHT_ENABLE))))
      (local.set $bit (i32.shl (i32.const 1) (local.get $idx)))
      (if (local.get $enable)
        (then (local.set $mask (i32.or (local.get $mask) (local.get $bit))))
        (else (local.set $mask (i32.and (local.get $mask) (i32.xor (local.get $bit) (i32.const -1))))))
      (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_LIGHT_ENABLE))
        (local.get $mask))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_get_light_enable (param $this i32) (param $idx i32) (param $out i32)
    (local $state i32) (local $mask i32) (local $val i32)
    (if (i32.eqz (local.get $out)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.and
          (i32.ne (local.get $state) (i32.const 0))
          (i32.lt_u (local.get $idx) (i32.const 32))) (then
      (local.set $mask
        (i32.load
          (i32.add (call $g2w (local.get $state)) (global.get $D3DIM_OFF_D3D7_LIGHT_ENABLE))))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $idx)))
        (then (local.set $val (i32.const 1))))))
    (call $gs32 (local.get $out) (local.get $val))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; ── D3D7 fixed-function vertex lighting ───────────────────────
  ;; Device7 keeps its own D3DLIGHT7 table, enable mask and D3DMATERIAL7 (the
  ;; legacy path above only knows IDirect3DLight objects and material
  ;; handles), so an FVF with a normal drawn with D3DRENDERSTATE_LIGHTING set
  ;; was packed as a pre-lit vertex and kept whatever its diffuse dword held.
  ;; Colin McRae Rally 2.0 draws its car as XYZ|NORMAL|DIFFUSE|SPECULAR|TEX2
  ;; with DIFFUSEMATERIALSOURCE=MATERIAL and a zero diffuse dword: solid black.
  ;;
  ;; This lights the packed vertices in place and leaves them as D3DLVERTEX
  ;; (colour @16), returning the vertex type the draw should use. It applies
  ;; only when the app set LIGHTING=TRUE (the slot reads 0 until set, so an app
  ;; leaning on D3D7's TRUE default keeps the old pre-lit behaviour) and has
  ;; used Device7's SetLight or SetMaterial; Device3 and execute-buffer
  ;; devices never touch either and stay on the legacy path.
  ;;
  ;; colour = emissive + mat.ambient * (RS_AMBIENT + sum(atten*spot*L.ambient))
  ;;        + mat.diffuse * sum(atten*spot*max(0, N.L)*L.diffuse), clamped;
  ;; alpha = the diffuse source's alpha. Specular RGB uses the DX7 SDK
  ;; imover_6muc halfway-vector model; its existing fog alpha is preserved.
  (func $d3dim_d7_rs (param $sw i32) (param $rs i32) (result i32)
    (i32.load (i32.add (local.get $sw) (i32.add (i32.const 256) (i32.shl (local.get $rs) (i32.const 2))))))

  ;; Channel $shift (16 r, 8 g, 0 b, 24 a) of a D3DCOLOR, as 0..1.
  (func $d3dim_d7_ch (param $c i32) (param $shift i32) (result f32)
    (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c) (local.get $shift)) (i32.const 0xFF)))
             (f32.const 255.0)))

  ;; Material colour $which (0 diffuse, 1 ambient, 2 specular, 3 emissive) as a D3DCOLOR,
  ;; or the vertex colour its *MATERIALSOURCE render state selects.
  (func $d3dim_d7_mat_color (param $sw i32) (param $which i32) (param $src_rs i32)
      (param $vdiff i32) (param $vspec i32) (param $has_diff i32) (param $has_spec i32) (result i32)
    (local $sel i32) (local $m i32)
    (if (call $d3dim_d7_rs (local.get $sw) (i32.const 141)) (then   ;; COLORVERTEX
      (local.set $sel (call $d3dim_d7_rs (local.get $sw) (local.get $src_rs)))
      (if (i32.and (i32.eq (local.get $sel) (i32.const 1)) (local.get $has_diff))
        (then (return (local.get $vdiff))))
      (if (i32.and (i32.eq (local.get $sel) (i32.const 2)) (local.get $has_spec))
        (then (return (local.get $vspec))))))
    (local.set $m (i32.add (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_MAT))
                           (i32.shl (local.get $which) (i32.const 4))))
    (call $d3dim_d7_pack4 (f32.load (local.get $m)) (f32.load offset=4 (local.get $m))
      (f32.load offset=8 (local.get $m)) (f32.load offset=12 (local.get $m))))

  (func $d3dim_d7_unit (param $v f32) (result i32)
    (i32.trunc_sat_f32_u (f32.add (f32.mul
      (f32.min (f32.max (local.get $v) (f32.const 0.0)) (f32.const 1.0)) (f32.const 255.0)) (f32.const 0.5))))

  (func $d3dim_d7_pack4 (param $r f32) (param $g f32) (param $b f32) (param $a f32) (result i32)
    (i32.or (i32.or (i32.shl (call $d3dim_d7_unit (local.get $a)) (i32.const 24))
                    (i32.shl (call $d3dim_d7_unit (local.get $r)) (i32.const 16)))
            (i32.or (i32.shl (call $d3dim_d7_unit (local.get $g)) (i32.const 8))
                    (call $d3dim_d7_unit (local.get $b)))))

  ;; A colored FVF is packed as D3DLVERTEX, whose color fields replace the
  ;; normal. Generate stage-0 normal/reflection coordinates from the original FVF before
  ;; that normal is lost to the draw consumer (also after lighting converts a
  ;; D3DVERTEX). Reuse the legacy generator's matrix/count behavior; the packed
  ;; LVERTEX consumer keeps this UV pair, so it is not transformed twice.
  (func $d3dim_d7_normal_texcoords
      (param $state i32) (param $fvf i32) (param $src_g i32) (param $packed_g i32) (param $count i32)
    (local $stride i32) (local $src i32) (local $dst i32) (local $gen i32) (local $i i32) (local $mode i32)
    (local.set $mode (i32.shr_u (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 11))
      (i32.const 16)))
    (if (i32.and (i32.ne (local.get $mode) (i32.const 1))
                (i32.ne (local.get $mode) (i32.const 3))) (then (return)))
    (call $d3ddev_composite_wvp (local.get $state))
    (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
    (local.set $src (call $g2w (local.get $src_g)))
    (local.set $dst (call $g2w (local.get $packed_g)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      ;; XYZ|NORMAL starts with the same six floats as D3DVERTEX, even
      ;; when diffuse/specular/point-size/texture sets follow the normal.
      (local.set $gen (call $d3dim_texgen (local.get $state) (i32.const 1) (local.get $src)))
      (i64.store offset=24 (local.get $dst) (i64.load (local.get $gen)))
      (local.set $src (i32.add (local.get $src) (local.get $stride)))
      (local.set $dst (i32.add (local.get $dst) (i32.const 32)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $lp))))

  (func $d3dim_d7_light_vertices
      (param $this i32) (param $fvf i32) (param $src_g i32) (param $packed_g i32)
      (param $count i32) (param $vtxType i32) (result i32)
    (local $state i32) (local $sw i32) (local $table i32) (local $tw i32) (local $mask i32)
    (local $stride i32) (local $i i32) (local $v i32) (local $dst i32) (local $k i32) (local $lw i32)
    (local $has_diff i32) (local $has_spec i32) (local $vdiff i32) (local $vspec i32) (local $off i32)
    (local $cd i32) (local $ca i32) (local $ce i32) (local $amb i32) (local $ltype i32)
    (local $x f32) (local $y f32) (local $z f32) (local $nx f32) (local $ny f32) (local $nz f32)
    (local $px f32) (local $py f32) (local $pz f32) (local $qx f32) (local $qy f32) (local $qz f32)
    (local $lx f32) (local $ly f32) (local $lz f32) (local $d f32) (local $len f32)
    (local $att f32) (local $spot f32) (local $ndl f32) (local $rho f32) (local $ct f32) (local $cp f32)
    (local $ar f32) (local $ag f32) (local $ab f32) (local $dr f32) (local $dg f32) (local $db f32)
    (local $cs i32) (local $spec_on i32) (local $power f32)
    (local $sr f32) (local $sg f32) (local $sb f32) (local $rs f32)
    (local $ex f32) (local $ey f32) (local $ez f32)
    (local $snx f32) (local $sny f32) (local $snz f32)
    (local $hx f32) (local $hy f32) (local $hz f32)
    (if (i32.or (i32.eqz (local.get $packed_g)) (i32.eqz (local.get $count)))
      (then (return (local.get $vtxType))))
    ;; Lit vertices need untransformed positions and a normal.
    (if (i32.ne (i32.and (local.get $fvf) (i32.const 0x0016)) (i32.const 0x0012))
      (then (return (local.get $vtxType))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (local.get $vtxType))))
    (local.set $sw (call $g2w (local.get $state)))
    (if (i32.eq (local.get $vtxType) (i32.const 2)) (then
      (call $d3dim_d7_normal_texcoords (local.get $state) (local.get $fvf)
        (local.get $src_g) (local.get $packed_g) (local.get $count))))
    (if (i32.ne (call $d3dim_d7_rs (local.get $sw) (i32.const 137)) (i32.const 1))  ;; LIGHTING
      (then (return (local.get $vtxType))))
    (local.set $table (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_LIGHTS))))
    (if (i32.and (i32.eqz (local.get $table))
          (i32.eqz (v128.any_true
            (v128.or (v128.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_MAT)))
              (v128.or (v128.load offset=16 (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_MAT)))
                       (v128.load offset=48 (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_MAT))))))))
      (then (return (local.get $vtxType))))
    (if (local.get $table) (then (local.set $tw (call $g2w (local.get $table)))))
    (local.set $mask (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_LIGHT_ENABLE))))
    (local.set $amb (call $d3dim_d7_rs (local.get $sw) (i32.const 139)))         ;; AMBIENT
    (local.set $power (f32.load offset=64 (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_MAT))))
    ;; D3DMATERIAL7::dvPower explicitly disables highlights at zero, rather
    ;; than evaluating x^0. SPECULARENABLE independently gates the RGB sum.
    (local.set $spec_on (i32.and
      (i32.ne (call $d3dim_d7_rs (local.get $sw) (i32.const 29)) (i32.const 0))
      (f32.gt (local.get $power) (f32.const 0))))
    (local.set $stride (call $d3dim_fvf_stride (local.get $fvf)))
    (local.set $has_diff (i32.ne (i32.and (local.get $fvf) (i32.const 0x40)) (i32.const 0)))
    (local.set $has_spec (i32.ne (i32.and (local.get $fvf) (i32.const 0x80)) (i32.const 0)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $v (i32.add (local.get $src_g) (i32.mul (local.get $i) (local.get $stride))))
      (local.set $x (f32.reinterpret_i32 (call $gl32 (local.get $v))))
      (local.set $y (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v) (i32.const 4)))))
      (local.set $z (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v) (i32.const 8)))))
      (local.set $qx (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v) (i32.const 12)))))
      (local.set $qy (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v) (i32.const 16)))))
      (local.set $qz (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v) (i32.const 20)))))
      (local.set $off (i32.const 24))
      (if (i32.and (local.get $fvf) (i32.const 0x0020))
        (then (local.set $off (i32.add (local.get $off) (i32.const 4)))))
      (if (local.get $has_diff) (then
        (local.set $vdiff (call $gl32 (i32.add (local.get $v) (local.get $off))))
        (local.set $off (i32.add (local.get $off) (i32.const 4)))))
      (if (local.get $has_spec) (then
        (local.set $vspec (call $gl32 (i32.add (local.get $v) (local.get $off))))))
      ;; World space: row vectors, m[i][j] at (i*4+j)*4, translation in row 3.
      (local.set $px (f32.add (f32.add (f32.add
        (f32.mul (local.get $x) (f32.load offset=0 (local.get $sw)))
        (f32.mul (local.get $y) (f32.load offset=16 (local.get $sw))))
        (f32.mul (local.get $z) (f32.load offset=32 (local.get $sw)))) (f32.load offset=48 (local.get $sw))))
      (local.set $py (f32.add (f32.add (f32.add
        (f32.mul (local.get $x) (f32.load offset=4 (local.get $sw)))
        (f32.mul (local.get $y) (f32.load offset=20 (local.get $sw))))
        (f32.mul (local.get $z) (f32.load offset=36 (local.get $sw)))) (f32.load offset=52 (local.get $sw))))
      (local.set $pz (f32.add (f32.add (f32.add
        (f32.mul (local.get $x) (f32.load offset=8 (local.get $sw)))
        (f32.mul (local.get $y) (f32.load offset=24 (local.get $sw))))
        (f32.mul (local.get $z) (f32.load offset=40 (local.get $sw)))) (f32.load offset=56 (local.get $sw))))
      (local.set $nx (f32.add (f32.add
        (f32.mul (local.get $qx) (f32.load offset=0 (local.get $sw)))
        (f32.mul (local.get $qy) (f32.load offset=16 (local.get $sw))))
        (f32.mul (local.get $qz) (f32.load offset=32 (local.get $sw)))))
      (local.set $ny (f32.add (f32.add
        (f32.mul (local.get $qx) (f32.load offset=4 (local.get $sw)))
        (f32.mul (local.get $qy) (f32.load offset=20 (local.get $sw))))
        (f32.mul (local.get $qz) (f32.load offset=36 (local.get $sw)))))
      (local.set $nz (f32.add (f32.add
        (f32.mul (local.get $qx) (f32.load offset=8 (local.get $sw)))
        (f32.mul (local.get $qy) (f32.load offset=24 (local.get $sw))))
        (f32.mul (local.get $qz) (f32.load offset=40 (local.get $sw)))))
      (if (call $d3dim_d7_rs (local.get $sw) (i32.const 143)) (then   ;; NORMALIZENORMALS
        (local.set $len (f32.sqrt (f32.add (f32.add (f32.mul (local.get $nx) (local.get $nx))
          (f32.mul (local.get $ny) (local.get $ny))) (f32.mul (local.get $nz) (local.get $nz)))))
        (if (f32.gt (local.get $len) (f32.const 0.0)) (then
          (local.set $nx (f32.div (local.get $nx) (local.get $len)))
          (local.set $ny (f32.div (local.get $ny) (local.get $len)))
          (local.set $nz (f32.div (local.get $nz) (local.get $len)))))))
      (local.set $ar (call $d3dim_d7_ch (local.get $amb) (i32.const 16)))
      (local.set $ag (call $d3dim_d7_ch (local.get $amb) (i32.const 8)))
      (local.set $ab (call $d3dim_d7_ch (local.get $amb) (i32.const 0)))
      (local.set $dr (f32.const 0.0)) (local.set $dg (f32.const 0.0)) (local.set $db (f32.const 0.0))
      (local.set $sr (f32.const 0)) (local.set $sg (f32.const 0)) (local.set $sb (f32.const 0))
      (if (local.get $spec_on) (then
        ;; Specular vectors share camera space. For rigid world/view matrices
        ;; this is the same dot product as the SDK's model-space formulation.
        ;; The existing diffuse world-space computation remains independent.
        (local.set $snx (f32.add (f32.add
          (f32.mul (local.get $nx) (f32.load offset=64 (local.get $sw)))
          (f32.mul (local.get $ny) (f32.load offset=80 (local.get $sw))))
          (f32.mul (local.get $nz) (f32.load offset=96 (local.get $sw)))))
        (local.set $sny (f32.add (f32.add
          (f32.mul (local.get $nx) (f32.load offset=68 (local.get $sw)))
          (f32.mul (local.get $ny) (f32.load offset=84 (local.get $sw))))
          (f32.mul (local.get $nz) (f32.load offset=100 (local.get $sw)))))
        (local.set $snz (f32.add (f32.add
          (f32.mul (local.get $nx) (f32.load offset=72 (local.get $sw)))
          (f32.mul (local.get $ny) (f32.load offset=88 (local.get $sw))))
          (f32.mul (local.get $nz) (f32.load offset=104 (local.get $sw)))))
        ;; DX7 NORMALIZENORMALS applies after transformation to camera space.
        ;; World-space normalization alone leaves a scaled view normal short
        ;; or long, changing specular intensity even with this state enabled.
        (if (call $d3dim_d7_rs (local.get $sw) (i32.const 143)) (then
          (local.set $len (f32.sqrt (f32.add (f32.add
            (f32.mul (local.get $snx) (local.get $snx)) (f32.mul (local.get $sny) (local.get $sny)))
            (f32.mul (local.get $snz) (local.get $snz)))))
          (if (f32.gt (local.get $len) (f32.const 0)) (then
            (local.set $snx (f32.div (local.get $snx) (local.get $len)))
            (local.set $sny (f32.div (local.get $sny) (local.get $len)))
            (local.set $snz (f32.div (local.get $snz) (local.get $len)))))))
        (local.set $ex (f32.const 0)) (local.set $ey (f32.const 0)) (local.set $ez (f32.const -1))
        (if (call $d3dim_d7_rs (local.get $sw) (i32.const 142)) (then
          (local.set $ex (f32.neg (f32.add (f32.add (f32.add
            (f32.mul (local.get $px) (f32.load offset=64 (local.get $sw)))
            (f32.mul (local.get $py) (f32.load offset=80 (local.get $sw))))
            (f32.mul (local.get $pz) (f32.load offset=96 (local.get $sw)))) (f32.load offset=112 (local.get $sw)))))
          (local.set $ey (f32.neg (f32.add (f32.add (f32.add
            (f32.mul (local.get $px) (f32.load offset=68 (local.get $sw)))
            (f32.mul (local.get $py) (f32.load offset=84 (local.get $sw))))
            (f32.mul (local.get $pz) (f32.load offset=100 (local.get $sw)))) (f32.load offset=116 (local.get $sw)))))
          (local.set $ez (f32.neg (f32.add (f32.add (f32.add
            (f32.mul (local.get $px) (f32.load offset=72 (local.get $sw)))
            (f32.mul (local.get $py) (f32.load offset=88 (local.get $sw))))
            (f32.mul (local.get $pz) (f32.load offset=104 (local.get $sw)))) (f32.load offset=120 (local.get $sw)))))
          (local.set $len (f32.sqrt (f32.add (f32.add
            (f32.mul (local.get $ex) (local.get $ex)) (f32.mul (local.get $ey) (local.get $ey)))
            (f32.mul (local.get $ez) (local.get $ez)))))
          (if (f32.gt (local.get $len) (f32.const 0)) (then
            (local.set $ex (f32.div (local.get $ex) (local.get $len)))
            (local.set $ey (f32.div (local.get $ey) (local.get $len)))
            (local.set $ez (f32.div (local.get $ez) (local.get $len)))))))))
      (local.set $k (i32.const 0))
      (if (local.get $tw) (then
        (block $ldone (loop $llp
          (br_if $ldone (i32.ge_u (local.get $k) (i32.const 8)))
          (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $k))) (then
            (local.set $lw (i32.add (local.get $tw) (i32.mul (local.get $k) (i32.const 104))))
            (local.set $ltype (i32.load (local.get $lw)))
            (local.set $att (f32.const 1.0))
            (local.set $spot (f32.const 1.0))
            (if (i32.eq (local.get $ltype) (i32.const 3))
              (then  ;; directional: light travels along dvDirection
                (local.set $lx (f32.neg (f32.load offset=64 (local.get $lw))))
                (local.set $ly (f32.neg (f32.load offset=68 (local.get $lw))))
                (local.set $lz (f32.neg (f32.load offset=72 (local.get $lw))))
                (local.set $d (f32.sqrt (f32.add (f32.add (f32.mul (local.get $lx) (local.get $lx))
                  (f32.mul (local.get $ly) (local.get $ly))) (f32.mul (local.get $lz) (local.get $lz)))))
                (if (f32.gt (local.get $d) (f32.const 0.0)) (then
                  (local.set $lx (f32.div (local.get $lx) (local.get $d)))
                  (local.set $ly (f32.div (local.get $ly) (local.get $d)))
                  (local.set $lz (f32.div (local.get $lz) (local.get $d))))))
              (else  ;; point (1) or spot (2)
                (local.set $lx (f32.sub (f32.load offset=52 (local.get $lw)) (local.get $px)))
                (local.set $ly (f32.sub (f32.load offset=56 (local.get $lw)) (local.get $py)))
                (local.set $lz (f32.sub (f32.load offset=60 (local.get $lw)) (local.get $pz)))
                (local.set $d (f32.sqrt (f32.add (f32.add (f32.mul (local.get $lx) (local.get $lx))
                  (f32.mul (local.get $ly) (local.get $ly))) (f32.mul (local.get $lz) (local.get $lz)))))
                (if (f32.gt (local.get $d) (f32.load offset=76 (local.get $lw)))  ;; dvRange
                  (then (local.set $att (f32.const 0.0)))
                  (else
                    (if (f32.gt (local.get $d) (f32.const 0.0)) (then
                      (local.set $lx (f32.div (local.get $lx) (local.get $d)))
                      (local.set $ly (f32.div (local.get $ly) (local.get $d)))
                      (local.set $lz (f32.div (local.get $lz) (local.get $d)))))
                    (local.set $len (f32.add (f32.add (f32.load offset=84 (local.get $lw))
                      (f32.mul (f32.load offset=88 (local.get $lw)) (local.get $d)))
                      (f32.mul (f32.load offset=92 (local.get $lw)) (f32.mul (local.get $d) (local.get $d)))))
                    (if (f32.gt (local.get $len) (f32.const 0.0))
                      (then (local.set $att (f32.div (f32.const 1.0) (local.get $len)))))))
                (if (i32.and (i32.eq (local.get $ltype) (i32.const 2)) (f32.gt (local.get $att) (f32.const 0.0))) (then
                  ;; rho = cos(angle between the spot axis and the light-to-vertex ray)
                  (local.set $qx (f32.load offset=64 (local.get $lw)))
                  (local.set $qy (f32.load offset=68 (local.get $lw)))
                  (local.set $qz (f32.load offset=72 (local.get $lw)))
                  (local.set $len (f32.sqrt (f32.add (f32.add (f32.mul (local.get $qx) (local.get $qx))
                    (f32.mul (local.get $qy) (local.get $qy))) (f32.mul (local.get $qz) (local.get $qz)))))
                  (if (f32.gt (local.get $len) (f32.const 0.0)) (then
                    (local.set $rho (f32.neg (f32.div (f32.add (f32.add
                      (f32.mul (local.get $lx) (local.get $qx)) (f32.mul (local.get $ly) (local.get $qy)))
                      (f32.mul (local.get $lz) (local.get $qz))) (local.get $len))))
                    (local.set $ct (f32.demote_f64 (call $host_math_cos
                      (f64.promote_f32 (f32.mul (f32.load offset=96 (local.get $lw)) (f32.const 0.5))))))
                    (local.set $cp (f32.demote_f64 (call $host_math_cos
                      (f64.promote_f32 (f32.mul (f32.load offset=100 (local.get $lw)) (f32.const 0.5))))))
                    (if (f32.le (local.get $rho) (local.get $cp))
                      (then (local.set $spot (f32.const 0.0)))
                      (else (if (f32.lt (local.get $rho) (local.get $ct)) (then
                        (local.set $spot (f32.div (f32.sub (local.get $rho) (local.get $cp))
                                                  (f32.sub (local.get $ct) (local.get $cp))))
                        (if (f32.ne (f32.load offset=80 (local.get $lw)) (f32.const 1.0)) (then
                          (local.set $spot (f32.demote_f64 (call $host_math_pow
                            (f64.promote_f32 (local.get $spot))
                            (f64.promote_f32 (f32.load offset=80 (local.get $lw))))))))))))))))))
            (local.set $att (f32.mul (local.get $att) (local.get $spot)))
            (if (local.get $spec_on) (then
              ;; H = normalize(V + L), L pointing from vertex to light.
              (local.set $hx (f32.add (local.get $ex) (f32.add (f32.add
                (f32.mul (local.get $lx) (f32.load offset=64 (local.get $sw)))
                (f32.mul (local.get $ly) (f32.load offset=80 (local.get $sw))))
                (f32.mul (local.get $lz) (f32.load offset=96 (local.get $sw))))))
              (local.set $hy (f32.add (local.get $ey) (f32.add (f32.add
                (f32.mul (local.get $lx) (f32.load offset=68 (local.get $sw)))
                (f32.mul (local.get $ly) (f32.load offset=84 (local.get $sw))))
                (f32.mul (local.get $lz) (f32.load offset=100 (local.get $sw))))))
              (local.set $hz (f32.add (local.get $ez) (f32.add (f32.add
                (f32.mul (local.get $lx) (f32.load offset=72 (local.get $sw)))
                (f32.mul (local.get $ly) (f32.load offset=88 (local.get $sw))))
                (f32.mul (local.get $lz) (f32.load offset=104 (local.get $sw))))))
              (local.set $len (f32.sqrt (f32.add (f32.add
                (f32.mul (local.get $hx) (local.get $hx)) (f32.mul (local.get $hy) (local.get $hy)))
                (f32.mul (local.get $hz) (local.get $hz)))))
              (if (f32.gt (local.get $len) (f32.const 0)) (then
                (local.set $rs (f32.min (f32.const 1) (f32.max (f32.const 0) (f32.div
                  (f32.add (f32.add (f32.mul (local.get $snx) (local.get $hx))
                    (f32.mul (local.get $sny) (local.get $hy)))
                    (f32.mul (local.get $snz) (local.get $hz))) (local.get $len)))))
                (local.set $rs (f32.mul (local.get $att) (f32.demote_f64 (call $host_math_pow
                  (f64.promote_f32 (local.get $rs)) (f64.promote_f32 (local.get $power))))))
                (local.set $sr (f32.add (local.get $sr) (f32.mul (local.get $rs) (f32.load offset=20 (local.get $lw)))))
                (local.set $sg (f32.add (local.get $sg) (f32.mul (local.get $rs) (f32.load offset=24 (local.get $lw)))))
                (local.set $sb (f32.add (local.get $sb) (f32.mul (local.get $rs) (f32.load offset=28 (local.get $lw)))))))))
            (local.set $ar (f32.add (local.get $ar) (f32.mul (local.get $att) (f32.load offset=36 (local.get $lw)))))
            (local.set $ag (f32.add (local.get $ag) (f32.mul (local.get $att) (f32.load offset=40 (local.get $lw)))))
            (local.set $ab (f32.add (local.get $ab) (f32.mul (local.get $att) (f32.load offset=44 (local.get $lw)))))
            (local.set $ndl (f32.add (f32.add (f32.mul (local.get $nx) (local.get $lx))
              (f32.mul (local.get $ny) (local.get $ly))) (f32.mul (local.get $nz) (local.get $lz))))
            (if (f32.gt (local.get $ndl) (f32.const 0.0)) (then
              (local.set $ndl (f32.mul (local.get $ndl) (local.get $att)))
              (local.set $dr (f32.add (local.get $dr) (f32.mul (local.get $ndl) (f32.load offset=4 (local.get $lw)))))
              (local.set $dg (f32.add (local.get $dg) (f32.mul (local.get $ndl) (f32.load offset=8 (local.get $lw)))))
              (local.set $db (f32.add (local.get $db) (f32.mul (local.get $ndl) (f32.load offset=12 (local.get $lw)))))))))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br $llp)))))
      (local.set $cd (call $d3dim_d7_mat_color (local.get $sw) (i32.const 0) (i32.const 145)
        (local.get $vdiff) (local.get $vspec) (local.get $has_diff) (local.get $has_spec)))
      (local.set $ca (call $d3dim_d7_mat_color (local.get $sw) (i32.const 1) (i32.const 147)
        (local.get $vdiff) (local.get $vspec) (local.get $has_diff) (local.get $has_spec)))
      (local.set $ce (call $d3dim_d7_mat_color (local.get $sw) (i32.const 3) (i32.const 148)
        (local.get $vdiff) (local.get $vspec) (local.get $has_diff) (local.get $has_spec)))
      (local.set $dst (call $g2w (i32.add (local.get $packed_g) (i32.shl (local.get $i) (i32.const 5)))))
      (if (i32.eq (local.get $vtxType) (i32.const 1)) (then
        ;; D3DVERTEX had the normal at +12..+23; D3DLVERTEX has reserved,colour,specular there.
        ;; Specular alpha is the vertex fog factor: 255, no fog (not 0, solid fog).
        (i32.store offset=12 (local.get $dst) (i32.const 0))
        (i32.store offset=20 (local.get $dst) (i32.const 0xFF000000))))
      ;; Keep material floats until the final RGB conversion. Packing a small
      ;; material channel first can erase a highlight from a bright light.
      (local.set $cs (call $d3dim_d7_rs (local.get $sw) (i32.const 146)))
      (if (i32.and
        (i32.ne (call $d3dim_d7_rs (local.get $sw) (i32.const 141)) (i32.const 0))
        (i32.or (i32.and (i32.eq (local.get $cs) (i32.const 1)) (local.get $has_diff))
                (i32.and (i32.eq (local.get $cs) (i32.const 2)) (local.get $has_spec))))
        (then
          (local.set $cs (select (local.get $vdiff) (local.get $vspec) (i32.eq (local.get $cs) (i32.const 1))))
          (local.set $sr (f32.mul (local.get $sr) (call $d3dim_d7_ch (local.get $cs) (i32.const 16))))
          (local.set $sg (f32.mul (local.get $sg) (call $d3dim_d7_ch (local.get $cs) (i32.const 8))))
          (local.set $sb (f32.mul (local.get $sb) (call $d3dim_d7_ch (local.get $cs) (i32.const 0)))))
        (else
          (local.set $cs (i32.add (local.get $sw) (global.get $D3DIM_OFF_D3D7_MAT)))
          (local.set $sr (f32.mul (local.get $sr) (f32.load offset=32 (local.get $cs))))
          (local.set $sg (f32.mul (local.get $sg) (f32.load offset=36 (local.get $cs))))
          (local.set $sb (f32.mul (local.get $sb) (f32.load offset=40 (local.get $cs))))))
      (i32.store offset=20 (local.get $dst) (i32.or
        (i32.and (i32.load offset=20 (local.get $dst)) (i32.const 0xFF000000))
        (call $d3dim_d7_pack4 (local.get $sr) (local.get $sg) (local.get $sb) (f32.const 0))))
      (i32.store offset=16 (local.get $dst)
        (call $d3dim_d7_pack4
          (f32.add (f32.add (call $d3dim_d7_ch (local.get $ce) (i32.const 16))
            (f32.mul (call $d3dim_d7_ch (local.get $ca) (i32.const 16)) (local.get $ar)))
            (f32.mul (call $d3dim_d7_ch (local.get $cd) (i32.const 16)) (local.get $dr)))
          (f32.add (f32.add (call $d3dim_d7_ch (local.get $ce) (i32.const 8))
            (f32.mul (call $d3dim_d7_ch (local.get $ca) (i32.const 8)) (local.get $ag)))
            (f32.mul (call $d3dim_d7_ch (local.get $cd) (i32.const 8)) (local.get $dg)))
          (f32.add (f32.add (call $d3dim_d7_ch (local.get $ce) (i32.const 0))
            (f32.mul (call $d3dim_d7_ch (local.get $ca) (i32.const 0)) (local.get $ab)))
            (f32.mul (call $d3dim_d7_ch (local.get $cd) (i32.const 0)) (local.get $db)))
          (call $d3dim_d7_ch (local.get $cd) (i32.const 24))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (if (i32.eq (local.get $vtxType) (i32.const 1)) (then
      (call $d3dim_d7_normal_texcoords (local.get $state) (local.get $fvf)
        (local.get $src_g) (local.get $packed_g) (local.get $count))))
    (i32.const 2))

  (func $d3dim_device7_set_clip_plane (param $this i32) (param $idx i32) (param $plane i32)
    (local $state i32)
    (if (i32.eqz (local.get $plane)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.ge_u (local.get $idx) (i32.const 6)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (call $d3dim_sb_record (local.get $this) (i32.const 6) (local.get $idx) (local.get $plane) (i32.const 16)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then (call $memcpy
              (call $g2w
                (i32.add
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_D3D7_CLIP_PLANES))
                  (i32.mul (local.get $idx) (i32.const 16))))
              (call $g2w (local.get $plane))
              (i32.const 16))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_get_clip_plane (param $this i32) (param $idx i32) (param $plane i32)
    (local $state i32)
    (if (i32.eqz (local.get $plane)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.ge_u (local.get $idx) (i32.const 6))
      (then
        (call $zero_memory (call $g2w (local.get $plane)) (i32.const 16))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state)
      (then (call $memcpy
              (call $g2w (local.get $plane))
              (call $g2w
                (i32.add
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_D3D7_CLIP_PLANES))
                  (i32.mul (local.get $idx) (i32.const 16))))
              (i32.const 16)))
      (else (call $zero_memory (call $g2w (local.get $plane)) (i32.const 16))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_material_pack_color (param $mat_wa i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32)
    (local.set $r (i32.trunc_sat_f32_u
      (f32.mul
        (f32.min (f32.max (f32.load (i32.add (local.get $mat_wa) (i32.const 4))) (f32.const 0.0)) (f32.const 1.0))
        (f32.const 255.0))))
    (local.set $g (i32.trunc_sat_f32_u
      (f32.mul
        (f32.min (f32.max (f32.load (i32.add (local.get $mat_wa) (i32.const 8))) (f32.const 0.0)) (f32.const 1.0))
        (f32.const 255.0))))
    (local.set $b (i32.trunc_sat_f32_u
      (f32.mul
        (f32.min (f32.max (f32.load (i32.add (local.get $mat_wa) (i32.const 12))) (f32.const 0.0)) (f32.const 1.0))
        (f32.const 255.0))))
    (i32.or (i32.const 0xFF000000)
      (i32.or
        (i32.shl (local.get $r) (i32.const 16))
        (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))

  (func $d3dim_scale_color (param $color i32) (param $shade f32) (result i32)
    (local $r i32) (local $g i32) (local $b i32)
    (if (f32.lt (local.get $shade) (f32.const 0.0)) (then (local.set $shade (f32.const 0.0))))
    (if (f32.gt (local.get $shade) (f32.const 1.0)) (then (local.set $shade (f32.const 1.0))))
    (local.set $r (i32.trunc_sat_f32_u
      (f32.mul
        (f32.convert_i32_u (i32.and (i32.shr_u (local.get $color) (i32.const 16)) (i32.const 0xFF)))
        (local.get $shade))))
    (local.set $g (i32.trunc_sat_f32_u
      (f32.mul
        (f32.convert_i32_u (i32.and (i32.shr_u (local.get $color) (i32.const 8)) (i32.const 0xFF)))
        (local.get $shade))))
    (local.set $b (i32.trunc_sat_f32_u
      (f32.mul
        (f32.convert_i32_u (i32.and (local.get $color) (i32.const 0xFF)))
        (local.get $shade))))
    (i32.or (i32.const 0xFF000000)
      (i32.or
        (i32.shl (local.get $r) (i32.const 16))
        (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))

  (func $d3dim_material_color_from_handle (param $handle i32) (result i32)
    (local $entry i32) (local $mat i32) (local $sz i32)
    (if (i32.or (i32.eqz (local.get $handle))
                (i32.ge_u (local.get $handle) (global.get $DX_MAX)))
      (then (return (i32.const 0xFFFFFFFF))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS)
      (i32.mul (local.get $handle) (i32.const 32))))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 25))
      (then (return (i32.const 0xFFFFFFFF))))
    (local.set $mat (load.field DxObject misc0 (local.get $entry)))
    (local.set $sz (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (if (i32.or (i32.eqz (local.get $mat)) (i32.lt_u (local.get $sz) (i32.const 20)))
      (then (return (i32.const 0xFFFFFFFF))))
    (call $d3dim_material_pack_color (call $g2w (local.get $mat))))

  ;; The texture a material carries in D3DMATERIAL.hTexture (+72), resolved to a
  ;; DX surface entry, or 0 when the material is a plain colour.
  ;;
  ;; A viewport background set from a D3DRM scene *image* arrives this way: the
  ;; material's diffuse stays white and the picture hangs off hTexture, so a
  ;; clear that only reads the diffuse paints the whole frame white. That is
  ;; exactly what the Plus! 98 Organic Art screensavers (ROCKROLL, GEOMETRY)
  ;; showed -- correct geometry over a blank white sky.
  (func $d3dim_material_texture_entry (param $handle i32) (result i32)
    (local $entry i32) (local $mat i32) (local $sz i32)
    (if (i32.or (i32.eqz (local.get $handle))
                (i32.ge_u (local.get $handle) (global.get $DX_MAX)))
      (then (return (i32.const 0))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS)
      (i32.mul (local.get $handle) (i32.const 32))))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 25))
      (then (return (i32.const 0))))
    (local.set $mat (load.field DxObject misc0 (local.get $entry)))
    (local.set $sz (i32.load (i32.add (local.get $entry) (i32.const 12))))
    ;; hTexture sits at +72, so a material struct shorter than that has none.
    (if (i32.or (i32.eqz (local.get $mat)) (i32.lt_u (local.get $sz) (i32.const 76)))
      (then (return (i32.const 0))))
    (call $d3dim_texture_entry_from_slot
      (call $gl32 (i32.add (local.get $mat) (i32.const 72)))))

  (func $d3dim_current_material_color (param $state_guest i32) (result i32)
    (if (i32.eqz (local.get $state_guest)) (then (return (i32.const 0xFFFFFFFF))))
    ;; D3DLIGHTSTATE_MATERIAL = 1, stored at state+2304+1*4.
    (call $d3dim_material_color_from_handle
      (call $gl32 (i32.add (local.get $state_guest) (i32.const 2308)))))

  ;; The material handle bound via D3DLIGHTSTATE_MATERIAL, as a guest pointer to
  ;; the caller's D3DMATERIAL (dcvDiffuse@4, dcvAmbient@20, dcvEmissive@52).
  ;; 0 when no usable material is bound.
  (func $d3dim_current_material_ptr (param $state_guest i32) (result i32)
    (local $handle i32) (local $entry i32)
    (if (i32.eqz (local.get $state_guest)) (then (return (i32.const 0))))
    (local.set $handle (call $gl32 (i32.add (local.get $state_guest) (i32.const 2308))))
    (if (i32.or (i32.eqz (local.get $handle))
                (i32.ge_u (local.get $handle) (global.get $DX_MAX)))
      (then (return (i32.const 0))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS)
      (i32.mul (local.get $handle) (i32.const 32))))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 25)) (then (return (i32.const 0))))
    (if (i32.lt_u (i32.load (i32.add (local.get $entry) (i32.const 12))) (i32.const 20))
      (then (return (i32.const 0))))
    (load.field DxObject misc0 (local.get $entry)))

  ;; ── Fixed-function lighting ───────────────────────────────────
  ;; IDirect3DLight slots are DX_OBJECTS type 24 with their 76-byte D3DLIGHT
  ;; buffer hanging off entry+8 (see $dx_light_buf). The shared allocation bound
  ;; skips slots that have never held lights. Callers refresh this cache once per
  ;; draw call — every entry point that lights vertices already calls
  ;; $d3ddev_composite_wvp, and the refresh sits next to it.
  (global $d3dim_light_n (mut i32) (i32.const 0))
  (global $d3dim_light0 (mut i32) (i32.const 0))
  (global $d3dim_light1 (mut i32) (i32.const 0))
  (global $d3dim_light2 (mut i32) (i32.const 0))
  (global $d3dim_light3 (mut i32) (i32.const 0))

  (global $d3dim_dbg_light_last (mut i32) (i32.const -1))

  (func $d3dim_lights_refresh (param $state_guest i32)
    (local $i i32) (local $entry i32) (local $buf i32) (local $n i32) (local $mat i32)
    (local $limit i32)
    (local.set $limit (i32.atomic.load (global.get $DX_LIGHT_LIMIT)))
    (local.set $n (i32.const 0))
    (local.set $i (i32.const 1))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $limit)))
      (br_if $done (i32.ge_u (local.get $n) (i32.const 4)))
      (local.set $entry (i32.add (global.get $DX_OBJECTS)
        (i32.mul (local.get $i) (i32.const 32))))
      (if (i32.eq (i32.load (local.get $entry)) (i32.const 24)) (then
        (local.set $buf (i32.load (i32.add (local.get $entry) (i32.const 8))))
        ;; dwSize==0 ⇒ CreateLight ran but SetLight never did; nothing to shade with.
        (if (local.get $buf) (then
          (if (call $gl32 (local.get $buf)) (then
            (if (i32.eq (local.get $n) (i32.const 0)) (then (global.set $d3dim_light0 (local.get $buf))))
            (if (i32.eq (local.get $n) (i32.const 1)) (then (global.set $d3dim_light1 (local.get $buf))))
            (if (i32.eq (local.get $n) (i32.const 2)) (then (global.set $d3dim_light2 (local.get $buf))))
            (if (i32.eq (local.get $n) (i32.const 3)) (then (global.set $d3dim_light3 (local.get $buf))))
            (local.set $n (i32.add (local.get $n) (i32.const 1)))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (global.set $d3dim_light_n (local.get $n))
    ;; kind=19 Lights: how many lights are live, plus the first light record and
    ;; the bound material. "White geometry" and "no material bound" render the
    ;; same and cannot be told apart from the API trace.
    (local.set $mat (call $d3dim_current_material_ptr (local.get $state_guest)))
    (local.set $entry (i32.or (i32.shl (local.get $n) (i32.const 1))
                              (i32.ne (local.get $mat) (i32.const 0))))
    (if (i32.ne (local.get $entry) (global.get $d3dim_dbg_light_last)) (then
      (global.set $d3dim_dbg_light_last (local.get $entry))
      (call $host_dx_trace (i32.const 19) (local.get $n)
        (select (call $g2w (call $d3dim_light_slot (i32.const 0))) (i32.const 0)
                (i32.ne (local.get $n) (i32.const 0)))
        (select (call $g2w (local.get $mat)) (i32.const 0)
                (i32.ne (local.get $mat) (i32.const 0)))
        (select (call $gl32 (i32.add (local.get $state_guest) (i32.const 2312))) (i32.const 0)
                (i32.ne (local.get $state_guest) (i32.const 0)))))))

  (func $d3dim_light_slot (param $i i32) (result i32)
    (if (i32.eq (local.get $i) (i32.const 0)) (then (return (global.get $d3dim_light0))))
    (if (i32.eq (local.get $i) (i32.const 1)) (then (return (global.get $d3dim_light1))))
    (if (i32.eq (local.get $i) (i32.const 2)) (then (return (global.get $d3dim_light2))))
    (global.get $d3dim_light3))

  ;; Legacy shape-only shading, kept for meshes drawn with TRANSFORMLIGHT before
  ;; the app has configured a single light: real D3D would render those flat.
  (func $d3dim_vertex_shade_fallback (param $state_guest i32) (param $src_wa i32) (result i32)
    (call $d3dim_scale_color
      (call $d3dim_current_material_color (local.get $state_guest))
      (f32.add (f32.const 0.25)
        (f32.mul (f32.const 0.75)
          (f32.abs (f32.load (i32.add (local.get $src_wa) (i32.const 20))))))))

  ;; D3DVERTEX: position xyz @0, normal xyz @12, tu/tv @24.
  ;; colour = emissive + ambient_light*mat.ambient
  ;;        + Σ light.colour * mat.diffuse * max(0, N·L) * attenuation
  (func $d3dim_vertex_lit_color (param $state_guest i32) (param $src_wa i32) (result i32)
    (local $sw i32) (local $m i32) (local $mat i32) (local $mw i32) (local $msz i32)
    (local $amb i32) (local $i i32) (local $lp i32) (local $lw i32) (local $ltype i32)
    (local $nx f32) (local $ny f32) (local $nz f32) (local $len f32)
    (local $px f32) (local $py f32) (local $pz f32)
    (local $lx f32) (local $ly f32) (local $lz f32) (local $d f32)
    (local $ndl f32) (local $atten f32) (local $a0 f32) (local $a1 f32) (local $a2 f32)
    (local $range f32)
    (local $dr f32) (local $dg f32) (local $db f32)
    (local $ar f32) (local $ag f32) (local $ab f32)
    (local $r f32) (local $g f32) (local $b f32) (local $da f32)
    (if (i32.eqz (local.get $state_guest))
      (then (return (call $d3dim_vertex_shade_fallback (local.get $state_guest) (local.get $src_wa)))))
    (if (i32.eqz (global.get $d3dim_light_n))
      (then (return (call $d3dim_vertex_shade_fallback (local.get $state_guest) (local.get $src_wa)))))
    (local.set $sw (call $g2w (local.get $state_guest)))
    (local.set $m (local.get $sw))   ;; world matrix @ state+0

    ;; Material reflectances. With no material bound, D3D's defaults are white
    ;; diffuse and black ambient; we keep white ambient so an ambient-only scene
    ;; is not pitch black.
    (local.set $dr (f32.const 1.0)) (local.set $dg (f32.const 1.0)) (local.set $db (f32.const 1.0))
    (local.set $ar (f32.const 1.0)) (local.set $ag (f32.const 1.0)) (local.set $ab (f32.const 1.0))
    (local.set $r (f32.const 0.0)) (local.set $g (f32.const 0.0)) (local.set $b (f32.const 0.0))
    (local.set $da (f32.const 1.0))
    (local.set $mat (call $d3dim_current_material_ptr (local.get $state_guest)))
    (if (local.get $mat) (then
      (local.set $mw (call $g2w (local.get $mat)))
      (local.set $msz (i32.load (local.get $mw)))
      (local.set $dr (f32.load (i32.add (local.get $mw) (i32.const 4))))
      (local.set $dg (f32.load (i32.add (local.get $mw) (i32.const 8))))
      (local.set $db (f32.load (i32.add (local.get $mw) (i32.const 12))))
      ;; The lit vertex's alpha is the material's diffuse alpha, not 1:
      ;; d3drm shadows (Falling Leaves) bind black diffuse a=0.5 and blend
      ;; SRCALPHA/INVSRCALPHA; a forced 0xFF made every shadow opaque black.
      ;; https://gamedev.net/blogs/entry/2250151-direct3d9-ffp-lighting
      (local.set $da (f32.load (i32.add (local.get $mw) (i32.const 16))))
      (if (i32.ge_u (local.get $msz) (i32.const 36)) (then
        (local.set $ar (f32.load (i32.add (local.get $mw) (i32.const 20))))
        (local.set $ag (f32.load (i32.add (local.get $mw) (i32.const 24))))
        (local.set $ab (f32.load (i32.add (local.get $mw) (i32.const 28))))))
      ;; dcvEmissive @52 (needs the full 80-byte D3DMATERIAL)
      (if (i32.ge_u (local.get $msz) (i32.const 68)) (then
        (local.set $r (f32.load (i32.add (local.get $mw) (i32.const 52))))
        (local.set $g (f32.load (i32.add (local.get $mw) (i32.const 56))))
        (local.set $b (f32.load (i32.add (local.get $mw) (i32.const 60))))))))

    ;; D3DLIGHTSTATE_AMBIENT = 2 ⇒ state+2304+2*4, a D3DCOLOR.
    (local.set $amb (call $gl32 (i32.add (local.get $state_guest) (i32.const 2312))))
    (local.set $r (f32.add (local.get $r) (f32.mul (local.get $ar)
      (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $amb) (i32.const 16)) (i32.const 0xFF))) (f32.const 255.0)))))
    (local.set $g (f32.add (local.get $g) (f32.mul (local.get $ag)
      (f32.div (f32.convert_i32_u (i32.and (i32.shr_u (local.get $amb) (i32.const 8)) (i32.const 0xFF))) (f32.const 255.0)))))
    (local.set $b (f32.add (local.get $b) (f32.mul (local.get $ab)
      (f32.div (f32.convert_i32_u (i32.and (local.get $amb) (i32.const 0xFF))) (f32.const 255.0)))))

    ;; Lights live in world space, so take the vertex there too: row-vector
    ;; convention, m[i][j] at (i*4+j)*4.
    (local.set $nx (f32.load (i32.add (local.get $src_wa) (i32.const 12))))
    (local.set $ny (f32.load (i32.add (local.get $src_wa) (i32.const 16))))
    (local.set $nz (f32.load (i32.add (local.get $src_wa) (i32.const 20))))
    (local.set $px (f32.add (f32.add
      (f32.mul (local.get $nx) (f32.load (i32.add (local.get $m) (i32.const 0))))
      (f32.mul (local.get $ny) (f32.load (i32.add (local.get $m) (i32.const 16)))))
      (f32.mul (local.get $nz) (f32.load (i32.add (local.get $m) (i32.const 32))))))
    (local.set $py (f32.add (f32.add
      (f32.mul (local.get $nx) (f32.load (i32.add (local.get $m) (i32.const 4))))
      (f32.mul (local.get $ny) (f32.load (i32.add (local.get $m) (i32.const 20)))))
      (f32.mul (local.get $nz) (f32.load (i32.add (local.get $m) (i32.const 36))))))
    (local.set $pz (f32.add (f32.add
      (f32.mul (local.get $nx) (f32.load (i32.add (local.get $m) (i32.const 8))))
      (f32.mul (local.get $ny) (f32.load (i32.add (local.get $m) (i32.const 24)))))
      (f32.mul (local.get $nz) (f32.load (i32.add (local.get $m) (i32.const 40))))))
    (local.set $nx (local.get $px))
    (local.set $ny (local.get $py))
    (local.set $nz (local.get $pz))
    (local.set $len (f32.sqrt (f32.add (f32.add
      (f32.mul (local.get $nx) (local.get $nx))
      (f32.mul (local.get $ny) (local.get $ny)))
      (f32.mul (local.get $nz) (local.get $nz)))))
    (if (f32.lt (local.get $len) (f32.const 0.000001))
      (then (local.set $nz (f32.const 1.0)) (local.set $nx (f32.const 0.0)) (local.set $ny (f32.const 0.0)))
      (else
        (local.set $nx (f32.div (local.get $nx) (local.get $len)))
        (local.set $ny (f32.div (local.get $ny) (local.get $len)))
        (local.set $nz (f32.div (local.get $nz) (local.get $len)))))

    (local.set $px (f32.add (f32.add (f32.add
      (f32.mul (f32.load (local.get $src_wa)) (f32.load (i32.add (local.get $m) (i32.const 0))))
      (f32.mul (f32.load (i32.add (local.get $src_wa) (i32.const 4))) (f32.load (i32.add (local.get $m) (i32.const 16)))))
      (f32.mul (f32.load (i32.add (local.get $src_wa) (i32.const 8))) (f32.load (i32.add (local.get $m) (i32.const 32)))))
      (f32.load (i32.add (local.get $m) (i32.const 48)))))
    (local.set $py (f32.add (f32.add (f32.add
      (f32.mul (f32.load (local.get $src_wa)) (f32.load (i32.add (local.get $m) (i32.const 4))))
      (f32.mul (f32.load (i32.add (local.get $src_wa) (i32.const 4))) (f32.load (i32.add (local.get $m) (i32.const 20)))))
      (f32.mul (f32.load (i32.add (local.get $src_wa) (i32.const 8))) (f32.load (i32.add (local.get $m) (i32.const 36)))))
      (f32.load (i32.add (local.get $m) (i32.const 52)))))
    (local.set $pz (f32.add (f32.add (f32.add
      (f32.mul (f32.load (local.get $src_wa)) (f32.load (i32.add (local.get $m) (i32.const 8))))
      (f32.mul (f32.load (i32.add (local.get $src_wa) (i32.const 4))) (f32.load (i32.add (local.get $m) (i32.const 24)))))
      (f32.mul (f32.load (i32.add (local.get $src_wa) (i32.const 8))) (f32.load (i32.add (local.get $m) (i32.const 40)))))
      (f32.load (i32.add (local.get $m) (i32.const 56)))))

    (local.set $i (i32.const 0))
    (block $ldone (loop $llp
      (br_if $ldone (i32.ge_u (local.get $i) (global.get $d3dim_light_n)))
      (local.set $lp (call $d3dim_light_slot (local.get $i)))
      (if (local.get $lp) (then
        (local.set $lw (call $g2w (local.get $lp)))
        (local.set $ltype (i32.load (i32.add (local.get $lw) (i32.const 4))))
        (local.set $atten (f32.const 1.0))
        (if (i32.eq (local.get $ltype) (i32.const 3))
          (then
            ;; Directional: dvDirection points the way the light travels, so L is
            ;; its negation.
            (local.set $lx (f32.neg (f32.load (i32.add (local.get $lw) (i32.const 36)))))
            (local.set $ly (f32.neg (f32.load (i32.add (local.get $lw) (i32.const 40)))))
            (local.set $lz (f32.neg (f32.load (i32.add (local.get $lw) (i32.const 44)))))
            (local.set $d (f32.const 0.0)))
          (else
            (local.set $lx (f32.sub (f32.load (i32.add (local.get $lw) (i32.const 24))) (local.get $px)))
            (local.set $ly (f32.sub (f32.load (i32.add (local.get $lw) (i32.const 28))) (local.get $py)))
            (local.set $lz (f32.sub (f32.load (i32.add (local.get $lw) (i32.const 32))) (local.get $pz)))
            (local.set $d (f32.sqrt (f32.add (f32.add
              (f32.mul (local.get $lx) (local.get $lx))
              (f32.mul (local.get $ly) (local.get $ly)))
              (f32.mul (local.get $lz) (local.get $lz)))))))
        (local.set $len (f32.sqrt (f32.add (f32.add
          (f32.mul (local.get $lx) (local.get $lx))
          (f32.mul (local.get $ly) (local.get $ly)))
          (f32.mul (local.get $lz) (local.get $lz)))))
        (if (f32.gt (local.get $len) (f32.const 0.000001)) (then
          (local.set $lx (f32.div (local.get $lx) (local.get $len)))
          (local.set $ly (f32.div (local.get $ly) (local.get $len)))
          (local.set $lz (f32.div (local.get $lz) (local.get $len)))
          (if (i32.ne (local.get $ltype) (i32.const 3)) (then
            (local.set $range (f32.load (i32.add (local.get $lw) (i32.const 48))))
            (if (f32.gt (local.get $range) (f32.const 0.0)) (then
              (if (f32.gt (local.get $d) (local.get $range))
                (then (local.set $atten (f32.const 0.0))))))
            (local.set $a0 (f32.load (i32.add (local.get $lw) (i32.const 56))))
            (local.set $a1 (f32.load (i32.add (local.get $lw) (i32.const 60))))
            (local.set $a2 (f32.load (i32.add (local.get $lw) (i32.const 64))))
            (local.set $len (f32.add (f32.add (local.get $a0)
              (f32.mul (local.get $a1) (local.get $d)))
              (f32.mul (f32.mul (local.get $a2) (local.get $d)) (local.get $d))))
            (if (f32.gt (local.get $len) (f32.const 0.000001)) (then
              (local.set $atten (f32.mul (local.get $atten)
                (f32.min (f32.const 1.0) (f32.div (f32.const 1.0) (local.get $len)))))))))
          (local.set $ndl (f32.add (f32.add
            (f32.mul (local.get $nx) (local.get $lx))
            (f32.mul (local.get $ny) (local.get $ly)))
            (f32.mul (local.get $nz) (local.get $lz))))
          (local.set $ndl (f32.max (local.get $ndl) (f32.const 0.0)))
          (local.set $ndl (f32.mul (local.get $ndl) (local.get $atten)))
          (if (f32.gt (local.get $ndl) (f32.const 0.0)) (then
            (local.set $r (f32.add (local.get $r) (f32.mul (f32.mul (local.get $dr) (local.get $ndl))
              (f32.load (i32.add (local.get $lw) (i32.const 8))))))
            (local.set $g (f32.add (local.get $g) (f32.mul (f32.mul (local.get $dg) (local.get $ndl))
              (f32.load (i32.add (local.get $lw) (i32.const 12))))))
            (local.set $b (f32.add (local.get $b) (f32.mul (f32.mul (local.get $db) (local.get $ndl))
              (f32.load (i32.add (local.get $lw) (i32.const 16))))))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $llp)))

    (i32.or (i32.shl (i32.trunc_sat_f32_u (f32.nearest (f32.mul
        (f32.min (f32.max (local.get $da) (f32.const 0.0)) (f32.const 1.0)) (f32.const 255.0)))) (i32.const 24))
      (i32.or
        (i32.shl (i32.trunc_sat_f32_u (f32.mul (f32.min (f32.max (local.get $r) (f32.const 0.0)) (f32.const 1.0)) (f32.const 255.0))) (i32.const 16))
        (i32.or
          (i32.shl (i32.trunc_sat_f32_u (f32.mul (f32.min (f32.max (local.get $g) (f32.const 0.0)) (f32.const 1.0)) (f32.const 255.0))) (i32.const 8))
          (i32.trunc_sat_f32_u (f32.mul (f32.min (f32.max (local.get $b) (f32.const 0.0)) (f32.const 1.0)) (f32.const 255.0)))))))

  ;; ── Texture binding ───────────────────────────────────────────
  ;; Expand a 5-bit channel to all eight bits rather than leaving its low bits
  ;; black; this matches fixed-function texture sampling more closely.
  (func $d3dim_expand5 (param $v i32) (result i32)
    (i32.or (i32.shl (local.get $v) (i32.const 3))
            (i32.shr_u (local.get $v) (i32.const 2))))

  (func $d3dim_expand6 (param $v i32) (result i32)
    (i32.or (i32.shl (local.get $v) (i32.const 2))
            (i32.shr_u (local.get $v) (i32.const 4))))

  ;; Decode a native surface pixel to 0xAARRGGBB according to the format that
  ;; CreateSurface retained from DDPIXELFORMAT.
  (func $d3dim_decode_surface_pixel_fmt
    (param $fmt i32) (param $px i32) (param $bpp i32) (result i32)
    (local $a i32) (local $r i32) (local $g i32) (local $b i32)
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (if (i32.eq (local.get $fmt) (i32.const 4)) (then
        (local.set $a (i32.mul (i32.and (i32.shr_u (local.get $px) (i32.const 12)) (i32.const 15)) (i32.const 17)))
        (local.set $r (i32.mul (i32.and (i32.shr_u (local.get $px) (i32.const 8)) (i32.const 15)) (i32.const 17)))
        (local.set $g (i32.mul (i32.and (i32.shr_u (local.get $px) (i32.const 4)) (i32.const 15)) (i32.const 17)))
        (local.set $b (i32.mul (i32.and (local.get $px) (i32.const 15)) (i32.const 17)))
        (return (i32.or (i32.shl (local.get $a) (i32.const 24))
          (i32.or (i32.shl (local.get $r) (i32.const 16))
            (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))))
      (if (i32.or (i32.eq (local.get $fmt) (i32.const 2))
                  (i32.eq (local.get $fmt) (i32.const 3))) (then
        (local.set $a (i32.const 255))
        (if (i32.eq (local.get $fmt) (i32.const 3))
          (then (local.set $a (select (i32.const 255) (i32.const 0)
            (i32.ne (i32.and (local.get $px) (i32.const 0x8000)) (i32.const 0))))))
        (local.set $r (call $d3dim_expand5 (i32.and (i32.shr_u (local.get $px) (i32.const 10)) (i32.const 31))))
        (local.set $g (call $d3dim_expand5 (i32.and (i32.shr_u (local.get $px) (i32.const 5)) (i32.const 31))))
        (local.set $b (call $d3dim_expand5 (i32.and (local.get $px) (i32.const 31))))
        (return (i32.or (i32.shl (local.get $a) (i32.const 24))
          (i32.or (i32.shl (local.get $r) (i32.const 16))
            (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))))
      (local.set $r (call $d3dim_expand5 (i32.and (i32.shr_u (local.get $px) (i32.const 11)) (i32.const 31))))
      (local.set $g (call $d3dim_expand6 (i32.and (i32.shr_u (local.get $px) (i32.const 5)) (i32.const 63))))
      (local.set $b (call $d3dim_expand5 (i32.and (local.get $px) (i32.const 31))))
      (return (i32.or (i32.const 0xFF000000)
        (i32.or (i32.shl (local.get $r) (i32.const 16))
          (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (if (i32.eq (local.get $fmt) (i32.const 5))
        (then (return (local.get $px))))
      (return (i32.or (local.get $px) (i32.const 0xFF000000)))))
    (i32.or (local.get $px) (i32.const 0xFF000000)))

  (func $d3dim_decode_surface_pixel
    (param $entry i32) (param $px i32) (param $bpp i32) (result i32)
    (call $d3dim_decode_surface_pixel_fmt
      (call $dx_surf_fmt_get (local.get $entry)) (local.get $px) (local.get $bpp)))

  ;; Encode 0xAARRGGBB into a native surface pixel.
  (func $d3dim_encode_surface_pixel
    (param $entry i32) (param $argb i32) (param $bpp i32) (result i32)
    (local $fmt i32)
    (local.set $fmt (call $dx_surf_fmt_get (local.get $entry)))
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (if (i32.eq (local.get $fmt) (i32.const 4)) (then
        (return (i32.or
          (i32.and (i32.shr_u (local.get $argb) (i32.const 16)) (i32.const 0xF000))
          (i32.or
            (i32.and (i32.shr_u (local.get $argb) (i32.const 12)) (i32.const 0x0F00))
            (i32.or
              (i32.and (i32.shr_u (local.get $argb) (i32.const 8)) (i32.const 0x00F0))
              (i32.and (i32.shr_u (local.get $argb) (i32.const 4)) (i32.const 0x000F))))))))
      (if (i32.or (i32.eq (local.get $fmt) (i32.const 2))
                  (i32.eq (local.get $fmt) (i32.const 3))) (then
        (return (i32.or
          (select (i32.const 0x8000) (i32.const 0)
            (i32.and (i32.eq (local.get $fmt) (i32.const 3))
                     (i32.ge_u (i32.shr_u (local.get $argb) (i32.const 24)) (i32.const 128))))
          (i32.or
            (i32.and (i32.shr_u (local.get $argb) (i32.const 9)) (i32.const 0x7C00))
            (i32.or
              (i32.and (i32.shr_u (local.get $argb) (i32.const 6)) (i32.const 0x03E0))
              (i32.and (i32.shr_u (local.get $argb) (i32.const 3)) (i32.const 0x001F))))))))
      (return (i32.or
        (i32.and (i32.shr_u (local.get $argb) (i32.const 8)) (i32.const 0xF800))
        (i32.or
          (i32.and (i32.shr_u (local.get $argb) (i32.const 5)) (i32.const 0x07E0))
          (i32.and (i32.shr_u (local.get $argb) (i32.const 3)) (i32.const 0x001F)))))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (if (i32.eq (local.get $fmt) (i32.const 5))
        (then (return (local.get $argb))))
      (return (i32.or (local.get $argb) (i32.const 0xFF000000)))))
    (i32.and (local.get $argb) (i32.const 0x00FFFFFF)))

  ;; Expand an indexed pixel or native key with the source surface palette.
  (func $d3dim_surface_index_rgb (param $entry i32) (param $idx i32) (result i32)
    (local $pal i32) (local $px i32)
    (local.set $pal (call $dx_surf_pal_get (local.get $entry)))
    (if (local.get $pal) (then
      ;; PALETTEENTRY is (peRed, peGreen, peBlue, peFlags).
      (local.set $px (i32.load (i32.add (local.get $pal) (i32.shl (local.get $idx) (i32.const 2)))))
      (return (i32.or (select (i32.and (local.get $px) (i32.const 0xFF000000)) (i32.const 0xFF000000) (call $dx_surf_pal_alpha (local.get $entry))) (i32.or (i32.or
        (i32.shl (i32.and (local.get $px) (i32.const 0xFF)) (i32.const 16))
        (i32.and (local.get $px) (i32.const 0xFF00)))
        (i32.and (i32.shr_u (local.get $px) (i32.const 16)) (i32.const 0xFF)))))))
    (return (i32.or (i32.const 0xFF000000) (i32.or (i32.or
      (i32.shl (local.get $idx) (i32.const 16))
      (i32.shl (local.get $idx) (i32.const 8)))
      (local.get $idx)))))

  ;; Decode one texel of any surface into 0xAARRGGBB. $entry is only needed for
  ;; the 8bpp case, where the byte is a palette index and the palette hangs off
  ;; the surface rather than the display.
  (func $d3dim_surf_texel_rgb
    (param $entry i32) (param $dib_wa i32) (param $bpp i32) (param $pitch i32)
    (param $x i32) (param $y i32) (result i32)
    (local $ptr i32) (local $px i32) (local $idx i32)
    (local.set $ptr (i32.add (local.get $dib_wa) (i32.mul (local.get $y) (local.get $pitch))))
    (if (i32.eq (local.get $bpp) (i32.const 8)) (then
      (local.set $idx (i32.load8_u (i32.add (local.get $ptr) (local.get $x))))
      (return (call $d3dim_surface_index_rgb (local.get $entry) (local.get $idx)))))
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (local.set $px (i32.load16_u (i32.add (local.get $ptr) (i32.shl (local.get $x) (i32.const 1)))))
      (return (call $d3dim_decode_surface_pixel (local.get $entry) (local.get $px) (local.get $bpp)))))
    (if (i32.eq (local.get $bpp) (i32.const 24)) (then
      (local.set $ptr (i32.add (local.get $ptr) (i32.mul (local.get $x) (i32.const 3))))
      (return (i32.or (i32.const 0xFF000000) (i32.or (i32.or
        (i32.shl (i32.load8_u (i32.add (local.get $ptr) (i32.const 2))) (i32.const 16))
        (i32.shl (i32.load8_u (i32.add (local.get $ptr) (i32.const 1))) (i32.const 8)))
        (i32.load8_u (local.get $ptr)))))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (return (call $d3dim_decode_surface_pixel (local.get $entry)
        (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $x) (i32.const 2))))
        (local.get $bpp)))))
    (i32.const 0))

  ;; Store 0xAARRGGBB into a 16/24/32bpp surface. 8bpp destinations are not
  ;; handled here — writing one needs a nearest-entry search against that
  ;; surface's palette, and no caller has needed it yet.
  (func $d3dim_surf_put_texel
    (param $entry i32) (param $dib_wa i32) (param $bpp i32) (param $pitch i32)
    (param $x i32) (param $y i32) (param $rgb i32)
    (local $ptr i32)
    (local.set $ptr (i32.add (local.get $dib_wa) (i32.mul (local.get $y) (local.get $pitch))))
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (i32.store16 (i32.add (local.get $ptr) (i32.shl (local.get $x) (i32.const 1)))
        (call $d3dim_encode_surface_pixel (local.get $entry) (local.get $rgb) (local.get $bpp)))
      (return)))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (i32.store (i32.add (local.get $ptr) (i32.shl (local.get $x) (i32.const 2)))
        (call $d3dim_encode_surface_pixel (local.get $entry) (local.get $rgb) (local.get $bpp)))
      (return)))
    (if (i32.eq (local.get $bpp) (i32.const 24)) (then
      (local.set $ptr (i32.add (local.get $ptr) (i32.mul (local.get $x) (i32.const 3))))
      (i32.store8 (local.get $ptr) (i32.and (local.get $rgb) (i32.const 0xFF)))
      (i32.store8 (i32.add (local.get $ptr) (i32.const 1))
        (i32.and (i32.shr_u (local.get $rgb) (i32.const 8)) (i32.const 0xFF)))
      (i32.store8 (i32.add (local.get $ptr) (i32.const 2))
        (i32.and (i32.shr_u (local.get $rgb) (i32.const 16)) (i32.const 0xFF)))
      (return))))

  ;; kind=23 TexLoad: which Load populated a destination and which one declined,
  ;; and for the declines, on what test. Every early return below is silent --
  ;; Texture::Load has no return value we report and the guest goes on drawing
  ;; with whatever the destination already held -- so a texture that never gets
  ;; its pixels is indistinguishable on screen from one that was never bound.
  ;; slot=dst slot, a=src slot, b=reason | dbpp<<8 | sbpp<<16, c=copy w|h<<16.
  (func $d3dim_texload_trace
      (param $dst i32) (param $src i32) (param $reason i32)
      (param $dbpp i32) (param $sbpp i32) (param $cw i32) (param $ch i32)
    (call $host_dx_trace (i32.const 23)
      (select (call $dx_slot_of (local.get $dst)) (i32.const -1)
              (i32.ne (local.get $dst) (i32.const 0)))
      (select (call $dx_slot_of (local.get $src)) (i32.const -1)
              (i32.ne (local.get $src) (i32.const 0)))
      (i32.or (local.get $reason)
        (i32.or (i32.shl (i32.and (local.get $dbpp) (i32.const 0xFF)) (i32.const 8))
                (i32.shl (i32.and (local.get $sbpp) (i32.const 0xFF)) (i32.const 16))))
      (i32.or (i32.and (local.get $cw) (i32.const 0xFFFF))
              (i32.shl (local.get $ch) (i32.const 16)))))

  (func $d3dim_texture_load (param $dst_this i32) (param $src_this i32)
    (local $dst i32) (local $src i32)
    (local $dw i32) (local $dh i32) (local $dbpp i32) (local $dpitch i32) (local $ddib i32)
    (local $sw i32) (local $sh i32) (local $sbpp i32) (local $spitch i32) (local $sdib i32)
    (local $copy_w i32) (local $copy_h i32) (local $row_bytes i32) (local $row i32) (local $col i32) (local $bytespp i32)
    (local $dfmt i32) (local $sfmt i32) (local $key i32)
    (if (i32.or (i32.eqz (local.get $dst_this)) (i32.eqz (local.get $src_this))) (then
      (call $d3dim_texload_trace (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (return)))
    (local.set $dst (call $dx_from_this (local.get $dst_this)))
    (local.set $src (call $dx_from_this (local.get $src_this)))
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 2)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (return)))
    (if (i32.or
          (i32.ne (i32.load (local.get $dst)) (i32.const 2))
          (i32.ne (i32.load (local.get $src)) (i32.const 2)))
      (then
        (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 3)
          (i32.load (local.get $dst)) (i32.load (local.get $src))
          (i32.const 0) (i32.const 0))
        (return)))
    (call $d3dim_surface_fence (local.get $src))
    (call $d3dim_surface_fence (local.get $dst))
    (local.set $dw (i32.and (i32.load (i32.add (local.get $dst) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $dh (i32.shr_u (i32.load (i32.add (local.get $dst) (i32.const 12))) (i32.const 16)))
    (local.set $dbpp (i32.and (i32.load (i32.add (local.get $dst) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $dpitch (i32.shr_u (i32.load (i32.add (local.get $dst) (i32.const 16))) (i32.const 16)))
    (local.set $ddib (i32.load (i32.add (local.get $dst) (i32.const 20))))
    (local.set $sw (i32.and (i32.load (i32.add (local.get $src) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $src) (i32.const 12))) (i32.const 16)))
    (local.set $sbpp (i32.and (i32.load (i32.add (local.get $src) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $spitch (i32.shr_u (i32.load (i32.add (local.get $src) (i32.const 16))) (i32.const 16)))
    (local.set $sdib (i32.load (i32.add (local.get $src) (i32.const 20))))
    (local.set $dfmt (call $dx_surf_fmt_get (local.get $dst)))
    (local.set $sfmt (call $dx_surf_fmt_get (local.get $src)))
    ;; Texture::Load copies the source surface's source-blit color key along
    ;; with its pixels. MCM loads a keyed system-memory HUD bitmap into a
    ;; separate video-memory texture and then binds only the destination; if
    ;; the metadata stays behind, the rasterizer paints its 0xf81f backdrop.
    ;; Convert the packed key when the two surface formats differ, just as the
    ;; pixel loop below converts the image itself.
    (if (i32.and (i32.load offset=28 (local.get $src)) (i32.const 0x100)) (then
      (local.set $key (i32.load offset=24 (local.get $src)))
      (if (i32.or (i32.ne (local.get $dbpp) (local.get $sbpp))
                  (i32.ne (local.get $dfmt) (local.get $sfmt))) (then
        (if (i32.or (i32.eq (local.get $dbpp) (i32.const 16))
                    (i32.eq (local.get $dbpp) (i32.const 32))) (then
          (local.set $key (call $d3dim_encode_surface_pixel
            (local.get $dst)
            (if (result i32) (i32.eq (local.get $sbpp) (i32.const 8))
              (then (call $d3dim_surface_index_rgb (local.get $src) (local.get $key)))
              (else (call $d3dim_decode_surface_pixel
                (local.get $src) (local.get $key) (local.get $sbpp))))
            (local.get $dbpp)))))))
      (i32.store offset=24 (local.get $dst) (local.get $key))
      (i32.store offset=28 (local.get $dst)
        (i32.or (i32.load offset=28 (local.get $dst)) (i32.const 0x100)))))
    (if (i32.or (i32.eqz (local.get $ddib)) (i32.eqz (local.get $sdib))) (then
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 4)
        (local.get $dbpp) (local.get $sbpp)
        (i32.ne (local.get $ddib) (i32.const 0))
        (i32.ne (local.get $sdib) (i32.const 0)))
      (return)))
    (if (i32.lt_u (local.get $dbpp) (i32.const 8)) (then
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 5)
        (local.get $dbpp) (local.get $sbpp) (i32.const 0) (i32.const 0))
      (return)))
    ;; Format conversion is the whole point of Texture::Load: D3DRM builds the
    ;; system-memory texture in the file's format (8bpp palettized for a GIF)
    ;; and the video-memory destination in the DEVICE's format (RGB565 here),
    ;; then Loads one into the other. Refusing the mismatch left every Organic
    ;; Art screensaver's destination texture uniform, so every textured triangle
    ;; sampled one constant texel and the leaves came out flat blue and black
    ;; with correct geometry. An 8bpp destination still declines — that needs a
    ;; nearest-entry search against the destination palette.
    (if (i32.or (i32.ne (local.get $dbpp) (local.get $sbpp))
                (i32.ne (local.get $dfmt) (local.get $sfmt))) (then
      (if (i32.eq (local.get $dbpp) (i32.const 8)) (then
        (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 6)
          (local.get $dbpp) (local.get $sbpp)
          (local.get $dfmt) (local.get $sfmt))
        (return)))
      (local.set $copy_w (local.get $dw))
      (if (i32.lt_u (local.get $sw) (local.get $copy_w)) (then (local.set $copy_w (local.get $sw))))
      (local.set $copy_h (local.get $dh))
      (if (i32.lt_u (local.get $sh) (local.get $copy_h)) (then (local.set $copy_h (local.get $sh))))
      (local.set $row (i32.const 0))
      (block $cdone (loop $clp
        (br_if $cdone (i32.ge_u (local.get $row) (local.get $copy_h)))
        (local.set $col (i32.const 0))
        (block $rdone (loop $rlp
          (br_if $rdone (i32.ge_u (local.get $col) (local.get $copy_w)))
          (call $d3dim_surf_put_texel
            (local.get $dst) (local.get $ddib) (local.get $dbpp) (local.get $dpitch)
            (local.get $col) (local.get $row)
            (call $d3dim_surf_texel_rgb
              (local.get $src) (local.get $sdib) (local.get $sbpp) (local.get $spitch)
              (local.get $col) (local.get $row)))
          (local.set $col (i32.add (local.get $col) (i32.const 1)))
          (br $rlp)))
        (local.set $row (i32.add (local.get $row) (i32.const 1)))
        (br $clp)))
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 7)
        (local.get $dbpp) (local.get $sbpp) (local.get $copy_w) (local.get $copy_h))
      (return)))
    (local.set $bytespp (i32.shr_u (local.get $dbpp) (i32.const 3)))
    (if (i32.eqz (local.get $bytespp)) (then
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 9)
        (local.get $dbpp) (local.get $sbpp) (i32.const 0) (i32.const 0))
      (return)))
    (local.set $copy_w (local.get $dw))
    (if (i32.lt_u (local.get $sw) (local.get $copy_w)) (then (local.set $copy_w (local.get $sw))))
    (local.set $copy_h (local.get $dh))
    (if (i32.lt_u (local.get $sh) (local.get $copy_h)) (then (local.set $copy_h (local.get $sh))))
    (if (i32.or (i32.eqz (local.get $copy_w)) (i32.eqz (local.get $copy_h))) (then
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 10)
        (local.get $dbpp) (local.get $sbpp) (local.get $copy_w) (local.get $copy_h))
      (return)))
    (local.set $row_bytes (i32.mul (local.get $copy_w) (local.get $bytespp)))
    (if (i32.gt_u (local.get $row_bytes) (local.get $dpitch)) (then (local.set $row_bytes (local.get $dpitch))))
    (if (i32.gt_u (local.get $row_bytes) (local.get $spitch)) (then (local.set $row_bytes (local.get $spitch))))
    (if (i32.eqz (local.get $row_bytes)) (then
      (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 11)
        (local.get $dbpp) (local.get $sbpp) (local.get $copy_w) (local.get $copy_h))
      (return)))
    (local.set $row (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $row) (local.get $copy_h)))
      (call $memcpy
        (i32.add (local.get $ddib) (i32.mul (local.get $row) (local.get $dpitch)))
        (i32.add (local.get $sdib) (i32.mul (local.get $row) (local.get $spitch)))
        (local.get $row_bytes))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $lp)))
    (call $d3dim_texload_trace (local.get $dst) (local.get $src) (i32.const 8)
      (local.get $dbpp) (local.get $sbpp) (local.get $copy_w) (local.get $copy_h)))

  (func $d3dim_texture_entry_from_slot (param $slot i32) (result i32)
    (local $entry i32) (local $redir i32) (local $src i32)
    (if (i32.or (i32.eqz (local.get $slot)) (i32.ge_u (local.get $slot) (global.get $DX_MAX)))
      (then (return (i32.const 0))))
    (local.set $entry (i32.add (global.get $DX_OBJECTS)
      (i32.mul (local.get $slot) (global.get $DX_ENTRY_SIZE))))
    (if (i32.eqz (load.field DxObject type (local.get $entry))) (then (return (i32.const 0))))
    ;; Older builds used DDSurface+12 as a source-surface slot for Texture::Load.
    ;; Accept that shape defensively, but prefer the destination surface when it
    ;; has a real DIB and dimensions.
    (local.set $redir (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (if (i32.and (i32.ne (local.get $redir) (local.get $slot))
                 (i32.lt_u (local.get $redir) (global.get $DX_MAX)))
      (then
        (local.set $src (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $redir) (global.get $DX_ENTRY_SIZE))))
        (if (i32.and
              (i32.eq (i32.load (local.get $src)) (i32.const 2))
              (i32.and
                (i32.ne (i32.load (i32.add (local.get $src) (i32.const 20))) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $src) (i32.const 12))) (i32.const 0))))
          (then (return (local.get $src))))))
    (if (i32.and
          (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2))
          (i32.and
            (i32.ne (load.field DxObject misc1 (local.get $entry)) (i32.const 0))
            (i32.ne (i32.load (i32.add (local.get $entry) (i32.const 12))) (i32.const 0))))
      (then (return (local.get $entry))))
    (i32.const 0))

  (func $d3dim_bound_texture_entry (param $this i32) (result i32)
    (local $state i32) (local $slot i32) (local $entry i32) (local $key i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    ;; COLOROP=DISABLE terminates the cascade, including alpha processing.
    ;; Do not resolve/sample a bound texture or apply its color key.
    (if (i32.eq (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 1)) (i32.const 1))
      (then (return (i32.const 0))))
    (local.set $slot (call $gl32 (i32.add (local.get $state) (global.get $D3DIM_OFF_TEX_STAGE))))
    (local.set $entry (call $d3dim_texture_entry_from_slot (local.get $slot)))
    ;; kind=16 TexBind: slot, resolved entry, packed w|h<<16, packed bpp|pitch<<16.
    ;; A slot that never resolves is the difference between "the app never bound
    ;; a texture" and "it did and we dropped it" -- the two look identical on
    ;; screen (flat vertex colour) and cannot be told apart from the API trace.
    (local.set $key (i32.or (i32.shl (local.get $slot) (i32.const 1))
                            (i32.ne (local.get $entry) (i32.const 0))))
    (if (i32.ne (local.get $key) (global.get $d3dim_dbg_tex_last))
      (then
        (global.set $d3dim_dbg_tex_last (local.get $key))
        (call $host_dx_trace (i32.const 16) (local.get $slot) (local.get $entry)
          (select (i32.load (i32.add (local.get $entry) (i32.const 12))) (i32.const 0)
                  (i32.ne (local.get $entry) (i32.const 0)))
          (select (i32.load (i32.add (local.get $entry) (i32.const 16))) (i32.const 0)
                  (i32.ne (local.get $entry) (i32.const 0))))))
    (local.get $entry))

  ;; SetTexture(stage, lpTex). Phase 0: store DX slot of lpTex on stage 0
  ;; only (multi-stage TSS stored separately by Phase 3).
  (func $d3dim_set_texture (param $this i32) (param $stage i32) (param $lpTex i32)
    (local $state i32) (local $slot i32) (local $old i32) (local $entry i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (if (i32.ne (local.get $stage) (i32.const 0)) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (call $d3dim_sb_record (local.get $this) (i32.const 8) (i32.const 0) (local.get $lpTex) (i32.const 0)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (local.get $state) (then
      (if (local.get $lpTex) (then
        (local.set $entry (call $dx_from_this (local.get $lpTex)))
        (local.set $slot (call $dx_slot_of (local.get $entry)))
        (drop (call $dx_com_addref (call $d3dim_primary_guest (local.get $entry))))))
      ;; +3944 is an ownership reference, distinct from the binding DX slot.
      ;; A legacy TEXTUREHANDLE assignment never owned this new reference.
      (local.set $old (call $gl32 (i32.add (local.get $state) (i32.const 3944))))
      (call $gs32 (i32.add (local.get $state) (i32.const 3944))
        (select (call $d3dim_primary_guest (local.get $entry)) (i32.const 0) (i32.ne (local.get $slot) (i32.const 0))))
      (call $gs32 (i32.add (local.get $state) (global.get $D3DIM_OFF_TEX_STAGE)) (local.get $slot))
      (if (local.get $old) (then (drop (call $dx_surface_release (local.get $old)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_texture (param $this i32) (param $stage i32) (param $ppTex i32)
    (local $state i32) (local $slot i32) (local $tex_entry i32) (local $tex_guest i32)
    (if (i32.eqz (local.get $ppTex)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (if (i32.ne (local.get $stage) (i32.const 0)) (then
      (call $gs32 (local.get $ppTex) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then
      (call $gs32 (local.get $ppTex) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return)))
    (local.set $slot (call $gl32 (i32.add (local.get $state) (global.get $D3DIM_OFF_TEX_STAGE))))
    (if (i32.eqz (local.get $slot)) (then
      (call $gs32 (local.get $ppTex) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return)))
    (local.set $tex_entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))
    (if (i32.eqz (i32.load (local.get $tex_entry))) (then
      (call $gs32 (local.get $ppTex) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return)))
    (i32.store (i32.add (local.get $tex_entry) (i32.const 4))
      (i32.add (i32.load (i32.add (local.get $tex_entry) (i32.const 4))) (i32.const 1)))
    (local.set $tex_guest (i32.add
      (i32.sub (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $slot) (i32.const 8)))
               (global.get $GUEST_BASE))
      (global.get $image_base)))
    (call $gs32 (local.get $ppTex) (local.get $tex_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Return the guest address of a texture-stage state slot. The original
  ;; eight states retain their compact per-stage layout. Fixed-function D3D3
  ;; games also depend on coordinate selection, addressing, and filtering;
  ;; those six extended states live in otherwise-unused device-state space.
  (func $d3dim_tss_addr (param $state i32) (param $stage i32) (param $type i32) (result i32)
    (local $ext i32) (local $block i32)
    (if (i32.or (i32.eqz (local.get $state)) (i32.ge_u (local.get $stage) (i32.const 8)))
      (then (return (i32.const 0))))
    ;; TEXTURETRANSFORMFLAGS (24) lives beside the stage's texture matrix.
    (if (i32.eq (local.get $type) (i32.const 24)) (then
      (local.set $block (call $d3dim_tex_block (local.get $state)))
      (if (i32.eqz (local.get $block)) (then (return (i32.const 0))))
      (return (i32.add (local.get $block)
        (i32.add (i32.const 512) (i32.shl (local.get $stage) (i32.const 2)))))))
    (if (i32.lt_u (local.get $type) (i32.const 8)) (then
      (return (i32.add (local.get $state)
        (i32.add (global.get $D3DIM_OFF_TSS_STATE)
          (i32.add (i32.mul (local.get $stage) (i32.const 32))
                   (i32.shl (local.get $type) (i32.const 2))))))))
    (if (i32.eq (local.get $type) (i32.const 11)) (then (local.set $ext (i32.const 0)))
      (else (if (i32.eq (local.get $type) (i32.const 13)) (then (local.set $ext (i32.const 1)))
      (else (if (i32.eq (local.get $type) (i32.const 14)) (then (local.set $ext (i32.const 2)))
      (else (if (i32.eq (local.get $type) (i32.const 16)) (then (local.set $ext (i32.const 3)))
      (else (if (i32.eq (local.get $type) (i32.const 17)) (then (local.set $ext (i32.const 4)))
      (else (if (i32.eq (local.get $type) (i32.const 18)) (then (local.set $ext (i32.const 5)))
      (else (return (i32.const 0))))))))))))))
    (i32.add (local.get $state)
      (i32.add (global.get $D3DIM_OFF_TSS_EXT)
        (i32.shl (i32.add (i32.mul (local.get $stage) (i32.const 6)) (local.get $ext)) (i32.const 2)))))

  ;; Texture transforms. TEXTURE0..7 (D3DTRANSFORMSTATE 16..23) are not one
  ;; of the three device matrices: $d3ddev_matrix_slot sends them to slot 3,
  ;; which is the composite world*view*projection scratch, so a
  ;; SetTransform(TEXTURE0) silently replaced the composite until the next
  ;; draw rebuilt it. They live in a per-device block allocated on first use:
  ;; eight matrices (identity until set) at +0, then the eight stages'
  ;; TEXTURETRANSFORMFLAGS at +512. The block's guest address is the state's
  ;; dword at +4024, free between the clip status and the projection temps.
  (func $d3dim_tex_block (param $state i32) (result i32)
    (local $block i32) (local $wa i32) (local $i i32)
    (local.set $block (call $gl32 (i32.add (local.get $state) (i32.const 4024))))
    (if (local.get $block) (then (return (local.get $block))))
    (local.set $block (call $heap_alloc (i32.const 544)))
    (if (i32.eqz (local.get $block)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $block)))
    (call $zero_memory (local.get $wa) (i32.const 544))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 8)))
      (call $test_mat4_identity (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 6))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (call $gs32 (i32.add (local.get $state) (i32.const 4024)) (local.get $block))
    (local.get $block))

  ;; WASM address of the texture matrix for D3DTRANSFORMSTATE $xtype, or 0
  ;; when $xtype is not TEXTURE0..7 (or the block cannot be allocated).
  (func $d3dim_tex_matrix (param $state i32) (param $xtype i32) (result i32)
    (local $block i32)
    (if (i32.gt_u (i32.sub (local.get $xtype) (i32.const 16)) (i32.const 7))
      (then (return (i32.const 0))))
    (local.set $block (call $d3dim_tex_block (local.get $state)))
    (if (i32.eqz (local.get $block)) (then (return (i32.const 0))))
    (i32.add (call $g2w (local.get $block))
      (i32.shl (i32.sub (local.get $xtype) (i32.const 16)) (i32.const 6))))

  (func $d3dim_tss_load (param $state i32) (param $stage i32) (param $type i32) (result i32)
    (local $addr i32) (local $legacy i32) (local $tex i32) (local $fmt i32)
    (if (i32.and (i32.ne (local.get $state) (i32.const 0)) (i32.eqz (local.get $stage))) (then
      (local.set $legacy (call $gl32 (i32.add (local.get $state) (i32.const 3936))))
      (if (local.get $legacy) (then
        ;; DX6.1 SDK D3DTEXTUREBLEND: DECAL=1 and COPY=7 select texture
        ;; RGBA; DECALALPHA=3 interpolates RGB by texture alpha and keeps
        ;; diffuse alpha. ADD=8 saturates texture + diffuse RGB and keeps
        ;; diffuse alpha. Lower only effective state, leaving raw TSS intact.
        (if (i32.eq (local.get $type) (i32.const 1)) (then
          (if (i32.eq (local.get $legacy) (i32.const 8)) (then (return (i32.const 7))))
          (if (i32.eq (local.get $legacy) (i32.const 3)) (then (return (i32.const 13))))
          (if (i32.or (i32.eq (local.get $legacy) (i32.const 1))
                      (i32.eq (local.get $legacy) (i32.const 7))) (then (return (i32.const 2))))
          (return (i32.const 4))))
        (if (i32.or (i32.eq (local.get $type) (i32.const 2))
                    (i32.eq (local.get $type) (i32.const 5))) (then (return (i32.const 2))))
        (if (i32.or (i32.eq (local.get $type) (i32.const 3))
                    (i32.eq (local.get $type) (i32.const 6))) (then (return (i32.const 1))))
        (if (i32.eq (local.get $type) (i32.const 4)) (then
          (if (i32.or (i32.eq (local.get $legacy) (i32.const 8))
                      (i32.eq (local.get $legacy) (i32.const 3))) (then (return (i32.const 3))))
          (if (i32.or (i32.eq (local.get $legacy) (i32.const 1))
                      (i32.eq (local.get $legacy) (i32.const 7))) (then (return (i32.const 2))))
          ;; MODULATEALPHA multiplies texture and diffuse alpha. MODULATE
          ;; selects texture alpha only when the original format has alpha;
          ;; decoding RGB565 into RGBA must not turn it into an alpha texture.
          (if (i32.eq (local.get $legacy) (i32.const 4)) (then (return (i32.const 4))))
          (local.set $tex (call $d3dim_texture_entry_from_slot
            (call $gl32 (i32.add (local.get $state) (global.get $D3DIM_OFF_TEX_STAGE)))))
          (if (i32.eqz (local.get $tex)) (then (return (i32.const 2))))
          (local.set $fmt (call $dx_surf_fmt_get (local.get $tex)))
          (return (if (result i32)
            (i32.or (i32.or (i32.eq (local.get $fmt) (i32.const 1))
                            (i32.eq (local.get $fmt) (i32.const 2)))
                    (i32.eq (local.get $fmt) (i32.const 6)))
            (then (i32.const 3)) (else (i32.const 2))))))))))
    (local.set $addr (call $d3dim_tss_addr (local.get $state) (local.get $stage) (local.get $type)))
    (if (local.get $addr) (then (return (call $gl32 (local.get $addr)))))
    (i32.const 0))

  ;; Cache the selected viewport, including its homogeneous clip transform.
  ;; Render Worker commands copy this state; they must not read a live COM
  ;; viewport descriptor after the guest has changed or released it.
  (func $d3dim_viewport_apply_entry (param $state i32) (param $entry i32)
    (local $sw i32) (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (local $data i32) (local $cx f32) (local $cy f32)
    (local $cw f32) (local $ch f32) (local $minz f32) (local $dz f32)
    (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $entry)))
      (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $x (i32.load (i32.add (local.get $entry) (i32.const 12))))
    (local.set $y (i32.load (i32.add (local.get $entry) (i32.const 16))))
    (local.set $w (load.field DxObject misc1 (local.get $entry)))
    (local.set $h (load.field DxObject misc2 (local.get $entry)))
    (local.set $data (i32.load (call $d3dim_viewport_data_addr (local.get $entry))))
    (if (i32.eqz (local.get $data)) (then (return)))
    ;; Emulator-owned 44-byte heap record is contiguous, not a caller span.
    (local.set $data (call $g2w (local.get $data)))
    (local.set $cx (f32.load offset=20 (local.get $data)))
    (local.set $cy (f32.load offset=24 (local.get $data)))
    (local.set $cw (f32.load offset=28 (local.get $data)))
    (local.set $ch (f32.load offset=32 (local.get $data)))
    (local.set $minz (f32.load offset=36 (local.get $data)))
    (local.set $dz (f32.sub (f32.load offset=40 (local.get $data)) (local.get $minz)))
    ;; MS d3dim 4.06.02.0436 transform helper 566afa8a returns before stores
    ;; on zero dimensions/depth span. Setter HRESULT policy is separate.
    (if (i32.or (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h)))
          (i32.or (f32.eq (local.get $cw) (f32.const 0))
            (i32.or (f32.eq (local.get $ch) (f32.const 0))
              (f32.eq (local.get $dz) (f32.const 0))))) (then (return)))
    (f32.store offset=3904 (local.get $sw) (f32.div (f32.const 2) (local.get $cw)))
    (f32.store offset=3908 (local.get $sw)
      (f32.sub (f32.mul (f32.neg (local.get $cx)) (f32.load offset=3904 (local.get $sw))) (f32.const 1)))
    (f32.store offset=3912 (local.get $sw) (f32.div (f32.const 2) (local.get $ch)))
    (f32.store offset=3916 (local.get $sw)
      (f32.sub (f32.const 1) (f32.mul (local.get $cy) (f32.load offset=3912 (local.get $sw)))))
    (f32.store offset=3920 (local.get $sw) (f32.div (f32.const 1) (local.get $dz)))
    (f32.store offset=3924 (local.get $sw)
      (f32.mul (f32.neg (local.get $minz)) (f32.load offset=3920 (local.get $sw))))
    (i32.store offset=3928 (local.get $sw)
      (i32.or (i32.or (f32.ne (local.get $cx) (f32.const -1)) (f32.ne (local.get $cy) (f32.const 1)))
        (i32.or (i32.or (f32.ne (local.get $cw) (f32.const 2)) (f32.ne (local.get $ch) (f32.const 2)))
          (i32.or (f32.ne (local.get $minz) (f32.const 0)) (f32.ne (local.get $dz) (f32.const 1))))))
    (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT)) (local.get $x))
    (i32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4))) (local.get $y))
    (i32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8))) (local.get $w))
    (i32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12))) (local.get $h))
    (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))
      (f32.div (f32.convert_i32_s (local.get $w)) (f32.const 2.0)))
    (f32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))
      (f32.div (f32.convert_i32_s (local.get $h)) (f32.const 2.0)))
    (f32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 8))) (f32.const 0.0))
    (f32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 12))) (f32.const 1.0))
    (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))
      (f32.add (f32.convert_i32_s (local.get $x))
               (f32.div (f32.convert_i32_s (local.get $w)) (f32.const 2.0))))
    (f32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4)))
      (f32.add (f32.convert_i32_s (local.get $y))
               (f32.div (f32.convert_i32_s (local.get $h)) (f32.const 2.0)))))

  (func $d3dim_texcoord_index (param $this i32) (result i32)
    (i32.and
      (call $d3dim_tss_load (call $d3ddev_state (local.get $this)) (i32.const 0) (i32.const 11))
      (i32.const 0xffff)))

  ;; SetTextureStageState(stage, type, value).
  (func $d3dim_set_tss (param $this i32) (param $stage i32) (param $type i32) (param $val i32)
    (local $state i32) (local $addr i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (if (i32.and (i32.lt_u (local.get $stage) (i32.const 8)) (i32.lt_u (local.get $type) (i32.const 32))) (then (if (call $d3dim_sb_record (local.get $this) (i32.const 1) (i32.or (i32.shl (local.get $stage) (i32.const 5)) (local.get $type)) (local.get $val) (i32.const 0)) (then (if (i32.eqz (local.get $stage)) (then
        (if (i32.and (i32.ge_u (local.get $type) (i32.const 1)) (i32.le_u (local.get $type) (i32.const 6)))
          (then (drop (call $d3dim_sb_record (local.get $this) (i32.const 9) (i32.const 0) (i32.const 0) (i32.const 0)))))
        (if (i32.eq (local.get $type) (i32.const 18))
          (then (drop (call $d3dim_sb_record (local.get $this) (i32.const 9) (i32.const 1) (i32.const 1) (i32.const 0))))))) (return)))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $addr (call $d3dim_tss_addr (local.get $state) (local.get $stage) (local.get $type)))
    (if (local.get $addr) (then
      (call $gs32 (local.get $addr) (local.get $val))
      (if (i32.and (i32.eqz (local.get $stage)) (i32.eq (local.get $type) (i32.const 18)))
        (then (call $gs32 (i32.add (local.get $state) (i32.const 3940)) (i32.const 1))))
      (if (i32.and (i32.eqz (local.get $stage))
            (i32.and (i32.ge_u (local.get $type) (i32.const 1))
                     (i32.le_u (local.get $type) (i32.const 6)))) (then
        (call $gs32 (i32.add (local.get $state) (i32.const 3936)) (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_tss (param $this i32) (param $stage i32) (param $type i32) (param $out i32)
    (local $state i32) (local $val i32) (local $addr i32)
    (if (i32.eqz (local.get $out)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $addr (call $d3dim_tss_addr (local.get $state) (local.get $stage) (local.get $type)))
    (if (local.get $addr) (then (local.set $val (call $gl32 (local.get $addr)))))
    (call $gs32 (local.get $out) (local.get $val))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; ── Current viewport binding ──────────────────────────────────
  (func $d3dim_set_current_viewport (param $this i32) (param $lpVp i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    ;; Selection is separate from AddViewport ownership.  The exact core
    ;; validates that this device already owns the viewport and maintains the
    ;; independent current-selection reference.
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_set_current_viewport
        (local.get $this) (local.get $lpVp)))
    ;;
    ;; Keep this wrapper because the generated Device2 and handwritten Device3
    ;; handlers both call it and own their own stdcall stack cleanup.
    ;;
    ;;
    ;;
    )

  (func $d3dim_get_current_viewport (param $this i32) (param $ppVp i32) (param $vtbl i32)
    ;; Clear output before failure, report no-current distinctly, validate the
    ;; stored slot still belongs to this device, and AddRef on success.
    (i32.store offset=0 (global.get $reg_base) (call $d3dim_device_get_current_viewport
        (local.get $this) (local.get $ppVp) (local.get $vtbl)))
    ;;
    ;; As above, the interface wrappers retain ownership of stack cleanup.
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    ;;
    )

  ;; ── Render-target binding ────────────────────────────────────
  ;; The device entry stores its current DDSurface slot at +8. CreateDevice
  ;; seeds it; SetRenderTarget updates it for apps that switch back buffers.
  (func $d3dim_set_render_target (param $this i32) (param $rt_surf i32)
    (local $entry i32) (local $rt_entry i32) (local $rt_slot i32)
    (if (call $d3dim_immediate_forbid (local.get $this)) (then (return)))
    (call $d3dim_worker_fence)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $rt_surf)) (then
      (store.field DxObject misc0 (local.get $entry) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (return)))
    (local.set $rt_entry (call $dx_from_this (local.get $rt_surf)))
    (if (i32.eqz (i32.load (local.get $rt_entry))) (then
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    (local.set $rt_slot (call $dx_slot_of (local.get $rt_entry)))
    (store.field DxObject misc0 (local.get $entry) (local.get $rt_slot))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_get_render_target (param $this i32) (param $ppRt i32)
    (local $entry i32) (local $slot i32) (local $rt_entry i32) (local $rt_guest i32)
    (local $device_vtbl i32) (local $surface_vtbl i32)
    (if (i32.eqz (local.get $ppRt))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $slot (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $slot)) (then
      (call $gs32 (local.get $ppRt) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    (local.set $rt_entry (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $slot) (i32.const 32))))
    (if (i32.eqz (i32.load (local.get $rt_entry))) (then
      (call $gs32 (local.get $ppRt) (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
      (return)))
    ;; The output ABI follows the calling device interface: Device2 returns
    ;; Surface1, Device3 Surface4, Device7 Surface7. A canonical Surface2
    ;; wrapper rejects a Device7 caller's valid DDSURFACEDESC2 query, leaving
    ;; zero dimensions for its viewport. QI aliases select the output ABI
    ;; without changing the device or render-target COM identity.
    (local.set $device_vtbl (call $gl32 (local.get $this)))
    (local.set $surface_vtbl (global.get $DX_VTBL_DDSURF))
    (if (i32.eq (local.get $device_vtbl) (global.get $DX_VTBL_D3DDEV3))
      (then (local.set $surface_vtbl (global.get $DX_VTBL_DDSURF4))))
    (if (i32.eq (local.get $device_vtbl) (global.get $DX_VTBL_D3DDEV7))
      (then (local.set $surface_vtbl (global.get $DX_VTBL_DDSURF7))))
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $rt_guest (call $dx_get_wrapper_for_vtbl_locked (local.get $slot) (local.get $surface_vtbl)))
    (if (i32.eqz (local.get $rt_guest)) (then
      (call $lock_release (global.get $LOCK_DX))
      (call $gs32 (local.get $ppRt) (i32.const 0))
      (i32.store (global.get $reg_base) (i32.const 0x8007000e))
      (return)))
    (i32.store (i32.add (local.get $rt_entry) (i32.const 4))
      (i32.add (i32.load (i32.add (local.get $rt_entry) (i32.const 4))) (i32.const 1)))
    (drop (call $dx_aux_ref_add (local.get $rt_guest) (i32.const 1)))
    (call $lock_release (global.get $LOCK_DX))
    (call $gs32 (local.get $ppRt) (local.get $rt_guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_viewport_set_background (param $this i32) (param $handle i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (local.get $entry)
      (then (store.field DxObject flags (local.get $entry) (local.get $handle))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_viewport_get_background (param $this i32) (param $lpHandle i32) (param $lpValid i32)
    (local $entry i32) (local $handle i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (local.get $entry)
      (then (local.set $handle (load.field DxObject flags (local.get $entry)))))
    (if (local.get $lpHandle) (then (call $gs32 (local.get $lpHandle) (local.get $handle))))
    (if (local.get $lpValid) (then (call $gs32 (local.get $lpValid) (i32.ne (local.get $handle) (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_viewport_background_color (param $this i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (call $d3dim_material_color_from_handle
      (load.field DxObject flags (local.get $entry))))

  ;; The background material's texture, or 0 when the background is flat colour.
  (func $d3dim_viewport_background_texture (param $this i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (call $d3dim_material_texture_entry
      (load.field DxObject flags (local.get $entry))))

  ;; ── Viewport rect get/set ─────────────────────────────────────
  ;; One canonical D3DVIEWPORT2 guest allocation per COM identity. A zero
  ;; pointer means data has not been set. The DX entry retains its rectangle
  ;; mirror for clear/draw consumers; it is not a second descriptor owner.
  (global $D3DIM_VIEWPORT_DATA i32 (region.addr $D3DIM_VIEWPORT_DATA 0))
  (global $D3DIM_VIEWPORT_DATA_SIZE i32 (region.size $D3DIM_VIEWPORT_DATA))
  (func $d3dim_viewport_data_addr (param $entry i32) (result i32)
    (i32.add (global.get $D3DIM_VIEWPORT_DATA)
      (i32.shl (call $dx_slot_of (local.get $entry)) (i32.const 2))))

  ;; Both legacy D3DVIEWPORT layouts are 44 bytes. Validate the caller's
  ;; initialized header before touching viewport state or getter output.
  ;; Use guest scalars: even the size DWORD may cross sparse backing pages.
  (func $d3dim_viewport_desc_valid (param $desc i32) (result i32)
    (if (i32.eqz (local.get $desc)) (then (return (i32.const 0))))
    (i32.eq (call $gl32 (local.get $desc)) (i32.const 44)))

  ;; SetViewport(lpD3DVIEWPORT) / SetViewport2(lpD3DVIEWPORT2). Persist the
  ;; rectangle and derive the transform viewport used by vertex_project.
  (func $d3dim_viewport_set (param $this i32) (param $lpVp i32)
    (call $d3dim_viewport_set_data (local.get $this) (local.get $lpVp) (i32.const 0)))

  (func $d3dim_viewport_set2 (param $this i32) (param $lpVp i32)
    (call $d3dim_viewport_set_data (local.get $this) (local.get $lpVp) (i32.const 1)))

  ;; DX6 runtime: creation versions 2/3 validate the converted Viewport2
  ;; before publication. Device1 is permissive even through newer aliases;
  ;; Device7/9 policy is separate, not inferred from this runtime's >=2 test.
  (func $d3dim_viewport_range_valid (param $device i32) (param $desc i32)
      (param $cw f32) (param $ch f32) (param $minz f32) (param $maxz f32) (result i32)
    (local $state i32) (local $version i32) (local $rt i32)
    (local $x i32) (local $y i32) (local $width i32) (local $height i32)
    (local.set $state (call $d3ddev_state (local.get $device)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 1))))
    (local.set $version (call $gl32 (i32.add (local.get $state) (i32.const 3932))))
    (if (i32.and (i32.ne (local.get $version) (i32.const 2))
                 (i32.ne (local.get $version) (i32.const 3))) (then (return (i32.const 1))))
    ;; FCOMP/SAHF/JZ rejects unordered as well as equal; negative and reversed
    ;; finite spans are allowed. Do not replace this with positivity tests.
    (if (i32.or (i32.eqz (f32.gt (f32.abs (local.get $cw)) (f32.const 0)))
          (i32.or (i32.eqz (f32.gt (f32.abs (local.get $ch)) (f32.const 0)))
            (i32.eqz (i32.or (f32.lt (local.get $minz) (local.get $maxz))
                            (f32.gt (local.get $minz) (local.get $maxz))))))
      (then (return (i32.const 0))))
    (local.set $rt (load.field DxObject misc0 (call $dx_from_this (local.get $device))))
    (if (i32.or (i32.eqz (local.get $rt)) (i32.ge_u (local.get $rt) (global.get $DX_MAX)))
      (then (return (i32.const 0))))
    (local.set $rt (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $rt) (global.get $DX_ENTRY_SIZE))))
    (local.set $width (load.field DxObject width (local.get $rt)))
    (local.set $height (load.field DxObject height (local.get $rt)))
    (local.set $x (call $gl32 (i32.add (local.get $desc) (i32.const 4))))
    (local.set $y (call $gl32 (i32.add (local.get $desc) (i32.const 8))))
    ;; Preserve the original unsigned comparisons and wrapping DWORD sums.
    (i32.and (i32.and (i32.le_u (local.get $x) (local.get $width)) (i32.le_u (local.get $y) (local.get $height)))
      (i32.and
        (i32.le_u (i32.add (local.get $x) (call $gl32 (i32.add (local.get $desc) (i32.const 12)))) (local.get $width))
        (i32.le_u (i32.add (local.get $y) (call $gl32 (i32.add (local.get $desc) (i32.const 16)))) (local.get $height)))))

  (func $d3dim_viewport_set_data (param $this i32) (param $lpVp i32) (param $v2 i32)
    (local $entry i32) (local $dev_this i32) (local $state i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (local $owner i32) (local $data i32) (local $off i32)
    (local $sx f32) (local $sy f32) (local $cw f32) (local $ch f32)
    (local $minz f32) (local $maxz f32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.or (i32.eqz (local.get $this))
          (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 23)))
      (then (i32.store (global.get $reg_base) (i32.const 0x88760082)) (return)))
    (if (i32.eqz (call $d3dim_viewport_desc_valid (local.get $lpVp)))
      (then (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; DDERR_INVALIDPARAMS
    (local.set $dev_this (load.field DxObject misc0 (local.get $entry)))
    (if (i32.eqz (local.get $dev_this))
      (then (i32.store (global.get $reg_base) (i32.const 0x88760306)) (return)))
    (local.set $x (call $gl32 (i32.add (local.get $lpVp) (i32.const 4))))
    (local.set $y (call $gl32 (i32.add (local.get $lpVp) (i32.const 8))))
    (local.set $w (call $gl32 (i32.add (local.get $lpVp) (i32.const 12))))
    (local.set $h (call $gl32 (i32.add (local.get $lpVp) (i32.const 16))))
    ;; Legacy SetViewport converts to Viewport2. MaxX/MaxY and legacy depth
    ;; are not retained by Microsoft's runtime. Either zero scale produces
    ;; two zero clip dimensions. The f32 stores match its temporary record.
    (if (i32.eqz (local.get $v2)) (then
      (local.set $sx (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $lpVp) (i32.const 20)))))
      (local.set $sy (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $lpVp) (i32.const 24)))))
      (if (i32.and (f32.gt (f32.abs (local.get $sx)) (f32.const 0))
                   (f32.gt (f32.abs (local.get $sy)) (f32.const 0))) (then
        (local.set $cw (f32.demote_f64 (f64.div (f64.convert_i32_u (local.get $w)) (f64.promote_f32 (local.get $sx)))))
        (local.set $ch (f32.demote_f64 (f64.div (f64.convert_i32_u (local.get $h)) (f64.promote_f32 (local.get $sy)))))))))
    (local.set $maxz (f32.const 1))
    (if (local.get $v2) (then
      (local.set $cw (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $lpVp) (i32.const 28)))))
      (local.set $ch (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $lpVp) (i32.const 32)))))
      (local.set $minz (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $lpVp) (i32.const 36)))))
      (local.set $maxz (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $lpVp) (i32.const 40)))))))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (i32.eqz (call $d3dim_viewport_range_valid (local.get $dev_this) (local.get $lpVp)
          (local.get $cw) (local.get $ch) (local.get $minz) (local.get $maxz))) (then
      (call $lock_release (global.get $LOCK_DX))
      (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $owner (call $d3dim_viewport_data_addr (local.get $entry)))
    (local.set $data (i32.load (local.get $owner)))
    (if (i32.eqz (local.get $data)) (then
      (local.set $data (call $heap_alloc (i32.const 44)))
      (if (i32.eqz (local.get $data)) (then
        (call $lock_release (global.get $LOCK_DX))
        (i32.store (global.get $reg_base) (i32.const 0x8007000e)) (return)))))
    (loop $copy
      (call $gs32 (i32.add (local.get $data) (local.get $off))
        (call $gl32 (i32.add (local.get $lpVp) (local.get $off))))
      (local.set $off (i32.add (local.get $off) (i32.const 4)))
      (br_if $copy (i32.lt_u (local.get $off) (i32.const 44))))
    (if (i32.eqz (local.get $v2)) (then
      (call $gs32 (i32.add (local.get $data) (i32.const 20)) (i32.reinterpret_f32 (f32.mul (local.get $cw) (f32.const -0.5))))
      (call $gs32 (i32.add (local.get $data) (i32.const 24)) (i32.reinterpret_f32 (f32.mul (local.get $ch) (f32.const 0.5))))
      (call $gs32 (i32.add (local.get $data) (i32.const 28)) (i32.reinterpret_f32 (local.get $cw)))
      (call $gs32 (i32.add (local.get $data) (i32.const 32)) (i32.reinterpret_f32 (local.get $ch)))
      (call $gs32 (i32.add (local.get $data) (i32.const 36)) (i32.const 0))
      (call $gs32 (i32.add (local.get $data) (i32.const 40)) (i32.const 0x3f800000))))
    (i32.store (local.get $owner) (local.get $data))
    (i32.store (i32.add (local.get $entry) (i32.const 12)) (local.get $x))
    (i32.store (i32.add (local.get $entry) (i32.const 16)) (local.get $y))
    (store.field DxObject misc1 (local.get $entry) (local.get $w))
    (store.field DxObject misc2 (local.get $entry) (local.get $h))
    (local.set $dev_this (load.field DxObject misc0 (local.get $entry)))
    (if (local.get $dev_this) (then
      (local.set $state (call $d3ddev_state (local.get $dev_this)))
      (if (i32.and (i32.ne (local.get $state) (i32.const 0))
            (i32.eq (call $gl32
              (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP)))
              (call $dx_slot_of (local.get $entry))))
        (then (call $d3dim_viewport_apply_entry
          (local.get $state) (local.get $entry))))))
    (call $lock_release (global.get $LOCK_DX))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_viewport_get (param $this i32) (param $lpVp i32)
    (call $d3dim_viewport_get_data (local.get $this) (local.get $lpVp) (i32.const 0)))

  (func $d3dim_viewport_get2 (param $this i32) (param $lpVp i32)
    (call $d3dim_viewport_get_data (local.get $this) (local.get $lpVp) (i32.const 1)))

  (func $d3dim_viewport_get_data (param $this i32) (param $lpVp i32) (param $v2 i32)
    (local $entry i32) (local $data i32) (local $off i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.or (i32.eqz (local.get $this))
          (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 23)))
      (then (i32.store (global.get $reg_base) (i32.const 0x88760082)) (return)))
    (if (i32.eqz (call $d3dim_viewport_desc_valid (local.get $lpVp)))
      (then (i32.store (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; DDERR_INVALIDPARAMS
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $data (i32.load (call $d3dim_viewport_data_addr (local.get $entry))))
    (if (i32.eqz (local.get $data)) (then
      (call $lock_release (global.get $LOCK_DX))
      (i32.store (global.get $reg_base) (i32.const 0x88760305)) (return)))
    (loop $copy
      (call $gs32 (i32.add (local.get $lpVp) (local.get $off))
        (call $gl32 (i32.add (local.get $data) (local.get $off))))
      (local.set $off (i32.add (local.get $off) (i32.const 4)))
      (br_if $copy (i32.lt_u (local.get $off) (i32.const 44))))
    (if (i32.eqz (local.get $v2)) (then
      (call $gs32 (i32.add (local.get $lpVp) (i32.const 20))
        (i32.reinterpret_f32 (f32.demote_f64 (f64.div
          (f64.convert_i32_u (call $gl32 (i32.add (local.get $data) (i32.const 12))))
          (f64.promote_f32 (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $data) (i32.const 28)))))))))
      (call $gs32 (i32.add (local.get $lpVp) (i32.const 24))
        (i32.reinterpret_f32 (f32.demote_f64 (f64.div
          (f64.convert_i32_u (call $gl32 (i32.add (local.get $data) (i32.const 16))))
          (f64.promote_f32 (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $data) (i32.const 32)))))))))
      (call $gs32 (i32.add (local.get $lpVp) (i32.const 28))
        (i32.reinterpret_f32 (f32.add
          (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $data) (i32.const 20))))
          (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $data) (i32.const 28)))))))
      (call $gs32 (i32.add (local.get $lpVp) (i32.const 32)) (call $gl32 (i32.add (local.get $data) (i32.const 24))))
      (call $gs32 (i32.add (local.get $lpVp) (i32.const 36)) (i32.const 0))
      (call $gs32 (i32.add (local.get $lpVp) (i32.const 40)) (i32.const 0x3f800000))))
    (call $lock_release (global.get $LOCK_DX))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; DX7 stores viewport directly on the device instead of through an
  ;; IDirect3DViewport COM object. D3DVIEWPORT7 is {x,y,w,h,minZ,maxZ}.
  (func $d3dim_device7_set_viewport (param $this i32) (param $lpVp i32)
    (local $state i32) (local $sw i32) (local $vp_wa i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (if (i32.eqz (local.get $lpVp)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (call $d3dim_sb_record (local.get $this) (i32.const 7) (i32.const 0) (local.get $lpVp) (i32.const 24)) (then (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $sw (call $g2w (local.get $state)))
    ;; D3DVIEWPORT7 does not describe a legacy clip volume.
    (i32.store offset=3928 (local.get $sw) (i32.const 0))
    (local.set $vp_wa (call $g2w (local.get $lpVp)))
    (local.set $x (i32.load (local.get $vp_wa)))
    (local.set $y (i32.load (i32.add (local.get $vp_wa) (i32.const 4))))
    (local.set $w (i32.load (i32.add (local.get $vp_wa) (i32.const 8))))
    (local.set $h (i32.load (i32.add (local.get $vp_wa) (i32.const 12))))
    (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT)) (local.get $x))
    (i32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4))) (local.get $y))
    (i32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8))) (local.get $w))
    (i32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12))) (local.get $h))
    (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))
      (f32.div (f32.convert_i32_s (local.get $w)) (f32.const 2.0)))
    (f32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))
      (f32.div (f32.convert_i32_s (local.get $h)) (f32.const 2.0)))
    (f32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 8)))
      (f32.load (i32.add (local.get $vp_wa) (i32.const 16))))
    (f32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 12)))
      (f32.load (i32.add (local.get $vp_wa) (i32.const 20))))
    (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))
      (f32.add (f32.convert_i32_s (local.get $x))
               (f32.div (f32.convert_i32_s (local.get $w)) (f32.const 2.0))))
    (f32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4)))
      (f32.add (f32.convert_i32_s (local.get $y))
               (f32.div (f32.convert_i32_s (local.get $h)) (f32.const 2.0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $d3dim_device7_get_viewport (param $this i32) (param $lpVp i32)
    (local $state i32) (local $sw i32) (local $vp_wa i32)
    (if (i32.eqz (local.get $lpVp)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $vp_wa (call $g2w (local.get $lpVp)))
    (i32.store (local.get $vp_wa)
      (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT))))
    (i32.store (i32.add (local.get $vp_wa) (i32.const 4))
      (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4)))))
    (i32.store (i32.add (local.get $vp_wa) (i32.const 8))
      (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8)))))
    (i32.store (i32.add (local.get $vp_wa) (i32.const 12))
      (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12)))))
    (f32.store (i32.add (local.get $vp_wa) (i32.const 16))
      (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 8)))))
    (f32.store (i32.add (local.get $vp_wa) (i32.const 20))
      (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 12)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; ============================================================
  ;; STEP 2 — Matrix core (4×4 row-major f32)
  ;; ============================================================
  ;; Convention: matrices are 16 f32 in row-major order. For row-vectors
  ;; (D3D-style), the chain is screen = vertex * world * view * proj, so
  ;; mat4_mul computes  out[i][j] = sum_k a[i][k] * b[k][j].

  (func $mat4_mul (param $out_wa i32) (param $a_wa i32) (param $b_wa i32)
    (local $a0 v128) (local $a1 v128) (local $a2 v128) (local $a3 v128)
    (local $b0 v128) (local $b1 v128) (local $b2 v128) (local $b3 v128)
    ;; Read both operands whole before the first store: out may alias a or b.
    ;; D3DOP_MATRIXMULTIPLY names handles, and an app that accumulates a
    ;; rotation writes dest = dest * step (the DX SDK's Twist does). Storing
    ;; element by element while still reading collapsed that matrix a little
    ;; more every frame until the object was a one-pixel sliver.
    ;; Lane-wise sums keep the old ((a0b0 + a1b1) + a2b2) + a3b3 order.
    (local.set $a0 (v128.load offset=0 (local.get $a_wa)))
    (local.set $a1 (v128.load offset=16 (local.get $a_wa)))
    (local.set $a2 (v128.load offset=32 (local.get $a_wa)))
    (local.set $a3 (v128.load offset=48 (local.get $a_wa)))
    (local.set $b0 (v128.load offset=0 (local.get $b_wa)))
    (local.set $b1 (v128.load offset=16 (local.get $b_wa)))
    (local.set $b2 (v128.load offset=32 (local.get $b_wa)))
    (local.set $b3 (v128.load offset=48 (local.get $b_wa)))
    (v128.store offset=0 (local.get $out_wa)
      (f32x4.add (f32x4.add (f32x4.add
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 0 (local.get $a0))) (local.get $b0))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 1 (local.get $a0))) (local.get $b1)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 2 (local.get $a0))) (local.get $b2)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 3 (local.get $a0))) (local.get $b3))))
    (v128.store offset=16 (local.get $out_wa)
      (f32x4.add (f32x4.add (f32x4.add
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 0 (local.get $a1))) (local.get $b0))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 1 (local.get $a1))) (local.get $b1)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 2 (local.get $a1))) (local.get $b2)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 3 (local.get $a1))) (local.get $b3))))
    (v128.store offset=32 (local.get $out_wa)
      (f32x4.add (f32x4.add (f32x4.add
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 0 (local.get $a2))) (local.get $b0))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 1 (local.get $a2))) (local.get $b1)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 2 (local.get $a2))) (local.get $b2)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 3 (local.get $a2))) (local.get $b3))))
    (v128.store offset=48 (local.get $out_wa)
      (f32x4.add (f32x4.add (f32x4.add
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 0 (local.get $a3))) (local.get $b0))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 1 (local.get $a3))) (local.get $b1)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 2 (local.get $a3))) (local.get $b2)))
        (f32x4.mul (f32x4.splat (f32x4.extract_lane 3 (local.get $a3))) (local.get $b3)))))

  ;; out[j] = sum_k v[k] * M[k][j]   (row-vector × matrix)
  (func $mat4_transform_vec4 (param $out_wa i32) (param $mat_wa i32) (param $vec_wa i32)
    (local $j i32)
    (local.set $j (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $j) (i32.const 4)))
      (f32.store
        (i32.add (local.get $out_wa) (i32.mul (local.get $j) (i32.const 4)))
        (f32.add (f32.add (f32.add
          (f32.mul (f32.load (local.get $vec_wa))
                   (f32.load (i32.add (local.get $mat_wa)
                     (i32.mul (i32.add (i32.const 0) (local.get $j)) (i32.const 4)))))
          (f32.mul (f32.load (i32.add (local.get $vec_wa) (i32.const 4)))
                   (f32.load (i32.add (local.get $mat_wa)
                     (i32.mul (i32.add (i32.const 4) (local.get $j)) (i32.const 4))))))
          (f32.mul (f32.load (i32.add (local.get $vec_wa) (i32.const 8)))
                   (f32.load (i32.add (local.get $mat_wa)
                     (i32.mul (i32.add (i32.const 8) (local.get $j)) (i32.const 4))))))
          (f32.mul (f32.load (i32.add (local.get $vec_wa) (i32.const 12)))
                   (f32.load (i32.add (local.get $mat_wa)
                     (i32.mul (i32.add (i32.const 12) (local.get $j)) (i32.const 4)))))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $lp))))

  ;; Build composite world*view*proj into the device's scratch matrix slot 3
  ;; ($state +192).  state_guest is the result of $d3ddev_state(this).
  (func $d3ddev_composite_wvp (param $state_guest i32)
    (local $sw i32) (local $tmp i32) (local $mid i32)
    (if (i32.eqz (local.get $state_guest)) (then (return)))
    (local.set $sw (call $g2w (local.get $state_guest)))
    ;; mat4_mul is not alias-safe, so keep world*view in a separate scratch area
    ;; before writing the final world*view*proj matrix into slot 3.
    (local.set $tmp (i32.add (local.get $sw) (i32.const 192)))
    (local.set $mid (i32.add (local.get $sw) (i32.const 3136)))
    (call $mat4_mul (local.get $mid)
      (local.get $sw)                                  ;; world @ +0
      (i32.add (local.get $sw) (i32.const 64)))        ;; view  @ +64
    (call $mat4_mul (local.get $tmp)
      (local.get $mid)
      (i32.add (local.get $sw) (i32.const 128))))      ;; proj  @ +128

  ;; vin_wa: position xyz (12 bytes) at offset 0; FVF tail ignored for now.
  ;; vout_wa: 16-byte (sx, sy, z_ndc, inv_w) f32.
  (func $vertex_project (param $state_guest i32) (param $vin_wa i32) (param $vout_wa i32)
    (local $sw i32) (local $vec_wa i32) (local $clip_wa i32) (local $w f32) (local $inv_w f32)
    (if (i32.eqz (local.get $state_guest)) (then (return)))
    (local.set $sw (call $g2w (local.get $state_guest)))
    ;; Pack (x,y,z,1) into the device-owned scratch vector; the separate clip
    ;; vector remains available to PROCESSVERTICES after projection.
    (local.set $vec_wa  (i32.add (local.get $sw) (i32.const 4032)))
    (local.set $clip_wa (i32.add (local.get $sw) (i32.const 4064)))
    (f32.store (local.get $vec_wa)                       (f32.load (local.get $vin_wa)))
    (f32.store (i32.add (local.get $vec_wa) (i32.const 4))  (f32.load (i32.add (local.get $vin_wa) (i32.const 4))))
    (f32.store (i32.add (local.get $vec_wa) (i32.const 8))  (f32.load (i32.add (local.get $vin_wa) (i32.const 8))))
    (f32.store (i32.add (local.get $vec_wa) (i32.const 12)) (f32.const 1.0))
    ;; clip = vec * composite (slot 3 @ +192)
    (call $mat4_transform_vec4 (local.get $clip_wa)
      (i32.add (local.get $sw) (i32.const 192))
      (local.get $vec_wa))
    ;; Normalize before division AND clip-status accumulation. Multiplying
    ;; translations by the original w also preserves negative-w clipping.
    ;; The usual [-1,1] XY / [0,1] Z volume skips this arithmetic entirely.
    (if (i32.load offset=3928 (local.get $sw)) (then
      (local.set $w (f32.load offset=12 (local.get $clip_wa)))
      (f32.store (local.get $clip_wa)
        (f32.add (f32.mul (f32.load (local.get $clip_wa)) (f32.load offset=3904 (local.get $sw)))
          (f32.mul (local.get $w) (f32.load offset=3908 (local.get $sw)))))
      (f32.store offset=4 (local.get $clip_wa)
        (f32.add (f32.mul (f32.load offset=4 (local.get $clip_wa)) (f32.load offset=3912 (local.get $sw)))
          (f32.mul (local.get $w) (f32.load offset=3916 (local.get $sw)))))
      (f32.store offset=8 (local.get $clip_wa)
        (f32.add (f32.mul (f32.load offset=8 (local.get $clip_wa)) (f32.load offset=3920 (local.get $sw)))
          (f32.mul (local.get $w) (f32.load offset=3924 (local.get $sw)))))))
    ;; inv_w = 1 / w. Clamp a near-zero divisor while preserving its sign;
    ;; otherwise a vertex on the eye plane produces +/-inf screen coordinates
    ;; and traps the integer scanline rasterizer before clipping can reject it.
    (local.set $w (f32.load (i32.add (local.get $clip_wa) (i32.const 12))))
    (if (f32.lt (f32.abs (local.get $w)) (f32.const 0.001)) (then
      (if (f32.lt (local.get $w) (f32.const 0.0))
        (then (local.set $w (f32.const -0.001)))
        (else (local.set $w (f32.const 0.001))))))
    (local.set $inv_w (f32.div (f32.const 1.0) (local.get $w)))
    ;; NDC: x/w, y/w, z/w
    ;; Screen: sx = origin.x + (x_ndc) * scale.x ; sy = origin.y - (y_ndc) * scale.y
    (f32.store (local.get $vout_wa)
      (f32.add
        (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 0))))
        (f32.mul
          (f32.mul (f32.load (local.get $clip_wa)) (local.get $inv_w))
          (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 0)))))))
    (f32.store (i32.add (local.get $vout_wa) (i32.const 4))
      (f32.sub
        (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4))))
        (f32.mul
          (f32.mul (f32.load (i32.add (local.get $clip_wa) (i32.const 4))) (local.get $inv_w))
          (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))))))
    (f32.store (i32.add (local.get $vout_wa) (i32.const 8))
      (f32.mul (f32.load (i32.add (local.get $clip_wa) (i32.const 8))) (local.get $inv_w)))
    (f32.store (i32.add (local.get $vout_wa) (i32.const 12)) (local.get $inv_w))
    (if (i32.lt_u (global.get $d3dim_dbg_vproj_count) (i32.const 12)) (then
      (call $host_log_i32 (i32.const 0xD3D17000))
      (call $host_log_i32 (global.get $d3dim_dbg_vproj_count))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (local.get $vin_wa))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $vin_wa) (i32.const 4)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $vin_wa) (i32.const 8)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (local.get $clip_wa))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $clip_wa) (i32.const 4)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $clip_wa) (i32.const 8)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $clip_wa) (i32.const 12)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (local.get $vout_wa))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $vout_wa) (i32.const 4)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $vout_wa) (i32.const 8)))))
      (call $host_log_i32 (i32.reinterpret_f32 (f32.load (i32.add (local.get $vout_wa) (i32.const 12)))))
      (global.set $d3dim_dbg_vproj_count (i32.add (global.get $d3dim_dbg_vproj_count) (i32.const 1))))))

  ;; ── Test export: known-answer check helpers ──────────────────
  ;; mat_set_identity(out_wa) and mat_set_translate(out_wa, tx, ty, tz)
  ;; Returns the dest WASM addr to caller.
  (func $test_mat4_identity (export "test_mat4_identity") (param $out_wa i32)
    (local $i i32)
    (call $zero_memory (local.get $out_wa) (i32.const 64))
    (f32.store (i32.add (local.get $out_wa) (i32.const 0))  (f32.const 1.0))
    (f32.store (i32.add (local.get $out_wa) (i32.const 20)) (f32.const 1.0))
    (f32.store (i32.add (local.get $out_wa) (i32.const 40)) (f32.const 1.0))
    (f32.store (i32.add (local.get $out_wa) (i32.const 60)) (f32.const 1.0)))

  (func $test_mat4_mul (export "test_mat4_mul") (param $o i32) (param $a i32) (param $b i32)
    (call $mat4_mul (local.get $o) (local.get $a) (local.get $b)))

  (func $test_mat4_xform (export "test_mat4_xform") (param $o i32) (param $m i32) (param $v i32)
    (call $mat4_transform_vec4 (local.get $o) (local.get $m) (local.get $v)))

  ;; ============================================================
  ;; STEP 3 — Viewport Clear + z-buffer
  ;; ============================================================
  ;; Helper: from a device "this", look up the render-target DDSurface entry.
  (func $d3ddev_rt_entry (param $this_guest i32) (result i32)
    (local $entry i32) (local $rt_slot i32)
    (local.set $entry (call $dx_from_this (local.get $this_guest)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (local.set $rt_slot (load.field DxObject misc0 (local.get $entry)))
    (i32.add (global.get $DX_OBJECTS) (i32.mul (local.get $rt_slot) (i32.const 32))))

  ;; Find the DirectDraw Z surface attached to the render target, or allocate a
  ;; private guest-heap f32 plane as a fallback.  The depth handle stored at
  ;; state +D3DIM_OFF_ZBUF_SLOT is therefore either a DX_OBJECTS entry address
  ;; or a guest pointer.  Prefer a newly attached real surface even if an early
  ;; draw caused the fallback plane to be allocated first: DirectDraw clears
  ;; and locks the attached surface, so a private plane would immediately
  ;; diverge from application-visible depth state.
  ;; The DDSCAPS_ZBUFFER surface attached to render target $rt (a DX_OBJECTS
  ;; entry address), or 0. It must match the target's size and be a 16- or
  ;; 32-bit surface with backing; anything else attached is a flip-chain or
  ;; mipmap colour surface.
  (func $d3dim_attached_zbuffer (param $rt i32) (result i32)
    (local $rt_slot i32) (local $i i32) (local $candidate i32)
    (local.set $rt_slot (call $dx_slot_of (local.get $rt)))
    (local.set $i (i32.const 1))
    (block $attached_done (loop $attached_scan
      (br_if $attached_done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $candidate
        (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $i) (global.get $DX_ENTRY_SIZE))))
      (if (i32.and
            (i32.eq (i32.load (local.get $candidate)) (i32.const 2))
            (i32.and
              (i32.eq (i32.load offset=4 (call $dx_surf_meta_ptr (local.get $candidate)))
                (i32.add (local.get $rt_slot) (i32.const 1)))
              (i32.and
                (i32.and
                  (i32.ne
                    (i32.and (i32.load (call $dx_surf_meta_ptr (local.get $candidate)))
                      (i32.const 0x00020000))
                    (i32.const 0))
                  (i32.eq (i32.load offset=12 (local.get $candidate))
                    (i32.load offset=12 (local.get $rt))))
                (i32.and
                  (i32.or
                    (i32.eq (i32.load16_u offset=16 (local.get $candidate)) (i32.const 16))
                    (i32.eq (i32.load16_u offset=16 (local.get $candidate)) (i32.const 32)))
                  (i32.ne (i32.load offset=20 (local.get $candidate)) (i32.const 0))))))
        (then (return (local.get $candidate))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $attached_scan)))
    (i32.const 0))

  (func $d3dim_ensure_zbuffer (param $this_guest i32) (result i32)
    (local $state i32) (local $rt i32) (local $w i32) (local $h i32)
    (local $bytes i32) (local $zbuf i32) (local $sw i32) (local $candidate i32)
    (local.set $state (call $d3ddev_state (local.get $this_guest)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $zbuf (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_ZBUF_SLOT))))
    (local.set $rt (call $d3ddev_rt_entry (local.get $this_guest)))
    (if (i32.eqz (local.get $rt)) (then (return (i32.const 0))))
    (local.set $w (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h)))
      (then (return (i32.const 0))))
    (local.set $candidate (call $d3dim_attached_zbuffer (local.get $rt)))
    (if (local.get $candidate)
      (then
        (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_ZBUF_SLOT))
          (local.get $candidate))
        (return (local.get $candidate))))
    (if (local.get $zbuf) (then (return (local.get $zbuf))))
    (local.set $bytes (i32.mul (i32.mul (local.get $w) (local.get $h)) (i32.const 4)))
    (local.set $zbuf (call $heap_alloc (local.get $bytes)))
    (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_ZBUF_SLOT)) (local.get $zbuf))
    (local.get $zbuf))

  ;; Fill an RT DIB rect with a 32-bit color, dispatching by bpp.
  ;; rt_entry is WASM addr of the DDSurface entry; (x,y,w,h) are the viewport
  ;; rect (caller already clipped to surface bounds — we re-clip defensively).
  ;; RGB rectangle callers historically force opaque native16 storage. Keep
  ;; that contract separate from POINTLIST's complete diffuse RGBA color.
  (func $viewport_fill_rect (param $rt_entry i32) (param $x i32) (param $y i32)
    (param $w i32) (param $h i32) (param $color i32)
    (call $viewport_fill_rect_rgba (local.get $rt_entry) (local.get $x) (local.get $y)
      (local.get $w) (local.get $h)
      (select (i32.or (local.get $color) (i32.const 0xFF000000)) (local.get $color)
        (i32.eq (load.field DxObject bpp (local.get $rt_entry)) (i32.const 16)))))

  (func $viewport_fill_rect_rgba (param $rt_entry i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $color i32)
    (local $sw i32) (local $sh i32) (local $bpp i32) (local $pitch i32) (local $dib_wa i32)
    (local $row i32) (local $col i32) (local $row_wa i32) (local $px16 i32)
    (local.set $sw (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 16)))
    (local.set $bpp (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $pitch (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 16)))
    (local.set $dib_wa (i32.load (i32.add (local.get $rt_entry) (i32.const 20))))
    (if (i32.eqz (local.get $dib_wa)) (then (return)))
    ;; Clip
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then
      (local.set $w (i32.add (local.get $w) (local.get $x)))
      (local.set $x (i32.const 0))))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then
      (local.set $h (i32.add (local.get $h) (local.get $y)))
      (local.set $y (i32.const 0))))
    (if (i32.gt_s (i32.add (local.get $x) (local.get $w)) (local.get $sw))
      (then (local.set $w (i32.sub (local.get $sw) (local.get $x)))))
    (if (i32.gt_s (i32.add (local.get $y) (local.get $h)) (local.get $sh))
      (then (local.set $h (i32.sub (local.get $sh) (local.get $y)))))
    ;; A draw's viewport clip ($d3dim_clip_begin); off outside draws.
    (if (global.get $d3dim_clip_on) (then
      (if (i32.lt_s (local.get $x) (global.get $d3dim_clip_x0)) (then
        (local.set $w (i32.sub (local.get $w) (i32.sub (global.get $d3dim_clip_x0) (local.get $x))))
        (local.set $x (global.get $d3dim_clip_x0))))
      (if (i32.lt_s (local.get $y) (global.get $d3dim_clip_y0)) (then
        (local.set $h (i32.sub (local.get $h) (i32.sub (global.get $d3dim_clip_y0) (local.get $y))))
        (local.set $y (global.get $d3dim_clip_y0))))
      (if (i32.gt_s (i32.add (local.get $x) (local.get $w)) (global.get $d3dim_clip_x1))
        (then (local.set $w (i32.sub (global.get $d3dim_clip_x1) (local.get $x)))))
      (if (i32.gt_s (i32.add (local.get $y) (local.get $h)) (global.get $d3dim_clip_y1))
        (then (local.set $h (i32.sub (global.get $d3dim_clip_y1) (local.get $y)))))))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0)))
      (then (return)))
    (call $d3dim_exec_extent_draw (local.get $rt_entry)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h))
    ;; Store complete diffuse RGBA using the declared native component masks.
    (local.set $px16 (call $d3dim_encode_surface_pixel (local.get $rt_entry)
      (local.get $color) (i32.const 16)))
    (local.set $row (i32.const 0))
    (block $rdone (loop $rlp
      (br_if $rdone (i32.ge_s (local.get $row) (local.get $h)))
      (local.set $row_wa (i32.add (local.get $dib_wa)
        (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))))
      (local.set $col (i32.const 0))
      (block $cdone (loop $clp
        (br_if $cdone (i32.ge_s (local.get $col) (local.get $w)))
        (if (i32.eq (local.get $bpp) (i32.const 32)) (then
          (i32.store
            (i32.add (local.get $row_wa)
              (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 4)))
            (local.get $color))))
        (if (i32.eq (local.get $bpp) (i32.const 16)) (then
          (i32.store16
            (i32.add (local.get $row_wa)
              (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 2)))
            (local.get $px16))))
        (if (i32.eq (local.get $bpp) (i32.const 8)) (then
          (i32.store8
            (i32.add (local.get $row_wa) (i32.add (local.get $x) (local.get $col)))
            (local.get $color))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br $clp)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rlp))))

  ;; Stretch a texture over a rect of an RT DIB (nearest neighbour). Used for a
  ;; viewport background material that carries an image rather than a colour.
  (func $viewport_fill_rect_texture
    (param $rt_entry i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (param $tex_entry i32)
    (local $sw i32) (local $sh i32) (local $bpp i32) (local $pitch i32) (local $dib_wa i32)
    (local $row i32) (local $col i32) (local $row_wa i32) (local $color i32) (local $px16 i32)
    (local $fw f32) (local $fh f32)
    (if (i32.or (i32.eqz (local.get $tex_entry))
                (i32.or (i32.le_s (local.get $w) (i32.const 0))
                        (i32.le_s (local.get $h) (i32.const 0))))
      (then (return)))
    (local.set $sw (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 16)))
    (local.set $bpp (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $pitch (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 16)))
    (local.set $dib_wa (i32.load (i32.add (local.get $rt_entry) (i32.const 20))))
    (if (i32.eqz (local.get $dib_wa)) (then (return)))
    (local.set $fw (f32.convert_i32_s (local.get $w)))
    (local.set $fh (f32.convert_i32_s (local.get $h)))
    (call $dx_surf_note_write (local.get $rt_entry))
    ;; Clip against the surface; the u/v mapping stays tied to the unclipped
    ;; rect so a partially offscreen viewport still shows the right part.
    (local.set $row (i32.const 0))
    (block $rdone (loop $rlp
      (br_if $rdone (i32.ge_s (local.get $row) (local.get $h)))
      (if (i32.or (i32.lt_s (i32.add (local.get $y) (local.get $row)) (i32.const 0))
                  (i32.ge_s (i32.add (local.get $y) (local.get $row)) (local.get $sh)))
        (then (local.set $row (i32.add (local.get $row) (i32.const 1))) (br $rlp)))
      (local.set $row_wa (i32.add (local.get $dib_wa)
        (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))))
      (local.set $col (i32.const 0))
      (block $cdone (loop $clp
        (br_if $cdone (i32.ge_s (local.get $col) (local.get $w)))
        (if (i32.or (i32.lt_s (i32.add (local.get $x) (local.get $col)) (i32.const 0))
                    (i32.ge_s (i32.add (local.get $x) (local.get $col)) (local.get $sw)))
          (then (local.set $col (i32.add (local.get $col) (i32.const 1))) (br $clp)))
        (local.set $color (call $d3dim_texture_sample_rgb (local.get $tex_entry)
          (f32.div (f32.add (f32.convert_i32_s (local.get $col)) (f32.const 0.5)) (local.get $fw))
          (f32.div (f32.add (f32.convert_i32_s (local.get $row)) (f32.const 0.5)) (local.get $fh))))
        (if (i32.eq (local.get $bpp) (i32.const 32)) (then
          (i32.store
            (i32.add (local.get $row_wa)
              (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 4)))
            (local.get $color))))
        (if (i32.eq (local.get $bpp) (i32.const 16)) (then
          (local.set $px16 (call $d3dim_encode_surface_pixel (local.get $rt_entry)
            (i32.or (local.get $color) (i32.const 0xFF000000)) (i32.const 16)))
          (i32.store16
            (i32.add (local.get $row_wa)
              (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 2)))
            (local.get $px16))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br $clp)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rlp))))

  ;; Source-alpha blend a rect into an RT DIB. The source color is 0xAARRGGBB.
  (func $viewport_fill_rect_alpha (param $rt_entry i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $color i32) (param $alpha i32)
    (local $sw i32) (local $sh i32) (local $bpp i32) (local $pitch i32) (local $dib_wa i32)
    (local $row i32) (local $col i32) (local $row_wa i32) (local $ptr i32)
    (local $dst16 i32) (local $dst32 i32) (local $ia i32)
    (local $sr i32) (local $sg i32) (local $sb i32)
    (local $dr i32) (local $dg i32) (local $db i32)
    (local $rr i32) (local $gg i32) (local $bb i32) (local $px16 i32)
    (if (i32.eqz (local.get $alpha)) (then (return)))
    (if (i32.ge_u (local.get $alpha) (i32.const 255)) (then
      (call $viewport_fill_rect
        (local.get $rt_entry) (local.get $x) (local.get $y)
        (local.get $w) (local.get $h) (local.get $color))
      (return)))
    (local.set $sw (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 16)))
    (local.set $bpp (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $pitch (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 16)))
    (local.set $dib_wa (i32.load (i32.add (local.get $rt_entry) (i32.const 20))))
    (if (i32.eqz (local.get $dib_wa)) (then (return)))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then
      (local.set $w (i32.add (local.get $w) (local.get $x)))
      (local.set $x (i32.const 0))))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then
      (local.set $h (i32.add (local.get $h) (local.get $y)))
      (local.set $y (i32.const 0))))
    (if (i32.gt_s (i32.add (local.get $x) (local.get $w)) (local.get $sw))
      (then (local.set $w (i32.sub (local.get $sw) (local.get $x)))))
    (if (i32.gt_s (i32.add (local.get $y) (local.get $h)) (local.get $sh))
      (then (local.set $h (i32.sub (local.get $sh) (local.get $y)))))
    ;; A draw's viewport clip ($d3dim_clip_begin); off outside draws.
    (if (global.get $d3dim_clip_on) (then
      (if (i32.lt_s (local.get $x) (global.get $d3dim_clip_x0)) (then
        (local.set $w (i32.sub (local.get $w) (i32.sub (global.get $d3dim_clip_x0) (local.get $x))))
        (local.set $x (global.get $d3dim_clip_x0))))
      (if (i32.lt_s (local.get $y) (global.get $d3dim_clip_y0)) (then
        (local.set $h (i32.sub (local.get $h) (i32.sub (global.get $d3dim_clip_y0) (local.get $y))))
        (local.set $y (global.get $d3dim_clip_y0))))
      (if (i32.gt_s (i32.add (local.get $x) (local.get $w)) (global.get $d3dim_clip_x1))
        (then (local.set $w (i32.sub (global.get $d3dim_clip_x1) (local.get $x)))))
      (if (i32.gt_s (i32.add (local.get $y) (local.get $h)) (global.get $d3dim_clip_y1))
        (then (local.set $h (i32.sub (global.get $d3dim_clip_y1) (local.get $y)))))))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0)))
      (then (return)))
    (call $d3dim_exec_extent_draw (local.get $rt_entry)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h))
    (if (i32.eq (local.get $bpp) (i32.const 8)) (then
      (call $viewport_fill_rect
        (local.get $rt_entry) (local.get $x) (local.get $y)
        (local.get $w) (local.get $h) (local.get $color))
      (return)))
    (local.set $ia (i32.sub (i32.const 255) (local.get $alpha)))
    (local.set $sr (i32.and (i32.shr_u (local.get $color) (i32.const 16)) (i32.const 0xff)))
    (local.set $sg (i32.and (i32.shr_u (local.get $color) (i32.const 8)) (i32.const 0xff)))
    (local.set $sb (i32.and (local.get $color) (i32.const 0xff)))
    (local.set $row (i32.const 0))
    (block $rdone (loop $rlp
      (br_if $rdone (i32.ge_s (local.get $row) (local.get $h)))
      (local.set $row_wa (i32.add (local.get $dib_wa)
        (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))))
      (local.set $col (i32.const 0))
      (block $cdone (loop $clp
        (br_if $cdone (i32.ge_s (local.get $col) (local.get $w)))
        (if (i32.eq (local.get $bpp) (i32.const 32)) (then
          (local.set $ptr
            (i32.add (local.get $row_wa)
              (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 4))))
          (local.set $dst32 (i32.load (local.get $ptr)))
          (local.set $dr (i32.and (i32.shr_u (local.get $dst32) (i32.const 16)) (i32.const 0xff)))
          (local.set $dg (i32.and (i32.shr_u (local.get $dst32) (i32.const 8)) (i32.const 0xff)))
          (local.set $db (i32.and (local.get $dst32) (i32.const 0xff)))
          (local.set $rr (i32.div_u
            (i32.add (i32.mul (local.get $sr) (local.get $alpha)) (i32.mul (local.get $dr) (local.get $ia)))
            (i32.const 255)))
          (local.set $gg (i32.div_u
            (i32.add (i32.mul (local.get $sg) (local.get $alpha)) (i32.mul (local.get $dg) (local.get $ia)))
            (i32.const 255)))
          (local.set $bb (i32.div_u
            (i32.add (i32.mul (local.get $sb) (local.get $alpha)) (i32.mul (local.get $db) (local.get $ia)))
            (i32.const 255)))
          (i32.store (local.get $ptr)
            (i32.or
              (i32.and (local.get $dst32) (i32.const 0xff000000))
              (i32.or (i32.or
                (i32.shl (local.get $rr) (i32.const 16))
                (i32.shl (local.get $gg) (i32.const 8)))
                (local.get $bb))))))
        (if (i32.eq (local.get $bpp) (i32.const 16)) (then
          (local.set $ptr
            (i32.add (local.get $row_wa)
              (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 2))))
          (local.set $dst16 (i32.load16_u (local.get $ptr)))
          (local.set $dr (i32.shl (i32.and (i32.shr_u (local.get $dst16) (i32.const 11)) (i32.const 0x1f)) (i32.const 3)))
          (local.set $dg (i32.shl (i32.and (i32.shr_u (local.get $dst16) (i32.const 5)) (i32.const 0x3f)) (i32.const 2)))
          (local.set $db (i32.shl (i32.and (local.get $dst16) (i32.const 0x1f)) (i32.const 3)))
          (local.set $rr (i32.div_u
            (i32.add (i32.mul (local.get $sr) (local.get $alpha)) (i32.mul (local.get $dr) (local.get $ia)))
            (i32.const 255)))
          (local.set $gg (i32.div_u
            (i32.add (i32.mul (local.get $sg) (local.get $alpha)) (i32.mul (local.get $dg) (local.get $ia)))
            (i32.const 255)))
          (local.set $bb (i32.div_u
            (i32.add (i32.mul (local.get $sb) (local.get $alpha)) (i32.mul (local.get $db) (local.get $ia)))
            (i32.const 255)))
          (local.set $px16 (i32.or (i32.or
            (i32.shl (i32.and (i32.shr_u (local.get $rr) (i32.const 3)) (i32.const 0x1f)) (i32.const 11))
            (i32.shl (i32.and (i32.shr_u (local.get $gg) (i32.const 2)) (i32.const 0x3f)) (i32.const 5)))
            (i32.and (i32.shr_u (local.get $bb) (i32.const 3)) (i32.const 0x1f))))
          (i32.store16 (local.get $ptr) (local.get $px16))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br $clp)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rlp))))

  (func $viewport_fill_rect_z
    (param $rt_entry i32) (param $zbuf_guest i32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (param $zval f32) (param $color i32) (param $zfunc i32) (param $zwrite i32)
    (local $sw i32) (local $sh i32) (local $bpp i32) (local $pitch i32) (local $dib_wa i32)
    (local $zbuf_wa i32) (local $row i32) (local $col i32) (local $row_wa i32)
    (local $px16 i32) (local $zptr i32) (local $zentry i32) (local $zdib i32)
    (local $zpitch i32) (local $zbpp i32) (local $zraw i32) (local $pass i32)
    (local $ztest f32)
    (if (i32.eqz (local.get $zbuf_guest)) (then
      (call $viewport_fill_rect
        (local.get $rt_entry) (local.get $x) (local.get $y)
        (local.get $w) (local.get $h) (local.get $color))
      (return)))
    (local.set $sw (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 16)))
    (local.set $bpp (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $pitch (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 16)))
    (local.set $dib_wa (i32.load (i32.add (local.get $rt_entry) (i32.const 20))))
    (if (i32.and
          (i32.ge_u (local.get $zbuf_guest) (global.get $DX_OBJECTS))
          (i32.lt_u (local.get $zbuf_guest)
            (i32.add (global.get $DX_OBJECTS) (global.get $DX_OBJECTS_SIZE))))
      (then
        (local.set $zentry (local.get $zbuf_guest))
        (local.set $zdib (i32.load offset=20 (local.get $zentry)))
        (local.set $zpitch (i32.load16_u offset=18 (local.get $zentry)))
        (local.set $zbpp (i32.load16_u offset=16 (local.get $zentry))))
      (else (local.set $zbuf_wa (call $g2w (local.get $zbuf_guest)))))
    (if (i32.or
          (i32.eqz (local.get $dib_wa))
          (i32.and (i32.eqz (local.get $zbuf_wa)) (i32.eqz (local.get $zdib))))
      (then (return)))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then
      (local.set $w (i32.add (local.get $w) (local.get $x)))
      (local.set $x (i32.const 0))))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then
      (local.set $h (i32.add (local.get $h) (local.get $y)))
      (local.set $y (i32.const 0))))
    (if (i32.gt_s (i32.add (local.get $x) (local.get $w)) (local.get $sw))
      (then (local.set $w (i32.sub (local.get $sw) (local.get $x)))))
    (if (i32.gt_s (i32.add (local.get $y) (local.get $h)) (local.get $sh))
      (then (local.set $h (i32.sub (local.get $sh) (local.get $y)))))
    ;; A draw's viewport clip ($d3dim_clip_begin); off outside draws.
    (if (global.get $d3dim_clip_on) (then
      (if (i32.lt_s (local.get $x) (global.get $d3dim_clip_x0)) (then
        (local.set $w (i32.sub (local.get $w) (i32.sub (global.get $d3dim_clip_x0) (local.get $x))))
        (local.set $x (global.get $d3dim_clip_x0))))
      (if (i32.lt_s (local.get $y) (global.get $d3dim_clip_y0)) (then
        (local.set $h (i32.sub (local.get $h) (i32.sub (global.get $d3dim_clip_y0) (local.get $y))))
        (local.set $y (global.get $d3dim_clip_y0))))
      (if (i32.gt_s (i32.add (local.get $x) (local.get $w)) (global.get $d3dim_clip_x1))
        (then (local.set $w (i32.sub (global.get $d3dim_clip_x1) (local.get $x)))))
      (if (i32.gt_s (i32.add (local.get $y) (local.get $h)) (global.get $d3dim_clip_y1))
        (then (local.set $h (i32.sub (global.get $d3dim_clip_y1) (local.get $y)))))))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0)))
      (then (return)))
    (call $d3dim_exec_extent_draw (local.get $rt_entry)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h))
    (local.set $px16 (call $d3dim_encode_surface_pixel (local.get $rt_entry)
      (i32.or (local.get $color) (i32.const 0xFF000000)) (i32.const 16)))
    (local.set $row (i32.const 0))
    (block $rdone (loop $rlp
      (br_if $rdone (i32.ge_s (local.get $row) (local.get $h)))
      (local.set $row_wa (i32.add (local.get $dib_wa)
        (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $pitch))))
      (local.set $col (i32.const 0))
      (block $cdone (loop $clp
        (br_if $cdone (i32.ge_s (local.get $col) (local.get $w)))
        (local.set $pass (i32.const 0))
        (if (local.get $zentry)
          (then
            (local.set $zptr (i32.add (local.get $zdib)
              (i32.add
                (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $zpitch))
                (i32.mul (i32.add (local.get $x) (local.get $col))
                  (i32.shr_u (local.get $zbpp) (i32.const 3))))))
            (local.set $ztest (local.get $zval))
            ;; A clipped/degenerate triangle can carry NaN depth. Reject it:
            ;; mapping NaN to either endpoint can pass reversed or ALWAYS
            ;; depth modes and poison every pixel in an attached Z surface.
            (if (f32.eq (local.get $ztest) (local.get $ztest))
              (then
                (if (f32.lt (local.get $ztest) (f32.const 0.0)) (then (local.set $ztest (f32.const 0.0))))
                (if (f32.gt (local.get $ztest) (f32.const 1.0)) (then (local.set $ztest (f32.const 1.0))))
                (if (i32.eq (local.get $zbpp) (i32.const 16))
                  (then
                    (local.set $zraw (i32.trunc_sat_f32_u
                      (f32.mul (local.get $ztest) (f32.const 65535.0))))
                    (if (call $d3dim_depth_compare_u
                          (local.get $zraw) (i32.load16_u (local.get $zptr)) (local.get $zfunc))
                      (then
                        (if (local.get $zwrite)
                          (then (i32.store16 (local.get $zptr) (local.get $zraw))))
                        (local.set $pass (i32.const 1)))))
                  (else
                    (if (i32.eq (local.get $zbpp) (i32.const 32))
                      (then
                        (local.set $zraw (i32.trunc_sat_f32_u
                          (f32.mul (local.get $ztest) (f32.const 4294967040.0))))
                        (if (call $d3dim_depth_compare_u
                              (local.get $zraw) (i32.load (local.get $zptr)) (local.get $zfunc))
                          (then
                            (if (local.get $zwrite)
                              (then (i32.store (local.get $zptr) (local.get $zraw))))
                            (local.set $pass (i32.const 1)))))))))))
          (else
            (local.set $zptr (i32.add (local.get $zbuf_wa)
              (i32.mul
                (i32.add
                  (i32.mul (i32.add (local.get $y) (local.get $row)) (local.get $sw))
                  (i32.add (local.get $x) (local.get $col)))
                (i32.const 4))))
            (if (f32.eq (local.get $zval) (local.get $zval))
              (then
                (if (call $d3dim_depth_compare_f32
                      (local.get $zval) (f32.load (local.get $zptr)) (local.get $zfunc))
                  (then
                    (if (local.get $zwrite)
                      (then (f32.store (local.get $zptr) (local.get $zval))))
                    (local.set $pass (i32.const 1))))))))
        (if (local.get $pass) (then
          (if (i32.eq (local.get $bpp) (i32.const 32)) (then
            (i32.store
              (i32.add (local.get $row_wa)
                (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 4)))
              (local.get $color))))
          (if (i32.eq (local.get $bpp) (i32.const 16)) (then
            (i32.store16
              (i32.add (local.get $row_wa)
                (i32.mul (i32.add (local.get $x) (local.get $col)) (i32.const 2)))
              (local.get $px16))))
          (if (i32.eq (local.get $bpp) (i32.const 8)) (then
            (i32.store8
              (i32.add (local.get $row_wa) (i32.add (local.get $x) (local.get $col)))
              (local.get $color))))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br $clp)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rlp))))

  ;; Every screen coordinate that reaches the rasterizer comes from a guest
  ;; float, and a guest is free to hand us a degenerate one: a vertex divided
  ;; by a zero w, an uninitialized buffer, a projection matrix that has not
  ;; been set yet. Plain i32.trunc_f32_s traps on NaN and on anything outside
  ;; i32 range, and a WASM trap is not a dropped triangle -- it kills the whole
  ;; emulator, taking the app and every other thread with it. Real hardware
  ;; just rasterizes garbage and moves on, so clamp instead: NaN lands at 0 via
  ;; trunc_sat, and the +/-1e6 bound keeps the edge-walk arithmetic below the
  ;; point where the span loop's i32 differences would overflow.
  ;; Repro before this existed: the DX SDK viewer.exe on any real Mesh .x file
  ;; crashed in $d3dim_draw_tl_triangle with "float unrepresentable in integer
  ;; range" as soon as d3drm handed the first triangle to Execute.
  ;; A pre-transformed vertex names a point on the screen grid, and a pixel is
  ;; covered when that point passes its CENTRE -- so 300.6 belongs to pixel
  ;; 301, not 300. Truncating biased every fractional vertex half a pixel up
  ;; and left, which is 62% of GTA2's menu-text disagreement with the WebGL
  ;; executor (0.7223% of pixels -> 0.2744%); every other app in the corpus
  ;; that draws D3DIM triangles puts its vertices on integers and is
  ;; pixel-identical either way. The rest of the gap is the span interpolating
  ;; its attributes at pixel corners, which is a separate change.
  (func $d3dim_coord_i (param $f f32) (result i32)
    (i32.trunc_sat_f32_s
      (f32.floor (f32.add
        (f32.min (f32.max (local.get $f) (f32.const -1000000.0)) (f32.const 1000000.0))
        (f32.const 0.5)))))

  (func $d3dim_texture_sample_rgb (param $tex_entry i32) (param $u f32) (param $v f32) (result i32)
    (local $tw i32) (local $th i32) (local $bpp i32) (local $pitch i32) (local $dib_wa i32)
    (local $tx i32) (local $ty i32) (local $ptr i32) (local $px i32) (local $c i32)
    (local $pal i32)
    (if (i32.eqz (local.get $tex_entry)) (then (return (i32.const 0))))
    (local.set $tw (i32.and (i32.load (i32.add (local.get $tex_entry) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $th (i32.shr_u (i32.load (i32.add (local.get $tex_entry) (i32.const 12))) (i32.const 16)))
    (local.set $bpp (i32.and (i32.load (i32.add (local.get $tex_entry) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $pitch (i32.shr_u (i32.load (i32.add (local.get $tex_entry) (i32.const 16))) (i32.const 16)))
    (local.set $dib_wa (i32.load (i32.add (local.get $tex_entry) (i32.const 20))))
    (if (i32.or
          (i32.or (i32.eqz (local.get $tw)) (i32.eqz (local.get $th)))
          (i32.or (i32.eqz (local.get $pitch)) (i32.eqz (local.get $dib_wa))))
      (then (return (i32.const 0))))
    ;; D3DIM samples commonly use wrapping coordinates.
    (local.set $u (f32.sub (local.get $u) (f32.floor (local.get $u))))
    (local.set $v (f32.sub (local.get $v) (f32.floor (local.get $v))))
    ;; trunc_sat, not trunc: a NaN texture coordinate survives the wrap above
    ;; (NaN - floor(NaN) is still NaN) and would trap the module rather than
    ;; sample a wrong texel. The clamps below already fix up an out-of-range
    ;; result, and trunc_sat sends NaN to 0, which they accept.
    (local.set $tx (i32.trunc_sat_f32_u (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw)))))
    (local.set $ty (i32.trunc_sat_f32_u (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th)))))
    (if (i32.ge_u (local.get $tx) (local.get $tw)) (then (local.set $tx (i32.sub (local.get $tw) (i32.const 1)))))
    (if (i32.ge_u (local.get $ty) (local.get $th)) (then (local.set $ty (i32.sub (local.get $th) (i32.const 1)))))
    (local.set $ptr (i32.add (local.get $dib_wa) (i32.mul (local.get $ty) (local.get $pitch))))
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (local.set $px (i32.load16_u (i32.add (local.get $ptr) (i32.mul (local.get $tx) (i32.const 2)))))
      (return (call $d3dim_decode_surface_pixel
        (local.get $tex_entry) (local.get $px) (local.get $bpp)))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (return (call $d3dim_decode_surface_pixel (local.get $tex_entry)
        (i32.load (i32.add (local.get $ptr) (i32.mul (local.get $tx) (i32.const 4))))
        (local.get $bpp)))))
    (if (i32.eq (local.get $bpp) (i32.const 8)) (then
      (local.set $c (i32.load8_u (i32.add (local.get $ptr) (local.get $tx))))
      ;; 8bpp textures are palettized: the byte is an index, not a grey level.
      (local.set $pal (call $dx_surf_pal_get (local.get $tex_entry)))
      (if (local.get $pal) (then
        (local.set $px (i32.load (i32.add (local.get $pal) (i32.shl (local.get $c) (i32.const 2)))))
        ;; PALETTEENTRY is (peRed, peGreen, peBlue, peFlags)
        (return (i32.or (select (i32.and (local.get $px) (i32.const 0xFF000000)) (i32.const 0xFF000000) (call $dx_surf_pal_alpha (local.get $tex_entry))) (i32.or (i32.or
          (i32.shl (i32.and (local.get $px) (i32.const 0xFF)) (i32.const 16))
          (i32.and (local.get $px) (i32.const 0xFF00)))
          (i32.and (i32.shr_u (local.get $px) (i32.const 16)) (i32.const 0xFF)))))))
      (return (i32.or (i32.const 0xFF000000)
        (i32.or (i32.or (i32.shl (local.get $c) (i32.const 16))
                        (i32.shl (local.get $c) (i32.const 8))) (local.get $c))))))
    (i32.const 0))

  (func $d3dim_address_texel (param $i i32) (param $size i32) (param $mode i32) (result i32)
    (local $period i32)
    ;; D3DTADDRESS_CLAMP
    (if (i32.eq (local.get $mode) (i32.const 3)) (then
      (if (i32.lt_s (local.get $i) (i32.const 0)) (then (return (i32.const 0))))
      (if (i32.ge_s (local.get $i) (local.get $size))
        (then (return (i32.sub (local.get $size) (i32.const 1)))))
      (return (local.get $i))))
    ;; D3DTADDRESS_MIRROR
    (if (i32.eq (local.get $mode) (i32.const 2)) (then
      (local.set $period (i32.shl (local.get $size) (i32.const 1)))
      (local.set $i (i32.rem_s (local.get $i) (local.get $period)))
      (if (i32.lt_s (local.get $i) (i32.const 0))
        (then (local.set $i (i32.add (local.get $i) (local.get $period)))))
      (if (i32.ge_s (local.get $i) (local.get $size))
        (then (local.set $i (i32.sub (i32.sub (local.get $period) (i32.const 1)) (local.get $i)))))
      (return (local.get $i))))
    ;; D3DTADDRESS_WRAP, and the legacy zero/default state.
    ;; D3D3 content overwhelmingly uses power-of-two textures. For those,
    ;; two's-complement AND is the exact wrapped remainder for positive and
    ;; negative coordinates and avoids a signed integer divide for each of the
    ;; four bilinear neighbours.
    (if (i32.eqz
          (i32.and (local.get $size) (i32.sub (local.get $size) (i32.const 1))))
      (then (return (i32.and (local.get $i) (i32.sub (local.get $size) (i32.const 1))))))
    (local.set $i (i32.rem_s (local.get $i) (local.get $size)))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (local.set $i (i32.add (local.get $i) (local.get $size)))))
    (local.get $i))

  (func $d3dim_texture_fetch_prepared
    (param $bpp i32) (param $pitch i32) (param $dib_wa i32) (param $fmt i32) (param $pal i32) (param $pal_alpha i32)
    (param $tx i32) (param $ty i32) (result i32)
    (local $ptr i32) (local $px i32) (local $c i32)
    (local.set $ptr (i32.add (local.get $dib_wa) (i32.mul (local.get $ty) (local.get $pitch))))
    (if (i32.eq (local.get $bpp) (i32.const 16)) (then
      (local.set $px (i32.load16_u
        (i32.add (local.get $ptr) (i32.shl (local.get $tx) (i32.const 1)))))
      ;; RGB565 inline: the same bits as decode_surface_pixel_fmt's expand5/6
      ;; path, without its three calls (V8 inlines none of them, and this is
      ;; up to four fetches per pixel).
      (if (i32.eq (local.get $fmt) (i32.const 1)) (then
        (local.set $c (i32.and (local.get $px) (i32.const 0xF800)))
        (local.set $c (i32.or
          (i32.shl (i32.or (i32.shr_u (local.get $c) (i32.const 8)) (i32.shr_u (local.get $c) (i32.const 13)))
            (i32.const 16))
          (i32.or
            (i32.shl
              (i32.or (i32.shr_u (i32.and (local.get $px) (i32.const 0x07E0)) (i32.const 3))
                      (i32.shr_u (i32.and (local.get $px) (i32.const 0x07E0)) (i32.const 9)))
              (i32.const 8))
            (i32.or (i32.shl (i32.and (local.get $px) (i32.const 31)) (i32.const 3))
                    (i32.shr_u (i32.and (local.get $px) (i32.const 31)) (i32.const 2))))))
        (return (i32.or (local.get $c) (i32.const 0xFF000000)))))
      ;; X1R5G5B5 (2) and A1R5G5B5 (3), likewise.
      (if (i32.or (i32.eq (local.get $fmt) (i32.const 2)) (i32.eq (local.get $fmt) (i32.const 3))) (then
        (local.set $c (i32.or
          (i32.shl
            (i32.or (i32.shr_u (i32.and (local.get $px) (i32.const 0x7C00)) (i32.const 7))
                    (i32.shr_u (i32.and (local.get $px) (i32.const 0x7C00)) (i32.const 12)))
            (i32.const 16))
          (i32.or
            (i32.shl
              (i32.or (i32.shr_u (i32.and (local.get $px) (i32.const 0x03E0)) (i32.const 2))
                      (i32.shr_u (i32.and (local.get $px) (i32.const 0x03E0)) (i32.const 7)))
              (i32.const 8))
            (i32.or (i32.shl (i32.and (local.get $px) (i32.const 31)) (i32.const 3))
                    (i32.shr_u (i32.and (local.get $px) (i32.const 31)) (i32.const 2))))))
        (return (i32.or (local.get $c)
          (select (i32.const 0xFF000000) (i32.const 0)
            (i32.or (i32.eq (local.get $fmt) (i32.const 2))
                    (i32.ne (i32.and (local.get $px) (i32.const 0x8000)) (i32.const 0))))))))
      (return (call $d3dim_decode_surface_pixel_fmt
        (local.get $fmt) (local.get $px) (local.get $bpp)))))
    (if (i32.eq (local.get $bpp) (i32.const 32)) (then
      (return (call $d3dim_decode_surface_pixel_fmt (local.get $fmt)
        (i32.load (i32.add (local.get $ptr) (i32.shl (local.get $tx) (i32.const 2))))
        (local.get $bpp)))))
    (if (i32.eq (local.get $bpp) (i32.const 8)) (then
      (local.set $c (i32.load8_u (i32.add (local.get $ptr) (local.get $tx))))
      (if (local.get $pal) (then
        (local.set $px (i32.load
          (i32.add (local.get $pal) (i32.shl (local.get $c) (i32.const 2)))))
        (return (i32.or (select (i32.and (local.get $px) (i32.const 0xFF000000)) (i32.const 0xFF000000) (local.get $pal_alpha)) (i32.or
          (i32.or
            (i32.shl (i32.and (local.get $px) (i32.const 0xFF)) (i32.const 16))
            (i32.and (local.get $px) (i32.const 0xFF00)))
          (i32.and (i32.shr_u (local.get $px) (i32.const 16)) (i32.const 0xFF))))))
        ;; No palette bound: sample the index as greyscale rather than as
        ;; transparent black.
        (else (return (i32.or (i32.const 0xFF000000)
          (i32.or (i32.shl (local.get $c) (i32.const 16))
            (i32.or (i32.shl (local.get $c) (i32.const 8)) (local.get $c)))))))))
    (i32.const 0))

  ;; Hot span sampler with immutable surface metadata already loaded by the
  ;; caller. Supports the fixed-function point/linear and wrap/mirror/clamp
  ;; states used by D3D3 games.
  (func $d3dim_texture_sample_prepared
    (param $tw i32) (param $th i32) (param $bpp i32) (param $pitch i32)
    (param $dib_wa i32) (param $fmt i32) (param $pal i32) (param $pal_alpha i32)
    (param $u f32) (param $v f32) (param $address_u i32) (param $address_v i32)
    (param $linear i32) (result i32)
    (call $d3dim_texture_sample_keyed
      (local.get $tw) (local.get $th) (local.get $bpp) (local.get $pitch)
      (local.get $dib_wa) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
      (local.get $u) (local.get $v) (local.get $address_u) (local.get $address_v)
      (local.get $linear) (i32.const 0) (i32.const 0)))

  ;; Explicit DX7 key blending substitutes transparent black before filtering.
  ;; Native palette indices, never expanded RGB, determine key membership.
  (func $d3dim_texture_fetch_keyed
    (param $bpp i32) (param $pitch i32) (param $dib i32) (param $fmt i32)
    (param $pal i32) (param $pal_alpha i32) (param $x i32) (param $y i32)
    (param $enabled i32) (param $key i32) (result i32)
    (local $c i32) (local $member i32)
    (local.set $c (call $d3dim_texture_fetch_prepared
      (local.get $bpp) (local.get $pitch) (local.get $dib) (local.get $fmt)
      (local.get $pal) (local.get $pal_alpha) (local.get $x) (local.get $y)))
    (if (local.get $enabled) (then
      (local.set $member (if (result i32) (i32.eq (local.get $bpp) (i32.const 8))
        (then (i32.load8_u (i32.add (local.get $dib)
          (i32.add (i32.mul (local.get $y) (local.get $pitch)) (local.get $x)))))
        (else (i32.and (local.get $c) (i32.const 0x00ffffff)))))
      (if (i32.eq (local.get $member) (local.get $key)) (then (return (i32.const 0))))))
    (local.get $c))

  (func $d3dim_texture_sample_keyed
    (param $tw i32) (param $th i32) (param $bpp i32) (param $pitch i32)
    (param $dib_wa i32) (param $fmt i32) (param $pal i32) (param $pal_alpha i32)
    (param $u f32) (param $v f32) (param $address_u i32) (param $address_v i32)
    (param $linear i32) (param $enabled i32) (param $key i32) (result i32)
    (local $sx f32) (local $sy f32) (local $fx f32) (local $fy f32)
    (local $x0 i32) (local $x1 i32) (local $y0 i32) (local $y1 i32)
    (local $c00 i32) (local $c10 i32) (local $c01 i32) (local $c11 i32)
    ;; Legacy hardware converts non-finite texture coordinates to its integer
    ;; indefinite value before addressing; for the power-of-two WRAP textures
    ;; used here that selects texel zero.  Canonicalize both coordinates before
    ;; the linear footprint math as well: leaving NaN in the fractional weights
    ;; makes four valid (even identical) samples interpolate to black through
    ;; trunc_sat. MW3's third terrain pass deliberately leaves TEX2 as NaN/Inf
    ;; while binding an all-white no-op lightmap, so that bug erased the entire
    ;; camera-near polygon after its correctly textured base pass.
    (if (f32.ne (f32.mul (local.get $u) (f32.const 0.0)) (f32.const 0.0))
      (then (local.set $u (f32.const 0.0))))
    (if (f32.ne (f32.mul (local.get $v) (f32.const 0.0)) (f32.const 0.0))
      (then (local.set $v (f32.const 0.0))))
    (if (i32.eqz (local.get $linear)) (then
      (local.set $x0 (call $d3dim_address_texel
        (i32.trunc_sat_f32_s (f32.floor (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw)))))
        (local.get $tw) (local.get $address_u)))
      (local.set $y0 (call $d3dim_address_texel
        (i32.trunc_sat_f32_s (f32.floor (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th)))))
        (local.get $th) (local.get $address_v)))
      (return (call $d3dim_texture_fetch_keyed
        (local.get $bpp) (local.get $pitch) (local.get $dib_wa) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
        (local.get $x0) (local.get $y0) (local.get $enabled) (local.get $key)))))
    ;; D3D's linear footprint is centred on the texel, hence the half-texel
    ;; offset before choosing and addressing the four neighbours.
    (local.set $sx (f32.sub (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw))) (f32.const 0.5)))
    (local.set $sy (f32.sub (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th))) (f32.const 0.5)))
    (local.set $x0 (i32.trunc_sat_f32_s (f32.floor (local.get $sx))))
    (local.set $y0 (i32.trunc_sat_f32_s (f32.floor (local.get $sy))))
    (local.set $fx (f32.sub (local.get $sx) (f32.floor (local.get $sx))))
    (local.set $fy (f32.sub (local.get $sy) (f32.floor (local.get $sy))))
    (local.set $x1 (call $d3dim_address_texel (i32.add (local.get $x0) (i32.const 1)) (local.get $tw) (local.get $address_u)))
    (local.set $y1 (call $d3dim_address_texel (i32.add (local.get $y0) (i32.const 1)) (local.get $th) (local.get $address_v)))
    (local.set $x0 (call $d3dim_address_texel (local.get $x0) (local.get $tw) (local.get $address_u)))
    (local.set $y0 (call $d3dim_address_texel (local.get $y0) (local.get $th) (local.get $address_v)))
    (local.set $c00 (call $d3dim_texture_fetch_keyed
      (local.get $bpp) (local.get $pitch) (local.get $dib_wa) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
      (local.get $x0) (local.get $y0) (local.get $enabled) (local.get $key)))
    (local.set $c10 (call $d3dim_texture_fetch_keyed
      (local.get $bpp) (local.get $pitch) (local.get $dib_wa) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
      (local.get $x1) (local.get $y0) (local.get $enabled) (local.get $key)))
    (local.set $c01 (call $d3dim_texture_fetch_keyed
      (local.get $bpp) (local.get $pitch) (local.get $dib_wa) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
      (local.get $x0) (local.get $y1) (local.get $enabled) (local.get $key)))
    (local.set $c11 (call $d3dim_texture_fetch_keyed
      (local.get $bpp) (local.get $pitch) (local.get $dib_wa) (local.get $fmt) (local.get $pal) (local.get $pal_alpha)
      (local.get $x1) (local.get $y1) (local.get $enabled) (local.get $key)))
    (call $d3dim_bilerp (local.get $c00) (local.get $c10) (local.get $c01) (local.get $c11)
      (local.get $fx) (local.get $fy)))

  ;; Bilinear weighted average of four packed 0xAARRGGBB texels. Keep both
  ;; rows fractional until the complete tensor product is evaluated, then
  ;; truncate once to UNORM8. Quantizing weights and packing each horizontal row
  ;; accumulated a downward error through vertical and subsequent mip blends
  ;; (the steep public sample's blue became 95 instead of about 97.216).
  ;;
  ;; A magnified texture repeats texels, and a lerp between equal values
  ;; returns that value exactly, so four equal texels short-circuit.
  (func $d3dim_bilerp
    (param $c00 i32) (param $c10 i32) (param $c01 i32) (param $c11 i32)
    (param $fx f32) (param $fy f32) (result i32)
    (local $a v128) (local $b v128) (local $c v128) (local $d v128)
    (local $top v128) (local $bottom v128)
    (if (i32.and (i32.eq (local.get $c00) (local.get $c10))
          (i32.and (i32.eq (local.get $c00) (local.get $c01))
                   (i32.eq (local.get $c00) (local.get $c11))))
      (then (return (local.get $c00))))
    ;; Packed BGRA bytes become one f32 lane per component.
    (local.set $a (f32x4.convert_i32x4_u (i32x4.extend_low_i16x8_u
      (i16x8.extend_low_i8x16_u (i32x4.splat (local.get $c00))))))
    (local.set $b (f32x4.convert_i32x4_u (i32x4.extend_low_i16x8_u
      (i16x8.extend_low_i8x16_u (i32x4.splat (local.get $c10))))))
    (local.set $c (f32x4.convert_i32x4_u (i32x4.extend_low_i16x8_u
      (i16x8.extend_low_i8x16_u (i32x4.splat (local.get $c01))))))
    (local.set $d (f32x4.convert_i32x4_u (i32x4.extend_low_i16x8_u
      (i16x8.extend_low_i8x16_u (i32x4.splat (local.get $c11))))))
    (local.set $top (f32x4.add (local.get $a)
      (f32x4.mul (f32x4.sub (local.get $b) (local.get $a)) (f32x4.splat (local.get $fx)))))
    (local.set $bottom (f32x4.add (local.get $c)
      (f32x4.mul (f32x4.sub (local.get $d) (local.get $c)) (f32x4.splat (local.get $fx)))))
    (i32x4.extract_lane 0
      (i8x16.narrow_i16x8_u
        (i16x8.narrow_i32x4_u
          (i32x4.trunc_sat_f32x4_u
            (f32x4.add (local.get $top)
              (f32x4.mul (f32x4.sub (local.get $bottom) (local.get $top))
                (f32x4.splat (local.get $fy)))))
          (i32x4.splat (i32.const 0)))
        (i16x8.splat (i32.const 0)))))

  ;; Fixed-function stage 0 defaults to MODULATE: texture RGB is multiplied by
  ;; the Gouraud-interpolated diffuse colour produced by lighting (or supplied
  ;; by an L/TL vertex). Keep the interpolation in packed 0xAARRGGBB form so
  ;; the scan converter only carries one additional value per edge.
  (func $d3dim_color_lerp (param $a i32) (param $b i32) (param $t f32) (result i32)
    (local $va v128) (local $vb v128) (local $vr v128) (local $v16 v128)
    ;; A splatted packed pixel repeats BGRA bytes on little-endian Wasm.
    ;; Widen its first four bytes to i32 lanes, interpolate all channels with
    ;; the same f32/trunc_sat semantics as the former scalar path, then narrow
    ;; BGRA back into lane zero. Bilinear filtering calls this three times per
    ;; output pixel; doing four channels in parallel removes twelve scalar
    ;; int<->float conversions and the associated extract/repack chain.
    (local.set $va
      (i32x4.extend_low_i16x8_u
        (i16x8.extend_low_i8x16_u (i32x4.splat (local.get $a)))))
    (local.set $vb
      (i32x4.extend_low_i16x8_u
        (i16x8.extend_low_i8x16_u (i32x4.splat (local.get $b)))))
    (local.set $vr
      (i32x4.trunc_sat_f32x4_u
        (f32x4.add
          (f32x4.convert_i32x4_u (local.get $va))
          (f32x4.mul
            (f32x4.sub
              (f32x4.convert_i32x4_u (local.get $vb))
              (f32x4.convert_i32x4_u (local.get $va)))
            (f32x4.splat (local.get $t))))))
    (local.set $v16
      (i16x8.narrow_i32x4_u (local.get $vr) (i32x4.splat (i32.const 0))))
    (i32x4.extract_lane 0
      (i8x16.narrow_i16x8_u (local.get $v16) (i16x8.splat (i32.const 0)))))

  ;; Exact floor(x/255) through 65534 without integer division. Texture colour
  ;; products and the rounded convex blend numerator stay in that range.
  (func $d3dim_div255 (param $x i32) (result i32)
    (i32.shr_u
      (i32.add (i32.add (local.get $x) (i32.const 1))
               (i32.shr_u (local.get $x) (i32.const 8)))
      (i32.const 8)))

  (func $d3dim_modulate_rgb (param $tex i32) (param $diffuse i32) (result i32)
    (local $alpha i32) (local $r i32) (local $g i32) (local $b i32)
    (local.set $alpha (call $d3dim_div255
      (i32.mul (i32.shr_u (local.get $tex) (i32.const 24))
               (i32.shr_u (local.get $diffuse) (i32.const 24)))))
    (local.set $r (call $d3dim_div255
      (i32.mul (i32.and (i32.shr_u (local.get $tex) (i32.const 16)) (i32.const 0xff))
               (i32.and (i32.shr_u (local.get $diffuse) (i32.const 16)) (i32.const 0xff)))))
    (local.set $g (call $d3dim_div255
      (i32.mul (i32.and (i32.shr_u (local.get $tex) (i32.const 8)) (i32.const 0xff))
               (i32.and (i32.shr_u (local.get $diffuse) (i32.const 8)) (i32.const 0xff)))))
    (local.set $b (call $d3dim_div255
      (i32.mul (i32.and (local.get $tex) (i32.const 0xff))
               (i32.and (local.get $diffuse) (i32.const 0xff)))))
    (i32.or (i32.shl (local.get $alpha) (i32.const 24))
      (i32.or (i32.shl (local.get $r) (i32.const 16))
        (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b)))))

  ;; Store real defaults, so explicit DIFFUSE=0 is never an unset sentinel.
  ;; CURRENT=1 is diffuse at stage zero (there is no preceding stage).
  (func $d3dim_tss_init (param $state i32)
    (local $stage i32) (local $p i32)
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $stage) (i32.const 8)))
      (local.set $p (i32.add (call $g2w (local.get $state))
        (i32.add (global.get $D3DIM_OFF_TSS_STATE) (i32.shl (local.get $stage) (i32.const 5)))))
      (i32.store offset=4 (local.get $p)
        (if (result i32) (i32.eqz (local.get $stage)) (then (i32.const 4)) (else (i32.const 1))))
      (i32.store offset=8 (local.get $p) (i32.const 2))
      (i32.store offset=12 (local.get $p) (i32.const 1))
      (i32.store offset=16 (local.get $p) (i32.const 2))
      (i32.store offset=20 (local.get $p) (i32.const 2))
      (i32.store offset=24 (local.get $p) (i32.const 1))
      (local.set $stage (i32.add (local.get $stage) (i32.const 1)))
      (br $lp))))

  ;; Internal raster operation word: low byte is D3DTOP; bit 8 selects
  ;; diffuse for ARG1, bit 9 selects texture for ARG2. Raw legacy op callers
  ;; retain TEXTURE/DIFFUSE. Only exact DIFFUSE/TEXTURE and stage-0 CURRENT
  ;; are implemented; other selectors/modifiers retain the legacy fallback.
  (func $d3dim_stage_operation (param $state i32) (param $type i32) (result i32)
    (i32.or (call $d3dim_tss_load (local.get $state) (i32.const 0) (local.get $type))
      (i32.or
        (i32.shl (i32.le_u (call $d3dim_tss_load (local.get $state) (i32.const 0)
          (i32.add (local.get $type) (i32.const 1))) (i32.const 1)) (i32.const 8))
        (i32.shl (i32.eq (call $d3dim_tss_load (local.get $state) (i32.const 0)
          (i32.add (local.get $type) (i32.const 2))) (i32.const 2)) (i32.const 9)))))

  ;; D3DTOP_SELECTARG1=2, SELECTARG2=3, MODULATE=4, independent RGB/alpha.
  (func $d3dim_texture_stage_combine
    (param $tex i32) (param $diffuse i32) (param $colorop i32) (param $alphaop i32)
    (result i32)
    (local $mod i32) (local $rgb i32) (local $alpha i32) (local $arg1 i32) (local $arg2 i32)
    (local $texture_alpha i32)
    (if (i32.eq (i32.and (local.get $colorop) (i32.const 0xfffffffe)) (i32.const 0x10000))
      (then (return (call $gl_texture_combine (local.get $tex) (local.get $diffuse)
        (i32.and (local.get $colorop) (i32.const 1))))))
    (local.set $texture_alpha (i32.shr_u (local.get $tex) (i32.const 24)))
    ;; Stage-zero CURRENT is incoming diffuse RGBA. Disable precedes operand
    ;; selection and disables alpha too, regardless of ALPHAOP/argument bits.
    (if (i32.eq (i32.and (local.get $colorop) (i32.const 255)) (i32.const 1))
      (then (return (local.get $diffuse))))
    (local.set $arg1 (i32.or
      (i32.and (if (result i32) (i32.and (local.get $colorop) (i32.const 256))
        (then (local.get $diffuse)) (else (local.get $tex))) (i32.const 0x00ffffff))
      (i32.and (if (result i32) (i32.and (local.get $alphaop) (i32.const 256))
        (then (local.get $diffuse)) (else (local.get $tex))) (i32.const 0xff000000))))
    (local.set $arg2 (i32.or
      (i32.and (if (result i32) (i32.and (local.get $colorop) (i32.const 512))
        (then (local.get $tex)) (else (local.get $diffuse))) (i32.const 0x00ffffff))
      (i32.and (if (result i32) (i32.and (local.get $alphaop) (i32.const 512))
        (then (local.get $tex)) (else (local.get $diffuse))) (i32.const 0xff000000))))
    (local.set $tex (local.get $arg1))
    (local.set $diffuse (local.get $arg2))
    (local.set $colorop (i32.and (local.get $colorop) (i32.const 255)))
    (local.set $alphaop (i32.and (local.get $alphaop) (i32.const 255)))
    (if (i32.eqz (local.get $colorop)) (then (local.set $colorop (i32.const 4))))
    (if (i32.eqz (local.get $alphaop)) (then (local.set $alphaop (i32.const 4))))
    ;; Modulating by opaque white is exactly the identity: div255(x*255) == x
    ;; for every byte x, so skip the four multiplies for unlit white geometry.
    (local.set $mod (if (result i32) (i32.eq (local.get $diffuse) (i32.const -1))
      (then (local.get $tex))
      (else (call $d3dim_modulate_rgb (local.get $tex) (local.get $diffuse)))))
    (local.set $rgb (i32.and (local.get $mod) (i32.const 0x00ffffff)))
    (if (i32.eq (local.get $colorop) (i32.const 2))
      (then (local.set $rgb (i32.and (local.get $tex) (i32.const 0x00ffffff)))))
    (if (i32.eq (local.get $colorop) (i32.const 3))
      (then (local.set $rgb (i32.and (local.get $diffuse) (i32.const 0x00ffffff)))))
    ;; DX6.1 ADD: independent saturated byte sums; alpha is selected below.
    (if (i32.eq (local.get $colorop) (i32.const 7)) (then
      (local.set $rgb (i32.and
        (i32x4.extract_lane 0 (i8x16.add_sat_u
          (i32x4.splat (local.get $tex)) (i32x4.splat (local.get $diffuse))))
        (i32.const 0x00ffffff)))))
    ;; BLENDTEXTUREALPHA: ARG1 * texture alpha + ARG2 * (1 - alpha).
    ;; GL_DECAL uses this RGB operation with SELECTARG2 for primary alpha.
    (if (i32.eq (local.get $colorop) (i32.const 13))
      (then (local.set $rgb (call $d3dim_blend_rgb
        (i32.or (i32.and (local.get $tex) (i32.const 0x00ffffff))
          (i32.shl (local.get $texture_alpha) (i32.const 24)))
        (local.get $diffuse) (i32.const 5) (i32.const 6)))))
    (local.set $alpha (i32.and (local.get $mod) (i32.const 0xff000000)))
    (if (i32.eq (local.get $alphaop) (i32.const 2))
      (then (local.set $alpha (i32.and (local.get $tex) (i32.const 0xff000000)))))
    (if (i32.eq (local.get $alphaop) (i32.const 3))
      (then (local.set $alpha (i32.and (local.get $diffuse) (i32.const 0xff000000)))))
    (if (i32.eq (local.get $alphaop) (i32.const 13)) (then
      (local.set $alpha (i32.shl (call $d3dim_blend_channel
        (i32.shr_u (local.get $tex) (i32.const 24))
        (i32.shr_u (local.get $diffuse) (i32.const 24))
        (local.get $texture_alpha) (i32.const 5) (i32.const 6)) (i32.const 24)))))
    (i32.or (local.get $alpha) (local.get $rgb)))

  ;; One fixed-function framebuffer blend channel. D3DBLEND values used by
  ;; MW3 are ZERO/ONE/SRCCOLOR and SRCALPHA/INVSRCALPHA; the remaining legacy
  ;; color factors are cheap to cover here and keep the helper generally sane.
  (func $d3dim_blend_channel
    (param $src i32) (param $dst i32) (param $alpha i32)
    (param $src_blend i32) (param $dst_blend i32) (result i32)
    (local $sf i32) (local $df i32) (local $out i32) (local $numerator i32)
    (local.set $sf (i32.const 255))
    (if (i32.eq (local.get $src_blend) (i32.const 1)) (then (local.set $sf (i32.const 0))))
    (if (i32.eq (local.get $src_blend) (i32.const 3)) (then (local.set $sf (local.get $src))))
    (if (i32.eq (local.get $src_blend) (i32.const 4)) (then (local.set $sf (i32.sub (i32.const 255) (local.get $src)))))
    (if (i32.eq (local.get $src_blend) (i32.const 5)) (then (local.set $sf (local.get $alpha))))
    (if (i32.eq (local.get $src_blend) (i32.const 6)) (then (local.set $sf (i32.sub (i32.const 255) (local.get $alpha)))))
    (if (i32.eq (local.get $src_blend) (i32.const 8)) (then (local.set $sf (i32.const 0))))
    (if (i32.eq (local.get $src_blend) (i32.const 9)) (then (local.set $sf (local.get $dst))))
    (if (i32.eq (local.get $src_blend) (i32.const 10)) (then (local.set $sf (i32.sub (i32.const 255) (local.get $dst)))))
    (if (i32.eq (local.get $src_blend) (i32.const 11)) (then (local.set $sf (i32.const 0))))
    (local.set $df (i32.const 255))
    (if (i32.eq (local.get $dst_blend) (i32.const 1)) (then (local.set $df (i32.const 0))))
    (if (i32.eq (local.get $dst_blend) (i32.const 3)) (then (local.set $df (local.get $src))))
    (if (i32.eq (local.get $dst_blend) (i32.const 4)) (then (local.set $df (i32.sub (i32.const 255) (local.get $src)))))
    (if (i32.eq (local.get $dst_blend) (i32.const 5)) (then (local.set $df (local.get $alpha))))
    (if (i32.eq (local.get $dst_blend) (i32.const 6)) (then (local.set $df (i32.sub (i32.const 255) (local.get $alpha)))))
    (if (i32.eq (local.get $dst_blend) (i32.const 8)) (then (local.set $df (i32.const 0))))
    (if (i32.eq (local.get $dst_blend) (i32.const 9)) (then (local.set $df (local.get $dst))))
    (if (i32.eq (local.get $dst_blend) (i32.const 10)) (then (local.set $df (i32.sub (i32.const 255) (local.get $dst)))))
    (if (i32.eq (local.get $dst_blend) (i32.const 11)) (then (local.set $df (i32.const 0))))
    (local.set $numerator
      (i32.add (i32.mul (local.get $src) (local.get $sf))
               (i32.mul (local.get $dst) (local.get $df))))
    ;; The legacy formula rounds by adding 127, then clamps. Values at or
    ;; above 64898 therefore saturate without needing the divide.
    (if (i32.ge_u (local.get $numerator) (i32.const 64898))
      (then (return (i32.const 255))))
    (local.set $out (call $d3dim_div255
      (i32.add (local.get $numerator) (i32.const 127))))
    (local.get $out))

  (func $d3dim_blend_rgb
    (param $src i32) (param $dst i32) (param $src_blend i32) (param $dst_blend i32)
    (result i32)
    (local $alpha i32) (local $inv_alpha i32)
    (local.set $alpha (i32.shr_u (local.get $src) (i32.const 24)))
    ;; MW3's light-map pass: destination *= source colour.
    (if (i32.and (i32.eq (local.get $src_blend) (i32.const 1))
                 (i32.eq (local.get $dst_blend) (i32.const 3))) (then
      (return (i32.or
        (i32.shl (call $d3dim_div255
          (i32.mul
            (i32.and (i32.shr_u (local.get $src) (i32.const 16)) (i32.const 255))
            (i32.and (i32.shr_u (local.get $dst) (i32.const 16)) (i32.const 255))))
          (i32.const 16))
        (i32.or
          (i32.shl (call $d3dim_div255
            (i32.mul
              (i32.and (i32.shr_u (local.get $src) (i32.const 8)) (i32.const 255))
              (i32.and (i32.shr_u (local.get $dst) (i32.const 8)) (i32.const 255))))
            (i32.const 8))
          (call $d3dim_div255
            (i32.mul (i32.and (local.get $src) (i32.const 255))
                     (i32.and (local.get $dst) (i32.const 255)))))))))
    ;; MW3's alpha/fade pass. Each channel is a convex combination, so the
    ;; rounded numerator remains in the non-saturating div255 range.
    (if (i32.and (i32.eq (local.get $src_blend) (i32.const 5))
                 (i32.eq (local.get $dst_blend) (i32.const 6))) (then
      (local.set $inv_alpha (i32.sub (i32.const 255) (local.get $alpha)))
      (return (i32.or
        (i32.shl (call $d3dim_div255 (i32.add (i32.const 127)
          (i32.add
            (i32.mul (i32.and (i32.shr_u (local.get $src) (i32.const 16)) (i32.const 255)) (local.get $alpha))
            (i32.mul (i32.and (i32.shr_u (local.get $dst) (i32.const 16)) (i32.const 255)) (local.get $inv_alpha)))))
          (i32.const 16))
        (i32.or
          (i32.shl (call $d3dim_div255 (i32.add (i32.const 127)
            (i32.add
              (i32.mul (i32.and (i32.shr_u (local.get $src) (i32.const 8)) (i32.const 255)) (local.get $alpha))
              (i32.mul (i32.and (i32.shr_u (local.get $dst) (i32.const 8)) (i32.const 255)) (local.get $inv_alpha)))))
            (i32.const 8))
          (call $d3dim_div255 (i32.add (i32.const 127)
            (i32.add
              (i32.mul (i32.and (local.get $src) (i32.const 255)) (local.get $alpha))
              (i32.mul (i32.and (local.get $dst) (i32.const 255)) (local.get $inv_alpha))))))))))
    (i32.or
      (i32.shl (call $d3dim_blend_channel
        (i32.and (i32.shr_u (local.get $src) (i32.const 16)) (i32.const 255))
        (i32.and (i32.shr_u (local.get $dst) (i32.const 16)) (i32.const 255))
        (local.get $alpha) (local.get $src_blend) (local.get $dst_blend)) (i32.const 16))
      (i32.or
        (i32.shl (call $d3dim_blend_channel
          (i32.and (i32.shr_u (local.get $src) (i32.const 8)) (i32.const 255))
          (i32.and (i32.shr_u (local.get $dst) (i32.const 8)) (i32.const 255))
          (local.get $alpha) (local.get $src_blend) (local.get $dst_blend)) (i32.const 8))
        (call $d3dim_blend_channel
          (i32.and (local.get $src) (i32.const 255))
          (i32.and (local.get $dst) (i32.const 255))
          (local.get $alpha) (local.get $src_blend) (local.get $dst_blend)))))

  ;; Alpha-bearing framebuffer blending uses destination alpha and writes alpha.
  ;; Keep the established legacy ZERO/SRCCOLOR RGB truncation fast path;
  ;; the remaining RGBA channels use the same rounded byte equation as GL.
  (func $d3dim_blend_argb
    (param $src i32) (param $dst i32) (param $sf i32) (param $df i32) (result i32)
    (local $out i32)
    (local.set $out (call $gl_sw_blend_rgba
      (local.get $src) (local.get $dst) (local.get $sf) (local.get $df)))
    (if (i32.and (i32.eq (local.get $sf) (i32.const 1))
                 (i32.eq (local.get $df) (i32.const 3))) (then
      (local.set $out (i32.or (i32.and (local.get $out) (i32.const 0xff000000))
        (call $d3dim_blend_rgb
          (local.get $src) (local.get $dst) (local.get $sf) (local.get $df))))))
    (local.get $out))

  ;; D3DCMPFUNC: 1 NEVER, 2 LESS, 3 EQUAL, 4 LESSEQUAL, 5 GREATER,
  ;; 6 NOTEQUAL, 7 GREATEREQUAL, 8 ALWAYS.  Use unsigned comparisons for
  ;; packed 16/32-bit depth because both formats map [0,1] monotonically.
  (func $d3dim_depth_compare_u
    (param $incoming i32) (param $stored i32) (param $func i32) (result i32)
    ;; Hot legacy paths overwhelmingly use ALWAYS for overlays and
    ;; GREATEREQUAL for reversed depth. Keep those ahead of the uncommon
    ;; comparisons so the scalar per-pixel loop does not walk seven branches.
    (if (i32.eq (local.get $func) (i32.const 8)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $func) (i32.const 7))
      (then (return (i32.ge_u (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 4))
      (then (return (i32.le_u (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $func) (i32.const 2))
      (then (return (i32.lt_u (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 3))
      (then (return (i32.eq (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 5))
      (then (return (i32.gt_u (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 6))
      (then (return (i32.ne (local.get $incoming) (local.get $stored)))))
    (i32.const 0))

  (func $d3dim_depth_compare_f32
    (param $incoming f32) (param $stored f32) (param $func i32) (result i32)
    (if (i32.eq (local.get $func) (i32.const 8)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $func) (i32.const 7))
      (then (return (f32.ge (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 4))
      (then (return (f32.le (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $func) (i32.const 2))
      (then (return (f32.lt (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 3))
      (then (return (f32.eq (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 5))
      (then (return (f32.gt (local.get $incoming) (local.get $stored)))))
    (if (i32.eq (local.get $func) (i32.const 6))
      (then (return (f32.ne (local.get $incoming) (local.get $stored)))))
    (i32.const 0))

  ;; Quantize 0xAARRGGBB to RGB565. D3DRENDERSTATE_DITHERENABLE uses a 4x4
  ;; Bayer matrix before the low colour bits are discarded; keeping that work
  ;; in this helper leaves the overwhelmingly common non-dithered path as the
  ;; same three shifts/masks it used before.
  (func $d3dim_pack_rgb565
    (param $color i32) (param $x i32) (param $y i32)
    (result i32)
    (local $r i32) (local $g i32) (local $b i32) (local $t i32) (local $row i32)
    (local.set $r (i32.and (i32.shr_u (local.get $color) (i32.const 16)) (i32.const 0xff)))
    (local.set $g (i32.and (i32.shr_u (local.get $color) (i32.const 8)) (i32.const 0xff)))
    (local.set $b (i32.and (local.get $color) (i32.const 0xff)))
    (local.set $row (i32.and (local.get $y) (i32.const 3)))
      ;; Rows are 0,8,2,10 / 12,4,14,6 / 3,11,1,9 / 15,7,13,5.
      (if (i32.eq (local.get $row) (i32.const 0))
        (then
          (local.set $t (select (i32.const 0) (i32.const 8)
            (i32.eqz (i32.and (local.get $x) (i32.const 1)))))
          (if (i32.and (local.get $x) (i32.const 2))
            (then (local.set $t (i32.add (local.get $t) (i32.const 2))))))
        (else (if (i32.eq (local.get $row) (i32.const 1))
          (then
            (local.set $t (select (i32.const 12) (i32.const 4)
              (i32.eqz (i32.and (local.get $x) (i32.const 1)))))
            (if (i32.and (local.get $x) (i32.const 2))
              (then (local.set $t (i32.add (local.get $t) (i32.const 2))))))
          (else (if (i32.eq (local.get $row) (i32.const 2))
            (then
              (local.set $t (select (i32.const 3) (i32.const 11)
                (i32.eqz (i32.and (local.get $x) (i32.const 1)))))
              (if (i32.and (local.get $x) (i32.const 2))
                (then (local.set $t (i32.sub (local.get $t) (i32.const 2))))))
            (else
              (local.set $t (select (i32.const 15) (i32.const 7)
                (i32.eqz (i32.and (local.get $x) (i32.const 1)))))
              (if (i32.and (local.get $x) (i32.const 2))
                (then (local.set $t (i32.sub (local.get $t) (i32.const 2)))))))))))
      ;; Add a threshold in [0, step) and truncate: RGB565 steps are 8/4/8
      ;; levels, so 0-7/0-3/0-7. Do not centre it on zero -- truncation
      ;; already rounds down, and a centred threshold is half a step dark on
      ;; average and moves exactly-representable pixels. MW3's ZERO/SRCCOLOR
      ;; light-map passes read the 565 target back and repack it, so each
      ;; pass lost a step and dark brown terrain came out olive.
      (local.set $r (i32.add (local.get $r) (i32.shr_s (local.get $t) (i32.const 1))))
      (local.set $g (i32.add (local.get $g) (i32.shr_s (local.get $t) (i32.const 2))))
      (local.set $b (i32.add (local.get $b) (i32.shr_s (local.get $t) (i32.const 1))))
      (if (i32.lt_s (local.get $r) (i32.const 0)) (then (local.set $r (i32.const 0))))
      (if (i32.gt_s (local.get $r) (i32.const 255)) (then (local.set $r (i32.const 255))))
      (if (i32.lt_s (local.get $g) (i32.const 0)) (then (local.set $g (i32.const 0))))
      (if (i32.gt_s (local.get $g) (i32.const 255)) (then (local.set $g (i32.const 255))))
      (if (i32.lt_s (local.get $b) (i32.const 0)) (then (local.set $b (i32.const 0))))
    (if (i32.gt_s (local.get $b) (i32.const 255)) (then (local.set $b (i32.const 255))))
    (i32.or
      (i32.or
        (i32.shl (i32.shr_u (local.get $r) (i32.const 3)) (i32.const 11))
        (i32.shl (i32.shr_u (local.get $g) (i32.const 2)) (i32.const 5)))
      (i32.shr_u (local.get $b) (i32.const 3))))

  ;; D3DRENDERSTATE_ALPHAFUNC against D3DRENDERSTATE_ALPHAREF, D3DCMPFUNC
  ;; numbering. This is the other way a fixed-function sprite gets its
  ;; transparency, and the one Diablo II uses: no colour key anywhere, just
  ;; ALPHAFUNC=NOTEQUAL with ALPHAREF=0 over A1R5G5B5 textures, so a texel
  ;; whose alpha bit is clear is discarded rather than painted.
  (func $d3dim_alpha_pass (param $alpha i32) (param $func i32) (param $ref i32) (result i32)
    (if (i32.eq (local.get $func) (i32.const 1)) (then (return (i32.const 0))))   ;; NEVER
    (if (i32.eq (local.get $func) (i32.const 2))
      (then (return (i32.lt_u (local.get $alpha) (local.get $ref)))))             ;; LESS
    (if (i32.eq (local.get $func) (i32.const 3))
      (then (return (i32.eq (local.get $alpha) (local.get $ref)))))               ;; EQUAL
    (if (i32.eq (local.get $func) (i32.const 4))
      (then (return (i32.le_u (local.get $alpha) (local.get $ref)))))             ;; LESSEQUAL
    (if (i32.eq (local.get $func) (i32.const 5))
      (then (return (i32.gt_u (local.get $alpha) (local.get $ref)))))             ;; GREATER
    (if (i32.eq (local.get $func) (i32.const 6))
      (then (return (i32.ne (local.get $alpha) (local.get $ref)))))               ;; NOTEQUAL
    (if (i32.eq (local.get $func) (i32.const 7))
      (then (return (i32.ge_u (local.get $alpha) (local.get $ref)))))             ;; GREATEREQUAL
    (i32.const 1))                                                               ;; ALWAYS / unset

  ;; $alpha_test is 0 when D3DRENDERSTATE_ALPHATESTENABLE is off, else
  ;; ALPHAFUNC | ALPHAREF<<8 -- packed so this signature and
  ;; $rasterize_triangle_textured's keep one parameter for the whole state.
  ;; Native index identity for ordinary point-sampled DirectDraw textures.
  ;; Match the prepared sampler's non-finite canonicalization and addressing;
  ;; never infer index membership from expanded RGB or palette alpha.
  (func $d3dim_point_index
    (param $tw i32) (param $th i32) (param $pitch i32) (param $dib i32)
    (param $u f32) (param $v f32) (param $au i32) (param $av i32) (result i32)
    (local $x i32) (local $y i32)
    (if (f32.ne (f32.mul (local.get $u) (f32.const 0.0)) (f32.const 0.0))
      (then (local.set $u (f32.const 0.0))))
    (if (f32.ne (f32.mul (local.get $v) (f32.const 0.0)) (f32.const 0.0))
      (then (local.set $v (f32.const 0.0))))
    (local.set $x (call $d3dim_address_texel
      (i32.trunc_sat_f32_s (f32.floor (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw)))))
      (local.get $tw) (local.get $au)))
    (local.set $y (call $d3dim_address_texel
      (i32.trunc_sat_f32_s (f32.floor (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th)))))
      (local.get $th) (local.get $av)))
    (i32.load8_u (i32.add (local.get $dib)
      (i32.add (i32.mul (local.get $y) (local.get $pitch)) (local.get $x)))))

  ;; Native key mask of the four fetched P8 taps, including zero-weight ones.
  ;; Only the uniform endpoints (0 and 15) settle opaque FALSE-mode keying;
  ;; mixed masks do not define a rejection policy.
  (func $d3dim_filter_key_mask
    (param $tw i32) (param $th i32) (param $pitch i32) (param $dib i32)
    (param $u f32) (param $v f32) (param $au i32) (param $av i32)
    (param $key i32) (result i32)
    (local $x0 i32) (local $x1 i32) (local $y0 i32) (local $y1 i32)
    (if (f32.ne (f32.mul (local.get $u) (f32.const 0.0)) (f32.const 0.0))
      (then (local.set $u (f32.const 0.0))))
    (if (f32.ne (f32.mul (local.get $v) (f32.const 0.0)) (f32.const 0.0))
      (then (local.set $v (f32.const 0.0))))
    (local.set $x0 (i32.trunc_sat_f32_s (f32.floor
      (f32.sub (f32.mul (local.get $u) (f32.convert_i32_u (local.get $tw))) (f32.const 0.5)))))
    (local.set $y0 (i32.trunc_sat_f32_s (f32.floor
      (f32.sub (f32.mul (local.get $v) (f32.convert_i32_u (local.get $th))) (f32.const 0.5)))))
    (local.set $x1 (call $d3dim_address_texel (i32.add (local.get $x0) (i32.const 1)) (local.get $tw) (local.get $au)))
    (local.set $y1 (call $d3dim_address_texel (i32.add (local.get $y0) (i32.const 1)) (local.get $th) (local.get $av)))
    (local.set $x0 (call $d3dim_address_texel (local.get $x0) (local.get $tw) (local.get $au)))
    (local.set $y0 (call $d3dim_address_texel (local.get $y0) (local.get $th) (local.get $av)))
    (local.set $y0 (i32.add (local.get $dib) (i32.mul (local.get $y0) (local.get $pitch))))
    (local.set $y1 (i32.add (local.get $dib) (i32.mul (local.get $y1) (local.get $pitch))))
    (i32.or
      (i32.or
        (i32.eq (i32.load8_u (i32.add (local.get $y0) (local.get $x0))) (local.get $key))
        (i32.shl (i32.eq (i32.load8_u (i32.add (local.get $y0) (local.get $x1))) (local.get $key)) (i32.const 1)))
      (i32.or
        (i32.shl (i32.eq (i32.load8_u (i32.add (local.get $y1) (local.get $x0))) (local.get $key)) (i32.const 2))
        (i32.shl (i32.eq (i32.load8_u (i32.add (local.get $y1) (local.get $x1))) (local.get $key)) (i32.const 3)))))

  (func $d3dim_filter_has_key_index
    (param $tw i32) (param $th i32) (param $pitch i32) (param $dib i32)
    (param $u f32) (param $v f32) (param $au i32) (param $av i32)
    (param $key i32) (result i32)
    (i32.ne (call $d3dim_filter_key_mask
      (local.get $tw) (local.get $th) (local.get $pitch) (local.get $dib)
      (local.get $u) (local.get $v) (local.get $au) (local.get $av)
      (local.get $key)) (i32.const 0)))

  ;; Only a live, correctly halved texture attachment is a mip successor.
  ;; Strictly decreasing dimensions prohibit cycles; 16 levels cover the
  ;; packed 16-bit surface dimensions. Truncated/malformed chains clamp at
  ;; their last valid level. Never walk flip/depth attachments as mip levels.
  (func $d3dim_mip_next (param $e i32) (result i32)
    (local $obj i32) (local $n i32) (local $w i32) (local $h i32)
    (local $bpp i32) (local $bytes i32) (local $dib i32)
    (if (i32.eqz (i32.and (i32.load (call $dx_surf_meta_ptr (local.get $e))) (i32.const 0x400000)))
      (then (return (i32.const 0))))
    (local.set $w (i32.load16_u offset=12 (local.get $e)))
    (local.set $h (i32.load16_u offset=14 (local.get $e)))
    (if (i32.and (i32.eq (local.get $w) (i32.const 1)) (i32.eq (local.get $h) (i32.const 1)))
      (then (return (i32.const 0))))
    (local.set $obj (load.field DxObject misc0 (local.get $e)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    ;; The link is emulator-owned guest COM storage, not a surface slot.
    (local.set $n (call $ddraw_surface_entry_checked (local.get $obj)))
    (if (i32.eqz (local.get $n))
      (then (return (i32.const 0))))
    (if (i32.or
      (i32.ne (i32.load16_u offset=12 (local.get $n))
        (select (i32.shr_u (local.get $w) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $w) (i32.const 1))))
      (i32.ne (i32.load16_u offset=14 (local.get $n))
        (select (i32.shr_u (local.get $h) (i32.const 1)) (i32.const 1) (i32.gt_u (local.get $h) (i32.const 1)))))
      (then (return (i32.const 0))))
    (local.set $bpp (i32.load16_u offset=16 (local.get $n)))
    (if (i32.eqz (i32.or (i32.eq (local.get $bpp) (i32.const 8))
          (i32.or (i32.eq (local.get $bpp) (i32.const 16)) (i32.eq (local.get $bpp) (i32.const 32)))))
      (then (return (i32.const 0))))
    (local.set $dib (i32.load offset=20 (local.get $n)))
    (local.set $bytes (i32.mul (i32.load16_u offset=18 (local.get $n)) (i32.load16_u offset=14 (local.get $n))))
    (if (i32.or (i32.ge_u (local.get $dib) (i32.shl (memory.size) (i32.const 16)))
          (i32.gt_u (local.get $bytes) (i32.sub (i32.shl (memory.size) (i32.const 16)) (local.get $dib))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.eqz (i32.load offset=20 (local.get $n)))
      (i32.lt_u (i32.load16_u offset=18 (local.get $n))
        (i32.mul (i32.load16_u offset=12 (local.get $n))
          (i32.shr_u (i32.load16_u offset=16 (local.get $n)) (i32.const 3)))))
      (then (return (i32.const 0))))
    (local.get $n))

  (func $d3dim_mip_sample_level
    (param $e i32) (param $u f32) (param $v f32)
    (param $au i32) (param $av i32) (param $linear i32) (param $key_blend i32) (result i32)
    (local $key i32) (local $enabled i32) (local $bpp i32)
    ;; DX7 explicit COLORKEYBLENDENABLE substitutes each matching tap with
    ;; zero RGBA before spatial filtering and inter-level interpolation.
    ;; Every mip image owns its key, palette, format and pitch metadata.
    (local.set $bpp (i32.load16_u offset=16 (local.get $e)))
    (local.set $enabled (i32.and (local.get $key_blend)
      (i32.ne (i32.and (i32.load offset=28 (local.get $e)) (i32.const 0x100)) (i32.const 0))))
    ;; Key inheritance from a keyed root to an unkeyed child is not resolved.
    ;; Only explicitly keyed sampled images are supported by this extension.
    (if (i32.and (local.get $key_blend) (i32.eqz (local.get $enabled)))
      (then (call $crash_unimplemented (region.addr $D3DIM_AUX 0x40))))
    (if (local.get $enabled) (then
      ;; Do not infer alpha-palette/key precedence for a child level.
      (if (call $dx_surf_pal_alpha (local.get $e)) (then (unreachable)))
      (local.set $key (i32.load offset=24 (local.get $e)))
      (if (i32.ne (local.get $bpp) (i32.const 8)) (then
        (local.set $key (i32.and (call $d3dim_decode_surface_pixel
          (local.get $e) (local.get $key) (local.get $bpp)) (i32.const 0x00ffffff)))))))
    (call $d3dim_texture_sample_keyed
      (i32.load16_u offset=12 (local.get $e)) (i32.load16_u offset=14 (local.get $e))
      (i32.load16_u offset=16 (local.get $e)) (i32.load16_u offset=18 (local.get $e))
      (i32.load offset=20 (local.get $e)) (call $dx_surf_fmt_get (local.get $e))
      (call $dx_surf_pal_get (local.get $e)) (call $dx_surf_pal_alpha (local.get $e))
      (local.get $u) (local.get $v) (local.get $au) (local.get $av) (local.get $linear)
      (local.get $enabled) (local.get $key)))

  (func $d3dim_mip_sample
    (param $e i32) (param $x i32) (param $y i32)
    (param $au i32) (param $av i32) (param $sample_u f32) (param $sample_v f32)
    (param $key_blend i32) (result i32)
    (local $u f32) (local $v f32) (local $q f32) (local $fx f32) (local $fy f32)
    (local $dxu f32) (local $dxv f32) (local $dyu f32) (local $dyv f32)
    (local $rho2 f32) (local $lod f32) (local $frac f32)
    (local $linear i32) (local $level i32) (local $i i32) (local $n i32) (local $c i32)
    (global.set $d3dim_mip_effective_linear (global.get $d3dim_mip_mag))
    (local.set $fx (f32.convert_i32_s (local.get $x)))
    (local.set $fy (f32.convert_i32_s (local.get $y)))
    (local.set $u (f32.add (global.get $d3dim_mip_uc) (f32.add (f32.mul (global.get $d3dim_mip_ua) (local.get $fx)) (f32.mul (global.get $d3dim_mip_ub) (local.get $fy)))))
    (local.set $v (f32.add (global.get $d3dim_mip_vc) (f32.add (f32.mul (global.get $d3dim_mip_va) (local.get $fx)) (f32.mul (global.get $d3dim_mip_vb) (local.get $fy)))))
    (local.set $q (f32.add (global.get $d3dim_mip_qc) (f32.add (f32.mul (global.get $d3dim_mip_qa) (local.get $fx)) (f32.mul (global.get $d3dim_mip_qb) (local.get $fy)))))
    ;; Invalid/singular projective coordinates take level zero, matching the
    ;; existing bounded coordinate policy; they must never trap in log/trunc.
    (if (i32.eqz (f32.gt (f32.abs (local.get $q)) (f32.const 0.000000000001)))
      (then (return (call $d3dim_mip_sample_level (local.get $e) (f32.const 0) (f32.const 0)
        (local.get $au) (local.get $av) (global.get $d3dim_mip_mag) (local.get $key_blend)))))
    (local.set $u (f32.div (local.get $u) (local.get $q)))
    (local.set $v (f32.div (local.get $v) (local.get $q)))
    (local.set $dxu (f32.mul (f32.div (f32.sub (global.get $d3dim_mip_ua) (f32.mul (local.get $u) (global.get $d3dim_mip_qa))) (local.get $q)) (f32.convert_i32_u (i32.load16_u offset=12 (local.get $e)))))
    (local.set $dxv (f32.mul (f32.div (f32.sub (global.get $d3dim_mip_va) (f32.mul (local.get $v) (global.get $d3dim_mip_qa))) (local.get $q)) (f32.convert_i32_u (i32.load16_u offset=14 (local.get $e)))))
    (local.set $dyu (f32.mul (f32.div (f32.sub (global.get $d3dim_mip_ub) (f32.mul (local.get $u) (global.get $d3dim_mip_qb))) (local.get $q)) (f32.convert_i32_u (i32.load16_u offset=12 (local.get $e)))))
    (local.set $dyv (f32.mul (f32.div (f32.sub (global.get $d3dim_mip_vb) (f32.mul (local.get $v) (global.get $d3dim_mip_qb))) (local.get $q)) (f32.convert_i32_u (i32.load16_u offset=14 (local.get $e)))))
    (local.set $rho2 (f32.max
      (f32.add (f32.mul (local.get $dxu) (local.get $dxu)) (f32.mul (local.get $dxv) (local.get $dxv)))
      (f32.add (f32.mul (local.get $dyu) (local.get $dyu)) (f32.mul (local.get $dyv) (local.get $dyv)))))
    (local.set $linear (global.get $d3dim_mip_mag))
    (if (f32.gt (local.get $rho2) (f32.const 1)) (then
      (local.set $linear (global.get $d3dim_mip_min))
      (if (global.get $d3dim_mip_mip) (then
        ;; Reuse the production shader sampler's bounded log2 approximation.
        (local.set $lod (f32.min (f32.const 15) (f32.mul (f32.const 0.5)
          (f32x4.extract_lane 0 (call $d3d_shader_vm_log2 (f32x4.splat (local.get $rho2)))))))
        (if (i32.eq (global.get $d3dim_mip_mip) (i32.const 1))
          (then (local.set $level (i32.trunc_sat_f32_u (f32.add (local.get $lod) (f32.const 0.5)))))
          (else
            (local.set $level (i32.trunc_sat_f32_u (local.get $lod)))
            (local.set $frac (f32.sub (local.get $lod) (f32.floor (local.get $lod))))))))))
    (block $last (loop $walk
      (br_if $last (i32.ge_u (local.get $i) (local.get $level)))
      (local.set $n (call $d3dim_mip_next (local.get $e)))
      (br_if $last (i32.eqz (local.get $n)))
      (local.set $e (local.get $n))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $walk)))
    (global.set $d3dim_mip_effective_linear (local.get $linear))
    ;; Retain the established edge/span lookup interpolation, including its
    ;; level-zero rounding. Derivatives come from unrounded triangle planes.
    (local.set $c (call $d3dim_mip_sample_level (local.get $e) (local.get $sample_u) (local.get $sample_v)
      (local.get $au) (local.get $av) (local.get $linear) (local.get $key_blend)))
    (if (i32.and (f32.gt (local.get $frac) (f32.const 0)) (i32.eq (local.get $i) (local.get $level)))
      (then
        (local.set $n (call $d3dim_mip_next (local.get $e)))
        (if (local.get $n) (then
          (local.set $c (call $d3dim_color_lerp (local.get $c)
            (call $d3dim_mip_sample_level (local.get $n) (local.get $sample_u) (local.get $sample_v)
              (local.get $au) (local.get $av) (local.get $linear) (local.get $key_blend)) (local.get $frac)))))))
    (local.get $c))

  ;; Native D3D triangle sampler state. Never enabled by GL/Glide or GPU
  ;; descriptors. Planes carry U=u*rhw, V=v*rhw, Q=rhw; quotient-rule
  ;; derivatives are evaluated at each fragment, before address wrapping.
  (global $d3dim_mip_on (mut i32) (i32.const 0))
  (global $d3dim_mip_min (mut i32) (i32.const 0))
  (global $d3dim_mip_mag (mut i32) (i32.const 0))
  (global $d3dim_mip_mip (mut i32) (i32.const 0))
  (global $d3dim_mip_effective_linear (mut i32) (i32.const 0))
  (global $d3dim_mip_ua (mut f32) (f32.const 0))
  (global $d3dim_mip_ub (mut f32) (f32.const 0))
  (global $d3dim_mip_uc (mut f32) (f32.const 0))
  (global $d3dim_mip_va (mut f32) (f32.const 0))
  (global $d3dim_mip_vb (mut f32) (f32.const 0))
  (global $d3dim_mip_vc (mut f32) (f32.const 0))
  (global $d3dim_mip_qa (mut f32) (f32.const 0))
  (global $d3dim_mip_qb (mut f32) (f32.const 0))
  (global $d3dim_mip_qc (mut f32) (f32.const 0))

  (func $viewport_draw_textured_span
    (param $rt_entry i32) (param $tex_entry i32)
    (param $blend i32) (param $src_blend i32) (param $dst_blend i32)
    (param $address_u i32) (param $address_v i32) (param $linear i32)
    (param $colorop i32) (param $alphaop i32) (param $color_key_enable i32)
    (param $alpha_test i32)
    (param $dither i32) (param $antialias i32)
    (param $y i32)
    (param $x0 i32) (param $u0 f32) (param $v0 f32) (param $q0 f32) (param $c0 i32) (param $z0 f32)
    (param $x1 i32) (param $u1 f32) (param $v1 f32) (param $q1 f32) (param $c1 i32) (param $z1 f32)
    (param $zbuf_guest i32) (param $zfunc i32) (param $zwrite i32)
    (local $sw i32) (local $sh i32) (local $bpp i32) (local $pitch i32) (local $dib_wa i32)
    (local $tx i32) (local $xs i32) (local $xe i32) (local $x i32)
    (local $tu f32) (local $tv f32) (local $tq f32) (local $tz f32)
    (local $den f32) (local $invden f32) (local $t f32)
    (local $color i32) (local $sample i32) (local $diffuse i32) (local $dst i32) (local $px16 i32) (local $row_wa i32) (local $ptr i32)
    (local $zbuf_wa i32) (local $zentry i32) (local $zdib i32) (local $zpitch i32) (local $zbpp i32)
    (local $zptr i32) (local $zraw i32) (local $draw i32) (local $ztest f32) (local $combined i32)
    (local $stencil_pass i32)
    (local $tw i32) (local $th i32) (local $tbpp i32) (local $tpitch i32)
    (local $tdib i32) (local $tfmt i32) (local $tpal i32) (local $tpal_alpha i32)
    (local $key_active i32) (local $key_rgb i32) (local $key_index_mode i32) (local $key_index i32)
    (local $key_blend i32) (local $sample_key i32)
    (local $fast16 i32) (local $wmask i32) (local $hmask i32) (local $twf f32) (local $thf f32)
    (local $sx f32) (local $sy f32) (local $flx f32) (local $fly f32)
    (local $wx i32) (local $wy i32) (local $ix0 i32) (local $ix1 i32) (local $iy0 i32) (local $iy1 i32)
    (local $rtfmt i32) (local $rt555 i32) (local $rtalpha i32)
    (local $trow0 i32) (local $trow1 i32) (local $pv v128) (local $cv v128) (local $hv v128)
    (local.set $sw (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 12))) (i32.const 16)))
    (if (i32.or (i32.lt_s (local.get $y) (i32.const 0)) (i32.ge_s (local.get $y) (local.get $sh)))
      (then (return)))
    (if (i32.gt_s (local.get $x0) (local.get $x1)) (then
      (local.set $tx (local.get $x0))
      (local.set $tu (local.get $u0))
      (local.set $tv (local.get $v0))
      (local.set $tq (local.get $q0))
      (local.set $tz (local.get $z0))
      (local.set $diffuse (local.get $c0))
      (local.set $x0 (local.get $x1))
      (local.set $u0 (local.get $u1))
      (local.set $v0 (local.get $v1))
      (local.set $q0 (local.get $q1))
      (local.set $z0 (local.get $z1))
      (local.set $c0 (local.get $c1))
      (local.set $x1 (local.get $tx))
      (local.set $u1 (local.get $tu))
      (local.set $v1 (local.get $tv))
      (local.set $q1 (local.get $tq))
      (local.set $z1 (local.get $tz))
      (local.set $c1 (local.get $diffuse))))
    (if (i32.or (i32.lt_s (local.get $x1) (i32.const 0)) (i32.ge_s (local.get $x0) (local.get $sw)))
      (then (return)))
    (local.set $bpp (i32.and (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 0xFFFF)))
    (local.set $pitch (i32.shr_u (i32.load (i32.add (local.get $rt_entry) (i32.const 16))) (i32.const 16)))
    (local.set $dib_wa (i32.load (i32.add (local.get $rt_entry) (i32.const 20))))
    (if (i32.eqz (local.get $dib_wa)) (then (return)))
    (local.set $rtfmt (call $dx_surf_fmt_get (local.get $rt_entry)))
    (local.set $rtalpha (i32.or
      (i32.or (i32.eq (local.get $rtfmt) (i32.const 3))
              (i32.eq (local.get $rtfmt) (i32.const 4)))
      (i32.eq (local.get $rtfmt) (i32.const 5))))
    (local.set $rt555 (i32.and (i32.eq (local.get $bpp) (i32.const 16))
      (i32.or (i32.eq (local.get $rtfmt) (i32.const 2)) (i32.eq (local.get $rtfmt) (i32.const 3)))))
    (local.set $tw (i32.load16_u offset=12 (local.get $tex_entry)))
    (local.set $th (i32.load16_u offset=14 (local.get $tex_entry)))
    (local.set $tbpp (i32.load16_u offset=16 (local.get $tex_entry)))
    (local.set $tpitch (i32.load16_u offset=18 (local.get $tex_entry)))
    (local.set $tdib (i32.load offset=20 (local.get $tex_entry)))
    (if (i32.or (i32.or (i32.eqz (local.get $tw)) (i32.eqz (local.get $th)))
                (i32.or (i32.eqz (local.get $tpitch)) (i32.eqz (local.get $tdib))))
      (then (return)))
    (local.set $tfmt (call $dx_surf_fmt_get (local.get $tex_entry)))
    (if (i32.eq (local.get $tbpp) (i32.const 8))
      (then (local.set $tpal (call $dx_surf_pal_get (local.get $tex_entry)))
        (local.set $tpal_alpha (call $dx_surf_pal_alpha (local.get $tex_entry)))))
    (local.set $key_active
      (i32.and
        (i32.ne (local.get $color_key_enable) (i32.const 0))
        (i32.ne
          (i32.and (i32.load offset=28 (local.get $tex_entry)) (i32.const 0x100))
          (i32.const 0))))
    ;; FALSE/untouched state144 filtered-key semantics remain unresolved.
    ;; Preserve the named failure for that combination; explicit TRUE below
    ;; follows the Microsoft DX7 sample-replacement contract.
    (if (i32.and (i32.and (local.get $key_active)
          (i32.ne (local.get $color_key_enable) (i32.const 2)))
          (i32.and (global.get $d3dim_mip_on) (i32.ne (global.get $d3dim_mip_mip) (i32.const 0))))
      (then (call $crash_unimplemented (region.addr $D3DIM_AUX 0x40))))
    (if (local.get $key_active) (then
      (local.set $key_rgb (call $d3dim_decode_surface_pixel
        (local.get $tex_entry) (i32.load offset=24 (local.get $tex_entry)) (local.get $tbpp)))))
    (local.set $key_blend (i32.and (local.get $key_active)
      (i32.eq (local.get $color_key_enable) (i32.const 2))))
    ;; Alpha-palette/key precedence has no established contract. Fail visibly
    ;; only for an effective explicitly enabled keyed draw; unkeyed alpha works.
    (if (i32.and (local.get $key_blend) (i32.ne (local.get $tpal_alpha) (i32.const 0)))
      (then (unreachable)))
    (local.set $sample_key (select (i32.load offset=24 (local.get $tex_entry))
      (i32.and (local.get $key_rgb) (i32.const 0x00ffffff))
      (i32.eq (local.get $tbpp) (i32.const 8))))
    ;; This bounded identity path excludes alpha-palette keying.
    ;; GL_CLAMP's border taps have no native texture index.
    (local.set $key_index_mode (i32.and (local.get $key_active)
      (i32.and (i32.eq (local.get $tbpp) (i32.const 8))
          (i32.and (i32.eqz (local.get $tpal_alpha))
            (i32.and (i32.ne (local.get $address_u) (i32.const 0x2900))
                     (i32.ne (local.get $address_v) (i32.const 0x2900)))))))
    (if (local.get $key_index_mode) (then
      (local.set $key_index (i32.load offset=24 (local.get $tex_entry)))))
    ;; Inline sampler for the common case: bilinear, a 16-bit 565/555/1555
    ;; texture, WRAP on both axes and power-of-two sizes. Same arithmetic as
    ;; $d3dim_texture_sample_prepared -> $d3dim_bilerp, so the same pixels,
    ;; but the four texels are decoded together in one i32x4 and the pixel
    ;; costs no calls. Everything else keeps the general sampler.
    (local.set $wmask (i32.sub (local.get $tw) (i32.const 1)))
    (local.set $hmask (i32.sub (local.get $th) (i32.const 1)))
    (local.set $fast16
      (i32.and
        (i32.and (i32.ne (local.get $linear) (i32.const 0))
                 (i32.eq (local.get $tbpp) (i32.const 16)))
        (i32.and (i32.ge_u (local.get $tfmt) (i32.const 1))
                 (i32.le_u (local.get $tfmt) (i32.const 3)))))
    ;; GL_CLAMP must preserve border filter taps, including for 16-bit images.
    (local.set $fast16 (i32.and (local.get $fast16)
      (i32.and (i32.ne (local.get $address_u) (i32.const 0x2900))
               (i32.ne (local.get $address_v) (i32.const 0x2900)))))
    (local.set $fast16
      (i32.and (local.get $fast16)
        (i32.and
          (i32.and (i32.ne (local.get $address_u) (i32.const 2)) (i32.ne (local.get $address_u) (i32.const 3)))
          (i32.and (i32.ne (local.get $address_v) (i32.const 2)) (i32.ne (local.get $address_v) (i32.const 3))))))
    (local.set $fast16
      (i32.and (local.get $fast16)
        (i32.and (i32.eqz (i32.and (local.get $tw) (local.get $wmask)))
                 (i32.eqz (i32.and (local.get $th) (local.get $hmask))))))
    ;; Explicit key blending must replace each tap before the filter. Route
    ;; this bounded mode through the general keyed sampler, including 565.
    (local.set $fast16 (i32.and (local.get $fast16) (i32.eqz (local.get $key_blend))))
    (local.set $twf (f32.convert_i32_u (local.get $tw)))
    (local.set $thf (f32.convert_i32_u (local.get $th)))
    (local.set $xs (local.get $x0))
    (local.set $xe (local.get $x1))
    ;; Raster coverage is right-exclusive.  Sampling the geometric endpoint
    ;; made a screen-aligned 0..128 quad draw pixel 128 with u=1.0; WRAP then
    ;; aliases that sample to texture column zero, leaving an opaque vertical
    ;; seam beside otherwise transparent HUD fades (MCM's race overlay).
    ;; Preserve a one-pixel/degenerate span while excluding the far endpoint
    ;; from every span that has positive width.
    (if (i32.gt_s (local.get $xe) (local.get $xs))
      (then (local.set $xe (i32.sub (local.get $xe) (i32.const 1)))))
    (if (i32.lt_s (local.get $xs) (i32.const 0)) (then (local.set $xs (i32.const 0))))
    (if (i32.ge_s (local.get $xe) (local.get $sw)) (then (local.set $xe (i32.sub (local.get $sw) (i32.const 1)))))
    (if (global.get $d3dim_clip_on) (then
      (if (call $d3dim_clip_row_out (local.get $y)) (then (return)))
      (if (i32.lt_s (local.get $xs) (global.get $d3dim_clip_x0))
        (then (local.set $xs (global.get $d3dim_clip_x0))))
      (if (i32.ge_s (local.get $xe) (global.get $d3dim_clip_x1))
        (then (local.set $xe (i32.sub (global.get $d3dim_clip_x1) (i32.const 1)))))))
    (if (i32.lt_s (local.get $xe) (local.get $xs)) (then (return)))
    (call $d3dim_exec_extent_draw (local.get $rt_entry) (local.get $xs) (local.get $y)
      (i32.add (i32.sub (local.get $xe) (local.get $xs)) (i32.const 1)) (i32.const 1))
    (local.set $den (f32.convert_i32_s (i32.sub (local.get $x1) (local.get $x0))))
    (if (f32.eq (local.get $den) (f32.const 0.0)) (then (local.set $den (f32.const 1.0))))
    (local.set $invden (f32.div (f32.const 1.0) (local.get $den)))
    (if (local.get $zbuf_guest) (then
      (if (i32.and
            (i32.ge_u (local.get $zbuf_guest) (global.get $DX_OBJECTS))
            (i32.lt_u (local.get $zbuf_guest)
              (i32.add (global.get $DX_OBJECTS) (global.get $DX_OBJECTS_SIZE))))
        (then
          (local.set $zentry (local.get $zbuf_guest))
          (local.set $zdib (i32.load offset=20 (local.get $zentry)))
          (local.set $zpitch (i32.load16_u offset=18 (local.get $zentry)))
          (local.set $zbpp (i32.load16_u offset=16 (local.get $zentry))))
        (else (local.set $zbuf_wa (call $g2w (local.get $zbuf_guest)))))))
    (local.set $row_wa (i32.add (local.get $dib_wa) (i32.mul (local.get $y) (local.get $pitch))))
    (local.set $x (local.get $xs))
    (block $done (loop $lp
      (br_if $done (i32.gt_s (local.get $x) (local.get $xe)))
      (local.set $t (f32.mul
        (f32.convert_i32_s (i32.sub (local.get $x) (local.get $x0)))
        (local.get $invden)))
      (local.set $tu (f32.add (local.get $u0) (f32.mul (f32.sub (local.get $u1) (local.get $u0)) (local.get $t))))
      (local.set $tv (f32.add (local.get $v0) (f32.mul (f32.sub (local.get $v1) (local.get $v0)) (local.get $t))))
      (local.set $tq (f32.add (local.get $q0) (f32.mul (f32.sub (local.get $q1) (local.get $q0)) (local.get $t))))
      (if (global.get $d3dim_sample_on) (then
        (local.set $tu (f32.add (global.get $d3dim_sample_uc)
          (f32.add (f32.mul (global.get $d3dim_sample_ua) (f32.convert_i32_s (local.get $x)))
            (f32.mul (global.get $d3dim_sample_ub) (f32.convert_i32_s (local.get $y))))))
        (local.set $tv (f32.add (global.get $d3dim_sample_vc)
          (f32.add (f32.mul (global.get $d3dim_sample_va) (f32.convert_i32_s (local.get $x)))
            (f32.mul (global.get $d3dim_sample_vb) (f32.convert_i32_s (local.get $y))))))
        (local.set $tq (f32.add (global.get $d3dim_sample_qc)
          (f32.add (f32.mul (global.get $d3dim_sample_qa) (f32.convert_i32_s (local.get $x)))
            (f32.mul (global.get $d3dim_sample_qb) (f32.convert_i32_s (local.get $y))))))))
      (if (global.get $rast_t0_q_on) (then
        (local.set $tq (f32.add (global.get $rast_t0_qc)
          (f32.add (f32.mul (global.get $rast_t0_qa) (f32.convert_i32_s (local.get $x)))
            (f32.mul (global.get $rast_t0_qb) (f32.convert_i32_s (local.get $y))))))))
      (if (f32.gt (f32.abs (local.get $tq)) (f32.const 0.000000000001)) (then
        (local.set $tu (f32.div (local.get $tu) (local.get $tq)))
        (local.set $tv (f32.div (local.get $tv) (local.get $tq)))))
      (local.set $tz (f32.add (local.get $z0) (f32.mul (f32.sub (local.get $z1) (local.get $z0)) (local.get $t))))
      (if (global.get $d3dim_sample_on) (then
        (local.set $tz (f32.add (global.get $d3dim_sample_zc)
          (f32.add (f32.mul (global.get $d3dim_sample_za) (f32.convert_i32_s (local.get $x)))
            (f32.mul (global.get $d3dim_sample_zb) (f32.convert_i32_s (local.get $y))))))))
      ;; A lerp between equal colours is that colour exactly, so a span with
      ;; one vertex colour (flat or unlit geometry) needs no per-pixel lerp.
      (local.set $diffuse (if (result i32) (i32.eq (local.get $c0) (local.get $c1))
        (then (local.get $c0))
        (else (call $d3dim_color_lerp (local.get $c0) (local.get $c1) (local.get $t)))))
      ;; Correct RGB placement while retaining the existing span alpha.
      (if (global.get $d3dim_color_on) (then
        (local.set $diffuse (i32.or
          (i32.and (local.get $diffuse) (i32.const 0xFF000000))
          (call $d3dim_sample_color (local.get $x) (local.get $y))))))
      (if (global.get $d3dim_mip_on)
        (then
          (local.set $sample (call $d3dim_mip_sample (local.get $tex_entry)
            (local.get $x) (local.get $y) (local.get $address_u) (local.get $address_v)
            (local.get $tu) (local.get $tv) (local.get $key_blend)))
          (local.set $linear (global.get $d3dim_mip_effective_linear)))
        (else
      (if (local.get $fast16)
        (then
          ;; Non-finite coordinates select texel zero, as in the general path.
          (local.set $sx (local.get $tu))
          (if (f32.ne (f32.mul (local.get $sx) (f32.const 0.0)) (f32.const 0.0))
            (then (local.set $sx (f32.const 0.0))))
          (local.set $sy (local.get $tv))
          (if (f32.ne (f32.mul (local.get $sy) (f32.const 0.0)) (f32.const 0.0))
            (then (local.set $sy (f32.const 0.0))))
          (local.set $sx (f32.sub (f32.mul (local.get $sx) (local.get $twf)) (f32.const 0.5)))
          (local.set $sy (f32.sub (f32.mul (local.get $sy) (local.get $thf)) (f32.const 0.5)))
          (local.set $flx (f32.floor (local.get $sx)))
          (local.set $fly (f32.floor (local.get $sy)))
          (local.set $ix0 (i32.trunc_sat_f32_s (local.get $flx)))
          (local.set $iy0 (i32.trunc_sat_f32_s (local.get $fly)))
          (local.set $wx (i32.trunc_sat_f32_u
            (f32.mul (f32.sub (local.get $sx) (local.get $flx)) (f32.const 256.0))))
          (local.set $wy (i32.trunc_sat_f32_u
            (f32.mul (f32.sub (local.get $sy) (local.get $fly)) (f32.const 256.0))))
          (local.set $ix1 (i32.shl (i32.and (i32.add (local.get $ix0) (i32.const 1)) (local.get $wmask)) (i32.const 1)))
          (local.set $ix0 (i32.shl (i32.and (local.get $ix0) (local.get $wmask)) (i32.const 1)))
          (local.set $trow0 (i32.add (local.get $tdib)
            (i32.mul (i32.and (local.get $iy0) (local.get $hmask)) (local.get $tpitch))))
          (local.set $trow1 (i32.add (local.get $tdib)
            (i32.mul (i32.and (i32.add (local.get $iy0) (i32.const 1)) (local.get $hmask)) (local.get $tpitch))))
          ;; lanes: c00, c01, c10, c11 -- so extend_low is the c00|c01 half and
          ;; extend_high the c10|c11 half $d3dim_bilerp pairs them as.
          (local.set $pv
            (i32x4.replace_lane 3
              (i32x4.replace_lane 2
                (i32x4.replace_lane 1
                  (i32x4.splat (i32.load16_u (i32.add (local.get $trow0) (local.get $ix0))))
                  (i32.load16_u (i32.add (local.get $trow1) (local.get $ix0))))
                (i32.load16_u (i32.add (local.get $trow0) (local.get $ix1))))
              (i32.load16_u (i32.add (local.get $trow1) (local.get $ix1)))))
          (if (i32.eq (local.get $tfmt) (i32.const 1))
            (then
              ;; RGB565: the fetch path's expand5/expand6 bits, four lanes at once.
              (local.set $cv (v128.and (local.get $pv) (i32x4.splat (i32.const 0xF800))))
              (local.set $hv (v128.and (local.get $pv) (i32x4.splat (i32.const 0x07E0))))
              (local.set $cv (v128.or
                (v128.or
                  (i32x4.shl (v128.or (i32x4.shr_u (local.get $cv) (i32.const 8))
                                      (i32x4.shr_u (local.get $cv) (i32.const 13))) (i32.const 16))
                  (i32x4.shl (v128.or (i32x4.shr_u (local.get $hv) (i32.const 3))
                                      (i32x4.shr_u (local.get $hv) (i32.const 9))) (i32.const 8)))
                (i32x4.splat (i32.const 0xFF000000)))))
            (else
              ;; X1R5G5B5 / A1R5G5B5.
              (local.set $cv (v128.and (local.get $pv) (i32x4.splat (i32.const 0x7C00))))
              (local.set $hv (v128.and (local.get $pv) (i32x4.splat (i32.const 0x03E0))))
              (local.set $cv (v128.or
                (v128.or
                  (i32x4.shl (v128.or (i32x4.shr_u (local.get $cv) (i32.const 7))
                                      (i32x4.shr_u (local.get $cv) (i32.const 12))) (i32.const 16))
                  (i32x4.shl (v128.or (i32x4.shr_u (local.get $hv) (i32.const 2))
                                      (i32x4.shr_u (local.get $hv) (i32.const 7))) (i32.const 8)))
                (if (result v128) (i32.eq (local.get $tfmt) (i32.const 3))
                  (then (v128.and (i32x4.shr_s (i32x4.shl (local.get $pv) (i32.const 16)) (i32.const 31))
                                  (i32x4.splat (i32.const 0xFF000000))))
                  (else (i32x4.splat (i32.const 0xFF000000))))))))
          ;; Blue is the same five bits in both layouts.
          (local.set $hv (v128.and (local.get $pv) (i32x4.splat (i32.const 31))))
          (local.set $cv (v128.or (local.get $cv)
            (v128.or (i32x4.shl (local.get $hv) (i32.const 3)) (i32x4.shr_u (local.get $hv) (i32.const 2)))))
          ;; $d3dim_bilerp's fixed-point filter on the decoded quad.
          (local.set $hv (i16x8.shr_u
            (i16x8.add
              (i16x8.mul (i16x8.extend_low_i8x16_u (local.get $cv))
                         (i16x8.splat (i32.sub (i32.const 256) (local.get $wx))))
              (i16x8.mul (i16x8.extend_high_i8x16_u (local.get $cv))
                         (i16x8.splat (local.get $wx))))
            (i32.const 8)))
          (local.set $sample (i32x4.extract_lane 0
            (i8x16.narrow_i16x8_u
              (i16x8.shr_u
                (i16x8.add
                  (i16x8.mul (local.get $hv) (i16x8.splat (i32.sub (i32.const 256) (local.get $wy))))
                  (i16x8.mul
                    (i8x16.shuffle 8 9 10 11 12 13 14 15 8 9 10 11 12 13 14 15 (local.get $hv) (local.get $hv))
                    (i16x8.splat (local.get $wy))))
                (i32.const 8))
              (i16x8.splat (i32.const 0))))))
        (else
          (local.set $sample (if (result i32) (local.get $key_blend)
            (then (call $d3dim_texture_sample_keyed
              (local.get $tw) (local.get $th) (local.get $tbpp) (local.get $tpitch)
              (local.get $tdib) (local.get $tfmt) (local.get $tpal) (local.get $tpal_alpha)
              (local.get $tu) (local.get $tv) (local.get $address_u) (local.get $address_v)
              (local.get $linear) (i32.const 1) (local.get $sample_key)))
            (else (call $gl_sw_sample_prepared
            (local.get $tw) (local.get $th) (local.get $tbpp) (local.get $tpitch)
            (local.get $tdib) (local.get $tfmt) (local.get $tpal) (local.get $tpal_alpha)
            (local.get $tu) (local.get $tv)
            (local.get $address_u) (local.get $address_v) (local.get $linear)
            (global.get $gl_sw_r_border) (local.get $x) (local.get $y)))))))
))
      (local.set $draw (i32.const 1))
      ;; D3DRENDERSTATE_COLORKEYENABLE discards a matching texture sample.
      ;; It must happen before depth testing/writes: transparent HUD texels
      ;; neither paint their magenta key nor occlude later geometry.
      (if (i32.and
            (i32.and (local.get $key_active) (i32.eqz (local.get $key_blend)))
            (if (result i32) (i32.and (local.get $key_index_mode) (i32.eqz (local.get $linear)))
              (then (i32.eq
                (call $d3dim_point_index
                  (local.get $tw) (local.get $th) (local.get $tpitch) (local.get $tdib)
                  (local.get $tu) (local.get $tv) (local.get $address_u) (local.get $address_v))
                (local.get $key_index)))
              (else (i32.eq
              (i32.and (local.get $sample) (i32.const 0x00ffffff))
              (i32.and (local.get $key_rgb) (i32.const 0x00ffffff))))))
        (then (local.set $draw (i32.const 0))))
      ;; Preserve the existing mixed/zero-weight policy, but RGB coincidence
      ;; with a different palette index cannot reject an all-nonkey footprint.
      (if (i32.and (i32.eqz (local.get $draw))
            (i32.and (local.get $key_index_mode) (i32.ne (local.get $linear) (i32.const 0))))
        (then
          (if (i32.eqz (call $d3dim_filter_has_key_index
                (local.get $tw) (local.get $th) (local.get $tpitch) (local.get $tdib)
                (local.get $tu) (local.get $tv) (local.get $address_u) (local.get $address_v)
                (local.get $key_index)))
            (then (local.set $draw (i32.const 1))))))
      ;; All four fetched opaque P8 indices keyed: reject independently of RGB.
      ;; The general raw-key decoder is not a palette lookup; changing it would
      ;; also change unresolved mixed/zero-weight FALSE-mode decisions.
      (if (i32.and (local.get $draw)
            (i32.and (i32.eqz (local.get $key_blend))
              (i32.and (local.get $key_index_mode) (i32.ne (local.get $linear) (i32.const 0)))))
        (then
          (if (i32.eq (call $d3dim_filter_key_mask
                (local.get $tw) (local.get $th) (local.get $tpitch) (local.get $tdib)
                (local.get $tu) (local.get $tv) (local.get $address_u) (local.get $address_v)
                (local.get $key_index)) (i32.const 15))
            (then (local.set $draw (i32.const 0))))))
      ;; Alpha test, like the colour key, runs before the depth test: a texel
      ;; the test rejects must not write depth and occlude what is behind it.
      ;; The alpha compared is the texture stage's output, not the raw texel,
      ;; so a MODULATE stage with a translucent diffuse is tested on the value
      ;; that would actually have been written.
      ;; GL tests the fragment after every texture unit, so with unit 1 on
      ;; the tested alpha is unit 1's output, not unit 0's.
      (local.set $combined (i32.const 0))
      (if (i32.and (local.get $draw) (i32.ne (local.get $alpha_test) (i32.const 0)))
        (then
          (local.set $color (call $d3dim_texture_stage_combine
            (local.get $sample) (local.get $diffuse)
            (local.get $colorop) (local.get $alphaop)))
          (if (global.get $rast_t1_on)
            (then (local.set $color (call $rast_apply_t1
              (local.get $color) (local.get $x) (local.get $y)))))
          (local.set $combined (i32.const 1))
          (if (i32.eqz (call $d3dim_alpha_pass
                (i32.shr_u (local.get $color) (i32.const 24))
                (i32.and (local.get $alpha_test) (i32.const 0xFF))
                (i32.and (i32.shr_u (local.get $alpha_test) (i32.const 8)) (i32.const 0xFF))))
            (then (local.set $draw (i32.const 0))))))
      ;; Stipple removes raster fragments before ANY stencil or depth effect.
      (if (global.get $rast_gl_stipple) (then
        (if (i32.eqz (call $gl_stipple_pass (local.get $x) (local.get $y)))
          (then (local.set $draw (i32.const 0))))))
      (local.set $stencil_pass (i32.const 0))
      (if (i32.and (local.get $draw) (i32.ne (global.get $rast_stencil_state) (i32.const 0))) (then
        (local.set $draw (call $gl_stencil_test (local.get $x) (local.get $y)))
        (local.set $stencil_pass (local.get $draw))))
      (if (i32.and (local.get $draw) (i32.ne (local.get $zentry) (i32.const 0)))
        (then
          (local.set $zptr (i32.add (local.get $zdib)
            (i32.add (i32.mul (local.get $y) (local.get $zpitch))
              (i32.mul (local.get $x) (i32.shr_u (local.get $zbpp) (i32.const 3))))))
          (local.set $ztest (local.get $tz))
          ;; Reject non-finite depth rather than mapping it to an endpoint:
          ;; MW3 uses reversed GREATEREQUAL and ALWAYS states, so an endpoint
          ;; substitution can pass and then corrupt the attached Z surface.
          (if (f32.ne (local.get $ztest) (local.get $ztest))
            (then (local.set $draw (i32.const 0)))
            (else
              (if (f32.lt (local.get $ztest) (f32.const 0.0)) (then (local.set $ztest (f32.const 0.0))))
              (if (f32.gt (local.get $ztest) (f32.const 1.0)) (then (local.set $ztest (f32.const 1.0))))
              (if (i32.eq (local.get $zbpp) (i32.const 16))
                (then
                  (local.set $zraw (i32.trunc_sat_f32_u (f32.mul (local.get $ztest) (f32.const 65535.0))))
                  (if (call $d3dim_depth_compare_u
                        (local.get $zraw) (i32.load16_u (local.get $zptr)) (local.get $zfunc))
                    (then (if (local.get $zwrite)
                      (then (i32.store16 (local.get $zptr) (local.get $zraw)))))
                    (else (local.set $draw (i32.const 0)))))
                (else
                  (if (i32.eq (local.get $zbpp) (i32.const 32))
                    (then
                      (local.set $zraw (i32.trunc_sat_f32_u
                        (f32.mul (local.get $ztest) (f32.const 4294967040.0))))
                      (if (call $d3dim_depth_compare_u
                            (local.get $zraw) (i32.load (local.get $zptr)) (local.get $zfunc))
                        (then (if (local.get $zwrite)
                          (then (i32.store (local.get $zptr) (local.get $zraw)))))
                        (else (local.set $draw (i32.const 0)))))))))))
        (else
          (if (i32.and (local.get $draw) (i32.ne (local.get $zbuf_wa) (i32.const 0))) (then
            (local.set $zptr (i32.add (local.get $zbuf_wa)
              (i32.mul (i32.add (i32.mul (local.get $y) (local.get $sw)) (local.get $x)) (i32.const 4))))
            (if (f32.ne (local.get $tz) (local.get $tz))
              (then (local.set $draw (i32.const 0)))
              (else
                (if (call $d3dim_depth_compare_f32
                      (local.get $tz) (f32.load (local.get $zptr)) (local.get $zfunc))
                  (then (if (local.get $zwrite)
                    (then (f32.store (local.get $zptr) (local.get $tz)))))
                  (else (local.set $draw (i32.const 0))))))))))
      (if (local.get $stencil_pass) (then
        (call $gl_stencil_apply (call $gl_stencil_address (local.get $x) (local.get $y))
          (i32.load (i32.add (global.get $rast_stencil_state)
            (select (i32.const 28) (i32.const 24) (local.get $draw)))))))
      (if (i32.and (local.get $draw) (i32.eqz (local.get $combined))) (then
        (local.set $color (call $d3dim_texture_stage_combine
          (local.get $sample)
          (local.get $diffuse) (local.get $colorop) (local.get $alphaop)))
        ;; GL texture unit 1, then GL fog, after unit 0 and before blending
        ;; (09a8g-gl-raster).
        (if (global.get $rast_t1_on)
          (then (local.set $color (call $rast_apply_t1
            (local.get $color) (local.get $x) (local.get $y)))))))
      (if (local.get $draw) (then
        (if (global.get $rast_fog_on)
          (then (local.set $color (call $rast_apply_fog
            (local.get $color) (local.get $x) (local.get $y)))))
        (call $gl_sw_second_pixel (local.get $x) (local.get $y) (local.get $color)
          (local.get $blend) (local.get $src_blend) (local.get $dst_blend))
        (if (local.get $blend) (then
          (local.set $ptr (i32.add (local.get $row_wa)
            (i32.mul (local.get $x) (i32.div_u (local.get $bpp) (i32.const 8)))))
          (if (i32.eq (local.get $bpp) (i32.const 32))
            (then (local.set $dst (i32.load (local.get $ptr))))
            (else
              (local.set $px16 (i32.load16_u (local.get $ptr)))
              ;; Destination factors consume the stored channel expanded by
              ;; bit replication, including RGB565's low replicated bits.
              (local.set $dst (call $d3dim_decode_surface_pixel_fmt
                (local.get $rtfmt) (local.get $px16) (i32.const 16)))))
          (local.set $color (if (result i32) (global.get $gl_sw_rgba_span)
            (then (call $gl_sw_blend_rgba (local.get $color) (local.get $dst) (local.get $src_blend) (local.get $dst_blend)))
            (else (if (result i32) (local.get $rtalpha)
              (then (call $d3dim_blend_argb (local.get $color) (local.get $dst) (local.get $src_blend) (local.get $dst_blend)))
              (else (call $d3dim_blend_rgb (local.get $color) (local.get $dst) (local.get $src_blend) (local.get $dst_blend)))))))))
        ;; D3DANTIALIAS_SORTDEPENDENT smooths polygon boundaries against the
        ;; colour already in the render target. Interior pixels keep the hot
        ;; opaque path; only the two scanline edge samples need a destination
        ;; read and blend.
        (if (i32.and
              (i32.ne (local.get $antialias) (i32.const 0))
              (i32.or (i32.eq (local.get $x) (local.get $xs))
                      (i32.eq (local.get $x) (local.get $xe))))
          (then
            (local.set $ptr (i32.add (local.get $row_wa)
              (i32.mul (local.get $x) (i32.div_u (local.get $bpp) (i32.const 8)))))
            (if (i32.eq (local.get $bpp) (i32.const 32))
              (then (local.set $dst (i32.load (local.get $ptr))))
              (else (if (i32.eq (local.get $bpp) (i32.const 16))
                (then
                  (local.set $px16 (i32.load16_u (local.get $ptr)))
                  (local.set $dst (call $d3dim_decode_surface_pixel_fmt
                    (local.get $rtfmt) (local.get $px16) (i32.const 16)))))))
            (if (i32.or (i32.eq (local.get $bpp) (i32.const 32))
                        (i32.eq (local.get $bpp) (i32.const 16)))
              (then (local.set $color (call $d3dim_color_lerp
                (local.get $dst) (local.get $color) (f32.const 0.5)))))))
        (if (i32.eq (local.get $bpp) (i32.const 32)) (then
          (local.set $ptr (i32.add (local.get $row_wa) (i32.mul (local.get $x) (i32.const 4))))
          (if (global.get $rast_gl_logic) (then
            (local.set $color (call $gl_logic_word (local.get $color) (i32.load (local.get $ptr))))))
          (if (i32.ne (global.get $rast_color_mask) (i32.const -1))
            (then (local.set $color (call $gl_color_merge (i32.load (local.get $ptr)) (local.get $color) (global.get $rast_color_mask)))))
          (i32.store (local.get $ptr) (local.get $color))))
        (if (i32.eq (local.get $bpp) (i32.const 16)) (then
          (if (global.get $rast_gl_dither) (then
            (local.set $color (call $gl_logic_dither_source (local.get $color)
              (local.get $x) (local.get $y) (local.get $rt555)))))
          (if (local.get $rtalpha)
            (then (local.set $px16 (call $d3dim_encode_surface_pixel
              (local.get $rt_entry) (local.get $color) (i32.const 16))))
            (else
          (if (local.get $rt555)
            ;; X1R5G5B5 target -- a BI_RGB 16bpp DIB, which is what an
            ;; OpenGL bitmap context renders into (SimGolf). Packing 565 into
            ;; it moves green's top bit into red and reads back as speckle.
            (then (local.set $px16 (i32.or (i32.or
                (i32.and (i32.shr_u (local.get $color) (i32.const 9)) (i32.const 0x7C00))
                (i32.and (i32.shr_u (local.get $color) (i32.const 6)) (i32.const 0x03E0)))
                (i32.and (i32.shr_u (local.get $color) (i32.const 3)) (i32.const 0x001F)))))
          (else
          (if (local.get $dither)
            (then
              (local.set $px16 (call $d3dim_pack_rgb565
                (local.get $color) (local.get $x) (local.get $y))))
            (else
              (local.set $px16 (i32.or (i32.or
                (i32.shl (i32.and (i32.shr_u (local.get $color) (i32.const 19)) (i32.const 0x1F)) (i32.const 11))
                (i32.shl (i32.and (i32.shr_u (local.get $color) (i32.const 10)) (i32.const 0x3F)) (i32.const 5)))
                (i32.and (i32.shr_u (local.get $color) (i32.const 3)) (i32.const 0x1F))))))))))
          (local.set $ptr (i32.add (local.get $row_wa) (i32.mul (local.get $x) (i32.const 2))))
          (if (global.get $rast_gl_logic) (then
            (local.set $px16 (call $gl_logic_word (local.get $px16) (i32.load16_u (local.get $ptr))))))
          (if (i32.ne (global.get $rast_color_mask) (i32.const -1))
            (then (local.set $px16 (call $gl_color_merge (i32.load16_u (local.get $ptr))
              (local.get $px16)
              (global.get $rast_color_mask)))))
          (i32.store16 (local.get $ptr) (local.get $px16))))
        (if (i32.eq (local.get $bpp) (i32.const 8)) (then
          (i32.store8 (i32.add (local.get $row_wa) (local.get $x)) (local.get $color))))))
      (local.set $x (i32.add (local.get $x) (i32.const 1)))
      (br $lp))))

  ;; Fill either a private f32 depth plane or an attached 16/32-bit DirectDraw
  ;; Z surface with `zval`.
  (func $zbuffer_fill (param $zbuf_guest i32) (param $w i32) (param $h i32) (param $zval f32)
    (local $i i32) (local $n i32) (local $wa i32)
    (local $entry i32) (local $dib i32) (local $pitch i32) (local $bpp i32)
    (local $x i32) (local $y i32) (local $raw i32) (local $z f32)
    (if (i32.eqz (local.get $zbuf_guest)) (then (return)))
    (if (i32.and
          (i32.ge_u (local.get $zbuf_guest) (global.get $DX_OBJECTS))
          (i32.lt_u (local.get $zbuf_guest)
            (i32.add (global.get $DX_OBJECTS) (global.get $DX_OBJECTS_SIZE))))
      (then
        (local.set $entry (local.get $zbuf_guest))
        (local.set $dib (load.field.memarg DxObject misc1 (local.get $entry)))
        (local.set $pitch (load.field.memarg DxObject pitch (local.get $entry)))
        (local.set $bpp (load.field.memarg DxObject bpp (local.get $entry)))
        (local.set $z (local.get $zval))
        (if (f32.ne (local.get $z) (local.get $z)) (then (local.set $z (f32.const 1.0))))
        (if (f32.lt (local.get $z) (f32.const 0.0)) (then (local.set $z (f32.const 0.0))))
        (if (f32.gt (local.get $z) (f32.const 1.0)) (then (local.set $z (f32.const 1.0))))
        (if (i32.eq (local.get $bpp) (i32.const 16))
          (then (local.set $raw (i32.trunc_sat_f32_u (f32.mul (local.get $z) (f32.const 65535.0)))))
          (else (local.set $raw (i32.trunc_sat_f32_u
            (f32.mul (local.get $z) (f32.const 4294967040.0))))))
        (local.set $y (i32.const 0))
        (block $zdone (loop $zrows
          (br_if $zdone (i32.ge_u (local.get $y) (local.get $h)))
          (local.set $x (i32.const 0))
          (block $xdone (loop $zcols
            (br_if $xdone (i32.ge_u (local.get $x) (local.get $w)))
            (if (i32.eq (local.get $bpp) (i32.const 16))
              (then (i32.store16
                (i32.add (local.get $dib)
                  (i32.add (i32.mul (local.get $y) (local.get $pitch))
                           (i32.shl (local.get $x) (i32.const 1))))
                (local.get $raw)))
              (else (i32.store
                (i32.add (local.get $dib)
                  (i32.add (i32.mul (local.get $y) (local.get $pitch))
                           (i32.shl (local.get $x) (i32.const 2))))
                (local.get $raw))))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $zcols)))
          (local.set $y (i32.add (local.get $y) (i32.const 1)))
          (br $zrows)))
        (return)))
    (local.set $wa (call $g2w (local.get $zbuf_guest)))
    (local.set $n (i32.mul (local.get $w) (local.get $h)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (f32.store (i32.add (local.get $wa) (i32.mul (local.get $i) (i32.const 4))) (local.get $zval))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; Main viewport clear: parse D3DRECT* (or whole viewport rect if NULL),
  ;; clear color and/or z per dwFlags. D3DCLEAR_TARGET=1, ZBUFFER=2, STENCIL=4.
  ;; For Phase 0 we ignore lpRects and clear the device's whole viewport rect
  ;; recorded at state +D3DIM_OFF_VP_RECT.
  (func $d3dim_viewport_clear (param $this i32) (param $dwCount i32) (param $lpRects i32) (param $dwFlags i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; The real clear, called from $handle_IDirect3DViewport3_Clear (09a8) with
  ;; an implied D3DCLEAR_TARGET and from $handle_IDirect3DViewport3_Clear2
  ;; (09a8) with the caller's own dwFlags/dwColor/dvZ. Both of those handlers
  ;; paint through here -- this is not a stub, and it honours exactly the bits
  ;; it is handed: D3DCLEAR_TARGET (0x1) fills colour, D3DCLEAR_ZBUFFER (0x2)
  ;; fills Z. An app may legitimately pass 0x2 alone and rely on its own
  ;; full-screen geometry to cover the colour buffer -- Half-Life does, so a
  ;; stale-looking backdrop under a D3D scene is a coverage bug in the draw
  ;; path, never a missing clear here (docs/re-notes/half-life-uplink.md).
  (func $d3dim_viewport_clear_full
    (param $vp_this i32)
    (param $dwFlags i32) (param $color i32) (param $zval f32)
    (local $rt i32) (local $dev_this i32) (local $vp_entry i32)
    (local $vx i32) (local $vy i32) (local $vw i32) (local $vh i32)
    (local $zbuf i32) (local $rtw i32) (local $rth i32) (local $bgtex i32)
    (if (i32.eqz (global.get $d3dim_gpu_on)) (then (call $d3dim_worker_fence)))
    (if (i32.eqz (local.get $vp_this)) (then (return)))
    (local.set $vp_entry (call $dx_from_this (local.get $vp_this)))
    (if (i32.eqz (local.get $vp_entry)) (then (return)))
    (local.set $dev_this (i32.load (i32.add (local.get $vp_entry) (i32.const 8))))
    (if (i32.eqz (local.get $dev_this)) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $dev_this)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $vx (i32.load (i32.add (local.get $vp_entry) (i32.const 12))))
    (local.set $vy (i32.load (i32.add (local.get $vp_entry) (i32.const 16))))
    (local.set $vw (i32.load (i32.add (local.get $vp_entry) (i32.const 20))))
    (local.set $vh (i32.load (i32.add (local.get $vp_entry) (i32.const 24))))
    ;; Fall back to full RT if viewport rect is unset.
    (if (i32.or (i32.eqz (local.get $vw)) (i32.eqz (local.get $vh))) (then
      (local.set $vx (i32.const 0))
      (local.set $vy (i32.const 0))
      (local.set $vw (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
      (local.set $vh (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))))
    (if (global.get $d3dim_gpu_on) (then
      ;; A background image goes as a textured clear, under the same rule the
      ;; software fill below uses (not on an 8bpp target). Architec and SciFi
      ;; clear through one every frame; in software that was a readback and a
      ;; full-frame upload per frame, most of their GPU time.
      (if (i32.and (local.get $dwFlags) (i32.const 1)) (then
        (local.set $bgtex (call $d3dim_viewport_background_texture (local.get $vp_this)))
        (if (i32.eq (i32.and (i32.load (i32.add (local.get $rt) (i32.const 16))) (i32.const 0xFFFF))
                    (i32.const 8))
          (then (local.set $bgtex (i32.const 0))))))
      (if (call $d3dim_gpu_try_clear (local.get $rt) (local.get $dwFlags)
            (local.get $color) (local.get $zval)
            (local.get $vx) (local.get $vy) (local.get $vw) (local.get $vh) (local.get $bgtex))
        (then (return)))
      (call $d3dim_worker_fence)))
    (if (i32.and (local.get $dwFlags) (i32.const 1)) (then
      ;; A background material carrying an image wins over its (usually white)
      ;; diffuse. 8bpp targets stay on the colour path -- sampling RGB into a
      ;; palettized surface would need an inverse-palette lookup we don't have.
      (local.set $bgtex (call $d3dim_viewport_background_texture (local.get $vp_this)))
      (if (i32.and (i32.ne (local.get $bgtex) (i32.const 0))
                   (i32.ne (i32.and (i32.load (i32.add (local.get $rt) (i32.const 16)))
                                    (i32.const 0xFFFF))
                           (i32.const 8)))
        (then (call $viewport_fill_rect_texture (local.get $rt) (local.get $vx) (local.get $vy)
                (local.get $vw) (local.get $vh) (local.get $bgtex)))
        (else (call $viewport_fill_rect (local.get $rt) (local.get $vx) (local.get $vy)
                (local.get $vw) (local.get $vh) (local.get $color))))))
    (if (i32.and (local.get $dwFlags) (i32.const 2)) (then
      (local.set $zbuf (call $d3dim_ensure_zbuffer (local.get $dev_this)))
      (local.set $rtw (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
      (local.set $rth (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))
      (call $zbuffer_fill (local.get $zbuf) (local.get $rtw) (local.get $rth) (local.get $zval)))))

  (func $d3dim_device7_clear
    (param $this i32)
    (param $dwFlags i32) (param $color i32) (param $zval f32)
    (local $state i32) (local $sw i32) (local $rt i32)
    (local $vx i32) (local $vy i32) (local $vw i32) (local $vh i32)
    (local $zbuf i32) (local $rtw i32) (local $rth i32)
    (if (i32.eqz (global.get $d3dim_gpu_on)) (then (call $d3dim_worker_fence)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $this)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $vx (i32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT))))
    (local.set $vy (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4)))))
    (local.set $vw (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8)))))
    (local.set $vh (i32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12)))))
    ;; Fall back to full RT if the app has not called SetViewport yet.
    (if (i32.or (i32.eqz (local.get $vw)) (i32.eqz (local.get $vh))) (then
      (local.set $vx (i32.const 0))
      (local.set $vy (i32.const 0))
      (local.set $vw (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
      (local.set $vh (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))))
    (if (global.get $d3dim_gpu_on) (then
      (if (call $d3dim_gpu_try_clear (local.get $rt) (local.get $dwFlags)
            (local.get $color) (local.get $zval)
            (local.get $vx) (local.get $vy) (local.get $vw) (local.get $vh) (i32.const 0))
        (then (return)))
      (call $d3dim_worker_fence)))
    (if (i32.and (local.get $dwFlags) (i32.const 1)) (then
      (call $viewport_fill_rect (local.get $rt) (local.get $vx) (local.get $vy)
        (local.get $vw) (local.get $vh) (local.get $color))))
    (if (i32.and (local.get $dwFlags) (i32.const 2)) (then
      (local.set $zbuf (call $d3dim_ensure_zbuffer (local.get $this)))
      (local.set $rtw (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
      (local.set $rth (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))
      (call $zbuffer_fill (local.get $zbuf) (local.get $rtw) (local.get $rth) (local.get $zval)))))

  ;; ── Back-face culling ─────────────────────────────────────────
  ;; D3DRENDERSTATE_CULLMODE (rs=22) stored at state+256+22*4 = state+344.
  ;; 0=uninit, 1=NONE, 2=CW, 3=CCW. Treat uninitialized as no cull until
  ;; our transformed winding/clip path is precise enough for the D3D default.
  ;; Screen-space (Y-down) signed cross: >0 → CW on screen, <0 → CCW.
  ;; TLVERTEX are already in screen space, so front-facing = CW = cross>0.
  (func $d3dim_cull_tri (param $this i32)
    (param $x0 i32) (param $y0 i32) (param $x1 i32) (param $y1 i32) (param $x2 i32) (param $y2 i32)
    (result i32)
    (local $state i32) (local $mode i32) (local $cross i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $mode (call $gl32 (i32.add (local.get $state) (i32.const 344))))
    ;; D3D's documented default is D3DCULL_CCW, and D3DRM relies on it: the
    ;; Plus! 98 Organic Art screensavers never issue a CULLMODE render state at
    ;; all (7 SetRenderState calls in 20000 batches of FALLINGL, none of them
    ;; rs=22). Treating unset as "no cull" drew every back face, and a back
    ;; face shades to black by construction -- N.L <= 0 for every light -- so
    ;; with one flat Z per triangle those black faces beat the lit front faces
    ;; on roughly half the pixels. That is what "lit geometry shades to black"
    ;; was across this whole cluster.
    (if (i32.eqz (local.get $mode)) (then (local.set $mode (i32.const 3))))
    (if (i32.eq (local.get $mode) (i32.const 1)) (then (return (i32.const 0))))
    (local.set $cross
      (i32.sub
        (i32.mul (i32.sub (local.get $x1) (local.get $x0)) (i32.sub (local.get $y2) (local.get $y0)))
        (i32.mul (i32.sub (local.get $x2) (local.get $x0)) (i32.sub (local.get $y1) (local.get $y0)))))
    (if (i32.eq (local.get $mode) (i32.const 2))
      (then (return (i32.gt_s (local.get $cross) (i32.const 0)))))
    (i32.lt_s (local.get $cross) (i32.const 0)))

  (func $d3dim_draw_tri_culled
    (param $this i32) (param $rt i32) (param $use_z i32) (param $honor_cull i32)
    (param $x0 i32) (param $y0 i32) (param $z0 f32)
    (param $x1 i32) (param $y1 i32) (param $z1 f32)
    (param $x2 i32) (param $y2 i32) (param $z2 f32)
    (param $color i32)
    (local $state i32) (local $zbuf i32) (local $zval f32) (local $alpha i32) (local $blend i32)
    (local $zfunc i32) (local $zwrite i32)
    ;; Every caller relies on culling when it does not use a z-buffer: otherwise
    ;; later back faces overwrite the visible faces.  Execute-buffer/D3DRM
    ;; triangles used to be exempted here on the theory that their transformed
    ;; winding lacked clip parity; that exemption was the bug, since a back face
    ;; shades to black by construction and drew over the lit front faces.
    (if (local.get $honor_cull) (then
      (if (call $d3dim_cull_tri (local.get $this)
            (local.get $x0) (local.get $y0)
            (local.get $x1) (local.get $y1)
            (local.get $x2) (local.get $y2))
        (then (return)))))
    (if (local.get $use_z) (then
      (local.set $state (call $d3ddev_state (local.get $this)))
      (if (local.get $state) (then
        (if (call $gl32 (i32.add (local.get $state) (i32.const 284))) (then
          (local.set $zbuf (call $d3dim_ensure_zbuffer (local.get $this)))
          (local.set $zfunc (call $gl32 (i32.add (local.get $state) (i32.const 348))))
          (local.set $zwrite (call $gl32 (i32.add (local.get $state) (i32.const 312))))))))))
    (if (i32.eqz (local.get $zfunc)) (then (local.set $zfunc (i32.const 4))))
    ;; ALWAYS with writes disabled is exactly the no-depth path. This is MW3's
    ;; common blended-overlay state and avoiding an attached-Z load/compare on
    ;; every covered pixel is both semantically exact and materially cheaper.
    (if (i32.and
          (i32.eq (local.get $zfunc) (i32.const 8))
          (i32.eqz (local.get $zwrite)))
      (then (local.set $zbuf (i32.const 0))))
    (local.set $alpha (i32.shr_u (local.get $color) (i32.const 24)))
    (if (i32.lt_u (local.get $alpha) (i32.const 255)) (then
      (if (i32.eqz (local.get $state)) (then
        (local.set $state (call $d3ddev_state (local.get $this)))))
      (if (local.get $state) (then
        ;; D3DRENDERSTATE_ALPHABLENDENABLE = 27.
        (if (call $gl32 (i32.add (local.get $state) (i32.const 364))) (then
          (local.set $blend (i32.const 1))))))))
    (local.set $zval
      (f32.div
        (f32.add (f32.add (local.get $z0) (local.get $z1)) (local.get $z2))
        (f32.const 3.0)))
    (call $rasterize_triangle_flat (local.get $rt)
      (local.get $x0) (local.get $y0)
      (local.get $x1) (local.get $y1)
      (local.get $x2) (local.get $y2)
      (local.get $color)
      (local.get $blend)
      (local.get $zbuf) (local.get $zval) (local.get $zfunc) (local.get $zwrite)))

  ;; ============================================================
  ;; PHASE 2 — Flat-shaded triangle rasterizer (TLVERTEX fast path)
  ;; ============================================================
  ;; Rasterize a single triangle with a uniform color. Integer screen coords.
  ;; Uses the "split at middle vertex" scheme: sort y0≤y1≤y2, then for every
  ;; scanline y in [y0..y2] compute left/right x on the two active edges and
  ;; emit one 1-tall fill_rect. Degenerate (zero-area) triangles are skipped.
  (func $rasterize_triangle_flat
    (param $rt_entry i32)
    (param $x0 i32) (param $y0 i32)
    (param $x1 i32) (param $y1 i32)
    (param $x2 i32) (param $y2 i32)
    (param $color i32)
    (param $blend i32)
    (param $zbuf_guest i32) (param $zval f32) (param $zfunc i32) (param $zwrite i32)
    (local $tx i32) (local $ty i32)
    (local $y i32) (local $xa i32) (local $xb i32) (local $xl i32) (local $xr i32)
    (local $dy_tot i32) (local $dy_upper i32) (local $dy_lower i32)
    ;; Sort by y (bubble).
    (if (i32.gt_s (local.get $y0) (local.get $y1)) (then
      (local.set $tx (local.get $x0)) (local.set $ty (local.get $y0))
      (local.set $x0 (local.get $x1)) (local.set $y0 (local.get $y1))
      (local.set $x1 (local.get $tx)) (local.set $y1 (local.get $ty))))
    (if (i32.gt_s (local.get $y1) (local.get $y2)) (then
      (local.set $tx (local.get $x1)) (local.set $ty (local.get $y1))
      (local.set $x1 (local.get $x2)) (local.set $y1 (local.get $y2))
      (local.set $x2 (local.get $tx)) (local.set $y2 (local.get $ty))))
    (if (i32.gt_s (local.get $y0) (local.get $y1)) (then
      (local.set $tx (local.get $x0)) (local.set $ty (local.get $y0))
      (local.set $x0 (local.get $x1)) (local.set $y0 (local.get $y1))
      (local.set $x1 (local.get $tx)) (local.set $y1 (local.get $ty))))
    (local.set $dy_tot   (i32.sub (local.get $y2) (local.get $y0)))
    (local.set $dy_upper (i32.sub (local.get $y1) (local.get $y0)))
    (local.set $dy_lower (i32.sub (local.get $y2) (local.get $y1)))
    (if (i32.le_s (local.get $dy_tot) (i32.const 0)) (then
      ;; Fully-flat triangle: emit a thin horizontal bar on y0 from min(x) to max(x)
      (local.set $xl (local.get $x0))
      (if (i32.lt_s (local.get $x1) (local.get $xl)) (then (local.set $xl (local.get $x1))))
      (if (i32.lt_s (local.get $x2) (local.get $xl)) (then (local.set $xl (local.get $x2))))
      (local.set $xr (local.get $x0))
      (if (i32.gt_s (local.get $x1) (local.get $xr)) (then (local.set $xr (local.get $x1))))
      (if (i32.gt_s (local.get $x2) (local.get $xr)) (then (local.set $xr (local.get $x2))))
      (if (local.get $zbuf_guest)
        (then (call $viewport_fill_rect_z (local.get $rt_entry) (local.get $zbuf_guest)
          (local.get $xl) (local.get $y0)
          (i32.add (i32.sub (local.get $xr) (local.get $xl)) (i32.const 1))
          (i32.const 1) (local.get $zval) (local.get $color)
          (local.get $zfunc) (local.get $zwrite)))
        (else
          (if (local.get $blend)
            (then (call $viewport_fill_rect_alpha (local.get $rt_entry)
              (local.get $xl) (local.get $y0)
              (i32.add (i32.sub (local.get $xr) (local.get $xl)) (i32.const 1))
              (i32.const 1) (local.get $color)
              (i32.shr_u (local.get $color) (i32.const 24))))
            (else (call $viewport_fill_rect (local.get $rt_entry)
              (local.get $xl) (local.get $y0)
              (i32.add (i32.sub (local.get $xr) (local.get $xl)) (i32.const 1))
              (i32.const 1) (local.get $color))))))
      (return)))
    (local.set $y (local.get $y0))
    (block $done (loop $lp
      ;; Top-left fill rule: a triangle owns its top scanline but not its bottom
      ;; one; the next triangle down owns that row. Drawing y2 too painted shared
      ;; horizontal edges twice: NFS III's 256x256 cockpit tiles meet at y=256 and
      ;; the upper tile's extra row sampled tv=1.001, wrapped to its texture's
      ;; opaque first row and drew a black line across the race view.
      (br_if $done (i32.ge_s (local.get $y) (local.get $y2)))
      ;; Long edge: x0→x2 parameterized by dy_tot.
      (local.set $xb (i32.add (local.get $x0)
        (i32.div_s (i32.mul (i32.sub (local.get $x2) (local.get $x0))
                            (i32.sub (local.get $y)  (local.get $y0)))
                   (local.get $dy_tot))))
      (if (i32.lt_s (local.get $y) (local.get $y1))
        (then
          (if (i32.gt_s (local.get $dy_upper) (i32.const 0))
            (then (local.set $xa (i32.add (local.get $x0)
              (i32.div_s (i32.mul (i32.sub (local.get $x1) (local.get $x0))
                                  (i32.sub (local.get $y)  (local.get $y0)))
                         (local.get $dy_upper)))))
            (else (local.set $xa (local.get $x0)))))
        (else
          (if (i32.gt_s (local.get $dy_lower) (i32.const 0))
            (then (local.set $xa (i32.add (local.get $x1)
              (i32.div_s (i32.mul (i32.sub (local.get $x2) (local.get $x1))
                                  (i32.sub (local.get $y)  (local.get $y1)))
                         (local.get $dy_lower)))))
            (else (local.set $xa (local.get $x1))))))
      (local.set $xl (local.get $xa))
      (local.set $xr (local.get $xb))
      (if (i32.gt_s (local.get $xl) (local.get $xr)) (then
        (local.set $xl (local.get $xb))
        (local.set $xr (local.get $xa))))
      ;; Left-inclusive, right-exclusive [xl, xr), as the textured span is:
      ;; the inclusive width painted a shared vertical edge into both
      ;; neighbours, so whichever was drawn second stole that column. A row
      ;; whose edges meet (xl == xr) covers no pixel and draws nothing.
      (if (i32.gt_s (local.get $xr) (local.get $xl)) (then
      (if (local.get $zbuf_guest)
        (then (call $viewport_fill_rect_z (local.get $rt_entry) (local.get $zbuf_guest)
          (local.get $xl) (local.get $y)
          (i32.sub (local.get $xr) (local.get $xl))
          (i32.const 1) (local.get $zval) (local.get $color)
          (local.get $zfunc) (local.get $zwrite)))
        (else
          (if (local.get $blend)
            (then (call $viewport_fill_rect_alpha (local.get $rt_entry)
              (local.get $xl) (local.get $y)
              (i32.sub (local.get $xr) (local.get $xl))
              (i32.const 1) (local.get $color)
              (i32.shr_u (local.get $color) (i32.const 24))))
            (else (call $viewport_fill_rect (local.get $rt_entry)
              (local.get $xl) (local.get $y)
              (i32.sub (local.get $xr) (local.get $xl))
              (i32.const 1) (local.get $color))))))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $lp))))

  (func $rasterize_triangle_textured
    (param $rt_entry i32) (param $tex_entry i32)
    (param $blend i32) (param $src_blend i32) (param $dst_blend i32)
    (param $address_u i32) (param $address_v i32) (param $linear i32)
    (param $colorop i32) (param $alphaop i32) (param $color_key_enable i32)
    (param $alpha_test i32)
    (param $dither i32) (param $antialias i32)
    (param $x0 i32) (param $y0 i32) (param $u0 f32) (param $v0 f32) (param $q0 f32) (param $c0 i32) (param $z0 f32)
    (param $x1 i32) (param $y1 i32) (param $u1 f32) (param $v1 f32) (param $q1 f32) (param $c1 i32) (param $z1 f32)
    (param $x2 i32) (param $y2 i32) (param $u2 f32) (param $v2 f32) (param $q2 f32) (param $c2 i32) (param $z2 f32)
    (param $zbuf_guest i32) (param $zfunc i32) (param $zwrite i32)
    (param $texture_q0 f32) (param $texture_q1 f32) (param $texture_q2 f32)
    (local $tx i32) (local $ty i32) (local $tc i32) (local $tu f32) (local $tv f32) (local $tq f32) (local $tz f32)
    (local $y i32) (local $xa i32) (local $xb i32)
    (local $ua f32) (local $va f32) (local $qa f32) (local $za f32)
    (local $ub f32) (local $vb f32) (local $qb f32) (local $zb f32)
    (local $ca i32) (local $cb i32)
    (local $dy_tot i32) (local $dy_upper i32) (local $dy_lower i32) (local $t f32)
    ;; Carry u*rhw, v*rhw, and rhw through the affine edge walker. The span
    ;; divides by interpolated rhw, restoring perspective-correct UVs.
    (if (i32.or (f32.ne (local.get $q0) (local.get $q0))
          (f32.le (f32.abs (local.get $q0)) (f32.const 0.000000000001)))
      (then (local.set $q0 (f32.const 1.0))))
    (if (i32.or (f32.ne (local.get $q1) (local.get $q1))
          (f32.le (f32.abs (local.get $q1)) (f32.const 0.000000000001)))
      (then (local.set $q1 (f32.const 1.0))))
    (if (i32.or (f32.ne (local.get $q2) (local.get $q2))
          (f32.le (f32.abs (local.get $q2)) (f32.const 0.000000000001)))
      (then (local.set $q2 (f32.const 1.0))))
    (local.set $u0 (f32.mul (local.get $u0) (local.get $q0)))
    (local.set $v0 (f32.mul (local.get $v0) (local.get $q0)))
    (local.set $u1 (f32.mul (local.get $u1) (local.get $q1)))
    (local.set $v1 (f32.mul (local.get $v1) (local.get $q1)))
    (local.set $u2 (f32.mul (local.get $u2) (local.get $q2)))
    (local.set $v2 (f32.mul (local.get $v2) (local.get $q2)))
    ;; Numerators are u' / w and v' / w; the denominator is texture q / w.
    ;; The same rational planes feed sampling and quotient-rule mip gradients.
    (local.set $q0 (f32.mul (local.get $q0) (local.get $texture_q0)))
    (local.set $q1 (f32.mul (local.get $q1) (local.get $texture_q1)))
    (local.set $q2 (f32.mul (local.get $q2) (local.get $texture_q2)))
    (if (global.get $d3dim_mip_on) (then
      (call $rast_plane (local.get $x0) (local.get $y0) (local.get $u0) (local.get $x1) (local.get $y1) (local.get $u1) (local.get $x2) (local.get $y2) (local.get $u2))
      (global.set $d3dim_mip_ua (global.get $rast_pa))
      (global.set $d3dim_mip_ub (global.get $rast_pb))
      (global.set $d3dim_mip_uc (global.get $rast_pc))
      (call $rast_plane (local.get $x0) (local.get $y0) (local.get $v0) (local.get $x1) (local.get $y1) (local.get $v1) (local.get $x2) (local.get $y2) (local.get $v2))
      (global.set $d3dim_mip_va (global.get $rast_pa))
      (global.set $d3dim_mip_vb (global.get $rast_pb))
      (global.set $d3dim_mip_vc (global.get $rast_pc))
      (call $rast_plane (local.get $x0) (local.get $y0) (local.get $q0) (local.get $x1) (local.get $y1) (local.get $q1) (local.get $x2) (local.get $y2) (local.get $q2))
      (global.set $d3dim_mip_qa (global.get $rast_pa))
      (global.set $d3dim_mip_qb (global.get $rast_pb))
      (global.set $d3dim_mip_qc (global.get $rast_pc))
    ))
    ;; Sampling and quotient-rule LOD use the same unrounded rational planes.
    (if (global.get $d3dim_sample_on) (then
      (global.set $d3dim_mip_ua (global.get $d3dim_sample_ua))
      (global.set $d3dim_mip_ub (global.get $d3dim_sample_ub))
      (global.set $d3dim_mip_uc (global.get $d3dim_sample_uc))
      (global.set $d3dim_mip_va (global.get $d3dim_sample_va))
      (global.set $d3dim_mip_vb (global.get $d3dim_sample_vb))
      (global.set $d3dim_mip_vc (global.get $d3dim_sample_vc))
      (global.set $d3dim_mip_qa (global.get $d3dim_sample_qa))
      (global.set $d3dim_mip_qb (global.get $d3dim_sample_qb))
      (global.set $d3dim_mip_qc (global.get $d3dim_sample_qc))
    ))
    ;; Sort by y, carrying all attributes with the screen-space vertices.
    (if (i32.gt_s (local.get $y0) (local.get $y1)) (then
      (local.set $tx (local.get $x0)) (local.set $ty (local.get $y0))
      (local.set $tu (local.get $u0)) (local.set $tv (local.get $v0)) (local.set $tq (local.get $q0)) (local.set $tz (local.get $z0)) (local.set $tc (local.get $c0))
      (local.set $x0 (local.get $x1)) (local.set $y0 (local.get $y1))
      (local.set $u0 (local.get $u1)) (local.set $v0 (local.get $v1)) (local.set $q0 (local.get $q1)) (local.set $z0 (local.get $z1)) (local.set $c0 (local.get $c1))
      (local.set $x1 (local.get $tx)) (local.set $y1 (local.get $ty))
      (local.set $u1 (local.get $tu)) (local.set $v1 (local.get $tv)) (local.set $q1 (local.get $tq)) (local.set $z1 (local.get $tz)) (local.set $c1 (local.get $tc))))
    (if (i32.gt_s (local.get $y1) (local.get $y2)) (then
      (local.set $tx (local.get $x1)) (local.set $ty (local.get $y1))
      (local.set $tu (local.get $u1)) (local.set $tv (local.get $v1)) (local.set $tq (local.get $q1)) (local.set $tz (local.get $z1)) (local.set $tc (local.get $c1))
      (local.set $x1 (local.get $x2)) (local.set $y1 (local.get $y2))
      (local.set $u1 (local.get $u2)) (local.set $v1 (local.get $v2)) (local.set $q1 (local.get $q2)) (local.set $z1 (local.get $z2)) (local.set $c1 (local.get $c2))
      (local.set $x2 (local.get $tx)) (local.set $y2 (local.get $ty))
      (local.set $u2 (local.get $tu)) (local.set $v2 (local.get $tv)) (local.set $q2 (local.get $tq)) (local.set $z2 (local.get $tz)) (local.set $c2 (local.get $tc))))
    (if (i32.gt_s (local.get $y0) (local.get $y1)) (then
      (local.set $tx (local.get $x0)) (local.set $ty (local.get $y0))
      (local.set $tu (local.get $u0)) (local.set $tv (local.get $v0)) (local.set $tq (local.get $q0)) (local.set $tz (local.get $z0)) (local.set $tc (local.get $c0))
      (local.set $x0 (local.get $x1)) (local.set $y0 (local.get $y1))
      (local.set $u0 (local.get $u1)) (local.set $v0 (local.get $v1)) (local.set $q0 (local.get $q1)) (local.set $z0 (local.get $z1)) (local.set $c0 (local.get $c1))
      (local.set $x1 (local.get $tx)) (local.set $y1 (local.get $ty))
      (local.set $u1 (local.get $tu)) (local.set $v1 (local.get $tv)) (local.set $q1 (local.get $tq)) (local.set $z1 (local.get $tz)) (local.set $c1 (local.get $tc))))
    (local.set $dy_tot   (i32.sub (local.get $y2) (local.get $y0)))
    (local.set $dy_upper (i32.sub (local.get $y1) (local.get $y0)))
    (local.set $dy_lower (i32.sub (local.get $y2) (local.get $y1)))
    (if (i32.le_s (local.get $dy_tot) (i32.const 0)) (then
      (call $viewport_draw_textured_span
        (local.get $rt_entry) (local.get $tex_entry)
        (local.get $blend) (local.get $src_blend) (local.get $dst_blend)
        (local.get $address_u) (local.get $address_v) (local.get $linear) (local.get $colorop) (local.get $alphaop)
        (local.get $color_key_enable) (local.get $alpha_test)
        (local.get $dither) (local.get $antialias)
        (local.get $y0)
        (local.get $x0) (local.get $u0) (local.get $v0) (local.get $q0) (local.get $c0) (local.get $z0)
        (local.get $x1) (local.get $u1) (local.get $v1) (local.get $q1) (local.get $c1) (local.get $z1)
        (local.get $zbuf_guest) (local.get $zfunc) (local.get $zwrite))
      (call $viewport_draw_textured_span
        (local.get $rt_entry) (local.get $tex_entry)
        (local.get $blend) (local.get $src_blend) (local.get $dst_blend)
        (local.get $address_u) (local.get $address_v) (local.get $linear) (local.get $colorop) (local.get $alphaop)
        (local.get $color_key_enable) (local.get $alpha_test)
        (local.get $dither) (local.get $antialias)
        (local.get $y0)
        (local.get $x1) (local.get $u1) (local.get $v1) (local.get $q1) (local.get $c1) (local.get $z1)
        (local.get $x2) (local.get $u2) (local.get $v2) (local.get $q2) (local.get $c2) (local.get $z2)
        (local.get $zbuf_guest) (local.get $zfunc) (local.get $zwrite))
      (return)))
    (local.set $y (local.get $y0))
    (block $done (loop $lp
      ;; Top-left fill rule: a triangle owns its top scanline but not its bottom
      ;; one; the next triangle down owns that row. Drawing y2 too painted shared
      ;; horizontal edges twice: NFS III's 256x256 cockpit tiles meet at y=256 and
      ;; the upper tile's extra row sampled tv=1.001, wrapped to its texture's
      ;; opaque first row and drew a black line across the race view.
      (br_if $done (i32.ge_s (local.get $y) (local.get $y2)))
      (local.set $t (f32.div
        (f32.convert_i32_s (i32.sub (local.get $y) (local.get $y0)))
        (f32.convert_i32_s (local.get $dy_tot))))
      (local.set $xb (call $d3dim_coord_i (f32.add
        (f32.convert_i32_s (local.get $x0))
        (f32.mul (f32.convert_i32_s (i32.sub (local.get $x2) (local.get $x0))) (local.get $t)))))
      (local.set $ub (f32.add (local.get $u0) (f32.mul (f32.sub (local.get $u2) (local.get $u0)) (local.get $t))))
      (local.set $vb (f32.add (local.get $v0) (f32.mul (f32.sub (local.get $v2) (local.get $v0)) (local.get $t))))
      (local.set $qb (f32.add (local.get $q0) (f32.mul (f32.sub (local.get $q2) (local.get $q0)) (local.get $t))))
      (local.set $zb (f32.add (local.get $z0) (f32.mul (f32.sub (local.get $z2) (local.get $z0)) (local.get $t))))
      (local.set $cb (call $d3dim_color_lerp (local.get $c0) (local.get $c2) (local.get $t)))
      (if (i32.lt_s (local.get $y) (local.get $y1))
        (then
          (if (i32.gt_s (local.get $dy_upper) (i32.const 0))
            (then
              (local.set $t (f32.div
                (f32.convert_i32_s (i32.sub (local.get $y) (local.get $y0)))
                (f32.convert_i32_s (local.get $dy_upper))))
              (local.set $xa (call $d3dim_coord_i (f32.add
                (f32.convert_i32_s (local.get $x0))
                (f32.mul (f32.convert_i32_s (i32.sub (local.get $x1) (local.get $x0))) (local.get $t)))))
              (local.set $ua (f32.add (local.get $u0) (f32.mul (f32.sub (local.get $u1) (local.get $u0)) (local.get $t))))
              (local.set $va (f32.add (local.get $v0) (f32.mul (f32.sub (local.get $v1) (local.get $v0)) (local.get $t))))
              (local.set $qa (f32.add (local.get $q0) (f32.mul (f32.sub (local.get $q1) (local.get $q0)) (local.get $t))))
              (local.set $za (f32.add (local.get $z0) (f32.mul (f32.sub (local.get $z1) (local.get $z0)) (local.get $t))))
              (local.set $ca (call $d3dim_color_lerp (local.get $c0) (local.get $c1) (local.get $t))))
            (else
              (local.set $xa (local.get $x0))
              (local.set $ua (local.get $u0))
              (local.set $va (local.get $v0))
              (local.set $qa (local.get $q0))
              (local.set $za (local.get $z0))
              (local.set $ca (local.get $c0)))))
        (else
          (if (i32.gt_s (local.get $dy_lower) (i32.const 0))
            (then
              (local.set $t (f32.div
                (f32.convert_i32_s (i32.sub (local.get $y) (local.get $y1)))
                (f32.convert_i32_s (local.get $dy_lower))))
              (local.set $xa (call $d3dim_coord_i (f32.add
                (f32.convert_i32_s (local.get $x1))
                (f32.mul (f32.convert_i32_s (i32.sub (local.get $x2) (local.get $x1))) (local.get $t)))))
              (local.set $ua (f32.add (local.get $u1) (f32.mul (f32.sub (local.get $u2) (local.get $u1)) (local.get $t))))
              (local.set $va (f32.add (local.get $v1) (f32.mul (f32.sub (local.get $v2) (local.get $v1)) (local.get $t))))
              (local.set $qa (f32.add (local.get $q1) (f32.mul (f32.sub (local.get $q2) (local.get $q1)) (local.get $t))))
              (local.set $za (f32.add (local.get $z1) (f32.mul (f32.sub (local.get $z2) (local.get $z1)) (local.get $t))))
              (local.set $ca (call $d3dim_color_lerp (local.get $c1) (local.get $c2) (local.get $t))))
            (else
              (local.set $xa (local.get $x1))
              (local.set $ua (local.get $u1))
              (local.set $va (local.get $v1))
              (local.set $qa (local.get $q1))
              (local.set $za (local.get $z1))
              (local.set $ca (local.get $c1))))))
      ;; Left-inclusive, right-exclusive: the span covers [min(xa,xb), max).
      ;; $viewport_draw_textured_span keeps one pixel for a zero-width span
      ;; (GL lines and points rely on that), but a triangle row whose edges
      ;; meet covers no pixel centre: drawing it put the apex of a triangle
      ;; whose right edge is a shared vertical edge into its neighbour's
      ;; first column.
      (if (i32.ne (local.get $xa) (local.get $xb)) (then
      (call $viewport_draw_textured_span
        (local.get $rt_entry) (local.get $tex_entry)
        (local.get $blend) (local.get $src_blend) (local.get $dst_blend)
        (local.get $address_u) (local.get $address_v) (local.get $linear) (local.get $colorop) (local.get $alphaop)
        (local.get $color_key_enable) (local.get $alpha_test)
        (local.get $dither) (local.get $antialias)
        (local.get $y)
        (local.get $xa) (local.get $ua) (local.get $va) (local.get $qa) (local.get $ca) (local.get $za)
        (local.get $xb) (local.get $ub) (local.get $vb) (local.get $qb) (local.get $cb) (local.get $zb)
        (local.get $zbuf_guest) (local.get $zfunc) (local.get $zwrite))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $lp))))

  ;; ── DrawPrimitive core (TLVERTEX) ──────────────────────────────
  ;; TLVERTEX layout (32 bytes): +0 sx f32, +4 sy f32, +8 sz f32, +12 rhw f32,
  ;;                             +16 color 0xAARRGGBB, +20 spec, +24 tu, +28 tv.
  ;; primType: 1=POINTLIST, 2=LINELIST, 3=LINESTRIP, 4=TRIANGLELIST,
  ;;           5=TRIANGLESTRIP, 6=TRIANGLEFAN.
  ;; vtxType:  1=VERTEX, 2=LVERTEX, 3=TLVERTEX.
  ;; Phase 2 supports only vtxType=TLVERTEX. Points still plot as 2×2 dots.
  (func $d3dim_draw_primitive
    (param $this i32) (param $primType i32) (param $vtxType i32)
    (param $lpvVertices i32) (param $dwVertexCount i32)
    (local $saved i32)
    (local.set $saved (global.get $d3dim_supplied_projection))
    (global.set $d3dim_supplied_projection
      (if (result i32) (i32.ge_u (local.get $vtxType) (i32.const 5))
        (then (i32.sub (local.get $vtxType) (i32.const 3)))
        (else (i32.eq (local.get $vtxType) (i32.const 4)))))
    (call $d3dim_clip_begin (local.get $this))
    (call $d3dim_draw_primitive_body (local.get $this) (local.get $primType) (local.get $vtxType)
      (local.get $lpvVertices) (local.get $dwVertexCount))
    (call $d3dim_clip_end)
    (global.set $d3dim_supplied_projection (local.get $saved)))

  (func $d3dim_draw_primitive_body
    (param $this i32) (param $primType i32) (param $vtxType i32)
    (param $lpvVertices i32) (param $dwVertexCount i32)
    (local $rt i32) (local $v_wa i32) (local $i i32) (local $n i32)
    (local $v0 i32) (local $v1 i32) (local $v2 i32)
    (local $x0 i32) (local $y0 i32) (local $x1 i32) (local $y1 i32) (local $x2 i32) (local $y2 i32)
    (local $col i32) (local $state_guest i32) (local $scratch_g i32) (local $scratch_wa i32) (local $src_wa i32)
    (local $size i32) (local $src_stride i32) (local $scratch_tl i32)
    (if (i32.or (i32.eqz (local.get $lpvVertices)) (i32.eqz (local.get $dwVertexCount)))
      (then (return)))
    (if (i32.or (i32.lt_u (local.get $vtxType) (i32.const 1))
                (i32.gt_u (local.get $vtxType) (i32.const 6)))
      (then (return)))
    (if (i32.lt_u (local.get $vtxType) (i32.const 3))
      (then
        (local.set $state_guest (call $d3ddev_state (local.get $this)))
        (if (i32.eqz (local.get $state_guest)) (then (return)))
        (local.set $size (i32.mul (local.get $dwVertexCount) (i32.const 32)))
        (if (i32.or (i32.eqz (local.get $size)) (i32.gt_u (local.get $size) (i32.const 0x400000)))
          (then (return)))
        ;; Grow-only per instance, like $d3dim_expand_buf: an alloc/free pair
        ;; per draw put $heap_arena_find + $heap_alloc at ~7% of an MCM race
        ;; window. The type-3 call below never comes back here.
        (if (i32.gt_u (local.get $size) (global.get $d3dim_xform_cap)) (then
          (if (global.get $d3dim_xform_buf)
            (then (call $heap_free (global.get $d3dim_xform_buf))))
          (global.set $d3dim_xform_cap (i32.const 0x10000))
          (block $sized (loop $grow
            (br_if $sized (i32.ge_u (global.get $d3dim_xform_cap) (local.get $size)))
            (global.set $d3dim_xform_cap (i32.shl (global.get $d3dim_xform_cap) (i32.const 1)))
            (br $grow)))
          (global.set $d3dim_xform_buf (call $heap_alloc (global.get $d3dim_xform_cap)))
          (if (i32.eqz (global.get $d3dim_xform_buf))
            (then (global.set $d3dim_xform_cap (i32.const 0))))))
        (local.set $scratch_g (global.get $d3dim_xform_buf))
        (if (i32.eqz (local.get $scratch_g)) (then (return)))
        (call $d3ddev_composite_wvp (local.get $state_guest))
        (call $d3dim_lights_refresh (local.get $state_guest))
        (local.set $src_stride (call $d3dim_vertex_type_stride (local.get $vtxType)))
        (local.set $src_wa (call $g2w (local.get $lpvVertices)))
        (local.set $scratch_wa (call $g2w (local.get $scratch_g)))
        (local.set $i (i32.const 0))
        (block $pdone (loop $plp
          (br_if $pdone (i32.ge_u (local.get $i) (local.get $dwVertexCount)))
          (call $d3dim_prepare_draw_vertex
            (local.get $state_guest)
            (local.get $vtxType)
            (i32.add (local.get $src_wa) (i32.mul (local.get $i) (local.get $src_stride)))
            (i32.add (local.get $scratch_wa) (i32.mul (local.get $i) (i32.const 32))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $plp)))
        (call $d3dim_draw_primitive
          (local.get $this) (local.get $primType)
          (select (i32.const 4) (i32.const 3) (call $d3dim_supplied_projected (local.get $state_guest)))
          (local.get $scratch_g) (local.get $dwVertexCount))
        (return)))
    (if (call $d3dim_worker_route (local.get $this) (local.get $primType)
          (local.get $lpvVertices) (local.get $dwVertexCount))
      (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $this)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $v_wa (call $g2w (local.get $lpvVertices)))
    ;; kind=17 DPBlend: v0 diffuse + the blend state in force. A full-screen
    ;; quad drawn with no texture looks identical in the API trace whether it is
    ;; an opaque fill or a translucent overlay we painted opaque -- only the
    ;; vertex alpha and SRCBLEND/DESTBLEND separate the two, and the JS tracer
    ;; cannot read a VirtualAlloc'd vertex pointer to find them.
    (local.set $state_guest (call $d3ddev_state (local.get $this)))
    ;; Near-plane clip scratch for the line paths. t0/t1/t2 in the state block
    ;; belong to the indexed helpers, which never run on this path.
    (if (local.get $state_guest) (then
      (local.set $scratch_tl (i32.add (call $g2w (local.get $state_guest)) (i32.const 3200)))))
    (if (local.get $state_guest)
      (then
        (call $host_dx_trace (i32.const 17) (local.get $primType)
          (i32.load (i32.add (local.get $v_wa) (i32.const 16)))
          (call $gl32 (i32.add (local.get $state_guest) (i32.const 364)))
          (i32.or (call $gl32 (i32.add (local.get $state_guest) (i32.const 332)))
                  (i32.shl (call $gl32 (i32.add (local.get $state_guest) (i32.const 336)))
                           (i32.const 16))))
        ;; kind=18 DPVtx: one line per vertex for small batches. A full-screen
        ;; quad and a degenerate off-screen one are the same four trace numbers
        ;; until the actual screen coords are visible.
        (if (i32.le_u (local.get $dwVertexCount) (i32.const 8))
          (then
            (local.set $i (i32.const 0))
            (block $vdone (loop $vlp
              (br_if $vdone (i32.ge_u (local.get $i) (local.get $dwVertexCount)))
              (call $host_dx_trace (i32.const 18) (local.get $i)
                (i32.load (i32.add (i32.add (local.get $v_wa) (i32.mul (local.get $i) (call $d3dim_tl_stride))) (i32.const 0)))
                (i32.load (i32.add (i32.add (local.get $v_wa) (i32.mul (local.get $i) (call $d3dim_tl_stride))) (i32.const 4)))
                (i32.load (i32.add (i32.add (local.get $v_wa) (i32.mul (local.get $i) (call $d3dim_tl_stride))) (i32.const 16))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $vlp)))))))
    (if (i32.eq (local.get $primType) (i32.const 1)) (then
      ;; POINTLIST — keep prior dot-plot behavior
      (local.set $i (i32.const 0))
      (block $pdone (loop $plp
        (br_if $pdone (i32.ge_u (local.get $i) (local.get $dwVertexCount)))
        (local.set $v0 (i32.add (local.get $v_wa) (i32.mul (local.get $i) (call $d3dim_tl_stride))))
        (call $viewport_fill_rect_rgba (local.get $rt)
          (call $d3dim_coord_i (f32.load (local.get $v0)))
          (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
          (i32.const 2) (i32.const 2)
          (i32.load (i32.add (local.get $v0) (i32.const 16))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $plp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 2)) (then
      ;; LINELIST — disjoint vertex pairs
      (local.set $n (i32.div_u (local.get $dwVertexCount) (i32.const 2)))
      (local.set $i (i32.const 0))
      (block $lldone (loop $lllp
        (br_if $lldone (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $v0 (i32.add (local.get $v_wa) (i32.mul (i32.mul (local.get $i) (i32.const 2)) (call $d3dim_tl_stride))))
        (call $d3dim_draw_tl_line (local.get $rt) (local.get $v0) (i32.add (local.get $v0) (call $d3dim_tl_stride)) (local.get $scratch_tl))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $lllp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 3)) (then
      ;; LINESTRIP — every consecutive vertex pair
      (if (i32.lt_u (local.get $dwVertexCount) (i32.const 2)) (then (return)))
      (local.set $n (i32.sub (local.get $dwVertexCount) (i32.const 1)))
      (local.set $i (i32.const 0))
      (block $lsdone (loop $lslp
        (br_if $lsdone (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $v0 (i32.add (local.get $v_wa) (i32.mul (local.get $i) (call $d3dim_tl_stride))))
        (call $d3dim_draw_tl_line (local.get $rt) (local.get $v0) (i32.add (local.get $v0) (call $d3dim_tl_stride)) (local.get $scratch_tl))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $lslp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 4)) (then
      ;; TRIANGLELIST
      (local.set $n (i32.div_u (local.get $dwVertexCount) (i32.const 3)))
      (local.set $i (i32.const 0))
      (block $tdone (loop $tlp
        (br_if $tdone (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $v0 (i32.add (local.get $v_wa) (i32.mul (i32.mul (local.get $i) (i32.const 3)) (call $d3dim_tl_stride))))
        (local.set $v1 (i32.add (local.get $v0) (call $d3dim_tl_stride)))
        (local.set $v2 (i32.add (local.get $v0) (i32.mul (call $d3dim_tl_stride) (i32.const 2))))
        (call $d3dim_draw_tl_triangle_dp (local.get $this) (local.get $rt) (i32.const 1)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $tlp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 5)) (then
      ;; TRIANGLESTRIP: indices (0,1,2),(1,2,3)…  (alternating winding ignored — flat fill)
      (if (i32.lt_u (local.get $dwVertexCount) (i32.const 3)) (then (return)))
      (local.set $n (i32.sub (local.get $dwVertexCount) (i32.const 2)))
      (local.set $i (i32.const 0))
      (block $sdone (loop $slp
        (br_if $sdone (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $v0 (i32.add (local.get $v_wa) (i32.mul (local.get $i) (call $d3dim_tl_stride))))
        (local.set $v1 (i32.add (local.get $v0) (call $d3dim_tl_stride)))
        (local.set $v2 (i32.add (local.get $v0) (i32.mul (call $d3dim_tl_stride) (i32.const 2))))
        ;; Odd i in a strip has inverted winding — swap v0/v1 so the cull test
        ;; sees a consistent front/back sign.
        (if (i32.and (local.get $i) (i32.const 1))
          (then
            (call $d3dim_draw_tl_triangle_dp (local.get $this) (local.get $rt) (i32.const 1)
              (local.get $v1) (local.get $v0) (local.get $v2)))
          (else
            (call $d3dim_draw_tl_triangle_dp (local.get $this) (local.get $rt) (i32.const 1)
              (local.get $v0) (local.get $v1) (local.get $v2))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $slp)))
      (return)))
    (if (i32.and
           (i32.ne (local.get $primType) (i32.const 6))
           (i32.and
             (i32.ne (local.get $primType) (i32.const 5))
             (i32.ne (local.get $primType) (i32.const 4))))
      (then
        (if (i32.ne (local.get $primType) (i32.const 1))
          (then (call $crash_unimplemented (global.get $D3DIM_UNIMPL_DRAW))))))
    (if (i32.eq (local.get $primType) (i32.const 6)) (then
      ;; TRIANGLEFAN: (0,1,2),(0,2,3)…
      (if (i32.lt_u (local.get $dwVertexCount) (i32.const 3)) (then (return)))
      (local.set $n (i32.sub (local.get $dwVertexCount) (i32.const 2)))
      (local.set $i (i32.const 0))
      (local.set $v0 (local.get $v_wa))
      (block $fdone (loop $flp
        (br_if $fdone (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $v1 (i32.add (local.get $v_wa) (i32.mul (i32.add (local.get $i) (i32.const 1)) (call $d3dim_tl_stride))))
        (local.set $v2 (i32.add (local.get $v1) (call $d3dim_tl_stride)))
        (call $d3dim_draw_tl_triangle_dp (local.get $this) (local.get $rt) (i32.const 1)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $flp))))) )

  ;; ── DrawIndexedPrimitive core (fixed-pipeline vertex transform) ─
  ;; Legacy DrawIndexedPrimitive commonly feeds D3DVERTEX/LVERTEX arrays and
  ;; relies on the device transforms instead of prebuilt TLVERTEX data.
  ;; D3D's vertex fog for a vertex the pipeline transforms: FOGENABLE (28) with
  ;; FOGTABLEMODE (35) NONE and FOGVERTEXMODE (140) LINEAR/EXP/EXP2, over the
  ;; eye depth d = w = 1/rhw that $vertex_project left at +12. Linear is
  ;; (FOGEND - d) / (FOGEND - FOGSTART); EXP e^(-density*d); EXP2
  ;; e^(-(density*d)^2); clamped and scaled to the 0..255 specular alpha.
  ;; 255 (no fog) whenever vertex fog is not in effect. Reference: wine-mirror
  ;; wine dlls/wined3d/device.c process_vertices.
  (func $d3dim_vertex_fog_alpha (param $state_guest i32) (param $tl_wa i32) (result i32)
    (local $sw i32) (local $mode i32) (local $rhw f32) (local $d f32) (local $f f32)
    (local $start f32) (local $end f32) (local $density f32)
    (local.set $sw (call $g2w (local.get $state_guest)))
    (if (i32.eqz (call $d3dim_d7_rs (local.get $sw) (i32.const 28))) (then (return (i32.const 255))))
    (if (call $d3dim_d7_rs (local.get $sw) (i32.const 35)) (then (return (i32.const 255))))
    (local.set $mode (call $d3dim_d7_rs (local.get $sw) (i32.const 140)))
    (if (i32.or (i32.eqz (local.get $mode)) (i32.gt_u (local.get $mode) (i32.const 3)))
      (then (return (i32.const 255))))
    (local.set $rhw (f32.load offset=12 (local.get $tl_wa)))
    (if (i32.eqz (f32.gt (local.get $rhw) (f32.const 0))) (then (return (i32.const 255))))
    (local.set $d (f32.div (f32.const 1) (local.get $rhw)))
    (if (i32.eq (local.get $mode) (i32.const 3))
      (then
        (local.set $start (f32.reinterpret_i32 (call $d3dim_d7_rs (local.get $sw) (i32.const 36))))
        (local.set $end (f32.reinterpret_i32 (call $d3dim_d7_rs (local.get $sw) (i32.const 37))))
        (if (f32.le (local.get $end) (local.get $start))
          (then (return (select (i32.const 0) (i32.const 255)
            (f32.ge (local.get $d) (local.get $end))))))
        (local.set $f (f32.div (f32.sub (local.get $end) (local.get $d))
                               (f32.sub (local.get $end) (local.get $start)))))
      (else
        (local.set $density (f32.mul
          (f32.reinterpret_i32 (call $d3dim_d7_rs (local.get $sw) (i32.const 38)))
          (local.get $d)))
        (if (i32.eq (local.get $mode) (i32.const 2))
          (then (local.set $density (f32.mul (local.get $density) (local.get $density)))))
        ;; e^-x = 2^(-x * log2 e)
        (local.set $f (f32.demote_f64 (call $host_math_pow2
          (f64.mul (f64.promote_f32 (f32.neg (local.get $density))) (f64.const 1.4426950408889634)))))))
    (local.set $f (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $f))))
    (i32.trunc_sat_f32_u (f32.nearest (f32.mul (local.get $f) (f32.const 255)))))

  ;; Stage 0 texture-coordinate generation for a vertex $vertex_project just
  ;; transformed (it left (x,y,z,1) at state +4032). D3DTSS_TEXCOORDINDEX's high
  ;; word picks the source: CAMERASPACEPOSITION (2) is the position, and
  ;; CAMERASPACENORMAL (1) the normal of a D3DVERTEX, through world*view.
  ;; Returns the raw generated vector, or 0 when coordinates are supplied.
  ;; Reflection (3) uses the camera-space position and
  ;; normal: R = 2*(N.V)*N - V, where V is the unit vector toward the camera.
  ;; Reference: Microsoft DX7 SDK, Configuring Automatically-Generated Texture
  ;; Coordinates (imover_9n38), and Texture Coordinate Processing Path (1hyc).
  (func $d3dim_texgen_input (param $state_guest i32) (param $vtxType i32) (param $src_wa i32) (result i32)
    (local $sw i32) (local $mode i32) (local $a i32) (local $b i32)
    (local $q f32)
    (local $nx f32) (local $ny f32) (local $nz f32)
    (local $vx f32) (local $vy f32) (local $vz f32) (local $dot f32)
    (local.set $mode (i32.shr_u
      (call $d3dim_tss_load (local.get $state_guest) (i32.const 0) (i32.const 11)) (i32.const 16)))
    (if (i32.eqz (local.get $mode)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $mode) (i32.const 3)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state_guest)))
    (local.set $a (i32.add (local.get $sw) (i32.const 4048)))
    (local.set $b (i32.add (local.get $sw) (i32.const 4080)))
    (if (i32.eq (local.get $mode) (i32.const 2))
      (then (call $mat4_transform_vec4 (local.get $a) (local.get $sw)
        (i32.add (local.get $sw) (i32.const 4032))))
      (else
        ;; Only a D3DVERTEX carries a normal (+12..+23).
        (if (i32.ne (local.get $vtxType) (i32.const 1)) (then (return (i32.const 0))))
        (f32.store (local.get $b) (f32.load offset=12 (local.get $src_wa)))
        (f32.store offset=4 (local.get $b) (f32.load offset=16 (local.get $src_wa)))
        (f32.store offset=8 (local.get $b) (f32.load offset=20 (local.get $src_wa)))
        (f32.store offset=12 (local.get $b) (f32.const 0))
        (call $mat4_transform_vec4 (local.get $a) (local.get $sw) (local.get $b))))
    ;; view @ +64
    (call $mat4_transform_vec4 (local.get $b) (i32.add (local.get $sw) (i32.const 64)) (local.get $a))
    (if (i32.eq (local.get $mode) (i32.const 3)) (then
      (local.set $nx (f32.load (local.get $b)))
      (local.set $ny (f32.load offset=4 (local.get $b)))
      (local.set $nz (f32.load offset=8 (local.get $b)))
      (if (call $d3dim_d7_rs (local.get $sw) (i32.const 143)) (then
        (local.set $q (f32.sqrt (f32.add (f32.add
          (f32.mul (local.get $nx) (local.get $nx)) (f32.mul (local.get $ny) (local.get $ny)))
          (f32.mul (local.get $nz) (local.get $nz)))))
        (if (f32.gt (local.get $q) (f32.const 0)) (then
          (local.set $nx (f32.div (local.get $nx) (local.get $q)))
          (local.set $ny (f32.div (local.get $ny) (local.get $q)))
          (local.set $nz (f32.div (local.get $nz) (local.get $q)))))))
      ;; Read the original XYZ directly: the colored-packing caller has not
      ;; projected this vertex, so +4032 need not contain its position.
      (memory.copy (local.get $b) (local.get $src_wa) (i32.const 12))
      (f32.store offset=12 (local.get $b) (f32.const 1))
      (call $mat4_transform_vec4 (local.get $a) (local.get $sw) (local.get $b))
      (call $mat4_transform_vec4 (local.get $b) (i32.add (local.get $sw) (i32.const 64)) (local.get $a))
      (local.set $vx (f32.neg (f32.load (local.get $b))))
      (local.set $vy (f32.neg (f32.load offset=4 (local.get $b))))
      (local.set $vz (f32.neg (f32.load offset=8 (local.get $b))))
      (local.set $q (f32.sqrt (f32.add (f32.add
        (f32.mul (local.get $vx) (local.get $vx)) (f32.mul (local.get $vy) (local.get $vy)))
        (f32.mul (local.get $vz) (local.get $vz)))))
      (if (f32.gt (local.get $q) (f32.const 0)) (then
        (local.set $vx (f32.div (local.get $vx) (local.get $q)))
        (local.set $vy (f32.div (local.get $vy) (local.get $q)))
        (local.set $vz (f32.div (local.get $vz) (local.get $q)))))
      (local.set $dot (f32.mul (f32.const 2) (f32.add (f32.add
        (f32.mul (local.get $nx) (local.get $vx)) (f32.mul (local.get $ny) (local.get $vy)))
        (f32.mul (local.get $nz) (local.get $vz)))))
      (f32.store (local.get $b) (f32.sub (f32.mul (local.get $dot) (local.get $nx)) (local.get $vx)))
      (f32.store offset=4 (local.get $b) (f32.sub (f32.mul (local.get $dot) (local.get $ny)) (local.get $vy)))
      (f32.store offset=8 (local.get $b) (f32.sub (f32.mul (local.get $dot) (local.get $nz)) (local.get $vz)))
      (f32.store offset=12 (local.get $b) (f32.const 0))))
    (local.get $b))

  ;; Apply the legacy ordinary-vector matrix/count behavior. PROJECTED FVF
  ;; draws use the raw input helper above and the extended rational consumer.
  (func $d3dim_texgen (param $state_guest i32) (param $vtxType i32) (param $src_wa i32) (result i32)
    (local $a i32) (local $b i32) (local $block i32)
    (local $flags i32) (local $count i32) (local $q f32)
    (local.set $b (call $d3dim_texgen_input (local.get $state_guest) (local.get $vtxType) (local.get $src_wa)))
    (if (i32.eqz (local.get $b)) (then (return (i32.const 0))))
    (local.set $a (i32.add (call $g2w (local.get $state_guest)) (i32.const 4048)))
    (local.set $block (call $gl32 (i32.add (local.get $state_guest) (i32.const 4024))))
    (if (local.get $block)
      (then (local.set $flags (call $gl32 (i32.add (local.get $block) (i32.const 512))))))
    (local.set $count (i32.and (local.get $flags) (i32.const 0xFF)))
    (if (i32.or (i32.eqz (local.get $count)) (i32.gt_u (local.get $count) (i32.const 4)))
      (then (return (local.get $b))))
    (f32.store offset=12 (local.get $b) (f32.const 1))
    (call $mat4_transform_vec4 (local.get $a) (call $g2w (local.get $block)) (local.get $b))
    (if (i32.and (local.get $flags) (i32.const 0x100)) (then
      (local.set $q (f32.load (i32.add (local.get $a)
        (i32.shl (i32.sub (local.get $count) (i32.const 1)) (i32.const 2)))))
      (if (f32.ne (local.get $q) (f32.const 0)) (then
        (f32.store (local.get $a) (f32.div (f32.load (local.get $a)) (local.get $q)))
        (f32.store offset=4 (local.get $a) (f32.div (f32.load offset=4 (local.get $a)) (local.get $q)))))))
    (local.get $a))

  (func $d3dim_prepare_draw_vertex
    (param $state_guest i32) (param $vtxType i32) (param $src_wa i32) (param $dst_wa i32)
    (local $color i32) (local $spec i32) (local $tu i32) (local $tv i32) (local $gen i32)
    (if (i32.eq (local.get $vtxType) (i32.const 3)) (then
      (call $memcpy (local.get $dst_wa) (local.get $src_wa) (i32.const 32))
      (return)))
    (if (i32.eq (local.get $vtxType) (i32.const 2))
      (then
        (local.set $color (i32.load (i32.add (local.get $src_wa) (i32.const 16))))
        (local.set $spec  (i32.load (i32.add (local.get $src_wa) (i32.const 20))))
        (local.set $tu    (i32.load (i32.add (local.get $src_wa) (i32.const 24))))
        (local.set $tv    (i32.load (i32.add (local.get $src_wa) (i32.const 28)))))
      (else
        (local.set $color (call $d3dim_vertex_lit_color (local.get $state_guest) (local.get $src_wa)))
        ;; No specular colour is computed, and its alpha -- the fog factor
        ;; when FOGENABLE is on and no fog mode computes one -- is 255, no
        ;; fog. Zero fogged every D3D-lit vertex solid (Evolva's whole world).
        (local.set $spec  (i32.const 0xFF000000))
        (local.set $tu    (i32.load (i32.add (local.get $src_wa) (i32.const 24))))
        (local.set $tv    (i32.load (i32.add (local.get $src_wa) (i32.const 28))))))
    (call $vertex_project (local.get $state_guest) (local.get $src_wa) (local.get $dst_wa))
    ;; Stage 0's coordinates may be generated rather than supplied. Giants'
    ;; terrain is XYZ|DIFFUSE with no texture coordinates at all: it sets
    ;; TCI_CAMERASPACEPOSITION with a TEXTURE0 planar mapping, and without it
    ;; every ground vertex sampled texel (0,0).
    (local.set $gen (call $d3dim_texgen (local.get $state_guest) (local.get $vtxType) (local.get $src_wa)))
    (if (local.get $gen) (then
      (local.set $tu (i32.load (local.get $gen)))
      (local.set $tv (i32.load offset=4 (local.get $gen)))))
    ;; ...and when a fog vertex mode is in effect, that alpha is the
    ;; pipeline's computed fog factor instead ($d3dim_vertex_fog_alpha gives
    ;; 255 otherwise, the same default). Giants uses LINEAR vertex fog; with
    ;; alpha 0 its buildings drew in the flat fog colour. Pre-lit vertices
    ;; (type 2) keep the specular they supplied.
    (if (i32.ne (local.get $vtxType) (i32.const 2))
      (then (local.set $spec (i32.shl
        (call $d3dim_vertex_fog_alpha (local.get $state_guest) (local.get $dst_wa))
        (i32.const 24)))))
    (i32.store (i32.add (local.get $dst_wa) (i32.const 16)) (local.get $color))
    (i32.store (i32.add (local.get $dst_wa) (i32.const 20)) (local.get $spec))
    (i32.store (i32.add (local.get $dst_wa) (i32.const 24)) (local.get $tu))
    (i32.store (i32.add (local.get $dst_wa) (i32.const 28)) (local.get $tv)))

  (func $d3dim_prepare_indexed_vertex
    (param $state_guest i32) (param $vbase_wa i32) (param $ibase_wa i32)
    (param $dwVertexCount i32) (param $vtxType i32) (param $idx_pos i32) (param $dst_wa i32)
    (result i32)
    (local $idx i32) (local $src i32) (local $src_stride i32)
    (local.set $idx
      (i32.load16_u (i32.add (local.get $ibase_wa) (i32.mul (local.get $idx_pos) (i32.const 2)))))
    (if (i32.ge_u (local.get $idx) (local.get $dwVertexCount)) (then (return (i32.const 0))))
    (local.set $src_stride (call $d3dim_vertex_type_stride (local.get $vtxType)))
    (local.set $src (i32.add (local.get $vbase_wa) (i32.mul (local.get $idx) (local.get $src_stride))))
    (call $d3dim_prepare_draw_vertex
      (local.get $state_guest) (local.get $vtxType) (local.get $src) (local.get $dst_wa))
    (i32.const 1))

  (func $d3dim_draw_indexed_triangle
    (param $this i32) (param $rt i32) (param $state_guest i32)
    (param $vbase_wa i32) (param $ibase_wa i32)
    (param $dwVertexCount i32) (param $vtxType i32)
    (param $idx0 i32) (param $idx1 i32) (param $idx2 i32)
    (local $sw i32) (local $t0 i32) (local $t1 i32) (local $t2 i32)
    (local.set $sw (call $g2w (local.get $state_guest)))
    (local.set $t0 (i32.add (local.get $sw) (i32.const 3200)))
    (local.set $t1 (i32.add (local.get $sw) (i32.const 3232)))
    (local.set $t2 (i32.add (local.get $sw) (i32.const 3264)))
    (if (i32.eqz (call $d3dim_prepare_indexed_vertex
          (local.get $state_guest) (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $idx0) (local.get $t0)))
      (then (return)))
    (if (i32.eqz (call $d3dim_prepare_indexed_vertex
          (local.get $state_guest) (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $idx1) (local.get $t1)))
      (then (return)))
    (if (i32.eqz (call $d3dim_prepare_indexed_vertex
          (local.get $state_guest) (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $idx2) (local.get $t2)))
      (then (return)))
    ;; Indexed and unindexed triangles share the same terminal decision.  The
    ;; prepared TL vertices still need ordinary culling, but when stage 0 has a
    ;; live DirectDraw texture the rasterizer must consume their tu/tv fields.
    ;; Calling $d3dim_draw_tri_culled directly here discarded the binding and
    ;; flattened MW3's entire world to vertex diffuse colours.
    (call $d3dim_draw_tl_triangle_dp
      (local.get $this) (local.get $rt) (i32.const 1)
      (local.get $t0) (local.get $t1) (local.get $t2)))

  ;; ── Line and point primitives ─────────────────────────────────
  ;; D3DPT_LINELIST(2) and D3DPT_LINESTRIP(3) were never rasterized:
  ;; $d3dim_draw_primitive implemented POINTLIST and the three triangle types,
  ;; $d3dim_draw_indexed_primitive only the triangles, and every other primType
  ;; fell out the bottom of the if-chain having drawn nothing. The DX SDK
  ;; boids.exe draws its entire flock as indexed LINESTRIPs, so all ~7500 of its
  ;; draw calls per run were discarded and the frame stayed at the viewport
  ;; clear colour — a primary reading nonZero=1850/1850 but colors=1.
  ;;
  ;; Cohen-Sutherland clip to the render target, then Bresenham one pixel at a
  ;; time through $viewport_fill_rect so clipping, pitch and the 32/16/8bpp
  ;; store stay in exactly one place. Clipping first is what bounds the walk:
  ;; $d3dim_coord_i clamps to +/-1e6, and an off-screen segment between two such
  ;; extremes would otherwise step two million times to plot nothing. The
  ;; parametric intersections go through i64 because that same clamp makes the
  ;; (dx * dy) products overflow i32.
  (func $d3dim_line_i (param $rt i32) (param $x0 i32) (param $y0 i32)
        (param $x1 i32) (param $y1 i32) (param $color i32)
    (local $sw i32) (local $sh i32) (local $xmax i32) (local $ymax i32)
    (local $oc0 i32) (local $oc1 i32) (local $oc i32)
    (local $cx i32) (local $cy i32) (local $rounds i32)
    (local $dx i32) (local $dy i32) (local $sx i32) (local $sy i32)
    (local $err i32) (local $e2 i32)
    (local.set $sw (i32.and (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 0xFFFF)))
    (local.set $sh (i32.shr_u (i32.load (i32.add (local.get $rt) (i32.const 12))) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $sw)) (i32.eqz (local.get $sh))) (then (return)))
    (local.set $xmax (i32.sub (local.get $sw) (i32.const 1)))
    (local.set $ymax (i32.sub (local.get $sh) (i32.const 1)))
    ;; Clip. Each round moves one endpoint onto one edge, so four rounds is the
    ;; exact worst case; the counter is a belt-and-braces stop, not a policy.
    (local.set $rounds (i32.const 0))
    (block $clipped (loop $cliplp
      (local.set $oc0 (call $d3dim_line_outcode
        (local.get $x0) (local.get $y0) (local.get $xmax) (local.get $ymax)))
      (local.set $oc1 (call $d3dim_line_outcode
        (local.get $x1) (local.get $y1) (local.get $xmax) (local.get $ymax)))
      (br_if $clipped (i32.eqz (i32.or (local.get $oc0) (local.get $oc1))))
      ;; Both endpoints outside the same edge: the segment cannot cross the RT.
      (if (i32.and (local.get $oc0) (local.get $oc1)) (then (return)))
      (if (i32.ge_u (local.get $rounds) (i32.const 4)) (then (return)))
      (local.set $rounds (i32.add (local.get $rounds) (i32.const 1)))
      (local.set $oc (select (local.get $oc0) (local.get $oc1) (local.get $oc0)))
      (if (i32.and (local.get $oc) (i32.const 8))
        (then ;; below ymax
          (if (i32.eq (local.get $y1) (local.get $y0)) (then (return)))
          (local.set $cx (i32.add (local.get $x0) (i32.wrap_i64 (i64.div_s
            (i64.mul (i64.extend_i32_s (i32.sub (local.get $x1) (local.get $x0)))
                     (i64.extend_i32_s (i32.sub (local.get $ymax) (local.get $y0))))
            (i64.extend_i32_s (i32.sub (local.get $y1) (local.get $y0)))))))
          (local.set $cy (local.get $ymax)))
        (else (if (i32.and (local.get $oc) (i32.const 4))
          (then ;; above 0
            (if (i32.eq (local.get $y1) (local.get $y0)) (then (return)))
            (local.set $cx (i32.add (local.get $x0) (i32.wrap_i64 (i64.div_s
              (i64.mul (i64.extend_i32_s (i32.sub (local.get $x1) (local.get $x0)))
                       (i64.extend_i32_s (i32.sub (i32.const 0) (local.get $y0))))
              (i64.extend_i32_s (i32.sub (local.get $y1) (local.get $y0)))))))
            (local.set $cy (i32.const 0)))
          (else (if (i32.and (local.get $oc) (i32.const 2))
            (then ;; right of xmax
              (if (i32.eq (local.get $x1) (local.get $x0)) (then (return)))
              (local.set $cy (i32.add (local.get $y0) (i32.wrap_i64 (i64.div_s
                (i64.mul (i64.extend_i32_s (i32.sub (local.get $y1) (local.get $y0)))
                         (i64.extend_i32_s (i32.sub (local.get $xmax) (local.get $x0))))
                (i64.extend_i32_s (i32.sub (local.get $x1) (local.get $x0)))))))
              (local.set $cx (local.get $xmax)))
            (else ;; left of 0
              (if (i32.eq (local.get $x1) (local.get $x0)) (then (return)))
              (local.set $cy (i32.add (local.get $y0) (i32.wrap_i64 (i64.div_s
                (i64.mul (i64.extend_i32_s (i32.sub (local.get $y1) (local.get $y0)))
                         (i64.extend_i32_s (i32.sub (i32.const 0) (local.get $x0))))
                (i64.extend_i32_s (i32.sub (local.get $x1) (local.get $x0)))))))
              (local.set $cx (i32.const 0))))))))
      (if (local.get $oc0)
        (then (local.set $x0 (local.get $cx)) (local.set $y0 (local.get $cy)))
        (else (local.set $x1 (local.get $cx)) (local.set $y1 (local.get $cy))))
      (br $cliplp)))
    ;; Bresenham over the clipped segment.
    (local.set $dx (i32.sub (local.get $x1) (local.get $x0)))
    (if (i32.lt_s (local.get $dx) (i32.const 0))
      (then (local.set $dx (i32.sub (i32.const 0) (local.get $dx))) (local.set $sx (i32.const -1)))
      (else (local.set $sx (i32.const 1))))
    (local.set $dy (i32.sub (local.get $y1) (local.get $y0)))
    (if (i32.lt_s (local.get $dy) (i32.const 0))
      (then (local.set $sy (i32.const -1)))
      (else (local.set $dy (i32.sub (i32.const 0) (local.get $dy))) (local.set $sy (i32.const 1))))
    (local.set $err (i32.add (local.get $dx) (local.get $dy)))
    (block $done (loop $lp
      (call $viewport_fill_rect (local.get $rt)
        (local.get $x0) (local.get $y0) (i32.const 1) (i32.const 1) (local.get $color))
      (br_if $done (i32.and (i32.eq (local.get $x0) (local.get $x1))
                            (i32.eq (local.get $y0) (local.get $y1))))
      (local.set $e2 (i32.shl (local.get $err) (i32.const 1)))
      (if (i32.ge_s (local.get $e2) (local.get $dy)) (then
        (local.set $err (i32.add (local.get $err) (local.get $dy)))
        (local.set $x0 (i32.add (local.get $x0) (local.get $sx)))))
      (if (i32.le_s (local.get $e2) (local.get $dx)) (then
        (local.set $err (i32.add (local.get $err) (local.get $dx)))
        (local.set $y0 (i32.add (local.get $y0) (local.get $sy)))))
      (br $lp))))

  ;; bit0 left of 0, bit1 right of xmax, bit2 above 0, bit3 below ymax
  (func $d3dim_line_outcode (param $x i32) (param $y i32) (param $xmax i32) (param $ymax i32)
    (result i32)
    (i32.or
      (i32.or (select (i32.const 1) (i32.const 0) (i32.lt_s (local.get $x) (i32.const 0)))
              (select (i32.const 2) (i32.const 0) (i32.gt_s (local.get $x) (local.get $xmax))))
      (i32.or (select (i32.const 4) (i32.const 0) (i32.lt_s (local.get $y) (i32.const 0)))
              (select (i32.const 8) (i32.const 0) (i32.gt_s (local.get $y) (local.get $ymax))))))

  ;; Two TL vertices -> one screen-space line. Flat-shaded from v0's diffuse,
  ;; matching what the triangle path does with its own first vertex.
  ;;
  ;; Near-plane clip first, exactly as $d3dim_clip_tl_triangle does for its
  ;; three edges: rhw is 1/w, and a vertex at or behind the eye plane projects
  ;; to a screen coordinate with no bearing on where the segment actually goes.
  ;; Drawing those raw turns boids' flock into red and blue streaks across the
  ;; whole 640x480 frame, because a clipped-but-nonsense endpoint is still a
  ;; perfectly drawable line. $scratch is a 32-byte TL vertex slot, or 0 when
  ;; the caller has none — with no slot the only safe move is to drop the line.
  (func $d3dim_draw_tl_line (param $rt i32) (param $va i32) (param $vb i32) (param $scratch i32)
    (local $pa i32) (local $pb i32)
    (local.set $pa (f32.gt (f32.load (i32.add (local.get $va) (i32.const 12))) (f32.const 0.0)))
    (local.set $pb (f32.gt (f32.load (i32.add (local.get $vb) (i32.const 12))) (f32.const 0.0)))
    (if (i32.eqz (i32.or (local.get $pa) (local.get $pb))) (then (return)))
    (if (i32.eqz (i32.and (local.get $pa) (local.get $pb)))
      (then
        (if (i32.eqz (local.get $scratch)) (then (return)))
        ;; Interpolate the off-plane endpoint back onto the near plane. The
        ;; helper takes (kept, dropped, out) and walks the edge from the kept
        ;; vertex, so the argument order carries which of the two survived.
        (if (local.get $pa)
          (then
            (call $d3dim_interp_tl_vertex (local.get $va) (local.get $vb) (local.get $scratch))
            (local.set $vb (local.get $scratch)))
          (else
            (call $d3dim_interp_tl_vertex (local.get $vb) (local.get $va) (local.get $scratch))
            (local.set $va (local.get $scratch))))))
    (call $d3dim_line_i (local.get $rt)
      (call $d3dim_coord_i (f32.load (local.get $va)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $va) (i32.const 4))))
      (call $d3dim_coord_i (f32.load (local.get $vb)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $vb) (i32.const 4))))
      (i32.load (i32.add (local.get $va) (i32.const 16)))))

  (func $d3dim_draw_indexed_line
    (param $this i32) (param $rt i32) (param $state_guest i32)
    (param $vbase_wa i32) (param $ibase_wa i32)
    (param $dwVertexCount i32) (param $vtxType i32)
    (param $idx0 i32) (param $idx1 i32)
    (local $sw i32) (local $t0 i32) (local $t1 i32)
    (local.set $sw (call $g2w (local.get $state_guest)))
    (local.set $t0 (i32.add (local.get $sw) (i32.const 3200)))
    (local.set $t1 (i32.add (local.get $sw) (i32.const 3232)))
    (if (i32.eqz (call $d3dim_prepare_indexed_vertex
          (local.get $state_guest) (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $idx0) (local.get $t0)))
      (then (return)))
    (if (i32.eqz (call $d3dim_prepare_indexed_vertex
          (local.get $state_guest) (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $idx1) (local.get $t1)))
      (then (return)))
    (call $d3dim_draw_tl_line (local.get $rt) (local.get $t0) (local.get $t1)
      (i32.add (local.get $sw) (i32.const 3264))))

  ;; Indexed POINTLIST, matching the 2x2 dot the unindexed path plots.
  (func $d3dim_draw_indexed_point
    (param $this i32) (param $rt i32) (param $state_guest i32)
    (param $vbase_wa i32) (param $ibase_wa i32)
    (param $dwVertexCount i32) (param $vtxType i32) (param $idx0 i32)
    (local $t0 i32)
    (local.set $t0 (i32.add (call $g2w (local.get $state_guest)) (i32.const 3200)))
    (if (i32.eqz (call $d3dim_prepare_indexed_vertex
          (local.get $state_guest) (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $idx0) (local.get $t0)))
      (then (return)))
    (call $viewport_fill_rect_rgba (local.get $rt)
      (call $d3dim_coord_i (f32.load (local.get $t0)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $t0) (i32.const 4))))
      (i32.const 2) (i32.const 2)
      (i32.load (i32.add (local.get $t0) (i32.const 16)))))

  (func $d3dim_draw_indexed_primitive
    (param $this i32) (param $primType i32) (param $vtxType i32)
    (param $lpvVertices i32) (param $dwVertexCount i32)
    (param $lpwIndices i32) (param $dwIndexCount i32)
    (local $saved i32) (local $expanded i32) (local $i i32) (local $idx i32)
    (if (i32.ge_u (local.get $vtxType) (i32.const 5)) (then
      (if (i32.gt_u (local.get $dwIndexCount) (i32.const 104857)) (then (return)))
      (local.set $expanded (call $heap_alloc (i32.mul (local.get $dwIndexCount) (i32.const 40))))
      (if (i32.eqz (local.get $expanded)) (then (return)))
      (block $done (loop $lp
        (br_if $done (i32.ge_u (local.get $i) (local.get $dwIndexCount)))
        (local.set $idx (i32.load16_u (i32.add (call $g2w (local.get $lpwIndices)) (i32.shl (local.get $i) (i32.const 1)))))
        (if (i32.ge_u (local.get $idx) (local.get $dwVertexCount)) (then
          (call $heap_free (local.get $expanded)) (return)))
        (call $memcpy (i32.add (call $g2w (local.get $expanded)) (i32.mul (local.get $i) (i32.const 40)))
          (i32.add (call $g2w (local.get $lpvVertices)) (i32.mul (local.get $idx) (i32.const 40))) (i32.const 40))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $lp)))
      (call $d3dim_draw_primitive (local.get $this) (local.get $primType) (local.get $vtxType)
        (local.get $expanded) (local.get $dwIndexCount))
      (call $heap_free (local.get $expanded)) (return)))
    (local.set $saved (global.get $d3dim_supplied_projection))
    (global.set $d3dim_supplied_projection (i32.and
      (i32.lt_u (local.get $vtxType) (i32.const 3))
      (call $d3dim_supplied_projected (call $d3ddev_state (local.get $this)))))
    (call $d3dim_clip_begin (local.get $this))
    (call $d3dim_draw_indexed_primitive_body (local.get $this) (local.get $primType) (local.get $vtxType)
      (local.get $lpvVertices) (local.get $dwVertexCount)
      (local.get $lpwIndices) (local.get $dwIndexCount))
    (call $d3dim_clip_end)
    (global.set $d3dim_supplied_projection (local.get $saved)))

  (func $d3dim_draw_indexed_primitive_body
    (param $this i32) (param $primType i32) (param $vtxType i32)
    (param $lpvVertices i32) (param $dwVertexCount i32)
    (param $lpwIndices i32) (param $dwIndexCount i32)
    (local $rt i32) (local $state_guest i32) (local $vbase_wa i32) (local $ibase_wa i32)
    (local $i i32) (local $n i32)
    (if (i32.or
          (i32.or (i32.eqz (local.get $lpvVertices)) (i32.eqz (local.get $dwVertexCount)))
          (i32.or (i32.eqz (local.get $lpwIndices)) (i32.eqz (local.get $dwIndexCount))))
      (then (return)))
    (if (i32.or (i32.lt_u (local.get $vtxType) (i32.const 1))
                (i32.gt_u (local.get $vtxType) (i32.const 3)))
      (then (return)))
    (if (call $d3dim_worker_try_draw_indexed
          (local.get $this) (local.get $primType) (local.get $vtxType)
          (local.get $lpvVertices) (local.get $dwVertexCount)
          (local.get $lpwIndices) (local.get $dwIndexCount))
      (then (return)))
    ;; Rasterizing here: anything still queued must land first.
    (call $d3dim_worker_fence)
    (local.set $rt (call $d3ddev_rt_entry (local.get $this)))
    (local.set $state_guest (call $d3ddev_state (local.get $this)))
    (if (i32.or (i32.eqz (local.get $rt)) (i32.eqz (local.get $state_guest))) (then (return)))
    (call $d3ddev_composite_wvp (local.get $state_guest))
    (call $d3dim_lights_refresh (local.get $state_guest))
    (local.set $vbase_wa (call $g2w (local.get $lpvVertices)))
    (local.set $ibase_wa (call $g2w (local.get $lpwIndices)))
    (if (i32.eq (local.get $primType) (i32.const 1)) (then
      ;; POINTLIST
      (local.set $i (i32.const 0))
      (block $ipdone (loop $iplp
        (br_if $ipdone (i32.ge_u (local.get $i) (local.get $dwIndexCount)))
        (call $d3dim_draw_indexed_point
          (local.get $this) (local.get $rt) (local.get $state_guest)
          (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType) (local.get $i))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $iplp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 2)) (then
      ;; LINELIST — disjoint index pairs
      (local.set $n (i32.div_u (local.get $dwIndexCount) (i32.const 2)))
      (local.set $i (i32.const 0))
      (block $ildone (loop $illp
        (br_if $ildone (i32.ge_u (local.get $i) (local.get $n)))
        (call $d3dim_draw_indexed_line
          (local.get $this) (local.get $rt) (local.get $state_guest)
          (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType)
          (i32.mul (local.get $i) (i32.const 2))
          (i32.add (i32.mul (local.get $i) (i32.const 2)) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $illp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 3)) (then
      ;; LINESTRIP — every consecutive index pair
      (if (i32.lt_u (local.get $dwIndexCount) (i32.const 2)) (then (return)))
      (local.set $n (i32.sub (local.get $dwIndexCount) (i32.const 1)))
      (local.set $i (i32.const 0))
      (block $isdone (loop $islp
        (br_if $isdone (i32.ge_u (local.get $i) (local.get $n)))
        (call $d3dim_draw_indexed_line
          (local.get $this) (local.get $rt) (local.get $state_guest)
          (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType)
          (local.get $i) (i32.add (local.get $i) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $islp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 4)) (then
      ;; TRIANGLELIST
      (local.set $n (i32.div_u (local.get $dwIndexCount) (i32.const 3)))
      (local.set $i (i32.const 0))
      (block $tdone (loop $tlp
        (br_if $tdone (i32.ge_u (local.get $i) (local.get $n)))
        (call $d3dim_draw_indexed_triangle
          (local.get $this) (local.get $rt) (local.get $state_guest)
          (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType)
          (i32.mul (local.get $i) (i32.const 3))
          (i32.add (i32.mul (local.get $i) (i32.const 3)) (i32.const 1))
          (i32.add (i32.mul (local.get $i) (i32.const 3)) (i32.const 2)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $tlp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 5)) (then
      ;; TRIANGLESTRIP
      (if (i32.lt_u (local.get $dwIndexCount) (i32.const 3)) (then (return)))
      (local.set $n (i32.sub (local.get $dwIndexCount) (i32.const 2)))
      (local.set $i (i32.const 0))
      (block $sdone (loop $slp
        (br_if $sdone (i32.ge_u (local.get $i) (local.get $n)))
        (if (i32.and (local.get $i) (i32.const 1))
          (then
            (call $d3dim_draw_indexed_triangle
              (local.get $this) (local.get $rt) (local.get $state_guest)
              (local.get $vbase_wa) (local.get $ibase_wa)
              (local.get $dwVertexCount) (local.get $vtxType)
              (i32.add (local.get $i) (i32.const 1))
              (local.get $i)
              (i32.add (local.get $i) (i32.const 2))))
          (else
            (call $d3dim_draw_indexed_triangle
              (local.get $this) (local.get $rt) (local.get $state_guest)
              (local.get $vbase_wa) (local.get $ibase_wa)
              (local.get $dwVertexCount) (local.get $vtxType)
              (local.get $i)
              (i32.add (local.get $i) (i32.const 1))
              (i32.add (local.get $i) (i32.const 2)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $slp)))
      (return)))
    (if (i32.eq (local.get $primType) (i32.const 6)) (then
      ;; TRIANGLEFAN
      (if (i32.lt_u (local.get $dwIndexCount) (i32.const 3)) (then (return)))
      (local.set $n (i32.sub (local.get $dwIndexCount) (i32.const 2)))
      (local.set $i (i32.const 0))
      (block $fdone (loop $flp
        (br_if $fdone (i32.ge_u (local.get $i) (local.get $n)))
        (call $d3dim_draw_indexed_triangle
          (local.get $this) (local.get $rt) (local.get $state_guest)
          (local.get $vbase_wa) (local.get $ibase_wa)
          (local.get $dwVertexCount) (local.get $vtxType)
          (i32.const 0)
          (i32.add (local.get $i) (i32.const 1))
          (i32.add (local.get $i) (i32.const 2)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $flp))))))

  (func $d3dim_interp_tl_vertex (param $a i32) (param $b i32) (param $out i32)
    (local $t f32) (local $av f32) (local $bv f32)
    ;; Approximate homogeneous near-plane clipping in TL space. rhw is 1/w;
    ;; crossing through <=0 produces the giant screen-space bands seen in
    ;; D3DRM Globe. Intersect edges at a tiny positive rhw.
    (local.set $t
      (f32.div
        (f32.sub (f32.const 0.05) (f32.load (i32.add (local.get $a) (i32.const 12))))
        (f32.sub (f32.load (i32.add (local.get $b) (i32.const 12)))
                 (f32.load (i32.add (local.get $a) (i32.const 12))))))
    ;; This is an approximation in already-projected TL space. Keep its edge
    ;; parameter on the actual segment so nearly parallel eye-plane crossings
    ;; cannot generate NaN/inf or enormous coordinates.
    (if (f32.ne (local.get $t) (local.get $t)) (then (local.set $t (f32.const 0.0))))
    (if (f32.lt (local.get $t) (f32.const 0.0)) (then (local.set $t (f32.const 0.0))))
    (if (f32.gt (local.get $t) (f32.const 1.0)) (then (local.set $t (f32.const 1.0))))
    (local.set $av (f32.load (local.get $a)))
    (local.set $bv (f32.load (local.get $b)))
    (f32.store (local.get $out) (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (local.set $av (f32.load (i32.add (local.get $a) (i32.const 4))))
    (local.set $bv (f32.load (i32.add (local.get $b) (i32.const 4))))
    (f32.store (i32.add (local.get $out) (i32.const 4))
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (local.set $av (f32.load (i32.add (local.get $a) (i32.const 8))))
    (local.set $bv (f32.load (i32.add (local.get $b) (i32.const 8))))
    (f32.store (i32.add (local.get $out) (i32.const 8))
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (f32.store (i32.add (local.get $out) (i32.const 12)) (f32.const 0.05))
    (i32.store (i32.add (local.get $out) (i32.const 16))
      (call $d3dim_color_lerp
        (i32.load (i32.add (local.get $a) (i32.const 16)))
        (i32.load (i32.add (local.get $b) (i32.const 16))) (local.get $t)))
    (i32.store (i32.add (local.get $out) (i32.const 20))
      (call $d3dim_color_lerp
        (i32.load (i32.add (local.get $a) (i32.const 20)))
        (i32.load (i32.add (local.get $b) (i32.const 20))) (local.get $t)))
    (local.set $av (f32.load (i32.add (local.get $a) (i32.const 24))))
    (local.set $bv (f32.load (i32.add (local.get $b) (i32.const 24))))
    (f32.store (i32.add (local.get $out) (i32.const 24))
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (local.set $av (f32.load (i32.add (local.get $a) (i32.const 28))))
    (local.set $bv (f32.load (i32.add (local.get $b) (i32.const 28))))
    (f32.store (i32.add (local.get $out) (i32.const 28))
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
      (local.set $av (f32.load offset=32 (local.get $a)))
      (local.set $bv (f32.load offset=32 (local.get $b)))
      (f32.store offset=32 (local.get $out)
        (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))))
    (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
      (local.set $av (f32.load offset=36 (local.get $a)))
      (local.set $bv (f32.load offset=36 (local.get $b)))
      (f32.store offset=36 (local.get $out)
        (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t)))))))

  (func $d3dim_draw_tl_triangle
    (param $this i32) (param $rt i32) (param $use_z i32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (local $white i32)
    ;; An untextured face is drawn as the shared white texel MODULATEd by the
    ;; vertex colours: Gouraud colour, per-pixel depth, the device's blend
    ;; factors and vertex fog, which is what the GPU arm gives it. The flat
    ;; single-colour path below is only the fallback when no texel exists.
    (local.set $white (call $rast_white_texel))
    (if (local.get $white) (then
        (if (call $d3dim_cull_tri (local.get $this)
              (call $d3dim_coord_i (f32.load (local.get $v0)))
              (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
              (call $d3dim_coord_i (f32.load (local.get $v1)))
              (call $d3dim_coord_i (f32.load (i32.add (local.get $v1) (i32.const 4))))
              (call $d3dim_coord_i (f32.load (local.get $v2)))
              (call $d3dim_coord_i (f32.load (i32.add (local.get $v2) (i32.const 4)))))
          (then (return)))
        (call $d3dim_draw_tl_triangle_textured
          (local.get $this) (local.get $rt) (local.get $white) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (return)))
    (call $d3dim_draw_tri_culled (local.get $this) (local.get $rt) (local.get $use_z) (i32.const 1)
      (call $d3dim_coord_i (f32.load (local.get $v0)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
      (f32.load (i32.add (local.get $v0) (i32.const 8)))
      (call $d3dim_coord_i (f32.load (local.get $v1)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $v1) (i32.const 4))))
      (f32.load (i32.add (local.get $v1) (i32.const 8)))
      (call $d3dim_coord_i (f32.load (local.get $v2)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $v2) (i32.const 4))))
      (f32.load (i32.add (local.get $v2) (i32.const 8)))
      (i32.load (i32.add (local.get $v0) (i32.const 16)))))

  ;; Stage MIN/MAG/MIP values take precedence over their legacy sources.
  ;; Legacy 3/4 use point texels, 5/6 bilinear; 3/5 select nearest mip,
  ;; 4/6 blend adjacent mips. NONE stays at level zero under minification.
  (func $d3dim_mip_filters (param $state i32)
    (local $min i32) (local $mag i32) (local $mip i32) (local $legacy i32)
    (local.set $min (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 17)))
    (local.set $mag (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 16)))
    (local.set $mip (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 18)))
    ;; D3D3/7 D3DTEXTUREMIPFILTER is NONE=1, POINT=2, LINEAR=3.
    ;; The renderer and native sampler use normalized NONE=0/POINT=1/LINEAR=2;
    ;; zero in the stored stage means unset, not a D3D8/9 filter enum.
    (if (local.get $mip) (then
      (local.set $mip (i32.sub (local.get $mip) (i32.const 1)))))
    (local.set $legacy (call $gl32 (i32.add (local.get $state) (i32.const 328))))
    (if (i32.eqz (local.get $min)) (then
      (local.set $min (select (i32.const 2) (i32.const 1)
        (i32.or (i32.eq (local.get $legacy) (i32.const 2))
          (i32.or (i32.eq (local.get $legacy) (i32.const 5)) (i32.eq (local.get $legacy) (i32.const 6))))))
      (if (i32.and (i32.eqz (local.get $mip))
            (i32.eqz (call $gl32 (i32.add (local.get $state) (i32.const 3940))))) (then
        (if (i32.and (i32.ge_u (local.get $legacy) (i32.const 3)) (i32.le_u (local.get $legacy) (i32.const 6)))
          (then (local.set $mip (select (i32.const 1) (i32.const 2)
            (i32.ne (i32.and (local.get $legacy) (i32.const 1)) (i32.const 0))))))))))
    (if (i32.eqz (local.get $mag)) (then
      (local.set $mag (call $gl32 (i32.add (local.get $state) (i32.const 324))))))
    (global.set $d3dim_mip_min (i32.eq (local.get $min) (i32.const 2)))
    (global.set $d3dim_mip_mag (i32.eq (local.get $mag) (i32.const 2)))
    (global.set $d3dim_mip_mip (local.get $mip))
    (global.set $d3dim_mip_on (i32.or (i32.ne (local.get $mip) (i32.const 0))
      (i32.ne (global.get $d3dim_mip_min) (global.get $d3dim_mip_mag)))))

  ;; Coverage rounds scanline endpoints; interpolation must not move the
  ;; attribute field with those endpoints. Supplied projected coordinates use
  ;; planes through the unrounded clipped TL vertices, sampled at integer
  ;; D3D pixel centres. Kept draw-local by the on flag around rasterization.
  (global $d3dim_sample_on (mut i32) (i32.const 0))
  (global $d3dim_sample_ua (mut f32) (f32.const 0))
  (global $d3dim_sample_ub (mut f32) (f32.const 0))
  (global $d3dim_sample_uc (mut f32) (f32.const 0))
  (global $d3dim_sample_va (mut f32) (f32.const 0))
  (global $d3dim_sample_vb (mut f32) (f32.const 0))
  (global $d3dim_sample_vc (mut f32) (f32.const 0))
  (global $d3dim_sample_qa (mut f32) (f32.const 0))
  (global $d3dim_sample_qb (mut f32) (f32.const 0))
  (global $d3dim_sample_qc (mut f32) (f32.const 0))
  (global $d3dim_sample_za (mut f32) (f32.const 0))
  (global $d3dim_sample_zb (mut f32) (f32.const 0))
  (global $d3dim_sample_zc (mut f32) (f32.const 0))
  ;; Gouraud RGB belongs to the stored floating TL positions, not rounded
  ;; coverage vertices or packed scanline endpoints. Keep clipped colour bytes,
  ;; alpha, fog and output truncation unchanged. Anchor the affine displacement
  ;; at c0 so constant channels remain exact even with a fractional determinant.
  (global $d3dim_color_on (mut i32) (i32.const 0))
  (global $d3dim_color_ra (mut f32) (f32.const 0))
  (global $d3dim_color_rb (mut f32) (f32.const 0))
  (global $d3dim_color_rc (mut f32) (f32.const 0))
  (global $d3dim_color_ga (mut f32) (f32.const 0))
  (global $d3dim_color_gb (mut f32) (f32.const 0))
  (global $d3dim_color_gc (mut f32) (f32.const 0))
  (global $d3dim_color_ba (mut f32) (f32.const 0))
  (global $d3dim_color_bb (mut f32) (f32.const 0))
  (global $d3dim_color_bc (mut f32) (f32.const 0))
  (global $d3dim_color_pa (mut f32) (f32.const 0))
  (global $d3dim_color_pb (mut f32) (f32.const 0))
  (global $d3dim_color_pc (mut f32) (f32.const 0))
  (global $d3dim_color_x (mut f32) (f32.const 0))
  (global $d3dim_color_y (mut f32) (f32.const 0))
  (global $d3dim_color_det (mut f32) (f32.const 0))
  (func $d3dim_color_channel_plane (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (param $c0 i32) (param $c1 i32) (param $c2 i32) (param $shift i32)
    (local $dx1 f32) (local $dy1 f32) (local $dx2 f32) (local $dy2 f32)
    (local $f0 f32) (local $df1 f32) (local $df2 f32) (local $det f32)
    (global.set $d3dim_color_x (f32.load (local.get $v0)))
    (global.set $d3dim_color_y (f32.load offset=4 (local.get $v0)))
    (local.set $dx1 (f32.sub (f32.load (local.get $v1)) (global.get $d3dim_color_x)))
    (local.set $dy1 (f32.sub (f32.load offset=4 (local.get $v1)) (global.get $d3dim_color_y)))
    (local.set $dx2 (f32.sub (f32.load (local.get $v2)) (global.get $d3dim_color_x)))
    (local.set $dy2 (f32.sub (f32.load offset=4 (local.get $v2)) (global.get $d3dim_color_y)))
    (local.set $f0 (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c0) (local.get $shift)) (i32.const 255))))
    (local.set $df1 (f32.sub (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c1) (local.get $shift)) (i32.const 255))) (local.get $f0)))
    (local.set $df2 (f32.sub (f32.convert_i32_u (i32.and (i32.shr_u (local.get $c2) (local.get $shift)) (i32.const 255))) (local.get $f0)))
    (local.set $det (f32.sub (f32.mul (local.get $dx1) (local.get $dy2)) (f32.mul (local.get $dx2) (local.get $dy1))))
    ;; No unique affine field at exact zero: retain the existing span path.
    (if (f32.eq (local.get $det) (f32.const 0)) (then
      (global.set $d3dim_color_on (i32.const 0))
      (local.set $det (f32.const 1))))
    (global.set $d3dim_color_det (local.get $det))
    (global.set $d3dim_color_pa (f32.sub (f32.mul (local.get $df1) (local.get $dy2)) (f32.mul (local.get $df2) (local.get $dy1))))
    (global.set $d3dim_color_pb (f32.sub (f32.mul (local.get $dx1) (local.get $df2)) (f32.mul (local.get $dx2) (local.get $df1))))
    (global.set $d3dim_color_pc (local.get $f0)))
  (func $d3dim_color_plane (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (param $c0 i32) (param $c1 i32) (param $c2 i32)
    (global.set $d3dim_color_on (i32.const 1))
    (call $d3dim_color_channel_plane (local.get $v0) (local.get $v1) (local.get $v2) (local.get $c0) (local.get $c1) (local.get $c2) (i32.const 16))
    (global.set $d3dim_color_ra (global.get $d3dim_color_pa))
    (global.set $d3dim_color_rb (global.get $d3dim_color_pb))
    (global.set $d3dim_color_rc (global.get $d3dim_color_pc))
    (call $d3dim_color_channel_plane (local.get $v0) (local.get $v1) (local.get $v2) (local.get $c0) (local.get $c1) (local.get $c2) (i32.const 8))
    (global.set $d3dim_color_ga (global.get $d3dim_color_pa))
    (global.set $d3dim_color_gb (global.get $d3dim_color_pb))
    (global.set $d3dim_color_gc (global.get $d3dim_color_pc))
    (call $d3dim_color_channel_plane (local.get $v0) (local.get $v1) (local.get $v2) (local.get $c0) (local.get $c1) (local.get $c2) (i32.const 0))
    (global.set $d3dim_color_ba (global.get $d3dim_color_pa))
    (global.set $d3dim_color_bb (global.get $d3dim_color_pb))
    (global.set $d3dim_color_bc (global.get $d3dim_color_pc)))
  (func $d3dim_color_channel (param $x i32) (param $y i32)
    (param $a f32) (param $b f32) (param $c f32) (result f32)
    (f32.add (local.get $c) (f32.div (f32.add
      (f32.mul (local.get $a) (f32.sub (f32.convert_i32_s (local.get $x)) (global.get $d3dim_color_x)))
      (f32.mul (local.get $b) (f32.sub (f32.convert_i32_s (local.get $y)) (global.get $d3dim_color_y))))
      (global.get $d3dim_color_det))))
  (func $d3dim_sample_color (param $x i32) (param $y i32) (result i32)
    (local $vr v128) (local $v16 v128)
    ;; Retain color_lerp's literal conversion, including its signed-input
    ;; saturating narrows. A clamp before truncation differs when a nearly
    ;; collinear field extrapolates far outside byte range at rounded coverage.
    (local.set $vr (i32x4.trunc_sat_f32x4_u
      (f32x4.replace_lane 2 (f32x4.replace_lane 1 (f32x4.replace_lane 0 (f32x4.splat (f32.const 0))
        (call $d3dim_color_channel (local.get $x) (local.get $y) (global.get $d3dim_color_ba) (global.get $d3dim_color_bb) (global.get $d3dim_color_bc)))
        (call $d3dim_color_channel (local.get $x) (local.get $y) (global.get $d3dim_color_ga) (global.get $d3dim_color_gb) (global.get $d3dim_color_gc)))
        (call $d3dim_color_channel (local.get $x) (local.get $y) (global.get $d3dim_color_ra) (global.get $d3dim_color_rb) (global.get $d3dim_color_rc)))))
    (local.set $v16 (i16x8.narrow_i32x4_u (local.get $vr) (i32x4.splat (i32.const 0))))
    (i32x4.extract_lane 0 (i8x16.narrow_i16x8_u (local.get $v16) (i16x8.splat (i32.const 0)))))
  (func $d3dim_sample_plane
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (param $f0 f32) (param $f1 f32) (param $f2 f32)
    (local $x0 f32) (local $y0 f32) (local $dx1 f32) (local $dy1 f32)
    (local $dx2 f32) (local $dy2 f32) (local $df1 f32) (local $df2 f32) (local $det f32)
    (local.set $x0 (f32.load (local.get $v0)))
    (local.set $y0 (f32.load offset=4 (local.get $v0)))
    (local.set $dx1 (f32.sub (f32.load (local.get $v1)) (local.get $x0)))
    (local.set $dy1 (f32.sub (f32.load offset=4 (local.get $v1)) (local.get $y0)))
    (local.set $dx2 (f32.sub (f32.load (local.get $v2)) (local.get $x0)))
    (local.set $dy2 (f32.sub (f32.load offset=4 (local.get $v2)) (local.get $y0)))
    (local.set $df1 (f32.sub (local.get $f1) (local.get $f0)))
    (local.set $df2 (f32.sub (local.get $f2) (local.get $f0)))
    (local.set $det (f32.sub (f32.mul (local.get $dx1) (local.get $dy2))
      (f32.mul (local.get $dx2) (local.get $dy1))))
    (global.set $rast_pa (f32.const 0))
    (global.set $rast_pb (f32.const 0))
    (if (f32.gt (f32.abs (local.get $det)) (f32.const 0.000000000001)) (then
      (global.set $rast_pa (f32.div
        (f32.sub (f32.mul (local.get $df1) (local.get $dy2)) (f32.mul (local.get $df2) (local.get $dy1))) (local.get $det)))
      (global.set $rast_pb (f32.div
        (f32.sub (f32.mul (local.get $dx1) (local.get $df2)) (f32.mul (local.get $dx2) (local.get $df1))) (local.get $det)))))
    (global.set $rast_pc (f32.sub (local.get $f0)
      (f32.add (f32.mul (global.get $rast_pa) (local.get $x0))
        (f32.mul (global.get $rast_pb) (local.get $y0))))))

  (func $d3dim_draw_tl_triangle_textured
    (param $this i32) (param $rt i32) (param $tex i32) (param $use_z i32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (local $state i32) (local $zbuf i32) (local $zfunc i32) (local $zwrite i32)
    (local $blend i32) (local $src_blend i32) (local $dst_blend i32)
    (local $address_u i32) (local $address_v i32) (local $linear i32)
    (local $colorop i32) (local $alphaop i32) (local $filter i32) (local $shade i32)
    (local $dither i32) (local $antialias i32)
    (local $c0 i32) (local $c1 i32) (local $c2 i32)
    (local $color_key_enable i32) (local $alpha_test i32) (local $fog i32)
    (local $wrap i32)
    (local $u0 f32) (local $u1 f32) (local $u2 f32)
    (local $t0 f32) (local $t1 f32) (local $t2 f32)
    (local $texture_q0 f32) (local $texture_q1 f32) (local $texture_q2 f32)
    (local $matrix i32) (local $input i32) (local $output i32)
    (global.set $d3dim_mip_on (i32.const 0))
    (if (i32.eqz (local.get $tex)) (then
      (call $d3dim_draw_tl_triangle
        (local.get $this) (local.get $rt) (local.get $use_z)
        (local.get $v0) (local.get $v1) (local.get $v2))
      (return)))
    (local.set $u0 (f32.load (i32.add (local.get $v0) (i32.const 24))))
    (local.set $t0 (f32.load (i32.add (local.get $v0) (i32.const 28))))
    (local.set $u1 (f32.load (i32.add (local.get $v1) (i32.const 24))))
    (local.set $t1 (f32.load (i32.add (local.get $v1) (i32.const 28))))
    (local.set $u2 (f32.load (i32.add (local.get $v2) (i32.const 24))))
    (local.set $t2 (f32.load (i32.add (local.get $v2) (i32.const 28))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (local.set $texture_q0 (f32.const 1))
    (local.set $texture_q1 (f32.const 1))
    (local.set $texture_q2 (f32.const 1))
    ;; Linear transforms commute with homogeneous clipping. Keep the supplied
    ;; components intact until here, then interpolate both numerators and q.
    (if (global.get $d3dim_supplied_projection) (then
      (local.set $matrix (call $d3dim_supplied_matrix (local.get $state)))
      (local.set $input (i32.add (call $g2w (local.get $state)) (i32.const 4048)))
      (local.set $output (i32.add (call $g2w (local.get $state)) (i32.const 4080)))
      (f32.store offset=8 (local.get $input) (f32.const 0))
      (f32.store offset=12 (local.get $input) (f32.const 1))
      (f32.store (local.get $input) (local.get $u0))
      (f32.store offset=4 (local.get $input) (local.get $t0))
      (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
        (i64.store offset=8 (local.get $input) (i64.load offset=32 (local.get $v0)))) )
      (call $mat4_transform_vec4 (local.get $output) (local.get $matrix) (local.get $input))
      (local.set $u0 (f32.load (local.get $output)))
      (local.set $t0 (f32.load offset=4 (local.get $output)))
      (if (i32.ne (global.get $d3dim_supplied_projection) (i32.const 3)) (then
        (local.set $texture_q0 (f32.load offset=8 (local.get $output)))))
      (f32.store (local.get $input) (local.get $u1))
      (f32.store offset=4 (local.get $input) (local.get $t1))
      (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
        (i64.store offset=8 (local.get $input) (i64.load offset=32 (local.get $v1)))) )
      (call $mat4_transform_vec4 (local.get $output) (local.get $matrix) (local.get $input))
      (local.set $u1 (f32.load (local.get $output)))
      (local.set $t1 (f32.load offset=4 (local.get $output)))
      (if (i32.ne (global.get $d3dim_supplied_projection) (i32.const 3)) (then
        (local.set $texture_q1 (f32.load offset=8 (local.get $output)))))
      (f32.store (local.get $input) (local.get $u2))
      (f32.store offset=4 (local.get $input) (local.get $t2))
      (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
        (i64.store offset=8 (local.get $input) (i64.load offset=32 (local.get $v2)))) )
      (call $mat4_transform_vec4 (local.get $output) (local.get $matrix) (local.get $input))
      (local.set $u2 (f32.load (local.get $output)))
      (local.set $t2 (f32.load offset=4 (local.get $output)))
      (if (i32.ne (global.get $d3dim_supplied_projection) (i32.const 3)) (then
        (local.set $texture_q2 (f32.load offset=8 (local.get $output)))))
    ))
    ;; Cylindrical wrapping: WRAPU/WRAPV take the short way across the seam.
    (local.set $wrap (call $d3dim_wrap_flags (local.get $state)))
    (if (i32.and (local.get $wrap) (i32.const 1)) (then
      (local.set $u1 (call $d3dim_wrap_coord (local.get $u1) (local.get $u0)))
      (local.set $u2 (call $d3dim_wrap_coord (local.get $u2) (local.get $u0)))))
    (if (i32.and (local.get $wrap) (i32.const 2)) (then
      (local.set $t1 (call $d3dim_wrap_coord (local.get $t1) (local.get $t0)))
      (local.set $t2 (call $d3dim_wrap_coord (local.get $t2) (local.get $t0)))))
    (if (local.get $state) (then
      (local.set $blend (call $gl32 (i32.add (local.get $state) (i32.const 364))))
      (local.set $src_blend (call $gl32 (i32.add (local.get $state) (i32.const 332))))
      (local.set $dst_blend (call $gl32 (i32.add (local.get $state) (i32.const 336))))
      (local.set $color_key_enable (i32.ne
        (call $gl32 (i32.add (local.get $state) (i32.const 420))) (i32.const 0)))
      (if (i32.and (local.get $color_key_enable)
            (i32.eq (call $gl32 (i32.add (local.get $state) (i32.const 832))) (i32.const 1)))
        (then (local.set $color_key_enable (i32.const 2))))
      ;; ALPHATESTENABLE=15 (offset 316), ALPHAREF=24 (352), ALPHAFUNC=25 (356).
      ;; ALPHAREF is a DWORD whose low byte is the 0..255 reference.
      (if (call $gl32 (i32.add (local.get $state) (i32.const 316))) (then
        (local.set $alpha_test (i32.or
          (i32.and (call $gl32 (i32.add (local.get $state) (i32.const 356))) (i32.const 0xFF))
          (i32.shl (i32.and (call $gl32 (i32.add (local.get $state) (i32.const 352)))
                            (i32.const 0xFF))
                   (i32.const 8))))
        ;; An enabled test with no ALPHAFUNC set is ALWAYS; keep it packed
        ;; non-zero only when it can actually reject something.
        (if (i32.eqz (i32.and (local.get $alpha_test) (i32.const 0xFF)))
          (then (local.set $alpha_test (i32.const 0))))))
      ;; D3DRENDERSTATE_DITHERENABLE=26, ANTIALIAS=2.
      (local.set $dither (call $gl32 (i32.add (local.get $state) (i32.const 360))))
      (local.set $antialias (call $gl32 (i32.add (local.get $state) (i32.const 264))))
      (local.set $colorop (call $d3dim_stage_operation (local.get $state) (i32.const 1)))
      (local.set $alphaop (call $d3dim_stage_operation (local.get $state) (i32.const 4)))
      (local.set $address_u (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 13)))
      (local.set $address_v (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 14)))
      (call $d3dim_mip_filters (local.get $state))
      (local.set $linear (global.get $d3dim_mip_mag))
      (local.set $shade (call $gl32 (i32.add (local.get $state) (i32.const 292))))
      ;; Vertex fog: FOGENABLE=28 (offset 368) with FOGTABLEMODE=35 (396)
      ;; NONE. A TL vertex carries its own factor in the specular alpha.
      (local.set $fog (call $d3dim_vertex_fog_on (local.get $this)))
      ))
    ;; The white texel stands in for "no texture": the face is its diffuse
    ;; colour and alpha, whatever stage 0 says about a texture it does not have.
    (if (i32.eq (local.get $tex) (global.get $gl_sw_white)) (then
      (local.set $colorop (i32.const 4))
      (local.set $alphaop (i32.const 4))
      (local.set $color_key_enable (i32.const 0))
      (local.set $linear (i32.const 0))
      (global.set $d3dim_mip_on (i32.const 0))))
    (if (i32.eqz (local.get $address_u)) (then (local.set $address_u (i32.const 1))))
    (if (i32.eqz (local.get $address_v)) (then (local.set $address_v (i32.const 1))))
    (if (i32.eqz (local.get $src_blend)) (then (local.set $src_blend (i32.const 2))))
    (if (i32.eqz (local.get $dst_blend)) (then (local.set $dst_blend (i32.const 1))))
    ;; Legacy paired source factors override the destination selection.
    ;; Lower at draw time, preserving raw public state and queued snapshots,
    ;; just as the D3DIM GPU executor does before submitting its draw.
    (if (i32.eq (local.get $src_blend) (i32.const 12)) (then
      (local.set $src_blend (i32.const 5)) (local.set $dst_blend (i32.const 6))))
    (if (i32.eq (local.get $src_blend) (i32.const 13)) (then
      (local.set $src_blend (i32.const 6)) (local.set $dst_blend (i32.const 5))))
    (if (local.get $use_z) (then
      (if (local.get $state) (then
        (if (call $gl32 (i32.add (local.get $state) (i32.const 284))) (then
          (local.set $zbuf (call $d3dim_ensure_zbuffer (local.get $this)))
          (local.set $zfunc (call $gl32 (i32.add (local.get $state) (i32.const 348))))
          (local.set $zwrite (call $gl32 (i32.add (local.get $state) (i32.const 312))))))))))
    (if (i32.eqz (local.get $zfunc)) (then (local.set $zfunc (i32.const 4))))
    (if (i32.and
          (i32.eq (local.get $zfunc) (i32.const 8))
          (i32.eqz (local.get $zwrite)))
      (then (local.set $zbuf (i32.const 0))))
    (local.set $c0 (i32.load (i32.add (local.get $v0) (i32.const 16))))
    (local.set $c1 (i32.load (i32.add (local.get $v1) (i32.const 16))))
    (local.set $c2 (i32.load (i32.add (local.get $v2) (i32.const 16))))
    ;; D3DSHADE_FLAT = 1. The provoking vertex supplies the face colour;
    ;; Gouraud and legacy Phong quality continue through the interpolator.
    (if (i32.eq (local.get $shade) (i32.const 1)) (then
      (local.set $c1 (local.get $c0))
      (local.set $c2 (local.get $c0))))
    (if (local.get $fog) (then
      (call $rast_fog_plane
        (call $d3dim_coord_i (f32.load (local.get $v0)))
        (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
        (call $d3dim_fog_factor (local.get $v0))
        (call $d3dim_coord_i (f32.load (local.get $v1)))
        (call $d3dim_coord_i (f32.load (i32.add (local.get $v1) (i32.const 4))))
        (call $d3dim_fog_factor (local.get $v1))
        (call $d3dim_coord_i (f32.load (local.get $v2)))
        (call $d3dim_coord_i (f32.load (i32.add (local.get $v2) (i32.const 4))))
        (call $d3dim_fog_factor (local.get $v2))
        (call $gl32 (i32.add (local.get $state) (i32.const 392))))))
    (global.set $d3dim_sample_on (i32.ne (global.get $d3dim_supplied_projection) (i32.const 0)))
    (global.set $d3dim_color_on (i32.const 0))
    (if (i32.ne (i32.and (i32.or
          (i32.xor (local.get $c0) (local.get $c1))
          (i32.xor (local.get $c0) (local.get $c2))) (i32.const 0x00FFFFFF)) (i32.const 0)) (then
      (call $d3dim_color_plane (local.get $v0) (local.get $v1) (local.get $v2)
        (local.get $c0) (local.get $c1) (local.get $c2))))
    (if (global.get $d3dim_sample_on) (then
      (call $d3dim_sample_plane (local.get $v0) (local.get $v1) (local.get $v2) (f32.mul (local.get $u0) (f32.load offset=12 (local.get $v0))) (f32.mul (local.get $u1) (f32.load offset=12 (local.get $v1))) (f32.mul (local.get $u2) (f32.load offset=12 (local.get $v2))))
      (global.set $d3dim_sample_ua (global.get $rast_pa))
      (global.set $d3dim_sample_ub (global.get $rast_pb))
      (global.set $d3dim_sample_uc (global.get $rast_pc))
      (call $d3dim_sample_plane (local.get $v0) (local.get $v1) (local.get $v2) (f32.mul (local.get $t0) (f32.load offset=12 (local.get $v0))) (f32.mul (local.get $t1) (f32.load offset=12 (local.get $v1))) (f32.mul (local.get $t2) (f32.load offset=12 (local.get $v2))))
      (global.set $d3dim_sample_va (global.get $rast_pa))
      (global.set $d3dim_sample_vb (global.get $rast_pb))
      (global.set $d3dim_sample_vc (global.get $rast_pc))
      (call $d3dim_sample_plane (local.get $v0) (local.get $v1) (local.get $v2) (f32.mul (local.get $texture_q0) (f32.load offset=12 (local.get $v0))) (f32.mul (local.get $texture_q1) (f32.load offset=12 (local.get $v1))) (f32.mul (local.get $texture_q2) (f32.load offset=12 (local.get $v2))))
      (global.set $d3dim_sample_qa (global.get $rast_pa))
      (global.set $d3dim_sample_qb (global.get $rast_pb))
      (global.set $d3dim_sample_qc (global.get $rast_pc))
      (call $d3dim_sample_plane (local.get $v0) (local.get $v1) (local.get $v2) (f32.load offset=8 (local.get $v0)) (f32.load offset=8 (local.get $v1)) (f32.load offset=8 (local.get $v2)))
      (global.set $d3dim_sample_za (global.get $rast_pa))
      (global.set $d3dim_sample_zb (global.get $rast_pb))
      (global.set $d3dim_sample_zc (global.get $rast_pc))
      (if (local.get $fog) (then
        (call $d3dim_sample_plane (local.get $v0) (local.get $v1) (local.get $v2)
          (call $d3dim_fog_factor (local.get $v0))
          (call $d3dim_fog_factor (local.get $v1))
          (call $d3dim_fog_factor (local.get $v2)))
        (global.set $rast_fog_a (global.get $rast_pa))
        (global.set $rast_fog_b (global.get $rast_pb))
        (global.set $rast_fog_c (global.get $rast_pc))))))
    (call $rasterize_triangle_textured
      (local.get $rt) (local.get $tex)
      (local.get $blend) (local.get $src_blend) (local.get $dst_blend)
      (local.get $address_u) (local.get $address_v) (local.get $linear)
      (local.get $colorop) (local.get $alphaop) (local.get $color_key_enable)
      (local.get $alpha_test)
      (local.get $dither) (local.get $antialias)
      (call $d3dim_coord_i (f32.load (local.get $v0)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
      (local.get $u0)
      (local.get $t0)
      (f32.load (i32.add (local.get $v0) (i32.const 12)))
      (local.get $c0)
      (f32.load (i32.add (local.get $v0) (i32.const 8)))
      (call $d3dim_coord_i (f32.load (local.get $v1)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $v1) (i32.const 4))))
      (local.get $u1)
      (local.get $t1)
      (f32.load (i32.add (local.get $v1) (i32.const 12)))
      (local.get $c1)
      (f32.load (i32.add (local.get $v1) (i32.const 8)))
      (call $d3dim_coord_i (f32.load (local.get $v2)))
      (call $d3dim_coord_i (f32.load (i32.add (local.get $v2) (i32.const 4))))
      (local.get $u2)
      (local.get $t2)
      (f32.load (i32.add (local.get $v2) (i32.const 12)))
      (local.get $c2)
      (f32.load (i32.add (local.get $v2) (i32.const 8)))
      (local.get $zbuf) (local.get $zfunc) (local.get $zwrite)
      (local.get $texture_q0) (local.get $texture_q1) (local.get $texture_q2))
    (global.set $d3dim_sample_on (i32.const 0))
    (global.set $d3dim_color_on (i32.const 0))
    (global.set $d3dim_mip_on (i32.const 0))
    (global.set $rast_fog_on (i32.const 0)))

  ;; D3D texture wrapping for stage 0: bit 0 = U, bit 1 = V. DX5 and earlier
  ;; say it with D3DRENDERSTATE_WRAPU/WRAPV (5/6); DX6+ with WRAP0 (128),
  ;; whose D3DWRAP_U/D3DWRAP_V bits are the same 1/2. Nine of thirteen small
  ;; D3DIM apps set one (DX SDK Globe, Twist, Tunnel, Boids, five Plus!98
  ;; savers) -- a sphere's texture seam otherwise interpolates backwards
  ;; across the whole map in one strip of triangles.
  (func $d3dim_wrap_flags (param $state i32) (result i32)
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (i32.or
      (i32.or
        (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 276))) (i32.const 0))
        (i32.shl (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 280))) (i32.const 0))
                 (i32.const 1)))
      (i32.and (call $gl32 (i32.add (local.get $state) (i32.const 768))) (i32.const 3))))

  ;; Move $c to whichever of c-1, c, c+1 lies within half a texture of $ref.
  (func $d3dim_wrap_coord (param $c f32) (param $ref f32) (result f32)
    (if (f32.gt (f32.sub (local.get $c) (local.get $ref)) (f32.const 0.5))
      (then (return (f32.sub (local.get $c) (f32.const 1)))))
    (if (f32.gt (f32.sub (local.get $ref) (local.get $c)) (f32.const 0.5))
      (then (return (f32.add (local.get $c) (f32.const 1)))))
    (local.get $c))

  ;; Vertex fog: FOGENABLE=28 (offset 368) with FOGTABLEMODE=35 (396) NONE.
  (func $d3dim_vertex_fog_on (param $this i32) (result i32)
    (local $state i32)
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (i32.and
      (i32.ne (call $gl32 (i32.add (local.get $state) (i32.const 368))) (i32.const 0))
      (i32.eqz (call $gl32 (i32.add (local.get $state) (i32.const 396))))))

  ;; A TL vertex's fog factor: its specular alpha, 255 = no fog.
  (func $d3dim_fog_factor (param $v i32) (result f32)
    (f32.div
      (f32.convert_i32_u (i32.load8_u (i32.add (local.get $v) (i32.const 23))))
      (f32.const 255)))

  (func $d3dim_draw_tl_triangle_maybe_textured
    (param $this i32) (param $rt i32) (param $use_z i32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (local $tex i32)
    (local.set $tex (call $d3dim_bound_texture_entry (local.get $this)))
    (if (local.get $tex)
      (then
        (call $d3dim_draw_tl_triangle_textured
          (local.get $this) (local.get $rt) (local.get $tex) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2)))
      (else
        (call $d3dim_draw_tl_triangle
          (local.get $this) (local.get $rt) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2)))))

  ;; Signed homogeneous clip distance reconstructed from a projected TL
  ;; vertex. Plane 0 is D3D's near plane z>=0; plane 1 is its far plane z<=w.
  ;; Both inequalities together imply positive w, so a behind-eye endpoint can
  ;; enter through either plane and must not be forced onto z=0.
  (func $d3dim_tl_clip_distance (param $v i32) (param $plane i32) (result f32)
    (local $q f32) (local $z f32)
    (local.set $q (f32.load (i32.add (local.get $v) (i32.const 12))))
    (local.set $z (f32.load (i32.add (local.get $v) (i32.const 8))))
    (if (i32.eqz (local.get $plane))
      (then (return (f32.div (local.get $z) (local.get $q)))))
    (f32.div (f32.sub (f32.const 1.0) (local.get $z)) (local.get $q)))

  ;; Intersect a projected edge with one of the homogeneous depth planes.
  ;; vertex_project retains screen x/y, z/w, and 1/w. Reconstruct clip x/y/w,
  ;; interpolate there, then project the generated TL vertex back to screen.
  (func $d3dim_interp_tl_clip_vertex
    (param $state i32) (param $a i32) (param $b i32) (param $out i32) (param $plane i32)
    (local $sw i32) (local $qa f32) (local $qb f32)
    (local $wa f32) (local $wb f32) (local $da f32) (local $db f32)
    (local $t f32) (local $w f32) (local $cx f32) (local $cy f32)
    (local $av f32) (local $bv f32)
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $qa (f32.load (i32.add (local.get $a) (i32.const 12))))
    (local.set $qb (f32.load (i32.add (local.get $b) (i32.const 12))))
    (local.set $wa (f32.div (f32.const 1.0) (local.get $qa)))
    (local.set $wb (f32.div (f32.const 1.0) (local.get $qb)))
    (local.set $da (call $d3dim_tl_clip_distance (local.get $a) (local.get $plane)))
    (local.set $db (call $d3dim_tl_clip_distance (local.get $b) (local.get $plane)))
    (local.set $t (f32.div (local.get $da) (f32.sub (local.get $da) (local.get $db))))
    (if (f32.ne (local.get $t) (local.get $t)) (then (local.set $t (f32.const 0.0))))
    (if (f32.lt (local.get $t) (f32.const 0.0)) (then (local.set $t (f32.const 0.0))))
    (if (f32.gt (local.get $t) (f32.const 1.0)) (then (local.set $t (f32.const 1.0))))
    (local.set $w (f32.add (local.get $wa)
      (f32.mul (f32.sub (local.get $wb) (local.get $wa)) (local.get $t))))
    (if (f32.lt (f32.abs (local.get $w)) (f32.const 0.001))
      (then (local.set $w (f32.const 0.001))))
    ;; clip x = ((screen x - origin x) / scale x) * w
    (local.set $av (f32.mul
      (f32.div
        (f32.sub (f32.load (local.get $a))
          (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))))
        (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))))
      (local.get $wa)))
    (local.set $bv (f32.mul
      (f32.div
        (f32.sub (f32.load (local.get $b))
          (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN))))
        (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))))
      (local.get $wb)))
    (local.set $cx (f32.add (local.get $av)
      (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    ;; Screen y used origin - ndc*scale, hence the reversed numerator.
    (local.set $av (f32.mul
      (f32.div
        (f32.sub
          (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4))))
          (f32.load (i32.add (local.get $a) (i32.const 4))))
        (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))))
      (local.get $wa)))
    (local.set $bv (f32.mul
      (f32.div
        (f32.sub
          (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4))))
          (f32.load (i32.add (local.get $b) (i32.const 4))))
        (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))))
      (local.get $wb)))
    (local.set $cy (f32.add (local.get $av)
      (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (f32.store (local.get $out)
      (f32.add
        (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN)))
        (f32.mul (f32.div (local.get $cx) (local.get $w))
          (f32.load (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE))))))
    (f32.store (i32.add (local.get $out) (i32.const 4))
      (f32.sub
        (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4))))
        (f32.mul (f32.div (local.get $cy) (local.get $w))
          (f32.load (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4)))))))
    (f32.store (i32.add (local.get $out) (i32.const 8))
      (if (result f32) (i32.eqz (local.get $plane))
        (then (f32.const 0.0))
        (else (f32.const 1.0))))
    (f32.store (i32.add (local.get $out) (i32.const 12)) (f32.div (f32.const 1.0) (local.get $w)))
    (i32.store (i32.add (local.get $out) (i32.const 16))
      (call $d3dim_color_lerp
        (i32.load (i32.add (local.get $a) (i32.const 16)))
        (i32.load (i32.add (local.get $b) (i32.const 16))) (local.get $t)))
    (i32.store (i32.add (local.get $out) (i32.const 20))
      (call $d3dim_color_lerp
        (i32.load (i32.add (local.get $a) (i32.const 20)))
        (i32.load (i32.add (local.get $b) (i32.const 20))) (local.get $t)))
    (local.set $av (f32.load (i32.add (local.get $a) (i32.const 24))))
    (local.set $bv (f32.load (i32.add (local.get $b) (i32.const 24))))
    (f32.store (i32.add (local.get $out) (i32.const 24))
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (local.set $av (f32.load (i32.add (local.get $a) (i32.const 28))))
    (local.set $bv (f32.load (i32.add (local.get $b) (i32.const 28))))
    (f32.store (i32.add (local.get $out) (i32.const 28))
      (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))
    (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
      (local.set $av (f32.load offset=32 (local.get $a)))
      (local.set $bv (f32.load offset=32 (local.get $b)))
      (f32.store offset=32 (local.get $out)
        (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t))))))
    (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
      (local.set $av (f32.load offset=36 (local.get $a)))
      (local.set $bv (f32.load offset=36 (local.get $b)))
      (f32.store offset=36 (local.get $out)
        (f32.add (local.get $av) (f32.mul (f32.sub (local.get $bv) (local.get $av)) (local.get $t)))))))

  ;; Clip one convex TL polygon against one depth plane. The direct path starts
  ;; with three vertices; one plane can add at most one, and the second can add
  ;; at most one more, so both caller-owned arrays are bounded to five records.
  (func $d3dim_clip_tl_polygon
    (param $state i32) (param $in i32) (param $count i32)
    (param $out i32) (param $plane i32) (result i32)
    (local $i i32) (local $prev i32) (local $cur i32) (local $dst i32)
    (local $prev_d f32) (local $cur_d f32)
    (local $prev_in i32) (local $cur_in i32) (local $out_count i32)
    (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
    (local.set $prev (i32.add (local.get $in)
      (i32.mul (i32.sub (local.get $count) (i32.const 1)) (call $d3dim_tl_stride))))
    (local.set $prev_d (call $d3dim_tl_clip_distance (local.get $prev) (local.get $plane)))
    (local.set $prev_in (f32.ge (local.get $prev_d) (f32.const 0.0)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $cur (i32.add (local.get $in) (i32.mul (local.get $i) (call $d3dim_tl_stride))))
      (local.set $cur_d (call $d3dim_tl_clip_distance (local.get $cur) (local.get $plane)))
      (local.set $cur_in (f32.ge (local.get $cur_d) (f32.const 0.0)))
      (if (local.get $cur_in) (then
        (if (i32.eqz (local.get $prev_in)) (then
          (local.set $dst (i32.add (local.get $out) (i32.mul (local.get $out_count) (call $d3dim_tl_stride))))
          (call $d3dim_interp_tl_clip_vertex
            (local.get $state) (local.get $prev) (local.get $cur) (local.get $dst) (local.get $plane))
          (local.set $out_count (i32.add (local.get $out_count) (i32.const 1)))))
        (local.set $dst (i32.add (local.get $out) (i32.mul (local.get $out_count) (call $d3dim_tl_stride))))
        (call $memcpy (local.get $dst) (local.get $cur) (call $d3dim_tl_stride))
        (local.set $out_count (i32.add (local.get $out_count) (i32.const 1))))
      (else
        (if (local.get $prev_in) (then
          (local.set $dst (i32.add (local.get $out) (i32.mul (local.get $out_count) (call $d3dim_tl_stride))))
          (call $d3dim_interp_tl_clip_vertex
            (local.get $state) (local.get $prev) (local.get $cur) (local.get $dst) (local.get $plane))
          (local.set $out_count (i32.add (local.get $out_count) (i32.const 1)))))))
      (local.set $prev (local.get $cur))
      (local.set $prev_d (local.get $cur_d))
      (local.set $prev_in (local.get $cur_in))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (local.get $out_count))

  ;; DrawPrimitive triangles take the same textured/flat decision as the
  ;; execute-buffer path, but they must still honour backface culling: direct
  ;; DrawPrimitive callers usually run without a z-buffer, so an unculled back
  ;; face overwrites the visible one. Before this existed the whole
  ;; DrawPrimitive family flat-filled every triangle with v0's diffuse, which
  ;; is why Organic Art's textured sky quad came out solid white.
  (func $d3dim_draw_tl_triangle_dp_raw
    (param $this i32) (param $rt i32) (param $use_z i32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (local $tex i32)
    (local.set $tex (call $d3dim_bound_texture_entry (local.get $this)))
    (if (i32.eqz (local.get $tex))
      (then
        (call $d3dim_draw_tl_triangle (local.get $this) (local.get $rt) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (return)))
    (if (call $d3dim_cull_tri (local.get $this)
          (call $d3dim_coord_i (f32.load (local.get $v0)))
          (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
          (call $d3dim_coord_i (f32.load (local.get $v1)))
          (call $d3dim_coord_i (f32.load (i32.add (local.get $v1) (i32.const 4))))
          (call $d3dim_coord_i (f32.load (local.get $v2)))
          (call $d3dim_coord_i (f32.load (i32.add (local.get $v2) (i32.const 4)))))
      (then (return)))
    (call $d3dim_draw_tl_triangle_textured
      (local.get $this) (local.get $rt) (local.get $tex) (local.get $use_z)
      (local.get $v0) (local.get $v1) (local.get $v2)))

  ;; Direct primitive vertices still carry homogeneous 1/w. Clip transformed
  ;; triangles to D3D's complete depth interval 0<=z<=w before integer
  ;; rasterization. A behind-eye endpoint may cross z=0 or z=w depending on
  ;; clip-z's sign; forcing both cases through z=0 collapses terrain and
  ;; billboard edges into the long screen-space fans seen in MCM.
  (func $d3dim_draw_tl_triangle_dp
    (param $this i32) (param $rt i32) (param $use_z i32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (local $q0 f32) (local $q1 f32) (local $q2 f32)
    (local $z0 f32) (local $z1 f32) (local $z2 f32)
    (local $state i32) (local $sw i32) (local $a i32) (local $b i32)
    (local $count i32) (local $i i32)
    (local.set $q0 (f32.load (i32.add (local.get $v0) (i32.const 12))))
    (local.set $q1 (f32.load (i32.add (local.get $v1) (i32.const 12))))
    (local.set $q2 (f32.load (i32.add (local.get $v2) (i32.const 12))))
    (local.set $z0 (f32.load (i32.add (local.get $v0) (i32.const 8))))
    (local.set $z1 (f32.load (i32.add (local.get $v1) (i32.const 8))))
    (local.set $z2 (f32.load (i32.add (local.get $v2) (i32.const 8))))
    ;; Some DX5-era pre-transformed samples use the old viewport-space depth
    ;; convention: every vertex in a face carries the same positive viewport
    ;; depth instead of normalized z/w. Flip3DTL uses sz=300 throughout. Real
    ;; hardware rasterizes those faces; treating 300 as homogeneous far-plane
    ;; overflow discards its whole animated cube. Keep the exception narrow to
    ;; one constant, positive, out-of-range plane so genuine crossing geometry
    ;; still takes the complete near/far clipping path below.
    (if (i32.and
          (i32.and (f32.gt (local.get $z0) (f32.const 1.0))
                   (f32.eq (local.get $z0) (local.get $z1)))
          (f32.eq (local.get $z1) (local.get $z2)))
      (then
        (call $d3dim_draw_tl_triangle_dp_raw
          (local.get $this) (local.get $rt) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (return)))
    ;; Pre-transformed UI commonly supplies rhw=0, which has no recoverable
    ;; homogeneous w. Preserve that established screen-space path. A mixed
    ;; triangle is equally unreconstructable, so leave it to viewport clipping.
    (if (i32.or
          (i32.or (f32.eq (local.get $q0) (f32.const 0.0))
                  (f32.eq (local.get $q1) (f32.const 0.0)))
          (f32.eq (local.get $q2) (f32.const 0.0)))
      (then
        (call $d3dim_draw_tl_triangle_dp_raw
          (local.get $this) (local.get $rt) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (return)))
    ;; Keep the overwhelmingly common fully-visible path allocation-free and
    ;; bit-identical. q>0 plus 0<=z/w<=1 is equivalent to 0<=clip-z<=w.
    (if (i32.and
          (i32.and
            (i32.and (f32.gt (local.get $q0) (f32.const 0.0))
                     (f32.ge (local.get $z0) (f32.const 0.0)))
            (f32.le (local.get $z0) (f32.const 1.0)))
          (i32.and
            (i32.and
              (i32.and (f32.gt (local.get $q1) (f32.const 0.0))
                       (f32.ge (local.get $z1) (f32.const 0.0)))
              (f32.le (local.get $z1) (f32.const 1.0)))
            (i32.and
              (i32.and (f32.gt (local.get $q2) (f32.const 0.0))
                       (f32.ge (local.get $z2) (f32.const 0.0)))
              (f32.le (local.get $z2) (f32.const 1.0)))))
      (then
        (call $d3dim_draw_tl_triangle_dp_raw
          (local.get $this) (local.get $rt) (local.get $use_z)
          (local.get $v0) (local.get $v1) (local.get $v2))
        (return)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    ;; A reuses the otherwise-free tail; B reuses indexed-draw scratch only
    ;; after all three caller vertices have been copied away from it.
    (local.set $a (i32.add (local.get $sw) (i32.const 3744)))
    (local.set $b (i32.add (local.get $sw) (i32.const 3200)))
    (if (i32.ge_u (global.get $d3dim_supplied_projection) (i32.const 2)) (then
      (if (i32.eqz (global.get $d3dim_extended_clip)) (then
        (global.set $d3dim_extended_clip (call $heap_alloc (i32.const 400)))))
      (if (i32.eqz (global.get $d3dim_extended_clip)) (then (return)))
      (local.set $a (call $g2w (global.get $d3dim_extended_clip)))
      (local.set $b (i32.add (local.get $a) (i32.const 200)))))
    (call $memcpy (local.get $a) (local.get $v0) (call $d3dim_tl_stride))
    (call $memcpy (i32.add (local.get $a) (call $d3dim_tl_stride)) (local.get $v1) (call $d3dim_tl_stride))
    (call $memcpy (i32.add (local.get $a) (i32.mul (call $d3dim_tl_stride) (i32.const 2))) (local.get $v2) (call $d3dim_tl_stride))
    (local.set $count (call $d3dim_clip_tl_polygon
      (local.get $state) (local.get $a) (i32.const 3) (local.get $b) (i32.const 0)))
    (if (i32.lt_u (local.get $count) (i32.const 3)) (then (return)))
    (local.set $count (call $d3dim_clip_tl_polygon
      (local.get $state) (local.get $b) (local.get $count) (local.get $a) (i32.const 1)))
    (if (i32.lt_u (local.get $count) (i32.const 3)) (then (return)))
    (local.set $i (i32.const 1))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
      (call $d3dim_draw_tl_triangle_dp_raw
        (local.get $this) (local.get $rt) (local.get $use_z)
        (local.get $a)
        (i32.add (local.get $a) (i32.mul (local.get $i) (call $d3dim_tl_stride)))
        (i32.add (local.get $a) (i32.mul (i32.add (local.get $i) (i32.const 1)) (call $d3dim_tl_stride))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── Execute-buffer triangle rasterizer ─────────────────────────
  ;; Walks wCount D3DTRIANGLE records (8 bytes each: u16 v1,v2,v3,flags) and
  ;; rasterizes each one by indexing into the vertex area of the exec buffer.
  ;; Treats vertices as D3DTLVERTEX (32 bytes) laid out from buf+0. The
  ;; PROCESSVERTICES path preserves original source bytes in a side cache while
  ;; writing transformed TL vertices back into this live buffer.
  ;; Execute-buffer twin of the DrawPrimitive clip below: clip one TL triangle
  ;; against the near (clip z = 0) and far (clip z = w) planes, then fan the
  ;; result through the execute path's own textured/flat decision. Uses the same
  ;; state-block scratch as the DrawPrimitive path; nothing else holds it while
  ;; an execute buffer's TRIANGLE op runs.
  (func $d3dim_exec_draw_near_clipped
    (param $dev_this i32) (param $rt i32) (param $state i32)
    (param $v0 i32) (param $v1 i32) (param $v2 i32)
    (local $sw i32) (local $a i32) (local $b i32) (local $count i32) (local $i i32)
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $a (i32.add (local.get $sw) (i32.const 3744)))
    (local.set $b (i32.add (local.get $sw) (i32.const 3200)))
    (call $memcpy (local.get $a) (local.get $v0) (i32.const 32))
    (call $memcpy (i32.add (local.get $a) (i32.const 32)) (local.get $v1) (i32.const 32))
    (call $memcpy (i32.add (local.get $a) (i32.const 64)) (local.get $v2) (i32.const 32))
    (local.set $count (call $d3dim_clip_tl_polygon
      (local.get $state) (local.get $a) (i32.const 3) (local.get $b) (i32.const 0)))
    (if (i32.lt_u (local.get $count) (i32.const 3)) (then (return)))
    (local.set $count (call $d3dim_clip_tl_polygon
      (local.get $state) (local.get $b) (local.get $count) (local.get $a) (i32.const 1)))
    (if (i32.lt_u (local.get $count) (i32.const 3)) (then (return)))
    (local.set $i (i32.const 1))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $count)))
      (if (global.get $d3dim_exec_batching)
        (then
          (call $d3dim_exec_batch_push (local.get $a))
          (call $d3dim_exec_batch_push (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 32))))
          (call $d3dim_exec_batch_push
            (i32.add (local.get $a) (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 32)))))
        (else
          (call $d3dim_draw_tl_triangle_maybe_textured
            (local.get $dev_this) (local.get $rt) (i32.const 1)
            (local.get $a)
            (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 32)))
            (i32.add (local.get $a) (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 32))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; With the GPU executor attached, one execute-buffer TRIANGLE op becomes
  ;; one TL triangle list on the same seam DrawPrimitive uses; near-clipped
  ;; triangles contribute their clipped fans. Without this the D3DRM apps
  ;; (every Plus! 98 saver) never reached WebGL: they draw only through
  ;; execute buffers, so "WebGL +DX7" rasterized them in software. Render
  ;; state cannot change inside one op, so one batch has one state.
  (global $d3dim_exec_batching (mut i32) (i32.const 0))
  (global $d3dim_exec_batch (mut i32) (i32.const 0))      ;; guest pointer
  (global $d3dim_exec_batch_cap (mut i32) (i32.const 0))  ;; bytes
  (global $d3dim_exec_batch_len (mut i32) (i32.const 0))  ;; vertices
  ;; 4 = triangle list (SOLID), 2 = line list (WIREFRAME edges, drawn with the
  ;; software line's rules: flat first-vertex colour, no depth, no blend).
  (global $d3dim_exec_batch_prim (mut i32) (i32.const 4))

  ;; Append one 32-byte TL vertex (a wasm address). The buffer is heap memory
  ;; the emulator owns, so it is linear and one $g2w covers it.
  (func $d3dim_exec_batch_push (param $v i32)
    (local $need i32) (local $cap i32) (local $grown i32)
    (local.set $need (i32.shl (i32.add (global.get $d3dim_exec_batch_len) (i32.const 1)) (i32.const 5)))
    (if (i32.gt_u (local.get $need) (global.get $d3dim_exec_batch_cap)) (then
      (local.set $cap (select (global.get $d3dim_exec_batch_cap) (i32.const 0x8000)
        (i32.ne (global.get $d3dim_exec_batch_cap) (i32.const 0))))
      (block $sized (loop $grow
        (br_if $sized (i32.ge_u (local.get $cap) (local.get $need)))
        (local.set $cap (i32.shl (local.get $cap) (i32.const 1)))
        (br $grow)))
      (local.set $grown (call $heap_alloc (local.get $cap)))
      (if (i32.eqz (local.get $grown)) (then (unreachable)))
      (if (global.get $d3dim_exec_batch) (then
        (call $memcpy (call $g2w (local.get $grown)) (call $g2w (global.get $d3dim_exec_batch))
          (i32.shl (global.get $d3dim_exec_batch_len) (i32.const 5)))
        (call $heap_free (global.get $d3dim_exec_batch))))
      (global.set $d3dim_exec_batch (local.get $grown))
      (global.set $d3dim_exec_batch_cap (local.get $cap))))
    (call $memcpy
      (i32.add (call $g2w (global.get $d3dim_exec_batch))
        (i32.shl (global.get $d3dim_exec_batch_len) (i32.const 5)))
      (local.get $v) (i32.const 32))
    (global.set $d3dim_exec_batch_len (i32.add (global.get $d3dim_exec_batch_len) (i32.const 1))))

  ;; One wireframe edge into a line batch, near-clipped first exactly as
  ;; $d3dim_draw_tl_line clips it; the push copies, so $scratch is reusable.
  (func $d3dim_exec_batch_push_line (param $va i32) (param $vb i32) (param $scratch i32)
    (local $pa i32) (local $pb i32)
    (local.set $pa (f32.gt (f32.load (i32.add (local.get $va) (i32.const 12))) (f32.const 0.0)))
    (local.set $pb (f32.gt (f32.load (i32.add (local.get $vb) (i32.const 12))) (f32.const 0.0)))
    (if (i32.eqz (i32.or (local.get $pa) (local.get $pb))) (then (return)))
    (if (i32.eqz (i32.and (local.get $pa) (local.get $pb))) (then
      (if (i32.eqz (local.get $scratch)) (then (return)))
      (if (local.get $pa)
        (then
          (call $d3dim_interp_tl_vertex (local.get $va) (local.get $vb) (local.get $scratch))
          (local.set $vb (local.get $scratch)))
        (else
          (call $d3dim_interp_tl_vertex (local.get $vb) (local.get $va) (local.get $scratch))
          (local.set $va (local.get $scratch))))))
    (call $d3dim_exec_batch_push (local.get $va))
    (call $d3dim_exec_batch_push (local.get $vb)))

  ;; The render owner has a different instance's Execute-scope globals.
  ;; Publish accepted TL batch coverage here, before Execute returns, rather
  ;; than relying on its later GPU callback to find this instance's scope.
  ;; Like the GPU executor this is conservative pre-depth/alpha coverage with
  ;; two pixels for line/subpixel rounding, clipped to the target and viewport.
  (func $d3dim_exec_batch_extent (param $rt i32) (param $count i32)
    (local $i i32) (local $v i32) (local $uncertain i32)
    (local $x f32) (local $y f32)
    (local $left f32) (local $top f32) (local $right f32) (local $bottom f32)
    (local $x0 i32) (local $y0 i32) (local $x1 i32) (local $y1 i32)
    (if (i32.eqz (global.get $d3dim_exec_extent_guest)) (then (return)))
    (if (i32.ne (local.get $rt) (global.get $d3dim_exec_extent_rt)) (then (return)))
    (local.set $x1 (load.field DxObject width (local.get $rt)))
    (local.set $y1 (load.field DxObject height (local.get $rt)))
    (if (global.get $d3dim_clip_on) (then
      (local.set $x0 (global.get $d3dim_clip_x0))
      (local.set $y0 (global.get $d3dim_clip_y0))
      (local.set $x1 (global.get $d3dim_clip_x1))
      (local.set $y1 (global.get $d3dim_clip_y1))))
    (local.set $left (f32.const inf))
    (local.set $top (f32.const inf))
    (local.set $right (f32.const -inf))
    (local.set $bottom (f32.const -inf))
    (block $done (loop $vertices
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $v (call $g2w (i32.add (global.get $d3dim_exec_batch)
        (i32.shl (local.get $i) (i32.const 5)))))
      (local.set $x (f32.load (local.get $v)))
      (local.set $y (f32.load offset=4 (local.get $v)))
      ;; Mixed-sign W can project clipped edges outside endpoint bounds.
      (if (i32.eqz (i32.and
        (i32.and (f32.lt (f32.abs (local.get $x)) (f32.const inf))
                 (f32.lt (f32.abs (local.get $y)) (f32.const inf)))
        (f32.gt (f32.load offset=12 (local.get $v)) (f32.const 0))))
        (then (local.set $uncertain (i32.const 1)) (br $done)))
      (local.set $left (f32.min (local.get $left) (local.get $x)))
      (local.set $top (f32.min (local.get $top) (local.get $y)))
      (local.set $right (f32.max (local.get $right) (local.get $x)))
      (local.set $bottom (f32.max (local.get $bottom) (local.get $y)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $vertices)))
    (if (i32.eqz (local.get $uncertain)) (then
      (local.set $x0 (i32.trunc_sat_f32_s (f32.max (f32.convert_i32_s (local.get $x0))
        (f32.floor (f32.sub (local.get $left) (f32.const 2))))))
      (local.set $y0 (i32.trunc_sat_f32_s (f32.max (f32.convert_i32_s (local.get $y0))
        (f32.floor (f32.sub (local.get $top) (f32.const 2))))))
      (local.set $x1 (i32.trunc_sat_f32_s (f32.min (f32.convert_i32_s (local.get $x1))
        (f32.ceil (f32.add (local.get $right) (f32.const 2))))))
      (local.set $y1 (i32.trunc_sat_f32_s (f32.min (f32.convert_i32_s (local.get $y1))
        (f32.ceil (f32.add (local.get $bottom) (f32.const 2))))))))
    (if (i32.and (i32.gt_s (local.get $x1) (local.get $x0))
                 (i32.gt_s (local.get $y1) (local.get $y0))) (then
      (call $d3dim_extent_add (global.get $d3dim_exec_extent_guest)
        (local.get $x0) (local.get $y0) (local.get $x1) (local.get $y1)))))

  ;; Hand the batch to the executor; when it declines (an 8bpp target, say),
  ;; $d3dim_worker_route has fenced and the batch rasterizes here instead.
  (func $d3dim_exec_batch_flush (param $dev_this i32) (param $rt i32)
    (local $n i32) (local $i i32) (local $wa i32)
    (global.set $d3dim_exec_batching (i32.const 0))
    (local.set $n (global.get $d3dim_exec_batch_len))
    (global.set $d3dim_exec_batch_len (i32.const 0))
    (if (i32.eq (global.get $d3dim_exec_batch_prim) (i32.const 2)) (then
      (if (i32.lt_u (local.get $n) (i32.const 2)) (then (return)))
      (if (call $d3dim_worker_route (local.get $dev_this) (i32.const 2)
            (global.get $d3dim_exec_batch) (local.get $n))
        (then (call $d3dim_exec_batch_extent (local.get $rt) (local.get $n)) (return)))
      (local.set $wa (call $g2w (global.get $d3dim_exec_batch)))
      (block $ldone (loop $llp
        (br_if $ldone (i32.gt_u (i32.add (local.get $i) (i32.const 2)) (local.get $n)))
        (call $d3dim_draw_tl_line (local.get $rt)
          (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 5)))
          (i32.add (local.get $wa) (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 5)))
          (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (br $llp)))
      (return)))
    (if (i32.lt_u (local.get $n) (i32.const 3)) (then (return)))
    (if (call $d3dim_worker_route (local.get $dev_this) (i32.const 4)
          (global.get $d3dim_exec_batch) (local.get $n))
      (then (call $d3dim_exec_batch_extent (local.get $rt) (local.get $n)) (return)))
    (local.set $wa (call $g2w (global.get $d3dim_exec_batch)))
    (block $done (loop $lp
      (br_if $done (i32.gt_u (i32.add (local.get $i) (i32.const 3)) (local.get $n)))
      (call $d3dim_draw_tl_triangle_maybe_textured
        (local.get $dev_this) (local.get $rt) (i32.const 1)
        (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 5)))
        (i32.add (local.get $wa) (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 5)))
        (i32.add (local.get $wa) (i32.shl (i32.add (local.get $i) (i32.const 2)) (i32.const 5))))
      (local.set $i (i32.add (local.get $i) (i32.const 3)))
      (br $lp))))

  (func $d3dim_exec_triangles
    (param $dev_this i32) (param $buf_guest i32) (param $rec_guest i32) (param $wCount i32)
    (local $rt i32) (local $vbase i32) (local $i i32)
    (local $iv0 i32) (local $iv1 i32) (local $iv2 i32)
    (local $v0 i32) (local $v1 i32) (local $v2 i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $pos i32)
    (local $state i32) (local $sw i32) (local $c0 i32) (local $c1 i32)
    (local $fillmode i32)
    (if (i32.or (i32.eqz (local.get $buf_guest)) (i32.eqz (local.get $wCount))) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $dev_this)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (local.set $vbase (call $d3dim_execbuf_output_guest (local.get $buf_guest) (i32.const 0)))
    (local.set $state (call $d3ddev_state (local.get $dev_this)))
    (if (local.get $state) (then
      (local.set $sw (call $g2w (local.get $state)))
      (local.set $c0 (i32.add (local.get $sw) (i32.const 3296)))
      ;; D3DRENDERSTATE_FILLMODE = 8; 1 point, 2 wireframe, 3 solid.
      (local.set $fillmode (call $gl32 (i32.add (local.get $state) (i32.const 288))))))
    (if (i32.eqz (local.get $fillmode)) (then (local.set $fillmode (i32.const 3))))
    (global.set $d3dim_exec_batch_len (i32.const 0))
    (global.set $d3dim_exec_batching
      (i32.and (i32.ne (global.get $d3dim_gpu_on) (i32.const 0))
        (i32.and (i32.or (i32.eq (local.get $fillmode) (i32.const 3))
                         (i32.eq (local.get $fillmode) (i32.const 2)))
                 (i32.ne (local.get $state) (i32.const 0)))))
    (global.set $d3dim_exec_batch_prim
      (select (i32.const 2) (i32.const 4) (i32.eq (local.get $fillmode) (i32.const 2))))
    (if (i32.eqz (global.get $d3dim_exec_batching)) (then (call $d3dim_worker_fence)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $iv0 (call $gl16 (local.get $rec_guest)))
      (local.set $iv1 (call $gl16 (i32.add (local.get $rec_guest) (i32.const 2))))
      (local.set $iv2 (call $gl16 (i32.add (local.get $rec_guest) (i32.const 4))))
      (local.set $v0 (call $guest_span_in
        (i32.add (local.get $vbase) (i32.mul (local.get $iv0) (i32.const 32))) (i32.const 32)))
      (local.set $v1 (call $guest_span_in
        (i32.add (local.get $vbase) (i32.mul (local.get $iv1) (i32.const 32))) (i32.const 32)))
      (local.set $v2 (call $guest_span_in
        (i32.add (local.get $vbase) (i32.mul (local.get $iv2) (i32.const 32))) (i32.const 32)))
      ;; Only the math/raster helpers require contiguous vertex records.
      ;; Every draw/skip path converges here before releasing gathered spans.
      (block $vertex_done
        (local.set $p0 (f32.gt (f32.load (i32.add (local.get $v0) (i32.const 12))) (f32.const 0.0)))
        (local.set $p1 (f32.gt (f32.load (i32.add (local.get $v1) (i32.const 12))) (f32.const 0.0)))
        (local.set $p2 (f32.gt (f32.load (i32.add (local.get $v2) (i32.const 12))) (f32.const 0.0)))
        (local.set $pos (i32.add (local.get $p0) (i32.add (local.get $p1) (local.get $p2))))
        ;; kind=28 ExecTri, first triangle of each execute-buffer TRIANGLE op.
        ;; "the geometry is right but the fill is wrong" has several causes that
        ;; look identical in a capture -- point fill mode, every vertex behind
        ;; the eye, a black vertex colour, sub-pixel screen coords -- and this
        ;; separates them in one line.
        (if (i32.eqz (local.get $i)) (then
          (call $host_dx_trace (i32.const 28)
            (i32.or (i32.or (local.get $fillmode) (i32.shl (local.get $pos) (i32.const 4)))
                    (i32.shl (local.get $wCount) (i32.const 8)))
            (i32.load (i32.add (local.get $v0) (i32.const 16)))
            (i32.load (local.get $v0))
            (i32.load (i32.add (local.get $v0) (i32.const 4))))))
        (if (i32.eqz (local.get $pos)) (then
          (br $vertex_done)))
        (if (i32.eq (local.get $fillmode) (i32.const 1)) (then
          ;; Point fill mode plots each visible triangle vertex. Shared vertices
          ;; may be written more than once, matching immediate-mode overdraw.
          (if (local.get $p0) (then (call $viewport_fill_rect (local.get $rt)
            (call $d3dim_coord_i (f32.load (local.get $v0)))
            (call $d3dim_coord_i (f32.load (i32.add (local.get $v0) (i32.const 4))))
            (i32.const 2) (i32.const 2) (i32.load (i32.add (local.get $v0) (i32.const 16))))))
          (if (local.get $p1) (then (call $viewport_fill_rect (local.get $rt)
            (call $d3dim_coord_i (f32.load (local.get $v1)))
            (call $d3dim_coord_i (f32.load (i32.add (local.get $v1) (i32.const 4))))
            (i32.const 2) (i32.const 2) (i32.load (i32.add (local.get $v1) (i32.const 16))))))
          (if (local.get $p2) (then (call $viewport_fill_rect (local.get $rt)
            (call $d3dim_coord_i (f32.load (local.get $v2)))
            (call $d3dim_coord_i (f32.load (i32.add (local.get $v2) (i32.const 4))))
            (i32.const 2) (i32.const 2) (i32.load (i32.add (local.get $v2) (i32.const 16))))))
          (br $vertex_done)))
        (if (i32.eq (local.get $fillmode) (i32.const 2)) (then
          ;; The line helper clips edges crossing the retained-mode near plane.
          (if (global.get $d3dim_exec_batching)
            (then
              (call $d3dim_exec_batch_push_line (local.get $v0) (local.get $v1) (local.get $c0))
              (call $d3dim_exec_batch_push_line (local.get $v1) (local.get $v2) (local.get $c0))
              (call $d3dim_exec_batch_push_line (local.get $v2) (local.get $v0) (local.get $c0)))
            (else
              (call $d3dim_draw_tl_line (local.get $rt) (local.get $v0) (local.get $v1) (local.get $c0))
              (call $d3dim_draw_tl_line (local.get $rt) (local.get $v1) (local.get $v2) (local.get $c0))
              (call $d3dim_draw_tl_line (local.get $rt) (local.get $v2) (local.get $v0) (local.get $c0))))
          (br $vertex_done)))
        (if (i32.eq (local.get $pos) (i32.const 3)) (then
          (if (global.get $d3dim_exec_batching)
            (then
              (call $d3dim_exec_batch_push (local.get $v0))
              (call $d3dim_exec_batch_push (local.get $v1))
              (call $d3dim_exec_batch_push (local.get $v2)))
            (else
              (call $d3dim_draw_tl_triangle_maybe_textured
                (local.get $dev_this) (local.get $rt) (i32.const 1)
                (local.get $v0) (local.get $v1) (local.get $v2))))))
        (if (i32.ne (local.get $pos) (i32.const 3)) (then
          (if (i32.eqz (local.get $state)) (then
            (br $vertex_done)))
          ;; One or two vertices behind the eye: clip in homogeneous space.
          ;; Interpolating screen x/y and rhw linearly (the old
          ;; $d3dim_interp_tl_vertex) put the cut in the wrong place and moved
          ;; the generated vertex, so every wall triangle next to the camera in
          ;; the SDK's Tunnel became a stretched shard.
          (call $d3dim_exec_draw_near_clipped
            (local.get $dev_this) (local.get $rt) (local.get $state)
            (local.get $v0) (local.get $v1) (local.get $v2))))
      )
      (call $guest_span_release (local.get $v2) (i32.const 32))
      (call $guest_span_release (local.get $v1) (i32.const 32))
      (call $guest_span_release (local.get $v0) (i32.const 32))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 8)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (if (global.get $d3dim_exec_batching)
      (then (call $d3dim_exec_batch_flush (local.get $dev_this) (local.get $rt)))))

  ;; ── Execute-buffer: POINT (op=1) ──────────────────────────────
  ;; Walks `wCount` D3DPOINT records {u16 wCount, u16 wFirst}.
  ;; Each record draws `wCount` consecutive vertices as 2×2 dots starting
  ;; at index `wFirst`. Vertices treated as TLVERTEX (32 bytes).
  (func $d3dim_exec_points
    (param $dev_this i32) (param $buf_guest i32) (param $rec_guest i32) (param $wCount i32)
    (local $rt i32) (local $vbase i32) (local $i i32)
    (local $pcount i32) (local $pfirst i32) (local $j i32) (local $v i32)
    (if (i32.or (i32.eqz (local.get $buf_guest)) (i32.eqz (local.get $wCount))) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $dev_this)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (call $d3dim_worker_fence)
    (local.set $vbase (call $d3dim_execbuf_output_guest (local.get $buf_guest) (i32.const 0)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $pcount (call $gl16 (local.get $rec_guest)))
      (local.set $pfirst (call $gl16 (i32.add (local.get $rec_guest) (i32.const 2))))
      (local.set $j (i32.const 0))
      (block $pdone (loop $plp
        (br_if $pdone (i32.ge_u (local.get $j) (local.get $pcount)))
        (local.set $v (i32.add (local.get $vbase)
          (i32.mul (i32.add (local.get $pfirst) (local.get $j)) (i32.const 32))))
        (call $viewport_fill_rect_rgba (local.get $rt)
          (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (local.get $v))))
          (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v) (i32.const 4)))))
          (i32.const 2) (i32.const 2)
          (call $gl32 (i32.add (local.get $v) (i32.const 16))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $plp)))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 4)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── Bresenham 1-pixel flat-color line rasterizer ──────────────
  (func $rasterize_line_flat
    (param $rt_entry i32)
    (param $x0 i32) (param $y0 i32) (param $x1 i32) (param $y1 i32)
    (param $color i32)
    (local $dx i32) (local $dy i32) (local $sx i32) (local $sy i32)
    (local $err i32) (local $e2 i32) (local $guard i32)
    (if (i32.ge_s (local.get $x1) (local.get $x0))
      (then (local.set $dx (i32.sub (local.get $x1) (local.get $x0))) (local.set $sx (i32.const 1)))
      (else (local.set $dx (i32.sub (local.get $x0) (local.get $x1))) (local.set $sx (i32.const -1))))
    ;; dy encoded negative: standard Bresenham uses dy = -|Δy|.
    (if (i32.ge_s (local.get $y1) (local.get $y0))
      (then (local.set $dy (i32.sub (local.get $y0) (local.get $y1))) (local.set $sy (i32.const 1)))
      (else (local.set $dy (i32.sub (local.get $y1) (local.get $y0))) (local.set $sy (i32.const -1))))
    (local.set $err (i32.add (local.get $dx) (local.get $dy)))
    (local.set $guard (i32.const 0))
    (block $done (loop $lp
      (call $viewport_fill_rect (local.get $rt_entry)
        (local.get $x0) (local.get $y0) (i32.const 1) (i32.const 1) (local.get $color))
      (br_if $done (i32.and (i32.eq (local.get $x0) (local.get $x1))
                            (i32.eq (local.get $y0) (local.get $y1))))
      ;; Guard against runaway (malformed coords) — 8192 pixels is plenty.
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (br_if $done (i32.gt_u (local.get $guard) (i32.const 8192)))
      (local.set $e2 (i32.mul (local.get $err) (i32.const 2)))
      (if (i32.ge_s (local.get $e2) (local.get $dy)) (then
        (local.set $err (i32.add (local.get $err) (local.get $dy)))
        (local.set $x0  (i32.add (local.get $x0)  (local.get $sx)))))
      (if (i32.le_s (local.get $e2) (local.get $dx)) (then
        (local.set $err (i32.add (local.get $err) (local.get $dx)))
        (local.set $y0  (i32.add (local.get $y0)  (local.get $sy)))))
      (br $lp))))

  ;; ── Execute-buffer: LINE (op=2) ───────────────────────────────
  ;; Walks `wCount` D3DLINE records {u16 v1, u16 v2}.
  (func $d3dim_exec_lines
    (param $dev_this i32) (param $buf_guest i32) (param $rec_guest i32) (param $wCount i32)
    (local $rt i32) (local $vbase i32) (local $i i32)
    (local $iv1 i32) (local $iv2 i32) (local $v1 i32) (local $v2 i32)
    (if (i32.or (i32.eqz (local.get $buf_guest)) (i32.eqz (local.get $wCount))) (then (return)))
    (local.set $rt (call $d3ddev_rt_entry (local.get $dev_this)))
    (if (i32.eqz (local.get $rt)) (then (return)))
    (call $d3dim_worker_fence)
    (local.set $vbase (call $d3dim_execbuf_output_guest (local.get $buf_guest) (i32.const 0)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $iv1 (call $gl16 (local.get $rec_guest)))
      (local.set $iv2 (call $gl16 (i32.add (local.get $rec_guest) (i32.const 2))))
      (local.set $v1 (i32.add (local.get $vbase) (i32.mul (local.get $iv1) (i32.const 32))))
      (local.set $v2 (i32.add (local.get $vbase) (i32.mul (local.get $iv2) (i32.const 32))))
      (call $rasterize_line_flat (local.get $rt)
        (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (local.get $v1))))
        (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v1) (i32.const 4)))))
        (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (local.get $v2))))
        (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (i32.add (local.get $v2) (i32.const 4)))))
        (call $gl32 (i32.add (local.get $v1) (i32.const 16))))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 4)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── Execute-buffer: MATRIXLOAD (op=4) ─────────────────────────
  ;; Each D3DMATRIXLOAD record (8B): {DWORD hDest, DWORD hSrc}. Copies 64B.
  (func $d3dim_exec_matrix_load
    (param $rec_guest i32) (param $wCount i32)
    (local $i i32) (local $hD i32) (local $hS i32)
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $hD (call $gl32 (local.get $rec_guest)))
      (local.set $hS (call $gl32 (i32.add (local.get $rec_guest) (i32.const 4))))
      (if (i32.and
            (i32.and (i32.ge_u (local.get $hD) (i32.const 1))
                     (i32.le_u (local.get $hD) (global.get $D3DIM_MATRIX_MAX)))
            (i32.and (i32.ge_u (local.get $hS) (i32.const 1))
                     (i32.le_u (local.get $hS) (global.get $D3DIM_MATRIX_MAX))))
        (then
          (call $memcpy
            (i32.add (global.get $D3DIM_MATRICES)
                     (i32.mul (i32.sub (local.get $hD) (i32.const 1)) (i32.const 64)))
            (i32.add (global.get $D3DIM_MATRICES)
                     (i32.mul (i32.sub (local.get $hS) (i32.const 1)) (i32.const 64)))
            (i32.const 64))))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 8)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── Execute-buffer: MATRIXMULTIPLY (op=5) ─────────────────────
  ;; Each D3DMATRIXMULTIPLY record (12B): {DWORD hDest, hSrc1, hSrc2}.
  ;; out = src1 * src2 via the row-major multiply shared with WVP compose.
  (func $d3dim_exec_matrix_multiply
    (param $rec_guest i32) (param $wCount i32)
    (local $i i32) (local $hD i32) (local $h1 i32) (local $h2 i32)
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $hD (call $gl32 (local.get $rec_guest)))
      (local.set $h1 (call $gl32 (i32.add (local.get $rec_guest) (i32.const 4))))
      (local.set $h2 (call $gl32 (i32.add (local.get $rec_guest) (i32.const 8))))
      (if (i32.and (i32.and
            (i32.and (i32.ge_u (local.get $hD) (i32.const 1))
                     (i32.le_u (local.get $hD) (global.get $D3DIM_MATRIX_MAX)))
            (i32.and (i32.ge_u (local.get $h1) (i32.const 1))
                     (i32.le_u (local.get $h1) (global.get $D3DIM_MATRIX_MAX))))
            (i32.and (i32.ge_u (local.get $h2) (i32.const 1))
                     (i32.le_u (local.get $h2) (global.get $D3DIM_MATRIX_MAX))))
        (then
          (call $mat4_mul
            (i32.add (global.get $D3DIM_MATRICES)
                     (i32.mul (i32.sub (local.get $hD) (i32.const 1)) (i32.const 64)))
            (i32.add (global.get $D3DIM_MATRICES)
                     (i32.mul (i32.sub (local.get $h1) (i32.const 1)) (i32.const 64)))
            (i32.add (global.get $D3DIM_MATRICES)
                     (i32.mul (i32.sub (local.get $h2) (i32.const 1)) (i32.const 64))))))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 12)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── Execute-buffer: PROCESSVERTICES (op=9) ────────────────────
  ;; D3DPROCESSVERTICES (16B): DWORD dwFlags; WORD wStart; WORD wDest;
  ;;                           DWORD dwCount; DWORD dwReserved.
  ;; Low 3 bits of dwFlags: 0=TRANSFORMLIGHT (src=D3DVERTEX),
  ;; 1=TRANSFORM (src=D3DLVERTEX), 2=COPY (src=D3DTLVERTEX).
  ;; Accumulate the six standard homogeneous clip planes into D3DSTATUS.
  ;; Union marks any outside vertex; intersection retains only common planes.
  ;; User-plane and ZNOTVISIBLE bits are separate, not inferred from projection.
  (func $d3dim_exec_clip_status (param $header i32) (param $clip i32)
    (local $x f32) (local $y f32) (local $z f32) (local $w f32)
    (local $code i32) (local $status i32)
    (local.set $x (f32.load (local.get $clip)))
    (local.set $y (f32.load offset=4 (local.get $clip)))
    (local.set $z (f32.load offset=8 (local.get $clip)))
    (local.set $w (f32.load offset=12 (local.get $clip)))
    (local.set $code (f32.lt (local.get $x) (f32.neg (local.get $w))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.gt (local.get $x) (local.get $w)) (i32.const 1))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.gt (local.get $y) (local.get $w)) (i32.const 2))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.lt (local.get $y) (f32.neg (local.get $w))) (i32.const 3))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.lt (local.get $z) (f32.const 0)) (i32.const 4))))
    (local.set $code (i32.or (local.get $code) (i32.shl (f32.gt (local.get $z) (local.get $w)) (i32.const 5))))
    (local.set $status (call $gl32 (i32.add (local.get $header) (i32.const 12))))
    (call $gs32 (i32.add (local.get $header) (i32.const 12))
      (i32.or (local.get $code)
        (i32.and (local.get $status)
          (i32.or (i32.const 0xfffc0fff) (i32.shl (local.get $code) (i32.const 12)))))))

  ;; Compose WORLD*VIEW*PROJ, project source xyz to TLVERTEX, and accumulate
  ;; clip status. TRANSFORM preserves LVERTEX colors; TRANSFORMLIGHT lights
  ;; VERTEX normals. COPY transfers already-transformed bytes without clipping.
  (func $d3dim_exec_process_vertices
    (param $dev_this i32) (param $eb_this i32) (param $buf_guest i32) (param $rec_guest i32) (param $wCount i32)
    (local $state_g i32) (local $vbase i32) (local $srcbase i32)
    (local $header i32) (local $clip i32) (local $flags i32) (local $ex i32) (local $ey i32)
    (local $i i32) (local $mode i32) (local $wStart i32) (local $wDest i32) (local $cnt i32)
    (local $j i32) (local $src i32) (local $dst i32) (local $color i32) (local $spec i32)
    (local $tu i32) (local $tv i32) (local $src_stride i32) (local $dst_g i32)
    (if (i32.or (i32.eqz (local.get $buf_guest)) (i32.eqz (local.get $wCount))) (then (return)))
    (local.set $state_g (call $d3ddev_state (local.get $dev_this)))
    (if (i32.eqz (local.get $state_g)) (then (return)))
    (call $d3ddev_composite_wvp (local.get $state_g))
    (call $d3dim_lights_refresh (local.get $state_g))
    (local.set $vbase (call $d3dim_execbuf_output_guest (local.get $buf_guest) (i32.const 1)))
    (local.set $srcbase (call $d3dim_execbuf_source_guest (local.get $buf_guest)))
    (local.set $header (call $d3dim_execbuf_cache_header_guest (local.get $eb_this)))
    ;; A real execute buffer must not fall back to modifying application bytes
    ;; when the separate driver allocation could not be created.
    (if (i32.and (i32.ne (local.get $eb_this) (i32.const 0))
          (i32.eq (local.get $vbase) (local.get $buf_guest))) (then (return)))
    ;; vertex_project leaves the clip-volume-normalized homogeneous vector
    ;; here, before its near-zero divisor clamp. State is owned affine storage.
    (local.set $clip (i32.add (call $g2w (local.get $state_g)) (i32.const 4064)))
    (if (i32.eqz (local.get $srcbase)) (then (local.set $srcbase (local.get $vbase))))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $flags (call $gl32 (local.get $rec_guest)))
      (local.set $mode (i32.and (local.get $flags) (i32.const 7)))
      (local.set $wStart (call $gl16 (i32.add (local.get $rec_guest) (i32.const 4))))
      (local.set $wDest  (call $gl16 (i32.add (local.get $rec_guest) (i32.const 6))))
      (local.set $cnt    (call $gl32 (i32.add (local.get $rec_guest) (i32.const 8))))
      (local.set $src_stride (i32.const 32))
      (local.set $j (i32.const 0))
      (block $vdone (loop $vlp
        (br_if $vdone (i32.ge_u (local.get $j) (local.get $cnt)))
        (local.set $src (i32.add (local.get $srcbase)
          (i32.mul (i32.add (local.get $wStart) (local.get $j)) (local.get $src_stride))))
        (local.set $dst (i32.add (local.get $vbase)
          (i32.mul (i32.add (local.get $wDest)  (local.get $j)) (i32.const 32))))
        (if (i32.eq (local.get $mode) (i32.const 2))
          (then
            (if (i32.ne (local.get $src) (local.get $dst))
              (then (call $guest_memmove (local.get $dst) (local.get $src) (i32.const 32)))))
          (else
            ;; Math helpers require contiguous vertices, not an affine buffer.
            (local.set $dst_g (local.get $dst))
            (local.set $src (call $guest_span_in (local.get $src) (i32.const 32)))
            (local.set $dst (call $guest_span_in (local.get $dst_g) (i32.const 32)))
            ;; Buffer trailing LVERTEX fields before vertex_project writes dst.
            (if (i32.eq (local.get $mode) (i32.const 1))
              (then
                (local.set $color (i32.load (i32.add (local.get $src) (i32.const 16))))
                (local.set $spec  (i32.load (i32.add (local.get $src) (i32.const 20))))
                (local.set $tu    (i32.load (i32.add (local.get $src) (i32.const 24))))
                (local.set $tv    (i32.load (i32.add (local.get $src) (i32.const 28)))))
              (else
                (local.set $color (call $d3dim_vertex_lit_color (local.get $state_g) (local.get $src)))
                (local.set $spec  (i32.const 0))
                (local.set $tu    (i32.load (i32.add (local.get $src) (i32.const 24))))
                (local.set $tv    (i32.load (i32.add (local.get $src) (i32.const 28))))))
            (call $vertex_project (local.get $state_g) (local.get $src) (local.get $dst))
            (if (local.get $header) (then
              (call $d3dim_exec_clip_status (local.get $header) (local.get $clip))))
            (i32.store (i32.add (local.get $dst) (i32.const 16)) (local.get $color))
            (i32.store (i32.add (local.get $dst) (i32.const 20)) (local.get $spec))
            (i32.store (i32.add (local.get $dst) (i32.const 24)) (local.get $tu))
            (i32.store (i32.add (local.get $dst) (i32.const 28)) (local.get $tv))
            (call $guest_span_writeback (local.get $dst_g) (local.get $dst) (i32.const 32))
            (call $guest_span_release (local.get $src) (i32.const 32))))
        ;; UPDATEEXTENTS also applies to copied TL vertices. Use the same
        ;; rounded screen coordinate convention as the software rasterizer.
        (if (i32.and (i32.ne (local.get $header) (i32.const 0))
              (i32.ne (i32.and (local.get $flags) (i32.const 8)) (i32.const 0))) (then
          (local.set $dst_g (i32.add (local.get $vbase)
            (i32.mul (i32.add (local.get $wDest) (local.get $j)) (i32.const 32))))
          (local.set $ex (call $d3dim_coord_i (f32.reinterpret_i32 (call $gl32 (local.get $dst_g)))))
          (local.set $ey (call $d3dim_coord_i (f32.reinterpret_i32
            (call $gl32 (i32.add (local.get $dst_g) (i32.const 4))))))
          (call $d3dim_extent_add (i32.add (local.get $header) (i32.const 16))
            (local.get $ex) (local.get $ey)
            (i32.add (local.get $ex) (i32.const 1)) (i32.add (local.get $ey) (i32.const 1)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $vlp)))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 16)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── Execute-buffer: BRANCHFORWARD (op=12) ─────────────────────
  ;; Evaluates one D3DBRANCH record (16B: dwMask, dwValue, bNegate, dwOffset).
  ;; Returns:
  ;;   -1 ⇒ fall through (branch not taken; caller advances normally)
  ;;    0 ⇒ terminate execute loop (branch taken, offset==0 per spec)
  ;;   N  ⇒ resume at guest addr N (= instr_start + dwOffset; existing policy)
  ;; SDK D3DBRANCH: compare (driver status & dwMask) with dwValue, then negate.
  ;; Read the same retained status exposed by GetExecuteData and SETSTATUS.
  (func $d3dim_exec_branch (param $eb_this i32) (param $rec_guest i32) (param $instr_start i32) (result i32)
    (local $header i32) (local $status i32) (local $mask i32)
    (local $value i32) (local $negate i32) (local $offset i32) (local $taken i32)
    (local.set $header (call $d3dim_execbuf_cache_header_guest (local.get $eb_this)))
    (if (local.get $header) (then
      (local.set $status (call $gl32 (i32.add (local.get $header) (i32.const 12))))))
    (local.set $mask (call $gl32 (local.get $rec_guest)))
    (local.set $value  (call $gl32 (i32.add (local.get $rec_guest) (i32.const 4))))
    (local.set $negate (call $gl32 (i32.add (local.get $rec_guest) (i32.const 8))))
    (local.set $offset (call $gl32 (i32.add (local.get $rec_guest) (i32.const 12))))
    (local.set $taken (i32.eq (i32.and (local.get $status) (local.get $mask)) (local.get $value)))
    (if (local.get $negate) (then (local.set $taken (i32.eqz (local.get $taken)))))
    (if (i32.eqz (local.get $taken)) (then (return (i32.const -1))))
    (if (i32.eqz (local.get $offset)) (then (return (i32.const 0))))
    (return (i32.add (local.get $instr_start) (local.get $offset))))

  ;; ── D3DSTATE walker ────────────────────────────────────────────
  ;; Apply `wCount` consecutive 8-byte D3DSTATE records (dwArg, dwValue) through
  ;; the supplied per-state forwarder. kind: 7=light, 8=render, 6=transform
  ;; (matches D3DOP_LIGHTSTATE/RENDERSTATE/STATETRANSFORM opcode values).
  (func $d3dim_exec_state_walk
    (param $dev_this i32) (param $kind i32) (param $rec_guest i32) (param $wCount i32)
    (local $i i32) (local $a i32) (local $v i32)
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $wCount)))
      (local.set $a (call $gl32 (local.get $rec_guest)))
      (local.set $v (call $gl32 (i32.add (local.get $rec_guest) (i32.const 4))))
      (if (i32.eq (local.get $kind) (i32.const 8))
        (then (call $d3dim_set_render_state (local.get $dev_this) (local.get $a) (local.get $v))))
      (if (i32.eq (local.get $kind) (i32.const 7))
        (then (call $d3dim_set_light_state  (local.get $dev_this) (local.get $a) (local.get $v))))
      ;; D3DOP_STATETRANSFORM: $a = D3DTRANSFORMSTATETYPE, $v = matrix handle.
      ;; Resolve handle → D3DIM_MATRICES + (v-1)*64 and route through the
      ;; shared SetTransform core so the per-device state block is the
      ;; single source of truth for matrices.
      (if (i32.eq (local.get $kind) (i32.const 6))
        (then
          (if (i32.and (i32.ge_u (local.get $v) (i32.const 1))
                       (i32.le_u (local.get $v) (global.get $D3DIM_MATRIX_MAX)))
            (then
              (call $d3dim_bind_transform_handle
                (local.get $dev_this) (local.get $a) (local.get $v))
              (call $d3dim_apply_transform
                (local.get $dev_this) (local.get $a)
                (i32.add (global.get $D3DIM_MATRICES)
                         (i32.mul (i32.sub (local.get $v) (i32.const 1)) (i32.const 64))))))))
      (local.set $rec_guest (i32.add (local.get $rec_guest) (i32.const 8)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; ── D3DDEVICEDESC population (used by IDirect3DDevice{,2,3}_GetCaps) ──
  ;; Thin wrapper around $fill_d3d_device_desc that respects the caller's
  ;; dwSize to avoid clobbering their stack frame. EnumDevices allocates
  ;; 252-byte heap buffers so it can call the fill directly; GetCaps
  ;; receives a caller-supplied buffer whose dwSize varies by DX version
  ;; (DX3=172, DX5=0xCC=204, DX6/7=252).
  (func $d3dim_fill_device_desc (param $desc i32)
    (local $wa i32) (local $sz i32)
    (if (i32.eqz (local.get $desc)) (then (return)))
    (local.set $wa (call $g2w (local.get $desc)))
    (local.set $sz (i32.load (local.get $wa)))
    ;; Only populate when dwSize is a plausible D3DDEVICEDESC size.
    (if (i32.lt_u (local.get $sz) (i32.const 172)) (then (return)))
    (if (i32.gt_u (local.get $sz) (i32.const 252)) (then (return)))
    ;; Fill the whole 252 bytes into scratch, then copy back only dwSize bytes.
    ;; Cheapest safe approach: if dwSize >= 252, fill in place; else use the
    ;; caller's buffer but only clamp the far end of $fill_d3d_device_desc's
    ;; writes by not invoking it and falling back to a dwSize-aware stub.
    (if (i32.ge_u (local.get $sz) (i32.const 252))
      (then
        (call $fill_d3d_device_desc (local.get $desc) (i32.const 0))
        (return)))
    ;; dwSize 172..251 — write fields that fit, leaving the rest zero.
    ;; dwFlags, dcmColorModel, dwDevCaps are the minimum for passing the
    ;; common "has HW color model" check pattern.
    (i32.store (i32.add (local.get $wa) (i32.const 4))  (i32.const 0x7FF))     ;; dwFlags
    (i32.store (i32.add (local.get $wa) (i32.const 8))  (i32.const 2))          ;; RGB color model
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0x02E51))    ;; HEL-style devcaps including DRAWPRIMTLVERTEX|FLOATTLVERTEX
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (i32.const 8))          ;; transform.dwSize
    (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 1))          ;; transform.dwCaps=CLIP
    (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 1))          ;; bClipping
    (i32.store (i32.add (local.get $wa) (i32.const 28)) (i32.const 16))         ;; lighting.dwSize
    (i32.store (i32.add (local.get $wa) (i32.const 32)) (i32.const 7))          ;; POINT|SPOT|DIRECTIONAL
    (i32.store (i32.add (local.get $wa) (i32.const 36)) (i32.const 1))          ;; RGB lighting model
    (i32.store (i32.add (local.get $wa) (i32.const 40)) (i32.const 8))          ;; numLights
    ;; dpcLineCaps and dpcTriCaps full body (56 bytes each) — both ranges
    ;; fit inside the smallest valid dwSize (172). d3rm gates the triangle
    ;; emit path on dpcTriCaps.dwShadeCaps != 0; leaving zero makes it skip
    ;; geometry submission entirely.
    (call $fill_primcaps (i32.add (local.get $desc) (i32.const 44)))
    (call $fill_primcaps (i32.add (local.get $desc) (i32.const 100)))
    (i32.store (i32.add (local.get $wa) (i32.const 156)) (i32.const 0xD00))     ;; DeviceRenderBitDepth
    (i32.store (i32.add (local.get $wa) (i32.const 160)) (i32.const 0x500))     ;; DeviceZBufferBitDepth
    (i32.store (i32.add (local.get $wa) (i32.const 168)) (i32.const 0xFFFF))    ;; dwMaxVertexCount
    (if (i32.ge_u (local.get $sz) (i32.const 188)) (then
      (i32.store (i32.add (local.get $wa) (i32.const 172)) (i32.const 1))       ;; dwMinTextureWidth
      (i32.store (i32.add (local.get $wa) (i32.const 176)) (i32.const 1))
      (i32.store (i32.add (local.get $wa) (i32.const 180)) (i32.const 2048))
      (i32.store (i32.add (local.get $wa) (i32.const 184)) (i32.const 2048)))))

  ;; D3DDEVICEDESC7 has no dwSize member; IDirect3DDevice7::GetCaps receives
  ;; a fixed 236-byte buffer. Keep the values close to the legacy HEL caps but
  ;; include the DX7-only texture/FVF limits that samples commonly probe.
  (func $d3dim_fill_device_desc7 (param $desc i32)
    (local $wa i32)
    (if (i32.eqz (local.get $desc)) (then (return)))
    (local.set $wa (call $g2w (local.get $desc)))
    (call $zero_memory (local.get $wa) (i32.const 236))
    (i32.store (local.get $wa) (i32.const 0x02E51))                         ;; dwDevCaps including DRAWPRIMTLVERTEX|FLOATTLVERTEX
    (call $fill_primcaps (i32.add (local.get $desc) (i32.const 4)))          ;; dpcLineCaps
    (call $fill_primcaps (i32.add (local.get $desc) (i32.const 60)))         ;; dpcTriCaps
    ;; DX7 texture-stage filters have distinct MINF/MAGF bits. The legacy
    ;; 0xFF filter mask alone advertises none of them. Both the software sampler
    ;; and GPU fixed-function descriptor implement point/linear; do not claim
    ;; anisotropic support. Triangle mip caps are added separately.
    ;; Leave legacy D3D1/2/3 and single-image line caps unchanged.
    ;; MINFPOINT | MINFLINEAR | MAGFPOINT | MAGFLINEAR = 0x03000300.
    (i32.store offset=40 (local.get $wa)
      (i32.or (i32.load offset=40 (local.get $wa)) (i32.const 0x03000300)))
    (i32.store offset=96 (local.get $wa)
      (i32.or (i32.load offset=96 (local.get $wa)) (i32.const 0x03000300)))
    ;; Native and WebGL triangles implement point/linear mip LOD with explicit
    ;; bounded chains. Line caps and legacy descriptors stay unchanged.
    (i32.store offset=96 (local.get $wa)
      (i32.or (i32.load offset=96 (local.get $wa)) (i32.const 0x0003003C)))
    (i32.store (i32.add (local.get $wa) (i32.const 116)) (i32.const 0xD00))  ;; DeviceRenderBitDepth
    (i32.store (i32.add (local.get $wa) (i32.const 120)) (i32.const 0x500))  ;; DeviceZBufferBitDepth
    (i32.store (i32.add (local.get $wa) (i32.const 124)) (i32.const 1))      ;; dwMinTextureWidth
    (i32.store (i32.add (local.get $wa) (i32.const 128)) (i32.const 1))      ;; dwMinTextureHeight
    (i32.store (i32.add (local.get $wa) (i32.const 132)) (i32.const 2048))   ;; dwMaxTextureWidth
    (i32.store (i32.add (local.get $wa) (i32.const 136)) (i32.const 2048))   ;; dwMaxTextureHeight
    (i32.store (i32.add (local.get $wa) (i32.const 140)) (i32.const 2048))   ;; dwMaxTextureRepeat
    (i32.store (i32.add (local.get $wa) (i32.const 144)) (i32.const 2048))   ;; dwMaxTextureAspectRatio
    (i32.store (i32.add (local.get $wa) (i32.const 148)) (i32.const 1))      ;; dwMaxAnisotropy
    (f32.store (i32.add (local.get $wa) (i32.const 152)) (f32.const -8192.0))
    (f32.store (i32.add (local.get $wa) (i32.const 156)) (f32.const -8192.0))
    (f32.store (i32.add (local.get $wa) (i32.const 160)) (f32.const 8192.0))
    (f32.store (i32.add (local.get $wa) (i32.const 164)) (f32.const 8192.0))
    (f32.store (i32.add (local.get $wa) (i32.const 168)) (f32.const 0.0))
    (i32.store (i32.add (local.get $wa) (i32.const 176)) (i32.const 8))       ;; dwFVFCaps: 8 texcoord sets
    ;; DISABLE | SELECTARG1 | SELECTARG2 | MODULATE: the software stage combiner and
    ;; legacy GPU lowering implement these operations. DISABLE terminates
    ;; stage zero; other unsupported values retain the legacy fallback.
    ;; Do not advertise operations that would silently produce another result.
    (i32.store (i32.add (local.get $wa) (i32.const 180)) (i32.const 0x0000F));; dwTextureOpCaps
    (i32.store16 (i32.add (local.get $wa) (i32.const 184)) (i32.const 1))    ;; wMaxTextureBlendStages
    (i32.store16 (i32.add (local.get $wa) (i32.const 186)) (i32.const 1))    ;; wMaxSimultaneousTextures
    (i32.store (i32.add (local.get $wa) (i32.const 188)) (i32.const 8))      ;; dwMaxActiveLights
    (f32.store (i32.add (local.get $wa) (i32.const 192)) (f32.const 1.0)))

  ;; IDirect3D v1-v3 expose the same child-object creation contract for lights
  ;; and viewports.  Validate before allocating so a bad output/aggregation
  ;; request cannot consume one of the finite DX object slots, and clear a
  ;; caller-provided output on every failure path.
  (func $d3dim_create_child
    (param $out i32) (param $outer i32) (param $type i32) (param $vtbl i32)
    (result i32)
    (local $obj i32)
    (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
    (if (local.get $outer)
      (then (return (i32.const 0x80040110)))) ;; CLASS_E_NOAGGREGATION
    (if (i32.eqz (local.get $out))
      (then (return (i32.const 0x80070057)))) ;; DDERR_INVALIDPARAMS
    (local.set $obj (call $dx_create_com_obj (local.get $type) (local.get $vtbl)))
    (if (i32.eqz (local.get $obj))
      (then (return (i32.const 0x80004005)))) ;; E_FAIL
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.const 0))

  ;; Release descriptor storage and all lights while LOCK_DX is held. Shared by a
  ;; direct viewport Release and by device/current-viewport lifetime changes.
  (func $d3dim_viewport_release_owned_locked (param $this i32)
    (local $head_addr i32) (local $light i32) (local $entry i32)
    (local $next i32) (local $count i32)
    (local $owner i32) (local $data i32)
    (local.set $owner (call $d3dim_viewport_data_addr (call $dx_from_this (local.get $this))))
    (local.set $data (i32.load (local.get $owner)))
    (i32.store (local.get $owner) (i32.const 0))
    (if (local.get $data) (then (call $heap_free (local.get $data))))
    (local.set $head_addr (call $d3dim_viewport_light_head_addr (local.get $this)))
    (local.set $light (i32.load (local.get $head_addr)))
    (i32.store (local.get $head_addr) (i32.const 0))
    (block $done (loop $release
      (br_if $done (i32.eqz (local.get $light)))
      (br_if $done (i32.ge_u (local.get $count) (i32.const 8)))
      (local.set $entry (call $dx_from_this (local.get $light)))
      (local.set $next (load.field DxObject misc1 (local.get $entry)))
      (i32.store (i32.add (local.get $entry) (i32.const 12)) (i32.const 0))
      (i32.store (i32.add (local.get $entry) (i32.const 16)) (i32.const 0))
      (store.field DxObject misc1 (local.get $entry) (i32.const 0))
      (store.field DxObject misc2 (local.get $entry) (i32.const 0))
      (call $d3dim_light_release_locked (local.get $entry))
      (local.set $light (local.get $next))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (br $release))))

  ;; Canonical primary wrapper for any DX entry. QI may hand a caller an aux
  ;; wrapper, but object ownership is by COM identity rather than interface ptr.
  (func $d3dim_primary_guest (param $entry i32) (result i32)
    (local $slot i32)
    (local.set $slot (call $dx_slot_of (local.get $entry)))
    (i32.add
      (i32.sub
        (i32.add (global.get $COM_WRAPPERS) (i32.mul (local.get $slot) (i32.const 8)))
        (global.get $GUEST_BASE))
      (global.get $image_base)))

  ;; Drop one device-owned viewport reference while LOCK_DX is held.
  (func $d3dim_viewport_release_ref_locked (param $entry i32)
    (local $rc i32) (local $this i32)
    (local.set $rc
      (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (local.set $this (call $d3dim_primary_guest (local.get $entry)))
        (call $d3dim_viewport_release_owned_locked (local.get $this))
        (call $dx_free (local.get $entry)))
      (else (store.field DxObject refcount (local.get $entry) (local.get $rc)))))

  (func $d3dim_device_add_viewport (param $this i32) (param $viewport i32) (result i32)
    (local $dev_entry i32) (local $vp_entry i32) (local $owner i32)
    (local $state i32) (local $node i32) (local $head i32) (local $hr i32)
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $viewport)))
      (then (return (i32.const 0x80070057)))) ;; DDERR_INVALIDPARAMS
    (local.set $dev_entry (call $dx_from_this (local.get $this)))
    (local.set $vp_entry (call $dx_from_this (local.get $viewport)))
    (if (i32.or
          (i32.ne (load.field DxObject type (local.get $dev_entry)) (i32.const 20))
          (i32.ne (load.field DxObject type (local.get $vp_entry)) (i32.const 23)))
      (then (return (i32.const 0x80070057))))
    (local.set $owner (call $d3dim_primary_guest (local.get $dev_entry)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x80070057))))
    ;; The viewport's 32-byte DX entry is already full, so keep the intrusive
    ;; Win9x list as an eight-byte heap node: viewport slot, next node.  The
    ;; device-state gap stores head/tail pointers.  AddViewport inserts at the
    ;; head, matching the native runtime's LIST_ENTRY ordering.
    (local.set $node (call $heap_alloc (i32.const 8)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0x8007000e))))
    (call $gs32 (local.get $node) (call $dx_slot_of (local.get $vp_entry)))
    (call $gs32 (i32.add (local.get $node) (i32.const 4)) (i32.const 0))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (load.field DxObject misc0 (local.get $vp_entry))
      (then (local.set $hr (i32.const 0x88760306))) ;; D3DERR_VIEWPORTHASNODEVICE
      (else
        (local.set $head
          (call $gl32
            (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))))
        (call $gs32 (i32.add (local.get $node) (i32.const 4)) (local.get $head))
        (call $gs32
          (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))
          (local.get $node))
        (if (i32.eqz (local.get $head)) (then
          (call $gs32
            (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_TAIL))
            (local.get $node))))
        (store.field DxObject misc0 (local.get $vp_entry) (local.get $owner))
        (store.field DxObject refcount (local.get $vp_entry)
          (i32.add (load.field DxObject refcount (local.get $vp_entry)) (i32.const 1)))))
    (call $lock_release (global.get $LOCK_DX))
    (if (local.get $hr) (then (call $heap_free (local.get $node))))
    (local.get $hr))

  (func $d3dim_device_delete_viewport (param $this i32) (param $viewport i32) (result i32)
    (local $dev_entry i32) (local $vp_entry i32) (local $state i32)
    (local $slot i32) (local $owner i32) (local $node i32) (local $prev i32)
    (local $next i32) (local $steps i32) (local $found i32) (local $hr i32)
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $viewport)))
      (then (return (i32.const 0x80070057))))
    (local.set $dev_entry (call $dx_from_this (local.get $this)))
    (local.set $vp_entry (call $dx_from_this (local.get $viewport)))
    (if (i32.or
          (i32.ne (load.field DxObject type (local.get $dev_entry)) (i32.const 20))
          (i32.ne (load.field DxObject type (local.get $vp_entry)) (i32.const 23)))
      (then (return (i32.const 0x80070057))))
    (local.set $owner (call $d3dim_primary_guest (local.get $dev_entry)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x80070057))))
    (local.set $slot (call $dx_slot_of (local.get $vp_entry)))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (i32.ne (load.field DxObject misc0 (local.get $vp_entry)) (local.get $owner))
      (then (local.set $hr (i32.const 0x80070057)))
      (else
        (local.set $node
          (call $gl32
            (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))))
        (block $scanned (loop $scan
          (br_if $scanned (i32.eqz (local.get $node)))
          (br_if $scanned (i32.ge_u (local.get $steps) (global.get $DX_MAX)))
          (if (i32.eq (call $gl32 (local.get $node)) (local.get $slot))
            (then (local.set $found (i32.const 1)) (br $scanned)))
          (local.set $prev (local.get $node))
          (local.set $node
            (call $gl32 (i32.add (local.get $node) (i32.const 4))))
          (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
          (br $scan)))
        (if (i32.eqz (local.get $found))
          (then (local.set $hr (i32.const 0x80070057)))
          (else
            (local.set $next
              (call $gl32 (i32.add (local.get $node) (i32.const 4))))
            (if (local.get $prev)
              (then
                (call $gs32 (i32.add (local.get $prev) (i32.const 4))
                  (local.get $next)))
              (else
                (call $gs32
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))
                  (local.get $next))))
            (if (i32.eq
                  (call $gl32
                    (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_TAIL)))
                  (local.get $node))
              (then
                (call $gs32
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_TAIL))
                  (local.get $prev))))
            ;; SetCurrentViewport owns a second reference. Clear and release it
            ;; before releasing the AddViewport list reference.
            (if (i32.eq (call $gl32
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP)))
                (local.get $slot))
              (then
                (call $gs32
                  (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP))
                  (i32.const 0))
                (call $d3dim_viewport_release_ref_locked (local.get $vp_entry))))
            (store.field DxObject misc0 (local.get $vp_entry) (i32.const 0))
            (call $d3dim_viewport_release_ref_locked (local.get $vp_entry))))))
    (call $lock_release (global.get $LOCK_DX))
    (if (local.get $found) (then (call $heap_free (local.get $node))))
    (local.get $hr))

  (func $d3dim_device_next_viewport
      (param $this i32) (param $viewport i32) (param $out i32) (param $flags i32)
      (result i32)
    (local $dev_entry i32) (local $vp_entry i32) (local $result_entry i32)
    (local $state i32) (local $owner i32) (local $slot i32)
    (local $node i32) (local $result_node i32) (local $result_slot i32)
    (local $steps i32) (local $hr i32)
    ;; Win9x clears the caller's pointer before every validation failure.
    (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $out)))
      (then (return (i32.const 0x80070057)))) ;; DDERR_INVALIDPARAMS
    (local.set $dev_entry (call $dx_from_this (local.get $this)))
    (if (i32.ne (load.field DxObject type (local.get $dev_entry)) (i32.const 20))
      (then (return (i32.const 0x80070057))))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x88760304))))
    (local.set $owner (call $d3dim_primary_guest (local.get $dev_entry)))
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $node
      (call $gl32
        (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))))
    (if (i32.eqz (local.get $node))
      (then (local.set $hr (i32.const 0x88760304)))) ;; D3DERR_NOVIEWPORTS
    (if (i32.and (i32.eqz (local.get $hr))
          (i32.eq (local.get $flags) (i32.const 2))) ;; D3DNEXT_HEAD
      (then (local.set $result_node (local.get $node))))
    (if (i32.and (i32.eqz (local.get $hr))
          (i32.eq (local.get $flags) (i32.const 4))) ;; D3DNEXT_TAIL
      (then
        (local.set $result_node
          (call $gl32
            (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_TAIL))))))
    (if (i32.and (i32.eqz (local.get $hr))
          (i32.eq (local.get $flags) (i32.const 1))) ;; D3DNEXT_NEXT
      (then
        (if (i32.eqz (local.get $viewport))
          (then (local.set $hr (i32.const 0x80070057)))
          (else
            (local.set $vp_entry (call $dx_from_this (local.get $viewport)))
            (if (i32.or
                  (i32.ne (load.field DxObject type (local.get $vp_entry))
                    (i32.const 23))
                  (i32.ne (load.field DxObject misc0 (local.get $vp_entry))
                    (local.get $owner)))
              (then (local.set $hr (i32.const 0x80070057)))
              (else
                (local.set $slot (call $dx_slot_of (local.get $vp_entry)))
                (block $scanned (loop $scan
                  (br_if $scanned (i32.eqz (local.get $node)))
                  (br_if $scanned
                    (i32.ge_u (local.get $steps) (global.get $DX_MAX)))
                  (if (i32.eq (call $gl32 (local.get $node)) (local.get $slot))
                    (then
                      (local.set $result_node
                        (call $gl32
                          (i32.add (local.get $node) (i32.const 4))))
                      (br $scanned)))
                  (local.set $node
                    (call $gl32 (i32.add (local.get $node) (i32.const 4))))
                  (local.set $steps
                    (i32.add (local.get $steps) (i32.const 1)))
                  (br $scan)))
                (if (i32.eqz (local.get $node))
                  (then (local.set $hr (i32.const 0x80070057))))))))))
    (if (i32.and (i32.eqz (local.get $hr))
          (i32.and
            (i32.ne (local.get $flags) (i32.const 1))
            (i32.and
              (i32.ne (local.get $flags) (i32.const 2))
              (i32.ne (local.get $flags) (i32.const 4)))))
      (then (local.set $hr (i32.const 0x80070057))))
    (if (i32.and
          (i32.eqz (local.get $hr))
          (i32.ne (local.get $result_node) (i32.const 0)))
      (then
        (local.set $result_slot (call $gl32 (local.get $result_node)))
        (if (i32.ge_u (local.get $result_slot) (global.get $DX_MAX))
          (then (local.set $hr (i32.const 0x80070057)))
          (else
            (local.set $result_entry
              (i32.add (global.get $DX_OBJECTS)
                (i32.mul (local.get $result_slot) (global.get $DX_ENTRY_SIZE))))
            (if (i32.or
                  (i32.ne (load.field DxObject type (local.get $result_entry))
                    (i32.const 23))
                  (i32.ne (load.field DxObject misc0 (local.get $result_entry))
                    (local.get $owner)))
              (then (local.set $hr (i32.const 0x80070057)))
              (else
                (store.field DxObject refcount (local.get $result_entry)
                  (i32.add (load.field DxObject refcount (local.get $result_entry))
                    (i32.const 1)))
                (call $gs32 (local.get $out)
                  (call $d3dim_primary_guest (local.get $result_entry)))))))))
    (call $lock_release (global.get $LOCK_DX))
    (local.get $hr))

  (func $d3dim_device_set_current_viewport (param $this i32) (param $viewport i32) (result i32)
    (local $dev_entry i32) (local $vp_entry i32) (local $old_entry i32)
    (local $state i32) (local $slot i32) (local $old_slot i32) (local $owner i32)
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $viewport)))
      (then (return (i32.const 0x80070057))))
    (local.set $dev_entry (call $dx_from_this (local.get $this)))
    (local.set $vp_entry (call $dx_from_this (local.get $viewport)))
    (if (i32.or
          (i32.ne (load.field DxObject type (local.get $dev_entry)) (i32.const 20))
          (i32.ne (load.field DxObject type (local.get $vp_entry)) (i32.const 23)))
      (then (return (i32.const 0x80070057))))
    (local.set $owner (call $d3dim_primary_guest (local.get $dev_entry)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x80070057))))
    (local.set $slot (call $dx_slot_of (local.get $vp_entry)))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (i32.ne (load.field DxObject misc0 (local.get $vp_entry)) (local.get $owner))
      (then
        (call $lock_release (global.get $LOCK_DX))
        (return (i32.const 0x80070057))))
    (local.set $old_slot
      (call $gl32 (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP))))
    (if (i32.eq (local.get $old_slot) (local.get $slot))
      (then
        (call $lock_release (global.get $LOCK_DX))
        (return (i32.const 0))))
    (if (i32.and
          (i32.ne (local.get $old_slot) (i32.const 0))
          (i32.lt_u (local.get $old_slot) (global.get $DX_MAX)))
      (then
        (local.set $old_entry (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $old_slot) (global.get $DX_ENTRY_SIZE))))
        (if (i32.eq (load.field DxObject type (local.get $old_entry)) (i32.const 23))
          (then (call $d3dim_viewport_release_ref_locked (local.get $old_entry))))))
    (call $gs32
      (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP))
      (local.get $slot))
    (store.field DxObject refcount (local.get $vp_entry)
      (i32.add (load.field DxObject refcount (local.get $vp_entry)) (i32.const 1)))
    (call $d3dim_viewport_apply_entry (local.get $state) (local.get $vp_entry))
    (call $lock_release (global.get $LOCK_DX))
    (i32.const 0))

  ;; $vtbl is the viewport interface the calling device revision returns:
  ;; Device2 hands back an IDirect3DViewport2, Device3 an IDirect3DViewport3,
  ;; whatever interface the viewport was created or selected through. OASAVER
  ;; creates its viewport through d3drm's IDirect3D (a v1 object), selects
  ;; the QI'd v2, then calls GetViewport2 (slot 16) on what comes back -- a
  ;; slot the v1 vtable does not have.
  (func $d3dim_device_get_current_viewport (param $this i32) (param $out i32) (param $vtbl i32) (result i32)
    (local $dev_entry i32) (local $state i32) (local $slot i32)
    (local $vp_entry i32) (local $viewport i32) (local $owner i32) (local $hr i32)
    (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $this)) (i32.eqz (local.get $out)))
      (then (return (i32.const 0x80070057))))
    (local.set $dev_entry (call $dx_from_this (local.get $this)))
    (if (i32.ne (load.field DxObject type (local.get $dev_entry)) (i32.const 20))
      (then (return (i32.const 0x80070057))))
    (local.set $owner (call $d3dim_primary_guest (local.get $dev_entry)))
    (local.set $state (call $d3ddev_state (local.get $this)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x88760307))))
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $slot
      (call $gl32 (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP))))
    (if (i32.and
          (i32.ne (local.get $slot) (i32.const 0))
          (i32.lt_u (local.get $slot) (global.get $DX_MAX)))
      (then
        (local.set $vp_entry (i32.add (global.get $DX_OBJECTS)
          (i32.mul (local.get $slot) (global.get $DX_ENTRY_SIZE))))
        (if (i32.and
              (i32.eq (load.field DxObject type (local.get $vp_entry)) (i32.const 23))
              (i32.eq (load.field DxObject misc0 (local.get $vp_entry)) (local.get $owner)))
          (then
            (local.set $viewport (call $dx_get_wrapper_for_vtbl_locked
              (local.get $slot) (local.get $vtbl)))
            (if (local.get $viewport)
              (then
                (store.field DxObject refcount (local.get $vp_entry)
                  (i32.add (load.field DxObject refcount (local.get $vp_entry)) (i32.const 1)))
                (call $gs32 (local.get $out) (local.get $viewport)))
              (else (local.set $hr (i32.const 0x8007000E)))))
          (else (local.set $hr (i32.const 0x88760307)))))
      (else (local.set $hr (i32.const 0x88760307)))) ;; D3DERR_NOCURRENTVIEWPORT
    (call $lock_release (global.get $LOCK_DX))
    (local.get $hr))

  ;; Final release of any type-20 device interface detaches every viewport the
  ;; device retained, including the independent current-viewport reference.
  (func $d3dim_device_release_entry (param $entry i32) (result i32)
    (local $rc i32) (local $state i32)
    (local $parent_idx i32) (local $parent_entry i32)
    (local $current i32) (local $i i32) (local $vp_entry i32) (local $vp_slot i32)
    (local $owner i32) (local $node_head i32) (local $node i32)
    (local $node_next i32) (local $steps i32)
    (local.set $owner (call $d3dim_primary_guest (local.get $entry)))
    (local.set $rc
      (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (if (i32.gt_s (local.get $rc) (i32.const 0))
      (then
        (store.field DxObject refcount (local.get $entry) (local.get $rc))
        (return (local.get $rc))))
    (local.set $state (i32.load offset=16 (local.get $entry)))
    (call $lock_acquire (global.get $LOCK_DX))
    (if (local.get $state)
      (then
        (local.set $current
          (call $gl32 (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP))))
        (call $gs32
          (i32.add (local.get $state) (global.get $D3DIM_OFF_CUR_VP))
          (i32.const 0))
        (local.set $node_head
          (call $gl32
            (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))))
        (call $gs32
          (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_HEAD))
          (i32.const 0))
        (call $gs32
          (i32.add (local.get $state) (global.get $D3DIM_OFF_VP_LIST_TAIL))
          (i32.const 0))))
    ;; Walk the same ordered list that NextViewport observes. Clearing its
    ;; device links first makes any later defensive scan idempotent.
    (local.set $node (local.get $node_head))
    (block $nodes_done (loop $nodes
      (br_if $nodes_done (i32.eqz (local.get $node)))
      (br_if $nodes_done (i32.ge_u (local.get $steps) (global.get $DX_MAX)))
      (local.set $node_next
        (call $gl32 (i32.add (local.get $node) (i32.const 4))))
      (local.set $vp_slot (call $gl32 (local.get $node)))
      (if (i32.lt_u (local.get $vp_slot) (global.get $DX_MAX))
        (then
          (local.set $vp_entry (i32.add (global.get $DX_OBJECTS)
            (i32.mul (local.get $vp_slot) (global.get $DX_ENTRY_SIZE))))
          (if (i32.and
                (i32.eq (load.field DxObject type (local.get $vp_entry)) (i32.const 23))
                (i32.eq (load.field DxObject misc0 (local.get $vp_entry))
                  (local.get $owner)))
            (then
              (store.field DxObject misc0 (local.get $vp_entry) (i32.const 0))
              (if (i32.eq (local.get $vp_slot) (local.get $current))
                (then (call $d3dim_viewport_release_ref_locked (local.get $vp_entry))))
              (if (i32.eq (load.field DxObject type (local.get $vp_entry)) (i32.const 23))
                (then (call $d3dim_viewport_release_ref_locked (local.get $vp_entry))))))))
      (local.set $node (local.get $node_next))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (br $nodes)))
    ;; Retain a cold defensive scan for malformed/pre-list state. It owns no
    ;; enumeration semantics and finds nothing after an ordinary list walk.
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DX_MAX)))
      (local.set $vp_entry (i32.add (global.get $DX_OBJECTS)
        (i32.mul (local.get $i) (global.get $DX_ENTRY_SIZE))))
      (if (i32.and
            (i32.eq (load.field DxObject type (local.get $vp_entry)) (i32.const 23))
            (i32.eq (load.field DxObject misc0 (local.get $vp_entry)) (local.get $owner)))
        (then
          (local.set $vp_slot (call $dx_slot_of (local.get $vp_entry)))
          (store.field DxObject misc0 (local.get $vp_entry) (i32.const 0))
          (if (i32.eq (local.get $vp_slot) (local.get $current))
            (then (call $d3dim_viewport_release_ref_locked (local.get $vp_entry))))
          (if (i32.eq (load.field DxObject type (local.get $vp_entry)) (i32.const 23))
            (then (call $d3dim_viewport_release_ref_locked (local.get $vp_entry))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (call $lock_release (global.get $LOCK_DX))
    ;; Heap ownership is process-local but heap_free is not DX-lock-aware;
    ;; retire list nodes only after the shared object relationship is unlocked.
    (local.set $node (local.get $node_head))
    (local.set $steps (i32.const 0))
    (block $free_done (loop $free_nodes
      (br_if $free_done (i32.eqz (local.get $node)))
      (br_if $free_done (i32.ge_u (local.get $steps) (global.get $DX_MAX)))
      (local.set $node_next
        (call $gl32 (i32.add (local.get $node) (i32.const 4))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $node_next))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (br $free_nodes)))
    (if (local.get $state) (then
      (call $d3dim_immediate_destroy (local.get $state))
      (call $d3dim_sb_destroy_device (local.get $state))
      (call $d3dim_set_texture (local.get $owner) (i32.const 0) (i32.const 0))
      (if (call $gl32 (i32.add (local.get $state) (i32.const 3448)))
        (then (call $heap_free (call $gl32 (i32.add (local.get $state) (i32.const 3448))))))
      (if (call $gl32 (i32.add (local.get $state) (i32.const 4024)))
        (then (call $heap_free (call $gl32 (i32.add (local.get $state) (i32.const 4024))))))
      (call $heap_free (local.get $state))))
    ;; The creator reference belongs to the device, not each device interface.
    ;; Clear the link before retiring either object; a nonfinal Release above
    ;; must leave it intact. Surface-QI devices have no creator (zero).
    (local.set $parent_idx (i32.load offset=12 (local.get $entry)))
    (i32.store offset=12 (local.get $entry) (i32.const 0))
    (if (i32.ne (local.get $parent_idx) (i32.const 0))
      (then
        (local.set $parent_entry (i32.add (global.get $DX_OBJECTS)
          (i32.mul (i32.sub (local.get $parent_idx) (i32.const 1)) (global.get $DX_ENTRY_SIZE))))
        (drop (call $dx_com_release_basic (call $d3dim_primary_guest (local.get $parent_entry))))))
    (call $dx_free (local.get $entry))
    (i32.const 0))

  (func $d3dim_device_release (param $this i32) (result i32)
    (call $d3dim_worker_fence)
    (call $d3dim_device_release_entry (call $dx_from_this (local.get $this))))
