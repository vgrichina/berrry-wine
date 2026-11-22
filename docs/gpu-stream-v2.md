# GPU stream v2

One byte-level command stream between the WAT graphics frontends (Glide,
D3D9, D3DIM, OpenGL) and every renderer (WebGL, software, null, later WebGPU
and Berrry's native C replayer).

**Status:** steps 0 and 1 are implemented — the wire format, ring, null
executor, dump tool and Glide (2 and 3) run on it. Run
`20261114-gpu-stream-v2-glide` has the evidence. D3DIM's GPU path is the WAT
producer `src/09abg-d3dim-gps.wat` (slice D2). Its old JS WebGL executor,
`lib/d3dim-gpu.js`, and its 0x20007/0x2000A host records were deleted in D2c.
Since D4 the producer is the only D3DIM path, on the
WebGL, software or null executor; the WAT software rasterizer and the render
Worker's D3DIM replay are retired. D3D9 and OpenGL are being migrated;
see the migration plan.

**Why.** Before v2, WAT wrote API-level records (Glide ops, D3DIM method calls,
raw gl* calls, D3D9 records), and JS lowered them. The D3D9 path then turns
them into v1 command objects (`lib/d3d-command-stream.js`). Each renderer
therefore had to understand four APIs, and a C host would have to port about
9k lines of JS lowering. In v2, WAT does the lowering and writes the final
records into shared memory. Renderers only read them.

## No feature flag

Each frontend switches outright, in one change. The old path is not kept
alongside. To compare old and new, build the commit before the switch in a
separate `git worktree` and run both, measuring CPU, fps and pixels.
Evidence goes in `scratch/runs/<id>/`.

## Model

```
WAT frontend --writes--> RING + UPLOAD ARENA + COMPLETION SLOTS --reads--> executor
             <--done_seq, slots, error_code------------------------------
```

- The producer is WAT and the consumer is an executor. There is one consumer
  per ring and one producer **at a time** (see Threading).
- WAT owns all API semantics: COM, refcounts, state rules, texture formats
  and the translation of fixed-function state into shader IR.
- The executor owns nothing the guest can see. It runs records in order.
- The executor never reads guest memory. Data it needs is copied into the
  arena or inline in the record.
- Failure is loud. An unknown op, a malformed record or an unsupported state
  makes the executor store `error_seq`/`error_code` and throw; the producer
  checks `error_code` after each kick and traps. Nothing is skipped.

## Threading: the producer follows the device owner

A ring belongs to a device, not to the thread that created it. NFS III opens
Glide on a worker thread and draws on the main thread; Hype's main thread
only queries and T1 does everything else.

- The ring header records `owner`, the lock-owner id of the thread now
  producing. Every record begins with `$gps_own`: when `owner` matches, that
  one atomic load is the whole cost.
- On a mismatch the new thread takes the ring's `producer_lock`, kicks
  (ASYNC) whatever the previous owner already published so it is not
  stranded, stores itself as `owner`, bumps `handoffs` and continues.
- Frontends already serialize their calls with their own lock (Glide's
  shared board lock), and `seq` comes from one device counter, so a device
  driven by two threads in one frame ping-pongs but stays correct.
- A ring is never bound to its creating thread.

## Ring directory entry

`$GPU_STREAM` (a compiler-allocated region) holds `$GPS_RING_MAX` (8) entries
of `GpsRing`. Ring bytes and the arena are guest-heap blocks named by
`ring_data`/`arena_data`; both sizes are powers of two. All positions are
monotonic u32 byte counters (the byte lives at `data + (pos & (bytes-1))`).
u32 fields shared with the consumer are accessed with Atomics.

| off | field | writer |
|---|---|---|
| 0 | u32 magic `'GPS2'` | producer |
| 4 | u16 version (2), u16 flags | producer |
| 8 | u32 ring_bytes | producer |
| 12 | u32 arena_bytes | producer |
| 16 | u32 write_pos (published after the record is complete) | producer |
| 20 | u32 read_pos | consumer |
| 24 | u32 submit_seq | producer |
| 28 | u32 done_seq | consumer |
| 32 | u32 arena_head | producer |
| 36 | u32 arena_tail | consumer |
| 40 | u32 error_seq | consumer |
| 44 | u32 error_code (1 unknown op, 2 malformed, 3 unsupported, 4 executor) | consumer |
| 48 | u32 ring_data, u32 arena_data (wasm addresses) | producer |
| 56 | u32 api (1 = Glide: which host bridge consumes it) | producer |
| 60 | u32 seq_counter (wasm address of the device-wide seq counter) | producer |
| 64–127 | 16 completion slots: FENCE/READBACK store their seq here | consumer |
| 160 | u32 consumer (non-zero = a render Worker armed this ring; WAT never reads it) | consumer |
| 164 | caps: u32 flags, max_texture, max_samplers, max_aniso, formats | consumer |
| 184 | u32 kick_wp, u32 kick_ah: write_pos / arena_head at the producer's last own kick (`$gps_kick_mark`) | producer |
| 128–159 | producer-private: seq storage, last_present, owner, producer_lock, handoffs, guest block pointers | producer |

`lib/gpu-stream.generated.js` is the authoritative offset list.

**Producer helpers.** Every frontend begins records through
`$gps_begin_auto(h, op, n)` after closing its own open batch: once a quarter
of the ring (`ring_bytes >> 2`) or of the arena has been published since
`kick_wp`/`kick_ah`, it marks and ASYNC-kicks first. Every UPLOAD record is
written by `$gps_upload(h, id, level, face, x, y, w, h, pitch, src, bytes)`.

**Shared accounting.** After the directory, `$GPU_STREAM` holds 32 u32
counters per api (`gps_stat(api, i)`, never reset), counted where records
are published so every producer counts the same way: 0 PRESENTs, 1 DRAW and
DRAW_UP, 2 READBACKs, 3 readback bytes, 4 UPLOADs, 5 upload bytes, 6 declines,
7 SYNC kicks. 16..31 are opt-in texture-cache diagnostics
(`gps_tex_diag(1)`, `test/run.js --gps-tex-diag`; Glide and D3DIM): fills,
distinct textures summed per frame, evictions of an entry used this frame,
drops by cause (release, capacity, write, palette, descriptor, untracked),
fills whose decoded bytes equal a dropped entry of each cause, and fills
equal to another live entry. `test/run.js` prints them as `[gps]` lines;
the page HUD reads `gps_stat_active/frames/readbacks/uploads` and shows
readbacks and uploads per frame for the API that presented last.

**Texture cache.** Glide and D3DIM keep decoded textures in one shared
`$gtc_*` slot cache (`09a8gu-gps-tex-cache.wat`): 512 slots per producer,
least-recently-used eviction under a 32 MB byte budget, and pinning — an
entry looked up since the producer's last `$gtc_unpin` (Glide: the pipeline
being built; D3DIM: the draw's texture) is never named a victim. The cache
only does bookkeeping: each producer keeps its own key and validity in its
slot payload (Glide: TMU range, descriptor and the palette content key for
P8/AP88, released on an overlapping TMU write; D3DIM: surface identity,
signature and page-watch generations) and evicts through its own RELEASE
path, so GPU-side ids stay per ring. Diablo II's town (~200 textures per
frame) went from ~198 uploads per frame on the old 64-slot round robin to
~12 (run 20261121-gps-plumbing).

**Capability block.** `drain()` writes the executor's `caps()` into the
header before it executes the first record, and sets `CAP_VALID` (1) last.
WAT reads it to decide what the guest is told; nothing else negotiates
features. Flags: 2 VS_IR, 4 STENCIL, 8 LOGIC_OP, 16 OCCLUSION, 32
BORDER_LINEAR, 64 MIRRORONCE, 128 CLIP_PLANES, 256 WBUFFER, 512 COPY,
1024 DEPTH_READBACK (READBACK fmt D16 of a D16 DS), 2048 DS_READBACK
(READBACK fmt D24S8 of a D24S8 DS; independent of 1024). `formats` is a bit per fmt code (bit 15 =
A8B8G8R8). Each executor's caps:

| executor | flags | max_texture | max_samplers | max_aniso |
|---|---|---|---|---|
| null | all | 16384 | 16 | 16 |
| software | VS_IR, STENCIL, LOGIC_OP, OCCLUSION, BORDER_LINEAR, MIRRORONCE, CLIP_PLANES, WBUFFER, COPY, DEPTH_READBACK, DS_READBACK | 2048 | 6 (the native VM's stages) | 1 |
| webgl | STENCIL, LOGIC_OP, OCCLUSION, BORDER_LINEAR, CLIP_PLANES (with VS_IR, 266 vertex uniform vectors and 12 varyings), WBUFFER (WebGL2, desktop GL or EXT_frag_depth) | MAX_TEXTURE_SIZE | min(8, units − 2) | 1 |

The WebGL executor keeps two texture units past the samplers: the fog
table and the logic-op destination copy. GL has no border wrap mode: a
point-filtered BORDER axis is a test on the coordinate, and any linear
filtering on a BORDER sampler is done in the fragment shader from NEAREST
texel fetches (the four taps, the min/mag choice and the mip levels), with
the software executor's arithmetic.

A record that needs a capability the executor did not advertise is refused
with error 3 (unsupported), never approximated.

## Record

```
u16 op | u16 flags | u32 byteLength | u32 seq | payload (fixed little-endian layout)
```

- Records are 8-byte aligned and never split across the end of the ring.
- `op 0` = WRAP: skip to the start of the ring.
- flags bit 0 = WANT_DONE: publish `done_seq` right after this record.
- A device may own several rings; their records carry seq values from one
  device counter and a consumer merges rings by seq.
- Op numbers are append-only, like `api_table.json`
  (`tools/gpu-stream-ops.json` is the baseline the build checks).

## Kicks

The producer hands work over with one host import,
`gpu_stream_kick(ring, mode) -> i32`:

| mode | meaning |
|---|---|
| 0 ASYNC | records are published; the host may run them later. Returns at once. |
| 1 SYNC | returns after the consumer executed every published record. |
| 2 CLOSE | SYNC, then the consumer drops every resource of the device. |

The return value is 1 when an executor exists, 0 when none can (the open
fails). After a SYNC/CLOSE kick the producer checks `read_pos == write_pos`
and traps otherwise. Hosts:

- **Local** (`lib/gpu-stream-host.js` Bridge, constructed with `api: 'glide'`
  for Glide): the kick drains the ring synchronously. This is
  cooperative mode, where the page main thread cannot block for a SYNC kick.
- **Render Worker** (`lib/gpu-stream-render-worker.js`, API-neutral): the
  first `{t:'gps-kick', ring, mode}` message *arms* the ring by writing the
  ring's `consumer` word. From then on the Worker drains with
  `Atomics.waitAsync(write_pos)`.
- **Doorbell** (`lib/gpu-stream-doorbell.js`): on an armed ring an ASYNC
  kick is only `Atomics.notify(write_pos)`, with no message. A SYNC kick
  `Atomics.wait`s on `done_seq` until `read_pos == write_pos`, checks
  `error_code`, and gives up after 30 s with no progress. An unarmed ring
  falls back to the page bridge.
- **Guest thread** (`lib/guest-rpc.js`): in Threads mode the guest Worker
  rings the render Worker's doorbell directly. Only CLOSE, and kicks before
  the ring is armed, go through the page.

The executor contract is `open` / `execute(record)` / present sink / `close`
/ stats. The Worker selects a backend by name (webgl, or software when there
is no OffscreenCanvas or WebGL). Only the ring attach, the doorbell, the sync
reply, frames and `gps-error` cross the Worker boundary. PRESENT reaches the
page as an ImageBitmap drawn into the window's `{kind:'gpu'}` frame layer,
the same layer as the D3DIM GPU present, so nothing is read back. CPU pixel
frames are sent only by the software backend.

## Resources

Resources have u32 ids allocated by WAT. An id is never reused while it is
live; a device's CLOSE releases them all.

kind:

| value | kind |
|---|---|
| 1 | TEX2D |
| 2 | CUBE |
| 3 | VBUF |
| 4 | IBUF |
| 5 | RT |
| 6 | DS |
| 7 | SHADER |
| 8 | LAYOUT |
| 9 | SAMPLER |
| 10 | STATEBLK |

fmt:

| value | fmt |
|---|---|
| 1 | RGB565 |
| 2 | X1R5G5B5 |
| 3 | A1R5G5B5 |
| 4 | A4R4G4B4 |
| 5 | X8R8G8B8 |
| 6 | A8R8G8B8 (bytes B,G,R,A) |
| 7 | P8 |
| 8 | D16 |
| 9 | D24S8 |
| 10 | DXT1 |
| 11 | DXT3 |
| 12 | DXT5 |
| 13 | L8 |
| 14 | A8 |
| 15 | A8B8G8R8 (bytes R,G,B,A — what WebGL and the software rasterizer take without a swizzle) |

**Buffers.** CREATE of a VBUF or IBUF gives `size` bytes (1 .. 64 MB) with
w = size, h 1, levels 1, fmt 0; contents start zeroed. UPLOAD into one has
level 0, face 0, y 0, h 1, w = pitch = bytes, and x is the destination byte
offset (x + bytes ≤ size). A buffer is read only by DRAW.

Further formats are appended to this list. Codes 1–4 match the D3DIM
native16 format codes (`$dx_surf_fmt_get`). Resources start zeroed, except
a DS, which starts at depth 1.0 (far) and stencil 0 in every executor, so a
draw before the first CLEAR passes a LESS test.

The **required** formats are A8B8G8R8 (TEX2D and RT), D16 and D24S8 (DS).
Every other code exists only so WAT can name what it converts from; WAT
converts at UPLOAD and READBACK, and an executor may refuse any format whose
bit is not in its caps (all three in-tree executors refuse the rest).

## Opcodes

| op | name | payload |
|---|---|---|
| 1 | CREATE | u32 id, u8 kind, u8 fmt, u16 levels, u32 w, u32 h, u32 size |
| 2 | UPLOAD | u32 id, u16 level, u16 face, x, y, w, h, u32 pitch, u32 src (arena position), u32 bytes. Rows top-down. |
| 3 | RELEASE | u32 id |
| 4 | SHADER | u32 id, u8 stage (0 vertex, 1 pixel), u32 ir_bytes, IR (the `src/09af-d3d-shader-ir.wat` encoding, ABI 1; stage 0 is core vertex IR, see "Vertex shaders") |
| 5 | LAYOUT | u32 id, u32 n, u32 stride, n × {u8 slot, u8 type, u8 usage, u8 index, u16 offset, u16 pad}; see "Core executor contract" |
| 6 | SAMPLER | u32 id, u8 address_u, u8 address_v (D3DTADDRESS: 1 wrap, 2 mirror, 3 clamp, 4 border, 5 mirror-once), u8 min, u8 mag (1 point, 2 linear), u8 mip (0 none, 1 point, 2 linear), u8 address_w (0 = unused), u8 max_level (D3D MAXMIPLEVEL: the most detailed level sampled), u8 max_aniso (≤ caps), f32 lod_bias, u32 border (R \| G<<8 \| B<<16 \| A<<24) |
| 10 | TARGETS | u32 color_rt, u32 depth_ds (0 = none) |
| 11 | VIEWPORT | i32 x,y,w,h; f32 zmin,zmax (0 ≤ zmin ≤ zmax ≤ 1). Inside the colour target; clips pretransformed draws (intersected with the scissor). TARGETS resets it to the whole target |
| 12 | RASTER | fixed 96-byte block, see below |
| 13 | BIND | u32 n, n × {u32 slot, u32 texture id (TEX2D, CUBE or RT), u32 sampler id}. Sampling the bound colour target is refused |
| 14 | CONSTS | u8 stage (0 vertex: c0..c255, 1 pixel: c0..c7), u16 first, u32 count, f32×4×count |
| 15 | CLIP | u32 mask (bits 0–5), f32×4×6 planes (a, b, c, d) in D3D clip space; disabled planes zero. Sticky. A draw with `vs ≠ 0` keeps only what satisfies a·x + b·y + c·z + d·w ≥ 0 on the output position for every enabled plane (before the divide; z 0..w); `vs 0` draws ignore it, as D3D does for pretransformed vertices. A nonzero mask needs CAP_CLIP_PLANES |
| 20 | DRAW | u8 prim (1–5), u8 index_size (0 none, 2, 4), u32 vs, u32 ps, u32 layout, u32 vbuf, u32 voff, u32 stride, u32 ibuf (0 = none), u32 ioff, u32 count (indices, or vertices when index_size 0), u32 vcount (vertices addressed; = count when not indexed; every index < vcount). voff and ioff are byte offsets into the VBUF and IBUF: D3D's base vertex is `voff = (offset + BaseVertexIndex) × stride` and its start index `ioff = StartIndex × index_size` (ioff aligned to index_size); vertex 0 of the draw is at voff, and indices are relative to it |
| 21 | DRAW_UP | same as DRAW; vbuf and ibuf 0, voff (and ioff when indexed) are arena positions |
| 22 | CLEAR | u8 mask (1 color, 2 z, 4 stencil), u8 colormask, u32 rgba (R \| G<<8 \| B<<16 \| A<<24), f32 z, u32 stencil, rect |
| 23 | COPY | u32 src, u32 dst, src rect, dst rect, u32 filter |
| 30 | FENCE | u32 slot, u8 kind (0 fence, 1 occlusion begin, 2 occlusion end), u32 dst: kind 0 writes the seq into the slot; kind 2 also writes the u32 count of samples that passed since the begin to arena dst. Occlusion needs CAP_OCCLUSION; begins do not nest |
| 31 | READBACK | u32 rt, rect, u32 fmt (A8B8G8R8 for an RT; WAT converts. A DS reads as D16 with CAP_DEPTH_READBACK — LE u16 round(depth·65535), pitch ≥ 2w — or as D24S8 with CAP_DS_READBACK — LE u32 round(depth·0xffffff) << 8 \| stencil, pitch ≥ 4w; the fmt must match the DS), u32 arena dst, u32 pitch (≥ 4w), u32 slot: only for Lock, GetDC or an LFB read, never once per frame |
| 32 | PRESENT | u32 rt, u32 gamma (256×1 lookup texture id, 0 = none), rect, u32 surface (window handle), i32 dst_x, i32 dst_y (window-relative destination), u32 stamp (CPU-present sequence; the page drops a frame older than one already shown): gamma runs on the GPU and nothing is read back |
| 33 | MARK | u32 frame, u32 tag |

Rects are top-down and half-open. `vs` 0 means pretransformed: positions are
render-target pixels, y down, pixel centres at integer coordinates (D3D
XYZRHW; Glide's +0.5 centres are moved in WAT). Primitives are
D3DPRIMITIVETYPE values 1–5 (points, lines, line strip, triangles, triangle
strip); fans are lowered to indexed lists by the producer.

**RASTER** (96 bytes):

| off | fields |
|---|---|
| 0 | u8 depth_mode (0 off, 1 Z, 2 W: depth from interpolated 1/rhw, 3 D3D W-buffer: w / w_far, needs CAP_WBUFFER), zfunc, zwrite, cull |
| 4 | u8 blend (0/1), src_rgb, dst_rgb, src_alpha, dst_alpha (D3DBLEND 1–11) |
| 9 | u8 alpha_func, alpha_ref, colormask (R,G,B,A = 1,2,4,8) |
| 12 | u8 fog_mode (0 none, 1 vertex alpha, 2 table on W, 3 Z), fog_flags (1 no multiply, 2 no add), fill (D3DFILL; executors take 3 solid), linear (1 = screen-linear varyings) |
| 16 | u32 fog_color, u32 fog_table (an A8B8G8R8 64×1 texture id; R is the fog blend), i32 depth_bias (W-depth units, ±65535) |
| 28 | i32 scissor left, top, right, bottom |
| 44 | u8 blend_op, blend_op_alpha (D3DBLENDOP 1 add, 2 subtract, 3 revsubtract, 4 min, 5 max; checked only when blend is 1) |
| 46 | u8 stencil_enable, two_sided, stencil_func, fail, zfail, pass (D3DCMP / D3DSTENCILOP 1–8), ccw_func, ccw_fail, ccw_zfail, ccw_pass, ref, mask, wmask |
| 59 | u8 logic_op: 0 off, else 1 + (GL logic op − GL_CLEAR 0x1500), so 1..16: 1 CLEAR, 2 AND, 3 AND_REVERSE, 4 COPY, 5 AND_INVERTED, 6 NOOP, 7 XOR, 8 OR, 9 NOR, 10 EQUIV, 11 INVERT, 12 OR_REVERSE, 13 COPY_INVERTED, 14 OR_INVERTED, 15 NAND, 16 SET. n = logic_op − 1 is the truth table: result bit = (n >> ((1−s)·2 + (1−d))) & 1. Needs CAP_LOGIC_OP and blend 0 (a logic op replaces blending, as in GL); see "Logic ops" |
| 60 | f32 z_bias (fraction of the depth range), f32 slope_bias (depth_mode 1 only) |
| 68 | f32 w_far (depth_mode 3: finite, > 0; otherwise 0) |
| 72 | 24 reserved bytes, zero |

Enums are D3D's: compare functions are D3DCMP (1 never … 8 always), blend
factors D3DBLEND, cull is D3DCULL in render-target pixel space (1 none, 2
drops triangles clockwise on screen, 3 counter-clockwise). `blend 0` is a
plain write: the blend factors and ops are then not read. `two_sided` needs
`stencil_enable`; the main set applies to clockwise triangles and the ccw
set to counter-clockwise ones. Stencil needs a D24S8 depth target.

**Sticky state.** RASTER, CONSTS, CLIP, BIND and TARGETS persist in the executor
until the next record of the same op, across SHADER changes and draws. A
RASTER block is always complete (never a partial update), but the producer
re-emits a block only when its bytes differ from the last one it sent — on
the NFS III demo that cut RASTER from 488K records to 13K and CONSTS to one.
CLEAR uses its own rect and colormask and leaves the sticky state in force.

## Core executor contract

What an executor must do, so a new backend can be written from this section
and the generated layouts alone (`lib/gpu-stream.js` `validateLayout`,
`validateRaster` and `assemble` are the shared reference checks).

- **Coordinates.** Pretransformed POSITIONT (x, y, z, rhw) in RT pixels, y
  down; pixel (i, j) is sampled at (i, j). A pixel is covered when its centre
  is inside the triangle; on an edge, the D3D top-left rule decides. z is
  0..1 depth for depth_mode 1.
- **Interpolation.** `linear 0` is perspective-correct (as if clip w =
  1/rhw); `linear 1` interpolates every varying screen-linearly and uses
  rhw only for W depth and table fog. Glide sets linear 1.
- **W depth (depth_mode 2).** Depth is computed per pixel from interpolated
  rhw in the Voodoo 16-bit floating W form (4-bit exponent, 12-bit
  mantissa), plus `depth_bias`, and compared/stored as a fraction of 65535.
  Table fog indexes the 64-entry fog table by the same value / 1024.
- **D3D W-buffer (depth_mode 3, CAP_WBUFFER).** Depth is w / w_far clamped
  to 0..1, w = 1 / the perspective-interpolated rhw (a vertex-shader draw's
  clip w), tested and stored like Z in the depth target's format. z and the
  viewport's z range do not enter it; `linear` must be 0 and the biases 0.
  The WebGL executor writes it as the fragment depth, so only these draws
  give up early depth rejection.
- **LAYOUT.** Stream slot 0 only; stride 4–1024 and 4-aligned; elements
  4-aligned inside the stride. A layout without POSITIONT is
  *programmable*: its elements are D3DDECLUSAGE 0..13, index 0..15, each at
  most once, and they feed a vertex shader (see "Vertex shaders"); `vs 0`
  draws need a POSITIONT layout and `vs ≠ 0` draws a programmable one. In a
  pretransformed layout: exactly one FLOAT4 POSITIONT0; COLOR0/1
  (FLOATn or D3DCOLOR, B,G,R,A bytes → R,G,B,A) and TEXCOORD0..7 at most once
  each. A missing FLOATn component reads (0, 0, 1) behind; a missing COLOR0
  is (1, 1, 1, 1).
- **Draws.** Prims 1–5; a strip's odd triangles swap their first two
  vertices so every triangle keeps the strip's winding. Indexed draws read
  u16 or u32 indices and refuse one ≥ vcount.
- **Samplers.** Mirror, clamp, wrap and point-filtered border are required;
  mirror-once and linear-filtered border are optional (caps). LOD is clamped
  below at max_level. Anisotropy above caps is refused.
- **Render targets.** A colour RT may be bound as a texture once it is not
  the current colour target; its row 0 is the top row, like any TEX2D.
- **Cube textures.** CREATE kind 2 is square, A8B8G8R8, with `levels` per
  face; UPLOAD's `face` is 0..5 in D3D/GL order (+X, −X, +Y, −Y, +Z, −Z),
  rows top-down (row 0 at t = 0). Face selection and (s, t) are the D3D/GL
  rule (for +X: s = (−z/|x| + 1)/2, t = (−y/|x| + 1)/2). A cube is sampled
  clamped to the face edge whatever the sampler's address modes say. The IR
  names no texture type: BIND of a CUBE decides that the slot is a cube.
- **Required state.** Depth Z and W, alpha test, blend with all five ops,
  stencil (one- and two-sided), depth bias, scissor, viewport, any colour
  mask (each of R, G, B, A separately, on draws and CLEARs), fog modes 0–3.
- **Logic ops.** Applied to the 8-bit-per-channel fragment (rounded) and
  the destination after alpha test and fog; the colour mask applies after
  the op, and depth/stencil writes are unaffected (NOOP still writes depth).
  The software executor applies it in the native output stage; the WebGL
  executor uses exact output or blend forms where they exist (CLEAR, SET,
  COPY, COPY_INVERTED, INVERT = 1·(1 − dst), NOOP = colour mask 0) and
  otherwise samples a copy of the RT at `gl_FragCoord`. One
  `copyTexSubImage2D` serves a run of primitives that cover no pixel twice
  (triangles separated by edge-normal SAT, so triangles sharing an edge do
  not split a run; lines and points by a bounding box grown by one pixel;
  at most 256 shapes per copy); the copy is refreshed only when something
  other than a logic op wrote the RT, or the next primitive overlaps one
  drawn since the copy. No executor reads the RT back to the CPU for it.
- **Occlusion.** FENCE kind 1/2 counts pixels that pass depth and stencil
  (and alpha test), whatever the colour mask. The WebGL executor draws each
  run of non-overlapping primitives twice inside a query: first with the
  same tests into a count target sharing the depth/stencil buffer (adding
  1/255, depth and stencil unwritten), then the real pass; it sums the
  count target at END, and every 255 runs, with one `readPixels` of it.
- **Optional state (caps).** logic_op, occlusion, mirror-once,
  linear-filtered border, user clip planes, W-buffer (depth_mode 3). Without the cap the record fails as unsupported.
- **Samplers 6 and 7: the sampler-naming pixel IR.** Core pixel IR
  (header flag 8) with version **0xffff0200** names its sampler: texld (66)
  is `texld dst, coord, s#` with a third operand of bank 10 (D3DSPR_SAMPLER)
  whose index is the slot 0..7 (selector 0/2 = 2D, 3 = cube), and t0..t7 are
  readable inputs. Its op set is the core one (mov add mad mul rcp dp3 dp4
  min max lrp cmp def texkill texld). The canonicalizer
  (`$d3d_ps_core_copy`, 09af1) checks and copies it. The WebGL executor
  reaches slots 0..7 through it; the software executor's native VM has six
  stages, so its caps say 6 and it refuses a texld of s6/s7 at SHADER.
  ps_1_x core IR (0xffff0101..0104) keeps implying the stage by the
  destination (s0..s5).
- **Readback and present.** READBACK writes A8B8G8R8 rows top-down at the
  given pitch (a depth target: D16 or D24S8 words, also top-down). GL GPS
  uses the depth forms only when a frame moves to the CPU rasterizer
  mid-frame (`$glg_ds_readback`, 09a8gt), so occlusion and stencil carry
  over; an executor without the cap gets `$glg_fail(20)` instead. PRESENT hands the page a frame with `dstX`, `dstY` and
  `stamp`; the page shows a frame only if its stamp is not older (serial
  arithmetic) than the last one shown. `dstX`/`dstY` are relative to the
  window's client origin: a non-zero one (a windowed or child-window Blt
  present) places the frame there in a client-sized layer; a frame that
  covers the client replaces the layer, a partial one replaces only its
  rect and keeps the rest of the previous frame.
- **Fail fast.** Anything outside this section, or anything an executor
  cannot do exactly, throws a `GpsError`; `drain()` stores it in
  `error_seq`/`error_code` and the producer traps on its next SYNC kick.

## Vertex shaders

A SHADER of stage 0 carries **core vertex IR** (stage 0, version
0xfffe0200, header flag 8, flag 1 when relative constants are read),
produced in WAT by `$d3d_vs_canonicalize` (`src/09af1-d3d-shader-canon.wat`)
from validated vs_1_1 or vs_2_0 IR. It has temps r0..r31 (r28..r31 are the
lowering's scratch and its literal register), inputs v0..v15, constants
c0..c255 (DEF'd ones replace the CONSTS value), a0, and outputs oPos (bank
4:0), oFog (4:1), oPts (4:2), oD0..1 (bank 5), oT0..7 (bank 6). Its ops are
mov add mad mul rcp rsq dp3 dp4 min max slt sge exp log frc mova and cmp
(op 88, per component `a >= 0 ? b : c`, a pure select whose destination is
never one of its sources; only 09aj fixed-function IR's cnd lowers to it),
plus dcl and def; every macro and composite is lowered there: m4x4/m4x3/m3x4/m3x3/
m3x2 to dp rows, sub/abs/lrp, lit (gated pow, power clamped to ±127.996),
dst, expp/logp (vs_1_1 partial forms), pow, nrm, crs, and vs_1_1's
`mov a0` to floor + mova. Numerics are the shader VM's (09ag): rsq and log
of |x|, log(0) = −FLT_MAX, exp/log full precision, mova rounds to nearest
even, `c[a0.? + n]` reads zero outside c0..c255 or at a non-integer
address. Each `v#` read must be DCL'd (D3D8-style vs_1_1 without DCLs is
declined: the producer synthesizes DCLs from its declaration); coissue,
result shift and source modifiers other than negate, loops and aL are
declined (counted by `d3d_shader_ir_canon_declines`).

A draw with `vs ≠ 0` binds every DCL'd input by (usage, index) to the
programmable layout's element of that semantic (a missing one fails the
draw); D3DCOLOR elements read as (R, G, B, A). Output positions are clip
space: x, y through the viewport (VIEWPORT, or the whole target) onto the
same pixel centres as pretransformed draws, z/w 0..1 into zmin..zmax, w
for perspective-correct varyings. oD0/oD1 and oT0..7 feed the pixel
shader's v0/v1 and t0..7 (an unwritten output reads zero). `fog_mode 1`
(vertex) blends with D3D's oFog factor (1 = no fog) and needs a shader that
writes oFog; fog modes 2/3, W depth, `linear 1` and z/slope bias are
refused with a vertex shader. CONSTS stage 0 sets c0..c255. Executors with
a vertex stage set CAP_VS_IR: the software one runs the IR in the native
VM (oT0..5, six samplers); the WebGL one prints it to GLSL
(`compileCoreVS` in `lib/d3d9-shader.js`) when the context has 260 vertex
uniform vectors, 11 varyings and 16 attributes.

User clip planes (CLIP) are tested on the output position. The software
executor clips each primitive against them in the native rasterizer
(`d3d_software_create_deferred_clipped`, real polygon clipping); the WebGL
one, which has no `gl_ClipDistance` in GLSL ES, passes the six distances as
varyings and discards a fragment whose interpolated distance is negative.
The D3D9 producer sends a guest vertex shader's planes as they are (D3D9
defines them in clip space for programmable vertex processing) and moves
fixed-function ones from world space through inverse(View × Projection);
a singular View × Projection declines the draw (reason 27).

## Upload arena

- Large data (textures, LFB writes and DRAW_UP vertices) is copied into the
  arena by WAT.
- `arena_tail` advances as the consumer executes the records that used it.
- Static vertex and index buffers are uploaded once into their resource.
- Versioned zero-copy is a later optimization, added only if profiling says
  the copy costs.

## When the producer waits

| case | wait |
|---|---|
| Lock / GetDC / LFB read | READBACK, then a SYNC kick; the result is in the arena |
| ring or arena full | SYNC kick |
| Present | none, unless the previous PRESENT has not executed yet: at most two in flight |
| query / grFinish | SYNC kick, only when the result is needed now |
| open / close | SYNC / CLOSE kick |
| anything else | never |

The Glide producer also hands the consumer an ASYNC kick whenever a quarter
of the ring or arena has been written since the last kick, so a local or
Worker consumer runs while the guest keeps writing.

## Executors

| executor | does |
|---|---|
| null (`lib/gpu-stream.js`) | validates and counts records, keeps a cheap hash (tests, dumps, benchmarks) |
| webgl (`lib/gpu-stream-webgl.js`) | compiles IR with `compileNativeIR` to GLSL on the shared `lib/gpu-backend.js`; RTs are textures + FBOs |
| software (`lib/gpu-stream-software.js`) | drives the WAT native rasterizer (`src/09ah-d3d-software.wat`); replaced `lib/glide-software.js` |
| webgpu | prints IR as WGSL (later) |
| C | Berrry's replayer, built from the generated header |

## Glide lowering

`src/09a8h-glide.wat` lowers all of Glide 2 and Glide 3 to records; no Glide
enum reaches an executor.

- Open creates two A8B8G8R8 colour RTs (or one, single-buffered) and a D16
  depth buffer, a 64-byte LAYOUT (POSITIONT, COLOR0, TEXCOORD0, TEXCOORD1,
  all FLOAT4) and a SAMPLER per distinct TMU filter/clamp/LOD state.
- Texture RAM, the palette and every texel-format decode live in WAT. A
  texture is decoded to A8B8G8R8 and uploaded the first time a TMU samples
  it; a download over its range, or a palette change for P8/AP88 formats,
  releases it.
- Colour/alpha combine, texture combine, chroma key and constant colour are
  compiled into pixel-shader IR, cached by key. Constants travel in CONSTS.
- Depth, blend, alpha test, cull, colour mask, clip window and fog become
  RASTER; the fog table is an A8B8G8R8 64×1 texture (R = the fog blend) and
  W depth is depth_mode 2 from `oow` (pos.w = oow; tex0.z still carries it
  for the texture's own q).
- Triangles, lines and points batch into DRAW_UP (TRIANGLELIST, LINELIST,
  POINTLIST) with RASTER.linear 1; the y flip for a lower-left origin is
  applied to vertices and swaps the cull sense, and WAT subtracts 0.5 from x
  and y so Glide's +0.5 centres land on the contract's integer centres.
- LFB reads are READBACK (A8B8G8R8, rows top-down, at most 2 MB — half the
  arena — per band) plus a SYNC kick per band; WAT converts each band to
  RGB565 in the lock's stage. LFB writes are RT UPLOADs.
- The stage and a second copy are tagged with the buffer (and row order)
  they mirror; a READBACK or LFB write tags, a DRAW_UP on the buffer or an
  UPLOAD/RELEASE of it forgets, and a CLEAR is applied to the tagged copy
  in RGB565 (what its READBACK would return). An LFB request for a tagged
  buffer reads nothing back: a 2D loop that clears, LFB-writes and swaps
  (Die by the Sword's logos) reads back once per buffer, not per frame.
- `glide_gps_stat(i)` counts presents, draws, clears, READBACKs and rows,
  RT and texture UPLOADs, SYNC kicks, refused LFB requests and LFB requests
  by site; test/run.js prints them as `[glide-gps]` with a hash of the last
  presented Glide frame.
- grBufferSwap is PRESENT with a 256×1 gamma texture when a gamma ramp is
  set.

Known differences from the old JS backends: gamma uses the LUT sampled at
`(floor(c*255+0.5)+0.5)/256` on both executors; the software executor
refuses fog no-multiply/no-add, and both refuse combine `local = 2`, and fog/gamma/TMU writes
before the first open — all fail fast rather than draw wrongly.

## One source of truth

The record layouts and constants are declared once, in
`src/09a8gs-gpu-stream.wat`. `tools/gen-gpu-stream.js` generates the JS
decoder (`lib/gpu-stream.generated.js`) and later the C header; the build
refuses a stale mirror and any renumbered op. Any new WATX language feature
this needs requires sign-off first.

## Tools

- `--gpu-stream-dump=FILE` (test/run.js) tees every executed record, with
  its arena data, into a dump.
- `--glide-renderer=null|software|webgl` picks the Glide executor.
- `--d3dim-gpu` (test/run.js) puts D3DIM on the WAT producer; with
  `--headless-gl` it prints `[d3dim-gps]` counters, readbacks per site and
  software-decline reasons. Without it, and on the page with
  `?d3d-renderer=software` or `?d3dim-gpu=0`, D3DIM uses the software
  rasterizer. The remaining page switches are listed in
  [d3dim-gpu-present.md](d3dim-gpu-present.md#switches).
- `tools/gpu-stream.js list|stats|replay FILE --executor=null|soft|webgl
  [--png=OUT --frame=N]` inspects and replays a dump.
- Tests: `test/test-gpu-stream-{ring,decoder,null,dump,software,webgl}.js`
  and `test/gpu-stream-fixture.js`, a JS producer that mirrors the WAT one
  byte for byte.

## Rollout

The order is now **D3DIM, then D3D9 together with D3D8, then GL**, with D1
executor growth first. The plan per API, with slices, tests and readback
sites, is in [gpu-stream-v2-migration.md](gpu-stream-v2-migration.md). It
replaces the order listed below where they differ.


0. Spec, generator, ring, null executor and dump tool. **Done.**
1. Glide. **Done.**
2. D3D9.
3. D3DIM. **Done** (D2a-D2c; the software arm moves in D4).
4. OpenGL.

Every step gets a browser fps A/B and a pixel comparison against the commit
before the switch.
