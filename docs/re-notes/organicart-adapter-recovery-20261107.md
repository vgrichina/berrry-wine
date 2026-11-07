# OrganicArt browser adapter recovery, November 7

The ordinary-browser prerequisite is recovered. Current-main OrganicArt
reproduces the lower-right white rectangle on both confirmed software and
WebGL routes. New native observations corroborate the documented missing logo
input; no emulator rendering defect or justified production repair was found.
The remaining dependency is authentic Plus! 98 installation metadata/assets
matching this package, as described in [organic-art-screensavers.md](organic-art-screensavers.md).

Evidence: `scratch/runs/20261107-organicart-adapter-recovery/`. This task began
at 05:04 UTC and finished within its 35-minute bound. No guest configuration,
registry override, logo substitute, guest binary, scene asset, crop or hide
workaround was introduced. No unknown input was replayed and no held access
operation was retried. No agents or workers were launched.

## Adapter and route verification

The predecessor required `tools/web-input-probe.js` as a module, suppressing
its guarded `main()`. The new run-local driver spawns the real CLI script with
`node --require instrument.cjs tools/web-input-probe.js ...`, preserves its
terminal status and records browser launch, close, PID and responses. The
production CLI API is unchanged.

Prerequisite checks caught and repaired another run-local issue: Puppeteer's
module export did not accept direct replacement of `launch`. The preload now
returns a module proxy with the wrapped launch function. A malformed viewport
returns nonzero; a deliberately nonexistent app then verifies real CLI main
entry, browser launch, meaningful nonzero failure and normal browser close
without launching a guest. An instrumented real Chrome smoke page and its
capture passed before the original. Earlier failed checks are preserved.

The first original launch, directory `software/`, actually used WebGL because
page initialization overwrote the preload's flag. Its actual GPU counters
exposed the mistake; it is excluded from the software results. After that
browser closed normally, the confirmed sequence used the supported
`d3d-renderer=software` and `d3d-renderer=webgl` URL parameters, serially.
Both ordinary registered launches used the unchanged `/s` arguments and exited
zero. Their full commands and close receipts are retained.

The first two preliminary layer snapshots also exposed an OffscreenCanvas
readout error. The run-local helper was repaired to use `convertToBlob()` for
an existing OffscreenCanvas, with no guest or renderer change. Subsequent
snapshots succeeded. Small adapter versions, hashes and patches are retained;
these setup defects are not guest failures.

## Current original observations

Eight inspected 640×480 scene layers, four per confirmed route, all contain
exactly 3,060 white pixels in `[550,434,640,468)`. Software shows animated pink
rings, then dense green/red procedural forms. WebGL shows a rotating colored
polyhedron, then growing yellow forms against a purple backdrop. Full-page
captures also place the rectangle inside the actual scene, separate from the
debug toolbar and log. An initial visual impression that software capture 4
lacked the rectangle was wrong; pixel analysis and the full-page capture
confirm it remains present. Natural disappearance is supported by the older
October 31 evidence, not newly demonstrated here.

Both routes identify `scr_oasaver`, process 1000, owning window 65537 titled
`Screen Saver`, with the actual displayed 640×480 DirectDraw layer. Surface
slots change during scene transitions. Device target slots include software
26 and WebGL 6 then 28; these are not a universal fixed-slot convention. This
avoids confusing historical scene slot 6 with blank primary slot 38.

The fresh native observations on both routes record:

- `reg_query_value("DisableCALogo")`, `HideLogoAfter`, and `CALogo` return 2
  (`ERROR_FILE_NOT_FOUND`).
- `fs_search_path(path=".;.\\", filename="CALogo.gif")` returns 0.
- Software small-draw traces contain six white vertices (`0xffffffff`) at
  x=550/595/640 and y=434/468: the exact rectangle's bounds. These are native
  guest draw submissions observed through existing trace imports.

The confirmed software route has no GPU object and records 3,687 software
immediate draws plus 25,706 execute-triangle trace events by its final
snapshot. WebGL's final snapshot records 1,841 draws, 1,451 draw calls, 70,108
triangles, 390 clears, 390 texture clears, four declined clears, zero fallbacks
and zero GPU errors. These are diagnostic counters, not FPS measurements.

Focused diagnostics retain full 640×480 device viewport state and clip
normalization words, DirectDraw Blt/present/flip boundaries, software vertex
coordinates and bounded GPU clear packets. All retained GPU clear rectangles
are `[0,0,640,480]`; no retained clear packet selects the logo rectangle.
The rectangle is already in the displayed layer, and software explicitly
submits white geometry at those bounds. These observations support the native
logo path rather than an invented clear/viewport/presentation repair. Traces
retain only the first 24 events per kind and first 48 GPU clear packets;
boundary snapshots do not prove completed writes or exclude every unrelated
renderer defect. Captures are natural asynchronous observations, not matched
frames across routes.

Combined with the earlier native logo-disable/substitute-image experiments,
this corroborates the missing authentic input explanation. Those guest-changing
experiments were not repeated. The current registered fixture is complete as
registered, but it does not supply `CALogo.gif` or source-verified installation
defaults. The intended authentic logo appearance remains unverified.

## Provenance and closeout

Source pin: main `a03f99823b79dd69ed6f96aa3f106ea96fcbccd8`, exact source-file
hashes, relevant binary diff and the existing untracked `lib/wininit-boot.js`
patch. Its relevant source hashes equal the predecessor's `59e41298a` pin.
The locked build passed. All confirmed captures identify actually loaded WASM
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes), retained and verified. This differs from the historical
October 30 module `d83e413f…`, whose source-fix reference is `de2e338c4` and
whose complete compiled-source identity remains unknown. Neither the older
`8b227b5c` single absent-box capture nor this result establishes a renderer fix.

All 85 registered executable/scene inputs and DLL pins match the predecessor.
All 1,161 staged pins were checked before execution and again after, with only
explicitly recorded owned adapter revisions excepted. The original executable
is `470e28bc…`, Microsoft D3DRM is `fd80f383…`, and D3DXOF is `1f2d0683…`;
full hashes are in the manifests. The actual Chrome executable is pinned as
`22e4d5ef…`, version 151.0.7922.108, using cooperative guest execution and
ANGLE SwiftShader for WebGL. The installed dependency manifest has 2,306 pins.
All 857 captured successful response bodies across the three original launches
match staged runtime/fixture hashes, with no unknown successful body or hash
mismatch. Some response bodies could not be obtained by CDP, including the
software D3DRM request; its successful native load is logged and its served
file is pinned unchanged before/after. Do not read the body-observer gaps as
verified response hashes. Optional UI/build/API-table endpoints return 404,
and initial same-directory D3DXOF probes return 404 before successful loading
from the pinned DLL directory. These limitations are preserved in the logs.

All 117 recovered remote artifacts (12,691,269 bytes) passed SHA-256 and size
verification before normal shutdown. No source tree/media archive was made.
The fresh box `bx_c83kuyt5` used a persisted UUID Idempotency-Key, original
expiry 05:40:57.897 UTC. Explicitly delegated normal stop was requested once
at 05:15:48.518 UTC with `forced:false`; it completed at 05:15:52.516 UTC.
Final state is **archived**, with no active expiry. The predecessor box was
never reused or resumed. All eight recorded browser/controller PIDs, five
recorded profiles and owned runtime processes are absent; the four recorded
HTTP ports have no listeners. The local messageboard watcher is also closed.
Free `/home` remained above 2 GB at recorded checks.

Only this note is committed; run-local repairs and evidence remain in the run
folder. `result.json` is written last after evidence verification and closeout.
Next work requires authentic matching installation metadata/logo input, not a
speculative rendering change. No full-scene parity, FPS or historical27 claim.
