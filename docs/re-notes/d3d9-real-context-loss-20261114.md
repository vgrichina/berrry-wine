# Public D3D9 context loss, 2026-11-14

Run: `scratch/runs/20261114-d3d9-real-context-loss/`.

The generated ordinary PE calls valid public D3D9 COM methods on two devices,
through an owning guest CPU Worker and production shared render Worker. The
test observes the actual production OffscreenCanvas contexts and invokes their
public `WEBGL_lose_context` extension. It waits for real lost/restored events.
There is no replacement GL, software fallback, forced Present or invalid buffer
selector in this execution. Chrome 151 was launched requesting ANGLE/SwiftShader;
the context reported ANGLE with Intel UHD Graphics 620 / Mesa 23.2.1. These are
recorded browser strings, with no physical GPU inference, original application
or broader 27-app coverage.

## Reproduced production defects

`browser-valid-control/result.json` records the pre-repair execution after two
fixture setup errors were corrected. In the persistent-loss row, LockRect
correctly failed without modifying its DIB or advancing the completed sequence.
After restoration, releasing that old endpoint produced GL error 1282
(`INVALID_OPERATION`): teardown tried deleting handles invalidated by loss.
In the restored-before-observer row, LockRect incorrectly returned S_OK instead
of `D3DERR_INVALIDCALL`, allowing invalidated resources to appear successful.

Earlier `browser/` and `browser-isolated/` runs document fixture errors: the
intercepted Worker response needed the dev server's isolation headers, and the
loss control needed to retain its extension object because getExtension returns
null during loss. Neither is attributed to production.

## Repair

The D3D9 backend latches the actual loss event for the device's lifetime.
Readback and Reset reject that lifetime after restoration. The production
render endpoint checks the latch before commands and completion fences. Device
destruction removes the event listener and passes invalidated-context teardown
to the existing GPU backend, clearing ownership without deleting stale handles.
An explicitly fresh endpoint is required for recovery; the old fault is kept.

## Runtime verification

Final verification passed in `verify-settled/result.json`: both public COM loss
races passed, with 168 independent exact interior pixel samples each (336 total;
edge/tie samples are intentionally excluded), and whole-frame peer equality.
Each failed readback submitted/consumed sequence 8 while completion stayed at 7;
all 256 DIB bytes and both LockRect output canaries remained unchanged. Old and
fresh context errors were zero, and both physical Worker retirement handshakes
completed. The browser regression
checks both loss races, original fault identity, unchanged completion prefix,
DIB and LockRect output canaries, failed Reset generation/endpoint preservation,
old-context GL error, fresh endpoint identity, independent exact pixel samples,
unchanged peer pixels, and public Release/Worker retirement. Labelled screenshots
visualize actual LockRect bytes, not a guest Present or application screenshot.
The existing D3DIM browser regression passed all six RGB565/32-bit queued,
synchronous and awaited cases (`d3dim.json`), separately checking retained pending
frames and dirty work through loss/restoration, fresh pixels, padding and cleanup.
Both locked full builds passed. Fixture controls reject missing/reversed geometry,
malformed PE input, wrong COM slots and conflicting fixture modes.

Two intermediate post-repair executions also exposed fixture timing assumptions:
the page resets its thread flag during startup, and the CPU checkpoint can arrive
before the final accepted render receipt. The final fixture requires actual
isolated Worker readiness before execution and awaits the existing queue's real
receipt fence before loss, publishing no extra command. No fallback run is
accepted. `settled-before.json` and `settled-after.json` match all 320 recorded
files, including the tested module SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.

Reproduce with the finite independent supervisor retained in the run directory.
It holds `/tmp/wine-heavy-runtime.lock`; full builds additionally hold
`/tmp/wine-build.lock`. Git plus the relevant binary diff/new-file patches and
served-source hashes identify the tested source; modules are regenerated, not
retained as binary dumps. No box is created: ID none, state NOT_CREATED,
expiry null, stop receipt N/A.
