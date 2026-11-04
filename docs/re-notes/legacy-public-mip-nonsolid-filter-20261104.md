# Public mip spatial filtering: first rendered failure preserved

The new fixture exposes a mismatch in canonical queued Worker WebGL1
minification. It does **not** close the rendered spatial filtering matrix.
One nearest-only rendered negative passed before the positive cell. The
positive cell passed four observations, then failed its fifth observation:

| Observation | Actual RGB | Independent expected RGB | Result |
| --- | --- | --- | --- |
| MAG POINT | 24,140,124 | 24,140,124 | PASS |
| MAG LINEAR | 47,98,84 | 45.504,99.44,85.580032 | PASS at tolerance 2 |
| MAG POINT restored | 24,140,124 | 24,140,124 | PASS |
| MIN POINT | 159,37,143 | 159,37,143 | PASS |
| MIN LINEAR | 121,50,107 | 113.752,42.28,103.404992 | FAIL |

The negative made two successful public draws and production fenced readbacks.
Its second observation retained nearest `[24,140,124]` while independently
expecting linear `[45.504,99.44,85.580032]`. Rejection was an actual pixel
failure, not a draw/bootstrap failure. Public setters and getters confirmed
the intentionally forced POINT MIN/MAG values.

The fixture adds five authored mip grids with asymmetric spatial checker
channels and distinct level colors. Public x86 COM acquisition of all children,
Lock/Unlock writes, dimensions, exact pitches, guards, stdcall checks, sampler
setters/getters, DrawPrimitive and target Lock fences remain active. MIN and
MAG now vary separately on the same device; POINT restoration and irrelevant
filter changes are included. Queued Worker plans hold three batches while
changing live MAG/MIN state before drain.

The oracle evaluates perspective U/Q and V/Q and differentiates them with the
quotient rule. It obtains LOD from the largest texture-space footprint, samples
POINT with floor(normalized-coordinate * dimension), samples bilinear using
the four texel-center weights, and blends adjacent levels for trilinear.
The planner includes magnification, integer mip minification, fractional LOD
1.5 with both within-level filters, and three perspective trilinear samples.
All selected UVs are interior and noninteger in base texel coordinates.
Hand-calculated point, bilinear and trilinear references and discriminating
pair controls pass. No production-derived oracle, fixed LOD, WAT patch or
tolerance increase was introduced; tolerance remains 2.

The first failure is consistent with an existing coverage/interpolation
displacement, rather than demonstrating an isolated MIN filter mapping defect.
`lib/d3d9-fixed.js` intentionally shifts geometry by 1/16 pixel to enforce the
top-left fill rule; its existing focused test passes. Offline diagnostic
evaluation at `(x+1/16,y+1/16)` predicts all five recorded observations within
0.6 channel units, including this failure. This diagnostic is recorded only
in ignored evidence: the fixture retains the independent integer-center
expectations and the original failure. The prior internal mip test explicitly
accounts for this coverage offset; the new public oracle does not inherit it.
Changing shared rasterization requires preserving the existing top-left
coverage behavior as well as validating interpolation. No production fix is
qualified by this attempt, and no production files were changed.

The single browser attempt ran 04:26:05.412Z–04:26:12.911Z, 7.499 seconds,
with fail-fast termination and no retry or second browser. Exactly zero
positive cells completed; canonical queued Worker WebGL1 is partial, and
the other seven module/backend/version cells are unexecuted. Fractional LOD,
perspective spatial rendering and held spatial batches were not reached.
The partial positive cell had five draws, five fences, five readback syncs,
five level uploads and zero errors, fallbacks or native/fallback software
draws. All five public level locks succeeded for both bootstrap modules.
The previously accepted solid matrix and 24 negatives were not rerun.

Actual Worker GL VERSION is `WebGL 1.0 (OpenGL ES 2.0 Chromium)`; renderer is
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
Actual GL_VENDOR was not captured by Worker stats and is unknown. Separately,
Chrome 151.0.7922.108 CDP reports Google Vulkan SwiftShader/Subzero driver
5.0.0. Physical GPU attribution is unknown. No physicalGPU or full27 claim.

Run: `scratch/runs/20261104-legacy-public-mip-nonsolid-filter/`.
Source baseline: `4c4ff5cf56afe7a893a6413a7bccb7c9951e36db` plus
`relevant.patch`; this new note is retained as `owned-note.patch`.
Only the 36 minimal predecessor inputs were staged, including the small
existing calc bootstrap, without source archives or game media copies.

- Canonical module: 2,143,712 bytes,
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility module: 2,146,325 bytes,
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Calc bootstrap:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Before Chrome: all exact minimal bytes and hashes, both public bootstraps,
planner/seams/oracle/options, HTTP isolation and actual module bodies, plus
unversioned/versioned Worker fault-injection and ordinary-body controls PASS.
Afterwards: evidence consistency checks, tier membership/regression, existing
top-left policy test, and `flock /tmp/wine-build.lock bash tools/build.sh` PASS.
Eleven stable unique logs/results/modules were recovered with sizes and full
SHA-256 after helpers closed. Browser and driver absence and all 36 unchanged
source pins were verified at 04:26:35Z, before the 04:41Z recovery deadline.
There was no screenshot before the failure; pixel evidence is the recorded
target readback, including complete DIB RGBA arrays.

Next work must resolve the independent integer-center interpolation mismatch
while preserving top-left coverage, then validate the remaining spatial cells
under a newly authorized browser attempt. This task does not launch that work.
Assigned `bx_2am3q4y3` remains RUNNING/APIidle, healthy/hydrated, expiry
`2026-11-04T04:51:59.767Z`; lifecycle/shutdown belongs to the coordinator.
No other box access, lifecycle action, local heavy runtime, subworker,
successor, public deployment or Heroes II work occurred.
