# TR2 native full-facade follow-up — 2026-11-08

The one fresh original run of published `4003f6502` still produced zero
qualified canonical/DX display joins. It exposed a new integration branch:
the native decoder prepared an unused GDI backing canvas, whose valid native
client rectangle caused host scratch writes **before** decoding the source.
That generic branch is now repaired and regression-tested. No original run
of this new repair, movement, weapon consequence or FPS result is claimed.

Evidence: `scratch/runs/20261108-tr2-full-facade-native/`.

## Exact original and newly observed cause

Runtime source was published main
`0cfbac6573533c93bb24660dc359909a6e69a928`, excluding peer WIP. The 615-file
closure included byte-identical published `lib/render-worker.js` from
`4003f6502`, menu metadata WAT from `f4fc82774`, host queries from `9c93a0f13`,
and ancestor `2483eec51` post-fence repair. Actual CDP-retrieved CPU and owning
render-worker modules matched
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
The owning endpoint used actual WebGL2, reporting Intel UHD 620 through ANGLE.
This original validates that module's execution, not successful publication.

The blank-page native preflight delivered six ordinary 500 ms holds with
independent UP and trusted balanced events. Personally reviewed Graphics
Hardware/Full Screen/640x480 High Color/OK admission was 8443 ms old; Enter
released independently after 500 ms. The actual world was visible. Observation
armed the existing bounded 4096-record journal; pre-arm raw remains null.
Final retirement accounted for **534 raw = 0 qualified + 534 discarded**:
241 source-version-overwritten, 292 coalesced-before-publication, one normal
shutdown retirement. Every source sealed under a sole stable unpoisoned
writer from beforeSwap through sealExit. No GDI substitute was counted.

`native-all-writers.json` retains passive production logpoint stacks:
`_presentNow -> _presentDxIfDirty -> presentBestDxOffscreen ->
_presentDxSurfaceToMainWindow -> getWindowCanvas -> _computeClientRect ->
wnd_client_screen_x/y -> get_window_rect`. These observed native geometry
exports and nested real host callbacks advance host versions before
`beginRead/find/cacheDxLayer`; the actual layer had no version token or proof.
Logpoints were removed after bounded observation. They invoked no guest
handler and changed no guest state, clocks, seed, configuration or scene.

The earlier full-facade fixture had no nonempty WAT client rectangle. It
therefore skipped this decoder-time geometry branch, even though it covered
the later compositor geometry writes. The new fixture registers an actual
native HWND and fills its native client rectangle through the generated
region map. Exact published host-imports SHA-256
`e1316adcc71654a6182f25e04316fd1fb5c8142361ae3f722eae32d94b71d5e7`
reproduces pre-decode host version 0→4 and qualified0. The unchanged production
dispatcher, WAT swap/page watches, observed facade, real scratch host,
RGB565 decoder, canvas transfers and compositor run in both comparisons.

## Generic production repair and tests

Exclusive DX layers now prepare their own canvas directly. They defer
`getWindowCanvas` until a GDI fallback actually needs it. The unused GDI
preparation no longer invalidates the source before decoding. Windowed client
clipping keeps its existing preparation; failed layer allocation still obtains
the GDI canvas. Native geometry exports and callbacks retain conservative
writer observation. No getter classification or publication guard changed.

`native-client-rect.json` records fixed qualified1 with an actual red display
pixel, plus a live-writer refusal and all 29 guards under **nonempty native
client metadata**. The compositor still performs four real rectangle-scratch
callbacks after decode; exact composition-local token admission from
`4003f6502` remains necessary. Owner, request, pages, host freshness at read,
poison, live writers, layer/canvas/token, transfer and unsupported-scene
refusals remain intact. `exact-baseline.cjs` reloads the exact preceding Git
host-imports blob and retains the expected qualified0 assertion failure.

Focused native-client regression, window-placement and browser Worker upload
ordering checks pass. `flock /tmp/wine-build.lock bash tools/build.sh` passes
(`build.log`); both module hashes remain unchanged. The previously accepted
full-facade baseline0/fixed1/red/29 guards, seven focused tests and locked build
were reused by hash, without standalone reruns. 190 retained references,
78 explicitly recovered retrieval paths and 23 existing media providers were
independently reverified in `accepted-controls-reused.json`.

## Lifecycle, retained failures and recovery

A detached independent 25-minute watchdog was observably armed before the
UUID-idempotent single box creation. Overall/browser/cleanup deadlines were
immutable. The accepted parent startup queue, subreaper and WNOHANG reaper
were reused: remote `/tmp/wine-runtime.lock` held before provisioning and
through launch, runtime and descendant drain. No local runtime lock was held
for remote work; focused local execution released its lock before analysis.

The initial extra syntax pass treated ES modules as CommonJS. Its shell
continued through allocation after that failure, so the final corrected
615-file closure check occurred **after allocation**, before provisioning or
runtime. This violates the requested before-allocation ordering and is
retained explicitly; it is not reported as a fully closed admission gate.
The earlier 607-file source/media/helper checks had passed before allocation.

An observation command omitted `waitMs` and failed in the transport's budget
check before ID creation/queue/dispatch. A new explicitly bounded observation
was then submitted. The final capture response was truncated and remains
sticky UNKNOWN in the local transport history: no capture or input was
replayed, and the next command was normal shutdown only. Its unique artifacts
and remote ACK were later recovered separately; this does not erase the
earlier UNKNOWN. The first drain correctly refused the still-live Node
controller; later settled drain passed. An initial audit incorrectly required
beforeFence to equal post-fence state; its failure is retained. The corrected
audit checks the actual beforeSwap/sealEntry/sealExit contract.

Before normal box shutdown, 95 unique artifact references (168302266 bytes)
were retrieved and independently hash-reread, including five CRC-validated
PNGs, exact modules, raw journals, command ACKs and custody histories. All 28
registered native PID/start identities, including adopted Chrome descendants,
were absent/reaped; bootstrap and custodian were absent; ports, endpoint,
profile, writers and held input were drained. Read-only remote helpers were
parent-awaited and their structured exit receipts retained. Local normal and
watchdog children exited zero; the owning supervisor ended with no children.
`final-audit.json` records the independent checks.

New box `bx_2b52t3h9` is **archived**, expiry null. Normal stop
`stop_734c8dd2681a7a69` completed at **12:30:50.932 UTC**, forced=false,
error=null. No box resume/delete, public deployment, second original or
subworker occurred. Inherited boxes were untouched. Launch free disk exceeded
5 GB.

Recovery uses `source-head.txt`, `runtime-pins.json`, `final-relevant.diff`,
small owned-file patches, exact baseline Git loader and existing media
path/hash references. Git is the source archive; no source/media archive was
created. The next authorized original must test this new pre-decoder repair
and actual qualified DX joins before any reviewed Up/Space/Control. Other
remaining causes, Full27, parity, audio and game/simulation FPS stay open.
