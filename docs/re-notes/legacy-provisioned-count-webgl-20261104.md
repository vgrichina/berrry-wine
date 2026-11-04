# Provisioned expanded projected WebGL: first pixel failure and repair

The authorized repaired modules were provisioned successfully, and actual
WebGL1 pixels exposed a mip-selection mismatch. The single Chrome process
stopped at the first failure and closed normally. A production repair passes
offline compiler and Device submission regressions, but **repaired GL pixels
and the expanded matrix remain unqualified**. PROJECTED stays unadvertised.

Read with [the supplied-coordinate contract](legacy-projected-coordinate-contract-20261104.md),
[the previous prerequisite failure](legacy-count-selector-webgl-20261104.md)
and [the historical COUNT3 completion](legacy-queued-projected-completion-20261104.md).
The historical completion does not qualify this expanded fixture.

## Actual browser result

Evidence: `scratch/runs/20261104-legacy-provisioned-count-webgl/`.
Tested source: `b2e6bb1277a11637a7f666c98324092772c2d9dc`, including the
owned runner changes in `relevant-before.diff`. The production projection
repair from `5fa5519eb55e6b2fc83fae4ef12a218e7efc9a7e` is present.

Chrome 151.0.7922.108 ran on assigned `bx_xgrkbhxj` from
**08:16:06.399Z to 08:16:08.687Z**, with explicit hard close 08:34Z.
Only normal module / direct / nonindexed / WebGL1 was attempted. Its first
91 public DrawPrimitive calls succeeded. Public Surface7 Lock and independent
GL readPixels agree on all 273 observations: 272 pass tolerance 2, then:

| State / sample | Actual RGB | Oracle RGB |
| --- | --- | --- |
| COUNT3/TEX7/scale16/wfalse, (9,11) | 137,163,146 | 138,87,119 |

The actual spatial color belongs to mip 3; the independent rational oracle
selects mip 2, with footprint `5.560719202925077`. Earlier COUNT2 states rendered,
but no complete matrix cell passed. COUNT4, WebGL2, indexed, compatibility,
owning Worker, held mutation, nearclip and semantic faults were not reached.
No second browser or retry was used. No recording result is counted as pixels.

The lossless `result.json.gz` recovers 9,043,641 bytes with original SHA-256
`619f4a540ae36c4a1ba9fbb2656c0e46183c98d74271692e7e0c8ad503cd58b2`.
`audit.json` checks every retained RGB against its 32×32 Lock array and direct
GL readback, zero GL errors, the 272 successes and sole mismatch.
`failed-readback.png` is encoded directly from the failed Lock array and was
personally inspected. `remote-artifacts.json` and `recover.log` verify all five
unique closed remote artifacts by size and full SHA-256.

## Repair and its limits

The previous backend used native implicit GL LOD when min/mag matched and the
mip chain was complete. That path does not enforce the analytic quotient
footprint required by this fixture. Even the existing atlas path differentiated
UV after projection. This source diagnosis explains a policy gap; the closed
capture does not reveal the driver's internal LOD estimator.

`lib/d3d9-backend.js` now selects the explicit mip atlas for projected mip draws.
`lib/d3d9-shader.js` passes homogeneous texture numerators/divisor to the atlas
sampler, multiplied by geometric reciprocal W to recover affine planes. It
computes `(dN - uv*dQ)/Q` before footprint and mip selection. This preserves
independent geometric W and texture q. Solid transport substitutes its own
reconstructed reciprocal W for the rectangle's `gl_FragCoord.w`.

The regression compiles fixed and mixed projected shader linkage for divisor
z/w, checks the solid reconstruction, and executes actual Device.draw with
mocked GL submissions for WebGL1/2. Complete chains with equal min/mag now
request the analytic atlas. Loading either predecessor production file in
memory makes these new regressions fail. These are offline tests; they do not
establish GLSL driver acceptance or the repaired pixel result.

The assigned `test/test-legacy-count-selector-webgl.js` now runs the expanded
exported fixture with the existing real browser harness. It preserves the
independent exported plan/oracle, tolerance 2 and analytic sample margins. It
configures all sixteen positive cells and six semantic faults for each count
on canonical WebGL1/2. The sixth fault replaces only the held record's owned
matrix before delivery to the owning GL Worker. Held pairs also change live
selector, matrix and flags before delivery. These expanded Worker/fault paths
have syntax and seam checks, but remain unexecuted in Chrome after the first
failure. Final selector-mutation strengthening and the production repair were
made after browser closure; `relevant-final.diff` records them separately.

## Provisioning, validation and custody

Both exact binaries were transferred directly into retained runtime build
paths, never into scratch evidence, with before/after SHA verification under
`/tmp/wine-build.lock`:

| Runtime build file | SHA-256 |
| --- | --- |
| wine-assembly.wasm | 129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52 |
| wine-assembly.compat.wasm | 3fde0fc42ecd0d9d5096d0b9eb83cd3086cb74aab8ac3f7b9f3fd15f5783fe6a |

`source-seal.json` retains all 44 path/hash pins, prior hashes, changed small
files and dependency lock identity. Runtime Puppeteer 24.31.0 CJS/ESM imports,
module validation, public COM bootstrap, production recording transport,
HTTP served hashes and isolation passed before launch, including a separate
successful `--preflight` command. The browser reused the retained dependency
and calc media paths. SSH transfer was unavailable; authorized transfer used
the working command channel. No source archive or duplicate module/media
recovery was made. Runtime still retains the exact failed-run source/modules;
the later production repair has not been staged there.

Both normal and compat expanded native software suites pass, including four
155-draw routes, held physical Worker replay and all eighteen fault rejections
per module. Their closed JSON is losslessly compressed locally. These native
results are separate from GL acceptance. Final analytic/repair controls,
predecessor-negative regressions, original projected plan, shader suite,
fixed-function shaders, fixed TL plan/cache, depthless-Z and solid transport
checks pass. The locked full build passes after the production repair. Browser
cache graph validation also passes locally (98 page / 13 Worker scripts).

After closure all 44 runtime pins remained unchanged, Chrome was absent and
the fixture server port was closed. Box inspection confirms healthy/hydrated
**RUNNING / API idle**, expiry **2026-11-04T08:44:23.836Z**. Shutdown ownership
returns to the coordinator. No lifecycle operation, allocation, resume,
source-box access, local Chrome, subworker, game, Heroes II or deployment ran.

Next requires a separately authorized browser run of the repaired source,
with refreshed hashes/preflight, followed by the full positive/fault matrix.
Generated coordinates, input dimensions, full27 and physical hardware remain
unqualified. CDP reports SwiftShader while the context reports Intel/Mesa;
this conflicting identity does not support a hardware claim.
