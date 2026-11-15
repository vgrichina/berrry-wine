# GPU stream v2

One byte-level command stream between the WAT graphics frontends (Glide,
D3D9, D3DIM, OpenGL) and every renderer (WebGL, software, null, later WebGPU
and Berrry's native C replayer).

**Status:** steps 0 and 1 are implemented — the wire format, ring, null
executor, dump tool and Glide (2 and 3) run on it. D3D9, D3DIM and OpenGL
still use their old transports. Run `20261114-gpu-stream-v2-glide` has the
evidence.

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
| 4 | u16 version, u16 flags | producer |
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
| 128– | producer-private (except 160): seq storage, last_present, owner, producer_lock, handoffs, guest block pointers | producer |

`lib/gpu-stream.generated.js` is the authoritative offset list.

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

- **Local** (`lib/gpu-stream-host.js` Bridge; `lib/glide-host.js` is a shim
  that only names the API): the kick drains the ring synchronously. This is
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

Further formats are appended to this list. Codes 1–4 match the existing
native16 format codes in `lib/d3dim-gpu.js`. Resources start zeroed.

## Opcodes

| op | name | payload |
|---|---|---|
| 1 | CREATE | u32 id, u8 kind, u8 fmt, u16 levels, u32 w, u32 h, u32 size |
| 2 | UPLOAD | u32 id, u16 level, u16 face, x, y, w, h, u32 pitch, u32 src (arena position), u32 bytes. Rows top-down. |
| 3 | RELEASE | u32 id |
| 4 | SHADER | u32 id, u8 stage, u32 ir_bytes, IR (the `src/09af-d3d-shader-ir.wat` encoding, ABI 1) |
| 5 | LAYOUT | u32 id, u32 n, u32 stride, n × {u8 slot, u8 type, u8 usage, u8 index, u16 offset, u16 pad} |
| 6 | SAMPLER | u32 id, u8 address_u, u8 address_v (D3DTADDRESS), u8 min, u8 mag (1 point, 2 linear), u8 mip (0 none), f32 lod_bias |
| 10 | TARGETS | u32 color_rt, u32 depth_ds (0 = none) |
| 11 | VIEWPORT | i32 x,y,w,h; f32 zmin,zmax |
| 12 | RASTER | fixed 64-byte block, see below |
| 13 | BIND | u32 n, n × {u32 slot, u32 texture id, u32 sampler id} |
| 14 | CONSTS | u8 stage, u16 first, u32 count, f32×4×count |
| 20 | DRAW | u8 prim, u32 vs, u32 ps, u32 layout, u32 vbuf, u32 voff, u32 stride, u32 ibuf (0 = none), u32 ioff, u32 count |
| 21 | DRAW_UP | same as DRAW; vbuf 0 and voff is an arena position |
| 22 | CLEAR | u8 mask (1 color, 2 z, 4 stencil), u8 colormask, u32 rgba (R \| G<<8 \| B<<16 \| A<<24), f32 z, u32 stencil, rect |
| 23 | COPY | u32 src, u32 dst, src rect, dst rect, u32 filter |
| 30 | FENCE | u32 slot: the executor writes the seq into the slot |
| 31 | READBACK | u32 rt, rect, u32 fmt, u32 arena dst, u32 pitch, u32 slot: only for Lock, GetDC or an LFB read, never once per frame |
| 32 | PRESENT | u32 rt, u32 gamma (256×1 lookup texture id, 0 = none), rect, u32 surface (window handle): gamma runs on the GPU and nothing is read back |
| 33 | MARK | u32 frame, u32 tag |

Rects are top-down and half-open. `vs` 0 means pretransformed: positions are
render-target pixels, y down, pixel centres at +0.5 (Glide/D3D XYZRHW).
Primitives are D3DPRIMITIVETYPE values (1 points, 2 lines, 4 triangles).

**RASTER** (64 bytes): u8 depth_mode (0 off, 1 Z, 2 W), zfunc, zwrite, cull,
blend, src_rgb, dst_rgb, src_alpha, dst_alpha, alpha_func, alpha_ref,
colormask (R,G,B,A = 1,2,4,8), fog_mode (0 none, 1 vertex alpha, 2 table on
W, 3 Z), fog_flags (1 no multiply, 2 no add), fill, pad; u32 fog_color;
u32 fog_table (an L8 64×1 texture id); i32 depth_bias; scissor left, top,
right, bottom; 20 reserved bytes. Enums are D3D's: compare functions are
D3DCMP (1 never … 8 always), blend factors D3DBLEND, cull is D3DCULL in
render-target pixel space (1 none, 2 drops triangles clockwise on screen,
3 counter-clockwise).

**Sticky state.** RASTER, CONSTS, BIND and TARGETS persist in the executor
until the next record of the same op, across SHADER changes and draws. A
RASTER block is always complete (never a partial update), but the producer
re-emits a block only when its bytes differ from the last one it sent — on
the NFS III demo that cut RASTER from 488K records to 13K and CONSTS to one.
CLEAR uses its own rect and colormask and leaves the sticky state in force.

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
  depth buffer, a fixed 64-byte layout (position, colour, tex0, tex1 as
  float4) and a SAMPLER per distinct TMU filter/clamp/LOD state.
- Texture RAM, the palette and every texel-format decode live in WAT. A
  texture is decoded to A8B8G8R8 and uploaded the first time a TMU samples
  it; a download over its range, or a palette change for P8/AP88 formats,
  releases it.
- Colour/alpha combine, texture combine, chroma key and constant colour are
  compiled into pixel-shader IR, cached by key. Constants travel in CONSTS.
- Depth, blend, alpha test, cull, colour mask, clip window and fog become
  RASTER; the fog table is an L8 64×1 texture and W depth is computed in the
  executor from `oow` (the Voodoo 12-bit mantissa / 4-bit exponent form).
- Triangles, lines and points batch into DRAW_UP (TRIANGLELIST, LINELIST,
  POINTLIST) with screen-linear varyings; the y flip for a lower-left origin
  is applied to vertices and swaps the cull sense.
- LFB reads are READBACK (RGB565, rows top-down) plus a SYNC kick; LFB writes
  are RT UPLOADs.
- grBufferSwap is PRESENT with a 256×1 gamma texture when a gamma ramp is
  set.

Known differences from the old JS backends: gamma uses the LUT sampled at
`(floor(c*255+0.5)+0.5)/256` on both executors; the software executor
refuses fog no-multiply/no-add, and both refuse a colour mask that writes
only some colour channels, combine `local = 2`, and fog/gamma/TMU writes
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
- `tools/gpu-stream.js list|stats|replay FILE --executor=null|soft|webgl
  [--png=OUT --frame=N]` inspects and replays a dump.
- Tests: `test/test-gpu-stream-{ring,decoder,null,dump,software,webgl}.js`
  and `test/gpu-stream-fixture.js`, a JS producer that mirrors the WAT one
  byte for byte.

## Rollout

0. Spec, generator, ring, null executor and dump tool. **Done.**
1. Glide. **Done.**
2. D3D9.
3. D3DIM, after the D3D present rework lands.
4. OpenGL.

Every step gets a browser fps A/B and a pixel comparison against the commit
before the switch.
