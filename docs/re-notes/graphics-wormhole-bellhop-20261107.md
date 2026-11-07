# Registered Wormhole and Bellhop browser coverage, 7 November 2026

Run `20261107-graphics-wormhole-bellhop` stops with a demonstrated **harness
qualification blocker**, discovered during final transitive-import review.
The copied transport requests an absent `ordinary-keys.cjs`. Broad
`assert.rejects` checks falsely accepted `MODULE_NOT_FOUND` as the expected
UNKNOWN/subsequent-request rejection. The required pre-original transport
qualification was not completed; the originals should not have been admitted.
There are **zero task-qualified acceptance cases**. Eight named supplemental
bounded startup observations are preserved for original registered
`dx_wormhole` and `dx_bellhop`: software
and WebGL selector settings, each with cooperative and guest Worker execution.
The observations are bounded to the actual scenes captured. Wormhole displays
its yellow-green wire tunnel through DirectDraw. Bellhop displays its GDI
“Choose A Connection” dialog, an empty list and disabled Join buttons. These
are not evidence of an active D3D backend or connected Bellhop gameplay.
All eight observations end with the original still running and no recorded
escaped trap, page error or unimplemented-API fault. No emulator code changed.

The tested source is main commit
`e8ac0c49f646d2889a80e81ac5336ada2c667a92` plus the run's
`dirty-source.patch` and `new-source.patch`. The standard module is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
the compatibility module is
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
Locked local and fresh-box builds pass and produce identical modules. Git and
the recorded patches supply source recovery; no source/media archive is made.
Existing concurrent changes are recovery inputs, not repairs by this worker.

Both unchanged app registrations use the complete shared `dxSdkBinFiles`
manifest. There are 39 unique input paths totaling 5,095,889 bytes, including
both original EXEs and all 37 shared files. `registered-pins.json` retains
the registrations, paths, sizes and SHA-256 values. The shared SDK mesh aliases
retain their previously documented provenance; this run does not relabel them
as original Viewer assets. Import detection identifies DirectDraw for Wormhole
and GDI/OLE/common controls for Bellhop. Bellhop's log explicitly reports that
`ole32.dll` is unavailable as a physical DLL and its imports use built-in
handlers. This is retained as a runtime observation, not hidden by an asset
replacement or characterized as a new semantics defect.

The October 31 Wormhole result, `20261031T0240Z-dx-more-startups`, remains a
cooperative CLI software startup observation with unknown compiled-source
identity. It does not qualify the present browser cases. Globe, Viewer,
Flip3DTL and savers were not launched here.

Before any original, actual Chromium controls exercised nine replacements
(app, process, endpoint, guest Worker, module, document epoch, page renderer,
canvas and render Worker), stale/slow captures and partial native delivery.
The independent release check records an approximately 80 ms native hold
ending before its 250 ms passive reader returns. Trusted down/up pairs and
empty physical/renderer key state pass. These generated fixtures are separate
from original-scene evidence. No native input was needed for the originals.
The generated `controls.json` reports a pass, but its transport rejection
conclusion is invalid. Its UNKNOWN, late-acknowledgement and subsequent-request
assertions accept any exception. The required transitive import is absent
from both the staged run helpers and its runtime pin set. Those requests fail
before acquiring a writer lock, publishing a numbered command or establishing
a sticky transport closure. This does not prove their intended rejection.
Actual native partial delivery/release is observed, but the later request's
rejection reason is likewise not qualified.

`helper-closure-blocker.json` reproduces the exact missing import locally,
without a browser or dispatch: `MODULE_NOT_FOUND`, zero commands, no writer
lock and no `transport-closed.json`. The local reproduction only diagnoses
the earlier invalid prerequisite; it does not qualify already executed
originals. No second box, original replay or stopped-box resume was used.

Each original uses one browser at a time on one fresh UUID-idempotent box,
`bx_24t85jnv`, with `defaultViewport:null`. Browser window size is requested
as 1100×820; the actual captured viewport is 1100×733 at device scale 1.
The initial full frame is personally reviewed before the driver proceeds;
two subsequent settled full frames are separated by at least 15 seconds.
The filenames `scene-5s`, `scene-20s`, `scene-35s` are nominal labels: the
initial review gate adds wall time. JSON timestamps supply actual timing.
Counters are sampled before screenshots while execution continues; they are
not frame-aligned measurements or FPS. No guest state, clocks or callbacks
are changed.

The box's BetterChromium launcher forces ANGLE SwiftShader and has no
`/dev/dri`; this environment is not evidence of a physical GPU. Per-case
module receipts, renderer objects, guest endpoint identity, execution
counters and visible scenes determine the actual route. A WebGL selector
alone does not establish WebGL draw execution.

| Original | Requested selector | Execution | Owning host slices, initial → settled 1 → settled 2 | Personally reviewed scene |
| --- | --- | --- | --- | --- |
| dx_wormhole | software | cooperative | 278 → 2324 → 3230 | Moving wire tunnel |
| dx_wormhole | software | guest Worker | 275 → 2292 → 3198 | Moving wire tunnel |
| dx_wormhole | WebGL | cooperative | 278 → 2746 → 3652 | Moving wire tunnel |
| dx_wormhole | WebGL | guest Worker | 265 → 2223 → 3125 | Moving wire tunnel |
| dx_bellhop | software | cooperative | 95 → 999 → 1298 | Static connection dialog |
| dx_bellhop | software | guest Worker | 339 → 734 → 1023 | Static connection dialog |
| dx_bellhop | WebGL | cooperative | 95 → 551 → 850 | Static connection dialog |
| dx_bellhop | WebGL | guest Worker | 434 → 1290 → 1579 | Static connection dialog |

Wormhole's ring spacing, lattice curvature and convergence center change in
all four cases. Bellhop's legible dialog remains static; advancing scheduler
counts are evidence of execution while awaiting input, not scene motion.
All 24 original compositor captures were personally inspected. There is no
native Windows reference or complete visual-correctness certification.

All four guest Worker cases identify their owning main endpoint as 1, slot 0,
with increasing owning slice counters and the posted standard-module hash.
Bellhop creates a second guest Worker; its two module posts match the same
hash. A passive read of its WebGL-selector case directly identifies sibling
endpoint 2, slot 1, parked after one slice. These are guest execution owners.
They do not imply that a rendering Worker owns the scene.

Both WebGL-selector cooperative cases allocate a host D3D GPU helper, but
every sampled draw, clear and upload count is zero and its target list is
empty. Software cooperative cases have no such helper. The guest Worker
cases have empty D3D statistics and no render endpoint. Direct passive reads
of both WebGL-selector Worker cases find no render Worker manager or host
D3D GPU helper. Direct reads of all four WebGL-selector cases identify the
page's `Win98Renderer`, its actual screen canvas and
`CanvasRenderingContext2D`. There is no original WebGL target from which to
obtain an owning GL renderer/provider string. The actual observed routes are
DirectDraw software scene presentation and a GDI dialog. This run covers the
eight requested configurations as supplemental observations; it establishes zero active D3D/WebGL draw
cases and makes no backend-parity claim.

All 1,394 staged closure pins and 166 supplemental Git-served paths pass
postflight. The response audit matches 1,443 recovered successful response
bodies to pinned source/input/module bytes with zero mismatches. DevTools
could not recover 81 individual response bodies; their deliveries are not
independently hash-certified. Optional UI/auth/bundle/favicon 404s remain in
the logs. The remote npm install removes two stale native-GL root dependency
declarations from lock metadata; its exact patch and updated pin are retained.
Existing lit-alpha, Execute-buffer-slot and GPU-fallback-counter regressions
pass. Neither these tests nor empty GPU counters certify scene correctness.

In addition to the prerequisite blocker, three harness incidents are retained.
A live Bellhop console log changed
between inventory and download; the mismatched copy was preserved and the
terminal log was separately inventoried, retrieved and SHA-verified. An
optional supplemental software Bellhop Worker observer ran after its browser
closed and found no `DevToolsActivePort`; it had no dispatch or guest effect
and was not retried. The original built-in ownership/counter/module captures
remain intact. An extra pre-stop helper-hash probe failed its initial shared
disk free-space guard before any remote action, with the exact free byte
count unrecorded. The shell nevertheless continued to the delegated stop.
Required terminal artifact/module retrieval and SHA verification had already
completed. The auxiliary probe was not rerun and the stopped box was not
resumed. Immediate subsequent free space exceeded 2.63 GB; the owned run was
about 12 MB and no peer data was removed. Continuous compliance with the
task's 2 GB floor is therefore not claimed.

All 185 terminal runtime artifacts, 3,918,536 bytes, and both unique modules
were downloaded and SHA-verified before the normal nonforced stop request at
09:54:07.764 UTC. `terminal-verified.json` maps remote names to exact retained
local versions, including final console logs. Postflight finds all 13 named
processes absent, all three HTTP ports closed, no live Chromium/run process,
no remaining profiles and released input. Generated-fixture Chrome exits 0.
Box `bx_24t85jnv`, created at 09:40:35 UTC with original expiry 10:15:35 UTC,
is confirmed archived at 09:54:08.150 UTC, stop completed with `forced:false`,
expiry now null. Custody returns to the coordinator with no active runtime.

Next work is to repair the helper's transitive request closure and require
a positive end-to-end request/consume/native/exact-ACK check plus exact
timeout/sticky rejection reasons before any separately authorized fresh
originals. Bellhop's provider dropdown was not opened and no connection,
connected scene or network behavior was tested. No demonstrated emulator
semantics violation justifies a fix or failing-before regression. FPS, audio, native Windows reference,
backend parity and historical27 membership remain unqualified. No public
deployment, nested worker or stopped-box resume occurred.

Final named-case, integrity, lifecycle and retrieval results are recorded in
the run's `coverage-ledger.json`, `served-and-module-audit.json`,
`retrieved/postflight.json` and `result.json`.
