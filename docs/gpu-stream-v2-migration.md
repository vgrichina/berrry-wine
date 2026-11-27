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
      linear-filtered border or logic op, and max_aniso 1. (Since then it
      has gained all of them but mirror-once; see the caps table in
      `gpu-stream-v2.md`.) The software
      executor has occlusion, mirror-once and linear-filtered border.
    - WebGL perspective-mode (`linear 0`) rasterization lifts y by 1/16 px
      so the top-left tie rule survives GL's y flip; the linear (Glide) path
      is unchanged. (It was 1/128 px until 2026-11-16, which SwiftShader's
      4-bit subpixel grid rounds away: Heretic II's seam, the same bug as
      the 2026-10-06 NFS III horizon line in `docs/re-notes/need-for-speed.md`.)
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
  - **Status (2026-11-17, branch retire/d3dim-20261117): done.** `$d3dim_gpu_call` always calls the producer; the WAT software draw entries (29 functions, ~90 KB), `d3dim_gpu_enable`/`set_d3dim_gpu_present`, the 0x20000-0x20004 host forwarding and the render Worker's D3DIM replay are deleted. A state decline traps. Executors: WebGL, software, null (`--d3dim-renderer`). `test-d3dim-native-mip`, `test-d3dim-worker-parity` and `test-d3dim-publication-source-lifetime` were deleted with the paths they tested. Known gaps the software rasterizer covered: DITHERENABLE/ANTIALIAS pixels, near/far clipping of pre-transformed vertices, and the attached Z surface's DIB (depth is executor-private).
- **D5. DX6/7 multi-stage texture stages and specular through the 09aj cascade.** Removes the software fallback.
  - **Status (2026-11-26, branch gps/d5-tss): done for what the device carries.** `$d3g_draw` no longer hand-builds a stage-0 shader: `$d3g_stage_key` reads the cascade (stage 0 from describe, later stages raw via `$d3dim_tss_load`) and `$d3g_fixed_shader` lowers it through `$d3d_fixed_compile_cascade6`, the D3D9 fixed-function compiler, then canonicalizes to core IR (executors stay API-neutral). Every DX6/7 COLOROP/ALPHAOP and argument (DIFFUSE, CURRENT, TEXTURE, TFACTOR, SPECULAR, COMPLEMENT, ALPHAREPLICATE) and SPECULARENABLE are honoured; TEXTUREFACTOR is CONSTS c0 (fog colour c7), so a TFACTOR fade reuses one shader; colour-key kill and vertex fog are appended to the core IR / cascade. An out-of-range op or arg traps as decline reason 7.
  - The census (`scratch/runs/20261126-gps-d5/census/`) found no declines anywhere before D5 either: the gaps were silent approximations, chiefly Giants' 48k MODULATE(TEXTURE, TFACTOR) draws read as MODULATE(TEXTURE, DIFFUSE) and ALPHAOP DISABLE drawn as MODULATE. Giants' loading screen is now drawn at full brightness. `d3dim_gps_stat` 46..49 count multi-stage draws, stage>0 cuts, draws the old lowering approximated, and sixth-stage cuts (`[d3dim-gps] stages` in run.js).
  - Not done, deliberately: stage>0 textures. SetTexture on stage>0 is still dropped, the vertex path carries one UV set and the caps advertise one stage, so a later stage that samples ends the cascade there (stat 47). No app in the census uses stage>0. Multi-texture needs per-stage texture binding, TEXCOORDINDEX-driven UV sets in the vertex layout and caps raised together. Test: `test/test-d3dim-gps-stages.js` (software and headless-WebGL executors against computed D3D values).

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
  - **S1 (2026-11-16): the ring leads.** After two ring-presented frames
    the old draw/clear calls are skipped; a decline or a back-buffer
    operation the ring cannot do hands the executor picture to the old
    path (readback, one 0x30015 upload) and returns to shadow mode
    (`09akg` "Lead mode", `test-d3d9-gps-lead.js`). CPU per present:
    Alien Shooter −52%, Die Hard −24%, B&W2 −14%, pixels identical.
  - **S2 (2026-11-16): WAT decides the caps.** `09akg` picks the D3D9 caps
    profile (`d3d9_profile_set`, from the ring's CAP flags at open) and
    09ad/09ae answer GetDeviceCaps, the shader-version gate, RGB565 and
    occlusion queries from it, with no JS round trip
    (`test-d3d9-gps-caps.js`).
  - **S3 (2026-11-16): fewer declines.** Lit fixed T&L (28) lowers: the
    09aj DLT1 is built in WAT from the device's lights and material, the VS
    compiles once per lighting *shape* and the values go out as c40..c95
    per draw (`test-d3d9-gps-lit.js`). Texture transforms and texgen (12)
    lower the same way, the matrices as c16..c39 and a normal texgen's
    normal matrix as c40..c42 (`test-d3d9-gps-texgen.js`); PROJECTED still
    declines (the executor has no raster divide on this path). A vertex
    declaration that is exactly an FVF layout runs fixed T&L as that FVF
    (2, `test-d3d9-gps-decl-fixed.js`). The core vertex IR gained `cmp`
    (op 88, a per-component select): 09aj's normalize selects with CND, and
    09af1 lowers it. Still declined: 27 (user clip planes need clip
    distances in the executor protocol; multi-stream declarations need a
    WAT interleave; vertex blending has no 09aj lowering on either path),
    and the reasons outside this slice (4..7, 11, 14..26).
  - **User clip planes (2026-11-16).** D3DRS_CLIPPLANEENABLE + SetClipPlane
    no longer decline 27 when the executor advertises
    `GPS_CAP_CLIP_PLANES` (128): a sticky CLIP record (op 15, mask + six
    clip-space planes) is sent with the viewport for every vertex-stage
    draw. A guest VS's planes are clip space already; fixed T&L's are
    world space and go out as `plane * inverse(View * Projection)` (a
    singular product still declines 27). POSITIONT draws ignore them. The
    software executor clips the polygons; WebGL computes the distances in
    the VS and discards a fragment with any negative interpolated distance
    (WebGL has no `gl_ClipDistance`), on WebGL1 and WebGL2
    (`test-d3d9-gps-clip.js`, scenario step 13).
  - **Projected texture coordinates (2026-11-16).** D3DTTFF_PROJECTED |
    COUNT3/4 under fixed T&L no longer declines 12, and needs no new record
    or cap: the fixed VS writes the full transformed coordinate and the
    pixel stage's raw `tex t#` (the fixed cascade, or a guest ps1.1-1.3)
    canonicalizes to a core texld with the DZ / DW coordinate modifier,
    which both executors already divide per pixel (09af1 `$cn_projected`,
    set by 09akg for that one canonicalization; the guest-PS cache key
    includes it). q == 0 samples (1, 1) as texld_dz does (the old path drew
    black). Still 12: PROJECTED with COUNT1/2, a ps1.4 / 2.0 under it, a
    dependent texture op on a projected stage, and POSITIONT. A generated
    coordinate behind a guest PS no longer drops its VS output
    (`test-d3d9-gps-texgen.js` frames 8..11).
  - **d9pj (2026-11-16): the rest of PROJECTED.** Also reshaped in WAT
    into the same DZ / DW divide, with no new record or cap: COUNT2 |
    PROJECTED divides by the second coordinate and leaves (x/y, 0) --
    under fixed T&L the texture matrix's y column goes out as its w
    column with y zeroed (c16.. constants) and the stage runs as COUNT4;
    on POSITIONT (no matrix, still projected) the CPU expansion appends
    one FLOAT4 (x, 0, 0, y) of that set to each vertex (layout nibble 13)
    and the stage reads it with DW. POSITIONT COUNT3 / COUNT4 | PROJECTED
    read the set in place with DZ / DW; the fixed PS is emitted through
    the projected canonicalization, with the stages in its cache key. A
    guest ps1.4+ ignores PROJECTED (it projects explicitly), as D3D does.
    Still 12: PROJECTED | COUNT1 (nothing is left after the divide), a
    second POSITIONT COUNT2 stage in one draw, a projected set the vertex
    lacks or that is too short to hold the divisor, PROJECTED under a
    ps_1_0 or a non-ps shader, plain transform flags on POSITIONT
    (`test-d3d9-gps-projected.js`, against an equivalent COUNT4 draw and
    the old path; `--webgl` for the WebGL executor).
  - **d9wb (2026-11-16): W-buffering (17) as an executor feature.**
    D3DZB_USEW cannot be reshaped on the CPU (depth is 1 / interpolated
    rhw per pixel, not linear in screen space), so it is RASTER
    depth_mode 3 behind GPS_CAP_WBUFFER (256): depth = w / w_far, w_far
    from the PROJECTION transform as the D3D9 runtime takes it, (m44 -
    m43) / (m33 - m34) * m34 + m44, for every vertex stage (POSITIONT,
    fixed T&L, guest VS). The software executor computes it in the native
    rasterizer (glide descriptor depthMode 3, w_far at +28); the WebGL
    executor writes gl_FragDepth / gl_FragDepthEXT in those draws'
    programs only, and advertises the cap with WebGL2, desktop GL or
    EXT_frag_depth. Still 17: no cap, m33 == m34 or a w_far that is not
    finite and positive, DEPTHBIAS / SLOPESCALEDEPTHBIAS under W
    (`test-d3d9-gps-wbuffer.js`, against the picture W-buffering defines
    worked out on the CPU, and the scenario's step 14). The decline and
    lead tests now decline through 14 (BLENDFACTOR), which the old path
    draws exactly.
  - **d9ms (2026-11-16): gathered vertex input.** Input the executor
    cannot read in place is gathered per draw in WAT (`09akg` "d9ms") into
    one interleaved arena vertex, drawn as DRAW_UP: declaration elements on
    streams 1..15, every D3DDECLTYPE (converted as D3D defines it, the f64
    quotient rounded once), declarations that are not an FVF layout under
    fixed T&L (2) or POSITIONT (`XYZRHW` byte order), and XYZW / XYZBn
    FVFs. BaseVertexIndex, MinIndex and NumVertices are the D3D ones.
    SetStreamSourceFreq is still `crash_unimplemented`, so instancing
    cannot reach a draw (`test-d3d9-gps-streams.js`, 7 frames pixel-exact
    against the old path; each declined 2 or 27 before).
  - **d9ms (2026-11-16): fixed-function vertex blending.** VERTEXBLEND
    1..3 WEIGHTS, indexed blending (INDEXEDVERTEXBLENDENABLE, 0WEIGHTS
    included, UBYTE4 or D3DCOLOR indices) and TWEENING lower like S3's
    lighting: a prologue on the 09aj cascade VS compiled once per shape
    (matrix count, indexed, index type, tween, NORMAL), the world matrices
    0..3 or palette entries 0..21 (position columns and inverse transposes)
    or TWEENFACTOR sent as c96.. CONSTS per draw; the cascade then runs on
    the blended world-space vertex under an identity world. Inputs are
    always gathered. Still 27: an index past 21 (checked over the draw's
    vertices before it is lowered), missing BLENDWEIGHT / BLENDINDICES /
    POSITION1 / NORMAL1. The old path ignores blending, so
    `test-d3d9-gps-blend.js` compares against CPU-blended meshes (dyadic,
    exact) drawn unblended. Caps still report MaxVertexBlendMatrices 0.
  - **d9cpu (2026-11-16): indexed blending past the shader palette on the
    CPU.** A draw whose indices name an entry 22..255 no longer declines:
    09akg ("d9cpu") blends it inside the gather in WAT (v128: 1.77x less
    user CPU than the bit-identical scalar version), writing the blended
    world-space POSITION (4 floats) and NORMAL (through each entry's
    inverse transpose) with the prologue's arithmetic, and draws the plain
    cascade VS under an identity world, so lighting and texgen are
    unchanged. Only an index that is not an integer in 0..255 or a
    non-finite matrix declines 27. Caps now report MaxVertexBlendMatrices
    4 and MaxVertexBlendMatrixIndex 21 (hardware vertex processing) or
    255 (a SOFTWARE_VERTEXPROCESSING device, or a MIXED one switched by
    SetSoftwareVertexProcessing, which is now stateful), while the ring
    is live; the old path does not blend. Stat 82 counts CPU-blended
    draws.
  - **d9fv (2026-11-16): flat shading under a vertex stage (16) on the
    CPU.** Under a guest VS or fixed-function lighting the flat colours are
    VS outputs, so 09akg runs the VS itself in the 09ag shader VM (the
    software executor's own VM; constants from the ring's VS shadow) over
    the d9cpu-expanded list, and draws POSITIONT FLOAT4 vertices (oD0,
    oD1 clamped, oT0..5) with the provoking vertex's colours through the
    draw's own pixel shader. Clip space maps through the viewport as 09ah
    `$d3d_software_project` does. The program comes from re-emitting the
    SHADER once with `$d9fv_force` (the core IR is compiled before it is
    freed); programmable LAYOUT payloads are copied as published to map
    DCLs to elements. A primitive wholly outside z 0..w / w > 0 / an
    enabled user plane, or with a non-finite vertex, is dropped; points
    ignore SHADEMODE and draw on the GPU. Still 16, each with a stat:
    vertex fog (121; POSITIONT fog reads COLOR0 alpha), no program or a VM
    failure (122), an input missing from the layout or an oT6/7 write
    (123), a primitive that needs clipping (124; earlier chunks of the
    same draw stay drawn on a target the decline marks stale)
    (`test-d3d9-gps-flat-vs.js`: list, strip, fan, lit, near-plane drop,
    each against a Gouraud reference with the provoking colour or normal
    in every vertex, software and `--webgl`).
  - **d9cpu fallbacks (2026-11-16): reshaping declines into plain draws.**
    09akg's "CPU expansion into list DRAW_UPs" rewrites a draw the ring
    could not express into non-indexed list DRAW_UPs the executors already
    run, with no protocol change. 16: a flat-shaded draw (fixed PS, no
    lighting) gets its own vertices per primitive with the provoking
    vertex's colours copied over (first vertex; the second of a fan
    triangle). 24: a POSITIONT stage reading a missing texcoord set reads
    a FLOAT2 (0,0) appended to a padded copy of each vertex (layout
    nibble 14). 20: a draw over the arena or index limits is split into
    chunks of at most 1 MB; a Clear with more than 256 rects is just
    more CLEAR records. 6: cube textures upload as CREATE kind CUBE with
    six faces (both executors already sample CUBE). 25 is unreachable
    (CreateTexture refuses textures over 2048). Stats 83 / 84 count
    expanded draws and the chunks they emitted. Still declining: 16 under
    a guest VS or fixed lighting (needs a flat varying in the executor),
    17 W-buffer (needs depth from w in the executor; not exact on the
    CPU; lowers since d9wb, see above), 12 PROJECTED with COUNT1/2 or under POSITIONT (the per-pixel
    divide cannot be done per vertex exactly; reshaped since d9pj into
    the executors' DZ / DW divide, see above). `test-d3d9-gps-cpu.js`
    compares each reshaped frame to an equivalent plain draw on both
    executors (`--webgl`) and to the old path where it draws the same.
  - **Status (d3d9-retire S4, 2026-11-17): the old JS path is deleted.**
    JS half: `lib/d3d9-host.js` (the Bridge, gpu_gl_call 0x30000-0x30019),
    `lib/d3d9-backend.js` (the WebGL Device), `lib/d3d9-render-worker.js`
    and `lib/render-wait-attribution.js` are gone, as are the yield-16
    render wait and its tokens, the api-4 snapshot publication in
    guest-rpc / guest-worker / thread-manager, the D3D9 half of
    `d3d-command-stream.js` (now only the D3DIM `Encoder`) and the neutral
    endpoint in `d3d-render-worker.js`; `d3d9-software-backend.js` keeps
    only the native `Device` the software executor runs (and
    `copyPayload`). The host picks the executor through
    `ctx.d3d9GpsBackend` (`webgl` / `software` / `null` / `none`): on the
    CLI `--d3d9-gps=...` (`--d3d9-renderer=software` is an alias; the
    default is webgl with `--headless-gl`, else software for an app with
    `d3d9WithoutGpu: 'software'`, else none), in the browser `?d3d9-gps=`
    or the D3D select. `--no-d3d9-gps` / `--d3d9-gps=off` are errors, so
    the `test-d3d9-gps-*` comparisons against the old path (`render('off')`)
    need a new oracle. 122 files / 21,142 lines deleted, mostly
    old-path-only tests and diagnostics.
    WAT half: `src/09akg-d3d9-gps.wat` is the only renderer. CreateDevice
    asks `$d3d9_executor_ok` (the ring's open kick) and returns
    D3DERR_NOTAVAILABLE when no executor answers; caps, the shader-VM gate
    and the R5G6B5 back buffer come from the launch profile and the ring's
    capability block alone. Clear, every Draw*, Present (device and swap
    chain), ColorFill, UpdateSurface, StretchRect, GetRenderTargetData and
    occlusion queries lower onto the ring; there is no shadow / lead mode,
    no handover (readback site 4 retired) and no old call behind any of
    them. Occlusion queries are FENCE brackets on completion slot 1 (one
    open at a time; an event query completes at Issue). Release / Reset
    drop the device's ring targets with RELEASE records, synchronously:
    the render token (`$d3d_render_token`, yield 16, its park / poll and
    the get/set exports) and the world-matrix trace (host_dx_trace kind 30)
    are gone, and the only D3D9 host opcode left is the state-guard wait
    0x30018. Fail fast: a decline (`d3d9_gps_stat` 12 / 16 + reason) and
    every operation the ring cannot express (ColorFill / UpdateSurface /
    StretchRect / GetRenderTargetData of an unknown surface, a Present
    with no window, a full surface table) traps through `$d9g_fail`
    (log 0x44394750, then the code). Pixels reach guest memory only on
    LockRect / GetDC of the back buffer, Lock of a colour surface,
    GetRenderTargetData and the CLI capture, each a READBACK (or a CPU
    fill when the target is one known Clear colour). The tests that
    compared the ring to `render('off')` now compare it to the old path's
    frames recorded at 3eea041c5 (`test/fixtures/d3d9-old-oracle/`).
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
    "Software" picks the software executor; `?gl-gps=software|webgl|null`
    overrides it; `off` was removed in S4). In Threads mode the guest instance's producer is turned on
    through word 4 of the software-GL producer mailbox
    (`lib/gl-software-producer.js`, written by `lib/gl-render-host.js` from
    the host's `glGps`), its kicks reach the render Worker through
    `lib/guest-rpc.js`, and the render owner sends no CPU frame while the
    executor presents. `?gl-renderer=webgl`, or `glRenderer: 'webgl'` on an
    app in `lib/apps.js`, keeps the JS path; no app opts out. (`heretic2_demo`
    did until 2026-11-16, for a 1 px dark seam where the main-menu book's
    tiled quads meet: the perspective y lift was rounded away on
    SwiftShader, see D1. Hexen II declined every frame with reason 10 until
    the WebGL executor gained linear-filtered border the same day.) The CLI default is unchanged
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
  - **Status (gl-retire S1/S2).** The CLI/Node default is `software` with
    gps on: the software executor, or the WebGL executor with
    `--headless-gl` (`--gl-renderer=webgl` still selects the JS path).
    `src/09a8cw-gl-wgl.wat` owns the WGL lifecycle for software contexts:
    an instance's first GL record (0x10008) asks the host, and
    `lib/host-imports.js` answers "WAT owns" for the software backend (with
    its glGps decision). From then on `$gl_emit_record` answers each record
    in place and nothing is flushed to a host: context handles (a
    process-wide counter), make-current with a per-instance owner mark,
    delete, wglShareLists, wglCopyContext validation, SwapBuffers/glFlush
    presentation, glReadPixels from the leased read surface, glGenTextures
    (generated names reserved per share group), gluScaleImage and the
    gluBuild*Mipmaps status. Threads mode needs no mailbox: each guest
    instance asks and answers for itself. `test-gl-wgl-owned` compares every
    answer and the picture against the JS-hosted path. The JS GL transport is
    now reachable only from `webgl` and from test harnesses that replay the
    stream into `OpenGLHostBridge` themselves.
  - **Status (gl-retire S3).** The JS GL transport is deleted:
    `lib/gl-render-host.js` (its D3DIM endpoint bridge moved into
    `lib/host-imports.js` unchanged), `lib/gl-render-worker.js` (the
    render-Worker `gl` kind), `lib/gl-software-producer.js` (the Threads
    producer mailbox), the GL packet publication in `lib/guest-rpc.js`,
    `?gl-renderer=`, the app `glRenderer` opt-out, `--gl-renderer=webgl` and
    `--trace-gl` (both now fail fast). A host answers exactly one GL record,
    the 0x10008 mode query; any other GL batch reaching a host throws. Still
    in the tree, and why: `lib/gl-command-stream.js` is the encoder's record
    ABI (ARG_WORDS/BARRIERS, generated into `09a8d-gl-abi.generated.wat` and
    checked by the build gates) and the Worker's query transport.
  - **Status (gl-retire S4).** `lib/gl-compat.js` and `lib/glide-host.js`
    are deleted. The `CALLS`/`CALL_INDEX` opcode table moved into
    `lib/gl-command-stream.js` (one data table, checked name-for-name
    against `tools/gen_dispatch.js` gpuApis by
    `tools/check-wat-js-constants.js`). The GL tests that replayed the
    stream into the `OpenGLHostBridge` oracle now run WAT-owned through
    `test/helpers/gl-owned-host.js` (answers the 0x10008 query, throws on
    any other batch, registers WAT windows) or `gl-gps-context.js`, and
    assert on WAT state, readbacks and pixels; tests that only exercised
    the JS frontend (FixedFunctionGL, its WebGL backend, the bridge's
    bookkeeping) are deleted, and `test-gl-wgl-owned` compares against a
    fixture recorded from the oracle before deletion
    (`test/fixtures/gl-wgl-owned-oracle.json`). Glide's bridge is
    `GpuStreamHost.Bridge` with `api: 'glide'`. `--gl-gps=off` and
    `?gl-gps=off` are gone: the only GL choice left is the executor
    (webgl, software, null). Readback happens only for glReadPixels and
    the other guest pixel reads WAT answers in place.
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
- 09a8g's coverage may not match the retired JS frontend (texgen is sphere-map only).
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
