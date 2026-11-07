# MCM queued Flip: await readback without releasing ownership

Evidence: `scratch/runs/20261107-mcm-async-readback/`. This change addresses the
measured readback boundary: four original `readPixels` spans took
2,112.775–2,481.750 ms, versus 0.700–2.095 ms for three complete writebacks.
See `mcm-original-flip-spans-20261107.md`. No original game, boat or heavy
benchmark was run here; original performance and steering improvement are
unmeasured.

## Actual context selection and missing route

“Legacy WebGL” in the original note denotes the legacy D3DIM endpoint, **not
WebGL1**. The retained original `probe-live-identity.json` and
`review/race-settled-capture.json` under
`scratch/runs/20261107-mcm-original-flip-spans/` report
`WebGL 2.0 (OpenGL ES 3.0 Chromium)` on Intel UHD 620/ANGLE/Mesa.
The small `original-context.json` evidence pins those source receipts by SHA-256
and extracts their version fields without copying them.

Production routing is guest-worker shared `Encoder` → host process renderer
endpoint (`api: legacy`, `backend: webgl`) → D3DIM adapter → GPU `_target` →
`D3D9Backend.Device`. The adapter passes `options.webglVersion`; Device defaults
an unspecified version to `auto`, and `GpuBackend.WebGLBackend` tries `webgl2`
first in that mode, then falls back to WebGL1. Direct generic WebGLBackend
construction defaults to WebGL1; that is not this Device route. There is no new
context-selection flag or global async toggle.

Existing `asyncFlip` is opted in only for the in-page, same-instance executor
in `host.js`. It swaps DIBs immediately and owes presentation to a later fence.
Its `_completeInflight` calls `getBufferSubData` without polling or yielding.
Queued process-renderer Flip bypasses `_flip` entirely: replay calls the
adapter fence then `d3dim_worker_flip`. Merely enabling `asyncFlip` would not
repair that route or establish event-loop progress.

## Change and ownership

Single-endpoint queued Flip now awaits the adapter's `fenceFlip`. It flushes
pending draws, issues dirty WebGL2 target reads into operation-owned PBOs,
inserts/flushes syncs, and polls `clientWaitSync(sync, 0, 0)`. Timeout yields a
task with `setTimeout`, allowing the Worker event loop and driver completion
to progress. Collection happens only after a signaled result. Existing
`_writeBack` performs conversion, shadow update and page-watch capture into
the exact original DIB. Only then can replay swap DIBs, process the next
snapshot, publish COMPLETED and release scratch.

The process scheduler awaits the whole replay and retains the producer batch,
snapshot storage and WAT workspace throughout. It queues ordinary CPU fences,
endpoint replacement and teardown behind that operation. Ordinary CPU-visible
reads still use the existing synchronous range fence. An unexpected target,
device, DIB, size, pitch or liveness change rejects the readback without stale
writeback or Flip/COMPLETED. Wait failure also poisons the endpoint instead of
reporting success. Every allocated PBO and sync is released in `finally`.
The ordinary fence still performs texture retirement and clean-target checks.

WebGL1, an existing `_flip` readback, and multiple endpoints retain the
synchronous path. The multi-owner fallback and held cross-owner retirement
code/guards were not changed. This does not implement shared asynchronous
presentation ownership. The old in-page `asyncFlip` mechanism is unchanged.

## Regression and validation

`test/test-d3dim-async-readback.js` executes the actual process-owner message
scheduler, replay, adapter, GPU fence and writeback. Native exports and driver
completion are controlled. Before the patch it fails at “production queued
Flip must poll pending readback”; the failure is retained. With a pending
fence a real timer executes while DIB bytes remain untouched, COMPLETED stays
zero, Flip has not run, scratch has not reset, and the next snapshot has not
overwritten the first. After signaling, nonuniform bottom-up RGBA bytes land
as exact BGRA in the original DIB, the other DIB stays unchanged, the next
snapshot executes in order, the queued ordinary CPU fence succeeds, and only
then does queued teardown destroy the target. Batch/command counters and
exact single sync/PBO deletion are checked.

Dead-target, replaced-target, replaced-device, changed-DIB and failed-wait
controls reject without collection, stale bytes, Flip or COMPLETED. WebGL1
and two-owner controls use client-memory synchronous readback and allocate
no PBO. In-memory negative mutations removing the replay await or identity
rejection fail on early COMPLETED, demonstrating that the assertions detect
those ownership regressions. They do not modify production files.

Focused existing async-Flip, GPU batching, cooperative routing, draw trace,
render-wait scheduler, parked batches, native render lifetime and shared D3D9
renderer tests pass. Test-tier membership and owned-file whitespace pass.
`flock /tmp/wine-build.lock bash tools/build.sh` passes; a one-second disk
monitor during the build recorded minimum free `/home` 3,674,021,888 bytes.
Other task checks were immediately preceded/followed by disk samples above
2 GB; no continuous whole-task disk claim is made.

A tiny local Chrome 151 SwiftShader smoke uses the real GPU `_target` and
Device auto-selection, clears a 2×2 target, awaits production `fenceFlip`, and
checks all four BGRA pixels `[128,0,255,255]`, actual WebGL2 and GL error zero.
It observes eight timeout polls, nine total polls and a timer executing before
completion. This confirms real WebGL API use and bytes on that local driver;
the controlled scheduler regression establishes pending ownership/order.
Neither test measures the original Intel GPU's stall reduction.

Git SHA, relevant tracked binary diff and new-file patches, module hashes,
commands, failures and results are retained in the run directory. Git remains
the source archive; no source/media archives were created. No test box was
assigned or manipulated: box ID/state/expiry none. Next is the separately
scheduled original gameplay run with the tested repair and existing exact
identity/input controls; this bounded repair task ends after main publication.
The global evidence check reports the existing Alice dialogue artifact path
outside its own run directory; it reports no error for this run. No game
candidate capture/result is added by these implementation tests.
