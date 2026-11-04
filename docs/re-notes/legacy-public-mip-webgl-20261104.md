# Public DD7/D3D7 mip selection: bounded direct WebGL subset

Canonical-module direct WebGL1 and WebGL2 PASS: 17 observations / 13 public
draws each, with four rendered negatives rejected in total. Overall browser
execution stopped at the first Worker setup failure; queued rendering and
compatibility-module rendering are **unexecuted**. No production sampler defect
was observed. CDP identifies SwiftShader; physical hardware is unknown.

`test/test-legacy-public-mip-webgl.js` adapts the existing public x86 COM
fixture using checked, unique source seams. DirectDrawCreateEx obtains DD7,
QI obtains D3D7, CreateSurface creates a 16×16 five-level X8R8G8B8 mip chain,
and public GetAttachedSurface7 acquires each child. Public Lock/Unlock fills
each authored level with a distinct solid color and checks dimensions/format.
CreateDevice7, SetTexture7, SetTextureStageState7/readback, BeginScene7,
DrawPrimitive7 and EndScene7 all use acquired vtables and real x86 CALLs with
stdcall/guard checks. There are no fixture-only WAT exports or module patches.
GetCaps7 checks exact triangle `0x030303ff` and line `0x030003c3` filter masks.

The subset covers mip NONE at strong minification, POINT→LINEAR→POINT and NONE
restoration, POINT footprints 0.25 through 32768 (including level clamping),
LINEAR and trilinear half-level blending, and five perspective samples selecting
four distinct levels. The independent oracle differentiates perspective U/Q,
V/Q across a 32-pixel triangle, derives the largest texture-space footprint,
and computes nearest-level selection or inter-level blending. It calls no
production sampling helpers. Expected colors come from those calculations and
authored texture inputs, never software-rendered output. Production derivatives
and mip selection remain active; no fixed LOD is supplied.

Every observation checks public render-target Lock pixels and independent
`gl.readPixels`, actual context VERSION and zero GL errors. Both paths report
13 GPU draws, five texture-level uploads, zero errors and zero fallbacks.
The original mip test's tolerance of two channel units is preserved; maximum
observed error is 0.5. Deliberately setting mip NONE throughout rejects a
level-zero-only implementation; leaving POINT stale when LINEAR is requested
rejects a stale mip filter. Each negative reaches successful public DrawPrimitive7,
actual WebGL readback and a discriminating PIXEL ORACLE failure.

## First setup failure and bounded repair

Both retained modules first passed browser-free public bootstrap, including
five acquired mip levels, public fills/dimension checks and caps. Cheap controls
also check constructor/worker WebGL-version forwarding, unavailable explicit
versions, public-call fixture seams, analytic blend/restoration values and
negative discrimination at the unchanged tolerance.

The single browser attempt passed canonical direct WebGL1/2 and their negatives,
then failed before any Worker COM calls:
`SharedArrayBuffer transfer requires self.crossOriginIsolated`.
The new fixture's custom HTTP routes returned before static-server's ordinary
isolation-header path. A browser-free HTTP control reproduces the missing
header (`null` versus `same-origin`). The final candidate sets COOP/COEP in
the custom handler and runs HTTP controls against the page, module and guest
worker routes before bootstrap/browser execution. Those controls pass.

The repaired HTTP setup has **not** been rerun in Chrome: the assigned single
browser attempt was already consumed. Worker pixel/held-batch code is present
for a future authorized run, but none of it qualifies coverage here. No
production code was changed. The runtime's FAIL status and first error remain
intact in evidence. A separate local command-wrapper parser mistook Boat's
streaming `attached` receipt for command completion; this did not rerun the
browser. The terminal runtime result and recovered artifacts establish outcome.

## Provenance and recovery

Run: `scratch/runs/20261104-legacy-public-mip-webgl/`.
Staged Git baseline: `5b975ccce19bdeacc24fcf455b30f32d536152c9` (includes
`7d1a1289ea698cff150a5227a33f2dfae62fad9c` explicit-version forwarding).
`tested-new-file.patch` reconstructs the exact initially tested fixture;
`source-seal.json` pins all 36 staged inputs. Final candidate changes are
recorded separately in `relevant.patch` and owned new-file patches. The assigned
minimal staged runtime was reused; only the new fixture was uploaded.

- Canonical: 2,143,712 bytes,
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility: 2,146,325 bytes,
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Existing `test/binaries/calc.exe` bootstrap:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Chrome151.0.7922.108 / Node24.22.1 on `bx_4hx68dxv`. CDP reports ANGLE Vulkan
SwiftShader Device (Subzero), driver5.0.0. The browser ran
04:02:03.187Z–04:02:07.823Z (4.636 seconds); browser23405 and its driver are
absent, server/helpers closed. Stable recovery verifies eight unique files
(two module binaries, two captures, two results and two logs) by size/full SHA;
36/36 source pins remained unchanged. No source archives or media evidence
copies were made. The box remains RUNNING/APIidle, healthy/hydrated, expiring
`2026-11-04T04:38:03.251Z`; lifecycle/shutdown ownership returns to coordinator.

PASS: bootstrap on both modules; bounded canonical direct WebGL1/2 pixels and
negatives; final planner/oracle/options/HTTP controls; predecessor WebGL1 planner;
test-tier regression/membership; `flock /tmp/wine-build.lock bash tools/build.sh`.
The mandatory build reproduced both retained module hashes. The new fixture
is registered as E2E. No fallback-counter detour was performed.

Next: one authorized browser run of the repaired fixture, starting with queued
Worker isolation and then compatibility-module rendering. Further uncovered
cases: non-solid mip texels and MIN/MAG discrimination, vertical-only footprints,
partial/malformed chains, per-level formats/padded pitch, changed lower-level
uploads, legacy combined filters, other dimensions/formats, physical GPU and
original games/full27. Resource lifetime/rejected queued textures are excluded.

```sh
node test/test-legacy-public-mip-webgl.js --plan
LEGACY_PUBLIC_MIP_SOURCE=<full-Git-SHA> \
LEGACY_PUBLIC_MIP_MODULE_DIR=<retained-module-directory> \
LEGACY_PUBLIC_MIP_EVIDENCE=scratch/runs/<fresh-id>/browser \
  timeout --kill-after=15s 840s node test/test-legacy-public-mip-webgl.js
```

`--bootstrap` performs public bootstrap on both pinned modules without Chrome
or draws. `--plan` performs no Wasm instantiation or browser rendering.
