# Original Deus Ex owning inspection and natural surface evidence

The repaired owning-instance inspector reached native readiness and the original
natural Draw/Unlock/return pair. The fresh host PNG was personally reviewed:
the game area is black. The first runtime failure was afterward, while exporting
the surface PNG: **`TypeError: Illegal invocation` at 09:19:40.042Z**.
The one browser closed normally at **09:19:40.090Z**. No second browser or
reload was attempted. Surface PNG review remains unavailable; this assignment
ends with the exact first failure and its tested offline helper repair.

I read the published `cb0c5fa1f`, `cbcfd14c1` and `c4ea72e5b` notes before
using the predecessor's `owner-inspect.cjs` and `next-driver-fixed.cjs`.
Evidence and runnable small helpers are retained in
`scratch/runs/20261104-deusex-owner-filter-natural/`.

## Natural execution and raw identities

Chrome/151.0.7922.108, PID 77813, ran **09:19:13.384Z–09:19:40.090Z**.
The actual original EXE was measured. Slot 0 / thread 1 was checked before
Engine module scanning; nonowners remain ineligible and owning mapping errors
remain fatal. At **09:19:20.899Z**, native `GIsRunning=1` and the visible,
source-bearing 640×480 HWND `0x10003` passed the unchanged readiness predicate.
The collector started at **09:19:21.017Z**, owning endpoint identity 1.

The single authorized `extended` observation requested exactly **10,000,000
blocks / 120,000 ms** and completed naturally after **1,121,609 blocks /
18,419.070000000298 ms**. Its frozen terminal is
`render-route-return-candidate-unverified-lifetime`, at saved caller
`0x1134426e`, ESP `0x179ff88c`, EBP `0x179ff8b0`, thread 1, yield 0, halt 1.
It records 393 events: all nine original checkpoints and **192 matching Render
ESP save/restore pairs**. Original signatures, module generations, ESP ownership,
terminal limits and frozen stop replies are verified by `analyze.cjs`.

All **nine raw `identityObservations`** survive in collector status, assessment,
collector stop and final stop. Every identity observation reports no diagnostic
errors and stable modules. Raw fields include Engine `0x103ef0a0`, viewport
`0x19309380`, Engine.Render `0x1046ee00` and player `0x10384600`.
Reciprocal UObject membership and unchanged class/slot bytes are boundary
observations, not allocation lifetime evidence. The legacy top-level null
identity fields were not substituted for or used to discard the raw records.
Lifetime and full viewport-to-host binding qualification remain **unknown**.

## Observed surface and actual page imports

The natural route is DirectDraw (viewport flags 9), not the DIB branch.
At natural Lock return and Unlock call the viewport pixel storage is WASM
**475574272**, 640×480, 16 bpp, stride 1280. Unlock ECX equals the viewport;
its original presentation argument is **1**, HWND/present HWND `0x10003`.
The locked back-surface candidate is DX slot 2 and its storage matches there.
After Unlock, slot 2 points to a different back buffer; that difference is
reported rather than called a renderer defect.

The page observer retained **13 actual import observations**, with no observer
errors or event-limit exhaustion. Its final sequence records:

| Serial | Actual import | Evidence |
| --- | --- | --- |
| 9 | `dx_trace(6,1,2,475574272,474935296)` | Native route's observed storage rotation |
| 10 | `dx_trace(5,1,16,475574272,0)` | Observed presentation trace |
| 11 | `gdi_surface_create(2097153,640,480,16,475574272,1280,1,0,0,63488,2016,31)` | Returns 1; actual canonical presentation storage updated |
| 12 | `gdi_surface_attach(2097153,65539)` | Returns 1; target HWND `0x10003` |
| 13 | `gdi_surface_upload(2097153,0,0,640,480)` | Returns 1; write sequence 36, version 6 |

After serial 13, presentation ID `0x200001` has `bitsWa=storageOffset=475574272`
in the actual shared guest memory, matching the natural Unlock source. Its
canvas identity 12 equals both the target window's attached back canvas and
DirectDraw owner canvas. The source canonical 614,400 bytes have **zero nonzero
bytes**. The derived RGBA cache has only 307,200 nonzero bytes (opaque black
alpha), consistent with the personally reviewed black host image. The ordinary
host flush count advances from 2 at upload to 3 at the read afterward; the
observer invokes no flush. The separate 648×488 GDI window surface is recorded
and is not the attached DirectDraw canvas.

These are actual storage/upload/target/canvas observations during the natural
interval. They do not supply a native publication EIP or an allocation serial,
and temporal association alone does not prove object lifetime or fully qualify
binding. No production publication mismatch is demonstrated. No speculative
renderer change was made.

## Exact failure and tested helper repair

The surface PNG helper borrowed
`HTMLCanvasElement.prototype.toDataURL.call(p.canvas, 'image/png')`.
The host surface factory in `lib/host-imports.js` preferentially creates an
**OffscreenCanvas**. The HTML encoder rejects that canvas brand, explaining the
recorded illegal invocation. This is a diagnostic helper defect, not proof
that the renderer failed to display nonblack pixels.

The repaired run-owned `page-observation.cjs` makes `png` asynchronous. It uses
`OffscreenCanvas.prototype.convertToBlob.call(canvas, {type:'image/png'})`
plus FileReader for an OffscreenCanvas, and the native HTML prototype encoder
only for an HTMLCanvasElement. Missing/mismatched HWND and stale attached
canvas return null; unsupported canvas brands and encoder failures remain
errors. Neither path invokes the instance's lazy encoder or a guest export,
flush, repaint, upload, input or memory write.

`next-driver-fixed.cjs` now writes the complete raw result **before** attempting
PNG export. The browser-tested namespace stays immutable. Only separate
`owner-filter-natural-offline-fix` inputs contain the repair.
`test-png-brand.cjs` reproduces the predecessor failure with strict modeled
brand checks and passes both corrected native-prototype routes, wrong HWND,
stale canvas, unsupported brand, native encoder rejection, and zero lazy flush
or guest writes. These are modeled encoders, not a second browser validation.
The full actual WASM/owning Worker/instruction/next-driver suite also passes
with the repair. A further full actual Worker driver regression injects an
encoder exception and checks that the raw result, final stop and browser
cleanup survive. Small helper patches and tests are retained in evidence.

Before Chrome, all **511 source/helper/module/media pins** matched. Actual
WASM/original EXE+Engine/Core/WinDrv/Render fixtures, owning Draw/ESP/native
Worker/full next driver, owner-filter positive/negative tests, raw correlation
and wrong storage/HWND/stale canvas controls passed. Actual Puppeteer 25.7.0
CJS/ESM imports, driver closure, generated region map, cache graph (98 page /
13 Worker scripts), all 144 served resource SHA/isolation/no-store checks,
selector negatives and unchanged readiness fixtures passed before launch.
The qualified manifest SHA is recorded in `prebrowser-pass.json`.

The locked full build passed after closure. This was an offline shared-main
build including another worker's D3D changes; its newly generated module was
never transferred to or used by this browser. No production or repository test
source was edited by this task. Only this note is committed; diagnostic helper
fixes/tests remain run-specific, with exact owned new-file patches.

## Capture, recovery and custody

I personally inspected `recovered/fresh-host.png`, **93,534 bytes**, SHA-256
`f12738a54f7f61a8784dade915f2e1a14457d0437b8427c0a3d1ca91859601cd`.
It shows Deus Ex Demo selected, original launch logs, and a black game area;
there is no visible gameplay claim. No fresh surface PNG exists because of the
first failure. No replacement surface image was reconstructed or mislabeled.

The closed browser namespace contains **82 artifacts / 5,340,377 bytes**,
recovered or matched to identical small local inputs with full SHA/size
verification, snapshot **09:19:53.476251Z**. Raw terminal recovery is exact from
`final-stop.json`, not a later native-PC substitute. The separate offline repair
has its own closed SHA manifest and checks. All original 511 pins remain
unchanged, Chrome/driver are absent, and HTTP 8123 is closed.

Git source provenance is `0b7318794f8dbf8dc5fdd552d30ab2e97b76480d`, relevant
binary diff, owned new helper/note patches and the final local artifact seal.
The actual retained WASM SHA-256 is
`129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52`.
Media and both retained module paths/full SHA are in
`retained-input-path-sha.json`; none were copied. No source archive was made.

**Handoff:** `bx_3k2ukgfj` is left RUNNING (API idle, healthy/hydrated), expiry
**2026-11-04T09:55:33.875Z**. Coordinator retains shutdown ownership and receives
custody. No lifecycle, allocation, source-box access, local heavy browser,
subworker, successor, Heroes II or deployment action occurred. The extended
profile has now been consumed once. Any further runtime validation of the
encoder repair requires a separately authorized fresh observation. This single
task stops after publication.
