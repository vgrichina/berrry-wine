# GPU stream v2: migration plan for D3DIM, D3D9/D3D8 and OpenGL

Companion to [gpu-stream-v2.md](gpu-stream-v2.md). Glide is done (e412a3780,
b54590f1b). The goal is one common path for every graphics API:

```
WAT lowering → v2 ring → render Worker (webgl | software | null | later webgpu / C)
→ PRESENT with no CPU readback
```

Pixels come back to the CPU only through READBACK, and only when the guest
touches them in 2D.

File:line references are from the 2026-11-14 planning pass. Re-check them
before relying on them.

**Order: D3DIM, then D3D9 together with D3D8, then GL.**

D3DIM goes first for three reasons:

- Its lowering is already almost all in WAT. Transform and lighting, clipping
  and texture decode all run there (`d3dim_gpu_describe` 09ab:933,
  `d3dim_gpu_decode_texture` 09ab:1066). What it hands over is screen-space
  TL triangles, which is the shape the Glide executors already run.
- It has the most unnecessary readbacks: one per Flip, one per global fence,
  and one per software fallback.
- It proves that the API-neutral plumbing works for a second API.

D3D9 drives about 80% of the executor growth (vertex shader stage, buffers,
LAYOUT, CUBE, stencil, queries, render target used as a texture). It should
land on a contract that D3DIM has already settled.

## 0. Core executor contract (cross-API)

The design goal is a minimal surface, so backends are easy to replace.

**Interface.** `open(ring)`, `execute(record)`, a present sink, `close`, and
stats. A consumer-written **capability block** in the ring header holds
fields such as max texture size, VS-IR yes/no, sampler count, stencil, and
depth formats. WAT derives the caps the guest sees from this block. It
replaces API-specific cap opcodes such as D3D9 0x30005, 0x30017 and 0x3000a.

**Ops.** Keep the current 20 ops and add none. Grow fields instead:

- **DRAW / DRAW_UP:** add `u8 index_size` (2 or 4). Primitives are 1–5:
  points, lines, line strip, triangle list, triangle strip. WAT turns fans
  into indexed lists, because WebGPU has no fans.
- **FENCE:** add `u32 kind` (0 = fence, 1 = occlusion begin, 2 = occlusion
  end) and a `u32 arena dst` for the sample count. This replaces D3D9's
  query opcodes, so no QUERY op is needed.
- **PRESENT:** add `dst_x`, `dst_y` and a `u32 stamp`. The stamp is the
  CPU-present sequence, so the sink can drop stale frames. The destination
  offset is needed for windowed Blt-present and child-window presents.
- **RASTER** gains:
  - stencil (enable, func, ref, mask, wmask, fail, zfail, pass, plus the
    counter-clockwise set for two-sided stencil);
  - `blend_op`;
  - slope-scale bias;
  - an optional `logic_op` (GL only; a backend may refuse it).

  If these don't fit, bump to a 96-byte block.
- **SAMPLER** gains mirror and border addressing, a border colour, a max mip
  level and anisotropy.
- **BIND** must accept render-target ids, for render-to-texture.

**Formats.** The core set is **A8B8G8R8** (texture and render target),
**D16** and **D24S8**. WAT converts everything else at UPLOAD and READBACK.
That covers P8, L8, A8L8, L16, 565, 555, 1555, 4444, R8G8B8 and DXT1/3/5,
and it includes Glide's RGB565 readback.

- Signed V8U8 and Q8W8V8U8 get a +128 bias at upload, and WAT adds a fix-up
  instruction after the sample.
- X8 and 565 render targets get a colormask without A and are cleared to
  A=255, so DESTALPHA reads 1.
- STATEBLK is dropped: WAT owns state blocks.

**IR.** There is one IR (09af ABI 1) for both stages, but the executor only
sees a core subset:

| Group | In the core subset |
|---|---|
| Arithmetic | mov add mul mad dp3 dp4 rcp rsq min max slt sge exp log lit dst lrp frc cmp abs nrm pow |
| Texture | texld for 2D and cube, with projected, bias and lod forms; texkill |
| Other | oDepth; a0-relative constant addressing |
| Inputs | fragment position (for GL stipple and logic op) |

WAT lowers everything else to the core subset before it reaches the executor:

- the ps1.x addressing ops (texbem, texm3x*, texreg2*, texdp3*, phase),
  coissue, and source and result modifiers;
- SM2 static flow control, by unrolling it.

Without this, every new backend would have to reimplement the 846 lines of
`d3d9-shader.js`.

**Glide-specific code to generalize in the executors:**

| Today | Change |
|---|---|
| Fixed 64-byte layout (`gpu-stream-webgl.js:17`, `gpu-stream-software.js:268`) | Real LAYOUT |
| `blend !== 1` is refused (`software.js:355`) | Accept it |
| `_glideFragment`; the Voodoo 12.4 W depth encoding `gps_wdepth` | `depth_mode 2` = depth from interpolated 1/rhw (W-buffering, for Glide and D3DIM). The exact Voodoo encoding only matters for LFB depth reads |
| Fog table, 64 entries indexed by log-w | Kept. WAT bakes D3D and GL table fog into it |
| D3D9 and GL per-vertex and per-pixel fog | Goes into the IR, not into RASTER |
| Glide half-pixel offset | Becomes a vertex adjustment in WAT |
| VIEWPORT is unimplemented | Implement it |

## 1. D3DIM (DX2–7)

**Lowering map.** `d3dim-gpu.js` (1658 lines) moves to WAT:

| Today (JS) | v2 |
|---|---|
| `_target`, `_prepare`, `_upload`: one render target per DIB, re-uploaded when the page watch sees CPU writes | CREATE RT/DS at SetRenderTarget and CreateDevice. WAT keeps a `gpu_id` and an owner {DIB, GPU, both} per DxObject. A CPU write (`page_watch`, `dx_surf_note_write`) becomes an UPLOAD of the dirty rect |
| `_draw`: TL batch → d3d9-backend fixed function | DRAW_UP with vs=0. WAT repacks the TL vertex into a LAYOUT, replicates flat-shade and provoking colour, and places the fog factor |
| Stage-0 colorop and alphaop | Pixel-shader IR from the 09aj cascade (`d3d_fixed_compile_cascade5`) |
| Alpha test, blend, Z/W, cull, scissor | RASTER |
| Colour key | Alpha 0 at decode, texkill in the IR |
| `_texture` via `d3dim_gpu_decode_texture` | UPLOAD as A8B8G8R8 once. Invalidate on surface write-seq, SetPalette, SetEntries or SetColorKey |
| `_clear`, `d3dim_gpu_try_clear` | CLEAR with a rect |
| `_flip` (PBO readback, then DIB swap) | WAT rotates `gpu_id` along with the DIB pointers (09a8:6743), marks the front buffer GPU-owned and emits PRESENT. No readback |
| `present` / parked frames (DXP3, 4686233ac) | PRESENT with dst x/y. Parking becomes the general GPU-owned state, so PARKED_LIMIT and `_materialize` go away |
| `_gammaRamp` | WAT uploads a 256x1 lookup table on each gamma generation |

**Readbacks:**

| Site | Today | v2 |
|---|---|---|
| Flip with a Worker in flight (09a8:6728, `$d3dim_worker_try_flip`) | Async full-frame readback on every Flip (TR2, dx_boids) | Gone |
| Flip, synchronous (09a8:6738, then `dx_present`) | Sync readback on every Flip | Gone |
| Global `$d3dim_worker_fence` (reads every dirty render target) | Readback per call. Callers: BltFast, GetDC, ReleaseDC, SetColorKey, SetPalette, palette SetEntries and Release, non-GPU viewport Clear, SetRenderTarget, surface release | Only GetDC and BltFast of a GPU-owned surface need one. ReleaseDC becomes an UPLOAD. The palette, colour key and clear callers become cache invalidation or a CLEAR |
| Blt source or destination (`d3dim_surface_fence`), Lock (`d3dim_lock_fence`, lazy Lock) | Ranged readback | READBACK plus SYNC, only when the surface is GPU-owned and its DIB is stale |
| Blt(primary ← RT) present | Already on the GPU (4686233ac); CLI and cooperative mode decline it | PRESENT everywhere, including the CLI |
| Software-fallback draw | Readback, then re-upload | Counted slow path until D5 |

**Slices:**

- **D1. Executor growth, fixture only.**
  - Changes:
    - generic LAYOUT;
    - D24S8;
    - PRESENT dst and stamp;
    - the RASTER blend fix;
    - READBACK as A8B8G8R8 only, with Glide's 565 conversion moved into WAT;
    - generalized W-depth, fog and half-pixel handling (the Glide-specific table above).
  - Tests: `test-gpu-stream-*`, `test-glide-gps-software`, `test-glide-abi`, `test-glide-render-worker`.
  - Apps: Glide pixel A/B against e412a3780 on Hype, UT348 and NFS3.
  - **Status (2026-11-14): done, uncommitted.** The contract now lives in
    gpu-stream-v2.md "Core executor contract"; ring VERSION 2, RASTER 96
    bytes. Glide pixel A/B against 0b1a2e513 (`--headless-gl`) is
    md5-identical on NFS3 @300, UT348 @1000/1100/1300 and Hype `--threads`
    @800/1400/2000 (evidence `scratch/runs/20261114-gps-d1/`).
    Choices that D2 inherits:
    - W depth keeps the Voodoo 16-bit float encoding as *the* depth_mode 2
      encoding; D3DIM W-buffering uses it too.
    - The WebGL executor advertises STENCIL only: no occlusion, mirror-once,
      linear-filtered border or logic op, and max_aniso 1. The software
      executor has occlusion, mirror-once and linear-filtered border.
    - WebGL perspective-mode (`linear 0`) rasterization lifts y by 1/128 px
      so the top-left tie rule survives GL's y flip; the linear (Glide) path
      is unchanged.
    - The page Presenter refuses a non-zero PRESENT dst; D2 implements
      windowed / child-window present on top of it. Stale stamps are
      already dropped.
    - DRAW from VBUF/IBUF resources is still refused by both drawing
      executors (DRAW_UP only); D3D9 needs it.
    - A fresh DS reads depth 0 in WebGL but 1.0 in the software executor
      (Glide always clears first); settle it when D3DIM depends on it.
- **D2. Switch D3DIM to v2.**
  - Changes: the lowering map above, plus the ownership state in WAT. Delete `lib/d3dim-gpu.js`, `lib/d3dim-render-worker.js`, and the 0x20000–0x2000A D3DIM records in `d3d-command-stream.js`.
  - Tests:
    - `test-d3dim-gpu-*`
    - `test-d3dim-surface-fence*`
    - `test-d3dim-async-readback`
    - `test-d3dim-bounded-readback-web`
    - `test-d3dim-palette-*-web`
    - `test-d3dim-keyed-mip-*`
    - `test-d3dim-native16-*`
    - `test-d3dim-render-worker-web`
    - `test-d3dim-worker-parity`
    - `test-d3dim-context-loss-web`
    - `test-browser-worker-dx-present`
    - `test-dx-flip-lazy-flush`
    - `test-shared-render-worker*`
  - Tests that probe JS internals get ported to the dump/fixture.
  - Apps, on the CLI (`--headless-gl --d3dim-gpu --png`): mw3, gta2_demo, mcm, dx_flip3dtl, dx_boids, dx_twist, dx_tunnel, dx_globe, dx_viewer, TR2 demo.
  - Browser fps A/B in Threads mode: UT348 D3DDrv, TR2 and dx_boids. Readbacks should be about 0 per frame.
  - **Status (2026-11-15): D2a, D2b committed; D2c uncommitted.** D2c deleted:
    - `lib/d3dim-gpu.js`;
    - the GPU half of `lib/d3dim-render-worker.js`, which is kept as the software Worker adapter until D4;
    - the 0x20007/0x2000A/PRESENT JS responders.

    Stage-0 operands now follow the software rule, so giants' 17 TFACTOR declines per frame draw on the GPU. Its swDraw readbacks went from 1 per frame to 1 per run. Software declines are counted per reason (`d3dim_gps_stat` 35+). Evidence: `scratch/runs/20261115-gps-d2c/`.
- **D3. 2D drawing onto GPU surfaces on the GPU.** A Blt or BltFast from a DIB surface becomes an UPLOAD plus a keyed, textured quad. ColorFill becomes a CLEAR. This removes the HUD and sprite readbacks.
  - Apps: gta2_demo, Forsaken, Blood2, Re-Volt.
- **D4. Move the D3DIM software arm to the v2 software executor.**
- **D5. DX6/7 multi-stage texture stages and specular through the 09aj cascade.** Removes the software fallback.

**Risks:**

- These semantics live only in JS today, and WAT must take them over:
  - the page-watch dirty versions (PageLease);
  - garbage collection of live surfaces;
  - Flip chains longer than 2;
  - the staleness ordering of GPU and CPU presents.
- A guest that keeps a pointer after Lock sees stale pixels more often.
- Mixed GPU and software draws within a frame thrash until D5.
- The D3DIM rasterizer stays until GL moves, because 09a8g uses it.

## 2. D3D9 and D3D8 (09ac shares the device and resource records)

- **9.1. Texture decode and dirty tracking in WAT,** including porting DXT
  decode from `d3d9-texture.js`. This lands on the old transport.
- **9.2. Make 09aj cover all of `d3d9-fixed.js`, then delete it.** That
  means point and spot lights, specular, fog, texgen and texture transforms,
  bump env, user clip and PSIZE, with DFX1/DLT1 built in WAT.
- **9.3. IR canonicalization:** the ps1.x ops, modifiers and unrolling.
- **9.4. Executor growth:** vertex shader stage, stencil, partial colormask,
  blend_op, render target as texture, 8 samplers, index_size, CUBE and the
  occlusion FENCE. **9.4a done (2026-11-15)** in the software and WebGL
  executors, shared `run94a` scenario: stencil, partial colormask,
  blend_op, logic_op (all 16; exact blend/output forms, else one copy per
  run of non-overlapping primitives, no CPU readback), RT as texture,
  index_size 2/4, CUBE, occlusion FENCE, and in software projected
  texcoords (`t#_dz`) and the vertex fog LRP. Open: the vertex shader stage
  (9.4b), DRAW from VBUF/IBUF resources (both executors still refuse
  DRAW), and samplers 6/7, which ABI 1 IR cannot name (extension proposed
  in gpu-stream-v2.md for 9.3; software caps 6).
- **9.5. Switch D3D9 and D3D8 together.** Delete `d3d9-host.js`,
  `d3d9-backend.js`, `d3d9-render-worker.js`, the host part of
  `d3d9-software-backend.js` and v1 `d3d-command-stream.js`.
  - Apps: pawn, B&W2, Morrowind (D3D8), Die Hard (D3D8 A1R5G5B5), GeneRally.
  - On the CLI with no GPU, the kick must return 0 so that CreateDevice
    still fails.
- **9.6. Keep static vertex and index buffers resident on the GPU.** This is
  a performance step.

**Readbacks:**

- Software Present copies the whole render target into the DIB on every
  frame. Under v2 this is unnecessary: PRESENT goes to the sink.
- These stay as READBACK: LockRect of a render target, GetDC on the back
  buffer, and GetRenderTargetData.

**Risks:**

- Executor availability is visible to the guest: caps, the programmable
  gate, and the CreateDevice failure some apps depend on.
- Parity of signed formats and ps1.x semantics.
- Decoding DXT to RGBA8 takes 4–8 times the memory.
- Ordering of device loss and Reset.

## 3. OpenGL

WAT already has:

- display lists (09a8ca);
- the matrix mirror and the DFX1/DLT1 builders (09a8f);
- selection and feedback (09a8ce);
- evaluators (09a8cd);
- the whole software-GL pipeline: pixel-deciding state, transform and
  lighting, and clipping (09a8g).

The v2 lowering reuses the 09a8g pipeline:

- 09a8g emits pre-transformed DRAW_UP.
- texenv and combine become pixel-shader IR, aware of the base internal
  format (ALPHA, LUMINANCE and INTENSITY).
- RASTER carries depth, blend, blend equation, stencil, polygon offset,
  scissor, colormask and logic_op.
- Swap becomes PRESENT, glReadPixels becomes READBACK, and glCopyTex*
  becomes COPY.
- 1D textures become Wx1.
- Stipple becomes a 32x32 texture sampled through the fragment-position
  input.

**Slices:**

- **G1. Queries, error state and validation in WAT (09a8e).** Lands on the
  old transport.
- **G2. Texture objects, formats and pixel transfer in WAT.** Lands on the
  old transport.
- **G3. Switch both arms to v2 through 09a8g.** Delete `gl-compat.js`,
  `gl-command-stream.js`, `gl-render-worker.js`, `gl-software-producer.js`
  and the routing part of `gl-render-host.js`, then delete the D3DIM
  rasterizer.
  - Apps: Quake II, Quake III, Hexen II, Heretic II, Half-Life, GLTron,
    SimGolf, WC3, each in both software and webgl modes.
  - **Status (G3a/G3a-2/G3b/G3c).** `src/09a8gt-gl-gps.wat` lowers the
    09a8g pipeline onto ring api 3. The browser's default GL renderer is
    `software` with gps on, on the WebGL executor (the page GPU select
    "Software" picks the software executor; `?gl-gps=off|software|webgl|null`
    overrides it). In Threads mode the guest instance's producer is turned on
    through word 4 of the software-GL producer mailbox
    (`lib/gl-software-producer.js`, written by `lib/gl-render-host.js` from
    the host's `glGps`), its kicks reach the render Worker through
    `lib/guest-rpc.js`, and the render owner sends no CPU frame while the
    executor presents. `?gl-renderer=webgl`, or `glRenderer: 'webgl'` on an
    app in `lib/apps.js`, keeps the JS path. Opted out: `heretic2_demo` (the
    WebGL executor draws a 1 px dark seam where the main-menu book's tiled
    quads meet; neither the JS path nor gps-off software GL does). The CLI default is unchanged
    (`--gl-renderer` defaults to webgl; `--gl-renderer=software
    --headless-gl` is gps on WebGL).
  - **What of the old JS transport is still live, and why.** Nothing became
    dead with the flip, so nothing was deleted:
    `gl-compat.js` is still the WGL context manager for software contexts
    (create/share/make-current/swap bookkeeping, PFD_DRAW_TO_BITMAP,
    `gl_sw_*` drawable sizing) and still the whole `webgl` renderer
    (FixedFunctionGL over `gpu-backend.js`), which serves `?gl-renderer=webgl`,
    per-app opt-outs, the CLI and Node default, and about 150 tests;
    `gl-command-stream.js` is the WAT GL encoder's batch format every context
    (software included) is replayed from; `gl-render-host.js`,
    `gl-render-worker.js` and `gl-software-producer.js` carry software
    contexts in Threads mode (the render owner's context table and the
    producer mailbox). Deleting them needs the WGL context table and the
    wgl* lifecycle in WAT (the G3 plan's "routing part"), and the CLI/test
    default moved off `webgl`.
- **G4. Optional: GPU transform and lighting through vertex-shader IR.**

**Readbacks:**

| Site | Under v2 |
|---|---|
| glReadPixels | Kept, as READBACK |
| CopyTex* (read back, then upload) | COPY; the readback is unnecessary |
| glAccum | Kept. WAT owns an accumulation buffer in guest memory |
| Publishing every present to a bitmap or single-buffer drawable | READBACK only when GDI or the guest touches the drawable |
| GDI merged over the window | READBACK, deferred until GDI actually draws |
| Software GL writing the DIB on every frame | Gone: the software executor presents |

**Risks:**

- The glGet and validation surface is large.
- 09a8g's coverage may not match gl-compat (texgen is sphere-map only).
  `test-cli-gl-software-worker-parity` is the gate.
- CPU transform and lighting cost on Quake III.
- Accumulation must stay Float32.

## Cross-cutting

- **No executor reads guest memory,** so every texture, DIB and vertex
  becomes an arena copy. Watch for arena-full SYNCs during texture-heavy
  level loads.
- **Executor failures are loud.** Paths that used to fall back silently will
  crash instead.
- **WAT grows.** Expect about 150 lines for DXT decode, several hundred to
  bring 09aj to d3d9-fixed parity, a comparable amount for the ps1.x
  canonicalizer, and the largest share for GL validation.
