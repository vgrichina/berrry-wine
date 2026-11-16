# D3DIM GPU present

How a DX5-7 frame drawn on the GPU reaches the screen without first being read
back into the guest's DirectDraw DIB.

Since GPU stream v2 slice D2 the D3DIM GPU path is the WAT producer
`src/09abg-d3dim-gps.wat`. It writes the shared v2 ring (docs/gpu-stream-v2.md),
which an executor drains: WebGL in a browser, `lib/gpu-stream-software.js`
headless. The old JS WebGL executor `lib/d3dim-gpu.js` (D3DIMGpu, its DXP3
record kind 4 in `d3d-command-stream.js`, `PARKED_LIMIT`, `_materialize`,
`_gammaRamp`) was deleted in D2c. `lib/d3dim-render-worker.js` remains, but
only as the software render Worker adapter.

## Why

UT348 on D3DDrv, windowed, Threads mode, ran at 13-16 fps against 31 on its
OpenGL renderer. Its present is `Blt(primary <- back)`, not Flip, and each one
was a full synchronous readback:

- `$d3dim_surface_fence` on the source fenced the render Worker;
- `readPixels` there was ~10% of the profile and `_writeBack` 4%;
- the guest waited for it in `Encoder._waitFor`, 23%;
- the CPU Blt copied the DIB into the primary;
- `dx_present` handed the primary to the page, which converted it
  (`_presentDxSurfaceToMainWindow`, 16%) and applied the gamma ramp on the CPU
  (`applyGamma`, 15%).

None of those pixels was ever read by the guest. They existed only to be shown.

## Pixel ownership

The DIB stays the truth for every surface except two:

- a GPU render target with draws not yet read back (target flag 1, dirty);
- **a primary surface with a parked frame**.

A parked frame is the GPU-resident result of a `Blt(primary <- render target)`
that was shown from the GPU. While it is parked, the primary's DIB is stale. It
holds whatever was there before, and the park slots hold the pixels the guest
asked for.

The producer block (`$D3DIM_GPS` +8) records:

- the parked primary at +164..+188 (DIB, pitch, bpp, format, height, parked,
  entry);
- four park slots of 32 bytes at 23040 (`$d3g_slot`), each a primary rect with
  its own RT. With all four parked, the two oldest are merged
  (`$d3g_park_merge`) or the oldest lands. A rect wholly covered by a newer one
  is superseded.

## Present

**Eligibility.** `$d3dim_gpu_try_present` (src/09ab) runs at the top of the Blt
handler, before any fence. It answers 1 only when all of these hold:

- GPU present is on (`set_d3dim_gpu_present`) and the GPU stream is on
  (`$d3dim_gpu_on`);
- the instance is not cooperative;
- the source is the last GPU render target (`$d3dim_gpu_last_rt`, set by an
  accepted GPU draw or clear);
- the destination is the primary, and is not the scroll-hold surface;
- both surfaces have the same bpp (16/32) and the same format;
- the Blt flags are only WAIT/ASYNC/DONOTWAIT;
- the clipper is either absent or an hwnd clipper;
- the window is top-level, not shared with GDI children, and not a d3d9
  client-relative window;
- the rects are the same size and in bounds.

**What it does.** It writes a 48-byte DXP3 descriptor (dst, src, dst rect, src
x/y, hwnd, CPU-present sequence, exclusive) and calls 0x2000A through
`$d3dim_gpu_call`. That call goes only to the producer (`$d3g_blt_present`),
never to the host. The producer:

1. copies the rect into its park slot's RT;
2. emits PRESENT with that RT, the client-relative `dst_x/dst_y`, the gamma
   LUT id and the CPU-present stamp;
3. kicks the ring asynchronously.

On success the Blt returns DD_OK with no CPU copy, no `dx_present` and no
fence. A Flip on the GPU (`0x20003`) swaps the chain's DIBs, lets the colour
targets follow them, and PRESENTs the new front, again with no readback.

**Page.** The executor's PRESENT goes to the page's Presenter as a
`kind:'gpu', api:'d3dim'` frame layer: the same `_dxFrameLayer` slot that
DirectDraw and OpenGL use, so the single back-canvas rule
(docs/js-libraries.md) holds.

**Staleness.** Every `$dx_present` bumps a CPU-present sequence
(`$D3DIM_LAZY_SHARED` +24), and PRESENT carries it as its stamp. A GPU frame
whose stamp is older is dropped, so a later DIB present always wins over a GPU
frame, whichever order they arrive in.

`_presentBestDxOffscreen` (the "guess which surface is the screen" fallback)
does nothing while a frame is parked, because the primary's DIB is stale then.

## Gamma

`$d3g_gamma` uploads the process gamma ramp as a 256x1 lookup texture once per
gamma generation. An identity ramp, or none, gives LUT id 0: a plain copy. The
parked pixels are never gamma-corrected, so a CPU reader gets the pixels the
guest drew.

## Readback triggers (materialization)

A parked frame lands in its DIB (`$d3g_materialize`: one READBACK per parked
rect, oldest first) only when a CPU reader of the primary's bytes asks. Every
readback is charged to a site (`d3dim_gps_stat` 16 + site, printed by
`test/run.js --d3dim-gpu` as `[d3dim-gps] readback sites`):

- GetDC (1);
- Blt/BltFast GPU source (2) or destination (3);
- Lock (4), or lazy Lock first touch (14);
- final Release (7);
- CPU present (8);
- the parked frame of another primary (9);
- a target re-create (12);
- host capture (13).

The next Blt(primary <- back) re-parks the frame without materializing, because
the destination is overwritten. A global fence (length 0) does not materialize.

Draws and clears the producer declines go to the WAT software rasterizer, which
first reads the target back (site 6, `swDraw`). The reason for each decline is
counted (`d3dim_gps_stat` 35 + reason, printed as `[d3dim-gps] decline
reasons`):

| Reason | Index |
|---|---|
| texture not uploadable | 1 |
| Z function out of range | 2 |
| blend factor out of range | 3 |
| no depth surface | 4 |
| clear target not creatable | 5 |
| clear background without texture words | 6 |

Stage-0 operands follow the software rasterizer's rule
(`$d3dim_stage_operation`): ARG1 is diffuse for DIFFUSE/CURRENT and the
texture otherwise, and ARG2 is the texture only for TEXTURE. So TFACTOR,
SPECULAR or a modified selector reads the same operand on either path and no
longer declines (index 0 is unused since D2c).

## Switches

| Switch | Effect |
|---|---|
| `--d3dim-gpu` (CLI) | The WAT producer, through `lib/d3dim-host.js`. Without it the CLI uses the software rasterizer. |
| `?d3d-renderer=software` or `?d3dim-gpu=0` (page) | `gpu_on` stays 0: the software render Worker (`lib/d3dim-render-worker.js`) or the in-instance rasterizer. No present switch can fire. |
| `?no-d3dim-gpu-present` (page) | Sets `window.WINE_D3DIM_GPU_PRESENT = false`. The host then calls `set_d3dim_gpu_present(0)` on the main instance and the guest Worker, and records it in `INHERITED_WASM_GLOBALS` so threads inherit it. Every Blt present then takes the CPU path: a readback, then `dx_present`. Draws stay on the GPU. |
| `?no-lazy-sync` (page) | Turns off lazy Lock: a Lock of a GPU-owned surface reads back eagerly instead of arming the range. |

Cooperative threads (`d3dim_gpu_cooperative_enable`) are not eligible for the
Blt present.

## Known risks

- A guest that keeps a pointer from an earlier Lock of the primary, and reads
  it later without locking again, reads stale pixels. The CPU path had the same
  hazard after any later write, but there the pixels it read were at least the
  last frame.
- An app that alternates GPU and DIB presents every frame turns the layer
  stale and fresh in turn. It stays correct, since the newest wins, but repaint
  traffic goes up.
