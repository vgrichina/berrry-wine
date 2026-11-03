# Public legacy texture capabilities to rendered pixels

Task: close the point/bilinear and wrap/clamp rendered-pixel gap in
D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013. Dispatch baseline:
`f8de08500d1efc49ed1c9fbcbee4d563fe7e141d`.

Result: **PASS on both shipped production modules** for software pixels,
cooperative WebGL pixels, actual queued guest/render Worker pixels, and both
rendered negative controls. The mandatory locked build passes. No production
defect was demonstrated and no production renderer/capability change was made.
The assigned test filename is registered as E2E in `tools/test-tiers.js`.

Coordinator release: 2026-11-03 23:50:23 UTC; acknowledged before allocation.
Fresh runtime `bx_5jkb55xs`, TTL3600, expiry `2026-11-04T00:51:20.438Z`.
Shutdown ownership was recorded as coordinator-owned before use. Both tested
module bytes and hashes, numeric readbacks, screenshots and logs were recovered
locally. No predecessor box was resumed and no subworker was launched.

## Executed results

The full-runtime regression ran on Chrome `151.0.7922.108`, Node `v24.22.1`,
using SwiftShader through the actual production WebGL backend. Each module
completed the following checks:

| Path | Guest calls¹ | Draws / pixel observations | Result |
| --- | ---: | ---: | --- |
| Software | 159 | 18 | exact RGB PASS |
| Cooperative WebGL | 159 | 18 | exact DIB + direct GL RGBA PASS |
| GuestWorkerLink → RenderWorker legacy/WebGL | 231 | 26 | exact DIB RGB PASS |

¹ Includes factory dispatch and every public x86 vtable invocation. Each call
checks exact stdcall cleanup and caller return ESP. Extra release-reference
metadata rows in the trace are excluded from this count.

Cooperative WebGL reports 18 draw calls, 18 fences, 18 readback syncs, zero
fallbacks, zero errors and one texture upload. The Worker reports 26 draw calls,
26 fences, 26 readback syncs, zero fallbacks, zero errors and one texture upload.
Four real batches were held across public live sampler mutations, covering
both coordinates and both transition directions. Old queued pixels and the
next draw's changed sampler pixels match independently calculated expectations.
The real render heap retires and is adopted (`heapAdopted: 1`) before the guest
Worker stops. These counts describe actual GPU execution, not software fallback.

Each module also rejects two deliberately incorrect public setter sequences:

| Rendered negative control | Observed RGB | Unchanged oracle RGB |
| --- | --- | --- |
| Force nearest during linear/interior | `(64,192,32)` | `(94,146,70)` |
| Keep wrap during clamp/outside | `(160,32,64)` | `(64,192,32)` |

Both fail specifically at `PIXEL ORACLE` after successful boot, public COM
acquisition, state calls and rendering; neither a bootstrap error nor SKIP is
accepted as a negative-control success.

Module SHA-256:

- Canonical, 2,143,540 bytes:
  `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
- Compatibility, 2,146,153 bytes:
  `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
- Original `test/binaries/calc.exe`:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.
- Executed regression source:
  `c7cf0e0fadcd8b4186e8d9ef66b7423dba63cf5904ecf9fdeb8e0d871e1941be`.

The module closure comes from the committed dispatch baseline above. The run
source seal pins provisioned Git blobs and the owned test/tier patches;
per-run JSON records every WAT input hash and production JavaScript file hash.
Foreign shared-checkout WIP was excluded from runtime provisioning.

## Fixture and independent oracle

`test/test-legacy-texture-rendered-contract.js` boots the complete production
module with `load_pe(calc.exe)` followed by `init_dx_com_thunks()`. It acquires
DirectDraw7 through factory dispatch, Direct3D7 through QueryInterface, real
Surface7 textures and targets through CreateSurface, and Device7 through
CreateDevice. Every COM call emits x86 PUSH instructions and an indirect CALL
through the acquired object's published vtable. Each call checks HRESULT where
applicable, exact stdcall ESP, final caller ESP, bounded completion and output
guards. No internal device/state/draw wrapper or seeded record is used.

The RGB texture, in row order, is `(32,64,96), (160,32,64), (64,192,32),
(224,128,160)`. Samples are interior `(3/8,5/8)` and outside `(-1/8,9/8)`.
Texel centers use `(i+0.5)/size`; point chooses `floor(uv*size)`; bilinear
integrates four separable tent weights, independently written in JavaScript.
Every tap is separately wrapped modulo two or clamped to `[0,1]`. The oracle
does not execute production sampling/descriptor/decode/shader helpers.

The triangle has screen vertices `(-8,-8), (24,-8), (-8,24)` and constant UV,
Z=0.5 and RHW=1. The observed D3D pixel center is `(2,2)`, safely inside all
edges. WebGL addresses the corresponding framebuffer center `(2.5,5.5)` with
`readPixels(2,5,1,1)`: D3D's integer pixel-center convention includes the
backend's half-pixel mapping and a bottom-up framebuffer. Constant UV removes
interpolation uncertainty without depending on which convention a test helper
uses to calculate barycentric coordinates.

Public Surface7 Lock/Unlock writes texture pixels and reads the render target.
Lock is also the real production CPU-access fence. The X8R8G8B8 target stores
RGB in exact 8-bit channels; no RGB565 reconstruction or tolerance is applied.
Both interpolation weights and resulting colors are exactly representable, and
the planner rejects nonintegral expected channels. X is excluded from software
versus GPU comparison; cooperative WebGL readback also checks opaque alpha.
Retained observations include raw target words, full DIB RGBA images, matching
WebGL RGBA and errors where accessible, and production draw/fence/sync/fallback
counts. Worker pixels come from actual production WebGL readback into the DIB;
the fixture does not obtain a separate Worker GL context.

One device and texture undergo point → linear → point and wrap → clamp → wrap,
including linear wrap → clamp → wrap, with both coordinates at every state.
The planner's interior point/linear colors are `(64,192,32)` / `(94,146,70)`;
outside point wrap/clamp colors are `(160,32,64)` / `(64,192,32)`; outside linear
wrap/clamp colors are `(142,66,86)` / `(64,192,32)`.

The actual-thread arm uses production GuestWorkerLink → RenderWorker.Manager →
legacy/WebGL endpoint, reusing palette-worker transport, stats and retirement
patterns. It delays only real batch message delivery, changes sampler state
through public vtables before drain, checks the old draw, then checks the next
draw with the new sampler. Both transition directions and both coordinates ran.

Two executed rendered negative controls intentionally request nearest-only filtering or
keep wrap addressing while the unchanged oracle requests linear/clamp. They
must fail a pixel assertion after successful COM boot and drawing. Syntax or
bootstrap failure cannot satisfy a negative control.

## Evidence and recovery

Ignored evidence directory:
`scratch/runs/20261103-legacy-caps-rendered-boundary/`.
`planner.json` is **planner evidence only**. Executed evidence is in
`canonical-fifth/result.json` and `compat-final/result.json`, with the three
backend screenshots alongside each. Both unique tested module files are under
`modules/`; download hashes are in `recovery-downloads.json`. The locked build
logs and execution receipts are retained separately. Unavailable paths would
remain untested and could not produce PASS/SKIP.
Source recovery uses the exact Git commit and binary patch for relevant
uncommitted hunks, including the new fixture/note. No source tree archive or
duplicate game media is retained as evidence. The sole bootstrap PE is referenced
by existing path and SHA-256; runtime provisioning may copy it only into the
authorized isolated test environment.

Cheap recovery command:
`node test/test-legacy-texture-rendered-contract.js --plan`.
To reproduce after an authorized fresh runtime allocation, provision the exact
Git baseline plus `fixture.patch` and `test-tiers.patch` recorded in this run.
Provide the original calc PE only at its existing path, verifying the hash.
Run `flock /tmp/wine-build.lock bash tools/build.sh`, then set
`CHROME=/usr/bin/google-chrome`, `LEGACY_RENDER_SOURCE` to the full source SHA,
`LEGACY_RENDER_MODULE_DIR=build`, and `LEGACY_RENDER_EVIDENCE` to a fresh ignored
run subdirectory. Execute the test with and without `--compat`. Without a
module directory the test compiles both production closures, including the
compatibility trampoline overlay. No source archive is needed for recovery.

The first build stopped because the isolated staging lacked the tracked
toyvm browser bundles; provisioning their exact Git blobs resolved this.
Initial fixture executions exposed missing beep epoch lifecycle imports,
missing isolation headers on the custom page, and a hard-coded Worker image
base inherited from the palette fixture. The fixture now records no-audio
epoch callbacks, serves isolation headers, and derives/verifies the original
PE image base. The initial failures and first successful build are preserved;
no production handler, oracle or historical expectation was changed to fix them.

Limits: this is a small constant-UV triangle sampler regression on an 8-bit RGB
target. It does not establish minification/mips, mixed MIN/MAG selection,
other render-target quantization, perspective UV gradients, native hardware
performance, original-game gameplay, or every legacy interface revision.
Worker pixels are production GL-to-DIB fence observations, accompanied by GPU
execution/readback statistics, rather than a separate direct Worker GL probe.

Existing accepted native cube rejection/guard and 1053 offline controls are
not repeated. This task does not widen capability masks or alter unsupported
cube/BORDER behavior. Existing actual-thread CLI and palette regressions remain
their own evidence; they do not establish this fixture's public-COM pixels.
