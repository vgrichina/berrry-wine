# D3DIM GPU present

How a DX5-7 frame drawn by the WebGL executor (`lib/d3dim-gpu.js`) reaches the
screen without first being read back into the guest's DirectDraw DIB.

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

The DIB stays the truth for every surface, with one exception: **a primary
surface with a parked frame**.

A parked frame is the GPU-resident result of a `Blt(primary <- render target)`
that was shown from the GPU. While it is parked, the primary's DIB is stale. It
holds whatever was there before, and the parked colour resource holds the
pixels the guest asked for.

- WAT knows which surface is parked (`$D3DIM_LAZY_SHARED`, +20 = entry,
  +28 = its DIB address).
- The executor knows the resource: `D3DIMGpu.parked`, keyed by primary entry,
  with at most `PARKED_LIMIT` = 4 partial rects per primary. A rect wholly
  covered by a newer one is released, since nothing can observe it again.

## Present

**Eligibility.** `$d3dim_gpu_try_present` (src/09ab) runs at the top of the Blt
handler, before any fence. It answers 1 only when all of these hold:

- GPU present is on (`set_d3dim_gpu_present`) and the GPU executor is on;
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

**What it does.** It writes a 48-byte descriptor (magic `DXP3`: dst, src, dst
rect, src x/y, hwnd, CPU-present sequence, exclusive) and issues `0x2000A
PRESENT`. On success the Blt returns DD_OK with no CPU copy, no `dx_present`
and no fence.

**Worker mode** (`d3d-command-stream.js` record kind 4). The record is
submitted immediately and the guest does not wait for it. Step by step:

1. The render Worker's adapter (`d3dim-render-worker.js` `present`) calls
   `D3DIMGpu.present`.
2. `present` uploads any CPU writes to the back buffer (`_prepare`) and
   flushes batched draws.
3. It copies the rect into the parked resource.
4. It draws that resource through the gamma LUT into the target canvas's
   default framebuffer, at its top-left.
5. The adapter calls `transferToImageBitmap` and posts the frame on the
   endpoint as `{t:'frame', frame:{kind:'d3dim', bitmap, ...}}`.

On the page, `GuestThreadHost`'s legacy endpoint listener takes d3dim frames
out of the stream before they reach the guest Worker, and calls
`hostCtx.presentD3dimGpuFrame`.

If the executor cannot draw (context unavailable, target gone), the adapter
cannot decline: the guest has already returned. Instead it fences, row-copies
the rect into the primary DIB, and sends `{cpu:true}`. The page then presents
that DIB the ordinary way.

**In-page executor.** `call(PRESENT)` runs the same `present` and passes
`{canvas}` to `onPresent`. The executor's canvas is drawn synchronously, so the
page copies it in the same task. Without `onPresent` (the CLI), PRESENT answers
0 and WAT keeps the CPU Blt. Headless runs are therefore unchanged. The
`_sharedD3DIM` bridge (non-threaded page with the render Worker) answers 0 too.

**Page.** `_presentD3dimGpuFrame` (`lib/host-imports.js`) draws the frame into
a client-sized `kind:'gpu', api:'d3dim'` layer and sets it as the window's
`_dxFrameLayer`.

- It is the same frame-layer slot that DirectDraw and OpenGL already use, so
  the single back-canvas rule (docs/js-libraries.md) holds: no new drawing
  surface, and the renderer composites the layer at the client origin.
- A first frame, or one covering the client area, is drawn with `copy`; a
  partial rect is drawn over the previous one.
- It counts as a guest frame (`presentsTotal`).

**Staleness.** Every `$dx_present` bumps a CPU-present sequence (+24). A GPU
frame stamped with an older sequence is dropped on arrival, and a layer whose
sequence is no longer current is not composited (`layer.stale()`). A later DIB
present therefore always wins over a GPU frame, whichever order the messages
arrive in. The CPU path never reuses a d3dim layer.

`_presentBestDxOffscreen` (the "guess which surface is the screen" fallback)
does nothing while a frame is parked, because the primary's DIB is stale then.

## Gamma

`D3DIMGpu._gammaRamp` reads the process gamma ramp through
`gamma_ramp_wa`/`gamma_ramp_gen`. Those read shared memory, so they work on the
render instance too.

- An identity ramp, or none, gives `gamma = 0`: a plain copy.
- Otherwise the 256x1 RGBA LUT is uploaded once per generation and sampled at
  texel centres in the present shader.
- The parked resource itself is never gamma-corrected, so a CPU reader gets
  the pixels the guest drew, as with the CPU path. There, gamma was a page-side
  presentation effect too.

## Readback triggers (materialization)

A parked frame is written into its DIB, then released, by
`D3DIMGpu._materialize` (`readPixels` on the parked FBO followed by
`_writeBack`) whenever any of these happens:

| Trigger | Where |
|---|---|
| a ranged fence overlapping the parked DIB | `fence(address, length)` |
| any `$d3dim_surface_fence(entry)` on the parked entry: Blt/BltFast src or dst, Lock, SetSurfaceDesc | `$d3dim_gpu_unpark` (WAT) issues a ranged fence over the DIB |
| GetDC on it | 09a8 GetDC, after the worker fence |
| BltFast to or from it | 09a8 BltFast |
| a CPU `dx_present` of it | `$dx_present` start |
| final Release | `$dx_surface_release` |
| a GPU op preparing those bytes | `_prepare` overlap |
| the owning target resized or destroyed | `_target`, `fence` live check |
| more than `PARKED_LIMIT` rects | `_park` (oldest first) |
| another surface becoming parked | `$d3dim_gpu_try_present` |

The next Blt(primary <- back) re-parks the frame without materializing, because
the destination is overwritten.

A **global** fence (length 0, e.g. a draw-batch barrier or a Lock of some other
surface) does not materialize. Only readers of the primary's own bytes can see
them, and every such path goes through one of the triggers above.

## Fallbacks and switches

- **Kill switch.** `?no-d3dim-gpu-present` sets `window.WINE_D3DIM_GPU_PRESENT
  = false`. The host then calls `set_d3dim_gpu_present(0)` on the main instance
  and the guest Worker, and records it in `INHERITED_WASM_GLOBALS`, so threads
  inherit it. Every present then takes the old readback path.
- **Software D3DIM** (`?d3d-renderer=software`). `gpu_on` is 0, so the switch
  never fires.
- **Lost context.** `_checkReadback` throws on a lost context, exactly as for
  any readback. The parked pixels are lost with the context, which is also true
  of an unflushed render target. Presents after the loss decline (the executor
  is unavailable) or take the CPU frame path in the render Worker.
- **Cooperative threads** (`d3dim_gpu_cooperative_enable`). Not eligible.

## Known risks

- A guest that keeps a pointer from an earlier Lock of the primary, and reads
  it later without locking again, reads stale pixels. The CPU path had the same
  hazard after any later write, but there the pixels it read were at least the
  last frame.
- An app that alternates GPU and DIB presents every frame turns the layer
  stale and fresh in turn. It stays correct, since the newest wins, but repaint
  traffic goes up.
- Using the primary as a texture source (not seen in the corpus) goes through
  `_prepare`, and materializes.
