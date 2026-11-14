# GPU stream v2

One byte-level command stream between the WAT graphics frontends (Glide,
D3D9, D3DIM, OpenGL) and every renderer (WebGL, software, null, later WebGPU
and Berrry's native C replayer).

**Status:** draft. Nothing implements it yet. It is adopted one frontend at a
time, with Glide first.

**Why.** Today WAT writes API-level records (Glide ops, D3DIM method calls,
raw gl* calls, D3D9 records), and JS lowers them. The D3D9 path then turns
them into v1 command objects (`lib/d3d-command-stream.js`). Each renderer
therefore has to understand four APIs, and a C host would have to port about
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
             <--done_seq, results---------------------------------------
```

- The producer is WAT and the consumer is an executor. There is one ring per
  device, with a single producer and a single consumer.
- WAT owns all API semantics: COM, refcounts, state rules, and the
  translation of fixed-function state into shader IR.
- The executor owns nothing the guest can see. It runs records in order.
- The executor never reads guest memory. Data it needs is copied into the
  arena or inline in the record.

## Ring header (64 bytes; u32 fields accessed with Atomics)

| off | field | writer |
|---|---|---|
| 0 | u32 magic `'GPS2'` | producer |
| 4 | u16 version, u16 flags | producer |
| 8 | u32 ring_bytes | producer |
| 12 | u32 arena_bytes | producer |
| 16 | u32 write_pos (published after the record is complete) | producer |
| 20 | u32 read_pos | consumer |
| 24 | u32 submit_seq | producer |
| 28 | u32 done_seq (producer may `Atomics.wait`) | consumer |
| 32 | u32 arena_head | producer |
| 36 | u32 arena_tail | consumer |
| 40 | u32 error_seq | consumer |
| 44 | u32 error_code | consumer |
| 48–63 | reserved | |

## Record

```
u16 op | u16 flags | u32 byteLength | u32 seq | payload (fixed little-endian layout)
```

- Records are 8-byte aligned and never split across the end of the ring.
- `op 0` = WRAP: skip to the start of the ring.
- flags bit 0 = WANT_DONE: publish `done_seq` right after this record.
- An unknown op makes the executor set `error_seq`/`error_code` and stop.
- Op numbers are append-only, like `api_table.json`.

## Resources

Resources have u32 ids allocated by WAT. An id is never reused while it is
live.

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
| 6 | A8R8G8B8 |
| 7 | P8 |
| 8 | D16 |
| 9 | D24S8 |
| 10 | DXT1 |
| 11 | DXT3 |
| 12 | DXT5 |
| 13 | L8 |
| 14 | A8 |

Further formats are appended to this list. Codes 1–4 match the existing
native16 format codes in `lib/d3dim-gpu.js`.

## Opcodes

| op | name | payload |
|---|---|---|
| 1 | CREATE | u32 id, u8 kind, u8 fmt, u16 levels, u32 w, u32 h, u32 size |
| 2 | UPLOAD | u32 id, u16 level, u16 face, rect, u32 pitch, u32 src (inline or arena offset) |
| 3 | RELEASE | u32 id |
| 4 | SHADER | u32 id, u8 stage, u32 ir_bytes, IR (the `src/09af-d3d-shader-ir.wat` encoding) |
| 5 | LAYOUT | u32 id, u8 n, n × {u8 slot, u8 type, u8 usage, u8 index, u16 offset} |
| 10 | TARGETS | u32 color_rt, u32 depth_ds (0 = implicit backbuffer) |
| 11 | VIEWPORT | i32 x,y,w,h; f32 zmin,zmax; scissor rect; u8 scissor_on |
| 12 | RASTER | fixed 64-byte block: blend, alpha test, depth, stencil, cull, fill, colormask, fog. The whole block is sent each time, never only the changes. |
| 13 | BIND | n × {u8 slot, u32 texture id, u32 sampler id} |
| 14 | CONSTS | u8 stage, u16 first, u16 count, f32×4×count |
| 20 | DRAW | u8 prim, u32 vs, u32 ps, u32 layout, u32 vbuf, u32 voff, u32 stride, u32 ibuf (0 = none), u32 ioff, u32 count |
| 21 | DRAW_UP | same as DRAW, with the vertices inline or in the arena |
| 22 | CLEAR | u8 mask (color/z/stencil), u32 rgba, f32 z, u32 stencil, rect |
| 23 | COPY | u32 src, u32 dst, src rect, dst rect, u8 filter |
| 30 | FENCE | u32 slot: the executor writes the seq into the slot and notifies |
| 31 | READBACK | u32 rt, rect, u8 fmt, u32 arena dst, u32 slot: only for Lock, GetDC or an LFB read, never once per frame |
| 32 | PRESENT | u32 rt, u32 gamma_id (0 = none), rect, u32 surface: gamma runs on the GPU and nothing is read back |
| 33 | MARK | u32 frame, u32 tag |

## Upload arena

- Large data (textures and DRAW_UP vertices) is copied into the arena by
  WAT.
- `arena_tail` advances as `done_seq` passes the records that used the data.
- Static vertex and index buffers are uploaded once into their resource.
- Versioned zero-copy is a later optimization, added only if profiling says
  the copy costs.

## When the producer waits

| case | wait |
|---|---|
| Lock / GetDC / LFB read | READBACK, then wait on its slot |
| ring or arena full | wait on `done_seq` |
| Present | no wait; at most 2 PRESENTs in flight |
| query | FENCE plus a wait, only when the result is needed now |
| anything else | never |

## Executors

| executor | does |
|---|---|
| null | validates and counts records, and keeps a cheap pixel hash (tests, benchmarks) |
| webgl | prints IR as GLSL; shared `lib/gpu-backend.js` |
| software | interprets IR (replaces glide-software and d3d9-software) |
| webgpu | prints IR as WGSL (later) |
| C | Berrry's replayer, built from the generated header |

## One source of truth

The record layouts are declared once, on the WAT side. The JS decoder
(`lib/gpu-stream.generated.js`) and the C header are generated from those
declarations, and a build gate checks that they are fresh. Any new WATX
language feature this needs requires sign-off first.

## Tools

- `--gpu-stream-dump=FILE` writes the ring bytes, with MARKs.
- `tools/gpu-stream.js list|stats|replay FILE --executor=null|soft`.
- Golden tests replay a dump through the software and WebGL executors and
  compare pixels.

## Rollout

0. Write this spec, the generator, the ring, the null executor and the dump
   tool.
1. Glide.
2. D3D9.
3. D3DIM, after the D3D present rework lands.
4. OpenGL.

Every step gets a browser fps A/B and a pixel comparison against the commit
before the switch.
