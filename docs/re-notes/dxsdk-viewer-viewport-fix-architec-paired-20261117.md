# Non-resizing inspection, software Viewer and ARCHITEC, 2026-11-17

Run: `scratch/runs/20261117-dxsdk-viewer-viewport-fix-architec-paired/`.
Inspector fix published on main: `ae10d9c42` (strict pull/push succeeded).

| Fresh original | Reviewed whole-frame result | Natural motion |
|---|---|---|
| Viewer/software | Supplied Microsoft model, readable front view then edge-on view | PASS, 17,397 changed client pixels, no input |
| ARCHITEC/software | Textured architectural structure with moving green mechanism | PASS, 90,809 changed scene pixels, no input |
| ARCHITEC/WebGL | Attachment guard refused changing backing/presentation geometry before captures | UNPROVED; closed failed scope, no replay |

## Inspector correction and preparation

`tools/inspection-window.cjs` connects Puppeteer with `defaultViewport:null`.
It reads viewport/DPR/scroll, canvas backing dimensions and client rectangles,
native window/client geometry, native HWND generation, process and endpoint
identities. Whole lossless PNG capture uses `fullPage:false` and
`captureBeyondViewport:false`, with no clip, viewport change or window resize.
It refuses a changed baseline, changed geometry/ownership around capture, and
an incomplete image extent. The runner records its baseline before attaching
the second inspector and checks attachment and disconnect against that baseline.

Focused positive/refusal tests pass. A real authored native window passes
attachment, reading, whole capture and disconnect with unchanged geometry and
generation. Its native `GetPixel PASS 0xcc4433` oracle agrees with 285,671
pixels in the reviewed whole 1280×960 PNG. The locked canonical build passes
(2,408,676-byte module; no data overlap). This shared-tree build is distinct
from the published module used for originals; relevant foreign diffs are
retained without adopting them into original runs.

## Exact original graph and execution evidence

All three fresh originals use Git
`3ab982f2d53a2beb354afe06ed3887860b716ad6` and the existing module SHA-256
`06eaa397b64a453ca830b39dad70d63e409bd2f3d2d6bd586687eb0bef541023`.
The inspector is separately pinned to its published helper commit. Source,
passive observer suffixes, actual page/guest/render-worker module bytes,
HTTP response hashes, and unchanged registered executable/model/scene/texture
media are verified. Media stays at existing paths; no scene asset is modified.

Native `d3drm.dll` loading, EXE import patching and native DirectDraw calls are
retained in console receipts. Successful originals retain the actual
`d3dim-gps` software endpoint and completed `GpuStreamSoftware` records:
Viewer DRAW_UP 123→358, PRESENT 60→177; ARCHITEC DRAW_UP 322→697,
PRESENT 11→26. These are execution counts, not FPS. Existing exact Device2
literal pixels and ownership/refusal controls on both backends are reused
with verified hashes. Direct per-call Device2 logging was not produced by
these originals; reused controls are not relabeled as original call traces.

The earlier hidden-overlapped creation repair, native counterexample and
negatives, locked build, Globe/software+WebGL motion and Viewer/WebGL motion
proofs are reused by exact hashes. None of those closed originals is rerun.

## Final WebGL boundary and lifecycle

The final ARCHITEC/WebGL original passed native window/device readiness, then
the pre-capture attachment comparison failed. Its diff preserves viewport
1280×960/DPR 1 while `screen` backing changes from 1280×960 to 640×480;
the presentation becomes 1280×926 at y=34 and cursor backing also changes.
The guard correctly refuses to certify unchanged geometry. The evidence
does not distinguish an ordinary startup presentation transition from an
observer effect. There is no paired image, completed-executor capture, or
new public API/render defect proof for this case. No later endpoint query,
rebind, replay or fourth original is performed.

All four scopes, including the authored window, have prearmed independent
watchdogs, native waits and both EOFs, awaited Chromium shutdown, watchdog
waits/EOF, durable enclosing command/watchdog waits/EOF and adopted-helper
wait receipts. Successful scopes exit 0; the guard-refused WebGL scope exits
1. Known scoped PIDs and listeners are absent. Browser shutdown is not a
guest File/Quit claim. No boxes were created: ID null, NOT_CREATED, expiry
null, stop receipt N/A. Home remains above 1.5 GB; no RAM gate.

Only five selected whole PNGs remain: one authored oracle and two for each
successful original. `result.json` is written last with exact Git/diffs,
source/module/media references and artifact hashes. No source archive,
media copy, frame series, worker, box, deployment or held-investigation read
is used; foreign WIP/NFS/LMarbles/LTris is preserved.

Next: establish a stable, ordinarily settled pre-attachment baseline on an
authored transitioning presentation before any newly authorized ARCHITEC/WebGL
original. This task stops with that concrete observation blocker. No full27,
backend parity, FPS or audio claim.
