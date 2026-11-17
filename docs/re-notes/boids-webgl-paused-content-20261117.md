# Boids WebGL content diagnosis, 17 November 2026

Evidence: `scratch/runs/20261117-boids-webgl-paused-content/`.
The complete-display capture repair remains published as 53ddc2882. This task
changes only its investigation harness, fixtures and tests. No production
activation, renderer, context, retirement, clock, ownership or capture semantics
changed. No original flock/motion repair is claimed.

The previous observer installed a single global trace at library load. Loading
the software executor after WebGL hid the active WebGL executor's trace. It now
retains a separate bounded trace per executor and selects the active trace on
execution. Tests cover loading both modules, return/exception preservation,
copied inputs and bounded storage. A separate passive Presenter wrapper records
bounded public frame arguments and completed presentation counts. Diagnostic
mode uses existing public API tracing with at most 40 lines per selected name.
These changes do not schedule guest work or presentation.

The original Microsoft DX5 SDK self-extractor was retrieved from
https://archive.org/download/idx5sdk/idx5sdk.exe. Its 33,018,416 bytes have SHA-1
b14370372307360a9e8de2ebd8fcd13173fd3b4a, matching the previously documented SDK.
Five relevant original sample sources were extracted, individually hashed, and
retained as reference inputs; no repository snapshot was made. The original
executable remains SHA-256 b9327e6fb2758e232d0ca0fb410b11097fd557dc59b3d405167d976db208b8d9.
`winproc.cpp` OnPaint calls PaintPaused for any inactive, paused, invalid,
minimized or not-yet-created D3D window. OnIdle separately gates DrawFrame.
Thus the text alone cannot establish current simulation state.

Exactly one passive diagnostic WebGL/actual-Worker original ran on immutable
53ddc288272a34a73fec775c4b419167f2c28e34 plus recorded observer suffixes.
Preparation and runtime used the fixed 240/260 and 300/320 second limits and
independent prearmed watchdogs. No input, window override, configuration/media
edit, forced flush, unpause, private memory access or unchanged retry occurred.
No additional software original was needed or launched.

The public trace records natural WM_ACTIVATEAPP(TRUE), WM_ACTIVATE(WA_ACTIVE)
and WM_SETFOCUS delivery, followed by continuing BeginScene, EndScene and Flip.
The page instance's thread-local focus getter is zero despite delivered focus;
that value is not an activation oracle. Three complete captures still show the
unchanged Paused display. WebGL receives changing submitted vertex/index bytes,
67 DRAW_UP records in each retained complete PRESENT interval, full-target
CLEAR, and alternating render target IDs 3/9, each matching its PRESENT target.
Presenter frames reach HWND 65537; delivery counts advance, stale rejection is
zero, CPU-present sequence remains zero, and the compositor accepts the current
GPU layer. No device/context failure is recorded. Counts and accepted layers
are not evidence of visible GPU geometry in this original.

A newly authored public COM Device7 flip-chain fixture runs through the actual
guest Worker and WebGL render Worker. Its complete source has exactly the known
320x240 blue geometry rectangle within a 640x480 opaque black frame; all 307,200
source pixels pass the literal oracle. A causal public vertex-color mutation
changes that same submitted geometry to black, with matching native worker
execution and complete-frame oracle. Nine native ownership/failure controls per
fixture reach their required readiness/capture stage and refuse. This proves a
working native GPU geometry/Flip route, not sample-specific Device2 parity.
The blue fixture's literal pixel oracle was applied offline to its retained
capture; the black fixture ran the same oracle inside the harness. All fifteen
run-specific harness file versions were reconstructed and hash-verified against
their launch pins. Existing compiler normalization changes non-ASCII comment
bytes in 88 in-memory WAT buffers; independently reproduced hashes account for
those served-source differences from Git. No guest code was patched.

The remaining blocker is localization of the sample-specific pixel loss between
GPU execution, transferred bitmap content and final composition. Existing logs
prove submission and delivery but do not retain independent pixel observations
at those two intermediate boundaries. The bounded two-frame stream trace also
evicts initial CREATE/SHADER/UPLOAD definitions, so it is not a self-contained
replay. A production fix based only on these records would be speculative.
The next useful work is an authored Device2 fixture reproducing the original's
16-bit flip chain, depth attachment, viewport Clear, indexed terrain/bird draws
and initial GDI paint, with independent public frame-content checks before and
after bitmap transfer. The simpler Device7 fixture does not reproduce the defect.
Further original execution needs new authorization or a material causally proved,
natively qualified and published repair; the repaired-original authorization was
not used. The task stops with this concrete content-localization blocker.

Canonical flock build and focused tests are recorded separately from immutable
runtime qualification. The first build log reaches completion but its tool wait
returned 143; it is not counted as passing. A subsequent build has an explicit
native wait receipt. Runtime/module/media/source hashes, owned binary patches,
selected named screenshots and actual process waits are in result.json. No frame
series, source archive, media bundle, box, extra worker or public deployment was
created. Inherited November 16 joins remain UNKNOWN; browser closure is not guest
Quit. Box ID null, state NOT_CREATED, expiry null, stop receipt N/A.
